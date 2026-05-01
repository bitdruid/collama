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
    private factoryClient?: OllamaClient | OpenAiClient;

    /** Creates a provider client from the currently detected backend in sysConfig. */
    constructor(private readonly requestType: RequestType) {
        const backend = requestType === "completion" ? sysConfig.backendCompletion : sysConfig.backendInstruct;

        if (backend === "ollama") {
            this.factoryClient = new OllamaClient();
        } else if (backend === "openai") {
            this.factoryClient = new OpenAiClient();
        }
    }

    /** Delegates chat requests to the selected provider client. */
    async chat(settings: LlmChatSettings, onChunk?: (chunk: string) => void): Promise<ChatResult> {
        if (!this.factoryClient) {
            throw new Error(`LLM client not initialized for ${this.requestType}`);
        }
        return this.factoryClient.chat(settings, onChunk);
    }

    /** Checks prompt size against context length before delegating generation. */
    async generate(settings: LlmGenerateSettings): Promise<string> {
        if (!this.factoryClient) {
            throw new Error(`LLM client not initialized for ${this.requestType}`);
        }

        const promptTokens = await Tokenizer.calcTokens(settings.prompt);
        if (!checkPredictFitsContextLength(settings.options.num_predict, promptTokens, settings.options.num_ctx)) {
            showErrorMessage(
                `Prompt (${promptTokens} tokens) exceeds available context window (${settings.options.num_ctx} tokens). Please reduce content.`,
            );
            return "";
        }

        return this.factoryClient.generate(settings);
    }
}
