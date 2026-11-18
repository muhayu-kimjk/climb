// AC-16 차례 순서 (CTL-29) 시험 (2026-11-13 주말 점검 W2)
//   common.js buildReview(묶음 차례: ② → ③ → ③ 영업 임원 승인 → ④⑤ 동시 → ⑥ ...), canAct(지금 차례인 담당자만), canCancel, recordAction
//   결재 문서의 처리 단추는 canAct가 참일 때만 그려지므로, "처리하려 함: 거부"는 canAct와 내 차례 목록으로 봄
'use strict';

function line(amount, qty) {
  const n = qty || 1;
  return { feature: 'CK_CAMPUS_PLAG', qty: n, amount: amount, listPrice: 12000000, cap: 0.2, unitKind: 'PERIOD', months: 12, stdAmount: 12000000 * n };
}
// ②, ③, ④, ⑤를 모두 거치는 계약(1~3번 아니요, 처리위탁 있음, 25% 할인이라 한도를 5%p 넘김: ③ 영업 임원 승인은 없음)
function rec(env, id, over) {
  return Object.assign({
    id: id, counterparty: '시험대학교', services: ['CK'], kind: 'NEW', amount: 9000000, requesterId: 'u_sales1',
    requestedAt: env.D.TODAY + ' 00:00', restricted: false, personalData: true, status: 'IN_REVIEW', round: 1, history: [],
    checklist: { standard: 'NO', standardNote: '조항 수정', price: 'NO', priceNote: '묶음 할인', cap: 'NO', capNote: '25% 할인 요청', accounting: 'NO' },
    products: [line(9000000)],
  }, over || {});
}
function step(c, code) { return (c.approvals || []).find(a => a.step === code) || null; }
function stateOf(c, code) { const a = step(c, code); return a ? a.state : 'NONE'; }
function act(env, c, code, action, userId, extra) { return env.C.recordAction(c, step(c, code), action, '시험', env.U(userId), extra); }
// 새 계약을 저장하고 ②, ③을 승인해 ④와 ⑤가 차례인 상태로 만듦
function atLegal(h) {
  const env = h.fresh({ role: 'SALES' });
  env.C.saveDemoContract(rec(env, '2610CL015'));
  const c = env.contract('2610CL015');
  if (!act(env, c, 'S02', 'APPROVE', 'u_sadmin') || !act(env, c, 'S03', 'APPROVE', 'u_head')) throw new Error('②, ③ 승인을 남기지 못함');
  return { env: env, c: c };
}
// 그 사람이 이 계약을 처리할 수 있게 보이는지(처리 단추, 검토 대기 목록)
function canTouch(env, c, code, userId) {
  const u = env.U(userId), s = step(c, code);
  return (s && env.C.canAct(c, s, u)) || env.C.pendingQueue(u).some(r => r.c.id === c.id && r.s.step === code);
}

