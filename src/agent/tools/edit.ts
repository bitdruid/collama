import path from "path";
import * as vscode from "vscode";
import { withProgressNotification } from "../../common/utils-common";
import { logAgent, logMsg } from "../../logging";
import { secureWorkspace } from "../tools";

/**
 * When true, editFile applies changes without showing a diff preview.
 * Set by the "Accept All" quick-pick option; reset per agent session.
 */
let autoAcceptEdits = false;

/**
 * When true, create_exec creates files without showing a preview.
 * Set by the "Create All" quick-pick option; reset per agent session.
 */
let autoAcceptCreates = false;

/**
 * When true, deleteFile_exec deletes files without confirmation.
 * Set by the "Delete All" quick-pick option; reset per agent session.
 */
let autoAcceptDeletes = false;

/**
 * Resets the auto-accept flags. Call at the start of each agent session.
 */
export function resetAutoAcceptEdits(): void {
    autoAcceptEdits = false;
    autoAcceptCreates = false;
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
 * Shows a QuickPick with the given action items plus a Cancel option.
 * On cancel (or dismiss), prompts for an optional rejection reason.
 * Returns the chosen value, or null with an optional reason on cancel.
 */
async function showActionQuickPick(
    actionPicks: (vscode.QuickPickItem & { value: string })[],
    placeHolder: string,
): Promise<{ value: string | null; reason?: string }> {
    const picks = [...actionPicks, { label: "$(close) Cancel", value: "cancel" }];
    const choice = await vscode.window.showQuickPick(picks, {
        placeHolder,
        canPickMany: false,
        ignoreFocusOut: true,
    });
    if (!choice || choice.value === "cancel") {
        const reason = await vscode.window.showInputBox({
            prompt: "What should the agent do instead? (Sends response to LLM)",
            placeHolder: "Type your instructions here...",
            ignoreFocusOut: true,
        });
        return { value: null, reason: reason || "The user canceled this action." };
    }
    return { value: choice.value };
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
        showBulkAction?: boolean;
    } = {},
): Promise<{ success: boolean; message: string }> {
    const isEdit = options.originalContent !== undefined;
    const {
        title = isEdit ? "collama – Preview Changes" : "collama – Preview New File",
        progressMessage = isEdit ? "collama: Processing changes…" : "collama: Creating file…",
        showBulkAction = false,
    } = options;

    return await withProgressNotification(progressMessage, async () => {
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

            const acceptValue = isEdit ? "accept" : "create";
            const bulkValue = isEdit ? "acceptAll" : "createAll";
            const { value, reason } = await showActionQuickPick(
                [
                    { label: isEdit ? "$(check) Accept" : "$(check) Create", value: acceptValue },
                    ...(showBulkAction
                        ? [{ label: isEdit ? "$(check-all) Accept All" : "$(check-all) Create All", value: bulkValue }]
                        : []),
                ],
                isEdit ? `Apply to: ${relativePath}` : `Create: ${relativePath}`,
            );

            let success = false;
            const action = isEdit ? "Edit" : "File creation";
            let message = `${action} rejected by user. ${reason}`;

            if (value === acceptValue || value === bulkValue) {
                if (isEdit) {
                    await applyFileChanges(uri, newContent);
                    message = "Changes applied.";
                    if (value === bulkValue) {
                        autoAcceptEdits = true;
                        message = "Changes applied. Auto-accepting future edits.";
                    }
                } else {
                    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(newContent));
                    message = "File created.";
                    if (value === bulkValue) {
                        autoAcceptCreates = true;
                        message = "File created. Auto-creating future files.";
                    }
                }
                success = true;
            }

            const activeUri = vscode.window.activeTextEditor?.document.uri.toString();
            if (activeUri === previewUri.toString() || activeUri === originalUri?.toString()) {
                await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
            }

            return { success, message };
        } finally {
            registration.dispose();
        }
    });
}

/**
 * Edits a file by replacing an exact string match with new content.
 * Shows a diff preview and asks for user confirmation before applying.
 *
 * @param args.filePath - Relative path to the file to edit.
 * @param args.oldString - The exact string to find in the file (must match uniquely).
 * @param args.newString - The replacement string.
 */
