import { AttachedContext } from "../common/context-chat";
import { llmInfoTag } from "./utils-front";

/**
 * Formats attached file/selection contexts as markdown code blocks
 * and prepends them to the user's text for LLM consumption.
 */
export function embedContexts(contexts: AttachedContext[], text: string): string {
    if (contexts.length === 0) {
        return text;
    }
    const blocks = contexts
        .map((ctx) => {
            const label = ctx.hasSelection ? `${ctx.fileName} (${ctx.startLine}-${ctx.endLine})` : ctx.fileName;
            return `${llmInfoTag(`filepath: ${ctx.filePath}`)}\n${label}\n\`\`\`\n${ctx.content}\n\`\`\``;
        })
        .join("\n\n");
    return `${blocks}\n\n${text}`;
}
