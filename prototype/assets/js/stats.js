/* =====================================================================
 * SCR-46 통계와 보고서 화면 로직 (stats.js, v0.53 기획자 요청, 요구사항 정의서 REQ-DASH-17~21)
 * ---------------------------------------------------------------------
 * 하는 일
 *   1. 조건: 기간(최근 12개월, 해마다), 서비스, 영업 유닛(기안한 영업의 조직)
 *   2. 한눈에 보기: 체결 금액, 체결 건수, 진행 중인 금액(기간과 상관없이 지금), 기안부터 체결까지 걸린 날
 *   3. 달마다 체결 금액(세로 막대), 서비스와 영업 유닛마다 체결 금액(가로 막대)
 *   4. 결재 단계마다 걸린 날: 차례가 온 때부터 처리한 때까지의 평균. 오래 머묾 기준(ALERT_RULES)을 세로선으로
 *   5. 체크리스트 예외 비율: 체결한 계약 가운데 1~3번 "아니요", 4번 "예"인 계약
 *      (v0.62, 표준 대응표 G-01, G-19) 견적서 가운데 할인율 한도를 넘는 줄이 있는 것(견적을 볼 수 있는 역할만),
 *      계약 방식과 거래처마다 2, 3번 "아니요" 건수(표로 보기, 거래처는 예외가 있는 곳만 많은 순 10곳)
 *   6. 체결본 확인 반려 항목(v0.61, 통제와 표준 대응표 G-06): ⑧ 반려 때 고른 어긋난 항목(결재 기록의 mismatch 코드)을 반려 건수 대비로 (REQ-SIGN-04, REQ-DASH-19)
 *   7. 보완 요청 항목(v0.63, 표준 대응표 G-05): ②~⑤ 보완 요청 때 고른 항목(결재 기록의 supplementItems 코드)을 보완 요청 건수 대비로 (REQ-REV-11, REQ-DASH-19)
 *   8. 기간 마감 점검(기획자 결정 2026-11-02 B-9, CTL-65): 기간 말 앞뒤 체결, 승인됐지만 체결 전, ⑨ ⑩ 기다림. 재무가 기간 말마다 확인을 남김(아래 8.)
 *   9. 통제 지표(기획자 결정 2026-11-02 C-1, 리더와 임원과 감사 열람만): 4번 조건의 종류마다 건수(B-6, CTL-52), ④ 반부패 조항 판단을 계약 방식마다(C-15, CTL-34),
 *      평균 할인(영업, 유닛, 기관 종류, 계약 방식마다), 대리 결재 건수, 위험 신호(같은 거래처와 30일 안에 두 건 이상, 분기 말 5일 안의 가격 예외)
 *  10. 통제 증빙 내보내기(기획자 결정 2026-11-02 C-3, 감사 열람과 시연용 최고관리자): 기간을 골라 CSV(엑셀에서 열림) 한 파일, 꺼낸 기록
 *      파일 맨 위에 실행 시각, 실행한 사람, 조건, 건수, 금액 합계, 파일 지문(SHA-256), 워터마크. 꺼낸 기록은 계약 상세의 결재 기록 묶음과 함께 보임
 *  11. 계약 뒤쪽(설계 검토 2026-11-11 3장): 운영 변경 종류마다 건수와 충전 수량, 기간 변경 길이, 만료 처리 결과(연장, 유예, 만료, 해지), 해지,
 *      의무를 기한 안에 한 비율. 위 조건을 따르고 모두 봄(지금 통계와 같음, REQ-DASH-17) [가정]. 자세한 세는 법은 아래 "11. 계약 뒤쪽"
 * 세는 법
 *   - 체결일: ⑦에서 받은 서명본 체결일(C.signedDate, 없으면 올린 날). 올린 때도 남겨 함께 보임 (기획자 결정 2026-11-02 B-8)
 *     예전에는 체결본을 올린 때(⑦ 마지막 기록)였음. 조건 그대로 연장(날인과 체결본 없음)은 지금처럼 ⑩ 재무 확인일
 *   - ⑧에서 반려된 차수는 체결 금액과 건수에 넣지 않음. 다시 기안해 체결되면 그때 셈. ⑧ 확인을 기다리는 계약은 지금처럼 셈 (기획자 결정 2026-11-02 A-2)
 *   - 금액이 있는 계약만(신규, 변경, 연장). 해지와 운영 변경, 작성 중은 넣지 않음
 *   - (설계 검토 2026-11-11 6번) 변경 금액은 부호 있음("늘거나 준 만큼"): 추가는 +, 줄임은 -, 조항만은 0원. 줄임과 조항만 변경도 체결 건수에 넣고
 *     체결 금액과 진행 중인 금액에는 그 금액 그대로 더함(줄임은 빼짐). 그래서 체결 금액은 "그 기간에 늘어난 계약 금액의 순합계" [가정].
 *     줄임과 조항만은 표준 단가와 견주지 않아(체크리스트 2, 3번 해당 없음) 평균 할인과 증빙의 ③ 가격 예외에 넣지 않음
 *   - 진행 중단(STOPPED, 설계 검토 2026-11-11 7번)한 계약은 체결 금액과 건수, 진행 중인 금액, 기간 마감 점검에 넣지 않음. 중단 요청 중인 계약은 그 상태대로 셈
 *   - 열람 제한 계약 중 이 사람이 볼 수 없는 건은 어디에도 넣지 않음(합계로도 드러나지 않게)
 * 그래프(dataviz 기준): 막대는 한 색(--chart-bar), 값은 막대 끝에 글자로, 그래프마다 "표로 보기"
 *   "표로 보기" 표의 금액은 정확한 금액(C.fmtWon, 예: 120,000,000원, 합계 줄 포함). 그래프 눈금, 막대 글자, 마우스 설명,
 *   맨 위 요약 칸은 줄인 금액(1.2억, 1억 2,000만 원) 그대로 (기획자 결정 2026-11-09 5회차 12번: 다른 표와 꼴을 맞춤)
 *   색만으로 뜻을 전하지 않음(기준을 넘은 단계는 "기준 넘음" 글자를 붙임)
 * 볼 수 있는 사람: 모두 (전체 계약과 같음). 기간 마감 점검의 확인은 재무(담당자, 리더, 임원)만 남김. 통제 지표 묶음은 리더, 임원, 감사 열람만(C-1)
 *   통제 증빙 내보내기는 감사 열람(과 시연용 최고관리자)만(C-3). 감사 열람은 열람 제한 계약까지 모두 셈(C.canView, C-2)
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const AMOUNT_KINDS = ['NEW', 'AMEND', 'RENEW'];
  const PIPELINE = ['IN_REVIEW', 'SUPPLEMENT', 'APPROVED'];
  // 단계 이름: 막대 옆에 들어가게 짧게 (결재 기록과 증빙의 단계 이름은 계약에 맞게 C.stepLabel(code, c), 끝난 말은 C.stepDone(code, c))
  //   ③ 영업 임원 승인(기획자 결정 2026-11-02 E-3, 할인 폭이 큰 계약만)도 따로 셈
  //   ⑨ 만료 처리(A-10, 종료 다음 날부터 서비스를 닫을 때까지)도. ③ 만료 유예 확인은 끝나면 차례가 사라져 세지 않음
  //   (설계 검토 2026-11-11 남은 것 ④) 전자계약의 ⑥ ⑦ ⑧은 하는 일과 맡는 사람이 달라(⑥은 총무가 아니라 영업지원) 따로 셈 [가정].
  //     열쇠는 단계 코드 끝에 E(stepKey). 이름은 막대 옆에 들어가게 D.ESIGN_STEPS의 이름을 줄임. 처리한 것이 없으면 막대가 생기지 않음
  const STEP_NAMES = { S02: '② 체크리스트', S03: '③ 영업 검토', S03C: '③ 영업 임원 승인', S04: '④ 법무 검토', S05: '⑤ 개인정보', S06: '⑥ 인장 날인', S06E: '⑥ 인증서 서명',
    S07: '⑦ 체결본 등록', S07E: '⑦ 출력본 등록', S08: '⑧ 체결본 확인', S08E: '⑧ 출력본 확인', S09: '⑨ 운영 적용', S10: '⑩ 재무 확인', SXP: '⑨ 만료 처리' };
  const stepKey = function (code, c) { return D.ESIGN_STEPS[code] && C.isEsign(c) ? code + 'E' : code; };
  const CHECKS = [
    ['standard', 'NO', '1. 표준계약서를 바꿈', '④ 법무 검토'],
    ['price', 'NO', '2. 표준단가표와 다름', '③ 영업 검토'],
    ['cap', 'NO', '3. 할인율 한도를 넘음', '③ 영업 검토'],
    ['accounting', 'YES', '4. 회계에 영향을 주는 특수 조건', '⑩ 재무 확인'],
  ];
  // 견적 칸은 견적 목록(SCR-16)을 볼 수 있는 역할에만 (v0.62, quotes.js와 같은 역할)
  //   기획자 결정 2026-11-02 C-2: 감사 열람은 "전체 통계"를 보기만 하므로 견적 칸(한도 넘은 견적 비율)도 봄. 견적 목록 화면은 열지 않음
  const seeQuotes = me.role === 'SUPER' || C.isAuditor(me) || C.hasRole(me, ['SALES', 'HEAD', 'EXEC', 'SALES_ADMIN', 'ADMIN']);
  // 기획자 결정 2026-11-02 C-1: 지금 통계는 모두에게 그대로, 새 통제 지표 묶음(아래 9.)만 리더, 임원, 감사 열람에게
  //   리더: 영업, 영업지원, 정보보호, 고객지원, 재무 리더 / 임원: 영업 임원(COO), 재무 임원(CFO) / 감사 열람(C-2): 끝나는 날 안일 때만(C.isAuditor)
  //   최고관리자는 시연용. 앞선 작업에서는 감사 열람이 빠져 있었음(C-2가 정해진 뒤 더함)
  const seeControls = me.role === 'SUPER' || C.isAuditor(me) || ['HEAD', 'EXEC', 'SA_LEAD', 'SEC_LEAD', 'CEM_LEAD', 'FIN_LEAD', 'FIN_EXEC'].indexOf(me.role) > -1;
  // 기획자 결정 2026-11-02 C-3: 기간 전체 통제 증빙 내보내기는 모든 계약을 보는 감사 열람(C-2)이 함. 최고관리자는 시연용
  const canExport = me.role === 'SUPER' || C.isAuditor(me);
  const X = window.CLIMB_CTL; // 접속 기록, 꺼낸 기록, 파일 지문, CSV (control-checks.js)
  const PRICE_OF = function (fid) { return D.PRICE_BOOK.filter(function (p) { return p.feature === fid; })[0] || null; };

  /* ---------- 세는 법 ---------- */
  // 체결일 (기획자 결정 2026-11-02 B-8, A-2)
  //   date: ⑦에서 받은 서명본 체결일(C.signedDate: 지금 차수 마지막 체결본 등록의 signDate, 없으면 올린 날)
  //   up: 체결본을 올린 때(c.signedAt). 통계는 서명본 체결일로 세고, 올린 때도 남겨 함께 보임
  //   조건 그대로 연장(날인과 체결본 없음)은 지금처럼 ⑩ 재무 확인일(계약 완료된 때), 올린 때는 없음
  //   반려된 차수는 체결로 세지 않음(⑦을 마친 뒤 반려는 ⑧뿐). 다시 기안하면 다음 차수의 ⑦이 끝날 때 셈. ⑧ 확인을 기다리는 계약은 셈
  function signInfo(c) {
    if (c.renewMode === 'AUTO') return c.completedAt ? { date: String(c.completedAt).slice(0, 10), up: null } : null;
    //   (설계 검토 2026-11-11 7번) 진행 중단(STOPPED)된 계약도 체결로 세지 않음(⑦을 올린 뒤 중단했어도) [가정]. 진행 중인 금액(PIPELINE)에도 없음
    if (!c.signedAt || c.status === 'REJECTED' || c.status === 'STOPPED') return null;
    return { date: C.signedDate(c), up: String(c.signedAt) };
  }
  function signDate(c) { const s = signInfo(c); return s ? s.date : ''; }
  // 금액에 넣는 계약: 신규, 변경, 연장 가운데 금액이 있는 것 (해지와 운영 변경은 넣지 않음)
  //   (설계 검토 2026-11-11 6번) 줄임(금액 -)과 조항만(0원) 변경도 셈: 금액은 부호 그대로 더함(C.priceCheckOff가 이 두 종류)
  function counted(c) { return AMOUNT_KINDS.indexOf(c.kind) > -1 && (c.amount > 0 || C.priceCheckOff(c)); }
  // 'YYYY-MM-DD HH:MM' 두 값 사이의 날(소수)
  function toTime(s) {
    const d = String(s).slice(0, 10).split('-').map(Number);
    const t = (String(s).slice(11, 16) || '00:00').split(':').map(Number);
    return new Date(d[0], d[1] - 1, d[2], t[0], t[1]).getTime();
  }
  function daysFrom(a, b) { return (toTime(b) - toTime(a)) / 86400000; }
  function round1(n) { return Math.round(n * 10) / 10; }
  function fmtDays(n) { return round1(n).toLocaleString('ko-KR') + '일'; }
  function fmtMoney(n) { return n ? C.fmtKRW(n) : '0원'; }
  // 그래프 눈금과 막대 끝 글자: 1.3억, 5,400만
  function fmtShort(n) {
    if (!n) return '0';
    if (n >= 100000000) return (Math.round(n / 10000000) / 10).toLocaleString('ko-KR') + '억';
    return Math.round(n / 10000).toLocaleString('ko-KR') + '만';
  }
  function monthKey(y, m) { return y + '-' + String(m).padStart(2, '0'); }
  // 그래프 아래 달 글자. 휴대폰에서는 "월"을 빼고 숫자만(12달이 겹치지 않게)
  function monthLabel(key) { return Number(key.slice(5)) + '<span class="m-unit">월</span>'; }
  function monthLong(key) { return key.slice(0, 4) + '년 ' + Number(key.slice(5)) + '월'; }

  // 이 사람이 볼 수 있는 계약(작성 중 빼고)과, 열람 제한이라 뺀 수
  // 설계 검토 2026-11-11 5번 [가정]: 예전 계약 기록(시스템 전에 맺어 결재 없이 올린 원계약)은 체결 금액, 건수, 걸린 날, 통제 지표, 증빙 내보내기에 넣지 않음.
  //   그 기록에 이어 시스템에서 기안한 후속 계약(연장, 변경, 운영 변경, 해지)은 다른 계약처럼 셈
  const all = D.CONTRACTS.filter(function (c) { return c.id && c.status !== 'DRAFT' && !c.legacy; });
  const visible = all.filter(function (c) { return C.canView(c, me); });
  const hiddenCount = all.length - visible.length;
  const hiddenList = all.filter(function (c) { return !C.canView(c, me); }); // 기간 마감 점검에서 건수만 셈(B-9)

  /* ---------- 조건 ---------- */
  const todayKey = D.TODAY.slice(0, 7);
  const firstYear = Math.min.apply(null, visible.map(function (c) { const d = signDate(c); return d ? Number(d.slice(0, 4)) : Number(D.TODAY.slice(0, 4)); }));
  const PERIODS = [['last12', '최근 12개월']];
  for (let y = Number(D.TODAY.slice(0, 4)); y >= firstYear; y--) PERIODS.push([String(y), y + '년']);
  function monthsOf(p) {
    const out = [];
    if (p === 'last12') {
      let y = Number(todayKey.slice(0, 4)), m = Number(todayKey.slice(5));
      for (let i = 0; i < 12; i++) { out.unshift(monthKey(y, m)); m--; if (!m) { m = 12; y--; } }
      return out;
    }
    for (let m = 1; m <= 12; m++) { const k = monthKey(p, m); if (k <= todayKey) out.push(k); }
    return out;
  }
  const units = visible.map(function (c) { return C.teamOf(c.requesterId); })
    .filter(function (u, i, a) { return u && a.indexOf(u) === i; }).sort();
  function options(sel, list) {
    sel.innerHTML = list.map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>'; }).join('');
  }
  options($('#f-period'), PERIODS);
  options($('#f-service'), [['', '전체']].concat(Object.keys(D.SERVICES).map(function (k) { return [k, D.SERVICES[k]]; })));
  options($('#f-unit'), [['', '전체']].concat(units.map(function (u) { return [u, u]; })));

  // 2026-11-09 5회차 점검: 조건 그대로 연장은 ⑩ 재무 확인 전까지 진행 중으로 셈(아래 pipe)
  //   (설계 검토 2026-11-11 7번) 진행을 중단한 계약도 넣지 않음(signInfo, PIPELINE)
  $('#intro-sub').textContent = '해지와 운영 변경은 금액에 넣지 않고, ⑧에서 반려된 계약과 진행을 중단한 계약도 넣지 않습니다. 진행 중인 금액은 기간과 상관없이 지금 검토부터 체결본 등록 전까지(조건 그대로 연장은 ⑩ 재무 확인 전까지)인 계약의 금액입니다.' +
    (hiddenCount ? ' 열람 제한 계약 중 볼 수 없는 ' + hiddenCount + '건은 넣지 않았습니다.' : '') +
    ' 시스템 전에 맺어 결재 없이 올린 예전 계약 기록도 넣지 않습니다.' + // 설계 검토 2026-11-11 5번 [가정]
    ' 변경 계약의 금액은 늘거나 준 만큼이라 줄임 변경은 금액에서 빠지고, 조항만 바꾼 변경은 0원으로 건수에만 듭니다.'; // (설계 검토 2026-11-11 6번)

  /* ---------- 그래프 조각 ---------- */
  // 눈금 간격: 1, 2, 5 단위로 4칸 안에 들어가게
  function niceStep(max) {
    const steps = [];
    [1, 2, 5].forEach(function (k) { for (let e = 4; e <= 10; e++) steps.push(k * Math.pow(10, e)); });
    steps.sort(function (a, b) { return a - b; });
    return steps.filter(function (s) { return max / s <= 4; })[0] || steps[steps.length - 1];
  }
  function columnChart(months, by) {
    const max = Math.max.apply(null, months.map(function (k) { return by[k].sum; }));
    if (!max) return '<p class="chart-empty">이 조건에서 체결한 계약이 없습니다.</p>';
    const step = niceStep(max), top = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = 0; v <= top; v += step) ticks.push(v);
    // 막대 끝 글자는 가장 큰 달과 이번 달만 (모든 막대에 숫자를 달지 않음)
    const maxKey = months.filter(function (k) { return by[k].sum === max; })[0];
    // 이번 달은 기간 안에 오늘이 있을 때만(지난해를 고르면 12월에 붙던 것, v0.63 점검에서 고침)
    const last = months.indexOf(todayKey) > -1 ? todayKey : null;
    return '<div class="colchart" style="--n:' + months.length + '">' +
      '<div class="colchart-plot">' +
        ticks.map(function (v) { return '<span class="colchart-grid' + (v ? '' : ' is-base') + '" style="bottom:' + (v / top * 100) + '%"><em>' + fmtShort(v) + '</em></span>'; }).join('') +
        '<ol class="colchart-bars">' + months.map(function (k) {
          const b = by[k], tip = monthLong(k) + (k === todayKey ? '(' + Number(D.TODAY.slice(8)) + '일까지)' : '') + ': ' + b.count + '건, ' + fmtMoney(b.sum);
          const label = b.sum && (k === maxKey || k === last) ? '<span class="colchart-val">' + fmtShort(b.sum) + '</span>' : '';
          //   (설계 검토 2026-11-11 6번) 줄임 변경만 있는 달은 합계가 0 아래일 수 있어 막대는 그리지 않고 마우스 설명에 금액(빼기)만
          return '<li data-tip="' + esc(tip) + '">' + label + (b.sum > 0 ? '<span class="colchart-bar" style="height:' + (b.sum / top * 100) + '%"></span>' : '') + '</li>';
        }).join('') + '</ol>' +
      '</div>' +
      '<ol class="colchart-x" aria-hidden="true">' + months.map(function (k, i) {
        return '<li><span class="m">' + monthLabel(k) + '</span>' + (i === 0 || k.slice(5) === '01' ? '<span class="y">' + k.slice(0, 4) + '</span>' : '') + '</li>';
      }).join('') + '</ol>' +
    '</div>';
  }
  // 가로 막대: rows = [{ label, value, text, tip, note, noRef }], ref = 기준값(선택)
  function barChart(rows, opt) {
    if (!rows.length) return '<p class="chart-empty">이 조건에서 셀 것이 없습니다.</p>';
    const max = Math.max.apply(null, rows.map(function (r) { return r.value; }).concat([opt.ref || 0])) * (opt.ref ? 1.1 : 1);
    const style = '--label-w:' + (opt.labelW || '9rem') + ';--val-w:' + (opt.valW || '11rem') + (opt.ref ? ';--ref:' + (opt.ref / max) : '');
    return '<ul class="hbar' + (opt.ref ? ' hbar--ref' : '') + '" style="' + style + '">' +
      (opt.ref ? '<li class="hbar-row hbar-refhead" aria-hidden="true"><span></span><span class="hbar-track"><span class="hbar-reflabel">' + esc(opt.refLabel) + '</span></span></li>' : '') +
      rows.map(function (r) {
        return '<li class="hbar-row" data-tip="' + esc(r.tip) + '"><span class="hbar-label">' + esc(r.label) + '</span>' +
          '<span class="hbar-track' + (r.noRef ? ' no-ref' : '') + '" style="--p:' + (max ? r.value / max : 0) + '"><span class="hbar-fill"></span>' +
          '<span class="hbar-val">' + esc(r.text) + (r.note ? ' <strong>' + esc(r.note) + '</strong>' : '') + '</span></span></li>';
      }).join('') + '</ul>';
  }

  /* ---------- 그리기 ---------- */
  function render() {
    const period = $('#f-period').value, service = $('#f-service').value, unit = $('#f-unit').value;
    const months = monthsOf(period);
    const from = months[0], to = months[months.length - 1];
    const base = visible.filter(function (c) {
      return (!service || c.services.indexOf(service) > -1) && (!unit || C.teamOf(c.requesterId) === unit);
    });
    const signed = base.filter(function (c) {
      const d = signDate(c);
      return d && counted(c) && months.indexOf(d.slice(0, 7)) > -1;
    });
    const sum = function (list) { return list.reduce(function (a, c) { return a + c.amount; }, 0); };

    // 인쇄할 때 맨 위에 찍히는 조건
    $('#cond').textContent = '기간: ' + PERIODS.filter(function (p) { return p[0] === period; })[0][1] + '(' + from + '~' + to + '), 서비스: ' +
      (service ? D.SERVICES[service] : '전체') + ', 영업 유닛: ' + (unit || '전체') + ', 기준일: ' + C.fmtDate(D.TODAY) + (hiddenCount ? ', 열람 제한으로 뺀 계약 ' + hiddenCount + '건' : '');

    // 1. 한눈에 보기
    const kinds = {};
    signed.forEach(function (c) { kinds[c.kind] = (kinds[c.kind] || 0) + 1; });
    // 2026-11-09 5회차 점검: 조건 그대로 연장은 ④ 뒤 바로 ⑨, ⑩(운영 검토)으로 가고 체결일이 ⑩ 재무 확인일이라,
    //   운영 검토 동안 진행 중인 금액과 체결 금액 어디에도 들지 않았음(예: 2512CL001-R01). 그래서 이것도 진행 중으로 셈(REQ-DASH-19)
    const pipe = base.filter(function (c) {
      return (PIPELINE.indexOf(c.status) > -1 || (c.renewMode === 'AUTO' && c.status === 'OPS_REVIEW')) && !signDate(c) && counted(c);
    });
    // 기안부터 체결까지: 서명본 체결일까지(B-8). 날짜만 있어 그날 0시로 셈. 서명이 기안보다 앞선 예외는 0일
    const lead = signed.map(function (c) { return Math.max(0, daysFrom(c.requestedAt, signDate(c))); });
    // 체결한 달 뒤에 체결본을 올린 계약(B-8: 올린 때도 남김). 기간 말 앞뒤 확인은 아래 기간 마감 점검
    const lateUp = signed.filter(function (c) { const s = signInfo(c); return s.up && s.up.slice(0, 7) > s.date.slice(0, 7); }).length;
    const tiles = [
      // (2026-11-18 셋째 점검 screen-rules-03, W7-7 (가)) 시스템이 멈춘 동안 임시 결재로 진행해 사후 등록한 계약 수
      ['체결 금액', fmtMoney(sum(signed)), '서명본 체결일 기준' + (lateUp ? ', 체결한 달 뒤에 올린 ' + lateUp + '건 포함' : '') +
        (signed.filter(function (c) { return !!c.lateEntry; }).length ? ', 사후 등록 ' + signed.filter(function (c) { return !!c.lateEntry; }).length + '건 포함' : '')],
      // (설계 검토 2026-11-11 6번) 변경 가운데 줄임과 조항만이 있으면 괄호에 그 건수(금액은 부호대로 체결 금액에 든 것)
      ['체결 건수', signed.length + '건', AMOUNT_KINDS.filter(function (k) { return kinds[k]; }).map(function (k) {
        const off = k === 'AMEND' ? ['REDUCE', 'TERMS'].map(function (a) { const n = signed.filter(function (c) { return C.amendKindOf(c) === a; }).length; return n ? D.AMEND_KINDS[a] + ' ' + n + '건' : ''; }).filter(Boolean) : [];
        return D.KINDS[k] + ' ' + kinds[k] + '건' + (off.length ? '(' + off.join(', ') + ')' : '');
      }).join(', ') || '없음'],
      // 2026-11-09 5회차 점검: 조건 그대로 연장은 ⑩ 재무 확인 전까지 진행 중(위 pipe)이라 아래 줄에도 적음
      ['진행 중인 금액', fmtMoney(sum(pipe)), '기간과 상관없이 지금 검토부터 체결본 등록 전까지(조건 그대로 연장은 ⑩ 재무 확인 전까지) ' + pipe.length + '건'],
      ['기안부터 체결까지', lead.length ? '평균 ' + fmtDays(lead.reduce(function (a, b) { return a + b; }, 0) / lead.length) : '-',
        lead.length ? '가장 길었던 계약 ' + fmtDays(Math.max.apply(null, lead)) : '체결한 계약 없음'],
    ];
    $('#tiles').innerHTML = tiles.map(function (t) {
      return '<div class="stat-tile"><p class="stat-label">' + esc(t[0]) + '</p><p class="stat-value">' + esc(t[1]) + '</p><p class="stat-sub">' + esc(t[2]) + '</p></div>';
    }).join('');

    // 2. 달마다
    const by = {};
    months.forEach(function (k) { by[k] = { sum: 0, count: 0 }; });
    signed.forEach(function (c) { const k = signDate(c).slice(0, 7); by[k].sum += c.amount; by[k].count++; });
    $('#month-desc').innerHTML = from + '~' + to + '. 막대 위 글자는 가장 큰 달' + (months.indexOf(todayKey) > -1 ? '과 이번 달' : '') + '입니다.' +
      '<span class="no-print"> 달마다 건수와 금액은 막대에 마우스를 올리거나 아래 "표로 보기"를 펼쳐 봅니다.</span>';
    $('#month-chart').innerHTML = columnChart(months, by);
    // 표로 보기는 정확한 금액(합계 줄도). 그래프는 줄인 금액 그대로 (기획자 결정 2026-11-09 5회차 12번)
    $('#month-rows').innerHTML = months.map(function (k) {
      return '<tr><td class="center">' + monthLong(k) + (k === todayKey ? '<span class="cell-meta">' + Number(D.TODAY.slice(8)) + '일까지</span>' : '') + '</td>' +
        '<td class="num">' + by[k].count + '건</td><td class="num">' + C.fmtWon(by[k].sum) + '</td></tr>';
    }).join('') + '<tr class="row-total"><th scope="row" class="center">합계</th><td class="num">' + signed.length + '건</td><td class="num">' + C.fmtWon(sum(signed)) + '</td></tr>';

    // 3. 서비스마다, 영업 유닛마다 (두 서비스를 함께 계약한 건은 "함께"로 따로 셈: 금액을 나누지 않음)
    function group(keyOf) {
      const g = {};
      signed.forEach(function (c) { const k = keyOf(c); g[k] = g[k] || { sum: 0, count: 0 }; g[k].sum += c.amount; g[k].count++; });
      return Object.keys(g).map(function (k) { return { label: k, sum: g[k].sum, count: g[k].count }; })
        .sort(function (a, b) { return b.sum - a.sum; });
    }
    const svc = group(function (c) { return c.services.length > 1 ? '여러 서비스 함께' : D.SERVICES[c.services[0]] || c.services[0]; }); // 서비스는 CK, HR, 기타 (v0.56)
    const unt = group(function (c) { return C.teamOf(c.requesterId) || '조직 없음'; });
    const toRows = function (list) {
      // (설계 검토 2026-11-11 6번) 줄임 변경으로 합계가 0 아래인 묶음은 막대 길이 0(글자와 설명은 빼기 금액 그대로)
      return list.map(function (g) { return { label: g.label, value: Math.max(0, g.sum), text: fmtShort(g.sum) + ' 원', tip: g.label + ': ' + g.count + '건, ' + fmtMoney(g.sum) }; });
    };
    $('#service-chart').innerHTML = barChart(toRows(svc), { labelW: '10rem', valW: '7.2rem' });
    $('#unit-chart').innerHTML = barChart(toRows(unt), { labelW: '10rem', valW: '7.2rem' });
    // 표로 보기는 정확한 금액. 가로 막대 글자와 마우스 설명은 줄인 금액 그대로 (기획자 결정 2026-11-09 5회차 12번)
    $('#split-rows').innerHTML = [['서비스', svc], ['영업 유닛', unt]].map(function (p) {
      return p[1].map(function (g) { return '<tr><td class="center">' + p[0] + '</td><td>' + esc(g.label) + '</td><td class="num">' + g.count + '건</td><td class="num">' + C.fmtWon(g.sum) + '</td></tr>'; }).join('');
    }).join('') || '<tr><td colspan="4" class="empty-row">이 조건에서 체결한 계약이 없습니다.</td></tr>';

    // 4. 결재 단계마다 걸린 날: 기간 안에 처리한 단계(차례가 온 때 → 처리한 때)
    const st = {};
    base.forEach(function (c) {
      (c.approvals || []).forEach(function (a) {
        const k = stepKey(a.step, c); // 전자계약의 ⑥ ⑦ ⑧은 따로(설계 검토 2026-11-11 남은 것 ④)
        if (a.state !== 'DONE' || !a.arrivedAt || !a.decidedAt || !STEP_NAMES[k]) return;
        if (months.indexOf(a.decidedAt.slice(0, 7)) < 0) return;
        const d = Math.max(0, daysFrom(a.arrivedAt, a.decidedAt));
        st[k] = st[k] || [];
        st[k].push(d);
      });
    });
    const LIMIT = D.ALERT_RULES.approvalDelayDays, SIGN_LIMIT = D.ALERT_RULES.signDelayDays;
    const steps = Object.keys(STEP_NAMES).filter(function (k) { return st[k]; }).map(function (k) {
      const avg = st[k].reduce(function (a, b) { return a + b; }, 0) / st[k].length;
      const limit = k === 'S07' || k === 'S07E' ? SIGN_LIMIT : LIMIT; // 전자계약의 ⑦ 출력본 등록도 승인 뒤 기준
      return { code: k, avg: avg, n: st[k].length, max: Math.max.apply(null, st[k]), over: avg > limit };
    });
    $('#step-desc').textContent = '차례가 온 때부터 처리한 때까지의 평균입니다(기간 안에 처리한 것). 세로선은 오래 머문 것으로 보는 기준 ' + LIMIT +
      '일입니다(⑦ 체결본이나 출력본 등록은 승인 뒤 ' + SIGN_LIMIT + '일).';
    $('#step-chart').innerHTML = barChart(steps.map(function (s) {
      return { label: STEP_NAMES[s.code], value: s.avg, text: fmtDays(s.avg), note: s.over ? '기준 넘음' : '', noRef: s.code === 'S07' || s.code === 'S07E',
        tip: STEP_NAMES[s.code] + ': ' + s.n + '번 처리, 평균 ' + fmtDays(s.avg) + ', 가장 길었던 날 ' + fmtDays(s.max) };
    }), { labelW: '11rem', valW: '9rem', ref: LIMIT, refLabel: '기준 ' + LIMIT + '일' });
    $('#step-rows').innerHTML = steps.map(function (s) {
      return '<tr><td>' + STEP_NAMES[s.code] + '</td><td class="num">' + s.n + '번</td><td class="num">' + fmtDays(s.avg) + (s.over ? '<span class="cell-meta">기준 넘음</span>' : '') + '</td><td class="num">' + fmtDays(s.max) + '</td></tr>';
    }).join('') || '<tr><td colspan="4" class="empty-row">이 조건에서 처리한 결재가 없습니다.</td></tr>';

    // 5. 체크리스트 예외
    const withCk = signed.filter(function (c) { return c.checklist; });
    $('#check-meters').innerHTML = withCk.length ? CHECKS.map(function (q) {
      const n = withCk.filter(function (c) { return c.checklist[q[0]] === q[1]; }).length;
      const pct = Math.round(n / withCk.length * 100);
      return '<div class="meter"><p class="meter-head"><span class="meter-label">' + esc(q[2]) + '<span class="meter-sub">' + esc(q[3]) + '</span></span>' +
        '<span class="meter-val">' + withCk.length + '건 중 ' + n + '건(' + pct + '%)</span></p>' +
        '<span class="meter-track" role="img" aria-label="' + esc(q[2] + ': ' + withCk.length + '건 중 ' + n + '건, ' + pct + '%') + '"><span class="meter-fill" style="width:' + pct + '%"></span></span></div>';
    }).join('') : '<p class="chart-empty">이 조건에서 체결한 계약이 없습니다.</p>';
    // 견적서: 기간 안에 처음 출력한 견적 가운데 할인율 한도를 넘는 줄이 있는 것 (v0.62, 표준 대응표 G-01 남은 것).
    //   견적을 볼 수 있는 역할만, 볼 수 있는 견적만 셈(C.canSeeQuote). 견적 단계는 승인이 없고 알림만 있으므로(REQ-QUO) 참고 수치
    if (seeQuotes) {
      const qs = C.allQuotes().filter(function (q) {
        const first = (q.issues || [])[0];
        // 감사 열람(C-2)은 견적 화면을 열지 않지만 전체 통계로 모든 견적을 셈(아래 범위 글은 "모든 견적")
        if (!first || !(C.isAuditor(me) || C.canSeeQuote(me, q)) || months.indexOf(String(first.at).slice(0, 7)) < 0) return false;
        if (unit && C.teamOf(q.owner) !== unit) return false;
        return !service || (q.lines || []).some(function (l) { const p = PRICE_OF(l.feature); return p && p.service === service; });
      });
      const nOver = qs.filter(C.quoteOverCap).length, qpct = qs.length ? Math.round(nOver / qs.length * 100) : 0;
      const label = '견적서: 할인율 한도를 넘는 줄이 있음';
      const scope = me.role === 'SALES' ? '내가 만든 견적' : me.role === 'HEAD' ? '내 유닛의 견적' : '모든 견적'; // C.canSeeQuote와 같은 범위
      $('#check-meters').insertAdjacentHTML('beforeend', '<div class="meter"><p class="meter-head"><span class="meter-label">' + label + '<span class="meter-sub">견적 단계(승인 없이 알림만), ' + scope + '</span></span>' +
        '<span class="meter-val">' + (qs.length ? '출력한 견적 ' + qs.length + '건 중 ' + nOver + '건(' + qpct + '%)' : '출력한 견적 없음') + '</span></p>' +
        '<span class="meter-track" role="img" aria-label="' + esc(label + ': ' + (qs.length ? '출력한 견적 ' + qs.length + '건 중 ' + nOver + '건, ' + qpct + '%' : '출력한 견적 없음')) + '"><span class="meter-fill" style="width:' + qpct + '%"></span></span></div>');
    }
    // 계약 방식과 거래처마다 2, 3번 예외 (v0.62, 표준 대응표 G-19: 간접 거래처에 할인이 몰리는지 봄). 거래처는 예외가 있는 곳만, 많은 순
    const exc = function (list, k) { return list.filter(function (c) { return c.checklist[k] === 'NO'; }).length; };
    const byKey = function (keyOf, labelOf) {
      const g = {};
      withCk.forEach(function (c) { const k = keyOf(c); (g[k] = g[k] || []).push(c); });
      return Object.keys(g).map(function (k) { return { label: labelOf(g[k][0]), list: g[k], price: exc(g[k], 'price'), cap: exc(g[k], 'cap') }; });
    };
    const methodName = function (c) { return D.METHODS[C.methodOf(c)]; };
    const byMethod = byKey(methodName, methodName)
      .sort(function (a, b) { return Object.values(D.METHODS).indexOf(a.label) - Object.values(D.METHODS).indexOf(b.label); });
    // 거래처는 거래처와 계약 방식을 함께 묶음(한 거래처와 직접, 간접 계약이 모두 있으면 줄을 나눔. 검토에서 고침)
    const byCustomer = byKey(function (c) { return c.counterparty + '\u0000' + C.methodOf(c); }, function (c) { return c.counterparty; })
      .filter(function (g) { return g.price || g.cap; })
      .sort(function (a, b) { return b.cap - a.cap || b.price - a.price || b.list.length - a.list.length; });
    const CUST_MAX = 10;
    const excRow = function (kind, g, extra) {
      return '<tr><td class="center">' + kind + '</td><td>' + esc(g.label) + (extra || '') + '</td><td class="num">' + g.list.length + '건</td><td class="num">' + g.price + '건</td><td class="num">' + g.cap + '건</td></tr>';
    };
    $('#check-split-rows').innerHTML = byMethod.map(function (g) { return excRow('계약 방식', g); }).join('') +
      byCustomer.slice(0, CUST_MAX).map(function (g) { return excRow('거래처', g, '<span class="cell-meta">' + esc(D.METHODS[C.methodOf(g.list[0])]) + '</span>'); }).join('') ||
      '<tr><td colspan="5" class="empty-row">이 조건에서 체결한 계약이 없습니다.</td></tr>';
    $('#check-split-more').textContent = byCustomer.length > CUST_MAX ? '예외가 있는 거래처 ' + byCustomer.length + '줄 가운데 많은 순으로 ' + CUST_MAX + '줄만 보입니다.' : '';
    $('#check-split-more').hidden = byCustomer.length <= CUST_MAX;

    // 6. 체결본 확인 반려 항목(v0.61, 표준 대응표 G-06): ⑧ 반려 때 고른 어긋난 항목(결재 기록의 mismatch 코드). 코드가 없는 예전 기록은 "고르지 않음"
    const mis = {};
    let rejects = 0;
    base.forEach(function (c) {
      (c.history || []).forEach(function (h) {
        if (h.step !== 'S08' || h.action !== 'REJECT' || months.indexOf(String(h.at).slice(0, 7)) < 0) return;
        rejects++;
        (h.mismatch && h.mismatch.length ? h.mismatch : ['NONE']).forEach(function (k) { mis[k] = (mis[k] || 0) + 1; });
      });
    });
    const misRows = D.SIGNED_MISMATCH.concat([{ code: 'NONE', label: '고르지 않음(예전 기록)' }]).filter(function (x) { return mis[x.code]; });
    $('#signed-meters').innerHTML = rejects ? misRows.map(function (x) {
      const n = mis[x.code], pct = Math.round(n / rejects * 100);
      return '<div class="meter"><p class="meter-head"><span class="meter-label">' + esc(x.label) + '</span>' +
        '<span class="meter-val">반려 ' + rejects + '건 중 ' + n + '건(' + pct + '%)</span></p>' +
        '<span class="meter-track" role="img" aria-label="' + esc(x.label + ': 반려 ' + rejects + '건 중 ' + n + '건, ' + pct + '%') + '"><span class="meter-fill" style="width:' + pct + '%"></span></span></div>';
    }).join('') : '<p class="chart-empty">이 조건에서 체결본 확인을 반려한 계약이 없습니다.</p>';

    // 7. 보완 요청 항목(v0.63, 표준 대응표 G-05): ②~⑤ 보완 요청 때 고른 항목(결재 기록의 supplementItems 코드). 코드가 없는 예전 기록은 "고르지 않음"
    const why = {};
    let supps = 0;
    base.forEach(function (c) {
      (c.history || []).forEach(function (h) {
        if (h.action !== 'SUPPLEMENT' || months.indexOf(String(h.at).slice(0, 7)) < 0) return;
        supps++;
        (h.supplementItems && h.supplementItems.length ? h.supplementItems : ['NONE']).forEach(function (k) { why[k] = (why[k] || 0) + 1; });
      });
    });
    const whyRows = D.SUPPLEMENT_ITEMS.concat([{ code: 'NONE', label: '고르지 않음(예전 기록)' }]).filter(function (x) { return why[x.code]; });
    $('#supplement-meters').innerHTML = supps ? whyRows.map(function (x) {
      const n = why[x.code], pct = Math.round(n / supps * 100);
      return '<div class="meter"><p class="meter-head"><span class="meter-label">' + esc(x.label) + '</span>' +
        '<span class="meter-val">보완 요청 ' + supps + '건 중 ' + n + '건(' + pct + '%)</span></p>' +
        '<span class="meter-track" role="img" aria-label="' + esc(x.label + ': 보완 요청 ' + supps + '건 중 ' + n + '건, ' + pct + '%') + '"><span class="meter-fill" style="width:' + pct + '%"></span></span></div>';
    }).join('') : '<p class="chart-empty">이 조건에서 보완을 요청한 계약이 없습니다.</p>';

    // 11. 계약 뒤쪽 (설계 검토 2026-11-11 3장): 모두 봄(지금 통계와 같음) [가정]. 아래 renderAfter
    renderAfter(base, months, service, unit);

    // 9. 통제 지표 (기획자 결정 2026-11-02 C-1: 리더, 임원, 감사 열람만)
    if (seeControls) renderControls(withCk, base, months, signed);
  }

  /* ---------- 9. 통제 지표 (기획자 결정 2026-11-02 C-1, 리더와 임원과 감사 열람만) ----------
   * 가. 4번 조건의 종류(B-6, CTL-52): 체결한 계약 가운데 4번이 예인 계약을 고른 종류(checklist.acctKinds, D.ACCT_KINDS)마다 셈
   *     한 계약이 여러 종류를 고를 수 있어 합이 4번 예 건수보다 클 수 있음. 종류를 두기 전 기록은 "고르지 않음(예전 기록)"
   * 나. ④ 반부패 조항 판단(C-15, CTL-34): 표준계약서를 바꾼 계약 가운데 기간 안에 ④ 승인이 끝난 계약을 계약 방식마다
   *     있고 약해지지 않음(KEPT), 없음(NONE), 고르지 않음(직접은 선택, 판단을 두기 전 기록)으로 셈(C.legalApproval)
   *     "없음"은 전체 계약의 거르기(contracts.html?ab=NONE)로 이어짐
   * 다. 평균 할인(C-1): 체결한 계약마다 표준 금액(C.contractStd: 기안일에 쓰던 표준 단가, 고객사 티어 단가가 있으면 그 값, x 수량, 기간제는 x 달 수 / 12) 대비 할인율을 구해 단순 평균 [가정]
   *     영업(기안한 영업), 영업 유닛, 기관 종류(사업자등록번호 가운데 두 자리), 계약 방식마다. 제품 줄이 없는 계약은 셀 수 없어 뺌
   *     시스템 도입 전에 기안한 계약은 도입 때 넣은 첫 가격 기준으로 셈 [가정: 그 전 가격 기준이 시스템에 없음]
   * 라. 대리 결재(C-1): 기간 안의 결재 기록 가운데 담당자가 아닌 사람이 처리한 것. 대리 지정으로 처리(근거 있음)와
   *     대리 지정 없이 처리(시연의 최고관리자. 운영에서는 0건이어야 함, C-5 "운영에서 최고관리자는 결재 단계를 처리하지 않음")를 나눔
   * 마. 위험 신호(C-1) [가정: 날 수는 C-1 답의 30일, 5일]
   *     같은 거래처와 30일 안에 두 건 이상: 사업자등록번호가 같은 계약(신규, 변경, 바꿔서 연장)을 기안일 순으로 이어, 앞 계약과 30일 안이면 한 묶음.
   *       두 건 이상이고 한 건이라도 기안일이 기간 안인 묶음. 해지, 조건 그대로 연장, 운영 변경은 넣지 않음(같은 거래처 최근 계약 E-2와 같음)
   *     분기 말 5일 안의 가격 예외: 체크리스트 2번이나 3번이 아니요인 계약 가운데 ③ 승인일(③을 거치지 않았으면 기안일)이 분기 마지막 날까지 5일 안
   * 열람 제한 계약 가운데 볼 수 없는 건은 넣지 않음(위 조건의 base와 signed가 이미 뺌). 감사 열람은 모두 셈 */
  const RISK_DAYS = 30, QEND_DAYS = 5;
  function pct1(n) { return (Math.round(n * 1000) / 10).toLocaleString('ko-KR') + '%'; }
  // 2026-11-09 5회차 점검: 줄의 표준 단가와 한도. E-4대로 기안 때 줄에 남긴 값(l.listPrice, l.cap)을 먼저, 없으면 기안한 날의 가격 줄
  //   (예전에는 기안한 날의 가격 줄만 봐서, 기안한 날부터 적용하는 가격을 더하면 통계만 할인 예외 점검, 결재 문서와 다른 할인율이 나왔음.
  //   discount-review.js, common.js capOver와 같은 모양. 줄에 단가가 있으면 가격 줄이 없어도 셈)
  //   (설계 검토 2026-11-11 4번, 4-1 3-1) 줄의 표준 금액은 공통 셈(C.contractStd: 기간제는 계약 기간 달 수에 비례, 고객사 티어 단가, 남긴 값을 먼저)
  //     결재선(C.capOver), 결재 문서, 할인 예외 점검과 같은 값. 반환 { std: 줄의 표준 금액, cap } 또는 null(셀 수 없음)
  function lineStd(x) {
    const q = Number(x.line.qty) || 0;
    return x.s && q && x.s.std ? { std: x.s.std, cap: x.s.cap } : null;
  }
  // 계약의 할인율(표준 금액 대비). 셀 수 없으면 null
  function discountOf(c) {
    let std = 0, amt = 0;
    C.contractStd(c).forEach(function (x) {
      const s = lineStd(x);
      if (!s) return;
      std += s.std; amt += x.amount;
    });
    return std ? (std - amt) / std : null;
  }
  // 한 줄이라도 할인율 한도를 넘은 가장 큰 폭(%p). 셀 수 없으면 null (증빙 내보내기의 ③ 가격 예외)
  function overPpOf(c) {
    let max = null;
    // (2026-11-17 다른 눈 oversight-01) ③을 거친 줄임은 기안 때 남긴 변경 뒤 할인율(reduceOver)로 넘은 폭을 셈
    if (c.reduceOver && c.reduceOver.feats) {
      c.reduceOver.feats.forEach(function (f) {
        if (!f.over || f.discount == null) return;
        const pp = Math.round((f.discount - f.cap) * 1000) / 10;
        max = max == null ? pp : Math.max(max, pp);
      });
      return max;
    }
    C.contractStd(c).forEach(function (x) {
      const s = lineStd(x);
      if (!s) return;
      const pp = Math.round(((s.std - x.amount) / s.std - s.cap) * 1000) / 10;
      max = max == null ? pp : Math.max(max, pp);
    });
    return max;
  }
  // 사업자등록번호(숫자만): 계약에 적은 번호(후속 기안은 원계약), 없으면 거래처 목록에서 상호가 같은 곳 (결재 문서의 같은 거래처 최근 계약과 같음)
  function bizDigits(c) {
    const root = c.parentId ? D.CONTRACTS.filter(function (y) { return y.id === c.parentId; })[0] : null;
    const no = (c.form && c.form.bizNo) || (root && root.form && root.form.bizNo) ||
      (D.CUSTOMERS.filter(function (cu) { return cu.name === c.counterparty; })[0] || {}).bizNo || '';
    return String(no).replace(/\D/g, '');
  }
  // 기관 종류 [가정]: 사업자등록번호 가운데 두 자리. 83 국가와 지자체, 82 비영리법인(학교, 재단, 병원 등), 81, 85~88 영리법인, 그 밖은 개인사업자와 단체
  function orgKind(c) {
    const d = bizDigits(c), m = d.slice(3, 5);
    if (d.length !== 10) return '번호 없음';
    if (m === '83') return '국가와 지자체';
    if (m === '82') return '비영리법인';
    return ['81', '85', '86', '87', '88'].indexOf(m) > -1 ? '영리법인' : '개인사업자와 단체';
  }
  function renderDiscount(all) {
    // (설계 검토 2026-11-11 6번) 줄임과 조항만 변경은 표준 단가와 견주지 않아 할인을 세지 않음(아래 안내 한 줄에 건수)
    const signed = all.filter(function (c) { return !C.priceCheckOff(c); }), offN = all.length - signed.length;
    const rows = signed.map(function (c) { return { c: c, d: discountOf(c) }; }).filter(function (x) { return x.d != null; });
    const skip = signed.length - rows.length;
    const groups = [['영업', function (c) { return C.ownerLabel(c.requesterId); }], ['영업 유닛', function (c) { return C.teamOf(c.requesterId) || '조직 없음'; }],
      ['기관 종류', orgKind], ['계약 방식', function (c) { return D.METHODS[C.methodOf(c)]; }]];
    $('#disc-rows').innerHTML = rows.length ? groups.map(function (g) {
      const by = {};
      rows.forEach(function (x) { const k = g[1](x.c); (by[k] = by[k] || []).push(x.d); });
      return Object.keys(by).map(function (k) {
        const list = by[k], avg = list.reduce(function (a, b) { return a + b; }, 0) / list.length;
        return { k: k, n: list.length, avg: avg, max: Math.max.apply(null, list) };
      }).sort(function (a, b) { return b.avg - a.avg; }).map(function (r) {
        return '<tr><td class="center">' + g[0] + '</td><td>' + esc(r.k) + '</td><td class="num">' + r.n + '건</td><td class="num">' + pct1(r.avg) + '</td><td class="num">' + pct1(r.max) + '</td></tr>';
      }).join('');
    }).join('') : '<tr><td colspan="5" class="empty-row">이 조건에서 할인을 셀 수 있는 체결 계약이 없습니다.</td></tr>';
    // 늘 한 줄이 있어 화면이 흔들리지 않음
    $('#disc-skip').textContent = (skip ? '제품 줄이 없어 할인을 셀 수 없는 체결 계약 ' + skip + '건은 넣지 않았습니다.' : offN ? '' : '이 조건의 체결 계약은 모두 셌습니다.') +
      (offN ? (skip ? ' ' : '') + '줄임과 조항만 바꾼 변경 ' + offN + '건은 표준 단가와 견주지 않아 넣지 않았습니다.' : ''); // (설계 검토 2026-11-11 6번)
  }
  function renderProxy(base, months) {
    const list = [];
    base.forEach(function (c) {
      (c.history || []).forEach(function (h) {
        if (h.onBehalfOf && months.indexOf(String(h.at).slice(0, 7)) > -1) list.push({ c: c, h: h });
      });
    });
    list.sort(function (a, b) { return String(b.h.at).localeCompare(String(a.h.at)); });
    const n1 = list.filter(function (x) { return x.h.delegationId; }).length;
    $('#proxy-sum').innerHTML = C.meta([['대리 지정으로 처리', n1 + '건'], ['대리 지정 없이 담당자가 아닌 사람이 처리', (list.length - n1) + '건']]);
    $('#proxy-rows').innerHTML = list.length ? list.map(function (x) {
      return '<tr>' + custCell(x.c) + '<td class="nowrap">' + esc(C.stepTag(x.h.step, x.c)) + '<span class="cell-meta">' + esc(C.actionLabel(x.h, x.c)) + '</span></td>' +
        '<td class="center">' + esc(C.ownerLabel(x.h.actorId, x.h.actorDept)) + '<span class="cell-meta">' + esc(C.ownerLabel(x.h.onBehalfOf)) + ' 대신</span></td>' +
        '<td class="num-left">' + C.fmtDateTime(x.h.at) + '</td>' +
        '<td>' + (x.h.delegationId ? esc(x.h.basis || '-') + '<span class="cell-meta">대리 지정 ' + esc(x.h.delegationId) + '</span>' : C.badge('attention', '대리 지정 없음')) + '</td></tr>';
    }).join('') : '<tr><td colspan="5" class="empty-row">이 조건에서 담당자가 아닌 사람이 처리한 결재가 없습니다.</td></tr>';
  }
  function qEndOf(day) {
    const y = Number(day.slice(0, 4)), em = Math.ceil(Number(day.slice(5, 7)) / 3) * 3;
    return y + '-' + String(em).padStart(2, '0') + '-' + String(new Date(y, em, 0).getDate()).padStart(2, '0');
  }
  function renderRisk(base, months) {
    const out = [];
    // 같은 거래처와 30일 안에 두 건 이상
    const by = {};
    base.forEach(function (c) {
      if (!c.requestedAt || c.kind === 'TERMINATE' || c.kind === 'CHANGE' || c.renewMode === 'AUTO') return;
      const no = bizDigits(c);
      if (no) (by[no] = by[no] || []).push(c);
    });
    Object.keys(by).forEach(function (no) {
      const list = by[no].sort(function (a, b) { return String(a.requestedAt).localeCompare(String(b.requestedAt)); });
      let chain = [];
      const flush = function () {
        if (chain.length > 1 && chain.some(function (c) { return months.indexOf(String(c.requestedAt).slice(0, 7)) > -1; })) {
          out.push({ kind: 'SAME', list: chain, day: String(chain[0].requestedAt).slice(0, 10), last: String(chain[chain.length - 1].requestedAt).slice(0, 10) });
        }
        chain = [];
      };
      list.forEach(function (c) {
        if (chain.length && daysFrom(chain[chain.length - 1].requestedAt.slice(0, 10), c.requestedAt.slice(0, 10)) > RISK_DAYS) flush();
        chain.push(c);
      });
      flush();
    });
    // 분기 말 5일 안의 가격 예외
    base.forEach(function (c) {
      const ck = c.checklist || {};
      if (ck.price !== 'NO' && ck.cap !== 'NO' && !(c.reduceOver && c.reduceOver.over)) return; // ③을 거친 줄임도(2026-11-17 다른 눈 oversight-01)
      const s03 = (c.approvals || []).filter(function (a) { return a.step === 'S03' && a.state === 'DONE' && a.decidedAt; })[0];
      const day = String(s03 ? s03.decidedAt : c.requestedAt || '').slice(0, 10);
      if (!day || months.indexOf(day.slice(0, 7)) < 0) return;
      const end = qEndOf(day);
      if (daysFrom(day, end) < QEND_DAYS) out.push({ kind: 'QEND', list: [c], day: day, end: end, s03: !!s03 });
    });
    out.sort(function (a, b) { return b.day.localeCompare(a.day); });
    const sum = function (list) { return list.reduce(function (n, c) { return n + (counted(c) ? c.amount : 0); }, 0); };
    $('#risk-rows').innerHTML = out.length ? out.map(function (r) {
      const c = r.list[0];
      const name = '<a class="cell-title" href="review.html?id=' + encodeURIComponent(c.id) + '">' + esc(c.counterparty) + '</a>' +
        '<span class="cell-meta">' + r.list.map(function (x) { return esc(x.id) + (x.restricted ? ' ' + C.icon('lock', 'sm') : ''); }).join(', ') + '</span>';
      return r.kind === 'SAME'
        ? '<tr><td>' + C.badge('attention', '같은 거래처') + '<span class="cell-meta">' + RISK_DAYS + '일 안에 ' + r.list.length + '건</span></td><td>' + name + '</td>' +
          '<td class="num-left">' + C.fmtPeriod(r.day, r.last) + '<span class="cell-meta">기안일</span></td><td class="num">' + C.fmtWon(sum(r.list)) + '</td></tr>'
        : '<tr><td>' + C.badge('attention', '분기 말 가격 예외') + '<span class="cell-meta">분기 마지막 날 ' + C.fmtDate(r.end) + '</span></td><td>' + name + '</td>' +
          '<td class="num-left">' + C.fmtDate(r.day) + '<span class="cell-meta">' + (r.s03 ? '③ 승인일' : '기안일') + '</span></td><td class="num">' + C.fmtWon(sum(r.list)) + '</td></tr>';
    }).join('') : '<tr><td colspan="4" class="empty-row">이 조건에서 위험 신호가 없습니다.</td></tr>';
  }
  // sub: 이름 옆 작은 글자(선택). (설계 검토 2026-11-11 3장) 계약 뒤쪽 묶음이 나눈 건수를 적으려고 더함
  function meterHtml(label, n, of, unit, sub) {
    const pct = of ? Math.round(n / of * 100) : 0;
    return '<div class="meter"><p class="meter-head"><span class="meter-label">' + esc(label) + (sub ? '<span class="meter-sub">' + esc(sub) + '</span>' : '') + '</span>' +
      '<span class="meter-val">' + unit + ' ' + of + '건 중 ' + n + '건(' + pct + '%)</span></p>' +
      '<span class="meter-track" role="img" aria-label="' + esc(label + ': ' + unit + ' ' + of + '건 중 ' + n + '건, ' + pct + '%') + '"><span class="meter-fill" style="width:' + pct + '%"></span></span></div>';
  }
  function renderControls(withCk, base, months, signed) {
    renderDiscount(signed);
    renderProxy(base, months);
    renderRisk(base, months);
    const acc = withCk.filter(function (c) { return c.checklist.accounting === 'YES'; });
    const kinds = (D.ACCT_KINDS || []).concat([{ code: 'NONE', label: '고르지 않음(예전 기록)' }]);
    const cnt = {};
    acc.forEach(function (c) { ((c.checklist.acctKinds || []).length ? c.checklist.acctKinds : ['NONE']).forEach(function (k) { cnt[k] = (cnt[k] || 0) + 1; }); });
    $('#acct-meters').innerHTML = acc.length ? kinds.filter(function (k) { return cnt[k.code] || k.code !== 'NONE'; }).map(function (k) {
      return meterHtml(k.label, cnt[k.code] || 0, acc.length, '4번 예');
    }).join('') : '<p class="chart-empty">이 조건에서 체결한 계약 가운데 4번이 예인 계약이 없습니다.</p>';

    const rows = {};
    base.forEach(function (c) {
      if (!c.checklist || c.checklist.standard !== 'NO') return;
      const h = C.legalApproval(c);
      if (!h || months.indexOf(String(h.at).slice(0, 7)) < 0) return;
      const m = C.methodOf(c), r = rows[m] = rows[m] || { all: 0, KEPT: 0, NONE: 0, '': 0 };
      r.all++; r[h.antiBribe === 'KEPT' || h.antiBribe === 'NONE' ? h.antiBribe : '']++;
    });
    const need = D.ANTI_BRIBE.required;
    $('#ab-rows').innerHTML = Object.keys(D.METHODS).filter(function (m) { return rows[m]; }).map(function (m) {
      const r = rows[m];
      return '<tr><td>' + esc(D.METHODS[m]) + '<span class="cell-meta">' + (need.indexOf(m) > -1 ? '꼭 고름' : '골라도 되고 안 골라도 됨') + '</span></td>' +
        '<td class="num">' + r.all + '건</td><td class="num">' + r.KEPT + '건</td>' +
        '<td class="num">' + (r.NONE ? '<a href="contracts.html?ab=NONE">' + r.NONE + '건</a>' : '0건') + '</td>' +
        '<td class="num">' + r[''] + '건' + (need.indexOf(m) > -1 && r[''] ? '<span class="cell-meta">판단을 두기 전 기록</span>' : '') + '</td></tr>';
    }).join('') || '<tr><td colspan="5" class="empty-row">이 조건에서 ④ 법무가 승인한 계약(표준계약서를 바꾼 계약)이 없습니다.</td></tr>';
  }

  /* ---------- 11. 계약 뒤쪽 (설계 검토 2026-11-11 3장 "통계에 계약 뒤쪽 숫자", 가장 뒤 순위) ----------
   * 계약을 맺은 뒤의 일을 위 조건(기간, 서비스, 영업 유닛)으로 셈. 볼 수 있는 사람은 모두(REQ-DASH-17, 지금 통계와 같음) [가정]
   *   통제 지표(C-1, 사람이나 유닛마다 나눠 봄)와 달리 회사 전체의 건수와 비율이라 모두에게 보임. 리더와 임원만 보게 하려면 이 묶음을 #control-panel 안으로 옮기면 됨
   * 넣지 않는 것: 열람 제한 계약 중 볼 수 없는 건, 예전 계약 기록 자체(설계 검토 5번, 위 all이 이미 뺌), 진행 중단(7번)과 반려되어 다시 기안을 기다리는 기안
   *   예전 계약 기록에 이어 시스템에서 기안한 연장, 운영 변경, 해지와 그 묶음의 의무는 셈(5번의 "후속 계약은 셈"과 같은 생각) [가정]
   * 가. 운영 변경: 기안일이 기간 안인 운영 변경을 종류(D.CHANGE_TYPES)마다. 진행 중인 것도 세고 "계약 완료" 칸에 끝난 것만 따로 [가정]
   *     충전 수량은 기안한 수량(CK와 HR은 단위가 달라 합계를 내지 않음, B-4와 같음), 유상 금액은 changeAmount(부가세 별도)
   *     무상 충전 가운데 계약 연도 누적 50건을 넘어 ③ 영업 검토를 거치는(거친) 건수를 작은 줄로(B-4, REQ-CHG-07). 서비스를 고르면 그 서비스의 충전과 기간 변경만
   *   기간 변경 길이: 바꾸기 전 종료일(oldEndDate)과 새 종료일(endDate) 사이 날 수. 늘림과 줄임마다 건수, 평균, 가장 긴 것
   *     달 수는 REQ-CHG-07의 세는 법(C.monthsLater, 말일이면 말일 기준)으로 1개월 안, 2개월 안, 2개월 넘음(설계 검토 8번, 8-1의 2개월 한도를 두기 전 기록)
   * 나. 만료 처리 결과 [가정]: 종료일(해지했으면 해지일)이 기간 안이고 오늘 전인 계약 기간마다 어떻게 되었는지
   *     계약 기간 = 원계약과 계약 완료된 연장(조건 그대로 연장 포함) 하나하나. 뒤에 계약 완료된 연장이 있는 앞 계약 기간은 "연장"
   *     지금 유효한 계약 기간은 만료 처리와 유예(C.expiryOf, A-10, A-11): 연장이나 새 계약(계약 완료, 진행 중), 유예 중, 만료(서비스 닫음, 닫기 전)
   *     해지한 묶음은 "해지"(해지일이 원래 종료일보다 앞이면 해지일로 봄). 유예를 확인받았던 계약 기간 수는 아래 한 줄에 따로
   * 다. 해지: 기안일이 기간 안인 해지. 해지일과 원래 종료일보다 몇 달 먼저인지(C.periodMonths, 남는 날은 한 달로), 지금 상태, 사유
   * 라. 의무를 기한 안에 한 비율 [가정]: 한 번과 되풀이 의무의 기한(C.obligationDues) 가운데 기간 안이고 오늘 전인 것과, 오늘 뒤라도 이미 이행 기록을 남긴 것
   *     그 기한의 첫 이행 기록을 남긴 날이 기한 날까지면 "기한 안에 함", 뒤면 "기한 뒤에 함", 기록이 없으면 "아직 하지 않음"
   *     끝낸 의무는 끝낸 날 뒤의 기한을 넣지 않음. 일이 생기면 하는 의무는 기한이 없어 비율에 넣지 않고 기간 안에 남긴 기록 건수만
   *     의무는 묶음에 붙으므로 원계약으로 거름(볼 수 있는지, 서비스, 영업 유닛)
   * 인쇄: 보고서 인쇄에 들어감(그래프 옆 "표로 보기"가 아닌 펼쳐진 표라 종이에도 찍힘) */
  const AFTER_OUT = ['DRAFT', 'REJECTED', 'STOPPED'];
  function inMonths(day, months) { return !!day && months.indexOf(String(day).slice(0, 7)) > -1; }
  function renderAfter(base, months, service, unit) {
    // 가. 운영 변경 (종류마다 한 줄. 줄 수는 서비스 조건으로만 바뀜)
    const chg = base.filter(function (c) { return c.kind === 'CHANGE' && AFTER_OUT.indexOf(c.status) < 0 && inMonths(c.requestedAt, months); });
    const types = Object.keys(D.CHANGE_TYPES).filter(function (t) { return !service || t === 'PERIOD' || t.split('_')[0] === service; });
    const shown = chg.filter(function (c) { return types.indexOf(c.changeType) > -1; });
    const sumOf = function (list, k) { return list.reduce(function (n, c) { return n + (Number(c[k]) || 0); }, 0); };
    const doneOf = function (list) { return list.filter(function (c) { return c.status === 'ACTIVE'; }).length; };
    $('#after-change-rows').innerHTML = types.map(function (t) {
      const g = shown.filter(function (c) { return c.changeType === t; });
      const s03 = /_FREE$/.test(t) ? g.filter(function (c) { return (c.approvals || []).some(function (a) { return a.step === 'S03' && a.state !== 'SKIPPED'; }); }).length : 0;
      return '<tr><td>' + esc(D.CHANGE_TYPES[t]) + (s03 ? '<span class="cell-meta">누적 50건을 넘어 ③ 영업 검토 ' + s03 + '건</span>' : '') + '</td>' +
        '<td class="num">' + g.length + '건</td><td class="num">' + doneOf(g) + '건</td>' +
        '<td class="num">' + (t === 'PERIOD' ? '-' : sumOf(g, 'changeQty').toLocaleString('ko-KR') + '건') + '</td>' +
        '<td class="num">' + (/_PAID$/.test(t) ? C.fmtWon(sumOf(g, 'changeAmount')) : '-') + '</td></tr>';
    }).join('') + '<tr class="row-total"><th scope="row">합계</th><td class="num">' + shown.length + '건</td><td class="num">' + doneOf(shown) + '건</td>' +
      '<td class="num">-</td><td class="num">' + C.fmtWon(sumOf(shown, 'changeAmount')) + '</td></tr>';
    // 기간 변경 길이. 늘 한 줄이 있어 조건을 바꿔도 화면이 흔들리지 않음
    const per = shown.filter(function (c) { return c.changeType === 'PERIOD' && c.oldEndDate && c.endDate && c.endDate !== c.oldEndDate; });
    const len = function (c) { return Math.abs(Math.round(daysFrom(c.oldEndDate, c.endDate))); };
    const within = function (c, n) { return c.endDate <= C.monthsLater(c.oldEndDate, n) && c.endDate >= C.monthsLater(c.oldEndDate, -n); };
    const lenText = function (list) {
      const d = list.map(len);
      return list.length + '건' + (list.length ? '(평균 ' + Math.round(d.reduce(function (a, b) { return a + b; }, 0) / d.length).toLocaleString('ko-KR') + '일, 가장 긴 ' +
        Math.max.apply(null, d).toLocaleString('ko-KR') + '일)' : '');
    };
    const in1 = per.filter(function (c) { return within(c, 1); }).length, in2 = per.filter(function (c) { return within(c, 2); }).length;
    $('#after-period').innerHTML = C.meta(per.length
      ? [['기간 변경 늘림', lenText(per.filter(function (c) { return c.endDate > c.oldEndDate; }))], ['줄임', lenText(per.filter(function (c) { return c.endDate < c.oldEndDate; }))],
        ['1개월 안', in1 + '건'], ['1개월 넘고 2개월 안', (in2 - in1) + '건'], in2 < per.length ? ['2개월 넘음', (per.length - in2) + '건(한도를 두기 전 기록)'] : null]
      : [['기간 변경 길이', '이 조건에서 기안한 기간 변경이 없습니다.']]);

    // 나. 만료 처리 결과 (계약 기간마다)
    const ok = {};
    base.forEach(function (c) { ok[c.id] = true; }); // 볼 수 있고, 예전 계약 기록 자체가 아니고, 서비스와 영업 유닛 조건에 맞는 계약
    const ended = [];
    C.bundles().forEach(function (b) {
      if (['ACTIVE', 'EXPIRED', 'TERMINATED'].indexOf(b.root.status) < 0) return; // 진행 중단, 반려, 결재 중인 원계약은 계약 기간이 시작되지 않음
      const terms = [b.root].concat(b.items.filter(function (x) { return x.kind === 'RENEW' && ['ACTIVE', 'EXPIRED'].indexOf(x.status) > -1; }));
      terms.forEach(function (t, i) {
        let end = C.endOf(t), how;
        if (terms[i + 1]) how = 'RENEWED';
        else if (b.status === 'TERMINATED') { how = 'TERMINATED'; end = b.root.terminateDate && b.root.terminateDate < b.end ? b.root.terminateDate : b.end; }
        else {
          const ex = C.expiryOf(b);
          if (!ex || !ex.ended) return; // 아직 끝나지 않음
          end = b.end;
          how = ex.state === 'DONE' ? 'CLOSED' : ex.state === 'GRACE' ? 'GRACE' : ex.state === 'OFF' ? (ex.block && ex.block.status === 'ACTIVE' ? 'RENEWED' : 'RENEWING') : 'OPEN';
        }
        if (!end || end >= D.TODAY || !inMonths(end, months) || !ok[t.id]) return;
        ended.push({ how: how, grace: (t.history || []).some(function (h) { return h.step === 'SGR' && h.action === 'GRACE_OK'; }) });
      });
    });
    const cnt = function (list, hows) { return list.filter(function (x) { return hows.indexOf(x.how) > -1; }).length; };
    const n = ended.length, U = '끝난 계약 기간';
    $('#after-expiry').innerHTML = n ? [
      meterHtml('연장', cnt(ended, ['RENEWED', 'RENEWING']), n, U, '새 계약 포함, 계약 완료 ' + cnt(ended, ['RENEWED']) + '건, 진행 중 ' + cnt(ended, ['RENEWING']) + '건'),
      meterHtml('유예 중', cnt(ended, ['GRACE']), n, U, '영업 리더가 확인한 기한까지 서비스를 열어 둠'),
      meterHtml('만료', cnt(ended, ['CLOSED', 'OPEN']), n, U, '서비스 닫음 ' + cnt(ended, ['CLOSED']) + '건, 닫기 전 ' + cnt(ended, ['OPEN']) + '건'),
      meterHtml('해지', cnt(ended, ['TERMINATED']), n, U, '종료일 전에 해지'),
    ].join('') : '<p class="chart-empty">이 조건에서 기간 안에 끝난 계약 기간이 없습니다.</p>';
    const gr = ended.filter(function (x) { return x.grace; });
    $('#after-expiry-note').textContent = '유예를 확인받았던 계약 기간은 ' + gr.length + '건입니다' +
      (gr.length ? '(지금 유예 중 ' + cnt(gr, ['GRACE']) + '건, 그 뒤 연장 ' + cnt(gr, ['RENEWED', 'RENEWING']) + '건, 만료 ' + cnt(gr, ['CLOSED', 'OPEN']) + '건)' : '') +
      '. 종료일이 오늘(' + C.fmtDate(D.TODAY) + ') 전인 계약 기간만 셉니다.';

    // 다. 해지 (기안일 순)
    const term = base.filter(function (c) { return c.kind === 'TERMINATE' && AFTER_OUT.indexOf(c.status) < 0 && inMonths(c.requestedAt, months); })
      .sort(function (a, b) { return String(a.requestedAt).localeCompare(String(b.requestedAt)); });
    const termDone = term.filter(function (c) { return c.status === 'TERMINATED'; }).length;
    $('#after-term-sum').innerHTML = C.meta([['해지 기안', term.length + '건'], ['계약 완료', termDone + '건'], ['진행 중', (term.length - termDone) + '건']]);
    $('#after-term-rows').innerHTML = term.length ? term.map(function (c) {
      const bb = C.bundleOf(C.rootOf(c)), end = bb ? bb.end : '';
      const early = c.terminateDate && end && c.terminateDate < end ? C.periodMonths(C.addDays(c.terminateDate, 1), end) : null;
      return '<tr>' + custCell(c) + '<td class="num-left">' + C.fmtDate(String(c.requestedAt).slice(0, 10)) + '</td>' +
        '<td class="num-left">' + (c.terminateDate ? C.fmtDate(c.terminateDate) : '-') + (early ? '<span class="cell-meta">종료일 ' + C.fmtDate(end) + '보다 약 ' + early + '개월 먼저</span>' : '') + '</td>' +
        nowCell(c) + '<td>' + esc(c.reason || '-') + '</td></tr>';
    }).join('') : '<tr><td colspan="5" class="empty-row">이 조건에서 기안한 해지가 없습니다.</td></tr>';

    // 라. 의무를 기한 안에 한 비율 (종류마다)
    const ob = {};
    let events = 0;
    D.OBLIGATIONS.forEach(function (o) {
      const root = D.CONTRACTS.filter(function (c) { return c.id === o.bundle; })[0];
      if (!root || !C.canView(root, me) || (service && (root.services || []).indexOf(service) < 0) || (unit && C.teamOf(root.requesterId) !== unit)) return;
      const recs = o.records || [];
      if (o.when === 'EVENT') { events += recs.filter(function (r) { return inMonths(r.at, months); }).length; return; }
      const stop = o.endedAt ? String(o.endedAt).slice(0, 10) : '';
      C.obligationDues(o).forEach(function (d) {
        if (!inMonths(d, months) || (stop && d > stop)) return;
        const r = recs.filter(function (x) { return x.for === d; }).sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); })[0];
        if (!r && d >= D.TODAY) return; // 기한이 아직 오지 않았고 기록도 없음
        const k = ob[o.kind] = ob[o.kind] || { all: 0, ok: 0, late: 0, none: 0 };
        k.all++;
        if (!r) k.none++; else if (String(r.at).slice(0, 10) <= d) k.ok++; else k.late++;
      });
    });
    const kinds = Object.keys(D.OBLIGATION_KINDS).filter(function (k) { return ob[k]; });
    const tot = kinds.reduce(function (t, k) { ['all', 'ok', 'late', 'none'].forEach(function (x) { t[x] += ob[k][x]; }); return t; }, { all: 0, ok: 0, late: 0, none: 0 });
    const subOf = function (x) { return '기한 뒤에 함 ' + x.late + '건, 아직 하지 않음 ' + x.none + '건'; };
    $('#after-ob').innerHTML = tot.all ? [meterHtml('모든 의무', tot.ok, tot.all, '기한이 온', subOf(tot))].concat(kinds.map(function (k) {
      return meterHtml(D.OBLIGATION_KINDS[k].label, ob[k].ok, ob[k].all, '기한이 온', subOf(ob[k]));
    })).join('') : '<p class="chart-empty">이 조건에서 기한이 온 체결 후 의무가 없습니다.</p>';
    $('#after-ob-note').textContent = '일이 생기면 하는 의무(장애 대응, 사고 통지 등)는 기한이 없어 비율에 넣지 않았습니다. 기간 안에 남긴 그 기록은 ' + events + '건입니다.';
  }

  /* ---------- 8. 기간 마감 점검 (기획자 결정 2026-11-02 B-9, G-09 뒤, CTL-65) ----------
   * 결산 기간 말을 골라 그날 기준으로 세 목록을 봄. 위 조건(기간, 서비스, 영업 유닛)과 상관없이 볼 수 있는 모든 계약
   *   가. 체결일(서명본 체결일)이 기간 말 앞뒤 n일 안인 계약. 기간 말까지 체결했지만 기간 말 뒤에 올린 계약은
   *       n일 밖이어도 함께 넣고 "마감 뒤에 올림"을 붙임 [가정: 기간을 가르는 계약이라 함께 봄]
   *   나. 기간 말까지 승인됐지만 그때 체결 전이던 계약(⑦을 거치는 계약만). 그때 차례였던 단계를 보임
   *   다. 기간 말에 ⑨ 운영 적용이나 ⑩ 재무 확인을 기다리던 계약(차례가 기간 말까지 왔고, 처리는 기간 말 뒤나 아직)
   *   - 지금 차수만 봄. 반려된 차수는 넣지 않음(A-2와 같게) [가정]
   *   - 금액은 통계와 같이 신규, 변경, 연장만 더함. 해지와 운영 변경은 줄은 보이되 금액은 "-"
   *   - 앞뒤 날 수는 기본 5일 [가정], 화면에서 0~31일로 바꿈. 기간 말 기본값은 지난달 말일, 오늘 뒤의 날은 고를 수 없음
   *   - 열람 제한 계약 중 볼 수 없는 건은 목록과 합계에서 빼고, 세 목록에 들어갈 건수만 알림(통계의 다른 곳과 같이 합계로 드러나지 않게)
   * 확인: 재무(담당자, 리더, 임원)만 남김. 그 밖의 사람은 보기만. 최고관리자도 남기지 않음(점검은 맡은 사람만, C-5, C-6)
   *   기간 말이 지난 뒤에만 남김(누르면 확인). 메모는 선택. 쌓기만 하고 고치거나 지우지 않음(같은 기간 말에 다시 남기면 한 줄 더)
   *   확인 때 본 숫자(seen)를 함께 남김(접속 기록 점검과 같음, 표준 대응표 G-23 ③). 지금 목록이 그때와 다르면 "확인한 뒤 바뀜"
   *     예: 기간 말 뒤에 서명본을 올림, ⑧에서 반려됨. 비교는 열람 제한 계약까지 포함한 계약번호와 금액(sig)으로 해서 보는 사람마다 같음
   *   기록: D.CLOSE_CHECKS(예시) + 시연 기록(C.pushDemo 'closeChecks', 이 브라우저에만). 실제 시스템은 서버의 기간 마감 확인 기록
   * 인쇄: "마감 점검 인쇄"는 이 묶음만 A4로(body.is-print-close). "보고서 인쇄"에는 넣지 않음 */
  const CLOSE_DAYS = 5; // 앞뒤 날 수 기본값 [가정]
  const canConfirm = C.hasRole(me, ['FINANCE']); // 재무 담당자, 리더, 임원(ROLE_BASE가 FINANCE)
  const PREV_MONTH_END = C.addDays(D.TODAY.slice(0, 8) + '01', -1); // 지난달 말일
  function stepOf(c, code) { return (c.approvals || []).filter(function (a) { return a.step === code; })[0] || null; }
  // 기간 말(endAt)에 그 단계를 기다리고 있었는지
  function waitingAt(a, endAt) { return !!a && a.state !== 'SKIPPED' && !!a.arrivedAt && a.arrivedAt <= endAt && !(a.decidedAt && a.decidedAt <= endAt); }
  function closeLists(list, end, n) {
    const endAt = end + ' 23:59:59', from = C.addDays(end, -n), to = C.addDays(end, n);
    const out = { a: [], b: [], c: [] };
    list.forEach(function (c) {
      if (c.status === 'REJECTED' || c.status === 'STOPPED') return; // (설계 검토 2026-11-11 7번) 진행 중단한 계약은 체결되지 않아 마감 점검에서 뺌 [가정, 반려와 같음]
      const s = signInfo(c);
      if (s && counted(c)) {
        const late = !!s.up && s.date <= end && s.up.slice(0, 10) > end;
        if ((s.date >= from && s.date <= to) || late) out.a.push({ c: c, s: s, late: late });
      }
      const s07 = stepOf(c, 'S07');
      if (c.approvedAt && c.approvedAt <= endAt && s07 && s07.state !== 'SKIPPED' && !(s && s.date <= end)) {
        const at = ['S06', 'S07', 'S08'].filter(function (k) { return waitingAt(stepOf(c, k), endAt); })[0] || 'S07';
        out.b.push({ c: c, s: s, step: at });
      }
      ['S09', 'S10'].forEach(function (k) { const a = stepOf(c, k); if (waitingAt(a, endAt)) out.c.push({ c: c, a: a, step: k }); });
    });
    out.a.sort(function (x, y) { return x.s.date.localeCompare(y.s.date) || String(x.c.id).localeCompare(String(y.c.id)); });
    out.b.sort(function (x, y) { return String(x.c.approvedAt).localeCompare(String(y.c.approvedAt)); });
    out.c.sort(function (x, y) { return x.step.localeCompare(y.step) || String(x.a.arrivedAt).localeCompare(String(y.a.arrivedAt)); });
    return out;
  }
  function total(rows) { return rows.reduce(function (n, r) { return n + (counted(r.c) ? r.c.amount : 0); }, 0); }
  // 세 목록의 계약번호=금액 (확인한 뒤 바뀌었는지 견줄 때만 씀. 화면에는 보이지 않음)
  function sigOf(L) {
    return ['a', 'b', 'c'].map(function (k) {
      return k + ':' + L[k].map(function (r) { return r.c.id + '=' + (counted(r.c) ? r.c.amount : 0); }).sort().join(',');
    }).join('|');
  }
  function seenText(v) {
    return '앞뒤 ' + v.days + '일. 기간 말 앞뒤 체결 ' + v.a[0] + '건 ' + C.fmtWon(v.a[1]) + ', 승인됐지만 체결 전 ' + v.b[0] + '건 ' + C.fmtWon(v.b[1]) +
      ', ⑨ ⑩ 기다림 ' + v.c[0] + '건 ' + C.fmtWon(v.c[1]) + (v.hidden ? ', 열람 제한으로 뺀 계약 ' + v.hidden + '건' : '');
  }
  function allChecks() {
    return (D.CLOSE_CHECKS || []).concat(C.loadDemo('closeChecks'))
      .slice().sort(function (x, y) { return String(x.at).localeCompare(String(y.at)); });
  }

  // 표 칸 조각: 고객사(결재 문서로 가는 링크, 계약번호, 날짜 순서가 이상하면 그 글), 금액(오른쪽), 지금 상태
  function custCell(c) {
    // B-5: 견적서로 대신한 계약은 고객 날인일(결재 문서의 날짜 순서 안내와 같은 말). (설계 검토 2026-11-11 답 ⑤, 남은 것 ④) 날짜 이름은
    //   C.dateOrderIssues가 계약에 맞게 씀(C.signDayLabel: 고객 날인일, 전자계약 체결일 / C.openDateLabel: 줄임과 조항만 변경은 적용일)
    const odd = C.dateOrderIssues(c).map(function (x) {
      return '<span class="cell-meta">' + C.badge('attention', '날짜 순서') + ' ' + esc(x.text) + '</span>';
    }).join('');
    return '<td><a class="cell-title" href="review.html?id=' + encodeURIComponent(c.id) + '">' + esc(c.counterparty) + '</a>' +
      '<span class="cell-meta">' + esc(c.id) + (c.restricted ? ' ' + C.icon('lock', 'sm') : '') + '</span>' + odd + '</td>';
  }
  function kindCell(c) { return '<td class="center">' + esc(C.kindLabel(c)) + '</td>'; }
  function moneyCell(c) { return '<td class="num">' + (counted(c) ? C.fmtWon(c.amount) : '-') + '</td>'; }
  function nowCell(c) { return '<td class="nowrap">' + C.statusBadge(c) + '</td>'; }
  function stepCell(c, code, extra) {
    return '<td class="nowrap">' + esc(C.stepTag(code, c)) + '<span class="cell-meta">' + esc(C.stepIng(c, code)) + '</span>' + (extra || '') + '</td>';
  }
  // 합계 줄: 금액 칸 앞까지 합친 칸에 건수, 금액 칸에 합계, 뒤는 빈칸
  function totalRow(rows, before, after) {
    return rows.length ? '<tr class="row-total"><th scope="row" colspan="' + before + '">합계 ' + rows.length + '건</th><td class="num">' + C.fmtWon(total(rows)) + '</td>' +
      (after ? '<td colspan="' + after + '"></td>' : '') + '</tr>' : '';
  }
  function emptyRow(cols) { return '<tr><td colspan="' + cols + '" class="empty-row">해당하는 계약이 없습니다.</td></tr>'; }

  let closeNow = null; // 지금 그린 기간 말과 숫자(확인 창에 씀)
  function closeInputs() {
    const end = $('#close-end').value, t = String($('#close-days').value).trim();
    const n = /^\d{1,2}$/.test(t) ? Number(t) : NaN;
    return { end: end, n: n, endOk: !!end && end <= D.TODAY, nOk: n >= 0 && n <= 31 };
  }
  // showErr: 칸을 떠날 때(change)만 오류를 보임. 고쳐지면 바로 지움. 고칠 때까지 앞서 그린 목록을 그대로 둠(화면이 흔들리지 않게)
  function renderClose(showErr) {
    const v = closeInputs();
    const endBox = $('#close-end').closest('.field'), daysBox = $('#close-days').closest('.field');
    if (v.endOk) C.setFieldError(endBox, '');
    else if (showErr) C.setFieldError(endBox, !v.end ? '기간 말을 2026-09-30처럼 넣으세요.' : '오늘(' + C.fmtDate(D.TODAY) + ') 뒤의 날은 고를 수 없습니다.');
    if (v.nOk) C.setFieldError(daysBox, '');
    else if (showErr) C.setFieldError(daysBox, '0에서 31 사이의 날 수를 넣으세요.');
    if (!v.endOk || !v.nOk) return;
    const end = v.end, n = v.n;
    const L = closeLists(visible, end, n), H = closeLists(hiddenList, end, n);
    const hid = {};
    ['a', 'b', 'c'].forEach(function (k) { H[k].forEach(function (r) { hid[r.c.id] = true; }); });
    const seen = { days: n, a: [L.a.length, total(L.a)], b: [L.b.length, total(L.b)], c: [L.c.length, total(L.c)], hidden: Object.keys(hid).length,
      sig: sigOf({ a: L.a.concat(H.a), b: L.b.concat(H.b), c: L.c.concat(H.c) }) };
    closeNow = { end: end, seen: seen };

    // 인쇄할 때만 보이는 조건 줄과, 화면과 인쇄 모두에 보이는 숫자 줄
    const range = C.fmtDate(C.addDays(end, -n)) + '~' + C.fmtDate(C.addDays(end, n));
    $('#close-cond').textContent = '기간 말: ' + C.fmtDate(end) + ', 앞뒤 ' + n + '일(' + range + '), 기준일: ' + C.fmtDate(D.TODAY);
    $('#close-sum').innerHTML = C.meta([['기간 말 앞뒤 체결', seen.a[0] + '건, ' + C.fmtWon(seen.a[1])], ['승인됐지만 체결 전', seen.b[0] + '건, ' + C.fmtWon(seen.b[1])],
      ['⑨ ⑩ 기다림', seen.c[0] + '건, ' + C.fmtWon(seen.c[1])]]) +
      (seen.hidden ? '<p class="close-hidden">열람 제한 계약 중 볼 수 없는 ' + seen.hidden + '건은 목록과 합계에 넣지 않았습니다.</p>' : '');

    // 확인 기록 (이 기간 말). 늘 한 줄 이상 있어 화면이 흔들리지 않음
    const recs = allChecks().filter(function (r) { return r.end === end; });
    $('#close-record').innerHTML = recs.length ? recs.map(function (r) {
      const changed = r.seen && r.seen.days === n && r.seen.sig && r.seen.sig !== seen.sig;
      return '<div class="close-rec">' + C.meta([C.badge('success', '확인함'), ['확인한 사람', esc(C.ownerLabel(r.by, r.dept))], ['일시', esc(C.fmtDateTime(r.at))],
          changed ? C.badge('attention', '확인한 뒤 바뀜') : null]) +
        '<p class="close-memo"><span class="meta-key">메모</span> <span class="meta-val">' + (r.memo ? esc(r.memo) : '없음') + '</span></p>' +
        (r.seen ? '<details class="seen-data"><summary>확인 때 본 숫자</summary><p class="cell-meta">' + esc(seenText(r.seen)) + '</p></details>' : '') + '</div>';
    }).join('') : '<p class="close-none">아직 ' + C.fmtDate(end) + ' 기간 말의 확인이 없습니다. ' +
      (!canConfirm ? '확인은 재무(담당자, 리더, 임원)가 남깁니다.' : end < D.TODAY ? '세 목록을 본 뒤 "확인 남기기"를 누릅니다.' : '기간 말이 지난 뒤에 확인을 남깁니다.') + '</p>';

    // 가. 기간 말 앞뒤에 체결한 계약
    const before = L.a.filter(function (r) { return r.s.date <= end; }), after = L.a.filter(function (r) { return r.s.date > end; });
    $('#close-a-desc').textContent = '체결일(서명본 체결일)이 ' + range + '인 계약과, 기간 말까지 체결했지만 기간 말 뒤에 올린 계약입니다.';
    $('#close-a-split').innerHTML = C.meta([['기간 말까지 체결', before.length + '건, ' + C.fmtWon(total(before))], ['기간 말 뒤 체결', after.length + '건, ' + C.fmtWon(total(after))]]);
    $('#close-a-rows').innerHTML = L.a.length ? L.a.map(function (r) {
      return '<tr>' + custCell(r.c) + kindCell(r.c) +
        '<td class="num-left">' + C.fmtDate(r.s.date) + '<span class="cell-meta">' + (r.s.up ? '올린 날 ' + C.fmtDate(r.s.up) : '⑩ 확인일(그대로 연장)') + '</span>' +
          (r.late ? '<span class="cell-meta">' + C.badge('attention', '마감 뒤에 올림') + '</span>' : '') + '</td>' +
        moneyCell(r.c) + nowCell(r.c) + '</tr>';
    }).join('') + totalRow(L.a, 3, 1) : emptyRow(5);

    // 나. 승인됐지만 체결 전이던 계약
    $('#close-b-rows').innerHTML = L.b.length ? L.b.map(function (r) {
      return '<tr>' + custCell(r.c) + kindCell(r.c) + '<td class="num-left">' + C.fmtDate(r.c.approvedAt) + '</td>' +
        stepCell(r.c, r.step, '<span class="cell-meta">' + (r.s ? '체결 ' + C.fmtDate(r.s.date) : '아직 체결 전') + '</span>') +
        moneyCell(r.c) + nowCell(r.c) + '</tr>';
    }).join('') + totalRow(L.b, 4, 1) : emptyRow(6);

    // 다. ⑨ ⑩을 기다리던 계약
    $('#close-c-rows').innerHTML = L.c.length ? L.c.map(function (r) {
      return '<tr>' + custCell(r.c) + kindCell(r.c) + stepCell(r.c, r.step) +
        '<td class="num-left">' + C.fmtDate(r.a.arrivedAt) + '<span class="cell-meta">' + (r.a.decidedAt ? '처리 ' + C.fmtDate(r.a.decidedAt) : '아직 처리 전') + '</span></td>' +
        moneyCell(r.c) + nowCell(r.c) + '</tr>';
    }).join('') + totalRow(L.c, 4, 1) : emptyRow(6);

    // 모든 기간 말의 확인 기록 (최근 기간 말부터)
    const log = allChecks().slice().sort(function (x, y) { return y.end.localeCompare(x.end) || String(y.at).localeCompare(String(x.at)); });
    $('#close-log-count').textContent = log.length + '건';
    $('#close-log-rows').innerHTML = log.length ? log.map(function (r) {
      return '<tr><td class="num-left">' + C.fmtDate(r.end) + '</td><td class="center">' + esc(C.ownerLabel(r.by, r.dept)) + '</td>' +
        '<td class="num-left">' + esc(C.fmtDateTime(r.at)) + '</td><td>' + (r.memo ? esc(r.memo) : '-') + '</td></tr>';
    }).join('') : '<tr><td colspan="4" class="empty-row">아직 남긴 확인이 없습니다.</td></tr>';
  }

  // 확인 남기기 (재무만). 기간 말이 지나지 않았거나 칸이 맞지 않으면 남기지 않고 알림
  function openConfirm() {
    const v = closeInputs();
    if (!canConfirm) return;
    if (!v.endOk || !v.nOk || !closeNow || closeNow.end !== v.end || closeNow.seen.days !== v.n) { renderClose(true); C.toast('기간 말과 앞뒤 날 수를 먼저 맞게 넣으세요.', true); return; }
    if (v.end >= D.TODAY) { C.toast('기간 말이 지난 뒤에 확인을 남깁니다.', true); return; }
    const end = v.end, seen = closeNow.seen;
    const prev = allChecks().filter(function (r) { return r.end === end; }).length;
    C.formModal({
      title: C.fmtDate(end) + ' 기간 마감 점검을 확인할까요?',
      desc: '저장하면 확인한 사람과 일시, 메모, 지금 본 숫자가 남고 고칠 수 없습니다.' + (prev ? ' 이미 남긴 확인 ' + prev + '건은 그대로 두고 한 줄 더 남깁니다.' : ''),
      body: '<p class="modal-info">' + esc(seenText(seen)) + '</p>' +
        // 넣지 않아도 되는 칸은 optional로 "(선택)"을 모든 창에서 같은 모양으로(2026-11-06 점검 3회차)
        C.fieldHtml({ name: 'memo', label: '메모', type: 'textarea', optional: true, help: '예: 기간 말 뒤에 올린 1건은 서명본 체결일에 맞춰 9월로 반영함' }),
      btn: '확인 남기기',
      done: function (f) {
        C.pushDemo('closeChecks', { end: end, at: C.nowStamp().slice(0, 16), by: me.id, dept: me.dept || '', memo: f.elements.memo.value.trim(), seen: seen });
        renderClose(false);
        C.toast(C.fmtDate(end) + ' 기간 마감 점검 확인을 남겼습니다.');
      },
    });
  }

  /* ---------- 10. 통제 증빙 내보내기 (기획자 결정 2026-11-02 C-3, G-13, REQ-DASH-21, CTL-131) ----------
   * 감사 열람(과 시연용 최고관리자)만. 위 조건(기간, 서비스, 영업 유닛)과 상관없이 고른 기간의 볼 수 있는 모든 계약(감사 열람은 열람 제한 포함)
   * 한 파일(CSV, 엑셀에서 열림)에 여러 묶음. 묶음마다 "[이름]" 줄, 머리 줄, 내용 줄
   *   계약과 차수: 기간 안에 기안했거나 결재 기록이 있는 계약. 체크리스트 1~4번 답(아니요면 사유, 4번은 종류)
   *     (2026-11-18 셋째 점검 audit-trail-03, 결정할것 W7-7 (가)) 끝 칸 "사후 등록(임시 결재 번호)": 사후 등록이면 "예(임시 결재 번호 …)", 아니면 "아니요"
   *   결재 기록: 그 계약들의 기록 가운데 기간 안의 것. 단계마다 처리한 사람, 누구 대신, 시각, 한 일(결과), 의견
   *     (2026-11-18 셋째 점검 audit-trail-02, CTL-137 모집단) 기간 안의 영업대표 바꾸기도 "영업대표 지정" 줄로(결재 기록 묶음과 같은 꼴, 볼 수 있는 묶음만)
   *   ③ 가격 예외(2번이나 3번 아니요), 4번 예 계약(⑩ 재무 확인 상태), ⑧ 결과(⑧ 기록과 어긋난 항목)
   *   가격과 권한 변경: 가격 기준 줄(티어 단가 포함), 거래처의 고객사 티어 변경(설계 검토 2026-11-11 남은 것 ⑤), 사용자 권한과 결재선 규칙의 변경 이력, 끝나는 날이 지나 풀린 감사 열람
   *     (2026-11-18 셋째 점검 audit-trail-01, 결정할것 결정 3) 고객사 티어 목록 변경(코드 관리의 추가, 이름 변경, 사용 안 함)도 영역 "거래처(고객사 티어 목록)"으로
   *   접속 기록: 접속 기록 점검과 같은 기록(control-checks.js accessLogs)
   * 파일 맨 위 머리: 실행 시각, 실행한 사람, 조건, 건수, 금액 합계(신규, 변경, 연장), 파일 지문(빈 줄 아래 본문의 SHA-256), 워터마크
   * 내려받으면 꺼낸 기록(누가, 언제, 조건, 건수, 지문)이 남음. 실제 시스템은 서버가 엑셀 파일을 만들고 지문과 꺼낸 기록을 남김 [가정: 시안은 CSV] */
  // 기본 기간: 지난달 1일부터 말일까지 (기간 마감 점검의 기본 기간 말과 같은 달)
  const EXPORT_DEFAULT = { from: PREV_MONTH_END.slice(0, 8) + '01', to: PREV_MONTH_END };
  function yesNo(v, note) { return v === 'YES' ? '예' : v === 'NO' ? '아니요' + (note ? '(' + note + ')' : '') : v === 'NA' ? '해당 없음' : '-'; } // NA: 줄임, 조항만 변경의 2, 3번(설계 검토 2026-11-11 6번)
  function acctKindText(c) {
    return ((c.checklist || {}).acctKinds || []).map(function (k) { const x = (D.ACCT_KINDS || []).filter(function (y) { return y.code === k; })[0]; return x ? x.label : k; }).join(', ');
  }
  // 단계의 지금 상태, 처리한 사람, 일시 (결재선에 아예 없는 단계는 "거치지 않음")
  // 상태 글은 화면(review.js 결재 칸)과 같은 규칙: 끝난 단계는 그 단계의 끝난 말(D.STEPS[code].done, 예: ⑩ "확인"), 없으면 "승인".
  // 생략한 단계는 화면처럼 "생략"(2026-11-06 점검 4회차: 전에는 ⑩도 "승인", 생략도 "거치지 않음"으로 나가 화면과 달랐음)
  function stepState(c, code) {
    const a = (c.approvals || []).filter(function (x) { return x.step === code; })[0];
    if (!a) return ['거치지 않음', '', ''];
    if (a.state === 'SKIPPED') return [(D.APPROVAL_STATE.SKIPPED || { label: '생략' }).label, '', ''];
    //   (설계 검토 2026-11-11 남은 것 ④) 끝난 말은 계약에 맞게(C.stepDone: 전자계약의 ⑥은 "서명"). 결재 문서의 결재란과 같은 함수
    const label = a.state === 'DONE' && C.stepDone(code, c) ? C.stepDone(code, c) : (D.APPROVAL_STATE[a.state] || { label: a.state }).label;
    return [label, a.decidedBy ? C.ownerLabel(a.decidedBy) : '', a.decidedAt ? C.fmtDateTime(a.decidedAt) : ''];
  }
  function buildEvidence(from, to) {
    const inP = function (s) { const d = String(s || '').slice(0, 10); return !!d && d >= from && d <= to; };
    const pool = all.filter(function (c) { return C.canView(c, me); });
    const hidden = all.length - pool.length;
    const cs = pool.filter(function (c) { return inP(c.requestedAt) || (c.history || []).some(function (h) { return inP(h.at); }); })
      .sort(function (a, b) { return String(a.id).localeCompare(String(b.id)); });
    const ck = function (c) { return c.checklist || {}; };
    const contractRows = cs.map(function (c) {
      return [c.id, (c.round || 1) + '차', c.counterparty, C.kindLabel(c), D.METHODS[C.methodOf(c)], D.STATUS[c.status].label, counted(c) ? c.amount : 0,
        C.fmtDateTime(c.requestedAt), C.ownerLabel(c.requesterId), yesNo(ck(c).standard, ck(c).standardNote), yesNo(ck(c).price, ck(c).priceNote), yesNo(ck(c).cap, ck(c).capNote),
        yesNo(ck(c).accounting), acctKindText(c), c.restricted ? '예' : '아니요',
        // (2026-11-18 셋째 점검 audit-trail-03, 결정할것 W7-7 (가)) 사후 등록과 임시 결재 번호. 복구 뒤 컴플라이언스가 임시 결재 목록과 하나씩 맞춰 보는 번호(CTL-59, CTL-121)
        //   계약(차수)마다 그 계약의 값. 후속 기안(변경, 연장 등)도 따로 사후 등록일 수 있어 원계약 값을 빌리지 않음
        c.lateEntry ? '예(임시 결재 번호 ' + (c.lateEntry.tempNo || '-') + ')' : '아니요'];
    });
    const histRows = [];
    cs.forEach(function (c) {
      (c.history || []).slice().sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); }).forEach(function (h) {
        if (!inP(h.at)) return;
        histRows.push([c.id, (h.round || 1) + '차', D.STEPS[h.step] ? C.stepLabel(h.step, c) : h.step, C.actionLabel(h, c), C.ownerLabel(h.actorId, h.actorDept),
          h.onBehalfOf ? C.ownerLabel(h.onBehalfOf) : '', h.basis || '', C.fmtDateTime(h.at), h.comment || '']);
      });
    });
    /* (2026-11-18 셋째 점검 audit-trail-02, CTL-137 모집단) 기간 안의 영업대표 바꾸기(D.OWNER_CHANGES와 시연 기록)도 한 줄씩. 결재 기록 묶음(contract.js bundleParts)과 같은 꼴
     *   "영업대표 지정", 앞 → 뒤 영업대표, 정한 사람(그때 조직), 일시, 사유. 감사인은 계정 없이 이 파일만 받아 영업대표 바꾸기를 시험할 모집단이 여기 있어야 함
     *   그 묶음(원계약)을 볼 수 있는 사람만(위 pool과 같은 C.canView). 원계약은 D.CONTRACTS에서 찾음: 예전 계약 기록(LG-)이 원계약인 묶음도 영업대표를 바꿀 수 있어서
     *     (위 all은 예전 계약 기록을 빼므로 all에서 찾으면 그 줄이 빠짐). 계약별 줄 뒤에 일시 차례로 모아 둠 */
    (D.OWNER_CHANGES || []).slice().sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); }).forEach(function (r) {
      if (!inP(r.at)) return;
      const root = D.CONTRACTS.filter(function (c) { return c.id === r.bundleId; })[0];
      if (!root || !C.canView(root, me)) return;
      histRows.push([r.bundleId, '-', '영업대표 지정', C.ownerLabel(r.from) + ' → ' + C.ownerLabel(r.to), C.ownerLabel(r.by, r.byDept), '', '', C.fmtDateTime(r.at), r.reason || '']);
    });
    // (2026-11-17 다른 눈 oversight-01) ③을 거친 줄임(W7-3, reduceOver)도 ③ 가격 예외로 넣음
    const exc = cs.filter(function (c) { return ck(c).price === 'NO' || ck(c).cap === 'NO' || !!(c.reduceOver && c.reduceOver.over); });
    const excRows = exc.map(function (c) {
      const pp = overPpOf(c), s3 = stepState(c, 'S03'), s3c = stepState(c, 'S03C');
      return [c.id, c.counterparty, yesNo(ck(c).price, ck(c).priceNote), yesNo(ck(c).cap, ck(c).capNote), pp == null ? '셀 수 없음' : pp + '%p',
        s3[0], s3[1], s3[2], s3c[0], s3c[1], s3c[2]];
    });
    const acc = cs.filter(function (c) { return ck(c).accounting === 'YES'; });
    const accRows = acc.map(function (c) {
      const s10 = stepState(c, 'S10');
      return [c.id, c.counterparty, acctKindText(c), ck(c).accountingNote || '', (c.finOpinions || []).length + '건', s10[0], s10[1], s10[2]];
    });
    const s8Rows = [];
    cs.forEach(function (c) {
      (c.history || []).forEach(function (h) {
        if (h.step !== 'S08' || !inP(h.at)) return;
        const mis = (h.mismatch || []).map(function (k) { const x = D.SIGNED_MISMATCH.filter(function (y) { return y.code === k; })[0]; return x ? x.label : k; }).join(', ');
        s8Rows.push([c.id, (h.round || 1) + '차', C.actionLabel(h, c), C.ownerLabel(h.actorId, h.actorDept), C.fmtDateTime(h.at), mis, h.comment || '']);
      });
    });
    // 가격과 권한 변경: 가격 줄(가격 기준 관리에서 바꾼 것도 들어 있음), 사용자 권한과 결재선 규칙의 변경 이력, 저절로 풀린 감사 열람(C-2)
    const chg = [];
    //   (설계 검토 2026-11-11 남은 것 ⑤, 답 ①) 가격 줄에 티어 단가(X.tierPriceText)를 함께 적고, 거래처의 고객사 티어 변경(X.tierInfo)도 넣음(2026-11-12 [제안] ①부터 티어가 다른 거래처 합치기도 tierInfo가 셈)
    //     티어 변경 줄: 바뀐 내용 뒤에 그날 가격 기준으로 표준 단가가 바뀌는 기능. 품의 칸은 비움(거래처 관리에는 품의 링크 칸이 없음 [가정])
    D.PRICE_ROWS.forEach(function (r) {
      if (!inP(r.at)) return;
      const tp = X.tierPriceText(r);
      chg.push([r.at, '가격 기준', C.featureLabel(r), C.fmtWon(r.listPrice) + '(' + r.unit + '), 한도 ' + pct1(r.discountCap || 0) + (tp ? ', 티어 단가 ' + tp : '') + ', ' + r.validFrom + '부터', r.reason || '',
        [r.docNo, r.docUrl].filter(Boolean).join(' '), C.ownerLabel(r.by), '']);
    });
    C.adminLog(['CUSTOMER']).forEach(function (e) {
      const ti = inP(e.at) ? X.tierInfo(e) : null;
      if (!ti) return;
      const items = ti.items.map(function (it) { return it.label + ' ' + (it.before ? it.before + ' → ' : '') + it.after; }).join(', ') || ti.tierNote;
      chg.push([e.at, '거래처(고객사 티어)', e.target, e.change + ' / 표준 단가: ' + items, e.reason || '', '', C.ownerLabel(e.by), '']);
    });
    /* (2026-11-18 셋째 점검 audit-trail-01, 결정할것 결정 3, W7-6) 고객사 티어 목록 변경(코드 관리 TIER의 추가, 이름 변경, 사용 안 함)도 넣음.
     *   결정 3은 이 변경을 거래처의 티어 변경처럼 다룸(재무 리더 확인, X.settingChanges의 tierCode 줄). 영역 CODE에 남아 위 C.adminLog(['CUSTOMER'])로는 빠졌음
     *   이름을 바꾸면 지난 가격 줄과 티어 변경 줄이 새 이름으로 보이므로 그 까닭 줄이 같은 묶음에 함께 있어야 함. 품의 칸은 비움(코드 관리에는 품의 링크 칸이 없음 [가정]) */
    X.settingChanges({ areas: ['CUSTOMER'] }).forEach(function (x) {
      if (!x.tierCode || !inP(x.at)) return;
      chg.push([x.at, '거래처(고객사 티어 목록)', x.target, x.change, x.reason || '', '', C.ownerLabel(x.by), '']);
    });
    C.adminLog(['USER', 'RULE']).concat(C.roleEndLog()).forEach(function (e) {
      if (!inP(e.at)) return;
      const req = e.requestedBy || (e.op && e.op.requestedBy);
      chg.push([e.at, e.area === 'RULE' ? '결재선 규칙' : '사용자 권한', e.target, e.change, e.reason || '', '', e.byLabel || C.ownerLabel(e.by), req ? C.ownerLabel(req) : '']);
    });
    chg.sort(function (a, b) { return String(a[0]).localeCompare(String(b[0])); });
    const logRows = X.accessLogs([]).filter(function (l) { return inP(l.at); }).reverse()
      .map(function (l) { return [C.fmtDateTime(l.at), C.ownerLabel(l.userId), X.ACTS[l.act], l.target, l.place]; });
    const sum = cs.reduce(function (n, c) { return n + (counted(c) ? c.amount : 0); }, 0);
    const count = '계약 ' + cs.length + '건, 결재 기록 ' + histRows.length + '줄, 가격 예외 ' + exc.length + '건, 4번 예 ' + acc.length + '건, ⑧ 결과 ' + s8Rows.length + '줄, ' +
      '가격과 권한 변경 ' + chg.length + '줄, 접속 기록 ' + logRows.length + '줄';
    const L = X.csvLine, NL = X.NL;
    const sec = function (title, headRow, rows) { return [L(['[' + title + ']']), L(headRow)].concat(rows.length ? rows.map(L) : [L(['해당 없음'])]).join(NL); };
    const body = [
      sec('계약과 차수', ['계약번호', '차수', '고객사', '계약종류', '계약 방식', '상태', '금액(원)', '기안 일시', '영업대표', '1번 표준계약서 그대로', '2번 표준단가표 그대로', '3번 할인율 한도 안', '4번 회계 영향 조건', '4번 조건 종류', '열람 제한',
        '사후 등록(임시 결재 번호)' /* 2026-11-18 셋째 점검 audit-trail-03 */], contractRows),
      sec('결재 기록', ['계약번호', '차수', '단계', '한 일', '처리한 사람', '누구 대신', '대리 근거', '일시', '의견'], histRows),
      sec('③ 가격 예외', ['계약번호', '고객사', '2번 답', '3번 답', '한도를 넘은 가장 큰 폭', '③ 영업 검토', '③ 처리한 사람', '③ 일시', '③ 영업 임원 승인', '영업 임원', '영업 임원 일시'], excRows),
      sec('4번 예 계약', ['계약번호', '고객사', '조건 종류', '비고', '재무 의견', '⑩ 재무 확인', '⑩ 처리한 사람', '⑩ 일시'], accRows),
      sec('⑧ 결과', ['계약번호', '차수', '결과', '처리한 사람', '일시', '어긋난 항목', '의견'], s8Rows),
      sec('가격과 권한 변경', ['일시', '영역', '대상', '바뀐 내용', '사유', '품의', '바꾼 사람', '요청한 사람'], chg),
      sec('접속 기록', ['일시', '사람', '한 일', '대상', '접속 위치'], logRows),
    ].join(NL + NL) + NL;
    return { body: body, count: count, sum: sum, hidden: hidden,
      cond: '기간 ' + from + '~' + to + '. 이 기간에 기안했거나 결재 기록이 있는 계약과 이 기간의 기록' +
        (hidden ? '. 열람 제한으로 볼 수 없는 계약 ' + hidden + '건 뺌' : '. 열람 제한 계약 포함') };
  }
  // 파일 맨 위 머리 (빈 줄 다음에 본문)
  function headBlock(x, at, hash) {
    const L = X.csvLine;
    return [L(['통제 증빙 내보내기']), L(['실행 시각', at]), L(['실행한 사람', X.whoText(me)]), L(['조건', x.cond]), L(['건수', x.count]),
      L(['금액 합계(신규, 변경, 연장)', C.fmtWon(x.sum)]),
      L(['파일 지문(SHA-256)', hash || '만들 수 없음(이 브라우저는 지문 계산을 지원하지 않음)', '빈 줄 아래 본문의 지문']),
      L(['워터마크', X.watermark(me, at)])].join(X.NL);
  }
  function exportInputs() {
    const from = $('#ex-from').value, to = $('#ex-to').value;
    return { from: from, to: to, fromErr: !from ? '시작일을 2026-09-01처럼 넣으세요.' : '',
      toErr: !to ? '종료일을 넣으세요.' : to > D.TODAY ? '오늘(' + C.fmtDate(D.TODAY) + ') 뒤의 날은 고를 수 없습니다.' : from && to < from ? '종료일은 시작일보다 앞설 수 없습니다.' : '' };
  }
  let exporting = false;
  function runExport() {
    if (!canExport || exporting) return;
    const v = exportInputs();
    C.setFieldError($('#ex-from').closest('.field'), v.fromErr);
    C.setFieldError($('#ex-to').closest('.field'), v.toErr);
    if (v.fromErr || v.toErr) return;
    exporting = true;
    $('#btn-export').disabled = true;
    const at = C.nowStamp(), x = buildEvidence(v.from, v.to);
    const file = '통제증빙_' + v.from + '_' + v.to + '.csv';
    X.sha256Hex(x.body).then(function (hash) {
      X.download(file, headBlock(x, at, hash) + X.NL + X.NL + x.body);
      X.recordExport({ at: at, by: me.id, dept: me.dept || '', kind: 'PERIOD', cond: '기간 ' + v.from + '~' + v.to, count: x.count, sum: x.sum, hash: hash, file: file });
      renderExports();
      C.toast('통제 증빙을 내려받았습니다(엑셀에서 열림). 꺼낸 기록이 남았습니다.');
    }).then(function () { exporting = false; $('#btn-export').disabled = false; }, function () { exporting = false; $('#btn-export').disabled = false; });
  }
  // 꺼낸 기록: 통제 증빙(기간 전체)과 계약 상세의 결재 기록 묶음. 최근 것부터. 쌓기만 함
  function renderExports() {
    const list = X.exportsAll();
    $('#export-count').textContent = list.length + '건';
    $('#export-rows').innerHTML = list.length ? list.map(function (r) {
      return '<tr><td class="num-left">' + C.fmtDateTime(r.at) + '</td><td class="center">' + esc(C.ownerLabel(r.by, r.dept)) + '</td>' +
        // 2026-11-16 W7-6: 설정 변경 확인의 모집단 내려받기(POP_CONFIG)도 같은 꺼낸 기록에 남아 이름을 따로 보임
        '<td><span class="cell-strong">' + (r.kind === 'BUNDLE' ? '결재 기록 묶음' : r.kind === 'POP_CONFIG' ? '모집단(가격과 거래처 변경)' : '기간 전체') + '</span><span class="cell-meta">' + esc(r.cond) + '</span><span class="cell-meta">' + esc(r.file) + '</span></td>' +
        '<td>' + esc(r.count) + '</td><td class="num">' + (r.sum ? C.fmtWon(r.sum) : '-') + '</td>' +
        '<td class="hash">' + esc(r.hash || '없음') + '</td></tr>';
    }).join('') : '<tr><td colspan="6" class="empty-row">아직 꺼낸 기록이 없습니다.</td></tr>';
  }

  /* ---------- 마우스를 올리면 보이는 설명 ---------- */
  const tip = $('#chart-tip');
  $('#content').addEventListener('mousemove', function (e) {
    const t = e.target.closest('[data-tip]');
    if (!t) { tip.hidden = true; return; }
    tip.textContent = t.getAttribute('data-tip');
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.min(e.clientX + 14, window.innerWidth - w - 8) + 'px';
    tip.style.top = Math.max(8, e.clientY - h - 12) + 'px';
  });
  $('#content').addEventListener('mouseleave', function () { tip.hidden = true; });

  $('#filter').addEventListener('change', render);
  $('#btn-print').addEventListener('click', function () { window.print(); });
  // 기간 마감 점검만 A4로 인쇄 (B-9). 다 찍으면 원래대로
  $('#btn-close-print').addEventListener('click', function () { document.body.classList.add('is-print-close'); window.print(); });
  // 인쇄할 때 그래프가 없는 표(계약 방식과 거래처마다)는 펼쳐 찍고, 다 찍으면 원래대로 (v0.62 검토에서 고침: 접혀 있으면 빠졌음)
  //   기간 마감 점검의 "확인 때 본 숫자"도 펼쳐 찍음(B-9)
  let splitWasOpen = false, seenWasOpen = [];
  window.addEventListener('beforeprint', function () {
    const d = $('#check-split'); splitWasOpen = d.open; d.open = true;
    seenWasOpen = Array.prototype.map.call(document.querySelectorAll('#close-record details'), function (x) { const o = x.open; x.open = true; return [x, o]; });
  });
  window.addEventListener('afterprint', function () {
    $('#check-split').open = splitWasOpen;
    seenWasOpen.forEach(function (p) { p[0].open = p[1]; });
    document.body.classList.remove('is-print-close');
  });
  $('#check-quote-desc').hidden = !seeQuotes;
  $('#control-panel').hidden = !seeControls; // 통제 지표는 리더, 임원, 감사 열람만(C-1). 역할은 화면을 여는 동안 바뀌지 않아 자리가 흔들리지 않음
  $('#export-panel').hidden = !canExport;    // 통제 증빙 내보내기는 감사 열람과 시연용 최고관리자만(C-3). 위와 같이 열 때 정해짐
  render();

  // 통제 증빙 내보내기 (C-3): 기본 기간은 지난달, 오늘 뒤의 날은 고를 수 없음. 고칠 때까지 앞서 넣은 값을 그대로 둠
  if (canExport) {
    $('#ex-from').setAttribute('max', D.TODAY);
    $('#ex-to').setAttribute('max', D.TODAY);
    $('#ex-from').value = EXPORT_DEFAULT.from;
    $('#ex-to').value = EXPORT_DEFAULT.to;
    $('#btn-export').addEventListener('click', runExport);
    $('#export-bar').addEventListener('change', function () {
      const v = exportInputs();
      if (!v.fromErr) C.setFieldError($('#ex-from').closest('.field'), '');
      if (!v.toErr) C.setFieldError($('#ex-to').closest('.field'), '');
    });
    renderExports();
  }

  // 기간 마감 점검 (B-9): 기간 말 기본값은 지난달 말일, 오늘 뒤의 날은 달력에서 고를 수 없음. 앞뒤 날 수 기본 5일
  //   넣는 동안(input)은 맞는 값일 때만 다시 그리고, 칸을 떠날 때(change) 맞지 않으면 오류를 보임
  $('#close-end').setAttribute('max', D.TODAY);
  $('#close-end').value = PREV_MONTH_END;
  $('#close-days').value = CLOSE_DAYS;
  $('#close-bar').addEventListener('input', function () { renderClose(false); });
  // 일수 칸을 떠날 때 생기는 change는 값이 맞으면 다시 그리지 않음(input이 이미 그림)(2026-11-06 점검 4회차): 숫자를 넣은 뒤 표의 계약 링크를 누르면 그 순간 표가 다시 그려져 눌림이 사라졌음
  $('#close-bar').addEventListener('change', function () { const v = closeInputs(); if (v.endOk && v.nOk) return; renderClose(true); });
  // 확인은 재무만: 그 밖의 사람에게는 단추를 두지 않음(역할은 화면을 여는 동안 바뀌지 않아 자리가 흔들리지 않음)
  const okBtn = $('#btn-close-ok');
  if (canConfirm) okBtn.addEventListener('click', openConfirm); else okBtn.remove();
  renderClose(false);
})();
