import { css } from "lit";
import { themeColors, themeFonts, themeStyles } from "../../styles";

export const textboxStyles = css`
    :host {
        display: block;
    }

    .textbox {
        display: block;
        width: 100%;
        box-sizing: border-box;
        text-align: left;
        padding: 8px 12px;
        cursor: pointer;
        border: ${themeStyles.border.normal};
        background: ${themeColors.uiBackground};
        color: ${themeColors.uiFont};
        font-family: inherit;
        font-size: ${themeFonts.size.normal};
        line-height: ${themeFonts.lineHeight.normal};
        border-radius: ${themeStyles.borderRadius.medium};
    }

    .textbox:hover {
        background: ${themeColors.uiBackgroundHover};
        border-color: ${themeColors.uiBorderHover};
    }

    .textbox:focus {
        ${themeStyles.focus}
    }

    .textbox.selected {
        border-color: ${themeColors.focus};
        box-shadow: inset 0 0 0 1px ${themeColors.focus};
    }

    .textbox:disabled {
        cursor: not-allowed;
        opacity: 0.7;
    }

    /* Input mode: same box dimensions as .textbox; border is revealed on focus. */
    .textbox-input {
        ${themeStyles.textarea}
    }

    .textbox-input:focus {
        border-color: ${themeColors.uiBorder};
        ${themeStyles.focus}
    }
`;
