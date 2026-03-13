import path from "path";
import * as vscode from "vscode";
import { withProgressNotification } from "../../common/utils-common";
import { logAgent, logMsg } from "../../logging";
import { confirmAction, getWorkspaceRoot, isWithinRoot } from "../tools";

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
 * Generic function to preview and apply file changes with diff view.
 * Always shows the diff preview before applying changes.
 *
 * @param filePath The path to the original file
 * @param newContent The new content to apply
 * @param options Optional configuration
 * @returns Promise that resolves to true if changes were applied, false otherwise
 */
async function handleFileChangesWithDiff(
    filePath: string,
    newContent: string,
    options: {
        diffTitle?: string;
        progressMessage?: string;
        /** When true, offer an "Accept All" choice that sets autoAcceptEdits. */
        showAcceptAll?: boolean;
    } = {},
): Promise<{ success: boolean; message: string }> {
    const {
        diffTitle = "collama – Preview Changes",
        progressMessage = "collama: Processing changes…",
        showAcceptAll = false,
    } = options;

    return await withProgressNotification(progressMessage, async () => {
        // Read the original file content (prefer in-memory buffer for unsaved changes)
        const uri = vscode.Uri.file(filePath);
        const openDoc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
        const originalText = openDoc
            ? openDoc.getText()
            : Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8");

        // Check if there are actual changes
        if (newContent === originalText) {
            return { success: false, message: "No changes to apply." };
        }

        // Create virtual URIs for the diff view
        const id = Date.now();
        const leftUri = vscode.Uri.parse(`collama-diff:${id}-original${getFileExtension(filePath)}`);
        const rightUri = vscode.Uri.parse(`collama-diff:${id}-modified${getFileExtension(filePath)}`);

        // Set up content provider
        const provider = new DiffContentProvider();
        const registration = vscode.workspace.registerTextDocumentContentProvider("collama-diff", provider);

        provider.set(leftUri, originalText);
        provider.set(rightUri, newContent);

        // Open diff view
        await vscode.commands.executeCommand("vscode.diff", leftUri, rightUri, diffTitle);

        // QuickPick menu
        const picks: (vscode.QuickPickItem & { value?: string })[] = [
            {
                label: "$(check) Accept",
                value: "accept",
            },
            ...(showAcceptAll
                ? [
                      {
                          label: "$(check-all) Accept All",
                          value: "acceptAll",
                      },
                  ]
                : []),
            {
                label: "$(close) Cancel",
                value: "cancel",
            },
        ];

        // Calculate relative path from workspace root for display
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        const relativePath = workspaceFolder ? path.relative(workspaceFolder.uri.fsPath, filePath) : filePath;

        const choice = await vscode.window.showQuickPick(picks, {
            placeHolder: `Apply to: ${relativePath}`,
            canPickMany: false,
            ignoreFocusOut: true,
        });

        let applied = false;
        let resultMessage = "Edit rejected by user.";

        if (choice?.value === "accept" || choice?.value === "acceptAll") {
            await applyFileChanges(uri, newContent);
            applied = true;
            resultMessage = "Changes applied.";

            if (choice.value === "acceptAll") {
                autoAcceptEdits = true;
                resultMessage = "Changes applied. Auto-accepting future edits.";
            }
        }

        // Close the diff preview if it's still active
        const activeEditor = vscode.window.activeTextEditor;
        if (
            activeEditor &&
            (activeEditor.document.uri.toString() === leftUri.toString() ||
                activeEditor.document.uri.toString() === rightUri.toString())
        ) {
            await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
        }

        registration.dispose();

        return { success: applied, message: resultMessage };
    });
}

/**
 * Generic function to preview and create a new file.
 * Shows a preview of the new file content before creating it.
 *
 * @param filePath The path where the new file will be created
 * @param content The content to write to the new file
 * @param options Optional configuration
 * @returns Promise that resolves to true if file was created, false otherwise
 */
