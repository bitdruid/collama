import * as vscode from "vscode";

export class StartPage {
    private webviewView: vscode.WebviewView;
    private webview: vscode.Webview;
    private logoUri: vscode.Uri;
    private bundleUri: vscode.Uri;

    constructor(context: vscode.ExtensionContext, webviewView: vscode.WebviewView) {
        this.webviewView = webviewView;

        this.webview = webviewView.webview;

        this.logoUri = this.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "collama.svg"));
        this.bundleUri = this.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "dist", "chatpanel.js"));
    }

    generate(): string {
        return /*html*/ `
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <script>
                    window.vscode = acquireVsCodeApi();
                </script>
                <script type="module" src="${this.bundleUri}"></script>
                <style>
                    html, body {
                        height: 100%;
                        margin: 0;
                        padding: 0;
                    }

                    .container {
                        display: flex;
                        flex-direction: column;
                        height: 100%;
                        padding: 10px;
                        box-sizing: border-box;
                    }

                    .header {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        margin-bottom: 8px;
                    }

                    .header img {
                        width: 32px;
                        height: 32px;
                    }

                    .header-title {
                        font-size: 14px;
                        font-weight: bold;
                        color: var(--vscode-foreground);
                    }

                    collama-chatcontainer {
                        flex: 1 1 auto;
                        display: flex;
                        flex-direction: column;
                        min-height: 0;
                    }

                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <img src="${this.logoUri.toString()}" />
                        <span class="header-title">collama chat</span>
                    </div>
                    <collama-chatcontainer></collama-chatcontainer>
                </div>
            </body>
        </html>
    `;
    }
}
