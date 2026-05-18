import path from "path";
import * as vscode from "vscode";
import { logMsg } from "../../logging";
import { ToolAnswer, getWorkspaceRoot, isWithinRoot, toolError, toolSuccess } from "../tools";

const DIAGNOSTIC_SEVERITY: Record<number, string> = {
    0: "error",
    1: "warning",
    2: "info",
    3: "hint",
};

const MAX_SEVERITY = 1; // errors + warnings

interface DiagnosticEntry {
    line: number;
    character: number;
    severity: string;
    message: string;
    source?: string;
    code?: string;
}

interface ReferenceEntry {
    filePath: string;
    line: number;
    character: number;
}

type AnalyseOutput =
    | {
          mode: "diagnostics";
          diagnostics?: DiagnosticEntry[];
          diagnosticsByFile?: Record<string, DiagnosticEntry[]>;
          count: number;
          fileCount?: number;
      }
    | {
          mode: "references";
          references: ReferenceEntry[];
          count: number;
      };

function mapDiagnostic(d: vscode.Diagnostic): DiagnosticEntry {
    return {
        line: d.range.start.line + 1,
        character: d.range.start.character,
        severity: DIAGNOSTIC_SEVERITY[d.severity] ?? "unknown",
        message: d.message,
        source: d.source || undefined,
        code: d.code !== undefined ? String(typeof d.code === "object" ? d.code.value : d.code) : undefined,
    };
}

/**
 * Runs diagnostics mode to retrieve LSP errors/warnings from the language server.
 *
 * @param root - Absolute path to the workspace root directory
 * @param filePath - Optional relative path to a specific file. If omitted, returns diagnostics for all files.
 * @returns A ToolAnswer containing either a filtered diagnostics array (for single file) or diagnostics grouped by file (for all files)
 */
async function runDiagnostics(root: string, filePath: string | undefined): Promise<ToolAnswer<AnalyseOutput>> {
    if (filePath) {
        const fullPath = path.resolve(root, filePath);
        if (!isWithinRoot(root, fullPath)) {
            return toolError("Path must not escape the workspace root");
        }
        const uri = vscode.Uri.file(fullPath);
        await vscode.workspace.openTextDocument(uri);
        const filtered = vscode.languages
            .getDiagnostics(uri)
            .filter((d) => d.severity <= MAX_SEVERITY)
            .map(mapDiagnostic);
        return toolSuccess({ mode: "diagnostics", diagnostics: filtered, count: filtered.length });
    }

    const all = vscode.languages.getDiagnostics();
    const diagnosticsByFile: Record<string, DiagnosticEntry[]> = {};
    let totalCount = 0;

    for (const [uri, diagnostics] of all) {
        if (!isWithinRoot(root, uri.fsPath)) {
            continue;
        }
        const filtered = diagnostics.filter((d) => d.severity <= MAX_SEVERITY).map(mapDiagnostic);
        if (filtered.length > 0) {
            diagnosticsByFile[path.relative(root, uri.fsPath)] = filtered;
            totalCount += filtered.length;
        }
    }

    return toolSuccess({
        mode: "diagnostics",
        diagnosticsByFile,
        count: totalCount,
        fileCount: Object.keys(diagnosticsByFile).length,
    });
}

/**
 * Runs references mode to find all usages of a symbol at the specified location.
 *
 * @param root - Absolute path to the workspace root directory
 * @param filePath - Relative path to the file containing the symbol
 * @param line - 1-based line number of the symbol
 * @param character - 0-based column number of the symbol
 * @returns A ToolAnswer containing an array of reference locations
 */
async function runReferences(
    root: string,
    filePath: string,
    line: number,
    character: number,
): Promise<ToolAnswer<AnalyseOutput>> {
    const fullPath = path.resolve(root, filePath);
    if (!isWithinRoot(root, fullPath)) {
        return toolError("Path must not escape the workspace root");
    }
    const uri = vscode.Uri.file(fullPath);
    await vscode.workspace.openTextDocument(uri);

    const position = new vscode.Position(Math.max(0, line - 1), Math.max(0, character));
    const locations =
        (await vscode.commands.executeCommand<vscode.Location[]>("vscode.executeReferenceProvider", uri, position)) ??
        [];

    const references: ReferenceEntry[] = locations
        .filter((loc) => isWithinRoot(root, loc.uri.fsPath))
        .map((loc) => ({
            filePath: path.relative(root, loc.uri.fsPath),
            line: loc.range.start.line + 1,
            character: loc.range.start.character,
        }));

    return toolSuccess({ mode: "references", references, count: references.length });
}

/**
 * Executes the analyse tool to perform language-server analysis.
 *
 * This tool operates in two distinct modes:
 * - **diagnostics**: Retrieves LSP errors/warnings from the language server.
 *   When `filePath` is provided, returns diagnostics for that specific file.
 *   When `filePath` is omitted, returns diagnostics for all files in the workspace.
 *   Only includes errors and warnings (severity <= 1), filtering out info and hints.
 *
 * - **references**: Finds all references to a symbol at the specified location.
 *   Requires `filePath`, `line`, and `character` parameters to identify the symbol.
 *   Returns all locations where the symbol is referenced within the workspace.
 *
 * @param args.mode - The operation mode: "diagnostics" or "references"
 * @param args.filePath - Path relative to workspace root. Optional for diagnostics, required for references.
 * @param args.line - 1-based line number of the symbol (required for references mode)
 * @param args.character - 0-based column number of the symbol (required for references mode)
 * @returns A ToolAnswer containing either diagnostics data or references data with count information
 * @throws Returns a toolError if workspace root is not available, path escapes root bounds, required parameters are missing, or an unknown mode is provided
 */
export async function analyse_exec(args: {
    mode: "diagnostics" | "references";
    filePath?: string;
    line?: number;
    character?: number;
}): Promise<ToolAnswer<AnalyseOutput>> {
    logMsg(`Agent - use analyse-tool mode=${args.mode} file=${args.filePath ?? "all"}`);

    const root = getWorkspaceRoot();
    if (!root) {
        return toolError("No workspace root");
    }

    try {
        if (args.mode === "diagnostics") {
            return await runDiagnostics(root, args.filePath);
        }
        if (args.mode === "references") {
            if (!args.filePath || args.line === undefined || args.character === undefined) {
                return toolError("references mode requires filePath, line, and character");
            }
            return await runReferences(root, args.filePath, args.line, args.character);
        }
        return toolError(`Unknown mode: ${args.mode}`);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return toolError(`analyse failed: ${msg}`);
    }
}

export const analyse_def = {
    type: "function" as const,
    function: {
        name: "analyse",
        description:
            "Language-server analysis. mode='diagnostics' returns errors/warnings/hints (use after editing to verify changes). mode='references' finds all references to the symbol at a given location.",
        parameters: {
            type: "object",
            properties: {
                explanation: {
                    type: "string",
                    description: "One sentence explaining why this tool call is needed for the user's request.",
                },
                mode: {
                    type: "string",
                    enum: ["diagnostics", "references"],
                    description:
                        "'diagnostics' for lint/type-check problems from the language server. 'references' to locate all usages of a symbol.",
                },
                filePath: {
                    type: "string",
                    description:
                        "Path relative to workspace root. For 'diagnostics' optional (omit for all files). For 'references' required.",
                },
                line: {
                    type: "number",
                    description: "References only. 1-based line number of the symbol.",
                },
                character: {
                    type: "number",
                    description: "References only. 0-based column of the symbol.",
                },
            },
            required: ["explanation", "mode"],
        },
    },
};
