import * as vscode from "vscode";

import { postConfigToWebview } from "./chat/utils-back";
import { isAgentsMdActive } from "./common/agents-md";
import { requestOllama, requestOpenAI, type LlmBackendType } from "./common/client";
import { logMsg } from "./logging";
import { getBearerCompletion, getBearerInstruct } from "./secrets";

let tlsRejectUnauthorized = true;

/**
 * Toggle TLS certificate validation (process-wide).
 * When disabled, equivalent to NODE_TLS_REJECT_UNAUTHORIZED=0.
 */
export function setTlsRejectUnauthorized(reject: boolean): void {
    if (reject !== tlsRejectUnauthorized) {
        tlsRejectUnauthorized = reject;
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = reject ? "1" : "0";
        logMsg(`TLS certificate validation: ${reject ? "enabled" : "disabled"}`);
    }
}

/**
 * Registers a configuration change listener that automatically updates the in-memory config
 * when the collama configuration changes.
 *
 * @param extContext - The extension context.
 */
export function registerConfigAutoUpdateCommand(extContext: vscode.ExtensionContext): void {
    const disposable = vscode.workspace.onDidChangeConfiguration(async (event) => {
        if (event.affectsConfiguration("collama")) {
            logMsg("Config auto-update...");
            await updateVSConfig();
        }
    });
    extContext.subscriptions.push(disposable);
}

export interface ExtensionConfig {
    apiEndpointCompletion: string;
    apiEndpointInstruct: string;
    apiModelCompletion: string;
    apiModelInstruct: string;
    agenticMode: boolean;
    autoComplete: boolean;
    suggestMode: string;
    verbosityMode: "compact" | "medium" | "detailed";
    suggestDelay: number;
    enableEditTools: boolean;
    enableShellTool: boolean;
    liteMode: boolean;
    tlsRejectUnauthorized: boolean;
    apiTokenContextLenCompletion: number;
    apiTokenContextLenInstruct: number;
    apiTokenPredictCompletion: number;
    apiTokenPredictInstruct: number;
}

export const defaultExtensionConfig: ExtensionConfig = {
    apiEndpointCompletion: "http://127.0.0.1:11434",
    apiEndpointInstruct: "http://127.0.0.1:11434",
    apiModelCompletion: "qwen2.5-coder:3b",
    apiModelInstruct: "qwen2.5-coder:3b-instruct",
    agenticMode: true,
    autoComplete: true,
    suggestMode: "inline",
    verbosityMode: "medium",
    suggestDelay: 1500,
    enableEditTools: true,
    enableShellTool: false,
    liteMode: false,
    tlsRejectUnauthorized: false,
    apiTokenContextLenCompletion: 4096,
    apiTokenContextLenInstruct: 4096,
    apiTokenPredictCompletion: 400,
    apiTokenPredictInstruct: 4096,
};

/**
 * Mutable runtime configuration initialized from shared defaults.
 * Values are synchronized from VS Code workspace configuration by updateVSConfig().
 *
 * Note: Bearer tokens are stored via SecretStorage, not in config.
 */
export const userConfig: ExtensionConfig = { ...defaultExtensionConfig };

export function getUserConfigSnapshot() {
    return { ...userConfig, agentsMdActive: isAgentsMdActive() };
}

export function broadcastUserConfig(): void {
    postConfigToWebview(getUserConfigSnapshot());
}

/**
 * System configuration values that are not exposed to the user.
 * These constants are used internally by the extension.
 */
