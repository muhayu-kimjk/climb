/* =====================================================================
 * SCR-01 개요(대시보드) 화면 로직 (dashboard.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-DASH-01~12, REQ-AUTH-04, REQ-AUTH-09
 * 업무 흐름 4단계 (REQ-FLOW-13): 계약 등록 → 계약 검토 → 계약 체결 → 보관함
 * 역할별 구성 [가정, REQ-AUTH-04]
 *   - 결재자(부서장, 컴플라이언스, 개인정보, 재무): "내가 검토할 계약" 목록
 *   - 영업: "내가 등록한 계약" 진행 상황 (반려 건 맨 위)
 *   - 관리자: 전체 "검토 진행 현황"
 *   - 공통: 핵심 숫자, 확인 필요, 만료 임박
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
  const byStatus = function (s) { return all.filter(function (c) { return c.status === s; }); };
  const inReview = byStatus('IN_REVIEW');
  const rejected = byStatus('REJECTED');
  const approved = byStatus('APPROVED');
  const active = byStatus('ACTIVE');
  const expiring = active
    .filter(function (c) { const d = C.daysUntil(c.endDate); return d >= 0 && d <= 90; })
    .sort(function (a, b) { return a.endDate.localeCompare(b.endDate); });
  const restricted = all.filter(function (c) { return c.restricted && c.status !== 'DRAFT'; });
  const myActions = C.myActions(me);

  /* ---------- 공통 조각 ---------- */
  function lockBadge() {
    return '<span class="badge badge--neutral">' + C.icon('lock', 'sm') + '열람 제한</span>';
  }

  // 계약명 칸. 열람 권한이 없으면 내용을 가립니다. (REQ-AUTH-09)
  function contractCell(c) {
    if (!C.canView(c, me)) {
      return '<span class="cell-title is-masked">' + C.icon('lock', 'sm') + '열람 제한 계약</span>' +
        '<span class="cell-sub">요청자, 결재자, 관리자만 볼 수 있습니다</span>';
    }
    const badges = [];
    if (c.kind !== 'NEW') badges.push(C.badge('line', D.KINDS[c.kind] + '계약'));
    if (c.restricted) badges.push(lockBadge());
    return '<span class="cell-head"><a class="cell-title" ' + C.todoAttrs('계약 상세', 'SCR-42') + '>' + esc(c.title) + '</a>' +
      (badges.length ? '<span class="cell-badges">' + badges.join('') + '</span>' : '') + '</span>' +
      // 계약번호는 기안할 때 부여 [가정]
      '<span class="cell-sub">' + C.meta([esc(c.counterparty), esc(C.fmtKRW(c.amount)), c.id ? esc(c.id) : '번호는 기안 때 부여']) + '</span>';
  }

  // 결재 단계 칸: 점(승인 완료, 현재 차례, 대기) + 현재 단계 이름
  // 아랫줄: "3단계 중 2단계" | 덧붙임 말 (세로선 구분)
  function stepCell(c, note) {
    const stateClass = { DONE: 'is-done', PENDING: 'is-current', REJECTED: 'is-rejected' };
    const dots = c.approvals.map(function (a) { return '<span class="step-dot ' + (stateClass[a.state] || '') + '"></span>'; }).join('');
    const p = C.stepPosition(c);
    const cur = c.approvals[p.pos - 1];
    return '<span class="nowrap"><span class="step-dots" aria-hidden="true">' + dots + '</span>' + esc(C.roleLabel(cur.role)) + '</span>' +
      '<span class="cell-sub">' + C.meta([p.total + '단계 중 ' + p.pos + '단계', note ? esc(note) : '']) + '</span>';
  }

  function waitCell(days) {
    const cls = days >= R.approvalDelayDays ? ' class="wait-long"' : '';
    return '<span' + cls + '>' + days + '일</span>';
  }

  function panelHead(id, title, count, moreLabel, moreScr) {
    return '<div class="panel-head">' +
      '<h2 class="panel-title" id="' + id + '">' + esc(title) +
        (count != null ? ' <span class="count-text">' + count + '건</span>' : '') + '</h2>' +
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

  /* ---------- 2. 핵심 숫자 (REQ-DASH-04, REQ-DASH-08) ---------- */
  function statTile(opt) {
    return '<a class="stat' + (opt.mine ? ' stat--mine' : '') + '" ' + C.todoAttrs(opt.target, opt.scr) + '>' +
      '<span class="stat-label">' + esc(opt.label) + '</span>' +
      '<span class="stat-value">' + opt.value + '<span class="unit">건</span></span>' +
      '<span class="stat-note">' + esc(opt.note) + '</span>' +
    '</a>';
  }
  function stage(num, opt) {
    return '<a class="stage" ' + C.todoAttrs(opt.target, opt.scr) + '>' +
      '<span class="stat-label"><span class="step-num" aria-hidden="true">' + num + '</span>' + esc(opt.label) + '</span>' +
      '<span class="stat-value">' + opt.value + '<span class="unit">건</span></span>' +
      '<span class="stat-note">' + esc(opt.note) + '</span>' +
    '</a>';
  }

  function renderKpi() {
    // 첫 칸 '내 할 일'은 역할마다 다름 (REQ-DASH-10)
    let mine;
    if (isApprover) {
      const maxWait = myActions.reduce(function (m, c) { return Math.max(m, C.waitDays(c)); }, 0);
      mine = { label: '내 검토 대기', value: myActions.length, target: '검토 대기', scr: 'SCR-21',
        note: myActions.length ? '가장 오래 기다린 건 ' + maxWait + '일째' : '대기 중인 검토가 없습니다' };
    } else if (isSales) {
      const r = myActions.filter(function (c) { return c.status === 'REJECTED'; }).length;
      mine = { label: '내 처리 필요', value: myActions.length, target: '내 등록 목록', scr: 'SCR-12',
        note: '반려 보완 ' + r + '건, 체결본 등록 ' + (myActions.length - r) + '건' };
    } else {
      mine = { label: '열람 제한 계약', value: restricted.length, target: '열람 제한 관리', scr: 'SCR-53',
        note: '설정 변경은 관리자만 가능' };
    }
    mine.mine = true;

    const uploadOverdue = approved.filter(function (c) { return C.daysSince(c.approvedAt) >= R.uploadOverdueDays; }).length;
    const within30 = expiring.filter(function (c) { return C.daysUntil(c.endDate) <= 30; }).length;
    const arrow = '<span class="stage-arrow" aria-hidden="true">' + C.icon('chevronRight', 'lg') + '</span>';

    document.getElementById('kpi').innerHTML =
      statTile(mine) +
      '<div class="pipeline-box">' +
        '<h2 class="pipeline-title">전체 계약 진행 현황</h2>' +
        '<div class="pipeline">' +
          stage(1, { label: '검토 중', value: inReview.length, note: '반려 ' + rejected.length + '건 별도', target: '전체 진행 현황', scr: 'SCR-20' }) + arrow +
          stage(2, { label: '체결 대기', value: approved.length, note: R.uploadOverdueDays + '일 이상 경과 ' + uploadOverdue + '건', target: '체결 대기', scr: 'SCR-31' }) + arrow +
          stage(3, { label: '체결 완료', value: active.length, note: '보관함에 보관 중', target: '전체 계약', scr: 'SCR-41' }) +
        '</div>' +
      '</div>' +
      statTile({ label: '90일 내 만료 예정', value: expiring.length, note: '30일 이내 ' + within30 + '건', target: '만료 예정 계약', scr: 'SCR-43' });
  }

  /* ---------- 3. 역할별 주요 목록 ---------- */
  // 결재자: 내가 검토할 계약 (REQ-DASH-03, REQ-DASH-05), 오래 기다린 순
  function approverTable() {
    const rows = myActions.slice().sort(function (a, b) { return C.waitDays(b) - C.waitDays(a); });
    const head = panelHead('main-list-title', '내가 검토할 계약', rows.length, '검토 대기 전체 보기', 'SCR-21');
    if (!rows.length) return head + '<p class="empty">지금 검토할 계약이 없습니다.</p>';
    return head +
      '<div class="tbl-wrap"><table class="tbl tbl--compact">' +
        '<caption class="sr-only">내가 검토할 계약 목록: 계약, 요청자, 대기 일수, 결재 단계, 처리</caption>' +
        '<thead><tr><th scope="col" class="col-main">계약</th><th scope="col">요청자</th><th scope="col" class="num">대기</th><th scope="col">결재 단계</th><th scope="col" class="center col-action">처리</th></tr></thead>' +
        '<tbody>' + rows.map(function (c) {
          return '<tr>' +
            '<td>' + contractCell(c) + '</td>' +
            '<td class="nowrap">' + esc(C.userName(c.requesterId)) + '<span class="cell-sub">' + C.fmtDate(c.requestedAt) + '</span></td>' +
            '<td class="num">' + waitCell(C.waitDays(c)) + '</td>' +
            '<td>' + stepCell(c) + '</td>' +
            '<td class="center col-action"><a class="btn btn--primary btn--xs" ' + C.todoAttrs('검토 상세', 'SCR-23') + '>검토하기</a></td>' +
          '</tr>';
        }).join('') + '</tbody>' +
      '</table></div>';
  }

  // 영업: 내가 등록한 계약 진행 상황 (REQ-DASH-06), 반려 → 작성 중 → 체결 대기 → 검토 중 순서
  function salesTable() {
    const order = { REJECTED: 0, DRAFT: 1, APPROVED: 2, IN_REVIEW: 3 };
    const dateOf = function (c) { return c.requestedAt || c.savedAt; };
    const rows = all
      .filter(function (c) { return c.requesterId === me.id && order[c.status] != null; })
      .sort(function (a, b) { return order[a.status] - order[b.status] || dateOf(a).localeCompare(dateOf(b)); });
    const head = panelHead('main-list-title', '내가 등록한 계약', rows.length, '내 등록 목록 전체 보기', 'SCR-12');
    if (!rows.length) return head + '<p class="empty">진행 중인 계약이 없습니다.</p>';
    return head +
      '<div class="tbl-wrap"><table class="tbl tbl--compact">' +
        '<caption class="sr-only">내가 등록한 계약 목록: 계약, 상태, 현재 진행, 다음 할 일</caption>' +
        '<thead><tr><th scope="col" class="col-main">계약</th><th scope="col">상태</th><th scope="col">현재 진행</th><th scope="col" class="center col-action">다음 할 일</th></tr></thead>' +
        '<tbody>' + rows.map(function (c) {
          let progress, action;
          if (c.status === 'REJECTED') {
            const r = c.approvals.find(function (a) { return a.state === 'REJECTED'; });
            progress = stepCell(c, C.fmtDate(r.date) + ' 반려') + '<span class="reject-reason"><strong>반려 사유</strong> ' + esc(c.rejectReason) + '</span>';
            action = '<a class="btn btn--secondary btn--xs" ' + C.todoAttrs('새 계약 등록 (보완 후 재기안)', 'SCR-11') + '>보완 후 재기안</a>';
          } else if (c.status === 'DRAFT') {
            progress = '기안 전<span class="cell-sub">' + C.meta([C.fmtDate(c.savedAt) + ' 임시 저장']) + '</span>';
            action = '<a class="btn btn--secondary btn--xs" ' + C.todoAttrs('새 계약 등록 (이어서 작성)', 'SCR-11') + '>이어서 작성</a>';
          } else if (c.status === 'APPROVED') {
            progress = '승인 완료<span class="cell-sub">' + C.meta([C.fmtDate(c.approvedAt) + ' 승인', '승인 후 ' + C.daysSince(c.approvedAt) + '일']) + '</span>';
            action = '<a class="btn btn--primary btn--xs" ' + C.todoAttrs('체결본 등록', 'SCR-32') + '>체결본 등록</a>';
          } else {
            progress = stepCell(c, C.waitDays(c) + '일째 대기');
            action = '<a class="btn btn--tertiary btn--xs" ' + C.todoAttrs('계약 상세', 'SCR-42') + '>상세 보기</a>';
          }
          return '<tr' + (c.status === 'REJECTED' ? ' class="is-alert"' : '') + '>' +
            '<td>' + contractCell(c) + '</td>' +
            '<td class="nowrap">' + C.statusBadge(c) + '</td>' +
            '<td>' + progress + '</td>' +
            '<td class="center col-action">' + action + '</td>' +
          '</tr>';
        }).join('') + '</tbody>' +
      '</table></div>';
  }

  // 관리자: 전체 검토 진행 현황 (REQ-DASH-11), 오래 기다린 순
  function adminTable() {
    const rows = inReview.concat(rejected).sort(function (a, b) { return C.waitDays(b) - C.waitDays(a); });
    const head = panelHead('main-list-title', '검토 진행 현황', rows.length, '전체 진행 현황 보기', 'SCR-20');
    return head +
      '<div class="tbl-wrap"><table class="tbl tbl--compact">' +
        '<caption class="sr-only">검토 진행 현황: 계약, 요청자, 현재 단계, 대기 일수, 상태</caption>' +
        '<thead><tr><th scope="col" class="col-main">계약</th><th scope="col">요청자</th><th scope="col">현재 단계</th><th scope="col" class="num">대기</th><th scope="col">상태</th></tr></thead>' +
        '<tbody>' + rows.map(function (c) {
          return '<tr' + (c.status === 'REJECTED' ? ' class="is-alert"' : '') + '>' +
            '<td>' + contractCell(c) + '</td>' +
            '<td class="nowrap">' + esc(C.userName(c.requesterId)) + '<span class="cell-sub">' + C.fmtDate(c.requestedAt) + '</span></td>' +
            '<td>' + stepCell(c) + '</td>' +
            '<td class="num">' + (c.status === 'IN_REVIEW' ? waitCell(C.waitDays(c)) : '-') + '</td>' +
            '<td class="nowrap">' + C.statusBadge(c) + '</td>' +
          '</tr>';
        }).join('') + '</tbody>' +
      '</table></div>';
  }

  function renderMainList() {
    document.getElementById('main-list').innerHTML = isApprover ? approverTable() : isSales ? salesTable() : adminTable();
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
          '<span class="item-meta">' + C.meta(['만료 ' + C.fmtDate(c.endDate), '담당 ' + esc(C.userName(c.requesterId)), c.restricted ? '열람 제한' : '']) + '</span>'
        : '<span class="item-title cell-title is-masked">' + C.icon('lock', 'sm') + '열람 제한 계약</span>' +
          '<span class="item-meta">만료 ' + C.fmtDate(c.endDate) + '</span>';
      return '<li>' + ddayLabel + '<div class="item-body">' + body + '</div></li>';
    }).join('');
    document.getElementById('expiring').innerHTML = head + '<ul class="s-list">' + items + '</ul>';
  }

  renderGreeting();
  renderKpi();
  renderMainList();
  renderChecks();
  renderExpiring();
})();
