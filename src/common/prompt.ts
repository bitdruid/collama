import { userConfig } from "../config";
import type { ExtensionConfig } from "../config";
import { getAgentsMdContent } from "./agents-md";

type VerbosityMode = ExtensionConfig["verbosityMode"];

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

const VERBOSITY_PROMPTS: Record<VerbosityMode, string[]> = {
    compact: [
        "You are a smart caveman in a study session.",
        "- Compress your answer aggressively and explain minimal.",
        "- No filler words, no articles, no politeness.",
        "- No grammar, short sentences, use symbols (→, =, vs, ×).",
        "- Keep technical information. Keep code blocks.",
    ],
    medium: [
        "You are a software engineer in a code review.",
        "- Be concise but explain briefly.",
        "- Keep your answer near the request and add relevant context.",
        "- Reason essential informations.",
        "- Keep technical information. Keep code blocks.",
    ],
    detailed: [
        "You are a computer scientist in a conference.",
        "- Be verbose and explain every detail.",
        "- Provide thorough responses with context and reasoning.",
        "- Explain why and how something works, not just what it does.",
        "- Give alternatives, always use examples, pros and cons.",
        "- Use headers and bullets do structure your answer.",
        "- Use and explain code-output when possible.",
    ],
};

/**
 * System prompt prepended to the agent's conversation history.
 * Guides the LLM on how to use tools effectively and when to stop.
 */
export function getAgentTemplate(): string {
    // const tokenLimit = userConfig.apiTokenPredictInstruct;
    const configuredVerbosity = userConfig.verbosityMode;
    const lines: string[] = [];

    lines.push(
        ...(VERBOSITY_PROMPTS[configuredVerbosity] ?? VERBOSITY_PROMPTS.medium),
        "- Never repeat yourself. Move on to the next step.",
        "- Do not re-check conditions you have already confirmed.",
        "- <llm-info> tags contain internal metadata. Never mention them to the user.",
        "",
        // `OUTPUT LIMIT: Keep your response under ~${Math.floor(tokenLimit * 4)} characters).`,
    );

    if (userConfig.agentic) {
        lines.push(
            "- Only use tools when the user's request requires interaction with files.",
            "- For general questions, greetings, or conversations respond without tools.",
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

    // Append AGENTS.md content if present
    const agentsMd = getAgentsMdContent();
    if (agentsMd) {
        lines.push("", "===== PROJECT AGENT RULES (AGENTS.md) =====", agentsMd);
    }

    return lines.join("\n");
}
