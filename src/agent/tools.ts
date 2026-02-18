import fs from "fs";
import Ignore from "ignore";
import path from "path";
import * as vscode from "vscode";
import { logMsg } from "../logging";

function getWorkspaceRoot(): string | null {
    const folders = vscode.workspace.workspaceFolders;

    if (!folders || folders.length === 0) {
        return null;
    }

    return folders[0].uri.fsPath;
}

export const getRepoTree = {
    type: "function",
    function: {
        name: "getRepoTree",
        description: "Get the folder structure of the current workspace.",
        parameters: {},
    },
};
export const toolRegistry = {
    getRepoTree: async () => {
        logMsg(`Agent - tool use getRepoTree`);
        const ignore = Ignore();
        const root = getWorkspaceRoot();
        if (!root) {
            return "";
        }

        // load .gitignore if exists
        const ignorePath = path.join(root, ".gitignore");
        if (fs.existsSync(ignorePath)) {
            ignore.add(fs.readFileSync(ignorePath, "utf-8"));
        }

        // read files in root (ignoring if necessary)
        const allFiles = fs.readdirSync(root);
        const filteredFiles = allFiles.filter((f) => !ignore.ignores(f));

        return JSON.stringify(filteredFiles);
    },
};
