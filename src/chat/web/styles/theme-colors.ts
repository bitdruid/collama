import { unsafeCSS } from "lit";

/**
 * Reusable color values for consistent color usage.
 * Usage: color: ${themeColors.submit};
 *        background-color: ${themeColors.context};
 */
export const themeColors = {
    /* Submit Button Colors */
    submit: unsafeCSS("#2277a8"),
    submitHover: unsafeCSS("#185d86"),
    submitActive: unsafeCSS("#0d3d52"),

    /* Context Button Colors */
    context: unsafeCSS("#3a9a40"),
    contextHover: unsafeCSS("#2c8232"),

    /* Cancel Button Colors */
    cancel: unsafeCSS("#a82222"),
    cancelHover: unsafeCSS("#861818"),
    cancelActive: unsafeCSS("#4d0d0d"),

    /* Compress Button Colors */
    compress: unsafeCSS("#d99839"),
    compressHover: unsafeCSS("#b98a2d"),

    /* Gallery Button Colors */
    gallery: unsafeCSS("#9b59b6"),
    galleryHover: unsafeCSS("#8e44ad"),

    /* Auto-Accept Button Colors */
    autoAccept: unsafeCSS("#d87979"),
    autoAcceptHover: unsafeCSS("#b86565"),
    autoAcceptActive: unsafeCSS("#ff6b6b"),

    /* Ghost Chat Button Colors */
    ghostChat: unsafeCSS("#7a9bb5"),
    ghostChatHover: unsafeCSS("#6388a3"),
    ghostChatActive: unsafeCSS("#8bb8d6"),

    /* Clear Chat Button Colors */
    clearChat: unsafeCSS("#b07070"),
    clearChatHover: unsafeCSS("#995c5c"),
    clearChatActive: unsafeCSS("#6e4545"),

    /* Role Colors */
    system: unsafeCSS("#9b59b6"),
    user: unsafeCSS("#2277a8"),
    assistant: unsafeCSS("#3a9a40"),
    tool: unsafeCSS("#d87979"),

    /* Usage Bar Colors */
    usagePrimary: unsafeCSS("#4ec9b0"),
    usageWarning: unsafeCSS("#cca700"),
    usageDanger: unsafeCSS("#f14c4c"),

    /* Shadow Colors */
    shadow: unsafeCSS("rgba(0, 0, 0, 0.8)"),

    /* User interactive element Colors */
    disabled: unsafeCSS("#555"),
    textWhite: unsafeCSS("#fff"),

    /* System element Colors - CSS variables */
    uiFont: unsafeCSS("var(--vscode-foreground)"),
    uiFontDimm: unsafeCSS("var(--vscode-descriptionForeground)"),
    uiBorder: unsafeCSS("var(--vscode-commandCenter-border)"),
    uiBorderHover: unsafeCSS("var(--vscode-commandCenter-activeBorder)"),
    uiBorderFocus: unsafeCSS("var(--vscode-commandCenter-foreground)"),
    uiBackground: unsafeCSS("var(--vscode-commandCenter-background)"),
    uiBackgroundDimm: unsafeCSS("var(--vscode-editor-background)"),
    uiBackgroundHover: unsafeCSS("var(--vscode-commandCenter-activeBackground)"),
} as const;
