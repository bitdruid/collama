import { ChatHistory } from "../common/context_chat";
import { LlmClientFactory } from "../common/llmclient";
import { buildAgentOptions, emptyStop, LlmChatSettings } from "../common/llmoptions";
import { agent_Template } from "../common/prompt";
import Tokenizer, { withProgressNotification } from "../common/utils";
import { userConfig } from "../config";
import { logAgent, logMsg } from "../logging";
import { getBearerInstruct } from "../secrets";
import { executeTool, getToolDefinitions, resetAutoAcceptEdits } from "./tools";

export type AgentEvent = { type: string; [key: string]: unknown };

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
     * Initializes the LLM client and processes the conversation history iteratively.
     * The loop proceeds as follows:
     * 1. Requests a completion from the LLM.
     * 2. Streams generated text tokens via the `onChunk` callback.
     * 3. If tool calls are detected, executes them, appends results to history,
     *    and repeats the loop.
     * 4. If no tool calls are present, the loop terminates.
     *
     * The operation can be cancelled externally via the `cancel` method.
     *
     * @param messages - The conversation history to send to the LLM.
     * @param onChunk  - Callback invoked for every streamed text token.
     * @param onEvent  - Optional callback for structured metadata events (e.g. token counts).
     * @returns {Promise<void>}
     */
    async work(messages: ChatHistory[], onChunk: (chunk: string) => void, onEvent?: (event: AgentEvent) => void) {
        await withProgressNotification(`collama: Agent running …`, async () => {
            this.abortController = new AbortController();
            resetAutoAcceptEdits();
            const signal = this.abortController.signal;
            const history: ChatHistory[] = userConfig.agentic
                ? [{ role: "system", content: agent_Template }, ...messages]
                : [...messages];

            try {
                this.client = new LlmClientFactory("instruction");

                const settings: LlmChatSettings = {
                    apiEndpoint: { url: userConfig.apiEndpointInstruct, bearer: await getBearerInstruct() },
                    model: userConfig.apiModelInstruct,
                    messages: history,
                    tools: userConfig.agentic ? getToolDefinitions() : [],
                    options: buildAgentOptions(),
                    stop: emptyStop(),
                    signal: signal,
                };

                while (true) {
                    if (signal.aborted) {
                        break;
                    }

                    const result = await this.client.chat({ ...settings }, (chunk) => {
                        if (!signal.aborted) {
                            onChunk(chunk);
                        }
                    });

                    if (result.toolCalls.length === 0) {
                        break;
                    }

                    history.push({
                        role: "assistant",
                        content: result.content,
                        tool_calls: result.toolCalls,
                    });

                    for (const toolCall of result.toolCalls) {
                        if (signal.aborted) {
                            break;
                        }

                        const args = JSON.parse(toolCall.function.arguments);

                        // tool info is streamed as a codeblock into the chat
                        const hasArgs = Object.keys(args).length > 0;
                        const argsBody = hasArgs ? `\n${JSON.stringify(args, null, 2)}` : "";
                        onChunk(`\n\`\`\`Tool: ${toolCall.function.name}${argsBody}\n\`\`\`\n\n`);

                        const toolResult = await executeTool(toolCall.function.name, args);

                        history.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: toolResult,
                        });

                        // if a file is read again, remove the old content to trim context
                        if (toolCall.function.name === "readFile") {
                            this.deduplicateReadFile(history, toolCall.id);
                        }
                    }

                    const toolTokens = await Tokenizer.calcTokens(JSON.stringify(history));
                    logAgent(`Agent Tokens: ${toolTokens}`);
                    onEvent?.({ type: "agent-tokens", tokens: toolTokens });

                    if (signal.aborted) {
                        break;
                    }

                    onChunk("\n");
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                const errorStack = error instanceof Error ? error.stack : "";
                logMsg(`\n\n**Agent Error**: ${errorMsg}\n\n${errorStack}\n\n`);
            } finally {
                if (signal.aborted) {
                    onChunk("\n\n**Cancelled**");
                }
                this.abortController = null;
            }
        });
    }

    /**
     * Replaces stale readFile tool results with a short note.
     * Only removes readFile calls where no line numbers are given.
     */
    private deduplicateReadFile(history: ChatHistory[], newToolCallId: string): void {
        const newReadInfo = this.getReadFileCallInfo(history, newToolCallId);
        if (!newReadInfo) {
            return;
        }

        for (const msg of history) {
            if (msg.role !== "tool" || msg.tool_call_id === newToolCallId) {
                continue;
            }
            const msgReadInfo = this.getReadFileCallInfo(history, msg.tool_call_id);
            // Only mark as stale if same file and previous call had no line numbers
            if (msgReadInfo && msgReadInfo.filePath === newReadInfo.filePath && !msgReadInfo.hasLineNumbers) {
                msg.content = "[stale - file re-read later]";
            }
        }
    }

    private getReadFileCallInfo(
        history: ChatHistory[],
        toolCallId: string,
    ): { filePath: string; hasLineNumbers: boolean } | null {
        for (const msg of history) {
            if (msg.role !== "assistant" || !msg.tool_calls) {
                continue;
            }
            const tc = msg.tool_calls.find((tc) => tc.id === toolCallId);
            if (tc && tc.function.name === "readFile") {
                const args = JSON.parse(tc.function.arguments);
                return {
                    filePath: args.filePath,
                    hasLineNumbers: args.startLine !== undefined || args.endLine !== undefined,
                };
            }
        }
        return null;
    }
}
