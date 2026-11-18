// AC-53 변경 종류(추가, 줄임, 조항만) (CTL-141, 06 통제 목록 2장) 시험 (2026-11-13 주말 점검 W2)
//   기대 동작: 계약종류가 변경이면 변경 종류가 필수다. 줄임은 변경 금액이 0보다 작고 기능마다 지금 유효한 조건의 수량 이하만,
//     조항만은 제품 줄 0개와 0원만 받는다. 줄임과 조항만은 2, 3번이 NA이고 ③과 ③ 영업 임원 승인이 없으며 견적서로 계약서를 대신하지 못한다.
//     변경 계약의 종료일은 지금 종료일보다 늦을 수 없다.
//   시안 코드: common.js amendKindOf, priceCheckOff, reviewRoute, currentTerms, amendDiff. new-contract.js 기안 검사(validate)는
//     lib.js의 nc(계약 등록 화면 함수를 그대로 꺼내 씀)로 봄
//   (2026-11-14 주말 점검, 코드 다시 보기 2차) amend-01 시험에 계약 상세(contract.js)와 만료 예정(expiring.js)의 연장 단추를 더하고,
//     common-03 거울 차례 시험(formRecord의 renewBase, renewTermsOf의 kept, review.js renewChangedHtml)을 더함
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const lib = require('./lib');
const { fixClock } = lib;
const JS = path.join(__dirname, '..', '..', 'prototype', 'assets', 'js');
// (2026-11-14 주말 점검, 코드 다시 보기 amend-01, amend-02) 계약 상세의 할 일 단추 줄(html)과 만료 예정(90일 보기) 그 묶음 줄의 링크(AC-34 detailActions, expiringLinks와 같은 방식)
//   계약 상세는 obligation-ui.js를 먼저 부르므로 같은 차례로 먼저 올림
function detailActionsHtml(h, id, hook) {
  const env = h.fresh({ role: 'SUPER', hook });
  vm.runInContext(fs.readFileSync(path.join(JS, 'obligation-ui.js'), 'utf8'), env.ctx, { filename: 'obligation-ui.js' });
  const dom = lib.page(env, 'contract.js', '?id=' + id, { user: env.U('u_super') });
  if (dom.error) return { why: '계약 상세를 열지 못함: ' + dom.error.message };
  return { html: String(dom.q('#bundle-actions').innerHTML) };
}
function expiringRowLinks(h, id, hook) {
  const env = h.fresh({ role: 'SUPER', hook });
  const dom = lib.page(env, 'expiring.js', '', { user: env.U('u_super'), preset: [['#f-days', { value: '90' }]] });
  if (dom.error) return { why: '만료 예정을 열지 못함: ' + dom.error.message };
  const row = String(dom.q('#rows').innerHTML).split('</tr>').filter(r => r.indexOf('contract.html?id=' + id + '"') > -1)[0];
  if (!row) return { why: '시험 전제: 만료 예정 90일 보기에 ' + id + '가 없음' };
  return { links: (row.match(/href="[^"]+"/g) || []).join(' ') };
}

// 한누리대학교(C-0029) 2609CL007의 변경 기안. 지금 유효한 조건: 표절검사 2개(16,250,000원), 추가 이용자 10개, 종료일 2027-09-30
//   (2026-11-14 주말 점검 W7) over.hook: 데이터를 불러온 직후 고칠 것(harness fresh의 hook)
function amend(h, amendKind, over) {
  over = over || {};
  const env = h.fresh({ role: 'SALES', hook: over.hook });
  fixClock(env);
  const vals = Object.assign({ kind: 'AMEND', amendKind: amendKind, customer: 'C:C-0029', counterparty: '한누리대학교', bizNo: '134-82-61500',
    opportunity: '2610CK901', startDate: '2026-11-01', endDate: '2027-09-30', standard: 'NO', standardNote: '변경 계약서(시험)', template: 'TPL-CK' }, over.vals || {});
  const st = lib.ncState(Object.assign({ me: env.U('u_taeyun_kim'), origin: '2609CL007',
    files: { draft: [{ name: '변경 계약서.docx', size: 1000 }], diff: [{ name: '조항 대비표.docx', size: 1000 }], annex: [], quote: [{ name: '최종 견적서.pdf', size: 1000 }] } }, over, { vals: vals }));
  return { env, p: lib.nc(env, st) };
}
const has = (errs, part) => errs.some(m => String(m).indexOf(part) > -1);
// (2026-11-14 주말 점검 W7, icfr-05) 계약 등록 화면(new-contract.js)을 가짜 문서에 올려 변경 기안 단추를 누른 뒤 오류 요약 글(AC-34 newContractErrors와 같은 방식)
//   2512CL001(온새미로대학교, 영업대표 이도윤)에는 진행 중인 그대로 연장 2512CL001-R01이 있음
function amendPageErrors(h, origin, who, ak) {
  const env = h.fresh({ role: 'SALES' });
  const dom = lib.page(env, 'new-contract.js', '?kind=AMEND&origin=' + origin, { user: env.U(who), preset: [
    ['[name="kind"]:checked', { type: 'radio', name: 'kind', value: 'AMEND', checked: true }],
    ['[name="amendKind"]:checked', { type: 'radio', name: 'amendKind', value: ak, checked: true }]] });
  if (dom.error) return { why: '계약 등록 화면을 열지 못함: ' + dom.error.message };
  dom.q('#f-origin').value = origin;
  const n = env.D.CONTRACTS.length;
  dom.fire('#contract-form', 'submit');
  return { env, text: dom.errors().replace(/<[^>]+>/g, ' '), saved: env.D.CONTRACTS.length !== n, open: dom.q('#confirm-modal').hidden === false };
}
const AMOUNT_OVER = '줄어드는 금액이 그보다 클 수 없습니다';
// (2026-11-14 주말 점검, 코드 다시 보기 amend-01) 2512CL001(온새미로대학교, 영업대표 이도윤, 종료일 2027-01-09)의 조항만 변경. 진행 중인 그대로 연장 2512CL001-R01(2027-01-10~2028-01-09)이 있음
function amend2512(h, endDate, hook) {
  const env = h.fresh({ role: 'SALES', hook });
  fixClock(env);
  const cu = env.C.customerOfContract(env.contract('2512CL001')) || {};
  const vals = { kind: 'AMEND', amendKind: 'TERMS', customer: 'C:' + (cu.id || ''), counterparty: '온새미로대학교', bizNo: cu.bizNo || '', opportunity: '2610CK902',
    startDate: '2026-11-20', endDate: endDate, standard: 'NO', standardNote: '조항 변경(시험)', template: 'TPL-CK', autoRenew: 'YES', noticeDays: '30' };
  const st = lib.ncState({ me: env.U('u_sales1'), origin: '2512CL001', lines: [],
    files: { draft: [{ name: '변경 계약서.docx', size: 1000 }], diff: [{ name: '조항 대비표.docx', size: 1000 }], annex: [], quote: [] }, vals });
  return { env, p: lib.nc(env, st) };
}
// (2026-11-14 주말 점검, 코드 다시 보기 amend-02, amend-03) 2609CL007에 진행 중인 기록을 더하는 hook
const PERIOD_C09 = D => D.CONTRACTS.push({
  id: '2609CL007-C09', parentId: '2609CL007', counterparty: '한누리대학교', services: ['CK'], type: 'SaaS 이용계약', kind: 'CHANGE',
  changeType: 'PERIOD', oldEndDate: '2027-09-30', endDate: '2027-11-30', amount: 0, requesterId: 'u_taeyun_kim', requestedAt: '2026-10-18 10:00',
  restricted: false, personalData: false, status: 'OPS_REVIEW', reason: '시험: 기간 2개월 늘림', activityUrl: 'https://panda.muhayu.com/activity/A-1',
});
const REDUCE_A02 = D => D.CONTRACTS.push({
  id: '2609CL007-A02', parentId: '2609CL007', counterparty: '한누리대학교', services: ['CK'], type: 'SaaS 이용계약', kind: 'AMEND', amendKind: 'REDUCE',
  amount: -16250000, products: [{ feature: 'CK_CAMPUS_PLAG', qty: -2, amount: -16250000 }],
  requesterId: 'u_taeyun_kim', requestedAt: '2026-10-18 10:00', restricted: false, personalData: false, status: 'IN_REVIEW',
  startDate: '2026-11-01', endDate: '2027-09-30', checklist: { standard: 'NO', price: 'NA', cap: 'NA' },
});
const GPTK = { service: 'CK', product: 'CK_CAMPUS', feature: 'CK_CAMPUS_GPTK', qty: 1, amount: '2,400,000' };

module.exports = {
  ac: 'AC-53',
  title: '변경 종류(추가, 줄임, 조항만)',
  tests: [
    {
      name: '2609CL007-A01(한누리대학교, 줄임): 표절검사 -1개, -7,150,000원(7,800,000원 x 11 / 12), 2, 3번 해당 없음, ③ 없이 ②, ④를 거쳐 계약 완료',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const { C } = env;
        const c = env.contract('2609CL007-A01');
        if (C.amendKindOf(c) !== 'REDUCE') return '변경 종류가 줄임이 아님: ' + C.amendKindOf(c);
        const l = c.products[0];
        if (l.feature !== 'CK_CAMPUS_PLAG' || l.qty !== -1 || l.amount !== -7150000) return '줄이 표절검사 -1개, -7,150,000원이 아님: ' + JSON.stringify(l);
        if (Math.round(7800000 * 11 / 12) !== 7150000) return '셈 확인 실패';
        if (c.checklist.price !== 'NA' || c.checklist.cap !== 'NA') return '2, 3번이 해당 없음이 아님';
        if (!C.priceCheckOff(c)) return '가격 확인 해당 없음으로 보지 않음';
        const st = s => (c.approvals.find(a => a.step === s) || {}).state;
        if (st('S03') !== 'SKIPPED') return '③이 생략되지 않음: ' + st('S03');
        if (c.approvals.some(a => a.step === 'S03C' && a.state !== 'SKIPPED')) return '③ 영업 임원 승인이 있음';
        if (st('S02') !== 'DONE' || st('S04') !== 'DONE') return '②, ④를 거치지 않음';
        if (c.status !== 'ACTIVE') return '계약 완료가 아님: ' + c.status;
        return true;
      },
    },
    {
      name: '결재 문서의 "변경 전과 후"에 변경 전, 바뀌는 만큼, 변경 뒤가 보이고 계약 상세의 지금 유효한 조건에 줄어든 수량과 금액이 보임(2609CL007-A01)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const { C } = env;
        const d = C.amendDiff(env.contract('2609CL007-A01'));
        if (!d) return '변경 전과 후를 셈하지 못함';
        const r = d.rows.find(x => x.feature === 'CK_CAMPUS_PLAG');
        if (!r || !r.before || !r.change || !r.after) return '표절검사 줄에 변경 전, 바뀌는 만큼, 변경 뒤가 다 없음';
        if (r.before.qty !== 3 || r.change.qty !== -1 || r.after.qty !== 2) return '수량이 3 → -1 → 2가 아님: ' + JSON.stringify(r);
        if (r.before.amount !== 23400000 || r.change.amount !== -7150000 || r.after.amount !== 16250000) return '금액이 다름: ' + JSON.stringify(r);
        if (d.change !== -7150000 || d.afterAmount !== d.beforeAmount - 7150000) return '합계 금액의 변경 전과 후가 다름';
        const t = C.currentTerms('2609CL007');
        const l = t.lines.find(x => x.feature === 'CK_CAMPUS_PLAG');
        if (!l || l.qty !== 2 || l.amount !== 16250000) return '지금 유효한 조건의 표절검사가 2개, 16,250,000원이 아님: ' + JSON.stringify(l && { qty: l.qty, amount: l.amount });
        if (t.amount !== 36000000 - 7150000) return '지금 유효한 조건의 금액이 ' + t.amount + '원';
        return true;
      },
    },
    {
      name: '조항만 변경은 제품 줄 없이 0원으로 기안되고 2, 3번이 해당 없음, ③이 없음',
      kind: 'ok',
      run(h) {
        const { env, p } = amend(h, 'TERMS', { lines: [] });
        const r = p.submit('2609CL007-A90');
        if (r.errors.length) return '조항만 변경이 기안되지 않음: ' + r.errors.join(' / ');
        const c = env.contract('2609CL007-A90');
        if ((c.products || []).length !== 0 || c.amount !== 0) return '조항만 변경에 제품 줄이나 금액이 남음: ' + (c.products || []).length + '줄, ' + c.amount + '원';
        if (c.checklist.price !== 'NA' || c.checklist.cap !== 'NA') return '2, 3번이 해당 없음이 아님: ' + c.checklist.price + ', ' + c.checklist.cap;
        if (env.C.reviewRoute(c).S03[0] || env.C.reviewRoute(c).S03C[0]) return '조항만 변경에 ③이 있음';
        return true;
      },
    },
    {
      name: '줄임인데 합계가 0이거나 0보다 크면 기안되지 않음',
      kind: 'deny',
      run(h) {
        for (const amt of ['0', '-7,150,000']) {
          const { env, p } = amend(h, 'REDUCE', { lines: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: amt }] });
          const r = p.submit('2609CL007-A91');
          if (r.rec || env.contract('2609CL007-A91')) return '줄임 금액 ' + amt + '으로 기안됨(합계 ' + p.total() + '원)';
        }
        // 견줌: 줄어드는 금액을 넣으면 기안됨
        const { p } = amend(h, 'REDUCE', { lines: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '7,150,000' }] });
        const ok = p.submit('2609CL007-A92');
        if (ok.errors.length) return '견줌: 맞는 줄임도 막힘: ' + ok.errors.join(' / ');
        if (ok.rec.amount !== -7150000) return '견줌: 줄임 금액이 ' + ok.rec.amount + '원으로 저장됨';
        // 새로 기안한 줄임도 2, 3번 해당 없음, ③과 ③ 영업 임원 승인 없음
        if (ok.rec.checklist.price !== 'NA' || ok.rec.checklist.cap !== 'NA') return '새 줄임 기안의 2, 3번이 해당 없음이 아님: ' + ok.rec.checklist.price + ', ' + ok.rec.checklist.cap;
        const rr = h.fresh({ role: 'SALES' }).C.reviewRoute(ok.rec);
        if (rr.S03[0] || rr.S03C[0]) return '새 줄임 기안에 ③이나 ③ 영업 임원 승인이 있음';
        return true;
      },
    },
    {
      name: '지금 수량보다 많이 줄이거나(표절검사 지금 2개에 3개) 지금 조건에 없는 기능(GPT Killer)을 줄이면 기안되지 않음',
      kind: 'deny',
      run(h) {
        let x = amend(h, 'REDUCE', { lines: [{ feature: 'CK_CAMPUS_PLAG', qty: 3, amount: '21,450,000' }] });
        let r = x.p.submit('2609CL007-A93');
        if (r.rec) return '지금 2개인 표절검사를 3개 줄이는 기안이 됨';
        if (!has(r.errors, '그보다 많이 줄일 수 없습니다')) return '많이 줄였다는 오류가 없음: ' + r.errors.join(' / ');
        x = amend(h, 'REDUCE', { lines: [{ feature: 'CK_CAMPUS_GPTK', qty: 1, amount: '2,200,000' }] });
        r = x.p.submit('2609CL007-A94');
        if (r.rec) return '지금 조건에 없는 기능을 줄이는 기안이 됨';
        if (!has(r.errors, '지금 유효한 조건에 없어 줄일 수 없습니다')) return '조건에 없다는 오류가 없음: ' + r.errors.join(' / ');
        return true;
      },
    },
    {
      name: '조항만인데 제품 줄과 금액을 넣어도 기록에 들어가지 않음(제품 줄 0개, 0원만)',
      kind: 'deny',
      run(h) {
        const { env, p } = amend(h, 'TERMS', { lines: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '12,000,000' }] });
        const r = p.submit('2609CL007-A95');
        const c = env.contract('2609CL007-A95');
        if (c && ((c.products || []).length || c.amount)) return '조항만 변경에 제품 줄이나 금액이 들어감: ' + (c.products || []).length + '줄, ' + c.amount + '원';
        if (!c && !r.errors.length) return '기안 결과를 알 수 없음';
        return true;
      },
    },
    {
      name: '금액이 늘어나는 변경을 줄임으로 보내 ③을 피하지 못함(줄임에서 금액은 늘 빼기로만 남고, 늘리는 값을 넣으면 막힘)',
      kind: 'deny',
      run(h) {
        // 수량과 금액을 빼기로 적어 늘리려 함(줄임 화면은 넣은 값을 빼기로 바꾸므로 빼기를 넣으면 늘어남)
        const { env, p } = amend(h, 'REDUCE', { lines: [{ feature: 'CK_CAMPUS_PLAG', qty: '-2', amount: '-24,000,000' }] });
        const r = p.submit('2609CL007-A96');
        if (r.rec || env.contract('2609CL007-A96')) return '줄임으로 금액이 늘어나는 기안이 됨(합계 ' + p.total() + '원)';
        return true;
      },
    },
    {
      name: '줄임이나 조항만으로 견적서로 계약서를 대신하면 기안되지 않음',
      kind: 'deny',
      run(h) {
        for (const k of ['REDUCE', 'TERMS']) {
          const { env, p } = amend(h, k, { quoteInstead: true, lines: k === 'REDUCE' ? [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '7,150,000' }] : [] });
          const r = p.submit('2609CL007-A97');
          if (r.rec || env.contract('2609CL007-A97')) return (k === 'REDUCE' ? '줄임' : '조항만') + '으로 견적서 대신 기안이 됨';
          if (!has(r.errors, '견적서로 계약서를 대신하려면')) return (k === 'REDUCE' ? '줄임' : '조항만') + ': 견적서로 대신할 수 없다는 오류가 없음: ' + r.errors.join(' / ');
        }
        return true;
      },
    },
    {
      name: '변경 종료일이 지금 종료일(2027-09-30)보다 늦으면 기안되지 않음(연장으로)',
      kind: 'deny',
      run(h) {
        const { env, p } = amend(h, 'ADD', { vals: { endDate: '2027-12-31' }, lines: [{ feature: 'CK_CAMPUS_USER', qty: 1, amount: '1,500,000' }] });
        const r = p.submit('2609CL007-A98');
        if (r.rec || env.contract('2609CL007-A98')) return '지금 종료일보다 늦은 변경이 기안됨';
        if (!has(r.errors, '지금 계약 종료일(2027-09-30)보다 늦을 수 없습니다')) return '종료일 오류가 없음: ' + r.errors.join(' / ');
        return true;
      },
    },
    {
      name: '변경 종류를 빼고 기안하면 기안되지 않음',
      kind: 'deny',
      run(h) {
        const { env, p } = amend(h, '', { lines: [{ feature: 'CK_CAMPUS_USER', qty: 1, amount: '1,375,000' }] });
        const r = p.submit('2609CL007-A99');
        if (r.rec || env.contract('2609CL007-A99')) return '변경 종류 없이 기안됨';
        if (!has(r.errors, '변경 종류를 고르세요')) return '변경 종류 오류가 없음: ' + r.errors.join(' / ');
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검 W7, icfr-03, ai-ops-01) CTL-141 위험 "지금 가진 것보다 많이 줄여 계약 금액이 틀린다"의 금액 쪽
      name: '줄어드는 금액이 그 기능의 지금 금액보다 크면 기안되지 않음(표절검사 지금 2개 16,250,000원에서 1개를 줄이며 40,000,000원, 16,250,001원)',
      kind: 'deny',
      run(h) {
        const t = h.fresh({ role: 'SALES' }).C.currentTerms('2609CL007');
        const l = t.lines.find(x => x.feature === 'CK_CAMPUS_PLAG');
        if (!l || l.qty !== 2 || l.amount !== 16250000 || t.core !== 28850000) return '시험 전제: 2609CL007의 표절검사가 2개 16,250,000원, 지금 금액 28,850,000원이 아님';
        for (const [amt, no] of [['40,000,000', 'A81'], ['16,250,001', 'A82']]) {
          const { env, p } = amend(h, 'REDUCE', { lines: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: amt }] });
          const r = p.submit('2609CL007-' + no);
          if (r.rec || env.contract('2609CL007-' + no)) return '표절검사 1개를 줄이며 ' + amt + '원을 빼는 줄임이 기안됨';
          if (!has(r.errors, '지금 금액이 16,250,000원이라 ' + AMOUNT_OVER)) return amt + '원: 지금 금액보다 많이 줄였다는 오류가 없음: ' + r.errors.join(' / ');
        }
        // 견줌: 지금 금액과 같게(16,250,000원) 줄이면 금액 상한에는 걸리지 않음(변경 뒤 0원). 수량 몫보다 더 깎는지는 기획자 결정 W7-3으로 남아 여기서 막지 않음
        const { p } = amend(h, 'REDUCE', { lines: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '16,250,000' }] });
        const ok = p.submit('2609CL007-A83');
        if (ok.errors.length) return '견줌: 지금 금액과 같은 줄임도 막힘: ' + ok.errors.join(' / ');
        // 같은 기능을 두 줄로 나눠도 함께 셈(1개 10,000,000원 + 1개 10,000,000원 = 2개 20,000,000원 > 16,250,000원. 수량 2개는 지금 수량 안)
        const two = amend(h, 'REDUCE', { lines: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '10,000,000' }, { feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '10,000,000' }] });
        const r2 = two.p.submit('2609CL007-A84');
        if (r2.rec) return '같은 기능을 두 줄로 나눠 지금 금액보다 많이 줄이는 기안이 됨';
        if (!has(r2.errors, AMOUNT_OVER)) return '두 줄로 나눈 줄임에 금액 오류가 없음: ' + r2.errors.join(' / ');
        if (has(r2.errors, '그보다 많이 줄일 수 없습니다')) return '시험 전제: 두 줄의 수량(2개)이 지금 수량 안인데 수량 오류가 남';
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검 W7, icfr-03, ai-ops-01) 원계약에 제품 줄이 없어 기능마다 셀 수 없어도 계약 전체는 0원 아래로 내려가지 않음
      name: '원계약에 제품 줄이 없어도 줄어드는 금액의 합계가 지금 계약 금액(28,850,000원)보다 크면 기안되지 않음(2609CL007 원계약의 제품 줄을 빼 봄)',
      kind: 'deny',
      run(h) {
        const hook = D => { const c = D.CONTRACTS.find(x => x.id === '2609CL007'); c.products = []; if (c.form) c.form.products = []; };
        const t = h.fresh({ role: 'SALES', hook }).C.currentTerms('2609CL007');
        if (!t.ready || !t.noLines || t.core !== 28850000) return '시험 전제: 제품 줄이 없는 원계약으로 셈되지 않음(noLines ' + t.noLines + ', 지금 금액 ' + t.core + ')';
        const { env, p } = amend(h, 'REDUCE', { hook, lines: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '30,000,000' }] });
        const r = p.submit('2609CL007-A85');
        if (r.rec || env.contract('2609CL007-A85')) return '지금 계약 금액보다 많이 줄이는 기안이 됨(변경 뒤 계약 금액이 음수)';
        if (!has(r.errors, '지금 계약 금액(28,850,000원)보다 큽니다')) return '계약 전체 금액 상한 오류가 없음: ' + r.errors.join(' / ');
        // 견줌: 지금 계약 금액 안이면 됨
        const ok = amend(h, 'REDUCE', { hook, lines: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '7,150,000' }] }).p.submit('2609CL007-A86');
        if (ok.errors.length) return '견줌: 지금 계약 금액 안의 줄임도 막힘: ' + ok.errors.join(' / ');
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검 W7, icfr-05) 연장(그대로, 조건을 바꿔)이 진행 중일 때 추가, 줄임이 먼저 끝나면 연장의 새 바탕에서 빠지거나 덮임
      name: '그대로 연장(2512CL001-R01)이 진행 중이면 추가, 줄임 변경은 기안되지 않고 조항만 변경은 막지 않음',
      kind: 'deny',
      run(h) {
        const env0 = h.fresh({ role: 'SALES' });
        const r01 = env0.contract('2512CL001-R01');
        if (!r01 || r01.kind !== 'RENEW' || !env0.C.bundleOf('2512CL001').open.some(o => o.id === r01.id)) return '시험 전제: 2512CL001-R01이 진행 중인 연장이 아님';
        if (env0.C.repActorOf(env0.C.bundleOf('2512CL001')) !== 'u_sales1') return '시험 전제: 2512CL001의 영업대표가 이도윤이 아님';
        const BUSY = '진행 중인 연장이 끝난 뒤에 기안하세요';
        for (const ak of ['ADD', 'REDUCE']) {
          const x = amendPageErrors(h, '2512CL001', 'u_sales1', ak);
          if (x.why) return x.why;
          if (x.saved || x.open) return (ak === 'ADD' ? '추가' : '줄임') + ' 변경이 연장 진행 중에 확인 창이 열리거나 저장됨';
          if (x.text.indexOf(BUSY) < 0) return (ak === 'ADD' ? '추가' : '줄임') + ' 변경에 진행 중인 연장 오류가 없음: ' + x.text.slice(0, 160);
        }
        const t = amendPageErrors(h, '2512CL001', 'u_sales1', 'TERMS');
        if (t.why) return t.why;
        if (t.text.indexOf(BUSY) > -1) return '조항만 변경이 진행 중인 연장 때문에 막힘';
        // 견줌: 진행 중인 연장이 없는 2609CL007의 추가 변경에는 그 오류가 없음
        const c = amendPageErrors(h, '2609CL007', 'u_taeyun_kim', 'ADD');
        if (c.why) return c.why;
        if (c.text.indexOf(BUSY) > -1) return '견줌: 진행 중인 연장이 없는데 그 오류가 남';
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검, 코드 다시 보기 amend-01) 찾은 사람의 재현: 예전에는 둘 다 계약 완료되면 묶음 종료일이 2027-01-09, 기간이 "2027-01-10 ~ 2027-01-09"가 되었음
      name: '(amend-01) 그대로 연장(2512CL001-R01)이 진행 중일 때 조항만 변경을 지금 종료일(2027-01-09)로 기안하면 기안 때 종료일이 남고, 둘 다 계약 완료되어도 묶음 종료일은 연장 종료일 2028-01-09',
      kind: 'ok',
      run(h) {
        const { env, p } = amend2512(h, '2027-01-09');
        const { C } = env;
        if (C.currentTerms('2512CL001').end !== '2027-01-09') return '시험 전제: 2512CL001의 지금 종료일이 2027-01-09가 아님';
        const r = p.submit('2512CL001-A02');
        if (r.errors.length) return '연장 진행 중 조항만 변경(종료일 그대로)이 기안되지 않음: ' + r.errors.join(' / ');
        if (r.rec.oldEndDate !== '2027-01-09') return '변경 기록에 기안 때 지금 종료일(oldEndDate)이 남지 않음: ' + r.rec.oldEndDate;
        const a = env.contract('2512CL001-A02'), r01 = env.contract('2512CL001-R01');
        a.status = 'ACTIVE'; a.completedAt = '2026-11-20 10:00';
        r01.status = 'ACTIVE'; r01.completedAt = '2026-11-21 10:00';
        const b = C.bundleOf('2512CL001'), t = C.currentTerms('2512CL001');
        if (b.current.id !== '2512CL001-R01') return '시험 확인: 지금 유효한 계약이 R01이 아님';
        if (b.end !== '2028-01-09') return '묶음 종료일이 연장 종료일(2028-01-09)이 아님: ' + b.end;
        if (t.start !== '2027-01-10' || t.end !== '2028-01-09' || t.endFrom.id !== '2512CL001-R01') return '지금 유효한 조건의 기간이 2027-01-10~2028-01-09(R01)가 아님: ' + t.start + '~' + t.end + ' ' + t.endFrom.id;
        // 견줌: 기안 때 종료일이 없는 예전 기록은 예전 규칙(그때 종료일보다 앞이면 그 날로 줄임)
        delete a.oldEndDate;
        if (C.bundleOf('2512CL001').end !== '2027-01-09') return '견줌: 예전 기록(oldEndDate 없음)의 규칙이 바뀜: ' + C.bundleOf('2512CL001').end;
        return true;
      },
    },
    {
      name: '(amend-01) 연장(2512CL001-R01)이 진행 중이면 변경 계약으로 기간을 줄이지 못함(조항만 변경 종료일 2026-12-31)',
      kind: 'deny',
      run(h) {
        const { env, p } = amend2512(h, '2026-12-31');
        const r = p.submit('2512CL001-A02');
        if (r.rec || env.contract('2512CL001-A02')) return '연장 진행 중에 기간을 줄이는 변경이 기안됨';
        if (!has(r.errors, '2512CL001-R01: 진행 중인') || !has(r.errors, '변경 계약으로 계약 기간을 줄일 수 없습니다')) return '진행 중인 연장 때문에 기간을 줄일 수 없다는 오류가 없음: ' + r.errors.join(' / ');
        // 견줌: 연장이 없으면(R01을 뺀 데이터) 같은 줄임 종료일로 기안됨
        const ok = amend2512(h, '2026-12-31', D => { D.CONTRACTS.splice(D.CONTRACTS.findIndex(x => x.id === '2512CL001-R01'), 1); });
        if (ok.env.C.bundleOf('2512CL001').open.some(o => o.kind === 'RENEW')) return '시험 확인: R01을 빼도 진행 중인 연장이 남음';
        const r2 = ok.p.submit('2512CL001-A02');
        if (r2.errors.length) return '견줌: 진행 중인 연장이 없는데 기간을 줄이는 변경이 막힘: ' + r2.errors.join(' / ');
        if (r2.rec.oldEndDate !== '2027-01-09' || r2.rec.endDate !== '2026-12-31') return '견줌: 기간을 줄인 변경의 기록이 맞지 않음';
        r2.rec.status = 'ACTIVE';
        if (ok.env.C.bundleOf('2512CL001').end !== '2026-12-31') return '견줌: 기간을 줄인 변경이 계약 완료되어도 묶음 종료일이 줄지 않음: ' + ok.env.C.bundleOf('2512CL001').end;
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검, 코드 다시 보기 amend-02) 찾은 사람의 재현: 예전에는 둘 다 끝나면 묶음 종료일이 2027-09-30으로 돌아가 운영 변경으로 늘린 2개월이 사라졌음
      name: '(amend-02) 기간 변경(2609CL007-C09, 2027-09-30 → 2027-11-30)이 진행 중일 때 추가 변경을 지금 종료일로 기안하고 둘 다 계약 완료되면 묶음 종료일은 2027-11-30',
      kind: 'ok',
      run(h) {
        const { env, p } = amend(h, 'ADD', { hook: PERIOD_C09, lines: [GPTK], vals: { priceNote: '시험 사유', capNote: '시험 사유' } });
        const { C } = env;
        if (!C.bundleOf('2609CL007').open.some(o => o.id === '2609CL007-C09')) return '시험 전제: C09가 진행 중이 아님';
        const r = p.submit('2609CL007-A05');
        if (r.errors.length) return '기간 변경 진행 중 추가 변경(종료일 그대로)이 기안되지 않음: ' + r.errors.join(' / ');
        if (r.rec.oldEndDate !== '2027-09-30') return '기안 때 지금 종료일이 남지 않음: ' + r.rec.oldEndDate;
        env.contract('2609CL007-C09').status = 'ACTIVE';
        env.contract('2609CL007-A05').status = 'ACTIVE';
        const b = C.bundleOf('2609CL007'), t = C.currentTerms('2609CL007');
        if (b.end !== '2027-11-30' || t.end !== '2027-11-30') return '운영 변경으로 늘린 종료일(2027-11-30)이 사라짐: 묶음 ' + b.end + ', 조건 ' + t.end;
        if (t.endFrom.id !== '2609CL007-C09') return '종료일을 바꾼 기록이 C09가 아님: ' + t.endFrom.id;
        return true;
      },
    },
    {
      name: '(amend-02) 기간 변경(2609CL007-C09)이 진행 중이면 변경 계약으로 기간을 줄이지 못함(종료일 2027-06-30)',
      kind: 'deny',
      run(h) {
        const { env, p } = amend(h, 'ADD', { hook: PERIOD_C09, lines: [GPTK], vals: { endDate: '2027-06-30', priceNote: '시험 사유', capNote: '시험 사유' } });
        const r = p.submit('2609CL007-A05');
        if (r.rec || env.contract('2609CL007-A05')) return '기간 변경 진행 중에 기간을 줄이는 변경이 기안됨';
        if (!has(r.errors, '2609CL007-C09: 진행 중인') || !has(r.errors, '변경 계약으로 계약 기간을 줄일 수 없습니다')) return '진행 중인 기간 변경 오류가 없음: ' + r.errors.join(' / ');
        // 기간을 줄이는 다른 변경이 진행 중이어도 같음(조항만 A09, 종료일 2027-06-30 → 둘째 변경 2027-03-31)
        const A09 = D => D.CONTRACTS.push({ id: '2609CL007-A09', parentId: '2609CL007', counterparty: '한누리대학교', services: ['CK'], type: 'SaaS 이용계약', kind: 'AMEND', amendKind: 'TERMS',
          amount: 0, products: [], requesterId: 'u_taeyun_kim', requestedAt: '2026-10-18 10:00', restricted: false, personalData: false, status: 'IN_REVIEW',
          startDate: '2026-11-01', endDate: '2027-06-30', oldEndDate: '2027-09-30', checklist: { standard: 'NO', price: 'NA', cap: 'NA' } });
        const x = amend(h, 'TERMS', { hook: A09, lines: [], vals: { endDate: '2027-03-31' } });
        const r2 = x.p.submit('2609CL007-A10');
        if (r2.rec) return '기간을 줄이는 변경(A09)이 진행 중인데 또 기간을 줄이는 변경이 기안됨';
        if (!has(r2.errors, '2609CL007-A09: 진행 중인')) return 'A09 때문에 막혔다는 오류가 없음: ' + r2.errors.join(' / ');
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검, 코드 다시 보기 amend-01, amend-02) 반대 차례: 기간을 줄이는 변경(조항만)이 진행 중일 때 연장이 먼저 기안되면, 변경이 늦게 끝나 원계약 기간이 줄고
      //   연장 시작일(옛 종료일 다음 날)과 사이가 빔. 연장 검토(renewal.js)와 계약 등록의 연장(originBlock) 모두 막음. 기간을 바꾸지 않는 조항만은 막지 않음(AC-34)
      //   (2026-11-14 주말 점검, 코드 다시 보기 amend-01, amend-02 2차) 계약 상세와 만료 예정의 연장 단추도 감춤(예전에는 단추가 보이는데 누르면 연장 검토가 막혔음),
      //     연장 검토의 안내 글 머리에 "계약 기간을 줄이는 변경"
      name: '(amend-01) 기간을 줄이는 조항만 변경(2601CL001-A09, 2026-12-31 → 2026-11-30)이 진행 중이면 연장 검토와 계약 등록의 연장을 기안할 수 없고, 계약 상세와 만료 예정에 연장 단추가 없음',
      kind: 'deny',
      run(h) {
        const mk = end => D => {
          const i = D.CONTRACTS.findIndex(c => c.id === '2601CL001-A01'); if (i > -1) D.CONTRACTS.splice(i, 1); // 금액이 바뀌는 변경(A01) 때문에 막히지 않게 뺌
          D.CONTRACTS.push({ id: '2601CL001-A09', parentId: '2601CL001', counterparty: '누리교육재단', services: ['CK'], type: 'SaaS 이용계약', kind: 'AMEND', amendKind: 'TERMS',
            amount: 0, products: [], requesterId: 'u_sales2', requestedAt: '2026-10-18 10:00', restricted: false, personalData: false, status: 'IN_REVIEW',
            startDate: '2026-11-01', endDate: end, oldEndDate: '2026-12-31', checklist: { standard: 'NO', price: 'NA', cap: 'NA' } });
        };
        const renewNotice = end => {
          const env = h.fresh({ role: 'SUPER', hook: mk(end) });
          const dom = lib.page(env, 'renewal.js', '?origin=2601CL001', { user: env.U('u_super'), preset: [['input[name="choice"]:checked', { type: 'radio', name: 'choice', value: 'KEEP', checked: true }]] });
          if (dom.error) return { why: '연장 검토 화면을 열지 못함: ' + dom.error.message };
          return { env, closed: dom.q('#form').hidden !== false, note: String(dom.q('#notice').innerHTML).replace(/<[^>]+>/g, ' ') };
        };
        const blockOf = end => {
          const env = h.fresh({ role: 'SALES', hook: mk(end) });
          const body = lib.fnSrc('new-contract.js', 'originBlock') + '\nreturn originBlock();';
          const f = lib.compile(env, ['D', 'C', 'me', 'esc', 'source', 'val', '$'], body);
          return f(env.D, env.C, env.U('u_sales2'), env.C.esc, null, n => (n === 'kind' ? 'RENEW' : ''), s => (s === '#f-origin' ? { value: '2601CL001' } : { value: '' }));
        };
        const x = renewNotice('2026-11-30');
        if (x.why) return x.why;
        if (x.env.C.bundleOf('2601CL001').autoRenew !== 'YES') return '시험 전제: 2601CL001이 자동갱신 계약이 아님';
        if (!x.closed || x.note.indexOf('2601CL001-A09') < 0) return '기간을 줄이는 변경이 진행 중인데 연장 검토가 열림: ' + x.note.slice(0, 120);
        if (x.note.indexOf('계약 기간을 줄이는 변경이 있습니다') < 0) return '연장 검토의 안내 글이 기간을 줄이는 변경을 이름하지 않음: ' + x.note.slice(0, 160);
        const b = blockOf('2026-11-30');
        if (!b || String(b.msg).indexOf('2601CL001-A09') < 0) return '계약 등록의 연장이 기간을 줄이는 변경 때문에 막히지 않음: ' + JSON.stringify(b);
        // 계약 상세와 만료 예정의 연장 단추(늦은 연장이 아닌 연장 검토)
        const d = detailActionsHtml(h, '2601CL001', mk('2026-11-30'));
        if (d.why) return d.why;
        if (d.html.indexOf('renewal.html?origin=2601CL001') > -1) return '기간을 줄이는 변경이 진행 중인데 계약 상세에 연장 검토 단추가 있음';
        if (d.html.indexOf('terminate.html?origin=2601CL001') < 0) return '계약 상세의 해지 기안 단추까지 없어짐(연장 단추만 감춰야 함)';
        const e = expiringRowLinks(h, '2601CL001', mk('2026-11-30'));
        if (e.why) return e.why;
        if (e.links.indexOf('renewal.html?origin=2601CL001') > -1) return '기간을 줄이는 변경이 진행 중인데 만료 예정에 연장 검토 단추가 있음';
        // 견줌: 종료일을 바꾸지 않는 조항만(2026-12-31)이면 막지 않음
        const y = renewNotice('2026-12-31');
        if (y.why) return y.why;
        if (y.note.indexOf('2601CL001-A09') > -1) return '견줌: 기간을 바꾸지 않는 조항만 변경 때문에 연장 검토가 막힘';
        const b2 = blockOf('2026-12-31');
        if (b2 && String(b2.msg).indexOf('2601CL001-A09') > -1) return '견줌: 기간을 바꾸지 않는 조항만 변경 때문에 계약 등록의 연장이 막힘';
        const d2 = detailActionsHtml(h, '2601CL001', mk('2026-12-31'));
        if (d2.why) return d2.why;
        if (d2.html.indexOf('renewal.html?origin=2601CL001') < 0) return '견줌: 기간을 바꾸지 않는 조항만 변경인데 계약 상세에 연장 검토 단추가 없음';
        const e2 = expiringRowLinks(h, '2601CL001', mk('2026-12-31'));
        if (e2.why) return e2.why;
        if (e2.links.indexOf('renewal.html?origin=2601CL001') < 0) return '견줌: 기간을 바꾸지 않는 조항만 변경인데 만료 예정에 연장 검토 단추가 없음';
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검, 코드 다시 보기 amend-03, 결정할것 amend-03 (가) [가정]) 찾은 사람의 재현: 예전에는 둘째 줄임이 오류 없이 기안되어 끝나면 표절검사 -1개, -7,150,000원
      name: '(amend-03) 줄임(2609CL007-A02 표절검사 -2개, -16,250,000원)이 진행 중이면 둘째 줄임(표절검사 -1개)은 진행 중인 줄임을 빼고 셈해 기안되지 않음',
      kind: 'deny',
      run(h) {
        const { env, p } = amend(h, 'REDUCE', { hook: REDUCE_A02, lines: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '7,150,000' }] });
        const t = env.C.currentTerms('2609CL007');
        if (!t.pending.some(x => x.id === '2609CL007-A02')) return '시험 전제: A02가 진행 중이 아님';
        const r = p.submit('2609CL007-A03');
        if (r.rec || env.contract('2609CL007-A03')) return '진행 중인 줄임으로 이미 0개가 될 표절검사를 또 줄이는 기안이 됨';
        if (!has(r.errors, '진행 중인 줄임(2609CL007-A02)을 빼면 0개라 그보다 많이 줄일 수 없습니다')) return '진행 중인 줄임을 뺀 수량 오류가 없음: ' + r.errors.join(' / ');
        // 금액만 넘는 경우도 막음: 추가 이용자(지금 10개 12,600,000원)를 진행 중인 줄임 -5개 -10,000,000원 뒤에 1개 -3,000,000원
        const A02U = D => D.CONTRACTS.push({ id: '2609CL007-A02', parentId: '2609CL007', counterparty: '한누리대학교', services: ['CK'], type: 'SaaS 이용계약', kind: 'AMEND', amendKind: 'REDUCE',
          amount: -10000000, products: [{ feature: 'CK_CAMPUS_USER', qty: -5, amount: -10000000 }], requesterId: 'u_taeyun_kim', requestedAt: '2026-10-18 10:00',
          restricted: false, personalData: false, status: 'IN_REVIEW', startDate: '2026-11-01', endDate: '2027-09-30', checklist: { standard: 'NO', price: 'NA', cap: 'NA' } });
        const y = amend(h, 'REDUCE', { hook: A02U, lines: [{ feature: 'CK_CAMPUS_USER', qty: 1, amount: '3,000,000' }] });
        const r3 = y.p.submit('2609CL007-A03');
        if (r3.rec) return '진행 중인 줄임을 빼면 금액이 모자란 줄임이 기안됨';
        if (!has(r3.errors, '진행 중인 줄임(2609CL007-A02)을 빼면 금액이 2,600,000원이라 ' + AMOUNT_OVER)) return '진행 중인 줄임을 뺀 금액 오류가 없음: ' + r3.errors.join(' / ');
        // 견줌: 진행 중인 것이 추가 변경이면 줄임 상한은 그대로(계약 완료된 조건)라 같은 줄임이 기안됨
        const ADD_A02 = D => { REDUCE_A02(D); const c = D.CONTRACTS.find(x => x.id === '2609CL007-A02'); c.amendKind = 'ADD'; c.amount = 16250000; c.products = [{ feature: 'CK_CAMPUS_PLAG', qty: 2, amount: 16250000 }]; };
        const z = amend(h, 'REDUCE', { hook: ADD_A02, lines: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '7,150,000' }] });
        const r2 = z.p.submit('2609CL007-A03');
        if (r2.errors.length) return '견줌: 진행 중인 것이 추가 변경인데 줄임이 막힘: ' + r2.errors.join(' / ');
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검, 코드 다시 보기 amend-05, 결정할것 amend-05 (가) [가정]) 예전에는 "1번째 줄의 기능은 지금 쓰지 않습니다" 오류로 막혔음
      name: '(amend-05) 줄임은 지금 유효한 조건에 있는 사용 안 함 기능(추가 이용자, 2609CL007 10개)도 줄일 수 있고(-5개, -6,300,000원), 추가와 신규는 지금처럼 막음',
      kind: 'ok',
      run(h) {
        const { env, p } = amend(h, 'REDUCE', { lines: [{ feature: 'CK_CAMPUS_USER', qty: 5, amount: '6,300,000' }] });
        const f = env.D.FEATURES.find(x => x.id === 'CK_CAMPUS_USER');
        if (!f || f.use) return '시험 전제: 추가 이용자가 사용 안 함이 아님';
        const row = p.rows()[0];
        if (row.retired || !row.product || row.product.service !== 'CK') return '줄임에서 지금 조건의 사용 안 함 기능을 쓰지 않는 기능으로 봄: ' + JSON.stringify({ retired: row.retired, product: !!row.product });
        const r = p.submit('2609CL007-A87');
        if (r.errors.length) return '지금 조건의 사용 안 함 기능을 줄이는 기안이 막힘: ' + r.errors.join(' / ');
        const l = r.rec.products[0];
        if (l.feature !== 'CK_CAMPUS_USER' || l.qty !== -5 || l.amount !== -6300000 || r.rec.services.join() !== 'CK') return '줄임 줄이 기록에 맞게 남지 않음: ' + JSON.stringify(l) + ' ' + r.rec.services;
        // 지금 조건에 없는 사용 안 함 기능(API 연동)은 줄임에서도 막음
        const x = amend(h, 'REDUCE', { lines: [{ feature: 'CK_CAMPUS_API', qty: 1, amount: '1,000,000' }] });
        const rx = x.p.submit('2609CL007-A88');
        if (rx.rec) return '지금 조건에 없는 사용 안 함 기능을 줄이는 기안이 됨';
        if (!has(rx.errors, '기능은 지금 쓰지 않습니다')) return '조건에 없는 사용 안 함 기능 오류가 없음: ' + rx.errors.join(' / ');
        // 추가는 지금처럼 막음(AC-04)
        const y = amend(h, 'ADD', { lines: [{ feature: 'CK_CAMPUS_USER', qty: 1, amount: '1,375,000' }], vals: { priceNote: '시험 사유', capNote: '시험 사유' } });
        const ry = y.p.submit('2609CL007-A89');
        if (ry.rec) return '추가 변경으로 사용 안 함 기능이 기안됨';
        if (!has(ry.errors, '기능은 지금 쓰지 않습니다')) return '추가 변경에 사용 안 함 오류가 없음: ' + ry.errors.join(' / ');
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검, 코드 다시 보기 common-03) 찾은 사람의 재현: 예전에는 noticeDays 60, renewFrom A03, 통지 기한 2026-11-01
      name: '(common-03) 먼저 기안했다가 나중에 끝난 추가 변경(A03, 기안 때 채운 60일)이 그 사이 끝난 조항만 변경(A02, 90일)의 해지 통지 일수를 되돌리지 않음(2601CL001)',
      kind: 'ok',
      run(h) {
        const mk = over => Object.assign({ parentId: '2601CL001', counterparty: '누리교육재단', services: ['CK'], type: 'SaaS 이용계약', kind: 'AMEND',
          requesterId: 'u_sales2', restricted: false, personalData: false, status: 'ACTIVE', autoHistory: true,
          startDate: '2026-10-01', endDate: '2026-12-31', checklist: { standard: 'NO', standardNote: '변경 계약서', price: 'NA', cap: 'NA' },
          form: { method: 'DIRECT', settlement: 'LUMP' } }, over);
        const hook = D => {
          D.CONTRACTS.push(mk({ id: '2601CL001-A02', amendKind: 'TERMS', amount: 0, products: [], requestedAt: '2026-09-20 10:00', approvedAt: '2026-09-21 15:00', autoRenew: 'YES', noticeDays: 90 }));
          D.CONTRACTS.push(mk({ id: '2601CL001-A03', amendKind: 'ADD', amount: 5000000, products: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: 5000000 }],
            requestedAt: '2026-09-10 10:00', approvedAt: '2026-10-04 15:00', autoRenew: 'YES', noticeDays: 60, checklist: { standard: 'YES', price: 'YES', cap: 'YES' } }));
        };
        const env = h.fresh({ role: 'SUPER', hook });
        const { C } = env;
        const a2 = env.contract('2601CL001-A02'), a3 = env.contract('2601CL001-A03');
        if (!(String(a3.completedAt || '') > String(a2.completedAt || ''))) return '시험 전제: A03이 A02보다 늦게 계약 완료되지 않음';
        const b = C.bundleOf('2601CL001');
        if (b.noticeDays !== 90 || b.renewFrom.id !== '2601CL001-A02') return '묶음 통지 일수가 A02의 90일이 아님: ' + b.noticeDays + ' (' + (b.renewFrom && b.renewFrom.id) + ')';
        if (C.noticeDate(b) !== '2026-10-02') return '해지 통지 기한이 2026-10-02가 아님: ' + C.noticeDate(b);
        if (C.currentTerms('2601CL001').noticeDays !== 90) return '지금 유효한 조건의 통지 일수가 90일이 아님';
        // 견줌: A03이 값을 바꿨으면(30일) A03이 더 늦게 끝나 그 값이 됨
        a3.noticeDays = 30;
        const b2 = C.bundleOf('2601CL001');
        if (b2.noticeDays !== 30 || b2.renewFrom.id !== '2601CL001-A03') return '견줌: 값을 바꾼 A03(30일)이 반영되지 않음: ' + b2.noticeDays;
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검, 코드 다시 보기 common-03 2차) 거울 차례: 조항만 A02(90일)를 먼저 기안하고, A02가 끝나기 전에 추가 A03을 기안(계약 등록이 그때 묶음 값 60일을 채움).
      //   A02가 먼저 끝나고 A03이 늦게 끝나면 예전에는 A03의 60일을 "바꾼 값"으로 보고 묶음이 60일(통지 기한 2026-11-01)로 돌아갔음.
      //   이제 계약 등록이 기안 때 묶음 값을 renewBase로 남기고(formRecord), 묶음 셈(renewTermsOf)과 결재 문서 "바뀜"(renewChangedHtml)이 그 값과 견줌 [가정]
      name: '(common-03) 조항만 변경(A02, 90일)이 진행 중일 때 기안한 추가 변경(A03, 채운 60일)은 기안 때 묶음 값을 남기고, A02보다 늦게 끝나도 90일을 되돌리지 않으며 결재 중 "바뀜"도 없음(2601CL001)',
      kind: 'ok',
      run(h) {
        const mk = over => Object.assign({ parentId: '2601CL001', counterparty: '누리교육재단', services: ['CK'], type: 'SaaS 이용계약', kind: 'AMEND',
          requesterId: 'u_sales2', restricted: false, personalData: false, status: 'ACTIVE', autoHistory: true,
          startDate: '2026-10-01', endDate: '2026-12-31', checklist: { standard: 'NO', standardNote: '변경 계약서', price: 'NA', cap: 'NA' },
          form: { method: 'DIRECT', settlement: 'LUMP' } }, over);
        const A02 = over => D => D.CONTRACTS.push(mk(Object.assign({ id: '2601CL001-A02', amendKind: 'TERMS', amount: 0, products: [], requestedAt: '2026-09-10 10:00',
          approvedAt: '2026-09-21 15:00', autoRenew: 'YES', noticeDays: 90 }, over)));
        const OPEN = { status: 'IN_REVIEW', autoHistory: false, approvedAt: undefined, history: [] };
        // 1) A02가 진행 중일 때 계약 등록(변경, 추가)이 남기는 기록: 화면이 채우는 값(C.bundleOf)과 같은 renewBase
        const env0 = h.fresh({ role: 'SALES', hook: A02(OPEN) });
        fixClock(env0);
        const nb = env0.C.bundleOf('2601CL001');
        if (nb.autoRenew !== 'YES' || nb.noticeDays !== 60) return '시험 전제: A02가 진행 중일 때 묶음 값이 자동갱신 있음 60일이 아님: ' + nb.autoRenew + ' ' + nb.noticeDays;
        const p = lib.nc(env0, lib.ncState({ me: env0.U('u_sales2'), origin: '2601CL001', lines: [{ service: 'CK', product: 'CK_CAMPUS', feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '5,000,000' }],
          vals: { kind: 'AMEND', amendKind: 'ADD', customer: 'C:C-0004', counterparty: '누리교육재단', bizNo: '104-82-55123', opportunity: '2610CK903', startDate: '2026-11-15',
            endDate: '2026-12-31', autoRenew: nb.autoRenew, noticeDays: String(nb.noticeDays), standard: 'NO', standardNote: '변경(시험)' } }));
        const rec = p.record();
        if (!rec.renewBase || rec.renewBase.autoRenew !== 'YES' || rec.renewBase.noticeDays !== 60) return '계약 등록이 변경 기록에 기안 때 묶음 값(renewBase)을 남기지 않음: ' + JSON.stringify(rec.renewBase);
        if ('renewBase' in lib.nc(env0, lib.ncState({ me: env0.U('u_sales1') })).record()) return '신규 계약 기록에도 renewBase가 남음(변경만)';
        // 2) 거울 차례: A02 먼저 끝남, A03(기안 09-20, renewBase 60일)이 늦게 끝남
        const A03 = over => D => D.CONTRACTS.push(mk(Object.assign({ id: '2601CL001-A03', amendKind: 'ADD', amount: 5000000, products: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: 5000000 }],
          requestedAt: '2026-09-20 10:00', approvedAt: '2026-10-04 15:00', autoRenew: rec.autoRenew, noticeDays: rec.noticeDays, renewBase: rec.renewBase,
          checklist: { standard: 'YES', price: 'YES', cap: 'YES' } }, over)));
        const both = (...f) => D => f.forEach(x => x(D));
        const env = h.fresh({ role: 'SUPER', hook: both(A02(), A03()) });
        const { C } = env;
        if (!(String(env.contract('2601CL001-A03').completedAt || '') > String(env.contract('2601CL001-A02').completedAt || ''))) return '시험 전제: A03이 A02보다 늦게 계약 완료되지 않음';
        const b = C.bundleOf('2601CL001');
        if (b.noticeDays !== 90 || b.renewFrom.id !== '2601CL001-A02') return '거울 차례에서 늦게 끝난 A03(채운 60일)이 A02의 90일을 되돌림: ' + b.noticeDays + ' (' + (b.renewFrom && b.renewFrom.id) + ')';
        if (C.noticeDate(b) !== '2026-10-02') return '해지 통지 기한이 2026-10-02가 아님: ' + C.noticeDate(b);
        if (C.currentTerms('2601CL001').noticeDays !== 90) return '지금 유효한 조건의 통지 일수가 90일이 아님';
        // 3) A02가 끝나고 A03이 결재 중: 결재 문서에 "바뀜"이 없음(계약 완료되어도 묶음 값이 바뀌지 않으므로)
        const envR = h.fresh({ role: 'SUPER', hook: both(A02(), A03(OPEN)) });
        const rv = lib.review(envR, '2601CL001-A03', 'u_super');
        if (rv.error) return '결재 문서를 열지 못함: ' + rv.error.message;
        if (lib.strip(rv.dom.q('#basic').innerHTML).indexOf('바뀜') > -1) return 'A03 결재 문서에 "바뀜"이 보임(계약 완료되어도 묶음 값은 그대로인데)';
        // 견줌: A03을 30일로 바꿨으면 결재 중에 "바뀜 변경 전: 있음(만료 60일 전)"이고, 늦게 끝나 30일이 됨
        const envR2 = h.fresh({ role: 'SUPER', hook: both(A02(), A03(Object.assign({ noticeDays: 30 }, OPEN))) });
        if (!/바뀜 변경 전: 있음\(만료 60일 전\)/.test(lib.strip(lib.review(envR2, '2601CL001-A03', 'u_super').dom.q('#basic').innerHTML))) return '견줌: 30일로 바꾼 A03의 결재 문서에 "바뀜 변경 전: 있음(만료 60일 전)"이 없음';
        const env2 = h.fresh({ role: 'SUPER', hook: both(A02(), A03({ noticeDays: 30 })) });
        const b2 = env2.C.bundleOf('2601CL001');
        if (b2.noticeDays !== 30 || b2.renewFrom.id !== '2601CL001-A03') return '견줌: 값을 바꾼 A03(30일)이 반영되지 않음: ' + b2.noticeDays;
        return true;
      },
    },
  ],
  serverOnly: [
    '금액이 늘어나는 변경을 줄임이나 조항만으로 요청에 담아 보내 ③을 피함: 서버가 위 검사(줄임은 0보다 작은 금액과 지금 수량 이하, 조항만은 줄 0개와 0원)로 다시 거절',
    '조항만인데 제품 줄이나 금액을 요청에 담아 보냄: 서버가 거절(시안 화면은 조항만이면 줄을 읽지 않아 보내지 않음)',
    '변경 종류의 검사, 2, 3번 NA와 ③ 생략, 지금 유효한 조건의 수량을 서버가 다시 계산. 금액 칸은 부호 있는 정수(04 3장 "변경 종류와 지금 유효한 조건")',
    '(2026-11-14 주말 점검 W7) 줄임의 금액 상한(기능마다 지금 금액, 합계는 지금 계약 금액)을 서버가 지금 유효한 조건으로 다시 셈해 거절: 시안은 기안 단추에서만 봄',
    '(2026-11-14 주말 점검 W7) 추가, 줄임 변경과 연장이 함께 진행 중인지(겹침)를 서버가 기안을 받을 때 다시 봄: 시안은 화면에서만 봐서 같은 때 기안하면 둘 다 들어갈 수 있음',
    '(2026-11-14 주말 점검, 코드 다시 보기 common-03 2차) 기안 때 묶음 값(renew_base_auto_renew, renew_base_notice_days)을 요청에 담아 바꿔 보냄: 서버가 기안을 받을 때 그때 묶음 값으로 다시 정해 남김(시안은 화면이 formRecord에서 남김)',
  ],
};
// 2026-11-16 기획자 결정 반영 시험(작업기록/2026-11-16/반영목록.md, tools/control_tests/n16.js)
module.exports.tests = module.exports.tests.concat(require('./n16')('AC-53'));
