import * as vscode from "vscode";
import { logMsg } from "../logging";

/**
 * Wraps an async operation with a VS Code progress notification.
 *
 * @param title - The title shown in the progress notification.
 * @param task - The async function to execute.
 * @returns The result of the task.
 */
export async function withProgressNotification<T>(title: string, task: () => Promise<T>): Promise<T> {
    return vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Window,
            title,
            cancellable: false,
        },
        task,
    );
}

/**
 * Shows an information message to the user and logs it.
 *
 * @param message - The message to display.
 */
export async function showInfoMessage(message: string): Promise<void> {
    vscode.window.showInformationMessage(message);
    logMsg(message);
}

/**
 * Shows an error message to the user and logs it.
 *
 * @param message - The error message to display.
 */
export async function showErrorMessage(message: string): Promise<void> {
    vscode.window.showErrorMessage(message);
    logMsg(message);
}

/**
 * Shows a warning message to the user and logs it.
 *
 * @param message - The warning message to display.
 */
export async function showWarningMessage(message: string): Promise<void> {
    vscode.window.showWarningMessage(message);
    logMsg(message);
}
