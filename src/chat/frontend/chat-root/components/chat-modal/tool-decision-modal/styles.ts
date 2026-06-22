import { css } from "lit";

export const toolDecisionStyles = css`
    .decision-content {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .decision-options {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .decision-other.hidden {
        display: none;
    }

    .custom-input-area {
        display: none;
    }

    .custom-input-area.visible {
        display: block;
    }
`;
