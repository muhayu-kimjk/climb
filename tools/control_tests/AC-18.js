// AC-18 ③ 담당을 시스템이 정함 (CTL-31, CTL-48) 시험 (2026-11-13 주말 점검 W2)
//   common.js stepUser(③은 기안자 유닛의 리더, 리더 본인 계약과 표에 없는 유닛은 영업 임원), leaderAt(차례가 된 때의 리더), reviewRoute와 cooRoute(③ 영업 임원 승인 S03C),
//   capOverPp(한도를 넘긴 폭), cooOverPp(기안 일시의 기준 %p), canAct(③을 승인한 사람은 S03C를 처리하지 않음)
//   줄에는 기안할 때 남기는 표준 단가와 한도(한도 20%, 1년 12,000,000원)를 넣어 할인율이 정확히 셈해지게 함
'use strict';
const lib = require('./lib');

function line(amount, qty) {
  const n = qty || 1;
  return { feature: 'CK_CAMPUS_PLAG', qty: n, amount: amount, listPrice: 12000000, cap: 0.2, unitKind: 'PERIOD', months: 12, stdAmount: 12000000 * n };
}
// ③을 거치는 계약(2, 3번 아니요). amount로 할인율을 정함: 9,000,000원 25%(한도를 5%p 넘김), 8,400,000원 30%(10%p), 7,800,000원 35%(15%p)
function rec(env, id, amount, over) {
  return Object.assign({
    id: id, counterparty: '시험대학교', services: ['CK'], kind: 'NEW', amount: amount, requesterId: 'u_sales1',
    requestedAt: env.D.TODAY + ' 00:00', restricted: false, personalData: false, status: 'IN_REVIEW', round: 1, history: [],
    checklist: { standard: 'YES', price: 'NO', priceNote: '묶음 할인', cap: 'NO', capNote: '할인 요청', accounting: 'NO' },
    products: [line(amount)],
  }, over || {});
}
function step(c, code) { return (c.approvals || []).find(a => a.step === code) || null; }
function stateOf(c, code) { const a = step(c, code); return a ? a.state : 'NONE'; }
function act(env, c, code, action, userId, extra) { return env.C.recordAction(c, step(c, code), action, '시험', env.U(userId), extra); }
// 저장하고 ②를 승인해 ③이 차례가 되게 함
function toS03(env, r) {
  env.C.saveDemoContract(r);
  const c = env.contract(r.id);
  if (!act(env, c, 'S02', 'APPROVE', env.C.pendingSteps(c)[0].userId)) throw new Error(r.id + ' ② 승인을 남기지 못함');
  return c;
}
// 오늘(2026-10-19) 하루 동안의 대리 지정
function dl(id, absentId, delegateId) {
  return { id: id, absentId: absentId, delegateId: delegateId, from: '2026-10-19', to: '2026-10-19', reason: '시험 대리 지정', by: 'u_admin', at: '2026-10-18 10:00', endedAt: null };
}

