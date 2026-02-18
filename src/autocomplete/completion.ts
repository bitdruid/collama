import { Context } from "../common/context_editor";
import { requestCompletion } from "../common/ollama";
import { sysConfig } from "../config";
import { Sanitizer } from "./sanitizer";

export class Completion {
    snippet = "";
    context: Context | null = null;

    public async generate() {
        this.context = await Context.create();
        if (!this.context) {
            return;
        }

        this.context.recreateTokenLimit(sysConfig.contextLenCompletion);

        this.snippet = await requestCompletion(this.context);
        this.snippet = Sanitizer.sanitize(this.snippet, this.context);
    }
}
