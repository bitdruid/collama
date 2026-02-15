import * as vscode from "vscode";

import { userConfig } from "../config";
import { logMsg } from "../logging";
import { getBearerCompletion, getBearerInstruct } from "../secrets";
import { Context } from "./context";
import { LlmClientFactory } from "./llmclient";
import { buildCompletionOptions, buildCompletionStop, buildInstructionOptions, emptyStop } from "./llmoptions";
import { getCompletionModelConfig, getModelThinking } from "./models";
import { contextCommand_noThink_Template, contextCommand_Think_Template, PromptParams } from "./prompt";

/**
 * Generates a completion from the editor context.
 *
 * This function builds a prompt from the provided {@link Context} using the model
 * configuration and forwards it to the LLM via {@link llmGenerate}. It logs the
 * request and response details and returns the generated text. If no model
 * configuration is found for the context, an empty string is returned.
 *
 * @async
 * @param {Context} context - The editor context containing the selection and file data.
 * @returns {Promise<string>} The LLM generated text, or an empty string when no model config is available.
 */
export async function requestCompletion(context: Context): Promise<string> {
    const modelConfig = getCompletionModelConfig(context);

    if (modelConfig) {
        const clientFactory = new LlmClientFactory("completion");
        const result = await clientFactory.generate({
            apiEndpoint: { url: userConfig.apiEndpointCompletion, bearer: await getBearerCompletion() },
            model: userConfig.apiModelCompletion,
            prompt: modelConfig.prompt,
            options: buildCompletionOptions(),
            stop: buildCompletionStop(modelConfig.stop),
        });

        return result;
    } else {
        return "";
    }
}

/**
 * Asynchronously requests a context command using the provided model and parameters.
 *
 * @param {PromptParams} promptParams - Parameters containing the instruction, code snippet, and full context.
 * @returns {Promise<string>} A promise that resolves to the generated response as a string.
 * @throws {Error} If the LLM request fails.
 */
async function requestContextCommand(promptParams: PromptParams): Promise<string> {
    let prompt: string;
    const think = await getModelThinking(userConfig.apiModelInstruct);
    if (think) {
        prompt = contextCommand_Think_Template(promptParams);
    } else {
        prompt = contextCommand_noThink_Template(promptParams);
    }
    const clientFactory = new LlmClientFactory("instruction");
    const result = await clientFactory.chat({
        apiEndpoint: { url: userConfig.apiEndpointInstruct, bearer: await getBearerInstruct() },
        model: userConfig.apiModelInstruct,
        messages: [{ role: "user", content: prompt }],
        think: think,
        options: buildInstructionOptions(),
        stop: emptyStop(),
    });

    return result;
}

/**
 * Generates a concise docstring for the selected symbol only.
 *
 * @param {Context} currentContext - The editor context containing the selection and file data.
 * @returns {Promise<string>} The generated docstring or an empty string if no model configuration is available.
 */
export async function requestWriteDocstrings(currentContext: Context): Promise<string> {
    return requestContextCommand({
        instruction: "Add or update the docstring for the code according to best practice.",
        snippet: currentContext.selectionText,
        fullContext: currentContext.activeFileText,
    });
}

/**
 * Extracts logically independent blocks into small functions while preserving behavior.
 *
 * @param {Context} currentContext - The editor context containing the selection and file data.
 * @returns {Promise<string>} The refactored code with extracted functions.
 */
export async function requestExtractFunctions(currentContext: Context): Promise<string> {
    return requestContextCommand({
        instruction: "Split the code into separate functions if it increases code quality.",
        snippet: currentContext.selectionText,
        fullContext: currentContext.activeFileText,
    });
}

/**
 * Simplifies control flow without changing behavior.
 *
 * @param {Context} currentContext - The editor context containing the selection and file data.
 * @returns {Promise<string>} The simplified code.
 */
export async function requestSimplifyCode(currentContext: Context): Promise<string> {
    return requestContextCommand({
        instruction: "Simplify the code to increase readability and comprehensibility.",
        snippet: currentContext.selectionText,
        fullContext: currentContext.activeFileText,
    });
}

/**
 * Fixes syntax errors without changing logic or formatting.
 *
 * @param {Context} currentContext - The editor context containing the selection and file data.
 * @returns {Promise<string>} The corrected code.
 */
export async function requestFixSyntax(currentContext: Context): Promise<string> {
    return requestContextCommand({
        instruction: "Fix the logic, syntax and structure of the code if needed.",
        snippet: currentContext.selectionText,
        fullContext: currentContext.activeFileText,
    });
}

/**
 * Allows manual editing of the code based on user-provided instructions.
 *
 * @param {Context} currentContext - The editor context containing the selection and file data.
 * @returns {Promise<string>} The edited code according to the user's instruction.
 */
export async function requestEditManual(currentContext: Context): Promise<string> {
    const userInstruction = await vscode.window.showInputBox({
        prompt: "Describe how you want the code to be edited",
        placeHolder: "e.g. Refactor for readability, optimize loops, simplify logic…",
        ignoreFocusOut: true,
    });

    if (!userInstruction) {
        logMsg("No edit instruction provided");
        return "";
    }
    const editPrompt = userInstruction;

    return requestContextCommand({
        instruction: editPrompt,
        snippet: currentContext.selectionText,
        fullContext: currentContext.activeFileText,
    });
}
