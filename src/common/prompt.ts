import fs from "fs";
import os from "os";
import path from "path";
import * as vscode from "vscode";
import type { ExtensionConfig } from "../config";
import { userConfig } from "../config";
import { getAgentsMdContent } from "./agents-md";

/**
 * Returns the current date (day granularity) as a formatted string.
 * Keep cache by skipping time.
 */
function getDate(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Returns OS name, version, and architecture as a string.
 */
function getOSInfo(): string {
    return `${os.type()} ${os.release()} ${os.arch()}`;
}

/**
 * Returns "true" when the workspace root is a git repository, "false" otherwise.
 * Checks for a .git entry (directory for a normal repo, file for worktrees/submodules).
 */
function getGitActive(): string {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        return "false";
    }
    return fs.existsSync(path.join(workspaceRoot, ".git")) ? "true" : "false";
}

/**
 * Returns the absolute path of the workspace root, or "" when no workspace is open.
 */
function getWorkspaceRoot(): string {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
}

/**
 * Returns a list of files and directories in the project root (max 20).
 */
function getProjectRootFiles(): string {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        return "";
    }

    try {
        const entries = fs.readdirSync(workspaceRoot, { withFileTypes: true });
        const names = entries.map((entry) => `${entry.name}${entry.isDirectory() ? path.sep : ""}`);

        if (names.length > 20) {
            return [...names.slice(0, 20), `... (${names.length} total)`].join("\n");
        }
        return names.join("\n");
    } catch {
        return "";
    }
}

/**
 * Parameters for constructing a prompt string.
 */
export type PromptParams = {
    instruction?: string;
    snippet?: string;
    fullContext?: string;
    diff?: string;
    outputFormat?: string;
    targetSnippet?: string;
};

/**
 * System prompt prepended to the agent's conversation history.
 * Routes to lite or default template based on config.
 */
function getAgentTemplate(): string {
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
    lines.push("<general>", ...getGeneral("LITE"), "</general>");

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
    lines.push("<general>", ...getGeneral("DEFAULT"), "</general>");

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

function getGeneral(mode: "DEFAULT" | "LITE"): string[] {
    if (mode === "DEFAULT") {
        return [
            "<reasoning>",
            "Keep your reasoning brief and compact.",
            "Reasoning is no response: You MUST always conclude with a separate final answer in your normal response.",
            "If you notice a loop in your thinking choose a response and commit it to the user urgent.",
            "</reasoning>",
            "<environment>",
            `<date>${getDate()}</date>`,
            `<os_info>${getOSInfo()}</os_info>`,
            `<git_repo>${getGitActive()}</git_repo>`,
            `<workspace_root>${getWorkspaceRoot()}</workspace_root>`,
            `<workspace_files>${getProjectRootFiles()}</workspace_files>`,
            "</environment>",
        ];
    }
    if (mode === "LITE") {
        return [
            "<reasoning>",
            "- Keep reasoning brief",
            "- Reasoning is no response: Always write a separate final answer after reasoning",
            "- Don't loop on reasoning; commit to best answer",
            "</reasoning>",
            "<environment>",
            `<date>${getDate()}</date>`,
            `<os_info>${getOSInfo()}</os_info>`,
            `<workspace_root>${getWorkspaceRoot()}</workspace_root>`,
            "</environment>",
        ];
    }
    return [];
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
        "- Use diff-blocks ```diff for suggested edits - no file header and no hunk header on diffs.",
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
        "- Diff-blocks '```diff' for suggested edits - no file header and no hunk header on diffs.",
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
        "After you finish exploring (reading/searching) and before you start editing:",
        " - State your findings once as a short consolidated conclusion.",
        " - What you found and what you will change.",
        " - Treat that conclusion as settled — do not re-investigate or re-explain.",
        " - If a later tool result contradicts it, say what changed and move on.",
        "Respect the following rules when using tools to edit files:",
        "1. Start by exploring the neccessary files and informations. Finish your exploration with a short summary of the findings.",
        "2. Before you start editing: Use the decision tool to ask the user about implementation details.",
        "3. You have to split edits into several small ones.",
        "4. After you finished editing: Use the shell tool to lint/test/compile/build for validation.",
        "5. Finish your answer with a summary of your actions and the resulting conclusion.",
        "Shell tool specific constraints:",
        "- Use the shell tool as last resort and always prefer native tools instead of shell commands.",
        "- Use the shell tool if native tools would require too much effort to satisfy the request.",
    ],
    LITE: [
        "- After exploring and before editing, state findings once: what you found + what you will change. Don't re-investigate settled points.",
        "- Finish your answer with a summary and conclusion",
        "- Ambiguous or several solutions? Use the decision-tool before editing, never guess",
        "- Ask choices via the decision-tool, never as plain text",
        "- Prefer native tools over the shell tool",
        "- Use the shell tool to validate linting and builds",
        "- Make several small edits instead of one large",
    ],
};

/**
 * Chat message with system role.
 */
export type SystemMessage = {
    role: "system";
    content: string;
};

/**
 * Chat message with user role.
 */
export type UserMessage = {
    role: "user";
    content: string;
};

