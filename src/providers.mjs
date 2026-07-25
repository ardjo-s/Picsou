import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { candidateApiId, matchAccessibleId } from "./model-ids.mjs";

const MODEL_TIMEOUT_MS = 120_000;

export function extractJson(text) {
  const trimmed = String(text || "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(candidate);
}

function normalizeTriageOutput(document) {
  if (!document || !Array.isArray(document.results)) return document;
  const results = document.results.map((result) => {
    if (!result || typeof result !== "object") return result;

    let case_id = result.case_id;
    let title = result.title;
    let attention_fit = result.attention_fit;
    let priority = result.priority;
    let signals;

    if (Array.isArray(result.signals)) {
      signals = result.signals;
    } else {
      const {
        source_id,
        source_url,
        evidence_quote,
        confidence,
        signal_type,
      } = result;
      if (
        attention_fit !== false &&
        typeof source_id === "string" &&
        typeof evidence_quote === "string" &&
        evidence_quote.length >= 10
      ) {
        signals = [
          {
            source_id,
            source_url,
            evidence_quote,
            confidence: typeof confidence === "number" ? confidence : 0.5,
            signal_type: signal_type || "relevance_hook",
          },
        ];
      } else {
        signals = [];
      }
    }

    if (priority === "low" || priority === "none") priority = "skip";
    if (attention_fit === false) {
      priority = "skip";
      signals = [];
    }

    return { case_id, title, attention_fit, priority, signals };
  });
  return { ...document, results };
}

function normalizeDecisionOutput(document) {
  if (!document || !Array.isArray(document.results)) return document;
  const results = document.results.map((result) => {
    if (!result || typeof result !== "object") return result;

    let { case_id, title, decision, evidence } = result;
    if (decision === "approved") decision = "approve";
    if (decision === "rejected") decision = "reject";

    if (!evidence || typeof evidence !== "object") {
      const { source_id, source_url, evidence_quote, confidence } = result;
      if (
        decision === "approve" &&
        typeof source_id === "string" &&
        typeof evidence_quote === "string" &&
        evidence_quote.length >= 10
      ) {
        evidence = {
          source_id,
          source_url,
          evidence_quote,
          confidence: typeof confidence === "number" ? confidence : 0.5,
        };
      } else if (decision === "reject") {
        evidence = null;
      }
    }

    return { case_id, title, decision, evidence: decision === "reject" ? null : evidence };
  });
  return { ...document, results };
}

/**
 * Normalize provider JSON to the workflow contract shape before scoring.
 */
export function normalizeOutput(document, contract) {
  const scorerId = contract?.scorer_id || "triage-v1";
  if (scorerId === "decision-v1") return normalizeDecisionOutput(document);
  return normalizeTriageOutput(document);
}

const DEFAULT_OUTPUT_SHAPE_HINT = `
Return ONLY JSON with this shape (no markdown):
{
  "workflow_version": "1.0.0",
  "results": [
    {
      "case_id": "air-paris-001",
      "title": "...",
      "attention_fit": true,
      "priority": "high",
      "signals": [
        {
          "source_id": "air-paris-abstract",
          "signal_type": "relevance_hook",
          "source_url": "https://...",
          "evidence_quote": "exact substring from source text",
          "confidence": 0.9
        }
      ]
    }
  ]
}
Rules: results length must equal case count. priority MUST be high|medium|skip (never low). signals MUST be an array. Use [] and priority skip when attention_fit is false. signal_type is one of relevance_hook|method_signal|impact_claim. evidence_quote must be an exact substring (≥10 chars) of the matching source text.
`.trim();

export function outputShapeHint(contract) {
  return contract?.output_shape_hint?.trim() || DEFAULT_OUTPUT_SHAPE_HINT;
}

export function createOpenAICompatibleProvider({
  baseUrl,
  apiKey,
  fetchImpl = fetch,
  providerName = "openai-compatible",
}) {
  const root = baseUrl.replace(/\/$/, "");
  const headers = {
    Authorization: `Bearer ${apiKey || "EMPTY"}`,
    "Content-Type": "application/json",
  };

  return {
    providerName,
    baseUrl: root,
    async accessibleModels() {
      const response = await fetchImpl(`${root}/models`, {
        headers,
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        throw new Error(`Model discovery failed (${response.status}).`);
      }
      const body = await response.json();
      return new Set((body.data || []).map((item) => item.id));
    },
    async run(model, pack) {
      const started = Date.now();
      const response = await fetchImpl(`${root}/chat/completions`, {
        method: "POST",
        headers,
        signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
        body: JSON.stringify({
          model: model.resolved_id || candidateApiId(model),
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: pack.system },
            {
              role: "user",
              content: `${pack.user}\n\n${outputShapeHint(pack.contract)}`,
            },
          ],
        }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(
          `Provider returned ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`,
        );
      }
      const body = await response.json();
      const content = body.choices?.[0]?.message?.content;
      const usage = body.usage
        ? {
            input_tokens: body.usage.prompt_tokens,
            output_tokens: body.usage.completion_tokens,
            input_tokens_details: {
              cached_tokens: body.usage.prompt_tokens_details?.cached_tokens || 0,
            },
          }
        : null;
      return {
        output: normalizeOutput(extractJson(content), pack.contract),
        usage,
        latency_ms: Math.max(1, Date.now() - started),
      };
    },
  };
}

async function readGrokAuthKey() {
  try {
    const authPath = path.join(os.homedir(), ".grok", "auth.json");
    const raw = JSON.parse(await fs.readFile(authPath, "utf8"));
    for (const value of Object.values(raw)) {
      if (value && typeof value.key === "string" && value.key.trim()) {
        return value.key.trim();
      }
    }
  } catch {
    return null;
  }
  return null;
}

function isUsableXaiApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== "string") return false;
  const key = apiKey.trim();
  // api.x.ai expects an API key (often xai-...), not a grok-cli OAuth JWT.
  if (key.startsWith("eyJ")) return false;
  return key.length >= 16;
}

