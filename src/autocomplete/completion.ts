import { EditorContext } from "../common/context_editor";
import { requestCompletion } from "../common/requests";
import { userConfig } from "../config";
import { Sanitizer } from "./sanitizer";

export class Completion {
    snippet = "";
    context: EditorContext | null = null;

    public async generate() {
        this.context = await EditorContext.create();
        if (!this.context) {
            return;
        }

        this.context.recreateTokenLimit(userConfig.apiTokenContextLenCompletion);

        this.snippet = await requestCompletion(this.context);
        this.snippet = Sanitizer.sanitize(this.snippet, this.context);
    }
}
