/**
 * Char-by-char reveal for streaming assistant text.
 *
 * Caps how much in-flight text is painted. Each frame drains the backlog over a
 * catch-up window — speeds up when tokens arrive fast, slows when they trickle.
 * When the stream ends, remaining chars snap in.
 */
export class CharReveal {
    private shown = 0;
    private id: string | null = null;
    private raf = 0;
    private last = 0;

    constructor(
        /** Returns the in-flight message's full content and id. */
        private readonly getStreaming: () => { content: string; id: string | null },
        /** Called when revealed length grows, triggers host re-render. */
        private readonly onAdvance: () => void,
        /** Backlog drain window per frame (ms). */
        private readonly catchupMs = 120,
    ) {}

    /** Drive every render: starts the reveal loop while active, resets per new message. */
    sync(active: boolean) {
        if (!active) {
            this.stop();
            return;
        }
        const { id } = this.getStreaming();
        if (id !== this.id) {
            this.id = id;
            this.shown = 0;
        }
        if (!this.raf) {
            this.last = performance.now();
            this.raf = requestAnimationFrame(this.tick);
        }
    }

    /** Stops the reveal loop and resets tracked message. */
    stop() {
        if (this.raf) {
            cancelAnimationFrame(this.raf);
        }
        this.raf = 0;
        this.id = null;
    }

    /** Caps the full streaming content to what's currently revealed. */
    cap(content: string): string {
        return content.slice(0, this.shown);
    }

    private tick = (now: number) => {
        const dt = now - this.last;
        this.last = now;

        const target = this.getStreaming().content.length;
        if (this.shown < target) {
            const backlog = target - this.shown;
            this.shown = Math.min(target, this.shown + Math.ceil(backlog * Math.min(1, dt / this.catchupMs)));
            this.onAdvance();
        }

        // Keep running while active; new chunks raise the target between frames.
        this.raf = requestAnimationFrame(this.tick);
    };
}
