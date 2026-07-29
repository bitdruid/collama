import { css } from "lit";
import { themeColors, themeFonts, themeStyles } from "../../../styles";

export const notepadStripStyles = css`
    :host {
        display: block;
    }

    collama-livebar {
        cursor: pointer;
    }

    .count,
    .facts {
        flex-shrink: 0;
        font-variant-numeric: tabular-nums;
    }

    .count {
        color: ${themeColors.gallery};
    }

    .facts {
        font-size: ${themeFonts.size.small};
        color: ${themeColors.uiFont};
    }

    .text.complete {
        font-style: italic;
    }

    .chevron {
        ${themeStyles.chevron}
        color: ${themeColors.uiFont};
    }

    .chevron.open {
        ${themeStyles.chevronOpen}
    }

    /* no track colour - it would double up with the bar's bottom border */
    .progress {
        height: 2px;
    }

    .progress-fill {
        height: 100%;
        background: ${themeColors.gallery};
        transition: width 0.25s ease;
    }

    .body {
        max-height: 40vh;
        overflow-y: auto;
        padding: 8px;
        border-top: ${themeStyles.border.normal};
        cursor: default;
        background: ${themeColors.uiBackgroundDimm};
    }
`;
