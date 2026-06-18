import * as vscode from "vscode";
import { buildAgentOptions, emptyStop, LlmChatSettings, LlmClientFactory, ToolCall } from "../common/client";
import { ChatContext, ChatHistory } from "../common/context-chat";
import { PromptConstructor } from "../common/prompt";
import Tokenizer, { stripCustomKeys } from "../common/tokenizer";
import { userConfig } from "../config";
import { logAgent, logMsg } from "../logging";
import { getBearerInstruct } from "../secrets";
import { executeTool, getToolDefinitions, getToolTarget, normalizeToolArgs, resetAutoAcceptEdits } from "./tools";

export type AgentEvent = { type: string; [key: string]: unknown };
export type AgentMode = "plain" | "default" | "sub";

/**
 * Orchestrates the execution of an LLM-powered agent that can process messages,
 * make tool calls, and manage conversation history.
 */
export class Agent {
    private client: LlmClientFactory;
    private abortController: AbortController | null = null;
    private agentMode: AgentMode;
    /** User messages queued mid-run via {@link injectMessage}, drained at the next turn boundary. */
    private injected: { message: ChatHistory; id: string }[] = [];

    /**
     * Creates a new Agent instance.
     * @param agentMode - The mode of the agent: "plain" (no system prompt or tools), "default" (full agent), or "sub" (sub-agent with system prompt but no tools).
     */
    constructor(agentMode: AgentMode) {
        this.agentMode = agentMode;
        this.client = new LlmClientFactory("instruction");
    }

