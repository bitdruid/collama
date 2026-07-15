import { sysConfig, userConfig, type SearxngEngine } from "../../config";
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
 * Resolves the model's engine picks against the instance's engine subset.
 * Matches case-insensitively on name or shortcut id and drops unknowns, so a
 * stale list or a hallucinated pick degrades instead of breaking the search.
 */
function resolveEngines(picks: string[], known: SearxngEngine[]): { names: string[]; ignored: string[] } {
    const names: string[] = [];
    const ignored: string[] = [];
    for (const pick of picks) {
        const needle = pick.trim().toLowerCase();
        const match = known.find((e) => e.name.toLowerCase() === needle || e.shortcut.toLowerCase() === needle);
        if (match && !names.includes(match.name)) {
            names.push(match.name);
        } else if (!match) {
            ignored.push(pick);
        }
    }
    return { names, ignored };
}

/**
 * Queries the configured SearXNG server and returns the top results.
 * @param args.query - The search query.
 * @param args.engines - Optional engine subset (names or shortcut ids).
 */
export async function websearch_exec(args: { query: string; engines?: string[] }): Promise<
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

    const picks = Array.isArray(args.engines) ? args.engines : [];
    const { names, ignored } = resolveEngines(picks, sysConfig.searxngEngines);

    // query may leak workspace content - no auto-accept
    const confirmBody = names.length ? `${args.query} (engines: ${names.join(", ")})` : args.query;
    const { value, reason } = await requestToolConfirm(
        "Search",
        confirmBody,
        "Send this search query to the SearXNG server",
    );
    if (!value) {
        return { success: false, message: reason };
    }

    try {
        // no engine subset falls back to the server's default category
        const enginesParam = names.length ? `&engines=${encodeURIComponent(names.join(","))}` : "";
        const res = await fetch(`${endpoint}/search?q=${encodeURIComponent(args.query)}&format=json${enginesParam}`);
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

        const notes = [
            ...(results.length === 0 ? ["No results"] : []),
            ...(ignored.length ? [`Ignored unknown engines: ${ignored.join(", ")}`] : []),
        ];

        return toolSuccess(
            {
                results,
                ...(data.answers?.length && { answers: data.answers }),
                ...(data.suggestions?.length && { suggestions: data.suggestions }),
            },
            notes.length ? notes.join(". ") : undefined,
        );
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return toolError(`SearXNG request failed: ${msg}`);
    }
}

/**
 * Builds the websearch definition from the detected engine subset. Evaluated on
 * every registry read so the engine list follows SearXNG detection; without a
 * list it collapses to the plain query-only tool.
 */
export function websearch_def() {
    const engines = sysConfig.searxngEngines;
    const engineList = engines.length
        ? "\nAvailable engines:\n<engines>\n" +
          engines.map((e) => `  <engine id="${e.shortcut}">${e.name}</engine>`).join("\n") +
          "\n</engines>"
        : "";

    return {
        type: "function" as const,
        function: {
            name: "websearch",
            description:
                "Web search (SearXNG). Returns ranked results with title, url and a content snippet.\n" +
                "Use the shell tool to curl an explicit search result url for detailed content." +
                engineList,
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Search query." },
                    ...(engines.length && {
                        engines: {
                            type: "array",
                            items: { type: "string" },
                            description:
                                "Optional: query only these engines (name or id from <engines>). " +
                                "Omit to search the server default.",
                        },
                    }),
                },
                required: ["query"],
            },
        },
    };
}

// role registry
// role registry
// role registry

export const websearchTools: Record<string, Tool> = {
    websearch: {
        historyPolicy: "dropAll",
        get definition() {
            return websearch_def();
        },
        toolTarget: "query",
        execute: websearch_exec,
    },
};
