// AC-26 승인 취소와 반려할 수 있는 단계 (CTL-44) 시험 (2026-11-13 주말 점검 W2)
//   06 통제 목록 2장 AC-26의 기대 동작: 승인 취소는 ②~⑤에서 승인한 본인이, 뒤 묶음의 어떤 단계도 처리되지 않았을 때만 된다.
//   ⑥~⑩의 승인 취소와 ⑦, ⑨, ⑩의 반려는 받지 않는다. CTL-44: 날인과 체결본이 없는 결재(해지 등)는 ⑨ 처리 전까지. 승인과 취소 기록은 모두 남는다.
//   승인 취소 단추는 common.js canCancel, 단계마다 누를 수 있는 일과 확인 창은 결재 문서(review.js)의 actionsOf, modalText.
//   review.js는 화면을 그리며 시작해 이 틀에 통째로 올릴 수 없으므로 그 함수와 한 줄 상수만 글자 그대로 떼어 와 부름(시안 코드는 고치지 않음)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const REVIEW_JS = path.join(__dirname, '..', '..', 'prototype', 'assets', 'js', 'review.js');

function reviewSrc() { return fs.readFileSync(REVIEW_JS, 'utf8'); }
// 결재 문서의 처리 막대 판단: actionsOf(단계) 누를 수 있는 일, modalText(일, 단계) 확인 창
function reviewActions(env, c) {
  const L = reviewSrc().split(/\r?\n/);
  const bal = s => (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length;
  const fn = name => {
    const i = L.findIndex(l => l.startsWith('  function ' + name + '('));
    if (i < 0) throw new Error('review.js에서 함수 ' + name + '을 찾지 못함');
    if (bal(L[i]) === 0) return L[i];
    return L.slice(i, L.findIndex((l, k) => k > i && l === '  }') + 1).join('\n');
  };
  const k = name => { const l = L.find(x => x.startsWith('  const ' + name + ' = ')); if (!l) throw new Error('review.js에서 상수 ' + name + '을 찾지 못함'); return l; };
  const src = '(function (c) {\nconst D = window.CLIMB_DATA, C = window.CLIMB;\n' + ['quote', 'esign', 'STEP_ACTIONS'].map(k).join('\n') + '\n' +
    ['actionsOf', 'modalText'].map(fn).join('\n') + '\nreturn { actionsOf: actionsOf, modalText: modalText };\n})';
  return vm.runInContext(src, env.ctx, { filename: 'review.js(떼어 옴)' })(c);
}
function fixClock(env) {
  const Base = env.ctx.Date;
  let n = 0;
  env.ctx.Date = class extends Base { constructor(...a) { if (a.length) super(...a); else super(2026, 9, 19, 20, n++, 0); } };
}
const step = (c, code) => (c.approvals || []).find(a => a.step === code);
const CHECK3 = D => ({ comment: '확인: ' + D.INTEREST_CHECK, extra: { noInterest: true } });

module.exports = {
  ac: 'AC-26',
  title: '승인 취소와 반려할 수 있는 단계',
  tests: [
    {
      name: '③ 승인 뒤 ④가 처리 전이면 ③ 승인자가 사유를 적고 취소, ③이 다시 차례가 되고 기록은 두 줄(2601CL001-A01)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'HEAD' });
        fixClock(env);
        const { D, C, U } = env;
        const c = env.contract('2601CL001-A01');
        const ko = U('u_eunseong_ko');
        const a = C.recordAction(c, step(c, 'S03'), 'APPROVE', CHECK3(D).comment, ko, CHECK3(D).extra);
        if (!a) return '③ 승인이 남지 않음';
        if (step(c, 'S04').state !== 'PENDING') return '③ 승인 뒤 ④가 차례가 아님';
        if (!C.canCancel(c, step(c, 'S03'), ko)) return '④ 처리 전인데 ③ 승인자가 승인을 취소할 수 없음';
        const x = C.recordAction(c, step(c, 'S03'), 'CANCEL', '할인 조건을 다시 확인해야 해서 취소', ko);
        if (!x) return '승인 취소 기록이 남지 않음';
        const s3 = step(c, 'S03'), s4 = step(c, 'S04');
        if (s3.state !== 'PENDING' || s3.decidedBy) return '취소 뒤 ③이 다시 차례가 아님: ' + s3.state;
        if (s4.state !== 'WAITING' || s4.arrivedAt) return '취소 뒤 ④가 대기로 돌아가지 않음: ' + s4.state + ' ' + s4.arrivedAt;
        const lines = c.history.filter(y => y.step === 'S03' && (y.at === a.at || y.at === x.at)).map(y => y.action);
        if (lines.join(',') !== 'APPROVE,CANCEL') return '③ 기록이 승인과 취소 두 줄이 아님: ' + lines.join(',');
        return true;
      },
    },
    {
      name: '④가 이미 승인한 뒤에는 ③ 승인 취소가 안 됨(2601CL001-A01)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'HEAD' });
        fixClock(env);
        const { D, C, U } = env;
        const c = env.contract('2601CL001-A01');
        const ko = U('u_eunseong_ko');
        if (!C.recordAction(c, step(c, 'S03'), 'APPROVE', CHECK3(D).comment, ko, CHECK3(D).extra)) return '③ 승인이 남지 않음';
        if (!C.recordAction(c, step(c, 'S04'), 'APPROVE', '바꾼 조항 확인: 이용자 추가 조항, 회사 책임 범위 같음', U('u_legal'))) return '④ 승인이 남지 않음';
        if (C.canCancel(c, step(c, 'S03'), ko)) return '④ 승인 뒤에도 ③ 승인을 취소할 수 있음';
        // 결재 문서에도 ③ 승인 취소 단추가 없음(lib.js의 review 도우미)
        let review = null;
        try { review = require('./lib').review; } catch (e) { return '결재 문서 도우미(lib.js review)를 불러오지 못함'; }
        const rv = review(env, '2601CL001-A01', ko);
        if (rv.error) return '결재 문서를 그리지 못함: ' + rv.error.message;
        if (rv.hasButton('CANCEL', 'S03')) return '④ 승인 뒤에도 결재 문서에 ③ 승인 취소 단추가 그려짐';
        return true;
      },
    },
    {
      name: '⑥ 날인 뒤에는 ②, ④ 승인 취소가 안 됨(2609CL003)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'LEGAL' });
        const { C, U } = env;
        const c = env.contract('2609CL003');
        if (step(c, 'S06').state !== 'DONE') return '2609CL003의 ⑥이 끝난 상태가 아님(시험 전제가 틀림)';
        if (C.canCancel(c, step(c, 'S04'), U('u_legal'))) return '⑥ 날인 뒤 ④ 승인자가 승인을 취소할 수 있음';
        if (C.canCancel(c, step(c, 'S02'), U('u_sadmin'))) return '⑥ 날인 뒤 ② 승인자가 승인을 취소할 수 있음';
        return true;
      },
    },
    {
      name: '해지 기안은 ⑨ 운영 종료 전까지만 ④ 승인 취소, ⑨ 뒤에는 안 됨(2602CL001-T01)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'LEGAL' });
        fixClock(env);
        const { C, U } = env;
        const c = env.contract('2602CL001-T01');
        const legal = U('u_legal');
        if (!C.canCancel(c, step(c, 'S04'), legal)) return '견줌: ⑨ 처리 전인데 ④ 승인을 취소할 수 없음(CTL-44 "⑨ 처리 전까지")';
        if (!C.recordAction(c, step(c, 'S09'), 'APPROVE', '확인: ' + C.opsChecksFor(c).join(', '), U('u_cem'))) return '⑨ 운영 종료가 남지 않음';
        if (C.canCancel(c, step(c, 'S04'), legal)) return '⑨ 운영 종료 뒤에도 ④ 승인을 취소할 수 있음';
        return true;
      },
    },
    {
      name: '운영 변경과 조건 그대로 연장도 ⑨ 처리 전까지만 승인 취소, ⑨ 뒤에는 안 됨(2604CL001-C01 ③, 2512CL001-R01 ④)',
      kind: 'deny',
      run(h) {
        // 01 REQ-DOC-06(v0.58 QA): 날인과 체결본이 없는 결재(해지, 조건 그대로 연장, 운영 변경)는 ⑨가 처리하기 전이면 운영 검토 중에도 취소
        const env = h.fresh({ role: 'HEAD' });
        fixClock(env);
        const { D, C, U } = env;
        const cases = [['2604CL001-C01', 'S03', 'u_head', '확인: ' + D.INTEREST_CHECK, { noInterest: true }], ['2512CL001-R01', 'S04', 'u_legal', '조건 그대로 연장 확인', {}]];
        for (const [id, code, who, memo, extra] of cases) {
          const c = env.contract(id), me = U(who);
          if (!step(c, code) || step(c, code).state !== 'PENDING' || step(c, code).userId !== who) return id + ' ' + code + '가 ' + who + '의 차례가 아님(시험 전제가 틀림)';
          if (!C.recordAction(c, step(c, code), 'APPROVE', memo, me, extra)) return id + ' ' + code + ' 승인이 남지 않음';
          const s9 = step(c, 'S09');
          if (c.status !== 'OPS_REVIEW' || s9.state !== 'PENDING') return id + ' 마지막 검토 승인 뒤 ⑨ 차례(운영 검토)가 아님: ' + c.status + ' ' + s9.state;
          if (!C.canCancel(c, step(c, code), me)) return id + ' ⑨ 처리 전인데 ' + code + ' 승인자가 승인을 취소할 수 없음(REQ-DOC-06)';
          if (!C.recordAction(c, s9, 'APPROVE', '확인: ' + C.opsChecksFor(c).join(', '), U(s9.userId))) return id + ' ⑨ 처리가 남지 않음';
          if (C.canCancel(c, step(c, code), me)) return id + ' ⑨ 처리 뒤에도 ' + code + ' 승인을 취소할 수 있음';
        }
        return true;
      },
    },
    {
      name: '승인한 사람이 아닌 같은 분야 담당자, 분야 리더, 관리자는 승인을 취소하지 못함(2610CL006 ②)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'ADMIN' });
        const { C, U } = env;
        const c = env.contract('2610CL006');
        const s2 = step(c, 'S02');
        if (s2.decidedBy !== 'u_sadmin') return '② 승인자가 배수아가 아님(시험 전제가 틀림)';
        if (!C.canCancel(c, s2, U('u_sadmin'))) return '견줌: 승인한 배수아도 취소할 수 없음';
        for (const id of ['u_dain_seok', 'u_jihoon_eom', 'u_admin']) {
          if (C.canCancel(c, s2, U(id))) return U(id).role + '(' + id + ')가 남의 ② 승인을 취소할 수 있음';
        }
        return true;
      },
    },
    {
      name: '⑥~⑩ 단계에는 승인 취소가 없음(2609CL001의 ⑥⑦⑧⑨, 처리한 사람과 최고관리자 모두)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SUPER' });
        const { C, U } = env;
        const c = env.contract('2609CL001');
        for (const code of ['S06', 'S07', 'S08', 'S09']) {
          const s = step(c, code);
          if (!s || s.state !== 'DONE') return '2609CL001의 ' + code + '가 끝난 상태가 아님(시험 전제가 틀림)';
          if (C.canCancel(c, s, U(s.decidedBy))) return code + '를 처리한 사람이 승인을 취소할 수 있음';
          if (C.canCancel(c, s, U('u_super'))) return code + ' 승인을 최고관리자가 취소할 수 있음';
        }
        // ⑩ 재무 확인도 승인 취소 없음(2609CL010, 계약 완료)
        const c10 = env.contract('2609CL010'), s10 = step(c10, 'S10');
        if (!s10 || s10.state !== 'DONE') return '2609CL010의 ⑩이 끝난 상태가 아님(시험 전제가 틀림)';
        if (C.canCancel(c10, s10, U(s10.decidedBy)) || C.canCancel(c10, s10, U('u_super'))) return '⑩ 재무 확인을 취소할 수 있음';
        return true;
      },
    },
    {
      name: '반려는 ②~⑥과 ⑧에만 있고 ⑦, ⑨, ⑩에는 반려 단추가 없음(결재 문서의 처리 막대)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SUPER' });
        const pg = reviewActions(env, env.contract('2609CL001'));
        const has = code => (pg.actionsOf(code) || []).indexOf('REJECT') > -1;
        const missing = ['S02', 'S03', 'S03C', 'S04', 'S05', 'S06', 'S08'].filter(x => !has(x));
        if (missing.length) return '반려가 있어야 할 단계에 반려가 없음: ' + missing.join(', ');
        const extra = ['S07', 'S09', 'S10'].filter(has);
        if (extra.length) return '반려가 없어야 할 단계에 반려 단추가 있음: ' + extra.join(', ');
        // 그 차례의 담당자로 결재 문서를 그려 봄(lib.js의 review 도우미): ⑥, ⑧은 반려 단추가 있고 ⑦, ⑨, ⑩은 없음
        let review = null;
        try { review = require('./lib').review; } catch (e) { return '결재 문서 도우미(lib.js review)를 불러오지 못함'; }
        const cases = [['2610CL004', 'S06', 'u_ga', true], ['2609CL003', 'S08', 'u_sadmin', true],
          ['2609CL011', 'S07', 'u_sales1', false], ['2609CL004', 'S09', 'u_cem', false], ['2609CL001', 'S10', 'u_finance', false]];
        for (const [id, code, who, want] of cases) {
          const c = env.contract(id), s = step(c, code);
          if (!s || s.state !== 'PENDING' || s.userId !== who) return id + ' ' + code + '가 ' + who + '의 차례가 아님(시험 전제가 틀림)';
          const rv = review(env, id, who);
          if (rv.error) return id + ' 결재 문서를 그리지 못함: ' + rv.error.message;
          const main = code === 'S07' ? 'REGISTER' : 'APPROVE';
          if (!rv.hasButton(main, code)) return id + ' ' + code + ' 담당자에게 처리 단추가 없음(시험 전제가 틀림)';
          if (rv.hasButton('REJECT', code) !== want) return id + ' ' + code + ' 결재 문서에 반려 단추가 ' + (want ? '없음' : '있음');
        }
        return true;
      },
    },
    {
      name: '승인 취소 창은 취소 사유를 꼭 받음(빈칸이나 공백만이면 처리하지 않음)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'HEAD' });
        fixClock(env);
        const { D, C, U } = env;
        const t = reviewActions(env, env.contract('2601CL001-A01')).modalText('CANCEL', 'S03');
        if (!t || t.required !== true) return '승인 취소 창의 사유가 필수가 아님';
        if (!/취소 사유/.test(t.label || '')) return '승인 취소 창의 칸 이름이 취소 사유가 아님: ' + t.label;
        // 결재 문서를 그려 승인 취소 창에서 사유를 비우거나 공백만 넣고 확인을 눌러 봄(lib.js의 review 도우미)
        let review = null;
        try { review = require('./lib').review; } catch (e) { return '결재 문서 도우미(lib.js review)를 불러오지 못함'; }
        const c = env.contract('2601CL001-A01');
        const ko = U('u_eunseong_ko');
        if (!C.recordAction(c, step(c, 'S03'), 'APPROVE', CHECK3(D).comment, ko, CHECK3(D).extra)) return '③ 승인이 남지 않음';
        const rv = review(env, '2601CL001-A01', ko);
        if (rv.error) return '결재 문서를 그리지 못함: ' + rv.error.message;
        if (!rv.hasButton('CANCEL', 'S03')) return '③ 승인자에게 승인 취소 단추가 없음(시험 전제가 틀림)';
        const n = c.history.length;
        for (const memo of ['', '   ']) {
          rv.open('CANCEL', 'S03').comment(memo).confirm();
          if (c.history.length !== n) return '취소 사유 "' + memo + '"로 승인 취소가 남음';
          if (step(c, 'S03').state !== 'DONE') return '취소 사유 없이 ③이 다시 차례가 됨';
        }
        rv.comment('할인 조건을 다시 확인해야 해서 취소').confirm();
        if (c.history.length !== n + 1 || c.history[n].action !== 'CANCEL') return '견줌: 사유를 적어도 승인 취소가 남지 않음';
        return true;
      },
    },
    {
      name: '승인을 취소해도 처음 승인 줄은 지워지지 않음(2601CL001-A01, 저장된 시연 기록 포함)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'HEAD' });
        fixClock(env);
        const { D, C, U } = env;
        const c = env.contract('2601CL001-A01');
        const ko = U('u_eunseong_ko');
        const a = C.recordAction(c, step(c, 'S03'), 'APPROVE', CHECK3(D).comment, ko, CHECK3(D).extra);
        const snap = JSON.stringify(a);
        if (!C.recordAction(c, step(c, 'S03'), 'CANCEL', '다시 확인', ko)) return '승인 취소가 남지 않음';
        const still = c.history.find(y => y.step === 'S03' && y.action === 'APPROVE' && y.at === a.at);
        if (!still || JSON.stringify(still) !== snap) return '취소 뒤 처음 승인 줄이 지워지거나 바뀜';
        const saved = JSON.parse(env.store['climb.demoActions'] || '[]').filter(y => y.contractId === c.id && y.step === 'S03');
        if (saved.map(y => y.action).join(',') !== 'APPROVE,CANCEL') return '저장된 기록이 승인과 취소 두 줄이 아님: ' + saved.map(y => y.action).join(',');
        // 예시 데이터의 앞선 승인 취소(2601CL001-A01 ②)도 승인 줄이 남아 있음
        const s2lines = c.history.filter(y => y.step === 'S02').map(y => y.action).join(',');
        if (s2lines !== 'APPROVE,CANCEL,APPROVE') return '예시 ② 기록이 승인, 취소, 승인 세 줄이 아님: ' + s2lines;
        return true;
      },
    },
  ],
  serverOnly: [
    '승인한 사람이 아닌 최고관리자의 승인 취소(시안 시연): 실제 시스템에는 없어야 함',
    '⑥~⑩ 승인 취소, ⑦, ⑨, ⑩ 반려, 사유 빈칸, 다음 단계가 처리한 뒤의 취소를 요청으로 직접 보냄: 서버가 결재 기록으로 다시 확인해 거부(시안 recordAction은 다시 검사하지 않음)',
    '취소와 다음 단계 처리가 동시에 옴: 서버가 하나만 받음',
  ],
};
