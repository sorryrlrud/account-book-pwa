# account-book-pwa

Google Spreadsheet를 Source of Truth로 사용하는 모바일 우선 가계부 PWA입니다.

> 개발 및 테스트 중에는 실제 2026 가계부 원본을 절대 연결하거나 수정하지 않습니다.
> 
> `VITE_TEST_SPREADSHEET_ID`가 없거나 bootstrap ID와 일치하지 않으면 모든 쓰기 작업이 차단됩니다.

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

환경설정과 Google OAuth/TEST Sheet 준비 절차는 구현 완료 후 이 문서에 상세히 추가합니다.
