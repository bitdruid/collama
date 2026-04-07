import * as vscode from "vscode";

import { EditorContext } from "../common/context-editor";
import { logMsg } from "../logging";
import { ChatPanel } from "./chatpanel";

let panel: ChatPanel | null = null;

/**
 * Registers the command that sends the current selection to the chat view.
 *
 * @param context - The extension context used to register the command.
 */
export function registerSendToChatCommand(extContext: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand("collama.sendToChat", async () => {
        if (panel) {
            logMsg("Edit (Selection): SendToChat triggered");
            await vscode.commands.executeCommand("workbench.view.extension.collama_chat");
            const currentContext = await EditorContext.create();
            if (currentContext) {
                panel.receiveCurrentContext(currentContext);
            }
        }
    });
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
