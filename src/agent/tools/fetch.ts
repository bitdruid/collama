import fs from "fs";
import os from "os";
import path from "path";
import { logMsg } from "../../logging";
import { ToolAnswer, toolError, toolSuccess } from "../tools";
import { requestToolConfirm } from "./edit";

type FetchInput = {
    url: string;
    explanation: string;
};

const MAX_INLINE_CHARS = 10_000 * 4;
const FETCH_TIMEOUT_MS = 30_000;
const TEMP_DIR_NAME = "collama-tmp";

function validateUrl(rawUrl: string): URL | string {
    let url: URL;
    try {
        url = new URL(rawUrl);
    } catch {
        return "Invalid URL.";
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
        return "Only http and https URLs are allowed.";
    }

    return url;
}

function countLines(output: string): number {
    if (output.length === 0) {
        return 0;
    }
    return output.split("\n").length;
}

function tempFilePath(url: URL): string {
    const dir = path.join(os.tmpdir(), TEMP_DIR_NAME);
    fs.mkdirSync(dir, { recursive: true });

    const safeHost = url.hostname.replace(/[^a-z0-9.-]/gi, "_") || "content";
    const name = `${Date.now()}-${safeHost}.txt`;
    return path.join(dir, name);
}

function formatStoredContent(content: string, contentType: string | null): string {
    const type = contentType?.toLowerCase() ?? "";
    const mayBeJson = type.includes("json") || /^[\s\n\r]*[\[{]/.test(content);
    if (!mayBeJson) {
        return content;
    }

    try {
        return JSON.stringify(JSON.parse(content), null, 2);
    } catch {
        return content;
    }
}

async function fetchText(url: URL): Promise<{ content: string; contentType: string | null; status: number }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            redirect: "follow",
            signal: controller.signal,
            headers: {
                "User-Agent": "collama-agent-fetch-tool",
                Accept: "text/html, text/plain, application/json, application/xml, text/*;q=0.9, */*;q=0.1",
            },
        });
        const content = await response.text();
        return { content, contentType: response.headers.get("content-type"), status: response.status };
    } finally {
        clearTimeout(timeout);
    }
}

export async function fetch_exec(
    args: FetchInput,
): Promise<ToolAnswer<{ content?: string; filePath?: string; lineCount?: number; status: number }>> {
    const keys = Object.keys(args);
    const allowedKeys = new Set(["url", "explanation"]);
    if (
        keys.some((key) => !allowedKeys.has(key)) ||
        typeof args.url !== "string" ||
        typeof args.explanation !== "string"
    ) {
        return toolError("fetch only accepts url and explanation arguments");
    }

    const rawUrl = args.url.trim();
    logMsg(`Agent - use fetch-tool url="${rawUrl}" explanation="${args.explanation}"`);

    const url = validateUrl(rawUrl);
    if (typeof url === "string") {
        return toolError(url);
    }

    const { value, reason } = await requestToolConfirm("fetch", url.toString(), args.explanation);
    if (!value) {
        return { success: false, message: reason };
    }

    try {
        const result = await fetchText(url);
        const content = formatStoredContent(result.content, result.contentType).trimEnd();

        if (content.length > MAX_INLINE_CHARS) {
            const filePath = tempFilePath(url);
            fs.writeFileSync(filePath, content, "utf-8");
            return toolSuccess(
                { filePath, lineCount: countLines(content), status: result.status },
                "See temporary file.",
            );
        }

        return toolSuccess({ content, status: result.status });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return toolError(msg);
    }
}

export const fetch_def = {
    type: "function" as const,
    function: {
        name: "fetch",
        description:
            "Fetch content from an http or https URL. Response has either content or filePath with lineCount. " +
            "Only use if user mentions explicit.",
        parameters: {
            type: "object",
            properties: {
                explanation: {
                    type: "string",
                    description: "One sentence describing what the command does in the repo.",
                },
                url: {
                    type: "string",
                    description: "The http or https URL to fetch.",
                },
            },
            required: ["explanation", "url"],
            additionalProperties: false,
        },
    },
};