/**
 * Encapsulates system prompt generation for the agent.
 * Provides getters that return wrapped system-role chat messages.
 *
 * XML-Tags:
 * <general>:               General behavior and constraints (contains reasoning, environment)
 *   <reasoning>:           Reasoning guidelines and conventions
 *   <environment>:         Runtime environment context
 *     <date>:              Current date
 *     <os_info>:           Operating system information
 *     <git_repo>:          Git repository status (DEFAULT only)
 *     <workspace_root>:    Absolute workspace root path (DEFAULT only)
 *     <workspace_files>:   Project root files listing (DEFAULT only)
 * <output_verbosity>:      Verbosity level rules (DEFAULT only)
 * <output_formatting>:     Expected output format conventions
 * <agent_rules>:           Agent behavioral rules (conditional on agenticMode)
 * <edit_rules>:            File editing rules (conditional on agenticMode + enableEditTools)
 * <agent_project_rules>:   Project-specific agent rules from AGENTS.md
 * <rules>:                 Strict output constraints (edit/commit prompts)
 * <task>:                  Job description (edit/commit prompts)
 * <full_context>:          Full file or conversation context (edit prompt)
 * <target_snippet>:        Code snippet to edit (edit prompt)
 * <diff>:                  Git diff content (commit user message)
 */
export class PromptConstructor {
    /**
     * Generates a structured prompt for editing code snippets based on instructions.
     * @param {PromptParams} params - Parameters containing instruction, snippet, fullContext, and outputFormat.
     * @returns {UserMessage} The formatted user message object.
     */
    static EDITCOMMAND_SYSTEM_PROMPT(targetSnippet: string, fullContext: string): SystemMessage {
        return {
            role: "system",
            content: [
                "<rules>",
                "- Never output full files",
                "- Never explain",
                "- You MUST output a full snippet",
                "</rules>",
                "<task>",
                "Edit the target snippet according to the user instruction.",
                "</task>",
                `<full_context>${fullContext}</full_context>`,
                `<target_snippet>${targetSnippet}</target_snippet>`,
                `<output_formatting>Raw code without explanations in code fences.</output_formatting>`,
            ].join("\n"),
        };
    }

    static EDITCOMMAND_USER_MESSAGE(instruction: string): UserMessage {
        return { role: "user" as const, content: instruction };
    }

    static COMMITMESSAGE_SYSTEM_PROMPT(): SystemMessage {
        return {
            role: "system",
            content: [
                "<rules>",
                "- Never output full files",
                "- Never explain",
                "- You MUST output a full snippet",
                "</rules>",
                "<task>",
                "Write a concise, descriptive commit message for the following git diff.",
                "- Use conventional commits format (type: description)",
                "- Types: feat, fix, docs, style, refactor, perf, test, chore, build, ci",
                "- Keep the first line under 72 characters",
                "- Be specific about what changed",
                "- Do not include any explanation, only output the commit message",
                "- If there are multiple logical changes, use bullet points for the body",
                "- Keep it minimal",
                "</task>",
                "<output_formatting>",
                "Common git commit message format. Without explanations in code fences.",
                "</output_formatting>",
            ].join("\n"),
        };
    }

    static COMMITMESSAGE_USER_MESSAGE(diff: string): UserMessage {
        return { role: "user", content: `<diff>\n${diff ?? ""}\n</diff>` };
    }

    static SUMMARY_SYSTEM_PROMPT(): SystemMessage {
        return {
            role: "system",
            content: [
                "<rules>",
                "- Markdown always: '## User Message' then '## Assistant Message'.",
                "- If user or assistant message is empty, omit it.",
                "- Summarize only what is actually present. Never invent missing content.",
                "- Past tense, neutral tone.",
                "- Concise but complete — keep every detail that matters.",
                "- No opinions, no new information, no restating these rules.",
                "- Never mention a summary request.",
                "</rules>",
            ].join("\n"),
        };
    }

    static SUMMARY_USER_MESSAGE(): UserMessage {
        return {
            role: "user",
            content: [
                "Summarize the conversation above. Output only the summary.",
                "Content:",
                "- What the user asked or said",
                "- What the assistant answered, did, or concluded",
                "- Concrete details that matter: file names, identifiers, values, decisions, constraints",
            ].join("\n"),
        };
    }

    /**
     * Returns the agent system prompt as a system-role chat message.
     */
    static agentTemplate(): SystemMessage {
        return { role: "system", content: getAgentTemplate() };
    }

    /**
     * Returns the summary template as an object with system and user messages.
     */
    static summaryTemplate() {
        return {
            system: PromptConstructor.SUMMARY_SYSTEM_PROMPT(),
            user: PromptConstructor.SUMMARY_USER_MESSAGE(),
        };
    }

    static editCommandTemplate(targetSnippet: string, fullContext: string, instruction: string) {
        return {
            system: PromptConstructor.EDITCOMMAND_SYSTEM_PROMPT(targetSnippet, fullContext),
            user: PromptConstructor.EDITCOMMAND_USER_MESSAGE(instruction),
        };
    }

    static commitMessageTemplate(diff: string) {
        return {
            system: PromptConstructor.COMMITMESSAGE_SYSTEM_PROMPT(),
            user: PromptConstructor.COMMITMESSAGE_USER_MESSAGE(diff),
        };
    }
}
