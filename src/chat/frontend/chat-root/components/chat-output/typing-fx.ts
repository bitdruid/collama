import { css } from "lit";

import { themeColors } from "../../../styles";

/**
 * "Blast-in" particle effect for streaming assistant text: spawns an animated
 * glyph at each new character that floats up, grows, and fades.
 *
 * Inspired by RediculousCoding (https://github.com/merenut/RediculousCoding).
 */

const FX = {
    /** Font size of a popped glyph (px). */
    fontSizePx: 13,
    /** Scale at spawn and at peak of rise. */
    startScale: 1.0,
    endScale: 1.5,
    /** Vertical rise distance before fade (px). */
    risePx: 15,
    /** Random horizontal wander amplitude (px). */
    driftPx: 15,
    /** Glyph lifetime (ms). */
    durationMs: 600,
    /** Show every Nth printable character (1 = all). */
    charStep: 1,
} as const;

// Fenced/summary/context blocks render into this element. Its slotted text stays
// in the light DOM (so a TreeWalker reaches it) but measures inside the block, so
// we reject those nodes — glyphs would otherwise land in the block.
const ACCORDION_SELECTOR = "collama-accordion";

export class TypingFx {
    private lastLen = 0;
    /** Rendered printable glyphs seen so far; drives spawn detection (not source length). */
    private lastSlotCount = 0;

    constructor(
        private readonly getLayer: () => HTMLElement | null,
        private readonly getCaretHost: () => HTMLElement | null,
    ) {}

    /**
     * Call on every streaming render. Diffs the rendered text against the last
     * glyph count and pops each newly-arrived glyph at its own on-screen box.
     * When disabled or inside an open fence, only advances counters so finishing
     * a stream never replays old text.
     */
    update(enabled: boolean, content: string) {
        const len = content.length;
        if (len <= this.lastLen) {
            this.lastLen = len;
            if (len === 0) {
                this.lastSlotCount = 0;
            }
            return;
        }
        this.lastLen = len;

        const host = this.getCaretHost();
        if (!host) {
            return;
        }

        // Flatten rendered printable chars in reading order, skipping accordion text.
        const slots: Array<{ node: Text; offset: number }> = [];
        const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, {
            acceptNode: (n) =>
                (n as Text).parentElement?.closest(ACCORDION_SELECTOR)
                    ? NodeFilter.FILTER_REJECT
                    : NodeFilter.FILTER_ACCEPT,
        });
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const text = (node as Text).textContent ?? "";
            for (let i = 0; i < text.length; i++) {
                if (!/\s/.test(text[i])) {
                    slots.push({ node: node as Text, offset: i });
                }
            }
        }

        // Snapshot the baseline before the suppression checks, so a disabled or
        // mid-fence render still advances it and never replays the backlog later.
        const prevCount = this.lastSlotCount;
        this.lastSlotCount = slots.length;

        if (!enabled || this._insideOpenFence(content)) {
            return;
        }

        // Glyph count shrank (a partial fence just reflowed into an accordion).
        if (slots.length <= prevCount) {
            return;
        }

        // Pass 1: measure (reads only). Pass 2: spawn (writes only).
        const measured: Array<{ ch: string; x: number; y: number }> = [];
        for (let i = prevCount; i < slots.length; i += FX.charStep) {
            const { node, offset } = slots[i];
            const range = document.createRange();
            range.setStart(node, offset);
            range.setEnd(node, offset + 1);
            const rect = range.getBoundingClientRect();
            if (rect.width || rect.height) {
                measured.push({
                    ch: node.textContent![offset],
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                });
            }
        }
        for (const m of measured) {
            this._pop(m.ch, m.x, m.y);
        }
    }

    /** True when content is inside an unclosed ``` fence. */
    private _insideOpenFence(s: string): boolean {
        const fences = s.match(/^[ \t]*```/gm);
        return !!fences && fences.length % 2 === 1;
    }

    private _pop(ch: string, x: number, y: number) {
        const layer = this.getLayer();
        if (!layer) {
            return;
        }
        const el = document.createElement("div");
        el.className = "fx-char";
        el.textContent = ch;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.fontSize = `${FX.fontSizePx}px`;
        layer.appendChild(el);

        const drift = (Math.random() - 0.5) * FX.driftPx;
        const anim = el.animate(
            [
                { transform: `translate(-50%, -50%) translate(0, 0) scale(${FX.startScale})`, opacity: 1 },
                {
                    transform: `translate(-50%, -50%) translate(${drift}px, ${-FX.risePx}px) scale(${FX.endScale})`,
                    opacity: 0,
                },
            ],
            { duration: FX.durationMs, easing: "cubic-bezier(.2, .7, .3, 1)" },
        );
        const done = () => el.remove();
        anim.onfinish = done;
        anim.oncancel = done;
    }
}

/** Styles for the glyph layer and glyphs. */
export const typingFxStyles = css`
    .fx-layer {
        position: fixed;
        inset: 0;
        pointer-events: none;
        overflow: hidden;
        z-index: 9999;
    }

    .fx-char {
        position: fixed;
        transform: translate(-50%, -50%);
        color: ${themeColors.uiFont};
        font-weight: 800;
        line-height: 1;
        white-space: pre;
        pointer-events: none;
        will-change: transform, opacity;
        text-shadow: 0 0 8px currentColor;
    }
`;
