import fs from "fs";
import path from "path";
import * as vscode from "vscode";
import { getWebview } from "../../chat/utils-back";
import { logAgent, logMsg } from "../../logging";
import { secureWorkspace } from "../tools";

// -- Tool confirmation via webview --

const _pending = new Map<string, (result: { value: string | null; reason: string }) => void>();
let _idCounter = 0;

/** Resolves a pending tool confirmation. Called when the webview responds. */
export function resolveToolConfirm(id: string, value: string, reason: string): void {
    const resolve = _pending.get(id);
    if (resolve) {
        _pending.delete(id);
        resolve(value === "cancel" ? { value: null, reason } : { value, reason });
    }
}

/** Sends a confirmation request to the webview and awaits the user's response. */
export function requestToolConfirm(
    action: string,
    filePath: string,
): Promise<{ value: string | null; reason: string }> {
    const webview = getWebview();
    if (!webview) {
        return Promise.resolve({ value: "accept", reason: "No webview available" });
    }
    const id = String(++_idCounter);
    return new Promise((resolve) => {
        _pending.set(id, resolve);
        webview.postMessage({ type: "tool-confirm-request", id, action, filePath });
    });
}

// -- Auto-accept flags --

/**
 * When true, edit applies changes without showing a diff preview.
 * Set by the "Accept All" quick-pick option; reset per agent session.
 */
let autoAcceptEdits = false;

/**
 * When true, create_exec creates files without showing a preview.
 * Set by the "Create All" quick-pick option; reset per agent session.
 */
let autoAcceptFileCreates = false;

/**
 * When true, create_exec creates folders without confirmation.
 * Set by the "Create All" quick-pick option; reset per agent session.
 */
let autoAcceptFolderCreates = false;

/**
 * When true, delete_exec deletes files without confirmation.
 * Set by the "Delete All" quick-pick option; reset per agent session.
 */
let autoAcceptDeletes = false;

/**
 * When true, the frontend toggle is active and resetAutoAcceptEdits
 * should not clear the flags.
 */
let frontendAutoAcceptActive = false;

/**
 * Sets all auto-accept flags at once. Called by the frontend
 * "auto-accept all" toggle button.
 */
export function setAutoAcceptAll(enabled: boolean): void {
    frontendAutoAcceptActive = enabled;
    autoAcceptEdits = enabled;
    autoAcceptFileCreates = enabled;
    autoAcceptFolderCreates = enabled;
    autoAcceptDeletes = enabled;
}

/**
 * Resets the per-session auto-accept flags (from quick-pick bulk actions).
 * Skips reset when the frontend toggle is active.
 */
export function resetAutoAcceptEdits(): void {
    if (frontendAutoAcceptActive) {
        return;
    }
    autoAcceptEdits = false;
    autoAcceptFileCreates = false;
    autoAcceptFolderCreates = false;
    autoAcceptDeletes = false;
}

/**
 * Virtual document provider for diff previews.
 */
class DiffContentProvider implements vscode.TextDocumentContentProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    onDidChange = this._onDidChange.event;

    private contents = new Map<string, string>();

    set(uri: vscode.Uri, content: string) {
        this.contents.set(uri.toString(), content);
        this._onDidChange.fire(uri);
    }

    provideTextDocumentContent(uri: vscode.Uri): string {
        return this.contents.get(uri.toString()) ?? "";
    }
}

/**
 * Helper function to get file extension from path
 */
function getFileExtension(filePath: string): string {
    const ext = filePath.split(".").pop();
    return ext ? `.${ext}` : "";
}

/**
 * Helper function to apply file changes
 */
async function applyFileChanges(uri: vscode.Uri, newContent: string): Promise<void> {
    const edit = new vscode.WorkspaceEdit();
    const entireRange = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(Number.MAX_VALUE, Number.MAX_VALUE),
    );
    edit.replace(uri, entireRange, newContent);
    await vscode.workspace.applyEdit(edit);

    // Save to disk so subsequent reads and git see the changes
    const doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
    if (doc) {
        await doc.save();
    }
}

/**
 * Shows a preview of file changes and asks for user confirmation.
 * Edit mode (originalContent provided): opens a diff view with Accept/Accept All.
 * Create mode (no originalContent): opens a single preview with Create/Create All.
 */
