// AC-23 기안자가 담당일 때 다른 사람에게 (CTL-39) 시험 (2026-11-13 주말 점검 W2)
//   06 통제 목록 2장 AC-23의 기대 동작: 기안자가 ②나 ⑧의 담당이면 그 단계 담당이 재무 담당자(⑩ 담당자)로 저장된다.
//   시안은 common.js stepUser가 차례가 된 때 담당을 정하고, buildReview가 결재란(approvals)에 그 사람을 둠
'use strict';

const step = (c, code) => (c.approvals || []).find(a => a.step === code);
const QUEUE_STEPS = ['S02', 'S03', 'S03C', 'SGR', 'SST', 'S04', 'S05', 'S06', 'SSB', 'SSE', 'S08'];
const setReq = (id, who) => D => { D.CONTRACTS.find(x => x.id === id).requesterId = who; };

module.exports = {
  ac: 'AC-23',
  title: '기안자가 담당일 때 다른 사람에게',
  tests: [
    {
      name: '영업지원 담당자(② 담당)가 기안하면 ② 담당이 재무 담당자가 되고 재무의 검토 대기에 나옴(2610CL010을 배수아 기안으로)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'FINANCE', hook: setReq('2610CL010', 'u_sadmin') });
        const { C, U } = env;
        const c = env.contract('2610CL010');
        const s2 = step(c, 'S02');
        if (!s2 || s2.state !== 'PENDING') return '② 차례가 아님';
        if (s2.userId !== 'u_finance') return '② 담당이 재무 담당자(오현우)가 아님: ' + s2.userId;
        const fin = U('u_finance');
        if (!C.pendingQueue(fin, false, QUEUE_STEPS).some(x => x.c.id === '2610CL010' && x.s.step === 'S02')) return '재무 담당자의 검토 대기에 나오지 않음';
        if (!C.canAct(c, s2, fin)) return '재무 담당자가 ②를 처리할 수 없음';
        // 결재 문서를 그려도 재무 담당자에게만 ② 처리 단추가 있음(lib.js의 review 도우미)
        let review = null;
        try { review = require('./lib').review; } catch (e) { return '결재 문서 도우미(lib.js review)를 불러오지 못함'; }
        const rf = review(env, '2610CL010', fin), rs = review(env, '2610CL010', U('u_sadmin'));
        if (rf.error || rs.error) return '결재 문서를 그리지 못함: ' + (rf.error || rs.error).message;
        if (!rf.hasButton('APPROVE', 'S02')) return '재무 담당자의 결재 문서에 ② 승인 단추가 없음';
        if (/data-open="[A-Z]+" data-step="S02"/.test(rs.bar())) return '기안자 배수아의 결재 문서에 ② 처리 단추가 그려짐';
        return true;
      },
    },
    {
      name: '영업지원 담당자(⑧ 담당)가 기안한 계약의 ⑧도 재무 담당자에게(2609CL003을 배수아 기안으로)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'FINANCE', hook: setReq('2609CL003', 'u_sadmin') });
        const { C, U } = env;
        const c = env.contract('2609CL003');
        const s8 = step(c, 'S08');
        if (!s8 || s8.state !== 'PENDING') return '⑧ 차례가 아님: ' + (s8 && s8.state);
        if (s8.userId !== 'u_finance') return '⑧ 담당이 재무 담당자가 아님: ' + s8.userId;
        if (!C.pendingQueue(U('u_finance'), false, QUEUE_STEPS).some(x => x.c.id === '2609CL003' && x.s.step === 'S08')) return '재무 담당자의 검토 대기에 ⑧이 나오지 않음';
        if (C.canAct(c, s8, U('u_sadmin'))) return '기안자 배수아가 자기 계약의 ⑧을 처리할 수 있음';
        return true;
      },
    },
    {
      name: '재무 담당자도 기안자와 같은 사람(겸임)이면 다른 사람에게 넘기지 못해도 기안자가 스스로 처리하지 못하고, 관리자 대리 지정으로만 진행',
      kind: 'deny',
      run(h) {
        // ②와 ⑩ 담당이 모두 배수아인 상태에서 배수아가 기안. 대신할 사람(같은 영업지원 석다인) 대리 지정을 둠
        const env = h.fresh({
          role: 'SALES_ADMIN',
          hook: D => {
            D.STEP_ASSIGNEE.S10 = 'u_sadmin';
            D.CONTRACTS.find(x => x.id === '2610CL010').requesterId = 'u_sadmin';
            D.DELEGATIONS.push({ id: 'DL-T23', absentId: 'u_sadmin', delegateId: 'u_dain_seok', from: '2026-10-19', to: '2026-10-21',
              reason: '시험: 겸임이라 ②를 다른 영업지원에게', by: 'u_admin', at: '2026-10-18 10:00', endedAt: null });
          },
        });
        const { C, U } = env;
        const c = env.contract('2610CL010');
        const s2 = step(c, 'S02');
        if (s2.userId !== 'u_sadmin') return '[가정]과 다름: 겸임이면 시스템이 다른 사람을 찾지 못하고 ② 담당이 기안자로 남아야 하는데 ' + s2.userId + '에게 감';
        if (C.canAct(c, s2, U('u_sadmin'))) return '겸임인 기안자 배수아가 자기 계약의 ②를 처리할 수 있음';
        if (!C.canAct(c, s2, U('u_dain_seok'))) return '관리자가 대리 지정한 석다인이 ②를 처리할 수 없음';
        return true;
      },
    },
    {
      name: '이 대체로 재무 담당자가 ②, ⑧, ⑩을 모두 맡는 것은 막지 않음(R-14)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'FINANCE', hook: setReq('2610CL010', 'u_sadmin') });
        const { C, U } = env;
        const c = env.contract('2610CL010');
        const who = ['S02', 'S08', 'S10'].map(code => code + ':' + (step(c, code) || {}).userId);
        if (who.join(',') !== 'S02:u_finance,S08:u_finance,S10:u_finance') return '②, ⑧, ⑩ 담당이 모두 재무 담당자가 아님: ' + who.join(', ');
        if (!C.canAct(c, step(c, 'S02'), U('u_finance'))) return '재무 담당자의 ② 처리가 막힘';
        // 2026-11-13 보강(점검 지적): 담당만 보지 않고, 같은 재무 담당자가 ②와 ⑧을 실제로 처리한 뒤에도 ⑩을 처리할 수 있는지(막지 않음) 끝까지 눌러 봄.
        //   차례가 된 단계를 그 담당자로 결재 문서에서 처리(lib.js doStep). ⑩ 앞에서 재무 담당자에게 ⑩ 단추와 처리 권한이 있어야 함
        const { doStep, fixClock } = require('./lib');
        fixClock(env);
        for (let i = 0; i < 12; i++) {
          const p = (c.approvals || []).filter(a => a.state === 'PENDING')[0];
          if (!p) break;
          if (p.step === 'S10') {
            if (p.userId !== 'u_finance') return '⑩ 담당이 재무 담당자가 아님: ' + p.userId;
            if (!C.canAct(c, p, U('u_finance'))) return '②와 ⑧을 처리한 재무 담당자가 ⑩을 처리할 수 없음(R-14는 막지 않는 것)';
          }
          const r = doStep(env, '2610CL010', p.step, p.userId, { date: env.C.addDays(env.D.TODAY, -1) });
          if (!r.ok) return r.why;
        }
        const did = c.history.filter(x => x.actorId === 'u_finance' && x.action === 'APPROVE').map(x => x.step).join(',');
        if (did !== 'S02,S08,S10') return '재무 담당자가 처리한 단계가 ②, ⑧, ⑩이 아님: ' + did;
        if (c.status !== 'ACTIVE') return '②, ⑧, ⑩을 재무 담당자가 모두 처리했는데 계약 완료가 아님: ' + c.status;
        return true;
      },
    },
  ],
  serverOnly: [
    '차례가 될 때 서버가 이 규칙으로 ②, ⑧ 담당을 정해 저장: 서버 몫(시안은 화면을 열 때마다 결재 기록으로 다시 셈)',
  ],
};
