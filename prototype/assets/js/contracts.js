/* =====================================================================
 * SCR-41 전체 계약 화면 로직 (contracts.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-FLOW-15, REQ-FLOW-18, REQ-AUTH-09, REQ-ARC-01
 * 하는 일
 *   1. 계약 묶음(원계약 + 변경, 연장, 해지)을 한 줄씩 모음 (common.js bundles). 최근 원계약부터
 *   2. 검색, 상태, 서비스, 영업대표로 거르기
 *   3. 열람 제한 계약은 볼 수 없는 사람에게 가림. 한 쪽에 20건
 *   4. 변경과 연장 칸은 계약 완료된 것만 셈. 진행 중이거나 반려된 기안은 상태 칸 아래 줄에 (기획자 결정 2026-11-02 D-13)
 *   5. "④에서 반부패 조항 없음을 고른 계약만" 거르기 (기획자 결정 2026-11-02 C-15, 통계의 통제 지표에서 ?ab=NONE으로 이어짐)
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
  // 개요에서 영업이 누르면 나로 거름 (?owner=, v0.58 QA)
  const presetOwner = new URLSearchParams(location.search).get('owner');
  //   계약이 하나도 없는 영업도 나로 거름(빈 목록). 진행 현황과 같게 (v0.63 검토)
  if (presetOwner && presetOwner === me.id && owners.indexOf(me.id) < 0) {
    $('#f-owner').insertAdjacentHTML('beforeend', '<option value="' + esc(me.id) + '">' + esc(C.ownerLabel(me.id)) + '</option>');
    owners.push(me.id);
  }
  if (owners.indexOf(presetOwner) > -1) $('#f-owner').value = presetOwner;
  // 개요의 "계약 완료"에서 오면 그 상태로 거름 (?status=, v0.63 점검). 정해 둔 값만 받음
  const presetStatus = new URLSearchParams(location.search).get('status');
  if (['WORKING', 'ACTIVE', 'EXPIRED', 'TERMINATED'].indexOf(presetStatus) > -1) $('#f-status').value = presetStatus;
  // 통계의 통제 지표에서 "없음" 건수를 누르면 반부패 조항 없음으로 거름 (?ab=NONE, 기획자 결정 2026-11-02 C-15)
  if (new URLSearchParams(location.search).get('ab') === 'NONE') $('#f-ab').checked = true;
  // 묶음 안에 ④ 법무가 "반부패 조항 없음"을 고른 계약이 있는지(지금 유효한 ④ 승인 기록, C.legalApproval)
  function abNone(b) { return b.items.some(function (c) { const h = C.legalApproval(c); return !!h && h.antiBribe === 'NONE'; }); }

  // 변경과 연장 칸: "변경 1건, 연장 1건"
  //   기획자 결정 2026-11-02 D-13: 계약 완료된 변경과 연장만 셈. 진행 중이거나 반려된 기안, 해지 기안은 세지 않고 상태 칸 아래 줄에 보임
  //   계약 완료된 뒤 만료된 연장도 셈(common.js bundleOf의 "끝난 연장"과 같은 기준). 운영 변경은 예전처럼 세지 않음
  const DONE = ['ACTIVE', 'EXPIRED'];
  function childText(b) {
    const done = function (kind) { return b.items.filter(function (c) { return c.kind === kind && DONE.indexOf(c.status) > -1; }).length; };
    const parts = [];
    if (done('AMEND')) parts.push('변경 ' + done('AMEND') + '건');
    if (done('RENEW')) parts.push('연장 ' + done('RENEW') + '건');
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
      // 볼 수 없는 계약은 이 거르기로도 빼서, 거른 결과로 판단 내용이 드러나지 않게(서비스 거르기와 같음)
      if ($('#f-ab').checked && (!visible || !abNone(b))) return false;
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
    $('#list-count').innerHTML = C.meta([[(list.length !== all.length ? '검색 결과' : '전체'), '<strong>' + list.length + '건</strong>'],
      ['진행 중', count(function (b) { return WORKING.indexOf(b.status) > -1; }) + '건'],
      ['계약 완료', count(function (b) { return b.status === 'ACTIVE'; }) + '건'],
      ['만료', count(function (b) { return b.status === 'EXPIRED'; }) + '건'],
      ['해지', count(function (b) { return b.status === 'TERMINATED'; }) + '건']]);
    $('#rows').innerHTML = rows.length ? rows.map(function (b) {
      const c = b.root;
      const visible = C.canView(c, me);
      const service = esc(C.serviceLabel(c.services));
      const cust = visible
        ? '<a class="cell-title" href="contract.html?id=' + encodeURIComponent(b.id) + '">' + esc(c.counterparty) + '</a>' +
          '<span class="cell-sub">' + service + '</span><span class="cell-meta">' + esc(b.id) + (c.restricted ? ' ' + C.icon('lock', 'sm') : '') + '</span>'
        : '<span class="cell-title is-masked">' + C.icon('lock', 'sm') + '열람 제한 계약</span>';
      const st = D.STATUS[b.status];
      // 진행 중인 변경, 연장, 해지가 있으면 상태 아래에 알림. "해지 검토 중"처럼 종류와 상태로 씀(만료 예정 화면과 같은 말. "진행 중:"은 위 거르기의 진행 중과 헷갈려 뺌)
      //   기획자 결정 2026-11-02 D-13: 반려되어 다시 기안을 기다리는 기안도 "변경 반려"처럼 함께 보임. 변경과 연장 칸에서 빠져도 목록에서 사라지지 않게. 기안한 순서대로
      const pending = b.items.filter(function (o) { return b.open.indexOf(o) > -1 || b.rejected.indexOf(o) > -1; });
      const open = pending.length ? '<span class="cell-meta">' + esc(pending.map(function (o) { return C.kindLabel(o) + ' ' + D.STATUS[o.status].label; }).join(', ')) + '</span>' : '';
      return '<tr' + (b.status === 'REJECTED' ? ' class="is-alert"' : '') + '>' +
        '<td>' + cust + '</td>' +
        '<td class="col-service">' + (visible ? service : '-') + '</td>' +
        '<td>' + C.badge(st.tone, st.label) + open + '</td>' +
        // 기간: 날짜는 하이픈에서 끊기지 않게 한 덩어리로, 줄은 물결표 뒤에서만 바꿈 (휴대폰에서 네 줄로 꺾였음. 만료 예정 화면과 같은 방식)
        '<td class="num-left">' + (b.start ? '<span class="nowrap">' + C.fmtDate(b.start) + '~</span><wbr><span class="nowrap">' + C.fmtDate(b.end) + '</span>' : '-') + '</td>' +
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
