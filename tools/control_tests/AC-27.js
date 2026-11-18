// AC-27 반려와 재기안 (CTL-45) 시험 (2026-11-13 주말 점검 W2)
//   06 통제 목록 2장 AC-27의 기대 동작: 새 차수의 결재 상태는 그 차수의 기록만으로 정해지고, 번호는 그대로이며 차수는 하나씩 는다.
//   CTL-45: 어느 단계에서 반려해도(사유 필수) 기안자에게 돌아가고, 다시 올리면 같은 번호의 다음 차수로 결재선을 처음부터 거치며 앞 차수 기록은 그대로.
//   시안: common.js buildReview, canResubmit, resubmitSource(다시 기안할 기록 찾기), resubmitRecord(다음 차수 기록), saveDemoContract(저장).
//   반려 창의 사유 필수는 결재 문서(review.js) modalText라, 그 함수와 한 줄 상수만 글자 그대로 떼어 와 부름(시안 코드는 고치지 않음)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const REVIEW_JS = path.join(__dirname, '..', '..', 'prototype', 'assets', 'js', 'review.js');

function modalTextOf(env, c) {
  const L = fs.readFileSync(REVIEW_JS, 'utf8').split(/\r?\n/);
  const i = L.findIndex(l => l.startsWith('  function modalText('));
  if (i < 0) throw new Error('review.js에서 함수 modalText를 찾지 못함');
  const body = L.slice(i, L.findIndex((l, k) => k > i && l === '  }') + 1).join('\n');
  const k = name => { const l = L.find(x => x.startsWith('  const ' + name + ' = ')); if (!l) throw new Error('review.js에서 상수 ' + name + '을 찾지 못함'); return l; };
  const src = '(function (c) {\nconst D = window.CLIMB_DATA, C = window.CLIMB;\n' + ['quote', 'esign'].map(k).join('\n') + '\n' + body + '\nreturn modalText;\n})';
  return vm.runInContext(src, env.ctx, { filename: 'review.js(떼어 옴)' })(c);
}
function fixClock(env) {
  const Base = env.ctx.Date;
  let n = 0;
  env.ctx.Date = class extends Base { constructor(...a) { if (a.length) super(...a); else super(2026, 9, 19, 20, n++, 0); } };
}
const step = (c, code) => (c.approvals || []).find(a => a.step === code);
const fitsNew = c => c.kind === 'NEW' || c.kind === 'AMEND' || (c.kind === 'RENEW' && c.renewMode !== 'AUTO'); // 계약 등록 화면이 맡는 종류

// 2610CL003(②③⑤ 승인, ④ 차례)을 ④가 반려하고 기안자 정하은이 2차로 다시 기안
function rejectAndResubmit(env) {
  const { C, U } = env;
  const c = env.contract('2610CL003');
  const rej = C.recordAction(c, step(c, 'S04'), 'REJECT', '연구기관 보안 서약 조항이 회사 책임을 넓힘. 조항을 고쳐 다시 올려 주세요', U('u_legal'));
  const rep = U('u_sales2');
  const src = C.resubmitSource('2610CL003', rep, fitsNew);
  const rec = src ? C.resubmitRecord(src, {}) : null;
  if (rec) C.saveDemoContract(rec);
  return { c, rej, src, rec };
}

