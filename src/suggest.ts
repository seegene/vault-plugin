import {
  Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, TFile,
} from "obsidian";
import type SeegeneVaultPlugin from "./main";
import { TeamMember } from "./types";

export class MentionSuggest extends EditorSuggest<TeamMember> {
  plugin: SeegeneVaultPlugin;

  constructor(plugin: SeegeneVaultPlugin) {
    super(plugin.app);
    this.plugin = plugin;
  }

  onTrigger(cursor: EditorPosition, editor: Editor, _file: TFile | null): EditorSuggestTriggerInfo | null {
    const line = editor.getLine(cursor.line);
    const textBefore = line.slice(0, cursor.ch);

    const match = textBefore.match(/@([\w가-힣]*)$/);
    if (!match) return null;

    const atIndex = textBefore.lastIndexOf("@");
    if (atIndex > 0 && /[\w가-힣]/.test(textBefore[atIndex - 1])) return null;

    return { start: { line: cursor.line, ch: atIndex }, end: cursor, query: match[1] };
  }

  getSuggestions(context: EditorSuggestContext): TeamMember[] {
    const query = context.query.toLowerCase();
    if (!query) return this.plugin.settings.members.slice(0, 20);
    return this.plugin.settings.members.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        m.email.toLowerCase().includes(query) ||
        (m.position?.toLowerCase() ?? "").includes(query)
    );
  }

  renderSuggestion(member: TeamMember, el: HTMLElement): void {
    const container = el.createDiv({ cls: "sg-mention-item" });
    const top = container.createDiv({ cls: "sg-mention-top" });
    top.createSpan({ cls: "sg-mention-name", text: member.name });
    if (member.position) {
      top.createSpan({ cls: "sg-mention-position", text: member.position });
    }
    container.createDiv({ cls: "sg-mention-email", text: member.email });
  }

  selectSuggestion(member: TeamMember, _evt: MouseEvent | KeyboardEvent): void {
    if (!this.context) return;
    const { editor, start, end } = this.context;
    editor.replaceRange(`@${member.name} `, start, end);
  }
}
