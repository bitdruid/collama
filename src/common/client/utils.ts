import nodeFetch from "node-fetch";
import { Readable } from "node:stream";
import * as vscode from "vscode";

import { logIO, logMsg } from "../../logging";
import { formatTokenEstimate } from "../utils";
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
    if (resultTokens === options.max_tokens && result.includes("\n")) {
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

/**
 * Selects the OpenAI request fields from the options.
 *
 * `Options` is already OpenAI-shaped, so this only drops `num_ctx`: the OpenAI
 * spec has no per-request context size — it is fixed server-side (launch flag for
 * llama.cpp/vLLM, Modelfile for Ollama). `num_ctx` is still used client-side to
 * check the prompt fits before sending.
 */
export function optionsToOpenAI(options: Options): Record<string, any> {
    const { num_ctx, ...openai } = options;
    return openai;
}

/**
 * Converts OpenAI-shaped options into Ollama's native option names for the
 * completion (autocomplete) path, which talks to Ollama's /api/generate.
 */
export function optionsToOllama(options: Options): Record<string, any> {
    const { max_tokens, ...rest } = options;
    return { ...rest, num_predict: max_tokens };
}

/** Logs request metadata and input for extension diagnostics. */
export function logRequest(url: string, model: string, options: Options, stop: Stop, input: string): void {
    logMsg(`Requesting to ${url}; Model: ${model};`);
    logMsg(`Options:\n${JSON.stringify(options, null, 2)}`);
    logMsg(`Stop:\n${JSON.stringify([...stop.userStop, ...stop.modelStop], null, 2)}`);
    logMsg(`Input ${formatTokenEstimate(input.length)}`);
    logIO(`\n${"-".repeat(18)}\n--- Input (plain):\n${"-".repeat(18)}\n${input}`, "input");
}

/** Logs model output throughput and warns when a response hits the configured token cap. */
function logPerformance(tokenLimit: number, resultTokens: number, resultDurationNano: number, result: string): void {
    const resultDuration = (resultDurationNano / 1_000_000_000).toFixed(3);
    const resultTPS = resultDurationNano > 0 ? (resultTokens / (resultDurationNano / 1_000_000_000)).toFixed(1) : "0";
    logMsg(`Output ${formatTokenEstimate(result.length)}`);
    logMsg(`Receive: tokens [${resultTokens}]; duration seconds [${resultDuration}]; tokens/sec [${resultTPS}]`);
    logIO(`\n${"-".repeat(18)}\n-- Output (plain):\n${"-".repeat(18)}\n${result}`, "output");
    if (tokenLimit === resultTokens) {
        const msg = "WARNING: Output token limit reached - Reduce input?";
        logMsg(msg);
        showWarningMessage(msg);
    }
}

/**
 * Logs throughput for a finished request: wall-clock time since the `startTime`
 * mark over the result token count. Shared by both providers and both chat and
 * generate, so all performance logs are measured the same way.
 */
export function summupPerformance(options: Options, startTime: bigint, resultTokens: number, result: string): void {
    const resultDurationNano = Number(process.hrtime.bigint() - startTime);
    logPerformance(options.max_tokens, resultTokens, resultDurationNano, result);
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
