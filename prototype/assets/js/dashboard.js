/* =====================================================================
 * SCR-01 개요(대시보드) 화면 로직 (dashboard.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-DASH-01~15, REQ-AUTH-04, REQ-AUTH-09
 * 상자는 한 줄에 하나씩 쌓습니다. (REQ-DASH-15)
 *   1. 계약 진행 현황: KRDS 단계 표시기(계약 등록 → 계약 검토 → 계약 체결 → 보관함)
 *      + 그 아래 진행 상세 표(계약, 상태, 현재 진행). 최대한 간단하게 진행 상황만 보여줌
 *   2. 내가 검토할 계약: 결재 역할에게만
 *   3. 확인 필요 [제안]
 *   4. 만료 임박
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
  const isSales = me.role === 'SALES';

  /* ---------- 집계 ---------- */
  const all = D.CONTRACTS;
  const byStatus = function (list, s) { return list.filter(function (c) { return c.status === s; }); };
  const inReview = byStatus(all, 'IN_REVIEW');
  const rejected = byStatus(all, 'REJECTED');
  const approved = byStatus(all, 'APPROVED');
  const active = byStatus(all, 'ACTIVE');
  const expiring = active
    .filter(function (c) { const d = C.daysUntil(c.endDate); return d >= 0 && d <= 90; })
    .sort(function (a, b) { return a.endDate.localeCompare(b.endDate); });
  const restricted = all.filter(function (c) { return c.restricted && c.status !== 'DRAFT'; });
  const myActions = C.myActions(me);

  // 진행 현황의 범위: 영업은 내가 등록한 계약, 그 외는 전체(작성 중 제외: 작성자만 봄)
  const scope = isSales
    ? all.filter(function (c) { return c.requesterId === me.id; })
    : all.filter(function (c) { return c.status !== 'DRAFT'; });

  /* ---------- 공통 조각 ---------- */
  // 계약명 칸: 이름만 간단히. 열람 권한이 없으면 가림 (REQ-AUTH-09)
  function contractName(c) {
    if (!C.canView(c, me)) {
      return '<span class="cell-title is-masked">' + C.icon('lock', 'sm') + '열람 제한 계약</span>';
    }
    // 작성 중인 계약은 계약 등록 화면(SCR-11)에서 이어서 작성
    if (c.status === 'DRAFT') return '<a class="cell-title" href="new-contract.html?id=' + encodeURIComponent(c.draftKey) + '">' + esc(c.title) + '</a>';
    return '<a class="cell-title" ' + C.todoAttrs('계약 상세', 'SCR-42') + '>' + esc(c.title) + '</a>';
  }

  // 결재 단계 점: 승인 완료(채움), 현재 차례(테두리), 대기(회색), 반려(핑크)
  function stepDots(c) {
    const stateClass = { DONE: 'is-done', PENDING: 'is-current', REJECTED: 'is-rejected' };
    return '<span class="step-dots" aria-hidden="true">' + c.approvals.map(function (a) {
      return '<span class="step-dot ' + (stateClass[a.state] || '') + '"></span>';
    }).join('') + '</span>';
  }

  // 현재 진행: 한 줄로 간단하게 (REQ-DASH-06)
  function progressText(c) {
    if (c.status === 'DRAFT') return '임시 저장 (' + C.fmtDate(c.savedAt) + ')';
    if (c.status === 'APPROVED') return '체결본 등록 대기 (승인 후 ' + C.daysSince(c.approvedAt) + '일)';
    if (c.status === 'REJECTED') {
      const r = c.approvals.find(function (a) { return a.state === 'REJECTED'; });
      return stepDots(c) + esc(C.roleLabel(r.role)) + ' 반려 (' + C.fmtDate(r.date) + ')';
    }
    if (c.status === 'IN_REVIEW') {
      return stepDots(c) + esc(C.roleLabel(C.currentStep(c).role)) + ' 검토 중 (' + C.waitDays(c) + '일째)';
    }
    if (c.status === 'ACTIVE') return '체결 완료 (만료 ' + C.fmtDate(c.endDate) + ')';
    return '-';
  }

  function panelHead(id, title, sub, moreLabel, moreScr) {
    return '<div class="panel-head">' +
      '<h2 class="panel-title" id="' + id + '">' + esc(title) + (sub ? ' <span class="panel-sub">' + sub + '</span>' : '') + '</h2>' +
      (moreLabel ? '<a class="link-more" ' + C.todoAttrs(moreLabel, moreScr) + '>' + esc(moreLabel) + C.icon('chevronRight', 'sm') + '</a>' : '') +
    '</div>';
  }

  /* ---------- 1. 인사말과 기준일 ---------- */
  function renderGreeting() {
    // 이름 뒤 '님'은 붙여 씁니다. (REQ-UI-08 표기 규칙)
    const name = '<strong>' + esc(me.name) + '님</strong>, ';
    let msg;
    if (isApprover) {
      msg = myActions.length
        ? name + '지금 검토할 계약이 <strong class="em">' + myActions.length + '건</strong> 있습니다.'
        : name + '지금 검토할 계약이 없습니다.';
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
   * 업무 흐름 4단계(REQ-FLOW-13)를 KRDS 단계 표시기로 보여주고, 단계마다 건수를 붙입니다.
   * 건수가 있는 단계는 초록 원, 없는 단계는 회색 원입니다. */
  const STEPS = [
    { label: '계약 등록', statuses: ['DRAFT'], target: '내 등록 목록', scr: 'SCR-12' },
    { label: '계약 검토', statuses: ['IN_REVIEW', 'REJECTED'], target: '전체 진행 현황', scr: 'SCR-20' },
    { label: '계약 체결', statuses: ['APPROVED'], target: '체결 대기', scr: 'SCR-31' },
    { label: '보관함', statuses: ['ACTIVE'], target: '보관함 전체 계약', scr: 'SCR-41' },
  ];

  function stepNote(i, list) {
    if (i === 0) return isSales ? '작성 중' : '작성자만 볼 수 있음';
    if (i === 1) {
      const r = list.filter(function (c) { return c.status === 'REJECTED'; }).length;
      return '검토 중 ' + (list.length - r) + '건, 반려 ' + r + '건';
    }
    if (i === 2) {
      const late = list.filter(function (c) { return C.daysSince(c.approvedAt) >= R.uploadOverdueDays; }).length;
      return '체결본 등록 대기' + (late ? ', ' + R.uploadOverdueDays + '일 이상 ' + late + '건' : '');
    }
    return '체결 완료';
  }

  function renderProgress() {
    const stepsHtml = STEPS.map(function (s, i) {
      const list = scope.filter(function (c) { return s.statuses.indexOf(c.status) > -1; });
      const unknown = i === 0 && !isSales; // 작성 중 계약은 작성자 본인만 셀 수 있음
      const count = unknown ? '-' : list.length;
      const cls = !unknown && list.length ? ' class="is-on"' : '';
      return '<li' + cls + '>' +
        '<a class="step-body" ' + C.todoAttrs(s.target, s.scr) + '>' +
          '<i class="step">' + (i + 1) + '단계</i>' +
          '<span class="step-tit">' + esc(s.label) + '</span>' +
          '<span class="step-count">' + count + (unknown ? '' : '<span class="unit">건</span>') + '</span>' +
          '<span class="step-note">' + esc(stepNote(i, list)) + '</span>' +
        '</a>' +
      '</li>';
    }).join('');

    // 진행 상세: 아직 진행 중인 계약(작성 중, 검토 중, 반려, 체결 대기). 체결 완료는 보관함에서 봄
    const order = { DRAFT: 0, IN_REVIEW: 1, REJECTED: 1, APPROVED: 2 };
    const dateOf = function (c) { return c.requestedAt || c.savedAt; };
    const rows = scope
      .filter(function (c) { return order[c.status] != null; })
      .sort(function (a, b) { return order[a.status] - order[b.status] || dateOf(a).localeCompare(dateOf(b)); });

    const sub = (isSales ? '내가 등록한 계약 ' : '전체 계약 ') + scope.length + '건';
    const table = rows.length
      ? '<div class="tbl-wrap"><table class="tbl tbl--compact">' +
          '<caption class="sr-only">진행 상세: 계약, 상태, 현재 진행</caption>' +
          '<thead><tr><th scope="col" class="col-main">계약</th><th scope="col">상태</th><th scope="col">현재 진행</th></tr></thead>' +
          '<tbody>' + rows.map(function (c) {
            return '<tr' + (c.status === 'REJECTED' ? ' class="is-alert"' : '') + '>' +
              '<td>' + contractName(c) + '</td>' +
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
    if (!isApprover) return;
    el.hidden = false;
    const rows = myActions.slice().sort(function (a, b) { return C.waitDays(b) - C.waitDays(a); });
    const head = panelHead('my-reviews-title', '내가 검토할 계약', rows.length + '건', '검토 대기 전체 보기', 'SCR-21');
    if (!rows.length) { el.innerHTML = head + '<p class="empty">지금 검토할 계약이 없습니다.</p>'; return; }
    el.innerHTML = head +
      '<div class="tbl-wrap"><table class="tbl tbl--compact">' +
        '<caption class="sr-only">내가 검토할 계약: 계약, 요청자, 대기 일수, 결재 단계</caption>' +
        '<thead><tr><th scope="col" class="col-main">계약</th><th scope="col">요청자</th><th scope="col" class="num">대기</th><th scope="col">결재 단계</th></tr></thead>' +
        '<tbody>' + rows.map(function (c) {
          const p = C.stepPosition(c);
          const wait = C.waitDays(c);
          return '<tr>' +
            '<td><a class="cell-title" ' + C.todoAttrs('검토 상세', 'SCR-23') + '>' + esc(c.title) + '</a></td>' +
            '<td class="nowrap">' + esc(C.userName(c.requesterId)) + '</td>' +
            '<td class="num"><span' + (wait >= R.approvalDelayDays ? ' class="wait-long"' : '') + '>' + wait + '일</span></td>' +
            '<td class="nowrap">' + stepDots(c) + p.total + '단계 중 ' + p.pos + '단계</td>' +
          '</tr>';
        }).join('') + '</tbody>' +
      '</table></div>';
  }

  /* ---------- 4. 확인 필요 [제안] (REQ-DASH-09) ----------
   * 영업은 본인 등록 건만, 그 외 역할은 전체를 봅니다. 기준 일수는 mock-data.js ALERT_RULES */
  function renderChecks() {
    const mineOnly = function (c) { return !isSales || c.requesterId === me.id; };
    const groups = [
      {
        title: '체결본 미등록', rule: '승인 후 ' + R.uploadOverdueDays + '일 이상',
        items: approved.filter(mineOnly).filter(function (c) { return C.daysSince(c.approvedAt) >= R.uploadOverdueDays; })
          .map(function (c) { return { c: c, days: '승인 후 ' + C.daysSince(c.approvedAt) + '일' }; }),
      },
      {
        title: '반려 후 재기안 없음', rule: '반려 후 ' + R.resubmitOverdueDays + '일 이상',
        items: rejected.filter(mineOnly).filter(function (c) { return C.daysSince(c.rejectedAt) >= R.resubmitOverdueDays; })
          .map(function (c) { return { c: c, days: '반려 후 ' + C.daysSince(c.rejectedAt) + '일' }; }),
      },
      {
        title: '검토 지연', rule: '한 결재 단계 ' + R.approvalDelayDays + '일 이상',
        items: inReview.filter(mineOnly).filter(function (c) { return C.waitDays(c) >= R.approvalDelayDays; })
          .map(function (c) { return { c: c, days: C.roleLabel(C.currentStep(c).role) + ' ' + C.waitDays(c) + '일째' }; }),
      },
    ].filter(function (g) { return g.items.length; });

    const head =
      '<div class="panel-head"><h2 class="panel-title" id="checks-title">확인 필요 <span class="badge badge--proposal">제안 기능</span></h2></div>' +
      '<p class="panel-desc">기획 확정 전 제안 기능입니다. 기준 일수는 조정할 수 있습니다.</p>';

    const body = groups.length
      ? '<ul class="check-list">' + groups.map(function (g) {
          return '<li>' + C.icon('alert') + '<div class="item-body">' +
            '<p class="check-title">' + esc(g.title) + ' <span class="check-count">' + g.items.length + '건</span></p>' +
            '<p class="check-rule">기준: ' + esc(g.rule) + '</p>' +
            '<ul class="check-items">' + g.items.map(function (it) {
              const name = C.canView(it.c, me)
                ? '<a ' + C.todoAttrs('계약 상세', 'SCR-42') + '>' + esc(it.c.title) + '</a>'
                : '<span class="is-masked">' + C.icon('lock', 'sm') + '열람 제한 계약</span>';
              return '<li>' + name + '<span class="days">' + esc(it.days) + '</span></li>';
            }).join('') + '</ul>' +
          '</div></li>';
        }).join('') + '</ul>'
      : '<p class="empty">확인이 필요한 계약이 없습니다.</p>';

    document.getElementById('checks').innerHTML = head + body;
  }

  /* ---------- 5. 만료 임박 (REQ-DASH-07) ---------- */
  function renderExpiring() {
    const head = panelHead('expiring-title', '만료 임박', null, '전체 보기', 'SCR-43') +
      '<p class="panel-desc">90일 이내에 만료되는 계약입니다.</p>';
    if (!expiring.length) {
      document.getElementById('expiring').innerHTML = head + '<p class="empty">90일 이내에 만료되는 계약이 없습니다.</p>';
      return;
    }
    const items = expiring.map(function (c) {
      const d = C.daysUntil(c.endDate);
      // D-day 배지: 30일 이내 Pink, 60일 이내 Purple, 그 외 Blue (REQ-DASH-07)
      const tone = d <= 30 ? 'danger' : d <= 60 ? 'attention' : 'progress';
      const ddayLabel = '<span class="badge badge--' + tone + '" aria-label="만료까지 ' + d + '일">D-' + d + '</span>';
      const body = C.canView(c, me)
        ? '<a class="item-title" ' + C.todoAttrs('계약 상세', 'SCR-42') + '>' + esc(c.title) + '</a>' +
          '<span class="item-meta">' + C.meta(['만료 ' + C.fmtDate(c.endDate), '담당 ' + esc(C.userName(c.requesterId))]) + '</span>'
        : '<span class="item-title cell-title is-masked">' + C.icon('lock', 'sm') + '열람 제한 계약</span>' +
          '<span class="item-meta">만료 ' + C.fmtDate(c.endDate) + '</span>';
      return '<li>' + ddayLabel + '<div class="item-body">' + body + '</div></li>';
    }).join('');
    document.getElementById('expiring').innerHTML = head + '<ul class="s-list">' + items + '</ul>';
  }

  renderGreeting();
  renderProgress();
  renderMyReviews();
  renderChecks();
  renderExpiring();
})();
