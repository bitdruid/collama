import { css } from "lit";

export const buttonRowStyles = css`
    :host {
        display: block;
    }

    .button-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        justify-content: flex-end;
    }
`;
