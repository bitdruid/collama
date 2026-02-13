import * as vscode from "vscode";

const BEARER_COMPLETION_KEY = "collama.bearerCompletion";
const BEARER_INSTRUCT_KEY = "collama.bearerInstruct";

let secretStorage: vscode.SecretStorage;

/**
 * Initializes the secrets manager with the extension context.
 * Must be called during extension activation.
 *
 * @param {vscode.ExtensionContext} context - The extension context.
 */
export function initSecrets(context: vscode.ExtensionContext): void {
    secretStorage = context.secrets;
}

/**
 * Retrieves the bearer token for the completion endpoint.
 *
 * @returns {Promise<string>} The bearer token, or empty string if not set.
 */
export async function getBearerCompletion(): Promise<string> {
    return (await secretStorage.get(BEARER_COMPLETION_KEY)) || "";
}

/**
 * Retrieves the bearer token for the instruct endpoint.
 *
 * @returns {Promise<string>} The bearer token, or empty string if not set.
 */
export async function getBearerInstruct(): Promise<string> {
    return (await secretStorage.get(BEARER_INSTRUCT_KEY)) || "";
}

/**
 * Stores the bearer token for the completion endpoint.
 *
 * @param {string} token - The bearer token to store.
 */
export async function setBearerCompletion(token: string): Promise<void> {
    await secretStorage.store(BEARER_COMPLETION_KEY, token);
}

/**
 * Stores the bearer token for the instruct endpoint.
 *
 * @param {string} token - The bearer token to store.
 */
export async function setBearerInstruct(token: string): Promise<void> {
    await secretStorage.store(BEARER_INSTRUCT_KEY, token);
}

/**
 * Deletes the bearer token for the completion endpoint.
 */
export async function clearBearerCompletion(): Promise<void> {
    await secretStorage.delete(BEARER_COMPLETION_KEY);
}

/**
 * Deletes the bearer token for the instruct endpoint.
 */
export async function clearBearerInstruct(): Promise<void> {
    await secretStorage.delete(BEARER_INSTRUCT_KEY);
}

/**
 * Command handler: prompts user to set bearer token for completion endpoint.
 */
export async function commandSetBearerCompletion(): Promise<void> {
    const token = await vscode.window.showInputBox({
        prompt: "Enter bearer token for completion endpoint",
        password: true,
        ignoreFocusOut: true,
        placeHolder: "Leave empty to clear",
    });

    if (token !== undefined) {
        if (token === "") {
            await clearBearerCompletion();
            vscode.window.showInformationMessage("Bearer token (Completion) cleared");
        } else {
            await setBearerCompletion(token);
            vscode.window.showInformationMessage("Bearer token (Completion) saved securely");
        }
    }
}

/**
 * Command handler: prompts user to set bearer token for instruct endpoint.
 */
export async function commandSetBearerInstruct(): Promise<void> {
    const token = await vscode.window.showInputBox({
        prompt: "Enter bearer token for instruct endpoint",
        password: true,
        ignoreFocusOut: true,
        placeHolder: "Leave empty to clear",
    });

    if (token !== undefined) {
        if (token === "") {
            await clearBearerInstruct();
            vscode.window.showInformationMessage("Bearer token (Instruct) cleared");
        } else {
            await setBearerInstruct(token);
            vscode.window.showInformationMessage("Bearer token (Instruct) saved securely");
        }
    }
}
