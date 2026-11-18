// AC-33 해지와 원계약 해지 (CTL-67, 06 통제 목록 2장) 시험 (2026-11-13 주말 점검 W2)
//   해지 기안 화면(terminate.js)과 결재 문서(review.js)를 가짜 문서에 올려 기안하고 ③, ④, ⑨, ⑩을 눌러 봄(도우미는 lib.js)
'use strict';
const { page, review, doStep } = require('./lib');

const st = (c, step) => (c.approvals || []).find(a => a.step === step) || {};
const SKIP = ['S02', 'S05', 'S06', 'S07', 'S08']; // 해지 기안이 거치지 않는 단계(②, ⑤ [가정], ⑥~⑧ C-18 재무 상의 중)
const GO = ['S03', 'S04', 'S09', 'S10'];

// 영업대표가 해지 기안 화면에서 해지일과 사유를 넣고 기안 단추, 확인 창의 기안을 누름. 돌려주는 값 { dom, rec(새 해지 기안) }
function draft(env, origin, who, date, reason) {
  const dom = page(env, 'terminate.js', '?origin=' + origin, { user: env.U(who) });
  if (dom.error) return { dom, why: '해지 기안 화면을 열지 못함: ' + dom.error.message };
  if (dom.q('#form').hidden) return { dom, why: '해지 기안 화면이 막힘: ' + String(dom.q('#notice').innerHTML).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 120) };
  dom.q('#f-date').value = date;
  dom.q('#f-reason').value = reason;
  const n = env.D.CONTRACTS.length;
  dom.submit();
  if (dom.q('#confirm-modal').hidden !== false) return { dom, why: '', blocked: true };
  dom.confirmClick();
  const rec = env.D.CONTRACTS.length > n ? env.D.CONTRACTS[env.D.CONTRACTS.length - 1] : null;
  return { dom, rec, why: rec ? '' : '확인 창의 기안을 눌러도 해지 기안이 남지 않음' };
}
// 차례인 단계를 그 담당자로 차례대로 처리. 돌려주는 값 { ok, last(마지막 결재 기록), why }
function run(env, id, steps, each) {
  let last = null;
  for (const s of steps) {
    const c = env.contract(id);
    const who = st(c, s).userId;
    const r = doStep(env, id, s, who);
    if (!r.ok) return { ok: false, why: r.why };
    last = r.entry;
    if (each) { const w = each(s, c); if (w) return { ok: false, why: w }; }
  }
  return { ok: true, last };
}
const inExpiring = (env, id) => env.C.expiringBundles(env.D.ALERT_RULES.expiryWindowDays, true).some(b => b.id === id);

