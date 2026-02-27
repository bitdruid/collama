import path from "path";
import * as vscode from "vscode";
import { logMsg } from "../../logging";
import { getWorkspaceRoot, isWithinRoot } from "../tools";

/**
 * Convert a DocumentSymbol to a serializable format with 1-based lines.
 */
function symbolToJSON(symbol: vscode.DocumentSymbol): any {
    return {
        name: symbol.name,
        kind: vscode.SymbolKind[symbol.kind],
        line: symbol.selectionRange.start.line + 1,
        character: symbol.selectionRange.start.character,
        endLine: symbol.range.end.line + 1,
        detail: symbol.detail || undefined,
        children: symbol.children.length > 0 ? symbol.children.map((child) => symbolToJSON(child)) : undefined,
    };
}

/**
 * Retrieves symbols (classes, functions, variables, etc.) from a document or workspace.
 *
 * @param args.filePath - Optional. File to get symbols from. If omitted, searches workspace.
 * @param args.query - Optional. Query for workspace symbol search (only when filePath is omitted).
 */
export async function getSymbols_exec(args: { filePath?: string; query?: string }): Promise<string> {
    logMsg(`Agent - tool use getSymbols file=${args.filePath ?? "workspace"} query=${args.query ?? ""}`);

    const root = getWorkspaceRoot();
    if (!root) {
        return JSON.stringify({ error: "No workspace root" });
    }

    // Document symbols (when filePath is provided)
    if (args.filePath) {
        const fullPath = path.resolve(root, args.filePath);
        if (!isWithinRoot(root, fullPath)) {
            return JSON.stringify({ error: "Path must not escape the workspace root" });
        }

        const uri = vscode.Uri.file(fullPath);

        // Open the document to ensure the language server is ready
        await vscode.workspace.openTextDocument(uri);

        const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
            "vscode.executeDocumentSymbolProvider",
            uri,
        );

        if (!symbols || symbols.length === 0) {
            return JSON.stringify({ symbols: [], filePath: args.filePath });
        }

        return JSON.stringify({
            symbols: symbols.map((s) => symbolToJSON(s)),
            filePath: args.filePath,
        });
    }

    // Workspace symbols (when filePath is omitted)
    const query = args.query || "";
    const workspaceSymbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
        "vscode.executeWorkspaceSymbolProvider",
        query,
    );

    if (!workspaceSymbols || workspaceSymbols.length === 0) {
        return JSON.stringify({ symbols: [], query });
    }

    const filteredSymbols = workspaceSymbols
        .filter((s) => isWithinRoot(root, s.location.uri.fsPath))
        .map((s) => ({
            name: s.name,
            kind: vscode.SymbolKind[s.kind],
            filePath: path.relative(root, s.location.uri.fsPath),
            line: s.location.range.start.line + 1,
            character: s.location.range.start.character,
            containerName: s.containerName || undefined,
        }));

    return JSON.stringify({
        symbols: filteredSymbols,
        query,
        count: filteredSymbols.length,
    });
}

export const getSymbols_def = {
    type: "function" as const,
    function: {
        name: "getSymbols",
        description:
            "Get symbols (classes, functions, variables, interfaces, types, etc.) from a document or the entire workspace. Returns symbol names, kinds, and 1-based line numbers. Use with filePath to inspect a specific file, or with query to search the workspace.",
        parameters: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description:
                        "Path to the file to get symbols from (relative to workspace root). If omitted, searches the entire workspace.",
                },
                query: {
                    type: "string",
                    description:
                        "Query string for workspace symbol search (e.g., 'MyClass'). Only used when filePath is omitted.",
                },
            },
            required: [],
        },
    },
};

/**
 * Renames a symbol across the entire workspace using the language server.
 * Saves all affected files after the rename.
 *
 * @param args.filePath - File containing the symbol.
 * @param args.line - 1-based line number of the symbol.
 * @param args.character - 0-based character position of the symbol.
 * @param args.newName - New name for the symbol.
 */
