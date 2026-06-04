import { css } from "lit";
import { themeColors, themeFonts, themeStyles } from "../../styles";

export const bannerStyles = css`
    :host {
        display: block;
    }

    .banner {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        background: ${themeColors.uiBackgroundDimm};
        color: ${themeColors.uiFont};
        cursor: pointer;
        user-select: none;
        line-height: 1;
        border: 1px solid ${themeColors.uiBorderDimm};
        ${themeStyles.borderRadius.medium}
        box-sizing: border-box;
        text-align: left;
        transition: background 0.15s;
    }

    .banner:hover {
        background: ${themeColors.uiBackgroundHoverDimm};
    }

    /* Height for box banner without icon */
    .banner:not(.bare) {
        min-height: 26px;
    }

    .banner.type-info {
        padding: 8px 10px;
        border-left: 5px solid ${themeColors.settings};
    }

    .banner.type-info .banner-description {
        margin-left: 0;
    }

    /* Bare variant: no box, monospace label, a colored chevron leading. */
    .banner.bare {
        background: none;
        border: none;
        padding: 4px 0;
        font-family: ${themeFonts.familyMono};
    }

    .banner.bare:hover {
        background: none;
    }

    .banner-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .banner.bare:hover .banner-pill {
        filter: brightness(1.2);
    }

    /* Chevron for expansion */
    .banner-arrow {
        display: inline-flex;
        transform-origin: center;
        transition: transform 0.2s ease;
    }

    .banner-arrow.expanded {
        transform: rotate(180deg);
    }

    .banner.bare .banner-arrow svg {
        stroke-width: 3;
    }

    /* Chevron coloring */
    .banner.type-tool .banner-pill,
    .banner.type-tool-group .banner-pill {
        color: ${themeColors.autoAccept};
    }

    .banner.type-think .banner-pill {
        color: ${themeColors.submit};
    }

    .banner.type-summary .banner-pill {
        color: ${themeColors.compress};
    }

    .banner.type-context .banner-pill {
        color: ${themeColors.context};
    }

    .banner.type-banner .banner-pill {
        color: ${themeColors.settings};
    }

    .banner-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        flex-shrink: 0;
    }

    .banner-label {
        flex: 1;
        min-width: 0;
        font-weight: ${themeFonts.weight.bold};
        text-box: trim-both cap alphabetic;
        overflow-wrap: anywhere;
    }

    .banner-description {
        font-family: ${themeFonts.family};
        font-weight: ${themeFonts.weight.normal};
        font-style: italic;
        opacity: 0.85;
        margin-left: 4px;
    }

    .banner-actions {
        display: contents;
    }

    .copy-btn {
        display: flex;
        align-items: center;
        gap: 4px;
        background: transparent;
        border: none;
        color: ${themeColors.uiFont};
        cursor: pointer;
        padding: 2px 6px;
        ${themeStyles.borderRadius.small}
        font-size: 0.85em;
        transition:
            background 0.15s,
            color 0.15s;
    }

    .copy-btn:hover {
        background: ${themeColors.uiBackgroundHoverDimm};
    }
`;
