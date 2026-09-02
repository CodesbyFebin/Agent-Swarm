/**
 * Models the swarm can target. Free-form is also accepted — the backend
 * forwards whatever the user types straight to the OpenAI-compatible endpoint.
 */
export const MODELS = [
  { id: "gpt-4o", label: "GPT-4o", tier: "pro" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", tier: "free" },
  { id: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet", tier: "pro" },
  { id: "claude-3-haiku", label: "Claude 3 Haiku", tier: "free" },
  { id: "llama-3.1-70b", label: "Llama 3.1 70B", tier: "free" },
  { id: "mixtral-8x7b", label: "Mixtral 8x7B", tier: "free" },
];

export const MODEL_BY_ID = Object.fromEntries(MODELS.map((m) => [m.id, m]));

export const SUGGESTED_BASE_URLS = [
  "https://api.openai.com/v1",
  "https://openrouter.ai/api/v1",
  "https://api.groq.com/openai/v1",
  "http://localhost:11434/v1",
];
