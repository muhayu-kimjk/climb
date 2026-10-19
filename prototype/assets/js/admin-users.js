/* =====================================================================
 * SCR-51 사용자 권한 관리 화면 로직 (admin-users.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-AUTH-02(관리자가 역할 지정), REQ-AUTH-05(여러 역할), REQ-AUTH-13(접속 기록), REQ-ADM-01~06
 * 하는 일
 *   1. 관리자와 슈퍼관리자만 볼 수 있게 막기
 *   2. 검색(이름, 이메일), 권한, 부서, 상태로 거르기
 *   3. 쪽 나누기: 한 쪽에 PAGE_SIZE(20)명. 화면이 A4 2장(약 2,245px)을 넘지 않게 정한 값
 * 프로토타입: 계정 데이터는 mock-data.js의 ACCOUNTS(가상 인물). 실제 시스템은 서버에서 거르고 쪽을 나눠 받아옵니다.
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };

  /* 한 쪽에 보이는 사람 수 (REQ-ADM-04)
   * 화면의 A4 종이 틀(폭 210mm) 전체 높이가 A4 2장(297mm x 2, 약 2,245px)을 넘지 않는 수.
   * 표 한 줄은 약 49px이고, 헤더, 메뉴, 제목, 거르기, 표 머리, 쪽 번호, 푸터가 약 1,170px를 차지합니다.
   * 25명이면 약 2,400px로 2장을 넘고, 20명이면 약 2,150px로 2장 안에 들어갑니다. 인쇄하면 A4 한 장입니다. */
  const PAGE_SIZE = 20;

  /* ---------- 1. 관리자와 슈퍼관리자만 (REQ-AUTH-02) ---------- */
  if (me.role !== 'ADMIN' && me.role !== 'SUPER') {
    $('#notice').innerHTML =
      '<div class="notice" role="status"><p class="notice-title">' + C.icon('alert') + '사용자 권한 관리는 관리자만 볼 수 있습니다</p>' +
      '<p>지금은 ' + esc(C.roleLabel(me.role)) + ' 역할로 보고 있습니다. 화면 맨 위 검은 띠에서 관리자나 슈퍼관리자로 바꾸면 볼 수 있습니다.</p></div>';
    $('#users').hidden = true;
    return;
  }

  /* ---------- 거르기 선택지 ---------- */
  const all = D.ACCOUNTS;
  const depts = all.map(function (a) { return a.dept; }).filter(function (d, i, arr) { return arr.indexOf(d) === i; });
  function options(first, pairs) {
    return '<option value="">' + esc(first) + '</option>' + pairs.map(function (p) {
      return '<option value="' + esc(p[0]) + '">' + esc(p[1]) + '</option>';
    }).join('');
  }
  $('#f-role').innerHTML = options('전체 권한', Object.keys(D.ROLES).map(function (r) { return [r, D.ROLES[r]]; }));
  $('#f-dept').innerHTML = options('전체 부서', depts.map(function (d) { return [d, d]; }));
  $('#f-status').innerHTML = options('전체 상태', Object.keys(D.ACCOUNT_STATUS).map(function (s) { return [s, D.ACCOUNT_STATUS[s].label]; }));

  /* ---------- 표시 도우미 ---------- */
  // "2026-10-19 14:05" → "2026.10.19 14:05", 없으면 "-"
  function dt(s) { return s ? s.replace(/-/g, '.') : '-'; }
  function roleBadges(roles) {
    return '<span class="role-badges">' + roles.map(function (r) {
      // 슈퍼관리자와 관리자는 진한 배지로 눈에 띄게 [가정]
      return C.badge(r === 'SUPER' || r === 'ADMIN' ? 'attention' : 'line', C.roleLabel(r));
    }).join('') + '</span>';
  }
  function statusBadge(s) {
    const st = D.ACCOUNT_STATUS[s];
    return C.badge(st.tone, st.label);
  }

  /* ---------- 2. 거르기 ---------- */
  let page = 1;
  function filtered() {
    const q = $('#f-q').value.trim().toLowerCase();
    const role = $('#f-role').value, dept = $('#f-dept').value, status = $('#f-status').value;
    return all.filter(function (a) {
      if (q && a.name.toLowerCase().indexOf(q) < 0 && a.email.toLowerCase().indexOf(q) < 0) return false;
      if (role && a.roles.indexOf(role) < 0) return false;
      if (dept && a.dept !== dept) return false;
      if (status && a.status !== status) return false;
      return true;
    });
  }

  /* ---------- 표와 쪽 번호 그리기 ---------- */
  function render() {
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (page > pages) page = pages;
    const from = (page - 1) * PAGE_SIZE;
    const rows = list.slice(from, from + PAGE_SIZE);

    // 건수 요약: 전체 n명 | 사용 중 n명 | 첫 접속 전 n명 | 사용 중지 n명 (거른 결과 기준)
    const counts = Object.keys(D.ACCOUNT_STATUS).map(function (s) {
      return esc(D.ACCOUNT_STATUS[s].label) + ' ' + list.filter(function (a) { return a.status === s; }).length + '명';
    });
    const isFiltered = list.length !== all.length;
    $('#list-count').innerHTML = C.meta(['<strong>' + (isFiltered ? '검색 결과 ' : '전체 ') + list.length + '명</strong>'].concat(counts));

    $('#user-rows').innerHTML = rows.length ? rows.map(function (a) {
      return '<tr' + (a.status === 'SUSPENDED' ? ' class="is-muted"' : '') + '>' +
        '<td class="col-email">' + esc(a.email) + '</td>' +
        '<td class="cell-name">' + esc(a.name) + '</td>' +
        '<td>' + esc(a.dept) + '</td>' +
        '<td>' + roleBadges(a.roles) + '</td>' +
        '<td>' + statusBadge(a.status) + '</td>' +
        '<td class="num-left">' + C.fmtDate(a.registeredAt) + '</td>' +
        '<td class="num-left">' + dt(a.firstLoginAt) + '</td>' +
        '<td class="num-left">' + dt(a.lastLoginAt) + '</td>' +
        '<td class="num-left">' + dt(a.lastLogoutAt) + '</td>' +
        '<td class="num-left">' + C.fmtDate(a.roleChangedAt) + '</td>' +
        '<td class="col-action"><a class="link-edit" ' + C.todoAttrs('사용자 권한 수정') + ' aria-label="' + esc(a.name) + '님 권한 수정">수정</a></td>' +
      '</tr>';
    }).join('') : '<tr><td class="empty-row" colspan="11">조건에 맞는 사용자가 없습니다.</td></tr>';

    renderPagination(pages, list.length, from, rows.length);
  }

  // KRDS 페이지네이션: 이전, 쪽 번호, 다음. 지금 쪽은 aria-current="page"
  function renderPagination(pages, total, from, shown) {
    const nav = $('#pagination');
    const btn = function (label, target, opts) {
      opts = opts || {};
      return '<button type="button" class="page-btn' + (opts.cls || '') + '" data-page="' + target + '"' +
        (opts.disabled ? ' disabled' : '') + (opts.current ? ' aria-current="page"' : '') +
        (opts.aria ? ' aria-label="' + opts.aria + '"' : '') + '>' + label + '</button>';
    };
    let html = btn(C.icon('chevronLeft', 'sm') + '<span>이전</span>', page - 1, { cls: ' page-prev', disabled: page === 1, aria: '이전 쪽' });
    for (let i = 1; i <= pages; i++) {
      html += btn(String(i), i, { cls: i === page ? ' is-current' : '', current: i === page, aria: i + '쪽' });
    }
    html += btn('<span>다음</span>' + C.icon('chevronRight', 'sm'), page + 1, { cls: ' page-next', disabled: page === pages, aria: '다음 쪽' });
    // 몇 번째 사람을 보고 있는지 (인쇄물에도 남김)
    const range = total ? (from + 1) + '~' + (from + shown) + '번째 사람' : '해당 없음';
    nav.innerHTML = '<div class="page-btns">' + html + '</div>' +
      '<p class="page-range">' + pages + '쪽 중 ' + page + '쪽, ' + range + ' (한 쪽에 ' + PAGE_SIZE + '명)</p>';
  }

  /* ---------- 이벤트 ---------- */
  $('#filter').addEventListener('input', function () { page = 1; render(); });
  $('#filter').addEventListener('change', function () { page = 1; render(); });
  $('#filter').addEventListener('reset', function () { setTimeout(function () { page = 1; render(); }, 0); });
  $('#filter').addEventListener('submit', function (e) { e.preventDefault(); });
  $('#pagination').addEventListener('click', function (e) {
    const b = e.target.closest('button[data-page]');
    if (!b || b.disabled) return;
    page = Number(b.getAttribute('data-page'));
    render();
    // 쪽을 바꾸면 목록 맨 위로
    $('#users').scrollIntoView({ block: 'start' });
  });

  render();
})();
