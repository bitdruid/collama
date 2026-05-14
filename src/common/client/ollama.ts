import { Ollama } from "ollama";

import type { LlmGenerateClient, LlmGenerateSettings } from "./types";
import { buildStopTokens, cleanupResult, handleError, logPerformance, logRequest, proxyFetch } from "./utils";

/** Creates an Ollama SDK client for the configured host and optional bearer token. */
export function requestOllama(url: string, bearer?: string): Ollama {
    return new Ollama({
        ...(bearer ? { headers: { Authorization: `Bearer ${bearer}` } } : {}),
        host: url,
        fetch: proxyFetch as typeof fetch,
    });
}

/** Provider implementation for Ollama's prompt generation API (used for autocomplete). */
export class OllamaClient implements LlmGenerateClient {
    /** Generates a single prompt completion through Ollama's generate endpoint. */
    async generate(settings: LlmGenerateSettings): Promise<string> {
        try {
            const { apiEndpoint, model, prompt, options, num_ctx, stop } = settings;
            logRequest(apiEndpoint.url, model, options, stop, prompt);

            const ollama = requestOllama(apiEndpoint.url, apiEndpoint.bearer);
            const response = await ollama.generate({
                model,
                prompt,
                raw: true,
                stream: false,
                options: {
                    num_predict: options.max_tokens,
                    temperature: options.temperature,
                    top_p: options.top_p,
                    top_k: options.top_k,
                    num_ctx,
                    stop: buildStopTokens(stop),
                },
            });

            const result = response.response ?? "";
            const resultTokens = response.eval_count ?? 0;
            const resultDurationNano = response.eval_duration ?? 0;
            logPerformance(options.max_tokens, resultTokens, resultDurationNano, result);

            return cleanupResult(result, resultTokens, options);
        } catch (err) {
            return handleError(err);
        }
    }
}
