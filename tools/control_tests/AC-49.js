// AC-49 통계에서 열람 제한 빼기 (CTL-126, 06 통제 목록 2장) 시험 (2026-11-13 주말 점검 W2)
//   기대 동작: 보는 사람이 볼 수 없는 열람 제한 계약을 합계, 그래프, 거르기, 거래처마다 표 어디에도 넣지 않고 뺀 건수만 알린다.
//     인쇄하면 맨 위 조건 줄에 뺀 건수가 찍힌다.
//   시안 코드: stats.js visible, hiddenCount, render(맨 위 조건 줄 #cond). 통계 화면(stats.js)을 가짜 문서에 올려 그린 글을 봄
//   "합계로 드러나지 않음"은 견주어 봄: 같은 사람으로 (가) 그대로 연 화면과 (나) 그 사람이 볼 수 없는 계약을 데이터에서 아예 뺀 화면이
//     모든 거르기 조건에서 같은 글이어야 함(뺀 건수 안내와 기간 마감 점검 묶음은 AC-50에서 따로 봄)
// 통계 화면을 그 사람으로 여는 stats는 lib.js에 있음(전에 이 파일의 lib였고 AC-50도 함께 씀)
'use strict';
const { stats, strip } = require('./lib');

// 그 사람이 볼 수 없는 계약(작성 중과 예전 계약 기록은 통계 밖이라 뺌)
function hiddenOf(env, u) { return env.D.CONTRACTS.filter(c => c.id && c.status !== 'DRAFT' && !c.legacy && !env.C.canView(c, u)); }
// 그린 글 모음(뺀 건수 안내 #intro-sub, 인쇄 조건 줄 #cond, 기간 마감 점검, 내보내기, 고르는 칸은 뺌)
function snap(dom) {
  const o = {};
  for (const [k, el] of dom.ids) {
    if (/^#(intro-sub|cond|close-|export-|ex-|chart-tip|f-|btn-)/.test(k)) continue;
    o[k] = strip(el.innerHTML) + '|' + strip(el.textContent) + '|' + el.hidden;
  }
  return o;
}
function options(dom, sel) { const out = []; String(dom.q(sel).innerHTML).replace(/<option value="([^"]*)"/g, (m, v) => { out.push(v); return m; }); return out; }
function setFilter(x, p, s, u) { x.dom.q('#f-period').value = p; x.dom.q('#f-service').value = s; x.dom.q('#f-unit').value = u; x.dom.fire('#filter', 'change'); }
// 모든 거르기 조건(기간 x 서비스 x 유닛)에서 (가)와 (나)를 견줌. 다른 곳 하나라도 있으면 그 글
function compareAll(h, userId) {
  const A = stats(h, userId);
  if (A.dom.error) return { why: '통계 화면을 열지 못함: ' + A.dom.error.message };
  const hid = hiddenOf(A.env, A.u).map(c => c.id);
  if (!hid.length) return { why: userId + '에게 볼 수 없는 계약이 없음(시험 전제)' };
  const B = stats(h, userId, D => { D.CONTRACTS = D.CONTRACTS.filter(c => hid.indexOf(c.id) < 0); });
  const periods = options(A.dom, '#f-period'), services = options(A.dom, '#f-service'), units = options(A.dom, '#f-unit');
  let n = 0;
  for (const p of periods) for (const s of services) for (const u of units) {
    setFilter(A, p, s, u); setFilter(B, p, s, u); n++;
    const a = snap(A.dom), b = snap(B.dom);
    const k = Object.keys(Object.assign({}, a, b)).find(x => a[x] !== b[x]);
    if (k) return { why: '조건(기간 ' + p + ', 서비스 ' + (s || '전체') + ', 유닛 ' + (u || '전체') + ')에서 볼 수 없는 계약이 ' + k + '에 영향을 줌: ' + String(a[k]).slice(0, 160) + ' / 뺀 화면: ' + String(b[k]).slice(0, 160), A, hid };
  }
  return { why: '', A, hid, n };
}

module.exports = {
  ac: 'AC-49',
  title: '통계에서 열람 제한 빼기',
  tests: [
    {
      name: '볼 수 없는 열람 제한 계약이 1건 있는 영업(정하은)이 통계를 열면 합계와 그래프에 그 계약이 없고, 안내와 인쇄 조건 줄에 뺀 계약 1건이 보임',
      kind: 'ok',
      run(h) {
        const x = stats(h, 'u_sales2');
        if (x.dom.error) return '통계 화면을 열지 못함: ' + x.dom.error.message;
        const hid = hiddenOf(x.env, x.u);
        if (hid.length !== 1) return '정하은이 볼 수 없는 계약이 ' + hid.length + '건(시험 전제는 1건)';
        const c = hid[0];
        if (x.text('#intro-sub').indexOf('볼 수 없는 1건은 넣지 않았습니다') < 0) return '안내에 뺀 1건이 보이지 않음';
        if (x.text('#cond').indexOf('열람 제한으로 뺀 계약 1건') < 0) return '인쇄 조건 줄에 뺀 1건이 없음: ' + x.text('#cond');
        const amt = c.amount.toLocaleString('ko-KR');
        const all = Object.values(snap(x.dom)).join(' ');
        if (all.indexOf(c.counterparty) > -1) return '화면 어딘가에 볼 수 없는 계약의 고객사(' + c.counterparty + ')가 보임';
        if (all.indexOf(c.id) > -1) return '화면 어딘가에 볼 수 없는 계약번호가 보임';
        if (all.indexOf(amt) > -1) return '화면 어딘가에 볼 수 없는 계약의 금액(' + amt + ')이 보임';
        // 합계와 그래프: 그 계약을 데이터에서 뺀 화면과 같아야 함
        const B = stats(h, 'u_sales2', D => { D.CONTRACTS = D.CONTRACTS.filter(k => k.id !== c.id); });
        const a = snap(x.dom), b = snap(B.dom);
        const diff = ['#tiles', '#month-rows', '#month-chart', '#service-chart', '#unit-chart', '#split-rows'].filter(k => a[k] !== b[k]);
        if (diff.length) return '볼 수 없는 계약이 합계나 그래프에 들어감: ' + diff.join(', ');
        return true;
      },
    },
    {
      name: '서비스, 유닛, 기간을 어떻게 좁혀도 볼 수 없는 계약이 합계, 그래프, 표 어디에도 들지 않음(영업 리더 최민준, 영업 정하은)',
      kind: 'deny',
      run(h) {
        for (const id of ['u_head', 'u_sales2']) {
          const r = compareAll(h, id);
          if (r.why) return id + ': ' + r.why;
        }
        // 견줌이 헛돌지 않는지: 모두 보는 최고관리자는 같은 계약을 빼면 화면이 달라져야 함
        const S = stats(h, 'u_super', null, 'SUPER');
        const T = stats(h, 'u_super', D => { D.CONTRACTS = D.CONTRACTS.filter(c => ['2511CL002', '2609CL008'].indexOf(c.id) < 0); }, 'SUPER');
        const a = snap(S.dom), b = snap(T.dom);
        if (!Object.keys(a).some(k => a[k] !== b[k])) return '견줌 방법이 차이를 찾지 못함(시험 방법 확인 필요)';
        return true;
      },
    },
    {
      name: '거래처마다 예외 표(CTL-127)에 볼 수 없는 계약의 거래처가 나오지 않음(영업 리더 최민준)',
      kind: 'deny',
      run(h) {
        const x = stats(h, 'u_head');
        if (x.dom.error) return '통계 화면을 열지 못함: ' + x.dom.error.message;
        const hid = hiddenOf(x.env, x.u);
        const names = hid.map(c => c.counterparty);
        for (const p of options(x.dom, '#f-period')) {
          setFilter(x, p, '', '');
          const t = x.text('#check-split-rows');
          const leak = names.filter(n => t.indexOf(n) > -1);
          if (leak.length) return '기간 ' + p + ': 거래처마다 예외 표에 볼 수 없는 거래처가 나옴: ' + leak.join(', ');
        }
        // 견줌: 그 계약을 볼 수 있는 기안자(정하은)에게는 나옴(표에 들 만한 계약임을 확인)
        const y = stats(h, 'u_sales2');
        if (y.text('#check-split-rows').indexOf('해솔테크') < 0) return '견줌: 정하은의 표에도 해솔테크가 없음(시험 전제 확인 필요)';
        return true;
      },
    },
    {
      name: '인쇄한 보고서의 맨 위 조건 줄에는 어느 조건에서나 뺀 건수가 찍힘(영업 리더 최민준, 2건)',
      kind: 'deny',
      run(h) {
        const x = stats(h, 'u_head');
        if (x.dom.error) return '통계 화면을 열지 못함: ' + x.dom.error.message;
        const n = hiddenOf(x.env, x.u).length;
        for (const p of options(x.dom, '#f-period')) for (const s of options(x.dom, '#f-service')) for (const u of options(x.dom, '#f-unit')) {
          setFilter(x, p, s, u);
          const t = x.text('#cond');
          if (t.indexOf('열람 제한으로 뺀 계약 ' + n + '건') < 0) return '조건(기간 ' + p + ', 서비스 ' + (s || '전체') + ', 유닛 ' + (u || '전체') + ')의 조건 줄에 뺀 건수가 없음: ' + t;
          if (!/기간: .*서비스: .*영업 유닛: .*기준일: /.test(t)) return '조건 줄에 기간, 서비스, 유닛, 기준일이 모두 찍히지 않음: ' + t;
        }
        return true;
      },
    },
  ],
  serverOnly: [
    '서버가 보낸 통계 데이터에 볼 수 없는 계약의 고객사나 금액이 들어 있음: 실패(화면에서만 빼면 안 됨). 시안은 모든 계약 데이터를 브라우저에 두고 화면에서 뺌. 실제 통계 합계는 서버가 보는 사람의 열람 권한으로 계산(04 2.5 "가림은 서버에서", 3장 "통계 계산")',
  ],
};
