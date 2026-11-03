/* =====================================================================
 * SCR-61 할인 예외 점검 화면 로직 (discount-review.js)
 * ---------------------------------------------------------------------
 * 기획자 결정 2026-11-02 C-9(G-14, 05 4장 11번): 승인된 할인 예외를 매월 재무 임원(CFO)이 다시 봄. 기한은 다음 달 말일, 기록은 쌓기만 함
 *   재무 임원은 결재 단계를 맡지 않아 ③ 승인과 떨어져 있음. E-3(A안)으로 할인 폭이 큰 계약은 ③에서 영업 임원도 승인하므로 그 승인도 함께 봄
 * 볼 수 있는 사람: 재무 임원(C.checkOwners('SCR-61')), 최고관리자(시연용), 감사 열람(보기만)
 * 남길 수 있는지: C.canDoCheck(me, 'SCR-61'). 읽기만 하는 역할(감사 열람, 끝난 역할)은 false라 단추와 관리 칸을 그리지 않음
 * 하는 일
 *   1. 매월 점검: 이 시스템을 쓰기 시작한 달(D.SERVICE_START_MONTH)부터 이달까지. 기한(다음 달 말일), 줄 수, 확인한 줄, 상태
 *      기한이 지나도 마치지 않았으면 줄을 강조. 대상 월을 누르면 아래에 그달 점검(주소 ?month=2026-09, 처음에는 지난달)
 *   2. 그달 점검
 *      가. ③ 가격 예외: 그달 ③ 영업 검토에서 할인 예외 승인을 마친 계약(아래 priceApprovals)
 *          계약번호, 고객사, 계약 방식, 영업(유닛), 할인율(가장 큰 줄과 계약 전체), ③ 승인자와 일시, 대리 결재
 *      나. ⑩ 재무 확인이 늦거나 끝나지 않은 계약: 체크리스트 4번이 예인 계약과 해지 기안(아래 finRows)
 *      한계값: 점검자가 그달마다 정함("가장 큰 줄 할인율 n% 이상은 의견 필수"). 줄 확인을 하나라도 남기면 더 바꾸지 않음
 *      줄마다 의견(한계값을 넘으면 필수, 그 밖에는 선택)과 확인. 모든 줄을 확인하면 "점검 마침"
 *      달이 끝난 뒤에만 남김(이달은 지금까지의 목록만 보임)
 *   3. 점검 기록: 한계값 정함, 줄 확인, 점검 마침. 쌓기만 하고 고치거나 지우지 않음(누가, 언제, 그때 조직)
 * 기록: D.DISCOUNT_REVIEWS(예시) + 시연 기록(C.pushDemo 'discountReviews', 이 브라우저에만). 실제 시스템은 서버의 점검 기록
 *   기록의 칸은 mock-data.js DISCOUNT_REVIEWS 주석
 * 최고관리자(시연)는 자기 작업이 든 줄(기안했거나 ③, ⑩을 처리함)을 확인하지 못하고, 그런 줄이 있으면 점검 마침도 남기지 않음(C-6)
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const SCR = 'SCR-61';
  if (!C.gate(me, C.checkOwners(SCR).concat(['AUDIT']), '할인 예외 점검은 재무 임원이 씁니다',
    '지금은 ' + esc(C.roleLabel(me.role)) + ' 역할로 보고 있습니다. 화면 맨 위 검은 띠에서 재무 임원, 감사 열람, 최고관리자 가운데 하나로 바꾸면 볼 수 있습니다.')) return;

  const canDo = C.canDoCheck(me, SCR); // 재무 임원, 최고관리자(시연). 감사 열람은 보기만
  const PAGE_SIZE = 20;                // 점검 기록 한 쪽 (REQ-ADM-04)
  const START_MONTH = D.SERVICE_START_MONTH;
  const THIS_MONTH = D.TODAY.slice(0, 7);
  // ⑩이 늦은 기준: 결재 대기 독촉 일수(결재선 규칙에서 바꿈, 지금 5일). 차례가 온 날부터 처리한 날(아직이면 오늘)까지 [가정]
  const LATE_DAYS = D.ALERT_RULES.approvalDelayDays;
  const PART = { DISC: '③ 가격 예외', FIN: '⑩ 재무 확인' };
  const TYPE = { LIMIT: '한계값 정함', ROW: '줄 확인', DONE: '점검 마침' };

  function pad(n) { return String(n).padStart(2, '0'); }
  // 'YYYY-MM'에 n달을 더함
  function shiftMonth(ym, n) {
    const t = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1 + n;
    return Math.floor(t / 12) + '-' + pad(t % 12 + 1);
  }
  function lastDay(ym) { return ym + '-' + pad(new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate()); }
  function monthLabel(ym) { return ym.slice(0, 4) + '년 ' + Number(ym.slice(5, 7)) + '월'; }
  function dueOf(ym) { return lastDay(shiftMonth(ym, 1)); } // 기한: 다음 달 말일
  function pctNum(r) { return Math.round(r * 1000) / 10; }
  function pct(r) { return pctNum(r) + '%'; }
  function dayDiff(a, b) { return C.daysBetween(new Date(String(a).slice(0, 10)), new Date(String(b).slice(0, 10))); }
  function months() {
    const out = [];
    for (let ym = START_MONTH; ym <= THIS_MONTH; ym = shiftMonth(ym, 1)) out.push(ym);
    return out.reverse(); // 최근 달부터
  }
  // 고른 달: 주소의 ?month=, 없으면 지난달(이 시스템을 쓰기 시작한 달 전이면 이달)
  const MONTHS = months();
  const LAST_MONTH = shiftMonth(THIS_MONTH, -1);
  let sel = new URLSearchParams(location.search).get('month');
  if (MONTHS.indexOf(sel) < 0) sel = MONTHS.indexOf(LAST_MONTH) > -1 ? LAST_MONTH : THIS_MONTH;

  /* ---------- 목록 만들기 ---------- */
  // 할인율: 기안한 날의 가격 기준으로 셈(③이 결재 문서에서 본 할인율, C.capOver와 같은 기준)
  //   기획자 결정 2026-11-02 E-4: 기안 때 줄에 남긴 표준 단가와 한도(line.listPrice, line.cap)를 먼저, 없으면 그날 가격 줄(C.pricesAt.
  //   그날 줄이 없으면 그 기능의 첫 줄). 예전에는 오늘 가격으로 채워 E-4 뒤 한도가 0%인 줄이 생겼음
  //   top: 할인율이 가장 큰 줄 { d, cap }, all: 계약 전체(표준 금액 합계 대비). 제품 줄이 없으면 null
  function discountOf(c) {
    const price = C.pricesAt(String(c.requestedAt || D.TODAY).slice(0, 10));
    let top = null, std = 0, amt = 0;
    (c.products || (c.form && c.form.products) || []).forEach(function (r) {
      const p = price[r.feature];
      const list = r.listPrice != null ? Number(r.listPrice) : p ? p.listPrice : 0;
      const s = list * (Number(r.qty) || 0), a = Number(r.amount) || 0;
      if (!s) return;
      std += s; amt += a;
      const d = (s - a) / s;
      if (!top || d > top.d) top = { d: d, cap: r.cap != null ? Number(r.cap) : p ? p.discountCap || 0 : 0 };
    });
    return top ? { top: top, all: (std - amt) / std } : null;
  }
  /* 이 계약이 ③ 가격 예외 승인을 마친 차수들 [{ c, round, s03, s03c, at }]
   *   신규, 변경, 바꿔서 연장만(운영 변경과 해지, 그대로 연장의 ③은 가격 예외가 아님). 이런 계약은 체크리스트 2, 3번이 아니요일 때만 ③을 거침
   *   차수마다 결재 기록을 차례로 봄: ③ 승인(승인 취소되면 없던 것으로), 영업 임원 승인을 거치면 그것까지. ③이나 영업 임원이 반려하면 넣지 않음
   *   고쳐서 처음부터 다시 결재하면(보완 완료 restart) 앞의 승인은 없던 것으로. 마친 때(at)는 마지막 승인 일시
   *   지금 차수의 영업 임원 승인은 결재란(approvals)을 따름("한 번만 받음"으로 생략되면 ③만). 앞 차수는 기록에 있으면 거친 것으로 봄
   *   ③ 뒤에 ④나 ⑧에서 반려되어도 그 차수의 할인 승인은 있었던 것이라 넣음 [가정] */
  function priceApprovals(c) {
    if (!c.id || c.status === 'DRAFT' || C.isChange(c) || C.isShort(c)) return [];
    const byRound = {};
    (c.history || []).forEach(function (h) { const r = h.round || 1; (byRound[r] = byRound[r] || []).push(h); });
    const cur = c.round || 1;
    const curC = (c.approvals || []).filter(function (a) { return a.step === 'S03C'; })[0];
    return Object.keys(byRound).map(Number).map(function (r) {
      let s03 = null, s03c = null, seenC = false, rej = false;
      byRound[r].forEach(function (h) {
        if (h.action === 'RESUBMIT' && h.restart) { s03 = null; s03c = null; seenC = false; rej = false; return; }
        if (h.step !== 'S03' && h.step !== 'S03C') return;
        if (h.step === 'S03C') seenC = true;
        if (h.action === 'REJECT') rej = true;
        else if (h.action === 'APPROVE' || h.action === 'CANCEL') {
          const v = h.action === 'APPROVE' ? h : null;
          if (h.step === 'S03') s03 = v; else s03c = v;
        }
      });
      const needC = r === cur ? !!curC && curC.state !== 'SKIPPED' : seenC;
      if (!s03 || rej || (needC && !s03c)) return null;
      return { c: c, round: r, s03: s03, s03c: needC ? s03c : null, at: needC ? s03c.at : s03.at };
    }).filter(Boolean);
  }
  // 가. 그달 ③ 가격 예외 승인을 마친 줄 (마친 때 순서)
  function discRows(ym) {
    const out = [];
    D.CONTRACTS.forEach(function (c) {
      priceApprovals(c).forEach(function (x) { if (String(x.at).slice(0, 7) === ym) out.push(x); });
    });
    return out.sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); }).map(function (x) {
      return Object.assign(x, { key: 'DISC:' + x.c.id + '#' + x.round, part: 'DISC', disc: discountOf(x.c) });
    });
  }
  /* 나. ⑩ 재무 확인이 늦거나 끝나지 않은 줄: 체크리스트 4번이 예인 계약과 해지 기안 (지금 차수의 ⑩)
   *   그달의 것: ⑩ 차례가 그달에 왔거나, 그 앞에 와서 그달 말까지 끝나지 않은 것(끝날 때까지 달마다 다시 보임)
   *   늦음: 차례가 온 날부터 처리한 날까지 LATE_DAYS일을 넘김 / 끝나지 않음: 아직 처리 전(오늘까지 센 날을 보임)
   *   ⑩ 차례가 아직 오지 않은 해지(⑨ 운영 종료 전)는 넣지 않음 [가정: ⑩이 늦은 것을 보는 줄이라] */
  function finRows(ym) {
    const from = ym + '-01', to = lastDay(ym), out = [];
    D.CONTRACTS.forEach(function (c) {
      if (!c.id || c.status === 'DRAFT') return;
      const term = c.kind === 'TERMINATE', acct = !!c.checklist && c.checklist.accounting === 'YES';
      if (!term && !acct) return;
      const a = (c.approvals || []).filter(function (x) { return x.step === 'S10'; })[0];
      if (!a || a.state === 'SKIPPED' || !a.arrivedAt) return;
      const arr = String(a.arrivedAt).slice(0, 10), dec = a.state === 'DONE' && a.decidedAt ? String(a.decidedAt).slice(0, 10) : '';
      if (!(arr.slice(0, 7) === ym || (arr < from && (!dec || dec > to)))) return;
      const days = dayDiff(arr, dec || D.TODAY);
      if (dec && days <= LATE_DAYS) return;
      out.push({ c: c, a: a, key: 'FIN:' + c.id + '#' + (c.round || 1), part: 'FIN', arr: arr, dec: dec, days: days, term: term });
    });
    return out.sort(function (x, y) { return x.arr.localeCompare(y.arr) || String(x.c.id).localeCompare(String(y.c.id)); });
  }

  /* ---------- 점검 기록 (쌓기만 함) ---------- */
  function allRecs() {
    return (D.DISCOUNT_REVIEWS || []).concat(C.loadDemo('discountReviews'))
      .slice().sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
  }
  // 읽기만 하는 역할은 남기지 않음(단추를 그리지 않는 것과 겹으로 막음)
  function save(rec) {
    if (!canDo) return false;
    C.pushDemo('discountReviews', Object.assign({ month: sel }, rec, { at: C.nowStamp().slice(0, 16), by: me.id, dept: (D.USERS[me.id] || {}).dept || '' }));
    return true;
  }
  // 그달의 목록과 기록을 한데 모음
  //   got: 줄마다 남긴 확인(되돌릴 수 없어 하나뿐), limit: 마지막으로 정한 한계값, locked: 줄 확인이 하나라도 있어 한계값을 더 바꾸지 않음
  function stateOf(ym) {
    const recs = allRecs().filter(function (r) { return r.month === ym; });
    const limits = recs.filter(function (r) { return r.type === 'LIMIT'; });
    const rowRecs = recs.filter(function (r) { return r.type === 'ROW'; });
    const got = {};
    rowRecs.forEach(function (r) { if (!got[r.key]) got[r.key] = r; });
    const disc = discRows(ym), fin = finRows(ym), rows = disc.concat(fin);
    const st = { ym: ym, ended: ym < THIS_MONTH, due: dueOf(ym), disc: disc, fin: fin, rows: rows, got: got,
      limit: limits.length ? limits[limits.length - 1] : null, locked: rowRecs.length > 0,
      done: recs.filter(function (r) { return r.type === 'DONE'; })[0] || null };
    st.confirmed = rows.filter(function (x) { return got[x.key]; }).length;
    st.late = st.ended && !st.done && D.TODAY > st.due;
    return st;
  }
  // 한계값을 넘는 줄(의견 필수): 가장 큰 줄 할인율(화면에 보이는 소수 한 자리)이 한계값 이상. 제품 줄이 없어 셀 수 없으면 의견 필수 [가정]
  function isOver(x, st) { return x.part === 'DISC' && (!x.disc || (!!st.limit && pctNum(x.disc.top.d) >= st.limit.limit)); }
  // 내 작업이 든 줄(기획자 결정 2026-11-02 C-6): 기안했거나 ③, ⑩을 처리했거나 내 대신 처리된 줄. 최고관리자 시연에서만 생김
  function mine(x) {
    const ids = x.part === 'DISC' ? [x.c.requesterId, x.s03.actorId, x.s03.onBehalfOf, x.s03c && x.s03c.actorId, x.s03c && x.s03c.onBehalfOf]
      : [x.c.requesterId, x.a.decidedBy, x.a.onBehalfOf];
    return ids.indexOf(me.id) > -1;
  }
  function canRow(x, st) { return canDo && st.ended && !st.got[x.key] && !mine(x) && (x.part !== 'DISC' || !!st.limit); }
  function canLimit(st) { return canDo && st.ended && !st.done && !st.locked && st.disc.length > 0; }
  function canFinish(st) { return canDo && st.ended && !st.done && st.confirmed === st.rows.length && !st.rows.some(mine); }
  function sigOf(st) { return st.rows.map(function (x) { return x.key; }).sort().join(','); }
  function statusBadge(st) {
    if (!st.ended) return C.badge('line', '이달이 끝난 뒤');
    if (st.done) return C.badge('success', '점검 마침');
    if (st.late) return C.badge('danger', '기한 지남');
    return C.badge('line', st.confirmed || st.limit ? '점검 중' : '점검 전');
  }

  /* ---------- 글 조각 ---------- */
  // ③ 승인 글: "③ 영업 리더 비즈니스1유닛 최민준 2026-09-03 10:30" (대신 처리했으면 누구 대신인지)
  function apprTexts(x) {
    return [['S03', x.s03], ['S03C', x.s03c]].filter(function (p) { return p[1]; }).map(function (p) {
      const h = p[1];
      return C.stepTag(p[0], x.c) + ' ' + C.ownerLabel(h.actorId, h.actorDept) + ' ' + C.fmtDateTime(h.at) +
        (h.onBehalfOf ? '(' + C.ownerLabel(h.onBehalfOf) + ' 대신, ' + (h.delegationId ? '대리 지정' : '시연') + ')' : '');
    });
  }
  // 확인 때 본 내용(기록에 함께 남김). 고객사 이름은 넣지 않음(열람 제한 계약도 같은 모양)
  function seenOf(x) {
    if (x.part === 'DISC') {
      const d = x.disc;
      return (d ? '가장 큰 줄 ' + pct(d.top.d) + '(한도 ' + pct(d.top.cap) + '), 계약 전체 ' + pct(d.all) : '제품 줄 없음') + ', ' + apprTexts(x).join(', ');
    }
    return (x.term ? '해지' : '4번 예') + ', ⑩ 차례 ' + C.fmtDate(x.arr) + ', ' + (x.dec ? '처리 ' + C.fmtDate(x.dec) : '아직 처리 전') + ', ' + x.days + '일';
  }
  function doneSeenText(v) {
    return '③ 가격 예외 ' + v.disc + '건(한계값 넘음 ' + v.over + '건), ⑩ 늦음 ' + v.fin + '건' + (v.limit != null ? ', 한계값 ' + v.limit + '%' : '');
  }
  function rowTitle(x) { return x.c.id + ' ' + (C.canView(x.c, me) ? x.c.counterparty : '열람 제한 계약') + ', ' + PART[x.part]; }

  /* ---------- 표 칸 ---------- */
  // 계약 칸: 고객사(결재 문서로), 계약번호, 계약 방식
  //   기획자 결정 2026-11-02 C-9: 재무 임원은 열람 제한 계약을 4번이 예일 때만 봄(REQ-CHK-08). 이 점검에는 볼 수 없는 계약도 넣되
  //   고객사와 결재 문서 링크, 할인 사유를 가리고 점검에 필요한 칸(계약번호, 계약 방식, 영업, 할인율, ③ 승인)만 보임 [가정: 시안이 정함]
  //   extra: 칸 아래에 덧붙일 줄(예: 반려된 차수)
  function contractCell(c, withNote, extra) {
    const method = esc(D.METHODS[C.methodOf(c)] || '-');
    if (!C.canView(c, me)) {
      return '<td><span class="cell-title is-masked">' + C.icon('lock', 'sm') + '열람 제한 계약</span><span class="cell-meta">' + esc(c.id) + ', ' + method + '</span>' + (extra || '') + '</td>';
    }
    const note = withNote && c.checklist && c.checklist.capNote ? '<span class="cell-meta">할인 사유: ' + esc(c.checklist.capNote) + '</span>' : '';
    return '<td><a class="cell-title" href="review.html?id=' + encodeURIComponent(c.id) + '">' + esc(c.counterparty) + '</a>' +
      '<span class="cell-meta">' + esc(c.id) + (c.restricted ? ' ' + C.icon('lock', 'sm') : '') + ', ' + method + '</span>' + note + (extra || '') + '</td>';
  }
  function apprCell(x) {
    return '<td>' + [['S03', x.s03], ['S03C', x.s03c]].filter(function (p) { return p[1]; }).map(function (p) {
      return '<span class="dr-line"><span class="dr-step">' + esc(C.stepTag(p[0], x.c)) + '</span> ' + esc(C.ownerLabel(p[1].actorId, p[1].actorDept)) + '</span>' +
        '<span class="cell-meta">' + C.fmtDateTime(p[1].at) + '</span>';
    }).join('') + '</td>';
  }
  // 대리 결재: 대리 지정으로 대신 처리했으면 누구 대신인지. 최고관리자가 시연으로 대신 누른 것은 "시연"
  function behalfCell(x) {
    const hs = [x.s03, x.s03c].filter(function (h) { return h && h.onBehalfOf; });
    if (!hs.length) return '<td class="center">아니요</td>';
    return '<td class="center">' + C.badge('attention', '대리 결재') + hs.map(function (h) {
      return '<span class="cell-meta">' + esc(C.ownerLabel(h.onBehalfOf)) + ' 대신, ' + (h.delegationId ? '대리 지정' : '시연') + '</span>';
    }).join('') + '</td>';
  }
  function checkCell(x, st) {
    const r = st.got[x.key];
    if (r) {
      return '<td>' + C.badge('success', '확인함') + '<span class="cell-meta">' + esc(C.ownerLabel(r.by, r.dept)) + ', ' + C.fmtDateTime(r.at) + '</span>' +
        (r.opinion ? '<span class="dr-opinion">' + esc(r.opinion) + '</span>' : '<span class="cell-meta">의견 없음</span>') + '</td>';
    }
    return '<td>' + C.badge('line', '확인 전') + (canDo && mine(x) ? '<span class="cell-meta">내 작업이 든 줄이라 다른 사람이 확인합니다</span>' : '') + '</td>';
  }
  // 관리 칸: 남길 수 있는 사람에게만 칸을 둠(읽기만 하는 역할은 칸 자체가 없음)
  function actCell(x, st) {
    if (!canDo) return '';
    return '<td class="col-action">' + (canRow(x, st) ? '<button type="button" class="link-act" data-row="' + esc(x.key) + '">확인 남기기</button>' : '-') + '</td>';
  }
  function discRowHtml(x, st) {
    const d = x.disc, cur = x.c.round || 1;
    // ③ 승인 뒤 ④나 ⑧에서 반려된 차수(지금 반려 상태이거나 다시 기안해 다음 차수가 있음). 할인 승인은 있었으므로 줄은 그대로 둠
    const rej = x.round < cur || x.c.status === 'REJECTED';
    return '<tr>' + contractCell(x.c, true, rej ? '<span class="cell-meta">' + C.badge('neutral', '반려') + ' 승인 뒤 반려된 차수</span>' : '') +
      '<td class="center cell-phone-nowrap">' + esc(C.ownerLabel(x.c.requesterId)) + '</td>' +
      (d ? '<td class="num">' + pct(d.top.d) + '<span class="cell-meta">한도 ' + pct(d.top.cap) + '</span>' +
          (st.limit && isOver(x, st) ? '<span class="cell-meta">' + C.badge('attention', '한계값 넘음') + '</span>' : '') + '</td>' +
          '<td class="num">' + pct(d.all) + '</td>'
        : '<td class="num">-<span class="cell-meta">제품 줄 없음</span></td><td class="num">-</td>') +
      apprCell(x) + behalfCell(x) + checkCell(x, st) + actCell(x, st) + '</tr>';
  }
  function finRowHtml(x, st) {
    const ck = x.c.checklist || {};
    const kinds = (ck.acctKinds || []).map(function (k) { return (D.ACCT_KINDS.filter(function (a) { return a.code === k; })[0] || { label: k }).label; }).join(', ');
    return '<tr>' + contractCell(x.c, false) +
      '<td class="nowrap">' + (x.term ? '해지' : '4번 예') + (!x.term && kinds ? '<span class="cell-meta">' + esc(kinds) + '</span>' : '') + '</td>' +
      '<td class="num-left">' + C.fmtDate(x.arr) + '<span class="cell-meta">' + esc(C.ownerLabel(x.a.userId)) + ' 차례</span></td>' +
      '<td class="num-left">' + (x.dec ? C.fmtDate(x.dec) : '아직') + '</td>' +
      '<td class="num">' + x.days + '일<span class="cell-meta">' + (x.dec ? C.badge('attention', '늦음') : C.badge('danger', '끝나지 않음')) + '</span></td>' +
      checkCell(x, st) + actCell(x, st) + '</tr>';
  }

  /* ---------- 1. 매월 점검 ---------- */
  function renderMonths() {
    $('#month-rows').innerHTML = MONTHS.map(function (ym) {
      const st = stateOf(ym), on = ym === sel;
      const after = st.done ? st.rows.length - st.confirmed : 0; // 마친 뒤 목록에 더해진 줄
      return '<tr' + (st.late ? ' class="is-alert"' : '') + '>' +
        '<td class="nowrap"><a class="cell-title" href="?month=' + ym + '" data-month="' + ym + '"' + (on ? ' aria-current="true"' : '') + '>' + monthLabel(ym) + '</a>' +
          (on ? '<span class="cell-meta">아래에 보는 중</span>' : '') + '</td>' +
        '<td class="num-left nowrap">' + C.fmtDate(st.due) + '</td>' +
        '<td class="num">' + st.disc.length + '건</td><td class="num">' + st.fin.length + '건</td>' +
        '<td class="num">' + st.confirmed + '/' + st.rows.length + '건</td>' +
        '<td class="nowrap">' + statusBadge(st) +
          (st.done ? '<span class="cell-meta">' + esc(C.ownerLabel(st.done.by, st.done.dept)) + ', ' + C.fmtDateTime(st.done.at) + '</span>' : '') +
          (after ? '<span class="cell-meta">마친 뒤 더해진 줄 ' + after + '건</span>' : '') + '</td></tr>';
    }).join('');
  }

  /* ---------- 2. 그달 점검 ---------- */
  const DISC_DESC = $('#disc-desc').textContent;
  function renderLimit(st) {
    let text;
    if (!st.disc.length) text = '<p>' + (st.ended ? '그달 ③ 가격 예외가 없어 한계값을 정하지 않습니다.' : '이달이 끝나면 그달 ③ 가격 예외를 보고 한계값을 정합니다.') + '</p>';
    else if (st.limit) {
      text = C.meta([['한계값', '가장 큰 줄 할인율 ' + esc(String(st.limit.limit)) + '% 이상은 의견 필수'], ['정한 사람', esc(C.ownerLabel(st.limit.by, st.limit.dept))],
        ['일시', esc(C.fmtDateTime(st.limit.at))]]) + (st.locked ? '<p>줄 확인을 남긴 뒤라 바꿀 수 없습니다.</p>' : '');
    } else {
      text = '<p>아직 그달 한계값을 정하지 않았습니다. ' + (!canDo ? '한계값은 재무 임원이 정합니다.'
        : st.ended ? '한계값을 먼저 정한 뒤 ③ 가격 예외 줄마다 확인을 남깁니다.' : '이달이 끝난 뒤에 정합니다.') + '</p>';
    }
    const btn = canLimit(st) ? '<button type="button" class="btn btn--secondary btn--md" id="btn-limit">' + (st.limit ? '한계값 바꾸기' : '한계값 정하기') + '</button>' : '';
    $('#limit-box').innerHTML = '<div class="dr-box-text">' + text + '</div>' + btn;
  }
  function renderDone(st) {
    let text, btn = '';
    if (st.done) {
      const changed = !!st.done.seen && st.done.seen.sig !== sigOf(st);
      const after = st.rows.length - st.confirmed;
      text = C.meta([C.badge('success', '점검 마침'), ['마친 사람', esc(C.ownerLabel(st.done.by, st.done.dept))], ['일시', esc(C.fmtDateTime(st.done.at))],
          changed ? C.badge('attention', '마친 뒤 바뀜') : null]) +
        '<p><span class="meta-key">메모</span> <span class="meta-val">' + (st.done.memo ? esc(st.done.memo) : '없음') + '</span></p>' +
        (after ? '<p>마친 뒤 목록에 더해진 줄 ' + after + '건은 줄마다 확인을 남깁니다.</p>' : '') +
        (st.done.seen ? '<details class="seen-data"><summary>마칠 때 본 건수</summary><p class="cell-meta">' + esc(doneSeenText(st.done.seen)) + '</p></details>' : '');
    } else if (!st.ended) {
      text = '<p>이달이 끝난 뒤 다음 달 말일(' + C.fmtDate(st.due) + ')까지 점검을 마칩니다.</p>';
    } else {
      const left = st.rows.length - st.confirmed;
      text = '<p>' + (left ? '확인 전인 줄이 ' + left + '건 있습니다. 모든 줄을 확인하면 점검을 마칩니다.'
          : st.rows.length ? '모든 줄을 확인했습니다. 점검 마침을 남깁니다.' : '그달 점검할 줄이 없습니다. 없음을 보고 점검 마침을 남깁니다.') +
        (st.late ? ' 기한(' + C.fmtDate(st.due) + ')이 지났습니다.' : ' 기한은 ' + C.fmtDate(st.due) + '입니다.') + '</p>' +
        (canDo && st.rows.some(mine) ? '<p>내 작업이 든 줄이 있어 점검 마침은 다른 사람이 남깁니다(최고관리자는 자기 작업이 든 점검을 승인하지 않음).</p>' : '') +
        (!canDo ? '<p>점검 마침은 재무 임원이 남깁니다.</p>' : '');
      // 남길 수 있는 사람에게는 단추를 늘 같은 자리에 둠(마칠 수 없으면 눌리지 않음)
      if (canDo) btn = '<button type="button" class="btn btn--primary btn--md" id="btn-done"' + (canFinish(st) ? '' : ' disabled') + '>점검 마침</button>';
    }
    $('#done-box').innerHTML = '<div class="dr-box-text">' + text + '</div>' + btn;
  }
  function renderMonth() {
    const st = stateOf(sel);
    $('#app-title').textContent = monthLabel(sel) + ' 점검';
    $('#month-sum').innerHTML = C.meta([statusBadge(st), ['기한', C.fmtDate(st.due)], ['③ 가격 예외', st.disc.length + '건'], ['⑩ 늦음', st.fin.length + '건'],
      ['확인', st.confirmed + '/' + st.rows.length + '건']]);
    renderLimit(st);
    const masked = st.disc.filter(function (x) { return !C.canView(x.c, me); }).length;
    $('#disc-desc').textContent = DISC_DESC + (st.ended ? '' : ' 이달은 지금까지 마친 계약만 보이고, 달이 끝난 뒤에 확인을 남깁니다.') +
      (masked ? ' 볼 수 없는 열람 제한 계약 ' + masked + '건은 고객사와 할인 사유를 가리고 점검에 필요한 칸만 보입니다.' : '');
    const cols = canDo ? 8 : 7;
    $('#disc-rows').innerHTML = st.disc.length ? st.disc.map(function (x) { return discRowHtml(x, st); }).join('')
      : '<tr><td class="empty-row" colspan="' + cols + '">' + (st.ended ? '그달' : '이달 지금까지') + ' ③에서 할인 예외 승인을 마친 계약이 없습니다.</td></tr>';
    $('#fin-desc').textContent = '체크리스트 4번이 예인 계약과 해지 기안 가운데 그달 ⑩ 재무 확인 차례였던 것 중, 아직 끝나지 않았거나 ' + LATE_DAYS +
      '일 넘게 걸린 계약입니다. 날 수 기준은 결재선 규칙의 결재 대기 독촉 일수이고, 의견은 골라서 적습니다.' +
      (st.fin.some(function (x) { return !C.canView(x.c, me); }) ? ' 볼 수 없는 열람 제한 계약은 고객사를 가립니다.' : '');
    $('#fin-rows').innerHTML = st.fin.length ? st.fin.map(function (x) { return finRowHtml(x, st); }).join('')
      : '<tr><td class="empty-row" colspan="' + (cols - 1) + '">' + (st.ended ? '그달' : '이달 지금까지') + ' ⑩ 재무 확인이 늦거나 끝나지 않은 계약이 없습니다.</td></tr>';
    renderDone(st);
  }

  /* ---------- 3. 점검 기록 ---------- */
  let page = 1;
  // 기록 내용: 줄 확인은 계약번호만 씀(고객사 이름을 기록 목록에 드러내지 않음)
  function recText(r) {
    if (r.type === 'LIMIT') return '가장 큰 줄 할인율 ' + esc(String(r.limit)) + '% 이상은 의견 필수' + (r.reason ? '<span class="cell-meta">바꾼 까닭: ' + esc(r.reason) + '</span>' : '');
    if (r.type === 'ROW') {
      return '<span class="dr-line">' + esc(r.contractId) + ' ' + esc(PART[r.part] || '') + (r.over ? ' ' + C.badge('attention', '의견 필수') : '') + '</span>' +
        (r.opinion ? '<span class="dr-opinion">' + esc(r.opinion) + '</span>' : '<span class="cell-meta">의견 없음</span>') +
        (r.seen ? '<details class="seen-data"><summary>확인 때 본 내용</summary><p class="cell-meta">' + esc(r.seen) + '</p></details>' : '');
    }
    return (r.memo ? '<span class="dr-opinion">' + esc(r.memo) + '</span>' : '<span class="cell-meta">메모 없음</span>') +
      (r.seen ? '<details class="seen-data"><summary>마칠 때 본 건수</summary><p class="cell-meta">' + esc(doneSeenText(r.seen)) + '</p></details>' : '');
  }
  function renderLog() {
    const list = allRecs().reverse(); // 최근 것부터
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (page > pages) page = pages;
    const from = (page - 1) * PAGE_SIZE, rows = list.slice(from, from + PAGE_SIZE);
    $('#log-count').innerHTML = C.meta([['전체', '<strong>' + list.length + '건</strong>'], '고치거나 지울 수 없음']);
    $('#log-rows').innerHTML = rows.length ? rows.map(function (r) {
      return '<tr><td class="num-left">' + C.fmtDateTime(r.at) + '</td><td class="nowrap">' + monthLabel(r.month) + '</td><td class="nowrap">' + esc(TYPE[r.type] || r.type) + '</td>' +
        '<td>' + recText(r) + '</td><td class="center cell-phone-nowrap">' + esc(C.ownerLabel(r.by, r.dept)) + '</td></tr>';
    }).join('') : '<tr><td class="empty-row" colspan="5">아직 남긴 기록이 없습니다.</td></tr>';
    $('#pagination').innerHTML = C.pagerHtml(page, pages, list.length, from, rows.length, PAGE_SIZE, '건');
  }

  function refresh() { renderMonths(); renderMonth(); renderLog(); }

  /* ---------- 남기는 창 (재무 임원, 최고관리자 시연) ---------- */
  // 한계값 정하기: 처음은 값만, 바꿀 때는 까닭도. 줄 확인을 하나라도 남기면 바꾸지 않음
  function openLimit() {
    const st = stateOf(sel);
    if (!canLimit(st)) return;
    const prev = st.limit;
    C.formModal({
      title: monthLabel(sel) + ' 한계값을 ' + (prev ? '바꿀까요?' : '정할까요?'),
      desc: '가장 큰 줄 할인율이 이 값 이상인 줄은 의견을 꼭 적습니다. 저장하면 정한 사람과 일시가 남고, 줄 확인을 하나라도 남기면 더 바꿀 수 없습니다.',
      body: (prev ? '<p class="modal-info">지금 한계값: 가장 큰 줄 할인율 ' + esc(String(prev.limit)) + '% 이상은 의견 필수</p>' : '') +
        C.fieldHtml({ name: 'limit', label: '한계값', required: true, unit: '%', value: prev ? prev.limit : '', attrs: ' inputmode="decimal"',
          help: '예: 25를 넣으면 할인율이 25% 이상인 줄은 의견이 필수입니다. 0보다 크고 100 이하, 소수는 한 자리까지 넣습니다.' }) +
        (prev ? C.fieldHtml({ name: 'reason', label: '바꾸는 까닭', type: 'textarea', required: true, placeholder: '예: 9월 예외가 많아 25%에서 20%로 낮춰 더 많이 봄' }) : ''),
      btn: '한계값 저장',
      check: function (f) {
        const v = f.elements.limit.value.trim();
        const ok = /^\d{1,3}(\.\d)?$/.test(v) && Number(v) > 0 && Number(v) <= 100;
        return {
          limit: !ok ? '0보다 크고 100 이하인 숫자를 넣으세요. 소수는 한 자리까지입니다.' : prev && Number(v) === prev.limit ? '지금 한계값과 같습니다.' : '',
          reason: prev && !f.elements.reason.value.trim() ? '바꾸는 까닭을 적으세요.' : '',
        };
      },
      done: function (f) {
        const v = Number(f.elements.limit.value.trim());
        if (save(Object.assign({ type: 'LIMIT', limit: v }, prev ? { reason: f.elements.reason.value.trim() } : null))) {
          refresh();
          C.toast(monthLabel(sel) + ' 한계값을 ' + v + '%로 정했습니다.');
        }
      },
    });
  }
  // 줄 확인: 한계값을 넘는 ③ 가격 예외 줄은 의견 필수, 그 밖에는 선택. 되돌릴 수 없음
  function openRow(key) {
    const st = stateOf(sel);
    const x = st.rows.filter(function (r) { return r.key === key; })[0];
    if (!x || !canRow(x, st)) return;
    const need = isOver(x, st);
    C.formModal({
      title: PART[x.part] + ' 줄을 확인할까요?',
      desc: '저장하면 확인한 사람과 일시, 의견, 지금 본 내용이 남고 고치거나 되돌릴 수 없습니다.',
      body: '<p class="modal-info">' + esc(rowTitle(x)) + '<br>' + esc(seenOf(x)) + '</p>' +
        C.fieldHtml({ name: 'opinion', label: need ? '의견' : '의견 (선택)', type: 'textarea', required: need,
          placeholder: x.part === 'DISC' ? '예: 첫 도입 조건과 레퍼런스 확보를 보면 할인 폭이 받아들일 만함. 같은 유닛의 다음 예외는 함께 봄'
            : '예: 결산 자료 준비로 늦음. 재무 리더에게 기한 안 처리를 다시 알림',
          help: need ? (x.disc ? '가장 큰 줄 할인율이 한계값(' + st.limit.limit + '%) 이상이라 의견을 꼭 적습니다.' : '제품 줄이 없어 할인율을 셀 수 없으므로 의견을 꼭 적습니다.') : '' }),
      btn: '확인 남기기',
      check: function (f) { return { opinion: need && !f.elements.opinion.value.trim() ? '의견을 적으세요.' : '' }; },
      done: function (f) {
        if (save({ type: 'ROW', key: x.key, contractId: x.c.id, part: x.part, over: need, limit: st.limit ? st.limit.limit : null,
          opinion: f.elements.opinion.value.trim(), seen: seenOf(x) })) {
          refresh();
          C.toast(x.c.id + ' ' + PART[x.part] + ' 줄 확인을 남겼습니다.');
        }
      },
    });
  }
  // 점검 마침: 모든 줄을 확인했을 때만. 마칠 때 본 건수와 줄 목록(sig)을 남겨, 나중에 목록이 바뀌면 "마친 뒤 바뀜"
  function openDone() {
    const st = stateOf(sel);
    if (!canFinish(st)) return;
    const seen = { disc: st.disc.length, fin: st.fin.length, over: st.disc.filter(function (x) { return isOver(x, st); }).length,
      limit: st.limit ? st.limit.limit : null, sig: sigOf(st) };
    C.formModal({
      title: monthLabel(sel) + ' 할인 예외 점검을 마칠까요?',
      desc: '저장하면 마친 사람과 일시, 메모, 지금 본 건수가 남고 고치거나 되돌릴 수 없습니다.',
      body: '<p class="modal-info">' + esc(doneSeenText(seen)) + '</p>' +
        C.fieldHtml({ name: 'memo', label: '메모 (선택)', type: 'textarea', placeholder: '예: 한계값을 넘은 2건은 영업 임원과 다음 달 가격 회의에서 함께 봄' }),
      btn: '점검 마침',
      done: function (f) {
        if (save({ type: 'DONE', memo: f.elements.memo.value.trim(), seen: seen })) {
          refresh();
          C.toast(monthLabel(sel) + ' 할인 예외 점검을 마쳤습니다.');
        }
      },
    });
  }

  /* ---------- 시작 ---------- */
  // 읽기만 하는 역할: 관리 칸을 빼고 안내 한 줄을 덧붙임(역할은 화면을 여는 동안 바뀌지 않아 자리가 흔들리지 않음)
  if (!canDo) {
    document.querySelectorAll('th[data-act-col]').forEach(function (th) { th.remove(); });
    $('#months-desc').textContent += ' 보기만 합니다. 한계값과 줄 확인, 점검 마침은 재무 임원이 남깁니다.';
  }
  // 대상 월 고르기: 주소를 바꾸고(새로 고쳐도 같은 달) 아래 그달 점검으로 포커스를 옮김
  function pick(ym) {
    sel = ym;
    try {
      const q = new URLSearchParams(location.search);
      q.set('month', ym);
      history.replaceState(null, '', '?' + q.toString());
    } catch (err) { /* 주소를 못 바꾸는 환경이면 화면만 바꿈 */ }
    renderMonths();
    renderMonth();
    $('#app-title').focus();
  }
  $('#content').addEventListener('click', function (e) {
    const a = e.target.closest('a[data-month]');
    if (a) { e.preventDefault(); pick(a.getAttribute('data-month')); return; }
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.hasAttribute('data-row')) openRow(b.getAttribute('data-row'));
    else if (b.id === 'btn-limit') openLimit();
    else if (b.id === 'btn-done') openDone();
    else if (b.getAttribute('data-page')) { page = Number(b.getAttribute('data-page')); renderLog(); $('#sec-log').scrollIntoView({ block: 'start' }); }
  });
  refresh();
})();
