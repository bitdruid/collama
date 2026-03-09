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
 * Registers the webview provider that displays the chat panel.
 *
 * @param context - The extension context used to register the provider.
 */
export function registerChatProvider(extContext: vscode.ExtensionContext) {
    const provider: vscode.WebviewViewProvider = {
        resolveWebviewView(webviewView) {
            webviewView.webview.options = {
                enableScripts: true,
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
