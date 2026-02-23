import path from "path";
import * as vscode from "vscode";
import { withProgressNotification } from "../../common/utils";
import { logMsg } from "../../logging";
import { getWorkspaceRoot, isWithinRoot } from "../tools";

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
        /** Title for the diff view */
        diffTitle?: string;
        /** Progress message during processing */
        progressMessage?: string;
    } = {},
): Promise<{ success: boolean; message: string }> {
    const { diffTitle = "collama – Preview Changes", progressMessage = "collama: Processing changes…" } = options;

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

        // Ask user to apply or cancel
        const applyChoice = await vscode.window.showQuickPick(["Accept", "Cancel"], {
            placeHolder: "Apply these changes?",
            canPickMany: false,
            ignoreFocusOut: true,
        });

        const shouldApply = applyChoice === "Accept";
        let resultMessage = "";

        if (shouldApply) {
            await applyFileChanges(uri, newContent);
            resultMessage = "Changes applied.";
        } else {
            resultMessage = "Changes discarded.";
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

        return { success: shouldApply, message: resultMessage };
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

        // Ask user to create or cancel
        const createChoice = await vscode.window.showQuickPick(["Create File", "Cancel"], {
            placeHolder: `Create new file: ${filePath}?`,
            canPickMany: false,
            ignoreFocusOut: true,
        });

        const shouldCreate = createChoice === "Create File";
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
 * Executes the editFile operation.
 * Edits a file by replacing a specific string with a new string.
 * Shows a diff preview and asks for user confirmation before applying.
 *
 * @param args - The arguments for the operation.
 * @param args.filePath - The relative path to the file within the workspace.
 * @param args.oldStr - The exact string to find and replace. Must match uniquely in the file.
 * @param args.newStr - The replacement string.
 * @returns A JSON string containing the operation result, or an error object if the operation fails.
 */
export async function editFile_exec(args: { filePath: string; oldStr: string; newStr: string }): Promise<string> {
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
        const uri = vscode.Uri.file(fullPath);

        // Prefer the in-memory document buffer (picks up unsaved edits from previous tool calls)
        const openDoc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
        const originalContent = openDoc
            ? openDoc.getText()
            : Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8");

        // Count occurrences to ensure unique match
        const occurrences = originalContent.split(args.oldStr).length - 1;
        if (occurrences === 0) {
            return JSON.stringify({ error: "oldStr not found in file. Make sure it matches the file content exactly, including whitespace and indentation." });
        }
        if (occurrences > 1) {
            return JSON.stringify({ error: `oldStr found ${occurrences} times. It must be unique. Include more surrounding context to make it unique.` });
        }

        const newContent = originalContent.replace(args.oldStr, args.newStr);

        const result = await handleFileChangesWithDiff(fullPath, newContent, {
            diffTitle: `collama – Edit ${args.filePath}`,
            progressMessage: `collama: Editing ${args.filePath}…`,
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
            "Edit a file by replacing a specific string with a new string (search-and-replace). The oldStr must match exactly one location in the file. Shows a diff preview and asks for user confirmation. Use readFile first to see the current content. For multiple changes, call this tool multiple times.",
        parameters: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "Path to the file to edit (relative to workspace root).",
                },
                oldStr: {
                    type: "string",
                    description:
                        "The exact string to find in the file. Must match exactly one location, including whitespace and indentation. Include enough surrounding lines for a unique match.",
                },
                newStr: {
                    type: "string",
                    description: "The string to replace oldStr with. Can be empty to delete the matched text.",
                },
            },
            required: ["filePath", "oldStr", "newStr"],
        },
    },
};

/**
 * Executes the createFile operation.
 * Creates a new file in the workspace with content preview and user confirmation.
 * Shows a preview of the new file content before creating it.
 *
 * @param args - The arguments for the operation.
 * @param args.filePath - The relative path to the new file within the workspace.
 * @param args.content - The content to write to the new file.
 * @returns A JSON string containing the operation result, or an error object if the operation fails.
 */
export async function createFile_exec(args: { filePath: string; content: string }): Promise<string> {
    logMsg(`Agent - tool use createFile file=${args.filePath}`);

    const root = getWorkspaceRoot();
    if (!root) {
        return JSON.stringify({ error: "No workspace root" });
    }

    const fullPath = path.resolve(root, args.filePath);
    if (!isWithinRoot(root, fullPath)) {
        return JSON.stringify({ error: "Path must not escape the workspace root" });
    }

    try {
        // Check if file already exists
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(fullPath));
            return JSON.stringify({ error: `File already exists: ${args.filePath}` });
        } catch {
            // File doesn't exist, which is what we want
        }

        const result = await handleNewFileCreation(fullPath, args.content, {
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
        logMsg(`Agent - createFile error: ${msg}`);
        return JSON.stringify({ error: `Failed to create file: ${msg}` });
    }
}

export const createFile_def = {
    type: "function" as const,
    function: {
        name: "createFile",
        description:
            "Create a new file in the workspace with content preview and user confirmation. Shows a preview of the new file content and asks for confirmation before creating the file.",
        parameters: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "Path to the new file to create (relative to workspace root).",
                },
                content: {
                    type: "string",
                    description: "The content to write to the new file.",
                },
            },
            required: ["filePath", "content"],
        },
    },
};

/**
 * Executes the createFolder operation.
 * Creates a new folder/directory in the workspace with user confirmation.
 *
 * @param args - The arguments for the operation.
 * @param args.folderPath - The relative path to the new folder within the workspace.
 * @returns A JSON string containing the operation result, or an error object if the operation fails.
 */
export async function createFolder_exec(args: { folderPath: string }): Promise<string> {
    logMsg(`Agent - tool use createFolder folder=${args.folderPath}`);

    const root = getWorkspaceRoot();
    if (!root) {
        return JSON.stringify({ error: "No workspace root" });
    }

    const fullPath = path.resolve(root, args.folderPath);
    if (!isWithinRoot(root, fullPath)) {
        return JSON.stringify({ error: "Path must not escape the workspace root" });
    }

    try {
        // Check if folder already exists
        try {
            const stat = await vscode.workspace.fs.stat(vscode.Uri.file(fullPath));
            if (stat.type === vscode.FileType.Directory) {
                return JSON.stringify({ error: `Folder already exists: ${args.folderPath}` });
            } else {
                return JSON.stringify({ error: `A file with that name already exists: ${args.folderPath}` });
            }
        } catch {
            // Folder doesn't exist, which is what we want
        }

        // Ask user to confirm folder creation
        const createChoice = await vscode.window.showQuickPick(["Create Folder", "Cancel"], {
            placeHolder: `Create new folder: ${args.folderPath}?`,
            canPickMany: false,
            ignoreFocusOut: true,
        });

        if (createChoice !== "Create Folder") {
            return JSON.stringify({
                success: false,
                message: "Folder creation cancelled.",
                folderPath: args.folderPath,
            });
        }

        // Create the folder
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(fullPath));

        return JSON.stringify({
            success: true,
            message: "Folder created.",
            folderPath: args.folderPath,
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logMsg(`Agent - createFolder error: ${msg}`);
        return JSON.stringify({ error: `Failed to create folder: ${msg}` });
    }
}

export const createFolder_def = {
    type: "function" as const,
    function: {
        name: "createFolder",
        description:
            "Create a new folder/directory in the workspace with user confirmation. Asks for confirmation before creating the folder.",
        parameters: {
            type: "object",
            properties: {
                folderPath: {
                    type: "string",
                    description: "Path to the new folder to create (relative to workspace root).",
                },
            },
            required: ["folderPath"],
        },
    },
};
