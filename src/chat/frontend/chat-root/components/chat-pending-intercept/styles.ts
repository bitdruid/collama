import { css } from "lit";
import { themeColors, themeFonts } from "../../../styles";

export const pendingInterceptStyles = css`
    :host {
        display: block;
    }

    .context {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        flex-shrink: 0;
        font-size: ${themeFonts.size.small};
        color: ${themeColors.uiFont};
    }
`;
