/* =====================================================================
 * SCR-58 제품과 기능 관리 화면 로직 (admin-products.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-ADM-23(v0.47 기획자 요청, v0.49 두 단계로 줄임), REQ-SCOPE-02(가격 기준), 데이터 정의서 product, feature
 * 서비스 > 제품 > 기능 = 대분류 > 중분류 > 소분류(v0.56 기획자 결정). 서비스는 CK, HR, 기타 세 가지. 플랜 없음, 가격은 기능마다 하나(v0.49)
 *   제품을 더할 때 관리자가 서비스(대분류)를 고름(v0.56: 제품 이름에서 저절로 정하던 것은 없앰)
 * 하는 일
 *   1. 제품과 기능 표: 제품마다 기능, 오늘 적용되는 가격(가격 기준 관리에서 정함, 보기만), 상태. 서비스로 거름
 *   2. 제품 추가: 서비스(대분류), 제품 이름, 사유. 추가하면 이어서 기능 추가 창이 열림
 *   3. 제품 고치기: 이름, 서비스(가격이 없는 제품만), 사용 여부, 사유
 *   4. 기능 추가: 한 줄에 하나씩 여러 개를 한 번에(예: 프리즘의 결함검사, 표절검사 ...), 사유
 *   5. 기능 고치기: 이름, 사용 여부, 사유
 *   6. 변경 이력 (C.adminSave 영역 PRODUCT)
 * 규칙: 지우지 않고 사용 안 함으로 돌림(지난 계약과 가격 기준 이력의 뜻이 남게). 같은 서비스 안 제품 이름, 같은 제품 안 기능 이름은 겹칠 수 없음
 *       사용 안 함인 제품과 기능은 계약 등록과 가격 기준의 가격 추가에서 고를 수 없고, 이미 기안한 계약에는 그대로 보임
 * 쓰는 사람: 관리자와 최고관리자(기획자 요청). 제품 id와 기능 id는 시스템이 정함(P001, F001 ...)
 * 프로토타입: 바꾼 내용은 이 브라우저에만 저장(시연 기록). [가정] 실제 시스템은 기안할 때의 이름을 계약 줄에 함께 저장
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  if (!C.gate(me, ['ADMIN'], '제품과 기능 관리는 관리자와 최고관리자만 씁니다')) return;

  let svc = 'ALL'; // 거르는 서비스 (ALL: 전체)
  function val(f, n) { return (f.elements[n].value || '').trim(); }
  function find(list, id) { return list.filter(function (x) { return x.id === id; })[0]; }
  function sameName(a, b) { return a.replace(/\s+/g, '').toLowerCase() === b.replace(/\s+/g, '').toLowerCase(); }
  function featuresOf(pid) { return D.FEATURES.filter(function (f) { return f.product === pid; }); }
  // 새 id: 접두어 + 세 자리 일련번호 (겹치면 다음 번호)
  function newId(prefix, list, skip) {
    let n = list.length + 1, id;
    do { id = prefix + String(n).padStart(3, '0'); n += 1; } while (list.some(function (x) { return x.id === id; }) || (skip || []).indexOf(id) > -1);
    return id;
  }
  // 가격: 기능마다 하나(v0.49). 오늘 적용되는 것(PRICE_BOOK)과 아직 적용 전인 예정 줄
  function priceOf(fid) { return D.PRICE_BOOK.filter(function (r) { return r.feature === fid; })[0] || null; }
  function plannedOf(fid) {
    return D.PRICE_ROWS.filter(function (r) { return r.feature === fid && r.validFrom > D.TODAY; })
      .sort(function (a, b) { return a.validFrom.localeCompare(b.validFrom); });
  }
  function won(n) { return Number(n).toLocaleString('ko-KR') + '원'; }
  function rowsOfProduct(pid) { return D.PRICE_ROWS.filter(function (r) { return r.product === pid; }); }
  // 이 제품이나 기능을 쓰는 계약 수 (기안한 계약만). 계약 제품 줄의 feature가 기능 id
  function contractCount(test) {
    return D.CONTRACTS.filter(function (c) {
      return c.id && (c.products || (c.form || {}).products || []).some(function (l) {
        const ft = find(D.FEATURES, l.feature);
        return ft && test(ft);
      });
    }).length;
  }
  function services() { return C.codeList('SERVICE', true).filter(function (c) { return c.use || D.PRODUCTS.some(function (p) { return p.service === c.code; }); }); }
  function useBadge(on) { return on ? C.badge('success', '사용 중') : C.badge('neutral', '사용 안 함'); }

  /* ---------- 1. 제품과 기능 표 ---------- */
  function render() {
    $('#services').innerHTML = [['ALL', '전체']].concat(services().map(function (c) { return [c.code, c.label]; })).map(function (s) {
      return '<button type="button" data-svc="' + esc(s[0]) + '" aria-pressed="' + (s[0] === svc) + '">' + esc(s[1]) + '</button>';
    }).join('');
    // 서비스 순서(코드 관리의 순서)로 묶고, 같은 서비스 안에서는 넣은 순서
    const order = services().map(function (c) { return c.code; });
    const list = D.PRODUCTS.filter(function (p) { return svc === 'ALL' || p.service === svc; })
      .map(function (p, i) { return { p: p, k: [order.indexOf(p.service), i] }; })
      .sort(function (a, b) { return a.k[0] - b.k[0] || a.k[1] - b.k[1]; })
      .map(function (x) { return x.p; });
    const fCount = list.reduce(function (n, p) { return n + featuresOf(p.id).length; }, 0);
    $('#count').textContent = '제품 ' + list.length + '개, 기능 ' + fCount + '개';
    const table = $('#product-table');
    Array.prototype.forEach.call(table.querySelectorAll('tbody'), function (b) { b.remove(); });
    table.insertAdjacentHTML('beforeend', list.length ? list.map(function (p) {
      const feats = featuresOf(p.id);
      const head = '<tr class="prod-row' + (p.use ? '' : ' is-muted') + '">' +
        '<th scope="rowgroup" colspan="2"><span class="cell-strong">' + esc(p.name) + '</span>' +
          '<span class="cell-meta">' + esc(C.serviceLabel([p.service])) + ', 기능 ' + feats.length + '개' + (p.crm ? ', CRM ' + esc(p.crm) : '') + '</span></th>' +
        '<td class="nowrap">' + useBadge(p.use) + '</td>' +
        '<td class="col-action"><button type="button" class="link-act" data-edit-product="' + esc(p.id) + '" aria-label="' + esc(p.name) + ' 고치기">고치기</button>' +
          '<button type="button" class="link-act" data-add-feature="' + esc(p.id) + '" aria-label="' + esc(p.name) + ' 기능 추가">기능 추가</button></td></tr>';
      const body = feats.length ? feats.map(function (f) {
        const now = priceOf(f.id), next = plannedOf(f.id);
        const price = (now ? won(now.listPrice) + '<span class="cell-meta">' + esc(now.unit) + ', 할인율 한도 ' + Math.round(now.discountCap * 1000) / 10 + '%</span>' : '') +
          next.map(function (r) { return '<span class="cell-meta">' + C.badge('line', '예정') + ' ' + C.fmtDate(r.validFrom) + '부터 ' + won(r.listPrice) + '</span>'; }).join('');
        return '<tr class="feat-row' + (f.use && p.use ? '' : ' is-muted') + '"><td class="feat-name">' + (f.name ? esc(f.name) : '<span class="cell-meta">기능 구분 없음</span>') + (!p.crm && f.crm ? '<span class="cell-meta">CRM ' + esc(f.crm) + '</span>' : '') + '</td>' +
          '<td class="num">' + (price || '<span class="cell-meta">가격 없음</span>') + '</td>' +
          '<td class="nowrap">' + useBadge(f.use) + '</td>' +
          '<td class="col-action"><button type="button" class="link-act" data-edit-feature="' + esc(f.id) + '" aria-label="' + esc(p.name + ' ' + f.name) + ' 고치기">고치기</button></td></tr>';
      }).join('') : '<tr><td class="empty-row" colspan="4">기능이 없습니다. 기능 추가로 넣습니다.</td></tr>';
      return '<tbody>' + head + body + '</tbody>';
    }).join('') : '<tbody><tr><td class="empty-row" colspan="4">이 서비스에는 제품이 없습니다.</td></tr></tbody>');
    $('#history').innerHTML = C.adminHistoryHtml(C.adminLog(['PRODUCT']), '제품과 기능 변경 이력');
  }

  /* ---------- 2. 제품 추가 ----------
   * 서비스 > 제품 > 기능(대분류 > 중분류 > 소분류, v0.56 기획자 결정): 제품은 어느 서비스(CK, HR, 기타) 아래인지 먼저 고름.
   * 위에서 서비스 묶음을 골라 두었으면 그 서비스로 미리 채움. (v0.49~v0.55는 제품 이름에서 서비스를 저절로 정했음) */
  function openAddProduct() {
    const opts = C.codeList('SERVICE').map(function (c) { return [c.code, c.label]; });
    C.formModal({
      title: '제품을 추가할까요?',
      desc: '추가하면 이어서 기능을 넣는 창이 열립니다. 가격은 가격 기준 관리에서 기능마다 정합니다.',
      body: '<div class="field-row">' +
          C.fieldHtml({ name: 'name', label: '제품 이름', required: true, placeholder: '예: 카피킬러 캠퍼스', attrs: ' maxlength="40"' }) +
          C.fieldHtml({ name: 'service', label: '서비스(대분류)', type: 'select', required: true, value: svc === 'ALL' ? '' : svc, options: [['', '고르세요']].concat(opts),
            help: '제품이 들어갈 서비스입니다. 서비스 > 제품 > 기능 순서로 나뉩니다.' }) +
        '</div>' +
        C.fieldHtml({ name: 'reason', label: '추가하는 사유', type: 'textarea', required: true, placeholder: '예: 신규 제품 출시' }),
      btn: '제품 추가',
      check: function (f) {
        const s = val(f, 'service'), name = val(f, 'name');
        return {
          service: s ? '' : '서비스를 고르세요.',
          name: !name ? '제품 이름을 넣으세요.'
            : D.PRODUCTS.some(function (p) { return p.service === s && sameName(p.name, name); }) ? '이 서비스에 같은 이름의 제품이 이미 있습니다.' : '',
          reason: val(f, 'reason') ? '' : '추가하는 사유를 적으세요.',
        };
      },
      done: function (f) {
        const p = { id: newId('P', D.PRODUCTS), service: val(f, 'service'), name: val(f, 'name') };
        C.adminSave('PRODUCT', p.name + ' (' + p.id + ')', '제품 추가 (서비스: ' + C.serviceLabel([p.service]) + ')', val(f, 'reason'), { k: 'PRODUCT_ADD', p: p });
        svc = svc === 'ALL' ? 'ALL' : p.service;
        render();
        C.toast(p.name + ' 제품을 추가했습니다. 이어서 기능을 넣습니다.');
        openAddFeatures(p.id);
      },
    });
  }

  /* ---------- 3. 제품 고치기 ---------- */
  function openEditProduct(id) {
    const p = find(D.PRODUCTS, id);
    const hasPrice = rowsOfProduct(id).length > 0;
    const used = contractCount(function (r) { return r.product === id; });
    C.formModal({
      title: '제품을 고칠까요? (' + p.name + ')',
      desc: '이름을 바꾸면 계약 등록과 견적에서 고를 때부터 새 이름이 보이고, 이미 기안한 계약은 기안할 때의 이름을 그대로 둡니다. 사용 안 함으로 돌리면 이 제품의 기능을 계약 등록에서 고를 수 없고, 이미 기안한 계약에는 그대로 보입니다.',
      body: '<p class="modal-info">' + esc(C.serviceLabel([p.service])) + ', 기능 ' + featuresOf(id).length + '개, 가격이 있는 기능 ' + D.PRICE_BOOK.filter(function (r) { return r.product === id; }).length + '개, 계약 ' + used + '건</p>' +
        C.fieldHtml({ name: 'name', label: '제품 이름', required: true, value: p.name, attrs: ' maxlength="40"' }) +
        // 서비스는 계약을 구분하는 값이라 가격 기준이 있는 제품은 바꾸지 않음
        C.fieldHtml({ name: 'service', label: '서비스', type: 'select', value: p.service,
          options: C.codeList('SERVICE', true).filter(function (c) { return c.use || c.code === p.service; }).map(function (c) { return [c.code, c.label]; }),
          attrs: hasPrice ? ' disabled' : '', help: hasPrice ? '가격이 있는 제품은 서비스를 바꿀 수 없습니다(계약의 서비스가 바뀌기 때문).' : '' }) +
        C.fieldHtml({ name: 'use', label: '상태', type: 'select', value: String(p.use), options: [['true', '사용 중'], ['false', '사용 안 함']] }) +
        C.fieldHtml({ name: 'reason', label: '고치는 사유', type: 'textarea', required: true, placeholder: '예: 제품 이름 변경' }),
      btn: '저장',
      check: function (f) {
        const name = val(f, 'name'), s = hasPrice ? p.service : val(f, 'service'), use = val(f, 'use') === 'true';
        return {
          name: !name ? '제품 이름을 넣으세요.'
            : D.PRODUCTS.some(function (x) { return x !== p && x.service === s && sameName(x.name, name); }) ? '이 서비스에 같은 이름의 제품이 이미 있습니다.'
            : name === p.name && s === p.service && use === p.use ? '바뀐 내용이 없습니다.' : '',
          reason: val(f, 'reason') ? '' : '고치는 사유를 적으세요.',
        };
      },
      done: function (f) {
        const set = { name: val(f, 'name'), use: val(f, 'use') === 'true' };
        if (!hasPrice && val(f, 'service') !== p.service) set.service = val(f, 'service');
        const parts = [];
        if (set.name !== p.name) parts.push('이름: ' + p.name + ' → ' + set.name);
        if (set.service) parts.push('서비스: ' + C.serviceLabel([p.service]) + ' → ' + C.serviceLabel([set.service]));
        if (set.use !== p.use) parts.push('상태: ' + (p.use ? '사용 중 → 사용 안 함' : '사용 안 함 → 사용 중'));
        C.adminSave('PRODUCT', p.name + ' (' + p.id + ')', parts.join(', '), val(f, 'reason'), { k: 'PRODUCT_EDIT', id: p.id, set: set });
        render();
        C.toast('제품을 고쳤습니다: ' + set.name);
      },
    });
  }

  /* ---------- 4. 기능 추가 (한 줄에 하나, 여러 개를 한 번에) ---------- */
  function namesFrom(f) {
    const out = [];
    val(f, 'names').split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (s) {
      if (!out.some(function (x) { return sameName(x, s); })) out.push(s);
    });
    return out;
  }
  function openAddFeatures(pid) {
    const p = find(D.PRODUCTS, pid);
    const have = featuresOf(pid);
    C.formModal({
      title: p.name + '에 기능을 추가할까요?',
      desc: '추가한 기능은 가격 기준 관리에서 가격을 정하면 계약 등록에서 고를 수 있습니다.',
      body: (have.length ? '<p class="modal-info">지금 기능: ' + esc(have.map(function (x) { return x.name; }).join(', ')) + '</p>' : '') +
        C.fieldHtml({ name: 'names', label: '기능 이름', type: 'textarea', required: true, placeholder: '예:\n결함검사\n표절검사\nGPT Killer',
          help: '한 줄에 하나씩 적습니다. 여러 개를 한 번에 넣을 수 있습니다.', attrs: ' rows="6"' }) +
        C.fieldHtml({ name: 'reason', label: '추가하는 사유', type: 'textarea', required: true, placeholder: '예: 프리즘 기능 목록 등록' }),
      btn: '기능 추가',
      check: function (f) {
        const names = namesFrom(f);
        const dup = names.filter(function (n) { return have.some(function (x) { return sameName(x.name, n); }); });
        const long = names.filter(function (n) { return n.length > 40; });
        return {
          names: !names.length ? '기능 이름을 한 줄에 하나씩 넣으세요.'
            : dup.length ? '이 제품에 이미 있는 기능입니다: ' + dup.join(', ') + '. 빼고 넣으세요.'
            : long.length ? '기능 이름은 40자까지 넣을 수 있습니다: ' + long[0].slice(0, 20) + '…' : '',
          reason: val(f, 'reason') ? '' : '추가하는 사유를 적으세요.',
        };
      },
      done: function (f) {
        const ids = [];
        const list = namesFrom(f).map(function (n) { const id = newId('F', D.FEATURES, ids); ids.push(id); return { id: id, product: pid, name: n }; });
        C.adminSave('PRODUCT', p.name + ' (' + p.id + ')', '기능 추가: ' + list.map(function (x) { return x.name; }).join(', '), val(f, 'reason'), { k: 'FEATURE_ADD', list: list });
        render();
        C.toast(p.name + '에 기능 ' + list.length + '개를 추가했습니다.');
      },
    });
  }

  /* ---------- 5. 기능 고치기 ---------- */
  function openEditFeature(id) {
    const ft = find(D.FEATURES, id), p = find(D.PRODUCTS, ft.product);
    const used = contractCount(function (x) { return x.id === id; });
    const now = priceOf(id);
    C.formModal({
      title: '기능을 고칠까요? (' + p.name + ' ' + ft.name + ')',
      desc: '이름을 바꾸면 계약 등록과 견적에서 고를 때부터 새 이름이 보이고, 이미 기안한 계약은 기안할 때의 이름을 그대로 둡니다. 사용 안 함으로 돌리면 이 기능을 계약 등록에서 고를 수 없고, 이미 기안한 계약에는 그대로 보입니다.',
      body: '<p class="modal-info">제품 ' + esc(p.name) + ', 가격 ' + (now ? won(now.listPrice) + ' (' + esc(now.unit) + ')' : '없음') + ', 계약 ' + used + '건</p>' +
        C.fieldHtml({ name: 'name', label: '기능 이름', required: true, value: ft.name, attrs: ' maxlength="40"' }) +
        C.fieldHtml({ name: 'use', label: '상태', type: 'select', value: String(ft.use), options: [['true', '사용 중'], ['false', '사용 안 함']] }) +
        C.fieldHtml({ name: 'reason', label: '고치는 사유', type: 'textarea', required: true, placeholder: '예: 기능 이름 변경' }),
      btn: '저장',
      check: function (f) {
        const name = val(f, 'name'), use = val(f, 'use') === 'true';
        return {
          // 기능 구분 없음(이름이 빈 기능, 예: 카피킬러 플러그인)은 이름 없이 상태만 바꿀 수 있음 (v0.58 QA)
          name: !name && ft.name ? '기능 이름을 넣으세요.'
            : featuresOf(p.id).some(function (x) { return x !== ft && sameName(x.name, name); }) ? '이 제품에 같은 이름의 기능이 이미 있습니다.'
            : name === ft.name && use === ft.use ? '바뀐 내용이 없습니다.' : '',
          reason: val(f, 'reason') ? '' : '고치는 사유를 적으세요.',
        };
      },
      done: function (f) {
        const set = { name: val(f, 'name'), use: val(f, 'use') === 'true' };
        const parts = [];
        if (set.name !== ft.name) parts.push('기능 이름: ' + ft.name + ' → ' + set.name);
        if (set.use !== ft.use) parts.push(ft.name + ' 상태: ' + (ft.use ? '사용 중 → 사용 안 함' : '사용 안 함 → 사용 중'));
        C.adminSave('PRODUCT', p.name + ' (' + p.id + ')', parts.join(', '), val(f, 'reason'), { k: 'FEATURE_EDIT', id: ft.id, set: set });
        render();
        C.toast('기능을 고쳤습니다: ' + p.name + ' ' + set.name);
      },
    });
  }

  $('#content').addEventListener('click', function (e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.getAttribute('data-svc')) { svc = b.getAttribute('data-svc'); render(); }
    else if (b.id === 'btn-add') openAddProduct();
    else if (b.getAttribute('data-edit-product')) openEditProduct(b.getAttribute('data-edit-product'));
    else if (b.getAttribute('data-add-feature')) openAddFeatures(b.getAttribute('data-add-feature'));
    else if (b.getAttribute('data-edit-feature')) openEditFeature(b.getAttribute('data-edit-feature'));
  });
  render();
})();
