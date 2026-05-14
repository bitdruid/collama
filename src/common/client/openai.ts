import OpenAI from "openai";

import { ToolCallAccumulator } from "../litellmfix";
import type { ChatResult, LlmChatSettings, LlmClient, LlmGenerateSettings } from "./types";
import {
    buildStopTokens,
    cleanupResult,
    handleError,
    logPerformance,
    logRequest,
    optionsToOpenAI,
    proxyFetch,
} from "./utils";

/** Creates an OpenAI SDK client for OpenAI-compatible endpoints. */
export function requestOpenAI(url: string, bearer?: string): OpenAI {
    const baseURL = url.endsWith("/v1") ? url : url + "/v1";
    return new OpenAI({
        apiKey: bearer ?? "",
        baseURL,
        fetch: proxyFetch as typeof fetch,
    });
}

/** Provider implementation for OpenAI-compatible chat and completion APIs. */
export class OpenAiClient implements LlmClient {
    /** Streams a chat response and accumulates incremental OpenAI tool-call deltas. */
    async chat(
        settings: LlmChatSettings,
        onChunk?: (chunk: string) => void,
        onReasoning?: (chunk: string) => void,
    ): Promise<ChatResult> {
        try {
            const { apiEndpoint, model, messages, tools = [], options, stop, signal } = settings;
            logRequest(apiEndpoint.url, model, options, stop, JSON.stringify(messages));

            const openai = requestOpenAI(apiEndpoint.url, apiEndpoint.bearer);
            const startTime = process.hrtime.bigint();
            const stream = await openai.chat.completions.create({
                model,
                messages,
                tools: tools.length > 0 ? tools : undefined,
                tool_choice: tools.length > 0 ? "auto" : undefined,
                stream: true,
                ...optionsToOpenAI(options),
                stop: buildStopTokens(stop),
                stream_options: { include_usage: true },
            });

            let result = "";
            let resultTokens = 0;
            const toolAccumulator = new ToolCallAccumulator();

            for await (const part of stream) {
                if (signal?.aborted) {
                    break;
                }

                const delta = part.choices[0]?.delta as
                    | (typeof part.choices[0]["delta"] & { reasoning?: string; reasoning_content?: string })
                    | undefined;
                const chunk = delta?.content;
                if (chunk) {
                    result += chunk;
                    onChunk?.(chunk);
                }

                const reasoning = delta?.reasoning_content ?? delta?.reasoning;
                if (reasoning) {
                    onReasoning?.(reasoning);
                }

                if (delta?.tool_calls) {
                    for (const tc of delta.tool_calls) {
                        toolAccumulator.push(tc);
                    }
                }

                if (part.usage) {
                    const endTime = process.hrtime.bigint();
                    resultTokens = part.usage.completion_tokens ?? 0;
                    const resultDurationNano = endTime - startTime;
                    logPerformance(options.num_predict, resultTokens, Number(resultDurationNano), result);
                }
            }

            return {
                content: cleanupResult(result, resultTokens, options),
                toolCalls: toolAccumulator.build(),
            };
        } catch (err) {
            return handleError(err);
        }
    }

    /** Generates a single prompt completion through the OpenAI completions endpoint. */
    async generate(settings: LlmGenerateSettings): Promise<string> {
        try {
            const { apiEndpoint, model, prompt, options, stop } = settings;
            logRequest(apiEndpoint.url, model, options, stop, prompt);

            const openai = requestOpenAI(apiEndpoint.url, apiEndpoint.bearer);
            const startTime = process.hrtime.bigint();
            const response = await openai.completions.create({
                model,
                prompt,
                stream: false,
                ...optionsToOpenAI(options),
                stop: buildStopTokens(stop),
            });
            const endTime = process.hrtime.bigint();

            const result = response.choices[0]?.text ?? "";
            const resultTokens = response.usage?.total_tokens ?? 0;
            const resultDurationNano = endTime - startTime;
            logPerformance(options.num_predict, resultTokens, Number(resultDurationNano), result);

            return cleanupResult(result, resultTokens, options);
        } catch (err) {
            return handleError(err);
        }
    }
}
