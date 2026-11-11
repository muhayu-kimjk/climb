/* =====================================================================
 * SCR-15 새 견적과 견적 고치기 / SCR-17 견적서 보기 (quote.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: 요구사항 정의서 3.9 REQ-QUO-01~08 (v0.61 기획자 결정)
 *   목적: 그동안 엑셀로 각자 만들던 견적서를 시스템의 제품과 가격 기준 그대로 만들고, 출력할 때마다 기록을 남김.
 *   견적은 계약과 이어지지 않고, 견적 단계 할인 승인도 없음(할인율 한도를 넘는 줄은 알려만 줌)
 * 하는 일
 *   1. 주소로 고치기와 보기를 가름: 출력하지 않은 내 견적은 고치기(SCR-15), 그 밖에는 보기(SCR-17, 메뉴는 견적 목록)
 *   2. 받는 곳: 거래처 찾기(C.searchBusinesses, KRDS 콤보 상자)로 상호를 채움. 없으면 상호를 직접 적음. 사업자등록번호 칸은 없음(2026-11-06 기획자 요청)
 *   3. 제품 줄: 서비스 → 제품 → 기능(가격 기준이 있고 지금 파는 것만), 수량, 단가(오늘의 표준 단가로 채우고 고칠 수 있음), 할인율, 금액
 *      공급가액, 부가세(10%, 원 단위 버림), 합계. 할인율 한도를 넘는 줄은 칸 아래에 알림(계약할 때 ③ 영업 검토)
 *   4. 저장(작성 중) → 견적서 보기. 출력은 보기의 "견적서 출력"(검사 → 출력 기록 → 견적서만 A4로 출력)
 *      2026-11-06 기획자 요청: 고치기 화면의 "저장하고 견적서 출력"을 없애고 저장만. Enter로는 저장도 출력도 하지 않음
 *   5. 보기: 견적서(고객에게 내는 모양), 출력 기록, 이 견적의 판. 작성한 영업은 "새 판 만들기"(출력한 판은 고칠 수 없음)
 *   6. 출력은 단추로만 기록이 남는 고객용 견적서가 나옴. 브라우저 인쇄는 다른 화면처럼 워터마크가 있는 사내 인쇄
 *   출력 기록 지키기(v0.61 검토): 저장과 출력과 새 판은 늘 저장된 기록을 다시 읽고 함. 출력한 판은 내용을 바꾸지 못하고 기록은 덧붙이기만
 *     (예전 탭이나 뒤로 가기로 남은 화면에서 눌러도 출력 기록이 지워지거나 판이 풀리지 않게. C.saveQuote도 같은 규칙)
 *   기획자 결정 2026-11-02
 *     E-7(추천과 다름) 덧붙임 ①: "견적서 출력"으로 내는 고객용 견적서에는 회사 인장 그림을 늘 찍음(공급자 칸 대표자 옆 "(인)" 자리)
 *       인장 그림은 회사 설정(SCR-59, D.COMPANY.seal, 총무가 올림). 없으면 인장 없이 출력하고 출력한 사람에게 알림(출력은 막지 않음)
 *       화면과 브라우저 인쇄(사내 인쇄)에는 찍지 않음: 인장 그림은 "견적서 출력"으로 인쇄하는 동안에만 견적서에 넣고 끝나면 뺌
 *     E-7 ③: 출력 기록에 sealed(인장 찍음), sealVer(찍은 그림의 판)를 남김. 총무가 매월 인장 대장과 맞춰 봄(인장 기록 대조 SCR-63)
 *     E-7 ④: 견적서 외부 전자서명은 하지 않음으로 닫음(만들지 않음)
 *     E-8: 고객용 견적서는 사내 워터마크(REQ-SEC-07)의 예외 그대로. 출력 기록을 먼저 남긴 뒤에만 견적서가 나옴(아래 issue)
 *     E-9: 공급자 칸의 사업자등록번호, 대표자, 주소, 대표 연락처는 회사 설정 값(D.COMPANY). 예전 "회사 설정 값" 자리를 바꿈
 *     E-4: 새 줄과 새 판은 오늘의 할인율 한도(남은 시연 한도도 0%)로 채움. 이미 저장한 줄의 한도는 그대로
 * 프로토타입: 저장과 출력 기록은 이 브라우저에만(시연 기록). 실제 시스템은 서버에 저장하고, 단가와 합계도 서버에서 다시 계산하며
 *   출력 기록을 먼저 남긴 뒤에만 고객용 PDF를 만들어 줌
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const esc = C.esc;
  const $ = function (s, root) { return (root || document).querySelector(s); };
  const $$ = function (s, root) { return [].slice.call((root || document).querySelectorAll(s)); };

  // 뒤로 가기로 돌아온 화면(브라우저가 기억해 둔 화면)은 다시 읽음: 그사이 다른 화면에서 출력하거나 새 판을 만들었을 수 있음
  window.addEventListener('pageshow', function (e) { if (e.persisted) location.reload(); });

  // 주소: ?no=견적번호&ver=판
  const params = new URLSearchParams(location.search);
  const found = params.get('no') ? C.findQuote(params.get('no'), params.get('ver')) : null;
  // &view=1: 저장한 뒤 가는 견적서 보기(2026-11-06 기획자 요청: 저장만 하고, 출력은 보기 화면의 "견적서 출력"으로).
  //   고칠 수 있는 내 견적도 이 주소면 보기로 열고, 보기의 "고치기"로 다시 고침
  const viewNow = !!found && params.get('view') === '1';
  // 머리글(지금 화면의 메뉴 표시)을 그리기 전에 고치기인지 보기인지 정함: 보기면 메뉴는 견적 목록(SCR-17 → SCR-16)
  if (found && (viewNow || !C.canEditQuote(C.currentUser(), found))) document.body.setAttribute('data-page', 'SCR-17');
  const me = C.init();

  const PRICE = {};
  D.PRICE_BOOK.forEach(function (p) { PRICE[p.feature] = p; });
  const pct = function (r) { return Math.round(r * 1000) / 10 + '%'; };
  const featureOf = function (id) { return D.FEATURES.filter(function (f) { return f.id === id; })[0] || null; };
  const productOf = function (id) { return D.PRODUCTS.filter(function (p) { return p.id === id; })[0] || null; };
  const sold = function (fid) { const f = featureOf(fid), p = f && productOf(f.product); return !!f && f.use && !!p && p.use && !!PRICE[fid]; };
  //   지금 파는 기능: 가격 기준이 있고 기능과 제품이 모두 사용 중(제품 확인은 계약 등록 livePrices와 같게, REQ-QUO-04, 06. v0.63 통제 목록 CTL-05 점검)
  const overCap = C.quoteLineOverCap; // 할인율 한도를 넘는 줄(견적 목록, 통계와 같은 규칙, v0.62에 common.js로 옮김)
  // 2026-11-09 5회차 점검: 한도를 영업 임원 승인 기준(C.cooOverPp, 지금 값 %p)보다 더 넘는 줄. 이 가격으로 계약하면 ③ 영업 임원 승인도 받음(E-3)
  //   계약 등록의 셈(common.js capOver, cooRoute)과 같게 %p를 소수 둘째 자리로 반올림해 기준보다 큰지 봄. 기준 값은 하드코딩하지 않음
  const cooOver = function (l) {
    return overCap(l) && Math.round((1 - (Number(l.unitPrice) || 0) / l.listPrice - l.cap) * 10000) / 100 > C.cooOverPp();
  };
  const cooText = function () { return '한 줄이라도 한도를 ' + C.cooOverPp() + '%p보다 더 넘으면 영업 임원도 승인합니다'; };

  /* ---------- 출력할 수 있는 견적인지(받는 곳, 제품 줄, 날짜). 고치기 화면의 검사와 보기 화면의 출력 단추가 함께 씀 ---------- */
  function problems(q) {
    const out = [];
    if (!q.name) out.push(['name', '고객사 상호를 넣으세요.']);
    if (q.opp && !C.isOppNo(q.opp)) out.push(['opp', '영업기회번호는 연도 2자리, 월 2자리, 영문 2자리, 일련번호 3자리입니다. 예: 2610CK012']);
    if (!q.date) out.push(['date', '견적일을 고르세요.']); // 날짜 칸은 "고르세요"(2026-11-06 점검, 다른 화면과 같게)
    if (!q.validUntil) out.push(['validUntil', '유효기간을 고르세요.']);
    else if (q.date && q.validUntil < q.date) out.push(['validUntil', '유효기간은 견적일보다 앞설 수 없습니다.']);
    else if (q.validUntil < D.TODAY) out.push(['validUntil', '유효기간이 이미 지났습니다. 오늘 이후로 고치세요.']);
    const lines = q.lines || [];
    if (!lines.length) out.push(['lines', '제품을 한 줄 이상 넣으세요.']);
    else if (lines.some(function (l) { return l.bad; })) out.push(['lines', '수량과 단가는 숫자로만 넣습니다(쉼표는 괜찮음).']);
    else if (!lines.every(function (l) { return l.feature && Number.isInteger(l.qty) && l.qty > 0 && Number.isInteger(l.unitPrice) && l.unitPrice >= 0; })) out.push(['lines', '모든 줄에 기능과 수량(1 이상), 단가를 넣거나 빈 줄을 지우세요.']);
    else if (!lines.every(function (l) { return sold(l.feature); })) out.push(['lines', '지금 팔지 않는 기능이 든 줄이 있습니다. 그 줄의 제품이나 기능을 다시 고르거나 지우세요.']);
    return out;
  }

  /* ---------- 1. 들어올 수 있는지, 고치기인지 보기인지 ---------- */
  const canUse = me.role === 'SUPER' || C.hasRole(me, ['SALES', 'HEAD', 'EXEC', 'SALES_ADMIN', 'ADMIN']);
  const canCreate = me.role === 'SUPER' || C.hasRole(me, ['SALES']);
  if (!canUse || (params.get('no') && !found) || (found && !C.canSeeQuote(me, found)) || (!found && !canCreate)) {
    $('#page-title').textContent = '견적';
    // 2026-11-06 점검: 견적을 쓸 수 있는 역할인데 주소의 번호나 판이 없으면 역할 권한 설명이 나왔음. 주소를 확인하라고 하고,
    //   같은 번호의 다른 판이 있고 볼 수 있으면 마지막 판으로 가는 길을 보임. 역할 설명은 정말 권한이 없을 때만
    if (canUse && params.get('no') && !found) {
      const latest = C.findQuote(params.get('no'));
      const seeLatest = !!latest && C.canSeeQuote(me, latest);
      $('#notice').innerHTML = C.noticeBox('', '견적을 찾을 수 없습니다',
        '주소의 견적번호나 판을 확인해 주세요.' + (seeLatest ? ' 이 견적번호의 마지막 판은 ' + latest.ver + '판입니다.' : ''),
        // &view=1: "보기"라는 말대로 견적서 보기로 엶(2026-11-06 점검 3회차: 출력 전의 내 판이면 고치기 화면이 열렸음)
        (seeLatest ? '<a class="btn btn--secondary btn--md" href="quote.html?no=' + encodeURIComponent(latest.no) + '&ver=' + latest.ver + '&view=1">마지막 판 보기</a>' : '') +
        '<a class="btn btn--tertiary btn--md" href="quotes.html">견적 목록</a>');
      return;
    }
    $('#notice').innerHTML = C.noticeBox('', !canUse || (found && !C.canSeeQuote(me, found)) ? '이 견적을 볼 수 없습니다' : '새 견적은 영업이 만듭니다',
      '지금은 ' + esc(C.roleLabel(me.role)) + ' 역할로 보고 있습니다. 견적에는 가격 기준이 담겨 있어 영업, 영업지원, 관리자만 봅니다. 영업 담당자는 내 견적, 영업 리더는 내 유닛 견적을 보고, 새 견적은 영업 담당자가 만듭니다.',
      '<a class="btn btn--tertiary btn--md" href="quotes.html">견적 목록</a>');
    return;
  }
  if (found && (viewNow || !C.canEditQuote(me, found))) { showView(found, false); return; }
  startEdit(found);

  /* ================================ 고치기 ================================ */
  function startEdit(src) {
    const form = $('#quote-form');
    form.hidden = false;
    // 새 견적은 오늘 견적일, 유효기간은 견적일 + 30일(QUOTE_RULES.validDays)
    const q = src ? JSON.parse(JSON.stringify(src)) : {
      no: '', ver: 1, customer: '', name: '', bizNo: '', unit: '', opp: '', date: D.TODAY, validUntil: C.addDays(D.TODAY, D.QUOTE_RULES.validDays),
      owner: me.id, lines: [], note: '', issues: [],
    };
    // 저장된 줄에는 기능만 있어, 고르는 칸을 채우려고 제품과 서비스를 기능에서 다시 찾음(v0.61 검토: 다시 열면 고르는 칸이 비었음)
    q.lines = q.lines.map(function (l) {
      const f = featureOf(l.feature), p = f && productOf(f.product);
      return Object.assign(blankLine(), l, { product: f ? f.product : '', service: p ? p.service : '', bad: false });
    });
    if (!q.lines.length) q.lines.push(blankLine());
    $('#page-title').textContent = src ? '견적 고치기' : '새 견적';
    $('#page-intro').innerHTML = '<p>제품과 가격 기준에 있는 표준 단가로 견적서를 만듭니다. 견적서를 출력하면 그 판은 고칠 수 없고 출력 기록이 남습니다.</p>' +
      '<p class="sub">' + (src ? esc(src.no) + ' ' + src.ver + '판, 출력 전이라 고칠 수 있습니다. ' : '') + '견적은 계약과 이어지지 않고, 견적 단계 할인 승인은 없습니다. 할인율 한도를 넘는 할인은 계약할 때 영업 리더가 승인합니다. ' +
      esc(cooText()) + '.</p>'; // 2026-11-09 5회차 점검: 영업 임원 승인(E-3)도 알림
    $('#q-name').value = q.name; $('#q-unit').value = q.unit; $('#q-opp').value = q.opp;
    $('#q-date').value = q.date; $('#q-valid').value = q.validUntil; $('#q-note').value = q.note || '';
    let customerKey = q.customer || '';
    validHelp();
    // 지금 팔지 않는 기능이 든 줄(새 판을 만든 경우 등)은 열 때 알려 줌
    if (q.lines.some(function (l) { return l.feature && !sold(l.feature); })) {
      $('#notice').innerHTML = C.noticeBox('', '지금 팔지 않는 기능이 든 줄이 있습니다', '그 줄의 제품이나 기능을 다시 고르거나 지운 뒤 출력합니다. 표준 단가는 오늘의 가격 기준으로 다시 채워집니다.');
    }

    /* --- 2. 거래처 찾기 (KRDS 콤보 상자: 글자를 넣으면 목록, 위아래 화살표와 Enter로 고름, Esc로 닫음) --- */
    const nameIn = $('#q-name'), listEl = $('#q-name-list'), liveEl = $('#q-name-live');
    let hits = [], active = -1, picked = null; // picked: 목록에서 고른 거래처(그 뒤 상호를 고치면 고른 거래처를 풂)
    function closeList() {
      listEl.hidden = true;
      active = -1;
      nameIn.setAttribute('aria-expanded', 'false');
      nameIn.removeAttribute('aria-activedescendant');
    }
    function renderHits() {
      hits = C.searchBusinesses(nameIn.value, 6);
      active = -1;
      nameIn.removeAttribute('aria-activedescendant');
      listEl.innerHTML = hits.map(function (h, i) {
        return '<li role="option" id="q-hit-' + i + '" class="q-combo-item" data-i="' + i + '" aria-selected="false"><span>' + esc(h.name) + '</span><span class="q-combo-meta">' + esc(h.bizNo) + (h.kind === 'C' ? ' 우리 거래처' : ' 사업자 정보') + '</span></li>';
      }).join('');
      listEl.hidden = !hits.length || document.activeElement !== nameIn;
      nameIn.setAttribute('aria-expanded', String(!listEl.hidden));
      liveEl.textContent = nameIn.value.trim() ? (hits.length ? '거래처 ' + hits.length + '곳을 찾았습니다.' : '찾은 거래처가 없습니다. 상호를 그대로 적으면 됩니다.') : '';
    }
    function pick(i) {
      const h = hits[i];
      if (!h) return;
      nameIn.value = h.name;
      customerKey = h.kind === 'C' ? h.key.slice(2) : '';
      picked = { name: h.name, bizNo: C.fmtBizNo(h.bizNo) };
      closeList();
      clearErr('name');
    }
    nameIn.addEventListener('input', function () {
      // 고른 뒤 상호를 고치면 다른 곳이 됨: 고른 거래처를 풂(v0.61 검토)
      if (picked && nameIn.value !== picked.name) picked = null;
      customerKey = '';
      clearErr('name'); // 상호를 고치면 바로 "고객사 상호를 넣으세요" 오류를 지움(2026-11-06 점검 3회차: 목록에서 고를 때만 지워졌음)
      renderHits();
    });
    nameIn.addEventListener('focus', renderHits);
    nameIn.addEventListener('blur', function () { setTimeout(closeList, 150); });
    nameIn.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { if (!listEl.hidden) { e.stopPropagation(); closeList(); } return; }
      if (listEl.hidden || !hits.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length;
        $$('.q-combo-item', listEl).forEach(function (li, i) { li.setAttribute('aria-selected', String(i === active)); });
        nameIn.setAttribute('aria-activedescendant', 'q-hit-' + active);
      } else if (e.key === 'Enter' && active > -1) { e.preventDefault(); pick(active); }
    });
    listEl.addEventListener('mousedown', function (e) { const li = e.target.closest('[data-i]'); if (li) { e.preventDefault(); pick(Number(li.dataset.i)); } });

    /* --- 3. 제품 줄 --- */
    function blankLine() { return { service: '', product: '', feature: '', qty: 1, unitPrice: null, listPrice: null, cap: null, unit: '', bad: false }; }
    function metaText(l) {
      if (!l.feature) return '';
      const disc = l.listPrice ? 1 - (Number(l.unitPrice) || 0) / l.listPrice : 0;
      // 2026-11-09 5회차 점검: 영업 임원 승인 기준보다 더 넘는 줄에는 "영업 임원 승인 대상"(계약 등록의 결재선 미리보기와 같은 말)
      return '단위 ' + esc(l.unit) + ', 표준 단가 ' + C.fmtWon(l.listPrice) + (disc > 0 ? ', 할인 ' + pct(disc) +
        (overCap(l) ? ' (한도 ' + pct(l.cap) + ' 넘음' + (cooOver(l) ? ', 영업 임원 승인 대상' : '') + ')' : '') : '') +
        (sold(l.feature) ? '' : ' (지금 팔지 않는 기능)');
    }
    function capWarn() {
      const overs = q.lines.filter(overCap);
      // 짧은 한 줄만 바꿔 넣고 보이고 감추지 않음(자리는 늘 한 줄, form.css .field-warn--reserve). 영업 리더와 영업 임원 승인의 까닭은
      //   줄마다 "한도 넘음, 영업 임원 승인 대상"(metaText)과 맨 위 안내에 있음(기획자 결정 2026-11-09 5회차 11번)
      $('#q-cap-warn').textContent = overs.length ? '할인율 한도를 넘는 줄이 ' + overs.length + '개입니다.' : '';
    }
    function lineRow(l, i) {
      const svc = l.service;
      // 이 줄에서 고른 제품은 사용 안 함이 되어도 그대로 보임(기능 칸과 같게, 빈 칸으로 보이지 않게. v0.63 검토)
      const products = D.PRODUCTS.filter(function (p) { return p.id === l.product || (p.use && p.service === svc && D.FEATURES.some(function (f) { return f.product === p.id && sold(f.id); })); });
      const feats = D.FEATURES.filter(function (f) { return f.product === l.product && (sold(f.id) || f.id === l.feature); });
      const opt = function (v, label, cur) { return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(label) + '</option>'; };
      const amount = (Number(l.unitPrice) || 0) * (Number(l.qty) || 0);
      const n = i + 1;
      // 서비스, 제품, 기능 세 칸은 PC에서도 한 줄에 하나, 칸 전체 폭 (기획자 결정 2026-11-02 D-8, 계약 등록과 같게. quote.css .q-pick)
      return '<tr data-i="' + i + '"' + (overCap(l) ? ' class="is-alert"' : '') + '>' +
        '<td><div class="q-pick">' +
          '<select class="select" data-k="service" aria-label="' + n + '번째 줄 서비스" aria-describedby="q-lines-err"><option value="">서비스</option>' +
            // 팔 수 있는 제품이 있는 서비스만(제품이 없는 "기타"를 고르면 줄을 끝낼 수 없었음, v0.63 점검에서 고침). 이미 고른 서비스는 그대로 보임
            Object.keys(D.SERVICES).filter(function (k) {
              return k === svc || D.PRODUCTS.some(function (p) { return p.use && p.service === k && D.FEATURES.some(function (f) { return f.product === p.id && sold(f.id); }); });
            }).map(function (k) { return opt(k, D.SERVICES[k], svc); }).join('') + '</select>' +
          // 제품, 기능, 수량, 단가 칸도 줄 오류(q-lines-err)에 이음(2026-11-06 점검 3회차: 서비스 칸만 이어져 있었음)
          '<select class="select" data-k="product" aria-label="' + n + '번째 줄 제품" aria-describedby="q-lines-err"' + (svc ? '' : ' disabled') + '><option value="">제품</option>' +
            products.map(function (p) { return opt(p.id, p.name, l.product); }).join('') + '</select>' +
          '<select class="select" data-k="feature" aria-label="' + n + '번째 줄 기능" aria-describedby="q-lines-err"' + (l.product ? '' : ' disabled') + '><option value="">기능</option>' +
            feats.map(function (f) { return opt(f.id, C.featureText(f.id), l.feature); }).join('') + '</select>' +
        '</div><span class="cell-meta q-meta">' + metaText(l) + '</span></td>' +
        '<td class="num" data-label="수량"><input class="input q-qty" data-k="qty" inputmode="numeric" maxlength="7" value="' + esc(l.raw && l.raw.qty != null ? l.raw.qty : l.qty) + '" aria-label="' + n + '번째 줄 수량" aria-describedby="q-lines-err"></td>' +
        '<td class="num" data-label="단가"><input class="input q-price" data-k="unitPrice" inputmode="numeric" value="' + esc(l.raw && l.raw.unitPrice != null ? l.raw.unitPrice : (l.unitPrice == null ? '' : Number(l.unitPrice).toLocaleString('ko-KR'))) + '" aria-label="' + n + '번째 줄 단가(원)" aria-describedby="q-lines-err"' + (l.feature ? '' : ' disabled') + '></td>' +
        '<td class="num q-amount" data-label="금액">' + (l.feature ? C.fmtWon(amount) : '-') + '</td>' +
        // 첫 줄은 "초기화"(고른 것과 수량, 단가를 비움), 둘째 줄부터는 "지우기"(줄을 뺌) (2026-11-06 기획자 요청: 예전에는 한 줄일 때도 "지우기"가 보였으나 눌러도 아무 일이 없었음)
        '<td class="center q-del">' + (i === 0
          ? '<button type="button" class="btn-text" data-reset="0">초기화<span class="sr-only"> 첫째 줄</span></button>'
          : '<button type="button" class="btn-text" data-del="' + i + '">지우기<span class="sr-only"> ' + n + '번째 줄</span></button>') + '</td>' +
      '</tr>';
    }
    function sums() {
      const t = C.quoteTotals({ lines: q.lines.filter(function (l) { return l.feature && !l.bad; }) });
      return '<div><dt>공급가액</dt><dd class="num">' + C.fmtWon(t.supply) + '</dd></div>' +
        '<div><dt>부가세(' + Math.round(D.QUOTE_RULES.vat * 100) + '%)</dt><dd class="num">' + C.fmtWon(t.vat) + '</dd></div>' +
        '<div class="q-sum-total"><dt>합계</dt><dd class="num">' + C.fmtWon(t.total) + '</dd></div>';
    }
    function renderLines(focusSel) {
      $('#q-lines').innerHTML = q.lines.map(lineRow).join('');
      $('#q-sum').innerHTML = sums();
      capWarn();
      if (focusSel) { const el = $(focusSel); if (el) el.focus(); }
    }
    $('#q-lines').addEventListener('change', function (e) {
      const tr = e.target.closest('tr[data-i]'), k = e.target.dataset.k;
      if (!tr || !k) return;
      const i = Number(tr.dataset.i), l = q.lines[i];
      if (!l) return;
      if (k === 'service') { q.lines[i] = Object.assign(blankLine(), { service: e.target.value, qty: l.qty }); }
      else if (k === 'product') { q.lines[i] = Object.assign(blankLine(), { service: l.service, product: e.target.value, qty: l.qty }); }
      else if (k === 'feature') {
        const p = PRICE[e.target.value];
        Object.assign(l, { feature: e.target.value, listPrice: p ? p.listPrice : null, unitPrice: p ? p.listPrice : null, cap: p ? p.discountCap : null, unit: p ? p.unit : '', raw: null, bad: false });
      } else return;
      renderLines('tr[data-i="' + i + '"] [data-k="' + k + '"]');
      clearErr('lines');
    });
    $('#q-lines').addEventListener('input', function (e) {
      const tr = e.target.closest('tr[data-i]'), k = e.target.dataset.k;
      if (!tr || (k !== 'qty' && k !== 'unitPrice')) return;
      const l = q.lines[Number(tr.dataset.i)];
      if (!l) return;
      // 숫자와 쉼표만 받음. 다른 글자(소수점, 빼기 등)가 있으면 바꾸지 않고 틀린 칸으로 둠(v0.61 검토: '1.5'가 15로 바뀌었음)
      const raw = String(e.target.value);
      l.raw = Object.assign({}, l.raw, { [k]: raw });
      const okRaw = /^[\d,\s]*$/.test(raw);
      const n = parseInt(raw.replace(/[^0-9]/g, ''), 10);
      if (okRaw) l[k] = isNaN(n) ? (k === 'qty' ? 0 : null) : n;
      l.bad = !(/^[\d,\s]*$/.test(String((l.raw || {}).qty == null ? l.qty : l.raw.qty)) && /^[\d,\s]*$/.test(String((l.raw || {}).unitPrice == null ? '' : l.raw.unitPrice)));
      e.target.setAttribute('aria-invalid', String(!okRaw));
      // 고치는 칸은 그대로 두고 금액, 줄 설명, 합계, 한도 알림만 바꿈(줄을 다시 그리지 않아 커서와 다음 칸 누름이 그대로)
      tr.querySelector('.q-amount').textContent = l.feature ? C.fmtWon((Number(l.unitPrice) || 0) * (Number(l.qty) || 0)) : '-';
      tr.querySelector('.q-meta').innerHTML = metaText(l);
      tr.classList.toggle('is-alert', overCap(l));
      $('#q-sum').innerHTML = sums();
      capWarn();
    });
    // 단가 칸을 떠나면 천 단위 쉼표로 다시 씀(맞는 값일 때만)
    $('#q-lines').addEventListener('focusout', function (e) {
      if (e.target.dataset.k !== 'unitPrice') return;
      const l = q.lines[Number(e.target.closest('tr').dataset.i)];
      if (!l || l.bad) return;
      e.target.value = l.unitPrice == null ? '' : Number(l.unitPrice).toLocaleString('ko-KR');
      if (l.raw) l.raw.unitPrice = null;
    });
    $('#q-lines').addEventListener('click', function (e) {
      if (e.target.closest('[data-reset]')) {
        q.lines[0] = blankLine();
        renderLines('tr[data-i="0"] [data-k="service"]');
        return;
      }
      const b = e.target.closest('[data-del]');
      if (!b || Number(b.dataset.del) === 0) return;
      q.lines.splice(Number(b.dataset.del), 1);
      renderLines('#q-add');
    });
    $('#q-add').insertAdjacentHTML('afterbegin', C.icon('plus')); // + 아이콘 (계약 등록의 제품 추가와 같게)
    $('#q-add').addEventListener('click', function () {
      q.lines.push(blankLine());
      renderLines('tr[data-i="' + (q.lines.length - 1) + '"] [data-k="service"]');
    });
    $('#q-date').addEventListener('change', validHelp);
    $('#q-valid').addEventListener('change', validHelp);
    function validHelp() {
      const d = $('#q-date').value, v = $('#q-valid').value;
      $('#q-valid-help').textContent = '기본은 견적일부터 ' + D.QUOTE_RULES.validDays + '일입니다.' + (d && v && v >= d ? ' 지금 ' + daysBetween(d, v) + '일.' : '');
    }
    renderLines();

    /* --- 4. 검사, 저장, 출력 --- */
    function fieldBox(name) { return form.querySelector('[data-field="' + name + '"]'); }
    function clearErr(name) { const b = fieldBox(name); if (b && b.classList.contains('is-invalid')) C.setFieldError(b, ''); }
    // 화면의 값을 모은 사본(q.lines는 바꾸지 않음: 검사에 걸려도 화면의 줄과 기록의 줄이 어긋나지 않게, v0.61 검토)
    function collect() {
      const name = $('#q-name').value.trim();
      return Object.assign({}, q, {
        name: name,
        // 2026-11-06 기획자 요청: 사업자등록번호는 넣지 않음. 목록에서 고른 거래처면 그 번호를 기록에만 남김(화면과 견적서에는 보이지 않음)
        //   상호를 열 때와 같게 두면 저장된 번호를 그대로 둠(2026-11-06 점검: 사업자 정보 DB에서 고른 곳은 거래처 번호가 없어, 다시 저장하면 번호가 빠졌음)
        bizNo: picked ? picked.bizNo : (name === (q.name || '').trim() || (customerKey && customerKey === q.customer) ? q.bizNo || '' : ''),
        // 상호를 열 때와 같게 다시 적으면(입력하며 거래처 연결이 풀림) 저장된 거래처를 그대로 둠(2026-11-06 점검)
        customer: customerKey || (name === (q.name || '').trim() ? q.customer || '' : ''),
        unit: $('#q-unit').value.trim(),
        opp: $('#q-opp').value.trim().toUpperCase(),
        date: $('#q-date').value, validUntil: $('#q-valid').value,
        note: $('#q-note').value.trim(),
        lines: q.lines.filter(function (l, i) { return l.feature || l.bad || (i === 0 && q.lines.length === 1); }),
      });
    }
    function showErrors(list) {
      $$('.is-invalid', form).forEach(function (b) { C.setFieldError(b, ''); });
      const errors = list.map(function (x) {
        const box = fieldBox(x[0]);
        C.setFieldError(box, x[1]);
        // x[2]: 오류 목록을 눌렀을 때 갈 칸을 따로 정할 때(2026-11-06 점검: 틀린 수량, 단가 칸으로 바로 가게)
        return { msg: x[1], target: x[2] || box.querySelector('input:not([disabled]), select:not([disabled]), textarea') };
      });
      const box = $('#error-summary');
      box.hidden = !errors.length;
      if (!errors.length) return;
      box.innerHTML = '<p class="error-summary-title">' + C.icon('alert') + '입력하지 않았거나 고쳐야 할 항목이 ' + errors.length + '개 있습니다</p><ul>' +
        errors.map(function (e, i) { return '<li><a href="#" data-err="' + i + '">' + esc(e.msg) + '</a></li>'; }).join('') + '</ul>';
      box.onclick = function (ev) {
        const a = ev.target.closest('[data-err]');
        if (!a) return;
        ev.preventDefault();
        const t = errors[Number(a.dataset.err)].target;
        if (t) { t.scrollIntoView({ block: 'center' }); t.focus({ preventScroll: true }); }
      };
      box.focus();
    }
    // 저장: 저장된 기록을 다시 읽고, 이미 출력한 판이면 막고 보기로(예전 탭, 뒤로 가기로 남은 화면, v0.61 검토)
    function save(d) {
      const cur = d.no ? C.findQuote(d.no, d.ver) : null;
      if (cur && (cur.issues || []).length) {
        C.flash(d.no + ' ' + d.ver + '판은 이미 출력한 판이라 고칠 수 없습니다. 바꾸려면 새 판을 만드세요.');
        location.href = 'quote.html?no=' + encodeURIComponent(d.no) + '&ver=' + d.ver;
        return null;
      }
      if (!d.no) d.no = C.newQuoteNo(d.date);
      d.savedAt = C.nowStamp();
      d.issues = [];
      d.lines = d.lines.filter(function (l) { return l.feature; }).map(function (l) {
        return { feature: l.feature, qty: l.qty, unitPrice: l.unitPrice, listPrice: l.listPrice, cap: l.cap, unit: l.unit };
      });
      return C.saveQuote(d);
    }
    $('#q-save').addEventListener('click', function () {
      const d = collect();
      // 저장은 고객사만 있으면 됨(작성 중). 출력할 때 모든 항목을 검사
      //   2026-11-06 점검: 수량이나 단가 칸에 숫자가 아닌 글자(예: 1.5)가 있으면 저장하지 않음(예전에는 마지막 맞는 숫자로 말없이 저장했음)
      const errs = [];
      if (!d.name) errs.push(['name', '저장하려면 고객사 상호를 넣으세요.']);
      let badBox = null;
      if (d.lines.some(function (l) { return l.bad; })) {
        // 줄을 다시 그리면 aria-invalid가 지워지므로 칸의 글자를 다시 봄
        badBox = $$('#q-lines input[data-k]').filter(function (el) { return !/^[\d,\s]*$/.test(el.value); })[0] || null;
        if (badBox) badBox.setAttribute('aria-invalid', 'true');
        errs.push(['lines', '수량과 단가는 숫자로만 넣습니다(쉼표는 괜찮음).', badBox]);
      }
      if (errs.length) {
        showErrors(errs);
        if (badBox) badBox.focus(); // 틀린 칸 중 첫 칸으로 바로 감
        return;
      }
      $('#error-summary').hidden = true;
      const saved = save(d);
      if (!saved) return;
      // 저장하면 견적서 보기로 감. 출력은 거기의 "견적서 출력"(모든 항목을 검사), 더 고치려면 "고치기"
      C.flash(saved.no + ' ' + saved.ver + '판을 저장했습니다. 출력 전이라 고칠 수 있고, 다 되면 "견적서 출력"으로 냅니다.');
      location.href = 'quote.html?no=' + encodeURIComponent(saved.no) + '&ver=' + saved.ver + '&view=1';
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); }); // Enter로 출력하거나 저장하지 않음
  }

  /* ================================ 보기 ================================ */
  function showView(q, doPrint) {
    $('#quote-form').hidden = true;
    $('#quote-view').hidden = false;
    renderHead(q);
    $('#quote-doc').innerHTML = docHtml(q);
    renderIssues(q);
    renderVersions(q);
    if (doPrint) issue(q);
  }
  function renderHead(q) {
    const st = C.quoteStatus(q), mine = q.owner === me.id, latest = C.findQuote(q.no);
    $('#page-title').innerHTML = '견적서 <span class="q-title-no">' + esc(q.no) + ' ' + q.ver + '판</span> ' + C.badge(st.tone, st.label);
    const intro = [];
    if (st.code === 'DRAFT') intro.push(mine ? '아직 출력하지 않은 판이라 고칠 수 있습니다.' : '작성한 영업이 아직 출력하지 않은 판입니다.');
    else intro.push('출력한 판은 고칠 수 없습니다.' + (mine && latest.ver === q.ver ? ' 내용을 바꾸려면 새 판을 만듭니다.' : ''));
    if (latest.ver > q.ver) intro.push('이 견적에는 새 판(' + latest.ver + '판)이 있어 이 판은 출력할 수 없습니다.');
    if (st.code === 'EXPIRED') intro.push('유효기간(' + C.fmtDate(q.validUntil) + ')이 지나 출력할 수 없습니다. 다시 내려면 새 판을 만듭니다.');
    // 고객용 견적서는 단추로만(REQ-QUO-05). 처음 쓰는 사람이 브라우저 인쇄로 찍지 않게 이용 안내와 같은 말로 알림
    //   기획자 결정 2026-11-02 E-7: "견적서 출력"에만 회사 인장이 찍힘을 함께 알림(화면과 사내 인쇄에는 없음)
    if (canIssue(q)) intro.push('고객에게 낼 견적서는 "견적서 출력"으로 냅니다(회사 인장이 찍히고, PDF로 저장해 보낼 수 있음). 브라우저의 인쇄 메뉴로 찍으면 워터마크가 든 사내 인쇄가 되고 인장은 찍히지 않습니다.');
    const overs = q.lines.filter(overCap);
    $('#page-intro').innerHTML = '<p>' + esc(intro.join(' ')) + '</p><p class="sub">작성 ' + esc(C.ownerLabel(q.owner)) + ', 저장 ' + esc(C.fmtDateTime(q.savedAt)) +
      (overs.length ? '. 할인율 한도를 넘는 줄이 ' + overs.length + '개 있어 이 가격으로 계약하면 영업 리더의 할인 승인이 필요합니다' : '') +
      (overs.some(cooOver) ? '. ' + esc(cooText()) : '') + '.</p>'; // 2026-11-09 5회차 점검: 영업 임원 승인(E-3)도 알림
    renderActions(q);
  }
  // 출력할 수 있는지: 작성한 영업(시연은 최고관리자), 맨 마지막 판, 작성 중이거나 출력함(기간 지남, 새 판으로 바뀜은 안 됨), 검사 통과
  function canIssue(q) {
    const st = C.quoteStatus(q), latest = C.findQuote(q.no);
    return (q.owner === me.id || me.role === 'SUPER') && latest.ver === q.ver && (st.code === 'DRAFT' || st.code === 'ISSUED') && !problems(q).length;
  }
  // 할 일 단추: 견적서 출력, 고치기(출력 전의 내 판), 새 판 만들기(작성한 영업, 맨 마지막 판이고 출력한 뒤)
  function renderActions(q) {
    const mine = q.owner === me.id, latest = C.findQuote(q.no);
    const acts = [];
    if (C.canEditQuote(me, q)) acts.push('<a class="btn btn--tertiary btn--md" href="quote.html?no=' + encodeURIComponent(q.no) + '&ver=' + q.ver + '">고치기</a>');
    if (mine && latest.ver === q.ver && (q.issues || []).length) acts.push('<button type="button" class="btn btn--tertiary btn--md" id="q-newver">새 판 만들기</button>');
    // 출력은 작성한 영업만(견적서의 담당이 작성한 영업이라). 시연을 위해 최고관리자도. 다른 사람은 보기만
    if (canIssue(q)) acts.push('<button type="button" class="btn btn--primary btn--md" id="q-out">' + C.icon('print', 'sm') + '견적서 출력</button>');
    $('#page-actions').innerHTML = acts.join('');
    if ($('#q-out')) $('#q-out').addEventListener('click', function () { issue(q); });
    const nv = $('#q-newver');
    if (nv) nv.addEventListener('click', function () { newVersion(q); });
    // 출력할 수 없는 까닭(작성한 영업이 보는 맨 마지막 판인데 검사에 걸림)
    //   기획자 결정 2026-11-02 E-7: 출력할 수 있는데 회사 인장 그림이 없으면 누르기 전에 알림(인장 없이 나가고 기록에 "인장 없음". 막지는 않음)
    const why = problems(q);
    $('#notice').innerHTML = (mine || me.role === 'SUPER') && latest.ver === q.ver && why.length && C.quoteStatus(q).code !== 'EXPIRED'
      ? C.noticeBox('', '이 판은 아직 출력할 수 없습니다', why.map(function (x) { return x[1]; }).join(' '))
      : canIssue(q) && !sealNow() ? C.noticeBox('', '회사 인장 그림이 없습니다',
        '회사 설정에 인장 그림이 없어 "견적서 출력"을 누르면 인장 없이 나가고, 출력 기록에 "인장 없음"이 남습니다. 총무에게 인장 그림을 올려 달라고 알려 주세요.') : '';
  }
  // 지금 회사 인장 그림(회사 설정, 총무가 올림). 없으면 null (기획자 결정 2026-11-02 E-7)
  function sealNow() { const s = D.COMPANY && D.COMPANY.seal; return s && s.src ? s : null; }
  // 새 판: 저장된 맨 마지막 판을 다시 읽고 그 다음 판으로. 표준 단가와 한도, 단위는 오늘의 가격 기준으로 다시 채움(v0.61 검토)
  function newVersion(q) {
    const latest = C.findQuote(q.no);
    if (latest.ver !== q.ver || !(latest.issues || []).length) {
      C.flash('이 견적에는 이미 새 판(' + latest.ver + '판)이 있습니다.');
      location.href = 'quote.html?no=' + encodeURIComponent(latest.no) + '&ver=' + latest.ver;
      return;
    }
    const copy = JSON.parse(JSON.stringify(latest));
    let changed = 0;
    copy.lines.forEach(function (l) {
      const p = PRICE[l.feature];
      if (p && (p.listPrice !== l.listPrice || p.discountCap !== l.cap || p.unit !== l.unit)) { changed++; Object.assign(l, { listPrice: p.listPrice, cap: p.discountCap, unit: p.unit }); }
    });
    Object.assign(copy, { ver: latest.ver + 1, date: D.TODAY, validUntil: C.addDays(D.TODAY, D.QUOTE_RULES.validDays), owner: me.id, issues: [], savedAt: C.nowStamp() });
    C.saveQuote(copy);
    // 표준 단가만이 아니라 한도도 오늘 값으로 바뀜(기획자 결정 2026-11-02 E-4: 남은 시연 한도 20%, 15%가 0%로)
    C.flash(copy.no + ' ' + copy.ver + '판을 만들었습니다.' + (changed ? ' 가격 기준이 바뀐 줄 ' + changed + '개의 표준 단가와 할인율 한도를 오늘 값으로 바꿨습니다.' : '') + ' 고친 뒤 출력합니다.');
    location.href = 'quote.html?no=' + encodeURIComponent(copy.no) + '&ver=' + copy.ver;
  }

  // 견적서 출력: 저장된 기록을 다시 읽어 출력 기록을 덧붙이고(다른 탭에서 남긴 기록도 지키며), 고객용 견적서만 인쇄(body.is-quote-print, quote.css)
  //   기획자 결정 2026-11-02 E-7: 출력 기록에 인장을 찍었는지(sealed)와 그 그림의 판(sealVer)을 함께 남긴 뒤, 인장 그림을 넣은 견적서로 인쇄
  //     인장 그림은 인쇄하는 동안에만 넣고 인쇄 창을 닫으면 뺌(화면과 사내 인쇄에는 찍히지 않게). 그림이 없으면 인장 없이 출력하고 알림
  function issue(q) {
    const cur = C.findQuote(q.no, q.ver);
    if (!cur || !canIssue(cur)) { renderHead(cur || q); C.toast('이 판은 지금 출력할 수 없습니다.'); return; }
    const t = C.quoteTotals(cur);
    const seal = sealNow();
    cur.issues = (cur.issues || []).concat([Object.assign({ at: C.nowStamp(), by: me.id, total: t.total, sealed: !!seal }, seal ? { sealVer: seal.ver } : {})]);
    const saved = C.saveQuote(cur);
    renderHead(saved);
    $('#quote-doc').innerHTML = docHtml(saved, seal);
    renderIssues(saved);
    renderVersions(saved);
    window.scrollTo(0, 0);
    if ($('#q-out')) $('#q-out').focus({ preventScroll: true });
    document.body.classList.add('is-quote-print');
    const done = function () {
      document.body.classList.remove('is-quote-print');
      $('#quote-doc').innerHTML = docHtml(saved); // 인장 그림을 뺀 화면 모양으로 되돌림
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    C.toast(seal ? '출력 기록을 남겼습니다(' + saved.no + ' ' + saved.ver + '판, ' + saved.issues.length + '번째, 인장 찍음).'
      : '회사 인장 그림이 없어 인장 없이 출력합니다. 총무에게 알려 주세요.', !seal);
    // 인장 그림을 다 읽은 뒤에 인쇄 창을 엶(그림 자리가 비어 찍히지 않게)
    const img = $('#quote-doc .qd-seal');
    const go = function () { window.print(); };
    setTimeout(function () { if (img && img.decode) img.decode().then(go, go); else go(); }, 50);
  }
  // 출력 기록: 일시, 출력한 사람, 인장(기획자 결정 2026-11-02 E-7 ③. 인장 찍음과 그림의 판, 인장 없음. 이 결정 앞의 기록은 "-"), 합계
  function sealText(x) {
    return x.sealed === true ? '인장 찍음' + (x.sealVer ? '<span class="cell-meta">그림 ' + x.sealVer + '판</span>' : '')
      : x.sealed === false ? C.badge('attention', '인장 없음') : '-';
  }
  function renderIssues(q) {
    const list = (q.issues || []).slice().reverse();
    $('#q-issues').innerHTML = list.length ? '<div class="tbl-scroll"><table class="tbl tbl--compact"><caption class="sr-only">출력 기록: 일시, 출력한 사람, 인장, 합계</caption>' +
      '<thead><tr><th scope="col">출력 일시</th><th scope="col">출력한 사람</th><th scope="col">인장</th><th scope="col" class="num">합계</th></tr></thead><tbody>' +
      list.map(function (x) {
        return '<tr><td class="num-left">' + esc(C.fmtDateTime(x.at)) + '</td><td class="center">' + esc(C.ownerLabel(x.by)) + '</td>' +
          '<td class="center nowrap">' + sealText(x) + '</td><td class="num">' + C.fmtWon(x.total) + '</td></tr>';
      }).join('') +
      '</tbody></table></div>' : '<p class="empty-note">아직 출력하지 않았습니다.</p>';
  }
  function renderVersions(q) {
    const vers = C.allQuotes().filter(function (x) { return x.no === q.no; }).sort(function (a, b) { return b.ver - a.ver; });
    $('#q-versions').innerHTML = '<div class="tbl-scroll"><table class="tbl tbl--compact"><caption class="sr-only">이 견적의 판: 판, 견적일, 합계, 상태, 출력</caption>' +
      '<thead><tr><th scope="col" class="col-phone-mid">판</th><th scope="col">견적일</th><th scope="col" class="num">합계</th><th scope="col">상태</th><th scope="col">출력</th></tr></thead><tbody>' +
      vers.map(function (x) {
        const s = C.quoteStatus(x);
        const cur = x.ver === q.ver;
        return '<tr' + (cur ? ' class="is-current"' : '') + '><td class="center">' + (cur ? '<strong>' + x.ver + '판</strong><span class="sr-only"> (지금 보는 판)</span>' : '<a class="doc-link" href="quote.html?no=' + encodeURIComponent(x.no) + '&ver=' + x.ver + '&view=1">' + x.ver + '판</a>' /* 다른 판도 보기로(기획자 결정 2026-11-09) */) + '</td>' +
          '<td class="num-left nowrap">' + C.fmtDate(x.date) + '</td><td class="num">' + C.fmtWon(C.quoteTotals(x).total) + '</td>' +
          '<td class="nowrap">' + C.badge(s.tone, s.label) + '</td><td class="center">' + ((x.issues || []).length ? x.issues.length + '번' : '-') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* ---------- 고객에게 내는 견적서 (A4 세로, 흑백 인쇄. 줄이 많으면 다음 장으로 이어지고 표 머리글이 다시 나옴) ----------
   * seal: "견적서 출력"으로 인쇄할 때만 넘기는 회사 인장 그림(기획자 결정 2026-11-02 E-7). 없으면 대표자 옆에 "(인)" 글자만
   * 공급자 칸은 회사 설정 값(E-9, D.COMPANY). 비어 있는 값은 "회사 설정에 없음"으로 흐리게 */
  function docHtml(q, seal) {
    const t = C.quoteTotals(q), S = D.COMPANY;
    const acc = C.accountOf(q.owner);
    const setting = function (v) { return v ? esc(v) : '<span class="qd-setting">회사 설정에 없음</span>'; };
    const sealSpot = '<span class="qd-seal-spot">(인)' + (seal ? '<img class="qd-seal" src="' + esc(seal.src) + '" alt="회사 인장">' : '') + '</span>';
    return '<article class="quote-doc" aria-label="견적서 미리 보기">' +
      '<header class="qd-head"><h2 class="qd-title">견적서</h2>' +
        '<dl class="qd-meta"><div><dt>견적번호</dt><dd>' + esc(q.no) + ' (' + q.ver + '판)</dd></div>' +
        '<div><dt>견적일</dt><dd>' + C.fmtDate(q.date) + '</dd></div><div><dt>유효기간</dt><dd>' + C.fmtDate(q.validUntil) + '까지</dd></div></dl></header>' +
      '<div class="qd-parties">' +
        '<section class="qd-party"><h3 class="qd-h3">받는 곳</h3><p class="qd-to">' + esc(q.name) + (q.unit ? ' ' + esc(q.unit) : '') + ' 귀중</p>' +
          '<p class="qd-small">아래와 같이 견적합니다.</p></section>' + // 받는 곳의 사업자등록번호는 싣지 않음(2026-11-06 기획자 요청)
        '<section class="qd-party"><h3 class="qd-h3">공급자</h3><dl class="qd-kv">' +
          '<div><dt>상호</dt><dd>' + esc(S.name) + '</dd></div>' +
          // 기획자 결정 2026-11-02 E-9: 회사 설정 값(REQ-QUO-08). 예전에는 "회사 설정 값" 자리만 있었음. 인장은 대표자 옆 "(인)" 자리에(E-7)
          '<div><dt>사업자등록번호</dt><dd>' + setting(S.bizNo) + '</dd></div>' +
          '<div><dt>대표자</dt><dd>' + setting(S.ceo) + ' ' + sealSpot + '</dd></div>' +
          '<div><dt>주소</dt><dd>' + setting(S.address) + '</dd></div>' +
          '<div><dt>대표 연락처</dt><dd>' + setting(S.phone) + '</dd></div>' +
          '<div><dt>담당</dt><dd>' + esc(C.ownerLabel(q.owner)) + (acc && acc.email ? ' <span class="nowrap">' + esc(acc.email) + '</span>' : '') + '</dd></div></dl></section>' +
      '</div>' +
      '<p class="qd-total"><span>합계 금액(부가세 포함)</span><strong>' + esc(koreanWon(t.total)) + ' <span class="nowrap">(' + C.fmtWon(t.total) + ')</span></strong></p>' +
      '<div class="tbl-scroll qd-scroll" tabindex="0" role="region" aria-label="견적 품목 표"><table class="tbl tbl--compact qd-lines"><caption class="sr-only">견적 품목: 번호, 품목, 단위, 수량, 단가, 금액</caption>' +
        '<thead><tr><th scope="col">번호</th><th scope="col" class="col-phone-wide">품목</th><th scope="col">단위</th><th scope="col" class="num">수량</th><th scope="col" class="num">단가</th><th scope="col" class="num">금액</th></tr></thead><tbody>' +
        // 2026-11-06 점검: 줄이 없는 견적은 품목 표가 텅 빈 채 0원만 보였음. 빈 줄 하나로 까닭과 할 일을 알림(목록 화면의 빈 줄과 같은 꼴)
        (!(q.lines || []).length ? '<tr><td class="empty-row" colspan="6">아직 넣은 품목이 없습니다. 고치기에서 제품을 넣은 뒤 출력합니다.</td></tr>' : '') +
        (q.lines || []).map(function (l, i) {
          const f = featureOf(l.feature);
          // data-label: 휴대폰에서 줄을 세로로 쌓을 때 값 앞에 붙는 이름(quote.css, 2026-11-06 기획자 요청: 휴대폰은 옆으로 밀지 않게)
          return '<tr><td class="center qd-no">' + (i + 1) + '</td><td class="qd-item">' + esc(C.featureLabel({ product: f ? f.product : '', feature: l.feature })) + '</td><td class="center cell-phone-nowrap" data-label="단위">' + esc(l.unit) + '</td>' +
            '<td class="num" data-label="수량">' + Number(l.qty).toLocaleString('ko-KR') + '</td><td class="num" data-label="단가">' + C.fmtWon(l.unitPrice) + '</td><td class="num" data-label="금액">' + C.fmtWon(l.unitPrice * l.qty) + '</td></tr>';
        }).join('') + '</tbody>' +
        '<tfoot><tr><th scope="row" colspan="5">공급가액</th><td class="num">' + C.fmtWon(t.supply) + '</td></tr>' +
        '<tr><th scope="row" colspan="5">부가세(' + Math.round(D.QUOTE_RULES.vat * 100) + '%)</th><td class="num">' + C.fmtWon(t.vat) + '</td></tr>' +
        '<tr class="qd-grand"><th scope="row" colspan="5">합계</th><td class="num">' + C.fmtWon(t.total) + '</td></tr></tfoot></table></div>' +
      (q.note ? '<section class="qd-note"><h3 class="qd-h3">조건과 비고</h3><p>' + esc(q.note).replace(/\n/g, '<br>') + '</p></section>' : '') +
      '<p class="qd-foot">이 시스템에서 발급한 견적서입니다. 견적번호 ' + esc(q.no) + ' ' + q.ver + '판의 발급 기록이 남아 있습니다.</p>' +
    '</article>';
  }

  /* ---------- 도우미 ---------- */
  function daysBetween(a, b) { const pa = a.split('-').map(Number), pb = b.split('-').map(Number); return Math.round((new Date(pb[0], pb[1] - 1, pb[2]) - new Date(pa[0], pa[1] - 1, pa[2])) / 86400000); }
  // 한글 금액: 일금 일천육백팔십구만육천원정 (견적서에서 흔히 쓰는 표기. 고쳐 쓰지 못하게 일천, 일백, 일십처럼 일을 적음)
  function koreanWon(n) {
    const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'], small = ['', '십', '백', '천'], big = ['', '만', '억', '조'];
    if (!n) return '일금 영원정';
    let out = '', g = 0;
    while (n > 0) {
      const part = n % 10000;
      if (part) {
        let s = '';
        String(part).padStart(4, '0').split('').forEach(function (ch, i) {
          const d = Number(ch);
          if (d) s += digits[d] + small[3 - i];
        });
        out = s + big[g] + out;
      }
      n = Math.floor(n / 10000); g++;
    }
    return '일금 ' + out + '원정';
  }
})();
