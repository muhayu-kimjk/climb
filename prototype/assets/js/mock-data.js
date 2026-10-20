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
    REJECTED: { label: '반려', tone: 'danger' },          // 2단계: 반려, 보완 후 재기안 가능
    APPROVED: { label: '체결 대기', tone: 'attention' },  // 3단계: 승인 완료, 오프라인 서명 후 체결본 등록 전
    OPS_REVIEW: { label: '운영 검토', tone: 'progress' }, // 4단계: 체결 뒤 운영 적용(CEM), 재무 확인 [가정]
    ACTIVE: { label: '계약 완료', tone: 'success' },      // 5단계: 계약 완료, 보관함에 보관, 계약 기간 중
    EXPIRED: { label: '만료', tone: 'neutral' },
    TERMINATED: { label: '해지', tone: 'neutral' },
  };

  // 계약 구분 (REQ-FLOW-08~09: 갱신, 변경은 원계약(parentId)과 연결)
  const KINDS = { NEW: '신규', AMEND: '변경', RENEW: '갱신' };

  /* ---------- 계약 등록(SCR-11) 선택지 (요구사항 정의서 3.4) ---------- */
  const CONTRACT_TYPES = ['SaaS 이용계약', '비밀유지계약(NDA)', '리셀러 계약', '개인정보 처리위탁 계약', '기타'];
  const METHODS = { DIRECT: '직접', PROCURE: '조달', RESELLER: '리셀러' };      // C-10 확정
  const SETTLEMENTS = { LUMP: '일시', SPLIT: '분할', POST: '후불' };          // C-10 확정

  /* ---------- 서비스 [가정] ----------
   * 계약명은 따로 두지 않고, 계약은 고객사와 서비스로 구분합니다. (v0.12 확정)
   * 서비스는 계약에 넣은 제품(가격 기준의 service)에서 정해집니다. 서비스 이름과 목록은 기획자 확인 필요 */
  const SERVICES = { CK: '카피킬러', HR: 'HR 서비스' };

  /* ---------- 가격 기준: 표준단가표와 할인율 한도(cap) (REQ-SCOPE-02, REQ-CHK-04) ----------
   * 시연용 가상 값입니다. 실제 단가가 아닙니다.
   * 실제 시스템에서는 관리자가 "가격 기준 관리"(SCR-54)에서 관리하고, 영업, 세일즈어드민, 관리자만 볼 수 있습니다.
   * service: 제품이 속한 서비스(SERVICES) / listPrice: 표준 단가(원, 부가세 별도) / discountCap: 할인율 한도(이 비율까지 할인 가능) */
  const PRICE_BOOK = [
    { code: 'CK-ORG', service: 'CK', name: 'CK 기관 라이선스', unit: '기관, 1년', listPrice: 12000000, discountCap: 0.20 },
    { code: 'CK-USER', service: 'CK', name: 'CK 추가 이용자', unit: '100명, 1년', listPrice: 1500000, discountCap: 0.15 },
    { code: 'CK-API', service: 'CK', name: 'CK API 연동', unit: '1식, 1년', listPrice: 6000000, discountCap: 0.10 },
    { code: 'HR-BASE', service: 'HR', name: 'HR 서비스 기본', unit: '기관, 1년', listPrice: 9600000, discountCap: 0.20 },
    { code: 'HR-ADD', service: 'HR', name: 'HR 추가 모듈', unit: '모듈, 1년', listPrice: 3600000, discountCap: 0.15 },
  ];

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
  // 단계별 담당자 [가정]. 실제 시스템에서는 관리자가 결재선 규칙(SCR-52)에서 지정합니다. (REQ-AUTH-06)
  const STEP_ASSIGNEE = {
    S02: 'u_sadmin', S03: 'u_head', S04: 'u_legal', S05: 'u_privacy',
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
  };
  // ⑥ 총무가 날인 전에 계약서 실물과 맞춰 보는 항목 (REQ-FLOW-23, panda p.31)
  const SEAL_CHECKS = ['고객사명', '체결 제품', '계약 금액', '계약 기간'];
  // ⑨ CEM이 운영에 적용하는 일. 서비스마다 다릅니다 (REQ-FLOW-25, panda p.35) [가정] 서비스 3단계 목록이 오면 다시 정함
  const OPS_CHECKS = {
    CK: ['라이선스 열기', '계약번호 설정', '계약 기간 설정', '계약 금액 설정'],
    HR: ['도메인 열기', '계약 기간 설정'],
  };
  // 첨부 파일 종류 (데이터 정의서 CODE-FILE-KIND)
  const FILE_KINDS = { DRAFT_DOC: '계약서 초안', QUOTE: '최종 견적서', SIGNED: '체결본', TERMINATE_DOC: '해지 관련 서류' };

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
        ev('S03', 'APPROVE', '2026-10-12 10:20', '3년 계약과 연구기관 레퍼런스 확보를 고려해 할인 승인'),
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
      id: 'CT-2026-0418', counterparty: '누리교육재단', services: ['CK'], type: 'SaaS 이용계약', kind: 'AMEND',
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
      history: [ev('S02', 'APPROVE', '2026-10-18 13:00')],
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
      id: 'CT-2025-0871', counterparty: '한결대학교', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 54000000, requesterId: 'u_sales1', requestedAt: '2025-11-03 10:00', restricted: false, personalData: true,
      status: 'ACTIVE', approvedAt: '2025-11-07 15:00', autoHistory: true, startDate: '2025-11-15', endDate: '2026-11-14',
      checklist: { standard: 'NO', price: 'YES', cap: 'YES' },
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
      id: 'CT-2026-0011', counterparty: '온새미로대학교', services: ['CK', 'HR'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 72000000, requesterId: 'u_sales1', requestedAt: '2025-12-22 10:00', restricted: false, personalData: true,
      status: 'ACTIVE', approvedAt: '2025-12-29 15:00', autoHistory: true, startDate: '2026-01-10', endDate: '2027-01-09',
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

  return { TODAY, BRAND, ROLES, APPROVER_ROLES, USERS, DEMO_PERSONA, STATUS, KINDS, SERVICES, CONTRACT_TYPES, METHODS, SETTLEMENTS, PRICE_BOOK, STEPS, REVIEW_GROUPS, POST_GROUPS, PROCESS_ROLES, STEP_ASSIGNEE, APPROVAL_STATE, APPROVAL_ACTIONS, SEAL_CHECKS, OPS_CHECKS, FILE_KINDS, CONTRACTS, ALERT_RULES, ACCOUNT_STATUS, ACCOUNTS };
})();
