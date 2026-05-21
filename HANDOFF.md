# vault-plugin-seegene — 작업 인계 메모

> 2026-05-21 작성. 이 폴더가 앞으로의 정식 작업 위치이고 GitHub에 연결돼 있다.
> 원본(`C:\Users\jhlee13\Documents\obsidian-seegene-vault`)은 아카이브 상태 — 새 작업은 이 폴더에서만 진행한다.

---

## 1. 폴더 정체

- **Git 리모트**: `https://github.com/seegene/vault-plugin-seegene.git`
- **현재 상태**: 빈 저장소 — 커밋 0개, `origin/main`은 아직 없음 (첫 푸시 시 생성됨)
- **로컬 브랜치**: `main` (origin/main 추적 설정만 있고 실제 원격 브랜치 없음)

## 2. 옮겨온 파일 (2026-05-21)

원본: `C:\Users\jhlee13\Documents\obsidian-seegene-vault`

복사함:
- `src/` — main.ts, notify.ts, panel.ts, settings.ts, store.ts, suggest.ts, types.ts (7개)
- `scripts/install.mjs`
- `esbuild.config.mjs`, `manifest.json`, `package.json`, `package-lock.json`, `styles.css`, `tsconfig.json`, `main.js`

복사 제외:
- `node_modules/` — `npm install`로 재생성

검증: `main.js` 16,751 bytes — 현재 옛 볼트(`커뮤니케이션 사이트 - SW연구소문서창고`)에 설치된 빌드와 바이트 단위로 동일.

## 3. 빌드 / 설치 워크플로우

```powershell
cd C:\Users\jhlee13\IdeaProjects\vault-plugin-seegene
npm install                 # 처음 한 번
npm run dev                 # 개발 빌드 (watch는 안 함, 한 번 빌드 후 종료)
npm run build               # production 빌드 (minify)
npm run install-plugin      # build + 볼트로 복사
```

번들러: esbuild — `src/main.ts` 진입, `main.js` 단일 파일 출력 (CJS, ES2022, treeShaking).

## 4. 미결정 사항 (첫 커밋 전에 결정 필요)

### 4-1. `scripts/install.mjs`의 볼트 경로

현재 하드코딩:
```js
const vaultBase = join(
  homedir(),
  "OneDrive - ㈜씨젠",
  "커뮤니케이션 사이트 - SW연구소문서창고"   // ← 옛 볼트
);
```

새 볼트는 `OneDrive - ㈜씨젠\SW연구소 - obsidian\`. 옛 볼트는 더 이상 정식 위치가 아니므로 갱신해야 한다.

선택지:
- (a) 옛 볼트만 유지 — 의미 없음, 제외 권장
- (b) **새 볼트로 단순 교체** — 권장. 짧고 명확.
- (c) 새 볼트 우선 + 옛 볼트 fallback — 양 볼트 사용자 모두 지원. 환경 셋업 스크립트와 동일한 패턴.

### 4-2. `main.js` 커밋 여부

- (a) 커밋 — Obsidian 커뮤니티 플러그인 release 관례. 사용자는 빌드 없이 릴리스 zip만 받으면 됨.
- (b) `.gitignore`로 제외 — 일반 TS 프로젝트 관례. 사용자/CI가 빌드 필요.

`.gitignore`도 아직 없음. (a)/(b) 선택 후 `.gitignore` 작성 필요.

### 4-3. `LICENSE`, `README.md`

둘 다 없음. 사내 사용 한정인지, 외부 공개도 고려하는지에 따라 결정.

## 5. 코드 구조 (src/)

| 파일 | 역할 |
|------|------|
| `main.ts` | 플러그인 엔트리. SeegeneVaultPlugin 클래스. 명령/리본/뷰 등록 |
| `types.ts` | PluginSettings, MentionRecord 등 타입 정의 |
| `store.ts` | CommentStore — `.comments/` 폴더에 댓글 JSON CRUD |
| `panel.ts` | CommentPanelView — 우측 사이드바 댓글 패널 UI |
| `suggest.ts` | MentionSuggest — `@` 입력 시 멤버 자동완성 |
| `settings.ts` | SeegeneSettingTab — 설정 탭 (멤버 목록, 알림 토글) |
| `notify.ts` | sendNotification — @멘션 발생 시 알림 전송 (이메일/Teams) |

매니페스트 ID: `seegene-vault` (단일 플러그인)
하지만 옛 볼트 `community-plugins.json`에는 `mention-notify`, `url-handler`, `doc-comments` 3개가 등록돼 있어 **번들 분리/통합 이력** 확인 필요:
- 2026-05-18: `obsidian-doc-comments`, `obsidian-mention-notify` 두 폴더로 분리 개발
- 2026-05-20: 단일 `seegene-vault`로 통합 빌드
- `community-plugins.json`의 3개 ID 등록은 통합 전 잔존물일 가능성 — 새 볼트(`SW연구소 - obsidian`)에 설치 시 `seegene-vault` 하나만 활성화하면 됨

## 6. 다음 단계 권장 순서

1. 4-1, 4-2 결정
2. `install.mjs` 경로 수정 (4-1 결과 반영)
3. `.gitignore` 작성 (4-2 결과 반영). 최소 `node_modules/`는 포함.
4. `npm install`로 의존성 재설치 후 `npm run build`로 빌드 검증
5. 첫 커밋 + `git push -u origin main`
6. 새 볼트(`SW연구소 - obsidian`)에 설치 — `npm run install-plugin`
7. 새 볼트에서 댓글/멘션 기능 동작 확인
8. 옛 볼트의 플러그인 폴더 정리 결정 (제거 vs 보존)

## 7. 참고: 옛 폴더 처리

검증 완료 후 다음 폴더들은 정리 가능:
- `C:\Users\jhlee13\Documents\obsidian-seegene-vault` — 본 폴더와 동일 내용 (원본)
- `C:\Users\jhlee13\Documents\obsidian-doc-comments` — 2026-05-18 1세대, 통합 전 분리 버전
- `C:\Users\jhlee13\Documents\obsidian-mention-notify` — 동상

새 폴더에서 빌드/설치/동작 검증이 끝나기 전까지는 삭제 보류 권장.
