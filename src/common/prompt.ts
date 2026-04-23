import { userConfig } from "../config";

/**
 * Parameters for constructing a prompt string.
 */
export type PromptParams = {
    instruction?: string;
    snippet?: string;
    fullContext?: string;
    diff?: string;
    outputFormat?: string;
};

/**
 * A function type that formats prompt parameters into a string.
 */
type PromptTemplate = (p: PromptParams) => string;

/**
 * Generates a structured prompt for editing code snippets based on instructions.
 * @param {PromptParams} { instruction, snippet, fullContext, outputFormat }
 * @returns {string} The formatted prompt string.
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

/**
 * Prompt template for summarizing a conversation exchange.
 * Instructs the LLM to extract user requests, assistant answers, and key details concisely.
 */
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

type VerbosityMode = "compact" | "medium" | "detailed";

const VERBOSITY_PROMPTS: Record<VerbosityMode, string[]> = {
    compact: [
        "- No filler words where possible.",
        "- No politeness.",
        "- No grammar if not needed. Short sentences.",
        "- No repetition. No long explanations unless asked.",
        "- Prefer symbols (→, =, vs, ×).",
        "- Compress aggressively. Assume user is expert.",
        "- Output = shortest correct answer possible.",
    ],
    medium: [
        "- Be direct and concise. No preamble, no sign-off.",
        "- Answer first, explain only if essential.",
        "- Use prose, not bullets unless structure genuinely helps.",
        "- Skip edge cases unless asked.",
    ],
    detailed: [
        "- Provide thorough responses with context and reasoning.",
        "- Include relevant edge cases, alternatives, and at least one example.",
        "- Use structure (headers/bullets) when it aids clarity.",
        "- Don't omit important nuance.",
    ],
};

/**
 * System prompt prepended to the agent's conversation history.
 * Guides the LLM on how to use tools effectively and when to stop.
 */
export function getAgentTemplate(): string {
    const tokenLimit = userConfig.apiTokenPredictInstruct;
    const configuredVerbosity = userConfig.verbosityMode as VerbosityMode;
    const lines: string[] = ["Guidelines:", ""];
    lines.push("You are a senior software engineer.");

    if (userConfig.agentic) {
        lines.push(
            "- Only use tools when the user's request requires direct interaction with files.",
            "- For general questions, greetings, or conversations respond directly without tools.",
            "- Grep and Glob efficient.",
            "",
        );
    }

    if (userConfig.agentic && userConfig.enableEditTools) {
        lines.push(
            "- Explain your actions and why before making changes.",
            "- After you finished editing, use getDiagnostics to validate the changes.",
            "- Make multiple small edits instead of large.",
            "",
        );
    }

    lines.push(
        "- Never repeat yourself. Instead move on to the next step.",
        "- Do not re-check conditions you have already confirmed.",
        "- <llm-info> tags contain internal metadata. Use them silently for context — never mention or repeat them to the user.",
        ...(VERBOSITY_PROMPTS[configuredVerbosity] ?? VERBOSITY_PROMPTS.medium),
        "",
        `OUTPUT LIMIT: Keep your response under approximately ${tokenLimit} tokens (~${Math.floor(tokenLimit * 4)} characters).`,
    );

    return lines.join("\n");
}
