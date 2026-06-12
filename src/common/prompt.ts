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
        "<rules>",
        "- Never output full files",
        "- Never explain",
        "- You MUST output a full snippet",
        "</rules>",
        "",
        "<task>",
        "Edit the target snippet according to the instruction.",
        "</task>",
        "",
    ];

    if (fullContext) {
        lines.push("<full_context>", fullContext, "</full_context>");
    }

    if (instruction) {
        lines.push("<instruction>", instruction, "</instruction>");
    }

    if (snippet) {
        lines.push("<target_snippet>", snippet, "</target_snippet>");
    }

    lines.push(
        "<output_formatting>",
        outputFormat ?? "Raw code without explanations in code fences.",
        "</output_formatting>",
    );

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
    "- Use Markdown: ## User Message; ## Assistant Message",
    "- Be concise but complete — keep every detail that matters",
    "- Past tense, neutral tone",
    "- No opinions, no new information",
    "- Never mention summary",
    "- Only summarize messages that exist",
    "- If a user message has no assistant reply, do not invent a message",
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

    // general
    lines.push("<general>", ...GENERAL.LITE, "</general>");

    // output formatting
    lines.push("", "<output_formatting>", ...OUTPUT_FORMATING.LITE, "</output_formatting>");

    // agent rules
    if (userConfig.agenticMode) {
        lines.push("", "<agent_rules>", ...AGENT_RULES.LITE, "</agent_rules>");
    }

    // edit rules
    if (userConfig.agenticMode && userConfig.enableEditTools) {
        lines.push("", "<edit_rules>", ...EDIT_RULES.LITE, "</edit_rules>");
    }

    // agents.md
    const agentsMd = getAgentsMdContent();
    if (agentsMd) {
        lines.push("", "<project_agent_rules>", agentsMd, "</project_agent_rules>");
    }

    return lines.join("\n");
}

/**
 * Default mode template - full verbosity, formatting, and agentic rules.
 */
function getDefaultTemplate(): string {
    const lines: string[] = [];

    // general
    lines.push("<general>", ...GENERAL.DEFAULT, "</general>");

    // verbosity
    lines.push("", "<output_verbosity>", ...VERBOSITY_RULES[userConfig.verbosityMode], "</output_verbosity>");

    // output formatting
    lines.push("", "<output_formatting>", ...OUTPUT_FORMATING.DEFAULT, "</output_formatting>");

    // agent rules
    if (userConfig.agenticMode) {
        lines.push("", "<agent_rules>", ...AGENT_RULES.DEFAULT, "</agent_rules>");
    }

    // edit rules
    if (userConfig.agenticMode && userConfig.enableEditTools) {
        lines.push("", "<edit_rules>", ...EDIT_RULES.DEFAULT, "</edit_rules>");
    }

    // const skillsMd = getSkillsMdContent();
    // if (skillsMd) {
    //     lines.push("", "<agent_skills>", ...SKILLS_RULES, ...skillsMd, "</agent_skills>");
    // }

    const agentsMd = getAgentsMdContent();
    if (agentsMd) {
        lines.push("", "<agent_project_rules>", agentsMd, "</agent_project_rules>");
    }

    return lines.join("\n");
}

const GENERAL = {
    DEFAULT: [
        "Keep your reasoning brief and compact.",
        "Reasoning is no response: You MUST always conclude with a separate final answer in your normal response.",
        "If you notice a loop in your thinking choose a response and commit it to the user urgent.",
    ],
    LITE: [
        "- Keep reasoning brief",
        "- Reasoning is no response: Always write a separate final answer after reasoning",
        "- Don't loop on reasoning; commit to best answer",
    ],
};

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
        "- Use diff-blocks ```diff for suggested edits.",
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
        "- Diff-blocks '```diff' for suggested edits.",
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
    ],
    LITE: ["- Only use tools when file-interaction is required", "- For general communication do not use tools"],
};

const EDIT_RULES = {
    DEFAULT: [
        "Before you use tools, you have to tell the user what you are about to do. Your steps must be clarified.",
        "Finish your answer with a summary of your actions and the resulting conclusion.",
        "Respect the following rules when using tools to edit files or run shell commands:",
        "1. Before you start editing: If multiple solutions exist you must use the decision-tool..",
        "2. After you finished editing: Use the shell tool to lint/test/compile/build for validation.",
        "3. If you are not 100% sure, you are doing great if you ask the user with the decision-tool.",
        "4. Use the shell tool as last resort and always prefer native tools instead of shell commands.",
        "5. Use the shell tool if native tools would require too much effort to satisfy the request.",
        "6. You have to split edits into several small ones.",
    ],
    LITE: [
        "- Finish your answer with a summary and conclusion",
        "- Ambiguous or several solutions? Use the decision-tool before editing, never guess",
        "- Ask choices via the decision-tool, never as plain text",
        "- Prefer native tools over the shell tool",
        "- Use the shell tool to validate linting and builds",
        "- Make several small edits instead of one large",
    ],
};
