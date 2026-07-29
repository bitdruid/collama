import { css } from "lit";
import { themeColors, themeFonts, themeStyles } from "../../styles";

export const liveBarStyles = css`
    :host {
        display: block;
    }

    .bar {
        border: ${themeStyles.border.normal};
        border-radius: ${themeStyles.borderRadius.medium};
        background: ${themeColors.uiBackground};
        margin: 0 8px 6px;
        overflow: hidden;
        /* the overlay is pointer-events:none so scrolling passes through the gaps */
        pointer-events: auto;
    }

    /* something queued or waiting - breathes so it reads as pending, not decoration */
    .bar.pulse {
        animation: live-bar-pulse 2s ease-in-out infinite;
    }

    @keyframes live-bar-pulse {
        0%,
        100% {
            border-color: var(--bar-accent, ${themeColors.uiBorder});
        }
        50% {
            border-color: transparent;
        }
    }

    .head {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 5px 8px;
    }

    ::slotted(.label) {
        flex-shrink: 0;
        font-size: ${themeFonts.size.small};
        font-weight: ${themeFonts.weight.bold};
        text-transform: uppercase;
        letter-spacing: 0.03em;
        color: var(--bar-accent, ${themeColors.uiFont});
    }

    ::slotted(.text) {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: ${themeColors.uiFont};
    }

    ::slotted(.icon) {
        display: inline-flex;
        flex-shrink: 0;
        color: var(--bar-accent, ${themeColors.uiFont});
    }

    ::slotted(.btn) {
        display: inline-flex;
        flex-shrink: 0;
        padding: 2px;
        border: none;
        background: transparent;
        color: ${themeColors.uiFont};
        cursor: pointer;
        opacity: 0.6;
    }

    ::slotted(.btn:hover) {
        opacity: 1;
    }
`;
