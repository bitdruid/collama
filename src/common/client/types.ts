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

/** Provider-neutral generation options used by the client implementations. */
export interface Options {
    num_ctx: number;
    num_predict: number;
    temperature: number;
    top_k: number;
    top_p: number;
    repeat_penalty?: number;
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
        num_predict: calculateNumPredict(),
        num_ctx: userConfig.apiTokenContextLenCompletion,
        temperature: 0.4,
        top_p: 0.8,
        top_k: 20,
    };
}

/** Builds generation options for chat/edit instruction requests. */
export function buildInstructionOptions(): Options {
    return {
        num_predict: userConfig.apiTokenPredictInstruct,
        num_ctx: userConfig.apiTokenContextLenInstruct,
        temperature: 0.8,
        top_p: 0.95,
        top_k: 40,
    };
}

/** Builds generation options tuned for concise commit message generation. */
export function buildCommitOptions(): Options {
    return {
        num_predict: userConfig.apiTokenPredictInstruct,
        num_ctx: userConfig.apiTokenContextLenInstruct,
        temperature: 0.3,
        top_p: 0.95,
        top_k: 40,
    };
}

/** Builds generation options for multi-step agent conversations with tool use. */
export function buildAgentOptions(): Options {
    return {
        num_predict: userConfig.apiTokenPredictInstruct,
        num_ctx: userConfig.apiTokenContextLenInstruct,
        temperature: 0.1,
        top_p: 0.5,
        top_k: 40,
        repeat_penalty: 1.1,
    };
}
