/* =====================================================================
 * SCR-62 영업기회 대사 화면 로직 (opp-recon.js)
 * ---------------------------------------------------------------------
 * 기획자 결정 2026-11-02 E-1 ②(G-02, CTL-03): 영업지원이 매월 판다 수주 목록 파일을 올려 계약과 맞춰 봄
 *   계약이 없는 수주, 수주 목록에 없는 계약, 줄마다 의견, 그 달 확인. 운영 시작 뒤 수주만, 고객 담당자 이름과 연락처는 뺌. 기록은 쌓기만 함
 * 볼 수 있는 사람: 영업지원 담당자와 리더(C.checkOwners('SCR-62')), 최고관리자(시연용), 감사 열람(보기만), 컴플라이언스(보기만)
 *   기획자 결정 2026-11-10 16번: 컴플라이언스도 감사 열람처럼 보기만 함. 넘어온 일(예외 줄이 있는 대사 확인)의 원래 기록을 바로 봄
 * 남길 수 있는지: C.canDoCheck(me, 'SCR-62')이면서 컴플라이언스가 아님. 읽기만 하는 역할(감사 열람)과 컴플라이언스는 false라 올리기, 의견, 확인 단추가 없음
 *   보기만 하는 사람에게는 월별 대사 안내 끝에 "보기만 합니다" 한 줄을 덧붙임(기획자 결정 2026-11-10 16번, 할인 예외 점검과 같은 모양)
 * 하는 일
 *   1. 월별 대사: 운영을 시작한 달(D.SERVICE_START_MONTH)부터 이달까지 한 줄씩. 기한은 다음 달 말일 [가정, 접속 기록 점검과 같게]
 *   2. 고른 달의 대사
 *      파일 올리기: 끝난 달만. CSV를 읽어 머리글로 칸을 찾음(영업기회번호, 수주일은 꼭 있어야 함)
 *        고객 담당자, 연락처, 전화, 이메일 칸은 읽을 때 빼고 저장하지 않음(REQ-SEC-09). 뺀 칸의 이름만 남김
 *        운영 시작 전 수주와 다른 달 수주는 빼고 그 줄 수만 남김. 같은 달에 다시 올리면 마지막 파일로 맞춰 봄(앞 파일 기록은 남음)
 *        "예시 파일로 해 보기"는 D.OPP_SAMPLE(담당자와 연락처 칸이 든 9월 목록)을 같은 길로 읽음
 *      맞춰 보기: 영업기회번호로. 계약은 기안한 계약 중 계약 등록에서 기안하는 신규, 변경, 바꿔서 연장(각자 번호. 반려된 계약도 계약으로 셈)
 *        계약이 없는 수주: 그 달 파일의 수주 중 그 번호를 쓴 계약이 없는 것
 *        수주 목록에 없는 계약: 그 달에 처음 기안한 계약 중 올린 어느 달 파일에도 그 번호가 없는 것(그 달 파일을 올린 뒤에만 봄)
 *      의견: 예외 줄마다. 바꾸려면 한 번 더 남김(마지막 의견이 보임). 확인: 예외 줄에 모두 의견이 있어야 함
 *        확인 때 본 숫자와 열쇠(파일 번호, 예외 줄)를 남겨, 뒤에 새 파일이나 새 계약으로 바뀌면 "확인한 뒤 바뀜"
 *   3. 대사 기록: 파일 올림, 의견, 확인을 새것부터 20줄씩
 *   기획자 결정 2026-11-09 5회차 13번: 예외 줄이 있는 대사를 확인하면 컴플라이언스에 넘김(X.raiseIssue). 그달 확인 한 번에 한 건, 확인 기록에 issueId
 * 프로토타입: 기록은 예시(D.OPP_RECON)와 이 브라우저의 시연 기록(C.loadDemo('oppRecon')). 실제 시스템은 서버가 같은 규칙으로 읽고 저장하며
 *   엑셀 파일(xlsx)도 받음. 볼 수 없는 열람 제한 계약은 계약번호만 보이고 고객사와 금액을 가림
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s, root) { return (root || document).querySelector(s); };
  const SCR = 'SCR-62';
  // 문: 맡은 사람, 감사 열람, 컴플라이언스(보기만, 기획자 결정 2026-11-10 16번)
  if (!C.gate(me, C.checkOwners(SCR).concat(['AUDIT', 'COMPLIANCE']), '영업기회 대사는 영업지원이 씁니다',
    '지금은 ' + esc(C.roleLabel(me.role)) + ' 역할로 보고 있습니다. 화면 맨 위 검은 띠에서 영업지원, 감사 열람, 컴플라이언스, 최고관리자 가운데 하나로 바꾸면 볼 수 있습니다.')) return;

  // 감사 열람과 컴플라이언스는 보기만(기획자 결정 2026-11-10 16번)
  const canDo = C.canDoCheck(me, SCR) && !(me.role !== 'SUPER' && C.hasRole(me, ['COMPLIANCE']));
  // 보기만 하는 사람: 안내 한 줄을 덧붙임. 화면을 처음 그리기 전에 한 번이라 흔들리지 않음(기획자 결정 2026-11-10 16번)
  if (!canDo && $('#months-desc')) $('#months-desc').textContent += ' 보기만 합니다. 파일 올리기와 의견, 대사 확인은 영업지원이 남깁니다.';
  const START = D.SERVICE_START_MONTH, THIS_MONTH = D.TODAY.slice(0, 7), PAGE_SIZE = 20;
  const FILE_MAX = 2 * 1048576; // CSV 2MB 이하 [가정]
  function pad(n) { return String(n).padStart(2, '0'); }
  function lastDay(y, m) { return y + '-' + pad(m) + '-' + pad(new Date(y, m, 0).getDate()); } // m: 1~12
  function monthLabel(ym) { return ym.slice(0, 4) + '년 ' + Number(ym.slice(5, 7)) + '월'; }
  function stamp() { return C.nowStamp().slice(0, 16); }
  function val(f, n) { return (f.elements[n].value || '').trim(); }
  // 대상 월: 운영을 시작한 달부터 이달까지(새것부터). due: 다음 달 말일, ended: 끝난 달
  function months() {
    const out = [];
    let y = Number(START.slice(0, 4)), m = Number(START.slice(5, 7));
    for (;;) {
      const ym = y + '-' + pad(m);
      if (ym > THIS_MONTH) break;
      out.push({ ym: ym, due: lastDay(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1), ended: ym < THIS_MONTH });
      m++; if (m > 12) { m = 1; y++; }
    }
    return out.reverse();
  }

  /* 컴플라이언스에 넘기기(기획자 결정 2026-11-09 5회차 13번): 예외 줄(계약이 없는 수주, 수주 목록에 없는 계약)이 있는 대사를 확인하면
   *   control-checks.js X.raiseIssue로 컴플라이언스 담당자의 점검할 일에 올리고 이메일을 보냄. 줄마다가 아니라 그달 확인 한 번에 한 건
   *   opp-recon.html이 아직 control-checks.js를 부르지 않아, 필요할 때 한 번 불러 씀(HTML에 script 줄을 더하면 바로 window.CLIMB_CTL을 씀) */
  function withCtl(then) {
    if (window.CLIMB_CTL) { then(window.CLIMB_CTL); return; }
    const s = document.createElement('script');
    s.src = 'assets/js/control-checks.js';
    s.onload = function () { then(window.CLIMB_CTL || null); };
    s.onerror = function () { then(null); };
    document.head.appendChild(s);
  }
  if (canDo) withCtl(function () {}); // 남길 수 있는 사람에게는 미리 불러 둠

  /* ---------- 기록 (쌓기만 함) ---------- */
  function records() { return (D.OPP_RECON || []).concat(C.loadDemo('oppRecon')).slice().sort(function (a, b) { return a.at.localeCompare(b.at); }); }
  function save(rec) { C.pushDemo('oppRecon', rec); }
  function uploadOf(ym) { return records().filter(function (r) { return r.type === 'UPLOAD' && r.month === ym; }).pop() || null; }
  function confirmsOf(ym) { return records().filter(function (r) { return r.type === 'CONFIRM' && r.month === ym; }); }
  function noteOf(ym, key) { return records().filter(function (r) { return r.type === 'NOTE' && r.month === ym && r.key === key; }).pop() || null; }
  function newUploadId() { return 'OU-' + pad4(records().filter(function (r) { return r.type === 'UPLOAD'; }).length + 1); }
  function pad4(n) { return String(n).padStart(4, '0'); }

  /* ---------- 맞춰 보기 ---------- */
  // 영업기회번호가 있는 계약: 기안한(번호를 받은) 신규, 변경, 바꿔서 연장. 그대로 연장, 해지, 운영 변경은 영업기회번호를 넣지 않음
  function withOpp(c) { return !!c.id && c.status !== 'DRAFT' && (c.kind === 'NEW' || c.kind === 'AMEND' || (c.kind === 'RENEW' && c.renewMode !== 'AUTO')); }
  // 처음 기안한 때: 보완 후 재기안한 계약은 1차 기안(결재 기록의 기안 줄)
  function firstAt(c) {
    return (c.history || []).filter(function (h) { return h.step === 'S01' && h.action === 'SUBMIT'; }).map(function (h) { return h.at; })
      .concat([c.requestedAt || '']).filter(Boolean).sort()[0] || '';
  }
  function compare(ym) {
    const up = uploadOf(ym);
    if (!up) return null;
    const listed = {};
    months().forEach(function (x) { const u = uploadOf(x.ym); (u ? u.rows : []).forEach(function (r) { listed[r.opp] = true; }); });
    const contracts = D.CONTRACTS.filter(withOpp);
    const noContract = up.rows.filter(function (r) { return !contracts.some(function (c) { return C.oppOf(c) === r.opp; }); });
    const notInList = contracts.filter(function (c) { return firstAt(c).slice(0, 7) === ym && !listed[C.oppOf(c)]; })
      .sort(function (a, b) { return firstAt(a).localeCompare(firstAt(b)); });
    const keys = ['U:' + up.id].concat(noContract.map(function (r) { return 'O:' + r.opp; }), notInList.map(function (c) { return 'C:' + c.id; })).join('|');
    const missing = noContract.filter(function (r) { return !noteOf(ym, 'ORDER:' + r.opp); }).length +
      notInList.filter(function (c) { return !noteOf(ym, 'CONTRACT:' + c.id); }).length;
    return { up: up, orders: up.rows.length, matched: up.rows.length - noContract.length, noContract: noContract, notInList: notInList, keys: keys, missing: missing };
  }
  function seenText(r) {
    return '수주 ' + r.orders + '줄, 계약과 맞음 ' + r.matched + '줄, 계약이 없는 수주 ' + r.noContract.length + '건, 수주 목록에 없는 계약 ' + r.notInList.length + '건 (' + r.up.fileName + ')';
  }

  /* ---------- 1. 월별 대사 ---------- */
  let sel = '';
  function defaultMonth() {
    const q = new URLSearchParams(location.search).get('month');
    const list = months();
    if (q && list.some(function (x) { return x.ym === q; })) return q;
    const open = list.filter(function (x) { return x.ended && !confirmsOf(x.ym).length; })[0];
    const ended = list.filter(function (x) { return x.ended; })[0];
    return (open || ended || list[0]).ym;
  }
  function renderMonths() {
    $('#month-rows').innerHTML = months().map(function (x) {
      const r = compare(x.ym), up = r && r.up, last = confirmsOf(x.ym).pop() || null;
      const late = !last && x.ended && D.TODAY > x.due;
      const changed = !!(last && r && last.seen && last.seen.keys !== r.keys);
      return '<tr' + (late ? ' class="is-alert"' : '') + '><td class="nowrap cell-strong">' + monthLabel(x.ym) + '</td>' +
        '<td class="num-left nowrap">' + C.fmtDate(x.due) + (late ? '<span class="cell-meta">기한 지남</span>' : '') + '</td>' +
        '<td>' + (up ? esc(up.fileName) + '<span class="cell-meta">수주 ' + up.rows.length + '줄, ' + esc(C.ownerLabel(up.by, up.dept)) + ' ' + esc(C.fmtDateTime(up.at)) + '</span>'
          : '<span class="recon-none">' + (x.ended ? '아직 올리지 않음' : '이달이 끝난 뒤 올림') + '</span>') + '</td>' +
        '<td>' + (r ? '계약이 없는 수주 ' + r.noContract.length + '건, 목록에 없는 계약 ' + r.notInList.length + '건' +
          (r.missing ? '<span class="cell-meta">의견을 기다리는 줄 ' + r.missing + '줄</span>' : '') : '-') + '</td>' +
        '<td class="nowrap">' + (last ? C.badge('success', '확인함') + '<span class="cell-meta">' + esc(C.ownerLabel(last.by, last.dept)) + ' ' + esc(C.fmtDateTime(last.at)) + '</span>' +
          (changed ? '<span class="cell-meta">' + C.badge('attention', '확인한 뒤 바뀜') + '</span>' : '') : C.badge('line', x.ended ? '확인 전' : '예정')) + '</td>' +
        '<td class="col-action"><button type="button" class="link-act" data-month="' + x.ym + '"' + (x.ym === sel ? ' aria-current="true"' : '') + '>보기<span class="sr-only"> ' + monthLabel(x.ym) + '</span></button></td></tr>';
    }).join('');
  }

  /* ---------- 2. 고른 달의 대사 ---------- */
  function fileLine(up) {
    const s = up.skipped || {};
    return '<strong>' + esc(up.fileName) + '</strong>: 수주 ' + up.rows.length + '줄을 맞춰 봄' +
      (s.before ? ', 운영 시작 전 수주 ' + s.before + '줄은 뺌' : '') + (s.other ? ', 다른 달 수주 ' + s.other + '줄은 뺌' : '') + (s.bad ? ', 읽지 못한 줄 ' + s.bad + '줄' : '') +
      '. ' + ((up.dropped || []).length ? '뺀 칸(저장하지 않음): ' + esc(up.dropped.join(', ')) : '뺀 칸 없음') +
      '<span class="cell-meta">' + esc(C.ownerLabel(up.by, up.dept)) + ', ' + esc(C.fmtDateTime(up.at)) + ' 올림</span>';
  }
  function uploadHtml(ym) {
    return '<div class="recon-upload"><div class="file-drop" data-drop="csv">' +
      '<p>판다에서 내려받은 ' + monthLabel(ym) + ' 수주 목록 파일을 고릅니다.<span class="file-limits">CSV(쉼표로 나눈 파일), 2MB 이하. 엑셀에서는 "CSV UTF-8"로 저장합니다. 다시 올리면 마지막 파일로 맞춰 봅니다.</span></p>' +
      '<div class="recon-upload-btns"><label class="btn btn--tertiary" for="f-csv">파일 선택</label><input type="file" id="f-csv" accept=".csv,text/csv" aria-label="' + monthLabel(ym) + ' 수주 목록 파일">' +
      '<button type="button" class="btn btn--tertiary" id="btn-sample">예시 파일로 해 보기</button></div></div></div>';
  }
  function sumHtml(r) {
    const cell = function (label, n, alert) { return '<div' + (alert && n ? ' class="is-alert"' : '') + '><dt>' + label + '</dt><dd>' + n + '</dd></div>'; };
    return '<dl class="recon-sum">' + cell('수주 목록', r.orders + '줄') + cell('계약과 맞음', r.matched + '줄') +
      cell('계약이 없는 수주', r.noContract.length + '건', true) + cell('목록에 없는 계약', r.notInList.length + '건', true) + '</dl>';
  }
  function noteCell(n) {
    return n ? '<span class="recon-note">' + esc(n.text) + '</span><span class="cell-meta">' + esc(C.ownerLabel(n.by, n.dept)) + ' ' + esc(C.fmtDateTime(n.at)) + '</span>'
      : '<span class="recon-none">의견 없음</span>';
  }
  // row: 줄 이름(영업기회번호나 계약번호). 줄마다 같은 단추 글이라 화면낭독기가 어느 줄인지 알게 뒤에 붙임(2026-11-06 점검)
  function noteBtn(key, n, ended, row) {
    return canDo && ended ? '<button type="button" class="link-act" data-note="' + esc(key) + '">' + (n ? '의견 더하기' : '의견 남기기') +
      '<span class="sr-only"> ' + esc(row) + '</span></button>' : '-';
  }
  function ordersTable(ym, list, ended) {
    return '<div class="tbl-scroll" tabindex="0" role="region" aria-label="계약이 없는 수주 표"><table class="tbl tbl--compact">' +
      '<caption class="sr-only">계약이 없는 수주: 수주일, 영업기회번호, 고객사, 수주 금액, 의견, 관리</caption>' +
      '<thead><tr><th scope="col">수주일</th><th scope="col">영업기회번호</th><th scope="col" class="col-phone-wide">고객사</th><th scope="col" class="num">수주 금액</th><th scope="col">의견</th><th scope="col" class="col-action">관리</th></tr></thead><tbody>' +
      (list.length ? list.map(function (r) {
        const key = 'ORDER:' + r.opp, n = noteOf(ym, key);
        return '<tr' + (n ? '' : ' class="is-alert"') + '><td class="num-left nowrap">' + C.fmtDate(r.wonAt) + '</td><td class="nowrap">' + C.pandaLink(r.opp) + '</td>' +
          '<td><span class="cell-strong">' + esc(r.customer || '-') + '</span>' + (r.bizNo ? '<span class="cell-meta">' + esc(r.bizNo) + '</span>' : '') +
            (r.sales ? '<span class="cell-meta">담당 영업 ' + esc(r.sales) + '</span>' : '') + '</td>' +
          '<td class="num">' + C.fmtWon(r.amount) + '</td><td>' + noteCell(n) + '</td><td class="col-action">' + noteBtn(key, n, ended, '영업기회 ' + r.opp) + '</td></tr>';
      }).join('') : '<tr><td class="empty-row" colspan="6">계약이 없는 수주가 없습니다.</td></tr>') + '</tbody></table></div>';
  }
  function contractsTable(ym, list, ended) {
    return '<div class="tbl-scroll" tabindex="0" role="region" aria-label="수주 목록에 없는 계약 표"><table class="tbl tbl--compact">' +
      '<caption class="sr-only">수주 목록에 없는 계약: 기안일, 계약번호, 고객사, 영업기회번호, 계약 금액, 의견, 관리</caption>' +
      '<thead><tr><th scope="col">기안일</th><th scope="col">계약번호</th><th scope="col" class="col-phone-wide">고객사</th><th scope="col">영업기회번호</th><th scope="col" class="num">계약 금액</th><th scope="col">의견</th><th scope="col" class="col-action">관리</th></tr></thead><tbody>' +
      (list.length ? list.map(function (c) {
        const key = 'CONTRACT:' + c.id, n = noteOf(ym, key), see = C.canView(c, me), no = C.oppOf(c);
        return '<tr' + (n ? '' : ' class="is-alert"') + '><td class="num-left nowrap">' + C.fmtDate(firstAt(c).slice(0, 10)) + '</td>' +
          '<td class="nowrap">' + (see ? '<a class="doc-link" href="review.html?id=' + encodeURIComponent(c.id) + '">' + esc(c.id) + '</a>' : esc(c.id)) +
            '<span class="cell-meta">' + esc(C.kindLabel(c)) + ', ' + esc((D.STATUS[c.status] || {}).label || c.status) + '</span></td>' +
          // 볼 수 없는 열람 제한 계약은 고객사와 금액을 가림(REQ-AUTH-09)
          //   영업대표는 지금 영업대표(C-44). 처음 기안한 사람을 보이던 것을 고침(2026-11-06 점검). 바뀌었으면 작은 줄에 처음 기안한 사람(진행 현황과 같음)
          '<td>' + (see ? '<span class="cell-strong">' + esc(c.counterparty) + '</span><span class="cell-meta">영업대표 ' + esc(C.ownerLabel(C.salesRepOf(c))) + '</span>' +
            (C.salesRepOf(c) !== c.requesterId ? '<span class="cell-meta">처음 기안 ' + esc(C.ownerLabel(c.requesterId)) + '</span>' : '') : '<span class="recon-none">열람 제한 계약</span>') + '</td>' +
          '<td class="nowrap">' + (no ? C.pandaLink(no) : '<span class="recon-none">없음</span>') + '</td>' +
          '<td class="num">' + (see ? C.fmtWon(c.amount) : '-') + '</td><td>' + noteCell(n) + '</td><td class="col-action">' + noteBtn(key, n, ended, '계약 ' + c.id) + '</td></tr>';
      }).join('') : '<tr><td class="empty-row" colspan="7">수주 목록에 없는 계약이 없습니다.</td></tr>') + '</tbody></table></div>';
  }
  function confirmHtml(x, r) {
    const list = confirmsOf(x.ym), last = list[list.length - 1] || null;
    const changed = !!(last && r && last.seen && last.seen.keys !== r.keys);
    let text;
    if (last) text = '확인함: ' + C.ownerLabel(last.by, last.dept) + ', ' + C.fmtDateTime(last.at) + (last.memo ? '. 메모: ' + last.memo : '') +
      (changed ? '. 확인한 뒤 새 파일을 올렸거나 예외 줄이 바뀌었습니다. 다시 확인을 남겨 주세요.' : '');
    else if (!x.ended) text = '이달이 끝난 뒤 다음 달 말일(' + C.fmtDate(x.due) + ')까지 맞춰 보고 확인합니다.';
    else if (!r) text = '수주 목록 파일을 올리면 맞춰 보고 확인할 수 있습니다. 기한 ' + C.fmtDate(x.due) + '.';
    else if (r.missing) text = '의견을 기다리는 줄이 ' + r.missing + '줄 있습니다. 예외 줄마다 의견을 남겨야 확인할 수 있습니다. 기한 ' + C.fmtDate(x.due) + '.';
    else text = '맞춰 본 결과와 의견을 보고 확인합니다. 확인하면 확인한 사람과 일시, 그때 본 숫자가 남고 고칠 수 없습니다. 기한 ' + C.fmtDate(x.due) + '.';
    const btn = canDo && x.ended && r && !r.missing && (!last || changed)
      ? '<button type="button" class="btn btn--primary btn--md" id="btn-confirm">' + (last ? '다시 확인 남기기' : '대사 확인') + '</button>' : '';
    return '<div class="recon-confirm"><p>' + esc(text) + '</p>' + btn + '</div>';
  }
  function renderDetail() {
    const x = months().filter(function (m) { return m.ym === sel; })[0];
    const r = compare(sel);
    $('#sec-detail').textContent = monthLabel(sel) + ' 대사';
    let html = '';
    if (canDo && x.ended) html += uploadHtml(sel);
    html += '<p class="recon-file">' + (r ? fileLine(r.up) : '<span class="recon-none">' + (x.ended ? '아직 올린 파일이 없습니다.' : monthLabel(sel) + '이 끝난 뒤 그달 수주 목록을 올립니다.') + '</span>') + '</p>';
    if (r) {
      html += sumHtml(r) +
        '<h3 class="recon-h3">계약이 없는 수주</h3>' + ordersTable(sel, r.noContract, x.ended) +
        '<h3 class="recon-h3">수주 목록에 없는 계약</h3>' + contractsTable(sel, r.notInList, x.ended);
    }
    $('#detail').innerHTML = html + confirmHtml(x, r);
  }

  /* ---------- 파일 읽기 (CSV) ---------- */
  // 고객 담당자 이름과 연락처 칸(REQ-SEC-09): 머리글에 이 말이 있으면 읽을 때 빼고 저장하지 않음
  const DROP = /담당자|연락처|전화|휴대|팩스|이메일|메일|e-?mail/i;
  // 읽는 칸: [열쇠, 머리글]. 위에서부터 먼저 맞는 칸. 여기에 없는 칸은 읽지 않음
  const COLS = [['opp', /영업\s*기회/], ['wonAt', /수주\s*일|수주\s*날짜|일자/], ['customer', /고객사|거래처|고객|회사/], ['bizNo', /사업자/], ['amount', /금액/], ['sales', /담당\s*영업|영업\s*대표|영업\s*담당/]];
  function parseCsv(text) {
    const rows = [];
    let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim(); }); });
  }
  // 날짜 글자를 2027-01-01 꼴로. 2026.09.04, 2026/9/4, 20260904도 받음. 없는 날이면 ''
  function isoDay(s) {
    const m = /^(\d{4})[-./]?(\d{1,2})[-./]?(\d{1,2})/.exec(String(s).trim());
    if (!m) return '';
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? m[1] + '-' + pad(m[2]) + '-' + pad(m[3]) : '';
  }
  function parse(text, ym) {
    const table = parseCsv(String(text).replace(/^﻿/, ''));
    if (table.length < 2) return { error: '파일에 읽을 줄이 없습니다. 판다에서 내려받은 그대로의 CSV인지 확인하세요.' };
    const idx = {}, dropped = [], ignored = [];
    table[0].map(function (h) { return String(h).trim(); }).forEach(function (h, i) {
      if (!h) return;
      if (DROP.test(h)) { dropped.push(h); return; }
      const col = COLS.filter(function (c) { return !(c[0] in idx) && c[1].test(h); })[0];
      if (col) idx[col[0]] = i; else ignored.push(h);
    });
    if (!('opp' in idx) || !('wonAt' in idx)) return { error: '영업기회번호와 수주일 칸을 찾지 못했습니다. 판다에서 내려받은 그대로의 CSV인지 확인하세요.' };
    const rows = [], skipped = { before: 0, other: 0, bad: 0 };
    table.slice(1).forEach(function (cells) {
      const get = function (k) { return k in idx ? String(cells[idx[k]] || '').trim() : ''; };
      const opp = get('opp').toUpperCase(), day = isoDay(get('wonAt'));
      if (!C.isOppNo(opp) || !day) { skipped.bad++; return; }
      if (day < START + '-01') { skipped.before++; return; } // 운영 시작 전 수주는 보지 않음(E-1 ②)
      if (day.slice(0, 7) !== ym) { skipped.other++; return; }
      const biz = get('bizNo').replace(/\D/g, '');
      rows.push({ wonAt: day, opp: opp, customer: get('customer'), bizNo: biz.length === 10 ? C.fmtBizNo(biz) : '', amount: Number(get('amount').replace(/[^0-9]/g, '')) || 0, sales: get('sales') });
    });
    return { rows: rows, skipped: skipped, dropped: dropped, ignored: ignored };
  }
  // 읽은 결과를 보여 주고 올릴지 물음. 그 달 수주가 하나도 없으면 받지 않고 까닭에 맞춰 알림(아래)
  function offer(fileName, text) {
    if (!canDo) return;
    const ym = sel, p = parse(text, ym);
    if (p.error) { C.toast(p.error, true); return; }
    const s = p.skipped;
    // REQ-REG-26 ①: 그달 수주가 하나도 없는 파일은 까닭과 관계없이 받지 않음. 알림 글은 뺀 까닭(다른 달, 운영 시작 전, 읽지 못함)대로 고름.
    // 전에는 다른 달 수주만 있을 때만 막아, 운영 시작 전 수주만 있거나 읽지 못한 줄만 있는 파일은 0줄로 올라갔음(2026-11-06 점검 4회차)
    if (!p.rows.length) {
      const why = [];
      if (s.other) why.push('다른 달 수주 ' + s.other + '줄');
      if (s.before) why.push('운영 시작(' + monthLabel(START) + ') 전 수주 ' + s.before + '줄');
      if (s.bad) why.push('번호나 날짜를 읽지 못한 줄 ' + s.bad + '줄');
      // 운영 시작 전 수주만 있으면 달을 바꿔도 안 되므로 파일을 확인하라고(2026-11-06 점검 4회차)
      const tip = s.other ? '대상 월을 확인하세요.' : s.before ? '운영 시작 뒤 수주가 든 파일인지 확인하세요.' : '판다에서 내려받은 그대로의 CSV인지 확인하세요.';
      C.toast('이 파일에는 ' + monthLabel(ym) + ' 수주가 없습니다' + (why.length ? '(' + why.join(', ') + ')' : '') + '. ' + tip, true);
      return;
    }
    C.formModal({
      title: '이 파일로 ' + monthLabel(ym) + ' 대사를 할까요?',
      desc: '올리면 마지막 파일로 맞춰 보고 올린 기록이 남습니다. 뺀 칸의 값은 저장하지 않습니다.',
      body: '<p class="modal-info">' + esc(fileName) + '<br>맞춰 볼 수주 ' + p.rows.length + '줄' +
        (s.before ? ', 운영 시작 전 수주 ' + s.before + '줄은 뺌' : '') + (s.other ? ', 다른 달 수주 ' + s.other + '줄은 뺌' : '') + (s.bad ? ', 번호나 날짜를 읽지 못한 줄 ' + s.bad + '줄' : '') +
        '<br>' + (p.dropped.length ? '뺀 칸(저장하지 않음): ' + esc(p.dropped.join(', ')) : '뺀 칸 없음') +
        (p.ignored.length ? '<br>읽지 않은 칸: ' + esc(p.ignored.join(', ')) : '') + '</p>',
      btn: '올리기',
      done: function () {
        save({ type: 'UPLOAD', id: newUploadId(), month: ym, at: stamp(), by: me.id, dept: me.dept || '', fileName: fileName, rows: p.rows, skipped: s, dropped: p.dropped });
        refresh();
        C.toast(monthLabel(ym) + ' 수주 목록을 올렸습니다. 수주 ' + p.rows.length + '줄을 맞춰 봤습니다.');
      },
    });
  }
  function readFile(file) {
    if (!file) return;
    if (!/\.csv$/i.test(file.name) || file.size > FILE_MAX) { C.toast('CSV 파일, 2MB 이하만 올릴 수 있습니다(' + file.name + ').', true); return; }
    // UTF-8로 읽고, 깨진 글자가 있으면 한글 엑셀이 저장한 CSV(EUC-KR)로 다시 읽음
    const r = new FileReader();
    r.onload = function () {
      const text = String(r.result || '');
      if (text.indexOf('�') < 0) { offer(file.name, text); return; }
      const r2 = new FileReader();
      r2.onload = function () { offer(file.name, String(r2.result || '')); };
      r2.readAsText(file, 'euc-kr');
    };
    r.readAsText(file, 'utf-8');
  }
  // 예시 파일: 판다 내려받기 모양 그대로(담당자와 연락처 칸 포함)를 CSV 글로 만들어 같은 길로 읽음
  function csvCell(v) { const s = String(v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function sampleText() { return [D.OPP_SAMPLE.head].concat(D.OPP_SAMPLE.rows).map(function (r) { return r.map(csvCell).join(','); }).join('\r\n'); }

  /* ---------- 의견, 확인 ---------- */
  function rowInfo(key) {
    const r = compare(sel);
    if (key.indexOf('ORDER:') === 0) {
      const o = r && r.noContract.filter(function (x) { return 'ORDER:' + x.opp === key; })[0];
      return o ? '수주 ' + o.opp + ' ' + (o.customer || '') + ', 수주일 ' + C.fmtDate(o.wonAt) + ', ' + C.fmtWon(o.amount) : key;
    }
    const c = D.CONTRACTS.filter(function (x) { return 'CONTRACT:' + x.id === key; })[0];
    return c ? '계약 ' + c.id + ' ' + (C.canView(c, me) ? c.counterparty : '열람 제한 계약') + ', 영업기회번호 ' + (C.oppOf(c) || '없음') : key;
  }
  function openNote(key) {
    if (!canDo) return;
    const ym = sel, prev = noteOf(ym, key);
    C.formModal({
      title: '의견을 남길까요?',
      desc: '저장하면 남긴 사람과 일시가 함께 남고 고칠 수 없습니다. 바꾸려면 의견을 한 번 더 남깁니다(마지막 의견이 보임).',
      body: '<p class="modal-info">' + esc(rowInfo(key)) + (prev ? '<br>앞 의견: ' + esc(prev.text) : '') + '</p>' +
        C.fieldHtml({ name: 'text', label: '의견', type: 'textarea', required: true,
          placeholder: key.indexOf('ORDER:') === 0 ? '예: 고객 예산 확정이 늦어 아직 기안 전. 영업대표에게 확인함' : '예: 운영 시작 전 수주라 목록에 없음. 판다에서 확인함' }),
      btn: '의견 저장',
      check: function (f) { return { text: val(f, 'text') ? '' : '의견을 적으세요.' }; },
      done: function (f) {
        save({ type: 'NOTE', month: ym, key: key, at: stamp(), by: me.id, dept: me.dept || '', text: val(f, 'text') });
        refresh();
        C.toast('의견을 남겼습니다.');
      },
    });
  }
  function openConfirm() {
    if (!canDo) return;
    const ym = sel, r = compare(ym);
    if (!r || r.missing) return;
    const exc = r.noContract.length + r.notInList.length; // 예외 줄 수(2026-11-09 5회차 13번: 있으면 컴플라이언스에 넘김)
    C.formModal({
      title: monthLabel(ym) + ' 영업기회 대사를 확인할까요?',
      desc: '저장하면 확인한 사람과 일시, 그때 본 숫자가 남고 고칠 수 없습니다.',
      body: '<p class="modal-info">' + esc(seenText(r)) +
          // 예외 줄이 있으면 확인과 함께 컴플라이언스에 넘어가고 이메일이 간다는 안내(기획자 결정 2026-11-09 5회차 13번)
          (exc ? '<br>예외 줄 ' + exc + '건이 있어 확인하면 컴플라이언스 담당자의 점검할 일에 올라가고 이메일로 알립니다.' : '') + '</p>' +
        // 넣지 않아도 되는 칸은 optional로 "(선택)"을 모든 창에서 같은 모양으로(2026-11-06 점검 3회차)
        C.fieldHtml({ name: 'memo', label: '메모', type: 'textarea', optional: true, help: '예: 예외 두 줄 모두 영업대표에게 확인함' }),
      btn: '대사 확인',
      // 창을 연 사이에 다른 탭에서 새 파일을 올렸으면 저장하지 않음
      check: function () { const now = compare(ym); return now && !now.missing && now.keys === r.keys ? {} : { memo: '그사이 대사 내용이 바뀌었습니다. 창을 닫고 다시 보세요.' }; },
      done: function (f) {
        const memo = val(f, 'memo');
        // 확인 기록에 넘어온 일 번호(issueId)를 함께 남김(예외 줄이 없으면 null)
        const finish = function (X, i) {
          save({ type: 'CONFIRM', month: ym, at: stamp(), by: me.id, dept: me.dept || '', uploadId: r.up.id, memo: memo,
            seen: { orders: r.orders, matched: r.matched, noContract: r.noContract.length, notInList: r.notInList.length, keys: r.keys }, issueId: i ? i.id : null });
          refresh();
          C.toast(monthLabel(ym) + ' 영업기회 대사를 확인했습니다.' + (exc ? (X ? X.issueToast(i) : ' 컴플라이언스에 넘기지 못했습니다. 화면을 새로 고친 뒤 컴플라이언스 담당자에게 알려 주세요.') : ''), !!exc && !i);
        };
        if (!exc) { finish(null, null); return; }
        // 넘기는 글: 숫자와 줄 번호만(영업기회번호, 계약번호). 고객사 이름은 넣지 않음(열람 제한 계약 보호, REQ-AUTH-09)
        const rows = r.noContract.map(function (o) { return '수주 ' + o.opp; }).concat(r.notInList.map(function (c) { return '계약 ' + c.id; }));
        withCtl(function (X) {
          finish(X, X ? X.raiseIssue({ source: 'OPP', title: monthLabel(ym) + ' 영업기회 대사: 계약이 없는 수주 ' + r.noContract.length + '건, 수주 목록에 없는 계약 ' + r.notInList.length + '건',
            note: '예외 줄: ' + rows.join(', ') + (memo ? '. 메모: ' + memo : ''), href: 'opp-recon.html?month=' + ym, ref: ym }) : null);
        });
      },
    });
  }

  /* ---------- 3. 대사 기록 (새것부터 20줄씩) ---------- */
  let page = 1;
  const ACT = { UPLOAD: '파일 올림', NOTE: '의견', CONFIRM: '대사 확인' };
  function logText(r) {
    if (r.type === 'UPLOAD') return r.fileName + ', 수주 ' + r.rows.length + '줄' + ((r.dropped || []).length ? '. 뺀 칸(저장하지 않음): ' + r.dropped.join(', ') : '');
    if (r.type === 'NOTE') {
      const c = r.key.indexOf('CONTRACT:') === 0 ? D.CONTRACTS.filter(function (x) { return 'CONTRACT:' + x.id === r.key; })[0] : null;
      return (r.key.indexOf('ORDER:') === 0 ? '수주 ' + r.key.slice(6) : '계약 ' + r.key.slice(9) + (c && !C.canView(c, me) ? '(열람 제한)' : '')) + ': ' + r.text;
    }
    const s = r.seen || {};
    return '계약이 없는 수주 ' + (s.noContract || 0) + '건, 수주 목록에 없는 계약 ' + (s.notInList || 0) + '건을 보고 확인' + (r.memo ? '. 메모: ' + r.memo : '') +
      (r.issueId ? '. 컴플라이언스에 넘김(' + r.issueId + ')' : ''); // 2026-11-09 5회차 13번
  }
  function renderLog() {
    const all = records().slice().reverse();
    const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    page = Math.min(page, pages);
    const from = (page - 1) * PAGE_SIZE, rows = all.slice(from, from + PAGE_SIZE);
    $('#log-rows').innerHTML = rows.length ? rows.map(function (r) {
      return '<tr><td class="num-left">' + C.fmtDateTime(r.at).split(' ').map(function (s) { return '<span class="keep">' + s + '</span>'; }).join(' ') + '</td>' +
        '<td class="nowrap">' + monthLabel(r.month) + '</td><td class="nowrap">' + ACT[r.type] + '</td>' +
        '<td class="col-text">' + esc(logText(r)) + '</td><td class="center">' + esc(C.ownerLabel(r.by, r.dept)) + '</td></tr>';
    }).join('') : '<tr><td class="empty-row" colspan="5">아직 기록이 없습니다.</td></tr>';
    $('#log-pages').innerHTML = C.pagerHtml(page, pages, all.length, from, rows.length, PAGE_SIZE, '건');
  }

  /* ---------- 그리기와 누르기 ---------- */
  function refresh() {
    $('#f-month').innerHTML = months().map(function (x) { return '<option value="' + x.ym + '"' + (x.ym === sel ? ' selected' : '') + '>' + monthLabel(x.ym) + '</option>'; }).join('');
    renderMonths();
    renderDetail();
    renderLog();
  }
  sel = defaultMonth();
  $('#f-month').addEventListener('change', function (e) { sel = e.target.value; refresh(); });
  $('#content').addEventListener('click', function (e) {
    const m = e.target.closest('[data-month]');
    // 보기: 달 표를 다시 그려 누른 단추가 없어지므로 초점과 화면을 아래 대사 제목으로(2026-11-06 점검 3회차)
    if (m) { sel = m.getAttribute('data-month'); refresh(); C.focusSection('#sec-detail'); return; }
    const n = e.target.closest('[data-note]');
    if (n) { openNote(n.getAttribute('data-note')); return; }
    if (e.target.closest('#btn-confirm')) { openConfirm(); return; }
    if (e.target.closest('#btn-sample') && canDo) { offer(D.OPP_SAMPLE.fileName, sampleText()); return; }
    const pg = e.target.closest('#log-pages [data-page]');
    // 쪽 번호: 누른 단추가 다시 그려져 없어지므로 초점과 화면을 대사 기록 제목으로(다른 목록과 같게)(2026-11-06 점검 3회차)
    if (pg && !pg.disabled) { page = Number(pg.getAttribute('data-page')); renderLog(); C.focusSection('#sec-log'); }
  });
  $('#content').addEventListener('change', function (e) {
    if (e.target.id === 'f-csv' && canDo) { readFile(e.target.files[0]); e.target.value = ''; }
  });
  // 끌어다 놓기도 같은 검사(다른 화면의 파일 올리기와 같게)
  $('#content').addEventListener('dragover', function (e) { const d = e.target.closest('.file-drop'); if (d) { e.preventDefault(); d.classList.add('is-dragover'); } });
  $('#content').addEventListener('dragleave', function (e) { const d = e.target.closest('.file-drop'); if (d) d.classList.remove('is-dragover'); });
  $('#content').addEventListener('drop', function (e) {
    const d = e.target.closest('.file-drop');
    if (!d) return;
    e.preventDefault();
    d.classList.remove('is-dragover');
    if (canDo) readFile(e.dataTransfer.files[0]);
  });
  refresh();
})();
