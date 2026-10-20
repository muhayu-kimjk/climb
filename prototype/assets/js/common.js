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
      { label: '내 등록 목록', scr: 'SCR-12' },
    ] },
    // 계약 현황: 검토와 체결이 진행 중인 계약 (REQ-FLOW-03~05)
    { label: '계약 현황', children: [
      { label: '전체 진행 현황', scr: 'SCR-20', href: 'progress.html' },
      { label: '검토 대기', scr: 'SCR-21', href: 'review-queue.html', roles: D.APPROVER_ROLES },
      { label: '검토 완료', scr: 'SCR-22', href: 'review-done.html', roles: D.APPROVER_ROLES },
      // 체결본 확인은 세일즈어드민 담당 (REQ-FLOW-24). 세일즈어드민 역할은 시연 데이터에 추가 예정
      { label: '체결 대기', scr: 'SCR-31', roles: ['SALES'] },
    ] },
    // 보관함: 반려, 승인, 체결된 모든 계약 (REQ-FLOW-15~16)
    { label: '보관함', children: [
      { label: '전체 계약', scr: 'SCR-41' },
      { label: '만료 예정 계약', scr: 'SCR-43' },
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

  // 시스템 이름 표기: 로고 그림 없이 글자로만 표시 (REQ-NAME-03~04, REQ-UI-03)
  //   첫 줄: CLIMB | 무하유 계약 관리 플랫폼 / 둘째 줄: MUHAYU Contract Lifecycle Management Base
  //   세로선은 글자가 아닌 선으로 그려 화면낭독기는 "CLIMB 무하유 계약 관리 플랫폼"으로 읽음
  function brandTitleHtml() {
    return '<span class="brand-name">' + esc(D.BRAND.name) + '</span>' +
      '<span class="brand-sep" aria-hidden="true"></span>' +
      '<span class="brand-ko">' + esc(D.BRAND.ko) + '</span>';
  }
  function brandText(tag) {
    return '<' + tag + ' class="brand-title">' + brandTitleHtml() + '</' + tag + '>' +
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

  /* ---------- 결재 흐름 계산 (요구사항 정의서 3.5, REQ-STEP-04, REQ-DOC-06) ----------
   * 결재 기록(history)을 시간 순서대로 다시 적용해 단계마다 지금 상태(approvals)와 계약 상태를 만듭니다.
   *   - 결재선: 체크리스트 답과 개인정보 처리 여부로만 정함. 금액 기준 없음 (REQ-CHK-05)
   *   - 순서: ② → ③과 ④ 동시 → ⑤. 앞 묶음이 모두 승인되어야 다음 묶음이 차례가 됨
   *   - 반려: 어느 단계든 반려하면 계약은 반려 상태
   *   - 승인 취소: 그 단계는 다시 차례가 되고, 뒤 묶음은 다시 대기가 됨 (기록은 지우지 않음)
   * 실제 시스템에서는 이 규칙을 서버가 지켜야 합니다. 화면에서만 막으면 우회할 수 있습니다. */
  const REVIEW_ORDER = [].concat.apply([], D.REVIEW_GROUPS);
  function groupIndex(code) {
    return D.REVIEW_GROUPS.findIndex(function (g) { return g.indexOf(code) > -1; });
  }
  // [거치는지, 까닭]
  function reviewRoute(c) {
    const ck = c.checklist || {};
    let sales;
    if (ck.price === 'NA') sales = [false, '금액이 없는 계약'];
    else if (ck.price === 'NO' && ck.cap === 'NO') sales = [true, '할인율 캡을 넘김'];
    else if (ck.price === 'NO') sales = [false, '할인율 캡 이내'];
    else sales = [false, '표준단가표를 적용함'];
    return {
      S02: [true, '어떤 경우에도 생략하지 않음'],
      S03: ck.standard === 'NO' ? [true, '표준계약서를 바꿈'] : [false, '표준계약서를 그대로 씀'],
      S04: c.personalData ? [true, '개인정보를 처리함'] : [false, '개인정보 처리 없음'],
      S05: sales,
    };
  }
  // 이미 검토가 끝난 계약의 결재 기록을 승인일에 맞춰 만듦 (시연용 예시 데이터)
  function autoHistory(c) {
    const route = reviewRoute(c);
    const routed = REVIEW_ORDER.filter(function (code) { return route[code][0]; });
    const last = routed[routed.length - 1];
    return routed.map(function (code) {
      const at = code === last ? c.approvedAt
        : code === 'S02' ? c.requestedAt.slice(0, 10) + ' 16:00'
        : c.approvedAt.slice(0, 10) + ' 11:00';
      return { step: code, action: 'APPROVE', at: at, comment: '', actorId: D.STEP_ASSIGNEE[code], round: c.round || 1 };
    });
  }
  function buildReview(c) {
    if (c.status === 'DRAFT') { c.approvals = []; return; }
    if (c.autoHistory && !(c.history || []).length) c.history = autoHistory(c);
    c.history = (c.history || []).slice().sort(function (a, b) { return a.at.localeCompare(b.at); });
    const round = c.round || 1;
    const route = reviewRoute(c);
    const steps = REVIEW_ORDER.map(function (code) {
      return {
        step: code, role: D.STEPS[code].role, userId: D.STEP_ASSIGNEE[code],
        state: route[code][0] ? 'WAITING' : 'SKIPPED', reason: route[code][1],
        arrivedAt: null, decidedAt: null, decidedBy: null, onBehalfOf: null, comment: '',
      };
    });
    const by = {};
    steps.forEach(function (s) { by[s.step] = s; });
    // 앞 묶음이 모두 승인된 묶음까지 차례로 만들고, 그 뒤 묶음은 대기로 되돌림
    function recompute(at) {
      let blocked = false;
      D.REVIEW_GROUPS.forEach(function (group) {
        const members = group.map(function (code) { return by[code]; }).filter(function (s) { return s.state !== 'SKIPPED'; });
        members.forEach(function (s) {
          if (blocked) { if (s.state === 'PENDING') { s.state = 'WAITING'; s.arrivedAt = null; } }
          else if (s.state === 'WAITING') { s.state = 'PENDING'; s.arrivedAt = at; }
        });
        if (members.some(function (s) { return s.state !== 'DONE'; })) blocked = true;
      });
    }
    recompute(c.requestedAt);
    let rejection = null, approvedAt = null;
    c.history.filter(function (h) { return (h.round || 1) === round; }).forEach(function (h) {
      const s = by[h.step];
      if (!s) return;
      if (h.action === 'APPROVE' || h.action === 'REJECT') {
        s.state = h.action === 'APPROVE' ? 'DONE' : 'REJECTED';
        s.decidedAt = h.at; s.decidedBy = h.actorId; s.onBehalfOf = h.onBehalfOf || null; s.comment = h.comment;
        if (h.action === 'REJECT') rejection = { step: h.step, role: s.role, at: h.at, reason: h.comment, by: h.actorId };
      } else if (h.action === 'CANCEL') {
        s.state = 'PENDING'; s.decidedAt = null; s.decidedBy = null; s.onBehalfOf = null; s.comment = '';
      }
      recompute(h.at);
      approvedAt = !rejection && steps.every(function (x) { return x.state === 'DONE' || x.state === 'SKIPPED'; }) ? h.at : null;
    });
    if (['IN_REVIEW', 'REJECTED', 'APPROVED'].indexOf(c.status) > -1) {
      c.status = rejection ? 'REJECTED' : approvedAt ? 'APPROVED' : 'IN_REVIEW';
      c.approvedAt = approvedAt;
    }
    c.approvals = steps;
    c.rejection = rejection;
    if (rejection) { c.rejectedAt = rejection.at; c.rejectReason = rejection.reason; }
  }

  function pendingSteps(c) { return (c.approvals || []).filter(function (a) { return a.state === 'PENDING'; }); }
  function currentStep(c) { return pendingSteps(c)[0] || null; }
  function routedSteps(c) { return (c.approvals || []).filter(function (a) { return a.state !== 'SKIPPED'; }); }
  // 현재 몇 번째 결재 단계인지 (생략한 단계는 세지 않음. 예: 3단계 중 2단계)
  function stepPosition(c) {
    const list = routedSteps(c);
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
    return c.status === 'IN_REVIEW' && s.state === 'PENDING' && (s.userId === user.id || user.role === 'SUPER');
  }
  // 승인 취소: 승인한 본인이, 다음 묶음이 아직 아무것도 처리하지 않았을 때만 (REQ-DOC-06)
  function canCancel(c, s, user) {
    if (s.state !== 'DONE' || ['IN_REVIEW', 'APPROVED'].indexOf(c.status) < 0) return false;
    if (s.decidedBy !== user.id && user.role !== 'SUPER') return false;
    const gi = groupIndex(s.step);
    return !(c.approvals || []).some(function (a) { return groupIndex(a.step) > gi && a.decidedAt; });
  }

  /* 열람 권한 (REQ-AUTH-03, REQ-AUTH-09 [가정])
   * - 열람 제한이 없는 계약: 모든 사용자 열람 가능
   * - 열람 제한 계약: 요청자 본인, 결재선에 지정된 사람(생략된 단계 제외), 관리자만 열람 가능
   * ※ 실제 시스템에서는 반드시 서버에서 판단해야 합니다. 화면에서 가리는 것만으로는 보안이 되지 않습니다. */
  function canView(c, user) {
    // 작성 중(임시 저장) 계약은 작성자 본인만 봅니다. [가정]
    if (c.status === 'DRAFT') return c.requesterId === user.id;
    if (!c.restricted) return true;
    if (user.role === 'ADMIN' || user.role === 'SUPER') return true;
    if (c.requesterId === user.id) return true;
    return routedSteps(c).some(function (a) { return a.userId === user.id; });
  }

  // 내 차례인 결재 단계 목록: [{ c: 계약, s: 단계 }] (슈퍼관리자 all=true면 모든 담당자 것)
  function pendingQueue(user, all) {
    const out = [];
    D.CONTRACTS.forEach(function (c) {
      if (c.status !== 'IN_REVIEW') return;
      pendingSteps(c).forEach(function (s) { if (all || s.userId === user.id) out.push({ c: c, s: s }); });
    });
    return out;
  }
  // 내가 처리해야 할 계약 (개요 인사말과 '내가 검토할 계약')
  function myActions(user) {
    const list = D.CONTRACTS;
    if (D.APPROVER_ROLES.indexOf(user.role) > -1) {
      return list.filter(function (c) {
        return c.status === 'IN_REVIEW' && pendingSteps(c).some(function (s) { return s.userId === user.id; });
      });
    }
    if (user.role === 'SALES') {
      return list.filter(function (c) { return c.requesterId === user.id && (c.status === 'REJECTED' || c.status === 'APPROVED'); });
    }
    return [];
  }

  // 결재 단계 점: 승인 완료(채움), 현재 차례(테두리), 대기(회색), 반려(핑크). 생략한 단계는 그리지 않음
  function stepDots(c) {
    const stateClass = { DONE: 'is-done', PENDING: 'is-current', REJECTED: 'is-rejected' };
    return '<span class="step-dots" aria-hidden="true">' + routedSteps(c).map(function (a) {
      return '<span class="step-dot ' + (stateClass[a.state] || '') + '"></span>';
    }).join('') + '</span>';
  }

  // 현재 진행: 한 줄로 간단하게 (REQ-DASH-06). 개요, 진행 현황이 함께 씀
  function progressText(c) {
    if (c.status === 'DRAFT') return '임시 저장 (' + fmtDate(c.savedAt) + ')';
    if (c.status === 'APPROVED') return '체결본 등록 대기 (승인 후 ' + daysSince(c.approvedAt) + '일)';
    if (c.status === 'REJECTED') {
      return stepDots(c) + esc(roleLabel(c.rejection.role)) + ' 반려 (' + fmtDate(c.rejection.at) + ')';
    }
    // 검토 중: 지금 차례인 단계 이름. ③④는 동시에 차례일 수 있음 (예: 법무, 개인정보 검토 중)
    if (c.status === 'IN_REVIEW') {
      const names = pendingSteps(c).map(function (s) { return D.STEPS[s.step].short; }).join(', ');
      return stepDots(c) + esc(names) + ' 검토 중 (' + waitDays(c) + '일째)';
    }
    // 운영 검토: ⑨ 운영 적용(CEM) 또는 ⑩ 재무 확인 차례 [가정]
    if (c.status === 'OPS_REVIEW') return (c.opsStep === 'CEM' ? 'CEM 운영 적용 중' : '재무 확인 중') + ' (체결 후 ' + daysSince(c.signedAt) + '일)';
    if (c.status === 'ACTIVE') return '계약 완료 (만료 ' + fmtDate(c.endDate) + ')';
    return '-';
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
  // 승인(APPROVE), 반려(REJECT), 승인 취소(CANCEL)를 기록하고 계약 상태를 다시 계산
  function recordAction(c, s, action, comment, user) {
    const entry = {
      contractId: c.id, step: s.step, action: action, at: nowStamp(), comment: comment || '',
      actorId: user.id, onBehalfOf: s.userId !== user.id ? s.userId : null, round: c.round || 1,
    };
    const list = loadDemoActions();
    list.push(entry);
    saveDemoActions(list);
    c.history.push(entry);
    buildReview(c);
    return entry;
  }
  // 저장해 둔 시연 기록을 예시 데이터에 더한 뒤, 모든 계약의 결재 상태를 계산
  loadDemoActions().forEach(function (a) {
    const c = D.CONTRACTS.find(function (x) { return x.id === a.contractId; });
    if (c) { c.history = c.history || []; c.history.push(a); }
  });
  D.CONTRACTS.forEach(buildReview);

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
        (loadDemoActions().length ? '<button type="button" class="demo-reset" id="demo-reset">시연 기록 지우기 (' + loadDemoActions().length + '건)</button>' : '') +
      '</div>';
    el.querySelector('#demo-role').addEventListener('change', function (e) {
      saveRole(e.target.value);
      location.search = '?role=' + e.target.value;
    });
    const reset = el.querySelector('#demo-reset');
    if (reset) reset.addEventListener('click', function () {
      saveDemoActions([]);
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
        '<a class="brand-title" href="index.html" title="개요로 이동">' + brandTitleHtml() + '</a>' +
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
        '<div class="footer-brand">' + brandText('p') + '</div>' +
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

  /* ---------- 화면 시작 ----------
   * 각 HTML의 <body data-page="SCR-xx">를 읽어 공통 영역을 그립니다. */
  function init() {
    const user = currentUser();
    const pageId = document.body.getAttribute('data-page');
    renderDemoBar(user);
    renderHeader(user, pageId);
    renderFooter();
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
    stepDots: stepDots, progressText: progressText,
    reviewRoute: reviewRoute, canAct: canAct, canCancel: canCancel, pendingQueue: pendingQueue, recordAction: recordAction, flash: flash, pagerHtml: pagerHtml,
    canView: canView, myActions: myActions,
    esc: esc, badge: badge, statusBadge: statusBadge, todoAttrs: todoAttrs, icon: icon, brandText: brandText, meta: meta, toast: toast,
    securityNotice: SECURITY_NOTICE,
  };
})();
