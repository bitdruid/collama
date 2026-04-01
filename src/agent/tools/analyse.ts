import path from "path";
import * as vscode from "vscode";
import { logAgent, logMsg } from "../../logging";
import { getWorkspaceRoot, isWithinRoot } from "../tools";

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
    logMsg(`Agent - use getDiagnostics-tool file=${args.filePath ?? "all"} severity=${args.severity ?? "warning"}`);

    const root = getWorkspaceRoot();
    if (!root) {
        logAgent(`[getDiagnostics-tool] No workspace root`);
        return JSON.stringify({ error: "No workspace root" });
    }

    const severityMap: Record<string, number> = { error: 0, warning: 1, info: 2, hint: 3 };
    const maxSeverity = severityMap[args.severity ?? "warning"] ?? 1;

    try {
        if (args.filePath) {
            // Single file diagnostics
            const fullPath = path.resolve(root, args.filePath);
            if (!isWithinRoot(root, fullPath)) {
                logAgent(`[getDiagnostics-tool] Path must not escape the workspace root: ${args.filePath}`);
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
            Array<{
                line: number;
                character: number;
                severity: string;
                message: string;
                source?: string;
                code?: string;
            }>
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
        logAgent(`[getDiagnostics-tool] Failed to get diagnostics: ${msg}`);
        logMsg(`Agent - getDiagnostics-tool error: ${msg}`);
        return JSON.stringify({ error: `Failed to get diagnostics: ${msg}` });
    }
}

export const getDiagnostics_prompt =
    "getDiagnostics tool: Get diagnostics (errors, warnings) from the language server.";
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
