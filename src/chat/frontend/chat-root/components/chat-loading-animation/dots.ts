import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { themeColors } from "../../../styles";

const VARIANTS = ["flash", "bblFadInOut", "wave"] as const;
type Variant = (typeof VARIANTS)[number];

/**
 * From: https://github.com/vineethtrv/css-loader
 */
@customElement("collama-loading-dots")
export class dots extends LitElement {
    static styles = css`
        /* Style1: flash static dots from left to right and back */

        .dots-flash {
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

        /* Style2: bubble dots up from left to right */

        .dots-bbl,
        .dots-bbl:before,
        .dots-bbl:after {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background-color: ${themeColors.uiFont};
            animation-fill-mode: both;
            animation: bblFadInOut 1.8s infinite ease-in-out;
        }

        .dots-bbl {
            margin: 0 20px;
            position: relative;
            transform: translateZ(0);
            animation-delay: -0.16s;
        }

        .dots-bbl:before,
        .dots-bbl:after {
            content: "";
            position: absolute;
            top: 0;
        }

        .dots-bbl:before {
            left: -20px;
            animation-delay: -0.32s;
        }

        .dots-bbl:after {
            left: 20px;
        }

        @keyframes bblFadInOut {
            0%,
            80%,
            100% {
                background-color: transparent;
            }
            40% {
                background-color: ${themeColors.uiFont};
            }
        }

        /* Style3: hop dots left to right and back */

        .dots-wave {
            width: 10px;
            height: 10px;
            margin: 0 20px;
            border-radius: 50%;
            position: relative;
            top: 20px;
            box-shadow:
                -20px -20px ${themeColors.uiBorder},
                0 -20px ${themeColors.uiBorder},
                20px -20px ${themeColors.uiBorder};
            animation: wave 1.3s ease-in-out infinite /* alternate */;
        }

        /* 2% & 98% symmentric pause for left/right dot; -25px height of jump */
        @keyframes wave {
            0%,
            2%,
            98%,
            100% {
                box-shadow:
                    -20px -20px ${themeColors.uiBorder},
                    0 -20px ${themeColors.uiBorder},
                    20px -20px ${themeColors.uiBorder};
            }
            30% {
                box-shadow:
                    -20px -25px ${themeColors.uiFont},
                    0 -20px ${themeColors.uiBorder},
                    20px -20px ${themeColors.uiBorder};
            }
            50% {
                box-shadow:
                    -20px -20px ${themeColors.uiBorder},
                    0 -25px ${themeColors.uiFont},
                    20px -20px ${themeColors.uiBorder};
            }
            70% {
                box-shadow:
                    -20px -20px ${themeColors.uiBorder},
                    0 -20px ${themeColors.uiBorder},
                    20px -25px ${themeColors.uiFont};
            }
        }
    `;

    @property({ type: Boolean, reflect: true }) visible: boolean = false;

    private _variant: Variant = VARIANTS[Math.floor(Math.random() * VARIANTS.length)];

    render() {
        const className =
            this._variant === "flash" ? "dots-flash" : this._variant === "wave" ? "dots-wave" : "dots-bbl";
        return html`<div class=${className}></div>`;
    }
}
