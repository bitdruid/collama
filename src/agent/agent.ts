import * as vscode from "vscode";
import { buildAgentOptions, emptyStop, LlmChatSettings, LlmClientFactory, ToolCall } from "../common/client";
import { ChatContext, ChatHistory } from "../common/context-chat";
import { getAgentTemplate } from "../common/prompt";
import Tokenizer, { stripCustomKeys } from "../common/tokenizer";
import { userConfig } from "../config";
import { logAgent, logMsg } from "../logging";
import { getBearerInstruct } from "../secrets";
import {
    executeTool,
    getToolDefinitions,
    getToolTarget,
    resetAutoAcceptEdits,
    shouldDeduplicateToolResult,
} from "./tools";

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

                        const result = await this.executeTurn(settings, signal, onChunk);

                        if (result.toolCalls.length === 0) {
                            break;
                        }

                        history.push({ role: "assistant", content: result.content, tool_calls: result.toolCalls });
                        onEvent?.({ type: "agent-tool-calls", toolCalls: result.toolCalls });

                        await this.executeTools(result.toolCalls, history, signal, onEvent);

                        if (signal.aborted) {
                            break;
                        }

                        onEvent?.({ type: "agent-turn-start" });
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
        history: AgentContext;
        tools: ReturnType<typeof getToolDefinitions>;
    } {
        const initial =
            this.agentMode !== "plain"
                ? [{ role: "system" as const, content: getAgentTemplate() }, ...messages.getMessages()]
                : messages.getMessages();

        return {
            history: new AgentContext(initial),
            tools: this.agentMode === "default" && userConfig.agentic ? getToolDefinitions() : [],
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
        history: AgentContext,
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
    private async executeTurn(settings: LlmChatSettings, signal: AbortSignal, onChunk: (chunk: string) => void) {
        return this.client.chat({ ...settings }, (chunk) => {
            if (!signal.aborted) {
                onChunk(chunk);
            }
        });
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
        history: AgentContext,
        signal: AbortSignal,
        onEvent?: (event: AgentEvent) => void,
    ) {
        logAgent(`[tool_calls]\n${JSON.stringify(toolCalls, null, 2)}`);

        for (const toolCall of toolCalls) {
            if (signal.aborted) {
                break;
            }

            const args = JSON.parse(toolCall.function.arguments);
            const argsBody = Object.entries(args)
                .map(([k, v]) => `${k}:\n${v}`)
                .join("\n");
            const toolResult = await executeTool(toolCall.function.name, args);

            history.push({ role: "tool", tool_call_id: toolCall.id, content: toolResult });
            history.deduplicateToolResult(toolCall.id);

            onEvent?.({
                type: "agent-tool-done",
                toolCallId: toolCall.id,
                toolName: toolCall.function.name,
                toolArgs: argsBody,
                toolTarget: getToolTarget(toolCall.function.name, args),
                toolResult,
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

/**
 * Wrapper around ChatContext that provides agent-specific operations
 * for managing conversation history and tool result deduplication.
 */
class AgentContext {
    private context: ChatContext;

    /**
     * Creates a new AgentContext instance.
     * @param messages - The initial messages to populate the context with.
     */
    constructor(messages: ChatHistory[]) {
        this.context = new ChatContext();
        this.context.setMessages([...messages]);
    }

    /**
     * Retrieves all messages in the conversation history.
     * @returns An array of chat history entries.
     */
    getMessages(): ChatHistory[] {
        return this.context.getMessages();
    }

    /**
     * Adds a new message to the conversation history.
     * @param message - The message to add.
     */
    push(message: ChatHistory): void {
        this.context.push(message);
    }

    /**
     * Deduplicates tool results in the conversation history for the given tool call ID.
     * @param newToolCallId - The ID of the new tool call whose result should be checked for duplicates.
     */
    deduplicateToolResult(newToolCallId: string): void {
        this.context.deduplicateToolResult(newToolCallId, shouldDeduplicateToolResult);
    }
}
