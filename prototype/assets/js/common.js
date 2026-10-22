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
 *   → 열람 권한(canView, 지정 열람자) → 처리 대기 목록 → 시연 기록 → 체결 후 의무 → 관리자 설정(applyAdmin)
 *   → 계약 묶음(bundleOf, 만료 예정, 해지 통지 기한) → HTML 조각 → 헤더, 메뉴, 푸터 그리기
 *   → 안내 메시지와 확인 창 → 입력 칸 → 브레드크럼, 쪽 번호 → 관리자 화면 부품 → 워터마크, 맨 위로
 *   → 날짜 입력과 달력 → 화면 시작(init)과 내보내기
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
    // 계약 등록: 내용 작성과 기안 (REQ-FLOW-14)
    { label: '계약 등록', roles: ['SALES'], children: [
      { label: '새 계약 등록', scr: 'SCR-11', href: 'new-contract.html' },
      { label: '내 등록 목록', scr: 'SCR-12', href: 'my-contracts.html' },
    ] },
    // 계약 현황: 검토와 체결이 진행 중인 계약 (REQ-FLOW-03~05)
    { label: '계약 현황', children: [
      { label: '전체 진행 현황', scr: 'SCR-20', href: 'progress.html' },
      // 검토 대기: ②~⑤ 결재 역할과 ⑥ 총무, ⑧ 영업지원의 차례 (v0.23)
      { label: '검토 대기', scr: 'SCR-21', href: 'review-queue.html', roles: D.APPROVER_ROLES.concat(['GA']) },
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
    { label: '관리자', roles: ['ADMIN', 'PRIVACY'], children: [
      { label: '사용자 권한 관리', scr: 'SCR-51', href: 'admin-users.html', roles: ['ADMIN'] },
      { label: '결재선 규칙', scr: 'SCR-52', href: 'admin-rules.html', roles: ['ADMIN'] },
      { label: '열람 제한 관리', scr: 'SCR-53', href: 'admin-restrict.html', roles: ['ADMIN'] },
      { label: '가격 기준 관리', scr: 'SCR-54', href: 'admin-prices.html', roles: ['ADMIN'] },
      // 제품과 기능 관리 (v0.47 기획자 요청, v0.49 제품 → 기능 두 단계): 관리자와 최고관리자가 제품과 그 기능을 넣고 고침. 가격은 가격 기준 관리
      { label: '제품과 기능 관리', scr: 'SCR-58', href: 'admin-products.html', roles: ['ADMIN'] },
      { label: '거래처 관리', scr: 'SCR-55', href: 'admin-customers.html', roles: ['ADMIN'] },
      { label: '코드 관리', scr: 'SCR-56', href: 'admin-codes.html', roles: ['ADMIN'] },
      { label: '접속 기록 점검', scr: 'SCR-57', href: 'admin-logs.html', roles: ['PRIVACY'] },
    ] },
    // 공지사항: 공지와 릴리즈를 한 게시판에 (v0.45 기획자 결정: 주 메뉴 맨 끝). 읽기는 모두, 쓰기는 관리자와 최고관리자
    { label: '공지사항', scr: 'SCR-91', href: 'notices.html' },
  ];

  /* ---------- 아이콘 (선 아이콘, 글자색을 따라감) ---------- */
  const ICON_PATHS = {
    bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    check: '<circle cx="12" cy="12" r="10"/><path d="m8 12.5 2.8 2.8L16.5 9.5"/>',
    arrowUp: '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
    external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  };
  function icon(name, size) {
    const cls = 'icon' + (size ? ' icon--' + size : '');
    return '<svg class="' + cls + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON_PATHS[name] + '</svg>';
  }

  // 로고 글자 (REQ-NAME-01~06): [무하유 심볼] climb. 헤더와 푸터가 씀(둘째 줄 한글 이름, 푸터 셋째 줄 영문 이름은 그리는 곳에서)
  //   이름 climb은 로고와 브라우저 탭에만 쓰고 화면 글에는 쓰지 않음(필요하면 "플랫폼"). 로그인 화면은 로고 글자 없이 한글, 영문 이름
  //   opt.mark: 앞에 심볼(파비콘과 같은 파일)
  function brandTitleHtml(opt) {
    opt = opt || {};
    return (opt.mark ? '<img class="brand-mark" src="assets/img/favicon.svg" alt="" aria-hidden="true">' : '') +
      '<span class="brand-name">' + esc(D.BRAND.name) + '</span>';
  }

  // 여러 정보를 한 줄에 나열할 때 쓰는 묶음. 글자 '·' 대신 얇은 세로선으로 구분합니다. (REQ-UI-08)
  // items: 이미 안전하게 처리(esc)된 HTML 조각 목록. 빈 값은 빼고 표시합니다.
  function meta(items) {
    return '<span class="meta-list"><span class="meta-list-in">' +
      items.filter(Boolean).map(function (it) { return '<span>' + it + '</span>'; }).join('') +
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
    const vs = (t.versions || []).filter(function (v) { return v.from <= day; });
    return vs.length ? vs[vs.length - 1] : null;
  }
  function templateOf(c) {
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
  //   codes: ['CK', 'HR'] 같은 서비스 코드 목록 → "카피킬러, HR 서비스"
  function serviceLabel(codes) {
    return (codes || []).map(function (s) { return D.SERVICES[s] || s; }).join(', ') || '-';
  }
  /* 제품과 기능 이름 (v0.47 기획자 요청: 제품과 기능을 나눔. v0.49: 플랜을 없애고 제품 → 기능 두 단계, 가격은 기능마다)
   *   화면에는 "프리즘 결함검사"처럼 제품과 기능을 이어서 보임. r은 가격 기준 줄이나 { product, feature }
   *   프로토타입은 지금 이름으로 보여 줌. [가정] 실제 시스템은 기안할 때의 제품, 기능 이름을 계약 줄에 함께 저장 */
  function productName(id) { const p = findBy(D.PRODUCTS, 'id', id); return p ? p.name : (id || ''); }
  function featureName(id) { const f = findBy(D.FEATURES, 'id', id); return f ? f.name : (id || ''); }
  function featureLabel(r) { return r ? (productName(r.product) + ' ' + featureName(r.feature)).trim() : ''; }
  /* 서비스는 위계가 아니라 제품에 저절로 붙는 구분 (v0.49 기획자 결정. 예: 카피킬러 캠퍼스 → 카피킬러)
   *   제품 이름에 서비스 이름(끝의 "서비스"는 빼고 봄)이 들어 있으면 그 서비스. 여럿이 맞으면 긴 이름. 없으면 '' (관리자가 한 번 고름 [가정]) */
  function serviceFromName(name) {
    const n = String(name || '').replace(/\s+/g, '').toLowerCase();
    let best = '', len = 0;
    codeList('SERVICE').forEach(function (c) {
      const key = c.label.replace(/\s*서비스$/, '').replace(/\s+/g, '').toLowerCase();
      if (key && key !== '기타' && n.indexOf(key) > -1 && key.length > len) { best = c.code; len = key.length; }
    });
    return best;
  }
  // '② 체크리스트 검토'
  // c를 주면 운영 변경의 ⑨는 "운영 변경"으로 (v0.26)
  function stepLabel(code, c) { const s = D.STEPS[code]; if (c && code === 'S09' && c.kind === 'CHANGE') return s.no + ' 운영 변경'; return s ? s.no + ' ' + s.name : code; }

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
      const comment = code === 'S04' && (c.checklist || {}).standard === 'NO'
        ? '바꾼 조항 확인(조항 대비표 참고): ' + ((c.checklist || {}).standardNote || '고객 요청 조항') + '. 회사 책임 범위가 표준과 같아 승인' : '';
      return { step: code, action: 'APPROVE', at: at, comment: comment, actorId: stepUser(code, c, at), round: round };
    });
    const d06 = addDays(c.approvedAt, 1);
    const d07 = c.signedAt || addDays(c.approvedAt, 6);
    const d08 = addDays(d07, 1);
    const d09 = addDays(d08, 2);
    const d10 = addDays(d09, 1);
    const post = [
      { step: 'S06', action: 'APPROVE', at: d06 + ' 10:00', comment: '확인: ' + D.SEAL_CHECKS.join(', '), actorId: stepUser('S06', c, d06) },
      { step: 'S07', action: 'REGISTER', at: d07 + ' 14:00', comment: '', actorId: c.requesterId, fileName: c.counterparty + '_체결본.pdf' },
      { step: 'S08', action: 'APPROVE', at: d08 + ' 11:00', comment: '', actorId: stepUser('S08', c, d08) },
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
    let hold = null;
    function recompute(at) {
      let blocked = !!hold;
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
    let rejection = null, lastReturn = null, supplement = null;
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
    if (s.state !== 'DONE' || ['IN_REVIEW', 'APPROVED'].indexOf(c.status) < 0) return false;
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
      if (user.role === 'SALES' && c.requesterId === user.id && c.status === 'REJECTED') return true;
      if (c.requesterId === user.id && c.status === 'SUPPLEMENT') return true; // 보완 요청을 받은 기안자
      return WORKING.indexOf(c.status) > -1 && pendingSteps(c).some(function (s) { return isMyStep(s, user); });
    });
  }

  // 결재 단계 점: 승인 완료(채움), 현재 차례(테두리), 대기(회색), 반려(핑크). 2단계 계약 검토에서 거치는 단계만
  function stepDots(c) {
    const stateClass = { DONE: 'is-done', PENDING: 'is-current', REJECTED: 'is-rejected' };
    return '<span class="step-dots" aria-hidden="true">' + routedReview(c).map(function (a) {
      return '<span class="step-dot ' + (stateClass[a.state] || '') + '"></span>';
    }).join('') + '</span>';
  }

  // 현재 진행: 한 줄로 간단하게 (REQ-DASH-06). 개요, 진행 현황이 함께 씀
  function progressText(c) {
    if (c.status === 'DRAFT') return '임시 저장 (' + fmtDate(c.savedAt) + ')';
    if (c.status === 'REJECTED') {
      return (phaseOf(c.rejection.step) === 2 ? stepDots(c) : '') + esc(roleShort(c.rejection.role)) + ' 반려 (' + fmtDate(c.rejection.at) + ')';
    }
    // 보완 중: 어느 단계에서 보완을 요청했는지와 일수 (REQ-REV-11)
    if (c.status === 'SUPPLEMENT' && c.supplement) {
      return stepDots(c) + esc(D.STEPS[c.supplement.step].short) + ' 보완 요청 (' + daysSince(c.supplement.at) + '일째)';
    }
    // 검토 중: 지금 차례인 단계 이름. ④⑤는 동시에 차례일 수 있음 (예: 법무, 개인정보 검토 중)
    if (c.status === 'IN_REVIEW') {
      const names = pendingSteps(c).map(function (s) { return D.STEPS[s.step].short; }).join(', ');
      return stepDots(c) + esc(names) + ' 검토 중 (' + waitDays(c) + '일째)';
    }
    // 체결 대기(⑥ 인장 날인, ⑦ 체결본 등록, ⑧ 체결본 확인)와 운영 검토(⑨ 운영 적용, ⑩ 재무 확인)
    if (c.status === 'APPROVED' || c.status === 'OPS_REVIEW') {
      const p = currentStep(c);
      const label = p ? D.STEPS[p.step].no + ' ' + stepIng(c, p.step) : D.STATUS[c.status].label;
      // 짧은 결재(해지, 그대로 연장)는 체결본이 없으므로 승인 후 일수로
      // 운영 변경은 체결본이 없으므로 승인 후(영업 검토가 없으면 기안 후) 일수로
      if (isChange(c)) return esc(label) + (hasSalesReview(c) ? ' (승인 후 ' : ' (기안 후 ') + daysSince(c.approvedAt) + '일)';
      return esc(label) + (c.status === 'APPROVED' || !c.signedAt
        ? ' (승인 후 ' + daysSince(c.approvedAt) + '일)'
        : ' (체결 후 ' + daysSince(c.signedAt) + '일)');
    }
    if (c.status === 'ACTIVE' && isChange(c)) return '운영 변경 완료 (' + fmtDate(c.completedAt) + ')';
    if (c.status === 'ACTIVE') return '계약 완료 (만료 ' + fmtDate(c.endDate) + ')';
    if (c.status === 'TERMINATED') return '해지 (해지일 ' + fmtDate(c.terminateDate) + ')';
    if (c.status === 'EXPIRED') return '만료 (' + fmtDate(c.endDate) + ')';
    return '-';
  }
  // 운영 변경에 ③ 영업 검토를 거쳤는지(거쳤으면 "승인 후", 아니면 "기안 후" 일수)
  function hasSalesReview(c) { return (c.approvals || []).some(function (a) { return a.step === 'S03' && a.state !== 'SKIPPED'; }); }
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
    obligations: 'climb.demoObligations' /* 체결 후 의무(v0.53) */ };
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
  function demoCount() { return loadDemoActions().length + loadDemo('contracts').length + loadDemo('notes').length + loadDemo('deleted').length + loadDemo('admin').length + loadDemo('obligations').length; }
  // 새 계약 기록 저장 (해지 기안, 연장 검토). 실제 시스템에서는 서버에 저장
  function saveDemoContract(c) {
    pushDemo('contracts', c);
    D.CONTRACTS.push(c);
    buildReview(c);
    applyBundleEffects();
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
  loadDemo('contracts').forEach(function (c) { if (!D.CONTRACTS.some(function (x) { return x.id === c.id; })) D.CONTRACTS.push(c); });
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
    const end = (b && b.end) || monthsLater(o.first, 36);
    const out = [];
    for (let i = 0, d = o.first; d <= end && i < 120; i++, d = monthsLater(o.first, o.everyMonths * i)) out.push(d);
    return out;
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
  // 체결본이 등록된 묶음부터 의무를 더함
  function canHaveObligations(b) {
    return !!b && (['ACTIVE', 'EXPIRED', 'TERMINATED'].indexOf(b.status) > -1 ||
      b.items.some(function (c) { return (c.history || []).some(function (h) { return h.action === 'REGISTER'; }); }));
  }
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
      const a = Object.assign({ status: 'INVITED', registeredAt: day, firstLoginAt: null, lastLoginAt: null, lastLogoutAt: null, roleChangedAt: day, id: localId(op.a.email) }, op.a);
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
      D.CONTRACTS.forEach(function (c) { if (c.id === op.id) c.restricted = op.on; });
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
      if (op.set.service) {
        p.service = op.set.service;
        // 서비스는 가격이 없는 제품만 바꿀 수 있지만, 예정된 줄까지 함께 맞춤
        D.PRICE_ROWS.forEach(function (r) { if (r.product === p.id) r.service = p.service; });
      }
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
      // v0.39의 거래처별 기관(부서) 목록(op.set.units)은 v0.46에서 없앰. 예전 시연 기록에 남아 있어도 쓰지 않음
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
  // 관리자 변경 남기기: area(USER, RULE, RESTRICT, CUSTOMER, CODE, PRODUCT, AUDIT, NOTICE), 대상, 바뀐 내용, 사유, 반영할 내용
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
    Object.keys(D.TEAM_LEADERS).forEach(function (team) {
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
    const n = D.CONTRACTS.filter(function (c) { return c.parentId === rootId && c.kind === kind; }).length;
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
    // 진행 중인 변경, 연장, 연장 검토, 해지 기안
    const open = items.filter(function (c) { return c !== root && WORKING.concat(['REJECTED', 'SUPPLEMENT']).indexOf(c.status) > -1; });
    // 운영 변경(기간 변경)이 끝났으면 그 종료일이 지금 유효한 계약의 종료일 (재무 문서: 끝나면 서비스 기간이 바뀜)
    const periodDone = items.filter(function (c) {
      return c.kind === 'CHANGE' && c.changeType === 'PERIOD' && c.status === 'ACTIVE' && (c.requestedAt || '') > (current === root ? '' : current.requestedAt || '');
    });
    const lastPeriod = periodDone[periodDone.length - 1];
    return {
      id: rootId, root: root, items: items, current: current, status: status, open: open,
      start: startOf(current), end: lastPeriod ? lastPeriod.endDate : endOf(current),
      autoRenew: current.autoRenew || root.autoRenew || 'NO', noticeDays: current.noticeDays || root.noticeDays || null,
      count: function (kind) { return items.filter(function (c) { return c.kind === kind; }).length; },
    };
  }
  // 모든 묶음 (작성 중은 빼고). 보관함 전체 계약(SCR-41)과 개요가 씀
  function bundles() {
    const roots = D.CONTRACTS.filter(function (c) { return c.id && !c.parentId; });
    // 원계약이 이 시스템 밖(도입 전)이라 없는 변경 계약도 자기 묶음으로 보여 줌
    const orphans = D.CONTRACTS.filter(function (c) { return c.parentId && !D.CONTRACTS.some(function (x) { return x.id === c.parentId; }); });
    return roots.concat(orphans).map(function (c) { return bundleOf(c.id); }).filter(Boolean);
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
  // 아직 만들지 않은 화면으로 가는 링크 (누르면 안내 메시지)
  function todoAttrs(label, scr) {
    return 'href="#" data-todo="' + esc(label) + '"' + (scr ? ' data-scr="' + esc(scr) + '"' : '');
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
      location.search = '?role=' + e.target.value;
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
  const MENU_PARENT = { 'SCR-23': 'SCR-20', 'SCR-42': 'SCR-41', 'SCR-47': 'SCR-41','SCR-13': 'SCR-41', 'SCR-14': 'SCR-41', 'SCR-44': 'SCR-43', 'SCR-92': 'SCR-91' };
  function renderHeader(user, pageId) {
    const el = document.getElementById('site-header');
    if (!el) return;
    pageId = MENU_PARENT[pageId] || pageId;
    const allowed = function (m) { return user.role === 'SUPER' || !m.roles || hasRole(user, m.roles); };
    // 메뉴와 하위 메뉴를 역할에 맞게 거름. 하위 메뉴가 하나도 안 남으면 그 메뉴도 감춤
    const menu = MENU.filter(allowed).map(function (m) {
      return m.children ? Object.assign({}, m, { children: m.children.filter(allowed) }) : m;
    }).filter(function (m) { return !m.children || m.children.length; });

    const menuHtml = menu.map(function (m, i) {
      const isCurrent = m.scr === pageId || (m.children || []).some(function (c) { return c.scr === pageId; });
      const cur = isCurrent ? ' is-current' : '';
      const aria = isCurrent ? ' aria-current="page"' : '';
      if (!m.children) {
        return '<li class="gnb-item"><a class="gnb-link' + cur + '" href="' + m.href + '"' + aria + '>' + esc(m.label) + '</a></li>';
      }
      const sub = m.children.map(function (c) {
        return '<li><a ' + (c.href ? 'href="' + c.href + '"' : todoAttrs(c.label, c.scr)) + (c.scr === pageId ? ' aria-current="page"' : '') + '>' + esc(c.label) + '</a></li>';
      }).join('');
      return '<li class="gnb-item">' +
        '<button type="button" class="gnb-link' + cur + '" aria-expanded="false" aria-controls="gnb-sub-' + i + '">' +
          esc(m.label) + icon('chevronDown', 'sm') +
        '</button>' +
        '<ul class="gnb-sub" id="gnb-sub-' + i + '">' + sub + '</ul>' +
      '</li>';
    }).join('');

    /* 헤더 구성 (REQ-UI-13)
     *   1줄: [심볼] climb
     *   2줄: 무하유 계약 관리 플랫폼     [비즈니스1유닛 이도윤님 | (아이콘)로그아웃]
     *   (v0.53 기획자 요청: 머리글 둘째 줄은 한글 이름. 영문 이름은 푸터와 로그인에만)
     * 오른쪽 한 줄은 왼쪽 둘째 줄과 글자 밑선(baseline)을 맞추고, 오른쪽 끝은 본문 오른쪽 끝에 맞춥니다. (v0.15)
     * 화면 알림(종 모양, 알림 숫자)은 두지 않습니다. 알림은 이메일로 보냅니다. (REQ-ENV-09) */
    el.className = 'site-header';
    el.innerHTML =
      '<div class="header-top"><div class="inner">' +
        // 헤더 첫 줄: [심볼] climb (둘째 줄 한글 이름은 아래 .brand-en.is-ko)
        '<a class="brand-title" href="index.html" title="개요로 이동">' + brandTitleHtml({ mark: true }) + '</a>' +
        '<div class="user-line">' +
          // 이름 앞에 조직명: 비즈니스1유닛 이도윤님 | 로그아웃 (v0.29 기획자 결정. 예전에는 역할 배지)
          //   역할은 본인이 알고 관리자만 알면 되므로 헤더에 두지 않고 사용자 권한 관리에서 봄
          // 이름을 누르면 내 계정(SCR-93): 계정 정보와 받을 이메일 설정 (v0.45 기획자 요청)
          '<span class="user-org">' + esc(user.dept || '') + '</span>' +
          '<a class="user-name" href="account.html" title="내 계정"' + (pageId === 'SCR-93' ? ' aria-current="page"' : '') + '>' + esc(user.name) + '님<span class="sr-only"> (내 계정)</span></a>' +
          '<span class="util-divider" aria-hidden="true"></span>' +
          '<a class="util-link logout-link" href="login.html">' + icon('logout', 'sm') + '로그아웃</a>' +
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
        // 이용 안내(SCR-90): 메뉴 줄 오른쪽 끝 (REQ-UI-14)
        '<a class="gnb-aside' + (pageId === 'SCR-90' ? ' is-current" aria-current="page' : '') + '" href="help.html">' + icon('help', 'sm') + '<span class="gnb-aside-label">이용 안내</span></a>' +
      '</div></nav>';

    // 메뉴 한 줄(v0.42 휴대폰, v0.50 기획자 요청으로 PC와 태블릿도): 다 들어가지 않으면 옆으로 밀어 봄.
    //   지금 화면의 메뉴가 보이게 미리 밀어 두고, 더 있는 쪽 끝을 흐리게 표시
    const gnbList = el.querySelector('.gnb-list');
    // 메뉴가 더 있는 쪽에 그라데이션과 화살표를 보임(v0.43). 하위 메뉴가 열려 있으면 감춤
    const gnbScroll = gnbList.parentNode;
    function gnbEdge() {
      const max = gnbList.scrollWidth - gnbList.clientWidth;
      const open = !!gnbList.querySelector('.gnb-item.is-open');
      gnbScroll.classList.toggle('is-more-left', !open && max > 2 && gnbList.scrollLeft > 2);
      gnbScroll.classList.toggle('is-more-right', !open && max > 2 && gnbList.scrollLeft < max - 2);
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
    // 하위 메뉴 자리(v0.50): 밀어 보는 줄에 잘리지 않게 .gnb-scroll 기준으로 둠. PC와 태블릿은 연 메뉴 바로 아래(오른쪽 끝을 넘지 않게),
    //   스마트폰은 CSS대로 메뉴 줄 아래 폭 가득
    function placeSub() {
      const item = gnbList.querySelector('.gnb-item.is-open'), sub = item && item.querySelector('.gnb-sub');
      if (!sub) return;
      if (isPhoneLayout()) { sub.style.left = ''; return; }
      const box = gnbScroll.getBoundingClientRect();
      const left = item.querySelector('.gnb-link').getBoundingClientRect().left - box.left;
      sub.style.left = Math.max(0, Math.min(left, box.width - sub.offsetWidth)) + 'px';
    }
    gnbList.addEventListener('scroll', function () { gnbEdge(); placeSub(); }, { passive: true });
    window.addEventListener('resize', function () { gnbEdge(); placeSub(); });
    gnbEdge();

    // 하위 메뉴 열기·닫기
    el.querySelectorAll('button.gnb-link').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const item = btn.parentElement;
        const willOpen = !item.classList.contains('is-open');
        closeMenus();
        item.classList.toggle('is-open', willOpen);
        btn.setAttribute('aria-expanded', String(willOpen));
        placeSub();
        gnbEdge();
      });
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.gnb-item')) closeMenus(); });
    // Esc: 열린 하위 메뉴를 닫고 그 메뉴 버튼으로 포커스를 돌려줌 (KRDS 메인 메뉴)
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      const open = el.querySelector('.gnb-item.is-open');
      closeMenus();
      if (open) open.querySelector('button').focus();
    });
    function closeMenus() {
      el.querySelectorAll('.gnb-item.is-open').forEach(function (item) {
        item.classList.remove('is-open');
        item.querySelector('button').setAttribute('aria-expanded', 'false');
      });
      gnbEdge();
    }
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
      //   시스템 이름은 머리글과 같은 모양(v0.54 기획자 요청): [심볼] climb / 무하유 계약 관리 플랫폼(작게), 그 아래 영문 이름(작게). 영어는 SUITE, 한글은 Noto Sans KR
      '<div class="inner">' +
        '<div class="footer-brand"><p class="brand-title">' + brandTitleHtml({ mark: true }) + '</p>' +
          '<span class="brand-en is-ko">' + esc(D.BRAND.ko) + '</span><span class="brand-en">' + esc(D.BRAND.en) + '</span></div>' +
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
  // 아직 만들지 않은 화면 링크를 누르면 안내 (프로토타입 전용)
  document.addEventListener('click', function (e) {
    const a = e.target.closest('[data-todo]');
    if (!a) return;
    e.preventDefault();
    const scr = a.getAttribute('data-scr');
    toast('‘' + a.getAttribute('data-todo') + '’' + (scr ? ' 화면(' + scr + ')' : ' 화면') + '은 아직 시안을 만들기 전입니다.');
  });

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
      // 라디오, 체크 묶음은 묶음(fieldset)에 설명을 이음
      (control ? targets : [f]).forEach(function (t) { t.setAttribute('aria-describedby', ids.join(' ')); });
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

  /* ---------- 브레드크럼 (KRDS, 메뉴에 없는 상세 화면만, v0.28) ----------
   * items: [[이름, 주소]]. 마지막은 지금 화면(주소 없음). 맨 앞은 늘 개요 */
  function breadcrumb(items) {
    const el = document.getElementById('breadcrumb');
    if (!el) return;
    const list = [['개요', 'index.html']].concat(items);
    el.innerHTML = '<ol>' + list.map(function (it, i) {
      const last = i === list.length - 1;
      return '<li>' + (last ? '<span aria-current="page">' + esc(it[0]) + '</span>' : '<a href="' + it[1] + '">' + esc(it[0]) + '</a>') + '</li>';
    }).join('') + '</ol>';
    el.hidden = false;
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
    if (box) box.innerHTML = '<div class="notice" role="status"><p class="notice-title">' + icon('alert') + esc(title) + '</p>' +
      '<p>' + (msg || '지금은 ' + esc(roleLabel(user.role)) + ' 역할로 보고 있습니다. 화면 맨 위 검은 띠에서 관리자나 최고관리자로 바꾸면 볼 수 있습니다.') + '</p></div>';
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
    el.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="fm-title">' +
      '<h2 class="modal-title" id="fm-title">' + esc(opt.title) + '</h2>' +
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
      '<thead><tr><th scope="col">일시</th><th scope="col">대상</th><th scope="col">바뀐 내용</th><th scope="col">사유</th><th scope="col">바꾼 사람</th></tr></thead><tbody>' +
      (list.length ? list.map(function (e) {
        return '<tr><td class="num-left">' + fmtDateTime(e.at) + '</td><td>' + esc(e.target) + '</td><td>' + esc(e.change) + '</td>' +
          '<td>' + esc(e.reason) + '</td><td class="center">' + esc(e.byLabel || ownerLabel(e.by)) + '</td></tr>'; // byLabel: 사람이 아닌 기록(예: 플랫폼(자동))
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

  /* ---------- 맨 위로 이동 (KRDS 플로팅 버튼, REQ-UI-20) ----------
   * 화면을 한 화면 반쯤(400px) 내리면 오른쪽 아래에 나타나고, 누르면 맨 위로 올라가며 본문(#main) 처음으로 포커스를 옮깁니다.
   * 넓은 화면에서는 A4 종이 틀 바깥 오른쪽에, 좁은 화면에서는 화면 오른쪽 아래에 둡니다. 인쇄에서는 감춥니다. */
  function renderTopButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'to-top';
    btn.hidden = true;
    // 화살표만 보이고, 화면낭독기와 마우스를 올렸을 때는 "맨 위로" (기획자 요청 v0.30)
    btn.title = '맨 위로';
    btn.innerHTML = icon('arrowUp') + '<span class="sr-only">맨 위로</span>';
    document.body.appendChild(btn);
    // 결재 문서처럼 아래에 붙는 처리 막대가 있으면 그 위로 올려 승인 버튼을 가리지 않게 함 (KRDS: 플로팅 버튼은 하단 막대를 가리지 않음)
    const toggle = function () {
      // 맨 위에서 조금만 내려도 나타남 (기획자 요청 v0.30, 예전에는 400px)
      btn.hidden = window.scrollY < 10;
      const bar = document.querySelector('.action-bar:not([hidden])');
      btn.style.bottom = bar ? (bar.getBoundingClientRect().height + 16) + 'px' : '';
    };
    window.addEventListener('scroll', toggle, { passive: true });
    toggle();
    btn.addEventListener('click', function () {
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      const main = document.getElementById('main');
      if (main) {
        if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
        main.focus({ preventScroll: true });
      }
    });
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

  /* ---------- 화면 시작 ----------
   * 각 HTML의 <body data-page="SCR-xx">를 읽어 공통 영역을 그립니다. */
  function init() {
    const user = currentUser();
    const pageId = document.body.getAttribute('data-page');
    renderDemoBar(user);
    renderHeader(user, pageId);
    renderFooter();
    renderWatermark(user);
    renderTopButton();
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
    daysSince: daysSince, daysUntil: daysUntil, daysBetween: daysBetween, ddayTone: ddayTone, addDays: addDays, monthsLater: monthsLater, isoDate: isoDate,
    fmtDate: fmtDate, fmtDateTime: fmtDateTime, fmtPeriod: fmtPeriod, fmtToday: fmtToday, fmtKRW: fmtKRW, fmtWon: fmtWon, josa: josa, nowStamp: nowStamp,
    // 거래처, 영업기회, 제품
    isBizNo: isBizNo, fmtBizNo: fmtBizNo, isUniqueNo: isUniqueNo, ntsStatus: ntsStatus, searchBusinesses: searchBusinesses,
    isOppNo: isOppNo, pandaUrl: pandaUrl, pandaLink: pandaLink,
    serviceLabel: serviceLabel, featureName: featureName, featureLabel: featureLabel, serviceFromName: serviceFromName,
    // 결재 흐름 (결재선, 지금 상태, 처리)
    reviewRoute: reviewRoute, stepLabel: stepLabel, kindLabel: kindLabel, isShort: isShort, isChange: isChange, changeSales: changeSales,
    currentStep: currentStep, pendingSteps: pendingSteps, routedReview: routedReview, isReviewStep: isReviewStep, waitDays: waitDays,
    stepDots: stepDots, progressText: progressText, actionLabel: actionLabel, opsChecksFor: opsChecksFor, signDate: signDate, methodOf: methodOf,
    canAct: canAct, canCancel: canCancel, recordAction: recordAction, pendingQueue: pendingQueue, myActions: myActions,
    // 기안자 기준 지금 담당자 (결재선 미리 보기): C.stepUserNow('S03', { requesterId: 'u_sales1' })
    stepUserNow: function (code, c) { return stepUser(code, c, '9999'); },
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
    obligationWhenText: obligationWhenText, canHaveObligations: canHaveObligations, canAddObligation: canAddObligation,
    canRecordObligation: canRecordObligation, canEndObligation: canEndObligation, canSeeObligation: canSeeObligation, obligationsOf: obligationsOf,
    addObligation: addObligation, recordObligation: recordObligation, endObligation: endObligation,
    // 시연 기록 (프로토타입 전용)
    saveDemoContract: saveDemoContract, addNote: addNote, deleteDraft: deleteDraft, flash: flash,
    // 관리자 설정 (SCR-51~58)
    adminSave: adminSave, adminLog: adminLog, assigneeOf: assigneeOf, delegationState: delegationState, activeDelegation: activeDelegation,
    isMyStep: isMyStep, canTake: canTake, isLead: isLead, areaQueue: areaQueue, codeList: codeList,
    // 화면 조각과 부품
    esc: esc, badge: badge, statusBadge: statusBadge, icon: icon, meta: meta, toast: toast, todoAttrs: todoAttrs, securityNotice: SECURITY_NOTICE,
    gate: gate, fieldHtml: fieldHtml, formModal: formModal, focusModal: focusModal, setFieldError: setFieldError,
    adminHistoryHtml: adminHistoryHtml, breadcrumb: breadcrumb, pagerHtml: pagerHtml,
  };
})();
