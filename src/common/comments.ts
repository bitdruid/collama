/**
 * AI GENERATED LIST OF COMMON COMMENT PATTERNS
 *
 * Common comment patterns across multiple programming languages.
 * Used for detecting and optionally removing full-line comments.
 *
 * Each entry is a tuple [start, end?]:
 *  - start: the starting comment token (required)
 *  - end: the ending comment token (optional, only for block comments)
 *
 * Notes:
 *  - Only full-line comments should be removed.
 *  - Inline comments (e.g., "const x = 5; // note") are NOT removed.
 *  - Multi-line block comments are only removed if start & end are on the same line.
 */
const commonCommentPatterns: [string, string?][] = [
    // Single-line comment styles
    ["//"], // C, C++, C#, Java, JavaScript, TypeScript, Swift, Kotlin, PHP, Rust
    ["#"], // Python, Shell, Perl, Ruby, YAML, R
    ["REM"], // BAT files (case-insensitive)
    ["--"], // Lua, SQL

    // Single-line full-block style (must start & end on same line)
    ["<!--", "-->"], // HTML, XML, XAML
    ["=begin", "=end"], // Ruby multi-line docblock

    // Multi-line block comment styles
    ["/*", "*/"], // C, C++, C#, Java, JavaScript, TypeScript, CSS, SCSS, PHP, Kotlin, Swift, Rust, SQL, Scala
    ["'''", "'''"], // Python docstring
    ['"""', '"""'], // Python docstring alternative
    ["--[[", "]]--"], // Lua multi-line block comment
];
/**
 * Determine if a line is a full-line comment using common comment patterns.
 * Only removes lines that are fully comments.
 *
 * @param line A string-line which should be checked against common comment patterns
 * @returns True if is a comment
 */
export const isFullLineComment = (line: string) => {
    const trimmed = line.trim();
    for (const [start, end] of commonCommentPatterns) {
        if (end) {
            if (trimmed.startsWith(start) && trimmed.endsWith(end)) {
                return true;
            }
        } else {
            if (trimmed.startsWith(start)) {
                return true;
            }
        }
    }
    return false;
};
