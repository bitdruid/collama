import * as vscode from "vscode";
const { showErrorMessage, showWarningMessage, showInformationMessage } = vscode.window;

import { requestCommitMessage } from "../common/requests";
import { logMsg } from "../logging";

interface GitExtension {
    getAPI(version: number): GitAPI;
}

interface GitAPI {
    repositories: GitRepository[];
}

interface GitRepository {
    rootUri: vscode.Uri;
    inputBox: {
        value: string;
    };
    diff(staged?: boolean): Promise<string>;
}

/**
 * Returns the staged diff of a repository, or an empty string if there is
 * nothing staged.
 */
async function getStagedDiff(repo: GitRepository): Promise<string> {
    const diff = await repo.diff(true);
    return diff && diff.trim().length > 0 ? diff : "";
}

/**
 * Resolves the Git extension's API, activating the extension if needed.
 * Returns `undefined` (after surfacing an error to the user) when the Git
 * extension is unavailable or exposes no repositories.
 */
async function resolveGitApi(): Promise<GitAPI | undefined> {
    const gitExtension = vscode.extensions.getExtension<GitExtension>("vscode.git");
    if (!gitExtension) {
        showErrorMessage("collama: Git extension is not available");
        return undefined;
    }
    if (!gitExtension.isActive) {
        await gitExtension.activate();
    }
    const git = gitExtension.exports.getAPI(1);
    if (!git.repositories.length) {
        showErrorMessage("collama: No Git repository found in workspace");
        return undefined;
    }
    return git;
}

/**
 * Determines which repository the command should act on.
 *
 * When invoked from the Source Control input box button, VS Code passes the
 * `SourceControl` whose box was clicked; we match it by `rootUri` so the
 * correct repo is always chosen, even with multiple repos in the workspace.
 *
 * When invoked from the command palette there is no context, so we look for
 * repositories that actually have staged changes: exactly one is chosen
 * automatically, several prompt a quick pick, none warns the user.
 *
 * Returns the target repo together with its already-computed staged diff, or
 * `undefined` if no suitable target exists or the user cancelled.
 */
async function resolveTarget(
    git: GitAPI,
    sourceControl: vscode.SourceControl | undefined,
): Promise<{ repo: GitRepository; stagedDiff: string } | undefined> {
    // Button path: the clicked input box tells us exactly which repo this is.
    if (sourceControl?.rootUri) {
        const repo = git.repositories.find((r) => r.rootUri.toString() === sourceControl.rootUri!.toString());
        if (!repo) {
            showErrorMessage("collama: Could not match the Source Control view to a Git repository");
            return undefined;
        }
        const stagedDiff = await getStagedDiff(repo);
        if (!stagedDiff) {
            showWarningMessage("collama: No staged changes to generate commit message for");
            return undefined;
        }
        return { repo, stagedDiff };
    }

    // Palette path: no context, so disambiguate by who has staged changes.
    const candidates: { repo: GitRepository; stagedDiff: string }[] = [];
    for (const repo of git.repositories) {
        const stagedDiff = await getStagedDiff(repo);
        if (stagedDiff) {
            candidates.push({ repo, stagedDiff });
        }
    }

    if (candidates.length === 0) {
        showWarningMessage("collama: No staged changes to generate commit message for");
        return undefined;
    }
    if (candidates.length === 1) {
        return candidates[0];
    }

    const picked = await vscode.window.showQuickPick(
        candidates.map((candidate) => ({
            label: vscode.workspace.asRelativePath(candidate.repo.rootUri, true),
            description: `${candidate.stagedDiff.length} chars staged`,
            candidate,
        })),
        { placeHolder: "collama: Multiple repositories have staged changes — pick one" },
    );
    return picked?.candidate;
}

/**
 * Generates a commit message for the given staged diff and writes it into the
 * repository's input box.
 */
async function generateCommitMessageFor(repo: GitRepository, stagedDiff: string): Promise<void> {
    logMsg(`Staged diff size: ${stagedDiff.length} characters`);
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Window,
            title: "collama: Generating commit message...",
            cancellable: false,
        },
        async () => {
            const commitMessage = await requestCommitMessage(stagedDiff);
            if (commitMessage) {
                repo.inputBox.value = commitMessage;
                showInformationMessage("collama: Commit message generated");
            } else {
                showWarningMessage("collama: Failed to generate commit message");
            }
        },
    );
}

/**
 * Registers the `collama.requestCommitMessage` command with VS Code.
 *
 * The command is intended to be contributed to the `scm/inputBox` menu so the
 * generate button appears on each repository's input box. When clicked, VS Code
 * passes the corresponding `SourceControl`, which is used to target the correct
 * repository. The command also works from the command palette, where it falls
 * back to choosing the repository (or prompting) based on staged changes.
 *
 * @param extContext - The extension context used to store the disposable.
 */
export function registerRequestCommitMessageCommand(extContext: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand(
        "collama.requestCommitMessage",
        async (sourceControl?: vscode.SourceControl) => {
            try {
                const git = await resolveGitApi();
                if (!git) {
                    return;
                }
                const target = await resolveTarget(git, sourceControl);
                if (!target) {
                    return;
                }
                await generateCommitMessageFor(target.repo, target.stagedDiff);
            } catch (error) {
                logMsg(`Error generating commit message: ${error}`);
                showErrorMessage(`collama: Error generating commit message: ${error}`);
            }
        },
    );
    extContext.subscriptions.push(disposable);
}
