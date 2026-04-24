import { html, LitElement } from "lit";
import { customElement, property, query } from "lit/decorators.js";

import { sliderStyles } from "./styles";

@customElement("collama-slider")
export class Slider extends LitElement {
    static override styles = [sliderStyles];

    @property({ type: Number }) min = 0;
    @property({ type: Number }) max = 100;
    @property({ type: Number }) step = 1;
    @property({ type: Number }) value = 0;
    @property({ type: Number }) marks = 0;
    @property({ type: String }) label = "";
    @property({ type: String, attribute: "value-label" }) valueLabel = "";

    @query("input")
    private input?: HTMLInputElement;

    get inputElement() {
        return this.input;
    }

    override focus(options?: FocusOptions) {
        this.input?.focus(options);
    }

    protected override render() {
        const markerIndexes = Array.from({ length: Math.max(this.marks, 0) }, (_, index) => index);
        const progress = this.getProgress(this.value);

        return html`
            <div class="slider-heading">
                <slot name="prefix"></slot>
                <span class="slider-title">${this.label}</span>
            </div>
            <div class="slider-controls">
                <span class="slider-value">${this.valueLabel}</span>
                <span class="slider">
                    <span class="slider-marks">
                        ${markerIndexes.map(
                            (index) =>
                                html`<span
                                    class="slider-mark"
                                    style="left: ${(index / Math.max(this.marks - 1, 1)) * 100}%"
                                ></span>`,
                        )}
                    </span>
                    <input
                        class="slider-input"
                        type="range"
                        min=${String(this.min)}
                        max=${String(this.max)}
                        step=${String(this.step)}
                        .value=${String(this.value)}
                        style="--slider-progress: ${progress}%"
                        @input=${this.handleInput}
                    />
                </span>
            </div>
        `;
    }

    private handleInput = (event: Event) => {
        const input = event.currentTarget as HTMLInputElement;
        const value = Number(input.value);

        this.value = value;
        input.style.setProperty("--slider-progress", `${this.getProgress(value)}%`);
    };

    private getProgress(value: number) {
        const range = this.max - this.min;

        if (range === 0) {
            return 0;
        }

        return Math.min(Math.max(((value - this.min) / range) * 100, 0), 100);
    }
}
