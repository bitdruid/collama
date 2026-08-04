import os from "os";
import path from "path";
import * as vscode from "vscode";
import { logAgent } from "../../../logging";

// Path resolution and containment checks shared by every tool that touches the filesystem.

/**
 * Retrieves the absolute file system path of the current workspace root.
 *
 * @returns The workspace root path as a string, or null if no workspace is open.
 */
export function getWorkspaceRoot(): string | null {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return null;
    }
    return folders[0].uri.fsPath;
}

/**
 * Returns true if the given resolvedPath is strictly within root (no traversal).
 */
export function isWithinRoot(root: string, resolvedPath: string): boolean {
    const normalizedRoot = path.resolve(root);
    const normalizedPath = path.resolve(resolvedPath);
    return normalizedPath === normalizedRoot || normalizedPath.startsWith(normalizedRoot + path.sep);
}

/**
 * Returns true if the given resolvedPath is within allowed temp directories.
 * Allowed: os.tmpdir()
 */
export function isWithinAllowedTemp(resolvedPath: string): boolean {
    const normalizedPath = path.resolve(resolvedPath);
    const tmpDir = os.tmpdir();
    const normalizedTmp = path.resolve(tmpDir);
    return normalizedPath === normalizedTmp || normalizedPath.startsWith(normalizedTmp + path.sep);
}

/**
 * Resolves a relative path against the workspace root and validates it doesn't escape.
 * `allowTemp` additionally permits os.tmpdir() - read-only callers pass true (e.g. to
 * read shell's spilled output); edit tools stay workspace-bound.
 * Returns { root, fullPath } on success, or { error } (a ready-to-return JSON string) on failure.
 */
export function secureWorkspace(
    relPath: string,
    toolName: string,
    allowTemp = false,
): { root: string; fullPath: string; error: string } {
    const root = getWorkspaceRoot();
    if (!root) {
        logAgent(`[${toolName}] No workspace root`);
        return { root: "", fullPath: "", error: "No workspace root" };
    }
    const fullPath = path.resolve(root, relPath);
    if (isWithinRoot(root, fullPath)) {
        return { root, fullPath, error: "" };
    }
    if (allowTemp && isWithinAllowedTemp(fullPath)) {
        return { root: os.tmpdir(), fullPath, error: "" };
    }
    logAgent(`[${toolName}] Path must not escape the workspace root: ${relPath}`);
    return { root: "", fullPath: "", error: "Path must not escape the workspace root" };
}
