import { Ollama } from "ollama";

import { nextToolId } from "../litellmfix";
import type { ChatResult, LlmChatSettings, LlmClient, LlmGenerateSettings, ToolCall } from "./types";
import { buildStopTokens, cleanupResult, handleError, logPerformance, logRequest, proxyFetch } from "./utils";

/** Creates an Ollama SDK client for the configured host and optional bearer token. */
export function requestOllama(url: string, bearer?: string): Ollama {
    return new Ollama({
        ...(bearer ? { headers: { Authorization: `Bearer ${bearer}` } } : {}),
        host: url,
        fetch: proxyFetch as typeof fetch,
    });
}

/**
 * Converts internal OpenAI-compatible tool call messages into Ollama's format.
 *
 * The rest of the extension stores tool arguments as JSON strings, but Ollama
 * expects plain objects in assistant tool call messages.
 */
function toOllamaMessages(messages: any[]): any[] {
    return messages.map((msg) => {
        if (msg.role === "assistant" && msg.tool_calls) {
            return {
                ...msg,
                tool_calls: msg.tool_calls.map((tc: ToolCall) => ({
                    ...tc,
                    function: {
                        ...tc.function,
                        arguments:
                            typeof tc.function.arguments === "string"
                                ? JSON.parse(tc.function.arguments)
                                : tc.function.arguments,
                    },
                })),
            };
        }
        return msg;
    });
}

/** Provider implementation for Ollama chat and prompt generation APIs. */
export class OllamaClient implements LlmClient {
    /** Streams a chat response and normalizes Ollama tool calls into the shared shape. */
    async chat(
        settings: LlmChatSettings,
        onChunk?: (chunk: string) => void,
        onReasoning?: (chunk: string) => void,
    ): Promise<ChatResult> {
        try {
            const { apiEndpoint, model, messages, tools = [], options, stop, signal } = settings;
            logRequest(apiEndpoint.url, model, options, stop, JSON.stringify(messages));

            const ollama = requestOllama(apiEndpoint.url, apiEndpoint.bearer);
            const stream = await ollama.chat({
                model,
                messages: toOllamaMessages(messages),
                ...(tools.length > 0 ? { tools } : {}),
                stream: true,
                options: { ...options, stop: buildStopTokens(stop) },
            });

            let result = "";
            let resultTokens = 0;
            const toolCalls: ToolCall[] = [];

            for await (const part of stream) {
                if (signal?.aborted) {
                    break;
                }

                const chunk = part.message.content ?? "";
                if (chunk) {
                    result += chunk;
                    onChunk?.(chunk);
                }

                const thinking = part.message.thinking ?? "";
                if (thinking) {
                    onReasoning?.(thinking);
                }

                if (part.message.tool_calls) {
                    for (const tc of part.message.tool_calls) {
                        toolCalls.push({
                            id: nextToolId(),
                            type: "function",
                            function: { name: tc.function.name, arguments: JSON.stringify(tc.function.arguments) },
                        });
                    }
                }
                if (part.done) {
                    resultTokens = part.prompt_eval_count ?? 0;
                    const resultDurationNano = part.eval_duration ?? 0;
                    logPerformance(options.num_predict, resultTokens, resultDurationNano, result);
                }
            }

            return { content: cleanupResult(result, resultTokens, options), toolCalls };
        } catch (err) {
            return handleError(err);
        }
    }

    /** Generates a single prompt completion through Ollama's generate endpoint. */
    async generate(settings: LlmGenerateSettings): Promise<string> {
        try {
            const { apiEndpoint, model, prompt, options, stop } = settings;
            logRequest(apiEndpoint.url, model, options, stop, prompt);

            const ollama = requestOllama(apiEndpoint.url, apiEndpoint.bearer);
            const response = await ollama.generate({
                model,
                prompt,
                raw: true,
                stream: false,
                options: { ...options, stop: buildStopTokens(stop) },
            });

            const result = response.response ?? "";
            const resultTokens = response.eval_count ?? 0;
            const resultDurationNano = response.eval_duration ?? 0;
            logPerformance(options.num_predict, resultTokens, resultDurationNano, result);

            return cleanupResult(result, resultTokens, options);
        } catch (err) {
            return handleError(err);
        }
    }
}
