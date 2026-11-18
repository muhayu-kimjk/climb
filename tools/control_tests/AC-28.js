// AC-28 보완 뒤 다시 결재 (CTL-46, 06 통제 목록 2장) 시험 (2026-11-13 주말 점검 W2)
//   결재 문서를 가짜 문서에 올려 단추와 확인 창을 누르는 도우미(page, review, doStep)는 lib.js에 있음(전에 이 파일에 있었고 AC-19~AC-35, AC-55도 함께 씀)
'use strict';
const { review } = require('./lib');

const pend = c => (c.approvals || []).filter(a => a.state === 'PENDING').map(a => a.step);
const stateOf = (c, step) => ((c.approvals || []).find(a => a.step === step) || {}).state;

// 시안 계약 2610CL003: ②, ③, ⑤ 승인, ④ 법무(u_legal) 차례, 기안자 정하은(u_sales2)
//   ④가 보완 요청(첨부 파일)하고 기안자가 보완 완료까지 해 둔 env를 돌려줌. restart: "금액이나 체크리스트 답을 바꿨습니다" 표시
function supplementThenResubmit(h, restart) {
  const env = h.fresh({ role: 'SALES' });
  const c = env.contract('2610CL003');
  const lg = review(env, '2610CL003', 'u_legal');
  if (!lg.hasButton('SUPPLEMENT', 'S04')) return { env, c, why: '법무에게 ④ 보완 요청 단추가 없음' };
  lg.open('SUPPLEMENT', 'S04').pick('ATTACH').comment('첨부한 보안 서약서 판이 다름').confirm();
  if (c.status !== 'SUPPLEMENT') return { env, c, why: '보완 요청 뒤 상태가 보완 중이 아님: ' + c.status };
  const rp = review(env, '2610CL003', 'u_sales2');
  if (!rp.hasButton('RESUBMIT', 'S01')) return { env, c, why: '기안자에게 보완 완료 단추가 없음' };
  rp.open('RESUBMIT', 'S01').comment(restart ? '금액이나 답을 바꿨다고 표시함' : '첨부만 다시 올림').restart(restart).confirm();
  if (!c.history.some(x => x.action === 'RESUBMIT')) return { env, c, why: '보완 완료가 결재 기록에 남지 않음' };
  return { env, c, why: '' };
}

