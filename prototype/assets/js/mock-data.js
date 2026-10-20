/* =====================================================================
 * CLIMB 프로토타입 예시 데이터 (mock-data.js)
 * ---------------------------------------------------------------------
 * - 화면 시연용 가짜 데이터입니다. 실제 시스템에서는 서버 API·DB에서 가져옵니다.
 * - 사람 이름·거래처 이름은 모두 가상입니다.
 * - 계약 상태값, 결재 단계 구조, 결재선 규칙은 [가정]입니다.
 *   (요구사항정의서 8. 추후 결정 항목 '계약 상태', REQ-AUTH-06 위임전결규정)
 * ===================================================================== */
window.CLIMB_DATA = (function () {
  // 프로토타입 기준일. D-day·대기 일수 계산에 씁니다.
  // 실제 시스템에서는 서버의 현재 날짜를 씁니다.
  const TODAY = '2026-10-19';

  // 시스템 명칭 (REQ-NAME-01~05)
  //   화면 표기 첫 줄: CLIMB | 무하유 계약 관리 플랫폼 / 둘째 줄: MUHAYU Contract Lifecycle Management Base
  const BRAND = {
    name: 'CLIMB',                 // 브라우저 탭 제목, 시스템 이름 첫 줄 앞부분
    ko: '무하유 계약 관리 플랫폼',   // 시스템 이름 첫 줄 뒷부분 (세로선 뒤)
    // 마지막 글자 B는 Base (REQ-NAME-05 확정). 첫 줄에 CLIMB이 있으므로 둘째 줄 끝의 (CLIMB)은 뺌
    en: 'MUHAYU Contract Lifecycle Management Base',
  };


  // 역할 코드 → 화면 표시 이름 (REQ-AUTH-01, REQ-AUTH-02)
  // 표시 이름에는 가운뎃점을 쓰지 않습니다. (REQ-UI-08) 법무 검토 역할의 표시 이름은 '법무' (C-08 확정)
  //   슈퍼관리자(SUPER): 모든 메뉴와 화면을 볼 수 있는 최상위 관리자. 화면은 슈퍼관리자 기준으로 먼저 만들고,
  //   역할별로 보이는 화면은 그 뒤에 나눕니다. (v0.16)
  //   세일즈어드민, 영업 담당 임원, 총무, CEM은 REQ-AUTH-12로 추가한 역할 (v0.16에 코드 추가)
  const ROLES = {
    SUPER: '슈퍼관리자',
    ADMIN: '관리자',
    SALES: '영업',
    HEAD: '부서장',
    EXEC: '영업 담당 임원',
    SALES_ADMIN: '세일즈어드민',
    LEGAL: '법무',
    PRIVACY: '개인정보 담당',
    GA: '총무',
    CEM: 'CEM',
    FINANCE: '재무',
  };

  // 2단계 계약 검토의 결재 역할: ② 세일즈어드민, ③ 부서장(리더 본인 건은 영업 담당 임원), ④ 법무, ⑤ 개인정보 담당
  // 재무는 결재선에 들어가지 않고 체결 뒤 회계 인식만 확인합니다. (C-15 확정, REQ-FLOW-26)
  const APPROVER_ROLES = ['SALES_ADMIN', 'LEGAL', 'PRIVACY', 'HEAD', 'EXEC'];

  // 사용자 (실제로는 Google 계정 로그인 정보 + 관리자가 지정한 역할)
  const USERS = {
    u_sales1: { name: '이도윤', dept: '영업1팀', role: 'SALES' },
    u_sales2: { name: '정하은', dept: '영업2팀', role: 'SALES' },
    u_head: { name: '최민준', dept: '영업본부', role: 'HEAD' },
    u_legal: { name: '김지우', dept: '법무팀', role: 'LEGAL' },
    u_privacy: { name: '한서연', dept: '정보보호팀', role: 'PRIVACY' },
    u_finance: { name: '오현우', dept: '재무팀', role: 'FINANCE' },
    u_admin: { name: '윤재민', dept: '경영지원팀', role: 'ADMIN' },
    u_super: { name: '원지안', dept: '컴플라이언스팀', role: 'SUPER' },
    u_exec: { name: '문태호', dept: '경영진', role: 'EXEC' },
    u_sadmin: { name: '배수아', dept: '세일즈어드민팀', role: 'SALES_ADMIN' },
    u_ga: { name: '노은채', dept: '경영지원팀', role: 'GA' },
    u_cem: { name: '임하준', dept: 'CEM팀', role: 'CEM' },
  };

  // 시연용: 역할을 전환하면 이 사용자로 로그인한 것처럼 보입니다. (프로토타입 전용)
  const DEMO_PERSONA = {
    SUPER: 'u_super',
    ADMIN: 'u_admin',
    SALES: 'u_sales1',
    HEAD: 'u_head',
    EXEC: 'u_exec',
    SALES_ADMIN: 'u_sadmin',
    LEGAL: 'u_legal',
    PRIVACY: 'u_privacy',
    GA: 'u_ga',
    CEM: 'u_cem',
    FINANCE: 'u_finance',
  };

  // 계약 상태 [가정]. tone은 배지 색 종류입니다. (tokens.css '계약 상태 배지')
  //   progress=Blue, danger=Pink, attention=Purple, success=Green, neutral=Gray
  //   5단계 흐름(REQ-FLOW-13, v0.13): 계약 등록 → 계약 검토 → 계약 체결 → 운영 검토 → 계약 완료(보관함)
  const STATUS = {
    DRAFT: { label: '작성 중', tone: 'neutral' },         // 1단계: 임시 저장, 기안 전 (작성자만 봄)
    IN_REVIEW: { label: '검토 중', tone: 'progress' },    // 2단계: 기안 후 결재 진행
    SUPPLEMENT: { label: '보완 중', tone: 'attention' },  // 2단계: 결재자가 보완을 요청해 기안자가 고치는 중, 고치면 그 단계부터 이어 감 (v0.26)
    REJECTED: { label: '반려', tone: 'danger' },          // 2단계: 반려, 보완 후 재기안 가능
    APPROVED: { label: '체결 대기', tone: 'attention' },  // 3단계: 승인 완료, 오프라인 서명 후 체결본 등록 전
    OPS_REVIEW: { label: '운영 검토', tone: 'progress' }, // 4단계: 체결 뒤 운영 적용(CEM), 재무 확인 [가정]
    ACTIVE: { label: '계약 완료', tone: 'success' },      // 5단계: 계약 완료, 보관함에 보관, 계약 기간 중
    EXPIRED: { label: '만료', tone: 'neutral' },
    TERMINATED: { label: '해지', tone: 'neutral' },
  };

  // 계약 구분 (REQ-FLOW-08~09: 갱신, 변경은 원계약(parentId)과 연결)
  // 해지(TERMINATE)는 원계약을 기간 중에 끝내는 기안 (REQ-FLOW-29, 번호 끝 -T01)
  // 운영 변경(CHANGE)은 계약서를 바꾸지 않고 기간 변경이나 추가 충전만 하는 기안 (번호 끝 -C01, 재무 문서 반영 v0.26)
  const KINDS = { NEW: '신규', AMEND: '변경', RENEW: '갱신', TERMINATE: '해지', CHANGE: '운영 변경' };
  // 운영 변경 종류: 한 번에 한 가지만 (재무 문서 원칙)
  const CHANGE_TYPES = { PERIOD: '계약 기간 변경', CK_FREE: 'CK 무상 추가 충전', CK_PAID: 'CK 유상 추가 충전', HR_FREE: 'HR 무상 추가 충전', HR_PAID: 'HR 유상 추가 충전' };
  // 운영 변경에서 ③ 영업 검토를 거치는 기준 (재무 문서): 기간이 2개월 넘게 바뀜, 무상 충전이 50건을 넘음. 유상 충전은 영업 검토 없음
  const CHANGE_RULES = { periodMonths: 2, freeQty: 50 };

  /* ---------- 계약 등록(SCR-11) 선택지 (요구사항 정의서 3.4) ---------- */
  const CONTRACT_TYPES = ['SaaS 이용계약', '비밀유지계약(NDA)', '리셀러 계약', '개인정보 처리위탁 계약', '기타'];
  const METHODS = { DIRECT: '직접', PROCURE: '조달', RESELLER: '리셀러' };      // C-10 확정
  const SETTLEMENTS = { LUMP: '일시', SPLIT: '분할', POST: '후불' };          // C-10 확정

  /* ---------- 서비스 [가정] ----------
   * 계약명은 따로 두지 않고, 계약은 고객사와 서비스로 구분합니다. (v0.12 확정)
   * 서비스는 계약에 넣은 제품(가격 기준의 service)에서 정해집니다. 서비스 이름과 목록은 기획자 확인 필요 */
  const SERVICES = { CK: '카피킬러', HR: 'HR 서비스' };

  /* ---------- 가격 기준: 표준단가표와 할인율 한도(cap) (REQ-SCOPE-02, REQ-CHK-04, REQ-CHK-07) ----------
   * 시연용 가상 값입니다. 실제 단가가 아닙니다.
   * 관리자가 "가격 기준 관리"(SCR-54)에서 관리하고, 영업, 세일즈어드민, 관리자만 볼 수 있습니다.
   * PRICE_ROWS: 바뀐 이력 전체. 값을 바꿀 때는 기존 줄을 고치지 않고 새 적용 시작일로 새 줄을 더합니다(데이터 정의서 8장).
   *   service: 제품이 속한 서비스(SERVICES) / listPrice: 표준 단가(원, 부가세 별도) / discountCap: 할인율 한도(이 비율까지 할인 가능)
   *   validFrom: 적용 시작일(이날 이후 기안하는 계약부터) / docUrl: 사내 품의 문서 링크(필수) / docNo: 품의 번호 / reason: 변경 사유
   *   by, at: 바꾼 사람과 일시. 품의 문서 주소와 번호는 가상입니다.
   * PRICE_BOOK: 오늘 적용되는 줄만 모은 표. 계약 등록 화면이 씁니다(common.js가 관리자 변경을 반영해 다시 만듦). */
  const PRICE_DOC = 'https://gw.muhayu.com/approval/';
  const PRICE_ROWS = [
    { code: 'CK-ORG', service: 'CK', name: 'CK 기관 라이선스', unit: '기관, 1년', listPrice: 12000000, discountCap: 0.20, validFrom: '2026-09-01', docUrl: PRICE_DOC + '2026-0812', docNo: '경영지원-2026-0812', reason: 'CLIMB 도입: 2026년 표준단가표 등록', by: 'u_super', at: '2026-09-01 09:00' },
    { code: 'CK-USER', service: 'CK', name: 'CK 추가 이용자', unit: '100명, 1년', listPrice: 1400000, discountCap: 0.15, validFrom: '2026-09-01', docUrl: PRICE_DOC + '2026-0812', docNo: '경영지원-2026-0812', reason: 'CLIMB 도입: 2026년 표준단가표 등록', by: 'u_super', at: '2026-09-01 09:00' },
    { code: 'CK-API', service: 'CK', name: 'CK API 연동', unit: '1식, 1년', listPrice: 6000000, discountCap: 0.10, validFrom: '2026-09-01', docUrl: PRICE_DOC + '2026-0812', docNo: '경영지원-2026-0812', reason: 'CLIMB 도입: 2026년 표준단가표 등록', by: 'u_super', at: '2026-09-01 09:00' },
    { code: 'HR-BASE', service: 'HR', name: 'HR 서비스 기본', unit: '기관, 1년', listPrice: 9600000, discountCap: 0.20, validFrom: '2026-09-01', docUrl: PRICE_DOC + '2026-0812', docNo: '경영지원-2026-0812', reason: 'CLIMB 도입: 2026년 표준단가표 등록', by: 'u_super', at: '2026-09-01 09:00' },
    { code: 'HR-ADD', service: 'HR', name: 'HR 추가 모듈', unit: '모듈, 1년', listPrice: 3600000, discountCap: 0.15, validFrom: '2026-09-01', docUrl: PRICE_DOC + '2026-0812', docNo: '경영지원-2026-0812', reason: 'CLIMB 도입: 2026년 표준단가표 등록', by: 'u_super', at: '2026-09-01 09:00' },
    // 바뀐 예: 추가 이용자 단가 인상(10월 1일부터)
    { code: 'CK-USER', service: 'CK', name: 'CK 추가 이용자', unit: '100명, 1년', listPrice: 1500000, discountCap: 0.15, validFrom: '2026-10-01', docUrl: PRICE_DOC + '2026-0915', docNo: '경영지원-2026-0915', reason: '추가 이용자 단가 인상(서버 비용 반영)', by: 'u_admin', at: '2026-09-24 15:10' },
    // 예정된 예: 추가 모듈 할인율 한도를 내년부터 넓힘 (아직 적용 전)
    { code: 'HR-ADD', service: 'HR', name: 'HR 추가 모듈', unit: '모듈, 1년', listPrice: 3600000, discountCap: 0.20, validFrom: '2027-01-01', docUrl: PRICE_DOC + '2026-1007', docNo: '경영지원-2026-1007', reason: '추가 모듈 판매 촉진: 할인율 한도 15%에서 20%로', by: 'u_admin', at: '2026-10-14 11:30' },
  ];
  // 오늘 적용되는 줄: 제품마다 적용 시작일이 오늘 이전인 줄 중 가장 늦은 것
  function currentPrices(rows, today) {
    const by = {};
    rows.forEach(function (r) {
      if (r.validFrom > today) return;
      if (!by[r.code] || by[r.code].validFrom <= r.validFrom) by[r.code] = r;
    });
    const order = [];
    rows.forEach(function (r) { if (order.indexOf(r.code) < 0) order.push(r.code); });
    return order.filter(function (c) { return by[c]; }).map(function (c) { return by[c]; });
  }
  const PRICE_BOOK = currentPrices(PRICE_ROWS, TODAY);

  /* ---------- 업무 세부 단계 (요구사항 정의서 3.2, 데이터 정의서 CODE-STEP) ----------
   * role: 담당 역할 / short: 짧은 이름(현재 진행 칸, 결재란 머리에 씀) */
  // done: 끝났을 때 결재란에 쓰는 말(없으면 "승인") / doneAction: 결재 기록의 "한 일"(없으면 "승인")
  // ing: 그 단계가 차례일 때 현재 진행 칸에 쓰는 말 (3단계 계약 체결, 4단계 운영 검토)
  const STEPS = {
    S01: { no: '①', name: '계약 등록과 기안', short: '기안', role: 'SALES' },
    S02: { no: '②', name: '체크리스트 검토', short: '체크리스트', role: 'SALES_ADMIN' },
    S03: { no: '③', name: '영업 검토', short: '영업', role: 'HEAD' },
    S04: { no: '④', name: '법무 검토', short: '법무', role: 'LEGAL' },
    S05: { no: '⑤', name: '개인정보 검토', short: '개인정보', role: 'PRIVACY' },
    S06: { no: '⑥', name: '인장 날인 검토', short: '인장', role: 'GA', done: '날인', doneAction: '날인 완료', ing: '인장 날인 대기' },
    S07: { no: '⑦', name: '상대방 서명, 체결본 등록', short: '체결본', role: 'SALES', done: '등록', doneAction: '체결본 등록', ing: '체결본 등록 대기' },
    S08: { no: '⑧', name: '체결본 확인', short: '체결본 확인', role: 'SALES_ADMIN', done: '확인', doneAction: '확인 완료', ing: '체결본 확인 중' },
    S09: { no: '⑨', name: '운영 적용', short: '운영', role: 'CEM', done: '적용', doneAction: '운영 적용 완료', ing: 'CEM 운영 적용 중' },
    S10: { no: '⑩', name: '재무 확인', short: '재무', role: 'FINANCE', done: '확인', doneAction: '재무 확인 완료', ing: '재무 확인 중' },
    S11: { no: '⑪', name: '계약 완료', short: '완료', role: null },
  };
  // 2단계 계약 검토의 순서: ② 다음 ③ 영업 검토(가격 예외 승인), 그 다음 ④와 ⑤를 동시에 (REQ-STEP-04, v0.20에서 바뀜)
  //   할인은 법무 검토보다 먼저 확정합니다(사전 승인 원칙, 요구사항 정의서 3.6.1)
  const REVIEW_GROUPS = [['S02'], ['S03'], ['S04', 'S05']];
  // 3단계 계약 체결과 4단계 운영 검토의 순서: ⑥ → ⑦ → ⑧ → ⑨ → ⑩, 하나씩 차례로 (REQ-SIGN-01, v0.23)
  //   ⑨ 운영 적용 다음에 ⑩ 재무 확인 (기획자 결정). 생략하는 단계는 없습니다.
  const POST_GROUPS = [['S06'], ['S07'], ['S08'], ['S09'], ['S10']];
  // 단계를 처리하는 역할 (검토 완료 화면과 메뉴에 씀): 결재 역할 + 총무, CEM, 재무
  const PROCESS_ROLES = ['SALES_ADMIN', 'LEGAL', 'PRIVACY', 'HEAD', 'EXEC', 'GA', 'CEM', 'FINANCE'];
  // 단계별 담당자(처음 설정) [가정]. 관리자가 결재선 규칙(SCR-52)에서 바꾸면 ASSIGNEE_CHANGES에 쌓입니다. (REQ-AUTH-06)
  //   ③ 영업 검토는 영업본부 부서장 한 명 [가정]. 부서장 본인이 기안한 계약은 영업 담당 임원(REQ-AUTH-12)
  const STEP_ASSIGNEE = {
    // S03: 리더 본인이 기안한 계약의 ③ 영업 검토(영업 담당 임원). 팀원 계약은 TEAM_LEADERS의 팀 리더 (재무 문서 반영 v0.26)
    S02: 'u_sadmin', S03: 'u_exec', S04: 'u_legal', S05: 'u_privacy',
    S06: 'u_ga', S08: 'u_sadmin', S09: 'u_cem', S10: 'u_finance',
  };
  // 결재 단계 처리 상태 (데이터 정의서 CODE-APPROVAL-STATE)
  const APPROVAL_STATE = {
    WAITING: { label: '대기', tone: 'line' },
    PENDING: { label: '차례', tone: 'progress' },
    DONE: { label: '승인', tone: 'success' },
    REJECTED: { label: '반려', tone: 'danger' },
    SKIPPED: { label: '생략', tone: 'neutral' },
  };
  // 결재에서 한 일 (데이터 정의서 CODE-APPROVAL-ACTION)
  const APPROVAL_ACTIONS = {
    SUBMIT: { label: '기안', tone: 'line' },
    APPROVE: { label: '승인', tone: 'success' },     // ⑥⑧⑨⑩에서는 STEPS의 doneAction으로 보여 줌
    REJECT: { label: '반려', tone: 'danger' },
    CANCEL: { label: '승인 취소', tone: 'attention' },
    REGISTER: { label: '체결본 등록', tone: 'progress' }, // ⑦ 영업이 체결본을 올림 (v0.23)
    RETURN: { label: '다시 등록 요청', tone: 'attention' }, // ⑧ 오탈자, 스캔 문제로 ⑦에 되돌림 (v0.23)
    SUPPLEMENT: { label: '보완 요청', tone: 'attention' }, // ②~⑤ 결재자가 기안자에게 보완을 요청 (v0.26)
    RESUBMIT: { label: '보완 완료', tone: 'line' },        // 기안자가 고쳐서 다시 올림. 금액이나 체크리스트 답이 바뀌면 처음부터 (v0.26)
  };
  // ⑥ 총무가 날인 전에 계약서 실물과 맞춰 보는 항목 (REQ-FLOW-23, panda p.31)
  const SEAL_CHECKS = ['고객사명', '체결 제품', '계약 금액', '계약 기간'];
  // ⑨ CEM이 운영에 적용하는 일. 서비스마다 다릅니다 (REQ-FLOW-25, panda p.35) [가정] 서비스 3단계 목록이 오면 다시 정함
  const OPS_CHECKS = {
    CK: ['라이선스 열기', '계약번호 설정', '계약 기간 설정', '계약 금액 설정'],
    HR: ['도메인 열기', '계약 기간 설정'],
  };
  // 해지할 때 ⑨에서 CEM이 하는 일 (REQ-SIGN-09) [가정]
  const OPS_CHECKS_END = { CK: ['라이선스 닫기', '계약 종료일 설정'], HR: ['도메인 닫기', '계약 종료일 설정'] };
  // 자동갱신(그대로 연장)할 때 ⑨에서 CEM이 하는 일 (REQ-ARC-07) [가정]
  const OPS_CHECKS_EXTEND = { CK: ['라이선스 기간 연장'], HR: ['도메인 기간 연장'] };
  // 운영 변경의 기간 변경(연장 또는 단축)에서 ⑨ CEM이 하는 일 (v0.26) [가정]
  const OPS_CHECKS_PERIOD = { CK: ['라이선스 기간 변경'], HR: ['도메인 기간 변경'] };
  // 사후관리 기록 종류 (데이터 정의서 CODE-AFTERCARE-TYPE)
  const AFTERCARE_TYPES = { CONTACT_CHANGE: '담당자 변경', ISSUE: '특이사항' };
  // 첨부 파일 종류 (데이터 정의서 CODE-FILE-KIND)
  //   조항 대비표(CLAUSE_DIFF): 표준계약서를 바꾼 계약에 필수. 바꾼 조항의 표준 문구와 바꾼 문구를 나란히 (v0.27, C-20)
  const FILE_KINDS = { DRAFT_DOC: '계약서 초안', CLAUSE_DIFF: '조항 대비표', QUOTE: '최종 견적서', SIGNED: '체결본', TERMINATE_DOC: '해지 관련 서류' };

  // 결재 기록 한 줄 (데이터 정의서 approval_history). 한 번 남기면 고치거나 지우지 않습니다. (REQ-FLOW-12)
  //   step: 단계 코드 / action: APPROVE 승인, REJECT 반려, CANCEL 승인 취소 / at: 'YYYY-MM-DD HH:MM'
  //   comment: 승인 의견(선택) 또는 반려 사유(필수) 또는 취소 사유 / actorId: 비우면 그 단계 담당자 / round: 기안 차수
  function ev(step, action, at, comment, actorId, round) {
    return { step: step, action: action, at: at, comment: comment || '', actorId: actorId || STEP_ASSIGNEE[step], round: round || 1 };
  }

  /* 계약 [가정] (데이터 정의서 3장)
   * checklist: 체크리스트 답. standard 1번(영업이 답함), price 2번과 cap 3번(제품 금액으로 자동 계산, NA는 해당 없음)
   *   → 결재선은 이 답과 개인정보 처리 여부(personalData)로만 정합니다. 금액 기준은 없습니다. (REQ-CHK-05)
   * history: 결재 기록. 결재 단계의 지금 상태(approvals)는 common.js가 이 기록을 차례로 다시 적용해 만듭니다.
   * products: 계약 제품 줄. 비어 있으면 검토 상세 화면에서 서비스와 금액으로 예시 줄을 만듭니다.
   * autoHistory: 이미 검토가 끝난 계약. 결재 기록을 승인일(approvedAt)에 맞춰 자동으로 만듭니다(시연용). */
  const CONTRACTS = [
    /* ----- 작성 중 (DRAFT): 계약번호는 기안할 때 부여 ----- */
    {
      // draftKey: 계약번호가 없는 임시 저장 건을 화면 주소로 부를 때 쓰는 임시 키 (new-contract.html?id=D-0001)
      id: null, draftKey: 'D-0001', counterparty: '바름고등학교', services: ['HR'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 7200000, requesterId: 'u_sales1', savedAt: '2026-10-18', restricted: false, personalData: true,
      status: 'DRAFT', history: [],
      // 계약 등록 화면(SCR-11)에 이어서 채울 값 (3.4 입력 항목)
      form: {
        bizNo: '214-82-10457', method: 'DIRECT', settlement: 'LUMP',
        startDate: '2027-01-01', endDate: '2027-12-31', autoRenew: 'NO',
        products: [{ code: 'HR-BASE', qty: 1, amount: 7200000 }], // 표준 960만 원에서 25% 할인 → 한도 20% 초과 예시
        checklist: { standard: 'YES', standardNote: '' },
      },
    },

    /* ----- 검토 중 (IN_REVIEW) ----- */
    {
      // ⑤ 개인정보 검토가 오래 머문 예시 (11일째)
      id: 'CT-2026-0402', counterparty: '미래로병원', services: ['HR'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 36000000, requesterId: 'u_sales2', requestedAt: '2026-10-08 14:10', restricted: false, personalData: true,
      status: 'IN_REVIEW',
      checklist: { standard: 'YES', price: 'YES', cap: 'YES' },
      products: [{ code: 'HR-BASE', qty: 3, amount: 28800000 }, { code: 'HR-ADD', qty: 2, amount: 7200000 }],
      memo: '환자 정보는 다루지 않고 직원 인사 정보만 처리합니다. 위탁 범위를 확인해 주세요.',
      history: [ev('S02', 'APPROVE', '2026-10-08 16:20')],
    },
    {
      // 모든 검토를 거치는 예시(경우 6). ③ 영업 검토 승인 뒤 ④ 법무와 ⑤ 개인정보를 동시에 검토하는 중.
      // ⑤는 끝났고 ④ 법무 검토 차례 (7일째)
      id: 'CT-2026-0405', counterparty: '하늘연구원', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 220000000, requesterId: 'u_sales2', requestedAt: '2026-10-10 10:05', restricted: false, personalData: true,
      status: 'IN_REVIEW',
      checklist: { standard: 'NO', standardNote: '연구기관 보안 서약 조항 추가', price: 'NO', priceNote: '10개 기관 일괄 계약', cap: 'NO', capNote: '3년 계약 조건으로 기관 라이선스 25% 할인 요청',
        accounting: 'YES', accountingNote: '첫 3개월 무상 사용 기간이 있고, 3년 동안 연도별 금액이 다름' },
      products: [{ code: 'CK-ORG', qty: 10, amount: 90000000 }, { code: 'CK-USER', qty: 50, amount: 70000000 }, { code: 'CK-API', qty: 10, amount: 60000000 }],
      memo: '대형 연구기관 첫 계약입니다. 할인율이 한도를 넘어 영업 검토가 필요합니다.',
      history: [
        ev('S02', 'APPROVE', '2026-10-10 15:00'),
        ev('S03', 'APPROVE', '2026-10-12 10:20', '3년 계약과 연구기관 레퍼런스 확보를 고려해 할인 승인', 'u_eunseong_ko'), // 영업2팀 리더
        ev('S05', 'APPROVE', '2026-10-13 10:05', '개인정보 처리위탁 조항 확인'),
      ],
    },
    {
      // ④ 법무와 ⑤ 개인정보가 동시에 차례인 예시(할인율 한도 이내라 ③ 영업 검토 생략). ② 승인은 아직 취소 가능
      id: 'CT-2026-0412', counterparty: '한빛대학교', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 48000000, requesterId: 'u_sales1', requestedAt: '2026-10-14 10:00', restricted: false, personalData: true,
      status: 'IN_REVIEW',
      checklist: { standard: 'NO', standardNote: '대학 요청으로 지식재산권 조항 일부 수정', price: 'NO', priceNote: '학과 단위 추가 이용자 묶음 할인', cap: 'YES' },
      products: [{ code: 'CK-ORG', qty: 3, amount: 32400000 }, { code: 'CK-USER', qty: 12, amount: 15600000 }],
      memo: '지식재산권 조항 수정본을 첨부했습니다.',
      history: [ev('S02', 'APPROVE', '2026-10-15 09:40')],
    },
    {
      // 승인 취소 기록이 남은 예시: ② 승인 → 취소 → 다시 승인. 지금 ③ 영업 검토 차례
      id: 'CT-2026-0105-A01', counterparty: '누리교육재단', services: ['CK'], type: 'SaaS 이용계약', kind: 'AMEND',
      parentId: 'CT-2026-0105',
      amount: 12000000, requesterId: 'u_sales2', requestedAt: '2026-10-16 09:00', restricted: false, personalData: false,
      status: 'IN_REVIEW',
      checklist: { standard: 'NO', standardNote: '변경 계약서(이용자 추가)', price: 'NO', priceNote: '기존 계약 할인율 유지', cap: 'NO', capNote: '추가 이용자 20% 할인(한도 15%), 기존 계약 조건 유지 요청' },
      products: [{ code: 'CK-USER', qty: 10, amount: 12000000 }],
      history: [
        ev('S02', 'APPROVE', '2026-10-16 09:10'),
        ev('S02', 'CANCEL', '2026-10-16 09:25', '첨부 견적서가 빠진 것을 확인해 승인 취소'),
        ev('S02', 'APPROVE', '2026-10-16 11:05', '보완된 견적서 확인'),
      ],
    },
    {
      // 열람 제한 계약 예시 (REQ-AUTH-07, REQ-AUTH-09). ② 체크리스트 검토 차례
      id: 'CT-2026-0421', counterparty: '가람전자', services: ['CK'], type: '리셀러 계약', kind: 'NEW',
      amount: 150000000, requesterId: 'u_sales1', requestedAt: '2026-10-17 14:00', restricted: true, personalData: false,
      status: 'IN_REVIEW',
      checklist: { standard: 'NO', standardNote: '리셀러 표준계약서 없음', price: 'NO', priceNote: '총판 공급가', cap: 'NO', capNote: '총판 마진 보장으로 21.9% 할인' },
      products: [{ code: 'CK-ORG', qty: 16, amount: 150000000 }],
      memo: '총판 계약이라 열람 제한을 걸었습니다.',
      history: [],
    },
    {
      // 금액이 없는 비밀유지계약 예시: ③ 영업 검토 생략(해당 없음)
      id: 'CT-2026-0427', counterparty: '단비소프트', services: ['HR'], type: '비밀유지계약(NDA)', kind: 'NEW',
      amount: 0, requesterId: 'u_sales1', requestedAt: '2026-10-18 10:30', restricted: false, personalData: false,
      status: 'IN_REVIEW',
      checklist: { standard: 'NO', standardNote: '상대방 양식 NDA', price: 'NA', cap: 'NA' },
      products: [],
      // 보완 요청 예시(v0.26): ④ 법무가 기안자에게 보완을 요청. 기안자가 고치면 ④부터 이어서 결재
      history: [
        ev('S02', 'APPROVE', '2026-10-18 13:00'),
        ev('S04', 'SUPPLEMENT', '2026-10-18 16:40', '상대방 양식 NDA의 비밀 유지 기간이 비어 있습니다. 기간을 채운 계약서를 다시 올려 주세요.'),
      ],
    },
    {
      // ③ 영업 검토 차례 예시(v0.26): 영업1팀 이도윤님의 계약이라 영업1팀 리더 최민준님이 검토
      id: 'CT-2026-0418', counterparty: '새봄평생교육원', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 18000000, requesterId: 'u_sales1', requestedAt: '2026-10-16 15:00', restricted: false, personalData: false,
      status: 'IN_REVIEW',
      checklist: { standard: 'YES', price: 'NO', priceNote: '기관 2곳 묶음 계약', cap: 'NO', capNote: '두 기관을 한 번에 계약해 기관 라이선스 25% 할인 요청' },
      products: [{ code: 'CK-ORG', qty: 2, amount: 18000000 }],
      memo: '평생교육원 두 곳을 묶은 첫 계약입니다.',
      history: [ev('S02', 'APPROVE', '2026-10-16 17:20')],
    },

    /* ----- 반려 (REJECTED) ----- */
    {
      id: 'CT-2026-0398', counterparty: '소담에듀', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 18000000, requesterId: 'u_sales1', requestedAt: '2026-10-06 11:00', restricted: false, personalData: false,
      status: 'REJECTED',
      round: 1, // 기안 차수 (REQ-FLOW-17). 보완 후 재기안하면 2차
      checklist: { standard: 'NO', standardNote: '고객 요청으로 손해배상 한도 조항 수정', price: 'YES', cap: 'YES' },
      history: [
        ev('S02', 'APPROVE', '2026-10-07 10:00'),
        ev('S04', 'REJECT', '2026-10-10 15:30', '손해배상 한도 조항이 표준계약서 기준을 벗어납니다. 수정 후 다시 요청해 주세요.'),
      ],
      // 보완 후 재기안 때 계약 등록 화면(SCR-11)에 미리 채울 값
      form: {
        bizNo: '107-86-33921', method: 'DIRECT', settlement: 'SPLIT', opportunity: 'OPP-2026-0311',
        contractDate: '2026-10-06', startDate: '2026-11-01', endDate: '2027-10-31', autoRenew: 'YES', noticeDays: 60,
        products: [{ code: 'CK-ORG', qty: 1, amount: 12000000 }, { code: 'CK-USER', qty: 4, amount: 6000000 }],
        checklist: { standard: 'NO', standardNote: '고객 요청으로 손해배상 한도 조항 수정' },
        memo: '손해배상 한도를 계약 금액의 2배로 요청받아 협의 중입니다.',
      },
    },

    /* ----- 승인 완료, 체결 대기 (APPROVED): 3단계 ⑥ 인장 날인 → ⑦ 체결본 등록 → ⑧ 체결본 확인 -----
     * postAt: 지금 차례인 단계. 그 앞 단계의 기록은 common.js가 승인일(approvedAt) 뒤 날짜로 만듦(시연용)
     * signedAt: 체결본을 등록한 날 / extraHistory: 자동으로 만든 기록 뒤에 더하는 기록 */
    {
      // ⑦ 체결본 등록이 오래 걸리는 예시 (승인 후 14일 이상 강조)
      id: 'CT-2026-0371', counterparty: '바른출판', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 24000000, requesterId: 'u_sales2', requestedAt: '2026-09-15 10:00', restricted: false, personalData: false,
      status: 'APPROVED', approvedAt: '2026-09-25 16:00', autoHistory: true, postAt: 'S07',
      checklist: { standard: 'NO', price: 'YES', cap: 'YES' },
    },
    {
      // ⑧에서 스캔 문제로 "다시 등록 요청" 뒤 영업이 다시 올려 ⑧ 확인 차례인 예시
      id: 'CT-2026-0379', counterparty: '새솔고등학교', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 9600000, requesterId: 'u_sales1', requestedAt: '2026-09-22 10:00', restricted: false, personalData: true,
      status: 'APPROVED', approvedAt: '2026-10-01 15:00', autoHistory: true, postAt: 'S08', signedAt: '2026-10-08',
      checklist: { standard: 'NO', price: 'YES', cap: 'YES' },
      extraHistory: [
        ev('S08', 'RETURN', '2026-10-09 10:20', '스캔본 3쪽(서명 쪽)이 빠졌습니다. 전체 쪽을 다시 올려 주세요.'),
        Object.assign(ev('S07', 'REGISTER', '2026-10-16 17:40', '서명 쪽을 포함해 다시 스캔', 'u_sales1'), { fileName: '새솔고등학교_체결본_전체.pdf' }),
      ],
    },
    {
      // ⑥ 인장 날인 차례인 예시
      id: 'CT-2026-0409', counterparty: '다온컨설팅', services: ['HR'], type: '비밀유지계약(NDA)', kind: 'NEW',
      amount: 0, requesterId: 'u_sales1', requestedAt: '2026-10-13 10:00', restricted: false, personalData: false,
      status: 'APPROVED', approvedAt: '2026-10-16 11:00', autoHistory: true, postAt: 'S06',
      checklist: { standard: 'NO', price: 'NA', cap: 'NA' },
    },

    /* ----- 운영 검토 (OPS_REVIEW): ⑧ 체결본 확인 뒤 ⑨ 운영 적용(CEM) → ⑩ 재무 확인 ----- */
    {
      id: 'CT-2026-0386', counterparty: '마루중학교', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 13200000, requesterId: 'u_sales1', requestedAt: '2026-09-18 10:00', restricted: false, personalData: false,
      status: 'OPS_REVIEW', approvedAt: '2026-09-24 15:00', signedAt: '2026-10-14', postAt: 'S09', autoHistory: true,
      checklist: { standard: 'NO', price: 'YES', cap: 'YES' },
      startDate: '2026-11-01', endDate: '2027-10-31',
    },
    {
      // ⑩ 재무 확인 차례. 체크리스트 4번이 "예"라 재무가 특수 조건을 확인해야 하는 예시
      id: 'CT-2026-0362', counterparty: '청람컨설팅', services: ['HR'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 19200000, requesterId: 'u_sales2', requestedAt: '2026-09-08 10:00', restricted: false, personalData: true,
      status: 'OPS_REVIEW', approvedAt: '2026-09-15 15:00', signedAt: '2026-10-02', postAt: 'S10', autoHistory: true,
      checklist: { standard: 'NO', price: 'YES', cap: 'YES', accounting: 'YES', accountingNote: '첫해 2개월 무상 사용 후 과금 시작' },
      startDate: '2026-10-15', endDate: '2027-10-14',
    },

    /* ----- 계약 완료 (ACTIVE): 보관함 ----- */
    {
      // 자동갱신 계약, 만료 26일 전인데 갱신 검토를 아직 하지 않은 예시 (해지 통지 기한 60일은 이미 지남)
      id: 'CT-2025-0871', counterparty: '한결대학교', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 54000000, requesterId: 'u_sales1', requestedAt: '2025-11-03 10:00', restricted: false, personalData: true,
      status: 'ACTIVE', approvedAt: '2025-11-07 15:00', autoHistory: true, startDate: '2025-11-15', endDate: '2026-11-14',
      autoRenew: 'YES', noticeDays: 60,
      checklist: { standard: 'NO', price: 'YES', cap: 'YES' },
      // 사후관리 기록 (데이터 정의서 aftercare_note). 고객 담당자 이름과 연락처는 적지 않음 (REQ-SEC-09)
      notes: [
        { type: 'CONTACT_CHANGE', at: '2026-03-10 10:20', by: 'u_sales1', content: '고객 담당자 변경 (CRM 반영함)' },
        { type: 'ISSUE', at: '2026-06-02 15:40', by: 'u_legal', content: '고객이 개인정보 처리위탁 조항 재확인을 요청함. 기존 조항으로 충분하다고 회신' },
      ],
    },
    {
      // 열람 제한 + 만료 임박 예시
      id: 'CT-2025-0902', counterparty: '푸른솔아카데미', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 30000000, requesterId: 'u_sales2', requestedAt: '2025-11-27 10:00', restricted: true, personalData: false,
      status: 'ACTIVE', approvedAt: '2025-12-02 15:00', autoHistory: true, startDate: '2025-12-10', endDate: '2026-12-09',
      checklist: { standard: 'NO', price: 'YES', cap: 'YES' },
    },
    {
      id: 'CT-2026-0105', counterparty: '누리교육재단', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 60000000, requesterId: 'u_sales2', requestedAt: '2026-01-06 10:00', restricted: false, personalData: false,
      status: 'ACTIVE', approvedAt: '2026-01-09 15:00', autoHistory: true, startDate: '2026-01-15', endDate: '2026-12-31',
      checklist: { standard: 'NO', price: 'YES', cap: 'YES' },
    },
    {
      // 자동갱신 계약. 갱신 검토(그대로 연장)를 기안해 ④ 법무 차례인 예시는 아래 CT-2026-0011-R01
      id: 'CT-2026-0011', counterparty: '온새미로대학교', services: ['CK', 'HR'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 72000000, requesterId: 'u_sales1', requestedAt: '2025-12-22 10:00', restricted: false, personalData: true,
      status: 'ACTIVE', approvedAt: '2025-12-29 15:00', autoHistory: true, startDate: '2026-01-10', endDate: '2027-01-09',
      autoRenew: 'YES', noticeDays: 30,
      checklist: { standard: 'NO', price: 'YES', cap: 'YES' },
    },
    {
      id: 'CT-2026-0150', counterparty: '가온테크', services: ['CK'], type: '리셀러 계약', kind: 'NEW',
      amount: 120000000, requesterId: 'u_sales2', requestedAt: '2026-02-10 10:00', restricted: false, personalData: false,
      status: 'ACTIVE', approvedAt: '2026-02-16 15:00', autoHistory: true, startDate: '2026-03-01', endDate: '2028-02-29',
      checklist: { standard: 'NO', price: 'YES', cap: 'YES' },
    },
    {
      id: 'CT-2026-0222', counterparty: '이음병원', services: ['HR'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 42000000, requesterId: 'u_sales1', requestedAt: '2026-04-13 10:00', restricted: false, personalData: true,
      status: 'ACTIVE', approvedAt: '2026-04-20 15:00', autoHistory: true, startDate: '2026-05-01', endDate: '2027-04-30',
      checklist: { standard: 'NO', price: 'YES', cap: 'YES' },
      notes: [{ type: 'ISSUE', at: '2026-08-20 11:00', by: 'u_sales1', content: '병원 정보보호팀 감사로 접속 기록 사본을 요청받아 CEM이 제공함' }],
    },
    /* ----- 갱신 검토와 해지 기안 (짧은 결재: ③ 부서장 → ④ 법무 → ⑨ 운영 → ⑩ 재무, REQ-ARC-06, 07) ----- */
    {
      // 갱신 검토 "그대로 자동갱신" 예시: ③ 부서장 승인, ④ 법무 차례
      id: 'CT-2026-0011-R01', parentId: 'CT-2026-0011', counterparty: '온새미로대학교', services: ['CK', 'HR'], type: 'SaaS 이용계약',
      kind: 'RENEW', renewMode: 'AUTO', amount: 72000000, requesterId: 'u_sales1', requestedAt: '2026-10-15 10:00',
      restricted: false, personalData: true, status: 'IN_REVIEW', startDate: '2027-01-10', endDate: '2028-01-09',
      autoRenew: 'YES', noticeDays: 30, reason: '이용 규모와 조건이 같아 기존 조건 그대로 1년 연장',
      history: [ev('S03', 'APPROVE', '2026-10-16 09:30', '조건 그대로 연장에 동의', 'u_head')], // 영업1팀 리더
    },
    {
      // 해지 기안 예시: ③ 부서장, ④ 법무 승인 뒤 ⑨ CEM 운영 종료 차례
      id: 'CT-2026-0150-T01', parentId: 'CT-2026-0150', counterparty: '가온테크', services: ['CK'], type: '리셀러 계약',
      kind: 'TERMINATE', amount: 0, requesterId: 'u_sales2', requestedAt: '2026-10-05 10:00', restricted: false, personalData: false,
      status: 'OPS_REVIEW', approvedAt: '2026-10-08 15:00', autoHistory: true, postAt: 'S09',
      terminateDate: '2026-11-30', reason: '총판의 최소 구매 약정 미이행으로 합의 해지',
      refundNote: '남은 기간 이용료는 환불하지 않고 위약금도 없음(해지 합의서 3조)',
    },
    {
      id: 'CT-2026-0301', counterparty: '해랑출판', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 15600000, requesterId: 'u_sales2', requestedAt: '2026-06-15 10:00', restricted: false, personalData: false,
      status: 'ACTIVE', approvedAt: '2026-06-19 15:00', autoHistory: true, startDate: '2026-07-01', endDate: '2027-06-30',
      checklist: { standard: 'NO', price: 'YES', cap: 'YES' },
    },

    /* ----- 만료 (EXPIRED) ----- */
    {
      id: 'CT-2025-0650', counterparty: '별빛어학원', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 8400000, requesterId: 'u_sales2', requestedAt: '2025-08-18 10:00', restricted: false, personalData: false,
      status: 'EXPIRED', approvedAt: '2025-08-22 15:00', autoHistory: true, startDate: '2025-09-01', endDate: '2026-08-31',
      checklist: { standard: 'NO', price: 'YES', cap: 'YES' },
    },

    /* ----- 운영 변경 (CHANGE, v0.26 재무 문서 반영) -----
     * changeType: CHANGE_TYPES / changeQty: 충전 수량(건) / changeAmount: 유상 충전 금액(원, 부가세 별도)
     * oldEndDate, endDate: 기간 변경 전후 종료일 / reason: 변경 사유 / activityUrl: CRM 영업활동 링크(재무 문서: 사유는 영업활동에 적고 링크를 남김) */
    {
      // 무상 충전 80건(50건 초과)이라 ③ 영업 검토 차례. 끝나면 ⑨에서 재무기획이 수불부에 반영
      id: 'CT-2026-0222-C01', parentId: 'CT-2026-0222', counterparty: '이음병원', services: ['HR'], type: 'SaaS 이용계약', kind: 'CHANGE',
      changeType: 'HR_FREE', changeQty: 80, changeAmount: 0, amount: 0,
      requesterId: 'u_sales1', requestedAt: '2026-10-17 11:00', restricted: false, personalData: false, status: 'IN_REVIEW',
      reason: '병원 신규 간호 인력 채용 시즌에 검사 수량이 부족해 무상으로 추가 제공(재계약 협의 중)',
      activityUrl: 'https://panda.muhayu.com/activity/A-2026-1077',
      history: [],
    },
    {
      // 무상 충전 30건(50건 이내)이라 영업 검토 없이 ⑨ CEM 운영 변경 차례
      id: 'CT-2026-0105-C01', parentId: 'CT-2026-0105', counterparty: '누리교육재단', services: ['CK'], type: 'SaaS 이용계약', kind: 'CHANGE',
      changeType: 'CK_FREE', changeQty: 30, changeAmount: 0, amount: 0,
      requesterId: 'u_sales2', requestedAt: '2026-10-15 14:00', restricted: false, personalData: false, status: 'IN_REVIEW',
      reason: '학기 말 검사 집중으로 검사 건수 소진. 다음 학기 증액 전까지 무상 30건 제공',
      activityUrl: 'https://panda.muhayu.com/activity/A-2026-1052',
      history: [],
    },
  ];
  // 시연용: 체크리스트 4번(v0.21)을 따로 적지 않은 예시는 "아니오"로 채움
  CONTRACTS.forEach(function (c) { if (c.checklist && !c.checklist.accounting) c.checklist.accounting = 'NO'; });

  // 개요 화면 강조 기준 일수 [가정] (기획자 결정 필요)
  //   "확인 필요" 상자(v0.12)와 단계 표시기 아래 설명 글(v0.14)은 뺐고, 지금은 대기 일수 강조에만 씁니다.
  const ALERT_RULES = {
    approvalDelayDays: 5,    // 한 결재 단계에 머문 기간: 내가 검토할 계약의 대기 일수 강조 (REQ-DASH-05)
    signDelayDays: 14,       // 승인 후 체결이 끝나지 않은 기간: 체결 대기 목록 강조, 기안자 독촉 이메일 (REQ-ENV-10)
  };


  /* ---------- 사용자 계정 목록: 사용자 권한 관리(SCR-51) ----------
   * 시연용 가상 사람입니다. 이름과 이메일은 실제 직원이 아닙니다.
   * 계정 상태 [가정]: ACTIVE 사용 중 / INVITED 첫 접속 전(관리자가 추가했지만 아직 로그인하지 않음) / SUSPENDED 사용 중지
   * 한 사람이 여러 역할을 가질 수 있습니다(REQ-AUTH-05). 예: 송민재 법무 + 관리자
   * 날짜 칸: 등록일(관리자가 계정을 추가한 날), 최초 접속일시, 최종 로그인일시, 최종 로그아웃일시, 권한 변경일
   * 실제 시스템에서는 로그인 기록(REQ-AUTH-13)과 권한 변경 기록에서 가져옵니다. */
  const ACCOUNT_STATUS = {
    ACTIVE: { label: '사용 중', tone: 'success' },
    INVITED: { label: '첫 접속 전', tone: 'line' },
    SUSPENDED: { label: '사용 중지', tone: 'neutral' },
  };
  const ACCOUNTS = [
    // [이메일(계정), 이름, 부서, 역할, 상태, 등록일, 최초 접속일시, 최종 로그인일시, 최종 로그아웃일시, 권한 변경일]
    ['jian.won@muhayu.com', '원지안', '컴플라이언스팀', ['SUPER'], 'ACTIVE', '2026-09-01', '2026-09-03 10:12', '2026-10-15 12:17', '2026-10-15 19:18', '2026-09-01'],
    ['jaemin.yoon@muhayu.com', '윤재민', '경영지원팀', ['ADMIN'], 'ACTIVE', '2026-09-01', '2026-09-03 11:03', '2026-10-13 12:28', '2026-10-13 19:45', '2026-09-01'],
    ['eunchae.noh@muhayu.com', '노은채', '경영지원팀', ['GA'], 'ACTIVE', '2026-09-18', '2026-09-20 10:03', '2026-10-16 12:14', '2026-10-16 17:19', '2026-09-18'],
    ['seoyun.tak@muhayu.com', '탁서윤', '경영지원팀', ['GA'], 'ACTIVE', '2026-09-06', '2026-09-09 14:03', '2026-10-13 13:17', '2026-10-13 21:28', '2026-09-06'],
    ['taeho.moon@muhayu.com', '문태호', '경영진', ['EXEC'], 'ACTIVE', '2026-09-19', '2026-09-19 14:47', '2026-10-19 11:00', '2026-10-19 14:22', '2026-09-19'],
    ['minjun.choi@muhayu.com', '최민준', '영업본부', ['HEAD'], 'ACTIVE', '2026-09-11', '2026-09-14 13:47', '2026-10-18 13:16', '2026-10-18 19:22', '2026-09-11'],
    ['doyun.lee@muhayu.com', '이도윤', '영업1팀', ['SALES'], 'ACTIVE', '2026-09-22', '2026-09-23 16:34', '2026-10-19 09:47', '2026-10-19 11:11', '2026-09-22'],
    ['seohyun.park@muhayu.com', '박서현', '영업1팀', ['SALES'], 'ACTIVE', '2026-09-02', '2026-09-04 13:47', '2026-10-18 08:37', '2026-10-18 17:22', '2026-09-02'],
    ['taeyun.kim@muhayu.com', '김태윤', '영업1팀', ['SALES'], 'ACTIVE', '2026-09-08', '2026-09-11 13:03', '2026-10-17 08:33', '2026-10-17 14:15', '2026-09-08'],
    ['yerin.jang@muhayu.com', '장예린', '영업1팀', ['SALES'], 'ACTIVE', '2026-09-06', '2026-09-08 17:03', '2026-10-13 12:12', '2026-10-13 16:43', '2026-09-06'],
    ['junseo.hong@muhayu.com', '홍준서', '영업1팀', ['SALES'], 'ACTIVE', '2026-09-04', '2026-09-06 11:21', '2026-10-17 11:16', '2026-10-17 18:55', '2026-09-04'],
    ['gaeun.shin@muhayu.com', '신가은', '영업1팀', ['SALES'], 'ACTIVE', '2026-09-13', '2026-09-15 09:21', '2026-10-19 10:35', '2026-10-19 14:03', '2026-09-13'],
    ['taemin.ki@muhayu.com', '기태민', '영업1팀', ['SALES'], 'SUSPENDED', '2026-09-05', '2026-09-05 15:34', '2026-09-30 12:29', '2026-09-30 16:05', '2026-10-02'],
    ['eunseong.ko@muhayu.com', '고은성', '영업2팀', ['HEAD'], 'ACTIVE', '2026-09-09', '2026-09-10 14:12', '2026-10-19 08:22', '2026-10-19 09:29', '2026-09-09'],
    ['haeun.jung@muhayu.com', '정하은', '영업2팀', ['SALES'], 'ACTIVE', '2026-09-09', '2026-09-11 13:12', '2026-10-19 09:52', '2026-10-19 13:46', '2026-09-09'],
    ['jiho.yoo@muhayu.com', '유지호', '영업2팀', ['SALES'], 'ACTIVE', '2026-09-11', '2026-09-12 12:12', '2026-10-15 08:52', '2026-10-15 13:58', '2026-09-11'],
    ['nayeon.kwon@muhayu.com', '권나연', '영업2팀', ['SALES'], 'ACTIVE', '2026-09-21', '2026-09-22 14:21', '2026-10-19 08:22', '2026-10-19 10:01', '2026-09-21'],
    ['siwoo.hwang@muhayu.com', '황시우', '영업2팀', ['SALES'], 'ACTIVE', '2026-09-04', '2026-09-04 09:03', '2026-10-16 15:42', '2026-10-16 23:31', '2026-09-04'],
    ['chaewon.ahn@muhayu.com', '안채원', '영업2팀', ['SALES'], 'ACTIVE', '2026-09-22', '2026-09-23 09:47', '2026-10-15 14:38', '2026-10-15 22:59', '2026-09-22'],
    ['hyunseo.cho@muhayu.com', '조현서', '영업2팀', ['SALES'], 'ACTIVE', '2026-09-17', '2026-09-20 13:12', '2026-10-15 11:23', '2026-10-15 14:52', '2026-09-17'],
    ['yuna.cha@muhayu.com', '차유나', '영업3팀', ['HEAD'], 'ACTIVE', '2026-09-06', '2026-09-08 17:55', '2026-10-17 09:06', '2026-10-17 12:07', '2026-10-12'],
    ['geonwoo.yoon@muhayu.com', '윤건우', '영업3팀', ['SALES'], 'ACTIVE', '2026-09-20', '2026-09-21 12:21', '2026-10-17 11:08', '2026-10-17 14:41', '2026-09-20'],
    ['soyul.nam@muhayu.com', '남소율', '영업3팀', ['SALES'], 'ACTIVE', '2026-09-26', '2026-09-27 09:34', '2026-10-15 09:42', '2026-10-15 16:46', '2026-09-26'],
    ['dohyun.baek@muhayu.com', '백도현', '영업3팀', ['SALES'], 'ACTIVE', '2026-09-10', '2026-09-10 09:55', '2026-10-19 11:33', '2026-10-19 13:02', '2026-09-10'],
    ['jia.ryu@muhayu.com', '류지아', '영업3팀', ['SALES'], 'ACTIVE', '2026-09-10', '2026-09-13 16:55', '2026-10-19 10:42', '2026-10-19 13:20', '2026-09-10'],
    ['woojin.shim@muhayu.com', '심우진', '영업3팀', ['SALES'], 'ACTIVE', '2026-09-23', '2026-09-24 13:47', '2026-10-18 10:17', '2026-10-18 14:47', '2026-09-23'],
    ['haram.do@muhayu.com', '도하람', '영업3팀', ['SALES'], 'ACTIVE', '2026-09-17', '2026-09-19 14:55', '2026-10-18 15:50', '2026-10-18 22:38', '2026-09-17'],
    ['eunwoo.seol@muhayu.com', '설은우', '영업3팀', ['SALES'], 'INVITED', '2026-10-15', null, null, null, '2026-10-15'],
    ['sua.bae@muhayu.com', '배수아', '세일즈어드민팀', ['SALES_ADMIN'], 'ACTIVE', '2026-09-07', '2026-09-07 14:12', '2026-10-19 10:57', '2026-10-19 12:48', '2026-09-07'],
    ['jihoon.eom@muhayu.com', '엄지훈', '세일즈어드민팀', ['SALES_ADMIN'], 'ACTIVE', '2026-09-24', '2026-09-26 16:21', '2026-10-13 14:35', '2026-10-13 17:47', '2026-09-24'],
    ['dain.seok@muhayu.com', '석다인', '세일즈어드민팀', ['SALES_ADMIN'], 'ACTIVE', '2026-09-22', '2026-09-25 14:21', '2026-10-19 09:45', '2026-10-19 10:50', '2026-10-12'],
    ['jiwoo.kim@muhayu.com', '김지우', '법무팀', ['LEGAL'], 'ACTIVE', '2026-09-12', '2026-09-14 16:21', '2026-10-18 09:15', '2026-10-18 17:13', '2026-09-12'],
    ['minjae.song@muhayu.com', '송민재', '법무팀', ['LEGAL', 'ADMIN'], 'ACTIVE', '2026-09-24', '2026-09-26 17:47', '2026-10-16 09:13', '2026-10-16 16:45', '2026-10-06'],
    ['seoyeon.han@muhayu.com', '한서연', '정보보호팀', ['PRIVACY'], 'ACTIVE', '2026-09-07', '2026-09-10 09:55', '2026-10-16 12:02', '2026-10-16 18:39', '2026-09-07'],
    ['hajun.lim@muhayu.com', '임하준', 'CEM팀', ['CEM'], 'ACTIVE', '2026-09-26', '2026-09-28 11:47', '2026-10-19 10:44', '2026-10-19 14:14', '2026-09-26'],
    ['yeonwoo.joo@muhayu.com', '주연우', 'CEM팀', ['CEM'], 'ACTIVE', '2026-09-17', '2026-09-20 09:03', '2026-10-17 12:47', '2026-10-17 17:13', '2026-09-17'],
    ['harin.pyeon@muhayu.com', '편하린', 'CEM팀', ['CEM'], 'ACTIVE', '2026-09-04', '2026-09-04 12:34', '2026-10-18 13:42', '2026-10-18 20:50', '2026-09-04'],
    ['sihyun.bang@muhayu.com', '방시현', 'CEM팀', ['CEM'], 'ACTIVE', '2026-09-13', '2026-09-13 09:55', '2026-10-18 08:55', '2026-10-18 16:05', '2026-09-13'],
    ['sihwan.jin@muhayu.com', '진시환', 'CEM팀', ['CEM'], 'ACTIVE', '2026-09-08', '2026-09-11 15:34', '2026-10-13 09:53', '2026-10-13 13:21', '2026-09-08'],
    ['jua.yeon@muhayu.com', '연주아', 'CEM팀', ['CEM'], 'INVITED', '2026-10-16', null, null, null, '2026-10-16'],
    ['hyunwoo.oh@muhayu.com', '오현우', '재무팀', ['FINANCE'], 'ACTIVE', '2026-09-22', '2026-09-25 11:47', '2026-10-18 14:20', '2026-10-18 23:08', '2026-09-22'],
    ['seojin.ma@muhayu.com', '마서진', '재무팀', ['FINANCE'], 'ACTIVE', '2026-09-17', '2026-09-18 17:47', '2026-10-15 12:48', '2026-10-15 17:34', '2026-09-17'],
    ['yejun.pyo@muhayu.com', '표예준', '재무팀', ['FINANCE'], 'ACTIVE', '2026-09-04', '2026-09-05 10:03', '2026-10-19 08:35', '2026-10-19 10:27', '2026-09-04'],
  ].map(function (a) {
    return {
      email: a[0], name: a[1], dept: a[2], roles: a[3], status: a[4], registeredAt: a[5],
      firstLoginAt: a[6], lastLoginAt: a[7], lastLogoutAt: a[8], roleChangedAt: a[9],
    };
  });


  /* ---------- 계정과 사용자 연결 (결재선 규칙, 대리 지정에서 사람을 고를 때 씀) ----------
   * USERS에 없는 사람은 이메일 앞부분으로 번호를 만들어 더합니다. 예: minjae.song@muhayu.com → u_minjae_song */
  ACCOUNTS.forEach(function (a) {
    let id = Object.keys(USERS).filter(function (k) { return USERS[k].name === a.name; })[0];
    if (!id) {
      id = 'u_' + a.email.split('@')[0].replace(/\./g, '_');
      USERS[id] = { name: a.name, dept: a.dept, role: a.roles[0] };
    }
    a.id = id;
  });

  /* ---------- 영업 팀 리더: ③ 영업 검토 담당 (재무 문서 반영 v0.26) ----------
   * 팀원이 기안한 계약은 그 팀의 리더가, 리더 본인이 기안한 계약은 영업 담당 임원(STEP_ASSIGNEE.S03)이 검토합니다.
   * [가정] 영업본부 부서장 최민준님이 영업1팀 리더를 겸합니다. 관리자가 결재선 규칙(SCR-52)에서 바꿉니다. */
  const TEAM_LEADERS = { '영업1팀': 'u_head', '영업2팀': 'u_eunseong_ko', '영업3팀': 'u_yuna_cha' };

  /* ---------- 거래처 목록: 거래처 관리(SCR-55), 계약 등록의 고객사 고르기 (REQ-REG-18, 데이터 정의서 6장, D-01) ----------
   * 가상의 거래처와 가상의 사업자등록번호입니다.
   * 프로토타입은 계약의 상호(counterparty)로 거래처를 연결합니다. 실제 시스템은 거래처 번호(customer_id)로 연결합니다.
   * use: 사용 여부 / mergedInto: 다른 거래처로 합쳐졌으면 남긴 거래처 번호
   * C-0001~0013: CLIMB 도입 때 기존 계약관리대장에서 옮긴 거래처 / 그 뒤: 영업이 계약을 등록하며 새로 등록 */
  const CUSTOMERS = [
    // [번호, 상호, 사업자등록번호, 등록한 사람, 등록일]
    ['C-0001', '한결대학교', '119-82-04512', 'u_super', '2026-09-01'],
    ['C-0002', '푸른솔아카데미', '220-87-31408', 'u_super', '2026-09-01'],
    ['C-0003', '별빛어학원', '305-91-18273', 'u_super', '2026-09-01'],
    ['C-0004', '누리교육재단', '104-82-55120', 'u_super', '2026-09-01'],
    ['C-0005', '온새미로대학교', '312-82-07436', 'u_super', '2026-09-01'],
    ['C-0006', '가온테크', '129-86-40917', 'u_super', '2026-09-01'],
    ['C-0007', '이음병원', '410-82-61125', 'u_super', '2026-09-01'],
    ['C-0008', '해랑출판', '211-88-29364', 'u_super', '2026-09-01'],
    ['C-0009', '청람컨설팅', '220-88-71542', 'u_super', '2026-09-01'],
    ['C-0010', '마루중학교', '403-83-10288', 'u_super', '2026-09-01'],
    ['C-0011', '바른출판', '105-87-44120', 'u_super', '2026-09-01'],
    ['C-0012', '새솔고등학교', '314-83-20951', 'u_super', '2026-09-01'],
    ['C-0013', '다온컨설팅', '120-88-63017', 'u_super', '2026-09-01'],
    ['C-0014', '소담에듀', '107-86-33921', 'u_sales1', '2026-10-06'],
    ['C-0015', '미래로병원', '506-82-17340', 'u_sales2', '2026-10-08'],
    ['C-0016', '하늘연구원', '314-82-90215', 'u_sales2', '2026-10-10'],
    ['C-0017', '한빛대학교', '134-82-00417', 'u_sales1', '2026-10-14'],
    // 같은 거래처를 두 번 등록한 예: 상호를 줄여 쓰고 사업자등록번호 끝자리를 잘못 넣어 중복 검사를 지나침 → 거래처 관리에서 합침
    ['C-0018', '한빛대', '134-82-00471', 'u_sales2', '2026-10-15'],
    ['C-0019', '가람전자', '124-81-56732', 'u_sales1', '2026-10-17'],
    ['C-0020', '단비소프트', '215-87-80164', 'u_sales1', '2026-10-18'],
    ['C-0021', '바름고등학교', '214-82-10457', 'u_sales1', '2026-10-18'],
    ['C-0022', '새봄평생교육원', '211-91-40318', 'u_sales1', '2026-10-16'],
  ].map(function (r) {
    return { id: r[0], name: r[1], bizNo: r[2], registeredBy: r[3], registeredAt: r[4], use: true, mergedInto: null };
  });

  /* ---------- 관리자가 관리하는 코드표: 코드 관리(SCR-56) (데이터 정의서 9장) ----------
   * 화면 이름을 바꿔도 코드는 그대로입니다. 쓰지 않는 코드는 지우지 않고 "사용 안 함"으로 돌립니다(지난 기록의 뜻을 지키려고).
   * 사용 안 함인 코드는 새로 고르는 목록에서만 빠지고, 이미 저장된 기록에는 그대로 보입니다.
   * 서비스는 대분류, 중분류, 소분류 3단계(level 1~3, parent 상위 코드). 중분류, 소분류는 기획자가 든 예 (D-09 목록 전달 예정) */
  const CODE_GROUPS = {
    DEPT: { name: '부서', table: 'CODE-DEPT', note: '사용자 권한 관리에서 고르는 부서' },
    SERVICE: { name: '서비스', table: 'CODE-SERVICE', note: '대분류, 중분류, 소분류 3단계. 제품(가격 기준)이 속하는 서비스', levels: true },
    CONTRACT_TYPE: { name: '계약 유형', table: 'CODE-CONTRACT-TYPE', note: '계약 등록에서 고르는 유형' },
    METHOD: { name: '계약 방식', table: 'CODE-METHOD', note: '계약 등록에서 고르는 방식' },
    SETTLEMENT: { name: '정산 방식', table: 'CODE-SETTLEMENT', note: '계약 등록에서 고르는 방식' },
    AFTERCARE: { name: '사후관리 기록 종류', table: 'CODE-AFTERCARE-TYPE', note: '계약 상세의 사후관리 기록에서 고르는 종류' },
  };
  const CODES = [
    ['DEPT', 'COMPLIANCE', '컴플라이언스팀'], ['DEPT', 'EXECUTIVE', '경영진'], ['DEPT', 'SALES_HQ', '영업본부'],
    ['DEPT', 'SALES_1', '영업1팀'], ['DEPT', 'SALES_2', '영업2팀'], ['DEPT', 'SALES_3', '영업3팀'],
    ['DEPT', 'SALES_ADMIN', '세일즈어드민팀'], ['DEPT', 'LEGAL', '법무팀'], ['DEPT', 'INFOSEC', '정보보호팀'],
    ['DEPT', 'MGMT_SUPPORT', '경영지원팀'], ['DEPT', 'CEM', 'CEM팀'], ['DEPT', 'FINANCE', '재무팀'],
    ['SERVICE', 'CK', SERVICES.CK, 1], ['SERVICE', 'HR', SERVICES.HR, 1], ['SERVICE', 'ETC', '기타', 1],
    ['SERVICE', 'CK_CAMPUS', '카피킬러 캠퍼스', 2, 'CK'], ['SERVICE', 'CK_SCHOOL', '카피킬러 스쿨', 2, 'CK'], ['SERVICE', 'CK_CONTEST', '카피킬러 콘테스트', 2, 'CK'],
    ['SERVICE', 'HR_PRISM', '프리즘', 2, 'HR'], ['SERVICE', 'HR_MONSTER', '몬스터', 2, 'HR'], ['SERVICE', 'HR_PRISM_Q', '프리즘Q', 3, 'HR_PRISM'],
    ['CONTRACT_TYPE', 'SAAS', 'SaaS 이용계약'], ['CONTRACT_TYPE', 'NDA', '비밀유지계약(NDA)'], ['CONTRACT_TYPE', 'RESELLER', '리셀러 계약'],
    ['CONTRACT_TYPE', 'DPA', '개인정보 처리위탁 계약'], ['CONTRACT_TYPE', 'ETC', '기타'],
    ['METHOD', 'DIRECT', '직접'], ['METHOD', 'PROCURE', '조달'], ['METHOD', 'RESELLER', '리셀러'],
    ['SETTLEMENT', 'LUMP', '일시'], ['SETTLEMENT', 'SPLIT', '분할'], ['SETTLEMENT', 'POST', '후불'],
    ['AFTERCARE', 'CONTACT_CHANGE', '담당자 변경'], ['AFTERCARE', 'ISSUE', '특이사항'],
  ].map(function (r) { return { group: r[0], code: r[1], label: r[2], level: r[3] || null, parent: r[4] || null, use: true }; });

  /* ---------- 대리 지정: 결재선 규칙(SCR-52) (REQ-REV-08, 기획자 결정 v0.25) ----------
   * 담당자가 자리를 비우는 기간과 대신할 사람을 관리자가 정합니다. 기간 안에는 대신할 사람이 그 담당자의 차례를 처리하고,
   * 결재 기록에 "누구 대신"과 근거(사유)가 남습니다. 담당자 본인도 기간 중에 처리할 수 있습니다. [가정]
   * absentId: 자리를 비우는 담당자 / delegateId: 대신할 사람 / from, to: 기간(날짜, 이틀 다 포함) / reason: 근거
   * by, at: 지정한 관리자와 일시 / endedAt: 기간 전에 끝냈으면 그 일시 */
  const DELEGATIONS = [
    { id: 'DL-001', absentId: 'u_legal', delegateId: 'u_minjae_song', from: '2026-10-05', to: '2026-10-07',
      reason: '김지우님 연차(10.5~10.7). 같은 법무팀 송민재님이 법무 검토를 대신함', by: 'u_admin', at: '2026-10-02 10:20', endedAt: null },
    { id: 'DL-002', absentId: 'u_eunseong_ko', delegateId: 'u_exec', from: '2026-10-19', to: '2026-10-23',
      reason: '고은성님 해외 출장(10.19~10.23). 영업2팀 계약의 영업 검토를 영업 담당 임원이 대신 결재(위임전결규정 대결)', by: 'u_admin', at: '2026-10-16 17:40', endedAt: null },
  ];
  // 단계 담당자를 바꾼 이력. 바꾸면 아직 차례가 오지 않은 단계부터 새 담당자에게 갑니다(기획자 결정 v0.25).
  //   { step, to, at } 시연으로 바꾼 것은 common.js가 더함. 처음 설정은 STEP_ASSIGNEE
  const ASSIGNEE_CHANGES = [];

  /* ---------- 관리자 변경 이력 (SCR-51~56, REQ-SEC-05, REQ-AUTH-10, REQ-CHK-07) ----------
   * 관리자 화면에서 바꾼 것은 모두 한 줄씩 남기고 고치거나 지우지 않습니다(영구 보관). 사유는 필수입니다.
   * area: USER 사용자 권한 / RULE 결재선 규칙 / RESTRICT 열람 제한 / CUSTOMER 거래처 / CODE 코드 / AUDIT 기록 점검
   * 아래는 이미 반영된 예시 기록입니다(시연으로 바꾼 것은 common.js가 이 브라우저에 저장해 더함). 가격 기준 이력은 PRICE_ROWS에 있습니다. */
  const ADMIN_LOG = [
    { at: '2026-09-01 09:00', by: 'u_super', area: 'RULE', target: '결재선 규칙', change: '처음 설정: ② 배수아, ③ 팀 리더(영업1팀 최민준, 영업2팀 고은성, 영업3팀 차유나, 리더 본인 계약은 문태호), ④ 김지우, ⑤ 한서연, ⑥ 노은채, ⑧ 배수아, ⑨ 임하준, ⑩ 오현우, 결재 대기 독촉 5일, 체결 지연 독촉 14일', reason: 'CLIMB 도입' },
    { at: '2026-09-01 09:00', by: 'u_super', area: 'CUSTOMER', target: '거래처 13곳', change: '거래처 추가: 한결대학교 외 12곳', reason: 'CLIMB 도입: 기존 계약관리대장에서 옮김' },
    { at: '2026-09-01 09:00', by: 'u_super', area: 'CODE', target: '코드표 6개', change: '처음 등록: 부서, 서비스, 계약 유형, 계약 방식, 정산 방식, 사후관리 기록 종류', reason: 'CLIMB 도입' },
    { at: '2026-10-02 09:30', by: 'u_admin', area: 'USER', target: '기태민 (taemin.ki@muhayu.com)', change: '상태: 사용 중 → 사용 중지', reason: '9월 30일 퇴사(인사팀 퇴사 통보 10.1)' },
    { at: '2026-10-02 10:20', by: 'u_admin', area: 'RULE', target: '④ 법무 검토 대리 지정', change: '대리 지정: 김지우 → 송민재 (2026.10.05 ~ 2026.10.07)', reason: '김지우님 연차(10.5~10.7). 같은 법무팀 송민재님이 법무 검토를 대신함' },
    { at: '2026-10-06 14:10', by: 'u_super', area: 'USER', target: '송민재 (minjae.song@muhayu.com)', change: '권한: 법무 → 법무, 관리자', reason: '관리자 부재에 대비해 법무팀 송민재님을 관리자로 함께 지정(경영지원팀 요청)' },
    { at: '2026-10-08 16:00', by: 'u_admin', area: 'RESTRICT', target: 'CT-2026-0301 해랑출판', change: '열람 제한 해제', reason: '보도자료로 계약 사실이 공개되어 더 가릴 필요 없음(영업 요청)' },
    { at: '2026-10-12 11:00', by: 'u_admin', area: 'USER', target: '석다인 (dain.seok@muhayu.com)', change: '부서: 영업2팀 → 세일즈어드민팀, 권한: 영업 → 세일즈어드민', reason: '10월 12일 세일즈어드민팀으로 인사 이동' },
    { at: '2026-10-12 11:05', by: 'u_admin', area: 'USER', target: '차유나 (yuna.cha@muhayu.com)', change: '권한: 영업 → 부서장', reason: '10월 12일 영업3팀 부서장 발령' },
    { at: '2026-10-15 10:00', by: 'u_admin', area: 'USER', target: '설은우 (eunwoo.seol@muhayu.com)', change: '사용자 추가: 영업3팀, 영업', reason: '10월 15일 입사' },
    { at: '2026-10-16 10:00', by: 'u_admin', area: 'USER', target: '연주아 (jua.yeon@muhayu.com)', change: '사용자 추가: CEM팀, CEM', reason: '10월 16일 입사' },
    { at: '2026-10-16 17:40', by: 'u_admin', area: 'RULE', target: '③ 영업 검토(영업2팀 리더) 대리 지정', change: '대리 지정: 고은성 → 문태호 (2026.10.19 ~ 2026.10.23)', reason: '고은성님 해외 출장(10.19~10.23). 영업2팀 계약의 영업 검토를 영업 담당 임원이 대신 결재(위임전결규정 대결)' },
  ];
  // 열람 제한을 건 기록 (계약을 등록할 때 영업이 건 것). 관리자가 바꾼 것은 ADMIN_LOG의 RESTRICT
  const RESTRICT_LOG = [
    { at: '2026-09-01 09:00', by: 'u_super', id: 'CT-2025-0902', on: true, reason: 'CLIMB 도입 때 기존 계약을 옮기며 설정(기존 계약관리대장의 비공개 표시)' },
    { at: '2026-09-01 09:00', by: 'u_super', id: 'CT-2026-0301', on: true, reason: 'CLIMB 도입 때 기존 계약을 옮기며 설정(기존 계약관리대장의 비공개 표시)' },
    { at: '2026-10-17 14:00', by: 'u_sales1', id: 'CT-2026-0421', on: true, reason: '계약을 등록하며 영업이 설정' },
  ];

  /* ---------- 접속 기록 점검: SCR-57 (REQ-SEC-05, REQ-SEC-06, 기획자 결정 v0.25) ----------
   * 점검은 정보보호팀(개인정보 담당)이 합니다. 관리자가 자기 작업 기록을 스스로 점검하지 않게 하려는 것입니다.
   * LOG_REVIEWS: 매월 접속 기록과 내려받기 기록 점검 결과 [가정] 기한: 다음 달 말일
   * ACCESS_REVIEWS: 분기마다 모든 계정의 권한 검토 결과 [가정] 기한: 분기가 끝난 다음 달 말일
   * SEC_ALERTS: 이상 행위 알림. 주기와 상관없이 바로 정보보호 담당에게 이메일로 감(REQ-SEC-06). 가상 인물의 가상 기록입니다.
   *   kind: BULK 짧은 시간에 많은 열람이나 내려받기 / NIGHT 업무 시간 밖 접속 / NEW_PLACE 처음 보는 곳에서 접속 */
  const LOG_REVIEWS = [
    { month: '2026-09', by: 'u_privacy', at: '2026-10-05 15:00', result: 'OK',
      note: '9월 접속 기록과 내려받기 기록 확인. 업무 시간 밖 접속 3건은 모두 결재 처리로 확인함', action: '' },
  ];
  const ACCESS_REVIEWS = [];
  const SEC_ALERT_KINDS = { BULK: '짧은 시간에 많은 열람', NIGHT: '업무 시간 밖 접속', NEW_PLACE: '처음 보는 곳에서 접속' };
  const SEC_ALERTS = [
    { id: 'AL-003', at: '2026-10-16 23:05', userId: 'u_siwoo_hwang', kind: 'NIGHT', detail: '23시 5분 VPN 접속, 계약 4건 열람', status: 'OPEN' },
    { id: 'AL-002', at: '2026-10-15 09:20', userId: 'u_jiho_yoo', kind: 'BULK', detail: '10분 동안 계약 18건 열람, 첨부 PDF 6건 내려받기', status: 'OPEN' },
    { id: 'AL-001', at: '2026-10-09 10:15', userId: 'u_sales2', kind: 'NEW_PLACE', detail: '처음 쓰는 기기로 VPN 접속', status: 'DONE',
      doneBy: 'u_privacy', doneAt: '2026-10-09 14:00', action: '본인에게 확인: 회사가 새로 지급한 노트북. 이상 없음' },
  ];

  return { TODAY, BRAND, ROLES, APPROVER_ROLES, USERS, DEMO_PERSONA, STATUS, KINDS, SERVICES, CONTRACT_TYPES, METHODS, SETTLEMENTS, PRICE_BOOK, STEPS, REVIEW_GROUPS, POST_GROUPS, PROCESS_ROLES, STEP_ASSIGNEE, APPROVAL_STATE, APPROVAL_ACTIONS, SEAL_CHECKS, OPS_CHECKS, OPS_CHECKS_END, OPS_CHECKS_EXTEND, AFTERCARE_TYPES, FILE_KINDS, CONTRACTS, ALERT_RULES, ACCOUNT_STATUS, ACCOUNTS,
    CHANGE_TYPES, CHANGE_RULES, OPS_CHECKS_PERIOD, TEAM_LEADERS,
    PRICE_ROWS, currentPrices, CUSTOMERS, CODE_GROUPS, CODES, DELEGATIONS, ASSIGNEE_CHANGES, ADMIN_LOG, RESTRICT_LOG,
    LOG_REVIEWS, ACCESS_REVIEWS, SEC_ALERT_KINDS, SEC_ALERTS };
})();
