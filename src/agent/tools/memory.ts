/**
 * Provides the `memory` tool: lets the agent persist, recall and forget durable
 * facts across sessions. Memories are split into a short summary (injected into
 * the system prompt) and a long detail (fetched on demand via the read action).
 *
 * @module memory-tool
 */

import { deleteMemory, type MemoryScope, readMemory, writeMemory } from "../../common/memory";
import { logMsg } from "../../logging";
import { ToolAnswer, toolError, toolSuccess } from "../tools";

type MemoryAction = "write" | "read" | "delete";

function normalizeScope(scope: unknown): MemoryScope {
    return "global";
    // return scope === "global" ? "global" : "workspace";
}

/**
 * Executes the memory tool.
 *
 * @param args.action - "write" stores a memory, "read" loads its full detail, "delete" removes it.
 * @param args.key - The memory's key (slugified on write).
 * @param args.short - Required for write: one-line summary shown in the prompt index.
 * @param args.long - Required for write: the full memory text.
 * @param args.scope - "global" (all projects) or "workspace" (this project, default).
 */
export async function memory_exec(args: {
    action: MemoryAction;
    key: string;
    short?: string;
    long?: string;
    scope?: MemoryScope;
}): Promise<ToolAnswer<unknown>> {
    if (!args.key || typeof args.key !== "string") {
        return toolError("key is required");
    }
    const scope = normalizeScope(args.scope);

    switch (args.action) {
        case "write": {
            if (!args.short || typeof args.short !== "string") {
                return toolError("short is required for write (a one-line summary)");
            }
            if (!args.long || typeof args.long !== "string") {
                return toolError("long is required for write (the full memory text)");
            }
            const slug = await writeMemory(args.key, args.short, args.long, scope);
            logMsg(`Agent - memory write [${scope}] ${slug}`);
            return toolSuccess({ key: slug, scope }, `Stored memory '${slug}' (${scope}).`);
        }
        case "read": {
            const long = readMemory(args.key, args.scope ? scope : undefined);
            if (long === null) {
                return toolError(`No memory found for key '${args.key}'.`);
            }
            return toolSuccess({ key: args.key, long });
        }
        case "delete": {
            const removed = await deleteMemory(args.key, scope);
            if (!removed) {
                return toolError(`No memory found for key '${args.key}' in ${scope}.`);
            }
            logMsg(`Agent - memory delete [${scope}] ${args.key}`);
            return toolSuccess({ key: args.key, scope }, `Deleted memory '${args.key}' (${scope}).`);
        }
        default:
            return toolError(`Unknown action '${args.action}'. Use write, read or delete.`);
    }
}

export const memory_def = {
    type: "function" as const,
    function: {
        name: "memory",
        description:
            "Persist usefull facts across sessions. Stored memories are listed in your system prompt as [scope] key — summary. " +
            "Use action 'write' to remember a fact (user preferences, project conventions, settings)." +
            "Use action 'read' to load a memory's full detail by key." +
            "Use action 'delete' to remove an outdated one." +
            "Do not store transient, conversation-only details.",
        parameters: {
            type: "object",
            properties: {
                action: {
                    type: "string",
                    enum: ["write", "read", "delete"],
                    description: "What to do: write, read or delete a memory.",
                },
                key: {
                    type: "string",
                    description: "Short identifier for the memory, e.g. 'deploy-process' or 'user-style'.",
                },
                short: {
                    type: "string",
                    description: "Write only: a concise one-line summary.",
                },
                long: {
                    type: "string",
                    description: "Write only: full memory information.",
                },
                // Workspace scope disabled for now — memory is always global.
                // scope: {
                //     type: "string",
                //     enum: ["global", "workspace"],
                //     description:
                //         "'global' for facts about the user that apply to every project; 'workspace' (default) for facts specific to this project.",
                // },
            },
            required: ["action", "key"],
        },
    },
};
