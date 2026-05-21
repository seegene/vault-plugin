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
<div style="font-family:'Segoe UI',sans-serif;font-size:14px;line-height:1.6;color:#222;">
  <p>${eAuthor}님이 <b>"${eTitle}"</b> 문서에서 회원님을 멘션했습니다.</p>
  <p><b>댓글</b><br>${eComment}</p>
  ${eContext ? `<p><b>대상 텍스트</b><br><span style="color:#555;">${eContext}</span></p>` : ""}
  <p style="margin-top:20px;">
    <a href="${eUri}" style="display:inline-block;padding:10px 18px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:4px;font-weight:600;">
      Obsidian에서 열기
    </a>
  </p>
  <p style="color:#888;font-size:11px;margin-top:16px;">
    버튼이 열리지 않으면 Obsidian이 설치돼 있어야 합니다. 직접 검색: Ctrl+O → "${eTitle}"
  </p>
</div>
`.trim();

  return sendViaOutlook(to.email, subject, htmlBody);
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sendViaOutlook(to: string, subject: string, htmlBody: string): Promise<boolean> {
  return new Promise((resolve) => {
    const eTo = to.replace(/'/g, "''");
    const eSubject = subject.replace(/'/g, "''");
    const eHtml = htmlBody.replace(/'/g, "''");

    const psScript = [
      "$ol = New-Object -ComObject Outlook.Application",
      "$ns = $ol.GetNamespace('MAPI')",
      "$mail = $ol.CreateItem(0)",
      `$mail.To = '${eTo}'`,
      `$mail.Subject = '${eSubject}'`,
      `$mail.HTMLBody = '${eHtml}'`,
      "$sentFolder = $ns.GetDefaultFolder(5)",
      "$mail.SaveSentMessageFolder = $sentFolder",
      "$mail.Send()",
      "Write-Output 'OK'",
    ].join("; ");

    const encoded = Buffer.from(psScript, "utf16le").toString("base64");

    const { execFile } = require("child_process") as typeof import("child_process");
    execFile(
      "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
      { timeout: 15000 },
      (error: Error | null) => {
        if (error) {
          console.error("Seegene Vault Plugin: Outlook send failed", error);
          new Notice("메일 전송 실패: Outlook이 실행 중인지 확인하세요");
          resolve(false);
        } else {
          resolve(true);
        }
      }
    );
  });
}
