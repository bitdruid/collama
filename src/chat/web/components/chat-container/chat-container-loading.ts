import { css, html, LitElement, svg } from "lit";
import { property } from "lit/decorators.js";
import { themeColors } from "../../styles/theme-colors";

export class ChatContainerLoading extends LitElement {
    static styles = css`
        ${themeColors}
        :host {
            position: fixed;
            inset: 0;
            z-index: 999;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s;
        }

        :host([active]) {
            opacity: 1;
        }

        svg {
            width: 100%;
            height: 100%;
        }

        rect {
            width: calc(100% - 4px);
            height: calc(100% - 4px);
            fill: none;
            stroke: var(--color-submit);
            stroke-width: 4;
            animation: snake-dash var(--snake-duration, 2s) linear infinite;
        }

        @keyframes snake-dash {
            0% {
                stroke-dashoffset: 0;
            }
            100% {
                stroke-dashoffset: var(--snake-perimeter, -800);
            }
        }
    `;

    @property({ type: Boolean, reflect: true }) active = false;

    private _resizeObserver: ResizeObserver | null = null;

    private _updatePerimeter() {
        const rect = this.shadowRoot?.querySelector("rect") as SVGRectElement | null;
        if (!rect) {
            return;
        }
        const w = this.offsetWidth;
        const h = this.offsetHeight;
        const perimeter = 2 * (w + h);
        const segment = perimeter * 0.15;
        rect.style.strokeDasharray = `${segment} ${perimeter - segment}`;
        this.style.setProperty("--snake-perimeter", `${-perimeter}`);
        this.style.setProperty("--snake-duration", `${perimeter / 2000}s`);
    }

    connectedCallback() {
        super.connectedCallback();
        this._resizeObserver = new ResizeObserver(() => {
            if (this.active) {
                this._updatePerimeter();
            }
        });
        this._resizeObserver.observe(this);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._resizeObserver?.disconnect();
        this._resizeObserver = null;
    }

    updated(changed: Map<string, unknown>) {
        if (changed.has("active") && this.active) {
            this._updatePerimeter();
        }
    }

    render() {
        return html`<svg>${svg`<rect x="2" y="2" rx="4" ry="4" />`}</svg>`;
    }
}

customElements.define("collama-loading-snake", ChatContainerLoading);
