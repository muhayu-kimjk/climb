// AC-54 진행 중단과 날인본 회수, 전자계약 취소 확인 (CTL-144, 06 통제 목록 2장) 시험 (2026-11-13 주말 점검 W2)
//   기대 동작: 반려, 보완 중, 체결 대기인 계약만 지금 영업대표가 사유를 적어 요청한다. 기안자 유닛의 영업 리더(정해진 경우 영업 임원)가 확인하거나
//     사유를 적어 돌려보낸다. 요청 전에 종이 ⑥ 날인이 있으면 총무의 날인본 회수 확인까지 해야 "진행 중단"이 된다.
//     (v0.13) 요청 전에 ⑥ 인증서 서명이 있으면 서명한 영업지원(사용 중지이거나 기안자, 지금 영업대표면 영업지원 리더)의 전자계약 취소 확인
//     (확인한 것과 메모 필수)까지 해야 하고, 둘 다 있으면 둘 다 해야 한다. 요청 중에는 남은 결재와 재기안을 받지 않고, 끝난 뒤에는 다른 상태로 가지 않는다.
//     (v0.14) 상대가 이미 서명했으면 "상대가 이미 서명함"으로 확인해 요청이 풀리고 멈춘 결재가 다시 이어지며, 그 계약은 다시 요청하지 못한다.
//   시안 코드: common.js stopInfo, canAskStop, canDecideStop, canSealBack, canEsignBack, stopClick(맨 위 안내 단추 → 요청, 확인, 돌려보냄, 회수, 취소 확인 창),
//     recordAction, buildReview, canAct, canResubmit. 창은 lib.js의 withModal로 열어 칸을 채우고 저장을 누름
'use strict';
const { fixClock, step, withModal, pageAs: page, strip, fnSrc, compile } = require('./lib'); // fnSrc, compile: 인장 기록 대조 함수 꺼내기(2026-11-14 주말 점검 W7)

function setup(h, hook) { const env = h.fresh({ role: 'SUPER', hook }); fixClock(env); return env; }
// 맨 위 안내의 단추(data-stop="ask|ok|no|back|eback")를 그 사람이 누름 → 창
function stopBtn(env, c, act, userId) {
  const u = typeof userId === 'string' ? env.U(userId) : userId;
  return withModal(env, () => env.C.stopClick({ target: { closest: () => ({ getAttribute: k => (k === 'data-id' ? c.id : act) }) } }, u));
}
// 단추를 눌러 창을 채워 저장. { opened, done, errors }
function doStop(env, c, act, userId, vals, checked) {
  const m = stopBtn(env, c, act, userId);
  if (!m.opened) return { opened: false, done: false, errors: {} };
  const r = m.submit(vals || {}, checked);
  return { opened: true, done: r.done, errors: r.errors };
}
// (2026-11-14 주말 점검 W7, ai-ops-06, icfr-11, abc-09) 날인본 회수 확인에 "확인한 것"(end)이, 전자계약 취소 확인에 증빙(파일 이름이나 올릴 수 없는 까닭)이
//   필수가 되어 앞서 있던 시험의 입력에 그 값을 더함(시험이 보는 것은 그대로). BACK: 돌려받음, ev(칸): 증빙 파일 이름을 더한 칸
const BACK = { end: 'BACK' };
const ev = vals => Object.assign({ evidence: '시험_전자계약_상태화면.pdf' }, vals);
const turn = (c, code) => (c.approvals || []).find(a => a.step === code && a.state === 'PENDING') || null;
const DELEG = (absentId, delegateId) => D => D.DELEGATIONS.push({ id: 'DL-T54', absentId, delegateId, from: '2026-10-19', to: '2026-10-23', reason: '휴가(시험)', by: 'u_admin', at: '2026-10-10 10:00', endedAt: null });
// 2610CL014에 요청 전 종이 날인 차수(1차 ⑥ 총무 날인)를 하나 더 넣음: 날인과 서명이 함께인 계약
//   (예시 계약의 결재 기록은 common.js가 만들어 붙이므로 여기서는 앞 줄만 둠)
const MIXED = D => { const c = D.CONTRACTS.find(x => x.id === '2610CL014'); c.history = c.history || []; c.history.unshift({ step: 'S06', action: 'APPROVE', at: '2026-10-06 16:00', comment: '종이 날인(시험)', actorId: 'u_ga', round: 1 }); };
// 2610CL013(나라장터 전자계약)의 ⑥ 인증서 서명을 배수아가 남김
function sign13(env) {
  const c = env.contract('2610CL013');
  return env.C.recordAction(c, step(c, 'S06'), 'APPROVE', '확인: 시험. ' + env.C.esignNote('u_sadmin', env.D.TODAY + ' 08:00'), env.U('u_sadmin'),
    { certSigner: 'u_sadmin', certSignedAt: env.D.TODAY + ' 08:00', signMethod: 'ESIGN_G2B' });
}

