import { css } from "lit";
import { themeColors } from "../../styles/theme-colors";
import { themeFonts } from "../../styles/theme-fonts";

export const chatInputStyles = css`
    :host {
        display: block;
        overflow: visible;
        border-radius: 8px;
        border: 2px solid ${themeColors.uiBorder};
        background: ${themeColors.uiBackground};
}

    .panel {
        display: none;
    }
    .panel.active {
        display: block;
    }
`;

/** Shared styles for panel content (prompt-gallery, tool-confirm, etc.) */
export const panelStyles = css`
    :host {
        display: block;
    }

    .panel-content {
        padding: 8px;
        overflow: visible;
    }

    .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        color: ${themeColors.uiFontDimm};
    }

    .panel-header h3 {
        margin: 0;
    }

    .close-btn {
        cursor: pointer;
        font-size: ${themeFonts.giant};
        line-height: 1;
        color: ${themeColors.uiFontDimm};
    }

    .close-btn:hover {
        color: ${themeColors.uiFont};
    }
`;
