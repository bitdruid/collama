import * as path from "path";
import * as vscode from "vscode";
import { logMsg } from "../logging";
import Tokenizer from "./tokenizer";
const { showErrorMessage } = vscode.window;

/**
 * Computes the relative path from workspace root for a given URI.
 * If the file is not in a workspace, returns the file name.
 *
 * @param uri - The URI of the file.
 * @returns The relative path from workspace root, or the file name if not in a workspace.
 */
export function getRelativePath(uri: vscode.Uri): string {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (workspaceFolder) {
        return vscode.workspace.asRelativePath(uri);
    }
    // Fallback to file name if not in a workspace
    return uri.fsPath.split("/").pop() || uri.fsPath;
}

/**
 * Represents the context of an open file in the workspace.
 *
 * @property {string} relativePath - The relative path from workspace root.
 * @property {string} content - The full text content of the file.
 * @property {number} tokens - The token count of the file's content, as calculated by the tokenizer.
 * @property {number} [priority] - Optional priority for the file; lower values indicate higher priority for dropping when token limits are exceeded.
 */
export interface OpenFilesContext {
    relativePath: string;
    content: string;
    tokens: number;
    priority?: number; // low prio = drop first
}

/**
 * Represents token counts for various parts of the context.
 *
 * @property {number} prefix   - Tokens in the text before the cursor.
 * @property {number} suffix   - Tokens in the text after the cursor.
 * @property {number} selection- Tokens in the currently selected text.
 * @property {number} activeFile- Total tokens in the active file.
 * @property {number} openFiles- Total tokens across all other open files.
 * @property {number} total   - Sum of all token counts.
 */
export interface ContextTokens {
    prefix: number;
    suffix: number;
    selection: number;
    activeFile: number;
    openFiles: number;
    total: number;
}

/**
 * Encapsulates the state of the current editor, including selection details,
 * active file content (prefix/suffix), other open files, and calculated token statistics.
 */
export class EditorContext {
    readonly textEditor: vscode.TextEditor;
    readonly selectionObject: vscode.Selection;
    readonly selectionText: string;
    readonly activePrefix: string;
    readonly activeSuffix: string;
    readonly openFiles: OpenFilesContext[];
    readonly tokens: ContextTokens;
    readonly fileName: string;
    readonly filePath: string;
    readonly relativePath: string;
    readonly isFolder: boolean;

    get selectionStartLine(): number {
        return this.selectionObject.start.line;
    }

    get selectionEndLine(): number {
        return this.selectionObject.end.line;
    }

    get selectionStartCharacter(): number {
        return this.selectionObject.start.character;
    }

    get selectionEndCharacter(): number {
        return this.selectionObject.end.character;
    }

    get activeFileText(): string {
        return this.activePrefix + this.activeSuffix;
    }

    /**
     * Private constructor to enforce creation via {@link EditorContext.create}.
     * @param editor - The active text editor.
     * @param selection - The current selection.
     * @param selectionText - Trimmed text of the selection.
     * @param prefix - Text before the cursor.
     * @param suffix - Text after the cursor.
     * @param openFiles - List of other open files.
     * @param tokens - Calculated token counts for the context.
     * @param fileName - The file name.
     * @param filePath - The absolute file path.
     * @param relativePath - The relative path from workspace root.
     * @param isFolder - Whether the path represents a folder.
     */
    private constructor(
        editor: vscode.TextEditor,
        selection: vscode.Selection,
        selectionText: string,
        prefix: string,
        suffix: string,
        openFiles: OpenFilesContext[],
        tokens: ContextTokens,
        fileName: string,
        filePath: string,
        relativePath: string,
        isFolder: boolean,
    ) {
        this.textEditor = editor;
        this.selectionObject = selection;
        this.selectionText = selectionText;
        this.activePrefix = prefix;
        this.activeSuffix = suffix;
        this.openFiles = openFiles;
        this.tokens = tokens;
        this.fileName = fileName;
        this.filePath = filePath;
        this.relativePath = relativePath;
        this.isFolder = isFolder;
    }

