import { css } from "lit";
import { themeColors } from "../../styles/theme-colors";

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
        gap: 4px;
        flex-shrink: 0;
    }

    .usage-icon {
        color: ${themeColors.uiFont};
        flex-shrink: 1;
        min-width: 20px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
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
