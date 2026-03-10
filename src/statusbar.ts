import * as vscode from "vscode";

import { getAvailableModels, getSupportedModels, modelsMatch } from "./common/models";
import { getConfig, userConfig } from "./config";
import { logMsg } from "./logging";

/**
 * Extends the quick pick item interface to include a type property
 * for easy filtering of the items in the showStatusbar function.
 *
 * @interface ModelPickItem
 * @extends {vscode.QuickPickItem}
 * @property {string} type - "model"
 * @property {string} modelName - the name of the model to use for suggestions
 */
type ModelPickItem = vscode.QuickPickItem & {
    type: "model";
    modelName: string;
};

/**
 * Defines a type to merge ModelPickItem with vscode.QuickPickItem.
 */
type PickItem = ModelPickItem | vscode.QuickPickItem;

/** Module-level reference to prevent garbage collection */
let statusBarItem: vscode.StatusBarItem | undefined;

/**
 * Creates and displays the statusbar item for the extension.
 * The item is stored at module level and added to context subscriptions
 * to prevent garbage collection.
 *
 * @param context - The extension context for subscription management.
 */
export function setStatusbar(extContext: vscode.ExtensionContext) {
    try {
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
        statusBarItem.text = "🦙 collama 🦙";
        statusBarItem.tooltip = "Toggle collama - Auto-Suggestions";
        statusBarItem.command = "collama.showStatusbar";

        extContext.subscriptions.push(statusBarItem);
        extContext.subscriptions.push(vscode.commands.registerCommand("collama.showStatusbar", showStatusbar));

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

        const staticOptions: vscode.QuickPickItem[] = [
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

        const supportedModels = getSupportedModels();
        // logMsg(`Supported models: ${JSON.stringify(supportedModels)}`);
        const availableModels = await getAvailableModels();
        // logMsg(`Available models: ${JSON.stringify(availableModels)}`);
        const modelOptions: ModelPickItem[] = [];
        if (supportedModels && supportedModels.length > 0) {
            for (const availableModel of availableModels) {
                for (const supportedModel of supportedModels) {
                    if (availableModel.toLowerCase().includes(supportedModel.toLowerCase())) {
                        const isCurrentModel = modelsMatch(userConfig.apiModelCompletion, availableModel);
                        modelOptions.push({
                            type: "model",
                            modelName: availableModel,
                            label: `${isCurrentModel ? "✔️" : ""}${availableModel}`,
                            description: `${isCurrentModel ? "current model" : ""}`,
                        });
                    }
                }
            }
        }

        /**
         * Combine static options and model options into a single array of type PickItem.
         */
        const options: PickItem[] = [
            {
                label: `${config.get<boolean>("agentic", false) ? "🟢" : "🔴"} Agentic`,
                description: "Toggle Agentic-Mode (Chat - requires tool capability)",
            },
            {
                label: `${config.get<boolean>("enableEditTools", true) ? "🟢" : "🔴"} Edit Tools`,
                description: "Toggle edit tools (read-only mode when off)",
            },
            {
                label: "Switch Agentic-Mode",
                kind: vscode.QuickPickItemKind.Separator,
            },
            ...staticOptions,
            {
                label: "Switch Autocomplete-Model",
                kind: vscode.QuickPickItemKind.Separator,
            },
            ...modelOptions,
        ];

        /**
         * Show the quick pick menu and handle the user's selection.
         */
        const selected = await vscode.window.showQuickPick<PickItem>(options);

        if (!selected) {
            return;
        }

        if (selected.label.includes("Agentic")) {
            const current = config.get<boolean>("agentic", false);
            await config.update("agentic", !current, vscode.ConfigurationTarget.Global);
        }
        if (selected.label.includes("Edit Tools")) {
            const current = config.get<boolean>("enableEditTools", true);
            await config.update("enableEditTools", !current, vscode.ConfigurationTarget.Global);
        }
        // Handle toggling autocomplete and suggestion modes
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

        // "type" is not in vscode.QuickPickItem, so check the whole "selected" object
        if ("type" in selected) {
            if (selected.type === "model") {
                await config.update("apiModelCompletion", selected.modelName, vscode.ConfigurationTarget.Global);
            }
        }
    } catch (error: unknown) {
        logMsg(`Error in showStatusbar: ${(error as Error).message}`);
        vscode.window.showErrorMessage(`collama: Error loading statusbar menu - ${(error as Error).message}`);
    }
}