module.exports = {
  ac: 'AC-27',
  title: '반려와 재기안',
  tests: [
    {
      name: '1차가 ④에서 반려되고 2차로 기안하면 ②부터 다시 차례, 1차 승인은 기록에 남되 2차 결재에 쓰이지 않음(2610CL003)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        fixClock(env);
        const r = rejectAndResubmit(env);
        if (!r.rej) return '④ 반려가 남지 않음';
        if (!r.src) return '반려 뒤 기안자 정하은이 다시 기안할 수 없음(상태 ' + r.c.status + ')';
        // 기안하면 결재 문서로 넘어가므로, 같은 저장소로 다시 연 화면에서 봄(시연으로 남긴 결재 기록은 화면을 열 때 다시 붙음)
        const env2 = h.fresh({ role: 'SALES', store: env.store });
        const c2 = env2.contract('2610CL003');
        if (!c2 || c2.round !== 2 || c2.status !== 'IN_REVIEW') return '2차 기안이 검토 중이 아님: ' + (c2 && c2.round + '차 ' + c2.status);
        const st = ['S02', 'S03', 'S04', 'S05'].map(x => x + ':' + (step(c2, x) || {}).state).join(',');
        if (st !== 'S02:PENDING,S03:WAITING,S04:WAITING,S05:WAITING') return '2차가 ②부터 다시 시작하지 않음: ' + st;
        const r1 = c2.history.filter(x => (x.round || 1) === 1).map(x => x.step + ' ' + x.action);
        for (const want of ['S02 APPROVE', 'S03 APPROVE', 'S05 APPROVE', 'S04 REJECT', 'S01 SUBMIT']) {
          if (r1.indexOf(want) < 0) return '1차 기록에 ' + want + '이 남지 않음: ' + r1.join(', ');
        }
        if (step(c2, 'S02').decidedBy || step(c2, 'S03').decidedBy || step(c2, 'S05').decidedBy) return '1차 승인이 2차 결재란에 쓰임';
        return true;
      },
    },
    {
      name: '반려 뒤에는 동시 차례였던 ⑤도 승인하지 못함(2610CL005 ④ 반려)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'PRIVACY' });
        fixClock(env);
        const { C, U } = env;
        const c = env.contract('2610CL005');
        if (step(c, 'S04').state !== 'PENDING' || step(c, 'S05').state !== 'PENDING') return '2610CL005가 ④⑤ 동시 차례가 아님(시험 전제가 틀림)';
        let review = null;
        try { review = require('./lib').review; } catch (e) { return '결재 문서 도우미(lib.js review)를 불러오지 못함'; }
        if (!review(env, '2610CL005', 'u_privacy').hasButton('APPROVE', 'S05')) return '견줌: 반려 전에도 정보보호 담당자에게 ⑤ 승인 단추가 없음(시험 전제가 틀림)';
        if (!C.recordAction(c, step(c, 'S04'), 'REJECT', '지식재산권 조항 수정 범위가 넓음', U('u_legal'))) return '④ 반려가 남지 않음';
        if (c.status !== 'REJECTED') return '반려 뒤 상태가 반려가 아님: ' + c.status;
        const s5 = step(c, 'S05');
        if (s5.state === 'PENDING') return '반려 뒤에도 ⑤가 차례로 남음';
        if (C.canAct(c, s5, U('u_privacy'))) return '반려 뒤 정보보호 담당자가 ⑤를 처리할 수 있음';
        if (C.canAct(c, s5, U('u_super'))) return '반려 뒤 최고관리자 시연으로도 ⑤를 처리할 수 있음';
        // 정보보호 담당자로 결재 문서를 그려도 ⑤ 승인 단추가 없음(lib.js의 review 도우미)
        const rv =review(env, '2610CL005', 'u_privacy');
        if (rv.error) return '결재 문서를 그리지 못함: ' + rv.error.message;
        if (/data-open="(APPROVE|REJECT|SUPPLEMENT)" data-step="S05"/.test(rv.bar())) return '반려 뒤에도 정보보호 담당자의 결재 문서에 ⑤ 처리 단추가 그려짐';
        return true;
      },
    },
    {
      name: '기안자(지금 영업대표)가 아닌 사람은 반려된 계약을 다시 기안하지 못함(2610CL001)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const { C, U } = env;
        const c = env.contract('2610CL001');
        if (c.status !== 'REJECTED' || c.requesterId !== 'u_sales1') return '2610CL001이 이도윤의 반려 계약이 아님(시험 전제가 틀림)';
        if (C.resubmitSource('2610CL001', U('u_sales1'), fitsNew) !== c) return '견줌: 기안자 이도윤도 다시 기안할 수 없음';
        for (const id of ['u_sales2', 'u_head', 'u_legal', 'u_sadmin', 'u_admin']) {
          if (C.resubmitSource('2610CL001', U(id), fitsNew)) return U(id).role + '(' + id + ')가 남의 반려 계약을 다시 기안할 수 있음';
        }
        return true;
      },
    },
    {
      name: '재기안은 같은 계약번호의 다음 차수(새 번호 없음, 1차 다음 2차, 2차 다음 3차)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        fixClock(env);
        const { D, C, U } = env;
        const ids0 = D.CONTRACTS.map(x => x.id).filter(Boolean).sort().join(',');
        const r = rejectAndResubmit(env);
        if (!r.rec) return '2차 기안이 만들어지지 않음';
        if (r.rec.id !== '2610CL003' || r.rec.round !== 2) return '재기안이 ' + r.rec.id + ' ' + r.rec.round + '차가 됨';
        // 2차도 ②에서 반려하고 다시 기안
        const c2 = env.contract('2610CL003');
        if (!C.recordAction(c2, step(c2, 'S02'), 'REJECT', '첨부 파일 빠짐', U('u_sadmin'))) return '2차 ② 반려가 남지 않음';
        const src3 = C.resubmitSource('2610CL003', U('u_sales2'), fitsNew);
        if (!src3) return '2차 반려 뒤 다시 기안할 수 없음';
        const rec3 = C.resubmitRecord(src3, {});
        C.saveDemoContract(rec3);
        if (rec3.id !== '2610CL003' || rec3.round !== 3) return '두 번째 재기안이 ' + rec3.id + ' ' + rec3.round + '차가 됨';
        const ids1 = D.CONTRACTS.map(x => x.id).filter(Boolean).sort().join(',');
        if (ids1 !== ids0) return '재기안으로 계약번호 목록이 바뀜(새 번호가 생김)';
        const subs = env.contract('2610CL003').history.filter(x => x.action === 'SUBMIT').map(x => x.round || 1).sort().join(',');
        if (subs !== '1,2') return '앞 차수 기안 기록이 1, 2차로 남지 않음: ' + subs;
        return true;
      },
    },
    {
      name: '같은 번호로 진행 중인 차수가 둘 생기지 않음(재기안 뒤 앞 차수는 다시 기안할 수 없음)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        fixClock(env);
        const { D, C, U } = env;
        const r = rejectAndResubmit(env);
        if (!r.rec) return '2차 기안이 만들어지지 않음';
        const same = D.CONTRACTS.filter(x => x.id === '2610CL003');
        if (same.length !== 1) return '2610CL003 기록이 ' + same.length + '개';
        if (C.canResubmit(same[0], U('u_sales2'))) return '진행 중인 2차를 또 다시 기안할 수 있음';
        if (C.resubmitSource('2610CL003', U('u_sales2'), fitsNew)) return '진행 중인 2차를 다시 기안할 기록으로 찾음';
        const saved = JSON.parse(env.store['climb.demoContracts'] || '[]').filter(x => x.id === '2610CL003');
        if (saved.length !== 1 || saved[0].round !== 2) return '저장된 2610CL003 기록이 2차 하나가 아님: ' + saved.map(x => x.round).join(',');
        return true;
      },
    },
    {
      name: '반려 창은 반려 사유를 꼭 받음(②~⑥, ⑧ 모두)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SUPER' });
        const mt = modalTextOf(env, env.contract('2609CL003'));
        for (const code of ['S02', 'S03', 'S03C', 'S04', 'S05', 'S06', 'S08']) {
          const t = mt('REJECT', code);
          if (!t || t.required !== true || !/반려 사유/.test(t.label || '')) return code + ' 반려 창의 반려 사유가 필수가 아님';
        }
        // 결재 문서를 그려 반려 창에서 사유를 비우거나 공백만 넣고 확인을 눌러 봄(2610CL006 ③, 리더 최민준. lib.js의 review 도우미)
        let review = null;
        try { review = require('./lib').review; } catch (e) { return '결재 문서 도우미(lib.js review)를 불러오지 못함'; }
        fixClock(env);
        const c = env.contract('2610CL006');
        const rv = review(env, '2610CL006', 'u_head');
        if (rv.error) return '결재 문서를 그리지 못함: ' + rv.error.message;
        if (!rv.hasButton('REJECT', 'S03')) return '리더 최민준에게 ③ 반려 단추가 없음(시험 전제가 틀림)';
        const n = c.history.length;
        for (const memo of ['', '   ']) {
          rv.open('REJECT', 'S03').comment(memo).confirm();
          if (c.history.length !== n || c.status === 'REJECTED') return '반려 사유 "' + memo + '"로 반려가 남음';
        }
        rv.comment('할인 사유가 부족함').confirm();
        if (c.history.length !== n + 1 || c.history[n].action !== 'REJECT' || c.status !== 'REJECTED') return '견줌: 사유를 적어도 반려가 남지 않음';
        return true;
      },
    },
  ],
  serverOnly: [
    '반려 사유 빈칸을 요청에 넣어 보냄: 서버 거부(시안 recordAction은 사유를 다시 보지 않음)',
    '기안자가 아닌 사람의 재기안 요청, 최고관리자의 대신 재기안(시안 시연): 실제 시스템은 서버가 지금 영업대표인지 다시 확인',
    '서버가 차수를 하나씩 올리고 같은 번호로 진행 중인 차수가 하나뿐인지 확인(동시 요청 포함): 서버 몫(시안 saveDemoContract는 같은 번호를 바꿔 씀)',
  ],
};
