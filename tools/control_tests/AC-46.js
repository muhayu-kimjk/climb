// AC-46 결재 기록은 덧붙이기만 (CTL-115, 06 통제 목록 2장) 시험 (2026-11-13 주말 점검 W2)
//   기대 동작: 결재 기록에는 수정과 삭제 기능이 없고, 일시는 서버 시각이다.
//   시안 코드: common.js recordAction(덧붙이기만), review.js renderHistory(그때 조직 actorDept)
// 함께 쓰는 도우미(시계 고정 fixClock, 글 다듬기 strip, 가짜 입력 창 withModal, 단추 누름 clickTarget, 화면 올리기 pageAs)는 lib.js에 있음(전에 이 파일의 lib였고 AC-47~AC-55도 함께 씀)
'use strict';
const { fixClock, strip, step, pageAs: page } = require('./lib');

/* ---------- AC-46 시험 ---------- */
// 고객지원 임하준(⑨ 담당)의 대리로 같은 고객지원 편하린을 오늘부터 지정
const DELEG = D => D.DELEGATIONS.push({ id: 'DL-T46', absentId: 'u_cem', delegateId: 'u_harin_pyeon', from: '2026-10-19', to: '2026-10-23',
  reason: '임하준님 휴가(시험). 같은 고객지원 담당자 편하린님이 운영 적용을 대신함', by: 'u_admin', at: '2026-10-10 10:00', endedAt: null });

