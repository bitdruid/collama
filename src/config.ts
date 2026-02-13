import * as vscode from "vscode";

import { requestOllama, requestOpenAI } from "./common/utils";
import { logMsg } from "./logging";
import { getBearerCompletion, getBearerInstruct } from "./secrets";

const lock = false;
const allowedKeys = ["autoComplete", "suggestMode", "suggestDelay"];

export type RequestType = "completion" | "instruction";

/**
 * Default configuration values that can be overridden by the user.
 * These values are used to initialize the extension and are updated
 * when the workspace configuration changes.
 *
 * Note: Bearer tokens are stored via SecretStorage, not in config.
 */
export const userConfig = {
    apiEndpointCompletion: "http://127.0.0.1:11434",
    apiEndpointInstruct: "http://127.0.0.1:11434",
    apiModelCompletion: "qwen2.5-coder:3b",
    apiModelInstruct: "qwen2.5-coder:3b-instruct",
    autoComplete: true,
    suggestMode: "inline",
    suggestDelay: 1500,
};

/**
 * System configuration values that are not exposed to the user.
 * These constants are used internally by the extension.
 */
export const sysConfig = {
    tokensPredictCompletion: 400,
    tokensPredictDefault: 4096,
    tokensReceiveDefault: 4096,
    backendCompletion: "" as LlmBackendType,
    backendInstruct: "" as LlmBackendType,
    contextLenCompletion: 4096,
    contextLenInstruct: 4096,
};
/**
 * Retrieves the VS Code configuration for the extension.
 *
 * @returns {vscode.WorkspaceConfiguration} The configuration object for `collama`.
 */
export function getConfig() {
    return vscode.workspace.getConfiguration("collama");
}

/**
 * Synchronises the in‑memory `userConfig` with the VS Code workspace
 * configuration. The function compares each key, updates `userConfig`
 * when a change is detected, respects a lock that prevents
 * modification of non‑allowed keys, and logs any changes.
 *
 * The `suggestDelay` value is clamped to a minimum of 1500 ms.
 *
 * @returns {void}
 */
export async function updateVSConfig() {
    const cfg = getConfig();

    const updateConfig = {
        apiEndpointCompletion: cfg.get("apiEndpointCompletion", userConfig.apiEndpointCompletion),
        apiEndpointInstruct: cfg.get("apiEndpointInstruct", userConfig.apiEndpointInstruct),
        apiModelCompletion: cfg.get("apiModelCompletion", userConfig.apiModelCompletion),
        apiModelInstruct: cfg.get("apiModelInstruct", userConfig.apiModelInstruct),
        autoComplete: cfg.get("autoComplete", userConfig.autoComplete),
        suggestMode: cfg.get("suggestMode", userConfig.suggestMode),
        suggestDelay: Math.max(cfg.get("suggestDelay", userConfig.suggestDelay), 1500),
    };

    const changed: Partial<Record<keyof typeof userConfig, { from: any; to: any }>> = {};
    let endpointCompletionChanged = false;
    let endpointInstructChanged = false;
    let modelCompletionChanged = false;
    let modelInstructChanged = false;

    for (const key of Object.keys(updateConfig) as (keyof typeof userConfig)[]) {
        const oldValue = userConfig[key];
        const newValue = updateConfig[key];

        if (oldValue !== newValue) {
            if (lock && !allowedKeys.includes(key)) {
                logMsg(`🔒 Config lock active – key "${key}" is not changeable`);
                cfg.update(key, oldValue, vscode.ConfigurationTarget.Global);
                continue;
            }

            changed[key] = { from: oldValue, to: newValue };
            (userConfig as any)[key] = newValue;

            if (key === "apiEndpointCompletion") {
                endpointCompletionChanged = true;
            }
            if (key === "apiEndpointInstruct") {
                endpointInstructChanged = true;
            }
            if (key === "apiModelCompletion") {
                modelCompletionChanged = true;
            }
            if (key === "apiModelInstruct") {
                modelInstructChanged = true;
            }
        }
    }

    if (Object.keys(changed).length > 0) {
        logMsg(`🔄 Config changed: ${JSON.stringify(changed)}`);
    }

    // Detect backends on startup (when not yet detected) or when endpoints changed
    if (endpointCompletionChanged || !sysConfig.backendCompletion) {
        if (!updateConfig.apiEndpointCompletion) {
            sysConfig.backendCompletion = "";
            sysConfig.contextLenCompletion = 0;
            logMsg("⚠️ Completion endpoint cleared – backend reset");
        } else {
            const bearer = await getBearerCompletion();
            const backend = await detectBackend(updateConfig.apiEndpointCompletion, bearer);
            if (backend === "") {
                logMsg("⚠️ Failed to detect LLM backend (completion)");
            } else {
                logMsg(`ℹ️ Detected LLM backend (completion): ${backend}`);
            }
            sysConfig.backendCompletion = backend;
        }
    }

    if (endpointInstructChanged || !sysConfig.backendInstruct) {
        if (!updateConfig.apiEndpointInstruct) {
            sysConfig.backendInstruct = "";
            sysConfig.contextLenInstruct = 0;
            logMsg("⚠️ Instruct endpoint cleared – backend reset");
        } else {
            const bearer = await getBearerInstruct();
            const backend = await detectBackend(updateConfig.apiEndpointInstruct, bearer);
            if (backend === "") {
                logMsg("⚠️ Failed to detect LLM backend (instruct)");
            } else {
                logMsg(`ℹ️ Detected LLM backend (instruct): ${backend}`);
            }
            sysConfig.backendInstruct = backend;
        }
    }

    // detect the models max context length if endpoint or model changes
    if ((endpointCompletionChanged || modelCompletionChanged) && updateConfig.apiEndpointCompletion) {
        const contextLen = await getModelContextLength("completion");
        if (contextLen === 0) {
            logMsg(`⚠️ Falling back to default context length (completion): ${sysConfig.tokensReceiveDefault}`);
            sysConfig.contextLenCompletion = sysConfig.tokensReceiveDefault;
        } else {
            logMsg(`ℹ️ Detected model context length (completion): ${contextLen}`);
        }
        sysConfig.contextLenCompletion = contextLen;
    }

    if ((endpointInstructChanged || modelInstructChanged) && updateConfig.apiEndpointInstruct) {
        const contextLen = await getModelContextLength("instruction");
        if (contextLen === 0) {
            logMsg(`⚠️ Falling back to default context length (instruct): ${sysConfig.tokensReceiveDefault}`);
            sysConfig.contextLenInstruct = sysConfig.tokensReceiveDefault;
        } else {
            logMsg(`ℹ️ Detected model context length (instruct): ${contextLen}`);
        }
        sysConfig.contextLenInstruct = contextLen;
    }
}