    /**
     * Cancels the currently running agent work if any.
     */
    cancel() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }

    /**
     * Checks if the agent is currently running.
     * @returns True if the agent is running, false otherwise.
     */
    isRunning(): boolean {
        return this.abortController !== null;
    }

    /**
     * Queues a user message to be injected into the running loop without stopping it.
     * The message is appended to the history at the next turn boundary (after the current
     * turn's tools resolve), so the following turn sees the interjection.
     * @param content - The user message content (with any contexts already embedded).
     * @param customKeys - Optional display metadata (e.g. attached contexts) for the webview.
     * @param id - Correlation id so the webview can match the pending ghost on drain/cancel.
     */
    injectMessage(content: string, customKeys: ChatHistory["customKeys"] | undefined, id: string): void {
        this.injected.push({ message: { role: "user", content, customKeys }, id });
    }

    /** Removes a still-queued interjection by id (no-op if it already drained). */
    cancelInjected(id: string): void {
        this.injected = this.injected.filter((q) => q.id !== id);
    }

    /**
     * Drains queued interjections into the history and notifies the host so it can render them.
     * Called at the top of the loop, before the next turn is built.
     * @param history - The agent's live conversation history.
     * @param onEvent - Optional callback for agent events.
     */
    private drainInjected(history: ChatContext, onEvent?: (event: AgentEvent) => void) {
        if (this.injected.length === 0) {
            return;
        }
        for (const { message, id } of this.injected.splice(0)) {
            history.push(message);
            onEvent?.({ type: "agent-injected", message, injectId: id });
        }
    }

    /**
     * Executes the agent work loop, processing messages and handling tool calls.
     * @param messages - The chat context containing conversation history.
     * @param onChunk - Callback for streaming response chunks.
     * @param onEvent - Optional callback for agent events (tool calls, token counts, etc.).
     */
    async work(messages: ChatContext, onChunk: (chunk: string) => void, onEvent?: (event: AgentEvent) => void) {
        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Window, title: "collama: Agent running …", cancellable: false },
            async () => {
                this.abortController = new AbortController();
                resetAutoAcceptEdits();
                const signal = this.abortController.signal;

                const { history, tools } = this.prepareAgent(messages);

                try {
                    const settings = await this.buildSettings(history, tools, signal);

                    while (true) {
                        if (signal.aborted) {
                            break;
                        }

                        // Pull in any user messages queued mid-run so the upcoming turn sees them.
                        this.drainInjected(history, onEvent);

                        const result = await this.executeTurn(settings, signal, onChunk, onEvent);

                        if (result.toolCalls.length === 0) {
                            // Agent is done — unless the user interjected while it was answering.
                            if (this.injected.length === 0) {
                                break;
                            }
                            // Persist the streamed final answer, open a fresh assistant slot, and
                            // loop so the next turn responds to the interjection.
                            history.push({ role: "assistant", content: result.content });
                            onEvent?.({ type: "agent-new-assistant" });
                            continue;
                        }

                        history.push({ role: "assistant", content: result.content, tool_calls: result.toolCalls });
                        onEvent?.({ type: "agent-tool-calls", toolCalls: result.toolCalls });

                        await this.executeTools(result.toolCalls, history, signal, onEvent);

                        if (signal.aborted) {
                            break;
                        }
                    }
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    const errorStack = error instanceof Error ? error.stack : "";
                    logMsg(`\n\n**Agent Error**: ${errorMsg}\n\n${errorStack}\n\n`);
                    throw error;
                } finally {
                    this.abortController = null;
                }
            },
        );
    }

    /**
     * Prepares the agent context and tool definitions based on the agent mode.
     * @param messages - The chat context to initialize the agent with.
     * @returns An object containing the initialized history and tool definitions.
     */
    private prepareAgent(messages: ChatContext): {
        history: ChatContext;
        tools: ReturnType<typeof getToolDefinitions>;
    } {
        const history = new ChatContext();
        if (this.agentMode !== "plain") {
            history.setMessages([PromptConstructor.agentTemplate(), ...messages.getMessages()]);
        } else {
            history.setMessages(messages.getMessages());
        }

        return {
            history,
            tools: this.agentMode === "default" && userConfig.agenticMode ? getToolDefinitions() : [],
        };
    }

    /**
     * Builds the LLM chat settings for the current agent session.
     * @param history - The agent's conversation history.
     * @param tools - The tool definitions available to the agent.
     * @param signal - The abort signal for cancellation.
     * @returns The configured LLM chat settings.
     */
    private async buildSettings(
        history: ChatContext,
        tools: ReturnType<typeof getToolDefinitions>,
        signal: AbortSignal,
    ): Promise<LlmChatSettings> {
        return {
            apiEndpoint: { url: userConfig.apiEndpointInstruct, bearer: await getBearerInstruct() },
            model: userConfig.apiModelInstruct,
            messages: history.getMessages(),
            tools,
            options: buildAgentOptions(),
            stop: emptyStop(),
            signal,
        };
    }

    /**
     * Executes a single turn of the agent by calling the LLM.
     * @param settings - The chat settings for the LLM call.
     * @param signal - The abort signal for cancellation.
     * @param onChunk - Callback for streaming response chunks.
     * @returns The LLM response containing content and tool calls.
     */
    private async executeTurn(
        settings: LlmChatSettings,
        signal: AbortSignal,
        onChunk: (chunk: string) => void,
        onEvent?: (event: AgentEvent) => void,
    ) {
        return this.client.chat(
            { ...settings },
            (chunk) => {
                if (!signal.aborted) {
                    onChunk(chunk);
                }
            },
            (chunk) => {
                if (!signal.aborted) {
                    onEvent?.({ type: "agent-reasoning", chunk });
                }
            },
        );
    }

    /**
     * Executes the requested tool calls and updates the conversation history.
     * @param toolCalls - The tool calls to execute.
     * @param history - The agent's conversation history to update.
     * @param signal - The abort signal for cancellation.
     * @param onEvent - Optional callback for tool execution events.
     */
    private async executeTools(
        toolCalls: ToolCall[],
        history: ChatContext,
        signal: AbortSignal,
        onEvent?: (event: AgentEvent) => void,
    ) {
        logAgent(`[tool_calls]\n${JSON.stringify(toolCalls, null, 2)}`);

        for (const toolCall of toolCalls) {
            if (signal.aborted) {
                break;
            }

            // Mutates the tool call in place: history holds the same reference, so the
            // canonical filePath is what evalOutdated compares later.
            toolCall.function.arguments = normalizeToolArgs(toolCall.function.arguments);
            const args = JSON.parse(toolCall.function.arguments);
            const argsBody = Object.entries(args)
                .map(([k, v]) => `${k}:\n${v}`)
                .join("\n");
            const toolResult = await executeTool(toolCall.function.name, args);

            history.push({ role: "tool", tool_call_id: toolCall.id, content: toolResult });

            onEvent?.({
                type: "agent-tool-done",
                toolCallId: toolCall.id,
                toolName: toolCall.function.name,
                toolArgs: argsBody,
                toolTarget: getToolTarget(toolCall.function.name, args),
                toolResult,
                toolLastCall: toolCall === toolCalls.at(-1) && !signal.aborted,
            });
        }

        const toolTokens = await Tokenizer.calcTokens(JSON.stringify(history.getMessages().map(stripCustomKeys)));
        logAgent(`Agent Tokens: ${toolTokens}`);
        onEvent?.({ type: "agent-tokens", tokens: toolTokens });

        if (toolTokens > userConfig.apiTokenContextLenInstruct) {
            throw new Error(
                `Agent context exceeded limit: ${toolTokens} tokens > ${userConfig.apiTokenContextLenInstruct} (apiTokenContextLenInstruct)`,
            );
        }
    }
}
