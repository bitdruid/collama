import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { themeColors } from "../../styles";

/**
 * From: https://github.com/vineethtrv/css-loader
 */
@customElement("collama-loading-dots")
export class dots extends LitElement {
    static styles = css`
        .dots {
            width: 10px;
            height: 10px;
            margin: 0 20px;
            border-radius: 50%;
            background-color: ${themeColors.uiBorder};
            box-shadow:
                -20px 0 ${themeColors.uiFont},
                20px 0 ${themeColors.uiBorder};
            position: relative;
            animation: flash 0.8s linear infinite alternate;
        }

        @keyframes flash {
            0% {
                background-color: ${themeColors.uiBorder};
                box-shadow:
                    -20px 0 ${themeColors.uiFont},
                    20px 0 ${themeColors.uiBorder};
            }
            50% {
                background-color: ${themeColors.uiFont};
                box-shadow:
                    -20px 0 ${themeColors.uiBorder},
                    20px 0 ${themeColors.uiBorder};
            }
            100% {
                background-color: ${themeColors.uiBorder};
                box-shadow:
                    -20px 0 ${themeColors.uiBorder},
                    20px 0 ${themeColors.uiFont};
            }
        }
    `;

    @property({ type: Boolean, reflect: true }) visible: boolean = false;

    render() {
        return html`<div class="dots"></div>`;
    }
}
