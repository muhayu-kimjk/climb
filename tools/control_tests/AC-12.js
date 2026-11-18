// AC-12 1번 답 강제 (CTL-23) 시험 (2026-11-13 주말 점검 W2)
//   계약 등록 화면의 기안 검사(new-contract.js validate)와 기준 표준계약서 고르기(templatePick), 결재선(common.js reviewRoute)을 봄
//   화면 코드는 함수를 내보내지 않으므로, 파일은 고치지 않고 함수 글만 읽어 이 시험 안에서 만듦(pageFn). 화면 칸 값은 vals로 넣음
'use strict';
const fs = require('fs');
const path = require('path');
const JS = path.join(__dirname, '..', '..', 'prototype', 'assets', 'js');

function fnText(file, marker) {
  const src = fs.readFileSync(path.join(JS, file), 'utf8');
  const at = src.indexOf(marker);
  if (at < 0) throw new Error(file + '에서 "' + marker.trim() + '"를 찾지 못함');
  const f = src.indexOf('function', at);
  let i = src.indexOf('{', f), depth = 0, q = '';
  for (; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === '\\') i++; else if (ch === q) q = ''; continue; }
    if (ch === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); continue; }
    if (ch === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 1; continue; }
    if (ch === '\'' || ch === '"' || ch === '`') { q = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return src.slice(f, i + 1);
  }
  throw new Error(file + ' ' + marker.trim() + '의 끝을 찾지 못함');
}
function pageFn(file, marker, scope) {
  return new Function('__s', 'with (__s) { return (' + fnText(file, marker) + '); }')(scope);
}

// 계약 등록 화면을 다 채운 상태(기안 검사를 지나는 값). over로 칸 값을, files로 첨부를 바꿈
function form(env, over, files) {
  const vals = Object.assign({
    kind: 'NEW', customer: 'C:C-0012', counterparty: '새솔고등학교', bizNo: '314-83-20951', opportunity: '2610SU099', method: 'DIRECT',
    startDate: '2026-11-01', endDate: '2027-10-31', autoRenew: 'NO', personalData: 'NO', sla: 'NO', settlement: 'LUMP',
    standard: 'YES', standardNote: '', template: 'TPL-CK', accounting: 'NO', signMethod: 'PAPER',
  }, over || {});
  const el = { '#f-start': { value: vals.startDate }, '#f-end': { value: vals.endDate }, '#yearly-field': { hidden: true }, '#f-quote-instead': { checked: false } };
  const li = { querySelector: function () { return null; }, classList: { add: function () {} } };
  const rows = [{ li: li, feature: 'CK_CAMPUS_PLAG', product: { service: 'CK' }, qty: 1, amount: 12000000 }];
  const scope = {
    D: env.D, C: env.C, esc: env.C.esc, me: env.U('u_sales1'), source: null, NEW_CUSTOMER: 'NEW', qInput: {},
    val: function (n) { return vals[n] || ''; },
    $: function (sel) { return el[sel] || { value: '', hidden: true, checked: false }; },
    $$: function () { return []; },
    clearAllErrors: function () {}, setError: function (name) { return name; },
    originBlock: function () { return null; }, syncOpp: function () {}, opp: { other: [], same: [] }, syncGuards: function () {}, guard: {},
    linkedQuote: function () { return null; }, qLinkSel: { value: '' }, renewStart: function () { return ''; }, originTerms: function () { return null; },
    badNum: function (v) { return !/^[\d,\s]*$/.test(String(v == null ? '' : v)); }, parseNum: function (v) { return v ? parseInt(String(v).replace(/\D/g, ''), 10) : null; },
    readProducts: function () { return rows; }, termsMode: function () { return false; }, reduceMode: function () { return false; },
    totalAmount: function () { return 12000000; }, fmtNum: function (n) { return String(n); }, acctKinds: function () { return []; },
    current: { pc: { q2: 'YES', q3: 'YES' } },
    files: Object.assign({ draft: [{ name: '계약서 초안.docx', size: 1000 }], diff: [], annex: [], quote: [] }, files || {}),
  };
  scope.validate = pageFn('new-contract.js', '  function validate() {', scope);
  scope.templatePick = pageFn('new-contract.js', '  function templatePick() {', scope);
  return scope;
}
const errs = function (list) { return list.map(function (e) { return e.target + ': ' + e.msg; }).join(' / '); };
const DIFF = { diff: [{ name: '조항 대비표.docx', size: 1000 }] };