async function handleChanges(
    filePath: string,
    newContent: string,
    options: {
        /** Present → edit/diff mode. Absent → create mode. */
        originalContent?: string;
        title?: string;
        progressMessage?: string;
    } = {},
): Promise<{ success: boolean; message: string }> {
    const isEdit = options.originalContent !== undefined;
    const {
        title = isEdit ? "collama – Preview Changes" : "collama – Preview New File",
        progressMessage = isEdit ? "collama: Processing changes…" : "collama: Creating file…",
    } = options;

    return await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Window, title: progressMessage, cancellable: false },
        async () => {
            if (isEdit && newContent === options.originalContent) {
                return { success: false, message: "No changes to apply." };
            }

            const id = Date.now();
            const ext = getFileExtension(filePath);
            const uri = vscode.Uri.file(filePath);
            const scheme = isEdit ? "collama-diff" : "collama-preview";
            const provider = new DiffContentProvider();
            const registration = vscode.workspace.registerTextDocumentContentProvider(scheme, provider);

            const previewUri = vscode.Uri.parse(`${scheme}:${id}-modified${ext}`);
            const originalUri = isEdit ? vscode.Uri.parse(`${scheme}:${id}-original${ext}`) : undefined;

            try {
                provider.set(previewUri, newContent);

                if (isEdit && originalUri) {
                    provider.set(originalUri, options.originalContent!);
                    await vscode.commands.executeCommand("vscode.diff", originalUri, previewUri, title);
                } else {
                    await vscode.commands.executeCommand("vscode.openWith", previewUri, "default");
                }

                const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
                const relativePath = workspaceFolder ? path.relative(workspaceFolder.uri.fsPath, filePath) : filePath;

                const action = isEdit ? "edit" : "create";
                const { value, reason } = await requestToolConfirm(action, relativePath);

                if (!value) {
                    return {
                        success: false,
                        message: reason,
                    };
                }

                let success = false;
                let message = "";

                if (isEdit) {
                    await applyFileChanges(uri, newContent);
                    message = "Changes applied.";
                    if (value === "acceptAll") {
                        autoAcceptEdits = true;
                        message = "Changes applied. Auto-accepting future edits.";
                    }
                } else {
                    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(newContent));
                    message = "File created.";
                    if (value === "acceptAll") {
                        autoAcceptFileCreates = true;
                        message = "File created. Auto-creating future files.";
                    }
                }
                success = true;

                const activeUri = vscode.window.activeTextEditor?.document.uri.toString();
                if (activeUri === previewUri.toString() || activeUri === originalUri?.toString()) {
                    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
                }

                return { success, message };
            } finally {
                registration.dispose();
            }
        },
    );
}

/**
 * Edits a file by replacing an exact string match with new content.
 * Shows a diff preview and asks for user confirmation before applying.
 *
 * @param args.filePath - Relative path to the file to edit.
 * @param args.oldString - The exact string to find in the file (must match uniquely).
 * @param args.newString - The replacement string.
 */
