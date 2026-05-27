import { unsafeCSS } from "lit";

/**
 * Reusable font size values for consistent font usage.
 * Usage: font-size: ${themeFonts.small};
 *        font-size: ${themeFonts.medium};
 */
export const themeFonts = {
    small: unsafeCSS("10px"),
    medium: unsafeCSS("12px"),
    large: unsafeCSS("16px"),
    giant: unsafeCSS("20px"),
    user: unsafeCSS("14px"),
    family: unsafeCSS("var(--vscode-font-family)"),
    familyMono: unsafeCSS("var(--vscode-editor-font-family)"),
    weight: {
        thin: unsafeCSS("100"),
        extraLight: unsafeCSS("200"),
        light: unsafeCSS("300"),
        normal: unsafeCSS("400"),
        medium: unsafeCSS("500"),
        semiBold: unsafeCSS("600"),
        bold: unsafeCSS("700"),
        extraBold: unsafeCSS("800"),
        black: unsafeCSS("900"),
    },
} as const;
