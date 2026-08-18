const timeoutMs = Number(process.env.QWEN_REQUEST_TIMEOUT_MS || 120000);

export function qwenConfigured() {
  return Boolean(process.env.QWEN_API_KEY && process.env.QWEN_BASE_URL && process.env.QWEN_MODEL);
}

export async function qwenChat(messages) {
  if (!qwenConfigured()) throw Object.assign(new Error('QWEN_NOT_CONFIGURED'), { code: 'QWEN_NOT_CONFIGURED' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const base = process.env.QWEN_BASE_URL.replace(/\/$/, '');
    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.QWEN_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.QWEN_MODEL,
        messages,
        temperature: 0.2
      }),
      signal: controller.signal
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = body?.error?.message || `Qwen HTTP ${response.status}`;
      throw Object.assign(new Error(message), { code: 'QWEN_HTTP_ERROR', status: response.status, body });
    }
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw Object.assign(new Error('QWEN_INVALID_RESPONSE'), { code: 'QWEN_INVALID_RESPONSE' });
    return {
      content,
      provider: 'qwen-model-studio',
      model: body.model || process.env.QWEN_MODEL,
      requestId: body.id || null,
      latencyMs: Date.now() - started,
      inputTokens: Number.isInteger(body?.usage?.prompt_tokens) ? body.usage.prompt_tokens : null,
      outputTokens: Number.isInteger(body?.usage?.completion_tokens) ? body.usage.completion_tokens : null,
    };
  } finally { clearTimeout(timer); }
}
