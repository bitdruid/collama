import { css } from "lit";

/**
 * Centralized color theme for the chat application
 * Define all standard color tints here and use them across components
 * Colors are named after the buttons that use them
 */
export const themeColors = css`
    :host {
        /* Submit Button Colors */
        --color-submit: #2277a8;
        --color-submit-hover: #185d86;
        --color-submit-active: #145a75;

        /* Context Button Colors */
        --color-context: #4aaf50;
        --color-context-hover: #3c9641;

        /* Cancel Button Colors */
        --color-cancel: #a82222;
        --color-cancel-hover: #861818;

        /* Compress Button Colors */
        --color-compress: #e9a849;
        --color-compress-hover: #c98a3d;

        /* Gallery Button Colors */
        --color-gallery: #9b59b6;
        --color-gallery-hover: #8e44ad;

        /* Auto-Accept Button Colors */
        --color-auto-accept: #d87979;
        --color-auto-accept-hover: #b86565;
        --color-auto-accept-active: #ff6b6b;

        /* Role Colors */
        --color-system: #4aaf50;
        --color-user: #2277a8;
        --color-assistant: #4aaf50;
        --color-tool: #d87979;

        /* Usage Bar Colors */
        --color-usage-primary: #4ec9b0;
        --color-usage-warning: #cca700;
        --color-usage-danger: #f14c4c;

        /* Shadow Colors */
        --color-shadow: rgba(0, 0, 0, 0.8);

        /* Neutral Colors */
        --color-ui-font: var(--vscode-foreground);
        --color-disabled: #555;
        --color-text-white: #fff;
    }
`;

/**
 * Helper function to get color variable names for use in styles
 * Usage: background-color: var(--color-submit);
 */
export const colorVars = {
    submit: "var(--color-submit)",
    submitHover: "var(--color-submit-hover)",
    submitActive: "var(--color-submit-active)",

    context: "var(--color-context)",
    contextHover: "var(--color-context-hover)",

    cancel: "var(--color-cancel)",
    cancelHover: "var(--color-cancel-hover)",

    compress: "var(--color-compress)",
    compressHover: "var(--color-compress-hover)",

    gallery: "var(--color-gallery)",
    galleryHover: "var(--color-gallery-hover)",

    autoAccept: "var(--color-auto-accept)",
    autoAcceptHover: "var(--color-auto-accept-hover)",
    autoAcceptActive: "var(--color-auto-accept-active)",

    system: "var(--color-system)",
    user: "var(--color-user)",
    assistant: "var(--color-assistant)",
    tool: "var(--color-tool)",

    usagePrimary: "var(--color-usage-primary)",
    usageWarning: "var(--color-usage-warning)",
    usageDanger: "var(--color-usage-danger)",

    shadow: "var(--color-shadow)",

    uiFont: "var(--color-ui-font)",
    disabled: "var(--color-disabled)",
    textWhite: "var(--color-text-white)",
} as const;
