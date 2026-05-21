import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";

esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", ...builtins],
  format: "cjs",
  target: "es2022",
  logLevel: "info",
  sourcemap: process.argv[2] === "production" ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  minify: process.argv[2] === "production",
}).catch(() => process.exit(1));