type LlmBackendType = "ollama" | "openai" | "";

const DETECTION_TIMEOUT_MS = 5000;

async function detectBackend(apiBase: string, bearer?: string): Promise<LlmBackendType> {
    const createTimeout = (ms: number) =>
        new Promise((_, reject) => setTimeout(() => reject(new Error("Connection timed out")), ms));

    try {
        const ollama = requestOllama(apiBase, bearer);
        await Promise.race([ollama.list(), createTimeout(DETECTION_TIMEOUT_MS)]);
        return "ollama";
    } catch {}

    try {
        const openai = requestOpenAI(apiBase, bearer);
        await Promise.race([openai.models.list(), createTimeout(DETECTION_TIMEOUT_MS)]);
        return "openai";
    } catch {}

    return "";
}

/**
 * Retrieves the maximum context length supported by the configured model
 * for the specified request type.
 *
 * This function inspects the backend ("ollama" or "openai") to fetch model details.
 * - For Ollama, it queries the model info for a context length field.
 * - For OpenAI, it queries the model list for the specific model's max length.
 *
 * @param requestType - The type of request ("completion" or "instruction").
 * @returns The detected context length as a number. Returns 0 if the backend
 *          is unknown, the model is not found, or an error occurs.
 */
async function getModelContextLength(requestType: RequestType): Promise<number> {
    try {
        const isCompletion = requestType === "completion";
        const endpoint = isCompletion ? userConfig.apiEndpointCompletion : userConfig.apiEndpointInstruct;
        const bearer = isCompletion ? await getBearerCompletion() : await getBearerInstruct();
        const backend = isCompletion ? sysConfig.backendCompletion : sysConfig.backendInstruct;
        const model = isCompletion ? userConfig.apiModelCompletion : userConfig.apiModelInstruct;

        if (!endpoint || !backend || !model) {
            return 0;
        }

        if (backend === "ollama") {
            const ollama = requestOllama(endpoint, bearer);
            const info = await ollama.show({ model });

            if (info.model_info && typeof info.model_info === "object") {
                for (const key in info.model_info) {
                    if (key.toLowerCase().endsWith("context_length")) {
                        const contextLength = (info.model_info as any)[key];
                        if (typeof contextLength === "number") {
                            return contextLength;
                        }
                    }
                }
            }
        } else if (backend === "openai") {
            const openai = requestOpenAI(endpoint, bearer);
            const info = await openai.models.list();
            const modelData = info.data.find((m) => m.id === model);

            if (modelData && typeof (modelData as any).max_model_len === "number") {
                return (modelData as any).max_model_len;
            }
        }
        return 0;
    } catch (error: unknown) {
        logMsg(`Error checking context length: ${(error as Error).message}`);
        return 0;
    }
}
