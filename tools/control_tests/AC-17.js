// AC-17 ② 체크리스트 검토 (CTL-30, CTL-49, CTL-50, CTL-51) 시험 (2026-11-13 주말 점검 W2)
//   결재 문서 화면(review.js)의 확인 창 문구(modalText)와 확인 단추(confirmAction), 같은 거래처 최근 계약 상자(recent, recentHtml)와 common.js recordAction
//   화면 코드는 함수를 내보내지 않으므로, 파일은 고치지 않고 함수 글만 읽어 이 시험 안에서 만듦(pageFn).
//   확인 창의 체크 상자와 글 칸은 가짜 창(modal, $)으로 넣음: 체크를 빼면 confirmAction이 결재 기록을 남기지 않아야 함
'use strict';
const fs = require('fs');
const path = require('path');
const lib = require('./lib');
const JS = path.join(__dirname, '..', '..', 'prototype', 'assets', 'js');

// 화면 코드에서 marker 뒤 첫 function의 글을 { } 짝으로 잘라 냄(따옴표와 주석 안의 괄호는 셈하지 않음)
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

/* 결재 문서 화면을 c와 보는 사람(meId)으로 엶. 돌려주는 것:
 *   recent(같은 거래처 최근 계약), recentCount, modalText, recentHtml
 *   confirm(action, code, input): 확인 창을 열고(openModal처럼 단계를 고름) input대로 채운 뒤 확인을 누름. 결재 기록을 남겼으면 그 기록, 아니면 null
 *     input.uncheck: 체크하지 않을 확인 항목 이름들 / input.picked: 고를 보완할 항목 코드 / input.memo / input.restart */
function reviewPage(env, c, meId) {
  const calls = [];
  const C2 = Object.create(env.C);
  C2.recordAction = function () { const r = env.C.recordAction.apply(env.C, arguments); calls.push(r); return r; };
  C2.flash = function () {};
  const scope = {
    D: env.D, C: C2, c: c, me: env.U(meId), esc: env.C.esc, addDays: env.C.addDays,
    short: env.C.isShort(c), change: env.C.isChange(c), reqDate: (c.requestedAt || '').slice(0, 10),
    DONE_MSG: {}, location: { reload: function () {} }, holdStops: function () { return false; }, holdNote: function () { return ''; },
    closeModal: function () {}, showError: function () {},
  };
  scope.bizDigits = pageFn('review.js', '  function bizDigits(x) {', scope);
  scope.recent = pageFn('review.js', '  const recent = (function () {', scope)();
  scope.recentCount = scope.recent.list.length + scope.recent.hidden;
  scope.modalText = pageFn('review.js', '  function modalText(action, code) {', scope);
  scope.recentHtml = pageFn('review.js', '  function recentHtml() {', scope);
  const confirmAction = pageFn('review.js', '  function confirmAction() {', scope);
  function confirm(action, code, input) {
    input = input || {};
    const t = scope.modalText(action, code);
    const s = code === 'S01' ? { step: 'S01', userId: env.C.repActorOf(c) } : c.approvals.find(function (x) { return x.step === code; });
    scope.pending = { action: action, step: s, t: t };
    const boxes = (t.checks || []).map(function (x) { return { value: x, checked: (input.uncheck || []).indexOf(x) < 0 }; });
    const picked = (input.picked || []).map(function (k) { return { value: k, checked: true }; });
    const el = function () { return { value: '', hidden: true, innerHTML: '', classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, removeAttribute() {}, querySelectorAll() { return []; } }; };
    const els = { '#act-comment': Object.assign(el(), { value: input.memo || '' }), '#act-restart': t.restart ? Object.assign(el(), { checked: !!input.restart }) : null };
    scope.$ = function (sel) { return sel in els ? els[sel] : el(); };
    scope.modal = {
      querySelectorAll: function (sel) { return sel === '#act-checks input' ? boxes : sel === '#act-reasons input:checked' ? picked : []; },
      querySelector: function () { return null; },
    };
    const before = calls.length;
    confirmAction();
    return calls.length > before ? calls[calls.length - 1] : null;
  }
  return { scope: scope, recent: scope.recent, recentCount: scope.recentCount, modalText: scope.modalText, recentHtml: scope.recentHtml, confirm: confirm };
}

