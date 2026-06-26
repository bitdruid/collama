import { css } from "lit";
import { themeStyles } from "../../../../../styles";
import { panelStyles } from "../../styles-shared";

export const controlPanelStyles = css`
    ${panelStyles}
    :host {
        display: block;
        overflow: visible;
    }

    textarea {
        ${themeStyles.textarea}
        margin-bottom: 4px;
    }

    textarea:focus {
        ${themeStyles.focus}
    }

    textarea::placeholder {
        ${themeStyles.placeholder}
    }

    textarea:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`;

export const controlPanelButtonStyles = css`
    :host {
        display: block;
        overflow: visible;
    }

    button-row {
        display: flex;
        gap: 8px;
        position: relative;
    }

    .spacer {
        flex: 1;
    }
`;
