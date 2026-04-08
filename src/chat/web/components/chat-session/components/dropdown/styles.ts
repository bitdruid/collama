// src/chat/web/components/chat_session/components/dropdown/styles.ts
import { css } from "lit";
import { themeColors } from "../../../../styles/theme-colors";
import { themeFonts } from "../../../../styles/theme-fonts";
import { themeStyles } from "../../../../styles/theme-styles";

export const dropdownStyles = css`
    .dropdown-overlay {
        display: none;
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 1000;
    }

    .dropdown-overlay.open {
        display: block;
    }

    .sessions-dropdown {
        display: none;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        z-index: 1001;
        background: ${themeColors.uiBackgroundDimm};
        border: 1px solid ${themeColors.uiBorderDimm};
        border-radius: 4px;
        max-height: 300px;
        overflow-y: auto;
    }

    .sessions-dropdown.open {
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
        background: ${themeColors.uiBackgroundHoverDimm};
    }

    .session-item.active {
        background: ${themeColors.uiBackgroundHoverDimm};
        color: ${themeColors.uiFont};
        border-left-color: ${themeColors.submit};
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
        border: none;
        border-radius: 4px;
        background: ${themeColors.uiBackgroundDimm};
        color: ${themeColors.uiFont};
        outline: none;
        box-shadow: none;
        box-sizing: border-box;
    }

    .session-title-input:focus {
        ${themeStyles.focus}
    }

    .session-date {
        font-size: ${themeFonts.small};
        color: ${themeColors.uiFont};
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
        color: ${themeColors.usageDanger};
    }
`;

export const emptyStateStyles = css`
    .empty-state {
        padding: 1rem;
        text-align: center;
        color: ${themeColors.uiFont};
    }
`;
