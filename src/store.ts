import { Vault } from "obsidian";
import { Comment, DocumentComments, Reply } from "./types";

const COMMENTS_DIR = ".comments";

export class CommentStore {
  private vault: Vault;

  constructor(vault: Vault) {
    this.vault = vault;
  }

  async load(filePath: string): Promise<DocumentComments> {
    const jsonPath = this.toJsonPath(filePath);
    try {
      const raw = await this.vault.adapter.read(jsonPath);
      return JSON.parse(raw) as DocumentComments;
    } catch {
      return { filePath, comments: [] };
    }
  }

  async save(doc: DocumentComments): Promise<void> {
    const jsonPath = this.toJsonPath(doc.filePath);
    const dir = jsonPath.substring(0, jsonPath.lastIndexOf("/"));
    if (!(await this.vault.adapter.exists(dir))) {
      await this.vault.adapter.mkdir(dir);
    }
    await this.vault.adapter.write(jsonPath, JSON.stringify(doc, null, 2));
  }

  async addComment(filePath: string, selectedText: string, text: string, lineNumber: number, author: string, mentions: string[] = []): Promise<Comment> {
    const doc = await this.load(filePath);
    const comment: Comment = {
      id: generateId(),
      author,
      text,
      timestamp: new Date().toISOString(),
      selectedText,
      lineNumber,
      resolved: false,
      replies: [],
      mentions,
      notifiedTo: [],
    };
    await this.save({ ...doc, comments: [...doc.comments, comment] });
    return comment;
  }

  async addReply(filePath: string, commentId: string, text: string, author: string): Promise<Reply | null> {
    const doc = await this.load(filePath);
    const comment = doc.comments.find((c) => c.id === commentId);
    if (!comment) return null;

    const reply: Reply = {
      id: generateId(),
      author,
      text,
      timestamp: new Date().toISOString(),
    };

    const updatedComments = doc.comments.map((c) =>
      c.id === commentId ? { ...c, replies: [...c.replies, reply] } : c
    );
    await this.save({ ...doc, comments: updatedComments });
    return reply;
  }

  async toggleResolved(filePath: string, commentId: string): Promise<void> {
    const doc = await this.load(filePath);
    const updatedComments = doc.comments.map((c) =>
      c.id === commentId ? { ...c, resolved: !c.resolved } : c
    );
    await this.save({ ...doc, comments: updatedComments });
  }

  async deleteComment(filePath: string, commentId: string): Promise<void> {
    const doc = await this.load(filePath);
    await this.save({ ...doc, comments: doc.comments.filter((c) => c.id !== commentId) });
  }

  private toJsonPath(mdPath: string): string {
    const base = mdPath.replace(/\.md$/, ".json");
    return `${COMMENTS_DIR}/${base}`;
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
