import * as vscode from "vscode";
import { ChatResult, LlmClient, Options, Stop, ToolCall } from "./llmoptions";

import { RequestType, sysConfig } from "../config";
import { logMsg } from "../logging";
import { LlmChatSettings, LlmGenerateSettings } from "./llmoptions";
import { checkPredictFitsContextLength } from "./models";
import Tokenizer, { requestOpenAI } from "./utils";

/**
 * Factory that creates and delegates to the appropriate LLM client implementation
 * based on the configured backend. All backends use the OpenAI-compatible protocol
 * (Ollama is accessed via its /v1 endpoint).
 *
 * @implements {LlmClient}
 */
export class LlmClientFactory implements LlmClient {
    private factoryClient?: OpenAiClient;

    constructor(requestType: RequestType) {
        if (requestType === "completion") {
            if (sysConfig.backendCompletion === "ollama" || sysConfig.backendCompletion === "openai") {
                this.factoryClient = new OpenAiClient();
            }
        }
        if (requestType === "instruction") {
            if (sysConfig.backendInstruct === "ollama" || sysConfig.backendInstruct === "openai") {
                this.factoryClient = new OpenAiClient();
            }
        }
    }

    async chat(settings: LlmChatSettings, onChunk?: (chunk: string) => void): Promise<ChatResult> {
        if (!this.factoryClient) {
            throw new Error("LLM client not initialized");
        }
        return this.factoryClient.chat(settings, onChunk);
    }

    async generate(settings: LlmGenerateSettings): Promise<string> {
        if (!this.factoryClient) {
            throw new Error("LLM client not initialized");
        }

        const promptTokens = await Tokenizer.calcTokens(settings.prompt);
        if (!checkPredictFitsContextLength(settings.options.num_predict, promptTokens, settings.options.num_ctx)) {
            vscode.window.showErrorMessage(
                `Prompt (${promptTokens} tokens) exceeds available context window (${settings.options.num_ctx} tokens). Please reduce content.`,
            );
            return "";
        }

        return this.factoryClient.generate(settings);
    }
}

/**
 * Cleans up the raw LLM output by handling token limits, removing surrounding
 * code fences, and stripping out reasoning/thinking blocks.
 */
function cleanupResult(result: string, resultTokens: number, options: Options): string {
    // Cut the last output line if max tokens reached (last line will mostly be incomplete)
    if (resultTokens === options.num_predict && result.includes("\n")) {
        logMsg(`Output reached token limit - cutting last line (probably incomplete)`);
        result = result.split("\n").slice(0, -1).join("\n");
    }

    // Strip surrounding code fences if present (greedy match to capture outermost fences)
    const fenceMatch = result.match(/```(?:[a-zA-Z0-9_-]+)?\s*\n([\s\S]*)```\s*$/);
    if (fenceMatch) {
        result = fenceMatch[1].replace(/\n$/, ""); // remove trailing newline if present
    } else // trim the code fences from the result (llm will add them in most cases)
    {
        result = result
            .replace(/^```[a-zA-Z0-9_-]*\s*\n?/, "") // remove opening fence + optional lang + newline
            .replace(/\n?```$/, "");
    } // remove closing fence (optionally preceded by newline)

    return result.trim();
}

/**
 * Transforms generic LLM options into the format expected by the OpenAI client.
 */
function optionsToOpenAI(options: Options): Record<string, any> {
    const optionsOpenAI: Record<string, any> = {};
    if (options.num_ctx !== undefined) {
        optionsOpenAI.max_context_length = options.num_ctx;
    }
    if (options.num_predict !== undefined) {
        optionsOpenAI.max_tokens = options.num_predict;
    }
    if (options.temperature !== undefined) {
        optionsOpenAI.temperature = options.temperature;
    }
    if (options.top_p !== undefined) {
        optionsOpenAI.top_p = options.top_p;
    }
    if (options.top_k !== undefined) {
        optionsOpenAI.top_k = options.top_k;
    }
    return optionsOpenAI;
}

/**
 * Client implementation for interacting with OpenAI-compatible APIs.
 * Handles chat completions and prompt generation using the `requestOpenAI` utility.
 */
