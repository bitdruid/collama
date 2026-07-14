import * as vscode from "vscode";
import { requestToolConfirm } from "./confirm";

// Notebooks need their own scheme: else jumps back to JSON
const TEXT_SCHEME = "collama-txtdiff";
const NOTEBOOK_SCHEME = "collama-nbdiff";

/**
 * Determines the appropriate URI scheme for a given file extension.
 * Notebooks (.ipynb) require a dedicated scheme to render richly;
 * all other files use the text scheme.
 * @param ext - The file extension including the dot (e.g., ".ts", ".ipynb").
 * @returns The URI scheme to use for the given extension.
 */
function schemeFor(ext: string): string {
    return ext === ".ipynb" ? NOTEBOOK_SCHEME : TEXT_SCHEME;
}

/**
 * In-memory, read-only filesystem provider for diff previews.
 * Uses a FileSystemProvider (readFile/stat) instead of TextDocumentContentProvider
 * to enable rich rendering of .ipynb files as notebook diffs while still
 * supporting plain text files as text diffs.
 */
class DiffFileSystemProvider implements vscode.FileSystemProvider {
    private files = new Map<string, Uint8Array>();
    private emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    onDidChangeFile = this.emitter.event;

    /**
     * Sets or updates the content for a given URI in the in-memory filesystem.
     * @param uri - The URI to set content for.
     * @param content - The string content to store (will be encoded to UTF-8).
     */
    setContent(uri: vscode.Uri, content: string): void {
        this.files.set(uri.toString(), new TextEncoder().encode(content));
        this.emitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
    }

    /**
     * Removes the content for a given URI from the in-memory filesystem.
     * @param uri - The URI to remove from storage.
     */
    dispose(uri: vscode.Uri): void {
        this.files.delete(uri.toString());
    }

    /**
     * Reads the content of a file from the in-memory filesystem.
     * @param uri - The URI of the file to read.
     * @returns The raw bytes of the file content.
     * @throws FileSystemError.FileNotFound if the file does not exist.
     */
    readFile(uri: vscode.Uri): Uint8Array {
        const data = this.files.get(uri.toString());
        if (!data) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        return data;
    }

    /**
     * Returns metadata about a file in the in-memory filesystem.
     * @param uri - The URI of the file to stat.
     * @returns A FileStat object describing the file.
     * @throws FileSystemError.FileNotFound if the file does not exist.
     */
    stat(uri: vscode.Uri): vscode.FileStat {
        const data = this.files.get(uri.toString());
        if (!data) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        return { type: vscode.FileType.File, ctime: 0, mtime: 0, size: data.byteLength };
    }

    /**
     * Creates a watcher for filesystem changes. This provider does not support
     * file watching, so returns an empty disposable.
     * @returns A disposable that does nothing.
     */
    watch(): vscode.Disposable {
        return new vscode.Disposable(() => {});
    }

    /**
     * Lists directory contents. This provider does not support directories.
     * @returns An empty array.
     */
    readDirectory(): [string, vscode.FileType][] {
        return [];
    }

    /**
     * Creates a directory. This operation is not supported by this read-only provider.
     */
    createDirectory(): void {}

    /**
     * Writes to a file. This operation is not supported by this read-only provider.
     * @throws FileSystemError.NoPermissions always, as this is a read-only filesystem.
     */
    writeFile(): void {
        throw vscode.FileSystemError.NoPermissions("collama diff is read-only");
    }

    /**
     * Deletes a file. This operation is not supported by this read-only provider.
     */
    delete(): void {}

    /**
     * Renames or moves a file. This operation is not supported by this read-only provider.
     * @throws FileSystemError.NoPermissions always, as this is a read-only filesystem.
     */
    rename(): void {
        throw vscode.FileSystemError.NoPermissions("collama diff is read-only");
    }
}

let diffProvider: DiffFileSystemProvider | undefined;

/**
 * Gets the singleton DiffFileSystemProvider instance, lazily initializing it
 * and registering it for both text and notebook URI schemes on first call.
 * @returns The initialized DiffFileSystemProvider instance.
 */
function getDiffProvider(): DiffFileSystemProvider {
    if (!diffProvider) {
        diffProvider = new DiffFileSystemProvider();
        vscode.workspace.registerFileSystemProvider(TEXT_SCHEME, diffProvider, { isReadonly: true });
        vscode.workspace.registerFileSystemProvider(NOTEBOOK_SCHEME, diffProvider, { isReadonly: true });
    }
    return diffProvider;
}

/**
 * Closes any open diff tabs showing a comparison between original and modified URIs.
 * Works with both text and notebook diff editors.
 * @param originalUri - The URI of the original (left) document in the diff.
 * @param modifiedUri - The URI of the modified (right) document in the diff.
 */
