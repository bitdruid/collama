import { ChatHistory } from "../common/context_chat";
import { LlmClientFactory } from "../common/llmclient";
import { buildAgentOptions, buildInstructionOptions, emptyStop } from "../common/llmoptions";
import { userConfig } from "../config";
import { getBearerInstruct } from "../secrets";
import { executeTool, getToolDefinitions } from "./tools";

export class Agent {
    private client: LlmClientFactory | undefined;

    /**
     * Executes the agent task with an optional tool-calling loop.
     *
     * On each iteration the LLM response is checked for tool calls.
     * If tool calls are present they are executed, their results appended to the
     * message history, and the LLM is called again.  When no tool calls remain
     * the final text response has already been streamed via `onChunk` and the
     * loop ends.  Tool use is surfaced to the user as markdown streamed into
     * the same assistant message before the final answer.
     *
     * @param messages - The conversation history to send to the LLM.
     * @param onChunk  - Callback invoked for every streamed text token.
     */
    async work(messages: ChatHistory[], onChunk: (chunk: string) => void) {
        this.client = new LlmClientFactory("instruction");

        const settings = {
            apiEndpoint: { url: userConfig.apiEndpointInstruct, bearer: await getBearerInstruct() },
            model: userConfig.apiModelInstruct,
            tools: getToolDefinitions(),
            options: buildAgentOptions(),
            stop: emptyStop(),
        };

        // current chat history extended with each tool message
        const history: ChatHistory[] = [...messages];

        while (true) {
            const result = await this.client.chat({ ...settings, messages: history }, (chunk) => onChunk(chunk));

            // stream thinking first if present / prevent code-fence breaks
            if (result.thinking) {
                const matches = result.thinking.match(/`+/g) || [];
                let longestRun = 0;
                for (const m of matches) {
                    if (m.length > longestRun) {
                        longestRun = m.length;
                    }
                }
                const fence = "`".repeat(Math.max(3, longestRun + 1));
                onChunk(`\n${fence}Think: Reasoning\n${result.thinking}\n${fence}\n\n`);
            }

            if (result.toolCalls.length === 0) {
                break;
            }

            // stream assistant message content first
            if (result.content) {
                onChunk(result.content);
            }

            // assistant message (with tool_calls) to history.
            history.push({
                role: "assistant",
                content: result.content,
                tool_calls: result.toolCalls,
            });

            // execute tool, append result to history, stream tool-use into chat
            for (const toolCall of result.toolCalls) {
                const args = JSON.parse(toolCall.function.arguments);
                const toolResult = await executeTool(toolCall.function.name, args);

                // tool info is streamed as a codeblock into the chat
                const hasArgs = Object.keys(args).length > 0;
                const argsBlock = hasArgs
                    ? `\n\`\`\`Tool: ${toolCall.function.name}\n${JSON.stringify(args, null, 2)}\n\`\`\``
                    : "";
                onChunk(`\n${argsBlock}\n\n`);

                history.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: toolResult,
                });
            }

            // blank line after tools
            onChunk("\n");
        }
    }
}
