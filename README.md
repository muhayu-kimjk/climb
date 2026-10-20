# CLIMB | 무하유 계약 관리 플랫폼 프로토타입

MUHAYU Contract Lifecycle Management Base. 계약 등록, 계약 검토, 계약 체결, 운영 검토, 계약 완료 5단계로 계약을 관리하는 사내 시스템의 **화면 시안**입니다.
실제 시스템은 사내 개발팀이 이 시안과 아래 문서를 바탕으로 구현합니다.

## 프로토타입 보는 법

1. 이 폴더(`Projects/CLM`)에서 아래 명령을 실행합니다.

   ```bash
   python serve.py
   ```

2. 브라우저에서 http://localhost:8730 을 엽니다. (첫 화면: 로그인)
3. 화면 맨 위 검은 띠의 **시연용 역할 전환**으로 역할(슈퍼관리자, 관리자, 영업, 부서장, 법무 등)을 바꿔 가며 볼 수 있습니다.

메뉴에 있는 모든 화면과 이용 안내(메뉴 줄 오른쪽 끝)가 만들어져 있습니다.

결재 화면에서 승인, 반려, 승인 취소를 눌러 볼 수 있고, 관리자 화면에서 담당자, 대리 지정, 권한, 가격 기준, 거래처, 코드를 바꿔 볼 수 있습니다. 누른 결과는 이 브라우저에만 저장되어 다른 화면에도 반영되고, 시연 띠의 **시연 기록 지우기**를 누르면 처음 예시 상태로 돌아갑니다.

모든 화면은 A4 세로 종이 폭으로 보입니다. 브라우저에서 인쇄(Ctrl+P)하면 A4 세로 문서로 나옵니다. 인쇄 설정에서 "머리글과 바닥글"은 끄고 "배경 그래픽"은 켜면 화면과 가장 비슷하게 나옵니다.

## 문서

| 문서 | 내용 |
|---|---|
| [docs/01_요구사항정의서.md](docs/01_요구사항정의서.md) | 요구사항 전체 (확정, 가정, 제안, 미정 구분, `REQ-` 번호) |
| [docs/02_화면목록.md](docs/02_화면목록.md) | 메뉴 구조와 화면 목록 (`SCR-` 번호), 시안 진행 상태 |
| [docs/03_데이터정의서.md](docs/03_데이터정의서.md) | 항목마다 들어갈 값(자유 입력, 코드값, 목록 참조, 계산값), 코드표(`CODE-`), 계약 상태 전이표. 기획자가 Obsidian으로 직접 수정 |

코드 주석에도 같은 `REQ-`, `SCR-` 번호를 적어 두었습니다. 화면, 기능이 어떤 요구사항에서 나왔는지 번호로 찾아갈 수 있습니다.

## 폴더 구조

