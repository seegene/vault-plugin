import { Vault, TFile } from "obsidian";
import { TeamMember } from "./types";

export async function parseOrgMembers(
  vault: Vault,
  filePath: string,
  sections: string[]
): Promise<TeamMember[]> {
  const file = vault.getAbstractFileByPath(filePath);
  if (!(file instanceof TFile)) {
    throw new Error(`구성원 소스 파일을 찾을 수 없음: ${filePath}`);
  }
  const content = await vault.cachedRead(file);

  const all: TeamMember[] = [];
  const seen = new Set<string>();
  for (const section of sections) {
    const members = extractMembersFromMarkdown(content, section);
    for (const m of members) {
      const key = `${m.name}|${m.email}`;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(m);
    }
  }
  return all;
}

export function extractMembersFromMarkdown(content: string, section: string): TeamMember[] {
  const lines = content.split(/\r?\n/);
  const sectionRegex = new RegExp(`^(#{2,6})\\s+${escapeRegex(section)}(?=\\s|\\(|$)`);

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

  const contentLines: string[] = [];
  for (let i = sectionIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#+)\s/);
    if (headingMatch && headingMatch[1].length <= sectionLevel) break;
    contentLines.push(line);
  }

  const firstContent = contentLines.find((l) => l.trim().length > 0);
  if (!firstContent) return [];

  const trimmed = firstContent.trim();
  if (trimmed.startsWith("|")) return parseTable(contentLines);
  if (trimmed.startsWith("-") || trimmed.startsWith("*")) return parseBulletList(contentLines);
  return [];
}

function parseTable(lines: string[]): TeamMember[] {
  const tableStart = lines.findIndex((l) => l.trim().startsWith("|"));
  if (tableStart < 0) return [];

  const headerCells = parseTableRow(lines[tableStart]);
  const dutyColIdx = headerCells.findIndex((c) => c.includes("담당"));
  const emailColIdx = headerCells.findIndex(
    (c) => c.includes("이메일") || c.toLowerCase().includes("email")
  );
  if (dutyColIdx < 0 || emailColIdx < 0) return [];

  const members: TeamMember[] = [];
  for (let i = tableStart + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim().startsWith("|")) break;

    const cells = parseTableRow(line);
    if (cells.length <= Math.max(dutyColIdx, emailColIdx)) continue;

    const email = cells[emailColIdx].trim();
    if (!email || email === "-" || !email.includes("@")) continue;

    const parsed = parseDutyCell(cells[dutyColIdx]);
    if (!parsed) continue;

    members.push({ name: parsed.name, position: parsed.position, email });
  }
  return members;
}

const BULLET_REGEX = /^[-*]\s+\*\*([^*]+)\*\*\s+(.+?)\s*\/\s*(.+?)\s*\/\s*([\w.+\-]+@[\w.\-]+)/;

function parseBulletList(lines: string[]): TeamMember[] {
  const members: TeamMember[] = [];
  for (const line of lines) {
    const m = line.match(BULLET_REGEX);
    if (!m) continue;
    const name = m[1].trim();
    const role = m[2].trim();
    const rank = m[3].trim();
    const email = m[4].trim();
    if (!name || !email) continue;

    let position: string;
    if (role === "-" || !role) position = rank;
    else if (rank === "-" || !rank) position = role;
    else position = `${role} / ${rank}`;

    members.push({ name, position, email });
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
