import * as vscode from "vscode";

import { LlmClientFactory } from "../common/llmclient";
import { buildCommitOptions, emptyStop } from "../common/llmoptions";
import { commitMsgCommand_Template } from "../common/prompt";
import { withProgressNotification } from "../common/utils";
import { userConfig } from "../config";
import { logMsg } from "../logging";
import { getBearerInstruct } from "../secrets";

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
 * Registers the `collama.generateCommitMessage` command with VS Code.
 *
 * The command retrieves the Git extension, ensures a repository is present,
 * obtains the staged diff, and uses `generateCommitMessage` to produce a
 * commit message. The message is then placed into the repository's input box.
 *
 * @param context - The extension context used to store the disposable.
 */
export function registerGenerateCommitMessageCommand(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand("collama.generateCommitMessage", async () => {
        const gitExtension = vscode.extensions.getExtension<GitExtension>("vscode.git");
        if (!gitExtension) {
            vscode.window.showErrorMessage("collama: Git extension is not available");
            return;
        }
        if (!gitExtension.isActive) {
            await gitExtension.activate();
        }
        const git = gitExtension.exports.getAPI(1);
        if (!git.repositories.length) {
            vscode.window.showErrorMessage("collama: No Git repository found in workspace");
            return;
        }
        const repo = git.repositories[0];
        try {
            const stagedDiff = await repo.diff(true);
            if (!stagedDiff || stagedDiff.trim().length === 0) {
                vscode.window.showWarningMessage("collama: No staged changes to generate commit message for");
                return;
            }
            logMsg(`Staged diff size: ${stagedDiff.length} characters`);
            await withProgressNotification("collama: Generating commit message...", async () => {
                const commitMessage = await generateCommitMessage(stagedDiff);
                if (commitMessage) {
                    repo.inputBox.value = commitMessage;
                    vscode.window.showInformationMessage("collama: Commit message generated");
                } else {
                    vscode.window.showWarningMessage("collama: Failed to generate commit message");
                }
            });
        } catch (error) {
            logMsg(`Error generating commit message: ${error}`);
            vscode.window.showErrorMessage(`collama: Error generating commit message: ${error}`);
        }
    });
    context.subscriptions.push(disposable);
}

/**
 * Generates a conventional commit message from a staged git diff.
 *
 * The function constructs a prompt that combines a predefined message
 * template with the supplied diff wrapped in XML-style tags, then calls
 * {@link llmGenerate} to generate the commit text.
 *
 * @param stagedDiff - The git diff of the staged changes.
 * @returns A promise that resolves to the generated commit message string.
 */
export async function generateCommitMessage(stagedDiff: string): Promise<string> {
    logMsg("Generating commit message...");

    const clientFactory = new LlmClientFactory("instruction");
    const result = await clientFactory.chat({
        apiEndpoint: { url: userConfig.apiEndpointInstruct, bearer: await getBearerInstruct() },
        model: userConfig.apiModelInstruct,
        messages: [{ role: "user", content: commitMsgCommand_Template({ diff: stagedDiff }) }],
        tools: [],
        options: buildCommitOptions(),
        stop: emptyStop(),
        think: false,
    });

    if (!result) {
        logMsg("Warning: LLM returned empty commit message");
        return "chore: update files";
    }

    logMsg(`Generated commit message: ${result.substring(0, 50)}...`);
    return result;
}
