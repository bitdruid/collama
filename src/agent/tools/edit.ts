import path from "path";
import * as vscode from "vscode";
import { withProgressNotification } from "../../common/utils-common";
import { logMsg } from "../../logging";
import { confirmAction, getWorkspaceRoot, isWithinRoot } from "../tools";

/**
 * When true, editFile applies changes without showing a diff preview.
 * Set by the "Accept All" quick-pick option; reset per agent session.
 */
let autoAcceptEdits = false;

/**
 * Resets the auto-accept flag. Call at the start of each agent session.
 */
export function resetAutoAcceptEdits(): void {
    autoAcceptEdits = false;
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

        const picks = showAcceptAll ? ["Accept", "Accept All", "Cancel"] : ["Accept", "Cancel"];
        const choice = await vscode.window.showQuickPick(picks, {
            placeHolder: "Apply these changes?",
            canPickMany: false,
            ignoreFocusOut: true,
        });

        let applied = false;
        let resultMessage = "Changes discarded.";

        if (choice === "Accept" || choice === "Accept All") {
            await applyFileChanges(uri, newContent);
            applied = true;
            resultMessage = "Changes applied.";
            if (choice === "Accept All") {
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
    } = {},
): Promise<{ success: boolean; message: string }> {
    const { previewTitle = "collama – Preview New File", progressMessage = "collama: Creating file…" } = options;

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

        const shouldCreate = await confirmAction("Create File", `Create new file: ${filePath}?`);
        let resultMessage = "";

        if (shouldCreate) {
            const uri = vscode.Uri.file(filePath);
            const encoder = new TextEncoder();
            await vscode.workspace.fs.writeFile(uri, encoder.encode(content));
            resultMessage = "File created.";
        } else {
            resultMessage = "File creation cancelled.";
        }

        // Close the preview if it's still active
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.uri.toString() === previewUri.toString()) {
            await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
        }

        registration.dispose();

        return { success: shouldCreate, message: resultMessage };
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
        return JSON.stringify({ error: "No workspace root" });
    }

    const fullPath = path.resolve(root, args.filePath);
    if (!isWithinRoot(root, fullPath)) {
        return JSON.stringify({ error: "Path must not escape the workspace root" });
    }

    try {
        const content = await readFileContent(fullPath);

        // Validate that oldString exists and is unique
        const firstIndex = content.indexOf(args.oldString);
        if (firstIndex === -1) {
            return JSON.stringify({
                error: "oldString not found in file. Make sure it matches the file content exactly, including whitespace and indentation.",
                filePath: args.filePath,
            });
        }

        const secondIndex = content.indexOf(args.oldString, firstIndex + 1);
        if (secondIndex !== -1) {
            return JSON.stringify({
                error: "oldString matches multiple locations. Provide a larger unique snippet with more surrounding context.",
                filePath: args.filePath,
            });
        }

        if (args.oldString === args.newString) {
            return JSON.stringify({ error: "oldString and newString are identical. No changes to apply." });
        }

        const newContent = content.replace(args.oldString, args.newString);

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
        logMsg(`Agent - editFile error: ${msg}`);
        return JSON.stringify({ error: `Failed to edit file: ${msg}` });
    }
}

export const editFile_def = {
    type: "function" as const,
    function: {
        name: "editFile",
        description:
            "Edit a file by replacing an exact string match with new content. The oldString must match exactly one location in the file (including whitespace and indentation). Use readFile first to see the current content. Shows a diff preview and asks for user confirmation.",
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
        return JSON.stringify({ error: "No workspace root" });
    }

    const fullPath = path.resolve(root, args.filePath);
    if (!isWithinRoot(root, fullPath)) {
        return JSON.stringify({ error: "Path must not escape the workspace root" });
    }

    try {
        // Check if path already exists
        try {
            const stat = await vscode.workspace.fs.stat(vscode.Uri.file(fullPath));
            if (stat.type === vscode.FileType.Directory) {
                return JSON.stringify({ error: `Folder already exists: ${args.filePath}` });
            }
            return JSON.stringify({ error: `File already exists: ${args.filePath}` });
        } catch {
            // Doesn't exist, which is what we want
        }

        if (isFolder) {
            if (!(await confirmAction("Create Folder", `Create new folder: ${args.filePath}?`))) {
                return JSON.stringify({
                    success: false,
                    message: "Folder creation cancelled.",
                    filePath: args.filePath,
                });
            }

            await vscode.workspace.fs.createDirectory(vscode.Uri.file(fullPath));

            return JSON.stringify({ success: true, message: "Folder created.", filePath: args.filePath });
        }

        // Create file with preview
        const result = await handleNewFileCreation(fullPath, args.content!, {
            previewTitle: `collama – New File: ${args.filePath}`,
            progressMessage: `collama: Creating ${args.filePath}…`,
        });

        return JSON.stringify({
            success: result.success,
            message: result.message,
            filePath: args.filePath,
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
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
        return JSON.stringify({ error: "No workspace root" });
    }

    const fullPath = path.resolve(root, args.filePath);
    if (!isWithinRoot(root, fullPath)) {
        return JSON.stringify({ error: "Path must not escape the workspace root" });
    }

    try {
        const uri = vscode.Uri.file(fullPath);

        // Verify the file exists
        try {
            const stat = await vscode.workspace.fs.stat(uri);
            if (stat.type === vscode.FileType.Directory) {
                return JSON.stringify({ error: `Path is a directory, not a file: ${args.filePath}` });
            }
        } catch {
            return JSON.stringify({ error: `File not found: ${args.filePath}` });
        }

        if (!(await confirmAction("Delete", `Delete file: ${args.filePath}?`))) {
            return JSON.stringify({ success: false, message: "Deletion cancelled.", filePath: args.filePath });
        }

        await vscode.workspace.fs.delete(uri);

        return JSON.stringify({ success: true, message: "File deleted.", filePath: args.filePath });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
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
