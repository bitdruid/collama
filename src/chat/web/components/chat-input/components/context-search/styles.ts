import { css } from "lit";
import { themeColors } from "../../../../styles/theme-colors";
import { themeFonts } from "../../../../styles/theme-fonts";
import { themeStyles } from "../../../../styles/theme-styles";

export const contextTreeStyles = css`
    .popup-content {
        width: 320px;
        max-height: 350px;
        display: flex;
        flex-direction: column;
    }

    .search-bar {
        padding: 8px;
        border-bottom: 1px solid ${themeColors.uiBorderDimm};
        position: relative;
        display: flex;
        align-items: center;
    }

    .search-bar input {
        flex: 1;
        padding: 6px 8px;
        border: none;
        border-radius: 6px;
        background: ${themeColors.uiBackground};
        color: ${themeColors.uiFont};
        font-size: ${themeFonts.medium};
        box-sizing: border-box;
    }

    .search-bar input:focus {
        ${themeStyles.focus}
    }

    .search-bar input::placeholder {
        color: ${themeColors.placeholder};
    }

    .clear-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        margin-left: 4px;
        flex-shrink: 0;
        border-radius: 50%;
        border: none;
        background: transparent;
        color: ${themeColors.uiFont};
        font-size: ${themeFonts.small};
        cursor: pointer;
        line-height: 1;
        padding: 0;
    }

    .clear-btn svg,
    .folder-icon svg,
    .add-btn svg {
        width: 14px;
        height: 14px;
    }

    .clear-btn:hover {
        background: ${themeColors.uiBackgroundHoverDimm};
        color: ${themeColors.uiFont};
    }

    .results {
        flex: 1;
        overflow-y: auto;
        padding: 4px 0;
    }

    .added-context-header {
        padding: 8px 12px;
        font-size: ${themeFonts.small};
        font-weight: 600;
        color: ${themeColors.uiFont};
        border-bottom: 1px solid ${themeColors.uiBorderDimm};
        margin-bottom: 4px;
    }

    .result-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 4px 8px;
        cursor: pointer;
        font-size: ${themeFonts.medium};
        color: ${themeColors.uiFont};
    }

    .result-item:hover {
        background: ${themeColors.uiBackgroundHoverDimm};
    }

    .result-info {
        display: flex;
        flex-direction: column;
        min-width: 0;
        flex: 1;
    }

    .result-name {
        display: inline-flex;
        align-items: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .result-path {
        font-size: ${themeFonts.small};
        color: ${themeColors.uiFont};
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .folder-icon {
        color: ${themeColors.compress};
        margin-right: 4px;
    }

    .add-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        margin-left: 6px;
        flex-shrink: 0;
        border-radius: 50%;
        border: none;
        background: ${themeColors.context};
        color: ${themeColors.cleanWhite};
        cursor: pointer;
        line-height: 1;
        padding: 0;
    }

    .add-btn:hover {
        background: ${themeColors.contextHover};
    }

    .add-btn.added {
        background: ${themeColors.disabled};
        cursor: default;
    }

    .empty-state {
        padding: 16px;
        text-align: center;
        color: ${themeColors.uiFont};
        font-size: ${themeFonts.medium};
    }
`;
