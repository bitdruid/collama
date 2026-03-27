import { css } from "lit";
import { themeColors } from "../../../../styles/theme-colors";
import { themeFonts } from "../../../../styles/theme-fonts";
import { themeStyles } from "../../../../styles/theme-styles";

export const contextTreeStyles = css`
    :host {
        display: block;
        position: absolute;
        bottom: 100%;
        right: 0;
        margin-bottom: 48px;
        z-index: 200;
    }

    .tree-popup {
        width: 320px;
        max-height: 350px;
        display: flex;
        flex-direction: column;
        background: ${themeColors.uiBackgroundDimm};
        border: 2px solid ${themeColors.uiBorder};
        border-radius: 8px;
        box-shadow: 0 4px 16px ${themeColors.shadow};
        overflow: hidden;
    }

    .search-bar {
        padding: 8px;
        border-bottom: 1px solid ${themeColors.uiBorder};
    }

    .search-bar input {
        width: 100%;
        padding: 6px 8px;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: ${themeColors.uiFont};
        font-size: ${themeFonts.medium};
        box-sizing: border-box;
    }

    .search-bar input:focus {
        ${themeStyles.focus}
    }

    .search-bar input::placeholder {
        color: ${themeColors.uiBorderHover};
    }

    .results {
        flex: 1;
        overflow-y: auto;
        padding: 4px 0;
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
        background: ${themeColors.uiBackgroundHover};
    }

    .result-info {
        display: flex;
        flex-direction: column;
        min-width: 0;
        flex: 1;
    }

    .result-name {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .result-path {
        font-size: ${themeFonts.small};
        color: ${themeColors.uiFontDimm};
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
        color: ${themeColors.textWhite};
        font-size: ${themeFonts.user};
        font-weight: bold;
        cursor: pointer;
        line-height: 1;
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
        color: ${themeColors.uiFontDimm};
        font-size: ${themeFonts.medium};
    }
`;
