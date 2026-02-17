import { z } from "zod";
import { Context } from "../common/context";
import { LlmClientFactory } from "../common/llmclient";

z.string;

class Agent {
    private context: Context | undefined;
    private client: LlmClientFactory | undefined;

    constructor(context: Context, client: LlmClientFactory) {
        this.context = context;
        this.client = client;
    }
}

// get a full tree of the repository
async function repoTree() {
    return;
}
// get a full docstring map of the repository
async function repoMap() {
    return;
}
// search a file and get the path
async function searchFile() {
    return;
}
// search a pattern inside files
async function searchPattern() {}
