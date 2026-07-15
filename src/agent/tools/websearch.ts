import { userConfig } from "../../config";
import { logMsg } from "../../logging";
import { Tool, ToolAnswer, toolError, toolSuccess } from "../tools";
import { requestToolConfirm } from "./utils/confirm";

// definition

const MAX_TITLE = 500;
const MAX_URL = 500;
const MAX_CONTENT = 500;

interface SearxngResult {
    title?: string;
    url?: string;
    content?: string;
    publishedDate?: string | null;
}

interface SearxngResponse {
    results?: SearxngResult[];
    answers?: unknown[];
    suggestions?: string[];
}

/** Engine output is passed through verbatim and is unbounded - a single GitHub
 *  repo description came back at ~200kB. */
function clip(value: string | undefined, max: number): string | undefined {
    if (!value) {
        return value;
    }
    return value.length > max ? `${value.slice(0, max)}…` : value;
}

/**
 * Queries the configured SearXNG server and returns the top results.
 * @param args.query - The search query.
 */
export async function websearch_exec(args: { query: string }): Promise<
    ToolAnswer<{
        results: Array<{ title?: string; url?: string; content?: string; publishedDate?: string }>;
        answers?: unknown[];
        suggestions?: string[];
    }>
> {
    logMsg(`Agent - use websearch-tool query=${args.query}`);

    const endpoint = userConfig.searxngEndpoint.replace(/\/+$/, "");
    if (!endpoint) {
        return toolError("No SearXNG server configured");
    }

    // query may leak workspace content - no auto-accept
    const { value, reason } = await requestToolConfirm(
        "Search",
        args.query,
        "Send this search query to the SearXNG server",
    );
    if (!value) {
        return { success: false, message: reason };
    }

    try {
        const res = await fetch(`${endpoint}/search?q=${encodeURIComponent(args.query)}&format=json`);
        if (!res.ok) {
            return toolError(`SearXNG request failed: ${res.status} ${res.statusText}`);
        }
        const data = (await res.json()) as SearxngResponse;

        const results = (data.results ?? []).slice(0, 10).map((r) => ({
            title: clip(r.title, MAX_TITLE),
            url: clip(r.url, MAX_URL),
            content: clip(r.content, MAX_CONTENT),
            ...(r.publishedDate && { publishedDate: r.publishedDate }),
        }));

        return toolSuccess(
            {
                results,
                ...(data.answers?.length && { answers: data.answers }),
                ...(data.suggestions?.length && { suggestions: data.suggestions }),
            },
            results.length === 0 ? "No results" : undefined,
        );
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return toolError(`SearXNG request failed: ${msg}`);
    }
}

export const websearch_def = {
    type: "function" as const,
    function: {
        name: "websearch",
        description:
            "Web search (SearXNG). Returns ranked results with title, url and a content snippet.\n" +
            "Use the shell tool to curl an explicit search result url for detailed content.",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "Search query." },
            },
            required: ["query"],
        },
    },
};

// role registry
// role registry
// role registry

export const websearchTools: Record<string, Tool> = {
    websearch: {
        historyPolicy: "dropAll",
        definition: websearch_def,
        toolTarget: "query",
        execute: websearch_exec,
    },
};
