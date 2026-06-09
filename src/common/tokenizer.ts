import { createByModelName } from "@microsoft/tiktokenizer";
import { ChatHistory } from "./context-chat";

/**
 * Utility class for estimating token counts using a model-specific tokenizer.
 *
 * The tokenizer is lazily initialized on first use and cached for subsequent
 * calls. This class currently supports the `gpt-4o` model via the
 * `@microsoft/tiktokenizer` package.
 */
class Tokenizer {
    /** Cached tokenizer instance, initialized lazily. */
    private static tokenizer: Awaited<ReturnType<typeof createByModelName>> | null = null;
    /** Promise that resolves when tokenizer is initialized. */
    private static initPromise: Promise<void> | null = null;

    /**
     * Initialize the tokenizer in the background.
     * Call this during extension activation to avoid delays on first use.
     */
    static async init(): Promise<void> {
        if (!this.initPromise) {
            this.initPromise = (async () => {
                this.tokenizer = await createByModelName("gpt-4o");
            })();
        }
        return this.initPromise;
    }

    /**
     * Retrieves the singleton tokenizer instance.
     *
     * @returns A promise that resolves to the tokenizer.
     */
    private static async getTokenizer() {
        if (!this.tokenizer) {
            this.tokenizer = await createByModelName("gpt-4o");
        }
        return this.tokenizer;
    }

    /**
     * Calculates the number of tokens required to encode the given text.
     *
     * @param text - The input string to encode.
     * @returns A promise that resolves to the token count.
     */
    static async calcTokens(text: string): Promise<number> {
        const tokenizer = await this.getTokenizer();
        return tokenizer.encode(text).length;
    }
}

/**
 * Initialize the tokenizer in the background.
 * Call this during extension activation to avoid delays on first use.
 *
 * @returns A promise that resolves when the tokenizer is initialized.
 */
export async function initTokenizer(): Promise<void> {
    return Tokenizer.init();
}

/**
 * Strips customKeys from a message, returning only the fields sent to the LLM.
 * This ensures consistent tokenization across the codebase.
 *
 * @param msg - The message to strip customKeys from
 * @returns The message without customKeys
 */
export function stripCustomKeys(msg: ChatHistory): Omit<ChatHistory, "customKeys"> {
    const { customKeys: _, ...llmFields } = msg;
    return llmFields;
}

/**
 * Ensures every message in the array has `customKeys.msgTokens` populated.
 * Only tokenizes messages that are missing the value — mutates in place.
 *
 * @param messages - The array of chat history messages to update.
 * @returns A promise that resolves when all messages have been processed.
 */
export async function populateMsgTokens(messages: ChatHistory[]): Promise<void> {
    await Promise.all(
        messages.map(async (msg) => {
            if (msg.customKeys?.msgTokens !== undefined) {
                return;
            }
            const llmFields = stripCustomKeys(msg);
            const tokens = await Tokenizer.calcTokens(JSON.stringify(llmFields));
            msg.customKeys = { ...msg.customKeys, msgTokens: tokens };
        }),
    );
}

export default Tokenizer;
