/* =====================================================================
 * SCR-63 인장 기록 대사 화면 로직 (seal-recon.js)
 * ---------------------------------------------------------------------
 * 기획자 결정 2026-11-02 E-7 덧붙임 ③: 견적서 출력 기록의 "인장 찍음"을 총무가 매월 인장 대장과 대조. 출력은 막지 않음. 기록은 쌓기만 함
 * 볼 수 있는 사람: 총무(C.checkOwners('SCR-63')), 최고관리자(시연용), 감사 열람(보기만)
 * 남길 수 있는지: C.canDoCheck(me, 'SCR-63'). 읽기만 하는 역할(감사 열람)은 false라 단추가 없음
 *   C-6: 최고관리자는 자기가 낸 출력이 든 달의 대조를 남기지 않음(그 달은 총무가 남김)
 * 하는 일
 *   1. 월별 대조: 운영을 시작한 달(D.SERVICE_START_MONTH)부터 이달까지 한 줄씩. 기한은 다음 달 말일 [가정, 다른 매월 점검과 같게]
 *      인장 찍은 출력 수(sealed), 인장 없이 낸 출력 수(sealed: false. 인장 그림이 없던 때), 마지막 대조
 *   2. 고른 달의 인장 찍은 출력: 견적번호, 판, 출력한 사람, 일시, 인장 그림의 판, 합계. 인장 없이 낸 출력은 아래 접은 목록
 *      대조 남기기(끝난 달): 결과(인장 대장과 맞음, 맞지 않는 것이 있음)와 메모(맞으면 선택, 맞지 않으면 필수). 그때 본 출력 열쇠를 함께 남겨
 *      뒤에 목록이 달라지면 "대조한 뒤 바뀜"
 *   3. 대조 기록: 새것부터 20줄씩
 * 프로토타입: 대조 기록은 예시(D.SEAL_RECON)와 이 브라우저의 시연 기록(C.loadDemo('sealRecon')). 출력 기록은 견적(C.allQuotes)의 issues
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const SCR = 'SCR-63';
  if (!C.gate(me, C.checkOwners(SCR).concat(['AUDIT']), '인장 기록 대사는 총무가 씁니다',
    '지금은 ' + esc(C.roleLabel(me.role)) + ' 역할로 보고 있습니다. 화면 맨 위 검은 띠에서 총무, 감사 열람, 최고관리자 가운데 하나로 바꾸면 볼 수 있습니다.')) return;

  const canDo = C.canDoCheck(me, SCR);
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
  function records() { return (D.SEAL_RECON || []).concat(C.loadDemo('sealRecon')).slice().sort(function (a, b) { return a.at.localeCompare(b.at); }); }
  function recordsOf(ym) { return records().filter(function (r) { return r.month === ym; }); }
  function resultBadge(r) { return r.result === 'MATCH' ? C.badge('success', RESULT.MATCH) : C.badge('danger', RESULT.DIFF); }

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
      const late = !last && x.ended && D.TODAY > x.due;
      const changed = !!(last && last.seen && last.seen.keys !== keysOf(sealed));
      return '<tr' + (late ? ' class="is-alert"' : '') + '><td class="nowrap cell-strong">' + monthLabel(x.ym) + '</td>' +
        '<td class="num-left nowrap">' + C.fmtDate(x.due) + (late ? '<span class="cell-meta">기한 지남</span>' : '') + '</td>' +
        '<td class="num">' + sealed.length + '건</td><td class="num">' + (all.length - sealed.length) + '건</td>' +
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
  // 최고관리자는 자기가 낸 출력이 든 달의 대조를 남기지 않음(기획자 결정 2026-11-02 C-6)
  function ownWork(list) { return me.role === 'SUPER' && list.some(function (o) { return o.by === me.id; }); }
  function confirmHtml(x, sealed) {
    const list = recordsOf(x.ym), last = list[list.length - 1] || null;
    const changed = !!(last && last.seen && last.seen.keys !== keysOf(sealed));
    let text;
    if (last) text = '마지막 대조: ' + RESULT[last.result] + ', ' + C.ownerLabel(last.by, last.dept) + ', ' + C.fmtDateTime(last.at) + (last.memo ? '. 메모: ' + last.memo : '') +
      (changed ? '. 대조한 뒤 이 달의 출력 기록이 달라졌습니다. 다시 맞춰 보고 남겨 주세요.' : '');
    else if (!x.ended) text = '이달이 끝난 뒤 다음 달 말일(' + C.fmtDate(x.due) + ')까지 인장 대장과 맞춰 보고 대조를 남깁니다.';
    else text = '인장 찍은 출력 ' + sealed.length + '건을 인장 대장과 맞춰 보고 대조를 남깁니다. 남기면 남긴 사람과 일시, 그때 본 출력이 함께 남고 고칠 수 없습니다. 기한 ' + C.fmtDate(x.due) + '.';
    const own = canDo && x.ended && ownWork(sealed);
    if (own) text += ' 최고관리자가 낸 출력이 든 달이라 대조는 총무가 남깁니다.';
    const btn = canDo && x.ended && !own ? '<button type="button" class="btn btn--primary btn--md" id="btn-confirm">' + (last ? '다시 대조 남기기' : '대조 남기기') + '</button>' : '';
    return '<div class="recon-confirm"><p>' + esc(text) + '</p>' + btn + '</div>';
  }
  function renderDetail() {
    const x = months().filter(function (m) { return m.ym === sel; })[0];
    const all = outputs(sel), sealed = all.filter(function (o) { return o.sealed; }), plain = all.filter(function (o) { return !o.sealed; });
    $('#sec-detail').textContent = monthLabel(sel) + ' 인장 찍은 출력';
    $('#detail').innerHTML = outputTable(sealed, '인장 찍은 출력', '이 달에 인장을 찍은 출력이 없습니다.') +
      // 인장 없이 낸 출력: 대장과 맞출 것은 없지만 언제 왜 없었는지 볼 수 있게 접어 둠(회사 설정에 인장 그림이 없던 때)
      (plain.length ? '<details class="seen-data"><summary>인장 없이 낸 출력 ' + plain.length + '건 보기</summary>' +
        outputTable(plain, '인장 없이 낸 출력', '') + '</details>' : '') +
      confirmHtml(x, sealed);
  }
  function openConfirm() {
    if (!canDo) return;
    const ym = sel, sealed = outputs(ym).filter(function (o) { return o.sealed; });
    if (ownWork(sealed)) return;
    const keys = keysOf(sealed);
    C.formModal({
      title: monthLabel(ym) + ' 인장 기록 대조를 남길까요?',
      desc: '저장하면 남긴 사람과 일시, 그때 본 출력이 함께 남고 고칠 수 없습니다.',
      body: '<p class="modal-info">인장 찍은 출력 ' + sealed.length + '건' + (sealed.length ? ': ' + esc(sealed.map(function (o) { return o.no + ' ' + o.ver + '판(' + C.fmtDateTime(o.at) + ')'; }).join(', ')) : '') + '</p>' +
        '<fieldset class="field" data-field="result"><legend class="field-label">결과<span class="req" aria-hidden="true">*</span><span class="sr-only">(필수)</span></legend>' +
          '<div class="choice-row"><label class="choice"><input type="radio" name="result" value="MATCH">' + RESULT.MATCH + '</label>' +
          '<label class="choice"><input type="radio" name="result" value="DIFF">' + RESULT.DIFF + '</label></div><p class="field-error" hidden></p></fieldset>' +
        C.fieldHtml({ name: 'memo', label: '메모', type: 'textarea', help: '맞으면 선택, 맞지 않는 것이 있으면 꼭 적습니다. 예: 10월 15일 출력이 대장에 없어 출력한 영업에게 대장 기록을 요청함' }),
      btn: '대조 저장',
      check: function (f) {
        const r = f.querySelector('[name="result"]:checked');
        return { result: r ? '' : '결과를 고르세요.', memo: r && r.value === 'DIFF' && !val(f, 'memo') ? '맞지 않는 것과 한 일을 적으세요.' : '' };
      },
      done: function (f) {
        C.pushDemo('sealRecon', { month: ym, at: C.nowStamp().slice(0, 16), by: me.id, dept: me.dept || '', result: f.querySelector('[name="result"]:checked').value,
          memo: val(f, 'memo'), seen: { n: sealed.length, keys: keys } });
        refresh();
        C.toast(monthLabel(ym) + ' 인장 기록 대조를 남겼습니다.');
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
        '<td class="num">' + ((r.seen || {}).n || 0) + '건</td><td class="col-text">' + (r.memo ? esc(r.memo) : '<span class="recon-none">-</span>') + '</td>' +
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
    if (m) { sel = m.getAttribute('data-month'); refresh(); $('#sec-detail').scrollIntoView({ block: 'start' }); return; }
    if (e.target.closest('#btn-confirm')) { openConfirm(); return; }
    const pg = e.target.closest('#log-pages [data-page]');
    if (pg && !pg.disabled) { page = Number(pg.getAttribute('data-page')); renderLog(); }
  });
  refresh();
})();
