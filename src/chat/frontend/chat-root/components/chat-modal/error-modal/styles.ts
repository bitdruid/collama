import { css } from "lit";
import { themeColors, themeStyles } from "../../../../styles";

export const errorModalStyles = css`
    .error-content {
        max-height: 300px;
        overflow: auto;
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 12px;
        padding: 8px;
        margin: 8px 0;
        ${themeStyles.border.dimm}
        ${themeStyles.borderRadius.small}
        background: ${themeColors.uiBackgroundDimm};
        color: ${themeColors.uiFont};
    }

    .error-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        margin-top: 8px;
    }

    .error-actions button {
        padding: 6px 16px;
        border: none;
        ${themeStyles.borderRadius.small}
        cursor: pointer;
        font-size: 13px;
        color: ${themeColors.cleanWhite};
    }

    .btn-copy {
        background: ${themeColors.submit};
        min-width: 70px;
    }

    .btn-copy:hover {
        background: ${themeColors.submitHover};
    }

    .btn-close {
        background: ${themeColors.cancel};
    }
`;
