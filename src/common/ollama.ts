import * as vscode from "vscode";
import { Ollama } from "ollama";
import { Context } from "./context";
import { sysConfig, userConfig } from "../config";
import { logMsg, logStream } from "../logging";
import { getModelConfig, getModelContextLength, getModelThinking } from "./models";
import { nonThinkingTemplate, PromptParams, thinkingTemplate } from "./prompt";

/**
 * Generation options forwarded to Ollama.
 * All fields are optional and map directly to Ollama model parameters.
 */
export interface Options {
    num_predict?: number;
    num_ctx?: number;
    temperature?: number;
    top_p?: number;
    top_k?: number;
    rep_p?: number; // repetition penalty
    pre_p?: number; // presence penalty
    fre_p?: number; // frequency penalty
}

/**
 * Stop token configuration.
 * `userStop` contains mode-specific stop tokens,
 * `modelStop` contains model-defined stop tokens.
 */
export interface Stop {
    modelStop: string[];
    userStop: string[];
}

/**
 * Calculate the number of tokens to be predicted by the LLM based on the user's configuration.
 *
 * @returns The number of tokens to be predicted.
 */
function calculateNumPredict(): number {
    if (userConfig.suggestMode === "multiblock") {
        return sysConfig.tokensPredict;
    }
    if (userConfig.suggestMode === "multiline") {
        return sysConfig.tokensPredict / 2;
    }
    if (userConfig.suggestMode === "inline") {
        return sysConfig.tokensPredict / 4;
    }
    return sysConfig.tokensPredict;
}

/**
 * Generic function to send "generation"-requests to Ollama and stream the response.
 *
 * @param model   The name of the model to use.
 * @param prompt  Fully constructed prompt text.
 * @param options Generation options (tokens, sampling, penalties).
 * @param stop    User and model stop tokens.
 * @param think   Whether to enable Ollama's think mode.
 * @param raw     Whether to request raw output from Ollama.
 * @returns       The generated text as a string.
 */
export async function llmGenerate(
    model: string,
    prompt: string,
    options: Options,
    stop: Stop,
    think: boolean = false,
    raw: boolean = false,
): Promise<string> {
    logMsg(
        [
            `Requesting to ${userConfig.apiEndpoint};`,
            `Model: ${userConfig.apiCompletionModel};`,
            `Think: ${think};`,
            `Raw: ${raw}`,
        ].join(""),
    );
    logMsg(`Options:\n${JSON.stringify(options, null, 2)}`);
    logMsg(`Stop:\n${JSON.stringify([...stop.userStop, ...stop.modelStop], null, 2)}`);
    logMsg(`Input:\n${prompt}`);

    const ollama = new Ollama({ host: userConfig.apiEndpoint });

    const response = await ollama.generate({
        model,
        prompt,
        think,
        stream: true,
        raw,
        options: {
            ...options,
            stop: [...stop.userStop, ...stop.modelStop],
        },
    });

    let result = "";
    let resultTokens = 0;
    let resultDurationNano = 0;

    for await (const part of response) {
        result += part.response ?? "";
        logStream(JSON.stringify(part.response ?? ""));
        if (part.done) {
            resultTokens = part.eval_count ?? 0;
            resultDurationNano = part.eval_duration ?? 0;
        }
    }

    const resultDuration = (resultDurationNano / 1_000_000_000).toFixed(3);
    const resultTPS = resultDurationNano > 0 ? (resultTokens / (resultDurationNano / 1_000_000_000)).toFixed(1) : "0";

    logMsg(`Receive: tokens [${resultTokens}]; duration seconds [${resultDuration}]; tokens/sec [${resultTPS}]`);
    logMsg(`Output:\n${result}`);

    // Cut the last output line if max tokens reached (last line will mostly be incomplete)
    if (resultTokens === options.num_predict && result.includes("\n")) {
        logMsg(`Output reached token limit - cutting last line (probably incomplete)`);
        result = result.split("\n").slice(0, -1).join("\n");
    }

    // Strip surrounding code fences if present
    const fenceMatch = result.match(/```(?:[a-zA-Z0-9_-]+)?\s*\n([\s\S]*?)\n?```/);
    if (fenceMatch) {
        result = fenceMatch[1];
    } else {
        // trim the code fences from the result (llm will add them in most cases)
        result = result
            .replace(/^```[a-zA-Z0-9_-]*\s*\n?/, "") // remove opening fence + optional lang + newline
            .replace(/\n?```$/, ""); // remove closing fence (optionally preceded by newline)
    }

    return result;
}

/**
 *
 *
 *
 *
 *
 */

/**
 * Builds a completion request from editor context and returns the generated text.
 * Handles prompt construction, stop tokens, logging, and metrics.
 *
 * @param {Context} context - The editor context containing the input parameters for the completion request.
 * @returns {Promise<string>} A promise that resolves to the generated text based on the completion request.
 */
export async function requestCompletion(context: Context): Promise<string> {
    const modelConfig = getModelConfig(context);

    if (modelConfig) {
        const prompt = modelConfig.prompt;

        const options: Options = {
            num_predict: calculateNumPredict(),
            num_ctx: await getModelContextLength(userConfig.apiCompletionModel),
            temperature: 0.4,
            top_p: 0.8,
            top_k: 20,
            rep_p: 0.1,
            pre_p: 1.0,
            fre_p: 1.0,
        };

        const stop: Stop = {
            userStop: [
                ...(userConfig.suggestMode === "inline" ? ["\n", "\r\n"] : []),
                ...(userConfig.suggestMode === "multiline" ? ["\n\n", "\r\n\r\n"] : []),
                ...(userConfig.suggestMode === "multiblock" ? [] : []),
            ],
            modelStop: modelConfig.stop,
        };

        const result = await llmGenerate(userConfig.apiCompletionModel, prompt, options, stop, false, true);

        return result;
    } else {
        return "";
    }
}

/**
 * Asynchronously requests a context command using the provided model and parameters.
 *
 * @param {string} prompt - The input prompt for generating the response.
 * @returns {Promise<string>} A promise that resolves to the generated response as a string.
 */
async function requestContextCommand(promptParams: PromptParams): Promise<string> {
    const options: Options = {
        num_predict: -1,
        num_ctx: await getModelContextLength(userConfig.apiInstructionModel),
        temperature: 0.8,
        top_p: 0.8,
        top_k: 20,
        rep_p: 0.1,
        pre_p: 1.0,
        fre_p: 1.0,
    };

    const stop: Stop = {
        userStop: [],
        modelStop: [],
    };

    let prompt: string;
    const think = await getModelThinking(userConfig.apiInstructionModel);
    if (think) {
        prompt = thinkingTemplate(promptParams);
    } else {
        prompt = nonThinkingTemplate(promptParams);
    }

    const result = await llmGenerate(userConfig.apiInstructionModel, prompt, options, stop, think, false);

    return result;
}

/**
 * Generates a concise docstring for the selected symbol only.
 */
export async function requestWriteDocstrings(currentContext: Context): Promise<string> {
    return requestContextCommand({
        instruction: "Add or update the docstring for the code according to best practice.",
        snippet: currentContext.selectionText,
        fullContext: currentContext.activeFileText,
    });
}
/**
 * Extracts logically independent blocks into small functions.
 * Preserves behavior exactly.
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
 */
export async function requestFixSyntax(currentContext: Context): Promise<string> {
    return requestContextCommand({
        instruction: "Fix the logic, syntax and structure of the code if needed.",
        snippet: currentContext.selectionText,
        fullContext: currentContext.activeFileText,
    });
}
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
