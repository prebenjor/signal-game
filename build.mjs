import { build } from "esbuild";

async function run() {
  await build({
    entryPoints: ["app.js"],
    outfile: "app.bundle.js",
    bundle: true,
    minify: true,
    target: ["es2019"],
    format: "iife",
    logLevel: "info"
  });

  await build({
    entryPoints: ["styles.css"],
    outfile: "styles.min.css",
    minify: true,
    logLevel: "info"
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
