import { css } from "lit";
import { themeColors } from "../../../styles/theme-colors";

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

    .loading {
        font-style: italic;
        opacity: 0.7;
        padding-bottom: 12px;
        display: block;
    }

    .loading .dots::after {
        content: "";
        animation: blink 1s steps(3, end) infinite;
    }

    @keyframes blink {
        0%,
        20% {
            content: "";
        }
        40% {
            content: ".";
        }
        60% {
            content: "..";
        }
        80%,
        100% {
            content: "...";
        }
    }
`;
