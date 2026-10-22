/* =====================================================================
 * SCR-41 전체 계약 화면 로직 (contracts.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-FLOW-15, REQ-FLOW-18, REQ-AUTH-09, REQ-ARC-01
 * 하는 일
 *   1. 계약 묶음(원계약 + 변경, 연장, 해지)을 한 줄씩 모음 (common.js bundles). 최근 원계약부터
 *   2. 검색, 상태, 서비스, 영업대표로 거르기
 *   3. 열람 제한 계약은 볼 수 없는 사람에게 가림. 한 쪽에 20건
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const PAGE_SIZE = 20;
  const WORKING = ['IN_REVIEW', 'SUPPLEMENT', 'REJECTED', 'APPROVED', 'OPS_REVIEW'];

  const all = C.bundles().sort(function (a, b) { return (b.root.requestedAt || '').localeCompare(a.root.requestedAt || ''); });

  function options(first, pairs) {
    return '<option value="">' + esc(first) + '</option>' + pairs.map(function (p) { return '<option value="' + p[0] + '">' + esc(p[1]) + '</option>'; }).join('');
  }
  // 상태: 진행 중(검토 중, 반려, 체결 대기, 운영 검토)은 하나로 묶어 거름
  $('#f-status').innerHTML = options('전체 상태', [['WORKING', '진행 중'], ['ACTIVE', '계약 완료'], ['EXPIRED', '만료'], ['TERMINATED', '해지']]);
  $('#f-service').innerHTML = options('전체 서비스', Object.keys(D.SERVICES).map(function (k) { return [k, D.SERVICES[k]]; }));
  const owners = all.map(function (b) { return b.root.requesterId; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
  $('#f-owner').innerHTML = options('전체', owners.map(function (u) { return [u, C.ownerLabel(u)]; }));

  // 변경과 연장 칸: "변경 1, 연장 1(조건 그대로), 해지 기안"
  function childText(b) {
    const parts = [];
    if (b.count('AMEND')) parts.push('변경 ' + b.count('AMEND'));
    if (b.count('RENEW')) parts.push('연장 ' + b.count('RENEW'));
    if (b.count('TERMINATE')) parts.push('해지 기안');
    return parts.join(', ') || '-';
  }

  let page = 1;
  function filtered() {
    const q = $('#f-q').value.trim().toLowerCase();
    const status = $('#f-status').value, service = $('#f-service').value, owner = $('#f-owner').value;
    return all.filter(function (b) {
      const visible = C.canView(b.root, me);
      // 볼 수 없는 계약은 고객사 이름으로 찾을 수 없게 함
      if (q && (!visible || (b.root.counterparty.toLowerCase().indexOf(q) < 0 && b.items.every(function (c) { return String(c.id).toLowerCase().indexOf(q) < 0; })))) return false;
      if (status === 'WORKING' ? WORKING.indexOf(b.status) < 0 : status && b.status !== status) return false;
      if (service && (!visible || (b.root.services || []).indexOf(service) < 0)) return false;
      if (owner && b.root.requesterId !== owner) return false;
      return true;
    });
  }

  function render() {
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (page > pages) page = pages;
    const from = (page - 1) * PAGE_SIZE;
    const rows = list.slice(from, from + PAGE_SIZE);
    const count = function (fn) { return list.filter(fn).length; };
    $('#list-count').innerHTML = C.meta(['<strong>' + (list.length !== all.length ? '검색 결과 ' : '전체 ') + list.length + '건</strong>',
      '진행 중 ' + count(function (b) { return WORKING.indexOf(b.status) > -1; }) + '건',
      '계약 완료 ' + count(function (b) { return b.status === 'ACTIVE'; }) + '건',
      '만료 ' + count(function (b) { return b.status === 'EXPIRED'; }) + '건',
      '해지 ' + count(function (b) { return b.status === 'TERMINATED'; }) + '건']);
    $('#rows').innerHTML = rows.length ? rows.map(function (b) {
      const c = b.root;
      const visible = C.canView(c, me);
      const service = esc(C.serviceLabel(c.services));
      const cust = visible
        ? '<a class="cell-title" href="contract.html?id=' + encodeURIComponent(b.id) + '">' + esc(c.counterparty) + '</a>' +
          '<span class="cell-sub">' + service + '</span><span class="cell-meta">' + esc(b.id) + (c.restricted ? ' ' + C.icon('lock', 'sm') : '') + '</span>'
        : '<span class="cell-title is-masked">' + C.icon('lock', 'sm') + '열람 제한 계약</span>';
      const st = D.STATUS[b.status];
      // 진행 중인 변경, 연장, 해지가 있으면 상태 아래에 알림
      const open = b.open.length ? '<span class="cell-meta">진행 중: ' + esc(b.open.map(function (o) { return C.kindLabel(o); }).join(', ')) + '</span>' : '';
      return '<tr' + (b.status === 'REJECTED' ? ' class="is-alert"' : '') + '>' +
        '<td>' + cust + '</td>' +
        '<td class="col-service">' + (visible ? service : '-') + '</td>' +
        '<td>' + C.badge(st.tone, st.label) + open + '</td>' +
        '<td class="num-left">' + (b.start ? C.fmtPeriod(b.start, b.end) : '-') + '</td>' +
        '<td class="nowrap">' + (visible ? esc(childText(b)) : '-') + '</td>' +
        '<td class="center">' + esc(C.ownerLabel(c.requesterId)) + '</td>' +
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
