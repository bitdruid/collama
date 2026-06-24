import { css } from "lit";
import { themeColors, themeFonts, themeStyles } from "../../../../styles";

export const sessionItemStyles = css`
    :host {
        display: block;
    }

    .session-item {
        display: flex;
        align-items: center;
        padding: 8px 12px;
        cursor: pointer;
        box-shadow: inset 5px 0 0 0 transparent;
        transition: background 0.1s ease;
    }

    .session-item + .session-item {
        border-top: ${themeStyles.border.normal};
    }

    .session-item:hover {
        background: ${themeColors.uiBackgroundHover};
        outline: 1px solid ${themeColors.uiBorderHover};
        outline-offset: -1px;
    }

    .session-item.active {
        color: ${themeColors.uiFont};
        box-shadow: inset 5px 0 0 0 ${themeColors.submit};
    }

    .session-info {
        flex: 1;
        min-width: 0;
        overflow: hidden;
    }

    .session-title {
        font-size: ${themeFonts.size.normal};
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: ${themeColors.uiFont};
    }

    .session-title-input {
        font-size: ${themeFonts.size.normal};
        width: 100%;
        padding: 2px 4px;
        border: none;
        border-radius: ${themeStyles.borderRadius.small};
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
        font-size: ${themeFonts.size.small};
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
        border-radius: ${themeStyles.borderRadius.small};
        cursor: pointer;
        font-size: ${themeFonts.size.normal};
        background: transparent;
        color: ${themeColors.uiFont};
    }

    .action-button:hover {
        background: ${themeColors.uiBackgroundHoverDimm};
    }

    .copy-button,
    .rename-button {
        color: ${themeColors.uiFont};
    }

    .delete-button {
        color: ${themeColors.cancel};
    }
`;

export const sessionDropdownStyles = css`
    .dropdown-content {
        display: flex;
        flex-direction: column;
        padding: 0;
    }
`;