    /**
     * Creates an {@link EditorContext} instance from the current active editor.
     *
     * This method gathers the current document, selection, and all other open text files,
     * calculates token counts for each part using the tokenizer, and returns a new {@link EditorContext}
     * object containing the gathered information.
     *
     * If there is no active editor, an error message is shown and the method returns {@code null}.
     *
     * @returns {Promise<EditorContext|null>} A promise that resolves to an {@link EditorContext} instance
     *          representing the current editor state, or {@code null} when no editor is active.
     *
     * @remarks
     * - It filters open documents to those that have an open tab, excluding the active one.
     * - The returned {@link EditorContext} includes token statistics for prefix, suffix, selection,
     *   the active file, and all other open files.
     */
    static async create(): Promise<EditorContext | null> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            showErrorMessage("collama: Could not find active editor!");
            return null;
        }

        const document = editor.document;
        const selection = editor.selection;
        const cursor = selection.active;

        const selectionText = document.getText(selection).trim();

        const prefix = document.getText(new vscode.Range(document.lineAt(0).range.start, cursor));

        const suffix = document.getText(new vscode.Range(cursor, document.lineAt(document.lineCount - 1).range.end));

        // URIs of actually open tabs (not just documents loaded in memory)
        const openTabUris = new Set<string>();
        for (const tabGroup of vscode.window.tabGroups.all) {
            for (const tab of tabGroup.tabs) {
                if (tab.input instanceof vscode.TabInputText) {
                    openTabUris.add(tab.input.uri.toString());
                }
            }
        }

        // filter to only documents that have an open tab, excluding the active one
        const openFileDocs = vscode.workspace.textDocuments.filter(
            (doc) => doc.uri.scheme === "file" && doc !== document && openTabUris.has(doc.uri.toString()),
        );

        const openFiles: OpenFilesContext[] = await Promise.all(
            openFileDocs.map(async (doc) => {
                return {
                    relativePath: getRelativePath(doc.uri),
                    content: doc.getText(),
                    tokens: await Tokenizer.calcTokens(doc.getText()),
                };
            }),
        );

        // Calculate token counts for the selected parts of the context
        const [prefixTokens, suffixTokens, selectionTokens, activeFileTokens] = await Promise.all([
            Tokenizer.calcTokens(prefix),
            Tokenizer.calcTokens(suffix),
            Tokenizer.calcTokens(selectionText),
            Tokenizer.calcTokens(prefix + suffix + selectionText),
        ]);

        const openFilesTokens = openFiles.reduce((acc, file) => acc + file.tokens, 0);

        const tokens: ContextTokens = {
            prefix: prefixTokens,
            suffix: suffixTokens,
            selection: selectionTokens,
            activeFile: activeFileTokens,
            openFiles: openFilesTokens,
            total: prefixTokens + suffixTokens + selectionTokens + openFilesTokens,
        };

        // Compute file metadata
        const fileName = document.fileName.split("/").pop() || document.fileName;
        const filePath = document.fileName;
        const relativePath = getRelativePath(document.uri);
        const isFolder = false; // Editor context is always a file

        return new EditorContext(
            editor,
            selection,
            selectionText,
            prefix,
            suffix,
            openFiles,
            tokens,
            fileName,
            filePath,
            relativePath,
            isFolder,
        );
    }

    /**
     * Recreates the current {@link EditorContext} instance with open files pruned to fit within the specified token limit.
     * The context will not be fetched again - the current context is used as a base.
     *
     * The method calculates the number of tokens that are fixed (prefix, suffix, and selection). If the remaining
     * token budget is non‑positive, it returns a context with no open files. Otherwise, it sorts the open files by
     * priority (lower value indicates higher priority to drop) and includes as many files as possible without
     * exceeding the remaining token budget.
     *
     * @param maxTokens - The maximum number of tokens allowed for the resulting context.
     * @returns A new {@link EditorContext} instance containing the same editor, selection, and active file content,
     *          but with a subset of open files that fit within the token budget.
     */
    recreateTokenLimit(maxTokens: number): EditorContext {
        const fixedTokens = this.tokens.prefix + this.tokens.suffix + this.tokens.selection;

        let remaining = maxTokens - fixedTokens;

        logMsg(`CONTEXT - Evaluating token budget [model-max=${maxTokens} / use-current=${this.tokens.total}]`);

        if (remaining <= 0) {
            logMsg(`CONTEXT - Dropped all open files [total-tokens=${this.tokens.total} / limit=${maxTokens}]`);
            return new EditorContext(
                this.textEditor,
                this.selectionObject,
                this.selectionText,
                this.activePrefix,
                this.activeSuffix,
                [],
                {
                    ...this.tokens,
                    openFiles: 0,
                    total: fixedTokens,
                },
                this.fileName,
                this.filePath,
                this.relativePath,
                this.isFolder,
            );
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

        return new EditorContext(
            this.textEditor,
            this.selectionObject,
            this.selectionText,
            this.activePrefix,
            this.activeSuffix,
            kept,
            {
                prefix: this.tokens.prefix,
                suffix: this.tokens.suffix,
                selection: this.tokens.selection,
                activeFile: this.tokens.activeFile,
                openFiles: openFilesTokens,
                total: fixedTokens + openFilesTokens,
            },
            this.fileName,
            this.filePath,
            this.relativePath,
            this.isFolder,
        );
    }
}
