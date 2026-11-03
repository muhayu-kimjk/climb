/* =====================================================================
 * SCR-65 설정 변경 확인 화면 로직 (config-review.js)
 * ---------------------------------------------------------------------
 * 기획자 결정 2026-11-02 C-8(G-12): 설정 변경을 바꾼 사람이 아닌 사람이 다시 봄. 전후 값, 사유, 품의 링크
 *   가격과 제품 줄은 재무 리더가 "품의와 맞음" 또는 "품의와 다름(의견 필수)"
 *   표준계약서 줄은 올린 법무가 아닌 법무가 "근거와 맞음" 또는 "근거와 다름(의견 필수)". 본인이 올린 판은 누를 수 없는 단추와 까닭
 *   기록은 쌓기만 함(관리자 변경 이력의 점검 기록, control-checks.js saveCheck). 한 건에 확인 하나
 *   결재선 규칙과 회사 설정의 변경은 정보보호의 매월 기록 점검(SCR-57 "설정 변경")에서 봄
 *   C-6: 최고관리자는 시연으로 확인할 수 있지만 자기가 바꾼 줄은 못함
 * 볼 수 있는 사람: 재무 리더, 법무(C.checkOwners('SCR-65')), 최고관리자(시연용), 감사 열람(보기만)
 * 확인을 남길 수 있는지: control-checks.js canConfirm(맡은 영역인지, 본인이 바꾼 줄이 아닌지, 읽기만 하는 역할이 아닌지)
 *   읽기만 하는 역할(감사 열람)은 관리 칸을 아예 그리지 않음
 * 한 쪽 20건(다른 목록과 같음, REQ-ADM-04)
 * ===================================================================== */
