/* =====================================================================
 * SCR-55 거래처 관리 화면 로직 (admin-customers.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-REG-18(거래처 목록에서 고르기, 관리자가 고치고 합침), 데이터 정의서 6장(customer), D-01
 * 하는 일
 *   1. 거래처 목록: 상호, 사업자등록번호, 계약 수, 등록한 사람과 날짜, 상태. 검색과 상태 거르기, 한 쪽 20곳
 *   2. 같은 거래처로 보이는 곳 알림: 사업자등록번호 앞 6자리(000-00)가 같고 상호 하나가 다른 하나를 품음 [가정]
 *   3. 합치기: 둘 이상 골라 남길 거래처를 정함. 나머지의 계약은 남길 거래처로 옮기고, 나머지는 "합쳐짐"으로 남김
 *   4. 고치기(상호, 사업자등록번호, 사용 여부), 거래처 추가. 사업자등록번호는 중복 불가
 *   5. 변경 이력
 * 프로토타입: 계약은 상호로 연결되어 있어 상호를 바꾸거나 합치면 계약의 상호를 바꿔 보여 줌.
 *   실제 시스템은 계약이 거래처 번호(customer_id)로 연결되므로 거래처만 바꾸면 됨. 바꾼 내용은 이 브라우저에만 저장(시연 기록)
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  if (!C.gate(me, ['ADMIN'], '거래처 관리는 관리자만 씁니다')) return;

  const PAGE_SIZE = 20; // 한 쪽 20곳: 화면이 A4 2장을 넘지 않게 (REQ-ADM-04와 같은 기준)
  let page = 1;
  let picked = [];
  const STATE = { USE: ['success', '사용 중'], OFF: ['neutral', '사용 안 함'], MERGED: ['neutral', '합쳐짐'] };

  function val(f, n) { return (f.elements[n].value || '').trim(); }
  function find(id) { return D.CUSTOMERS.filter(function (cu) { return cu.id === id; })[0]; }
  function stateOf(cu) { return cu.mergedInto ? 'MERGED' : cu.use ? 'USE' : 'OFF'; }
  function contractsOf(cu) { return D.CONTRACTS.filter(function (c) { return c.id && c.counterparty === cu.name; }).length; }
  function tag(cu) { return cu.name + '(' + cu.id + ')'; }
  // 받침에 따라 "로"와 "으로" (ㄹ 받침은 "로")
  function ro(word) {
    const code = word.charCodeAt(word.length - 1) - 0xAC00;
    if (code < 0 || code > 11171) return word + '(으)로';
    const jong = code % 28;
    return word + (jong === 0 || jong === 8 ? '로' : '으로');
  }

  /* ---------- 2. 같은 거래처로 보이는 곳 ---------- */
  function dupPairs() {
    const list = D.CUSTOMERS.filter(function (cu) { return stateOf(cu) === 'USE'; });
    const out = [];
    list.forEach(function (a, i) {
      list.slice(i + 1).forEach(function (b) {
        const near = a.bizNo.slice(0, 6) === b.bizNo.slice(0, 6) && (a.name.indexOf(b.name) > -1 || b.name.indexOf(a.name) > -1);
        if (near) out.push([a, b]);
      });
    });
    return out;
  }

  /* ---------- 1. 목록 ---------- */
  function filtered() {
    const q = $('#f-q').value.trim().toLowerCase(), st = $('#f-use').value;
    return D.CUSTOMERS.filter(function (cu) {
      if (q && cu.name.toLowerCase().indexOf(q) < 0 && cu.bizNo.indexOf(q) < 0) return false;
      if (st && stateOf(cu) !== st) return false;
      return true;
    });
  }
  function render() {
    const pairs = dupPairs();
    $('#dup').innerHTML = pairs.length ? '<div class="notice" role="status"><p class="notice-title">' + C.icon('alert') + '같은 거래처로 보이는 곳이 있습니다</p>' +
      '<p class="notice-body">' + pairs.map(function (p) { return '<strong>' + esc(tag(p[0]) + ', ' + tag(p[1])) + '</strong>'; }).join('<br>') +
      '<br>사업자등록번호 앞자리가 같고 상호가 비슷합니다. 사업자등록증을 확인한 뒤 같은 곳이면 둘을 골라 합치세요.</p></div>' : '';

    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (page > pages) page = pages;
    const from = (page - 1) * PAGE_SIZE, rows = list.slice(from, from + PAGE_SIZE);
    const counts = Object.keys(STATE).map(function (k) { return STATE[k][1] + ' ' + list.filter(function (cu) { return stateOf(cu) === k; }).length + '곳'; });
    $('#list-count').innerHTML = C.meta(['<strong>' + (list.length !== D.CUSTOMERS.length ? '검색 결과 ' : '전체 ') + list.length + '곳</strong>'].concat(counts));
    $('#rows').innerHTML = rows.length ? rows.map(function (cu) {
      const st = stateOf(cu), into = cu.mergedInto ? find(cu.mergedInto) : null;
      return '<tr' + (st !== 'USE' ? ' class="is-muted"' : '') + '>' +
        '<td class="col-action">' + (st === 'USE' ? '<label class="choice choice--only"><input type="checkbox" data-pick="' + esc(cu.id) + '"' +
          (picked.indexOf(cu.id) > -1 ? ' checked' : '') + ' aria-label="' + esc(cu.name) + ' 합치기에 고르기"></label>' : '') + '</td>' +
        '<td><span class="cell-strong">' + esc(cu.name) + '</span><span class="cell-meta">' + esc(cu.id) + (into ? ', ' + esc(ro(into.name)) + ' 합쳐짐' : '') + '</span></td>' +
        '<td class="num-left">' + esc(cu.bizNo) + '</td>' +
        '<td class="num">' + contractsOf(cu) + '건</td>' +
        '<td class="nowrap">' + esc(C.userName(cu.registeredBy)) + '님<span class="cell-meta">' + C.fmtDate(cu.registeredAt) + '</span></td>' +
        '<td class="nowrap">' + C.badge(STATE[st][0], STATE[st][1]) + '</td>' +
        '<td class="col-action">' + (st === 'MERGED' ? '-' : '<button type="button" class="link-act" data-edit="' + esc(cu.id) + '" aria-label="' + esc(cu.name) + ' 고치기">고치기</button>') + '</td></tr>';
    }).join('') : '<tr><td class="empty-row" colspan="7">조건에 맞는 거래처가 없습니다.</td></tr>';
    $('#pagination').innerHTML = C.pagerHtml(page, pages, list.length, from, rows.length, PAGE_SIZE, '곳');
    $('#btn-merge').disabled = picked.length < 2;
    $('#btn-merge').textContent = '고른 거래처 합치기' + (picked.length ? ' (' + picked.length + '곳)' : '');
    $('#history').innerHTML = C.adminHistoryHtml(C.adminLog(['CUSTOMER']), '거래처 변경 이력');
  }

  /* ---------- 3. 합치기 ---------- */
  function openMerge() {
    const list = picked.map(find);
    C.formModal({
      title: '거래처 ' + list.length + '곳을 합칠까요?',
      desc: '합치면 남길 거래처 하나만 남고, 나머지 거래처의 계약은 남길 거래처로 옮겨집니다. 나머지 거래처는 지우지 않고 "합쳐짐"으로 남습니다.',
      body: '<fieldset class="field" data-field="keep"><legend class="field-label">남길 거래처<span class="req" aria-hidden="true">*</span><span class="sr-only">(필수)</span></legend>' +
          '<div class="choice-col">' + list.map(function (cu) {
            return '<label class="choice"><input type="radio" name="keep" value="' + esc(cu.id) + '">' + esc(cu.name + ' (' + cu.bizNo + ', 계약 ' + contractsOf(cu) + '건)') + '</label>';
          }).join('') + '</div><p class="field-help">사업자등록증과 같은 상호와 번호를 가진 거래처를 남깁니다.</p><p class="field-error" hidden></p></fieldset>' +
        C.fieldHtml({ name: 'reason', label: '합치는 사유', type: 'textarea', required: true, placeholder: '예: 같은 곳을 줄인 이름으로 한 번 더 등록함. 사업자등록증으로 확인' }),
      btn: '합치기',
      check: function (f) {
        return { keep: f.querySelector('[name="keep"]:checked') ? '' : '남길 거래처를 고르세요.', reason: val(f, 'reason') ? '' : '합치는 사유를 적으세요.' };
      },
      done: function (f) {
        const keep = find(f.querySelector('[name="keep"]:checked').value);
        const others = list.filter(function (cu) { return cu !== keep; });
        C.adminSave('CUSTOMER', list.map(function (cu) { return cu.name; }).join(', '),
          '합치기: ' + others.map(tag).join(', ') + ' → ' + tag(keep), val(f, 'reason'),
          { k: 'CUSTOMER_MERGE', keep: keep.id, ids: others.map(function (cu) { return cu.id; }) });
        picked = [];
        render();
        C.toast(ro(keep.name) + ' 합쳤습니다.');
      },
    });
  }

  /* ---------- 4. 고치기, 추가 ---------- */
  function bizNoError(v, selfId) {
    if (!/^\d{3}-\d{2}-\d{5}$/.test(v)) return '사업자등록번호 10자리를 넣으세요.';
    if (!C.isBizNo(v)) return '사업자등록번호가 맞지 않습니다. 사업자등록증의 숫자를 다시 확인하세요.'; // 검증 숫자 규칙 (v0.32)
    const dup = D.CUSTOMERS.filter(function (cu) { return cu.bizNo === v && cu.id !== selfId; })[0];
    return dup ? '이미 등록된 사업자등록번호입니다(' + dup.name + ').' : '';
  }
  function formatOnInput(f) {
    // 숫자만 넣으면 '-'를 붙여 보여 줌 (v0.34)
    f.elements.bizNo.addEventListener('input', function (e) { e.target.value = C.fmtBizNo(e.target.value); });
  }
  function openEdit(id) {
    const cu = find(id);
    C.formModal({
      title: cu.name + ' 거래처를 고칠까요?',
      desc: '상호를 바꾸면 이 거래처의 모든 계약에 새 상호가 보입니다. 사용 안 함으로 돌리면 계약 등록에서 고를 수 없습니다.',
      body: C.fieldHtml({ name: 'cuName', label: '상호', required: true, value: cu.name, help: '사업자등록증의 상호' }) +
        C.fieldHtml({ name: 'bizNo', label: '사업자등록번호', required: true, value: cu.bizNo, help: "'-' 없이 숫자만 넣으면 됩니다.", attrs: ' inputmode="numeric" maxlength="12"' }) +
        C.fieldHtml({ name: 'use', label: '상태', type: 'select', value: String(cu.use), options: [['true', '사용 중'], ['false', '사용 안 함']] }) +
        C.fieldHtml({ name: 'reason', label: '고치는 사유', type: 'textarea', required: true, placeholder: '예: 사업자등록증의 상호로 바로잡음' }),
      btn: '저장',
      open: formatOnInput,
      check: function (f) {
        const same = val(f, 'cuName') === cu.name && val(f, 'bizNo') === cu.bizNo && val(f, 'use') === String(cu.use);
        return {
          cuName: !val(f, 'cuName') ? '상호를 넣으세요.' : same ? '바뀐 내용이 없습니다.' : '',
          bizNo: bizNoError(val(f, 'bizNo'), cu.id),
          reason: val(f, 'reason') ? '' : '고치는 사유를 적으세요.',
        };
      },
      done: function (f) {
        const set = { name: val(f, 'cuName'), bizNo: val(f, 'bizNo'), use: val(f, 'use') === 'true' };
        const parts = [];
        if (set.name !== cu.name) parts.push('상호: ' + cu.name + ' → ' + set.name);
        if (set.bizNo !== cu.bizNo) parts.push('사업자등록번호: ' + cu.bizNo + ' → ' + set.bizNo);
        if (set.use !== cu.use) parts.push('상태: ' + (cu.use ? '사용 중 → 사용 안 함' : '사용 안 함 → 사용 중'));
        C.adminSave('CUSTOMER', tag(cu), parts.join(', '), val(f, 'reason'), { k: 'CUSTOMER_EDIT', id: cu.id, set: set });
        render();
        C.toast(set.name + ' 거래처를 고쳤습니다.');
      },
    });
  }
  function openAdd() {
    C.formModal({
      title: '거래처를 추가할까요?',
      desc: '추가하면 계약 등록의 거래처 목록에서 고를 수 있습니다.',
      body: C.fieldHtml({ name: 'cuName', label: '상호', required: true, placeholder: '예: 주식회사 가나다', help: '사업자등록증의 상호' }) +
        C.fieldHtml({ name: 'bizNo', label: '사업자등록번호', required: true, placeholder: '예: 123-45-67890', help: "'-' 없이 숫자만 넣으면 됩니다.", attrs: ' inputmode="numeric" maxlength="12"' }) +
        C.fieldHtml({ name: 'reason', label: '추가하는 사유', type: 'textarea', required: true, placeholder: '예: 조달 계약 예정 기관을 미리 등록' }),
      btn: '추가',
      open: formatOnInput,
      check: function (f) {
        return { cuName: val(f, 'cuName') ? '' : '상호를 넣으세요.', bizNo: bizNoError(val(f, 'bizNo'), null), reason: val(f, 'reason') ? '' : '추가하는 사유를 적으세요.' };
      },
      done: function (f) {
        const cu = { id: 'C-' + String(D.CUSTOMERS.length + 1).padStart(4, '0'), name: val(f, 'cuName'), bizNo: val(f, 'bizNo') };
        C.adminSave('CUSTOMER', tag(cu), '거래처 추가: ' + cu.bizNo, val(f, 'reason'), { k: 'CUSTOMER_ADD', cu: cu });
        render();
        C.toast(cu.name + ' 거래처를 추가했습니다.');
      },
    });
  }

  /* ---------- 이벤트 ---------- */
  $('#filter').addEventListener('input', function () { page = 1; render(); });
  $('#filter').addEventListener('change', function () { page = 1; render(); });
  $('#filter').addEventListener('reset', function () { setTimeout(function () { page = 1; render(); }, 0); });
  $('#filter').addEventListener('submit', function (e) { e.preventDefault(); });
  $('#content').addEventListener('change', function (e) {
    const id = e.target.getAttribute('data-pick');
    if (!id) return;
    picked = e.target.checked ? picked.concat([id]) : picked.filter(function (x) { return x !== id; });
    $('#btn-merge').disabled = picked.length < 2;
    $('#btn-merge').textContent = '고른 거래처 합치기' + (picked.length ? ' (' + picked.length + '곳)' : '');
  });
  $('#content').addEventListener('click', function (e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'btn-add') openAdd();
    else if (b.id === 'btn-merge') openMerge();
    else if (b.getAttribute('data-edit')) openEdit(b.getAttribute('data-edit'));
    else if (b.getAttribute('data-page') && !b.disabled) { page = Number(b.getAttribute('data-page')); render(); $('#sec-list').scrollIntoView({ block: 'start' }); }
  });
  render();
})();
