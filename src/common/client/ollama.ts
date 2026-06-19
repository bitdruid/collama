import { Ollama } from "ollama";

import type { LlmGenerateSettings } from "./types";
import {
    buildStopTokens,
    cleanupResult,
    handleError,
    logRequest,
    optionsToOllama,
    proxyFetch,
    summupPerformance,
} from "./utils";

/** Creates an Ollama SDK client for the configured host and optional bearer token. */
export function requestOllama(url: string, bearer?: string): Ollama {
    return new Ollama({
        ...(bearer ? { headers: { Authorization: `Bearer ${bearer}` } } : {}),
        host: url,
        fetch: proxyFetch as typeof fetch,
    });
}

/**
 * Provider implementation for Ollama prompt generation.
 *
 * Only the completion (autocomplete) path lives here: it relies on Ollama's
 * `raw: true` to bypass the model template for FIM prompts, which the
 * OpenAI-compatible `/v1/completions` endpoint cannot express. Ollama chat goes
 * through OpenAiClient against the `/v1` endpoint.
 */
export class OllamaClient {
    /** Generates a single prompt completion through Ollama's generate endpoint. */
    async generate(settings: LlmGenerateSettings): Promise<string> {
        try {
            const { apiEndpoint, model, prompt, options, stop } = settings;
            logRequest(apiEndpoint.url, model, options, stop, prompt);

            const ollama = requestOllama(apiEndpoint.url, apiEndpoint.bearer);
            const startTime = process.hrtime.bigint();
            const response = await ollama.generate({
                model,
                prompt,
                raw: true,
                stream: false,
                options: { ...optionsToOllama(options), stop: buildStopTokens(stop) },
            });

            const result = response.response ?? "";
            const resultTokens = response.eval_count ?? 0;
            summupPerformance(options, startTime, resultTokens, result);

            return cleanupResult(result, resultTokens, options);
        } catch (err) {
            return handleError(err);
        }
    }
}
