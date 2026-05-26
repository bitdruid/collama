import * as vscode from "vscode";

import path from "path";

import { EditorContext } from "../../common/context-editor";
import { logMsg } from "../../logging";

/**
 * Searches workspace files and folders matching the query and sends results to the webview.
 *
 * @param msg - The message object containing the search query
 * @param msg.query - The search string to match against file and folder names
 * @param webview - The webview to send the search results to
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
            const relativePath = workspaceRoot ? path.relative(workspaceRoot, fullPath) : fullPath;
            const fileName = path.basename(fullPath);
            return { fileName, relativePath, isFolder: false };
        });

        // Also search for matching folders
        const folderUris = await vscode.workspace.findFiles(`${pattern}/**/*`, excludePattern, 50);
        const seenFolders = new Set<string>();
        const sep = path.sep;
        for (const uri of folderUris) {
            const parts = uri.fsPath.split(sep);
            // Walk up the path to find folders matching the query
            for (let i = parts.length - 2; i >= 0; i--) {
                if (parts[i].toLowerCase().includes(query.toLowerCase())) {
                    const folderPath = parts.slice(0, i + 1).join(sep);
                    if (!seenFolders.has(folderPath) && folderPath !== workspaceRoot) {
                        seenFolders.add(folderPath);
                        const relativePath = workspaceRoot ? path.relative(workspaceRoot, folderPath) : folderPath;
                        results.unshift({
                            fileName: parts[i],
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
 * Loads context from a URI and sends it to the webview.
 *
 * @param uri - The URI to load context from
 * @param webview - The webview to send the loaded context to
 */
export async function handleContextAdd(uri: vscode.Uri, webview: vscode.Webview) {
    const ctx = await new EditorContext().loadUri(uri);
    if (ctx) {
        webview.postMessage({ type: "context-update", context: ctx.toWebviewPayload() });
    }
}

let webviewReady = false;
const pendingContextAdds: vscode.Uri[] = [];

/**
 * Marks the webview as ready or not ready and flushes pending context adds when becoming ready.
 *
 * @param ready - Whether the webview is ready to receive messages
 * @param webview - The webview instance
 */
export async function setContextWebviewReady(ready: boolean, webview: vscode.Webview) {
    webviewReady = ready;
    if (!ready) {
        return;
    }
    const pending = pendingContextAdds.splice(0);
    for (const uri of pending) {
        await handleContextAdd(uri, webview);
    }
}

/**
 * Adds a URI as attached context. Queues the URI until the webview is ready.
 *
 * @param uri - The URI to add as context
 * @param webview - The webview to send the context to
 */
export async function addContext(uri: vscode.Uri, webview: vscode.Webview) {
    if (!webviewReady) {
        pendingContextAdds.push(uri);
        return;
    }
    await handleContextAdd(uri, webview);
}

/**
 * Routes the `collama.sendToChat` command:
 * - Explorer multi-select: attach each selected URI as its own context.
 * - Single non-active URI: attach that file/folder as context.
 * - Active editor: attach the current selection (or full file) as context.
 *
 * @param webview - The webview to send the context to
 * @param resource - Optional URI from the explorer (single selection)
 * @param selectedResources - Optional array of URIs from multi-select in explorer
 */
export async function handleSendToChat(
    webview: vscode.Webview,
    resource?: vscode.Uri,
    selectedResources?: vscode.Uri[],
) {
    if (selectedResources && selectedResources.length > 0) {
        const unique = [...new Map(selectedResources.map((u) => [u.toString(), u])).values()];
        logMsg(`Explorer: SendToChat triggered (${unique.length} item(s))`);
        for (const uri of unique) {
            await addContext(uri, webview);
        }
        return;
    }

    const activeUri = vscode.window.activeTextEditor?.document.uri.toString();
    if (resource && resource.toString() !== activeUri) {
        logMsg("Explorer: SendToChat triggered (single resource)");
        await addContext(resource, webview);
        return;
    }

    const ctx = await new EditorContext().loadActiveEditor();
    if (!ctx) {
        return;
    }
    logMsg("Edit (Selection): SendToChat triggered");
    webview.postMessage({ type: "context-update", context: ctx.toWebviewPayload() });
}
