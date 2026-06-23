import * as vscode from "vscode";
import type { MemoryEntry, MemoryScope, MemoryViewEntry } from "../chat/shared";
import { broadcastUserConfig } from "../config";
import { logMsg } from "../logging";

export type { MemoryEntry, MemoryScope, MemoryViewEntry };

export type MemoryMap = Record<string, MemoryEntry>;

const GLOBAL_STATE_KEY = "collama.memory";
const WORKSPACE_FILE = ".collama/MEMORY.json";

let extContextRef: vscode.ExtensionContext | null = null;
let cachedWorkspaceMemory: MemoryMap = {};
let fileWatcher: vscode.FileSystemWatcher | null = null;

/** Stores the extension context so global-scope memory can reach `globalState`. */
export function initMemory(extContext: vscode.ExtensionContext): void {
    extContextRef = extContext;
}

function getWorkspaceRoot(): vscode.WorkspaceFolder | undefined {
    return vscode.workspace.workspaceFolders?.[0];
}

/** Returns the workspace `.collama/MEMORY.json` URI, or null if no workspace is open. */
function findWorkspaceMemoryUri(): vscode.Uri | null {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        return null;
    }
    return vscode.Uri.joinPath(workspaceRoot.uri, WORKSPACE_FILE);
}

/** Normalizes a key into a tidy, collision-safe slug (`deploy process` → `deploy-process`). */
function slugify(key: string): string {
    return key
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function isMemoryMap(value: unknown): value is MemoryMap {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }
    return Object.values(value as Record<string, unknown>).every(
        (entry) =>
            !!entry &&
            typeof entry === "object" &&
            typeof (entry as MemoryEntry).short === "string" &&
            typeof (entry as MemoryEntry).long === "string",
    );
}

// ---------- global scope (globalState) ----------

function getGlobalMemory(): MemoryMap {
    const stored = extContextRef?.globalState.get<unknown>(GLOBAL_STATE_KEY);
    return isMemoryMap(stored) ? stored : {};
}

async function setGlobalMemory(map: MemoryMap): Promise<void> {
    await extContextRef?.globalState.update(GLOBAL_STATE_KEY, map);
}

// ---------- workspace scope (.collama/MEMORY.json) ----------

/**
 * Reads and caches workspace memory from `.collama/MEMORY.json`.
 * Caches an empty map if the file is missing or malformed.
 */
export async function loadWorkspaceMemory(): Promise<MemoryMap> {
    const uri = findWorkspaceMemoryUri();
    if (!uri) {
        cachedWorkspaceMemory = {};
        return cachedWorkspaceMemory;
    }

    try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        const text = new TextDecoder("utf-8").decode(bytes).trim();
        const parsed = text ? JSON.parse(text) : {};
        cachedWorkspaceMemory = isMemoryMap(parsed) ? parsed : {};
        const count = Object.keys(cachedWorkspaceMemory).length;
        logMsg(`MEMORY.json loaded: ${count} ${count === 1 ? "entry" : "entries"}`);
    } catch (err) {
        cachedWorkspaceMemory = {};
        if (!(err instanceof vscode.FileSystemError && err.code === "FileNotFound")) {
            logMsg(`Failed to read MEMORY.json: ${err}`);
        }
    }
    return cachedWorkspaceMemory;
}

async function saveWorkspaceMemory(map: MemoryMap): Promise<void> {
    const uri = findWorkspaceMemoryUri();
    if (!uri) {
        throw new Error("No workspace open; cannot store workspace memory.");
    }
    const dir = vscode.Uri.joinPath(uri, "..");
    await vscode.workspace.fs.createDirectory(dir);
    const text = `${JSON.stringify(map, null, 2)}\n`;
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(text));
    cachedWorkspaceMemory = map;
}

// ---------- public CRUD ----------

/** Persists a memory under `scope`. Returns the slugified key actually used. */
export async function writeMemory(key: string, short: string, long: string, scope: MemoryScope): Promise<string> {
    const slug = slugify(key);
    const entry: MemoryEntry = { short, long };
    if (scope === "global") {
        await setGlobalMemory({ ...getGlobalMemory(), [slug]: entry });
    } else {
        await saveWorkspaceMemory({ ...cachedWorkspaceMemory, [slug]: entry });
    }
    broadcastUserConfig();
    return slug;
}

/** Removes a memory. Returns whether an entry was actually deleted. */
export async function deleteMemory(key: string, scope: MemoryScope): Promise<boolean> {
    const slug = slugify(key);
    if (scope === "global") {
        const map = getGlobalMemory();
        if (!(slug in map)) {
            return false;
        }
        delete map[slug];
        await setGlobalMemory(map);
        broadcastUserConfig();
        return true;
    }
    const map = { ...cachedWorkspaceMemory };
    if (!(slug in map)) {
        return false;
    }
    delete map[slug];
    await saveWorkspaceMemory(map);
    broadcastUserConfig();
    return true;
}

/**
 * Returns the full (`long`) text of a memory.
 * If `scope` is omitted, searches workspace first, then global.
 */
export function readMemory(key: string, scope?: MemoryScope): string | null {
    const slug = slugify(key);
    if (scope === "global") {
        return getGlobalMemory()[slug]?.long ?? null;
    }
    if (scope === "workspace") {
        return cachedWorkspaceMemory[slug]?.long ?? null;
    }
    return cachedWorkspaceMemory[slug]?.long ?? getGlobalMemory()[slug]?.long ?? null;
}

/** Returns all memories across both scopes, for the viewer. */
export function getAllMemory(): MemoryViewEntry[] {
    const entries: MemoryViewEntry[] = [];
    for (const [key, entry] of Object.entries(getGlobalMemory())) {
        entries.push({ scope: "global", key, ...entry });
    }
    for (const [key, entry] of Object.entries(cachedWorkspaceMemory)) {
        entries.push({ scope: "workspace", key, ...entry });
    }
    return entries;
}

/** True if any memory exists in either scope. */
export function isMemoryActive(): boolean {
    return Object.keys(getGlobalMemory()).length > 0 || Object.keys(cachedWorkspaceMemory).length > 0;
}

/**
 * Builds the prompt block: an index of `[scope] key — summary` lines.
 * Returns null when no memories exist.
 */
export function getMemoryPromptBlock(): string | null {
    const entries = getAllMemory();
    if (entries.length === 0) {
        return null;
    }
    const lines = [
        "Important facts, stored by you. Each line is [scope] key — summary.",
        'Use the `memory` tool ("write", "read", "delete") with a `key` to manipulate.',
        "Store information, data or references that may be reused in the future.",
        "Read memory as soon as information may match.",
        "<memories>",
        ...entries.map((e) => `[${e.scope}] ${e.key} — ${e.short}`),
        "</memories>",
    ];
    return lines.join("\n");
}

/**
 * Watches `.collama/MEMORY.json` and re-caches + rebroadcasts on change.
 */
export function registerMemoryWatcher(extContext: vscode.ExtensionContext): void {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        return;
    }

    const pattern = new vscode.RelativePattern(workspaceRoot, WORKSPACE_FILE);
    fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

    const reload = async () => {
        await loadWorkspaceMemory();
        broadcastUserConfig();
    };
    fileWatcher.onDidChange(reload);
    fileWatcher.onDidCreate(reload);
    fileWatcher.onDidDelete(async () => {
        cachedWorkspaceMemory = {};
        broadcastUserConfig();
    });

    extContext.subscriptions.push(fileWatcher);
}
