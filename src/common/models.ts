import { Ollama } from "ollama";
import { Context, OpenFilesContext } from "./context";
import { sysConfig, userConfig } from "../config";
import { logMsg } from "../logging";

export interface ModelConfig {
    modelpattern: string[];
    prompt: (openFiles: OpenFilesContext[], prefix: string, suffix: string) => string;
    stop: string[];
}

export const modelConfigs: ModelConfig[] = [
    {
        modelpattern: ["codeqwen:", "qwen2.5-coder:", "qwen3-coder:"],
        prompt: (openFiles, prefix, suffix) =>
            `${openFiles
                .map((e) => `<|file_sep|>${e.path}\n${e.content}`)
                .join("")}<|file_sep|><|fim_prefix|>${prefix}<|fim_suffix|>${suffix}<|fim_middle|>`,
        stop: [
            "<|fim_prefix|>",
            "<|fim_suffix|>",
            "<|fim_middle|>",
            "<|file_sep|>",
            "<|endoftext|>",
            "<|repo_name|>",
            "<|im_start|>",
            "<|im_end|>",
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
 * Return all user‑friendly names of supported models (i.e. all patterns).
 */
export const getSupportedModels = (): string[] => modelConfigs.flatMap((c) => c.modelpattern);

/**
 * Find the config whose `patterns` match the current `apiCompletionModel`.
 * Returns `undefined` if nothing matches.
 */
const findModelConfig = (apiCompletionModel: string): ModelConfig | undefined => {
    const lower = apiCompletionModel.toLowerCase();
    return modelConfigs.find((cfg) => cfg.modelpattern.some((p) => lower.includes(p)));
};

/**
 * Convenience wrapper that returns the prompt and stop tokens
 * for the current `apiCompletionModel`.  Used by the request handler.
 */
export const getModelConfig = (context: Context): { prompt: string; stop: string[] } | false => {
    const cfg = findModelConfig(userConfig.apiCompletionModel);
    if (!cfg) {
        return false;
    }

    return { prompt: cfg.prompt(context.openFiles, context.activePrefix, context.activeSuffix), stop: cfg.stop };
};

export async function getModelThinking(model: string): Promise<boolean> {
    try {
        const ollama = new Ollama({ host: userConfig.apiEndpoint });
        const info = await ollama.show({ model });

        if (Array.isArray(info.capabilities) && info.capabilities.includes("thinking")) {
            logMsg(`Thinking capability detected`);
            return true;
        } else {
            logMsg(`Thinking not available`);
            return false;
        }
    } catch (error: unknown) {
        return false;
    }
}

export async function getModelContextLength(model: string): Promise<number> {
    try {
        const ollama = new Ollama({ host: userConfig.apiEndpoint });
        const info = await ollama.show({ model });

        // check for any `.context_length` key inside model_info
        if (info.model_info && typeof info.model_info === "object") {
            for (const key in info.model_info) {
                if (key.toLowerCase().endsWith("context_length")) {
                    const contextLength = (info.model_info as any)[key];
                    if (typeof contextLength === "number") {
                        logMsg(`Context length supported [${contextLength}]`);
                        return contextLength;
                    }
                }
            }
        }

        return sysConfig.tokensReceive; // default value
    } catch (error: unknown) {
        return sysConfig.tokensReceive;
    }
}
