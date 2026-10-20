/* =====================================================================
 * SCR-01 개요(대시보드) 화면 로직 (dashboard.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-DASH-01~15, REQ-AUTH-04, REQ-AUTH-09
 * 상자는 한 줄에 하나씩 쌓습니다. (REQ-DASH-15)
 *   1. 계약 진행 현황: KRDS 단계 표시기(계약 등록 → 계약 검토 → 계약 체결 → 운영 검토 → 계약 완료)
 *      + 그 아래 진행 상세 표(고객사, 서비스, 상태, 현재 진행). 최대한 간단하게 진행 상황만 보여줌
 *   2. 내가 검토할 계약: 결재 역할에게만
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

  const isApprover = D.APPROVER_ROLES.indexOf(me.role) > -1;
  // 단계를 처리하는 역할(결재 역할 + 총무, CEM, 재무). 결재 역할이 아니면 "검토" 대신 "처리"라고 씀 (v0.23)
  const isProcessor = D.PROCESS_ROLES.indexOf(me.role) > -1;
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
    document.getElementById('greeting').innerHTML = msg;
    document.getElementById('today').textContent = C.fmtToday() + ' 기준';
  }

  /* ---------- 2. 계약 진행 현황 (REQ-DASH-04, 06, 08, 14) ----------
   * 업무 흐름 5단계(REQ-FLOW-13)를 KRDS 단계 표시기로 보여주고, 단계마다 건수를 붙입니다.
   * 단계는 메뉴 구성과 따로 갑니다: 계약 등록 → 계약 검토 → 계약 체결 → 운영 검토 → 계약 완료(보관함)
   * 건수가 있는 단계는 초록 원, 없는 단계는 회색 원입니다.
   * 단계마다 단계 번호, 단계 이름, 건수만 보여 주고 아래 작은 설명 글은 두지 않습니다. (v0.14) */
  const STEPS = [
    { label: '계약 등록', statuses: ['DRAFT'], target: '내 등록 목록', scr: 'SCR-12', href: 'my-contracts.html' },
    { label: '계약 검토', statuses: ['IN_REVIEW', 'REJECTED'], target: '전체 진행 현황', scr: 'SCR-20', href: 'progress.html?status=REVIEW' },
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
      const cls = !unknown && list.length ? ' class="is-on"' : '';
      return '<li' + cls + '>' +
        '<a class="step-body" ' + (s.href ? 'href="' + s.href + '"' : C.todoAttrs(s.target, s.scr)) + '>' +
          '<i class="step">' + (i + 1) + '단계</i>' +
          '<span class="step-tit">' + esc(s.label) + '</span>' +
          '<span class="step-count">' + count + (unknown ? '' : '<span class="unit">건</span>') + '</span>' +
        '</a>' +
      '</li>';
    }).join('');

    // 진행 상세: 아직 진행 중인 계약(작성 중, 검토 중, 반려, 체결 대기, 운영 검토). 계약 완료는 보관함에서 봄
    const order = { DRAFT: 0, IN_REVIEW: 1, REJECTED: 1, APPROVED: 2, OPS_REVIEW: 3 };
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
      '<ol class="step-wrap step-wrap--count" aria-label="계약 진행 단계별 건수">' + stepsHtml + '</ol>' +
      '<h3 class="block-subtitle">진행 상세</h3>' + table;
  }

  /* ---------- 3. 내가 검토할 계약 (결재 역할, REQ-DASH-03, 05) ---------- */
  function renderMyReviews() {
    const el = document.getElementById('my-reviews');
    if (!isProcessor) return;
    el.hidden = false;
    // 내 차례인 단계 (④⑤처럼 동시에 차례인 단계 중 내 것)
    const mine = function (c) { return C.pendingSteps(c).filter(function (s) { return s.userId === me.id; })[0]; };
    const rows = myActions.slice().sort(function (a, b) { return C.waitDays(b, mine(b)) - C.waitDays(a, mine(a)); });
    // CEM과 재무는 운영 검토 대기로, 그 외는 검토 대기로
    const ops = me.role === 'CEM' || me.role === 'FINANCE';
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
  renderExpiring();
})();
