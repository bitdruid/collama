import * as vscode from "vscode";
const { showInformationMessage } = vscode.window;

import { EditorContext } from "../common/context-editor";
import {
    requestEditManual,
    requestExtractFunctions,
    requestFixSyntax,
    requestSimplifyCode,
    requestWriteDocstrings,
} from "../common/requests";
import { logMsg } from "../logging";

let pendingDiffChoice: ((choice: "Accept" | "Cancel") => void) | undefined;

/**
 * Registers the Accept/Discard title-bar commands once at activation.
 * They simply resolve whichever diff preview is currently awaiting a choice.
 *
 * @param extContext - The VSCode Extension Context object containing subscriptions and commands
 */
export function registerDiffPreviewCommands(extContext: vscode.ExtensionContext) {
    extContext.subscriptions.push(
        vscode.commands.registerCommand("collama.acceptEdit", () => pendingDiffChoice?.("Accept")),
        vscode.commands.registerCommand("collama.rejectEdit", () => pendingDiffChoice?.("Cancel")),
    );
}

/**
 * Awaits the user's Accept/Discard click. Resolves "Cancel" if the diff tab is closed
 * without a choice, so a dismissed preview can't leave the request hanging.
 * 
 * @param leftUri - URI of the original document in the diff pair
 * @param rightUri - URI of the modified document in the diff pair
 * @returns A Promise resolving to either "Accept" if applied or "Cancel" if discarded/closed

 */
function awaitDiffChoice(leftUri: vscode.Uri, rightUri: vscode.Uri): Promise<"Accept" | "Cancel"> {
    return new Promise((resolve) => {
        const finish = (choice: "Accept" | "Cancel") => {
            sub.dispose();
            pendingDiffChoice = undefined;
            resolve(choice);
        };
        const sub = vscode.window.tabGroups.onDidChangeTabs(() => {
            const stillOpen = vscode.window.tabGroups.all.some((g) =>
                g.tabs.some((t) => {
                    const input = t.input as { original?: vscode.Uri; modified?: vscode.Uri } | undefined;
                    return (
                        input?.original?.toString() === leftUri.toString() &&
                        input?.modified?.toString() === rightUri.toString()
                    );
                }),
            );
            if (!stillOpen) {
                finish("Cancel");
            }
        });
        pendingDiffChoice = finish;
    });
}

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
export async function handleSelectionWithDiff(callback: (currentContext: EditorContext) => Promise<string>) {
    const currentContext = await new EditorContext().loadActiveEditor();
    if (!currentContext) {
        return;
    }

    const originalText = currentContext.selectionText;
    if (!originalText) {
        showInformationMessage("No selection.");
        return;
    }
    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Window, title: "collama: Generating…", cancellable: false },
        async () => {
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

                    // apply confirmation via title-bar buttons (don't overlay the diff, don't auto-dismiss)
                    await vscode.commands.executeCommand("setContext", "collama.diffPreviewActive", true);
                    const applyChoice = await awaitDiffChoice(leftUri, rightUri);
                    await vscode.commands.executeCommand("setContext", "collama.diffPreviewActive", false);

                    if (applyChoice === "Accept") {
                        const edit = new vscode.WorkspaceEdit();
                        edit.replace(currentContext.uri, currentContext.selectionObject, editedText);
                        await vscode.workspace.applyEdit(edit);
                        showInformationMessage("Changes applied.");
                    }
                    if (applyChoice === "Cancel") {
                        showInformationMessage("Changes discarded.");
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
                    edit.replace(currentContext.uri, currentContext.selectionObject, editedText);
                    await vscode.workspace.applyEdit(edit);
                    showInformationMessage("Changes applied.");
                }
            } else {
                showInformationMessage("No changes to apply.");
            }
        },
    );
}

/**
 * Registers an action command that processes the current selection with a diff preview.
 *
 * @param extContext - The extension context.
 * @param commandId - The full command ID (for example, "collama.writeDocstrings").
 * @param logName - The name to use in log messages.
 * @param handler - The async function that processes the editor context and returns modified text.
 */
function registerActionCommand(
    extContext: vscode.ExtensionContext,
    commandId: string,
    logName: string,
    handler: (ctx: EditorContext) => Promise<string>,
): void {
    const disposable = vscode.commands.registerCommand(commandId, async () => {
        logMsg(`Edit (Selection): ${logName} triggered`);
        handleSelectionWithDiff(handler);
    });
    extContext.subscriptions.push(disposable);
}

export function registerWriteDocstringsCommand(extContext: vscode.ExtensionContext) {
    registerActionCommand(extContext, "collama.writeDocstrings", "WriteDocstrings", requestWriteDocstrings);
}

export function registerExtractFunctionsCommand(extContext: vscode.ExtensionContext) {
    registerActionCommand(extContext, "collama.extractFunctions", "ExtractFunctions", requestExtractFunctions);
}

export function registerSimplifyCommand(extContext: vscode.ExtensionContext) {
    registerActionCommand(extContext, "collama.simplifyCode", "Simplify", requestSimplifyCode);
}

export function registerFixSyntaxCommand(extContext: vscode.ExtensionContext) {
    registerActionCommand(extContext, "collama.fixSyntax", "FixSyntax", requestFixSyntax);
}

export function registerEditManualCommand(extContext: vscode.ExtensionContext) {
    registerActionCommand(extContext, "collama.editManual", "EditManual", requestEditManual);
}
