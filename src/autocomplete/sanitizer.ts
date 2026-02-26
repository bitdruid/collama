import { distance } from "fastest-levenshtein";

import { isFullLineComment } from "../common/comments";
import { Context } from "../common/context_editor";
import { logMsg } from "../logging";

export class Sanitizer {
    static sanitize(snippet: string, context: Context): string {
        const s = new Sanitizer(snippet, context);
        return s.run();
    }

    private constructor(
        private snippet: string,
        private context: Context,
        private normSnippetLines: string[] = [],
        private normPrefixLines: string[] = [],
        private normSuffixLines: string[] = [],
    ) {}

    private run(): string {
        this.normalizeCompletionLines();
        this.remove_extraBrackets();
        this.remove_extraQuotes();
        return this.drop_CodeRepeat() ? this.snippet : "";
    }

    /**
     * This function fixes extra closing brackets at the end of a snippet.
     *
     * How it works:
     * 1. Take the normalized snippet, prefix, and suffix lines and join them into full strings.
     * 2. Create three counters, one for each type of bracket: {}, (), [].
     * 3. Walk through the snippet string:
     *      - Increase the counter when an opening bracket is found.
     *      - Decrease the counter when a closing bracket is found.
     * 4. At the end we have two possible situations:
     *      - Negative counter: more brackets were closed than opened.
     *      - Positive counter: more brackets were opened than closed.
     *
     * 5. Case negative (too many closing brackets):
     *      - Count the closing brackets at the start of the suffix until the first non-bracket character.
     *      - Add these brackets to an array and reverse it.
     *      - Walk through the original snippet from the end, removing brackets that match the array in order.
     *      - If a line becomes empty after removing brackets, remove the line entirely.
     *      - Stop as soon as a non-closing-bracket character is reached.
     *
     * Case positive (likely correct):
     * - Do nothing because the snippet is missing closing brackets that probably appear in the suffix.
     */

    /**
     * Remove extra closing brackets at the end of the snippet
     * if the snippet has more closing brackets than opening ones.
     *
     * Uses a full bracket balance approach:
     * - Counts brackets in snippet
     * - Only fixes if negative balance (extra closing brackets)
     * - Uses suffix to determine correct bracket removal
     * Logs counters, removed brackets, and removed lines.
     */
    private remove_extraBrackets(): void {
        if (!this.snippet) {
            return;
        }

        const opening = ["{", "(", "["];
        const closing = ["}", ")", "]"];
        const bracketMap: Record<string, string> = { "}": "{", ")": "(", "]": "[" };

        // 1. join normalized to full string, 2. create counters
        const snippetStr = this.normSnippetLines.join("");
        const counters: Record<string, number> = { "{": 0, "(": 0, "[": 0 };

        // 3. count brackets in snippet
        for (const char of snippetStr) {
            if (opening.includes(char)) {
                counters[char]++;
            }
            if (closing.includes(char)) {
                counters[bracketMap[char]]--;
            }
        }

        logMsg(`SANITIZER - bracket counters in snippet: ${JSON.stringify(counters)}`);

        // 4. check if any counter is negative (more closing than opening)
        const needsFix = Object.values(counters).some((v) => v < 0);
        if (!needsFix) {
            logMsg(`SANITIZER - snippet brackets balanced or positive, no fix needed`);
            return;
        }

        // case negative (more closing than opening)
        // count closing brackets
        const suffixStr = this.normSuffixLines.join("").trimStart();
        const suffixBrackets: string[] = [];
        for (const char of suffixStr) {
            if (closing.includes(char)) {
                suffixBrackets.push(char);
            } else {
                break;
            } // stop at first non-closing-bracket char
        }
        suffixBrackets.reverse(); // remove in reverse order

        if (!suffixBrackets.length) {
            return;
        }

        logMsg(`SANITIZER - extra closing brackets detected in snippet, will remove: ${suffixBrackets.join("")}`);

        // walk through snippet in reverse, remove brackets from end
        const snippetLines = this.snippet.split(/\r?\n/);
        let suffixIndex = 0;

        for (let i = snippetLines.length - 1; i >= 0; i--) {
            let line = snippetLines[i];
            let j = line.length - 1;

            while (j >= 0 && suffixIndex < suffixBrackets.length) {
                const char = line[j];
                if (char === suffixBrackets[suffixIndex]) {
                    // remove the bracket
                    line = line.slice(0, j) + line.slice(j + 1);
                    logMsg(`SANITIZER - removed bracket '${char}' from line ${i + 1}`);
                    suffixIndex++;
                } else if (closing.includes(char)) {
                    // extra closing bracket but not matching suffix? skip
                    j--;
                    continue;
                } else {
                    // stop at first non-closing-bracket char
                    break;
                }
                j--;
            }

            // remove empty line after bracket removal
            if (line.trim().length === 0) {
                snippetLines.splice(i, 1);
                logMsg(`SANITIZER - removed empty line ${i + 1} after bracket removal`);
            } else {
                snippetLines[i] = line;
            }

            if (suffixIndex >= suffixBrackets.length) {
                break;
            } // all brackets removed
        }

        this.snippet = snippetLines.join("\n");
    }

    /**
     * Remove extra closing quotes already present in the suffix
     */
    private remove_extraQuotes(): void {
        return;
    }

