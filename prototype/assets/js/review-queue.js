/* =====================================================================
 * SCR-21 검토 대기 화면 로직 (review-queue.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-DASH-05, REQ-STEP-04, REQ-REV-01, REQ-SIGN-07
 * 하는 일
 *   1. 내 차례인 단계를 모음: ②~⑤ 계약 검토와 ⑥ 인장 날인(총무), ⑧ 체결본 확인(세일즈어드민) (v0.23)
 *      (슈퍼관리자, 관리자는 모든 담당자 것을 담당자 칸과 함께)
 *   2. 검색, 단계, 서비스, 대기 기간으로 거르기. 오래 기다린 순서로 정렬
 *   3. 한 쪽에 20건씩 쪽 나누기 (화면이 A4 2장을 넘지 않게)
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const PAGE_SIZE = 20;
  const LONG = D.ALERT_RULES.approvalDelayDays;
  const QUEUE_STEPS = ['S02', 'S03', 'S04', 'S05', 'S06', 'S08']; // ⑦은 체결 대기, ⑨⑩은 운영 검토 대기에서

  const seeAll = me.role === 'SUPER' || me.role === 'ADMIN';
  if (!seeAll && D.APPROVER_ROLES.concat(['GA']).indexOf(me.role) < 0) {
    $('#notice').innerHTML = '<div class="notice" role="status"><p class="notice-title">' + C.icon('alert') + '검토 대기는 결재 역할과 총무가 씁니다</p>' +
      '<p>지금은 ' + esc(C.roleLabel(me.role)) + ' 역할로 보고 있습니다. 진행 상황은 계약 현황 > 전체 진행 현황에서 볼 수 있습니다.</p></div>';
    $('#list').hidden = true;
    return;
  }
  if (seeAll) $('#intro').textContent = '모든 담당자의 차례인 결재입니다(' + C.roleLabel(me.role) + ' 보기). 오래 기다린 순서로 보여 줍니다.';

  // 내 차례 목록. 같은 계약에서 동시에 차례인 다른 단계도 알려 줌(④와 ⑤)
  const all = C.pendingQueue(me, seeAll, QUEUE_STEPS).map(function (x) {
    return { c: x.c, s: x.s, wait: C.waitDays(x.c, x.s) };
  }).sort(function (a, b) { return b.wait - a.wait; });

  /* ---------- 거르기 선택지 ---------- */
  function options(first, pairs) {
    return '<option value="">' + esc(first) + '</option>' + pairs.map(function (p) { return '<option value="' + p[0] + '">' + esc(p[1]) + '</option>'; }).join('');
  }
  $('#f-step').innerHTML = options('전체 단계', QUEUE_STEPS.map(function (code) { return [code, C.stepLabel(code)]; }));
  $('#f-service').innerHTML = options('전체 서비스', Object.keys(D.SERVICES).map(function (k) { return [k, D.SERVICES[k]]; }));

  $('#thead').innerHTML = '<tr><th scope="col" class="col-customer">고객사</th><th scope="col" class="col-service">서비스</th><th scope="col">단계</th>' +
    (seeAll ? '<th scope="col">담당자</th>' : '') + '<th scope="col">요청자</th><th scope="col">기안일</th><th scope="col" class="num">대기</th></tr>';

  let page = 1;
  function filtered() {
    const q = $('#f-q').value.trim().toLowerCase();
    const step = $('#f-step').value, service = $('#f-service').value, wait = $('#f-wait').value;
    return all.filter(function (x) {
      if (q && x.c.counterparty.toLowerCase().indexOf(q) < 0 && String(x.c.id).toLowerCase().indexOf(q) < 0) return false;
      if (step && x.s.step !== step) return false;
      if (service && (x.c.services || []).indexOf(service) < 0) return false;
      if (wait === 'LONG' && x.wait < LONG) return false;
      return true;
    });
  }

  function render() {
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (page > pages) page = pages;
    const from = (page - 1) * PAGE_SIZE;
    const rows = list.slice(from, from + PAGE_SIZE);
    const long = list.filter(function (x) { return x.wait >= LONG; }).length;
    $('#list-count').innerHTML = C.meta(['<strong>' + (list.length !== all.length ? '검색 결과 ' : '전체 ') + list.length + '건</strong>', LONG + '일 이상 ' + long + '건']);
    const cols = seeAll ? 7 : 6;
    $('#rows').innerHTML = rows.length ? rows.map(function (x) {
      const service = esc(C.serviceLabel(x.c.services));
      // 같은 계약에서 동시에 차례인 다른 단계 (④와 ⑤)
      const together = C.pendingSteps(x.c).filter(function (o) { return o.step !== x.s.step; })
        .map(function (o) { return D.STEPS[o.step].no; }).join(', ');
      return '<tr>' +
        '<td><a class="cell-title" href="review.html?id=' + encodeURIComponent(x.c.id) + '">' + esc(x.c.counterparty) + '</a>' +
          '<span class="cell-sub">' + service + '</span><span class="cell-meta">' + esc(x.c.id) + (x.c.restricted ? ' ' + C.icon('lock', 'sm') : '') + '</span></td>' +
        '<td class="col-service">' + service + '</td>' +
        '<td class="nowrap">' + esc(C.stepLabel(x.s.step)) + (together ? '<span class="cell-meta">동시: ' + esc(together) + '</span>' : '') + '</td>' +
        (seeAll ? '<td class="nowrap">' + esc(C.userName(x.s.userId)) + '</td>' : '') +
        '<td class="nowrap">' + esc(C.userName(x.c.requesterId)) + '</td>' +
        '<td class="nowrap num-left">' + C.fmtDate(x.c.requestedAt) + '</td>' +
        '<td class="num"><span' + (x.wait >= LONG ? ' class="wait-long"' : '') + '>' + x.wait + '일</span></td>' +
      '</tr>';
    }).join('') : '<tr><td class="empty-row" colspan="' + cols + '">' + (all.length ? '조건에 맞는 건이 없습니다.' : '지금 차례인 결재가 없습니다.') + '</td></tr>';
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
