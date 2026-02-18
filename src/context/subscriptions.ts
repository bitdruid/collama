import * as vscode from "vscode";

import { Context } from "../common/context_editor";
import {
    requestEditManual,
    requestExtractFunctions,
    requestFixSyntax,
    requestSimplifyCode,
    requestWriteDocstrings,
} from "../common/ollama";
import { withProgressNotification } from "../common/utils";
import { registerContextCommand } from "./utils";

/**
 * Virtual document provider for diff previews.
 */
class DiffContentProvider implements vscode.TextDocumentContentProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    onDidChange = this._onDidChange.event;

    private contents = new Map<string, string>();

    set(uri: vscode.Uri, content: string) {
        this.contents.set(uri.toString(), content);
        this._onDidChange.fire(uri);
    }

    provideTextDocumentContent(uri: vscode.Uri): string {
        return this.contents.get(uri.toString()) ?? "";
    }
}

/**
 * Processes the current text selection in the active editor.
 *
 * The function retrieves the selected text, passes it to the supplied async `callback`,
 * and then handles the result. If the callback returns a different string,
 * the user is prompted to preview a diff and optionally apply the changes.
 *
 * @param callback A function that receives the original selected text and returns a promise
 *   resolving to the modified text. The callback should not modify the input string.
 * @returns A promise that resolves when the operation completes. If there is no active
 *   editor or no selection, the function resolves immediately without performing any
 *   action.
 */
export async function handleSelectionWithDiff(callback: (currentContext: Context) => Promise<string>) {
    const currentContext = await Context.create();
    if (!currentContext) {
        return;
    }

    const originalText = currentContext.selectionText;
    if (!originalText) {
        vscode.window.showInformationMessage("No selection.");
        return;
    }
    await withProgressNotification("collama: Generating…", async () => {
        const editedText = await callback(currentContext);
        if (!editedText) {
            return;
        }

        // if no changes then skip everything
        if (editedText !== originalText) {
            // preview confirmation
            const previewChoice = await vscode.window.showQuickPick(["Yes", "No"], {
                placeHolder: "Show diff-preview?",
                canPickMany: false,
                ignoreFocusOut: true,
            });

            if (previewChoice === "Yes") {
                // virtual URIs for the modified code
                const id = Date.now();
                const leftUri = vscode.Uri.parse(`collama-diff:${id}-original.ts`);
                const rightUri = vscode.Uri.parse(`collama-diff:${id}-modified.ts`);

                // provider for diff view
                const provider = new DiffContentProvider();
                const registration = vscode.workspace.registerTextDocumentContentProvider("collama-diff", provider);

                provider.set(leftUri, originalText);
                provider.set(rightUri, editedText);

                // open diff
                await vscode.commands.executeCommand("vscode.diff", leftUri, rightUri, "collama – Preview Changes");

                // apply confirmation
                const applyChoice = await vscode.window.showQuickPick(["Accept", "Cancel"], {
                    placeHolder: "Apply these changes?",
                    canPickMany: false,
                    ignoreFocusOut: true,
                });

                if (applyChoice === "Accept") {
                    const edit = new vscode.WorkspaceEdit();
                    edit.replace(currentContext.textEditor.document.uri, currentContext.selectionObject, editedText);
                    await vscode.workspace.applyEdit(edit);
                    vscode.window.showInformationMessage("Changes applied.");
                }
                if (applyChoice === "Cancel") {
                    vscode.window.showInformationMessage("Changes discarded.");
                }
                // only close the active tab if it is still the diff preview
                const activeEditor = vscode.window.activeTextEditor;
                if (
                    activeEditor &&
                    (activeEditor.document.uri.toString() === leftUri.toString() ||
                        activeEditor.document.uri.toString() === rightUri.toString())
                ) {
                    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
                }

                registration.dispose();
            } else if (previewChoice === "No") {
                // apply without preview
                const edit = new vscode.WorkspaceEdit();
                edit.replace(currentContext.textEditor.document.uri, currentContext.selectionObject, editedText);
                await vscode.workspace.applyEdit(edit);
                vscode.window.showInformationMessage("Changes applied.");
            }
        } else {
            vscode.window.showInformationMessage("No changes to apply.");
        }
    });
}

export function registerWriteDocstringsCommand(context: vscode.ExtensionContext) {
    registerContextCommand(
        context,
        "collama.writeDocstrings",
        "WriteDocstrings",
        requestWriteDocstrings,
        handleSelectionWithDiff,
    );
}

export function registerExtractFunctionsCommand(context: vscode.ExtensionContext) {
    registerContextCommand(
        context,
        "collama.extractFunctions",
        "ExtractFunctions",
        requestExtractFunctions,
        handleSelectionWithDiff,
    );
}

export function registerSimplifyCommand(context: vscode.ExtensionContext) {
    registerContextCommand(context, "collama.simplifyCode", "Simplify", requestSimplifyCode, handleSelectionWithDiff);
}

export function registerFixSyntaxCommand(context: vscode.ExtensionContext) {
    registerContextCommand(context, "collama.fixSyntax", "FixSyntax", requestFixSyntax, handleSelectionWithDiff);
}

export function registerEditManualCommand(context: vscode.ExtensionContext) {
    registerContextCommand(context, "collama.editManual", "EditManual", requestEditManual, handleSelectionWithDiff);
}
