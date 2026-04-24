import { css } from "lit";

import { themeColors } from "../../../styles/theme-colors";
import { themeFonts } from "../../../styles/theme-fonts";

export const sliderStyles = css`
    :host {
        display: flex;
        align-items: center;
        flex-direction: row;
        justify-content: space-between;
        gap: 8px;
        min-height: 20px;
        color: ${themeColors.uiFont};
        font-size: ${themeFonts.medium};
    }

    .slider-heading {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .slider-title {
        display: inline;
        line-height: 1.3;
    }

    ::slotted([slot="prefix"]) {
        display: inline-flex;
        align-items: center;
        color: ${themeColors.usageDanger};
    }

    .slider-controls {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .slider-value {
        flex: 0 0 auto;
        min-width: 60px;
        color: ${themeColors.placeholder};
        font-size: ${themeFonts.medium};
        text-align: right;
        text-transform: capitalize;
    }

    .slider {
        position: relative;
        display: inline-flex;
        align-items: center;
        width: var(--collama-slider-width, 82px);
        height: 12px;
        flex: 0 0 auto;
    }

    .slider-input {
        position: relative;
        z-index: 1;
        width: 100%;
        box-sizing: border-box;
        height: 12px;
        margin: 0;
        padding: 0;
        border: 1px solid ${themeColors.uiBorder};
        border-radius: 999px;
        background: linear-gradient(
            to right,
            ${themeColors.submit} 0%,
            ${themeColors.submit} var(--slider-progress, 0%),
            ${themeColors.uiBackground} var(--slider-progress, 0%),
            ${themeColors.uiBackground} 100%
        );
        cursor: pointer;
        appearance: none;
    }

    .slider-input::-webkit-slider-runnable-track {
        height: 10px;
        border-radius: 999px;
        background: transparent;
    }

    .slider-input::-webkit-slider-thumb {
        width: 12px;
        height: 12px;
        margin-top: -1px;
        border: 0;
        border-radius: 50%;
        background: ${themeColors.uiFont};
        appearance: none;
        transition:
            background 0.15s ease,
            box-shadow 0.15s ease;
    }

    .slider-input::-moz-range-track {
        height: 10px;
        border-radius: 999px;
        background: transparent;
    }

    .slider-input::-moz-range-thumb {
        width: 12px;
        height: 12px;
        border: 0;
        border-radius: 50%;
        background: ${themeColors.uiFont};
        transition:
            background 0.15s ease,
            box-shadow 0.15s ease;
    }

    .slider-input:focus-visible {
        outline: 1px solid ${themeColors.submit};
        outline-offset: 2px;
    }

    .slider-input:focus-visible::-webkit-slider-thumb,
    .slider-input:hover::-webkit-slider-thumb,
    .slider-input:focus-visible::-moz-range-thumb,
    .slider-input:hover::-moz-range-thumb {
        background: ${themeColors.submit};
        box-shadow: 0 0 0 2px ${themeColors.uiBackground};
    }

    .slider-marks {
        position: absolute;
        inset: 0 7px;
        pointer-events: none;
        z-index: 2;
    }

    .slider-mark {
        position: absolute;
        top: 50%;
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: ${themeColors.placeholder};
        opacity: 0.8;
        transform: translate(-50%, -50%);
    }
`;
