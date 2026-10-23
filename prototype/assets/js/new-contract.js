/* =====================================================================
 * SCR-11 새 계약 등록 화면 로직 (new-contract.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: 요구사항 정의서 3.4(입력 항목), 3.5(체크리스트와 결재선),
 *   REQ-FLOW-14(임시 저장, 기안), REQ-FLOW-17(재기안은 다음 차수), REQ-FLOW-18(변경, 연장 묶음 번호),
 *   REQ-SCOPE-02, REQ-CHK-04(가격 기준으로 체크리스트 2, 3번 자동 계산), REQ-CHK-05(결재선 자동)
 * 하는 일
 *   1. 영업만 쓸 수 있게 막기
 *   2. 이어서 작성(임시 저장 건), 보완 후 재기안(반려 건)일 때 값 미리 채우기
 *   3. 제품별 금액 줄 추가, 삭제와 총액, 연도별 금액 계산 (v0.49: 줄마다 제품 → 기능)
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
  // v0.34: 계약 유형을 없앰. v0.41: 금전 거래가 있는 계약만 등록하고 비밀유지계약 등은 부속 서류로 첨부
  const PRICE = {};
  D.PRICE_BOOK.forEach(function (p) { PRICE[p.feature] = p; }); // 가격 기준: 기능마다 하나(v0.49)

  /* ---------- 숫자와 날짜 도우미 ---------- */
  function parseNum(v) {
    const n = String(v == null ? '' : v).replace(/[^0-9]/g, '');
    return n ? parseInt(n, 10) : null;
  }
  function fmtNum(n) { return n == null ? '' : n.toLocaleString('ko-KR'); }
  const krw = C.fmtKRW; // "4,800만 원"처럼 읽기 쉬운 금액(표의 금액 칸은 C.fmtWon)
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

  /* ---------- 1. 영업만 쓸 수 있음 (REQ-AUTH-04, 4.1). 최고관리자는 모든 화면을 볼 수 있음 (v0.16) ---------- */
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
  $('#f-owner').value = C.ownerLabel(me.id); // "경영지원유닛 원지안" (님 없이, v0.32)
  // 계약 방식(직접, 조달, 간접), 정산 방식: 코드 관리(SCR-56)에서 사용 중인 코드만 고름 (계약 유형은 v0.34에서 없앰)
  $('#method-choices').innerHTML = C.codeList('METHOD').map(function (c) {
    return '<label class="choice"><input type="radio" name="method" value="' + c.code + '">' + esc(c.label) + '</label>';
  }).join('');
  $('#settlement-choices').innerHTML = C.codeList('SETTLEMENT').map(function (c) {
    return '<label class="choice"><input type="radio" name="settlement" value="' + c.code + '">' + esc(c.label) + '</label>';
  }).join('');
  // 기준 표준계약서 (v0.53, REQ-CHK-09): 지금 판이 있는 표준계약서 + 상대방 양식. 기안하면 고른 것과 오늘의 판이 계약에 남음
  function templatePick() {
    const id = val('template');
    if (!id) return null;
    if (id === 'OWN') return { id: 'OWN' };
    const t = D.TEMPLATES.filter(function (x) { return x.id === id; })[0], v = t && C.templateVersionAt(t, D.TODAY);
    return t && v ? { id: id, no: v.no, label: t.name + ' 판 ' + v.no } : null;
  }
  $('#f-template').innerHTML = '<option value="">고르세요</option>' + D.TEMPLATES.map(function (t) {
    const v = C.templateVersionAt(t, D.TODAY);
    return v ? '<option value="' + esc(t.id) + '">' + esc(t.name + ' (판 ' + v.no + ', ' + C.fmtDate(v.from) + '부터)') + '</option>' : '';
  }).join('') + '<option value="OWN">상대방 양식(표준계약서 없음)</option>';
  /* 거래처 검색 (REQ-REG-18, 기획자 요청 v0.32)
   *   상호나 사업자등록번호 일부로 우리 거래처 목록과 사업자 정보 DB(공공데이터 내재화)를 함께 찾음 (C.searchBusinesses)
   *   고르면 상호와 사업자등록번호가 채워지고 잠김. DB에서 고른 곳은 기안할 때 거래처 목록에 함께 등록
   *   검색 결과가 없으면 "직접 입력하기"로 상호와 사업자등록번호를 넣음
   *   선택 값(name="customer"): 'C:거래처 번호' 우리 거래처 / 'R:사업자등록번호' DB / 'NEW' 직접 입력
   * 프로토타입: 새 거래처는 기안할 때 함께 등록되는 것으로 안내만 함. 실제 시스템은 서버가 사업자등록번호 중복과 상태를 다시 검사 */
  const NEW_CUSTOMER = 'NEW';
  const HELP_SEARCH = '상호나 사업자등록번호 일부를 넣어 찾습니다. 우리 거래처와 ' + D.BIZ_REGISTRY_INFO.source + '(' +
    C.fmtDate(D.BIZ_REGISTRY_INFO.refreshedAt) + ' 기준)를 함께 찾고, 고르면 상호와 사업자등록번호가 채워집니다. 찾는 곳이 없으면 직접 입력합니다.';
  const qInput = $('#f-customer-q'), panel = $('#customer-panel'), list = $('#customer-list');
  $('#customer-icon').innerHTML = C.icon('search', 'sm');
  $('#customer-help').textContent = HELP_SEARCH;
  let results = [], active = -1;
  function setCustomer(key, name, bizNo, unit) {
    $('#f-customer').value = key;
    if (unit) $('#f-unit').value = unit; // 이어서 작성, 재기안, 원계약에서 기관 또는 부서명도 채움 (v0.46)
    const manual = key === NEW_CUSTOMER;
    $('#f-counterparty').readOnly = !manual;
    $('#f-bizno').readOnly = !manual;
    $('#f-counterparty').value = name || '';
    $('#f-bizno').value = C.fmtBizNo(bizNo); // 000-00-00000 (v0.34)
    bizWarn();
    // 지시문은 예시 글자에 두지 않고 거래처 칸 도움말에 둠 (KRDS, v0.28)
    $('#f-counterparty').placeholder = key && !manual ? '' : '예: 삼성전자 주식회사'; // 예시 (v0.42 기획자 지정)
    $('#customer-help').innerHTML = !key ? esc(HELP_SEARCH)
      : manual ? '검색되지 않는 거래처라 사업자등록증을 보고 직접 넣습니다. 기안하면 거래처 목록에 함께 등록됩니다. <button type="button" class="btn-text" id="customer-research">다시 검색</button>'
      : key.indexOf('R:') === 0 ? '사업자 정보 DB에서 찾은 곳입니다. 아직 우리 거래처가 아니라서 기안하면 거래처 목록에 함께 등록됩니다.'
      : '우리 거래처 목록에 있는 곳입니다.';
  }
  /* ---------- 기관 또는 부서명 (C-24 v0.39, v0.46 기획자 결정) ----------
   * 고르는 목록 없이 직접 적는 칸만. 기관 이름은 고유 번호가 없어 맞는지 확인할 수 없으므로 이 계약에만 남기고 거래처에 쌓지 않음. 비워도 됨 */
  function unitValue() { return val('unit'); }
  function closePanel() {
    panel.hidden = true;
    qInput.setAttribute('aria-expanded', 'false');
    qInput.removeAttribute('aria-activedescendant');
    active = -1;
  }
  function renderResults() {
    const q = qInput.value.trim();
    results = C.searchBusinesses(q, 8);
    active = -1;
    qInput.removeAttribute('aria-activedescendant');
    if (!q) { closePanel(); $('#customer-status').textContent = ''; return; }
    list.innerHTML = results.map(function (r, i) {
      return '<li role="option" id="cu-opt-' + i + '" class="combo-option" data-i="' + i + '" aria-selected="false">' +
        '<span class="combo-name">' + esc(r.name) + '</span><span class="combo-meta">' + esc(r.bizNo) + '</span>' +
        C.badge(r.kind === 'C' ? 'success' : 'line', r.kind === 'C' ? '거래처' : '사업자 DB') + '</li>';
    }).join('');
    list.hidden = !results.length;
    $('#customer-empty').hidden = !!results.length;
    $('#customer-empty-text').textContent = '"' + q + '" 검색 결과가 없습니다. 사업자등록증을 보고 직접 넣을 수 있습니다.';
    panel.hidden = false;
    qInput.setAttribute('aria-expanded', 'true');
    $('#customer-status').textContent = results.length ? '검색 결과 ' + results.length + '건. 위아래 화살표로 고릅니다.' : '검색 결과가 없습니다.';
  }
  function choose(i) {
    const r = results[i];
    if (!r) return;
    qInput.value = r.name;
    setCustomer(r.key, r.name, r.bizNo);
    closePanel();
    clearError(qInput);
    refresh();
  }
  function moveActive(step) {
    if (!results.length) return;
    active = (active + step + results.length) % results.length;
    Array.prototype.forEach.call(list.children, function (li, i) { li.setAttribute('aria-selected', String(i === active)); });
    qInput.setAttribute('aria-activedescendant', 'cu-opt-' + active);
    list.children[active].scrollIntoView({ block: 'nearest' });
  }
  function startManual() {
    qInput.value = '';
    setCustomer(NEW_CUSTOMER, '', '');
    closePanel();
    $('#f-counterparty').focus();
  }
  qInput.addEventListener('input', function () {
    // 검색어를 바꾸면 고른 거래처를 지움
    if ($('#f-customer').value) setCustomer('', '', '');
    renderResults();
  });
  qInput.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (panel.hidden) renderResults(); moveActive(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
    else if (e.key === 'Enter' && !panel.hidden) { e.preventDefault(); if (active > -1) choose(active); else if (results.length === 1) choose(0); }
    else if (e.key === 'Escape' && !panel.hidden) { e.stopPropagation(); closePanel(); }
  });
  list.addEventListener('mousedown', function (e) { e.preventDefault(); }); // 고르기 전에 입력 칸 포커스가 빠지지 않게
  list.addEventListener('click', function (e) { const li = e.target.closest('[data-i]'); if (li) choose(Number(li.getAttribute('data-i'))); });
  $('#customer-manual').addEventListener('click', startManual);
  $('#customer-help').addEventListener('click', function (e) {
    if (e.target.id === 'customer-research') { setCustomer('', '', ''); qInput.value = ''; qInput.focus(); }
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('#customer-combo')) closePanel(); });
  // 상호로 거래처 고르기 (이어서 작성, 재기안, 원계약에서 미리 채우기). 없으면 직접 입력으로
  function pickCustomerByName(name, bizNo, unit) {
    if (!name) return;
    const r = C.searchBusinesses(name, 50).filter(function (x) { return x.name === name; })[0];
    qInput.value = r ? r.name : '';
    if (r) setCustomer(r.key, r.name, r.bizNo, unit);
    else { setCustomer(NEW_CUSTOMER, name, bizNo || '', unit); }
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
      '<strong>' + esc(C.roleShort(rej.role)) + ' 반려 (' + C.fmtDate(rej.at) + ')</strong><br>' + esc(source.rejectReason) +
      '<br>내용을 보완해 ' + round + '차로 기안합니다. ' + (round - 1) + '차 기안 내용과 반려 사유는 그대로 남습니다.', '');
  } else if (source && source.status === 'DRAFT') {
    setTitle('새 계약 등록 (이어서 작성)');
    $('#notice').innerHTML = noticeHtml('', '임시 저장한 계약을 이어서 작성합니다',
      C.fmtDate(source.savedAt) + '에 임시 저장했습니다. 임시 저장한 계약은 나만 볼 수 있습니다.', '');
  }
  function setTitle(t) { $('#page-title').textContent = t; }

  /* ---------- 3. 제품별 금액 (CPQ, REQ-SCOPE-02) ----------
   * 서비스 > 제품 > 기능 = 대분류 > 중분류 > 소분류(v0.56 기획자 결정). 서비스는 CK, HR, 기타 세 가지. 가격은 기능마다 하나(v0.49에 플랜을 없앰)
   *   줄마다 제품 → 기능을 차례로 고름. 제품 목록은 서비스(CK, HR, 기타)마다 묶어 보임. 계약의 서비스는 고른 제품의 서비스
   *   고를 수 있는 것: 사용 중인 제품과 기능 중 오늘 적용되는 가격(PRICE_BOOK)이 있는 것. 기능이 하나뿐이면 저절로 고름
   *   저장하는 값은 기능(feature), 수량, 금액, 사용 업체. 이어서 작성할 때는 기능에서 제품을 다시 채움 */
  let productSeq = 0;
  // 고를 수 있는 기능의 가격 줄 (제품과 기능이 사용 중이고 서비스가 있는 것)
  function livePrices() {
    return D.PRICE_BOOK.filter(function (r) {
      const p = D.PRODUCTS.filter(function (x) { return x.id === r.product; })[0];
      const f = D.FEATURES.filter(function (x) { return x.id === r.feature; })[0];
      return p && p.use && f && f.use && D.SERVICES[p.service];
    });
  }
  function optionsHtml(list, selected, empty) {
    return '<option value="">' + esc(empty) + '</option>' + list.map(function (o) {
      return '<option value="' + esc(o[0]) + '"' + (o[0] === selected ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('');
  }
  // 제품 고르기: 서비스(대분류)마다 묶어 보임(v0.56 기획자 결정: 서비스 > 제품 > 기능). 묶음 순서는 코드 관리의 서비스 순서
  function productOptions(selected) {
    const prices = livePrices();
    const live = D.PRODUCTS.filter(function (p) { return prices.some(function (r) { return r.product === p.id; }); });
    return '<option value="">고르세요</option>' + C.codeList('SERVICE', true).map(function (s) {
      const items = live.filter(function (p) { return p.service === s.code; });
      return items.length ? '<optgroup label="' + esc(s.label) + '">' + items.map(function (p) {
        return '<option value="' + esc(p.id) + '"' + (p.id === selected ? ' selected' : '') + '>' + esc(p.name) + '</option>';
      }).join('') + '</optgroup>' : '';
    }).join('');
  }
  // 고른 제품에 맞춰 기능 칸을 다시 채움
  function syncPick(li) {
    const sp = li.querySelector('[data-k="product"]'), sf = li.querySelector('[data-k="feature"]');
    const prices = livePrices();
    const pid = sp.value;
    let fid = sf.value;
    const feats = pid ? D.FEATURES.filter(function (f) { return f.product === pid && prices.some(function (r) { return r.feature === f.id; }); }) : [];
    if (!feats.some(function (f) { return f.id === fid; })) fid = feats.length === 1 ? feats[0].id : '';
    sf.innerHTML = optionsHtml(feats.map(function (f) { return [f.id, f.name]; }), fid, pid ? '고르세요' : '제품을 먼저 고르세요');
    sf.disabled = !pid;
  }
  function addProduct(data) {
    data = data || {};
    productSeq += 1;
    const n = productSeq;
    const price = PRICE[data.feature]; // 이어서 작성, 재기안: 기능에서 제품을 찾음
    const li = document.createElement('li');
    li.className = 'product-item';
    li.innerHTML =
      '<div class="product-pick">' +
        '<div class="field"><label class="field-label field-label--sm" for="p-prod-' + n + '">제품</label>' +
          '<select class="select" id="p-prod-' + n + '" data-k="product">' + productOptions(price ? price.product : '') + '</select></div>' +
        '<div class="field"><label class="field-label field-label--sm" for="p-feat-' + n + '">기능</label>' +
          '<select class="select" id="p-feat-' + n + '" data-k="feature">' + optionsHtml(price ? [[price.feature, C.featureName(price.feature)]] : [], price ? price.feature : '', '제품을 먼저 고르세요') + '</select></div>' +
      '</div>' +
      '<div class="product-grid">' +
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
    syncPick(li);
    refresh();
    return li;
  }
  $('#btn-add-product').addEventListener('click', function () { addProduct().querySelector('select').focus(); });
  $('#product-list').addEventListener('click', function (e) {
    if (e.target.closest('[data-act="remove"]')) { e.target.closest('li').remove(); refresh(); }
  });
  // 제품을 바꾸면 기능 칸을 다시 채움 (폼 전체의 change보다 먼저 돌아 계산에 새 기능이 쓰임)
  $('#product-list').addEventListener('change', function (e) {
    if (e.target.matches('[data-k="product"]')) syncPick(e.target.closest('li'));
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
      const feature = li.querySelector('[data-k="feature"]').value;
      const qty = parseNum(li.querySelector('[data-k="qty"]').value);
      const amount = parseNum(li.querySelector('[data-k="amount"]').value);
      const p = PRICE[feature];
      const std = p && qty ? p.listPrice * qty : null;
      const discount = std && amount != null ? Math.max(0, (std - amount) / std) : null;
      return { li: li, feature: feature, qty: qty, amount: amount, product: p, std: std, discount: discount, cap: p ? p.discountCap : null };
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
    if (box.hidden) { yearSig = ''; return; }
    // 기간이 바뀌었을 때만 다시 그림 (입력하는 중에 칸이 사라지지 않게)
    const sig = JSON.stringify(years);
    if (sig === yearSig) { updateYearSum(); return; }
    yearSig = sig;
    const list = $('#yearly-list');
    const old = $$('.yearly-input', list).map(function (i) { return i.value; });
    list.innerHTML = years.map(function (y, i) {
      return '<div class="year-row"><label class="year-label" for="y-' + i + '"><strong>' + (i + 1) + '년 차</strong>' +
        C.fmtPeriod(y.from, y.to) + '</label>' +
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
   * 2번(표준단가표 적용): 모든 줄이 표준 단가 그대로면 예, 하나라도 할인이 있으면 아니요
   * 3번(할인율 한도 준수): 모든 줄의 할인율이 그 기능의 한도 이하이면 예 (v0.49: 한도는 기능마다)
   * 모든 계약에는 제품과 금액이 있음(v0.41: 금액이 없는 계약은 플랫폼에 등록하지 않음) */
  function priceCheck(rows) {
    if (!rows.length) return { q2: 'WAIT', q3: 'WAIT', d2: '제품을 넣으면 자동으로 계산됩니다.', d3: '제품을 넣으면 자동으로 계산됩니다.' };
    if (rows.some(function (r) { return !r.product || !r.qty || r.amount == null; })) {
      const msg = '제품, 기능, 수량, 계약 금액을 모두 넣으면 계산됩니다.';
      return { q2: 'WAIT', q3: 'WAIT', d2: msg, d3: msg };
    }
    const discounted = rows.filter(function (r) { return r.discount > 0; });
    const over = rows.filter(function (r) { return r.discount > r.cap + 1e-9; });
    return {
      q2: discounted.length ? 'NO' : 'YES',
      q3: over.length ? 'NO' : 'YES',
      d2: discounted.length
        ? discounted.map(function (r) { return C.featureLabel(r.product) + ' ' + pct(r.discount) + ' 할인'; }).join(', ')
        : '모든 제품이 표준 단가 그대로입니다.',
      d3: over.length
        ? over.map(function (r) { return C.featureLabel(r.product) + ' 할인율 ' + pct(r.discount) + ', 한도 ' + pct(r.cap) + ' 초과'; }).join(', ')
        : (discounted.length ? '할인한 제품 모두 한도 이내입니다.' : '할인이 없습니다.'),
    };
  }
  function answerHtml(v) {
    if (v === 'YES') return '<span class="badge badge--success">예</span>';
    if (v === 'NO') return '<span class="badge badge--danger">아니요</span>';
    if (v === 'NA') return '<span class="badge badge--neutral">해당 없음</span>';
    return '<span class="badge badge--line">계산 대기</span>';
  }

  /* ---------- 5. 결재선 자동 결정 (REQ-CHK-05, 3.5 경우의 수) ---------- */
  function caseNo(q1, q2, q3) {
    if (!q1 || q2 === 'WAIT') return null;
    if (q1 === 'YES') return q2 === 'YES' ? 1 : (q3 === 'YES' ? 2 : 3);
    return q2 === 'YES' ? 4 : (q3 === 'YES' ? 5 : 6);
  }
  function buildRoute(q1, pc) {
    const personal = val('personalData');
    const legal = q1 === 'YES' ? ['skip', '표준계약서를 그대로 씀'] : q1 === 'NO' ? ['go', '표준계약서를 바꿈'] : ['wait', '체크리스트 1번 답을 기다림'];
    const privacy = personal === 'YES' ? ['go', '개인정보 처리위탁 계약 있음'] : personal === 'NO' ? ['skip', '개인정보 처리위탁 계약 없음'] : ['wait', '개인정보 처리위탁 계약 여부를 기다림'];
    let sales;
    if (pc.q2 === 'YES') sales = ['skip', '표준단가표를 적용함'];
    else if (pc.q2 === 'NO' && pc.q3 === 'YES') sales = ['skip', '할인율 한도 이내'];
    else if (pc.q3 === 'NO') sales = ['go', '할인율 한도를 넘김'];
    else sales = ['wait', '금액 계산을 기다림'];
    // ③ 영업 검토는 기안자 유닛의 리더 (리더 본인 계약은 영업 임원, v0.26 재무 문서 반영)
    const req = { requesterId: (source && source.requesterId) || me.id };
    const name = function (code) { return C.ownerLabel(C.stepUserNow(code, req)); };
    return [
      { stage: '2단계 계약 검토 (② 다음 ③, 그다음 ④와 ⑤ 동시)', items: [
        { no: '②', name: '체크리스트 검토', who: '영업지원', state: 'go', reason: '어떤 경우에도 생략하지 않음' }, // REQ-CHK-02
        { no: '③', name: '영업 검토', who: '영업 리더 ' + name('S03'), state: sales[0], reason: sales[1] }, // 가격 예외 승인, 법무보다 먼저 (v0.20)
        { no: '④', name: '법무 검토', who: '법무 ' + name('S04'), state: legal[0], reason: legal[1] },
        { no: '⑤', name: '개인정보 검토', who: '정보보호 담당자 ' + name('S05'), state: privacy[0], reason: privacy[1] },
      ] },
      { stage: '3단계 계약 체결', items: [
        { no: '⑥', name: '인장 날인 검토', who: '총무', state: 'go', reason: '기초 정보 확인 후 인장 날인' },
        { no: '⑦', name: '상대방 서명, 체결본 등록', who: '영업 (나)', state: 'go', reason: '서명은 시스템 밖에서' },
        { no: '⑧', name: '체결본 확인', who: '영업지원', state: 'go', reason: '승인된 내용과 같은지 확인' },
      ] },
      { stage: '4단계 운영 검토', items: [
        { no: '⑨', name: '운영 적용', who: '고객지원', state: 'go', reason: '라이선스나 도메인 열기' },
        { no: '⑩', name: '재무 확인', who: '재무 ' + name('S10'), state: 'go', reason: '회계 인식 (결재선에는 없음)' },
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
      if (!r.product) { info.textContent = '제품과 기능을 고르면 표준 단가가 나옵니다.'; badge.innerHTML = ''; return; }
      info.textContent = '표준 단가 ' + krw(r.product.listPrice) + ' (' + r.product.unit + ')' + (r.qty ? ' x ' + r.qty + ' = ' + krw(r.std) : '') +
        ', 할인율 한도 ' + pct(r.cap);
      if (r.amount == null || r.discount == null) badge.innerHTML = '<span class="badge badge--line">금액 입력 대기</span>';
      else if (r.discount === 0) badge.innerHTML = '<span class="badge badge--success">표준 단가</span>';
      else if (r.discount > r.cap + 1e-9) badge.innerHTML = '<span class="badge badge--danger">' + pct(r.discount) + ' 할인, 한도 초과</span>';
      else badge.innerHTML = '<span class="badge badge--progress">' + pct(r.discount) + ' 할인, 한도 이내</span>';
    });
    // 총액
    const total = totalAmount();
    $('#amount-total').innerHTML = esc(total ? krw(total) : '0원') + (total ? '<span class="exact">' + fmtNum(total) + '원</span>' : '');
    renderYearly();
    // 체크리스트
    const q1 = val('standard');
    $('#q1-result').textContent = q1 === 'YES' ? '④ 법무 검토를 생략합니다.' : q1 === 'NO' ? '④ 법무 검토를 거칩니다. 첨부에 조항 대비표를 올리세요.' : '';
    $('#diff-field').hidden = q1 !== 'NO'; // 조항 대비표는 표준계약서를 바꿨을 때만 (v0.27)
    // 4번: 결재선은 그대로, 기안하면 재무에 이메일로 알림 (REQ-CHK-08, REQ-ENV-10)
    const q4 = val('accounting');
    $('#q4-result').textContent = q4 === 'YES' ? '기안하면 재무 ' + C.ownerLabel(C.stepUserNow('S10', { requesterId: me.id })) + '에게 이메일로 알립니다. 결재선은 바뀌지 않습니다.' : '';
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
      : '';
    $('#route').innerHTML = routeHtml(route);
    current = { route: route, pc: pc, q1: q1, total: total };
  }
  // 영업기회번호: 영문은 대문자로, 규칙에 맞으면 판다 링크 (v0.32)
  function updateOppLink() {
    const v = $('#f-opportunity').value;
    $('#opp-link').innerHTML = C.isOppNo(v)
      ? '<a class="btn btn--tertiary btn--md ext-btn" href="' + C.pandaUrl(v) + '" target="_blank" rel="noopener noreferrer">' + C.icon('external', 'sm') + '판다에서 열기<span class="sr-only">(새 창)</span></a>' : '';
  }
  form.addEventListener('input', function (e) {
    // 사업자등록번호: 숫자만 넣으면 '-'를 붙여 보여 줌(글자는 지움, v0.34)
    if (e.target.id === 'f-bizno') { e.target.value = C.fmtBizNo(e.target.value); bizWarn(); }
    if (e.target.id === 'f-opportunity') { e.target.value = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ''); updateOppLink(); }
    clearError(e.target);
    refresh();
    updateYearSum();
  });
  form.addEventListener('change', function (e) {
    clearError(e.target);
    if (e.target.name === 'kind') onKindChange();
    if (e.target.id === 'f-origin') onOriginChange();
    if (e.target.name === 'autoRenew') $('#notice-days-field').hidden = val('autoRenew') !== 'YES';
    refresh();
  });

  // 직접 넣은 사업자등록번호를 10자리까지 넣으면 바로 알림 (v0.39): 고유번호 검증 숫자, 국세청 휴업과 폐업(시안은 가상 결과)
  function bizWarn() {
    const no = $('#f-bizno').value.replace(/-/g, ''), w = $('#bizno-warn');
    let msg = '';
    if (/^\d{10}$/.test(no) && $('#f-customer').value === NEW_CUSTOMER) {
      const st = C.ntsStatus(no);
      if (st === 'CLOSED') msg = '국세청 조회 결과 폐업한 사업자입니다. 기안할 수 없습니다.';
      else if (st === 'SUSPENDED') msg = '국세청 조회 결과 휴업 중인 사업자입니다. 계약해도 되는지 확인하세요.';
      else if (C.isUniqueNo(no) && !C.isBizNo(no)) msg = '고유번호의 검증 숫자가 맞지 않습니다. 번호를 다시 확인하세요. 학교, 공공기관 번호일 수 있어 막지는 않습니다.';
    }
    w.innerHTML = msg ? C.icon('alert', 'sm') + esc(msg) : '';
    w.hidden = !msg;
  }


  /* ---------- 변경, 연장: 원계약 고르기 (REQ-FLOW-18) ---------- */
  const RESTRICT_HELP = $('#restricted-help').textContent;
  function onKindChange() {
    const kind = val('kind');
    $('#origin-field').hidden = kind === 'NEW';
    onOriginChange();
  }
  function bundleNumber() {
    const kind = val('kind');
    const origin = $('#f-origin').value;
    if (kind === 'NEW' || !origin) return null;
    return C.nextChildId(origin, kind); // 예: 2601CL001-A02 (common.js)
  }
  function onOriginChange() {
    const help = $('#origin-help');
    const no = bundleNumber();
    help.textContent = no
      ? '기안하면 ' + no + '(' + D.KINDS[val('kind')] + ' ' + no.slice(-2).replace(/^0/, '') + '차)로 원계약과 함께 묶입니다.'
      : '보관함에 있는 계약 중에서 고릅니다. 원계약 번호에 차수가 붙어 함께 묶입니다.';
    // 원계약을 고르면 거래처를 미리 채움 (비어 있을 때만). 계약명은 두지 않음 (v0.12)
    const o = D.CONTRACTS.find(function (c) { return c.id === $('#f-origin').value; });
    if (o) {
      if (!$('#f-customer').value) pickCustomerByName(o.counterparty, '', o.unit);
    }
    // 열람 제한 이어받기 (D-13 v0.39 기획자 결정): 원계약이 열람 제한이면 변경, 연장 기안도 제한. 여기서는 풀 수 없고 관리자만(열람 제한 관리)
    const inherit = !!(o && o.restricted && val('kind') !== 'NEW');
    const rc = $('#f-restricted');
    if (inherit) { rc.checked = true; rc.dataset.auto = '1'; }
    else if (rc.dataset.auto) { rc.checked = false; delete rc.dataset.auto; } // 이어받아 체크했던 것만 되돌림
    rc.disabled = inherit;
    $('#restricted-help').textContent = inherit
      ? '원계약에 열람 제한이 있어 이 기안도 열람 제한과 지정 열람자를 이어받습니다. 풀기와 열람자 지정은 관리자만 할 수 있습니다(열람 제한 관리).' // v0.52
      : RESTRICT_HELP;
  }

  /* ---------- 파일 첨부 (KRDS 파일 업로드, 프로토타입은 이름만) ---------- */
  const files = { draft: [], diff: [], annex: [], quote: [] }; // diff: 조항 대비표 (표준계약서를 바꾸면 필수, v0.27), annex: 부속 서류 (v0.41)
  function fmtSize(b) { return b >= 1048576 ? (b / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(b / 1024)) + 'KB'; }
  function renderFiles(key) {
    $('#' + key + '-list').innerHTML = files[key].map(function (f, i) {
      return '<li><span><span class="file-name">' + esc(f.name) + '</span><span class="file-size">' + fmtSize(f.size) + '</span></span>' +
        '<button type="button" class="btn-text" data-file="' + key + '" data-i="' + i + '" aria-label="' + esc(f.name) + ' 삭제">삭제</button></li>';
    }).join('');
  }
  function addFiles(key, list) {
    Array.prototype.forEach.call(list, function (f) { files[key].push({ name: f.name, size: f.size }); });
    if (key === 'quote' || key === 'diff') files[key] = files[key].slice(-1);
    renderFiles(key);
    if (key === 'draft') clearError($('#f-draft'));
    if (key === 'diff') clearError($('#f-diff'));
  }
  [['draft', '#f-draft'], ['diff', '#f-diff'], ['annex', '#f-annex'], ['quote', '#f-quote']].forEach(function (pair) {
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
    C.setFieldError(box, msg); // 오류 표시와 aria-invalid (KRDS, v0.28)
    return focusEl || box.querySelector('input:not([type=hidden]), select, textarea');
  }
  function clearError(el) {
    const box = el && el.closest && el.closest('[data-field], .product-item');
    if (!box || !box.classList.contains('is-invalid')) return;
    C.setFieldError(box, '');
  }
  function clearAllErrors() {
    $$('.is-invalid', form).forEach(function (b) { C.setFieldError(b, ''); });
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
    need(!!kind, 'kind', '계약종류를 고르세요.');
    if (kind && kind !== 'NEW') need(!!$('#f-origin').value, 'origin', '원계약을 고르세요.');
    need(!!val('customer'), 'customer', '거래처를 검색해 고르세요. 검색 결과가 없으면 직접 입력합니다.', qInput);
    if (val('customer') === NEW_CUSTOMER) {
      need(!!val('counterparty'), 'counterparty', '거래처 상호를 입력하세요.');
      const no = val('bizNo').replace(/-/g, ''); // 숫자 10자리로 비교. 저장과 표시는 000-00-00000 (v0.34)
      const digits = function (x) { return String(x).replace(/-/g, ''); };
      const dupCu = D.CUSTOMERS.filter(function (cu) { return digits(cu.bizNo) === no; })[0];
      const inDb = D.BIZ_REGISTRY.filter(function (r) { return digits(r.bizNo) === no; })[0];
      const ten = /^\d{10}$/.test(no);
      need(ten, 'bizNo', '사업자등록번호 10자리를 입력하세요.');
      // 검증 숫자 규칙. 고유번호(가운데 82, 83)는 맞지 않아도 막지 않고 칸 아래에 알림만 (v0.39)
      if (ten && !C.isUniqueNo(no)) need(C.isBizNo(no), 'bizNo', '사업자등록번호가 맞지 않습니다. 사업자등록증의 숫자를 다시 확인하세요.');
      if (ten && (C.isBizNo(no) || C.isUniqueNo(no))) need(!dupCu && !inDb, 'bizNo', '이미 ' + (dupCu ? '거래처 목록' : '사업자 정보 DB') + '에 있는 번호입니다(' + (dupCu || inDb || {}).name + '). 거래처 칸에서 검색해 고르세요.');
      // 국세청 상태 조회(직접 넣은 번호만, v0.39): 폐업은 막음, 휴업은 칸 아래 알림만
      if (ten) need(C.ntsStatus(no) !== 'CLOSED', 'bizNo', '국세청 조회 결과 폐업한 사업자입니다. 폐업한 곳과는 계약을 올릴 수 없습니다.');
    }
    // 영업기회번호: 필수, 판다 번호 규칙 (v0.32 기획자 요청)
    need(!!val('opportunity'), 'opportunity', '영업기회번호를 입력하세요.');
    if (val('opportunity')) need(C.isOppNo(val('opportunity')), 'opportunity', '영업기회번호는 연도 2자리, 월 2자리, 영문 2자리, 일련번호 3자리입니다(예: 2610SU067).');
    need(!!val('method'), 'method', '계약 방식을 고르세요.');
    need(!!val('startDate'), 'startDate', '계약 시작일을 입력하세요.');
    need(!!val('endDate'), 'endDate', '계약 종료일을 입력하세요.');
    if (val('startDate') && val('endDate')) need(val('endDate') >= val('startDate'), 'endDate', '계약 종료일은 계약 시작일보다 앞설 수 없습니다.'); // 같은 날은 됨 (v0.38)
    need(!!val('autoRenew'), 'autoRenew', '자동갱신 여부를 고르세요.');
    if (val('autoRenew') === 'YES') need(!!parseNum(val('noticeDays')), 'noticeDays', '해지 통지 기한(만료 며칠 전)을 입력하세요.');
    need(!!val('personalData'), 'personalData', '개인정보 처리위탁 계약 여부를 고르세요.');
    need(!!val('sla'), 'sla', '서비스 수준 협약(SLA) 여부를 고르세요.'); // v0.40

    // 제품: 1개 이상, 줄마다 제품, 기능, 수량, 금액 (금전 거래가 있는 계약만 등록, v0.41. 기능은 v0.47, 플랜은 v0.49에 없앰)
    const rows = readProducts();
    if (!rows.length) need(false, 'products', '제품을 1개 이상 넣으세요.', $('#btn-add-product'));
    rows.forEach(function (r, i) {
      if (r.product && r.qty && r.amount != null) return;
      r.li.classList.add('is-invalid');
      const err = r.li.querySelector(':scope > .field-error');
      const msg = (i + 1) + '번째 줄의 제품, 기능, 수량, 계약 금액을 모두 넣으세요.';
      err.hidden = false;
      err.innerHTML = C.icon('alert', 'sm') + '<span>' + esc(msg) + '</span>';
      // 비어 있는 첫 칸으로 (제품 → 기능 → 수량 → 금액)
      const empty = ['product', 'feature'].map(function (k) { return r.li.querySelector('[data-k="' + k + '"]'); }).filter(function (s) { return !s.value; })[0];
      errors.push({ msg: msg, target: !r.product ? empty : (!r.qty ? r.li.querySelector('[data-k="qty"]') : r.li.querySelector('[data-k="amount"]')) });
    });
    // 연도별 금액 합계 = 총액
    if (!$('#yearly-field').hidden) {
      const ys = yearlyAmounts();
      const sum = ys.reduce(function (a, b) { return a + (b || 0); }, 0);
      need(ys.every(function (y) { return y != null; }) && sum === totalAmount(), 'yearly',
        '연도별 금액을 모두 넣고, 합계를 총액(' + fmtNum(totalAmount()) + '원)과 맞추세요.');
    }
    need(!!val('settlement'), 'settlement', '정산 방식을 고르세요.');

    // 체크리스트: 1번은 직접 답, "아니요"인 문항은 비고(사유) 필수 (panda p.9)
    need(!!val('standard'), 'standard', '체크리스트 1번에 답하세요.');
    need(!!val('template'), 'template', '기준 표준계약서를 고르세요. 상대방 양식이면 "상대방 양식"을 고릅니다.');
    if (val('template') === 'OWN' && val('standard') === 'YES') need(false, 'template', '상대방 양식이면 체크리스트 1번은 "아니요"입니다.');
    if (val('standard') === 'NO') need(!!val('standardNote'), 'standardNote', '1번이 "아니요"이면 비고에 바꾼 조항과 이유를 적으세요.');
    if (current.pc.q2 === 'NO') need(!!val('priceNote'), 'priceNote', '2번이 "아니요"이면 비고에 표준 단가와 다르게 정한 이유를 적으세요.');
    if (current.pc.q3 === 'NO') need(!!val('capNote'), 'capNote', '3번이 "아니요"이면 비고에 할인율 한도를 넘긴 영업적 사유를 적으세요.');
    need(!!val('accounting'), 'accounting', '체크리스트 4번에 답하세요.');
    if (val('accounting') === 'YES') need(!!val('accountingNote'), 'accountingNote', '4번이 "예"이면 비고에 어떤 조건인지 적으세요.');

    need(files.draft.length > 0, 'draftFile', '계약서 초안을 첨부하세요.', $('#f-draft'));
    if (val('standard') === 'NO') need(files.diff.length > 0, 'diffFile', '표준계약서를 바꿨으면 조항 대비표를 첨부하세요.', $('#f-diff'));
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
    C.toast('임시 저장했고, 나만 볼 수 있습니다(시안이라 실제로 저장되지는 않음).');
  });

  function newNumber() {
    if (source && source.status === 'REJECTED') return source.id;
    const bundle = bundleNumber();
    if (bundle) return bundle;
    // 계약번호(C-23 v0.39 기획자 결정): 기안 연월 4자리 + CL + 그 달 일련번호 3자리. 예: 2610CL009
    //   판다 영업기회번호와 같은 꼴(연도 2, 월 2, 영문 2, 일련번호 3). 후속 기안은 원계약 번호 뒤에 -A01, -R01, -T01, -C01
    const ym = D.TODAY.slice(2, 4) + D.TODAY.slice(5, 7);
    const max = D.CONTRACTS.reduce(function (m, c) {
      const mm = new RegExp('^' + ym + 'CL(\\d{3})$').exec(c.id || '');
      return mm ? Math.max(m, Number(mm[1])) : m;
    }, 0);
    return ym + 'CL' + String(max + 1).padStart(3, '0');
  }

  const modal = $('#confirm-modal');
  let lastFocus = null;
  function openModal() {
    const goes = [];
    current.route.forEach(function (g) {
      g.items.forEach(function (i) { if (g.stage.indexOf('2단계') === 0 && i.state === 'go') goes.push(i.no + ' ' + i.name); });
    });
    const rows = [
      ['거래처', val('counterparty') + (val('bizNo') ? ' (' + val('bizNo') + ')' : '') + (unitValue() ? ', 기관 또는 부서: ' + unitValue() : '')],
      ['서비스', serviceOfProducts()],
      ['계약 금액', current.total ? krw(current.total) + ' (부가세 별도)' : '금액 없음'],
      ['계약 기간', C.fmtPeriod(val('startDate'), val('endDate'))],
      ['서비스 수준 협약(SLA)', val('sla') === 'YES' ? '있음' : '없음'],
      ['기준 표준계약서', templatePick() ? (templatePick().id === 'OWN' ? '상대방 양식(표준계약서 없음)' : templatePick().label) : '-'], // v0.53
      ['계약 검토', goes.join(', ')],
      ['재무 알림', val('accounting') === 'YES' ? '재무에 이메일로 알림 (결재선 아님)' : '없음'],
      ['기안 차수', round + '차' + (val('restricted') ? ', 열람 제한' : '')],
    ];
    $('#confirm-body').innerHTML = '<p>기안하면 ② 체크리스트 검토부터 시작되고, 기안한 내용은 결재가 끝날 때까지 고칠 수 없습니다.</p>' +
      '<dl class="confirm-list">' + rows.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl>';
    lastFocus = document.activeElement;
    modal.hidden = false;
    C.focusModal(modal); // 제목에 포커스 (KRDS 모달, v0.28)
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
      '다음 단계: ② 체크리스트 검토 (영업지원). 진행 상황은 개요의 계약 진행 현황에서 볼 수 있습니다.<br>' +
      '프로토타입이라 실제로 저장되지는 않습니다.',
      '<a class="btn btn--primary btn--md" href="index.html">개요로 가기</a><a class="btn btn--tertiary btn--md" href="new-contract.html">새 계약 하나 더 등록</a>');
    window.scrollTo(0, 0);
    C.toast('기안했습니다. (프로토타입)');
  }

  /* ---------- 미리 채우기 (이어서 작성, 보완 후 재기안) ---------- */
  if (source) {
    const f = source.form || {};
    setRadio('kind', source.kind || 'NEW');
    pickCustomerByName(source.counterparty, f.bizNo, source.unit || f.unit);
    $('#f-opportunity').value = f.opportunity || '';
    updateOppLink();
    setRadio('method', f.method === 'RESELLER' ? 'INDIRECT' : f.method);
    $('#f-start').value = f.startDate || '';
    $('#f-end').value = f.endDate || '';
    setRadio('autoRenew', f.autoRenew);
    $('#notice-days-field').hidden = f.autoRenew !== 'YES';
    $('#f-notice-days').value = f.noticeDays || '';
    setRadio('personalData', source.personalData ? 'YES' : 'NO');
    if (source.sla || f.sla) setRadio('sla', source.sla || f.sla); // 서비스 수준 협약 (v0.40)
    $('#f-restricted').checked = !!source.restricted;
    setRadio('settlement', f.settlement);
    if (f.checklist) {
      setRadio('standard', f.checklist.standard); $('#f-standard-note').value = f.checklist.standardNote || '';
      const tp = source.template || f.template; // 기준 표준계약서 (v0.53)
      if (tp) $('#f-template').value = tp.id;
      setRadio('accounting', f.checklist.accounting); $('#f-accounting-note').value = f.checklist.accountingNote || '';
    }
    $('#f-memo').value = f.memo || '';
    (f.products || []).forEach(function (p) { addProduct(p); });
    if (source.status === 'REJECTED') { files.draft.push({ name: source.counterparty + ' 계약서 1차 기안본.docx', size: 84000 }); renderFiles('draft'); }
    if (source.status === 'REJECTED' && f.checklist && f.checklist.standard === 'NO') { files.diff.push({ name: source.counterparty + ' 조항 대비표.docx', size: 36000 }); renderFiles('diff'); }
  }
  // 계약 상세, 만료 예정에서 "변경 기안", "연장 기안"으로 들어오면 구분과 원계약을 미리 고름
  //   new-contract.html?kind=AMEND&origin=2601CL001 (REQ-ARC-02, 05)
  const pre = new URLSearchParams(location.search);
  if (!source && ['AMEND', 'RENEW'].indexOf(pre.get('kind')) > -1) {
    setRadio('kind', pre.get('kind'));
    if (origins.some(function (c) { return c.id === pre.get('origin'); })) $('#f-origin').value = pre.get('origin');
  }
  if (!$$('#product-list > li').length) addProduct();
  onKindChange();
  refresh();
})();
