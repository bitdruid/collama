import { css } from "lit";
import { themeColors, themeFonts, themeStyles } from "../../../../../styles";

export const contextUsageBarStyles = css`
    :host {
        display: block;
    }

    .context-usage {
        display: flex;
        align-items: center;
        min-width: 100px;
        max-width: 180px;
    }

    .context-bar-container {
        flex: 1;
        min-width: 90px;
        height: 10px;
        background: ${themeColors.uiBackground};
        border: ${themeStyles.border.normal};
        border-radius: ${themeStyles.borderRadius.medium};
        overflow: hidden;
        position: relative;
        display: flex;
    }

    .context-bar {
        height: 100%;
        background: ${themeColors.usagePrimary};
        border-radius: ${themeStyles.borderRadius.medium};
        transition: width 0.3s ease;
        min-width: 1px;
    }

    /* trimmed tokens: muted hatch so the bar doesn't visually reset on a trim */
    .context-seg.trimmed {
        height: 100%;
        transition: width 0.3s ease;
        opacity: 0.55;
        background-color: ${themeColors.usagePrimary};
        background-image: repeating-linear-gradient(
            135deg,
            transparent 0,
            transparent 2px,
            rgba(0, 0, 0, 0.35) 2px,
            rgba(0, 0, 0, 0.35) 4px
        );
    }

    /* flush edge between segments, only the outer container is rounded */
    .context-seg.trimmed + .context-bar {
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
    }

    /* transient label that flashes on a trim */
    .context-flash {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: ${themeFonts.size.small};
        line-height: 1;
        white-space: nowrap;
        padding: 1px 4px;
        border-radius: ${themeStyles.borderRadius.medium};
        color: ${themeColors.uiFont};
        background: ${themeColors.uiBackground};
        pointer-events: none;
        animation: context-flash-fade 4s ease forwards;
    }

    @keyframes context-flash-fade {
        0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.9);
        }
        10% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }
        80% {
            opacity: 1;
        }
        100% {
            opacity: 0;
        }
    }

    .context-bar.danger {
        background: ${themeColors.usageDanger};
    }

    .context-bar.warning {
        background: ${themeColors.usageWarning};
    }

    .context-text {
        font-size: ${themeFonts.size.normal};
        color: ${themeColors.uiFont};
        white-space: nowrap;
        margin-left: 8px;
    }
`;
