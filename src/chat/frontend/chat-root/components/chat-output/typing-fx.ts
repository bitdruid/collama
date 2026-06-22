import { css } from "lit";

import { themeColors } from "../../../styles";

/**
 * "Blast-in" particle effect for streaming assistant text.
 *
 * Inspired by RediculousCoding (https://github.com/merenut/RediculousCoding).
 * Spawns animated glyphs at the caret position as text streams in — each glyph
 * floats up, grows, and fades. Self-contained: host feeds streamed text on each
 * render; spawning, animation, and cleanup live here.
 */

/** Tunable parameters for the blast-in effect. */
const FX = {
    /** Font size of a popped glyph (px). */
    fontSizePx: 18,
    /** Scale at spawn and at peak of rise. */
    startScale: 1.0,
    endScale: 2.0,
    /** Vertical rise distance before fade (px). */
    risePx: 25,
    /** Random horizontal wander amplitude (px). */
    driftPx: 25,
    /** Glyph lifetime (ms). */
    durationMs: 1000,
} as const;

export class TypingFx {
    private lastLen = 0;

    constructor(
        /** Returns the fixed overlay element for spawning glyphs. */
        private readonly getLayer: () => HTMLElement | null,
        /** Returns the streaming bubble element for caret position. */
        private readonly getCaretHost: () => HTMLElement | null,
    ) {}

    /**
     * Call on every render while streaming. Diffs content and spawns a glyph for
     * each new printable character. When `enabled` is false, only tracks length
     * so finishing a stream never replays old text.
     */
    update(enabled: boolean, content: string) {
        const len = content.length;
        if (!enabled || len <= this.lastLen) {
            this.lastLen = len;
            return;
        }
        const delta = content.slice(this.lastLen);
        this.lastLen = len;

        // Code/summary/context fences render into an accordion's shadow DOM,
        // where the caret can't be located — skip the effect while inside one.
        if (this._insideOpenFence(content)) {
            return;
        }
        const chars = this._printables(delta);
        if (!chars.length) {
            return;
        }
        const caret = this._caretPoint();
        if (!caret) {
            return;
        }
        // Fan the new chars out behind the caret so a multi-char frame doesn't stack.
        const step = FX.fontSizePx * 0.6;
        for (let i = 0; i < chars.length; i++) {
            this._pop(chars[i], caret.x - (chars.length - 1 - i) * step, caret.y);
        }
    }

    /** Non-whitespace characters of `s`, in reading order. */
    private _printables(s: string): string[] {
        const out: string[] = [];
        for (const ch of s) {
            if (!/\s/.test(ch)) {
                out.push(ch);
            }
        }
        return out;
    }

    /** True when content is inside an unclosed ``` fence. */
    private _insideOpenFence(s: string): boolean {
        const fences = s.match(/^[ \t]*```/gm);
        return !!fences && fences.length % 2 === 1;
    }

    /** Viewport position of the last visible character in the streamed text. */
    private _caretPoint(): { x: number; y: number } | null {
        const host = this.getCaretHost();
        if (!host) {
            return null;
        }
        // Walk to the last text node with real content. We skip whitespace-only
        // nodes because markdown-it emits a trailing "\n" after block tags, which
        // becomes an unrendered text node (0×0 rect). A range collapsed at the
        // container edge is also unreliable, so we measure the box of the final
        // visible character and take its right edge (correct even at soft wraps).
        const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
        let last: Text | null = null;
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (n.textContent && n.textContent.trim().length > 0) {
                last = n as Text;
            }
        }
        if (last) {
            const text = last.textContent!;
            let idx = text.length - 1;
            while (idx > 0 && /\s/.test(text[idx])) {
                idx--;
            }
            const range = document.createRange();
            range.setStart(last, idx);
            range.setEnd(last, idx + 1);
            const rect = range.getBoundingClientRect();
            if (rect.width || rect.height) {
                return { x: rect.right, y: rect.top + rect.height / 2 };
            }
        }
        // No measurable text yet (e.g. only a thinking accordion): use the bubble.
        const b = host.getBoundingClientRect();
        return { x: b.right, y: b.bottom };
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
