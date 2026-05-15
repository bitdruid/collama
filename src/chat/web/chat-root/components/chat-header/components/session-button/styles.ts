import { css } from "lit";
import { themeColors } from "../../../../../styles";

export const sessionButtonStyles = css`
    .session-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 28px;
        height: 28px;
        padding: 0;
        border: none;
        background: transparent;
        cursor: pointer;
        overflow: hidden;
        width: fit-content;
        flex-shrink: 0;
        font: inherit;
    }

    .session-button:hover:not(:disabled) {
        opacity: 0.8;
    }

    .session-button:disabled {
        cursor: not-allowed;
        opacity: 0.45;
    }

    .session-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 1;
        min-width: 18px;
        color: ${themeColors.uiFont};
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
`;
