import { css } from "lit";
import { themeAnimations, themeColors, themeFonts, themeStyles } from "../../../styles";

export const chatHeaderStyles = css`
    .header-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px;
        gap: 8px;
    }

    .header-left {
        display: flex;
        align-items: center;
        gap: 0;
        flex-shrink: 0;
    }

    .header-actions {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 1;
        min-width: 0;
    }

    .header-actions collama-context-usage-bar,
    .header-actions collama-create-chat-button {
        flex-shrink: 0;
    }

    .shell-indicator {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-left: 4px;
        padding: 2px 6px;
        border-radius: ${themeStyles.borderRadius.round};
        background: ${themeColors.usagePrimary}22;
        font-size: ${themeFonts.size.small};
        color: ${themeColors.usagePrimary};
        cursor: default;
        user-select: none;
        opacity: 0;
        transform: translateY(-4px);
        pointer-events: none;
        transition:
            opacity 0.25s ease,
            transform 0.25s ease;
    }

    .shell-indicator.visible {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
    }

    .shell-dot {
        width: 7px;
        height: 7px;
        border-radius: ${themeStyles.borderRadius.round};
        background: ${themeColors.usagePrimary};
        box-shadow: 0 0 4px ${themeColors.usagePrimary}88;
        ${themeAnimations.shellPulse}
    }

    .shell-count {
        font-variant-numeric: tabular-nums;
    }
`;
