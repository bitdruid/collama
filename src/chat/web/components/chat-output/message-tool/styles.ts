import { css } from "lit";
import { themeColors } from "../../../styles/theme-colors";

export const toolStyles = css`
    ${themeColors}
    .role-tool {
        background-color: var(--color-tool);
    }

    .bubble-tool {
        padding: 0 8px;
        margin: 0;
    }

    .message.tool {
        padding: 0;
        margin: 0;
    }
`;
