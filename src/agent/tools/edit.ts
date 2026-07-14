import fs from "fs";
import path from "path";
import * as vscode from "vscode";
import { logMsg } from "../../logging";
import { Tool, ToolAnswer, formatToolTargetValue, secureWorkspace, toolError, toolSuccess } from "../tools";
import {
    getAutoAcceptDeletes,
    getAutoAcceptEdits,
    getAutoAcceptFileCreates,
    getAutoAcceptFolderCreates,
    requestToolConfirm,
    setAutoAcceptDeletes,
    setAutoAcceptEdits,
    setAutoAcceptFileCreates,
    setAutoAcceptFolderCreates,
} from "./utils/confirm";
import { successWithDiagnostics } from "./utils/diagnostics";
import { confirmWithDiff, confirmWithPreview } from "./utils/diff-preview";

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
 * Edits a file by replacing an exact string match with new content.
 * Shows a diff preview and asks for user confirmation before applying.
 *
 * @param args.filePath - Relative path to the file to edit.
 * @param args.oldString - The exact string to find in the file (must match uniquely).
 * @param args.newString - The replacement string.
 */
export async function edit_exec(args: {
    filePath: string;
    oldString: string;
    newString: string;
    explanation: string;
}): Promise<ToolAnswer<{ filePath: string }>> {
    logMsg(`Agent - use edit-tool file=${args.filePath}`);

    const ws = secureWorkspace(args.filePath, "edit");
    if (ws.error) {
        return toolError(ws.error);
    }

    try {
        // bytes on disk — preserved for diff and final write.
        const rawContent = readFileContent(ws.fullPath);
        // normalize to LF so the model's "\n" matches a file's "\r\n".
        const eol = detectEol(rawContent);
        const content = rawContent.replace(/\r\n/g, "\n");
        const oldString = args.oldString.replace(/\r\n/g, "\n");
        const newString = args.newString.replace(/\r\n/g, "\n");

        // new content in LF space, then restore the file's original EOL
        let newContentLf: string;

        if (content === "" && oldString === "") {
            // Insert into an empty file
            if (!newString) {
                return toolError("newString must not be empty when inserting into an empty file.");
            }
            newContentLf = newString;
        } else {
            // Validate that oldString exists and is unique
            const firstIndex = content.indexOf(oldString);
            if (firstIndex === -1) {
                return toolError(
                    "oldString not found in file. Make sure it matches the file content exactly, including whitespace and indentation.",
                );
            }

            const secondIndex = content.indexOf(oldString, firstIndex + 1);
            if (secondIndex !== -1) {
                return toolError(
                    "oldString matches multiple locations. Provide a larger unique snippet with more surrounding context.",
                );
            }

            if (oldString === newString) {
                return toolError("oldString and newString are identical. No changes to apply.");
            }

            newContentLf = content.replace(oldString, newString);
        }

        // Restore the file's original line-ending style so a Windows (CRLF) file
        // stays CRLF — only the edited region changes, not every line.
        const newContent = eol === "\r\n" ? newContentLf.replace(/\n/g, "\r\n") : newContentLf;

        // Auto-accept: apply without diff preview
        if (getAutoAcceptEdits()) {
            await applyFileChanges(vscode.Uri.file(ws.fullPath), newContent);
            return successWithDiagnostics(ws.root, args.filePath, "Changes applied (auto-accepted).");
        }

        const { value, reason } = await confirmWithDiff({
            original: rawContent,
            proposed: newContent,
            ext: getFileExtension(args.filePath),
            action: "edit",
            displayPath: args.filePath,
            explanation: args.explanation,
            title: `collama – Edit: ${args.filePath}`,
        });
        if (!value) {
            return { success: false, output: { filePath: args.filePath }, message: reason };
        }

        await applyFileChanges(vscode.Uri.file(ws.fullPath), newContent);
        if (value === "acceptAll") {
            setAutoAcceptEdits(true);
            return successWithDiagnostics(ws.root, args.filePath, "Changes applied. Auto-accepting future edits.");
        }
        return successWithDiagnostics(ws.root, args.filePath, "Changes applied.");
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return toolError(`Failed to edit file: ${msg}`);
    }
}

