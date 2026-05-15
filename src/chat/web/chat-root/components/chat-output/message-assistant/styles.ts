import { css } from "lit";
import { themeColors } from "../../../../styles";

export const assistantStyles = css`
    .role-assistant {
        background-color: ${themeColors.assistant};
    }

    .role-system {
        background-color: ${themeColors.system};
    }

    .bubble-assistant {
        padding: 0 8px;
        margin: 0;
    }

    .message.assistant {
        padding: 0;
        margin: 0;
    }
`;
