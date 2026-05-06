import nodeFetch from "node-fetch";
import { Readable } from "node:stream";
import * as vscode from "vscode";

import { logIO, logMsg } from "../../logging";
import type { Options, Stop } from "./types";

const { showWarningMessage } = vscode.window;

/**
 * Fetch adapter shared by Ollama and OpenAI SDKs.
 *
 * VS Code patches Node's HTTP stack for proxy support, while the Ollama SDK
 * expects a Web ReadableStream. This bridges node-fetch responses back into
 * standard Response objects the SDKs can consume.
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
 * Normalizes raw model text before callers insert it into editor/chat state.
 *
 * This trims incomplete final lines when the token cap is reached and removes
 * common surrounding Markdown code fences added by chat-tuned models.
 */
export function cleanupResult(result: string, resultTokens: number, options: Options): string {
    // if result without newlines and whitespaces etc is empty then return empty
    if (!result || !result.trim()) {
        logIO("Empty output was stripped", "output");
        return "";
    }
    // if result is too long then cut it off (autocomplete prevent incomplete lines)
    if (resultTokens === options.num_predict && result.includes("\n")) {
        logMsg("Output reached token limit - cutting last line (probably incomplete)");
        result = result.split("\n").slice(0, -1).join("\n");
    }

    const fenceMatch = result.match(/```(?:[a-zA-Z0-9_-]+)?\s*\n([\s\S]*)```\s*$/);
    if (fenceMatch) {
        result = fenceMatch[1].replace(/\n$/, "");
    } else {
        result = result.replace(/^```[a-zA-Z0-9_-]*\s*\n?/, "").replace(/\n?```$/, "");
    }

    return result.trim();
}

/** Converts provider-neutral options into OpenAI-compatible request fields. */
export function optionsToOpenAI(options: Options): Record<string, any> {
    const optionsOpenAI: Record<string, any> = {};
    if (options.num_ctx !== undefined) {
        optionsOpenAI.max_context_length = options.num_ctx;
    }
    if (options.num_predict !== undefined) {
        optionsOpenAI.max_tokens = options.num_predict;
    }
    if (options.temperature !== undefined) {
        optionsOpenAI.temperature = options.temperature;
    }
    if (options.top_p !== undefined) {
        optionsOpenAI.top_p = options.top_p;
    }
    if (options.top_k !== undefined) {
        optionsOpenAI.top_k = options.top_k;
    }
    return optionsOpenAI;
}

/** Logs request metadata and input for extension diagnostics. */
export function logRequest(url: string, model: string, options: Options, stop: Stop, input: string): void {
    logMsg(`Requesting to ${url}; Model: ${model};`);
    logMsg(`Options:\n${JSON.stringify(options, null, 2)}`);
    logMsg(`Stop:\n${JSON.stringify([...stop.userStop, ...stop.modelStop], null, 2)}`);
    logMsg(
        `Input [${input.length} chars ~ ${Math.ceil(input.length / 4)} tokens]:\n${input.length > 50 ? `${input.slice(0, 250)}...` : input}`,
    );
    logIO(`\n${"-".repeat(18)}\n--- Input (plain):\n${"-".repeat(18)}\n${input}`, "input");
}

/** Logs model output throughput and warns when a response hits the configured token cap. */
export function logPerformance(
    tokenLimit: number,
    resultTokens: number,
    resultDurationNano: number,
    result: string,
): void {
    const resultDuration = (resultDurationNano / 1_000_000_000).toFixed(3);
    const resultTPS = resultDurationNano > 0 ? (resultTokens / (resultDurationNano / 1_000_000_000)).toFixed(1) : "0";
    logMsg(
        `Output [${result.length} chars ~ ${Math.ceil(result.length / 4)} tokens]:\n${result.length > 50 ? `${result.slice(0, 250)}...` : result}`,
    );
    logMsg(`Receive: tokens [${resultTokens}]; duration seconds [${resultDuration}]; tokens/sec [${resultTPS}]`);
    logIO(`\n${"-".repeat(18)}\n-- Output (plain):\n${"-".repeat(18)}\n${result}`, "output");
    if (tokenLimit === resultTokens) {
        const msg = "WARNING: Output token limit reached - Reduce input?";
        logMsg(msg);
        showWarningMessage(msg);
    }
}

/** Logs full Error details before rethrowing to the caller. */
export function handleError(err: unknown): never {
    if (err instanceof Error) {
        logMsg("Full error: " + JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    }
    throw err;
}

/** Flattens user and model stop tokens for provider SDK calls. */
export function buildStopTokens(stop: Stop): string[] {
    return [...stop.userStop, ...stop.modelStop];
}
