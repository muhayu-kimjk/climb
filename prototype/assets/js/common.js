/* =====================================================================
 * 공통 스크립트 (common.js) → window.CLIMB (화면 코드에서는 C)
 * ---------------------------------------------------------------------
 * - 모든 화면이 같이 쓰는 기능: 헤더, 메인 메뉴, 푸터 그리기, 날짜와 금액 표시, 결재 흐름 계산,
 *   열람 권한 판단, 시연용 역할 전환.
 * - 프로토타입에서는 헤더와 푸터를 이 파일이 그려 넣습니다(화면마다 복사하지 않기 위해).
 *   실제 시스템에서는 개발팀이 쓰는 프레임워크의 공통 레이아웃(템플릿)으로 옮기면 됩니다.
 * - mock-data.js 다음에 불러와야 합니다. 화면 코드는 C.init()으로 시작합니다(맨 아래 "화면 시작").
 *
 * 차례 (위에서 아래 순서. 각 묶음은 "---------- 이름 ----------" 주석으로 시작)
 *   메뉴 구조 → 아이콘과 시스템 이름 → 시연용 역할 → 날짜와 금액 표시 → 계약과 결재 이름
 *   → 표준계약서와 판 → 사업자등록번호 → 영업기회번호
 *   → 결재 흐름 계산(체크리스트로 결재선, 결재 기록을 차례로 다시 적용해 지금 상태: reviewRoute, buildReview)
 *   → 열람 권한(canView, 지정 열람자) → 처리 대기 목록 → 시연 기록 → 견적서 → 체결 후 의무 → 관리자 설정(applyAdmin)
 *   → 계약 묶음(bundleOf, 만료 예정, 해지 통지 기한) → HTML 조각 → 헤더, 메뉴, 푸터 그리기 → 메뉴 검색 → 휴대폰 전체 메뉴판
 *   → 안내 메시지와 확인 창 → 입력 칸 → 쪽 번호 → 관리자 화면 부품 → 워터마크 → 날짜 입력과 달력 → 표 머리글 정렬
 *   → 화면 시작(init)과 내보내기   (v0.63: 견적서, 메뉴 검색, 휴대폰 전체 메뉴판, 표 머리글 정렬을 더하고 v0.60에 없앤 "맨 위로"를 뺌)
 * 불러올 때 한 번 하는 일: 시연 기록 다시 적용(시연 기록 묶음), 관리자 설정 적용(applyAdmin 뒤 buildReview)
 * ===================================================================== */
