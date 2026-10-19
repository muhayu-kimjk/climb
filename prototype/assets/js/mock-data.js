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
  const BRAND = {
    name: 'CLIMB',                 // 브라우저 탭 제목
    ko: '무하유 계약 관리 플랫폼',   // 화면 안 대표 이름
    // 마지막 글자 B는 Base (REQ-NAME-05 확정)
    en: 'MUHAYU Contract Lifecycle Management Base (CLIMB)',
  };


  // 역할 코드 → 화면 표시 이름 (REQ-AUTH-01, REQ-AUTH-02)
  // 표시 이름에는 가운뎃점을 쓰지 않습니다. (REQ-UI-08) 법무 검토 역할의 표시 이름은 '법무' (C-08 확정)
  const ROLES = {
    SALES: '영업',
    HEAD: '부서장',
    LEGAL: '법무',
    PRIVACY: '개인정보 담당',
    FINANCE: '재무',
    ADMIN: '관리자',
  };

  // 결재선에 들어갈 수 있는 역할
  // 재무는 결재선에 들어가지 않고 체결 뒤 회계 인식만 확인합니다. (C-15 확정, REQ-FLOW-26)
  // 세일즈어드민, 영업 담당 임원, 총무, CEM 역할(REQ-AUTH-12)은 검토 화면을 만들 때 시연 데이터에 추가합니다.
  const APPROVER_ROLES = ['HEAD', 'LEGAL', 'PRIVACY'];

  // 사용자 (실제로는 Google 계정 로그인 정보 + 관리자가 지정한 역할)
  const USERS = {
    u_sales1: { name: '이도윤', dept: '영업1팀', role: 'SALES' },
    u_sales2: { name: '정하은', dept: '영업2팀', role: 'SALES' },
    u_head: { name: '최민준', dept: '영업본부', role: 'HEAD' },
    u_legal: { name: '김지우', dept: '법무팀', role: 'LEGAL' },
    u_privacy: { name: '한서연', dept: '정보보호팀', role: 'PRIVACY' },
    u_finance: { name: '오현우', dept: '재무팀', role: 'FINANCE' },
    u_admin: { name: '윤재민', dept: '경영지원팀', role: 'ADMIN' },
  };

  // 시연용: 역할을 전환하면 이 사용자로 로그인한 것처럼 보입니다. (프로토타입 전용)
  const DEMO_PERSONA = {
    SALES: 'u_sales1',
    HEAD: 'u_head',
    LEGAL: 'u_legal',
    PRIVACY: 'u_privacy',
    FINANCE: 'u_finance',
    ADMIN: 'u_admin',
  };

  // 계약 상태 [가정]. tone은 배지 색 종류입니다. (tokens.css '계약 상태 배지')
  //   progress=Blue, danger=Pink, attention=Purple, success=Green, neutral=Gray
  //   4단계 흐름(REQ-FLOW-13): 계약 등록 → 계약 검토 → 계약 체결 → 보관함
  const STATUS = {
    DRAFT: { label: '작성 중', tone: 'neutral' },         // 1단계: 임시 저장, 기안 전 (작성자만 봄)
    IN_REVIEW: { label: '검토 중', tone: 'progress' },    // 2단계: 기안 후 결재 진행
    REJECTED: { label: '반려', tone: 'danger' },          // 2단계: 반려, 보완 후 재기안 가능
    APPROVED: { label: '체결 대기', tone: 'attention' },  // 3단계: 승인 완료, 오프라인 서명 후 체결본 등록 전
    ACTIVE: { label: '체결 완료', tone: 'success' },      // 4단계: 체결본 등록, 계약 기간 중
    EXPIRED: { label: '만료', tone: 'neutral' },
    TERMINATED: { label: '해지', tone: 'neutral' },
  };

  // 계약 구분 (REQ-FLOW-08~09: 갱신·변경은 원계약(parentId)과 연결)
  const KINDS = { NEW: '신규', AMEND: '변경', RENEW: '갱신' };

  // 결재 단계 한 칸을 만드는 도우미.
  // state: DONE 승인 / PENDING 결재 차례 / WAITING 앞 단계 대기 / REJECTED 반려
  // date : DONE·REJECTED는 처리한 날, PENDING은 이 단계에 도착한 날
  const ROLE_USER = { HEAD: 'u_head', LEGAL: 'u_legal', PRIVACY: 'u_privacy', FINANCE: 'u_finance' };
  function step(role, state, date) {
    return { role: role, userId: ROLE_USER[role], state: state, date: date || null };
  }

  // 결재선 예시 [가정]: 부서장 → 법무 → (개인정보 포함 시) 개인정보 담당
  // 실제 결재선은 체크리스트 답(3.5)과 위임전결규정으로 정합니다. 재무는 결재선에 없음 (C-15)
  // ※ 실제 규칙은 위임전결규정을 받은 뒤 확정합니다. (REQ-AUTH-06)
  const CONTRACTS = [
    /* ----- 작성 중 (DRAFT): 계약번호는 기안할 때 부여 [가정] ----- */
    {
      id: null, title: '바름고등학교 SaaS 이용계약', counterparty: '바름고등학교', type: 'SaaS 이용계약', kind: 'NEW',
      amount: 7200000, requesterId: 'u_sales1', savedAt: '2026-10-18', restricted: false, personalData: true,
      status: 'DRAFT', approvals: [],
    },

    /* ----- 검토 중 (IN_REVIEW) ----- */
    {
      id: 'CT-2026-0402', title: '미래로병원 SaaS 이용계약', counterparty: '미래로병원', type: 'SaaS 이용계약', kind: 'NEW',
      amount: 36000000, requesterId: 'u_sales2', requestedAt: '2026-10-08', restricted: false, personalData: true,
      status: 'IN_REVIEW',
      approvals: [step('HEAD', 'DONE', '2026-10-09'), step('LEGAL', 'DONE', '2026-10-13'), step('PRIVACY', 'PENDING', '2026-10-13')],
    },
    {
      id: 'CT-2026-0405', title: '하늘연구원 SaaS 이용계약', counterparty: '하늘연구원', type: 'SaaS 이용계약', kind: 'NEW',
      amount: 220000000, requesterId: 'u_sales2', requestedAt: '2026-10-10', restricted: false, personalData: true,
      status: 'IN_REVIEW',
      approvals: [step('HEAD', 'DONE', '2026-10-10'), step('LEGAL', 'DONE', '2026-10-14'), step('PRIVACY', 'PENDING', '2026-10-14')],
    },
    {
      id: 'CT-2026-0412', title: '한빛대학교 SaaS 이용계약', counterparty: '한빛대학교', type: 'SaaS 이용계약', kind: 'NEW',
      amount: 48000000, requesterId: 'u_sales1', requestedAt: '2026-10-14', restricted: false, personalData: true,
      status: 'IN_REVIEW',
      approvals: [step('HEAD', 'DONE', '2026-10-15'), step('LEGAL', 'PENDING', '2026-10-15'), step('PRIVACY', 'WAITING')],
    },
    {
      id: 'CT-2026-0418', title: '누리교육재단 SaaS 이용계약 변경계약', counterparty: '누리교육재단', type: 'SaaS 이용계약', kind: 'AMEND',
      parentId: 'CT-2026-0105',
      amount: 12000000, requesterId: 'u_sales2', requestedAt: '2026-10-16', restricted: false, personalData: false,
      status: 'IN_REVIEW',
      approvals: [step('HEAD', 'DONE', '2026-10-16'), step('LEGAL', 'PENDING', '2026-10-16')],
    },
    {
      // 열람 제한 계약 예시 (REQ-AUTH-07, REQ-AUTH-09)
      id: 'CT-2026-0421', title: '가람전자 리셀러 계약', counterparty: '가람전자', type: '리셀러 계약', kind: 'NEW',
      amount: 150000000, requesterId: 'u_sales1', requestedAt: '2026-10-17', restricted: true, personalData: false,
      status: 'IN_REVIEW',
      approvals: [step('HEAD', 'PENDING', '2026-10-17'), step('LEGAL', 'WAITING')],
    },
    {
      id: 'CT-2026-0427', title: '단비소프트 비밀유지계약', counterparty: '단비소프트', type: '비밀유지계약(NDA)', kind: 'NEW',
      amount: 0, requesterId: 'u_sales1', requestedAt: '2026-10-18', restricted: false, personalData: false,
      status: 'IN_REVIEW',
      approvals: [step('HEAD', 'DONE', '2026-10-18'), step('LEGAL', 'PENDING', '2026-10-18')],
    },

    /* ----- 반려 (REJECTED) ----- */
    {
      id: 'CT-2026-0398', title: '소담에듀 SaaS 이용계약', counterparty: '소담에듀', type: 'SaaS 이용계약', kind: 'NEW',
      amount: 18000000, requesterId: 'u_sales1', requestedAt: '2026-10-06', restricted: false, personalData: false,
      status: 'REJECTED', rejectedAt: '2026-10-10',
      rejectReason: '손해배상 한도 조항이 표준계약서 기준을 벗어납니다. 수정 후 다시 요청해 주세요.',
      approvals: [step('HEAD', 'DONE', '2026-10-07'), step('LEGAL', 'REJECTED', '2026-10-10')],
    },

    /* ----- 승인 완료, 체결 대기 (APPROVED) ----- */
    {
      id: 'CT-2026-0371', title: '바른출판 SaaS 이용계약', counterparty: '바른출판', type: 'SaaS 이용계약', kind: 'NEW',
      amount: 24000000, requesterId: 'u_sales2', requestedAt: '2026-09-15', restricted: false, personalData: false,
      status: 'APPROVED', approvedAt: '2026-09-25',
      approvals: [step('HEAD', 'DONE', '2026-09-16'), step('LEGAL', 'DONE', '2026-09-25')],
    },
    {
      id: 'CT-2026-0379', title: '새솔고등학교 SaaS 이용계약', counterparty: '새솔고등학교', type: 'SaaS 이용계약', kind: 'NEW',
      amount: 9600000, requesterId: 'u_sales1', requestedAt: '2026-09-22', restricted: false, personalData: true,
      status: 'APPROVED', approvedAt: '2026-10-01',
      approvals: [step('HEAD', 'DONE', '2026-09-23'), step('LEGAL', 'DONE', '2026-09-26'), step('PRIVACY', 'DONE', '2026-10-01')],
    },
    {
      id: 'CT-2026-0409', title: '다온컨설팅 비밀유지계약', counterparty: '다온컨설팅', type: '비밀유지계약(NDA)', kind: 'NEW',
      amount: 0, requesterId: 'u_sales1', requestedAt: '2026-10-13', restricted: false, personalData: false,
      status: 'APPROVED', approvedAt: '2026-10-16',
      approvals: [step('HEAD', 'DONE', '2026-10-14'), step('LEGAL', 'DONE', '2026-10-16')],
    },

    /* ----- 체결 완료 (ACTIVE) ----- */
    {
      id: 'CT-2025-0871', title: '한결대학교 SaaS 이용계약', counterparty: '한결대학교', type: 'SaaS 이용계약', kind: 'NEW',
      amount: 54000000, requesterId: 'u_sales1', requestedAt: '2025-11-03', restricted: false, personalData: true,
      status: 'ACTIVE', startDate: '2025-11-15', endDate: '2026-11-14',
      approvals: [step('HEAD', 'DONE', '2025-11-04'), step('LEGAL', 'DONE', '2025-11-06'), step('PRIVACY', 'DONE', '2025-11-07')],
    },
    {
      // 열람 제한 + 만료 임박 예시
      id: 'CT-2025-0902', title: '푸른솔아카데미 SaaS 이용계약', counterparty: '푸른솔아카데미', type: 'SaaS 이용계약', kind: 'NEW',
      amount: 30000000, requesterId: 'u_sales2', requestedAt: '2025-11-27', restricted: true, personalData: false,
      status: 'ACTIVE', startDate: '2025-12-10', endDate: '2026-12-09',
      approvals: [step('HEAD', 'DONE', '2025-11-28'), step('LEGAL', 'DONE', '2025-12-02')],
    },
    {
      id: 'CT-2026-0105', title: '누리교육재단 SaaS 이용계약', counterparty: '누리교육재단', type: 'SaaS 이용계약', kind: 'NEW',
      amount: 60000000, requesterId: 'u_sales2', requestedAt: '2026-01-06', restricted: false, personalData: false,
      status: 'ACTIVE', startDate: '2026-01-15', endDate: '2026-12-31',
      approvals: [step('HEAD', 'DONE', '2026-01-07'), step('LEGAL', 'DONE', '2026-01-09')],
    },
    {
      id: 'CT-2026-0011', title: '온새미로대학교 SaaS 이용계약', counterparty: '온새미로대학교', type: 'SaaS 이용계약', kind: 'NEW',
      amount: 72000000, requesterId: 'u_sales1', requestedAt: '2025-12-22', restricted: false, personalData: true,
      status: 'ACTIVE', startDate: '2026-01-10', endDate: '2027-01-09',
      approvals: [step('HEAD', 'DONE', '2025-12-23'), step('LEGAL', 'DONE', '2025-12-26'), step('PRIVACY', 'DONE', '2025-12-29')],
    },
    {
      id: 'CT-2026-0150', title: '가온테크 리셀러 계약', counterparty: '가온테크', type: '리셀러 계약', kind: 'NEW',
      amount: 120000000, requesterId: 'u_sales2', requestedAt: '2026-02-10', restricted: false, personalData: false,
      status: 'ACTIVE', startDate: '2026-03-01', endDate: '2028-02-29',
      approvals: [step('HEAD', 'DONE', '2026-02-11'), step('LEGAL', 'DONE', '2026-02-16')],
    },
    {
      id: 'CT-2026-0222', title: '이음병원 SaaS 이용계약', counterparty: '이음병원', type: 'SaaS 이용계약', kind: 'NEW',
      amount: 42000000, requesterId: 'u_sales1', requestedAt: '2026-04-13', restricted: false, personalData: true,
      status: 'ACTIVE', startDate: '2026-05-01', endDate: '2027-04-30',
      approvals: [step('HEAD', 'DONE', '2026-04-14'), step('LEGAL', 'DONE', '2026-04-17'), step('PRIVACY', 'DONE', '2026-04-20')],
    },
    {
      id: 'CT-2026-0301', title: '해랑출판 SaaS 이용계약', counterparty: '해랑출판', type: 'SaaS 이용계약', kind: 'NEW',
      amount: 15600000, requesterId: 'u_sales2', requestedAt: '2026-06-15', restricted: false, personalData: false,
      status: 'ACTIVE', startDate: '2026-07-01', endDate: '2027-06-30',
      approvals: [step('HEAD', 'DONE', '2026-06-16'), step('LEGAL', 'DONE', '2026-06-19')],
    },

    /* ----- 만료 (EXPIRED) ----- */
    {
      id: 'CT-2025-0650', title: '별빛어학원 SaaS 이용계약', counterparty: '별빛어학원', type: 'SaaS 이용계약', kind: 'NEW',
      amount: 8400000, requesterId: 'u_sales2', requestedAt: '2025-08-18', restricted: false, personalData: false,
      status: 'EXPIRED', startDate: '2025-09-01', endDate: '2026-08-31',
      approvals: [step('HEAD', 'DONE', '2025-08-19'), step('LEGAL', 'DONE', '2025-08-22')],
    },
  ];

  // 대시보드 "확인 필요" 기준 일수 [제안] (REQ-DASH-09, 기획자 결정 필요)
  const ALERT_RULES = {
    uploadOverdueDays: 14,   // 승인 후 체결본 미등록
    resubmitOverdueDays: 7,  // 반려 후 재기안 없음
    approvalDelayDays: 5,    // 한 결재 단계에 머문 기간
  };

  return { TODAY, BRAND, ROLES, APPROVER_ROLES, USERS, DEMO_PERSONA, STATUS, KINDS, CONTRACTS, ALERT_RULES };
})();
