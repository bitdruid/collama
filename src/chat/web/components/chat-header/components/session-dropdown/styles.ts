import { css } from "lit";
import { themeColors } from "../../../../styles/theme-colors";
import { themeFonts } from "../../../../styles/theme-fonts";

export const sessionItemStyles = css`
    .session-item {
        display: flex;
        align-items: center;
        padding: 8px 12px;
        cursor: pointer;
        border-left: 5px solid transparent;
        transition: background 0.1s ease;
    }

    .session-item:hover {
        background: ${themeColors.uiBackgroundHoverDimm};
    }

    .session-item.active {
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
        background: ${themeColors.uiBackground};
        color: ${themeColors.uiFont};
        outline: none;
        box-shadow: none;
        box-sizing: border-box;
    }

    .session-title-input:focus {
        box-shadow: 0 0 0 2px ${themeColors.submit};
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

    .action-button {
        padding: 4px 8px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: ${themeFonts.medium};
        background: transparent;
        color: ${themeColors.uiFont};
    }

    .action-button:hover {
        background: ${themeColors.uiBackgroundHoverDimm};
    }

    .export-button,
    .copy-button,
    .rename-button {
        color: ${themeColors.uiFont};
    }

    .delete-button {
        color: ${themeColors.usageDanger};
    }

    .delete-button:hover {
        background: rgba(220, 53, 69, 0.1);
    }
`;

export const emptyStateStyles = css`
    .empty-state {
        padding: 1rem;
        text-align: center;
        color: ${themeColors.uiFont};
    }
`;
