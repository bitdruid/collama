import * as vscode from "vscode";
import { createByModelName } from "@microsoft/tiktokenizer";

export interface OpenFilesContext {
    path: string;
    content: string;
}

export class Context {
    readonly textEditor: vscode.TextEditor;
    readonly selectionObject: vscode.Selection;
    readonly selectionText: string;
    readonly activePrefix: string;
    readonly activeSuffix: string;
    readonly openFiles: OpenFilesContext[];

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

    private constructor(
        editor: vscode.TextEditor,
        selection: vscode.Selection,
        selectionText: string,
        prefix: string,
        suffix: string,
        openFiles: OpenFilesContext[],
    ) {
        this.textEditor = editor;
        this.selectionObject = selection;
        this.selectionText = selectionText;
        this.activePrefix = prefix;
        this.activeSuffix = suffix;
        this.openFiles = openFiles;
    }

    static create(): Context | null {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("collama: Could not find active editor!");
            return null;
        }

        const document = editor.document;
        const selection = editor.selection;
        const cursor = selection.active;

        const prefix = document.getText(new vscode.Range(document.lineAt(0).range.start, cursor));

        const suffix = document.getText(new vscode.Range(cursor, document.lineAt(document.lineCount - 1).range.end));

        const selectionText = document.getText(selection).trim();
        // all open tabs excluding the active one
        const openFiles = vscode.workspace.textDocuments
            .filter((doc) => doc.uri.scheme === "file" && doc !== document)
            .map((doc) => ({
                path: doc.uri.fsPath,
                content: doc.getText(),
            }));

        return new Context(editor, selection, selectionText, prefix, suffix, openFiles);
    }
}
