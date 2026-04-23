import { ChatContext, ChatHistory } from "../common/context-chat";
import { checkPredictFitsContextLength } from "../common/models";
import { populateMsgTokens } from "../common/tokenizer";
import { buildInstructionOptions } from "../common/types-llm";
import { userConfig } from "../config";

export interface ContextState {
    contextStartIndex: number;
    contextUsed: number;
}

export async function recomputeContextState(
    messages: ChatContext,
    numPredict = buildInstructionOptions().num_predict,
    contextMax = userConfig.apiTokenContextLenInstruct,
): Promise<ContextState> {
    const contextStartIndex = await findContextStartIndex(messages.getMessages(), numPredict, contextMax);
    return {
        contextStartIndex,
        contextUsed: messages.sumTokensFrom(contextStartIndex),
    };
}

/**
 * Trims user+assistant message pairs from the beginning of the conversation
 * until the predicted response fits within the remaining context window.
 * Uses {@link checkPredictFitsContextLength} to account for response headroom and overhead buffers.
 * Always keeps at least the last message pair (the new user message + empty assistant).
 */
export async function trimMessagesForContext(
    messages: ChatHistory[],
    numPredict: number,
    contextMax: number,
    previousContextStartIndex = 0,
): Promise<{ trimmedMessages: ChatHistory[]; turnsRemoved: number; tokensFreed: number; messagesRemoved: number }> {
    await populateMsgTokens(messages);
    const tokenCounts = messages.map((msg) => msg.customKeys!.msgTokens!);
    const startIndex = findContextStartIndexFromTokenCounts(messages, tokenCounts, numPredict, contextMax);

    if (startIndex === 0) {
        return { trimmedMessages: messages, turnsRemoved: 0, tokensFreed: 0, messagesRemoved: 0 };
    }

    const ctx = new ChatContext();
    ctx.setMessages(messages);

    const previousStartIndex = Math.min(Math.max(previousContextStartIndex, 0), messages.length);
    const newlyRemovedStart = Math.min(previousStartIndex, startIndex);
    const newlyRemovedTokens =
        startIndex > previousStartIndex
            ? tokenCounts.slice(newlyRemovedStart, startIndex).reduce((sum, count) => sum + count, 0)
            : 0;

    return {
        trimmedMessages: messages.slice(startIndex),
        turnsRemoved: startIndex > previousStartIndex ? countTurnsInRange(ctx, newlyRemovedStart, startIndex) : 0,
        tokensFreed: newlyRemovedTokens,
        messagesRemoved: startIndex,
    };
}

async function findContextStartIndex(messages: ChatHistory[], numPredict: number, contextMax: number): Promise<number> {
    await populateMsgTokens(messages);
    return findContextStartIndexFromTokenCounts(
        messages,
        messages.map((msg) => msg.customKeys!.msgTokens!),
        numPredict,
        contextMax,
    );
}

function findContextStartIndexFromTokenCounts(
    messages: ChatHistory[],
    tokenCounts: number[],
    numPredict: number,
    contextMax: number,
): number {
    let totalTokens = tokenCounts.reduce((sum, count) => sum + count, 0);
    const reservedPredict = getTrimPredictBudget(numPredict, contextMax);

    if (checkPredictFitsContextLength(reservedPredict, totalTokens, contextMax)) {
        return 0;
    }

    const ctx = new ChatContext();
    ctx.setMessages(messages);

    let startIndex = 0;

    // Remove full turns from the beginning, keeping at least the last turn.
    while (!checkPredictFitsContextLength(reservedPredict, totalTokens, contextMax)) {
        const turnEnd = ctx.getTurnEnd(startIndex);
        if (turnEnd >= messages.length) {
            break;
        }
        for (let i = startIndex; i < turnEnd; i++) {
            totalTokens -= tokenCounts[i];
        }
        startIndex = turnEnd;
    }

    return startIndex;
}

function countTurnsInRange(ctx: ChatContext, start: number, end: number): number {
    let count = 0;
    let i = start;
    while (i < end) {
        const msg = ctx.getMsgByIndex(i);
        if (msg?.role === "user") {
            count++;
        }
        const turnEnd = ctx.getTurnEnd(i);
        i = turnEnd > i ? turnEnd : i + 1;
    }
    return count;
}

function getTrimPredictBudget(numPredict: number, contextMax: number): number {
    if (contextMax <= 0) {
        return Math.max(0, numPredict);
    }
    if (numPredict < contextMax) {
        return Math.max(0, numPredict);
    }
    return Math.max(1, Math.floor(contextMax * 0.25));
}
