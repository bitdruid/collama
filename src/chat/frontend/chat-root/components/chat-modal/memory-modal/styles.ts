import { css } from "lit";
import { themeColors, themeStyles } from "../../../../styles";

export const memoryModalStyles = css`
    .memory-body {
        max-height: 420px;
        overflow: auto;
    }

    .memory-empty {
        padding: 16px 8px;
        font-size: 12px;
        color: ${themeColors.uiFont};
        opacity: 0.7;
        text-align: center;
    }

    .memory-group {
        margin-bottom: 14px;
    }

    .memory-group-header {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        opacity: 0.65;
        margin: 6px 4px;
    }

    .memory-entry {
        position: relative;
        border: ${themeStyles.border.dimm};
        border-radius: ${themeStyles.borderRadius.small};
        background: ${themeColors.uiBackgroundDimm};
        margin: 6px 0;
        overflow: hidden;
    }

    .memory-entry-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        cursor: pointer;
    }

    .memory-entry-row:hover {
        background: ${themeColors.uiBackgroundHoverDimm};
    }

    .memory-entry-text {
        flex: 1;
        min-width: 0;
    }

    .memory-key {
        font-size: 12px;
        font-weight: 600;
        color: ${themeColors.uiFontHighlight};
    }

    .memory-short {
        font-size: 12px;
        color: ${themeColors.uiFont};
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .memory-chevron {
        display: inline-flex;
        transition: transform 0.15s ease;
        opacity: 0.7;
    }

    .memory-entry.expanded .memory-chevron {
        transform: rotate(180deg);
    }

    .memory-entry.expanded .memory-short {
        white-space: normal;
    }

    .memory-actions {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 0 8px;
        pointer-events: none;
        opacity: 0;
        transform: translateX(6px);
        transition:
            opacity 0.15s ease-out,
            transform 0.15s ease-out;
    }

    .memory-entry:hover .memory-actions,
    .memory-entry:focus-within .memory-actions {
        opacity: 1;
        transform: translateX(0);
        pointer-events: auto;
    }

    .memory-action {
        display: inline-flex;
        cursor: pointer;
        padding: 4px;
        border-radius: ${themeStyles.borderRadius.small};
        color: ${themeColors.uiFont};
        background: ${themeColors.uiBackground};
    }

    .memory-edit:hover {
        background: ${themeColors.submitHover};
        color: ${themeColors.cleanWhite};
    }

    .memory-delete:hover {
        background: ${themeColors.cancelHover};
        color: ${themeColors.cleanWhite};
    }

    .memory-long {
        padding: 0 10px 10px;
        font-size: 12px;
        white-space: pre-wrap;
        word-break: break-word;
        color: ${themeColors.uiFont};
    }

    .memory-add-form {
        margin-top: 12px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
`;
