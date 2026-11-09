/* =====================================================================
 * SCR-12 내 등록 목록 화면 로직 (my-contracts.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-FLOW-14, 17, 31, REQ-ARC-04
 * 하는 일
 *   1. 내가 등록한 계약을 모두 모음(작성 중 포함). 최근 것부터
 *      (최고관리자, 관리자는 모든 영업 것을 영업대표 칸과 함께. 작성 중은 작성자만 보므로 빠짐)
 *   2. 검색, 상태, 계약종류로 거르기. 한 쪽에 20건
 *   3. 할 일: 이어서 작성, 임시 저장 삭제(확인 창), 보완 후 재기안, ⑦ 체결본 등록
 *      휴대폰은 고객사 아래에 같은 버튼을 두고 맨 끝 칸을 감춤(기획자 결정 2026-11-02 D-10). PC는 맨 끝 칸 그대로
 *      기획자 결정 2026-11-02 C-16: 보류가 걸린 반려 기안은 보완 후 재기안 대신 "보류 중이라 기안할 수 없습니다." 한 줄
 *   4. 기획자 결정 2026-11-03 C-44: 영업 리더가 나를 새 영업대표로 정한 계약도 모음(C.salesRepOf). 고객사 아래 작은 줄에 "이어 맡음"
 *      할 일 단추는 지금 영업대표에게만(C.isSalesRep). 내가 기안했지만 다른 사람에게 넘어간 계약은 목록에 남고 "영업대표 바뀜: ○○", 할 일은 "-"
 *      영업대표 칸(최고관리자, 관리자 보기)은 지금 영업대표. 사용 중지라 정하기 전이면 그 아래 "담당 지정 필요 (영업 리더가 맡음)"
 *   표 위 회색 안내 한 줄(D-2)은 my-contracts.html에 있음
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const PAGE_SIZE = 20;

  // 관리자 보기는 뺌(기획자 결정 2026-11-09: 관리자는 처리하지 않고, 이 화면은 관리자 메뉴에도 없었음). 최고관리자는 시연용으로 모두 봄
  const seeAll = me.role === 'SUPER';
  if (!seeAll && me.role !== 'SALES') {
    $('#notice').innerHTML = C.noticeBox('', '내 등록 목록은 영업이 씁니다',
      '지금은 ' + esc(C.roleLabel(me.role)) + ' 역할로 보고 있습니다. 모든 계약은 보관함 > 전체 계약에서 볼 수 있습니다.');
    $('#list').hidden = true;
    return;
  }
  if (seeAll) $('#intro').textContent = '모든 영업이 등록한 계약입니다(' + C.roleLabel(me.role) + ' 보기). 임시 저장한 계약은 작성자만 보므로 빠집니다.';

  const dateOf = function (c) { return c.requestedAt || c.savedAt || ''; };
  // 2026-11-06 점검: 거래처를 넣지 않고 임시 저장한 계약은 상호가 비어 줄 링크에 글이 없고 확인 창과 알림 문장이 어색했음. "거래처 미입력"으로 보임(개요와 같은 말)
  const cpName = function (c) { return c.counterparty || '거래처 미입력'; };
  let all = [];
  function collect() {
    all = D.CONTRACTS.filter(function (c) {
      if (c.status === 'DRAFT') return c.requesterId === me.id;
      // 기획자 결정 2026-11-03(C-44): 내가 기안한 계약과, 영업 리더가 나를 새 영업대표로 정한 계약
      return seeAll || c.requesterId === me.id || C.salesRepOf(c) === me.id;
    }).sort(function (a, b) { return dateOf(b).localeCompare(dateOf(a)); });
  }
  collect();

  function options(first, pairs) {
    return '<option value="">' + esc(first) + '</option>' + pairs.map(function (p) { return '<option value="' + p[0] + '">' + esc(p[1]) + '</option>'; }).join('');
  }
  $('#f-status').innerHTML = options('전체 상태', Object.keys(D.STATUS).map(function (k) { return [k, D.STATUS[k].label]; }));
  // 개요의 "계약 등록"에서 오면 작성 중으로 거름 (?status=, v0.63 점검)
  const presetStatus = new URLSearchParams(location.search).get('status');
  if (D.STATUS[presetStatus]) $('#f-status').value = presetStatus;
  $('#f-kind').innerHTML = options('전체 계약종류', Object.keys(D.KINDS).map(function (k) { return [k, D.KINDS[k]]; }));
  $('#thead').innerHTML = '<tr><th scope="col" class="col-customer col-phone-wide">고객사</th><th scope="col" class="col-phone-wide">계약종류</th><th scope="col">상태</th><th scope="col">현재 진행</th><th scope="col" class="col-wait">대기</th>' +
    (seeAll ? '<th scope="col" class="col-phone-mid">영업대표</th>' : '') + '<th scope="col">기안일</th><th scope="col" class="col-todo">할 일</th></tr>'; // 할 일 칸은 휴대폰에서 감춤(D-10)

  // 할 일 버튼 (내 계약일 때만). 기획자 결정 2026-11-03(C-44): 지금 영업대표(임시 저장은 작성자)
  function todo(c) {
    if (!C.isSalesRep(c, me) && me.role !== 'SUPER') return '-';
    if (c.status === 'DRAFT') {
      return '<div class="row-actions"><a class="btn btn--secondary" href="new-contract.html?id=' + encodeURIComponent(c.draftKey) + '">이어서 작성</a>' +
        '<button type="button" class="btn btn--tertiary btn-reject" data-del="' + esc(c.draftKey) + '">지우기<span class="sr-only"> ' + esc(cpName(c)) + ' 임시 저장</span></button></div>'; // (2026-11-06 점검: 줄마다 같은 단추 이름이라 화면낭독기가 어느 것인지 알게 보이지 않는 글을 붙임. 보이는 글이 이름의 앞. 없애는 말은 "지우기"로 맞춤)
    }
    // 보완 요청을 받은 계약: 결재 문서에서 보완 완료 (REQ-REV-11, v0.26)
    if (c.status === 'SUPPLEMENT') {
      return '<div class="row-actions"><a class="btn btn--primary" href="review.html?id=' + encodeURIComponent(c.id) + '">보완하기</a></div>';
    }
    if (C.canResubmit(c)) { // 반려된 기안: 그 종류의 화면에서 같은 번호의 다음 차수로 (v0.58 기획자 결정)
      // 기획자 결정 2026-11-02 C-16: 거래처나 묶음에 보류가 걸려 있으면 단추 대신 짧은 한 줄(재기안 화면들도 막음). 까닭은 결재 문서와 계약 상세에
      if (C.holdOf(c)) return '<div class="row-actions"><span class="cell-meta">보류 중이라 기안할 수 없습니다.</span></div>';
      return '<div class="row-actions"><a class="btn btn--secondary" href="' + C.resubmitHref(c) + '">보완 후 재기안</a></div>';
    }
    const p = C.currentStep(c);
    if (p && p.step === 'S07') {
      return '<div class="row-actions"><a class="btn btn--primary" href="review.html?id=' + encodeURIComponent(c.id) + '">체결본 등록</a></div>';
    }
    return '-';
  }

  // 영업대표가 바뀐 계약의 작은 줄(기획자 결정 2026-11-03 C-44): 나에게 넘어온 계약은 "이어 맡음(처음 기안 ○○)",
  //   내가 기안했지만 넘어간 계약은 "영업대표 바뀜: ○○". 최고관리자, 관리자 보기는 영업대표 칸에서 봄
  function repLine(c) {
    if (seeAll || !c.id) return '';
    const rep = C.salesRepOf(c);
    if (rep === me.id && c.requesterId !== me.id) return '<span class="cell-meta">이어 맡음(처음 기안 ' + esc(C.ownerLabel(c.requesterId)) + ')</span>';
    if (rep !== me.id && c.requesterId === me.id) return '<span class="cell-meta">영업대표 바뀜: ' + esc(C.ownerLabel(rep)) + '</span>';
    return '';
  }
  let page = 1;
  function filtered() {
    const q = $('#f-q').value.trim().toLowerCase();
    const status = $('#f-status').value, kind = $('#f-kind').value;
    return all.filter(function (c) {
      if (q && (c.counterparty || '').toLowerCase().indexOf(q) < 0 /* 거래처 없이 임시 저장한 줄에서 멈추지 않게(2026-11-06 점검) */ && String(c.id || '').toLowerCase().indexOf(q) < 0) return false;
      if (status && c.status !== status) return false;
      if (kind && c.kind !== kind) return false;
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
    $('#list-count').innerHTML = C.meta([[(list.length !== all.length ? '검색 결과' : '전체'), '<strong>' + list.length + '건</strong>'],
      ['작성 중', count('DRAFT') + '건'], ['보완 중', count('SUPPLEMENT') + '건'], ['반려', count('REJECTED') + '건'], ['체결 대기', count('APPROVED') + '건']]);
    const cols = seeAll ? 8 : 7;
    $('#rows').innerHTML = rows.length ? rows.map(function (c) {
      // 작성 중은 계약 등록 화면으로, 그 밖에는 결재 문서로
      // 계약번호는 날짜처럼 한 줄로 (2512CL001-R01이 마지막 하이픈에서 끊기지 않게)
      const link = c.status === 'DRAFT'
        ? '<a class="cell-title" href="new-contract.html?id=' + encodeURIComponent(c.draftKey) + '">' + esc(cpName(c)) + '</a><span class="cell-meta">임시 저장</span>'
        : '<a class="cell-title" href="review.html?id=' + encodeURIComponent(c.id) + '">' + esc(c.counterparty) + '</a><span class="cell-meta"><span class="nowrap">' + esc(c.id) + '</span>' + (c.restricted ? ' ' + C.icon('lock', 'sm') : '') + '</span>' +
          repLine(c);
      // 기획자 결정 2026-11-02 D-10(C-43 ⑤): 휴대폰은 할 일 단추를 고객사 아래에 함께 둠(표를 끝까지 밀지 않아도 보이게)
      //   .cell-sub라 PC에서는 감춰지고, 휴대폰에서는 맨 끝 할 일 칸(col-todo)을 감춤(list.css 끝). 버튼이 없으면 줄도 두지 않음
      const acts = todo(c);
      return '<tr' + (c.status === 'REJECTED' ? ' class="is-alert"' : '') + '>' +
        '<td>' + link + (acts !== '-' ? '<div class="cell-sub cell-acts">' + acts + '</div>' : '') + '</td>' +
        '<td>' + esc(C.kindLabel(c)) + '</td>' +
        '<td class="nowrap">' + C.statusBadge(c) + '</td>' +
        C.progressCells(c) + // 현재 진행(단계) + 대기(날수) 두 칸 (v0.55)
        // 영업대표 칸은 지금 영업대표(2026-11-03 C-44). 사용 중지라 정하기 전이면 아래 "담당 지정 필요 (영업 리더가 맡음)"
        (seeAll ? '<td class="center">' + esc(C.ownerLabel(C.salesRepOf(c))) + (C.repNote(c) ? '<span class="cell-meta">' + esc(C.repNote(c)) + '</span>' : '') + '</td>' : '') +
        '<td class="num-left nowrap">' + C.fmtDate(dateOf(c)) + '</td>' + // 날짜가 "2026-10-" 뒤에서 끊기지 않게 한 줄로 (첫 사용 점검)
        '<td class="col-todo">' + acts + '</td>' + // 휴대폰에서는 감춤(D-10, 위 고객사 아래 버튼)
      '</tr>';
    }).join('') : '<tr><td class="empty-row" colspan="' + cols + '">' + (all.length ? '조건에 맞는 계약이 없습니다.' : '등록한 계약이 없습니다.') + '</td></tr>';
    $('#pagination').innerHTML = C.pagerHtml(page, pages, list.length, from, rows.length, PAGE_SIZE, '건');
  }

  /* ---------- 임시 저장 삭제 (REQ-FLOW-31): 확인 창, 경고(핑크) 버튼 ---------- */
  const modal = $('#del-modal');
  let target = null, lastFocus = null;
  $('#rows').addEventListener('click', function (e) {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    target = D.CONTRACTS.find(function (c) { return c.draftKey === b.getAttribute('data-del'); });
    $('#del-desc').textContent = (target ? cpName(target) + ' 계약의 ' : '') + '임시 저장 내용을 지웁니다. 기안 전이라 결재 기록은 없고, 지우면 되살릴 수 없습니다.';
    lastFocus = b;
    modal.hidden = false;
    C.focusModal(modal); // 제목에 포커스 (KRDS 모달, v0.28)
  });
  function closeModal() { modal.hidden = true; target = null; if (lastFocus) lastFocus.focus(); }
  modal.addEventListener('click', function (e) {
    if (e.target === modal || e.target.closest('[data-act="close"]')) closeModal();
    if (e.target.closest('[data-act="confirm"]') && target) {
      const name = cpName(target);
      C.deleteDraft(target);
      modal.hidden = true;
      collect();
      render();
      C.toast(name + ' 임시 저장을 지웠습니다.');
      C.restoreFocus(lastFocus); // 지운 줄의 단추는 없어져 화면 제목으로 초점을 옮김(2026-11-06 점검: 화면 맨 앞으로 떨어졌음)
    }
  });
  document.addEventListener('keydown', function (e) { if (!modal.hidden && e.key === 'Escape') closeModal(); });

  $('#filter').addEventListener('input', function () { page = 1; render(); });
  // 검색 칸은 'input'이 이미 그렸으므로 'change'(칸을 떠날 때)에서 다시 그리지 않음. 다시 그리면 누르던 줄이나 쪽 번호가 바뀌어 클릭이 사라짐(2026-11-06 점검 4회차)
  $('#filter').addEventListener('change', function (e) { if (e.target.matches('input[type=search], input[type=text]')) return; page = 1; render(); });
  $('#filter').addEventListener('reset', function () { setTimeout(function () { page = 1; render(); }, 0); });
  $('#filter').addEventListener('submit', function (e) { e.preventDefault(); });
  $('#pagination').addEventListener('click', function (e) {
    const b = e.target.closest('button[data-page]');
    if (!b || b.disabled) return;
    page = Number(b.getAttribute('data-page'));
    render();
    // 쪽 번호를 다시 그려 누른 단추가 없어지므로 초점을 목록 제목으로 옮기고 화면도 거기로(2026-11-06 점검 3회차)
    C.focusSection('#list-title');
  });
  render();
})();
