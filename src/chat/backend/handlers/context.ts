import * as vscode from "vscode";

import path from "path";

import { EditorContext } from "../../../common/context-editor";
import { userConfig } from "../../../config";
import { logMsg } from "../../../logging";
import { estTokens, EXTENSION_HARD_TOKEN_CAP } from "../../../common/utils";

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

/**
 * Chat-only mode embeds file content into the message, so oversized files are rejected before
 * being read — token count is estimated from byte size (~4 bytes/token) to avoid loading and
 * tokenizing huge files (UI freeze). Returns the estimate when over the cap, otherwise null.
 * Agent mode attaches a path reference only and is never capped.
 */
async function fileExceedsContextCap(uri: vscode.Uri): Promise<number | null> {
    if (userConfig.agenticMode) {
        return null;
    }
    try {
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.type !== vscode.FileType.File) {
            return null;
        }
        const approxTokens = estTokens(stat.size);
        return approxTokens > EXTENSION_HARD_TOKEN_CAP ? approxTokens : null;
    } catch (err) {
        logMsg(`Failed to stat context URI ${uri.toString()}: ${err}`);
        return null;
    }
}

/** Native warning shown when a send-to-chat file is too large for chat-only mode. */
function warnContextTooLarge(uri: vscode.Uri, estTokens: number): void {
    vscode.window.showWarningMessage(
        `collama: "${path.basename(uri.fsPath)}" is too large to attach (~${estTokens} tokens, max ${EXTENSION_HARD_TOKEN_CAP}). Enable agent mode to let the model read it itself.`,
    );
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
            const estTokens = await fileExceedsContextCap(uri);
            if (estTokens !== null) {
                warnContextTooLarge(uri, estTokens);
                continue;
            }
            await addContext(uri, webview);
        }
        return;
    }

    const activeUri = vscode.window.activeTextEditor?.document.uri.toString();
    if (resource && resource.toString() !== activeUri) {
        const estTokens = await fileExceedsContextCap(resource);
        if (estTokens !== null) {
            warnContextTooLarge(resource, estTokens);
            return;
        }
        logMsg("Explorer: SendToChat triggered (single resource)");
        await addContext(resource, webview);
        return;
    }

    const ctx = await new EditorContext().loadActiveEditor();
    if (!ctx) {
        return;
    }
    const payload = ctx.toWebviewPayload();
    const approxTokens = !userConfig.agenticMode ? estTokens(payload.content.length) : 0;
    if (approxTokens > EXTENSION_HARD_TOKEN_CAP) {
        warnContextTooLarge(ctx.uri, approxTokens);
        return;
    }
    logMsg("Edit (Selection): SendToChat triggered");
    webview.postMessage({ type: "context-update", context: payload });
}
