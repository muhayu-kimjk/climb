/* =====================================================================
 * SCR-61 할인 예외 점검 화면 로직 (discount-review.js)
 * ---------------------------------------------------------------------
 * 기획자 결정 2026-11-02 C-9(G-14, 05 4장 11번): 승인된 할인 예외를 매월 재무 임원(CFO)이 다시 봄. 기한은 다음 달 말일, 기록은 쌓기만 함
 *   재무 임원은 결재 단계를 맡지 않아 ③ 승인과 떨어져 있음. E-3(A안)으로 할인 폭이 큰 계약은 ③에서 영업 임원도 승인하므로 그 승인도 함께 봄
 * 볼 수 있는 사람: 재무 임원(C.checkOwners('SCR-61')), 최고관리자(시연용), 감사 열람(보기만), 컴플라이언스(보기만)
 *   기획자 결정 2026-11-10 16번: 컴플라이언스도 감사 열람처럼 보기만 함. 넘어온 일("문제 있음" 줄)의 원래 기록을 바로 봄
 * 남길 수 있는지: C.canDoCheck(me, 'SCR-61')이면서 컴플라이언스가 아님. 읽기만 하는 역할(감사 열람, 끝난 역할)과 컴플라이언스는 false라
 *   단추와 관리 칸을 그리지 않고 "보기만 합니다" 안내를 덧붙임
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
 * 기획자 결정 2026-11-09 5회차 13번: 줄 확인 창에 "문제 있음"을 두고, 고르면 의견 필수. 저장하면 컴플라이언스에 넘김(control-checks.js X.raiseIssue)
 *   컴플라이언스 담당자의 개요 점검할 일에 올라가고 이메일이 감. 줄 기록에 issue(문제 있음), issueId(넘어온 일 번호)를 남김
 * 설계 검토 2026-11-11 3장: 그달 점검에 참고 줄 두 표(다. refRows). 한도를 넘은 유상 충전, 기안한 날 표준 금액과 다른 조건 그대로 연장
 *   보기만 하고 확인을 남기지 않음(결재 흐름과 점검 마침 조건은 그대로). 요약 줄에 건수, 점검 마침 기록에 그때 본 건수
 * (2026-11-14 주말 점검 W7) 참고 표를 넷으로: 셋째 "참고 금액보다 많이 줄인 변경"(그달 기안한 줄임 변경, control-checks.js X.shrinkRef),
 *   넷째 "운영 변경으로 늘린 계약 기간"(그달 계약 완료된 기간 늘림, 늘린 달 수와 같은 거래처의 최근 1년 늘림 횟수). 둘 다 보기만 함
 *   점검 마침 기록의 seen에 shrink, period 건수를 더함(앞 기록에는 없음)
 * (2026-11-14 주말 점검, 코드 다시 보기 common-02) 참고 표 넷에서 볼 수 없는 열람 제한 계약은 고객사와 함께 금액과 계약 기간도 가림(01 REQ-AUTH-09, SCR-61 규칙). 비율만 남김
 * (2026-11-14 주말 점검, 코드 다시 보기 review-01) 셋째 참고 표는 기능마다 합친 값(X.shrinkRef feats, flag)으로 봄: 결재 문서 "변경 전과 후"의 배지와 같은 기준 [가정]
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const SCR = 'SCR-61';
  // 문: 맡은 사람, 감사 열람, 컴플라이언스(보기만, 기획자 결정 2026-11-10 16번)
  if (!C.gate(me, C.checkOwners(SCR).concat(['AUDIT', 'COMPLIANCE']), '할인 예외 점검은 재무 임원이 씁니다',
    '지금은 ' + esc(C.roleLabel(me.role)) + ' 역할로 보고 있습니다. 화면 맨 위 검은 띠에서 재무 임원, 감사 열람, 컴플라이언스, 최고관리자 가운데 하나로 바꾸면 볼 수 있습니다.')) return;

  // 재무 임원, 최고관리자(시연). 감사 열람과 컴플라이언스는 보기만(기획자 결정 2026-11-10 16번)
  const canDo = C.canDoCheck(me, SCR) && !(me.role !== 'SUPER' && C.hasRole(me, ['COMPLIANCE']));
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
  //   (설계 검토 2026-11-11 4번, 4-1 3-1) 줄의 표준 금액은 공통 셈(C.contractStd: 기간제는 계약 기간 달 수에 비례, 고객사 티어 단가, 남긴 값을 먼저)
  //   (설계 검토 2026-11-11 남은 것 ⑧) tiers: 티어 단가로 셈한 줄의 티어 이름(겹치지 않게). 할인율 칸 아래에 "티어 1 단가로 셈"으로 보임
  function discountOf(c) {
    let top = null, std = 0, amt = 0;
    const tiers = [];
    // (2026-11-16 밤 코드 다시 보기 w7-02) ③을 거친 줄임(W7-3)은 기안 때 남긴 변경 뒤 할인율(reduceOver)로 셈(contractStd는 줄임을 셈하지 않음)
    if (c.reduceOver && c.reduceOver.over) {
      c.reduceOver.feats.forEach(function (f) {
        if (!f.std) return;
        std += f.std; amt += f.amountAfter;
        if (!top || f.discount > top.d) top = { d: f.discount, cap: f.cap };
      });
      return top ? { top: top, all: (std - amt) / std, tiers: tiers } : null;
    }
    C.contractStd(c).forEach(function (x) {
      const s = x.s ? x.s.std : 0, a = x.amount;
      if (!s) return;
      std += s; amt += a;
      if (x.s.tier && tiers.indexOf(C.tierLabel(x.s.tier)) < 0) tiers.push(C.tierLabel(x.s.tier));
      const d = (s - a) / s;
      if (!top || d > top.d) top = { d: d, cap: x.s.cap };
    });
    return top ? { top: top, all: (std - amt) / std, tiers: tiers } : null;
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
  /* 다. 참고 줄 (설계 검토 2026-11-11 3장): 한도를 넘은 유상 충전, 그날 표준 금액과 다른 조건 그대로 연장
   *   결재 흐름은 그대로(유상 충전은 ③이 없고, 그대로 연장의 ③은 가격 예외가 아님). 확인을 남기지 않는 참고 줄이고 건수만 셈
   *   그래서 점검 마침의 "모든 줄 확인"과 "마친 뒤 바뀜"(sigOf)에 들지 않음. 점검 마침에는 그때 본 참고 건수를 함께 남김(seen.paid, seen.renew) [가정]
   *   그달 것: 기안한 달(임시 저장은 빼고, 진행 중과 반려도 넣고 상태를 보임) [가정: ③ 승인이 없어 가격이 정해진 기안한 달로 넣음]
   *   기안 때 남긴 값을 먼저 씀(통계 lineStd, 결재 문서 paidRows와 같은 규칙. 뒤에 가격 기준이 바뀌어도 그때 값으로 견줌)
   *     유상 충전: 남긴 표준 단가와 단위(changeListPrice, changePriceUnit), 없으면 기안한 날 가격 줄. 단위 종류가 건당일 때만 견줌(결재 문서와 같음, 설계 검토 2026-11-11 남은 것 ⑧)
   *       한도: 남긴 적용 시작일(changePriceFrom)의 그 기능 가격 줄의 한도, 없으면 기안한 날 가격 줄 [가정: 유상 충전 기록에는 한도를 남기지 않음]
   *       넘었는지: 할인율 - 한도를 C.capOver와 같게 %p 소수 둘째 자리로 반올림해 0보다 큼
   *     그대로 연장: 기안할 때 남긴 그날 표준 금액(stdAmount, renewal.js), 없으면(예시 기록) 기안한 날 가격 기준으로 C.renewStd. 계약 금액과 다르면 넣음 */
  //   (설계 검토 2026-11-11 남은 것 ⑧) 건당인지는 단위 글자(/^건/) 대신 단위 종류(C.unitKindOf가 PER_UNIT)로. 결재 문서(review.js paidRows)와 같은 규칙
  //     [가정] 남긴 적용 시작일의 가격 줄, 없으면 기안한 날 가격 줄의 종류. 그 줄의 단위가 남긴 단위와 다르거나 줄이 없으면 남긴 단위 글자로 정함
  //     티어 단가를 썼으면(changePriceTier) tier에 그 티어와 기본 단가를 담아 표준 금액 칸에 보임
  function paidOf(c) {
    // 가격 줄과 단위 종류는 C.paidPriceRef 하나로(결재 문서와 같은 셈, 2026-11-11 정리)
    const pref = C.paidPriceRef(c), p = pref.base, row = pref.row, ref = pref.ref;
    const list = c.changeListPrice != null ? Number(c.changeListPrice) : p ? p.listPrice : null;
    if (list == null || pref.kind !== 'PER_UNIT') return null;
    const cap = row ? row.discountCap || 0 : p ? p.discountCap || 0 : 0;
    const qty = Number(c.changeQty) || 0, std = list * qty;
    if (!std) return null;
    const d = (std - (Number(c.changeAmount) || 0)) / std;
    return { std: std, list: list, qty: qty, d: d, cap: cap, over: Math.round((d - cap) * 10000) / 100 > 0,
      tier: c.changePriceTier ? { code: c.changePriceTier, base: ref ? Number(ref.listPrice) : null } : null };
  }
  /* (2026-11-14 주말 점검 W7) 참고 표 둘을 더함(설계 검토 3장 원칙 "③을 거치지 않는 가격 차이는 참고 표로 봄"을 넓힘). 보기만 하고 확인은 남기지 않음
   *   셋째 shrink: 그달 기안한 줄임 변경 가운데 줄인 금액이 참고 금액(X.shrinkRef: 계약 단가 x 줄이는 수량 x 남은 달 수 / 그 기간 달 수)보다 큰 것
   *     줄임은 ③도 할인 계산도 거치지 않아(CTL-141) 남은 달 몫보다 많이 돌려주면 ③ 없는 사후 할인과 같음(내부회계 원칙 8, 16, ISO 37001 8.3)
   *     그달 것은 다른 참고 표처럼 기안한 달(임시 저장 빼고, 진행 중과 반려도 넣고 상태를 보임). 참고 금액을 셀 수 없는 줄임은 skip.shrink로 셈
   *     ③을 거칠지는 묶음 확인 6의 답을 따름(이 표는 막지 않음)
   *   넷째 period: 그달 계약 완료된 운영 변경(계약 기간 변경) 가운데 종료일을 늦춘 것. 늘린 달 수와 같은 거래처의 최근 1년 늘림 횟수
   *     운영 변경의 기간 늘림은 금액도 ③도 없이 ⑨, ⑩으로 끝나고, 2개월 한도의 기준(계약서의 종료일)이 연장마다 새로 잡혀 해마다 늘릴 수 있음(R-13, CTL-70)
   *     [가정] 그달 것: 계약 완료(⑩까지 마침, completedAt)한 달. 늘린 달 수: 전 종료일 다음 날부터 새 종료일까지(C.periodMonths, 남는 날은 한 달)
   *     [가정] 최근 1년 늘림: 같은 거래처(사업자등록번호, 없으면 원계약의 거래처나 상호)의 계약 완료된 기간 늘림 가운데 이 건의 계약 완료일부터 앞 12개월 안(이 건 포함) */
  //   거래처 열쇠: 계약의 거래처, 없으면 원계약의 거래처, 그것도 없으면 상호
  function custKey(c) {
    const root = c.parentId ? D.CONTRACTS.filter(function (x) { return x.id === c.parentId; })[0] : null;
    const cu = C.customerOfContract(c) || (root ? C.customerOfContract(root) : null);
    return cu ? 'C:' + cu.id : 'N:' + c.counterparty;
  }
  function isExtend(c) { return c.kind === 'CHANGE' && c.changeType === 'PERIOD' && !!c.completedAt && !!c.oldEndDate && !!c.endDate && c.endDate > c.oldEndDate; }
  function refRows(ym) {
    const paid = [], renew = [], shrink = [], period = [], free = [], terms = [], skip = { paid: 0, renew: 0, shrink: 0 }; // free, terms: W7-5(2026-11-16)
    const X = window.CLIMB_CTL; // 줄임의 참고 금액(shrinkRef). 화면이 control-checks.js를 부름
    D.CONTRACTS.forEach(function (c) {
      // 넷째 참고 표: 기간 늘림은 계약 완료한 달로 넣음(아래 기안한 달 거르기 앞)
      if (c.id && isExtend(c) && String(c.completedAt).slice(0, 7) === ym) {
        const day = String(c.completedAt).slice(0, 10), from = C.monthsLater(day, -12), key = custKey(c);
        const n = D.CONTRACTS.filter(function (x) {
          const d = x.id && isExtend(x) ? String(x.completedAt).slice(0, 10) : '';
          return d && d > from && d <= day && custKey(x) === key;
        }).length;
        period.push({ c: c, months: C.periodMonths(C.addDays(c.oldEndDate, 1), c.endDate), year: n });
      }
      if (!c.id || c.status === 'DRAFT' || String(c.requestedAt || '').slice(0, 7) !== ym) return;
      /* 기획자 결정 2026-11-16(결정할것 새 결정 W7-5 (가)): 다섯째, 여섯째 참고 표(그달 기안한 것, 임시 저장 빼고 진행 중과 반려도 넣음. 예전 계약 기록은 결재가 없어 뺌)
       *   free: 4번 회계 영향 조건의 종류에 무상 기간(FREE_PERIOD)을 고른 계약. 무상 기간이 계약 기간 밖이면 표준 금액(달 수 비례)에 들지 않아 할인 0%로 보이고 ③을 건너뜀
       *   terms: 4번이 예인 조항만 변경. 0원 변경이라 ③이 없어 무상 추가 제공 같은 조건이 숨을 수 있음(② 확인 항목 "조항만 변경이 수량과 기능을 늘리지 않음"과 함께) */
      const ckx = c.checklist || {};
      if (!c.legacy && ckx.accounting === 'YES' && (ckx.acctKinds || []).indexOf('FREE_PERIOD') > -1) free.push({ c: c });
      if (C.amendKindOf(c) === 'TERMS' && ckx.accounting === 'YES') terms.push({ c: c });
      if (C.amendKindOf(c) === 'REDUCE') {
        const s = X && X.shrinkRef ? X.shrinkRef(c) : null;
        if (!s || s.why) skip.shrink++;
        // (2026-11-14 주말 점검, 코드 다시 보기 review-01) [가정, 기획자 확인 필요] 계약 전체가 넘거나 한 기능이라도 넘으면(X.shrinkRef flag). 결재 문서의 기능마다 배지와 같은 기준
        else if (s.flag) shrink.push({ c: c, s: s });
        return;
      }
      if (c.kind === 'CHANGE' && /_PAID$/.test(c.changeType || '')) {
        const x = c.changeFeature ? paidOf(c) : null;
        if (!x) skip.paid++;
        else if (x.over) paid.push({ c: c, x: x });
      } else if (c.kind === 'RENEW' && c.renewMode === 'AUTO') {
        const s = c.stdAmount !== undefined ? { std: c.stdAmount == null ? null : Number(c.stdAmount), saved: true }
          : C.renewStd(c.parentId, { day: String(c.requestedAt).slice(0, 10), before: c.requestedAt, start: c.startDate, end: c.endDate, skip: c.id });
        if (s.std == null || !s.std) skip.renew++;
        else if (s.std !== Number(c.amount || 0)) renew.push({ c: c, s: s });
      }
    });
    const by = function (a, b) { return String(a.c.requestedAt).localeCompare(String(b.c.requestedAt)); };
    const byDone = function (a, b) { return String(a.c.completedAt).localeCompare(String(b.c.completedAt)); };
    return { paid: paid.sort(by), renew: renew.sort(by), shrink: shrink.sort(by), period: period.sort(byDone), free: free.sort(by), terms: terms.sort(by), skip: skip };
  }

  /* ---------- 점검 기록 (쌓기만 함) ---------- */
  function allRecs() {
    return (D.DISCOUNT_REVIEWS || []).concat(C.loadDemo('discountReviews'))
      .slice().sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
  }
  /* 컴플라이언스에 넘기기(기획자 결정 2026-11-09 5회차 13번): control-checks.js의 X.raiseIssue를 씀
   *   discount-review.html이 아직 control-checks.js를 부르지 않아, 필요할 때 한 번 불러 씀(HTML에 script 줄을 더하면 바로 window.CLIMB_CTL을 씀)
   *   남길 수 있는 사람에게는 화면을 열 때 미리 불러 둠(아래 시작). 불러오지 못하면 넘기지 못하고 알림 */
  function withCtl(then) {
    if (window.CLIMB_CTL) { then(window.CLIMB_CTL); return; }
    const s = document.createElement('script');
    s.src = 'assets/js/control-checks.js';
    s.onload = function () { then(window.CLIMB_CTL || null); };
    s.onerror = function () { then(null); };
    document.head.appendChild(s);
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
      done: recs.filter(function (r) { return r.type === 'DONE'; })[0] || null,
      ref: refRows(ym) }; // 참고 줄(설계 검토 2026-11-11 3장). rows에 넣지 않아 확인과 점검 마침 조건에 들지 않음
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
  // 상태는 다른 매월 점검(접속 기록, 영업기회 대사, 인장 기록 대조)과 같게(기획자 결정 2026-11-09): 회색 배지, 기한이 지나면 기한 칸 아래에 "기한 지남",
  //   달이 끝나기 전은 "예정". 그전에는 기한이 지나면 배지를 분홍 "기한 지남"으로 바꾸고 달이 끝나기 전은 "이달이 끝난 뒤"였음
  function statusBadge(st) {
    if (!st.ended) return C.badge('line', '예정');
    if (st.done) return C.badge('success', '점검 마침');
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
      // (설계 검토 2026-11-11 남은 것 ⑧) 티어 단가로 셈했으면 그것도 본 내용에 남김
      return (d ? '가장 큰 줄 ' + pct(d.top.d) + '(한도 ' + pct(d.top.cap) + '), 계약 전체 ' + pct(d.all) + (d.tiers.length ? ', ' + d.tiers.join(', ') + ' 단가로 셈' : '') : '제품 줄 없음') + ', ' + apprTexts(x).join(', ');
    }
    return (x.term ? '해지' : '4번 예') + ', ⑩ 차례 ' + C.fmtDate(x.arr) + ', ' + (x.dec ? '처리 ' + C.fmtDate(x.dec) : '아직 처리 전') + ', ' + x.days + '일';
  }
  function doneSeenText(v) {
    return '③ 가격 예외 ' + v.disc + '건(한계값 넘음 ' + v.over + '건), ⑩ 늦음 ' + v.fin + '건' + (v.limit != null ? ', 한계값 ' + v.limit + '%' : '') +
      // 설계 검토 2026-11-11 3장: 마칠 때 본 참고 건수(이 칸을 두기 전에 마친 기록에는 없음)
      (v.paid != null ? ', 참고 유상 충전 ' + v.paid + '건, 참고 그대로 연장 ' + v.renew + '건' : '') +
      // 2026-11-14 주말 점검 W7: 마칠 때 본 셋째, 넷째 참고 건수(이 칸을 두기 전에 마친 기록에는 없음)
      (v.shrink != null ? ', 참고 줄임 ' + v.shrink + '건, 참고 기간 늘림 ' + v.period + '건' : '') +
      (v.free != null ? ', 참고 무상 기간 ' + v.free + '건, 참고 조항만 변경 ' + v.terms + '건' : ''); // 2026-11-16 밤 w7-06(이 칸을 두기 전에 마친 기록에는 없음)
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
      return '<td><span class="cell-title is-masked">' + C.icon('lock', 'sm') + '열람 제한 계약</span><span class="cell-meta">' + esc(c.id) + ', ' + method + '</span>' + late(c) + (extra || '') + '</td>';
    }
    const note = withNote && c.checklist && c.checklist.capNote ? '<span class="cell-meta">할인 사유: ' + esc(c.checklist.capNote) + '</span>' : '';
    return '<td><a class="cell-title" href="review.html?id=' + encodeURIComponent(c.id) + '">' + esc(c.counterparty) + '</a>' +
      '<span class="cell-meta">' + esc(c.id) + (c.restricted ? ' ' + C.icon('lock', 'sm') : '') + ', ' + method + '</span>' + note + late(c) + (extra || '') + '</td>';
  }
  // W7-7(2026-11-16): 사후 등록(시스템이 멈춘 동안 임시 결재로 진행한 계약)이면 배지 한 줄. 사후에 남긴 ③ 승인이 보통 승인과 섞이지 않게(가린 줄에도 보임, 이름이 없음)
  function late(c) { return c.lateEntry ? '<span class="cell-meta">' + C.lateBadge(c) + '</span>' : ''; }
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
      // 문제 있음으로 확인한 줄은 보라 "문제 있음"과 넘어온 일 번호(기획자 결정 2026-11-09 5회차 13번)
      return '<td>' + (r.issue ? C.badge('attention', '문제 있음') : C.badge('success', '확인함')) + '<span class="cell-meta">' + esc(C.ownerLabel(r.by, r.dept)) + ', ' + C.fmtDateTime(r.at) + '</span>' +
        (r.issue ? '<span class="cell-meta">컴플라이언스에 넘김' + (r.issueId ? '(' + esc(r.issueId) + ')' : '') + '</span>' : '') +
        (r.opinion ? '<span class="dr-opinion">' + esc(r.opinion) + '</span>' : '<span class="cell-meta">의견 없음</span>') + '</td>';
    }
    return '<td>' + C.badge('line', '확인 전') + (canDo && mine(x) ? '<span class="cell-meta">내 작업이 든 줄이라 다른 사람이 확인합니다</span>' : '') + '</td>';
  }
  // 관리 칸: 남길 수 있는 사람에게만 칸을 둠(읽기만 하는 역할은 칸 자체가 없음)
  function actCell(x, st) {
    if (!canDo) return '';
    // 줄마다 같은 "확인 남기기"라 화면낭독기가 어느 줄인지 알게 단추 글 뒤에 고객사와 계약번호를 붙임(열람 제한 계약은 계약번호만). 보이는 글이 이름의 앞(2026-11-06 점검)
    const row = '<span class="sr-only"> ' + esc(rowTitle(x)) + '</span>'; // 확인 창 제목과 같은 줄 이름(할인과 재무 줄을 나눔)
    return '<td class="col-action">' + (canRow(x, st) ? '<button type="button" class="link-act" data-row="' + esc(x.key) + '">확인 남기기' + row + '</button>' : '-') + '</td>';
  }
  function discRowHtml(x, st) {
    const d = x.disc, cur = x.c.round || 1;
    // ③ 승인 뒤 ④나 ⑧에서 반려된 차수(지금 반려 상태이거나 다시 기안해 다음 차수가 있음). 할인 승인은 있었으므로 줄은 그대로 둠
    const rej = x.round < cur || x.c.status === 'REJECTED';
    // 반려 표시는 다른 화면과 같은 색과 글(D.STATUS.REJECTED, 분홍)로. 회색이던 것을 바꿈(2026-11-06 점검 4회차)
    return '<tr>' + contractCell(x.c, true, rej ? '<span class="cell-meta">' + C.badge(D.STATUS.REJECTED.tone, D.STATUS.REJECTED.label) + ' 승인 뒤 반려된 차수</span>' : '') +
      '<td class="center cell-phone-nowrap">' + esc(C.ownerLabel(x.c.requesterId)) + '</td>' +
      (d ? '<td class="num">' + pct(d.top.d) + '<span class="cell-meta">한도 ' + pct(d.top.cap) + '</span>' +
          (d.tiers.length ? '<span class="cell-meta">' + esc(d.tiers.join(', ')) + ' 단가로 셈</span>' : '') + // 설계 검토 2026-11-11 남은 것 ⑧
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
  // 참고 줄의 칸 (설계 검토 2026-11-11 3장): 확인과 관리 칸이 없음. 볼 수 없는 열람 제한 계약은 ③ 표처럼 고객사와 링크를 가림
  //   계약 칸: 고객사(결재 문서로), 번호와 종류, 덧붙일 줄(기능 또는 새 계약 기간)
  //   (2026-11-14 주말 점검, 코드 다시 보기 common-02) 볼 수 없는 열람 제한 계약은 금액과 계약 기간도 가림(01 REQ-AUTH-09 "금액은 가려지며", SCR-61
  //     "계약번호, 계약 방식, 영업(유닛), 할인율, ③ 승인과 대리 결재만"). 참고 표 넷은 금액 칸(표준 금액, 충전 금액, 계약 금액, 차이, 줄인 금액, 참고 금액)과
  //     셈 줄(건당 단가 x 건수, 계약 단가 x 수량 x 남은 달 수, 티어와 기본 단가), 기간(넷째 표의 전 종료일 → 새 종료일)을 "-"로 두거나 빼고,
  //     비율(할인율과 한도, 표준보다 낮음 n%, 참고 금액의 n% 더), 늘린 달 수와 횟수, 상태만 남김. 예전에는 고객사만 가리고 금액은 그대로 보였음
  function refMasked(c) { return !C.canView(c, me); }
  function refContractCell(c, extra) {
    const kind = '<span class="cell-meta">' + esc(c.id) + ', ' + esc(c.kind === 'CHANGE' ? D.CHANGE_TYPES[c.changeType] || '운영 변경' : C.kindLabel(c)) + '</span>' + late(c); // late: W7-7
    if (!C.canView(c, me)) return '<td><span class="cell-title is-masked">' + C.icon('lock', 'sm') + '열람 제한 계약</span>' + kind + '</td>';
    return '<td><a class="cell-title" href="review.html?id=' + encodeURIComponent(c.id) + '">' + esc(c.counterparty) + '</a>' + kind +
      (extra ? '<span class="cell-meta">' + extra + '</span>' : '') + '</td>';
  }
  // 상태 칸: 지금 상태와 기안한 날(그달에 넣은 까닭)
  function refStateCell(c) {
    return '<td class="center">' + (D.STATUS[c.status] ? C.statusBadge(c) : esc(c.status)) + '<span class="cell-meta">' + C.fmtDate(String(c.requestedAt).slice(0, 10)) + ' 기안</span></td>';
  }
  function paidRowHtml(r) {
    const c = r.c, x = r.x, f = D.FEATURES.filter(function (y) { return y.id === c.changeFeature; })[0] || {};
    const hide = refMasked(c); // 2026-11-14 주말 점검, 코드 다시 보기 common-02: 금액 칸과 셈 줄을 가리고 할인율과 한도만
    return '<tr>' + refContractCell(c, esc(C.featureLabel({ product: f.product, feature: c.changeFeature }))) +
      '<td class="center cell-phone-nowrap">' + esc(C.ownerLabel(c.requesterId)) + '</td>' +
      (hide ? '<td class="num">-</td><td class="num">-</td>'
        : '<td class="num">' + C.fmtWon(x.std) + '<span class="cell-meta">건당 ' + C.fmtWon(x.list) + ' x ' + x.qty.toLocaleString('ko-KR') + '건</span>' +
          // (설계 검토 2026-11-11 남은 것 ⑧) 티어 단가를 썼으면 그 티어와 기본 단가(C.stdPriceText와 같은 말)
          (x.tier ? '<span class="cell-meta">' + esc(C.tierLabel(x.tier.code) + ' 단가' + (x.tier.base != null ? '. 기본 ' + C.fmtWon(x.tier.base) : '')) + '</span>' : '') + '</td>' +
          '<td class="num">' + C.fmtWon(c.changeAmount) + '</td>') +
      '<td class="num">' + pct(x.d) + '<span class="cell-meta">한도 ' + pct(x.cap) + '</span></td>' + refStateCell(c) + '</tr>';
  }
  function renewRowHtml(r) {
    const c = r.c, s = r.s, gap = s.std - Number(c.amount || 0);
    const hide = refMasked(c); // 2026-11-14 주말 점검, 코드 다시 보기 common-02: 계약 금액, 표준 금액(달 수), 차이 금액을 가리고 "표준보다 낮음(높음) n%"만
    const rate = '<span class="cell-meta">표준보다 ' + (gap > 0 ? '낮음' : '높음') + ' (' + pct(Math.abs(gap) / s.std) + ')</span>';
    return '<tr>' + refContractCell(c, '새 계약 기간 ' + C.fmtPeriod(c.startDate, c.endDate)) +
      '<td class="center cell-phone-nowrap">' + esc(C.ownerLabel(c.requesterId)) + '</td>' +
      (hide ? '<td class="num">-</td><td class="num">-</td><td class="num">-' + rate + '</td>'
        : '<td class="num">' + C.fmtWon(c.amount) + '</td>' +
          '<td class="num">' + C.fmtWon(s.std) + '<span class="cell-meta">' + (s.saved ? '기안 때 남긴 값' : '기안한 날 가격 기준') + (s.months ? ', ' + s.months + '개월' : '') + '</span></td>' +
          '<td class="num">' + C.fmtWon(Math.abs(gap)) + rate + '</td>') +
      refStateCell(c) + '</tr>';
  }
  // (2026-11-14 주말 점검 W7) 셋째 참고 표 줄: 줄인 금액, 참고 금액(줄마다의 셈), 차이. 계약 칸 아래에 줄인 기능과 수량
  //   (2026-11-14 주말 점검, 코드 다시 보기 review-01) 기능마다 합친 값(s.feats)과 셈 글(X.shrinkCalc)로: 결재 문서 "변경 전과 후"와 같은 셈과 글
  //     차이는 참고보다 더 줄인 기능마다의 몫의 합(s.overGap), 비율은 그 기능들의 참고 금액 대비(s.overRef). 한 기능 줄임이면 예전 차이(줄인 금액 - 참고 금액)와 같음
  //   (2026-11-14 주말 점검, 코드 다시 보기 common-02) 볼 수 없는 열람 제한 계약은 줄인 금액, 참고 금액과 셈 줄, 차이 금액을 가리고 배지와 "참고 금액의 n% 더"만
  function shrinkRowHtml(r) {
    const c = r.c, s = r.s, X = window.CLIMB_CTL, hide = refMasked(c);
    const what = s.feats.map(function (f) { return C.termsFeature(f.feature) + ' ' + f.qty.toLocaleString('ko-KR') + C.termsUnit(f.feature) + ' 줄임'; }).join(', ');
    const how = s.feats.map(function (f) { return X.shrinkCalc(f); });
    const tag = '<span class="cell-meta">' + C.badge('attention', '참고보다 많이 줄임') + '</span>' +
      '<span class="cell-meta">참고 금액의 ' + pct(s.overRef ? s.overGap / s.overRef : 0) + ' 더</span>';
    return '<tr>' + refContractCell(c, esc(what) + ', ' + esc(C.fmtDate(C.startOf(c) || String(c.requestedAt).slice(0, 10))) + '부터') +
      '<td class="center cell-phone-nowrap">' + esc(C.ownerLabel(c.requesterId)) + '</td>' +
      (hide ? '<td class="num">-</td><td class="num">-</td><td class="num">-' + tag + '</td>'
        : '<td class="num">' + C.fmtWon(s.reduced) + '</td>' +
          '<td class="num">' + C.fmtWon(s.ref) + how.map(function (x) { return '<span class="cell-meta">' + esc(x) + '</span>'; }).join('') + '</td>' +
          '<td class="num">' + C.fmtWon(s.overGap) + tag + '</td>') +
      refStateCell(c) + '</tr>';
  }
  // (2026-11-14 주말 점검 W7) 넷째 참고 표 줄: 늘린 달 수(전 종료일 → 새 종료일), 같은 거래처의 최근 1년 늘림 횟수, 계약 완료일
  //   (2026-11-14 주말 점검, 코드 다시 보기 common-02) 볼 수 없는 열람 제한 계약은 전 종료일과 새 종료일(계약 기간)을 빼고 늘린 달 수만
  function periodRowHtml(r) {
    const c = r.c;
    return '<tr>' + refContractCell(c, esc(c.parentId ? '원계약 ' + c.parentId : '')) +
      '<td class="center cell-phone-nowrap">' + esc(C.ownerLabel(c.requesterId)) + '</td>' +
      '<td class="num">' + (r.months || 0) + '개월' + (refMasked(c) ? '' : '<span class="cell-meta">' + C.fmtDate(c.oldEndDate) + ' → ' + C.fmtDate(c.endDate) + '</span>') + '</td>' +
      '<td class="num">' + r.year + '번<span class="cell-meta">이 건 포함</span></td>' +
      '<td class="center">' + C.fmtDate(String(c.completedAt).slice(0, 10)) + '<span class="cell-meta">' + C.fmtDate(String(c.requestedAt).slice(0, 10)) + ' 기안</span></td></tr>';
  }

  // W7-5(2026-11-16) 다섯째, 여섯째 참고 표 줄. 볼 수 없는 열람 제한 계약은 고객사와 금액, 계약 기간, 비고를 가림
  function freeRowHtml(r) {
    const c = r.c, hide = refMasked(c), ck = c.checklist || {};
    return '<tr>' + refContractCell(c, '') + '<td class="center cell-phone-nowrap">' + esc(C.ownerLabel(c.requesterId)) + '</td>' +
      '<td class="num-left">' + (hide ? '-' : esc(C.fmtPeriod(C.startOf(c), C.endOf(c)) || '-')) + '</td>' +
      '<td class="num">' + (hide ? '-' : C.fmtWon(c.amount)) + '</td><td>' + (hide ? '-' : esc(ck.accountingNote || '-')) + '</td>' + refStateCell(c) + '</tr>';
  }
  function termsRowHtml(r) {
    const c = r.c, hide = refMasked(c), ck = c.checklist || {};
    const kinds = (ck.acctKinds || []).map(function (k) { const x = (D.ACCT_KINDS || []).filter(function (y) { return y.code === k; })[0]; return x ? x.label : k; }).join(', ');
    return '<tr>' + refContractCell(c, c.parentId ? esc('원계약 ' + c.parentId) : '') + '<td class="center cell-phone-nowrap">' + esc(C.ownerLabel(c.requesterId)) + '</td>' +
      '<td>' + esc(kinds || '-') + '</td><td>' + (hide ? '-' : esc(ck.accountingNote || '-')) + '</td>' + refStateCell(c) + '</tr>';
  }

  /* ---------- 1. 매월 점검 ---------- */
  function renderMonths() {
    $('#month-rows').innerHTML = MONTHS.map(function (ym) {
      const st = stateOf(ym), on = ym === sel;
      const after = st.done ? st.rows.length - st.confirmed : 0; // 마친 뒤 목록에 더해진 줄
      return '<tr' + (st.late ? ' class="is-alert"' : '') + '>' +
        '<td class="nowrap"><a class="cell-title" href="?month=' + ym + '" data-month="' + ym + '"' + (on ? ' aria-current="true"' : '') + '>' + monthLabel(ym) + '</a>' +
          (on ? '<span class="cell-meta">아래에 보는 중</span>' : '') + '</td>' +
        '<td class="num-left nowrap">' + C.fmtDate(st.due) + (st.late && !st.done ? '<span class="cell-meta">기한 지남</span>' : '') + '</td>' +
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
      ['확인', st.confirmed + '/' + st.rows.length + '건'],
      // 설계 검토 2026-11-11 3장: 참고 줄 건수(확인 없음)
      ['참고 유상 충전', st.ref.paid.length + '건'], ['참고 그대로 연장', st.ref.renew.length + '건'],
      // 2026-11-14 주말 점검 W7: 셋째, 넷째 참고 표 건수
      ['참고 줄임', st.ref.shrink.length + '건'], ['참고 기간 늘림', st.ref.period.length + '건'],
      ['참고 무상 기간', st.ref.free.length + '건'], ['참고 조항만 변경', st.ref.terms.length + '건']]); // W7-5(2026-11-16)
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
    renderRef(st);
    renderDone(st);
  }
  // 참고 줄 두 표 (설계 검토 2026-11-11 3장): 보기만 하고 확인을 남기지 않음. 견주지 못한 건수와 가린 열람 제한 건수를 설명 끝에 덧붙임
  function renderRef(st) {
    const ref = st.ref, when = st.ended ? '그달' : '이달 지금까지';
    // (2026-11-14 주말 점검, 코드 다시 보기 common-02) 고객사만이 아니라 금액도 가림(01 REQ-AUTH-09). 넷째 표는 금액이 없어 계약 기간(전, 새 종료일)을 가림
    const hid = function (list, what) {
      const n = list.filter(function (r) { return refMasked(r.c); }).length;
      return n ? ' 볼 수 없는 열람 제한 계약 ' + n + '건은 ' + (what || '고객사와 금액을 가리고 비율만 보입니다.') : '';
    };
    // (설계 검토 2026-11-11 남은 것 ⑧) 건 단위는 가격 기준의 단위 종류(건당)로 정하고, 고객사 티어 단가를 썼으면 그 값
    $('#paid-desc').textContent = '그달 기안한 유상 충전 가운데 기안 때 남긴 건당 표준 단가(고객사 티어 단가를 썼으면 그 값)로 본 할인율이 그 기능의 할인율 한도를 넘은 것입니다. ' +
      '유상 충전은 ③ 영업 검토를 거치지 않아 참고로 보이고, 확인은 남기지 않습니다.' + (st.ended ? '' : ' 이달은 지금까지 기안한 것만 보입니다.') +
      (ref.skip.paid ? ' 건 단위 표준 단가가 없어 견주지 못한 유상 충전 ' + ref.skip.paid + '건은 넣지 않았습니다.' : '') + hid(ref.paid);
    $('#paid-rows').innerHTML = ref.paid.length ? ref.paid.map(paidRowHtml).join('')
      : '<tr><td class="empty-row" colspan="6">' + when + ' 한도를 넘은 유상 충전이 없습니다.</td></tr>';
    $('#renew-desc').textContent = '그달 기안한 조건 그대로 연장 가운데 계약 금액이 기안한 날 가격 기준의 표준 금액(같은 달 수)과 다른 것입니다. ' +
      '그대로 연장의 ③은 가격 예외 승인이 아니라 참고로 보이고, 확인은 남기지 않습니다.' + (st.ended ? '' : ' 이달은 지금까지 기안한 것만 보입니다.') +
      (ref.skip.renew ? ' 제품 줄이나 가격 기준이 없어 견주지 못한 연장 ' + ref.skip.renew + '건은 넣지 않았습니다.' : '') + hid(ref.renew);
    $('#renew-rows').innerHTML = ref.renew.length ? ref.renew.map(renewRowHtml).join('')
      : '<tr><td class="empty-row" colspan="6">' + when + ' 표준 금액과 다른 그대로 연장이 없습니다.</td></tr>';
    // (2026-11-14 주말 점검 W7) 셋째 참고 표: 참고 금액보다 많이 줄인 변경
    // (2026-11-14 주말 점검, 코드 다시 보기 review-01) [가정] 기능마다 봄: 한 기능이라도 참고 금액보다 많이 줄였으면 올리고, 차이는 그 기능들이 더 줄인 몫
    $('#shrink-desc').textContent = '그달 기안한 줄임 변경 가운데 줄인 금액이 참고 금액(그 기능의 계약 단가 x 줄이는 수량 x 남은 달 수 / 그 기간의 달 수)보다 큰 기능이 있는 것입니다. ' +
      '차이는 참고 금액보다 더 줄인 기능마다의 몫을 더한 값입니다. ' +
      '줄임 변경은 ③ 영업 검토와 할인 계산을 거치지 않아 참고로 보이고, 확인은 남기지 않습니다.' + (st.ended ? '' : ' 이달은 지금까지 기안한 것만 보입니다.') +
      (ref.skip.shrink ? ' 변경 전 조건이나 제품 줄이 없어 참고 금액을 셈하지 못한 줄임 ' + ref.skip.shrink + '건은 넣지 않았습니다.' : '') + hid(ref.shrink);
    $('#shrink-rows').innerHTML = ref.shrink.length ? ref.shrink.map(shrinkRowHtml).join('')
      : '<tr><td class="empty-row" colspan="6">' + when + ' 참고 금액보다 많이 줄인 변경이 없습니다.</td></tr>';
    // (2026-11-14 주말 점검 W7) 넷째 참고 표: 운영 변경으로 늘린 계약 기간
    $('#period-desc').textContent = '그달 계약 완료된 운영 변경 가운데 계약 종료일을 늦춘 것입니다. 기간 변경은 금액과 ③ 영업 검토 없이 끝나 참고로 보이고, 확인은 남기지 않습니다. ' +
      '같은 거래처가 최근 1년 안에 몇 번 늘렸는지도 함께 봅니다.' + (st.ended ? '' : ' 이달은 지금까지 계약 완료된 것만 보입니다.') +
      hid(ref.period, '고객사와 계약 기간을 가리고 늘린 달 수만 보입니다.'); // 2026-11-14 주말 점검, 코드 다시 보기 common-02
    $('#period-rows').innerHTML = ref.period.length ? ref.period.map(periodRowHtml).join('')
      : '<tr><td class="empty-row" colspan="5">' + when + ' 운영 변경으로 늘린 계약 기간이 없습니다.</td></tr>';
    // W7-5(2026-11-16) 다섯째, 여섯째 참고 표
    $('#free-desc').textContent = '그달 기안한 계약 가운데 체크리스트 4번 회계 영향 조건에 무상 기간을 고른 것입니다. 무상 기간이 계약 기간 밖이면 표준 금액에 들지 않아 할인 0%로 보이고 ③ 영업 검토를 거치지 않으므로, ' +
      '비고로 무상 기간이 계약 기간 안인지 밖인지 봅니다. 확인은 남기지 않습니다.' + (st.ended ? '' : ' 이달은 지금까지 기안한 것만 보입니다.') + hid(ref.free, '고객사와 금액, 계약 기간, 비고를 가립니다.');
    $('#free-rows').innerHTML = ref.free.length ? ref.free.map(freeRowHtml).join('')
      : '<tr><td class="empty-row" colspan="6">' + when + ' 무상 기간을 둔 계약이 없습니다.</td></tr>';
    $('#terms-desc').textContent = '그달 기안한 조항만 변경 가운데 체크리스트 4번이 예인 것입니다. 조항만 변경은 0원이라 ③ 영업 검토를 거치지 않으므로, 무상 추가 제공 같은 조건이 들었는지 비고로 봅니다. 확인은 남기지 않습니다.' +
      (st.ended ? '' : ' 이달은 지금까지 기안한 것만 보입니다.') + hid(ref.terms, '고객사와 비고를 가립니다.');
    $('#terms-rows').innerHTML = ref.terms.length ? ref.terms.map(termsRowHtml).join('')
      : '<tr><td class="empty-row" colspan="5">' + when + ' 회계 영향 조건이 있는 조항만 변경이 없습니다.</td></tr>';
  }

  /* ---------- 3. 점검 기록 ---------- */
  let page = 1;
  // 기록 내용: 줄 확인은 계약번호만 씀(고객사 이름을 기록 목록에 드러내지 않음)
  function recText(r) {
    if (r.type === 'LIMIT') return '가장 큰 줄 할인율 ' + esc(String(r.limit)) + '% 이상은 의견 필수' + (r.reason ? '<span class="cell-meta">바꾼 까닭: ' + esc(r.reason) + '</span>' : '');
    if (r.type === 'ROW') {
      return '<span class="dr-line">' + esc(r.contractId) + ' ' + esc(PART[r.part] || '') + (r.over ? ' ' + C.badge('attention', '의견 필수') : '') +
          (r.issue ? ' ' + C.badge('attention', '문제 있음') : '') + '</span>' + // 2026-11-09 5회차 13번
        (r.issue ? '<span class="cell-meta">컴플라이언스에 넘김' + (r.issueId ? '(' + esc(r.issueId) + ')' : '') + '</span>' : '') +
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
    // 의견 칸: 한계값 밑이면 (선택). "문제 있음"을 고르면 필수 표시로 바꿀 수 있게 숨긴 필수 표시를 미리 둠(설정 변경 확인의 의견 칸과 같은 방식, 2026-11-09 5회차 13번)
    let opinionHtml = C.fieldHtml({ name: 'opinion', label: '의견', type: 'textarea', required: need, optional: !need,
      placeholder: x.part === 'DISC' ? '예: 첫 도입 조건과 레퍼런스 확보를 보면 할인 폭이 받아들일 만함. 같은 유닛의 다음 예외는 함께 봄'
        : '예: 결산 자료 준비로 늦음. 재무 리더에게 기한 안 처리를 다시 알림',
      help: need ? (x.disc ? '가장 큰 줄 할인율이 한계값(' + st.limit.limit + '%) 이상이라 의견을 꼭 적습니다.' : '제품 줄이 없어 할인율을 셀 수 없으므로 의견을 꼭 적습니다.') : '' });
    if (!need) opinionHtml = opinionHtml.replace(' <span class="opt">', '<span class="req" aria-hidden="true" hidden>*</span><span class="sr-only req-sr" hidden>(필수)</span> <span class="opt">');
    C.formModal({
      title: PART[x.part] + ' 줄을 확인할까요?',
      desc: '저장하면 확인한 사람과 일시, 의견, 지금 본 내용이 남고 고치거나 되돌릴 수 없습니다.',
      body: '<p class="modal-info">' + esc(rowTitle(x)) + '<br>' + esc(seenOf(x)) + '</p>' + opinionHtml +
        // 기획자 결정 2026-11-09 5회차 13번: 문제가 있는 줄은 컴플라이언스에 넘김. 고르면 의견 필수, 저장하면 컴플라이언스 담당자 점검할 일과 이메일
        '<div class="field" data-field="issue"><label class="choice"><input type="checkbox" name="issue" value="Y">문제 있음: 컴플라이언스 담당자에게 넘깁니다</label>' +
          '<p class="field-help">고르면 의견을 꼭 적습니다. 저장하면 컴플라이언스 담당자의 점검할 일에 올라가고 이메일로 알립니다.</p></div>',
      btn: '확인 남기기',
      open: function (f) {
        if (need) return; // 이미 의견 필수인 줄은 바꿀 표시가 없음
        const box = f.querySelector('[data-field="opinion"]');
        const sync = function () {
          const on = f.elements.issue.checked;
          box.querySelector('.req').hidden = !on;
          box.querySelector('.req-sr').hidden = !on;
          box.querySelector('.opt').hidden = on;
          if (!on) C.setFieldError(box, ''); // 문제 있음을 풀면 "적으세요" 오류는 맞지 않으므로 지움
        };
        f.elements.issue.addEventListener('change', sync);
        sync();
      },
      check: function (f) { return { opinion: (need || f.elements.issue.checked) && !f.elements.opinion.value.trim() ? '의견을 적으세요.' : '' }; },
      done: function (f) {
        const issue = f.elements.issue.checked;
        const rec = { type: 'ROW', key: x.key, contractId: x.c.id, part: x.part, over: need, limit: st.limit ? st.limit.limit : null,
          opinion: f.elements.opinion.value.trim(), seen: seenOf(x), issue: issue };
        // 문제 있음이면 넘긴 뒤 넘어온 일 번호를 줄 기록에 함께 남김. 고객사 이름은 넣지 않고 계약번호만(열람 제한 계약 보호)
        const finish = function (X, i) {
          if (!save(Object.assign(rec, { issueId: i ? i.id : null }))) return;
          refresh();
          C.toast(x.c.id + ' ' + PART[x.part] + ' 줄 확인을 남겼습니다.' + (issue ? (X ? X.issueToast(i) : ' 컴플라이언스에 넘기지 못했습니다. 화면을 새로 고친 뒤 컴플라이언스 담당자에게 알려 주세요.') : ''), issue && !i);
        };
        if (!issue) { finish(null, null); return; }
        withCtl(function (X) {
          finish(X, X ? X.raiseIssue({ source: 'DISCOUNT', title: monthLabel(sel) + ' 할인 예외 점검: ' + x.c.id + ' ' + PART[x.part] + ' 문제 있음',
            note: rec.opinion, href: 'discount-review.html?month=' + sel, ref: x.key }) : null);
        });
      },
    });
  }
  // 점검 마침: 모든 줄을 확인했을 때만. 마칠 때 본 건수와 줄 목록(sig)을 남겨, 나중에 목록이 바뀌면 "마친 뒤 바뀜"
  function openDone() {
    const st = stateOf(sel);
    if (!canFinish(st)) return;
    const seen = { disc: st.disc.length, fin: st.fin.length, over: st.disc.filter(function (x) { return isOver(x, st); }).length,
      limit: st.limit ? st.limit.limit : null, sig: sigOf(st),
      paid: st.ref.paid.length, renew: st.ref.renew.length, // 설계 검토 2026-11-11 3장: 마칠 때 본 참고 건수(sig에는 넣지 않음) [가정]
      shrink: st.ref.shrink.length, period: st.ref.period.length, // 2026-11-14 주말 점검 W7: 셋째, 넷째 참고 표 건수도(sig에는 넣지 않음) [가정]
      free: st.ref.free.length, terms: st.ref.terms.length }; // 2026-11-16 밤 코드 다시 보기 w7-06: 다섯째, 여섯째 참고 표 건수도
    C.formModal({
      title: monthLabel(sel) + ' 할인 예외 점검을 마칠까요?',
      desc: '저장하면 마친 사람과 일시, 메모, 지금 본 건수가 남고 고치거나 되돌릴 수 없습니다.',
      body: '<p class="modal-info">' + esc(doneSeenText(seen)) + '</p>' +
        // 넣지 않아도 되는 칸은 optional로 "(선택)"을 모든 창에서 같은 모양으로(2026-11-06 점검 3회차)
        C.fieldHtml({ name: 'memo', label: '메모', type: 'textarea', optional: true, placeholder: '예: 한계값을 넘은 2건은 영업 임원과 다음 달 가격 회의에서 함께 봄' }),
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
  // 읽기만 하는 역할과 컴플라이언스(기획자 결정 2026-11-10 16번): 관리 칸을 빼고 안내 한 줄을 덧붙임(역할은 화면을 여는 동안 바뀌지 않아 자리가 흔들리지 않음)
  if (!canDo) {
    document.querySelectorAll('th[data-act-col]').forEach(function (th) { th.remove(); });
    $('#months-desc').textContent += ' 보기만 합니다. 한계값과 줄 확인, 점검 마침은 재무 임원이 남깁니다.';
  } else withCtl(function () {}); // 남길 수 있는 사람: 컴플라이언스에 넘길 때 쓸 control-checks.js를 미리 불러 둠(2026-11-09 5회차 13번)
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
    // 쪽 번호: 누른 단추가 다시 그려져 없어지므로 초점도 점검 기록 제목으로(2026-11-06 점검 3회차)
    else if (b.getAttribute('data-page')) { page = Number(b.getAttribute('data-page')); renderLog(); C.focusSection('#sec-log'); }
  });
  refresh();
})();