module.exports = {
  ac: 'AC-28',
  title: '보완 뒤 다시 결재',
  tests: [
    {
      name: '④ 보완 요청 뒤 첨부만 고쳐 보완 완료하면 ④부터 이어서 결재(2610CL003)',
      kind: 'ok',
      run(h) {
        const x = supplementThenResubmit(h, false);
        if (x.why) return x.why;
        const c = x.c;
        if (c.status !== 'IN_REVIEW') return '보완 완료 뒤 상태가 검토 중이 아님: ' + c.status;
        if (pend(c).join(',') !== 'S04') return '④부터 이어지지 않음. 지금 차례: ' + pend(c).join(',');
        if (['S02', 'S03', 'S05'].some(s => stateOf(c, s) !== 'DONE')) return '앞서 받은 ②, ③, ⑤ 승인이 그대로가 아님';
        return true;
      },
    },
    {
      name: '보완 완료 창에서 "금액이나 체크리스트 답을 바꿨습니다"를 표시하면 ②부터 다시 결재하고 처음 ②, ③ 승인 기록은 남음(2610CL003)',
      kind: 'ok',
      run(h) {
        // 2026-11-13 이름 바로잡음(점검 지적): 전에는 "금액을 고쳐"였으나 이 시험은 금액을 바꾸지 않고 보완 완료 창의 표시(#act-restart)만 켬.
        //   시안은 보완 중에 금액이나 답을 고칠 수 없어 기안자가 스스로 표시하게 했음(06 AC-17 되는 경우, AC-28 안 되는 경우 첫 줄).
        //   보완 전후의 금액과 답을 직접 견주어 ②부터 다시 할지 정하는 것은 서버 몫(아래 serverOnly 첫 줄)이라 이 틀로는 시험하지 않음
        const x = supplementThenResubmit(h, true);
        if (x.why) return x.why;
        const c = x.c;
        if (pend(c).join(',') !== 'S02') return '②부터 다시 시작하지 않음. 지금 차례: ' + pend(c).join(',');
        if (['S03', 'S04', 'S05'].some(s => stateOf(c, s) !== 'WAITING')) return '③~⑤가 대기로 돌아가지 않음: ' + ['S03', 'S04', 'S05'].map(s => s + ' ' + stateOf(c, s)).join(', ');
        const kept = s => c.history.some(e => e.step === s && e.action === 'APPROVE' && (e.round || 1) === 1);
        if (!kept('S02') || !kept('S03')) return '처음 ②, ③ 승인 기록이 결재 기록에 남지 않음';
        return true;
      },
    },
    {
      name: '보완 중에는 어느 단계도 승인할 수 없음(최고관리자 시연 포함)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'LEGAL' });
        const c = env.contract('2610CL003');
        review(env, '2610CL003', 'u_legal').open('SUPPLEMENT', 'S04').pick('DOC').comment('조항 문구 확인 필요').confirm();
        if (c.status !== 'SUPPLEMENT') return '보완 요청이 되지 않아 시험할 수 없음: ' + c.status;
        if (pend(c).length) return '보완 중인데 차례인 단계가 남음: ' + pend(c).join(',');
        const people = ['u_legal', 'u_privacy', 'u_sadmin', 'u_eunseong_ko', 'u_ga', 'u_super'];
        const can = [];
        c.approvals.forEach(s => people.forEach(p => { if (env.C.canAct(c, s, env.U(p))) can.push(s.step + ' ' + p); }));
        if (can.length) return '보완 중인데 처리할 수 있음: ' + can.join(', ');
        if (['u_legal', 'u_privacy', 'u_super'].some(p => /data-open="APPROVE"/.test(review(env, '2610CL003', p).bar()))) return '보완 중인데 결재 문서에 승인 단추가 보임';
        return true;
      },
    },
    {
      name: '보완 요청 사유를 비우면 남지 않음',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'LEGAL' });
        const c = env.contract('2610CL003'), n = c.history.length;
        const rv = review(env, '2610CL003', 'u_legal').open('SUPPLEMENT', 'S04').pick('ATTACH').comment('');
        rv.confirm();
        if (c.history.length !== n || c.status !== 'IN_REVIEW') return '사유 없이 보완 요청이 남음: ' + c.status;
        if (!rv.modalOpen()) return '확인 창이 닫힘(오류 안내 없이)';
        // 같은 창에서 사유만 채우면 남음(막힌 까닭이 사유 빈칸인지 확인)
        rv.comment('첨부 파일 판이 다름').confirm();
        if (c.status !== 'SUPPLEMENT') return '사유를 채워도 보완 요청이 남지 않음(시험 전제가 맞지 않음)';
        return true;
      },
    },
    {
      name: '보완 완료 사유(고친 내용)를 비우면 남지 않음',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const c = env.contract('2610CL003');
        review(env, '2610CL003', 'u_legal').open('SUPPLEMENT', 'S04').pick('ATTACH').comment('첨부 다시').confirm();
        if (c.status !== 'SUPPLEMENT') return '보완 요청이 되지 않아 시험할 수 없음';
        const n = c.history.length;
        const rv = review(env, '2610CL003', 'u_sales2').open('RESUBMIT', 'S01').comment('');
        rv.confirm();
        if (c.history.length !== n || c.status !== 'SUPPLEMENT') return '고친 내용 없이 보완 완료가 남음: ' + c.status;
        rv.comment('첨부 다시 올림').confirm();
        if (c.status !== 'IN_REVIEW') return '고친 내용을 채워도 보완 완료가 남지 않음(시험 전제가 맞지 않음)';
        return true;
      },
    },
    {
      name: '기안자(지금 영업대표)가 아닌 사람에게는 보완 완료가 없음',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const c = env.contract('2610CL003');
        review(env, '2610CL003', 'u_legal').open('SUPPLEMENT', 'S04').pick('ATTACH').comment('첨부 다시').confirm();
        if (c.status !== 'SUPPLEMENT') return '보완 요청이 되지 않아 시험할 수 없음';
        const who = ['u_legal', 'u_sales1', 'u_eunseong_ko', 'u_sadmin', 'u_admin'].filter(p => review(env, '2610CL003', p).hasButton('RESUBMIT', 'S01'));
        if (who.length) return '기안자가 아닌데 보완 완료 단추가 보임: ' + who.join(', ');
        if (env.C.myActions(env.U('u_sales1')).some(x => x.id === '2610CL003')) return '기안자가 아닌 영업의 할 일에 보완이 들어감';
        if (!review(env, '2610CL003', 'u_sales2').hasButton('RESUBMIT', 'S01')) return '기안자에게도 보완 완료 단추가 없음(시험 전제가 맞지 않음)';
        return true;
      },
    },
    {
      name: '관리자가 결재를 앞 단계로 되돌리는 기능이 없음',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'ADMIN' });
        const { C, D } = env;
        const admin = env.U('u_admin');
        const c = env.contract('2610CL003');
        const can = c.approvals.filter(s => C.canAct(c, s, admin) || C.canCancel(c, s, admin)).map(s => s.step);
        if (can.length) return '관리자가 처리하거나 승인 취소할 수 있는 단계: ' + can.join(',');
        const bar = review(env, '2610CL003', 'u_admin').bar();
        if (/data-open=/.test(bar)) return '관리자 결재 문서에 처리 단추가 보임: ' + bar.slice(0, 120);
        const back = Object.keys(D.APPROVAL_ACTIONS).filter(k => /ROLLBACK|REVERT|REWIND|RESET|BACKWARD|REOPEN/.test(k));
        if (back.length) return '결재를 되돌리는 한 일 코드가 있음: ' + back.join(',');
        const fn = Object.keys(C).filter(k => /rollback|revert|rewind|resetApproval|reopen/i.test(k));
        if (fn.length) return '결재를 되돌리는 공통 기능이 있음: ' + fn.join(',');
        return true;
      },
    },
  ],
  serverOnly: [
    '시안은 기안자가 "금액이나 체크리스트 답을 바꿨습니다"를 스스로 표시함: 금액을 바꾸고 표시하지 않으면 ③을 피할 수 있으므로, 서버가 보완 완료 때 제품과 답을 앞 보완 순번 값과 직접 비교해 ②부터 다시 할지 정해야 함(시안은 비교하지 않음)',
    '보완 중 다른 단계 승인, 기안자가 아닌 사람의 보완 완료, 사유 빈칸을 요청으로 직접 보내는 것: 시안 recordAction은 다시 검사하지 않아 서버가 막아야 함',
    '금액이 바뀌면 2, 3번과 결재선을 서버가 다시 계산함(REQ-REV-11 [가정])',
  ],
};
