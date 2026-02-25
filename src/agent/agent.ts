import { ChatHistory } from "../common/context_chat";
import { LlmClientFactory } from "../common/llmclient";
import { buildAgentOptions, emptyStop } from "../common/llmoptions";
import { agentSystem_Template } from "../common/prompt";
import { withProgressNotification } from "../common/utils";
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

            // Promise that rejects when the abort signal fires, used to race against long-running calls
            const abortPromise = new Promise<never>((_, reject) => {
                signal.addEventListener("abort", () => reject(new Error("AbortError")), { once: true });
            });

            // current chat history extended with each tool message
            const history: ChatHistory[] = [{ role: "system", content: agentSystem_Template }, ...messages];

            while (true) {
                if (signal.aborted) {
                    break;
                }

                const result = await Promise.race([
                    this.client.chat({ ...settings, messages: history }, (chunk) => {
                        if (!signal.aborted) {
                            onChunk(chunk);
                        }
                    }),
                    abortPromise,
                ]);

                if (signal.aborted) {
                    break;
                }

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
                    if (signal.aborted) {
                        break;
                    }

                    const args = JSON.parse(toolCall.function.arguments);

                    // tool info is streamed as a codeblock into the chat
                    const hasArgs = Object.keys(args).length > 0;
                    const argsBody = hasArgs ? `\n${JSON.stringify(args, null, 2)}` : "";
                    onChunk(`\n\`\`\`Tool: ${toolCall.function.name}${argsBody}\n\`\`\`\n\n`);

                    const toolResult = await Promise.race([
                        withProgressNotification(`collama: tooling - ${toolCall.function.name}…`, async () => {
                            return await executeTool(toolCall.function.name, args);
                        }),
                        abortPromise,
                    ]);

                    history.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: toolResult,
                    });
                }

                if (signal.aborted) {
                    break;
                }

                // blank line after tools
                onChunk("\n");
            }
        } catch (err) {
            // expected when user cancels — not a real error
            if (err instanceof Error && err.message === "AbortError") {
                onChunk("\n\n**Cancelled**");
            } else {
                throw err;
            }
        } finally {
            this.abortController = null;
        }
    }
}
