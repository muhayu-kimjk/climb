/* =====================================================================
 * SCR-31 체결 대기 화면 로직 (signing.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-FLOW-04~05, REQ-SIGN-07, REQ-ENV-10
 * 하는 일
 *   1. 계약 검토가 끝나 체결 중인 계약(⑥ 인장 날인, ⑦ 체결본 등록, ⑧ 체결본 확인)을 모음
 *      영업은 내가 지금 영업대표인 계약만(기획자 결정 2026-11-03 C-44, 넘겨받은 계약 포함), 최고관리자와 관리자는 모든 계약을 영업대표 칸과 함께
 *   2. 검색, 지금 단계, 오래 기다린 건으로 거르기. 오래된 승인부터
 *   3. 한 쪽에 20건씩 쪽 나누기
 *   4. 일수 칸 (기획자 결정 2026-11-02 D-12): ⑥, ⑦ 줄은 승인 후 일수(14일 이상 강조), ⑧ 줄은 그 단계에 온 날부터 센 대기(5일 이상 강조)
 *   5. 휴대폰에서는 일수를 고객사 아래 작은 줄에도 씀 (기획자 결정 2026-11-02 D-9, PC는 그대로)
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const PAGE_SIZE = 20;
  const LONG = D.ALERT_RULES.signDelayDays;      // ⑥, ⑦: 승인 후 일수의 강조 기준(기안자 독촉과 같음)
  const STEP_LONG = D.ALERT_RULES.approvalDelayDays; // ⑧: 그 단계 대기의 강조 기준(⑧ 담당자 독촉, 다른 화면과 같음. D-12)
  // 관리자가 바꾼 독촉 기준 일수를 안내와 거르기에 씀 (결재선 규칙의 독촉 기준, v0.63 점검에서 고침: 일수가 글자로 고정되어 있었음)
  document.querySelectorAll('[data-rule]').forEach(function (el) { el.textContent = D.ALERT_RULES[el.getAttribute('data-rule')]; });
  const SIGN_STEPS = ['S06', 'S07', 'S08'];

  const seeAll = me.role === 'SUPER' || me.role === 'ADMIN';
  // 기획자 결정 2026-11-03(C-44): 내 계약은 내가 지금 영업대표인 계약(C.isSalesRep: 넘겨받은 계약, 맡을 수 없는 영업대표 대신 맡는 영업 리더)
  //   ⑦ 차례가 그 사람에게 가므로(common.js stepUser) 이 목록도 같은 사람에게. 영업 역할이 아니어도 그런 계약이 있으면 들어옴
  const repOwn = function (c) { return C.isSalesRep(c, me); };
  if (!seeAll && me.role !== 'SALES' && !D.CONTRACTS.some(function (c) { return c.status === 'APPROVED' && repOwn(c); })) {
    $('#notice').innerHTML = C.noticeBox('', '체결 대기는 영업이 씁니다',
      '지금은 ' + esc(C.roleLabel(me.role)) + ' 역할로 보고 있습니다. ⑥ 인장 날인과 ⑧ 체결본 확인 차례는 계약 현황 > 검토 대기에서 봅니다.');
    $('#list').hidden = true;
    return;
  }
  if (seeAll) $('#intro').textContent = '계약 검토가 끝났지만 체결이 끝나지 않은 모든 계약입니다(' + C.roleLabel(me.role) + ' 보기). 오래된 승인부터 보여 줍니다.';

  // 기획자 결정 2026-11-02 D-12: "승인 후" 일수와 14일 강조는 ⑥, ⑦ 줄에만
  //   ⑧ 줄은 개요, 전체 진행 현황, 내 등록 목록처럼 그 단계에 온 날부터 센 대기(C.waitDays)와 5일 강조. 독촉 이메일 규칙은 그대로
  //   at8: ⑧ 줄인지 / days: 칸에 쓰는 일수 / long: 강조하는지
  const all = D.CONTRACTS.filter(function (c) {
    return c.status === 'APPROVED' && (seeAll || repOwn(c));
  }).map(function (c) {
    const s = C.currentStep(c);
    const at8 = !!s && s.step === 'S08';
    const days = at8 ? C.waitDays(c, s) : C.daysSince(c.approvedAt);
    return { c: c, s: s, at8: at8, days: days, long: days >= (at8 ? STEP_LONG : LONG) };
  }).sort(function (a, b) { return a.c.approvedAt.localeCompare(b.c.approvedAt); });

  function options(first, pairs) {
    return '<option value="">' + esc(first) + '</option>' + pairs.map(function (p) { return '<option value="' + p[0] + '">' + esc(p[1]) + '</option>'; }).join('');
  }
  $('#f-step').innerHTML = options('전체', SIGN_STEPS.map(function (code) { return [code, D.STEPS[code].no + ' ' + D.STEPS[code].ing.replace(/ (중|대기)$/, '')]; }));

  // 일수 칸 머리글: 두 가지 세는 법이 함께 있음을 알림 ("승인 후" 아래 작은 글자로 "⑧은 대기", D-12)
  $('#thead').innerHTML = '<tr><th scope="col" class="col-customer">고객사</th><th scope="col" class="col-service">서비스</th><th scope="col">지금 단계</th>' +
    (seeAll ? '<th scope="col">영업대표</th>' : '') + '<th scope="col">승인일</th><th scope="col" class="col-wait">승인 후<span class="cell-meta">⑧은 대기</span></th></tr>';

  let page = 1;
  function filtered() {
    const q = $('#f-q').value.trim().toLowerCase();
    const step = $('#f-step').value, wait = $('#f-wait').value;
    return all.filter(function (x) {
      const visible = C.canView(x.c, me);
      if (q && (!visible || (x.c.counterparty.toLowerCase().indexOf(q) < 0 && String(x.c.id).toLowerCase().indexOf(q) < 0))) return false;
      if (step && (!x.s || x.s.step !== step)) return false;
      if (wait === 'LONG' && !x.long) return false; // ⑥, ⑦은 승인 후 14일, ⑧은 대기 5일 기준 (D-12)
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
    const long = list.filter(function (x) { return x.long; }).length;
    $('#list-count').innerHTML = C.meta([[(list.length !== all.length ? '검색 결과' : '전체'), '<strong>' + list.length + '건</strong>'],
      seeAll ? ['⑦ 체결본 등록 대기', list.filter(function (x) { return x.s && x.s.step === 'S07'; }).length + '건'] : ['⑦ 내 차례', mine + '건'],
      ['오래 기다린 건', long + '건']]); // 두 기준(⑥⑦ 승인 후, ⑧ 대기)을 함께 세므로 일수 대신 "오래 기다린 건" (D-12)
    const cols = seeAll ? 6 : 5;
    $('#rows').innerHTML = rows.length ? rows.map(function (x) {
      const visible = C.canView(x.c, me);
      const service = esc(C.serviceLabel(x.c.services));
      const days = x.long ? '<span class="wait-long">' + x.days + '일</span>' : x.days + '일';
      // 휴대폰에서만 보이는 일수 줄 (D-9): 맨 끝 일수 칸이 첫 화면에 없어도 보이게. 진한 분홍 강조도 그대로. 가린 줄에도 보임
      const daysSub = '<span class="cell-sub">' + (x.at8 ? '대기 ' : '승인 후 ') + days + '</span>';
      const cust = visible
        ? '<a class="cell-title" href="review.html?id=' + encodeURIComponent(x.c.id) + '">' + esc(x.c.counterparty) + '</a>' +
          '<span class="cell-sub">' + service + '</span>' + daysSub + '<span class="cell-meta">' + esc(x.c.id) + (x.c.restricted ? ' ' + C.icon('lock', 'sm') : '') + '</span>'
        : '<span class="cell-title is-masked">' + C.icon('lock', 'sm') + '열람 제한 계약</span>' + daysSub;
      // 지금 단계와 담당자. ⑦이 내 차례면 배지로 알림. 단계 이름 끝의 "대기", "중"은 떼어 전체 진행 현황과 같게(REQ-DASH-06)
      //   기획자 결정 2026-11-02 B-5: 견적서로 계약서를 대신한 계약은 "⑦ 견적서 등록", "⑧ 견적서 확인"(C.stepIng)
      const st = x.s ? D.STEPS[x.s.step] : null;
      const stepCell = st
        ? esc(st.no + ' ' + C.stepIng(x.c, x.s.step).replace(/ (중|대기)$/, '')) + (x.s.step === 'S07' && x.s.userId === me.id ? ' ' + C.badge('progress', '내 차례') : '') +
          '<span class="cell-meta">' + esc(C.roleShort(x.s.role)) + ' ' + esc(C.ownerLabel(x.s.userId)) + '</span>'
        : '-';
      return '<tr>' +
        '<td>' + cust + '</td>' +
        '<td class="col-service">' + (visible ? service : '-') + '</td>' +
        '<td class="nowrap">' + stepCell + '</td>' +
        (seeAll ? '<td class="center">' + esc(C.ownerLabel(C.salesRepOf(x.c))) + (C.repNote(x.c) ? '<span class="cell-meta">' + esc(C.repNote(x.c)) + '</span>' : '') + '</td>' : '') + // 지금 영업대표(C-44)
        '<td class="num-left">' + C.fmtDate(x.c.approvedAt) + '</td>' +
        '<td class="num col-wait">' + days + '</td>' + // ⑥, ⑦은 승인 후, ⑧은 대기 (D-12)
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
