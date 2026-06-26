import { getWebview } from "../../chat/backend/utils";
import { logMsg } from "../../logging";

// -- Tool confirmation via webview --
//
// Shared approval infrastructure for tools (edit, create, delete, shell, notebook).
// Kept tool-agnostic so no tool needs to import another tool to ask for confirmation.

const _pending = new Map<string, (result: { value: string | null; reason: string }) => void>();
let _idCounter = 0;

/** Resolves a pending tool confirmation. Called when the webview responds. */
export function resolveToolConfirm(id: string, value: string, reason: string): void {
    const resolve = _pending.get(id);
    if (resolve) {
        _pending.delete(id);
        resolve(value === "cancel" ? { value: null, reason } : { value, reason });
    }
}

/** Resolves all pending tool confirmations with null (used when the agent is cancelled). */
export function cancelAllPendingConfirms(): void {
    for (const [id, resolve] of _pending) {
        _pending.delete(id);
        resolve({ value: null, reason: "Agent was cancelled" });
    }
}

/** Sends a confirmation request to the webview and awaits the user's response. */
export function requestToolConfirm(
    action: string,
    filePath: string,
    explanation: string,
    dangerous = false,
): Promise<{ value: string | null; reason: string }> {
    const webview = getWebview();
    if (!webview) {
        return Promise.resolve({ value: "accept", reason: "No webview available" });
    }
    const id = String(++_idCounter);
    return new Promise((resolve) => {
        _pending.set(id, resolve);
        webview.postMessage({ type: "tool-confirm-request", id, action, filePath, explanation, dangerous });
    });
}

// -- Auto-accept flags --
//
// One flag per confirming action. Each is set when its "Accept All" is chosen and stays on
// until resetAutoAcceptEdits() runs at the start of the next agent turn — except when the
// frontend toggle is active, which keeps them on across turns until toggled off.

let autoAcceptEdits = false;
let autoAcceptFileCreates = false;
let autoAcceptFolderCreates = false;
let autoAcceptDeletes = false;
let autoAcceptShell = false;
let frontendAutoAcceptActive = false;

/** Whether the frontend "auto-accept all" toggle is on (persists across turns). */
export function getAutoAcceptAll(): boolean {
    return frontendAutoAcceptActive;
}

/** Sets all auto-accept flags at once. Called by the frontend "auto-accept all" toggle button. */
export function setAutoAcceptAll(enabled: boolean): void {
    frontendAutoAcceptActive = enabled;
    autoAcceptEdits = enabled;
    autoAcceptFileCreates = enabled;
    autoAcceptFolderCreates = enabled;
    autoAcceptDeletes = enabled;
    autoAcceptShell = enabled;
    logMsg(`Auto-accept ${enabled ? "enabled" : "disabled"}`);
}

/**
 * Resets the per-turn auto-accept flags (from "Accept All" bulk actions).
 * Skips reset when the frontend toggle is active.
 */
export function resetAutoAcceptEdits(): void {
    if (frontendAutoAcceptActive) {
        return;
    }
    autoAcceptEdits = false;
    autoAcceptFileCreates = false;
    autoAcceptFolderCreates = false;
    autoAcceptDeletes = false;
    autoAcceptShell = false;
}

/** Whether edits currently apply without showing a diff preview. */
export function getAutoAcceptEdits(): boolean {
    return autoAcceptEdits;
}

/** Enables/disables auto-accept for edits (e.g. when a tool's "Accept All" is chosen). */
export function setAutoAcceptEdits(enabled: boolean): void {
    autoAcceptEdits = enabled;
}

/** Whether file creates currently apply without a preview. */
export function getAutoAcceptFileCreates(): boolean {
    return autoAcceptFileCreates;
}

export function setAutoAcceptFileCreates(enabled: boolean): void {
    autoAcceptFileCreates = enabled;
}

/** Whether folder creates currently apply without confirmation. */
export function getAutoAcceptFolderCreates(): boolean {
    return autoAcceptFolderCreates;
}

export function setAutoAcceptFolderCreates(enabled: boolean): void {
    autoAcceptFolderCreates = enabled;
}

/** Whether deletes currently apply without confirmation. */
export function getAutoAcceptDeletes(): boolean {
    return autoAcceptDeletes;
}

export function setAutoAcceptDeletes(enabled: boolean): void {
    autoAcceptDeletes = enabled;
}

/** Whether shell commands currently run without confirmation. */
export function getAutoAcceptShell(): boolean {
    return autoAcceptShell;
}

export function setAutoAcceptShell(enabled: boolean): void {
    autoAcceptShell = enabled;
}
