/**
 * @typedef {Object} PromptParams
 * @property {string} [instruction] - Instruction for the prompt.
 * @property {string} [snippet] - Target snippet to edit.
 * @property {string} [fullContext] - Full context of the code.
 * @property {string} [diff] - Git diff for commit message generation.
 */

/**
 * @callback PromptTemplate
 * @param {PromptParams} p
 * @returns {string}
 */

export type PromptParams = {
    instruction?: string;
    snippet?: string;
    fullContext?: string;
    diff?: string;
};

type PromptTemplate = (p: PromptParams) => string;

/**
 * Prompt template that generates a prompt without the think step.
 * @param {PromptParams} { instruction, snippet, fullContext }
 * @returns {string}
 */
export const contextCommand_noThink_Template: PromptTemplate = ({ instruction, snippet, fullContext }) =>
    [
        "SYSTEM:",
        "You are a senior code reviewer and editor.",
        "",
        "STRICT RULES:",
        "- Never output full files",
        "- Never explain",
        "- You MUST output a full code snippet",
        "",
        "===== FULL CONTEXT (READ ONLY) =====",
        fullContext ?? "",
        "",
        "===== TASK =====",
        "Edit the target snippet according to the instruction.",
        "",
        "===== INSTRUCTION =====",
        instruction ?? "",
        "",
        "===== TARGET SNIPPET =====",
        snippet ?? "",
        "",
        "===== OUTPUT FORMAT =====",
        "Raw code without explanations in code fences.",
    ].join("\n");

/**
 * Prompt template that includes a think step for detailed planning.
 * @param {PromptParams} { instruction, snippet, fullContext }
 * @returns {string}
 */
export const contextCommand_Think_Template: PromptTemplate = ({ instruction, snippet, fullContext }) =>
    [
        "SYSTEM:",
        "You are a senior code reviewer and editor.",
        "",
        "STRICT RULES:",
        "- Never output full files",
        "- Never repeat context",
        "- Output must be minimal",
        "",
        "===== FULL CONTEXT (READ ONLY) =====",
        fullContext ?? "",
        "",
        "",
        "===== TASK =====",
        "1. interpret the instruction and specify them",
        "2. build a step by step plan how to edit the code to match your interpretation",
        "3. edit the target snippet according to your plan",
        "4. output the full target snippet",
        "",
        "===== INSTRUCTION =====",
        instruction ?? "",
        "",
        "===== TARGET SNIPPET =====",
        snippet ?? "",
        "",
        "===== OUTPUT FORMAT =====",
        "Raw code without explanations in code fences.",
    ].join("\n");

/**
 * Prompt template for generating concise commit messages from a git diff.
 * @param {Object} param0
 * @param {string} param0.diff - Git diff string.
 * @returns {string}
 */
export const commitMsgCommand_Template: PromptTemplate = ({ diff }) =>
    [
        "SYSTEM:",
        "You are a senior code reviewer and editor.",
        "",
        "STRICT RULES:",
        "- Never output full files",
        "- Never explain",
        "- You MUST output a full code snippet",
        "",
        "===== TASK =====",
        "Edit the target snippet according to the instruction.",
        "",
        "===== INSTRUCTION =====",
        "Write a concise, descriptive commit message for the following git diff.",
        "- Use conventional commits format (type: description)",
        "- Types: feat, fix, docs, style, refactor, perf, test, chore, build, ci",
        "- Keep the first line under 72 characters",
        "- Be specific about what changed",
        "- Do not include any explanation, only output the commit message",
        "- If there are multiple logical changes, use bullet points for the body",
        "- Keep it minimal",
        "",
        "===== TARGET SNIPPET =====",
        "<diff>",
        diff ?? "",
        "</diff>",
        "",
        "===== OUTPUT FORMAT =====",
        "Common git commit message format. Without explanation in code fences.",
    ].join("\n");

/**
 * The user message appended to the conversation history to request a summary.
 * Used by the chat compress feature to condense a long conversation into a
 * single Summary accordion message pair.
 */
/**
 * System prompt prepended to the agent's conversation history.
 * Guides the LLM on how to use tools effectively and when to stop.
 */
export const agentSystem_Template: string = [
    "You are a helpful coding assistant inside VS Code with access to tools for reading, searching, editing files, and inspecting the project.",
    "",
    "Guidelines:",
    "- Use readFile to see a file's content before editing it.",
    "- Use getDiagnostics after editing to verify you didn't introduce errors.",
    "- Never guess file paths or content. If you are unsure, ask the user.",
    "- Explain what you're doing and why before making changes.",
].join("\n");

export const chatCompress_Template: string = [
    "Summarize the entire conversation above in detail.",
    "",
    "RULES:",
    "- Cover every distinct topic, task, and thread from the conversation",
    "- Preserve all decisions, conclusions, open questions, and agreed-upon approaches",
    "- Include relevant technical details, file names, code patterns, or constraints that were mentioned",
    "- Scale the length to the conversation — a long conversation deserves a long summary",
    "- Do not add new information or opinions",
    "- Do not mention that this is a summary",
    "",
    "OUTPUT FORMAT:",
    "Use markdown structure to keep the summary scannable:",
    "- Use ## headers to separate major topics",
    "- Use bullet points for lists of items, decisions, or findings",
    "- Write in past tense, third-person neutral",
].join("\n");
