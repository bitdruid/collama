import { unsafeCSS } from "lit";

type Color = { cssText: string } | string;
const cssOf = (c: Color) => (typeof c === "string" ? c : c.cssText);

/**
 * Adjust only the lightness channel in HSL, preserving hue and saturation.
 * `darken` flips direction based on `--theme-tint` (set globally from the
 * VSCode theme kind): `1` on dark themes darkens, `-1` on light themes
 * lightens. `contrast` moves away from the base's own lightness so the
 * result is always more contrasting — this is what makes borders/hover
 * states work on both dark and light VSCode themes.
 */
const darken = (c: Color, n: number) => unsafeCSS(`hsl(from ${cssOf(c)} h s calc(l - var(--theme-tint, 1) * ${n}))`);
const contrast = (c: Color, n: number) => unsafeCSS(`hsl(from ${cssOf(c)} h s calc(l - sign(l - 50) * ${n}))`);

const getBorder = (color: Color) => contrast(color, 11);
const getHover = (color: Color) => contrast(color, 6);

export const baseColor = unsafeCSS("var(--vscode-sideBar-background)");
const defaultColor = contrast(baseColor, 6);
const dimmColor = darken(baseColor, 2);
//const backDarkColor = darken(defaultColor, 7);

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
    contextActive: unsafeCSS("#1e5221"),

    /* Cancel Button Colors */
    cancel: unsafeCSS("#a82222"),
    cancelHover: unsafeCSS("#861818"),
    cancelActive: unsafeCSS("#4d0d0d"),

    /* Compress Button Colors */
    compress: unsafeCSS("#d99839"),
    compressHover: unsafeCSS("#b98a2d"),
    compressActive: unsafeCSS("#8f6a1f"),

    /* Gallery Button Colors */
    gallery: unsafeCSS("#9b59b6"),
    galleryHover: unsafeCSS("#8e44ad"),
    galleryActive: unsafeCSS("#6c3483"),

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
    clearChatActive: unsafeCSS("#d09090"),

    /* Search Button Colors */
    search: unsafeCSS("#9eb57a"),
    searchHover: unsafeCSS("#809363"),
    searchActive: unsafeCSS("#bad690"),

    /* Search Highlight Colors */
    searchHighlight: unsafeCSS("rgba(255, 213, 79, 0.4)"),
    searchHighlightActive: unsafeCSS("rgba(255, 167, 38, 0.8)"),

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
    placeholder: contrast(defaultColor, 20),
    disabled: unsafeCSS("#555"),
    cleanWhite: unsafeCSS("#fff"),
    focus: contrast(defaultColor, 45),

    /* Font */
    uiFont: contrast(defaultColor, 50),

    /* Bubble and Chat-Input */
    uiBackground: defaultColor,
    uiBackgroundHover: getHover(defaultColor),
    uiBorder: getBorder(defaultColor),
    uiBorderHover: getHover(getBorder(defaultColor)),

    /* Dimm */
    uiBackgroundDimm: dimmColor,
    uiBackgroundHoverDimm: getHover(dimmColor),
    uiBorderDimm: getBorder(dimmColor),
    uiBorderHoverDimm: getHover(getBorder(dimmColor)),

    /* Scrollbar */
    scrollBar: unsafeCSS("var(--vscode-scrollbarSlider-background)"),
    scrollBarHover: unsafeCSS("var(--vscode-scrollbarSlider-hoverBackground)"),

    /* Hyperlink */
    hyperlink: unsafeCSS("var(--vscode-textLink-foreground)"),
    hyperlinkHover: unsafeCSS("var(--vscode-textLink-activeForeground)"),
} as const;