module.exports = {
  ac: 'AC-12',
  title: '1번 답 강제',
  tests: [
    {
      name: '기본 입력(표준계약서 그대로, 1번 예)은 기안 검사를 지남 (아래 시험의 바탕)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const e = form(env).validate();
        return e.length ? '기본 입력이 막힘: ' + errs(e) : true;
      },
    },
    {
      name: '상대방 양식, 1번 아니요, 비고와 조항 대비표가 있으면 기안되고 ④를 거침',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const f = form(env, { template: 'OWN', standard: 'NO', standardNote: '상대방 양식 계약서' }, DIFF);
        const e = f.validate();
        if (e.length) return '기안 검사에서 막힘: ' + errs(e);
        const tp = f.templatePick();
        if (!tp || tp.id !== 'OWN') return '고른 표준계약서가 상대방 양식으로 남지 않음';
        env.C.saveDemoContract({ id: '2610CL015', counterparty: '새솔고등학교', services: ['CK'], kind: 'NEW', amount: 12000000, requesterId: 'u_sales1',
          requestedAt: env.D.TODAY + ' 00:00', status: 'IN_REVIEW', round: 1, history: [], personalData: false, template: tp,
          checklist: { standard: 'NO', standardNote: '상대방 양식 계약서', price: 'YES', cap: 'YES', accounting: 'NO' },
          files: [{ kind: 'DRAFT_DOC', name: 'a.docx' }, { kind: 'CLAUSE_DIFF', name: 'b.docx' }] });
        const c = env.contract('2610CL015');
        const s04 = c.approvals.find(a => a.step === 'S04');
        if (!s04 || s04.state === 'SKIPPED') return '④가 생략됨: ' + (s04 && s04.reason);
        if (!(env.C.templateOf(c) || {}).own) return '계약의 기준 표준계약서가 상대방 양식이 아님';
        // 예시 2610CL008(상대방 양식, 1번 아니요)도 ④를 거침
        const c8 = env.contract('2610CL008');
        const a8 = c8.approvals.find(a => a.step === 'S04');
        if (!a8 || a8.state === 'SKIPPED') return '예시 2610CL008의 ④가 생략됨';
        return true;
      },
    },
    {
      name: '기준 표준계약서를 고르면 그날의 지금 판이 남음',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const tp = form(env, { template: 'TPL-CK' }).templatePick();
        if (!tp || tp.no !== 2) return '10-19의 카피킬러 표준계약서 판이 2가 아님: ' + JSON.stringify(tp);
        const env2 = h.fresh({ role: 'SALES', hook: D => { D.TODAY = '2026-11-01'; } });
        const tp2 = form(env2, { template: 'TPL-DPA' }).templatePick();
        if (!tp2 || tp2.no !== 2) return '11-01의 개인정보 처리위탁 계약서 판이 2(그날 시작)가 아님: ' + JSON.stringify(tp2);
        return true;
      },
    },
    {
      name: '상대방 양식인데 1번을 예로 답함: 기안 거절',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const e = form(env, { template: 'OWN', standard: 'YES' }).validate();
        return e.some(x => x.target === 'template' && /아니요/.test(x.msg)) ? true : '막히지 않음: ' + (errs(e) || '오류 없음');
      },
    },
    {
      name: '기준 표준계약서를 비움: 기안 거절',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const e = form(env, { template: '' }).validate();
        return e.some(x => x.target === 'template') ? true : '막히지 않음: ' + (errs(e) || '오류 없음');
      },
    },
    {
      name: '1번 아니요인데 조항 대비표가 없거나 비고가 빈칸: 기안 거절',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const e1 = form(env, { standard: 'NO', standardNote: '제12조 바꿈' }).validate();
        if (!e1.some(x => x.target === 'diffFile')) return '조항 대비표 없이 지남: ' + (errs(e1) || '오류 없음');
        const e2 = form(env, { standard: 'NO', standardNote: '' }, DIFF).validate();
        if (!e2.some(x => x.target === 'standardNote')) return '비고 없이 지남: ' + (errs(e2) || '오류 없음');
        return true;
      },
    },
  ],
  serverOnly: [
    '상대방 양식인데 1번을 예로 바꿔 요청을 직접 보냄: 시안은 화면 검사(validate)만 하고 저장 함수와 reviewRoute는 저장된 답을 믿음(서버가 표준계약서와 1번 답의 짝을 다시 확인)',
    '기준 표준계약서를 비우거나 1번 아니요인데 조항 대비표 없이 요청을 직접 보냄: 서버가 다시 확인(시안은 화면에서만 막음)',
    '판 번호를 예전 판으로 바꿔 보냄: 서버가 기안일의 지금 판으로 정함. 시안 templateOf는 계약에 남은 판 번호(template.no)를 그대로 씀',
    '표준계약서 본문을 고치고 1번에 예: 시스템이 찾지 못하는 남는 위험(자동 비교는 REQ-CHK-06 향후 과제, ②가 봄). 시험 대상 아님',
  ],
};
