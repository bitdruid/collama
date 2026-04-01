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
    outputFormat?: string;
};

type PromptTemplate = (p: PromptParams) => string;

/**
 * Prompt template that generates a prompt without the think step.
 * @param {PromptParams} { instruction, snippet, fullContext, outputFormat }
 * @returns {string}
 */
export const contextCommand_Template: PromptTemplate = ({ instruction, snippet, fullContext, outputFormat }) => {
    const lines: string[] = [
        "SYSTEM:",
        "You are a senior software engineer.",
        "",
        "STRICT RULES:",
        "- Never output full files",
        "- Never explain",
        "- You MUST output a full snippet",
        "",
        "===== TASK =====",
        "Edit the target snippet according to the instruction.",
        "",
    ];

    if (fullContext) {
        lines.push("===== FULL CONTEXT (READ ONLY) =====", fullContext, "");
    }

    if (instruction) {
        lines.push("===== INSTRUCTION =====", instruction, "");
    }

    if (snippet) {
        lines.push("===== TARGET SNIPPET =====", snippet, "");
    }

    lines.push("===== OUTPUT FORMAT =====", outputFormat ?? "Raw code without explanations in code fences.");

    return lines.join("\n");
};

/**
 * Prompt template for generating concise commit messages from a git diff.
 * @param {Object} param0
 * @param {string} param0.diff - Git diff string.
 * @returns {string}
 */
export const commitMsgCommand_Template: PromptTemplate = ({ diff }) =>
    contextCommand_Template({
        instruction: [
            "Write a concise, descriptive commit message for the following git diff.",
            "- Use conventional commits format (type: description)",
            "- Types: feat, fix, docs, style, refactor, perf, test, chore, build, ci",
            "- Keep the first line under 72 characters",
            "- Be specific about what changed",
            "- Do not include any explanation, only output the commit message",
            "- If there are multiple logical changes, use bullet points for the body",
            "- Keep it minimal",
        ].join("\n"),
        snippet: `<diff>\n${diff ?? ""}\n</diff>`,
        outputFormat: "Common git commit message format. Without explanations in code fences.",
    });
export const chatSummarize_Template: string = [
    "Summarize this exchange. Output only the summary, no preamble.",
    "",
    "Include:",
    "- The user's request or question",
    "- The assistant's answer, action, or outcome",
    "- Key details: file names, values, decisions, constraints",
    "",
    "Rules:",
    "- Use Markdown: ## User Request; ## Assistant Answer",
    "- Be concise but complete — keep every detail that matters",
    "- Past tense, neutral tone",
    "- No opinions, no new information",
    "- Never mention summary",
].join("\n");
/**
 * System prompt prepended to the agent's conversation history.
 * Guides the LLM on how to use tools effectively and when to stop.
 */
export const agent_Template: string = [
    "Guidelines:",
    "- Only use tools when the user's request requires direct interaction with files.",
    "- For general questions, greetings, or conversations respond directly without tools.",
    "- Explain your actions and why before making changes.",
    "- Always make several small edits instead of one large.",
    "- After you finished editing, use getDiagnostics to validate the changes.",
    "- Never repeat yourself. Instead move on to the next step.",
    "- Do not re-check conditions you have already confirmed.",
    "- <llm-info> tags contain internal metadata. Use them silently for context — never mention or repeat them to the user.",
].join("\n");
