import * as vscode from "vscode";
const { showErrorMessage } = vscode.window;

import { getActiveSessionCount, onSessionChange } from "./agent/tools/utils/shell-session";
import { getConfig } from "./config";
import { logMsg } from "./logging";

/** Module-level reference to prevent garbage collection */
let statusBarItem: vscode.StatusBarItem | undefined;

/**
 * Creates and displays the statusbar item for the extension.
 * The item is stored at module level and added to context subscriptions
 * to prevent garbage collection.
 *
 * @param context - The extension context for subscription management.
 */
function updateStatusbarText() {
    if (!statusBarItem) {
        return;
    }
    const shellCount = getActiveSessionCount();
    const shellPart = shellCount > 0 ? ` sh:${shellCount}` : "";
    statusBarItem.text = `🦙 collama${shellPart}`;
}

export function setStatusbar(extContext: vscode.ExtensionContext) {
    try {
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
        updateStatusbarText();
        statusBarItem.tooltip = "Toggle collama - Auto-Suggestions";
        statusBarItem.command = "collama.showStatusbar";

        extContext.subscriptions.push(statusBarItem);
        extContext.subscriptions.push(vscode.commands.registerCommand("collama.showStatusbar", showStatusbar));

        // Subscribe to shell session changes
        const unsub = onSessionChange(() => updateStatusbarText());
        extContext.subscriptions.push({ dispose: unsub });

        statusBarItem.show();
        logMsg("Statusbar initialized");
    } catch (error: unknown) {
        logMsg(`Error initializing statusbar: ${(error as Error).message}`);
    }
}

async function showStatusbar() {
    try {
        const config = getConfig();

        const suggestMode = config.get<string>("suggestMode", "inline");

        const options: vscode.QuickPickItem[] = [
            {
                label: `${config.get<boolean>("autoComplete", false) ? "🟢" : "🔴"} Autocomplete`,
                description: "Toggle autocomplete",
            },
            {
                label: `${suggestMode === "inline" ? "🟢" : "🔴"} Inline`,
                description: "Toggle inline suggestions",
            },
            {
                label: `${suggestMode === "multiline" ? "🟢" : "🔴"} Multiline`,
                description: "Toggle multiline suggestions",
            },
            {
                label: `${suggestMode === "multiblock" ? "🟢" : "🔴"} Multiblock`,
                description: "Toggle multiblock suggestions",
            },
        ];

        const selected = await vscode.window.showQuickPick(options);

        if (!selected) {
            return;
        }

        if (selected.label.includes("Autocomplete")) {
            const current = config.get<boolean>("autoComplete", false);
            await config.update("autoComplete", !current, vscode.ConfigurationTarget.Global);
        }
        if (selected.label.includes("Inline")) {
            await config.update("suggestMode", "inline", vscode.ConfigurationTarget.Global);
        }

        if (selected.label.includes("Multiline")) {
            await config.update("suggestMode", "multiline", vscode.ConfigurationTarget.Global);
        }

        if (selected.label.includes("Multiblock")) {
            await config.update("suggestMode", "multiblock", vscode.ConfigurationTarget.Global);
        }
    } catch (error: unknown) {
        logMsg(`Error in showStatusbar: ${(error as Error).message}`);
        showErrorMessage(`collama: Error loading statusbar menu - ${(error as Error).message}`);
    }
}