export async function editFile_exec(args: { filePath: string; oldString: string; newString: string }): Promise<string> {
    logMsg(`Agent - tool use editFile file=${args.filePath}`);

    const ws = secureWorkspace(args.filePath, "editFile");
    if (ws.error) { return ws.error; }

    try {
        const content = await readFileContent(ws.fullPath);
        let newContent: string;

        if (content === "" && args.oldString === "") {
            // Insert into an empty file
            if (!args.newString) {
                logAgent(`[editFile] newString must not be empty when inserting into an empty file: ${args.filePath}`);
                return JSON.stringify({ error: "newString must not be empty when inserting into an empty file." });
            }
            newContent = args.newString;
        } else {
            // Validate that oldString exists and is unique
            const firstIndex = content.indexOf(args.oldString);
            if (firstIndex === -1) {
                logAgent(`[editFile] oldString not found in file: ${args.filePath}`);
                return JSON.stringify({
                    error: "oldString not found in file. Make sure it matches the file content exactly, including whitespace and indentation.",
                    filePath: args.filePath,
                });
            }

            const secondIndex = content.indexOf(args.oldString, firstIndex + 1);
            if (secondIndex !== -1) {
                logAgent(`[editFile] oldString matches multiple locations in file: ${args.filePath}`);
                return JSON.stringify({
                    error: "oldString matches multiple locations. Provide a larger unique snippet with more surrounding context.",
                    filePath: args.filePath,
                });
            }

            if (args.oldString === args.newString) {
                logAgent(`[editFile] oldString and newString are identical: ${args.filePath}`);
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
            showBulkAction: true,
        });

        return JSON.stringify({
            success: result.success,
            message: result.message,
            filePath: args.filePath,
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logAgent(`[editFile] Failed to edit file: ${args.filePath} - ${msg}`);
        logMsg(`Agent - editFile error: ${msg}`);
        return JSON.stringify({ error: `Failed to edit file: ${msg}` });
    }
}

export const editFile_def = {
    type: "function" as const,
    function: {
        name: "editFile",
        description:
            "Edit a file by replacing exact string matches. The oldString must match exactly a string to replace in the filePath file. To add content to an empty file, set oldString to an empty string. Prefered more small changes instead of one big.",
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
                        "The exact string to find and replace. Must match exactly one location in the file. Include enough surrounding context to be unique.",
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
    logMsg(`Agent - tool use create ${isFolder ? "folder" : "file"}=${args.filePath}`);

    const ws = secureWorkspace(args.filePath, "create");
    if (ws.error) { return ws.error; }

    try {
        // Check if path already exists
        try {
            const stat = await vscode.workspace.fs.stat(vscode.Uri.file(ws.fullPath));
            if (stat.type === vscode.FileType.Directory) {
                logAgent(`[create] Folder already exists: ${args.filePath}`);
                return JSON.stringify({ error: `Folder already exists: ${args.filePath}` });
            }
            logAgent(`[create] File already exists: ${args.filePath}`);
            return JSON.stringify({ error: `File already exists: ${args.filePath}` });
        } catch {
            // Doesn't exist, which is what we want
        }

        if (isFolder) {
            const { value, reason } = await showActionQuickPick(
                [{ label: "$(folder-opened) Create", value: "create" }],
                `Create folder: ${args.filePath}`,
            );

            if (!value) {
                return JSON.stringify({ success: false, message: reason, filePath: args.filePath });
            }

            await vscode.workspace.fs.createDirectory(vscode.Uri.file(ws.fullPath));

            return JSON.stringify({ success: true, message: "Folder created.", filePath: args.filePath });
        }

        // Auto-accept: create without preview
        if (autoAcceptCreates) {
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
            showBulkAction: true,
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
 * Deletes a file from the workspace after user confirmation.
 *
 * @param args.filePath - Relative path to the file to delete.
 */
export async function deleteFile_exec(args: { filePath: string }): Promise<string> {
    logMsg(`Agent - tool use deleteFile file=${args.filePath}`);

    const ws = secureWorkspace(args.filePath, "deleteFile");
    if (ws.error) { return ws.error; }

    try {
        const uri = vscode.Uri.file(ws.fullPath);

        // Verify the file exists
        try {
            const stat = await vscode.workspace.fs.stat(uri);
            if (stat.type === vscode.FileType.Directory) {
                logAgent(`[deleteFile] Path is a directory, not a file: ${args.filePath}`);
                return JSON.stringify({ error: `Path is a directory, not a file: ${args.filePath}` });
            }
        } catch {
            logAgent(`[deleteFile] File not found: ${args.filePath}`);
            return JSON.stringify({ error: `File not found: ${args.filePath}` });
        }

        // Auto-accept: delete without confirmation
        if (autoAcceptDeletes) {
            await vscode.workspace.fs.delete(uri);
            return JSON.stringify({
                success: true,
                message: "File deleted (auto-deleted).",
                filePath: args.filePath,
            });
        }

        // Calculate relative path from workspace root for display
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        const relativePath = workspaceFolder ? path.relative(workspaceFolder.uri.fsPath, ws.fullPath) : ws.fullPath;

        const { value, reason } = await showActionQuickPick(
            [
                { label: "$(trash) Delete", value: "delete" },
                { label: "$(warning) Delete All", value: "deleteAll" },
            ],
            `Delete: ${relativePath}`,
        );

        let deleted = false;
        let resultMessage = reason!;

        if (value === "delete" || value === "deleteAll") {
            await vscode.workspace.fs.delete(uri);
            deleted = true;
            resultMessage = "File deleted.";

            if (value === "deleteAll") {
                autoAcceptDeletes = true;
                resultMessage = "File deleted. Auto-deleting future files.";
            }
        }

        return JSON.stringify({ success: deleted, message: resultMessage, filePath: args.filePath });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logAgent(`[deleteFile] Failed to delete file: ${args.filePath} - ${msg}`);
        logMsg(`Agent - deleteFile error: ${msg}`);
        return JSON.stringify({ error: `Failed to delete file: ${msg}` });
    }
}

export const deleteFile_def = {
    type: "function" as const,
    function: {
        name: "deleteFile",
        description: "Delete a file from the workspace. Asks for user confirmation before deleting.",
        parameters: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "Path to the file to delete (relative to workspace root).",
                },
            },
            required: ["filePath"],
        },
    },
};

/**
 * Reads file content, preferring the in-memory document buffer over disk.
 */
async function readFileContent(fullPath: string): Promise<string> {
    const uri = vscode.Uri.file(fullPath);
    const openDoc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
    return openDoc ? openDoc.getText() : Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8");
}
