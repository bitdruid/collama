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

type DiagnosticsOutput = {
    diagnostics: DiagnosticEntry[];
    count: number;
};

/**
 * Waits for the LSP to publish diagnostics for the given URI.
 * Resolves after a quiet period (no new events for `quietMs`) or a hard timeout.
 * Without this, `getDiagnostics` returns whatever was last published — often empty right after opening/editing.
 */
async function waitForDiagnostics(uri: vscode.Uri, timeoutMs = 5000, quietMs = 400): Promise<void> {
    return new Promise((resolve) => {
        const uriStr = uri.toString();
        let quietTimer: NodeJS.Timeout | undefined;
        let done = false;
        const finish = () => {
            if (done) {
                return;
            }
            done = true;
            sub.dispose();
            clearTimeout(hardTimer);
            clearTimeout(quietTimer);
            resolve();
        };
        const sub = vscode.languages.onDidChangeDiagnostics((e) => {
            if (e.uris.some((u) => u.toString() === uriStr)) {
                clearTimeout(quietTimer);
                quietTimer = setTimeout(finish, quietMs);
            }
        });
        const hardTimer = setTimeout(finish, timeoutMs);
        // No initial quiet timer — wait for the first event before starting the quiet window.
        // Starting it immediately would resolve before the TS server publishes its first diagnostics.
    });
}

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

async function runDiagnostics(root: string, filePath: string): Promise<ToolAnswer<DiagnosticsOutput>> {
    const fullPath = path.resolve(root, filePath);
    if (!isWithinRoot(root, fullPath)) {
        return toolError("Path must not escape the workspace root");
    }
    const uri = vscode.Uri.file(fullPath);
    await vscode.workspace.openTextDocument(uri);
    await waitForDiagnostics(uri);
    const filtered = vscode.languages
        .getDiagnostics(uri)
        .filter((d) => d.severity <= MAX_SEVERITY)
        .map(mapDiagnostic);
    return toolSuccess({ diagnostics: filtered, count: filtered.length });
}

export async function diagnostics_exec(args: { filePath: string }): Promise<ToolAnswer<DiagnosticsOutput>> {
    logMsg(`Agent - use diagnostics-tool file=${args.filePath}`);

    const root = getWorkspaceRoot();
    if (!root) {
        return toolError("No workspace root");
    }

    try {
        return await runDiagnostics(root, args.filePath);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return toolError(`diagnostics failed: ${msg}`);
    }
}

export const diagnostics_def = {
    type: "function" as const,
    function: {
        name: "diagnostics",
        description: "Returns LSP errors/warnings for a file. Call this after editing a file to verify the changes.",
        parameters: {
            type: "object",
            properties: {
                explanation: {
                    type: "string",
                    description: "One sentence explaining why this tool call is needed for the user's request.",
                },
                filePath: {
                    type: "string",
                    description: "Path relative to workspace root.",
                },
            },
            required: ["explanation", "filePath"],
        },
    },
};
