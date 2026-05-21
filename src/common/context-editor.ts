import * as path from "path";
import * as vscode from "vscode";
import { logMsg } from "../logging";
import Tokenizer from "./tokenizer";
const { showErrorMessage } = vscode.window;

/**
 * Computes the relative path from workspace root for a given URI.
 * Falls back to the absolute fsPath when the URI is outside any workspace folder,
 * so the result can still round-trip through {@link parseContextUri}.
 */
export function getRelativePath(uri: vscode.Uri): string {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (workspaceFolder) {
        return vscode.workspace.asRelativePath(uri);
    }
    return uri.fsPath;
}

/**
 * Parses a stringified path or URI into a {@link vscode.Uri}.
 * Resolves bare relative paths against the first workspace folder.
 */
export function parseContextUri(input: string): vscode.Uri {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input) || input.startsWith("file:")) {
        return vscode.Uri.parse(input);
    }
    const isAbs = input.startsWith("/") || /^[a-zA-Z]:/.test(input);
    if (isAbs) {
        return vscode.Uri.file(input);
    }
    const root = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (root) {
        return vscode.Uri.joinPath(root, input);
    }
    return vscode.Uri.file(input);
}

export interface OpenFilesContext {
    relativePath: string;
    content: string;
    tokens: number;
    priority?: number; // low prio = drop first
}

export interface ContextTokens {
    prefix: number;
    suffix: number;
    selection: number;
    activeFile: number;
    openFiles: number;
    total: number;
}

/** Shape posted to the webview as the body of a `context-update` message. */
export interface ContextWebviewPayload {
    fileName: string;
    relativePath: string;
    isFolder: boolean;
    hasSelection: boolean;
    startLine: number;
    endLine: number;
    content: string;
}

/**
 * Single source of truth for context objects consumed by autocomplete, chat send-to-chat,
 * and explorer add. Instantiate with `new EditorContext()` and populate via one of:
 *
 * - {@link loadActiveEditor} - active text editor (pass `{ includeCompletionData: true }`
 *   to also fill `activePrefix`, `activeSuffix`, `openFiles`, and `tokens` for autocomplete).
 * - {@link loadUri} - workspace URI for a file or folder.
 *
 * Both return `this` on success and `null` on failure.
 */
export class EditorContext {
    uri!: vscode.Uri;
    isFolder = false;
    content = "";
    selectionText = "";
    selectionRange: vscode.Selection | null = null;
    textEditor: vscode.TextEditor | null = null;

    // Populated only by loadActiveEditor({ includeCompletionData: true }).
    activePrefix: string | null = null;
    activeSuffix: string | null = null;
    openFiles: OpenFilesContext[] | null = null;
    tokens: ContextTokens | null = null;

    get fileName(): string {
        return path.basename(this.uri.fsPath);
    }
    get relativePath(): string {
        return getRelativePath(this.uri);
    }
    get hasSelection(): boolean {
        return this.selectionText.length > 0;
    }
    /** Alias retained for callers that previously read `activePrefix + activeSuffix`. */
    get activeFileText(): string {
        return this.content;
    }
    get selectionObject(): vscode.Selection {
        if (!this.selectionRange) {
            throw new Error("EditorContext has no selection range");
        }
        return this.selectionRange;
    }
    get selectionStartLine(): number {
        return this.selectionRange?.start.line ?? 0;
    }
    get selectionEndLine(): number {
        return this.selectionRange?.end.line ?? 0;
    }
    get selectionStartCharacter(): number {
        return this.selectionRange?.start.character ?? 0;
    }
    get selectionEndCharacter(): number {
        return this.selectionRange?.end.character ?? 0;
    }

