// AC-24 담당자나 유효한 대리만 처리 (CTL-40) 시험 (2026-11-13 주말 점검 W2)
//   06 통제 목록 2장 AC-24의 기대 동작: ②~⑩을 처리한 사람은 그 단계 담당자이거나, 처리 일시에 효력이 있는 대리 지정의 대신할 사람이다.
//   CTL-40: 단계 담당이 아닌 분야 리더(영업지원, 정보보호, 고객지원), 관리자, 재무 리더와 재무 임원은 남의 차례를 보기만 한다.
//   시안은 common.js canAct(처리 막대), isMyStep, activeDelegation(대리 상태는 시연 날짜 D.TODAY = 2026-10-19 기준)으로 막음
'use strict';

function fixClock(env) {
  const Base = env.ctx.Date;
  let n = 0;
  env.ctx.Date = class extends Base { constructor(...a) { if (a.length) super(...a); else super(2026, 9, 19, 20, n++, 0); } };
}
const step = (c, code) => (c.approvals || []).find(a => a.step === code);
// 고객지원 임하준(⑨ 담당)의 대리로 같은 고객지원 편하린을 지정
const deleg = (from, to, extra) => D => D.DELEGATIONS.push(Object.assign({ id: 'DL-T24', absentId: 'u_cem', delegateId: 'u_harin_pyeon', from: from, to: to,
  reason: '임하준님 휴가(시험). 같은 고객지원 담당자 편하린님이 운영 적용을 대신함', by: 'u_admin', at: '2026-10-10 10:00', endedAt: null }, extra || {}));
// 2609CL004의 ⑨를 대신할 사람이 처리
function behalfRun(h, from, to) {
  const env = h.fresh({ role: 'CEM', hook: deleg(from, to) });
  fixClock(env);
  const { C, U } = env;
  const c = env.contract('2609CL004');
  const s9 = step(c, 'S09');
  if (!s9 || s9.state !== 'PENDING' || s9.userId !== 'u_cem') return '2609CL004가 임하준의 ⑨ 차례가 아님';
  const sub = U('u_harin_pyeon');
  if (!C.canAct(c, s9, sub)) return '대리 기간(' + from + '~' + to + ') 안인데 편하린이 ⑨를 처리할 수 없음';
  // 결재 문서를 그려 대신할 사람에게 ⑨ 처리 단추와 "임하준 대신"이 보이는지(lib.js의 review 도우미)
  let review = null;
  try { review = require('./lib').review; } catch (err) { return '결재 문서 도우미(lib.js review)를 불러오지 못함'; }
  const rv = review(env, '2609CL004', sub);
  if (rv.error) return '결재 문서를 그리지 못함: ' + rv.error.message;
  if (!rv.hasButton('APPROVE', 'S09') || rv.bar().indexOf('임하준 대신') < 0) return '대신할 사람의 결재 문서에 ⑨ 처리 단추나 "임하준 대신"이 없음';
  const e =C.recordAction(c, s9, 'APPROVE', '확인: ' + C.opsChecksFor(c).join(', '), sub, { openDate: '2026-10-19' });
  if (!e) return '처리 기록이 남지 않음';
  if (e.actorId !== 'u_harin_pyeon' || e.onBehalfOf !== 'u_cem') return '기록에 원래 담당자 대신이 남지 않음: ' + e.actorId + ' / ' + e.onBehalfOf;
  if (e.delegationId !== 'DL-T24') return '기록에 대리 지정 번호가 없음: ' + e.delegationId;
  if (!/편하린님이 운영 적용을 대신함/.test(e.basis || '')) return '기록에 대리 근거가 없음: ' + e.basis;
  const after = step(c, 'S09');
  if (after.state !== 'DONE' || after.onBehalfOf !== 'u_cem' || after.delegationId !== 'DL-T24') return '결재란 ⑨에 대신 처리가 보이지 않음';
  return true;
}

