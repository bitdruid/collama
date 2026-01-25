import * as vscode from "vscode";
import { sysConfig, userConfig } from "./config";
import { logMsg } from "./logging";
import { Ollama } from "ollama";
import { getSupportedModels } from "./common/models";

let lastCheckTime = 0;
let lastCheckResult = false;

const CHECK_INTERVAL_MS = 15_000; // 15 seconds

/**
 * Posts a message to the user via VS Code UI and logs it.
 *
 * @param message - The message text to display.
 * @param type - The message type ("info" or "error").
 */
async function postMessage(message: string, type: string): Promise<void> {
    if (type === "info") {
        vscode.window.showInformationMessage(message);
    }
    if (type === "error") {
        vscode.window.showErrorMessage(message);
    }
    if (type === "warn") {
        vscode.window.showWarningMessage(message);
    }
    logMsg(message);
}

/**
 * Handles a connection error by informing the user.
 */
async function connError() {
    postMessage(`Connection error to the ollama server @ ${userConfig.apiEndpoint}`, "error");
}

/**
 * Checks the current model configuration and reports any issues.
 *
 * @returns A boolean indicating whether the model is suitable for use.
 *          `true` if the model exists and is running (or at least configured),
 *          `false` if any check fails.
 */
export async function checkupModel(): Promise<boolean> {
    const now = Date.now();

    // use cached result if still fresh
    if (now - lastCheckTime < CHECK_INTERVAL_MS) {
        return lastCheckResult;
    }
    logMsg("Checking model...");
    lastCheckTime = now;
    if (!(await checkModelSupported())) {
        lastCheckResult = false;
        return lastCheckResult;
    }
    if (!(await checkModelExists())) {
        lastCheckResult = false;
        return lastCheckResult;
    }
    // extension should proceed but user gets info about model not running
    if (!(await checkModelRunning())) {
        lastCheckResult = true;
        return lastCheckResult;
    }
    lastCheckResult = true;
    return lastCheckResult;
}

/**
 * Determines whether the currently configured model is supported by the extension.
 *
 * @returns `true` if the model name contains one of the supported model identifiers.
 */
async function checkModelSupported(): Promise<boolean> {
    const supportedModels = getSupportedModels();
    for (const model of supportedModels) {
        if (userConfig.apiCompletionModel.includes(model)) {
            return true;
        }
    }
    return false;
}

/**
 * Verifies that the configured model exists on the Ollama server.
 *
 * @returns `true` if the model is found; otherwise `false` and an error message is shown.
 */
async function checkModelExists(): Promise<boolean> {
    const ollama = new Ollama({ host: userConfig.apiEndpoint });

    try {
        const response = await ollama.list();
        const modelNames = response.models.map((m: { name: string }) => m.name);

        if (!modelNames.includes(userConfig.apiCompletionModel)) {
            postMessage(`Model ${userConfig.apiCompletionModel} does not exist on the ollama server`, "error");
            return false;
        }

        return true;
    } catch (error: unknown) {
        connError();
        return false;
    }
}

/**
 * Checks whether the selected model is currently running on the server.
 *
 * @returns `true` if the model is running; otherwise `false` with an informational message.
 */
async function checkModelRunning(): Promise<boolean> {
    const ollama = new Ollama({ host: userConfig.apiEndpoint });

    try {
        const response = await ollama.ps();
        const runningModels = response.models.map((m: { name: string }) => m.name);

        if (!runningModels.includes(userConfig.apiCompletionModel)) {
            postMessage(
                `Model ${userConfig.apiCompletionModel} is not running on the ollama server - first request may take a while`,
                "info",
            );
            return false;
        }

        return true;
    } catch (error: unknown) {
        connError();
        return false;
    }
}

/**
 * Retrieves a list of all models available on the Ollama server.
 *
 * @returns An array of model names, or an empty array if an error occurs.
 */
export async function getAvailableModels(): Promise<string[]> {
    const ollama = new Ollama({ host: userConfig.apiEndpoint });

    try {
        const response = await ollama.list();
        const modelNames = response.models.map((m: { name: string }) => m.name);
        return modelNames;
    } catch (error: unknown) {
        connError();
        return [];
    }
}