export async function edit_exec(args: { filePath: string; oldString: string; newString: string }): Promise<string> {
    logMsg(`Agent - use edit-tool file=${args.filePath}`);

    const ws = secureWorkspace(args.filePath, "edit");
    if (ws.error) {
        return ws.error;
    }

    try {
        const content = readFileContent(ws.fullPath);
        let newContent: string;

        if (content === "" && args.oldString === "") {
            // Insert into an empty file
            if (!args.newString) {
                logAgent(`[edit-tool] newString must not be empty when inserting into an empty file: ${args.filePath}`);
                return JSON.stringify({ error: "newString must not be empty when inserting into an empty file." });
            }
            newContent = args.newString;
        } else {
            // Validate that oldString exists and is unique
            const firstIndex = content.indexOf(args.oldString);
            if (firstIndex === -1) {
                logAgent(`[edit-tool] oldString not found in file: ${args.filePath}`);
                return JSON.stringify({
                    error: "oldString not found in file. Make sure it matches the file content exactly, including whitespace and indentation.",
                    filePath: args.filePath,
                });
            }

            const secondIndex = content.indexOf(args.oldString, firstIndex + 1);
            if (secondIndex !== -1) {
                logAgent(`[edit-tool] oldString matches multiple locations in file: ${args.filePath}`);
                return JSON.stringify({
                    error: "oldString matches multiple locations. Provide a larger unique snippet with more surrounding context.",
                    filePath: args.filePath,
                });
            }

            if (args.oldString === args.newString) {
                logAgent(`[edit-tool] oldString and newString are identical: ${args.filePath}`);
                return JSON.stringify({ error: "oldString and newString are identical. No changes to apply." });
            }

            newContent = content.replace(args.oldString, args.newString);
        }

        // Auto-accept: apply without diff preview
        if (autoAcceptEdits) {
            await applyFileChanges(vscode.Uri.file(ws.fullPath), newContent);
            return JSON.stringify({
                success: true,
                message: "Changes applied (auto-accepted).",
                filePath: args.filePath,
            });
        }

        const result = await handleChanges(ws.fullPath, newContent, {
            originalContent: content,
            title: `collama – Edit: ${args.filePath}`,
            progressMessage: `collama: Editing ${args.filePath}…`,
        });

        return JSON.stringify({
            success: result.success,
            message: result.message,
            filePath: args.filePath,
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logAgent(`[edit-tool] Failed to edit file: ${args.filePath} - ${msg}`);
        logMsg(`Agent - edit-tool error: ${msg}`);
        return JSON.stringify({ error: `Failed to edit file: ${msg}` });
    }
}

export const edit_prompt = "edit tool: Edit a file by replacing exact string matches.";
export const edit_def = {
    type: "function" as const,
    function: {
        name: "edit",
        description:
            "Edit a file by replacing exact string matches. The oldString must match a string to replace in the filePath file. To add content to an empty file, set oldString to an empty string.",
        parameters: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "Path to the file to edit (relative to workspace root).",
                },
                oldString: {
                    type: "string",
                    description:
                        "The exact string to find and replace. Include enough surrounding context to be unique.",
                },
                newString: {
                    type: "string",
                    description: "The replacement string.",
                },
            },
            required: ["filePath", "oldString", "newString"],
        },
    },
};

/**
 * Creates a file or folder in the workspace with user confirmation.
 * If `content` is provided, creates a file (with preview). Otherwise creates a folder.
 *
 * @param args.filePath - Relative path to the file or folder to create.
 * @param args.content - File content. If omitted, creates a folder instead.
 */
export async function create_exec(args: { filePath: string; content?: string }): Promise<string> {
    const isFolder = args.content === undefined;
    logMsg(`Agent - use create-tool ${isFolder ? "folder" : "file"}=${args.filePath}`);

    const ws = secureWorkspace(args.filePath, "create");
    if (ws.error) {
        return ws.error;
    }

    try {
        // Check if path already exists
        try {
            const stat = await vscode.workspace.fs.stat(vscode.Uri.file(ws.fullPath));
            if (stat.type === vscode.FileType.Directory) {
                logAgent(`[create-tool] Folder already exists: ${args.filePath}`);
                return JSON.stringify({ error: `Folder already exists: ${args.filePath}` });
            }
            logAgent(`[create-tool] File already exists: ${args.filePath}`);
            return JSON.stringify({ error: `File already exists: ${args.filePath}` });
        } catch {
            // Doesn't exist, which is what we want
        }

        if (isFolder) {
            // Auto-accept: create folder without confirmation
            if (autoAcceptFolderCreates) {
                await vscode.workspace.fs.createDirectory(vscode.Uri.file(ws.fullPath));
                return JSON.stringify({
                    success: true,
                    message: "Folder created (auto-created).",
                    filePath: args.filePath,
                });
            }

            const { value, reason } = await requestToolConfirm("create folder", args.filePath);

            if (!value) {
                return JSON.stringify({
                    success: false,
                    message: reason,
                    filePath: args.filePath,
                });
            }

            await vscode.workspace.fs.createDirectory(vscode.Uri.file(ws.fullPath));

            if (value === "acceptAll") {
                autoAcceptFolderCreates = true;
                return JSON.stringify({
                    success: true,
                    message: "Folder created. Auto-creating future folders.",
                    filePath: args.filePath,
                });
            }

            return JSON.stringify({ success: true, message: "Folder created.", filePath: args.filePath });
        }

        // Auto-accept: create without preview
        if (autoAcceptFileCreates) {
            const encoder = new TextEncoder();
            await vscode.workspace.fs.writeFile(vscode.Uri.file(ws.fullPath), encoder.encode(args.content!));
            return JSON.stringify({
                success: true,
                message: "File created (auto-created).",
                filePath: args.filePath,
            });
        }

        // Create file with preview
        const result = await handleChanges(ws.fullPath, args.content!, {
            title: `collama – New File: ${args.filePath}`,
            progressMessage: `collama: Creating ${args.filePath}…`,
        });

        return JSON.stringify({
            success: result.success,
            message: result.message,
            filePath: args.filePath,
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logAgent(`[create] Failed to create ${isFolder ? "folder" : "file"}: ${args.filePath} - ${msg}`);
        logMsg(`Agent - create error: ${msg}`);
        return JSON.stringify({ error: `Failed to create ${isFolder ? "folder" : "file"}: ${msg}` });
    }
}

export const create_prompt = "create tool: Create a new file or folder.";
export const create_def = {
    type: "function" as const,
    function: {
        name: "create",
        description:
            "Create a new file or folder. With content: creates a file (shows preview, asks confirmation). Without content: creates a folder (asks confirmation).",
        parameters: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "Path to the new file or folder (relative to workspace root).",
                },
                content: {
                    type: "string",
                    description: "File content. Omit to create a folder instead.",
                },
            },
            required: ["filePath"],
        },
    },
};

