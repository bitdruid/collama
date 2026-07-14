import path from "path";
import * as vscode from "vscode";
import { ToolAnswer, isWithinRoot, toolError, toolSuccess } from "../../tools";

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
    // Short hard timeout: files without a language server never publish, and this runs
    // inline after every write — cap the wasted wait instead of the tool's old 5s.
    await waitForDiagnostics(uri, 1500);
    const filtered = vscode.languages
        .getDiagnostics(uri)
        .filter((d) => d.severity <= MAX_SEVERITY)
        .map(mapDiagnostic);
    return toolSuccess({ diagnostics: filtered, count: filtered.length });
}

/**
 * Collects LSP errors/warnings for a file after a write. Never throws — returns empty on
 * failure so a diagnostics hiccup can't fail an edit that already applied.
 */
async function collectFileDiagnostics(root: string, filePath: string): Promise<DiagnosticsOutput> {
    try {
        const result = await runDiagnostics(root, filePath);
        return result.output ?? { diagnostics: [], count: 0 };
    } catch {
        return { diagnostics: [], count: 0 };
    }
}

/**
 * Success answer for a file-writing tool, with the file's current LSP problems appended when
 * present so the model sees its own errors without a follow-up call.
 */
export async function successWithDiagnostics(
    root: string,
    filePath: string,
    message: string,
): Promise<ToolAnswer<{ filePath: string; diagnostics?: DiagnosticEntry[] }>> {
    const { diagnostics, count } = await collectFileDiagnostics(root, filePath);
    return toolSuccess(
        { filePath, ...(count > 0 && { diagnostics }) },
        count > 0 ? `${message} File now has ${count} problem(s).` : message,
    );
}
