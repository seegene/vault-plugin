import { App, PluginSettingTab, Setting } from "obsidian";
import type SeegeneVaultPlugin from "./main";

export class SeegeneSettingTab extends PluginSettingTab {
  plugin: SeegeneVaultPlugin;

  constructor(app: App, plugin: SeegeneVaultPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h3", { text: "알림 설정" });
    containerEl.createEl("p", {
      text: "Outlook을 통해 이메일로 알림을 전송합니다. Outlook이 실행 중이어야 합니다.",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("댓글 추가 시 알림")
      .setDesc("댓글에 @멘션이 포함되면 해당 구성원에게 Outlook 메일 발송")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.notifyOnComment).onChange(async (v) => {
          this.plugin.settings.notifyOnComment = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("본문 @멘션 알림")
      .setDesc("문서 본문에 새로운 @멘션 작성 시 알림")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.notifyOnMention).onChange(async (v) => {
          this.plugin.settings.notifyOnMention = v;
          await this.plugin.saveSettings();
        })
      );

    containerEl.createEl("h3", { text: "구성원 소스" });
    containerEl.createEl("p", {
      text: "지정한 마크다운 파일의 표에서 구성원을 자동으로 읽어옵니다. 파일이 변경되면 자동 새로고침됩니다.",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("소스 파일 경로")
      .setDesc("볼트 기준 상대 경로 (예: 연구소 생활/for-ai/조직구조.md)")
      .addText((t) =>
        t
          .setPlaceholder("연구소 생활/for-ai/조직구조.md")
          .setValue(this.plugin.settings.membersSourceFile)
          .onChange(async (v) => {
            this.plugin.settings.membersSourceFile = v.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("섹션 이름 (한 줄에 하나)")
      .setDesc(
        "이 헤딩들 아래에서 멤버를 추출합니다. 표 / bullet 리스트 자동 감지. '### Core개발팀 (팀장: 박영우)' 헤딩은 'Core개발팀'으로 매칭됩니다."
      )
      .addTextArea((t) => {
        t.setPlaceholder("SW연구소\nSW기술랩\n...")
          .setValue(this.plugin.settings.membersSections.join("\n"))
          .onChange(async (v) => {
            this.plugin.settings.membersSections = v
              .split(/\r?\n/)
              .map((s) => s.trim())
              .filter(Boolean);
            await this.plugin.saveSettings();
          });
        t.inputEl.rows = 10;
        t.inputEl.style.width = "100%";
        t.inputEl.style.fontFamily = "var(--font-monospace)";
      });

    new Setting(containerEl).addButton((b) =>
      b
        .setButtonText("지금 새로고침")
        .setCta()
        .onClick(async () => {
          await this.plugin.refreshOrgMembers(true);
          this.display();
        })
    );

    const members = this.plugin.settings.members;
    containerEl.createEl("h3", { text: `현재 인식된 구성원 (${members.length}명)` });

    if (members.length === 0) {
      containerEl.createEl("p", {
        text: "구성원이 없습니다. 소스 파일 경로와 섹션 이름을 확인하고 '지금 새로고침'을 눌러주세요.",
        cls: "setting-item-description",
      });
      return;
    }

    const list = containerEl.createDiv({ cls: "sg-member-list" });
    for (const m of members) {
      const row = list.createDiv({ cls: "sg-member-row" });
      row.createSpan({ cls: "sg-member-name", text: m.name });
      if (m.position) row.createSpan({ cls: "sg-member-position", text: m.position });
      row.createSpan({ cls: "sg-member-email", text: m.email });
    }
  }
}