function line(amount, qty) {
  const n = qty || 1;
  return { feature: 'CK_CAMPUS_PLAG', qty: n, amount: amount, listPrice: 12000000, cap: 0.2, unitKind: 'PERIOD', months: 12, stdAmount: 12000000 * n };
}
// 1~3번 모두 예로 기안한 계약(같은 거래처 최근 계약이 없게 거래처 목록에 없는 이름)
function rec(env, id, over) {
  return Object.assign({
    id: id, counterparty: '시험대학교', services: ['CK'], kind: 'NEW', amount: 12000000, requesterId: 'u_sales1',
    requestedAt: env.D.TODAY + ' 00:00', restricted: false, personalData: false, status: 'IN_REVIEW', round: 1, history: [],
    checklist: { standard: 'YES', price: 'YES', cap: 'YES', accounting: 'NO' }, products: [line(12000000)],
  }, over || {});
}
function step(c, code) { return (c.approvals || []).find(a => a.step === code) || null; }
function stateOf(c, code) { const a = step(c, code); return a ? a.state : 'NONE'; }
const FIVE = ['고객사와 사업자등록번호', '제품 줄의 수량과 금액', '1번 답과 표준계약서 판', '4번 답과 계약서의 무상 기간이나 환불 조건', '필수 첨부 파일'];
const SPLIT = '같은 거래처 최근 계약과 나눠 맺은 계약이 아님';
// (2026-11-13 시험 다지기) 결재 문서(review.js 그대로, lib.js의 review로 가짜 문서에 올림)의 체크리스트 칸과 기본 정보 칸 글
//   문항 하나의 글: 그 문항 머리부터 다음 문항 머리 앞까지
const Q = ['1. 표준계약서를 사용했나요?', '2. 표준단가표를 적용했나요?', '3. 할인율 한도를 지켰나요?', '4. 회계에 영향을 주는 특수 조건이 있나요?'];
function docOf(env, id) {
  const rv = lib.review(env, id, 'u_sadmin');
  if (rv.error) return { error: rv.error };
  const ck = lib.strip(rv.dom.q('#checklist').innerHTML), basic = lib.strip(rv.dom.q('#basic').innerHTML);
  const part = function (i) {
    const a = ck.indexOf(Q[i]);
    if (a < 0) return null;
    const b = i + 1 < Q.length ? ck.indexOf(Q[i + 1], a) : -1;
    return ck.slice(a + Q[i].length, b < 0 ? ck.length : b);
  };
  return { ck: ck, basic: basic, q: [0, 1, 2, 3].map(part) };
}
// 결재 문서의 한 문항이 저장값(답과 비고)과 같은지. 다르면 까닭 글
function sameAs(doc, i, ans, note, extra) {
  const t = doc.q[i];
  const label = { YES: '예', NO: '아니요', NA: '해당 없음' }[ans];
  if (t == null) return Q[i] + ' 문항이 결재 문서에 없음';
  if (t.trim().indexOf(label + ' ') !== 0 && t.trim().indexOf('(자동 계산) ' + label + ' ') !== 0) return Q[i] + ' 답이 저장값(' + label + ')과 다르게 보임: "' + t.trim().slice(0, 40) + '"';
  if (t.indexOf('비고: ' + (note || '없음')) < 0) return Q[i] + ' 비고가 저장값("' + (note || '없음') + '")과 다르게 보임: "' + t.trim().slice(0, 120) + '"';
  if (extra && t.indexOf(extra) < 0) return Q[i] + '에 "' + extra + '"가 보이지 않음';
  return '';
}

