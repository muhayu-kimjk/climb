// AC-31 ⑥~⑩ 순서와 상태 (CTL-57, 06 통제 목록 2장) 시험 (2026-11-13 주말 점검 W2)
//   결재 문서(review.js)에서 ⑥부터 ⑩까지 차례로 눌러 보고, 상태가 결재 기록을 다시 적용한 결과와 같은지 봄(도우미는 lib.js)
'use strict';
const { doStep, review } = require('./lib');

const pend = c => (c.approvals || []).filter(a => a.state === 'PENDING').map(a => a.step);
const st = (c, step) => (c.approvals || []).find(a => a.step === step) || {};
// 결재 기록을 처음부터 다시 적용한 상태: 지금까지 남긴 시연 기록(저장소)만 가지고 새로 연 시안에서 그 계약의 상태와 완료 일시
function replay(h, env, id) {
  const x = h.fresh({ role: 'SUPER', store: env.store }).contract(id);
  return { status: x.status, completedAt: x.completedAt };
}

module.exports = {
  ac: 'AC-31',
  title: '⑥~⑩ 순서와 상태',
  tests: [
    {
      name: '⑥~⑩을 차례로 처리하면 체결 대기, 운영 검토, 계약 완료로 바뀌고 완료 일시는 ⑩ 처리 일시(2610CL004)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SUPER' });
        const c = env.contract('2610CL004');
        const steps = [['S06', 'u_ga', 'APPROVED', 'S07'], ['S07', 'u_sales1', 'APPROVED', 'S08'], ['S08', 'u_sadmin', 'OPS_REVIEW', 'S09'],
          ['S09', 'u_cem', 'OPS_REVIEW', 'S10'], ['S10', 'u_finance', 'ACTIVE', '']];
        let last = null;
        for (const [step, who, want, next] of steps) {
          const r = doStep(env, '2610CL004', step, who, { date: env.C.addDays(env.D.TODAY, -1) });
          if (!r.ok) return r.why;
          last = r.entry;
          if (c.status !== want) return step + ' 뒤 상태가 ' + want + '가 아님: ' + c.status;
          if (pend(c).join(',') !== next) return step + ' 뒤 차례가 ' + (next || '없음') + '이 아님: ' + pend(c).join(',');
          const rs = replay(h, env, '2610CL004');
          if (rs.status !== c.status) return step + ' 뒤 저장된 상태(' + c.status + ')와 기록을 다시 적용한 상태(' + rs.status + ')가 다름';
        }
        if (c.completedAt !== last.at) return '완료 일시가 ⑩ 처리 일시가 아님: ' + c.completedAt + ' / ' + last.at;
        if (replay(h, env, '2610CL004').completedAt !== last.at) return '기록을 다시 적용하면 완료 일시가 ⑩ 처리 일시가 아님';
        return true;
      },
    },
    {
      name: '⑧ 확인 전에는 ⑨를 처리할 수 없음(2609CL003, ⑧ 차례)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'CEM' });
        const c = env.contract('2609CL003');
        if (st(c, 'S09').state !== 'WAITING') return '시험 전제: ⑨가 대기가 아님';
        if (['u_cem', 'u_super'].some(p => env.C.canAct(c, st(c, 'S09'), env.U(p)))) return '⑧ 확인 전인데 ⑨를 처리할 수 있음';
        return true;
      },
    },
    {
      name: '⑨를 건너뛰고 ⑩을 처리할 수 없음(2609CL004, ⑨ 차례)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'FINANCE' });
        const c = env.contract('2609CL004');
        if (st(c, 'S10').state !== 'WAITING') return '시험 전제: ⑩이 대기가 아님';
        if (['u_finance', 'u_super'].some(p => env.C.canAct(c, st(c, 'S10'), env.U(p)))) return '⑨ 전에 ⑩을 처리할 수 있음';
        return true;
      },
    },
    {
      name: '상태를 계약 완료로 바로 바꿔도 결재 기록대로 다시 계산됨(관리자 포함)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'ADMIN' });
        const { C } = env;
        const c = env.contract('2609CL004');
        // 계약 기록의 상태만 계약 완료로 바꿔 저장해 봄(시안에서 계약 기록을 저장하는 길은 saveDemoContract 하나)
        c.status = 'ACTIVE';
        C.saveDemoContract(c);
        if (c.status !== 'OPS_REVIEW') return '상태를 계약 완료로 바꾼 것이 그대로 남음: ' + c.status;
        if (c.completedAt) return '⑩ 없이 완료 일시가 생김: ' + c.completedAt;
        const again = h.fresh({ role: 'ADMIN', store: env.store }).contract('2609CL004');
        if (again.status !== 'OPS_REVIEW') return '다시 열면 꾸민 상태가 보임: ' + again.status;
        const fn = Object.keys(C).filter(k => /^set(Status|State)|forceStatus|changeStatus/i.test(k));
        if (fn.length) return '상태를 바로 바꾸는 공통 기능이 있음: ' + fn.join(',');
        return true;
      },
    },
    {
      name: '반려 상태 계약에는 ⑥~⑩을 처리할 수 없음(⑥까지 온 2609CL003을 ⑧에서, 2610CL004를 ⑥에서 반려, ④에서 반려된 2610CL001)',
      kind: 'deny',
      run(h) {
        // 2026-11-13 보강(점검 지적): 2610CL001은 ④에서 반려되어 ⑥이 처음부터 대기라, 막힌 까닭이 "반려 상태"가 아니라 "차례가 아님"이었음.
        //   그래서 ⑥까지 온 계약을 반려 상태로 만든 뒤 ⑥~⑩ 누구도(최고관리자 포함) 처리할 수 없고 처리 단추도 없는지 보고,
        //   반려 상태 검사만 따로 보려고 ⑥을 "차례(PENDING)"라고 적은 같은 단계(요청에 담아 보낸 것과 같음)를 반려 전후로 견줌
        const P = ['u_ga', 'u_sales1', 'u_sadmin', 'u_cem', 'u_finance', 'u_super'];
        const S = ['S06', 'S07', 'S08', 'S09', 'S10'];
        const blocked = (env, c, id) => {
          const can = [];
          S.forEach(s => P.forEach(p => { if (env.C.canAct(c, st(c, s), env.U(p))) can.push(s + ' ' + p); }));
          if (can.length) return '반려된 ' + id + '의 ⑥~⑩을 처리할 수 있음: ' + can.join(', ');
          const btn = P.filter(p => /data-open="[A-Z]+" data-step="S(06|07|08|09|10)"/.test(review(env, id, p).bar()));
          if (btn.length) return '반려된 ' + id + '의 결재 문서에 ⑥~⑩ 처리 단추가 보임: ' + btn.join(', ');
          return '';
        };
        const asPending = c => Object.assign({}, st(c, 'S06'), { state: 'PENDING' });
        // (1) 2609CL003: ⑥, ⑦이 끝나고 ⑧ 차례. ⑧에서 반려
        {
          const env = h.fresh({ role: 'SALES_ADMIN' });
          const c = env.contract('2609CL003');
          if (st(c, 'S06').state !== 'DONE' || st(c, 'S08').state !== 'PENDING') return '시험 전제: 2609CL003이 ⑥ 끝, ⑧ 차례가 아님';
          if (!env.C.canAct(c, asPending(c), env.U('u_ga'))) return '견줌: 반려 전(체결 대기)에는 차례라고 적은 ⑥을 총무가 처리할 수 있어야 함';
          review(env, '2609CL003', 'u_sadmin').open('REJECT', 'S08').pick('PERIOD').comment('기간이 다름').confirm();
          if (c.status !== 'REJECTED') return '시험 전제: 2609CL003 ⑧ 반려가 되지 않음: ' + c.status;
          const w = blocked(env, c, '2609CL003');
          if (w) return w;
          if (['u_ga', 'u_super'].some(p => env.C.canAct(c, asPending(c), env.U(p)))) return '반려 상태인데 차례라고 적은 ⑥ 요청을 처리할 수 있음(2609CL003)';
        }
        // (2) 2610CL004: ⑥ 차례에서 총무가 반려
        {
          const env = h.fresh({ role: 'GA' });
          const c = env.contract('2610CL004');
          if (st(c, 'S06').state !== 'PENDING') return '시험 전제: 2610CL004가 ⑥ 차례가 아님';
          if (!env.C.canAct(c, asPending(c), env.U('u_ga'))) return '견줌: 반려 전에는 총무가 ⑥을 처리할 수 있어야 함(2610CL004)';
          review(env, '2610CL004', 'u_ga').open('REJECT', 'S06').comment('계약 금액이 결재한 판과 다름').confirm();
          if (c.status !== 'REJECTED') return '시험 전제: 2610CL004 ⑥ 반려가 되지 않음: ' + c.status;
          const w = blocked(env, c, '2610CL004');
          if (w) return w;
          if (['u_ga', 'u_super'].some(p => env.C.canAct(c, asPending(c), env.U(p)))) return '반려 상태인데 차례라고 적은 ⑥ 요청을 처리할 수 있음(2610CL004)';
        }
        // (3) 예시 데이터의 반려 계약 2610CL001(④ 반려, ⑥은 대기)
        {
          const env = h.fresh({ role: 'GA' });
          const c = env.contract('2610CL001');
          if (c.status !== 'REJECTED') return '시험 전제: 2610CL001이 반려가 아님';
          if (['u_ga', 'u_super'].some(p => env.C.canAct(c, st(c, 'S06'), env.U(p)))) return '반려된 계약의 ⑥을 처리할 수 있음';
          if (['u_ga', 'u_super'].some(p => env.C.canAct(c, asPending(c), env.U(p)))) return '반려 상태인데 차례라고 적은 ⑥ 요청을 처리할 수 있음(2610CL001)';
        }
        return true;
      },
    },
    {
      name: '신규 계약의 ⑥~⑧을 생략으로 바꿔도 다시 거치는 단계로 계산됨',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SUPER' });
        const { C } = env;
        const c = env.contract('2610CL004');
        if (['S06', 'S07', 'S08'].some(s => st(c, s).state === 'SKIPPED')) return '신규 계약인데 ⑥~⑧ 가운데 생략이 있음';
        c.approvals.forEach(a => { if (['S06', 'S07', 'S08'].indexOf(a.step) > -1) { a.state = 'SKIPPED'; a.reason = '꾸민 생략'; } });
        C.saveDemoContract(c);
        if (['S06', 'S07', 'S08'].some(s => st(c, s).state === 'SKIPPED')) return '꾸민 생략이 그대로 남음';
        if (pend(c).join(',') !== 'S06') return '다시 계산해도 ⑥이 차례가 아님: ' + pend(c).join(',');
        return true;
      },
    },
  ],
  serverOnly: [
    '03 10장 상태 전이표에 없는 바뀜(상태를 계약 완료로 바로 바꾸는 요청 등)을 서버가 받지 않고, 저장 상태와 기록을 다시 계산한 결과가 다르면 처리하지 않고 예외로 남김(시안은 화면을 열 때마다 기록으로 다시 계산할 뿐 예외를 남기지 않음)',
    '⑧ 전 ⑨, ⑨ 없이 ⑩, 반려 계약의 ⑥, 신규 계약의 ⑥~⑧ 생략을 요청으로 직접 보내는 것: 시안 recordAction은 차례를 다시 검사하지 않아 서버가 막아야 함',
  ],
};
