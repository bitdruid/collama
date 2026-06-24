import { css } from "lit";
import { themeColors } from "../../../styles";

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
`;
