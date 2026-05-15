import { css } from "lit";
import { themeColors, themeStyles } from "../../styles";

export const bannerStyles = css`
    :host {
        display: block;
    }

    .banner {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        background: ${themeColors.uiBackgroundDimm};
        color: ${themeColors.uiFont};
        cursor: pointer;
        user-select: none;
        font-size: 0.9em;
        border: 1px solid ${themeColors.uiBorderDimm};
        ${themeStyles.borderRadius.medium}
        border-left: 3px solid;
        width: 100%;
        box-sizing: border-box;
        text-align: left;
        transition: background 0.15s;
    }

    .banner:hover {
        background: ${themeColors.uiBackgroundHoverDimm};
    }

    .banner.type-tool {
        border-left-color: ${themeColors.autoAccept};
    }

    .banner.type-think {
        border-left-color: ${themeColors.submit};
    }

    .banner.type-summary {
        border-left-color: ${themeColors.compress};
    }

    .banner.type-banner {
        border-left-color: ${themeColors.settings};
    }

    .banner.type-code {
        border-left: none;
    }

    .banner.type-context {
        border-left-color: ${themeColors.context};
    }

    .banner.type-tool-group {
        border-left-color: ${themeColors.autoAccept};
    }

    .banner.type-info {
        border-left-color: ${themeColors.settings};
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
        overflow: hidden;
        font-weight: 600;
    }

    .banner-description {
        font-weight: 400;
        font-style: italic;
        opacity: 0.85;
        margin-left: 4px;
    }

    .banner-slot1 {
        display: contents;
    }

    .banner-slot2 {
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
        color: ${themeColors.uiFont};
    }
`;