module.exports = {
  ac: 'AC-24',
  title: '담당자나 유효한 대리만 처리',
  tests: [
    {
      name: '대리 기간 첫날(오늘 시작)에 대신할 사람이 ⑨를 처리하면 원래 담당자 대신, 대리 지정 번호, 근거가 남음(2609CL004)',
      kind: 'ok',
      run(h) { return behalfRun(h, '2026-10-19', '2026-10-23'); },
    },
    {
      name: '대리 기간 마지막 날(오늘 끝)에도 대신 처리가 되고 같은 기록이 남음(2609CL004)',
      kind: 'ok',
      run(h) { return behalfRun(h, '2026-10-15', '2026-10-19'); },
    },
    {
      name: '담당이 아니고 대리도 아닌 사람은 처리 막대가 없음(2609CL004 ⑨)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'CEM' });
        const { C, U } = env;
        const c = env.contract('2609CL004');
        const s9 = step(c, 'S09');
        for (const id of ['u_harin_pyeon', 'u_legal', 'u_sadmin', 'u_admin', 'u_head']) {
          if (C.canAct(c, s9, U(id))) return U(id).role + '(' + id + ')가 남의 ⑨ 차례를 처리할 수 있음';
        }
        if (!C.canAct(c, s9, U('u_cem'))) return '견줌: 담당자 임하준도 처리할 수 없음(시험 전제가 틀림)';
        // 결재 문서를 그려도 담당자만 ⑨ 처리 단추가 있음(lib.js의 review 도우미)
        let review = null;
        try { review = require('./lib').review; } catch (e) { return '결재 문서 도우미(lib.js review)를 불러오지 못함'; }
        for (const id of ['u_harin_pyeon', 'u_admin', 'u_cem']) {
          const rv = review(env, '2609CL004', id);
          if (rv.error) return '결재 문서를 그리지 못함: ' + rv.error.message;
          if (rv.hasButton('APPROVE', 'S09') !== (id === 'u_cem')) return id + '의 결재 문서에 ⑨ 처리 단추가 ' + (id === 'u_cem' ? '없음' : '그려짐');
        }
        return true;
      },
    },
    {
      name: '대리 기간이 끝난 다음 날에는 대신할 사람이 처리하지 못함(어제 끝난 지정)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'CEM', hook: deleg('2026-10-15', '2026-10-18') });
        const { C, U } = env;
        const c = env.contract('2609CL004');
        if (C.delegationState(env.D.DELEGATIONS.find(d => d.id === 'DL-T24')) !== 'ENDED') return '어제 끝난 대리 지정이 끝남으로 보이지 않음';
        if (C.canAct(c, step(c, 'S09'), U('u_harin_pyeon'))) return '끝난 대리 지정으로 ⑨를 처리할 수 있음';
        return true;
      },
    },
    {
      name: '관리자가 대리 지정을 끝낸 뒤에는 대신할 사람이 처리하지 못함(결재선 규칙의 끝내기)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'ADMIN', hook: deleg('2026-10-19', '2026-10-23') });
        fixClock(env);
        const { C, U } = env;
        const c = env.contract('2609CL004');
        if (!C.canAct(c, step(c, 'S09'), U('u_harin_pyeon'))) return '끝내기 전에도 대신 처리할 수 없음(시험 전제가 틀림)';
        const e = C.adminSave('RULE', '⑨ 운영 적용 대리 지정', '대리 지정 끝냄: 임하준 → 편하린', '휴가 취소로 일찍 복귀', { k: 'DELEGATE_END', id: 'DL-T24' });
        if (!e || e.refused) return '관리자가 대리 지정을 끝내지 못함';
        if (C.canAct(c, step(c, 'S09'), U('u_harin_pyeon'))) return '관리자가 끝낸 대리 지정으로 ⑨를 처리할 수 있음';
        return true;
      },
    },
    {
      name: '시작 전(예정) 대리 지정으로는 처리하지 못함(내일 시작)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'CEM', hook: deleg('2026-10-20', '2026-10-23') });
        const { C, U } = env;
        const c = env.contract('2609CL004');
        if (C.delegationState(env.D.DELEGATIONS.find(d => d.id === 'DL-T24')) !== 'PLANNED') return '내일 시작하는 대리 지정이 예정으로 보이지 않음';
        if (C.canAct(c, step(c, 'S09'), U('u_harin_pyeon'))) return '시작 전 대리 지정으로 ⑨를 처리할 수 있음';
        return true;
      },
    },
    {
      name: '분야 리더(영업지원, 정보보호, 고객지원)와 재무 리더, 재무 임원은 분야 차례 목록에서 보기만 하고 처리하지 못함',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'CEM_LEAD' });
        const { C, U } = env;
        const cases = [
          ['u_yeonwoo_joo', '2609CL004', 'S09', ['S09', 'S10', 'SXP']],
          ['u_seojin_ma', '2609CL001', 'S10', ['S09', 'S10', 'SXP']],
          ['u_jaewon_kook', '2609CL001', 'S10', ['S09', 'S10', 'SXP']],
          ['u_jihoon_eom', '2610CL010', 'S02', ['S02', 'S03', 'S04', 'S05', 'S06', 'S08']],
          ['u_seungho_yeo', '2610CL002', 'S05', ['S02', 'S03', 'S04', 'S05', 'S06', 'S08']],
        ];
        let review = null;
        try { review = require('./lib').review; } catch (e) { return '결재 문서 도우미(lib.js review)를 불러오지 못함'; }
        for (const [uid, cid, code, steps] of cases) {
          const u = U(uid), c = env.contract(cid), s = step(c, code);
          if (!s || s.state !== 'PENDING') return cid + ' ' + code + '가 차례가 아님(시험 전제가 틀림)';
          if (!C.areaQueue(u, steps).some(x => x.c.id === cid && x.s.step === code)) return u.role + '의 분야 차례 목록에 ' + cid + ' ' + code + '가 없음(시험 전제가 틀림)';
          if (C.canAct(c, s, u)) return u.role + '(' + uid + ')가 분야 목록의 ' + cid + ' ' + code + '를 처리할 수 있음';
          // 분야 목록에서 결재 문서를 열어도 그 차례의 처리 단추가 없음
          const rv = review(env, cid, u);
          if (rv.error) return cid + ' 결재 문서를 그리지 못함: ' + rv.error.message;
          if (new RegExp('data-open="[A-Z]+" data-step="' + code + '"').test(rv.bar())) return u.role + '(' + uid + ')의 ' + cid + ' 결재 문서에 ' + code + ' 처리 단추가 그려짐';
        }
        return true;
      },
    },
    {
      name: '담당자를 바꾼 뒤 이미 차례였던 단계는 새 담당자가 아니라 원래 담당자가 처리(2609CL004 ⑨)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'CEM', hook: D => D.ASSIGNEE_CHANGES.push({ step: 'S09', to: 'u_harin_pyeon', at: '2026-10-19 08:00' }) });
        const { C, U } = env;
        const c = env.contract('2609CL004');
        const s9 = step(c, 'S09');
        if (C.assigneeOf('S09') !== 'u_harin_pyeon') return '담당자 바꾸기가 반영되지 않음(시험 전제가 틀림)';
        if (s9.userId !== 'u_cem') return '이미 차례였던 ⑨의 담당이 새 담당자로 바뀜: ' + s9.userId;
        if (C.canAct(c, s9, U('u_harin_pyeon'))) return '새 담당자가 이미 차례였던 ⑨를 처리할 수 있음';
        if (!C.canAct(c, s9, U('u_cem'))) return '원래 담당자가 처리할 수 없음';
        return true;
      },
    },
    {
      name: '같은 단계를 승인한 뒤에는 다시 처리 막대가 없고 승인 기록은 한 줄(2609CL004 ⑨)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'CEM' });
        fixClock(env);
        const { C, U } = env;
        const c = env.contract('2609CL004');
        const cem = U('u_cem');
        if (!C.recordAction(c, step(c, 'S09'), 'APPROVE', '확인: ' + C.opsChecksFor(c).join(', '), cem, { openDate: '2026-10-19' })) return '첫 승인이 남지 않음';
        if (C.canAct(c, step(c, 'S09'), cem)) return '승인한 ⑨를 다시 처리할 수 있음';
        const n = c.history.filter(x => x.step === 'S09' && x.action === 'APPROVE' && (x.round || 1) === (c.round || 1)).length;
        if (n !== 1) return '⑨ 승인 기록이 한 줄이 아님: ' + n;
        return true;
      },
    },
  ],
  serverOnly: [
    '담당이 아닌 사람이 승인 요청을 직접 보냄, 같은 승인을 두 번 보냄: 서버가 처리 요청마다 결재 기록으로 다시 확인(시안의 recordAction은 canAct를 다시 보지 않음)',
    '최고관리자가 담당 대신 처리(시안 시연): 실제 시스템에는 없어야 함. 시안은 시연용으로 허용',
    '대리 상태를 서버 시각으로 판단하고, 대신할 사람이 지금도 그 역할이고 사용 중인지 다시 봄: 서버 몫(시안은 시연 날짜를 쓰고 역할과 사용 상태를 보지 않음)',
  ],
};
