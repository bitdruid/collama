const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

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

/**
 * Inlines woff2 font files referenced in @fontsource CSS as base64 data URIs.
 * This lets us `import "@fontsource/roboto/400.css"` without needing Vite's asset handling.
 */
const inlineFontsPlugin = {
    name: "inline-fonts",
    setup(build) {
        build.onLoad({ filter: /@fontsource\/.*\.css$/ }, async (args) => {
            let css = await fs.promises.readFile(args.path, "utf8");
            const dir = path.dirname(args.path);

            // Replace url(./files/xxx.woff2) with inline base64 data URIs
            css = css.replace(/url\(\.\/files\/([^)]+\.woff2)\)/g, (_, filename) => {
                const filePath = path.join(dir, "files", filename);
                if (!fs.existsSync(filePath)) {
                    console.warn(`[inline-fonts] font file not found: ${filePath}`);
                    return `url(./files/${filename})`;
                }
                const buffer = fs.readFileSync(filePath);
                const b64 = buffer.toString("base64");
                return `url(data:font/woff2;base64,${b64})`;
            });

            return { contents: css, loader: "text" };
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
        entryPoints: ["src/chat/frontend/bundle.ts"],
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
        plugins: [inlineFontsPlugin],
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
