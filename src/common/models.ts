import { Ollama } from "ollama";

import { userConfig } from "../config";
import { logMsg } from "../logging";
import { Context, OpenFilesContext } from "./context_editor";

/**
 * Configuration for a supported model, including its name patterns,
 * prompt template function, and stop tokens.
 */
export interface ModelConfig {
    /** List of case‑insensitive substrings that identify the model. */
    modelpattern: string[];
    /**
     * Function that builds the prompt string from the open files, the
     * current prefix and suffix.
     *
     * @param openFiles - Array of open files with path and content.
     * @param prefix - The text preceding the cursor.
     * @param suffix - The text following the cursor.
     * @returns The prompt string for the model.
     */
    prompt: (openFiles: OpenFilesContext[], prefix: string, suffix: string) => string;
    /** Array of tokens that signal the model to stop generating. */
    stop: string[];
}

/** List of supported model configurations. */
export const modelConfigs: ModelConfig[] = [
    {
        modelpattern: ["codeqwen", "qwen2.5-coder", "qwen3-coder"],
        prompt: (openFiles, prefix, suffix) =>
            `${openFiles
                .map((e) => `<|file_sep|>${e.path}\n${e.content}`)
                .join("")}<|file_sep|><|fim_prefix|>${prefix}<|fim_suffix|>${suffix}<|fim_middle|>`,
        stop: [
            "<|fim_prefix|>",
            "<|fim_suffix|>",
            "<|fim_middle|>",
            "<|file_sep|>",
            "<|cursor|>",
            "<|endoftext|>",
            "<|repo_name|>",
        ],
    },
    {
        modelpattern: ["starcoder:", "starcoder2:"],
        prompt: (openFiles, prefix, suffix) =>
            `${openFiles
                .map((e) => `<file_sep>${e.path}\n${e.content}`)
                .join("")}<file_sep><fim_prefix>${prefix}<fim_suffix>${suffix}<fim_middle>`,
        stop: ["<fim_prefix>", "<fim_suffix>", "<fim_middle>", "<file_sep>"],
    },
    {
        modelpattern: ["codellama:7b", "codellama:13b"],
        prompt: (_openFiles, prefix, suffix) => `<PRE> ${prefix} <SUF> ${suffix} <MID>`,
        stop: ["<PRE>", "<SUF>", "<MID>", "<CODE>", "<END>", "<EOT", "<EOD>"],
    },
];

/**
 * Returns all user‑friendly names of supported models (i.e. all patterns).
 *
 * @returns Array of model pattern strings.
 */
export const getSupportedModels = (): string[] => modelConfigs.flatMap((c) => c.modelpattern);

/**
 * Normalizes a model name for comparison by ensuring consistent format.
 * Strips `:latest` suffix if present and converts to lowercase.
 *
 * @param name - The model name to normalize.
 * @returns Normalized model name.
 */
export function normalizeModelName(name: string): string {
    let normalized = name.toLowerCase();
    if (normalized.endsWith(":latest")) {
        normalized = normalized.slice(0, -7);
    }
    return normalized;
}

/**
 * Retrieves a list of all models available on the Ollama server.
 *
 * @returns An array of model names, or an empty array if an error occurs.
 * @throws Will not throw; network errors are handled internally by displaying a connection error.
 */
export async function getAvailableModels(): Promise<string[]> {
    const ollama = new Ollama({ host: userConfig.apiEndpointCompletion });

    try {
        const response = await ollama.list();
        const modelNames = response.models.map((m: { name: string }) => m.name);
        return modelNames;
    } catch (error: unknown) {
        logMsg(`Error retrieving available models: ${(error as Error).message}`);
        return [];
    }
}

/**
 * Checks if two model names match (accounting for `:latest` suffix differences).
 *
 * @param name1 - First model name.
 * @param name2 - Second model name.
 * @returns `true` if the normalized names are identical, otherwise `false`.
 */
export function modelsMatch(name1: string, name2: string): boolean {
    return normalizeModelName(name1) === normalizeModelName(name2);
}

