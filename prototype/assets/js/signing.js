/* =====================================================================
 * SCR-31 체결 대기 화면 로직 (signing.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-FLOW-04~05, REQ-SIGN-07, REQ-ENV-10
 * 하는 일
 *   1. 계약 검토가 끝나 체결 중인 계약(⑥ 인장 날인, ⑦ 체결본 등록, ⑧ 체결본 확인)을 모음
 *      영업은 내가 기안한 계약만, 최고관리자와 관리자는 모든 계약을 영업대표 칸과 함께
 *   2. 검색, 지금 단계, 승인 후 14일 이상으로 거르기. 오래된 승인부터
 *   3. 한 쪽에 20건씩 쪽 나누기
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const PAGE_SIZE = 20;
  const LONG = D.ALERT_RULES.signDelayDays;
  const SIGN_STEPS = ['S06', 'S07', 'S08'];

  const seeAll = me.role === 'SUPER' || me.role === 'ADMIN';
  if (!seeAll && me.role !== 'SALES') {
    $('#notice').innerHTML = '<div class="notice" role="status"><p class="notice-title">' + C.icon('alert') + '체결 대기는 영업이 씁니다</p>' +
      '<p>지금은 ' + esc(C.roleLabel(me.role)) + ' 역할로 보고 있습니다. ⑥ 인장 날인과 ⑧ 체결본 확인 차례는 계약 현황 > 검토 대기에서 봅니다.</p></div>';
    $('#list').hidden = true;
    return;
  }
  if (seeAll) $('#intro').textContent = '계약 검토가 끝났지만 체결이 끝나지 않은 모든 계약입니다(' + C.roleLabel(me.role) + ' 보기). 오래된 승인부터 보여 줍니다.';

  const all = D.CONTRACTS.filter(function (c) {
    return c.status === 'APPROVED' && (seeAll || c.requesterId === me.id);
  }).map(function (c) {
    return { c: c, s: C.currentStep(c), days: C.daysSince(c.approvedAt) };
  }).sort(function (a, b) { return a.c.approvedAt.localeCompare(b.c.approvedAt); });

  function options(first, pairs) {
    return '<option value="">' + esc(first) + '</option>' + pairs.map(function (p) { return '<option value="' + p[0] + '">' + esc(p[1]) + '</option>'; }).join('');
  }
  $('#f-step').innerHTML = options('전체', SIGN_STEPS.map(function (code) { return [code, D.STEPS[code].no + ' ' + D.STEPS[code].ing]; }));

  $('#thead').innerHTML = '<tr><th scope="col" class="col-customer">고객사</th><th scope="col" class="col-service">서비스</th><th scope="col">지금 단계</th>' +
    (seeAll ? '<th scope="col">영업대표</th>' : '') + '<th scope="col">승인일</th><th scope="col" class="num">승인 후</th></tr>';

  let page = 1;
  function filtered() {
    const q = $('#f-q').value.trim().toLowerCase();
    const step = $('#f-step').value, wait = $('#f-wait').value;
    return all.filter(function (x) {
      const visible = C.canView(x.c, me);
      if (q && (!visible || (x.c.counterparty.toLowerCase().indexOf(q) < 0 && String(x.c.id).toLowerCase().indexOf(q) < 0))) return false;
      if (step && (!x.s || x.s.step !== step)) return false;
      if (wait === 'LONG' && x.days < LONG) return false;
      return true;
    });
  }

  function render() {
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (page > pages) page = pages;
    const from = (page - 1) * PAGE_SIZE;
    const rows = list.slice(from, from + PAGE_SIZE);
    const mine = list.filter(function (x) { return x.s && x.s.step === 'S07' && x.s.userId === me.id; }).length;
    const long = list.filter(function (x) { return x.days >= LONG; }).length;
    $('#list-count').innerHTML = C.meta(['<strong>' + (list.length !== all.length ? '검색 결과 ' : '전체 ') + list.length + '건</strong>',
      (seeAll ? '⑦ 체결본 등록 대기 ' + list.filter(function (x) { return x.s && x.s.step === 'S07'; }).length : '⑦ 내 차례 ' + mine) + '건',
      LONG + '일 이상 ' + long + '건']);
    const cols = seeAll ? 6 : 5;
    $('#rows').innerHTML = rows.length ? rows.map(function (x) {
      const visible = C.canView(x.c, me);
      const service = esc(C.serviceLabel(x.c.services));
      const cust = visible
        ? '<a class="cell-title" href="review.html?id=' + encodeURIComponent(x.c.id) + '">' + esc(x.c.counterparty) + '</a>' +
          '<span class="cell-sub">' + service + '</span><span class="cell-meta">' + esc(x.c.id) + (x.c.restricted ? ' ' + C.icon('lock', 'sm') : '') + '</span>'
        : '<span class="cell-title is-masked">' + C.icon('lock', 'sm') + '열람 제한 계약</span>';
      // 지금 단계와 담당자. ⑦이 내 차례면 배지로 알림
      const st = x.s ? D.STEPS[x.s.step] : null;
      const stepCell = st
        ? esc(st.no + ' ' + st.ing) + (x.s.step === 'S07' && x.s.userId === me.id ? ' ' + C.badge('progress', '내 차례') : '') +
          '<span class="cell-meta">' + esc(C.roleShort(x.s.role)) + ' ' + esc(C.ownerLabel(x.s.userId)) + '</span>'
        : '-';
      return '<tr>' +
        '<td>' + cust + '</td>' +
        '<td class="col-service">' + (visible ? service : '-') + '</td>' +
        '<td class="nowrap">' + stepCell + '</td>' +
        (seeAll ? '<td class="center">' + esc(C.ownerLabel(x.c.requesterId)) + '</td>' : '') +
        '<td class="num-left">' + C.fmtDate(x.c.approvedAt) + '</td>' +
        '<td class="num"><span' + (x.days >= LONG ? ' class="wait-long"' : '') + '>' + x.days + '일</span></td>' +
      '</tr>';
    }).join('') : '<tr><td class="empty-row" colspan="' + cols + '">' + (all.length ? '조건에 맞는 건이 없습니다.' : '체결을 기다리는 계약이 없습니다.') + '</td></tr>';
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
