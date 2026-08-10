# Automated test matrix

이 문서는 현재 자동화된 범위와 구현 대기 범위를 분리해서 추적합니다.

## Implemented now

- `src/domain/transaction.test.ts`
  - 지출 sign 변환
  - 수입 sign 변환
  - legacy 거래유형 inference
  - UI 양수 normalization
- `src/domain/budget.test.ts`
  - 예산 이월
  - 예산 초과
  - 수동조정
  - 0월 carry-over
  - 이월 초기화
  - 다음 달 예상
  - 수입/이체 제외 예산 사용액 계산
- `src/utils/date.test.ts`
  - 한국시간 날짜 변환
  - legacy 날짜 parsing
  - 날짜 -> 연도/월 매핑
  - 월 범위 검증
- `src/utils/sheets.test.ts`
  - A1 range helper
  - row number/range helper
- `src/services/env.test.ts`
  - 필수 env 검증
- `src/services/googleAuth/tokenStore.test.ts`
  - 로그인 필요
  - 토큰 만료
  - 메모리 저장/clear
- `src/services/googleAuth/googleIdentityService.test.ts`
  - GIS unavailable
  - 성공 토큰 획득
  - scope fallback
  - GIS 오류 매핑
- `src/services/sheets/sheetsClient.test.ts`
  - Authorization header
  - read retry
  - write no-retry
  - 401 만료 처리
  - 403 오류 처리
  - 최종 network error
  - 204 mutation 처리

## Repository and UI integration coverage

- `src/repositories/googleSheetsLedgerRepository.test.ts`
  - signed transaction append와 stable request ID 재시도
  - transfer 2행 append/동일 ID/논리 거래 collapse
  - transfer 재시도 중복 방지와 같은 달 2행 동시 수정
  - metadata 후속 기록 실패 시 재-append 금지 안내
  - 거래ID 우선 재탐색, stale row 회귀, legacy optimistic concurrency
  - 월 이동 수정 실패 후 재시도 중복 방지
  - transaction/transfer 삭제
  - 통장/카테고리 load, rename 범위, 사용중지
  - 연도 그래프, 인접 연도 연결, linked TEST write guard
  - `12월 -> 0월` 거래 snapshot과 예산 잔여 동기화
  - `0!AB:AC` 시작잔액 기반 정산과 optional 투자/에너지 graceful failure
- `src/services/sheets/schema.test.ts`
  - 필수 탭, year/schemaVersion, 연결 설정 parsing
- `src/features/transactions/TransactionForm.test.tsx`
  - 필수값 전 save disabled
  - 저장 후 날짜/통장 유지와 금액/내용/카테고리 초기화

## Live-only verification

자동화만으로 대체할 수 없는 항목:

- 실제 Google OAuth
- 실제 TEST Spreadsheet read/write
- 다중 사용자 동시 append
- iPhone Safari / Android Chrome / 설치 PWA 검증
