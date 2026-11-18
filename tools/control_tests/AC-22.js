// AC-22 자기 결재 금지 (CTL-38) 시험 (2026-11-13 주말 점검 W2)
//   06 통제 목록 2장 AC-22의 기대 동작: ⑦을 빼고, 처리한 사람이 기안자와 같은 결재 기록은 하나도 없다.
//   CTL-38: 대리 지정의 대신할 사람이거나 관리자, 최고관리자여도 마찬가지. 시안은 common.js canAct, canCancel(처리 막대와 승인 취소 단추)이 막음
'use strict';

const step = (c, code) => (c.approvals || []).find(a => a.step === code);
// 검토 대기 화면(review-queue.js)이 찾는 단계
const QUEUE_STEPS = ['S02', 'S03', 'S03C', 'SGR', 'SST', 'S04', 'S05', 'S06', 'SSB', 'SSE', 'S08'];
const setReq = (id, who) => D => { D.CONTRACTS.find(x => x.id === id).requesterId = who; };

module.exports = {
  ac: 'AC-22',
  title: '자기 결재 금지',
  tests: [
    {
      name: '최고관리자로 기안한 계약은 ② 차례여도 최고관리자에게 처리 막대가 없음(다른 사람 계약은 있음)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SUPER', hook: setReq('2610CL010', 'u_super') });
        const { C, U } = env;
        const sup = U('u_super');
        const c = env.contract('2610CL010');
        const s2 = step(c, 'S02');
        if (!s2 || s2.state !== 'PENDING') return '2610CL010이 ② 차례가 아님';
        if (C.canAct(c, s2, sup)) return '최고관리자가 자기가 기안한 계약의 ②를 처리할 수 있음';
        const other = env.contract('2610CL006');
        if (!C.canAct(other, step(other, 'S03'), sup)) return '견줌: 다른 사람 계약(2610CL006 ③)도 최고관리자 처리 막대가 없음(시험 전제가 틀림)';
        // 결재 문서를 그려 처리 막대의 단추를 봄(lib.js의 review 도우미)
        let review = null;
        try { review = require('./lib').review; } catch (e) { return '결재 문서 도우미(lib.js review)를 불러오지 못함'; }
        const mine = review(env, '2610CL010', sup), theirs = review(env, '2610CL006', sup);
        if (mine.error || theirs.error) return '결재 문서를 그리지 못함: ' + ((mine.error || theirs.error).message);
        if (/data-open="(APPROVE|REJECT|SUPPLEMENT)"/.test(mine.bar())) return '최고관리자가 기안한 2610CL010 결재 문서에 처리 단추가 그려짐';
        if (!theirs.hasButton('APPROVE', 'S03')) return '견줌: 다른 사람 계약 2610CL006 결재 문서에 최고관리자 ③ 승인 단추가 없음';
        return true;
      },
    },
    {
      name: '영업지원 담당자가 기안한 계약은 그 사람의 검토 대기에 ② 차례로 나오지 않음',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES_ADMIN', hook: setReq('2610CL010', 'u_sadmin') });
        const { C, U } = env;
        const sa = U('u_sadmin');
        const c = env.contract('2610CL010');
        const s2 = step(c, 'S02');
        if (s2.userId === 'u_sadmin') return '② 담당이 기안자(배수아) 그대로임';
        if (C.pendingQueue(sa, false, QUEUE_STEPS).some(x => x.c.id === '2610CL010')) return '기안자 배수아의 검토 대기에 자기 계약이 나옴';
        if (C.canAct(c, s2, sa)) return '기안자 배수아가 자기 계약의 ②를 처리할 수 있음';
        return true;
      },
    },
    {
      name: '기안자는 자기 계약의 어느 차례도 처리 막대가 없음(⑦ 빼고, 자기 역할과 최고관리자 역할 모두)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SUPER' });
        const { D, C, U } = env;
        const bad = [];
        let n = 0;
        D.CONTRACTS.forEach(c => {
          if (!c.id || !c.requesterId) return;
          (c.approvals || []).filter(s => s.state === 'PENDING' && s.step !== 'S07').forEach(s => {
            n++;
            const me = U(c.requesterId);
            if (C.canAct(c, s, me)) bad.push(c.id + ' ' + s.step + ' ' + c.requesterId);
            if (C.canAct(c, s, U(c.requesterId, 'SUPER'))) bad.push(c.id + ' ' + s.step + ' ' + c.requesterId + '(최고관리자 역할)');
          });
        });
        if (!n) return '살펴볼 차례가 없음';
        if (bad.length) return '기안자가 처리할 수 있는 차례: ' + bad.slice(0, 5).join('; ');
        return true;
      },
    },
    {
      name: '기안자가 그 단계 담당자의 대리로 지정된 기간에도 자기 계약은 처리하지 못함(2610CL006 ③)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({
          role: 'SALES',
          hook: D => D.DELEGATIONS.push({ id: 'DL-T22', absentId: 'u_head', delegateId: 'u_sales1', from: '2026-10-19', to: '2026-10-21',
            reason: '시험: 기안자를 리더의 대리로 지정', by: 'u_admin', at: '2026-10-18 10:00', endedAt: null }),
        });
        const { C, U } = env;
        const c = env.contract('2610CL006');
        const s3 = step(c, 'S03'), me = U('u_sales1');
        if (!C.activeDelegation('u_head', 'u_sales1')) return '시험용 대리 지정이 진행 중이 아님';
        if (C.canAct(c, s3, me)) return '기안자 이도윤이 대리 지정으로 자기 계약의 ③을 처리할 수 있음';
        return true;
      },
    },
    {
      name: '기안자가 관리자나 최고관리자 역할도 가져도 자기 계약은 처리하지 못함(2610CL006)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SUPER' });
        const { C, U } = env;
        const c = env.contract('2610CL006');
        const s3 = step(c, 'S03');
        for (const r of ['ADMIN', 'SUPER']) {
          if (C.canAct(c, s3, U('u_sales1', r))) return '기안자 이도윤이 ' + r + ' 역할로 자기 계약의 ③을 처리할 수 있음';
        }
        return true;
      },
    },
    {
      name: '승인 취소, 보완 요청, 반려도 기안자는 못 함(2610CL006 ② 승인 취소, ③ 처리 막대)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SUPER' });
        const { C, U } = env;
        const c = env.contract('2610CL006');
        const s2 = step(c, 'S02'), s3 = step(c, 'S03');
        if (!C.canCancel(c, s2, U('u_super'))) return '견줌: 최고관리자 시연으로도 ② 승인 취소가 안 되는 상태(시험 전제가 틀림)';
        for (const r of ['SALES', 'ADMIN', 'SUPER']) {
          const me = U('u_sales1', r);
          if (C.canCancel(c, s2, me)) return '기안자가 ' + r + ' 역할로 ② 승인을 취소할 수 있음';
          if (C.canAct(c, s3, me)) return '기안자가 ' + r + ' 역할로 ③ 처리 막대(보완 요청, 반려 포함)를 씀';
        }
        // 기안자로 결재 문서를 그려도 승인 취소, 보완 요청, 반려, 승인 단추가 하나도 없음(lib.js의 review 도우미)
        let review = null;
        try { review = require('./lib').review; } catch (e) { return '결재 문서 도우미(lib.js review)를 불러오지 못함'; }
        for (const r of ['SALES', 'SUPER']) {
          const rv = review(env, '2610CL006', U('u_sales1', r));
          if (rv.error) return '기안자로 결재 문서를 그리지 못함: ' + rv.error.message;
          const m = rv.bar().match(/data-open="(CANCEL|SUPPLEMENT|REJECT|APPROVE)"/);
          if (m) return '기안자(' + r + ' 역할)의 결재 문서에 ' + m[1] + ' 단추가 그려짐';
        }
        if (!review(env, '2610CL006', 'u_head').hasButton('APPROVE', 'S03')) return '견줌: ③ 담당 리더 최민준의 결재 문서에도 ③ 승인 단추가 없음(시험 전제가 틀림)';
        if (!review(env, '2610CL006', 'u_sadmin').hasButton('CANCEL', 'S02')) return '견줌: ② 승인자 배수아의 결재 문서에도 ② 승인 취소 단추가 없음(시험 전제가 틀림)';
        return true;
      },
    },
    {
      name: '영업대표를 바꾸면 새 영업대표도 대리 지정이나 최고관리자 역할로 그 계약을 처리하거나 승인 취소하지 못함(C-44, 2610CL006)',
      kind: 'deny',
      run(h) {
        // 01 REQ-AUTH-16(기획자 결정 2026-11-03 C-44): 새 영업대표도 그 계약의 결재 단계를 처리하거나 승인 취소하지 않음(⑦ 빼고)
        //   정하은(u_sales2)을 리더 최민준의 대리로 지정해 두고, 2610CL006의 영업대표를 이도윤에서 정하은으로 바꿈
        const dl = D => D.DELEGATIONS.push({ id: 'DL-T22B', absentId: 'u_head', delegateId: 'u_sales2', from: '2026-10-19', to: '2026-10-21',
          reason: '시험: 정하은을 리더의 대리로 지정', by: 'u_admin', at: '2026-10-18 10:00', endedAt: null });
        const oc = D => D.OWNER_CHANGES.push({ id: 'OC-T22', bundleId: '2610CL006', from: 'u_sales1', to: 'u_sales2', by: 'u_head', byDept: '비즈니스1유닛',
          at: '2026-10-18 11:00', reason: '시험: 영업대표 바꿈', salesTeam: '비즈니스1유닛' });
        // 견줌: 영업대표를 바꾸지 않았으면 대리 지정으로 ③을 처리할 수 있음
        const base = h.fresh({ role: 'SALES', hook: dl });
        const c0 = base.contract('2610CL006');
        if (!base.C.canAct(c0, step(c0, 'S03'), base.U('u_sales2'))) return '견줌: 영업대표가 아닌 정하은이 대리 지정으로 ③을 처리할 수 없음(시험 전제가 틀림)';
        const env = h.fresh({ role: 'SALES', hook: D => { dl(D); oc(D); } });
        const { C, U } = env;
        const c = env.contract('2610CL006');
        if (C.salesRepOf(c) !== 'u_sales2') return '영업대표 바꾸기가 반영되지 않음: ' + C.salesRepOf(c);
        for (const r of ['SALES', 'SUPER']) {
          const me = U('u_sales2', r);
          if (C.canAct(c, step(c, 'S03'), me)) return '새 영업대표 정하은이 ' + r + ' 역할로 ③을 처리할 수 있음';
          if (C.canCancel(c, step(c, 'S02'), me)) return '새 영업대표 정하은이 ' + r + ' 역할로 ② 승인을 취소할 수 있음';
        }
        return true;
      },
    },
    {
      name: '결재 기록 전체에서 처리한 사람과 그 차수 기안자가 같은 줄이 없음(⑦ 빼고)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SUPER' });
        const { D, C } = env;
        const ACTS = ['APPROVE', 'REJECT', 'CANCEL', 'SUPPLEMENT', 'RETURN'];
        const STEPS = ['S02', 'S03', 'S03C', 'S04', 'S05', 'S06', 'S08', 'S09', 'S10'];
        const bad = [];
        let n = 0;
        D.CONTRACTS.forEach(c => {
          if (!c.id || c.legacy) return;
          const hist = c.history || [];
          hist.forEach(x => {
            if (STEPS.indexOf(x.step) < 0 || ACTS.indexOf(x.action) < 0) return;
            n++;
            const r = x.round || 1;
            const sub = hist.find(y => y.action === 'SUBMIT' && (y.round || 1) === r);
            const drafter = r === (c.round || 1) ? c.requesterId : sub ? sub.actorId : c.requesterId;
            if (x.actorId === drafter) bad.push(c.id + ' ' + r + '차 ' + x.step + ' ' + x.action + ' ' + x.actorId);
          });
        });
        if (!n) return '살펴볼 결재 기록이 없음';
        if (bad.length) return '기안자가 처리한 결재 기록: ' + bad.slice(0, 5).join('; ');
        return true;
      },
    },
  ],
  serverOnly: [
    '기안자가 결재 문서 주소로 승인, 보완 요청, 반려, 승인 취소 요청을 직접 보냄: 서버 거부와 기록(시안의 recordAction은 처리하는 사람과 기안자를 다시 비교하지 않음)',
    '모든 처리 요청에서 처리하는 사람과 기안자를 서버가 비교: 서버 몫',
  ],
};
