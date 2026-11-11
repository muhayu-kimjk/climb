/* =====================================================================
 * SCR-65 설정 변경 확인 화면 로직 (config-review.js)
 * ---------------------------------------------------------------------
 * 기획자 결정 2026-11-02 C-8(G-12): 설정 변경을 바꾼 사람이 아닌 사람이 다시 봄. 전후 값, 사유, 품의 링크
 *   가격과 제품 줄은 재무 리더가 "품의와 맞음" 또는 "품의와 다름(의견 필수)"
 *   표준계약서 줄은 올린 법무가 아닌 법무가 "근거와 맞음" 또는 "근거와 다름(의견 필수)". 본인이 올린 판은 누를 수 없는 단추와 까닭
 *   기록은 쌓기만 함(관리자 변경 이력의 점검 기록, control-checks.js saveCheck). 한 건에 확인 하나
 *   결재선 규칙과 회사 설정의 변경은 정보보호의 매월 기록 점검(SCR-57 "설정 변경")에서 봄
 *   거래처 줄(2026-11-09 5회차 점검, 05 G-25 ②, CTL-83): 완료 계약이 있는 거래처의 사업자등록번호 변경만 재무 리더가 "맞음" 또는 "다름(의견 필수)"
 *     거래처 추가와 합치기, 완료 계약이 없는 거래처의 고치기는 이 화면에 없고 SCR-57 설정 변경 묶음에서만 봄(control-checks.js needsCheck)
 *     기획자 결정 2026-11-10 22번: 합치는 거래처 가운데 완료 계약이 있는 곳이 있으면 그 합치기도 재무 리더가 "맞음", "다름"으로 확인
 *       창 제목 "이 거래처 합치기가 맞나요?", 사유 칸 아래 "완료 계약 n건이 있는 거래처를 합침". 완료 계약이 없는 거래처끼리의 합치기는 그대로 SCR-57에서만
 *     완료 계약은 계약 완료, 만료, 해지 상태(기획자 확인 2026-11-10 23번)
 *   C-6: 최고관리자는 시연으로 확인할 수 있지만 자기가 바꾼 줄은 못함
 *   기획자 결정 2026-11-09 5회차 13번: "다름"을 남기면 컴플라이언스에 넘김(control-checks.js X.raiseIssue). 개요 점검할 일과 이메일
 * 볼 수 있는 사람: 재무 리더, 법무(C.checkOwners('SCR-65')), 최고관리자(시연용), 감사 열람(보기만), 컴플라이언스(보기만)
 *   기획자 결정 2026-11-10 16번: 컴플라이언스도 감사 열람처럼 모든 영역을 보기만 함. 넘어온 일(설정 변경 확인의 "다름")의 원래 기록을 바로 봄
 * 확인을 남길 수 있는지: control-checks.js canConfirm(맡은 영역인지, 본인이 바꾼 줄이 아닌지, 읽기만 하는 역할이 아닌지)
 *   읽기만 하는 역할(감사 열람)과 컴플라이언스는 관리 칸을 아예 그리지 않음(viewOnly)
 * 한 쪽 20건(다른 목록과 같음, REQ-ADM-04)
 * ===================================================================== */
