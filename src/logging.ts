import * as vscode from "vscode";

let logChannel: vscode.LogOutputChannel | undefined;
let streamChannel: vscode.OutputChannel | undefined;
let sanChannel: vscode.LogOutputChannel | undefined;

function getLogChannel(): vscode.LogOutputChannel {
    if (!logChannel) {
        logChannel = vscode.window.createOutputChannel("collama", { log: true });
        logChannel.clear();
    }
    return logChannel;
}

function getStreamChannel(): vscode.OutputChannel {
    if (!streamChannel) {
        streamChannel = vscode.window.createOutputChannel("collama (stream)");
        streamChannel.clear();
    }
    return streamChannel;
}
function getSanChannel(): vscode.LogOutputChannel {
    if (!sanChannel) {
        sanChannel = vscode.window.createOutputChannel("collama (sanitize)", { log: true });
        sanChannel.clear();
    }
    return sanChannel;
}

export function logMsg(message: string, level: "debug" | "info" | "warn" | "error" = "info") {
    const channel = getLogChannel();

    switch (level) {
        case "debug":
            channel.debug(message);
            break;
        case "warn":
            channel.warn(message);
            break;
        case "error":
            channel.error(message);
            break;
        default:
            channel.info(message);
    }
}

export function logStream(message: string) {
    const timestamp = new Date().toISOString();
    getStreamChannel().appendLine(`[${timestamp}] ${message}`);
}
export function logSan(message: string) {
    getSanChannel().append(message);
}
