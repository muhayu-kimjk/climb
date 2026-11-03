/* =====================================================================
 * 프로토타입 예시 데이터 (mock-data.js) → window.CLIMB_DATA (화면 코드에서는 D)
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
  //   climb = Contract Lifecycle Intelligent Management Base (v0.53 기획자 요청: I는 Intelligent, B는 Base)
  //   머리글(맨 위) 둘째 줄: 한글 이름 "무하유 계약 관리 시스템" (v0.53 기획자 요청)
  //   푸터(맨 아래)와 로그인 화면: "MUHAYU Contract Lifecycle Intelligent Management Base" (v0.53에 MUHAYU를 뺐다가 v0.55 기획자 요청으로 다시 붙임)
  //   회사 이름은 저작권 줄에만: "© 2026 MUHAYU Inc."
  const BRAND = {
    name: 'climb',                 // 로고 글자(소문자, SUITE 글꼴)와 브라우저 탭 제목 (v0.53 기획자 요청: 대문자 CLIMB에서 바꿈. 본문 글에는 이름을 쓰지 않고 필요하면 "시스템")
    ko: '무하유 계약 관리 시스템',   // 머리글 둘째 줄, 푸터 둘째 줄, 로그인 첫 줄
    // 영문 이름(climb의 머리글자 풀이). 끝에 (climb)은 붙이지 않음
    en: 'MUHAYU Contract Lifecycle Intelligent Management Base',
    company: 'MUHAYU Inc.',        // 저작권 줄 (v0.53 기획자 요청)
  };


  /* ---------- 역할: 2단계 (REQ-AUTH-01, REQ-AUTH-02, 기획자 결정 v0.29) ----------
   * 1단계는 하는 일의 분야(영업, 영업지원, 법무, 정보보호, 총무, 고객지원, 재무), 2단계는 등급(담당자, 리더, 임원)입니다.
   *   리더: 유닛을 대표하는 부서장 / 임원: 영업은 COO, 재무는 CFO
   *   최고관리자(SUPER, 예전 이름 슈퍼관리자), 관리자, 관찰자는 분야 없이 한 단계
   * 화면 맨 위에는 역할 대신 조직명을 보여 줍니다. 역할은 관리자 화면(사용자 권한 관리)에서 봅니다. (v0.29)
   * 코드는 예전 그대로 두고(SALES, HEAD 등) 표시 이름만 2단계로 바꿨습니다. 새 등급만 새 코드(SA_LEAD 등)입니다.
   * 역할과 조직은 서로 묶지 않습니다(v0.31 기획자 결정). 관리자가 사람마다 역할을 주고, 어느 조직 사람인지와 상관없습니다.
   *   예: 총무 담당자 역할은 경영지원유닛 사람에게 주지만, 조직 때문에 역할이 정해지지는 않음
   * 기획자 결정 2026-11-02 (덧붙임, C-13, C-16): 새 분야 "컴플라이언스"에 담당자(COMPLIANCE)를 둠.
   *   거래처 확인 결과(C-13), 보류 걸고 풀기와 개선 과제 기록(C-16)을 맡고 결재 단계는 맡지 않음. 열람 제한 계약까지 보려면 감사 열람을 따로 받음
   * 기획자 결정 2026-11-02 C-2: "감사 열람"(AUDIT)은 관찰자처럼 분야 없이 한 단계. 모든 계약(열람 제한 포함), 전체 통계, 관리자 변경 이력,
   *   접속 기록 점검을 보기만 함. 최고관리자만 사유와 끝나는 날을 정해 주고 끝나는 날이 지나면 저절로 풀림(아래 ROLE_LIMITS, ROLE_GRANTS) */
  const ROLE_AREAS = [
    { name: '시스템 관리', solo: true, roles: { SUPER: '최고관리자', ADMIN: '관리자' } },
    { name: '영업', roles: { SALES: '담당자', HEAD: '리더', EXEC: '임원' } },
    { name: '영업지원', roles: { SALES_ADMIN: '담당자', SA_LEAD: '리더' } },
    { name: '법무', roles: { LEGAL: '담당자' } },
    { name: '정보보호', roles: { PRIVACY: '담당자', SEC_LEAD: '리더' } },
    { name: '총무', roles: { GA: '담당자' } },
    { name: '고객지원', roles: { CEM: '담당자', CEM_LEAD: '리더' } },
    { name: '재무', roles: { FINANCE: '담당자', FIN_LEAD: '리더', FIN_EXEC: '임원' } },
    { name: '컴플라이언스', roles: { COMPLIANCE: '담당자' } }, // 2026-11-02 덧붙임: 짧은 이름 "컴플라이언스"
    { name: '관찰', solo: true, roles: { OBSERVER: '관찰자' } },
    { name: '감사', solo: true, roles: { AUDIT: '감사 열람' } }, // 2026-11-02 C-2: 읽기만, 끝나는 날이 있는 역할
  ];
  // 역할 코드 → 표시 이름("영업 담당자", "영업 리더"), 짧은 이름(결재란과 현재 진행 칸: 담당자는 분야 이름만, "영업", "법무")
  const ROLES = {}, ROLE_SHORT = {}, ROLE_AREA = {};
  ROLE_AREAS.forEach(function (g) {
    Object.keys(g.roles).forEach(function (r) {
      const level = g.roles[r];
      ROLES[r] = g.solo ? level : g.name + ' ' + level;
      ROLE_SHORT[r] = g.solo ? level : level === '담당자' ? g.name : g.name + ' ' + level;
      ROLE_AREA[r] = g.name;
    });
  });
  // 리더와 임원이 그 분야 담당자의 메뉴와 화면을 함께 쓰는 역할 (영업 리더와 영업 임원은 ③ 영업 검토라는 따로 하는 일이 있어 빠짐)
  //   재무 리더와 재무 임원은 결재 단계를 맡지 않고 재무 담당자의 화면을 보기만 합니다(기획자 결정 v0.29)
  const ROLE_BASE = { SA_LEAD: 'SALES_ADMIN', SEC_LEAD: 'PRIVACY', CEM_LEAD: 'CEM', FIN_LEAD: 'FINANCE', FIN_EXEC: 'FINANCE' };
  // 결재선 규칙에서 단계 담당자나 대신할 사람으로 고를 수 있는 리더 [가정]. 재무 리더, 재무 임원, 관찰자는 열람만
  //   컴플라이언스 담당자와 감사 열람도 결재 단계를 맡지 않음(2026-11-02)
  const STEP_LEADS = ['SA_LEAD', 'SEC_LEAD', 'CEM_LEAD'];

  /* ---------- 끝나는 날이 있는 역할 (기획자 결정 2026-11-02 C-2) ----------
   * maxDays: 줄 때 고를 수 있는 가장 긴 기간(오늘부터) [가정 1년]. 최고관리자만 주고 뺌(사용자 권한 관리 SCR-51)
   * 끝나는 날이 지나면 그 역할은 없는 것으로 봄(common.js hasRole, roleEnded). 실제 시스템은 끝나는 날 다음 날 서버가 역할을 빼고 기록을 남김 */
  const ROLE_LIMITS = { AUDIT: { maxDays: 365 } };

  /* ---------- 겹치면 안 되는 역할 조합 (기획자 결정 2026-11-02 C-5, REQ-AUTH-14, 06 CTL-110, CTL-111) ----------
   * 한 사람이 아래 짝의 두 일을 함께 맡으면 "역할 겹침". 막지 않고, 저장할 때 알리고 까닭을 받아 허용하며 분기 권한 검토에 "역할 충돌 계정"으로 올림
   * duties: 일 묶음. roles는 그 일을 맡는 역할, steps는 그 일에 드는 결재 단계(결재선 규칙의 담당과 대리 지정으로 맡는 것도 셈, common.js roleConflicts)
   * pairs: 같은 사람이 함께 맡으면 겹치는 짝(③과 ⑨, ③과 ⑩, ⑨와 ⑩, ③과 ②나 ⑧) */
  const ROLE_CONFLICTS = {
    duties: {
      S03: { label: '③ 영업 리더, 임원 승인', roles: ['HEAD', 'EXEC'], steps: ['S03', 'S03C', 'SGR'] },
      S09: { label: '⑨ 고객지원', roles: ['CEM', 'CEM_LEAD'], steps: ['S09', 'SXP'] },
      S10: { label: '⑩ 재무', roles: ['FINANCE'], steps: ['S10'] },
      S02: { label: '②, ⑧ 영업지원', roles: ['SALES_ADMIN', 'SA_LEAD'], steps: ['S02', 'S08'] },
    },
    pairs: [['S03', 'S09'], ['S03', 'S10'], ['S09', 'S10'], ['S03', 'S02']],
  };

  // 2단계 계약 검토의 결재 역할: ② 영업지원, ③ 영업 리더(리더 본인 건은 영업 임원), ④ 법무, ⑤ 정보보호
  // 재무는 결재선에 들어가지 않고 체결 뒤 회계 인식만 확인합니다. (C-15 확정, REQ-FLOW-26)
  const APPROVER_ROLES = ['SALES_ADMIN', 'LEGAL', 'PRIVACY', 'HEAD', 'EXEC'];

  // 사용자 (실제로는 Google 계정 로그인 정보 + 관리자가 지정한 역할)
  //   dept: 조직(실, 유닛). 화면 맨 위 이름 앞에 보임 (v0.29 조직 개편 반영)
  const USERS = {
    u_sales1: { name: '이도윤', dept: '비즈니스1유닛', role: 'SALES' },
    u_sales2: { name: '정하은', dept: '비즈니스2유닛', role: 'SALES' },
    u_head: { name: '최민준', dept: '비즈니스1유닛', role: 'HEAD' },
    u_legal: { name: '김지우', dept: '경영지원유닛', role: 'LEGAL' },
    u_privacy: { name: '한서연', dept: '정보보호유닛', role: 'PRIVACY' },
    u_finance: { name: '오현우', dept: '재무기획유닛', role: 'FINANCE' },
    u_admin: { name: '윤재민', dept: '경영지원유닛', role: 'ADMIN' },
    u_super: { name: '원지안', dept: '경영지원유닛', role: 'SUPER' },
    u_exec: { name: '문태호', dept: '비즈니스유닛', role: 'EXEC' },
    u_sadmin: { name: '배수아', dept: '세일즈어드민유닛', role: 'SALES_ADMIN' },
    u_ga: { name: '노은채', dept: '경영지원유닛', role: 'GA' },
    u_cem: { name: '임하준', dept: 'CEM유닛', role: 'CEM' },
  };

  // 시연용: 역할을 전환하면 이 사용자로 로그인한 것처럼 보입니다. (프로토타입 전용)
  //   u_로 시작하는 나머지 번호는 아래 계정 목록(ACCOUNTS)에서 만들어집니다.
  const DEMO_PERSONA = {
    SUPER: 'u_super',
    ADMIN: 'u_admin',
    SALES: 'u_sales1',
    HEAD: 'u_head',
    EXEC: 'u_exec',
    SALES_ADMIN: 'u_sadmin',
    SA_LEAD: 'u_jihoon_eom',
    LEGAL: 'u_legal',
    PRIVACY: 'u_privacy',
    SEC_LEAD: 'u_seungho_yeo',
    GA: 'u_ga',
    CEM: 'u_cem',
    CEM_LEAD: 'u_yeonwoo_joo',
    FINANCE: 'u_finance',
    FIN_LEAD: 'u_seojin_ma',
    FIN_EXEC: 'u_jaewon_kook',
    COMPLIANCE: 'u_seoyul_ban', // 2026-11-02 덧붙임: 컴플라이언스 담당자(가상 인물). 지난 감사 열람은 끝남(ROLE_GRANTS RG-0001)
    OBSERVER: 'u_daon_yong',
    AUDIT: 'u_chaeyul_in',      // 2026-11-02 C-2: 감사 열람(가상 인물, 내부감사). 끝나는 날 2027-01-11(ROLE_GRANTS RG-0002)
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
    OPS_REVIEW: { label: '운영 검토', tone: 'progress' }, // 4단계: 체결 뒤 운영 적용(고객지원), 재무 확인 [가정]
    ACTIVE: { label: '계약 완료', tone: 'success' },      // 5단계: 계약 완료, 보관함에 보관, 계약 기간 중
    EXPIRED: { label: '만료', tone: 'neutral' },
    TERMINATED: { label: '해지', tone: 'neutral' },
  };

  // 계약종류 (REQ-FLOW-08~09: 연장, 변경은 원계약(parentId)과 연결)
  // 해지(TERMINATE)는 원계약을 기간 중에 끝내는 기안 (REQ-FLOW-29, 번호 끝 -T01)
  // 운영 변경(CHANGE)은 계약서를 바꾸지 않고 기간 변경이나 추가 충전만 하는 기안 (번호 끝 -C01, 재무 문서 반영 v0.26)
  // 계약종류(v0.34 기획자 결정: 계약 구분에서 이름을 바꾸고 RENEW의 이름도 연장으로, 내부 CRM과 맞춤). 코드 RENEW는 그대로
  const KINDS = { NEW: '신규', AMEND: '변경', RENEW: '연장', TERMINATE: '해지', CHANGE: '운영 변경' };
  // 운영 변경 종류: 한 번에 한 가지만 (재무 문서 원칙)
  const CHANGE_TYPES = { PERIOD: '계약 기간 변경', CK_FREE: 'CK 무상 추가 충전', CK_PAID: 'CK 유상 추가 충전', HR_FREE: 'HR 무상 추가 충전', HR_PAID: 'HR 유상 추가 충전' };
  // 운영 변경에서 ③ 영업 검토를 거치는 기준 (재무 문서): 기간이 2개월 넘게 바뀜, 무상 충전이 50건을 넘음. 유상 충전은 영업 검토 없음
  //   기획자 결정 2026-11-02 B-4: 무상 충전 50건은 계약 연도마다 더해서 셈(같은 계약 연도의 앞선 무상 충전 + 이번 신청, common.js freeChargeUsed)
  //   기획자 결정 2026-11-02 B-3(추천과 다름): 운영 변경 모두 ⑨ 다음 ⑩ 재무 확인까지 끝나야 계약 완료(REQ-CHG-10). 유상 충전의 ③은 지금처럼 없음
  const CHANGE_RULES = { periodMonths: 2, freeQty: 50 };

  /* ---------- 계약 등록(SCR-11) 선택지 (요구사항 정의서 3.4) ---------- */
  const METHODS = { DIRECT: '직접', PROCURE: '조달', INDIRECT: '간접' };      // C-10 확정. v0.34: 리셀러 → 간접, 계약 유형을 합침
  const SETTLEMENTS = { LUMP: '일시', SPLIT: '분할', POST: '후불' };          // C-10 확정
  // 간접 계약에서 사용 업체를 아직 모를 때 고르는 까닭 (v0.62, 표준 대응표 G-19, 데이터 정의서 CODE-END-USER-PENDING) [가정]
  //   총판 재고나 최소 구매 약정은 체결 때 쓸 기관이 정해지지 않음. OTHER는 까닭을 직접 적음
  const END_USER_PENDING = [
    { code: 'STOCK', label: '총판 재고 공급' },
    { code: 'MIN_PURCHASE', label: '최소 구매 약정' },
    { code: 'OTHER', label: '그 밖의 까닭' },
  ];
  // 체크리스트 4번(회계에 영향을 주는 특수 조건)의 종류 (기획자 결정 2026-11-02 B-6, G-07, REQ-CHK-08)
  //   4번이 "예"이면 하나 이상 고르고 비고도 꼭 적음. 계약 기록 checklist.acctKinds(코드 목록)에 남아 종류별로 셀 수 있음
  const ACCT_KINDS = [
    { code: 'FREE_PERIOD', label: '무상 기간' },
    { code: 'FREE_EXTRA', label: '무상 추가 제공' },
    { code: 'REFUND_RIGHT', label: '해지 환불권' },
    { code: 'USAGE_FEE', label: '사용량이나 성과에 따른 대가' },
    { code: 'RETURN', label: '반품이나 취소' },
  ];

  /* ---------- 서비스 [가정] ----------
   * 계약명은 따로 두지 않고, 계약은 고객사와 서비스로 구분합니다. (v0.12 확정)
   * 계약의 서비스는 계약에 넣은 제품이 속한 서비스(대분류)를 모은 것. 서비스 목록은 코드 관리(SCR-56)에서 관리 */
  // 서비스 = 대분류 (v0.56 기획자 결정: 서비스 > 제품 > 기능 = 대분류 > 중분류 > 소분류). 화면에는 CK, HR, 기타 세 가지만
  const SERVICES = { CK: 'CK', HR: 'HR', ETC: '기타' };

  /* ---------- 표준계약서와 그 판 (v0.53 기획자 요청, SCR-45 표준계약서, REQ-CHK-09) ----------
   * 법무가 정한 표준계약서마다 판(버전)을 쌓음. 적용 시작일이 오늘 이전인 판 중 가장 늦은 것이 "지금 판", 오늘 뒤면 "예정"
   * 판은 지우거나 덮어쓰지 않음(지난 계약이 어느 판을 썼는지 남게). 새 판은 법무와 관리자, 최고관리자가 올리고 사유와 근거를 남김
   * 계약 등록의 체크리스트 1번에서 "기준 표준계약서"를 고르면 그때의 판이 계약에 남음(상대방 양식이면 OWN)
   * service: 주로 쓰는 서비스(없으면 모든 서비스) / versions: no, from(적용 시작일), summary(바뀐 조항), basis(근거), by, at, file
   * 시연용 가상 값입니다. 실제 표준계약서와 조항 번호가 아닙니다. */
  const TEMPLATES = [
    { id: 'TPL-CK', name: '카피킬러 SaaS 이용계약서', service: 'CK', versions: [
      { no: 1, from: '2026-09-01', summary: '시스템 도입: 지금 쓰는 표준계약서를 그대로 올림', basis: '법무 검토 기록 2026-08-28', by: 'u_legal', at: '2026-09-01 09:00' },
      { no: 2, from: '2026-10-01', summary: '제12조 손해배상 한도를 "연간 이용료 총액"으로 분명히 함, 제15조 개인정보 처리 조항을 개정 법령에 맞춤', basis: '법무 검토 기록 2026-09-24', by: 'u_legal', at: '2026-09-25 14:00' },
    ] },
    { id: 'TPL-HR', name: 'HR 서비스 이용계약서', service: 'HR', versions: [
      { no: 1, from: '2026-09-01', summary: '시스템 도입: 지금 쓰는 표준계약서를 그대로 올림', basis: '법무 검토 기록 2026-08-28', by: 'u_legal', at: '2026-09-01 09:00' },
    ] },
    { id: 'TPL-DPA', name: '개인정보 처리위탁 계약서', service: '', versions: [
      { no: 1, from: '2026-09-01', summary: '시스템 도입: 지금 쓰는 표준계약서를 그대로 올림', basis: '정보보호유닛 검토 2026-08-27', by: 'u_legal', at: '2026-09-01 09:00' },
      { no: 2, from: '2026-11-01', summary: '제7조 재위탁 사전 동의 절차와 제10조 파기 확인서 서식을 더함', basis: '정보보호유닛 검토 2026-10-15', by: 'u_legal', at: '2026-10-16 11:00' },
    ] },
    { id: 'TPL-SLA', name: '서비스 수준 협약서(SLA)', service: '', versions: [
      { no: 1, from: '2026-09-01', summary: '시스템 도입: 지금 쓰는 표준 협약서를 그대로 올림', basis: '법무 검토 기록 2026-08-28', by: 'u_legal', at: '2026-09-01 09:00' },
      // 기획자 결정 2026-11-02 C-8 시연: 다른 법무(송민재)가 올린 새 판. 설정 변경 확인(SCR-65)에서 올린 사람이 아닌 법무(김지우)가 확인할 차례
      { no: 2, from: '2026-11-01', summary: '제4조 장애 등급마다 복구 목표 시간을 표로 정리, 제6조 서비스 크레딧 상한을 월 이용료의 10%로 적음', basis: '법무 검토 기록 2026-10-13', by: 'u_minjae_song', at: '2026-10-14 15:00' },
    ] },
  ];
  // 기획자 결정 2026-11-02 C-15: 판마다 반부패 조항 표시(antiBribery: true 있음, false 없음). 새 판을 올릴 때 꼭 고름(templates.js)
  //   시연용: 지금 있는 판은 모두 "있음" [가정]. 실제 표준계약서에 조항이 있는지는 운영 시작 전에 법무가 판마다 확인
  TEMPLATES.forEach(function (t) { t.versions.forEach(function (v) { v.antiBribery = true; }); });

  /* ---------- 제품과 기능 (v0.47 기획자 요청, v0.49 두 단계로 줄임. SCR-58 제품과 기능 관리) ----------
   * 서비스 > 제품 > 기능 = 대분류 > 중분류 > 소분류(v0.56 기획자 결정). 서비스는 CK, HR, 기타 세 가지
   *   - 플랜은 없앰(v0.49). 가격(표준 단가, 할인율 한도)은 기능마다 하나(아래 PRICE_ROWS)
   *   - 제품은 어느 서비스 아래인지 관리자가 고름. 계약의 서비스는 고른 제품의 서비스를 모은 것
   *     (v0.49~v0.55는 서비스를 위계로 보지 않고 제품 이름에서 저절로 정했음)
   * 목록은 기획자 서비스 정리표(무하유_서비스_정리_261023_v2.xlsx, 2026-10-23)를 그대로 옮김(D-09): CK 제품 18개, HR 제품 3개
   *   - crm: 판다(CRM) 코드번호. 옛 체계라 기획자가 다시 정할 예정 [가정]. 한 제품에 코드가 여럿(몬스터: MCT, MON)이면 기능마다 둠
   *   - 기능이 따로 없는 제품(예: 카피킬러 플러그인)은 이름 없는 기능 하나를 둠(화면에는 "기능 구분 없음"). 계약 줄과 가격이 늘 기능을 가리키게 [가정]
   *   - 표에 없는 예전 시연 기능(추가 이용자, API 연동, 프리즘 표절검사)과 제품 프리즘Q는 사용 안 함(지난 계약에는 그대로 보임)
   * 관리자와 최고관리자가 제품과 기능 관리(SCR-58)에서 넣고 고침. 지우지 않고 사용 안 함으로 돌림(지난 계약의 뜻이 남게)
   * PRODUCTS: id, service(서비스 코드 = 대분류), name, crm(CRM 코드, 기능마다 다르면 빈칸), use / FEATURES: id, product(제품 id), name, crm, use */
  const PRODUCTS = [
    ['CK_CAMPUS', 'CK', '카피킬러 캠퍼스', 'CAM', true],
    ['CK_GPK', 'CK', 'GPT Killer', 'GPK', true],
    ['CK_BRD', 'CK', 'CK 브릿지', 'BRD', true],
    ['CK_BCR', 'CK', '블라인드체커', 'BCR', true],
    ['CK_CKP', 'CK', 'CK PASS', 'CKP', true],
    ['CK_PLG', 'CK', '카피킬러 플러그인', 'PLG', true],
    ['CK_SCHOOL', 'CK', '카피킬러 스쿨', 'SCL', true],
    ['CK_CIT', 'CK', '카피킬러 출처검사', 'CIT', true],
    ['CK_LNK', 'CK', '카피킬러 링크', 'LNK', true],
    ['CK_CKV', 'CK', '카피킬러 자격검증', 'CKV', true],
    ['CK_PLS', 'CK', '카피킬러 플러스', 'PLS', true],
    ['CK_CHN', 'CK', '카피킬러 채널', 'CHN', true],
    ['CK_CKM', 'CK', '카피킬러 MKT', 'CKM', true],
    ['CK_ITP', 'CK', '카피킬러 아이템풀', 'ITP', true],
    ['CK_CONTEST', 'CK', '카피킬러 콘테스트', 'CON', true],
    ['CK_LTE', 'CK', '카피킬러 라이트', 'LTE', true],
    ['CK_EDU', 'CK', '카피킬러 에듀', 'EDU', true],
    ['CK_X', 'CK', '카피킬러 X', '', true],
    ['HR_PRISM', 'HR', '프리즘', 'PRM', true],
    ['HR_MONSTER', 'HR', '몬스터', '', true],
    ['HR_CROSS', 'HR', '교차진단', 'TES', true],
    ['HR_PRISM_Q', 'HR', '프리즘Q', '', false], // 표(2026-10-23)에서 프리즘의 기능이 되어 사용 안 함
  ].map(function (r) { return { id: r[0], service: r[1], name: r[2], crm: r[3], use: r[4] }; });
  const FEATURES = [
    ['CK_CAMPUS_PLAG', 'CK_CAMPUS', '표절검사', 'CAM', true],
    ['CK_CAMPUS_GPTK', 'CK_CAMPUS', 'GPT Killer', 'CAM', true],
    ['CK_CAMPUS_CITE', 'CK_CAMPUS', '출처 표기법 검사', 'CAM', true],
    ['CK_CAMPUS_FAKE', 'CK_CAMPUS', '가짜 출처 검사', 'CAM', true],
    ['CK_CAMPUS_PATENT', 'CK_CAMPUS', 'CK Patent', 'CAM', true],
    ['CK_CAMPUS_ORAL', 'CK_CAMPUS', 'CK 구술평가', 'CAM', true],
    ['CK_GPK_ALL', 'CK_GPK', '', 'GPK', true],
    ['CK_BRD_ALL', 'CK_BRD', '', 'BRD', true],
    ['CK_BCR_ALL', 'CK_BCR', '', 'BCR', true],
    ['CK_CKP_ALL', 'CK_CKP', '', 'CKP', true],
    ['CK_PLG_ALL', 'CK_PLG', '', 'PLG', true],
    ['CK_SCHOOL_ALL', 'CK_SCHOOL', '', 'SCL', true],
    ['CK_CIT_ALL', 'CK_CIT', '', 'CIT', true],
    ['CK_LNK_ALL', 'CK_LNK', '', 'LNK', true],
    ['CK_CKV_ALL', 'CK_CKV', '', 'CKV', true],
    ['CK_PLS_ALL', 'CK_PLS', '', 'PLS', true],
    ['CK_CHN_ALL', 'CK_CHN', '', 'CHN', true],
    ['CK_CKM_ALL', 'CK_CKM', '', 'CKM', true],
    ['CK_ITP_ALL', 'CK_ITP', '', 'ITP', true],
    ['CK_CONTEST_ALL', 'CK_CONTEST', '', 'CON', true],
    ['CK_LTE_ALL', 'CK_LTE', '', 'LTE', true],
    ['CK_EDU_ALL', 'CK_EDU', '', 'EDU', true],
    ['CK_X_ALL', 'CK_X', '', '', true],
    ['HR_PRISM_DEFECT', 'HR_PRISM', '결함·표절검사', 'PRM', true],
    ['HR_PRISM_BLIND_A', 'HR_PRISM', '블라인드 A', 'PRM', true],
    ['HR_PRISM_BLIND_B', 'HR_PRISM', '블라인드 B', 'PRM', true],
    ['HR_PRISM_GPTK', 'HR_PRISM', 'GPT Killer', 'PRM', true],
    ['HR_PRISM_BP', 'HR_PRISM', 'BP 평가', 'PRM', true],
    ['HR_PRISM_RP', 'HR_PRISM', 'RP 매칭', 'PRM', true],
    ['HR_PRISM_PRISMQ', 'HR_PRISM', '프리즘Q', 'PRM', true],
    ['HR_PRISM_PAC', 'HR_PRISM', 'PAC', 'PRM', true],
    ['HR_PRISM_FEEDBACK', 'HR_PRISM', '프리즘 피드백 자료', 'PRM', true],
    ['HR_MONSTER_MCT_RISK', 'HR_MONSTER', '역량검사(부적응 가능성 검사)', 'MCT', true],
    ['HR_MONSTER_MCT', 'HR_MONSTER', '역량검사', 'MCT', true],
    ['HR_MONSTER_E', 'HR_MONSTER', '몬스터 E', 'MON', true],
    ['HR_MONSTER_P', 'HR_MONSTER', '몬스터 P', 'MON', true],
    ['HR_MONSTER_G', 'HR_MONSTER', '몬스터 G', 'MON', true],
    ['HR_MONSTER_A', 'HR_MONSTER', '몬스터 A', 'MON', true],
    ['HR_MONSTER_O', 'HR_MONSTER', '몬스터 O', 'MON', true],
    ['HR_MONSTER_MAC', 'HR_MONSTER', 'MAC', 'MON', true],
    ['HR_MONSTER_PROXY', 'HR_MONSTER', '응시운영대행', 'MON', true],
    ['HR_MONSTER_DEEPQ', 'HR_MONSTER', '면접 답변 기반 심층 질문', 'MON', true],
    ['HR_MONSTER_FEEDBACK', 'HR_MONSTER', '몬스터 피드백 자료', 'MON', true],
    ['HR_CROSS_PRISM_MCT', 'HR_CROSS', '프리즘×역량검사', 'TES', true],
    ['HR_CROSS_MONSTER_MCT', 'HR_CROSS', '몬스터×역량검사', 'TES', true],
    ['HR_CROSS_PRISM_MONSTER', 'HR_CROSS', '프리즘×몬스터', 'TES', true],
    // 표(2026-10-23)에 없는 예전 시연 기능: 지난 계약에 남아 있어 지우지 않고 사용 안 함
    ['CK_CAMPUS_USER', 'CK_CAMPUS', '추가 이용자', 'CAM', false], ['CK_CAMPUS_API', 'CK_CAMPUS', 'API 연동', 'CAM', false],
    ['HR_PRISM_PLAG', 'HR_PRISM', '표절검사', 'PRM', false], // 결함·표절검사(HR_PRISM_DEFECT)로 합쳐짐
  ].map(function (r) { return { id: r[0], product: r[1], name: r[2], crm: r[3], use: r[4] }; });

  /* ---------- 가격 기준: 기능마다 표준 단가와 할인율 한도(cap) (REQ-SCOPE-02, REQ-CHK-04, REQ-CHK-07) ----------
   * 시연용 가상 값입니다. 실제 단가가 아닙니다.
   * 관리자가 "가격 기준 관리"(SCR-54)에서 관리하고, 영업, 영업지원, 관리자만 볼 수 있습니다.
   * PRICE_ROWS: 바뀐 이력 전체. 값을 바꿀 때는 기존 줄을 고치지 않고 새 적용 시작일로 새 줄을 더합니다(데이터 정의서 8장).
   *   feature: 값을 매기는 기능(FEATURES의 id). v0.49부터 가격은 기능마다 하나라 이것이 가격 기준의 열쇠(예전 플랜 코드와 플랜 이름은 없앰)
   *   product, service: 그 기능의 제품과 그 제품의 서비스(대분류)
   *   unit: 단위 / listPrice: 표준 단가(원, 부가세 별도) / discountCap: 할인율 한도(이 비율까지 할인 가능)
   *   validFrom: 적용 시작일(이날 이후 기안하는 계약부터) / docUrl: 사내 품의 문서 링크(필수) / docNo: 품의 번호 / reason: 변경 사유
   *   by, at: 바꾼 사람과 일시. 품의 문서 주소와 번호는 가상입니다.
   * PRICE_BOOK: 오늘 적용되는 줄만 모은 표. 계약 등록 화면이 씁니다(common.js가 관리자 변경을 반영해 다시 만듦).
   * v0.49: 예전 제품 줄(CK 기관 라이선스 = 카피킬러 캠퍼스 표절검사, CK 추가 이용자 = 카피킬러 캠퍼스 추가 이용자, HR 서비스 기본 = 프리즘 결함검사,
   *   HR 추가 모듈 = 프리즘 표절검사 등)을 기능에 하나씩 붙임. 프리즘 GPT Killer의 두 플랜(v0.47)은 하나로 합침 */
  const PRICE_DOC = 'https://gw.muhayu.com/approval/';
  const PRICE_ROWS = [
    { feature: 'CK_CAMPUS_PLAG', product: 'CK_CAMPUS', service: 'CK', unit: '기관, 1년', listPrice: 12000000, discountCap: 0.20, validFrom: '2026-09-01', docUrl: PRICE_DOC + '2026-0812', docNo: '경영지원-2026-0812', reason: '시스템 도입: 2026년 표준단가표 등록', by: 'u_super', at: '2026-09-01 09:00' },
    { feature: 'CK_CAMPUS_USER', product: 'CK_CAMPUS', service: 'CK', unit: '100명, 1년', listPrice: 1400000, discountCap: 0.15, validFrom: '2026-09-01', docUrl: PRICE_DOC + '2026-0812', docNo: '경영지원-2026-0812', reason: '시스템 도입: 2026년 표준단가표 등록', by: 'u_super', at: '2026-09-01 09:00' },
    { feature: 'CK_CAMPUS_GPTK', product: 'CK_CAMPUS', service: 'CK', unit: '기관, 1년', listPrice: 2400000, discountCap: 0.15, validFrom: '2026-09-01', docUrl: PRICE_DOC + '2026-0812', docNo: '경영지원-2026-0812', reason: '시스템 도입: 2026년 표준단가표 등록', by: 'u_super', at: '2026-09-01 09:00' },
    { feature: 'CK_CAMPUS_API', product: 'CK_CAMPUS', service: 'CK', unit: '1식, 1년', listPrice: 6000000, discountCap: 0.10, validFrom: '2026-09-01', docUrl: PRICE_DOC + '2026-0812', docNo: '경영지원-2026-0812', reason: '시스템 도입: 2026년 표준단가표 등록', by: 'u_super', at: '2026-09-01 09:00' },
    { feature: 'HR_PRISM_DEFECT', product: 'HR_PRISM', service: 'HR', unit: '기관, 1년', listPrice: 9600000, discountCap: 0.20, validFrom: '2026-09-01', docUrl: PRICE_DOC + '2026-0812', docNo: '경영지원-2026-0812', reason: '시스템 도입: 2026년 표준단가표 등록', by: 'u_super', at: '2026-09-01 09:00' },
    { feature: 'HR_PRISM_PLAG', product: 'HR_PRISM', service: 'HR', unit: '기관, 1년', listPrice: 3600000, discountCap: 0.15, validFrom: '2026-09-01', docUrl: PRICE_DOC + '2026-0812', docNo: '경영지원-2026-0812', reason: '시스템 도입: 2026년 표준단가표 등록', by: 'u_super', at: '2026-09-01 09:00' },
    { feature: 'HR_PRISM_BLIND_A', product: 'HR_PRISM', service: 'HR', unit: '기관, 1년', listPrice: 3000000, discountCap: 0.20, validFrom: '2026-09-01', docUrl: PRICE_DOC + '2026-0812', docNo: '경영지원-2026-0812', reason: '시스템 도입: 2026년 표준단가표 등록', by: 'u_super', at: '2026-09-01 09:00' },
    { feature: 'HR_PRISM_GPTK', product: 'HR_PRISM', service: 'HR', unit: '기관, 1년', listPrice: 4800000, discountCap: 0.15, validFrom: '2026-09-01', docUrl: PRICE_DOC + '2026-0812', docNo: '경영지원-2026-0812', reason: '시스템 도입: 2026년 표준단가표 등록', by: 'u_super', at: '2026-09-01 09:00' },
    // 바뀐 예: 카피킬러 캠퍼스 추가 이용자 단가 인상(10월 1일부터)
    { feature: 'CK_CAMPUS_USER', product: 'CK_CAMPUS', service: 'CK', unit: '100명, 1년', listPrice: 1500000, discountCap: 0.15, validFrom: '2026-10-01', docUrl: PRICE_DOC + '2026-0915', docNo: '경영지원-2026-0915', reason: '추가 이용자 단가 인상(서버 비용 반영)', by: 'u_admin', at: '2026-09-24 15:10' },
    // ---- 기획자 서비스 정리표(2026-10-23 받음): HR은 표의 가격(원/건), CK는 표에 없어 임의 값(기획자가 나중에 줌) ----
    //   할인율 한도는 표에 없어 0%(할인하면 체크리스트 3번이 아니요가 되어 영업 검토) [가정]
    { feature: 'CK_CAMPUS_CITE', product: 'CK_CAMPUS', service: 'CK', unit: '기관, 1년', listPrice: 1200000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '임의 값: 기획자가 카피킬러 가격을 나중에 줌', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'CK_CAMPUS_FAKE', product: 'CK_CAMPUS', service: 'CK', unit: '기관, 1년', listPrice: 1200000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '임의 값: 기획자가 카피킬러 가격을 나중에 줌', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'CK_CAMPUS_PATENT', product: 'CK_CAMPUS', service: 'CK', unit: '기관, 1년', listPrice: 3000000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '임의 값: 기획자가 카피킬러 가격을 나중에 줌', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'CK_CAMPUS_ORAL', product: 'CK_CAMPUS', service: 'CK', unit: '기관, 1년', listPrice: 2400000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '임의 값: 기획자가 카피킬러 가격을 나중에 줌', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'CK_GPK_ALL', product: 'CK_GPK', service: 'CK', unit: '기관, 1년', listPrice: 1000000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '임의 값: 기획자가 카피킬러 가격을 나중에 줌', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'CK_BRD_ALL', product: 'CK_BRD', service: 'CK', unit: '기관, 1년', listPrice: 1000000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '임의 값: 기획자가 카피킬러 가격을 나중에 줌', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'CK_BCR_ALL', product: 'CK_BCR', service: 'CK', unit: '기관, 1년', listPrice: 1000000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '임의 값: 기획자가 카피킬러 가격을 나중에 줌', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'CK_CKP_ALL', product: 'CK_CKP', service: 'CK', unit: '기관, 1년', listPrice: 1000000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '임의 값: 기획자가 카피킬러 가격을 나중에 줌', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'CK_PLG_ALL', product: 'CK_PLG', service: 'CK', unit: '기관, 1년', listPrice: 1000000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '임의 값: 기획자가 카피킬러 가격을 나중에 줌', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'CK_SCHOOL_ALL', product: 'CK_SCHOOL', service: 'CK', unit: '기관, 1년', listPrice: 1000000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '임의 값: 기획자가 카피킬러 가격을 나중에 줌', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'CK_CIT_ALL', product: 'CK_CIT', service: 'CK', unit: '기관, 1년', listPrice: 1000000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '임의 값: 기획자가 카피킬러 가격을 나중에 줌', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'CK_LNK_ALL', product: 'CK_LNK', service: 'CK', unit: '기관, 1년', listPrice: 1000000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '임의 값: 기획자가 카피킬러 가격을 나중에 줌', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'CK_CKV_ALL', product: 'CK_CKV', service: 'CK', unit: '기관, 1년', listPrice: 1000000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '임의 값: 기획자가 카피킬러 가격을 나중에 줌', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'CK_PLS_ALL', product: 'CK_PLS', service: 'CK', unit: '기관, 1년', listPrice: 1000000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '임의 값: 기획자가 카피킬러 가격을 나중에 줌', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'CK_CHN_ALL', product: 'CK_CHN', service: 'CK', unit: '기관, 1년', listPrice: 1000000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '임의 값: 기획자가 카피킬러 가격을 나중에 줌', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'CK_CKM_ALL', product: 'CK_CKM', service: 'CK', unit: '기관, 1년', listPrice: 1000000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '임의 값: 기획자가 카피킬러 가격을 나중에 줌', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'CK_ITP_ALL', product: 'CK_ITP', service: 'CK', unit: '기관, 1년', listPrice: 1000000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '임의 값: 기획자가 카피킬러 가격을 나중에 줌', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'CK_CONTEST_ALL', product: 'CK_CONTEST', service: 'CK', unit: '기관, 1년', listPrice: 1000000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '임의 값: 기획자가 카피킬러 가격을 나중에 줌', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'CK_LTE_ALL', product: 'CK_LTE', service: 'CK', unit: '기관, 1년', listPrice: 1000000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '임의 값: 기획자가 카피킬러 가격을 나중에 줌', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'CK_EDU_ALL', product: 'CK_EDU', service: 'CK', unit: '기관, 1년', listPrice: 1000000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '임의 값: 기획자가 카피킬러 가격을 나중에 줌', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'CK_X_ALL', product: 'CK_X', service: 'CK', unit: '기관, 1년', listPrice: 1000000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '임의 값: 기획자가 카피킬러 가격을 나중에 줌', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'HR_PRISM_DEFECT', product: 'HR_PRISM', service: 'HR', unit: '건', listPrice: 8000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '기획자 서비스 정리표(2026-10-23)', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'HR_PRISM_BLIND_A', product: 'HR_PRISM', service: 'HR', unit: '건', listPrice: 4000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '기획자 서비스 정리표(2026-10-23)', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'HR_PRISM_BLIND_B', product: 'HR_PRISM', service: 'HR', unit: '건', listPrice: 4000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '기획자 서비스 정리표(2026-10-23)', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'HR_PRISM_GPTK', product: 'HR_PRISM', service: 'HR', unit: '건', listPrice: 6000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '기획자 서비스 정리표(2026-10-23)', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'HR_PRISM_BP', product: 'HR_PRISM', service: 'HR', unit: '건', listPrice: 20000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '기획자 서비스 정리표(2026-10-23)', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'HR_PRISM_RP', product: 'HR_PRISM', service: 'HR', unit: '건', listPrice: 10000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '기획자 서비스 정리표(2026-10-23)', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'HR_PRISM_PRISMQ', product: 'HR_PRISM', service: 'HR', unit: '건', listPrice: 50000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '기획자 서비스 정리표(2026-10-23)', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'HR_PRISM_PAC', product: 'HR_PRISM', service: 'HR', unit: '건', listPrice: 10000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '기획자 서비스 정리표(2026-10-23)', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'HR_PRISM_FEEDBACK', product: 'HR_PRISM', service: 'HR', unit: '건', listPrice: 10000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '기획자 서비스 정리표(2026-10-23)', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'HR_MONSTER_MCT_RISK', product: 'HR_MONSTER', service: 'HR', unit: '건', listPrice: 10000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '기획자 서비스 정리표(2026-10-23)', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'HR_MONSTER_MCT', product: 'HR_MONSTER', service: 'HR', unit: '건', listPrice: 20000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '기획자 서비스 정리표(2026-10-23)', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'HR_MONSTER_E', product: 'HR_MONSTER', service: 'HR', unit: '건', listPrice: 10000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '기획자 서비스 정리표(2026-10-23)', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'HR_MONSTER_P', product: 'HR_MONSTER', service: 'HR', unit: '건', listPrice: 20000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '기획자 서비스 정리표(2026-10-23)', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'HR_MONSTER_G', product: 'HR_MONSTER', service: 'HR', unit: '건', listPrice: 35000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '기획자 서비스 정리표(2026-10-23)', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'HR_MONSTER_A', product: 'HR_MONSTER', service: 'HR', unit: '건', listPrice: 70000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '기획자 서비스 정리표(2026-10-23)', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'HR_MONSTER_O', product: 'HR_MONSTER', service: 'HR', unit: '건', listPrice: 35000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '기획자 서비스 정리표(2026-10-23)', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'HR_MONSTER_MAC', product: 'HR_MONSTER', service: 'HR', unit: '건', listPrice: 35000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '기획자 서비스 정리표(2026-10-23)', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'HR_MONSTER_PROXY', product: 'HR_MONSTER', service: 'HR', unit: '건', listPrice: 2000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '기획자 서비스 정리표(2026-10-23)', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'HR_MONSTER_DEEPQ', product: 'HR_MONSTER', service: 'HR', unit: '건', listPrice: 8000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '기획자 서비스 정리표(2026-10-23)', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'HR_MONSTER_FEEDBACK', product: 'HR_MONSTER', service: 'HR', unit: '건', listPrice: 35000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '기획자 서비스 정리표(2026-10-23)', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'HR_CROSS_PRISM_MCT', product: 'HR_CROSS', service: 'HR', unit: '건', listPrice: 10000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '기획자 서비스 정리표(2026-10-23)', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'HR_CROSS_MONSTER_MCT', product: 'HR_CROSS', service: 'HR', unit: '건', listPrice: 10000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '기획자 서비스 정리표(2026-10-23)', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'HR_CROSS_PRISM_MONSTER', product: 'HR_CROSS', service: 'HR', unit: '건', listPrice: 10000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '기획자 서비스 정리표(2026-10-23)', by: 'u_super', at: '2026-10-19 09:00' },
    // 기획자 결정 2026-11-02 E-4(C-33 ③): 남은 시연 한도(카피킬러 캠퍼스 표절검사 20%, GPT Killer 15%)도 다른 기능처럼 0% [가정]
    //   실제 한도는 운영 시작 전에 품의 문서와 함께 기능마다 넣음. 단가는 그대로. 기존 줄은 고치지 않고 새 줄을 더함(이력)
    //   이미 기안한 계약은 기안한 날의 한도(20%, 15%)로 결재선을 정함(common.js capOver, pricesAt). 새로 기안하는 계약부터 0%
    { feature: 'CK_CAMPUS_PLAG', product: 'CK_CAMPUS', service: 'CK', unit: '기관, 1년', listPrice: 12000000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '남은 시연 한도 20%를 다른 기능처럼 0%로(실제 한도는 운영 시작 전에 품의와 함께)', by: 'u_super', at: '2026-10-19 09:00' },
    { feature: 'CK_CAMPUS_GPTK', product: 'CK_CAMPUS', service: 'CK', unit: '기관, 1년', listPrice: 2400000, discountCap: 0, validFrom: '2026-10-19', docUrl: PRICE_DOC + '2026-1023', docNo: '기획-2026-1023', reason: '남은 시연 한도 15%를 다른 기능처럼 0%로(실제 한도는 운영 시작 전에 품의와 함께)', by: 'u_super', at: '2026-10-19 09:00' },
  ];
  // 오늘 적용되는 줄: 기능마다 적용 시작일이 오늘 이전인 줄 중 가장 늦은 것
  function currentPrices(rows, today) {
    const by = {};
    rows.forEach(function (r) {
      if (r.validFrom > today) return;
      if (!by[r.feature] || by[r.feature].validFrom <= r.validFrom) by[r.feature] = r;
    });
    const order = [];
    rows.forEach(function (r) { if (order.indexOf(r.feature) < 0) order.push(r.feature); });
    return order.filter(function (c) { return by[c]; }).map(function (c) { return by[c]; });
  }
  const PRICE_BOOK = currentPrices(PRICE_ROWS, TODAY);

  /* ---------- 업무 세부 단계 (요구사항 정의서 3.2, 데이터 정의서 CODE-STEP) ----------
   * role: 담당 역할 / short: 짧은 이름(현재 진행 칸, 결재란 머리에 씀) */
  // 기획자 결정 2026-11-02 D-3(C-40 ③): 짧은 이름은 하는 일 대신 "누가 처리하는지"로 바꿈(예전: 체크리스트, 영업, 개인정보, 인장, 체결본, 체결본 확인, 운영)
  //   영업이 "③ 영업"을 내 차례로 잘못 읽지 않게. 여기 이름은 기본값이고, 계약마다 다른 사람이 맡으면
  //   common.js stepWho가 그 사람 이름으로 바꿈(③ 리더 본인 계약은 영업 임원, 영업지원이 기안한 ②⑧과 HR 충전의 ⑨는 재무)
  // done: 끝났을 때 결재란에 쓰는 말(없으면 "승인") / doneAction: 결재 기록의 "한 일"(없으면 "승인")
  // ing: 그 단계가 차례일 때 현재 진행 칸에 쓰는 말 (3단계 계약 체결, 4단계 운영 검토)
  const STEPS = {
    S01: { no: '①', name: '계약 등록과 기안', short: '기안', role: 'SALES' },
    S02: { no: '②', name: '체크리스트 검토', short: '영업지원', role: 'SALES_ADMIN' },
    S03: { no: '③', name: '영업 검토', short: '영업 리더', role: 'HEAD' },
    // 기획자 결정 2026-11-02 E-3(A안, 추천과 다름): 할인 폭이 큰 계약은 ③에서 유닛 리더 다음에 영업 임원(COO)도 승인
    //   같은 ③의 두 번째 승인이라 번호는 ③(③-2 같은 번호를 새로 만들지 않음). 맡는 사람 이름으로 "③ 영업 임원"
    //   거치는 조건은 common.js reviewRoute(PRICE_RULES.cooOverPp). 리더 본인 계약은 ③이 이미 영업 임원이라 거치지 않음
    S03C: { no: '③', name: '영업 임원 승인', short: '영업 임원', role: 'EXEC' },
    S04: { no: '④', name: '법무 검토', short: '법무', role: 'LEGAL' },
    S05: { no: '⑤', name: '개인정보 검토', short: '정보보호', role: 'PRIVACY' }, // 개인정보 검토는 정보보호 담당자가 함(역할 분야 이름)
    S06: { no: '⑥', name: '인장 날인 검토', short: '총무', role: 'GA', done: '날인', doneAction: '날인 완료', ing: '인장 날인 대기' },
    S07: { no: '⑦', name: '상대방 서명, 체결본 등록', short: '기안자', role: 'SALES', done: '등록', doneAction: '체결본 등록', ing: '체결본 등록 대기' },
    S08: { no: '⑧', name: '체결본 확인', short: '영업지원', role: 'SALES_ADMIN', done: '확인', doneAction: '확인 완료', ing: '체결본 확인 중' },
    S09: { no: '⑨', name: '운영 적용', short: '고객지원', role: 'CEM', done: '적용', doneAction: '운영 적용 완료', ing: '운영 적용 중' },
    S10: { no: '⑩', name: '재무 확인', short: '재무', role: 'FINANCE', done: '확인', doneAction: '재무 확인 완료', ing: '재무 확인 중' },
    S11: { no: '⑪', name: '계약 완료', short: '완료', role: null },
    // 계약이 끝난 뒤의 차례 (결재 단계 ①~⑩이 아니라 계약 완료 뒤에 생김. common.js 만료 처리와 유예)
    // 기획자 결정 2026-11-02 A-10: 만료 처리. 종료일이 지난 계약 묶음에 연장이나 새 계약 기안이 없으면 고객지원의 차례
    //   해지의 ⑨와 같은 확인 항목(OPS_CHECKS_END)을 남기고 재무 확인은 없음. 서비스를 닫는 일이라 번호는 ⑨
    SXP: { no: '⑨', name: '만료 처리', short: '고객지원', role: 'CEM', done: '처리', doneAction: '만료 처리 완료', ing: '만료 처리 대기' },
    // 기획자 결정 2026-11-02 A-11: 만료 유예 확인. 영업대표가 요청하면 그 유닛의 영업 리더(리더 본인 계약이면 영업 임원)가 확인
    //   영업 리더가 승인하는 일이라 번호는 ③. 요청은 영업대표의 일이라 결재 기록에서 단계 ① 기안(보완 완료와 같음)
    SGR: { no: '③', name: '만료 유예 확인', short: '영업 리더', role: 'HEAD' },
  };
  // 2단계 계약 검토의 순서: ② 다음 ③ 영업 검토(가격 예외 승인), 그다음 ④와 ⑤를 동시에 (REQ-STEP-04, v0.20에서 바뀜)
  //   할인은 법무 검토보다 먼저 확정합니다(사전 승인 원칙, 요구사항 정의서 3.6.1)
  //   기획자 결정 2026-11-02 E-3: ③ 다음에 ③ 영업 임원 승인(S03C)을 따로 한 묶음으로. 할인 폭이 클 때만 거치고, 끝나야 ④⑤로 감
  const REVIEW_GROUPS = [['S02'], ['S03'], ['S03C'], ['S04', 'S05']];
  // 3단계 계약 체결과 4단계 운영 검토의 순서: ⑥ → ⑦ → ⑧ → ⑨ → ⑩, 하나씩 차례로 (REQ-SIGN-01, v0.23)
  //   ⑨ 운영 적용 다음에 ⑩ 재무 확인 (기획자 결정). 생략하는 단계는 없습니다.
  const POST_GROUPS = [['S06'], ['S07'], ['S08'], ['S09'], ['S10']];
  // 단계를 처리하는 역할 (검토 완료 화면과 메뉴에 씀): 결재 역할 + 총무, 고객지원, 재무
  const PROCESS_ROLES = ['SALES_ADMIN', 'LEGAL', 'PRIVACY', 'HEAD', 'EXEC', 'GA', 'CEM', 'FINANCE'];
  // 단계별 담당자(처음 설정) [가정]. 관리자가 결재선 규칙(SCR-52)에서 바꾸면 ASSIGNEE_CHANGES에 쌓입니다. (REQ-AUTH-06)
  //   ③ 영업 검토는 기안자 유닛의 영업 리더(TEAM_LEADERS). 리더 본인이 기안한 계약은 영업 임원(COO) (REQ-AUTH-06, 12)
  const STEP_ASSIGNEE = {
    // S03: 리더 본인이 기안한 계약의 ③ 영업 검토(영업 임원). 팀원 계약은 TEAM_LEADERS의 유닛 리더 (재무 문서 반영 v0.26)
    S02: 'u_sadmin', S03: 'u_exec', S04: 'u_legal', S05: 'u_privacy',
    S06: 'u_ga', S08: 'u_sadmin', S09: 'u_cem', S10: 'u_finance',
    // 기획자 결정 2026-11-03(C-18 ⑤): 운영 변경의 HR 충전은 ⑨를 재무 담당자(S10)가 수불부에 반영하고, ⑩도 재무 담당자가 확인(재무 리더 아님, v0.29 그대로)
    //   ⑨를 한 사람은 ⑩을 하지 않으므로 ⑩은 다른 재무 담당자에게 감(common.js otherFinance)
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
    // 기획자 결정 2026-11-02 A-11: 만료 유예. 요청(영업대표, 사유와 기한 필수, 단계 S01), 확인과 반려(영업 리더, 반려 사유 필수, 단계 SGR)
    GRACE: { label: '유예 요청', tone: 'attention' },
    GRACE_OK: { label: '유예 확인', tone: 'success' },
    GRACE_NO: { label: '유예 반려', tone: 'danger' },
  };
  // ⑥ 총무가 날인 전에 계약서 실물과 맞춰 보는 항목 (REQ-FLOW-23, panda p.31)
  const SEAL_CHECKS = ['고객사명', '체결 제품', '계약 금액', '계약 기간'];
  /* ⑦ ⑧ 체결 확인 (v0.61, 통제와 표준 대응표 G-06: 내부회계 "체결된 계약이 승인 조건과 같음", ISO 37001 8.3, 8.4 이면 약정)
   * SIDE_DEAL_CHECK: ⑦ 체결본을 올리는 영업과 ⑧ 확인자가 각각 표시. 계약서 밖에서 고객과 따로 약속한 조건이 없다는 확인
   * SIGNED_CHECKS: ⑧ 체결본을 승인된 내용과 맞춰 보는 항목(⑥처럼 항목별. 예전에는 "승인된 내용과 같음", "서명과 날인" 두 줄)
   * SIGNED_MISMATCH: ⑧ 반려 때 어긋난 항목(하나 이상). 결재 기록에 코드로 남아 항목별로 셀 수 있음 [가정]
   *   서명이나 날인이 빠진 것은 계약 내용이 같으므로 반려가 아니라 "다시 등록 요청"(REQ-SIGN-04 기획자 결정)이라 넣지 않음(v0.61 검토)
   *   항목 이름 안에는 쉼표를 쓰지 않음: 결재 기록에 쉼표로 이어 적으므로 항목 경계가 보이게(v0.61 검토) */
  const SIDE_DEAL_CHECK = {
    S07: '승인된 내용 밖에 고객과 따로 약속한 조건(부속 합의나 메일과 메신저 약속 등)이 없습니다',
    S08: '체결본 밖의 다른 약정(부속 합의 등)이 없음을 확인했습니다',
  };
  const SIGNED_CHECKS = ['고객사와 사업자등록번호', '제품 줄의 수량과 금액과 합계', '계약 기간과 자동갱신과 해지 통지 일수', '정산 방식', '양쪽 서명과 날인'];
  const SIGNED_MISMATCH = [
    { code: 'PARTY', label: '고객사와 사업자등록번호' }, { code: 'AMOUNT', label: '제품과 수량과 금액' },
    { code: 'PERIOD', label: '계약 기간과 자동갱신과 통지 일수' }, { code: 'SETTLE', label: '정산 방식' },
    { code: 'SIDE', label: '계약서 밖 약정 발견' }, { code: 'OTHER', label: '그 밖의 것' },
  ];
  /* 견적서로 계약서를 대신함 (기획자 결정 2026-11-02 B-5, C-19, REQ-FLOW-24)
   * QUOTE_INSTEAD.under: 공급가액 합계(부가세 별도, 계약 금액 amount)가 이 금액 미만인 계약만 고를 수 있음(재무 제안 5백만 원)
   *   5백만 원 아래로 나눠 맺는 일은 같은 거래처 최근 계약 확인(E-2, G-05)으로 막음
   *   ⑦에서 체결본 대신 고객이 날인하거나 서명한 최종 견적서를 올리고, ⑧ 영업지원이 아래 항목으로 확인
   *   ⑥ 인장 날인은 지금처럼 둠 [가정]: 누가 날인할지는 재무 문서의 견적서 대체 규칙 2), 3)을 바로잡으며 정함(C-18 ④)
   * QUOTE_INSTEAD_CHECKS: ⑧ 확인 항목. 항목 이름 안에는 쉼표를 쓰지 않음(SIGNED_CHECKS와 같은 까닭) [가정] */
  const QUOTE_INSTEAD = { under: 5000000 };
  const QUOTE_INSTEAD_CHECKS = ['고객 날인이나 서명', '견적번호와 판', '제품과 수량과 금액이 결재한 견적과 같음', '견적 유효기간 안'];
  /* ② 체크리스트 검토와 보완 요청 (v0.63, 통제와 표준 대응표 G-05: 내부회계 "수작업 통제의 정밀도와 증거", ISO 37001 8.3, 8.4)
   * REVIEW_CHECKS: ② 승인 때 영업지원이 모두 확인하는 항목. ⑥, ⑧처럼 결재 기록에 "확인: ..."으로 남음 [가정]
   *   4번 항목: 4번 답이 아니요인데 계약서에 무상 기간이나 환불권 같은 조건이 숨어 있지 않은지
   * SUPPLEMENT_ITEMS: ②~⑤ 보완 요청 때 고르는 보완할 항목(하나 이상, ⑧ 반려의 어긋난 항목과 같은 방식). 결재 기록에 코드로 남아 통계에서 셈 [가정]
   *   항목 이름 안에는 쉼표를 쓰지 않음(SIGNED_MISMATCH와 같은 까닭) */
  const REVIEW_CHECKS = ['고객사와 사업자등록번호', '제품 줄의 수량과 금액', '1번 답과 표준계약서 판', '4번 답과 계약서의 무상 기간이나 환불 조건', '필수 첨부 파일'];
  const SUPPLEMENT_ITEMS = [
    { code: 'CHECKLIST', label: '체크리스트 답' }, { code: 'AMOUNT', label: '제품과 수량과 금액' },
    { code: 'DOC', label: '계약서 내용' }, { code: 'ATTACH', label: '첨부 파일' }, { code: 'OTHER', label: '그 밖의 것' },
  ];
  function supplementLabels(codes) {
    return codes.map(function (k) { return SUPPLEMENT_ITEMS.filter(function (x) { return x.code === k; })[0].label; }).join(', ');
  }
  /* 결재 창의 새 확인 (기획자 결정 2026-11-02, 결재 문서 SCR-23). 항목 이름 안에는 쉼표를 쓰지 않음(결재 기록에 쉼표로 이어 적음)
   * INTEREST_CHECK (C-14): ③ 영업 리더와 ③ 영업 임원 승인 창에서 결재자가 꼭 표시. 결재 기록에 "확인: ..."과 noInterest 칸으로 남음
   *   결재선은 그대로. 이해관계가 있을 때 그 건만 넘기는 길은 나중(C-16 보류와 함께)
   * SPLIT_CHECK (E-2): 결재 문서의 "같은 거래처 최근 계약" 상자에 계약이 있으면 ② 승인 창에서 REVIEW_CHECKS 뒤에 붙어 꼭 표시
   *   RECENT_SAME.days: 같은 사업자등록번호로 기안일이 이 계약 앞뒤 며칠 안인 계약을 보여 줄지 [가정 90일, 바꿀 수 있음]
   * ANTI_BRIBE (C-15): 표준계약서를 바꾼 계약(1번 아니요)의 ④ 법무 승인 창에서 고름. required의 계약 방식(간접, 조달)은 꼭, 직접은 골라도 되고 안 골라도 됨
   *   NONE이면 사유를 꼭 적음. 결재 기록에 antiBribe(코드)와 antiBribeNote(사유)로 남고 의견 문장에도 들어감
   * SIGN_DATE_CHECK (B-8): ⑧ 확인 항목. ⑦에서 적은 서명본 체결일(견적서로 대신한 계약은 고객 날인일)이 올린 문서의 날짜와 같은지 */
  const INTEREST_CHECK = '이 거래처와 개인적 이해관계가 없습니다';
  const SPLIT_CHECK = '같은 거래처 최근 계약과 나눠 맺은 계약이 아님';
  const RECENT_SAME = { days: 90 };
  const ANTI_BRIBE = {
    options: [{ code: 'KEPT', label: '반부패 조항 있고 약해지지 않음' }, { code: 'NONE', label: '반부패 조항 없음' }],
    required: ['INDIRECT', 'PROCURE'],
  };
  const SIGN_DATE_CHECK = { SIGNED: '서명본 체결일이 체결본과 같음', QUOTE: '고객 날인일이 견적서와 같음' };
  // ⑨ 고객지원이 운영에 적용하는 일. 서비스마다 다릅니다 (REQ-FLOW-25, panda p.35) [가정] 서비스 3단계 목록이 오면 다시 정함
  const OPS_CHECKS = {
    CK: ['라이선스 열기', '계약번호 설정', '계약 기간 설정', '계약 금액 설정'],
    HR: ['도메인 열기', '계약 기간 설정'],
  };
  // 해지할 때 ⑨에서 고객지원이 하는 일 (REQ-ARC-06) [가정]
  const OPS_CHECKS_END = { CK: ['라이선스 닫기', '계약 종료일 설정'], HR: ['도메인 닫기', '계약 종료일 설정'] };
  // 자동갱신(그대로 연장)할 때 ⑨에서 고객지원이 하는 일 (REQ-ARC-07) [가정]
  const OPS_CHECKS_EXTEND = { CK: ['라이선스 기간 연장'], HR: ['도메인 기간 연장'] };
  // 운영 변경의 기간 변경(연장 또는 단축)에서 ⑨ 고객지원이 하는 일 (v0.26) [가정]
  const OPS_CHECKS_PERIOD = { CK: ['라이선스 기간 변경'], HR: ['도메인 기간 변경'] };
  // 사후관리 기록 종류 (데이터 정의서 CODE-AFTERCARE-TYPE)
  const AFTERCARE_TYPES = { CONTACT_CHANGE: '담당자 변경', ISSUE: '특이사항' };
  // 첨부 파일 종류 (데이터 정의서 CODE-FILE-KIND)
  //   조항 대비표(CLAUSE_DIFF): 표준계약서를 바꾼 계약에 필수. 바꾼 조항의 표준 문구와 바꾼 문구를 나란히 (v0.27, C-20)
  const FILE_KINDS = { DRAFT_DOC: '계약서 초안', CLAUSE_DIFF: '조항 대비표', ANNEX: '부속 서류', QUOTE: '최종 견적서', SIGNED: '체결본', TERMINATE_DOC: '해지 관련 서류' };

  // 결재 기록 한 줄 (데이터 정의서 approval_history). 한 번 남기면 고치거나 지우지 않습니다. (REQ-FLOW-12)
  //   step: 단계 코드 / action: APPROVE 승인, REJECT 반려, CANCEL 승인 취소 / at: 'YYYY-MM-DD HH:MM'
  //   comment: 승인 의견(선택) 또는 반려 사유(필수) 또는 취소 사유 / actorId: 비우면 그 단계 담당자 / round: 기안 차수
  //   ② 승인은 확인 항목을 함께 남김(v0.63, G-05). 예시 기록도 실제 기록과 같은 모양으로
  function ev(step, action, at, comment, actorId, round) {
    if (step === 'S02' && action === 'APPROVE') comment = ['확인: ' + REVIEW_CHECKS.join(', '), comment].filter(Boolean).join('. ');
    return { step: step, action: action, at: at, comment: comment || '', actorId: actorId || STEP_ASSIGNEE[step], round: round || 1 };
  }

  /* 계약 [가정] (데이터 정의서 3장)
   * checklist: 체크리스트 답. standard 1번(영업이 답함), price 2번과 cap 3번(제품 금액으로 자동 계산)
   *   → 결재선은 이 답과 개인정보 처리위탁 계약 여부(personalData)로만 정합니다. 금액 기준은 없습니다. (REQ-CHK-05)
   * history: 결재 기록. 결재 단계의 지금 상태(approvals)는 common.js가 이 기록을 차례로 다시 적용해 만듭니다.
   * products: 계약 제품 줄 { feature: 기능 id(v0.49, 가격 기준의 열쇠), qty, amount }. 비어 있으면 검토 상세 화면에서 서비스와 금액으로 예시 줄을 만듭니다.
   * autoHistory: 이미 검토가 끝난 계약. 결재 기록을 승인일(approvedAt)에 맞춰 자동으로 만듭니다(시연용). */
  const CONTRACTS = [
    /* ----- 작성 중 (DRAFT): 계약번호는 기안할 때 부여 ----- */
    {
      // draftKey: 계약번호가 없는 임시 저장 건을 화면 주소로 부를 때 쓰는 임시 키 (new-contract.html?id=D-0001)
      id: null, draftKey: 'D-0001', counterparty: '바름고등학교', services: ['HR'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 7200000, requesterId: 'u_sales1', savedAt: '2026-10-18 17:40', restricted: false, personalData: true,
      status: 'DRAFT', history: [],
      // 계약 등록 화면(SCR-11)에 이어서 채울 값 (3.4 입력 항목)
      form: {
        bizNo: '214-82-10457', method: 'DIRECT', settlement: 'LUMP',
        startDate: '2027-01-01', endDate: '2027-12-31', autoRenew: 'NO',
        products: [{ feature: 'HR_PRISM_DEFECT', qty: 1200, amount: 7200000 }], // 표준 960만 원(건당 8,000원 x 1,200건)에서 25% 할인 → 한도 초과 예시
        checklist: { standard: 'YES', standardNote: '' },
      },
    },
    {
      // 기획자 결정 2026-11-02 B-5, B-6 시연: 공급가액 합계 240만 원(5백만 원 미만)이고 최종 견적서를 첨부해 "견적서로 계약서를 대신함"을 고른 임시 저장.
      //   계약서 초안 없이 기안할 수 있고, 4번이 "예"라 조건의 종류(무상 기간)와 비고를 적어 둠 (new-contract.html?id=D-0002)
      id: null, draftKey: 'D-0002', counterparty: '소담에듀', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 2400000, requesterId: 'u_sales1', savedAt: '2026-10-30 16:20', restricted: false, personalData: false,
      status: 'DRAFT', history: [], quoteInstead: true,
      files: [{ kind: 'QUOTE', name: '소담에듀 최종 견적서.pdf', size: 52000 }],
      form: {
        bizNo: '107-86-33922', method: 'DIRECT', settlement: 'LUMP', personalData: 'NO', quoteInstead: true,
        startDate: '2027-01-01', endDate: '2027-12-31', autoRenew: 'NO',
        products: [{ feature: 'CK_CAMPUS_GPTK', qty: 1, amount: 2400000 }],
        checklist: { standard: 'YES', accounting: 'YES', acctKinds: ['FREE_PERIOD'], accountingNote: '계약 시작 전 12월 한 달은 무상으로 써 봄' },
      },
    },

    /* ----- 검토 중 (IN_REVIEW) ----- */
    {
      // ⑤ 개인정보 검토가 오래 머문 예시 (11일째)
      id: '2610CL002', counterparty: '미래로병원', services: ['HR'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 36000000, requesterId: 'u_sales2', requestedAt: '2026-10-08 14:10', restricted: false, personalData: true,
      status: 'IN_REVIEW',
      checklist: { standard: 'YES', price: 'YES', cap: 'YES' },
      products: [{ feature: 'HR_PRISM_DEFECT', qty: 3, amount: 28800000 }, { feature: 'HR_PRISM_PLAG', qty: 2, amount: 7200000 }],
      memo: '환자 정보는 다루지 않고 직원 인사 정보만 처리합니다. 위탁 범위를 확인해 주세요.',
      history: [ev('S02', 'APPROVE', '2026-10-08 16:20')],
    },
    {
      // 모든 검토를 거치는 예시(경우 6). ③ 영업 검토 승인 뒤 ④ 법무와 ⑤ 개인정보를 동시에 검토하는 중.
      // ⑤는 끝났고 ④ 법무 검토 차례 (7일째)
      id: '2610CL003', counterparty: '하늘연구원', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 220000000, requesterId: 'u_sales2', requestedAt: '2026-10-10 10:05', restricted: false, personalData: true,
      status: 'IN_REVIEW',
      checklist: { standard: 'NO', standardNote: '연구기관 보안 서약 조항 추가', price: 'NO', priceNote: '10개 기관 일괄 계약', cap: 'NO', capNote: '3년 계약 조건으로 기관 라이선스 25% 할인 요청',
        // 기획자 결정 2026-11-02 B-6 시연: 4번 조건의 종류를 둘 고름(acctKinds). 비고는 그대로 꼭 적음
        accounting: 'YES', acctKinds: ['FREE_PERIOD', 'REFUND_RIGHT'],
        accountingNote: '첫 3개월 무상 사용 기간이 있고, 3년 동안 연도별 금액이 다름. 2년 차부터 해지하면 남은 기간 이용료를 돌려줌' },
      products: [{ feature: 'CK_CAMPUS_PLAG', qty: 10, amount: 90000000 }, { feature: 'CK_CAMPUS_USER', qty: 50, amount: 70000000 }, { feature: 'CK_CAMPUS_API', qty: 10, amount: 60000000 }],
      memo: '대형 연구기관 첫 계약입니다. 할인율이 한도를 넘어 영업 검토가 필요합니다.',
      // 기획자 결정 2026-11-02 시연: 조달 계약이라 ④ 법무 승인 창에서 반부패 조항 판단을 꼭 고름(C-15)
      //   재무가 결재선 밖에서 체결 전에 남긴 의견(B-6). 덧붙이기만 하고 ②~④는 결재 문서에서, ⑩은 확인 창에서 봄
      form: { method: 'PROCURE' },
      finOpinions: [{ at: '2026-10-12 16:10', by: 'u_finance', dept: '재무기획유닛', round: 1,
        text: '첫 3개월 무상 기간은 계약 기간 전체에 나눠 매출로 잡아야 합니다. 2년 차 해지 환불 조건이 있어 환불할 수 있는 금액은 미리 매출로 잡지 않겠습니다. ⑩에서 청구 일정과 함께 다시 보겠습니다.' }],
      history: [
        ev('S02', 'APPROVE', '2026-10-10 15:00'),
        ev('S03', 'APPROVE', '2026-10-12 10:20', '3년 계약과 연구기관 레퍼런스 확보를 고려해 할인 승인', 'u_eunseong_ko'), // 비즈니스2유닛 리더
        ev('S05', 'APPROVE', '2026-10-13 10:05', '개인정보 처리위탁 조항 확인'),
      ],
    },
    {
      // ④ 법무와 ⑤ 개인정보가 동시에 차례인 예시(할인율 한도 이내라 ③ 영업 검토 생략). ② 승인은 아직 취소 가능
      id: '2610CL005', counterparty: '한빛대학교', unit: '중앙도서관', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 48000000, requesterId: 'u_sales1', requestedAt: '2026-10-14 10:00', restricted: false, personalData: true,
      status: 'IN_REVIEW',
      checklist: { standard: 'NO', standardNote: '대학 요청으로 지식재산권 조항 일부 수정', price: 'NO', priceNote: '학과 단위 추가 이용자 묶음 할인', cap: 'YES' },
      products: [{ feature: 'CK_CAMPUS_PLAG', qty: 3, amount: 32400000 }, { feature: 'CK_CAMPUS_USER', qty: 12, amount: 15600000 }],
      memo: '지식재산권 조항 수정본을 첨부했습니다.',
      // 판 관리 예시 (v0.53): 법무가 보완을 요청해 영업이 계약서를 다시 올림 → 계약서 초안 판 1, 판 2
      history: [ev('S02', 'APPROVE', '2026-10-15 09:40'),
        // 보완할 항목 코드(v0.63, G-05): 결재 기록에 코드로 남아 통계 "보완 요청 항목"에서 셈
        Object.assign(ev('S04', 'SUPPLEMENT', '2026-10-15 16:00', '보완할 항목: ' + supplementLabels(['DOC']) +
          '. 지식재산권 조항 수정본에 대학 쪽 서명란이 빠졌습니다. 서명란을 넣은 계약서를 다시 올려 주세요.'), { supplementItems: ['DOC'] }),
        ev('S01', 'RESUBMIT', '2026-10-16 10:30', '서명란을 넣은 계약서를 다시 올렸습니다.', 'u_sales1')],
    },
    {
      // 승인 취소 기록이 남은 예시: ② 승인 → 취소 → 다시 승인. 지금 ③ 영업 검토 차례
      id: '2601CL001-A01', counterparty: '누리교육재단', services: ['CK'], type: 'SaaS 이용계약', kind: 'AMEND',
      parentId: '2601CL001',
      amount: 12000000, requesterId: 'u_sales2', requestedAt: '2026-10-16 09:00', restricted: false, personalData: false,
      status: 'IN_REVIEW',
      checklist: { standard: 'NO', standardNote: '변경 계약서(이용자 추가)', price: 'NO', priceNote: '기존 계약 할인율 유지', cap: 'NO', capNote: '추가 이용자 20% 할인, 기존 계약 조건 유지 요청' },
      products: [{ feature: 'CK_CAMPUS_USER', qty: 10, amount: 12000000 }],
      history: [
        ev('S02', 'APPROVE', '2026-10-16 09:10'),
        ev('S02', 'CANCEL', '2026-10-16 09:25', '첨부 견적서가 빠진 것을 확인해 승인 취소'),
        ev('S02', 'APPROVE', '2026-10-16 11:05', '보완된 견적서 확인'),
      ],
    },
    {
      // 열람 제한 계약 예시 (REQ-AUTH-07, REQ-AUTH-09). ② 체크리스트 검토 차례
      id: '2610CL007', counterparty: '가람전자', services: ['CK'], type: '리셀러 계약', kind: 'NEW',
      amount: 150000000, requesterId: 'u_sales1', requestedAt: '2026-10-17 14:00', restricted: true, personalData: false,
      status: 'IN_REVIEW',
      // 지정 열람자 예시 (v0.52, REQ-AUTH-20): 조직 하나, 사람 하나(관리자가 지정, 사유 필수)
      viewers: [
        { kind: 'DEPT', dept: '재무기획유닛', by: 'u_admin', at: '2026-10-18 10:00', reason: '총판 계약이라 매출 인식 방법을 재무기획유닛이 미리 검토' },
        { kind: 'USER', userId: 'u_exec', deptAtGrant: '비즈니스유닛', by: 'u_admin', at: '2026-10-18 10:05', reason: '할인 폭이 커서 영업 임원이 결재 전에 내용을 확인' },
      ],
      checklist: { standard: 'NO', standardNote: '리셀러 표준계약서 없음', price: 'NO', priceNote: '총판 공급가', cap: 'NO', capNote: '총판 마진 보장으로 21.9% 할인' },
      // 간접 계약의 사용 업체 미정 예시 (v0.62, G-19): 총판 재고라 체결 때 쓸 기관을 모름
      products: [{ feature: 'CK_CAMPUS_PLAG', qty: 16, amount: 150000000, orgPending: 'STOCK' }],
      memo: '총판 계약이라 열람 제한을 걸었습니다.',
      history: [],
    },
    {
      // 표준 단가 그대로라 ③ 영업 검토 생략. 비밀유지계약서는 부속 서류로 첨부 (v0.41: 금액이 없는 계약은 등록하지 않음)
      id: '2610CL008', counterparty: '단비소프트', services: ['HR'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 9600000, requesterId: 'u_sales1', requestedAt: '2026-10-18 10:30', restricted: false, personalData: false,
      status: 'IN_REVIEW',
      checklist: { standard: 'NO', standardNote: '상대방 양식 계약서', price: 'YES', cap: 'YES' },
      template: { id: 'OWN' }, // 기준 표준계약서 없음: 상대방 양식 (v0.53)
      products: [{ feature: 'HR_PRISM_DEFECT', qty: 1, amount: 9600000 }],
      annex: ['단비소프트_비밀유지계약서.pdf'],
      // 보완 요청 예시(v0.26): ④ 법무가 기안자에게 보완을 요청. 기안자가 고치면 ④부터 이어서 결재
      history: [
        ev('S02', 'APPROVE', '2026-10-18 13:00'),
        Object.assign(ev('S04', 'SUPPLEMENT', '2026-10-18 16:40', '보완할 항목: ' + supplementLabels(['DOC']) +
          '. 상대방 양식 계약서에 서비스 이용 기간이 비어 있습니다. 기간을 채운 계약서를 다시 올려 주세요.'), { supplementItems: ['DOC'] }),
      ],
    },
    {
      // ③ 영업 검토 차례 예시(v0.26): 비즈니스1유닛 이도윤님의 계약이라 비즈니스1유닛 리더 최민준님이 검토
      id: '2610CL006', counterparty: '새봄평생교육원', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 18000000, requesterId: 'u_sales1', requestedAt: '2026-10-16 15:00', restricted: false, personalData: false,
      status: 'IN_REVIEW',
      checklist: { standard: 'YES', price: 'NO', priceNote: '기관 2곳 묶음 계약', cap: 'NO', capNote: '두 기관을 한 번에 계약해 기관 라이선스 25% 할인 요청' },
      products: [{ feature: 'CK_CAMPUS_PLAG', qty: 2, amount: 18000000 }],
      memo: '평생교육원 두 곳을 묶은 첫 계약입니다.',
      history: [ev('S02', 'APPROVE', '2026-10-16 17:20')],
    },
    {
      // 기획자 결정 2026-11-02 E-3 시연: 할인율이 한도(20%)를 15%p 넘어(35% 할인) ③ 영업 리더 다음에 영업 임원(COO)도 승인
      //   비즈니스1유닛 이도윤의 계약이라 ③은 리더 최민준이 승인했고, 지금 ③ 영업 임원(문태호) 차례. 기준 %p는 PRICE_RULES.cooOverPp [가정]
      //   한도 20%는 기안한 10-18의 값. 10-19부터 0%(E-4)여도 이 계약의 결재선은 그대로(common.js capOver). 영업 임원 승인 시연은 이 계약 하나
      id: '2610CL009', counterparty: '별가람대학교', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 31200000, requesterId: 'u_sales1', requestedAt: '2026-10-18 15:00', restricted: false, personalData: false,
      status: 'IN_REVIEW',
      checklist: { standard: 'YES', price: 'NO', priceNote: '단과대학 4곳 묶음 계약', cap: 'NO', capNote: '처음 도입하는 조건으로 기관 라이선스 35% 할인 요청' },
      products: [{ feature: 'CK_CAMPUS_PLAG', qty: 4, amount: 31200000 }],
      memo: '다른 회사 제품에서 넘어오는 첫 계약입니다. 할인 폭이 커서 영업 임원 승인까지 받습니다.',
      history: [
        ev('S02', 'APPROVE', '2026-10-18 17:00'),
        // 기획자 결정 2026-11-02 C-14: ③ 승인은 "이해관계 없음" 확인을 남김(결재 창의 기록과 같은 모양: "확인: ..."과 noInterest)
        Object.assign(ev('S03', 'APPROVE', '2026-10-19 09:20', '확인: ' + INTEREST_CHECK + '. 단과대학 4곳 첫 도입과 레퍼런스를 고려해 할인 승인. 한도를 크게 넘어 영업 임원 승인을 이어서 받음', 'u_head'),
          { noInterest: true }),
      ],
    },
    {
      // 기획자 결정 2026-11-02 E-2 시연: 같은 거래처(새솔고등학교, 같은 사업자등록번호)에 앞뒤 90일 안에 기안한 계약이 2건 있어
      //   결재 문서에 "같은 거래처 최근 계약" 상자가 보이고, ② 승인 창에서 "나눠 맺은 계약이 아님"(SPLIT_CHECK)을 꼭 표시. ② 차례
      //   9월 견적서 계약(2609CL005, 240만 원)에 이어 다시 견적서로 계약서를 대신하는 계약(B-5). 둘을 더하면 5백만 원을 넘어 나눠 맺기를 살펴볼 예시
      id: '2610CL010', counterparty: '새솔고등학교', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 3000000, requesterId: 'u_sales1', requestedAt: '2026-10-17 16:00', restricted: false, personalData: false,
      status: 'IN_REVIEW', quoteInstead: true,
      checklist: { standard: 'YES', price: 'YES', cap: 'YES' },
      products: [{ feature: 'CK_CAMPUS_USER', qty: 2, amount: 3000000 }],
      startDate: '2026-11-01', endDate: '2027-10-31',
      memo: '9월에 견적서로 계약한 GPT Killer에 이어 추가 이용자 200명을 견적서로 계약합니다.',
      history: [],
    },

    /* ----- 반려 (REJECTED) ----- */
    {
      id: '2610CL001', counterparty: '소담에듀', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
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
        bizNo: '107-86-33922', method: 'DIRECT', settlement: 'SPLIT', opportunity: '2610SU031',
        startDate: '2026-11-01', endDate: '2027-10-31', autoRenew: 'YES', noticeDays: 60,
        products: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: 12000000 }, { feature: 'CK_CAMPUS_USER', qty: 4, amount: 6000000 }],
        checklist: { standard: 'NO', standardNote: '고객 요청으로 손해배상 한도 조항 수정' },
        memo: '손해배상 한도를 계약 금액의 2배로 요청받아 협의 중입니다.',
      },
    },

    /* ----- 승인 완료, 체결 대기 (APPROVED): 3단계 ⑥ 인장 날인 → ⑦ 체결본 등록 → ⑧ 체결본 확인 -----
     * postAt: 지금 차례인 단계. 그 앞 단계의 기록은 common.js가 승인일(approvedAt) 뒤 날짜로 만듦(시연용)
     * signedAt: 체결본을 등록한 날 / extraHistory: 자동으로 만든 기록 뒤에 더하는 기록 */
    {
      // ⑦ 체결본 등록이 오래 걸리는 예시 (승인 후 14일 이상 강조)
      id: '2609CL002', counterparty: '바른출판', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 24000000, requesterId: 'u_sales2', requestedAt: '2026-09-15 10:00', restricted: false, personalData: false,
      status: 'APPROVED', approvedAt: '2026-09-25 16:00', autoHistory: true, postAt: 'S07',
      checklist: { standard: 'NO', price: 'YES', cap: 'YES' },
    },
    {
      // ⑧에서 스캔 문제로 "다시 등록 요청" 뒤 영업이 다시 올려 ⑧ 확인 차례인 예시
      id: '2609CL003', counterparty: '새솔고등학교', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 9600000, requesterId: 'u_sales1', requestedAt: '2026-09-22 10:00', restricted: false, personalData: true,
      status: 'APPROVED', approvedAt: '2026-10-01 15:00', autoHistory: true, postAt: 'S08', signedAt: '2026-10-08',
      checklist: { standard: 'NO', price: 'YES', cap: 'YES' },
      extraHistory: [
        ev('S08', 'RETURN', '2026-10-09 10:20', '스캔본 3쪽(서명 쪽)이 빠졌습니다. 전체 쪽을 다시 올려 주세요.'),
        // signDate: 서명본 체결일(기획자 결정 2026-11-02 B-8). 다시 스캔해도 서명한 날은 처음과 같음
        Object.assign(ev('S07', 'REGISTER', '2026-10-16 17:40', '확인: ' + SIDE_DEAL_CHECK.S07 + '. 서명 쪽을 포함해 다시 스캔', 'u_sales1'), { fileName: '새솔고등학교_체결본_전체.pdf', signDate: '2026-10-07' }),
      ],
    },
    {
      // ⑥ 인장 날인 차례인 예시
      id: '2610CL004', counterparty: '다온컨설팅', services: ['HR'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 13200000, requesterId: 'u_sales1', requestedAt: '2026-10-13 10:00', restricted: false, personalData: false,
      status: 'APPROVED', approvedAt: '2026-10-16 11:00', autoHistory: true, postAt: 'S06',
      checklist: { standard: 'NO', price: 'YES', cap: 'YES' },
      products: [{ feature: 'HR_PRISM_DEFECT', qty: 1, amount: 9600000 }, { feature: 'HR_PRISM_PLAG', qty: 1, amount: 3600000 }],
      // 기획자 결정 2026-11-02 C-15 시연: 직접 계약이라 골라도 되고 안 골라도 되는데 ④ 법무가 "반부패 조항 없음"과 사유를 고름(common.js autoHistory가 기록에 남김)
      //   통계의 통제 지표와 전체 계약의 "④에서 반부패 조항 없음을 고른 계약만" 거르기에 보임
      antiBribe: { pick: 'NONE', note: '고객이 바꾼 손해배상 조항과 함께 반부패 조항을 뺐고 다시 넣기를 받아들이지 않음. 직접 계약이고 중개인이 없어 받아들임' },
    },
    {
      // 기획자 결정 2026-11-02 B-5 시연: 공급가액 합계가 5백만 원 미만이라 견적서로 계약서를 대신함(quoteInstead)
      //   ⑦에서 고객이 날인한 최종 견적서를 올렸고, ⑧ 영업지원이 견적서 확인 항목(QUOTE_INSTEAD_CHECKS)으로 확인할 차례
      //   체크리스트 1번은 견적서 양식을 그대로 썼다는 뜻으로 예 [가정: 견적서로 대신할 때 1번을 어떻게 답할지는 계약 등록 화면에서 정함]
      id: '2609CL005', counterparty: '새솔고등학교', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 2400000, requesterId: 'u_sales1', requestedAt: '2026-09-29 10:00', restricted: false, personalData: false,
      status: 'APPROVED', approvedAt: '2026-10-05 15:00', autoHistory: true, postAt: 'S08', signedAt: '2026-10-15',
      quoteInstead: true,
      // 기획자 결정 2026-11-02 E-2: ② 승인(10-05) 때 같은 거래처 최근 계약은 2609CL003(09-22) 1건이라 ②가 "나눠 맺은 계약이 아님"을 확인(common.js autoHistory)
      splitSeen: 1,
      checklist: { standard: 'YES', price: 'YES', cap: 'YES' },
      products: [{ feature: 'CK_CAMPUS_GPTK', qty: 1, amount: 2400000 }],
      startDate: '2026-11-01', endDate: '2027-10-31',
    },
    {
      // 기획자 결정 2026-11-03(C-44) 시연: 영업대표가 바뀐 계약. 기태민(9월 30일 퇴사, 사용 중지)이 기안했고 고객 서명을 받기 전에 떠남
      //   비즈니스1유닛 리더 최민준이 10-06에 이도윤을 새 영업대표로 정함(OWNER_CHANGES OC-0001). ⑦ 체결본 등록이 이도윤의 차례가 됨
      //   기안 기록(requesterId, 결재 기록의 기안)은 기태민 그대로. 이도윤의 내 등록 목록과 개요에 보이고, 계약 상세에 바뀐 기록이 보임
      id: '2609CL011', counterparty: '새빛정보통신', services: ['HR'], type: 'SaaS 이용계약', kind: 'NEW',
      //   ⑤ 개인정보 검토가 10-01에 끝나 9월 말 기간 마감 점검(B-9)의 "승인됐지만 체결 전"에는 들지 않음(그때 확인한 목록 그대로)
      amount: 14400000, requesterId: 'u_taemin_ki', requestedAt: '2026-09-21 10:00', restricted: false, personalData: true,
      status: 'APPROVED', approvedAt: '2026-10-01 15:00', autoHistory: true, postAt: 'S07',
      checklist: { standard: 'YES', price: 'YES', cap: 'YES' },
      startDate: '2026-11-01', endDate: '2027-10-31',
    },

    /* ----- 운영 검토 (OPS_REVIEW): ⑧ 체결본 확인 뒤 ⑨ 운영 적용(고객지원) → ⑩ 재무 확인 ----- */
    {
      id: '2609CL004', counterparty: '마루중학교', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 13200000, requesterId: 'u_sales1', requestedAt: '2026-09-18 10:00', restricted: false, personalData: false,
      status: 'OPS_REVIEW', approvedAt: '2026-09-24 15:00', signedAt: '2026-10-14', postAt: 'S09', autoHistory: true,
      // 표준계약서를 그대로 쓴 예시(④ 법무 검토 생략). 통계와 보고서의 체크리스트 예외 비율이 고르게 보이게 (v0.53)
      checklist: { standard: 'YES', price: 'YES', cap: 'YES' },
      startDate: '2026-11-01', endDate: '2027-10-31',
      // ⑧ 반려 예시(v0.61 검토, 표준 대응표 G-06): 1차는 체결본의 수량이 승인한 내용과 달라 ⑧에서 반려, 바뀐 수량으로 2차 기안.
      //   통계와 보고서의 "체결본 확인 반려 항목"과 앞 차수 체결본 판 보존(REQ-FLOW-22)을 시안에서 보이게
      round: 2,
      extraHistory: [
        { step: 'S01', action: 'SUBMIT', at: '2026-09-01 10:00', actorId: 'u_sales1', comment: '', round: 1 },
        ev('S02', 'APPROVE', '2026-09-01 16:00', '', null, 1),
        ev('S06', 'APPROVE', '2026-09-03 10:00', '확인: ' + SEAL_CHECKS.join(', '), null, 1),
        Object.assign(ev('S07', 'REGISTER', '2026-09-08 14:00', '확인: ' + SIDE_DEAL_CHECK.S07, 'u_sales1', 1), { fileName: '마루중학교_체결본_1차.pdf' }),
        Object.assign(ev('S08', 'REJECT', '2026-09-09 11:00', '어긋난 항목: ' + SIGNED_MISMATCH.filter(function (x) { return x.code === 'AMOUNT'; })[0].label +
          '. 고객이 서명하면서 이용 기관 수를 늘려 체결본의 수량과 금액이 승인한 내용과 다릅니다. 바뀐 수량으로 다시 기안해 주세요.', null, 1), { mismatch: ['AMOUNT'] }),
      ],
    },
    {
      // ⑩ 재무 확인 차례. 체크리스트 4번이 "예"라 재무가 특수 조건을 확인해야 하는 예시
      id: '2609CL001', counterparty: '청람컨설팅', services: ['HR'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 19200000, requesterId: 'u_sales2', requestedAt: '2026-09-08 10:00', restricted: false, personalData: true,
      status: 'OPS_REVIEW', approvedAt: '2026-09-15 15:00', signedAt: '2026-10-02', postAt: 'S10', autoHistory: true,
      // 날짜 순서가 이상한 예시(기획자 결정 2026-11-02 B-8): 서명본 체결일이 계약 검토 승인일(09-15)보다 앞섬 → 결재 문서에 표시(C.dateOrderIssues)
      signDate: '2026-09-12',
      checklist: { standard: 'NO', price: 'YES', cap: 'YES', accounting: 'YES', acctKinds: ['FREE_PERIOD'], accountingNote: '첫해 2개월 무상 사용 후 과금 시작' }, // acctKinds: B-6
      startDate: '2026-10-15', endDate: '2027-10-14',
    },

    /* ----- 계약 완료 (ACTIVE): 보관함 ----- */
    {
      // 자동갱신 계약, 만료 26일 전인데 연장 검토를 아직 하지 않은 예시 (해지 통지 기한 60일은 이미 지남)
      id: '2511CL001', counterparty: '한결대학교', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
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
      id: '2511CL002', counterparty: '푸른솔아카데미', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 30000000, requesterId: 'u_sales2', requestedAt: '2025-11-27 10:00', restricted: true, personalData: false,
      status: 'ACTIVE', approvedAt: '2025-12-02 15:00', autoHistory: true, startDate: '2025-12-10', endDate: '2026-12-09',
      checklist: { standard: 'NO', price: 'YES', cap: 'YES' },
      // 지정 열람자 예시 (v0.52): 조직 지정 하나와, 인사이동으로 저절로 풀린 사람 지정 하나
      //   석다인은 비즈니스2유닛에 있을 때 지정됐고 2026-10-12 세일즈어드민유닛으로 옮기며 풀림(관리자 변경 이력 참고) → 관리자에게 이메일, 다시 지정하지 않음
      viewers: [
        { kind: 'USER', userId: 'u_dain_seok', deptAtGrant: '비즈니스2유닛', by: 'u_admin', at: '2026-09-20 10:00', reason: '같은 유닛 영업 담당자가 연장 협상을 함께 맡음',
          releasedAt: '2026-10-12 11:00', releasedTo: '세일즈어드민유닛' },
        { kind: 'DEPT', dept: 'CEM유닛', by: 'u_admin', at: '2026-10-08 09:30', reason: '연장 검토 전에 고객지원이 사용 현황을 미리 확인' },
      ],
    },
    {
      id: '2601CL001', counterparty: '누리교육재단', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 60000000, requesterId: 'u_sales2', requestedAt: '2026-01-06 10:00', restricted: false, personalData: false,
      status: 'ACTIVE', approvedAt: '2026-01-09 15:00', autoHistory: true, startDate: '2026-01-15', endDate: '2026-12-31',
      // 해지 통지 기한이 다가오는 예시 (v0.53): 만료 60일 전인 2026-11-01까지 알려야 함 → 오늘(10-19) D-13, 30일 전 이메일은 10-02에 감
      autoRenew: 'YES', noticeDays: 60,
      checklist: { standard: 'NO', price: 'YES', cap: 'YES' },
    },
    {
      // 자동갱신 계약. 연장 검토(조건 그대로)를 기안해 ④ 법무 차례인 예시는 아래 2512CL001-R01
      id: '2512CL001', counterparty: '온새미로대학교', sla: 'YES', services: ['CK', 'HR'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 72000000, requesterId: 'u_sales1', requestedAt: '2025-12-22 10:00', restricted: false, personalData: true,
      status: 'ACTIVE', approvedAt: '2025-12-29 15:00', autoHistory: true, startDate: '2026-01-10', endDate: '2027-01-09',
      autoRenew: 'YES', noticeDays: 30,
      checklist: { standard: 'NO', price: 'YES', cap: 'YES' },
    },
    {
      id: '2602CL001', counterparty: '가온테크', services: ['CK'], type: '리셀러 계약', kind: 'NEW',
      amount: 120000000, requesterId: 'u_sales2', requestedAt: '2026-02-10 10:00', restricted: false, personalData: false,
      status: 'ACTIVE', approvedAt: '2026-02-16 15:00', autoHistory: true, startDate: '2026-03-01', endDate: '2028-02-29',
      // 할인율 한도를 넘어 ③ 영업 검토를 거친 예시 (v0.53)
      checklist: { standard: 'NO', price: 'NO', priceNote: '총판 공급가로 계약', cap: 'NO', capNote: '총판 공급가 30% 할인, 2년 최소 구매 약정 조건' },
      // 제품 줄과 사용 업체 (v0.62, G-19): 한 줄은 쓸 기관이 정해졌고, 한 줄은 최소 구매 약정이라 미정
      products: [{ feature: 'CK_CAMPUS_PLAG', qty: 10, amount: 84000000, org: '누리솔대학교' },
        { feature: 'CK_CAMPUS_USER', qty: 30, amount: 36000000, orgPending: 'MIN_PURCHASE' }],
    },
    {
      id: '2604CL001', counterparty: '이음병원', sla: 'YES', services: ['HR'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 42000000, requesterId: 'u_sales1', requestedAt: '2026-04-13 10:00', restricted: false, personalData: true,
      status: 'ACTIVE', approvedAt: '2026-04-20 15:00', autoHistory: true, startDate: '2026-05-01', endDate: '2027-04-30',
      checklist: { standard: 'NO', price: 'YES', cap: 'YES' },
      notes: [{ type: 'ISSUE', at: '2026-08-20 11:00', by: 'u_sales1', content: '병원 정보보호팀 감사로 접속 기록 사본을 요청받아 CEM유닛이 제공함' }],
    },
    {
      // 기획자 결정 2026-11-03(C-44) 시연: 영업대표(기태민)가 퇴사해 계정이 사용 중지되었고 아직 새 영업대표를 정하지 않은 계약
      //   계약 상세에 "담당 지정 필요 (영업 리더가 맡음)". 새 영업대표를 정할 때까지 비즈니스1유닛 리더 최민준이 연장, 변경, 해지 기안과 알림을 맡고,
      //   계약 상세의 "영업대표 바꾸기"로 계약마다 정함. 최민준의 개요 "내가 검토할 계약"에 보임
      id: '2609CL010', counterparty: '라온디자인', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 18000000, requesterId: 'u_taemin_ki', requestedAt: '2026-09-08 10:00', restricted: false, personalData: false,
      status: 'ACTIVE', approvedAt: '2026-09-11 15:00', autoHistory: true, startDate: '2026-10-01', endDate: '2027-09-30',
      checklist: { standard: 'YES', price: 'YES', cap: 'YES' },
    },
    /* ----- 연장 검토와 해지 기안 (짧은 결재: ③ 영업 리더 → ④ 법무 → ⑨ 운영 → ⑩ 재무, REQ-ARC-06, 07) ----- */
    {
      // 연장 검토 "그대로 자동갱신" 예시: ③ 영업 리더 승인, ④ 법무 차례
      id: '2512CL001-R01', parentId: '2512CL001', counterparty: '온새미로대학교', services: ['CK', 'HR'], type: 'SaaS 이용계약',
      kind: 'RENEW', renewMode: 'AUTO', amount: 72000000, requesterId: 'u_sales1', requestedAt: '2026-10-15 10:00',
      restricted: false, personalData: true, status: 'IN_REVIEW', startDate: '2027-01-10', endDate: '2028-01-09',
      autoRenew: 'YES', noticeDays: 30, reason: '이용 규모와 조건이 같아 기존 조건 그대로 1년 연장',
      history: [ev('S03', 'APPROVE', '2026-10-16 09:30', '조건 그대로 연장에 동의', 'u_head')], // 비즈니스1유닛 리더
    },
    {
      // 해지 기안 예시: ③ 영업 리더, ④ 법무 승인 뒤 ⑨ 운영 종료 차례
      id: '2602CL001-T01', parentId: '2602CL001', counterparty: '가온테크', services: ['CK'], type: '리셀러 계약',
      kind: 'TERMINATE', amount: 0, requesterId: 'u_sales2', requestedAt: '2026-10-05 10:00', restricted: false, personalData: false,
      status: 'OPS_REVIEW', approvedAt: '2026-10-08 15:00', autoHistory: true, postAt: 'S09',
      terminateDate: '2026-11-30', reason: '총판의 최소 구매 약정 미이행으로 합의 해지',
      refundNote: '남은 기간 이용료는 환불하지 않고 위약금도 없음(해지 합의서 3조)',
    },
    {
      id: '2606CL001', counterparty: '해랑출판', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 15600000, requesterId: 'u_sales2', requestedAt: '2026-06-15 10:00', restricted: false, personalData: false,
      status: 'ACTIVE', approvedAt: '2026-06-19 15:00', autoHistory: true, startDate: '2026-07-01', endDate: '2027-06-30',
      checklist: { standard: 'YES', price: 'YES', cap: 'YES' }, // 표준계약서 그대로 (v0.53)
    },
    {
      // 기획자 결정 2026-11-02 C-1 시연: 통계 통제 지표의 위험 신호 "분기 말 5일 안의 가격 예외". 분기 말(06-30) 전날 ③에서 할인을 승인
      //   결재 기록은 autoHistory가 만듦(③이 마지막 검토라 승인일 06-29에 ③ 승인). 할인 25%로 한도 20%를 5%p 넘어 영업 임원 승인은 없음
      id: '2606CL002', counterparty: '바른출판', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 9000000, requesterId: 'u_sales2', requestedAt: '2026-06-26 10:00', restricted: false, personalData: false,
      status: 'ACTIVE', approvedAt: '2026-06-29 15:00', autoHistory: true, startDate: '2026-07-01', endDate: '2027-06-30',
      checklist: { standard: 'YES', price: 'NO', priceNote: '분기 안에 계약하는 조건으로 기관 라이선스 할인', cap: 'NO', capNote: '6월 안에 계약하면 25% 할인해 달라는 요청' },
      products: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: 9000000 }],
    },
    {
      // 기획자 결정 2026-11-02 B-9 시연: 9월 말(기간 말) 앞뒤에 체결하고 ⑨를 기다리던 계약. 통계의 기간 마감 점검(기본 기간 말 2026-09-30)에서
      //   "기간 말 앞뒤 체결"과 "⑨ ⑩을 기다리던 계약"에 함께 보임. 결재 기록은 autoHistory가 만듦:
      //   ⑦ 09-28 올림(서명본 체결일 09-27, B-8), ⑧ 09-29, ⑨ 10-01(실제 개통일 10-01), ⑩ 10-02. 표준 단가 그대로라 ③ 생략
      id: '2609CL006', counterparty: '새길교육연구소', services: ['HR'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 8400000, requesterId: 'u_sales2', requestedAt: '2026-09-14 10:00', restricted: false, personalData: false,
      status: 'ACTIVE', approvedAt: '2026-09-21 15:00', signedAt: '2026-09-28', autoHistory: true, startDate: '2026-10-01', endDate: '2027-09-30',
      checklist: { standard: 'YES', price: 'YES', cap: 'YES' },
      form: { bizNo: '214-82-77313', method: 'DIRECT' },
      products: [{ feature: 'HR_PRISM_PLAG', qty: 1, amount: 3600000 }, { feature: 'HR_PRISM_GPTK', qty: 1, amount: 4800000 }],
    },
    /* 기획자 결정 2026-11-02 C-9 시연: 9월에 ③ 가격 예외 승인을 마친 계약 셋. 할인 예외 점검(SCR-61)의 기본 대상 월(지난달 9월)에 보임
     *   결재 기록을 날짜에 맞춰 직접 적음(③ 승인자, 대리 결재, ⑩이 늦은 것을 보이려고). 모두 9월 24일 전에 체결과 ⑨를 마쳐
     *   통계의 기간 마감 점검(9월 말 앞뒤 5일) 목록에는 들지 않음. 거래처는 사업자 정보 DB에서 골라 기안할 때 등록(새 거래처 표시 없음) */
    {
      // 할인 폭이 커서 ③ 영업 리더(최민준) 다음에 ③ 영업 임원(문태호)도 승인(E-3). 한 줄 35% 할인(한도 20%, 15%p 넘음)
      //   4번이 예(무상 기간)이고 ⑩ 재무 확인이 차례가 온 지 11일 만에 끝나 늦음(결재 대기 독촉 5일 넘음) → 점검의 ⑩ 줄에도 보임
      id: '2609CL007', counterparty: '한누리대학교', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 36000000, requesterId: 'u_taeyun_kim', requestedAt: '2026-09-01 10:00', restricted: false, personalData: false,
      status: 'ACTIVE', startDate: '2026-10-01', endDate: '2027-09-30',
      checklist: { standard: 'YES', price: 'NO', priceNote: '단과대학 3곳 묶음 계약', cap: 'NO', capNote: '처음 도입하는 조건으로 기관 라이선스 35% 할인 요청',
        accounting: 'YES', acctKinds: ['FREE_PERIOD'], accountingNote: '계약 시작 전 9월 한 달은 무상으로 써 봄' },
      form: { bizNo: '134-82-61500', method: 'DIRECT' }, opportunity: '2609CK027', // 판다 영업기회번호(E-1, 가상 번호)
      products: [{ feature: 'CK_CAMPUS_PLAG', qty: 3, amount: 23400000 }, { feature: 'CK_CAMPUS_USER', qty: 10, amount: 12600000 }],
      history: [
        ev('S02', 'APPROVE', '2026-09-01 16:00'),
        Object.assign(ev('S03', 'APPROVE', '2026-09-03 10:30', '확인: ' + INTEREST_CHECK + '. 단과대학 3곳 첫 도입이라 할인 승인. 한도를 크게 넘어 영업 임원 승인을 이어서 받음', 'u_head'), { noInterest: true }),
        Object.assign(ev('S03C', 'APPROVE', '2026-09-04 09:40', '확인: ' + INTEREST_CHECK + '. 같은 지역 대학 레퍼런스를 고려해 승인', 'u_exec'), { noInterest: true }),
        ev('S06', 'APPROVE', '2026-09-07 10:00', '확인: ' + SEAL_CHECKS.join(', ')),
        Object.assign(ev('S07', 'REGISTER', '2026-09-09 14:00', '확인: ' + SIDE_DEAL_CHECK.S07, 'u_taeyun_kim'), { fileName: '한누리대학교_체결본.pdf', signDate: '2026-09-08' }),
        ev('S08', 'APPROVE', '2026-09-10 11:00', '확인: ' + SIGNED_CHECKS.concat([SIGN_DATE_CHECK.SIGNED, SIDE_DEAL_CHECK.S08]).join(', ')),
        Object.assign(ev('S09', 'APPROVE', '2026-09-11 15:00', '확인: ' + OPS_CHECKS.CK.join(', ')), { openDate: '2026-09-11' }),
        ev('S10', 'APPROVE', '2026-09-22 16:00', '무상 사용 9월분은 계약 기간 전체에 나눠 매출로 잡음. 9월 결산 자료 준비로 확인이 늦어짐'),
      ],
    },
    {
      // 열람 제한 계약: 재무 임원은 4번이 예가 아니라 계약을 볼 수 없어 점검에서는 고객사를 가리고 점검에 필요한 칸만 보임
      //   ③ 영업 리더(고은성) 승인. 한 줄 25% 할인(한도 20%, 5%p 넘음)이라 영업 임원 승인은 없음
      id: '2609CL008', counterparty: '해솔테크', services: ['HR'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 14400000, requesterId: 'u_sales2', requestedAt: '2026-09-07 10:00', restricted: true, personalData: false,
      status: 'ACTIVE', startDate: '2026-10-01', endDate: '2027-09-30',
      checklist: { standard: 'YES', price: 'NO', priceNote: '계열사 2곳 묶음 계약', cap: 'NO', capNote: '계열사 두 곳을 함께 계약해 25% 할인 요청' },
      form: { bizNo: '220-81-55239', method: 'DIRECT' }, opportunity: '2609HR016',
      products: [{ feature: 'HR_PRISM_DEFECT', qty: 2, amount: 14400000 }],
      memo: '계열사 임원 채용 검사 계약이라 열람 제한을 걸었습니다.',
      history: [
        ev('S02', 'APPROVE', '2026-09-07 16:00'),
        Object.assign(ev('S03', 'APPROVE', '2026-09-08 10:00', '확인: ' + INTEREST_CHECK + '. 계열사 두 곳 묶음이라 할인 승인', 'u_eunseong_ko'), { noInterest: true }),
        ev('S06', 'APPROVE', '2026-09-09 10:00', '확인: ' + SEAL_CHECKS.join(', ')),
        Object.assign(ev('S07', 'REGISTER', '2026-09-14 14:00', '확인: ' + SIDE_DEAL_CHECK.S07, 'u_sales2'), { fileName: '해솔테크_체결본.pdf', signDate: '2026-09-11' }),
        ev('S08', 'APPROVE', '2026-09-15 11:00', '확인: ' + SIGNED_CHECKS.concat([SIGN_DATE_CHECK.SIGNED, SIDE_DEAL_CHECK.S08]).join(', ')),
        Object.assign(ev('S09', 'APPROVE', '2026-09-16 15:00', '확인: ' + OPS_CHECKS.HR.join(', ')), { openDate: '2026-09-16' }),
        ev('S10', 'APPROVE', '2026-09-17 16:00', ''),
      ],
    },
    {
      // 대리 결재: 비즈니스1유닛 리더(최민준) 연차 동안 대리 지정(DL-003)에 따라 영업 임원(문태호)이 ③을 대신 승인
      //   한 줄 24% 할인(한도 20%, 4%p 넘음), 계약 전체 20% 할인
      id: '2609CL009', counterparty: '솔빛평생교육원', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 11520000, requesterId: 'u_seohyun_park', requestedAt: '2026-09-14 10:00', restricted: false, personalData: false,
      status: 'ACTIVE', startDate: '2026-10-01', endDate: '2027-09-30',
      checklist: { standard: 'YES', price: 'NO', priceNote: '평생교육원 첫 계약', cap: 'NO', capNote: '첫 계약 조건으로 기관 라이선스 24% 할인 요청' },
      form: { bizNo: '403-82-30714', method: 'DIRECT' }, opportunity: '2609CK029',
      products: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: 9120000 }, { feature: 'CK_CAMPUS_GPTK', qty: 1, amount: 2400000 }],
      history: [
        ev('S02', 'APPROVE', '2026-09-14 16:00'),
        Object.assign(ev('S03', 'APPROVE', '2026-09-16 10:20', '확인: ' + INTEREST_CHECK + '. 첫 계약이고 한도를 조금 넘어 할인 승인', 'u_exec'),
          { noInterest: true, onBehalfOf: 'u_head', delegationId: 'DL-003', basis: '최민준님 연차(2026-09-16~2026-09-18). 비즈니스1유닛 계약의 영업 검토를 영업 임원이 대신 결재(위임전결규정 대결)' }),
        ev('S06', 'APPROVE', '2026-09-17 10:00', '확인: ' + SEAL_CHECKS.join(', ')),
        Object.assign(ev('S07', 'REGISTER', '2026-09-18 14:00', '확인: ' + SIDE_DEAL_CHECK.S07, 'u_seohyun_park'), { fileName: '솔빛평생교육원_체결본.pdf', signDate: '2026-09-17' }),
        ev('S08', 'APPROVE', '2026-09-21 11:00', '확인: ' + SIGNED_CHECKS.concat([SIGN_DATE_CHECK.SIGNED, SIDE_DEAL_CHECK.S08]).join(', ')),
        Object.assign(ev('S09', 'APPROVE', '2026-09-22 15:00', '확인: ' + OPS_CHECKS.CK.join(', ')), { openDate: '2026-09-22' }),
        ev('S10', 'APPROVE', '2026-09-23 11:00', ''),
      ],
    },

    /* ----- 만료 (EXPIRED) -----
     * 기획자 결정 2026-11-02 A-10: 종료일이 지나고 연장이나 새 계약 기안이 없으면 고객지원의 만료 처리 차례(common.js 만료 처리와 유예)
     * A-11: 연장 협상 중이면 영업대표가 유예(사유, 종료일 뒤 30일 안의 기한)를 요청하고 영업 리더가 확인. 기한이 지나면 다시 만료 처리 차례
     * 만료 처리와 유예의 기록은 지금 유효한 계약의 결재 기록(history)에 남김: 유예 요청(S01 GRACE), 확인과 반려(SGR GRACE_OK, GRACE_NO), 만료 처리(SXP APPROVE) */
    {
      // 만료 처리를 마친 예시: 종료 다음 날 고객지원이 라이선스를 닫고 종료일을 설정함
      id: '2508CL001', counterparty: '별빛어학원', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 8400000, requesterId: 'u_sales2', requestedAt: '2025-08-18 10:00', restricted: false, personalData: false,
      status: 'EXPIRED', approvedAt: '2025-08-22 15:00', autoHistory: true, startDate: '2025-09-01', endDate: '2026-08-31',
      checklist: { standard: 'YES', price: 'YES', cap: 'YES' }, // 표준계약서 그대로 (v0.53)
      history: [ev('SXP', 'APPROVE', '2026-09-01 10:30', '확인: ' + OPS_CHECKS_END.CK.join(', ') + '. 고객에게 종료 안내 메일을 보냄', 'u_cem')],
    },
    {
      // 만료 처리 차례인 예시: 종료일(2026-10-15)이 지났고 연장이나 새 계약 기안이 없어 고객지원 차례(10-16부터)
      //   영업대표가 연장 협상 중이라며 유예를 요청해 영업 리더(최민준)가 확인할 차례. 확인 전까지는 만료 처리 차례가 그대로
      id: '2509CL001', counterparty: '도담고등학교', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 12000000, requesterId: 'u_sales1', requestedAt: '2025-09-29 10:00', restricted: false, personalData: false,
      status: 'EXPIRED', approvedAt: '2025-10-02 15:00', autoHistory: true, startDate: '2025-10-16', endDate: '2026-10-15',
      checklist: { standard: 'YES', price: 'YES', cap: 'YES' },
      history: [Object.assign(ev('S01', 'GRACE', '2026-10-17 15:00', '유예 기한 2026-11-10. 학교 예산이 11월 초에 확정되어 연장 협상이 이어짐. 확정되면 바로 연장 기안', 'u_sales1'),
        { graceUntil: '2026-11-10' })],
    },
    {
      // 유예 중인 예시: 끝나기 전에 영업대표가 유예를 요청하고 영업 리더(고은성)가 확인. 기한(2026-11-06)까지 만료 처리 차례가 오지 않음
      id: '2509CL002', counterparty: '모아물류', services: ['HR'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 9600000, requesterId: 'u_sales2', requestedAt: '2025-09-30 10:00', restricted: false, personalData: true,
      status: 'EXPIRED', approvedAt: '2025-10-06 15:00', autoHistory: true, startDate: '2025-10-13', endDate: '2026-10-12',
      checklist: { standard: 'YES', price: 'YES', cap: 'YES' },
      history: [
        Object.assign(ev('S01', 'GRACE', '2026-10-06 10:00', '유예 기한 2026-11-06. 단가 조정으로 연장 협상 중이라 협상이 끝날 때까지 도메인을 열어 둠', 'u_sales2'),
          { graceUntil: '2026-11-06' }),
        Object.assign(ev('SGR', 'GRACE_OK', '2026-10-07 09:30', '협상 일정 확인. 기한 안에 연장 기안이 없으면 고객지원이 닫음', 'u_eunseong_ko'), { graceUntil: '2026-11-06' }),
      ],
    },
    {
      // 기획자 결정 2026-11-02 A-10, A-11 시연: 유예 기한이 지나 다시 만료 처리 차례인 예시
      //   끝나기 전에 영업대표가 유예(~2026-10-15)를 요청하고 영업 리더(최민준)가 확인. 기한 안에 연장 기안이 없어 기한 다음 날(10-16)부터 고객지원 차례
      id: '2509CL003', counterparty: '늘봄어학원', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 4800000, requesterId: 'u_sales1', requestedAt: '2025-09-30 14:00', restricted: false, personalData: false,
      status: 'EXPIRED', approvedAt: '2025-10-02 15:00', autoHistory: true, startDate: '2025-10-01', endDate: '2026-09-30',
      checklist: { standard: 'YES', price: 'YES', cap: 'YES' },
      history: [
        Object.assign(ev('S01', 'GRACE', '2026-09-24 10:00', '유예 기한 2026-10-15. 원장이 바뀌어 연장 여부를 10월 중순까지 정하기로 함', 'u_sales1'),
          { graceUntil: '2026-10-15' }),
        Object.assign(ev('SGR', 'GRACE_OK', '2026-09-25 09:30', '협상 일정 확인. 기한 안에 연장 기안이 없으면 고객지원이 닫음', 'u_head'), { graceUntil: '2026-10-15' }),
      ],
    },
    {
      // 기획자 결정 2026-11-02 A-10 시연: 연장 기안이 있어 만료 처리 차례가 없는 예시("만료, 연장 진행 중")
      //   자동갱신 계약인데 종료일(2026-10-10)이 지난 뒤 영업대표가 늦은 연장 검토(2510CL001-R01, A-11)를 기안. 결재란의 ⑨ 만료 처리는 생략
      id: '2510CL001', counterparty: '푸른숲중학교', services: ['CK'], type: 'SaaS 이용계약', kind: 'NEW',
      amount: 6000000, requesterId: 'u_sales2', requestedAt: '2025-10-02 10:00', restricted: false, personalData: false,
      status: 'EXPIRED', approvedAt: '2025-10-06 15:00', autoHistory: true, startDate: '2025-10-11', endDate: '2026-10-10',
      autoRenew: 'YES', noticeDays: 30,
      checklist: { standard: 'YES', price: 'YES', cap: 'YES' },
    },
    {
      // 위 2510CL001의 늦은 연장 검토(조건 그대로): ③ 영업 리더(고은성) 차례
      id: '2510CL001-R01', parentId: '2510CL001', counterparty: '푸른숲중학교', services: ['CK'], type: 'SaaS 이용계약',
      kind: 'RENEW', renewMode: 'AUTO', amount: 6000000, requesterId: 'u_sales2', requestedAt: '2026-10-14 10:00',
      restricted: false, personalData: false, status: 'IN_REVIEW', startDate: '2026-10-11', endDate: '2027-10-10',
      autoRenew: 'YES', noticeDays: 30, reason: '학교 예산 확정이 늦어 종료일이 지난 뒤 기안. 이용 규모와 조건이 같아 그대로 1년 연장',
      history: [],
    },

    /* ----- 운영 변경 (CHANGE, v0.26 재무 문서 반영) -----
     * changeType: CHANGE_TYPES / changeQty: 충전 수량(건) / changeAmount: 유상 충전 금액(원, 부가세 별도)
     * oldEndDate, endDate: 기간 변경 전후 종료일 / reason: 변경 사유 / activityUrl: CRM 영업활동 링크(재무 문서: 사유는 영업활동에 적고 링크를 남김) */
    {
      // 무상 충전 80건(50건 초과)이라 ③ 영업 검토 차례. 끝나면 ⑨에서 재무가 수불부에 반영
      id: '2604CL001-C01', parentId: '2604CL001', counterparty: '이음병원', services: ['HR'], type: 'SaaS 이용계약', kind: 'CHANGE',
      changeType: 'HR_FREE', changeQty: 80, changeAmount: 0, amount: 0,
      requesterId: 'u_sales1', requestedAt: '2026-10-17 11:00', restricted: false, personalData: false, status: 'IN_REVIEW',
      reason: '병원 신규 간호 인력 채용 시즌에 검사 수량이 부족해 무상으로 추가 제공(재계약 협의 중)',
      activityUrl: 'https://panda.muhayu.com/activity/A-2026-1077',
      history: [],
    },
    {
      // 무상 충전 30건(50건 이내)이라 영업 검토 없이 ⑨ 고객지원 운영 변경 차례
      id: '2601CL001-C01', parentId: '2601CL001', counterparty: '누리교육재단', services: ['CK'], type: 'SaaS 이용계약', kind: 'CHANGE',
      changeType: 'CK_FREE', changeQty: 30, changeAmount: 0, amount: 0,
      requesterId: 'u_sales2', requestedAt: '2026-10-15 14:00', restricted: false, personalData: false, status: 'IN_REVIEW',
      reason: '학기 말 검사 집중으로 검사 건수 소진. 다음 학기 증액 전까지 무상 30건 제공',
      activityUrl: 'https://panda.muhayu.com/activity/A-2026-1052',
      history: [],
    },
    {
      // 기획자 결정 2026-11-02 B-3 시연(추천과 다름): 운영 변경도 ⑨ 다음 ⑩ 재무 확인. HR 충전은 ⑨를 재무 담당자(오현우)가 수불부에 반영했으므로
      //   ⑩은 같은 사람이 아닌 다른 재무 담당자(표예준)가 확인할 차례. 유상 충전이라 ③ 영업 검토는 없음
      //   기획자 결정 2026-11-03(C-18 ⑤): ⑩은 재무 담당자(common.js otherFinance)
      id: '2512CL001-C01', parentId: '2512CL001', counterparty: '온새미로대학교', services: ['CK', 'HR'], type: 'SaaS 이용계약', kind: 'CHANGE',
      changeType: 'HR_PAID', changeQty: 200, changeAmount: 1600000, amount: 0,
      // B-3 덧붙임 시연: 유상 충전의 기능과 기안한 날(10-14)의 표준 단가. 그날 가격 기준은 "기관, 1년" 단위라(건 단위는 10-19부터)
      //   결재 문서에 "건 단위 표준 단가가 없어 견주지 않음"으로 보임. 오늘 기안하면 건 단위 단가(8,000원)로 표준 금액과 할인율이 보임
      changeFeature: 'HR_PRISM_DEFECT', changeListPrice: 9600000, changePriceUnit: '기관, 1년', changePriceFrom: '2026-09-01',
      requesterId: 'u_sales1', requestedAt: '2026-10-14 10:00', restricted: false, personalData: false, status: 'IN_REVIEW',
      reason: '인사 채용 검사 응시 인원이 늘어 HR 검사 200건을 유상으로 추가(건당 8,000원)',
      activityUrl: 'https://panda.muhayu.com/activity/A-2026-1069',
      history: [ev('S09', 'APPROVE', '2026-10-15 15:00', '확인: 수불부에 HR 추가 충전 200건 반영', 'u_finance')],
    },
    {
      // 기획자 결정 2026-11-02 B-4 시연: 무상 충전 50건은 계약 연도마다 더해서 셈. 해랑출판(계약 연도 2026-07-01~2027-06-30)이 8월에 30건을 받음(계약 완료)
      id: '2606CL001-C01', parentId: '2606CL001', counterparty: '해랑출판', services: ['CK'], type: 'SaaS 이용계약', kind: 'CHANGE',
      changeType: 'CK_FREE', changeQty: 30, changeAmount: 0, amount: 0,
      requesterId: 'u_sales2', requestedAt: '2026-08-18 10:00', restricted: false, personalData: false, status: 'ACTIVE',
      reason: '편집부 신입 교육 기간에 검사가 몰려 무상 30건 제공',
      activityUrl: 'https://panda.muhayu.com/activity/A-2026-0911',
      history: [ev('S09', 'APPROVE', '2026-08-19 15:00', '확인: CK 추가 충전 30건 반영'), ev('S10', 'APPROVE', '2026-08-20 11:00', '')],
    },
    {
      // B-4 시연: 이번 신청은 25건(50건 이내)이지만 같은 계약 연도 누적이 55건이라 ③ 영업 검토 차례(비즈니스2유닛 리더, 대리 지정 중이면 영업 임원)
      id: '2606CL001-C02', parentId: '2606CL001', counterparty: '해랑출판', services: ['CK'], type: 'SaaS 이용계약', kind: 'CHANGE',
      changeType: 'CK_FREE', changeQty: 25, changeAmount: 0, amount: 0,
      requesterId: 'u_sales2', requestedAt: '2026-10-16 14:00', restricted: false, personalData: false, status: 'IN_REVIEW',
      reason: '출간 일정이 몰려 검사 건수가 다시 모자람. 재계약 협의 전까지 무상 25건 제공',
      activityUrl: 'https://panda.muhayu.com/activity/A-2026-1061',
      history: [],
    },

    /* ----- 계약 완료된 변경과 반려된 변경 (기획자 결정 2026-11-02 D-13 시연) -----
     * 전체 계약의 "변경과 연장" 칸은 계약 완료된 변경과 연장만 셈. 진행 중이거나 반려된 기안은 상태 칸 아래 줄에만 보임
     * 예전 예시에는 끝난 후속 계약과 반려된 후속 기안이 없어 그 칸이 모두 "-"였음. 둘 다 원계약의 영업대표가 기안(A-3) */
    {
      // 계약 완료된 변경: 전체 계약의 "변경과 연장" 칸에 "변경 1건". 같은 묶음의 연장 검토(2512CL001-R01)는 상태 칸 아래 줄에
      id: '2512CL001-A01', parentId: '2512CL001', counterparty: '온새미로대학교', services: ['HR'], type: 'SaaS 이용계약', kind: 'AMEND',
      amount: 9600000, requesterId: 'u_sales1', requestedAt: '2026-05-11 10:00', restricted: false, personalData: true,
      status: 'ACTIVE', approvedAt: '2026-05-14 15:00', autoHistory: true, startDate: '2026-06-01', endDate: '2027-01-09',
      checklist: { standard: 'NO', standardNote: '변경 계약서(인사 채용 검사 기관 추가)', price: 'YES', cap: 'YES' },
    },
    {
      // 반려된 변경: ④ 법무가 반려해 영업대표가 보완 후 재기안할 차례. 전체 계약의 상태 칸 아래 줄에 "변경 반려"
      //   같은 종류의 새 변경은 막히고 이 기안을 보완해 같은 번호로 다시 올림(REQ-FLOW-17)
      id: '2606CL001-A01', parentId: '2606CL001', counterparty: '해랑출판', services: ['CK'], type: 'SaaS 이용계약', kind: 'AMEND',
      amount: 3000000, requesterId: 'u_sales2', requestedAt: '2026-10-08 10:00', restricted: false, personalData: false,
      status: 'REJECTED', round: 1, startDate: '2026-11-01', endDate: '2027-06-30',
      checklist: { standard: 'NO', standardNote: '변경 계약서(검사 기능 추가)', price: 'YES', cap: 'YES' },
      products: [{ feature: 'CK_PLG_ALL', qty: 3, amount: 3000000 }],
      history: [
        // 기획자 결정 2026-11-02 E-2: 그때 같은 거래처 최근 계약이 1건(무상 충전 2606CL001-C01, 08-18)이라 "나눠 맺은 계약이 아님"을 함께 확인
        //   ev()가 REVIEW_CHECKS를 붙이므로 SPLIT_CHECK만 덧붙임(결재 창의 기록과 같은 모양)
        Object.assign(ev('S02', 'APPROVE', '2026-10-08 16:00'), { comment: '확인: ' + REVIEW_CHECKS.concat([SPLIT_CHECK]).join(', '), recentSame: 1 }),
        ev('S04', 'REJECT', '2026-10-13 11:20', '변경 계약서에 추가하는 기능의 이용 범위 조항이 빠졌습니다. 조항을 넣은 변경 계약서를 다시 올려 주세요.'),
      ],
    },
  ];
  // 시연용: 체크리스트 4번(v0.21)을 따로 적지 않은 예시는 "아니요"로 채움
  CONTRACTS.forEach(function (c) { if (c.checklist && !c.checklist.accounting) c.checklist.accounting = 'NO'; });
  // 기획자 결정 2026-11-02 E-1(G-02): 운영 시작(2026-09) 뒤 계약 등록에서 기안한 예시 계약의 판다 영업기회번호(가상 번호). 번호 하나에 계약 하나
  //   변경(2601CL001-A01, 2606CL001-A01)은 원계약과 따로 번호. 시안에서 기안한 계약과 반려된 2610CL001은 form.opportunity
  //   영업기회 대사(SCR-62) 시연: 2609CL004는 8월(운영 시작 전) 수주라 9월 수주 목록에 없음. 9월 목록의 도담고등학교(2609CK024)는 아직 계약이 없음
  //   2610CL010은 같은 고객의 9월 계약(2609CL005)과 같은 번호라 기안할 때 사유를 받음(oppDup { ids, reason }, 결재 문서에 보임)
  //   D-0002(소담에듀, 임시 저장)는 반려된 2610CL001과 같은 번호라 계약 등록에서 경고하고 사유를 받는 예시(form.oppReason)
  const OPP_OF = {
    '2609CL001': '2609HR003', '2609CL002': '2609CK005', '2609CL003': '2609CK011', '2609CL004': '2608CK021', '2609CL005': '2609CK019', '2609CL006': '2609HR014',
    '2610CL002': '2610HR007', '2610CL003': '2610CK002', '2610CL004': '2610HR001', '2610CL005': '2610CK009', '2610CL006': '2610CK015', '2610CL007': '2610CK018',
    '2610CL008': '2610HR011', '2610CL009': '2610CK020', '2610CL010': '2609CK019', '2601CL001-A01': '2610CK006', '2606CL001-A01': '2610CK004',
    // 기획자 결정 2026-11-03(C-44) 시연 계약 둘(기태민 기안): 9월 수주 목록(OPP_SAMPLE)에도 넣어 영업기회 대사의 9월 예외는 처음 이야기대로 둠
    '2609CL010': '2609CK031', '2609CL011': '2609HR021',
  };
  CONTRACTS.forEach(function (c) {
    if (OPP_OF[c.id] && !(c.form && c.form.opportunity)) c.opportunity = OPP_OF[c.id];
    if (c.id === '2610CL010') c.oppDup = { ids: ['2609CL005'], reason: '9월 GPT Killer 계약과 같은 판다 영업기회(학교 전체 도입)라 같은 번호를 씀. 판다에 추가 이용자 영업기회를 따로 만들지 않았음' };
    if (c.draftKey === 'D-0002') Object.assign(c.form, { opportunity: '2610SU031', oppReason: '반려된 2610CL001은 다시 기안하지 않고, 같은 영업기회의 GPT Killer만 먼저 견적서로 계약함' });
  });

  // 강조와 알림 기준 일수. 처음 값은 [가정]이고, 관리자가 결재선 규칙(SCR-52)에서 사유와 함께 바꿈(바꾸면 관리자 변경 이력, common.js applyAdmin ALERT_RULE)
  //   기획자 결정 2026-11-02 A-5(추천과 다름): 해지 통지 기한과 체결 후 의무의 알림 일수 네 칸도 지금 바로 결재선 규칙에서 바꿈
  const ALERT_RULES = {
    approvalDelayDays: 5,    // 한 결재 단계에 머문 기간: 내가 검토할 계약의 대기 일수 강조 (REQ-DASH-05)
    signDelayDays: 14,       // 승인 후 체결이 끝나지 않은 기간: 체결 대기 목록 강조, 기안자 독촉 이메일 (REQ-ENV-10)
    // 해지 통지 기한 (v0.53 기획자 요청, REQ-FLOW-32): 자동갱신 계약의 만료일 - 통지 일수
    noticeSoonDays: 30,      // 기한이 이 날수 안이면 개요, 만료 예정, 계약 상세에서 강조하고 만료 예정 목록에 넣음
    // 기한 이 날들 전에 이메일(NOTICE_DEADLINE): 영업대표에게 모든 날, 그 유닛 리더에게 가장 짧은 날(기획자 결정 2026-11-02 E-12, NOTICE_DEADLINE_LEAD)
    noticeMailDays: [30, 7],
    // 체결 후 의무 (v0.53 기획자 결정, REQ-FLOW-33~36) [가정]
    obligationSoonDays: 14,      // 기한이 이 날수 안이면 "D-n"으로 강조하고 개요 "챙길 의무"에 넣음
    obligationMailDays: [14, 3], // 기한 14일 전과 3일 전에 맡은 분야에 이메일(OBLIGATION). 지나면 다음 날 그 분야 리더에게도
    expiryWindowDays: 90,        // 만료 예정(개요의 만료 임박, 만료 예정 계약)에 넣는 날수: 90일 안에 끝나거나 해지 통지 기한이 오는 계약
  };
  /* 가격 예외의 영업 임원 승인 기준 (기획자 결정 2026-11-02 E-3 A안, 추천과 다름)
   * cooOverPp: 한 줄이라도 할인율이 할인율 한도를 이 %p보다 더 넘으면 ③에서 유닛 리더 다음에 영업 임원(COO)도 승인. 금액은 보지 않음
   *   [가정] 10%p는 자리 값. 실제 기준은 기능마다 실제 할인율 한도가 들어온 뒤(E-4) 정함
   *   관리자가 결재선 규칙(SCR-52)에서 바꿈(common.js applyAdmin의 PRICE_RULE, 변경 이력 영역 RULE). 화면은 C.cooOverPp()로 읽음
   *   계약에는 기안한 때의 값을 씀: 기안 뒤에 바꿔도 결재 중인 계약의 결재선은 그대로(PRICE_RULE_CHANGES로 그때 값을 찾음) */
  const PRICE_RULES = { cooOverPp: 10 };
  const PRICE_RULE_CHANGES = []; // { key, from, to, at } 관리자가 바꾼 이력. common.js applyAdmin이 더함
  // 위임전결 근거(기획자 결정 2026-11-02 E-3): 결재선 규칙이 따르는 회사 규정의 이름과 판 { name, ver, by, at }
  //   처음에는 비어 있고 운영 시작 전에 관리자가 결재선 규칙(SCR-52)에서 넣음(common.js applyAdmin RULE_BASIS). 결재선은 바뀌지 않음
  const RULE_BASIS = null;
  /* 만료 처리와 유예 (기획자 결정 2026-11-02 A-10, A-11) [가정]
   * graceMaxDays: 유예 기한은 종료일 뒤 이 날수까지(문서에서도 아직 가정한 값이라 실제로 맞는지 확인 필요)
   * graceAskDays: 끝나기 전에는 종료일 이 날수 전부터 유예를 요청할 수 있음(만료 30일 전 이메일과 같은 때) */
  const EXPIRY_RULES = { graceMaxDays: 30, graceAskDays: 30 };
  // 이 시스템을 쓰기 시작한 달(계정 등록일 기준). 매월 기록 점검과 분기 권한 검토는 이달부터 셈(개요의 점검할 일, 접속 기록 점검)
  const SERVICE_START_MONTH = '2026-09';

  /* ---------- 체결 후 의무 (v0.53 기획자 결정, 요구사항 정의서 REQ-FLOW-33~36, 데이터 정의서 obligation) ----------
   * Ironclad와 SAP를 견줘 본 뒤 받아들인 기능. 계약을 맺은 뒤 지켜야 할 약속을 담당 분야와 기한으로 챙김
   * 범위(기획자 결정): 보안 의무(개인정보 파기, 사고 통지, 보안 감사 협조), SLA, 청구 일정
   * - 계약 묶음(원계약 번호, bundle)에 붙음. 체결본을 등록한 계약부터 더할 수 있음
   * - 맡는 분야(owner)는 종류마다 정해 둔 역할: 사람이 아니라 분야라 인사이동이 저절로 반영됨(지정 열람자와 같은 생각)
   * - when: ONCE 한 번(due) / REPEAT 되풀이(first부터 everyMonths달마다, 계약이 끝나는 날까지) / EVENT 일이 생기면(within 안에)
   * - records: 이행 기록 { for: 어느 기한의 것(일이 생기면 null), at, by, note }. 고치거나 지울 수 없음
   * - 끝냄: 더 챙기지 않을 때 사유를 적어 끝냄(endedAt, endedBy, endReason). 지우지 않음 */
  const OBLIGATION_KINDS = {
    SECURITY: { label: '보안 의무', owner: 'PRIVACY', tone: 'attention' },
    SLA: { label: 'SLA', owner: 'CEM', tone: 'progress' },
    BILLING: { label: '청구 일정', owner: 'FINANCE', tone: 'success' },
  };
  const OBLIGATION_WHEN = { ONCE: '한 번', REPEAT: '되풀이', EVENT: '일이 생기면' };
  // 자주 쓰는 의무: 의무 더하기 창에서 고르면 칸이 채워짐 [가정: 법무 확인 전 예시 문구. 기한과 시간은 계약서 조항을 따름]
  const OBLIGATION_PRESETS = [
    { kind: 'SECURITY', title: '계약이 끝난 뒤 위탁받은 개인정보를 파기하고 확인서 보내기', when: 'ONCE', afterEndDays: 5 },
    { kind: 'SECURITY', title: '개인정보 사고를 알게 되면 고객에게 바로 알리기', when: 'EVENT', within: '알게 된 때부터 24시간 안' },
    { kind: 'SECURITY', title: '고객의 수탁자 점검(보안 감사)에 자료 내기', when: 'EVENT', within: '요청받은 날부터 10일 안' },
    { kind: 'SECURITY', title: '해마다 수탁자 보안 교육 이수 확인서 보내기', when: 'REPEAT', everyMonths: 12 },
    { kind: 'SLA', title: '달마다 SLA 보고서(가용률) 보내기', when: 'REPEAT', everyMonths: 1 },
    { kind: 'SLA', title: '장애가 나면 1차 대응하기', when: 'EVENT', within: '알게 된 때부터 4시간 안' },
    { kind: 'BILLING', title: '분할 청구하기', when: 'ONCE' },
    { kind: 'BILLING', title: '분기마다 청구하기', when: 'REPEAT', everyMonths: 3 },
  ];
  function rec(forDue, at, by, note) { return { for: forDue, at: at, by: by, note: note }; }
  const OBLIGATIONS = [
    // 이음병원(2604CL001, 개인정보 처리위탁, SLA 있음): 10월 SLA 보고서가 기한을 넘긴 예시
    { id: 'OB-0001', bundle: '2604CL001', kind: 'SLA', title: '달마다 SLA 보고서(가용률 99.5%) 보내기', clause: 'SLA 제4조', when: 'REPEAT', first: '2026-06-05', everyMonths: 1,
      by: 'u_sales1', at: '2026-05-02 10:00',
      records: [rec('2026-06-05', '2026-06-04 17:20', 'u_cem', '5월 가용률 99.92% 보고서 보냄'), rec('2026-07-05', '2026-07-03 16:10', 'u_cem', '6월 가용률 99.88% 보고서 보냄'),
        rec('2026-08-05', '2026-08-05 10:30', 'u_cem', '7월 가용률 99.95% 보고서 보냄'), rec('2026-09-05', '2026-09-04 15:00', 'u_cem', '8월 가용률 99.61% 보고서 보냄(2026-08-21 장애 반영)')] },
    { id: 'OB-0002', bundle: '2604CL001', kind: 'SLA', title: '장애가 나면 1차 대응하기', clause: 'SLA 제6조', when: 'EVENT', within: '알게 된 때부터 4시간 안',
      by: 'u_sales1', at: '2026-05-02 10:00',
      records: [rec(null, '2026-09-12 11:40', 'u_cem', '09:50 접속 지연 신고를 받고 10:30 원인 확인과 1차 조치(40분 걸림)')] },
    { id: 'OB-0003', bundle: '2604CL001', kind: 'SECURITY', title: '고객의 수탁자 점검(보안 감사)에 자료 내기', clause: '개인정보 처리위탁 계약 제7조', when: 'EVENT', within: '요청받은 날부터 10일 안',
      by: 'u_legal', at: '2026-05-04 09:30',
      records: [rec(null, '2026-08-20 11:00', 'u_privacy', '병원 정보보호팀 감사 요청(2026-08-14)에 CEM유닛과 함께 접속 기록 사본 냄')] },
    { id: 'OB-0004', bundle: '2604CL001', kind: 'SECURITY', title: '계약이 끝난 뒤 위탁받은 개인정보를 파기하고 확인서 보내기', clause: '개인정보 처리위탁 계약 제9조', when: 'ONCE', due: '2027-05-05',
      by: 'u_legal', at: '2026-05-04 09:30', records: [] },
    // 온새미로대학교(2512CL001): 2차 분할 청구가 11일 남은 예시, 해마다 교육 확인서는 이 계약 기간에는 모두 함
    { id: 'OB-0005', bundle: '2512CL001', kind: 'BILLING', title: '1차 분할 청구(선금 50%)', clause: '이용계약 제5조', when: 'ONCE', due: '2026-01-15', amount: 36000000,
      by: 'u_sales1', at: '2026-01-05 10:00', records: [rec('2026-01-15', '2026-01-14 15:00', 'u_finance', '세금계산서 발행(2026-01-14)')] },
    { id: 'OB-0006', bundle: '2512CL001', kind: 'BILLING', title: '2차 분할 청구(잔금 50%)', clause: '이용계약 제5조', when: 'ONCE', due: '2026-10-30', amount: 36000000,
      by: 'u_sales1', at: '2026-01-05 10:00', records: [] },
    { id: 'OB-0007', bundle: '2512CL001', kind: 'SECURITY', title: '해마다 수탁자 보안 교육 이수 확인서 보내기', clause: '개인정보 처리위탁 계약 제6조', when: 'REPEAT', first: '2026-03-31', everyMonths: 12,
      by: 'u_legal', at: '2026-01-06 11:00', records: [rec('2026-03-31', '2026-03-27 14:00', 'u_privacy', '2026년 보안 교육 이수 확인서(12명) 보냄')] },
    // 한결대학교(2511CL001): 계약이 끝나면 파기
    { id: 'OB-0008', bundle: '2511CL001', kind: 'SECURITY', title: '계약이 끝난 뒤 위탁받은 개인정보를 파기하고 확인서 보내기', clause: '이용계약 제14조', when: 'ONCE', due: '2026-11-19',
      by: 'u_legal', at: '2025-11-14 10:00', records: [] },
    // 청람컨설팅(2609CL001): 체크리스트 4번 특수 조건(첫해 2개월 무상)과 이어지는 청구
    { id: 'OB-0009', bundle: '2609CL001', kind: 'BILLING', title: '무상 사용 2개월이 끝나 첫 청구하기', clause: '이용계약 제5조 2항', when: 'ONCE', due: '2026-12-15', amount: 1600000,
      by: 'u_sales2', at: '2026-10-03 09:00', records: [] },
    // 푸른솔아카데미(2511CL002, 열람 제한): 맡은 분야는 고객사를 못 봐도 의무는 챙김
    { id: 'OB-0010', bundle: '2511CL002', kind: 'BILLING', title: '남은 이용료 청구(2회차)', clause: '이용계약 제5조', when: 'ONCE', due: '2026-10-25', amount: 15000000,
      by: 'u_sales2', at: '2025-12-10 10:00', records: [] },
  ];


  /* ---------- 공지사항과 릴리즈 (SCR-91, SCR-92, v0.45 기획자 요청) ----------
   * 한 게시판에 구분 두 가지: 공지(NOTICE), 릴리즈(RELEASE). 읽기는 모두, 쓰기는 관리자와 최고관리자
   * 릴리즈는 게임 패치 노트처럼 버전과 날짜, 새 기능 / 개선 / 바뀐 규칙 / 고친 문제로 나눠 씀(items)
   * important: 중요 공지. 올리면 전체 사용자에게 이메일로 알림(REQ-ENV-10 ⑧). 개요에는 가장 최근 글 한 줄(진행 현황, 만료 임박 다음 세 번째, v0.55)
   * 아래 릴리즈는 이 시안에서 실제로 바뀐 내용과 날짜입니다(요구사항 정의서 변경 이력과 같은 날짜)
   * v0.47 기획자 요청: "릴리즈 노트"를 "릴리즈"로 줄임. 제목은 휴대폰(아이폰 18 Pro) 개요 한 줄에 다 보이게 짧게
   *   (10자 안팎. 릴리즈는 버전을 빼고. 중요 공지는 "중요" 표시가 붙어 공지보다 짧아야 함)
   * 기획자 결정 2026-11-02 E-15: 릴리즈만 changeScreens(바뀐 화면 번호들)와 changeDays(보일 날 수, 처음 값 14)를 둘 수 있음.
   *   올린 날 + 날 수까지 그 화면의 회색 안내 상자(없으면 제목 아래)에 "바뀐 점" 한 줄(common.js renderChangeNote). 없으면 어느 화면에도 안 보임 */
  const NOTICE_KINDS = { NOTICE: '공지', RELEASE: '릴리즈' };
  const RELEASE_PARTS = [['added', '새 기능'], ['improved', '개선'], ['changed', '바뀐 규칙'], ['fixed', '고친 문제']];
  const NOTICES = [
    { id: 'N-0001', kind: 'NOTICE', important: true, title: '시스템 시범 운영 시작', at: '2026-10-19 09:00', by: 'u_super',
      pinUntil: '2026-11-02', // 기획자 결정 2026-11-02 D-20: 중요 공지는 이날까지 공지사항 1쪽 맨 위에 고정(올린 날부터 14일, 03 notice 표 pin_until 제안)
      body: ['오늘부터 계약 등록과 결재를 이 시스템에서 시범 운영합니다. 기존 전자결재로 올리던 계약 품의는 이 시스템으로 올려 주세요.',
        '로그인은 회사 Google 계정으로 하고, 사내망이나 VPN에서만 접속할 수 있습니다.',
        '쓰다가 불편한 점은 경영지원유닛 원지안에게 알려 주세요. 고친 내용은 이 게시판의 릴리즈로 알려 드립니다.'] },
    { id: 'N-0002', kind: 'NOTICE', important: false, title: '휴대폰에서 결재하는 방법', at: '2026-10-19 09:30', by: 'u_super',
      body: ['휴대폰에서도 결재 문서를 열어 승인, 보완 요청, 반려를 할 수 있습니다. 결재 차례가 되면 오는 이메일의 링크를 누르면 됩니다.',
        '첨부 파일은 휴대폰에서 미리보기만 됩니다. 내려받기는 PC에서 해 주세요.'] },
    { id: 'N-0003', kind: 'RELEASE', version: 'v0.6.0', title: '새 달력과 계약 등록', at: '2026-10-21 10:00', by: 'u_super',
      items: {
        added: ['모든 날짜 칸에 큰 달력을 붙였습니다(KRDS). 이전 달, 다음 달, 연도와 월을 고를 수 있습니다.'],
        improved: ['날짜를 2027-01-01처럼 씁니다.', '글은 양쪽 정렬로 보여 줍니다. 휴대폰에서는 글자 단위로 줄을 바꿔 낱말 사이가 벌어지지 않습니다.'],
        changed: ['"계약 구분"을 "계약종류"(신규, 변경, 연장)로 바꿨습니다. "갱신"은 "연장"으로 부릅니다.', '계약 유형을 없애고 계약 방식(직접, 조달, 간접)을 버튼으로 고릅니다.', '계약일과 서비스 기간 칸을 뺐습니다. 계약 시작일과 종료일만 넣습니다.'],
      } },
    { id: 'N-0004', kind: 'RELEASE', version: 'v0.7.0', title: '계약번호 새 규칙', at: '2026-10-21 15:00', by: 'u_super',
      items: {
        added: ['거래처 아래에 기관(부서)을 둘 수 있습니다. 예: 한 대학의 중앙도서관, 대학원'],
        improved: ['직접 넣은 사업자등록번호는 국세청에 폐업, 휴업을 조회합니다.', '종료일 달력에서는 시작일보다 앞선 날을 고를 수 없습니다.', '휴대폰 머리글을 한 줄로 줄였습니다.'],
        changed: ['계약번호가 2610CL001처럼 바뀝니다(기안 연월 + CL + 일련번호).', '열람 제한 계약의 변경, 연장 기안은 열람 제한을 이어받습니다.'],
      } },
    { id: 'N-0005', kind: 'NOTICE', important: true, title: '계약번호 규칙 변경', at: '2026-10-21 15:10', by: 'u_super',
      pinUntil: '2026-11-04', // D-20 맨 위 고정이 끝나는 날(올린 날부터 14일)
      body: ['계약번호를 판다 영업기회번호와 같은 꼴로 바꿨습니다. 기안한 연월 4자리 + CL + 그 달 일련번호 3자리입니다(예: 2610CL001).',
        '변경, 연장, 해지, 운영 변경 기안은 원계약 번호 뒤에 -A01, -R01, -T01, -C01이 붙습니다.',
        '이미 등록된 계약도 새 번호로 바꿔 보여 줍니다.'] },
    { id: 'N-0006', kind: 'RELEASE', version: 'v0.8.0', title: '날짜 입력과 SLA', at: '2026-10-21 17:00', by: 'u_super',
      items: {
        added: ['계약 등록에 "서비스 수준 협약(SLA)"을 이 계약과 별도로 체결하는지 넣었습니다.', '첨부에 "부속 서류"를 올릴 수 있습니다. 비밀유지계약서 같은 서류를 함께 올립니다.'],
        improved: ['날짜 칸은 숫자만 넣으면 넣는 대로 "-"가 붙습니다.'],
        changed: ['금전 거래가 있는 계약만 등록합니다. 비밀유지계약은 따로 등록하지 않고 부속 서류로 올립니다.'],
        fixed: ['없는 날짜(13월, 2월 30일 등)를 넣으면 칸을 떠날 때 바로 알려 줍니다.'],
      } },
    { id: 'N-0007', kind: 'RELEASE', version: 'v0.9.0', title: '공지사항과 내 계정', at: '2026-10-22 18:00', by: 'u_super',
      items: {
        added: ['공지사항 메뉴를 새로 만들었습니다. 공지와 릴리즈를 한곳에서 봅니다.', '이름을 누르면 내 계정 화면으로 갑니다. 받을 이메일을 고를 수 있습니다.'],
        improved: ['휴대폰과 태블릿에서는 메뉴를 한 줄로 두고 옆으로 밀어 봅니다. 메뉴가 더 있으면 끝이 흐려지고 화살표가 보입니다.',
          '태블릿도 휴대폰과 같은 화면을 씁니다.', '휴대폰에서 개요의 계약 진행 현황을 단계마다 한 줄로 보여 줍니다.', '화면 맨 아래 시스템 이름을 세 줄로 바꿨습니다.'],
      } },
    // v0.9.1 (요구사항 정의서 v0.46): 기관 또는 부서명 직접 입력, 달력 두 번 눌러 입력
    { id: 'N-0008', kind: 'RELEASE', version: 'v0.9.1', title: '기관명 입력과 달력', at: '2026-10-22 19:00', by: 'u_super',
      items: {
        improved: ['달력에서 고른 날짜를 한 번 더 누르면 확인을 누르지 않아도 바로 입력됩니다. 달력의 "오늘" 아래에 작게 알려 줍니다.'],
        changed: ['"기관(부서)"을 "기관 또는 부서명"으로 바꾸고, 고르지 않고 직접 적습니다. 기관 이름은 사업자등록번호처럼 확인할 고유 번호가 없기 때문입니다.',
          '거래처마다 두던 기관 목록을 없앴습니다. 거래처 검색에서도 기관 이름으로는 찾지 않습니다. 이미 등록한 계약의 기관 이름은 그대로 남습니다.'],
      } },
    // v0.9.2 (요구사항 정의서 v0.47): 제품과 기능을 나눔, 제품과 기능 관리 화면
    { id: 'N-0009', kind: 'RELEASE', version: 'v0.9.2', title: '제품과 기능 관리', at: '2026-10-22 20:00', by: 'u_super',
      items: {
        added: ['관리자 메뉴에 "제품과 기능 관리"를 새로 만들었습니다. 관리자와 최고관리자가 제품(예: 프리즘)과 그 기능(예: 결함검사, 표절검사, GPT Killer)을 넣고 고칩니다.',
          '기능은 한 줄에 하나씩 적어 여러 개를 한 번에 넣을 수 있습니다.'],
        changed: ['계약 등록의 "금액과 제품"을 "제품과 금액"으로 바꿨습니다. 줄마다 제품, 기능, 플랜을 차례로 고릅니다.',
          '같은 제품이라도 기능마다 플랜(가격)이 다를 수 있습니다. 가격 기준 관리에서는 기능마다 플랜을 추가합니다.',
          '코드 관리의 서비스는 한 단계만 둡니다. 카피킬러 캠퍼스, 프리즘 같은 이름은 제품으로 옮겼습니다.',
          // 원래 세션의 요청(요구사항 정의서 v0.48): 공지사항 구분 이름 바꿈도 이 릴리즈에 함께 알림
          "'릴리즈 노트'를 '릴리즈'로 줄였습니다. 제목은 휴대폰 한 줄에 들어가게 짧게 씁니다."],
      } },
    // v0.9.3 (요구사항 정의서 v0.49): 제품 → 기능 두 단계로 줄임, 플랜 없앰, 서비스는 제품에 저절로 붙음
    { id: 'N-0010', kind: 'RELEASE', version: 'v0.9.3', title: '제품과 기능 단순화', at: '2026-10-22 21:00', by: 'u_super',
      items: {
        changed: ['제품과 기능 두 단계만 둡니다. 플랜은 없애고, 가격은 기능마다 하나입니다.',
          '계약 등록에서는 제품과 기능만 고릅니다. 서비스는 고른 제품에 따라 저절로 붙습니다(예: 카피킬러 캠퍼스 → 카피킬러).',
          '제품을 추가할 때 이름에 서비스 이름이 들어 있으면 서비스를 저절로 고릅니다.',
          '가격 기준 관리의 "플랜 추가"를 "가격 추가"로 바꿨습니다. 아직 가격이 없는 기능에 가격을 넣습니다.'],
      } },
    // v0.9.4 (요구사항 정의서 v0.50): 태블릿은 PC 화면, 메뉴 줄은 모든 화면에서 한 줄
    { id: 'N-0011', kind: 'RELEASE', version: 'v0.9.4', title: '태블릿은 PC 화면', at: '2026-10-22 22:00', by: 'u_super',
      items: {
        changed: ['태블릿은 PC와 같은 화면을 씁니다. 휴대폰 화면은 스마트폰에만 씁니다(가로로 눕혀도). 예: 계약 진행 현황 단계가 태블릿에서는 PC처럼 가로로 이어집니다.'],
        improved: ['PC와 태블릿도 메뉴를 한 줄로 둡니다. 다 들어가지 않으면 옆으로 밀어 보고, 끝이 흐려지며 화살표가 보입니다.',
          '휴대폰 메뉴의 흐려지는 부분을 넓히고, 화살표와 물음표(이용 안내) 사이를 좁혔습니다.',
          '휴대폰에서 공지사항 거르기 칸을 한 줄에 하나씩 두어 검색 안내 글자가 잘리지 않습니다.'],
      } },
    // v0.9.5 (요구사항 정의서 v0.51): 표 정렬, 사람 이름 표기, 공지사항 거르기
    { id: 'N-0012', kind: 'RELEASE', version: 'v0.9.5', title: '표 정렬과 이름 표기', at: '2026-10-22 23:00', by: 'u_super',
      items: {
        changed: ['사람 이름을 "경영지원유닛 원지안"처럼 조직과 함께 씁니다. 맨 위 내 이름과 개요 인사말에만 "님"을 붙입니다.'],
        improved: ['표 안 글자를 왼쪽 정렬로 바꿔 낱말 사이가 벌어지지 않습니다. 날짜, 사람, 상태처럼 짧은 칸은 가운데에 둡니다.',
          '결재란의 담당 칸은 역할, 조직, 이름을 줄로 나눠 보여 줍니다.',
          '공지사항 거르기는 다른 목록처럼 검색어를 맨 위에 넓게 둡니다.'],
      } },
    // v0.9.6 (요구사항 정의서 v0.52 REQ-AUTH-20): 열람 제한 계약의 지정 열람자
    { id: 'N-0013', kind: 'RELEASE', version: 'v0.9.6', title: '열람자 지정', at: '2026-10-22 23:30', by: 'u_super',
      items: {
        added: ['관리자가 열람 제한 계약을 볼 조직이나 사람을 더 지정할 수 있습니다(열람 제한 관리). 지정되면 이메일로 알려 드립니다.',
          '조직으로 지정하는 것이 기본이라 인사이동이 저절로 반영됩니다. 사람으로 지정하면 그 사람이 다른 조직으로 옮길 때 지정이 풀리고 관리자에게 알립니다.'],
        improved: ['계약 상세와 결재 문서의 "열람 제한" 칸에 지정 열람자가 보입니다.', '변경, 연장, 해지 기안도 지정 열람자를 그대로 이어받습니다.'],
      } },
    // v0.9.7~v0.9.9 (요구사항 정의서 v0.53 기획자 요청)
    { id: 'N-0014', kind: 'RELEASE', version: 'v0.9.7', title: '어두운 화면', at: '2026-10-22 23:40', by: 'u_super',
      items: {
        added: ['어두운 화면(다크모드)을 씁니다. 처음에는 PC나 휴대폰의 설정을 따르고, 내 계정의 "화면"에서 밝게, 어둡게를 고를 수 있습니다. 인쇄는 언제나 밝게 나옵니다.'],
        changed: ['머리글 둘째 줄을 "무하유 계약 관리 플랫폼"으로, 바닥글의 영문 이름을 "Contract Lifecycle Intelligent Management Base"로, 저작권 줄을 "MUHAYU Inc."로 바꿨습니다.'],
      } },
    { id: 'N-0015', kind: 'RELEASE', version: 'v0.9.8', title: '판 관리와 표준계약서', at: '2026-10-22 23:50', by: 'u_super',
      items: {
        added: ['보관함에 "표준계약서"를 더했습니다. 지금 판을 내려받고, 법무와 관리자는 적용 시작일과 바뀐 조항, 근거를 적어 새 판을 올립니다.',
          '계약 등록에서 체크리스트 1번과 함께 "기준 표준계약서"를 고릅니다. 고른 표준계약서와 판이 결재 문서에 남습니다.'],
        improved: ['결재 문서의 계약서 초안과 체결본에 판 번호와 파일 지문이 붙고, 이전 판은 접어 둡니다. 결재 기록에는 결재자가 본 판이 남습니다.'],
      } },
    { id: 'N-0016', kind: 'RELEASE', version: 'v0.9.9', title: '통계와 계약 요약서', at: '2026-10-22 23:55', by: 'u_super',
      items: {
        added: ['보관함에 "통계와 보고서"를 더했습니다. 체결 금액과 건수, 결재 단계마다 걸린 날, 체크리스트 예외 비율을 보고 A4로 인쇄합니다.',
          '계약 상세의 "계약 요약서"로 계약 한 묶음(개요, 금액, 결재 기록, 체결본, 사후관리)을 A4 문서로 뽑습니다.',
          '자동갱신 계약의 해지 통지 기한 30일 전과 7일 전에 영업대표에게 이메일을 보냅니다.'],
        improved: ['개요와 만료 예정 계약에 해지 통지 기한과 남은 날을 보여 주고, 30일 안이면 강조합니다.',
          '내 계정의 받을 이메일에서 알림마다 "미리 보기"로 예시 메일을 볼 수 있습니다.'],
      } },
    // v0.10.0 (요구사항 정의서 v0.54): 체결 후 의무 관리, 로고 글자 climb
    { id: 'N-0017', kind: 'RELEASE', version: 'v0.10.0', title: '체결 후 의무 관리', at: '2026-10-22 23:58', by: 'u_super',
      items: {
        added: ['보관함에 "의무 관리"를 더했습니다. 계약을 맺은 뒤 지켜야 할 보안 의무, SLA, 청구 일정을 기한과 맡은 분야로 챙깁니다.',
          '계약 상세의 "체결 후 의무"에서 의무를 더하고, 맡은 분야는 하고 나서 이행 기록을 남깁니다. 기한 14일 전과 3일 전에 이메일로 알려 드립니다.',
          '정보보호, 고객지원, 재무의 개요에 "챙길 의무"가 보입니다.'],
        changed: ['로고 글자를 소문자 "climb"으로 바꾸고 SUITE 글꼴을 씁니다. 화면의 안내 글에는 이름 대신 "플랫폼"이라고 씁니다.'],
      } },
    // v0.10.1 (요구사항 정의서 v0.55): 코드와 문서 정리(QA). 화면 동작은 그대로
    { id: 'N-0018', kind: 'RELEASE', version: 'v0.10.1', title: '코드와 문서 정리', at: '2026-10-22 23:59', by: 'u_super',
      items: {
        changed: ['계약 상세와 계약 요약서에 없앤 "계약 유형" 대신 계약 방식(직접, 조달, 간접)을 보여 줍니다.'],
        improved: ['화면 동작은 그대로 두고, 겹치거나 쓰지 않는 코드를 정리했습니다. 어두운 화면에서 창 테두리와 고르기 화살표가 더 잘 보입니다.'],
      } },
    // v0.10.2 (요구사항 정의서 v0.55): 개요 상자 순서(계약 먼저), 현재 진행 두 칸, 이름과 값, 브레드크럼 없앰, 흔들림 막음
    { id: 'N-0019', kind: 'RELEASE', version: 'v0.10.2', title: '개요와 화면 다듬기', at: '2026-10-23 09:00', by: 'u_super',
      items: {
        changed: ['개요의 상자를 계약 먼저 보이게 바꿨습니다: 계약 진행 현황, 만료 임박, 최근 공지 한 줄, 그 밖의 상자 순서입니다.',
          '현재 진행을 "④ 법무"처럼 한 줄로 쓰고, 그 단계에 온 지 며칠인지는 옆 "대기" 칸에 따로 보입니다. 개요, 전체 진행 현황, 내 등록 목록이 같습니다.',
          '만료 임박과 만료 예정 계약의 남은 일자(D-n)를 날짜처럼 가운데에 둡니다.',
          '화면 위의 경로 줄(예: 개요 > 내 계정)을 모든 화면에서 뺐습니다. 내 계정은 안내 상자 없이 계정 정보부터 보입니다.'],
        improved: ['정해진 이름(올린 일시, 진행 중 등)은 흐리게, 바뀌는 값(날짜, 사람, 건수)은 진하게 보여 한눈에 나뉩니다.',
          '공지의 이전 글, 다음 글을 회색 상자에 두어 본문과 나뉘게 했습니다. "올린 날"은 "올린 일시"로 바꿨습니다.',
          '로고 글자 옆 심벌을 조금 작게 했습니다.'],
        fixed: ['짧은 화면과 긴 화면을 오갈 때 화면이 옆으로 흔들리던 것을 고쳤습니다.',
          '휴대폰 개요에서 고객사 이름이 서너 줄로 꺾이던 것을 고쳤습니다.',
          '새 계약 등록의 좁은 칸에서 칸 이름의 낱말 사이가 벌어지던 것을 고쳤습니다.'],
      } },
    // v0.10.3 (요구사항 정의서 v0.55, REQ-ENV-08, REQ-NAME-03~06, REQ-UI-14, 33): 휴대폰 제목 비례 크기, 로고, 영문 명칭, 휴대폰 메뉴, 화면 전환
    { id: 'N-0020', kind: 'RELEASE', version: 'v0.10.3', title: '휴대폰과 화면 전환', at: '2026-10-23 10:00', by: 'u_super',
      items: {
        changed: ['휴대폰에서 제목을 같은 비율로 줄입니다: 화면 제목 27px, 상자 제목 18px. 본문 글자(17px)는 PC와 같습니다.',
          '로고는 PC와 휴대폰에서 같은 크기로 보이고, 심벌과 로고 글자 사이를 조금 좁혔습니다.',
          '화면 맨 아래 로고에서 한글 이름 줄을 빼고 로고 글자와 영문 이름(MUHAYU Contract Lifecycle Intelligent Management Base)만 둡니다.',
          '메뉴의 하위 메뉴를 누른 메뉴 바로 아래에 작게 열고, 밑줄도 누른 메뉴로 옮깁니다. 열어도 화살표와 그러데이션은 그대로이고, 아래 화면이 흐려지며 흐린 곳을 누르면 닫힙니다. PC와 휴대폰이 같습니다.'],
        fixed: ['화면을 옮길 때 반쯤 그려진 화면이나 글꼴이 바뀌는 순간이 보이던 것을 고쳤습니다. 새 화면은 다 그린 뒤 한 번에 보입니다.'],
      } },
    // v0.10.4 (요구사항 정의서 v0.56): 서비스 > 제품 > 기능(대분류 > 중분류 > 소분류), 서비스는 CK, HR, 기타
    { id: 'N-0021', kind: 'RELEASE', version: 'v0.10.4', title: '서비스 대분류', at: '2026-10-23 11:00', by: 'u_super',
      items: {
        changed: ['서비스를 CK, HR, 기타 세 가지로 보입니다. 서비스 > 제품 > 기능 순서로 나뉩니다.',
          '계약 등록에서 제품 목록을 서비스마다 묶어 보입니다.',
          '제품과 기능 관리에서 제품을 추가할 때 서비스를 먼저 고릅니다(제품 이름에서 저절로 정하지 않음).'],
      } },
    // v0.10.5 (요구사항 정의서 v0.57): 기획자 서비스 정리표 반영, 제품 줄 서비스 → 제품 → 기능
    { id: 'N-0022', kind: 'RELEASE', version: 'v0.10.5', title: '서비스 목록과 가격', at: '2026-10-23 14:00', by: 'u_super',
      items: {
        added: ['서비스 정리표대로 제품과 기능을 넣었습니다. CK 제품 18개, HR 제품 3개(프리즘, 몬스터, 교차진단)와 CRM 코드번호입니다.'],
        changed: ['계약 등록의 제품 줄에서 서비스, 제품, 기능을 차례로 고릅니다. 하나뿐이면 저절로 골라지고, 수량 단위는 가격 단위(건, 개)를 따릅니다.',
          'HR 가격은 정리표의 건당 가격입니다. 카피킬러 가격은 받기 전까지 임의 값입니다.',
          '결재 문서의 표준 금액과 할인율은 기안한 날의 가격으로 봅니다.',
          '제품 칸의 줄을 맞추고, 단위(원, 개, 건)는 칸 오른쪽의 회색 상자로 나눴습니다. 휴대폰은 칸마다 한 줄입니다.',
          '제품 추가 버튼을 한 줄 전체로 키웠고, 총액은 5,000,000원처럼 정확한 금액 하나를 오른쪽에 보입니다.',
          '입력 칸을 고른 파란 테두리를 칸 안쪽으로 옮겨, 드롭다운 목록이 열려도 잘려 보이지 않습니다.'],
      } },
    { id: 'N-0023', kind: 'RELEASE', version: 'v0.10.6', title: 'QA 점검과 고침', at: '2026-10-23 18:00', by: 'u_super',
      items: {
        changed: ['계약 등록의 기안, 임시 저장, 보완 후 재기안이 저장되어 결재로 이어집니다.',
          '반려된 해지, 그대로 연장, 운영 변경도 같은 번호의 다음 차수로 다시 기안합니다.',
          '재무도 검토 대기에서 대신 검토할 차례를 봅니다.',
          '가격 기준 관리는 영업지원도 메뉴에서 볼 수 있습니다(보기만).',
          '표준 단가보다 높게 받은 계약은 체크리스트 2번이 아니요입니다.',
          '체크리스트의 비고 칸은 적어야 할 때만(1~3번 아니요, 4번 예) 나타납니다.',
          '계약 등록의 서비스, 제품, 기능을 PC에서도 한 줄에 하나씩 둡니다.'],
        fixed: ['휴대폰에서 맨 위로 버튼이 드롭다운을 덮어 눌러도 열리지 않던 문제를 고쳤습니다(위로 올릴 때만 잠깐 보임).',
          '제품 이름이 두 번 보이던 기능 이름을 고쳤습니다(예: 몬스터 A).',
          '검토 대기에서 볼 수 없는 열람 제한 계약의 이름을 가립니다.',
          '시연 역할을 바꿔도 보던 결재 문서와 계약 상세가 그대로 열립니다.',
          '반려되면 동시에 차례였던 다른 검토도 멈춥니다.',
          '영업이 보는 개요의 건수와 누르면 나오는 목록이 같습니다.',
          '관리자 화면에서 새 계정 번호가 겹치거나 바뀐 것 없는 저장이 남던 문제를 고쳤습니다.'],
      } },
    // v0.11.0 (요구사항 정의서 v0.59, REQ-UI-34~36, REQ-DASH-07): 애플 디자인 요소를 골라 적용, 흑백 인쇄, 기기의 접근성 설정 따르기
    { id: 'N-0024', kind: 'RELEASE', version: 'v0.11.0', title: '디자인과 흑백 인쇄', at: '2026-10-26 17:00', by: 'u_super',
      items: {
        added: ['인쇄는 늘 흑백입니다. 잉크를 아끼려고 검정과 회색만 쓰고 바탕은 칠하지 않습니다. 반려는 검정 테두리와 굵은 글자로 보입니다.',
          '휴대폰에서는 화면 아래 탭 막대(개요, 계약 등록, 계약 현황, 보관함, 더보기)로 메뉴를 엽니다.',
          '기기에서 동작 줄이기, 대비 높이기, 고대비를 켜 두면 화면이 그 설정을 따릅니다.'],
        changed: ['PC 글자를 인쇄 기준으로 줄였습니다. 본문 15px(인쇄 11.25pt), 화면 제목 27px이고, 제목은 단계마다 조금씩 커져 위계가 보입니다.',
          '휴대폰 글자는 아이폰 글자 단계(본문 17px, 보조 15px, 작은 글자 13px)를 따르고, 누르는 칸은 44px입니다.',
          '항목 사이, 상자 안쪽, 표 한 줄의 간격을 촘촘하게 줄였습니다.',
          '상자, 입력 칸, 단추의 모서리를 더 둥글게 했습니다. 메뉴에서 펼쳐지는 목록은 테두리 없는 직각입니다.',
          '상태 배지는 색 테두리 없이 연한 바탕만, 보조 단추(예: 제품 추가)는 초록 테두리 없이 연한 초록 바탕입니다.',
          '라디오와 체크박스를 작아진 글자에 맞춰 줄였습니다.',
          '개요의 만료 임박 표에서 해지 통지 기한 줄을 뺐습니다. 남은 일자로 충분히 알아볼 수 있습니다.',
          '한글 이름을 "무하유 계약 관리 시스템"으로 바꿨습니다. 안내 글과 이메일도 "시스템"이라고 씁니다.',
          '제목을 한 단계씩 키워 위계를 살렸습니다. 상자 제목 21px, 상자 안 작은 제목 17px입니다.',
          '표 한 줄 안의 배지와 글자가 같은 높이에 놓이도록 맞췄습니다.',
          '개요의 단계 표시를 상자 오른쪽 끝까지 넓혔습니다.',
          '메뉴에서 펼쳐지는 목록은 테두리 없이(위쪽 선만) 작게, 입력 칸에서 펼쳐지는 목록은 칸처럼 둥글게 보입니다.',
          '계약 등록과 기안 화면의 묶음 설명을 회색 상자로 보입니다.',
          '로그아웃, 전체 보기처럼 글자 옆 작은 아이콘을 옆 글자 크기에 맞추고 글자 가운데에 놓았습니다. 이용 안내는 중요한 항목이라 크게 둡니다.',
          '표 머리글을 그 칸 내용과 같은 정렬로 맞췄습니다. 대기 일수는 가운데에 둡니다.',
          '개요에서 공지 한 줄을 뺐습니다. 공지와 릴리즈는 공지사항 게시판에서 봅니다.'],
        fixed: ['사용 안 함, 끝난 줄의 흐린 글자와 회색 상자 위 핑크 글자를 더 진하게 해 읽기 쉽게 했습니다.',
          '계약 상세와 요약서의 계약 금액을 오른쪽에 둡니다.',
          '휴대폰에서 로고, 내 이름, 전체 보기 같은 작은 링크도 누르기 쉽게 했습니다.'],
      } },
    // v0.12.0 (요구사항 정의서 v0.60, REQ-UI-14, 20, 34, 36): 메뉴 줄 고정과 유리 바탕, 하위 메뉴 넓게, 휴대폰 ≡ 메뉴
    { id: 'N-0025', kind: 'RELEASE', version: 'v0.12.0', title: '위에 붙는 메뉴 줄', at: '2026-10-28 17:00', by: 'u_super',
      items: {
        added: ['화면을 내리면 메뉴 줄이 위에 붙어 따라옵니다. 뒤 내용이 흐리게 비치는 유리 바탕입니다.',
          '휴대폰은 오른쪽 위 줄 세 개 단추로 오른쪽에서 나오는 메뉴판을 엽니다. 메뉴를 누르면 하위 메뉴로 한 단계 더 들어갑니다.',
          '메뉴 검색: 메뉴 줄의 돋보기(휴대폰은 메뉴판 맨 위)에서 메뉴 이름, 하는 일, 초성으로 메뉴를 찾아 바로 갑니다.'],
        changed: ['메뉴를 누르면 하위 메뉴가 작은 상자 대신 메뉴 줄이 아래로 넓어지듯 펼쳐집니다.',
          '휴대폰 아래 탭 막대를 없앴습니다(앱에서 만들 요소). 브라우저 아래 막대와 겹치지 않습니다.',
          '맨 위로 단추를 없앴습니다. 메뉴 줄이 늘 위에 있어 어디서나 메뉴로 갈 수 있습니다.',
          '투명도 줄이기나 대비 높이기를 켜 두면 메뉴 줄이 비치지 않는 흰 바탕으로 보입니다.',
          '유리 바탕과 메뉴를 펼칠 때 뒤 화면의 흐림을 애플 가이드라인과 애플 웹사이트 메뉴에 맞췄습니다.'],
      } },
    // v0.12.1 (요구사항 정의서 v0.61, REQ-UI-10, 13, 14, 37): 머리글 계정과 검색 아이콘(휴대폰, PC), 펼친 메뉴는 단단하게, 유리는 덜 흐리게, 폭 상한
    { id: 'N-0026', kind: 'RELEASE', version: 'v0.12.1', title: '계정과 검색 아이콘', at: '2026-10-31 17:00', by: 'u_super',
      items: {
        added: ['머리글 오른쪽 위에 계정과 메뉴 검색 아이콘을 둡니다. 계정 아이콘을 누르면 내 이름과 조직, 내 계정, 로그아웃이 나옵니다.',
          '휴대폰은 계정, 메뉴 검색, 전체 메뉴(줄 세 개) 아이콘 셋입니다.',
          'PC에서 화면을 내려 메뉴 줄만 위에 붙으면 계정과 메뉴 검색 아이콘이 메뉴 줄에도 나옵니다.'],
        changed: ['메뉴를 펼치면 펼친 곳이 흰 바탕이 되고, 뒤 화면은 흐리게 하지 않고 살짝만 어둡게 합니다. 뒤 화면이 제자리에 그대로 보입니다.',
          '위에 붙는 메뉴 줄의 유리 바탕을 덜 불투명하고 덜 흐리게 바꿨습니다. 메뉴 글자는 어느 화면에서나 읽기 쉬운 대비를 지킵니다.',
          '메뉴 줄의 돋보기와 휴대폰 메뉴판의 검색 칸, 로그아웃은 머리글 아이콘으로 옮겼습니다. 메뉴 사이 간격을 조금 좁혔습니다.',
          '어떤 화면도 가로 1920px를 넘지 않습니다. 화면은 지금처럼 A4 종이 모양이고, 인쇄는 늘 A4에 맞춥니다.',
          '이용 안내를 문서 사이트처럼 바꿨습니다. 왼쪽 차례에서 쪽을 고르고, 이용 안내 안에서 낱말로 찾을 수 있습니다. 인쇄하면 지금처럼 매뉴얼 한 부로 나옵니다.'],
        fixed: ['Esc를 누르면 초점이 어디에 있든 열려 있는 메뉴가 닫힙니다.',
          '키보드로 메뉴를 쓸 때 펼친 메뉴 밖으로 나가면 메뉴가 닫혀, 가려진 칸으로 초점이 가지 않습니다.',
          '휴대폰 메뉴판을 닫자마자 다시 열어도 사라지지 않습니다.',
          '거래처 찾기 목록이 메뉴 위로 겹쳐 보이지 않습니다.'],
      } },
    // v0.13.0 (요구사항 정의서 v0.61 3.9 REQ-QUO): 견적서
    { id: 'N-0027', kind: 'RELEASE', version: 'v0.13.0', title: '견적서 만들기', at: '2026-10-31 18:00', by: 'u_super',
      items: {
        added: ['메뉴 줄 개요 옆에 견적이 생겼습니다. 제품과 가격 기준 그대로 견적서를 만들고 출력합니다. 엑셀로 따로 만들지 않아도 됩니다.',
          '견적서를 출력할 때마다 누가 언제 어떤 판을 냈는지 기록이 남습니다. 출력한 판은 고칠 수 없고, 바꾸려면 새 판을 만듭니다.',
          '할인율 한도를 넘는 줄은 견적을 만들 때 알려 줍니다. 그 가격으로 계약하면 계약 등록 때 영업 리더의 승인이 필요합니다.'],
        changed: ['견적은 계약과 이어지지 않습니다. 계약은 지금처럼 계약 등록에서 등록합니다.'],
      } },
    // v0.13.1 (요구사항 정의서 v0.61, 통제와 표준 대응표 G-06, G-30): 체결 확인 보강, 거래 윤리 안내
    { id: 'N-0028', kind: 'RELEASE', version: 'v0.13.1', title: '체결 확인 보강과 거래 윤리 안내', at: '2026-10-31 19:00', by: 'u_super',
      items: {
        added: ['체결본을 올릴 때(⑦) 승인된 내용 밖에 고객과 따로 약속한 조건이 없다는 것을 확인합니다.',
          '체결본 확인(⑧)에서 반려할 때 어긋난 항목을 고르고, 통계와 보고서에서 항목별로 볼 수 있습니다.',
          '이용 안내에 거래 윤리와 신고 쪽을 더했습니다(초안).'],
        changed: ['체결본 확인(⑧)의 확인 항목을 날인 검토처럼 항목별로 나눴습니다: 고객사, 제품과 금액, 기간, 정산 방식, 서명과 날인, 계약서 밖 약정.',
          '서명이나 날인만 빠진 체결본은 반려하지 않고 다시 등록을 요청합니다.',
          '체결본 확인(⑧)에서 반려해 다시 기안해도 앞 차수에 올린 체결본이 첨부 파일에 이전 판으로 남습니다.',
          '계약 상세와 계약 요약서의 체결본 목록에도 차수와 "확인한 체결본", 바뀐 까닭(다시 등록 요청, ⑧ 반려)을 적습니다.'],
      } },
    // v0.13.2 (요구사항 정의서 v0.62, 통제와 표준 대응표 G-19, G-01 남은 것): 간접 계약의 사용 업체, 한도 넘은 견적 보기
    { id: 'N-0029', kind: 'RELEASE', version: 'v0.13.2', title: '간접 계약 사용 업체', at: '2026-10-31 21:00', by: 'u_super',
      items: {
        added: ['간접 계약은 제품마다 실제로 쓰는 기관(사용 업체)을 적습니다. 총판 재고처럼 아직 모르면 "아직 정해지지 않음"과 까닭을 고릅니다.',
          '견적 목록에서 할인율 한도를 넘는 줄이 있는 견적만 골라 볼 수 있습니다.',
          '통계와 보고서의 체크리스트 예외에 견적서의 한도 넘음 비율과, 계약 방식과 거래처마다 가격 예외 표를 더했습니다.'],
        improved: ['결재 문서의 제품과 금액 표에 제품마다 사용 업체를 보입니다.',
          '이용 안내의 거래 윤리에 간접 계약의 사용 업체와 경쟁사와의 관계를 더했습니다(초안).'],
        fixed: ['체결본 확인(⑧)에서 반려된 계약을 보완 후 재기안할 때, 다시 채울 값이 없으면 계약 기록에 있는 값(계약 방식, 기간 등)으로 채워 엽니다.',
          '검토 대기에서 볼 수 없는 열람 제한 계약은 서비스 칸도 가리고, 서비스로 걸러도 나오지 않습니다.'],
      } },
    // v0.13.3 (요구사항 정의서 v0.63, 통제와 표준 대응표 G-05 ①③, G-25 ①, G-23 ②③ 일부): ② 확인 항목, 보완 요청 항목, 새 거래처 표시, 분기 검토의 대리 지정과 본 자료
    { id: 'N-0030', kind: 'RELEASE', version: 'v0.13.3', title: '결재 확인 항목', at: '2026-11-01 01:00', by: 'u_super',
      // 기획자 결정 2026-11-02 E-15 시연: 바뀐 화면(결재 문서, 통계와 보고서, 접속 기록 점검, 내 계정)에 14일 동안(2026-11-15까지) "바뀐 점" 한 줄
      //   회색 안내 상자가 있는 화면(통계, 접속 기록 점검)과 없는 화면(결재 문서, 내 계정)을 함께 볼 수 있게 고름. 03 notice 표의 새 칸(제안)
      changeScreens: ['SCR-23', 'SCR-46', 'SCR-57', 'SCR-93'], changeDays: 14,
      items: {
        added: ['② 체크리스트 검토는 승인할 때 확인한 항목 다섯(고객사와 사업자등록번호, 제품 수량과 금액, 1번 답과 표준계약서 판, 4번 답과 계약서 조건, 필수 첨부)을 모두 표시합니다. 결재 기록에 남습니다.',
          '보완을 요청할 때 보완할 항목(체크리스트 답, 제품과 수량과 금액, 계약서 내용, 첨부 파일, 그 밖의 것)을 하나 이상 고릅니다.',
          '통계와 보고서에 "보완 요청 항목"을 더했습니다.'],
        improved: ['계약을 올리며 직접 입력해 등록한 거래처는 결재 문서의 고객사 옆에 "새 거래처"로 보입니다.',
          '결재 문서의 제품과 금액 표 총액 줄에 계약 전체 할인율을 보입니다.',
          '접속 기록 점검의 분기 권한 검토 창에 그 분기의 대리 지정을 보입니다. 점검과 검토 결과를 저장하면 그때 본 자료가 함께 남습니다.',
          '개요의 단계 표시기를 누르면 그 건수와 같은 목록이 열립니다(계약 등록은 작성 중, 계약 완료는 계약 완료).',
          '결재 문서의 체크리스트 4번(회계 영향 조건)은 "예"일 때 강조합니다. "계약 묶음 보기", 진행 중인 기안 번호, 견적의 지난 판은 눌러 열 수 있는 모양으로 보입니다.',
          '견적서의 공급자 칸을 항목마다 한 줄로 나누고, 휴대폰에서 견적서 품목과 결재란 머리글이 글자 중간에서 꺾이지 않습니다.',
          '해지의 ⑨는 "운영 종료", 조건 그대로 연장의 ⑨는 "기간 연장"으로 보입니다. 검토 대기의 함께 검토하는 단계는 이름도 함께 보입니다(예: 동시: ⑤ 개인정보).',
          '체결 대기, 운영 검토 대기, 만료 예정, 견적 목록, 통계와 보고서, 의무 관리의 안내와 건수 이름을 알아보기 쉽게 다듬었습니다.',
          '관리자 화면, 표준계약서, 해지와 연장 검토, 운영 변경 기안의 날짜, 금액 정렬, 안내 문장을 다듬고, 휴대폰에서 표 칸이 글자 두세 개 폭으로 좁아지지 않게 했습니다.',
          '표 안의 날짜가 "2026-" 뒤에서 줄이 바뀌지 않습니다. 새 견적의 제품 추가 단추를 계약 등록과 같게 바꾸고, 내 계정에서 내 역할에 오지 않는 알림은 체크하지 않은 채로 보입니다.'],
        fixed: ['반려된 변경 기안이 있으면 새 변경을 기안하지 않고 그 기안을 보완해 다시 올립니다.',
          '열람 제한은 관리자가 걸거나 풀 때 원계약과 그 뒤의 기안 모두에 적용됩니다.',
          '운영 검토 대기에서 볼 수 없는 열람 제한 계약은 서비스와 회계 표시도 가립니다. 의무 관리에서는 묶음 번호도 가립니다.',
          '계약 요약서의 결재 기록에 처리한 사람의 그때 조직이 나옵니다.',
          '첨부 파일은 안내대로 PDF, Word, 한글 파일만 50MB 이하로 받습니다.',
          '휴대폰에서 펼치기 줄, 체크 줄, 표 안의 짧은 버튼처럼 작던 누름 칸을 손가락 크기(44px)로 넓혔습니다.',
          '결재란의 생략한 단계 글자를 읽기 쉬운 진하기로 바꿨습니다.',
          '영업도 결재 차례 이메일(⑦ 체결본 등록)을 받는 것으로 내 계정에 보입니다.',
          '결재 문서의 첨부 목록에 계약 등록에서 실제로 올린 파일 이름이 나옵니다.',
          '휴대폰에서 선택 칸의 긴 값이 두 줄로 꺾이지 않고 한 줄로 보입니다.',
          '화면 글을 표기 규칙에 맞게 다듬었습니다. 통계 안내, 전체 계약의 변경과 연장 건수, 계약 요약서의 항목 이름, 고객용 견적서 아래 문구, 이메일 미리 보기 등입니다.',
          '반려된 계약을 다시 기안할 때, 걸려 있던 열람 제한은 풀 수 없습니다. 풀기는 관리자가 열람 제한 관리에서 합니다.',
          '사용 안 함으로 돌린 제품의 기능이 든 견적은 그 줄을 다시 고르기 전에는 출력하지 않습니다.',
          '이용 안내를 지금 화면에 맞췄습니다. ⑤ 개인정보 검토를 거치는 조건, 몇 단계만 거치는 기안(해지, 그대로 연장, 운영 변경), 계약 등록에서 꼭 올릴 파일, 담당자 화면을 함께 쓰는 리더입니다.',
          '그 밖에 안내 문구, 휴대폰 만료 예정의 담당, 검토 완료의 보완 요청 거르기 등을 고쳤습니다.'],
      } },
    { id: 'N-0031', kind: 'RELEASE', version: 'v0.14.0', title: '2026-11-02 결정 반영 (결재 흐름, 만료 처리, 큰 모니터)', at: '2026-11-02 17:00', by: 'u_super',
      // 기획자 결정 2026-11-02: 결정 한 장의 첫째, 둘째 묶음과 같은 날 화면 요청. 셋째 묶음(보안과 통제 점검)은 다음에 따로 알림
      items: {
        added: ['할인율 한도를 10%p 넘게 넘은 계약은 ③ 영업 리더 다음에 영업 임원이 한 번 더 승인합니다(③ 영업 임원 승인). 기준은 결재선 규칙에서 바꾸고, 기안 때의 기준을 씁니다.',
          '운영 변경도 ⑩ 재무 확인을 거쳐야 끝납니다. 무상 충전은 같은 계약 연도에 쌓인 건수가 50건을 넘으면 ③ 승인을 받습니다.',
          '끝난 계약은 고객지원이 서비스를 닫고 "만료 처리"로 남깁니다(계약 상세, 만료 예정, 운영 검토 대기). 연장이 늦어지면 영업대표가 종료 뒤 30일 안의 기한으로 유예를 요청하고 영업 리더가 확인합니다.',
          '500만 원 미만 계약은 고객이 날인한 견적서로 계약서를 대신할 수 있습니다(계약 등록에서 고름).',
          '⑦에서 서명본 체결일, ⑨에서 실제 개통일을 적습니다. 통계의 체결 금액과 건수는 서명본 체결일로 세고, 날짜 순서가 이상하면 결재 문서에 안내합니다.',
          '② 체크리스트 검토에 같은 거래처의 최근 계약 상자가 보이고, 금액을 나눠 맺은 계약이 아닌지 확인합니다.',
          '③ 승인 때 "이 거래처와 개인적 이해관계가 없습니다"를 확인합니다. 표준계약서를 바꾼 계약의 ④ 법무 승인에서 반부패 조항 판단을 남깁니다(간접, 조달 계약은 필수).',
          '재무는 결재선 밖에서 계약에 재무 의견을 남길 수 있고, ⑩ 재무 확인 창에서 그 의견을 봅니다.',
          '통계와 보고서에 기간 마감 점검(재무가 기간 말 앞뒤 계약을 확인)과 통제 지표를 더했습니다.',
          '결재선 규칙에서 알림 일수(결재 독촉, 해지 통지 기한, 의무 기한), 영업 임원 승인 기준, 위임전결 근거를 바꿉니다. 해지 통지 기한 이메일은 영업 리더도 받습니다.',
          '결재 단계 이름을 맡는 사람으로 보입니다(② 영업지원, ③ 영업 리더, ④ 법무, ⑤ 정보보호, ⑥ 총무, ⑦ 기안자, ⑧ 영업지원, ⑨ 고객지원, ⑩ 재무).'],
        improved: ['큰 모니터(화면 배율 100%, 창 폭 960px 이상)에서는 화면 전체가 한 단계 커집니다(본문 15px에서 17px). 배치는 그대로이고 노트북, 태블릿, 휴대폰, 인쇄는 바뀌지 않습니다.',
          'PC 머리글의 계정과 검색 아이콘을 아래 끝에 맞췄습니다. 계정 판과 검색 판은 메뉴 줄을 덮으며 펼쳐집니다.',
          '화면을 내려 메뉴 줄이 위에 붙으면 오른쪽에는 계정, 메뉴 검색, 이용 안내 아이콘 셋만 보입니다.',
          '체크리스트 4번(회계 영향 조건)에서 해당하는 종류를 고릅니다.']
      } },
    { id: 'N-0032', kind: 'RELEASE', version: 'v0.15.0', title: '보안과 통제 점검, 화면 다듬기', at: '2026-11-03 13:00', by: 'u_super',
      // 기획자 결정 2026-11-02 셋째 묶음(C, E)과 2026-11-03 기획자 답 넷, 같은 날 화면 요청
      items: {
        added: ['위 메뉴에 "점검"을 두었습니다. 할인 예외 점검(재무 임원), 영업기회 대사(영업지원), 인장 기록 대사(총무), 개선 과제와 보류(컴플라이언스), 설정 변경 확인(재무 리더, 법무)은 맡은 사람에게만 보입니다.',
          '컴플라이언스 담당자 역할: 거래처 확인, 보류 걸기와 풀기, 개선 과제를 기록합니다. 결재 단계는 맡지 않습니다.',
          '감사 열람 역할: 최고관리자가 끝나는 날을 정해 주고, 그날까지 모든 계약과 통계, 변경 이력, 접속 기록 점검을 보기만 합니다. 끝나는 날이 지나면 저절로 풀립니다.',
          '보류: 거래처나 계약 묶음에 보류를 걸면 새 기안과 남은 승인이 멈춥니다(반려와 보완 요청은 됨). 걸 때와 풀 때 막히는 사람에게 이메일이 갑니다.',
          '거래처 확인: 국가와 지자체, 조달, 간접(총판, 리셀러) 거래처는 확인 결과와 다음 확인일을 남깁니다. 확인이 필요한 거래처로 기안하면 계약 등록에 안내가 보입니다.',
          '영업기회번호는 계약 하나에만 씁니다. 다른 고객사 계약에 같은 번호가 있으면 기안할 수 없습니다.',
          '견적서 출력에 회사 인장이 찍힙니다. 회사 설정에서 사업자 정보를 바꾸고(최고관리자), 인장 그림을 올립니다(총무).',
          '영업대표 바꾸기: 영업대표가 퇴사하거나 다른 곳으로 가면 영업 리더가 계약마다 새 영업대표를 정합니다. 정하기 전에는 영업 리더가 맡습니다.',
          '통계와 보고서에 통제 지표(리더, 임원, 감사 열람)와 통제 증빙 내보내기(감사 열람)를, 계약 상세에 결재 기록 묶음을 더했습니다.',
          '접속 기록 점검에 최고관리자 작업 묶음(정보보호가 확인), 역할이 겹치는 계정, 그달의 설정 변경, 유닛 리더에게 계정 목록 보내기를 더했습니다.',
          '개요의 점검할 일에 내가 맡은 점검과 기한이 보입니다. 공지에 바뀐 화면과 보일 기간을 정하면 그 화면에 "바뀐 점" 한 줄이 보입니다.'],
        improved: ['사용자 권한 관리: 겹치면 안 되는 역할을 함께 주면 까닭을 적어야 저장되고, 요청한 사람을 남길 수 있습니다.',
          'HR 유상 충전의 ⑩ 재무 확인은 재무 담당자가 맡습니다(⑨를 한 사람은 ⑩을 하지 않음).',
          '화면 배율 100% 모니터는 휴대폰 화면보다 넓은 창이면 모두 글자가 한 단계 큽니다(본문 17px).',
          '이용 안내는 화면이 넓어도 찾기 칸과 접힌 차례 줄을 내용 위에 둡니다.',
          '하위 메뉴를 펼치면 메뉴 줄과의 사이에 선이 보입니다. 메뉴 줄 끝은 흐림 없이 글자가 화살표 앞에서 사라지고, 가린 만큼 조금씩 나타납니다. 창을 줄여도 지금 화면의 메뉴는 늘 보입니다.',
          '카피킬러 캠퍼스 표절검사와 GPT Killer의 할인 한도를 0%로 맞췄습니다(실제 한도가 정해지면 바꿈). 이미 기안한 계약은 그대로입니다.',
          '계정 아이콘을 누르면 이름과 내 계정, 로그아웃이 오른쪽 끝(아이콘 아래)에 오른쪽 맞춤으로 보이고, 줄 사이가 넉넉해졌습니다.',
          '메뉴 검색에서 검색어가 없으면 최근 검색어 10개가 보입니다(누르면 다시 찾음). 예전의 자주 찾는 메뉴는 없앴습니다.',
          '검색 칸의 돋보기와 입력한 글자, 찾은 메뉴 줄의 글자가 세로 가운데로 맞습니다. 라디오 단추의 가운데 점이 어느 단추에서나 같은 자리에 보입니다.',
          '머리글 아이콘은 검색, 계정 순서입니다(휴대폰은 검색, 계정, 전체 메뉴). 계정 판의 오른쪽 끝은 계정 아이콘의 오른쪽 끝에 맞습니다.'],
        fixed: ['결재란 담당 칸의 조직 이름이 좁은 창에서 칸 밖으로 나오던 것을 고쳤습니다.',
          '견적서로 계약서를 대신한 계약의 결재 문서에 없는 계약서 초안이 보이고 ⑥ 안내가 "계약서 실물"이던 것을 고쳤습니다.',
          '최고관리자가 다른 영업대표 대신 기안할 때 결재선 미리보기의 ⑦에 그 영업대표 이름이 나옵니다.']
      } },
  ];

  /* ---------- 이메일 알림 (내 계정 SCR-93, v0.45 기획자 요청. 보내는 때는 요구사항 정의서 REQ-ENV-10) ----------
   * must: 꼭 받는 알림(업무 처리와 내부 통제에 필요해 끌 수 없음, 기획자 확인 C-26) / 선택 알림은 사람마다 켜고 끔(on: 처음 값)
   * roles: 이 알림을 받는 역할(없으면 모두). 내 역할에 오지 않는 알림은 흐리게 보여 줌 */
  const EMAIL_TYPES = [
    // 영업도 받음: ⑦ 체결본 등록과 ⑧의 다시 등록 요청이 기안한 영업의 차례 (03 CODE-MAIL TURN, REQ-ENV-10 ①. v0.63 점검에서 고침)
    { code: 'TURN', name: '결재 차례', when: '내가 처리할 결재 단계(②~⑩, ⑦ 체결본 등록 포함)가 됐을 때', must: true, roles: ['SALES', 'SALES_ADMIN', 'HEAD', 'LEGAL', 'PRIVACY', 'GA', 'CEM', 'FINANCE', 'EXEC'] },
    { code: 'REJECT', name: '반려와 보완 요청', when: '내가 기안한 계약이 반려되거나 보완 요청을 받았을 때', must: true, roles: ['SALES'] },
    { code: 'SIGN_READY', name: '체결 대기', when: '내가 기안한 계약의 계약 검토가 끝났을 때', must: true, roles: ['SALES'] },
    { code: 'REMIND', name: '독촉', when: '내 차례가 5일 넘게 머물거나, 승인 뒤 14일 동안 체결본이 없을 때', must: true },
    { code: 'EXPIRY', name: '만료 임박', when: '내가 맡은 계약이 끝나기 60일 전과 30일 전', must: true, roles: ['SALES'] },
    // 해지 통지 기한 (v0.53 기획자 요청, REQ-FLOW-32): 연장하지 않으려면 기한까지 상대방에게 알려야 하므로 따로 알림
    //   기획자 결정 2026-11-02 E-12: 영업대표(30일 전, 7일 전)에 더해 기안자 유닛의 영업 리더도 받음(두 번째 이메일인 7일 전만).
    //     일수는 결재선 규칙의 해지 통지 기한 이메일(ALERT_RULES.noticeMailDays)을 따르고, 리더는 그중 가장 짧은 날만(내 계정 account.js가 일수를 넣어 보여 줌)
    //     리더 본인 계약이면 리더가 영업대표로 이미 받으므로 더 보내지 않음 [가정]
    { code: 'NOTICE_DEADLINE', name: '해지 통지 기한', when: '내가 맡은 자동갱신 계약의 해지 통지 기한 30일 전과 7일 전, 그 유닛 리더에게는 7일 전', must: true, roles: ['SALES', 'HEAD'] },
    // 체결 후 의무 (v0.53 기획자 결정, REQ-FLOW-36): 맡은 분야(정보보호, 고객지원, 재무)에게. 지나면 리더에게도
    { code: 'OBLIGATION', name: '챙길 의무', when: '내 분야가 맡은 체결 후 의무의 기한 14일 전과 3일 전, 기한이 지나면 다음 날', must: true, roles: ['PRIVACY', 'CEM', 'FINANCE'] },
    { code: 'ACCOUNTING', name: '회계 영향 조건', when: '체크리스트 4번이 "예"인 계약이 기안됐을 때', must: true, roles: ['FINANCE'] },
    { code: 'SECURITY', name: '이상 행위', when: '접속 기록에서 이상 행위가 감지됐을 때', must: true, roles: ['PRIVACY'] },
    { code: 'NOTICE_IMPORTANT', name: '중요 공지', when: '관리자가 중요 공지를 올렸을 때', must: true },
    // 지정 열람자 (v0.52 기획자 결정, REQ-AUTH-20): 지정되면 알림(꼭 받음), 사람 지정이 인사이동으로 풀리면 관리자에게 알림
    //   exceptRoles: 받지 않는 역할. 기획자 결정 2026-11-02 A-9: 관찰자는 지정되어도 볼 수 없으므로 조직 지정 알림도 보내지 않음
    { code: 'VIEWER', name: '열람자 지정', when: '내가, 또는 내 조직이 열람 제한 계약의 열람자로 지정됐을 때', must: true, exceptRoles: ['OBSERVER'] },
    { code: 'VIEWER_RELEASED', name: '열람자 지정 풀림', when: '사람으로 지정한 열람자가 다른 조직으로 옮겨 지정이 저절로 풀렸을 때', must: true, roles: ['ADMIN'] },
    // 기획자 결정 2026-11-03(06 CTL-79): 보류를 걸 때와 풀 때 막히는 사람 모두에게(꼭 받음). 받는 사람은 common.js holdMailList:
    //   그 보류에 걸린 계약의 영업대표(사용 중지면 대신 맡는 영업 리더), 그 유닛의 영업 리더(리더 본인 계약은 영업 임원), 그 계약에 결재 차례가 있는 사람
    //   roles는 그 사람들이 가질 수 있는 역할(결재 차례 알림과 같음). 보류 사유는 이메일에 넣지 않고 시스템에서 봄(C-4 이메일에 넣지 않는 것)
    { code: 'HOLD_SET', name: '보류 걸림', when: '내가 맡은 계약이나 내 결재 차례인 계약의 거래처나 계약 묶음에 보류가 걸렸을 때', must: true, roles: ['SALES', 'SALES_ADMIN', 'HEAD', 'LEGAL', 'PRIVACY', 'GA', 'CEM', 'FINANCE', 'EXEC'] },
    { code: 'HOLD_RELEASE', name: '보류 풀림', when: '내가 맡은 계약이나 내 결재 차례인 계약에 걸렸던 보류가 풀렸을 때', must: true, roles: ['SALES', 'SALES_ADMIN', 'HEAD', 'LEGAL', 'PRIVACY', 'GA', 'CEM', 'FINANCE', 'EXEC'] },
    // 기획자 결정 2026-11-03(01 C-44): 영업 리더가 계약의 새 영업대표를 정하면 새 영업대표에게(꼭 받음). 영업 리더도 자기를 새 영업대표로 정할 수 있어 리더도 받음
    { code: 'OWNER_SET', name: '영업대표 지정', when: '영업 리더가 나를 계약의 새 영업대표로 정했을 때', must: true, roles: ['SALES', 'HEAD'] },
    { code: 'PROGRESS', name: '내 기안 진행 소식', when: '내가 기안한 계약이 다음 결재 단계로 넘어갈 때마다', must: false, on: false, roles: ['SALES'] },
    { code: 'NOTICE_ALL', name: '일반 공지와 릴리즈', when: '중요 공지가 아닌 공지와 릴리즈가 올라왔을 때', must: false, on: false },
  ];

  /* ---------- 이메일 미리 보기 예시 (v0.53 기획자 요청, 요구사항 정의서 REQ-ENV-14, 내 계정에서 알림마다 "미리 보기") ----------
   * 위 예시 계약으로 채운 메일 한 통씩. 실제 메일도 같은 틀: 제목 "[계약 관리 시스템] ...", 인사, 한두 문장, 사실 표, 버튼 하나, 바닥글
   * 이메일에 넣지 않는 것 [가정, 보안]: 계약 금액, 첨부 파일, 고객 담당자 개인정보. 열람 제한 계약은 고객사 대신 계약번호만
   * to: 받는 사람 id(또는 '전체 사용자' 같은 글) / at: 보낸 때 / facts: [항목, 값]. 값이 '@사람 id'면 "조직 이름"으로 바꿔 보여 줌
   * button: [글자, 연결 화면] — 메일 안의 버튼은 시스템 화면으로만 연결(로그인 필요) */
  const MAIL_SAMPLES = {
    TURN: { to: 'u_legal', at: '2026-10-16 10:30', subject: '결재 차례: 한빛대학교 계약 ④ 법무 검토',
      intro: '검토할 계약이 있습니다. 결재 문서에서 승인, 보완 요청, 반려 중 하나를 골라 주세요.',
      facts: [['계약번호', '2610CL005'], ['고객사', '한빛대학교(중앙도서관)'], ['서비스', 'CK'], ['계약종류', '신규'], ['기안', '@u_sales1'], ['차례가 된 때', '2026-10-16 10:30']],
      button: ['결재 문서 열기', 'review.html?id=2610CL005'] },
    REJECT: { to: 'u_sales1', at: '2026-10-10 15:30', subject: '반려: 소담에듀 계약 ④ 법무 검토',
      intro: '기안한 계약이 반려됐습니다. 사유를 확인하고 고쳐서 다시 기안해 주세요.',
      facts: [['계약번호', '2610CL001'], ['고객사', '소담에듀'], ['반려한 단계', '④ 법무 검토'], ['반려한 사람', '@u_legal'], ['사유', '손해배상 한도 조항이 표준계약서 기준을 벗어납니다. 수정 후 다시 요청해 주세요.']],
      button: ['결재 문서 열기', 'review.html?id=2610CL001'] },
    SIGN_READY: { to: 'u_sales1', at: '2026-10-16 11:00', subject: '계약 검토 끝: 다온컨설팅 계약을 체결해 주세요',
      intro: '계약 검토가 끝났습니다. 총무의 인장 날인(⑥) 뒤 상대방 서명을 받아 체결본을 올려 주세요.',
      facts: [['계약번호', '2610CL004'], ['고객사', '다온컨설팅'], ['서비스', 'HR'], ['승인일', '2026-10-16 11:00'], ['체결본 기한', '승인 뒤 14일(2026-10-30)까지 올리지 않으면 독촉 메일']],
      button: ['체결 대기 보기', 'signing.html'] },
    REMIND: { to: 'u_privacy', at: '2026-10-14 09:00', subject: '6일째 기다리는 결재: 미래로병원 계약 ⑤ 개인정보 검토',
      intro: '차례가 된 지 5일이 넘었습니다. 오늘 처리하기 어려우면 결재 문서에 보완 요청을 남겨 주세요.',
      facts: [['계약번호', '2610CL002'], ['고객사', '미래로병원'], ['단계', '⑤ 개인정보 검토'], ['차례가 된 때', '2026-10-08 16:20'], ['기안', '@u_sales2']],
      button: ['결재 문서 열기', 'review.html?id=2610CL002'] },
    EXPIRY: { to: 'u_sales1', at: '2026-10-15 09:00', subject: '만료 30일 전: 한결대학교 계약(2026-11-14 만료)',
      intro: '맡은 계약이 30일 뒤에 끝납니다. 이어 가려면 연장 검토나 연장 기안을, 끝내려면 해지 기안을 올려 주세요.',
      facts: [['계약번호', '2511CL001'], ['고객사', '한결대학교'], ['서비스', 'CK'], ['계약 기간', '2025-11-15~2026-11-14'], ['자동갱신', '있음(해지 통지 기한 2026-09-15 지남)']],
      button: ['만료 예정 계약 보기', 'expiring.html'] },
    NOTICE_DEADLINE: { to: 'u_sales2', at: '2026-10-02 09:00', subject: '해지 통지 기한 30일 전: 누리교육재단 계약(2026-11-01까지)',
      intro: '자동갱신 계약입니다. 연장하지 않으려면 2026-11-01까지 상대방에게 해지를 알려야 합니다. 이날이 지나면 같은 조건으로 연장됩니다.',
      facts: [['계약번호', '2601CL001'], ['고객사', '누리교육재단'], ['서비스', 'CK'], ['계약 기간', '2026-01-15~2026-12-31'], ['해지 통지 기한', '2026-11-01(만료 60일 전)']],
      button: ['연장 검토 열기', 'renewal.html?origin=2601CL001'] },
    // 기획자 결정 2026-11-02 E-12: 같은 계약의 7일 전 이메일을 기안자 유닛의 영업 리더도 받음. 영업대표 이름을 사실 표에 넣어 함께 챙기게 함
    //   리더는 연장 검토를 기안하지 않으므로 버튼은 계약 상세. 이름 끝 _LEAD는 이 알림의 리더용 예시(아래 leadSample)
    NOTICE_DEADLINE_LEAD: { to: 'u_eunseong_ko', at: '2026-10-25 09:00', subject: '해지 통지 기한 7일 전: 누리교육재단 계약(2026-11-01까지)',
      intro: '유닛 영업이 맡은 자동갱신 계약의 해지 통지 기한이 7일 남았습니다. 연장하지 않으려면 2026-11-01까지 상대방에게 해지를 알려야 합니다. 영업대표와 함께 확인해 주세요.',
      facts: [['계약번호', '2601CL001'], ['고객사', '누리교육재단'], ['영업대표', '@u_sales2'], ['계약 기간', '2026-01-15~2026-12-31'], ['해지 통지 기한', '2026-11-01(만료 60일 전)']],
      button: ['계약 상세 열기', 'contract.html?id=2601CL001'] },
    OBLIGATION: { to: 'u_finance', at: '2026-10-16 09:00', subject: '챙길 의무 14일 전: 온새미로대학교 계약 2차 분할 청구(2026-10-30까지)',
      intro: '맡은 분야의 체결 후 의무 기한이 다가옵니다. 하고 나면 의무 관리에서 이행 기록을 남겨 주세요.',
      facts: [['계약번호', '2512CL001'], ['고객사', '온새미로대학교'], ['의무', '2차 분할 청구(잔금 50%)'], ['종류', '청구 일정'], ['근거 조항', '이용계약 제5조'], ['기한', '2026-10-30']],
      button: ['의무 관리 열기', 'obligations.html'] },
    ACCOUNTING: { to: 'u_finance', at: '2026-09-08 10:00', subject: '회계 영향 조건이 있는 계약: 청람컨설팅',
      // 기획자 결정 2026-11-02 B-6(REQ-ENV-10): 결재선 밖 재무 의견은 결재 문서의 "재무 의견" 칸에 남김. 단추가 그 칸으로 바로 이어짐(#fin-opinion)
      //   4번 조건의 종류(acctKinds)도 사실 표에 함께
      intro: '체크리스트 4번(회계에 영향을 주는 특수 조건)이 "예"인 계약이 기안됐습니다. ⑥ 인장 날인 전까지 결재 문서의 재무 의견 칸에 의견을 남길 수 있고, ⑩ 재무 확인에서 다시 봅니다.',
      facts: [['계약번호', '2609CL001'], ['고객사', '청람컨설팅'], ['서비스', 'HR'], ['조건의 종류', '무상 기간'], ['특수 조건', '첫해 2개월 무상 사용 후 과금 시작'], ['기안', '@u_sales2']],
      button: ['재무 의견 칸 열기', 'review.html?id=2609CL001#fin-opinion'] },
    SECURITY: { to: 'u_privacy', at: '2026-10-15 09:20', subject: '이상 행위 감지: 짧은 시간에 많은 열람',
      intro: '접속 기록에서 이상 행위가 감지됐습니다. 접속 기록 점검에서 확인하고 결과를 남겨 주세요.',
      facts: [['감지한 때', '2026-10-15 09:20'], ['종류', '짧은 시간에 많은 열람'], ['누가', '@u_jiho_yoo'], ['내용', '10분 동안 계약 18건 열람, 첨부 PDF 6건 내려받기']],
      button: ['접속 기록 점검 열기', 'admin-logs.html'] },
    NOTICE_IMPORTANT: { to: '전체 사용자', at: '2026-10-21 15:10', subject: '중요 공지: 계약번호 규칙 변경',
      intro: '관리자가 중요 공지를 올렸습니다. 업무 방식이 바뀌는 내용이니 꼭 읽어 주세요.',
      facts: [['제목', '계약번호 규칙 변경'], ['올린 사람', '@u_super'], ['올린 때', '2026-10-21 15:10']],
      button: ['공지 읽기', 'notice.html?id=N-0005'] },
    VIEWER: { to: 'u_cem', at: '2026-10-08 09:30', subject: '열람자로 지정됐습니다: 열람 제한 계약 2511CL002',
      intro: 'CEM유닛이 열람 제한 계약의 열람자로 지정됐습니다. 조직으로 지정돼 CEM유닛에 있는 동안 볼 수 있습니다.',
      facts: [['계약번호', '2511CL002(열람 제한이라 고객사는 적지 않음)'], ['지정 범위', 'CEM유닛(조직)'], ['지정한 사람', '@u_admin'], ['이유', '연장 검토 전에 고객지원이 사용 현황을 미리 확인']],
      button: ['계약 상세 열기', 'contract.html?id=2511CL002'] },
    VIEWER_RELEASED: { to: 'u_admin', at: '2026-10-12 11:00', subject: '열람자 지정이 풀렸습니다: 열람 제한 계약 2511CL002',
      intro: '사람으로 지정한 열람자가 다른 조직으로 옮겨 지정이 저절로 풀렸습니다. 계속 봐야 하면 열람 제한 관리에서 다시 지정해 주세요.',
      facts: [['계약번호', '2511CL002'], ['풀린 사람', '@u_dain_seok'], ['옮긴 조직', '비즈니스2유닛에서 세일즈어드민유닛으로'], ['풀린 때', '2026-10-12 11:00']],
      button: ['열람 제한 관리 열기', 'admin-restrict.html'] },
    // 기획자 결정 2026-11-03(06 CTL-79): 보류 걸림(HD-0001 가람전자)과 보류 풀림(HD-0002 이음병원 묶음). 열람 제한 계약은 고객사 대신 계약번호만
    //   보류 사유는 이메일에 넣지 않고 시스템에서 보게 함. 이 영업대표가 받는 것과 같은 메일이 영업 리더와 결재 차례인 사람에게도 감(common.js holdMailList)
    //   거래처 보류라도 받는 사람의 걸린 계약이 열람 제한이면 계약번호만 적고 상호와 사업자등록번호는 적지 않음(REQ-ENV-14. 거래처 이름으로 그 계약의 고객사가 드러나지 않게)
    HOLD_SET: { to: 'u_sales1', at: '2026-10-18 16:30', subject: '보류 걸림: 계약 2610CL007의 새 기안과 남은 결재가 멈춥니다',
      intro: '컴플라이언스 담당자가 거래처에 보류를 걸었습니다. 풀릴 때까지 새 기안, 남은 결재의 승인, 체결본 등록, 유예 요청과 확인을 할 수 없습니다. 반려와 보완 요청은 할 수 있습니다. 사유는 시스템에서 확인해 주세요.',
      facts: [['보류 대상', '거래처 보류(열람 제한 계약이라 상호와 사업자등록번호는 적지 않음)'], ['걸린 계약', '2610CL007(열람 제한이라 고객사는 적지 않음)'], ['받는 까닭', '영업대표'], ['건 사람', '@u_seoyul_ban'], ['건 때', '2026-10-18 16:30']],
      button: ['계약 상세 열기', 'contract.html?id=2610CL007'] },
    HOLD_RELEASE: { to: 'u_sales1', at: '2026-10-19 09:40', subject: '보류 풀림: 이음병원 계약 묶음 2604CL001',
      intro: '컴플라이언스 담당자가 보류를 풀었습니다. 멈췄던 기안과 결재를 다시 할 수 있습니다. 푼 사유는 시스템에서 확인해 주세요.',
      facts: [['보류 대상', '계약 묶음 2604CL001 이음병원'], ['걸린 계약', '2604CL001, 2604CL001-C01(③ 영업 검토 차례)'], ['받는 까닭', '영업대표'], ['푼 사람', '@u_seoyul_ban'], ['걸린 동안', '2026-10-18 17:30~2026-10-19 09:40']],
      button: ['계약 상세 열기', 'contract.html?id=2604CL001'] },
    // 기획자 결정 2026-11-03(01 C-44): 사용 중지된 영업대표(기태민)의 계약을 영업 리더가 이도윤에게 넘긴 예(OWNER_CHANGES OC-0001)
    OWNER_SET: { to: 'u_sales1', at: '2026-10-06 14:00', subject: '영업대표 지정: 새빛정보통신 계약을 이어 맡습니다',
      intro: '영업 리더가 이 계약의 새 영업대표로 정했습니다. 이제부터 체결본 등록, 보완 후 재기안, 변경, 연장, 해지 기안과 만료 알림을 맡습니다. 처음 기안 기록은 그대로 남습니다.',
      facts: [['계약번호', '2609CL011'], ['고객사', '새빛정보통신'], ['서비스', 'HR'], ['이전 영업대표', '@u_taemin_ki'], ['정한 사람', '@u_head'], ['지금 할 일', '⑦ 체결본 등록']],
      button: ['계약 상세 열기', 'contract.html?id=2609CL011'] },
    PROGRESS: { to: 'u_sales1', at: '2026-10-15 09:40', subject: '진행 소식: 한빛대학교 계약이 ④ 법무 검토와 ⑤ 개인정보 검토로 넘어갔습니다',
      intro: '기안한 계약이 다음 단계로 넘어갔습니다. 이 메일은 내 계정에서 끌 수 있습니다.',
      facts: [['계약번호', '2610CL005'], ['고객사', '한빛대학교(중앙도서관)'], ['끝난 단계', '② 체크리스트 검토(@u_sadmin)'], ['지금 단계', '④ 법무 검토, ⑤ 개인정보 검토(동시)']],
      button: ['결재 문서 열기', 'review.html?id=2610CL005'] },
    NOTICE_ALL: { to: '전체 사용자', at: '2026-10-22 23:30', subject: '릴리즈 v0.9.6: 열람자 지정',
      intro: '새 릴리즈가 올라왔습니다. 이 메일은 내 계정에서 끌 수 있습니다.',
      facts: [['제목', '열람자 지정'], ['구분', '릴리즈 v0.9.6'], ['올린 때', '2026-10-22 23:30']],
      button: ['공지사항에서 보기', 'notice.html?id=N-0013'] },
  };
  // leadSample: 같은 알림을 리더가 받을 때의 예시(있으면 미리 보기에 두 통을 함께 보임, E-12)
  EMAIL_TYPES.forEach(function (t) { t.sample = MAIL_SAMPLES[t.code] || null; t.leadSample = MAIL_SAMPLES[t.code + '_LEAD'] || null; });

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
    ['jian.won@muhayu.com', '원지안', '경영지원유닛', ['SUPER'], 'ACTIVE', '2026-09-01', '2026-09-03 10:12', '2026-10-15 12:17', '2026-10-15 19:18', '2026-09-01'],
    ['jaemin.yoon@muhayu.com', '윤재민', '경영지원유닛', ['ADMIN'], 'ACTIVE', '2026-09-01', '2026-09-03 11:03', '2026-10-13 12:28', '2026-10-13 19:45', '2026-09-01'],
    ['eunchae.noh@muhayu.com', '노은채', '경영지원유닛', ['GA'], 'ACTIVE', '2026-09-18', '2026-09-20 10:03', '2026-10-16 12:14', '2026-10-16 17:19', '2026-09-18'],
    ['seoyun.tak@muhayu.com', '탁서윤', '경영지원유닛', ['GA'], 'ACTIVE', '2026-09-06', '2026-09-09 14:03', '2026-10-13 13:17', '2026-10-13 21:28', '2026-09-06'],
    ['taeho.moon@muhayu.com', '문태호', '비즈니스유닛', ['EXEC'], 'ACTIVE', '2026-09-19', '2026-09-19 14:47', '2026-10-19 11:00', '2026-10-19 14:22', '2026-09-19'],
    ['minjun.choi@muhayu.com', '최민준', '비즈니스1유닛', ['HEAD'], 'ACTIVE', '2026-09-11', '2026-09-14 13:47', '2026-10-18 13:16', '2026-10-18 19:22', '2026-09-11'],
    ['doyun.lee@muhayu.com', '이도윤', '비즈니스1유닛', ['SALES'], 'ACTIVE', '2026-09-22', '2026-09-23 16:34', '2026-10-19 09:47', '2026-10-19 11:11', '2026-09-22'],
    ['seohyun.park@muhayu.com', '박서현', '비즈니스1유닛', ['SALES'], 'ACTIVE', '2026-09-02', '2026-09-04 13:47', '2026-10-18 08:37', '2026-10-18 17:22', '2026-09-02'],
    ['taeyun.kim@muhayu.com', '김태윤', '비즈니스1유닛', ['SALES'], 'ACTIVE', '2026-09-08', '2026-09-11 13:03', '2026-10-17 08:33', '2026-10-17 14:15', '2026-09-08'],
    ['yerin.jang@muhayu.com', '장예린', '비즈니스1유닛', ['SALES'], 'ACTIVE', '2026-09-06', '2026-09-08 17:03', '2026-10-13 12:12', '2026-10-13 16:43', '2026-09-06'],
    ['junseo.hong@muhayu.com', '홍준서', '비즈니스1유닛', ['SALES'], 'ACTIVE', '2026-09-04', '2026-09-06 11:21', '2026-10-17 11:16', '2026-10-17 18:55', '2026-09-04'],
    ['gaeun.shin@muhayu.com', '신가은', '비즈니스1유닛', ['SALES'], 'ACTIVE', '2026-09-13', '2026-09-15 09:21', '2026-10-19 10:35', '2026-10-19 14:03', '2026-09-13'],
    ['taemin.ki@muhayu.com', '기태민', '비즈니스1유닛', ['SALES'], 'SUSPENDED', '2026-09-05', '2026-09-05 15:34', '2026-09-30 12:29', '2026-09-30 16:05', '2026-10-02'],
    ['eunseong.ko@muhayu.com', '고은성', '비즈니스2유닛', ['HEAD'], 'ACTIVE', '2026-09-09', '2026-09-10 14:12', '2026-10-19 08:22', '2026-10-19 09:29', '2026-09-09'],
    ['haeun.jung@muhayu.com', '정하은', '비즈니스2유닛', ['SALES'], 'ACTIVE', '2026-09-09', '2026-09-11 13:12', '2026-10-19 09:52', '2026-10-19 13:46', '2026-09-09'],
    ['jiho.yoo@muhayu.com', '유지호', '비즈니스2유닛', ['SALES'], 'ACTIVE', '2026-09-11', '2026-09-12 12:12', '2026-10-15 08:52', '2026-10-15 13:58', '2026-09-11'],
    ['nayeon.kwon@muhayu.com', '권나연', '비즈니스2유닛', ['SALES'], 'ACTIVE', '2026-09-21', '2026-09-22 14:21', '2026-10-19 08:22', '2026-10-19 10:01', '2026-09-21'],
    ['siwoo.hwang@muhayu.com', '황시우', '비즈니스2유닛', ['SALES'], 'ACTIVE', '2026-09-04', '2026-09-04 09:03', '2026-10-16 15:42', '2026-10-16 23:31', '2026-09-04'],
    ['chaewon.ahn@muhayu.com', '안채원', '비즈니스2유닛', ['SALES'], 'ACTIVE', '2026-09-22', '2026-09-23 09:47', '2026-10-15 14:38', '2026-10-15 22:59', '2026-09-22'],
    ['hyunseo.cho@muhayu.com', '조현서', '비즈니스2유닛', ['SALES'], 'ACTIVE', '2026-09-17', '2026-09-20 13:12', '2026-10-15 11:23', '2026-10-15 14:52', '2026-09-17'],
    ['yuna.cha@muhayu.com', '차유나', '비즈니스3유닛', ['HEAD'], 'ACTIVE', '2026-09-06', '2026-09-08 17:55', '2026-10-17 09:06', '2026-10-17 12:07', '2026-10-12'],
    ['geonwoo.yoon@muhayu.com', '윤건우', '비즈니스3유닛', ['SALES'], 'ACTIVE', '2026-09-20', '2026-09-21 12:21', '2026-10-17 11:08', '2026-10-17 14:41', '2026-09-20'],
    ['soyul.nam@muhayu.com', '남소율', '비즈니스3유닛', ['SALES'], 'ACTIVE', '2026-09-26', '2026-09-27 09:34', '2026-10-15 09:42', '2026-10-15 16:46', '2026-09-26'],
    ['dohyun.baek@muhayu.com', '백도현', '비즈니스3유닛', ['SALES'], 'ACTIVE', '2026-09-10', '2026-09-10 09:55', '2026-10-19 11:33', '2026-10-19 13:02', '2026-09-10'],
    ['jia.ryu@muhayu.com', '류지아', '비즈니스3유닛', ['SALES'], 'ACTIVE', '2026-09-10', '2026-09-13 16:55', '2026-10-19 10:42', '2026-10-19 13:20', '2026-09-10'],
    ['woojin.shim@muhayu.com', '심우진', '비즈니스3유닛', ['SALES'], 'ACTIVE', '2026-09-23', '2026-09-24 13:47', '2026-10-18 10:17', '2026-10-18 14:47', '2026-09-23'],
    ['haram.do@muhayu.com', '도하람', '비즈니스3유닛', ['SALES'], 'ACTIVE', '2026-09-17', '2026-09-19 14:55', '2026-10-18 15:50', '2026-10-18 22:38', '2026-09-17'],
    ['eunwoo.seol@muhayu.com', '설은우', '비즈니스3유닛', ['SALES'], 'INVITED', '2026-10-15', null, null, null, '2026-10-15'],
    ['sua.bae@muhayu.com', '배수아', '세일즈어드민유닛', ['SALES_ADMIN'], 'ACTIVE', '2026-09-07', '2026-09-07 14:12', '2026-10-19 10:57', '2026-10-19 12:48', '2026-09-07'],
    ['jihoon.eom@muhayu.com', '엄지훈', '세일즈어드민유닛', ['SA_LEAD'], 'ACTIVE', '2026-09-24', '2026-09-26 16:21', '2026-10-13 14:35', '2026-10-13 17:47', '2026-09-24'],
    ['dain.seok@muhayu.com', '석다인', '세일즈어드민유닛', ['SALES_ADMIN'], 'ACTIVE', '2026-09-22', '2026-09-25 14:21', '2026-10-19 09:45', '2026-10-19 10:50', '2026-10-12'],
    ['jiwoo.kim@muhayu.com', '김지우', '경영지원유닛', ['LEGAL'], 'ACTIVE', '2026-09-12', '2026-09-14 16:21', '2026-10-18 09:15', '2026-10-18 17:13', '2026-09-12'],
    ['minjae.song@muhayu.com', '송민재', '경영지원유닛', ['LEGAL', 'ADMIN'], 'ACTIVE', '2026-09-24', '2026-09-26 17:47', '2026-10-16 09:13', '2026-10-16 16:45', '2026-10-06'],
    ['seoyeon.han@muhayu.com', '한서연', '정보보호유닛', ['PRIVACY'], 'ACTIVE', '2026-09-07', '2026-09-10 09:55', '2026-10-16 12:02', '2026-10-16 18:39', '2026-09-07'],
    ['seungho.yeo@muhayu.com', '여승호', '정보보호유닛', ['SEC_LEAD'], 'ACTIVE', '2026-09-01', '2026-09-02 09:30', '2026-10-19 09:10', '2026-10-19 18:05', '2026-09-01'],
    ['hajun.lim@muhayu.com', '임하준', 'CEM유닛', ['CEM'], 'ACTIVE', '2026-09-26', '2026-09-28 11:47', '2026-10-19 10:44', '2026-10-19 14:14', '2026-09-26'],
    ['yeonwoo.joo@muhayu.com', '주연우', 'CEM유닛', ['CEM_LEAD'], 'ACTIVE', '2026-09-17', '2026-09-20 09:03', '2026-10-17 12:47', '2026-10-17 17:13', '2026-09-17'],
    ['harin.pyeon@muhayu.com', '편하린', 'CEM유닛', ['CEM'], 'ACTIVE', '2026-09-04', '2026-09-04 12:34', '2026-10-18 13:42', '2026-10-18 20:50', '2026-09-04'],
    // 2026-11-02 C-5 시연: 결산 동안 재무 담당자 역할도 받아 ⑨와 ⑩이 겹침(역할 충돌 계정). 까닭을 받고 저장한 기록은 ADMIN_LOG 2026-10-14
    ['sihyun.bang@muhayu.com', '방시현', 'CEM유닛', ['CEM', 'FINANCE'], 'ACTIVE', '2026-09-13', '2026-09-13 09:55', '2026-10-18 08:55', '2026-10-18 16:05', '2026-10-14'],
    ['sihwan.jin@muhayu.com', '진시환', 'CEM유닛', ['CEM'], 'ACTIVE', '2026-09-08', '2026-09-11 15:34', '2026-10-13 09:53', '2026-10-13 13:21', '2026-09-08'],
    ['jua.yeon@muhayu.com', '연주아', 'CEM유닛', ['CEM'], 'INVITED', '2026-10-16', null, null, null, '2026-10-16'],
    ['hyunwoo.oh@muhayu.com', '오현우', '재무기획유닛', ['FINANCE'], 'ACTIVE', '2026-09-22', '2026-09-25 11:47', '2026-10-18 14:20', '2026-10-18 23:08', '2026-09-22'],
    ['seojin.ma@muhayu.com', '마서진', '재무기획유닛', ['FIN_LEAD'], 'ACTIVE', '2026-09-17', '2026-09-18 17:47', '2026-10-15 12:48', '2026-10-15 17:34', '2026-09-17'],
    ['yejun.pyo@muhayu.com', '표예준', '재무기획유닛', ['FINANCE'], 'ACTIVE', '2026-09-04', '2026-09-05 10:03', '2026-10-19 08:35', '2026-10-19 10:27', '2026-09-04'],
    ['jaewon.kook@muhayu.com', '국재원', '경영지원실', ['FIN_EXEC'], 'ACTIVE', '2026-09-15', '2026-09-16 10:20', '2026-10-17 16:40', '2026-10-17 18:12', '2026-09-15'],
    ['daon.yong@muhayu.com', '용다온', '경영지원유닛', ['OBSERVER'], 'ACTIVE', '2026-10-05', '2026-10-06 09:40', '2026-10-16 15:02', '2026-10-16 15:30', '2026-10-05'],
    // 2026-11-02 덧붙임과 C-2 시연(가상 인물): 컴플라이언스 담당자(지난 감사 열람은 2026-10-15에 끝남), 감사 열람(내부감사, 2027-01-11까지)
    //   끝난 감사 열람은 역할 목록에 남아 있어도 없는 것으로 봄(common.js roleEnded). 실제 시스템은 끝나는 날 다음 날 서버가 뺌
    ['seoyul.ban@muhayu.com', '반서율', '경영지원유닛', ['COMPLIANCE', 'AUDIT'], 'ACTIVE', '2026-09-14', '2026-09-15 09:10', '2026-10-19 09:20', '2026-10-19 12:05', '2026-09-15'],
    ['chaeyul.in@muhayu.com', '인채율', '경영지원실', ['AUDIT'], 'ACTIVE', '2026-10-12', '2026-10-13 09:05', '2026-10-19 10:15', '2026-10-19 11:40', '2026-10-12'],
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

  /* ---------- 끝나는 날이 있는 역할을 준 기록 (기획자 결정 2026-11-02 C-2, C-7) ----------
   * 감사 열람을 줄 때마다 한 줄. 쌓기만 하고 고치거나 지우지 않음. 끝나는 날을 바꾸면 새 줄, 끝나기 전에 빼면 그 줄에 뺀 때와 사람(endedAt, endedBy, endReason)
   * userId, role / from, until: 주는 날과 끝나는 날(이틀 다 포함) / by, at: 준 최고관리자와 일시 / reason: 주는 사유 / requestedBy: 요청한 사람(선택, C-7)
   * 분기 권한 검토(SCR-57)는 common.js auditGrants로 누가, 왜, 언제까지를 봄. 바꾼 기록은 ADMIN_LOG의 USER에도 같은 줄 */
  const ROLE_GRANTS = [
    { id: 'RG-0001', userId: 'u_seoyul_ban', role: 'AUDIT', from: '2026-09-15', until: '2026-10-15', by: 'u_super', at: '2026-09-15 09:30',
      reason: '3분기 내부회계 운영평가 준비: 열람 제한 계약을 포함해 7~9월 체결 계약 표본을 확인', requestedBy: 'u_jaewon_kook' },
    { id: 'RG-0002', userId: 'u_chaeyul_in', role: 'AUDIT', from: '2026-10-12', until: '2027-01-11', by: 'u_super', at: '2026-10-12 10:00',
      reason: '하반기 내부감사: 열람 제한 계약을 포함한 전체 계약과 관리자 변경 이력, 접속 기록 점검 결과를 확인', requestedBy: 'u_jaewon_kook' },
  ];

  /* ---------- 영업 팀 리더: ③ 영업 검토 담당 (재무 문서 반영 v0.26) ----------
   * 유닛 담당자가 기안한 계약은 그 유닛의 리더가, 리더 본인이 기안한 계약은 영업 임원(COO, STEP_ASSIGNEE.S03)이 검토합니다.
   * 키는 비즈니스 유닛 이름(조직). 관리자가 결재선 규칙(SCR-52)에서 바꿉니다. (v0.29 조직 개편: 영업1~3팀 → 비즈니스1~3유닛) */
  const TEAM_LEADERS = { '비즈니스1유닛': 'u_head', '비즈니스2유닛': 'u_eunseong_ko', '비즈니스3유닛': 'u_yuna_cha' };

  /* ---------- 영업대표 바꾼 기록 (기획자 결정 2026-11-03, 01 C-44) ----------
   * 영업대표가 바뀌거나 퇴사하면 그 유닛의 영업 리더(리더 본인 계약은 영업 임원)가 계약 묶음마다 새 영업대표를 정함. 쌓기만 하고 고치거나 지우지 않음
   * bundleId: 계약 묶음(원계약 번호) / from, to: 바꾸기 전과 뒤의 영업대표 / by, byDept: 정한 사람과 그때 조직 / at / reason: 바꾸는 사유(필수)
   * 마지막 줄의 to가 지금 영업대표(common.js salesRepOf). 계약의 requesterId(처음 기안한 사람)는 그대로 둠. 시연으로 남긴 것은 common.js가 더함
   * 시연: 기태민(2026-09-30 퇴사, 10-02 사용 중지)의 계약 둘 중 2609CL011은 최민준이 이도윤에게 넘겼고, 2609CL010은 아직 정하지 않음(담당 지정 필요) */
  const OWNER_CHANGES = [
    // salesTeam: 바꾼 뒤 계약의 유닛(새 영업대표의 그때 조직). 영업대표가 뒤에 옮겨도 이 유닛의 리더가 정함(2026-11-03 C-44, common.js salesTeamOf)
    { id: 'OC-0001', bundleId: '2609CL011', from: 'u_taemin_ki', to: 'u_sales1', by: 'u_head', byDept: '비즈니스1유닛', at: '2026-10-06 14:00',
      reason: '9월 30일 퇴사로 같은 유닛 이도윤이 이어 맡음. 고객 서명을 받아 체결본을 올릴 차례라 먼저 넘김', salesTeam: '비즈니스1유닛' },
  ];

  /* ---------- 거래처 목록: 거래처 관리(SCR-55), 계약 등록의 고객사 고르기 (REQ-REG-18, 데이터 정의서 6장, D-01) ----------
   * 가상의 거래처와 가상의 사업자등록번호입니다.
   * 프로토타입은 계약의 상호(counterparty)로 거래처를 연결합니다. 실제 시스템은 거래처 번호(customer_id)로 연결합니다.
   * use: 사용 여부 / mergedInto: 다른 거래처로 합쳐졌으면 남긴 거래처 번호
   * C-0001~0013: 시스템 도입 때 기존 계약관리대장에서 옮긴 거래처 / 그 뒤: 영업이 계약을 등록하며 새로 등록 */
  // 기관 또는 부서명 (C-24 v0.39, v0.46 기획자 결정): 사업자등록번호 하나에 거래처 하나. 그 안에서 따로 계약하는 기관이나 부서는
  //   계약마다 이름을 직접 적어 계약에만 남김(contract.unit). 기관 이름은 고유 번호가 없어 확인할 수 없으므로 거래처에 목록으로 두지 않음
  //   (v0.39의 거래처별 기관 목록 CUSTOMER_UNITS는 v0.46에서 없앰)
  /* ---------- 견적서 (v0.61 기획자 결정, 요구사항 정의서 3.9 REQ-QUO) ----------
   * 영업이 고객에게 내는 견적서를 시스템의 제품과 가격 기준 그대로 만들고 출력합니다. 그동안 각자 엑셀로 만들던 것을 바꾸고,
   *   출력할 때마다 누가 언제 어떤 판을 냈는지 기록을 남기는 것이 목적입니다. 견적은 계약과 이어지지 않습니다(계약 등록과 따로).
   *   견적 단계 할인 승인은 하지 않습니다(v0.21 결정 그대로). 할인율 한도를 넘는 줄은 화면에서만 알려 줌(계약할 때 ③ 영업 검토)
   * QUOTE_RULES: 유효기간 기본 일수, 부가세율. 실제 시스템에서는 관리자 설정 [가정]
   * QUOTES: 견적 한 판이 한 줄. no(견적번호 QT + 연월 + 일련번호), ver(판), 고객사(거래처 번호, 상호, 사업자등록번호), unit(기관 또는 부서명),
   *   opp(판다 영업기회번호, 선택), date(견적일), validUntil(유효기간), lines(기능, 수량, 단가: 표준 단가와 할인율 한도는 그때의 가격 기준),
   *   note(조건과 비고), owner(작성한 영업), savedAt, issues(출력 기록: 일시, 출력한 사람, 합계). 출력한 판은 고칠 수 없고 고치려면 새 판
   *   기획자 결정 2026-11-02 E-7(추천과 다름): "견적서 출력"에는 회사 인장 그림을 늘 찍고, 출력 기록에 sealed(인장 찍음), sealVer(찍은 인장 그림의 판)를 남김
   *     인장 그림이 없으면 인장 없이 출력하고(sealed: false) 출력한 사람에게 알림. 총무가 매월 인장 대장과 맞춰 봄(SEAL_RECON). 예시 기록도 같은 모양
   *   고객 담당자 이름과 연락처는 적지 않음(REQ-SEC: 개인정보는 CRM에) */
  const QUOTE_RULES = { validDays: 30, vat: 0.1 };
  /* ---------- 회사 설정: SCR-59 (기획자 결정 2026-11-02 E-9, E-7 덧붙임 ②, 03 8-9 company_setting) ----------
   * 견적서 공급자 칸의 회사 정보와 "견적서 출력"에 찍는 회사 인장 그림. 회사 정보는 최고관리자가, 인장 그림은 총무가 사유와 함께 바꾸고
   *   관리자 변경 이력(영역 COMPANY)에 남김(common.js applyAdmin COMPANY, SEAL). 값은 운영 시작 전에 경영지원에서 받아 넣음
   * 아래 값은 시연용 가상 값입니다(사업자등록번호, 대표자, 주소, 연락처 모두 실제가 아님)
   * ethicsUrl, reportUrl: 이용 안내 "거래 윤리와 신고"에서 여는 회사 윤리 규정과 신고 창구 링크(선택, 03 8-9). 아직 받지 않아 비어 있음
   * seal: 지금 인장 그림 { ver: 판, name: 파일 이름, type, size, src: 그림 주소, by, at }. 시연 그림은 "견본" 글자가 든 가상 인장(assets/img/seal-sample.svg)
   *   9월 15일 총무 탁서윤이 올림(그 앞 9월 14일 출력은 인장 없이 나감, QT2609-001 1판의 첫 출력) */
  const COMPANY = {
    name: '주식회사 무하유', bizNo: '000-86-00004', ceo: '한도겸', address: '서울특별시 중구 예시로 100, 7층', phone: '02-0000-0000', ethicsUrl: '', reportUrl: '',
    seal: { ver: 1, name: '회사인장_견본.svg', type: 'image/svg+xml', size: 1900, src: 'assets/img/seal-sample.svg', by: 'u_seoyun_tak', at: '2026-09-15 10:00' },
  };
  const QUOTES = [
    // 기획자 결정 2026-11-02 E-7 시연: 9월 견적. 첫 출력(09-14)은 인장 그림을 올리기 전이라 인장 없이, 다시 낸 출력(09-16)은 인장 찍음
    //   인장 기록 대사(SCR-63)의 9월 대조 기록(SEAL_RECON)과 이어짐. 바른출판의 9월 계약(2609CL002)과 같은 영업기회번호
    { no: 'QT2609-001', ver: 1, customer: 'C-0011', name: '바른출판', bizNo: '105-87-44129', unit: '', opp: '2609CK005',
      date: '2026-09-14', validUntil: '2026-10-14', owner: 'u_sales2', savedAt: '2026-09-14 15:50',
      lines: [{ feature: 'CK_CAMPUS_PLAG', qty: 2, unitPrice: 12000000, listPrice: 12000000, cap: 0.20, unit: '기관, 1년' }],
      note: '이용 기간: 계약일부터 1년\n결제: 세금계산서 발행 후 30일 이내',
      issues: [{ at: '2026-09-14 16:10', by: 'u_sales2', total: 26400000, sealed: false }, { at: '2026-09-16 11:20', by: 'u_sales2', total: 26400000, sealed: true, sealVer: 1 }] },
    { no: 'QT2610-001', ver: 1, customer: 'C-0001', name: '한결대학교', bizNo: '119-82-04515', unit: '교무처', opp: '2610CK012',
      date: '2026-10-05', validUntil: '2026-11-04', owner: 'u_sales1', savedAt: '2026-10-05 14:02',
      lines: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, unitPrice: 12000000, listPrice: 12000000, cap: 0.20, unit: '기관, 1년' },
        { feature: 'CK_CAMPUS_GPTK', qty: 1, unitPrice: 2160000, listPrice: 2400000, cap: 0.15, unit: '기관, 1년' }],
      note: '이용 기간: 계약일부터 1년\n결제: 세금계산서 발행 후 30일 이내',
      issues: [{ at: '2026-10-05 14:20', by: 'u_sales1', total: 15576000, sealed: true, sealVer: 1 }] },
    { no: 'QT2610-001', ver: 2, customer: 'C-0001', name: '한결대학교', bizNo: '119-82-04515', unit: '교무처', opp: '2610CK012',
      date: '2026-10-12', validUntil: '2026-11-11', owner: 'u_sales1', savedAt: '2026-10-12 10:31',
      lines: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, unitPrice: 12000000, listPrice: 12000000, cap: 0.20, unit: '기관, 1년' },
        { feature: 'CK_CAMPUS_GPTK', qty: 1, unitPrice: 2160000, listPrice: 2400000, cap: 0.15, unit: '기관, 1년' },
        { feature: 'CK_CAMPUS_CITE', qty: 1, unitPrice: 1200000, listPrice: 1200000, cap: 0, unit: '기관, 1년' }],
      note: '이용 기간: 계약일부터 1년\n결제: 세금계산서 발행 후 30일 이내\n1판에서 출처 표기법 검사를 더함',
      issues: [{ at: '2026-10-12 10:40', by: 'u_sales1', total: 16896000, sealed: true, sealVer: 1 }, { at: '2026-10-15 16:05', by: 'u_sales1', total: 16896000, sealed: true, sealVer: 1 }] },
    { no: 'QT2610-002', ver: 1, customer: 'C-0002', name: '푸른솔아카데미', bizNo: '220-87-31409', unit: '', opp: '',
      date: '2026-10-08', validUntil: '2026-10-18', owner: 'u_sales2', savedAt: '2026-10-08 09:12',
      lines: [{ feature: 'HR_PRISM_DEFECT', qty: 1, unitPrice: 7200000, listPrice: 9600000, cap: 0.20, unit: '기관, 1년' }],
      note: '연간 이용권. 유효기간 10일(행사 가격)',
      issues: [{ at: '2026-10-08 09:20', by: 'u_sales2', total: 7920000, sealed: true, sealVer: 1 }] },
    { no: 'QT2610-003', ver: 1, customer: 'C-0003', name: '별빛어학원', bizNo: '305-91-18271', unit: '', opp: '2610HR004',
      date: '2026-10-19', validUntil: '2026-11-18', owner: 'u_sales2', savedAt: '2026-10-19 08:55',
      lines: [{ feature: 'HR_PRISM_PLAG', qty: 1, unitPrice: 3600000, listPrice: 3600000, cap: 0.15, unit: '기관, 1년' }],
      note: '', issues: [] },
  ];

  const CUSTOMERS = [
    // [번호, 상호, 사업자등록번호, 등록한 사람, 등록일]
    ['C-0001', '한결대학교', '119-82-04515', 'u_super', '2026-09-01'],
    ['C-0002', '푸른솔아카데미', '220-87-31409', 'u_super', '2026-09-01'],
    ['C-0003', '별빛어학원', '305-91-18271', 'u_super', '2026-09-01'],
    ['C-0004', '누리교육재단', '104-82-55123', 'u_super', '2026-09-01'],
    ['C-0005', '온새미로대학교', '312-82-07431', 'u_super', '2026-09-01'],
    ['C-0006', '가온테크', '129-86-40914', 'u_super', '2026-09-01'],
    ['C-0007', '이음병원', '410-82-61122', 'u_super', '2026-09-01'],
    ['C-0008', '해랑출판', '211-88-29361', 'u_super', '2026-09-01'],
    ['C-0009', '청람컨설팅', '220-88-71543', 'u_super', '2026-09-01'],
    ['C-0010', '마루중학교', '403-83-10281', 'u_super', '2026-09-01'],
    ['C-0011', '바른출판', '105-87-44129', 'u_super', '2026-09-01'],
    ['C-0012', '새솔고등학교', '314-83-20951', 'u_super', '2026-09-01'],
    ['C-0013', '다온컨설팅', '120-88-63011', 'u_super', '2026-09-01'],
    ['C-0014', '소담에듀', '107-86-33922', 'u_sales1', '2026-10-06'],
    ['C-0015', '미래로병원', '506-82-17344', 'u_sales2', '2026-10-08'],
    ['C-0016', '하늘연구원', '314-82-90218', 'u_sales2', '2026-10-10'],
    ['C-0017', '한빛대학교', '134-82-00411', 'u_sales1', '2026-10-14'],
    // 같은 거래처를 두 번 등록한 예: 상호를 줄여 쓰고 사업자등록번호 끝자리를 잘못 넣어 중복 검사를 지나침 → 거래처 관리에서 합침
    ['C-0018', '한빛대', '134-82-00478', 'u_sales2', '2026-10-15'],
    ['C-0019', '가람전자', '124-81-56736', 'u_sales1', '2026-10-17'],
    ['C-0020', '단비소프트', '215-87-80169', 'u_sales1', '2026-10-18'],
    ['C-0021', '바름고등학교', '214-82-10457', 'u_sales1', '2026-10-18'],
    ['C-0022', '새봄평생교육원', '211-91-40314', 'u_sales1', '2026-10-16'],
    // 기획자 결정 2026-11-02 시연 계약의 거래처: 만료 처리와 유예(A-10, A-11)의 두 곳은 시스템 도입 때 옮긴 거래처,
    //   영업 임원 승인(E-3)의 별가람대학교는 사업자 정보 DB에서 골라 등록(새 거래처 표시 없음)
    ['C-0023', '도담고등학교', '312-83-55107', 'u_super', '2026-09-01'],
    ['C-0024', '모아물류', '220-81-47103', 'u_super', '2026-09-01'],
    ['C-0025', '별가람대학교', '312-82-44080', 'u_sales1', '2026-10-18'],
    // 기간 마감 점검(B-9) 시연 계약(2609CL006)의 거래처: 사업자 정보 DB에서 골라 기안할 때 등록(새 거래처 표시 없음)
    ['C-0026', '새길교육연구소', '214-82-77313', 'u_sales2', '2026-09-14'],
    // 기획자 결정 2026-11-02 A-10, A-11 시연 계약(2509CL003 유예가 끝남, 2510CL001 연장 진행 중)의 거래처: 시스템 도입 때 옮긴 거래처
    ['C-0027', '늘봄어학원', '305-91-27412', 'u_super', '2026-09-01'],
    ['C-0028', '푸른숲중학교', '403-83-20514', 'u_super', '2026-09-01'],
    // 기획자 결정 2026-11-02 C-9 시연 계약(2609CL007~009, 할인 예외 점검)의 거래처: 사업자 정보 DB에서 골라 기안할 때 등록(새 거래처 표시 없음)
    ['C-0029', '한누리대학교', '134-82-61500', 'u_taeyun_kim', '2026-09-01'],
    ['C-0030', '해솔테크', '220-81-55239', 'u_sales2', '2026-09-07'],
    ['C-0031', '솔빛평생교육원', '403-82-30714', 'u_seohyun_park', '2026-09-14'],
    // 기획자 결정 2026-11-03(C-44) 시연 계약(2609CL010 담당 지정 필요, 2609CL011 영업대표 바뀜)의 거래처: 시스템 도입 때 옮긴 거래처(가상)
    ['C-0032', '라온디자인', '120-87-35202', 'u_super', '2026-09-01'],
    ['C-0033', '새빛정보통신', '214-86-51908', 'u_super', '2026-09-01'],
  ].map(function (r) {
    return { id: r[0], name: r[1], bizNo: r[2], registeredBy: r[3], registeredAt: r[4], use: true, mergedInto: null };
  });

  /* ---------- 사업자 정보 DB: 거래처 검색 (기획자 요청 v0.32, 요구사항 정의서 REQ-REG-18) ----------
   * 상호와 사업자등록번호만 시스템 안에 두는(내재화) DB입니다. 출처(v0.34 기획자 결정, C-22): 기획자가 모은 거래처 자료를 받아 넣음(추후 전달).
   *   공공데이터 API는 쓰지 않음(v0.33 권고안을 바꿈). 대표자명, 전화, 이메일은 넣지 않음
   * 계약 등록의 거래처 검색은 우리 거래처 목록(CUSTOMERS)과 이 DB를 함께 찾습니다.
   * 아래는 시연용 가상 사업체와 가상 번호입니다(번호는 사업자등록번호 검증 숫자 규칙에 맞춰 만듦). 실제 사업체가 아닙니다. */
  const BIZ_REGISTRY_INFO = { refreshedAt: '2026-10-19', source: '모아 둔 사업자 자료' };
  // 국세청 사업자등록 상태 조회 결과(가상, v0.39 기획자 결정): 실제 시스템은 계약 등록에서 직접 넣은 번호만 국세청에 조회해
  //   폐업(CLOSED)은 기안을 막고 휴업(SUSPENDED)은 알림. 상호는 가져오지 않음. 여기에 없는 번호는 "계속 사업자"로 봄
  const NTS_STATUS = { '5018612342': 'CLOSED', '3128155668': 'SUSPENDED' };
  const BIZ_REGISTRY = [
    ['한빛초등학교', '128-83-11021'], ['한빛고등학교', '128-82-20519'], ['한빛의료재단 한빛병원', '135-82-33176'],
    ['별가람대학교', '312-82-44080'], ['미래로간호대학교', '506-82-51231'], ['푸른누리병원', '410-82-62908'],
    ['새길교육연구소', '214-82-77313'], ['다솜정보통신 주식회사', '220-86-88128'], ['온누리평생교육원', '211-91-90250'],
    ['가람중학교', '403-83-12090'], ['누리솔 주식회사', '119-87-23142'], ['하늬바람학원', '305-91-34024'],
    ['청솔대학교', '134-82-45102'], ['이룸의료재단 이룸병원', '506-82-56347'], ['마루고등학교', '403-83-67450'],
    ['별빛초등학교', '305-83-78503'],
    ['한누리대학교', '134-82-61500'], ['해솔테크', '220-81-55239'], ['솔빛평생교육원', '403-82-30714'], // 2026-11-02 C-9 시연 계약의 거래처
  ].map(function (r) { return { name: r[0], bizNo: r[1] }; });

  /* ---------- 관리자가 관리하는 코드표: 코드 관리(SCR-56) (데이터 정의서 9장) ----------
   * 화면 이름을 바꿔도 코드는 그대로입니다. 쓰지 않는 코드는 지우지 않고 "사용 안 함"으로 돌립니다(지난 기록의 뜻을 지키려고).
   * 사용 안 함인 코드는 새로 고르는 목록에서만 빠지고, 이미 저장된 기록에는 그대로 보입니다.
   * 서비스는 한 단계(v0.47). v0.46까지의 중분류, 소분류(카피킬러 캠퍼스, 프리즘 등)는 제품으로 옮겨 제품과 기능 관리(SCR-58)에서 관리 */
  const CODE_GROUPS = {
    // levels: 단계가 있는 코드표의 단계 이름 (조직은 실과 그 아래 유닛)
    DEPT: { name: '조직', table: 'CODE-DEPT', note: '사용자 권한 관리에서 고르는 조직(실, 유닛). 화면 맨 위 이름 앞에 보임', levels: { 1: '1단계', 2: '2단계' } },
    SERVICE: { name: '서비스', table: 'CODE-SERVICE', note: '계약을 구분하는 서비스. 그 아래 제품과 기능은 제품과 기능 관리에서 관리' },
    // 계약 유형(CONTRACT_TYPE)은 v0.34에서 없앰(계약 방식으로 합침). 읽는 곳이 없어 코드 줄도 v0.58에 뺌
    METHOD: { name: '계약 방식', table: 'CODE-METHOD', note: '계약 등록에서 고르는 방식' },
    SETTLEMENT: { name: '정산 방식', table: 'CODE-SETTLEMENT', note: '계약 등록에서 고르는 방식' },
    AFTERCARE: { name: '사후관리 기록 종류', table: 'CODE-AFTERCARE-TYPE', note: '계약 상세의 사후관리 기록에서 고르는 종류' },
  };
  const CODES = [
    // 조직 (기획자 지정 v0.29). 괄호는 맡는 일: 경영지원실(CFO) 아래 경영지원유닛(법무, 인사. 총무 담당자와 최고관리자도 이 유닛, v0.31 확인), 재무기획유닛(재무)
    //   비즈니스유닛(COO) 아래 비즈니스1유닛(CK), 비즈니스2, 3유닛(HR), 세일즈어드민유닛(영업지원), CEM유닛(고객지원, 위치 [가정])
    //   정보보호유닛(개인정보 보호)
    ['DEPT', 'MGMT', '경영지원실', 1], ['DEPT', 'MGMT_SUPPORT', '경영지원유닛', 2, 'MGMT'], ['DEPT', 'FIN_PLAN', '재무기획유닛', 2, 'MGMT'],
    ['DEPT', 'BIZ', '비즈니스유닛', 1], ['DEPT', 'BIZ_1', '비즈니스1유닛', 2, 'BIZ'], ['DEPT', 'BIZ_2', '비즈니스2유닛', 2, 'BIZ'],
    ['DEPT', 'BIZ_3', '비즈니스3유닛', 2, 'BIZ'], ['DEPT', 'SALES_ADMIN', '세일즈어드민유닛', 2, 'BIZ'], ['DEPT', 'CEM', 'CEM유닛', 1], // C-21 ② v0.39: 어느 실에도 속하지 않는 1단계 조직
    ['DEPT', 'INFOSEC', '정보보호유닛', 1],
    ['SERVICE', 'CK', SERVICES.CK], ['SERVICE', 'HR', SERVICES.HR], ['SERVICE', 'ETC', SERVICES.ETC], // 대분류. 중분류는 제품(PRODUCTS), 소분류는 기능(FEATURES)
    ['METHOD', 'DIRECT', '직접'], ['METHOD', 'PROCURE', '조달'], ['METHOD', 'INDIRECT', '간접'],
    ['SETTLEMENT', 'LUMP', '일시'], ['SETTLEMENT', 'SPLIT', '분할'], ['SETTLEMENT', 'POST', '후불'],
    ['AFTERCARE', 'CONTACT_CHANGE', '담당자 변경'], ['AFTERCARE', 'ISSUE', '특이사항'],
  ].map(function (r) { return { group: r[0], code: r[1], label: r[2], level: r[3] || null, parent: r[4] || null, use: true }; });

  /* ---------- 대리 지정: 결재선 규칙(SCR-52) (REQ-REV-08, 기획자 결정 v0.25) ----------
   * 담당자가 자리를 비우는 기간과 대신할 사람을 관리자가 정합니다. 기간 안에는 대신할 사람이 그 담당자의 차례를 처리하고,
   * 결재 기록에 "누구 대신"과 근거(사유)가 남습니다. 담당자 본인도 기간 중에 처리할 수 있습니다. [가정]
   * absentId: 자리를 비우는 담당자 / delegateId: 대신할 사람 / from, to: 기간(날짜, 이틀 다 포함) / reason: 근거
   * by, at: 지정한 관리자와 일시 / endedAt: 기간 전에 끝냈으면 그 일시 */
  const DELEGATIONS = [
    // 지난 분기의 끝난 대리 지정 예시(v0.63, 표준 대응표 G-23 ②): 2026년 3분기 권한 검토 창의 "이 분기에 걸친 대리 지정"에 보임
    //   날짜는 두 사람의 계정이 생긴 뒤(송민재 2026-09-24 등록), 관리자 변경 이력에도 같은 줄 (v0.63 검토)
    { id: 'DL-000', absentId: 'u_legal', delegateId: 'u_minjae_song', from: '2026-09-29', to: '2026-09-30',
      reason: '김지우님 외부 교육(2026-09-29~2026-09-30). 같은 법무 담당자 송민재님이 법무 검토를 대신함', by: 'u_admin', at: '2026-09-28 10:00', endedAt: null },
    // 기획자 결정 2026-11-02 C-9 시연: 이 기간에 영업 임원이 ③을 대신 승인한 계약(2609CL009)이 할인 예외 점검에 "대리 결재"로 보임. 관리자 변경 이력에도 같은 줄
    { id: 'DL-003', absentId: 'u_head', delegateId: 'u_exec', from: '2026-09-16', to: '2026-09-18',
      reason: '최민준님 연차(2026-09-16~2026-09-18). 비즈니스1유닛 계약의 영업 검토를 영업 임원이 대신 결재(위임전결규정 대결)', by: 'u_admin', at: '2026-09-15 17:00', endedAt: null },
    { id: 'DL-001', absentId: 'u_legal', delegateId: 'u_minjae_song', from: '2026-10-05', to: '2026-10-07',
      reason: '김지우님 연차(2026-10-05~2026-10-07). 같은 법무 담당자 송민재님이 법무 검토를 대신함', by: 'u_admin', at: '2026-10-02 10:20', endedAt: null },
    { id: 'DL-002', absentId: 'u_eunseong_ko', delegateId: 'u_exec', from: '2026-10-19', to: '2026-10-23',
      reason: '고은성님 해외 출장(2026-10-19~2026-10-23). 비즈니스2유닛 계약의 영업 검토를 영업 임원이 대신 결재(위임전결규정 대결)', by: 'u_admin', at: '2026-10-16 17:40', endedAt: null },
  ];
  // 단계 담당자를 바꾼 이력. 바꾸면 아직 차례가 오지 않은 단계부터 새 담당자에게 갑니다(기획자 결정 v0.25).
  //   { step, to, at } 시연으로 바꾼 것은 common.js가 더함. 처음 설정은 STEP_ASSIGNEE
  const ASSIGNEE_CHANGES = [];

  /* ---------- 관리자 변경 이력 (SCR-51~56, REQ-SEC-05, REQ-AUTH-10, REQ-CHK-07) ----------
   * 관리자 화면에서 바꾼 것은 모두 한 줄씩 남기고 고치거나 지우지 않습니다(영구 보관). 사유는 필수입니다.
   * area: USER 사용자 권한 / RULE 결재선 규칙 / RESTRICT 열람 제한 / CUSTOMER 거래처 / CODE 코드 / PRODUCT 제품과 기능(v0.47) / AUDIT 기록 점검
   *   / COMPLIANCE 거래처 확인, 보류, 개선 과제(2026-11-02 C-13, C-16. 예시 줄은 맨 아래 "거래처 확인, 보류, 개선 과제"에서 더함)
   * 아래는 이미 반영된 예시 기록입니다(시연으로 바꾼 것은 common.js가 이 브라우저에 저장해 더함). 가격 기준 이력은 PRICE_ROWS에 있습니다. */
  const ADMIN_LOG = [
    { at: '2026-09-01 09:00', by: 'u_super', area: 'RULE', target: '결재선 규칙', change: '처음 설정: ② 배수아, ③ 유닛 리더(비즈니스1유닛 최민준, 비즈니스2유닛 고은성, 비즈니스3유닛 차유나, 리더 본인 계약은 문태호), ④ 김지우, ⑤ 한서연, ⑥ 노은채, ⑧ 배수아, ⑨ 임하준, ⑩ 오현우, 결재 대기 독촉 5일, 체결 지연 독촉 14일', reason: '시스템 도입' },
    { at: '2026-09-01 09:00', by: 'u_super', area: 'CUSTOMER', target: '거래처 15곳', change: '거래처 추가: 한결대학교 외 14곳', reason: '시스템 도입: 기존 계약관리대장에서 옮김' }, // 2026-11-02 만료 처리 시연 거래처 둘(C-0023, C-0024)을 더해 15곳
    { at: '2026-09-01 09:00', by: 'u_super', area: 'CODE', target: '코드표 5개', change: '처음 등록: 조직, 서비스, 계약 방식, 정산 방식, 사후관리 기록 종류', reason: '시스템 도입' },
    // 기획자 결정 2026-11-02 C-9 시연: 대리 지정 DL-003(위 DELEGATIONS와 같은 줄)
    { at: '2026-09-15 17:00', by: 'u_admin', area: 'RULE', target: '③ 영업 검토(비즈니스1유닛 리더) 대리 지정', change: '대리 지정: 최민준 → 문태호 (2026-09-16~2026-09-18)', reason: '최민준님 연차(2026-09-16~2026-09-18). 비즈니스1유닛 계약의 영업 검토를 영업 임원이 대신 결재(위임전결규정 대결)' },
    { at: '2026-09-28 10:00', by: 'u_admin', area: 'RULE', target: '④ 법무 검토 대리 지정', change: '대리 지정: 김지우 → 송민재 (2026-09-29~2026-09-30)', reason: '김지우님 외부 교육(2026-09-29~2026-09-30). 같은 법무 담당자 송민재님이 법무 검토를 대신함' },
    { at: '2026-10-02 09:30', by: 'u_admin', area: 'USER', target: '기태민 (taemin.ki@muhayu.com)', change: '상태: 사용 중 → 사용 중지', reason: '9월 30일 퇴사(인사 담당 퇴사 통보 2026-10-01)' },
    { at: '2026-10-02 10:20', by: 'u_admin', area: 'RULE', target: '④ 법무 검토 대리 지정', change: '대리 지정: 김지우 → 송민재 (2026-10-05~2026-10-07)', reason: '김지우님 연차(2026-10-05~2026-10-07). 같은 법무 담당자 송민재님이 법무 검토를 대신함' },
    { at: '2026-10-06 14:10', by: 'u_super', area: 'USER', target: '송민재 (minjae.song@muhayu.com)', change: '권한: 법무 담당자 → 법무 담당자, 관리자', reason: '관리자 부재에 대비해 법무 담당자 송민재님을 관리자로 함께 지정(경영지원유닛 요청)' },
    { at: '2026-10-08 16:00', by: 'u_admin', area: 'RESTRICT', target: '2606CL001 해랑출판', change: '열람 제한 해제', reason: '보도자료로 계약 사실이 공개되어 더 가릴 필요 없음(영업 요청)' },
    // 지정 열람자 (v0.52): 지정한 내용은 계약의 viewers에 이미 들어 있음. 사람 지정이 인사이동으로 풀린 것은 viewers의 releasedAt
    { at: '2026-09-20 10:00', by: 'u_admin', area: 'RESTRICT', target: '2511CL002 푸른솔아카데미', change: '열람자 지정: 비즈니스2유닛 석다인(사람)', reason: '같은 유닛 영업 담당자가 연장 협상을 함께 맡음' },
    { at: '2026-10-08 09:30', by: 'u_admin', area: 'RESTRICT', target: '2511CL002 푸른솔아카데미', change: '열람자 지정: CEM유닛(조직)', reason: '연장 검토 전에 고객지원이 사용 현황을 미리 확인' },
    { at: '2026-10-18 10:00', by: 'u_admin', area: 'RESTRICT', target: '2610CL007 가람전자', change: '열람자 지정: 재무기획유닛(조직)', reason: '총판 계약이라 매출 인식 방법을 재무기획유닛이 미리 검토' },
    { at: '2026-10-18 10:05', by: 'u_admin', area: 'RESTRICT', target: '2610CL007 가람전자', change: '열람자 지정: 비즈니스유닛 문태호(사람)', reason: '할인 폭이 커서 영업 임원이 결재 전에 내용을 확인' },
    { at: '2026-10-12 11:00', by: 'u_admin', area: 'USER', target: '석다인 (dain.seok@muhayu.com)', change: '조직: 비즈니스2유닛 → 세일즈어드민유닛, 권한: 영업 담당자 → 영업지원 담당자', reason: '10월 12일 세일즈어드민유닛으로 인사 이동' },
    { at: '2026-10-12 11:05', by: 'u_admin', area: 'USER', target: '차유나 (yuna.cha@muhayu.com)', change: '권한: 영업 담당자 → 영업 리더', reason: '10월 12일 비즈니스3유닛 리더 발령' },
    { at: '2026-10-15 10:00', by: 'u_admin', area: 'USER', target: '설은우 (eunwoo.seol@muhayu.com)', change: '사용자 추가: 비즈니스3유닛, 영업 담당자', reason: '10월 15일 입사' },
    { at: '2026-10-16 10:00', by: 'u_admin', area: 'USER', target: '연주아 (jua.yeon@muhayu.com)', change: '사용자 추가: CEM유닛, 고객지원 담당자', reason: '10월 16일 입사' },
    { at: '2026-10-16 17:40', by: 'u_admin', area: 'RULE', target: '③ 영업 검토(비즈니스2유닛 리더) 대리 지정', change: '대리 지정: 고은성 → 문태호 (2026-10-19~2026-10-23)', reason: '고은성님 해외 출장(2026-10-19~2026-10-23). 비즈니스2유닛 계약의 영업 검토를 영업 임원이 대신 결재(위임전결규정 대결)' },
    // 기획자 결정 2026-11-02 시연 기록(가상 인물): 컴플라이언스 담당자 추가(덧붙임), 감사 열람을 줌(C-2, ROLE_GRANTS와 같은 줄), 역할 겹침을 알고 저장(C-5)
    //   requestedBy: 요청한 사람(C-7, 선택). conflict: 저장할 때 알린 겹침과 받은 까닭(분기 권한 검토의 역할 충돌 계정에 보임)
    { at: '2026-09-14 10:00', by: 'u_admin', area: 'USER', target: '반서율 (seoyul.ban@muhayu.com)', change: '사용자 추가: 경영지원유닛, 컴플라이언스 담당자', reason: '9월 15일 컴플라이언스 담당으로 배치' },
    { at: '2026-09-15 09:30', by: 'u_super', area: 'USER', target: '반서율 (seoyul.ban@muhayu.com)', change: '권한: 컴플라이언스 담당자 → 컴플라이언스 담당자, 감사 열람(2026-10-15까지)',
      reason: '3분기 내부회계 운영평가 준비: 열람 제한 계약을 포함해 7~9월 체결 계약 표본을 확인', requestedBy: 'u_jaewon_kook' },
    { at: '2026-10-12 10:00', by: 'u_super', area: 'USER', target: '인채율 (chaeyul.in@muhayu.com)', change: '사용자 추가: 경영지원실, 감사 열람(2027-01-11까지)',
      reason: '하반기 내부감사: 열람 제한 계약을 포함한 전체 계약과 관리자 변경 이력, 접속 기록 점검 결과를 확인', requestedBy: 'u_jaewon_kook' },
    { at: '2026-10-14 10:30', by: 'u_admin', area: 'USER', target: '방시현 (sihyun.bang@muhayu.com)', change: '권한: 고객지원 담당자 → 고객지원 담당자, 재무 담당자, 역할 겹침을 알고 저장(⑨ 고객지원과 ⑩ 재무)',
      reason: '10월 결산 동안 재무기획유닛 일손이 모자라 ⑩ 재무 확인을 대신할 수 있게 재무 담당자 역할을 함께 줌 / 역할 겹침 까닭: 같은 계약의 ⑨와 ⑩은 시스템이 한 사람에게 주지 않음. 11월 분기 권한 검토에서 다시 봄',
      requestedBy: 'u_seojin_ma', conflict: { list: ['⑨ 고객지원과 ⑩ 재무'], reason: '같은 계약의 ⑨와 ⑩은 시스템이 한 사람에게 주지 않음. 11월 분기 권한 검토에서 다시 봄' } },
    { at: '2026-10-19 09:00', by: 'u_super', area: 'CODE', target: '조직 코드표', change: '조직 개편: 부서 12개를 실과 유닛 10개로 바꿈(영업1~3팀 → 비즈니스1~3유닛, 법무팀과 경영지원팀 → 경영지원유닛 등), 사람마다 새 조직으로 옮김', reason: '2026년 10월 조직 개편' },
    // 기획자 결정 2026-11-02 E-9, E-7 ②: 회사 설정(SCR-59)의 처음 값. 회사 정보는 최고관리자, 인장 그림은 총무(가상 값, 위 COMPANY와 같은 줄)
    { at: '2026-09-01 09:00', by: 'u_super', area: 'COMPANY', target: '회사 정보', change: '처음 넣음: 사업자등록번호, 대표자, 주소, 대표 연락처(윤리 규정과 신고 창구 링크는 아직 없음)', reason: '시스템 도입: 경영지원유닛에서 받은 값' },
    { at: '2026-09-15 10:00', by: 'u_seoyun_tak', area: 'COMPANY', target: '회사 인장 그림', change: '인장 그림 올림: 회사인장_견본.svg (1판)', reason: '견적서 출력에 찍을 회사 인장 그림. 인장 대장에 등록한 회사 인장과 같은 것' },
    // 기획자 결정 2026-11-02 C-8 시연(가상 기록): 제품과 기능을 바꾼 기록 하나(FEATURES의 HR_PRISM_PLAG 사용 안 함과 같은 내용)
    //   설정 변경 확인(SCR-65)에서 재무 리더가 확인할 차례. 바꾼 사람이 최고관리자라 최고관리자는 확인하지 못함(C-6)
    { at: '2026-10-19 09:10', by: 'u_super', area: 'PRODUCT', target: '프리즘 (HR_PRISM)', change: '기능 표절검사: 사용 → 사용 안 함', reason: '기획자 서비스 정리표(2026-10-23): 결함·표절검사로 합쳐짐' },
    // 기획자 결정 2026-11-02 C-8 시연: 설정 변경 확인(SCR-65)에 남긴 확인. 쌓기만 함. op.id는 control-checks.js가 만드는 변경 한 건의 번호
    //   가격 기준은 같은 때, 같은 사람, 같은 품의로 넣은 줄을 한 건으로 봄. 품의와 맞음(재무 리더), 품의와 다름(재무 리더), 근거와 맞음(올린 사람이 아닌 법무)
    { at: '2026-10-05 11:00', by: 'u_seojin_ma', area: 'AUDIT', target: '설정 변경 확인: 가격 기준 카피킬러 캠퍼스 추가 이용자', change: '품의와 맞음',
      reason: '품의 경영지원-2026-0915의 단가 150만 원, 10월 1일 적용과 맞음',
      op: { k: 'CONFIG_CHECK', id: 'PRICE:2026-09-24 15:10|u_admin|경영지원-2026-0915', area: 'PRICE', result: 'MATCH', note: '품의 경영지원-2026-0915의 단가 150만 원, 10월 1일 적용과 맞음' } },
    { at: '2026-10-19 11:30', by: 'u_seojin_ma', area: 'AUDIT', target: '설정 변경 확인: 가격 기준 카피킬러 캠퍼스 출처 표기법 검사 외 기능 45개', change: '품의와 다름',
      reason: '연결한 문서가 가격 품의가 아니라 기획자 정리표이고, 카피킬러 단가는 임의 값임. 운영 시작 전에 가격 품의를 받아 다시 넣어야 함',
      op: { k: 'CONFIG_CHECK', id: 'PRICE:2026-10-19 09:00|u_super|기획-2026-1023', area: 'PRICE', result: 'DIFF', note: '연결한 문서가 가격 품의가 아니라 기획자 정리표이고, 카피킬러 단가는 임의 값임. 운영 시작 전에 가격 품의를 받아 다시 넣어야 함' } },
    { at: '2026-09-26 18:00', by: 'u_minjae_song', area: 'AUDIT', target: '설정 변경 확인: 표준계약서 카피킬러 SaaS 이용계약서 판 2', change: '근거와 맞음',
      reason: '법무 검토 기록 2026-09-24의 제12조, 제15조 고친 문구와 같음',
      op: { k: 'CONFIG_CHECK', id: 'TPL:TPL-CK:2', area: 'TEMPLATE', result: 'MATCH', note: '법무 검토 기록 2026-09-24의 제12조, 제15조 고친 문구와 같음' } },
    // 기획자 결정 2026-11-02 C-7 시연: 3분기 권한 검토 때 유닛마다 계정 목록을 유닛 리더에게 보낸 기록(보내기만 하고 답은 받지 않음)
    //   units: 유닛, 받은 리더, 그때 계정 수. 리더 역할이 없는 유닛(경영지원유닛)은 상위 조직의 임원(재무 임원)에게 [가정]
    { at: '2026-10-16 15:00', by: 'u_privacy', area: 'AUDIT', target: '2026년 3분기 유닛별 계정 목록', change: '유닛 리더 9명에게 보냄(유닛 10곳, 계정 47개)',
      reason: '분기 권한 검토 때 유닛마다 계정 목록을 유닛 리더에게 보냄(답은 받지 않음)',
      op: { k: 'UNIT_LIST_SENT', r: { quarter: '2026-Q3', units: [
        { unit: '경영지원실', to: 'u_jaewon_kook', n: 2 }, { unit: '경영지원유닛', to: 'u_jaewon_kook', n: 8 }, { unit: '재무기획유닛', to: 'u_seojin_ma', n: 3 },
        { unit: '비즈니스유닛', to: 'u_exec', n: 1 }, { unit: '비즈니스1유닛', to: 'u_head', n: 7 }, { unit: '비즈니스2유닛', to: 'u_eunseong_ko', n: 7 },
        { unit: '비즈니스3유닛', to: 'u_yuna_cha', n: 8 }, { unit: '세일즈어드민유닛', to: 'u_jihoon_eom', n: 3 }, { unit: 'CEM유닛', to: 'u_yeonwoo_joo', n: 6 },
        { unit: '정보보호유닛', to: 'u_seungho_yeo', n: 2 }] } } },
  ];
  // 기획자 결정 2026-11-02 A-6: 공지는 사유 칸 없이 "공지 올림", "공지 고침", "공지 내림"을 사유로 남김(REQ-ADM-10의 예외. 예전에는 "-")
  //   위 공지사항 예시 글(NOTICES)을 올린 기록. 바뀐 내용은 공지 쓰기(notice-form.js)가 남기는 글과 같은 모양
  NOTICES.forEach(function (n) {
    ADMIN_LOG.push({ at: n.at, by: n.by, area: 'NOTICE', target: n.id + ' ' + n.title,
      change: '공지 올림' + (n.important ? ' (중요, 전체 이메일' + (n.pinUntil ? ', ' + n.pinUntil + '까지 맨 위 고정' : '') + ')' : ''), reason: '공지 올림' });
  });
  // 열람 제한을 건 기록 (계약을 등록할 때 영업이 건 것). 관리자가 바꾼 것은 ADMIN_LOG의 RESTRICT
  const RESTRICT_LOG = [
    { at: '2026-09-01 09:00', by: 'u_super', id: '2511CL002', on: true, reason: '시스템 도입 때 기존 계약을 옮기며 설정(기존 계약관리대장의 비공개 표시)' },
    { at: '2026-09-01 09:00', by: 'u_super', id: '2606CL001', on: true, reason: '시스템 도입 때 기존 계약을 옮기며 설정(기존 계약관리대장의 비공개 표시)' },
    { at: '2026-10-17 14:00', by: 'u_sales1', id: '2610CL007', on: true, reason: '계약을 등록하며 영업이 설정' },
    { at: '2026-09-07 10:00', by: 'u_sales2', id: '2609CL008', on: true, reason: '계약을 등록하며 영업이 설정' }, // 2026-11-02 C-9 시연 계약
  ];

  /* ---------- 접속 기록 점검: SCR-57 (REQ-SEC-05, REQ-SEC-06, 기획자 결정 v0.25) ----------
   * 점검은 정보보호 담당자와 리더(정보보호유닛)가 합니다. 관리자가 자기 작업 기록을 스스로 점검하지 않게 하려는 것입니다.
   * LOG_REVIEWS: 매월 접속 기록과 내려받기 기록 점검 결과 [가정] 기한: 다음 달 말일
   * ACCESS_REVIEWS: 분기마다 모든 계정의 권한 검토 결과 [가정] 기한: 분기가 끝난 다음 달 말일
   * SEC_ALERTS: 이상 행위 알림. 주기와 상관없이 바로 정보보호 담당자에게 이메일로 감(REQ-SEC-06). 가상 인물의 가상 기록입니다.
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

  /* ---------- 기간 마감 점검 확인: 통계와 보고서 SCR-46 (기획자 결정 2026-11-02 B-9, CTL-65) ----------
   * 재무(담당자, 리더, 임원)가 결산 기간 말마다 남기는 확인. 쌓기만 하고 고치거나 지우지 않음(같은 기간 말에 다시 남기면 한 줄 더)
   * end: 기간 말 / at, by, dept: 확인한 때와 사람, 그때 조직 / memo: 메모(선택)
   * seen: 확인 때 본 숫자 { days: 앞뒤 날 수, a: 기간 말 앞뒤 체결 [건수, 금액], b: 승인됐지만 체결 전, c: ⑨ ⑩ 기다림, hidden: 열람 제한으로 뺀 계약 수,
   *   sig: 세 목록의 계약번호=금액(열람 제한 계약 포함, 화면에는 보이지 않음). 지금 목록과 다르면 "확인한 뒤 바뀜" }
   * 시연 예시: 9월 말을 10-02 오전에 확인. 그날 오후 청람컨설팅(2609CL001)이 9월에 서명한 체결본을 올려 지금 목록과 달라짐("확인한 뒤 바뀜") */
  const CLOSE_CHECKS = [
    { end: '2026-09-30', at: '2026-10-02 09:10', by: 'u_finance', dept: '재무기획유닛',
      // 2026-11-02 B-9 시연 계약 새길교육연구소(2609CL006)를 더해 앞뒤 체결 1건과 ⑨ 대기 1건(같은 계약)이 보이게 맞춤
      memo: '승인됐지만 체결 전 3건(바른출판, 마루중학교, 청람컨설팅) 확인. 앞뒤 체결 1건, ⑨ 대기 1건(같은 계약, 새길교육연구소)',
      seen: { days: 5, a: [1, 8400000], b: [3, 56400000], c: [1, 8400000], hidden: 0,
        sig: 'a:2609CL006=8400000|b:2609CL001=19200000,2609CL002=24000000,2609CL004=13200000|c:2609CL006=8400000' } },
  ];

  /* ---------- 할인 예외 점검: SCR-61 (기획자 결정 2026-11-02 C-9, G-14) ----------
   * 재무 임원이 매월 남기는 점검 기록. 쌓기만 하고 고치거나 지우지 않음. 기한은 다음 달 말일
   * 공통: month 대상 월('2026-09') / type / at, by, dept: 남긴 때와 사람, 그때 조직
   *   LIMIT 한계값: limit(가장 큰 줄 할인율이 이 % 이상이면 의견 필수), reason(바꿀 때 까닭). 마지막 것이 그달 한계값. 줄 확인을 남긴 뒤에는 남기지 않음
   *   ROW 줄 확인: key('DISC:계약번호#차수' ③ 가격 예외, 'FIN:계약번호#차수' ⑩ 늦음), contractId, part(DISC, FIN), over(한계값을 넘어 의견 필수였는지),
   *     limit(그때 한계값), opinion(의견), seen(확인 때 본 내용 글: 할인율과 ③ 승인, 또는 ⑩ 날짜. 고객사 이름은 넣지 않음). 줄마다 한 번
   *   DONE 점검 마침: memo(선택), seen { disc, fin, over, limit, sig: 그때 줄 목록 }. 지금 목록과 다르면 "마친 뒤 바뀜"
   * 시연: 9월 한계값 25%를 10-14에 정하고 대리 결재 줄(2609CL009) 하나만 확인함. 나머지 세 줄은 확인 전(기한 10-31)
   *   시연으로 남긴 것은 이 브라우저에만(C.pushDemo 'discountReviews'). 실제 시스템은 서버의 점검 기록 */
  const DISCOUNT_REVIEWS = [
    { month: '2026-09', type: 'LIMIT', limit: 25, at: '2026-10-14 10:10', by: 'u_jaewon_kook', dept: '경영지원실' },
    { month: '2026-09', type: 'ROW', key: 'DISC:2609CL009#1', contractId: '2609CL009', part: 'DISC', over: false, limit: 25,
      opinion: '대리 지정 기간 안에 근거를 남기고 영업 임원이 대신 결재함. 한도를 4%p 넘은 정도라 문제없음',
      seen: '가장 큰 줄 24%(한도 20%), 계약 전체 20%, ③ 영업 리더 비즈니스유닛 문태호 2026-09-16 10:20(비즈니스1유닛 최민준 대신, 대리 지정)',
      at: '2026-10-14 10:30', by: 'u_jaewon_kook', dept: '경영지원실' },
  ];

  /* ---------- 꺼낸 기록: 통제 증빙 내보내기와 결재 기록 묶음 (기획자 결정 2026-11-02 C-3, REQ-DASH-21) ----------
   * 통계와 보고서(SCR-46)의 통제 증빙 내보내기(기간 전체, 감사 열람)와 계약 상세(SCR-42)의 결재 기록 묶음을 꺼낼 때마다 한 줄. 쌓기만 하고 고치거나 지우지 않음
   * id / at, by, dept: 꺼낸 때와 사람, 그때 조직 / kind: PERIOD 기간 전체, BUNDLE 계약 묶음 하나 / cond: 조건(기간이나 묶음 번호)
   * count: 건수(글), sum: 금액 합계(신규, 변경, 연장. 묶음은 0) / hash: 파일 지문(SHA-256, 파일 맨 위 머리 아래 본문의 지문) / file: 파일 이름
   * 아래는 가상 기록입니다(지문도 가상 값). 시연으로 꺼낸 것은 이 브라우저에만(C.pushDemo 'exports'). 실제 시스템은 서버의 꺼낸 기록 */
  const EXPORT_LOG = [
    // 2026-11-02 고침: 할인 예외 점검(C-9) 시연 계약 셋(2609CL007~009, 9월 기안과 체결)을 넣은 값. 계약 +3건, 가격 예외 3건, 4번 예 +1건,
    //   ⑧ 결과 +3줄, 결재 기록 +22줄, 금액 +61,920,000원. 가격과 권한 변경, 접속 기록 줄 수는 시연용 대략 값 [가정]
    { id: 'EX-0001', at: '2026-10-14 10:20', by: 'u_chaeyul_in', dept: '경영지원실', kind: 'PERIOD', cond: '기간 2026-09-01~2026-09-30',
      count: '계약 17건, 결재 기록 83줄, 가격 예외 3건, 4번 예 2건, ⑧ 결과 6줄, 가격과 권한 변경 17줄, 접속 기록 127줄', sum: 169320000,
      hash: 'b7e07ff48fd4c99eeb24d16164ed54df525f51f3d192aa75d3c1b19f1bab8e1b', file: '통제증빙_2026-09-01_2026-09-30.csv' },
    { id: 'EX-0002', at: '2026-10-16 14:05', by: 'u_sales2', dept: '비즈니스2유닛', kind: 'BUNDLE', cond: '계약 묶음 2606CL001 해랑출판',
      count: '계약 4건, 결재 문서 4개, 결재 기록 21줄, 첨부와 체결본 2개', sum: 0,
      hash: '777b3cbcfd503afd80e7a4207c74b868c3415d3b5415df2f753ce5abd304e1d6', file: '결재기록묶음_2606CL001_목록.csv' },
  ];

  /* ---------- 영업기회 대사: SCR-62 (기획자 결정 2026-11-02 E-1 ②, G-02, CTL-03) ----------
   * 영업지원(담당자, 리더)이 매월 판다(CRM)에서 내려받은 수주 목록 파일(CSV)을 올려 시스템의 계약과 맞춰 봄. 운영 시작(SERVICE_START_MONTH) 뒤 수주만
   *   계약이 없는 수주, 수주 목록에 없는 계약을 줄마다 보고 의견을 남긴 뒤 그 달 대사를 확인함. 기록은 쌓기만 함(고치거나 지우지 않음)
   *   파일의 고객 담당자 이름, 연락처, 이메일 칸은 읽을 때 빼고 저장하지 않음(REQ-SEC-09. 빼낸 칸의 이름만 남김)
   * OPP_SAMPLE: "예시 파일로 해 보기"가 읽는 판다 내려받기 모양의 9월 수주 목록. 담당자와 연락처 칸이 든 그대로(가상 인물, 가상 번호와 주소)
   * OPP_RECON: 기록 { type, month: 대사 월, at, by, dept: 그때 조직 }
   *   UPLOAD: id, fileName, rows: [{ wonAt 수주일, opp 영업기회번호, customer 고객사, bizNo, amount 수주 금액, sales 담당 영업 }],
   *     skipped: { before: 운영 시작 전 수주 줄, other: 다른 달 수주 줄, bad: 읽지 못한 줄 }, dropped: 뺀 칸 이름. 같은 달에 다시 올리면 마지막 파일로 맞춰 봄
   *   NOTE: key('ORDER:영업기회번호' 또는 'CONTRACT:계약번호'), text. 같은 줄에 다시 남기면 한 줄 더(화면은 마지막 의견)
   *   CONFIRM: uploadId(맞춰 본 파일), memo(선택), seen: { orders, matched, noContract, notInList, keys } 확인 때 본 숫자
   * 시연: 9월 파일을 10-05에 올리고 예외 두 줄(계약이 없는 도담고등학교 수주, 8월 수주라 목록에 없는 2609CL004)에 의견을 남김. 확인은 아직(기한 10-31) */
  const OPP_SAMPLE = {
    fileName: '판다_수주목록_2026-09.csv',
    head: ['수주일', '영업기회번호', '고객사', '사업자등록번호', '수주 금액', '담당 영업', '고객 담당자', '연락처', '이메일'],
    rows: [
      ['2026-08-27', '2608CK021', '마루중학교', '403-83-10281', '13200000', '이도윤', '나예린', '010-0000-0101', 'contact01@example.com'],
      // 할인 예외 점검(C-9) 시연 계약 셋의 수주(2026-11-02 더함): 수주 목록에 있어야 9월 대사의 예외가 처음 이야기대로 둘(위 OPP_RECON의 두 의견)
      //   기안일보다 앞선 9월 날짜. 2609HR016(해솔테크)은 열람 제한 계약이라 볼 수 없는 사람에게는 화면이 가림
      ['2026-09-01', '2609CK027', '한누리대학교', '134-82-61500', '36000000', '김태윤', '석다래', '010-0000-0107', 'contact07@example.com'],
      ['2026-09-04', '2609HR003', '청람컨설팅', '220-88-71543', '19200000', '정하은', '마도현', '010-0000-0102', 'contact02@example.com'],
      ['2026-09-04', '2609HR016', '해솔테크', '220-81-55239', '14400000', '정하은', '연시우', '010-0000-0108', 'contact08@example.com'],
      // 기획자 결정 2026-11-03(C-44) 시연 계약 둘의 수주(담당 영업은 수주 때의 기태민, 2609CL010, 2609CL011과 맞음)
      ['2026-09-05', '2609CK031', '라온디자인', '120-87-35202', '18000000', '기태민', '도하윤', '010-0000-0110', 'contact10@example.com'],
      ['2026-09-10', '2609HR014', '새길교육연구소', '214-82-77313', '8400000', '정하은', '서지우', '010-0000-0103', 'contact03@example.com'],
      ['2026-09-10', '2609CK029', '솔빛평생교육원', '403-82-30714', '11520000', '박서현', '편다온', '010-0000-0109', 'contact09@example.com'],
      ['2026-09-11', '2609CK005', '바른출판', '105-87-44129', '24000000', '정하은', '하은솔', '010-0000-0104', 'contact04@example.com'],
      ['2026-09-17', '2609HR021', '새빛정보통신', '214-86-51908', '14400000', '기태민', '채이안', '010-0000-0111', 'contact11@example.com'],
      ['2026-09-18', '2609CK011', '새솔고등학교', '314-83-20951', '9600000', '이도윤', '우태린', '010-0000-0105', 'contact05@example.com'],
      ['2026-09-26', '2609CK019', '새솔고등학교', '314-83-20951', '2400000', '이도윤', '우태린', '010-0000-0105', 'contact05@example.com'],
      ['2026-09-28', '2609CK024', '도담고등학교', '312-83-55107', '6000000', '이도윤', '모세아', '010-0000-0106', 'contact06@example.com'],
    ],
  };
  const OPP_RECON = [
    { type: 'UPLOAD', id: 'OU-0001', month: '2026-09', at: '2026-10-05 10:20', by: 'u_sadmin', dept: '세일즈어드민유닛', fileName: OPP_SAMPLE.fileName,
      rows: OPP_SAMPLE.rows.filter(function (r) { return r[0].slice(0, 7) === '2026-09'; }).map(function (r) {
        return { wonAt: r[0], opp: r[1], customer: r[2], bizNo: r[3], amount: Number(r[4]), sales: r[5] };
      }),
      skipped: { before: 1, other: 0, bad: 0 }, dropped: ['고객 담당자', '연락처', '이메일'] },
    { type: 'NOTE', month: '2026-09', key: 'ORDER:2609CK024', at: '2026-10-05 11:00', by: 'u_sadmin', dept: '세일즈어드민유닛',
      text: '고객 예산 확정이 11월로 밀려 아직 기안 전. 영업대표 이도윤에게 확인함(10-05)' },
    { type: 'NOTE', month: '2026-09', key: 'CONTRACT:2609CL004', at: '2026-10-05 11:05', by: 'u_sadmin', dept: '세일즈어드민유닛',
      text: '8월 27일 수주(운영 시작 전)라 9월 목록에 없음. 판다에서 8월 수주로 확인함' },
  ];

  /* ---------- 인장 기록 대사: SCR-63 (기획자 결정 2026-11-02 E-7 덧붙임 ③) ----------
   * 총무가 매월 "견적서 출력"에 회사 인장을 찍은 출력 기록(QUOTES issues의 sealed)을 인장 대장과 맞춰 보고 남기는 확인. 출력은 막지 않음
   *   쌓기만 하고 고치거나 지우지 않음(같은 달에 다시 남기면 한 줄 더)
   * { month, at, by, dept, result: MATCH 대장과 맞음 / DIFF 맞지 않는 것이 있음, memo(맞으면 선택, 맞지 않으면 필수), seen: { n: 인장 찍은 출력 수, keys: 견적번호#판@출력 일시 } } */
  const SEAL_RECON = [
    { month: '2026-09', at: '2026-10-06 14:00', by: 'u_ga', dept: '경영지원유닛', result: 'MATCH',
      memo: '인장 찍은 출력 1건(QT2609-001 1판, 09-16)이 인장 대장의 9월 16일 줄(견적서, 바른출판)과 맞음. 09-14 출력은 인장 그림을 올리기 전이라 인장 없음',
      seen: { n: 1, keys: 'QT2609-001#1@2026-09-16 11:20' } },
  ];

  /* ---------- 거래처 확인, 보류, 개선 과제 (기획자 결정 2026-11-02 C-13, C-16과 덧붙임 "컴플라이언스") ----------
   * 모두 컴플라이언스 담당자가 남기고 쌓기만 함(고치거나 지우지 않음). 남길 때마다 관리자 변경 이력(영역 COMPLIANCE)에도 한 줄
   * 판단과 막기는 common.js "거래처 확인과 보류". 화면은 거래처 관리(SCR-55)와 개선 과제와 보류(SCR-64)
   * 아래 사람과 거래처, 사건은 모두 시연용 가상 내용입니다 */
  // 거래처 확인(C-13): 확인 대상, 결과 항목, 위험 등급의 이름. 결과 항목의 bad는 "문제"로 보는 값
  //   실제 소유자나 공직자의 이름은 남기지 않고 결과만 남김(REQ-SEC-09). 확인은 시스템 밖에서 손으로 함(공공데이터 API와 외부 AI를 쓰지 않음)
  const CUSTOMER_CHECK = {
    nextYears: 1, // 다음 확인일 기본: 확인한 날 1년 뒤(기획자 결정 2026-11-02 C-13 작업 지시). 창에서 앞당길 수 있음
    WHY: { PUBLIC: '국가와 지자체', PROCURE: '조달', INDIRECT: '간접(총판, 리셀러)' },
    RESULT: { NONE: '확인 안 함', OK: '문제 없음', ISSUE: '문제 있음' },
    RISK: { HIGH: '높음', MID: '보통', LOW: '낮음' },
    ITEMS: [
      { key: 'sanction', label: '제재 명단', options: [['NONE', '해당 없음'], ['HIT', '해당 있음']], bad: ['HIT'], help: '국내외 제재 대상 명단과 입찰 참가 제한 업체' },
      { key: 'media', label: '부정적 보도', options: [['NONE', '없음'], ['HIT', '있음']], bad: ['HIT'], help: '뇌물, 담합, 횡령 같은 보도' },
      { key: 'owner', label: '실제 소유자', options: [['OK', '문제 없음'], ['ISSUE', '문제 있음'], ['UNKNOWN', '확인 못 함'], ['NA', '해당 없음(국가와 지자체)']], bad: ['ISSUE', 'UNKNOWN'], help: '이름은 적지 않고 결과만' },
      { key: 'official', label: '공직자 관련', options: [['NONE', '없음'], ['HIT', '있음']], bad: ['HIT'], help: '소유자나 대표가 공직자이거나 그 가족인지. 이름은 적지 않음' },
    ],
  };
  // 거래처 확인 기록: customerId, bizNo, name(그때 상호) / why: 그때의 확인 대상 까닭 / on: 확인한 날 / next: 다음 확인일
  //   result: OK 문제 없음, ISSUE 문제 있음 / risk: 그때 계산한 위험 등급 / 항목 결과 sanction, media, owner, official / file: 증빙 파일 이름 / note: 확인한 방법과 판단
  //   시연: 가온테크(간접) 문제 없음, 도담고등학교(국가와 지자체) 다음 확인일 지남, 가람전자(간접) 문제 있음 → 보류 HD-0001
  //   확인 안 함: 마루중학교, 새솔고등학교, 푸른숲중학교(국가와 지자체), 하늘연구원(조달)
  const CUSTOMER_CHECKS = [
    { id: 'CK-0001', customerId: 'C-0006', bizNo: '129-86-40914', name: '가온테크', why: ['INDIRECT'], on: '2026-09-22', next: '2027-09-22',
      result: 'OK', risk: 'MID', sanction: 'NONE', media: 'NONE', owner: 'OK', official: 'NONE', file: '가온테크_거래처확인_2026-09-22.pdf',
      note: '시스템 도입 뒤 첫 확인. 제재 명단과 입찰 참가 제한 업체, 신문 검색, 주주명부로 확인함', by: 'u_seoyul_ban', at: '2026-09-22 15:20' },
    { id: 'CK-0002', customerId: 'C-0023', bizNo: '312-83-55107', name: '도담고등학교', why: ['PUBLIC'], on: '2026-09-24', next: '2026-10-10',
      result: 'OK', risk: 'LOW', sanction: 'NONE', media: 'NONE', owner: 'NA', official: 'NONE', file: '도담고등학교_거래처확인_2026-09-24.pdf',
      note: '제재 명단과 신문 검색으로 확인함. 10월 초에 학교장이 바뀌어 공직자 관련을 다시 보려고 다음 확인일을 앞당김', by: 'u_seoyul_ban', at: '2026-09-24 11:00' },
    { id: 'CK-0003', customerId: 'C-0019', bizNo: '124-81-56736', name: '가람전자', why: ['INDIRECT'], on: '2026-10-18', next: '2027-10-18',
      result: 'ISSUE', risk: 'HIGH', sanction: 'NONE', media: 'HIT', owner: 'OK', official: 'NONE', file: '가람전자_거래처확인_2026-10-18.pdf',
      note: '총판 계약 기안 뒤 처음 확인. 지역 입찰 담합 의혹 보도가 있어 사실을 확인할 때까지 보류함', by: 'u_seoyul_ban', at: '2026-10-18 15:00' },
  ];
  // 보류(C-16): kind CUSTOMER 거래처(customerId, bizNo, name) 또는 BUNDLE 계약 묶음(bundleId, 원계약 번호)
  //   reason: 거는 사유 / remediationId: 관련 개선 과제(선택) / by, at: 건 사람과 때 / releasedAt, releasedBy, releaseReason: 푼 때(풀면 그 줄에 남김)
  const HOLDS = [
    { id: 'HD-0001', kind: 'CUSTOMER', customerId: 'C-0019', bizNo: '124-81-56736', name: '가람전자', bundleId: null,
      reason: '거래처 확인에서 부정적 보도(지역 입찰 담합 의혹)가 나와 사실을 확인할 때까지 새 기안과 남은 결재를 멈춤', remediationId: 'RM-0003',
      by: 'u_seoyul_ban', at: '2026-10-18 16:30', releasedAt: null, releasedBy: null, releaseReason: '' },
    // 기획자 결정 2026-11-03(CTL-79) 시연: 하루 걸었다가 푼 계약 묶음 보류. 걸 때와 풀 때 이도윤(영업대표)과 최민준(영업 리더, ③ 차례)에게 이메일(MAIL_SAMPLES HOLD_RELEASE)
    { id: 'HD-0002', kind: 'BUNDLE', customerId: null, bizNo: '', name: '이음병원', bundleId: '2604CL001',
      reason: '무상 충전 수량을 계약 밖의 다른 기관에 쓴다는 제보가 있어 사실을 확인할 때까지 새 기안과 남은 결재를 멈춤', remediationId: null,
      by: 'u_seoyul_ban', at: '2026-10-18 17:30', releasedAt: '2026-10-19 09:40', releasedBy: 'u_seoyul_ban',
      releaseReason: '고객지원의 사용 기록으로 이음병원 안에서만 쓴 것을 확인함(확인 자료 첨부)' },
  ];
  // 개선 과제(C-16): 상태 열림 → 조치 중 → 효과 확인 → 끝남. 효과가 없으면 효과 확인에서 조치 중으로 되돌림
  //   source: 찾은 곳 / found: 찾은 날 / cause 원인, action 조치, owner 책임자, due 기한 / effect 효과 확인, evidence 끝낸 증거(끝낼 때 꼭)
  //   holdId: 관련 보류(선택) / history: 상태를 바꾼 기록 [{ at, by, to, note, set }] 쌓기만 함. 기한과 책임자를 바꿔도 한 줄
  const REMEDIATION = {
    STATE: { OPEN: '열림', DOING: '조치 중', VERIFY: '효과 확인', DONE: '끝남' },
    SOURCE: { CUSTOMER_CHECK: '거래처 확인', DISCOUNT: '할인 예외 점검', OPP: '영업기회 대사', SEAL: '인장 기록 대사', CONFIG: '설정 변경 확인',
      LOG: '접속 기록 점검', CLOSE: '기간 마감 점검', EXPIRY: '만료 예정 확인', APPROVAL: '결재 중 발견', AUDIT: '감사', REPORT: '신고', OTHER: '그 밖' },
  };
  const REMEDIATIONS = [
    { id: 'RM-0001', title: '퇴사자 계정이 퇴사 뒤 이틀 동안 사용 중으로 남음', source: 'LOG', found: '2026-10-05',
      cause: '인사 담당의 퇴사 통보가 퇴사 다음 날 와서, 관리자가 그다음 날 사용 중지함. 퇴사일 전에 관리자에게 알리는 절차가 없었음',
      action: '인사 담당이 퇴사는 퇴사일 사흘 전까지, 이동과 입사는 그날 전에 관리자에게 알리고 관리자는 그날 반영함',
      owner: 'u_admin', due: '2026-10-31', state: 'DONE', holdId: null,
      effect: '10월 인사 이동, 리더 발령, 입사 4건이 모두 알린 날 반영된 것을 관리자 변경 이력(10-12, 10-15, 10-16)으로 확인함',
      evidence: '인사_변경_알림_절차_2026-10.pdf', by: 'u_seoyul_ban', at: '2026-10-05 16:00',
      history: [
        { at: '2026-10-05 16:00', by: 'u_seoyul_ban', to: 'OPEN', note: '9월 기록 점검(정보보호)에서 받은 일을 기록함' },
        { at: '2026-10-06 10:00', by: 'u_seoyul_ban', to: 'DOING', note: '관리자와 인사 담당이 알림 절차를 정하기 시작함' },
        { at: '2026-10-09 14:00', by: 'u_seoyul_ban', to: 'VERIFY', note: '알림 절차를 정해 인사 담당과 관리자에게 알림. 10월 인사 변경으로 효과를 봄' },
        { at: '2026-10-17 11:00', by: 'u_seoyul_ban', to: 'DONE', note: '효과를 확인해 끝냄', set: { effect: '10월 인사 이동, 리더 발령, 입사 4건이 모두 알린 날 반영된 것을 관리자 변경 이력(10-12, 10-15, 10-16)으로 확인함', evidence: '인사_변경_알림_절차_2026-10.pdf' } },
      ] },
    { id: 'RM-0002', title: '자동갱신 계약의 해지 통지 기한을 연장 검토 없이 넘김(한결대학교 2511CL001)', source: 'EXPIRY', found: '2026-10-08',
      cause: '해지 통지 기한 이메일이 영업대표에게만 가고, 영업대표가 휴가 중이라 놓침. 유닛 리더는 알지 못함',
      action: '유닛 리더도 통지 기한 7일 전에 이메일을 받게 하고, 통지 기한이 지난 계약을 영업지원이 매주 만료 예정 화면에서 봄',
      owner: 'u_jihoon_eom', due: '2026-11-15', state: 'DOING', holdId: null, effect: '', evidence: '', by: 'u_seoyul_ban', at: '2026-10-08 10:30',
      history: [
        { at: '2026-10-08 10:30', by: 'u_seoyul_ban', to: 'OPEN', note: '만료 예정 화면에서 통지 기한이 지난 계약을 찾아 기록함' },
        { at: '2026-10-13 09:40', by: 'u_seoyul_ban', to: 'DOING', note: '영업지원 리더가 매주 보기를 시작함. 리더 알림은 결재선 규칙의 알림 일수로 정할 예정' },
      ] },
    { id: 'RM-0003', title: '간접 거래처를 기안 전에 확인하지 않아 부정적 보도를 기안 뒤에 알게 됨(가람전자)', source: 'CUSTOMER_CHECK', found: '2026-10-18',
      cause: '거래처 확인이 없어도 계약 등록에서 경고만 하고, 영업이 확인을 요청하지 않은 채 기안함',
      action: '보도 내용의 사실을 확인하고, 간접 거래처는 첫 기안 전에 확인을 요청하도록 영업에 알림. 한 분기 운영해 보고 막기로 올릴지 정함',
      owner: 'u_seoyul_ban', due: '2026-11-13', state: 'OPEN', holdId: 'HD-0001', effect: '', evidence: '', by: 'u_seoyul_ban', at: '2026-10-18 16:20',
      history: [{ at: '2026-10-18 16:20', by: 'u_seoyul_ban', to: 'OPEN', note: '거래처 확인(CK-0003)에서 찾아 기록함' }] },
  ];
  // 위 기록과 같은 관리자 변경 이력 줄(영역 COMPLIANCE). 시연으로 남긴 것은 common.js가 같은 모양으로 더함
  (function () {
    const who = function (id) { return USERS[id] ? USERS[id].dept + ' ' + USERS[id].name : id; };
    const pick = function (it, v) { return (it.options.filter(function (o) { return o[0] === v; })[0] || [v, v])[1]; };
    CUSTOMER_CHECKS.forEach(function (r) {
      ADMIN_LOG.push({ at: r.at, by: r.by, area: 'COMPLIANCE', target: r.name + ' (' + r.bizNo + ')',
        change: '거래처 확인(' + r.id + '): ' + CUSTOMER_CHECK.RESULT[r.result] + ', 위험 ' + CUSTOMER_CHECK.RISK[r.risk] + '. ' +
          CUSTOMER_CHECK.ITEMS.map(function (it) { return it.label + ' ' + pick(it, r[it.key]); }).join(', ') +
          '. 확인한 날 ' + r.on + ', 다음 확인일 ' + r.next + ', 증빙 ' + r.file, reason: r.note });
    });
    HOLDS.forEach(function (h) {
      const target = h.kind === 'CUSTOMER' ? '거래처 ' + h.name + ' (' + h.bizNo + ')' : '계약 묶음 ' + h.bundleId;
      ADMIN_LOG.push({ at: h.at, by: h.by, area: 'COMPLIANCE', target: target, change: '보류 걸기(' + h.id + ')' + (h.remediationId ? ', 개선 과제 ' + h.remediationId : ''), reason: h.reason });
      if (h.releasedAt) ADMIN_LOG.push({ at: h.releasedAt, by: h.releasedBy, area: 'COMPLIANCE', target: target, change: '보류 풀기(' + h.id + ')', reason: h.releaseReason });
    });
    REMEDIATIONS.forEach(function (r) {
      r.history.forEach(function (x, i) {
        ADMIN_LOG.push({ at: x.at, by: x.by, area: 'COMPLIANCE', target: r.id + ' ' + r.title,
          change: i === 0 ? '개선 과제 기록: 책임자 ' + who(r.owner) + ', 기한 ' + r.due : '상태: ' + REMEDIATION.STATE[r.history[i - 1].to] + ' → ' + REMEDIATION.STATE[x.to] +
            (x.set && x.set.evidence ? ', 끝낸 증거 ' + x.set.evidence : ''),
          reason: i === 0 ? r.cause : x.note + (x.set && x.set.effect ? '. 효과 확인: ' + x.set.effect : '') });
      });
    });
  })();

  return { TODAY, BRAND, ROLES, ROLE_AREAS, ROLE_SHORT, ROLE_AREA, ROLE_BASE, STEP_LEADS, APPROVER_ROLES, USERS, DEMO_PERSONA, STATUS, KINDS, SERVICES, METHODS, SETTLEMENTS, END_USER_PENDING, PRICE_BOOK, STEPS, REVIEW_GROUPS, POST_GROUPS, PROCESS_ROLES, STEP_ASSIGNEE, APPROVAL_STATE, APPROVAL_ACTIONS, SEAL_CHECKS, SIDE_DEAL_CHECK, SIGNED_CHECKS, SIGNED_MISMATCH, REVIEW_CHECKS, SUPPLEMENT_ITEMS, OPS_CHECKS, OPS_CHECKS_END, OPS_CHECKS_EXTEND, AFTERCARE_TYPES, FILE_KINDS, CONTRACTS, ALERT_RULES, ACCOUNT_STATUS, ACCOUNTS,
    // 기획자 결정 2026-11-02: 영업 임원 승인 기준(E-3), 만료 처리와 유예(A-10, A-11), 견적서로 계약서를 대신함(B-5)
    PRICE_RULES, PRICE_RULE_CHANGES, RULE_BASIS /* E-3 위임전결 근거 */, EXPIRY_RULES, QUOTE_INSTEAD, QUOTE_INSTEAD_CHECKS,
    ACCT_KINDS, // 기획자 결정 2026-11-02 B-6: 체크리스트 4번 조건의 종류
    INTEREST_CHECK, SPLIT_CHECK, RECENT_SAME, ANTI_BRIBE, SIGN_DATE_CHECK, // 기획자 결정 2026-11-02 결재 창 확인(C-14, E-2, C-15, B-8)
    ROLE_LIMITS, ROLE_GRANTS, ROLE_CONFLICTS, // 기획자 결정 2026-11-02: 감사 열람의 끝나는 날과 준 기록(C-2), 겹치면 안 되는 역할 조합(C-5)
    CHANGE_TYPES, CHANGE_RULES, OPS_CHECKS_PERIOD, TEAM_LEADERS, OWNER_CHANGES /* 2026-11-03 C-44 영업대표 바꾼 기록 */,
    PRODUCTS, FEATURES, TEMPLATES, PRICE_ROWS, currentPrices, CUSTOMERS, QUOTE_RULES, QUOTES, BIZ_REGISTRY, BIZ_REGISTRY_INFO, NTS_STATUS, CODE_GROUPS, CODES, DELEGATIONS, ASSIGNEE_CHANGES, ADMIN_LOG, RESTRICT_LOG,
    LOG_REVIEWS, ACCESS_REVIEWS, SEC_ALERT_KINDS, SEC_ALERTS, CLOSE_CHECKS /* B-9 기간 마감 점검 확인 */, EXPORT_LOG /* C-3 꺼낸 기록 */, DISCOUNT_REVIEWS /* C-9 할인 예외 점검 기록 */, NOTICE_KINDS, RELEASE_PARTS, NOTICES, EMAIL_TYPES,
    OBLIGATION_KINDS, OBLIGATION_WHEN, OBLIGATION_PRESETS, OBLIGATIONS, SERVICE_START_MONTH,
    COMPANY, OPP_SAMPLE, OPP_RECON, SEAL_RECON, // 기획자 결정 2026-11-02 E-9 회사 설정, E-1 ② 영업기회 대사, E-7 ③ 인장 기록 대사
    CUSTOMER_CHECK, CUSTOMER_CHECKS, HOLDS, REMEDIATION, REMEDIATIONS }; // 기획자 결정 2026-11-02 C-13 거래처 확인, C-16 보류와 개선 과제
})();
