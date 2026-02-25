// src/chat/web/components/chat_input/components/input_buttons/styles.ts
import { css } from "lit";

export const inputButtonsStyles = css`
          button-submit,
        button-context,
        button-cancel,
        button-compress {
            display: inline-flex;
            align-items: center;
            justify-content: center;

            width: 28px;
            height: 28px;
            aspect-ratio: 1 / 1;

            padding: 0;
            border-radius: 50%;

            line-height: 1;

            color: #fff;
            border: none;
            cursor: pointer;
            box-sizing: border-box;
        }
        button-submit {
            background-color: #2277a8;
        }
        button-submit:hover {
            background-color: #185d86;
        }
        button-submit:disabled {
            background-color: #555;
            cursor: not-allowed;
            opacity: 0.5;
        }
        button-context {
            background-color: #2277a8;
        }
        button-context:hover {
            background-color: #185d86;
        }
        button-cancel {
            background-color: #a82222;
        }
        button-cancel:hover {
            background-color: #861818;
        }
        button-compress {
            background-color: #7a6030;
        }
        button-compress:hover {
            background-color: #5a4622;
        }
        
        button-row {
            display: flex;
            justify-content: flex-end;
            margin-top: 8px;
            gap: 8px;
        }
    `;
