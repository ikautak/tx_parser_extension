import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as esbuild from "esbuild";

const isWatch = process.argv.includes("--watch");

const projectRoot = import.meta.dirname;

/** @type {import('esbuild').BuildOptions} */
const shared = {
    bundle: true,
    sourcemap: true,
    target: "es2022",
    logLevel: "info",
};

/**
 * Copy the webview stylesheet into dist (referenced directly by the HTML).
 *
 * @returns {import('esbuild').Plugin}
 */
function copyWebviewCss() {
    const src = path.join(projectRoot, "src", "webview", "style.css");
    const dest = path.join(projectRoot, "dist", "webview", "style.css");
    return {
        name: "copy-webview-css",
        setup(build) {
            build.onEnd(async () => {
                await fs.mkdir(path.dirname(dest), { recursive: true });
                await fs.copyFile(src, dest);
            });
        },
    };
}

/**
 * Bundle the extension host entry point (ESM).
 *
 * @type {import('esbuild').BuildOptions}
 */
const extension = {
    ...shared,
    entryPoints: ["src/extension.ts"],
    outdir: "dist",
    platform: "node",
    format: "esm",
    external: ["vscode"],
};

/**
 * Bundle the webview script and copy its stylesheet.
 *
 * @type {import('esbuild').BuildOptions}
 */
const webview = {
    ...shared,
    entryPoints: ["src/webview/main.ts"],
    outdir: "dist/webview",
    platform: "browser",
    format: "iife",
    plugins: [copyWebviewCss()],
};

/** @type {import('esbuild').BuildOptions[]} */
const builds = [extension, webview];

try {
    if (isWatch) {
        const contexts = await Promise.all(builds.map((options) => esbuild.context(options)));
        await Promise.all(contexts.map((context) => context.watch()));
        console.log("watching for changes...");
    } else {
        await Promise.all(builds.map((options) => esbuild.build(options)));
    }
} catch (error) {
    console.error(error);
    process.exit(1);
}
