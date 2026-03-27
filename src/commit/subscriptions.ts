import * as vscode from "vscode";
const { showErrorMessage, showWarningMessage, showInformationMessage } = vscode.window;

import { requestCommitMessage } from "../common/requests";
import { withProgressNotification } from "../common/vscode-utils";
import { logMsg } from "../logging";

// Type definitions for the Git extension API
interface GitExtension {
    getAPI(version: number): GitAPI;
}

interface GitAPI {
    repositories: Repository[];
}

interface Repository {
    inputBox: InputBox;
    diff(staged?: boolean): Promise<string>;
}

interface InputBox {
    value: string;
}

/**
 * Registers the `collama.requestCommitMessage` command with VS Code.
 *
 * The command retrieves the Git extension, ensures a repository is present,
 * obtains the staged diff, and uses `requestCommitMessage` to produce a
 * commit message. The message is then placed into the repository's input box.
 *
 * @param context - The extension context used to store the disposable.
 */
export function registerRequestCommitMessageCommand(extContext: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand("collama.requestCommitMessage", async () => {
        const gitExtension = vscode.extensions.getExtension<GitExtension>("vscode.git");
        if (!gitExtension) {
            showErrorMessage("collama: Git extension is not available");
            return;
        }
        if (!gitExtension.isActive) {
            await gitExtension.activate();
        }
        const git = gitExtension.exports.getAPI(1);
        if (!git.repositories.length) {
            showErrorMessage("collama: No Git repository found in workspace");
            return;
        }
        const repo = git.repositories[0];
        try {
            const stagedDiff = await repo.diff(true);
            if (!stagedDiff || stagedDiff.trim().length === 0) {
                showWarningMessage("collama: No staged changes to generate commit message for");
                return;
            }
            logMsg(`Staged diff size: ${stagedDiff.length} characters`);
            await withProgressNotification("collama: Generating commit message...", async () => {
                const commitMessage = await requestCommitMessage(stagedDiff);
                if (commitMessage) {
                    repo.inputBox.value = commitMessage;
                    showInformationMessage("collama: Commit message generated");
                } else {
                    showWarningMessage("collama: Failed to generate commit message");
                }
            });
        } catch (error) {
            logMsg(`Error generating commit message: ${error}`);
            showErrorMessage(`collama: Error generating commit message: ${error}`);
        }
    });
    extContext.subscriptions.push(disposable);
}
