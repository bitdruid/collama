import * as vscode from "vscode";

import { EditorContext } from "../common/context-editor";
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
    extContext: vscode.ExtensionContext,
    commandId: string,
    logName: string,
    handler: (ctx: EditorContext) => Promise<string>,
    selectionHandler: (callback: (ctx: EditorContext) => Promise<string>) => Promise<void>,
): void {
    const disposable = vscode.commands.registerCommand(commandId, async () => {
        logMsg(`Edit (Selection): ${logName} triggered`);
        selectionHandler(handler);
    });
    extContext.subscriptions.push(disposable);
}
