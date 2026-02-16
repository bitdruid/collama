import * as vscode from "vscode";

import { clearDebounce, registerAutoCompleteProvider } from "./autocomplete/subscriptions";
import { registerChatProvider, registerSendToChatCommand } from "./chat/subscriptions";
import { registerGenerateCommitMessageCommand } from "./commit/subscriptions";
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
export async function activate(context: vscode.ExtensionContext) {
    let initialized = false;

    // init secrets and bearer commands
    initSecrets(context);
    context.subscriptions.push(
        vscode.commands.registerCommand("collama.setBearerCompletion", commandSetBearerCompletion),
    );
    context.subscriptions.push(vscode.commands.registerCommand("collama.setBearerInstruct", commandSetBearerInstruct));

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

    setStatusbar(context);

    registerWriteDocstringsCommand(context);
    registerExtractFunctionsCommand(context);
    registerSimplifyCommand(context);
    registerFixSyntaxCommand(context);
    registerEditManualCommand(context);

    registerAutoCompleteProvider(context);

    registerChatProvider(context);
    registerSendToChatCommand(context);

    registerGenerateCommitMessageCommand(context);

    logMsg("----- collama initialized -----");
    initialized = true;
}

export function deactivate() {
    clearDebounce();
}