export const edit_def = {
    type: "function" as const,
    function: {
        name: "edit",
        description:
            "Edit a file by replacing exact string matches. The oldString must match a string to replace in the filePath file. To add content to an empty file, set oldString to an empty string.",
        parameters: {
            type: "object",
            properties: {
                explanation: {
                    type: "string",
                    description: "One sentence describing what the command does in the repo. Is required!",
                },
                filePath: {
                    type: "string",
                    description: "Path to the file (relative to workspace root).",
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
            required: ["explanation", "filePath", "oldString", "newString"],
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
export async function create_exec(args: {
    filePath: string;
    content?: string;
    explanation: string;
}): Promise<ToolAnswer<{ filePath: string }>> {
    const isFolder = args.content === undefined;
    logMsg(`Agent - use create-tool ${isFolder ? "folder" : "file"}=${args.filePath}`);

    const ws = secureWorkspace(args.filePath, "create");
    if (ws.error) {
        return toolError(ws.error);
    }

    try {
        // Check if path already exists
        try {
            const stat = await vscode.workspace.fs.stat(vscode.Uri.file(ws.fullPath));
            if (stat.type === vscode.FileType.Directory) {
                return toolError(`Folder already exists: ${args.filePath}`);
            }
            return toolError(`File already exists: ${args.filePath}`);
        } catch {
            // Doesn't exist, which is what we want
        }

        if (isFolder) {
            // Auto-accept: create folder without confirmation
            if (getAutoAcceptFolderCreates()) {
                await vscode.workspace.fs.createDirectory(vscode.Uri.file(ws.fullPath));
                return toolSuccess({ filePath: args.filePath }, "Folder created (auto-created).");
            }

            const { value, reason } = await requestToolConfirm("create folder", args.filePath, args.explanation);

            if (!value) {
                return { success: false, output: { filePath: args.filePath }, message: reason };
            }

            await vscode.workspace.fs.createDirectory(vscode.Uri.file(ws.fullPath));

            if (value === "acceptAll") {
                setAutoAcceptFolderCreates(true);
                return toolSuccess({ filePath: args.filePath }, "Folder created. Auto-creating future folders.");
            }

            return toolSuccess({ filePath: args.filePath }, "Folder created.");
        }

        // Auto-accept: create without preview
        if (getAutoAcceptFileCreates()) {
            const encoder = new TextEncoder();
            await vscode.workspace.fs.writeFile(vscode.Uri.file(ws.fullPath), encoder.encode(args.content!));
            return successWithDiagnostics(ws.root, args.filePath, "File created (auto-created).");
        }

        // Create file with preview
        const { value, reason } = await confirmWithPreview({
            content: args.content!,
            ext: getFileExtension(args.filePath),
            action: "create",
            displayPath: args.filePath,
            explanation: args.explanation,
        });
        if (!value) {
            return { success: false, output: { filePath: args.filePath }, message: reason };
        }

        await vscode.workspace.fs.writeFile(vscode.Uri.file(ws.fullPath), new TextEncoder().encode(args.content!));
        if (value === "acceptAll") {
            setAutoAcceptFileCreates(true);
            return successWithDiagnostics(ws.root, args.filePath, "File created. Auto-creating future files.");
        }
        return successWithDiagnostics(ws.root, args.filePath, "File created.");
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return toolError(`Failed to create ${isFolder ? "folder" : "file"}: ${msg}`);
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
                explanation: {
                    type: "string",
                    description: "One sentence describing what the command does in the repo. Is required!",
                },
                filePath: {
                    type: "string",
                    description: "Path to the new file or folder (relative to workspace root).",
                },
                content: {
                    type: "string",
                    description: "File content. Omit to create a folder instead.",
                },
            },
            required: ["explanation", "filePath"],
        },
    },
};

/**
 * Deletes a file or folder from the workspace after user confirmation.
 *
 * @param args.filePath - Relative path to the file or folder to delete.
 */
export async function delete_exec(args: {
    filePath: string;
    explanation: string;
}): Promise<ToolAnswer<{ filePath: string }>> {
    logMsg(`Agent - use delete-tool file=${args.filePath}`);

    const ws = secureWorkspace(args.filePath, "delete");
    if (ws.error) {
        return toolError(ws.error);
    }

    try {
        const uri = vscode.Uri.file(ws.fullPath);

        // Verify the file/folder exists
        try {
            await vscode.workspace.fs.stat(uri);
        } catch {
            return toolError(`File/folder not found: ${args.filePath}`);
        }

        // Auto-accept: delete without confirmation
        if (getAutoAcceptDeletes()) {
            await vscode.workspace.fs.delete(uri);
            return toolSuccess({ filePath: args.filePath }, "File/folder deleted (auto-deleted).");
        }

        // Calculate relative path from workspace root for display
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        const relativePath = workspaceFolder ? path.relative(workspaceFolder.uri.fsPath, ws.fullPath) : ws.fullPath;

        const { value, reason } = await requestToolConfirm("delete", relativePath, args.explanation);

        if (!value) {
            return { success: false, output: { filePath: args.filePath }, message: reason };
        }

        await vscode.workspace.fs.delete(uri);

        if (value === "acceptAll") {
            setAutoAcceptDeletes(true);
            return toolSuccess({ filePath: args.filePath }, "File/folder deleted. Auto-deleting future files.");
        }

        return toolSuccess({ filePath: args.filePath }, "File/folder deleted.");
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return toolError(`Failed to delete file/folder: ${msg}`);
    }
}

export const delete_def = {
    type: "function" as const,
    function: {
        name: "delete",
        description: "Delete a file or folder from the workspace. Asks for user confirmation before deleting.",
        parameters: {
            type: "object",
            properties: {
                explanation: {
                    type: "string",
                    description: "One sentence describing what the command does in the repo. Is required!",
                },
                filePath: {
                    type: "string",
                    description: "Path to the file or folder to delete (relative to workspace root).",
                },
            },
            required: ["explanation", "filePath"],
        },
    },
};

/** Reads file content from disk (consistent with read tool). */
function readFileContent(fullPath: string): string {
    return fs.readFileSync(fullPath, "utf-8");
}

/**
 * Detects the dominant line-ending style of a file's content.
 * Returns "\r\n" if CRLF endings outnumber bare LF, otherwise "\n".
 */
function detectEol(content: string): "\r\n" | "\n" {
    const crlf = (content.match(/\r\n/g) || []).length;
    const lf = (content.match(/(?<!\r)\n/g) || []).length;
    return crlf > lf ? "\r\n" : "\n";
}

// role registry
// role registry
// role registry

export const editTools: Record<string, Tool> = {
    edit: {
        historyPolicy: "keepAll",
        definition: edit_def,
        toolTarget: (args) => formatToolTargetValue("filePath", args.filePath),
        execute: edit_exec,
    },
    create: {
        historyPolicy: "keepAll",
        definition: create_def,
        toolTarget: (args) => formatToolTargetValue("filePath", args.filePath),
        execute: create_exec,
    },
    delete: {
        historyPolicy: "keepAll",
        definition: delete_def,
        toolTarget: (args) => formatToolTargetValue("filePath", args.filePath),
        execute: delete_exec,
    },
};
