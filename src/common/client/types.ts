import { userConfig } from "../../config";

/** Identifies which configured endpoint/model pair should handle a request. */
export type RequestType = "completion" | "instruction";

/** Runtime backend detected for an endpoint. Empty means no supported backend is available yet. */
export type LlmBackendType = "ollama" | "openai" | "";

/** Common contract implemented by every provider-specific LLM client. */
export interface LlmClient {
    chat(
        settings: LlmChatSettings,
        onChunk?: (chunk: string) => void,
        onReasoning?: (chunk: string) => void,
    ): Promise<ChatResult>;
    generate(settings: LlmGenerateSettings): Promise<string>;
}

/** Normalized response returned from chat-style APIs. */
export interface ChatResult {
    content: string;
    toolCalls: ToolCall[];
}

/** OpenAI-compatible internal representation of a function tool call. */
export interface ToolCall {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
}

/** Complete request payload for chat-style model calls. */
export interface LlmChatSettings {
    apiEndpoint: {
        url: string;
        bearer: string;
    };
    model: string;
    messages: any[];
    tools?: any[];
    options: Options;
    stop: Stop;
    signal?: AbortSignal;
}

/** Complete request payload for single-prompt generation calls. */
export interface LlmGenerateSettings {
    apiEndpoint: {
        url: string;
        bearer: string;
    };
    model: string;
    prompt: string;
    options: Options;
    stop: Stop;
}

/**
 * Generation options in OpenAI shape, the extension's primary backend.
 *
 * Field names mirror the OpenAI request body so the common path needs no
 * renaming; the Ollama completion path converts via `optionsToOllama`. `num_ctx`
 * is the exception: OpenAI has no per-request context field, so it is never sent
 * to OpenAI — it is used only for the local prompt-fit check and Ollama's options.
 */
export interface Options {
    max_tokens: number;
    temperature: number;
    top_p?: number;
    num_ctx: number;
}

/** Stop token groups coming from model metadata and user/UI mode behavior. */
export interface Stop {
    modelStop: string[];
    userStop: string[];
}

/** Calculates completion token budget from the active suggestion mode. */
function calculateNumPredict(): number {
    if (userConfig.suggestMode === "multiblock") {
        return userConfig.apiTokenPredictCompletion;
    }
    if (userConfig.suggestMode === "multiline") {
        return userConfig.apiTokenPredictCompletion / 2;
    }
    if (userConfig.suggestMode === "inline") {
        return userConfig.apiTokenPredictCompletion / 4;
    }
    return userConfig.apiTokenPredictCompletion;
}

/** Returns an empty stop configuration for requests without explicit stop tokens. */
export function emptyStop(): Stop {
    return { modelStop: [], userStop: [] };
}

/** Builds completion stop tokens from the current suggestion mode and model defaults. */
export function buildCompletionStop(modelStop: string[]): Stop {
    return {
        userStop: [
            ...(userConfig.suggestMode === "inline" ? ["\n", "\r\n"] : []),
            ...(userConfig.suggestMode === "multiline" ? ["\n\n", "\r\n\r\n"] : []),
            ...(userConfig.suggestMode === "multiblock" ? [] : []),
        ],
        modelStop,
    };
}

/** Builds generation options for autocomplete requests. */
export function buildCompletionOptions(): Options {
    return {
        max_tokens: calculateNumPredict(),
        num_ctx: userConfig.apiTokenContextLenCompletion,
        temperature: 0.4,
        top_p: 0.9,
    };
}

/** Builds generation options for chat/edit instruction requests. */
export function buildInstructionOptions(): Options {
    return {
        max_tokens: userConfig.apiTokenPredictInstruct,
        num_ctx: userConfig.apiTokenContextLenInstruct,
        temperature: 0.8,
        top_p: 0.95,
    };
}

/** Builds generation options tuned for concise commit message generation. */
export function buildCommitOptions(): Options {
    return {
        max_tokens: userConfig.apiTokenPredictInstruct,
        num_ctx: userConfig.apiTokenContextLenInstruct,
        temperature: 0.3,
        top_p: 0.95,
    };
}

/** Builds generation options for multi-step agent conversations with tool use. */
export function buildAgentOptions(): Options {
    return {
        max_tokens: userConfig.apiTokenPredictInstruct,
        num_ctx: userConfig.apiTokenContextLenInstruct,
        temperature: userConfig.liteMode ? 0.6 : 0.2,
        top_p: 0.9,
    };
}
