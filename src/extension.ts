import * as vscode from "vscode";

import { clearDebounce, registerAutoCompleteProvider } from "./autocomplete/subscriptions";
import { registerChatProvider, registerSendToChatCommand } from "./chat/subscriptions";
import { registerRequestCommitMessageCommand } from "./commit/subscriptions";
import { initTokenizer } from "./common/tokenizer";
import { registerConfigAutoUpdateCommand, updateVSConfig } from "./config";
import {
    registerEditManualCommand,
    registerExtractFunctionsCommand,
    registerFixSyntaxCommand,
    registerSimplifyCommand,
    registerWriteDocstringsCommand,
} from "./context/subscriptions";
import { logMsg } from "./logging";
import { initSecrets, registerSetBearerCompletionCommand, registerSetBearerInstructCommand } from "./secrets";
import { setStatusbar } from "./statusbar";

/**
 *
 * ENTRYPOINT for the extension
 */
export async function activate(extContext: vscode.ExtensionContext) {
    // init tokenizer at startup to prevent delays in chat
    initTokenizer();

    // init secrets and bearer commands
    initSecrets(extContext);
    registerSetBearerCompletionCommand(extContext);
    registerSetBearerInstructCommand(extContext);

    await updateVSConfig();
    registerConfigAutoUpdateCommand(extContext);

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
}

export function deactivate() {
    clearDebounce();
}
