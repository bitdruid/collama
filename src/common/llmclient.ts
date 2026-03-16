import * as vscode from "vscode";
import { ChatResult, LlmClient, Options, Stop, ToolCall } from "./llmoptions";

import { RequestType, sysConfig } from "../config";
import { logMsg } from "../logging";
import { ToolCallAccumulator, nextToolId } from "./litellmfix";
import { LlmChatSettings, LlmGenerateSettings } from "./llmoptions";
import { checkPredictFitsContextLength } from "./models";
import Tokenizer, { requestAnthropic, requestOllama, requestOpenAI } from "./utils-common";

/**
 * Factory that creates and delegates to the appropriate LLM client implementation
 * based on the configured backend. Supports Ollama and OpenAI-compatible endpoints.
 *
 * @implements {LlmClient}
 */
export class LlmClientFactory implements LlmClient {
    private factoryClient?: OllamaClient | OpenAiClient | AnthropicClient;
    private requestType: RequestType;

    constructor(requestType: RequestType) {
        this.requestType = requestType;

        if (requestType === "completion") {
            if (sysConfig.backendCompletion === "ollama") {
                this.factoryClient = new OllamaClient();
            } else if (sysConfig.backendCompletion === "openai") {
                this.factoryClient = new OpenAiClient();
            } else if (sysConfig.backendCompletion === "anthropic") {
                this.factoryClient = new AnthropicClient();
            }
        }
        if (requestType === "instruction") {
            if (sysConfig.backendInstruct === "ollama") {
                this.factoryClient = new OllamaClient();
            } else if (sysConfig.backendInstruct === "openai") {
                this.factoryClient = new OpenAiClient();
            } else if (sysConfig.backendInstruct === "anthropic") {
                this.factoryClient = new AnthropicClient();
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
 * Converts messages to the format expected by the Ollama API.
 * Our internal ToolCall stores `arguments` as a JSON string (OpenAI-compatible),
 * but Ollama requires `arguments` to be a plain object.
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

/**
 * Client implementation for interacting with the Ollama API.
 * Handles chat completions and prompt generation using the `requestOllama` utility.
 */
class OllamaClient implements LlmClient {
    /**
     * Streams a chat completion response from Ollama.
     *
     * @param settings - Configuration for the chat request (endpoint, model, messages, options).
     * @param onChunk - Optional callback invoked for each chunk of the streamed response.
     * @returns The accumulated full response string.
     */
    async chat(settings: LlmChatSettings, onChunk?: (chunk: string) => void): Promise<ChatResult> {
        try {
            const { apiEndpoint, model, messages, tools = [], options, stop, signal } = settings;
            logRequest(apiEndpoint.url, model, options, stop, JSON.stringify(messages));

            const ollama = requestOllama(apiEndpoint.url, apiEndpoint.bearer);
            const stream = await ollama.chat({
                model: model,
                messages: toOllamaMessages(messages),
                ...(tools.length > 0 ? { tools: tools } : {}),
                stream: true,
                options: { ...options, stop: buildStopTokens(stop) },
            });

            let result = "";
            let resultTokens = 0;
            const toolCalls: ToolCall[] = [];

            for await (const part of stream) {
                // break early on signal abort by agent
                if (signal?.aborted) {
                    break;
                }

                // main content arrives in separate deltas
                const chunk = part.message.content ?? "";
                if (chunk) {
                    result += chunk;
                    onChunk?.(chunk);
                }

                // tool calls arrive in separate deltas
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

    /**
     * Generates a completion for a single prompt using the Ollama API.
     * Performs cleanup on the result (e.g., removing code fences).
     *
     * @param settings - Configuration for the generation request (endpoint, model, prompt, options).
     * @returns The cleaned generated string.
     */
    async generate(settings: LlmGenerateSettings): Promise<string> {
        try {
            const { apiEndpoint, model, prompt, options, stop } = settings;
            logRequest(apiEndpoint.url, model, options, stop, prompt);

            const ollama = requestOllama(apiEndpoint.url, apiEndpoint.bearer);

            const response = await ollama.generate({
                model: model,
                prompt: prompt,
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

/**
 * Client implementation for interacting with OpenAI-compatible APIs.
 * Handles chat completions and prompt generation using the `requestOpenAI` utility.
 */
class OpenAiClient implements LlmClient {
    /**
     * Streams a chat completion response from an OpenAI-compatible endpoint.
     * Handles text streaming, tool call aggregation, and request abortion.
     *
     * @param settings - Configuration for the chat request (endpoint, model, messages, tools, options).
     * @param onChunk - Optional callback invoked for each text chunk of the streamed response.
     * @returns A ChatResult object containing the cleaned content and any aggregated tool calls.
     */
    async chat(settings: LlmChatSettings, onChunk?: (chunk: string) => void): Promise<ChatResult> {
        try {
            const { apiEndpoint, model, messages, tools = [], options, stop, signal } = settings;
            logRequest(apiEndpoint.url, model, options, stop, JSON.stringify(messages));

            const openai = requestOpenAI(apiEndpoint.url, apiEndpoint.bearer);

            const startTime = process.hrtime.bigint();
            const stream = await openai.chat.completions.create({
                model: model,
                messages: messages,
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

                const delta = part.choices[0]?.delta;

                // text
                const chunk = delta?.content;
                if (chunk) {
                    result += chunk;
                    onChunk?.(chunk);
                }

                // tool calls
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
            logRequest(apiEndpoint.url, model, options, stop, prompt);

            const openai = requestOpenAI(apiEndpoint.url, apiEndpoint.bearer);

            const startTime = process.hrtime.bigint();
            const response = await openai.completions.create({
                model: model,
                prompt: prompt,
                //raw: raw, - not supported by openai
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
/**
 * Converts internal OpenAI-compatible messages to the format expected by the Anthropic API.
 * - System messages are excluded here (extracted separately as the `system` param).
 * - Assistant messages with tool_calls become content blocks.
 * - Tool result messages (role: "tool") become user messages with tool_result content blocks,
 *   merged with adjacent tool results into a single user turn.
 */
function toAnthropicMessages(messages: any[]): any[] {
    const result: any[] = [];
    for (const msg of messages) {
        if (msg.role === "assistant") {
            const content: any[] = [];
            if (msg.content) {
                content.push({ type: "text", text: msg.content });
            }
            if (msg.tool_calls) {
                for (const tc of msg.tool_calls as ToolCall[]) {
                    content.push({
                        type: "tool_use",
                        id: tc.id,
                        name: tc.function.name,
                        input:
                            typeof tc.function.arguments === "string"
                                ? JSON.parse(tc.function.arguments)
                                : tc.function.arguments,
                    });
                }
            }
            result.push({ role: "assistant", content });
        } else if (msg.role === "tool") {
            // Merge consecutive tool results into a single user turn
            const toolResultBlock = { type: "tool_result", tool_use_id: msg.tool_call_id, content: msg.content };
            const prev = result[result.length - 1];
            if (prev && prev.role === "user" && Array.isArray(prev.content)) {
                prev.content.push(toolResultBlock);
            } else {
                result.push({ role: "user", content: [toolResultBlock] });
            }
        } else {
            result.push({ role: msg.role, content: msg.content });
        }
    }
    return result;
}

/**
 * Converts internal OpenAI-style tool definitions to the format expected by the Anthropic API.
 */
function toAnthropicTools(tools: any[]): any[] {
    return tools.map((t) => ({
        name: t.function.name,
        description: t.function.description ?? "",
        input_schema: t.function.parameters ?? { type: "object", properties: {} },
    }));
}

/**
 * Client implementation for interacting with the Anthropic API (Claude models).
 * Handles chat completions and prompt generation using the `requestAnthropic` utility.
 */
class AnthropicClient implements LlmClient {
    async chat(settings: LlmChatSettings, onChunk?: (chunk: string) => void): Promise<ChatResult> {
        try {
            const { apiEndpoint, model, messages, tools = [], options, stop, signal } = settings;
            logRequest(apiEndpoint.url, model, options, stop, JSON.stringify(messages));

            const anthropic = requestAnthropic(apiEndpoint.url, apiEndpoint.bearer);

            const systemMsg = messages.find((m) => m.role === "system");
            const anthropicMessages = toAnthropicMessages(messages.filter((m) => m.role !== "system"));
            const anthropicTools = toAnthropicTools(tools);
            const stopSequences = buildStopTokens(stop);

            const startTime = process.hrtime.bigint();
            const stream = anthropic.messages.stream({
                model,
                max_tokens: options.num_predict,
                ...(systemMsg ? { system: systemMsg.content } : {}),
                messages: anthropicMessages,
                ...(anthropicTools.length > 0 ? { tools: anthropicTools } : {}),
                ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
                ...(stopSequences.length > 0 ? { stop_sequences: stopSequences } : {}),
            });

            let result = "";
            let resultTokens = 0;
            const toolUseBlocks = new Map<number, { id: string; name: string; inputStr: string }>();

            for await (const event of stream) {
                if (signal?.aborted) {
                    break;
                }
                if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
                    toolUseBlocks.set(event.index, {
                        id: event.content_block.id,
                        name: event.content_block.name,
                        inputStr: "",
                    });
                }
                if (event.type === "content_block_delta") {
                    if (event.delta.type === "text_delta") {
                        result += event.delta.text;
                        onChunk?.(event.delta.text);
                    } else if (event.delta.type === "input_json_delta") {
                        const block = toolUseBlocks.get(event.index);
                        if (block) {
                            block.inputStr += event.delta.partial_json;
                        }
                    }
                }
                if (event.type === "message_delta" && event.usage) {
                    const endTime = process.hrtime.bigint();
                    resultTokens = event.usage.output_tokens ?? 0;
                    logPerformance(options.num_predict, resultTokens, Number(endTime - startTime), result);
                }
            }

            const toolCalls: ToolCall[] = Array.from(toolUseBlocks.values()).map((b) => ({
                id: nextToolId(),
                type: "function",
                function: { name: b.name, arguments: b.inputStr || "{}" },
            }));

            return { content: cleanupResult(result, resultTokens, options), toolCalls };
        } catch (err) {
            return handleError(err);
        }
    }

    async generate(settings: LlmGenerateSettings): Promise<string> {
        try {
            const { apiEndpoint, model, prompt, options, stop } = settings;
            logRequest(apiEndpoint.url, model, options, stop, prompt);

            const anthropic = requestAnthropic(apiEndpoint.url, apiEndpoint.bearer);
            const stopSequences = buildStopTokens(stop);

            const startTime = process.hrtime.bigint();
            const response = await anthropic.messages.create({
                model,
                max_tokens: options.num_predict,
                messages: [{ role: "user", content: prompt }],
                ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
                ...(stopSequences.length > 0 ? { stop_sequences: stopSequences } : {}),
                stream: false,
            });
            const endTime = process.hrtime.bigint();

            const result = response.content.find((b) => b.type === "text")?.text ?? "";
            const resultTokens = response.usage.output_tokens ?? 0;
            logPerformance(options.num_predict, resultTokens, Number(endTime - startTime), result);

            return cleanupResult(result, resultTokens, options);
        } catch (err) {
            return handleError(err);
        }
    }
}

// Shared logging

function logRequest(url: string, model: string, options: Options, stop: Stop, input: string): void {
    logMsg(`Requesting to ${url}; Model: ${model};`);
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

// chat how it should be without duplicate args issue 20480 litellm
// async chat(settings: LlmChatSettings, onChunk?: (chunk: string) => void): Promise<ChatResult> {
//     try {
//         const { apiEndpoint, model, messages, tools = [], options, stop, signal } = settings;
//         logRequest(apiEndpoint.url, model, options, stop, JSON.stringify(messages));

//         const openai = requestOpenAI(apiEndpoint.url, apiEndpoint.bearer);

//         const startTime = process.hrtime.bigint();
//         const stream = await openai.chat.completions.create({
//             model: model,
//             messages: messages,
//             tools: tools.length > 0 ? tools : undefined,
//             tool_choice: tools.length > 0 ? "auto" : undefined,
//             stream: true,
//             ...optionsToOpenAI(options),
//             stop: buildStopTokens(stop),
//             stream_options: { include_usage: true },
//         });

//         let result = "";
//         let resultTokens = 0;

//         // map for tool call
//         const deltaToolCalls: Map<
//             number,
//             {
//                 id: string;
//                 name: string;
//                 argumentsStr: string;
//             }
//         > = new Map();

//         for await (const part of stream) {
//             if (signal?.aborted) {
//                 break;
//             }

//             const delta = part.choices[0]?.delta;

//             // text
//             const chunk = delta?.content;
//             if (chunk) {
//                 result += chunk;
//                 onChunk?.(chunk);
//             }

//             // tool call
//             if (delta?.tool_calls) {
//                 for (const tc of delta.tool_calls) {
//                     const idx = tc.index ?? 0;

//                     if (!deltaToolCalls.has(idx)) {
//                         deltaToolCalls.set(idx, {
//                             id: tc.id ?? "",
//                             name: tc.function?.name ?? "",
//                             argumentsStr: tc.function?.arguments ?? "",
//                         });
//                     } else {
//                         const existing = deltaToolCalls.get(idx)!;
//                         if (tc.id) {
//                             existing.id = tc.id;
//                         }
//                         if (tc.function?.name) {
//                             existing.name += tc.function.name;
//                         }
//                         if (tc.function?.arguments) {
//                             existing.argumentsStr += tc.function.arguments;
//                         }
//                     }
//                 }
//             }

//             if (part.usage) {
//                 const endTime = process.hrtime.bigint();
//                 resultTokens = part.usage.completion_tokens ?? 0;
//                 const resultDurationNano = endTime - startTime;
//                 logPerformance(options.num_predict, resultTokens, Number(resultDurationNano), result);
//             }
//         }

//         const toolCalls: ToolCall[] = Array.from(deltaToolCalls.values()).map((tc) => ({
//             id: tc.id || `call_${crypto.randomUUID()}`,
//             type: "function",
//             function: { name: tc.name, arguments: tc.argumentsStr || "{}" },
//         }));

//         return { content: cleanupResult(result, resultTokens, options), toolCalls };
//     } catch (err) {
//         return handleError(err);
//     }
// }
