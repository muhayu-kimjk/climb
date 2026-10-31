/* =====================================================================
 * SCR-16 견적 목록 화면 로직 (quotes.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: 요구사항 정의서 3.9 REQ-QUO-01~09 (v0.61 기획자 결정: 견적서를 시스템에서 만들고 출력 기록을 남김)
 * 하는 일
 *   1. 볼 수 있는 견적만 모음(C.canSeeQuote): 영업은 내 것, 영업 리더는 내 유닛, 그 밖의 가격 기준을 보는 역할은 모두
 *   2. 검색(고객사, 견적번호, 영업기회번호)과 상태로 거르기. 최근 견적일 순서, 같은 견적번호는 높은 판이 먼저
 *      (v0.62, REQ-QUO-09, 표준 대응표 G-01 남은 것) "한도 넘은 견적만" 거르기, 합계 아래 "한도 넘음"(C.quoteOverCap)
 *   3. 한 쪽에 20건씩. 영업에게는 "새 견적" 단추
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const PAGE_SIZE = 20;

  if (!(me.role === 'SUPER' || C.hasRole(me, ['SALES', 'HEAD', 'EXEC', 'SALES_ADMIN', 'ADMIN']))) {
    $('#notice').innerHTML = C.noticeBox('', '견적은 영업, 영업지원, 관리자가 봅니다',
      '지금은 ' + esc(C.roleLabel(me.role)) + ' 역할로 보고 있습니다. 견적에는 가격 기준이 담겨 있어 볼 수 있는 사람을 정해 두었습니다.');
    $('#list').hidden = true;
    return;
  }
  const seeOthers = me.role !== 'SALES'; // 작성한 사람 칸을 보이는지
  if (me.role === 'HEAD') $('#intro').textContent = '내 유닛 영업이 만든 견적서입니다. 출력할 때마다 누가 언제 어떤 판을 냈는지 남습니다.';
  else if (me.role === 'SALES') $('#intro').textContent = '내가 만든 견적서입니다. 출력할 때마다 언제 어떤 판을 냈는지 남습니다.';
  if (me.role === 'SALES' || me.role === 'SUPER') { // 새 견적은 영업 담당자만(최고관리자는 시연)
    $('#page-actions').innerHTML = '<a class="btn btn--primary btn--md" href="quote.html">' + C.icon('plus', 'sm') + '새 견적</a>';
  }

  const all = C.allQuotes().filter(function (q) { return C.canSeeQuote(me, q); }).sort(function (a, b) {
    return a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.no !== b.no ? (a.no < b.no ? 1 : -1) : b.ver - a.ver;
  });
  const STATUS = [['', '전체'], ['DRAFT', '작성 중'], ['ISSUED', '출력함'], ['EXPIRED', '기간 지남'], ['SUPERSEDED', '새 판으로 바뀜']];
  $('#f-status').innerHTML = STATUS.map(function (s) { return '<option value="' + s[0] + '">' + s[1] + '</option>'; }).join('');
  $('#thead').innerHTML = '<tr><th scope="col">고객사</th><th scope="col" class="num">합계</th><th scope="col">상태</th>' +
    '<th scope="col">견적일</th><th scope="col">유효기간</th>' + (seeOthers ? '<th scope="col">작성</th>' : '') + '<th scope="col">출력</th></tr>';

  let page = 1;
  function filtered() {
    const q = $('#f-q').value.trim().toLowerCase(), status = $('#f-status').value, over = $('#f-over').checked;
    return all.filter(function (x) {
      const hay = (x.name + ' ' + x.no + ' ' + (x.opp || '') + ' ' + (x.unit || '')).toLowerCase();
      if (q && hay.indexOf(q) < 0) return false;
      if (status && C.quoteStatus(x).code !== status) return false;
      if (over && !C.quoteOverCap(x)) return false;
      return true;
    });
  }
  function render() {
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (page > pages) page = pages;
    const from = (page - 1) * PAGE_SIZE, rows = list.slice(from, from + PAGE_SIZE);
    const count = function (code) { return list.filter(function (x) { return C.quoteStatus(x).code === code; }).length; };
    $('#list-count').innerHTML = C.meta([[(list.length !== all.length ? '검색 결과' : '전체'), '<strong>' + list.length + '건</strong>'],
      ['작성 중', count('DRAFT') + '건'], ['출력함', count('ISSUED') + '건'], ['기간 지남', count('EXPIRED') + '건'],
      ['한도 넘음', list.filter(C.quoteOverCap).length + '건']]);
    const cols = seeOthers ? 7 : 6;
    $('#rows').innerHTML = rows.length ? rows.map(function (x) {
      const st = C.quoteStatus(x), t = C.quoteTotals(x);
      const href = 'quote.html?no=' + encodeURIComponent(x.no) + '&ver=' + x.ver;
      return '<tr>' +
        '<td><a class="cell-title" href="' + href + '">' + esc(x.name) + (x.unit ? ' ' + esc(x.unit) : '') + '</a>' +
          '<span class="cell-meta"><span class="nowrap">' + esc(x.no) + '</span> ' + x.ver + '판' + (x.opp ? ' <span class="nowrap">' + esc(x.opp) + '</span>' : '') + '</span></td>' +
        '<td class="num">' + C.fmtWon(t.total) + (C.quoteOverCap(x) ? '<span class="cell-meta">한도 넘음</span>' : '') + '</td>' +
        '<td class="nowrap">' + C.badge(st.tone, st.label) + '</td>' +
        '<td class="num-left">' + C.fmtDate(x.date) + '</td>' +
        '<td class="num-left">' + C.fmtDate(x.validUntil) + '</td>' +
        (seeOthers ? '<td class="center">' + esc(C.ownerLabel(x.owner)) + '</td>' : '') +
        '<td class="center">' + ((x.issues || []).length ? x.issues.length + '번' : '-') + '</td>' +
      '</tr>';
    }).join('') : '<tr><td class="empty-row" colspan="' + cols + '">' + (all.length ? '조건에 맞는 견적이 없습니다.' : '아직 만든 견적이 없습니다.') + '</td></tr>';
    $('#pagination').innerHTML = C.pagerHtml(page, pages, list.length, from, rows.length, PAGE_SIZE, '건');
  }
  $('#filter').addEventListener('input', function () { page = 1; render(); });
  $('#filter').addEventListener('change', function () { page = 1; render(); });
  $('#filter').addEventListener('reset', function () { setTimeout(function () { page = 1; render(); }, 0); });
  $('#filter').addEventListener('submit', function (e) { e.preventDefault(); });
  $('#pagination').addEventListener('click', function (e) {
    const b = e.target.closest('button[data-page]');
    if (!b) return;
    page = Number(b.getAttribute('data-page'));
    render();
  });
  render();
})();
