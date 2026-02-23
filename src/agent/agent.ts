import { ChatHistory } from "../common/context_chat";
import { LlmClientFactory } from "../common/llmclient";
import { buildAgentOptions, emptyStop } from "../common/llmoptions";
import { userConfig } from "../config";
import { getBearerInstruct } from "../secrets";
import { executeTool, getToolDefinitions } from "./tools";

export class Agent {
    private client: LlmClientFactory | undefined;
    private abortController: AbortController | null = null;

    /**
     * Cancels the currently running agent task.
     */
    cancel() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }

    /**
     * Checks if the agent is currently running.
     */
    isRunning(): boolean {
        return this.abortController !== null;
    }

    /**
     * Executes the agent task, managing the interaction loop with the LLM.
     *
     * Initializes the client and processes the conversation history iteratively.
     * On each iteration:
     * 1. Requests a completion from the LLM.
     * 2. Streams any 'thinking' or reasoning content immediately to the user.
     * 3. If tool calls are detected, executes them, appends results to history,
     *    and repeats the loop.
     * 4. If no tool calls are present, the loop terminates.
     *
     * All outputs (reasoning, assistant text, and tool usage) are streamed via `onChunk`.
     *
     * @param messages - The conversation history to send to the LLM.
     * @param onChunk  - Callback invoked for every streamed text token.
     */
    async work(messages: ChatHistory[], onChunk: (chunk: string) => void) {
        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        try {
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
                // Check for cancellation before each iteration
                if (signal.aborted) {
                    onChunk("\n\n**Cancelled**");
                    break;
                }

                const result = await this.client.chat({ ...settings, messages: history }, (chunk) => onChunk(chunk));

                // Check for cancellation after receiving result
                if (signal.aborted) {
                    onChunk("\n\n**Cancelled**");
                    break;
                }

                // stream thinking first if present / prevent code-fence breaks
                // if (result.thinking) {
                //     const matches = result.thinking.match(/`+/g) || [];
                //     let longestRun = 0;
                //     for (const m of matches) {
                //         if (m.length > longestRun) {
                //             longestRun = m.length;
                //         }
                //     }
                //     const fence = "`".repeat(Math.max(3, longestRun + 1));
                //     onChunk(`\n${fence}Think: Reasoning\n${result.thinking}\n${fence}\n\n`);
                // }

                if (result.toolCalls.length === 0) {
                    break;
                }

                // assistant message (with tool_calls) to history.
                history.push({
                    role: "assistant",
                    content: result.content,
                    tool_calls: result.toolCalls,
                });

                // execute tool, append result to history, stream tool-use into chat
                for (const toolCall of result.toolCalls) {
                    // Check for cancellation before each tool execution
                    if (signal.aborted) {
                        onChunk("\n\n**Cancelled**");
                        break;
                    }

                    const args = JSON.parse(toolCall.function.arguments);
                    const toolResult = await executeTool(toolCall.function.name, args);

                    // tool info is streamed as a codeblock into the chat
                    const hasArgs = Object.keys(args).length > 0;
                    const argsBody = hasArgs ? `\n${JSON.stringify(args, null, 2)}` : "";
                    onChunk(`\n\`\`\`Tool: ${toolCall.function.name}${argsBody}\n\`\`\`\n\n`);

                    history.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: toolResult,
                    });
                }

                // Check for cancellation after all tools executed
                if (signal.aborted) {
                    onChunk("\n\n**Cancelled**");
                    break;
                }

                // blank line after tools
                onChunk("\n");
            }
        } finally {
            // Clean up abort controller when done (whether completed or cancelled)
            this.abortController = null;
        }
    }
}
