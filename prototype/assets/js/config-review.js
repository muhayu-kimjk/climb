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
 *       창 제목 "이 거래처 합치기가 맞나요?", 사유 칸 아래 "완료 계약 n건이 있는 거래처를 합침". 완료 계약이 없는 거래처끼리의 합치기는 그대로 SCR-57에서만(다만 고객사 티어가 다르면 완료 계약과 상관없이 재무 리더가 "품의와 맞음, 다름"으로, 기획자 답 2026-11-12 [제안] ①)
 *     완료 계약은 계약 완료, 만료, 해지 상태(기획자 확인 2026-11-10 23번)
 *   (설계 검토 2026-11-11 답 ①, CTL-140) 고객사 티어 변경과 티어 단가 변경도 재무 리더가 "품의와 맞음" 또는 "품의와 다름(의견 필수)"
 *     거래처의 고객사 티어 변경은 완료 계약과 상관없이 모두(control-checks.js tierInfo). 값 칸에 앞, 뒤 티어와 그날 표준 단가가 바뀌는 기능을 줄마다 보임
 *     거래처 관리에는 품의 링크 칸이 없어 사유와 사내 품의를 견줌 [가정](제품과 기능과 같음). 창 제목 "이 고객사 티어 변경이 품의와 맞나요?"
 *     가격 기준 줄의 값에 티어 단가(기본 단가, 한도, 티어 1, 2 단가)가 함께 보임(control-checks.js priceText)
 *     "다름"이면 컴플라이언스로 넘김, 컴플라이언스는 보기만(지금 규칙 그대로)
 *     (2026-11-14 주말 점검 W7) 값 칸 끝과 확인 창에 바꾼 뒤 이 거래처로 기안한 계약과 출력한 견적의 번호(control-checks.js X.tierSince)
 *       "품의와 다름"이면 그 번호를 컴플라이언스 넘김 글(CTL-78)에 함께 넣음. 확인 전 그 사이에 바뀐 티어 단가로 기안한 것을 손으로 찾지 않게
 *       (2026-11-14 주말 점검, 코드 다시 보기 common-01) 거래처 이름 옆에 번호가 보여 볼 수 없는 열람 제한 계약이 어느 고객사 것인지 드러났음(REQ-AUTH-09, leak-01과 같은 짝)
 *         값 칸과 확인 창은 보는 사람(me)이 볼 수 없는 열람 제한 계약을 번호 없이 "열람 제한 계약 n건"으로만(X.tierSince(x, me))
 *         넘김 글은 제목에 거래처 이름이 있고 컴플라이언스와 접속 기록 점검(SCR-57)의 여러 사람이 읽어 열람 제한 계약은 모두 번호 없이 건수만(X.tierSince(x, 'SHARED'))
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
  const D = window.CLIMB_DATA; // 2026-11-16 W7-6 모집단 내려받기의 달 목록
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
  // 이 화면의 줄: 확인 대상만(2026-11-09 5회차 점검). 거래처는 완료 계약이 있는 거래처의 번호 변경과 합치기, 고객사 티어 변경(설계 검토 2026-11-11 답 ①)만 needsCheck가 참
  // 볼 수 없는 열람 제한 계약의 번호는 거래처 줄 사유에서 뺌(2026-11-14 주말 점검, leak-01)
  function changes(areas) { return C.maskAdminRows(X.settingChanges({ areas: areas }), me).filter(X.needsCheck); }
  /* 모집단 내려받기(기획자 결정 2026-11-16, W7-6 (가)): 재무 리더(시연용 최고관리자)만. 고른 달의 가격 기준(PRICE)과 거래처(CUSTOMER, 티어 목록 변경 포함) 줄 모두
   *   (확인 대상이 아닌 거래처 줄도 넣어 목록이 빠짐없는지 봄). 볼 수 없는 열람 제한 계약은 가림(C.maskAdminRows). 칸: 일시, 영역, 대상, 바뀐 내용, 사유, 바꾼 사람, 확인 대상, 확인 결과
   *   달 고르기: 운영을 시작한 달부터 이달까지(새것부터) */
  const canPop = !C.isReadOnly(me) && (me.role === 'SUPER' || C.hasRole(me, ['FIN_LEAD']));
  if (canPop) {
    const months = [];
    for (let ym = D.SERVICE_START_MONTH; ym <= D.TODAY.slice(0, 7); ym = C.monthsLater(ym + '-01', 1).slice(0, 7)) months.unshift(ym);
    $('#pop-month').innerHTML = months.map(function (ym) { return '<option value="' + ym + '">' + ym.slice(0, 4) + '년 ' + Number(ym.slice(5, 7)) + '월</option>'; }).join('');
    $('#pop-row').hidden = false;
    $('#btn-pop').addEventListener('click', function () {
      const ym = $('#pop-month').value;
      const list = C.maskAdminRows(X.settingChanges({ month: ym, areas: ['PRICE', 'CUSTOMER'] }), me);
      const rows = list.map(function (x) {
        const ck = X.needsCheck(x) ? X.checkOf(x.id) : null;
        return [String(x.at).slice(0, 16), (X.AREA_SET[x.area] || x.area) + (x.tier ? '(고객사 티어)' : ''), x.target, x.change, x.reason, C.ownerLabel(x.by),
          X.needsCheck(x) ? '예' : '아니요', ck ? ck.label + ' ' + C.ownerLabel(ck.by) + ' ' + String(ck.at).slice(0, 16) : (X.needsCheck(x) ? '확인 전' : '-')];
      });
      X.popDownload({ kind: 'POP_CONFIG', title: '가격과거래처변경_' + ym, cond: ym + ' 관리자 변경 이력의 가격 기준, 거래처(고객사 티어 포함) 변경 모두', user: me,
        head: ['일시', '영역', '대상', '바뀐 내용', '사유', '바꾼 사람', '확인 대상', '확인 결과'], rows: rows }).then(function (r) {
        C.toast(ym + ' 가격과 거래처 변경 ' + rows.length + '건을 내려받았습니다. 꺼낸 기록 ' + r.id + '에 남았습니다.');
      });
    });
  }
  let page = 1;
  function val(f, n) { return (f.elements[n].value || '').trim(); }
  function dt(at) { return C.fmtDateTime(at).split(' ').map(function (s) { return '<span class="keep">' + s + '</span>'; }).join(' '); }

  // 맡은 일에 맞춘 안내 한 줄 (역할은 화면을 여는 동안 바뀌지 않아 자리가 흔들리지 않음)
  $('#app-desc').textContent = (readOnly || !canDo ? '보기만 합니다. 확인은 재무 리더와 법무가 남깁니다.'
    : me.role === 'SUPER' ? '시연으로 모든 줄을 확인할 수 있지만, 본인이 바꾼 줄은 확인하지 못합니다.'
      // 거래처 번호 변경도 재무 리더가 봄(2026-11-09 5회차 점검, G-25 ②)
      // 완료 계약이 있는 거래처의 합치기도 더함(기획자 결정 2026-11-10 22번)
      // 고객사 티어 변경과 가격 기준의 티어 단가도 더함(설계 검토 2026-11-11 답 ①)
      // 티어가 다른 거래처 합치기도 더함(기획자 답 2026-11-12 [제안] ①)
      : isFin ? '가격 기준(티어 단가 포함)과 제품과 기능 줄마다 품의와 맞는지 확인을 남깁니다. 같은 때 같은 품의로 넣은 가격 줄은 한 건으로 봅니다. 거래처의 고객사 티어 변경과 티어가 다른 거래처 합치기도 품의와 맞는지, 완료 계약이 있는 거래처의 사업자등록번호 변경과 합치기는 맞는지 확인합니다.'
        : isLegal ? '표준계약서 판마다 근거와 맞는지 확인을 남깁니다. 본인이 올린 판은 올린 사람이 아닌 법무가 확인합니다.' : '') +
    // 그 밖의 거래처 변경: 티어를 정하지 않은 추가, 완료 계약이 없는 거래처의 번호 변경과 합치기, 상호와 상태 고치기(기획자 결정 2026-11-10 22번, 설계 검토 2026-11-11 답 ①. 합치기는 2026-11-12 [제안] ①부터 티어가 같은 것만)
    ' 결재선 규칙과 회사 설정의 변경, 거래처의 그 밖의 변경(고객사 티어를 정하지 않은 추가, 완료 계약이 없는 거래처의 번호 변경, 완료 계약이 없고 고객사 티어가 같은 거래처끼리의 합치기, 상호와 상태 고치기)은 접속 기록 점검의 설정 변경에서 정보보호가 봅니다.';
  if (readOnly) $('#th-action').remove(); // 감사 열람과 컴플라이언스: 관리 칸 없음(C-2, 기획자 결정 2026-11-10 16번)

  function stateOf(x) { const k = X.checkOf(x.id); return k ? k.result : 'WAIT'; }
  function filtered() {
    const area = $('#f-area').value, state = $('#f-state').value;
    return changes(area && AREAS.indexOf(area) > -1 ? [area] : AREAS).filter(function (x) { return !state || stateOf(x) === state; });
  }
  // (설계 검토 2026-11-11 답 ①) 고객사 티어 변경: 바꾼 날 가격 기준으로 표준 단가가 바뀌는 기능을 접지 않고 줄마다 보임(한 기능이어도). 없으면 까닭 한 줄
  //   (2026-11-14 주말 점검 W7) 끝에 바꾼 뒤 이 거래처로 기안한 계약과 출력한 견적의 번호(X.tierSince, 10개까지 적고 "외 n건"). 거래처 번호를 모르는 줄(여러 곳에 처음 넣은 줄)은 없음
  //   (2026-11-14 주말 점검, 코드 다시 보기 common-01) 볼 수 없는 열람 제한 계약은 번호 없이 건수만(me)
  function tierItemsHtml(x) {
    const s = X.tierSince(x, me);
    const since = s ? '<span class="cell-meta">' + esc(X.tierSinceText(s, 10)) + '</span>' : '';
    if (!x.items || !x.items.length) return '<span class="cell-meta">' + esc(x.tierNote || '') + '</span>' + since;
    return x.items.map(function (it) {
      return '<span class="cell-meta">' + esc(it.label + ': ' + (it.before ? it.before + ' → ' : '') + it.after) + '</span>';
    }).join('') + since;
  }
  // 가격 기준을 여러 기능에 함께 넣은 건은 기능마다 전후 값을 접어 둠
  function itemsHtml(x) {
    if (x.area === 'CUSTOMER' && x.tier) return tierItemsHtml(x); // 설계 검토 2026-11-11 답 ①
    if (!x.items || x.items.length < 2) return '';
    return '<details class="seen-data"><summary>기능마다 보기</summary><ul class="summary-list cell-meta">' + x.items.map(function (it) {
      return '<li>' + esc(it.label) + ': ' + esc((it.before ? it.before + ' → ' : '처음 넣음: ') + it.after) + ' (' + C.fmtDate(it.from) + '부터)</li>';
    }).join('') + '</ul></details>';
  }
  function basisHtml(x) {
    if (x.area === 'PRICE') return '<span class="cell-meta">품의 ' + (X.docLink(x) || '링크 없음') + '</span>';
    if (x.area === 'PRODUCT') return '<span class="cell-meta">품의 링크 칸 없음(사유를 봄)</span>';
    // (설계 검토 2026-11-11 답 ①) 고객사 티어 변경: 품의 링크 칸이 없어 사유를 봄 [가정]. 같은 고치기에 번호 변경도 있으면 완료 계약 수를 함께
    //   (기획자 답 2026-11-12 [제안] ①) 티어가 다른 거래처 합치기는 "고객사 티어가 다른 거래처를 합침"이고, 완료 계약이 있으면 그 수도 함께
    if (x.area === 'CUSTOMER' && x.tier) return '<span class="cell-meta">' + (x.merge ? '고객사 티어가 다른 거래처를 합침' : x.tierCode ? '고객사 티어 목록 변경(코드 관리)' : '고객사 티어 변경') + ', 품의 링크 칸 없음(사유를 봄)</span>' +
      ((x.bizNo || x.merge) && x.doneCount ? '<span class="cell-meta">완료 계약 ' + x.doneCount + '건이 있는 거래처' + (x.merge ? '를 합침' : '') + '</span>' : ''); // (L3 검토) 0건이면 "완료 계약 0건이 있는 거래처"가 되어 뺌(창에는 "완료 계약: 0건"으로 보임)
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
    // 2026-11-13 주말 점검: 개요 "점검할 일"의 설정 변경 확인 건수와 같은 셈(X.canConfirm ok). 확인을 남기는 사람에게만(보기만 하는 역할은 없음)
    //   "확인 전"은 본인이 올린 판처럼 남이 확인할 줄까지 세어 개요 숫자와 달랐음(dashboard.js configItems)
    const mineN = canDo && !readOnly ? all.filter(function (x) { return X.canConfirm(me, x).ok; }).length : -1;
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (page > pages) page = pages;
    const from = (page - 1) * PAGE_SIZE, rows = list.slice(from, from + PAGE_SIZE);
    $('#list-count').innerHTML = C.meta([[(list.length !== all.length ? '거른 결과' : '전체'), '<strong>' + list.length + '건</strong>'],
      // 법무만인 사람에게는 표준계약서 건수만(legalOnly, 2026-11-06 점검)
      // 재무 리더 몫에 거래처가 들어가 이름을 "가격, 제품, 거래처"로(2026-11-09 5회차 점검)
      ['확인 전', (legalOnly ? '' : '가격, 제품, 거래처 ' + waitFin + '건, ') + '표준계약서 ' + (waitAll.length - waitFin) + '건']]
      .concat(mineN < 0 ? [] : [['내가 확인할 것', '<strong>' + mineN + '건</strong>']]));
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
        '<td class="nowrap">' + C.badge(e.op.result === 'MATCH' ? 'success' : 'attention', X.resultLabel(e.op.rk || e.op.area, e.op.result)) + '</td>' + // rk: 설계 검토 2026-11-11 답 ①
        '<td>' + esc(e.op.note || '-') + '</td></tr>';
    }).join('') : '<tr><td class="empty-row" colspan="5">아직 남긴 확인이 없습니다.</td></tr>';
  }

  function openCheck(id) {
    const x = changes(AREAS).filter(function (y) { return y.id === id; })[0];
    if (!x || !X.canConfirm(me, x).ok) return;
    // (설계 검토 2026-11-11 답 ①) tier: 고객사 티어 변경. 결과 이름은 "품의와 맞음, 다름"(X.resultKey가 TIER)
    const rk = X.resultKey(x), R = X.RESULT[rk], tpl = x.area === 'TEMPLATE', cust = x.area === 'CUSTOMER', tier = cust && !!x.tier; // cust: 거래처 번호 변경(2026-11-09 5회차 점검)
    const since = tier ? X.tierSince(x, me) : null; // 2026-11-14 주말 점검 W7: 창을 연 때의 바꾼 뒤 계약과 견적. 볼 수 없는 열람 제한 계약은 건수만(2026-11-14 주말 점검, 코드 다시 보기 common-01)
    const items = tier ? '<li>표준 단가: ' + (x.items.length ? x.items.map(function (it) {
      return esc(it.label + ' ' + (it.before ? it.before + ' → ' : '') + it.after);
    }).join(', ') : esc(x.tierNote || '')) + ' (' + C.fmtDate(String(x.at).slice(0, 10)) + ' 가격 기준)</li>' +
      // (2026-11-14 주말 점검 W7) 바꾼 뒤 기안한 계약과 출력한 견적(모두 적음). "품의와 다름"이면 이 번호가 컴플라이언스 넘김 글에 함께 들어감
      (since ? '<li>' + esc(X.tierSinceText(since)) + '</li>' : '')
      : x.items && x.items.length > 1 ? '<li>기능마다: ' + x.items.map(function (it) {
        return esc(it.label + ' ' + (it.before ? it.before + ' → ' : '처음 넣음: ') + it.after);
      }).join(', ') + '</li>' : '';
    C.formModal({
      // 거래처는 품의가 없어 "이 번호 변경이 맞나요?"(2026-11-09 5회차 점검). 합치기는 "이 거래처 합치기가 맞나요?"(기획자 결정 2026-11-10 22번)
      //   고객사 티어 변경은 "이 고객사 티어 변경이 품의와 맞나요?"(설계 검토 2026-11-11 답 ①)
      //   티어가 다른 거래처 합치기는 "이 합치기의 고객사 티어 변경이 품의와 맞나요?"(기획자 답 2026-11-12 [제안] ①)
      title: tpl ? '이 판이 근거와 맞나요?' : tier ? (x.merge ? '이 합치기의 고객사 티어 변경이 품의와 맞나요?' : x.tierCode ? '이 고객사 티어 목록 변경이 품의와 맞나요?' : '이 고객사 티어 변경이 품의와 맞나요?') : cust ? (x.merge ? '이 거래처 합치기가 맞나요?' : '이 번호 변경이 맞나요?') : '이 변경이 품의와 맞나요?',
      desc: '저장하면 확인한 사람과 일시, 결과가 남고 고칠 수 없습니다.',
      body: '<div class="modal-info"><ul class="summary-list">' +
          '<li>' + esc(X.AREA_SET[x.area] + ': ' + x.target) + '</li>' +
          '<li>바뀐 내용: ' + esc(x.change) + '</li>' + items +
          '<li>' + (tpl ? '근거: ' : '사유: ') + esc(x.reason || '-') + '</li>' +
          (x.area === 'PRICE' ? '<li>품의: ' + esc(x.docNo || '-') + (x.docUrl ? ' (' + esc(x.docUrl) + ')' : '') + '</li>' : x.area === 'PRODUCT' ? '<li>품의: 제품과 기능에는 품의 링크 칸이 없어 사유와 사내 품의를 견줍니다</li>'
            // (설계 검토 2026-11-11 답 ①) 고객사 티어 변경: 품의 링크 칸이 없어 사유와 사내 품의를 견줌 [가정]. 번호 변경도 함께면 완료 계약 수
            //   티어가 다른 거래처 합치기(2026-11-12 [제안] ①)는 합친 거래처의 완료 계약 수도
            : tier ? '<li>품의: 거래처 관리에는 품의 링크 칸이 없어 사유와 사내 품의를 견줍니다</li>' + (x.bizNo || x.merge ? '<li>완료 계약: ' + (x.doneCount || 0) + '건</li>' : '')
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
        //   (설계 검토 2026-11-11 답 ①) 고객사 티어 변경은 대상 글에 "(고객사 티어)"와 "품의와 다름"
        //   (2026-11-14 주말 점검 W7, CTL-78) 고객사 티어 변경의 "품의와 다름"은 넘김 글 끝에 바꾼 뒤 기안한 계약과 출력한 견적의 번호를 모두 붙임(저장하는 때 다시 셈)
        //   (2026-11-14 주말 점검, 코드 다시 보기 common-01) 넘김 글은 여러 사람이 읽어 열람 제한 계약은 모두 번호 없이 건수만('SHARED')
        const now = tier ? X.tierSince(x, 'SHARED') : null;
        const issue = !e.refused && result === 'DIFF' ? X.raiseIssue({ source: 'CONFIG', title: '설정 변경 확인: ' + X.AREA_SET[x.area] + (tier ? '(고객사 티어)' : '') + ' ' + x.target + ' ' + X.resultLabel(rk, result),
          note: (now ? val(f, 'note').replace(/\.\s*$/, '') + '. ' + X.tierSinceText(now) : val(f, 'note')), href: 'config-review.html', ref: x.id }) : null;
        render();
        if (!e.refused) C.toast(x.target + ': ' + X.resultLabel(rk, result) + '으로 남겼습니다.' + X.issueToast(issue));
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
