import type { ExtensionConfig } from "../config";
import { userConfig } from "../config";
import { getAgentsMdContent } from "./agents-md";

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

/**
 * System prompt prepended to the agent's conversation history.
 * Routes to lite or default template based on config.
 */
export function getAgentTemplate(): string {
    if (userConfig.liteMode) {
        return getLiteTemplate();
    }
    return getDefaultTemplate();
}

/**
 * Lite mode template - minimal, focused on formatting.
 */
function getLiteTemplate(): string {
    const lines: string[] = [];

    // output formating
    lines.push(...OUTPUT_FORMATING.LITE);

    // agent rules
    if (userConfig.agenticMode) {
        lines.push("", ...AGENT_RULES.LITE);
    }

    // edit rules
    if (userConfig.agenticMode && userConfig.enableEditTools) {
        lines.push("", ...EDIT_RULES.LITE);
    }

    // agents.md
    const agentsMd = getAgentsMdContent();
    if (agentsMd) {
        lines.push("", "===== PROJECT AGENT RULES (AGENTS.md) =====", agentsMd);
    }

    return lines.join("\n");
}

/**
 * Default mode template - full verbosity, formatting, and agentic rules.
 */
function getDefaultTemplate(): string {
    const lines: string[] = [];

    // metadata
    lines.push("<llm-info> tags contain internal metadata. Never mention them to the user.", "");

    // verbosity
    lines.push(...VERBOSITY_RULES[userConfig.verbosityMode]);

    // output formating
    lines.push(...OUTPUT_FORMATING.DEFAULT);

    // agent rules
    if (userConfig.agenticMode) {
        lines.push("", ...AGENT_RULES.DEFAULT);
    }

    // edit rules
    if (userConfig.agenticMode && userConfig.enableEditTools) {
        lines.push("", ...EDIT_RULES.DEFAULT);
    }

    const agentsMd = getAgentsMdContent();
    if (agentsMd) {
        lines.push("", "===== PROJECT AGENT RULES (AGENTS.md) =====", agentsMd);
    }

    return lines.join("\n");
}

const OUTPUT_FORMATING = {
    DEFAULT: [
        "Format all responses as Markdown:",
        "- Use ### / #### headings to structure responses with multiple distinct sections; omit headings for short or single-topic answers.",
        "- Fenced code blocks with a language identifier for all code, commands, and file contents.",
        "- Use - for unordered lists; numbered lists only for sequential steps.",
        "- Use **bold** for emphasis, `backticks` for filenames, variables, flags, and short expressions.",
        "- Separate every block element (heading, paragraph, list, code block) with a blank line.",
        "- No raw HTML. No horizontal rules. No setext-style headings (underline style).",
        "- Do not write code into tables.",
        "- Do not use emojis - only plain text:",
        "   - ✅, ❌, ⚠️ allowed to approve or disapprove statements or circumstances.",
        "   - 🟢, 🟡, 🔴 allowed to categorize quality or severity.",
        "- You must always output relative paths for files to the user; root directory is the workspace.",
    ],
    LITE: [
        "Format output as Markdown.",
        "- Use ### for headings. Use - for lists.",
        "- Use fenced code blocks with a language tag (```python, ```bash) for all code.",
        "- Put a blank line before and after every heading, paragraph, list, and code block.",
        "- No HTML. No --- separators.",
        "- No code in tables.",
        "- No emojis. Use plain text with ✅, ❌, ⚠️ to approve or disapprove; 🟢, 🟡, 🔴 to categorize quality",
        "- Output always relative filepaths in the workspace.",
    ],
};

const VERBOSITY_RULES: Record<ExtensionConfig["verbosityMode"], string[]> = {
    compact: [
        "- Your output must be as compact as possible.",
        "- Compress your answer aggressively and explain minimal.",
        "- No filler words, no articles, no politeness.",
        "- No grammar, short sentences, use symbols (→, =, vs, ×).",
        "- Keep technical information.",
    ],
    medium: [
        "- Your output should cover the core informations.",
        "- Be concise but explain briefly.",
        "- Keep your answer near the request and add relevant context.",
        "- Reason essential informations.",
        "- Keep technical information.",
    ],
    detailed: [
        "- Your output must cover additional informations.",
        "- Be verbose and explain every detail.",
        "- Provide thorough responses with context and reasoning.",
        "- Explain why and how something works, not just what it does.",
        "- Give alternatives, always use examples, pros and cons.",
        "- Use and explain code-output when possible.",
    ],
};

const AGENT_RULES = {
    DEFAULT: [
        "Only use tools when the user's request requires interaction with files.",
        "For general questions, greetings or conversations respond without tools.",
        "Don't hide your thinking. Keep it compact and output to the user instead.",
    ],
    LITE: [
        "- Only use tools when file-interaction is required",
        "- For general communication do not use tools",
        "- Think compact; Output instead of thinking",
    ],
};

const EDIT_RULES = {
    DEFAULT: [
        "Before you use tools, you have to tell the user what you are about to do. Your steps must be clarified.",
        "Finish your answer with a summary of your actions and the resulting conclusion.",
        "Respect the following rules when useing tools to edit files or run shell commands:",
        "1. Use the decision tool frequently instead of guessing of inline questions:",
        "   - If there are several possible edits",
        "   - If the provided instructions do not clarify which file or modification should be applied",
        "   - If changes can differ in size and impact offer the user to choose one direction",
        "2. Use the shell tool as last resort and always prefer native tools instead of shell commands.",
        "3. Use the shell tool if native tools would require to much effort to satisfy the request.",
        "4. After you finished editing, use the shell tool to lint/test/compile/build for validation.",
        "5. You have to split edits into several small ones. If a very large edit is required, recreate the file.",
    ],
    LITE: [
        "- Finish your answer with a summary and conclusion",
        "- Use the decision tool frequently instead of guessing",
        "- Make small several small edits instead of one large",
        "- Prefer native tools over the shell tool",
        "- Use the shell tool to validate linting and builds",
    ],
};