module.exports = {
  ac: 'AC-33',
  title: '해지와 원계약 해지',
  tests: [
    {
      name: '해지 기안은 ③, ④, ⑨, ⑩만 거치고 ②, ⑤, ⑥~⑧은 생략(2602CL001-T01과 새로 기안한 2511CL001-T01)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const d = draft(env, '2511CL001', 'u_sales1', '2026-10-31', '고객이 다른 서비스로 옮겨 합의 해지');
        if (d.why || d.blocked) return d.why || '해지 기안이 막힘: ' + d.dom.errors();
        if (d.rec.id !== '2511CL001-T01') return '해지 번호가 -T01이 아님: ' + d.rec.id;
        for (const id of ['2602CL001-T01', '2511CL001-T01']) {
          const c = env.contract(id);
          const bad = SKIP.filter(s => st(c, s).state !== 'SKIPPED').concat(GO.filter(s => st(c, s).state === 'SKIPPED'));
          if (bad.length) return id + ' 결재선이 ③, ④, ⑨, ⑩이 아님: ' + c.approvals.map(a => a.step + ' ' + a.state).join(', ');
        }
        if (st(env.contract('2511CL001-T01'), 'S03').state !== 'PENDING') return '새 해지 기안이 ③부터 시작하지 않음';
        return true;
      },
    },
    {
      name: '-T01이 ⑩까지 마치면 원계약이 해지, 해지 일시는 ⑩ 처리 일시(2602CL001-T01)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SUPER' });
        const t = env.contract('2602CL001-T01'), root = env.contract('2602CL001');
        if (st(t, 'S09').state !== 'PENDING' || root.status !== 'ACTIVE') return '시험 전제: ⑨ 차례, 원계약 계약 완료가 아님';
        const r = run(env, '2602CL001-T01', ['S09', 'S10']);
        if (!r.ok) return r.why;
        if (t.status !== 'TERMINATED') return '해지 기안이 끝나지 않음: ' + t.status;
        if (root.status !== 'TERMINATED') return '⑩ 뒤 원계약이 해지가 아님: ' + root.status;
        if (root.terminatedAt !== r.last.at) return '원계약 해지 일시가 ⑩ 처리 일시가 아님: ' + root.terminatedAt + ' / ' + r.last.at;
        if (root.terminateDate !== t.terminateDate) return '원계약에 해지일이 남지 않음';
        // 다시 열어도(결재 기록만으로 다시 셈) 같음
        const again = h.fresh({ role: 'SUPER', store: env.store }).contract('2602CL001');
        if (again.status !== 'TERMINATED' || again.terminatedAt !== r.last.at) return '다시 열면 원계약 해지와 해지 일시가 다름: ' + again.status + ' ' + again.terminatedAt;
        return true;
      },
    },
    {
      name: '만료 예정인 2511CL001에 해지를 기안해 ⑩까지 마치면 만료 예정에서 빠짐',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        if (!inExpiring(env, '2511CL001')) return '시험 전제: 2511CL001이 만료 예정에 없음';
        const d = draft(env, '2511CL001', 'u_sales1', '2026-10-31', '고객 예산 삭감으로 합의 해지');
        if (d.why || d.blocked) return d.why || '해지 기안이 막힘';
        const r = run(env, d.rec.id, GO, (s) => (s !== 'S10' && !inExpiring(env, '2511CL001') ? s + ' 뒤(⑩ 전)에 벌써 만료 예정에서 빠짐' : ''));
        if (!r.ok) return r.why;
        if (env.contract('2511CL001').status !== 'TERMINATED') return '⑩ 뒤 원계약이 해지가 아님';
        if (inExpiring(env, '2511CL001')) return '해지가 끝났는데 만료 예정에 남음';
        return true;
      },
    },
    {
      name: '달마다 SLA 보고 의무가 있는 2604CL001을 해지하면 되풀이 의무 기한이 해지일까지만 생김',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const { C, D } = env;
        const ob = D.OBLIGATIONS.find(o => o.id === 'OB-0001');
        if (!ob || ob.bundle !== '2604CL001' || ob.when !== 'REPEAT' || ob.everyMonths !== 1) return '시험 전제: 2604CL001의 달마다 SLA 보고 의무가 없음';
        const before = C.obligationDues(ob);
        if (!before.some(d => d > '2026-12-20')) return '시험 전제: 해지 전 기한이 해지일 뒤까지 있지 않음';
        const d = draft(env, '2604CL001', 'u_sales1', '2026-12-20', '병원 정보화 사업 종료로 합의 해지');
        if (d.why || d.blocked) return d.why || '해지 기안이 막힘';
        const r = run(env, d.rec.id, GO, (s) => (s !== 'S10' && C.obligationDues(ob).join() !== before.join() ? s + ' 뒤(⑩ 전)에 벌써 의무 기한이 줄어듦' : ''));
        if (!r.ok) return r.why;
        const after = C.obligationDues(ob);
        if (after.some(x => x > '2026-12-20')) return '해지일(2026-12-20) 뒤 기한이 남음: ' + after.filter(x => x > '2026-12-20').join(', ');
        if (after[after.length - 1] !== '2026-12-05') return '해지일 전 마지막 기한(2026-12-05)까지 생기지 않음: ' + after.slice(-2).join(', ');
        return true;
      },
    },
    {
      name: '⑩ 전에는 원계약이 해지로 보이지 않음(2602CL001-T01, ⑨를 마친 뒤)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'CEM' });
        const root = env.contract('2602CL001');
        const r = run(env, '2602CL001-T01', ['S09']);
        if (!r.ok) return r.why;
        if (root.status !== 'ACTIVE' || root.terminatedAt) return '⑩ 전인데 원계약이 해지로 보임: ' + root.status + ' ' + (root.terminatedAt || '');
        if (env.C.bundleOf('2602CL001').status !== 'ACTIVE') return '⑩ 전인데 계약 묶음이 해지로 보임';
        const again = h.fresh({ role: 'CEM', store: env.store }).contract('2602CL001');
        if (again.status !== 'ACTIVE') return '다시 열면 ⑩ 전인데 원계약이 해지로 보임';
        return true;
      },
    },
    {
      name: '화면의 날짜 제한을 넘겨 해지일을 어제나 종료일 뒤로 넣으면 기안되지 않음(2511CL001)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const { C, D } = env;
        const b = C.bundleOf('2511CL001');
        for (const day of [C.addDays(D.TODAY, -1), C.addDays(b.end, 1)]) {
          const n = D.CONTRACTS.length;
          const d = draft(env, '2511CL001', 'u_sales1', day, '시험 해지');
          if (!d.blocked || D.CONTRACTS.length !== n) return '해지일 ' + day + '로 기안됨(오늘부터 종료일 ' + b.end + ' 사이가 아님)';
          if (d.dom.errors().indexOf('해지일은 오늘부터 계약 종료일 사이여야 합니다') < 0) return '해지일 ' + day + '에 날짜 오류 안내가 없음';
        }
        // 그 사이의 날은 됨(막힌 까닭이 날짜인지 확인)
        const ok = draft(env, '2511CL001', 'u_sales1', D.TODAY, '시험 해지');
        if (ok.blocked || !ok.rec) return '오늘을 해지일로도 기안되지 않음(시험 전제가 맞지 않음)';
        return true;
      },
    },
    {
      name: '해지 사유 없이 기안되지 않음(2511CL001)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const n = env.D.CONTRACTS.length;
        const d = draft(env, '2511CL001', 'u_sales1', '2026-10-31', '   ');
        if (!d.blocked || env.D.CONTRACTS.length !== n) return '해지 사유 없이 기안됨';
        if (d.dom.errors().indexOf('해지 사유를 적으세요') < 0) return '해지 사유 오류 안내가 없음';
        return true;
      },
    },
    {
      name: '해지 기안의 ②, ⑤, ⑥~⑧은 누구도 처리할 수 없음(생략 단계)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SUPER' });
        const { C } = env;
        const d = draft(env, '2511CL001', 'u_sales1', '2026-10-31', '시험 해지');
        if (d.why || d.blocked) return d.why || '해지 기안이 막힘';
        const people = ['u_sadmin', 'u_privacy', 'u_ga', 'u_sales1', 'u_sales2', 'u_finance', 'u_super'];
        const can = [];
        for (const id of ['2602CL001-T01', '2511CL001-T01']) {
          const c = env.contract(id);
          SKIP.forEach(s => people.forEach(p => { if (C.canAct(c, st(c, s), env.U(p))) can.push(id + ' ' + s + ' ' + p); }));
          const bar = review(env, id, 'u_super').bar();
          SKIP.forEach(s => { if (bar.indexOf('data-step="' + s + '"') > -1) can.push(id + ' 결재 문서에 ' + s + ' 단추'); });
        }
        if (can.length) return '생략 단계를 처리할 수 있음: ' + can.join(', ');
        return true;
      },
    },
  ],
  serverOnly: [
    '화면을 건너뛰고 해지일(어제, 종료일 뒤)이나 빈 사유를 요청으로 직접 보냄: 시안은 기안 단추에서만 검사하고 확인 창의 기안은 다시 검사하지 않고 저장하므로 서버가 해지일과 사유를 검사해야 함',
    '해지 기안의 ②, ⑤, ⑥~⑧ 처리를 요청으로 직접 보냄: 시안 recordAction은 단계가 생략인지 다시 검사하지 않아 서버가 거절해야 함(C-18이 정해지면 ⑥~⑧ 줄을 다시 정함)',
    '원계약 해지는 ⑩ 저장과 한 처리: 원계약 상태를 바꾸다 오류가 나면 해지 기안의 ⑩도 되돌림. 시안은 화면을 열 때마다 결재 기록으로 다시 셈(applyBundleEffects)할 뿐 한 처리(트랜잭션)가 없어 시험할 수 없음',
  ],
};
// 2026-11-16 기획자 결정 반영 시험(작업기록/2026-11-16/반영목록.md, tools/control_tests/n16.js)
module.exports.tests = module.exports.tests.concat(require('./n16')('AC-33'));
