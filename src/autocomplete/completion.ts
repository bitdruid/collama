import { requestCompletion } from "../common/ollama";
import { Context } from "../common/context";
import { Sanitizer } from "./sanitizer";

export class Completion {
    snippet = "";
    context: Context | null = null;

    public async generate() {
        this.context = Context.create();
        if (!this.context) {
            return;
        }

        this.snippet = await requestCompletion(this.context);
        this.snippet = Sanitizer.sanitize(this.snippet, this.context);
    }
}
