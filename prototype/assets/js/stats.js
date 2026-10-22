/* =====================================================================
 * SCR-46 통계와 보고서 화면 로직 (stats.js, v0.53 기획자 요청, 요구사항 정의서 REQ-DASH-17~21)
 * ---------------------------------------------------------------------
 * 하는 일
 *   1. 조건: 기간(최근 12개월, 해마다), 서비스, 영업 유닛(기안한 영업의 조직)
 *   2. 한눈에 보기: 체결 금액, 체결 건수, 진행 중인 금액(기간과 상관없이 지금), 기안부터 체결까지 걸린 날
 *   3. 달마다 체결 금액(세로 막대), 서비스와 영업 유닛마다 체결 금액(가로 막대)
 *   4. 결재 단계마다 걸린 날: 차례가 온 때부터 처리한 때까지의 평균. 오래 머묾 기준(ALERT_RULES)을 세로선으로
 *   5. 체크리스트 예외 비율: 체결한 계약 가운데 1~3번 "아니요", 4번 "예"인 계약
 * 세는 법
 *   - 체결일: 체결본 등록(⑦)의 마지막 기록. 조건 그대로 연장(날인과 체결본 없음)은 ⑩ 재무 확인일
 *   - 금액이 있는 계약만(신규, 변경, 연장). 해지와 운영 변경, 작성 중은 넣지 않음
 *   - 열람 제한 계약 중 이 사람이 볼 수 없는 건은 어디에도 넣지 않음(합계로도 드러나지 않게)
 * 그래프(dataviz 기준): 막대는 한 색(--chart-bar), 값은 막대 끝에 글자로, 그래프마다 "표로 보기"
 *   색만으로 뜻을 전하지 않음(기준을 넘은 단계는 "기준 넘음" 글자를 붙임)
 * 볼 수 있는 사람: 모두 (전체 계약과 같음)
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
  const STEP_NAMES = { S02: '② 체크리스트', S03: '③ 영업 검토', S04: '④ 법무 검토', S05: '⑤ 개인정보', S06: '⑥ 인장 날인',
    S07: '⑦ 체결본 등록', S08: '⑧ 체결본 확인', S09: '⑨ 운영 적용', S10: '⑩ 재무 확인' };
  const CHECKS = [
    ['standard', 'NO', '1. 표준계약서를 바꿈', '④ 법무 검토'],
    ['price', 'NO', '2. 표준단가표와 다름', '③ 영업 검토'],
    ['cap', 'NO', '3. 할인율 한도를 넘음', '③ 영업 검토'],
    ['accounting', 'YES', '4. 회계에 영향을 주는 특수 조건', '⑩ 재무 확인'],
  ];

  /* ---------- 세는 법 ---------- */
  // 체결일은 C.signDate(차수와 다시 등록 요청을 따져 buildReview가 정한 체결본 등록 시각)
  const signDate = C.signDate;
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

  $('#intro-sub').textContent = '해지와 운영 변경은 금액에 넣지 않습니다. 진행 중인 금액은 기간과 상관없이 지금 검토부터 체결본 등록 전까지인 계약입니다.' +
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
    const last = months[months.length - 1];
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
      return d && c.amount > 0 && AMOUNT_KINDS.indexOf(c.kind) > -1 && months.indexOf(d.slice(0, 7)) > -1;
    });
    const sum = function (list) { return list.reduce(function (a, c) { return a + c.amount; }, 0); };

    // 인쇄할 때 맨 위에 찍히는 조건
    $('#cond').textContent = '기간: ' + PERIODS.filter(function (p) { return p[0] === period; })[0][1] + '(' + from + '~' + to + '), 서비스: ' +
      (service ? D.SERVICES[service] : '전체') + ', 영업 유닛: ' + (unit || '전체') + ', 기준일: ' + C.fmtDate(D.TODAY) + (hiddenCount ? ', 열람 제한으로 뺀 계약 ' + hiddenCount + '건' : '');

    // 1. 한눈에 보기
    const kinds = {};
    signed.forEach(function (c) { kinds[c.kind] = (kinds[c.kind] || 0) + 1; });
    const pipe = base.filter(function (c) { return PIPELINE.indexOf(c.status) > -1 && !signDate(c) && c.amount > 0 && AMOUNT_KINDS.indexOf(c.kind) > -1; });
    const lead = signed.map(function (c) { return daysFrom(c.requestedAt, signDate(c)); });
    const tiles = [
      ['체결 금액', fmtMoney(sum(signed)), '체결본을 등록한 날 기준'],
      ['체결 건수', signed.length + '건', AMOUNT_KINDS.filter(function (k) { return kinds[k]; }).map(function (k) { return D.KINDS[k] + ' ' + kinds[k] + '건'; }).join(', ') || '없음'],
      ['진행 중인 금액', fmtMoney(sum(pipe)), '검토부터 체결본 등록 전까지 ' + pipe.length + '건(지금)'],
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
    $('#month-desc').innerHTML = from + '~' + to + '. 막대 위 글자는 가장 큰 달과 이번 달입니다.' +
      '<span class="no-print"> 막대에 마우스를 올리면 건수와 금액이 보입니다.</span>';
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
    const svc = group(function (c) { return c.services.length > 1 ? '두 서비스 함께' : D.SERVICES[c.services[0]] || c.services[0]; });
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
  render();
})();
