// AC-15 ② 생략 불가 (CTL-28) 시험 (2026-11-13 주말 점검 W2)
//   common.js reviewRoute(②는 늘 거침), buildReview(저장할 때 결재란을 다시 만듦), stepUser(② 담당이 기안자면 재무 담당자), canAct(차례가 아니면 처리 못 함)
//   계약 등록으로 한 기안(신규, 변경, 바꿔서 연장)만 봄. 해지, 그대로 연장, 운영 변경은 따로 정한 결재선(CTL-28 본문)이라 여기서 보지 않음
'use strict';
const lib = require('./lib');

// 기안한 계약 기록. 줄에는 기안할 때 남기는 표준 단가와 한도(한도 20%, 1년 12,000,000원)
function line(amount, qty) {
  const n = qty || 1;
  return { feature: 'CK_CAMPUS_PLAG', qty: n, amount: amount, listPrice: 12000000, cap: 0.2, unitKind: 'PERIOD', months: 12, stdAmount: 12000000 * n };
}
const ALL_YES = { standard: 'YES', price: 'YES', cap: 'YES', accounting: 'NO' };
const ALL_NO = { standard: 'NO', standardNote: '조항 수정', price: 'NO', priceNote: '묶음 할인', cap: 'NO', capNote: '25% 할인 요청', accounting: 'NO' };
function rec(env, id, over) {
  return Object.assign({
    id: id, counterparty: '시험대학교', services: ['CK'], kind: 'NEW', amount: 12000000, requesterId: 'u_sales1',
    requestedAt: env.D.TODAY + ' 00:00', restricted: false, personalData: true, status: 'IN_REVIEW', round: 1, history: [],
    checklist: ALL_YES, products: [line(12000000)],
  }, over || {});
}
function step(c, code) { return (c.approvals || []).find(a => a.step === code) || null; }
function stateOf(c, code) { const a = step(c, code); return a ? a.state : 'NONE'; }
// 지금 그 단계의 담당자(또는 대리)가 결재 문서의 단추로 처리하는 것처럼 남김
function act(env, c, code, action, userId, extra) {
  return env.C.recordAction(c, step(c, code), action, '시험', env.U(userId), extra);
}

