import { logMsg } from "../../logging";
import { Tool, toolError, toolSuccess } from "../tools";

// definition

/**
 *
 *
 * {
 *   results: [
 *     {
 *       title: string,
 *       url: string,
 *       content?: string,
 *       engine?: string,
 *       score?: number,
 *       ...
 *     }
 *   ],
 *   number_of_results?: number,
 *   ...
 * }
 */

export const search_def = {
    type: "function" as const,
    function: {
        name: "search",
        description: "[] Search",
        parameters: {},
    },
};

export async function search_exec(_args?: Record<string, unknown>): Promise<ReturnType<typeof toolSuccess>> {
    logMsg("Agent - use search-tool (stub)");
    return toolSuccess({});
}

export const searchTools: Record<string, Tool> = {};
