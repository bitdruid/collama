import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { themeColors, themeFonts, themeIcons, themeStyles } from "../../../styles";

export interface PlanStep {
    text: string;
    done: boolean;
}

const notepadStyles = css`
    :host {
        display: block;
        font-family: ${themeFonts.family};
        font-size: ${themeFonts.size.normal};
        line-height: ${themeFonts.lineHeight.normal};
    }

    .row {
        display: flex;
        align-items: baseline;
        gap: 6px;
        padding: 1px 0;
        color: ${themeColors.uiFontHighlight};
    }

    .mark {
        ${themeStyles.markIcon}
        color: ${themeColors.uiFont};
    }

    .row.done {
        color: ${themeColors.uiFont};
        text-decoration: line-through;
        text-decoration-color: ${themeColors.uiBorder};
    }

    .row.current {
        color: ${themeColors.uiFontHighlight};
    }

    .row.current .mark {
        color: ${themeColors.gallery};
    }

    .text {
        min-width: 0;
        word-break: break-word;
    }
`;

/**
 * The agent's step plan with its progress. Display only — the pad is owned by the backend,
 * so nothing here is clickable and no state is held.
 *
 * @element collama-notepad
 */
@customElement("collama-notepad")
export class Notepad extends LitElement {
    static styles = notepadStyles;

    @property({ type: Array }) plan: PlanStep[] = [];

    private _renderStep(step: PlanStep, index: number, current: number) {
        const state = step.done ? "done" : index === current ? "current" : "open";
        const mark = step.done
            ? themeIcons.squareCheck
            : state === "current"
              ? themeIcons.circleDot
              : themeIcons.square;
        return html`
            <div class="row ${state}">
                <span class="mark">${mark.medium}</span>
                <span class="text">${step.text}</span>
            </div>
        `;
    }

    render() {
        // the first open step is the one in progress - mirrors the text rendering backend-side
        const current = this.plan.findIndex((s) => !s.done);
        return html`${this.plan.map((step, i) => this._renderStep(step, i, current))}`;
    }
}
