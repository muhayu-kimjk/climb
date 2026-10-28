/* =====================================================================
 * SCR-34 운영 검토 대기 화면 로직 (ops-queue.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-FLOW-25, 26, 28, REQ-SIGN-08, REQ-CHK-08
 * 하는 일
 *   1. ⑨ 운영 적용(고객지원)과 ⑩ 재무 확인(재무) 중 내 차례인 건을 모음
 *      (최고관리자, 관리자는 모든 담당자 것을, 고객지원 리더와 재무 리더, 재무 임원은 그 분야 담당자 것을 담당자 칸과 함께. v0.29)
 *   2. 검색, 단계, 서비스, 대기 기간으로 거르기. 오래 기다린 순서로
 *   3. 체크리스트 4번(회계 영향 특수 조건)이 "예"인 계약은 배지로 표시
 *   4. 한 쪽에 20건씩 쪽 나누기
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const PAGE_SIZE = 20;
  const LONG = D.ALERT_RULES.approvalDelayDays;
  const OPS_STEPS = ['S09', 'S10'];

  const seeAll = me.role === 'SUPER' || me.role === 'ADMIN';
  const lead = !seeAll && C.isLead(me);
  const showWho = seeAll || lead; // 담당자 칸을 보이는지
  if (!seeAll && !C.hasRole(me, ['CEM', 'FINANCE'])) {
    $('#notice').innerHTML = C.noticeBox('', '운영 검토 대기는 고객지원과 재무가 씁니다',
      '지금은 ' + esc(C.roleLabel(me.role)) + ' 역할로 보고 있습니다. 진행 상황은 계약 현황 > 전체 진행 현황에서 볼 수 있습니다.');
    $('#list').hidden = true;
    return;
  }
  if (seeAll) $('#intro').textContent = '모든 담당자의 운영 적용과 재무 확인 차례입니다(' + C.roleLabel(me.role) + ' 보기). 오래 기다린 순서로 보여 줍니다.';
  if (lead) $('#intro').textContent = C.roleLabel(me.base) + '의 차례를 모두 봅니다(' + C.roleLabel(me.role) + ' 보기). 처리는 담당자나 대리로 지정된 사람이 합니다.';

  const all = (lead ? C.areaQueue(me, OPS_STEPS) : C.pendingQueue(me, seeAll, OPS_STEPS)).map(function (x) {
    return { c: x.c, s: x.s, wait: C.waitDays(x.c, x.s) };
  }).sort(function (a, b) { return b.wait - a.wait; });

  function options(first, pairs) {
    return '<option value="">' + esc(first) + '</option>' + pairs.map(function (p) { return '<option value="' + p[0] + '">' + esc(p[1]) + '</option>'; }).join('');
  }
  $('#f-step').innerHTML = options('전체 단계', OPS_STEPS.map(function (code) { return [code, C.stepLabel(code)]; }));
  $('#f-service').innerHTML = options('전체 서비스', Object.keys(D.SERVICES).map(function (k) { return [k, D.SERVICES[k]]; }));

  $('#thead').innerHTML = '<tr><th scope="col" class="col-customer">고객사</th><th scope="col" class="col-service">서비스</th><th scope="col">단계</th>' +
    (showWho ? '<th scope="col">담당자</th>' : '') + '<th scope="col">체결본 등록일</th><th scope="col" class="col-wait">대기</th></tr>';

  let page = 1;
  function filtered() {
    const q = $('#f-q').value.trim().toLowerCase();
    const step = $('#f-step').value, service = $('#f-service').value, wait = $('#f-wait').value;
    return all.filter(function (x) {
      // 볼 수 없는 계약은 고객사 이름이나 계약번호로 찾을 수 없게 함
      if (q && (!C.canView(x.c, me) || (x.c.counterparty.toLowerCase().indexOf(q) < 0 && String(x.c.id).toLowerCase().indexOf(q) < 0))) return false;
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
    const acc = list.filter(function (x) { return x.c.checklist && x.c.checklist.accounting === 'YES'; }).length;
    $('#list-count').innerHTML = C.meta([[(list.length !== all.length ? '검색 결과' : '전체'), '<strong>' + list.length + '건</strong>'],
      ['회계 영향 조건', acc + '건'], [LONG + '일 이상', list.filter(function (x) { return x.wait >= LONG; }).length + '건']]);
    const cols = showWho ? 6 : 5;
    $('#rows').innerHTML = rows.length ? rows.map(function (x) {
      const service = esc(C.serviceLabel(x.c.services));
      // 체크리스트 4번이 "예"인 계약: 재무가 특수 조건을 확인해야 함 (REQ-CHK-08)
      const accBadge = x.c.checklist && x.c.checklist.accounting === 'YES' ? '<span class="cell-meta">' + C.badge('attention', '회계 영향 조건') + '</span>' : '';
      return '<tr>' +
        // 리더가 보는 분야 전체 목록에는 볼 수 없는 열람 제한 계약도 있음: 고객사를 가림 (v0.58 QA)
        (C.canView(x.c, me)
          ? '<td><a class="cell-title" href="review.html?id=' + encodeURIComponent(x.c.id) + '">' + esc(x.c.counterparty) + '</a>' +
            '<span class="cell-sub">' + service + '</span><span class="cell-meta">' + esc(x.c.id) + (x.c.restricted ? ' ' + C.icon('lock', 'sm') : '') + '</span></td>'
          : '<td><span class="cell-title is-masked">' + C.icon('lock', 'sm') + '열람 제한 계약</span></td>') +
        '<td class="col-service">' + service + '</td>' +
        // 운영 변경(v0.26)은 단계 이름을 "운영 변경"으로, 대리 지정으로 내 차례가 된 건은 누구 대신인지 표시
        '<td class="nowrap">' + esc(C.stepLabel(x.s.step, x.c)) + accBadge +
          (C.isChange(x.c) ? '<span class="cell-meta">' + esc(C.kindLabel(x.c)) + '</span>' : '') +
          (!showWho && x.s.userId !== me.id ? '<span class="cell-meta">' + esc(C.ownerLabel(x.s.userId)) + ' 대신 (대리 지정)</span>' : '') + '</td>' +
        (showWho ? '<td class="center">' + esc(C.ownerLabel(x.s.userId)) + '</td>' : '') +
        // 운영 변경은 체결본이 없으므로 기안일
        '<td class="num-left">' + (x.c.signedAt ? C.fmtDate(x.c.signedAt) : C.isChange(x.c) ? '기안 ' + C.fmtDate(x.c.requestedAt) : '-') + '</td>' +
        '<td class="num col-wait"><span' + (x.wait >= LONG ? ' class="wait-long"' : '') + '>' + x.wait + '일</span></td>' +
      '</tr>';
    }).join('') : '<tr><td class="empty-row" colspan="' + cols + '">' + (all.length ? '조건에 맞는 건이 없습니다.' : '지금 차례인 운영 검토가 없습니다.') + '</td></tr>';
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
