import { App, PluginSettingTab, Setting } from "obsidian";
import type SeegeneVaultPlugin from "./main";
import { TeamMember } from "./types";

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
      .addToggle((t) => t.setValue(this.plugin.settings.notifyOnComment).onChange(async (v) => {
        this.plugin.settings.notifyOnComment = v;
        await this.plugin.saveSettings();
      }));

    new Setting(containerEl)
      .setName("본문 @멘션 알림")
      .setDesc("문서 본문에 새로운 @멘션 작성 시 알림")
      .addToggle((t) => t.setValue(this.plugin.settings.notifyOnMention).onChange(async (v) => {
        this.plugin.settings.notifyOnMention = v;
        await this.plugin.saveSettings();
      }));

    containerEl.createEl("h3", { text: "구성원 목록" });
    containerEl.createEl("p", { text: "@ 자동완성 및 알림 대상입니다.", cls: "setting-item-description" });

    this.plugin.settings.members.forEach((member, index) => {
      new Setting(containerEl)
        .addText((t) => t.setPlaceholder("이름").setValue(member.name).onChange(async (v) => {
          const updated = [...this.plugin.settings.members];
          updated[index] = { ...updated[index], name: v };
          this.plugin.settings.members = updated;
          await this.plugin.saveSettings();
        }))
        .addText((t) => t.setPlaceholder("email@seegene.com").setValue(member.email).onChange(async (v) => {
          const updated = [...this.plugin.settings.members];
          updated[index] = { ...updated[index], email: v };
          this.plugin.settings.members = updated;
          await this.plugin.saveSettings();
        }))
        .addButton((b) => b.setIcon("trash").setTooltip("삭제").onClick(async () => {
          this.plugin.settings.members = this.plugin.settings.members.filter((_, i) => i !== index);
          await this.plugin.saveSettings();
          this.display();
        }));
    });

    new Setting(containerEl).addButton((b) =>
      b.setButtonText("+ 구성원 추가").setCta().onClick(async () => {
        this.plugin.settings.members = [...this.plugin.settings.members, { name: "", email: "" }];
        await this.plugin.saveSettings();
        this.display();
      })
    );
  }
}
