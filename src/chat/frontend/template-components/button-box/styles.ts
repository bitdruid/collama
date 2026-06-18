import { css } from "lit";
import { themeColors, themeStyles } from "../../styles";

export const buttonBoxStyles = css`
    :host {
        display: inline-flex;
        width: 28px;
        aspect-ratio: 1;
        flex: 0 0 auto;
    }

    .button-box {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        aspect-ratio: 1;
        box-sizing: border-box;
        border-radius: ${themeStyles.borderRadius.small};
        border: 2px solid transparent;
        background: none;
        padding: 0;
        color: ${themeColors.uiFont};
        font: inherit;
        cursor: pointer;
        transition:
            color 0.15s ease,
            border-color 0.15s ease;
    }

    .button-box svg {
        stroke-width: 3;
    }

    .button-box:disabled {
        color: ${themeColors.disabled};
        cursor: not-allowed;
        opacity: 0.7;
    }

    .button-box.accept {
        color: ${themeColors.submit};
    }
    .button-box.accept:hover:not(:disabled) {
        color: ${themeColors.submitHover};
        border-color: ${themeColors.submitHover};
    }

    .button-box.cancel {
        color: ${themeColors.cancel};
    }
    .button-box.cancel:hover:not(:disabled) {
        color: ${themeColors.cancelHover};
        border-color: ${themeColors.cancelHover};
    }

    .button-box.accept-all {
        color: ${themeColors.context};
    }
    .button-box.accept-all:hover:not(:disabled) {
        color: ${themeColors.contextHover};
        border-color: ${themeColors.contextHover};
    }

    .button-box.warning {
        color: ${themeColors.usageDanger};
        cursor: default;
    }
`;
