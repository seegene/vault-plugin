# Seegene Vault — Obsidian Plugin

씨젠 SW연구소 공용 볼트 플러그인. 문서 댓글, `@`멘션 알림, `.url` 파일 처리를 한 플러그인으로 묶음.

## 설치 (BRAT)

1. Obsidian에서 **Community Plugins → Browse**로 [BRAT](https://github.com/TfTHacker/obsidian42-brat)을 설치하고 활성화.
2. 명령 팔레트(`Ctrl+P`) → `BRAT: Add a beta plugin for testing`.
3. 입력란에 다음 입력:

   ```
   seegene/vault-plugin-seegene
   ```

4. **Add Plugin** 클릭 → BRAT가 최신 GitHub Release에서 `main.js`/`manifest.json`/`styles.css`를 받아 자동 설치.
5. **Community Plugins** 목록에서 **Seegene Vault** 활성화.

업데이트는 BRAT가 자동 감지해서 알림으로 띄워준다. 수동으로 즉시 확인하려면: `BRAT: Check for updates for all beta plugins`.

## 기능

| 기능 | 사용법 |
|------|--------|
| 문서 댓글 | 텍스트 선택 → 명령 팔레트 → `Add comment` (또는 좌측 리본의 말풍선 아이콘) |
| `@`멘션 자동완성 | 본문/댓글에서 `@` 입력 시 설정에 등록된 멤버 목록이 뜸 |
| 멘션 알림 | 본문에 `@이름` 추가 시 이메일/Teams 알림 전송 (3초 debounce) |
| `.url` 파일 열기 | `.url` 파일 클릭 시 외부 브라우저로 자동 송출 |

## 설정

**Settings → Seegene Vault**에서:

- **Members** — 이름/이메일 등록. `@` 자동완성과 알림 발송 대상.
- **Notify on comment** — 댓글에 멘션 포함 시 알림 전송 여부.
- **Notify on mention** — 본문 멘션 변경 시 알림 전송 여부.

## 개발

```powershell
npm install
npm run dev               # 1회 빌드 (watch X)
npm run build             # production minify 빌드

# 로컬 볼트에 즉시 설치 (개발용)
$env:OBSIDIAN_VAULT_PATH = "C:\Users\<you>\OneDrive - ㈜씨젠\SW연구소 - obsidian"
npm run install-plugin
```

## 릴리스

`manifest.json`의 `version`을 올린 뒤 동일한 값으로 태그를 푸시한다.

```powershell
# 예: 0.1.1 릴리스
# 1) manifest.json version을 "0.1.1"로 수정 후 커밋
git commit -am "chore: bump version to 0.1.1"
git tag 0.1.1
git push && git push --tags
```

GitHub Actions가 빌드 후 Release를 생성하고 `main.js`/`manifest.json`/`styles.css`를 에셋으로 업로드한다. BRAT 사용자에게는 자동으로 업데이트 알림이 간다.

> 태그 이름은 **`v` 없이** manifest.json의 version과 정확히 일치해야 한다 (예: `0.1.0`, `1.2.3`). 다르면 Actions가 실패한다.