```
Projects/CLM
├─ README.md               이 문서
├─ serve.py                프로토타입 미리보기 서버 (내 PC 전용)
├─ docs/                   기획 문서
└─ prototype/              화면 시안
   ├─ login.html           SCR-00 로그인
   ├─ index.html           SCR-01 개요 (대시보드)
   ├─ new-contract.html    SCR-11 새 계약 등록 (?id= 로 이어서 작성, 보완 후 재기안, ?kind=&origin= 으로 변경, 갱신)
   ├─ my-contracts.html    SCR-12 내 등록 목록 (영업)
   ├─ terminate.html       SCR-13 해지 기안 (?origin=원계약 번호)
   ├─ ops-change.html      SCR-14 운영 변경 기안 (기간 변경, 추가 충전. ?origin=원계약 번호)
   ├─ progress.html        SCR-20 전체 진행 현황
   ├─ review-queue.html    SCR-21 검토 대기
   ├─ review-done.html     SCR-22 검토 완료
   ├─ review.html          SCR-23 검토 상세 (결재 문서, ?id=계약번호. ⑥~⑩ 체결과 운영 검토도 여기서)
   ├─ signing.html         SCR-31 체결 대기 (영업)
   ├─ ops-queue.html       SCR-34 운영 검토 대기 (CEM, 재무)
   ├─ contracts.html       SCR-41 전체 계약 (보관함, 묶음마다 한 줄)
   ├─ contract.html        SCR-42 계약 상세 (묶음 한 장, ?id=묶음 번호)
   ├─ expiring.html        SCR-43 만료 예정 계약
   ├─ renewal.html         SCR-44 갱신 검토 (자동갱신, ?origin=원계약 번호)
   ├─ admin-users.html     SCR-51 사용자 권한 관리 (사용자 추가, 권한 수정, 권한 변경 이력)
   ├─ admin-rules.html     SCR-52 결재선 규칙 (단계별 담당자, 대리 지정, 독촉 기준 일수)
   ├─ admin-restrict.html  SCR-53 열람 제한 관리
   ├─ admin-prices.html    SCR-54 가격 기준 관리 (적용 시작일, 품의 문서, 이력)
   ├─ admin-customers.html SCR-55 거래처 관리 (고치기, 합치기)
   ├─ admin-codes.html     SCR-56 코드 관리
   ├─ admin-logs.html      SCR-57 접속 기록 점검 (정보보호팀, 슈퍼관리자)
   ├─ help.html            SCR-90 이용 안내
   └─ assets/
      ├─ css/tokens.css    색, 글자, 크기 값 (회사 컬러는 여기만 바꾸면 됨)
      ├─ css/common.css    모든 화면 공통 스타일 (KRDS 구조)
      ├─ css/form.css      입력 화면 공통 스타일 (KRDS 입력 폼, 라디오, 파일 업로드, 오류 표시)
      ├─ css/list.css      목록 화면 공통 스타일 (거르기, 가로 스크롤 표, 쪽 번호)
      ├─ css/review.css    검토 상세(결재 문서) 전용 스타일 (결재란, 처리 막대)
      ├─ css/dashboard.css 개요 화면 전용 스타일
      ├─ css/new-contract.css 새 계약 등록 화면 전용 스타일
      ├─ css/admin-users.css 사용자 권한 관리 화면 전용 스타일 (가로 스크롤 표, 쪽 번호)
      ├─ css/admin.css     관리자 화면 공통 스타일 (묶음, 표 안의 관리 버튼, 변경 이력 표, 코드표 고르기)
      ├─ css/help.css      이용 안내 화면 전용 스타일 (차례, 자주 묻는 것)
      ├─ js/mock-data.js   시연용 예시 데이터 (가상의 사람, 거래처)
      ├─ js/common.js      헤더, 메뉴, 푸터, 권한 판단 등 공통 기능
      ├─ js/dashboard.js   개요 화면 로직
      ├─ js/new-contract.js 새 계약 등록 화면 로직 (체크리스트 자동 계산, 결재선, 입력 검사)
      ├─ js/admin-users.js 사용자 권한 관리 화면 로직 (거르기, 한 쪽 20명 쪽 나누기, 사용자 추가와 수정)
      ├─ js/admin-rules.js 결재선 규칙 화면 로직
      ├─ js/admin-restrict.js 열람 제한 관리 화면 로직
      ├─ js/admin-prices.js 가격 기준 관리 화면 로직
      ├─ js/admin-customers.js 거래처 관리 화면 로직
      ├─ js/admin-codes.js 코드 관리 화면 로직
      ├─ js/admin-logs.js  접속 기록 점검 화면 로직
      ├─ js/help.js        이용 안내 화면 로직 (내 역할 강조, 인쇄 때 펼치기)
      ├─ js/progress.js    전체 진행 현황 화면 로직
      ├─ js/review-queue.js 검토 대기 화면 로직
      ├─ js/review-done.js 검토 완료 화면 로직
      ├─ js/review.js      검토 상세 화면 로직 (승인, 반려, 승인 취소, ⑥~⑩ 처리)
      ├─ js/signing.js     체결 대기 화면 로직
      ├─ js/ops-queue.js   운영 검토 대기 화면 로직
      ├─ js/my-contracts.js 내 등록 목록 화면 로직 (임시 저장 삭제)
      ├─ js/contracts.js   전체 계약 화면 로직
      ├─ js/contract.js    계약 상세 화면 로직 (사후관리 기록 남기기)
      ├─ js/expiring.js    만료 예정 계약 화면 로직
      ├─ js/terminate.js   해지 기안 화면 로직
      ├─ js/ops-change.js  운영 변경 기안 화면 로직
      ├─ js/renewal.js     갱신 검토 화면 로직
      └─ img/favicon.svg   브라우저 탭 아이콘 (무하유 심볼 Black 원본. favicon.png는 SVG를 못 읽는 브라우저용)
```

## 개발팀 참고

- 프로토타입은 특정 프레임워크 없이 순수 HTML, CSS, JavaScript로 만들었습니다. 사내 표준 기술로 옮길 때 구조와 동작을 참고하세요.
- `mock-data.js`의 데이터 구조(계약, 결재 단계, 상태값)는 화면 설계를 위한 **가정**입니다. DB 설계 시 요구사항정의서와 함께 검토가 필요합니다.
- 가격 기준(`mock-data.js`의 `PRICE_BOOK`)은 시연용 가상 값입니다. 체크리스트 2, 3번 계산과 결재선 결정은 실제 시스템에서 서버가 다시 검증해야 합니다(요구사항 정의서 3.4.1).
- 열람 제한(REQ-AUTH-09), 도메인 제한 로그인(REQ-ENV-03), 대리 지정으로 대신 처리할 수 있는지(REQ-REV-08), 관리자 화면 접근 같은 권한 처리는 프로토타입에서는 화면에서만 흉내 냅니다. 실제 시스템에서는 반드시 서버에서 처리해야 합니다.
- 관리자 화면에서 바꾼 것은 `common.js`의 `adminSave`가 변경 이력에 남기고 `applyAdmin`이 예시 데이터에 반영합니다(요구사항 정의서 4.3). 접속 기록 점검의 기록은 예시 데이터로 만든 일부입니다.
- 글꼴(Noto Sans KR)을 Google Fonts에서 불러옵니다. 사내망에서 막혀 있으면 글꼴 파일을 서버에 직접 두는 방식으로 바꿔야 합니다.
