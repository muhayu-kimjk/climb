/* =====================================================================
 * SCR-63 인장 기록 대조 화면 로직 (seal-recon.js)
 * ---------------------------------------------------------------------
 * 기획자 결정 2026-11-02 E-7 덧붙임 ③: 견적서 출력 기록의 "인장 찍음"을 총무가 매월 인장 대장과 대조. 출력은 막지 않음. 기록은 쌓기만 함
 * 볼 수 있는 사람: 총무(C.checkOwners('SCR-63')), 최고관리자(시연용), 감사 열람(보기만), 컴플라이언스(보기만)
 *   기획자 결정 2026-11-10 16번: 컴플라이언스도 감사 열람처럼 보기만 함. 넘어온 일("맞지 않는 것이 있음")의 원래 기록을 바로 봄
 * 남길 수 있는지: C.canDoCheck(me, 'SCR-63')이면서 컴플라이언스가 아님. 읽기만 하는 역할(감사 열람)과 컴플라이언스는 false라 단추가 없음
 *   보기만 하는 사람에게는 월별 대조 안내 끝에 "보기만 합니다" 한 줄을 덧붙임(기획자 결정 2026-11-10 16번, 할인 예외 점검과 같은 모양)
 *   C-6: 최고관리자는 자기가 낸 출력이 든 달의 대조를 남기지 않음(그 달은 총무가 남김)
 * 하는 일
 *   1. 월별 대조: 운영을 시작한 달(D.SERVICE_START_MONTH)부터 이달까지 한 줄씩. 기한은 다음 달 말일 [가정, 다른 매월 점검과 같게]
 *      인장 찍은 출력 수(sealed), 인장 없이 낸 출력 수(sealed: false. 인장 그림이 없던 때), 마지막 대조
 *   2. 고른 달의 인장 찍은 출력: 견적번호, 판, 출력한 사람, 일시, 인장 그림의 판, 합계. 인장 없이 낸 출력은 아래 접은 목록
 *      대조 남기기(끝난 달): 결과(인장 대장과 맞음, 맞지 않는 것이 있음)와 메모(맞으면 선택, 맞지 않으면 필수). 그때 본 출력 열쇠를 함께 남겨
 *      뒤에 목록이 달라지면 "대조한 뒤 바뀜"
 *   3. 대조 기록: 새것부터 20줄씩
 *   기획자 결정 2026-11-09 5회차 3번: 계약서에 찍은 인장(⑥ 날인 완료, 결재 기록의 S06 승인)도 같은 화면, 같은 매월 기한에 인장 대장(구글 폼)과 맞춤
 *     고른 달 아래에 "견적서 인장"과 "계약서 날인" 두 묶음. 대조 하나로 둘을 함께 남기고, 그때 본 날인 열쇠(seen.cn, seen.ckeys)도 남김
 *     전에는 견적서 인장만 맞춰 ⑥ 날인은 대장과 어긋나도 찾지 못했음(06 CTL-59 [제안], 남는 위험 R-11)
 *   기획자 결정 2026-11-09 5회차 13번: "맞지 않는 것이 있음"을 남기면 컴플라이언스에 넘김(control-checks.js X.raiseIssue). 개요 점검할 일과 이메일
 * 프로토타입: 대조 기록은 예시(D.SEAL_RECON)와 이 브라우저의 시연 기록(C.loadDemo('sealRecon')). 출력 기록은 견적(C.allQuotes)의 issues, ⑥ 날인은 계약의 결재 기록(history)
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const X = window.CLIMB_CTL; // 컴플라이언스에 넘기기(seal-recon.html이 control-checks.js를 부름, 기획자 결정 2026-11-09 5회차 13번)
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const SCR = 'SCR-63';
  // 문: 맡은 사람, 감사 열람, 컴플라이언스(보기만, 기획자 결정 2026-11-10 16번)
  if (!C.gate(me, C.checkOwners(SCR).concat(['AUDIT', 'COMPLIANCE']), '인장 기록 대조는 총무가 씁니다',
    '지금은 ' + esc(C.roleLabel(me.role)) + ' 역할로 보고 있습니다. 화면 맨 위 검은 띠에서 총무, 감사 열람, 컴플라이언스, 최고관리자 가운데 하나로 바꾸면 볼 수 있습니다.')) return;

  // 감사 열람과 컴플라이언스는 보기만(기획자 결정 2026-11-10 16번)
  const canDo = C.canDoCheck(me, SCR) && !(me.role !== 'SUPER' && C.hasRole(me, ['COMPLIANCE']));
  // 보기만 하는 사람: 안내 한 줄을 덧붙임. 화면을 처음 그리기 전에 한 번이라 흔들리지 않음(기획자 결정 2026-11-10 16번)
  if (!canDo && $('#months-desc')) $('#months-desc').textContent += ' 보기만 합니다. 대조는 총무가 남깁니다.';
  const START = D.SERVICE_START_MONTH, THIS_MONTH = D.TODAY.slice(0, 7), PAGE_SIZE = 20;
  const RESULT = { MATCH: '인장 대장과 맞음', DIFF: '맞지 않는 것이 있음' };
  function pad(n) { return String(n).padStart(2, '0'); }
  function lastDay(y, m) { return y + '-' + pad(m) + '-' + pad(new Date(y, m, 0).getDate()); } // m: 1~12
  function monthLabel(ym) { return ym.slice(0, 4) + '년 ' + Number(ym.slice(5, 7)) + '월'; }
  function val(f, n) { return (f.elements[n].value || '').trim(); }
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

  /* ---------- 출력 기록과 대조 기록 ---------- */
  // 그 달의 "견적서 출력" 기록: sealed가 true(인장 찍음), false(인장 없이 냄). 이 결정 앞의 기록(sealed 없음)은 셈하지 않음
  function outputs(ym) {
    const out = [];
    C.allQuotes().forEach(function (q) {
      (q.issues || []).forEach(function (i) {
        if (String(i.at).slice(0, 7) === ym && typeof i.sealed === 'boolean') out.push({ no: q.no, ver: q.ver, at: i.at, by: i.by, total: i.total, sealed: i.sealed, sealVer: i.sealVer || null });
      });
    });
    return out.sort(function (a, b) { return a.at.localeCompare(b.at); });
  }
  function keysOf(list) { return list.map(function (o) { return o.no + '#' + o.ver + '@' + String(o.at).slice(0, 16); }).join(','); }
  // 그 달의 계약서 ⑥ 날인 완료(결재 기록의 S06 승인)(기획자 결정 2026-11-09 5회차 3번)
  //   승인 줄마다 하나. 보완이나 반려 뒤 다시 기안해 다시 날인하면 차수마다 한 줄(대장에도 날인마다 한 줄이라). 시연으로 남긴 ⑥ 승인도 들어감
  //   승인 취소가 뒤에 있어도 인장은 이미 찍었으므로 그대로 셈 [가정]
  function seals(ym) {
    const out = [];
    D.CONTRACTS.forEach(function (c) {
      if (!c.id) return;
      (c.history || []).forEach(function (h) {
        if (h.step === 'S06' && h.action === 'APPROVE' && String(h.at).slice(0, 7) === ym) out.push({ c: c, no: c.id, round: h.round || 1, at: h.at, by: h.actorId, behalf: h.onBehalfOf || null });
      });
    });
    return out.sort(function (a, b) { return String(a.at).localeCompare(String(b.at)) || a.no.localeCompare(b.no); });
  }
  function sealKeysOf(list) { return list.map(function (s) { return s.no + '#' + s.round + '@' + String(s.at).slice(0, 16); }).join(','); }
  // 대조한 뒤 바뀌었는지: 견적서 인장 열쇠나 계약서 날인 열쇠가 그때와 다름
  //   계약서 날인 열쇠가 없는 기록(3번 결정 전에 남긴 시연 기록)은 날인이 있으면 바뀐 것으로 봄(⑥ 날인을 맞춰 보지 않은 대조라서)
  function changedOf(last, sealed, cs) {
    return !!(last && last.seen && (last.seen.keys !== keysOf(sealed) || (last.seen.ckeys || '') !== sealKeysOf(cs)));
  }
  function records() { return (D.SEAL_RECON || []).concat(C.loadDemo('sealRecon')).slice().sort(function (a, b) { return a.at.localeCompare(b.at); }); }
  function recordsOf(ym) { return records().filter(function (r) { return r.month === ym; }); }
  function resultBadge(r) { return r.result === 'MATCH' ? C.badge('success', RESULT.MATCH) : C.badge('attention', RESULT.DIFF); } // 맞지 않음은 보라(주의), 설정 변경 확인과 같게(기획자 결정 2026-11-09)

  /* ---------- 1. 월별 대조 ---------- */
  let sel = '';
  function defaultMonth() {
    const q = new URLSearchParams(location.search).get('month');
    const list = months();
    if (q && list.some(function (x) { return x.ym === q; })) return q;
    const open = list.filter(function (x) { return x.ended && !recordsOf(x.ym).length; })[0];
    const ended = list.filter(function (x) { return x.ended; })[0];
    return (open || ended || list[0]).ym;
  }
  function renderMonths() {
    $('#month-rows').innerHTML = months().map(function (x) {
      const all = outputs(x.ym), sealed = all.filter(function (o) { return o.sealed; }), last = recordsOf(x.ym).pop() || null;
      const cs = seals(x.ym); // 계약서 ⑥ 날인(기획자 결정 2026-11-09 5회차 3번)
      const late = !last && x.ended && D.TODAY > x.due;
      const changed = changedOf(last, sealed, cs);
      return '<tr' + (late ? ' class="is-alert"' : '') + '><td class="nowrap cell-strong">' + monthLabel(x.ym) + '</td>' +
        '<td class="num-left nowrap">' + C.fmtDate(x.due) + (late ? '<span class="cell-meta">기한 지남</span>' : '') + '</td>' +
        '<td class="num">' + sealed.length + '건</td><td class="num">' + (all.length - sealed.length) + '건</td>' +
        '<td class="num">' + cs.length + '건</td>' + // 계약서 날인 칸(2026-11-09 5회차 3번)
        '<td>' + (last ? resultBadge(last) + '<span class="cell-meta">' + esc(C.ownerLabel(last.by, last.dept)) + ' ' + esc(C.fmtDateTime(last.at)) + '</span>' +
          (changed ? '<span class="cell-meta">' + C.badge('attention', '대조한 뒤 바뀜') + '</span>' : '') : C.badge('line', x.ended ? '대조 전' : '예정')) + '</td>' +
        '<td class="col-action"><button type="button" class="link-act" data-month="' + x.ym + '"' + (x.ym === sel ? ' aria-current="true"' : '') + '>보기<span class="sr-only"> ' + monthLabel(x.ym) + '</span></button></td></tr>';
    }).join('');
  }

  /* ---------- 2. 고른 달의 인장 찍은 출력 ---------- */
  function outputRows(list) {
    return list.map(function (o) {
      return '<tr><td class="nowrap cell-strong">' + esc(o.no) + '</td><td class="center">' + o.ver + '판</td>' +
        '<td class="center">' + esc(C.ownerLabel(o.by)) + '</td><td class="num-left nowrap">' + esc(C.fmtDateTime(o.at)) + '</td>' +
        '<td class="center">' + (o.sealed ? (o.sealVer ? o.sealVer + '판' : '-') : '인장 없음') + '</td><td class="num">' + C.fmtWon(o.total) + '</td></tr>';
    }).join('');
  }
  function outputTable(list, label, empty) {
    return '<div class="tbl-scroll" tabindex="0" role="region" aria-label="' + label + ' 표"><table class="tbl tbl--compact">' +
      '<caption class="sr-only">' + label + ': 견적번호, 판, 출력한 사람, 출력 일시, 인장 그림, 합계</caption>' +
      '<thead><tr><th scope="col">견적번호</th><th scope="col">판</th><th scope="col" class="col-phone-wide">출력한 사람</th><th scope="col">출력 일시</th><th scope="col">인장 그림</th><th scope="col" class="num">합계</th></tr></thead><tbody>' +
      (list.length ? outputRows(list) : '<tr><td class="empty-row" colspan="6">' + empty + '</td></tr>') + '</tbody></table></div>';
  }
  // 계약서 ⑥ 날인 표(기획자 결정 2026-11-09 5회차 3번): 계약번호, 고객사, 계약 종류, 날인한 사람(⑥ 총무), 날인 일시
  //   볼 수 없는 열람 제한 계약은 고객사를 가리고 계약번호만(REQ-AUTH-09). 대장과 맞추는 데는 계약번호와 날인 일시면 됨
  function sealRows(list) {
    return list.map(function (s) {
      const see = C.canView(s.c, me);
      return '<tr><td class="nowrap cell-strong">' + esc(s.no) + (s.round > 1 ? '<span class="cell-meta">' + s.round + '차 날인</span>' : '') + '</td>' +
        '<td>' + (see ? esc(s.c.counterparty) : '<span class="is-masked">' + C.icon('lock', 'sm') + '열람 제한 계약</span>') + '</td>' +
        '<td class="center">' + esc(C.kindLabel(s.c)) + '</td>' +
        '<td class="center">' + esc(C.ownerLabel(s.by)) + (s.behalf ? '<span class="cell-meta">' + esc(C.ownerLabel(s.behalf)) + ' 대신</span>' : '') + '</td>' +
        '<td class="num-left nowrap">' + esc(C.fmtDateTime(s.at)) + '</td></tr>';
    }).join('');
  }
  function sealTable(list) {
    return '<div class="tbl-scroll" tabindex="0" role="region" aria-label="계약서 날인 표"><table class="tbl tbl--compact">' +
      '<caption class="sr-only">계약서 날인: 계약번호, 고객사, 계약 종류, 날인한 사람, 날인 일시</caption>' +
      '<thead><tr><th scope="col">계약번호</th><th scope="col" class="col-phone-wide">고객사</th><th scope="col">계약 종류</th><th scope="col">날인한 사람</th><th scope="col">날인 일시</th></tr></thead><tbody>' +
      (list.length ? sealRows(list) : '<tr><td class="empty-row" colspan="5">이 달에 ⑥ 날인을 마친 계약이 없습니다.</td></tr>') + '</tbody></table></div>';
  }
  // 최고관리자는 자기가 낸 출력이 든 달의 대조를 남기지 않음(기획자 결정 2026-11-02 C-6)
  //   ⑥ 날인을 자기가 처리한 달도 같음(2026-11-09 5회차 3번: 계약서 날인을 함께 맞추므로)
  function ownWork(list, cs) { return me.role === 'SUPER' && (list.some(function (o) { return o.by === me.id; }) || (cs || []).some(function (s) { return s.by === me.id; })); }
  function confirmHtml(x, sealed, cs) {
    const list = recordsOf(x.ym), last = list[list.length - 1] || null;
    const changed = changedOf(last, sealed, cs);
    let text;
    if (last) text = '마지막 대조: ' + RESULT[last.result] + ', ' + C.ownerLabel(last.by, last.dept) + ', ' + C.fmtDateTime(last.at) + (last.memo ? '. 메모: ' + last.memo : '') +
      (last.issueId ? '. 컴플라이언스에 넘김(' + last.issueId + ')' : '') + // 2026-11-09 5회차 13번
      (changed ? '. 대조한 뒤 이 달의 출력이나 날인 기록이 달라졌습니다. 다시 맞춰 보고 남겨 주세요.' : '');
    else if (!x.ended) text = '이달이 끝난 뒤 다음 달 말일(' + C.fmtDate(x.due) + ')까지 인장 대장과 맞춰 보고 대조를 남깁니다.';
    else text = '견적서 인장 ' + sealed.length + '건과 계약서 날인 ' + cs.length + '건을 인장 대장과 맞춰 보고 대조를 남깁니다. 남기면 남긴 사람과 일시, 그때 본 출력과 날인이 함께 남고 고칠 수 없습니다. 기한 ' + C.fmtDate(x.due) + '.';
    const own = canDo && x.ended && ownWork(sealed, cs);
    if (own) text += ' 최고관리자가 낸 출력이나 처리한 날인이 든 달이라 대조는 총무가 남깁니다.';
    const btn = canDo && x.ended && !own ? '<button type="button" class="btn btn--primary btn--md" id="btn-confirm">' + (last ? '다시 대조 남기기' : '대조 남기기') + '</button>' : '';
    return '<div class="recon-confirm"><p>' + esc(text) + '</p>' + btn + '</div>';
  }
  function renderDetail() {
    const x = months().filter(function (m) { return m.ym === sel; })[0];
    const all = outputs(sel), sealed = all.filter(function (o) { return o.sealed; }), plain = all.filter(function (o) { return !o.sealed; });
    const cs = seals(sel);
    // 기획자 결정 2026-11-09 5회차 3번: 제목을 "인장 기록"으로 넓히고 "견적서 인장"과 "계약서 날인" 두 묶음을 나란히(위아래로) 둠
    $('#sec-detail').textContent = monthLabel(sel) + ' 인장 기록';
    $('#detail').innerHTML = '<h3 class="recon-h3">견적서 인장</h3>' +
      outputTable(sealed, '견적서 인장', '이 달에 인장을 찍은 견적서 출력이 없습니다.') +
      // 인장 없이 낸 출력: 대장과 맞출 것은 없지만 언제 왜 없었는지 볼 수 있게 접어 둠(회사 설정에 인장 그림이 없던 때)
      (plain.length ? '<details class="seen-data"><summary>인장 없이 낸 출력 ' + plain.length + '건 보기</summary>' +
        outputTable(plain, '인장 없이 낸 출력', '') + '</details>' : '') +
      '<h3 class="recon-h3">계약서 날인</h3>' + sealTable(cs) +
      confirmHtml(x, sealed, cs);
  }
  function openConfirm() {
    if (!canDo) return;
    const ym = sel, sealed = outputs(ym).filter(function (o) { return o.sealed; }), cs = seals(ym);
    if (ownWork(sealed, cs)) return;
    const keys = keysOf(sealed), ckeys = sealKeysOf(cs);
    C.formModal({
      title: monthLabel(ym) + ' 인장 기록 대조를 남길까요?',
      desc: '저장하면 남긴 사람과 일시, 그때 본 출력과 날인이 함께 남고 고칠 수 없습니다.',
      body: '<p class="modal-info">견적서 인장 ' + sealed.length + '건' + (sealed.length ? ': ' + esc(sealed.map(function (o) { return o.no + ' ' + o.ver + '판(' + C.fmtDateTime(o.at) + ')'; }).join(', ')) : '') +
        // 계약서 ⑥ 날인도 함께 보임(2026-11-09 5회차 3번). 계약번호만(고객사는 넣지 않음)
        '<br>계약서 날인 ' + cs.length + '건' + (cs.length ? ': ' + esc(cs.map(function (s) { return s.no + (s.round > 1 ? ' ' + s.round + '차' : '') + '(' + C.fmtDateTime(s.at) + ')'; }).join(', ')) : '') + '</p>' +
        '<fieldset class="field" data-field="result"><legend class="field-label">결과<span class="req" aria-hidden="true">*</span><span class="sr-only">(필수)</span></legend>' +
          '<div class="choice-row"><label class="choice"><input type="radio" name="result" value="MATCH">' + RESULT.MATCH + '</label>' +
          '<label class="choice"><input type="radio" name="result" value="DIFF">' + RESULT.DIFF + '</label></div><p class="field-error" hidden></p></fieldset>' +
        // 메모는 "맞지 않는 것이 있음"을 고를 때만 필수. 처음엔 (선택), 고르면 필수 표시로(아래 open, 2026-11-06 점검 3회차)
        //   "맞지 않는 것이 있음"을 남기면 컴플라이언스에 넘어가고 이메일이 간다는 안내(기획자 결정 2026-11-09 5회차 13번)
        C.fieldHtml({ name: 'memo', label: '메모', type: 'textarea', optional: true, help: '맞지 않는 것이 있으면 꼭 적습니다. 예: 10월 15일 출력이 대장에 없어 출력한 영업에게 대장 기록을 요청함. ' + X.ISSUE_HELP })
          .replace(' <span class="opt">', '<span class="req" aria-hidden="true" hidden>*</span><span class="sr-only req-sr" hidden>(필수)</span> <span class="opt">'),
      btn: '대조 저장',
      // 결과를 고를 때마다 메모 칸 이름의 필수 표시를 바꿈. 계약 등록의 사용 업체 칸과 같은 방식(new-contract.js syncOrg, 2026-11-06 점검 3회차)
      open: function (f) {
        const box = f.querySelector('[data-field="memo"]');
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
        return { result: r ? '' : '결과를 고르세요.', memo: r && r.value === 'DIFF' && !val(f, 'memo') ? '맞지 않는 것과 한 일을 적으세요.' : '' };
      },
      done: function (f) {
        const result = f.querySelector('[name="result"]:checked').value;
        // 맞지 않음이면 컴플라이언스에 넘김(기획자 결정 2026-11-09 5회차 13번). 넘어온 일 번호를 대조 기록에도 남겨 둘을 이음
        const issue = result === 'DIFF' ? X.raiseIssue({ source: 'SEAL', title: monthLabel(ym) + ' 인장 기록 대조: 인장 대장과 맞지 않는 것이 있음',
          note: val(f, 'memo'), href: 'seal-recon.html?month=' + ym, ref: ym }) : null;
        // seen: 견적서 인장(n, keys)과 계약서 날인(cn, ckeys, 2026-11-09 5회차 3번)
        C.pushDemo('sealRecon', { month: ym, at: C.nowStamp().slice(0, 16), by: me.id, dept: me.dept || '', result: result,
          memo: val(f, 'memo'), seen: { n: sealed.length, keys: keys, cn: cs.length, ckeys: ckeys }, issueId: issue ? issue.id : null });
        refresh();
        C.toast(monthLabel(ym) + ' 인장 기록 대조를 남겼습니다.' + X.issueToast(issue));
      },
    });
  }

  /* ---------- 3. 대조 기록 (새것부터 20줄씩) ---------- */
  let page = 1;
  function renderLog() {
    const all = records().slice().reverse();
    const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    page = Math.min(page, pages);
    const from = (page - 1) * PAGE_SIZE, rows = all.slice(from, from + PAGE_SIZE);
    $('#log-rows').innerHTML = rows.length ? rows.map(function (r) {
      return '<tr><td class="num-left">' + C.fmtDateTime(r.at).split(' ').map(function (s) { return '<span class="keep">' + s + '</span>'; }).join(' ') + '</td>' +
        '<td class="nowrap">' + monthLabel(r.month) + '</td><td class="nowrap">' + resultBadge(r) + '</td>' +
        // 본 건수: 견적서 인장과 계약서 날인(2026-11-09 5회차 3번. 그 결정 전 기록은 견적서만). 컴플라이언스에 넘긴 대조는 그 번호(13번)
        '<td class="num">견적서 ' + ((r.seen || {}).n || 0) + '건' + ((r.seen || {}).cn != null ? '<span class="cell-meta">계약서 ' + r.seen.cn + '건</span>' : '') + '</td>' +
        '<td class="col-text">' + (r.memo ? esc(r.memo) : '<span class="recon-none">-</span>') + (r.issueId ? '<span class="cell-meta">컴플라이언스에 넘김(' + esc(r.issueId) + ')</span>' : '') + '</td>' +
        '<td class="center">' + esc(C.ownerLabel(r.by, r.dept)) + '</td></tr>';
    }).join('') : '<tr><td class="empty-row" colspan="6">아직 대조 기록이 없습니다.</td></tr>';
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
    // 보기: 달 표를 다시 그려 누른 단추가 없어지므로 초점과 화면을 아래 대조 제목으로(2026-11-06 점검 3회차)
    if (m) { sel = m.getAttribute('data-month'); refresh(); C.focusSection('#sec-detail'); return; }
    if (e.target.closest('#btn-confirm')) { openConfirm(); return; }
    const pg = e.target.closest('#log-pages [data-page]');
    // 쪽 번호: 누른 단추가 다시 그려져 없어지므로 초점과 화면을 대조 기록 제목으로(다른 목록과 같게)(2026-11-06 점검 3회차)
    if (pg && !pg.disabled) { page = Number(pg.getAttribute('data-page')); renderLog(); C.focusSection('#sec-log'); }
  });
  refresh();
})();
