import * as vscode from "vscode";

export class StartPage {
    private webview: vscode.Webview;
    private bundleUri: vscode.Uri;

    constructor(extContext: vscode.ExtensionContext, webviewView: vscode.WebviewView) {
        this.webview = webviewView.webview;

        this.bundleUri = this.webview.asWebviewUri(
            vscode.Uri.joinPath(extContext.extensionUri, "dist", "chatpanel.js"),
        );
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
                    :root {
                        --theme-tint: 1;
                        --theme-flat: 0;
                    }
                    body.vscode-light,
                    body.vscode-high-contrast-light {
                        --theme-tint: -1;
                    }

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
                    <collama-chatcontainer></collama-chatcontainer>
                </div>
            </body>
        </html>
    `;
    }
}
