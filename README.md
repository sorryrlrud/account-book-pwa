# account-book-pwa

Google Spreadsheet를 Source of Truth로 사용하는 모바일 우선 가계부 PWA입니다.

핵심 원칙:

- Google Sheet는 사용자가 직접 읽고 수정하는 원장이다.
- 웹앱은 원장을 대체하지 않는다.
- 별도 서버 DB를 두지 않는다.
- 현재 배포는 연결된 TEST 가계부를 두 명이 함께 사용하는 운영 환경이다.

## Operating assumptions

현재 운영 전제:

- GitHub Pages의 정적 앱 자체는 공개되어 있다.
- 실제 가계부 데이터는 Google OAuth와 Spreadsheet 공유 권한으로 보호한다.
- 연결된 TEST Spreadsheet에 권한이 있는 두 Google 계정만 데이터를 읽고 쓸 수 있다.
- `VITE_BOOTSTRAP_SPREADSHEET_ID`는 현재 사용하는 TEST 사본을 가리킨다.
- 로그인·접근 권한·schema validation이 통과하면 해당 TEST 사본의 일상적인 read/write를 허용한다.

계속 유지하는 안전 규칙:

- `VITE_GOOGLE_CLIENT_ID`는 public identifier이며 secret이 아니다.
- Client Secret, refresh token, 비밀번호는 저장하지 않는다.
- 단기 access token은 새로고침 복구를 위해 현재 탭의 `sessionStorage`에만 저장하고,
  탭을 닫거나 로그아웃하거나 토큰이 만료되면 제거한다.
- `.env.local`은 git에 추가하지 않는다.
- 실패 여부가 모호한 금융 write를 자동 재실행하지 않는다.
- 삭제·일괄 변경·이월 초기화·0월 동기화 같은 파괴적 또는 광범위한 작업은 확인 절차를 유지한다.
- 사용자가 명시적으로 지정하지 않은 실제 원본 Spreadsheet로 연결 대상을 바꾸지 않는다.

## Requirements

- Node.js 24 이상
- npm 10 이상
- Google 계정
- Google Cloud Project
- Google Sheets API 활성화
- TEST용 Google Spreadsheet 사본

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

기본 점검:

```bash
npm run lint
npm run test
npm run build
```

## Environment variables

`.env.example`을 기준으로 `.env.local`을 만듭니다.

```dotenv
VITE_GOOGLE_CLIENT_ID=
VITE_BOOTSTRAP_SPREADSHEET_ID=
VITE_BASE_PATH=/
```

설명:

- `VITE_GOOGLE_CLIENT_ID`: Google Identity Services Web OAuth client ID
- `VITE_BOOTSTRAP_SPREADSHEET_ID`: 연도 연결 그래프를 시작하는 bootstrap Spreadsheet ID
- `VITE_BASE_PATH`: GitHub Pages sub-path. 로컬에서는 `/`, Pages에서는 `/account-book-pwa/`

## Google Cloud setup

1. Google Cloud Console에서 새 project를 만든다.
2. `APIs & Services > Library`에서 `Google Sheets API`를 활성화한다.
3. `APIs & Services > Credentials`에서 `OAuth client ID`를 생성한다.
4. Application type은 `Web application`을 사용한다.
5. Authorized JavaScript origins에 아래 값을 등록한다.

```text
http://localhost:5173
https://sorryrlrud.github.io
```

6. 발급된 Client ID를 `VITE_GOOGLE_CLIENT_ID`에 넣는다.
7. Client Secret은 이 프로젝트에서 사용하지 않으므로 저장하지 않는다.

참고:

- GitHub Pages는 origin 단위로 등록한다. repository path는 origin에 포함하지 않는다.
- 이 앱은 backend redirect flow가 아니라 browser token flow를 전제로 한다.
- 이메일 scope는 요청하지 않으며 설정 화면에는 Google 계정의 연결 상태만 표시한다.

## Google Spreadsheet setup

새 TEST 환경을 만들 때는 실제 원본을 복사해 TEST 사본을 만듭니다. 현재 운영에서는 이미 연결된 TEST 사본을 그대로 사용합니다.

예시:

```text
가계부_2026
  -> 복사
가계부_2026_TEST
```

그 다음:

