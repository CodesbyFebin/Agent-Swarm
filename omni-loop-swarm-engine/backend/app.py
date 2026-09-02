"""
Flask app: routes, CORS, request validation, error normalisation.
"""
from __future__ import annotations

import json
import logging
from dataclasses import asdict

from flask import Flask, Response, jsonify, request, stream_with_context

from . import __version__
from .config import settings
from .demo import run_demo_pipeline
from .llm import AgentError
from .pipeline import PipelineResult, run_pipeline, to_wire
from .swarm import get_run, start_swarm_run

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s"
)
log = logging.getLogger("omni-loop")


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = settings.max_request_bytes

    @app.after_request
    def add_cors_headers(response: Response) -> Response:
        response.headers["Access-Control-Allow-Origin"] = settings.cors_allow_origin
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["X-Pipeline-Version"] = __version__
        return response

    @app.route("/api/<path:_>", methods=["OPTIONS"])
    def cors_preflight(_):  # type: ignore[no-redef]
        return "", 204

    # ----------------------------------------------------------------- #
    # Routes
    # ----------------------------------------------------------------- #

    @app.route("/api/health", methods=["GET"])
    def health():
        return jsonify({
            "status": "ok",
            "version": __version__,
            "max_remediation_loops": settings.max_remediation_loops,
        })

    @app.route("/api/demo", methods=["POST"])
    def demo():
        body = request.get_json(silent=True) or {}
        task = (body.get("task") or "").strip()
        if not task:
            return jsonify({"error": "task is required"}), 400

        # Optional: allow the demo to exercise 0 or 1 remediation loop for
        # visual variety. Defaults to 0 so the demo is fast.
        try:
            loop_count = max(0, min(int(body.get("loop_count", 0)), 2))
        except (TypeError, ValueError):
            loop_count = 0

        try:
            result = run_demo_pipeline(task, loop_count=loop_count)
            return jsonify(to_wire(result))
        except Exception as e:  # pragma: no cover - demo path shouldn't fail
            log.exception("demo pipeline failed")
            return jsonify({"error": f"Unexpected error: {e}"}), 500

    @app.route("/api/execute", methods=["POST"])
    def execute():
        body = request.get_json(silent=True) or {}
        task = (body.get("task") or "").strip()
        constraints = (body.get("constraints") or "").strip()
        api_key = (body.get("api_key") or "").strip()
        model = (body.get("model") or "").strip()
        base_url = (body.get("base_url") or "").strip()
        stream = bool(body.get("stream", False))

        if not task:
            return jsonify({"error": "task is required"}), 400

        # Credentials are optional: an omitted model/base_url falls back to
        # the Kilo Gateway free tier (anonymous, no key needed). A caller
        # who *does* supply their own model/base_url without a key is
        # trusted to be pointing at something that accepts anonymous calls.
        require_api_key = bool(api_key)
        # Free tier gets the whole default pool as a fallback chain (so one
        # stale/rate-limited model doesn't fail the run); a caller-supplied
        # model has no pool to fall back within.
        model_pool: tuple = ()
        if not model:
            model_pool = tuple(settings.swarm_default_models)[: settings.swarm_max_models]
            model = model_pool[0] if model_pool else ""
            if not model:
                return jsonify({"error": "no default model configured; pass model in the request"}), 400
        if not base_url:
            base_url = settings.kilo_base_url

        if stream:
            return _stream_pipeline(
                task=task,
                constraints=constraints,
                api_key=api_key,
                model=model,
                base_url=base_url,
                require_api_key=require_api_key,
                model_pool=model_pool,
            )

        try:
            result = run_pipeline(
                task=task,
                constraints=constraints,
                api_key=api_key,
                model=model,
                base_url=base_url,
                require_api_key=require_api_key,
                model_pool=model_pool,
            )
            return jsonify(to_wire(result))
        except AgentError as e:
            log.warning("pipeline agent error: %s", e)
            return jsonify({"error": str(e)}), 502
        except Exception as e:  # pragma: no cover
            log.exception("pipeline failed")
            return jsonify({"error": f"Unexpected error: {e}"}), 500

    def _stream_pipeline(*, task: str, constraints: str, api_key: str,
                         model: str, base_url: str, require_api_key: bool = True,
                         model_pool: tuple = ()) -> Response:
        """Server-Sent Events stream of agent progress.

        Wire format:
          event: step
          data: {"name": "BUILDER", "role": "builder", ...}

          event: done
          data: {"final": {...full result...}}
        """
        def generate():
            captured: list = []

            def on_step(step):
                captured.append(step)
                payload = json.dumps({
                    "name": step.name,
                    "role": step.role,
                    "evidence": step.evidence,
                    "elapsed_seconds": round(step.elapsed_seconds, 2),
                    "usage": step.usage,
                    "error": step.error,
                })
                yield f"event: step\ndata: {payload}\n\n"

            try:
                # We need the generator to drive the callback. Easiest: run the
                # pipeline with a callback that pushes into a queue, and read
                # the queue from a generator. But for simplicity, run the
                # pipeline synchronously here, emitting step events as we go.
                # We can't easily mix a callback-driven generator with Flask
                # streaming, so we use a thread-safe list and emit at the end
                # of each step using a sentinel pattern: the callback appends
                # to `captured`, and we poll. Simpler: use a list and emit all
                # steps at the end, plus a final "done".
                #
                # Implementation choice: do the full run, emit one event per
                # step at the end, then "done". This keeps the code simple and
                # the UX identical to a real stream for now (frontend already
                # renders incremental progress via the in-app animation).
                result = run_pipeline(
                    task=task,
                    constraints=constraints,
                    api_key=api_key,
                    model=model,
                    base_url=base_url,
                    require_api_key=require_api_key,
                    model_pool=model_pool,
                )
                for step in result.steps:
                    payload = json.dumps({
                        "name": step.name,
                        "role": step.role,
                        "evidence": step.evidence,
                        "elapsed_seconds": round(step.elapsed_seconds, 2),
                        "usage": step.usage,
                        "error": step.error,
                    })
                    yield f"event: step\ndata: {payload}\n\n"
                yield f"event: done\ndata: {json.dumps(to_wire(result))}\n\n"
            except AgentError as e:
                log.warning("streamed pipeline agent error: %s", e)
                yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
            except Exception as e:  # pragma: no cover
                log.exception("streamed pipeline failed")
                yield f"event: error\ndata: {json.dumps({'error': f'Unexpected error: {e}'})}\n\n"

        return Response(
            stream_with_context(generate()),
            mimetype="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    # ----------------------------------------------------------------- #
    # Parallel swarm — runs N candidates in parallel + arbiter
    # ----------------------------------------------------------------- #

    @app.route("/api/swarm/models", methods=["GET"])
    def swarm_models():
        """Free-tier model pool for swarm mode, plus the Kilo base URL."""
        return jsonify({
            "base_url": settings.kilo_base_url,
            "default_models": list(settings.swarm_default_models),
            "max_models": settings.swarm_max_models,
            "anonymous_supported": True,
            "note": (
                "Kilo Gateway's free pool rotates. Anonymous calls (no API key) "
                "work at a lower rate limit; add your own api_key/model/base_url "
                "in the request for a higher cap or a different provider."
            ),
        })

    @app.route("/api/swarm", methods=["POST"])
    def swarm_start():
        body = request.get_json(silent=True) or {}
        task = (body.get("task") or "").strip()
        constraints = (body.get("constraints") or "").strip()
        api_key = (body.get("api_key") or "").strip()
        model = (body.get("model") or "").strip()
        base_url = (body.get("base_url") or "").strip()
        mode = (body.get("mode") or "swarm").strip()

        raw_models = body.get("models")
        if isinstance(raw_models, list) and len(raw_models) > 0:
            models = [str(m).strip() for m in raw_models if str(m).strip()]
            if not models:
                return jsonify({"error": "models must contain at least one non-empty id"}), 400
        elif isinstance(raw_models, list):
            return jsonify({"error": "select at least one model for the swarm pool"}), 400
        else:
            models = None  # omitted entirely -> free-tier default pool if model is also omitted

        try:
            agent_count = int(body.get("agent_count", 4))
            iterations = int(body.get("iterations", 3))
        except (TypeError, ValueError):
            return jsonify({"error": "agent_count and iterations must be integers"}), 400
        round_robin = bool(body.get("round_robin", True))

        # Credentials are optional — see start_swarm_run's docstring for the
        # free-tier fallback (Kilo Gateway, anonymous, multi-model pool).
        if not task:
            return jsonify({"error": "task is required"}), 400
        if mode not in {"single", "swarm", "arbiter"}:
            return jsonify({"error": f"unknown mode: {mode}"}), 400
        if not 1 <= agent_count <= 6:
            return jsonify({"error": "agent_count must be between 1 and 6"}), 400
        if not 1 <= iterations <= 10:
            return jsonify({"error": "iterations must be between 1 and 10"}), 400

        try:
            run = start_swarm_run(
                task=task,
                constraints=constraints,
                api_key=api_key,
                model=model,
                base_url=base_url,
                models=models,
                agent_count=agent_count,
                iterations=iterations,
                mode=mode,
                round_robin=round_robin,
            )
        except AgentError as e:
            return jsonify({"error": str(e)}), 400

        return jsonify({
            "id": run.id,
            "status_url": f"/api/swarm/{run.id}/events",
            "result_url": f"/api/swarm/{run.id}/result",
        }), 202

    @app.route("/api/swarm/<run_id>/events", methods=["GET"])
    def swarm_events(run_id):
        run = get_run(run_id)
        if run is None:
            return jsonify({"error": "unknown swarm run id"}), 404

        def generate():
            # Replay anything we've already emitted, then stream new events.
            last_index = 0
            with run.cv:
                while True:
                    while last_index < len(run.steps):
                        step = run.steps[last_index]
                        last_index += 1
                        payload = json.dumps({
                            "name": step.name,
                            "role": step.role,
                            "evidence": step.evidence,
                            "elapsed_seconds": round(step.elapsed_seconds, 2),
                            "usage": step.usage,
                            "error": step.error,
                            "payload": step.payload,
                        })
                        yield f"event: step\ndata: {payload}\n\n"

                    if run.done:
                        if run.error:
                            yield f"event: error\ndata: {json.dumps({'error': run.error})}\n\n"
                        else:
                            yield f"event: done\ndata: {json.dumps(run.final)}\n\n"
                        return
                    run.cv.wait(timeout=15.0)
                    # Heartbeat so proxies don't time out
                    yield ": ping\n\n"

        return Response(
            stream_with_context(generate()),
            mimetype="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    @app.route("/api/swarm/<run_id>/result", methods=["GET"])
    def swarm_result(run_id):
        run = get_run(run_id)
        if run is None:
            return jsonify({"error": "unknown swarm run id"}), 404
        if not run.done:
            return jsonify({"status": "running", "id": run.id}), 202
        if run.error:
            return jsonify({"error": run.error}), 500
        return jsonify(run.final)

    @app.route("/api/swarm/demo", methods=["POST"])
    def swarm_demo():
        """Run a deterministic demo swarm — no API key required.

        Mirrors the real pipeline's output shape so the UI can be exercised
        end-to-end.
        """
        from .swarm_demo import run_demo_swarm
        body = request.get_json(silent=True) or {}
        task = (body.get("task") or "").strip()
        if not task:
            return jsonify({"error": "task is required"}), 400
        try:
            agent_count = int(body.get("agent_count", 4))
        except (TypeError, ValueError):
            agent_count = 4
        agent_count = max(1, min(6, agent_count))
        try:
            iterations = int(body.get("iterations", 3))
        except (TypeError, ValueError):
            iterations = 3
        iterations = max(1, min(10, iterations))
        mode = body.get("mode", "swarm")
        if mode not in {"single", "swarm", "arbiter"}:
            mode = "swarm"
        round_robin = bool(body.get("round_robin", True))

        result = run_demo_swarm(
            task=task,
            agent_count=agent_count,
            iterations=iterations,
            mode=mode,
            round_robin=round_robin,
        )
        return jsonify(result)

    @app.errorhandler(413)
    def too_large(_):
        return jsonify({
            "error": (
                f"Request body exceeds the {settings.max_request_bytes} byte cap. "
                "Trim your task / constraints or raise MAX_REQUEST_BYTES."
            )
        }), 413

    @app.errorhandler(404)
    def not_found(_):
        return jsonify({"error": "not found"}), 404

    @app.errorhandler(405)
    def method_not_allowed(_):
        return jsonify({"error": "method not allowed"}), 405

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host=settings.host, port=settings.port, debug=settings.debug)
