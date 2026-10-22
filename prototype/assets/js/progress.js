/* =====================================================================
 * SCR-20 전체 진행 현황 화면 로직 (progress.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-FLOW-03~05, REQ-AUTH-09, REQ-REV-07
 * 하는 일
 *   1. 아직 끝나지 않은 계약(검토 중, 반려, 체결 대기, 운영 검토)을 모음. 오래된 기안부터
 *   2. 검색, 상태, 서비스, 영업대표로 거르기 (?status=REVIEW 또는 ?status=OPS_REVIEW로 미리 거름)
 *   3. 열람 제한 계약은 볼 수 없는 사람에게 가림. 한 쪽에 20건
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const PAGE_SIZE = 20;
  const OPEN = ['IN_REVIEW', 'SUPPLEMENT', 'REJECTED', 'APPROVED', 'OPS_REVIEW']; // 보완 중(v0.26)도 진행 중

  const all = D.CONTRACTS.filter(function (c) { return OPEN.indexOf(c.status) > -1; })
    .sort(function (a, b) { return a.requestedAt.localeCompare(b.requestedAt); });

  function options(first, pairs) {
    return '<option value="">' + esc(first) + '</option>' + pairs.map(function (p) { return '<option value="' + p[0] + '">' + esc(p[1]) + '</option>'; }).join('');
  }
  // 상태: REVIEW는 검토 중과 반려를 함께 (개요의 '계약 검토' 단계와 같은 범위)
  $('#f-status').innerHTML = options('전체 상태', [['REVIEW', '검토 중, 보완 중, 반려']].concat(OPEN.map(function (k) { return [k, D.STATUS[k].label]; })));
  $('#f-service').innerHTML = options('전체 서비스', Object.keys(D.SERVICES).map(function (k) { return [k, D.SERVICES[k]]; }));
  const owners = all.map(function (c) { return c.requesterId; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
  $('#f-owner').innerHTML = options('전체', owners.map(function (u) { return [u, C.ownerLabel(u)]; }));
  const preset = new URLSearchParams(location.search).get('status');
  if (preset) $('#f-status').value = preset;

  let page = 1;
  function filtered() {
    const q = $('#f-q').value.trim().toLowerCase();
    const status = $('#f-status').value, service = $('#f-service').value, owner = $('#f-owner').value;
    return all.filter(function (c) {
      const visible = C.canView(c, me);
      // 볼 수 없는 계약은 고객사 이름으로 찾을 수 없게 함
      if (q && (!visible || (c.counterparty.toLowerCase().indexOf(q) < 0 && String(c.id).toLowerCase().indexOf(q) < 0))) return false;
      if (status === 'REVIEW' ? ['IN_REVIEW', 'SUPPLEMENT', 'REJECTED'].indexOf(c.status) < 0 : status && c.status !== status) return false;
      if (service && (!visible || (c.services || []).indexOf(service) < 0)) return false;
      if (owner && c.requesterId !== owner) return false;
      return true;
    });
  }

  function render() {
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (page > pages) page = pages;
    const from = (page - 1) * PAGE_SIZE;
    const rows = list.slice(from, from + PAGE_SIZE);
    const count = function (s) { return list.filter(function (c) { return c.status === s; }).length; };
    $('#list-count').innerHTML = C.meta(['<strong>' + (list.length !== all.length ? '검색 결과 ' : '전체 ') + list.length + '건</strong>'].concat(OPEN.map(function (s) {
      return esc(D.STATUS[s].label) + ' ' + count(s) + '건';
    })));
    $('#rows').innerHTML = rows.length ? rows.map(function (c) {
      const visible = C.canView(c, me);
      const service = esc(C.serviceLabel(c.services));
      const cust = visible
        ? '<a class="cell-title" href="review.html?id=' + encodeURIComponent(c.id) + '">' + esc(c.counterparty) + '</a>' +
          '<span class="cell-sub">' + service + '</span><span class="cell-meta">' + esc(c.id) + (c.restricted ? ' ' + C.icon('lock', 'sm') : '') + '</span>'
        : '<span class="cell-title is-masked">' + C.icon('lock', 'sm') + '열람 제한 계약</span>';
      return '<tr' + (c.status === 'REJECTED' ? ' class="is-alert"' : '') + '>' +
        '<td>' + cust + '</td>' +
        '<td class="col-service">' + (visible ? service : '-') + '</td>' +
        '<td class="nowrap">' + C.statusBadge(c) + '</td>' +
        '<td>' + C.progressText(c) + '</td>' +
        '<td class="center">' + esc(C.ownerLabel(c.requesterId)) + '</td>' +
        '<td class="num-left">' + C.fmtDate(c.requestedAt) + '</td>' +
      '</tr>';
    }).join('') : '<tr><td class="empty-row" colspan="6">조건에 맞는 계약이 없습니다.</td></tr>';
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
