/* =====================================================================
 * SCR-92 공지 보기 화면 로직 (notice.js)
 * ---------------------------------------------------------------------
 * 관련: 요구사항 정의서 REQ-UI-29, v0.45 기획자 결정
 *   1. 글 한 편: 구분, 제목(중요 배지, 버전), 올린 날, 쓴 사람
 *   2. 공지는 문단, 릴리즈는 새 기능, 개선, 바뀐 규칙, 고친 문제(있는 묶음만)
 *   3. 이전 글, 다음 글(올린 순서, 제목 뒤에 올린 날을 흐리게. 기획자 결정 2026-11-02 D-21), 목록으로
 *   4. 관리자와 최고관리자: 고치기(notice-form.js), 내리기(확인 창)
 *   5. 바뀐 화면을 고른 릴리즈(기획자 결정 2026-11-02 E-15)는 글 정보 줄에 그 화면 이름과 "바뀐 점"이 보이는 끝 날
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
      $('#notice').innerHTML = C.noticeBox('', '글을 찾을 수 없습니다',
        '내렸거나 없는 글입니다. <a class="doc-link" href="notices.html">공지사항 목록</a>에서 다시 골라 주세요.');
      $('#post').hidden = true;
      return;
    }
    $('#post').hidden = false;
    $('#post-kind').textContent = D.NOTICE_KINDS[n.kind];
    // 내리기 확인 문구: 릴리즈만 이용 안내의 최근 릴리즈에도 나오므로 종류마다 (v0.63 검토)
    //   바뀐 화면을 고른 릴리즈는 그 화면의 "바뀐 점" 한 줄도 사라짐(E-15)
    $('#hide-desc').textContent = (n.kind !== 'RELEASE' ? '내리면 공지사항 목록에서 보이지 않습니다.'
      : C.changeUntil(n) ? '내리면 공지사항 목록, 이용 안내의 최근 릴리즈, 바뀐 화면의 "바뀐 점" 줄에서 보이지 않습니다.' : '내리면 공지사항 목록과 이용 안내의 최근 릴리즈에서 보이지 않습니다.') +
      ' 글은 지우지 않고 변경 이력에 남습니다.';
    $('#post-title').innerHTML = (n.important ? C.badge('danger', '중요') + ' ' : '') + (n.version ? '<span class="board-ver">' + esc(n.version) + '</span>' : '') + esc(n.title);
    // 기획자 결정 2026-11-02 E-15: 바뀐 화면을 고른 릴리즈는 어느 화면에 언제까지 "바뀐 점"이 보이는지 함께(지났으면 "끝남")
    const until = C.changeUntil(n);
    const change = until ? [['바뀐 점', esc(n.changeScreens.map(C.changeScreenLabel).join(', ')) + ' (' + C.fmtDate(until) + (D.TODAY <= until ? '까지 보임' : '에 끝남') + ')']] : [];
    $('#post-meta').innerHTML = C.meta([['올린 일시', C.fmtDateTime(n.at)], ['쓴 사람', esc(C.ownerLabel(n.by))]].concat(n.important ? ['전체 사용자에게 이메일로 알림'] : [], change));
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
    // 이전 글(더 최근), 다음 글(더 예전): 올린 순서. 1쪽 맨 위 고정(D-20)과 상관없이 날짜 순서를 따름
    // 기획자 결정 2026-11-02 D-21: 이름(이전 글, 다음 글)은 그대로 두고 제목 뒤에 올린 날을 흐리게 붙여 어느 쪽이 최근 글인지 알게 함
    const list = visible(), i = list.indexOf(n);
    const link = function (x) {
      return x ? '<a href="notice.html?id=' + encodeURIComponent(x.id) + '">' + (x.version ? esc(x.version) + ' ' : '') + esc(x.title) + '</a>' +
        '<span class="post-nav-date">' + C.fmtDate(x.at) + '</span>' : '없음';
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
    // 기획자 결정 2026-11-02 A-6: 공지는 사유를 따로 받지 않고 "공지 올림, 고침, 내림"을 사유로 남김
    C.adminSave('NOTICE', n.id + ' ' + n.title, '공지 내림', '공지 내림', { k: 'NOTICE_HIDE', id: n.id });
    C.flash('글을 내렸습니다.');
    location.href = 'notices.html';
  });
  render();
})();
