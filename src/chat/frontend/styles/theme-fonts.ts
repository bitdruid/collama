import jetbrainsMono200 from "@fontsource/jetbrains-mono/latin-200.css";
import jetbrainsMono400 from "@fontsource/jetbrains-mono/latin-400.css";
import jetbrainsMono700 from "@fontsource/jetbrains-mono/latin-700.css";
import roboto200 from "@fontsource/roboto/latin-200.css";
import roboto400 from "@fontsource/roboto/latin-400.css";
import roboto700 from "@fontsource/roboto/latin-700.css";
import { unsafeCSS } from "lit";

const STYLE_ID = "collama-fonts";

/** Injects @font-face rules into document.head once. */
export function injectFontStyles() {
    if (document.getElementById(STYLE_ID)) {
        return;
    }
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [roboto200, roboto400, roboto700, jetbrainsMono200, jetbrainsMono400, jetbrainsMono700].join(
        "\n",
    );
    document.head.appendChild(style);
}

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
    family: unsafeCSS("'Roboto', sans-serif"),
    familyMono: unsafeCSS("'JetBrains Mono', monospace"),
    weight: {
        light: unsafeCSS("200"),
        normal: unsafeCSS("400"),
        bold: unsafeCSS("700"),
    },
} as const;