module.exports = {
  ac: 'AC-54',
  title: '진행 중단과 날인본 회수, 전자계약 취소 확인',
  tests: [
    {
      name: '2610CL012(새길교육연구소): ③ 반려 뒤 요청(10-16), 영업 리더 확인(10-17)으로 진행 중단이 되고 전체 계약의 "진행 중단" 거르기에 나옴',
      kind: 'ok',
      run(h) {
        const env = setup(h);
        const c = env.contract('2610CL012');
        const x = c.stopInfo;
        if (c.status !== 'STOPPED' || !x || x.state !== 'STOPPED') return '진행 중단이 아님: ' + c.status;
        if (!/^2026-10-16/.test(x.ask.at) || x.ask.actorId !== 'u_sales2') return '요청이 10-16 정하은이 아님';
        if (!/^2026-10-17/.test(x.decision.at) || x.decision.action !== 'STOP_OK' || x.decision.actorId !== 'u_eunseong_ko') return '확인이 10-17 영업 리더 고은성이 아님';
        if (c.stoppedAt !== x.decision.at) return '진행 중단 일시가 마지막 확인 일시가 아님: ' + c.stoppedAt;
        if (c.history.find(h0 => h0.step === 'S03' && h0.action === 'REJECT').at > x.ask.at) return '③ 반려 뒤의 요청이 아님';
        const dom = page(env, 'contracts.js', env.U('u_sales2'), 'status=STOPPED');
        if (dom.error) return '전체 계약 화면을 열지 못함: ' + dom.error.message;
        const t = strip(dom.q('#rows').innerHTML);
        if (t.indexOf('2610CL012') < 0) return '"진행 중단" 거르기에 2610CL012가 없음';
        if (t.indexOf('2610CL011') > -1) return '"진행 중단" 거르기에 아직 요청 중인 2610CL011이 나옴';
        return true;
      },
    },
    {
      name: '2610CL011(이음병원): ⑥ 날인 뒤 ⑦ 차례에서 요청해 최민준의 확인을 기다리고, 확인하면 노은채의 날인본 회수 확인 차례, 회수 확인하면 진행 중단',
      kind: 'ok',
      run(h) {
        const env = setup(h);
        const c = env.contract('2610CL011');
        const s = turn(c, 'SST');
        if (!s || s.userId !== 'u_head') return '최민준(영업 리더)의 진행 중단 확인 차례가 아님';
        if (step(c, 'S06').state !== 'DONE' || c.history.find(x => x.action === 'STOP_REQ').at < c.history.find(x => x.step === 'S06').at) return '⑥ 날인 뒤의 요청이 아님(시험 전제)';
        const r = doStop(env, c, 'ok', 'u_head', { memo: '고객 결정 확인(시험)' });
        if (!r.done) return '영업 리더 확인이 저장되지 않음: ' + JSON.stringify(r.errors);
        const sb = turn(c, 'SSB');
        if (!sb || sb.userId !== 'u_ga') return '확인 뒤 노은채(총무)의 날인본 회수 확인 차례가 아님';
        if (c.status === 'STOPPED') return '회수 확인 전에 진행 중단이 됨';
        const b = doStop(env, c, 'back', 'u_ga', { memo: '날인본 2부 회수해 폐기(시험)' }, BACK);
        if (!b.done) return '회수 확인이 저장되지 않음: ' + JSON.stringify(b.errors);
        if (c.status !== 'STOPPED') return '회수 확인 뒤에도 진행 중단이 아님: ' + c.status;
        return true;
      },
    },
    {
      name: '2610CL011: 영업 리더가 사유를 적어 돌려보내면 ⑦ 체결본 등록 차례가 다시 이어짐',
      kind: 'ok',
      run(h) {
        const env = setup(h);
        const c = env.contract('2610CL011');
        const r = doStop(env, c, 'no', 'u_head', { memo: '고객 예산 결과를 보고 다시 판단(시험)' });
        if (!r.done) return '돌려보냄이 저장되지 않음: ' + JSON.stringify(r.errors);
        if (c.stopInfo.state !== 'RETURNED' || env.C.stopPending(c)) return '돌려보냈는데 요청 중으로 남음';
        const s7 = turn(c, 'S07');
        if (!s7 || s7.userId !== 'u_sales1') return '⑦ 체결본 등록 차례가 다시 이어지지 않음';
        if (!env.C.canAct(c, s7, env.U('u_sales1'))) return '영업대표가 ⑦을 처리할 수 없음';
        return true;
      },
    },
    {
      name: '2610CL014(다솜정보통신): ⑥ 배수아 인증서 서명 뒤 요청, 고은성 확인(10-15) 뒤 배수아의 "⑥ 전자계약 취소 확인" 차례이고, 확인하면 진행 중단과 ⑦~⑩ "생략(진행 중단)"',
      kind: 'ok',
      run(h) {
        const env = setup(h);
        const c = env.contract('2610CL014');
        const x = c.stopInfo;
        if (!x.cert || x.cert.certSigner !== 'u_sadmin') return '요청 전 배수아의 인증서 서명이 없음(시험 전제)';
        if (!x.decision || x.decision.actorId !== 'u_eunseong_ko' || !/^2026-10-15/.test(x.decision.at)) return '고은성의 10-15 확인이 아님';
        const se = turn(c, 'SSE');
        if (!se || se.userId !== 'u_sadmin') return '배수아의 전자계약 취소 확인 차례가 아님';
        if (turn(c, 'SSB')) return '종이 날인이 없는데 날인본 회수 확인 차례가 있음';
        const r = doStop(env, c, 'eback', 'u_sadmin', ev({ memo: '고객사 시스템에서 계약 요청을 취소함(시험)' }), { end: 'CANCELLED' });
        if (!r.done) return '전자계약 취소 확인이 저장되지 않음: ' + JSON.stringify(r.errors);
        if (c.status !== 'STOPPED') return '취소 확인 뒤 진행 중단이 아님: ' + c.status;
        const skip = c.approvals.filter(a => a.reason === '진행 중단' && a.state === 'SKIPPED').map(a => a.step).join(',');
        if (skip !== 'S07,S08,S09,S10') return '⑦~⑩이 "생략(진행 중단)"이 아님: ' + skip;
        if (c.stoppedAt !== c.stopInfo.eback.at) return '진행 중단 일시가 마지막 확인(취소 확인) 일시가 아님';
        return true;
      },
    },
    {
      name: '2610CL014: 서명한 배수아가 사용 중지면 영업지원 리더 엄지훈이 전자계약 취소 확인을 맡음',
      kind: 'ok',
      run(h) {
        const env = setup(h, D => { D.ACCOUNTS.find(a => a.id === 'u_sadmin').status = 'SUSPENDED'; });
        const c = env.contract('2610CL014');
        const se = turn(c, 'SSE');
        if (!se || se.userId !== 'u_jihoon_eom') return '엄지훈이 맡지 않음: ' + (se && se.userId);
        if (!env.C.canEsignBack(c, env.U('u_jihoon_eom'))) return '엄지훈이 전자계약 취소 확인을 할 수 없음';
        return true;
      },
    },
    {
      name: '영업 리더 본인 계약(기안자가 최민준)이면 진행 중단 확인은 영업 임원(문태호)이 맡음("정해진 경우 영업 임원")',
      kind: 'ok',
      run(h) {
        const env = setup(h, D => { D.CONTRACTS.find(x => x.id === '2610CL013').requesterId = 'u_head'; });
        const c = env.contract('2610CL013');
        const r = doStop(env, c, 'ask', 'u_head', { reason: '고객이 계약하지 않기로 함(시험)' });
        if (!r.done) return '리더 본인의 요청이 저장되지 않음: ' + JSON.stringify(r.errors);
        const s = turn(c, 'SST');
        if (!s || s.userId !== 'u_exec') return '확인 차례가 영업 임원이 아님: ' + (s && s.userId);
        if (/data-stop="ok"/.test(env.C.stopNotice(c, env.U('u_head')))) return '요청한 리더 본인에게 확인 단추가 보임';
        if (!/data-stop="ok"/.test(env.C.stopNotice(c, env.U('u_exec')))) return '영업 임원에게 확인 단추가 없음';
        return true;
      },
    },
    {
      name: '2610CL013: 서명 전에 중단하면 영업 리더 확인으로 끝나고, 서명 뒤 중단하면 전자계약 취소 확인(SSE) 차례가 생김',
      kind: 'ok',
      run(h) {
        // 서명 전
        let env = setup(h);
        let c = env.contract('2610CL013');
        let r = doStop(env, c, 'ask', 'u_sales1', { reason: '고객이 계약하지 않기로 함(시험)' });
        if (!r.done) return '요청이 저장되지 않음: ' + JSON.stringify(r.errors);
        if (!turn(c, 'SST') || turn(c, 'SST').userId !== 'u_head') return '최민준의 확인 차례가 아님';
        r = doStop(env, c, 'ok', 'u_head', { memo: '' });
        if (!r.done) return '리더 확인이 저장되지 않음: ' + JSON.stringify(r.errors);
        if (c.status !== 'STOPPED' || c.stopInfo.cert) return '서명 전 중단이 리더 확인으로 끝나지 않음: ' + c.status;
        // 서명 뒤
        env = setup(h);
        c = env.contract('2610CL013');
        if (!sign13(env)) return '⑥ 인증서 서명이 남지 않음(시험 전제)';
        doStop(env, c, 'ask', 'u_sales1', { reason: '고객이 계약하지 않기로 함(시험)' });
        r = doStop(env, c, 'ok', 'u_head', { memo: '' });
        if (!r.done) return '서명 뒤 리더 확인이 저장되지 않음';
        const se = turn(c, 'SSE');
        if (c.status === 'STOPPED' || !se || se.userId !== 'u_sadmin') return '서명 뒤 중단에 배수아의 전자계약 취소 확인 차례가 생기지 않음: ' + c.status;
        return true;
      },
    },
    {
      name: '(v0.14) 2610CL014에서 배수아가 "상대가 이미 서명함"을 고르면 체결 대기 그대로 ⑦ 출력본 등록이 다시 차례(그때부터 대기 일수), 맨 위 안내가 보이고 요청 단추는 없음',
      kind: 'ok',
      run(h) {
        const env = setup(h);
        const { C } = env;
        const c = env.contract('2610CL014');
        const r = doStop(env, c, 'eback', 'u_sadmin', ev({ memo: '고객사 시스템에 상대 서명이 이미 있음(시험)' }), { end: 'SIGNED' });
        if (!r.done) return '확인이 저장되지 않음: ' + JSON.stringify(r.errors);
        const e = c.history[c.history.length - 1];
        if (e.action !== 'ESIGN_SIGNED' || e.esignEnd !== 'SIGNED') return '기록이 상대 서명 확인(ESIGN_SIGNED)이 아님: ' + e.action;
        if (c.status !== 'APPROVED' || c.stopInfo.state !== 'SIGNED' || C.stopPending(c)) return '체결 대기 그대로가 아니거나 요청 중으로 남음: ' + c.status + ', ' + c.stopInfo.state;
        const s7 = turn(c, 'S07');
        if (!s7) return '⑦ 출력본 등록이 다시 차례가 되지 않음';
        if (s7.arrivedAt.slice(0, 16) !== e.at.slice(0, 16)) return '⑦ 대기 일수가 풀린 때부터가 아님: ' + s7.arrivedAt + ' / ' + e.at;
        const n = strip(C.stopNotice(c, env.U('u_sales2'), { ask: true }));
        if (n.indexOf('상대가 이미 서명해 진행 중단 요청이 풀렸습니다') < 0) return '맨 위 안내가 없음: ' + n.slice(0, 120);
        if (/data-stop="ask"/.test(C.stopNotice(c, env.U('u_sales2'), { ask: true }))) return '진행 중단 요청 단추가 보임';
        return true;
      },
    },
    {
      name: '(v0.14) 날인과 서명이 함께인 계약에서 "상대가 이미 서명함"을 고르면 날인본 회수 확인 차례도 없어짐',
      kind: 'ok',
      run(h) {
        const env = setup(h, MIXED);
        const c = env.contract('2610CL014');
        if (!turn(c, 'SSB') || !turn(c, 'SSE')) return '날인본 회수와 전자계약 취소 확인이 함께 차례가 아님(시험 전제)';
        const r = doStop(env, c, 'eback', 'u_sadmin', ev({ memo: '상대 서명 있음(시험)' }), { end: 'SIGNED' });
        if (!r.done) return '확인이 저장되지 않음';
        if (turn(c, 'SSB')) return '날인본 회수 확인 차례가 남음';
        if (c.status !== 'APPROVED') return '상태가 체결 대기가 아님: ' + c.status;
        return true;
      },
    },
    {
      name: '검토 중, 계약 완료, 임시 저장인 계약에서는 진행 중단을 요청하지 못함',
      kind: 'deny',
      run(h) {
        const env = setup(h);
        const { C, D } = env;
        const cases = [env.contract('2610CL010'), env.contract('2609CL007'), D.CONTRACTS.find(c => c.status === 'DRAFT')];
        for (const c of cases) {
          if (!c) return '시험할 계약이 없음';
          const rep = C.salesRepOf(c) || c.requesterId;
          if (C.canAskStop(c, env.U(rep))) return (c.id || '임시 저장') + '(' + c.status + ')에서 영업대표가 진행 중단을 요청할 수 있음';
          if (c.id && stopBtn(env, c, 'ask', rep).opened) return c.id + '(' + c.status + ')에서 요청 창이 열림';
        }
        return true;
      },
    },
    {
      name: '영업대표가 아닌 사람(다른 영업, 영업 리더, 관리자, 영업지원)은 진행 중단을 요청하지 못함(2610CL013)',
      kind: 'deny',
      run(h) {
        const env = setup(h);
        const c = env.contract('2610CL013');
        if (!env.C.canAskStop(c, env.U('u_sales1'))) return '견줌: 영업대표 이도윤도 요청할 수 없음(시험 전제)';
        for (const id of ['u_sales2', 'u_head', 'u_admin', 'u_sadmin']) {
          if (env.C.canAskStop(c, env.U(id))) return id + '가 진행 중단을 요청할 수 있음';
          if (stopBtn(env, c, 'ask', id).opened) return id + '에게 요청 창이 열림';
        }
        return true;
      },
    },
    {
      name: '요청한 사람, 기안자, 지금 영업대표는 진행 중단을 확인하지 못함(리더의 대리로 지정되어도, 2610CL011)',
      kind: 'deny',
      run(h) {
        const env = setup(h, DELEG('u_head', 'u_sales1'));
        const { C, U } = env;
        const c = env.contract('2610CL011');
        const s = turn(c, 'SST');
        if (!C.isMyStep(s, U('u_sales1'))) return '대리 지정이 효력이 없음(시험 전제)';
        // 확인 단추(맨 위 안내의 data-stop=ok)가 보이는지로 봄(canDecideStop은 내보내지 않음)
        const okBtn = u => /data-stop="ok"/.test(C.stopNotice(c, u));
        if (okBtn(U('u_sales1'))) return '요청한 사람이자 기안자, 영업대표인 이도윤에게 대리로 확인 단추가 보임';
        if (stopBtn(env, c, 'ok', 'u_sales1').opened) return '이도윤에게 확인 창이 열림';
        if (!okBtn(U('u_head'))) return '견줌: 최민준에게도 확인 단추가 없음(시험 전제)';
        return true;
      },
    },
    {
      // (2026-11-13 약한 시험 고침) 위 2610CL011은 이도윤 한 사람이 요청한 사람, 기안자, 영업대표를 모두 겸해 셋 가운데 하나만 봐도 통과함.
      //   그래서 기안자(기태민)와 영업대표(이도윤, OC-0001로 넘겨받음)가 다른 2609CL011에서 이도윤이 요청한 뒤, 최민준의 대리를 한 사람씩 지정해 봄
      //   ① 기안자만인 기태민 ② 요청한 사람이자 영업대표인 이도윤 ③ 요청 뒤 영업대표를 박서현으로 바꿔: 영업대표만인 박서현, 요청한 사람만인 이도윤
      //   네 경우 모두 대리 지정으로 차례(isMyStep)는 그 사람에게 있지만 확인 단추가 없고 창이 열리지 않아야 함
      //   견줌: 아무 관계 없는 같은 유닛 영업(김태윤)을 대리로 지정하면 확인 단추가 보임
      //   기태민은 예시에서 사용 중지라 대신할 사람이 되지 못하므로(AC-44, activeDelegation) 이 시험에서는 사용 중으로 되돌림
      name: '(나눠 봄) 요청한 사람, 기안자, 지금 영업대표가 저마다 리더의 대리로 지정되어도 진행 중단을 확인하지 못함(2609CL011, 기안자 기태민, 영업대표 이도윤)',
      kind: 'deny',
      run(h) {
        const cases = [
          ['u_taemin_ki', false, '기안자만인 기태민'],
          ['u_sales1', false, '요청한 사람이자 영업대표인 이도윤'],
          ['u_seohyun_park', true, '요청 뒤 영업대표가 된 박서현(영업대표만)'],
          ['u_sales1', true, '영업대표가 바뀐 뒤의 이도윤(요청한 사람만)'],
          ['u_taeyun_kim', false, null], // 견줌
        ];
        for (const [del, repChange, who] of cases) {
          const env = setup(h, D => { D.ACCOUNTS.find(a => a.id === 'u_taemin_ki').status = 'ACTIVE'; });
          const { C, U } = env;
          const c = env.contract('2609CL011');
          if (c.requesterId !== 'u_taemin_ki' || C.salesRepOf(c) !== 'u_sales1') return '시험 전제: 2609CL011의 기안자가 기태민, 영업대표가 이도윤이 아님';
          const a = doStop(env, c, 'ask', 'u_sales1', { reason: '고객이 계약하지 않기로 함(시험)' });
          if (!a.done) return '이도윤의 진행 중단 요청이 저장되지 않음(시험 전제): ' + JSON.stringify(a.errors);
          if (repChange) {
            env.D.OWNER_CHANGES.push({ id: 'OC-T54', bundleId: '2609CL011', from: 'u_sales1', to: 'u_seohyun_park', by: 'u_head', byDept: '비즈니스1유닛', at: env.D.TODAY + ' 20:30', reason: '시험', salesTeam: '비즈니스1유닛' });
            if (C.salesRepOf(c) !== 'u_seohyun_park') return '시험 확인: 영업대표를 박서현으로 바꾸지 못함';
          }
          env.D.DELEGATIONS.push({ id: 'DL-T54', absentId: 'u_head', delegateId: del, from: env.D.TODAY, to: '2026-10-23', reason: '휴가(시험)', by: 'u_admin', at: '2026-10-10 10:00', endedAt: null });
          const s = turn(c, 'SST');
          if (!s || s.userId !== 'u_head') return '최민준의 진행 중단 확인 차례가 아님(시험 전제)';
          if (!C.isMyStep(s, U(del))) return (who || del) + ': 대리 지정이 효력이 없음(시험 전제)';
          const ok = /data-stop="ok"/.test(C.stopNotice(c, U(del)));
          const opened = stopBtn(env, c, 'ok', del).opened;
          if (!who) { if (!ok || !opened) return '견줌 실패: 관계 없는 김태윤을 대리로 지정해도 확인 단추나 창이 없음'; continue; }
          if (ok) return who + '에게 대리로 확인 단추가 보임';
          if (opened) return who + '에게 확인 창이 열림';
          if (c.stopInfo.state !== 'REQUESTED' || c.status === 'STOPPED') return who + '의 시도로 요청 상태가 바뀜: ' + c.stopInfo.state;
        }
        return true;
      },
    },
    {
      name: '돌려보내며 사유가 빈칸이거나 날인본 회수 확인 메모가 빈칸이면 저장되지 않음(2610CL011)',
      kind: 'deny',
      run(h) {
        const env = setup(h);
        const c = env.contract('2610CL011');
        const n0 = c.history.length;
        const r = doStop(env, c, 'no', 'u_head', { memo: '  ' });
        if (!r.opened) return '돌려보내기 창이 열리지 않음';
        if (r.done || !r.errors.memo) return '사유 없이 돌려보냄이 저장됨';
        if (c.history.length !== n0 || c.stopInfo.state !== 'REQUESTED') return '저장하지 않았는데 기록이나 상태가 바뀜';
        doStop(env, c, 'ok', 'u_head', { memo: '' });
        const n1 = c.history.length;
        const b = doStop(env, c, 'back', 'u_ga', { memo: '' });
        if (!b.opened) return '회수 확인 창이 열리지 않음';
        if (b.done || !b.errors.memo) return '메모 없이 회수 확인이 저장됨';
        if (c.history.length !== n1 || c.status === 'STOPPED') return '저장하지 않았는데 기록이나 상태가 바뀜';
        return true;
      },
    },
    {
      name: '요청 중에는 ⑦ 체결본 등록, ⑧ 확인, 보완 완료, 보완 후 재기안을 받지 않음',
      kind: 'deny',
      run(h) {
        const env = setup(h);
        const { C, U } = env;
        // 체결 대기(2610CL011, 요청 중): ⑦, ⑧
        const c = env.contract('2610CL011');
        const n0 = c.history.length;
        if (C.canAct(c, step(c, 'S07'), U('u_sales1'))) return '요청 중에 ⑦ 처리 막대가 보임';
        if (C.recordAction(c, step(c, 'S07'), 'REGISTER', '확인: 시험', U('u_sales1'), { fileName: 'x.pdf', signDate: env.D.TODAY })) return '요청 중에 ⑦ 체결본 등록이 남음';
        if (C.recordAction(c, step(c, 'S08'), 'APPROVE', '확인: 시험', U('u_dain_seok'))) return '요청 중에 ⑧ 확인이 남음';
        if (c.history.length !== n0) return '요청 중인 계약에 기록이 더해짐';
        // 기획자 결정 2026-11-16(결정할것 확인 1): ⑦을 마치고 ⑧이 차례인 계약은 고객이 서명한 체결본이 있어 진행 중단을 요청할 수 없음(계약 완료 뒤 해지).
        //   그래서 예전의 "⑧ 차례에 요청하면 ⑧이 대기로 바뀜" 시험(2609CL003)은 "요청 자체가 막힘"으로 바꿈
        const g = env.contract('2609CL003');
        const s8 = step(g, 'S08');
        if (!s8 || s8.state !== 'PENDING' || s8.userId !== 'u_sadmin') return '견줌: 2609CL003의 ⑧이 배수아의 처리 차례가 아님(시험 전제)';
        if (C.canAskStop(g, U('u_sales1'))) return '체결본을 올린 2609CL003에 진행 중단 요청 단추가 보임(확인 1)';
        if (!C.stopSignedNote(g, U('u_sales1'))) return '체결본을 올린 2609CL003의 영업대표에게 해지 안내가 없음(확인 1)';
        const g0 = g.history.length;
        const ga = doStop(env, g, 'ask', 'u_sales1', { reason: '고객이 계약하지 않기로 함(시험)' });
        if (ga.done || g.history.length !== g0) return '체결본을 올린 2609CL003의 진행 중단 요청이 저장됨(확인 1)';
        if (step(g, 'S08').state !== 'PENDING') return '막힌 요청 뒤 2609CL003의 ⑧이 차례에서 빠짐';
        // 견줌(밤 tests-06): ⑧에서 다시 등록 요청(RETURN)된 판은 살아 있는 체결본이 아니라 진행 중단을 요청할 수 있음
        C.recordAction(g, step(g, 'S08'), 'RETURN', '다시 등록 요청(시험)', U('u_sadmin'), { mismatch: ['DATE'] });
        if (C.hasLiveSigned(g)) return '⑧ 다시 등록 요청 뒤에도 살아 있는 체결본으로 셈함';
        if (!C.canAskStop(g, U('u_sales1'))) return '⑧ 다시 등록 요청 뒤에도 진행 중단을 요청할 수 없음';
        // 보완 중(2610CL008): 요청한 뒤 보완 완료
        const s = env.contract('2610CL008');
        const rep = C.salesRepOf(s);
        const a = doStop(env, s, 'ask', rep, { reason: '고객이 계약하지 않기로 함(시험)' });
        if (!a.done) return '보완 중 계약의 요청이 저장되지 않음(시험 전제): ' + JSON.stringify(a.errors);
        if (C.recordAction(s, { step: 'S01', userId: rep }, 'RESUBMIT', '보완함(시험)', U(rep))) return '요청 중에 보완 완료가 남음';
        if (C.myActions(U(rep)).some(x => x.id === s.id)) return '요청 중인 보완 계약이 영업대표의 할 일에 남음';
        // 반려(2610CL001): 요청한 뒤 보완 후 재기안
        const j = env.contract('2610CL001');
        const rj = C.salesRepOf(j);
        if (!C.canResubmit(j, U(rj))) return '견줌: 요청 전에도 재기안할 수 없음(시험 전제)';
        const b = doStop(env, j, 'ask', rj, { reason: '고객이 계약하지 않기로 함(시험)' });
        if (!b.done) return '반려 계약의 요청이 저장되지 않음(시험 전제)';
        if (C.canResubmit(j, U(rj))) return '요청 중인 반려 계약을 다시 기안할 수 있음';
        if (C.resubmitSource(j.id, U(rj), () => true)) return '요청 중인 반려 계약이 재기안 화면에 채워짐';
        return true;
      },
    },
    {
      name: '날인한 계약은 회수 확인 없이 진행 중단이 되지 않음(2610CL011 리더 확인 뒤)',
      kind: 'deny',
      run(h) {
        const env = setup(h);
        const c = env.contract('2610CL011');
        doStop(env, c, 'ok', 'u_head', { memo: '' });
        if (c.status === 'STOPPED') return '회수 확인 없이 진행 중단이 됨';
        if (c.stopInfo.state !== 'SEAL_WAIT' || !env.C.stopPending(c)) return '회수 확인을 기다리는 요청 중이 아님: ' + c.stopInfo.state;
        return true;
      },
    },
    {
      name: '(v0.13) 인증서 서명 뒤 중단한 계약은 전자계약 취소 확인 없이 진행 중단이 되지 않음(2610CL014)',
      kind: 'deny',
      run(h) {
        const env = setup(h);
        const c = env.contract('2610CL014');
        if (c.status === 'STOPPED') return '전자계약 취소 확인 없이 진행 중단이 됨';
        if (c.stopInfo.state !== 'SEAL_WAIT' || !turn(c, 'SSE')) return '전자계약 취소 확인을 기다리지 않음: ' + c.stopInfo.state;
        return true;
      },
    },
    {
      name: '(v0.13) 기안자나 지금 영업대표는 전자계약 취소 확인을 하지 못함(배수아의 대리로 지정되어도, 2610CL014)',
      kind: 'deny',
      run(h) {
        const env = setup(h, DELEG('u_sadmin', 'u_sales2'));
        const { C, U } = env;
        const c = env.contract('2610CL014');
        if (!C.isMyStep(turn(c, 'SSE'), U('u_sales2'))) return '대리 지정이 효력이 없음(시험 전제)';
        if (C.canEsignBack(c, U('u_sales2'))) return '기안자이자 영업대표인 정하은이 대리로 전자계약 취소 확인을 할 수 있음';
        if (stopBtn(env, c, 'eback', 'u_sales2').opened) return '정하은에게 전자계약 취소 확인 창이 열림';
        return true;
      },
    },
    {
      // (2026-11-13 약한 시험 고침) 위 시험은 정하은이 기안자이자 영업대표라 canEsignBack이 둘 가운데 하나만 봐도 통과함.
      //   그래서 영업대표 바꾸기 기록(2026-10-16 정하은 → 유지호)을 더해 기안자(정하은)와 영업대표(유지호)를 나누고, 배수아의 대리를 한 사람씩 지정해 봄
      //   견줌: 아무 관계 없는 영업(권나연)을 대리로 지정하면 전자계약 취소 확인을 할 수 있음
      name: '(v0.13, 나눠 봄) 기안자만인 사람(정하은)과 영업대표만인 사람(유지호)이 저마다 배수아의 대리로 지정되어도 전자계약 취소 확인을 하지 못함(2610CL014, 영업대표를 바꿔 봄)',
      kind: 'deny',
      run(h) {
        const rep = D => D.OWNER_CHANGES.push({ id: 'OC-T54B', bundleId: '2610CL014', from: 'u_sales2', to: 'u_jiho_yoo', by: 'u_eunseong_ko', byDept: '비즈니스2유닛', at: '2026-10-16 10:00', reason: '시험', salesTeam: '비즈니스2유닛' });
        for (const [del, who] of [['u_sales2', '기안자만인 정하은'], ['u_jiho_yoo', '영업대표만인 유지호'], ['u_nayeon_kwon', null]]) {
          const env = setup(h, D => { rep(D); DELEG('u_sadmin', del)(D); });
          const { C, U } = env;
          const c = env.contract('2610CL014');
          if (c.requesterId !== 'u_sales2' || C.salesRepOf(c) !== 'u_jiho_yoo') return '시험 전제: 2610CL014의 기안자가 정하은, 영업대표가 유지호가 아님';
          const s = turn(c, 'SSE');
          if (!s || s.userId !== 'u_sadmin') return '배수아의 전자계약 취소 확인 차례가 아님(시험 전제)';
          if (!C.isMyStep(s, U(del))) return (who || del) + ': 대리 지정이 효력이 없음(시험 전제)';
          const can = C.canEsignBack(c, U(del));
          const opened = stopBtn(env, c, 'eback', del).opened;
          if (!who) { if (!can || !opened) return '견줌 실패: 관계 없는 권나연을 대리로 지정해도 전자계약 취소 확인을 할 수 없음'; continue; }
          if (can) return who + '이 대리로 전자계약 취소 확인을 할 수 있음';
          if (opened) return who + '에게 전자계약 취소 확인 창이 열림';
        }
        return true;
      },
    },
    {
      name: '(v0.13) 전자계약 취소 확인에서 확인한 것이나 메모가 빈칸이면 저장되지 않음(2610CL014)',
      kind: 'deny',
      run(h) {
        const env = setup(h);
        const c = env.contract('2610CL014');
        const n0 = c.history.length;
        const a = doStop(env, c, 'eback', 'u_sadmin', { memo: '취소함(시험)' }, {});
        if (!a.opened) return '전자계약 취소 확인 창이 열리지 않음';
        if (a.done || !a.errors.end) return '확인한 것을 고르지 않았는데 저장됨';
        const b = doStop(env, c, 'eback', 'u_sadmin', { memo: '   ' }, { end: 'CANCELLED' });
        if (b.done || !b.errors.memo) return '메모 없이 저장됨';
        if (c.history.length !== n0 || c.status === 'STOPPED') return '저장하지 않았는데 기록이나 상태가 바뀜';
        return true;
      },
    },
    {
      name: '(v0.13) 날인과 서명이 함께 있는 계약은 둘 가운데 하나만 끝나면 진행 중단이 되지 않음',
      kind: 'deny',
      run(h) {
        // 회수 확인만
        let env = setup(h, MIXED);
        let c = env.contract('2610CL014');
        let r = doStop(env, c, 'back', 'u_ga', { memo: '회수(시험)' }, BACK);
        if (!r.done) return '회수 확인이 저장되지 않음(시험 전제)';
        if (c.status === 'STOPPED') return '날인본 회수 확인만으로 진행 중단이 됨';
        // 전자계약 취소 확인만
        env = setup(h, MIXED);
        c = env.contract('2610CL014');
        r = doStop(env, c, 'eback', 'u_sadmin', ev({ memo: '취소(시험)' }), { end: 'CANCELLED' });
        if (!r.done) return '취소 확인이 저장되지 않음(시험 전제)';
        if (c.status === 'STOPPED') return '전자계약 취소 확인만으로 진행 중단이 됨';
        // 견줌: 둘 다 끝나면 진행 중단
        doStop(env, c, 'back', 'u_ga', { memo: '회수(시험)' }, BACK);
        if (c.status !== 'STOPPED') return '견줌: 둘 다 끝났는데 진행 중단이 아님';
        return true;
      },
    },
    {
      name: '(v0.14) 상대 서명 확인으로 풀린 계약은 다시 진행 중단을 요청하지 못하고 진행 중단이 되지 않음(2610CL014)',
      kind: 'deny',
      run(h) {
        const env = setup(h);
        const { C, U } = env;
        const c = env.contract('2610CL014');
        doStop(env, c, 'eback', 'u_sadmin', ev({ memo: '상대 서명 있음(시험)' }), { end: 'SIGNED' });
        if (c.stopInfo.state !== 'SIGNED') return '상대 서명 확인이 남지 않음(시험 전제)';
        if (C.canAskStop(c, U('u_sales2'))) return '영업대표가 다시 요청할 수 있음';
        if (C.canAskStop(c, U('u_super'))) return '최고관리자도 다시 요청할 수 있음';
        if (stopBtn(env, c, 'ask', 'u_sales2').opened) return '요청 창이 다시 열림';
        if (c.status === 'STOPPED') return '상대 서명 확인 뒤 진행 중단이 됨';
        if (turn(c, 'SSE') || turn(c, 'SST')) return '진행 중단 차례가 남음';
        return true;
      },
    },
    {
      name: '진행 중단된 계약(2610CL012)에는 결재 기록을 더하거나 다른 상태로 바꾸지 못함',
      kind: 'deny',
      run(h) {
        const env = setup(h);
        const { C, U } = env;
        const c = env.contract('2610CL012');
        const n0 = c.history.length;
        if (C.pendingSteps(c).length) return '진행 중단된 계약에 차례가 남음';
        for (const a of c.approvals) {
          for (const who of [a.userId, 'u_super']) if (C.canAct(c, a, U(who))) return a.step + ' 처리 막대가 ' + who + '에게 보임';
          if (C.recordAction(c, a, a.step === 'S07' ? 'REGISTER' : 'APPROVE', '시험', U(a.userId))) return a.step + ' 기록이 더해짐';
        }
        if (C.recordAction(c, { step: 'S01', userId: 'u_sales2' }, 'RESUBMIT', '시험', U('u_sales2'))) return '보완 완료 기록이 더해짐';
        if (C.canAskStop(c, U('u_sales2')) || C.canResubmit(c, U('u_sales2'))) return '다시 요청하거나 재기안할 수 있음';
        if (c.history.length !== n0 || c.status !== 'STOPPED') return '기록이 더해지거나 상태가 바뀜: ' + c.status;
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검 W7, ai-ops-06) 종이 날인도 전자계약처럼(2026-11-12 기획자 답): 고객이 이미 날인했으면 진행 중단으로 끝내지 않고 요청이 풀림 [가정]
      name: '(W7) 2610CL011: 총무가 "고객이 이미 날인함"을 고르면 진행 중단으로 끝나지 않고 요청이 풀려 ⑦ 체결본 등록이 다시 차례, 맨 위 안내가 보이고 다시 요청하지 못함',
      kind: 'ok',
      run(h) {
        const env = setup(h);
        const { C, U } = env;
        const c = env.contract('2610CL011');
        if (!doStop(env, c, 'ok', 'u_head', { memo: '' }).done) return '리더 확인이 저장되지 않음(시험 전제)';
        const r = doStop(env, c, 'back', 'u_ga', { memo: '고객이 10-18에 날인해 보관 중이라고 알려옴(시험)' }, { end: 'SIGNED' });
        if (!r.done) return '확인이 저장되지 않음: ' + JSON.stringify(r.errors);
        const e = c.history[c.history.length - 1];
        if (e.action !== 'SEAL_SIGNED' || e.sealEnd !== 'SIGNED' || e.step !== 'SSB') return '기록이 고객 날인 확인(SSB SEAL_SIGNED)이 아님: ' + e.step + ' ' + e.action;
        if (c.status === 'STOPPED' || c.stopInfo.state !== 'SIGNED' || C.stopPending(c)) return '진행 중단으로 끝났거나 요청 중으로 남음: ' + c.status + ', ' + c.stopInfo.state;
        const s7 = turn(c, 'S07');
        if (!s7 || s7.userId !== 'u_sales1') return '⑦ 체결본 등록이 다시 차례가 되지 않음';
        const n = strip(C.stopNotice(c, U('u_sales1'), { ask: true }));
        if (n.indexOf('고객이 이미 날인해 진행 중단 요청이 풀렸습니다') < 0) return '맨 위 안내가 없음: ' + n.slice(0, 120);
        if (C.canAskStop(c, U('u_sales1')) || stopBtn(env, c, 'ask', 'u_sales1').opened) return '풀린 계약을 다시 진행 중단 요청할 수 있음';
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검 W7, ai-ops-06) 날인본을 잃어버렸거나 돌려받지 못하면 메모를 적고 진행 중단으로 끝내되 컴플라이언스 점검할 일로 넘김(CTL-78) [가정]
      //   인장 기록 대조 표에는 보이지만, 인장 대장과 맞추는 회수(대조 건수와 열쇠)에는 들지 않음(돌려받은 것만)
      name: '(W7) 2610CL011: "돌려받지 못함"을 고르면 진행 중단으로 끝나고 컴플라이언스 담당자에게 넘어가며, 인장 기록 대조 표에 보이되 대장과 맞추는 회수에는 들지 않음',
      kind: 'ok',
      run(h) {
        const env = setup(h);
        const { C, X, U } = env;
        const c = env.contract('2610CL011');
        doStop(env, c, 'ok', 'u_head', { memo: '' });
        const before = X.pendingIssues().length;
        const r = doStop(env, c, 'back', 'u_ga', { memo: '고객이 날인본을 분실했다고 함(10-18 통화, 시험)' }, { end: 'LOST' });
        if (!r.done) return '확인이 저장되지 않음: ' + JSON.stringify(r.errors);
        if (c.status !== 'STOPPED') return '진행 중단으로 끝나지 않음: ' + c.status;
        const e = c.history[c.history.length - 1];
        if (e.action !== 'SEAL_BACK' || e.sealEnd !== 'LOST' || !e.issueId) return '기록에 돌려받지 못함이나 넘긴 번호가 없음: ' + e.action + ' ' + e.sealEnd + ' ' + e.issueId;
        const iss = X.pendingIssues().filter(i => i.ref === c.id);
        if (X.pendingIssues().length !== before + 1 || iss.length !== 1 || iss[0].source !== 'SEAL' || iss[0].id !== e.issueId) return '컴플라이언스에 넘어온 일이 없음';
        if (iss[0].title.indexOf(c.counterparty) > -1) return '넘어온 일 제목에 고객사 이름이 들어감(계약번호만이어야 함)';
        if (strip(C.stopNotice(c, U('u_sales1'))).indexOf('컴플라이언스 담당자의 점검할 일로 넘겼습니다') < 0) return '맨 위 안내에 넘겼다는 줄이 없음';
        const body = 'const D = window.CLIMB_DATA, C = window.CLIMB;\n' + ['sealBacks', 'backsOnly'].map(n => fnSrc('seal-recon.js', n)).join('\n') + '\nreturn { sealBacks: sealBacks, backsOnly: backsOnly };';
        const sr = compile(env, [], body, 'seal-recon.js(꺼낸 함수)')();
        const rows = sr.sealBacks(e.at.slice(0, 7)).filter(x => x.no === c.id);
        if (rows.length !== 1 || rows[0].end !== 'LOST') return '인장 기록 대조의 날인본 회수 표에 돌려받지 못함이 보이지 않음';
        if (sr.backsOnly(rows).length) return '돌려받지 못한 것이 대장과 맞추는 회수에 듦';
        return true;
      },
    },
    {
      name: '(W7) 날인본 회수 확인에서 확인한 것(돌려받음, 고객이 이미 날인함, 돌려받지 못함)을 고르지 않으면 저장되지 않음(2610CL011)',
      kind: 'deny',
      run(h) {
        const env = setup(h);
        const c = env.contract('2610CL011');
        doStop(env, c, 'ok', 'u_head', { memo: '' });
        const n1 = c.history.length;
        const r = doStop(env, c, 'back', 'u_ga', { memo: '회수(시험)' }, {});
        if (!r.opened) return '회수 확인 창이 열리지 않음';
        if (r.done || !r.errors.end) return '확인한 것 없이 저장됨';
        if (c.history.length !== n1 || c.status === 'STOPPED') return '저장하지 않았는데 기록이나 상태가 바뀜';
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검 W7, icfr-11, abc-09) 전자계약 취소 확인에 증빙 [가정]: 증빙 파일이나 올릴 수 없는 까닭 가운데 하나는 꼭. "상대가 이미 서명함"도 같음
      //   저장하면 결재 기록에 파일 이름(evidenceFile)이나 까닭(evidenceWhy)이 남고, 인장 기록 대조의 전자계약 취소 확인 줄에서 증빙을 봄
      name: '(W7) 전자계약 취소 확인은 증빙 파일도 올릴 수 없는 까닭도 없으면 저장되지 않고(셋 모두), 하나가 있으면 기록과 인장 기록 대조에 남음(2610CL014)',
      kind: 'deny',
      run(h) {
        for (const end of ['CANCELLED', 'UNSIGNED', 'SIGNED']) {
          const env = setup(h);
          const c = env.contract('2610CL014');
          const n0 = c.history.length;
          const r = doStop(env, c, 'eback', 'u_sadmin', { memo: '확인함(시험)' }, { end: end });
          if (!r.opened) return '전자계약 취소 확인 창이 열리지 않음';
          if (r.done || !r.errors.evidence) return end + ': 증빙 없이 저장됨';
          if (c.history.length !== n0) return end + ': 저장하지 않았는데 기록이 더해짐';
        }
        // 까닭만 적으면 저장
        let env = setup(h);
        let c = env.contract('2610CL014');
        let r = doStop(env, c, 'eback', 'u_sadmin', { memo: '취소함(시험)', evidenceWhy: '고객사 시스템이 취소 화면을 남기지 않아 담당자에게 메일로 받음(시험)' }, { end: 'CANCELLED' });
        if (!r.done) return '까닭을 적어도 저장되지 않음: ' + JSON.stringify(r.errors);
        let e = c.history[c.history.length - 1];
        if (e.evidenceFile || !/메일로 받음/.test(e.evidenceWhy || '')) return '올리지 못한 까닭이 기록에 남지 않음';
        // 파일을 올리면 저장되고 인장 기록 대조의 줄에 증빙이 보임(상대가 이미 서명함도)
        env = setup(h);
        c = env.contract('2610CL014');
        r = doStop(env, c, 'eback', 'u_sadmin', { memo: '상대 서명 있음(시험)', evidence: '2610CL014_전자계약_서명완료_화면.pdf' }, { end: 'SIGNED' });
        if (!r.done) return '증빙 파일이 있는데 저장되지 않음: ' + JSON.stringify(r.errors);
        e = c.history[c.history.length - 1];
        if (e.evidenceFile !== '2610CL014_전자계약_서명완료_화면.pdf') return '증빙 파일 이름이 기록에 남지 않음';
        const body = 'const D = window.CLIMB_DATA, C = window.CLIMB;\n' + fnSrc('seal-recon.js', 'esignBacks') + '\nreturn esignBacks;';
        const rows = compile(env, [], body, 'seal-recon.js(꺼낸 함수)')()(e.at.slice(0, 7)).filter(x => x.no === c.id);
        if (rows.length !== 1 || rows[0].evidence !== e.evidenceFile) return '인장 기록 대조의 전자계약 취소 확인 줄에 증빙이 없음';
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검 W7, abc-06) 진행 중단한 계약은 같은 고객의 새 기안에만 번호를 풀어 줌(설계 검토 7번 [가정]). 다른 고객(리셀러 등)이 같은 번호를 쓰면
      //   예전에는 셈에서 빠져 막지 못했음(③ 반려 뒤 진행 중단하고 같은 번호로 간접 계약을 올리는 길). 지금은 E-1 ①대로 다른 고객의 계약으로 셈해 막음
      name: '(W7) 진행 중단한 2610CL012의 영업기회번호를 다른 고객이 쓰면 막고(다른 고객의 계약으로 셈), 같은 고객은 새로 기안할 수 있으며 결재 문서에 앞 계약이 보임',
      kind: 'deny',
      run(h) {
        const NO = '2610SU955';
        const env = setup(h, D => { D.CONTRACTS.find(x => x.id === '2610CL012').opportunity = NO; });
        const { C } = env;
        const c = env.contract('2610CL012');
        if (c.status !== 'STOPPED') return '2610CL012가 진행 중단이 아님(시험 전제)';
        const other = C.oppUses(NO, { bizNo: '220-86-88128', name: '가람전자' });
        if (other.other.map(x => x.id).indexOf('2610CL012') < 0) return '다른 고객에게 진행 중단 계약의 번호가 풀려 있음';
        const same = C.oppUses(NO, { bizNo: '', name: c.counterparty });
        if (same.all.length || same.same.length || same.other.length) return '같은 고객인데 진행 중단 계약을 세어 새 기안이 막힘';
        if (same.stopped.map(x => x.id).join() !== '2610CL012') return '같은 고객의 진행 중단 계약이 따로 남지 않음';
        // 결재 문서에 보일 앞 계약(같은 고객, 같은 번호, 앞서 기안)
        const fake = { id: '2610CL990', counterparty: c.counterparty, opportunity: NO, requestedAt: '2026-10-18 10:00' };
        if (C.oppStoppedOf(fake).map(x => x.id).join() !== '2610CL012') return '결재 문서에 보일 진행 중단한 앞 계약이 없음';
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검, 코드 다시 보기 review-03) 찾은 사람의 재현: 예전에는 열람 제한 계약(2610CL011)의 총무 메모("이음병원 구매팀이 …")가 넘어온 일의 note로 가서
      //   계약을 볼 수 없는 컴플라이언스 담당자에게 개선 과제 화면의 "의견:"과 관리자 변경 이력으로 보였음. 넘어온 일은 계약번호와 고정 문장만(REQ-FLOW-37)
      name: '(review-03) 열람 제한 계약(2610CL011)에서 "돌려받지 못함"을 고르면 넘어온 일과 관리자 변경 이력에 총무 메모가 들어가지 않고, 메모는 결재 기록에만 남음',
      kind: 'deny',
      run(h) {
        const MEMO = '이음병원 구매팀이 날인본 2부를 잃어버렸다고 함(시험)';
        for (const restricted of [true, false]) {
          const env = setup(h, D => { D.CONTRACTS.find(x => x.id === '2610CL011').restricted = restricted; });
          const { X, D, U, C } = env;
          const c = env.contract('2610CL011');
          if (!doStop(env, c, 'ok', 'u_head', { memo: '' }).done) return '리더 확인이 저장되지 않음(시험 전제)';
          const r = doStop(env, c, 'back', 'u_ga', { memo: MEMO }, { end: 'LOST' });
          if (!r.done) return '확인이 저장되지 않음: ' + JSON.stringify(r.errors);
          const e = c.history[c.history.length - 1];
          const iss = X.pendingIssues().filter(i => i.ref === c.id)[0];
          if (!iss || iss.id !== e.issueId) return '컴플라이언스에 넘어온 일이 없음(시험 전제)';
          if (restricted) {
            const comp = D.ACCOUNTS.find(a => a.status === 'ACTIVE' && (a.roles || []).indexOf('COMPLIANCE') > -1 && !C.canView(c, U(a.id)));
            if (!comp) return '시험 전제: 열람 제한 계약을 볼 수 없는 컴플라이언스 담당자가 없음';
          }
          const what = restricted ? '열람 제한 계약' : '열람 제한이 아닌 계약';
          if (String(iss.note || '').indexOf('잃어버렸다') > -1 || String(iss.note || '').indexOf('이음병원') > -1) return what + ': 넘어온 일의 note에 총무 메모가 들어감: ' + iss.note;
          if (String(iss.title).indexOf(c.counterparty) > -1) return what + ': 넘어온 일 제목에 고객사 이름이 들어감';
          const log = D.ADMIN_LOG.filter(x => x.op && x.op.k === 'ISSUE_RAISE' && x.op.i.id === iss.id)[0];
          if (!log || JSON.stringify(log).indexOf('잃어버렸다') > -1) return what + ': 관리자 변경 이력에 총무 메모가 들어감';
          if (String(e.comment).indexOf('잃어버렸다') < 0) return what + ': 결재 기록(회수 확인 의견)에 메모가 남지 않음';
        }
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검, 코드 다시 보기 admin-01 ①, 결정할것 admin-01 ① [가정]) 찾은 사람의 재현: ⑧ 담당자를 10-01~10-10 동안 영업지원 리더 엄지훈으로 두면
      //   2610CL014의 ⑥ 인증서 서명(10-07)이 엄지훈 몫. 예전에는 엄지훈을 사용 중지해도 넘겨받을 다른 리더가 없어 차례가 사용 중지된 계정에 남았음
      name: '(admin-01) 서명한 영업지원 리더(엄지훈)가 사용 중지면 사용 중인 다른 영업지원 담당자(배수아)가 전자계약 취소 확인을 맡고, 아무도 없으면 서명한 사람 그대로',
      kind: 'ok',
      run(h) {
        const S08 = D => { D.ASSIGNEE_CHANGES.push({ step: 'S08', to: 'u_jihoon_eom', at: '2026-10-01 00:00' }, { step: 'S08', to: 'u_sadmin', at: '2026-10-10 00:00' }); };
        const off = ids => D => { S08(D); ids.forEach(id => { D.ACCOUNTS.find(a => a.id === id).status = 'SUSPENDED'; }); };
        let env = setup(h, S08);
        let c = env.contract('2610CL014');
        if (!c.stopInfo.cert || c.stopInfo.cert.certSigner !== 'u_jihoon_eom') return '시험 전제: 10-07 인증서 서명이 엄지훈 몫이 아님';
        if ((turn(c, 'SSE') || {}).userId !== 'u_jihoon_eom') return '시험 전제: 사용 중지 전 차례가 엄지훈이 아님';
        env = setup(h, off(['u_jihoon_eom']));
        c = env.contract('2610CL014');
        const se = turn(c, 'SSE');
        if (!se || se.userId !== 'u_sadmin') return '리더 엄지훈이 사용 중지인데 다른 영업지원 담당자 배수아가 맡지 않음: ' + (se && se.userId);
        if (!env.C.canEsignBack(c, env.U('u_sadmin'))) return '배수아가 전자계약 취소 확인을 할 수 없음';
        const r = doStop(env, c, 'eback', 'u_sadmin', ev({ memo: '고객사 시스템에서 계약 요청을 취소함(시험)' }), { end: 'CANCELLED' });
        if (!r.done || c.status !== 'STOPPED') return '배수아의 전자계약 취소 확인으로 진행 중단이 끝나지 않음: ' + c.status;
        // 배수아도 사용 중지면 석다인(같은 조직의 다음 담당자)
        env = setup(h, off(['u_jihoon_eom', 'u_sadmin']));
        if ((turn(env.contract('2610CL014'), 'SSE') || {}).userId !== 'u_dain_seok') return '배수아도 사용 중지인데 석다인이 맡지 않음';
        // 견줌: 영업지원이 아무도 없으면 서명한 사람 그대로(예전과 같음. 사용자 권한 관리가 사용 중지를 막음, AC-44)
        env = setup(h, off(['u_jihoon_eom', 'u_sadmin', 'u_dain_seok']));
        if ((turn(env.contract('2610CL014'), 'SSE') || {}).userId !== 'u_jihoon_eom') return '견줌: 넘겨받을 영업지원이 없는데 차례가 다른 사람에게 감';
        return true;
      },
    },
  ],
  serverOnly: [
    '요청할 수 있는 상태, 확인하는 사람, 날인 여부(요청 전 S06 승인 중 인증서 서명이 아닌 것), 인증서 서명 여부(cert_signer), SSE를 맡는 사람을 서버가 다시 봄(시안은 화면 단추와 창에서만 정함)',
    '진행 중단 동작(STOP_REQ, STOP_OK, SEAL_BACK, ESIGN_BACK)을 요청으로 직접 보냄: 시안 recordAction은 진행 중단 동작의 사람과 상태를 다시 검사하지 않음. 서버가 상태 전이표(CTL-57)에 없는 바뀜을 막음',
    'stopped_at은 마지막 확인 일시로 서버가 정함',
  ],
};
