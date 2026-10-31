/* =====================================================================
 * SCR-90 이용 안내 화면 로직 (help.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-FLOW-13(업무 흐름 5단계), REQ-UI-14(메뉴 줄 오른쪽 끝 이용 안내), REQ-UI-38(문서 형식, v0.61)
 * 하는 일
 *   1. 쪽 나누기(v0.61 기획자 요청: Claude 문서 사이트 형식): 한 번에 한 쪽(article.doc-page)만 보이고 주소 뒤 #쪽이름으로 엶.
 *      왼쪽 차례(묶음별 쪽 목록), 쪽 위의 위치 표시(이용 안내 › 묶음), 아래 이전과 다음, 오른쪽 "이 쪽에서"(소제목이 둘 이상일 때)
 *      쪽을 바꾸면 화면 맨 위로 가고 초점은 쪽 제목으로(화면낭독기가 바뀐 쪽을 읽음). 뒤로 가기와 앞으로 가기도 쪽을 따라감
 *   2. 이용 안내에서 찾기: 쪽 제목과 내용, 자주 묻는 것의 질문과 답에서 낱말을 찾아 목록으로 보임. 누르면 그 쪽(자주 묻는 것은 그 답을 펼침)
 *   3. 소개 쪽: 쪽 안내 카드, 최근 릴리즈 3건(공지사항 게시판)
 *   4. 역할별 할 일 표에서 지금 내 역할의 줄을 강조 (최고관리자는 강조 없음)
 *   5. 독촉 기준 일수를 결재선 규칙(SCR-52)의 지금 값으로 채움
 *   6. 자주 묻는 것: 펼침 화살표. 인쇄할 때는 모든 쪽이 나오고(CSS) 자주 묻는 것도 모두 펼쳐 매뉴얼 한 부로
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;

  const pages = [].slice.call(document.querySelectorAll('.doc-page'));
  const byId = {};
  const nameOf = function (p) { return p.id.replace(/^p-/, ''); }; // 쪽 요소 id는 p-쪽이름, 주소는 #쪽이름(브라우저가 그 자리로 뛰지 않게)
  pages.forEach(function (p) { byId[nameOf(p)] = p; });
  const navEl = document.getElementById('doc-nav'), tocEl = document.getElementById('doc-toc'), pagerEl = document.getElementById('doc-pager');

  // 쪽 설명(차례 카드와 찾기에 씀). 쪽이 늘면 여기와 help.html에 함께 더함
  const BLURB = {
    intro: '이 시스템이 하는 일과 안내의 구성, 새 소식',
    flow: '계약 등록부터 계약 완료까지 5단계와 화면',
    quote: '제품과 가격 기준으로 견적서를 만들고 출력, 새 판',
    steps: '①~⑪ 단계마다 담당과 거치는 조건',
    change: '변경, 운영 변경, 연장, 자동갱신, 해지',
    roles: '분야와 등급마다 할 일과 주로 쓰는 화면',
    faq: '반려, 보완, 대리 지정, 열람 제한 등',
    security: '로그인, 접속 위치, 인쇄, 개인정보, 기록',
  };

  // ---------- 1. 왼쪽 차례 ----------
  const groups = [];
  pages.forEach(function (p) {
    const g = p.getAttribute('data-group');
    let grp = groups.filter(function (x) { return x.name === g; })[0];
    if (!grp) { grp = { name: g, pages: [] }; groups.push(grp); }
    grp.pages.push(p);
  });
  navEl.innerHTML =
    // 좁은 화면(1360px 미만)과 휴대폰: 차례는 내용 위의 접힌 줄. 누르면 펼침(넓은 화면에서는 이 단추가 보이지 않고 차례가 늘 펼쳐짐)
    '<button type="button" class="doc-nav-toggle" aria-expanded="false" aria-controls="doc-nav-body">' +
      '<span class="doc-nav-toggle-label">이용 안내 차례</span><span class="doc-nav-now"></span>' + C.icon('chevronDown') +
    '</button>' +
    '<div class="doc-nav-body" id="doc-nav-body">' +
      '<div class="doc-search" role="search">' +
        '<label class="sr-only" for="doc-q">이용 안내에서 찾기</label>' +
        '<div class="doc-search-box">' + C.icon('search') +
          '<input class="doc-search-input" id="doc-q" type="search" autocomplete="off" placeholder="이용 안내에서 찾기" aria-describedby="doc-q-help"></div>' +
        '<p class="sr-only" id="doc-q-help">낱말을 넣으면 아래에 찾은 쪽과 질문이 나옵니다.</p>' +
        '<ul class="doc-search-list" id="doc-search-list" hidden></ul>' +
        '<p class="sr-only" aria-live="polite" id="doc-search-live"></p>' +
      '</div>' +
      groups.map(function (g) {
        return '<p class="doc-nav-group">' + esc(g.name) + '</p><ul class="doc-nav-list">' +
          g.pages.map(function (p) { return '<li><a class="doc-nav-link" href="#' + nameOf(p) + '" data-page="' + nameOf(p) + '">' + esc(p.getAttribute('data-title')) + '</a></li>'; }).join('') +
          '</ul>';
      }).join('') +
      // 새 소식은 공지사항 게시판(릴리즈 글)으로
      '<p class="doc-nav-group">새 소식</p><ul class="doc-nav-list"><li><a class="doc-nav-link" href="notices.html">공지사항과 릴리즈</a></li></ul>' +
    '</div>';
  const toggle = navEl.querySelector('.doc-nav-toggle'), navBody = navEl.querySelector('.doc-nav-body');
  toggle.addEventListener('click', function () {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    navEl.classList.toggle('is-open', open);
  });

  // ---------- 쪽 바꾸기 ----------
  function parseHash() {
    const h = decodeURIComponent((location.hash || '').slice(1));
    const id = h.split('--')[0];
    return { page: byId[id] ? id : 'intro', section: h.indexOf('--') > 0 && document.getElementById(h) ? h : '' };
  }
  let current = '';
  function show(target, moveFocus) {
    const page = byId[target.page];
    pages.forEach(function (p) { p.hidden = p !== page; });
    navEl.querySelectorAll('.doc-nav-link[data-page]').forEach(function (a) {
      if (a.getAttribute('data-page') === target.page) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    navEl.querySelector('.doc-nav-now').textContent = page.getAttribute('data-title');
    // 위치 표시: 이용 안내 › 묶음 (쪽 제목 위)
    if (!page.querySelector('.doc-crumb')) {
      page.insertAdjacentHTML('afterbegin', '<p class="doc-crumb"><span>이용 안내</span><span class="doc-crumb-sep" aria-hidden="true">›</span><span>' + esc(page.getAttribute('data-group')) + '</span></p>');
    }
    renderToc(page);
    renderPager(page);
    if (target.page !== current) {
      // 좁은 화면에서 펼쳐 둔 차례는 쪽을 고르면 접음
      toggle.setAttribute('aria-expanded', 'false');
      navEl.classList.remove('is-open');
    }
    const changed = target.page !== current;
    current = target.page;
    if (target.section) {
      document.getElementById(target.section).scrollIntoView({ block: 'start' });
    } else if (changed && moveFocus) {
      window.scrollTo(0, 0);
    }
    if (moveFocus) {
      const h = target.section ? document.getElementById(target.section) : page.querySelector('.page-title');
      if (h && !h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
      if (h) h.focus({ preventScroll: true });
    }
  }
  window.addEventListener('hashchange', function () { show(parseHash(), true); });

  // ---------- 오른쪽 "이 쪽에서" ----------
  function renderToc(page) {
    const hs = [].slice.call(page.querySelectorAll('.doc-h2'));
    tocEl.hidden = hs.length < 2;
    tocEl.innerHTML = hs.length < 2 ? '' :
      '<div class="doc-toc-inner"><p class="doc-toc-title">이 쪽에서</p><ul>' +
      hs.map(function (h) { return '<li><a href="#' + h.id + '">' + esc(h.textContent) + '</a></li>'; }).join('') + '</ul></div>';
  }

  // ---------- 이전과 다음 ----------
  function renderPager(page) {
    const i = pages.indexOf(page), prev = pages[i - 1], next = pages[i + 1];
    const card = function (p, dir) {
      return '<a class="doc-pager-link is-' + dir + '" href="#' + nameOf(p) + '">' +
        '<span class="doc-pager-dir">' + (dir === 'prev' ? '이전' : '다음') + '</span>' +
        '<span class="doc-pager-title">' + esc(p.getAttribute('data-title')) + '</span></a>';
    };
    pagerEl.innerHTML = (prev ? card(prev, 'prev') : '<span></span>') + (next ? card(next, 'next') : '<span></span>');
  }

  // ---------- 2. 이용 안내에서 찾기 ----------
  const norm = function (s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); };
  const index = [];
  pages.forEach(function (p) {
    index.push({ page: nameOf(p), label: p.getAttribute('data-title'), path: p.getAttribute('data-group'), text: norm(p.textContent) });
  });
  document.querySelectorAll('.faq').forEach(function (d) {
    index.push({ page: 'faq', faq: d.id, label: d.querySelector('summary').textContent.trim(), path: '자주 묻는 것', text: norm(d.textContent) });
  });
  const qIn = document.getElementById('doc-q'), qList = document.getElementById('doc-search-list'), qLive = document.getElementById('doc-search-live');
  function searchRender() {
    const q = norm(qIn.value);
    if (!q) { qList.hidden = true; qList.innerHTML = ''; qLive.textContent = ''; return; }
    // 쪽 제목이나 질문에 든 것을 먼저, 내용에만 든 것은 그 뒤. 최대 8개
    const hits = index.filter(function (x) { return x.text.indexOf(q) >= 0; })
      .sort(function (a, b) { return (norm(b.label).indexOf(q) >= 0) - (norm(a.label).indexOf(q) >= 0); }).slice(0, 8);
    qList.hidden = false;
    qList.innerHTML = hits.length ? hits.map(function (x) {
      return '<li><a class="doc-search-item" href="#' + x.page + '"' + (x.faq ? ' data-faq="' + x.faq + '"' : '') + '>' +
        '<span class="doc-search-label">' + esc(x.label) + '</span><span class="doc-search-path">' + esc(x.path) + '</span></a></li>';
    }).join('') : '<li class="doc-search-empty">찾는 내용이 없습니다. 다른 낱말로 찾아보세요.</li>';
    qLive.textContent = hits.length ? hits.length + '개를 찾았습니다.' : '찾는 내용이 없습니다.';
  }
  qIn.addEventListener('input', searchRender);
  qIn.addEventListener('keydown', function (e) {
    const first = qList.querySelector('a');
    if (e.key === 'ArrowDown' && first) { e.preventDefault(); first.focus(); }
    if (e.key === 'Enter' && first) { e.preventDefault(); first.click(); }
    if (e.key === 'Escape' && qIn.value) { e.stopPropagation(); qIn.value = ''; searchRender(); }
  });
  qList.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const links = [].slice.call(qList.querySelectorAll('a')), i = links.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    if (e.key === 'ArrowDown' && links[i + 1]) links[i + 1].focus();
    if (e.key === 'ArrowUp') (links[i - 1] || qIn).focus();
  });
  qList.addEventListener('click', function (e) {
    const a = e.target.closest('a[data-faq]');
    if (!a) return;
    // 자주 묻는 것은 그 답을 펼치고 그 질문으로
    e.preventDefault();
    const d = document.getElementById(a.getAttribute('data-faq'));
    d.open = true;
    if (location.hash !== '#faq') history.pushState(null, '', '#faq');
    show({ page: 'faq', section: '' }, false);
    d.scrollIntoView({ block: 'start' });
    d.querySelector('summary').focus({ preventScroll: true });
  });

  // ---------- 3. 소개 쪽: 쪽 안내 카드, 최근 릴리즈 ----------
  document.getElementById('doc-cards').innerHTML = pages.filter(function (p) { return nameOf(p) !== 'intro'; }).map(function (p) {
    return '<a class="doc-card" href="#' + nameOf(p) + '"><span class="doc-card-group">' + esc(p.getAttribute('data-group')) + '</span>' +
      '<span class="doc-card-title">' + esc(p.getAttribute('data-title')) + '</span>' +
      '<span class="doc-card-text">' + esc(BLURB[nameOf(p)] || '') + '</span></a>';
  }).join('');
  const releases = (D.NOTICES || []).filter(function (n) { return n.kind === 'RELEASE'; })
    .sort(function (a, b) { return a.at < b.at ? 1 : -1; }).slice(0, 3);
  document.getElementById('doc-news').innerHTML = releases.map(function (n) {
    return '<li><a href="notice.html?id=' + encodeURIComponent(n.id) + '"><span class="doc-news-ver">' + esc(n.version || '') + '</span>' +
      '<span class="doc-news-title">' + esc(n.title) + '</span><span class="doc-news-date">' + esc(String(n.at).slice(0, 10)) + '</span></a></li>';
  }).join('') + '<li class="doc-news-more"><a href="notices.html">공지사항에서 모두 보기</a></li>';

  // ---------- 4. 내 역할 강조 ----------
  const row = document.querySelector('tr[data-role="' + me.role + '"]');
  if (row && me.role !== 'SUPER') {
    row.classList.add('is-me');
    // 등급 칸에 표시 (분야 칸은 여러 줄이 함께 씀, v0.29)
    (row.querySelector('.role-name') || row.querySelector('td')).insertAdjacentHTML('beforeend', '<span class="cell-meta">내 역할</span>');
  }

  // ---------- 5. 독촉 기준 일수 ----------
  document.querySelectorAll('[data-rule]').forEach(function (el) { el.textContent = D.ALERT_RULES[el.getAttribute('data-rule')]; });

  // ---------- 6. 자주 묻는 것: 화살표 아이콘, 인쇄 때 모두 펼치고 끝나면 원래대로 ----------
  document.querySelectorAll('.faq-icon').forEach(function (el) { el.outerHTML = C.icon('chevronDown'); });
  let opened = [];
  window.addEventListener('beforeprint', function () {
    opened = Array.prototype.filter.call(document.querySelectorAll('.faq'), function (d) { return !d.open; });
    opened.forEach(function (d) { d.open = true; });
  });
  window.addEventListener('afterprint', function () { opened.forEach(function (d) { d.open = false; }); opened = []; });

  show(parseHash(), false);
})();
