import { sysConfig, userConfig } from "../config";

/**
 * A contract for an LLM client.
 *
 * All providers must expose the same two methods:
 *
 *  • `chat` – multi‑turn chat (history + new user message).
 *  • `generate` – single‑turn generation (prompt → raw text).
 *
 * The methods return a `Promise<string>` containing the full assistant text.
 *
 * @remarks
 * The `LlmChatSettings` and `LlmGenerateSettings` types are defined in
 * `llmoptions.ts`.  They already contain everything the provider needs
 * (endpoint, model, options, stop tokens, etc.).
 **/
export interface LlmClient {
    /**
     * Sends a chat request to the underlying LLM.
     *
     * @param settings - Full chat request configuration.
     * @returns The assistant’s reply and any tool calls it made.
     */
    chat(settings: LlmChatSettings, onChunk?: (chunk: string) => void): Promise<ChatResult>;
    /**
     * Sends a generation request to the underlying LLM.
     *
     * @param settings - Full generation request configuration.
     * @returns The raw generated text.
     */
    generate(settings: LlmGenerateSettings): Promise<string>;
}

export interface ChatResult {
    content: string;
    thinking?: string;
    toolCalls: ToolCall[];
}

export interface ToolCall {
    id: string;
    type: "function";
    function: {
        name: string;
        arguments: string;
    };
}

/**
 * Configuration for a chat request to the LLM.
 *
 * @property {string} apiEndpoint - The base URL of the LLM API.
 * @property {string} model - Identifier of the LLM model to use.
 * @property {any[]} messages - The conversation history exchanged with the model.
 * @property {Options} options - Generation options forwarded to the LLM.
 * @property {Stop} stop - Stop token configuration for the request.
 */
export interface LlmChatSettings {
    apiEndpoint: {
        url: string;
        bearer: string;
    };
    model: string;
    messages: any[];
    tools?: any[]; // only set by the agent; omit for all other callers
    options: Options;
    stop: Stop;
}

/**
 * Configuration for a generation request to the LLM.
 *
 * @property {string} apiEndpoint - The base URL of the LLM API.
 * @property {string} model - Identifier of the LLM model to use.
 * @property {string} prompt - The text prompt from which the model should generate.
 * @property {Options} options - Generation options forwarded to the LLM.
 * @property {Stop} stop - Stop token configuration for the request.
 */
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
 * Generation options forwarded to Ollama.
 * All fields are optional and map directly to Ollama model parameters.
 * @property {number} [num_predict] - Number of tokens to predict.
 * @property {number} [num_ctx] - Context window size.
 * @property {number} [temperature] - Sampling temperature.
 * @property {number} [top_p] - Nucleus sampling probability.
 * @property {number} [top_k] - Top-K sampling limit.
 */
export interface Options {
    num_ctx: number;
    num_predict: number;
    temperature: number;
    top_k: number;
    top_p: number;
}

/**
 * Calculate the number of tokens to be predicted by the LLM based on the user's configuration.
 * @returns {number} The calculated token prediction count.
 */
function calculateNumPredict(): number {
    if (userConfig.suggestMode === "multiblock") {
        return sysConfig.tokensPredictCompletion;
    }
    if (userConfig.suggestMode === "multiline") {
        return sysConfig.tokensPredictCompletion / 2;
    }
    if (userConfig.suggestMode === "inline") {
        return sysConfig.tokensPredictCompletion / 4;
    }
    return sysConfig.tokensPredictCompletion;
}

/**
 * Stop token configuration.
 * @property {string[]} modelStop - Stop tokens defined by the model.
 * @property {string[]} userStop - Mode‑specific stop tokens set by the user.
 */
export interface Stop {
    modelStop: string[];
    userStop: string[];
}

/**
 * Empty stop configuration.
 * @returns {Stop} An object with empty stop token arrays.
 */
export function emptyStop(): Stop {
    return { modelStop: [], userStop: [] };
}

/**
 * Build stop tokens for completion based on suggest mode and model stops.
 * @param {string[]} modelStop - Stop tokens defined by the model.
 * @returns {Stop} The combined stop token configuration.
 */
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

/**
 * Build completion options for the active completion model.
 * @returns {Options} The completion options.
 */
export function buildCompletionOptions(): Options {
    return {
        num_predict: calculateNumPredict(),
        num_ctx: sysConfig.contextLenCompletion,
        temperature: 0.4,
        top_p: 0.8,
        top_k: 20,
    };
}

/**
 * Build instruction options for the active instruction model.
 * @returns {Options} The instruction options.
 */
export function buildInstructionOptions(): Options {
    return {
        num_predict: 16384,
        num_ctx: sysConfig.contextLenInstruct,
        temperature: 0.8,
        top_p: 0.95,
        top_k: 40,
    };
}

/**
 * Build commit options for commit message generation.
 * @returns {Options} The commit options.
 */
export function buildCommitOptions(): Options {
    return {
        num_predict: 16384,
        num_ctx: sysConfig.contextLenInstruct,
        temperature: 0.3,
        top_p: 0.95,
        top_k: 40,
    };
}

export function buildAgentOptions(): Options {
    return {
        num_predict: 16384,
        num_ctx: sysConfig.contextLenInstruct,
        temperature: 0.1,
        top_p: 0.9,
        top_k: 20,
    };
}
