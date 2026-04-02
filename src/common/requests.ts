import Anthropic from "@anthropic-ai/sdk";
import nodeFetch from "node-fetch";
import { Readable } from "node:stream";
import { Ollama } from "ollama";
import OpenAI from "openai";
import * as vscode from "vscode";

import { userConfig } from "../config";
import { logMsg } from "../logging";
import { getBearerCompletion, getBearerInstruct } from "../secrets";
import { EditorContext } from "./context-editor";
import { LlmClientFactory } from "./llmclient";
import { getCompletionModelConfig } from "./models";
import { commitMsgCommand_Template, contextCommand_Template, PromptParams } from "./prompt";
import {
    buildCommitOptions,
    buildCompletionOptions,
    buildCompletionStop,
    buildInstructionOptions,
    emptyStop,
} from "./types-llm";

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
export async function requestCompletion(context: EditorContext): Promise<string> {
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
    const clientFactory = new LlmClientFactory("instruction");
    const result = await clientFactory.chat({
        apiEndpoint: { url: userConfig.apiEndpointInstruct, bearer: await getBearerInstruct() },
        model: userConfig.apiModelInstruct,
        messages: [{ role: "user", content: contextCommand_Template(promptParams) }],
        options: buildInstructionOptions(),
        stop: emptyStop(),
    });

    return result.content;
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
export async function requestCommitMessage(stagedDiff: string): Promise<string> {
    logMsg("Generating commit message...");

    const clientFactory = new LlmClientFactory("instruction");
    const result = await clientFactory.chat({
        apiEndpoint: { url: userConfig.apiEndpointInstruct, bearer: await getBearerInstruct() },
        model: userConfig.apiModelInstruct,
        messages: [{ role: "user", content: commitMsgCommand_Template({ diff: stagedDiff }) }],
        options: buildCommitOptions(),
        stop: emptyStop(),
    });

    if (!result.content) {
        logMsg("Warning: LLM returned empty commit message");
        return "chore: update files";
    }

    logMsg(`Generated commit message: ${result.content.substring(0, 50)}...`);
    return result.content;
}

/**
 * Generates a concise docstring for the selected symbol only.
 *
 * @param {Context} currentContext - The editor context containing the selection and file data.
 * @returns {Promise<string>} The generated docstring or an empty string if no model configuration is available.
 */
export async function requestWriteDocstrings(currentContext: EditorContext): Promise<string> {
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
export async function requestExtractFunctions(currentContext: EditorContext): Promise<string> {
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
export async function requestSimplifyCode(currentContext: EditorContext): Promise<string> {
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
export async function requestFixSyntax(currentContext: EditorContext): Promise<string> {
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
export async function requestEditManual(currentContext: EditorContext): Promise<string> {
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

/**
 * Proxy-aware fetch wrapper.
 *
 * node-fetch uses Node.js http.request under the hood, which VS Code
 * patches to honour the built-in `http.proxy` setting.  The raw
 * node-fetch Response, however, returns a Node.js Readable as `.body`
 * instead of a Web ReadableStream — breaking the Ollama SDK which
 * calls `body.getReader()`.
 *
 * This wrapper re-packages the response into a standard `Response`
 * with a proper Web ReadableStream body so both Ollama and OpenAI
 * SDKs work correctly.
 *
 * TLS settings (custom CA, reject unauthorized) are handled
 * process-wide via NODE_TLS_REJECT_UNAUTHORIZED and NODE_EXTRA_CA_CERTS.
 */
async function proxyFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    const response = await nodeFetch(input as any, init as any);
    const body = response.body ? (Readable.toWeb(response.body as any) as ReadableStream) : null;
    return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
    });
}

/**
 * Creates and configures an Ollama client instance.
 *
 * @param url - The base URL of the Ollama host.
 * @param bearer - Optional bearer token for authentication.
 * @returns A configured Ollama client.
 */
export function requestOllama(url: string, bearer?: string): Ollama {
    const ollama = new Ollama({
        ...(bearer ? { headers: { Authorization: `Bearer ${bearer}` } } : {}),
        host: url,
        fetch: proxyFetch as typeof fetch,
    });
    return ollama;
}

/**
 * Creates and configures an OpenAI client instance.
 *
 * @param url - The base URL of the OpenAI-compatible API.
 * @param bearer - Optional API key or bearer token for authentication.
 * @returns A configured OpenAI client.
 */
export function requestOpenAI(url: string, bearer?: string): OpenAI {
    // Only append /v1 if it's not already present in the URL
    const baseURL = url.endsWith("/v1") ? url : url + "/v1";
    const openai = new OpenAI({
        apiKey: bearer ?? "",
        baseURL: baseURL,
        fetch: proxyFetch as typeof fetch,
    });
    return openai;
}

/**
 * Creates and configures an Anthropic client instance.
 *
 * @param url - The base URL of the Anthropic API (defaults to https://api.anthropic.com).
 * @param apiKey - The Anthropic API key.
 * @returns A configured Anthropic client.
 */
export function requestAnthropic(url: string, bearer?: string): Anthropic {
    return new Anthropic({
        apiKey: bearer ?? "",
        baseURL: url,
        fetch: proxyFetch as typeof fetch,
    });
}
