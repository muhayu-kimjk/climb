// AC-32 ⑩ 재무 확인 (CTL-61, 06 통제 목록 2장) 시험 (2026-11-13 주말 점검 W2)
//   결재 문서(review.js)의 ⑩ 창과 처리 판단(canAct, canView)을 봄(도우미는 lib.js)
'use strict';
const { review } = require('./lib');

const st = (c, step) => (c.approvals || []).find(a => a.step === step) || {};

module.exports = {
  ac: 'AC-32',
  title: '⑩ 재무 확인',
  tests: [
    {
      name: '4번이 예인 열람 제한 계약을 재무 담당자가 열어 비고를 보고 재무 확인 완료하면 계약 완료와 완료 일시(2609CL001을 열람 제한으로)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'FINANCE', hook: D => { D.CONTRACTS.find(x => x.id === '2609CL001').restricted = true; } });
        const c = env.contract('2609CL001');
        if (!c.restricted || c.checklist.accounting !== 'YES') return '시험 전제(열람 제한, 4번 예)가 맞지 않음';
        if (!env.C.canView(c, env.U('u_finance'))) return '재무 담당자가 4번이 예인 열람 제한 계약을 볼 수 없음';
        const rv = review(env, '2609CL001', 'u_finance');
        if (!rv.hasButton('APPROVE', 'S10')) return '⑩ 담당 재무에게 재무 확인 완료 단추가 없음';
        rv.open('APPROVE', 'S10');
        if (rv.desc().indexOf('체크리스트 4번 회계 영향 조건') < 0 || rv.desc().indexOf(c.checklist.accountingNote) < 0) return '⑩ 창에 4번 비고가 보이지 않음: ' + rv.desc();
        rv.comment('').confirm(); // 메모는 선택(기획자 결정)
        const e = c.history[c.history.length - 1];
        if (!e || e.step !== 'S10') return '메모 없이 재무 확인 완료가 남지 않음';
        if (c.status !== 'ACTIVE') return '재무 확인 뒤 계약 완료가 아님: ' + c.status;
        if (c.completedAt !== e.at) return '완료 일시가 ⑩ 일시가 아님: ' + c.completedAt;
        return true;
      },
    },
    {
      // 06 AC-32 기대 동작 "처리하면 계약 완료(해지 기안이면 원계약 해지)가 된다. 확인 창에 4번 비고나 환불과 위약금이 보인다" (2026-11-13 더함)
      name: '해지 기안의 ⑩ 창에 환불과 위약금이 보이고, 처리하면 원계약이 해지(2602CL001-T01, ⑨를 마친 뒤)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'FINANCE' });
        const t = env.contract('2602CL001-T01'), root = env.contract('2602CL001');
        const cem = review(env, '2602CL001-T01', st(t, 'S09').userId);
        if (!cem.hasButton('APPROVE', 'S09')) return '시험 전제: ⑨ 단추가 없음';
        cem.open('APPROVE', 'S09').checkAll();
        if (cem.dom.ids.has('#act-date')) cem.date(env.D.TODAY);
        cem.comment('운영 종료').confirm();
        if (st(t, 'S10').state !== 'PENDING') return '시험 전제: ⑨ 뒤 ⑩이 차례가 아님';
        const rv = review(env, '2602CL001-T01', st(t, 'S10').userId);
        if (!rv.hasButton('APPROVE', 'S10')) return '⑩ 담당 재무에게 재무 확인 완료 단추가 없음';
        rv.open('APPROVE', 'S10');
        // 2026-11-16 결정 5: 환불 금액, 위약금, 환불받는 곳을 나눠 받아 "환불 0원, 위약금 0원. 메모" 꼴(C.refundText)
        if (rv.desc().indexOf('환불과 위약금: ' + env.C.refundText(t)) < 0 || rv.desc().indexOf(t.refundNote) < 0) return '⑩ 창에 환불과 위약금이 보이지 않음: ' + rv.desc();
        // 2026-11-16 결정 5: 해지의 ⑩에는 서류와 맞춰 본 항목(환불 금액과 위약금, 환불받는 곳)이 있음. 고르지 않으면 저장되지 않음
        rv.comment('').confirm();
        if (t.status === 'TERMINATED') return '해지 ⑩ 확인 항목을 고르지 않았는데 저장됨';
        rv.checkAll();
        rv.comment('').confirm();
        if (t.status !== 'TERMINATED' || root.status !== 'TERMINATED') return '⑩ 뒤 원계약이 해지가 아님: ' + t.status + ' / ' + root.status;
        return true;
      },
    },
    {
      name: '재무 리더와 재무 임원은 ⑩을 처리할 수 없음(보기만 하는 역할)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'FIN_LEAD' });
        const c = env.contract('2609CL001');
        if (st(c, 'S10').state !== 'PENDING') return '시험 전제: ⑩이 차례가 아님';
        const who = ['u_seojin_ma', 'u_jaewon_kook'].filter(p => env.C.canAct(c, st(c, 'S10'), env.U(p)));
        if (who.length) return '⑩을 처리할 수 있는 리더나 임원: ' + who.join(', ');
        if (['u_seojin_ma', 'u_jaewon_kook'].some(p => review(env, '2609CL001', p).hasButton('APPROVE', 'S10'))) return '리더나 임원 결재 문서에 재무 확인 완료 단추가 보임';
        return true;
      },
    },
    {
      name: '⑨ 전에는 ⑩을 처리할 수 없음(2609CL004)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'FINANCE' });
        const c = env.contract('2609CL004');
        if (st(c, 'S09').state !== 'PENDING') return '시험 전제: ⑨가 차례가 아님';
        if (['u_finance', 'u_super'].some(p => env.C.canAct(c, st(c, 'S10'), env.U(p)))) return '⑨ 전에 ⑩을 처리할 수 있음';
        return true;
      },
    },
    {
      // 2610CL007은 지정 열람자에 재무 리더가 속한 "재무기획유닛"이 있어 그대로는 "지정된" 재무 리더임. 그 지정을 뺀 경우로 봄(2026-11-13 시험 고침)
      name: '4번이 아니요인 열람 제한 계약은 지정되지 않은 재무 리더가 열 수 없음(2511CL002, 재무기획유닛 지정을 뺀 2610CL007)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'FIN_LEAD', hook: D => { const x = D.CONTRACTS.find(k => k.id === '2610CL007'); x.viewers = (x.viewers || []).filter(v => v.dept !== '재무기획유닛'); } });
        const lead = env.U('u_seojin_ma');
        for (const id of ['2511CL002', '2610CL007']) {
          const c = env.contract(id);
          if (!c.restricted || (c.checklist || {}).accounting !== 'NO') return '시험 전제: ' + id + '가 4번 아니요인 열람 제한 계약이 아님';
          const named = env.C.viewersOf(c).some(v => env.C.viewerState(v) === 'ON' && (v.kind === 'DEPT' ? v.dept === lead.dept : v.userId === lead.id));
          if (named) return '시험 전제: 재무 리더가 ' + id + '의 지정 열람자임';
          if (env.C.canView(c, lead)) return '지정되지 않은 재무 리더가 ' + id + '를 볼 수 있음';
          const rv = review(env, id, lead);
          if (String(rv.dom.q('#notice').innerHTML).indexOf('이 계약은 볼 수 없습니다') < 0) return id + ' 결재 문서가 "볼 수 없습니다"를 보이지 않음';
        }
        return true;
      },
    },
    {
      name: '이미 끝난 ⑩을 다시 처리할 수 없음(2511CL001, 2609CL001을 끝낸 뒤)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'FINANCE' });
        const done = env.contract('2511CL001');
        if (st(done, 'S10').state !== 'DONE') return '시험 전제: 2511CL001의 ⑩이 끝나지 않음';
        if (['u_finance', 'u_super'].some(p => env.C.canAct(done, st(done, 'S10'), env.U(p)))) return '끝난 ⑩을 다시 처리할 수 있음(2511CL001)';
        const c = env.contract('2609CL001');
        review(env, '2609CL001', 'u_finance').open('APPROVE', 'S10').confirm();
        if (c.status !== 'ACTIVE') return '2609CL001의 ⑩을 끝내지 못해 시험할 수 없음';
        if (review(env, '2609CL001', 'u_finance').hasButton('APPROVE', 'S10')) return '끝낸 ⑩에 재무 확인 완료 단추가 다시 보임';
        return true;
      },
    },
    {
      name: '운영 변경 HR 충전의 ⑨를 처리한 재무 담당자는 같은 계약의 ⑩을 처리할 수 없고 ⑩은 다른 재무 담당자 차례(2512CL001-C01)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'FINANCE' });
        const c = env.contract('2512CL001-C01');
        const s9 = st(c, 'S09'), s10 = st(c, 'S10');
        if (s9.state !== 'DONE' || s10.state !== 'PENDING') return '시험 전제: ⑨ 끝남, ⑩ 차례가 아님';
        if (env.C.canAct(c, s10, env.U(s9.decidedBy))) return '⑨를 한 ' + s9.decidedBy + '가 ⑩도 처리할 수 있음';
        if (s10.userId === s9.decidedBy) return '⑩이 ⑨를 한 사람에게 감';
        if (s10.userId !== 'u_yejun_pyo') return '⑩이 다른 재무 담당자(표예준, u_yejun_pyo)가 아님: ' + s10.userId;
        return true;
      },
    },
    {
      name: '재무 리더는 운영 변경 HR 충전의 ⑩을 처리할 수 없음(2512CL001-C01)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'FIN_LEAD' });
        const c = env.contract('2512CL001-C01');
        if (env.C.canAct(c, st(c, 'S10'), env.U('u_seojin_ma'))) return '재무 리더가 HR 충전의 ⑩을 처리할 수 있음';
        if (review(env, '2512CL001-C01', 'u_seojin_ma').hasButton('APPROVE', 'S10')) return '재무 리더 결재 문서에 재무 확인 완료 단추가 보임';
        return true;
      },
    },
  ],
  serverOnly: [
    '차례, 담당자, 열람 권한을 요청마다 서버가 확인함(시안 recordAction은 다시 검사하지 않고, 화면은 단추와 내용을 가릴 뿐임)',
    '메모는 선택(기획자 결정)이라 재무가 무엇을 확인했는지는 결재 기록에 남지 않음: 시험할 동작이 아님',
    'HR 충전의 ⑩을 서버가 ⑨를 한 사람이 아닌 사용 중인 재무 담당자에게 보냄. 그런 사람이 없을 때의 처리는 [가정](재무와 확인)이라 시험하지 않음',
  ],
};
// 2026-11-16 기획자 결정 반영 시험(작업기록/2026-11-16/반영목록.md, tools/control_tests/n16.js)
module.exports.tests = module.exports.tests.concat(require('./n16')('AC-32'));
