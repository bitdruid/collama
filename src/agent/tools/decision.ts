/**
 * Provides a decision-making tool that asks the user to select between options.
 *
 * The module exports:
 * - `resolveToolDecision`: Resolves a pending decision request.
 * - `decision_exec`: Executes the decision tool, prompting the user.
 * - `decision_def`: The tool definition used by the agent.
 *
 * @module decision-tool
 */

import { getWebview } from "../../chat/backend/utils-back";
import { logMsg } from "../../logging";
import { ToolAnswer, toolError, toolSuccess } from "../tools";

const _pending = new Map<string, (result: { value: string | null }) => void>();
let _idCounter = 0;

/**
 * Resolves a pending decision request.
 *
 * Called when the webview sends a response to a previously issued decision request.
 *
 * @param id - The unique identifier of the pending request.
 * @param value - The selected option value from the user.
 */
export function resolveToolDecision(id: string, value: string): void {
    const resolve = _pending.get(id);
    if (resolve) {
        _pending.delete(id);
        resolve({ value: value || null });
    }
}

/**
 * Sends a decision request to the webview and awaits the user's selected option.
 *
 * @param question - The question to present to the user.
 * @param options - An array of possible choices.
 *
 * @returns A promise that resolves with an object containing the selected value,
 *          or `null` if the webview is unavailable or the user cancels.
 */
function requestDecision(question: string, options: string[]): Promise<{ value: string | null }> {
    const webview = getWebview();
    if (!webview) {
        return Promise.resolve({ value: null });
    }
    const id = String(++_idCounter);
    return new Promise((resolve) => {
        _pending.set(id, resolve);
        webview.postMessage({ type: "tool-decision-request", id, question, options });
    });
}

/**
 * Executes the decision tool, prompting the user to pick between options.
 *
 * The function validates the arguments, logs the request, and waits for the user's selection.
 *
 * @param args - The arguments for the decision tool.
 * @param args.question - The question to ask the user.
 * @param args.options - An array of mutually exclusive options (minimum 2).
 *
 * @returns A promise that resolves to a `ToolAnswer` containing the selected option
 *          as `{ selected: string }`, or an error if validation fails or the user does not choose.
 *
 * @throws {ToolError} If `question` is missing or not a string.
 * @throws {ToolError} If `options` is not an array with at least 2 entries.
 * @throws {ToolError} If no selection is received from the user.
 */
export async function decision_exec(args: {
    question: string;
    options: string[];
}): Promise<ToolAnswer<{ selected: string }>> {
    if (!args.question || typeof args.question !== "string") {
        return toolError("question is required");
    }
    if (!Array.isArray(args.options) || args.options.length < 2) {
        return toolError("options must be an array with at least 2 entries");
    }

    logMsg(`Agent - use decision-tool question="${args.question}" options=${args.options.length}`);

    const { value } = await requestDecision(args.question, args.options);
    if (!value) {
        return toolError("No selection received from user");
    }
    return toolSuccess({ selected: value });
}

/**
 * Tool definition for the decision tool.
 *
 * This constant describes the function signature and metadata used by the agent
 * to invoke the `decision_exec` function.
 *
 * @type {object}
 * @property {'function'} type - The type of the tool.
 * @property {object} function - The function description object.
 * @property {string} function.name - The name of the tool function.
 * @property {string} function.description - A short description of the tool.
 * @property {object} function.parameters - JSON Schema describing the expected parameters.
 */
export const decision_def = {
    type: "function" as const,
    function: {
        name: "decision",
        description:
            "Ask the user to choose between options when the right next step is ambiguous. Prefer it over guessing. Requesting a decision overcomes thinking. Markdown not allowed",
        parameters: {
            type: "object",
            properties: {
                explanation: {
                    type: "string",
                    description: "One sentence explaining why this tool call is needed for the user's request.",
                },
                question: {
                    type: "string",
                    description: "The question to show the user. Phrase clearly; the user sees this as a prompt.",
                },
                options: {
                    type: "array",
                    items: { type: "string" },
                    description:
                        "Short, mutually-exclusive options for the user to choose from. At least 2 entries. Each label should be self-explanatory with descriptive context.",
                },
            },
            required: ["explanation", "question", "options"],
        },
    },
};
