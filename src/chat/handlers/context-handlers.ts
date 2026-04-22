import * as vscode from "vscode";

import { EditorContext, getRelativePath } from "../../common/context-editor";
import { logMsg } from "../../logging";

/**
 * Searches workspace files/folders matching the query and sends results to the webview.
 */
export async function handleContextSearch(msg: { query: string }, webview: vscode.Webview) {
    const query = msg.query?.trim();
    if (!query) {
        webview.postMessage({ type: "context-search-results", results: [] });
        return;
    }

    const pattern = `**/*${query}*`;
    const excludePattern = "**/node_modules/**";

    try {
        const uris = await vscode.workspace.findFiles(pattern, excludePattern, 50);
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";

        const results = uris.map((uri) => {
            const fullPath = uri.fsPath;
            const relativePath = workspaceRoot ? fullPath.replace(workspaceRoot + "/", "") : fullPath;
            const fileName = fullPath.split("/").pop() || fullPath;
            return { fileName, filePath: fullPath, relativePath, isFolder: false };
        });

        // Also search for matching folders
        const folderUris = await vscode.workspace.findFiles(`${pattern}/**/*`, excludePattern, 50);
        const seenFolders = new Set<string>();
        for (const uri of folderUris) {
            const parts = uri.fsPath.split("/");
            // Walk up the path to find folders matching the query
            for (let i = parts.length - 2; i >= 0; i--) {
                if (parts[i].toLowerCase().includes(query.toLowerCase())) {
                    const folderPath = parts.slice(0, i + 1).join("/");
                    if (!seenFolders.has(folderPath) && folderPath !== workspaceRoot) {
                        seenFolders.add(folderPath);
                        const relativePath = workspaceRoot ? folderPath.replace(workspaceRoot + "/", "") : folderPath;
                        results.unshift({
                            fileName: parts[i],
                            filePath: folderPath,
                            relativePath,
                            isFolder: true,
                        });
                    }
                    break;
                }
            }
        }

        webview.postMessage({ type: "context-search-results", results: results.slice(0, 50) });
    } catch {
        webview.postMessage({ type: "context-search-results", results: [] });
    }
}

/**
 * Reads a file or folder and sends it as an attached context to the webview.
 */
export async function handleContextAddFile(msg: { filePath: string; isFolder: boolean }, webview: vscode.Webview) {
    const { filePath, isFolder } = msg;

    try {
        const uri = vscode.Uri.file(filePath);
        const fileName = filePath.split("/").pop() || filePath;
        const relativePath = getRelativePath(uri);

        if (isFolder) {
            // For folders, list the directory contents as the context
            const entries = await vscode.workspace.fs.readDirectory(uri);
            const listing = entries
                .map(([name, type]) => {
                    const prefix = type === vscode.FileType.Directory ? "[dir]  " : "       ";
                    return `${prefix}${name}`;
                })
                .join("\n");

            webview.postMessage({
                type: "context-update",
                context: {
                    fileName: fileName + "/",
                    filePath,
                    relativePath: relativePath + "/",
                    isFolder: true,
                    hasSelection: false,
                    startLine: 0,
                    endLine: 0,
                    content: listing,
                },
            });
            return;
        }

        const contentBytes = await vscode.workspace.fs.readFile(uri);
        const content = Buffer.from(contentBytes).toString("utf8");

        webview.postMessage({
            type: "context-update",
            context: {
                fileName,
                filePath,
                relativePath,
                isFolder: false,
                hasSelection: false,
                startLine: 0,
                endLine: 0,
                content,
            },
        });
    } catch (err) {
        logMsg(`Failed to read context file: ${filePath} - ${err}`);
    }
}

/**
 * Sends the current editor context to the webview.
 */
export function receiveCurrentContext(webview: vscode.Webview, currentContext: EditorContext) {
    const hasSelection = currentContext.selectionText.length > 0;
    const startLine = currentContext.selectionStartLine + 1; // 1-based
    const endLine = currentContext.selectionEndLine + 1;

    webview.postMessage({
        type: "context-update",
        context: {
            fileName: currentContext.fileName,
            filePath: currentContext.filePath,
            relativePath: currentContext.relativePath,
            isFolder: currentContext.isFolder,
            hasSelection,
            startLine,
            endLine,
            content: hasSelection ? currentContext.selectionText : currentContext.activeFileText,
        },
    });
}
