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
 *   9. 통제 지표(기획자 결정 2026-11-02 C-1, 리더와 임원만): 4번 조건의 종류마다 건수(B-6, CTL-52), ④ 반부패 조항 판단을 계약 방식마다(C-15, CTL-34)
 * 세는 법
 *   - 체결일: ⑦에서 받은 서명본 체결일(C.signedDate, 없으면 올린 날). 올린 때도 남겨 함께 보임 (기획자 결정 2026-11-02 B-8)
 *     예전에는 체결본을 올린 때(⑦ 마지막 기록)였음. 조건 그대로 연장(날인과 체결본 없음)은 지금처럼 ⑩ 재무 확인일
 *   - ⑧에서 반려된 차수는 체결 금액과 건수에 넣지 않음. 다시 기안해 체결되면 그때 셈. ⑧ 확인을 기다리는 계약은 지금처럼 셈 (기획자 결정 2026-11-02 A-2)
 *   - 금액이 있는 계약만(신규, 변경, 연장). 해지와 운영 변경, 작성 중은 넣지 않음
 *   - 열람 제한 계약 중 이 사람이 볼 수 없는 건은 어디에도 넣지 않음(합계로도 드러나지 않게)
 * 그래프(dataviz 기준): 막대는 한 색(--chart-bar), 값은 막대 끝에 글자로, 그래프마다 "표로 보기"
 *   색만으로 뜻을 전하지 않음(기준을 넘은 단계는 "기준 넘음" 글자를 붙임)
 * 볼 수 있는 사람: 모두 (전체 계약과 같음). 기간 마감 점검의 확인은 재무(담당자, 리더, 임원)만 남김. 통제 지표 묶음은 리더와 임원만(C-1)
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const AMOUNT_KINDS = ['NEW', 'AMEND', 'RENEW'];
  const PIPELINE = ['IN_REVIEW', 'SUPPLEMENT', 'APPROVED'];
  // 단계 이름: 막대 옆에 들어가게 짧게
  //   ③ 영업 임원 승인(기획자 결정 2026-11-02 E-3, 할인 폭이 큰 계약만)도 따로 셈
  //   ⑨ 만료 처리(A-10, 종료 다음 날부터 서비스를 닫을 때까지)도. ③ 만료 유예 확인은 끝나면 차례가 사라져 세지 않음
  const STEP_NAMES = { S02: '② 체크리스트', S03: '③ 영업 검토', S03C: '③ 영업 임원 승인', S04: '④ 법무 검토', S05: '⑤ 개인정보', S06: '⑥ 인장 날인',
    S07: '⑦ 체결본 등록', S08: '⑧ 체결본 확인', S09: '⑨ 운영 적용', S10: '⑩ 재무 확인', SXP: '⑨ 만료 처리' };
  const CHECKS = [
    ['standard', 'NO', '1. 표준계약서를 바꿈', '④ 법무 검토'],
    ['price', 'NO', '2. 표준단가표와 다름', '③ 영업 검토'],
    ['cap', 'NO', '3. 할인율 한도를 넘음', '③ 영업 검토'],
    ['accounting', 'YES', '4. 회계에 영향을 주는 특수 조건', '⑩ 재무 확인'],
  ];
  // 견적 칸은 견적 목록(SCR-16)을 볼 수 있는 역할에만 (v0.62, quotes.js와 같은 역할)
  const seeQuotes = me.role === 'SUPER' || C.hasRole(me, ['SALES', 'HEAD', 'EXEC', 'SALES_ADMIN', 'ADMIN']);
  // 기획자 결정 2026-11-02 C-1: 지금 통계는 모두에게 그대로, 새 통제 지표 묶음(아래 9.)만 리더와 임원에게. 감사 열람 역할(C-2)이 생기면 그 역할도
  //   리더: 영업, 영업지원, 정보보호, 고객지원, 재무 리더 / 임원: 영업 임원(COO), 재무 임원(CFO). 최고관리자는 시연용
  const seeControls = ['HEAD', 'EXEC', 'SA_LEAD', 'SEC_LEAD', 'CEM_LEAD', 'FIN_LEAD', 'FIN_EXEC', 'SUPER'].indexOf(me.role) > -1;
  const PRICE_OF = function (fid) { return D.PRICE_BOOK.filter(function (p) { return p.feature === fid; })[0] || null; };

  /* ---------- 세는 법 ---------- */
  // 체결일 (기획자 결정 2026-11-02 B-8, A-2)
  //   date: ⑦에서 받은 서명본 체결일(C.signedDate: 지금 차수 마지막 체결본 등록의 signDate, 없으면 올린 날)
  //   up: 체결본을 올린 때(c.signedAt). 통계는 서명본 체결일로 세고, 올린 때도 남겨 함께 보임
  //   조건 그대로 연장(날인과 체결본 없음)은 지금처럼 ⑩ 재무 확인일(계약 완료된 때), 올린 때는 없음
  //   반려된 차수는 체결로 세지 않음(⑦을 마친 뒤 반려는 ⑧뿐). 다시 기안하면 다음 차수의 ⑦이 끝날 때 셈. ⑧ 확인을 기다리는 계약은 셈
  function signInfo(c) {
    if (c.renewMode === 'AUTO') return c.completedAt ? { date: String(c.completedAt).slice(0, 10), up: null } : null;
    if (!c.signedAt || c.status === 'REJECTED') return null;
    return { date: C.signedDate(c), up: String(c.signedAt) };
  }
  function signDate(c) { const s = signInfo(c); return s ? s.date : ''; }
  // 금액에 넣는 계약: 신규, 변경, 연장 가운데 금액이 있는 것 (해지와 운영 변경은 넣지 않음)
  function counted(c) { return c.amount > 0 && AMOUNT_KINDS.indexOf(c.kind) > -1; }
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
  const all = D.CONTRACTS.filter(function (c) { return c.id && c.status !== 'DRAFT'; });
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

  $('#intro-sub').textContent = '해지와 운영 변경은 금액에 넣지 않고, ⑧에서 반려된 계약도 넣지 않습니다. 진행 중인 금액은 기간과 상관없이 지금 검토부터 체결본 등록 전까지인 계약의 금액입니다.' +
    (hiddenCount ? ' 열람 제한 계약 중 볼 수 없는 ' + hiddenCount + '건은 넣지 않았습니다.' : '');

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
          return '<li data-tip="' + esc(tip) + '">' + label + (b.sum ? '<span class="colchart-bar" style="height:' + (b.sum / top * 100) + '%"></span>' : '') + '</li>';
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
    const pipe = base.filter(function (c) { return PIPELINE.indexOf(c.status) > -1 && !signDate(c) && counted(c); });
    // 기안부터 체결까지: 서명본 체결일까지(B-8). 날짜만 있어 그날 0시로 셈. 서명이 기안보다 앞선 예외는 0일
    const lead = signed.map(function (c) { return Math.max(0, daysFrom(c.requestedAt, signDate(c))); });
    // 체결한 달 뒤에 체결본을 올린 계약(B-8: 올린 때도 남김). 기간 말 앞뒤 확인은 아래 기간 마감 점검
    const lateUp = signed.filter(function (c) { const s = signInfo(c); return s.up && s.up.slice(0, 7) > s.date.slice(0, 7); }).length;
    const tiles = [
      ['체결 금액', fmtMoney(sum(signed)), '서명본 체결일 기준' + (lateUp ? ', 체결한 달 뒤에 올린 ' + lateUp + '건 포함' : '')],
      ['체결 건수', signed.length + '건', AMOUNT_KINDS.filter(function (k) { return kinds[k]; }).map(function (k) { return D.KINDS[k] + ' ' + kinds[k] + '건'; }).join(', ') || '없음'],
      ['진행 중인 금액', fmtMoney(sum(pipe)), '기간과 상관없이 지금 검토부터 체결본 등록 전까지 ' + pipe.length + '건'],
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
    $('#month-rows').innerHTML = months.map(function (k) {
      return '<tr><td class="center">' + monthLong(k) + (k === todayKey ? '<span class="cell-meta">' + Number(D.TODAY.slice(8)) + '일까지</span>' : '') + '</td>' +
        '<td class="num">' + by[k].count + '건</td><td class="num">' + fmtMoney(by[k].sum) + '</td></tr>';
    }).join('') + '<tr class="row-total"><th scope="row" class="center">합계</th><td class="num">' + signed.length + '건</td><td class="num">' + fmtMoney(sum(signed)) + '</td></tr>';

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
      return list.map(function (g) { return { label: g.label, value: g.sum, text: fmtShort(g.sum) + ' 원', tip: g.label + ': ' + g.count + '건, ' + fmtMoney(g.sum) }; });
    };
    $('#service-chart').innerHTML = barChart(toRows(svc), { labelW: '10rem', valW: '7.2rem' });
    $('#unit-chart').innerHTML = barChart(toRows(unt), { labelW: '10rem', valW: '7.2rem' });
    $('#split-rows').innerHTML = [['서비스', svc], ['영업 유닛', unt]].map(function (p) {
      return p[1].map(function (g) { return '<tr><td class="center">' + p[0] + '</td><td>' + esc(g.label) + '</td><td class="num">' + g.count + '건</td><td class="num">' + fmtMoney(g.sum) + '</td></tr>'; }).join('');
    }).join('') || '<tr><td colspan="4" class="empty-row">이 조건에서 체결한 계약이 없습니다.</td></tr>';

    // 4. 결재 단계마다 걸린 날: 기간 안에 처리한 단계(차례가 온 때 → 처리한 때)
    const st = {};
    base.forEach(function (c) {
      (c.approvals || []).forEach(function (a) {
        if (a.state !== 'DONE' || !a.arrivedAt || !a.decidedAt || !STEP_NAMES[a.step]) return;
        if (months.indexOf(a.decidedAt.slice(0, 7)) < 0) return;
        const d = Math.max(0, daysFrom(a.arrivedAt, a.decidedAt));
        st[a.step] = st[a.step] || [];
        st[a.step].push(d);
      });
    });
    const LIMIT = D.ALERT_RULES.approvalDelayDays, SIGN_LIMIT = D.ALERT_RULES.signDelayDays;
    const steps = Object.keys(STEP_NAMES).filter(function (k) { return st[k]; }).map(function (k) {
      const avg = st[k].reduce(function (a, b) { return a + b; }, 0) / st[k].length;
      const limit = k === 'S07' ? SIGN_LIMIT : LIMIT;
      return { code: k, avg: avg, n: st[k].length, max: Math.max.apply(null, st[k]), over: avg > limit };
    });
    $('#step-desc').textContent = '차례가 온 때부터 처리한 때까지의 평균입니다(기간 안에 처리한 것). 세로선은 오래 머문 것으로 보는 기준 ' + LIMIT +
      '일입니다(⑦ 체결본 등록은 승인 뒤 ' + SIGN_LIMIT + '일).';
    $('#step-chart').innerHTML = barChart(steps.map(function (s) {
      return { label: STEP_NAMES[s.code], value: s.avg, text: fmtDays(s.avg), note: s.over ? '기준 넘음' : '', noRef: s.code === 'S07',
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
        if (!first || !C.canSeeQuote(me, q) || months.indexOf(String(first.at).slice(0, 7)) < 0) return false;
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

    // 9. 통제 지표 (기획자 결정 2026-11-02 C-1: 리더와 임원만)
    if (seeControls) renderControls(withCk, base, months);
  }

  /* ---------- 9. 통제 지표 (기획자 결정 2026-11-02 C-1, 리더와 임원만) ----------
   * 가. 4번 조건의 종류(B-6, CTL-52): 체결한 계약 가운데 4번이 예인 계약을 고른 종류(checklist.acctKinds, D.ACCT_KINDS)마다 셈
   *     한 계약이 여러 종류를 고를 수 있어 합이 4번 예 건수보다 클 수 있음. 종류를 두기 전 기록은 "고르지 않음(예전 기록)"
   * 나. ④ 반부패 조항 판단(C-15, CTL-34): 표준계약서를 바꾼 계약 가운데 기간 안에 ④ 승인이 끝난 계약을 계약 방식마다
   *     있고 약해지지 않음(KEPT), 없음(NONE), 고르지 않음(직접은 선택, 판단을 두기 전 기록)으로 셈(C.legalApproval)
   *     "없음"은 전체 계약의 거르기(contracts.html?ab=NONE)로 이어짐 */
  function meterHtml(label, n, of, unit) {
    const pct = of ? Math.round(n / of * 100) : 0;
    return '<div class="meter"><p class="meter-head"><span class="meter-label">' + esc(label) + '</span>' +
      '<span class="meter-val">' + unit + ' ' + of + '건 중 ' + n + '건(' + pct + '%)</span></p>' +
      '<span class="meter-track" role="img" aria-label="' + esc(label + ': ' + unit + ' ' + of + '건 중 ' + n + '건, ' + pct + '%') + '"><span class="meter-fill" style="width:' + pct + '%"></span></span></div>';
  }
  function renderControls(withCk, base, months) {
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
      if (c.status === 'REJECTED') return;
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
    // B-5: 견적서로 대신한 계약은 고객 날인일(결재 문서의 날짜 순서 안내와 같은 말)
    const quote = C.isQuoteInstead(c);
    const odd = C.dateOrderIssues(c).map(function (x) {
      return '<span class="cell-meta">' + C.badge('attention', '날짜 순서') + ' ' + esc(quote ? x.text.replace(/서명본 체결일/g, '고객 날인일') : x.text) + '</span>';
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
        C.fieldHtml({ name: 'memo', label: '메모 (선택)', type: 'textarea', help: '예: 기간 말 뒤에 올린 1건은 서명본 체결일에 맞춰 9월로 반영함' }),
      btn: '확인 남기기',
      done: function (f) {
        C.pushDemo('closeChecks', { end: end, at: C.nowStamp().slice(0, 16), by: me.id, dept: me.dept || '', memo: f.elements.memo.value.trim(), seen: seen });
        renderClose(false);
        C.toast(C.fmtDate(end) + ' 기간 마감 점검 확인을 남겼습니다.');
      },
    });
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
  $('#control-panel').hidden = !seeControls; // 통제 지표는 리더와 임원만(C-1). 역할은 화면을 여는 동안 바뀌지 않아 자리가 흔들리지 않음
  render();

  // 기간 마감 점검 (B-9): 기간 말 기본값은 지난달 말일, 오늘 뒤의 날은 달력에서 고를 수 없음. 앞뒤 날 수 기본 5일
  //   넣는 동안(input)은 맞는 값일 때만 다시 그리고, 칸을 떠날 때(change) 맞지 않으면 오류를 보임
  $('#close-end').setAttribute('max', D.TODAY);
  $('#close-end').value = PREV_MONTH_END;
  $('#close-days').value = CLOSE_DAYS;
  $('#close-bar').addEventListener('input', function () { renderClose(false); });
  $('#close-bar').addEventListener('change', function () { renderClose(true); });
  // 확인은 재무만: 그 밖의 사람에게는 단추를 두지 않음(역할은 화면을 여는 동안 바뀌지 않아 자리가 흔들리지 않음)
  const okBtn = $('#btn-close-ok');
  if (canConfirm) okBtn.addEventListener('click', openConfirm); else okBtn.remove();
  renderClose(false);
})();