window.CLIMB = (function () {
  const D = window.CLIMB_DATA;
  const ROLE_KEY = 'climb.demoRole';

  /* ---------- 메뉴 구조 (docs/02_화면목록.md 1. 메뉴 구조, REQ-UI-14) ----------
   * 개요 → 계약 등록 → 계약 현황 → 보관함 (관리자 메뉴는 관리자에게만 맨 뒤에)
   * roles: 이 메뉴(또는 하위 메뉴)가 보이는 역할. 없으면 전체에게 보임.
   *        최고관리자(SUPER)는 roles와 상관없이 모든 메뉴를 봅니다. (v0.16)
   *        리더와 임원(영업지원 리더, 정보보호 리더, 고객지원 리더, 재무 리더, 재무 임원)은 그 분야 담당자의 메뉴를 함께 봅니다(ROLE_BASE, v0.29)
   * scr  : 화면 ID. href가 없으면 아직 시안을 만들지 않은 화면입니다. */
  const MENU = [
    { label: '개요', scr: 'SCR-01', href: 'index.html' },
    // 견적(v0.61 기획자 요청: 개요 옆): 시스템의 제품과 가격 기준으로 견적서를 만들고 출력. 출력 기록이 남음. 계약과 이어지지 않음(REQ-QUO)
    //   볼 수 있는 사람은 가격 기준을 보는 사람과 같음(영업과 영업 리더, 영업 임원, 영업지원, 관리자. REQ-SCOPE-02). 새 견적은 영업 담당자만
    { label: '견적', roles: ['SALES', 'HEAD', 'EXEC', 'SALES_ADMIN', 'ADMIN'], children: [
      { label: '새 견적', scr: 'SCR-15', href: 'quote.html', roles: ['SALES'] },
      { label: '견적 목록', scr: 'SCR-16', href: 'quotes.html' },
    ] },
    // 계약 등록: 내용 작성과 기안 (REQ-FLOW-14)
    { label: '계약 등록', roles: ['SALES'], children: [
      { label: '새 계약 등록', scr: 'SCR-11', href: 'new-contract.html' },
      { label: '내 등록 목록', scr: 'SCR-12', href: 'my-contracts.html' },
    ] },
    // 계약 현황: 검토와 체결이 진행 중인 계약 (REQ-FLOW-03~05)
    { label: '계약 현황', children: [
      { label: '전체 진행 현황', scr: 'SCR-20', href: 'progress.html' },
      // 검토 대기: ②~⑤ 결재 역할과 ⑥ 총무, ⑧ 영업지원의 차례 (v0.23). 재무는 영업지원이 기안한 계약의 ②, ⑧을 대신 (REQ-AUTH-16, v0.58)
      { label: '검토 대기', scr: 'SCR-21', href: 'review-queue.html', roles: D.APPROVER_ROLES.concat(['GA', 'FINANCE']) },
      { label: '검토 완료', scr: 'SCR-22', href: 'review-done.html', roles: D.PROCESS_ROLES },
      // 체결 대기: 영업이 내 계약의 체결 진행(⑥~⑧)을 보고 ⑦ 체결본을 올림 (REQ-SIGN-07)
      { label: '체결 대기', scr: 'SCR-31', href: 'signing.html', roles: ['SALES'] },
      // 운영 검토 대기: ⑨ 고객지원 운영 적용, ⑩ 재무 확인 (REQ-SIGN-08)
      { label: '운영 검토 대기', scr: 'SCR-34', href: 'ops-queue.html', roles: ['CEM', 'FINANCE'] },
    ] },
    // 보관함: 반려, 승인, 체결된 모든 계약을 묶음마다 (REQ-FLOW-15~16, REQ-ARC-01)
    //   계약 상세(SCR-42), 해지 기안(SCR-13), 연장 검토(SCR-44)는 메뉴 없이 계약 상세, 만료 예정에서 들어감
    { label: '보관함', children: [
      { label: '전체 계약', scr: 'SCR-41', href: 'contracts.html' },
      { label: '만료 예정 계약', scr: 'SCR-43', href: 'expiring.html' },
      // 의무 관리(v0.53 기획자 결정): 체결 후 의무(보안 의무, SLA, 청구 일정)를 기한과 맡은 분야로. 모두 봄(열람 제한 건은 고객사 가림)
      { label: '의무 관리', scr: 'SCR-48', href: 'obligations.html' },
      // 표준계약서(v0.53 기획자 요청): 모두가 지금 판을 보고 내려받음. 새 판은 법무, 관리자, 최고관리자가 올림
      { label: '표준계약서', scr: 'SCR-45', href: 'templates.html' },
      // 통계와 보고서(v0.53 기획자 요청): 체결 금액과 건수, 결재 단계마다 걸린 날, 체크리스트 예외. 모두 봄(열람 제한 건은 빼고 셈)
      { label: '통계와 보고서', scr: 'SCR-46', href: 'stats.html' },
    ] },
    // 관리자 메뉴는 관리자(와 최고관리자)에게만 보임 (REQ-AUTH-02)
    //   접속 기록 점검(SCR-57)만 정보보호 담당자와 리더가 씀. 관리자가 자기 작업 기록을 스스로 점검하지 않게
    //   관리자에게는 보이지 않음 (REQ-SEC-05, 06, 기획자 결정 v0.25)
    //   가격 기준 관리(SCR-54)는 영업지원(세일즈어드민)도 열어 봄(보기만, 기획자 결정 v0.58 C-34)
    { label: '관리자', roles: ['ADMIN', 'PRIVACY', 'SALES_ADMIN'], children: [
      { label: '사용자 권한 관리', scr: 'SCR-51', href: 'admin-users.html', roles: ['ADMIN'] },
      { label: '결재선 규칙', scr: 'SCR-52', href: 'admin-rules.html', roles: ['ADMIN'] },
      { label: '열람 제한 관리', scr: 'SCR-53', href: 'admin-restrict.html', roles: ['ADMIN'] },
      { label: '가격 기준 관리', scr: 'SCR-54', href: 'admin-prices.html', roles: ['ADMIN', 'SALES_ADMIN'] },
      // 제품과 기능 관리 (v0.47 기획자 요청, v0.49 제품 → 기능 두 단계): 관리자와 최고관리자가 제품과 그 기능을 넣고 고침. 가격은 가격 기준 관리
      { label: '제품과 기능 관리', scr: 'SCR-58', href: 'admin-products.html', roles: ['ADMIN'] },
      { label: '거래처 관리', scr: 'SCR-55', href: 'admin-customers.html', roles: ['ADMIN'] },
      { label: '코드 관리', scr: 'SCR-56', href: 'admin-codes.html', roles: ['ADMIN'] },
      { label: '접속 기록 점검', scr: 'SCR-57', href: 'admin-logs.html', roles: ['PRIVACY'] },
    ] },
    // 공지사항: 공지와 릴리즈를 한 게시판에 (v0.45 기획자 결정: 주 메뉴 맨 끝). 읽기는 모두, 쓰기는 관리자와 최고관리자
    { label: '공지사항', scr: 'SCR-91', href: 'notices.html' },
  ];
  // 메뉴 검색(v0.60 기획자 요청)에서 메뉴 이름 말고도 찾을 수 있게 하는 말: 그 화면에서 하는 일
  const MENU_KEYWORDS = {
    'SCR-01': '홈 대시보드 첫 화면 처음',
    'SCR-11': '기안 신규 계약서 작성 새로',
    'SCR-15': '견적서 만들기 견적 작성 출력 단가 가격 엑셀',
    'SCR-16': '견적 이력 출력 기록 견적서 판',
    'SCR-12': '내 계약 임시 저장 반려 보완 재기안',
    'SCR-20': '진행 결재 단계 현재',
    'SCR-21': '결재 승인 반려 내 차례 대기 일수',
    'SCR-22': '처리한 결재 승인 완료',
    'SCR-31': '날인 인장 체결본 등록',
    'SCR-34': '운영 적용 재무 확인',
    'SCR-41': '계약 목록 계약 상세 보관 해지 변경',
    'SCR-43': '만료 연장 갱신 해지 통지 기한',
    'SCR-48': '체결 후 의무 SLA 청구 보안 기한',
    'SCR-45': '계약서 양식 템플릿 판',
    'SCR-46': '통계 보고서 금액 건수 그래프',
    'SCR-51': '사용자 계정 권한 역할 조직',
    'SCR-52': '결재선 담당자 대리 리더',
    'SCR-53': '열람 제한 지정 열람자',
    'SCR-54': '가격 단가 할인율 한도',
    'SCR-58': '제품 기능 서비스',
    'SCR-55': '거래처 고객사 사업자등록번호',
    'SCR-56': '코드 조직 서비스',
    'SCR-57': '접속 기록 로그 점검',
    'SCR-91': '공지 릴리즈 업데이트 바뀐 것',
    'SCR-90': '도움말 사용법 가이드 업무 흐름',
    'SCR-93': '내 정보 이메일 알림 설정 화면 밝기 다크모드',
  };

  /* ---------- 아이콘 (선 아이콘, 글자색을 따라감) ---------- */
  const ICON_PATHS = {
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    check: '<circle cx="12" cy="12" r="10"/><path d="m8 12.5 2.8 2.8L16.5 9.5"/>',
    external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    print: '<path d="M6 9V3h12v6"/><rect x="6" y="14" width="12" height="7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>', // 견적서 출력(v0.61)
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
    // 휴대폰 전체 메뉴 단추(v0.60): 줄 세 개. 메뉴판 닫기는 panelClose(→|)
    menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
    panelClose: '<path d="M4 12h12"/><path d="m11 7 5 5-5 5"/><path d="M20 5v14"/>', // 메뉴판 닫기(오른쪽으로 접기)
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  };
  // 계정 아이콘 (v0.61 기획자 요청): 로그인하면 메뉴판의 "내 계정"과 같은 사람 아이콘(user, 선만. 처음 시안의 초록으로 칠한 동그라미는 기획자 요청으로 뺌)
  //   로그인 안 하면 동그라미 안의 사람(선만, 회색). 모양과 색이 함께 달라 색만으로 구분하지 않음. 색은 CSS(.acc-btn)
  function accountIcon(signedIn) {
    return signedIn ? icon('user')
      : '<svg class="icon icon-account" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="9.5" r="3.2"/><path d="M6.1 18.3c1.4-2.2 3.4-3.3 5.9-3.3s4.5 1.1 5.9 3.3"/></svg>';
  }
  function icon(name, size) {
    const cls = 'icon' + (size ? ' icon--' + size : '');
    return '<svg class="' + cls + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON_PATHS[name] + '</svg>';
  }

  // 로고 글자 (REQ-NAME-01~06): [무하유 심볼] climb. 헤더와 푸터가 씀(둘째 줄 한글 이름, 푸터 셋째 줄 영문 이름은 그리는 곳에서)
  //   이름 climb은 로고와 브라우저 탭에만 쓰고 화면 글에는 쓰지 않음(필요하면 "시스템"). 로그인 화면은 로고 글자 없이 한글, 영문 이름
  //   opt.mark: 앞에 심볼(파비콘과 같은 파일)
  function brandTitleHtml(opt) {
    opt = opt || {};
    return (opt.mark ? '<img class="brand-mark" src="assets/img/favicon.svg" alt="" aria-hidden="true">' : '') +
      '<span class="brand-name">' + esc(D.BRAND.name) + '</span>';
  }

  // 여러 정보를 한 줄에 나열할 때 쓰는 묶음. 글자 '·' 대신 얇은 세로선으로 구분합니다. (REQ-UI-08)
  // items: 이미 안전하게 처리(esc)된 HTML 조각 목록. 빈 값은 빼고 표시합니다.
  //   항목이 [이름, 값] 짝이면 이름(정해진 말)과 값(바뀌는 데이터)을 다른 모양으로 (v0.55 기획자 원칙, REQ-UI-32)
  //   예: C.meta([['올린 일시', '2026-10-22 23:59'], ['쓴 사람', '경영지원유닛 원지안']]), 목록 위 건수 ['진행 중', '3건']
  function meta(items) {
    return '<span class="meta-list"><span class="meta-list-in">' +
      items.filter(Boolean).map(function (it) {
        return Array.isArray(it) ? '<span><span class="meta-key">' + it[0] + '</span> <span class="meta-val">' + it[1] + '</span></span>' : '<span>' + it + '</span>';
      }).join('') +
    '</span></span>';
  }

  /* ---------- 시연용 역할 (프로토타입 전용) ----------
   * 주소 뒤 ?role=LEGAL 처럼 붙이거나, 화면 위 검은 띠(시연용 역할 전환)에서 바꿉니다.
   * 실제 시스템에서는 로그인한 사용자의 역할을 서버에서 받아옵니다. */
  function getRole() {
    const fromUrl = new URLSearchParams(location.search).get('role');
    if (fromUrl && D.ROLES[fromUrl]) { saveRole(fromUrl); return fromUrl; }
    try {
      const saved = localStorage.getItem(ROLE_KEY);
      if (saved && D.ROLES[saved]) return saved;
    } catch (e) { /* 저장소를 못 쓰는 환경이면 기본 역할 사용 */ }
    return 'SUPER'; // 기본은 최고관리자: 화면을 최고관리자 기준으로 먼저 만듦 (v0.16)
  }
  function saveRole(role) {
    try { localStorage.setItem(ROLE_KEY, role); } catch (e) { /* 무시 */ }
  }
  function currentUser() {
    const role = getRole();
    const id = D.DEMO_PERSONA[role];
    // base: 메뉴와 화면을 정할 때 쓰는 역할. 리더와 임원은 그 분야 담당자의 화면을 함께 씀 (v0.29)
    return Object.assign({ id: id }, D.USERS[id], { role: role, base: D.ROLE_BASE[role] || role });
  }
  // 이 사람이 그 역할(또는 그 역할의 화면을 함께 쓰는 리더, 임원)인지
  function hasRole(user, roles) {
    return roles.indexOf(user.role) > -1 || roles.indexOf(user.base) > -1;
  }

  /* ---------- 날짜·금액 표시 ---------- */
  // 'YYYY-MM-DD'와 'YYYY-MM-DD HH:MM' 모두 받음 (날짜 부분만 씀)
  function parseDate(s) {
    const p = String(s).slice(0, 10).split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  const TODAY = parseDate(D.TODAY);
  function daysBetween(from, to) {
    return Math.round((to - from) / 86400000);
  }
  function daysSince(s) { return daysBetween(parseDate(s), TODAY); }
  function daysUntil(s) { return daysBetween(TODAY, parseDate(s)); }
  // 남은 일자 배지 색(만료 임박, 만료 예정): 30일 이내 Pink, 60일 이내 Purple, 그 외 Blue (REQ-DASH-07)
  function ddayTone(d) { return d <= 30 ? 'danger' : d <= 60 ? 'attention' : 'progress'; }
  // 날짜 표기: 'YYYY-MM-DD' 그대로 '2027-01-01' (v0.35 기획자 결정. v0.31의 '2026. 10. 5.'에서 바꿈, 맞춤법 때문에 마침표로 쓸 필요 없음)
  //   빈칸이 없어 날짜 안에서는 줄이 바뀌지 않음. 날짜와 시각 사이, 물결표 뒤에서는 줄이 바뀔 수 있음
  function fmtDate(s) {
    if (!s) return '-';
    const p = String(s).slice(0, 10).split('-');
    return p.length < 3 ? String(s) : p[0] + '-' + String(Number(p[1])).padStart(2, '0') + '-' + String(Number(p[2])).padStart(2, '0');
  }
  // 'YYYY-MM-DD HH:MM(:SS)' → '2026-10-15 09:40'
  function fmtDateTime(s) { return s ? fmtDate(s) + (String(s).length > 10 ? ' ' + String(s).slice(11, 16) : '') : '-'; }
  // 기간: 물결표 앞뒤를 붙여 씀 → '2026-10-24~2027-10-23' (v0.31 물결표, v0.35 날짜 형식)
  //   표 칸이 좁으면 물결표 뒤에서 줄이 바뀌도록 폭 없는 빈칸(ZWSP)을 둠
  function fmtPeriod(a, b) { return fmtDate(a) + '~\u200b' + fmtDate(b); }
  function fmtToday() {
    const w = '일월화수목금토'.charAt(TODAY.getDay());
    return TODAY.getFullYear() + '년 ' + (TODAY.getMonth() + 1) + '월 ' + TODAY.getDate() + '일(' + w + ')';
  }
  // 48000000 → "4,800만 원", 150000000 → "1억 5,000만 원"
  function fmtKRW(n) {
    if (!n) return '금액 없음';
    // 만 원 아래가 있는 작은 금액(예: 건당 8,000원, 15,000원)은 반올림하지 않고 그대로 (v0.57: HR 가격이 건당이라)
    if (n < 100000 && n % 10000) return Number(n).toLocaleString('ko-KR') + '원';
    const eok = Math.floor(n / 100000000);
    const man = Math.round((n % 100000000) / 10000);
    const parts = [];
    if (eok) parts.push(eok.toLocaleString('ko-KR') + '억');
    if (man) parts.push(man.toLocaleString('ko-KR') + '만');
    return parts.join(' ') + ' 원';
  }
  // 28800000 → "28,800,000원" (표의 금액 칸, REQ-UI-17). 큰 금액을 읽기 쉽게 줄일 때는 fmtKRW
  function fmtWon(n) { return Number(n || 0).toLocaleString('ko-KR') + '원'; }

  /* ---------- 계약·결재 관련 ---------- */
  function roleLabel(role) { return D.ROLES[role] || role; }
  // 받침에 맞는 조사를 붙여 돌려줌: josa('연장 검토', '은', '는') → '연장 검토는', josa('재무', '이', '가') → '재무가'
  //   '으로'는 ㄹ 받침 뒤에서 '로' (한글 맞춤법). 글자를 이어 붙여 만드는 문장에 씀 (어문 규범 검토 v0.31)
  function josa(word, withFinal, withoutFinal) {
    const code = String(word).charCodeAt(String(word).length - 1) - 0xAC00;
    const jong = code >= 0 && code < 11172 ? code % 28 : 0;
    const has = withFinal === '으로' ? jong && jong !== 8 : jong;
    return word + (has ? withFinal : withoutFinal);
  }
  // 결재란과 현재 진행 칸에 쓰는 짧은 이름: 담당자는 분야 이름만("영업", "법무"), 리더와 임원은 등급까지("영업 리더")
  function roleShort(role) { return D.ROLE_SHORT[role] || role; }
  function userName(id) { return D.USERS[id] ? D.USERS[id].name : '-'; }
  // 사람 표기: "조직 이름" (님 없이. 예: 경영지원유닛 원지안)
  //   v0.32 영업대표에 처음 씀. v0.50 기획자 요청: 머리글의 내 이름(내 계정 링크)과 개요 인사말("원지안님,")을 빼고는 사람 이름을 모두 이렇게 씀
  //   dept: 그때의 조직(결재 기록의 actorDept 등)을 알면 넘김. 없으면 지금 조직
  function ownerLabel(id, dept) {
    const u = D.USERS[id];
    if (!u) return '-';
    const d = dept != null && dept !== '' ? dept : u.dept;
    return (d ? d + ' ' : '') + u.name;
  }
  // 사람 id로 계정(이메일, 상태, 역할 목록)을 찾음. 이름으로 찾으면 같은 이름이 둘일 때 섞이므로 id로만
  function accountOf(id) { return (D.ACCOUNTS || []).filter(function (a) { return a.id === id; })[0] || null; }

  /* ---------- 표준계약서와 판 (v0.53 기획자 요청, REQ-CHK-09, SCR-45) ----------
   * 그날 쓰던 판: 적용 시작일이 그날 이전인 판 중 가장 늦은 것. 계약에는 기안할 때 고른 표준계약서와 판을 남김
   * 예시 계약처럼 고른 기록이 없으면 서비스로 맞는 표준계약서의 기안일 판으로 봄 [시안] */
  function templateVersionAt(t, day) {
    // 판 번호 순서가 아니라 적용 시작일로 고름: 예정된 판보다 앞선 날짜의 판을 나중에 더해도 맞게 (v0.58 QA)
    return (t.versions || []).filter(function (v) { return v.from <= day; })
      .reduce(function (best, v) { return !best || v.from >= best.from ? v : best; }, null);
  }
  function templateOf(c) {
    // 해지, 운영 변경, 조건 그대로 연장은 계약서를 새로 쓰지 않아 기준 표준계약서가 없음 (v0.58 QA: 표준계약서의 쓴 계약 수에 섞였음)
    if (c.kind === 'TERMINATE' || c.kind === 'CHANGE' || c.renewMode === 'AUTO') return null;
    const pick = c.template || (c.form && c.form.template);
    if (pick && pick.id === 'OWN') return { own: true };
    const day = (c.requestedAt || D.TODAY).slice(0, 10);
    const t = pick ? D.TEMPLATES.filter(function (x) { return x.id === pick.id; })[0]
      : D.TEMPLATES.filter(function (x) { return x.service && (c.services || []).indexOf(x.service) > -1; })[0];
    if (!t) return null;
    const v = pick && pick.no ? t.versions.filter(function (x) { return x.no === pick.no; })[0] : templateVersionAt(t, day);
    return v ? { t: t, v: v } : null;
  }
  function templateLabel(c) {
    const x = templateOf(c);
    return !x ? '-' : x.own ? '상대방 양식(표준계약서 없음)' : x.t.name + ' 판 ' + x.v.no;
  }

  /* ---------- 사업자등록번호 (거래처 검색, v0.32) ----------
   * 형식 000-00-00000, 끝자리는 검증 숫자: 앞 9자리에 1,3,7,1,3,7,1,3,5를 곱해 더하고 9번째 자리 x 5의 십의 자리를 더한 뒤 10에서 뺀 끝자리
   * 실제 시스템은 직접 입력한 번호를 국세청 사업자등록 상태 조회로 계속, 휴업, 폐업까지 확인 [가정] */
  // 표시: 사용자는 숫자만 넣고 화면에는 '-'를 붙여 000-00-00000으로 보여 줌 (v0.34 기획자 결정). 입력 중에도 씀
  function fmtBizNo(v) {
    const d = String(v || '').replace(/[^0-9]/g, '').slice(0, 10);
    return d.length > 5 ? d.slice(0, 3) + '-' + d.slice(3, 5) + '-' + d.slice(5) : d.length > 3 ? d.slice(0, 3) + '-' + d.slice(3) : d;
  }
  function isBizNo(v) {
    const d = String(v || '').replace(/-/g, '');
    if (!/^\d{10}$/.test(d)) return false;
    const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += Number(d[i]) * w[i];
    sum += Math.floor(Number(d[8]) * 5 / 10);
    return (10 - sum % 10) % 10 === Number(d[9]);
  }  // 고유번호(가운데 두 자리 82 비영리법인, 83 국가와 지자체): 학교, 공공기관이 많이 씀. 검증 숫자 규칙이 같은지 공식 문서를 찾지 못해
  //   맞지 않아도 막지 않고 알리기만 함 (v0.39 기획자 결정)
  function isUniqueNo(v) { const d = String(v || '').replace(/-/g, ''); return /^\d{10}$/.test(d) && (d.slice(3, 5) === '82' || d.slice(3, 5) === '83'); }
  // 국세청 상태(가상, v0.39): 'CLOSED' 폐업, 'SUSPENDED' 휴업, '' 계속 사업자. 실제 시스템은 국세청 사업자등록 상태 조회
  function ntsStatus(v) { return (D.NTS_STATUS || {})[String(v || '').replace(/-/g, '')] || ''; }

  // 이 계약을 기안하며 직접 입력해 거래처 목록에 새로 등록한 거래처인지 (v0.63, 통제와 표준 대응표 G-25 ①)
  //   결재 문서에 표시해 ②와 ⑩이 사업자등록번호를 더 살펴보게 함. 시안에서 기안한 계약은 form.customerNew,
  //   예시 계약은 거래처를 등록한 사람과 날이 이 계약의 기안자와 기안일과 같고(기안하면 거래처 목록에 함께 등록됨, REQ-REG-18)
  //   그 번호가 사업자 정보 DB에 없으면(DB에서 고른 것이 아니면) 직접 입력으로 봄. 실제 시스템은 거래처의 등록 경로를 저장(데이터 정의서 6장)
  function isNewCustomer(c) {
    if (c.form && 'customerNew' in c.form) return !!c.form.customerNew;
    const cu = (D.CUSTOMERS || []).filter(function (x) { return x.name === c.counterparty; })[0];
    if (!cu || !c.requestedAt || cu.registeredBy !== c.requesterId || cu.registeredAt !== String(c.requestedAt).slice(0, 10)) return false;
    const no = String(cu.bizNo).replace(/-/g, '');
    return !(D.BIZ_REGISTRY || []).some(function (r) { return String(r.bizNo).replace(/-/g, '') === no; });
  }

  // 거래처 검색: 상호 일부나 사업자등록번호 일부로 우리 거래처(C)와 사업자 정보 DB(R)를 함께 찾음. 거래처를 먼저, 최대 n건
  function searchBusinesses(q, n) {
    const text = String(q || '').trim().toLowerCase();
    const digits = text.replace(/[^0-9]/g, '');
    if (!text) return [];
    const hit = function (name, bizNo) {
      return name.toLowerCase().indexOf(text) > -1 || (digits.length >= 3 && bizNo.replace(/-/g, '').indexOf(digits) > -1);
    };
    // 우리 거래처: 상호나 번호가 맞으면 그 거래처. 기관 이름으로는 찾지 않음
    //   (v0.46 기획자 결정: 기관 또는 부서명은 계약마다 직접 적고 거래처에 목록으로 두지 않음. v0.39의 기관 이름 검색은 없앰)
    const mine = D.CUSTOMERS.filter(function (cu) { return cu.use && hit(cu.name, cu.bizNo); })
      .map(function (cu) { return { kind: 'C', key: 'C:' + cu.id, name: cu.name, bizNo: cu.bizNo }; });
    const known = D.CUSTOMERS.map(function (cu) { return cu.bizNo; });
    const reg = D.BIZ_REGISTRY.filter(function (r) { return known.indexOf(r.bizNo) < 0 && hit(r.name, r.bizNo); })
      .map(function (r) { return { kind: 'R', key: 'R:' + r.bizNo, name: r.name, bizNo: r.bizNo }; });
    return mine.concat(reg).slice(0, n || 8);
  }

  /* ---------- 판다(CRM) 영업기회번호 (기획자 지정 v0.32) ----------
   * 연도 2자리, 월 2자리, 영문 2자리, 일련번호 3자리 (예: 2610SU067). 링크는 https://panda.muhayu.com/sales/opp/번호 */
  const OPP_RE = /^\d{2}(0[1-9]|1[0-2])[A-Z]{2}\d{3}$/;
  function isOppNo(v) { return OPP_RE.test(String(v || '')); }
  function pandaUrl(v) { return 'https://panda.muhayu.com/sales/opp/' + encodeURIComponent(v); }
  function pandaLink(v) {
    return isOppNo(v) ? '<a class="ext-link" href="' + pandaUrl(v) + '" target="_blank" rel="noopener noreferrer">' + esc(v) +
      icon('external', 'sm') + '<span class="sr-only">(판다에서 열기, 새 창)</span></a>' : esc(v || '-');
  }
  // 서비스 이름: 계약명은 따로 두지 않고 고객사와 서비스로 계약을 구분 (v0.12)
  //   codes: ['CK', 'HR'] 같은 서비스 코드 목록 → "CK, HR" (서비스는 대분류 CK, HR, 기타 세 가지, v0.56)
  function serviceLabel(codes) {
    return (codes || []).map(function (s) { return D.SERVICES[s] || s; }).join(', ') || '-';
  }
  /* 제품과 기능 이름 (v0.47 기획자 요청: 제품과 기능을 나눔. v0.49: 플랜을 없애고 제품 → 기능 두 단계, 가격은 기능마다)
   *   화면에는 "프리즘 결함검사"처럼 제품과 기능을 이어서 보임. r은 가격 기준 줄이나 { product, feature }
   *   프로토타입은 지금 이름으로 보여 줌. [가정] 실제 시스템은 기안할 때의 제품, 기능 이름을 계약 줄에 함께 저장 */
  function productName(id) { const p = findBy(D.PRODUCTS, 'id', id); return p ? p.name : (id || ''); }
  function featureName(id) { const f = findBy(D.FEATURES, 'id', id); return f ? f.name : (id || ''); }
  // 기능 이름이 제품 이름으로 시작하면(예: 몬스터 > 몬스터 A) 제품 이름을 한 번만 (v0.58: 서비스 정리표의 기능 이름)
  function featureLabel(r) {
    if (!r) return '';
    const pn = productName(r.product), fn = featureName(r.feature);
    return (fn && fn.indexOf(pn) === 0 ? fn : pn + ' ' + fn).trim();
  }
  // 고르는 칸에 쓰는 기능 이름: 기능이 따로 없는 제품의 기능은 이름이 비어 있어 "기능 구분 없음" (v0.56 서비스 정리표)
  function featureText(id) { return featureName(id) || '기능 구분 없음'; }
  // '② 체크리스트 검토'
  // c를 주면 운영 변경의 ⑨는 "운영 변경"으로 (v0.26), 해지의 ⑨는 "운영 종료", 조건 그대로 연장의 ⑨는 "기간 연장"으로 (결재 문서 단추, 전체 진행 현황과 같게)
  function stepLabel(code, c) { const s = D.STEPS[code]; if (c && code === 'S09' && c.kind === 'CHANGE') return s.no + ' 운영 변경'; if (c && code === 'S09' && c.kind === 'TERMINATE') return s.no + ' 운영 종료'; if (c && code === 'S09' && c.renewMode === 'AUTO') return s.no + ' 기간 연장'; return s ? s.no + ' ' + s.name : code; }

  /* ---------- 결재 흐름 계산 (요구사항 정의서 3.5, REQ-STEP-04, REQ-DOC-06, REQ-SIGN-01~06) ----------
   * 결재 기록(history)을 시간 순서대로 다시 적용해 단계마다 지금 상태(approvals)와 계약 상태를 만듭니다.
   *   - 2단계 계약 검토(②~⑤): 체크리스트 답과 개인정보 처리위탁 계약 여부로 결재선을 정함. 금액 기준 없음 (REQ-CHK-05)
   *     순서: ② → ③ 영업 → ④ 법무와 ⑤ 개인정보 동시 (v0.20)
   *   - 3단계 계약 체결(⑥ 인장 날인 → ⑦ 체결본 등록 → ⑧ 체결본 확인)과 4단계 운영 검토(⑨ 운영 적용 → ⑩ 재무 확인):
   *     생략 없이 하나씩 차례로 (v0.23)
   *   - 앞 묶음이 모두 끝나야 다음 묶음이 차례가 됨
   *   - 반려(②~⑤, ⑥, ⑧): 계약은 반려 상태가 되고 기안자가 다음 차수로 다시 기안
   *   - 다시 등록 요청(⑧): 오탈자나 스캔 문제면 ⑦ 체결본 등록이 다시 차례가 됨 (REQ-SIGN-04)
   *   - 승인 취소(②~⑤만): 그 단계는 다시 차례가 되고, 뒤 단계는 다시 대기가 됨 (기록은 지우지 않음)
   *   - 계약 상태: 검토 중 → (②~⑤ 끝) 체결 대기 → (⑧ 끝) 운영 검토 → (⑩ 끝) 계약 완료
   * 실제 시스템에서는 이 규칙을 서버가 지켜야 합니다. 화면에서만 막으면 우회할 수 있습니다. */
  const REVIEW_ORDER = [].concat.apply([], D.REVIEW_GROUPS);
  const POST_ORDER = [].concat.apply([], D.POST_GROUPS);
  const ALL_GROUPS = D.REVIEW_GROUPS.concat(D.POST_GROUPS);
  const WORKING = ['IN_REVIEW', 'APPROVED', 'OPS_REVIEW']; // 누군가의 차례가 남은 상태
  function groupIndex(code) {
    return ALL_GROUPS.findIndex(function (g) { return g.indexOf(code) > -1; });
  }
  function isReviewStep(code) { return REVIEW_ORDER.indexOf(code) > -1; }
  // 단계가 속한 업무 단계: 2 계약 검토, 3 계약 체결, 4 운영 검토
  function phaseOf(code) { return isReviewStep(code) ? 2 : ['S06', 'S07', 'S08'].indexOf(code) > -1 ? 3 : 4; }
  // 짧은 결재: 해지 기안(-T)과 연장 검토의 "그대로 자동갱신"(-R) (REQ-ARC-06, 07)
  //   ③ 영업 리더 → ④ 법무 → ⑨ 운영(종료, 기간 연장) → ⑩ 재무. ②, ⑤와 ⑥~⑧(날인, 체결본)은 없음
  function isShort(c) { return c.kind === 'TERMINATE' || c.renewMode === 'AUTO'; }
  /* 운영 변경(-C): 계약서는 그대로 두고 계약 기간을 바꾸거나 수량을 추가 충전 (REQ-CHG-06~11, 재무 문서 반영 v0.26)
   *   [③ 영업 검토: 기간이 2개월 넘게 바뀌거나 무상 충전이 50건을 넘을 때만] → ⑨ 운영 변경 → 끝
   *   ⑨는 기간 변경과 CK 충전은 고객지원, HR 충전은 재무(수불부, 안정화까지). ②, ④~⑧, ⑩은 없음
   *   한 번에 한 가지 변경만 (재무 문서 원칙). 계약서가 바뀌는 변경은 변경 계약(-A)으로 전체 결재 */
  function isChange(c) { return c.kind === 'CHANGE'; }
  function isoDate(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  // n개월 뒤 날짜. 말일이면 그 달의 말일로(6월 30일 + 2개월 = 8월 31일), 없는 날은 그 달 말일로(1월 31일 + 1개월 = 2월 28일)
  function monthsLater(iso, n) {
    const d = parseDate(iso);
    const day = d.getDate(), isLast = day === new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate();
    return isoDate(new Date(d.getFullYear(), d.getMonth() + n, isLast ? last : Math.min(day, last)));
  }
  // 운영 변경에 ③ 영업 검토가 필요한지 [거치는지, 까닭]
  function changeSales(c) {
    const R = D.CHANGE_RULES;
    if (c.changeType === 'PERIOD') {
      const over = c.endDate > monthsLater(c.oldEndDate, R.periodMonths) || c.endDate < monthsLater(c.oldEndDate, -R.periodMonths);
      return over ? [true, '기간이 ' + R.periodMonths + '개월 넘게 바뀜'] : [false, '기간 변경이 ' + R.periodMonths + '개월 이내'];
    }
    if (/_FREE$/.test(c.changeType)) {
      return c.changeQty > R.freeQty ? [true, '무상 충전이 ' + R.freeQty + '건을 넘음'] : [false, '무상 충전 ' + R.freeQty + '건 이내'];
    }
    return [false, '유상 추가 충전은 영업 검토 없음'];
  }
  // [거치는지, 까닭] (2단계 계약 검토만. 3, 4단계는 짧은 결재와 운영 변경이 아니면 생략하는 단계가 없음)
  function reviewRoute(c) {
    if (isChange(c)) {
      return {
        S02: [false, '운영 변경은 체크리스트 검토 없음'], S03: changeSales(c),
        S04: [false, '운영 변경은 법무 검토 없음'], S05: [false, '운영 변경은 개인정보 검토 없음'],
      };
    }
    if (isShort(c)) {
      const what = c.kind === 'TERMINATE' ? '해지 기안' : '연장 검토';
      return {
        S02: [false, josa(what, '은', '는') + ' 체크리스트 검토 없음'], S03: [true, '영업 리더 승인'],
        S04: [true, '법무 승인'], S05: [false, josa(what, '은', '는') + ' 개인정보 검토 없음'],
      };
    }
    const ck = c.checklist || {};
    let sales;
    if (ck.price === 'NO' && ck.cap === 'NO') sales = [true, '할인율 한도를 넘김'];
    else if (ck.price === 'NO') sales = [false, '할인율 한도 이내'];
    else sales = [false, '표준단가표를 적용함'];
    return {
      S02: [true, '어떤 경우에도 생략하지 않음'],
      S03: sales,
      S04: ck.standard === 'NO' ? [true, '표준계약서를 바꿈'] : [false, '표준계약서를 그대로 씀'],
      S05: c.personalData ? [true, '개인정보 처리위탁 계약 있음'] : [false, '개인정보 처리위탁 계약 없음'],
    };
  }
  /* 단계 담당자 (REQ-AUTH-06, 재무 문서 반영 v0.26)
   *   ③ 영업 검토: 기안자 유닛의 영업 리더(TEAM_LEADERS). 리더 본인이 기안한 계약은 영업 임원(STEP_ASSIGNEE.S03)
   *   ⑦ 체결본 등록: 기안한 영업 담당자 / ⑨: 운영 변경의 HR 충전은 재무(⑩ 담당자)
   *   직무 분리: 기안자가 ②, ⑧의 담당자(영업지원)이면 재무 담당자가 대신 검토 (panda 시나리오 10)
   *   at: 그 단계가 차례가 된 일시. 그 뒤에 담당자를 바꿔도 이미 차례인 단계는 그대로 (v0.25) */
  // 기안자의 유닛(조직). ③ 영업 리더를 찾을 때 씀 (v0.29: 영업1~3팀 → 비즈니스1~3유닛)
  function teamOf(userId) { return (D.USERS[userId] || {}).dept || ''; }
  function leaderAt(team, at) {
    let id = D.TEAM_LEADERS[team] || null;
    D.ASSIGNEE_CHANGES.forEach(function (x) { if (x.step === 'S03:' + team && x.at <= at) id = x.to; });
    return id;
  }
  function stepUser(code, c, at) {
    if (code === 'S07') return c.requesterId;
    if (code === 'S03') {
      const lead = leaderAt(teamOf(c.requesterId), at);
      return lead && lead !== c.requesterId ? lead : assigneeAt('S03', at);
    }
    if (code === 'S09' && isChange(c) && /^HR_/.test(c.changeType)) return assigneeAt('S10', at);
    const id = assigneeAt(code, at);
    if ((code === 'S02' || code === 'S08') && id === c.requesterId) return assigneeAt('S10', at);
    return id;
  }
  // 결재란에 보이는 역할: 그 사람이 단계의 역할을 가졌으면 그 역할, 아니면 그 사람의 첫 역할(예: 대신 검토하는 재무, 담당자로 지정된 리더)
  function roleFor(userId, code) {
    const want = D.STEPS[code].role;
    const a = D.ACCOUNTS.filter(function (x) { return x.id === userId; })[0];
    const roles = a ? a.roles : [(D.USERS[userId] || {}).role];
    return roles.indexOf(want) > -1 ? want : roles[0] || want;
  }
  // ⑨ 운영 적용 확인 항목: 계약의 서비스마다 (서비스가 둘 이상이면 서비스 이름을 앞에 붙임)
  //   table: 해지는 OPS_CHECKS_END(닫기), 그대로 자동갱신은 OPS_CHECKS_EXTEND(기간 연장)
  function opsChecks(services, table) {
    const list = services || [];
    return list.reduce(function (out, s) {
      return out.concat(((table || D.OPS_CHECKS)[s] || []).map(function (t) { return (list.length > 1 ? (D.SERVICES[s] || s) + ' ' : '') + t; }));
    }, []);
  }
  // 이 계약의 ⑨ 확인 항목 (v0.41: 금액이 없는 계약은 등록하지 않으므로 따로 두지 않음)
  //   운영 변경: 기간 변경은 OPS_CHECKS_PERIOD, 추가 충전은 충전 수량
  function opsChecksFor(c) {
    if (isChange(c)) {
      if (c.changeType === 'PERIOD') return opsChecks(c.services, D.OPS_CHECKS_PERIOD);
      return /^CK_/.test(c.changeType) ? ['CK 추가 충전 ' + c.changeQty + '건 반영'] : ['수불부에 HR 추가 충전 ' + c.changeQty + '건 반영'];
    }
    if (c.kind === 'TERMINATE') return opsChecks(c.services, D.OPS_CHECKS_END);
    if (c.renewMode === 'AUTO') return opsChecks(c.services, D.OPS_CHECKS_EXTEND);
    return opsChecks(c.services);
  }
  // 계약종류 이름. 연장 검토의 "그대로 자동갱신"은 따로 표시 (REQ-ARC-07)
  function kindLabel(c) {
    if (isChange(c)) return '운영 변경(' + (D.CHANGE_TYPES[c.changeType] || '-') + ')';
    return c.kind === 'RENEW' && c.renewMode === 'AUTO' ? '연장(조건 그대로)' : D.KINDS[c.kind] || '-';
  }
  // 차례일 때 현재 진행 칸에 쓰는 말 (해지와 자동갱신의 ⑨는 운영 종료, 기간 연장)
  function stepIng(c, code) {
    // 누가 하는지는 결재란에 있으므로 하는 일만 씀 (v0.29: CEM 대신 고객지원으로 부르면서 줄임)
    if (code === 'S09' && c.kind === 'TERMINATE') return '운영 종료 중';
    if (code === 'S09' && c.renewMode === 'AUTO') return '기간 연장 중';
    if (code === 'S09' && isChange(c)) return /^HR_/.test(c.changeType) ? '수불부 반영 중' : '운영 변경 중';
    return D.STEPS[code].ing;
  }
  // 'YYYY-MM-DD'에 n일을 더함
  function addDays(iso, n) {
    const d = parseDate(iso);
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  // 이미 진행된 계약의 결재 기록을 날짜에 맞춰 만듦 (시연용 예시 데이터)
  //   2단계: 승인일(approvedAt)에 마지막 검토 승인
  //   3, 4단계: postAt(지금 차례인 단계) 앞 단계까지 만듦. postAt이 없으면 ⑩까지 모두 끝난 계약
  function autoHistory(c) {
    const route = reviewRoute(c);
    const routed = REVIEW_ORDER.filter(function (code) { return route[code][0]; });
    const last = routed[routed.length - 1];
    const round = c.round || 1;
    const list = routed.map(function (code) {
      const at = code === last ? c.approvedAt
        : code === 'S02' ? c.requestedAt.slice(0, 10) + ' 16:00'
        : c.approvedAt.slice(0, 10) + ' 11:00';
      // ④ 법무: 표준계약서를 바꾼 계약은 승인 의견 필수 (v0.27, C-20). 예시 기록에도 의견을 남김
      // ② 체크리스트 검토는 확인 항목을 남김 (v0.63, 표준 대응표 G-05)
      const comment = code === 'S04' && (c.checklist || {}).standard === 'NO'
        ? '바꾼 조항 확인(조항 대비표 참고): ' + ((c.checklist || {}).standardNote || '고객 요청 조항') + '. 회사 책임 범위가 표준과 같아 승인'
        : code === 'S02' ? '확인: ' + D.REVIEW_CHECKS.join(', ') : '';
      return { step: code, action: 'APPROVE', at: at, comment: comment, actorId: stepUser(code, c, at), round: round };
    });
    const d06 = addDays(c.approvedAt, 1);
    const d07 = c.signedAt || addDays(c.approvedAt, 6);
    const d08 = addDays(d07, 1);
    const d09 = addDays(d08, 2);
    const d10 = addDays(d09, 1);
    const post = [
      { step: 'S06', action: 'APPROVE', at: d06 + ' 10:00', comment: '확인: ' + D.SEAL_CHECKS.join(', '), actorId: stepUser('S06', c, d06) },
      // ⑦ ⑧ 확인(v0.61, 표준 대응표 G-06): 계약서 밖 약속 없음, 체결본을 항목별로 맞춰 봄
      { step: 'S07', action: 'REGISTER', at: d07 + ' 14:00', comment: '확인: ' + D.SIDE_DEAL_CHECK.S07, actorId: c.requesterId, fileName: c.counterparty + '_체결본.pdf' },
      { step: 'S08', action: 'APPROVE', at: d08 + ' 11:00', comment: '확인: ' + D.SIGNED_CHECKS.concat([D.SIDE_DEAL_CHECK.S08]).join(', '), actorId: stepUser('S08', c, d08) },
      { step: 'S09', action: 'APPROVE', at: d09 + ' 15:00', comment: '확인: ' + opsChecksFor(c).join(', '), actorId: stepUser('S09', c, d09) },
      { step: 'S10', action: 'APPROVE', at: d10 + ' 16:00', comment: '', actorId: stepUser('S10', c, d10) },
    ].filter(function (h) { return !isShort(c) || h.step === 'S09' || h.step === 'S10'; }); // 짧은 결재는 ⑨, ⑩만
    const order = post.map(function (h) { return h.step; });
    const stop = c.postAt ? order.indexOf(c.postAt) : order.length;
    post.slice(0, stop).forEach(function (h) { h.round = round; list.push(h); });
    return list.concat(c.extraHistory || []);
  }
  function buildReview(c) {
    if (c.status === 'DRAFT') { c.approvals = []; return; }
    // 예시 기록은 처음 한 번만 만들고, 시연으로 더한 기록(시연 기록)은 그 뒤에 이어 붙임
    if (c.autoHistory && !c.autoMade) { c.history = autoHistory(c).concat(c.history || []); c.autoMade = true; }
    c.history = (c.history || []).slice().sort(function (a, b) { return a.at.localeCompare(b.at); });
    const round = c.round || 1;
    const route = reviewRoute(c);
    const short = isShort(c);
    const change = isChange(c);
    const noSign = change ? '운영 변경은 날인과 체결본 없음' : c.kind === 'TERMINATE' ? '해지는 날인과 체결본 없음' : '그대로 연장은 날인과 체결본 없음';
    const NOW = '9999'; // 아직 차례가 오지 않은 단계는 지금 담당자
    const steps = REVIEW_ORDER.concat(POST_ORDER).map(function (code) {
      const review = isReviewStep(code);
      // 짧은 결재와 운영 변경은 ⑥~⑧을 거치지 않음 [가정, C-18 재무 상의 중]. 운영 변경은 ⑩도 없음(재무 문서)
      const skipSign = (short || change) && ['S06', 'S07', 'S08'].indexOf(code) > -1;
      const skipFin = change && code === 'S10';
      const userId = stepUser(code, c, NOW);
      return {
        step: code, role: roleFor(userId, code), phase: phaseOf(code),
        // ⑦ 체결본 등록은 기안한 영업이 함. 나머지는 지금 담당자(차례가 되는 때 다시 정함, 아래 recompute)
        userId: userId,
        state: skipSign || skipFin ? 'SKIPPED' : !review || route[code][0] ? 'WAITING' : 'SKIPPED',
        reason: review ? route[code][1] : skipSign ? noSign
          : skipFin ? (/^HR_/.test(c.changeType) ? '재무가 ⑨에서 반영' : '운영 변경은 재무 확인 없음') : '',
        arrivedAt: null, decidedAt: null, decidedBy: null, onBehalfOf: null, delegationId: null, comment: '', fileName: null,
      };
    });
    const by = {};
    steps.forEach(function (s) { by[s.step] = s; });
    // 앞 묶음이 모두 끝난 묶음까지 차례로 만들고, 그 뒤 묶음은 대기로 되돌림
    //   담당자는 그 단계가 차례가 된 때의 담당자. 결재선 규칙에서 담당자를 바꿔도 이미 차례인 단계는
    //   원래 담당자가 처리하고, 아직 차례가 오지 않은 단계부터 새 담당자에게 감 (기획자 결정 v0.25)
    //   보완 요청 중(hold)에는 모든 차례를 멈추고 기안자가 보완을 마치면 다시 이어 감 (REQ-REV-11, v0.26)
    let hold = null, rejection = null, lastReturn = null, supplement = null;
    function recompute(at) {
      let blocked = !!hold || !!rejection; // 반려(v0.58 QA)나 보완 요청 중이면 모든 차례를 멈춤
      ALL_GROUPS.forEach(function (group) {
        const members = group.map(function (code) { return by[code]; }).filter(function (s) { return s.state !== 'SKIPPED'; });
        members.forEach(function (s) {
          if (blocked) {
            if (s.state === 'PENDING') { s.state = 'WAITING'; s.arrivedAt = null; s.userId = stepUser(s.step, c, NOW); s.role = roleFor(s.userId, s.step); }
          } else if (s.state === 'WAITING') {
            s.state = 'PENDING'; s.arrivedAt = at;
            s.userId = stepUser(s.step, c, at); s.role = roleFor(s.userId, s.step);
          }
        });
        if (members.some(function (s) { return s.state !== 'DONE'; })) blocked = true;
      });
    }
    function review0() { return steps.filter(function (x) { return x.phase === 2; }); }
    recompute(c.requestedAt);
    c.history.filter(function (h) { return (h.round || 1) === round; }).forEach(function (h) {
      // 보완 완료(기안자): 멈춘 결재를 다시 이어 감. 금액이나 체크리스트 답이 바뀌었으면(restart) 계약 검토를 처음부터 다시
      if (h.action === 'RESUBMIT') {
        hold = null; supplement = null;
        if (h.restart) review0().forEach(function (x) {
          if (x.state === 'DONE') { x.state = 'WAITING'; x.decidedAt = null; x.decidedBy = null; x.onBehalfOf = null; x.delegationId = null; x.comment = ''; }
        });
        recompute(h.at);
        return;
      }
      const s = by[h.step];
      if (!s) return;
      if (h.action === 'SUPPLEMENT') {
        // 보완 요청(②~⑤ 결재자): 기안자에게 돌아가 고친 뒤 이 단계부터 이어서 결재
        hold = h.step;
        supplement = { step: h.step, at: h.at, reason: h.comment, by: h.actorId };
        recompute(h.at);
        return;
      }
      if (h.action === 'APPROVE' || h.action === 'REGISTER' || h.action === 'REJECT') {
        s.state = h.action === 'REJECT' ? 'REJECTED' : 'DONE';
        s.decidedAt = h.at; s.decidedBy = h.actorId; s.onBehalfOf = h.onBehalfOf || null; s.delegationId = h.delegationId || null; s.comment = h.comment;
        if (h.fileName) s.fileName = h.fileName;
        if (h.action === 'REJECT') rejection = { step: h.step, role: s.role, at: h.at, reason: h.comment, by: h.actorId };
      } else if (h.action === 'CANCEL') {
        s.state = 'PENDING'; s.decidedAt = null; s.decidedBy = null; s.onBehalfOf = null; s.delegationId = null; s.comment = '';
      } else if (h.action === 'RETURN') {
        // ⑧ 다시 등록 요청: ⑦ 체결본 등록이 다시 차례가 되고 ⑧은 대기로 돌아감
        const s07 = by.S07;
        s07.state = 'PENDING'; s07.arrivedAt = h.at; s07.decidedAt = null; s07.decidedBy = null; s07.onBehalfOf = null; s07.comment = '';
        s.state = 'WAITING'; s.arrivedAt = null;
        lastReturn = { at: h.at, reason: h.comment, by: h.actorId };
      }
      recompute(h.at);
    });
    const review = review0();
    const reviewDone = !rejection && !hold && review.every(function (x) { return x.state === 'DONE' || x.state === 'SKIPPED'; });
    const done = function (code) { return by[code].state === 'DONE'; };
    const fin = function (code) { return by[code].state === 'DONE' || by[code].state === 'SKIPPED'; };
    const lastAt = function (list) { return list.reduce(function (m, x) { return x.decidedAt && x.decidedAt > m ? x.decidedAt : m; }, ''); };
    const post = steps.filter(function (x) { return x.phase > 2; });
    // ⑥~⑩이 모두 끝났거나 생략됨 (운영 변경은 ⑩이 생략이라 ⑨에서 끝남)
    const allPost = post.every(function (x) { return fin(x.step); }) && post.some(function (x) { return done(x.step); });
    // 다시 계산하는 상태 (해지 기안 자신은 끝나면 "해지"가 되므로 함께)
    const live = ['IN_REVIEW', 'SUPPLEMENT', 'REJECTED', 'APPROVED', 'OPS_REVIEW', 'ACTIVE'].concat(c.kind === 'TERMINATE' ? ['TERMINATED'] : []);
    if (live.indexOf(c.status) > -1) {
      c.status = rejection ? 'REJECTED' : hold ? 'SUPPLEMENT' : !reviewDone ? 'IN_REVIEW'
        : allPost ? (c.kind === 'TERMINATE' ? 'TERMINATED' : 'ACTIVE') : fin('S08') ? 'OPS_REVIEW' : 'APPROVED';
      // 승인일: 2단계 마지막 검토가 승인된 때. 검토 단계가 모두 생략된 운영 변경은 기안한 때
      c.approvedAt = reviewDone ? (lastAt(review) || c.requestedAt) : null;
    }
    c.signedAt = done('S07') ? by.S07.decidedAt : null;        // 체결본을 등록한 때
    c.completedAt = allPost ? lastAt(post) : null;             // 계약 완료(보관함)된 때
    c.supplement = supplement;                                 // 지금 보완 요청 중이면 그 내용
    c.approvals = steps;
    c.rejection = rejection;
    c.lastReturn = lastReturn;
    if (rejection) { c.rejectedAt = rejection.at; c.rejectReason = rejection.reason; }
  }

  function pendingSteps(c) { return (c.approvals || []).filter(function (a) { return a.state === 'PENDING'; }); }
  function currentStep(c) { return pendingSteps(c)[0] || null; }
  // 체결일(통계와 보고서, 계약 요약서): 체결본 등록(⑦)이 끝난 때. 조건 그대로 연장(날인과 체결본 없음)은 계약 완료(⑩)된 때
  //   buildReview가 차수와 다시 등록 요청을 따져 정한 signedAt, completedAt을 씀(결재 기록을 직접 뒤지지 않음)
  function signDate(c) { return (c.renewMode === 'AUTO' ? c.completedAt : c.signedAt) || ''; }
  // 계약 방식 코드(DIRECT, PROCURE, INDIRECT → D.METHODS). 예전 값 리셀러는 간접으로 읽음(v0.34 계약 유형을 계약 방식에 합침, REQ-ARC-09)
  function methodOf(c) {
    const m = (c.form || {}).method;
    return (m === 'RESELLER' ? 'INDIRECT' : m) || (c.type === '리셀러 계약' ? 'INDIRECT' : 'DIRECT');
  }
  function routedSteps(c) { return (c.approvals || []).filter(function (a) { return a.state !== 'SKIPPED'; }); }
  // 2단계 계약 검토에서 거치는 단계만 (결재 단계 점, 몇 번째 단계인지)
  function routedReview(c) { return routedSteps(c).filter(function (a) { return a.phase === 2; }); }
  // 결재 단계에 머문 일수 (step을 주지 않으면 지금 차례인 단계 중 가장 오래된 것)
  function waitDays(c, step) {
    const list = step ? [step] : pendingSteps(c);
    if (!list.length) return 0;
    return Math.max.apply(null, list.map(function (s) { return s.arrivedAt ? daysSince(s.arrivedAt) : 0; }));
  }
  // 이 사람이 지금 처리할 수 있는 단계인지: 담당자 본인, 대리 지정 기간 안의 대신할 사람(REQ-REV-08)
  //   최고관리자는 시연용으로 담당자 대신 처리할 수 있음 (프로토타입 전용)
  //   직무 분리: 기안자는 자기 계약의 결재 단계를 처리하지 않음(⑦ 체결본 등록 빼고, v0.26)
  function canAct(c, s, user) {
    if (s.step !== 'S07' && c.requesterId === user.id) return false;
    return WORKING.indexOf(c.status) > -1 && s.state === 'PENDING' && (isMyStep(s, user) || user.role === 'SUPER');
  }
  // 승인 취소: 2단계 계약 검토 단계만. 승인한 본인이, 다음 단계가 아직 아무것도 처리하지 않았을 때만 (REQ-DOC-06)
  //   ⑥~⑩은 승인 취소가 없고, 잘못은 ⑧ 다시 등록 요청이나 반려로 바로잡음 [가정] (REQ-SIGN-06)
  function canCancel(c, s, user) {
    if (!isReviewStep(s.step)) return false;
    if (c.requesterId === user.id) return false; // 기안자는 자기 계약의 승인을 취소하지 않음(REQ-AUTH-16, 최고관리자 시연도 같음. canAct와 맞춤)
    if (s.state !== 'DONE' || ['IN_REVIEW', 'APPROVED', 'OPS_REVIEW'].indexOf(c.status) < 0) return false;
    if (s.decidedBy !== user.id && user.role !== 'SUPER') return false;
    const gi = groupIndex(s.step);
    return !(c.approvals || []).some(function (a) { return groupIndex(a.step) > gi && a.decidedAt; });
  }

  /* 지정 열람자 (v0.52 기획자 결정, REQ-AUTH-20): 열람 제한 계약을 기본으로 보는 사람 밖에 더 볼 조직이나 사람
   *   - 조직(DEPT)이 기본: 그 조직에 지금 있는 사람이 봄. 인사이동이 저절로 반영됨(온 사람은 보고, 떠난 사람은 못 봄)
   *   - 사람(USER)은 예외: 지정할 때의 조직(deptAtGrant)을 남기고, 그 사람의 조직이 바뀌면 지정이 저절로 풀림(releasedAt).
   *     풀리면 관리자에게 이메일로 알리고(CODE-MAIL VIEWER_RELEASED), 필요하면 관리자가 다시 지정. 같은 조직으로 돌아와도 되살아나지 않음
   *   - 지정하고 빼는 것은 관리자만(열람 제한 관리 SCR-53), 사유 필수. 지정되면 그 사람(조직이면 그 조직 사람 모두)에게 이메일(VIEWER)
   *   - 계약 묶음(원계약 + 변경, 연장, 해지, 운영 변경) 단위: 원계약에 두고 후속 기안이 그대로 이어받음(D-13과 같은 방식)
   * v: { kind: 'DEPT', dept } 또는 { kind: 'USER', userId, deptAtGrant } + by, at, reason (+ removedAt, removedBy, removeReason / releasedAt, releasedTo) */
  function viewerKey(v) { return v.kind + ':' + (v.kind === 'DEPT' ? v.dept : v.userId); }
  function viewerState(v) {
    if (v.removedAt) return 'REMOVED';
    if (v.releasedAt) return 'RELEASED';
    if (v.kind === 'USER' && (!D.USERS[v.userId] || D.USERS[v.userId].dept !== v.deptAtGrant)) return 'RELEASED';
    return 'ON';
  }
  function viewersOf(c) {
    const root = D.CONTRACTS.filter(function (x) { return x.id === rootOf(c); })[0] || c;
    return root.viewers || [];
  }
  function viewerLabel(v) { return v.kind === 'DEPT' ? v.dept : ownerLabel(v.userId, v.deptAtGrant); }
  // 지금 효력이 있는 지정 열람자 이름들 (예: "재무기획유닛, 비즈니스유닛 문태호")
  function viewerText(c) {
    return viewersOf(c).filter(function (v) { return viewerState(v) === 'ON'; }).map(viewerLabel).join(', ');
  }
  // 인사이동: 사람으로 지정된 열람자는 조직이 바뀌는 순간 풀림 (applyAdmin의 ACCOUNT_EDIT, ACCOUNTS_MOVE가 부름)
  function releaseViewers(userId, toDept, at) {
    let n = 0;
    D.CONTRACTS.forEach(function (c) {
      (c.viewers || []).forEach(function (v) {
        if (v.kind === 'USER' && v.userId === userId && viewerState(v) === 'ON' && v.deptAtGrant !== toDept) { v.releasedAt = at; v.releasedTo = toDept; n += 1; }
      });
    });
    return n;
  }

  /* 열람 권한 (REQ-AUTH-03, REQ-AUTH-09 [가정])
   * - 열람 제한이 없는 계약: 모든 사용자 열람 가능
   * - 열람 제한 계약: 요청자 본인, 결재선과 단계 담당자(생략된 단계 제외. 총무, 영업지원, 고객지원, 재무 포함), 관리자,
   *   그리고 관리자가 지정한 열람자(조직 또는 사람, v0.52)만 열람 가능
   *   관찰자와 재무 리더, 재무 임원은 지정되지 않으면 열람 제한 계약을 볼 수 없음(재무는 아래 회계 영향 건만) [가정 v0.29]
   * ※ 실제 시스템에서는 반드시 서버에서 판단해야 합니다. 화면에서 가리는 것만으로는 보안이 되지 않습니다. */
  // 볼 수 없는 계약을 열었을 때의 안내 (결재 문서, 계약 상세, 계약 요약서가 같은 문장을 씀)
  const RESTRICTED_MSG = '열람 제한 계약은 요청자, 그 계약의 결재선과 단계 담당자, 관리자, 지정 열람자만 볼 수 있습니다.';
  function canView(c, user) {
    // 작성 중(임시 저장) 계약은 작성자 본인만 봅니다. [가정]
    if (c.status === 'DRAFT') return c.requesterId === user.id;
    if (!c.restricted) return true;
    if (user.role === 'ADMIN' || user.role === 'SUPER') return true;
    if (c.requesterId === user.id) return true;
    // 지정 열람자: 조직은 지금 그 조직에 있는 사람, 사람은 지정이 풀리지 않았을 때 (v0.52)
    if (viewersOf(c).some(function (v) {
      return viewerState(v) === 'ON' && (v.kind === 'DEPT' ? (D.USERS[user.id] || user).dept === v.dept : v.userId === user.id);
    })) return true;
    // 체크리스트 4번이 예면 재무(담당자, 리더, 임원)도 볼 수 있음 (REQ-CHK-08)
    if (user.base === 'FINANCE' && c.checklist && c.checklist.accounting === 'YES') return true;
    if (pendingSteps(c).some(function (a) { return activeDelegation(a.userId, user.id); })) return true;
    return routedSteps(c).some(function (a) { return a.userId === user.id; });
  }

  // 내 차례인 단계 목록: [{ c: 계약, s: 단계 }] (all=true면 모든 담당자 것, steps를 주면 그 단계만)
  //   검토 대기: ②~⑥, ⑧ / 운영 검토 대기: ⑨, ⑩ / ⑦은 체결 대기 화면에서 영업이 봄
  function pendingQueue(user, all, steps) {
    const out = [];
    D.CONTRACTS.forEach(function (c) {
      if (WORKING.indexOf(c.status) < 0) return;
      pendingSteps(c).forEach(function (s) {
        if (steps && steps.indexOf(s.step) < 0) return;
        if (all || isMyStep(s, user)) out.push({ c: c, s: s });
      });
    });
    return out;
  }
  // 내가 처리해야 할 계약 (개요 인사말과 '내가 검토할 계약'): 내 차례인 단계가 있는 계약
  //   영업은 ⑦ 체결본 등록 차례와 내가 기안한 반려 건
  function myActions(user) {
    return D.CONTRACTS.filter(function (c) {
      if (user.role === 'SALES' && c.requesterId === user.id && c.status === 'REJECTED') return canResubmit(c);
      if (c.requesterId === user.id && c.status === 'SUPPLEMENT') return true; // 보완 요청을 받은 기안자
      return WORKING.indexOf(c.status) > -1 && pendingSteps(c).some(function (s) { return isMyStep(s, user); });
    });
  }

  /* 보완 후 재기안 (REQ-FLOW-17): 반려된 기안은 같은 번호의 다음 차수로 다시 기안
   *   v0.58 기획자 결정(C-34): 신규, 변경, 바꿔서 연장(계약 등록 화면)뿐 아니라 해지(해지 기안), 조건 그대로 연장(연장 검토),
   *   운영 변경(운영 변경 기안)도 같은 번호로. 그 화면을 ?id=반려된 번호로 열면 앞 차수 값이 채워짐 */
  function canResubmit(c) { return c.status === 'REJECTED'; }
  // 다시 기안하는 화면 주소
  function resubmitHref(c) {
    const q = '?id=' + encodeURIComponent(c.id);
    return (c.kind === 'TERMINATE' ? 'terminate.html' : c.kind === 'CHANGE' ? 'ops-change.html' : c.renewMode === 'AUTO' ? 'renewal.html' : 'new-contract.html') + q;
  }
  // 주소의 번호로 다시 기안할 기록 찾기: 반려되었고, 그 화면이 맡는 종류(fits)이고, 기안자(시연은 최고관리자도)일 때
  function resubmitSource(id, user, fits) {
    const c = id ? D.CONTRACTS.filter(function (x) { return x.id === id; })[0] : null;
    return c && canResubmit(c) && fits(c) && (c.requesterId === user.id || user.role === 'SUPER') ? c : null;
  }
  // 보완 후 재기안 화면 맨 위 안내: 반려한 단계, 때, 사유
  function rejectionNotice(c) {
    const r = c.rejection || {}, round = c.round || 1;
    return noticeBox('', round + '차 기안이 반려되었습니다',
      '<strong>' + esc(r.role ? roleShort(r.role) : '') + ' 반려 (' + fmtDate(r.at) + ')</strong><br>' + esc(c.rejectReason || '') +
      '<br>내용을 보완해 같은 번호(' + esc(c.id) + ')의 ' + (round + 1) + '차로 기안합니다. ' + round + '차 기안 내용과 반려 사유는 그대로 남습니다.');
  }
  // 다시 기안한 기록: 같은 번호의 다음 차수. 앞 차수의 결재 기록과 기안 일시(SUBMIT 한 줄, 같은 일시면 맨 앞에 오게 앞에 둠)는 남김
  //   시연으로 남긴 결재 기록(contractId가 있음)은 화면을 열 때 다시 붙으므로 빼고 저장
  function resubmitRecord(source, fields) {
    const prev = JSON.parse(JSON.stringify(source));
    const hist = (prev.history || []).filter(function (h) { return !h.contractId; });
    // 앞 차수의 결재선(거친 ②~⑤)도 함께 남김: 다음 차수에서 답이 바뀌어도 앞 차수의 "결재한 판"을 그 차수 결재선으로 판단 (v0.63 검토)
    hist.unshift({ step: 'S01', action: 'SUBMIT', at: source.requestedAt, actorId: source.requesterId, comment: '', round: source.round || 1,
      route: routedReview(source).map(function (s) { return s.step; }) });
    const rec = Object.assign(prev, fields, {
      id: source.id, status: 'IN_REVIEW', requestedAt: nowStamp().slice(0, 16), round: (source.round || 1) + 1, history: hist, viewers: source.viewers,
    });
    delete rec.notes;
    return rec;
  }
  // 결재 단계 점: 승인 완료(채움), 현재 차례(테두리), 대기(회색), 반려(핑크). 2단계 계약 검토에서 거치는 단계만
  function stepDots(c) {
    const stateClass = { DONE: 'is-done', PENDING: 'is-current', REJECTED: 'is-rejected' };
    return '<span class="step-dots" aria-hidden="true">' + routedReview(c).map(function (a) {
      return '<span class="step-dot ' + (stateClass[a.state] || '') + '"></span>';
    }).join('') + '</span>';
  }

  /* 현재 진행 (REQ-DASH-06, v0.55 기획자 결정: 두 칸으로 나눈 C안)
   *   현재 진행 칸: 지금 단계의 번호와 이름만 한 줄로(왼쪽 정렬, 줄 바꾸지 않음). 예: "④ 법무", "④⑤ 법무, 개인정보",
   *     "⑦ 체결본 등록", "④ 법무 반려", "④ 법무 보완 요청". "검토 중", "대기" 같은 말은 옆 상태 배지가 말하므로 쓰지 않음
   *   대기 칸: 지금 단계에 온 날(반려, 보완 요청이면 그날)부터 오늘까지의 날수. 한 가지 기준으로만 셈(예전의 승인 후, 체결 후, 기안 후를 없앰)
   *     독촉 기준(alert_rule)을 넘으면 강조: ②~⑥, ⑧~⑩은 approvalDelayDays(5일), ⑦ 체결본 등록은 signDelayDays(14일)
   *   끝난 계약: 현재 진행 칸에 날짜(예: "만료 2027-04-30"), 대기 칸은 "-"
   * 반환: { step: 글, days: 날수 또는 null, lim: 강조 기준(0이면 강조 없음) } */
  function progressInfo(c) {
    const R = D.ALERT_RULES;
    if (c.status === 'DRAFT') return { step: D.STEPS.S01.no + ' 임시 저장', days: daysSince(c.savedAt), lim: 0 };
    if (c.status === 'REJECTED') {
      const s = D.STEPS[c.rejection.step];
      return { step: s.no + ' ' + s.short + ' 반려', days: daysSince(c.rejection.at), lim: 0 };
    }
    // 보완 중: 어느 단계에서 보완을 요청했는지 (REQ-REV-11)
    if (c.status === 'SUPPLEMENT' && c.supplement) {
      const s = D.STEPS[c.supplement.step];
      return { step: s.no + ' ' + s.short + ' 보완 요청', days: daysSince(c.supplement.at), lim: 0 };
    }
    // 검토 중(②~⑤): ④⑤는 동시에 차례일 수 있음 / 체결 대기(⑥~⑧)와 운영 검토(⑨, ⑩): 하는 일 이름
    if (['IN_REVIEW', 'APPROVED', 'OPS_REVIEW'].indexOf(c.status) > -1) {
      const ps = pendingSteps(c);
      if (!ps.length) return { step: D.STATUS[c.status].label, days: null, lim: 0 };
      const first = ps[0].step;
      const step = isReviewStep(first)
        ? ps.map(function (s) { return D.STEPS[s.step].no; }).join('') + ' ' + ps.map(function (s) { return D.STEPS[s.step].short; }).join(', ')
        : D.STEPS[first].no + ' ' + stepIng(c, first).replace(/ (중|대기)$/, '');
      return { step: step, days: waitDays(c), lim: first === 'S07' ? R.signDelayDays : R.approvalDelayDays };
    }
    if (c.status === 'ACTIVE' && isChange(c)) return { step: '완료 ' + fmtDate(c.completedAt), days: null, lim: 0 };
    if (c.status === 'ACTIVE') return { step: '만료 ' + fmtDate(c.endDate), days: null, lim: 0 };
    if (c.status === 'TERMINATED') return { step: '해지일 ' + fmtDate(c.terminateDate), days: null, lim: 0 };
    if (c.status === 'EXPIRED') return { step: '만료 ' + fmtDate(c.endDate), days: null, lim: 0 };
    return { step: '-', days: null, lim: 0 };
  }
  // 표 밖에서 한 줄로 쓸 때(계약 상세의 차수 이력): "④ 법무 7일째"
  function progressText(c) {
    const p = progressInfo(c);
    return esc(p.step) + (p.days == null ? '' : ' ' + p.days + '일째');
  }
  // 목록 표의 두 칸: 현재 진행(글, 왼쪽) + 대기(숫자, 오른쪽). 개요의 진행 상세, 전체 진행 현황, 내 등록 목록이 함께 씀
  //   머리글은 '<th scope="col">현재 진행</th><th scope="col" class="col-wait">대기</th>'
  //   대기 일수는 숫자지만 가운데(v0.59 기획자 요청: 짧은 칸이라 날짜, 상태처럼 가운데). 숫자 글꼴(num)은 그대로
  function progressCells(c) {
    const p = progressInfo(c);
    const d = p.days == null ? '-' : p.lim && p.days >= p.lim ? '<span class="wait-long">' + p.days + '일</span>' : p.days + '일';
    return '<td class="col-progress">' + esc(p.step) + '</td><td class="num col-wait">' + d + '</td>';
  }
  // 결재 기록의 "한 일" 이름: ⑥⑧⑨⑩의 승인은 단계에 맞는 말로 (예: 날인 완료)
  //   c를 주면 해지와 그대로 연장의 ⑨를 운영 종료 완료, 기간 연장 완료로
  function actionLabel(h, c) {
    const st = D.STEPS[h.step];
    if (h.action === 'APPROVE' && h.step === 'S09' && c && c.kind === 'TERMINATE') return '운영 종료 완료';
    if (h.action === 'APPROVE' && h.step === 'S09' && c && c.renewMode === 'AUTO') return '기간 연장 완료';
    if (h.action === 'APPROVE' && h.step === 'S09' && c && isChange(c)) return '운영 변경 완료';
    return h.action === 'APPROVE' && st && st.doneAction ? st.doneAction : D.APPROVAL_ACTIONS[h.action].label;
  }

  /* ---------- 시연 기록 (프로토타입 전용) ----------
   * 화면에서 승인, 반려, 승인 취소를 누르면 이 브라우저에만 저장해 다른 화면에도 반영합니다.
   * 실제 시스템에서는 서버의 결재 기록(approval_history)에 저장합니다.
   * 시연 띠의 "시연 기록 지우기"를 누르면 처음 예시 상태로 돌아갑니다. */
  const DEMO_ACTIONS_KEY = 'climb.demoActions';
  function loadDemoActions() {
    try { return JSON.parse(localStorage.getItem(DEMO_ACTIONS_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveDemoActions(list) {
    try { localStorage.setItem(DEMO_ACTIONS_KEY, JSON.stringify(list)); } catch (e) { /* 저장소를 못 쓰면 이 화면에서만 반영 */ }
  }
  function nowStamp() {
    const d = new Date();
    const p = function (n) { return String(n).padStart(2, '0'); };
    return D.TODAY + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  // 승인(APPROVE), 반려(REJECT), 승인 취소(CANCEL), 체결본 등록(REGISTER), 다시 등록 요청(RETURN)을 기록하고 계약 상태를 다시 계산
  //   extra: 체결본 파일 이름(fileName) 같은 덧붙일 값
  //   대리 지정으로 대신 처리하면 누구 대신인지(onBehalfOf)와 대리 지정 번호, 근거(basis)를 함께 남김 (REQ-REV-08)
  function recordAction(c, s, action, comment, user, extra) {
    const dl = s.userId !== user.id ? activeDelegation(s.userId, user.id) : null;
    const entry = Object.assign({
      contractId: c.id, step: s.step, action: action, at: nowStamp(), comment: comment || '',
      actorId: user.id, onBehalfOf: s.userId !== user.id ? s.userId : null,
      // 처리한 사람의 그때 조직 이름. 나중에 조직 개편으로 이름이 바뀌어도 기록에는 그때 이름이 남음 (v0.31)
      actorDept: (D.USERS[user.id] || {}).dept || '',
      delegationId: dl ? dl.id : null, basis: dl ? dl.reason : '', round: c.round || 1,
    }, extra || {});
    const list = loadDemoActions();
    list.push(entry);
    saveDemoActions(list);
    c.history.push(entry);
    buildReview(c);
    applyBundleEffects(); // 해지 기안이 끝나면 원계약을 해지 상태로
    return entry;
  }
  // 시연으로 만든 계약(해지 기안, 연장 검토), 사후관리 기록, 지운 임시 저장 (프로토타입 전용, REQ-ARC-04~07)
  const DEMO_KEYS = { contracts: 'climb.demoContracts', notes: 'climb.demoNotes', deleted: 'climb.demoDeleted', admin: 'climb.demoAdmin', mail: 'climb.demoMail', theme: 'climb.demoTheme' /* 화면 설정(v0.53, theme.js) */,
    obligations: 'climb.demoObligations' /* 체결 후 의무(v0.53) */, quotes: 'climb.demoQuotes' /* 견적서(v0.61) */ };
  // 받을 이메일 설정(내 계정, v0.45): { 사용자 id: { 알림 코드: 켬/끔 } }. 실제 시스템은 서버의 사용자 설정
  function mailPrefs(userId) {
    let all = {};
    try { all = JSON.parse(localStorage.getItem(DEMO_KEYS.mail) || '{}') || {}; } catch (e) { all = {}; }
    const mine = all[userId] || {};
    const out = {};
    D.EMAIL_TYPES.forEach(function (t) { out[t.code] = t.must ? true : (t.code in mine ? !!mine[t.code] : !!t.on); });
    return out;
  }
  function saveMailPrefs(userId, prefs) {
    let all = {};
    try { all = JSON.parse(localStorage.getItem(DEMO_KEYS.mail) || '{}') || {}; } catch (e) { all = {}; }
    all[userId] = prefs;
    try { localStorage.setItem(DEMO_KEYS.mail, JSON.stringify(all)); } catch (e) { /* 저장소를 못 쓰면 이 화면에서만 */ }
  }
  function loadDemo(key) { try { return JSON.parse(localStorage.getItem(DEMO_KEYS[key]) || '[]'); } catch (e) { return []; } }
  function pushDemo(key, item) {
    const list = loadDemo(key);
    list.push(item);
    try { localStorage.setItem(DEMO_KEYS[key], JSON.stringify(list)); } catch (e) { /* 저장소를 못 쓰면 이 화면에서만 반영 */ }
  }
  // 시연 기록 수: 저장한 모든 것(받을 이메일 설정과 화면 밝기 포함, v0.58 QA: 그것만 바꾸면 지우기 버튼이 보이지 않았음)
  function demoCount() {
    return Object.keys(DEMO_KEYS).reduce(function (n, k) {
      try {
        const v = JSON.parse(localStorage.getItem(DEMO_KEYS[k]) || 'null');
        return n + (!v ? 0 : Array.isArray(v) ? v.length : Object.keys(v).length);
      } catch (e) { return n; }
    }, loadDemoActions().length);
  }
  // 계약 기록 저장 (계약 등록의 기안, 임시 저장, 재기안과 해지 기안, 연장 검토, 운영 변경). 실제 시스템에서는 서버에 저장
  //   같은 계약번호(임시 저장은 임시 키)의 기록이 있으면 바꿔 씀: 이어서 작성한 임시 저장, 다음 차수로 다시 기안한 계약 (v0.58 QA)
  function demoKey(c) { return c.id || 'draft:' + c.draftKey; }
  function saveDemoContract(c) {
    const list = loadDemo('contracts').filter(function (x) { return demoKey(x) !== demoKey(c); });
    list.push(c);
    try { localStorage.setItem(DEMO_KEYS.contracts, JSON.stringify(list)); } catch (e) { /* 저장소를 못 쓰면 이 화면에서만 반영 */ }
    const i = D.CONTRACTS.findIndex(function (x) { return demoKey(x) === demoKey(c); });
    if (i > -1) D.CONTRACTS[i] = c; else D.CONTRACTS.push(c);
    buildReview(c);
    applyBundleEffects();
  }
  /* ---------- 견적서 (v0.61 기획자 결정, REQ-QUO, 화면 SCR-15~17) ----------
   * 견적은 계약과 이어지지 않고, 출력한 기록을 남기는 것이 목적. 한 판이 한 기록(no + ver). 출력한 판은 고칠 수 없고 새 판으로
   * 보는 사람: 작성한 영업, 같은 유닛의 영업 리더, 영업 임원, 영업지원, 관리자, 최고관리자(가격 기준을 볼 수 있는 사람, REQ-SCOPE-02)
   * 프로토타입: 새로 만들거나 출력한 기록은 이 브라우저에만 저장(시연 기록). 실제 시스템은 서버에 저장하고 출력 기록은 고치거나 지울 수 없음 */
  function quoteKey(q) { return q.no + '#' + q.ver; }
  function allQuotes() {
    const saved = loadDemo('quotes');
    const keys = saved.map(quoteKey);
    return D.QUOTES.filter(function (q) { return keys.indexOf(quoteKey(q)) < 0; }).concat(saved);
  }
  function findQuote(no, ver) {
    const list = allQuotes().filter(function (q) { return q.no === no; });
    if (!list.length) return null;
    return ver ? list.filter(function (q) { return q.ver === Number(ver); })[0] || null : list.sort(function (a, b) { return b.ver - a.ver; })[0];
  }
  // 저장: 이미 출력한 판은 내용을 바꾸지 않고 출력 기록만 덧붙임(덧붙이기만, 지우거나 줄이지 않음. v0.61 검토: 예전 화면에서 저장하면
  //   출력 기록이 지워지고 판이 풀렸음). 실제로 저장한 기록을 돌려줌. 실제 시스템은 서버가 같은 규칙으로 막음(견적 판은 넣기만, 출력 기록은 덧붙이기만)
  function saveQuote(q) {
    const list = loadDemo('quotes');
    const old = list.filter(function (x) { return quoteKey(x) === quoteKey(q); })[0] || D.QUOTES.filter(function (x) { return quoteKey(x) === quoteKey(q); })[0];
    let rec = q;
    if (old && (old.issues || []).length) {
      const add = (q.issues || []).slice(old.issues.length);
      rec = Object.assign(JSON.parse(JSON.stringify(old)), { issues: old.issues.concat(add) });
    }
    const rest = list.filter(function (x) { return quoteKey(x) !== quoteKey(rec); });
    rest.push(rec);
    try { localStorage.setItem(DEMO_KEYS.quotes, JSON.stringify(rest)); } catch (e) { /* 저장소를 못 쓰면 이 화면에서만 반영 */ }
    return rec;
  }
  // 새 견적번호: QT + 견적일의 연월(YYMM) + 그 달 일련번호 3자리 (예: QT2610-004)
  function newQuoteNo(date) {
    const ym = String(date || D.TODAY).slice(2, 4) + String(date || D.TODAY).slice(5, 7);
    let n = 0;
    allQuotes().forEach(function (q) { const m = new RegExp('^QT' + ym + '-(\\d{3})$').exec(q.no); if (m) n = Math.max(n, Number(m[1])); });
    return 'QT' + ym + '-' + String(n + 1).padStart(3, '0');
  }
  // 합계: 공급가액, 부가세(원 단위 버림), 합계
  function quoteTotals(q) {
    const supply = (q.lines || []).reduce(function (s, l) { return s + (Number(l.unitPrice) || 0) * (Number(l.qty) || 0); }, 0);
    const vat = Math.floor(supply * D.QUOTE_RULES.vat);
    return { supply: supply, vat: vat, total: supply + vat };
  }
  // 할인율 한도를 넘는 줄: 견적 줄에 저장한 그때의 표준 단가와 한도로 봄 (견적 화면, 견적 목록, 통계가 같이 씀. v0.62 표준 대응표 G-01 남은 것)
  function quoteLineOverCap(l) { return !!l.listPrice && l.cap != null && 1 - (Number(l.unitPrice) || 0) / l.listPrice > l.cap + 1e-9; }
  function quoteOverCap(q) { return (q.lines || []).some(quoteLineOverCap); }
  // 상태: 작성 중(출력 전) / 출력함 / 기간 지남(유효기간이 오늘보다 앞) / 새 판으로 바뀜(더 높은 판이 있음)
  function quoteStatus(q) {
    const newer = allQuotes().some(function (x) { return x.no === q.no && x.ver > q.ver; });
    if (newer) return { code: 'SUPERSEDED', label: '새 판으로 바뀜', tone: 'neutral' };
    if (!(q.issues || []).length) return { code: 'DRAFT', label: '작성 중', tone: 'line' };
    if (q.validUntil < D.TODAY) return { code: 'EXPIRED', label: '기간 지남', tone: 'neutral' };
    return { code: 'ISSUED', label: '출력함', tone: 'success' };
  }
  function canSeeQuote(user, q) {
    if (user.role === 'SUPER' || hasRole(user, ['ADMIN', 'SALES_ADMIN'])) return true;
    if (user.role === 'EXEC') return true;
    if (user.role === 'HEAD') return teamOf(q.owner) === user.dept;
    return q.owner === user.id;
  }
  function canEditQuote(user, q) { return q.owner === user.id && !(q.issues || []).length; }
  // 새 임시 저장 키 (D-0002 꼴). 지운 임시 저장의 키는 다시 쓰지 않음
  function newDraftKey() {
    const used = D.CONTRACTS.map(function (x) { return x.draftKey; }).concat(loadDemo('deleted'));
    let n = 1;
    used.forEach(function (k) { const m = /^D-(\d+)$/.exec(k || ''); if (m) n = Math.max(n, Number(m[1]) + 1); });
    return 'D-' + String(n).padStart(4, '0');
  }
  // 사후관리 기록 남기기 (REQ-FLOW-06, 19): 수정, 삭제 없이 덧붙이기만
  function addNote(c, note) {
    const entry = Object.assign({ contractId: c.id, at: nowStamp() }, note);
    pushDemo('notes', entry);
    c.notes = (c.notes || []).concat([entry]);
    return entry;
  }
  // 임시 저장 지우기 (REQ-FLOW-31): 기안 전 작성자만
  function deleteDraft(c) {
    pushDemo('deleted', c.draftKey);
    const i = D.CONTRACTS.indexOf(c);
    if (i > -1) D.CONTRACTS.splice(i, 1);
  }
  loadDemo('contracts').forEach(function (c) {
    const i = D.CONTRACTS.findIndex(function (x) { return demoKey(x) === demoKey(c); });
    if (i > -1) D.CONTRACTS[i] = c; else D.CONTRACTS.push(c);
  });
  loadDemo('notes').forEach(function (n) {
    const c = D.CONTRACTS.find(function (x) { return x.id === n.contractId; });
    if (c) c.notes = (c.notes || []).concat([n]);
  });
  loadDemo('deleted').forEach(function (key) {
    const i = D.CONTRACTS.findIndex(function (x) { return x.draftKey === key; });
    if (i > -1) D.CONTRACTS.splice(i, 1);
  });

  /* ---------- 체결 후 의무 (v0.53 기획자 결정, 요구사항 정의서 REQ-FLOW-33~36) ----------
   * 의무 하나: mock-data.js OBLIGATIONS. 시연으로 더한 의무, 이행 기록, 끝냄은 이 브라우저에만 저장(climb.demoObligations)
   * 실제 시스템에서는 서버의 obligation, obligation_record에 저장하고 기한 알림(OBLIGATION 이메일)은 서버가 매일 보냄 */
  // 맡는 분야의 역할(PRIVACY, CEM, FINANCE). 분야 이름은 ROLE_AREA(정보보호, 고객지원, 재무)
  function obligationOwner(o) { return o.owner || (D.OBLIGATION_KINDS[o.kind] || {}).owner; }
  function obligationOwnerLabel(o) { return (D.ROLE_AREA[obligationOwner(o)] || '-'); }
  // 되풀이 의무의 기한들: first부터 everyMonths달마다, 계약 묶음이 끝나는 날까지(끝을 모르면 3년까지만 셈)
  function obligationDues(o) {
    if (o.when === 'ONCE') return o.due ? [o.due] : [];
    if (o.when !== 'REPEAT' || !o.first || !o.everyMonths) return [];
    const b = bundleOf(o.bundle);
    const end = (b && obligationEnd(b)) || monthsLater(o.first, 36);
    const out = [];
    for (let i = 0, d = o.first; d <= end && i < 120; i++, d = monthsLater(o.first, o.everyMonths * i)) out.push(d);
    return out;
  }
  // 의무가 끝나는 날: 묶음이 끝나는 날. 해지되었으면 해지일 (v0.58 QA: 해지한 계약의 의무가 원래 종료일까지 알림을 냈음)
  function obligationEnd(b) {
    const t = b.items.filter(function (c) { return c.kind === 'TERMINATE' && c.status === 'TERMINATED' && c.terminateDate; })[0];
    return t && t.terminateDate < b.end ? t.terminateDate : b.end;
  }
  // 지금 상태 { code, label, tone, next(아직 하지 않은 가장 이른 기한), days, done, total }
  //   LATE 기한 지남 / SOON 기한 14일 이내 / PLANNED 예정 / EVENT 일이 생기면 / DONE 모두 함 / ENDED 끝냄
  function obligationState(o) {
    const recs = o.records || [];
    if (o.endedAt) return { code: 'ENDED', label: '끝냄', tone: 'neutral', done: recs.length };
    if (o.when === 'EVENT') return { code: 'EVENT', label: '일이 생기면', tone: 'line', done: recs.length };
    const dues = obligationDues(o);
    const doneFor = recs.map(function (r) { return r.for; });
    const open = dues.filter(function (d) { return doneFor.indexOf(d) < 0; });
    const base = { done: dues.length - open.length, total: dues.length };
    // 기한이 하나도 없으면(첫 기한이 계약이 끝난 뒤) "모두 함"이 아니라 기한 없음 (v0.58 QA)
    if (!dues.length) return Object.assign({ code: 'NONE', label: '기한 없음', tone: 'line' }, base);
    if (!open.length) return Object.assign({ code: 'DONE', label: '모두 함', tone: 'success' }, base);
    const next = open[0], d = daysUntil(next);
    if (d < 0) return Object.assign({ code: 'LATE', label: '기한 지남', tone: 'danger', next: next, days: d }, base);
    if (d <= D.ALERT_RULES.obligationSoonDays) return Object.assign({ code: 'SOON', label: d ? 'D-' + d : '오늘', tone: 'attention', next: next, days: d }, base);
    return Object.assign({ code: 'PLANNED', label: '예정', tone: 'progress', next: next, days: d }, base);
  }
  // 언제 하는지 한 줄: "2026-10-30" / "1달마다(2026-06-05부터)" / "일이 생기면: 알게 된 때부터 4시간 안"
  function obligationWhenText(o) {
    if (o.when === 'ONCE') return '한 번: ' + fmtDate(o.due);
    if (o.when === 'REPEAT') return (o.everyMonths === 12 ? '해마다' : o.everyMonths === 3 ? '분기마다' : o.everyMonths === 1 ? '달마다' : o.everyMonths + '달마다') + '(' + fmtDate(o.first) + '부터)';
    return '일이 생기면: ' + (o.within || '-');
  }
  // 맡은 분야의 사람(담당자와 리더, 임원). 지정 열람자처럼 사람이 아니라 분야로 맡김
  function isObligationOwner(user, o) { return hasRole(user, [obligationOwner(o)]); }
  // 체결본이 등록된 묶음부터 의무를 더함. ⑧에서 반려된 판이나 앞 차수의 판만 있으면 아직 아님(v0.61 검토)
  function canHaveObligations(b) {
    return !!b && (['ACTIVE', 'EXPIRED', 'TERMINATED'].indexOf(b.status) > -1 ||
      b.items.some(function (c) { return signedVersions(c).some(function (v) { return v.current && v.fate !== 'REJECT'; }); }));
  }
  /* 체결본의 판 (REQ-FLOW-22, v0.61 검토): ⑦에서 올린 때마다 한 판. 다시 등록 요청이나 ⑧ 반려로 바뀐 판도, 앞 차수의 판도 지우지 않음
   * 검토 상세(첨부 파일), 계약 상세(체결본), 계약 요약서(체결본)가 이 목록 하나를 같이 씀
   *   no: 판 번호(차수를 이어서 셈) / round: 올린 차수 / why: 체결본 등록, 다시 등록(앞 차수면 ", n차")
   *   fate: 그 판을 두고 ⑧에서 한 일(APPROVE 확인 완료, RETURN 다시 등록 요청, REJECT 반려, 없으면 확인 전)
   *   current: 지금 차수에서 올린 마지막 판 / checked: current이고 ⑧ 확인 완료("확인한 체결본") */
  function signedVersions(c) {
    const hist = c.history || [], round = c.round || 1;
    const regs = hist.filter(function (h) { return h.action === 'REGISTER'; });
    return regs.map(function (h, i) {
      const r = h.round || 1, next = regs[i + 1];
      const first = regs.filter(function (x) { return (x.round || 1) === r; })[0] === h;
      const s08 = hist.filter(function (x) { return (x.round || 1) === r && x.step === 'S08' && x.at >= h.at && (!next || x.at < next.at); }).pop();
      const current = !next && r === round;
      return { no: i + 1, at: h.at, by: h.actorId || c.requesterId, round: r, name: h.fileName || c.counterparty + '_체결본.pdf',
        why: (first ? '체결본 등록' : '다시 등록') + (r < round ? ', ' + r + '차' : ''), fate: s08 ? s08.action : null,
        current: current, checked: current && !!s08 && s08.action === 'APPROVE' };
    });
  }
  // 바뀐 판의 까닭(글자로): 다시 등록 요청, ⑧ 반려
  function signedFateText(v) { return v.fate === 'RETURN' ? '다시 등록 요청으로 바뀜' : v.fate === 'REJECT' ? '⑧에서 반려' : ''; }
  // 더하기 [가정]: 영업대표(본인 계약), 법무, 관리자, 최고관리자, 그 종류를 맡는 분야(kind를 주면 그 분야만)
  function canAddObligation(user, root, kind) {
    if (root.requesterId === user.id || hasRole(user, ['LEGAL']) || user.role === 'ADMIN' || user.role === 'SUPER') return true;
    return Object.keys(D.OBLIGATION_KINDS).some(function (k) { return (!kind || k === kind) && hasRole(user, [D.OBLIGATION_KINDS[k].owner]); });
  }
  // 이행 기록: 맡은 분야, 관리자, 최고관리자 / 끝내기: 거기에 법무도 [가정]
  //   영업대표는 더할 수는 있어도 끝내지는 못함(끝내면 기한 알림이 멈추므로 맡은 분야나 법무가 판단)
  function canRecordObligation(user, o) { return isObligationOwner(user, o) || user.role === 'ADMIN' || user.role === 'SUPER'; }
  function canEndObligation(user, o) { return canRecordObligation(user, o) || hasRole(user, ['LEGAL']); }
  // 볼 수 있는 의무: 계약을 볼 수 있거나 맡은 분야(열람 제한 계약이면 고객사는 가림)
  function canSeeObligation(user, o) {
    const root = D.CONTRACTS.find(function (c) { return c.id === o.bundle; });
    return !!root && (canView(root, user) || isObligationOwner(user, o));
  }
  function obligationsOf(bundleId) { return D.OBLIGATIONS.filter(function (o) { return o.bundle === bundleId; }); }
  // 시연 기록(climb.demoObligations): { type: 'ADD', ob } / { type: 'RECORD', id, rec } / { type: 'END', id, at, by, reason }
  function applyObligationEvent(e) {
    if (e.type === 'ADD') { if (!D.OBLIGATIONS.some(function (o) { return o.id === e.ob.id; })) D.OBLIGATIONS.push(e.ob); return; }
    const o = D.OBLIGATIONS.find(function (x) { return x.id === e.id; });
    if (!o) return;
    if (e.type === 'RECORD') o.records = (o.records || []).concat([e.rec]);
    if (e.type === 'END') { o.endedAt = e.at; o.endedBy = e.by; o.endReason = e.reason; }
  }
  function saveObligationEvent(e) { pushDemo('obligations', e); applyObligationEvent(e); }
  function addObligation(ob, user) {
    const n = D.OBLIGATIONS.reduce(function (m, o) { return Math.max(m, Number(String(o.id).replace(/\D/g, '')) || 0); }, 0) + 1;
    const full = Object.assign({ id: 'OB-' + String(n).padStart(4, '0'), by: user.id, at: nowStamp().slice(0, 16), records: [] }, ob);
    saveObligationEvent({ type: 'ADD', ob: full });
    return full;
  }
  function recordObligation(o, forDue, note, user) { saveObligationEvent({ type: 'RECORD', id: o.id, rec: { for: forDue || null, at: nowStamp().slice(0, 16), by: user.id, note: note } }); }
  function endObligation(o, reason, user) { saveObligationEvent({ type: 'END', id: o.id, at: nowStamp().slice(0, 16), by: user.id, reason: reason }); }
  loadDemo('obligations').forEach(applyObligationEvent);

  /* ---------- 관리자 설정 (SCR-51~57, 기획자 결정 v0.25) ----------
   * 관리자 화면에서 바꾼 것은 변경 이력(D.ADMIN_LOG)에 한 줄씩 남습니다: 누가, 언제, 무엇을, 사유(필수). 고치거나 지우지 않습니다.
   * 바꾼 내용(op)은 예시 데이터에 바로 반영합니다. 시연으로 바꾼 것은 이 브라우저에만 저장되고 "시연 기록 지우기"로 돌아갑니다.
   * 실제 시스템에서는 서버가 저장하고 검사합니다. 관리자 기능은 사내망에서만 씁니다(REQ-SEC-04). */
  function localId(email) { return 'u_' + String(email).split('@')[0].replace(/\./g, '_'); }
  // 새 계정 번호: 이미 있는 번호면 뒤에 _2, _3 (v0.58 QA: admin@으로 더하면 관리자 윤재민의 번호를 덮어 지난 기록 이름이 바뀌었음)
  function newUserId(email) {
    const base = localId(email);
    let id = base, n = 2;
    while (D.USERS[id] || D.ACCOUNTS.some(function (a) { return a.id === id; })) id = base + '_' + n++;
    return id;
  }
  function findBy(list, key, val) { return list.filter(function (x) { return x[key] === val; })[0] || null; }
  // 오늘 적용되는 가격 기준을 다시 만듦 (적용 시작일이 오늘 이후인 줄은 예정)
  function refreshPrices() {
    const cur = D.currentPrices(D.PRICE_ROWS, D.TODAY);
    D.PRICE_BOOK.length = 0;
    cur.forEach(function (r) { D.PRICE_BOOK.push(r); });
  }
  // 코드표를 화면이 쓰는 목록에 반영. 이름표는 사용 안 함인 코드도 남겨 지난 기록이 그대로 보이게 함
  function refreshCodes() {
    D.CODES.forEach(function (c) {
      // 서비스는 v0.47부터 한 단계 (예전 시연 기록의 중분류, 소분류는 서비스 이름표에 넣지 않음)
      if (c.group === 'SERVICE' && (!c.level || c.level === 1)) D.SERVICES[c.code] = c.label;
      if (c.group === 'METHOD') D.METHODS[c.code] = c.label;
      if (c.group === 'SETTLEMENT') D.SETTLEMENTS[c.code] = c.label;
      if (c.group === 'AFTERCARE') D.AFTERCARE_TYPES[c.code] = c.label;
    });
  }
  // 코드 목록 (all이 아니면 사용 중인 것만). 고르는 칸은 이것을 씀
  function codeList(group, all) {
    return D.CODES.filter(function (c) { return c.group === group && (all || c.use); });
  }
  function rename(oldName, newName) {
    D.CONTRACTS.forEach(function (c) { if (c.counterparty === oldName) c.counterparty = newName; });
  }
  function applyAdmin(e) {
    const op = e.op;
    if (!op) return;
    const day = e.at.slice(0, 10);
    if (op.k === 'ASSIGNEE') D.ASSIGNEE_CHANGES.push({ step: op.step, to: op.to, at: e.at });
    else if (op.k === 'DELEGATE') D.DELEGATIONS.push(Object.assign({ by: e.by, at: e.at, endedAt: null }, op.d));
    else if (op.k === 'DELEGATE_END') { const d = findBy(D.DELEGATIONS, 'id', op.id); if (d) d.endedAt = e.at; }
    else if (op.k === 'ALERT_RULE') D.ALERT_RULES[op.key] = op.to;
    else if (op.k === 'ACCOUNT_ADD') {
      const a = Object.assign({ status: 'INVITED', registeredAt: day, firstLoginAt: null, lastLoginAt: null, lastLogoutAt: null, roleChangedAt: day, id: newUserId(op.a.email) }, op.a);
      D.ACCOUNTS.push(a);
      D.USERS[a.id] = { name: a.name, dept: a.dept, role: a.roles[0] };
    } else if (op.k === 'ACCOUNT_EDIT') {
      const a = findBy(D.ACCOUNTS, 'email', op.email);
      if (!a) return;
      // 조직이 바뀌면 사람으로 지정된 열람자 지정이 풀림 (v0.52, 인사이동)
      if (op.set.dept && op.set.dept !== a.dept) releaseViewers(a.id, op.set.dept, e.at);
      if (op.set.dept) a.dept = op.set.dept;
      if (op.set.roles) a.roles = op.set.roles;
      if (op.set.status) a.status = op.set.status;
      if (op.set.roles || op.set.status) a.roleChangedAt = day; // 권한 변경일: 역할이나 사용 여부를 바꾼 날
      if (D.USERS[a.id]) { D.USERS[a.id].dept = a.dept; D.USERS[a.id].role = a.roles[0]; }
    } else if (op.k === 'ACCOUNTS_MOVE') {
      // 조직 옮기기: 여러 사람을 한 번에 다른 조직으로. 역할은 그대로 (조직 개편 v0.31)
      op.emails.forEach(function (email) {
        const a = findBy(D.ACCOUNTS, 'email', email);
        if (!a) return;
        if (a.dept !== op.to) releaseViewers(a.id, op.to, e.at); // 사람 지정 열람자는 풀림 (v0.52)
        a.dept = op.to;
        if (D.USERS[a.id]) D.USERS[a.id].dept = op.to;
      });
    } else if (op.k === 'RESTRICT') {
      // 묶음 전체에 걸고 풂(원계약 번호로): 후속 기안도 원계약을 이어받음 (D-13, v0.58 QA: 원계약만 바뀌어 후속 기안이 그대로 보였음)
      //   후속 기안 번호가 와도 원계약으로 바꿔 묶음 전체에 적용 (REQ-AUTH-09, v0.63 점검에서 고침: 후속 기안 하나에만 걸리거나 풀렸음)
      const target = findBy(D.CONTRACTS, 'id', op.id);
      const rid = target ? rootOf(target) : op.id;
      D.CONTRACTS.forEach(function (c) { if (c.id === rid || (c.id && rootOf(c) === rid)) c.restricted = op.on; });
    } else if (op.k === 'TEMPLATE_ADD') {
      // 표준계약서 더하기 (v0.53): 첫 판과 함께
      D.TEMPLATES.push({ id: op.t.id, name: op.t.name, service: op.t.service || '', versions: [Object.assign({ no: 1, by: e.by, at: e.at, basis: e.reason }, op.v)] });
    } else if (op.k === 'TEMPLATE_VERSION') {
      // 표준계약서 새 판 (v0.53): 앞 판은 지우지 않음
      const t = findBy(D.TEMPLATES, 'id', op.id);
      if (t) t.versions.push(Object.assign({ no: t.versions.length + 1, by: e.by, at: e.at, basis: e.reason }, op.v));
    } else if (op.k === 'VIEWER_ADD') {
      // 지정 열람자 더하기 (v0.52): 원계약(묶음)에 둠. 사람은 지정할 때 조직을 함께 남김
      const c = findBy(D.CONTRACTS, 'id', op.id);
      if (c) c.viewers = (c.viewers || []).concat([Object.assign({ by: e.by, at: e.at, reason: e.reason }, op.v)]);
    } else if (op.k === 'VIEWER_REMOVE') {
      // 지정 열람자 빼기: 지우지 않고 뺀 때와 사람, 사유를 남김
      const c = findBy(D.CONTRACTS, 'id', op.id);
      (c && c.viewers || []).forEach(function (v) {
        if (viewerKey(v) === op.key && !v.removedAt) { v.removedAt = e.at; v.removedBy = e.by; v.removeReason = e.reason; }
      });
    } else if (op.k === 'PRICE') {
      // v0.49부터 가격은 기능마다(feature가 열쇠). 기능이 없는 예전 시연 기록(플랜 코드)은 반영하지 않음
      if (!op.row.feature) return;
      D.PRICE_ROWS.push(Object.assign({ by: e.by, at: e.at }, op.row));
      refreshPrices();
    } else if (op.k === 'PRODUCT_ADD') {
      // 제품과 기능 (v0.47): 추가, 고치기. 지우지 않고 사용 안 함으로 돌림
      D.PRODUCTS.push(Object.assign({ use: true }, op.p));
    } else if (op.k === 'PRODUCT_EDIT') {
      const p = findBy(D.PRODUCTS, 'id', op.id);
      if (!p) return;
      if (op.set.name) p.name = op.set.name;
      if (op.set.service) p.service = op.set.service; // 서비스는 가격이 없는 제품만 바꿀 수 있음(제품과 기능 관리)
      if (typeof op.set.use === 'boolean') p.use = op.set.use;
    } else if (op.k === 'FEATURE_ADD') {
      op.list.forEach(function (f) { D.FEATURES.push(Object.assign({ use: true }, f)); });
    } else if (op.k === 'FEATURE_EDIT') {
      const f = findBy(D.FEATURES, 'id', op.id);
      if (!f) return;
      if (op.set.name) f.name = op.set.name;
      if (typeof op.set.use === 'boolean') f.use = op.set.use;
    } else if (op.k === 'NOTICE_ADD') {
      // 공지사항 (v0.45): 올림, 고침, 내림. 내린 글은 지우지 않고 감춤(기록 남김)
      D.NOTICES.push(Object.assign({ by: e.by, at: e.at.slice(0, 16) }, op.n));
    } else if (op.k === 'NOTICE_EDIT') {
      const n = findBy(D.NOTICES, 'id', op.id);
      if (n) Object.assign(n, op.set, { editedAt: e.at.slice(0, 16) });
    } else if (op.k === 'NOTICE_HIDE') {
      const n = findBy(D.NOTICES, 'id', op.id);
      if (n) { n.hidden = true; n.hiddenAt = e.at.slice(0, 16); }
    } else if (op.k === 'CUSTOMER_ADD') {
      D.CUSTOMERS.push(Object.assign({ registeredBy: e.by, registeredAt: day, use: true, mergedInto: null }, op.cu));
    } else if (op.k === 'CUSTOMER_EDIT') {
      const cu = findBy(D.CUSTOMERS, 'id', op.id);
      if (!cu) return;
      if (op.set.name && op.set.name !== cu.name) { rename(cu.name, op.set.name); cu.name = op.set.name; }
      if (op.set.bizNo) cu.bizNo = op.set.bizNo;
      if (typeof op.set.use === 'boolean') cu.use = op.set.use;
    } else if (op.k === 'CUSTOMER_MERGE') {
      // 합치기: 남길 거래처 하나만 두고 나머지는 사용 안 함 + 합쳐진 곳 표시. 계약은 남길 거래처로 옮김
      const keep = findBy(D.CUSTOMERS, 'id', op.keep);
      op.ids.forEach(function (id) {
        const cu = findBy(D.CUSTOMERS, 'id', id);
        if (!cu || !keep || cu === keep) return;
        rename(cu.name, keep.name);
        cu.use = false; cu.mergedInto = keep.id;
      });
    } else if (op.k === 'CODE_ADD') {
      D.CODES.push(Object.assign({ level: null, parent: null, use: true }, op.c));
      refreshCodes();
    } else if (op.k === 'CODE_EDIT') {
      const c = D.CODES.filter(function (x) { return x.group === op.group && x.code === op.code; })[0];
      if (!c) return;
      // 프로토타입은 사용자 부서를 이름으로 저장하므로 이름을 바꾸면 기록의 이름도 바꿔 보여 줌 (실제 시스템은 코드로 저장)
      if (op.set.label && op.set.label !== c.label) {
        const old = c.label;
        if (op.group === 'DEPT') {
          D.ACCOUNTS.forEach(function (a) { if (a.dept === old) { a.dept = op.set.label; if (D.USERS[a.id]) D.USERS[a.id].dept = op.set.label; } });
          // 조직 이름만 바뀐 것은 인사이동이 아니므로 지정 열람자도 새 이름으로 이어감 (v0.52)
          D.CONTRACTS.forEach(function (c) {
            (c.viewers || []).forEach(function (v) { if (v.dept === old) v.dept = op.set.label; if (v.deptAtGrant === old) v.deptAtGrant = op.set.label; });
          });
          // 조직 이름을 바꿔도 ③ 유닛별 리더가 이어지게 리더 표와 바꾼 이력의 유닛 이름도 함께 바꿈 (v0.31, 조직 개편)
          if (Object.prototype.hasOwnProperty.call(D.TEAM_LEADERS, old)) {
            // 표의 순서를 지키며 이름만 바꿈
            const keep = Object.keys(D.TEAM_LEADERS).map(function (k) { return [k === old ? op.set.label : k, D.TEAM_LEADERS[k]]; });
            Object.keys(D.TEAM_LEADERS).forEach(function (k) { delete D.TEAM_LEADERS[k]; });
            keep.forEach(function (p) { D.TEAM_LEADERS[p[0]] = p[1]; });
          }
          D.ASSIGNEE_CHANGES.forEach(function (x) { if (x.step === 'S03:' + old) x.step = 'S03:' + op.set.label; });
        }
      }
      if (op.set.label) c.label = op.set.label;
      if (typeof op.set.use === 'boolean') c.use = op.set.use;
      if (op.set.parent) c.parent = op.set.parent; // 상위 조직(상위 코드) 바꾸기 (조직 개편 v0.31)
      refreshCodes();
    } else if (op.k === 'LOG_REVIEW') D.LOG_REVIEWS.push(Object.assign({ by: e.by, at: e.at }, op.r));
    else if (op.k === 'ACCESS_REVIEW') D.ACCESS_REVIEWS.push(Object.assign({ by: e.by, at: e.at }, op.r));
    else if (op.k === 'ALERT_DONE') {
      const a = findBy(D.SEC_ALERTS, 'id', op.id);
      if (a) { a.status = 'DONE'; a.doneBy = e.by; a.doneAt = e.at; a.action = op.action; }
    }
  }
  // 관리자 변경 남기기: area(USER, RULE, RESTRICT, PRICE, CUSTOMER, CODE, PRODUCT, TEMPLATE, AUDIT, NOTICE), 대상, 바뀐 내용, 사유, 반영할 내용
  function adminSave(area, target, change, reason, op) {
    const e = { at: nowStamp(), by: currentUser().id, area: area, target: target, change: change, reason: reason, op: op || null };
    pushDemo('admin', e);
    D.ADMIN_LOG.push(e);
    applyAdmin(e);
    return e;
  }
  // 변경 이력 (areas를 주면 그 영역만), 최근 것부터
  function adminLog(areas) {
    return D.ADMIN_LOG.filter(function (e) { return !areas || areas.indexOf(e.area) > -1; })
      .slice().sort(function (a, b) { return b.at.localeCompare(a.at); });
  }
  // 그 시각의 단계 담당자: 처음 설정(STEP_ASSIGNEE)에 그 시각까지 바꾼 이력을 차례로 적용
  function assigneeAt(code, at) {
    let id = D.STEP_ASSIGNEE[code];
    D.ASSIGNEE_CHANGES.forEach(function (x) { if (x.step === code && x.at <= at) id = x.to; });
    return id;
  }
  function assigneeOf(code) { return assigneeAt(code, '9999'); }
  // 대리 지정의 상태: 예정, 진행 중, 끝남 (날짜 기준, 기간의 처음과 끝 날 모두 포함)
  function delegationState(d) {
    if (d.endedAt || D.TODAY > d.to) return 'ENDED';
    return D.TODAY < d.from ? 'PLANNED' : 'ACTIVE';
  }
  // 지금 absentId 대신 delegateId가 처리할 수 있는 대리 지정
  function activeDelegation(absentId, delegateId) {
    return D.DELEGATIONS.filter(function (d) {
      return d.absentId === absentId && d.delegateId === delegateId && delegationState(d) === 'ACTIVE';
    })[0] || null;
  }
  // 이 사람이 지금 맡은 결재 담당: [{ key, label }] (예: ② 체크리스트 검토, ③ 영업 검토(비즈니스1유닛 리더))
  function duties(userId) {
    const out = [];
    ['S02', 'S04', 'S05', 'S06', 'S08', 'S09', 'S10'].forEach(function (code) {
      if (assigneeOf(code) === userId) out.push({ key: code, label: D.STEPS[code].no + ' ' + D.STEPS[code].name, role: D.STEPS[code].role });
    });
    // 영업 유닛: 처음 있던 유닛과 결재선 규칙에서 더한 유닛(ASSIGNEE_CHANGES의 'S03:유닛', v0.58 QA)
    const teams = Object.keys(D.TEAM_LEADERS);
    D.ASSIGNEE_CHANGES.forEach(function (x) { const t = x.step.indexOf('S03:') === 0 ? x.step.slice(4) : ''; if (t && teams.indexOf(t) < 0) teams.push(t); });
    teams.forEach(function (team) {
      if (leaderAt(team, '9999') === userId) out.push({ key: 'S03:' + team, label: D.STEPS.S03.no + ' ' + D.STEPS.S03.name + '(' + team + ' 리더)', role: 'HEAD' });
    });
    if (assigneeOf('S03') === userId) out.push({ key: 'S03', label: D.STEPS.S03.no + ' ' + D.STEPS.S03.name + '(리더 본인 계약)', role: 'EXEC' });
    return out;
  }
  // 내가 처리할 차례인지: 담당자 본인이거나, 그 담당자의 대리로 지정된 기간 안
  function isMyStep(s, user) { return s.userId === user.id || !!activeDelegation(s.userId, user.id); }
  // 이 역할 목록으로 그 단계 역할을 맡을 수 있는지: 그 역할이거나 그 분야의 리더(영업지원, 정보보호, 고객지원 리더) [가정 v0.29]
  //   결재선 규칙에서 담당자와 대신할 사람을 고를 때, 사용자 권한에서 역할을 뺄 수 있는지 볼 때 씀
  function canTake(roles, role) {
    return roles.indexOf(role) > -1 || roles.some(function (r) { return D.STEP_LEADS.indexOf(r) > -1 && D.ROLE_BASE[r] === role; });
  }
  // 리더가 보는 차례 목록: 그 분야 담당자의 차례 모두(처리는 담당자나 대리로 지정된 사람만) [가정 v0.29]
  //   예: 고객지원 리더는 ⑨, 재무 리더와 재무 임원은 ⑩(과 운영 변경의 HR 충전 ⑨)
  function isLead(user) { return user.role !== user.base; }
  function areaQueue(user, steps) {
    return pendingQueue(user, true, steps).filter(function (x) { return (D.ROLE_BASE[x.s.role] || x.s.role) === user.base; });
  }
  loadDemo('admin').forEach(function (e) { D.ADMIN_LOG.push(e); applyAdmin(e); });
  // 저장해 둔 시연 기록을 예시 데이터에 더한 뒤, 모든 계약의 결재 상태를 계산
  loadDemoActions().forEach(function (a) {
    const c = D.CONTRACTS.find(function (x) { return x.id === a.contractId; });
    if (c) { c.history = c.history || []; c.history.push(a); }
  });
  D.CONTRACTS.forEach(buildReview);

  /* ---------- 계약 묶음 (REQ-FLOW-18, 3.3 방식 C, REQ-ARC-01~03) ----------
   * 원계약 번호가 묶음 번호입니다. 변경(-A), 연장(-R), 해지(-T)는 parentId로 원계약에 연결됩니다.
   *   - 지금 유효한 계약: 끝난(계약 완료, 만료) 연장 중 가장 나중 것, 없으면 원계약
   *   - 해지 기안이 끝나면(⑩ 재무 확인) 원계약이 "해지" 상태가 됨 (REQ-FLOW-29) */
  function rootOf(c) { return c.parentId || c.id; }
  function startOf(c) { return c.startDate || (c.form && c.form.startDate) || ''; }
  function endOf(c) { return c.endDate || (c.form && c.form.endDate) || ''; }
  function applyBundleEffects() {
    D.CONTRACTS.forEach(function (t) {
      if (t.kind !== 'TERMINATE' || t.status !== 'TERMINATED') return;
      const r = D.CONTRACTS.find(function (x) { return x.id === t.parentId; });
      if (r) { r.status = 'TERMINATED'; r.terminatedAt = t.completedAt; r.terminateDate = t.terminateDate; }
    });
  }
  applyBundleEffects();
  const CHILD_LETTER = { AMEND: 'A', RENEW: 'R', TERMINATE: 'T', CHANGE: 'C' };
  // 다음 차수 번호: 2601CL001 → 2601CL001-A02
  function nextChildId(rootId, kind) {
    // 번호를 받은 기안만 셈. 임시 저장(번호 없음)까지 세면 번호가 건너뜀 (v0.63 점검에서 고침)
    const n = D.CONTRACTS.filter(function (c) { return c.id && c.parentId === rootId && c.kind === kind; }).length;
    return rootId + '-' + CHILD_LETTER[kind] + String(n + 1).padStart(2, '0');
  }
  function bundleOf(rootId) {
    const items = D.CONTRACTS.filter(function (c) { return c.id && rootOf(c) === rootId; })
      .sort(function (a, b) { return (a.requestedAt || '').localeCompare(b.requestedAt || ''); });
    const root = items.find(function (c) { return c.id === rootId; });
    if (!root) return null;
    const renewals = items.filter(function (c) { return c.kind === 'RENEW' && ['ACTIVE', 'EXPIRED'].indexOf(c.status) > -1; });
    const current = renewals.length ? renewals[renewals.length - 1] : root;
    const done = ['ACTIVE', 'EXPIRED', 'TERMINATED'];
    // 원계약이 아직 진행 중이면 원계약 상태, 끝났으면 지금 유효한 계약의 상태(해지면 해지)
    const status = done.indexOf(root.status) < 0 ? root.status : root.status === 'TERMINATED' ? 'TERMINATED' : current.status;
    // 진행 중인 변경, 연장, 연장 검토, 해지 기안(결재 중, 보완 중)과 반려되어 다시 기안을 기다리는 기안
    //   반려된 기안은 같은 종류의 새 기안을 막고 그 기안을 보완해 다시 올리게 함(다른 종류는 막지 않음, v0.58)
    const open = items.filter(function (c) { return c !== root && WORKING.concat(['SUPPLEMENT']).indexOf(c.status) > -1; });
    const rejected = items.filter(function (c) { return c !== root && c.status === 'REJECTED'; });
    // 운영 변경(기간 변경)이 끝났으면 그 종료일이 지금 유효한 계약의 종료일 (재무 문서: 끝나면 서비스 기간이 바뀜)
    const periodDone = items.filter(function (c) {
      return c.kind === 'CHANGE' && c.changeType === 'PERIOD' && c.status === 'ACTIVE' && (c.requestedAt || '') > (current === root ? '' : current.requestedAt || '');
    });
    const lastPeriod = periodDone[periodDone.length - 1];
    return {
      id: rootId, root: root, items: items, current: current, status: status, open: open, rejected: rejected,
      start: startOf(current), end: lastPeriod ? lastPeriod.endDate : endOf(current),
      autoRenew: current.autoRenew || root.autoRenew || 'NO', noticeDays: current.noticeDays || root.noticeDays || null,
      count: function (kind) { return items.filter(function (c) { return c.kind === kind; }).length; },
    };
  }
  // 모든 묶음 (작성 중은 빼고). 보관함 전체 계약(SCR-41)과 개요가 씀
  function bundles() {
    // 기존 계약은 옮기지 않으므로(C-32) 모든 후속 기안에는 이 시스템의 원계약이 있음
    return D.CONTRACTS.filter(function (c) { return c.id && !c.parentId; }).map(function (c) { return bundleOf(c.id); }).filter(Boolean);
  }
  // 만료 예정: 지금 유효한 계약이 계약 완료이고 days일 안에 끝나는 묶음 (REQ-FLOW-07, REQ-DASH-07)
  // 해지 통지 기한 (REQ-FLOW-32): 자동갱신 계약은 만료일에서 통지 일수를 뺀 날까지 상대방에게 알려야 연장을 막을 수 있음
  //   b: 묶음(autoRenew, noticeDays, end). 자동갱신이 아니거나 통지 일수가 없으면 null
  function noticeDate(b) {
    if (!b || b.autoRenew !== 'YES' || !b.noticeDays || !b.end) return null;
    return addDays(b.end, -b.noticeDays);
  }
  // 만료 예정: 지금 유효한 계약이 days일 안에 끝나는 묶음
  //   withNotice(v0.53): 해지 통지 기한이 days일 안에 오는 자동갱신 계약도 넣음(만료는 더 멀어도 기한을 놓치지 않게)
  //   순서: 다음에 오는 날(아직 지나지 않은 통지 기한, 아니면 만료일)이 가까운 순서
  function expiringBundles(days, withNotice) {
    function next(b) { const n = noticeDate(b); return n && daysUntil(n) >= 0 ? n : b.end; }
    return bundles().filter(function (b) {
      if (b.status !== 'ACTIVE' || !b.end) return false;
      const d = daysUntil(b.end), n = noticeDate(b);
      return (d >= 0 && d <= days) || (withNotice && n && daysUntil(n) >= 0 && daysUntil(n) <= days);
    }).sort(function (a, b) { return next(a).localeCompare(next(b)) || a.end.localeCompare(b.end); });
  }
  // 해지 통지 기한 한 줄: "해지 통지 기한 2026-11-01 D-13" / 지났으면 "해지 통지 기한 2026-09-15 지남"
  //   ALERT_RULES.noticeSoonDays(30일) 안이거나 지났으면 "D-13", "지남"만 강조 글자(wait-long). 좁은 칸에서도 덩어리가 짧게
  //   label: 앞 글자(자동갱신 칸 안에서는 "통지 기한"으로 줄임). 이메일은 noticeMailDays(30일, 7일) 전에 영업대표에게
  function noticeText(b, label) {
    const n = noticeDate(b);
    if (!n) return '';
    const d = daysUntil(n);
    const tag = d < 0 ? '지남' : d ? 'D-' + d : '오늘';
    // 날짜와 D-day는 한 덩어리(keep)로: 좁은 칸에서 날짜 가운데가 끊기지 않게
    return (label || '해지 통지 기한') + ' <span class="keep">' + fmtDate(n) + ' ' +
      (d <= D.ALERT_RULES.noticeSoonDays ? '<span class="wait-long">' + tag + '</span>' : tag) + '</span>';
  }

  // 다음 화면에서 한 번 보여 줄 안내 (예: 승인한 뒤 목록으로 돌아갔을 때)
  function flash(msg) { try { sessionStorage.setItem('climb.flash', msg); } catch (e) { /* 무시 */ } }

  /* ---------- HTML 조각 ---------- */
  // 안내 상자: kind 'success'(초록, 체크 아이콘) 또는 ''(경고 아이콘). body는 HTML, actions는 아래 버튼들(HTML)
  function noticeBox(kind, title, body, actions) {
    return '<div class="notice' + (kind ? ' notice--' + kind : '') + '" role="status">' +
      '<p class="notice-title">' + icon(kind === 'success' ? 'check' : 'alert') + esc(title) + '</p>' +
      (body ? '<p class="notice-body">' + body + '</p>' : '') +
      (actions ? '<div class="notice-actions">' + actions + '</div>' : '') + '</div>';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function badge(tone, text) {
    return '<span class="badge badge--' + tone + '">' + esc(text) + '</span>';
  }
  function statusBadge(c) {
    const s = D.STATUS[c.status];
    return badge(s.tone, s.label);
  }

  /* ---------- 공통 영역 그리기 ---------- */
  function renderDemoBar(user) {
    const el = document.getElementById('demo-bar');
    if (!el) return;
    // 역할 2단계: 분야마다 묶어 보여 줌 (v0.29)
    const options = D.ROLE_AREAS.map(function (g) {
      return '<optgroup label="' + esc(g.name) + '">' + Object.keys(g.roles).map(function (r) {
        const u = D.USERS[D.DEMO_PERSONA[r]];
        return '<option value="' + r + '"' + (r === user.role ? ' selected' : '') + '>' +
          esc(D.ROLES[r]) + ' (' + esc(u.name) + ')</option>';
      }).join('') + '</optgroup>';
    }).join('');
    el.className = 'demo-bar';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', '프로토타입 시연 도구');
    el.innerHTML =
      '<div class="inner">' +
        '<span class="demo-tag">프로토타입</span>' +
        '<label for="demo-role">시연용 역할 전환</label>' +
        '<select id="demo-role" class="demo-select" autocomplete="off">' + options + '</select>' +
        '<span>역할에 따라 메뉴와 개요 화면 구성이 바뀝니다. 실제 시스템에는 없는 영역입니다.</span>' +
        // 화면에서 승인, 반려, 승인 취소를 해 봤다면 처음 예시 상태로 되돌리는 버튼
        (demoCount() ? '<button type="button" class="demo-reset" id="demo-reset">시연 기록 지우기 (' + demoCount() + '건)</button>' : '') +
      '</div>';
    el.querySelector('#demo-role').addEventListener('change', function (e) {
      saveRole(e.target.value);
      const q = new URLSearchParams(location.search);
      q.set('role', e.target.value);
      location.search = '?' + q.toString();
    });
    const reset = el.querySelector('#demo-reset');
    if (reset) reset.addEventListener('click', function () {
      saveDemoActions([]);
      Object.keys(DEMO_KEYS).forEach(function (k) { try { localStorage.removeItem(DEMO_KEYS[k]); } catch (e) { /* 무시 */ } });
      flash('시연 기록을 지우고 처음 예시 상태로 돌아갔습니다.');
      location.reload();
    });
  }

  // 메뉴에 없는 화면은 어느 메뉴 아래인지 (현재 메뉴 표시, KRDS 메인 메뉴: 지금 위치를 분명히) v0.28
  const MENU_PARENT = { 'SCR-17': 'SCR-16', 'SCR-23': 'SCR-20', 'SCR-42': 'SCR-41', 'SCR-47': 'SCR-41','SCR-13': 'SCR-41', 'SCR-14': 'SCR-41', 'SCR-44': 'SCR-43', 'SCR-92': 'SCR-91' };
  function renderHeader(user, pageId) {
    const el = document.getElementById('site-header');
    if (!el) return;
    pageId = MENU_PARENT[pageId] || pageId;
    const allowed = function (m) { return user.role === 'SUPER' || !m.roles || hasRole(user, m.roles); };
    // 메뉴와 하위 메뉴를 역할에 맞게 거름. 하위 메뉴가 하나도 안 남으면 그 메뉴도 감춤
    const menu = MENU.filter(allowed).map(function (m) {
      return m.children ? Object.assign({}, m, { children: m.children.filter(allowed) }) : m;
    }).filter(function (m) { return !m.children || m.children.length; });

    const searchEntries = menuEntries(menu, pageId); // 메뉴 검색 대상(v0.60): 이 역할에 보이는 메뉴만
    const menuHtml = menu.map(function (m, i) {
      const isCurrent = m.scr === pageId || (m.children || []).some(function (c) { return c.scr === pageId; });
      const cur = isCurrent ? ' is-current' : '';
      const aria = isCurrent ? ' aria-current="page"' : '';
      if (!m.children) {
        return '<li class="gnb-item"><a class="gnb-link' + cur + '" href="' + m.href + '"' + aria + '>' + esc(m.label) + '</a></li>';
      }
      const sub = m.children.map(function (c) {
        return '<li><a href="' + c.href + '"' + (c.scr === pageId ? ' aria-current="page"' : '') + '>' + esc(c.label) + '</a></li>';
      }).join('');
      return '<li class="gnb-item">' +
        '<button type="button" class="gnb-link' + cur + '" aria-expanded="false" aria-controls="gnb-sub-' + i + '">' +
          esc(m.label) + icon('chevronDown', 'sm') +
        '</button>' +
        '<ul class="gnb-sub" id="gnb-sub-' + i + '">' + sub + '</ul>' +
      '</li>';
    }).join('');

    /* 헤더 구성 (REQ-UI-13)
     *   1줄: [심볼] climb                              [계정] [메뉴 검색]   (휴대폰은 [계정] [메뉴 검색] [≡])
     *   2줄: 무하유 계약 관리 시스템
     *   (v0.53 기획자 요청: 머리글 둘째 줄은 한글 이름. 영문 이름은 푸터와 로그인에만)
     * 오른쪽은 아이콘(v0.61 기획자 요청, 휴대폰 먼저, 같은 날 PC와 태블릿도). 아이콘 묶음은 로고 두 줄의 세로 가운데, 오른쪽 끝은 본문 오른쪽 끝.
     *   예전 오른쪽 한 줄 "조직 이름님 | 로그아웃"(v0.15~v0.60)은 계정 판 안으로 옮김(조직, 이름님, 내 계정, 로그아웃)
     *   ≡(전체 메뉴)은 휴대폰만. PC와 태블릿은 메뉴 줄이 있어 두지 않음(기획자: 휴대폰은 세로 화면을 아끼려는 것)
     * 화면 알림(종 모양, 알림 숫자)은 두지 않습니다. 알림은 이메일로 보냅니다. (REQ-ENV-09) */
    // 로그인 안 한 모양 미리 보기(프로토타입 전용, v0.61): 주소 뒤 ?demo=guest. 실제 시스템은 로그인 세션이 없을 때
    //   계정 아이콘은 선만, 누르면 로그인 화면. 메뉴 줄, 검색, 전체 메뉴는 보이지 않음(볼 권한이 없음)
    const guest = /[?&]demo=guest(&|$)/.test(location.search);
    el.className = 'site-header' + (guest ? ' is-guest' : '');
    // 머리글 아이콘 묶음. where: 'top'(로고 줄 오른쪽) 또는 'bar'(PC에서 메뉴 줄이 위에 붙었을 때 메뉴 줄 오른쪽, v0.61 기획자 선택)
    //   두 묶음의 단추는 같은 판을 엶(aria-controls가 같음). 로그인 안 한 모양은 로고 줄의 계정 아이콘(누르면 로그인 화면)만
    function hdrIcons(where) {
      if (guest) return where === 'top' ? '<a class="hdr-icon acc-btn is-guest" href="login.html" aria-label="로그인" title="로그인">' + accountIcon(false) + '</a>' : '';
      return '<button type="button" class="hdr-icon acc-btn" aria-expanded="false" aria-controls="acc-sheet" aria-label="계정: ' + esc(user.name) + '님" title="계정">' + accountIcon(true) + '</button>' +
        '<button type="button" class="hdr-icon search-btn" aria-expanded="false" aria-controls="menu-search" aria-label="메뉴 검색" title="메뉴 검색">' + icon('search') + '</button>' +
        (where === 'top' ? '<button type="button" class="hdr-icon menu-btn" aria-expanded="false" aria-controls="phone-menu" aria-label="전체 메뉴 열기">' + icon('menu') + '</button>' : '');
    }
    el.innerHTML =
      '<div class="header-top"><div class="inner">' +
        // 헤더 첫 줄: [심볼] climb (둘째 줄 한글 이름은 아래 .brand-en.is-ko)
        '<a class="brand-title" href="index.html" title="개요로 이동">' + brandTitleHtml({ mark: true }) + '</a>' +
        '<div class="user-line">' + hdrIcons('top') +
        '</div>' +
        '<span class="brand-en is-ko">' + esc(D.BRAND.ko) + '</span>' + // 둘째 줄은 한글 이름 (v0.53 기획자 요청. is-ko: 한글은 Noto Sans KR, v0.54)
        // 인쇄할 때만 보이는 출력 정보 (REQ-UI-11). 실제 시스템은 출력하는 순간의 날짜와 시각을 씁니다.
        '<p class="print-meta">' + meta(['출력일 ' + fmtDate(D.TODAY), '출력자 ' + esc((user.dept ? user.dept + ' ' : '') + user.name)]) + '</p>' +
      '</div></div>' +
      '<nav class="gnb" aria-label="주 메뉴"><div class="inner">' +
        // 옆으로 밀어 보는 틀과 양쪽 화살표(v0.43 휴대폰, v0.50부터 PC와 태블릿도). 화살표는 보조라 Tab으로는 가지 않음(메뉴 링크로 바로 감)
        '<div class="gnb-scroll"><ul class="gnb-list">' + menuHtml + '</ul>' +
          '<button type="button" class="gnb-more gnb-more--left" tabindex="-1" aria-hidden="true">' + icon('chevronLeft') + '</button>' +
          '<button type="button" class="gnb-more gnb-more--right" tabindex="-1" aria-hidden="true">' + icon('chevronRight') + '</button></div>' +
        // 메뉴 줄이 위에 붙었을 때(PC) 보이는 계정, 메뉴 검색 아이콘(v0.61 기획자 선택). 자리는 늘 잡아 두고 붙을 때만 보여 메뉴와 이용 안내가 움직이지 않음
        //   v0.60의 메뉴 줄 돋보기와 그 아래 검색 칸(.gnb-search)은 머리글 판(#menu-search)으로 합침
        (guest ? '' : '<div class="gnb-tools">' + hdrIcons('bar') + '</div>') +
        // 이용 안내(SCR-90): 메뉴 줄 오른쪽 끝 (REQ-UI-14)
        '<a class="gnb-aside' + (pageId === 'SCR-90' ? ' is-current" aria-current="page' : '') + '" href="help.html">' + icon('help', 'sm') + '<span class="gnb-aside-label">이용 안내</span></a>' +
      '</div>' +
      '</nav>' +
      // 머리글 아래로 펼쳐지는 판(v0.61, 휴대폰과 PC 모두): 계정, 메뉴 검색
      (guest ? '' :
        '<div class="hdr-sheet acc-sheet" id="acc-sheet" hidden>' +
          '<p class="acc-name">' + esc(user.name) + '님</p><p class="acc-org">' + esc(user.dept || '') + '</p>' +
          '<ul><li><a href="account.html"' + (pageId === 'SCR-93' ? ' aria-current="page"' : '') + '>' + icon('user') + '<span>내 계정</span></a></li>' +
          '<li><a href="login.html">' + icon('logout') + '<span>로그아웃</span></a></li></ul>' +
        '</div>' +
        '<div class="hdr-sheet" id="menu-search" hidden>' + menuSearchHtml('ms') + '</div>');

    // 메뉴 한 줄(v0.42 휴대폰, v0.50 기획자 요청으로 PC와 태블릿도): 다 들어가지 않으면 옆으로 밀어 봄.
    //   지금 화면의 메뉴가 보이게 미리 밀어 두고, 더 있는 쪽 끝을 흐리게 표시
    const gnbList = el.querySelector('.gnb-list');
    // 메뉴가 더 있는 쪽에 그라데이션과 화살표를 보임(v0.43). 하위 메뉴를 열어도 그대로 둠
    //   (v0.55 기획자 요청: 무언가를 눌렀을 때 고정된 곳이 바뀌지 않게. v0.42~v0.54는 열면 감췄음)
    const gnbScroll = gnbList.parentNode;
    function gnbEdge() {
      const max = gnbList.scrollWidth - gnbList.clientWidth;
      gnbScroll.classList.toggle('is-more-left', max > 2 && gnbList.scrollLeft > 2);
      gnbScroll.classList.toggle('is-more-right', max > 2 && gnbList.scrollLeft < max - 2);
    }
    gnbScroll.querySelectorAll('.gnb-more').forEach(function (b) {
      b.addEventListener('click', function () {
        const dir = b.classList.contains('gnb-more--left') ? -1 : 1;
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        gnbList.scrollBy({ left: dir * gnbList.clientWidth * 0.7, behavior: reduce ? 'auto' : 'smooth' });
      });
    });
    const gnbCur = gnbList.querySelector('.gnb-link.is-current');
    if (gnbCur && gnbList.scrollWidth > gnbList.clientWidth) {
      gnbList.scrollLeft += gnbCur.getBoundingClientRect().left - gnbList.getBoundingClientRect().left - 16;
    }
    // 하위 메뉴 자리(v0.50): 밀어 보는 줄에 잘리지 않게 .gnb-scroll 기준으로 둠(v0.55~v0.59는 연 메뉴 바로 아래 글자 폭만 한 작은 상자)
    function placeSub() {
      const item = gnbList.querySelector('.gnb-item.is-open'), sub = item && item.querySelector('.gnb-sub');
      syncDim();
      if (!sub) return;
      // (v0.60 기획자 요청) 메뉴 줄이 아래로 넓어지듯: 펼친 영역은 메뉴 줄(.gnb) 폭 그대로이고,
      //   하위 메뉴 글자는 누른 메뉴 글자와 같은 세로줄에서 시작(메뉴 칸 안쪽 여백 --gnb-pad - 하위 메뉴 칸 안쪽 1rem)
      const box = gnbScroll.getBoundingClientRect();
      const bar = el.querySelector('.gnb').getBoundingClientRect();
      const link = item.querySelector('.gnb-link').getBoundingClientRect();
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      sub.style.left = (bar.left - box.left) + 'px';
      sub.style.width = bar.width + 'px';
      const pad = parseFloat(getComputedStyle(item.querySelector('.gnb-link')).paddingLeft);
      sub.style.paddingLeft = Math.max(0, link.left - bar.left + pad - rem) + 'px';
    }
    // 하위 메뉴를 열면 메뉴 줄 아래를 막으로 덮음(v0.55 기획자 요청, 처음에는 스마트폰만이었다가 PC와 태블릿도): 메뉴를 누른 것은
    //   다른 화면으로 가려는 뜻이라 아래 화면은 덮어 두고, 막을 누르면 메뉴만 닫힘(아래 버튼이 잘못 눌리지 않게)
    //   막은 v0.60까지 흐림이었고, v0.61부터 흐림 없이 살짝 어둡게(기획자 요청: 아래 화면이 제자리에 그대로 보여 단단하게, tokens.css --overlay-menu)
    const dim = document.createElement('div');
    dim.className = 'gnb-dim';
    dim.hidden = true;
    document.body.appendChild(dim);
    let openSheet = null; // 머리글 아래로 펼친 판 가운데 열린 것(v0.61): 계정 판 또는 메뉴 검색 판
    // 막은 펼친 것이 하나라도 있으면 보임: 하위 메뉴, 머리글 판(v0.61 검토로 한곳에서 정함).
    //   예전에는 열고 닫는 곳마다 따로 켜고 꺼서, 화면 크기가 바뀌거나 다른 것을 닫을 때 판은 열린 채 막만 사라졌음
    function syncDim() {
      const open = !!gnbList.querySelector('.gnb-item.is-open') || !!openSheet;
      dim.hidden = !open;
      if (open) dim.style.top = Math.max(0, el.getBoundingClientRect().bottom) + 'px';
    }
    // 막을 누르면 펼친 것만 닫음. 막에 직접 걸어 둠(아이폰 사파리는 문서에만 걸어 둔 누름을 막에서 보내지 않을 수 있음, v0.61 검토)
    dim.addEventListener('click', function () { closeMenus(); closeSheets(false); });
    gnbList.addEventListener('scroll', function () { gnbEdge(); placeSub(); }, { passive: true });
    window.addEventListener('resize', function () { gnbEdge(); placeSub(); fitSheet(); });
    window.addEventListener('scroll', function () { if (!dim.hidden) { syncDim(); fitSheet(); } }, { passive: true });
    gnbEdge();

    // 하위 메뉴 열기·닫기
    el.querySelectorAll('button.gnb-link').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const item = btn.parentElement;
        const willOpen = !item.classList.contains('is-open');
        closeMenus();
        closeSheets(false);
        item.classList.toggle('is-open', willOpen);
        btn.setAttribute('aria-expanded', String(willOpen));
        // 밑줄을 지금 누른 메뉴로 옮김(v0.55 기획자 요청, CSS .gnb-list.has-open). 닫으면 지금 화면의 메뉴로 돌아옴
        gnbList.classList.toggle('has-open', willOpen);
        placeSub();
        gnbEdge();
      });
    });
    function closeMenus() {
      el.querySelectorAll('.gnb-item.is-open').forEach(function (item) {
        item.classList.remove('is-open');
        item.querySelector('button').setAttribute('aria-expanded', 'false');
      });
      gnbList.classList.remove('has-open');
      syncDim();
      gnbEdge();
    }

    // 펼친 곳이나 그 단추 밖으로 초점이 나가면 닫음(v0.61 검토: Tab으로 나가 흰 바탕 밑에 가려진 칸으로 초점이 가지 않게, WCAG 2.4.11).
    //   relatedTarget이 없으면(빈 곳을 누름) 그대로 둠. 마우스를 누를 때 생기는 초점 이동은 빼고 닫기는 누름(click)에서 함께 함
    //   (누르는 순간 닫혔다가 손을 떼면 다른 것이 열려 막이 깜빡였음, v0.61 두 번째 검토)
    let byPointer = false;
    document.addEventListener('pointerdown', function () { byPointer = true; setTimeout(function () { byPointer = false; }); }, true);
    const leftFor = function (e, nodes) { const t = e.relatedTarget; return !byPointer && !!t && !nodes.some(function (n) { return n.contains(t); }); };
    gnbList.querySelectorAll('.gnb-item').forEach(function (item) {
      item.addEventListener('focusout', function (e) { if (item.classList.contains('is-open') && leftFor(e, [item])) closeMenus(); });
    });

    // 머리글 판 (v0.61 기획자 요청. 휴대폰 먼저, 같은 날 PC와 태블릿도): 계정 아이콘과 돋보기를 누르면 머리글 바로 아래로 판이 펼쳐짐
    //   직각, 흰 바탕, 뒤는 어두운 막. PC는 하위 메뉴처럼 메뉴 줄이 아래로 넓어지듯(같은 자리). 한 번에 하나만
    //   계정 판: 이름님, 조직, 내 계정, 로그아웃 / 메뉴 검색 판: 검색 칸과 자주 찾는 메뉴(v0.60 PC 메뉴 줄 돋보기의 검색 칸을 합침)
    //   같은 아이콘을 다시 누르거나, 아래 막, Esc로 닫힘(Esc는 그 아이콘으로 돌아옴). Tab으로 판 밖으로 나가도 닫힘
    //   판 높이는 화면 아래를 넘지 않고 넘치면 판 안에서 밀어 봄. 키보드 순서는 보이는 순서대로(판 첫 칸에서 Shift+Tab은 그 아이콘, 끝 칸에서 Tab은 다음 아이콘)
    //   PC에서 메뉴 줄이 위에 붙으면 같은 아이콘이 메뉴 줄에도 있어 판 하나를 단추 둘이 엶(s.btns). 초점은 지금 보이는 단추로 돌려줌
    const shown = function (n) { return !!n && n.getClientRects().length > 0 && getComputedStyle(n).visibility !== 'hidden'; };
    // 머리글과 판 안의 초점 이동은 화면을 움직이지 않음: 위에 붙은 머리글 안 단추에 초점을 주면 브라우저가 scroll-padding-top만큼 화면을 올려
    //   머리글이 떨어졌음(v0.61 확인). 머리글과 판은 늘 화면에 보이므로 스크롤이 필요 없음
    const focusHere = function (n) { if (n) n.focus({ preventScroll: true }); };
    // 로고 줄과 메뉴 줄에 있는 같은 아이콘의 짝(계정끼리, 검색끼리)
    function twin(b) {
      if (!b || !b.classList || !b.classList.contains('hdr-icon')) return null;
      const kind = b.classList.contains('acc-btn') ? '.acc-btn' : b.classList.contains('search-btn') ? '.search-btn' : null;
      return kind ? el.querySelector((b.closest('.gnb-tools') ? '.user-line ' : '.gnb-tools ') + kind) : null;
    }
    function openerOf(s) { return shown(s.opener) ? s.opener : s.btns.filter(shown)[0] || s.opener; }
    function nextIcon(b) {
      let x = b.nextElementSibling;
      while (x && !(x.classList.contains('hdr-icon') && shown(x))) x = x.nextElementSibling;
      return x;
    }
    function setSheet(s, open, returnFocus) {
      s.sheet.hidden = !open;
      s.btns.forEach(function (b) { b.setAttribute('aria-expanded', String(open)); });
      if (open) {
        openSheet = s;
        fitSheet();
        focusHere(s.search ? s.search.input : s.sheet.querySelector('a'));
      } else {
        if (s.search) s.search.reset();
        if (openSheet === s) openSheet = null;
        if (returnFocus) focusHere(openerOf(s));
      }
      syncDim();
    }
    function closeSheets(returnFocus) { if (openSheet) setSheet(openSheet, false, returnFocus); }
    function fitSheet() {
      if (openSheet) openSheet.sheet.style.maxHeight = Math.max(160, window.innerHeight - el.getBoundingClientRect().bottom) + 'px';
    }
    el.querySelectorAll('.hdr-sheet').forEach(function (sheet) {
      const s = { sheet: sheet, btns: [].slice.call(el.querySelectorAll('[aria-controls="' + sheet.id + '"]')) };
      s.opener = s.btns[0];
      if (sheet.querySelector('.msearch')) s.search = wireMenuSearch(sheet.querySelector('.msearch'), searchEntries);
      // 판이나 그 아이콘 밖으로 초점이 나가면 닫음. relatedTarget이 없으면(빈 곳을 누름, 아이폰의 단추 누름) 그대로 둠
      const leave = function (e) { if (openSheet === s && leftFor(e, [sheet].concat(s.btns))) setSheet(s, false, false); };
      s.btns.forEach(function (b) {
        b.addEventListener('click', function () {
          const wasOpen = openSheet === s;
          closeMenus();
          closeSheets(false);
          s.opener = b;
          if (!wasOpen) setSheet(s, true);
        });
        b.addEventListener('focusout', leave);
      });
      sheet.addEventListener('focusout', leave);
      sheet.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab') return;
        const items = [].filter.call(sheet.querySelectorAll('a[href], button, input'), function (x) { return x.getClientRects().length; });
        const next = nextIcon(openerOf(s));
        if (e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); setSheet(s, false, true); }
        else if (!e.shiftKey && document.activeElement === items[items.length - 1] && next) { e.preventDefault(); setSheet(s, false, false); focusHere(next); }
      });
    });

    // 바깥을 누르면 닫음: 하위 메뉴, 머리글 판. 머리글 단추가 누름을 가로채지 않아(v0.61) 다른 부품(거래처 찾기 목록 등)도 함께 닫힘
    document.addEventListener('click', function (e) {
      const t = e.target;
      if (!t.closest('.gnb-item')) closeMenus();
      if (!t.closest('.hdr-sheet, .hdr-icon')) closeSheets(false);
    });

    // 휴대폰 전체 메뉴 (v0.60 기획자 요청): ≡을 누르면 Claude 문서 사이트처럼 오른쪽에서 메뉴판이 나옴(drawerHtml).
    //   1단계 메뉴에서 > 가 붙은 것을 누르면 2단계(하위 메뉴)로 들어가고, 맨 위 "‹ 메뉴 이름"으로 돌아옴
    //   열려 있는 동안: 뒤 화면은 움직이지 않음(스크롤 잠금, 스크롤바 자리는 그대로라 흔들리지 않음), 초점은 메뉴판 안에서만 돎
    //   닫기: →| 단추, 뒤 막(흐린 곳), Esc. 닫으면 ≡ 단추로 돌아옴. 사용자가 누를 때만 열리므로 팝업이 아님(REQ-ENV-15)
    //   로그인 안 한 모양(?demo=guest)에는 ≡이 없어 메뉴판도 만들지 않음
    const menuBtn = el.querySelector('.menu-btn');
    let closeDrawer = function () {};
    let drawerOpen = function () { return false; };
    let drawerHas = function () { return false; };
    if (menuBtn) {
      const drawer = document.createElement('div');
      drawer.className = 'drawer';
      drawer.id = 'phone-menu';
      drawer.hidden = true;
      drawer.innerHTML = drawerHtml(menu, pageId);
      document.body.appendChild(drawer);
      const panel = drawer.querySelector('.drawer-panel'), back = drawer.querySelector('.drawer-back'), title = drawer.querySelector('.drawer-title');
      const level1 = drawer.querySelector('.drawer-list[data-level="1"]');
      const reduceMotion = function () { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; };
      let hideTimer = 0;
      drawerOpen = function () { return drawer.classList.contains('is-open'); };
      drawerHas = function (node) { return drawer.contains(node); };
      function showLevel(groupId) {
        drawer.querySelectorAll('.drawer-list[data-level="2"]').forEach(function (l) { l.hidden = l.id !== groupId; });
        level1.hidden = !!groupId;
        back.hidden = !groupId;
        title.hidden = !!groupId;
        if (groupId) back.querySelector('.drawer-back-label').textContent = drawer.querySelector('[data-open="' + groupId + '"]').getAttribute('data-label');
        drawer.querySelector('.drawer-body').scrollTop = 0;
      }
      function openDrawer() {
        clearTimeout(hideTimer); // 닫은 직후 다시 열 때 앞서 걸어 둔 감추기가 메뉴판을 감추지 않게(v0.61 검토)
        showLevel('');
        drawer.hidden = false;
        document.documentElement.classList.add('drawer-open');
        menuBtn.setAttribute('aria-expanded', 'true');
        void panel.offsetWidth; // 보이게 한 뒤 한 번 그려 두어야 오른쪽에서 밀려 나옴. is-open은 바로 붙여 Esc 등이 열린 상태를 바로 앎(v0.61 검토)
        drawer.classList.add('is-open');
        drawer.querySelector('.drawer-close').focus();
      }
      closeDrawer = function (returnFocus) {
        if (drawer.hidden) return;
        drawer.classList.remove('is-open');
        document.documentElement.classList.remove('drawer-open');
        menuBtn.setAttribute('aria-expanded', 'false');
        clearTimeout(hideTimer);
        hideTimer = setTimeout(function () { if (!drawer.classList.contains('is-open')) drawer.hidden = true; }, reduceMotion() ? 0 : 250);
        if (returnFocus) focusHere(menuBtn);
      };
      menuBtn.addEventListener('click', function () { closeMenus(); closeSheets(false); openDrawer(); });
      drawer.querySelector('.drawer-close').addEventListener('click', function () { closeDrawer(true); });
      drawer.querySelector('.drawer-scrim').addEventListener('click', function () { closeDrawer(true); });
      drawer.querySelectorAll('[data-open]').forEach(function (b) {
        b.addEventListener('click', function () { showLevel(b.getAttribute('data-open')); back.focus(); });
      });
      back.addEventListener('click', function () {
        const from = drawer.querySelector('.drawer-list[data-level="2"]:not([hidden])');
        showLevel('');
        const btn = from && drawer.querySelector('[data-open="' + from.id + '"]');
        (btn || drawer.querySelector('.drawer-close')).focus();
      });
      // Tab이 메뉴판 밖으로 나가지 않게(확인 창과 같은 방식). 메뉴판의 빈 곳을 눌러 초점이 메뉴판 자체(.drawer-panel)에 있을 때도 맨 앞이나 맨 뒤로
      drawer.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab') return;
        const items = [].filter.call(panel.querySelectorAll('a[href], button'), function (x) { return x.getClientRects().length; });
        const first = items[0], last = items[items.length - 1], at = items.indexOf(document.activeElement);
        if (at < 0) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      });
      // 열려 있는 동안 초점이 메뉴판 밖으로 나가면 닫기 단추로 돌려놓음(aria-modal)
      document.addEventListener('focusin', function (e) {
        if (drawerOpen() && !drawer.contains(e.target)) drawer.querySelector('.drawer-close').focus();
      });
    }

    // Esc: 초점이 어디에 있든 열려 있는 것을 하나 닫음(v0.61 검토: 판 밖에서 누르면 막만 사라졌음)
    //   순서: 메뉴판 → 머리글 판(계정, 메뉴 검색) → 하위 메뉴(KRDS 메인 메뉴)
    //   초점이 펼친 곳이나 그것을 연 단추에 있었으면(또는 초점이 없으면) 그 단추로 돌려줌. 다른 칸에 있었으면 그 자리에 둠
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      const a = document.activeElement, lost = !a || a === document.body;
      if (drawerOpen()) { closeDrawer(true); return; }
      if (openSheet) { closeSheets(lost || openSheet.sheet.contains(a) || openSheet.btns.indexOf(a) >= 0); return; }
      const open = el.querySelector('.gnb-item.is-open');
      closeMenus();
      if (open && (lost || open.contains(a))) focusHere(open.querySelector('button'));
    });

    // 메뉴 줄 고정 (v0.60 기획자 요청): 화면을 내리면 로고 줄은 위로 사라지고 메뉴 줄만 맨 위에 붙어 따라옴(휴대폰은 로고 줄이 붙음).
    //   머리글 전체를 sticky로 두고 top을 로고 줄 높이만큼 위로 빼서(CSS .site-header) 메뉴 줄만 남김.
    //   --sticky-h: 화면 위에 붙어 있는 높이. 키보드로 옮겨 간 칸이 고정된 메뉴 줄에 가려지지 않게 scroll-padding-top으로 씀(WCAG 2.4.11)
    //   is-stuck: 붙어 있을 때만 메뉴 줄 아래 그림자. PC는 로고 줄 아이콘 대신 메뉴 줄 아이콘(.gnb-tools)을 보임(v0.61).
    //   로그인 안 한 모양(?demo=guest)의 PC 머리글은 붙지 않음(메뉴 줄이 없음)
    //   휴대폰과 PC 배치가 바뀌면 그쪽에서 보이지 않는 펼침은 닫음(PC는 메뉴판, 휴대폰은 하위 메뉴. 머리글 판은 두 쪽 모두에 있어 그대로).
    //   초점이 보이지 않게 된 곳에 있었으면 같은 일을 하는 보이는 자리로 옮기고 화면은 움직이지 않음(v0.61 검토, movedFocus, preventScroll)
    const headTop = el.querySelector('.header-top');
    function syncSticky() {
      const phone = isPhoneLayout();
      const fixedTop = !(guest && !phone);
      el.style.setProperty('--header-top-h', (phone ? 0 : headTop.offsetHeight) + 'px');
      document.documentElement.style.setProperty('--sticky-h', (!fixedTop ? 0 : phone ? el.offsetHeight : el.offsetHeight - headTop.offsetHeight) + 'px');
      const to = movedFocus(phone);
      if (phone) closeMenus(); else closeDrawer(false);
      markStuck();
      fitSheet();
      syncDim();
      focusHere(to);
    }
    //   휴대폰으로: 메뉴 줄의 계정, 돋보기 → 로고 줄의 같은 아이콘, 그 밖의 메뉴 줄(하위 메뉴, 이용 안내 포함) → ≡
    //   PC로: ≡이나 메뉴판 → 지금 화면의 메뉴. 메뉴 줄이 붙어 있으면 로고 줄 아이콘 → 메뉴 줄의 같은 아이콘
    //   그 배치에서도 보이는 곳에 있던 초점은 그대로(휴대폰에서 키보드가 올라와 크기가 바뀔 때 등)
    function movedFocus(phone) {
      const a = document.activeElement;
      if (!a || a === document.body) return null;
      if (phone) {
        if (!el.querySelector('.gnb').contains(a)) return null;
        return twin(a) || menuBtn || el.querySelector('.acc-btn');
      }
      if ((menuBtn && a === menuBtn) || drawerHas(a)) return el.querySelector('.gnb-link.is-current') || el.querySelector('.gnb-link');
      return null;
    }
    function markStuck() {
      const top = el.getBoundingClientRect().top;
      const now = isPhoneLayout() ? top <= 0 && window.scrollY > 0 : !guest && top <= 1 - headTop.offsetHeight;
      if (now === el.classList.contains('is-stuck')) return;
      el.classList.toggle('is-stuck', now);
      gnbEdge(); // 붙으면 메뉴 줄에 아이콘이 들어와 메뉴가 넘칠 수 있음(최고관리자): 화살표를 다시 정함
      // 붙거나 떨어지면서 초점이 있던 아이콘이 감춰지면 보이는 짝으로(PC)
      const a = document.activeElement, t = twin(a);
      if (t && !shown(a) && shown(t)) focusHere(t);
    }
    syncSticky();
    window.addEventListener('resize', syncSticky);
    window.addEventListener('scroll', markStuck, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncSticky);
  }

  /* ---------- 메뉴 검색 (v0.60 기획자 요청) ----------
   * 메뉴로 바로 가는 간단한 검색. 게시물이나 계약을 찾는 검색은 아님(목록 화면의 검색 칸을 씀)
   *   찾는 곳: 이 역할에 보이는 메뉴의 이름, 위 메뉴 이름(예: 계약 현황), 하는 일(MENU_KEYWORDS). 초성(예: ㄱㅌㄷㄱ)으로도 찾음
   *   순서: 이름이 검색어로 시작 > 이름에 들어 있음 > 하는 일에 들어 있음. 최대 8개
   *   자리: PC와 태블릿은 메뉴 줄 돋보기(아래로 넓어지는 검색 칸), 휴대폰은 머리글 돋보기(머리글 아래 검색 판, v0.61)
   *   검색어가 없으면 자주 찾는 메뉴. 찾은 것이 없으면 이용 안내로 안내
   *   키보드: 아래 화살표로 결과로, 위아래로 옮김, Enter는 첫 결과로 이동. 찾은 개수는 화면낭독기가 읽음
   *   (요구사항 정의서 8장) 앞으로 이 검색 칸을 AI 에이전트에 묻는 입력 창으로 넓히는 안이 있음. 지금은 AI 기능을 넣지 않음(REQ-ENV-12) */
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  function normKey(s) { return String(s).toLowerCase().replace(/\s+/g, ''); }
  function choseong(s) {
    return normKey(s).split('').map(function (ch) {
      const c = ch.charCodeAt(0) - 0xAC00;
      return c >= 0 && c < 11172 ? CHO[Math.floor(c / 588)] : ch;
    }).join('');
  }
  function menuEntries(menu, pageId) {
    const out = [];
    const add = function (label, path, href, scr) {
      out.push({ label: label, path: path, href: href, scr: scr, current: scr === pageId,
        name: normKey(label), cho: choseong(label), more: normKey(path + ' ' + (MENU_KEYWORDS[scr] || '')) });
    };
    menu.forEach(function (m) {
      if (m.children) m.children.forEach(function (c) { add(c.label, m.label, c.href, c.scr); });
      else add(m.label, '', m.href, m.scr);
    });
    add('이용 안내', '', 'help.html', 'SCR-90');
    add('내 계정', '', 'account.html', 'SCR-93');
    return out;
  }
  const QUICK_MENUS = ['SCR-15', 'SCR-11', 'SCR-12', 'SCR-21', 'SCR-20', 'SCR-31', 'SCR-41', 'SCR-43', 'SCR-90'];
  function findMenus(entries, q) {
    const nq = normKey(q);
    if (!nq) {
      return QUICK_MENUS.map(function (scr) { return entries.filter(function (e) { return e.scr === scr; })[0]; }).filter(Boolean).slice(0, 5);
    }
    const cho = /^[ㄱ-ㅎ]+$/.test(nq);
    return entries.map(function (e) {
      let score = -1;
      if (cho) score = e.cho.indexOf(nq) === 0 ? 3 : e.cho.indexOf(nq) > 0 ? 2 : -1;
      else score = e.name.indexOf(nq) === 0 ? 4 : e.name.indexOf(nq) > 0 ? 3 : e.more.indexOf(nq) >= 0 ? 1 : -1;
      return { e: e, s: score };
    }).filter(function (x) { return x.s >= 0; })
      .sort(function (a, b) { return b.s - a.s; }).slice(0, 8).map(function (x) { return x.e; });
  }
  function menuSearchHtml(id) {
    return '<div class="msearch" role="search">' +
      '<label class="sr-only" for="' + id + '-q">메뉴 검색</label>' +
      '<div class="msearch-box">' + icon('search') +
        '<input class="msearch-input" id="' + id + '-q" type="search" autocomplete="off" spellcheck="false" placeholder="메뉴 이름이나 하는 일로 찾기" aria-describedby="' + id + '-help"></div>' +
      '<p class="sr-only" id="' + id + '-help">초성으로도 찾습니다. 아래 화살표로 찾은 메뉴로 옮겨 갑니다.</p>' +
      '<p class="msearch-head" id="' + id + '-head"></p>' +
      '<ul class="msearch-list" aria-labelledby="' + id + '-head"></ul>' +
      '<p class="sr-only" aria-live="polite"></p>' +
    '</div>';
  }
  function wireMenuSearch(box, entries) {
    const input = box.querySelector('.msearch-input'), list = box.querySelector('.msearch-list');
    const head = box.querySelector('.msearch-head'), live = box.querySelector('[aria-live]');
    function render() {
      const q = input.value.trim();
      const found = findMenus(entries, q);
      head.textContent = q ? '찾은 메뉴 ' + found.length + '개' : '자주 찾는 메뉴';
      list.innerHTML = found.length ? found.map(function (e) {
        return '<li><a class="msearch-item" href="' + e.href + '"' + (e.current ? ' aria-current="page"' : '') + '>' +
          '<span class="msearch-label">' + esc(e.label) + '</span>' + (e.path ? '<span class="msearch-path">' + esc(e.path) + '</span>' : '') + '</a></li>';
      }).join('') : '<li class="msearch-empty">찾는 메뉴가 없습니다. <a href="help.html">이용 안내</a>에서 하는 일로 찾아보세요.</li>';
      live.textContent = q ? (found.length ? '메뉴 ' + found.length + '개를 찾았습니다.' : '찾는 메뉴가 없습니다.') : '';
    }
    input.addEventListener('input', render);
    input.addEventListener('keydown', function (e) {
      const first = list.querySelector('a');
      if (e.key === 'ArrowDown' && first) { e.preventDefault(); first.focus(); }
      if (e.key === 'Enter' && input.value.trim() && list.querySelector('a.msearch-item')) { e.preventDefault(); location.href = list.querySelector('a.msearch-item').href; }
    });
    list.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const links = [].slice.call(list.querySelectorAll('a'));
      const i = links.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      if (e.key === 'ArrowDown' && links[i + 1]) links[i + 1].focus();
      if (e.key === 'ArrowUp') (links[i - 1] || input).focus();
    });
    render();
    return { input: input, reset: function () { input.value = ''; render(); } };
  }

  /* ---------- 휴대폰 전체 메뉴판 (v0.60 기획자 요청) ----------
   * Claude 문서 사이트처럼 오른쪽에서 나오는 메뉴판. 위계가 잘 보이게 2단계로 들어감
   *   맨 위 줄: "전체 메뉴"(2단계에서는 "‹ 메뉴 이름" 뒤로 단추) + →| 닫기
   *   1단계: 개요, 계약 등록 >, 계약 현황 >, 보관함 >, (관리자 >), 공지사항. 하위 메뉴가 있으면 > 를 붙여 누르면 2단계로
   *   2단계: 그 메뉴의 하위 메뉴. 지금 화면은 진한 초록 굵은 글자(1단계에서는 지금 화면이 든 메뉴)
   *   맨 아래 묶음(선으로 나눔): 이용 안내, 내 계정. 로그아웃은 머리글 계정 판(v0.61)
   *   메뉴에서 펼쳐지는 것은 평평하게(직각, v0.59). 바탕은 흰색(기획자가 참고한 Claude 문서 사이트처럼) */
  function drawerHtml(menu, pageId) {
    const lists = [];
    const level1 = menu.map(function (m, i) {
      if (!m.children) {
        return '<li><a class="drawer-item" href="' + m.href + '"' + (m.scr === pageId ? ' aria-current="page"' : '') + '>' + esc(m.label) + '</a></li>';
      }
      const id = 'drawer-g' + i;
      const isCurrent = m.children.some(function (c) { return c.scr === pageId; });
      lists.push('<ul class="drawer-list" data-level="2" id="' + id + '" hidden>' + m.children.map(function (c) {
        return '<li><a class="drawer-item" href="' + c.href + '"' + (c.scr === pageId ? ' aria-current="page"' : '') + '>' + esc(c.label) + '</a></li>';
      }).join('') + '</ul>');
      return '<li><button type="button" class="drawer-item' + (isCurrent ? ' is-current' : '') + '" data-open="' + id + '" data-label="' + esc(m.label) + '">' +
        '<span>' + esc(m.label) + '</span>' + icon('chevronRight') + '</button></li>';
    }).join('');
    const foot = function (href, ic, label, scr) {
      return '<li><a href="' + href + '"' + (scr && scr === pageId ? ' aria-current="page"' : '') + '>' + icon(ic) + '<span>' + label + '</span></a></li>';
    };
    return '<div class="drawer-scrim"></div>' +
      '<div class="drawer-panel" tabindex="-1" role="dialog" aria-modal="true" aria-label="전체 메뉴">' +
        '<div class="drawer-top">' +
          '<p class="drawer-title">전체 메뉴</p>' +
          '<button type="button" class="drawer-back" hidden>' + icon('chevronLeft') + '<span class="drawer-back-label"></span><span class="sr-only">, 전체 메뉴로 돌아가기</span></button>' +
          '<button type="button" class="drawer-close" aria-label="메뉴 닫기">' + icon('panelClose') + '</button>' +
        '</div>' +
        '<nav class="drawer-body" aria-label="주 메뉴"><ul class="drawer-list" data-level="1">' + level1 + '</ul>' + lists.join('') + '</nav>' +
        // 맨 아래 묶음: 이용 안내, 내 계정. 로그아웃은 머리글 계정 아이콘 안으로 옮김(v0.61 기획자 요청)
        '<ul class="drawer-foot">' + foot('help.html', 'help', '이용 안내', 'SCR-90') + foot('account.html', 'user', '내 계정', 'SCR-93') + '</ul>' +
      '</div>';
  }

  // 보안 안내 문구 (REQ-UI-15): 기획자 초안을 법령, 시스템 요구사항, 어문 규범에 맞게 다듬은 문장
  //   모든 화면의 푸터와 로그인 화면(로그인 버튼 아래)에 같은 문장을 씀
  //   (v0.31 기획자 문구) 가운뎃점은 짝을 이루는 말(복제·출력·배포·반출)과 공통 성분 줄임(민·형사상)에 씀 (REQ-UI-08 개정)
  //   법령 이름은 홑낫표(「」)로 묶고 공식 제명 그대로 씀. "접속 기록과 작업 내역" 기록은 REQ-AUTH-13을 따름
  const SECURITY_NOTICE = [
    '본 시스템은 인가된 사용자만 접근할 수 있으며, 접속 기록과 작업 내역은 관계 법령과 회사 보안 정책에 따라 기록되고 보관됩니다.',
    '본 시스템에는 「부정경쟁방지 및 영업비밀보호에 관한 법률」에 따라 보호되는 영업비밀 등 회사의 기밀 정보와 「개인정보 보호법」에 따라 보호되는 개인정보가 포함되어 있습니다.',
    '허용된 권한을 넘어 열람하거나, 업무 목적 밖에서 복제·출력·배포·반출하거나, 제3자에게 제공하는 행위는 엄격히 금지됩니다.',
    '이를 위반하면 사규에 따라 징계를 받을 수 있으며, 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 등 관계 법령에 따라 민·형사상 책임을 질 수 있습니다.',
  ].join(' ');

  function renderFooter() {
    const el = document.getElementById('site-footer');
    if (!el) return;
    el.className = 'site-footer';
    el.innerHTML =
      // 푸터: 시스템 이름 + 보안 안내 문구 + 저작권. 이용 안내는 메뉴 줄로 옮기고 시스템 문의는 뺌 (REQ-UI-14, 15)
      //   시스템 이름: [심볼] climb, 그 아래 영문 이름(작게, SUITE). 한글 이름 줄(무하유 계약 관리 시스템)은 머리글에만 두고 푸터에서는 뺌(v0.55 기획자 요청)
      '<div class="inner">' +
        '<div class="footer-brand"><p class="brand-title">' + brandTitleHtml({ mark: true }) + '</p>' +
          '<span class="brand-en">' + esc(D.BRAND.en) + '</span></div>' +
        '<p class="footer-notice">' + esc(SECURITY_NOTICE) + '</p>' +
        '<p class="footer-copy">' + meta(['© 2026 ' + D.BRAND.company + ' All rights reserved.', '프로토타입 v0.1']) + '</p>' +
      '</div>';
  }

  /* ---------- 안내 메시지 ---------- */
  let toastTimer = null;
  //   KRDS 토스트: 한 문장, 안내는 2~3초, 주의는 3~4초 (v0.28). warn이 참이면 3.5초
  function toast(msg, warn) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    // 결재 문서의 처리 막대처럼 아래에 붙는 막대가 있으면 그 위에 띄움
    const bar = document.querySelector('.action-bar:not([hidden])');
    el.style.bottom = bar ? (bar.getBoundingClientRect().height + 16) + 'px' : '';
    el.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-show'); }, warn ? 3500 : 2600);
  }

  /* ---------- 확인 창 공통 (KRDS 모달, v0.28) ----------
   * Tab: 열린 창 안에서만 돌게 함(모든 화면의 확인 창에 같이 적용)
   * focusModal: 창을 열면 제목에 포커스. Enter를 바로 눌러 기안이나 반려가 되지 않게 함 */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    const open = Array.prototype.filter.call(document.querySelectorAll('.modal-backdrop'), function (m) { return !m.hidden; }).pop();
    if (!open) return;
    const items = Array.prototype.filter.call(open.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="-1"].modal-title'),
      function (x) { return x.offsetParent !== null; });
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (!open.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  function focusModal(modal) {
    const t = modal.querySelector('.modal-title');
    if (!t) return;
    t.setAttribute('tabindex', '-1');
    t.focus();
  }

  /* ---------- 입력 칸과 도움말, 오류 연결 (KWCAG, KRDS 텍스트 입력, v0.28) ----------
   * wireFields: .field 안의 입력 칸에 도움말과 오류 문장의 id를 aria-describedby로 이어 화면낭독기가 함께 읽게 함
   * setFieldError: 오류 표시 + 입력 칸에 aria-invalid. 각 화면의 오류 표시는 이 함수를 씀 */
  let fieldSeq = 0;
  function wireFields(root) {
    (root || document).querySelectorAll('.field, fieldset.field').forEach(function (f) {
      const control = f.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]), select, textarea');
      const targets = control ? [control] : Array.prototype.slice.call(f.querySelectorAll('input[type=radio], input[type=checkbox]'));
      if (!targets.length) return;
      // 이미 걸어 둔 연결(예: 두 날짜 칸이 함께 쓰는 도움말)은 남김 (v0.35)
      const ids = ((control || f).getAttribute('data-describedby') || '').split(' ').filter(Boolean);
      f.querySelectorAll(':scope > .field-help, :scope > .field-error, :scope > .input-unit ~ .field-help').forEach(function (h) {
        if (!h.id) h.id = 'fd-' + (++fieldSeq);
        if (ids.indexOf(h.id) < 0) ids.push(h.id);
      });
      if (!ids.length) return;
      // 라디오, 체크 묶음은 묶음(fieldset)에 설명을 이음. fieldset이 아닌 칸(체크 하나만 든 div)은 체크 자체에 이음:
      //   화면낭독기는 div의 aria-describedby를 읽지 않음 (v0.63 검토, 열람 제한 확인란)
      (control ? targets : f.tagName === 'FIELDSET' ? [f] : targets).forEach(function (t) { t.setAttribute('aria-describedby', ids.join(' ')); });
    });
  }
  function setFieldError(box, msg) {
    if (!box) return;
    box.classList.toggle('is-invalid', !!msg);
    const err = box.querySelector(':scope > .field-error') || box.querySelector('.field-error');
    if (err) { err.innerHTML = msg ? icon('alert', 'sm') + esc(msg) : ''; err.hidden = !msg; }
    box.querySelectorAll('input:not([type=hidden]), select, textarea').forEach(function (c) {
      if (msg) c.setAttribute('aria-invalid', 'true'); else c.removeAttribute('aria-invalid');
    });
  }

  /* ---------- 쪽 번호 (KRDS 페이지네이션) ----------
   * 목록 화면이 함께 씀. 버튼마다 data-page가 있어 화면 스크립트가 눌린 쪽 번호를 읽습니다.
   * 한 쪽에 보이는 수는 화면이 A4 2장을 넘지 않게 정한 값(REQ-ADM-04, 목록마다 20) */
  function pagerHtml(page, pages, total, from, shown, size, unit) {
    const btn = function (label, target, opts) {
      opts = opts || {};
      return '<button type="button" class="page-btn' + (opts.cls || '') + '" data-page="' + target + '"' +
        (opts.disabled ? ' disabled' : '') + (opts.current ? ' aria-current="page"' : '') +
        (opts.aria ? ' aria-label="' + opts.aria + '"' : '') + '>' + label + '</button>';
    };
    let html = btn(icon('chevronLeft', 'sm') + '<span>이전</span>', page - 1, { cls: ' page-prev', disabled: page === 1, aria: '이전 쪽' });
    // 쪽이 7개를 넘으면 처음, 끝, 지금 쪽 앞뒤 2쪽만 보이고 사이는 줄임표 (KRDS 페이지네이션, v0.28)
    const show = function (i) { return pages <= 7 || i === 1 || i === pages || Math.abs(i - page) <= 2; };
    let gap = false;
    for (let i = 1; i <= pages; i++) {
      if (!show(i)) { if (!gap) { html += '<span class="page-gap" aria-hidden="true">…</span>'; gap = true; } continue; }
      gap = false;
      html += btn(String(i), i, { cls: i === page ? ' is-current' : '', current: i === page, aria: i + '쪽' });
    }
    html += btn('<span>다음</span>' + icon('chevronRight', 'sm'), page + 1, { cls: ' page-next', disabled: page === pages, aria: '다음 쪽' });
    const range = total ? (from + 1) + '~' + (from + shown) + '번째' : '해당 없음';
    return '<div class="page-btns">' + html + '</div>' +
      '<p class="page-range">' + pages + '쪽 중 ' + page + '쪽, ' + range + ' (한 쪽에 ' + size + unit + ')</p>';
  }


  /* ---------- 관리자 화면 공통 부품 ----------
   * gate: 쓸 수 없는 역할이면 안내만 보이고 본문(#content)을 감춤 (REQ-ADM-01). 최고관리자는 모두 봄(REQ-AUTH-14)
   * fieldHtml: 입력 칸 하나(이름표, 입력칸, 도움말, 오류) / formModal: 입력 창(KRDS 모달)
   * adminHistoryHtml: 화면 아래 변경 이력 표(일시, 대상, 바뀐 내용, 사유, 바꾼 사람) */
  function gate(user, roles, title, msg) {
    if (user.role === 'SUPER' || hasRole(user, roles)) return true;
    const box = document.getElementById('notice');
    if (box) box.innerHTML = noticeBox('', title,
      msg || '지금은 ' + esc(roleLabel(user.role)) + ' 역할로 보고 있습니다. 화면 맨 위 검은 띠에서 관리자나 최고관리자로 바꾸면 볼 수 있습니다.');
    const body = document.getElementById('content');
    if (body) body.hidden = true;
    return false;
  }
  //   o: { name, label, type(text, date, number, url, select, textarea), value, options: [[값, 이름]], required, help, placeholder, unit, readonly, attrs }
  function fieldHtml(o) {
    const id = 'fm-' + o.name;
    const req = o.required ? '<span class="req" aria-hidden="true">*</span><span class="sr-only">(필수)</span>' : '';
    const ph = o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '';
    let control;
    if (o.type === 'select') {
      control = '<select class="select" id="' + id + '" name="' + o.name + '"' + (o.attrs || '') + '>' + (o.options || []).map(function (op) {
        return '<option value="' + esc(op[0]) + '"' + (String(op[0]) === String(o.value) ? ' selected' : '') + '>' + esc(op[1]) + '</option>';
      }).join('') + '</select>';
    } else if (o.type === 'textarea') {
      control = '<textarea class="textarea textarea--sm" id="' + id + '" name="' + o.name + '"' + ph + (o.attrs || '') + '>' + esc(o.value || '') + '</textarea>';
    } else {
      control = '<input class="input" id="' + id + '" name="' + o.name + '" type="' + (o.type || 'text') + '" value="' + esc(o.value == null ? '' : o.value) + '"' + ph +
        (o.readonly ? ' readonly' : '') + (o.attrs || '') + ' autocomplete="off">';
    }
    if (o.unit) control = '<div class="input-unit">' + control + '<span class="unit">' + esc(o.unit) + '</span></div>';
    return '<div class="field" data-field="' + o.name + '"><label class="field-label" for="' + id + '">' + esc(o.label) + req + '</label>' + control +
      (o.help ? '<p class="field-help">' + esc(o.help) + '</p>' : '') + '<p class="field-error" hidden></p></div>';
  }
  //   opt: { title, desc(누르면 어떻게 되는지만), body(입력 칸 HTML), btn, tone(primary, danger), open(form), check(form) → { 칸 이름: 오류 문장 }, done(form) }
  let fmLast = null;
  function closeFormModal() {
    const el = document.getElementById('form-modal');
    if (el) el.hidden = true;
    if (fmLast && fmLast.focus) fmLast.focus();
  }
  function formModal(opt) {
    let el = document.getElementById('form-modal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'form-modal';
      el.className = 'modal-backdrop';
      document.body.appendChild(el);
      el.addEventListener('click', function (e) { if (e.target === el || e.target.closest('[data-act="close"]')) closeFormModal(); });
      document.addEventListener('keydown', function (e) { if (!el.hidden && e.key === 'Escape') closeFormModal(); });
    }
    fmLast = document.activeElement;
    el.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="fm-heading">' +
      '<h2 class="modal-title" id="fm-heading">' + esc(opt.title) + '</h2>' +
      (opt.desc ? '<p class="modal-desc">' + esc(opt.desc) + '</p>' : '') +
      '<form class="modal-body modal-form" id="fm-form" novalidate>' + (opt.body || '') + '</form>' +
      '<div class="modal-actions"><button type="button" class="btn btn--tertiary btn--md" data-act="close">닫기</button>' +
      // btn: false면 보기만 하는 창(예: 이메일 미리 보기, v0.53). 닫기만 둠
      (opt.btn === false ? '' : '<button type="submit" form="fm-form" class="btn btn--' + (opt.tone || 'primary') + ' btn--md">' + esc(opt.btn || '저장') + '</button>') + '</div></div>';
    const form = el.querySelector('#fm-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const errs = (opt.check && opt.check(form)) || {};
      let first = null;
      form.querySelectorAll('[data-field]').forEach(function (f) {
        const msg = errs[f.getAttribute('data-field')];
        setFieldError(f, msg);
        if (msg && !first) first = f.querySelector('input, select, textarea');
      });
      if (first) { first.focus(); return; }
      closeFormModal();
      if (opt.done) opt.done(form);
    });
    el.hidden = false;
    wireFields(form);
    if (opt.open) opt.open(form);
    const f0 = form.querySelector('input:not([readonly]):not([disabled]), select:not([disabled]), textarea');
    (f0 || el.querySelector('[data-act="close"]')).focus();
  }
  function adminHistoryHtml(list, caption) {
    return '<div class="tbl-scroll" tabindex="0" role="region" aria-label="' + esc(caption) + '">' +
      '<table class="tbl tbl--compact tbl--history"><caption class="sr-only">' + esc(caption) + ': 일시, 대상, 바뀐 내용, 사유, 바꾼 사람</caption>' +
      '<thead><tr><th scope="col">일시</th><th scope="col" class="col-phone-wide">대상</th><th scope="col">바뀐 내용</th><th scope="col">사유</th><th scope="col">바꾼 사람</th></tr></thead><tbody>' +
      (list.length ? list.map(function (e) {
        return '<tr><td class="num-left">' + fmtDateTime(e.at).split(' ').map(function (s) { return '<span class="keep">' + s + '</span>'; }).join(' ') /* 날짜와 시각을 각각 한 줄로: "2026-" 뒤에서 끊기지 않게 (REQ-UI-25, 첫 사용 점검) */ + '</td><td>' + esc(e.target) + '</td><td>' + esc(e.change) + '</td>' +
          '<td>' + esc(e.reason) + '</td><td class="center">' + esc(e.byLabel || ownerLabel(e.by)) + '</td></tr>'; // byLabel: 사람이 아닌 기록(예: 시스템(자동))
      }).join('') : '<tr><td class="empty-row" colspan="5">아직 바꾼 기록이 없습니다.</td></tr>') + '</tbody></table></div>';
  }

  /* ---------- 워터마크 (REQ-SEC-07, REQ-ENV-11) ----------
   * "이름 이메일 일시"를 쪽 전체에 옅게 반복해 깝니다. 화면에는 보이지 않고 인쇄와 PDF 저장 때만 나옵니다(common.css).
   * 일시는 인쇄를 누른 때로 다시 찍습니다. 내려받는 PDF에도 서버가 같은 워터마크를 찍습니다(REQ-SEC-08). */
  function renderWatermark(user) {
    const account = accountOf(user.id);
    const el = document.createElement('div');
    el.className = 'watermark';
    el.setAttribute('aria-hidden', 'true');
    function draw() {
      const stamp = nowStamp().slice(0, 16);
      const text = esc((user.dept ? user.dept + ' ' : '') + user.name + (account ? ' ' + account.email : '') + ' ' + fmtDate(stamp.slice(0, 10)) + ' ' + stamp.slice(11));
      el.innerHTML = '<div class="watermark-grid">' + new Array(160).fill('<span>' + text + '</span>').join('') + '</div>';
    }
    draw();
    document.body.appendChild(el);
    window.addEventListener('beforeprint', draw);
  }

  // 휴대폰 규칙을 쓰는 화면인지(CSS의 휴대폰 규칙과 같은 조건): 폭 600px 이하이거나, 터치 화면이면서 높이 600px 이하(가로로 눕힌 스마트폰)
  //   v0.43에는 태블릿도 넣었으나 v0.50 기획자 결정으로 태블릿은 PC 화면을 씀(예전 이름 isTouchLayout)
  const PHONE_MQ = 'screen and (max-width: 600px), screen and (hover: none) and (pointer: coarse) and (max-height: 600px)';
  function isPhoneLayout() { return !!(window.matchMedia && window.matchMedia(PHONE_MQ).matches); }

  /* ---------- 날짜 입력과 달력 (KRDS 날짜 입력 필드, 달력. v0.35 기획자 요청) ----------
   * 브라우저 기본 날짜 칸은 브라우저마다 모양과 형식("연도-월-일")이 다르고 달력이 작으며 글꼴도 Noto Sans KR이 아니어서,
   * KRDS처럼 글자 칸 + 달력 버튼 + 큰 달력으로 바꿉니다. 기준은 KRDS 공식 코드(GitHub KRDS-uiux/krds-uiux)
   *   - 화면의 type=date 칸을 글자 칸으로 바꿈. 보이는 글자와 화면 코드가 읽고 쓰는 값(.value) 모두 YYYY-MM-DD(예: 2027-01-01, REQ-UI-23 v0.35)
   *     숫자만 넣을 수 있고 넣는 대로 '-'가 붙어 "2027-01-01"이 됨(v0.40, 사업자등록번호와 같은 방식). 맞지 않는 날짜는 값이 빈칸
   *     (KRDS: 달력이 있어도 직접 입력을 막지 않음, 휴대폰은 숫자 자판)
   *   - 칸 오른쪽 안의 달력 버튼(KRDS 달력 아이콘 버튼) → 달력 층: 이전 달, 연도와 월 고르기, 다음 달 / 일~토 / 날짜 / 오늘, 취소, 확인
   *     달력 폭은 날짜 칸 폭에 맞춤(PC 280~322px, 휴대폰은 칸 폭 그대로. 기획자 요청)
   *   - 날짜를 한 번 누르면 고르고, 고른 날짜를 한 번 더 누르면 확인을 누르지 않아도 바로 입력하고 닫음(v0.46 기획자 요청).
   *     이 동작은 "오늘" 버튼 아래 작은 글씨로 알려 줌. 확인 버튼도 그대로 둠(두 번 누르기를 모르는 사람)
   *   - 오늘은 굵은 글자와 아래 점, 고른 날짜는 진한 초록 원. 색만으로 구분하지 않고 화면낭독기에는 "오늘", "고른 날짜"를 읽어 줌
   *   - 앞뒤 달의 날짜는 흐리게 보이고 고를 수 없음(KRDS 코드). 고를 수 없는 날(min, max 밖)은 흐리고 줄을 그음
   *   - 키보드: 화살표(하루, 한 주), Home/End(그 주 일요일, 토요일), PageUp/PageDown(이전, 다음 달), Enter(고르기, 고른 날짜에서 한 번 더 누르면 입력), Esc(닫기),
   *     Tab은 달력 안에서만 돎. 입력 칸에서 Alt+아래 화살표로도 엶
   *   - 확인 창처럼 나중에 그려지는 날짜 칸도 같이 바꿈(MutationObserver) */
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  function isoOf(y, m, d) {
    const t = new Date(y, m, d);
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  }
  function shiftIso(s, days) { const t = parseDate(s); return isoOf(t.getFullYear(), t.getMonth(), t.getDate() + days); }
  function shiftMonth(s, n) {
    const t = parseDate(s);
    const last = new Date(t.getFullYear(), t.getMonth() + n + 1, 0).getDate();
    return isoOf(t.getFullYear(), t.getMonth() + n, Math.min(t.getDate(), last));
  }
  const cal = { el: null, input: null, btn: null, view: null, sel: '', focus: '' };
  // 짝 날짜(v0.38): 끝 칸에 data-after="시작 칸 id"가 있으면 시작일보다 앞선 날은 고를 수 없음(같은 날은 됨)
  function afterOf(i) { const id = i.getAttribute('data-after'); return id ? document.getElementById(id) : null; }
  function calMin(i) {
    const a = afterOf(i);
    return [i.min, a ? a.value : ''].filter(Boolean).sort().pop() || '';
  }
  function calOutOfRange(s) { const i = cal.input, min = calMin(i); return !!((min && s < min) || (i.max && s > i.max)); }
  function labelText(i) { return ((i.labels && i.labels[0] && i.labels[0].textContent) || '').replace(/\*|\(필수\)/g, '').trim(); }
  // 고를 수 없는 날을 눌렀을 때 달력 안에 알릴 문장
  function calWhyOff(s) {
    const i = cal.input, a = afterOf(i);
    if (a && a.value && s < a.value) return (labelText(a) || '시작일') + '(' + a.value + ')보다 앞선 날은 고를 수 없습니다.';
    if (i.min && s < i.min) return i.min + '보다 앞선 날은 고를 수 없습니다.';
    if (i.max && s > i.max) return i.max + '보다 뒤의 날은 고를 수 없습니다.';
    return '';
  }
  function calBuild() {
    const el = document.createElement('div');
    el.className = 'cal';
    el.hidden = true;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', '날짜 고르기');
    el.setAttribute('aria-describedby', 'cal-tip');
    el.innerHTML =
      '<div class="cal-head">' +
        '<button type="button" class="cal-move" data-move="-1" aria-label="이전 달">' + icon('chevronLeft') + '</button>' +
        '<div class="cal-switch">' +
          '<label class="sr-only" for="cal-year">연도</label><select class="select cal-select" id="cal-year"></select>' +
          '<label class="sr-only" for="cal-month">월</label><select class="select cal-select" id="cal-month"></select>' +
        '</div>' +
        '<button type="button" class="cal-move" data-move="1" aria-label="다음 달">' + icon('chevronRight') + '</button>' +
      '</div>' +
      '<p class="sr-only" id="cal-status" aria-live="polite"></p>' +
      '<div class="cal-body"><table class="cal-grid"><caption></caption><thead><tr>' + WEEK.map(function (w) { return '<th scope="col" abbr="' + w + '요일">' + w + '</th>'; }).join('') + '</tr></thead><tbody></tbody></table></div>' +
      '<p class="cal-note" id="cal-note" role="alert" hidden></p>' +
      '<div class="cal-foot">' +
        '<button type="button" class="btn btn--text cal-today">오늘</button>' +
        // 오늘 아래 작은 안내 (v0.46 기획자 요청). 줄은 CSS에서 버튼 아래로 내림
        '<p class="cal-tip" id="cal-tip">날짜를 한 번 더 누르면 바로 입력됩니다.</p>' +
        '<button type="button" class="btn btn--tertiary cal-cancel">취소</button>' +
        '<button type="button" class="btn btn--primary cal-ok">확인</button>' +
      '</div>';
    document.body.appendChild(el);
    let months = '';
    for (let i = 0; i < 12; i++) months += '<option value="' + i + '">' + (i + 1) + '월</option>';
    el.querySelector('#cal-month').innerHTML = months;
    el.addEventListener('click', function (e) {
      const day = e.target.closest('.cal-day');
      // 고른 날짜를 한 번 더 누르면(Enter도 같음) 바로 입력하고 닫음 (v0.46). 처음 누르면 고르기만
      if (day) { const s = day.getAttribute('data-date'); if (s === cal.sel && !calOutOfRange(s)) calOk(); else calPick(s); return; }
      const mv = e.target.closest('.cal-move');
      if (mv) { calGo(shiftMonth(cal.focus, Number(mv.getAttribute('data-move'))), mv); return; }
      if (e.target.closest('.cal-today')) { calPick(D.TODAY); return; }
      if (e.target.closest('.cal-cancel')) { calClose(true); return; }
      if (e.target.closest('.cal-ok')) calOk();
    });
    // 두 번 누르기(dblclick)는 따로 받지 않음: 첫 번째로 고르고 두 번째로 입력되므로 같은 결과 (v0.46)
    el.addEventListener('change', function (e) {
      if (e.target.id !== 'cal-year' && e.target.id !== 'cal-month') return;
      const t = parseDate(cal.focus);
      const y = Number(el.querySelector('#cal-year').value), m = Number(el.querySelector('#cal-month').value);
      const last = new Date(y, m + 1, 0).getDate();
      calGo(isoOf(y, m, Math.min(t.getDate(), last)), e.target);
    });
    el.addEventListener('keydown', calKey);
    return el;
  }
  function calRender() {
    const el = cal.el;
    const f = parseDate(cal.focus);
    const y = f.getFullYear(), m = f.getMonth();
    // 연도 목록: 오늘 앞뒤 10년, 고른 해와 min, max가 그 밖이면 넓힘
    const ty = TODAY.getFullYear();
    let lo = ty - 10, hi = ty + 10;
    if (calMin(cal.input)) lo = Math.max(lo, Number(calMin(cal.input).slice(0, 4)));
    if (cal.input.max) hi = Math.min(hi, Number(cal.input.max.slice(0, 4)));
    lo = Math.min(lo, y); hi = Math.max(hi, y);
    let opts = '';
    for (let i = lo; i <= hi; i++) opts += '<option value="' + i + '"' + (i === y ? ' selected' : '') + '>' + i + '년</option>';
    el.querySelector('#cal-year').innerHTML = opts;
    el.querySelector('#cal-month').value = String(m);
    el.querySelector('#cal-status').textContent = y + '년 ' + (m + 1) + '월';
    el.querySelector('caption').textContent = y + '년 ' + (m + 1) + '월';
    // 6주(42칸)로 늘 같은 높이
    const start = new Date(y, m, 1 - new Date(y, m, 1).getDay());
    let rows = '';
    for (let w = 0; w < 6; w++) {
      rows += '<tr>';
      for (let d = 0; d < 7; d++) {
        const t = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d);
        const s = isoOf(t.getFullYear(), t.getMonth(), t.getDate());
        const cls = ['cal-day'];
        const label = [t.getFullYear() + '년 ' + (t.getMonth() + 1) + '월 ' + t.getDate() + '일 ' + WEEK[t.getDay()] + '요일'];
        if (t.getMonth() !== m) cls.push('is-other');
        if (d === 0) cls.push('is-sun');
        if (s === D.TODAY) { cls.push('is-today'); label.push('오늘'); }
        if (s === cal.sel) { cls.push('is-selected'); label.push('고른 날짜'); }
        // 앞뒤 달 날짜는 KRDS 코드처럼 고를 수 없게(disabled). min, max 밖은 화살표로 지나갈 수 있게 aria-disabled
        const other = t.getMonth() !== m;
        const off = !other && calOutOfRange(s);
        if (off) label.push('고를 수 없음');
        rows += '<td><button type="button" class="' + cls.join(' ') + '" data-date="' + s + '" tabindex="' + (s === cal.focus ? '0' : '-1') + '"' +
          (other ? ' disabled' : '') + (off ? ' aria-disabled="true"' : '') + (s === cal.sel ? ' aria-pressed="true"' : '') + ' aria-label="' + label.join(', ') + '">' + t.getDate() + '</button></td>';
      }
      rows += '</tr>';
    }
    el.querySelector('tbody').innerHTML = rows;
    el.querySelector('.cal-today').disabled = calOutOfRange(D.TODAY);
    calNote('');
  }
  function calNote(msg) { const n = cal.el.querySelector('#cal-note'); n.textContent = msg; n.hidden = !msg; }
  // 보는 달을 바꾸고(필요하면) 그 날짜에 포커스. keep: 포커스를 남길 버튼이나 고르기 칸
  function calGo(s, keep) {
    cal.focus = s;
    calRender();
    if (keep && keep.isConnected) keep.focus();
    else { const b = cal.el.querySelector('.cal-day[data-date="' + s + '"]'); if (b) b.focus(); }
  }
  function calPick(s) {
    if (calOutOfRange(s)) { calNote(calWhyOff(s)); return; }
    cal.sel = s;
    calGo(s);
  }
  function calOk() {
    const i = cal.input;
    if (cal.sel && cal.sel !== i.value) {
      i.value = cal.sel;
      i.dispatchEvent(new Event('input', { bubbles: true }));
      i.dispatchEvent(new Event('change', { bubbles: true }));
    }
    calClose(true);
  }
  function calKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); calClose(true); return; }
    if (e.key === 'Tab') {
      // 달력 안에서만 돎 (확인 창의 Tab 돌기보다 먼저 처리)
      const items = Array.prototype.filter.call(cal.el.querySelectorAll('button:not([disabled]), select'), function (x) {
        return !x.classList.contains('cal-day') || x.getAttribute('tabindex') === '0';
      });
      const i = items.indexOf(document.activeElement);
      e.preventDefault(); e.stopPropagation();
      const next = items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length];
      if (next) next.focus();
      return;
    }
    const day = e.target.closest && e.target.closest('.cal-day');
    if (!day) return;
    const s = day.getAttribute('data-date');
    const wd = parseDate(s).getDay();
    const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -wd, End: 6 - wd }[e.key];
    if (move != null) { e.preventDefault(); calGo(shiftIso(s, move)); return; }
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      calGo(shiftMonth(s, (e.key === 'PageUp' ? -1 : 1) * (e.shiftKey ? 12 : 1)));
    }
  }
  function calPlace() {
    if (!cal.el || cal.el.hidden) return;
    const r = cal.input.parentNode.getBoundingClientRect();
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    // 폭: 날짜 칸 폭에 맞춤(v0.35 기획자 요청). PC는 280~322px, 휴대폰(600px 이하)은 칸 폭 그대로(좁은 칸이면 280px)
    const phone = isPhoneLayout();
    const fit = Math.max(280, Math.min(r.width, phone ? 400 : 322)); // 스마트폰은 칸 폭(최대 400px), PC와 태블릿은 280~322px
    cal.el.style.width = Math.round(Math.min(fit, vw - 16)) + 'px';
    const w = cal.el.offsetWidth, h = cal.el.offsetHeight;
    // 칸 왼쪽에 맞추되, A4 종이(확인 창이면 그 창)나 화면 밖으로 나가면 칸 오른쪽에 맞춤
    const box = (cal.input.closest('.modal') || cal.input.closest('.sheet') || document.documentElement).getBoundingClientRect();
    let left = r.left;
    if (left + w > Math.min(vw - 8, box.right)) left = Math.max(8, r.right - w);
    let top = r.bottom + 4;
    if (top + h > vh - 8 && r.top - 4 - h >= 8) top = r.top - 4 - h;
    cal.el.style.left = Math.round(left) + 'px';
    cal.el.style.top = Math.round(top) + 'px';
  }
  function calOpen(input, btn) {
    if (input.disabled || input.readOnly) return;
    if (!cal.el) cal.el = calBuild();
    if (!cal.el.hidden && cal.input === input) { calClose(true); return; }
    calClose(false);
    cal.input = input; cal.btn = btn;
    const v = /^\d{4}-\d{2}-\d{2}$/.test(input.value) ? input.value : '';
    cal.sel = v;
    let f = v || D.TODAY;
    const min = calMin(input);
    if (!v && min && f < min) f = min; // 종료일 칸은 비어 있으면 시작일이 있는 달부터
    if (!v && input.max && f > input.max) f = input.max;
    cal.focus = f;
    cal.el.setAttribute('aria-label', '날짜 고르기: ' + ((input.labels && input.labels[0] && input.labels[0].textContent.replace(/\*|\(필수\)/g, '').trim()) || '날짜'));
    calRender();
    cal.el.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    calPlace();
    const b = cal.el.querySelector('.cal-day[data-date="' + f + '"]');
    if (b) b.focus();
  }
  function calClose(back) {
    if (!cal.el || cal.el.hidden) return;
    cal.el.hidden = true;
    if (cal.btn) cal.btn.setAttribute('aria-expanded', 'false');
    if (back && cal.btn && cal.btn.isConnected) cal.btn.focus();
  }
  // 날짜 글자 → 값: "2026-11-01", "2026.11.1", "2026. 11. 1.", "20261101" → '2026-11-01'. 없는 날짜(2월 30일 등)는 ''
  const INPUT_VALUE = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  function isoFromText(t) {
    t = String(t || '').trim();
    const m = t.match(/^(\d{4})\D+(\d{1,2})\D+(\d{1,2})\D*$/) || t.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!m) return '';
    const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
    const dt = new Date(y, mo, d);
    return dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d ? isoOf(y, mo, d) : '';
  }
  function enhanceDates(root) {
    (root || document).querySelectorAll('input[type=date]:not([data-cal])').forEach(function (input) {
      input.setAttribute('data-cal', '');
      // 글자 칸으로 바꾸고 .value는 YYYY-MM-DD로 주고받음 (화면 코드는 그대로)
      const raw = INPUT_VALUE.get.call(input);
      input.type = 'text';
      input.setAttribute('inputmode', 'numeric');
      input.setAttribute('autocomplete', 'off');
      input.maxLength = 10;
      if (!input.placeholder) input.placeholder = 'YYYY-MM-DD'; // KRDS 날짜 입력 필드의 형식 자리 표시
      Object.defineProperty(input, 'value', {
        configurable: true,
        get: function () { return isoFromText(INPUT_VALUE.get.call(this)); },
        set: function (v) { const iso = isoFromText(v); INPUT_VALUE.set.call(this, iso ? iso : (v == null ? '' : String(v))); },
      });
      input.value = raw;
      input.defaultValue = INPUT_VALUE.get.call(input); // 초기화(reset) 때도 같은 모양
      // 숫자만 받고 넣는 대로 '-'를 붙임: 2026 → 2026-11 → 2026-11-01 (v0.40 기획자 요청, 사업자등록번호와 같은 방식)
      //   글자와 기호는 지움. 붙여 넣은 "2026.11.01"도 숫자만 남겨 맞춤
      input.addEventListener('input', function () {
        const t = INPUT_VALUE.get.call(input);
        const d = t.replace(/[^0-9]/g, '').slice(0, 8);
        const f = d.length > 6 ? d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6) : d.length > 4 ? d.slice(0, 4) + '-' + d.slice(4) : d;
        if (f !== t) INPUT_VALUE.set.call(input, f);
      });
      // 칸을 떠날 때: 8자리를 다 넣었는데 없는 날짜(13월, 2월 30일 등)면 바로 알림, 고치면 지움 (v0.40)
      const BAD_DATE = '없는 날짜입니다. 월과 일을 다시 확인하세요.';
      input.addEventListener('blur', function () {
        const t = INPUT_VALUE.get.call(input), box = input.closest('.field');
        const err = box && box.querySelector('.field-error');
        if (!err) return;
        if (t.length === 10 && !isoFromText(t)) setFieldError(box, BAD_DATE);
        else if (!err.hidden && err.textContent === BAD_DATE) setFieldError(box, '');
      });
      const wrap = document.createElement('span');
      wrap.className = 'date-input';
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'date-btn';
      btn.setAttribute('aria-haspopup', 'dialog');
      btn.setAttribute('aria-expanded', 'false');
      btn.title = '달력 열기';
      btn.innerHTML = icon('calendar') + '<span class="sr-only">달력 열기</span>';
      wrap.appendChild(btn);
      btn.addEventListener('click', function () { calOpen(input, btn); });
      input.addEventListener('keydown', function (e) { if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); calOpen(input, btn); } });
    });
  }
  // 종료일이 시작일보다 앞서면 그 칸 아래에 바로 경고 (v0.38). 고친 뒤에는 이 경고만 지움
  function checkAfter(end) {
    const start = afterOf(end), box = end.closest('.field');
    const msg = end.getAttribute('data-after-msg') || '종료일은 시작일보다 앞설 수 없습니다.';
    if (!start || !box || !box.querySelector('.field-error')) return;
    const bad = !!(start.value && end.value && end.value < start.value);
    const err = box.querySelector('.field-error');
    if (bad) setFieldError(box, msg);
    else if (!err.hidden && err.textContent === msg) setFieldError(box, '');
  }
  ['input', 'change'].forEach(function (type) {
    document.addEventListener(type, function (e) {
      const t = e.target;
      if (!t || t.tagName !== 'INPUT') return;
      if (t.hasAttribute('data-after')) checkAfter(t);
      if (t.id) document.querySelectorAll('input[data-after="' + t.id + '"]').forEach(checkAfter);
    });
  });
  // 바깥을 누르면 닫음, 화면을 움직이면 따라감
  document.addEventListener('mousedown', function (e) {
    if (cal.el && !cal.el.hidden && !cal.el.contains(e.target) && !(cal.btn && cal.btn.contains(e.target))) calClose(false);
  }, true);
  window.addEventListener('scroll', calPlace, true);
  window.addEventListener('resize', calPlace);
  if (window.MutationObserver) {
    new MutationObserver(function (list) {
      list.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (n.nodeType !== 1 || (cal.el && cal.el.contains(n))) return;
          enhanceDates(n.matches('input[type=date]') ? n.parentNode : n);
        });
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  /* ---------- 표 머리글 정렬 (v0.59 기획자 요청, REQ-UI-16) ----------
   * 머리글은 그 칸 내용과 같은 정렬: 글(고객사, 현재 진행)은 왼쪽, 짧은 칸(서비스, 상태, 날짜, 사람, 대기 일수)은 가운데,
   * 금액과 수량은 오른쪽. 내용의 정렬은 CSS(common.css 8. 표)가 정하고, 여기서는 칸마다 첫 내용의 정렬을 읽어
   * 머리글에 같은 값(data-align)을 붙임. 표를 다시 그릴 때(거르기, 쪽 넘김)와 휴대폰, PC 사이를 오갈 때도 다시 맞춤.
   * 내용이 없는 표(빈 목록)는 CSS 기본값(가운데) */
  function cellGrid(rows) { // 줄마다 [칸, 열 번호]. 합친 칸(rowspan, colspan)을 계산해 열 번호를 맞춤
    const taken = [];
    return [].map.call(rows, function (tr, r) {
      let c = 0;
      return [].map.call(tr.cells, function (cell) {
        while (taken[r] && taken[r][c]) c++;
        for (let i = 0; i < Math.max(1, cell.rowSpan); i++) {
          for (let j = 0; j < Math.max(1, cell.colSpan); j++) (taken[r + i] = taken[r + i] || [])[c + j] = true;
        }
        const at = { cell: cell, col: c };
        c += Math.max(1, cell.colSpan);
        return at;
      });
    });
  }
  function alignTableHeads() {
    document.querySelectorAll('table.tbl').forEach(function (tb) {
      if (!tb.tHead || !tb.tBodies.length) return;
      const align = {};
      [].forEach.call(tb.tBodies, function (body) {
        cellGrid(body.rows).forEach(function (line) {
          line.forEach(function (x) {
            if (x.cell.colSpan !== 1 || align[x.col] != null || !x.cell.getClientRects().length || !x.cell.textContent.trim()) return;
            const a = getComputedStyle(x.cell).textAlign;
            align[x.col] = a === 'right' || a === 'end' ? 'right' : a === 'center' ? 'center' : 'left';
          });
        });
      });
      cellGrid(tb.tHead.rows).forEach(function (line) {
        line.forEach(function (x) {
          if (x.cell.colSpan !== 1) return; // 여러 칸을 묶는 머리글은 가운데 그대로
          if (align[x.col]) x.cell.setAttribute('data-align', align[x.col]); else x.cell.removeAttribute('data-align');
        });
      });
    });
  }
  // 표 안의 날짜(2026-10-18)는 하이픈에서 줄이 바뀌지 않게 날짜마다 한 덩어리(.keep)로 묶음 (REQ-UI-25. v0.63 첫 사용 점검:
  //   칸이 좁으면 "2026-" 뒤에서 끊겼음, 화면 열다섯의 날짜 칸과 사유, 근거 글). 화면마다 칸을 고치지 않고 그린 뒤 한 번에.
  //   날짜와 시각 사이, 물결(~) 뒤에서는 그대로 줄이 바뀜. 이미 묶인 날짜(.keep, .nowrap)와 입력 칸은 건드리지 않음
  const DATE_ONE = /\d{4}-\d{2}-\d{2}/;
  function keepDates() {
    document.querySelectorAll('table td, table th').forEach(function (cell) {
      if (!DATE_ONE.test(cell.textContent)) return;
      const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, { acceptNode: function (n) {
        return n.parentNode.closest('.keep, .nowrap, script, style, textarea, option, select') || !DATE_ONE.test(n.nodeValue) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      } });
      const nodes = [];
      for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
      nodes.forEach(function (node) {
        const s = node.nodeValue, frag = document.createDocumentFragment(), rx = /\d{4}-\d{2}-\d{2}/g;
        let last = 0, m;
        while ((m = rx.exec(s))) {
          if (m.index > last) frag.appendChild(document.createTextNode(s.slice(last, m.index)));
          const span = document.createElement('span');
          span.className = 'keep';
          span.textContent = m[0];
          frag.appendChild(span);
          last = m.index + m[0].length;
        }
        if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last)));
        node.parentNode.replaceChild(frag, node);
      });
    });
  }
  let headTimer = 0;
  function alignTableHeadsSoon() {
    cancelAnimationFrame(headTimer);
    headTimer = requestAnimationFrame(function () { keepDates(); alignTableHeads(); });
  }
  if (window.MutationObserver) {
    new MutationObserver(function (list) {
      if (list.some(function (m) { return m.target.closest && m.target.closest('table, .tbl-wrap, main, .modal-backdrop'); })) alignTableHeadsSoon();
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
  if (window.matchMedia) {
    const mq = window.matchMedia(PHONE_MQ);
    if (mq.addEventListener) mq.addEventListener('change', alignTableHeadsSoon);
  }
  document.addEventListener('DOMContentLoaded', alignTableHeadsSoon);

  /* ---------- 화면 시작 ----------
   * 각 HTML의 <body data-page="SCR-xx">를 읽어 공통 영역을 그립니다. */
  function init() {
    const user = currentUser();
    const pageId = document.body.getAttribute('data-page');
    renderDemoBar(user);
    renderHeader(user, pageId);
    renderFooter();
    renderWatermark(user);
    wireFields(document);
    enhanceDates(document);
    // 앞 화면에서 남긴 안내가 있으면 한 번 보여 줌
    try {
      const msg = sessionStorage.getItem('climb.flash');
      if (msg) { sessionStorage.removeItem('climb.flash'); setTimeout(function () { toast(msg); }, 50); }
    } catch (e) { /* 무시 */ }
    return user;
  }

  /* ---------- 내보내기: 화면 코드가 쓰는 것만 (C.이름) ---------- */
  return {
    // 화면 시작, 사람과 역할
    init: init, getRole: getRole, saveRole: saveRole, hasRole: hasRole, roleLabel: roleLabel, roleShort: roleShort,
    userName: userName, ownerLabel: ownerLabel, accountOf: accountOf, teamOf: teamOf, leaderAt: leaderAt, duties: duties,
    mailPrefs: mailPrefs, saveMailPrefs: saveMailPrefs, isPhoneLayout: isPhoneLayout,
    // 날짜, 금액, 글자
    daysSince: daysSince, daysUntil: daysUntil, daysBetween: daysBetween, ddayTone: ddayTone, addDays: addDays, monthsLater: monthsLater,
    fmtDate: fmtDate, fmtDateTime: fmtDateTime, fmtPeriod: fmtPeriod, fmtToday: fmtToday, fmtKRW: fmtKRW, fmtWon: fmtWon, josa: josa, nowStamp: nowStamp,
    // 거래처, 영업기회, 제품
    isBizNo: isBizNo, fmtBizNo: fmtBizNo, isUniqueNo: isUniqueNo, ntsStatus: ntsStatus, isNewCustomer: isNewCustomer, searchBusinesses: searchBusinesses,
    isOppNo: isOppNo, pandaUrl: pandaUrl, pandaLink: pandaLink,
    serviceLabel: serviceLabel, featureLabel: featureLabel, featureText: featureText,
    // 결재 흐름 (결재선, 지금 상태, 처리)
    reviewRoute: reviewRoute, stepLabel: stepLabel, kindLabel: kindLabel, isShort: isShort, isChange: isChange, changeSales: changeSales,
    currentStep: currentStep, pendingSteps: pendingSteps, routedReview: routedReview, isReviewStep: isReviewStep, waitDays: waitDays,
    stepDots: stepDots, progressText: progressText, progressCells: progressCells, actionLabel: actionLabel, opsChecksFor: opsChecksFor, signDate: signDate, methodOf: methodOf,
    canAct: canAct, canCancel: canCancel, canResubmit: canResubmit, resubmitHref: resubmitHref, resubmitSource: resubmitSource, rejectionNotice: rejectionNotice, resubmitRecord: resubmitRecord, recordAction: recordAction, pendingQueue: pendingQueue, myActions: myActions,
    // 기안자 기준 지금 담당자 (결재선 미리 보기): C.stepUserNow('S03', { requesterId: 'u_sales1' })
    stepUserNow: function (code, c) { return stepUser(code, c, '9999'); },
    stepUserAt: stepUser,
    // 열람 권한과 지정 열람자 (v0.52)
    canView: canView, restrictedMsg: RESTRICTED_MSG,
    viewersOf: viewersOf, viewerState: viewerState, viewerKey: viewerKey, viewerLabel: viewerLabel, viewerText: viewerText,
    // 계약 묶음, 만료, 해지 통지 기한
    rootOf: rootOf, bundleOf: bundleOf, bundles: bundles, expiringBundles: expiringBundles, noticeDate: noticeDate, noticeText: noticeText,
    nextChildId: nextChildId, startOf: startOf, endOf: endOf,
    // 표준계약서 (v0.53)
    templateVersionAt: templateVersionAt, templateOf: templateOf, templateLabel: templateLabel,
    // 체결 후 의무 (v0.53)
    obligationOwner: obligationOwner, obligationOwnerLabel: obligationOwnerLabel, obligationDues: obligationDues, obligationState: obligationState,
    obligationWhenText: obligationWhenText, obligationEnd: obligationEnd, canHaveObligations: canHaveObligations, signedVersions: signedVersions, signedFateText: signedFateText, canAddObligation: canAddObligation,
    canRecordObligation: canRecordObligation, canEndObligation: canEndObligation, canSeeObligation: canSeeObligation, obligationsOf: obligationsOf,
    addObligation: addObligation, recordObligation: recordObligation, endObligation: endObligation,
    // 시연 기록 (프로토타입 전용)
    saveDemoContract: saveDemoContract,
    currentUser: currentUser, // 견적 화면이 머리글을 그리기 전에 고치기인지 보기인지 정할 때(v0.61)
    allQuotes: allQuotes, findQuote: findQuote, saveQuote: saveQuote, newQuoteNo: newQuoteNo, quoteTotals: quoteTotals, quoteStatus: quoteStatus, quoteLineOverCap: quoteLineOverCap, quoteOverCap: quoteOverCap, canSeeQuote: canSeeQuote, canEditQuote: canEditQuote, newDraftKey: newDraftKey, addNote: addNote, deleteDraft: deleteDraft, flash: flash,
    // 관리자 설정 (SCR-51~58)
    adminSave: adminSave, adminLog: adminLog, assigneeOf: assigneeOf, delegationState: delegationState, activeDelegation: activeDelegation,
    isMyStep: isMyStep, canTake: canTake, isLead: isLead, areaQueue: areaQueue, codeList: codeList,
    // 화면 조각과 부품
    esc: esc, badge: badge, statusBadge: statusBadge, icon: icon, meta: meta, noticeBox: noticeBox, toast: toast, securityNotice: SECURITY_NOTICE,
    gate: gate, fieldHtml: fieldHtml, formModal: formModal, focusModal: focusModal, setFieldError: setFieldError,
    adminHistoryHtml: adminHistoryHtml, pagerHtml: pagerHtml,
  };
})();
