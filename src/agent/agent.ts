import { ChatContext, ChatHistory } from "../common/context-chat";
import { LlmClientFactory } from "../common/llmclient";
import { buildAgentOptions, emptyStop, LlmChatSettings } from "../common/llmoptions";
import { agent_Template } from "../common/prompt";
import Tokenizer, { withProgressNotification } from "../common/utils-common";
import { userConfig } from "../config";
import { logAgent, logMsg } from "../logging";
import { getBearerInstruct } from "../secrets";
import { executeTool, getToolDefinitions, getToolTarget, resetAutoAcceptEdits } from "./tools";

export type AgentEvent = { type: string; [key: string]: unknown };


/**
 * This class manages the lifecycle of an agent task, including initializing the client,
 * maintaining conversation history via `AgentContext`, executing tool calls, and streaming
 * generated text chunks. It supports cancellation of ongoing operations.
 */
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

            const initMessages: ChatHistory[] = userConfig.agentic
                ? [{ role: "system", content: agent_Template }, ...messages]
                : [...messages];
            const history = new AgentContext(initMessages);

            try {
                this.client = new LlmClientFactory("instruction");

                const settings: LlmChatSettings = {
                    apiEndpoint: { url: userConfig.apiEndpointInstruct, bearer: await getBearerInstruct() },
                    model: userConfig.apiModelInstruct,
                    messages: history.getMessages(),
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

                    // agent internal history
                    history.push({
                        role: "assistant",
                        content: result.content,
                        tool_calls: result.toolCalls,
                    });

                    // push to webview history
                    onEvent?.({
                        type: "agent-tool-calls",
                        toolCalls: result.toolCalls,
                    });

                    for (const toolCall of result.toolCalls) {
                        if (signal.aborted) {
                            break;
                        }

                        const args = JSON.parse(toolCall.function.arguments);

                        const hasArgs = Object.keys(args).length > 0;
                        let argsBody = "";
                        if (hasArgs) {
                            argsBody = Object.entries(args)
                                .map(([key, value]) => `${key}:\n${value}`)
                                .join("\n");
                        }
                        const toolResult = await executeTool(toolCall.function.name, args);

                        history.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: toolResult,
                        });

                        history.deduplicateReadFile(toolCall.id);

                        onEvent?.({
                            type: "agent-tool-done",
                            toolCallId: toolCall.id,
                            toolName: toolCall.function.name,
                            toolArgs: argsBody,
                            toolTarget: getToolTarget(toolCall.function.name, args),
                            toolResult: toolResult,
                        });
                    }

                    const toolTokens = await Tokenizer.calcTokens(JSON.stringify(history.getMessages()));
                    logAgent(`Agent Tokens: ${toolTokens}`);
                    onEvent?.({ type: "agent-tokens", tokens: toolTokens });

                    if (signal.aborted) {
                        break;
                    }

                    onEvent?.({ type: "agent-assistant-new" });
                }
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                const errorStack = error instanceof Error ? error.stack : "";
                logMsg(`\n\n**Agent Error**: ${errorMsg}\n\n${errorStack}\n\n`);
                throw error;
            } finally {
                if (signal.aborted) {
                    onChunk("\n\n**Cancelled**");
                }
                this.abortController = null;
            }
        });
    }
}

/**
 * Manages the conversation history and context for the Agent.
 *
 * Wraps a ChatContext instance to handle message storage, retrieval,
 * and specific optimization logic.
 * TODO: readFile content is currently set to empty in the session
 * Agent needs to re-read on each request (save tokens in history).
 * Possible Solution:
 * Session does deduplication of the whole chat by itself
 */
class AgentContext {
    private context: ChatContext;

    /**
     * Initializes a new AgentContext with a set of initial messages.
     * @param messages - The initial conversation history.
     */
    constructor(messages: ChatHistory[]) {
        this.context = new ChatContext();
        this.context.setMessages([...messages]);
    }

    /**
     * Retrieves the current list of messages in the conversation history.
     * @returns An array of ChatHistory objects.
     */
    public getMessages(): ChatHistory[] {
        return this.context.getMessages();
    }

    /**
     * Appends a new message to the conversation history.
     * @param message - The message object to add.
     */
    public push(message: ChatHistory): void {
        this.context.push(message);
    }

    /**
     * Replaces stale readFile tool results with a short note.
     * - Full-file reads (no line numbers) evict all previous reads of the same file.
     * - Partial reads evict older reads with identical startLine/endLine arguments.
     */
    public deduplicateReadFile(newToolCallId: string): void {
        const newTc = this.context.findToolCall(newToolCallId);
        if (!newTc || newTc.function.name !== "readFile") {
            return;
        }
        const newArgs = JSON.parse(newTc.function.arguments);
        const isFullRead = newArgs.startLine === undefined && newArgs.endLine === undefined;

        for (let i = 0; i < this.context.length(); i++) {
            const toolCallId = this.context.getToolCallId(i);
            if (!toolCallId || toolCallId === newToolCallId) {
                continue;
            }
            const tc = this.context.findToolCall(toolCallId);
            if (!tc || tc.function.name !== "readFile") {
                continue;
            }
            const args = JSON.parse(tc.function.arguments);
            if (args.filePath !== newArgs.filePath) {
                continue;
            }
            // if full re-read OR all args are identical - deduplicate
            const isDuplicate =
                isFullRead || (args.startLine === newArgs.startLine && args.endLine === newArgs.endLine);
            if (isDuplicate) {
                this.context.setToolResponse(toolCallId, { content: "[stale - file re-read later]" });
            }
        }
    }
}
