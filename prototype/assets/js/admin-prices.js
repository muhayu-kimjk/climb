/* =====================================================================
 * SCR-54 가격 기준 관리 화면 로직 (admin-prices.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-SCOPE-02(시스템에 두되 열람 제한), REQ-CHK-04(체크리스트 2, 3번 계산), REQ-CHK-07(적용 시작일, 품의 문서 링크)
 * v0.47 기획자 요청: 제품과 기능을 나눔. v0.49 기획자 결정: 플랜을 없애고 제품 → 기능 두 단계만 둠
 *   가격 기준은 **기능마다 하나**(단위, 표준 단가, 할인율 한도). "프리즘 결함검사"처럼 보임. 제품과 기능은 제품과 기능 관리(SCR-58)
 * 하는 일
 *   1. 오늘 적용되는 기준: 기능마다 적용 시작일이 오늘 이전인 줄 중 가장 늦은 것. 예정된 기준은 그 아래에 표시. 제품, 기능 순서로 줄 세움
 *   2. 바꾸기, 가격 추가: 적용 시작일(오늘 이후), 품의 문서 링크(필수, https), 품의 번호(선택), 변경 사유(필수)
 *      가격 추가는 제품 → 기능(사용 중이고 아직 가격이 없는 것만)을 고른 뒤 단위와 가격. 서비스는 그 제품의 서비스(대분류, v0.56)
 *      기존 줄은 고치지 않고 새 줄을 더함. 이미 기안한 계약은 기안할 때의 기준을 씀
 *   3. 바뀐 이력: 모든 줄(지난 기준, 적용 중, 예정)
 * 볼 수 있는 사람: 영업, 영업지원, 관리자(바꾸기는 관리자만). 최고관리자는 모두
 * 프로토타입: 품의 문서 링크는 열리지 않음. 바꾼 내용은 이 브라우저에만 저장(시연 기록)
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  if (!C.gate(me, ['ADMIN', 'SALES', 'SALES_ADMIN'], '가격 기준은 영업, 영업지원, 관리자만 볼 수 있습니다',
    '지금은 ' + esc(C.roleLabel(me.role)) + ' 역할로 보고 있습니다. 가격 기준은 열람을 제한하는 정보입니다(REQ-SCOPE-02).')) return;
  const canEdit = me.role === 'ADMIN' || me.role === 'SUPER';
  if (!canEdit) {
    $('#btn-add').hidden = true;
    $('#th-action').hidden = true;
    $('#intro-sub').textContent = '영업과 영업지원은 볼 수만 있습니다. 가격 기준은 사내 품의 결재로 승인받은 뒤 관리자가 바꿉니다.';
  }

  function val(f, n) { return (f.elements[n].value || '').trim(); }
  function won(n) { return Number(n).toLocaleString('ko-KR') + '원'; }
  function pct(r) { return Math.round(r * 1000) / 10 + '%'; }
  // 가격이 있는 기능 목록: 제품 → 기능 순서(제품과 기능 관리의 순서)
  function priced() {
    const list = [];
    D.PRICE_ROWS.forEach(function (r) { if (list.indexOf(r.feature) < 0) list.push(r.feature); });
    const first = function (fid) { return D.PRICE_ROWS.filter(function (r) { return r.feature === fid; })[0]; };
    const idx = function (arr, id) { const i = arr.map(function (x) { return x.id; }).indexOf(id); return i < 0 ? 9999 : i; };
    return list.map(function (fid, i) { const r = first(fid); return { fid: fid, k: [idx(D.PRODUCTS, r.product), idx(D.FEATURES, fid), i] }; })
      .sort(function (a, b) { return a.k[0] - b.k[0] || a.k[1] - b.k[1] || a.k[2] - b.k[2]; })
      .map(function (x) { return x.fid; });
  }
  function retired(fid) {
    const ft = D.FEATURES.filter(function (x) { return x.id === fid; })[0];
    const p = ft && D.PRODUCTS.filter(function (x) { return x.id === ft.product; })[0];
    return !ft || !ft.use || !p || !p.use;
  }
  function current(fid) { return D.PRICE_BOOK.filter(function (r) { return r.feature === fid; })[0] || null; }
  function planned(fid) {
    return D.PRICE_ROWS.filter(function (r) { return r.feature === fid && r.validFrom > D.TODAY; })
      .sort(function (a, b) { return a.validFrom.localeCompare(b.validFrom); });
  }
  // 품의 문서: 번호를 보여 주고, 누르면 안내 (프로토타입에서는 열리지 않음)
  function docLink(r) {
    return '<a href="#" class="doc-link" data-doc="' + esc(r.docNo || r.docUrl) + '" title="' + esc(r.docUrl) + '">' + esc(r.docNo || '품의 문서') + '</a>';
  }

  /* ---------- 1. 오늘 적용되는 기준 ---------- */
  function render() {
    $('#today').textContent = C.fmtDate(D.TODAY) + ' 기준';
    $('#rows').innerHTML = priced().map(function (fid) {
      const r = current(fid), next = planned(fid), any = r || next[0];
      const plan = next.map(function (p) {
        return '<span class="cell-meta">' + C.badge('line', '예정') + ' ' + C.fmtDate(p.validFrom) + '부터 ' + won(p.listPrice) + ', 한도 ' + pct(p.discountCap) + '</span>';
      }).join('');
      // 제품과 기능 칸: "프리즘 결함검사" 아래에 서비스(대분류)와 단위를 함께 (A4 폭 안에 들어가게)
      //   제품이나 기능이 사용 안 함이면 표시하고 바꾸기를 두지 않음(새 계약에서 고를 수 없으므로, v0.58 QA)
      const off = retired(fid);
      return '<tr' + (off ? ' class="is-muted"' : '') + '><td><span class="cell-strong">' + esc(C.featureLabel(any)) + '</span>' +
          '<span class="cell-meta">' + esc((D.SERVICES[any.service] || any.service) + ', ' + any.unit) + (off ? ' ' + C.badge('neutral', '사용 안 함') : '') + '</span>' + plan + '</td>' +
        (r ? '<td class="num">' + won(r.listPrice) + '</td><td class="num">' + pct(r.discountCap) + '</td>' +
          '<td class="num-left">' + C.fmtDate(r.validFrom) + '</td><td class="nowrap">' + docLink(r) + '</td>'
          : '<td class="num" colspan="4">아직 적용 전</td>') +
        (canEdit ? '<td class="col-action">' + (off ? '-' : '<button type="button" class="link-act" data-change="' + esc(fid) + '" aria-label="' + esc(C.featureLabel(any)) + ' 가격 기준 바꾸기">바꾸기</button>') + '</td>' : '') +
      '</tr>';
    }).join('');

    /* ---------- 3. 바뀐 이력 ---------- */
    const rows = D.PRICE_ROWS.slice().sort(function (a, b) { return b.validFrom.localeCompare(a.validFrom) || b.at.localeCompare(a.at); });
    $('#history').innerHTML = rows.map(function (r) {
      const state = r.validFrom > D.TODAY ? C.badge('line', '예정') : current(r.feature) === r ? C.badge('success', '적용 중') : C.badge('neutral', '지난 기준');
      return '<tr' + (r.validFrom <= D.TODAY && current(r.feature) !== r ? ' class="is-muted"' : '') + '>' +
        '<td class="num-left">' + C.fmtDate(r.validFrom) + '<span class="cell-meta">' + state + '</span></td>' +
        '<td><span class="cell-strong">' + esc(C.featureLabel(r)) + '</span><span class="cell-meta">' + esc(r.unit) + '</span></td>' +
        '<td class="num">' + won(r.listPrice) + '<span class="cell-meta">한도 ' + pct(r.discountCap) + '</span></td>' +
        '<td class="col-wide">' + esc(r.reason) + '<span class="cell-meta">품의 ' + docLink(r) + '</span></td>' +
        '<td class="center">' + esc(C.ownerLabel(r.by)) + '<span class="cell-meta">' + C.fmtDateTime(r.at) + '</span></td></tr>';
    }).join('');
  }

  /* ---------- 2. 바꾸기, 가격 추가 ---------- */
  // 가격과 근거 입력 칸 (바꾸기와 가격 추가가 같이 씀)
  function priceFields(r) {
    return '<div class="field-row">' +
        C.fieldHtml({ name: 'price', label: '표준 단가', required: true, unit: '원', value: r ? r.listPrice : '', attrs: ' inputmode="numeric"' }) +
        C.fieldHtml({ name: 'cap', label: '할인율 한도', required: true, unit: '%', value: r ? Math.round(r.discountCap * 1000) / 10 : '', attrs: ' inputmode="decimal"' }) +
      '</div>' +
      C.fieldHtml({ name: 'validFrom', label: '적용 시작일', type: 'date', required: true, attrs: ' min="' + D.TODAY + '"',
        help: '이날 이후 기안하는 계약부터 새 기준을 씁니다. 오늘 이후 날짜만 고를 수 있습니다.' }) +
      C.fieldHtml({ name: 'docUrl', label: '품의 문서 링크', type: 'url', required: true, placeholder: 'https://',
        help: '가격 기준 변경을 승인한 사내 품의 문서의 주소입니다. 없으면 저장할 수 없습니다.' }) +
      C.fieldHtml({ name: 'docNo', label: '품의 번호', placeholder: '예: 경영지원-2026-1021' }) +
      C.fieldHtml({ name: 'reason', label: '변경 사유', type: 'textarea', required: true, placeholder: '품의 내용을 짧게 적습니다. 예: 서버 비용 반영으로 단가 인상' });
  }
  // 가격과 근거 검사. base가 있으면(바꾸기) 단가나 한도 중 하나는 바뀌어야 함
  function checkPrice(f, fid, base) {
    const price = val(f, 'price').replace(/,/g, ''), cap = val(f, 'cap'), from = val(f, 'validFrom');
    const priceOk = /^\d+$/.test(price) && Number(price) > 0;
    const capOk = /^\d+(\.\d)?$/.test(cap) && Number(cap) <= 100;
    const same = base && priceOk && capOk && Number(price) === base.listPrice && Math.abs(Number(cap) / 100 - base.discountCap) < 0.0001;
    const dup = fid && from && D.PRICE_ROWS.some(function (r) { return r.feature === fid && r.validFrom === from; });
    return {
      price: !priceOk ? '표준 단가를 원 단위 숫자로 넣으세요.' : same ? '표준 단가나 할인율 한도 중 하나는 지금과 달라야 합니다.' : '',
      cap: capOk ? '' : '할인율 한도를 0에서 100 사이로 넣으세요(소수점 한 자리까지).',
      validFrom: !from ? '적용 시작일을 고르세요.' : from < D.TODAY ? '적용 시작일은 오늘(' + C.fmtDate(D.TODAY) + ') 이후여야 합니다.'
        : dup ? '이 기능은 이 적용 시작일에 이미 기준이 있습니다.' : '',
      docUrl: /^https:\/\/\S+$/.test(val(f, 'docUrl')) ? '' : '품의 문서 링크를 https://로 시작하는 주소로 넣으세요.',
      reason: val(f, 'reason') ? '' : '변경 사유를 적으세요.',
    };
  }
  function rowFrom(f, base) {
    return Object.assign({}, base, {
      listPrice: Number(val(f, 'price').replace(/,/g, '')), discountCap: Math.round(Number(val(f, 'cap')) * 10) / 1000,
      validFrom: val(f, 'validFrom'), docUrl: val(f, 'docUrl'), docNo: val(f, 'docNo'), reason: val(f, 'reason'),
    });
  }
  function saved(row, change) {
    const label = C.featureLabel(row);
    C.adminSave('PRICE', label + ' (' + row.feature + ')', change + ' (' + C.fmtDate(row.validFrom) + '부터)', row.reason, { k: 'PRICE', row: row });
    render();
    C.toast(row.validFrom === D.TODAY ? label + ' 기준을 오늘부터 적용합니다.' : label + ' 기준이 ' + C.fmtDate(row.validFrom) + '부터 적용됩니다.');
  }
  function openChange(fid) {
    const base = current(fid) || planned(fid)[0];
    C.formModal({
      title: C.featureLabel(base) + ' 가격 기준을 바꿀까요?',
      desc: '적용 시작일부터 기안하는 계약에 새 기준을 씁니다. 지금 기준은 지우지 않고 이력으로 남습니다.',
      body: '<p class="modal-info">지금: 표준 단가 ' + won(base.listPrice) + ' (' + esc(base.unit) + '), 할인율 한도 ' + pct(base.discountCap) + ' (' + C.fmtDate(base.validFrom) + '부터)</p>' + priceFields(base),
      btn: '새 기준 저장',
      check: function (f) { return checkPrice(f, fid, base); },
      done: function (f) {
        const row = rowFrom(f, { feature: base.feature, product: base.product, service: base.service, unit: base.unit });
        const parts = [];
        if (row.listPrice !== base.listPrice) parts.push('표준 단가 ' + won(base.listPrice) + ' → ' + won(row.listPrice));
        if (Math.abs(row.discountCap - base.discountCap) > 0.0001) parts.push('할인율 한도 ' + pct(base.discountCap) + ' → ' + pct(row.discountCap));
        saved(row, parts.join(', '));
      },
    });
  }
  // 가격 추가 (v0.49): 제품 → 기능을 고르고 단위와 가격. 사용 중이고 아직 가격이 없는 기능만 고를 수 있음(가격은 기능마다 하나)
  function liveProducts() {
    const svc = C.codeList('SERVICE').map(function (c) { return c.code; }); // 사용 중인 서비스 아래 제품만
    return D.PRODUCTS.filter(function (p) { return p.use && svc.indexOf(p.service) > -1; });
  }
  function openFeatures(pid) {
    const has = priced();
    return D.FEATURES.filter(function (x) { return x.product === pid && x.use && has.indexOf(x.id) < 0; });
  }
  function featureOptions(pid) {
    const list = pid ? openFeatures(pid) : [];
    return '<option value="">' + (!pid ? '제품을 먼저 고르세요' : list.length ? '고르세요' : '가격을 넣을 기능이 없습니다') + '</option>' +
      list.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name) + '</option>'; }).join('');
  }
  function openAdd() {
    const products = liveProducts().map(function (p) { return [p.id, p.name + ' (' + C.serviceLabel([p.service]) + ')']; });
    C.formModal({
      title: '가격을 추가할까요?',
      desc: '적용 시작일부터 계약 등록에서 그 제품의 기능을 고를 수 있습니다.',
      body: '<div class="field-row">' +
          C.fieldHtml({ name: 'product', label: '제품', type: 'select', required: true, options: [['', '고르세요']].concat(products) }) +
          C.fieldHtml({ name: 'feature', label: '기능', type: 'select', required: true, options: [['', '제품을 먼저 고르세요']], attrs: ' disabled',
            help: '아직 가격이 없는 기능만 나옵니다. 제품과 기능은 제품과 기능 관리에서 넣습니다.' }) +
        '</div>' +
        C.fieldHtml({ name: 'unit', label: '단위', required: true, placeholder: '예: 기관, 1년' }) +
        priceFields(null),
      btn: '가격 추가',
      open: function (f) {
        f.elements.product.addEventListener('change', function () {
          const pid = f.elements.product.value;
          f.elements.feature.innerHTML = featureOptions(pid);
          f.elements.feature.disabled = !pid || !openFeatures(pid).length;
        });
      },
      check: function (f) {
        const pid = val(f, 'product'), fid = f.elements.feature.value;
        return Object.assign(checkPrice(f, fid, null), {
          product: pid ? '' : '제품을 고르세요.',
          feature: !pid ? '' : !openFeatures(pid).length ? '이 제품에는 가격을 넣을 기능이 없습니다. 이미 가격이 있으면 표에서 바꾸고, 새 기능은 제품과 기능 관리에서 넣으세요.' : fid ? '' : '기능을 고르세요.',
          unit: val(f, 'unit') ? '' : '단위를 넣으세요.',
        });
      },
      done: function (f) {
        const p = D.PRODUCTS.filter(function (x) { return x.id === val(f, 'product'); })[0];
        const row = rowFrom(f, { feature: f.elements.feature.value, product: p.id, service: p.service, unit: val(f, 'unit') });
        saved(row, '가격 추가: 표준 단가 ' + won(row.listPrice) + ', 할인율 한도 ' + pct(row.discountCap));
      },
    });
  }

  $('#content').addEventListener('click', function (e) {
    const doc = e.target.closest('[data-doc]');
    if (doc) { e.preventDefault(); C.toast('품의 문서(' + doc.getAttribute('data-doc') + ')는 사내 품의 시스템에서 열립니다(시안에서는 안내만).'); return; }
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'btn-add') openAdd();
    else if (b.getAttribute('data-change')) openChange(b.getAttribute('data-change'));
  });
  render();
})();