export const sysConfig = {
    backendCompletion: "" as LlmBackendType,
    backendInstruct: "" as LlmBackendType,
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
    if (isFirstDetection) {
        isFirstDetection = false;
        await new Promise((r) => setTimeout(r, INITIAL_DELAY));
    }
    const cfg = getConfig();

    const updateConfig = {
        apiEndpointCompletion: cfg.get("apiEndpointCompletion", userConfig.apiEndpointCompletion),
        apiEndpointInstruct: cfg.get("apiEndpointInstruct", userConfig.apiEndpointInstruct),
        apiModelCompletion: cfg.get("apiModelCompletion", userConfig.apiModelCompletion),
        apiModelInstruct: cfg.get("apiModelInstruct", userConfig.apiModelInstruct),
        agenticMode: cfg.get("agenticMode", userConfig.agenticMode),
        autoComplete: cfg.get("autoComplete", userConfig.autoComplete),
        suggestMode: cfg.get("suggestMode", userConfig.suggestMode),
        verbosityMode: cfg.get("verbosityMode", userConfig.verbosityMode),
        suggestDelay: Math.max(cfg.get("suggestDelay", userConfig.suggestDelay), 1500),
        enableEditTools: cfg.get("enableEditTools", userConfig.enableEditTools),
        enableShellTool: cfg.get("enableShellTool", userConfig.enableShellTool),
        liteMode: cfg.get("liteMode", userConfig.liteMode),
        tlsRejectUnauthorized: cfg.get("tlsRejectUnauthorized", userConfig.tlsRejectUnauthorized),
        apiTokenContextLenCompletion: cfg.get("apiTokenContextLenCompletion", userConfig.apiTokenContextLenCompletion),
        apiTokenContextLenInstruct: cfg.get("apiTokenContextLenInstruct", userConfig.apiTokenContextLenInstruct),
        apiTokenPredictCompletion: cfg.get("apiTokenPredictCompletion", userConfig.apiTokenPredictCompletion),
        apiTokenPredictInstruct: cfg.get("apiTokenPredictInstruct", userConfig.apiTokenPredictInstruct),
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
        broadcastUserConfig();
    }

    // Apply TLS settings before any network calls
    setTlsRejectUnauthorized(updateConfig.tlsRejectUnauthorized);

    // Detect backends on startup (when not yet detected) or when endpoints or models changed
    if (endpointCompletionChanged || modelCompletionChanged || !sysConfig.backendCompletion) {
        if (!updateConfig.apiEndpointCompletion) {
            sysConfig.backendCompletion = "";
            logMsg("⚠️ Completion endpoint cleared – backend reset");
        } else if (!hasValidScheme(updateConfig.apiEndpointCompletion)) {
            sysConfig.backendCompletion = "";
            logMsg(
                `⚠️ Completion endpoint missing protocol (got "${updateConfig.apiEndpointCompletion}") – include http:// or https:// in the setting`,
            );
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

    if (endpointInstructChanged || modelInstructChanged || !sysConfig.backendInstruct) {
        if (!updateConfig.apiEndpointInstruct) {
            sysConfig.backendInstruct = "";
            logMsg("⚠️ Instruct endpoint cleared – backend reset");
        } else if (!hasValidScheme(updateConfig.apiEndpointInstruct)) {
            sysConfig.backendInstruct = "";
            logMsg(
                `⚠️ Instruct endpoint missing protocol (got "${updateConfig.apiEndpointInstruct}") – include http:// or https:// in the setting`,
            );
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

    if (!sysConfig.backendCompletion && !sysConfig.backendInstruct) {
        scheduleRetry();
    } else {
        retryCount = 0;
    }
}

let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;
let isFirstDetection = true;
const INITIAL_DELAY = 5000;
const MAX_RETRIES = 60;
const DELAY = 30000;

function scheduleRetry() {
    if (retryTimer) {
        return;
    }
    if (retryCount >= MAX_RETRIES) {
        logMsg(`❌ Backend detection gave up after ${MAX_RETRIES} attempts`);
        return;
    }
    retryCount++;
    logMsg(`⏳ Retrying backend detection in ${DELAY / 1000}s (attempt ${retryCount}/${MAX_RETRIES})`);
    retryTimer = setTimeout(() => {
        retryTimer = null;
        updateVSConfig();
    }, DELAY);
}

const DETECTION_TIMEOUT_MS = 5000;

/** Validates that an endpoint URL includes an http:// or https:// scheme. */
function hasValidScheme(url: string): boolean {
    return /^https?:\/\//i.test(url);
}

async function detectBackend(apiBase: string, bearer?: string): Promise<LlmBackendType> {
    const createTimeout = (ms: number) =>
        new Promise((_, reject) => setTimeout(() => reject(new Error("Connection timed out")), ms));

    const errors: string[] = [];

    try {
        const ollama = requestOllama(apiBase, bearer);
        await Promise.race([ollama.list(), createTimeout(DETECTION_TIMEOUT_MS)]);
        return "ollama";
    } catch (err) {
        errors.push(`Ollama: ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
        const openai = requestOpenAI(apiBase, bearer);
        await Promise.race([openai.models.list(), createTimeout(DETECTION_TIMEOUT_MS)]);
        return "openai";
    } catch (err) {
        errors.push(`OpenAI: ${err instanceof Error ? err.message : String(err)}`);
    }

    logMsg(`Backend detection failed for ${apiBase}:\n  ${errors.join("\n  ")}`);
    return "";
}