export async function resolveXaiCredentials() {
  const fromEnv = process.env.XAI_API_KEY?.trim();
  const fromGrok = fromEnv ? null : await readGrokAuthKey();
  const candidate = fromEnv || fromGrok || null;
  const apiKey = isUsableXaiApiKey(candidate) ? candidate.trim() : null;
  const baseUrl = (process.env.XAI_BASE_URL || "https://api.x.ai/v1").replace(
    /\/$/,
    "",
  );
  return {
    apiKey,
    baseUrl,
    rejected_oauth_jwt: Boolean(candidate && candidate.trim().startsWith("eyJ")),
  };
}

function endpointForModel(model) {
  if (model?.endpoint_env && process.env[model.endpoint_env]) {
    return process.env[model.endpoint_env];
  }
  if (model?.id?.includes("mistral") || model?.api_id?.includes("Mistral") || model?.api_id?.includes("Ministral")) {
    return process.env.PICSOU_ENDPOINT_MISTRAL || null;
  }
  if (model?.id?.includes("deepseek") || model?.api_id?.includes("DeepSeek")) {
    return process.env.PICSOU_ENDPOINT_DEEPSEEK || null;
  }
  if (model?.id?.includes("grok")) {
    return process.env.XAI_BASE_URL || "https://api.x.ai/v1";
  }
  return (
    process.env.PICSOU_ENDPOINT_GEMMA ||
    process.env.OPENAI_BASE_URL ||
    null
  );
}

/**
 * Route each candidate to its OpenAI-compatible endpoint (multi-port Brev trio,
 * or Grok via XAI_* when configured).
 */
export async function createLiveProviderRouter({ fetchImpl = fetch } = {}) {
  const providerCache = new Map();
  const accessibleCache = new Map();

  async function getProvider(baseUrl, name) {
    const key = baseUrl.replace(/\/$/, "");
    if (providerCache.has(key)) return providerCache.get(key);
    let apiKey = process.env.OPENAI_API_KEY || "EMPTY";
    if (key.includes("x.ai")) {
      const xai = await resolveXaiCredentials();
      apiKey = xai.apiKey || process.env.XAI_API_KEY || apiKey;
    }
    const provider = createOpenAICompatibleProvider({
      baseUrl: key,
      apiKey,
      fetchImpl,
      providerName: name || key,
    });
    providerCache.set(key, provider);
    return provider;
  }

  async function getAccessible(provider) {
    const key = provider.baseUrl;
    if (accessibleCache.has(key)) return accessibleCache.get(key);
    try {
      const set = await provider.accessibleModels();
      accessibleCache.set(key, set);
      return set;
    } catch (error) {
      provider._discoveryError = String(error.message || error);
      accessibleCache.set(key, null);
      return null;
    }
  }

  const defaultBase = process.env.OPENAI_BASE_URL;
  if (!defaultBase && !process.env.PICSOU_ENDPOINT_GEMMA) {
    throw new Error(
      "OPENAI_BASE_URL or PICSOU_ENDPOINT_GEMMA required for live eval. Use --fixture offline.",
    );
  }

  return {
    providers: providerCache,
    resolveRunnable(candidates) {
      return (async () => {
        const runnable = [];
        const skipped = [];
        for (const model of candidates) {
          const apiId = candidateApiId(model);
          const baseUrl = endpointForModel(model);
          if (!baseUrl) {
            skipped.push({
              model: model.id,
              api_id: apiId,
              reason: "No endpoint env for this model (PICSOU_ENDPOINT_* / OPENAI_BASE_URL / XAI_BASE_URL).",
            });
            continue;
          }
          const provider = await getProvider(baseUrl, `sglang:${baseUrl}`);
          const accessible = await getAccessible(provider);
          if (!accessible) {
            skipped.push({
              model: model.id,
              api_id: apiId,
              reason: provider._discoveryError
                ? `Discovery failed on ${baseUrl}: ${provider._discoveryError}`
                : `No models on ${baseUrl}`,
            });
            continue;
          }
          const matched = matchAccessibleId(apiId, accessible);
          if (!matched) {
            skipped.push({
              model: model.id,
              api_id: apiId,
              reason: `Not accessible on ${baseUrl}.`,
              accessible: [...accessible].slice(0, 20),
            });
            continue;
          }
          runnable.push({
            ...model,
            resolved_id: matched,
            provider_name: provider.providerName,
            endpoint: baseUrl,
            _provider: provider,
          });
        }
        return { runnable, skipped };
      })();
    },
    async run(model, pack) {
      const provider =
        model._provider ||
        (await getProvider(endpointForModel(model), "live"));
      if (!provider) throw new Error(`No live provider for ${model.id}`);
      return provider.run(model, pack);
    },
  };
}