module.exports = {
  ac: 'AC-16',
  title: '차례 순서',
  tests: [
    {
      name: '③ 승인 직후 ④와 ⑤가 함께 차례가 되고, ④만 승인되면 ⑥은 대기로 남음',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const { C } = env;
        C.saveDemoContract(rec(env, '2610CL015'));
        const c = env.contract('2610CL015');
        act(env, c, 'S02', 'APPROVE', 'u_sadmin');
        if (stateOf(c, 'S04') !== 'WAITING' || stateOf(c, 'S05') !== 'WAITING') return '③ 승인 전에 ④⑤가 대기가 아님: ' + stateOf(c, 'S04') + ', ' + stateOf(c, 'S05');
        act(env, c, 'S03', 'APPROVE', 'u_head');
        const s3 = step(c, 'S03');
        if (s3.state !== 'DONE') return '③ 승인이 남지 않음: ' + s3.state;
        for (const code of ['S04', 'S05']) {
          const s = step(c, code);
          if (s.state !== 'PENDING') return '③ 승인 뒤 ' + code + '가 차례가 아님: ' + s.state;
          if (s.arrivedAt !== s3.decidedAt) return code + ' 도착 일시가 ③ 승인 일시와 다름: ' + s.arrivedAt + ' / ' + s3.decidedAt;
        }
        if (!C.canAct(c, step(c, 'S04'), env.U('u_legal')) || !C.canAct(c, step(c, 'S05'), env.U('u_privacy'))) return '④ 또는 ⑤ 담당자가 처리할 수 없음';
        act(env, c, 'S04', 'APPROVE', 'u_legal');
        if (stateOf(c, 'S05') !== 'PENDING') return '④ 승인 뒤 ⑤가 차례가 아님: ' + stateOf(c, 'S05');
        if (stateOf(c, 'S06') !== 'WAITING') return '④만 승인했는데 ⑥이 대기가 아님: ' + stateOf(c, 'S06');
        if (c.status !== 'IN_REVIEW') return '④만 승인했는데 상태가 검토 중이 아님: ' + c.status;
        if (canTouch(env, c, 'S06', 'u_ga')) return '④만 승인했는데 ⑥ 담당자가 처리할 수 있음';
        act(env, c, 'S05', 'APPROVE', 'u_privacy');
        if (stateOf(c, 'S06') !== 'PENDING') return '⑤까지 승인한 뒤 ⑥이 차례가 아님: ' + stateOf(c, 'S06');
        return true;
      },
    },
    {
      name: '③이 대기이거나 차례인데 ④ 담당자가 처리하려 함: 처리할 수 없음',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        // 2610CL007: ② 차례, ③ 대기 / 2601CL001-A01: ③ 차례, ④ 대기
        for (const id of ['2610CL007', '2601CL001-A01']) {
          const c = env.contract(id);
          if (stateOf(c, 'S04') !== 'WAITING') return '예시 ' + id + '의 ④가 대기가 아님(시험을 고칠 것): ' + stateOf(c, 'S04');
          if (canTouch(env, c, 'S04', 'u_legal')) return id + ': ③이 끝나기 전에 ④ 담당자가 처리할 수 있음';
          if (canTouch(env, c, 'S04', 'u_minjae_song')) return id + ': 다른 법무 담당자가 처리할 수 있음';
        }
        return true;
      },
    },
    {
      name: '④가 반려한 뒤 ⑤ 담당자가 승인하려 함: 동시 차례도 멈춰 처리할 수 없음',
      kind: 'deny',
      run(h) {
        const { env, c } = atLegal(h);
        if (stateOf(c, 'S05') !== 'PENDING') return '④ 반려 전에 ⑤가 차례가 아님(시험을 고칠 것)';
        if (!act(env, c, 'S04', 'REJECT', 'u_legal')) return '④ 반려를 남기지 못함';
        if (c.status !== 'REJECTED') return '④ 반려 뒤 상태가 반려가 아님: ' + c.status;
        if (stateOf(c, 'S05') === 'PENDING') return '④ 반려 뒤에도 ⑤가 차례로 남음';
        if (canTouch(env, c, 'S05', 'u_privacy')) return '④ 반려 뒤 ⑤ 담당자가 처리할 수 있음';
        if (env.C.pendingSteps(c).length) return '반려 뒤에도 차례가 남음: ' + env.C.pendingSteps(c).map(a => a.step).join(',');
        return true;
      },
    },
    {
      name: '보완 요청 중 다른 단계를 승인하려 함: 모든 차례가 멈춰 처리할 수 없음',
      kind: 'deny',
      run(h) {
        const { env, c } = atLegal(h);
        if (!act(env, c, 'S04', 'SUPPLEMENT', 'u_legal', { supplementItems: ['DOC'] })) return '④ 보완 요청을 남기지 못함';
        if (c.status !== 'SUPPLEMENT') return '보완 요청 뒤 상태가 보완 중이 아님: ' + c.status;
        if (env.C.pendingSteps(c).length) return '보완 중인데 차례가 남음: ' + env.C.pendingSteps(c).map(a => a.step).join(',');
        if (canTouch(env, c, 'S05', 'u_privacy')) return '보완 중에 ⑤ 담당자가 처리할 수 있음';
        // 예시 2610CL008(보완 중): 아무 단계도 처리할 수 없음
        const c8 = env.contract('2610CL008');
        if (c8.status !== 'SUPPLEMENT') return '예시 2610CL008이 보완 중이 아님(시험을 고칠 것)';
        const open = c8.approvals.filter(s => ['u_legal', 'u_head', 'u_sadmin', 'u_privacy'].some(id => env.C.canAct(c8, s, env.U(id))));
        return open.length ? '2610CL008(보완 중)에서 처리할 수 있는 단계: ' + open.map(s => s.step).join(',') : true;
      },
    },
    {
      name: '③ 승인을 취소하면 ④, ⑤가 대기로 돌아가고 도착 일시가 비워짐',
      kind: 'deny',
      run(h) {
        const { env, c } = atLegal(h);
        const s3 = step(c, 'S03');
        if (!env.C.canCancel(c, s3, env.U('u_head'))) return '③을 승인한 리더가 승인을 취소할 수 없음(시험을 고칠 것)';
        if (!act(env, c, 'S03', 'CANCEL', 'u_head')) return '③ 승인 취소를 남기지 못함';
        if (stateOf(c, 'S03') !== 'PENDING') return '취소한 ③이 다시 차례가 아님: ' + stateOf(c, 'S03');
        for (const code of ['S04', 'S05']) {
          const s = step(c, code);
          if (s.state !== 'WAITING') return '③ 취소 뒤 ' + code + '가 대기가 아님: ' + s.state;
          if (s.arrivedAt) return '③ 취소 뒤 ' + code + '의 도착 일시가 남음: ' + s.arrivedAt;
        }
        if (canTouch(env, c, 'S04', 'u_legal')) return '③ 취소 뒤 ④ 담당자가 처리할 수 있음';
        return true;
      },
    },
    {
      name: '같은 단계에 두 번째 승인: 앞 승인이 남은 뒤에는 처리 단추가 없음',
      kind: 'deny',
      run(h) {
        const { env, c } = atLegal(h);
        const s4 = step(c, 'S04');
        if (!act(env, c, 'S04', 'APPROVE', 'u_legal')) return '④ 승인을 남기지 못함';
        for (const id of ['u_legal', 'u_minjae_song']) {
          if (env.C.canAct(c, step(c, 'S04'), env.U(id))) return '승인한 ④를 ' + id + '가 또 처리할 수 있음';
        }
        const n = c.history.filter(x => x.step === 'S04' && x.action === 'APPROVE').length;
        return n === 1 && s4 ? true : '④ 승인 기록이 ' + n + '건';
      },
    },
  ],
  serverOnly: [
    '화면을 거치지 않은 처리 요청(③ 대기 중 ④ 승인, ④ 반려 뒤 ⑤ 승인, 보완 중 다른 단계 승인): 시안 recordAction은 차례를 다시 검사하지 않음(대기인 ④에 승인을 보내면 그대로 승인됨, 이번 점검에서 직접 불러 확인). 서버가 처리 요청마다 결재 기록으로 지금 차례인지 다시 계산해 거부',
    '같은 단계에 승인 두 건이 동시에 옴: 하나만 받음. 동시 요청은 서버의 잠금이나 유일 조건 몫(시안은 한 브라우저라 차례로만 시험)',
  ],
};
