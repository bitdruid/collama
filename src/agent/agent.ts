import { ChatHistory } from "../common/context_chat";
import { LlmClientFactory } from "../common/llmclient";
import { buildInstructionOptions, emptyStop } from "../common/llmoptions";
import { getModelThinking } from "../common/models";
import { userConfig } from "../config";
import { getBearerInstruct } from "../secrets";
import { executeTool, getToolDefinitions } from "./tools";

const MAX_TOOL_ITERATIONS = 5;

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
            options: buildInstructionOptions(),
            stop: emptyStop(),
            think: await getModelThinking(userConfig.apiModelInstruct),
        };

        // current chat history extended with each tool message
        const history: ChatHistory[] = [...messages];

        for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
            const result = await this.client.chat({ ...settings, messages: history }, (chunk) => onChunk(chunk));

            if (result.toolCalls.length === 0) {
                break;
            }

            // Append the assistant message (with its tool_calls) to history.
            history.push({
                role: "assistant",
                content: result.content,
                tool_calls: result.toolCalls.map((tc) => ({
                    function: { name: tc.function.name, arguments: JSON.parse(tc.function.arguments) },
                })),
            });

            // execute tool, append result to history, stream tool-use into chat
            for (const toolCall of result.toolCalls) {
                const args = JSON.parse(toolCall.function.arguments);
                const toolResult = await executeTool(toolCall.function.name, args);
                const toolResultStr = JSON.stringify(toolResult);

                // tool info is streamed as a codeblock into the chat
                const hasArgs = Object.keys(args).length > 0;
                const argsBlock = hasArgs ? `\n\`\`\`json\n${JSON.stringify(args, null, 2)}\n\`\`\`` : "";
                onChunk(`\n**Tool use:** \`${toolCall.function.name}\`${argsBlock}\n\n`);

                history.push({ role: "tool", content: toolResultStr });
            }

            // blank line after tools
            onChunk("\n");
        }
    }
}
