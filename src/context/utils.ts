import * as vscode from "vscode";

import { Context } from "../common/context_editor";
import { logMsg } from "../logging";

/**
 * Registers a command that processes the current selection with a diff preview.
 *
 * @param context - The extension context.
 * @param commandId - The full command ID (e.g., "collama.writeDocstrings").
 * @param logName - The name to use in log messages (e.g., "WriteDocstrings").
 * @param handler - The async function that processes the context and returns modified text.
 */
export function registerContextCommand(
    context: vscode.ExtensionContext,
    commandId: string,
    logName: string,
    handler: (ctx: Context) => Promise<string>,
    selectionHandler: (callback: (ctx: Context) => Promise<string>) => Promise<void>,
): void {
    const disposable = vscode.commands.registerCommand(commandId, async () => {
        logMsg(`Edit (Selection): ${logName} triggered`);
        selectionHandler(handler);
    });
    context.subscriptions.push(disposable);
}