    /**
     * Populates from the currently active text editor.
     *
     * @param opts.includeCompletionData - populate `activePrefix`, `activeSuffix`, `openFiles`,
     *                                     and `tokens`. Required for autocomplete; off elsewhere.
     */
    async loadActiveEditor(opts: { includeCompletionData?: boolean } = {}): Promise<this | null> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            showErrorMessage("collama: Could not find active editor!");
            return null;
        }

        const document = editor.document;
        const selection = editor.selection;
        this.uri = document.uri;
        this.content = document.getText();
        this.selectionText = document.getText(selection).trim();
        this.selectionRange = selection;
        this.textEditor = editor;

        if (!opts.includeCompletionData) {
            return this;
        }

        const cursor = selection.active;
        const prefix = document.getText(new vscode.Range(document.lineAt(0).range.start, cursor));
        const suffix = document.getText(new vscode.Range(cursor, document.lineAt(document.lineCount - 1).range.end));

        // URIs of actually open tabs (not just documents loaded in memory).
        const openTabUris = new Set<string>();
        for (const group of vscode.window.tabGroups.all) {
            for (const tab of group.tabs) {
                if (tab.input instanceof vscode.TabInputText) {
                    openTabUris.add(tab.input.uri.toString());
                }
            }
        }

        const openFileDocs = vscode.workspace.textDocuments.filter(
            (doc) => doc.uri.scheme === "file" && doc !== document && openTabUris.has(doc.uri.toString()),
        );

        const openFiles: OpenFilesContext[] = await Promise.all(
            openFileDocs.map(async (doc) => ({
                relativePath: getRelativePath(doc.uri),
                content: doc.getText(),
                tokens: await Tokenizer.calcTokens(doc.getText()),
            })),
        );

        const [prefixTokens, suffixTokens, selectionTokens, activeFileTokens] = await Promise.all([
            Tokenizer.calcTokens(prefix),
            Tokenizer.calcTokens(suffix),
            Tokenizer.calcTokens(this.selectionText),
            Tokenizer.calcTokens(prefix + suffix + this.selectionText),
        ]);

        const openFilesTokens = openFiles.reduce((sum, file) => sum + file.tokens, 0);

        this.activePrefix = prefix;
        this.activeSuffix = suffix;
        this.openFiles = openFiles;
        this.tokens = {
            prefix: prefixTokens,
            suffix: suffixTokens,
            selection: selectionTokens,
            activeFile: activeFileTokens,
            openFiles: openFilesTokens,
            total: prefixTokens + suffixTokens + selectionTokens + openFilesTokens,
        };
        return this;
    }

    /**
     * Populates from a workspace URI. Auto-detects file vs folder via `fs.stat`.
     * Folder content is a one-line-per-entry directory listing; file content is the file text.
     */
    async loadUri(uri: vscode.Uri): Promise<this | null> {
        try {
            const stat = await vscode.workspace.fs.stat(uri);
            this.uri = uri;
            this.isFolder = stat.type === vscode.FileType.Directory;

            if (this.isFolder) {
                const entries = await vscode.workspace.fs.readDirectory(uri);
                this.content = entries
                    .map(([name, type]) => `${type === vscode.FileType.Directory ? "[dir]  " : "       "}${name}`)
                    .join("\n");
            } else {
                const bytes = await vscode.workspace.fs.readFile(uri);
                this.content = Buffer.from(bytes).toString("utf8");
            }
            return this;
        } catch (err) {
            logMsg(`Failed to load EditorContext from URI ${uri.toString()}: ${err}`);
            return null;
        }
    }

    /** Serializes to the shape the webview expects in a `context-update` message. */
    toWebviewPayload(): ContextWebviewPayload {
        const hasSelection = this.hasSelection;
        const suffix = this.isFolder ? "/" : "";
        return {
            fileName: this.fileName + suffix,
            relativePath: this.relativePath + suffix,
            isFolder: this.isFolder,
            hasSelection,
            startLine: hasSelection ? this.selectionStartLine + 1 : 0,
            endLine: hasSelection ? this.selectionEndLine + 1 : 0,
            content: hasSelection ? this.selectionText : this.content,
        };
    }

    /**
     * Prunes `openFiles` to fit within `maxTokens` (mutates in place).
     * No-op when called on a context loaded without completion data.
     */
    recreateTokenLimit(maxTokens: number): this {
        if (!this.tokens || !this.openFiles) {
            return this;
        }

        const fixedTokens = this.tokens.prefix + this.tokens.suffix + this.tokens.selection;
        let remaining = maxTokens - fixedTokens;

        logMsg(`CONTEXT - Evaluating token budget [model-max=${maxTokens} / use-current=${this.tokens.total}]`);

        if (remaining <= 0) {
            logMsg(`CONTEXT - Dropped all open files [total-tokens=${this.tokens.total} / limit=${maxTokens}]`);
            this.openFiles = [];
            this.tokens = { ...this.tokens, openFiles: 0, total: fixedTokens };
            return this;
        }

        const sorted = [...this.openFiles].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
        const kept: OpenFilesContext[] = [];
        let openFilesTokens = 0;

        for (const file of sorted) {
            if (file.tokens <= remaining) {
                kept.push(file);
                remaining -= file.tokens;
                openFilesTokens += file.tokens;
            } else {
                logMsg(
                    `CONTEXT - Dropped file ${path.basename(file.relativePath)} [file-tokens=${file.tokens} / remaining=${remaining}]`,
                );
            }
        }

        this.openFiles = kept;
        this.tokens = { ...this.tokens, openFiles: openFilesTokens, total: fixedTokens + openFilesTokens };
        return this;
    }
}
