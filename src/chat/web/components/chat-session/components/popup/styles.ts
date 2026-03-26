// src/chat/web/components/chat_session/components/popup/styles.ts
import { css } from "lit";
import { themeColors } from "../../../../styles/theme-colors";
import { themeFonts } from "../../../../styles/theme-fonts";

export const popupStyles = css`
    .popup-overlay {
        display: none;
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 1000;
        background: var(--vscode-widget-shadow);
    }

    .popup-overlay.open {
        display: block;
    }

    .sessions-popup {
        display: none;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        z-index: 1001;
        background: var(--vscode-dropdown-background);
        border: 1px solid var(--vscode-dropdown-border);
        border-radius: 4px;
        box-shadow: 0 4px 12px var(--vscode-widget-shadow);
        max-height: 300px;
        overflow-y: auto;
    }

    .sessions-popup.open {
        display: block;
    }
`;

export const sessionItemStyles = css`
    .session-item {
        display: flex;
        align-items: center;
        padding: 8px 12px;
        cursor: pointer;
        border-left: 3px solid transparent;
        transition: background 0.1s ease;
    }

    .session-item:hover {
        background: var(--vscode-list-hoverBackground);
    }

    .session-item.active {
        background: var(--vscode-focusBorder);
        color: var(--vscode-list-activeSelectionForeground);
        border-left-color: var(--vscode-list-activeSelectionForeground);
    }

    .session-info {
        flex: 1;
        min-width: 0;
        overflow: hidden;
    }

    .session-title {
        font-size: ${themeFonts.medium};
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: ${themeColors.uiFont};
    }

    .session-title-input {
        font-size: ${themeFonts.medium};
        width: 100%;
        padding: 2px 4px;
        border: 1px solid var(--vscode-focusBorder);
        border-radius: 2px;
        background: ${themeColors.uiBackground};
        color: var(--vscode-input-foreground);
        outline: none;
    }

    .session-date {
        font-size: ${themeFonts.small};
        color: ${themeColors.uiFontDimm};
        margin-top: 2px;
    }

    .session-actions {
        display: flex;
        gap: 2px;
        opacity: 0;
    }

    .session-item:hover .session-actions {
        opacity: 1;
    }

    .rename-button {
        color: ${themeColors.uiFont};
    }

    .copy-button {
        color: ${themeColors.uiFont};
    }

    .export-button {
        color: ${themeColors.uiFont};
    }

    .delete-button {
        color: var(--vscode-errorForeground);
    }
`;

export const emptyStateStyles = css`
    .empty-state {
        padding: 1rem;
        text-align: center;
        color: ${themeColors.uiFontDimm};
    }
`;