module.exports = {
  ac: 'AC-18',
  title: '③ 담당을 시스템이 정함',
  tests: [
    {
      name: '비즈니스1유닛 담당자가 기안하면 그 유닛 리더가, 그 리더가 기안하면 영업 임원이 ③ 담당',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const a = toS03(env, rec(env, '2610CL015', 9000000, { requesterId: 'u_sales1' }));
        const b = toS03(env, rec(env, '2610CL016', 9000000, { requesterId: 'u_head' }));
        const sa = step(a, 'S03'), sb = step(b, 'S03');
        if (sa.state !== 'PENDING' || sa.userId !== 'u_head') return '이도윤 기안의 ③: ' + sa.state + ' ' + sa.userId + '(리더 최민준이어야 함)';
        if (sb.state !== 'PENDING' || sb.userId !== 'u_exec') return '최민준(리더) 기안의 ③: ' + sb.state + ' ' + sb.userId + '(영업 임원이어야 함)';
        if (!env.C.canAct(a, sa, env.U('u_head'))) return '리더가 자기 유닛 계약의 ③을 처리할 수 없음';
        if (env.C.canAct(b, sb, env.U('u_head'))) return '리더가 자기 계약의 ③을 처리할 수 있음';
        if (env.C.canAct(a, sa, env.U('u_eunseong_ko'))) return '다른 유닛 리더(고은성)가 비즈니스1유닛 계약의 ③을 처리할 수 있음';
        return true;
      },
    },
    {
      name: '한도 20%인 줄을 35% 할인(15%p 넘음)하면 ③ 다음 ③ 영업 임원 승인, 정확히 기준(5%p, 2026-11-16 결정 2)만큼 넘으면 거치지 않음',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const { C } = env;
        // 예시 2610CL009: ③(리더) 승인 뒤 ③ 영업 임원 승인(영업 임원) 차례
        const c9 = env.contract('2610CL009');
        if (stateOf(c9, 'S03') !== 'DONE' || step(c9, 'S03').decidedBy !== 'u_head') return '2610CL009 ③이 리더 승인이 아님: ' + stateOf(c9, 'S03');
        const x9 = step(c9, 'S03C');
        if (!x9 || x9.state !== 'PENDING' || x9.userId !== 'u_exec') return '2610CL009 ③ 영업 임원 승인이 영업 임원 차례가 아님: ' + (x9 && x9.state + ' ' + x9.userId);
        // 새 계약: 35% 할인(15%p) → ③ 다음 S03C, 25% 할인(정확히 기준 5%p) → S03C 없음, 30% 할인(10%p) → S03C(예전 기준 10%p에서는 거치지 않던 값)
        if (C.cooOverPp(env.D.TODAY + ' 00:00') !== 5) return '오늘 기안의 기준이 5%p가 아님: ' + C.cooOverPp(env.D.TODAY + ' 00:00');
        const big = toS03(env, rec(env, '2610CL015', 7800000));
        if (C.capOverPp(big) !== 15) return '35% 할인의 넘긴 폭이 15%p가 아님: ' + C.capOverPp(big);
        if (stateOf(big, 'S03C') !== 'WAITING') return '35% 할인인데 ③ 영업 임원 승인이 대기로 없음: ' + stateOf(big, 'S03C');
        act(env, big, 'S03', 'APPROVE', 'u_head');
        const b3c = step(big, 'S03C');
        if (b3c.state !== 'PENDING' || b3c.userId !== 'u_exec') return '③ 승인 뒤 ③ 영업 임원 승인이 영업 임원 차례가 아님: ' + b3c.state + ' ' + b3c.userId;
        if (stateOf(big, 'S06') !== 'WAITING') return '③ 영업 임원 승인 전에 ⑥이 대기가 아님';
        const five = toS03(env, rec(env, '2610CL016', 9000000));
        if (C.capOverPp(five) !== 5) return '25% 할인의 넘긴 폭이 5%p가 아님: ' + C.capOverPp(five);
        if (C.reviewRoute(five).S03C[0] || step(five, 'S03C')) return '정확히 5%p 넘겼는데 ③ 영업 임원 승인을 거침: ' + stateOf(five, 'S03C');
        const ten = toS03(env, rec(env, '2610CL017', 8400000));
        if (C.capOverPp(ten) !== 10) return '30% 할인의 넘긴 폭이 10%p가 아님: ' + C.capOverPp(ten);
        if (stateOf(ten, 'S03C') !== 'WAITING') return '10%p 넘겼는데(새 기준 5%p) ③ 영업 임원 승인이 대기로 없음: ' + stateOf(ten, 'S03C');
        return true;
      },
    },
    {
      name: '요청에 다른 승인자 값을 넣어 보냄: 무시하고 시스템이 ③과 ③ 영업 임원 승인 담당을 정함',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const r = rec(env, '2610CL015', 7800000, { approvals: [
          { step: 'S02', state: 'DONE', userId: 'u_sadmin' }, { step: 'S03', state: 'PENDING', userId: 'u_taeyun_kim' },
          { step: 'S03C', state: 'WAITING', userId: 'u_head' }] });
        const c = toS03(env, r);
        if (step(c, 'S03').userId !== 'u_head') return '③ 담당이 보낸 값(' + step(c, 'S03').userId + ')';
        if (env.C.canAct(c, step(c, 'S03'), env.U('u_taeyun_kim'))) return '요청에 넣은 사람(김태윤)이 ③을 처리할 수 있음';
        act(env, c, 'S03', 'APPROVE', 'u_head');
        const x = step(c, 'S03C');
        if (!x || x.userId !== 'u_exec') return '③ 영업 임원 승인 담당이 영업 임원이 아님: ' + (x && x.userId);
        return true;
      },
    },
    {
      name: '유닛 리더를 바꾼 뒤 이미 ③이 차례인 건은 원래 리더가 처리(새로 차례가 되는 건은 새 리더)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'ADMIN' });
        const { C } = env;
        const c6 = env.contract('2610CL006'); // 비즈니스1유닛, ③이 2026-10-16부터 최민준 차례
        if (stateOf(c6, 'S03') !== 'PENDING' || step(c6, 'S03').userId !== 'u_head') return '예시 2610CL006의 ③이 최민준 차례가 아님(시험을 고칠 것)';
        C.adminSave('RULE', '③ 영업 검토(비즈니스1유닛 리더)', '최민준 → 박서현', '조직 개편 시험', { k: 'ASSIGNEE', step: 'S03:비즈니스1유닛', to: 'u_seohyun_park' });
        C.saveDemoContract(c6); // 결재 기록을 다시 읽어 결재란을 다시 만듦
        const s = step(c6, 'S03');
        if (s.state !== 'PENDING' || s.userId !== 'u_head') return '이미 차례인 ③이 새 리더에게 감: ' + s.state + ' ' + s.userId;
        if (!C.canAct(c6, s, env.U('u_head'))) return '원래 리더가 이미 차례인 ③을 처리할 수 없음';
        if (C.canAct(c6, s, env.U('u_seohyun_park'))) return '새 리더가 바꾸기 전에 차례가 된 ③을 처리할 수 있음';
        // 대조: 바꾼 뒤 ③이 차례가 되는 계약은 새 리더
        const n = toS03(env, rec(env, '2610CL015', 9000000));
        return step(n, 'S03').userId === 'u_seohyun_park' ? true : '바꾼 뒤 차례가 된 ③이 새 리더에게 가지 않음: ' + step(n, 'S03').userId;
      },
    },
    {
      name: '새 유닛이 유닛별 리더 표에 없음: ③은 영업 임원에게 가고, 할인 폭이 커도 영업 임원 승인은 한 번만',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES', hook: D => { D.USERS.u_t_new = { name: '시험영업', dept: '비즈니스4유닛', role: 'SALES' }; } });
        if ('비즈니스4유닛' in env.D.TEAM_LEADERS) return '비즈니스4유닛이 이미 리더 표에 있음(시험을 고칠 것)';
        const c = toS03(env, rec(env, '2610CL015', 7800000, { requesterId: 'u_t_new' })); // 35% 할인
        if (step(c, 'S03').userId !== 'u_exec') return '표에 없는 유닛의 ③이 영업 임원이 아님: ' + step(c, 'S03').userId;
        if (step(c, 'S03C')) return '③을 영업 임원이 맡는데 ③ 영업 임원 승인이 또 생김: ' + stateOf(c, 'S03C');
        return true;
      },
    },
    {
      name: '영업 임원 자신이 기안해 ③ 담당이 기안자가 되어 멈춤: 본인은 처리하지 못하고 관리자가 대리 지정으로 넘김',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'ADMIN' });
        const { C } = env;
        const c = toS03(env, rec(env, '2610CL015', 9000000, { requesterId: 'u_exec' }));
        const s = step(c, 'S03');
        if (s.state !== 'PENDING') return '③이 차례가 아님: ' + s.state;
        if (s.userId !== 'u_exec') return '③ 담당이 기안자(영업 임원)가 아님(시험을 고칠 것): ' + s.userId;
        if (C.canAct(c, s, env.U('u_exec'))) return '영업 임원이 자기 계약의 ③을 처리할 수 있음';
        if (C.canAct(c, s, env.U('u_head'))) return '대리 지정 전에 다른 사람(최민준)이 처리할 수 있음';
        C.adminSave('RULE', '대리 지정', '문태호 → 최민준', '영업 임원 본인 계약의 ③', { k: 'DELEGATE', d: dl('DL-T1', 'u_exec', 'u_head') });
        if (!C.canAct(c, step(c, 'S03'), env.U('u_head'))) return '관리자가 대리 지정한 뒤에도 대신할 사람(최민준)이 처리할 수 없음';
        if (C.canAct(c, step(c, 'S03'), env.U('u_exec'))) return '대리 지정 뒤 영업 임원 본인이 처리할 수 있음';
        return true;
      },
    },
    {
      name: '③을 승인한 사람이 ③ 영업 임원 승인을 처리하려 함: 거절(대리 지정으로 맡아도)',
      kind: 'deny',
      run(h) {
        // 최민준이 ③을 승인한 2610CL009에서, 영업 임원 대신 최민준을 대리로 지정해 둠
        const env = h.fresh({ role: 'SALES', hook: D => { D.DELEGATIONS.push(dl('DL-T2', 'u_exec', 'u_head')); } });
        const { C } = env;
        const c9 = env.contract('2610CL009');
        const x = step(c9, 'S03C');
        if (!C.isMyStep(x, env.U('u_head'))) return '대리 지정이 걸리지 않음(시험을 고칠 것)';
        if (C.canAct(c9, x, env.U('u_head'))) return '③을 승인한 최민준이 ③ 영업 임원 승인을 처리할 수 있음';
        if (!C.canAct(c9, x, env.U('u_exec'))) return '영업 임원이 ③ 영업 임원 승인을 처리할 수 없음';
        return true;
      },
    },
    {
      name: '③을 영업 임원이 승인했으면(리더 대리) ③ 영업 임원 승인은 생략, 리더 본인 계약은 처음부터 한 번만',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES', hook: D => { D.DELEGATIONS.push(dl('DL-T3', 'u_head', 'u_exec')); } });
        const { C } = env;
        const c = toS03(env, rec(env, '2610CL015', 7800000)); // 35% 할인, 이도윤 기안
        if (stateOf(c, 'S03C') !== 'WAITING') return '35% 할인인데 ③ 영업 임원 승인이 없음(시험을 고칠 것)';
        if (!C.canAct(c, step(c, 'S03'), env.U('u_exec'))) return '대리 지정된 영업 임원이 ③을 처리할 수 없음(시험을 고칠 것)';
        act(env, c, 'S03', 'APPROVE', 'u_exec');
        const x = step(c, 'S03C');
        if (!x || x.state !== 'SKIPPED') return '③을 영업 임원이 승인했는데 ③ 영업 임원 승인이 생략되지 않음: ' + (x && x.state);
        if (C.pendingSteps(c).some(a => a.step === 'S03C')) return '③ 영업 임원 승인이 차례로 남음';
        const own = toS03(env, rec(env, '2610CL016', 7800000, { requesterId: 'u_head' }));
        if (step(own, 'S03').userId !== 'u_exec') return '리더 본인 계약의 ③이 영업 임원이 아님';
        if (step(own, 'S03C')) return '리더 본인 계약에 ③ 영업 임원 승인이 또 생김: ' + stateOf(own, 'S03C');
        return true;
      },
    },
    {
      // (2026-11-13 시험 다지기) 예전에는 기준 변경 시각이 실제 시계(초까지)라, 23:59:00~23:59:59에 돌리면 대조 계약(오늘 23:59 기안)이
      //   변경보다 앞이 되어 실패했음. 시계를 오늘 09:00부터로 고정하고, 변경 시각 앞뒤를 둘 다 봄:
      //   같은 날 변경 전(08:00) 기안은 예전 기준 10%p(15%p 넘김이라 거침), 변경 뒤(23:59) 기안은 새 기준 30%p(거치지 않음)
      name: '기안 뒤 관리자가 기준을 30%p로 바꿈: 진행 중인 계약의 결재선은 그대로(바꾸기 전 기안은 예전 기준, 바꾼 뒤 기안부터 새 기준)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'ADMIN' });
        const { C } = env;
        lib.fixClock(env, 9);
        const prev = C.cooOverPp(); // 2026-11-16 결정 2로 처음 값이 5%p(2026-10-18 18:00에 10에서 바꿈)
        C.adminSave('RULE', '③ 영업 임원 승인 기준', prev + '%p → 30%p', '시험', { k: 'PRICE_RULE', key: 'cooOverPp', to: 30 });
        if (env.D.PRICE_RULES.cooOverPp !== 30) return '기준이 30으로 바뀌지 않음(시험을 고칠 것)';
        const ch = env.D.PRICE_RULE_CHANGES.filter(x => x.key === 'cooOverPp' && x.to === 30).pop();
        const before = env.D.TODAY + ' 08:00', after = env.D.TODAY + ' 23:59';
        if (!ch || !(ch.at > before && ch.at < after)) return '시험 전제: 기준 변경 시각(' + (ch && ch.at) + ')이 오늘 08:00과 23:59 사이가 아님';
        const c9 = env.contract('2610CL009'); // 2026-10-18 기안, 15%p 넘김
        C.saveDemoContract(c9);
        if (C.cooOverPp(c9.requestedAt) !== 10) return '2610CL009의 기준이 기안 때 값(10)이 아님: ' + C.cooOverPp(c9.requestedAt);
        const x = step(c9, 'S03C');
        if (!x || x.state !== 'PENDING') return '기준을 바꾼 뒤 진행 중인 2610CL009의 ③ 영업 임원 승인이 바뀜: ' + (x ? x.state : '없어짐');
        // 같은 날 바꾸기 전에 기안한 35% 할인(15%p): 예전 기준(prev)보다 넘어 거침
        const b = toS03(env, rec(env, '2610CL015', 7800000, { requestedAt: before }));
        if (C.cooOverPp(b.requestedAt) !== prev) return '바꾸기 전(08:00) 기안의 기준이 ' + C.cooOverPp(b.requestedAt) + '(기대 ' + prev + ')';
        if (stateOf(b, 'S03C') !== 'WAITING') return '바꾸기 전(08:00) 기안한 계약에 ③ 영업 임원 승인이 없음: ' + stateOf(b, 'S03C');
        // 대조: 바꾼 뒤 기안한 35% 할인(15%p)은 새 기준 30%p 이하라 거치지 않음
        const n = toS03(env, rec(env, '2610CL016', 7800000, { requestedAt: after }));
        if (C.cooOverPp(n.requestedAt) !== 30) return '바꾼 뒤(23:59) 기안의 기준이 ' + C.cooOverPp(n.requestedAt);
        return step(n, 'S03C') ? '바꾼 뒤 기안한 계약에 예전 기준이 쓰임: ' + stateOf(n, 'S03C') : true;
      },
    },
    {
      name: '요청에서 ③ 영업 임원 승인을 생략으로 바꾸거나 빼고 보냄: 다시 계산해 둠',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const { C } = env;
        const c = toS03(env, rec(env, '2610CL015', 7800000, { approvals: [{ step: 'S03C', state: 'SKIPPED', reason: '생략' }] }));
        if (stateOf(c, 'S03C') !== 'WAITING') return '새 기안: 보낸 생략이 그대로(' + stateOf(c, 'S03C') + ')';
        const c9 = env.contract('2610CL009');
        c9.approvals = c9.approvals.map(a => a.step === 'S03C' ? Object.assign({}, a, { state: 'SKIPPED', reason: '생략' }) : a);
        C.saveDemoContract(c9);
        if (stateOf(c9, 'S03C') !== 'PENDING') return '2610CL009: 생략으로 바꾼 결재란이 그대로(' + stateOf(c9, 'S03C') + ')';
        return true;
      },
    },
  ],
  serverOnly: [
    '③ 담당을 서버가 기안자의 조직과 유닛별 리더 표로 정하고 차례가 된 때 저장: 시안은 결재 기록을 다시 읽을 때마다 리더 변경 이력의 시각으로 다시 셈(위 시험으로 같은 답인지만 봄)',
    '③을 승인한 사람이 ③ 영업 임원 승인 요청을 직접 보냄, 요청에 다른 승인자를 넣어 보냄: 시안 recordAction은 처리하는 사람을 다시 검사하지 않음(canAct가 단추만 막음). 서버가 거절',
    '넘긴 폭은 기안한 날의 가격 행으로, 기준은 기안 일시에 적용되던 approval_rule 값으로 서버가 다시 계산: 시안은 줄에 남긴 단가와 한도, PRICE_RULE_CHANGES로 같은 셈을 화면에서만 함',
  ],
};
// 2026-11-16 기획자 결정 반영 시험(작업기록/2026-11-16/반영목록.md, tools/control_tests/n16.js)
module.exports.tests = module.exports.tests.concat(require('./n16')('AC-18'));