class OpenAiClient implements LlmClient {
    /**
     * Streams a chat completion response from an OpenAI-compatible endpoint.
     *
     * @param settings - Configuration for the chat request (endpoint, model, messages, options).
     * @param onChunk - Optional callback invoked for each chunk of the streamed response.
     * @returns The accumulated full response string.
     */
    async chat(settings: LlmChatSettings, onChunk?: (chunk: string) => void): Promise<ChatResult> {
        try {
            const { apiEndpoint, model, messages, tools = [], think, options, stop } = settings;
            logRequest(apiEndpoint.url, model, think, options, stop, JSON.stringify(messages));

            const openai = requestOpenAI(apiEndpoint.url, apiEndpoint.bearer);

            const startTime = process.hrtime.bigint();
            const stream = await openai.chat.completions.create({
                model: model,
                messages: messages,
                tools: tools,
                stream: true,
                ...optionsToOpenAI(options),
                stop: buildStopTokens(stop),
                stream_options: { include_usage: true },
            });

            let result = "";
            let thinking = "";
            let resultTokens = 0;

            const deltaToolCall: Record<number, { id: string; name: string; argumentsStr: string }> = {};

            for await (const part of stream) {
                const delta = part.choices[0]?.delta;
                const chunk = delta?.content;
                const reasoning: string | undefined = (delta as any)?.reasoning;

                if (chunk) {
                    result += chunk;
                    onChunk?.(chunk);
                }
                if (reasoning) {
                    thinking += reasoning;
                }
                // tool call id + name + arguments arrive in separate deltas
                if (delta?.tool_calls) {
                    for (const tc of delta.tool_calls) {
                        if (!deltaToolCall[tc.index]) {
                            deltaToolCall[tc.index] = { id: "", name: "", argumentsStr: "" };
                        }
                        // some provider: final summary delta with id/name
                        // set to null and the complete arguments — replace, don't append.
                        if (tc.id === null) {
                            if (tc.function?.arguments) {
                                deltaToolCall[tc.index].argumentsStr = tc.function.arguments;
                            }
                            continue;
                        }
                        if (tc.id) {
                            deltaToolCall[tc.index].id = tc.id;
                        }
                        if (tc.function?.name) {
                            deltaToolCall[tc.index].name += tc.function.name;
                        }
                        if (tc.function?.arguments) {
                            deltaToolCall[tc.index].argumentsStr += tc.function.arguments;
                        }
                    }
                }
                if (part.usage) {
                    const endTime = process.hrtime.bigint();
                    resultTokens = part.usage.completion_tokens ?? 0;
                    const resultDurationNano = endTime - startTime;
                    logPerformance(options.num_predict, resultTokens, Number(resultDurationNano), result);
                }
            }

            const toolCalls: ToolCall[] = Object.values(deltaToolCall).map((tc) => ({
                id: tc.id,
                type: "function",
                function: { name: tc.name, arguments: tc.argumentsStr || "{}" },
            }));

            return { content: cleanupResult(result, resultTokens, options), thinking, toolCalls };
        } catch (err) {
            return handleError(err);
        }
    }

    /**
     * Generates a completion for a single prompt using an OpenAI-compatible endpoint.
     * Performs cleanup on the result (e.g., removing code fences).
     *
     * @param settings - Configuration for the generation request (endpoint, model, prompt, options).
     * @returns The cleaned generated string.
     */
    async generate(settings: LlmGenerateSettings): Promise<string> {
        try {
            const { apiEndpoint, model, prompt, options, stop } = settings;
            logRequest(apiEndpoint.url, model, false, options, stop, prompt);

            const openai = requestOpenAI(apiEndpoint.url, apiEndpoint.bearer);

            const startTime = process.hrtime.bigint();
            const response = await openai.completions.create({
                model: model,
                prompt: prompt,
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
// Shared logging

function logRequest(url: string, model: string, think: boolean, options: Options, stop: Stop, input: string): void {
    logMsg(`Requesting to ${url}; Model: ${model}; Think: ${think};`);
    logMsg(`Options:\n${JSON.stringify(options, null, 2)}`);
    logMsg(`Stop:\n${JSON.stringify([...stop.userStop, ...stop.modelStop], null, 2)}`);
    logMsg(`Input:\n${input}`);
}

function logPerformance(tokenLimit: number, resultTokens: number, resultDurationNano: number, result: string): void {
    const resultDuration = (resultDurationNano / 1_000_000_000).toFixed(3);
    const resultTPS = resultDurationNano > 0 ? (resultTokens / (resultDurationNano / 1_000_000_000)).toFixed(1) : "0";
    logMsg(`Output:\n${result}`);
    logMsg(`Receive: tokens [${resultTokens}]; duration seconds [${resultDuration}]; tokens/sec [${resultTPS}]`);
    if (tokenLimit === resultTokens) {
        const msg = "WARNING: Output token limit reached - Reduce input?";
        logMsg(msg);
        vscode.window.showWarningMessage(msg);
    }
}

function handleError(err: unknown): never {
    if (err instanceof Error) {
        logMsg("Full error: " + JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    }
    throw err;
}

function buildStopTokens(stop: Stop): string[] {
    return [...stop.userStop, ...stop.modelStop];
}
