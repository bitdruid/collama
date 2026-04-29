import * as vscode from "vscode";

import { EditorContext } from "../common/context-editor";
import { openAgentsMdDraft } from "../common/agents-md";
import { logMsg } from "../logging";
import { ChatPanel } from "./chatpanel";
import { receiveCurrentContext } from "./handlers/context-handlers";

let panel: ChatPanel | null = null;

async function revealChatPanel(): Promise<ChatPanel | null> {
    await vscode.commands.executeCommand("workbench.view.extension.collama_chat");
    if (!panel) {
        logMsg("SendToChat ignored: chat panel is not available");
    }
    return panel;
}

function getExplorerUris(resource?: vscode.Uri, selectedResources?: vscode.Uri[]): vscode.Uri[] {
    const uris = selectedResources?.length ? selectedResources : resource ? [resource] : [];
    const unique = new Map<string, vscode.Uri>();
    for (const uri of uris) {
        unique.set(uri.toString(), uri);
    }
    return [...unique.values()];
}

/**
 * Registers the command that sends the current selection to the chat view.
 *
 * @param context - The extension context used to register the command.
 */
export function registerSendToChatCommand(extContext: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand(
        "collama.sendToChat",
        async (resource?: vscode.Uri, selectedResources?: vscode.Uri[]) => {
            const chatPanel = await revealChatPanel();
            if (!chatPanel) {
                return;
            }

            const explorerUris = getExplorerUris(resource, selectedResources);
            if (explorerUris.length > 0) {
                logMsg(`Explorer: SendToChat triggered (${explorerUris.length} item(s))`);
                for (const uri of explorerUris) {
                    await chatPanel.addContext(uri.toString());
                }
                return;
            }

            logMsg("Edit (Selection): SendToChat triggered");
            const currentContext = await EditorContext.create();
            if (currentContext) {
                receiveCurrentContext(chatPanel.webview, currentContext);
            }
        },
    );
    extContext.subscriptions.push(disposable);
}

/**
 * Registers the command which opens a file referenced from the chat webview.
 *
 * Relative paths are resolved against the first workspace folder; absolute paths are used as-is.
 * Resolving host-side avoids cross-platform paths in command URI args.
 *
 * @param extContext - The extension context used to register the command.
 */
export function registerOpenFileCommand(extContext: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand("collama.openFile", async (filePath: string, line?: number) => {
        if (!filePath) {
            return;
        }
        const root = vscode.workspace.workspaceFolders?.[0]?.uri;
        const isAbs = filePath.startsWith("/") || /^[a-zA-Z]:/.test(filePath);
        const uri = isAbs || !root ? vscode.Uri.file(filePath) : vscode.Uri.joinPath(root, filePath);
        const options: vscode.TextDocumentShowOptions = {};
        if (typeof line === "number" && line >= 0) {
            const pos = new vscode.Position(line, 0);
            options.selection = new vscode.Range(pos, pos);
        }
        try {
            await vscode.window.showTextDocument(uri, options);
        } catch (err) {
            logMsg(`collama.openFile: failed to open ${filePath}: ${(err as Error).message}`);
        }
    });
    extContext.subscriptions.push(disposable);
}

/** Registers the command which opens an unsaved workspace-root AGENTS.md draft. */
export function registerCreateAgentsMdDraftCommand(extContext: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand("collama.createAgentsMdDraft", openAgentsMdDraft);
    extContext.subscriptions.push(disposable);
}

/**
 * Registers the webview provider that displays the chat panel.
 *
 * @param context - The extension context used to register the provider.
 */
export function registerChatProvider(extContext: vscode.ExtensionContext) {
    const provider: vscode.WebviewViewProvider = {
        resolveWebviewView(webviewView) {
            webviewView.webview.options = {
                enableScripts: true,
                enableCommandUris: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extContext.extensionUri, "media"),
                    vscode.Uri.joinPath(extContext.extensionUri, "dist"),
                ],
            };
            panel = new ChatPanel(webviewView, extContext);
            panel.renderPanel();
        },
    };
    extContext.subscriptions.push(vscode.window.registerWebviewViewProvider("collama_chatview", provider));
}
