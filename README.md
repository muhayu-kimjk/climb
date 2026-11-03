# climb | 무하유 계약 관리 시스템 프로토타입

climb(Contract Lifecycle Intelligent Management Base, 무하유 계약 관리 시스템. 로고 글자는 소문자 climb을 SUITE 글꼴로, 화면 글에는 이름을 쓰지 않음). 계약 등록, 계약 검토, 계약 체결, 운영 검토, 계약 완료 5단계로 계약을 관리하고, 고객에게 내는 견적서를 만들어 출력 기록을 남기는(요구사항 정의서 3.9) 사내 시스템의 **화면 시안**입니다.
실제 시스템은 사내 개발팀이 이 시안과 아래 문서를 바탕으로 구현합니다.

## 프로토타입 보는 법

1. 이 폴더(`Projects/climb`)에서 아래 명령을 실행합니다.

   ```bash
   python serve.py
   ```

2. 브라우저에서 http://localhost:8730 을 엽니다. (첫 화면: 로그인)
3. 화면 맨 위 검은 띠의 **시연용 역할 전환**으로 역할(최고관리자, 관리자, 영업 담당자, 영업 리더, 법무 담당자 등. 분야와 등급으로 묶여 있음)을 바꿔 가며 볼 수 있습니다.

메뉴에 있는 모든 화면과 이용 안내(메뉴 줄 오른쪽 끝)가 만들어져 있습니다.

결재 화면에서 승인, 반려, 승인 취소를 눌러 볼 수 있고, 관리자 화면에서 담당자, 대리 지정, 권한, 가격 기준, 제품과 기능, 거래처, 코드를 바꿔 볼 수 있습니다. 누른 결과는 이 브라우저에만 저장되어 다른 화면에도 반영되고, 시연 띠의 **시연 기록 지우기**를 누르면 처음 예시 상태로 돌아갑니다.

모든 화면은 A4 세로 종이 폭으로 보입니다. 브라우저에서 인쇄(Ctrl+P)하면 A4 세로 문서로 나옵니다. 인쇄 설정에서 "머리글과 바닥글"은 끄고 "배경 그래픽"은 켜면 화면과 가장 비슷하게 나옵니다.

## 문서

| 문서 | 내용 |
|---|---|
| [docs/01_요구사항정의서.md](docs/01_요구사항정의서.md) | 요구사항 전체 (확정, 가정, 제안, 미정 구분, `REQ-` 번호) |
| [docs/02_화면목록.md](docs/02_화면목록.md) | 메뉴 구조와 화면 목록 (`SCR-` 번호), 시안 진행 상태 |
| [docs/03_데이터정의서.md](docs/03_데이터정의서.md) | 항목마다 들어갈 값(자유 입력, 코드값, 목록 참조, 계산값), 코드표(`CODE-`), 계약 상태 전이표. 기획자가 Obsidian으로 직접 수정 |
| [docs/04_개발팀전달.md](docs/04_개발팀전달.md) | 개발팀에 전달할 것: 만들어 둔 것, 시안에 없는 것, 개발팀이 정할 것, 아직 정하지 않은 것 |
| [docs/05_표준대응표.md](docs/05_표준대응표.md) | 통제를 내부회계관리제도와 ISO 37001, 37301, 27001, 42001에 비춘 대응표: 이미 갖춘 통제, 빈 곳(G-번호), 기획자가 정할 것 |
| [docs/06_통제목록.md](docs/06_통제목록.md) | 통제 목록(RCM), 핵심 자동 통제와 시험, 지켜야 할 법과 규정, 남는 위험 수용 기록, 공급자 목록, AI를 쓰기 전 문턱 |

코드 주석에도 같은 `REQ-`, `SCR-` 번호를 적어 두었습니다. 화면, 기능이 어떤 요구사항에서 나왔는지 번호로 찾아갈 수 있습니다.

## 폴더 구조

