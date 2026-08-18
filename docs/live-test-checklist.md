# Live TEST checklist

이 체크리스트는 자동화만으로 확인할 수 없는 실제 Google/모바일/PWA 검증 항목을 정리합니다. 현재 연결된 TEST Spreadsheet는 두 사용자의 운영 데이터이므로 정상적인 검증 read/write에 별도 승인 절차를 요구하지 않습니다.

## Preconditions

- TEST Spreadsheet 사본 준비 완료
- Google Sheets API 활성화 완료
- OAuth Web Client ID 발급 완료
- GitHub Pages 배포 완료
- 두 사용자 Google 계정에 TEST Spreadsheet 공유 완료
- 최초 TEST 연도의 `0!AB:AC` 통장별 연도 시작잔액 검증 완료

## A. OAuth and access

- [ ] GitHub Pages URL에서 로그인 버튼이 보인다.
- [ ] 권한 있는 계정으로 로그인하면 앱을 사용할 수 있다.
- [ ] 권한 없는 계정으로 로그인하면 접근 차단 문구가 보인다.
- [ ] 계정 전환 후 이전 계정 데이터가 잠깐이라도 노출되지 않는다.
- [ ] 토큰 만료 상태에서 재로그인 유도가 동작한다.

## B. Transaction write safety

- [ ] 로그인·접근 권한·시트 구조 검증을 통과하면 write가 활성화된다.
- [ ] `environment` 라벨과 무관하게 설정된 TEST workbook에는 정상 write가 가능하다.
- [ ] 저장 중 중복 클릭이 막힌다.
- [ ] write 실패 시 성공 메시지가 보이지 않는다.
- [ ] 네트워크 오류 시 재시도 안내가 보인다.

## C. Expense / income / transfer

- [ ] 지출 저장 시 Sheet 금액이 음수로 기록된다.
- [ ] 수입 저장 시 Sheet 금액이 양수로 기록된다.
- [ ] 이체 저장 시 두 행이 함께 생성된다.
- [ ] 이체 두 행의 이체ID가 동일하다.
- [ ] metadata 기록 실패가 나더라도 금융 행이 중복 append되지 않는다.
- [ ] 저장 성공 후 날짜/통장은 유지되고 금액/용도/카테고리는 초기화된다.

## D. Sheet to app compatibility

- [ ] 사용자가 A:E만 직접 입력한 거래가 앱에 보인다.
- [ ] metadata 없는 legacy 지출이 지출로 추론된다.
- [ ] metadata 없는 legacy 수입이 수입으로 추론된다.
- [ ] 카테고리와 거래유형이 모두 없으면 거래는 보이되 통계 왜곡이 없다.

## E. Update / delete / concurrency

- [ ] ID 있는 거래 수정이 정상 동작한다.
- [ ] 월 변경 수정 시 기존 월에서 제거되고 새 월에 생성된다.
- [ ] 연도 변경 수정 시 연결된 다른 연도 Spreadsheet로 이동한다.
- [ ] 이체 수정 시 두 행이 함께 변경된다.
- [ ] 단일 거래 삭제가 정상 동작한다.
- [ ] 이체 삭제 시 두 행이 함께 삭제된다.
- [ ] ID 없는 거래 수정 전 충돌 검사가 동작한다.
- [ ] 다른 사용자가 중간에 바꾸면 충돌 안내가 뜬다.

## F. Budget

- [ ] 7월 잔여 +50만원이면 8월 실제예산이 +50만원 반영된다.
- [ ] 8월 예산 200만원, 사용 230만원이면 9월 예산이 120만원이 된다.
- [ ] 수동조정 `-300만원`이 실제예산에서 차감된다.
- [ ] 예산 초기화 후 실제예산이 기준예산과 같고, 반복 초기화해도 금액이 변하지 않는다.
- [ ] 입력 중 카테고리 선택 시 예산 잔여 1줄 표시가 맞다.

## G. Year links and month zero

- [ ] `2026년 12월 -> 다음`에서 `2027년 1월`이 열린다.
- [ ] 연결되지 않은 연도에는 연결 안내가 보인다.
- [ ] `0월 데이터 업데이트`가 `전년도 12월 -> 현재년도 0월` 방향으로만 수행된다.
- [ ] 0월 sync confirm 문구가 표시된다.
- [ ] 0월에는 신규 거래 입력이 차단된다.

## H. Masters

- [ ] 새 통장을 추가하면 신규 입력 dropdown에 보인다.
- [ ] 새 카테고리를 추가하면 신규 입력 dropdown에 보인다.
- [ ] 사용중지 항목은 신규 입력에서 숨겨진다.
- [ ] 기존 거래에서는 사용중지 항목명이 그대로 보인다.
- [ ] 이름 변경이 현재 연도 `1`~`12` 거래까지 반영된다.
- [ ] 이전 연도 거래는 자동 변경되지 않는다.

## I. Settlement / investment / energy

- [ ] 정산 화면이 월 수입/지출/통장/예산 요약을 표시한다.
- [ ] 정산의 전월/당월 통장 잔액이 기존 원장과 일치한다.
- [ ] 투자 탭 구조가 맞으면 조회가 된다.
- [ ] 투자 탭 구조가 틀리면 앱 전체 crash 없이 안내만 표시한다.
- [ ] 에너지 탭 구조가 맞으면 조회가 된다.
- [ ] 에너지 탭 구조가 틀리면 앱 전체 crash 없이 안내만 표시한다.

## J. PWA / mobile

- [ ] iPhone Safari에서 layout이 깨지지 않는다.
- [ ] iPhone에서 홈 화면 추가 후 standalone으로 열린다.
- [ ] Android Chrome에서 설치 프롬프트 또는 메뉴 설치가 가능하다.
- [ ] Android 설치 PWA에서도 정상 실행된다.
- [ ] repository sub-path에서 아이콘/manifest/service worker가 모두 정상 로드된다.
- [ ] offline 상태에서 캐시된 앱 UI와 로그인/네트워크 안내는 뜨지만 원장 데이터는 노출되지 않고 write/read는 네트워크 필요 상태를 유지한다.

## Evidence to capture

- Pages URL
- 사용한 Google 계정 이메일
- TEST Spreadsheet URL
- 핵심 플로우 screenshot
- 실패 시 error message 전문
- 모바일 기기/OS/브라우저 버전
