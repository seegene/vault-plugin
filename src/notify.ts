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

  const fileMatch = obsidianUri.match(/file=([^&]+)/);
  const filePath = fileMatch ? decodeURIComponent(fileMatch[1]) : documentTitle;

  const folderPath = filePath.substring(0, filePath.lastIndexOf("/"));
  const encodedFolder = folderPath.split("/").map(encodeURIComponent).join("/");
  const sharepointFolder = `https://seegene.sharepoint.com/SW/${encodedFolder}`;

  const body = [
    `${author}님이 "${documentTitle}" 문서에서 회원님을 멘션했습니다.`,
    ``,
    `댓글: ${commentText}`,
    cleanContext ? `대상 텍스트: ${cleanContext}` : "",
    ``,
    `[Obsidian에서 열기] Ctrl+O > "${documentTitle}" 검색`,
    `[SharePoint 폴더] ${sharepointFolder}`,
  ].filter(Boolean).join("\r\n");

  return sendViaOutlook(to.email, subject, body);
}

function sendViaOutlook(to: string, subject: string, body: string): Promise<boolean> {
  return new Promise((resolve) => {
    const eTo = to.replace(/'/g, "''");
    const eSubject = subject.replace(/'/g, "''");
    const eBody = body.replace(/'/g, "''");

    const psScript = [
      "$ol = New-Object -ComObject Outlook.Application",
      "$ns = $ol.GetNamespace('MAPI')",
      "$mail = $ol.CreateItem(0)",
      `$mail.To = '${eTo}'`,
      `$mail.Subject = '${eSubject}'`,
      `$mail.Body = '${eBody}'`,
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
          console.error("Seegene Vault: Outlook send failed", error);
          new Notice("메일 전송 실패: Outlook이 실행 중인지 확인하세요");
          resolve(false);
        } else {
          resolve(true);
        }
      }
    );
  });
}
