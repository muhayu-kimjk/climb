// AC-29 ⑥ 날인 다섯 항목 (CTL-54, 06 통제 목록 2장) 시험 (2026-11-13 주말 점검 W2)
//   결재 문서(review.js)를 가짜 문서에 올려 ⑥ 확인 창을 눌러 봄(도우미는 lib.js)
'use strict';
const { review } = require('./lib');

const FIVE = ['고객사명', '체결 제품', '계약 금액', '계약 기간', '결재한 판과 같은 문서(판 번호)'];
const pend = c => (c.approvals || []).filter(a => a.state === 'PENDING').map(a => a.step + ':' + a.userId);
const stateOf = (c, step) => ((c.approvals || []).find(a => a.step === step) || {}).state;
const s06 = c => c.approvals.find(a => a.step === 'S06');

module.exports = {
  ac: 'AC-29',
  title: '⑥ 날인 다섯 항목',
  tests: [
    {
      name: '총무가 다섯 항목을 모두 표시하고 날인 완료하면 기록에 다섯 항목이 남고 ⑦이 기안자 차례(2610CL004)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'GA' });
        const c = env.contract('2610CL004');
        const rv = review(env, '2610CL004', 'u_ga');
        if (!rv.hasButton('APPROVE', 'S06')) return '⑥ 담당 총무에게 날인 완료 단추가 없음';
        rv.open('APPROVE', 'S06');
        const got = rv.checks().map(b => b.value);
        if (got.join('|') !== FIVE.join('|')) return '확인 항목이 문서의 다섯 항목과 다름: ' + got.join(', ');
        if (!/결재한 판: <strong>계약서 초안 판 \d+<\/strong>/.test(rv.extra())) return '확인 창에 결재한 판 번호가 보이지 않음';
        rv.checkAll().confirm();
        const e = c.history[c.history.length - 1];
        if (!e || e.step !== 'S06' || e.action !== 'APPROVE') return '날인 완료가 결재 기록에 남지 않음';
        const miss = FIVE.filter(x => e.comment.indexOf(x) < 0);
        if (miss.length) return '결재 기록에 빠진 항목: ' + miss.join(', ');
        if (pend(c).join(',') !== 'S07:' + c.requesterId) return '⑦이 기안자 차례가 아님: ' + pend(c).join(',');
        return true;
      },
    },
    {
      name: '견적서로 대신하고 초안이 없는 계약은 ⑥ 확인 창에 "결재한 문서: 최종 견적서"(2609CL005를 ⑥ 차례로)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'GA', hook: D => { D.CONTRACTS.find(x => x.id === '2609CL005').postAt = 'S06'; } });
        const c = env.contract('2609CL005');
        if (!env.C.isQuoteInstead(c) || stateOf(c, 'S06') !== 'PENDING') return '시험 전제(견적서로 대신, ⑥ 차례)가 맞지 않음';
        const rv = review(env, '2609CL005', 'u_ga');
        if (!rv.hasButton('APPROVE', 'S06')) return '⑥ 날인 완료 단추가 없음';
        rv.open('APPROVE', 'S06');
        if (rv.extra().indexOf('결재한 문서: <strong>최종 견적서</strong>') < 0) return '확인 창에 "결재한 문서: 최종 견적서"가 보이지 않음';
        if (rv.checks().length !== 5) return '견적서로 대신한 계약도 확인 항목이 다섯이어야 함: ' + rv.checks().length;
        return true;
      },
    },
    {
      name: '확인 항목 하나를 빼면 날인 완료가 남지 않음',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'GA' });
        const c = env.contract('2610CL004'), n = c.history.length;
        const rv = review(env, '2610CL004', 'u_ga').open('APPROVE', 'S06');
        for (let i = 0; i < 5; i++) {
          rv.checkAll(i).confirm();
          if (c.history.length !== n || stateOf(c, 'S06') !== 'PENDING') return FIVE[i] + '을 빼도 날인 완료가 남음';
        }
        rv.checkAll().confirm();
        if (stateOf(c, 'S06') !== 'DONE') return '다섯 항목을 다 표시해도 남지 않음(시험 전제가 맞지 않음)';
        return true;
      },
    },
    {
      name: '②~⑤가 끝나기 전에는 ⑥을 처리할 수 없음(2610CL005, ④⑤ 차례)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'GA' });
        const c = env.contract('2610CL005');
        if (stateOf(c, 'S06') !== 'WAITING') return '⑥이 대기가 아님: ' + stateOf(c, 'S06');
        if (['u_ga', 'u_super'].some(p => env.C.canAct(c, s06(c), env.U(p)))) return '계약 검토 중인데 ⑥을 처리할 수 있음';
        if (review(env, '2610CL005', 'u_ga').hasButton('APPROVE', 'S06')) return '총무 결재 문서에 날인 완료 단추가 보임';
        return true;
      },
    },
    {
      name: '⑥ 담당이 아닌 총무는 처리할 수 없음',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'GA' });
        const c = env.contract('2610CL004');
        if (s06(c).userId !== 'u_ga') return '시험 전제: ⑥ 담당이 u_ga가 아님(' + s06(c).userId + ')';
        if (env.C.canAct(c, s06(c), env.U('u_seoyun_tak'))) return '⑥ 담당이 아닌 총무(u_seoyun_tak)가 처리할 수 있음';
        if (review(env, '2610CL004', 'u_seoyun_tak').hasButton('APPROVE', 'S06')) return '담당이 아닌 총무에게 날인 완료 단추가 보임';
        return true;
      },
    },
    {
      name: '대리 기간이 끝난 사람은 ⑥을 처리할 수 없음(기간 안의 대리는 됨)',
      kind: 'deny',
      run(h) {
        const add = (D, from, to) => D.DELEGATIONS.push({ id: 'DL-T29', absentId: 'u_ga', delegateId: 'u_seoyun_tak', from, to, reason: '시험', by: 'u_admin', at: from + ' 09:00', endedAt: null });
        const ended = h.fresh({ role: 'GA', hook: D => add(D, '2026-10-01', '2026-10-10') });
        const c1 = ended.contract('2610CL004');
        if (ended.C.canAct(c1, s06(c1), ended.U('u_seoyun_tak'))) return '대리 기간이 끝났는데 처리할 수 있음';
        const live = h.fresh({ role: 'GA', hook: D => add(D, '2026-10-15', '2026-10-25') });
        const c2 = live.contract('2610CL004');
        if (!live.C.canAct(c2, s06(c2), live.U('u_seoyun_tak'))) return '기간 안의 대리도 처리할 수 없음(시험 전제가 맞지 않음)';
        return true;
      },
    },
    {
      name: '⑥ 담당자가 기안한 계약은 그 사람이 ⑥을 처리할 수 없음',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'GA', hook: D => { D.CONTRACTS.find(x => x.id === '2610CL004').requesterId = 'u_ga'; } });
        const c = env.contract('2610CL004');
        if (stateOf(c, 'S06') !== 'PENDING') return '시험 전제: ⑥이 차례가 아님';
        if (env.C.canAct(c, s06(c), env.U('u_ga'))) return '⑥ 담당자가 자기가 기안한 계약의 ⑥을 처리할 수 있음';
        if (review(env, '2610CL004', 'u_ga').hasButton('APPROVE', 'S06')) return '자기가 기안한 계약에 날인 완료 단추가 보임';
        return true;
      },
    },
    {
      name: '반려 사유 없이 반려할 수 없음',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'GA' });
        const c = env.contract('2610CL004'), n = c.history.length;
        const rv = review(env, '2610CL004', 'u_ga').open('REJECT', 'S06').comment('');
        rv.confirm();
        if (c.history.length !== n || c.status !== 'APPROVED') return '사유 없이 반려가 남음: ' + c.status;
        rv.comment('계약서 실물의 계약 금액이 다름').confirm();
        if (c.status !== 'REJECTED') return '사유를 적어도 반려되지 않음(시험 전제가 맞지 않음)';
        return true;
      },
    },
    {
      name: '⑥ 반려 뒤 같은 차수에서 ⑦을 이어 갈 수 없음',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'GA' });
        const c = env.contract('2610CL004');
        review(env, '2610CL004', 'u_ga').open('REJECT', 'S06').comment('계약 기간이 다름').confirm();
        if (c.status !== 'REJECTED') return '반려가 되지 않아 시험할 수 없음';
        const s07 = c.approvals.find(a => a.step === 'S07');
        if (s07.state === 'PENDING') return '반려 뒤에도 ⑦이 차례';
        if (['u_sales1', 'u_super'].some(p => env.C.canAct(c, s07, env.U(p)))) return '반려 뒤 ⑦을 처리할 수 있음';
        if (review(env, '2610CL004', 'u_sales1').hasButton('REGISTER', 'S07')) return '반려 뒤 기안자에게 체결본 등록 단추가 보임';
        return true;
      },
    },
  ],
  serverOnly: [
    '화면 검사를 건너뛰고 확인 항목을 빼거나 네 항목만 담은 예전 요청을 직접 보냄: 시안 recordAction은 항목을 다시 검사하지 않아 서버가 다섯 항목을 확인해야 함',
    '차례, 담당, 기안자 아님을 요청마다 서버가 다시 확인함(시안은 단추를 그리지 않을 뿐 recordAction은 다시 검사하지 않음)',
    '다섯 항목을 의견 글뿐 아니라 따로 저장하고, 그때 견준 결재한 판 번호도 결재 기록에 따로 남김(시안은 의견 글 "확인: ..."에만 남음)',
  ],
};
