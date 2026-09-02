.PHONY: help install dev backend frontend test build clean docker

help:
	@echo "Omni-Loop Swarm Engine — common targets"
	@echo "  make install    install backend + frontend dependencies"
	@echo "  make backend    run the Flask backend on :5000"
	@echo "  make frontend   run the Vite dev server on :5173"
	@echo "  make test       run the pytest suite"
	@echo "  make build      build the frontend for production"
	@echo "  make docker     build and start the backend via docker compose"
	@echo "  make clean      remove caches and build artefacts"

install:
	pip install -r backend/requirements.txt
	cd frontend && npm install

backend:
	PYTHONPATH=. python -m backend.app

frontend:
	cd frontend && npm run dev

test:
	PYTHONPATH=. python -m pytest -v

build:
	cd frontend && npm run build

docker:
	docker compose up --build

clean:
	rm -rf backend/__pycache__ */__pycache__ .pytest_cache
	rm -rf frontend/dist frontend/node_modules
	find . -name "*.pyc" -delete
