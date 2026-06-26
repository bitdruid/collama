import { css } from "lit";
import { themeAnimations, themeColors, themeFonts, themeStyles } from "../../../styles";

export const controlButtonStyles = css`
    ${themeAnimations.loadingAnimations}

    :host {
        display: inline-flex;
        overflow: visible;
    }

    .control-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        aspect-ratio: 1 / 1;
        padding: 0;
        border-radius: ${themeStyles.borderRadius.round};
        line-height: 1;
        color: ${themeColors.cleanWhite};
        border: none;
        cursor: pointer;
        box-sizing: border-box;
        background: var(--btn-bg);
    }

    .control-button:hover:not(:disabled) {
        background: var(--btn-bg-hover);
    }

    .control-button:disabled {
        cursor: not-allowed;
        opacity: 0.45;
    }

    /* Counter variant — auto-width label display */
    .control-button.counter {
        width: auto;
        aspect-ratio: auto;
        padding: 0 10px;
        font-size: ${themeFonts.size.normal};
        font-weight: ${themeFonts.weight.bold};
        line-height: normal;
        cursor: default;
    }

    .control-button.counter:disabled {
        opacity: 1;
    }

    /* Pulse animation */
    :host([pulse]) .control-button {
        --loading-pulse-color: var(--btn-bg);
        box-shadow:
            0 0 0 1px ${themeColors.cleanWhite},
            0 0 0 2px var(--btn-bg);
        animation: loading-pulse 2s infinite;
    }

    /* Badge (context button) */
    .badge {
        position: absolute;
        top: -4px;
        right: -4px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        border-radius: ${themeStyles.borderRadius.round};
        background-color: ${themeColors.usageDanger};
        color: ${themeColors.cleanWhite};
        font-size: 10px;
        font-weight: ${themeFonts.weight.bold};
        line-height: 1;
        box-shadow: 0 1px 3px ${themeColors.uiShadow};
    }
`;
