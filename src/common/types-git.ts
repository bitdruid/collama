import * as vscode from "vscode";

/**
 * Git-related types used across multiple domains in the codebase
 */

/**
 * VS Code Git extension interface
 */
export interface GitExtension {
    getAPI(version: number): GitAPI;
}

/**
 * VS Code Git API interface
 */
export interface GitAPI {
    repositories: GitRepository[];
}

/**
 * Git repository interface
 */
export interface GitRepository {
    inputBox: InputBox;
    diff(staged?: boolean): Promise<string>;
    diffBetween(ref1: string, ref2: string): Promise<GitChange[]>;
    diffBetween(ref1: string, ref2: string, path: string): Promise<string>;
    log(options?: { maxEntries?: number; path?: string }): Promise<GitCommit[]>;
    state: {
        HEAD?: { name?: string; commit?: string };
        refs: Array<{ name?: string; commit?: string; type: number }>;
    };
}

/**
 * Minimal repository interface for commit message generation
 */
export interface Repository {
    inputBox: InputBox;
    diff(staged?: boolean): Promise<string>;
}

/**
 * Git commit interface
 */
export interface GitCommit {
    hash: string;
    message: string;
    authorDate?: Date;
    authorName?: string;
    authorEmail?: string;
}

/**
 * Git change interface
 */
export interface GitChange {
    uri: vscode.Uri;
    originalUri: vscode.Uri;
    renameUri?: vscode.Uri;
    status: number;
}

/**
 * VS Code input box interface
 */
export interface InputBox {
    value: string;
}
