import * as vscode from "vscode";

import { checkupModel } from "./checkup";
import { userConfig } from "../config";
import { logMsg } from "../logging";
import { Completion } from "./completion";

let debounceTimer: NodeJS.Timeout | undefined;
let pendingResolve: ((value: vscode.InlineCompletionList) => void) | null = null;

export function clearDebounce() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
}

export function registerAutoCompleteProvider(context: vscode.ExtensionContext) {
    const provider: vscode.InlineCompletionItemProvider = {
        async provideInlineCompletionItems(document, position, context, token) {
            const manualTrigger = context.triggerKind === vscode.InlineCompletionTriggerKind.Invoke;
            const editor = vscode.window.activeTextEditor;
            if (editor && !editor.selection.isEmpty) {
                logMsg("Text is selected - no autocomplete");
                return;
            }
            if (!userConfig.autoComplete && !manualTrigger) {
                return;
            }

            if (!(await checkupModel())) {
                return;
            }

            // cancel any pending debounce
            if (debounceTimer) {
                clearTimeout(debounceTimer);
                debounceTimer = undefined;
            }

            const runCompletion = async (): Promise<vscode.InlineCompletionList> => {
                logMsg(`Completion triggered (${manualTrigger ? "manual" : "auto"})`);
                const result: vscode.InlineCompletionList = { items: [] };

                try {
                    // request a completion object with the code context
                    const completion = new Completion();
                    await completion.generate();
                    logMsg("\n---------------------------------------------------------------------------");

                    result.items.push({
                        insertText: new vscode.SnippetString(completion.snippet),
                        range: new vscode.Range(position.line, position.character, position.line, position.character),
                    });
                } catch (err) {
                    console.error(err);
                }
                return result;
            };

            // manual trigger skips timer
            if (manualTrigger) {
                return runCompletion();
            }

            // auto trigger has timer
            return new Promise<vscode.InlineCompletionList>((resolve) => {
                pendingResolve = resolve;

                debounceTimer = setTimeout(async () => {
                    const result = await runCompletion();
                    pendingResolve?.(result);
                    pendingResolve = null;
                }, userConfig.suggestDelay);
            });
        },
    };

    let disposable = vscode.languages.registerInlineCompletionItemProvider({ pattern: "**" }, provider);
    context.subscriptions.push(disposable);
}
export function deactivate() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
}