async function handleNewFileCreation(
    filePath: string,
    content: string,
    options: {
        /** Title for the preview view */
        previewTitle?: string;
        /** Progress message during processing */
        progressMessage?: string;
        /** When true, offer a "Create All" choice that sets autoAcceptCreates. */
        showCreateAll?: boolean;
    } = {},
): Promise<{ success: boolean; message: string }> {
    const {
        previewTitle = "collama – Preview New File",
        progressMessage = "collama: Creating file…",
        showCreateAll = false,
    } = options;

    return await withProgressNotification(progressMessage, async () => {
        // Create virtual URI for the preview
        const id = Date.now();
        const previewUri = vscode.Uri.parse(`collama-preview:${id}${getFileExtension(filePath)}`);

        // Set up content provider
        const provider = new DiffContentProvider();
        const registration = vscode.workspace.registerTextDocumentContentProvider("collama-preview", provider);

        provider.set(previewUri, content);

        // Open preview
        await vscode.commands.executeCommand("vscode.openWith", previewUri, "default");

        // QuickPick menu
        const picks: (vscode.QuickPickItem & { value?: string })[] = [
            {
                label: "$(check) Create",
                value: "create",
            },
            ...(showCreateAll
                ? [
                      {
                          label: "$(check-all) Create All",
                          value: "createAll",
                      },
                  ]
                : []),
            {
                label: "$(close) Cancel",
                value: "cancel",
            },
        ];

        // Calculate relative path from workspace root for display
        const uri = vscode.Uri.file(filePath);
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        const relativePath = workspaceFolder ? path.relative(workspaceFolder.uri.fsPath, filePath) : filePath;

        const choice = await vscode.window.showQuickPick(picks, {
            placeHolder: `Create: ${relativePath}`,
            canPickMany: false,
            ignoreFocusOut: true,
        });

        let created = false;
        let resultMessage = "File creation rejected by user.";

        if (choice?.value === "create" || choice?.value === "createAll") {
            const encoder = new TextEncoder();
            await vscode.workspace.fs.writeFile(uri, encoder.encode(content));
            created = true;
            resultMessage = "File created.";

            if (choice.value === "createAll") {
                autoAcceptCreates = true;
                resultMessage = "File created. Auto-creating future files.";
            }
        }

        // Close the preview if it's still active
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.uri.toString() === previewUri.toString()) {
            await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
        }

        registration.dispose();

        return { success: created, message: resultMessage };
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

    const root = getWorkspaceRoot();
    if (!root) {
        logAgent(`[editFile] No workspace root`);
        return JSON.stringify({ error: "No workspace root" });
    }

    const fullPath = path.resolve(root, args.filePath);
    if (!isWithinRoot(root, fullPath)) {
        logAgent(`[editFile] Path must not escape the workspace root: ${args.filePath}`);
        return JSON.stringify({ error: "Path must not escape the workspace root" });
    }

    try {
        const content = await readFileContent(fullPath);
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
            await applyFileChanges(vscode.Uri.file(fullPath), newContent);
            return JSON.stringify({
                success: true,
                message: "Changes applied (auto-accepted).",
                filePath: args.filePath,
            });
        }

        const result = await handleFileChangesWithDiff(fullPath, newContent, {
            diffTitle: `collama – Edit: ${args.filePath}`,
            progressMessage: `collama: Editing ${args.filePath}…`,
            showAcceptAll: true,
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

    const root = getWorkspaceRoot();
    if (!root) {
        logAgent(`[create] No workspace root`);
        return JSON.stringify({ error: "No workspace root" });
    }

    const fullPath = path.resolve(root, args.filePath);
    if (!isWithinRoot(root, fullPath)) {
        logAgent(`[create] Path must not escape the workspace root: ${args.filePath}`);
        return JSON.stringify({ error: "Path must not escape the workspace root" });
    }

    try {
        // Check if path already exists
        try {
            const stat = await vscode.workspace.fs.stat(vscode.Uri.file(fullPath));
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
            if (!(await confirmAction("Create Folder", `Create new folder: ${args.filePath}?`))) {
                return JSON.stringify({
                    success: false,
                    message: "Folder creation rejected by user.",
                    filePath: args.filePath,
                });
            }

            await vscode.workspace.fs.createDirectory(vscode.Uri.file(fullPath));

            return JSON.stringify({ success: true, message: "Folder created.", filePath: args.filePath });
        }

        // Auto-accept: create without preview
        if (autoAcceptCreates) {
            const uri = vscode.Uri.file(fullPath);
            const encoder = new TextEncoder();
            await vscode.workspace.fs.writeFile(uri, encoder.encode(args.content!));
            return JSON.stringify({
                success: true,
                message: "File created (auto-created).",
                filePath: args.filePath,
            });
        }

        // Create file with preview
        const result = await handleNewFileCreation(fullPath, args.content!, {
            previewTitle: `collama – New File: ${args.filePath}`,
            progressMessage: `collama: Creating ${args.filePath}…`,
            showCreateAll: true,
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

    const root = getWorkspaceRoot();
    if (!root) {
        logAgent(`[deleteFile] No workspace root`);
        return JSON.stringify({ error: "No workspace root" });
    }

    const fullPath = path.resolve(root, args.filePath);
    if (!isWithinRoot(root, fullPath)) {
        logAgent(`[deleteFile] Path must not escape the workspace root: ${args.filePath}`);
        return JSON.stringify({ error: "Path must not escape the workspace root" });
    }

    try {
        const uri = vscode.Uri.file(fullPath);

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

        // QuickPick menu
        const picks: (vscode.QuickPickItem & { value?: string })[] = [
            {
                label: "$(trash) Delete",
                value: "delete",
            },
            {
                label: "$(warning) Delete All",
                value: "deleteAll",
            },
            {
                label: "$(close) Cancel",
                value: "cancel",
            },
        ];

        // Calculate relative path from workspace root for display
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        const relativePath = workspaceFolder ? path.relative(workspaceFolder.uri.fsPath, fullPath) : fullPath;

        const choice = await vscode.window.showQuickPick(picks, {
            placeHolder: `Delete: ${relativePath}`,
            canPickMany: false,
            ignoreFocusOut: true,
        });

        let deleted = false;
        let resultMessage = "Deletion rejected by user.";

        if (choice?.value === "delete" || choice?.value === "deleteAll") {
            await vscode.workspace.fs.delete(uri);
            deleted = true;
            resultMessage = "File deleted.";

            if (choice.value === "deleteAll") {
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
