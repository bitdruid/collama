import { css } from "lit";
import { themeColors } from "../../../../styles/theme-colors";
import { themeFonts } from "../../../../styles/theme-fonts";
import { themeStyles } from "../../../../styles/theme-styles";

export const chatSearchStyles = css`
    .search-body {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .search-input {
        ${themeStyles.input}
    }

    .search-input:focus {
        ${themeStyles.focus}
    }

    .search-info {
        font-size: ${themeFonts.medium};
        color: ${themeColors.uiFont};
        white-space: nowrap;
        min-width: 50px;
        text-align: center;
    }

    .search-nav {
        display: flex;
        gap: 4px;
    }

    .search-nav button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        padding: 0;
        border-radius: 4px;
        border: 1px solid ${themeColors.uiBorder};
        background: ${themeColors.uiBackgroundDimm};
        color: ${themeColors.uiFont};
        cursor: pointer;
    }

    .search-nav button:hover {
        background: ${themeColors.uiBackgroundHoverDimm};
    }

    .search-nav button:disabled {
        opacity: 0.4;
        cursor: default;
    }
`;
