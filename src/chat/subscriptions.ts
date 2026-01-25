import * as vscode from "vscode";
import { StartPage } from "./web/components/chat_start";

export function registerChatProvider(context: vscode.ExtensionContext) {
    const provider: vscode.WebviewViewProvider = {
        resolveWebviewView(webviewView: vscode.WebviewView) {
            webviewView.webview.options = {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "src", "resources")],
            };
            webviewView.webview.html = renderView(context, webviewView);
        },
    };

    context.subscriptions.push(vscode.window.registerWebviewViewProvider("collama_chatview", provider));
}

function renderView(context: vscode.ExtensionContext, webviewView: vscode.WebviewView) {
    const chatview = new StartPage(context, webviewView);
    return chatview.generate();
}
