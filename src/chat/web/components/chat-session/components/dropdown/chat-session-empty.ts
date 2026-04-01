// src/chat/web/components/chat_session/components/dropdown/chat_empty_state.ts
import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { commonStyles } from "../../styles-shared";
import { emptyStateStyles } from "./styles";

@customElement("collama-empty-state")
export class EmptyState extends LitElement {
    static styles = [commonStyles, emptyStateStyles];
    message: string | undefined;

    connectedCallback() {
        super.connectedCallback();

        const messages = [
            "Hey, wanna code with me?",
            "Ready to build something awesome?",
            "Let's create something amazing!",
            "Time to write some clean code!",
            "Coffee ☕ + Code = ❤️",
            "What are we building today?",
            "Let's ship something great 🚀",
            "Got an idea? Let's code it!",
            "Time to turn ideas into code.",
            "Let's squash some bugs 🐛",
            "Let's make the compiler happy.",
            "Another day, another commit.",
            "Let's break it… then fix it.",
            "Debug mode activated.",
            "Let's get those builds green 🟢",
            "Need a quick coding assist?",
            "Let's optimize something.",
            "Let's write fewer bugs today 😄",
            "Let's make Git proud.",
            "Another feature incoming?",
            "Need help untangling that logic?",
            "What are we debugging today?",
            "Alright, what are we breaking today?",
            "An empty chat. Suspicious.",
            "Fresh chat. Fresh mistakes.",
            "Paste the error. Let's fight it.",
            "Somewhere a semicolon is missing.",
            "Silence… the calm before the stack trace.",
            "Let's anger a linter.",
            "Your future self will debug this.",
            "It worked on my machine 🤷",
            "Let's summon a compiler error.",
            "Time to confuse the type system.",
            "Let's write code that almost works.",
            "Explain the bug. I'll nod wisely.",
            "Awaiting questionable coding decisions.",
            "Let's stare at code until it confesses.",
            "Insert brilliant idea here ✨",
            "Let's create a bug we'll fix later.",
            "Time to make the CPU sweat 🔥",
            "Ready for a tiny refactor that changes everything?",
            "Let's add 'just one more feature'.",
            "The tests will tell us the truth.",
            "Somewhere a test just failed.",
            "Let's introduce a subtle bug.",
            "Waiting for the next stack trace.",
            "Ready to anger production?",
            "Let's make the linter proud.",
            "Time to battle an off-by-one error.",
            "Let's make Git nervous.",
            "Ready for some questionable commits?",
            "Let's debug the impossible 🐛",
            "Hope you like edge cases.",
            "Time to summon Stack Overflow.",
            "Let's build something weird.",
            "One chat away from a breakthrough.",
            "Let's accidentally invent a framework.",
            "Waiting for the inevitable error message.",
            "Let's write elegant chaos.",
            "Time to break… I mean build something.",
            "Let's turn coffee into code ☕",
            "Ready to fight the compiler?",
            "Let's make the logs interesting.",
            "Another day, another mysterious bug.",
            "Let's create technical debt responsibly.",
            "Ready when your code isn't.",
            "Let's make the debugger earn its salary.",
            "Time to outsmart a runtime error.",
            "Let's push our luck (and some code) 🚀",
            "Let's make the stack trace longer.",
            "Ready to confuse future developers?",
            "Alright, show me the code.",
        ];

        this.message = messages[Math.floor(Math.random() * messages.length)];
    }

    render() {
        return html`<div class="empty-state">${this.message}</div>`;
    }
}
