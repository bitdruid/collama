import { css } from "lit";
import { themeColors } from "../../../styles/theme-colors";
import { themeFonts } from "../../../styles/theme-fonts";

export const baseModalStyles = css`
    :host {
        display: block;
    }

    .modal-content {
        position: relative;
        padding: 16px;
        margin-bottom: 8px;
        overflow: visible;
        border-radius: 8px;
        border: 2px solid ${themeColors.uiBorder};
        background: ${themeColors.uiBackground};
        opacity: 0;
        transition: opacity 0.2s ease-in-out;
    }

    .modal-content.fade-in {
        opacity: 1;
    }

    .modal-content.fade-out {
        opacity: 0;
    }

    .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        color: ${themeColors.uiFontDimm};
    }

    .modal-header h3 {
        margin: 0;
        color: ${themeColors.uiFontDimm};
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

    .modal-body {
        /* Placeholder for body styles */
    }
`;
