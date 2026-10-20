/* =====================================================================
 * CLIMB 공통 스크립트 (common.js)
 * ---------------------------------------------------------------------
 * - 모든 화면이 같이 쓰는 기능: 헤더·메인 메뉴·푸터 그리기, 날짜·금액 표시,
 *   열람 권한 판단, 시연용 역할 전환.
 * - 프로토타입에서는 헤더·푸터를 이 파일이 그려 넣습니다(화면마다 복사하지 않기 위해).
 *   실제 시스템에서는 개발팀이 쓰는 프레임워크의 공통 레이아웃(템플릿)으로 옮기면 됩니다.
 * - mock-data.js 다음에 불러와야 합니다.
 * ===================================================================== */
window.CLIMB = (function () {
  const D = window.CLIMB_DATA;
  const ROLE_KEY = 'climb.demoRole';

  /* ---------- 메뉴 구조 (docs/02_화면목록.md 1. 메뉴 구조, REQ-UI-14) ----------
   * 개요 → 계약 등록 → 계약 현황 → 보관함 (관리자 메뉴는 관리자에게만 맨 뒤에)
   * roles: 이 메뉴(또는 하위 메뉴)가 보이는 역할. 없으면 전체에게 보임.
   *        슈퍼관리자(SUPER)는 roles와 상관없이 모든 메뉴를 봅니다. (v0.16)
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
      // 검토 대기: ②~⑤ 결재 역할과 ⑥ 총무, ⑧ 세일즈어드민의 차례 (v0.23)
      { label: '검토 대기', scr: 'SCR-21', href: 'review-queue.html', roles: D.APPROVER_ROLES.concat(['GA']) },
      { label: '검토 완료', scr: 'SCR-22', href: 'review-done.html', roles: D.PROCESS_ROLES },
      // 체결 대기: 영업이 내 계약의 체결 진행(⑥~⑧)을 보고 ⑦ 체결본을 올림 (REQ-SIGN-07)
      { label: '체결 대기', scr: 'SCR-31', href: 'signing.html', roles: ['SALES'] },
      // 운영 검토 대기: ⑨ CEM 운영 적용, ⑩ 재무 확인 (REQ-SIGN-08)
      { label: '운영 검토 대기', scr: 'SCR-34', href: 'ops-queue.html', roles: ['CEM', 'FINANCE'] },
    ] },
    // 보관함: 반려, 승인, 체결된 모든 계약을 묶음마다 (REQ-FLOW-15~16, REQ-ARC-01)
    //   계약 상세(SCR-42), 해지 기안(SCR-13), 갱신 검토(SCR-44)는 메뉴 없이 계약 상세, 만료 예정에서 들어감
    { label: '보관함', children: [
      { label: '전체 계약', scr: 'SCR-41', href: 'contracts.html' },
      { label: '만료 예정 계약', scr: 'SCR-43', href: 'expiring.html' },
    ] },
    // 관리자 메뉴는 관리자(와 슈퍼관리자)에게만 보임 (REQ-AUTH-02)
    { label: '관리자', roles: ['ADMIN'], children: [
      { label: '사용자 권한 관리', scr: 'SCR-51', href: 'admin-users.html' },
      { label: '결재선 규칙', scr: 'SCR-52' },
      { label: '열람 제한 관리', scr: 'SCR-53' },
      { label: '가격 기준 관리', scr: 'SCR-54' },
    ] },
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
  };
  function icon(name, size) {
    const cls = 'icon' + (size ? ' icon--' + size : '');
    return '<svg class="' + cls + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON_PATHS[name] + '</svg>';
  }

  // 시스템 이름 표기 (REQ-NAME-03~04, REQ-UI-03)
  //   헤더: [무하유 심볼] CLIMB / 둘째 줄 MUHAYU Contract Lifecycle Management Base (v0.22, 한글 이름은 뺌)
  //   푸터: [무하유 심볼] CLIMB | 무하유 계약 관리 플랫폼 / 둘째 줄 영문 이름 (v0.22, 심볼만 더함)
  //   로그인 화면: 심볼 없이 글자로만 (바꾸지 않음)
  //   opt.mark: CLIMB 앞에 심볼(파비콘과 같은 파일) / opt.ko: 한글 이름 붙이기 (기본 true)
  //   세로선은 글자가 아닌 선으로 그려 화면낭독기는 "CLIMB 무하유 계약 관리 플랫폼"으로 읽음
  function brandTitleHtml(opt) {
    opt = opt || {};
    return (opt.mark ? '<img class="brand-mark" src="assets/img/favicon.svg" alt="" aria-hidden="true">' : '') +
      '<span class="brand-name">' + esc(D.BRAND.name) + '</span>' +
      (opt.ko === false ? '' : '<span class="brand-sep" aria-hidden="true"></span><span class="brand-ko">' + esc(D.BRAND.ko) + '</span>');
  }
  function brandText(tag, opt) {
    return '<' + tag + ' class="brand-title">' + brandTitleHtml(opt) + '</' + tag + '>' +
      '<span class="brand-en">' + esc(D.BRAND.en) + '</span>';
  }

  // 여러 정보를 한 줄에 나열할 때 쓰는 묶음. 글자 '·' 대신 얇은 세로선으로 구분합니다. (REQ-UI-08)
  // items: 이미 안전하게 처리(esc)된 HTML 조각 목록. 빈 값은 빼고 표시합니다.
  function meta(items) {
    return '<span class="meta-list"><span class="meta-list-in">' +
      items.filter(Boolean).map(function (it) { return '<span>' + it + '</span>'; }).join('') +
    '</span></span>';
  }

  /* ---------- 시연용 역할 (프로토타입 전용) ----------
   * 주소 뒤 ?role=LEGAL 처럼 붙이거나, 화면 위 노란 띠에서 바꿉니다.
   * 실제 시스템에서는 로그인한 사용자의 역할을 서버에서 받아옵니다. */
  function getRole() {
    const fromUrl = new URLSearchParams(location.search).get('role');
    if (fromUrl && D.ROLES[fromUrl]) { saveRole(fromUrl); return fromUrl; }
    try {
      const saved = localStorage.getItem(ROLE_KEY);
      if (saved && D.ROLES[saved]) return saved;
    } catch (e) { /* 저장소를 못 쓰는 환경이면 기본 역할 사용 */ }
    return 'SUPER'; // 기본은 슈퍼관리자: 화면을 슈퍼관리자 기준으로 먼저 만듦 (v0.16)
  }
  function saveRole(role) {
    try { localStorage.setItem(ROLE_KEY, role); } catch (e) { /* 무시 */ }
  }
  function currentUser() {
    const role = getRole();
    const id = D.DEMO_PERSONA[role];
    return Object.assign({ id: id }, D.USERS[id], { role: role });
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
  function fmtDate(s) { return s ? String(s).slice(0, 10).replace(/-/g, '.') : '-'; }
  // 'YYYY-MM-DD HH:MM(:SS)' → '2026.10.15 09:40'
  function fmtDateTime(s) { return s ? String(s).slice(0, 16).replace(/-/g, '.') : '-'; }
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

  /* ---------- 계약·결재 관련 ---------- */
  function roleLabel(role) { return D.ROLES[role] || role; }
  function userName(id) { return D.USERS[id] ? D.USERS[id].name : '-'; }
  // 서비스 이름: 계약명은 따로 두지 않고 고객사와 서비스로 계약을 구분 (v0.12)
  //   codes: ['CK', 'HR'] 같은 서비스 코드 목록 → "카피킬러, HR 서비스"
  function serviceLabel(codes) {
    return (codes || []).map(function (s) { return D.SERVICES[s] || s; }).join(', ') || '-';
  }
  // '② 체크리스트 검토'
  function stepLabel(code) { const s = D.STEPS[code]; return s ? s.no + ' ' + s.name : code; }

  /* ---------- 결재 흐름 계산 (요구사항 정의서 3.5, REQ-STEP-04, REQ-DOC-06, REQ-SIGN-01~06) ----------
   * 결재 기록(history)을 시간 순서대로 다시 적용해 단계마다 지금 상태(approvals)와 계약 상태를 만듭니다.
   *   - 2단계 계약 검토(②~⑤): 체크리스트 답과 개인정보 처리 여부로 결재선을 정함. 금액 기준 없음 (REQ-CHK-05)
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
  // 짧은 결재: 해지 기안(-T)과 갱신 검토의 "그대로 자동갱신"(-R) (REQ-ARC-06, 07)
  //   ③ 부서장 → ④ 법무 → ⑨ 운영(종료, 기간 연장) → ⑩ 재무. ②, ⑤와 ⑥~⑧(날인, 체결본)은 없음
  function isShort(c) { return c.kind === 'TERMINATE' || c.renewMode === 'AUTO'; }
  // [거치는지, 까닭] (2단계 계약 검토만. 3, 4단계는 짧은 결재가 아니면 생략하는 단계가 없음)
  function reviewRoute(c) {
    if (isShort(c)) {
      const what = c.kind === 'TERMINATE' ? '해지 기안' : '갱신 검토';
      return {
        S02: [false, what + '은 체크리스트 검토 없음'], S03: [true, '부서장 승인'],
        S04: [true, '법무 승인'], S05: [false, what + '은 개인정보 검토 없음'],
      };
    }
    const ck = c.checklist || {};
    let sales;
    if (ck.price === 'NA') sales = [false, '금액이 없는 계약'];
    else if (ck.price === 'NO' && ck.cap === 'NO') sales = [true, '할인율 한도를 넘김'];
    else if (ck.price === 'NO') sales = [false, '할인율 한도 이내'];
    else sales = [false, '표준단가표를 적용함'];
    return {
      S02: [true, '어떤 경우에도 생략하지 않음'],
      S03: sales,
      S04: ck.standard === 'NO' ? [true, '표준계약서를 바꿈'] : [false, '표준계약서를 그대로 씀'],
      S05: c.personalData ? [true, '개인정보를 처리함'] : [false, '개인정보 처리 없음'],
    };
  }
  // ⑨ 운영 적용 확인 항목: 계약의 서비스마다 (서비스가 둘 이상이면 서비스 이름을 앞에 붙임)
  //   table: 해지는 OPS_CHECKS_END(닫기), 그대로 자동갱신은 OPS_CHECKS_EXTEND(기간 연장)
  function opsChecks(services, table) {
    const list = services || [];
    return list.reduce(function (out, s) {
      return out.concat(((table || D.OPS_CHECKS)[s] || []).map(function (t) { return (list.length > 1 ? (D.SERVICES[s] || s) + ' ' : '') + t; }));
    }, []);
  }
  // 이 계약의 ⑨ 확인 항목. 금액이 없는 비밀유지계약은 운영에 적용할 것이 없으므로 그 사실만 확인 [가정]
  function opsChecksFor(c) {
    if (c.kind === 'TERMINATE') return opsChecks(c.services, D.OPS_CHECKS_END);
    if (c.renewMode === 'AUTO') return opsChecks(c.services, D.OPS_CHECKS_EXTEND);
    if (c.type === '비밀유지계약(NDA)') return ['운영에 적용할 내용 없음(비밀유지계약)'];
    return opsChecks(c.services);
  }
  // 계약 구분 이름. 갱신 검토의 "그대로 자동갱신"은 따로 표시 (REQ-ARC-07)
  function kindLabel(c) { return c.kind === 'RENEW' && c.renewMode === 'AUTO' ? '갱신(그대로 연장)' : D.KINDS[c.kind] || '-'; }
  // 차례일 때 현재 진행 칸에 쓰는 말 (해지와 자동갱신의 ⑨는 운영 종료, 기간 연장)
  function stepIng(c, code) {
    if (code === 'S09' && c.kind === 'TERMINATE') return 'CEM 운영 종료 중';
    if (code === 'S09' && c.renewMode === 'AUTO') return 'CEM 기간 연장 중';
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
      return { step: code, action: 'APPROVE', at: at, comment: '', actorId: D.STEP_ASSIGNEE[code], round: round };
    });
    const d06 = addDays(c.approvedAt, 1);
    const d07 = c.signedAt || addDays(c.approvedAt, 6);
    const d08 = addDays(d07, 1);
    const d09 = addDays(d08, 2);
    const d10 = addDays(d09, 1);
    const post = [
      { step: 'S06', action: 'APPROVE', at: d06 + ' 10:00', comment: '확인: ' + D.SEAL_CHECKS.join(', '), actorId: D.STEP_ASSIGNEE.S06 },
      { step: 'S07', action: 'REGISTER', at: d07 + ' 14:00', comment: '', actorId: c.requesterId, fileName: c.counterparty + '_체결본.pdf' },
      { step: 'S08', action: 'APPROVE', at: d08 + ' 11:00', comment: '', actorId: D.STEP_ASSIGNEE.S08 },
      { step: 'S09', action: 'APPROVE', at: d09 + ' 15:00', comment: '확인: ' + opsChecksFor(c).join(', '), actorId: D.STEP_ASSIGNEE.S09 },
      { step: 'S10', action: 'APPROVE', at: d10 + ' 16:00', comment: '', actorId: D.STEP_ASSIGNEE.S10 },
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
    const noSign = c.kind === 'TERMINATE' ? '해지는 날인과 체결본 없음' : '그대로 연장은 날인과 체결본 없음';
    const steps = REVIEW_ORDER.concat(POST_ORDER).map(function (code) {
      const review = isReviewStep(code);
      // 짧은 결재는 ⑥~⑧을 거치지 않음 [가정]
      const skipSign = short && ['S06', 'S07', 'S08'].indexOf(code) > -1;
      return {
        step: code, role: D.STEPS[code].role, phase: phaseOf(code),
        // ⑦ 체결본 등록은 기안한 영업이 함
        userId: code === 'S07' ? c.requesterId : D.STEP_ASSIGNEE[code],
        state: skipSign ? 'SKIPPED' : !review || route[code][0] ? 'WAITING' : 'SKIPPED',
        reason: review ? route[code][1] : skipSign ? noSign : '',
        arrivedAt: null, decidedAt: null, decidedBy: null, onBehalfOf: null, comment: '', fileName: null,
      };
    });
    const by = {};
    steps.forEach(function (s) { by[s.step] = s; });
    // 앞 묶음이 모두 끝난 묶음까지 차례로 만들고, 그 뒤 묶음은 대기로 되돌림
    function recompute(at) {
      let blocked = false;
      ALL_GROUPS.forEach(function (group) {
        const members = group.map(function (code) { return by[code]; }).filter(function (s) { return s.state !== 'SKIPPED'; });
        members.forEach(function (s) {
          if (blocked) { if (s.state === 'PENDING') { s.state = 'WAITING'; s.arrivedAt = null; } }
          else if (s.state === 'WAITING') { s.state = 'PENDING'; s.arrivedAt = at; }
        });
        if (members.some(function (s) { return s.state !== 'DONE'; })) blocked = true;
      });
    }
    recompute(c.requestedAt);
    let rejection = null, lastReturn = null;
    c.history.filter(function (h) { return (h.round || 1) === round; }).forEach(function (h) {
      const s = by[h.step];
      if (!s) return;
      if (h.action === 'APPROVE' || h.action === 'REGISTER' || h.action === 'REJECT') {
        s.state = h.action === 'REJECT' ? 'REJECTED' : 'DONE';
        s.decidedAt = h.at; s.decidedBy = h.actorId; s.onBehalfOf = h.onBehalfOf || null; s.comment = h.comment;
        if (h.fileName) s.fileName = h.fileName;
        if (h.action === 'REJECT') rejection = { step: h.step, role: s.role, at: h.at, reason: h.comment, by: h.actorId };
      } else if (h.action === 'CANCEL') {
        s.state = 'PENDING'; s.decidedAt = null; s.decidedBy = null; s.onBehalfOf = null; s.comment = '';
      } else if (h.action === 'RETURN') {
        // ⑧ 다시 등록 요청: ⑦ 체결본 등록이 다시 차례가 되고 ⑧은 대기로 돌아감
        const s07 = by.S07;
        s07.state = 'PENDING'; s07.arrivedAt = h.at; s07.decidedAt = null; s07.decidedBy = null; s07.onBehalfOf = null; s07.comment = '';
        s.state = 'WAITING'; s.arrivedAt = null;
        lastReturn = { at: h.at, reason: h.comment, by: h.actorId };
      }
      recompute(h.at);
    });
    const review = steps.filter(function (s) { return s.phase === 2; });
    const reviewDone = !rejection && review.every(function (x) { return x.state === 'DONE' || x.state === 'SKIPPED'; });
    const done = function (code) { return by[code].state === 'DONE'; };
    const fin = function (code) { return by[code].state === 'DONE' || by[code].state === 'SKIPPED'; };
    // 다시 계산하는 상태 (해지 기안 자신은 끝나면 "해지"가 되므로 함께)
    const live = ['IN_REVIEW', 'REJECTED', 'APPROVED', 'OPS_REVIEW', 'ACTIVE'].concat(c.kind === 'TERMINATE' ? ['TERMINATED'] : []);
    if (live.indexOf(c.status) > -1) {
      c.status = rejection ? 'REJECTED' : !reviewDone ? 'IN_REVIEW'
        : done('S10') ? (c.kind === 'TERMINATE' ? 'TERMINATED' : 'ACTIVE') : fin('S08') ? 'OPS_REVIEW' : 'APPROVED';
      // 승인일: 2단계 마지막 검토가 승인된 때
      c.approvedAt = reviewDone ? review.reduce(function (m, x) { return x.decidedAt && x.decidedAt > m ? x.decidedAt : m; }, '') : null;
    }
    c.signedAt = done('S07') ? by.S07.decidedAt : null;        // 체결본을 등록한 때
    c.completedAt = done('S10') ? by.S10.decidedAt : null;     // 계약 완료(보관함)된 때
    c.approvals = steps;
    c.rejection = rejection;
    c.lastReturn = lastReturn;
    if (rejection) { c.rejectedAt = rejection.at; c.rejectReason = rejection.reason; }
  }

  function pendingSteps(c) { return (c.approvals || []).filter(function (a) { return a.state === 'PENDING'; }); }
  function currentStep(c) { return pendingSteps(c)[0] || null; }
  function routedSteps(c) { return (c.approvals || []).filter(function (a) { return a.state !== 'SKIPPED'; }); }
  // 2단계 계약 검토에서 거치는 단계만 (결재 단계 점, 몇 번째 단계인지)
  function routedReview(c) { return routedSteps(c).filter(function (a) { return a.phase === 2; }); }
  // 현재 몇 번째 결재 단계인지 (생략한 단계는 세지 않음. 예: 3단계 중 2단계)
  function stepPosition(c) {
    const list = routedReview(c);
    const idx = list.findIndex(function (a) { return a.state === 'PENDING' || a.state === 'REJECTED'; });
    return { pos: idx + 1, total: list.length };
  }
  // 결재 단계에 머문 일수 (step을 주지 않으면 지금 차례인 단계 중 가장 오래된 것)
  function waitDays(c, step) {
    const list = step ? [step] : pendingSteps(c);
    if (!list.length) return 0;
    return Math.max.apply(null, list.map(function (s) { return s.arrivedAt ? daysSince(s.arrivedAt) : 0; }));
  }
  // 이 사람이 지금 처리할 수 있는 단계인지. 슈퍼관리자는 시연용으로 담당자 대신 처리할 수 있음 (프로토타입 전용)
  function canAct(c, s, user) {
    return WORKING.indexOf(c.status) > -1 && s.state === 'PENDING' && (s.userId === user.id || user.role === 'SUPER');
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

  /* 열람 권한 (REQ-AUTH-03, REQ-AUTH-09 [가정])
   * - 열람 제한이 없는 계약: 모든 사용자 열람 가능
   * - 열람 제한 계약: 요청자 본인, 결재선과 단계 담당자(생략된 단계 제외. 총무, 세일즈어드민, CEM, 재무 포함), 관리자만 열람 가능
   * ※ 실제 시스템에서는 반드시 서버에서 판단해야 합니다. 화면에서 가리는 것만으로는 보안이 되지 않습니다. */
  function canView(c, user) {
    // 작성 중(임시 저장) 계약은 작성자 본인만 봅니다. [가정]
    if (c.status === 'DRAFT') return c.requesterId === user.id;
    if (!c.restricted) return true;
    if (user.role === 'ADMIN' || user.role === 'SUPER') return true;
    if (c.requesterId === user.id) return true;
    // 체크리스트 4번이 예면 재무도 볼 수 있음 (REQ-CHK-08)
    if (user.role === 'FINANCE' && c.checklist && c.checklist.accounting === 'YES') return true;
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
        if (all || s.userId === user.id) out.push({ c: c, s: s });
      });
    });
    return out;
  }
  // 내가 처리해야 할 계약 (개요 인사말과 '내가 검토할 계약'): 내 차례인 단계가 있는 계약
  //   영업은 ⑦ 체결본 등록 차례와 내가 기안한 반려 건
  function myActions(user) {
    return D.CONTRACTS.filter(function (c) {
      if (user.role === 'SALES' && c.requesterId === user.id && c.status === 'REJECTED') return true;
      return WORKING.indexOf(c.status) > -1 && pendingSteps(c).some(function (s) { return s.userId === user.id; });
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
      return (phaseOf(c.rejection.step) === 2 ? stepDots(c) : '') + esc(roleLabel(c.rejection.role)) + ' 반려 (' + fmtDate(c.rejection.at) + ')';
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
      return esc(label) + (c.status === 'APPROVED' || !c.signedAt
        ? ' (승인 후 ' + daysSince(c.approvedAt) + '일)'
        : ' (체결 후 ' + daysSince(c.signedAt) + '일)');
    }
    if (c.status === 'ACTIVE') return '계약 완료 (만료 ' + fmtDate(c.endDate) + ')';
    if (c.status === 'TERMINATED') return '해지 (해지일 ' + fmtDate(c.terminateDate) + ')';
    if (c.status === 'EXPIRED') return '만료 (' + fmtDate(c.endDate) + ')';
    return '-';
  }
  // 결재 기록의 "한 일" 이름: ⑥⑧⑨⑩의 승인은 단계에 맞는 말로 (예: 날인 완료)
  //   c를 주면 해지와 그대로 연장의 ⑨를 운영 종료 완료, 기간 연장 완료로
  function actionLabel(h, c) {
    const st = D.STEPS[h.step];
    if (h.action === 'APPROVE' && h.step === 'S09' && c && c.kind === 'TERMINATE') return '운영 종료 완료';
    if (h.action === 'APPROVE' && h.step === 'S09' && c && c.renewMode === 'AUTO') return '기간 연장 완료';
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
  function recordAction(c, s, action, comment, user, extra) {
    const entry = Object.assign({
      contractId: c.id, step: s.step, action: action, at: nowStamp(), comment: comment || '',
      actorId: user.id, onBehalfOf: s.userId !== user.id ? s.userId : null, round: c.round || 1,
    }, extra || {});
    const list = loadDemoActions();
    list.push(entry);
    saveDemoActions(list);
    c.history.push(entry);
    buildReview(c);
    applyBundleEffects(); // 해지 기안이 끝나면 원계약을 해지 상태로
    return entry;
  }
  // 시연으로 만든 계약(해지 기안, 갱신 검토), 사후관리 기록, 지운 임시 저장 (프로토타입 전용, REQ-ARC-04~07)
  const DEMO_KEYS = { contracts: 'climb.demoContracts', notes: 'climb.demoNotes', deleted: 'climb.demoDeleted' };
  function loadDemo(key) { try { return JSON.parse(localStorage.getItem(DEMO_KEYS[key]) || '[]'); } catch (e) { return []; } }
  function pushDemo(key, item) {
    const list = loadDemo(key);
    list.push(item);
    try { localStorage.setItem(DEMO_KEYS[key], JSON.stringify(list)); } catch (e) { /* 저장소를 못 쓰면 이 화면에서만 반영 */ }
  }
  function demoCount() { return loadDemoActions().length + loadDemo('contracts').length + loadDemo('notes').length + loadDemo('deleted').length; }
  // 새 계약 기록 저장 (해지 기안, 갱신 검토). 실제 시스템에서는 서버에 저장
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
  // 저장해 둔 시연 기록을 예시 데이터에 더한 뒤, 모든 계약의 결재 상태를 계산
  loadDemoActions().forEach(function (a) {
    const c = D.CONTRACTS.find(function (x) { return x.id === a.contractId; });
    if (c) { c.history = c.history || []; c.history.push(a); }
  });
  D.CONTRACTS.forEach(buildReview);

  /* ---------- 계약 묶음 (REQ-FLOW-18, 3.3 방식 C, REQ-ARC-01~03) ----------
   * 원계약 번호가 묶음 번호입니다. 변경(-A), 갱신(-R), 해지(-T)는 parentId로 원계약에 연결됩니다.
   *   - 지금 유효한 계약: 끝난(계약 완료, 만료) 갱신 중 가장 나중 것, 없으면 원계약
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
  const CHILD_LETTER = { AMEND: 'A', RENEW: 'R', TERMINATE: 'T' };
  // 다음 차수 번호: CT-2026-0105 → CT-2026-0105-A02
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
    // 진행 중인 변경, 갱신, 갱신 검토, 해지 기안
    const open = items.filter(function (c) { return c !== root && WORKING.concat(['REJECTED']).indexOf(c.status) > -1; });
    return {
      id: rootId, root: root, items: items, current: current, status: status, open: open,
      start: startOf(current), end: endOf(current),
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
  function expiringBundles(days) {
    return bundles().filter(function (b) {
      if (b.status !== 'ACTIVE' || !b.end) return false;
      const d = daysUntil(b.end);
      return d >= 0 && d <= days;
    }).sort(function (a, b) { return a.end.localeCompare(b.end); });
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
    const options = Object.keys(D.ROLES).map(function (r) {
      const u = D.USERS[D.DEMO_PERSONA[r]];
      return '<option value="' + r + '"' + (r === user.role ? ' selected' : '') + '>' +
        esc(D.ROLES[r]) + ' (' + esc(u.name) + ')</option>';
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

  function renderHeader(user, pageId) {
    const el = document.getElementById('site-header');
    if (!el) return;
    const allowed = function (m) { return user.role === 'SUPER' || !m.roles || m.roles.indexOf(user.role) > -1; };
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
        return '<li><a ' + (c.href ? 'href="' + c.href + '"' : todoAttrs(c.label, c.scr)) + '>' + esc(c.label) + '</a></li>';
      }).join('');
      return '<li class="gnb-item">' +
        '<button type="button" class="gnb-link' + cur + '" aria-expanded="false" aria-controls="gnb-sub-' + i + '">' +
          esc(m.label) + icon('chevronDown', 'sm') +
        '</button>' +
        '<ul class="gnb-sub" id="gnb-sub-' + i + '">' + sub + '</ul>' +
      '</li>';
    }).join('');

    /* 헤더 구성 (REQ-UI-13)
     *   1줄: [CLIMB | 무하유 계약 관리 플랫폼]
     *   2줄: [MUHAYU Contract Lifecycle Management Base]     [영업 이도윤님 | (아이콘)로그아웃]
     * 오른쪽 한 줄은 왼쪽 둘째 줄과 글자 밑선(baseline)을 맞추고, 오른쪽 끝은 본문 오른쪽 끝에 맞춥니다. (v0.15)
     * 화면 알림(종 모양, 알림 숫자)은 두지 않습니다. 알림은 이메일로 보냅니다. (REQ-ENV-09) */
    el.className = 'site-header';
    el.innerHTML =
      '<div class="header-top"><div class="inner">' +
        // 헤더 첫 줄: [심볼] CLIMB (v0.22, 한글 이름은 푸터에만)
        '<a class="brand-title" href="index.html" title="개요로 이동">' + brandTitleHtml({ mark: true, ko: false }) + '</a>' +
        '<div class="user-line">' +
          // 역할 배지를 이름 앞에 둠: [영업] 이도윤님 | 로그아웃 (v0.15)
          badge('line', roleLabel(user.role)) + '<span class="user-name">' + esc(user.name) + '님</span>' +
          '<span class="util-divider" aria-hidden="true"></span>' +
          '<a class="util-link logout-link" href="login.html">' + icon('logout', 'sm') + '로그아웃</a>' +
        '</div>' +
        '<span class="brand-en">' + esc(D.BRAND.en) + '</span>' +
        // 인쇄할 때만 보이는 출력 정보 (REQ-UI-11). 실제 시스템은 출력하는 순간의 날짜와 시각을 씁니다.
        '<p class="print-meta">' + meta(['출력일 ' + fmtDate(D.TODAY), '출력자 ' + esc(user.name) + '님 (' + esc(roleLabel(user.role)) + ')']) + '</p>' +
      '</div></div>' +
      '<nav class="gnb" aria-label="주 메뉴"><div class="inner">' +
        '<ul class="gnb-list">' + menuHtml + '</ul>' +
        // 이용 안내: 메뉴 줄 오른쪽 끝 (REQ-UI-14)
        '<a class="gnb-aside" ' + todoAttrs('이용 안내') + '>' + icon('help', 'sm') + '<span class="gnb-aside-label">이용 안내</span></a>' +
      '</div></nav>';

    // 하위 메뉴 열기·닫기
    el.querySelectorAll('button.gnb-link').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const item = btn.parentElement;
        const willOpen = !item.classList.contains('is-open');
        closeMenus();
        item.classList.toggle('is-open', willOpen);
        btn.setAttribute('aria-expanded', String(willOpen));
      });
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.gnb-item')) closeMenus(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenus(); });
    function closeMenus() {
      el.querySelectorAll('.gnb-item.is-open').forEach(function (item) {
        item.classList.remove('is-open');
        item.querySelector('button').setAttribute('aria-expanded', 'false');
      });
    }
  }

  // 보안 안내 문구 (REQ-UI-15): 기획자 초안을 법령, 시스템 요구사항, 어문 규범에 맞게 다듬은 문장
  //   모든 화면의 푸터와 로그인 화면(로그인 버튼 아래)에 같은 문장을 씀
  //   가운뎃점(·)은 쓰지 않음 (REQ-UI-08). 법령 이름은 홑낫표(「」)로 묶고 공식 제명 그대로 씀
  //   "접속 기록과 작업 내역" 기록은 REQ-AUTH-13을 따름
  const SECURITY_NOTICE = [
    '본 시스템은 인가된 사용자만 접근할 수 있으며, 접속 기록과 작업 내역은 관계 법령과 회사 보안 정책에 따라 기록되고 보관됩니다.',
    '본 시스템에는 「부정경쟁방지 및 영업비밀보호에 관한 법률」에 따라 보호되는 영업비밀 등 회사의 기밀 정보와 「개인정보 보호법」에 따라 보호되는 개인정보가 포함되어 있습니다.',
    '허용된 권한을 넘어 열람하거나, 업무 목적 밖에서 복제, 출력, 배포, 반출하거나, 제3자에게 제공하는 행위는 엄격히 금지됩니다.',
    '이를 위반하면 사규에 따라 징계를 받을 수 있으며, 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 등 관계 법령에 따라 민사상, 형사상 책임을 질 수 있습니다.',
  ].join(' ');

  function renderFooter() {
    const el = document.getElementById('site-footer');
    if (!el) return;
    el.className = 'site-footer';
    el.innerHTML =
      // 푸터: 시스템 이름 두 줄 + 보안 안내 문구 + 저작권. 이용 안내는 메뉴 줄로 옮기고 시스템 문의는 뺌 (REQ-UI-14, 15)
      '<div class="inner">' +
        '<div class="footer-brand">' + brandText('p', { mark: true }) + '</div>' +
        '<p class="footer-notice">' + esc(SECURITY_NOTICE) + '</p>' +
        '<p class="footer-copy">' + meta(['© 2026 MUHAYU. All rights reserved.', '프로토타입 v0.1']) + '</p>' +
      '</div>';
  }

  /* ---------- 안내 메시지 ---------- */
  let toastTimer = null;
  function toast(msg) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-show'); }, 2800);
  }
  // 아직 만들지 않은 화면 링크를 누르면 안내 (프로토타입 전용)
  document.addEventListener('click', function (e) {
    const a = e.target.closest('[data-todo]');
    if (!a) return;
    e.preventDefault();
    const scr = a.getAttribute('data-scr');
    toast('‘' + a.getAttribute('data-todo') + '’' + (scr ? ' 화면(' + scr + ')' : ' 화면') + '은 아직 시안을 만들기 전입니다.');
  });

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
    for (let i = 1; i <= pages; i++) html += btn(String(i), i, { cls: i === page ? ' is-current' : '', current: i === page, aria: i + '쪽' });
    html += btn('<span>다음</span>' + icon('chevronRight', 'sm'), page + 1, { cls: ' page-next', disabled: page === pages, aria: '다음 쪽' });
    const range = total ? (from + 1) + '~' + (from + shown) + '번째' : '해당 없음';
    return '<div class="page-btns">' + html + '</div>' +
      '<p class="page-range">' + pages + '쪽 중 ' + page + '쪽, ' + range + ' (한 쪽에 ' + size + unit + ')</p>';
  }

  /* ---------- 워터마크 (REQ-SEC-07, REQ-ENV-11) ----------
   * "이름 이메일 일시"를 쪽 전체에 옅게 반복해 깝니다. 화면에는 보이지 않고 인쇄와 PDF 저장 때만 나옵니다(common.css).
   * 일시는 인쇄를 누른 때로 다시 찍습니다. 내려받는 PDF에도 서버가 같은 워터마크를 찍습니다(REQ-SEC-08). */
  function renderWatermark(user) {
    const account = (D.ACCOUNTS || []).filter(function (a) { return a.name === user.name; })[0];
    const el = document.createElement('div');
    el.className = 'watermark';
    el.setAttribute('aria-hidden', 'true');
    function draw() {
      const stamp = nowStamp().slice(0, 16);
      const text = esc(user.name + (account ? ' ' + account.email : '') + ' ' + fmtDate(stamp.slice(0, 10)) + ' ' + stamp.slice(11));
      el.innerHTML = '<div class="watermark-grid">' + new Array(160).fill('<span>' + text + '</span>').join('') + '</div>';
    }
    draw();
    document.body.appendChild(el);
    window.addEventListener('beforeprint', draw);
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
    // 앞 화면에서 남긴 안내가 있으면 한 번 보여 줌
    try {
      const msg = sessionStorage.getItem('climb.flash');
      if (msg) { sessionStorage.removeItem('climb.flash'); setTimeout(function () { toast(msg); }, 50); }
    } catch (e) { /* 무시 */ }
    return user;
  }

  return {
    init: init, getRole: getRole, saveRole: saveRole, currentUser: currentUser,
    daysSince: daysSince, daysUntil: daysUntil, fmtDate: fmtDate, fmtDateTime: fmtDateTime, fmtToday: fmtToday, fmtKRW: fmtKRW,
    roleLabel: roleLabel, userName: userName, serviceLabel: serviceLabel, stepLabel: stepLabel,
    currentStep: currentStep, pendingSteps: pendingSteps, routedSteps: routedSteps, stepPosition: stepPosition, waitDays: waitDays,
    stepDots: stepDots, progressText: progressText, actionLabel: actionLabel, opsChecks: opsChecks, isReviewStep: isReviewStep, routedReview: routedReview,
    isShort: isShort, opsChecksFor: opsChecksFor, stepIng: stepIng, kindLabel: kindLabel,
    rootOf: rootOf, bundleOf: bundleOf, bundles: bundles, expiringBundles: expiringBundles, nextChildId: nextChildId, startOf: startOf, endOf: endOf,
    saveDemoContract: saveDemoContract, addNote: addNote, deleteDraft: deleteDraft, nowStamp: nowStamp,
    reviewRoute: reviewRoute, canAct: canAct, canCancel: canCancel, pendingQueue: pendingQueue, recordAction: recordAction, flash: flash, pagerHtml: pagerHtml,
    canView: canView, myActions: myActions,
    esc: esc, badge: badge, statusBadge: statusBadge, todoAttrs: todoAttrs, icon: icon, brandText: brandText, meta: meta, toast: toast,
    securityNotice: SECURITY_NOTICE,
  };
})();