/**
 * Deletes a file or folder from the workspace after user confirmation.
 *
 * @param args.filePath - Relative path to the file or folder to delete.
 */
export async function delete_exec(args: { filePath: string }): Promise<string> {
    logMsg(`Agent - use delete-tool file=${args.filePath}`);

    const ws = secureWorkspace(args.filePath, "delete");
    if (ws.error) {
        return ws.error;
    }

    try {
        const uri = vscode.Uri.file(ws.fullPath);

        // Verify the file/folder exists
        try {
            await vscode.workspace.fs.stat(uri);
        } catch {
            logAgent(`[delete-tool] File/folder not found: ${args.filePath}`);
            return JSON.stringify({ error: `File/folder not found: ${args.filePath}` });
        }

        // Auto-accept: delete without confirmation
        if (autoAcceptDeletes) {
            await vscode.workspace.fs.delete(uri);
            return JSON.stringify({
                success: true,
                message: "File/folder deleted (auto-deleted).",
                filePath: args.filePath,
            });
        }

        // Calculate relative path from workspace root for display
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        const relativePath = workspaceFolder ? path.relative(workspaceFolder.uri.fsPath, ws.fullPath) : ws.fullPath;

        const { value, reason } = await requestToolConfirm("delete", relativePath);

        if (!value) {
            return JSON.stringify({
                success: false,
                message: reason,
                filePath: args.filePath,
            });
        }

        await vscode.workspace.fs.delete(uri);

        if (value === "acceptAll") {
            autoAcceptDeletes = true;
            return JSON.stringify({
                success: true,
                message: "File/folder deleted. Auto-deleting future files.",
                filePath: args.filePath,
            });
        }

        return JSON.stringify({ success: true, message: "File/folder deleted.", filePath: args.filePath });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logAgent(`[delete-tool] Failed to delete file/folder: ${args.filePath} - ${msg}`);
        logMsg(`Agent - delete-tool error: ${msg}`);
        return JSON.stringify({ error: `Failed to delete file/folder: ${msg}` });
    }
}

export const delete_prompt = "delete tool: Delete a file or folder from the workspace.";
export const delete_def = {
    type: "function" as const,
    function: {
        name: "delete",
        description: "Delete a file or folder from the workspace. Asks for user confirmation before deleting.",
        parameters: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "Path to the file or folder to delete (relative to workspace root).",
                },
            },
            required: ["filePath"],
        },
    },
};

/** Reads file content from disk (consistent with read tool). */
function readFileContent(fullPath: string): string {
    return fs.readFileSync(fullPath, "utf-8");
}
