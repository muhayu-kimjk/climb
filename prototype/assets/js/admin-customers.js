/* =====================================================================
 * SCR-55 거래처 관리 화면 로직 (admin-customers.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-REG-18(거래처 목록에서 고르기, 관리자가 고치고 합침), 데이터 정의서 6장(customer), D-01
 * 하는 일
 *   1. 거래처 목록: 상호, 사업자등록번호, 계약 수, 등록한 사람과 날짜, 상태, 거래처 확인. 검색과 상태, 확인 거르기, 한 쪽 20곳
 *   2. 같은 거래처로 보이는 곳 알림: 사업자등록번호 앞 6자리(000-00)가 같고 상호 하나가 다른 하나를 품음 [가정]
 *   3. 합치기: 둘 이상 골라 남길 거래처를 정함. 나머지의 계약은 남길 거래처로 옮기고, 나머지는 "합쳐짐"으로 남김
 *   4. 고치기(상호, 사업자등록번호, 사용 여부), 거래처 추가. 사업자등록번호는 중복 불가
 *   5. 변경 이력
 * v0.46 기획자 결정: 거래처마다 두던 기관(부서) 목록(v0.39)을 없앰. 기관 이름은 고유 번호가 없어 맞는지 확인할 수 없으므로
 *   계약 등록에서 "기관 또는 부서명"을 계약마다 직접 적고, 거래처에는 쌓지 않음
 * 기획자 결정 2026-11-02 C-13(거래처 확인)과 덧붙임 "컴플라이언스"
 *   6. 확인 묶음: 확인 대상(국가와 지자체: 사업자등록번호 가운데 두 자리 83, 조달 계약의 거래처, 간접 계약의 거래처인 총판과 리셀러)에
 *      확인 상태(확인 안 함, 문제 없음, 문제 있음, 다음 확인일이 지나면 "다시 확인할 때 지남"), 계산한 위험 등급, 다음 확인일을 보임
 *      판단은 common.js "거래처 확인과 보류"(C.customerCheck). 같은 판단으로 계약 등록이 경고만 함(막지 않음)
 *   7. 확인 남기기: 제재 명단, 부정적 보도, 실제 소유자, 공직자 관련의 결과(이름은 남기지 않음), 확인 상태, 확인한 날,
 *      다음 확인일(처음 값 1년 뒤), 증빙 파일, 확인한 방법과 판단. 컴플라이언스 담당자(시연용 최고관리자)만 남김(C.canComplianceAct)
 *      기록은 쌓기만 함(다시 확인하면 한 줄 더). "거래처 확인 기록" 표와 거래처마다의 "확인 기록" 창에 보이고, 관리자 변경 이력(영역 COMPLIANCE)에도 남음
 *   8. 보류(C-16): 보류가 걸린 거래처는 상태 칸에 "보류 중". 걸고 푸는 것은 개선 과제와 보류(SCR-64)
 *   컴플라이언스 담당자는 이 화면에서 확인만 남기고 거래처를 추가하거나 고치거나 합치지 않음(관리자 일). 관리자는 확인을 보기만 함
 * 프로토타입: 계약은 상호로 연결되어 있어 상호를 바꾸거나 합치면 계약의 상호를 바꿔 보여 줌.
 *   실제 시스템은 계약이 거래처 번호(customer_id)로 연결되므로 거래처만 바꾸면 됨. 바꾼 내용은 이 브라우저에만 저장(시연 기록)
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  // 기획자 결정 2026-11-02 C-13 덧붙임: 컴플라이언스 담당자도 이 화면을 열어 거래처 확인을 남김
  if (!C.gate(me, ['ADMIN', 'COMPLIANCE'], '거래처 관리는 관리자와 컴플라이언스 담당자가 씁니다',
    '지금은 ' + esc(C.roleLabel(me.role)) + ' 역할로 보고 있습니다. 화면 맨 위 검은 띠에서 관리자, 컴플라이언스 담당자, 최고관리자 가운데 하나로 바꾸면 볼 수 있습니다.')) return;

  // 거래처를 추가하고 고치고 합치는 사람: 관리자(시연용 최고관리자). 거래처 확인을 남기는 사람: 컴플라이언스 담당자(시연용 최고관리자)
  //   읽기만 하는 역할은 둘 다 false (2026-11-02 C-2)
  const canEdit = !C.isReadOnly(me) && (me.role === 'SUPER' || C.hasRole(me, ['ADMIN']));
  const canCheck = C.canComplianceAct(me);
  const CK = D.CUSTOMER_CHECK;

  const PAGE_SIZE = 20; // 한 쪽 20곳: 화면이 A4 2장을 넘지 않게 (REQ-ADM-04와 같은 기준)
  let page = 1;
  let checkPage = 1; // 거래처 확인 기록 표의 쪽
  let picked = [];
  const STATE = { USE: ['success', '사용 중'], OFF: ['neutral', '사용 안 함'], MERGED: ['neutral', '합쳐짐'] };

  function val(f, n) { return (f.elements[n].value || '').trim(); }
  function find(id) { return D.CUSTOMERS.filter(function (cu) { return cu.id === id; })[0]; }
  function stateOf(cu) { return cu.mergedInto ? 'MERGED' : cu.use ? 'USE' : 'OFF'; }
  function contractsOf(cu) { return D.CONTRACTS.filter(function (c) { return c.id && c.counterparty === cu.name; }).length; }
  function tag(cu) { return cu.name + '(' + cu.id + ')'; }
  function ro(word) { return C.josa(word, '으로', '로'); } // ㄹ 받침은 "로"
  // 같은 상호가 다른 거래처에 있는지 (계약은 상호로 이어지므로 같은 이름이면 두 거래처의 계약이 섞임, v0.58 QA)
  function nameTaken(name, selfId) {
    return D.CUSTOMERS.filter(function (cu) { return cu.name === name && cu.id !== selfId && !cu.mergedInto; })[0] || null;
  }

  // 관리자가 아닌 사람(컴플라이언스 담당자)에게는 추가와 합치기 단추를 두지 않고 안내 문장을 맞춤
  if (!canEdit) {
    $('#btn-add').hidden = true;
    $('#btn-merge').hidden = true;
    $('#list-desc').textContent = canCheck
      ? '확인 대상 거래처에 거래처 확인 결과를 남깁니다. 거래처를 추가하거나 고치거나 합치는 일은 관리자가 합니다.'
      : '보기만 합니다. 거래처를 고치는 일은 관리자가, 거래처 확인은 컴플라이언스 담당자가 합니다.';
  }
  // 개요 "점검할 일"의 거래처 확인 링크(?check=todo)로 들어오면 확인 전이거나 지난 거래처만
  if (new URLSearchParams(location.search).get('check') === 'todo') $('#f-check').value = 'TODO';

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

  /* ---------- 6. 거래처 확인 칸 (기획자 결정 2026-11-02 C-13) ---------- */
  // 확인 거르기: NEED 확인 대상 전체, TODO 확인 전이거나 다음 확인일 지남, ISSUE 문제 있음, HOLD 보류 중(C-16)
  function checkFits(cu, ck, want) {
    if (!want) return true;
    if (cu.mergedInto) return false;
    if (want === 'NEED') return ck.needed;
    if (want === 'TODO') return ck.todo;
    if (want === 'ISSUE') return ck.state === 'ISSUE';
    return want === 'HOLD' ? !!C.customerHold(cu.bizNo) : true;
  }
  // 칸: 상태 배지(데이터) + 까닭과 위험 등급, 다음 확인일(흐린 보조 줄). 대상이 아니고 기록도 없으면 "대상 아님"
  function checkCell(cu, ck) {
    if (cu.mergedInto) return '-';
    if (!ck.needed && !ck.last) return '<span class="cell-meta">대상 아님</span>';
    const sub = [ck.riskLabel ? '위험 ' + ck.riskLabel : '', ck.due ? '다음 ' + C.fmtDate(ck.due) : ''].filter(Boolean).join(', ');
    return C.badge(ck.tone, ck.label) + '<span class="cell-meta">' + esc(ck.whyText || '대상 아님') + '</span>' +
      (sub ? '<span class="cell-meta">' + esc(sub) + '</span>' : '');
  }

  /* ---------- 1. 목록 ---------- */
  function filtered() {
    const q = $('#f-q').value.trim().toLowerCase(), st = $('#f-use').value, want = $('#f-check').value;
    return D.CUSTOMERS.filter(function (cu) {
      // 사업자등록번호는 '-' 없이 숫자만 넣어도 찾음 (v0.58 QA)
      const qd = q.replace(/[^0-9]/g, '');
      if (q && cu.name.toLowerCase().indexOf(q) < 0 && cu.bizNo.indexOf(q) < 0 && !(qd && cu.bizNo.replace(/-/g, '').indexOf(qd) > -1)) return false;
      if (st && stateOf(cu) !== st) return false;
      return checkFits(cu, C.customerCheck(cu.bizNo), want);
    });
  }
  function render() {
    const pairs = dupPairs();
    // 같은 곳 알림은 합칠 수 있는 사람(관리자)에게만. 컴플라이언스 담당자에게는 할 일이 아니어서 감춤
    $('#dup').innerHTML = canEdit && pairs.length ? C.noticeBox('', '같은 거래처로 보이는 곳이 있습니다',
      pairs.map(function (p) { return '<strong>' + esc(tag(p[0]) + ', ' + tag(p[1])) + '</strong>'; }).join('<br>') +
      '<br>사업자등록번호 앞자리가 같고 상호가 비슷합니다. 사업자등록증을 확인한 뒤 같은 곳이면 둘을 골라 합치세요.') : '';

    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (page > pages) page = pages;
    const from = (page - 1) * PAGE_SIZE, rows = list.slice(from, from + PAGE_SIZE);
    const counts = Object.keys(STATE).map(function (k) { return [STATE[k][1], list.filter(function (cu) { return stateOf(cu) === k; }).length + '곳']; });
    // 확인 전이거나 지난 거래처 수(C-13): 사용 중인 거래처만
    const todo = list.filter(function (cu) { return stateOf(cu) === 'USE' && C.customerCheck(cu.bizNo).todo; }).length;
    $('#list-count').innerHTML = C.meta([[(list.length !== D.CUSTOMERS.length ? '검색 결과' : '전체'), '<strong>' + list.length + '곳</strong>']].concat(counts)
      .concat([['확인 전이나 지남', todo + '곳']]));
    // 사용 안 함으로 돌린 거래처는 합치기에서 뺌(고르는 칸이 사라져 뺄 수 없었음, v0.58 QA)
    picked = picked.filter(function (id) { return find(id) && stateOf(find(id)) === 'USE'; });
    $('#rows').innerHTML = rows.length ? rows.map(function (cu) {
      const st = stateOf(cu), into = cu.mergedInto ? find(cu.mergedInto) : null;
      const ck = C.customerCheck(cu.bizNo), hold = st === 'MERGED' ? null : C.customerHold(cu.bizNo);
      // 관리 칸: 고치기(관리자), 확인 남기기(컴플라이언스 담당자), 확인 기록(기록이 있으면 모두)
      const acts = [];
      if (st !== 'MERGED' && canEdit) acts.push('<button type="button" class="link-act" data-edit="' + esc(cu.id) + '" aria-label="' + esc(cu.name) + ' 고치기">고치기</button>');
      if (st !== 'MERGED' && canCheck) acts.push('<button type="button" class="link-act" data-check="' + esc(cu.id) + '" aria-label="' + esc(cu.name) + ' 거래처 확인 남기기">확인 남기기</button>');
      if (ck.records.length) acts.push('<button type="button" class="link-act" data-log="' + esc(cu.id) + '" aria-label="' + esc(cu.name) + ' 거래처 확인 기록 보기">확인 기록</button>');
      return '<tr' + (st !== 'USE' ? ' class="is-muted"' : '') + '>' +
        '<td class="col-action">' + (st === 'USE' && canEdit ? '<label class="choice choice--only"><input type="checkbox" data-pick="' + esc(cu.id) + '"' +
          (picked.indexOf(cu.id) > -1 ? ' checked' : '') + ' aria-label="' + esc(cu.name) + ' 합치기에 고르기"></label>' : '') + '</td>' +
        '<td class="col-wide"><span class="cell-strong">' + esc(cu.name) + '</span><span class="cell-meta">' + esc(cu.id) + (into ? ', ' + esc(ro(into.name)) + ' 합쳐짐' : '') + '</span></td>' +
        '<td class="num-left">' + esc(cu.bizNo) + '</td>' +
        '<td class="num">' + contractsOf(cu) + '건</td>' +
        '<td class="center nowrap">' + esc(C.ownerLabel(cu.registeredBy)) + '<span class="cell-meta">' + C.fmtDate(cu.registeredAt) + '</span></td>' +
        // 보류 중(C-16)은 상태 아래 배지. 걸고 푸는 곳은 개선 과제와 보류(SCR-64)
        '<td class="nowrap">' + C.badge(STATE[st][0], STATE[st][1]) + (hold ? '<span class="cell-meta">' + C.holdBadge(hold) + '</span>' : '') + '</td>' +
        '<td class="nowrap">' + checkCell(cu, ck) + '</td>' +
        '<td class="col-action">' + (acts.length ? acts.join('') : '-') + '</td></tr>';
    }).join('') : '<tr><td class="empty-row" colspan="8">조건에 맞는 거래처가 없습니다.</td></tr>';
    $('#pagination').innerHTML = C.pagerHtml(page, pages, list.length, from, rows.length, PAGE_SIZE, '곳');
    $('#btn-merge').disabled = picked.length < 2;
    $('#btn-merge').textContent = '고른 거래처 합치기' + (picked.length ? ' (' + picked.length + '곳)' : '');
    renderChecks();
    $('#history').innerHTML = C.adminHistoryHtml(C.adminLog(['CUSTOMER']), '거래처 변경 이력');
  }

  /* ---------- 7. 거래처 확인 기록 (기획자 결정 2026-11-02 C-13): 쌓기만 함, 최근 것부터 ---------- */
  function optLabel(it, v) { return (it.options.filter(function (o) { return o[0] === v; })[0] || [v, v || '-'])[1]; }
  // 항목별 결과 한 줄씩. 문제로 본 결과는 굵게
  function itemsHtml(r) {
    return CK.ITEMS.map(function (it) {
      const txt = esc(it.label + ' ' + optLabel(it, r[it.key]));
      return it.bad.indexOf(r[it.key]) > -1 ? '<strong>' + txt + '</strong>' : txt;
    }).join('<br>');
  }
  function recordTable(list, caption) {
    return '<div class="tbl-scroll" tabindex="0" role="region" aria-label="' + esc(caption) + '">' +
      '<table class="tbl tbl--compact tbl--history"><caption class="sr-only">' + esc(caption) + ': 확인한 날, 거래처, 항목별 결과, 확인한 방법과 판단, 확인 상태, 다음 확인일과 증빙, 확인한 사람</caption>' +
      '<thead><tr><th scope="col">확인한 날</th><th scope="col">거래처</th><th scope="col">항목별 결과</th><th scope="col">확인한 방법과 판단</th>' +
      '<th scope="col">확인 상태</th><th scope="col">다음 확인일</th><th scope="col">확인한 사람</th></tr></thead><tbody>' +
      (list.length ? list.map(function (r) {
        return '<tr><td class="num-left"><span class="keep">' + C.fmtDate(r.on) + '</span></td>' +
          '<td><span class="cell-strong">' + esc(r.name) + '</span><span class="cell-meta">' + esc(r.bizNo) + '</span>' +
            '<span class="cell-meta">' + esc((r.why || []).map(function (k) { return CK.WHY[k]; }).join(', ') || '대상 아님') + '</span></td>' +
          '<td>' + itemsHtml(r) + '</td>' +
          '<td>' + esc(r.note) + '</td>' +
          '<td class="nowrap">' + C.badge(r.result === 'ISSUE' ? 'danger' : 'success', CK.RESULT[r.result]) +
            (r.risk ? '<span class="cell-meta">위험 ' + esc(CK.RISK[r.risk]) + '</span>' : '') + '</td>' +
          '<td class="num-left"><span class="keep">' + C.fmtDate(r.next) + '</span><span class="cell-meta">증빙 ' + esc(r.file) + '</span></td>' +
          '<td class="center">' + esc(C.ownerLabel(r.by)) + '<span class="cell-meta">' + C.fmtDateTime(r.at) + '</span></td></tr>';
      }).join('') : '<tr><td class="empty-row" colspan="7">아직 남긴 거래처 확인이 없습니다.</td></tr>') + '</tbody></table></div>';
  }
  function renderChecks() {
    const all = (D.CUSTOMER_CHECKS || []).slice().sort(function (a, b) { return b.at.localeCompare(a.at); });
    const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    if (checkPage > pages) checkPage = pages;
    const from = (checkPage - 1) * PAGE_SIZE, rows = all.slice(from, from + PAGE_SIZE);
    $('#checks').innerHTML = recordTable(rows, '거래처 확인 기록');
    $('#check-pages').innerHTML = C.pagerHtml(checkPage, pages, all.length, from, rows.length, PAGE_SIZE, '건');
  }
  // 한 거래처의 확인 기록(보기만 하는 창)
  function openLog(id) {
    const cu = find(id), list = C.customerChecksOf(cu.id).slice().reverse();
    C.formModal({
      title: cu.name + ' 거래처 확인 기록',
      desc: '남긴 기록은 고치거나 지울 수 없습니다. 최근 것부터 보입니다.',
      body: recordTable(list, cu.name + ' 거래처 확인 기록'),
      btn: false,
    });
  }

  /* ---------- 7. 확인 남기기 (컴플라이언스 담당자, 기획자 결정 2026-11-02 C-13) ---------- */
  function nextCheckId() {
    const n = (D.CUSTOMER_CHECKS || []).reduce(function (m, r) { return Math.max(m, Number(String(r.id).replace(/\D/g, '')) || 0); }, 0) + 1;
    return 'CK-' + String(n).padStart(4, '0');
  }
  // 변경 이력 한 줄(mock-data.js의 예시 줄과 같은 모양)
  function checkChange(r) {
    return '거래처 확인(' + r.id + '): ' + CK.RESULT[r.result] + (r.risk ? ', 위험 ' + CK.RISK[r.risk] : '') + '. ' +
      CK.ITEMS.map(function (it) { return it.label + ' ' + optLabel(it, r[it.key]); }).join(', ') +
      '. 확인한 날 ' + r.on + ', 다음 확인일 ' + r.next + ', 증빙 ' + r.file;
  }
  // 증빙 파일 칸: 파일을 고르거나 시연용 예시 파일. 프로토타입은 파일 이름만 남김. 고른 파일 줄은 처음부터 두어 창이 흔들리지 않게
  function fileFieldHtml(cu) {
    return '<div class="field" data-field="file"><label class="field-label" for="fm-file">증빙 파일<span class="req" aria-hidden="true">*</span><span class="sr-only">(필수)</span></label>' +
      '<input class="input" id="fm-file" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png">' +
      '<p class="field-help">확인한 화면이나 문서를 PDF나 그림으로 묶어 올립니다(시안에서는 파일 이름만 남김). ' +
      '<button type="button" class="btn-text" data-demo-file="' + esc(cu.name) + '">예시 파일 고르기 (시연)</button></p>' +
      '<p class="field-help" data-file-name aria-live="polite">고른 파일: 없음</p><p class="field-error" hidden></p></div>';
  }
  function fileNameOf(f) {
    const input = f.elements.file;
    return f.getAttribute('data-demo-name') || (input.files && input.files[0] ? input.files[0].name : '');
  }
  function openCheck(id) {
    const cu = find(id), ck = C.customerCheck(cu.bizNo);
    const sel = function (it) {
      return C.fieldHtml({ name: it.key, label: it.label, type: 'select', required: true, options: [['', '고르세요']].concat(it.options), help: it.help });
    };
    C.formModal({
      title: cu.name + ' 거래처 확인을 남길까요?',
      desc: '시스템 밖에서 확인한 결과만 남깁니다. 남긴 기록은 고치거나 지울 수 없고, 다시 확인하면 새 기록을 더합니다.',
      body: '<p class="modal-info">' + C.meta([['사업자등록번호', esc(cu.bizNo)], ['확인 대상', esc(ck.whyText || '대상 아님')],
          ['지난 확인', ck.last ? esc(ck.label + ', ' + C.fmtDate(ck.last.on)) : '없음']]) + '</p>' +
        '<div class="check-grid">' + CK.ITEMS.map(sel).join('') + '</div>' + // 네 항목을 두 줄 두 칸(휴대폰은 한 줄에 하나, admin.css)
        // 위험 등급은 결과를 고르는 대로 다시 계산해 한 줄로 보임(줄 높이는 그대로라 창이 흔들리지 않음)
        '<p class="modal-info" id="fm-risk" aria-live="polite"></p>' +
        C.fieldHtml({ name: 'result', label: '확인 상태', type: 'select', required: true, options: [['', '고르세요'], ['OK', CK.RESULT.OK], ['ISSUE', CK.RESULT.ISSUE]],
          help: '결과에 문제가 있는데 문제 없음으로 남기면 아래 메모에 그 판단 까닭을 꼭 적습니다.' }) +
        '<div class="field-row">' +
          C.fieldHtml({ name: 'on', label: '확인한 날', type: 'date', required: true, value: D.TODAY, attrs: ' max="' + D.TODAY + '"' }) +
          C.fieldHtml({ name: 'next', label: '다음 확인일', type: 'date', required: true, value: C.monthsLater(D.TODAY, 12 * CK.nextYears),
            // min: 확인한 날 다음 날부터만 달력에서 고르게 함. 확인한 날을 바꾸면 아래 open에서 함께 바꿈(2026-11-06 점검 3회차)
            attrs: ' min="' + C.addDays(D.TODAY, 1) + '" data-after="fm-on" data-after-msg="다음 확인일은 확인한 날 뒤여야 합니다."', help: '처음 값은 확인한 날 ' + CK.nextYears + '년 뒤. 앞당길 수 있습니다.' }) +
        '</div>' +
        fileFieldHtml(cu) +
        C.fieldHtml({ name: 'note', label: '확인한 방법과 판단', type: 'textarea', required: true, placeholder: '예: 제재 명단과 입찰 참가 제한 업체, 신문 검색, 주주명부로 확인함',
          help: '실제 소유자나 공직자의 이름은 적지 않고 결과만 적습니다.' }),
      btn: '확인 남기기',
      open: function (f) {
        // 위험 등급(계산): 결과에 문제가 하나라도 있으면 높음, 없으면 간접은 보통, 국가와 지자체와 조달은 낮음 [가정]
        const risk = function () {
          const r = {};
          CK.ITEMS.forEach(function (it) { r[it.key] = f.elements[it.key].value; });
          const k = C.customerCheckRisk(ck.why, r);
          $('#fm-risk').innerHTML = C.meta([['계산한 위험 등급', k ? '<strong>' + esc(CK.RISK[k]) + '</strong>' : '확인 대상 아님']]);
        };
        risk();
        f.addEventListener('change', function (e) { if (CK.ITEMS.some(function (it) { return it.key === e.target.name; })) risk(); });
        // 확인한 날을 바꾸면 다음 확인일도 1년 뒤로(다음 확인일을 직접 바꾼 뒤에는 그대로)
        let touched = false;
        f.elements.next.addEventListener('input', function () { touched = true; });
        ['input', 'change'].forEach(function (t) {
          f.elements.on.addEventListener(t, function () {
            if (!f.elements.on.value) return;
            // 다음 확인일 달력이 확인한 날 당일을 내놓지 않게 min을 다음 날로(2026-11-06 점검 3회차: 고르면 오류가 났음)
            f.elements.next.min = C.addDays(f.elements.on.value, 1);
            if (!touched) f.elements.next.value = C.monthsLater(f.elements.on.value, 12 * CK.nextYears);
          });
        });
        const showName = function () { f.querySelector('[data-file-name]').textContent = '고른 파일: ' + (fileNameOf(f) || '없음'); };
        f.elements.file.addEventListener('change', function () { f.removeAttribute('data-demo-name'); showName(); });
        f.querySelector('[data-demo-file]').addEventListener('click', function () {
          f.setAttribute('data-demo-name', cu.name + '_거래처확인_' + (f.elements.on.value || D.TODAY) + '.pdf');
          showName();
          C.setFieldError(f.querySelector('[data-field="file"]'), '');
        });
      },
      check: function (f) {
        const on = val(f, 'on'), next = val(f, 'next'), errs = {};
        CK.ITEMS.forEach(function (it) { errs[it.key] = val(f, it.key) ? '' : it.label + ' 결과를 고르세요.'; });
        errs.result = val(f, 'result') ? '' : '확인 상태를 고르세요.';
        // 날짜 칸은 "고르세요", 없는 날짜를 적었으면 그렇다고 알림(C.dateFieldError, 2026-11-06 점검 3회차)
        errs.on = !on ? C.dateFieldError(f.elements.on, '확인한 날을 고르세요.') : on > D.TODAY ? '오늘(' + C.fmtDate(D.TODAY) + ')보다 뒤 날짜는 고를 수 없습니다.' : '';
        errs.next = !next ? C.dateFieldError(f.elements.next, '다음 확인일을 고르세요.') : on && next <= on ? '다음 확인일은 확인한 날 뒤여야 합니다.' : '';
        errs.file = fileNameOf(f) ? '' : '증빙 파일을 고르세요.';
        errs.note = val(f, 'note') ? '' : '확인한 방법과 판단을 적으세요.';
        return errs;
      },
      done: function (f) {
        const r = { id: nextCheckId(), customerId: cu.id, bizNo: cu.bizNo, name: cu.name, why: ck.why, on: val(f, 'on'), next: val(f, 'next'),
          result: val(f, 'result'), file: fileNameOf(f) };
        CK.ITEMS.forEach(function (it) { r[it.key] = val(f, it.key); });
        r.risk = C.customerCheckRisk(ck.why, r);
        const e = C.adminSave('COMPLIANCE', cu.name + ' (' + cu.bizNo + ')', checkChange(r), val(f, 'note'), { k: 'CUSTOMER_CHECK', r: r });
        if (e.refused) return;
        render();
        C.toast(cu.name + ' 거래처 확인을 남겼습니다. 다음 확인일은 ' + C.fmtDate(r.next) + '입니다.');
      },
    });
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
    // 고유번호(가운데 82, 83)는 검증 숫자가 맞지 않아도 막지 않음. 저장한 뒤 알림 (v0.39)
    if (!C.isBizNo(v) && !C.isUniqueNo(v)) return '사업자등록번호가 맞지 않습니다. 사업자등록증의 숫자를 다시 확인하세요.'; // 검증 숫자 규칙 (v0.32)
    const dup = D.CUSTOMERS.filter(function (cu) { return cu.bizNo === v && cu.id !== selfId; })[0];
    return dup ? '이미 등록된 사업자등록번호입니다(' + dup.name + ').' : '';
  }
  function formatOnInput(f) {
    // 숫자만 넣으면 '-'를 붙여 보여 줌 (v0.34)
    f.elements.bizNo.addEventListener('input', function (e) { e.target.value = C.fmtBizNo(e.target.value); });
  }
  function uniqueNote(no) { return !C.isBizNo(no) && C.isUniqueNo(no) ? ' 고유번호의 검증 숫자가 맞지 않으니 번호를 다시 확인하세요.' : ''; }
  function openEdit(id) {
    const cu = find(id);
    C.formModal({
      title: cu.name + ' 거래처를 고칠까요?',
      desc: '상호를 바꾸면 이 거래처의 모든 계약에 새 상호가 보입니다. 사용 안 함으로 돌리면 계약 등록에서 고를 수 없습니다.',
      body: C.fieldHtml({ name: 'cuName', label: '상호', required: true, value: cu.name, help: '사업자등록증의 상호', attrs: ' maxlength="60"' }) /* 기획자 결정 2026-11-09: 사업자등록번호, 상호, 수량은 모든 화면 같은 규칙 */ +
        C.fieldHtml({ name: 'bizNo', label: '사업자등록번호', required: true, value: cu.bizNo, help: "숫자 10자리를 넣으면 '-'가 저절로 붙습니다.", attrs: ' inputmode="numeric" maxlength="12"' }) +
        C.fieldHtml({ name: 'use', label: '상태', type: 'select', value: String(cu.use), options: [['true', '사용 중'], ['false', '사용 안 함']] }) +
        C.fieldHtml({ name: 'reason', label: '고치는 사유', type: 'textarea', required: true, placeholder: '예: 사업자등록증의 상호로 바로잡음' }),
      btn: '저장',
      open: formatOnInput,
      check: function (f) {
        const same = val(f, 'cuName') === cu.name && val(f, 'bizNo') === cu.bizNo && val(f, 'use') === String(cu.use);
        return {
          cuName: !val(f, 'cuName') ? '상호를 넣으세요.' : same ? '바뀐 내용이 없습니다.'
            : nameTaken(val(f, 'cuName'), cu.id) ? '같은 상호의 거래처가 이미 있습니다(' + nameTaken(val(f, 'cuName'), cu.id).id + '). 같은 곳이면 합치기를 쓰세요.' : '',
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
        C.toast(set.name + ' 거래처를 고쳤습니다.' + uniqueNote(set.bizNo));
      },
    });
  }
  function openAdd() {
    C.formModal({
      title: '거래처를 추가할까요?',
      desc: '추가하면 계약 등록의 거래처 목록에서 고를 수 있습니다.',
      body: C.fieldHtml({ name: 'cuName', label: '상호', required: true, placeholder: '예: 삼성전자 주식회사', help: '사업자등록증의 상호', attrs: ' maxlength="60"' }) +
        C.fieldHtml({ name: 'bizNo', label: '사업자등록번호', required: true, placeholder: '예: 124-81-00998', help: "숫자 10자리를 넣으면 '-'가 저절로 붙습니다.", attrs: ' inputmode="numeric" maxlength="12"' }) +
        C.fieldHtml({ name: 'reason', label: '추가하는 사유', type: 'textarea', required: true, placeholder: '예: 조달 계약 예정 기관을 미리 등록' }),
      btn: '추가',
      open: formatOnInput,
      check: function (f) {
        return { cuName: !val(f, 'cuName') ? '상호를 넣으세요.' : nameTaken(val(f, 'cuName'), null) ? '같은 상호의 거래처가 이미 있습니다(' + nameTaken(val(f, 'cuName'), null).id + ').' : '', bizNo: bizNoError(val(f, 'bizNo'), null), reason: val(f, 'reason') ? '' : '추가하는 사유를 적으세요.' };
      },
      done: function (f) {
        // 거래처 번호는 가장 큰 번호 + 1(계약 기안에서도 거래처가 등록되므로 개수 + 1이면 겹칠 수 있음), 등록 경로는 ADMIN
        //   (데이터 정의서 6장 registered_via, 계약 등록의 registerCustomer와 같은 셈) (2026-11-06 점검 4회차)
        const maxNo = D.CUSTOMERS.reduce(function (m, x) { return Math.max(m, Number(String(x.id).replace(/\D/g, '')) || 0); }, 0);
        const cu = { id: 'C-' + String(maxNo + 1).padStart(4, '0'), name: val(f, 'cuName'), bizNo: val(f, 'bizNo'), registeredVia: 'ADMIN', registeredContractNo: null };
        C.adminSave('CUSTOMER', tag(cu), '거래처 추가: ' + cu.bizNo, val(f, 'reason'), { k: 'CUSTOMER_ADD', cu: cu });
        render();
        C.toast(cu.name + ' 거래처를 추가했습니다.' + uniqueNote(cu.bizNo));
      },
    });
  }

  /* ---------- 이벤트 ---------- */
  $('#filter').addEventListener('input', function () { page = 1; render(); });
  // 검색 칸은 'input'이 이미 그렸으므로 'change'(칸을 떠날 때)에서 다시 그리지 않음. 다시 그리면 누르던 줄이나 쪽 번호가 바뀌어 클릭이 사라짐(2026-11-06 점검 4회차)
  $('#filter').addEventListener('change', function (e) { if (e.target.matches('input[type=search], input[type=text]')) return; page = 1; render(); });
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
    if (b.id === 'btn-add' && canEdit) openAdd();
    else if (b.id === 'btn-merge' && canEdit) openMerge();
    else if (b.getAttribute('data-edit') && canEdit) openEdit(b.getAttribute('data-edit'));
    else if (b.getAttribute('data-check') && canCheck) openCheck(b.getAttribute('data-check'));
    else if (b.getAttribute('data-log')) openLog(b.getAttribute('data-log'));
    else if (b.getAttribute('data-page') && !b.disabled) {
      // 쪽 번호: 거래처 목록과 거래처 확인 기록이 따로 넘김
      const n = Number(b.getAttribute('data-page'));
      // 누른 쪽 번호 단추가 다시 그려져 없어지므로 초점도 그 묶음 제목으로(2026-11-06 점검 3회차)
      if (b.closest('#check-pages')) { checkPage = n; renderChecks(); C.focusSection('#sec-checks'); }
      else { page = n; render(); C.focusSection('#sec-list'); }
    }
  });
  render();
})();
