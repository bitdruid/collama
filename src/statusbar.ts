import * as vscode from "vscode";
import { getAvailableModels } from "./checkup";
import { getSupportedModels } from "./common/models";
import { getConfig, userConfig } from "./config";

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

export function setStatusbar() {
    const sbItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
    sbItem.text = "🦙 collama 🦙";
    sbItem.tooltip = "Toggle collama - Auto-Suggestions";
    sbItem.command = "collama.showStatusbar";
    vscode.commands.registerCommand("collama.showStatusbar", showStatusbar);
    sbItem.show();
}

async function showStatusbar() {
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
    // logMsg(`supported models: ${JSON.stringify(supportedModels)}`);
    const availableModels = await getAvailableModels();
    // logMsg(`available models: ${JSON.stringify(availableModels)}`);
    const modelOptions: ModelPickItem[] = [];
    if (supportedModels) {
        for (const availableModel of availableModels) {
            for (const supportedModel of supportedModels) {
                if (availableModel.includes(supportedModel)) {
                    modelOptions.push({
                        type: "model",
                        modelName: availableModel,
                        label: `${userConfig.apiCompletionModel === availableModel ? "✔️" : ""}${availableModel}`,
                        description: `${userConfig.apiCompletionModel === availableModel ? "current model" : ""}`,
                    });
                }
            }
        }
    }

    /**
     * Combine static options and model options into a single array of type PickItem.
     */
    const options: PickItem[] = [
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
            await config.update("apiCompletionModel", selected.modelName, vscode.ConfigurationTarget.Global);
        }
    }
}
