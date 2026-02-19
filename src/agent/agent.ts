import { ChatHistory } from "../common/context_chat";
import { LlmClientFactory } from "../common/llmclient";
import { buildInstructionOptions, emptyStop } from "../common/llmoptions";
import { getModelThinking } from "../common/models";
import { userConfig } from "../config";
import { getBearerInstruct } from "../secrets";
import { getToolDefinitions } from "./tools";

export class Agent {
    // private context: Context | null = null;
    // private chat: ChatContext;
    private client: LlmClientFactory | undefined;

    /**
     * Executes the agent task.
     *
     * @param messages - The history of messages to send to the LLM.
     * @param onChunk - Callback to handle streaming tokens from the LLM.
     */
    async work(messages: ChatHistory[], onChunk: (chunk: string) => void) {
        this.client = new LlmClientFactory("instruction");

        const response = await this.client.chat(
            {
                apiEndpoint: { url: userConfig.apiEndpointInstruct, bearer: await getBearerInstruct() },
                model: userConfig.apiModelInstruct,
                messages: messages,
                tools: getToolDefinitions(),
                options: buildInstructionOptions(),
                stop: emptyStop(),
                think: await getModelThinking(userConfig.apiModelInstruct),
            },
            (chunk) => onChunk(chunk),
        );
    }
}