/**
 * Finds the configuration whose `modelpattern` matches the provided
 * `apiModelCompletion` string.
 *
 * @param apiModelCompletion - The name of the model to look up.
 * @returns The matching {@link ModelConfig} or `undefined` if none found.
 */
const findModelConfig = (apiModelCompletion: string): ModelConfig | undefined => {
    const lower = apiModelCompletion.toLowerCase();
    return modelConfigs.find((cfg) => cfg.modelpattern.some((p) => lower.includes(p)));
};

/**
 * Convenience wrapper that returns the prompt and stop tokens
 * for the current `apiModelCompletion`.  Used by the request handler.
 *
 * @param context - Current editor context containing open files,
 *                  active prefix and suffix.
 * @returns An object with `prompt` and `stop` properties or `false`
 *          if no matching model configuration is found.
 */
export const getCompletionModelConfig = (context: Context): { prompt: string; stop: string[] } | false => {
    const cfg = findModelConfig(userConfig.apiModelCompletion);
    if (!cfg) {
        return false;
    }

    return { prompt: cfg.prompt(context.openFiles, context.activePrefix, context.activeSuffix), stop: cfg.stop };
};

/**
 * Determines whether the specified model supports the "thinking" capability.
 *
 * @param model - The name of the model to query.
 * @returns `true` if the model advertises the `thinking` capability,
 *          otherwise `false`.  Errors are swallowed and return `false`.
 */
export async function getModelThinking(model: string): Promise<boolean> {
    try {
        const ollama = new Ollama({ host: userConfig.apiEndpointCompletion });
        const info = await ollama.show({ model });

        if (Array.isArray(info.capabilities) && info.capabilities.includes("thinking")) {
            logMsg(`Thinking capability detected`);
            return true;
        } else {
            logMsg(`Thinking not available`);
            return false;
        }
    } catch (error: unknown) {
        logMsg(`Error checking thinking capability for : ${(error as Error).message}`);
        return false;
    }
}

/**
 * Validates whether a requested prediction fits within the model's context window.
 *
 * This function calculates the available tokens by subtracting the current context
 * length from the maximum context length. It then checks if the requested prediction,
 * plus a fixed overhead buffer (20 tokens) and a percentage buffer (1%), fits within
 * the available space.
 *
 * @param predict - The estimated number of tokens required for the completion.
 * @param currentContextLength - The current number of tokens consumed by the prompt.
 * @param maxContextLength - The maximum context window size supported by the model.
 * @returns `true` if the prediction fits within the available context, otherwise `false`.
 */
export function checkPredictFitsContextLength(
    predict: number,
    currentContextLength: number,
    maxContextLength: number,
): boolean {
    const predictTokens = Math.ceil(predict);
    const currentTokens = Math.ceil(currentContextLength);
    const maxTokens = Math.floor(maxContextLength);

    // requested output is larger than the max model context
    if (predictTokens >= maxTokens) {
        logMsg(`Requested prediction (${predictTokens}) exceeds or equals total model limit (${maxTokens})`);
        return false;
    }

    const availableTokens = maxTokens - currentTokens;

    // prompt already consumes the whole window
    if (availableTokens <= 0) {
        logMsg(`Context full. Current: ${currentTokens}, Limit: ${maxTokens}`);
        return false;
    }

    // fixed buffer for hidden API tokens
    // percentage buffer for tokenizer variance (1%)
    const FIXED_OVERHEAD_BUFFER = 20;
    const PERCENTAGE_BUFFER = 0.01;

    const requiredTokens = Math.ceil(predictTokens * (1 + PERCENTAGE_BUFFER) + FIXED_OVERHEAD_BUFFER);

    if (requiredTokens > availableTokens) {
        logMsg(
            `Predicted size (${requiredTokens}) exceeds available context (${availableTokens}). ` +
                `Current: ${currentTokens}, Limit: ${maxTokens}`,
        );
        return false;
    }

    return true;
}
