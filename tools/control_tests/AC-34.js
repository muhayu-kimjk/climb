// AC-34 조건 그대로 연장 (CTL-69, 06 통제 목록 2장) 시험 (2026-11-13 주말 점검 W2)
//   연장 검토 화면(renewal.js), 계약 등록(new-contract.js)의 바꿔서 연장, 결재 문서(review.js)를 가짜 문서에 올려 눌러 봄(도우미는 lib.js)
//   (2026-11-14 주말 점검 W7 2차) 시험을 더함: 계약 상세와 만료 예정의 연장 단추(icfr-05), 반려된 그대로 연장을 다시 기안할 때 0원 이하 안내,
//     묶음의 자동갱신과 해지 통지 일수(icfr-08, CTL-68)와 변경 등록의 미리 채우기, 분할 정산 청구 일정을 기록마다(icfr-06, CTL-72)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const lib = require('./lib');
const { page, doStep } = lib;
const JS = path.join(__dirname, '..', '..', 'prototype', 'assets', 'js');

const st = (c, step) => (c.approvals || []).find(a => a.step === step) || {};
// (2026-11-14 주말 점검 W7, icfr-05) 2601CL001에는 진행 중인 추가 변경 2601CL001-A01(③ 차례)이 있어 연장 검토와 계약 등록의 연장이 막힘.
//   그대로 연장의 기안 흐름(기간, 이유, ⑩ 뒤 지금 유효한 계약)을 보는 시험은 -A01을 뺀 데이터로 엶. 막히는 것은 아래 "금액이 바뀌는 변경" 시험이 봄
const NO_A01 = D => { const i = D.CONTRACTS.findIndex(c => c.id === '2601CL001-A01'); if (i > -1) D.CONTRACTS.splice(i, 1); };
// (2026-11-14 주말 점검 W7, abc-07) 거래처 확인 대상이 되게 계약 방식을 조달로 바꿈(그 거래처의 확인 기록이 없어 "확인 전" 경고가 뜸)
const procure = id => D => { const c = D.CONTRACTS.find(x => x.id === id); c.form = Object.assign({}, c.form || {}, { method: 'PROCURE' }); };
const GO = ['S03', 'S04', 'S09', 'S10'];
const KEEP = [['input[name="choice"]:checked', { type: 'radio', name: 'choice', value: 'KEEP', checked: true }]]; // 세 갈래 중 "그대로 자동갱신"
const inExpiring = (env, id) => env.C.expiringBundles(env.D.ALERT_RULES.expiryWindowDays, true).some(b => b.id === id);

// 연장 검토 화면에서 그대로 자동갱신으로 시작일, 종료일, 이유를 넣고 기안 단추와 확인 창의 기안을 누름
//   06 AC-34: 2601CL001의 영업대표 정하은은 시연 역할에 없어 최고관리자로 기안. 돌려주는 값 { dom, rec, blocked, why }
function draft(env, origin, who, v) {
  const dom = page(env, 'renewal.js', '?origin=' + origin, { user: env.U(who), preset: KEEP });
  if (dom.error) return { dom, why: '연장 검토 화면을 열지 못함: ' + dom.error.message };
  if (dom.q('#form').hidden) return { dom, closed: true, why: '' };
  if (v.start != null) dom.q('#f-start').value = v.start;
  dom.q('#f-end').value = v.end;
  dom.q('#f-reason').value = v.reason;
  const n = env.D.CONTRACTS.length;
  dom.submit();
  if (dom.q('#confirm-modal').hidden !== false) return { dom, blocked: true, why: '' };
  dom.confirmClick();
  const rec = env.D.CONTRACTS.length > n ? env.D.CONTRACTS[env.D.CONTRACTS.length - 1] : null;
  return { dom, rec, why: rec ? '' : '확인 창의 기안을 눌러도 연장 검토가 남지 않음' };
}
function run(env, id, steps, each) {
  for (const s of steps) {
    const r = doStep(env, id, s, st(env.contract(id), s).userId);
    if (!r.ok) return r.why;
    if (each) { const w = each(s); if (w) return w; }
  }
  return '';
}
const OK_INPUT = { end: '2027-12-31', reason: '이용 규모가 같아 조건 그대로 1년 연장' };

// 계약 등록(바꿔서 연장)에서 원계약 2601CL001을 고르고 시작일을 넣어 기안 단추를 누른 뒤 오류 요약 글
//   (2026-11-14 주말 점검 W7) hook을 주지 않으면 진행 중인 -A01을 뺀 데이터(NO_A01). origin으로 다른 원계약과 영업대표를 고름
function newContractErrors(h, start, o) {
  o = o || {};
  const origin = o.origin || '2601CL001';
  const env = h.fresh({ role: 'SALES', hook: o.hook === undefined ? NO_A01 : o.hook });
  const dom = page(env, 'new-contract.js', '?kind=RENEW&origin=' + origin, { user: env.U(o.who || 'u_sales2'), preset: [['[name="kind"]:checked', { type: 'radio', name: 'kind', value: 'RENEW', checked: true }]] });
  if (dom.error) return { why: '계약 등록 화면을 열지 못함: ' + dom.error.message };
  dom.q('#f-origin').value = origin;
  dom.q('#f-start').value = start;
  dom.set('[name="startDate"]', { value: start });
  dom.set('[name="endDate"]', { value: '2027-12-31' });
  const n = env.D.CONTRACTS.length;
  dom.fire('#contract-form', 'submit');
  return { text: dom.errors().replace(/<[^>]+>/g, ' '), saved: env.D.CONTRACTS.length !== n, open: dom.q('#confirm-modal').hidden === false };
}
const RENEW_MSG = '연장 계약은 원계약 종료일 다음 날';

