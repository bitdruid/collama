import * as vscode from "vscode";

import { getSupportedModels, modelsMatch } from "../common/models";
import { requestOllama, requestOpenAI } from "../common/utils";
import { sysConfig, userConfig } from "../config";
import { logMsg } from "../logging";
import { getBearerCompletion } from "../secrets";

let lastCheckTime = 0;
let lastCheckResult = false;

const CHECK_INTERVAL_MS = 15_000; // 15 seconds

/**
 * Posts a message to the user via VS Code UI and logs it.
 *
 * @param message - The message text to display.
 * @param type - The message type: `"info"`, `"error"`, or `"warn"`.
 * @returns A promise that resolves when the message has been shown and logged.
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
 *
 * @returns A promise that resolves after the error message has been displayed.
 */
async function connError() {
    postMessage(`Connection error to the ollama server @ ${userConfig.apiEndpointCompletion}`, "error");
}

/**
 * Checks the current model configuration and reports any issues.
 *
 * @returns `true` if the model exists and is running (or at least configured); otherwise `false`.
 * @remarks The result is cached for {@link CHECK_INTERVAL_MS} milliseconds to avoid
 * repeated network calls.
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
    // if (!(await checkModelRunning())) {
    //     lastCheckResult = true;
    //     return lastCheckResult;
    // }
    lastCheckResult = true;
    return lastCheckResult;
}

/**
 * Determines whether the currently configured model is supported by the extension.
 *
 * @returns `true` if the model name contains one of the supported model identifiers; otherwise `false`.
 */
async function checkModelSupported(): Promise<boolean> {
    const supportedModels = getSupportedModels();
    const lowerModel = userConfig.apiModelCompletion.toLowerCase();
    for (const pattern of supportedModels) {
        if (lowerModel.includes(pattern.toLowerCase())) {
            return true;
        }
    }

    return false;
}

/**
 * Verifies that the configured model exists on the configured backend.
 *
 * @returns `true` if the model is found; otherwise `false` and an error message is shown.
 * @throws Will not throw; network errors are handled internally by displaying a connection error.
 */
async function checkModelExists(): Promise<boolean> {
    try {
        // OLLAMA BACKEND
        if (sysConfig.backendCompletion === "ollama") {
            const ollama = requestOllama(userConfig.apiEndpointCompletion, await getBearerCompletion());

            const response = await ollama.list();
            const modelNames = response.models.map((m: { name: string }) => m.name);

            const modelExists = modelNames.some((name) => modelsMatch(name, userConfig.apiModelCompletion));

            if (!modelExists) {
                postMessage(`Model ${userConfig.apiModelCompletion} does not exist on the Ollama server`, "error");
                return false;
            }

            return true;
        }

        // OPENAI BACKEND
        if (sysConfig.backendCompletion === "openai") {
            const openai = requestOpenAI(userConfig.apiEndpointCompletion, await getBearerCompletion());

            const response = await openai.models.list();
            const modelIds = response.data.map((m) => m.id);

            const modelExists = modelIds.some((id) => modelsMatch(id, userConfig.apiModelCompletion));

            if (!modelExists) {
                postMessage(`Model ${userConfig.apiModelCompletion} does not exist on the OpenAI server`, "error");
                return false;
            }

            return true;
        }

        // Unknown backend
        postMessage(`Unsupported backend: ${sysConfig.backendCompletion}`, "error");
        return false;
    } catch (error: unknown) {
        connError();
        return false;
    }
}

// /**
//  * Checks whether the selected model is currently running on the server.
//  *
//  * @returns `true` if the model is running; otherwise `false` with an informational message.
//  * @throws Will not throw; network errors are handled internally by displaying a connection error.
//  */
// async function checkModelRunning(): Promise<boolean> {
//     const ollama = new Ollama({ host: userConfig.apiEndpointCompletion });

//     try {
//         const response = await ollama.ps();
//         const runningModels = response.models.map((m: { name: string }) => m.name);

//         const isRunning = runningModels.some((name: string) => modelsMatch(name, userConfig.apiModelCompletion));
//         if (!isRunning) {
//             postMessage(
//                 `Model ${userConfig.apiModelCompletion} is not running on the ollama server - first request may take a while`,
//                 "info",
//             );
//             return false;
//         }

//         return true;
//     } catch (error: unknown) {
//         connError();
//         return false;
//     }
// }
