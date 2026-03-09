import * as vscode from "vscode";

import { clearDebounce, registerAutoCompleteProvider } from "./autocomplete/subscriptions";
import { registerChatProvider, registerSendToChatCommand } from "./chat/subscriptions";
import { registerRequestCommitMessageCommand } from "./commit/subscriptions";
import { updateVSConfig } from "./config";
import {
    registerEditManualCommand,
    registerExtractFunctionsCommand,
    registerFixSyntaxCommand,
    registerSimplifyCommand,
    registerWriteDocstringsCommand,
} from "./context/subscriptions";
import { logMsg } from "./logging";
import { commandSetBearerCompletion, commandSetBearerInstruct, initSecrets } from "./secrets";
import { setStatusbar } from "./statusbar";

/**
 *
 * ENTRYPOINT for the extension
 */
export async function activate(extContext: vscode.ExtensionContext) {
    let initialized = false;

    // init secrets and bearer commands
    initSecrets(extContext);
    extContext.subscriptions.push(
        vscode.commands.registerCommand("collama.setBearerCompletion", commandSetBearerCompletion),
    );
    extContext.subscriptions.push(vscode.commands.registerCommand("collama.setBearerInstruct", commandSetBearerInstruct));

    await updateVSConfig();
    // live reload config if changed
    vscode.workspace.onDidChangeConfiguration(async (event) => {
        if (!initialized) {
            return;
        }
        logMsg("Config auto-update...");
        if (event.affectsConfiguration("collama")) {
            await updateVSConfig();
        }
    });

    setStatusbar(extContext);

    registerWriteDocstringsCommand(extContext);
    registerExtractFunctionsCommand(extContext);
    registerSimplifyCommand(extContext);
    registerFixSyntaxCommand(extContext);
    registerEditManualCommand(extContext);

    registerAutoCompleteProvider(extContext);

    registerChatProvider(extContext);
    registerSendToChatCommand(extContext);

    registerRequestCommitMessageCommand(extContext);

    logMsg("----- collama initialized -----");
    initialized = true;
}

export function deactivate() {
    clearDebounce();
}
