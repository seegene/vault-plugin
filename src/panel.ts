import { ItemView, WorkspaceLeaf, MarkdownView, setIcon } from "obsidian";
import type SeegeneVaultPlugin from "./main";
import { Comment, DocumentComments } from "./types";

export const VIEW_TYPE = "seegene-comments-panel";

export class CommentPanelView extends ItemView {
  plugin: SeegeneVaultPlugin;
  private refreshVersion = 0;

  constructor(leaf: WorkspaceLeaf, plugin: SeegeneVaultPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return VIEW_TYPE; }
  getDisplayText(): string { return "Comments"; }
  getIcon(): string { return "message-square"; }

  async onOpen(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const version = ++this.refreshVersion;
    const file = this.plugin.lastActiveFile;
    const filePath = file?.path ?? null;

    let doc: DocumentComments | null = null;
    if (filePath) {
      doc = await this.plugin.store.load(filePath);
    }

    if (version !== this.refreshVersion) return;

    const container = this.contentEl;
    container.empty();

    if (!filePath || !file) {
      container.createEl("p", { text: "문서를 열면 댓글이 표시됩니다.", cls: "sg-empty" });
      return;
    }

    const header = container.createDiv({ cls: "sg-header" });
    header.createEl("h4", { text: file.basename });
    const addBtn = header.createEl("button", { cls: "sg-add-btn" });
    setIcon(addBtn, "plus");
    addBtn.appendText(" 댓글 추가");
    addBtn.addEventListener("click", () => this.plugin.addCommentFromSelection());

    if (!doc || doc.comments.length === 0) {
      const guide = container.createDiv({ cls: "sg-empty" });
      guide.createEl("p", { text: "댓글이 없습니다." });
      guide.createEl("p", { text: "사용법:" });
      const steps = guide.createEl("ol");
      steps.createEl("li", { text: "에디터에서 텍스트를 드래그 선택" });
      steps.createEl("li", { text: "위의 [+ 댓글 추가] 클릭" });
      steps.createEl("li", { text: "또는 Ctrl+P > 'Add comment'" });
      return;
    }

    const active = doc.comments.filter((c) => !c.resolved);
    const resolved = doc.comments.filter((c) => c.resolved);

    if (active.length > 0) {
      const section = container.createDiv({ cls: "sg-section" });
      active.forEach((c) => this.renderComment(section, c, filePath));
    }

    if (resolved.length > 0) {
      const section = container.createDiv({ cls: "sg-section" });
      const toggle = section.createEl("details");
      toggle.createEl("summary", { text: `해결됨 (${resolved.length})`, cls: "sg-resolved-header" });
      const list = toggle.createDiv();
      resolved.forEach((c) => this.renderComment(list, c, filePath));
    }
  }

  private renderComment(parent: HTMLElement, comment: Comment, filePath: string): void {
    const card = parent.createDiv({ cls: `sg-card ${comment.resolved ? "sg-resolved" : ""}` });

    if (comment.selectedText) {
      const quote = card.createDiv({ cls: "sg-quote" });
      quote.setText(comment.selectedText.length > 100
        ? comment.selectedText.slice(0, 100) + "..." : comment.selectedText);
      quote.addEventListener("click", () => this.navigateToLine(comment));
    }

    const body = card.createDiv({ cls: "sg-body" });
    const meta = body.createDiv({ cls: "sg-meta" });
    meta.createSpan({ text: comment.author, cls: "sg-author" });
    meta.createSpan({ text: formatTime(comment.timestamp), cls: "sg-time" });
    body.createDiv({ text: comment.text, cls: "sg-text" });

    if (comment.replies.length > 0) {
      const repliesEl = card.createDiv({ cls: "sg-replies" });
      for (const reply of comment.replies) {
        const replyEl = repliesEl.createDiv({ cls: "sg-reply" });
        const replyMeta = replyEl.createDiv({ cls: "sg-meta" });
        replyMeta.createSpan({ text: reply.author, cls: "sg-author" });
        replyMeta.createSpan({ text: formatTime(reply.timestamp), cls: "sg-time" });
        replyEl.createDiv({ text: reply.text, cls: "sg-text" });
      }
    }

    const actions = card.createDiv({ cls: "sg-actions" });
    const replyBtn = actions.createEl("button", { text: "답글", cls: "sg-action-btn" });
    replyBtn.addEventListener("click", () => this.promptReply(filePath, comment.id));

    const resolveBtn = actions.createEl("button", {
      text: comment.resolved ? "다시 열기" : "해결", cls: "sg-action-btn",
    });
    resolveBtn.addEventListener("click", async () => {
      await this.plugin.store.toggleResolved(filePath, comment.id);
      await this.refresh();
    });

    const deleteBtn = actions.createEl("button", { text: "삭제", cls: "sg-action-btn sg-delete" });
    deleteBtn.addEventListener("click", async () => {
      await this.plugin.store.deleteComment(filePath, comment.id);
      await this.refresh();
    });
  }

  private async promptReply(filePath: string, commentId: string): Promise<void> {
    const text = await inputPrompt(this.app, "답글 입력");
    if (!text) return;
    await this.plugin.store.addReply(filePath, commentId, text, this.plugin.getAuthor());
    await this.refresh();
  }

  private navigateToLine(comment: Comment): void {
    const mdView = this.plugin.getMarkdownView();
    if (!mdView) return;
    if (this.plugin.lastActiveLeaf) {
      this.app.workspace.setActiveLeaf(this.plugin.lastActiveLeaf, { focus: true });
    }
    const editor = mdView.editor;
    const content = editor.getValue();
    const idx = content.indexOf(comment.selectedText);
    if (idx >= 0) {
      const pos = editor.offsetToPos(idx);
      editor.setCursor(pos);
      editor.scrollIntoView({ from: pos, to: pos }, true);
    } else {
      const pos = { line: Math.min(comment.lineNumber, editor.lineCount() - 1), ch: 0 };
      editor.setCursor(pos);
      editor.scrollIntoView({ from: pos, to: pos }, true);
    }
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = d.getHours().toString().padStart(2, "0");
  const min = d.getMinutes().toString().padStart(2, "0");
  return `${month}/${day} ${hour}:${min}`;
}

function inputPrompt(app: import("obsidian").App, placeholder: string): Promise<string | null> {
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
    })(app);
    modal.open();
  });
}
