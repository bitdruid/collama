export type ShellType = "bash" | "powershell";

// Dangerous constructs within a segment:
//   $( … )   command substitution (but NOT $(( … )) arithmetic)
//   <( … )   process substitution — runs the inner command
//   ` … `    backtick command substitution
//   > / >>   file redirection
//   \n       newline can smuggle a second command
const WRITE_CONSTRUCTS = /\$\((?!\()|<\(|`|>|\n/;

// fd duplication / close — reroutes existing streams, never touches disk:
//   2>&1, 1>&2, >&2, 2>&-, etc.
const FD_DUP = /\d*>&(?:\d+|-)/g;

// redirection to the null device discards output, never touches disk: 2>/dev/null, >>/dev/null
// lookahead requires a clean end (whitespace/separator/eol) so expansions or escaped
// chars after the target (`>/dev/null$FOO`, `>/dev/null\ foo`) stay flagged
const DEVNULL_REDIRECT = /\d*>>?\s*\/dev\/null(?=[\s;&|)]|$)/g;

// quoted spans, scanned left-to-right in one alternation so interleaved quotes can't hide a
// real construct between them. The lookbehind keeps \" as a literal char, not a delimiter
const QUOTED_SPAN = /(?<!\\)(?:'[^']*'|"(?:[^"\\]|\\.)*")/g;

/**
 * Blanks quoted literals so quoted `>`/`;`/`|` neither flag as write constructs nor split
 * segments. Double-quoted spans keep `$` and backticks active in the shell, so those are
 * only blanked when free of both. Unterminated quotes stay in place and fail closed.
 */
function blankQuotedLiterals(command: string): string {
    return command.replace(QUOTED_SPAN, (m) => (m[0] === '"' && /[$`]/.test(m) ? m : " "));
}

// git subcommands that read in every arg form - shared by both shells
// mutating subcommands are absent, so they prompt
// prettier-ignore
const GIT_READ_ONLY_SUBCOMMANDS = new Set([
    "status", "log", "show", "diff", "blame", "shortlog", "describe", "ls-files", "rev-parse",
]);

// bash / coreutils that only read.
// prettier-ignore
const BASH_READ_ONLY = new Set([
    "ls", "cat", "head", "tail", "wc", "stat", "tree",
    "grep", "rg", "fd", "find",
    "jq", "cut", "tr", "diff",
    "echo", "printf", "which", "type", "pwd", "date",
]);

// bash commands that read by default but execute/delete via specific flags
// every other listed command writes only to stdout, so they need no guard
const BASH_WRITE_FLAGS: Record<string, RegExp> = {
    find: /\s-(?:exec(?:dir)?|ok(?:dir)?|delete|fprint\w*|fls)\b/,
    fd: /\s-[a-zA-Z]*[xX]\b|\s--exec/,
};

// PowerShell cmdlets/aliases that only read. PowerShell is case-insensitive, so these are
// lowercase and the command head is lowercased before lookup. No write-by-flag cases here
// (file writes go through Out-File/Set-Content/redirection, none of which are listed).
// prettier-ignore
const POWERSHELL_READ_ONLY = new Set([
    "get-childitem", "ls", "dir", "gci",
    "get-content", "cat", "type", "gc",
    "get-item", "gi", "get-itemproperty",
    "select-string", "sls",
    "measure-object", "measure",
    "compare-object", "compare",
    "sort-object", "sort",
    "select-object", "select",
    "where-object", "where",
    "get-location", "pwd", "gl",
    "resolve-path", "test-path",
    "get-process", "ps", "gps",
    "get-command", "gcm",
    "write-output", "echo",
    "convertfrom-json", "convertto-json", "get-date",
]);

// Split on every command separator. Includes `&` (background/call operator) so a
// read-only head can't add a second command, e.g. `cat x & rm -rf y`. Fd-duplications
// (2>&1, >&2) stripped before splitting so the inner `&` isn't mistaken.
const SEGMENT_SEPARATORS = /&&|\|\||[;|&]/;

function segmentIsReadOnly(seg: string, shellType: ShellType): boolean {
    const trimmed = seg.trim();
    if (!trimmed) {
        return true;
    }
    const tokens = trimmed.split(/\s+/);
    const head = tokens[0].toLowerCase();

    // git shared case-insensitive; subcommands stay case-sensitive.
    if (head === "git") {
        return GIT_READ_ONLY_SUBCOMMANDS.has(tokens[1]);
    }
    if (shellType === "powershell") {
        return POWERSHELL_READ_ONLY.has(head);
    }
    if (!BASH_READ_ONLY.has(head)) {
        return false;
    }
    return !BASH_WRITE_FLAGS[head]?.test(trimmed);
}

/**
 * Classifies one command at construction: quoted literals are blanked, harmless redirects
 * (fd duplication, /dev/null) stripped, then the remainder is scanned once. Fails closed:
 * anything unrecognized is write-capable and not read-only.
 */
export class CommandCheck {
    /** A write-capable construct survived the stripping (redirection, substitution, newline). */
    readonly writeCapable: boolean;
    /** Every segment is a known read-only invocation and no write construct is present. */
    readonly readOnly: boolean;

    constructor(command: string, shellType: ShellType) {
        const stripped = blankQuotedLiterals(command).replace(FD_DUP, "").replace(DEVNULL_REDIRECT, "");
        this.writeCapable = WRITE_CONSTRUCTS.test(stripped);
        this.readOnly =
            !this.writeCapable && stripped.split(SEGMENT_SEPARATORS).every((seg) => segmentIsReadOnly(seg, shellType));
    }
}