async function closeDiffTabs(originalUri: vscode.Uri, modifiedUri: vscode.Uri): Promise<void> {
    const toClose: vscode.Tab[] = [];
    for (const group of vscode.window.tabGroups.all) {
        for (const tab of group.tabs) {
            const input = tab.input as { original?: vscode.Uri; modified?: vscode.Uri } | undefined;
            if (
                input?.original?.toString() === originalUri.toString() &&
                input?.modified?.toString() === modifiedUri.toString()
            ) {
                toClose.push(tab);
            }
        }
    }
    if (toClose.length > 0) {
        await vscode.window.tabGroups.close(toClose, true);
    }
}

/**
 * Closes any open preview tabs for a given document URI.
 * Works with both text and notebook editors.
 * @param uri - The URI of the document whose preview tab should be closed.
 */
async function closePreviewTab(uri: vscode.Uri): Promise<void> {
    const toClose: vscode.Tab[] = [];
    for (const group of vscode.window.tabGroups.all) {
        for (const tab of group.tabs) {
            const input = tab.input as { uri?: vscode.Uri } | undefined;
            if (input?.uri?.toString() === uri.toString()) {
                toClose.push(tab);
            }
        }
    }
    if (toClose.length > 0) {
        await vscode.window.tabGroups.close(toClose, true);
    }
}

/**
 * Displays a read-only diff view comparing original vs proposed content,
 * served from an in-memory filesystem to enable rich .ipynb rendering.
 * After the user confirms or declines, closes the diff tab and returns the result.
 * @param params - The parameters for the diff confirmation.
 * @param params.original - The original content to show on the left side.
 * @param params.proposed - The proposed content to show on the right side.
 * @param params.ext - The file extension (e.g., ".ts", ".ipynb") determining syntax highlighting.
 * @param params.action - The action being confirmed (e.g., "Apply changes").
 * @param params.displayPath - The path to display to the user in the confirmation dialog.
 * @param params.explanation - Additional context or explanation shown in the confirmation.
 * @param params.title - The title for the diff editor tab.
 * @returns An object containing the user's confirmation value and reason for the result.
 */
export async function confirmWithDiff(params: {
    original: string;
    proposed: string;
    /** File extension incl. dot (e.g. ".ts", ".ipynb"); drives highlighting / notebook rendering. */
    ext: string;
    action: string;
    displayPath: string;
    explanation: string;
    title: string;
}): Promise<{ value: string | null; reason: string }> {
    const provider = getDiffProvider();
    const id = Date.now();
    const scheme = schemeFor(params.ext);
    const originalUri = vscode.Uri.parse(`${scheme}:/${id}-original${params.ext}`);
    const modifiedUri = vscode.Uri.parse(`${scheme}:/${id}-proposed${params.ext}`);
    provider.setContent(originalUri, params.original);
    provider.setContent(modifiedUri, params.proposed);

    try {
        await vscode.commands.executeCommand("vscode.diff", originalUri, modifiedUri, params.title, {
            preview: false,
        });
        return await requestToolConfirm(params.action, params.displayPath, params.explanation);
    } finally {
        await closeDiffTabs(originalUri, modifiedUri);
        provider.dispose(originalUri);
        provider.dispose(modifiedUri);
    }
}

/**
 * Displays a read-only preview of content from an in-memory filesystem,
 * enabling rich rendering of .ipynb files as notebooks.
 * After the user confirms or declines, closes the preview tab and returns the result.
 * @param params - The parameters for the preview confirmation.
 * @param params.content - The content to display in the preview.
 * @param params.ext - The file extension (e.g., ".ts", ".ipynb") determining the editor type.
 * @param params.action - The action being confirmed (e.g., "Create file").
 * @param params.displayPath - The path to display to the user in the confirmation dialog.
 * @param params.explanation - Additional context or explanation shown in the confirmation.
 * @returns An object containing the user's confirmation value and reason for the result.
 */
export async function confirmWithPreview(params: {
    content: string;
    /** File extension incl. dot; drives highlighting / notebook rendering. */
    ext: string;
    action: string;
    displayPath: string;
    explanation: string;
}): Promise<{ value: string | null; reason: string }> {
    const provider = getDiffProvider();
    const id = Date.now();
    const scheme = schemeFor(params.ext);
    const previewUri = vscode.Uri.parse(`${scheme}:/${id}-preview${params.ext}`);
    provider.setContent(previewUri, params.content);

    // Force the notebook editor for .ipynb; "default" picks the text editor for everything else.
    const viewType = params.ext === ".ipynb" ? "jupyter-notebook" : "default";

    try {
        await vscode.commands.executeCommand("vscode.openWith", previewUri, viewType, { preview: false });
        return await requestToolConfirm(params.action, params.displayPath, params.explanation);
    } finally {
        await closePreviewTab(previewUri);
        provider.dispose(previewUri);
    }
}
