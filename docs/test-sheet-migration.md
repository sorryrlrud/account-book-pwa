# TEST sheet migration guide

이 문서는 실제 원본을 보호하면서 TEST 사본으로만 앱을 검증하기 위한 절차입니다.

## Hard safety rules

- 실제 `가계부_2026` 원본에는 앱 write 테스트를 하지 않는다.
- 먼저 Google Drive에서 원본을 복사해 TEST 사본을 만든다.
- 앱 기본 bootstrap ID로 원본 ID를 넣지 않는다.
- 자동화 도구로 기존 수식/우측 영역을 삭제하지 않는다.

## Recommended naming

예시:

```text
가계부_2026
가계부_2026_TEST
가계부_2027_TEST
```

## Migration order

1. 원본 Spreadsheet를 Google Drive에서 복사한다.
2. 복사본 이름에 `_TEST`를 붙인다.
3. `앱설정` 시트를 생성한다.
4. `통장` master를 만든다.
5. `카테고리` master를 만든다.
6. `예산그룹` 시트를 만든다.
7. `예산월별` 시트를 만든다.
8. 필요 시 `통합` 시트를 추가한다.
9. 기존 월별 데이터와 우측 수식 영역은 그대로 둔다.
10. `0!AB:AC`에 TEST 연도의 통장별 연도 시작잔액 Snapshot을 입력한다.
11. 앱에서 read-only 연결 검증을 먼저 한다.
12. 그 다음 소액 테스트 거래로 append를 검증한다.
13. 수정/삭제/이체를 TEST 사본에서만 검증한다.

## 앱설정 bootstrap

`앱설정!A1:B1`에 `key`, `value` 헤더를 먼저 입력합니다. 앱은 2행부터 설정값을 읽습니다.

필수 키:

| key | value |
| --- | --- |
| year | 2026 |
| schemaVersion | 1 |
| budgetStartMonth | 8 |
| environment | TEST |
| previousSpreadsheetId |  |
| nextSpreadsheetId |  |

연도 연결 시:

- `environment = TEST`는 TEST 사본 식별용 메타데이터로 유지한다.
- `2026.nextSpreadsheetId = 2027 TEST ID`
- `2027.previousSpreadsheetId = 2026 TEST ID`

## 0 month rules

- `2027 / 0`은 `2026 / 12` snapshot이다.
- 실시간 참조가 아니라 복사본이다.
- 동기화 방향은 `전년도 12월 -> 현재년도 0월`만 허용한다.
- 역방향 동기화는 하지 않는다.
- `0!AB:AC`는 `통장 | 연도시작잔액` 구조이며 정산의 연도 시작점이다.
- 최초 TEST 연도 값은 기존 원장의 전년도 말 잔액과 대조한 뒤 수동으로 채운다.
- 연결된 다음 연도부터는 앱이 전년도 12월 말 계산 잔액으로 갱신한다.

## Manual smoke test sequence

1. 로그인 성공
2. TEST Spreadsheet 접근 검증
3. schema validation 통과
4. 지출 append
5. 수입 append
6. 이체 2행 append
7. 앱 저장 데이터가 Sheet에 즉시 보이는지 확인
8. Sheet 직접입력 데이터가 앱에 보이는지 확인
9. ID 있는 거래 수정
10. ID 없는 거래 수정 전 optimistic concurrency 확인
11. 단일 거래 삭제
12. 이체 2행 삭제
13. 예산 정산 반영 확인
    - `앱설정.budgetStartMonth` 이전 월은 계산에서 제외
    - `예산그룹.시작월` 이전 월은 그룹별 계산에서 제외
    - 시작 월의 전월 정산 반영은 0원
    - 미정산 월은 다음 달에 자동 이월되지 않고, 종료 월에 저장한 정산액만 반영
14. 연도 연결 후 `12월 -> 1월` 이동 확인
15. `0월 데이터 업데이트` 확인

## Suggested low-risk sample transactions

실제 데이터와 섞여도 식별하기 쉬운 테스트 내용으로 입력합니다.

예시:

- `TEST_지출_트릿`
- `TEST_수입_급여`
- `TEST_이체_생활비이동`

권장:

- 소액 금액 사용
- 테스트 종료 후 앱 삭제 기능으로 정리
- 정리 전후 screenshot 또는 변경 로그 기록

## Rollback strategy

비파괴 원칙:

- 백업
- 추가
- 검증
- 전환

문제가 생기면:

1. TEST 사본을 버린다.
2. 원본에서 다시 복사한다.
3. migration 단계별로 다시 수행한다.

원본에 수동 rollback을 적용하지 않는다.
