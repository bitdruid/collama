import * as vscode from "vscode";
import { clearDebounce, registerAutoCompleteProvider } from "./autocomplete/subscriptions";
import { updateVSConfig } from "./config";
import {
    registerEditManualCommand,
    registerExtractFunctionsCommand,
    registerFixSyntaxCommand,
    registerSimplifyCommand,
    registerWriteDocstringsCommand,
} from "./context/subscriptions";
import { logMsg, logStream } from "./logging";
import { setStatusbar } from "./statusbar";
import { registerChatProvider } from "./chat/subscriptions";

/**
 *
 * ENTRYPOINT for the extension
 */
export function activate(context: vscode.ExtensionContext) {
    updateVSConfig();

    // live reload config if changed
    vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("collama")) {
            updateVSConfig();
        }
    });

    setStatusbar();
    logMsg("collama started");
    logStream("collama started");

    registerWriteDocstringsCommand(context);
    registerExtractFunctionsCommand(context);
    registerSimplifyCommand(context);
    registerFixSyntaxCommand(context);
    registerEditManualCommand(context);

    registerAutoCompleteProvider(context);

    registerChatProvider(context);
}

export function deactivate() {
    clearDebounce();
}
