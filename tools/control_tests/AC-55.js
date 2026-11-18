// AC-55 전자계약의 ⑥과 ⑧은 다른 사람 (CTL-145, 06 통제 목록 2장) 시험 (2026-11-13 주말 점검 W2)
//   기대 동작: 체결 방식이 전자계약이면 ⑥은 영업지원 담당자가 인증서 서명의 확인 항목과 서명한 사람, 일시를 남기고, ⑧은 ⑥을 한 사람과 기안자가 아닌
//     다른 영업지원 담당자(없으면 영업지원 리더)가 맡는다. ⑥을 한 사람은 대리 지정으로도 ⑧을 처리하지 못한다.
//     인증서 서명은 인장 기록 대조의 계약서 날인에 들지 않고 "인증서 서명"으로 보이기만 한다.
//   시안 코드: common.js esignSignerAt, esignCheckerAt, otherSalesAdmin, stepUser, canAct. review.js ⑥ 인증서 서명 창(lib.js의 review로 누름).
//     new-contract.js 기안 검사(lib.js의 nc). seal-recon.js seals, certSigns(함수 글을 그대로 꺼내 씀)
//     (2026-11-14 주말 점검, 코드 다시 보기 review-02, admin-02) ⑧을 ⑩ 담당 재무가 맡는 경우 결재 문서 ⑥, ⑦ 창 안내와 결재선 규칙 화면(admin-rules.js)의 ⑧ 줄 안내
//     (review-02 2차) 계약 등록 기안 확인 창(new-contract.js openModal)의 "체결 방식" 줄이 결재선 미리 보기의 ⑧ 까닭과 같은지
'use strict';
const lib = require('./lib');
const { fixClock, step } = lib;

function setup(h, hook) { const env = h.fresh({ role: 'SUPER', hook }); fixClock(env); return env; }
const DELEG = (absentId, delegateId) => D => D.DELEGATIONS.push({ id: 'DL-T55', absentId, delegateId, from: '2026-10-19', to: '2026-10-23', reason: '휴가(시험)', by: 'u_admin', at: '2026-10-10 10:00', endedAt: null });
const both = (...hooks) => D => hooks.forEach(f => f && f(D));
// 결재 문서의 ⑥ 인증서 서명 창에서 처리(확인 항목 모두 표시, 날짜와 시각은 넣은 그대로. 빈칸도 빈칸으로). 돌려주는 값 { ok, entry, why }
function signS06(env, who, date, time) {
  const rv = lib.review(env, '2610CL013', who);
  if (rv.error) return { ok: false, why: '결재 문서를 열지 못함: ' + rv.error.message };
  if (!rv.hasButton('APPROVE', 'S06')) return { ok: false, why: who + '에게 ⑥ 인증서 서명 단추가 없음' };
  rv.open('APPROVE', 'S06').checkAll();
  if (!rv.dom.ids.has('#act-date') || !rv.dom.ids.has('#act-time')) return { ok: false, why: '⑥ 창에 서명한 날과 시각 칸이 없음' };
  rv.date(date).time(time).comment('');
  const c = env.contract('2610CL013'), n = c.history.length;
  rv.confirm();
  const e = c.history.length > n ? c.history[c.history.length - 1] : null;
  return { ok: !!e, entry: e, why: e ? '' : '⑥ 인증서 서명이 남지 않음' };
}
// 인장 기록 대조(seal-recon.js)의 그달 계약서 날인(seals), 인증서 서명(certSigns), 날인 열쇠(sealKeysOf)
function sealRecon(env) {
  const body = 'const D = window.CLIMB_DATA, C = window.CLIMB;\n' + ['seals', 'certSigns', 'sealKeysOf'].map(n => lib.fnSrc('seal-recon.js', n)).join('\n') +
    '\nreturn { seals: seals, certSigns: certSigns, sealKeysOf: sealKeysOf };';
  return lib.compile(env, [], body, 'seal-recon.js(꺼낸 함수)')();
}
// 2610CL013을 배수아가 ⑥ 서명하고 이도윤이 ⑦ 출력본 등록까지(⑧ 차례로)
function toS08(env) {
  const r = signS06(env, 'u_sadmin', env.D.TODAY, '08:00');
  if (!r.ok) return r.why;
  const c = env.contract('2610CL013');
  const e = env.C.recordAction(c, step(c, 'S07'), 'REGISTER', '확인: 시험', env.U('u_sales1'), { fileName: '청솔대학교_전자계약서.pdf', signDate: env.D.TODAY });
  if (!e) return '⑦ 출력본 등록이 남지 않음';
  if (step(c, 'S08').state !== 'PENDING') return '⑧ 차례가 되지 않음';
  return '';
}