module.exports = {
  ac: 'AC-17',
  title: '② 체크리스트 검토',
  tests: [
    {
      name: '②가 1번 답이 틀린 것을 찾아 보완 요청(보완할 항목: 체크리스트 답), 기안자가 고쳐 보완 완료하면 ②부터 다시 결재',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES_ADMIN' });
        env.C.saveDemoContract(rec(env, '2610CL015'));
        const c = env.contract('2610CL015');
        const sup = reviewPage(env, c, 'u_sadmin').confirm('SUPPLEMENT', 'S02', { picked: ['CHECKLIST'], memo: '표준계약서 제7조를 바꿨는데 1번이 예입니다.' });
        if (!sup) return '② 보완 요청이 남지 않음';
        if (JSON.stringify(sup.supplementItems) !== '["CHECKLIST"]') return '보완할 항목 코드가 남지 않음: ' + JSON.stringify(sup.supplementItems);
        if (sup.comment.indexOf('보완할 항목: 체크리스트 답') < 0) return '결재 기록 의견에 보완할 항목이 없음: ' + sup.comment;
        if (c.status !== 'SUPPLEMENT' || env.C.pendingSteps(c).length) return '보완 요청 뒤 보완 중으로 멈추지 않음: ' + c.status;
        const re = reviewPage(env, c, 'u_sales1').confirm('RESUBMIT', 'S01', { memo: '1번을 아니요로 고치고 조항 대비표를 올림', restart: true });
        if (!re || !re.restart) return '보완 완료(금액이나 답을 바꿈)가 남지 않음';
        if (c.status !== 'IN_REVIEW') return '보완 완료 뒤 상태가 검토 중이 아님: ' + c.status;
        if (stateOf(c, 'S02') !== 'PENDING' || step(c, 'S02').userId !== 'u_sadmin') return '보완 완료 뒤 ②부터 다시 차례가 아님: ' + stateOf(c, 'S02');
        return true;
      },
    },
    {
      name: '② 승인: 확인 항목 다섯을 모두 표시하면 승인되고 결재 기록에 "확인: ..."으로 남음',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES_ADMIN' });
        env.C.saveDemoContract(rec(env, '2610CL015'));
        const c = env.contract('2610CL015');
        const p = reviewPage(env, c, 'u_sadmin');
        const t = p.modalText('APPROVE', 'S02');
        if (JSON.stringify(t.checks) !== JSON.stringify(FIVE)) return '② 승인 창의 확인 항목이 다섯이 아님: ' + JSON.stringify(t.checks);
        const r = p.confirm('APPROVE', 'S02', {});
        if (!r) return '다섯을 모두 표시했는데 승인되지 않음';
        if (r.comment.indexOf('확인: ' + FIVE.join(', ')) !== 0) return '결재 기록에 확인 항목이 남지 않음: ' + r.comment;
        return stateOf(c, 'S02') === 'DONE' ? true : '② 상태가 승인이 아님: ' + stateOf(c, 'S02');
      },
    },
    {
      name: '② 확인 항목 다섯 가운데 하나라도 표시하지 않고 승인: 승인되지 않음',
      kind: 'deny',
      run(h) {
        for (const miss of FIVE) {
          const env = h.fresh({ role: 'SALES_ADMIN' });
          env.C.saveDemoContract(rec(env, '2610CL015'));
          const c = env.contract('2610CL015');
          const r = reviewPage(env, c, 'u_sadmin').confirm('APPROVE', 'S02', { uncheck: [miss] });
          if (r) return '"' + miss + '"를 빼고도 승인됨';
          if (stateOf(c, 'S02') !== 'PENDING') return '"' + miss + '"를 뺐는데 ②가 차례가 아님: ' + stateOf(c, 'S02');
        }
        return true;
      },
    },
    {
      name: '보완 요청에서 보완할 항목을 하나도 고르지 않음: 보완 요청이 남지 않음',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES_ADMIN' });
        env.C.saveDemoContract(rec(env, '2610CL015'));
        const c = env.contract('2610CL015');
        const r = reviewPage(env, c, 'u_sadmin').confirm('SUPPLEMENT', 'S02', { picked: [], memo: '1번 답 확인 필요' });
        if (r) return '보완할 항목 없이 보완 요청이 남음';
        if (c.status !== 'IN_REVIEW') return '보완할 항목 없이 상태가 바뀜: ' + c.status;
        return true;
      },
    },
    {
      // (2026-11-13 시험 다지기) 예전에는 serverOnly에만 있던 줄. 06 AC-17 "결재 문서의 금액이나 답이 저장값과 다르게 보임: 안 됨"
      //   시안의 결재 문서도 계약 기록에 저장된 값으로 그림. 가격은 AC-07, 판 번호는 AC-13이 보고, 여기서는 1번, 4번 답과 비고, 2, 3번 답과 비고,
      //   처리위탁 여부가 저장된 그 차수 값으로 보이는지 봄. (1) 계약 등록 화면(lib.js nc)으로 새로 기안한 1차.
      //   (2) 견줌으로 답이 반대인 2차: 반려된 2610CL001(1차는 1번 아니요, 4번 아니요, 처리위탁 없음)을 1번 예, 4번 예, 처리위탁 있음으로 보완 후 재기안.
      //   2차 결재 문서에 1차 값(1번 비고)이 남으면 안 됨
      name: '결재 문서의 1번, 4번 답과 비고, 2, 3번 답과 비고, 처리위탁 여부가 저장된 그 차수 값으로 보임(새 기안 1차, 보완 후 재기안 2차)',
      kind: 'deny',
      run(h) {
        // (1) 1번 아니요(비고), 2, 3번 아니요(10% 할인, 한도 0%), 4번 예(무상 기간, 비고), 처리위탁 있음
        const env = h.fresh({ role: 'SALES_ADMIN' });
        lib.fixClock(env, 10);
        const V1 = { standard: 'NO', template: 'TPL-CK', standardNote: '제7조 손해배상 한도를 바꿈(시험 1차)', accounting: 'YES', accountingNote: '무상 2개월 제공(시험 1차)',
          personalData: 'YES', priceNote: '다년 약정 할인(시험 1차)', capNote: '경쟁 입찰 대응(시험 1차)' };
        const r1 = lib.nc(env, lib.ncState({ me: env.U('u_sales1', 'SALES'), vals: V1, acctKinds: ['FREE_PERIOD'],
          files: { draft: [{ name: '계약서 초안.docx', size: 1000 }], diff: [{ name: '조항 대비표.docx', size: 1000 }], annex: [], quote: [] },
          lines: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '10,800,000' }] })).submit('2610CL905');
        if (r1.errors.length) return '1차 기안이 막힘: ' + r1.errors.join(' / ');
        const c1 = env.contract('2610CL905'), k1 = c1.checklist;
        if (k1.standard !== 'NO' || k1.price !== 'NO' || k1.cap !== 'NO' || k1.accounting !== 'YES' || c1.personalData !== true) return '시험 전제: 1차 저장값이 넣은 값과 다름: ' + JSON.stringify(k1) + ', 처리위탁 ' + c1.personalData;
        const d1 = docOf(env, '2610CL905');
        if (d1.error) return '1차 결재 문서를 열지 못함: ' + d1.error.message;
        const e1 = sameAs(d1, 0, k1.standard, k1.standardNote, '기준 표준계약서: ') || sameAs(d1, 1, k1.price, k1.priceNote) || sameAs(d1, 2, k1.cap, k1.capNote)
          || sameAs(d1, 3, k1.accounting, k1.accountingNote, '종류: 무상 기간');
        if (e1) return '1차: ' + e1;
        if (d1.basic.indexOf('개인정보 처리위탁 계약 있음') < 0 || d1.ck.indexOf('⑤ 개인정보 검토 거침') < 0) return '1차: 처리위탁 있음(저장값)이 결재 문서에 보이지 않음';
        // (2) 반려된 2610CL001을 반대 답으로 보완 후 재기안
        const env2 = h.fresh({ role: 'SALES_ADMIN' });
        lib.fixClock(env2, 10);
        const src = env2.contract('2610CL001');
        const OLD = (src && src.checklist && src.checklist.standardNote) || '';
        if (!src || src.status !== 'REJECTED' || (src.round || 1) !== 1 || src.checklist.standard !== 'NO' || !OLD || src.checklist.accounting !== 'NO' || src.personalData)
          return '시험 전제: 2610CL001이 1번 아니요(비고), 4번 아니요, 처리위탁 없음인 1차 반려 계약이 아님';
        const cu = env2.D.CUSTOMERS.filter(function (x) { return x.name === src.counterparty; })[0];
        if (!cu) return '시험 전제: 2610CL001의 거래처(' + src.counterparty + ')가 거래처 목록에 없음';
        const V2 = { customer: 'C:' + cu.id, counterparty: cu.name, bizNo: cu.bizNo, opportunity: src.form.opportunity, standard: 'YES', template: 'TPL-CK',
          accounting: 'YES', accountingNote: '해지 환불권 있음(시험 2차)', personalData: 'YES', priceNote: '할인 사유(시험 2차)', capNote: '한도 사유(시험 2차)' };
        const r2 = lib.nc(env2, lib.ncState({ me: env2.U('u_sales1', 'SALES'), source: src, vals: V2, acctKinds: ['REFUND_RIGHT'],
          lines: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '12,000,000' }] })).submit();
        if (r2.errors.length) return '2차 보완 후 재기안이 막힘: ' + r2.errors.join(' / ');
        const c2 = env2.contract('2610CL001'), k2 = c2.checklist;
        if ((c2.round || 1) !== 2 || k2.standard !== 'YES' || k2.accounting !== 'YES' || c2.personalData !== true) return '시험 전제: 2차 저장값이 넣은 값과 다름: ' + c2.round + '차 ' + JSON.stringify(k2);
        const d2 = docOf(env2, '2610CL001');
        if (d2.error) return '2차 결재 문서를 열지 못함: ' + d2.error.message;
        const e2 = sameAs(d2, 0, k2.standard, k2.standardNote) || sameAs(d2, 1, k2.price, k2.priceNote) || sameAs(d2, 2, k2.cap, k2.capNote)
          || sameAs(d2, 3, k2.accounting, k2.accountingNote, '종류: 해지 환불권');
        if (e2) return '2차: ' + e2;
        if (d2.ck.indexOf(OLD) > -1) return '2차 결재 문서에 1차의 1번 비고("' + OLD + '")가 남음';
        if (d2.basic.indexOf('개인정보 처리위탁 계약 있음') < 0) return '2차: 처리위탁 있음(2차 저장값)이 보이지 않음(1차 값 "없음"으로 보임)';
        return true;
      },
    },
    {
      name: '(CTL-50) 같은 거래처 최근 계약이 있는데(2610CL010) "나눠 맺은 계약이 아님"을 빼고 승인: 거절, 모두 표시하면 그때 건수가 남음',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES_ADMIN' });
        const c = env.contract('2610CL010');
        const p = reviewPage(env, c, 'u_sadmin');
        if (!p.recentCount) return '2610CL010에 같은 거래처 최근 계약이 없음(시험을 고칠 것)';
        const t = p.modalText('APPROVE', 'S02');
        if ((t.checks || []).indexOf(SPLIT) < 0) return '같은 거래처 최근 계약이 ' + p.recentCount + '건인데 ② 승인 창에 나눠 맺기 확인이 없음';
        if (p.confirm('APPROVE', 'S02', { uncheck: [SPLIT] })) return '나눠 맺기 확인을 빼고도 승인됨';
        if (stateOf(c, 'S02') !== 'PENDING') return '거절했는데 ② 상태가 바뀜: ' + stateOf(c, 'S02');
        const r = p.confirm('APPROVE', 'S02', {});
        if (!r) return '여섯을 모두 표시했는데 승인되지 않음';
        if (r.recentSame !== p.recentCount) return '결재 기록의 같은 거래처 최근 계약 수가 ' + r.recentSame + '(상자 ' + p.recentCount + '건)';
        return r.comment.indexOf(SPLIT) > -1 ? true : '결재 기록 의견에 나눠 맺기 확인이 없음';
      },
    },
    {
      name: '(CTL-50) 볼 수 없는 열람 제한 계약만 있어도 나눠 맺기 확인을 요구하고, 상자에는 건수만(번호, 고객사, 금액 없음)',
      kind: 'deny',
      run(h) {
        // 2610CL010과 같은 사업자등록번호의 두 계약(2609CL005, 2609CL003)을 열람 제한으로 두고 고객사 이름을 달리함.
        //   10-17부터 ② 담당을 석다인으로 바꿔, 2610CL010의 ②는 두 계약을 볼 수 없는 석다인이 맡음
        const HIDE = ['2609CL005', '2609CL003'];
        const env = h.fresh({ role: 'SALES_ADMIN', hook: D => {
          D.CONTRACTS.filter(x => HIDE.indexOf(x.id) > -1).forEach(x => {
            x.restricted = true; x.counterparty = '새솔고등학교 부설 연수원'; x.form = Object.assign({}, x.form, { bizNo: '314-83-20951' });
          });
          D.ASSIGNEE_CHANGES.push({ step: 'S02', to: 'u_dain_seok', at: '2026-10-17 00:00' });
        } });
        const c = env.contract('2610CL010');
        const me = env.U('u_dain_seok');
        if (step(c, 'S02').userId !== 'u_dain_seok') return '2610CL010의 ② 담당이 석다인이 아님(시험을 고칠 것): ' + step(c, 'S02').userId;
        const seen = HIDE.filter(id => env.C.canView(env.contract(id), me));
        if (seen.length) return '석다인이 열람 제한 계약을 볼 수 있음(시험을 고칠 것): ' + seen.join(',');
        const p = reviewPage(env, c, 'u_dain_seok');
        if (p.recent.hidden !== HIDE.length || p.recent.list.length) return '볼 수 없는 계약 수가 ' + p.recent.hidden + '건, 보이는 계약 ' + p.recent.list.length + '건';
        const t = p.modalText('APPROVE', 'S02');
        if ((t.checks || []).indexOf(SPLIT) < 0) return '볼 수 없는 계약만 있을 때 나눠 맺기 확인이 없음';
        if (p.confirm('APPROVE', 'S02', { uncheck: [SPLIT] })) return '볼 수 없는 계약만 있을 때 나눠 맺기 확인을 빼고도 승인됨';
        const html = p.recentHtml() + ' ' + (t.info || '');
        const leaks = [];
        HIDE.forEach(id => {
          const x = env.contract(id);
          if (html.indexOf(id) > -1) leaks.push(id + ' 번호');
          if (html.indexOf(x.counterparty) > -1) leaks.push(id + ' 고객사');
          if (html.indexOf(env.C.fmtWon(x.amount)) > -1) leaks.push(id + ' 금액');
        });
        if (leaks.length) return '상자나 창에 볼 수 없는 계약의 내용이 나옴: ' + leaks.join(', ');
        if (html.indexOf(HIDE.length + '건') < 0) return '상자나 창에 볼 수 없는 계약의 건수가 없음';
        return true;
      },
    },
  ],
  serverOnly: [
    '결재 문서의 금액이나 답이 저장값과 다르게 보임: 서버가 저장된 그 차수 값으로 그리고 ②가 본 판과 지문을 결재 기록에 남김. 시안은 브라우저의 계약 기록으로 그림(기안 때 남긴 가격은 AC-07, 판 번호는 AC-13, 1번에서 4번 답과 비고와 처리위탁 여부는 위 시험에서 봄. 지난 차수 값을 따로 남기는 것과 판의 지문은 서버 몫)',
    '② 승인 요청을 확인 항목 없이 직접 보냄: 시안 recordAction은 의견의 "확인: ..."을 검사하지 않음(창의 confirmAction만 막음). 서버가 확인 항목 다섯이 모두 있어야 받음(CTL-49)',
    '보완 요청을 보완할 항목 없이 직접 보냄: 시안 recordAction은 supplementItems를 검사하지 않음. 서버가 하나 이상 있어야 받음(CTL-51)',
    '같은 거래처 최근 계약 수: 서버가 열람 제한까지 넣어 다시 세고, 0보다 크면 나눠 맺기 확인 없이 직접 보낸 ② 승인을 거절하며 그 수를 recent_same_count에 남김(시안은 화면에서 센 recentSame을 그대로 남김)',
    '보완 완료로 1번 답이 아니요로 바뀌면 ④가 새로 "거침"이 되는 것: 실제 시스템에서 봄(시안은 보완 중 답을 고칠 수 없음, REQ-REV-11 [가정], 06 되는 경우 시험의 단서)',
  ],
};
