/* =====================================================================
 * SCR-12 내 등록 목록 화면 로직 (my-contracts.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-FLOW-14, 17, 31, REQ-ARC-04
 * 하는 일
 *   1. 내가 등록한 계약을 모두 모음(작성 중 포함). 최근 것부터
 *      (최고관리자, 관리자는 모든 영업 것을 영업 대표 칸과 함께. 작성 중은 작성자만 보므로 빠짐)
 *   2. 검색, 상태, 구분으로 거르기. 한 쪽에 20건
 *   3. 할 일: 이어서 작성, 임시 저장 삭제(확인 창), 보완 후 재기안, ⑦ 체결본 등록
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const PAGE_SIZE = 20;

  const seeAll = me.role === 'SUPER' || me.role === 'ADMIN';
  if (!seeAll && me.role !== 'SALES') {
    $('#notice').innerHTML = '<div class="notice" role="status"><p class="notice-title">' + C.icon('alert') + '내 등록 목록은 영업이 씁니다</p>' +
      '<p>지금은 ' + esc(C.roleLabel(me.role)) + ' 역할로 보고 있습니다. 모든 계약은 보관함 > 전체 계약에서 볼 수 있습니다.</p></div>';
    $('#list').hidden = true;
    return;
  }
  if (seeAll) $('#intro').textContent = '모든 영업이 등록한 계약입니다(' + C.roleLabel(me.role) + ' 보기). 임시 저장한 계약은 작성자만 보므로 빠집니다.';

  const dateOf = function (c) { return c.requestedAt || c.savedAt || ''; };
  let all = [];
  function collect() {
    all = D.CONTRACTS.filter(function (c) {
      if (c.status === 'DRAFT') return c.requesterId === me.id;
      return seeAll || c.requesterId === me.id;
    }).sort(function (a, b) { return dateOf(b).localeCompare(dateOf(a)); });
  }
  collect();

  function options(first, pairs) {
    return '<option value="">' + esc(first) + '</option>' + pairs.map(function (p) { return '<option value="' + p[0] + '">' + esc(p[1]) + '</option>'; }).join('');
  }
  $('#f-status').innerHTML = options('전체 상태', Object.keys(D.STATUS).map(function (k) { return [k, D.STATUS[k].label]; }));
  $('#f-kind').innerHTML = options('전체 구분', Object.keys(D.KINDS).map(function (k) { return [k, D.KINDS[k]]; }));
  $('#thead').innerHTML = '<tr><th scope="col" class="col-customer">고객사</th><th scope="col">구분</th><th scope="col">상태</th><th scope="col">현재 진행</th>' +
    (seeAll ? '<th scope="col">영업 대표</th>' : '') + '<th scope="col">기안일</th><th scope="col">할 일</th></tr>';

  // 할 일 버튼 (내 계약일 때만)
  function todo(c) {
    if (c.requesterId !== me.id && me.role !== 'SUPER') return '-';
    if (c.status === 'DRAFT') {
      return '<div class="row-actions"><a class="btn btn--secondary" href="new-contract.html?id=' + encodeURIComponent(c.draftKey) + '">이어서 작성</a>' +
        '<button type="button" class="btn btn--tertiary btn-reject" data-del="' + esc(c.draftKey) + '">삭제</button></div>';
    }
    // 보완 요청을 받은 계약: 결재 문서에서 보완 완료 (REQ-REV-11, v0.26)
    if (c.status === 'SUPPLEMENT') {
      return '<div class="row-actions"><a class="btn btn--primary" href="review.html?id=' + encodeURIComponent(c.id) + '">보완하기</a></div>';
    }
    if (c.status === 'REJECTED' && c.kind !== 'TERMINATE' && c.renewMode !== 'AUTO' && c.kind !== 'CHANGE') {
      return '<div class="row-actions"><a class="btn btn--secondary" href="new-contract.html?id=' + encodeURIComponent(c.id) + '">보완 후 재기안</a></div>';
    }
    const p = C.currentStep(c);
    if (p && p.step === 'S07') {
      return '<div class="row-actions"><a class="btn btn--primary" href="review.html?id=' + encodeURIComponent(c.id) + '">체결본 등록</a></div>';
    }
    return '-';
  }

  let page = 1;
  function filtered() {
    const q = $('#f-q').value.trim().toLowerCase();
    const status = $('#f-status').value, kind = $('#f-kind').value;
    return all.filter(function (c) {
      if (q && c.counterparty.toLowerCase().indexOf(q) < 0 && String(c.id || '').toLowerCase().indexOf(q) < 0) return false;
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
    $('#list-count').innerHTML = C.meta(['<strong>' + (list.length !== all.length ? '검색 결과 ' : '전체 ') + list.length + '건</strong>',
      '작성 중 ' + count('DRAFT') + '건', '보완 중 ' + count('SUPPLEMENT') + '건', '반려 ' + count('REJECTED') + '건', '체결 대기 ' + count('APPROVED') + '건']);
    const cols = seeAll ? 7 : 6;
    $('#rows').innerHTML = rows.length ? rows.map(function (c) {
      // 작성 중은 계약 등록 화면으로, 그 밖에는 결재 문서로
      const link = c.status === 'DRAFT'
        ? '<a class="cell-title" href="new-contract.html?id=' + encodeURIComponent(c.draftKey) + '">' + esc(c.counterparty) + '</a><span class="cell-meta">임시 저장</span>'
        : '<a class="cell-title" href="review.html?id=' + encodeURIComponent(c.id) + '">' + esc(c.counterparty) + '</a><span class="cell-meta">' + esc(c.id) + (c.restricted ? ' ' + C.icon('lock', 'sm') : '') + '</span>';
      return '<tr' + (c.status === 'REJECTED' ? ' class="is-alert"' : '') + '>' +
        '<td>' + link + '</td>' +
        '<td class="nowrap">' + esc(C.kindLabel(c)) + '</td>' +
        '<td class="nowrap">' + C.statusBadge(c) + '</td>' +
        '<td>' + C.progressText(c) + '</td>' +
        (seeAll ? '<td class="nowrap">' + esc(C.userName(c.requesterId)) + '</td>' : '') +
        '<td class="nowrap num-left">' + C.fmtDate(dateOf(c)) + '</td>' +
        '<td class="nowrap">' + todo(c) + '</td>' +
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
    $('#del-desc').textContent = (target ? target.counterparty + ' 계약의 ' : '') + '임시 저장 내용을 지웁니다. 기안 전이라 결재 기록은 없고, 지우면 되살릴 수 없습니다.';
    lastFocus = b;
    modal.hidden = false;
    C.focusModal(modal); // 제목에 포커스 (KRDS 모달, v0.28)
  });
  function closeModal() { modal.hidden = true; target = null; if (lastFocus) lastFocus.focus(); }
  modal.addEventListener('click', function (e) {
    if (e.target === modal || e.target.closest('[data-act="close"]')) closeModal();
    if (e.target.closest('[data-act="confirm"]') && target) {
      const name = target.counterparty;
      C.deleteDraft(target);
      modal.hidden = true;
      collect();
      render();
      C.toast(name + ' 임시 저장을 지웠습니다.');
    }
  });
  document.addEventListener('keydown', function (e) { if (!modal.hidden && e.key === 'Escape') closeModal(); });

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
