import { userConfig } from "../../config";

/** Identifies which configured endpoint/model pair should handle a request. */
export type RequestType = "completion" | "instruction";

/** Runtime backend detected for an endpoint. Empty means no supported backend is available yet. */
export type LlmBackendType = "ollama" | "openai" | "";

/** Contract for clients that support single-prompt generation (autocomplete). */
export interface LlmGenerateClient {
    generate(settings: LlmGenerateSettings): Promise<string>;
}

/** Common contract implemented by chat-capable LLM clients. */
export interface LlmClient extends LlmGenerateClient {
    chat(
        settings: LlmChatSettings,
        onChunk?: (chunk: string) => void,
        onReasoning?: (chunk: string) => void,
    ): Promise<ChatResult>;
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
    /** Per-request Ollama context window size; sourced from apiTokenContextLenCompletion. */
    num_ctx: number;
    stop: Stop;
}

/** Generation options in OpenAI-compatible naming; passed verbatim to /v1 chat. */
export interface Options {
    max_tokens: number;
    temperature: number;
    top_k: number;
    top_p: number;
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
        temperature: 0.4,
        top_p: 0.8,
        top_k: 20,
    };
}

/** Builds generation options for chat/edit instruction requests. */
export function buildInstructionOptions(): Options {
    return {
        max_tokens: userConfig.apiTokenPredictInstruct,
        temperature: 0.8,
        top_p: 0.95,
        top_k: 40,
    };
}

/** Builds generation options tuned for concise commit message generation. */
export function buildCommitOptions(): Options {
    return {
        max_tokens: userConfig.apiTokenPredictInstruct,
        temperature: 0.3,
        top_p: 0.95,
        top_k: 40,
    };
}

/** Builds generation options for multi-step agent conversations with tool use. */
export function buildAgentOptions(): Options {
    return {
        max_tokens: userConfig.apiTokenPredictInstruct,
        temperature: 0.1,
        top_p: 0.5,
        top_k: 40,
    };
}
