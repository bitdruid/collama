import * as vscode from "vscode";

import { sysConfig } from "../../config";
import { checkPredictFitsContextLength } from "../models";
import Tokenizer from "../tokenizer";
import { OllamaClient } from "./ollama";
import { OpenAiClient } from "./openai";
import type { ChatResult, LlmChatSettings, LlmClient, LlmGenerateSettings, RequestType } from "./types";

const { showErrorMessage } = vscode.window;

/**
 * Selects the detected provider client for completion or instruction requests.
 *
 * The factory keeps provider selection in one place while preserving the shared
 * LlmClient interface for autocomplete, chat, edits, commits, and the agent.
 */
export class LlmClientFactory implements LlmClient {
    private generateClient?: OllamaClient | OpenAiClient;
    private chatClient?: OpenAiClient;

    /** Creates a provider client from the currently detected backend in sysConfig. */
    constructor(private readonly requestType: RequestType) {
        const backend = requestType === "completion" ? sysConfig.backendCompletion : sysConfig.backendInstruct;

        if (backend === "ollama") {
            this.generateClient = new OllamaClient();
            this.chatClient = new OpenAiClient();
        } else if (backend === "openai") {
            const openai = new OpenAiClient();
            this.generateClient = openai;
            this.chatClient = openai;
        }
    }

    /** Routes chat requests through the OpenAI client (Ollama is /v1-compatible). */
    async chat(
        settings: LlmChatSettings,
        onChunk?: (chunk: string) => void,
        onReasoning?: (chunk: string) => void,
    ): Promise<ChatResult> {
        if (!this.chatClient) {
            throw new Error(`LLM client not initialized for ${this.requestType}`);
        }
        return this.chatClient.chat(settings, onChunk, onReasoning);
    }

    /** Checks prompt size against context length before delegating generation. */
    async generate(settings: LlmGenerateSettings): Promise<string> {
        if (!this.generateClient) {
            throw new Error(`LLM client not initialized for ${this.requestType}`);
        }

        const promptTokens = await Tokenizer.calcTokens(settings.prompt);
        if (!checkPredictFitsContextLength(settings.options.max_tokens, promptTokens, settings.num_ctx)) {
            showErrorMessage(
                `Prompt (${promptTokens} tokens) exceeds available context window (${settings.num_ctx} tokens). Please reduce content.`,
            );
            return "";
        }

        return this.generateClient.generate(settings);
    }
}
