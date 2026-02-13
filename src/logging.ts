/**
 * Utility for managing VSCode output channels and logging messages.
 *
 * @module output
 */

import * as vscode from "vscode";

const channels: Record<string, vscode.OutputChannel> = {};

/**
 * Retrieves an existing output channel or creates a new one.
 *
 * @param {string} name - The name of the output channel.
 * @param {{ log: true }} [options] - Optional configuration for the channel.
 * @returns {vscode.OutputChannel} The output channel instance.
 */
function getChannel(name: string, options?: { log: true }): vscode.OutputChannel {
    if (!channels[name]) {
        if (options) {
            channels[name] = vscode.window.createOutputChannel(name, options);
        } else {
            channels[name] = vscode.window.createOutputChannel(name);
        }
        channels[name].clear();
    }
    return channels[name];
}

/**
 * Logs a message to the designated output channel with the specified level.
 *
 * @param {string} message - The message to log.
 * @param {"debug" | "info" | "warn" | "error"} [level="info"] - The log level.
 */
export function logMsg(message: string, level: "debug" | "info" | "warn" | "error" = "info") {
    const channel = getChannel("collama", { log: true }) as vscode.LogOutputChannel;
    (channel as any)[level](message);
}
