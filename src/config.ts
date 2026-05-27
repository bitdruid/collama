import * as vscode from "vscode";

import { postConfigToWebview } from "./chat/backend/utils";
import type { ChatSettings } from "./chat/shared";
import { isAgentsMdActive } from "./common/agents-md";
import { requestOllama, requestOpenAI, type LlmBackendType } from "./common/client";
import { logMsg } from "./logging";
import { getBearerCompletion, getBearerInstruct } from "./secrets";

/**
 * User-facing configuration options for the Collama VS Code extension.
 * Values are synchronized from VS Code workspace settings.
 */
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
 * Tracks detected LLM backend types for each request type.
 * An empty string indicates the backend has not yet been detected.
 * This is an internal system configuration, not exposed to users.
 */
export const sysConfig = {
    backendCompletion: "" as LlmBackendType,
    backendInstruct: "" as LlmBackendType,
};

/**
 * Returns the subset of user configuration that the chat webview can access.
 * These settings are read-only from the webview's perspective.
 */
export function getChatSettings(): ChatSettings {
    return {
        agenticMode: userConfig.agenticMode,
        enableEditTools: userConfig.enableEditTools,
        enableShellTool: userConfig.enableShellTool,
        liteMode: userConfig.liteMode,
        verbosityMode: userConfig.verbosityMode,
    };
}

/**
 * Mutable runtime configuration populated from VS Code settings.
 * Updated via `updateVSConfig()`. Note: Bearer tokens are stored in
 * SecretStorage and are not part of this object.
 */
export const userConfig: ExtensionConfig = { ...defaultExtensionConfig };

/**
 * Retrieves the VS Code workspace configuration for the "collama" extension.
 * @returns The configuration object for the collama extension.
 */
export function getConfig() {
    return vscode.workspace.getConfiguration("collama");
}

/**
 * Sends the current user configuration to the chat webview.
 * Includes chat-relevant settings and the current agents.md activation state.
 */
export function broadcastUserConfig(): void {
    postConfigToWebview(getChatSettings(), isAgentsMdActive());
}

/**
 * Registers a VS Code command that automatically syncs configuration
 * whenever the user modifies collama settings in the workspace.
 */
export function registerConfigAutoUpdateCommand(extContext: vscode.ExtensionContext): void {
    const disposable = vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("collama")) {
            updateVSConfig();
        }
    });
    extContext.subscriptions.push(disposable);
}

// Node validates certs; track so we only touch it on change.
let tlsApplied = true;

/**
 * Updates the process-wide TLS certificate validation setting.
 * Only modifies the environment when the setting actually changes.
 */
function applyTls(): void {
    if (tlsApplied === userConfig.tlsRejectUnauthorized) {
        return;
    }
    tlsApplied = userConfig.tlsRejectUnauthorized;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = tlsApplied ? "1" : "0";
    logMsg(`TLS certificate validation ${tlsApplied ? "enabled" : "disabled"}`);
}

/**
 * Synchronizes `userConfig` with current VS Code settings and notifies
 * dependent components of any changes. Backend detection runs asynchronously
 * and does not block this function.
 */
export function updateVSConfig(): void {
    const cfg = getConfig();

    const updateConfig: ExtensionConfig = {
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

    // Re-detect a backend only when its endpoint or model changed.
    if (
        updateConfig.apiEndpointCompletion !== userConfig.apiEndpointCompletion ||
        updateConfig.apiModelCompletion !== userConfig.apiModelCompletion
    ) {
        sysConfig.backendCompletion = "";
    }
    if (
        updateConfig.apiEndpointInstruct !== userConfig.apiEndpointInstruct ||
        updateConfig.apiModelInstruct !== userConfig.apiModelInstruct
    ) {
        sysConfig.backendInstruct = "";
    }

    const changes: string[] = [];
    for (const key of Object.keys(updateConfig) as (keyof ExtensionConfig)[]) {
        if (updateConfig[key] !== userConfig[key]) {
            changes.push(`${key}: ${userConfig[key]} → ${updateConfig[key]}`);
            (userConfig as any)[key] = updateConfig[key];
        }
    }

    if (changes.length > 0) {
        logMsg(`🔄 Config changed — ${changes.join(", ")}`);
        broadcastUserConfig();
    }

    applyTls();
    startBackendDetection();
}

/**
 * Triggers a fresh detection of both LLM backends.
 * Useful after events like bearer token changes that may affect connectivity.
 */
export function redetectBackends(): void {
    sysConfig.backendCompletion = "";
    sysConfig.backendInstruct = "";
    detectBackends();
}

const DETECT_INTERVAL_MS = 30000;
const DETECT_TIMEOUT_MS = 5000;

let detectTimer: ReturnType<typeof setInterval> | null = null;
let detecting = false;

/**
 * Initiates the background backend detection loop.
 * Only creates a new interval if one is not already running.
 * Once a backend is detected, subsequent ticks become no-ops.
 */
function startBackendDetection(): void {
    detectBackends();
    if (!detectTimer) {
        detectTimer = setInterval(detectBackends, DETECT_INTERVAL_MS);
    }
}

/**
 * Attempts to detect any LLM backends that are still unidentified.
 * Idempotent and safe to call multiple times.
 */
async function detectBackends(): Promise<void> {
    if (detecting) {
        return;
    }
    detecting = true;
    try {
        if (!sysConfig.backendCompletion) {
            sysConfig.backendCompletion = await detectBackend(
                userConfig.apiEndpointCompletion,
                await getBearerCompletion(),
            );
            logDetection("completion", sysConfig.backendCompletion);
        }
        if (!sysConfig.backendInstruct) {
            sysConfig.backendInstruct = await detectBackend(userConfig.apiEndpointInstruct, await getBearerInstruct());
            logDetection("instruct", sysConfig.backendInstruct);
        }
    } finally {
        detecting = false;
    }
}

/**
 * Logs the outcome of backend detection for a specific request type.
 * @param type - The request type, such as "completion" or "instruct".
 * @param backend - The detected backend type, or an empty string if detection failed.
 */
function logDetection(type: string, backend: LlmBackendType): void {
    if (backend) {
        logMsg(`ℹ️ Detected LLM backend (${type}): ${backend}`);
    } else {
        logMsg(`⚠️ No LLM backend (${type}) — retrying every ${DETECT_INTERVAL_MS / 1000}s`);
    }
}

/**
 * Wraps a promise with a timeout. If the timeout expires before the promise
 * resolves or rejects, the returned promise is rejected.
 * @param probe - The promise to wrap with a timeout.
 * @returns A promise that resolves or rejects based on whichever happens first.
 */
function withTimeout<T>(probe: Promise<T>): Promise<T> {
    const timeout = new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timed out")), DETECT_TIMEOUT_MS));
    return Promise.race([probe, timeout]);
}

/**
 * Probes an API endpoint to determine which LLM backend provider is available.
 * @param apiBase - The base URL of the API endpoint.
 * @param bearer - Optional bearer token for authentication.
 * @returns The detected backend type ("ollama" or "openai"), or an empty string if unreachable.
 */
async function detectBackend(apiBase: string, bearer?: string): Promise<LlmBackendType> {
    if (!/^https?:\/\//i.test(apiBase)) {
        return "";
    }

    try {
        await withTimeout(requestOllama(apiBase, bearer).list());
        return "ollama";
    } catch {
        // try the next provider
    }

    try {
        await withTimeout(requestOpenAI(apiBase, bearer).models.list());
        return "openai";
    } catch {
        return "";
    }
}
