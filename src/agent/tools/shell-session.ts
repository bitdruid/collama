import { ChildProcess, spawn } from "node:child_process";
import { logMsg } from "../../logging";

// Background shell sessions: long-running commands the agent starts, polls, and stops across
// turns. Unlike the one-shot run path (spawn → await close → return), a session's process
// outlives the tool call. State therefore lives in a module-level registry, not in the call.
//
// This mirrors the registry pattern in confirm.ts (module Map + functions); a ShellSession is a
// small stateful object (process + output buffer + read cursor), so it earns being a class.

type ShellType = "bash" | "powershell";

export type SessionStatus = "running" | "exited";

// Guards against leaks: a hard cap on concurrent sessions and a lifetime ceiling after which a
// still-running session is killed (an agent may start something and never check back).
const MAX_SESSIONS = 8;
const MAX_LIFETIME_MS = 30 * 60 * 1000;

const _sessions = new Map<string, ShellSession>();
let _idCounter = 0;

// Event system for session lifecycle changes
const _sessionEventTarget = new EventTarget();
const _sessionChangeEvent = "session-change";

/** Subscribe to session create/kill events. */
export function onSessionChange(fn: () => void): () => void {
    const handler = () => fn();
    _sessionEventTarget.addEventListener(_sessionChangeEvent, handler);
    return () => _sessionEventTarget.removeEventListener(_sessionChangeEvent, handler);
}

function notifySessionChange() {
    _sessionEventTarget.dispatchEvent(new Event(_sessionChangeEvent));
}

/** Returns the number of currently running (not exited) shell sessions. */
export function getActiveSessionCount(): number {
    let count = 0;
    for (const s of _sessions.values()) {
        if (s.status === "running") {
            count++;
        }
    }
    return count;
}

export class ShellSession {
    readonly id: string;
    readonly command: string;
    readonly startedAt = Date.now();
    status: SessionStatus = "running";
    exitCode: number | null = null;

    private readonly child: ChildProcess;
    private buffer = "";
    private cursor = 0;
    private readonly lifetimeTimer: NodeJS.Timeout;

    constructor(id: string, command: string, child: ChildProcess) {
        this.id = id;
        this.command = command;
        this.child = child;

        const append = (chunk: Buffer) => {
            this.buffer += chunk.toString();
        };
        child.stdout?.on("data", append);
        child.stderr?.on("data", append);
        child.on("close", (code) => this._finish(code ?? 0));
        child.on("error", (err) => {
            this.buffer += `\n[spawn error] ${err.message}`;
            this._finish(this.exitCode ?? 1);
        });

        this.lifetimeTimer = setTimeout(() => {
            if (this.status === "running") {
                logMsg(`Shell session ${id} exceeded max lifetime; killing`);
                this.kill();
            }
        }, MAX_LIFETIME_MS);
    }

    /** Output produced since the previous read. Advances the cursor so each check is incremental. */
    readNew(): string {
        const slice = this.buffer.slice(this.cursor);
        this.cursor = this.buffer.length;
        return slice;
    }

    kill(): void {
        if (this.status === "running") {
            this.child.kill();
            this._finish(this.exitCode ?? null);
        }
    }

    private _finish(code: number | null) {
        this.status = "exited";
        this.exitCode = code;
        clearTimeout(this.lifetimeTimer);
        notifySessionChange();
    }
}

/**
 * Spawns a detached background command and registers it. Prunes exited sessions first so they
 * don't count toward the cap. Returns the session, or an error if the cap is reached.
 */
export function createSession(command: string, cwd: string, shellType: ShellType): ShellSession | { error: string } {
    for (const [id, session] of _sessions) {
        if (session.status === "exited") {
            _sessions.delete(id);
        }
    }
    if (_sessions.size >= MAX_SESSIONS) {
        return { error: `Too many background shells running (max ${MAX_SESSIONS}). Stop one with action "stop".` };
    }

    const isPwsh = shellType === "powershell";
    const bin = isPwsh ? (process.platform === "win32" ? "powershell.exe" : "pwsh") : "/bin/bash";
    const cmdArgs = isPwsh ? ["-Command", command] : ["-c", command];
    const env = isPwsh ? { ...process.env, CI: "true" } : { ...process.env, FORCE_COLOR: "0", CI: "true" };

    const child = spawn(bin, cmdArgs, { cwd, shell: false, env });
    const id = `sh${++_idCounter}`;
    const session = new ShellSession(id, command, child);
    _sessions.set(id, session);
    notifySessionChange();
    return session;
}

export function getSession(id: string): ShellSession | undefined {
    return _sessions.get(id);
}

/** Kills and removes a session. Returns false if no such session existed. */
export function killSession(id: string): boolean {
    const session = _sessions.get(id);
    if (!session) {
        return false;
    }
    session.kill();
    _sessions.delete(id);
    notifySessionChange();
    return true;
}

/** Kills every session. Called on extension deactivate so no child process is orphaned. */
export function killAllSessions(): void {
    for (const session of _sessions.values()) {
        session.kill();
    }
    _sessions.clear();
}
