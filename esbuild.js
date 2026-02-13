const esbuild = require("esbuild");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
    name: "esbuild-problem-matcher",
    setup(build) {
        build.onStart(() => {
            console.log("[watch] build started");
        });
        build.onEnd((result) => {
            result.errors.forEach(({ text, location }) => {
                console.error(`✘ [ERROR] ${text}`);
                console.error(`    ${location.file}:${location.line}:${location.column}:`);
            });
            console.log("[watch] build finished");
        });
    },
};

async function main() {
    // extension build
    const extensionCtx = await esbuild.context({
        entryPoints: ["src/extension.ts"],
        bundle: true,
        format: "cjs",
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        platform: "node",
        outfile: "dist/extension.js",
        external: ["vscode"],
        logLevel: "silent",
        plugins: [esbuildProblemMatcherPlugin],
    });

    // webview build
    const webviewCtx = await esbuild.context({
        entryPoints: ["src/chat/web/bundle.ts"],
        bundle: true,
        format: "esm",
        minify: production,
        sourcemap: !production,
        platform: "browser",
        target: "es2020",
        outfile: "dist/chatpanel.js",
        logLevel: "silent",
        loader: {
            ".css": "text",
        },
    });

    if (watch) {
        await Promise.all([extensionCtx.watch(), webviewCtx.watch()]);
    } else {
        await Promise.all([extensionCtx.rebuild(), webviewCtx.rebuild()]);
        await Promise.all([extensionCtx.dispose(), webviewCtx.dispose()]);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
