/* =====================================================================
 * SCR-01 개요(대시보드) 화면 로직 (dashboard.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-DASH-01~15, REQ-AUTH-04, REQ-AUTH-09
 * 상자는 한 줄에 하나씩 쌓습니다. (REQ-DASH-15)
 *   1. 계약 진행 현황: KRDS 단계 표시기(계약 등록 → 계약 검토 → 계약 체결 → 운영 검토 → 계약 완료)
 *      + 그 아래 진행 상세 표(고객사, 서비스, 상태, 현재 진행). 최대한 간단하게 진행 상황만 보여줌
 *   2. 내가 검토할 계약: 결재 역할에게만
 *   2-1. 점검할 일: 정보보호 담당자, 리더와 최고관리자에게만. 이상 행위 알림, 매월 기록 점검, 분기 권한 검토 (v0.27)
 *   3. 만료 임박
 * 계약명은 따로 두지 않으므로 계약은 고객사와 서비스로 표시합니다. (v0.12)
 * "확인 필요" 상자는 뺐습니다. (REQ-DASH-09, v0.12)
 * 범위 [가정, REQ-DASH-14]: 영업은 내가 등록한 계약, 그 외 역할은 전체 계약
 * 프로토타입에서는 mock-data.js의 예시 데이터로 계산합니다.
 * 실제 시스템에서는 서버가 집계한 값을 받아 그리면 됩니다.
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const R = D.ALERT_RULES;

  const isApprover = C.hasRole(me, D.APPROVER_ROLES); // 리더는 그 분야 담당자처럼 (v0.29)
  // 단계를 처리하는 역할(결재 역할 + 총무, 고객지원, 재무). 결재 역할이 아니면 "검토" 대신 "처리"라고 씀 (v0.23)
  // 재무 리더와 재무 임원은 결재 단계를 맡지 않는 열람 역할(기획자 결정 v0.29)이라 "처리할 계약" 대신 전체 현황 인사말
  const viewOnly = me.role !== me.base && D.STEP_LEADS.indexOf(me.role) < 0;
  const isProcessor = C.hasRole(me, D.PROCESS_ROLES) && !viewOnly;
  const doWord = isApprover ? '검토할' : '처리할';
  const isSales = me.role === 'SALES';

  /* ---------- 집계 ---------- */
  const all = D.CONTRACTS;
  const byStatus = function (list, s) { return list.filter(function (c) { return c.status === s; }); };
  const inReview = byStatus(all, 'IN_REVIEW');
  const active = byStatus(all, 'ACTIVE');
  // 만료 임박: 계약 묶음의 지금 유효한 계약 기준 (그대로 연장한 갱신이 있으면 그 기간, common.js expiringBundles)
  const expiring = C.expiringBundles(90).map(function (b) { return Object.assign({}, b.root, { endDate: b.end }); });
  const restricted = all.filter(function (c) { return c.restricted && c.status !== 'DRAFT'; });
  const myActions = C.myActions(me);

  // 진행 현황의 범위: 영업은 내가 등록한 계약, 그 외는 전체(작성 중 제외: 작성자만 봄)
  const scope = isSales
    ? all.filter(function (c) { return c.requesterId === me.id; })
    : all.filter(function (c) { return c.status !== 'DRAFT'; });

  /* ---------- 점검할 일 (REQ-DASH-16, REQ-SEC-05, 06, REQ-ADM-19~21) ----------
   * 접속 기록 점검(SCR-57)과 같은 기준: CLIMB을 쓰기 시작한 달(2026-09)부터,
   * [가정] 매월 점검 기한은 다음 달 말일, 분기 권한 검토 기한은 분기가 끝난 다음 달 말일 */
  const isAuditor = C.hasRole(me, ['PRIVACY']) || me.role === 'SUPER'; // 정보보호 담당자와 리더(v0.29)
  function auditItems() {
    const START = '2026-09', THIS = D.TODAY.slice(0, 7);
    const pad = function (n) { return String(n).padStart(2, '0'); };
    const lastDay = function (y, m) { return y + '-' + pad(m) + '-' + pad(new Date(y, m, 0).getDate()); };
    const next = function (y, m) { return m === 12 ? [y + 1, 1] : [y, m + 1]; };
    const items = [];
    const open = D.SEC_ALERTS.filter(function (a) { return a.status === 'OPEN'; });
    items.push({ what: '이상 행위 알림 확인', todo: open.length > 0, state: open.length ? '확인 전 ' + open.length + '건' : '모두 확인', due: null });
    // 매월 기록 점검: 끝난 달 중 점검하지 않은 달
    let y = 2026, m = 9;
    const months = [];
    for (; (y + '-' + pad(m)) < THIS; [y, m] = next(y, m)) months.push([y, m]);
    const monthTodo = months.filter(function (x) { return !D.LOG_REVIEWS.some(function (r) { return r.month === x[0] + '-' + pad(x[1]); }); });
    if (monthTodo.length) monthTodo.forEach(function (x) { const n = next(x[0], x[1]); items.push({ what: x[0] + '년 ' + x[1] + '월 기록 점검', todo: true, state: '점검 전', due: lastDay(n[0], n[1]) }); });
    else { const n = next(Number(THIS.slice(0, 4)), Number(THIS.slice(5, 7))); items.push({ what: Number(THIS.slice(5, 7)) + '월 기록 점검', todo: false, state: '이달이 끝난 뒤', due: lastDay(n[0], n[1]) }); }
    // 분기 권한 검토: 끝난 분기 중 검토하지 않은 분기
    const qNow = Math.ceil(Number(THIS.slice(5, 7)) / 3), yNow = Number(THIS.slice(0, 4));
    const quarters = [];
    for (let qy = Number(START.slice(0, 4)), q = Math.ceil(Number(START.slice(5, 7)) / 3); qy < yNow || (qy === yNow && q < qNow); q === 4 ? (q = 1, qy++) : q++) quarters.push([qy, q]);
    const qTodo = quarters.filter(function (x) { return !D.ACCESS_REVIEWS.some(function (r) { return r.quarter === x[0] + '-Q' + x[1]; }); });
    qTodo.forEach(function (x) { const n = next(x[0], x[1] * 3); items.push({ what: x[0] + '년 ' + x[1] + '분기 권한 검토', todo: true, state: '검토 전', due: lastDay(n[0], n[1]) }); });
    if (!qTodo.length) { const n = next(yNow, qNow * 3); items.push({ what: yNow + '년 ' + qNow + '분기 권한 검토', todo: false, state: '분기가 끝난 뒤', due: lastDay(n[0], n[1]) }); }
    return items;
  }
  const audits = isAuditor ? auditItems() : [];

  /* ---------- 공통 조각 ---------- */
  // 고객사 칸과 서비스 칸: 계약명 대신 고객사와 서비스로 계약을 구분 (v0.12)
  // 휴대폰에서는 서비스 칸을 감추고 고객사 아래 작은 글자로 보여줌 (칸이 넘치지 않게, REQ-ENV-08)
  // 열람 권한이 없으면 "열람 제한 계약"으로만 보여주고 서비스도 가림 (REQ-AUTH-09)
  function customerCells(c) {
    if (!C.canView(c, me)) {
      return '<td><span class="cell-title is-masked">' + C.icon('lock', 'sm') + '열람 제한 계약</span></td><td class="col-service">-</td>';
    }
    // 작성 중인 계약은 계약 등록 화면(SCR-11)에서 이어서 작성, 그 밖에는 결재 문서 화면(검토 상세, SCR-23)
    // 계약 완료, 만료, 해지된 계약은 계약 상세(묶음, SCR-42)로 (v0.24)
    const href = c.status === 'DRAFT' ? 'new-contract.html?id=' + encodeURIComponent(c.draftKey)
      : ['ACTIVE', 'EXPIRED', 'TERMINATED'].indexOf(c.status) > -1 ? 'contract.html?id=' + encodeURIComponent(C.rootOf(c))
      : 'review.html?id=' + encodeURIComponent(c.id);
    const link = '<a class="cell-title" href="' + href + '">' + esc(c.counterparty) + '</a>';
    const service = esc(C.serviceLabel(c.services));
    return '<td>' + link + '<span class="cell-sub">' + service + '</span></td><td class="col-service">' + service + '</td>';
  }

  // 결재 단계 점과 현재 진행 한 줄은 목록 화면들이 함께 쓰므로 common.js로 옮김 (C.stepDots, C.progressText)
  const stepDots = C.stepDots, progressText = C.progressText;

  // more: 오른쪽 '전체 보기' 링크. href가 있으면 그 화면으로, 없으면 아직 안 만든 화면 안내
  function panelHead(id, title, sub, moreLabel, moreScr, moreHref) {
    const attrs = moreHref ? 'href="' + moreHref + '"' : C.todoAttrs(moreLabel, moreScr);
    return '<div class="panel-head">' +
      '<h2 class="panel-title" id="' + id + '">' + esc(title) + (sub ? ' <span class="panel-sub">' + sub + '</span>' : '') + '</h2>' +
      (moreLabel ? '<a class="link-more" ' + attrs + '>' + esc(moreLabel) + C.icon('chevronRight', 'sm') + '</a>' : '') +
    '</div>';
  }

  /* ---------- 1. 인사말과 기준일 ---------- */
  function renderGreeting() {
    // 이름 뒤 '님'은 붙여 씁니다. (REQ-UI-08 표기 규칙)
    const name = '<strong>' + esc(me.name) + '님</strong>, ';
    let msg;
    if (isProcessor) {
      msg = myActions.length
        ? name + '지금 ' + doWord + ' 계약이 <strong class="em">' + myActions.length + '건</strong> 있습니다.'
        : name + '지금 ' + doWord + ' 계약이 없습니다.';
    } else if (isSales) {
      msg = myActions.length
        ? name + '처리가 필요한 내 계약이 <strong class="em">' + myActions.length + '건</strong> 있습니다.'
        : name + '지금 처리할 계약이 없습니다.';
    } else {
      msg = name + '검토 중인 계약 <strong>' + inReview.length + '건</strong>, 열람 제한 계약 <strong>' + restricted.length + '건</strong>이 있습니다.';
    }
    // 정보보호: 점검할 일도 함께 (REQ-DASH-16)
    const auditCount = audits.filter(function (a) { return a.todo; }).length;
    if (C.hasRole(me, ['PRIVACY']) && auditCount) msg += ' 점검할 일도 <strong class="em">' + auditCount + '건</strong> 있습니다.';
    document.getElementById('greeting').innerHTML = msg;
    document.getElementById('today').textContent = C.fmtToday() + ' 기준';
  }

  /* ---------- 2. 계약 진행 현황 (REQ-DASH-04, 06, 08, 14) ----------
   * 업무 흐름 5단계(REQ-FLOW-13)를 KRDS 단계 표시기로 보여주고, 단계마다 건수를 붙입니다.
   * 단계는 메뉴 구성과 따로 갑니다: 계약 등록 → 계약 검토 → 계약 체결 → 운영 검토 → 계약 완료(보관함)
   * 진행 표시로 읽히지 않게 단계 번호를 담은 원으로 그리고, 건수가 있는 단계는 Dark Green 테두리입니다(has-items, KRDS v0.28).
   * 단계마다 단계 번호, 단계 이름, 건수만 보여 주고 아래 작은 설명 글은 두지 않습니다. (v0.14) */
  const STEPS = [
    { label: '계약 등록', statuses: ['DRAFT'], target: '내 등록 목록', scr: 'SCR-12', href: 'my-contracts.html' },
    { label: '계약 검토', statuses: ['IN_REVIEW', 'SUPPLEMENT', 'REJECTED'], target: '전체 진행 현황', scr: 'SCR-20', href: 'progress.html?status=REVIEW' },
    // 계약 체결: 영업은 체결 대기 화면, 그 외는 전체 진행 현황(체결 대기로 거름)
    { label: '계약 체결', statuses: ['APPROVED'], target: '체결 대기', scr: 'SCR-31', href: isSales ? 'signing.html' : 'progress.html?status=APPROVED' },
    { label: '운영 검토', statuses: ['OPS_REVIEW'], target: '전체 진행 현황', scr: 'SCR-20', href: 'progress.html?status=OPS_REVIEW' },
    // 계약 완료는 묶음마다 셈(그대로 연장한 갱신을 따로 세지 않음)
    { label: '계약 완료', statuses: ['ACTIVE'], target: '보관함 전체 계약', scr: 'SCR-41', href: 'contracts.html', bundles: true },
  ];

  function renderProgress() {
    const stepsHtml = STEPS.map(function (s, i) {
      const list = s.bundles
        ? C.bundles().filter(function (b) { return b.status === 'ACTIVE' && (!isSales || b.root.requesterId === me.id); })
        : scope.filter(function (c) { return s.statuses.indexOf(c.status) > -1; });
      const unknown = i === 0 && !isSales; // 작성 중 계약은 작성자 본인만 셀 수 있음
      const count = unknown ? '-' : list.length;
      const cls = !unknown && list.length ? ' class="has-items"' : ''; // 건수가 있는 단계 (v0.28: is-on 대신)
      return '<li' + cls + '>' +
        '<a class="step-body" ' + (s.href ? 'href="' + s.href + '"' : C.todoAttrs(s.target, s.scr)) + '>' +
          '<i class="step">' + (i + 1) + '단계</i>' +
          '<span class="step-tit">' + esc(s.label) + '</span>' +
          '<span class="step-count">' + count + (unknown ? '' : '<span class="unit">건</span>') + '</span>' +
        '</a>' +
      '</li>';
    }).join('');

    // 진행 상세: 아직 진행 중인 계약(작성 중, 검토 중, 반려, 체결 대기, 운영 검토). 계약 완료는 보관함에서 봄
    const order = { DRAFT: 0, IN_REVIEW: 1, SUPPLEMENT: 1, REJECTED: 1, APPROVED: 2, OPS_REVIEW: 3 };
    const dateOf = function (c) { return c.requestedAt || c.savedAt; };
    const rows = scope
      .filter(function (c) { return order[c.status] != null; })
      .sort(function (a, b) { return order[a.status] - order[b.status] || dateOf(a).localeCompare(dateOf(b)); });

    const sub = (isSales ? '내가 등록한 계약 ' : '전체 계약 ') + scope.length + '건';
    const table = rows.length
      ? '<div class="tbl-wrap"><table class="tbl tbl--compact">' +
          '<caption class="sr-only">진행 상세: 고객사, 서비스, 상태, 현재 진행</caption>' +
          '<thead><tr><th scope="col" class="col-customer">고객사</th><th scope="col" class="col-service">서비스</th><th scope="col">상태</th><th scope="col">현재 진행</th></tr></thead>' +
          '<tbody>' + rows.map(function (c) {
            return '<tr' + (c.status === 'REJECTED' ? ' class="is-alert"' : '') + '>' +
              customerCells(c) +
              '<td class="nowrap">' + C.statusBadge(c) + '</td>' +
              '<td>' + progressText(c) + '</td>' +
            '</tr>';
          }).join('') + '</tbody>' +
        '</table></div>'
      : '<p class="empty">진행 중인 계약이 없습니다.</p>';

    document.getElementById('progress').innerHTML =
      panelHead('progress-title', '계약 진행 현황', esc(sub)) +
      // 한눈에 보기용 표시기(진행 표시와 다른 모양, KRDS v0.28)
      '<ol class="step-wrap step-wrap--count step-wrap--flow" aria-label="계약 진행 단계별 건수">' + stepsHtml + '</ol>' +
      '<h3 class="block-subtitle">진행 상세</h3>' + table;
  }

  /* ---------- 3. 내가 검토할 계약 (결재 역할, REQ-DASH-03, 05) ---------- */
  function renderMyReviews() {
    const el = document.getElementById('my-reviews');
    if (!isProcessor) return;
    el.hidden = false;
    // 내 차례인 단계 (④⑤처럼 동시에 차례인 단계 중 내 것)
    const mine = function (c) { return C.pendingSteps(c).filter(function (s) { return C.isMyStep(s, me); })[0]; };
    const rows = myActions.slice().sort(function (a, b) { return C.waitDays(b, mine(b)) - C.waitDays(a, mine(a)); });
    // 고객지원과 재무는 운영 검토 대기로, 그 외는 검토 대기로
    const ops = C.hasRole(me, ['CEM', 'FINANCE']);
    const head = panelHead('my-reviews-title', '내가 ' + doWord + ' 계약', rows.length + '건',
      ops ? '운영 검토 대기 전체 보기' : '검토 대기 전체 보기', ops ? 'SCR-34' : 'SCR-21', ops ? 'ops-queue.html' : 'review-queue.html');
    if (!rows.length) { el.innerHTML = head + '<p class="empty">지금 검토할 계약이 없습니다.</p>'; return; }
    el.innerHTML = head +
      '<div class="tbl-wrap"><table class="tbl tbl--compact">' +
        '<caption class="sr-only">내가 ' + doWord + ' 계약: 고객사, 서비스, 요청자, 대기 일수, 내 단계</caption>' +
        '<thead><tr><th scope="col" class="col-customer">고객사</th><th scope="col" class="col-service">서비스</th><th scope="col">요청자</th><th scope="col" class="num">대기</th><th scope="col">내 단계</th></tr></thead>' +
        '<tbody>' + rows.map(function (c) {
          const s = mine(c);
          const wait = C.waitDays(c, s);
          // 내 차례인 결재 건은 열람 제한이어도 볼 수 있음 (REQ-AUTH-09)
          return '<tr>' +
            '<td><a class="cell-title" href="review.html?id=' + encodeURIComponent(c.id) + '">' + esc(c.counterparty) + '</a>' +
              '<span class="cell-sub">' + esc(C.serviceLabel(c.services)) + '</span></td>' +
            '<td class="col-service">' + esc(C.serviceLabel(c.services)) + '</td>' +
            '<td class="nowrap">' + esc(C.userName(c.requesterId)) + '</td>' +
            '<td class="num"><span' + (wait >= R.approvalDelayDays ? ' class="wait-long"' : '') + '>' + wait + '일</span></td>' +
            '<td class="nowrap col-steps">' + (C.isReviewStep(s.step) ? stepDots(c) : '') + esc(C.stepLabel(s.step)) + '</td>' +
          '</tr>';
        }).join('') + '</tbody>' +
      '</table></div>';
  }

  /* ---------- 3-1. 점검할 일 (정보보호, REQ-DASH-16) ---------- */
  function renderAudit() {
    const el = document.getElementById('audit');
    if (!isAuditor) return;
    el.hidden = false;
    const todo = audits.filter(function (a) { return a.todo; }).length;
    el.innerHTML = panelHead('audit-title', '점검할 일', todo + '건', '접속 기록 점검으로', 'SCR-57', 'admin-logs.html') +
      '<p class="panel-desc">접속 기록 점검은 정보보호 담당자가 합니다. 기한이 지나면 강조합니다.</p>' +
      '<div class="tbl-wrap"><table class="tbl tbl--compact">' +
        '<caption class="sr-only">점검할 일: 할 일, 상태, 기한</caption>' +
        '<thead><tr><th scope="col">할 일</th><th scope="col">상태</th><th scope="col">기한</th></tr></thead>' +
        '<tbody>' + audits.map(function (a) {
          const late = a.todo && a.due && C.daysUntil(a.due) < 0;
          const dueText = !a.due ? (a.todo ? '바로' : '-') : C.fmtDate(a.due) + (a.todo ? ' (' + (late ? '기한 지남' : 'D-' + C.daysUntil(a.due)) + ')' : '');
          return '<tr' + (late ? ' class="is-alert"' : '') + '><td><a class="cell-title" href="admin-logs.html">' + esc(a.what) + '</a></td>' +
            '<td class="nowrap">' + C.badge(a.todo ? (a.what.indexOf('알림') > -1 ? 'danger' : 'attention') : 'line', a.state) + '</td>' +
            '<td class="num-left">' + dueText + '</td></tr>';
        }).join('') + '</tbody></table></div>';
  }

  /* ---------- 4. 만료 임박 (REQ-DASH-07) ----------
   * 표로 보여 줍니다: 남은 일자, 고객사, 서비스, 만료일, 담당자 (v0.14)
   * 고객사, 서비스 칸 너비는 진행 상세 표와 같게 맞춤 */
  function renderExpiring() {
    const head = panelHead('expiring-title', '만료 임박', null, '전체 보기', 'SCR-43', 'expiring.html') +
      '<p class="panel-desc">90일 이내에 만료되는 계약입니다.</p>';
    if (!expiring.length) {
      document.getElementById('expiring').innerHTML = head + '<p class="empty">90일 이내에 만료되는 계약이 없습니다.</p>';
      return;
    }
    const rows = expiring.map(function (c) {
      const d = C.daysUntil(c.endDate);
      // D-day 배지: 30일 이내 Pink, 60일 이내 Purple, 그 외 Blue (REQ-DASH-07)
      const tone = d <= 30 ? 'danger' : d <= 60 ? 'attention' : 'progress';
      const dday = '<span class="badge badge--' + tone + '" aria-label="만료까지 ' + d + '일">D-' + d + '</span>';
      // 열람 제한 계약은 고객사, 서비스, 담당자를 가림 (REQ-AUTH-09)
      const owner = C.canView(c, me) ? esc(C.userName(c.requesterId)) : '-';
      return '<tr>' +
        '<td class="num">' + dday + '</td>' + // 숫자라 오른쪽 정렬 (REQ-UI-16)
        customerCells(c) +
        // 휴대폰에서는 담당자 칸을 감추고 만료일 아래 작은 글자로 보여줌 (REQ-ENV-08)
        '<td class="nowrap">' + C.fmtDate(c.endDate) + (C.canView(c, me) ? '<span class="cell-sub">담당 ' + owner + '</span>' : '') + '</td>' +
        '<td class="nowrap col-owner">' + owner + '</td>' +
      '</tr>';
    }).join('');
    document.getElementById('expiring').innerHTML = head +
      '<div class="tbl-wrap"><table class="tbl tbl--compact">' +
        '<caption class="sr-only">만료 임박: 남은 일자, 고객사, 서비스, 만료일, 담당자</caption>' +
        '<thead><tr><th scope="col">남은 일자</th><th scope="col" class="col-customer">고객사</th><th scope="col" class="col-service">서비스</th>' +
          '<th scope="col">만료일</th><th scope="col" class="col-owner">담당자</th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table></div>';
  }

  renderGreeting();
  renderProgress();
  renderMyReviews();
  renderAudit();
  renderExpiring();
})();