module.exports = {
  ac: 'AC-46',
  title: '결재 기록은 덧붙이기만',
  tests: [
    {
      name: '대리 처리 줄에 누구 대신, 대리 지정 번호, 근거가 채워지고, 나중에 조직 이름을 바꿔도 기록에는 그때 조직이 보임(2609CL004 ⑨)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'ADMIN', hook: DELEG });
        fixClock(env);
        const { C, D, U } = env;
        const c = env.contract('2609CL004');
        const s9 = step(c, 'S09');
        const sub = U('u_harin_pyeon');
        if (!s9 || s9.state !== 'PENDING' || s9.userId !== 'u_cem') return '2609CL004가 임하준의 ⑨ 차례가 아님(시험 전제)';
        if (!C.canAct(c, s9, sub)) return '대리 기간 안인데 편하린이 ⑨를 처리할 수 없음';
        const e = C.recordAction(c, s9, 'APPROVE', '확인: ' + C.opsChecksFor(c).join(', '), sub, { openDate: D.TODAY });
        if (!e) return '처리 기록이 남지 않음';
        if (e.onBehalfOf !== 'u_cem') return '누구 대신이 남지 않음: ' + e.onBehalfOf;
        if (e.delegationId !== 'DL-T46') return '대리 지정 번호가 남지 않음: ' + e.delegationId;
        if (!/편하린님이 운영 적용을 대신함/.test(e.basis || '')) return '대리 근거가 남지 않음: ' + e.basis;
        if (e.actorDept !== 'CEM유닛') return '처리한 사람의 그때 조직이 남지 않음: ' + e.actorDept;
        // 조직 개편: 코드 관리에서 조직 이름 CEM유닛 → 고객성공유닛
        C.adminSave('CODE', '조직(CEM)', '이름: CEM유닛 → 고객성공유닛', '조직 개편(시험)', { k: 'CODE_EDIT', group: 'DEPT', code: 'CEM', set: { label: '고객성공유닛' } });
        if ((D.USERS.u_harin_pyeon || {}).dept !== '고객성공유닛') return '조직 이름 바꾸기가 사람에게 반영되지 않음(시험 전제)';
        const kept = c.history.filter(x => x.step === 'S09' && x.action === 'APPROVE').pop();
        if (!kept || kept.actorDept !== 'CEM유닛') return '조직 이름을 바꾼 뒤 기록의 조직이 바뀜: ' + (kept && kept.actorDept);
        // 결재 문서의 결재 기록 표(review.js renderHistory)에 그때 조직과 대리 근거가 보이는지
        const dom = page(env, 'review.js', U('u_admin'), 'id=2609CL004');
        if (dom.error) return '결재 문서를 열지 못함: ' + dom.error.message;
        const t = strip(dom.q('#history').innerHTML);
        if (t.indexOf('CEM유닛 편하린') < 0) return '결재 기록 표에 그때 조직(CEM유닛 편하린)이 보이지 않음';
        if (t.indexOf('고객성공유닛 편하린') > -1) return '결재 기록 표에 바뀐 뒤 조직 이름이 보임';
        if (!/임하준 대신, 대리 지정/.test(t)) return '결재 기록 표에 "임하준 대신, 대리 지정"이 보이지 않음';
        if (!/대리 근거: 임하준님 휴가/.test(t)) return '결재 기록 표에 대리 근거가 보이지 않음';
        return true;
      },
    },
    {
      name: '승인 취소는 앞 승인 줄을 고치거나 지우지 않고 취소 줄을 덧붙임. 결재 기록을 고치거나 지우는 기능이 없음(2610CL010 ②)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES_ADMIN' });
        fixClock(env);
        const { C, U } = env;
        const c = env.contract('2610CL010');
        const sa = U('u_sadmin');
        const n0 = c.history.length;
        const e1 = C.recordAction(c, step(c, 'S02'), 'APPROVE', '확인: 시험 승인', sa);
        if (!e1) return '② 승인이 남지 않음(시험 전제)';
        const snap = JSON.stringify(e1);
        if (!C.canCancel(c, step(c, 'S02'), sa)) return '승인한 본인에게 승인 취소가 없음(시험 전제)';
        const e2 = C.recordAction(c, step(c, 'S02'), 'CANCEL', '잘못 승인함(시험)', sa);
        if (!e2) return '승인 취소가 남지 않음';
        if (c.history.length !== n0 + 2) return '기록 줄 수가 ' + n0 + ' → ' + c.history.length + '(2줄 덧붙어야 함)';
        if (JSON.stringify(c.history[n0]) !== snap) return '승인 취소 뒤 앞 승인 줄이 바뀜';
        if (c.history[n0 + 1].action !== 'CANCEL') return '맨 뒤 줄이 승인 취소가 아님';
        const saved = JSON.parse(env.store['climb.demoActions'] || '[]');
        if (saved.length !== 2 || saved[0].action !== 'APPROVE' || saved[1].action !== 'CANCEL') return '저장한 시연 기록이 승인과 취소 두 줄이 아님: ' + saved.map(x => x.action).join(',');
        // 내보낸 기능 가운데 결재 기록을 고치거나 지우는 것이 없어야 함(deleteDraft는 임시 저장 계약 지우기라 결재 기록과 상관없음)
        const bad = Object.keys(C).concat(Object.keys(env.X)).filter(k => /^(edit|update|delete|remove|erase|undo|modify|purge|drop|clear)/i.test(k) && k !== 'deleteDraft');
        if (bad.length) return '결재 기록을 고치거나 지울 수 있어 보이는 기능: ' + bad.join(', ');
        return true;
      },
    },
    {
      name: '사용 중지된 사람의 결재 기록은 지워지지 않음(배수아를 사용 중지해도 그 사람의 처리 줄과 결재란 기록이 그대로)',
      kind: 'deny',
      run(h) {
        const count = env => {
          let hist = 0, done = 0;
          env.D.CONTRACTS.forEach(c => {
            (c.history || []).forEach(x => { if (x.actorId === 'u_sadmin') hist++; });
            (c.approvals || []).forEach(a => { if (a.state === 'DONE' && a.decidedBy === 'u_sadmin') done++; });
          });
          return { hist, done, log: env.X.accessLogs().filter(l => l.act === 'APPROVE' && l.userId === 'u_sadmin').length };
        };
        const a = h.fresh({ role: 'ADMIN' });
        const before = count(a);
        if (!before.hist) return '배수아의 처리 기록이 없음(시험 전제)';
        // 관리자가 사용자 권한 관리에서 사용 중지(같은 변경 기록으로)
        a.C.adminSave('USER', '세일즈어드민유닛 배수아', '상태: 사용 중 → 사용 중지', '퇴사(시험)', { k: 'ACCOUNT_EDIT', email: 'sua.bae@muhayu.com', set: { status: 'SUSPENDED' } });
        if (a.D.ACCOUNTS.find(x => x.id === 'u_sadmin').status !== 'SUSPENDED') return '사용 중지가 반영되지 않음(시험 전제)';
        const after = count(a);
        if (JSON.stringify(after) !== JSON.stringify(before)) return '사용 중지한 뒤 기록 수가 바뀜: ' + JSON.stringify(before) + ' → ' + JSON.stringify(after);
        // 처음부터 사용 중지인 채로 다시 열어도(결재란을 다시 만듦) 같은 기록
        const b = h.fresh({ role: 'ADMIN', hook: D => { D.ACCOUNTS.find(x => x.id === 'u_sadmin').status = 'SUSPENDED'; } });
        const again = count(b);
        if (JSON.stringify(again) !== JSON.stringify(before)) return '사용 중지 상태로 다시 열면 기록 수가 바뀜: ' + JSON.stringify(before) + ' → ' + JSON.stringify(again);
        if (!/배수아/.test(b.C.ownerLabel('u_sadmin'))) return '사용 중지된 사람의 이름이 기록에서 보이지 않음: ' + b.C.ownerLabel('u_sadmin');
        return true;
      },
    },
  ],
  serverOnly: [
    '브라우저 시각을 바꿔 처리 일시를 앞당김: 시안 nowStamp는 시연 날짜(D.TODAY)에 브라우저 시계의 시각을 붙임. 실제 시스템은 날짜와 시각 모두 서버 표준시로 기록',
    '수정이나 삭제 요청을 서버에 직접 보냄: 결재 기록은 덧붙이기만 되는 저장소에 둠(01 2.1). 처리한 사람, 대리 근거, 그때 조직도 서버가 채움(시안 recordAction은 넘겨받은 사람과 값을 그대로 씀)',
    '데이터베이스에서 결재 기록 한 줄을 직접 고치거나 지움: 다음 날 기록 지문 잇기 확인(CTL-122)에서 어긋남을 찾아 정보보호 담당자에게 알림. 시안에는 장치가 없음(04 3장 "기록 지문 잇기")',
    '시안의 결재 기록은 이 브라우저 저장소(climb.demoActions)에 있고 시연 띠의 "시연 기록 지우기"로 지워짐: 시연 전용이고 실제 시스템에는 없음',
  ],
};
