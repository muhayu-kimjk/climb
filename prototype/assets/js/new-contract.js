/* =====================================================================
 * SCR-11 새 계약 등록 화면 로직 (new-contract.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: 요구사항 정의서 3.4(입력 항목), 3.5(체크리스트와 결재선),
 *   REQ-FLOW-14(임시 저장, 기안), REQ-FLOW-17(재기안은 다음 차수), REQ-FLOW-18(변경, 연장 묶음 번호),
 *   REQ-SCOPE-02, REQ-CHK-04(가격 기준으로 체크리스트 2, 3번 자동 계산), REQ-CHK-05(결재선 자동)
 * 하는 일
 *   1. 영업만 쓸 수 있게 막기
 *   2. 이어서 작성(임시 저장 건), 보완 후 재기안(반려 건)일 때 값 미리 채우기
 *   3. 제품별 금액 줄 추가, 삭제와 총액, 연도별 금액 계산 (v0.56: 줄마다 서비스 → 제품 → 기능)
 *      (v0.62, REQ-REG-24, 표준 대응표 G-19) 간접이면 줄마다 사용 업체 필수, 모르면 "아직 정해지지 않음"과 까닭
 *   4. 체크리스트 2, 3번 자동 계산과 결재선 표시
 *   5. 필수 항목 검사(오류 요약 + 항목별 오류), 기안 확인 창
 *   7. 임시 저장과 기안: 계약 기록으로 저장하고 결재 문서로 감 (v0.58 QA: 예전에는 안내만 하고 저장하지 않았음)
 *   기획자 결정 2026-11-02: A-3 원계약은 내가 영업대표인 계약만(A-11 만료 뒤 서비스를 닫기 전이면 연장 가능),
 *     B-5 견적서로 계약서를 대신함(quoteInstead), B-6 4번 조건의 종류(checklist.acctKinds), E-3 결재선에 ③ 영업 임원 승인
 *     E-1 ① 영업기회번호 하나에 계약 하나(syncOpp), C-13 거래처 확인 경고와 C-16 보류 막기(syncGuards)
 *     E-4 제품 줄에 기안한 날의 표준 단가와 할인율 한도(listPrice, cap)를 남김: 뒤에 한도를 바꿔도 이 계약의 결재선(③, ③ 영업 임원 승인)이 그대로
 *   기획자 결정 2026-11-03 C-44: "내가 영업대표"는 지금 영업대표(C.isSalesRep: 넘겨받은 새 영업대표, 맡을 수 없으면 대신 맡는 영업 리더).
 *     원계약 목록, 보완 후 재기안, 변경과 연장의 기안자(C.repActorOf)가 모두 같은 사람. 영업 리더도 그런 계약이 있으면 들어와 변경, 연장만
 * 프로토타입: 임시 저장과 기안은 이 브라우저에만 저장(시연 기록), 파일은 이름만 남습니다. 실제 시스템에서는 서버에 저장하고,
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

  /* ---------- 1. 영업만 쓸 수 있음 (REQ-AUTH-04, 4.1). 최고관리자는 모든 화면을 볼 수 있음 (v0.16) ----------
   * 기획자 결정 2026-11-03(C-44): 영업 담당자가 아니어도 지금 영업대표인 계약(C.isSalesRep)이 있으면 들어옴(repOnly)
   *   영업 리더가 맡을 수 없는 영업대표 대신 맡는 계약, 영업 리더가 자기를 새 영업대표로 정한 계약. 이 사람은 그 계약의 변경, 연장과
   *   보완 후 재기안만 하고 신규는 고르지 못함(아래 "신규 막기"). 계약 상세의 기안 단추와 개요, 결재 문서의 보완 후 재기안 링크와 같은 사람 */
  const repOnly = me.role !== 'SALES' && me.role !== 'SUPER' &&
    D.CONTRACTS.some(function (c) { return c.id && !c.parentId && c.status !== 'DRAFT' && C.isSalesRep(c, me); });
  if (me.role !== 'SALES' && me.role !== 'SUPER' && !repOnly) {
    $('#notice').innerHTML = noticeHtml('', '계약 등록은 영업만 할 수 있습니다',
      '지금은 ' + esc(C.roleLabel(me.role)) + ' 역할로 보고 있습니다. 화면 맨 위 검은 띠에서 영업 역할로 바꾸면 계약 등록 화면을 볼 수 있습니다.', '');
    form.hidden = true;
    return;
  }

  function noticeHtml(kind, title, body, actions) { return C.noticeBox(kind, title, body, actions); } // 위에서도 쓰므로 함수로

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
    $('#bizno-help').hidden = !manual; // '-' 없이 숫자만 넣는 안내는 직접 입력할 때만 (잠긴 칸 아래에 입력 안내가 보이지 않게)
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
  // 원계약 후보: 보관함의 계약 완료 묶음(원계약 번호) 중 내가 영업대표이고 볼 수 있는 것(A-3, 아래).
  //   묶음 상태로 봄: 원계약 기간이 끝났어도 연장 계약이 유효하면 후보 (v0.58 QA: 만료 예정에서 "연장 기안"으로 와도 원계약이 비어 있었음)
  //   기획자 결정 2026-11-02 A-3(C-37 ③): 변경과 연장도 영업대표(원계약을 기안한 사람) 본인만 기안. 최고관리자는 시연용으로 모두
  //     계약 상세의 기안 단추, 만료 예정의 할 일 단추와 같은 규칙(REQ-REG-08, CTL-66). 다른 영업의 계약은 목록에 없고 주소로 와도 미리 고르지 않음
  //   기획자 결정 2026-11-02 A-11(A-10과 함께): 연장은 만료된 계약도 서비스를 닫기 전(만료 처리 차례, 유예 중)이면 고를 수 있음.
  //     유예는 연장 협상 중에 두는 것이라 만료 뒤에도 연장 기안이 이어져야 함. 서비스를 닫은 계약(만료 처리 완료)은 신규로. 변경은 계약 완료만
  //   기획자 결정 2026-11-03(C-44): 내가 영업대표인 계약 = 지금 영업대표(C.isSalesRep: 넘겨받은 새 영업대표, 맡을 수 없으면 대신 맡는 영업 리더)
  //     처음 기안했어도 다른 사람에게 넘어간 계약은 목록에 없음(계약 상세의 단추와 같은 사람)
  const anyOrigin = me.role === 'SUPER';
  const mine = D.CONTRACTS.filter(function (c) {
    return c.id && !c.parentId && (anyOrigin || C.isSalesRep(c, me)) && C.canView(c, me);
  });
  function lateRenewable(b) {
    const x = b && b.status === 'EXPIRED' ? C.expiryOf(b) : null;
    return !!x && (x.state === 'OPEN' || x.state === 'GRACE');
  }
  function originsFor(kind) {
    return mine.filter(function (c) {
      const b = C.bundleOf(c.id);
      return b && (b.status === 'ACTIVE' || (kind === 'RENEW' && lateRenewable(b)));
    });
  }
  let origins = [];
  // 원계약 목록을 계약종류에 맞게 다시 채움. 고른 값은 남김. extra: 보완 후 재기안이나 이어서 작성의 원계약(목록에 없어도 보임)
  function renderOrigins(extra) {
    const sel = $('#f-origin'), keep = sel.value;
    origins = originsFor(val('kind'));
    sel.innerHTML = '<option value="">고르세요</option>' + origins.map(function (c) {
      const b = C.bundleOf(c.id), x = b.status === 'ACTIVE' ? null : C.expiryOf(b);
      return '<option value="' + esc(c.id) + '">' + esc(c.id + ' ' + c.counterparty + ' (' + C.serviceLabel(c.services) + ')' +
        (x ? ', 만료 ' + C.fmtDate(b.end) + (x.state === 'GRACE' ? ', 유예 중' : ', 서비스 닫기 전') : '')) + '</option>';
    }).join('');
    if (extra && !origins.some(function (c) { return c.id === extra.id; })) {
      sel.insertAdjacentHTML('beforeend', '<option value="' + esc(extra.id) + '">' + esc(extra.id + ' ' + extra.counterparty) + '</option>');
    }
    if (keep && Array.prototype.some.call(sel.options, function (o) { return o.value === keep; })) sel.value = keep;
  }
  // 원계약 칸 도움말: 고를 원계약이 없으면 왜 없는지 알림 (A-3)
  // 기안자(requesterId): 기획자 결정 2026-11-02 A-3: 변경과 연장의 기안자는 원계약의 영업대표
  //   최고관리자는 시연으로 대신 기안(해지, 연장 검토, 운영 변경과 같게). 그래야 ③은 영업대표 유닛의 리더, ⑦은 영업대표에게 가고 E-3도 맞게 정해짐
  //   보완 후 재기안은 반려된 기안의 기안자 그대로. 영업은 자기 계약만 원계약으로 고르므로 늘 본인
  //   기획자 결정 2026-11-03(C-44): 원계약의 처음 기안자가 아니라 지금 영업대표(C.repActorOf: 넘겨받은 새 영업대표, 맡을 수 없으면 대신 맡는 영업 리더)
  //     보완 후 재기안도 같음(common.js resubmitRecord가 같은 값으로 저장). ③은 그 사람 유닛의 리더, 리더가 기안하면 영업 임원
  function drafterId() {
    if (source && source.status === 'REJECTED') return C.repActorOf(source);
    const o = (val('kind') || 'NEW') !== 'NEW' && $('#f-origin').value ? D.CONTRACTS.find(function (x) { return x.id === $('#f-origin').value; }) : null;
    return o ? C.repActorOf(o) : (source && source.requesterId) || me.id;
  }
  function originHelp() {
    const late = val('kind') === 'RENEW' ? ' 연장은 만료되었어도 서비스를 닫기 전이면 고를 수 있습니다.' : '';
    return anyOrigin ? '보관함의 계약 완료 계약 중에서 고릅니다(최고관리자는 시연용으로 모든 계약). 원계약 번호에 차수가 붙어 함께 묶입니다.' + late
      : origins.length ? '내가 영업대표인 계약 완료 계약 중에서 고릅니다. 원계약 번호에 차수가 붙어 함께 묶입니다.' + late
      : '내가 영업대표인 계약 완료 계약이 없습니다. 변경과 연장은 그 계약의 영업대표만 기안합니다.';
  }

  /* ---------- 2. 이어서 작성, 보완 후 재기안 (REQ-FLOW-14, REQ-FLOW-17) ---------- */
  const srcId = new URLSearchParams(location.search).get('id');
  //   임시 저장한 계약과 다시 기안할 수 있는 반려 계약만(검토 중인 계약을 열어 새 계약으로 또 기안하지 않게, v0.58 QA).
  //   최고관리자는 시연으로 다른 사람 것도 열 수 있음(내 등록 목록에서 버튼이 보이므로)
  //   기획자 결정 2026-11-03(C-44): 반려 건은 지금 영업대표(C.isSalesRep, 결재 문서와 내 등록 목록의 보완 후 재기안 링크와 같은 사람).
  //     처음 기안했어도 영업대표가 바뀌었으면 열지 않음. 임시 저장은 쓴 사람만(나만 보는 기록)
  const source = srcId ? D.CONTRACTS.find(function (c) {
    return (c.id === srcId || c.draftKey === srcId) && ((c.status === 'DRAFT' ? c.requesterId === me.id : C.isSalesRep(c, me)) || me.role === 'SUPER') &&
      (c.status === 'DRAFT' || (C.canResubmit(c) && C.resubmitHref(c).indexOf('new-contract.html') === 0)); // 해지, 그대로 연장, 운영 변경은 그 화면에서
  }) : null;
  // 원계약 목록에 없어도 보이는 원계약: 보완 후 재기안은 원계약을 바꿀 수 없어 늘. 이어서 작성은 내가 영업대표인 원계약일 때만(A-3, 시연용 최고관리자는 모두)
  const extraOrigin = source && source.parentId ? (function () {
    const o = D.CONTRACTS.find(function (c) { return c.id === source.parentId; });
    if (source.status !== 'REJECTED' && !anyOrigin && (!o || !C.isSalesRep(o, me))) return null; // 지금 영업대표(C-44)
    return { id: source.parentId, counterparty: source.counterparty };
  })() : null;
  let round = 1;
  if (source && source.status === 'REJECTED') {
    round = (source.round || 1) + 1;
    setTitle('보완 후 재기안');
    $('#notice').innerHTML = C.rejectionNotice(source); // 반려한 단계, 때, 사유 (해지, 연장 검토, 운영 변경과 같은 안내)
  } else if (source && source.status === 'DRAFT') {
    setTitle('새 계약 등록 (이어서 작성)');
    $('#notice').innerHTML = noticeHtml('', '임시 저장한 계약을 이어서 작성합니다',
      C.fmtDate(source.savedAt) + '에 임시 저장했습니다. 임시 저장한 계약은 나만 볼 수 있습니다.', '');
  }
  function setTitle(t) { $('#page-title').textContent = t; }

  /* ---------- 3. 제품별 금액 (CPQ, REQ-SCOPE-02) ----------
   * 서비스 > 제품 > 기능 = 대분류 > 중분류 > 소분류(v0.56 기획자 결정). 서비스는 CK, HR, 기타 세 가지. 가격은 기능마다 하나(v0.49에 플랜을 없앰)
   *   줄마다 서비스 → 제품 → 기능을 차례로 고름(v0.56 기획자 요청: 세 칸). 앞 칸을 고르면 다음 칸이 그 아래 것만 보임.
   *   하나뿐이면 저절로 고름(기능이 따로 없는 제품은 "기능 구분 없음" 하나). 계약의 서비스는 고른 제품의 서비스
   *   고를 수 있는 것: 사용 중인 제품과 기능 중 오늘 적용되는 가격(PRICE_BOOK)이 있는 것
   *   저장하는 값은 기능(feature), 수량, 금액, 사용 업체. 이어서 작성할 때는 기능에서 제품과 서비스를 다시 채움
   *   지금 쓰지 않는 기능(사용 안 함)이 든 줄을 다시 열면 "(사용 안 함)"으로 보이고 다른 기능을 골라야 기안됨 */
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
  function liveFeatureIds() { return livePrices().map(function (r) { return r.feature; }); }
  function featureOf(id) { return D.FEATURES.filter(function (f) { return f.id === id; })[0] || null; }
  function productOf(id) { return D.PRODUCTS.filter(function (x) { return x.id === id; })[0] || null; }
  // 줄마다 서비스 → 제품 → 기능 칸을 다시 채움. keep: 지금 쓰지 않아도 보여 줄 기능(다시 연 줄의 사용 안 함 기능)
  function syncPick(li, keep) {
    const ss = li.querySelector('[data-k="service"]'), sp = li.querySelector('[data-k="product"]'), sf = li.querySelector('[data-k="feature"]');
    const live = liveFeatureIds();
    const keepF = keep ? featureOf(keep) : null;
    const usable = function (f) { return live.indexOf(f.id) > -1 || (keepF && f.id === keepF.id); };
    const feats = D.FEATURES.filter(usable);
    const prods = D.PRODUCTS.filter(function (x) { return feats.some(function (f) { return f.product === x.id; }); });
    const svcs = C.codeList('SERVICE', true).filter(function (c) { return prods.some(function (x) { return x.service === c.code; }); });
    // 서비스
    let svc = ss.value;
    if (!svcs.some(function (c) { return c.code === svc; })) svc = svcs.length === 1 ? svcs[0].code : '';
    ss.innerHTML = optionsHtml(svcs.map(function (c) { return [c.code, c.label]; }), svc, '고르세요');
    // 제품: 고른 서비스 아래 것만
    const plist = svc ? prods.filter(function (x) { return x.service === svc; }) : [];
    let pid = sp.value;
    if (!plist.some(function (x) { return x.id === pid; })) pid = plist.length === 1 ? plist[0].id : '';
    sp.innerHTML = optionsHtml(plist.map(function (x) { return [x.id, x.name]; }), pid, svc ? '고르세요' : '서비스를 먼저 고르세요');
    sp.disabled = !svc;
    // 기능: 고른 제품 아래 것만
    const flist = pid ? feats.filter(function (f) { return f.product === pid; }) : [];
    let fid = sf.value;
    if (!flist.some(function (f) { return f.id === fid; })) fid = flist.length === 1 ? flist[0].id : '';
    sf.innerHTML = optionsHtml(flist.map(function (f) {
      return [f.id, C.featureText(f.id) + (live.indexOf(f.id) < 0 ? ' (사용 안 함)' : '')];
    }), fid, pid ? '고르세요' : '제품을 먼저 고르세요');
    sf.disabled = !pid;
    // 수량 단위: 가격 단위가 건이면 건, 그 밖에는 개
    const pr = PRICE[fid];
    li.querySelector('.qty-unit').textContent = pr && /^건/.test(pr.unit) ? '건' : '개';
  }
  function addProduct(data) {
    data = data || {};
    productSeq += 1;
    const n = productSeq;
    // 이어서 작성, 재기안: 기능에서 제품과 서비스를 찾음(사용 안 함인 기능이어도)
    const feat = data.feature ? featureOf(data.feature) : null;
    const prod = feat ? productOf(feat.product) : null;
    const li = document.createElement('li');
    li.className = 'product-item';
    li.innerHTML =
      '<div class="product-pick">' +
        '<div class="field"><label class="field-label field-label--sm" for="p-svc-' + n + '">서비스</label>' +
          '<select class="select" id="p-svc-' + n + '" data-k="service">' + optionsHtml(prod ? [[prod.service, C.serviceLabel([prod.service])]] : [], prod ? prod.service : '', '고르세요') + '</select></div>' +
        '<div class="field"><label class="field-label field-label--sm" for="p-prod-' + n + '">제품</label>' +
          '<select class="select" id="p-prod-' + n + '" data-k="product">' + optionsHtml(prod ? [[prod.id, prod.name]] : [], prod ? prod.id : '', '서비스를 먼저 고르세요') + '</select></div>' +
        '<div class="field"><label class="field-label field-label--sm" for="p-feat-' + n + '">기능</label>' +
          '<select class="select" id="p-feat-' + n + '" data-k="feature">' + optionsHtml(feat ? [[feat.id, C.featureText(feat.id)]] : [], feat ? feat.id : '', '제품을 먼저 고르세요') + '</select></div>' +
      '</div>' +
      '<div class="product-grid">' +
        '<div class="field"><label class="field-label field-label--sm" for="p-qty-' + n + '">수량</label>' +
          '<div class="input-unit"><input class="input" id="p-qty-' + n + '" data-k="qty" inputmode="numeric" maxlength="6" value="' + (data.qty || 1) + '"><span class="unit qty-unit">개</span></div></div>' +
        '<div class="field"><label class="field-label field-label--sm" for="p-amt-' + n + '">계약 금액</label>' +
          '<div class="input-unit"><input class="input" id="p-amt-' + n + '" data-k="amount" inputmode="numeric" value="' + fmtNum(data.amount != null ? data.amount : null) + '"><span class="unit">원</span></div></div>' +
      '</div>' +
      // 사용 업체: 직접, 조달은 선택. 간접은 필수이고, 아직 모르면 "정해지지 않음"과 까닭을 고름 (v0.62, 표준 대응표 G-19). syncOrg()가 바꿈
      '<div class="field org-field"><label class="field-label field-label--sm" for="p-org-' + n + '">사용 업체<span class="req" aria-hidden="true" hidden>*</span>' +
          '<span class="sr-only org-sr" hidden>(필수)</span> <span class="opt">(선택, 계약 상대방과 다를 때만)</span></label>' +
        '<input class="input" id="p-org-' + n + '" data-k="org" aria-describedby="p-org-err-' + n + '" value="' + esc(data.org || '') + '">' +
        '<div class="org-pending" hidden>' +
          // 칸이 숨어도 무엇을 정하지 않았는지 화면낭독기가 알게 "사용 업체"를 붙여 읽힘
          '<label class="choice"><input type="checkbox" data-k="orgPending" aria-describedby="p-org-err-' + n + '"' + (data.orgPending ? ' checked' : '') + '><span class="sr-only">사용 업체 </span>아직 정해지지 않음</label>' +
          '<div class="org-why" hidden>' +
            '<label class="field-label field-label--sm" for="p-why-' + n + '">정해지지 않은 까닭</label>' +
            '<select class="select" id="p-why-' + n + '" data-k="orgWhy" aria-describedby="p-org-err-' + n + '">' + optionsHtml(D.END_USER_PENDING.map(function (x) { return [x.code, x.label]; }), typeof data.orgPending === 'string' ? data.orgPending : '', '고르세요') + '</select>' +
            '<input class="input org-note" id="p-note-' + n + '" data-k="orgNote" maxlength="60" aria-label="그 밖의 까닭" aria-describedby="p-org-err-' + n + '" placeholder="까닭을 적으세요" value="' + esc(data.orgNote || '') + '" hidden>' +
          '</div></div>' +
        // 사용 업체 오류는 이 칸 아래에 따로 (제품 줄의 다른 오류와 함께 보이게, 검토에서 고침)
        '<p class="field-error" id="p-org-err-' + n + '" hidden></p></div>' +
      '<div class="product-foot"><span class="price-info"></span><span class="price-badge"></span>' +
        '<button type="button" class="btn-text" data-act="remove">이 제품 삭제</button></div>' +
      '<p class="field-error" hidden></p>';
    $('#product-list').appendChild(li);
    syncPick(li, data.feature);
    syncOrg(li);
    refresh();
    return li;
  }
  // 간접이면 사용 업체 필수, "아직 정해지지 않음"을 고르면 칸 대신 까닭, 까닭이 "그 밖의 까닭"이면 직접 적음 (v0.62, G-19)
  function syncOrg(li) {
    const indirect = val('method') === 'INDIRECT';
    C.setFieldError(li.querySelector('.org-field'), ''); // 방식이나 미정을 바꾸면 앞의 사용 업체 오류는 맞지 않으므로 지움
    const pending = indirect && li.querySelector('[data-k="orgPending"]').checked;
    li.querySelector('.org-field .req').hidden = !indirect;
    li.querySelector('.org-sr').hidden = !indirect;
    li.querySelector('.org-field .opt').hidden = indirect;
    li.querySelector('.org-pending').hidden = !indirect;
    li.querySelector('.org-why').hidden = !pending;
    li.querySelector('[data-k="org"]').hidden = pending;
    li.querySelector('[data-k="orgNote"]').hidden = !(pending && li.querySelector('[data-k="orgWhy"]').value === 'OTHER');
  }
  function syncOrgAll() {
    $$('#product-list > li').forEach(syncOrg);
    const indirect = val('method') === 'INDIRECT';
    $('#method-help').hidden = !indirect;
    // 간접일 때만 계약 방식 단추에 안내를 이어 화면낭독기가 읽게 함
    $$('[name="method"]', form).forEach(function (r) {
      if (indirect) r.setAttribute('aria-describedby', 'method-help'); else r.removeAttribute('aria-describedby');
    });
  }
  // 줄의 사용 업체 값. "정해지지 않음"은 간접일 때만 셈: 까닭 코드, 까닭을 아직 안 골랐으면 true
  function orgOf(li) {
    const pending = val('method') === 'INDIRECT' && li.querySelector('[data-k="orgPending"]').checked;
    const why = li.querySelector('[data-k="orgWhy"]').value;
    return {
      org: pending ? '' : li.querySelector('[data-k="org"]').value.trim(),
      orgPending: pending ? (why || true) : null,
      orgNote: pending && why === 'OTHER' ? li.querySelector('[data-k="orgNote"]').value.trim() : '',
    };
  }
  $('#btn-add-product').insertAdjacentHTML('afterbegin', C.icon('plus')); // + 아이콘 (v0.57)
  $('#btn-add-product').addEventListener('click', function () { addProduct().querySelector('select').focus(); });
  $('#product-list').addEventListener('click', function (e) {
    if (e.target.closest('[data-act="remove"]')) { e.target.closest('li').remove(); refresh(); }
  });
  // 서비스나 제품을 바꾸면 다음 칸을 다시 채움, 기능을 바꾸면 수량 단위를 맞춤 (폼 전체의 change보다 먼저 돌아 계산에 새 기능이 쓰임)
  $('#product-list').addEventListener('change', function (e) {
    if (e.target.matches('[data-k="service"], [data-k="product"], [data-k="feature"]')) syncPick(e.target.closest('li'));
    if (e.target.matches('[data-k="orgPending"], [data-k="orgWhy"]')) syncOrg(e.target.closest('li'));
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
      const retired = !!feature && liveFeatureIds().indexOf(feature) < 0; // 다시 연 줄의 사용 안 함 기능
      const p = retired ? null : PRICE[feature];
      const std = p && qty ? p.listPrice * qty : null;
      // 할인율: 표준 금액보다 높게 받으면 음수(표준 단가보다 높음). v0.58 QA: 예전에는 0으로 보아 "표준 단가"라고 잘못 보였음
      const discount = std && amount != null ? (std - amount) / std : null;
      return { li: li, feature: feature, retired: retired, qty: qty, amount: amount, product: p, std: std, discount: discount, cap: p ? p.discountCap : null };
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
   * 2번(표준단가표 적용): 모든 줄이 표준 단가 그대로면 예, 하나라도 다르면(할인했거나 표준보다 높게 받음) 아니요 (v0.58 기획자 확인, C-34)
   * 3번(할인율 한도 준수): 모든 줄의 할인율이 그 기능의 한도 이하이면 예 (v0.49: 한도는 기능마다)
   * 모든 계약에는 제품과 금액이 있음(v0.41: 금액이 없는 계약은 시스템에 등록하지 않음) */
  function priceCheck(rows) {
    if (!rows.length) return { q2: 'WAIT', q3: 'WAIT', d2: '제품을 넣으면 자동으로 계산됩니다.', d3: '제품을 넣으면 자동으로 계산됩니다.' };
    if (rows.some(function (r) { return !r.product || !r.qty || r.amount == null; })) {
      const msg = '서비스, 제품, 기능, 수량, 계약 금액을 모두 넣으면 계산됩니다.';
      return { q2: 'WAIT', q3: 'WAIT', d2: msg, d3: msg };
    }
    const discounted = rows.filter(function (r) { return Math.abs(r.discount) > 1e-9; });
    const over = rows.filter(function (r) { return r.discount > r.cap + 1e-9; });
    return {
      q2: discounted.length ? 'NO' : 'YES',
      q3: over.length ? 'NO' : 'YES',
      d2: discounted.length
        ? discounted.map(function (r) { return C.featureLabel(r.product) + ' ' + discountText(r.discount); }).join(', ')
        : '모든 제품이 표준 단가 그대로입니다.',
      d3: over.length
        ? over.map(function (r) { return C.featureLabel(r.product) + ' 할인율 ' + pct(r.discount) + ', 한도 ' + pct(r.cap) + ' 초과'; }).join(', ')
        : (discounted.length ? '할인한 제품 모두 한도 이내입니다.' : '할인이 없습니다.'),
    };
  }
  // "10% 할인" 또는 "표준 단가보다 5% 높음"
  function discountText(d) { return d < 0 ? '표준 단가보다 ' + pct(-d) + ' 높음' : pct(d) + ' 할인'; }
  function answerHtml(v) {
    if (v === 'YES') return '<span class="badge badge--success">예</span>';
    if (v === 'NO') return '<span class="badge badge--danger">아니요</span>';
    return '<span class="badge badge--line">계산 대기</span>';
  }

  /* ---------- 5. 결재선 자동 결정 (REQ-CHK-05, 3.5 경우의 수) ---------- */
  function caseNo(q1, q2, q3) {
    if (!q1 || q2 === 'WAIT') return null;
    if (q1 === 'YES') return q2 === 'YES' ? 1 : (q3 === 'YES' ? 2 : 3);
    return q2 === 'YES' ? 4 : (q3 === 'YES' ? 5 : 6);
  }
  // rows: 제품 줄(readProducts), qi: 견적서로 계약서를 대신함을 골랐는지(B-5)
  function buildRoute(q1, pc, rows, qi) {
    const personal = val('personalData');
    const legal = q1 === 'YES' ? ['skip', '표준계약서를 그대로 씀'] : q1 === 'NO' ? ['go', '표준계약서를 바꿈'] : ['wait', '체크리스트 1번 답을 기다림'];
    const privacy = personal === 'YES' ? ['go', '개인정보 처리위탁 계약 있음'] : personal === 'NO' ? ['skip', '개인정보 처리위탁 계약 없음'] : ['wait', '개인정보 처리위탁 계약 여부를 기다림'];
    let sales;
    if (pc.q2 === 'YES') sales = ['skip', '표준단가표를 적용함'];
    else if (pc.q2 === 'NO' && pc.q3 === 'YES') sales = ['skip', '할인율 한도 이내'];
    else if (pc.q3 === 'NO') sales = ['go', '할인율 한도를 넘김'];
    else sales = ['wait', '금액 계산을 기다림'];
    // ③ 영업 검토는 기안자 유닛의 리더 (리더 본인 계약은 영업 임원, v0.26 재무 문서 반영)
    //   맡는 사람 이름은 결재 문서와 같은 규칙(C.stepWho, 기획자 결정 2026-11-02 D-3): 리더 본인 계약의 ③은 "영업 임원", 영업지원이 기안하면 ②⑧은 "재무"
    const req = { requesterId: drafterId(), kind: val('kind') || 'NEW', personalData: personal === 'YES', // A-3: 변경과 연장은 원계약의 영업대표
      checklist: { standard: q1, price: pc.q2, cap: pc.q3 },
      // E-4: 기안할 때 남기는 줄과 같게 오늘의 표준 단가와 한도를 함께 넘김(C.capOver가 이 값으로 셈)
      products: rows.filter(function (r) { return r.product && r.qty && r.amount != null; }).map(function (r) { return { feature: r.feature, qty: r.qty, amount: r.amount, listPrice: r.product.listPrice, cap: r.product.discountCap }; }),
      amount: totalAmount(), quoteInstead: qi };
    const name = function (code) { return C.ownerLabel(C.stepUserNow(code, req)); };
    const who = function (code) { return C.stepWho(code, req) + ' ' + name(code); };
    // 기획자 결정 2026-11-02 E-3(A안): ③을 거치고 한 줄이라도 할인율 한도를 기준 %p보다 더 넘으면 ③ 다음에 영업 임원도 승인(C.reviewRoute S03C)
    //   늘 한 줄로 보임(거치지 않으면 생략과 까닭): 답에 따라 줄이 생기고 없어지며 화면이 흔들리지 않게
    const coo = sales[0] === 'wait' ? ['wait', '금액 계산을 기다림'] : sales[0] === 'skip' ? ['skip', '③ 영업 검토를 거치지 않음']
      : (function () { const r = C.reviewRoute(req).S03C; return [r[0] ? 'go' : 'skip', r[1]]; })();
    // 기획자 결정 2026-11-02 B-5: 견적서로 계약서를 대신하면 ⑦은 고객 날인 견적서 등록, ⑧은 견적서 확인(이름은 C.stepLabel)
    const stepName = function (code) { return C.stepLabel(code, req).replace(/^\S+\s/, ''); };
    // ⑦은 기안자 쪽(지금 영업대표). 내가 하면 "영업 (나)", 최고관리자가 시연으로 다른 영업대표 대신 기안하거나 대신 맡는 사람이 따로 있으면 그 이름
    //   (기획자 결정 2026-11-02 A-3 남은 것: 예전에는 늘 "영업 (나)"라 최고관리자가 대신 기안해도 자기가 ⑦을 하는 것처럼 보였음)
    const rep7 = C.stepUserNow('S07', req);
    const who7 = rep7 === me.id ? '영업 (나)' : '영업대표 ' + C.ownerLabel(rep7);
    return [
      { stage: '2단계 계약 검토 (② 다음 ③, 그다음 ④와 ⑤ 동시)', items: [
        { no: '②', name: '체크리스트 검토', who: who('S02'), state: 'go', reason: '어떤 경우에도 생략하지 않음' }, // REQ-CHK-02
        { no: '③', name: '영업 검토', who: who('S03'), state: sales[0], reason: sales[1] }, // 가격 예외 승인, 법무보다 먼저 (v0.20)
        { no: '③', name: '영업 임원 승인', who: who('S03C'), state: coo[0], reason: coo[1] }, // E-3
        { no: '④', name: '법무 검토', who: '법무 ' + name('S04'), state: legal[0], reason: legal[1] },
        { no: '⑤', name: '개인정보 검토', who: '정보보호 담당자 ' + name('S05'), state: privacy[0], reason: privacy[1] },
      ] },
      { stage: '3단계 계약 체결', items: [
        { no: '⑥', name: '인장 날인 검토', who: '총무 ' + name('S06'), state: 'go', reason: '기초 정보 확인 후 인장 날인' },
        qi ? { no: '⑦', name: stepName('S07'), who: who7, state: 'go', reason: '고객의 날인이나 서명은 시스템 밖에서' }
          : { no: '⑦', name: '상대방 서명, 체결본 등록', who: who7, state: 'go', reason: '서명은 시스템 밖에서' },
        { no: '⑧', name: qi ? stepName('S08') : '체결본 확인', who: who('S08'), state: 'go', reason: qi ? '날인한 견적서가 결재한 견적과 같은지 확인' : '승인된 내용과 같은지 확인' },
      ] },
      { stage: '4단계 운영 검토', items: [
        { no: '⑨', name: '운영 적용', who: '고객지원 ' + name('S09'), state: 'go', reason: '라이선스나 도메인 열기' },
        { no: '⑩', name: '재무 확인', who: who('S10'), state: 'go', reason: '회계 인식 (결재선에는 없음)' },
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
    // 영업대표 칸: 기안자로 남을 사람(drafterId). 신규는 나, 변경과 연장은 원계약의 지금 영업대표(A-3, 2026-11-03 C-44). 최고관리자가 대신 기안해도 그 영업대표
    $('#f-owner').value = C.ownerLabel(drafterId());
    const rows = readProducts();
    // 제품 줄마다 표준 금액과 할인율 표시
    rows.forEach(function (r) {
      const info = r.li.querySelector('.price-info');
      const badge = r.li.querySelector('.price-badge');
      if (r.retired) { info.textContent = '지금 쓰지 않는 기능입니다. 다른 기능을 고르세요.'; badge.innerHTML = '<span class="badge badge--danger">사용 안 함</span>'; return; }
      if (!r.product) { info.textContent = '서비스, 제품, 기능을 고르면 표준 단가가 나옵니다.'; badge.innerHTML = ''; return; }
      info.textContent = '표준 단가 ' + krw(r.product.listPrice) + ' (' + r.product.unit + ')' + (r.qty ? ' x ' + r.qty + ' = ' + krw(r.std) : '') +
        ', 할인율 한도 ' + pct(r.cap);
      if (r.amount == null || r.discount == null) badge.innerHTML = '<span class="badge badge--line">금액 입력 대기</span>';
      else if (Math.abs(r.discount) < 1e-9) badge.innerHTML = '<span class="badge badge--success">표준 단가</span>';
      else if (r.discount < 0) badge.innerHTML = '<span class="badge badge--line">' + esc(discountText(r.discount)) + '</span>';
      else if (r.discount > r.cap + 1e-9) badge.innerHTML = '<span class="badge badge--danger">' + pct(r.discount) + ' 할인, 한도 초과</span>';
      else badge.innerHTML = '<span class="badge badge--progress">' + pct(r.discount) + ' 할인, 한도 이내</span>';
    });
    // 총액
    const total = totalAmount();
    // 총액은 정확한 금액 하나만(예: 5,000,000원). 예전의 줄인 금액(500만 원)과 작은 글씨의 정확한 금액은 뺌 (v0.57 기획자 요청)
    $('#amount-total').textContent = fmtNum(total || 0) + '원';
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
    const qi = syncQuoteInstead(total); // B-5: 견적서로 계약서를 대신할 수 있는지 다시 보고, 넘으면 풂
    const route = buildRoute(q1, pc, rows, qi);
    const reviews = route[0].items.filter(function (i) { return i.state === 'go'; }).map(function (i) { return i.name; });
    const passText = '계약 검토에서 거치는 단계는 ' + esc(reviews.join(', ')) + '입니다.';
    // 비고는 적어야 할 때만 보임 (v0.58 기획자 요청): 1번 아니요(표준계약서를 쓰지 않음), 2번, 3번 자동 계산이 아니요, 4번 예
    //   감춘 비고에 적어 둔 글은 지우지 않지만 저장하지 않음(formRecord)
    showNote('standardNote', q1 === 'NO');
    showNote('priceNote', pc.q2 === 'NO');
    showNote('capNote', pc.q3 === 'NO');
    showNote('acctKinds', q4 === 'YES'); // 기획자 결정 2026-11-02 B-6: 4번 조건의 종류도 4번이 "예"일 때만
    showNote('accountingNote', q4 === 'YES');
    $('#case-summary').innerHTML = cn
      ? '<strong>경우 ' + cn + '</strong>: ' + passText // 경우의 수: 요구사항 정의서 3.5
      : '';
    $('#route').innerHTML = routeHtml(route);
    current = { route: route, pc: pc, q1: q1, total: total, qi: qi };
    syncOpp();    // 기획자 결정 2026-11-02 E-1 ①: 같은 영업기회번호를 쓴 계약
    syncGuards(); // C-16 보류, C-13 거래처 확인
  }

  /* ---------- 4번 조건의 종류 (기획자 결정 2026-11-02 B-6, G-07, REQ-CHK-08) ----------
   * 4번이 "예"이면 D.ACCT_KINDS에서 하나 이상 고르고 비고도 꼭 적음(둘 다 필수). 계약 기록 checklist.acctKinds(코드 목록)로 남음 */
  $('#acct-kind-choices').innerHTML = D.ACCT_KINDS.map(function (k) {
    return '<label class="choice"><input type="checkbox" name="acctKinds" value="' + esc(k.code) + '">' + esc(k.label) + '</label>';
  }).join('');
  function acctKinds() { return $$('[name="acctKinds"]:checked', form).map(function (i) { return i.value; }); }
  function acctKindText(codes) {
    return (codes || []).map(function (code) { return (D.ACCT_KINDS.filter(function (k) { return k.code === code; })[0] || { label: code }).label; }).join(', ');
  }

  /* ---------- 견적서로 계약서를 대신함 (기획자 결정 2026-11-02 B-5, C-19, REQ-FLOW-24) ----------
   * 공급가액 합계(부가세 별도, 제품 줄 금액의 합)가 기준(D.QUOTE_INSTEAD.under) 미만이고 최종 견적서를 첨부했을 때만 고를 수 있음
   *   기준은 결재 흐름과 같은 C.quoteInsteadAllowed로 봄(결재 문서의 ⑦⑧ 이름도 같은 판단)
   *   고른 뒤 합계가 기준 이상이 되거나 견적서를 지우면 저절로 풀고 까닭을 알림(quoteDropped). 다시 고르면 알림을 지움
   *   고르면 계약서 초안은 선택(최종 견적서가 계약서를 대신함) [가정]. 계약 기록 quoteInstead(와 form.quoteInstead)로 남음 */
  const QI_UNDER = D.QUOTE_INSTEAD.under;
  $('#quote-instead-rule').textContent = '공급가액 합계(부가세 별도)가 ' + fmtNum(QI_UNDER) + '원 미만이고 최종 견적서를 첨부했을 때만 고를 수 있습니다. ' +
    '고르면 계약서 대신 ⑦에서 고객이 날인한 견적서를 올리고 ⑧ 영업지원이 확인합니다.';
  let quoteDropped = ''; // 저절로 푼 까닭: AMOUNT(합계가 기준 이상), FILE(견적서를 지움)
  function quoteInsteadOk(total) {
    return C.quoteInsteadAllowed({ kind: val('kind') || 'NEW', amount: total }) && files.quote.length > 0;
  }
  // 체크 칸을 쓸 수 있는지 정하고, 고른 채로 기준을 벗어나면 풂. 돌려주는 값: 지금 견적서로 대신하는지
  //   금액 칸을 고쳐 쓰느라 잠깐 비어 합계가 0원이 될 때는 풀지 않음(기안할 때 validate가 다시 봄)
  function syncQuoteInstead(total) {
    const box = $('#f-quote-instead'), state = $('#quote-instead-state');
    const ok = quoteInsteadOk(total);
    if (box.checked && total >= QI_UNDER) { box.checked = false; quoteDropped = 'AMOUNT'; }
    else if (box.checked && !files.quote.length) { box.checked = false; quoteDropped = 'FILE'; }
    box.disabled = !box.checked && !ok;
    const on = box.checked;
    let msg, warn = false;
    if (quoteDropped && !on) {
      warn = true;
      msg = quoteDropped === 'AMOUNT'
        ? '공급가액 합계가 ' + fmtNum(QI_UNDER) + '원 이상이 되어 견적서로 대신하기를 풀었습니다. 계약서 초안을 첨부하세요.'
        : '최종 견적서를 지워 견적서로 대신하기를 풀었습니다. 계약서 초안을 첨부하세요.';
    } else if (on) msg = '견적서로 계약서를 대신합니다. 계약서 초안은 선택이고, ⑦ 고객 날인 견적서 등록과 ⑧ 견적서 확인을 거칩니다.';
    //   글에 지금 합계를 넣지 않음: 금액을 칠 때마다 글이 바뀌어 화면낭독기가 계속 읽지 않게(합계는 2번 묶음의 총액에 있음)
    else if (ok) msg = '고를 수 있습니다. 고르면 계약서 초안은 선택이 됩니다.';
    else if (total >= QI_UNDER) msg = '공급가액 합계가 ' + fmtNum(QI_UNDER) + '원 이상이라 고를 수 없습니다.';
    else if (!total) msg = '제품과 계약 금액을 넣으면 고를 수 있는지 나옵니다.';
    else msg = '최종 견적서를 첨부하면 고를 수 있습니다.';
    state.classList.toggle('field-warn', warn);
    state.classList.toggle('field-help', !warn);
    state.innerHTML = (warn ? C.icon('alert', 'sm') : '') + esc(msg);
    // 계약서 초안: 견적서로 대신하면 선택 (필수 표시를 바꿈)
    $('#draft-req').hidden = on;
    $('#draft-req-sr').hidden = on;
    $('#draft-opt').hidden = !on;
    if (on && files.draft.length === 0) C.setFieldError(fieldBox('draftFile'), ''); // 앞서 난 "계약서 초안을 첨부하세요" 오류는 맞지 않으므로 지움
    return on && ok;
  }
  function showNote(name, on) {
    const box = form.querySelector('[data-field="' + name + '"]');
    if (box.hidden === !on) return;
    box.hidden = !on;
    if (!on && box.classList.contains('is-invalid')) C.setFieldError(box, ''); // 감추면 오류 표시도 지움
  }
  function noteIf(on, name) { return on ? val(name) : ''; }
  // 영업기회번호: 영문은 대문자로, 규칙에 맞으면 판다 링크 (v0.32)
  function updateOppLink() {
    const v = $('#f-opportunity').value;
    $('#opp-link').innerHTML = C.isOppNo(v)
      ? '<a class="btn btn--tertiary btn--md ext-btn" href="' + C.pandaUrl(v) + '" target="_blank" rel="noopener noreferrer">' + C.icon('external', 'sm') + '판다에서 열기<span class="sr-only">(새 창)</span></a>' : '';
  }
  // 칸 아래 알림 한 줄(아이콘 + 글). 글이 같으면 다시 쓰지 않음(입력할 때마다 화면낭독기가 같은 말을 되풀이하지 않게)
  function setWarn(sel, msg) {
    const w = $(sel);
    if (w.dataset.msg === msg) return;
    w.dataset.msg = msg;
    w.innerHTML = msg ? C.icon('alert', 'sm') + esc(msg) : '';
    w.hidden = !msg;
  }

  /* ---------- 영업기회번호 하나에 계약 하나 (기획자 결정 2026-11-02 E-1 ①, G-02, CTL-02) ----------
   * 같은 번호를 쓴 다른 계약(C.oppUses): 기안한 계약만 셈. 반려 뒤 다시 기안하는 이 계약은 같은 계약이라 뺌. 변경과 연장은 각자 번호
   *   다른 고객의 계약이면 기안을 막음(칸 아래에 까닭). 같은 고객의 다른 계약이면 경고하고 까닭을 받음
   *     까닭은 계약 기록 oppDup { ids: 같은 번호를 쓴 계약, reason }과 form.oppReason으로 남고 결재 문서에 보임
   *   거래처를 아직 고르지 않았으면 같은 고객인지 모른다고만 알림. 볼 수 없는 열람 제한 계약은 번호와 고객사를 가리고 건수만 */
  let opp = { all: [], other: [], same: [] };
  function oppNames(list) {
    const shown = list.filter(function (c) { return C.canView(c, me); });
    const hidden = list.length - shown.length;
    return shown.map(function (c) { return c.id + ' ' + c.counterparty; }).concat(hidden ? ['열람 제한 계약 ' + hidden + '건'] : []).join(', ');
  }
  function syncOpp() {
    const no = val('opportunity'), biz = val('bizNo').replace(/\D/g, ''), name = val('counterparty');
    opp = C.isOppNo(no) ? C.oppUses(no, { bizNo: biz, name: name, exceptId: source && source.status === 'REJECTED' ? source.id : null }) : { all: [], other: [], same: [] };
    const known = !!(biz || name);
    setWarn('#opp-warn', opp.all.length && !known ? '이 번호를 쓴 계약이 있습니다. 거래처를 고르면 같은 고객의 계약인지 봅니다.'
      : opp.other.length ? '다른 고객의 계약(' + oppNames(opp.other) + ')에 쓴 번호입니다. 번호 하나는 계약 하나에만 쓰므로 이대로는 기안할 수 없습니다. 판다에서 번호를 확인하세요.'
      : opp.same.length ? '같은 고객의 다른 계약(' + oppNames(opp.same) + ')에 쓴 번호입니다. 같은 번호를 쓰는 까닭을 적으면 기안할 수 있고, 까닭은 결재 문서에 보입니다.' : '');
    showNote('oppReason', known && !opp.other.length && opp.same.length > 0);
  }

  /* ---------- 거래처 확인과 보류 (기획자 결정 2026-11-02 C-13, C-16, 컴플라이언스가 남김) ----------
   * 보류(C-16): 거래처(사업자등록번호)나 계약 묶음(변경과 연장의 원계약, 보완 후 재기안하는 이 계약)에 걸린 보류(C.holdOf)가 있으면 알리고 기안을 막음
   *   임시 저장은 됨. 보류는 컴플라이언스 담당자가 걸고 풂(개선 과제와 보류 SCR-64)
   * 거래처 확인(C-13): 국가와 지자체(가운데 83), 조달, 간접 거래처인데 확인이 없거나 다음 확인일이 지났거나 문제 있음이면 경고만(C.customerCheckNote, 막지 않음)
   *   기안할 때 보인 경고 문장은 계약 기록 customerCheckWarn으로 남김(경고를 보고 기안했다는 기록)
   * common.js에 컴플라이언스의 기능이 없으면 아무것도 보이지 않고 막지도 않음 */
  let guard = { hold: null, check: '' };
  function syncGuards() {
    const kind = val('kind') || 'NEW';
    const target = {
      id: source && source.status === 'REJECTED' ? source.id : null,
      parentId: kind !== 'NEW' ? ($('#f-origin').value || (source && source.parentId) || null) : null,
      counterparty: val('counterparty'), form: { bizNo: val('bizNo') },
    };
    let hold = null, check = '';
    try { hold = typeof C.holdOf === 'function' ? C.holdOf(target) : null; } catch (e) { hold = null; }
    const biz = val('bizNo').replace(/\D/g, '');
    try { check = biz.length === 10 && typeof C.customerCheckNote === 'function' ? C.customerCheckNote(biz, val('method')) || '' : ''; } catch (e) { check = ''; }
    guard = { hold: hold, check: check };
    setWarn('#customer-hold', hold ? (typeof C.holdText === 'function' ? C.holdText(hold, me) : '보류가 걸려 있습니다. 사유: ' + (hold.reason || '')) +
      ' 보류가 풀릴 때까지 기안할 수 없습니다(임시 저장은 됨).' : '');
    setWarn('#customer-check', check);
  }
  form.addEventListener('input', function (e) {
    // 사업자등록번호: 숫자만 넣으면 '-'를 붙여 보여 줌(글자는 지움, v0.34)
    if (e.target.id === 'f-bizno') { e.target.value = C.fmtBizNo(e.target.value); bizWarn(); }
    if (e.target.id === 'f-opportunity') { e.target.value = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ''); updateOppLink(); }
    clearError(e.target);
    refresh();
  });
  form.addEventListener('change', function (e) {
    if (e.target.type !== 'file') clearError(e.target); // 파일 칸은 addFiles가 오류를 직접 정함(맞지 않는 파일 경고가 바로 지워지던 것, v0.63 검토)
    if (e.target.name === 'kind') onKindChange();
    if (e.target.id === 'f-origin') onOriginChange();
    if (e.target.id === 'f-quote-instead') quoteDropped = ''; // B-5: 직접 고르거나 풀면 저절로 푼 알림을 지움
    if (e.target.name === 'autoRenew') $('#notice-days-field').hidden = val('autoRenew') !== 'YES';
    if (e.target.name === 'method') syncOrgAll();
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
    renderOrigins(extraOrigin); // 연장이면 만료 뒤 서비스를 닫기 전인 계약도 목록에 (A-11)
    onOriginChange();
  }
  function bundleNumber() {
    const kind = val('kind');
    const origin = $('#f-origin').value;
    if (kind === 'NEW' || !origin) return null;
    if (source && source.status === 'REJECTED') return source.id; // 다시 기안: 같은 번호의 다음 차수
    return C.nextChildId(origin, kind); // 예: 2601CL001-A02 (common.js)
  }
  // 새로 기안할 수 없는 원계약: 같은 종류의 반려된 기안이 있으면 새 번호 대신 그 기안을 보완해 같은 번호로 다시 올림(REQ-FLOW-17),
  //   연장은 진행 중인 연장, 해지, 기간 변경이 있으면 그 뒤에. 계약 상세의 버튼 규칙과 같게 (v0.63 점검에서 고침: 주소로 오면 막지 않았음)
  function originBlock() {
    const kind = val('kind'), origin = $('#f-origin').value;
    if (!origin || !kind || kind === 'NEW' || (source && source.status === 'REJECTED')) return null;
    const b = C.bundleOf(origin);
    if (!b) return null;
    const rej = b.rejected.filter(function (o) { return o.kind === kind; })[0];
    if (rej) {
      // 보완 후 재기안 링크는 그 기안을 올린 사람(시연은 최고관리자)에게만. 다른 사람은 기안자에게 요청 (v0.63 검토)
      //   기획자 결정 2026-11-03(C-44): 올린 사람 대신 지금 영업대표(C.isSalesRep). 요청할 사람도 그 사람(C.repActorOf)
      const own = C.isSalesRep(rej, me) || me.role === 'SUPER';
      //   긴 계약번호는 문장 앞에 둠(양쪽 정렬이라 문장 가운데의 긴 번호 때문에 낱말 사이가 크게 벌어졌음, v0.63 점검)
      return { msg: rej.id + ': 반려된 ' + D.KINDS[kind] + ' 기안이 있습니다. 새로 기안하지 않고 그 기안을 보완해 같은 번호로 다시 올립니다.' +
        (own ? '' : ' 영업대표(' + C.ownerLabel(C.repActorOf(rej)) + ')에게 보완을 요청하세요.'), href: own ? C.resubmitHref(rej) : '', short: '반려된 기안을 보완 후 재기안하세요. 새로 기안할 수 없습니다.' };
    }
    if (kind === 'RENEW') {
      const busy = b.open.filter(function (o) { return o.kind === 'RENEW' || o.kind === 'TERMINATE' || (o.kind === 'CHANGE' && o.changeType === 'PERIOD'); })[0];
      if (busy) return { msg: busy.id + ': 진행 중인 ' + C.kindLabel(busy) + ' 기안이 있어 새 연장을 올릴 수 없습니다. 그 기안이 끝난 뒤에 올립니다.', short: '진행 중인 기안이 끝난 뒤에 올리세요.' };
    }
    return null;
  }
  function onOriginChange() {
    const help = $('#origin-help');
    const no = bundleNumber();
    const block = originBlock();
    help.innerHTML = block ? esc(block.msg) + (block.href ? ' <a class="doc-link" href="' + block.href + '">보완 후 재기안</a>' : '')
      : esc(no
        ? '기안하면 ' + no + '(' + D.KINDS[val('kind')] + ' ' + no.slice(-2).replace(/^0/, '') + '차)로 원계약과 함께 묶입니다.'
        : originHelp()); // A-3: 내가 영업대표인 계약만
    // 원계약을 고르면 거래처를 미리 채움 (비어 있을 때만). 계약명은 두지 않음 (v0.12)
    const o = D.CONTRACTS.find(function (c) { return c.id === $('#f-origin').value; });
    if (o) {
      if (!$('#f-customer').value) pickCustomerByName(o.counterparty, '', o.unit);
    }
    // 열람 제한 이어받기 (D-13 v0.39 기획자 결정): 원계약이 열람 제한이면 변경, 연장 기안도 제한. 여기서는 풀 수 없고 관리자만(열람 제한 관리)
    const fromOrigin = !!(o && o.restricted && val('kind') !== 'NEW');
    // 보완 후 재기안: 이미 기안한 계약에 걸린 열람 제한은 영업이 풀 수 없음(풀기는 관리자만, REQ-AUTH-07. v0.63 통제 목록 CTL-94 점검)
    const kept = !!(source && source.status === 'REJECTED' && source.restricted);
    const inherit = fromOrigin || kept;
    const rc = $('#f-restricted');
    if (inherit) { rc.checked = true; rc.dataset.auto = '1'; }
    else if (rc.dataset.auto) { rc.checked = false; delete rc.dataset.auto; } // 이어받아 체크했던 것만 되돌림
    rc.disabled = inherit;
    $('#restricted-help').textContent = kept && !fromOrigin
      ? '이 계약에 이미 걸린 열람 제한입니다. 풀기와 열람자 지정은 관리자만 할 수 있습니다(열람 제한 관리).'
      : inherit
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
  // 받는 파일: 안내와 같게 PDF, Word, 한글, 한 파일 50MB 이하 (REQ-REG-15, REQ-UI-21 첨부 형식, v0.63 점검에서 고침: 아무 파일이나 받았음)
  //   끌어다 놓기도 같은 검사. 맞지 않는 파일은 빼고 그 칸 아래에 알림
  const FILE_OK = /\.(pdf|doc|docx|hwp|hwpx)$/i, FILE_MAX = 50 * 1048576;
  function addFiles(key, list) {
    const bad = [];
    Array.prototype.forEach.call(list, function (f) {
      if (!FILE_OK.test(f.name) || f.size > FILE_MAX) { bad.push(f.name); return; }
      files[key].push({ name: f.name, size: f.size });
    });
    if (key === 'quote' || key === 'diff') files[key] = files[key].slice(-1);
    renderFiles(key);
    const box = $('#f-' + key).closest('.field');
    C.setFieldError(box, bad.length ? '올릴 수 없는 파일을 뺐습니다(' + bad.join(', ') + '). PDF, Word, 한글 파일만, 한 파일 50MB 이하로 올립니다.' : '');
  }
  [['draft', '#f-draft'], ['diff', '#f-diff'], ['annex', '#f-annex'], ['quote', '#f-quote']].forEach(function (pair) {
    $(pair[1]).addEventListener('change', function (e) { addFiles(pair[0], e.target.files); e.target.value = ''; });
  });
  $$('.file-drop').forEach(function (drop) {
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('is-dragover'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('is-dragover'); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('is-dragover'); addFiles(drop.dataset.target, e.dataTransfer.files); refresh(); });
  });
  // 파일을 넣거나 지우면 다시 계산: 최종 견적서가 있어야 "견적서로 계약서를 대신함"을 고를 수 있음(B-5). 파일 칸 선택은 폼의 change가 다시 계산
  form.addEventListener('click', function (e) {
    const b = e.target.closest('[data-file]');
    if (!b) return;
    files[b.dataset.file].splice(Number(b.dataset.i), 1);
    renderFiles(b.dataset.file);
    refresh();
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
    const box = el && el.closest && (el.closest('.org-field.is-invalid') || el.closest('[data-field], .product-item'));
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
    const block = originBlock();
    if (block) need(false, 'origin', block.short); // 긴 설명과 링크는 칸 아래 도움말에 이미 있음(같은 문장을 두 번 보이지 않게, v0.63 검토)
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
    // 기획자 결정 2026-11-02 E-1 ①: 다른 고객의 계약에 쓴 번호는 막고, 같은 고객의 다른 계약에 쓴 번호면 까닭을 받음
    syncOpp();
    if (opp.other.length) need(false, 'opportunity', '다른 고객의 계약에 쓴 영업기회번호입니다. 번호 하나는 계약 하나에만 씁니다. 판다에서 번호를 확인하세요.');
    else if (opp.same.length) need(!!val('oppReason'), 'oppReason', '같은 고객의 다른 계약에 쓴 영업기회번호입니다. 같은 번호를 쓰는 까닭을 적으세요.');
    // 기획자 결정 2026-11-02 C-16: 거래처나 계약 묶음에 보류가 걸려 있으면 기안하지 못함(임시 저장은 됨). 거래처 확인(C-13)은 경고만이라 여기서 막지 않음
    syncGuards();
    if (guard.hold) need(false, 'customer', '보류가 걸린 ' + (guard.hold.kind === 'BUNDLE' ? '계약 묶음이라' : '거래처라') + ' 기안할 수 없습니다. 보류가 풀린 뒤 기안합니다.', qInput);
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
      const msg = r.retired ? (i + 1) + '번째 줄의 기능은 지금 쓰지 않습니다. 다른 기능을 고르세요.'
        : (i + 1) + '번째 줄의 서비스, 제품, 기능, 수량, 계약 금액을 모두 넣으세요.';
      err.hidden = false;
      err.innerHTML = C.icon('alert', 'sm') + '<span>' + esc(msg) + '</span>';
      // 비어 있는 첫 칸으로 (서비스 → 제품 → 기능 → 수량 → 금액). 사용 안 함인 기능이면 기능 칸으로
      const empty = r.retired ? r.li.querySelector('[data-k="feature"]')
        : ['service', 'product', 'feature'].map(function (k) { return r.li.querySelector('[data-k="' + k + '"]'); }).filter(function (s) { return !s.value; })[0];
      errors.push({ msg: msg, target: !r.product ? empty : (!r.qty ? r.li.querySelector('[data-k="qty"]') : r.li.querySelector('[data-k="amount"]')) });
    });
    // 간접 계약은 줄마다 사용 업체, 모르면 까닭 (v0.62, 표준 대응표 G-19)
    if (val('method') === 'INDIRECT') {
      rows.forEach(function (r, i) {
        const o = orgOf(r.li);
        let msg = '', target = null;
        if (!o.org && !o.orgPending) { msg = (i + 1) + '번째 줄의 사용 업체를 적으세요. 아직 모르면 "아직 정해지지 않음"과 까닭을 고릅니다.'; target = r.li.querySelector('[data-k="org"]'); }
        else if (o.orgPending === true) { msg = (i + 1) + '번째 줄의 사용 업체가 정해지지 않은 까닭을 고르세요.'; target = r.li.querySelector('[data-k="orgWhy"]'); }
        else if (o.orgPending === 'OTHER' && !o.orgNote) { msg = (i + 1) + '번째 줄의 그 밖의 까닭을 적으세요.'; target = r.li.querySelector('[data-k="orgNote"]'); }
        if (!msg) return;
        C.setFieldError(r.li.querySelector('.org-field'), msg);
        errors.push({ msg: msg, target: target });
      });
    }
    // 금전 거래가 있는 계약만 등록 (REQ-SCOPE-05, v0.58 QA: 금액을 모두 0으로 넣어도 기안되었음)
    if (rows.length && rows.every(function (r) { return r.product && r.qty && r.amount != null; })) {
      need(totalAmount() > 0, 'products', '계약 금액 총액이 0원입니다. 금전 거래가 있는 계약만 등록합니다.', rows[0].li.querySelector('[data-k="amount"]'));
    }
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
    // 기획자 결정 2026-11-02 B-6: 4번이 "예"이면 조건의 종류(하나 이상)와 비고 둘 다
    if (val('accounting') === 'YES') need(acctKinds().length > 0, 'acctKinds', '4번이 "예"이면 조건의 종류를 하나 이상 고르세요.');
    if (val('accounting') === 'YES') need(!!val('accountingNote'), 'accountingNote', '4번이 "예"이면 비고에 어떤 조건인지 적으세요.');

    // 기획자 결정 2026-11-02 B-5: 견적서로 계약서를 대신하면 계약서 초안 없이 기안할 수 있음. 고른 채로 기준을 벗어났으면 막음
    const qiChecked = $('#f-quote-instead').checked;
    if (qiChecked) need(quoteInsteadOk(totalAmount()), 'quoteInstead', '견적서로 계약서를 대신하려면 공급가액 합계가 ' + fmtNum(QI_UNDER) + '원 미만이고 최종 견적서를 첨부해야 합니다.');
    if (!qiChecked) need(files.draft.length > 0, 'draftFile', '계약서 초안을 첨부하세요.', $('#f-draft'));
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
  // 화면에 넣은 값을 계약 기록으로 (데이터 정의서 contract, contract_product, attachment. 다시 채울 값은 form에)
  function formRecord() {
    const rows = readProducts().filter(function (r) { return r.feature; });
    const services = [];
    rows.forEach(function (r) { const sv = r.product && r.product.service; if (sv && services.indexOf(sv) < 0) services.push(sv); });
    const products = rows.map(function (r) {
      const o = orgOf(r.li);
      // 까닭을 아직 안 고른 미정(true)은 임시 저장에서만 남음(기안은 validate가 막음). 이어서 작성하면 체크한 채로 열림
      //   기획자 결정 2026-11-02 E-4: 그날의 표준 단가와 할인율 한도(listPrice, cap)도 남김(03 계약 제품의 "쓴 가격 기준과 그때의 한도" 제안, G-03)
      //     뒤에 한도를 바꿔도 이 계약의 결재선(③, ③ 영업 임원 승인)은 이 값으로 정함(C.capOver). 이어서 작성하면 그날 값으로 다시 셈
      return Object.assign({ feature: r.feature, qty: r.qty, amount: r.amount }, r.product ? { listPrice: r.product.listPrice, cap: r.product.discountCap } : {}, o.org ? { org: o.org } : {},
        o.orgPending ? { orgPending: o.orgPending } : {}, o.orgPending === 'OTHER' && o.orgNote ? { orgNote: o.orgNote } : {});
    });
    const checklist = {
      // 비고는 보이는 것만(적어야 할 때만) 저장
      standard: val('standard'), standardNote: noteIf(val('standard') === 'NO', 'standardNote'),
      // "계산 대기"(WAIT)는 화면에만 있는 값이라 저장하지 않음(03 CODE-CHECK-ANSWER, v0.63 점검). 다시 열면 다시 계산
      price: current.pc.q2 === 'WAIT' ? null : current.pc.q2, priceNote: noteIf(current.pc.q2 === 'NO', 'priceNote'),
      cap: current.pc.q3 === 'WAIT' ? null : current.pc.q3, capNote: noteIf(current.pc.q3 === 'NO', 'capNote'),
      accounting: val('accounting'), accountingNote: noteIf(val('accounting') === 'YES', 'accountingNote'),
      acctKinds: val('accounting') === 'YES' ? acctKinds() : [], // B-6: 4번 조건의 종류(D.ACCT_KINDS 코드)
    };
    // B-5: 견적서로 계약서를 대신함. 고른 채로 기준을 벗어나면(임시 저장 때) false로 남김
    const quoteInstead = $('#f-quote-instead').checked && quoteInsteadOk(totalAmount());
    const kind = val('kind') || 'NEW';
    const tp = templatePick();
    const fileList = [];
    [['draft', 'DRAFT_DOC'], ['diff', 'CLAUSE_DIFF'], ['annex', 'ANNEX'], ['quote', 'QUOTE']].forEach(function (k) {
      files[k[0]].forEach(function (x) { fileList.push({ kind: k[1], name: x.name, size: x.size }); });
    });
    const formVals = {
      // customerNew: 거래처를 검색하지 못해 직접 입력함(결재 문서에 "새 거래처" 표시, v0.63 표준 대응표 G-25 ①).
      //   보완 후 재기안은 1차에서 등록한 거래처를 고르게 되므로, 같은 거래처(사업자등록번호)일 때만 1차의 표시를 이어 감
      bizNo: val('bizNo'), method: val('method'), personalData: val('personalData'), // 처리위탁 답(YES, NO, 비어 있음)을 그대로
      customerNew: val('customer') === NEW_CUSTOMER || !!(source && source.status === 'REJECTED' && C.isNewCustomer(source) &&
        String(val('bizNo')).replace(/-/g, '') === String((source.form || {}).bizNo || (D.CUSTOMERS.filter(function (cu) { return cu.name === source.counterparty; })[0] || {}).bizNo || '').replace(/-/g, '')), settlement: val('settlement'), opportunity: val('opportunity'),
      startDate: val('startDate'), endDate: val('endDate'), autoRenew: val('autoRenew'), noticeDays: parseNum(val('noticeDays')),
      products: products, checklist: checklist, yearly: $('#yearly-field').hidden ? [] : yearlyAmounts(),
      ledger: val('ledger'), taxInvoice: val('taxInvoice'), purchase: val('purchase'), memo: val('memo'), template: tp,
      quoteInstead: quoteInstead,
      oppReason: oppDupOk() ? val('oppReason') : '', // E-1 ①: 같은 고객의 다른 계약과 같은 번호를 쓰는 까닭(보일 때만 저장)
    };
    return {
      counterparty: val('counterparty'), unit: unitValue(), services: services, kind: kind,
      parentId: kind !== 'NEW' ? ($('#f-origin').value || null) : null,
      amount: totalAmount(), requesterId: drafterId(), // A-3: 변경과 연장은 원계약의 영업대표(위 drafterId)
      restricted: !!val('restricted'), personalData: val('personalData') === 'YES', sla: val('sla'),
      startDate: formVals.startDate, endDate: formVals.endDate, autoRenew: formVals.autoRenew, noticeDays: formVals.noticeDays,
      template: tp, checklist: checklist, products: products, memo: formVals.memo, files: fileList, form: formVals,
      quoteInstead: quoteInstead, // B-5 (03 contract.quote_instead 제안)
      // 기획자 결정 2026-11-02 E-1 ①: 같은 고객의 다른 계약과 같은 영업기회번호를 쓴 까닭과 그 계약들(결재 문서에 보임). 없으면 null
      //   C-13: 기안할 때 보인 거래처 확인 경고 문장(없으면 ''). 보완 후 재기안은 그때 값으로 바꿔 씀(앞 차수 값이 남지 않게 늘 넣음)
      oppDup: oppDupOk() ? { ids: opp.same.map(function (c) { return c.id; }), reason: val('oppReason') } : null,
      customerCheckWarn: guard.check || '',
    };
  }
  // 같은 고객의 다른 계약과 같은 번호를 쓰고(다른 고객 계약에는 없음) 까닭을 받는 중인지
  function oppDupOk() { return !opp.other.length && opp.same.length > 0; }

  // 임시 저장: 나만 보는 작성 중 기록(계약번호 없이 임시 키 D-0002 꼴). 이어서 작성하면 같은 기록을 바꿔 씀 (REQ-FLOW-14, 31)
  //   보완 후 재기안은 반려된 계약을 고치는 것이라 임시 저장 없이 바로 기안
  //   두 단추는 화면 아래에 붙은 단추 줄에 있음(기획자 결정 2026-11-02 D-4). 줄 높이가 고정이라 임시 저장이 숨어도 흔들리지 않음
  if (source && source.status === 'REJECTED') $('#btn-save').hidden = true;
  $('#btn-save').addEventListener('click', function () {
    const key = source && source.status === 'DRAFT' ? source.draftKey : C.newDraftKey();
    C.saveDemoContract(Object.assign(formRecord(), { id: null, draftKey: key, status: 'DRAFT', savedAt: C.nowStamp().slice(0, 16), history: [] })); // 임시 저장일시(03 saved_at, 일시)
    C.flash('임시 저장했습니다. 나만 볼 수 있고, 내 등록 목록에서 이어서 작성할 수 있습니다.');
    location.replace('new-contract.html?id=' + encodeURIComponent(key));
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
      // 기획자 결정 2026-11-02 C-13: 거래처 확인 경고가 있으면 기안 전에 한 번 더 보임(막지 않음)
      guard.check ? ['거래처 확인', guard.check] : null,
      // E-1 ①: 같은 고객의 다른 계약과 같은 번호면 그 계약과 까닭을 함께
      ['영업기회번호', val('opportunity') + (oppDupOk() ? ' (같은 고객의 다른 계약 ' + oppNames(opp.same) + '에도 씀. 까닭: ' + val('oppReason') + ')' : '')],
      ['서비스', serviceOfProducts()],
      ['계약 금액', fmtNum(current.total || 0) + '원 (부가세 별도)'],
      ['계약 기간', C.fmtPeriod(val('startDate'), val('endDate'))],
      ['서비스 수준 협약(SLA)', val('sla') === 'YES' ? '있음' : '없음'],
      ['기준 표준계약서', templatePick() ? (templatePick().id === 'OWN' ? '상대방 양식(표준계약서 없음)' : templatePick().label) : '-'], // v0.53
      ['계약 검토', goes.join(', ')],
      // B-5: 체결할 문서. 견적서로 대신하면 ⑦⑧ 이름도 바뀜
      ['체결 문서', current.qi ? '고객이 날인한 최종 견적서 (견적서로 계약서를 대신함)' : '계약서'],
      // B-6: 4번 조건의 종류를 함께 보임
      ['재무 알림', val('accounting') === 'YES' ? '재무에 이메일로 알림 (결재선 아님). 4번 조건: ' + acctKindText(acctKinds()) : '없음'],
      ['기안 차수', round + '차' + (val('restricted') ? ', 열람 제한' : '')],
    ];
    $('#confirm-body').innerHTML = '<p>기안하면 ② 체크리스트 검토부터 시작되고, 기안한 내용은 결재가 끝날 때까지 고칠 수 없습니다.</p>' +
      '<dl class="confirm-list">' + rows.filter(Boolean).map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl>';
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

  // 기안: 계약번호를 붙여 저장하고 결재 문서(SCR-23)로 감. ② 체크리스트 검토부터 시작 (v0.58 QA: 예전에는 저장하지 않았음)
  //   보완 후 재기안: 같은 계약번호의 다음 차수. 앞 차수의 결재 기록과 기안 일시는 그대로 남김(REQ-FLOW-17)
  //   이어서 작성한 임시 저장은 기안하면 지움
  function done() {
    const no = newNumber();
    const now = C.nowStamp().slice(0, 16);
    const rec = source && source.status === 'REJECTED' ? C.resubmitRecord(source, formRecord())
      : Object.assign(formRecord(), { id: no, status: 'IN_REVIEW', requestedAt: now, round: round, history: [] });
    if (source && source.status === 'DRAFT') C.deleteDraft(source);
    C.saveDemoContract(rec);
    C.flash(no + ' ' + round + '차로 기안했습니다. 다음 차례: ② 체크리스트 검토 (' + C.ownerLabel(C.stepUserNow('S02', rec)) + ')');
    location.href = 'review.html?id=' + encodeURIComponent(no);
  }

  /* ---------- 미리 채우기 (이어서 작성, 보완 후 재기안) ---------- */
  if (source) {
    const f = source.form || {};
    setRadio('kind', source.kind || 'NEW');
    // 다시 기안하는 변경, 연장: 원계약과 계약종류는 그대로(같은 번호의 다음 차수라 바꿀 수 없음, v0.58 QA)
    //   목록은 계약종류에 맞게 채우고, 목록에 없는 원계약은 extraOrigin(보완 후 재기안은 늘, 이어서 작성은 내가 영업대표일 때만, A-3)
    if (source.parentId) {
      renderOrigins(extraOrigin);
      if (Array.prototype.some.call($('#f-origin').options, function (o) { return o.value === source.parentId; })) $('#f-origin').value = source.parentId;
    }
    if (source.status === 'REJECTED') {
      $('#f-origin').disabled = true;
      $$('[name="kind"]', form).forEach(function (r) { r.disabled = true; });
    }
    pickCustomerByName(source.counterparty, f.bizNo, source.unit || f.unit);
    // 다시 채울 값(form)이 없는 계약(예시 계약 등)은 계약 기록의 값으로 채움 (v0.62: ⑧ 반려 뒤 보완 후 재기안이 빈 칸으로 열렸음).
    //   form이 있으면(임시 저장, 화면에서 기안한 것) 그 값만 씀: 비워 둔 칸을 다른 값으로 채우지 않음
    const fb = source.form ? {} : source;
    $('#f-opportunity').value = f.opportunity || fb.opportunity || '';
    updateOppLink();
    // 기획자 결정 2026-11-02 E-1 ①: 같은 번호를 쓰는 까닭(보이는지는 refresh의 syncOpp가 정함)
    $('#f-opp-reason').value = f.oppReason || (source.oppDup && source.oppDup.reason) || '';
    setRadio('method', f.method ? (f.method === 'RESELLER' ? 'INDIRECT' : f.method) : source.form ? '' : C.methodOf(source));
    $('#f-start').value = f.startDate || fb.startDate || '';
    $('#f-end').value = f.endDate || fb.endDate || '';
    const autoRenew = f.autoRenew || fb.autoRenew;
    setRadio('autoRenew', autoRenew);
    $('#notice-days-field').hidden = autoRenew !== 'YES';
    $('#f-notice-days').value = f.noticeDays || fb.noticeDays || '';
    // 처리위탁 여부: 고른 답 그대로(form.personalData). 답하지 않은 임시 저장은 비워 둠 (v0.63 점검에서 고침: "없음"으로 열렸음)
    setRadio('personalData', f.personalData != null ? f.personalData : source.personalData ? 'YES' : source.status === 'DRAFT' ? '' : 'NO');
    if (source.sla || f.sla) setRadio('sla', source.sla || f.sla); // 서비스 수준 협약 (v0.40)
    $('#f-restricted').checked = !!source.restricted;
    setRadio('settlement', f.settlement);
    const ck = Object.assign({}, source.checklist || {}, f.checklist || {}); // 계약 기록의 답과 다시 채울 값 (v0.58 QA: 4번 답과 비고가 빠졌음)
    setRadio('standard', ck.standard); $('#f-standard-note').value = ck.standardNote || '';
    $('#f-price-note').value = ck.priceNote || ''; $('#f-cap-note').value = ck.capNote || '';
    setRadio('accounting', ck.accounting); $('#f-accounting-note').value = ck.accountingNote || '';
    $$('[name="acctKinds"]', form).forEach(function (i) { i.checked = (ck.acctKinds || []).indexOf(i.value) > -1; }); // B-6
    const tp = source.template || f.template; // 기준 표준계약서 (v0.53)
    if (tp) $('#f-template').value = tp.id;
    setRadio('ledger', f.ledger); $('#f-tax').value = f.taxInvoice || ''; $('#f-purchase').value = f.purchase || '';
    $('#f-memo').value = f.memo || fb.memo || '';
    (f.products || fb.products || []).forEach(function (p) { addProduct(p); });
    // 첨부: 저장해 둔 파일 이름. 예시 반려 건처럼 없으면 계약서 초안(과 조항 대비표)을 예로 채움
    const saved = source.files || [];
    [['draft', 'DRAFT_DOC'], ['diff', 'CLAUSE_DIFF'], ['annex', 'ANNEX'], ['quote', 'QUOTE']].forEach(function (k) {
      saved.filter(function (x) { return x.kind === k[1]; }).forEach(function (x) { files[k[0]].push({ name: x.name, size: x.size || 50000 }); });
      renderFiles(k[0]);
    });
    // B-5: 견적서로 계약서를 대신한 계약은 계약서 초안 대신 최종 견적서를 예로 채우고 체크 칸을 다시 고름(기준은 refresh가 다시 봄)
    const qiSource = !!(source.quoteInstead || f.quoteInstead);
    if (source.status === 'REJECTED' && qiSource && !files.quote.length) { files.quote.push({ name: source.counterparty + ' 최종 견적서 ' + (round - 1) + '차.pdf', size: 52000 }); renderFiles('quote'); }
    if (source.status === 'REJECTED' && !qiSource && !files.draft.length) { files.draft.push({ name: source.counterparty + ' 계약서 ' + (round - 1) + '차 기안본.docx', size: 84000 }); renderFiles('draft'); }
    if (source.status === 'REJECTED' && ck.standard === 'NO' && !files.diff.length) { files.diff.push({ name: source.counterparty + ' 조항 대비표.docx', size: 36000 }); renderFiles('diff'); }
    $('#f-quote-instead').checked = qiSource;
  }
  // 계약 상세, 만료 예정에서 "변경 기안", "연장 기안"으로 들어오면 구분과 원계약을 미리 고름
  //   new-contract.html?kind=AMEND&origin=2601CL001 (REQ-ARC-02, 05)
  const pre = new URLSearchParams(location.search);
  if (!source && ['AMEND', 'RENEW'].indexOf(pre.get('kind')) > -1) {
    setRadio('kind', pre.get('kind'));
    renderOrigins(null);
    if (origins.some(function (c) { return c.id === pre.get('origin'); })) $('#f-origin').value = pre.get('origin');
    else {
      // A-3: 다른 영업의 계약으로 들어오면 미리 고르지 않고 까닭을 알림(계약 상세 D-5 안내와 같은 말)
      //   기획자 결정 2026-11-03(C-44): 처음 기안한 사람이 아니라 지금 영업대표(C.isSalesRep, C.salesRepOf). 맡을 수 없으면 대신 맡는 사람도 알림
      const po = D.CONTRACTS.find(function (c) { return c.id === pre.get('origin') && !c.parentId; });
      if (po && !C.isSalesRep(po, me) && !anyOrigin && C.canView(po, me)) {
        $('#notice').innerHTML = noticeHtml('', '영업대표만 변경과 연장을 기안합니다',
          '이 계약(' + esc(po.id) + ')의 영업대표는 ' + esc(C.ownerLabel(C.salesRepOf(po))) + '입니다.' + (C.repNeeded(po) ? ' ' + esc(C.repCoverText(po)) : '') +
          ' 원계약은 내가 영업대표인 계약 중에서 고릅니다.', '');
      }
    }
  }
  // 신규 막기(기획자 결정 2026-11-03 C-44): 영업 담당자가 아닌 사람(위 repOnly)은 지금 영업대표인 계약의 변경과 연장만. 반려된 신규의 보완 후 재기안은 그대로
  if (repOnly && !(source && source.status === 'REJECTED')) {
    const nr = form.querySelector('[name="kind"][value="NEW"]');
    if (nr) { nr.disabled = true; if (nr.checked) setRadio('kind', 'AMEND'); }
  }
  if (!$$('#product-list > li').length) addProduct();
  syncOrgAll();
  onKindChange();
  refresh();
  // 연도별 금액은 기간으로 칸이 생긴 뒤에 채움
  if (source && source.form && (source.form.yearly || []).length) {
    $$('.yearly-input').forEach(function (inp, i) { if (source.form.yearly[i] != null) inp.value = fmtNum(source.form.yearly[i]); });
    updateYearSum();
  }
})();