(function () {
  const C = window.CLIMB;
  const X = window.CLIMB_CTL;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const SCR = 'SCR-65';
  // 문: 맡은 사람, 감사 열람, 컴플라이언스(보기만, 기획자 결정 2026-11-10 16번)
  if (!C.gate(me, C.checkOwners(SCR).concat(['AUDIT', 'COMPLIANCE']), '설정 변경 확인은 재무 리더와 법무가 씁니다',
    '지금은 ' + esc(C.roleLabel(me.role)) + ' 역할로 보고 있습니다. 화면 맨 위 검은 띠에서 재무 리더, 법무 담당자, 감사 열람, 컴플라이언스, 최고관리자 가운데 하나로 바꾸면 볼 수 있습니다.')) return;

  const PAGE_SIZE = 20;
  // 컴플라이언스는 감사 열람과 똑같이 보기만(기획자 결정 2026-11-10 16번): 관리 칸 없음, 보기만 안내
  const isCompliance = me.role !== 'SUPER' && C.hasRole(me, ['COMPLIANCE']);
  const readOnly = C.isReadOnly(me) || isCompliance;
  const canDo = C.canDoCheck(me, SCR) && !isCompliance;
  const isFin = C.hasRole(me, ['FIN_LEAD']), isLegal = C.hasRole(me, ['LEGAL']);
  // 법무만인 사람은 표준계약서 줄만 봄(2026-11-06 점검, REQ-SCOPE-02, REQ-ADM-26): 가격과 제품의 변경까지 모두 보였음
  //   재무 리더, 최고관리자, 감사 열람, 컴플라이언스(기획자 결정 2026-11-10 16번)는 그대로 모든 영역. 영역 고르기, 건수, 확인 기록도 표준계약서만
  const legalOnly = isLegal && !C.hasRole(me, ['FIN_LEAD', 'SUPER', 'AUDIT']);
  // 거래처(CUSTOMER)를 더함(2026-11-09 5회차 점검, G-25 ②). 법무만인 사람은 그대로 표준계약서만
  const AREAS = legalOnly ? ['TEMPLATE'] : ['PRICE', 'PRODUCT', 'TEMPLATE', 'CUSTOMER']; // 이 화면에서 확인하는 영역 (결재선 규칙, 회사 설정은 SCR-57)
  if (legalOnly) $('#f-area').querySelectorAll('option[value="PRICE"], option[value="PRODUCT"]').forEach(function (o) { o.remove(); });
  // 영역 고르기에 거래처를 더함(2026-11-09 5회차 점검): config-review.html의 고르기에는 거래처가 없어 여기서 붙임. 화면을 열 때 한 번이라 흔들리지 않음
  else if (!$('#f-area').querySelector('option[value="CUSTOMER"]')) $('#f-area').insertAdjacentHTML('beforeend', '<option value="CUSTOMER">' + esc(X.AREA_SET.CUSTOMER) + '</option>');
  // 이 화면의 줄: 확인 대상만(2026-11-09 5회차 점검). 거래처는 완료 계약이 있는 거래처의 번호 변경만 needsCheck가 참
  function changes(areas) { return X.settingChanges({ areas: areas }).filter(X.needsCheck); }
  let page = 1;
  function val(f, n) { return (f.elements[n].value || '').trim(); }
  function dt(at) { return C.fmtDateTime(at).split(' ').map(function (s) { return '<span class="keep">' + s + '</span>'; }).join(' '); }

  // 맡은 일에 맞춘 안내 한 줄 (역할은 화면을 여는 동안 바뀌지 않아 자리가 흔들리지 않음)
  $('#app-desc').textContent = (readOnly || !canDo ? '보기만 합니다. 확인은 재무 리더와 법무가 남깁니다.'
    : me.role === 'SUPER' ? '시연으로 모든 줄을 확인할 수 있지만, 본인이 바꾼 줄은 확인하지 못합니다.'
      // 거래처 번호 변경도 재무 리더가 봄(2026-11-09 5회차 점검, G-25 ②)
      // 완료 계약이 있는 거래처의 합치기도 더함(기획자 결정 2026-11-10 22번)
      : isFin ? '가격 기준과 제품과 기능 줄마다 품의와 맞는지 확인을 남깁니다. 같은 때 같은 품의로 넣은 가격 줄은 한 건으로 봅니다. 완료 계약이 있는 거래처의 사업자등록번호 변경과 합치기도 맞는지 확인합니다.'
        : isLegal ? '표준계약서 판마다 근거와 맞는지 확인을 남깁니다. 본인이 올린 판은 올린 사람이 아닌 법무가 확인합니다.' : '') +
    // 그 밖의 거래처 변경: 추가, 완료 계약이 없는 거래처의 고치기와 합치기(기획자 결정 2026-11-10 22번으로 합치기 일부가 이 화면에 옴)
    ' 결재선 규칙과 회사 설정의 변경, 거래처의 그 밖의 변경(추가, 완료 계약이 없는 거래처의 고치기와 합치기)은 접속 기록 점검의 설정 변경에서 정보보호가 봅니다.';
  if (readOnly) $('#th-action').remove(); // 감사 열람과 컴플라이언스: 관리 칸 없음(C-2, 기획자 결정 2026-11-10 16번)

  function stateOf(x) { const k = X.checkOf(x.id); return k ? k.result : 'WAIT'; }
  function filtered() {
    const area = $('#f-area').value, state = $('#f-state').value;
    return changes(area && AREAS.indexOf(area) > -1 ? [area] : AREAS).filter(function (x) { return !state || stateOf(x) === state; });
  }
  // 가격 기준을 여러 기능에 함께 넣은 건은 기능마다 전후 값을 접어 둠
  function itemsHtml(x) {
    if (!x.items || x.items.length < 2) return '';
    return '<details class="seen-data"><summary>기능마다 보기</summary><ul class="summary-list cell-meta">' + x.items.map(function (it) {
      return '<li>' + esc(it.label) + ': ' + esc((it.before ? it.before + ' → ' : '처음 넣음: ') + it.after) + ' (' + C.fmtDate(it.from) + '부터)</li>';
    }).join('') + '</ul></details>';
  }
  function basisHtml(x) {
    if (x.area === 'PRICE') return '<span class="cell-meta">품의 ' + (X.docLink(x) || '링크 없음') + '</span>';
    if (x.area === 'PRODUCT') return '<span class="cell-meta">품의 링크 칸 없음(사유를 봄)</span>';
    // 왜 확인하는지(2026-11-09 5회차 점검). 합치기는 "완료 계약 n건이 있는 거래처를 합침"(기획자 결정 2026-11-10 22번)
    if (x.area === 'CUSTOMER') return '<span class="cell-meta">완료 계약 ' + (x.doneCount || 0) + '건이 있는 거래처' + (x.merge ? '를 합침' : '') + '</span>';
    return '';
  }
  // 확인 칸: 남긴 확인(결과, 누가, 언제, 의견) 또는 확인 전과 누가 볼 차례인지(본인이 바꾼 줄이면 그 까닭)
  function stateHtml(x, cc) {
    const k = X.checkOf(x.id), who = X.checkerLabel(x.area);
    if (k) {
      return C.badge(k.result === 'MATCH' ? 'success' : 'attention', k.label) + '<span class="cell-meta">' + esc(who + ' ' + C.ownerLabel(k.by) + ', ' + C.fmtDateTime(k.at)) + '</span>' +
        (k.note ? '<span class="cell-meta">' + esc(k.note) + '</span>' : '');
    }
    return C.badge('line', '확인 전') + '<span class="cell-meta">' + esc(cc.why || who + '가 확인할 차례') + '</span>';
  }
  function actionHtml(x, cc) {
    // 줄마다 같은 "확인 남기기"라 화면낭독기가 어느 줄인지 알게 단추 글 뒤에 줄 이름(바꾼 것과 일시)을 붙임. 보이는 글이 이름의 앞(2026-11-06 점검)
    const row = '<span class="sr-only"> ' + esc(x.target + ' ' + C.fmtDateTime(x.at)) + '</span>';
    if (cc.ok) return '<button type="button" class="link-act" data-check="' + esc(x.id) + '">확인 남기기' + row + '</button>';
    if (cc.mine && cc.why) return '<button type="button" class="link-act" disabled>확인 남기기' + row + '</button>'; // 본인이 바꾼 줄(까닭은 확인 칸에)
    return '-';
  }
  function render() {
    const all = changes(AREAS);
    const waitAll = all.filter(function (x) { return !X.checkOf(x.id); });
    const waitFin = waitAll.filter(function (x) { return x.area !== 'TEMPLATE'; }).length; // 재무 리더 몫(가격, 제품, 거래처)
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (page > pages) page = pages;
    const from = (page - 1) * PAGE_SIZE, rows = list.slice(from, from + PAGE_SIZE);
    $('#list-count').innerHTML = C.meta([[(list.length !== all.length ? '거른 결과' : '전체'), '<strong>' + list.length + '건</strong>'],
      // 법무만인 사람에게는 표준계약서 건수만(legalOnly, 2026-11-06 점검)
      // 재무 리더 몫에 거래처가 들어가 이름을 "가격, 제품, 거래처"로(2026-11-09 5회차 점검)
      ['확인 전', (legalOnly ? '' : '가격, 제품, 거래처 ' + waitFin + '건, ') + '표준계약서 ' + (waitAll.length - waitFin) + '건']]);
    const cols = readOnly ? 6 : 7;
    $('#rows').innerHTML = rows.length ? rows.map(function (x) {
      const cc = X.canConfirm(me, x);
      return '<tr><td class="num-left">' + dt(x.at) + '</td>' +
        '<td><span class="cell-strong">' + esc(x.target) + '</span><span class="cell-meta">' + esc(X.AREA_SET[x.area]) + '</span></td>' +
        '<td>' + esc(x.change) + itemsHtml(x) + '</td>' +
        '<td>' + esc(x.reason || '-') + basisHtml(x) + '</td>' +
        '<td class="center">' + esc(C.ownerLabel(x.by)) + '</td>' +
        '<td>' + stateHtml(x, cc) + '</td>' +
        (readOnly ? '' : '<td class="col-action">' + actionHtml(x, cc) + '</td>') + '</tr>';
    }).join('') : '<tr><td class="empty-row" colspan="' + cols + '">조건에 맞는 설정 변경이 없습니다.</td></tr>';
    $('#pagination').innerHTML = C.pagerHtml(page, pages, list.length, from, rows.length, PAGE_SIZE, '건');
    renderLog();
  }
  // 확인 기록: 모든 확인(최근 것부터). 대상 이름은 지금 설정 변경 묶음에서 찾고, 없으면 기록의 대상
  function renderLog() {
    const byId = {};
    changes(AREAS).forEach(function (x) { byId[x.id] = x; });
    // 법무만인 사람에게는 표준계약서 확인만(legalOnly, 2026-11-06 점검: 재무 리더가 남긴 가격과 제품 확인으로 바뀐 것이 보였음)
    const list = X.checkEntries().filter(function (e) { return AREAS.indexOf(e.op.area) > -1; });
    $('#log-rows').innerHTML = list.length ? list.map(function (e) {
      const x = byId[e.op.id];
      return '<tr><td class="num-left">' + dt(e.at) + '</td><td class="center">' + esc(C.ownerLabel(e.by)) + '</td>' +
        '<td><span class="cell-strong">' + esc(x ? x.target : String(e.target).replace(/^설정 변경 확인: /, '')) + '</span><span class="cell-meta">' + esc(X.AREA_SET[e.op.area] || '') + '</span></td>' +
        '<td class="nowrap">' + C.badge(e.op.result === 'MATCH' ? 'success' : 'attention', X.resultLabel(e.op.area, e.op.result)) + '</td>' +
        '<td>' + esc(e.op.note || '-') + '</td></tr>';
    }).join('') : '<tr><td class="empty-row" colspan="5">아직 남긴 확인이 없습니다.</td></tr>';
  }

  function openCheck(id) {
    const x = changes(AREAS).filter(function (y) { return y.id === id; })[0];
    if (!x || !X.canConfirm(me, x).ok) return;
    const R = X.RESULT[x.area], tpl = x.area === 'TEMPLATE', cust = x.area === 'CUSTOMER'; // cust: 거래처 번호 변경(2026-11-09 5회차 점검)
    const items = x.items && x.items.length > 1 ? '<li>기능마다: ' + x.items.map(function (it) {
      return esc(it.label + ' ' + (it.before ? it.before + ' → ' : '처음 넣음: ') + it.after);
    }).join(', ') + '</li>' : '';
    C.formModal({
      // 거래처는 품의가 없어 "이 번호 변경이 맞나요?"(2026-11-09 5회차 점검). 합치기는 "이 거래처 합치기가 맞나요?"(기획자 결정 2026-11-10 22번)
      title: tpl ? '이 판이 근거와 맞나요?' : cust ? (x.merge ? '이 거래처 합치기가 맞나요?' : '이 번호 변경이 맞나요?') : '이 변경이 품의와 맞나요?',
      desc: '저장하면 확인한 사람과 일시, 결과가 남고 고칠 수 없습니다.',
      body: '<div class="modal-info"><ul class="summary-list">' +
          '<li>' + esc(X.AREA_SET[x.area] + ': ' + x.target) + '</li>' +
          '<li>바뀐 내용: ' + esc(x.change) + '</li>' + items +
          '<li>' + (tpl ? '근거: ' : '사유: ') + esc(x.reason || '-') + '</li>' +
          (x.area === 'PRICE' ? '<li>품의: ' + esc(x.docNo || '-') + (x.docUrl ? ' (' + esc(x.docUrl) + ')' : '') + '</li>' : x.area === 'PRODUCT' ? '<li>품의: 제품과 기능에는 품의 링크 칸이 없어 사유와 사내 품의를 견줍니다</li>'
            // 거래처: 완료 계약 수(2026-11-09 5회차 점검). 합치기는 "완료 계약 n건이 있는 거래처를 합침"(기획자 결정 2026-11-10 22번)
            : cust ? '<li>' + (x.merge ? '완료 계약 ' + (x.doneCount || 0) + '건이 있는 거래처를 합침' : '완료 계약: ' + (x.doneCount || 0) + '건') + '</li>' : '') +
          '<li>바꾼 사람: ' + esc(C.ownerLabel(x.by) + ', ' + C.fmtDateTime(x.at)) + '</li></ul></div>' +
        '<fieldset class="field" data-field="result"><legend class="field-label">결과<span class="req" aria-hidden="true">*</span><span class="sr-only">(필수)</span></legend>' +
          '<div class="choice-row"><label class="choice"><input type="radio" name="result" value="MATCH">' + esc(R.MATCH) + '</label>' +
          '<label class="choice"><input type="radio" name="result" value="DIFF">' + esc(R.DIFF) + '</label></div><p class="field-error" hidden></p></fieldset>' +
        // 의견은 다름을 고를 때만 필수. 처음엔 (선택), 고르면 필수 표시로(아래 open, 2026-11-06 점검 3회차)
        C.fieldHtml({ name: 'note', label: '의견', type: 'textarea', optional: true,
          // 다름을 남기면 컴플라이언스에 넘어가고 이메일이 간다는 안내(기획자 결정 2026-11-09 5회차 13번)
          help: '"' + R.DIFF + '"을 고르면 꼭 적습니다. 무엇이 다른지, 누가 고쳐야 하는지 적습니다. ' + X.ISSUE_HELP }) // 영역의 "다름" 이름을 그대로(거래처는 "다름", 2026-11-09 5회차 점검)
          .replace(' <span class="opt">', '<span class="req" aria-hidden="true" hidden>*</span><span class="sr-only req-sr" hidden>(필수)</span> <span class="opt">'),
      btn: '확인 남기기',
      // 결과를 고를 때마다 의견 칸 이름의 필수 표시를 바꿈. 계약 등록의 사용 업체 칸과 같은 방식(new-contract.js syncOrg, 2026-11-06 점검 3회차)
      open: function (f) {
        const box = f.querySelector('[data-field="note"]');
        const sync = function () {
          const r = f.querySelector('[name="result"]:checked'), need = !!(r && r.value === 'DIFF');
          box.querySelector('.req').hidden = !need;
          box.querySelector('.req-sr').hidden = !need;
          box.querySelector('.opt').hidden = need;
          if (!need) C.setFieldError(box, ''); // 맞음으로 바꾸면 앞의 "적으세요" 오류는 맞지 않으므로 지움
        };
        f.querySelectorAll('[name="result"]').forEach(function (x) { x.addEventListener('change', sync); });
        sync();
      },
      check: function (f) {
        const r = f.querySelector('[name="result"]:checked');
        return { result: r ? '' : '결과를 고르세요.', note: r && r.value === 'DIFF' && !val(f, 'note') ? '다른 점을 적으세요.' : '' };
      },
      done: function (f) {
        const result = f.querySelector('[name="result"]:checked').value;
        const e = X.saveCheck(x, result, val(f, 'note'));
        // "다름"이면 컴플라이언스에 넘김(기획자 결정 2026-11-09 5회차 13번). 개요 점검할 일과 이메일. 대상 글은 설정 변경 묶음의 이름 그대로
        const issue = !e.refused && result === 'DIFF' ? X.raiseIssue({ source: 'CONFIG', title: '설정 변경 확인: ' + X.AREA_SET[x.area] + ' ' + x.target + ' ' + X.resultLabel(x.area, result),
          note: val(f, 'note'), href: 'config-review.html', ref: x.id }) : null;
        render();
        if (!e.refused) C.toast(x.target + ': ' + X.resultLabel(x.area, result) + '으로 남겼습니다.' + X.issueToast(issue));
      },
    });
  }

  $('#filter').addEventListener('change', function () { page = 1; render(); });
  $('#filter').addEventListener('reset', function () { setTimeout(function () { page = 1; render(); }, 0); });
  $('#filter').addEventListener('submit', function (e) { e.preventDefault(); });
  $('#content').addEventListener('click', function (e) {
    const doc = e.target.closest('[data-doc]');
    if (doc) { e.preventDefault(); C.toast('품의 문서(' + doc.getAttribute('data-doc') + ')는 사내 품의 시스템에서 열립니다(시안에서는 안내만).'); return; }
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.getAttribute('data-check')) openCheck(b.getAttribute('data-check'));
    // 쪽 번호: 누른 단추가 다시 그려져 없어지므로 초점도 묶음 제목으로(2026-11-06 점검 3회차)
    else if (b.getAttribute('data-page')) { page = Number(b.getAttribute('data-page')); render(); C.focusSection('#app-title'); }
  });
  render();
})();
