import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EXTENSION_HARD_TOKEN_CAP } from "../../common/utils";

// overflow guard for tool output: inline when small, spilled losslessly to a temp file when
// large - the agent reads the file back in ranges instead of getting hard-truncated output

const MAX_INLINE_CHARS = EXTENSION_HARD_TOKEN_CAP * 4;
const TEMP_DIR_NAME = "collama-tmp";

/** Captured tool output: either inline or a temp-file reference. */
export type CapturedOutput = {
    output?: string;
    filePath?: string;
    lineCount?: number;
    message?: string;
};

function countLines(text: string): number {
    return text.length === 0 ? 0 : text.split("\n").length;
}

/**
 * Returns small output inline; output past the ~10k-token cap is written to a temp file
 * and referenced by path. `label` names the producer in the temp filename.
 */
export function captureOutput(output: string, label = "shell"): CapturedOutput {
    if (output.length <= MAX_INLINE_CHARS) {
        return { output };
    }

    const dir = path.join(os.tmpdir(), TEMP_DIR_NAME);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${Date.now()}-${label}.txt`);
    fs.writeFileSync(filePath, output, "utf-8");

    const lineCount = countLines(output);
    return {
        filePath,
        lineCount,
        message: `Output exceeded ~10k tokens. Wrote ${lineCount} lines to ${filePath} — use the read tool with startLine/endLine to inspect it.`,
    };
}