```
Projects/climb
├─ README.md               이 문서
├─ serve.py                프로토타입 미리보기 서버 (내 PC 전용)
├─ tools/device_shots.py   기준 기기(아이폰 18 Pro, 아이패드 프로 11인치) 크기와 터치 화면으로 시안을 찍음 (Chrome 필요, serve.py를 켠 뒤)
├─ tools/doc_check.py      문서 점검: 표 칸 수, 보이지 않는 글자, 문서와 코드가 가리키는 번호(REQ, SCR, CODE, G, CTL 등)가 있는지, 화면 목록과 시안 파일이 맞는지
├─ docs/                   기획 문서
├─ 작업기록/               날짜별 결정 기록과 다시 시작할 지점, 그날 쓴 점검 도구 (2026-11-02/다시시작.md부터 읽음)
└─ prototype/              화면 시안
   ├─ login.html           SCR-00 로그인
   ├─ index.html           SCR-01 개요 (대시보드)
   ├─ new-contract.html    SCR-11 새 계약 등록 (?id= 로 이어서 작성, 보완 후 재기안, ?kind=&origin= 으로 변경, 연장)
   ├─ my-contracts.html    SCR-12 내 등록 목록 (영업)
   ├─ terminate.html       SCR-13 해지 기안 (?origin=원계약 번호)
   ├─ ops-change.html      SCR-14 운영 변경 기안 (기간 변경, 추가 충전. ?origin=원계약 번호)
   ├─ quote.html           SCR-15 새 견적과 견적 고치기, SCR-17 견적서 보기 (?no=견적번호&ver=판, 견적서 출력과 출력 기록)
   ├─ quotes.html          SCR-16 견적 목록 (견적 한 판이 한 줄, 한도 넘은 견적만 거르기)
   ├─ progress.html        SCR-20 전체 진행 현황
   ├─ review-queue.html    SCR-21 검토 대기
   ├─ review-done.html     SCR-22 검토 완료
   ├─ review.html          SCR-23 검토 상세 (결재 문서, ?id=계약번호. ⑥~⑩ 체결과 운영 검토도 여기서)
   ├─ signing.html         SCR-31 체결 대기 (영업)
   ├─ ops-queue.html       SCR-34 운영 검토 대기 (고객지원, 재무)
   ├─ contracts.html       SCR-41 전체 계약 (보관함, 묶음마다 한 줄)
   ├─ contract.html        SCR-42 계약 상세 (묶음 한 장, ?id=묶음 번호)
   ├─ expiring.html        SCR-43 만료 예정 계약
   ├─ renewal.html         SCR-44 연장 검토 (자동갱신, ?origin=원계약 번호)
   ├─ templates.html       SCR-45 표준계약서 (지금 판 내려받기, 새 판 올리기, 판 이력)
   ├─ stats.html           SCR-46 통계와 보고서 (체결 금액과 건수, 결재 단계마다 걸린 날, 보고서 인쇄)
   ├─ contract-print.html  SCR-47 계약 요약서 (계약 묶음 한 벌을 A4로, ?id=묶음 번호)
   ├─ obligations.html     SCR-48 의무 관리 (체결 후 의무: 보안 의무, SLA, 청구 일정의 기한과 이행 기록)
   ├─ admin-users.html     SCR-51 사용자 권한 관리 (사용자 추가, 권한 수정, 권한 변경 이력)
   ├─ admin-rules.html     SCR-52 결재선 규칙 (단계별 담당자, 대리 지정, 독촉 기준 일수)
   ├─ admin-restrict.html  SCR-53 열람 제한 관리
   ├─ admin-prices.html    SCR-54 가격 기준 관리 (기능마다 가격, 적용 시작일, 품의 문서, 이력)
   ├─ admin-products.html  SCR-58 제품과 기능 관리 (서비스 > 제품 > 기능 세 단계, 제품을 추가할 때 서비스를 고름, 관리자와 최고관리자)
   ├─ admin-customers.html SCR-55 거래처 관리 (고치기, 합치기)
   ├─ admin-codes.html     SCR-56 코드 관리
   ├─ admin-logs.html      SCR-57 접속 기록 점검 (정보보호 담당자와 리더, 최고관리자)
   ├─ company-settings.html SCR-59 회사 설정 (회사 정보, 견적서에 찍는 인장 그림. 고치기는 최고관리자, 인장은 총무)
   ├─ discount-review.html SCR-61 할인 예외 점검 (매월, 재무 임원)
   ├─ opp-recon.html       SCR-62 영업기회 대사 (매월 판다 수주 목록과 대조, 영업지원)
   ├─ seal-recon.html      SCR-63 인장 기록 대사 (매월 견적서 인장 기록과 인장 대장 대조, 총무)
   ├─ remediation.html     SCR-64 개선 과제와 보류 (컴플라이언스 담당자)
   ├─ config-review.html   SCR-65 설정 변경 확인 (가격 기준, 제품과 기능, 표준계약서 변경 확인. 재무 리더, 법무)
   ├─ help.html            SCR-90 이용 안내
   ├─ notices.html         SCR-91 공지사항 (공지와 릴리즈, 쓰기는 관리자)
   ├─ notice.html          SCR-92 공지 보기 (?id=글 번호)
   ├─ account.html         SCR-93 내 계정 (머리글 계정 아이콘을 눌러 펼친 판에서, 휴대폰은 전체 메뉴판 맨 아래에서도. 화면 밝기, 받을 이메일과 미리 보기)
   └─ assets/
      ├─ css/tokens.css    색, 글자, 크기 값 (회사 컬러는 여기만 바꾸면 됨)
      ├─ css/common.css    모든 화면 공통 스타일 (KRDS 구조)
      ├─ css/form.css      입력 화면 공통 스타일 (KRDS 입력 폼, 라디오, 파일 업로드, 오류 표시)
      ├─ css/list.css      목록 화면 공통 스타일 (거르기, 가로 스크롤 표, 쪽 번호)
      ├─ css/review.css    문서 모양 스타일: 결재 문서, 계약 상세, 계약 요약서, 해지와 연장, 운영 변경 기안 (결재란, 처리 막대, 첨부와 판)
      ├─ css/dashboard.css 개요 화면 전용 스타일
      ├─ css/new-contract.css 등록 양식 스타일: 새 계약 등록과 해지, 연장, 운영 변경 기안 (제품 줄, 결재선 미리 보기)
      ├─ css/admin-users.css 사용자 권한 관리 화면 전용 스타일 (사용자 표 너비, 사용 중지 계정 표시)
      ├─ css/admin.css     관리자 화면과 표준계약서, 의무 관리, 통계, 공지사항, 내 계정, 계약 상세, 만료 예정 계약, 회사 설정, 점검 화면 다섯이 함께 쓰는 스타일 (묶음 상자, 표 안의 글자 버튼, 변경 이력 표)
      ├─ css/help.css      이용 안내 화면 전용 스타일 (차례, 자주 묻는 것)
      ├─ css/board.css     공지사항과 공지 보기(목록, 글, 글쓰기 창), 내 계정(계정 정보, 받을 이메일과 미리 보기)
      ├─ css/stats.css     통계와 보고서 전용 스타일 (막대 그래프, 숫자 상자)
      ├─ css/quote.css     견적 화면 전용 스타일 (제품 줄 표, 고객에게 내는 견적서 모양, 견적서만 찍는 출력)
      ├─ css/recon.css     회사 설정, 영업기회 대사, 인장 기록 대사 스타일 (올리기 칸, 인장 그림 미리 보기, 대사 표)
      ├─ js/mock-data.js   시연용 예시 데이터 (가상의 사람, 거래처)
      ├─ js/common.js      헤더, 메뉴, 푸터, 결재 흐름 계산, 권한 판단 등 공통 기능 (맨 위에 차례)
      ├─ js/dashboard.js   개요 화면 로직
      ├─ js/new-contract.js 새 계약 등록 화면 로직 (체크리스트 자동 계산, 결재선, 입력 검사)
      ├─ js/admin-users.js 사용자 권한 관리 화면 로직 (거르기, 한 쪽 20명 쪽 나누기, 사용자 추가와 수정)
      ├─ js/admin-rules.js 결재선 규칙 화면 로직
      ├─ js/admin-restrict.js 열람 제한 관리 화면 로직
      ├─ js/admin-prices.js 가격 기준 관리 화면 로직
      ├─ js/admin-products.js 제품과 기능 관리 화면 로직 (서비스를 골라 제품 추가, 기능 여러 개 한 번에 추가, 고치기)
      ├─ js/admin-customers.js 거래처 관리 화면 로직
      ├─ js/admin-codes.js 코드 관리 화면 로직
      ├─ js/admin-logs.js  접속 기록 점검 화면 로직
      ├─ js/control-checks.js 점검 화면이 함께 쓰는 자료 window.CLIMB_CTL (접속 기록, 설정 변경 묶음과 확인, 내보내기 기록. 접속 기록 점검, 설정 변경 확인, 통계, 개요가 불러옴)
      ├─ js/company-settings.js 회사 설정 화면 로직
      ├─ js/discount-review.js 할인 예외 점검 화면 로직
      ├─ js/opp-recon.js   영업기회 대사 화면 로직
      ├─ js/seal-recon.js  인장 기록 대사 화면 로직
      ├─ js/remediation.js 개선 과제와 보류 화면 로직
      ├─ js/config-review.js 설정 변경 확인 화면 로직
      ├─ js/help.js        이용 안내 화면 로직 (내 역할 강조, 인쇄 때 펼치기)
      ├─ js/notices.js     공지사항 목록 화면 로직
      ├─ js/notice.js      공지 보기 화면 로직 (고치기, 내리기)
      ├─ js/notice-form.js 공지 글쓰기와 고치기 창 (목록과 보기가 함께 씀)
      ├─ js/account.js     내 계정 화면 로직 (화면 밝기, 받을 이메일 저장과 미리 보기)
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
      ├─ js/quote.js       새 견적과 견적서 보기 화면 로직 (오늘의 표준 단가로 채움, 출력 기록, 새 판)
      ├─ js/quotes.js      견적 목록 화면 로직 (볼 수 있는 견적만, 검색과 상태 거르기)
      ├─ js/renewal.js     연장 검토 화면 로직
      ├─ js/templates.js   표준계약서 화면 로직 (새 판 올리기, 표준계약서 추가)
      ├─ js/stats.js       통계와 보고서 화면 로직 (세는 법, 그래프, 표로 보기)
      ├─ js/contract-print.js 계약 요약서 화면 로직
      ├─ js/obligations.js 의무 관리 화면 로직 (거르기, 기한 순서)
      ├─ js/obligation-ui.js 체결 후 의무 창(더하기, 이행 기록, 끝내기, 기록 보기). 의무 관리와 계약 상세가 함께 씀
      ├─ js/theme.js       밝은 화면과 어두운 화면 (페이지를 그리기 전에 정함, 모든 HTML의 <head>에서 불러옴)
      ├─ img/seal-sample.svg 시연용 가상 회사 인장 그림 ("견본" 글자)
      └─ img/favicon.svg   브라우저 탭 아이콘 (무하유 심볼 Black 원본. favicon.png는 SVG를 못 읽는 브라우저용)
```