module.exports = {
  ac: 'AC-55',
  title: '전자계약의 ⑥과 ⑧은 다른 사람',
  tests: [
    {
      name: '2610CL013(청솔대학교, 나라장터 전자계약): ⑥ 인증서 서명 차례가 배수아이고 ⑧은 석다인으로 미리 보임',
      kind: 'ok',
      run(h) {
        const env = setup(h);
        const c = env.contract('2610CL013');
        if (!env.C.isEsign(c) || env.C.signMethodOf(c) !== 'ESIGN_G2B') return '나라장터 전자계약이 아님(시험 전제)';
        const s6 = step(c, 'S06'), s8 = step(c, 'S08');
        if (s6.state !== 'PENDING' || s6.userId !== 'u_sadmin') return '⑥ 차례가 배수아가 아님: ' + s6.userId + ' ' + s6.state;
        if (s8.userId !== 'u_dain_seok') return '⑧이 석다인으로 미리 보이지 않음: ' + s8.userId;
        return true;
      },
    },
    {
      name: '⑥을 석다인이 하면(배수아의 대리) ⑧은 배수아, 서명한 사람과 일시가 기록에 남음',
      kind: 'ok',
      run(h) {
        const env = setup(h, DELEG('u_sadmin', 'u_dain_seok'));
        const r = signS06(env, 'u_dain_seok', env.D.TODAY, '08:30');
        if (!r.ok) return r.why;
        if (r.entry.certSigner !== 'u_dain_seok' || r.entry.certSignedAt !== env.D.TODAY + ' 08:30') return '서명한 사람이나 일시가 남지 않음: ' + r.entry.certSigner + ', ' + r.entry.certSignedAt;
        if (!/인증서 서명: /.test(r.entry.comment || '')) return '의견에 인증서 서명 한 줄이 없음';
        const miss = env.D.ESIGN_CHECKS.filter(k => String(r.entry.comment).indexOf(k) < 0);
        if (miss.length) return '⑥ 기록에 인증서 서명의 확인 항목이 빠짐: ' + miss.join(', ');
        if (r.entry.signMethod !== 'ESIGN_G2B') return '⑥ 기록에 체결 방식이 남지 않음: ' + r.entry.signMethod;
        const c = env.contract('2610CL013');
        if (step(c, 'S08').userId !== 'u_sadmin') return '⑧이 배수아가 아님: ' + step(c, 'S08').userId;
        return true;
      },
    },
    {
      name: '석다인이 사용 중지면 ⑧은 영업지원 리더 엄지훈, 기안자가 배수아면 ⑥ 석다인과 ⑧ 엄지훈',
      kind: 'ok',
      run(h) {
        let env = setup(h, D => { D.ACCOUNTS.find(a => a.id === 'u_dain_seok').status = 'SUSPENDED'; });
        let c = env.contract('2610CL013');
        if (step(c, 'S08').userId !== 'u_jihoon_eom') return '석다인 사용 중지 때 ⑧이 엄지훈이 아님: ' + step(c, 'S08').userId;
        env = setup(h, D => { D.CONTRACTS.find(x => x.id === '2610CL013').requesterId = 'u_sadmin'; });
        c = env.contract('2610CL013');
        if (step(c, 'S06').userId !== 'u_dain_seok') return '기안자가 배수아일 때 ⑥이 석다인이 아님: ' + step(c, 'S06').userId;
        if (step(c, 'S08').userId !== 'u_jihoon_eom') return '기안자가 배수아일 때 ⑧이 엄지훈이 아님: ' + step(c, 'S08').userId;
        return true;
      },
    },
    {
      name: '인장 기록 대조에서 이 서명은 "인증서 서명" 묶음에만 보임(2610CL013 ⑥ 배수아 서명 뒤)',
      kind: 'ok',
      run(h) {
        const env = setup(h);
        const r = signS06(env, 'u_sadmin', env.D.TODAY, '08:00');
        if (!r.ok) return r.why;
        const sr = sealRecon(env), ym = env.D.TODAY.slice(0, 7);
        const cs = sr.certSigns(ym).filter(x => x.no === '2610CL013');
        if (cs.length !== 1 || cs[0].signer !== 'u_sadmin' || cs[0].method !== '나라장터 전자계약') return '"인증서 서명" 묶음에 서명이 한 줄로 보이지 않음: ' + JSON.stringify(cs.map(x => [x.signer, x.method]));
        if (sr.seals(ym).some(x => x.no === '2610CL013')) return '계약서 날인 묶음에도 보임';
        return true;
      },
    },
    {
      name: '⑥을 한 사람은 ⑧을 처리하지 못함(석다인의 대리로 지정되어도, 2610CL013)',
      kind: 'deny',
      run(h) {
        const env = setup(h, DELEG('u_dain_seok', 'u_sadmin'));
        const why = toS08(env);
        if (why) return why + '(시험 전제)';
        const { C, U } = env;
        const c = env.contract('2610CL013');
        const s8 = step(c, 'S08');
        if (s8.userId !== 'u_dain_seok') return '⑧이 석다인이 아님(시험 전제): ' + s8.userId;
        if (!C.isMyStep(s8, U('u_sadmin'))) return '대리 지정이 효력이 없음(시험 전제)';
        if (C.canAct(c, s8, U('u_sadmin'))) return '⑥을 한 배수아가 대리로 ⑧ 처리 막대를 받음';
        const rv = lib.review(env, '2610CL013', 'u_sadmin');
        if (rv.hasButton('APPROVE', 'S08')) return '결재 문서에서 배수아에게 ⑧ 확인 단추가 보임';
        if (!C.canAct(c, s8, U('u_dain_seok'))) return '견줌: 석다인도 ⑧을 처리할 수 없음(시험 전제)';
        return true;
      },
    },
    {
      name: '⑥에 서명한 날이나 시각이 빈칸이거나 미래면 저장되지 않음(오늘 20시에 23:59, 내일 날짜)',
      kind: 'deny',
      run(h) {
        const cases = [['', '08:00', '날짜 빈칸'], ['2026-10-20', '08:00', '내일 날짜'], ['2026-10-19', '', '시각 빈칸'], ['2026-10-19', '23:59', '지금보다 뒤 시각']];
        for (const x of cases) {
          const env = setup(h);
          const c = env.contract('2610CL013');
          const n0 = c.history.length;
          const r = signS06(env, 'u_sadmin', x[0], x[1]);
          if (r.ok || c.history.length !== n0) return x[2] + '로 ⑥ 인증서 서명이 저장됨';
          if (step(c, 'S06').state !== 'PENDING') return x[2] + ': ⑥ 차례가 끝남';
        }
        // 견줌: 오늘 08:00이면 저장됨
        const env = setup(h);
        const ok = signS06(env, 'u_sadmin', '2026-10-19', '08:00');
        if (!ok.ok) return '견줌: 맞는 날짜와 시각도 저장되지 않음: ' + ok.why;
        return true;
      },
    },
    {
      name: '계약 방식이 조달이 아닌데 나라장터 전자계약이면 기안되지 않음',
      kind: 'deny',
      run(h) {
        const env = setup(h);
        const p = lib.nc(env, lib.ncState({ me: env.U('u_sales1'), vals: { method: 'DIRECT', signMethod: 'ESIGN_G2B' }, lines: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '12,000,000' }] }));
        const r = p.submit('2610CL971');
        if (r.rec || env.contract('2610CL971')) return '직접 계약에 나라장터 전자계약으로 기안됨';
        if (!lib.hasErr(r.errors, '나라장터 전자계약은 계약 방식이 조달일 때')) return '나라장터 오류가 없음: ' + r.errors.join(' / ');
        // 견줌: 고객사 전자계약은 직접 계약에서도 그 오류가 없음
        const q = lib.nc(env, lib.ncState({ me: env.U('u_sales1'), vals: { method: 'DIRECT', signMethod: 'ESIGN_CUSTOMER' }, lines: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '12,000,000' }] }));
        if (lib.hasErr(q.errors(), '나라장터')) return '견줌: 고객사 전자계약에도 나라장터 오류가 나옴';
        return true;
      },
    },
    {
      name: '견적서로 계약서를 대신하면서 전자계약이면 기안되지 않음',
      kind: 'deny',
      run(h) {
        const env = setup(h);
        const p = lib.nc(env, lib.ncState({ me: env.U('u_sales1'), quoteInstead: true, vals: { signMethod: 'ESIGN_CUSTOMER' },
          lines: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '1,000,000' }],
          files: { draft: [], diff: [], annex: [], quote: [{ name: '최종 견적서.pdf', size: 1000 }] } }));
        const r = p.submit('2610CL972');
        if (r.rec || env.contract('2610CL972')) return '견적서 대신과 전자계약으로 기안됨';
        if (!lib.hasErr(r.errors, '견적서로 계약서를 대신하는 계약은 종이 날인입니다')) return '종이 날인 오류가 없음: ' + r.errors.join(' / ');
        return true;
      },
    },
    {
      name: '인증서 서명은 인장 기록 대조의 계약서 날인 수와 열쇠에 들지 않음',
      kind: 'deny',
      run(h) {
        const env = setup(h);
        const ym = env.D.TODAY.slice(0, 7);
        const before = sealRecon(env);
        const n0 = before.seals(ym).length, k0 = before.sealKeysOf(before.seals(ym));
        const r = signS06(env, 'u_sadmin', env.D.TODAY, '08:00');
        if (!r.ok) return r.why + '(시험 전제)';
        const sr = sealRecon(env);
        const list = sr.seals(ym);
        if (list.length !== n0) return '계약서 날인 수가 ' + n0 + ' → ' + list.length;
        const k1 = sr.sealKeysOf(list);
        if (k1 !== k0 || k1.indexOf('2610CL013') > -1) return '날인 열쇠에 인증서 서명이 들어감';
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검 W7, isms-02) 사용 중인 영업지원 담당자가 한 명뿐이고 그 사람이 기안하면, 예전에는 ⑧이 기안자에게 돌아가 아무도 처리하지 못했음.
      //   지금은 ⑥을 한 사람과 기안자를 뺀 영업지원이 없으면 ⑩ 담당 재무(u_finance)가 ⑧을 맡음(REQ-AUTH-16과 같은 대체)
      name: '(W7) 사용 중인 영업지원 담당자가 배수아 한 명이고 배수아가 기안하면 ⑥은 리더 엄지훈, ⑧은 ⑩ 담당 재무가 맡아 처리할 수 있음(2610CL013, 석다인 사용 중지)',
      kind: 'deny',
      run(h) {
        const env = setup(h, D => { D.ACCOUNTS.find(a => a.id === 'u_dain_seok').status = 'SUSPENDED'; D.CONTRACTS.find(x => x.id === '2610CL013').requesterId = 'u_sadmin'; });
        const { C, U, D } = env;
        const c = env.contract('2610CL013');
        const fin = D.STEP_ASSIGNEE.S10;
        if (step(c, 'S06').userId !== 'u_jihoon_eom') return '⑥이 엄지훈이 아님(시험 전제): ' + step(c, 'S06').userId;
        if (step(c, 'S08').userId !== fin) return '⑧이 ⑩ 담당 재무로 미리 보이지 않음: ' + step(c, 'S08').userId;
        if (C.esignCheckerWhy(c).indexOf('재무') < 0) return '⑧을 맡는 까닭 문장에 재무가 없음: ' + C.esignCheckerWhy(c);
        const r = signS06(env, 'u_jihoon_eom', env.D.TODAY, '08:00');
        if (!r.ok) return r.why + '(시험 전제)';
        const rep = C.repActorOf(c);
        if (!C.recordAction(c, step(c, 'S07'), 'REGISTER', '확인: 시험', U(rep), { fileName: '청솔대학교_전자계약서.pdf', signDate: env.D.TODAY })) return '⑦ 출력본 등록이 남지 않음(시험 전제)';
        const s8 = step(c, 'S08');
        if (s8.state !== 'PENDING' || s8.userId !== fin) return '⑧ 차례가 ⑩ 담당 재무가 아님: ' + s8.userId + ' ' + s8.state;
        if (!C.canAct(c, s8, U(fin))) return '재무가 ⑧을 처리할 수 없음';
        for (const id of ['u_sadmin', 'u_jihoon_eom']) if (C.canAct(c, s8, U(id))) return id + '(기안자이거나 ⑥을 한 사람)가 ⑧을 처리할 수 있음';
        if (C.stepWho('S08', c) !== C.roleShort('FINANCE')) return '⑧ 맡는 사람 이름이 재무가 아님: ' + C.stepWho('S08', c);
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검 W7, isms-02) 영업지원 리더가 기안하고 사용 중인 담당자가 한 명이면 ⑥은 그 담당자, ⑧은 예전에 ⑥을 한 사람에게 남았음. 지금은 재무
      name: '(W7) 영업지원 리더 엄지훈이 기안하고 사용 중인 담당자가 배수아 한 명이면 ⑥은 배수아, ⑧은 ⑩ 담당 재무(2610CL013, 석다인 사용 중지)',
      kind: 'deny',
      run(h) {
        const env = setup(h, D => { D.ACCOUNTS.find(a => a.id === 'u_dain_seok').status = 'SUSPENDED'; D.CONTRACTS.find(x => x.id === '2610CL013').requesterId = 'u_jihoon_eom'; });
        const { C, U, D } = env;
        const c = env.contract('2610CL013');
        const fin = D.STEP_ASSIGNEE.S10;
        if (step(c, 'S06').userId !== 'u_sadmin') return '⑥이 배수아가 아님(시험 전제): ' + step(c, 'S06').userId;
        if (step(c, 'S08').userId !== fin) return '⑧이 ⑩ 담당 재무로 미리 보이지 않음: ' + step(c, 'S08').userId;
        const r = signS06(env, 'u_sadmin', env.D.TODAY, '08:00');
        if (!r.ok) return r.why + '(시험 전제)';
        if (!C.recordAction(c, step(c, 'S07'), 'REGISTER', '확인: 시험', U(C.repActorOf(c)), { fileName: '청솔대학교_전자계약서.pdf', signDate: env.D.TODAY })) return '⑦ 출력본 등록이 남지 않음(시험 전제)';
        const s8 = step(c, 'S08');
        if (s8.state !== 'PENDING' || s8.userId !== fin) return '⑧ 차례가 ⑩ 담당 재무가 아님: ' + s8.userId + ' ' + s8.state;
        if (C.canAct(c, s8, U('u_sadmin'))) return '⑥을 한 배수아가 ⑧을 처리할 수 있음';
        if (!C.canAct(c, s8, U(fin))) return '재무가 ⑧을 처리할 수 없음';
        // 견줌: 석다인이 사용 중이면 ⑧은 그대로 석다인(다른 영업지원 담당자가 먼저)
        const env2 = setup(h, D => { D.CONTRACTS.find(x => x.id === '2610CL013').requesterId = 'u_jihoon_eom'; });
        if (step(env2.contract('2610CL013'), 'S08').userId !== 'u_dain_seok') return '견줌: 석다인이 사용 중인데 ⑧이 석다인이 아님: ' + step(env2.contract('2610CL013'), 'S08').userId;
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검 W7, isms-03) 기획자 결정 B-8(날짜 순서가 이상하면 알리고 막지 않음)을 ⑥ 인증서 서명 일시에도.
      //   2610CL013은 계약 검토 승인 2026-10-15 14:00. 그보다 앞선 2026-10-14 09:00으로 서명하면 저장은 되고, 창에 미리 안내 줄의 알림 표시가 켜지며,
      //   결재 문서의 날짜 순서 안내(CERT_BEFORE_APPROVAL)에 남음. 견줌: 승인 뒤 일시면 안내가 없음
      name: '(W7) ⑥ 인증서 서명 일시가 계약 검토 승인보다 앞서면 막지 않고 저장되며, 창의 안내 줄과 결재 문서의 날짜 순서 안내가 보임(2610CL013)',
      kind: 'deny',
      run(h) {
        const env = setup(h);
        const c = env.contract('2610CL013');
        const rv = lib.review(env, '2610CL013', 'u_sadmin');
        if (!rv.hasButton('APPROVE', 'S06')) return '배수아에게 ⑥ 단추가 없음(시험 전제)';
        rv.open('APPROVE', 'S06').checkAll();
        if (rv.extra().indexOf('act-cert-order') < 0 || rv.extra().indexOf('2026-10-15 14:00') < 0) return '⑥ 창에 계약 검토 승인 일시 안내 줄이 처음부터 없음';
        rv.date('2026-10-14').time('09:00');
        rv.dom.fire('#act-modal', 'change', { target: rv.dom.q('#act-time') });
        if (rv.dom.q('#act-cert-order-icon').style.visibility !== 'visible') return '승인보다 앞선 일시를 넣어도 안내 줄의 알림 표시가 켜지지 않음';
        if (!/앞섭니다/.test(rv.dom.q('#act-cert-order-sr').textContent)) return '화면낭독기 글이 없음';
        const n = c.history.length;
        rv.comment('').confirm();
        const e = c.history.length > n ? c.history[c.history.length - 1] : null;
        if (!e || e.certSignedAt !== '2026-10-14 09:00') return '승인보다 앞선 서명 일시로 저장되지 않음(막지 않아야 함)';
        const iss = env.C.dateOrderIssues(c);
        if (!iss.some(x => x.code === 'CERT_BEFORE_APPROVAL')) return '날짜 순서 안내에 인증서 서명 일시가 없음: ' + iss.map(x => x.code).join(',');
        const doc = lib.review(env, '2610CL013', 'u_sales1');
        const ex = lib.strip(doc.dom.q('#basic-extra').innerHTML);
        if (ex.indexOf('날짜 순서를 확인해 주세요') < 0 || ex.indexOf('인증서 서명 일시') < 0) return '결재 문서에 인증서 서명 일시의 날짜 순서 안내가 없음';
        // 견줌: 승인 뒤 일시(오늘 08:00)면 안내 없음, 창의 알림 표시도 꺼짐
        const env2 = setup(h);
        const rv2 = lib.review(env2, '2610CL013', 'u_sadmin');
        rv2.open('APPROVE', 'S06').checkAll().date('2026-10-19').time('08:00');
        rv2.dom.fire('#act-modal', 'change', { target: rv2.dom.q('#act-time') });
        if (rv2.dom.q('#act-cert-order-icon').style.visibility === 'visible') return '견줌: 승인 뒤 일시인데 알림 표시가 켜짐';
        rv2.comment('').confirm();
        if (env2.C.dateOrderIssues(env2.contract('2610CL013')).some(x => x.code === 'CERT_BEFORE_APPROVAL')) return '견줌: 승인 뒤 서명인데 날짜 순서 안내가 생김';
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검, 코드 다시 보기 review-02) ⑧을 ⑩ 담당 재무가 맡는 경우(isms-02)에 결재 문서의 ⑥ 인증서 서명 창과 ⑦ 출력본 등록 창이
      //   "다른 영업지원이 확인"이라고 알려 주던 것. 이제 C.esignCheckerWhy(실제 ⑧ 담당 규칙)로 적음. 견줌: 석다인이 사용 중이면 "다른 영업지원 담당자"
      name: '⑧을 ⑩ 담당 재무가 맡으면(석다인 사용 중지, 배수아 기안) ⑥ 인증서 서명 창과 ⑦ 출력본 등록 창의 안내도 "⑩ 담당 재무가 확인"(2610CL013)',
      kind: 'deny',
      run(h) {
        const hook = D => { D.ACCOUNTS.find(a => a.id === 'u_dain_seok').status = 'SUSPENDED'; D.CONTRACTS.find(x => x.id === '2610CL013').requesterId = 'u_sadmin'; };
        const env = setup(h, hook);
        const { C, D } = env;
        const c = env.contract('2610CL013');
        if (step(c, 'S08').userId !== D.STEP_ASSIGNEE.S10) return '시험 전제: ⑧이 ⑩ 담당 재무가 아님: ' + step(c, 'S08').userId;
        const rv = lib.review(env, '2610CL013', 'u_jihoon_eom');
        if (!rv.hasButton('APPROVE', 'S06')) return '엄지훈에게 ⑥ 단추가 없음(시험 전제)';
        const d6 = rv.open('APPROVE', 'S06').desc();
        if (d6.indexOf('⑩ 담당 재무가 확인') < 0) return '⑥ 인증서 서명 창 안내에 ⑩ 담당 재무가 없음: ' + d6;
        if (d6.indexOf('다른 영업지원이 합니다') > -1) return '⑥ 창이 아직 "다른 영업지원이 합니다"로 알림';
        const r = signS06(env, 'u_jihoon_eom', D.TODAY, '08:00');
        if (!r.ok) return r.why + '(시험 전제)';
        const rv7 = lib.review(env, '2610CL013', C.repActorOf(c));
        if (!rv7.hasButton('REGISTER', 'S07')) return '⑦ 등록 단추가 영업대표에게 없음(시험 전제)';
        const d7 = rv7.open('REGISTER', 'S07').desc();
        if (d7.indexOf('⑩ 담당 재무가 확인') < 0) return '⑦ 출력본 등록 창 안내에 ⑩ 담당 재무가 없음: ' + d7;
        if (d7.indexOf('하지 않은 영업지원이') > -1) return '⑦ 창이 아직 "⑥을 하지 않은 영업지원이 확인"으로 알림';
        // 견줌: 기본 예시(석다인 사용 중)의 ⑥ 창은 "다른 영업지원 담당자가 확인"
        const env0 = setup(h);
        const d0 = lib.review(env0, '2610CL013', 'u_sadmin').open('APPROVE', 'S06').desc();
        if (d0.indexOf('⑥을 한 사람과 다른 영업지원 담당자가 확인') < 0 || d0.indexOf('재무') > -1) return '견줌: 기본 예시의 ⑥ 창 안내가 다름: ' + d0;
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검, 코드 다시 보기 admin-02) 결재선 규칙 화면의 ⑧ 줄: 다른 영업지원과 리더가 모두 없으면 ⑧ 출력본 확인은 ⑩ 담당 재무(common.js esignCheckerAt)
      //   예전에는 "⑧ 출력본 확인은 이 담당자"(⑥을 서명한 본인)로 보였고, 거치는 조건 칸에 재무가 없었음
      name: '결재선 규칙(관리자): 석다인과 엄지훈이 사용 중지면 ⑧ 줄 안내가 "⑧ 출력본 확인은 ⑩ 담당 재무 …"이고 거치는 조건 칸에 "그도 없으면 ⑩ 담당 재무"(결재 문서의 ⑧ 담당과 같음)',
      kind: 'deny',
      run(h) {
        const off = D => { D.ACCOUNTS.forEach(a => { if (a.id === 'u_dain_seok' || a.id === 'u_jihoon_eom') a.status = 'SUSPENDED'; }); };
        const rowOf = pg => lib.stripTags(String(pg.node('#assignee-rows').innerHTML).split('<tr>').find(r => r.indexOf('data-change="S08"') > -1) || '');
        const pg = lib.openPage(h, 'admin-rules.js', { role: 'ADMIN', hook: off });
        const { C, D } = pg.env;
        const fin = C.assigneeOf('S10');
        const row = rowOf(pg);
        if (!row) return '⑧ 줄이 없음(시험 대조 실패)';
        if (row.indexOf('⑧ 출력본 확인은 ⑩ 담당 재무 ' + C.ownerLabel(fin)) < 0) return '⑧ 줄 안내에 ⑩ 담당 재무가 없음: ' + row.slice(0, 200);
        if (row.indexOf('⑧ 출력본 확인은 이 담당자') > -1) return '⑧ 줄이 아직 "이 담당자"(⑥을 서명한 본인)로 보임';
        if (row.indexOf('그도 없으면 ⑩ 담당 재무') < 0) return '거치는 조건 칸에 "그도 없으면 ⑩ 담당 재무"가 없음';
        const c = pg.env.contract('2610CL013');
        if (step(c, 'S08').userId !== fin) return '시험 전제: 같은 상태에서 결재 문서의 ⑧이 ⑩ 담당 재무가 아님: ' + step(c, 'S08').userId;
        // 견줌: 기본 예시는 석다인
        const base = rowOf(lib.openPage(h, 'admin-rules.js', { role: 'ADMIN' }));
        if (base.indexOf('⑧ 출력본 확인은 세일즈어드민유닛 석다인') < 0) return '견줌: 기본 예시의 ⑧ 줄이 석다인이 아님: ' + base.slice(0, 200);
        if (D.ACCOUNTS.find(a => a.id === 'u_dain_seok').status !== 'SUSPENDED') return '시험 전제: 석다인이 사용 중지가 아님';
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검, 코드 다시 보기 review-02 2차) 계약 등록의 기안 확인 창 "체결 방식" 줄은 예전에 고정 글 "⑧은 ⑥을 하지 않은 다른 영업지원이 확인"이라
      //   같은 화면의 결재선 미리 보기(⑧ 줄 까닭 C.esignCheckerWhy)와 어긋났음. 확인 창 함수(new-contract.js openModal)를 그대로 꺼내 결재선 미리 보기(buildRoute, lib.nc)의 결과로 그려 봄
      name: '계약 등록(전자계약, 석다인과 엄지훈 사용 중지, 이도윤 기안)의 기안 확인 창 "체결 방식" 줄도 결재선 미리 보기처럼 "⑧은 … ⑩ 담당 재무가 확인"',
      kind: 'deny',
      run(h) {
        const confirmText = hook => {
          const env = h.fresh({ role: 'SALES', hook });
          fixClock(env);
          const vals = { signMethod: 'ESIGN_G2B' };
          const p = lib.nc(env, lib.ncState({ me: env.U('u_sales1'), lines: [{ service: 'CK', product: 'CK_CAMPUS', feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '12,000,000' }], vals }));
          const route = p.route();
          const r8 = route.filter(g => g.stage.indexOf('3단계') === 0).map(g => g.items.filter(i => i.no === '⑧')[0])[0];
          // 확인 창 함수가 쓰는 화면 값은 이 시험과 상관없는 것만 비워 둠(체결 방식 줄은 val('signMethod')와 current.route만 봄)
          const body = [
            'const D = window.CLIMB_DATA;',
            'const C = Object.assign(Object.create(window.CLIMB), { focusModal: function () {} });',
            'const esc = C.esc, document = { activeElement: null }, modal = { hidden: true }, box = { innerHTML: "" };',
            'let lastFocus = null; const round = 1; const current = ST.current; const opp = { same: [] }; const guard = { check: "" };',
            'function val(n) { return ST.vals[n] == null ? "" : String(ST.vals[n]); }',
            'function $(s) { return s === "#confirm-body" ? box : { value: "" }; }',
            'function oppDupOk() { return false; } function oppNames() { return ""; } function linkedQuote() { return null; } function amendKind() { return ""; }',
            'function priceOff() { return false; } function termsMode() { return false; } function serviceOfProducts() { return ""; } function fmtNum(n) { return String(n); }',
            'function templatePick() { return null; } function acctKindText() { return ""; } function acctKinds() { return []; } function unitValue() { return ""; }',
            lib.fnSrc('new-contract.js', 'openModal'),
            'openModal(); return box.innerHTML;',
          ].join('\n');
          const html = lib.compile(env, ['ST'], body, 'new-contract.js openModal(꺼낸 함수)')({ vals, current: { route, total: 12000000, qi: false, pc: {} } });
          const row = lib.stripTags(String(html).split('</div>').filter(x => x.indexOf('<dt>체결 방식</dt>') > -1)[0] || '');
          return { row, r8 };
        };
        const off = D => { ['u_dain_seok', 'u_jihoon_eom'].forEach(id => { D.ACCOUNTS.find(a => a.id === id).status = 'SUSPENDED'; }); };
        const x = confirmText(off);
        if (!x.r8 || x.r8.reason.indexOf('⑩ 담당 재무가 확인') < 0) return '시험 전제: 결재선 미리 보기의 ⑧ 줄이 ⑩ 담당 재무가 아님: ' + JSON.stringify(x.r8);
        if (!x.row) return '확인 창에 체결 방식 줄이 없음(시험 대조 실패)';
        if (x.row.indexOf('⑧은 ' + x.r8.reason) < 0) return '확인 창의 체결 방식 줄이 결재선 미리 보기의 ⑧ 까닭과 다름: ' + x.row;
        if (x.row.indexOf('⑥을 하지 않은 다른 영업지원이 확인') > -1) return '확인 창이 아직 고정 글 "⑥을 하지 않은 다른 영업지원이 확인"으로 알림';
        // 견줌: 기본 예시(석다인 사용 중)는 "⑥을 한 사람과 다른 영업지원 담당자가 확인"이고 재무가 없음
        const y = confirmText();
        if (y.row.indexOf('⑧은 ⑥을 한 사람과 다른 영업지원 담당자가 확인') < 0 || y.row.indexOf('재무') > -1) return '견줌: 기본 예시의 확인 창 체결 방식 줄이 다름: ' + y.row;
        return true;
      },
    },
  ],
  serverOnly: [
    '⑥과 ⑧을 맡는 사람은 차례가 된 때 서버가 정함(시안은 buildReview가 화면을 열 때 셈)',
    '⑧ 저장 요청을 직접 보냄: 서버가 그 차수의 ⑥ 기록(cert_signer)과 처리하는 사람(대리면 원래 담당자도)을 견주어 거절(시안 recordAction은 다시 검사하지 않음)',
    '⑥ 서명 일시를 비우거나 미래로 바꿔 요청에 담아 보냄: 서버가 다시 확인해 거절',
  ],
};