(function () {
  const C = window.CLIMB;
  const X = window.CLIMB_CTL;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const SCR = 'SCR-65';
  if (!C.gate(me, C.checkOwners(SCR).concat(['AUDIT']), '설정 변경 확인은 재무 리더와 법무가 씁니다',
    '지금은 ' + esc(C.roleLabel(me.role)) + ' 역할로 보고 있습니다. 화면 맨 위 검은 띠에서 재무 리더, 법무 담당자, 감사 열람, 최고관리자 가운데 하나로 바꾸면 볼 수 있습니다.')) return;

  const AREAS = ['PRICE', 'PRODUCT', 'TEMPLATE']; // 이 화면에서 확인하는 영역 (결재선 규칙, 회사 설정은 SCR-57)
  const PAGE_SIZE = 20;
  const readOnly = C.isReadOnly(me);
  const canDo = C.canDoCheck(me, SCR);
  const isFin = C.hasRole(me, ['FIN_LEAD']), isLegal = C.hasRole(me, ['LEGAL']);
  let page = 1;
  function val(f, n) { return (f.elements[n].value || '').trim(); }
  function dt(at) { return C.fmtDateTime(at).split(' ').map(function (s) { return '<span class="keep">' + s + '</span>'; }).join(' '); }

  // 맡은 일에 맞춘 안내 한 줄 (역할은 화면을 여는 동안 바뀌지 않아 자리가 흔들리지 않음)
  $('#app-desc').textContent = (readOnly || !canDo ? '보기만 합니다. 확인은 재무 리더와 법무가 남깁니다.'
    : me.role === 'SUPER' ? '시연으로 모든 줄을 확인할 수 있지만, 본인이 바꾼 줄은 확인하지 못합니다.'
      : isFin ? '가격 기준과 제품과 기능 줄마다 품의와 맞는지 확인을 남깁니다. 같은 때 같은 품의로 넣은 가격 줄은 한 건으로 봅니다.'
        : isLegal ? '표준계약서 판마다 근거와 맞는지 확인을 남깁니다. 본인이 올린 판은 올린 사람이 아닌 법무가 확인합니다.' : '') +
    ' 결재선 규칙과 회사 설정의 변경은 접속 기록 점검의 설정 변경에서 정보보호가 봅니다.';
  if (readOnly) $('#th-action').remove(); // 감사 열람: 관리 칸 없음(C-2)

  function stateOf(x) { const k = X.checkOf(x.id); return k ? k.result : 'WAIT'; }
  function filtered() {
    const area = $('#f-area').value, state = $('#f-state').value;
    return X.settingChanges({ areas: area ? [area] : AREAS }).filter(function (x) { return !state || stateOf(x) === state; });
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
    if (cc.ok) return '<button type="button" class="link-act" data-check="' + esc(x.id) + '">확인 남기기</button>';
    if (cc.mine && cc.why) return '<button type="button" class="link-act" disabled>확인 남기기</button>'; // 본인이 바꾼 줄(까닭은 확인 칸에)
    return '-';
  }
  function render() {
    const all = X.settingChanges({ areas: AREAS });
    const waitAll = all.filter(function (x) { return !X.checkOf(x.id); });
    const waitFin = waitAll.filter(function (x) { return x.area !== 'TEMPLATE'; }).length;
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (page > pages) page = pages;
    const from = (page - 1) * PAGE_SIZE, rows = list.slice(from, from + PAGE_SIZE);
    $('#list-count').innerHTML = C.meta([[(list.length !== all.length ? '거른 결과' : '전체'), '<strong>' + list.length + '건</strong>'],
      ['확인 전', '가격과 제품 ' + waitFin + '건, 표준계약서 ' + (waitAll.length - waitFin) + '건']]);
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
    X.settingChanges({ areas: AREAS }).forEach(function (x) { byId[x.id] = x; });
    const list = X.checkEntries();
    $('#log-rows').innerHTML = list.length ? list.map(function (e) {
      const x = byId[e.op.id];
      return '<tr><td class="num-left">' + dt(e.at) + '</td><td class="center">' + esc(C.ownerLabel(e.by)) + '</td>' +
        '<td><span class="cell-strong">' + esc(x ? x.target : String(e.target).replace(/^설정 변경 확인: /, '')) + '</span><span class="cell-meta">' + esc(X.AREA_SET[e.op.area] || '') + '</span></td>' +
        '<td class="nowrap">' + C.badge(e.op.result === 'MATCH' ? 'success' : 'attention', X.resultLabel(e.op.area, e.op.result)) + '</td>' +
        '<td>' + esc(e.op.note || '-') + '</td></tr>';
    }).join('') : '<tr><td class="empty-row" colspan="5">아직 남긴 확인이 없습니다.</td></tr>';
  }

  function openCheck(id) {
    const x = X.settingChanges({ areas: AREAS }).filter(function (y) { return y.id === id; })[0];
    if (!x || !X.canConfirm(me, x).ok) return;
    const R = X.RESULT[x.area], tpl = x.area === 'TEMPLATE';
    const items = x.items && x.items.length > 1 ? '<li>기능마다: ' + x.items.map(function (it) {
      return esc(it.label + ' ' + (it.before ? it.before + ' → ' : '처음 넣음: ') + it.after);
    }).join(', ') + '</li>' : '';
    C.formModal({
      title: tpl ? '이 판이 근거와 맞나요?' : '이 변경이 품의와 맞나요?',
      desc: '저장하면 확인한 사람과 일시, 결과가 남고 고칠 수 없습니다.',
      body: '<div class="modal-info"><ul class="summary-list">' +
          '<li>' + esc(X.AREA_SET[x.area] + ': ' + x.target) + '</li>' +
          '<li>바뀐 내용: ' + esc(x.change) + '</li>' + items +
          '<li>' + (tpl ? '근거: ' : '사유: ') + esc(x.reason || '-') + '</li>' +
          (x.area === 'PRICE' ? '<li>품의: ' + esc(x.docNo || '-') + (x.docUrl ? ' (' + esc(x.docUrl) + ')' : '') + '</li>' : x.area === 'PRODUCT' ? '<li>품의: 제품과 기능에는 품의 링크 칸이 없어 사유와 사내 품의를 견줍니다</li>' : '') +
          '<li>바꾼 사람: ' + esc(C.ownerLabel(x.by) + ', ' + C.fmtDateTime(x.at)) + '</li></ul></div>' +
        '<fieldset class="field" data-field="result"><legend class="field-label">결과<span class="req" aria-hidden="true">*</span><span class="sr-only">(필수)</span></legend>' +
          '<div class="choice-row"><label class="choice"><input type="radio" name="result" value="MATCH">' + esc(R.MATCH) + '</label>' +
          '<label class="choice"><input type="radio" name="result" value="DIFF">' + esc(R.DIFF) + '</label></div><p class="field-error" hidden></p></fieldset>' +
        C.fieldHtml({ name: 'note', label: '의견', type: 'textarea',
          help: (tpl ? '"근거와 다름"' : '"품의와 다름"') + '을 고르면 꼭 적습니다. 무엇이 다른지, 누가 고쳐야 하는지 적습니다.' }),
      btn: '확인 남기기',
      check: function (f) {
        const r = f.querySelector('[name="result"]:checked');
        return { result: r ? '' : '결과를 고르세요.', note: r && r.value === 'DIFF' && !val(f, 'note') ? '다른 점을 적으세요.' : '' };
      },
      done: function (f) {
        const result = f.querySelector('[name="result"]:checked').value;
        const e = X.saveCheck(x, result, val(f, 'note'));
        render();
        if (!e.refused) C.toast(x.target + ': ' + X.resultLabel(x.area, result) + '으로 남겼습니다.');
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
    else if (b.getAttribute('data-page')) { page = Number(b.getAttribute('data-page')); render(); $('#app-title').scrollIntoView({ block: 'start' }); }
  });
  render();
})();