## 개발팀 참고

- 프로토타입은 특정 프레임워크 없이 순수 HTML, CSS, JavaScript로 만들었습니다(외부 라이브러리 없음, 글꼴만 Google Fonts와 jsDelivr). 사내 표준 기술로 옮길 때 구조와 동작을 참고하세요. React를 쓰지 않은 이유는 요구사항 정의서 1.3에 있습니다.
- 코드를 처음 읽는 순서, `common.js` 안의 묶음, 여러 화면이 함께 쓰는 파일은 [개발팀 전달 문서](docs/04_개발팀전달.md) 2.4 코드 지도에 있습니다. 시안에 일부러 남겨 둔 겹침(옮길 때 하나로 합칠 것)은 2.5에 있습니다.
- `mock-data.js`의 데이터 구조(계약, 결재 단계, 상태값)는 화면 설계를 위한 **가정**입니다. DB 설계 시 요구사항정의서와 함께 검토가 필요합니다.
- 가격 기준(`mock-data.js`의 `PRICE_BOOK`)은 시연용 가상 값입니다. 체크리스트 2, 3번 계산과 결재선 결정은 실제 시스템에서 서버가 다시 검증해야 합니다(요구사항 정의서 3.4.1).
- 열람 제한(REQ-AUTH-09), 도메인 제한 로그인(REQ-ENV-03), 대리 지정으로 대신 처리할 수 있는지(REQ-REV-08), 관리자 화면 접근 같은 권한 처리는 프로토타입에서는 화면에서만 흉내 냅니다. 실제 시스템에서는 반드시 서버에서 처리해야 합니다.
- 관리자 화면에서 바꾼 것은 `common.js`의 `adminSave`가 변경 이력에 남기고 `applyAdmin`이 예시 데이터에 반영합니다(요구사항 정의서 4.3). 접속 기록 점검의 기록은 예시 데이터로 만든 일부입니다.
- 글꼴(Noto Sans KR)을 Google Fonts에서, 로고 영어의 SUITE를 jsDelivr에서 불러옵니다. 사내망에서 막혀 있으면 글꼴 파일을 서버에 직접 두는 방식으로 바꿔야 합니다.