/* (2026-11-14 주말 점검 W7 2차) 도우미 */
const strip = s => String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
// 계약 상세의 할 일 단추 줄(글자). 계약 상세는 obligation-ui.js를 먼저 부르므로 같은 차례로 먼저 올림(AC-39와 같음)
function detailActions(h, id, hook) {
  const env = h.fresh({ role: 'SUPER', hook });
  vm.runInContext(fs.readFileSync(path.join(JS, 'obligation-ui.js'), 'utf8'), env.ctx, { filename: 'obligation-ui.js' });
  const dom = page(env, 'contract.js', '?id=' + id, { user: env.U('u_super') });
  if (dom.error) return { why: '계약 상세를 열지 못함: ' + dom.error.message };
  return { text: strip(dom.q('#bundle-actions').innerHTML), html: String(dom.q('#bundle-actions').innerHTML) };
}
// 만료 예정(90일 보기)에서 그 묶음 줄의 링크들
function expiringLinks(h, id, hook) {
  const env = h.fresh({ role: 'SUPER', hook });
  const dom = page(env, 'expiring.js', '', { user: env.U('u_super'), preset: [['#f-days', { value: '90' }]] });
  if (dom.error) return { why: '만료 예정을 열지 못함: ' + dom.error.message };
  const row = String(dom.q('#rows').innerHTML).split('</tr>').filter(r => r.indexOf('contract.html?id=' + id + '"') > -1)[0];
  if (!row) return { why: '시험 전제: 만료 예정 90일 보기에 ' + id + '가 없음' };
  return { links: row.match(/href="[^"]+"/g) || [] };
}
// 계약 등록을 변경(AMEND)으로 열고 원계약을 고름. 자동갱신 단추 둘을 화면에 올려(가짜 문서는 html의 칸을 모름) 고른 값을 읽을 수 있게 함
function amendForm(h, origin, who) {
  const env = h.fresh({ role: 'SALES' });
  const dom = page(env, 'new-contract.js', '?kind=AMEND&origin=' + origin, { user: env.U(who), preset: [
    ['[name="kind"]:checked', { type: 'radio', name: 'kind', value: 'AMEND', checked: true }],
    ['[name="amendKind"]:checked', { type: 'radio', name: 'amendKind', value: 'TERMS', checked: true }]] });
  if (dom.error) return { why: '계약 등록을 열지 못함: ' + dom.error.message };
  dom.q('#test-auto-renew').innerHTML = '<input type="radio" name="autoRenew" value="YES"><input type="radio" name="autoRenew" value="NO">';
  const pick = o => { dom.q('#f-origin').value = o; dom.fire('#contract-form', 'change', { target: dom.q('#f-origin') }); };
  const now = () => ({ auto: dom.inputs({ name: 'autoRenew' }).filter(x => x.checked).map(x => x.value).join(), days: String(dom.q('#f-notice-days').value), hidden: dom.q('#notice-days-field').hidden });
  pick(origin);
  return { env, dom, pick, now };
}
// 계약 완료된 조항만 변경을 묶음에 더하는 hook(icfr-08): 자동갱신과 해지 통지 일수를 바꿈
const termsAmend = (rootId, id, autoRenew, noticeDays) => D => {
  const root = D.CONTRACTS.find(x => x.id === rootId);
  D.CONTRACTS.push({ id: id, parentId: rootId, counterparty: root.counterparty, services: root.services, type: 'SaaS 이용계약', kind: 'AMEND', amendKind: 'TERMS',
    amount: 0, requesterId: root.requesterId, requestedAt: '2026-10-10 10:00', restricted: false, personalData: !!root.personalData, status: 'ACTIVE', approvedAt: '2026-10-12 15:00',
    autoHistory: true, checklist: { standard: 'NO', standardNote: '자동갱신과 해지 통지 조항을 바꿈', price: 'NA', cap: 'NA' }, startDate: '2026-11-01', endDate: root.endDate,
    autoRenew: autoRenew, noticeDays: noticeDays, products: [] });
};
// 분할 정산 알림(icfr-06): 빠진 기록 번호 목록
const gapIds = (env, id) => env.C.billingGapList(env.C.bundleOf(id)).map(x => x.c.id).join();
// 계약 완료된 추가 변경을 묶음에 더하는 hook(icfr-06)
const addAmend = (rootId, id, settlement, start, end, amount) => D => {
  const root = D.CONTRACTS.find(x => x.id === rootId);
  D.CONTRACTS.push({ id: id, parentId: rootId, counterparty: root.counterparty, services: ['CK'], type: 'SaaS 이용계약', kind: 'AMEND', amendKind: 'ADD',
    amount: amount, requesterId: root.requesterId, requestedAt: '2026-10-16 10:00', restricted: false, personalData: !!root.personalData, status: 'ACTIVE', approvedAt: '2026-10-17 15:00',
    autoHistory: true, checklist: { standard: 'NO', price: 'YES', cap: 'YES' }, startDate: start, endDate: end, form: { settlement: settlement },
    products: [{ feature: 'CK_CAMPUS_USER', qty: 1, amount: amount }] });
};
// 진행 중인 그대로 연장 2512CL001-R01을 계약 완료로(⑩까지 끝난 것처럼)
const r01Done = D => { const r = D.CONTRACTS.find(x => x.id === '2512CL001-R01'); r.autoHistory = true; r.approvedAt = '2026-10-20 15:00'; r.history = undefined; r.status = 'ACTIVE'; };

module.exports = {
  ac: 'AC-34',
  title: '조건 그대로 연장',
  tests: [
    {
      name: '2601CL001에 시작 2027-01-01, 종료 2027-12-31, 이유를 넣으면 -R01(금액은 지금 값)이 되고 ⑩ 뒤 지금 유효한 계약이 -R01',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SUPER', hook: NO_A01 });
        const { C } = env;
        const b0 = C.bundleOf('2601CL001');
        if (b0.end !== '2026-12-31' || b0.autoRenew !== 'YES') return '시험 전제: 2601CL001의 지금 종료일 2026-12-31, 자동갱신이 아님';
        const terms = C.currentTerms('2601CL001');
        const d = draft(env, '2601CL001', 'u_super', Object.assign({ start: '2027-01-01' }, OK_INPUT));
        if (d.why || d.blocked || d.closed) return d.why || '기안이 막힘: ' + d.dom.errors().replace(/<[^>]+>/g, ' ');
        const r = d.rec;
        if (r.id !== '2601CL001-R01' || r.kind !== 'RENEW' || r.renewMode !== 'AUTO') return '-R01 조건 그대로 연장이 아님: ' + r.id + ' ' + r.kind + ' ' + r.renewMode;
        if (r.startDate !== '2027-01-01' || r.endDate !== '2027-12-31') return '새 계약 기간이 넣은 값이 아님: ' + r.startDate + '~' + r.endDate;
        if (r.amount !== terms.core) return '금액이 원계약의 지금 값(' + terms.core + ')이 아님: ' + r.amount;
        if (r.requesterId !== C.repActorOf(b0)) return '기안자가 지금 영업대표가 아님: ' + r.requesterId;
        const w = run(env, r.id, GO);
        if (w) return w;
        const b = C.bundleOf('2601CL001');
        if (r.status !== 'ACTIVE') return '⑩ 뒤 연장이 계약 완료가 아님: ' + r.status;
        if (b.current.id !== '2601CL001-R01' || b.end !== '2027-12-31') return '⑩ 뒤 지금 유효한 계약이 -R01이 아님: ' + b.current.id + ' ' + b.end;
        return true;
      },
    },
    {
      name: '시작일을 2026-12-15로 당겨 기간이 겹치면 기안되지 않음(2601CL001)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SUPER', hook: NO_A01 });
        const n = env.D.CONTRACTS.length;
        const d = draft(env, '2601CL001', 'u_super', Object.assign({ start: '2026-12-15' }, OK_INPUT));
        if (d.why) return d.why;
        if (!d.blocked || env.D.CONTRACTS.length !== n) return '시작일 2026-12-15로 기안됨';
        if (d.dom.errors().indexOf('새 계약 시작일은 지금 종료일 다음 날') < 0) return '시작일 오류 안내가 없음: ' + d.dom.errors().replace(/<[^>]+>/g, ' ').slice(0, 120);
        return true;
      },
    },
    {
      name: '계약 등록에서 바꿔서 연장의 시작일이 원계약 종료일과 같거나 앞서면 기안되지 않음(2601CL001, CTL-20)',
      kind: 'deny',
      run(h) {
        for (const day of ['2026-12-31', '2026-12-15']) {
          const x = newContractErrors(h, day);
          if (x.why) return x.why;
          if (x.saved || x.open) return '시작일 ' + day + '로 기안 확인 창이 열리거나 저장됨';
          if (x.text.indexOf(RENEW_MSG) < 0) return '시작일 ' + day + '에 "' + RENEW_MSG + '" 오류가 없음';
        }
        const ok = newContractErrors(h, '2027-01-01');
        if (ok.why) return ok.why;
        if (ok.text.indexOf(RENEW_MSG) > -1) return '종료일 다음 날(2027-01-01)에도 시작일 오류가 남(시험 전제가 맞지 않음)';
        return true;
      },
    },
    {
      name: '종료일이 시작일보다 앞서면 기안되지 않음(2601CL001)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SUPER', hook: NO_A01 });
        const n = env.D.CONTRACTS.length;
        const d = draft(env, '2601CL001', 'u_super', { start: '2027-01-01', end: '2026-12-31', reason: OK_INPUT.reason });
        if (d.why) return d.why;
        if (!d.blocked || env.D.CONTRACTS.length !== n) return '종료일이 시작일보다 앞서는데 기안됨';
        if (d.dom.errors().indexOf('새 계약 종료일은 새 계약 시작일보다 앞설 수 없습니다') < 0) return '종료일 오류 안내가 없음';
        return true;
      },
    },
    {
      name: '이유 없이 기안되지 않음(2601CL001)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SUPER', hook: NO_A01 });
        const n = env.D.CONTRACTS.length;
        const d = draft(env, '2601CL001', 'u_super', { start: '2027-01-01', end: '2027-12-31', reason: '  ' });
        if (d.why) return d.why;
        if (!d.blocked || env.D.CONTRACTS.length !== n) return '이유 없이 기안됨';
        if (d.dom.errors().indexOf('그대로 연장하는 이유를 적으세요') < 0) return '이유 오류 안내가 없음';
        return true;
      },
    },
    {
      name: '⑩ 전에는 만료 예정과 계약 상세의 지금 유효한 계약이 바뀌지 않음(2601CL001-R01, ⑨까지)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SUPER', hook: NO_A01 });
        const { C } = env;
        if (!inExpiring(env, '2601CL001')) return '시험 전제: 2601CL001이 만료 예정에 없음';
        const d = draft(env, '2601CL001', 'u_super', Object.assign({ start: '2027-01-01' }, OK_INPUT));
        if (d.why || d.blocked) return d.why || '기안이 막힘';
        const w = run(env, d.rec.id, ['S03', 'S04', 'S09'], s => {
          const b = C.bundleOf('2601CL001');
          if (b.current.id !== '2601CL001' || b.end !== '2026-12-31') return s + ' 뒤(⑩ 전)에 지금 유효한 계약이 바뀜: ' + b.current.id + ' ' + b.end;
          if (!inExpiring(env, '2601CL001')) return s + ' 뒤(⑩ 전)에 만료 예정에서 빠짐';
          return '';
        });
        if (w) return w;
        const again = h.fresh({ role: 'SUPER', store: env.store, hook: NO_A01 }).C.bundleOf('2601CL001');
        if (again.current.id !== '2601CL001') return '다시 열면 ⑩ 전인데 지금 유효한 계약이 바뀜';
        return true;
      },
    },
    {
      name: '자동갱신이 아닌 계약(2604CL001)은 연장 검토를 기안할 수 없음',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SUPER', hook: NO_A01 });
        if (env.C.bundleOf('2604CL001').autoRenew === 'YES') return '시험 전제: 2604CL001이 자동갱신임';
        const dom = page(env, 'renewal.js', '?origin=2604CL001', { user: env.U('u_super'), preset: KEEP });
        if (dom.error) return '연장 검토 화면을 열지 못함: ' + dom.error.message;
        if (dom.q('#form').hidden === false) return '자동갱신이 아닌데 연장 검토 기안 칸이 열림';
        if (String(dom.q('#notice').innerHTML).indexOf('자동갱신 계약이 아닙니다') < 0) return '"자동갱신 계약이 아닙니다" 안내가 없음';
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검 W7, icfr-05) 그대로 연장 금액은 기안할 때의 지금 유효한 조건이라, 뒤에 끝난 변경이 새 기간 금액에서 빠지지 않게 막음
      name: '금액이 바뀌는 변경(2601CL001-A01 추가, ③ 차례)이 진행 중이면 연장 검토와 계약 등록의 연장을 기안할 수 없고, 조항만 변경(2609CL009-A01)은 막지 않음',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SUPER' });
        const { C } = env;
        const a01 = env.contract('2601CL001-A01');
        if (!a01 || C.amendKindOf(a01) !== 'ADD' || !C.bundleOf('2601CL001').open.some(o => o.id === a01.id)) return '시험 전제: 2601CL001-A01이 진행 중인 추가 변경이 아님';
        const n = env.D.CONTRACTS.length;
        const d = draft(env, '2601CL001', 'u_super', Object.assign({ start: '2027-01-01' }, OK_INPUT));
        if (d.why) return d.why;
        if (!d.closed || env.D.CONTRACTS.length !== n) return '추가 변경이 진행 중인데 연장 검토 기안 칸이 열리거나 기안됨';
        const note = String(d.dom.q('#notice').innerHTML).replace(/<[^>]+>/g, ' ');
        if (note.indexOf('2601CL001-A01') < 0 || note.indexOf('금액이 바뀌는 변경') < 0) return '막은 까닭(진행 중인 2601CL001-A01, 금액이 바뀌는 변경)이 안내에 없음: ' + note.slice(0, 120);
        // 계약 등록의 연장(조건을 바꿔 연장)도 같은 규칙
        const BUSY = '진행 중인 기안이 끝난 뒤에 기안하세요';
        const x = newContractErrors(h, '2027-01-01', { hook: null });
        if (x.why) return x.why;
        if (x.saved || x.open) return '추가 변경이 진행 중인데 계약 등록의 연장 확인 창이 열리거나 저장됨';
        if (x.text.indexOf(BUSY) < 0) return '계약 등록의 연장에 진행 중인 기안 오류가 없음: ' + x.text.slice(0, 160);
        // 견줌: -A01이 없으면 그 오류가 없음
        const y = newContractErrors(h, '2027-01-01');
        if (y.why) return y.why;
        if (y.text.indexOf(BUSY) > -1) return '견줌: -A01을 빼도 진행 중인 기안 오류가 남(시험 전제가 맞지 않음)';
        // 조항만 변경은 금액이 없어 막지 않음: 2609CL009-A01(조항만, 진행 중)
        const t = env.contract('2609CL009-A01');
        if (!t || C.amendKindOf(t) !== 'TERMS' || !C.bundleOf('2609CL009').open.some(o => o.id === t.id)) return '시험 전제: 2609CL009-A01이 진행 중인 조항만 변경이 아님';
        const z = newContractErrors(h, C.addDays(C.bundleOf('2609CL009').end, 1), { origin: '2609CL009', who: 'u_seohyun_park', hook: null });
        if (z.why) return z.why;
        if (z.text.indexOf(BUSY) > -1) return '조항만 변경이 진행 중인데 계약 등록의 연장이 막힘';
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검 W7, icfr-03) 음수나 0원 연장이 기안되지 않게(예전 기록이나 모두 줄인 계약). 조건을 바꿔 연장으로 보냄
      name: '지금 유효한 조건의 금액이 0원 이하이면 그대로 연장을 기안할 수 없음(2511CL001 금액을 0원, -1,000,000원으로 바꿔 봄)',
      kind: 'deny',
      run(h) {
        const input = { start: '2026-11-15', end: '2027-11-14', reason: OK_INPUT.reason };
        for (const amt of [0, -1000000]) {
          const env = h.fresh({ role: 'SALES', hook: D => { D.CONTRACTS.find(c => c.id === '2511CL001').amount = amt; } });
          if (env.C.currentTerms('2511CL001').core !== amt) return '시험 전제: 2511CL001의 지금 금액이 ' + amt + '원이 아님';
          const n = env.D.CONTRACTS.length;
          const d = draft(env, '2511CL001', 'u_sales1', input);
          if (d.why) return d.why;
          if (d.closed) return '시험 전제: 연장 검토 화면이 막힘: ' + String(d.dom.q('#notice').innerHTML).replace(/<[^>]+>/g, ' ').slice(0, 100);
          if (!d.blocked || env.D.CONTRACTS.length !== n) return '지금 금액 ' + amt + '원으로 그대로 연장이 기안됨';
          if (d.dom.errors().indexOf('그대로 연장할 수 없습니다') < 0) return amt + '원: 그대로 연장할 수 없다는 오류가 없음';
          if (String(d.dom.q('#notice').innerHTML).indexOf('그대로 연장할 수 없는 금액입니다') < 0) return amt + '원: 맨 위 안내가 없음';
        }
        // 견줌: 금액이 그대로(54,000,000원)이면 기안됨
        const env = h.fresh({ role: 'SALES' });
        const ok = draft(env, '2511CL001', 'u_sales1', input);
        if (ok.why || ok.blocked || ok.closed) return '견줌: 지금 금액 그대로인데 기안되지 않음';
        if (ok.rec.amount !== 54000000) return '견줌: 금액이 54,000,000원이 아님: ' + ok.rec.amount;
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검 W7, icfr-03) 계약 등록의 연장은 금액을 영업이 넣으므로 0원 막음(REQ-SCOPE-05)이 그대로 받음
      name: '계약 등록의 연장(조건을 바꿔 연장)도 계약 금액 총액이 0원이면 기안되지 않음(2601CL001)',
      kind: 'deny',
      run(h) {
        const state = amount => lib.ncState({ me: undefined, origin: '2601CL001', lines: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: amount }],
          vals: { kind: 'RENEW', customer: 'C:C-0004', counterparty: '누리교육재단', bizNo: '104-82-55123', opportunity: '2610CK903', startDate: '2027-01-01', endDate: '2027-12-31' } });
        const env = h.fresh({ role: 'SALES' });
        const r = lib.nc(env, Object.assign(state('0'), { me: env.U('u_sales2') })).submit('2601CL001-R91');
        if (r.rec || env.contract('2601CL001-R91')) return '0원 연장이 기안됨';
        if (!lib.hasErr(r.errors, '계약 금액 총액이 0원입니다')) return '0원 오류가 없음: ' + r.errors.join(' / ');
        // 견줌: 금액을 넣으면 그 오류가 없음
        const env2 = h.fresh({ role: 'SALES' });
        const r2 = lib.nc(env2, Object.assign(state('12,000,000'), { me: env2.U('u_sales2') })).submit('2601CL001-R92');
        if (lib.hasErr(r2.errors, '계약 금액 총액이 0원입니다')) return '견줌: 금액을 넣어도 0원 오류가 남';
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검 W7, abc-07) 계약 등록(C-13)과 같은 경고를 그대로 연장에도. 막지는 않고 결재 문서가 보게 기록에 남김
      name: '거래처 확인 전인 조달 거래처의 그대로 연장은 경고 없이, 기록 없이 기안되지 않음(경고만, 막지 않음. 2511CL001을 조달로 바꿔 봄)',
      kind: 'deny',
      run(h) {
        const input = { start: '2026-11-15', end: '2027-11-14', reason: OK_INPUT.reason };
        const env = h.fresh({ role: 'SALES', hook: procure('2511CL001') });
        const d = draft(env, '2511CL001', 'u_sales1', input);
        if (d.why || d.blocked || d.closed) return d.why || '거래처 확인 경고 때문에 기안이 막힘(경고만 해야 함)';
        const w = d.dom.q('#customer-check');
        if (w.hidden !== false || String(w.innerHTML).indexOf('조달 거래처라') < 0) return '화면에 거래처 확인 경고가 없음';
        if (String(d.dom.q('#confirm-body').innerHTML).indexOf('거래처 확인') < 0) return '기안 확인 창에 거래처 확인 경고가 없음';
        if (String(d.rec.customerCheckWarn || '').indexOf('조달 거래처라') < 0) return '연장 기록에 거래처 확인 경고가 남지 않음: ' + JSON.stringify(d.rec.customerCheckWarn);
        // 견줌: 확인 대상이 아니면 경고가 없고 빈 값
        const env2 = h.fresh({ role: 'SALES' });
        const d2 = draft(env2, '2511CL001', 'u_sales1', input);
        if (d2.why || !d2.rec) return '견줌: 기안되지 않음';
        if (d2.rec.customerCheckWarn !== '' || d2.dom.q('#customer-check').hidden !== true) return '견줌: 확인 대상이 아닌데 경고가 남음';
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검 W7 2차, icfr-05) 기안 화면(연장 검토, 계약 등록)만 막고 단추는 보이던 것을 두 겹으로 맞춤(REQ-ARC-02 "계약 상세의 버튼 규칙과 같게")
      name: '금액이 바뀌는 변경(2601CL001-A01)이 진행 중이면 계약 상세와 만료 예정에 연장 단추가 없고 변경 기안과 해지 기안은 그대로, -A01이 없으면 연장 검토 단추가 보임',
      kind: 'deny',
      run(h) {
        const busy = detailActions(h, '2601CL001');
        if (busy.why) return busy.why;
        if (/연장 검토|연장 기안/.test(busy.text)) return '추가 변경이 진행 중인데 계약 상세에 연장 단추가 보임: ' + busy.text;
        if (busy.text.indexOf('변경 기안') < 0 || busy.text.indexOf('해지 기안') < 0) return '계약 상세에서 변경 기안이나 해지 기안까지 사라짐: ' + busy.text;
        const ex = expiringLinks(h, '2601CL001');
        if (ex.why) return ex.why;
        if (ex.links.some(l => l.indexOf('renewal.html?origin=2601CL001') > -1 || l.indexOf('kind=RENEW&origin=2601CL001') > -1)) return '추가 변경이 진행 중인데 만료 예정에 연장 단추가 보임';
        if (!ex.links.some(l => l.indexOf('terminate.html?origin=2601CL001') > -1)) return '만료 예정에서 해지 기안까지 사라짐';
        // 견줌: -A01이 없으면 두 화면 모두 연장 검토 단추가 보임
        const free = detailActions(h, '2601CL001', NO_A01);
        if (free.why) return free.why;
        if (free.html.indexOf('renewal.html?origin=2601CL001') < 0) return '견줌: -A01을 빼도 계약 상세에 연장 검토 단추가 없음: ' + free.text;
        const ex2 = expiringLinks(h, '2601CL001', NO_A01);
        if (ex2.why) return ex2.why;
        if (!ex2.links.some(l => l.indexOf('renewal.html?origin=2601CL001') > -1)) return '견줌: -A01을 빼도 만료 예정에 연장 검토 단추가 없음';
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검 W7 2차) 보완 후 재기안에는 "조건을 바꿔 연장" 갈래가 없어, 없는 갈래를 고르라는 안내 대신 따로 안내(갈 길은 01, 06의 [남은 일])
      name: '반려된 그대로 연장(2512CL001-R01을 반려로 바꿈)을 다시 기안하려는데 지금 금액이 0원이면 기안되지 않고, 감춘 "조건을 바꿔 연장"을 고르라고 하지 않음',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES', hook: D => {
          const r = D.CONTRACTS.find(x => x.id === '2512CL001-R01');
          r.status = 'REJECTED';
          r.history = r.history.concat([{ step: 'S04', action: 'REJECT', at: '2026-10-17 10:00', comment: '시험 반려', actorId: 'u_legal', round: 1 }]);
          D.CONTRACTS.filter(x => x.id === '2512CL001' || x.id === '2512CL001-A01').forEach(x => { x.amount = 0; });
        } });
        const r = env.contract('2512CL001-R01');
        if (r.status !== 'REJECTED') return '시험 전제: 2512CL001-R01이 반려가 아님: ' + r.status;
        if (env.C.currentTerms('2512CL001').core !== 0) return '시험 전제: 2512CL001의 지금 금액이 0원이 아님: ' + env.C.currentTerms('2512CL001').core;
        const dom = page(env, 'renewal.js', '?id=2512CL001-R01', { user: env.U('u_sales1'), preset: KEEP });
        if (dom.error) return '연장 검토 보완 후 재기안을 열지 못함: ' + dom.error.message;
        const note = strip(dom.q('#notice').innerHTML);
        if (note.indexOf('이 연장을 그대로 다시 기안할 수 없습니다') < 0) return '보완 후 재기안의 0원 안내가 없음: ' + note.slice(0, 200);
        if (note.indexOf('"조건을 바꿔 연장"을 골라') > -1) return '감춘 갈래("조건을 바꿔 연장")를 고르라고 안내함';
        dom.q('#f-end').value = '2028-01-09';
        dom.q('#f-reason').value = OK_INPUT.reason;
        const n = env.D.CONTRACTS.length, round = r.round || 1;
        dom.submit();
        if (dom.q('#confirm-modal').hidden === false || env.D.CONTRACTS.length !== n || (r.round || 1) !== round) return '지금 금액 0원인데 보완 후 재기안이 기안됨';
        if (dom.errors().indexOf('이 연장을 그대로 다시 기안할 수 없습니다') < 0) return '기안 단추의 오류에 보완 후 재기안의 0원 안내가 없음: ' + strip(dom.errors()).slice(0, 160);
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검 W7 2차, icfr-08) c_common_probe2.js를 옮김. 묶음 값은 계약 완료된 원계약, 변경, 조건을 바꾼 연장 가운데 가장 늦게 계약 완료된 기록의 값
      name: '계약 완료된 조항만 변경으로 해지 통지 일수를 90일로 바꾸면 묶음 값, 통지 기한, 지금 유효한 조건이 90일을 따르고 결재 문서에 "바뀜"(2511CL001), 자동갱신을 더하면 묶음도 자동갱신(2604CL001)',
      kind: 'ok',
      run(h) {
        const env0 = h.fresh({ role: 'SUPER' });
        const b0 = env0.C.bundleOf('2511CL001');
        if (b0.autoRenew !== 'YES' || b0.noticeDays !== 60) return '시험 전제: 2511CL001이 자동갱신, 통지 60일이 아님: ' + b0.autoRenew + ' ' + b0.noticeDays;
        const env = h.fresh({ role: 'SUPER', hook: termsAmend('2511CL001', '2511CL001-A09', 'YES', 90) });
        const b = env.C.bundleOf('2511CL001');
        if (b.noticeDays !== 90 || b.autoRenew !== 'YES') return '묶음 통지 일수가 90일이 아님: ' + b.autoRenew + ' ' + b.noticeDays;
        if (env.C.noticeDate(b) !== env.C.addDays(b.end, -90)) return '통지 기한이 만료 90일 전이 아님: ' + env.C.noticeDate(b) + ' (예전 ' + env0.C.noticeDate(b0) + ')';
        const t = env.C.currentTerms('2511CL001');
        if (t.autoRenew !== 'YES' || t.noticeDays !== 90) return '지금 유효한 조건의 값이 90일이 아님: ' + t.autoRenew + ' ' + t.noticeDays;
        const html = lib.strip(env.C.currentTermsHtml(t, {}));
        if (!/자동갱신 있음, 만료 90일 전까지 해지 통지, 2511CL001-A09 변경\(조항만\)에서 정함/.test(html)) return '지금 유효한 조건 표 아래에 값을 정한 기록이 없음: ' + html.slice(-160);
        const rv = lib.review(env, '2511CL001-A09', 'u_sadmin');
        if (rv.error) return '결재 문서를 열지 못함: ' + rv.error.message;
        if (!/바뀜 변경 전: 있음\(만료 60일 전\)/.test(lib.strip(rv.dom.q('#basic').innerHTML))) return '결재 문서의 자동갱신 칸에 "바뀜 변경 전: 있음(만료 60일 전)"이 없음';
        const rv0 = lib.review(env0, '2511CL001', 'u_sadmin');
        if (lib.strip(rv0.dom.q('#basic').innerHTML).indexOf('바뀜') > -1) return '견줌: 원계약의 결재 문서에도 "바뀜"이 보임';
        const env2 = h.fresh({ role: 'SUPER', hook: termsAmend('2604CL001', '2604CL001-A09', 'YES', 30) });
        const b2 = env2.C.bundleOf('2604CL001');
        if (b2.autoRenew !== 'YES' || b2.noticeDays !== 30) return '조항만 변경으로 자동갱신을 더해도 묶음이 자동갱신이 아님: ' + b2.autoRenew + ' ' + b2.noticeDays;
        // 예시 데이터: 예전 규칙(지금 유효한 계약이나 원계약의 값. 기록에 없으면 다시 채울 값 form의 값)과 다른 묶음이 없음
        const av = c => c.autoRenew || (c.form && c.form.autoRenew) || '';
        const nd = c => Number(c.noticeDays || (c.form && c.form.noticeDays)) || null;
        const diff = env0.C.bundles().filter(x => (av(x.current) || av(x.root) || 'NO') !== x.autoRenew ||
          (x.autoRenew === 'YES' && x.noticeDays !== (nd(x.current) || nd(x.root)))).map(x => x.id);
        if (diff.length) return '예시 데이터에서 자동갱신이나 통지 일수가 바뀐 묶음이 있음: ' + diff.join(', ');
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검 W7 2차, icfr-08) 변경이 계약 완료되면 두 값이 묶음 값이 되므로, 고르다 틀린 값으로 바뀌지 않게 지금 값을 채움(비어 있을 때와 이 화면이 채운 값만)
      name: '계약 등록에서 변경의 원계약을 고르면 자동갱신과 해지 통지 일수가 묶음의 지금 값으로 채워지고(2511CL001 있음, 60일), 사람이 바꾼 값은 원계약을 바꿔도 덮지 않음',
      kind: 'ok',
      run(h) {
        const f = amendForm(h, '2511CL001', 'u_sales1');
        if (f.why) return f.why;
        let v = f.now();
        if (v.auto !== 'YES' || v.days !== '60' || v.hidden !== false) return '2511CL001을 골라도 있음, 60일로 채워지지 않음: ' + JSON.stringify(v);
        // 이 화면이 채운 값을 바꾸지 않은 채 원계약을 바꾸면 새 원계약 값으로(2511CL001 있음, 60일 → 2604CL001 없음)
        f.pick('2604CL001');
        v = f.now();
        if (f.env.C.bundleOf('2604CL001').autoRenew !== 'NO') return '시험 전제: 2604CL001이 자동갱신이 아님이 아님';
        if (v.auto !== 'NO' || v.days !== '' || v.hidden !== true) return '채운 값을 바꾸지 않았는데 원계약을 바꾸면 새 값(없음)으로 바뀌지 않음: ' + JSON.stringify(v);
        // 사람이 바꾼 값은 그대로
        const g = amendForm(h, '2511CL001', 'u_sales1');
        if (g.why) return g.why;
        g.dom.q('#f-notice-days').value = '90';
        g.pick('2604CL001');
        v = g.now();
        if (v.auto !== 'YES' || v.days !== '90') return '사람이 90일로 바꾼 값을 원계약을 바꾸며 덮어씀: ' + JSON.stringify(v);
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검 W7 2차, icfr-06) c_common_probe2.js를 옮김. 예시 데이터의 알림과 문장
      name: '분할 정산 청구 일정 알림은 기록마다: 예시 데이터에서는 2609CL004 원계약 기간만 알리고, 2512CL001-R01 그대로 연장이 계약 완료되면 둘째 해가 빠졌다고 알림',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SUPER' });
        const list = env.C.bundles().filter(b => env.C.billingGap(b)).map(b => b.id).join();
        if (list !== '2609CL004') return '예시 데이터의 알림 묶음이 2609CL004만이 아님: ' + list;
        const text = env.C.billingGapText(env.C.bundleOf('2609CL004'));
        if (!/2609CL004 원계약 기간\(2026-11-01~2027-10-31\)/.test(text)) return '알림 문장에 빠진 기록 번호와 기간이 없음: ' + text;
        const env2 = h.fresh({ role: 'SUPER', hook: r01Done });
        if (env2.contract('2512CL001-R01').status !== 'ACTIVE') return '시험 전제: 2512CL001-R01이 계약 완료가 아님';
        if (gapIds(env2, '2512CL001') !== '2512CL001-R01') return '그대로 연장의 둘째 해에 청구 일정이 없는데 알리지 않음: ' + env2.C.billingGapText(env2.C.bundleOf('2512CL001'));
        if (gapIds(env, '2512CL001') !== '') return '견줌: 연장 전(첫해 청구 일정 있음)에도 알림: ' + env.C.billingGapText(env.C.bundleOf('2512CL001'));
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검 W7 2차, icfr-06) 예전 규칙(묶음에 하나라도 있으면 끔, 가장 늦은 기록의 정산 방식)이 놓친 경우
      name: '분할 정산 알림이 꺼지지 않음: 일시 정산 추가 변경이 끝나도 분할 원계약(2609CL004)의 알림은 그대로, 분할 추가 변경(2512CL001)에 그 기간 청구 일정이 없으면 알림, 끝낸 되풀이 의무는 끝낸 날 뒤를 덮지 않음',
      kind: 'deny',
      run(h) {
        const a = h.fresh({ role: 'SUPER', hook: addAmend('2609CL004', '2609CL004-A01', 'LUMP', '2026-12-01', '2027-10-31', 1200000) });
        if (gapIds(a, '2609CL004') !== '2609CL004') return '일시 정산 추가 변경 뒤 원계약 알림이 꺼짐: ' + a.C.billingGapText(a.C.bundleOf('2609CL004'));
        const b = h.fresh({ role: 'SUPER', hook: addAmend('2512CL001', '2512CL001-A02', 'SPLIT', '2026-11-01', '2027-01-09', 3000000) });
        if (gapIds(b, '2512CL001') !== '2512CL001-A02') return '분할 추가 변경(2026-11-01~2027-01-09)에 청구 기한이 없는데 알리지 않음: ' + b.C.billingGapText(b.C.bundleOf('2512CL001'));
        const c = h.fresh({ role: 'SUPER', hook: D => {
          r01Done(D);
          D.OBLIGATIONS.push({ id: 'OB-T01', bundle: '2512CL001', kind: 'BILLING', title: '분기 청구', when: 'REPEAT', first: '2026-03-31', everyMonths: 3, by: 'u_sales1', at: '2026-01-05 10:00',
            records: [], endedAt: '2026-09-30 10:00', endedBy: 'u_finance', endReason: '시험' });
        } });
        if (gapIds(c, '2512CL001') !== '2512CL001-R01') return '끝낸 되풀이 청구 의무가 끝낸 날 뒤(둘째 해)를 덮어 알리지 않음: ' + c.C.billingGapText(c.C.bundleOf('2512CL001'));
        return true;
      },
    },
  ],
  serverOnly: [
    '요청 본문의 금액을 바꿔 보냄: 시안은 금액 칸이 없고 화면이 지금 유효한 조건의 금액(currentTerms)을 넣지만, 요청을 직접 보내면 그대로 저장되므로 서버가 지금 금액으로 다시 채워야 함',
    '시작일, 종료일, 이유(연장 검토)와 바꿔서 연장의 시작일(계약 등록, CTL-20)을 요청마다 서버가 다시 검사함: 시안은 기안 단추를 누를 때 화면에서만 검사하고 확인 창의 기안은 다시 검사하지 않음',
    '지금 유효한 계약을 바꾸는 일은 ⑩ 저장과 한 처리: 시안은 화면을 열 때마다 결재 기록으로 다시 셈(bundleOf)할 뿐 한 처리(트랜잭션)가 없음',
    '(2026-11-14 주말 점검 W7) 금액이 바뀌는 변경(추가, 줄임)과 연장이 함께 진행 중인지(겹침)를 서버가 기안을 받을 때 다시 봄: 시안은 화면을 열 때와 기안 단추에서만 봐서 두 사람이 같은 때 기안하면 둘 다 들어갈 수 있음',
    '(2026-11-14 주말 점검 W7) 그대로 연장 금액이 0원 이하이면 서버가 지금 유효한 조건으로 다시 셈해 거절(요청 본문의 금액을 쓰지 않음)',
    '(2026-11-14 주말 점검 W7) 거래처 확인 경고 문장(customerCheckWarn)은 서버가 기안 때 거래처 확인 상태로 다시 만들어 남김: 시안은 화면이 만든 문장을 그대로 저장',
  ],
};
// 2026-11-16 기획자 결정 반영 시험(작업기록/2026-11-16/반영목록.md, tools/control_tests/n16.js)
module.exports.tests = module.exports.tests.concat(require('./n16')('AC-34'));
