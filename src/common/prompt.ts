export type PromptParams = {
    instruction?: string;
    snippet?: string;
    fullContext?: string;
};

type PromptTemplate = (p: PromptParams) => string;

export const nonThinkingTemplate: PromptTemplate = ({ instruction, snippet, fullContext }) =>
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

export const thinkingTemplate: PromptTemplate = ({ instruction, snippet, fullContext }) =>
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
