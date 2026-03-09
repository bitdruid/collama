import { css } from "lit";

export const gallery_buttons_styles = css`
        .button-container {
            display: flex;
            gap: 8px;
            margin-top: 6px;
        }
        button {
        
            flex: 1;
            padding: 4px 8px;
            cursor: pointer;
            border: none;
            background: #2277a8;
            color: var(--vscode-button-foreground);
            border-radius: 4px;
        }
        button:hover {
            background: #185d86;
        }
        .delete-btn {
            flex: none;
            background: red;
            color: var(--vscode-button-foreground);
        }
        .delete-btn:hover {
            background: rgba(255, 80, 80, 0.25);
            box-shadow: 0 0 6px rgba(255, 80, 80, 0.6);
        }
    `;
