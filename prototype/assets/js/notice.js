/* =====================================================================
 * SCR-92 공지 보기 화면 로직 (notice.js)
 * ---------------------------------------------------------------------
 * 관련: 요구사항 정의서 REQ-UI-29, v0.45 기획자 결정
 *   1. 글 한 편: 구분, 제목(중요 배지, 버전), 올린 날, 쓴 사람
 *   2. 공지는 문단, 릴리즈는 새 기능, 개선, 바뀐 규칙, 고친 문제(있는 묶음만)
 *   3. 이전 글, 다음 글(목록 순서), 목록으로
 *   4. 관리자와 최고관리자: 고치기(notice-form.js), 내리기(확인 창)
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const PART_TONE = { added: 'success', improved: 'progress', changed: 'attention', fixed: 'neutral' };

  const id = new URLSearchParams(location.search).get('id');
  function num(n) { return Number(String(n.id).slice(2)) || 0; }
  function visible() { return D.NOTICES.filter(function (n) { return !n.hidden; }).sort(function (a, b) { return num(b) - num(a); }); }

  function render() {
    const n = D.NOTICES.filter(function (x) { return x.id === id && !x.hidden; })[0];
    if (!n) {
      $('#notice').innerHTML = '<div class="notice" role="status"><p class="notice-title">' + C.icon('alert') + '글을 찾을 수 없습니다</p>' +
        '<p>내렸거나 없는 글입니다. <a class="doc-link" href="notices.html">공지사항 목록</a>에서 다시 골라 주세요.</p></div>';
      $('#post').hidden = true;
      C.breadcrumb([['공지사항', 'notices.html'], ['글 보기']]);
      return;
    }
    C.breadcrumb([['공지사항', 'notices.html'], [n.kind === 'RELEASE' ? '릴리즈' : '공지']]);
    $('#post').hidden = false;
    $('#post-kind').textContent = D.NOTICE_KINDS[n.kind];
    $('#post-title').innerHTML = (n.important ? C.badge('danger', '중요') + ' ' : '') + (n.version ? '<span class="board-ver">' + esc(n.version) + '</span>' : '') + esc(n.title);
    $('#post-meta').innerHTML = C.meta(['올린 날 ' + C.fmtDateTime(n.at), '쓴 사람 ' + esc(C.userName(n.by)) + '님'].concat(n.important ? ['전체 사용자에게 이메일로 알림'] : []));
    if (n.kind === 'RELEASE') {
      $('#post-body').innerHTML = D.RELEASE_PARTS.filter(function (p) { return ((n.items || {})[p[0]] || []).length; }).map(function (p) {
        return '<section class="release-part"><h2>' + C.badge(PART_TONE[p[0]], p[1]) + '</h2><ul>' +
          n.items[p[0]].map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></section>';
      }).join('');
    } else {
      $('#post-body').innerHTML = (n.body || []).map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('');
    }
    $('#post-edited').hidden = !n.editedAt;
    $('#post-edited').textContent = n.editedAt ? C.fmtDateTime(n.editedAt) + '에 고쳤습니다.' : '';
    // 이전 글(더 최근), 다음 글(더 예전): 목록과 같은 순서
    const list = visible(), i = list.indexOf(n);
    const link = function (x) {
      return x ? '<a href="notice.html?id=' + encodeURIComponent(x.id) + '">' + (x.version ? esc(x.version) + ' ' : '') + esc(x.title) + '</a>' : '없음';
    };
    $('#post-nav').innerHTML = '<div><dt>이전 글</dt><dd>' + link(list[i - 1]) + '</dd></div><div><dt>다음 글</dt><dd>' + link(list[i + 1]) + '</dd></div>';
    const canWrite = window.NoticeForm.canWrite(me);
    $('#btn-edit').hidden = !canWrite;
    $('#btn-hide').hidden = !canWrite;
  }

  $('#btn-edit').addEventListener('click', function () {
    const n = D.NOTICES.filter(function (x) { return x.id === id; })[0];
    window.NoticeForm.open(n, function () { render(); C.toast('고쳤습니다.'); });
  });
  // 내리기: 되돌릴 수 없으니 확인 창(진한 Pink 버튼), 글은 지우지 않고 감춤
  const modal = $('#hide-modal');
  let last = null;
  function closeModal() { modal.hidden = true; if (last) last.focus(); }
  $('#btn-hide').addEventListener('click', function () { last = this; modal.hidden = false; C.focusModal(modal); });
  modal.addEventListener('click', function (e) { if (e.target.closest('[data-act="close"]') || e.target === modal) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) closeModal(); });
  $('#hide-ok').addEventListener('click', function () {
    const n = D.NOTICES.filter(function (x) { return x.id === id; })[0];
    C.adminSave('NOTICE', n.id + ' ' + n.title, '공지 내림', '-', { k: 'NOTICE_HIDE', id: n.id });
    C.flash('글을 내렸습니다.');
    location.href = 'notices.html';
  });
  render();
})();
