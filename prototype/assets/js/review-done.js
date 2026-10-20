/* =====================================================================
 * SCR-22 검토 완료 화면 로직 (review-done.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-FLOW-12, REQ-DOC-06, REQ-REV-06
 * 하는 일
 *   1. 결재 기록(approval_history) 중 내가 한 일(승인, 반려, 승인 취소)을 모음
 *      (슈퍼관리자, 관리자는 모든 사람의 기록을 처리한 사람 칸과 함께)
 *   2. 검색, 한 일, 단계, 지금 상태로 거르기. 최근 것부터
 *   3. 한 쪽에 20건씩 쪽 나누기
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const PAGE_SIZE = 20;

  const seeAll = me.role === 'SUPER' || me.role === 'ADMIN';
  if (!seeAll && D.APPROVER_ROLES.indexOf(me.role) < 0) {
    $('#notice').innerHTML = '<div class="notice" role="status"><p class="notice-title">' + C.icon('alert') + '검토 완료는 결재 역할만 씁니다</p>' +
      '<p>지금은 ' + esc(C.roleLabel(me.role)) + ' 역할로 보고 있습니다.</p></div>';
    $('#list').hidden = true;
    return;
  }
  if (seeAll) $('#intro').textContent = '모든 사람이 처리한 결재 기록입니다(' + C.roleLabel(me.role) + ' 보기). 최근 것부터 보여 줍니다.';

  // 결재 기록 모으기 (열람 제한 계약은 볼 수 있는 것만)
  const all = [];
  D.CONTRACTS.forEach(function (c) {
    if (!C.canView(c, me)) return;
    (c.history || []).forEach(function (h) {
      if (seeAll || h.actorId === me.id) all.push({ c: c, h: h });
    });
  });
  all.sort(function (a, b) { return b.h.at.localeCompare(a.h.at); });

  function options(first, pairs) {
    return '<option value="">' + esc(first) + '</option>' + pairs.map(function (p) { return '<option value="' + p[0] + '">' + esc(p[1]) + '</option>'; }).join('');
  }
  $('#f-action').innerHTML = options('전체', ['APPROVE', 'REJECT', 'CANCEL'].map(function (k) { return [k, D.APPROVAL_ACTIONS[k].label]; }));
  $('#f-step').innerHTML = options('전체 단계', D.REVIEW_GROUPS.reduce(function (a, g) { return a.concat(g); }, []).map(function (code) { return [code, C.stepLabel(code)]; }));
  $('#f-status').innerHTML = options('전체 상태', Object.keys(D.STATUS).filter(function (k) { return k !== 'DRAFT'; }).map(function (k) { return [k, D.STATUS[k].label]; }));

  $('#thead').innerHTML = '<tr><th scope="col">처리일시</th><th scope="col" class="col-customer">고객사</th><th scope="col">단계</th><th scope="col">한 일</th>' +
    (seeAll ? '<th scope="col">처리한 사람</th>' : '') + '<th scope="col">의견, 사유</th><th scope="col">지금 상태</th></tr>';

  let page = 1;
  function filtered() {
    const q = $('#f-q').value.trim().toLowerCase();
    const action = $('#f-action').value, step = $('#f-step').value, status = $('#f-status').value;
    return all.filter(function (x) {
      if (q && x.c.counterparty.toLowerCase().indexOf(q) < 0 && String(x.c.id).toLowerCase().indexOf(q) < 0) return false;
      if (action && x.h.action !== action) return false;
      if (step && x.h.step !== step) return false;
      if (status && x.c.status !== status) return false;
      return true;
    });
  }

  function render() {
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (page > pages) page = pages;
    const from = (page - 1) * PAGE_SIZE;
    const rows = list.slice(from, from + PAGE_SIZE);
    const count = function (a) { return list.filter(function (x) { return x.h.action === a; }).length; };
    $('#list-count').innerHTML = C.meta(['<strong>' + (list.length !== all.length ? '검색 결과 ' : '전체 ') + list.length + '건</strong>',
      '승인 ' + count('APPROVE') + '건', '반려 ' + count('REJECT') + '건', '승인 취소 ' + count('CANCEL') + '건']);
    const cols = seeAll ? 7 : 6;
    $('#rows').innerHTML = rows.length ? rows.map(function (x) {
      const a = D.APPROVAL_ACTIONS[x.h.action];
      return '<tr>' +
        '<td class="nowrap num-left">' + C.fmtDateTime(x.h.at) + '</td>' +
        '<td><a class="cell-title" href="review.html?id=' + encodeURIComponent(x.c.id) + '">' + esc(x.c.counterparty) + '</a>' +
          '<span class="cell-meta">' + esc(x.c.id) + ', ' + esc(C.serviceLabel(x.c.services)) + ', ' + (x.h.round || 1) + '차</span></td>' +
        '<td class="nowrap">' + esc(D.STEPS[x.h.step].no + ' ' + D.STEPS[x.h.step].short) + '</td>' +
        '<td class="nowrap">' + C.badge(a.tone, a.label) + '</td>' +
        (seeAll ? '<td class="nowrap">' + esc(C.userName(x.h.actorId)) + (x.h.onBehalfOf ? '<span class="cell-meta">' + esc(C.userName(x.h.onBehalfOf)) + '님 대신</span>' : '') + '</td>' : '') +
        '<td>' + (x.h.comment ? esc(x.h.comment) : '-') + '</td>' +
        '<td class="nowrap">' + C.statusBadge(x.c) + '</td>' +
      '</tr>';
    }).join('') : '<tr><td class="empty-row" colspan="' + cols + '">' + (all.length ? '조건에 맞는 기록이 없습니다.' : '아직 처리한 결재가 없습니다.') + '</td></tr>';
    $('#pagination').innerHTML = C.pagerHtml(page, pages, list.length, from, rows.length, PAGE_SIZE, '건');
  }

  $('#filter').addEventListener('input', function () { page = 1; render(); });
  $('#filter').addEventListener('change', function () { page = 1; render(); });
  $('#filter').addEventListener('reset', function () { setTimeout(function () { page = 1; render(); }, 0); });
  $('#filter').addEventListener('submit', function (e) { e.preventDefault(); });
  $('#pagination').addEventListener('click', function (e) {
    const b = e.target.closest('button[data-page]');
    if (!b || b.disabled) return;
    page = Number(b.getAttribute('data-page'));
    render();
    $('#list').scrollIntoView({ block: 'start' });
  });
  render();
})();
