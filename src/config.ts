import * as vscode from "vscode";
import { logMsg } from "./logging";

const lock = false;
const allowedKeys = ["autoComplete", "suggestMode", "suggestDelay"];

/**
 * Configuration settings for the extension.
 */
export const userConfig = {
    apiEndpoint: "http://127.0.0.1:11434",
    apiCompletionModel: "qwen2.5-coder:3b",
    apiInstructionModel: "qwen2.5-coder:3b-instruct",
    autoComplete: true,
    suggestMode: "inline",
    suggestDelay: 1500,
};

/**
 * System configuration settings that are not user configurable.
 */
export const sysConfig = {
    tokensPredict: 400,
    tokensReceive: 4096,
};

/**
 * Retrieves the VS Code configuration for the extension.
 * @returns The configuration object.
 */
export function getConfig() {
    return vscode.workspace.getConfiguration("collama");
}

/**
 * Updates the VS Code configuration with the values from the userConfig and logs any changes.
 */
export function updateVSConfig() {
    const cfg = getConfig();

    const updateConfig = {
        apiEndpoint: cfg.get("apiEndpoint", userConfig.apiEndpoint),
        apiCompletionModel: cfg.get("apiCompletionModel", userConfig.apiCompletionModel),
        apiInstructionModel: cfg.get("apiInstructionModel", userConfig.apiInstructionModel),
        autoComplete: cfg.get("autoComplete", userConfig.autoComplete),
        suggestMode: cfg.get("suggestMode", userConfig.suggestMode),
        suggestDelay: Math.max(cfg.get("suggestDelay", userConfig.suggestDelay), 1500),
    };

    const changed: Partial<Record<keyof typeof userConfig, { from: any; to: any }>> = {};

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
        }
    }

    if (Object.keys(changed).length > 0) {
        logMsg(`🔄 Config changed: ${JSON.stringify(changed)}`);
    }
}
