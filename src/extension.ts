import * as vscode from "vscode";

import { killAllSessions } from "./agent/tools/shell-session";
import { clearDebounce, registerAutoCompleteProvider } from "./autocomplete/subscriptions";
import {
    registerChatProvider,
    registerCreateAgentsMdDraftCommand,
    registerOpenFileCommand,
    registerSendToChatCommand,
} from "./chat/backend/subscriptions";
import { registerRequestCommitMessageCommand } from "./commit/subscriptions";
import { loadAgentsMdContent, registerAgentsMdWatcher } from "./common/agents-md";
import { initMemory, loadWorkspaceMemory, registerMemoryWatcher } from "./common/memory";
import { initTokenizer } from "./common/tokenizer";
import { registerConfigAutoUpdateCommand, updateVSConfig } from "./config";
import {
    registerDiffPreviewCommands,
    registerEditManualCommand,
    registerExtractFunctionsCommand,
    registerFixSyntaxCommand,
    registerSimplifyCommand,
    registerWriteDocstringsCommand,
} from "./actions/subscriptions";
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

    updateVSConfig();
    registerConfigAutoUpdateCommand(extContext);

    await loadAgentsMdContent();
    registerAgentsMdWatcher(extContext);

    initMemory(extContext);
    await loadWorkspaceMemory();
    registerMemoryWatcher(extContext);

    setStatusbar(extContext);

    registerWriteDocstringsCommand(extContext);
    registerExtractFunctionsCommand(extContext);
    registerSimplifyCommand(extContext);
    registerFixSyntaxCommand(extContext);
    registerEditManualCommand(extContext);
    registerDiffPreviewCommands(extContext);

    registerAutoCompleteProvider(extContext);

    registerChatProvider(extContext);
    registerSendToChatCommand(extContext);
    registerOpenFileCommand(extContext);
    registerCreateAgentsMdDraftCommand(extContext);

    registerRequestCommitMessageCommand(extContext);

    logMsg("----- collama initialized -----");
}

export function deactivate() {
    clearDebounce();
    killAllSessions();
}
