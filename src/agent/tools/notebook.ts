import fs from "node:fs";
import * as vscode from "vscode";
import { logMsg } from "../../logging";
import { ToolAnswer, secureWorkspace, toolError } from "../tools";
import { getAutoAcceptEdits, setAutoAcceptEdits } from "./confirm";
import { successWithDiagnostics } from "./diagnostics";
import { confirmWithDiff } from "./diff-preview";

type CellType = "code" | "markdown";

type NotebookCell = {
    cell_type: string;
    source: string[] | string;
    metadata?: Record<string, unknown>;
    outputs?: unknown[];
    execution_count?: number | null;
    id?: string;
};

type Notebook = {
    cells: NotebookCell[];
    [key: string]: unknown;
};

type NotebookInput = {
    filePath: string;
    mode: "edit" | "insert" | "delete";
    cellIndex: number;
    source?: string;
    cellType?: CellType;
    explanation: string;
};

/** Splits text into the line-array form Jupyter stores in `source` (each line keeps its trailing newline). */
function toSourceArray(text: string): string[] {
    const lines = text.split("\n");
    return lines.map((line, i) => (i < lines.length - 1 ? line + "\n" : line));
}

/** A short random id, matching the nbformat 4.5+ requirement that every cell carry one. */
function newCellId(): string {
    return Math.random().toString(36).slice(2, 10);
}

/** Jupyter writes notebooks with 1-space indent; detect the file's actual indent so we don't reformat the whole file. */
function detectIndent(raw: string): number {
    const match = raw.match(/^\{\r?\n( +)"/);
    return match ? match[1].length : 1;
}

function makeCell(cellType: CellType, source: string): NotebookCell {
    const base: NotebookCell = {
        cell_type: cellType,
        source: toSourceArray(source),
        metadata: {},
        id: newCellId(),
    };
    if (cellType === "code") {
        base.outputs = [];
        base.execution_count = null;
    }
    return base;
}

/** Applies the requested mutation to the cells array in place. Returns an error message on invalid input. */
function applyMutation(nb: Notebook, args: NotebookInput): string | null {
    const count = nb.cells.length;
    const i = args.cellIndex;

    if (args.mode === "delete") {
        if (i < 0 || i >= count) {
            return `cellIndex ${i} out of range (notebook has ${count} cells).`;
        }
        nb.cells.splice(i, 1);
        return null;
    }

    if (args.mode === "edit") {
        if (i < 0 || i >= count) {
            return `cellIndex ${i} out of range (notebook has ${count} cells).`;
        }
        if (typeof args.source !== "string") {
            return "source is required for mode 'edit'.";
        }
        const cell = nb.cells[i];
        cell.source = toSourceArray(args.source);
        // Source changed, so any rendered outputs are stale.
        if (cell.cell_type === "code") {
            cell.outputs = [];
            cell.execution_count = null;
        }
        return null;
    }

    // insert
    if (i < 0 || i > count) {
        return `cellIndex ${i} out of range (insert allows 0..${count}).`;
    }
    if (typeof args.source !== "string") {
        return "source is required for mode 'insert'.";
    }
    if (args.cellType !== "code" && args.cellType !== "markdown") {
        return "cellType ('code' or 'markdown') is required for mode 'insert'.";
    }
    nb.cells.splice(i, 0, makeCell(args.cellType, args.source));
    return null;
}

/** Parses the notebook, applies the mutation, and re-serializes preserving indent + trailing newline. */
function buildProposed(raw: string, args: NotebookInput): { content: string } | { error: string } {
    let nb: Notebook;
    try {
        nb = JSON.parse(raw);
    } catch {
        return { error: "File is not valid JSON." };
    }
    if (!Array.isArray(nb.cells)) {
        return { error: "Not a notebook: missing a 'cells' array." };
    }
    const error = applyMutation(nb, args);
    if (error) {
        return { error };
    }
    return { content: JSON.stringify(nb, null, detectIndent(raw)) + (raw.endsWith("\n") ? "\n" : "") };
}

export async function notebook_exec(args: NotebookInput): Promise<ToolAnswer<{ filePath: string }>> {
    logMsg(`Agent - use notebook-tool file=${args.filePath} mode=${args.mode} cellIndex=${args.cellIndex}`);

    if (!args.filePath.endsWith(".ipynb")) {
        return toolError("notebook only edits .ipynb files.");
    }

    const ws = secureWorkspace(args.filePath, "notebook");
    if (ws.error) {
        return toolError(ws.error);
    }
    if (!fs.existsSync(ws.fullPath)) {
        return toolError(`File not found: ${args.filePath}`);
    }

    const raw = fs.readFileSync(ws.fullPath, "utf-8");
    const built = buildProposed(raw, args);
    if ("error" in built) {
        return toolError(built.error);
    }

    const targetUri = vscode.Uri.file(ws.fullPath);
    const encoded = new TextEncoder().encode(built.content);

    // Auto-accept: write without preview (mirrors the edit tool).
    if (getAutoAcceptEdits()) {
        await vscode.workspace.fs.writeFile(targetUri, encoded);
        return successWithDiagnostics(ws.root, args.filePath, "Notebook updated (auto-accepted).");
    }

    const { value, reason } = await confirmWithDiff({
        original: raw,
        proposed: built.content,
        ext: ".ipynb",
        action: `notebook ${args.mode}`,
        displayPath: args.filePath,
        explanation: args.explanation,
        title: `collama – Notebook: ${args.filePath}`,
    });
    if (!value) {
        return { success: false, message: reason };
    }

    await vscode.workspace.fs.writeFile(targetUri, encoded);
    if (value === "acceptAll") {
        setAutoAcceptEdits(true);
        return successWithDiagnostics(ws.root, args.filePath, "Notebook updated. Auto-accepting future edits.");
    }
    return successWithDiagnostics(ws.root, args.filePath, "Notebook updated.");
}

export const notebook_def = {
    type: "function" as const,
    function: {
        name: "notebook",
        description:
            "Edit a Jupyter notebook (.ipynb) by cell, shown as a diff preview for confirmation. " +
            "mode='edit' replaces a cell's source (and clears stale outputs for code cells); " +
            "mode='insert' adds a new code or markdown cell at cellIndex (shifting later cells down); " +
            "mode='delete' removes the cell at cellIndex. Cells are addressed by 0-based index.",
        parameters: {
            type: "object",
            properties: {
                explanation: {
                    type: "string",
                    description: "One sentence describing what the change does in the repo.",
                },
                filePath: {
                    type: "string",
                    description: "Path to the file (relative to workspace root).",
                },
                mode: {
                    type: "string",
                    enum: ["edit", "insert", "delete"],
                    description: "edit a cell's source, insert a new cell, or delete a cell.",
                },
                cellIndex: {
                    type: "number",
                    description:
                        "0-based cell index. For insert, the new cell is placed at this index (use the cell count to append).",
                },
                source: {
                    type: "string",
                    description: "New cell source. Required for mode 'edit' and 'insert'.",
                },
                cellType: {
                    type: "string",
                    enum: ["code", "markdown"],
                    description: "Type of the new cell. Required for mode 'insert'.",
                },
            },
            required: ["explanation", "filePath", "mode", "cellIndex"],
        },
    },
};
