/* =====================================================================
 * SCR-54 가격 기준 관리 화면 로직 (admin-prices.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-SCOPE-02(시스템에 두되 열람 제한), REQ-CHK-04(체크리스트 2, 3번 계산), REQ-CHK-07(적용 시작일, 품의 문서 링크)
 * 하는 일
 *   1. 오늘 적용되는 기준: 제품마다 적용 시작일이 오늘 이전인 줄 중 가장 늦은 것. 예정된 기준은 제품 아래에 표시
 *   2. 바꾸기, 제품 추가: 적용 시작일(오늘 이후), 품의 문서 링크(필수, https), 품의 번호(선택), 변경 사유(필수)
 *      기존 줄은 고치지 않고 새 줄을 더함. 이미 기안한 계약은 기안할 때의 기준을 씀
 *   3. 바뀐 이력: 모든 줄(지난 기준, 적용 중, 예정)
 * 볼 수 있는 사람: 영업, 세일즈어드민, 관리자(바꾸기는 관리자만). 슈퍼관리자는 모두
 * 프로토타입: 품의 문서 링크는 열리지 않음. 바꾼 내용은 이 브라우저에만 저장(시연 기록)
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  if (!C.gate(me, ['ADMIN', 'SALES', 'SALES_ADMIN'], '가격 기준은 영업, 세일즈어드민, 관리자만 볼 수 있습니다',
    '지금은 ' + esc(C.roleLabel(me.role)) + ' 역할로 보고 있습니다. 가격 기준은 열람을 제한하는 정보입니다(REQ-SCOPE-02).')) return;
  const canEdit = me.role === 'ADMIN' || me.role === 'SUPER';
  if (!canEdit) {
    $('#btn-add').hidden = true;
    $('#th-action').hidden = true;
    $('#intro-sub').textContent = '영업과 세일즈어드민은 볼 수만 있습니다. 가격 기준은 사내 품의 결재로 승인받은 뒤 관리자가 바꿉니다.';
  }

  function val(f, n) { return (f.elements[n].value || '').trim(); }
  function won(n) { return Number(n).toLocaleString('ko-KR') + '원'; }
  function pct(r) { return Math.round(r * 1000) / 10 + '%'; }
  function codes() {
    const list = [];
    D.PRICE_ROWS.forEach(function (r) { if (list.indexOf(r.code) < 0) list.push(r.code); });
    return list;
  }
  function current(code) { return D.PRICE_BOOK.filter(function (r) { return r.code === code; })[0] || null; }
  function planned(code) {
    return D.PRICE_ROWS.filter(function (r) { return r.code === code && r.validFrom > D.TODAY; })
      .sort(function (a, b) { return a.validFrom.localeCompare(b.validFrom); });
  }
  // 품의 문서: 번호를 보여 주고, 누르면 안내 (프로토타입에서는 열리지 않음)
  function docLink(r) {
    return '<a href="#" class="doc-link" data-doc="' + esc(r.docNo || r.docUrl) + '" title="' + esc(r.docUrl) + '">' + esc(r.docNo || '품의 문서') + '</a>';
  }

  /* ---------- 1. 오늘 적용되는 기준 ---------- */
  function render() {
    $('#today').textContent = C.fmtDate(D.TODAY) + ' 기준';
    $('#rows').innerHTML = codes().map(function (code) {
      const r = current(code), next = planned(code), any = r || next[0];
      const plan = next.map(function (p) {
        return '<span class="cell-meta">' + C.badge('line', '예정') + ' ' + C.fmtDate(p.validFrom) + '부터 ' + won(p.listPrice) + ', 한도 ' + pct(p.discountCap) + '</span>';
      }).join('');
      // 제품 칸 아래에 코드, 서비스, 단위를 함께 (A4 폭 안에 들어가게)
      return '<tr><td><span class="cell-strong">' + esc(any.name) + '</span>' +
          '<span class="cell-meta">' + esc(code + ', ' + (D.SERVICES[any.service] || any.service) + ', ' + any.unit) + '</span>' + plan + '</td>' +
        (r ? '<td class="num">' + won(r.listPrice) + '</td><td class="num">' + pct(r.discountCap) + '</td>' +
          '<td class="nowrap num-left">' + C.fmtDate(r.validFrom) + '</td><td class="nowrap">' + docLink(r) + '</td>'
          : '<td class="num" colspan="4">아직 적용 전</td>') +
        (canEdit ? '<td class="col-action"><button type="button" class="link-act" data-change="' + esc(code) + '" aria-label="' + esc(any.name) + ' 가격 기준 바꾸기">바꾸기</button></td>' : '') +
      '</tr>';
    }).join('');

    /* ---------- 3. 바뀐 이력 ---------- */
    const rows = D.PRICE_ROWS.slice().sort(function (a, b) { return b.validFrom.localeCompare(a.validFrom) || b.at.localeCompare(a.at); });
    $('#history').innerHTML = rows.map(function (r) {
      const state = r.validFrom > D.TODAY ? C.badge('line', '예정') : current(r.code) === r ? C.badge('success', '적용 중') : C.badge('neutral', '지난 기준');
      return '<tr' + (r.validFrom <= D.TODAY && current(r.code) !== r ? ' class="is-muted"' : '') + '>' +
        '<td class="nowrap num-left">' + C.fmtDate(r.validFrom) + '<span class="cell-meta">' + state + '</span></td>' +
        '<td><span class="cell-strong">' + esc(r.name) + '</span><span class="cell-meta">' + esc(r.code) + '</span></td>' +
        '<td class="num">' + won(r.listPrice) + '<span class="cell-meta">한도 ' + pct(r.discountCap) + '</span></td>' +
        '<td class="col-wide">' + esc(r.reason) + '<span class="cell-meta">품의 ' + docLink(r) + '</span></td>' +
        '<td class="nowrap">' + esc(C.userName(r.by)) + '님<span class="cell-meta">' + C.fmtDateTime(r.at) + '</span></td></tr>';
    }).join('');
  }

  /* ---------- 2. 바꾸기, 제품 추가 ---------- */
  // 가격과 근거 입력 칸 (바꾸기와 제품 추가가 같이 씀)
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
  function checkPrice(f, code, base) {
    const price = val(f, 'price').replace(/,/g, ''), cap = val(f, 'cap'), from = val(f, 'validFrom');
    const priceOk = /^\d+$/.test(price) && Number(price) > 0;
    const capOk = /^\d+(\.\d)?$/.test(cap) && Number(cap) <= 100;
    const same = base && priceOk && capOk && Number(price) === base.listPrice && Math.abs(Number(cap) / 100 - base.discountCap) < 0.0001;
    const dup = code && from && D.PRICE_ROWS.some(function (r) { return r.code === code && r.validFrom === from; });
    return {
      price: !priceOk ? '표준 단가를 원 단위 숫자로 넣으세요.' : same ? '표준 단가나 할인율 한도 중 하나는 지금과 달라야 합니다.' : '',
      cap: capOk ? '' : '할인율 한도를 0에서 100 사이로 넣으세요(소수점 한 자리까지).',
      validFrom: !from ? '적용 시작일을 고르세요.' : from < D.TODAY ? '적용 시작일은 오늘(' + C.fmtDate(D.TODAY) + ') 이후여야 합니다.'
        : dup ? '이 제품은 이 적용 시작일에 이미 기준이 있습니다.' : '',
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
    C.adminSave('PRICE', row.name + ' (' + row.code + ')', change + ' (' + C.fmtDate(row.validFrom) + '부터)', row.reason, { k: 'PRICE', row: row });
    render();
    C.toast(row.validFrom === D.TODAY ? row.name + ' 기준을 오늘부터 적용합니다.' : row.name + ' 기준이 ' + C.fmtDate(row.validFrom) + '부터 적용됩니다.');
  }
  function openChange(code) {
    const base = current(code) || planned(code)[0];
    C.formModal({
      title: base.name + ' 가격 기준을 바꿀까요?',
      desc: '적용 시작일부터 기안하는 계약에 새 기준을 씁니다. 지금 기준은 지우지 않고 이력으로 남습니다.',
      body: '<p class="modal-info">지금: 표준 단가 ' + won(base.listPrice) + ', 할인율 한도 ' + pct(base.discountCap) + ' (' + C.fmtDate(base.validFrom) + '부터)</p>' + priceFields(base),
      btn: '새 기준 저장',
      check: function (f) { return checkPrice(f, code, base); },
      done: function (f) {
        const row = rowFrom(f, { code: base.code, service: base.service, name: base.name, unit: base.unit });
        const parts = [];
        if (row.listPrice !== base.listPrice) parts.push('표준 단가 ' + won(base.listPrice) + ' → ' + won(row.listPrice));
        if (Math.abs(row.discountCap - base.discountCap) > 0.0001) parts.push('할인율 한도 ' + pct(base.discountCap) + ' → ' + pct(row.discountCap));
        saved(row, parts.join(', '));
      },
    });
  }
  function openAdd() {
    const services = C.codeList('SERVICE').filter(function (c) { return c.level === 1; }).map(function (c) { return [c.code, c.label]; });
    C.formModal({
      title: '제품을 추가할까요?',
      desc: '적용 시작일부터 계약 등록의 제품 목록에 나옵니다.',
      body: '<div class="field-row">' +
          C.fieldHtml({ name: 'code', label: '제품 코드', required: true, placeholder: '예: CK-EDU', help: '영문 대문자, 숫자, 하이픈. 한 번 정하면 바꾸지 않습니다.' }) +
          C.fieldHtml({ name: 'service', label: '서비스', type: 'select', required: true, options: [['', '고르세요']].concat(services) }) +
        '</div><div class="field-row">' +
          C.fieldHtml({ name: 'pname', label: '제품 이름', required: true, placeholder: '예: CK 교육 패키지' }) +
          C.fieldHtml({ name: 'unit', label: '단위', required: true, placeholder: '예: 기관, 1년' }) +
        '</div>' + priceFields(null),
      btn: '제품 추가',
      check: function (f) {
        const code = val(f, 'code').toUpperCase();
        return Object.assign(checkPrice(f, code, null), {
          code: !/^[A-Z0-9]+(-[A-Z0-9]+)*$/.test(code) ? '제품 코드를 영문 대문자, 숫자, 하이픈으로 넣으세요.'
            : codes().indexOf(code) > -1 ? '이미 있는 제품 코드입니다.' : '',
          service: val(f, 'service') ? '' : '서비스를 고르세요.',
          pname: val(f, 'pname') ? '' : '제품 이름을 넣으세요.',
          unit: val(f, 'unit') ? '' : '단위를 넣으세요.',
        });
      },
      done: function (f) {
        const row = rowFrom(f, { code: val(f, 'code').toUpperCase(), service: val(f, 'service'), name: val(f, 'pname'), unit: val(f, 'unit') });
        saved(row, '제품 추가: 표준 단가 ' + won(row.listPrice) + ', 할인율 한도 ' + pct(row.discountCap));
      },
    });
  }

  $('#content').addEventListener('click', function (e) {
    const doc = e.target.closest('[data-doc]');
    if (doc) { e.preventDefault(); C.toast('품의 문서(' + doc.getAttribute('data-doc') + ')는 사내 품의 시스템에서 열립니다. 시안에서는 열리지 않습니다.'); return; }
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'btn-add') openAdd();
    else if (b.getAttribute('data-change')) openChange(b.getAttribute('data-change'));
  });
  render();
})();
