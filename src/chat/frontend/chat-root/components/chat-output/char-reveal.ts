/**
 * Char-by-char reveal for streaming assistant text.
 *
 * Caps in-flight text. Each frame drains backlog over a catch-up window —
 * speeds up when tokens arrive fast, slows when they trickle. Remaining
 * chars snap in when the stream ends.
 */
export class CharReveal {
    private shown = 0;
    private id: string | null = null;
    private raf = 0;
    private last = 0;

    constructor(
        /** Returns the in-flight message's content and id. */
        private readonly getStreaming: () => { content: string; id: string | null },
        /** Called when revealed length grows — triggers host re-render. */
        private readonly onAdvance: () => void,
        /** Backlog drain window per frame (ms). */
        private readonly catchupMs = 120,
    ) {}

    /**
     * Drive every render: starts the reveal loop while active, resets on new message.
     * @param active - Whether the stream is currently active.
     */
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

    /** Stops the reveal loop and resets the tracked message. */
    stop() {
        if (this.raf) {
            cancelAnimationFrame(this.raf);
        }
        this.raf = 0;
        this.id = null;
    }

    /**
     * Caps streaming content to what's currently revealed.
     * @param content - The full streaming content.
     * @returns The revealed portion.
     */
    cap(content: string): string {
        return content.slice(0, this.shown);
    }

    /**
     * Animation frame callback: drains backlog over the catch-up window.
     * @param now - Timestamp from requestAnimationFrame.
     */
    private tick = (now: number) => {
        const dt = now - this.last;
        this.last = now;

        const target = this.getStreaming().content.length;
        if (this.shown < target) {
            const backlog = target - this.shown;
            this.shown = Math.min(target, this.shown + Math.ceil(backlog * Math.min(1, dt / this.catchupMs)));
            this.onAdvance();
        }

        // Keep running while active; new chunks raise the target mid-stream.
        this.raf = requestAnimationFrame(this.tick);
    };
}