export async function renameSymbol_exec(args: {
    filePath: string;
    line: number;
    character: number;
    newName: string;
}): Promise<string> {
    logMsg(
        `Agent - tool use renameSymbol file=${args.filePath} line=${args.line} char=${args.character} newName=${args.newName}`,
    );

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
        const position = new vscode.Position(args.line - 1, args.character);

        const edit = await vscode.commands.executeCommand<vscode.WorkspaceEdit>(
            "vscode.executeDocumentRenameProvider",
            uri,
            position,
            args.newName,
        );

        if (!edit) {
            return JSON.stringify({ error: "No rename provider available for this symbol" });
        }

        const success = await vscode.workspace.applyEdit(edit);
        if (!success) {
            return JSON.stringify({ error: "Failed to apply rename changes" });
        }

        // Save all affected files to disk
        const changedFiles: string[] = [];
        let changeCount = 0;
        for (const [entryUri, edits] of edit.entries()) {
            changedFiles.push(path.relative(root, entryUri.fsPath));
            changeCount += edits.length;

            const doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === entryUri.toString());
            if (doc && doc.isDirty) {
                await doc.save();
            }
        }

        return JSON.stringify({
            success: true,
            message: `Renamed to '${args.newName}': ${changeCount} change(s) in ${changedFiles.length} file(s)`,
            changedFiles,
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logMsg(`Agent - renameSymbol error: ${msg}`);
        return JSON.stringify({ error: `Failed to rename symbol: ${msg}` });
    }
}

export const renameSymbol_def = {
    type: "function" as const,
    function: {
        name: "renameSymbol",
        description:
            "Rename a symbol across the entire workspace using the language server. Type-aware: updates all references, imports, and usages. Use getSymbols first to find the exact line and character position. The line and character values from getSymbols output can be passed directly.",
        parameters: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "Path to the file containing the symbol (relative to workspace root).",
                },
                line: {
                    type: "number",
                    description: "Line number where the symbol is located (1-based, as returned by getSymbols).",
                },
                character: {
                    type: "number",
                    description: "Character position where the symbol is located (0-based, as returned by getSymbols).",
                },
                newName: {
                    type: "string",
                    description: "The new name for the symbol.",
                },
            },
            required: ["filePath", "line", "character", "newName"],
        },
    },
};

/**
 * Finds all references to a symbol across the workspace.
 *
 * @param args.filePath - File containing the symbol.
 * @param args.line - 1-based line number of the symbol.
 * @param args.character - 0-based character position of the symbol.
 */
export async function findReferences_exec(args: {
    filePath: string;
    line: number;
    character: number;
}): Promise<string> {
    logMsg(`Agent - tool use findReferences file=${args.filePath} line=${args.line} char=${args.character}`);

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
        const position = new vscode.Position(args.line - 1, args.character);

        const references = await vscode.commands.executeCommand<vscode.Location[]>(
            "vscode.executeReferenceProvider",
            uri,
            position,
        );

        if (!references || references.length === 0) {
            return JSON.stringify({
                referencesByFile: {},
                count: 0,
                message: "No references found",
            });
        }

        // Group references by file, with 1-based line numbers
        const referencesByFile: Record<string, Array<{ line: number; character: number }>> = {};
        for (const ref of references) {
            if (!isWithinRoot(root, ref.uri.fsPath)) {
                continue;
            }
            const relPath = path.relative(root, ref.uri.fsPath);
            if (!referencesByFile[relPath]) {
                referencesByFile[relPath] = [];
            }
            referencesByFile[relPath].push({
                line: ref.range.start.line + 1,
                character: ref.range.start.character,
            });
        }

        const totalCount = Object.values(referencesByFile).reduce((sum, refs) => sum + refs.length, 0);

        return JSON.stringify({
            referencesByFile,
            count: totalCount,
            message: `Found ${totalCount} reference(s) in ${Object.keys(referencesByFile).length} file(s)`,
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logMsg(`Agent - findReferences error: ${msg}`);
        return JSON.stringify({ error: `Failed to find references: ${msg}` });
    }
}

export const findReferences_def = {
    type: "function" as const,
    function: {
        name: "findReferences",
        description:
            "Find all references to a symbol across the workspace. Returns references grouped by file with 1-based line numbers. Use getSymbols first to find the exact line and character position.",
        parameters: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "Path to the file containing the symbol (relative to workspace root).",
                },
                line: {
                    type: "number",
                    description: "Line number where the symbol is located (1-based, as returned by getSymbols).",
                },
                character: {
                    type: "number",
                    description: "Character position where the symbol is located (0-based, as returned by getSymbols).",
                },
            },
            required: ["filePath", "line", "character"],
        },
    },
};

/**
 * Severity string mapping for VS Code DiagnosticSeverity.
 */
