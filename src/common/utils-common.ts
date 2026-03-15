import Anthropic from "@anthropic-ai/sdk";
import { createByModelName } from "@microsoft/tiktokenizer";
import nodeFetch from "node-fetch";
import { Readable } from "node:stream";
import { Ollama } from "ollama";
import OpenAI from "openai";
import * as vscode from "vscode";
import { logMsg } from "../logging";

/**
 * Wraps an async operation with a VS Code progress notification.
 *
 * @param title - The title shown in the progress notification.
 * @param task - The async function to execute.
 * @returns The result of the task.
 */
export async function withProgressNotification<T>(title: string, task: () => Promise<T>): Promise<T> {
    return vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Window,
            title,
            cancellable: false,
        },
        task,
    );
}

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

export default Tokenizer;

let tlsRejectUnauthorized = true;

/**
 * Toggle TLS certificate validation (process-wide).
 * When disabled, equivalent to NODE_TLS_REJECT_UNAUTHORIZED=0.
 */
export function setTlsRejectUnauthorized(reject: boolean): void {
    if (reject !== tlsRejectUnauthorized) {
        tlsRejectUnauthorized = reject;
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = reject ? "1" : "0";
        logMsg(`TLS certificate validation: ${reject ? "enabled" : "disabled"}`);
    }
}

/**
 * Proxy-aware fetch wrapper.
 *
 * node-fetch uses Node.js http.request under the hood, which VS Code
 * patches to honour the built-in `http.proxy` setting.  The raw
 * node-fetch Response, however, returns a Node.js Readable as `.body`
 * instead of a Web ReadableStream — breaking the Ollama SDK which
 * calls `body.getReader()`.
 *
 * This wrapper re-packages the response into a standard `Response`
 * with a proper Web ReadableStream body so both Ollama and OpenAI
 * SDKs work correctly.
 *
 * TLS settings (custom CA, reject unauthorized) are handled
 * process-wide via NODE_TLS_REJECT_UNAUTHORIZED and NODE_EXTRA_CA_CERTS.
 */
export async function proxyFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    const response = await nodeFetch(input as any, init as any);
    const body = response.body ? (Readable.toWeb(response.body as any) as ReadableStream) : null;
    return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
    });
}

/**
 * Creates and configures an Ollama client instance.
 *
 * @param url - The base URL of the Ollama host.
 * @param bearer - Optional bearer token for authentication.
 * @returns A configured Ollama client.
 */
export function requestOllama(url: string, bearer?: string): Ollama {
    const ollama = new Ollama({
        ...(bearer ? { headers: { Authorization: `Bearer ${bearer}` } } : {}),
        host: url,
        fetch: proxyFetch as typeof fetch,
    });
    return ollama;
}

/**
 * Creates and configures an OpenAI client instance.
 *
 * @param url - The base URL of the OpenAI-compatible API.
 * @param bearer - Optional API key or bearer token for authentication.
 * @returns A configured OpenAI client.
 */
export function requestOpenAI(url: string, bearer?: string): OpenAI {
    // Only append /v1 if it's not already present in the URL
    const baseURL = url.endsWith("/v1") ? url : url + "/v1";
    const openai = new OpenAI({
        apiKey: bearer ?? "",
        baseURL: baseURL,
        fetch: proxyFetch as typeof fetch,
    });
    return openai;
}

/**
 * Creates and configures an Anthropic client instance.
 *
 * @param url - The base URL of the Anthropic API (defaults to https://api.anthropic.com).
 * @param apiKey - The Anthropic API key.
 * @returns A configured Anthropic client.
 */
export function requestAnthropic(url: string, apiKey: string): Anthropic {
    return new Anthropic({
        apiKey: apiKey,
        baseURL: url,
        fetch: proxyFetch as typeof fetch,
    });
}
