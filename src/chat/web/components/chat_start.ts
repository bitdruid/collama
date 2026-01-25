import * as vscode from "vscode";

export class StartPage {
    private webviewView: vscode.WebviewView;
    private logoUri: vscode.Uri;

    constructor(context: vscode.ExtensionContext, webviewView: vscode.WebviewView) {
        this.webviewView = webviewView;
        this.logoUri = this.webviewView.webview.asWebviewUri(
            vscode.Uri.joinPath(context.extensionUri, "src", "resources", "collama.svg"),
        );
    }

    generate(): string {
        return /*html*/ `
            <!DOCTYPE html>
            <html lang="en">
                <head>
                    <meta charset="UTF-8" />
                    <style>
                        body {
                            font-family: sans-serif;
                            padding: 16px;
                        }
                        .container {
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                        }
                    </style>
                </head>
                <body>
                    <div class="container" style="align-content: center">
                        <img src="${this.logoUri.toString()}" width="256" height="256" />
                        <h1>Under Construction</h1>
                    </div>
                    <div class="container" style="align-content: center">
                        <chatwindow></chatwindow>
                    </div>
                </body>
            </html>
        `;
    }
}