    /**
     * Clean all three code blocks (snippet, prefix, suffix):
     * - Split into individual lines
     * - Trim leading/trailing whitespace
     * - Remove empty lines
     * - Remove full-line comments (using `isFullLineComment`)
     *
     * This function also terminates possible newline/carriage-only cases.
     */
    private normalizeCompletionLines() {
        const cleanCodeLines = (text: string): string[] =>
            text
                .split(/\r?\n/)
                .map((l) => l.replace(/\s+/g, ""))
                .filter((l) => l.length > 0)
                .filter((l) => !isFullLineComment(l));

        this.normSnippetLines = cleanCodeLines(this.snippet);
        this.normPrefixLines = cleanCodeLines(this.context.activePrefix);
        this.normSuffixLines = cleanCodeLines(this.context.activeSuffix);
    }

    /**
     * Calculate a similarity score between two strings using the Levenshtein distance.
     *
     * The function returns a value between 0 and 1, representing how similar the two
     * strings are. A score of 1.0 indicates identical strings, while 0.0 means
     * completely different.
     *
     * @param string1 - The first string to compare.
     * @param string2 - The second string to compare.
     * @returns {number} A similarity value in the range [0, 1].
     */
    private stringSimilarity(string1: string, string2: string): number {
        if (string1 === string2) {
            return 1.0;
        }
        const levenshtein = distance(string1, string2);
        const maxLength = Math.max(string1.length, string2.length);
        return Math.round((1 - levenshtein / maxLength) * 100) / 100;
    }

    /**
     * Drop the completion if it consists of repeated code only.
     *
     * This function analyzes the current code snippet along with the surrounding
     * prefix (lines before the cursor) and suffix (lines after the cursor)
     * to detect if the snippet is likely a repeat of existing code.
     *
     * Steps:
     * 1. Clean all three code blocks (snippet, prefix, suffix):
     *    - Split into individual lines
     *    - Trim leading/trailing whitespace
     *    - Remove empty lines
     *    - Remove full-line comments (using `isFullLineComment`)
     * 2. Determine a "context window" based on the snippet length.
     *    This window defines how many lines before (prefix) and after (suffix)
     *    the cursor are compared to the snippet.
     * 3. Slice the cleaned prefix and suffix arrays according to the context window.
     * 4. Compute Levenshtein similarity between:
     *    - snippet vs. prefix
     *    - snippet vs. suffix
     * 5. Log the results (used lines, prefix, snippet, suffix, and similarity scores)
     *    for debugging or analysis.
     *
     * This allows intelligent dropping of AI-generated completions that are
     * repetitive and avoids inserting redundant code.
     *
     * The resulting similarity can be used to drop the completion and request a new one.
     *
     */
    private drop_CodeRepeat(): boolean {
        // the lines of the snippets are used as a context window - they are increased by a specified percentage
        const snippetLineCount = this.normSnippetLines.length; //+ Math.round(snippetLines.length * 1);
        // prefix and suffix are cut to the context window
        const prefixLines = this.normPrefixLines.slice(-snippetLineCount);
        const suffixLines = this.normSuffixLines.slice(0, snippetLineCount);

        // levenshtein distance calculation for prefix and suffix in comparison to the snippet
        const levenshteinPrefix = this.stringSimilarity(this.normSnippetLines.join(""), prefixLines.join(""));
        const levenshteinSuffix = this.stringSimilarity(this.normSnippetLines.join(""), suffixLines.join(""));

        logMsg(`SANITIZER - completion levenshtein[PRE ${levenshteinPrefix} / SUF ${levenshteinSuffix}]`);

        if (snippetLineCount > 1) {
            if (levenshteinPrefix >= 0.75 || levenshteinSuffix >= 0.75) {
                logMsg(`SANITIZER - drop completion because repeated singleline`);
                return false;
            }
        }
        if (snippetLineCount === 1) {
            if (levenshteinPrefix >= 0.95 || levenshteinSuffix >= 0.95) {
                logMsg(`SANITIZER - drop completion because repeated multiline`);
                return false;
            }
        }
        logMsg(`SANITIZER - completion passed repetition check`);
        return true;
    }
}
// more ideas:

// darmerau-levenshtein
// jaro winkler

// first-line search
// Take the snippet lines (cleaned, comment-free).
// Start with the first line: search for an exact match in prefix + suffix.
// If found, check the next line sequentially.
// Keep counting consecutive matches.
// If the number of consecutive matches exceeds a threshold (e.g., 2–3 lines), consider it repeated.

// Sliding window line comparison
// Take a “window” of N lines from the snippet.
// Slide this window across prefix + suffix and compare exact matches.
// If any window matches completely, drop the completion.

// Hashing lines or blocks
// Hash each line (or N-line blocks) into a fingerprint.
// Compare snippet hashes to prefix+suffix hashes.
// Drop completion if hash matches exceed a threshold.

// Two lines hash the same if they contain the same characters in the same quantities.
function multisetHash(s: string): string {
    const counts = new Uint16Array(256);

    for (let i = 0; i < s.length; i++) {
        counts[s.charCodeAt(i)]++;
    }

    return counts.join(",");
}
const seen = new Set<string>();

// if (seen.has(key)) {
//     // duplicate completion
// } else {
//     seen.add(key);
// }

// Percentage of matching lines
// Count how many snippet lines exist in prefix + suffix (ignoring order).
// If percentage > threshold (e.g., 50–70%), drop completion.