module.exports = {
  ac: 'AC-15',
  title: '② 생략 불가',
  tests: [
    {
      name: '1~3번이 모두 예인 계약을 기안하면 ②가 차례이고, ② 승인 전에는 뒤 단계가 차례가 되지 않음',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const { C } = env;
        C.saveDemoContract(rec(env, '2610CL015')); // 1~3번 모두 예, 처리위탁 있음(⑤가 뒤에 남음)
        const c = env.contract('2610CL015');
        if (stateOf(c, 'S02') !== 'PENDING') return '②가 차례가 아님: ' + stateOf(c, 'S02');
        const others = C.pendingSteps(c).filter(a => a.step !== 'S02').map(a => a.step);
        if (others.length) return '② 승인 전에 다른 단계도 차례: ' + others.join(',');
        if (stateOf(c, 'S05') !== 'WAITING') return '⑤가 대기가 아님: ' + stateOf(c, 'S05');
        if (C.canAct(c, step(c, 'S05'), env.U('u_privacy'))) return '② 승인 전에 ⑤ 담당자가 처리할 수 있음';
        if (!act(env, c, 'S02', 'APPROVE', 'u_sadmin')) return '② 승인을 남기지 못함';
        if (stateOf(c, 'S05') !== 'PENDING') return '② 승인 뒤 ⑤가 차례가 되지 않음: ' + stateOf(c, 'S05');
        // 예시 2610CL010(1~3번 모두 예): ②가 차례이고 다른 차례 없음
        const c10 = env.contract('2610CL010');
        const ps = C.pendingSteps(c10).map(a => a.step);
        if (ps.join(',') !== 'S02') return '예시 2610CL010의 차례가 ②만이 아님: ' + ps.join(',');
        return true;
      },
    },
    {
      name: '계약 등록으로 한 기안(신규, 변경, 바꿔서 연장)은 1~3번 답과 처리위탁 여부가 어떻든 ②를 거침',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const { C } = env;
        const bad = [];
        let n = 15;
        const kinds = [{ kind: 'NEW' }, { kind: 'AMEND', parentId: '2601CL001' }, { kind: 'RENEW', parentId: '2601CL001' }]; // 계약 등록의 연장은 바꿔서 연장(renewMode 없음, 그대로 연장은 AUTO)
        const prices = [['YES', 'YES'], ['NO', 'YES'], ['NO', 'NO']];
        kinds.forEach(function (k) {
          (k.kind === 'AMEND' ? prices.concat([['NA', 'NA']]) : prices).forEach(function (p) {
            ['YES', 'NO'].forEach(function (q1) {
              [true, false].forEach(function (pd) {
                const id = k.kind === 'NEW' ? '2610CL0' + (n++) : '2601CL001-' + (k.kind === 'AMEND' ? 'A' : 'R') + (n++);
                const r = rec(env, id, Object.assign({}, k, { personalData: pd, amendKind: p[0] === 'NA' ? 'TERMS' : undefined,
                  checklist: { standard: q1, standardNote: q1 === 'NO' ? '조항 수정' : '', price: p[0], cap: p[1], accounting: 'NO' } }));
                const route = C.reviewRoute(r);
                C.saveDemoContract(r);
                const c = env.contract(id);
                const st = stateOf(c, 'S02');
                if (!route.S02[0] || st === 'SKIPPED' || st === 'NONE') bad.push(k.kind + ' 1번 ' + q1 + ' 2·3번 ' + p.join('/') + ' 처리위탁 ' + pd + ': ② ' + st + ' ' + route.S02[1]);
              });
            });
          });
        });
        return bad.length ? bad.slice(0, 3).join(' / ') + (bad.length > 3 ? ' 외 ' + (bad.length - 3) + '건' : '') : true;
      },
    },
    {
      name: '요청에서 ② 상태를 생략으로 보내거나 ②를 빼고 보냄: 보낸 결재란을 쓰지 않고 ②를 둠',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const { C } = env;
        // (1) 새 기안: ②를 "생략"으로 꾸며 보냄
        C.saveDemoContract(rec(env, '2610CL015', { approvals: [
          { step: 'S02', state: 'SKIPPED', reason: '표준단가표를 적용함' }, { step: 'S05', state: 'PENDING', userId: 'u_privacy' }] }));
        const c = env.contract('2610CL015');
        if (stateOf(c, 'S02') !== 'PENDING') return '새 기안: ②가 보낸 대로 ' + stateOf(c, 'S02');
        if (C.pendingSteps(c).some(a => a.step !== 'S02')) return '새 기안: ② 말고 다른 단계가 차례(보낸 결재란을 씀)';
        // (2) 이미 기안한 예시 2610CL010의 결재란에서 ②를 빼고 다시 저장
        const c10 = env.contract('2610CL010');
        c10.approvals = c10.approvals.filter(a => a.step !== 'S02');
        C.saveDemoContract(c10);
        if (stateOf(c10, 'S02') !== 'PENDING') return '2610CL010: ②를 뺀 결재란이 그대로 남음(' + stateOf(c10, 'S02') + ')';
        return true;
      },
    },
    {
      name: '②를 처리하지 않았는데 ④, ⑤ 담당자가 처리하려 함: 처리 단추가 없고 내 차례 목록에도 없음',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const { C } = env;
        C.saveDemoContract(rec(env, '2610CL015', { checklist: ALL_NO })); // ②~⑤를 모두 거치는 계약
        const c = env.contract('2610CL015');
        for (const x of [['S04', 'u_legal'], ['S05', 'u_privacy'], ['S03', 'u_head']]) {
          const u = env.U(x[1]);
          if (C.canAct(c, step(c, x[0]), u)) return x[0] + ' 담당자(' + x[1] + ')가 ② 승인 전에 처리할 수 있음';
          if (C.pendingQueue(u).some(r => r.c.id === c.id)) return x[1] + '의 검토 대기 목록에 ② 승인 전 계약이 보임';
          if (C.myActions(u).some(y => y.id === c.id)) return x[1] + '의 내가 처리할 계약에 ② 승인 전 계약이 보임';
        }
        return true;
      },
    },
    {
      name: '영업지원 담당자가 기안해 ② 담당이 기안자가 됨: ②가 사라지지 않고 재무 담당자에게 감',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const { C } = env;
        C.saveDemoContract(rec(env, '2610CL015', { requesterId: 'u_sadmin' }));
        const c = env.contract('2610CL015');
        const s02 = step(c, 'S02');
        if (!s02 || s02.state !== 'PENDING') return '②가 차례가 아님: ' + (s02 && s02.state);
        if (s02.userId !== 'u_finance') return '② 담당이 재무 담당자가 아님: ' + s02.userId;
        if (C.canAct(c, s02, env.U('u_sadmin'))) return '기안한 영업지원 담당자가 자기 계약의 ②를 처리할 수 있음';
        if (!C.canAct(c, s02, env.U('u_finance'))) return '재무 담당자가 ②를 처리할 수 없음';
        return true;
      },
    },
    {
      // (2026-11-13 시험 다지기) 상태와 ②의 승인 일시만 보던 것에 더함: 대기로 돌아간 ③~⑤의 도착 일시는 비워지고(03 approval_step.arrived_at,
      //   AC-16 승인 취소와 같은 조건), 담당은 지금 규칙으로 다시 정함(REQ-AUTH-06 "아직 차례가 오지 않은 단계부터 새 담당자").
      //   그래서 보완 요청과 보완 완료 사이에 비즈니스1유닛 리더를 최민준에서 박서현으로 바꿈: 다시 대기가 된 ③은 박서현이고,
      //   ②를 다시 승인해 ③이 차례가 되면 그때 도착 일시와 박서현으로 정해짐. 시계는 고정(09:00부터 1분씩)
      name: '보완 완료에서 금액이 바뀜(기안자가 "금액이나 체크리스트 답을 바꿨습니다" 표시): ②부터 다시, 대기로 돌린 ③~⑤는 도착 일시를 비우고 담당을 지금 규칙으로',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'ADMIN' });
        const { C } = env;
        lib.fixClock(env, 9);
        C.saveDemoContract(rec(env, '2610CL015', { checklist: ALL_NO, amount: 9000000, products: [line(9000000)] }));
        const c = env.contract('2610CL015');
        if (!act(env, c, 'S02', 'APPROVE', 'u_sadmin') || !act(env, c, 'S03', 'APPROVE', 'u_head')) return '②, ③ 승인을 남기지 못함';
        const was = ['S03', 'S04', 'S05'].filter(code => !step(c, code).arrivedAt);
        if (was.length) return '시험 전제: 보완 요청 전 ' + was.join(',') + '에 도착 일시가 없음';
        if (!act(env, c, 'S04', 'SUPPLEMENT', 'u_legal', { supplementItems: ['AMOUNT'] })) return '④ 보완 요청을 남기지 못함';
        if (c.status !== 'SUPPLEMENT') return '보완 요청 뒤 상태가 보완 중이 아님: ' + c.status;
        C.adminSave('RULE', '③ 영업 검토(비즈니스1유닛 리더)', '최민준 → 박서현', '조직 개편 시험', { k: 'ASSIGNEE', step: 'S03:비즈니스1유닛', to: 'u_seohyun_park' });
        if (C.stepUserNow('S03', c) !== 'u_seohyun_park') return '시험 전제: 리더를 바꾼 뒤 지금 규칙의 ③ 담당이 ' + C.stepUserNow('S03', c);
        const done = C.recordAction(c, { step: 'S01', userId: C.repActorOf(c) }, 'RESUBMIT', '금액 고침', env.U('u_sales1'), { restart: true });
        if (!done) return '보완 완료를 남기지 못함';
        if (stateOf(c, 'S02') !== 'PENDING') return '보완 완료 뒤 ②가 다시 차례가 아님: ' + stateOf(c, 'S02');
        if (step(c, 'S02').decidedAt) return '②의 앞 승인 일시가 남아 있음';
        if (step(c, 'S02').arrivedAt !== done.at) return '다시 차례가 된 ②의 도착 일시가 보완 완료 일시가 아님: ' + step(c, 'S02').arrivedAt + ' / ' + done.at;
        const left = ['S03', 'S04', 'S05'].filter(code => stateOf(c, code) !== 'WAITING');
        if (left.length) return '② 뒤 단계가 대기로 돌아가지 않음: ' + left.map(code => code + ' ' + stateOf(c, code)).join(', ');
        const stale = ['S03', 'S04', 'S05'].filter(code => step(c, code).arrivedAt);
        if (stale.length) return '대기로 돌린 단계에 앞 도착 일시가 남음: ' + stale.map(code => code + ' ' + step(c, code).arrivedAt).join(', ');
        const who = ['S03', 'S04', 'S05'].filter(code => step(c, code).userId !== C.stepUserNow(code, c));
        if (who.length) return '대기로 돌린 단계의 담당이 지금 규칙과 다름: ' + who.map(code => code + ' ' + step(c, code).userId + '(지금 규칙 ' + C.stepUserNow(code, c) + ')').join(', ');
        if (step(c, 'S03').userId !== 'u_seohyun_park') return '대기로 돌린 ③의 담당이 옛 리더로 남음: ' + step(c, 'S03').userId;
        // ②를 다시 승인하면 ③이 그때 차례가 되고 새 리더가 처리
        if (!act(env, c, 'S02', 'APPROVE', 'u_sadmin')) return '② 다시 승인을 남기지 못함';
        const s3 = step(c, 'S03');
        if (s3.state !== 'PENDING' || s3.userId !== 'u_seohyun_park') return '② 다시 승인 뒤 ③이 ' + s3.state + ' ' + s3.userId + '(새 리더 박서현 차례여야 함)';
        if (s3.arrivedAt !== step(c, 'S02').decidedAt) return '③의 도착 일시가 ② 다시 승인 일시가 아님: ' + s3.arrivedAt + ' / ' + step(c, 'S02').decidedAt;
        if (C.canAct(c, s3, env.U('u_head'))) return '옛 리더(최민준)가 다시 차례가 된 ③을 처리할 수 있음';
        // 대조: 금액을 바꾸지 않은 보완 완료는 요청한 ④부터 이어감(② 승인은 그대로)
        const env2 = h.fresh({ role: 'SALES' });
        env2.C.saveDemoContract(rec(env2, '2610CL015', { checklist: ALL_NO, amount: 9000000, products: [line(9000000)] }));
        const c2 = env2.contract('2610CL015');
        act(env2, c2, 'S02', 'APPROVE', 'u_sadmin'); act(env2, c2, 'S03', 'APPROVE', 'u_head');
        act(env2, c2, 'S04', 'SUPPLEMENT', 'u_legal', { supplementItems: ['DOC'] });
        env2.C.recordAction(c2, { step: 'S01', userId: env2.C.repActorOf(c2) }, 'RESUBMIT', '문구 고침', env2.U('u_sales1'), {});
        if (stateOf(c2, 'S02') !== 'DONE' || stateOf(c2, 'S04') !== 'PENDING') return '대조(금액 그대로): ② ' + stateOf(c2, 'S02') + ', ④ ' + stateOf(c2, 'S04');
        return true;
      },
    },
  ],
  serverOnly: [
    '②를 처리하지 않았는데 ④ 담당자가 승인 요청을 직접 보냄(화면 단추를 거치지 않음): 시안 recordAction은 차례를 다시 검사하지 않아 ②가 차례인데도 ④가 승인됨(이번 점검에서 직접 불러 확인). 서버가 결재 기록으로 지금 차례인지 다시 계산해 거부',
    '② 승인 없이 다음 묶음으로 넘어가는 요청, ②를 지우는 요청: 서버가 ②를 언제나 만들고 지울 수 없게 함(시안은 저장할 때 결재란을 다시 만들 뿐 요청을 거절하지는 않음)',
    '보완 완료에서 금액이나 답이 실제로 바뀌었는지: 서버가 앞 값과 견줘 ②부터 다시 할지 정함. 시안은 보완 중 내용을 고칠 수 없어 기안자의 "바꿨습니다" 표시(restart)만 믿음',
  ],
};
