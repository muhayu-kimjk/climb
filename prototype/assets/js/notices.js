/* =====================================================================
 * SCR-91 공지사항 목록 화면 로직 (notices.js)
 * ---------------------------------------------------------------------
 * 관련: 요구사항 정의서 REQ-UI-29, v0.45 기획자 결정
 *   1. 공지와 릴리즈 노트를 최근에 올린 글부터. 내린 글은 감춤
 *   2. 구분(전체, 공지, 릴리즈 노트)과 검색(제목, 버전, 내용)으로 거름. 한 쪽에 10건
 *   3. 관리자와 최고관리자: 글쓰기(notice-form.js), 변경 이력
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const PAGE_SIZE = 10;
  let page = 1;
  const canWrite = window.NoticeForm.canWrite(me);
  $('#btn-write').hidden = !canWrite;
  $('#history-wrap').hidden = !canWrite;

  // 최근에 올린 글부터(글 번호 순. 시연의 "오늘"은 2026-10-19로 고정이라 날짜 대신 번호로 줄 세움)
  function num(n) { return Number(String(n.id).slice(2)) || 0; }
  function visible() { return D.NOTICES.filter(function (n) { return !n.hidden; }).sort(function (a, b) { return num(b) - num(a); }); }
  function text(n) {
    if (n.kind === 'RELEASE') return D.RELEASE_PARTS.map(function (p) { return ((n.items || {})[p[0]] || []).join(' '); }).join(' ');
    return (n.body || []).join(' ');
  }
  function kindBadge(n) { return n.kind === 'RELEASE' ? C.badge('success', '릴리즈 노트') : C.badge('line', '공지'); }
  function titleHtml(n) {
    return (n.important ? C.badge('danger', '중요') : '') + (n.version ? '<span class="board-ver">' + esc(n.version) + '</span>' : '') + esc(n.title);
  }

  function render() {
    const kind = $('#f-kind').value, q = $('#f-q').value.trim().toLowerCase();
    const all = visible();
    const list = all.filter(function (n) {
      if (kind && n.kind !== kind) return false;
      if (q && (n.title + ' ' + (n.version || '') + ' ' + text(n)).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (page > pages) page = pages;
    const from = (page - 1) * PAGE_SIZE, rows = list.slice(from, from + PAGE_SIZE);
    $('#list-count').innerHTML = C.meta(['<strong>' + (list.length !== all.length ? '검색 결과 ' : '전체 ') + list.length + '건</strong>',
      '공지 ' + list.filter(function (n) { return n.kind === 'NOTICE'; }).length + '건',
      '릴리즈 노트 ' + list.filter(function (n) { return n.kind === 'RELEASE'; }).length + '건']);
    $('#rows').innerHTML = rows.length ? rows.map(function (n) {
      return '<tr><td class="col-kind">' + kindBadge(n) + '</td>' +
        '<td><a class="board-title" href="notice.html?id=' + encodeURIComponent(n.id) + '">' + titleHtml(n) + '</a></td>' +
        '<td class="num-left nowrap">' + C.fmtDate(n.at) + '</td>' +
        '<td class="nowrap">' + esc(C.userName(n.by)) + '님</td></tr>';
    }).join('') : '<tr><td class="empty-row" colspan="4">조건에 맞는 글이 없습니다.</td></tr>';
    $('#pagination').innerHTML = C.pagerHtml(page, pages, list.length, from, rows.length, PAGE_SIZE, '건');
    if (canWrite) $('#history').innerHTML = C.adminHistoryHtml(C.adminLog(['NOTICE']), '공지사항 변경 이력');
  }

  $('#filter').addEventListener('input', function () { page = 1; render(); });
  $('#filter').addEventListener('change', function () { page = 1; render(); });
  $('#filter').addEventListener('reset', function () { setTimeout(function () { page = 1; render(); }, 0); });
  $('#filter').addEventListener('submit', function (e) { e.preventDefault(); });
  $('#pagination').addEventListener('click', function (e) {
    const b = e.target.closest('[data-page]');
    if (b && !b.disabled) { page = Number(b.getAttribute('data-page')); render(); $('#sec-list').scrollIntoView({ block: 'start' }); }
  });
  $('#btn-write').addEventListener('click', function () {
    window.NoticeForm.open(null, function (id, set) {
      render();
      C.toast(set.important ? '올렸습니다. 중요 공지라 전체 사용자에게 이메일로 알렸습니다(시안).' : '올렸습니다.');
    });
  });
  render();
})();