const DIAGNOSTIC_SEVERITY: Record<number, string> = {
    0: "error",
    1: "warning",
    2: "info",
    3: "hint",
};

/**
 * Gets diagnostics (errors, warnings, etc.) from the language server.
 * Uses `vscode.languages.getDiagnostics()` to surface TypeScript errors,
 * broken imports, unused variables, and other problems without running a build.
 *
 * @param args.filePath - Optional. File to get diagnostics for. If omitted, returns all workspace diagnostics.
 * @param args.severity - Optional. Filter by minimum severity: "error", "warning", "info", "hint". Defaults to "warning".
 */
export async function getDiagnostics_exec(args: { filePath?: string; severity?: string }): Promise<string> {
    logMsg(`Agent - tool use getDiagnostics file=${args.filePath ?? "all"} severity=${args.severity ?? "warning"}`);

    const root = getWorkspaceRoot();
    if (!root) {
        return JSON.stringify({ error: "No workspace root" });
    }

    const severityMap: Record<string, number> = { error: 0, warning: 1, info: 2, hint: 3 };
    const maxSeverity = severityMap[args.severity ?? "warning"] ?? 1;

    try {
        if (args.filePath) {
            // Single file diagnostics
            const fullPath = path.resolve(root, args.filePath);
            if (!isWithinRoot(root, fullPath)) {
                return JSON.stringify({ error: "Path must not escape the workspace root" });
            }

            const uri = vscode.Uri.file(fullPath);

            // Open the document to ensure the language server has analysed it
            await vscode.workspace.openTextDocument(uri);

            const diagnostics = vscode.languages.getDiagnostics(uri);
            const filtered = diagnostics
                .filter((d) => d.severity <= maxSeverity)
                .map((d) => ({
                    line: d.range.start.line + 1,
                    character: d.range.start.character,
                    severity: DIAGNOSTIC_SEVERITY[d.severity] ?? "unknown",
                    message: d.message,
                    source: d.source || undefined,
                    code: d.code !== undefined ? String(typeof d.code === "object" ? d.code.value : d.code) : undefined,
                }));

            return JSON.stringify({
                filePath: args.filePath,
                diagnostics: filtered,
                count: filtered.length,
            });
        }

        // All workspace diagnostics
        const allDiagnostics = vscode.languages.getDiagnostics();
        const diagnosticsByFile: Record<
            string,
            Array<{ line: number; character: number; severity: string; message: string; source?: string; code?: string }>
        > = {};
        let totalCount = 0;

        for (const [uri, diagnostics] of allDiagnostics) {
            if (!isWithinRoot(root, uri.fsPath)) {
                continue;
            }

            const filtered = diagnostics
                .filter((d) => d.severity <= maxSeverity)
                .map((d) => ({
                    line: d.range.start.line + 1,
                    character: d.range.start.character,
                    severity: DIAGNOSTIC_SEVERITY[d.severity] ?? "unknown",
                    message: d.message,
                    source: d.source || undefined,
                    code: d.code !== undefined ? String(typeof d.code === "object" ? d.code.value : d.code) : undefined,
                }));

            if (filtered.length > 0) {
                const relPath = path.relative(root, uri.fsPath);
                diagnosticsByFile[relPath] = filtered;
                totalCount += filtered.length;
            }
        }

        return JSON.stringify({
            diagnosticsByFile,
            count: totalCount,
            fileCount: Object.keys(diagnosticsByFile).length,
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logMsg(`Agent - getDiagnostics error: ${msg}`);
        return JSON.stringify({ error: `Failed to get diagnostics: ${msg}` });
    }
}

export const getDiagnostics_def = {
    type: "function" as const,
    function: {
        name: "getDiagnostics",
        description:
            "Get diagnostics (errors, warnings, hints) from the language server. Shows TypeScript errors, broken imports, unused variables, and other problems without running a build. Use after editing files to verify changes didn't introduce errors.",
        parameters: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description:
                        "Path to the file to check (relative to workspace root). If omitted, returns diagnostics for all open workspace files.",
                },
                severity: {
                    type: "string",
                    enum: ["error", "warning", "info", "hint"],
                    description:
                        "Minimum severity level to include. 'error' shows only errors, 'warning' shows errors and warnings (default), 'hint' shows everything.",
                },
            },
            required: [],
        },
    },
};
