import { Vault, TFile } from "obsidian";
import { TeamMember } from "./types";

export async function parseOrgMembers(
  vault: Vault,
  filePath: string,
  section: string
): Promise<TeamMember[]> {
  const file = vault.getAbstractFileByPath(filePath);
  if (!(file instanceof TFile)) {
    throw new Error(`구성원 소스 파일을 찾을 수 없음: ${filePath}`);
  }
  const content = await vault.cachedRead(file);
  return extractMembersFromMarkdown(content, section);
}

export function extractMembersFromMarkdown(content: string, section: string): TeamMember[] {
  const lines = content.split(/\r?\n/);
  const sectionRegex = new RegExp(`^(#{2,6})\\s+${escapeRegex(section)}\\s*$`);

  let sectionIdx = -1;
  let sectionLevel = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(sectionRegex);
    if (m) {
      sectionIdx = i;
      sectionLevel = m[1].length;
      break;
    }
  }
  if (sectionIdx < 0) return [];

  for (let i = sectionIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#+)\s/);
    if (headingMatch && headingMatch[1].length <= sectionLevel) break;
    if (line.trim().startsWith("|")) {
      return parseTable(lines, i);
    }
  }
  return [];
}

function parseTable(lines: string[], startIdx: number): TeamMember[] {
  const headerCells = parseTableRow(lines[startIdx]);
  const dutyColIdx = headerCells.findIndex((c) => c.includes("담당"));
  const emailColIdx = headerCells.findIndex(
    (c) => c.includes("이메일") || c.toLowerCase().includes("email")
  );
  if (dutyColIdx < 0 || emailColIdx < 0) return [];

  const members: TeamMember[] = [];
  const seen = new Set<string>();

  for (let i = startIdx + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim().startsWith("|")) break;

    const cells = parseTableRow(line);
    if (cells.length <= Math.max(dutyColIdx, emailColIdx)) continue;

    const email = cells[emailColIdx].trim();
    if (!email || email === "-" || !email.includes("@")) continue;

    const parsed = parseDutyCell(cells[dutyColIdx]);
    if (!parsed) continue;

    const key = `${parsed.name}|${email}`;
    if (seen.has(key)) continue;
    seen.add(key);

    members.push({ name: parsed.name, position: parsed.position, email });
  }
  return members;
}

function parseTableRow(line: string): string[] {
  const trimmed = line.trim();
  const inner = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
  const cells = inner.endsWith("|") ? inner.slice(0, -1) : inner;
  return cells.split("|").map((c) => c.trim());
}

function parseDutyCell(text: string): { name: string; position: string } | null {
  const m = text.match(/^([^()/]+?)\s*\(([^()]+?)\)\s*$/);
  if (!m) return null;
  const name = m[1].trim();
  const position = m[2].trim();
  if (!name || name.startsWith("(") || /\s|또는|·/.test(name)) return null;
  return { name, position };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