1. TEST 사본 URL에서 Spreadsheet ID를 확인한다.
2. `VITE_BOOTSTRAP_SPREADSHEET_ID`에 TEST ID를 넣는다.
3. 앱으로 사용할 Google 계정에 TEST Spreadsheet 편집 권한을 공유한다.
4. TEST 사본의 `앱설정`에 `environment = TEST`를 기록한다.
5. 원본 Spreadsheet에는 앱 테스트 계정을 공유하지 않는 편이 안전하다.

자세한 구조는 [docs/sheet-schema.md](./docs/sheet-schema.md)를 참고하세요.

## TEST workbook operations

현재 연결된 TEST workbook에서는 정상적인 앱 read/write와 필요한 마이그레이션을 허용합니다.

- 원본 Spreadsheet ID를 기본값으로 넣거나 자동 탐색하지 않는다.
- write는 로그인·접근 권한·시트 구조 검증이 완료된 설정 대상에 즉시 반영된다.
- `앱설정.environment = TEST`는 환경을 설명하는 메타데이터이며 별도의 write 허용 조건은 아니다.
- 자동 마이그레이션으로 기존 수식/우측 집계 영역을 삭제하지 않는다.
- 0월 sync는 `전년도 12월 -> 현재년도 0월` 단방향만 허용한다.

마이그레이션 절차는 [docs/test-sheet-migration.md](./docs/test-sheet-migration.md)를 따릅니다.

## GitHub Pages deployment

이 저장소의 유일한 운영 배포 대상은 GitHub Pages다. ChatGPT Sites를 사용하지 않는다.

필요한 GitHub Repository Variables:

- `VITE_GOOGLE_CLIENT_ID`
- `VITE_BOOTSTRAP_SPREADSHEET_ID`

설정 절차:

1. GitHub repository 생성 후 `Settings > Pages`에서 `GitHub Actions`를 선택한다.
2. `Settings > Secrets and variables > Actions > Variables`에 위 2개 값을 넣는다.
3. `main` 브랜치에 push 하면 `.github/workflows/deploy-pages.yml`이 build/test 후 Pages에 배포한다.

배포 시:

- base path는 `/account-book-pwa/`
- manifest `start_url`은 `#/entry`
- service worker scope는 repository sub-path 기준
- 상단 버전은 배포 빌드 시점의 한국 시간으로 `vYYMMDD.HHMMSS` 형식으로 자동 생성

운영 URL: `https://sorryrlrud.github.io/account-book-pwa/`

## PWA and mobile verification

실제 설치/기기 검증은 외부 환경이 필요하므로 로컬 CI만으로 완료되지 않습니다. 체크리스트는 [docs/live-test-checklist.md](./docs/live-test-checklist.md)를 사용하세요.

최소 수동 검증 대상:

- iPhone Safari
- iPhone 설치 PWA
- Android Chrome
- Android 설치 PWA

## Documentation index

- [docs/sheet-schema.md](./docs/sheet-schema.md)
- [docs/test-sheet-migration.md](./docs/test-sheet-migration.md)
- [docs/live-test-checklist.md](./docs/live-test-checklist.md)

## Current status

현재 구현 범위:

- GIS OAuth token flow, Spreadsheet 접근 판정, schema/연도 그래프 검증
- 인증·접근 권한·시트 구조 검증 후 거래 및 설정 쓰기
- 지출·수입·이체 append, idempotent retry, 수정·이동·삭제, legacy 충돌 확인
- 월별 내역 검색/필터와 모바일 거래 입력 UI
- 월별 최대 예산과 카테고리 할당 편집, 순서 변경·추가·비활성화, 잔여/초과 자동 이월과 입력 중 잔여 표시
- 통장·카테고리·연도 연결 관리와 거래명 일괄 변경
- 12월 거래 및 예산 잔여를 반영하는 단방향 0월 snapshot 업데이트
- 정산 및 조회 전용 투자·에너지 adapter
- GitHub Pages sub-path 대응 PWA와 Actions 자동 배포

자동 검증은 `npm run check`로 lint, unit/integration test, production build를 실행합니다.

외부 환경 없이는 보장할 수 없는 범위:

- 실제 Google credentials 없는 live verification
- 실기기 설치 검증
- 실제 투자/에너지 탭 구조 확정 검증
