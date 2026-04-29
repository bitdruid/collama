import { css } from "lit";
import { themeColors } from "../../../../styles/theme-colors";

export const sessionButtonStyles = css`
    .session-button {
        display: flex;
        align-items: center;
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
        flex-shrink: 1;
        min-width: 20px;
        color: ${themeColors.uiFont};
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .session-icon svg {
        width: 18px;
        height: 18px;
    }
`;
