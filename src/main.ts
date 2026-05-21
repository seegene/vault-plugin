import { MarkdownView, Notice, Plugin, TFile, debounce, WorkspaceLeaf } from "obsidian";
import { PluginSettings, MentionRecord } from "./types";
import { CommentStore } from "./store";
import { CommentPanelView, VIEW_TYPE } from "./panel";
import { MentionSuggest } from "./suggest";
import { SeegeneSettingTab } from "./settings";
import { sendNotification } from "./notify";
import { parseOrgMembers } from "./orgParser";

const DEFAULT_SETTINGS: PluginSettings = {
  members: [],
  notifyOnComment: true,
  notifyOnMention: true,
  membersSourceFile: "연구소 생활/for-ai/조직구조-전직원.md",
  membersSections: [
    "SW연구소",
    "SW기술랩",
    "인실리코기획랩",
    "인실리코웹기획팀",
    "인실리코운영기획팀",
    "웹개발팀",
    "Application SW팀",
    "Architect팀",
    "Core개발팀",
  ],
};

const LEGACY_SOURCE_FILE = "연구소 생활/for-ai/조직구조.md";

export default class SeegeneVaultPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS;
  store: CommentStore = null!;
  mentionRecord: MentionRecord = {};
  lastActiveFile: TFile | null = null;
  lastActiveLeaf: WorkspaceLeaf | null = null;
  preCapturedSelection: string | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.store = new CommentStore(this.app.vault);

    // ── Comments panel ──
    this.registerView(VIEW_TYPE, (leaf) => new CommentPanelView(leaf, this));
    this.addRibbonIcon("message-square", "Comments", () => this.togglePanel());

    // ── @mention autocomplete ──
    this.registerEditorSuggest(new MentionSuggest(this));

    // ── Settings ──
    this.addSettingTab(new SeegeneSettingTab(this.app, this));

    // ── Track active markdown file ──
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        if (!leaf) return;
        const view = leaf.view;
        if (view instanceof MarkdownView && view.file) {
          this.lastActiveFile = view.file;
          this.lastActiveLeaf = leaf;
          this.refreshPanel();
        }
      })
    );

    // ── URL file handler ──
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (file && file.extension === "url") {
          this.openUrlFile(file);
        }
      })
    );

    // ── Commands ──
    this.addCommand({
      id: "add-comment",
      name: "Add comment (선택한 텍스트에 댓글 추가)",
      callback: () => this.addCommentFromSelection(),
    });

    this.addCommand({
      id: "toggle-panel",
      name: "Toggle comment panel (댓글 패널 열기/닫기)",
      callback: () => this.togglePanel(),
    });

    this.addCommand({
      id: "refresh-members",
      name: "구성원 목록을 조직구조 파일에서 새로고침",
      callback: () => this.refreshOrgMembers(true),
    });

    // ── Body @mention detection ──
    const debouncedCheck = debounce(
      (file: TFile) => this.checkBodyMentions(file),
      3000,
      true
    );

    const debouncedOrgRefresh = debounce(() => this.refreshOrgMembers(false), 1500, false);

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile && file.path === this.settings.membersSourceFile) {
          debouncedOrgRefresh();
          return;
        }
        if (this.settings.notifyOnMention && file instanceof TFile && file.extension === "md") {
          debouncedCheck(file);
        }
      })
    );

    // ── Startup ──
    this.app.workspace.onLayoutReady(() => {
      this.refreshOrgMembers(false);

      const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE);
      for (let i = 1; i < existing.length; i++) existing[i].detach();

      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (activeView?.file) {
        this.lastActiveFile = activeView.file;
        this.lastActiveLeaf = activeView.leaf;
      }

      if (existing.length === 0) this.activatePanel();
    });
  }

  async refreshOrgMembers(showNotice: boolean): Promise<void> {
    try {
      const members = await parseOrgMembers(
        this.app.vault,
        this.settings.membersSourceFile,
        this.settings.membersSections
      );
      this.settings.members = members;
      await this.saveSettings();
      this.refreshPanel();
      if (showNotice) new Notice(`구성원 ${members.length}명 로드 완료`);
    } catch (e) {
      console.error("Seegene Vault Plugin: org refresh failed", e);
      if (showNotice) new Notice(`구성원 새로고침 실패: ${(e as Error).message}`);
    }
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  // ── URL file handler ──

  private async openUrlFile(file: TFile): Promise<void> {
    try {
      const content = await this.app.vault.read(file);
      const match = content.match(/^URL=(.+)$/m);
      if (!match) return;

      window.open(match[1].trim(), "_blank");

      // Close the error leaf
      const leaf = this.app.workspace.getLeaf();
      if (leaf) leaf.detach();
    } catch (err) {
      console.error("Seegene Vault Plugin: URL open failed", err);
    }
  }

  // ── Markdown view helper ──

  getMarkdownView(): MarkdownView | null {
    const active = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (active) return active;
    if (this.lastActiveLeaf) {
      const view = this.lastActiveLeaf.view;
      if (view instanceof MarkdownView) return view;
    }
    return null;
  }

  // ── Panel ──

  async togglePanel(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if (existing.length > 0) {
      existing.forEach((leaf) => leaf.detach());
    } else {
      await this.activatePanel();
    }
  }

  private async activatePanel(): Promise<void> {
    if (this.app.workspace.getLeavesOfType(VIEW_TYPE).length > 0) return;
    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
      this.app.workspace.revealLeaf(leaf);
    }
  }

  refreshPanel(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view instanceof CommentPanelView) {
        (leaf.view as CommentPanelView).refresh();
      }
    }
  }

  // ── Add comment + notify ──

  async addCommentFromSelection(): Promise<void> {
    const mdView = this.getMarkdownView();
    if (!mdView?.file) {
      new Notice("문서를 먼저 열어주세요.");
      return;
    }

    const editor = mdView.editor;
    let selection = this.preCapturedSelection ?? "";
    this.preCapturedSelection = null;

    if (!selection) selection = editor.getSelection();
    if (!selection) selection = (window.getSelection()?.toString() ?? "").trim();

    if (!selection) {
      new Notice("댓글을 달 텍스트를 먼저 선택하세요.");
      return;
    }

    const text = await this.promptInput("댓글 입력 (@이름으로 멘션 가능)");
    if (!text) return;

    let lineNumber = 0;
    try {
      lineNumber = editor.getCursor("from").line;
    } catch {
      const content = await this.app.vault.cachedRead(mdView.file);
      const idx = content.indexOf(selection);
      if (idx >= 0) lineNumber = content.slice(0, idx).split("\n").length - 1;
    }
    const author = this.getAuthor();
    const mentions = this.parseMentionsFromText(text);

    await this.store.addComment(mdView.file.path, selection, text, lineNumber, author, mentions);

    new Notice("댓글이 추가되었습니다.");
    this.refreshPanel();

    if (this.settings.notifyOnComment && mentions.length > 0) {
      await this.notifyMentionedMembers(mentions, mdView.file, text, selection, author);
    }
  }

  // ── Body @mention detection ──

  async checkBodyMentions(file: TFile, manual = false): Promise<void> {
    const content = await this.app.vault.cachedRead(file);
    const currentMentions = this.parseMentionsFromText(content);
    const previousMentions = this.mentionRecord[file.path] ?? [];
    const newMentions = currentMentions.filter((name) => !previousMentions.includes(name));

    if (newMentions.length === 0) {
      if (manual) new Notice("새로운 멘션이 없습니다.");
      return;
    }

    const author = this.getAuthor();
    let sentCount = 0;

    for (const name of newMentions) {
      const member = this.settings.members.find((m) => m.name === name);
      if (!member) continue;

      const success = await sendNotification({
        to: member,
        documentTitle: file.basename,
        commentText: this.extractContextLine(content, name),
        contextText: "",
        obsidianUri: this.buildObsidianUri(file.path),
        author,
      });
      if (success) sentCount++;
    }

    this.mentionRecord = { ...this.mentionRecord, [file.path]: currentMentions };
    await this.saveSettings();

    if (sentCount > 0) new Notice(`알림 ${sentCount}건 전송 완료`);
  }

  private async notifyMentionedMembers(
    mentions: string[], file: TFile, commentText: string, selectedText: string, author: string
  ): Promise<void> {
    let sentCount = 0;
    const obsidianUri = this.buildObsidianUri(file.path);

    for (const name of mentions) {
      const member = this.settings.members.find((m) => m.name === name);
      if (!member) continue;

      const success = await sendNotification({
        to: member,
        documentTitle: file.basename,
        commentText,
        contextText: selectedText.length > 100 ? selectedText.slice(0, 100) + "..." : selectedText,
        obsidianUri,
        author,
      });
      if (success) sentCount++;
    }

    if (sentCount > 0) new Notice(`알림 ${sentCount}건 전송 완료`);
  }

  // ── Parsing ──

  parseMentionsFromText(text: string): string[] {
    const memberNames = this.settings.members.map((m) => m.name).filter(Boolean);
    if (memberNames.length === 0) return [];

    const found: string[] = [];
    for (const name of memberNames) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`@${escaped}(?=[\\s,.)\\]:]|$)`, "g").test(text)) {
        found.push(name);
      }
    }
    return [...new Set(found)];
  }

  private extractContextLine(content: string, memberName: string): string {
    const line = content.split("\n").find((l) => l.includes(`@${memberName}`));
    if (!line) return "";
    const trimmed = line.trim();
    return trimmed.length > 200 ? trimmed.slice(0, 200) + "..." : trimmed;
  }

  // ── Helpers ──

  buildObsidianUri(filePath: string): string {
    return `obsidian://open?vault=${encodeURIComponent(this.app.vault.getName())}&file=${encodeURIComponent(filePath)}`;
  }

  getAuthor(): string {
    const parts = (this.app.vault.adapter as any).getBasePath().split(/[\\/]/);
    const idx = parts.findIndex((p: string) => p.toLowerCase() === "users");
    return (idx >= 0 && idx + 1 < parts.length) ? parts[idx + 1] : "unknown";
  }

  private promptInput(placeholder: string): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = new (class extends (require("obsidian") as any).Modal {
        result: string | null = null;
        onOpen() {
          const { contentEl } = this;
          contentEl.createEl("h4", { text: placeholder });
          const input = contentEl.createEl("textarea", { cls: "sg-input" });
          input.rows = 3;
          input.focus();
          const btnRow = contentEl.createDiv({ cls: "sg-btn-row" });
          const ok = btnRow.createEl("button", { text: "확인", cls: "mod-cta" });
          const cancel = btnRow.createEl("button", { text: "취소" });
          ok.addEventListener("click", () => { this.result = input.value; this.close(); });
          cancel.addEventListener("click", () => { this.close(); });
          input.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { this.result = input.value; this.close(); }
          });
        }
        onClose() { resolve(this.result); }
      })(this.app);
      modal.open();
    });
  }

  // ── Persistence ──

  async loadSettings(): Promise<void> {
    const data = await this.loadData();
    const raw = (data?.settings ?? {}) as Record<string, unknown>;

    if (typeof raw.membersSection === "string" && !Array.isArray(raw.membersSections)) {
      const isOnLegacyDefault = !raw.membersSourceFile || raw.membersSourceFile === LEGACY_SOURCE_FILE;
      if (isOnLegacyDefault) {
        raw.membersSourceFile = DEFAULT_SETTINGS.membersSourceFile;
        raw.membersSections = DEFAULT_SETTINGS.membersSections;
      } else {
        raw.membersSections = [raw.membersSection];
      }
      delete raw.membersSection;
    }

    this.settings = { ...DEFAULT_SETTINGS, ...(raw as Partial<PluginSettings>) };
    this.mentionRecord = data?.mentionRecord ?? {};
  }

  async saveSettings(): Promise<void> {
    await this.saveData({ settings: this.settings, mentionRecord: this.mentionRecord });
  }
}
