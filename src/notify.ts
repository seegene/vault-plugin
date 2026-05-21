import { Notice } from "obsidian";
import { TeamMember } from "./types";

export interface NotifyParams {
  to: TeamMember;
  documentTitle: string;
  commentText: string;
  contextText: string;
  obsidianUri: string;
  author: string;
}

export async function sendNotification(params: NotifyParams): Promise<boolean> {
  const { to, documentTitle, commentText, contextText, obsidianUri, author } = params;

  const subject = `[문서 댓글] ${author}님이 "${documentTitle}"에서 멘션했습니다`;

  const cleanContext = contextText
    ? contextText.replace(/https?:\/\/\S+/g, "[링크]")
    : "";

  const eAuthor = htmlEscape(author);
  const eTitle = htmlEscape(documentTitle);
  const eComment = htmlEscape(commentText).replace(/\n/g, "<br>");
  const eContext = cleanContext ? htmlEscape(cleanContext) : "";
  const eUri = htmlEscape(obsidianUri);

  const htmlBody = `
<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#222;">
  <p>${eAuthor}님이 <b>"${eTitle}"</b> 문서에서 회원님을 멘션했습니다.</p>
  <p><b>댓글</b><br>${eComment}</p>
  ${eContext ? `<p><b>대상 텍스트</b><br><span style="color:#555;">${eContext}</span></p>` : ""}
  <p style="margin-top:16px;padding:12px;background:#f0f9ff;border-left:3px solid #0284c7;border-radius:4px;">
    <b style="color:#0284c7;">📎 첨부된 .url 파일을 더블클릭하면 Obsidian이 자동으로 열립니다.</b>
  </p>
  <p style="font-size:12px;color:#666;margin-top:12px;">또는 아래 주소를 복사 → Win+R(실행창)에 붙여넣기:</p>
  <pre style="font-family:Consolas,monospace;font-size:11px;color:#333;background:#f5f5f5;padding:8px;border-radius:4px;white-space:pre-wrap;word-break:break-all;margin:0;">${eUri}</pre>
</div>
`.trim();

  return sendViaOutlook(to.email, subject, htmlBody, obsidianUri, documentTitle);
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeFileName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 80) || "obsidian-link";
}

function sendViaOutlook(
  to: string,
  subject: string,
  htmlBody: string,
  obsidianUri: string,
  documentTitle: string
): Promise<boolean> {
  return new Promise((resolve) => {
    const os = require("os") as typeof import("os");
    const path = require("path") as typeof import("path");
    const fs = require("fs") as typeof import("fs");

    const safeName = sanitizeFileName(documentTitle);
    const urlFilePath = path.join(os.tmpdir(), `${safeName}.url`);
    const urlFileContent = `[InternetShortcut]\r\nURL=${obsidianUri}\r\n`;

    try {
      fs.writeFileSync(urlFilePath, urlFileContent, { encoding: "utf8" });
    } catch (e) {
      console.error("Seegene Vault Plugin: failed to write .url shortcut", e);
    }

    const eTo = to.replace(/'/g, "''");
    const eSubject = subject.replace(/'/g, "''");
    const eHtml = htmlBody.replace(/'/g, "''");
    const ePath = urlFilePath.replace(/'/g, "''");

    const psScript = [
      "$ol = New-Object -ComObject Outlook.Application",
      "$ns = $ol.GetNamespace('MAPI')",
      "$mail = $ol.CreateItem(0)",
      "$mail.BodyFormat = 2",
      `$mail.To = '${eTo}'`,
      `$mail.Subject = '${eSubject}'`,
      `$mail.HTMLBody = '${eHtml}'`,
      `try { $null = $mail.Attachments.Add('${ePath}') } catch {}`,
      "$sentFolder = $ns.GetDefaultFolder(5)",
      "$mail.SaveSentMessageFolder = $sentFolder",
      "$mail.Send()",
      `Remove-Item -LiteralPath '${ePath}' -ErrorAction SilentlyContinue`,
      "Write-Output 'OK'",
    ].join("; ");

    const encoded = Buffer.from(psScript, "utf16le").toString("base64");

    const { execFile } = require("child_process") as typeof import("child_process");
    execFile(
      "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
      { timeout: 20000 },
      (error: Error | null) => {
        if (error) {
          console.error("Seegene Vault Plugin: Outlook send failed", error);
          new Notice("메일 전송 실패: Outlook이 실행 중인지 확인하세요");
          try { fs.unlinkSync(urlFilePath); } catch { /* ignore */ }
          resolve(false);
        } else {
          resolve(true);
        }
      }
    );
  });
}
