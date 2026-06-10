import { css } from "lit";
import { themeColors, themeFonts, themeStyles } from "../../../styles";

export const pendingInterceptStyles = css`
    :host {
        display: block;
    }

    /* Muted bar above the composer. */
    .banner {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 8px 6px;
        padding: 5px 8px;
        /* Tight line-height so align-items centers the glyphs against the icons, not the leading. */
        /* line-height: ${themeFonts.lineHeight.small}; */
        border: ${themeStyles.border.normal};
        border-radius: ${themeStyles.borderRadius.medium};
        background: ${themeColors.uiBackground};
        animation: intercept-pulse 2s ease-in-out infinite;
        /* Host is pointer-events:none (lets scroll pass over the gaps); re-enable on the bar. */
        pointer-events: auto;
    }

    @keyframes intercept-pulse {
        0%,
        100% {
            border-color: ${themeColors.submit};
        }
        50% {
            border-color: transparent;
        }
    }

    .banner-icon {
        display: inline-flex;
        flex-shrink: 0;
        color: ${themeColors.submit};
    }

    .banner-label {
        flex-shrink: 0;
        font-size: ${themeFonts.size.small};
        font-weight: ${themeFonts.weight.bold};
        text-transform: uppercase;
        letter-spacing: 0.03em;
        color: ${themeColors.submit};
    }

    .banner-text {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: ${themeFonts.size.normal};
        color: ${themeColors.uiFont};
    }

    .banner-context {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        flex-shrink: 0;
        font-size: ${themeFonts.size.small};
        color: ${themeColors.uiFont};
    }

    .banner-cancel {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        padding: 2px;
        background: transparent;
        border: none;
        color: ${themeColors.uiFont};
        cursor: pointer;
        opacity: 0.6;
    }
    .banner-cancel:hover {
        opacity: 1;
    }
`;
