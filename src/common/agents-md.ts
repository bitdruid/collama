import * as vscode from "vscode";
import { broadcastUserConfig } from "../config";
import { logMsg } from "../logging";

const AGENTS_MD_TEMPLATE = `# AGENTS.md

## Project Structure and Logic
- 

## Do
-

## Don't
-

## Coding Style
- 

## Testing
- 
`;

let cachedContent: string | null = null;
let fileWatcher: vscode.FileSystemWatcher | null = null;

function getWorkspaceRoot(): vscode.WorkspaceFolder | undefined {
    return vscode.workspace.workspaceFolders?.[0];
}

function clearAgentsMdCache(): void {
    cachedContent = null;
}

/**
 * Returns the workspace-root AGENTS.md URI.
 * Returns null if no workspace is open.
 */
export function findAgentsMd(): vscode.Uri | null {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        return null;
    }

    return vscode.Uri.joinPath(workspaceRoot.uri, "AGENTS.md");
}

/**
 * Reads and caches the AGENTS.md content.
 * Returns null if no AGENTS.md exists or can't be read.
 */
export async function loadAgentsMdContent(): Promise<string | null> {
    const uri = findAgentsMd();
    if (!uri) {
        clearAgentsMdCache();
        return null;
    }

    try {
        const stat = await vscode.workspace.fs.stat(uri);
        if (!(stat.type & vscode.FileType.File)) {
            clearAgentsMdCache();
            return null;
        }

        const bytes = await vscode.workspace.fs.readFile(uri);
        const content = new TextDecoder("utf-8").decode(bytes).trim();

        cachedContent = content || null;

        logMsg(`AGENTS.md loaded: ${content ? `${content.length} chars` : "empty"}`);
        return cachedContent;
    } catch (err) {
        clearAgentsMdCache();
        if (err instanceof vscode.FileSystemError && err.code === "FileNotFound") {
            return null;
        }

        logMsg(`Failed to read AGENTS.md: ${err}`);
        return null;
    }
}

/**
 * Returns cached AGENTS.md content.
 * Does NOT reload from disk.
 */
export function getAgentsMdContent(): string | null {
    return cachedContent;
}

/**
 * Returns whether workspace-root AGENTS.md is active.
 */
export function isAgentsMdActive(): boolean {
    return cachedContent !== null;
}

/**
 * Opens a workspace-root AGENTS.md draft as an unsaved editor.
 * If AGENTS.md already exists, opens the existing file instead.
 */
export async function openAgentsMdDraft(): Promise<void> {
    const uri = findAgentsMd();
    if (!uri) {
        const doc = await vscode.workspace.openTextDocument({
            language: "markdown",
            content: AGENTS_MD_TEMPLATE,
        });
        await vscode.window.showTextDocument(doc);
        return;
    }

    try {
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.type & vscode.FileType.File) {
            await vscode.window.showTextDocument(uri);
            return;
        }
    } catch (err) {
        if (!(err instanceof vscode.FileSystemError && err.code === "FileNotFound")) {
            logMsg(`Failed to check AGENTS.md before creating draft: ${err}`);
        }
    }

    const doc = await vscode.workspace.openTextDocument(uri.with({ scheme: "untitled" }));
    const editor = await vscode.window.showTextDocument(doc);
    if (doc.getText().length === 0) {
        await editor.edit((edit) => {
            edit.insert(new vscode.Position(0, 0), AGENTS_MD_TEMPLATE);
        });
    }
}

/**
 * Registers AGENTS.md file watching.
 * Re-caches content when the file changes.
 */
export function registerAgentsMdWatcher(extContext: vscode.ExtensionContext): void {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        return;
    }

    const pattern = new vscode.RelativePattern(workspaceRoot, "AGENTS.md");

    fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

    fileWatcher.onDidChange(async () => {
        logMsg("AGENTS.md changed, reloading...");
        await loadAgentsMdContent();
        await broadcastUserConfig();
    });

    fileWatcher.onDidCreate(async () => {
        logMsg("AGENTS.md created, loading...");
        await loadAgentsMdContent();
        await broadcastUserConfig();
    });

    fileWatcher.onDidDelete(async () => {
        logMsg("AGENTS.md deleted");
        clearAgentsMdCache();
        await broadcastUserConfig();
    });

    extContext.subscriptions.push(fileWatcher);
}
