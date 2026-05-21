import { copyFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const vaultPath = process.env.OBSIDIAN_VAULT_PATH;

if (!vaultPath) {
  console.error("OBSIDIAN_VAULT_PATH 환경변수를 설정하세요.");
  console.error("예) $env:OBSIDIAN_VAULT_PATH = \"C:\\Users\\<you>\\OneDrive - ㈜씨젠\\SW연구소 - obsidian\"");
  console.error("    npm run install-plugin");
  process.exit(1);
}

if (!existsSync(vaultPath)) {
  console.error("Vault not found:", vaultPath);
  process.exit(1);
}

const pluginDir = join(vaultPath, ".obsidian", "plugins", "vault-plugin");
mkdirSync(pluginDir, { recursive: true });

for (const file of ["main.js", "manifest.json", "styles.css"]) {
  copyFileSync(file, join(pluginDir, file));
  console.log(`Copied: ${file} -> ${pluginDir}`);
}

console.log("\n설치 완료. Obsidian > Community plugins > Seegene Vault Plugin 활성화하세요.");
