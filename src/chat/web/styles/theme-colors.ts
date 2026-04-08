import { unsafeCSS } from "lit";

const baseColor = unsafeCSS("var(--vscode-sideBar-background)");

type Color = { cssText: string } | string;
const cssOf = (c: Color) => (typeof c === "string" ? c : c.cssText);

/**
 * Adjust only the lightness channel in HSL, preserving hue and saturation.
 * `darken` moves in a fixed direction; `contrast` moves away from the base's
 * own lightness so the result is always more contrasting — this is what makes
 * borders/hover states work on both dark and light VSCode themes.
 * `sign()` requires Chromium 125+ (VSCode's webview is fine).
 */
const darken = (c: Color, n: number) => unsafeCSS(`hsl(from ${cssOf(c)} h s calc(l - ${n}))`);
const contrast = (c: Color, n: number) => unsafeCSS(`hsl(from ${cssOf(c)} h s calc(l - sign(l - 50) * ${n}))`);

const getBorder = (color: Color) => contrast(color, 10);
const getHover = (color: Color) => contrast(color, 4);

const backBaseColor = contrast(baseColor, 3);
const backDimmColor = darken(backBaseColor, 5);
const backDarkColor = darken(backBaseColor, 7);

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

    /* Out of Context Colors */
    outOfContextBackground: unsafeCSS("rgba(255, 60, 60, 0.08)"),
    outOfContextBorder: unsafeCSS("rgba(255, 60, 60, 0.25)"),

    /* Usage Bar Colors */
    usagePrimary: unsafeCSS("#4ec9b0"),
    usageWarning: unsafeCSS("#cca700"),
    usageDanger: unsafeCSS("#f14c4c"),

    /* Shadow Colors */
    shadowDark: unsafeCSS("rgba(0, 0, 0, 0.8)"),
    shadowLight: unsafeCSS("rgba(0, 0, 0, 0.3)"),

    /* User interactive element Colors */
    placeholder: contrast(backBaseColor, 15),
    disabled: unsafeCSS("#555"),
    cleanWhite: unsafeCSS("#fff"),
    focus: contrast(backBaseColor, 25),

    /* Font */
    uiFont: contrast(backBaseColor, 45),

    /* Default Background */
    uiBackground: backBaseColor,
    uiBackgroundHover: getHover(backBaseColor),

    /* Default Border */
    uiBorder: getBorder(backBaseColor),
    uiBorderHover: getHover(getBorder(backBaseColor)),

    /* Dimm */
    uiBackgroundDimm: backDimmColor,
    uiBackgroundHoverDimm: getHover(backDimmColor),
    uiBorderDimm: getBorder(backDimmColor),
    uiBorderHoverDimm: getHover(getBorder(backDimmColor)),

    /* Dark */
    uiBackgroundDark: backDarkColor,
    uiBackgroundHoverDark: getHover(backDarkColor),
    uiBorderDark: getBorder(backDarkColor),
    uiBorderHoverDark: getHover(getBorder(backDarkColor)),

    /* Scrollbar */
    scrollBar: unsafeCSS("var(--vscode-scrollbarSlider-background)"),
    scrollBarHover: unsafeCSS("var(--vscode-scrollbarSlider-hoverBackground)"),

    /* Hyperlink */
    hyperlink: unsafeCSS("var(--vscode-textLink-foreground)"),
    hyperlinkHover: unsafeCSS("var(--vscode-textLink-activeForeground)"),
} as const;
