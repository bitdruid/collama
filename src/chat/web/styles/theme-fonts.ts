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
} as const;
