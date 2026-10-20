/* =====================================================================
 * SCR-11 새 계약 등록 화면 로직 (new-contract.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: 요구사항 정의서 3.4(입력 항목), 3.5(체크리스트와 결재선),
 *   REQ-FLOW-14(임시 저장, 기안), REQ-FLOW-17(재기안은 다음 차수), REQ-FLOW-18(변경, 갱신 묶음 번호),
 *   REQ-SCOPE-02, REQ-CHK-04(가격 기준으로 체크리스트 2, 3번 자동 계산), REQ-CHK-05(결재선 자동)
 * 하는 일
 *   1. 영업만 쓸 수 있게 막기
 *   2. 이어서 작성(임시 저장 건), 보완 후 재기안(반려 건)일 때 값 미리 채우기
 *   3. 제품별 금액 줄 추가, 삭제와 총액, 연도별 금액 계산
 *   4. 체크리스트 2, 3번 자동 계산과 결재선 표시
 *   5. 필수 항목 검사(오류 요약 + 항목별 오류), 기안 확인 창, 기안 완료 안내
 * 프로토타입: 저장, 파일 업로드, 기안은 화면만 동작합니다. 실제 시스템에서는 서버에 저장하고,
 *   가격 기준 계산과 결재선 결정도 서버에서 다시 검증해야 합니다(화면 값은 바꿀 수 있으므로).
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s, root) { return (root || document).querySelector(s); };
  const $$ = function (s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); };

  const form = $('#contract-form');
  const NDA = C.typeLabel('NDA'); // 비밀유지계약(NDA): 코드 관리에서 이름을 바꿔도 같은 유형으로 판단
  const PRICE = {};
  D.PRICE_BOOK.forEach(function (p) { PRICE[p.code] = p; });

  /* ---------- 숫자와 날짜 도우미 ---------- */
  function parseNum(v) {
    const n = String(v == null ? '' : v).replace(/[^0-9]/g, '');
    return n ? parseInt(n, 10) : null;
  }
  function fmtNum(n) { return n == null ? '' : n.toLocaleString('ko-KR'); }
  function won(n) { return C.fmtKRW(n); }
  function pct(r) { return Math.round(r * 1000) / 10 + '%'; }
  function val(name) {
    const el = form.querySelector('[name="' + name + '"]:checked') || form.querySelector('[name="' + name + '"]');
    if (!el) return '';
    if (el.type === 'radio') return el.checked ? el.value : '';
    if (el.type === 'checkbox') return el.checked;
    return el.value.trim();
  }
  function setRadio(name, value) {
    $$('[name="' + name + '"]', form).forEach(function (r) { r.checked = r.value === value; });
  }
  function toDate(s) { if (!s) return null; const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function addMonths(d, m) { return new Date(d.getFullYear(), d.getMonth() + m, d.getDate()); }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  /* ---------- 1. 영업만 쓸 수 있음 (REQ-AUTH-04, 4.1). 슈퍼관리자는 모든 화면을 볼 수 있음 (v0.16) ---------- */
  if (me.role !== 'SALES' && me.role !== 'SUPER') {
    $('#notice').innerHTML = noticeHtml('', '계약 등록은 영업만 할 수 있습니다',
      '지금은 ' + esc(C.roleLabel(me.role)) + ' 역할로 보고 있습니다. 화면 맨 위 검은 띠에서 영업 역할로 바꾸면 계약 등록 화면을 볼 수 있습니다.', '');
    form.hidden = true;
    return;
  }

  function noticeHtml(kind, title, body, actions) {
    return '<div class="notice' + (kind ? ' notice--' + kind : '') + '" role="status">' +
      '<p class="notice-title">' + C.icon(kind === 'success' ? 'check' : 'alert') + esc(title) + '</p>' +
      '<p class="notice-body">' + body + '</p>' +
      (actions ? '<div class="notice-actions">' + actions + '</div>' : '') +
    '</div>';
  }

  /* ---------- 선택지 채우기 (3.4) ---------- */
  $('#f-owner').value = me.name + '님 (' + me.dept + ')';
  $('#f-type').innerHTML = '<option value="">고르세요</option>' +
    D.CONTRACT_TYPES.map(function (t) { return '<option>' + esc(t) + '</option>'; }).join('');
  // 계약 유형, 계약 방식, 정산 방식: 코드 관리(SCR-56)에서 사용 중인 코드만 고름
  $('#method-choices').innerHTML = C.codeList('METHOD').map(function (c) {
    return '<label class="choice"><input type="radio" name="method" value="' + c.code + '">' + esc(c.label) + '</label>';
  }).join('');
  $('#settlement-choices').innerHTML = C.codeList('SETTLEMENT').map(function (c) {
    return '<label class="choice"><input type="radio" name="settlement" value="' + c.code + '">' + esc(c.label) + '</label>';
  }).join('');
  /* 거래처 목록 (REQ-REG-18, D-01): 사용 중인 거래처를 상호 순서로. 맨 끝은 새 거래처 등록
   * 프로토타입: 새 거래처는 기안할 때 함께 등록되는 것으로 안내만 함. 실제 시스템은 서버가 사업자등록번호 중복을 다시 검사 */
  const NEW_CUSTOMER = 'NEW';
  const customers = D.CUSTOMERS.filter(function (cu) { return cu.use; }).sort(function (a, b) { return a.name.localeCompare(b.name, 'ko'); });
  $('#f-customer').innerHTML = '<option value="">고르세요</option>' + customers.map(function (cu) {
    return '<option value="' + esc(cu.id) + '">' + esc(cu.name + ' (' + cu.bizNo + ')') + '</option>';
  }).join('') + '<option value="' + NEW_CUSTOMER + '">목록에 없음: 새 거래처 등록</option>';
  function findCustomer(id) { return customers.filter(function (cu) { return cu.id === id; })[0] || null; }
  // 거래처를 고르면 상호와 사업자등록번호를 채우고 잠금. 새 거래처면 비우고 직접 넣게 함
  function onCustomerChange() {
    const v = $('#f-customer').value, cu = findCustomer(v), isNew = v === NEW_CUSTOMER;
    $('#f-counterparty').readOnly = !isNew;
    $('#f-bizno').readOnly = !isNew;
    $('#f-counterparty').value = cu ? cu.name : '';
    $('#f-bizno').value = cu ? cu.bizNo : '';
    $('#f-counterparty').placeholder = isNew ? '사업자등록증의 상호' : '거래처를 먼저 고르세요';
    $('#customer-help').textContent = isNew
      ? '기안하면 이 상호와 사업자등록번호로 거래처 목록에 함께 등록됩니다. 같은 사업자등록번호는 두 번 등록할 수 없습니다.'
      : '거래처 목록에서 고릅니다. 상호와 사업자등록번호는 목록에서 채워집니다.';
  }
  // 상호로 거래처 고르기 (미리 채우기). 목록에 없으면 새 거래처로
  function pickCustomerByName(name, bizNo) {
    if (!name) return;
    const cu = customers.filter(function (x) { return x.name === name; })[0];
    $('#f-customer').value = cu ? cu.id : NEW_CUSTOMER;
    onCustomerChange();
    if (!cu) { $('#f-counterparty').value = name; $('#f-bizno').value = bizNo || ''; }
  }
  // 원계약 후보: 보관함의 계약 완료 묶음(원계약 번호) 중 볼 수 있는 것
  const origins = D.CONTRACTS.filter(function (c) { return c.status === 'ACTIVE' && !c.parentId && C.canView(c, me); });
  $('#f-origin').innerHTML = '<option value="">고르세요</option>' + origins.map(function (c) {
    return '<option value="' + esc(c.id) + '">' + esc(c.id + ' ' + c.counterparty + ' (' + C.serviceLabel(c.services) + ')') + '</option>';
  }).join('');

  /* ---------- 2. 이어서 작성, 보완 후 재기안 (REQ-FLOW-14, REQ-FLOW-17) ---------- */
  const srcId = new URLSearchParams(location.search).get('id');
  const source = srcId ? D.CONTRACTS.find(function (c) {
    return (c.id === srcId || c.draftKey === srcId) && c.requesterId === me.id;
  }) : null;
  let round = 1;
  if (source && source.status === 'REJECTED') {
    round = (source.round || 1) + 1;
    const rej = source.rejection; // 결재 기록에서 계산한 반려 정보 (common.js buildReview)
    setTitle('보완 후 재기안');
    $('#notice').innerHTML = noticeHtml('', (round - 1) + '차 기안이 반려되었습니다',
      '<strong>' + esc(C.roleLabel(rej.role)) + ' 반려 (' + C.fmtDate(rej.at) + ')</strong><br>' + esc(source.rejectReason) +
      '<br>내용을 보완해 ' + round + '차로 기안합니다. ' + (round - 1) + '차 기안 내용과 반려 사유는 그대로 남습니다.', '');
  } else if (source && source.status === 'DRAFT') {
    setTitle('새 계약 등록 (이어서 작성)');
    $('#notice').innerHTML = noticeHtml('', '임시 저장한 계약을 이어서 작성합니다',
      C.fmtDate(source.savedAt) + '에 임시 저장했습니다. 임시 저장한 계약은 나만 볼 수 있습니다.', '');
  }
  function setTitle(t) { $('#page-title').textContent = t; }

  /* ---------- 3. 제품별 금액 (CPQ, REQ-SCOPE-02) ---------- */
  let productSeq = 0;
  function productOptions(selected) {
    return '<option value="">고르세요</option>' + D.PRICE_BOOK.map(function (p) {
      return '<option value="' + p.code + '"' + (p.code === selected ? ' selected' : '') + '>' + esc(p.name) + '</option>';
    }).join('');
  }
  function addProduct(data) {
    data = data || {};
    productSeq += 1;
    const n = productSeq;
    const li = document.createElement('li');
    li.className = 'product-item';
    li.innerHTML =
      '<div class="product-grid">' +
        '<div class="field"><label class="field-label field-label--sm" for="p-code-' + n + '">제품</label>' +
          '<select class="select" id="p-code-' + n + '" data-k="code">' + productOptions(data.code) + '</select></div>' +
        '<div class="field"><label class="field-label field-label--sm" for="p-qty-' + n + '">수량</label>' +
          '<div class="input-unit"><input class="input" id="p-qty-' + n + '" data-k="qty" inputmode="numeric" maxlength="4" value="' + (data.qty || 1) + '"><span class="unit">개</span></div></div>' +
        '<div class="field"><label class="field-label field-label--sm" for="p-amt-' + n + '">계약 금액</label>' +
          '<div class="input-unit"><input class="input" id="p-amt-' + n + '" data-k="amount" inputmode="numeric" value="' + fmtNum(data.amount != null ? data.amount : null) + '"><span class="unit">원</span></div></div>' +
      '</div>' +
      '<div class="field"><label class="field-label field-label--sm" for="p-org-' + n + '">사용 업체 <span class="opt">(선택, 계약 상대방과 다를 때만)</span></label>' +
        '<input class="input" id="p-org-' + n + '" data-k="org" value="' + esc(data.org || '') + '"></div>' +
      '<div class="product-foot"><span class="price-info"></span><span class="price-badge"></span>' +
        '<button type="button" class="btn-text" data-act="remove">이 제품 삭제</button></div>' +
      '<p class="field-error" hidden></p>';
    $('#product-list').appendChild(li);
    refresh();
    return li;
  }
  $('#btn-add-product').addEventListener('click', function () { addProduct().querySelector('select').focus(); });
  $('#product-list').addEventListener('click', function (e) {
    if (e.target.closest('[data-act="remove"]')) { e.target.closest('li').remove(); refresh(); }
  });
  // 금액 칸은 입력하는 동안 숫자만 남기고, 칸을 벗어나면 쉼표를 붙임
  form.addEventListener('focusout', function (e) {
    if (e.target.matches('[data-k="amount"], .yearly-input')) {
      const n = parseNum(e.target.value);
      e.target.value = fmtNum(n);
    }
  });

  function readProducts() {
    return $$('#product-list > li').map(function (li) {
      const code = li.querySelector('[data-k="code"]').value;
      const qty = parseNum(li.querySelector('[data-k="qty"]').value);
      const amount = parseNum(li.querySelector('[data-k="amount"]').value);
      const p = PRICE[code];
      const std = p && qty ? p.listPrice * qty : null;
      const discount = std && amount != null ? Math.max(0, (std - amount) / std) : null;
      return { li: li, code: code, qty: qty, amount: amount, product: p, std: std, discount: discount, cap: p ? p.discountCap : null };
    });
  }

  // 서비스: 계약명 대신 거래처와 함께 계약을 구분하는 값. 넣은 제품의 서비스에서 정해짐 (v0.12)
  function serviceOfProducts() {
    const codes = [];
    readProducts().forEach(function (r) { if (r.product && codes.indexOf(r.product.service) < 0) codes.push(r.product.service); });
    return codes.length ? C.serviceLabel(codes) : '없음';
  }

  /* ---------- 연도별 금액 (REQ-FLOW-21) ---------- */
  function contractYears() {
    const s = toDate(val('startDate')), e = toDate(val('endDate'));
    if (!s || !e || e < s) return [];
    const years = [];
    let from = s;
    while (from <= e) {
      const next = addMonths(from, 12);
      const to = new Date(Math.min(e.getTime(), next.getTime() - 86400000));
      years.push({ from: iso(from), to: iso(to) });
      from = next;
    }
    return years;
  }
  let yearSig = '';
  function renderYearly() {
    const years = contractYears();
    const box = $('#yearly-field');
    box.hidden = years.length <= 1;
    if (years.length <= 1) { yearSig = ''; return; }
    // 기간이 바뀌었을 때만 다시 그림 (입력하는 중에 칸이 사라지지 않게)
    const sig = JSON.stringify(years);
    if (sig === yearSig) { updateYearSum(); return; }
    yearSig = sig;
    const list = $('#yearly-list');
    const old = $$('.yearly-input', list).map(function (i) { return i.value; });
    list.innerHTML = years.map(function (y, i) {
      return '<div class="year-row"><label class="year-label" for="y-' + i + '"><strong>' + (i + 1) + '년차</strong>' +
        C.fmtDate(y.from) + ' ~ ' + C.fmtDate(y.to) + '</label>' +
        '<div class="input-unit"><input class="input yearly-input" id="y-' + i + '" inputmode="numeric" value="' + (old[i] || '') + '"><span class="unit">원</span></div></div>';
    }).join('') + '<p class="year-sum" id="year-sum"></p>';
    updateYearSum();
  }
  function yearlyAmounts() { return $$('.yearly-input').map(function (i) { return parseNum(i.value); }); }
  function updateYearSum() {
    const el = $('#year-sum');
    if (!el) return;
    const sum = yearlyAmounts().reduce(function (a, b) { return a + (b || 0); }, 0);
    el.textContent = '연도별 합계 ' + fmtNum(sum) + '원 / 총액 ' + fmtNum(totalAmount()) + '원';
  }
  function totalAmount() { return readProducts().reduce(function (a, r) { return a + (r.amount || 0); }, 0); }

  /* ---------- 4. 체크리스트 2, 3번 자동 계산 (REQ-CHK-04) ----------
   * 2번(표준단가표 적용): 모든 제품이 표준 단가 그대로면 예, 하나라도 할인이 있으면 아니오
   * 3번(할인율 한도 준수): 모든 제품의 할인율이 그 제품의 한도 이하이면 예
   * 금액이 없는 비밀유지계약(NDA)은 해당 없음 → 영업 검토 생략 */
  function priceCheck(rows) {
    if (!rows.length) {
      return val('type') === NDA
        ? { q2: 'NA', q3: 'NA', d2: '금액이 없는 계약이라 해당되지 않습니다.', d3: '금액이 없는 계약이라 해당되지 않습니다.' }
        : { q2: 'WAIT', q3: 'WAIT', d2: '제품을 넣으면 자동으로 계산됩니다.', d3: '제품을 넣으면 자동으로 계산됩니다.' };
    }
    if (rows.some(function (r) { return !r.product || !r.qty || r.amount == null; })) {
      return { q2: 'WAIT', q3: 'WAIT', d2: '제품, 수량, 계약 금액을 모두 넣으면 계산됩니다.', d3: '제품, 수량, 계약 금액을 모두 넣으면 계산됩니다.' };
    }
    const discounted = rows.filter(function (r) { return r.discount > 0; });
    const over = rows.filter(function (r) { return r.discount > r.cap + 1e-9; });
    return {
      q2: discounted.length ? 'NO' : 'YES',
      q3: over.length ? 'NO' : 'YES',
      d2: discounted.length
        ? discounted.map(function (r) { return r.product.name + ' ' + pct(r.discount) + ' 할인'; }).join(', ')
        : '모든 제품이 표준 단가 그대로입니다.',
      d3: over.length
        ? over.map(function (r) { return r.product.name + ' 할인율 ' + pct(r.discount) + ', 한도 ' + pct(r.cap) + ' 초과'; }).join(', ')
        : (discounted.length ? '할인한 제품 모두 한도 이내입니다.' : '할인이 없습니다.'),
    };
  }
  function answerHtml(v) {
    if (v === 'YES') return '<span class="badge badge--success">예</span>';
    if (v === 'NO') return '<span class="badge badge--danger">아니오</span>';
    if (v === 'NA') return '<span class="badge badge--neutral">해당 없음</span>';
    return '<span class="badge badge--line">계산 대기</span>';
  }

  /* ---------- 5. 결재선 자동 결정 (REQ-CHK-05, 3.5 경우의 수) ---------- */
  function caseNo(q1, q2, q3) {
    if (q2 === 'NA' || !q1 || q2 === 'WAIT') return null;
    if (q1 === 'YES') return q2 === 'YES' ? 1 : (q3 === 'YES' ? 2 : 3);
    return q2 === 'YES' ? 4 : (q3 === 'YES' ? 5 : 6);
  }
  function buildRoute(q1, pc) {
    const personal = val('personalData');
    const legal = q1 === 'YES' ? ['skip', '표준계약서를 그대로 씀'] : q1 === 'NO' ? ['go', '표준계약서를 바꿈'] : ['wait', '체크리스트 1번 답을 기다림'];
    const privacy = personal === 'YES' ? ['go', '개인정보를 처리함'] : personal === 'NO' ? ['skip', '개인정보 처리 없음'] : ['wait', '개인정보 처리 여부를 기다림'];
    let sales;
    if (pc.q2 === 'NA') sales = ['skip', '금액이 없는 계약'];
    else if (pc.q2 === 'YES') sales = ['skip', '표준단가표를 적용함'];
    else if (pc.q2 === 'NO' && pc.q3 === 'YES') sales = ['skip', '할인율 한도 이내'];
    else if (pc.q3 === 'NO') sales = ['go', '할인율 한도를 넘김'];
    else sales = ['wait', '금액 계산을 기다림'];
    const head = D.USERS.u_head;
    return [
      { stage: '2단계 계약 검토 (② 다음 ③, 그 다음 ④와 ⑤ 동시)', items: [
        { no: '②', name: '체크리스트 검토', who: '세일즈어드민', state: 'go', reason: '어떤 경우에도 생략하지 않음' }, // REQ-CHK-02
        { no: '③', name: '영업 검토', who: '부서장 ' + head.name, state: sales[0], reason: sales[1] }, // 가격 예외 승인, 법무보다 먼저 (v0.20)
        { no: '④', name: '법무 검토', who: '법무 ' + D.USERS.u_legal.name, state: legal[0], reason: legal[1] },
        { no: '⑤', name: '개인정보 검토', who: '개인정보 담당 ' + D.USERS.u_privacy.name, state: privacy[0], reason: privacy[1] },
      ] },
      { stage: '3단계 계약 체결', items: [
        { no: '⑥', name: '인장 날인 검토', who: '총무', state: 'go', reason: '기초 정보 확인 후 인장 날인' },
        { no: '⑦', name: '상대방 서명, 체결본 등록', who: '영업 (나)', state: 'go', reason: '서명은 시스템 밖에서' },
        { no: '⑧', name: '체결본 확인', who: '세일즈어드민', state: 'go', reason: '승인된 내용과 같은지 확인' },
      ] },
      { stage: '4단계 운영 검토', items: [
        { no: '⑨', name: '운영 적용', who: 'CEM', state: 'go', reason: '라이선스나 도메인 열기' },
        { no: '⑩', name: '재무 확인', who: '재무 ' + D.USERS.u_finance.name, state: 'go', reason: '회계 인식 (결재선에는 없음)' },
      ] },
      { stage: '5단계 계약 완료', items: [
        { no: '⑪', name: '계약 완료', who: '보관함', state: 'go', reason: '계약 완료 기록으로 보관' },
      ] },
    ];
  }
  const STATE_BADGE = {
    go: '<span class="badge badge--progress">거침</span>',
    skip: '<span class="badge badge--neutral">생략</span>',
    wait: '<span class="badge badge--line">답 대기</span>',
  };
  function routeHtml(route) {
    return route.map(function (g) {
      return '<div class="route-stage"><p class="route-stage-title">' + esc(g.stage) + '</p><ol class="route-list">' +
        g.items.map(function (it) {
          return '<li class="is-' + it.state + '"><span class="route-no" aria-hidden="true">' + it.no + '</span>' +
            '<span><span class="route-name">' + esc(it.name) + '</span><span class="route-who">' + esc(it.who) + '</span>' +
            '<span class="route-reason">' + esc(it.reason) + '</span></span>' + STATE_BADGE[it.state] + '</li>';
        }).join('') + '</ol></div>';
    }).join('');
  }

  /* ---------- 화면 전체 다시 그리기 (입력이 바뀔 때마다) ---------- */
  let current = { route: [], pc: {} };
  function refresh() {
    const rows = readProducts();
    // 제품 줄마다 표준 금액과 할인율 표시
    rows.forEach(function (r) {
      const info = r.li.querySelector('.price-info');
      const badge = r.li.querySelector('.price-badge');
      if (!r.product) { info.textContent = '제품을 고르면 표준 단가가 나옵니다.'; badge.innerHTML = ''; return; }
      info.textContent = '표준 단가 ' + won(r.product.listPrice) + ' (' + r.product.unit + ')' + (r.qty ? ' x ' + r.qty + ' = ' + won(r.std) : '') +
        ', 할인율 한도 ' + pct(r.cap);
      if (r.amount == null || r.discount == null) badge.innerHTML = '<span class="badge badge--line">금액 입력 대기</span>';
      else if (r.discount === 0) badge.innerHTML = '<span class="badge badge--success">표준 단가</span>';
      else if (r.discount > r.cap + 1e-9) badge.innerHTML = '<span class="badge badge--danger">' + pct(r.discount) + ' 할인, 한도 초과</span>';
      else badge.innerHTML = '<span class="badge badge--progress">' + pct(r.discount) + ' 할인, 한도 이내</span>';
    });
    // 총액
    const total = totalAmount();
    $('#amount-total').innerHTML = esc(total ? won(total) : '0원') + (total ? '<span class="exact">' + fmtNum(total) + '원</span>' : '');
    renderYearly();
    // 체크리스트
    const q1 = val('standard');
    $('#q1-result').textContent = q1 === 'YES' ? '④ 법무 검토를 생략합니다.' : q1 === 'NO' ? '④ 법무 검토를 거칩니다.' : '';
    // 4번: 결재선은 그대로, 기안하면 재무에 이메일로 알림 (REQ-CHK-08, REQ-ENV-10)
    const q4 = val('accounting');
    $('#q4-result').textContent = q4 === 'YES' ? '기안하면 재무 ' + D.USERS.u_finance.name + '님에게 이메일로 알립니다. 결재선은 바뀌지 않습니다.' : '';
    const pc = priceCheck(rows);
    $('#q2-answer').innerHTML = answerHtml(pc.q2);
    $('#q2-detail').textContent = pc.d2;
    $('#q3-answer').innerHTML = answerHtml(pc.q3);
    $('#q3-detail').textContent = pc.d3;
    const cn = caseNo(q1, pc.q2, pc.q3);
    const route = buildRoute(q1, pc);
    const reviews = route[0].items.filter(function (i) { return i.state === 'go'; }).map(function (i) { return i.name; });
    const passText = '계약 검토에서 거치는 단계는 ' + esc(reviews.join(', ')) + '입니다.';
    $('#case-summary').innerHTML = cn
      ? '<strong>경우 ' + cn + '</strong>: ' + passText // 경우의 수: 요구사항 정의서 3.5
      : (pc.q2 === 'NA' && q1 ? '<strong>금액이 없는 계약</strong>: ' + passText : '');
    $('#route').innerHTML = routeHtml(route);
    current = { route: route, pc: pc, q1: q1, total: total };
  }
  form.addEventListener('input', function (e) {
    if (e.target.id === 'f-bizno') e.target.value = formatBizNo(e.target.value);
    clearError(e.target);
    refresh();
    updateYearSum();
  });
  form.addEventListener('change', function (e) {
    clearError(e.target);
    if (e.target.name === 'kind') onKindChange();
    if (e.target.id === 'f-origin') onOriginChange();
    if (e.target.id === 'f-customer') onCustomerChange();
    if (e.target.id === 'f-service-diff') $('#service-fields').hidden = !e.target.checked;
    if (e.target.name === 'autoRenew') $('#notice-days-field').hidden = val('autoRenew') !== 'YES';
    refresh();
  });

  function formatBizNo(v) {
    const d = v.replace(/[^0-9]/g, '').slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 5) return d.slice(0, 3) + '-' + d.slice(3);
    return d.slice(0, 3) + '-' + d.slice(3, 5) + '-' + d.slice(5);
  }

  /* ---------- 변경, 갱신: 원계약 고르기 (REQ-FLOW-18) ---------- */
  function onKindChange() {
    const kind = val('kind');
    $('#origin-field').hidden = kind === 'NEW';
    onOriginChange();
  }
  function bundleNumber() {
    const kind = val('kind');
    const origin = $('#f-origin').value;
    if (kind === 'NEW' || !origin) return null;
    return C.nextChildId(origin, kind); // 예: CT-2026-0105-A02 (common.js)
  }
  function onOriginChange() {
    const help = $('#origin-help');
    const no = bundleNumber();
    help.textContent = no
      ? '기안하면 ' + no + '(' + D.KINDS[val('kind')] + ' ' + no.slice(-2).replace(/^0/, '') + '차)로 원계약과 함께 묶입니다.'
      : '보관함에 있는 계약 중에서 고릅니다. 원계약 번호에 차수가 붙어 함께 묶입니다.';
    // 원계약을 고르면 거래처와 계약 유형을 미리 채움 (비어 있을 때만). 계약명은 두지 않음 (v0.12)
    const o = D.CONTRACTS.find(function (c) { return c.id === $('#f-origin').value; });
    if (o) {
      if (!$('#f-customer').value) pickCustomerByName(o.counterparty);
      if (!$('#f-type').value) $('#f-type').value = o.type;
    }
  }

  /* ---------- 파일 첨부 (KRDS 파일 업로드, 프로토타입은 이름만) ---------- */
  const files = { draft: [], quote: [] };
  function fmtSize(b) { return b >= 1048576 ? (b / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(b / 1024)) + 'KB'; }
  function renderFiles(key) {
    $('#' + key + '-list').innerHTML = files[key].map(function (f, i) {
      return '<li><span><span class="file-name">' + esc(f.name) + '</span><span class="file-size">' + fmtSize(f.size) + '</span></span>' +
        '<button type="button" class="btn-text" data-file="' + key + '" data-i="' + i + '">삭제</button></li>';
    }).join('');
  }
  function addFiles(key, list) {
    Array.prototype.forEach.call(list, function (f) { files[key].push({ name: f.name, size: f.size }); });
    if (key === 'quote') files.quote = files.quote.slice(-1);
    renderFiles(key);
    if (key === 'draft') clearError($('#f-draft'));
  }
  [['draft', '#f-draft'], ['quote', '#f-quote']].forEach(function (pair) {
    $(pair[1]).addEventListener('change', function (e) { addFiles(pair[0], e.target.files); e.target.value = ''; });
  });
  $$('.file-drop').forEach(function (drop) {
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('is-dragover'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('is-dragover'); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('is-dragover'); addFiles(drop.dataset.target, e.dataTransfer.files); });
  });
  form.addEventListener('click', function (e) {
    const b = e.target.closest('[data-file]');
    if (!b) return;
    files[b.dataset.file].splice(Number(b.dataset.i), 1);
    renderFiles(b.dataset.file);
  });

  /* ---------- 6. 필수 항목 검사 (KRDS 오류 패턴) ---------- */
  function fieldBox(name) { return form.querySelector('[data-field="' + name + '"]'); }
  function setError(name, msg, focusEl) {
    const box = fieldBox(name);
    if (!box) return null;
    box.classList.add('is-invalid');
    const err = box.querySelector(':scope > .field-error');
    if (err) { err.hidden = false; err.innerHTML = C.icon('alert', 'sm') + '<span>' + esc(msg) + '</span>'; }
    return focusEl || box.querySelector('input:not([type=hidden]), select, textarea');
  }
  function clearError(el) {
    const box = el && el.closest && el.closest('[data-field], .product-item');
    if (!box || !box.classList.contains('is-invalid')) return;
    box.classList.remove('is-invalid');
    const err = box.querySelector(':scope > .field-error');
    if (err) err.hidden = true;
  }
  function clearAllErrors() {
    $$('.is-invalid', form).forEach(function (b) { b.classList.remove('is-invalid'); });
    $$('.field-error', form).forEach(function (e) { e.hidden = true; });
  }

  function validate() {
    clearAllErrors();
    const errors = [];
    function need(cond, name, msg, el) {
      if (cond) return;
      const target = setError(name, msg, el);
      errors.push({ msg: msg, target: target });
    }
    const kind = val('kind');
    need(!!kind, 'kind', '계약 구분을 고르세요.');
    if (kind && kind !== 'NEW') need(!!$('#f-origin').value, 'origin', '원계약을 고르세요.');
    need(!!val('customer'), 'customer', '거래처를 고르세요. 목록에 없으면 새 거래처 등록을 고릅니다.');
    if (val('customer') === NEW_CUSTOMER) {
      need(!!val('counterparty'), 'counterparty', '거래처 상호를 입력하세요.');
      const dupCu = D.CUSTOMERS.filter(function (cu) { return cu.bizNo === val('bizNo'); })[0];
      need(/^\d{3}-\d{2}-\d{5}$/.test(val('bizNo')), 'bizNo', '사업자등록번호 10자리를 입력하세요.');
      if (/^\d{3}-\d{2}-\d{5}$/.test(val('bizNo'))) need(!dupCu, 'bizNo', '이미 등록된 사업자등록번호입니다(' + (dupCu ? dupCu.name : '') + '). 거래처 목록에서 고르세요.');
    }
    need(!!val('type'), 'type', '계약 유형을 고르세요.');
    need(!!val('method'), 'method', '계약 방식을 고르세요.');
    need(!!val('contractDate'), 'contractDate', '계약일을 입력하세요.');
    need(!!val('startDate'), 'startDate', '계약 시작일을 입력하세요.');
    need(!!val('endDate'), 'endDate', '계약 종료일을 입력하세요.');
    if (val('startDate') && val('endDate')) need(val('endDate') >= val('startDate'), 'endDate', '종료일은 시작일보다 뒤여야 합니다.');
    if ($('#f-service-diff').checked) {
      need(!!val('serviceStart'), 'serviceStart', '서비스 시작일을 입력하세요.');
      need(!!val('serviceEnd'), 'serviceEnd', '서비스 종료일을 입력하세요.');
    }
    need(!!val('autoRenew'), 'autoRenew', '자동갱신 여부를 고르세요.');
    if (val('autoRenew') === 'YES') need(!!parseNum(val('noticeDays')), 'noticeDays', '해지 통지 기한(만료 며칠 전)을 입력하세요.');
    need(!!val('personalData'), 'personalData', '개인정보 처리 여부를 고르세요.');

    // 제품: 비밀유지계약이 아니면 1개 이상, 줄마다 제품, 수량, 금액
    const rows = readProducts();
    if (!rows.length && val('type') !== NDA) need(false, 'products', '제품을 1개 이상 넣으세요.', $('#btn-add-product'));
    rows.forEach(function (r, i) {
      if (r.product && r.qty && r.amount != null) return;
      r.li.classList.add('is-invalid');
      const err = r.li.querySelector(':scope > .field-error');
      const msg = (i + 1) + '번째 제품의 제품, 수량, 계약 금액을 모두 넣으세요.';
      err.hidden = false;
      err.innerHTML = C.icon('alert', 'sm') + '<span>' + esc(msg) + '</span>';
      errors.push({ msg: msg, target: r.li.querySelector(!r.product ? 'select' : (!r.qty ? '[data-k="qty"]' : '[data-k="amount"]')) });
    });
    // 연도별 금액 합계 = 총액
    if (!$('#yearly-field').hidden) {
      const ys = yearlyAmounts();
      const sum = ys.reduce(function (a, b) { return a + (b || 0); }, 0);
      need(ys.every(function (y) { return y != null; }) && sum === totalAmount(), 'yearly',
        '연도별 금액을 모두 넣고, 합계를 총액(' + fmtNum(totalAmount()) + '원)과 맞추세요.');
    }
    need(!!val('settlement'), 'settlement', '정산 방식을 고르세요.');

    // 체크리스트: 1번은 직접 답, "아니오"인 문항은 비고(사유) 필수 (panda p.9)
    need(!!val('standard'), 'standard', '체크리스트 1번에 답하세요.');
    if (val('standard') === 'NO') need(!!val('standardNote'), 'standardNote', '1번이 "아니오"이면 비고에 바꾼 조항과 이유를 적으세요.');
    if (current.pc.q2 === 'NO') need(!!val('priceNote'), 'priceNote', '2번이 "아니오"이면 비고에 표준 단가와 다르게 정한 이유를 적으세요.');
    if (current.pc.q3 === 'NO') need(!!val('capNote'), 'capNote', '3번이 "아니오"이면 비고에 할인율 한도를 넘긴 영업적 사유를 적으세요.');
    need(!!val('accounting'), 'accounting', '체크리스트 4번에 답하세요.');
    if (val('accounting') === 'YES') need(!!val('accountingNote'), 'accountingNote', '4번이 "예"이면 비고에 어떤 조건인지 적으세요.');

    need(files.draft.length > 0, 'draftFile', '계약서 초안을 첨부하세요.', $('#f-draft'));
    return errors;
  }

  function showErrorSummary(errors) {
    const box = $('#error-summary');
    box.hidden = false;
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
    box.scrollIntoView({ block: 'start' });
  }

  /* ---------- 7. 임시 저장, 기안 ---------- */
  $('#btn-save').addEventListener('click', function () {
    C.toast('임시 저장했습니다. 임시 저장한 계약은 나만 볼 수 있습니다. (프로토타입이라 실제로 저장되지는 않습니다)');
  });

  function newNumber() {
    if (source && source.status === 'REJECTED') return source.id;
    const bundle = bundleNumber();
    if (bundle) return bundle;
    const max = D.CONTRACTS.reduce(function (m, c) {
      const mm = /^CT-2026-(\d{4})$/.exec(c.id || '');
      return mm ? Math.max(m, Number(mm[1])) : m;
    }, 0);
    return 'CT-2026-' + String(max + 1).padStart(4, '0');
  }

  const modal = $('#confirm-modal');
  let lastFocus = null;
  function openModal() {
    const goes = [];
    current.route.forEach(function (g) {
      g.items.forEach(function (i) { if (g.stage.indexOf('2단계') === 0 && i.state === 'go') goes.push(i.no + ' ' + i.name); });
    });
    const rows = [
      ['거래처', val('counterparty')],
      ['서비스', serviceOfProducts()],
      ['계약 금액', current.total ? won(current.total) + ' (부가세 별도)' : '금액 없음'],
      ['계약 기간', C.fmtDate(val('startDate')) + ' ~ ' + C.fmtDate(val('endDate'))],
      ['계약 검토', goes.join(', ')],
      ['재무 알림', val('accounting') === 'YES' ? '재무에 이메일로 알림 (결재선 아님)' : '없음'],
      ['기안 차수', round + '차' + (val('restricted') ? ', 열람 제한' : '')],
    ];
    $('#confirm-body').innerHTML = '<p>기안하면 ② 체크리스트 검토부터 시작되고, 기안한 내용은 결재가 끝날 때까지 고칠 수 없습니다.</p>' +
      '<dl class="confirm-list">' + rows.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl>';
    lastFocus = document.activeElement;
    modal.hidden = false;
    modal.querySelector('[data-act="confirm"]').focus();
  }
  function closeModal() { modal.hidden = true; if (lastFocus) lastFocus.focus(); }
  modal.addEventListener('click', function (e) {
    if (e.target === modal || e.target.closest('[data-act="cancel"]')) closeModal();
    if (e.target.closest('[data-act="confirm"]')) { closeModal(); done(); }
  });
  document.addEventListener('keydown', function (e) {
    if (modal.hidden) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Tab') { // 확인 창 안에서만 이동
      const f = $$('button', modal);
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    refresh();
    const errors = validate();
    if (errors.length) { showErrorSummary(errors); return; }
    $('#error-summary').hidden = true;
    openModal();
  });

  function done() {
    const no = newNumber();
    form.hidden = true;
    $('#error-summary').hidden = true;
    $('#notice').innerHTML = noticeHtml('success', '기안했습니다',
      '계약번호 <strong>' + esc(no) + '</strong> (' + round + '차 기안, 프로토타입 예시 번호)<br>' +
      '다음 단계: ② 체크리스트 검토 (세일즈어드민). 진행 상황은 개요의 계약 진행 현황에서 볼 수 있습니다.<br>' +
      '프로토타입이라 실제로 저장되지는 않습니다.',
      '<a class="btn btn--primary btn--md" href="index.html">개요로 가기</a><a class="btn btn--tertiary btn--md" href="new-contract.html">새 계약 하나 더 등록</a>');
    window.scrollTo(0, 0);
    C.toast('기안했습니다. (프로토타입)');
  }

  /* ---------- 미리 채우기 (이어서 작성, 보완 후 재기안) ---------- */
  if (source) {
    const f = source.form || {};
    setRadio('kind', source.kind || 'NEW');
    pickCustomerByName(source.counterparty, f.bizNo);
    $('#f-opportunity').value = f.opportunity || '';
    $('#f-type').value = source.type || '';
    setRadio('method', f.method);
    $('#f-contract-date').value = f.contractDate || '';
    $('#f-start').value = f.startDate || '';
    $('#f-end').value = f.endDate || '';
    setRadio('autoRenew', f.autoRenew);
    $('#notice-days-field').hidden = f.autoRenew !== 'YES';
    $('#f-notice-days').value = f.noticeDays || '';
    setRadio('personalData', source.personalData ? 'YES' : 'NO');
    $('#f-restricted').checked = !!source.restricted;
    setRadio('settlement', f.settlement);
    if (f.checklist) {
      setRadio('standard', f.checklist.standard); $('#f-standard-note').value = f.checklist.standardNote || '';
      setRadio('accounting', f.checklist.accounting); $('#f-accounting-note').value = f.checklist.accountingNote || '';
    }
    $('#f-memo').value = f.memo || '';
    (f.products || []).forEach(function (p) { addProduct(p); });
    if (source.status === 'REJECTED') { files.draft.push({ name: source.counterparty + ' 계약서 1차 기안본.docx', size: 84000 }); renderFiles('draft'); }
  }
  // 계약 상세, 만료 예정에서 "변경 기안", "갱신 기안"으로 들어오면 구분과 원계약을 미리 고름
  //   new-contract.html?kind=AMEND&origin=CT-2026-0105 (REQ-ARC-02, 05)
  const pre = new URLSearchParams(location.search);
  if (!source && ['AMEND', 'RENEW'].indexOf(pre.get('kind')) > -1) {
    setRadio('kind', pre.get('kind'));
    if (origins.some(function (c) { return c.id === pre.get('origin'); })) $('#f-origin').value = pre.get('origin');
  }
  if (!$$('#product-list > li').length) addProduct();
  onKindChange();
  refresh();
})();
