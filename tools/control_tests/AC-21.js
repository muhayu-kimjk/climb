// AC-21 첨부 판과 지문 (CTL-37) 시험 (2026-11-13 주말 점검 W2)
//   06 통제 목록 2장 AC-21의 기대 동작: 계약서 초안, 조항 대비표, 체결본을 올릴 때마다 새 판 번호와 지문을 붙여 저장하고 고치거나 지우는 길은 없다.
//   ②~⑤가 끝난 판에 "결재한 판", ⑧에서 확인한 체결본에 "확인한 체결본"이 붙고, 결재 기록마다 결재자가 그때 본 판이 남는다.
//   시안의 판과 지문은 결재 문서(review.js)의 draftVersions, files, versionAt이 결재 기록으로 셈함. review.js는 화면을 그리며 시작해
//   이 틀에 통째로 올릴 수 없으므로, 그 함수들과 한 줄짜리 상수만 글자 그대로 떼어 와 가짜 브라우저 안에서 다시 만들어 부름(시안 코드는 고치지 않음)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const REVIEW_JS = path.join(__dirname, '..', '..', 'prototype', 'assets', 'js', 'review.js');

// review.js에서 2칸 들여쓴 함수(이름)와 한 줄 상수(이름)를 떼어 옴
function pieces() {
  const L = fs.readFileSync(REVIEW_JS, 'utf8').split(/\r?\n/);
  const bal = s => (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length;
  return {
    fn(name) {
      const i = L.findIndex(l => l.startsWith('  function ' + name + '('));
      if (i < 0) throw new Error('review.js에서 함수 ' + name + '을 찾지 못함');
      if (bal(L[i]) === 0) return L[i];
      const j = L.findIndex((l, k) => k > i && l === '  }');
      return L.slice(i, j + 1).join('\n');
    },
    k(name) {
      const l = L.find(x => x.startsWith('  const ' + name + ' = '));
      if (!l) throw new Error('review.js에서 상수 ' + name + '을 찾지 못함');
      return l;
    },
  };
}
// 결재 문서를 그 계약으로 연 것처럼: 판 목록(draftVersions), 첨부(files), 그 시각에 본 판(versionAt)
function reviewPage(env, c) {
  const p = pieces();
  const src = '(function (c) {\nconst D = window.CLIMB_DATA, C = window.CLIMB;\n' +
    ['short', 'change', 'legalNote', 'quote', 'rootId', 'seq', 'PASSED'].map(p.k).join('\n') + '\n' +
    ['fingerprint', 'draftVersions', 'markApproved', 'signedVersions', 'files', 'versionAt'].map(p.fn).join('\n') +
    '\nreturn { files: files, versionAt: versionAt, draftVersions: draftVersions };\n})';
  return vm.runInContext(src, env.ctx, { filename: 'review.js(떼어 옴)' })(c);
}
// 결재 기록 일시를 1분씩 늘려 정해 둠(시험을 돌리는 시각과 상관없이 같은 순서)
function fixClock(env) {
  const Base = env.ctx.Date;
  let n = 0;
  env.ctx.Date = class extends Base { constructor(...a) { if (a.length) super(...a); else super(2026, 9, 19, 20, n++, 0); } };
}
const step = (c, code) => (c.approvals || []).find(a => a.step === code);
const HEX8 = /^[0-9A-F]{8}$/;
const draftOf = page => (page.files().find(g => g.kind === 'DRAFT_DOC') || { versions: [] }).versions;
// 결재 문서를 그 사람으로 그려(lib.js의 review 도우미) 첨부(#files)와 결재 기록 표(#history)의 글을 봄
const text = s => String(s || '').replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
function screenOf(env, id, who) {
  let review = null;
  try { review = require('./lib').review; } catch (e) { return { why: '결재 문서 도우미(lib.js review)를 불러오지 못함' }; }
  const rv = review(env, id, who);
  if (rv.error) return { why: id + ' 결재 문서를 그리지 못함: ' + rv.error.message };
  return { files: text(rv.dom.q('#files').innerHTML), history: text(rv.dom.q('#history').innerHTML) };
}

// 2610CL006: ③이 보완을 요청하고 기안자가 보완을 마친 뒤 ③이 승인(계약 검토 끝)
function flow006(env) {
  const { C, U } = env;
  const c = env.contract('2610CL006');
  const head = U('u_head'), rep = U('u_sales1');
  const sup = C.recordAction(c, step(c, 'S03'), 'SUPPLEMENT', '보완할 항목: 계약서 내용. 계약서 초안의 기관 이름 오타', head, { supplementItems: ['DOC'] });
  const res = C.recordAction(c, { step: 'S01', userId: C.repActorOf(c) }, 'RESUBMIT', '기관 이름을 고친 계약서 초안을 다시 올림', rep);
  const ok3 = C.recordAction(c, step(c, 'S03'), 'APPROVE', '확인: ' + env.D.INTEREST_CHECK, head, { noInterest: true });
  return { c, sup, res, ok3 };
}

module.exports = {
  ac: 'AC-21',
  title: '첨부 판과 지문',
  tests: [
    {
      name: '② 승인 기록이 본 판은 계약서 초안 판 1과 지문, 보완 완료로 다시 올리면 판 2가 생기고 판 1은 그대로(2610CL006)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'HEAD' });
        fixClock(env);
        const c = env.contract('2610CL006');
        const h02 = c.history.find(x => x.step === 'S02' && x.action === 'APPROVE');
        if (!h02) return '2610CL006의 ② 승인 기록이 없음';
        const p0 = reviewPage(env, c);
        const before = draftOf(p0);
        if (before.length !== 1 || before[0].no !== 1) return '1차 기안의 계약서 초안이 판 1 하나가 아님: ' + before.map(v => v.no).join(',');
        const seen0 = p0.versionAt('DRAFT_DOC', h02.at);
        if (!seen0 || seen0.no !== 1 || !HEX8.test(seen0.hash || '')) return '② 승인 기록이 본 판이 판 1과 지문이 아님: ' + JSON.stringify(seen0 && { no: seen0.no, hash: seen0.hash });
        const f = flow006(env);
        if (!f.sup || !f.res || !f.ok3) return '보완 요청, 보완 완료, ③ 승인 가운데 남지 않은 기록이 있음';
        const p1 = reviewPage(env, c);
        const after = draftOf(p1);
        if (after.length !== 2 || after[1].no !== 2) return '보완 완료 뒤 판 2가 생기지 않음: ' + after.map(v => v.no).join(',');
        const v1 = after[0];
        if (v1.no !== 1 || v1.at !== before[0].at || v1.hash !== before[0].hash || v1.name !== before[0].name) return '판 1의 이름, 올린 일시, 지문이 바뀜';
        const seen02 = p1.versionAt('DRAFT_DOC', h02.at);
        if (!seen02 || seen02.no !== 1 || seen02.hash !== seen0.hash) return '보완 뒤 ② 승인 기록이 본 판이 판 1에서 바뀜: ' + (seen02 && seen02.no);
        const seen03 = p1.versionAt('DRAFT_DOC', f.ok3.at);
        if (!seen03 || seen03.no !== 2 || !HEX8.test(seen03.hash || '')) return '보완 뒤 ③ 승인 기록이 본 판이 판 2가 아님: ' + (seen03 && seen03.no);
        // 결재 문서의 결재 기록 표에도 줄마다 본 판과 지문이 보임
        const sc = screenOf(env, '2610CL006', 'u_head');
        if (sc.why) return sc.why;
        if (sc.history.indexOf('본 판: 계약서 초안 판 1(지문 ' + seen0.hash + ')') < 0) return '결재 기록 표의 ② 승인 줄에 본 판(판 1과 지문)이 보이지 않음';
        if (sc.history.indexOf('본 판: 계약서 초안 판 2(지문 ' + seen03.hash + ')') < 0) return '결재 기록 표의 ③ 승인 줄에 본 판(판 2와 지문)이 보이지 않음';
        if (sc.files.indexOf('지문 ' + v1.hash) < 0 || sc.files.indexOf('지문 ' + seen03.hash) < 0) return '첨부 묶음에 판 1과 판 2가 지문과 함께 모두 보이지 않음';
        return true;
      },
    },
    {
      name: '②~⑤가 끝난 판에 "결재한 판" 표시(2610CL006 보완 뒤 ③ 승인, 판 2만)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'HEAD' });
        fixClock(env);
        const f = flow006(env);
        if (f.c.status !== 'APPROVED') return '③ 승인 뒤 계약 검토가 끝나지 않음: ' + f.c.status;
        const dv = reviewPage(env, f.c).draftVersions();
        const marked = dv.filter(v => v.approved).map(v => v.no);
        if (marked.length !== 1 || marked[0] !== 2) return '결재한 판 표시가 판 2 하나가 아님: [' + marked.join(',') + ']';
        const sc = screenOf(env, '2610CL006', 'u_head');
        if (sc.why) return sc.why;
        if (sc.files.indexOf('계약서 초안 판 2 결재한 판') < 0) return '결재 문서 첨부에 "계약서 초안 판 2 결재한 판"이 보이지 않음';
        if (sc.files.indexOf('판 1 결재한 판') > -1) return '결재 문서 첨부에서 판 1에도 결재한 판이 붙음';
        return true;
      },
    },
    {
      name: '⑧에서 확인한 체결본에 "확인한 체결본" 표시, 앞서 다시 등록 요청을 받은 판은 그대로(2609CL003)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES_ADMIN' });
        fixClock(env);
        const { C, U } = env;
        const c = env.contract('2609CL003');
        const before = C.signedVersions(c);
        if (before.length !== 2) return '2609CL003의 체결본 판이 2개가 아님: ' + before.length;
        const e = C.recordAction(c, step(c, 'S08'), 'APPROVE', '확인: ' + C.signedChecks(c).join(', '), U('u_sadmin'));
        if (!e) return '⑧ 확인 완료 기록이 남지 않음';
        const sv = C.signedVersions(c);
        if (sv.length !== 2) return '확인 뒤 판 수가 바뀜: ' + sv.length;
        if (!sv[1].checked || !sv[1].current) return '확인한 판 2에 확인한 체결본 표시가 없음';
        if (sv[0].checked || sv[0].fate !== 'RETURN' || sv[0].name !== before[0].name || sv[0].at !== before[0].at) return '다시 등록 요청을 받은 판 1이 바뀌거나 확인한 체결본으로 표시됨';
        const grp = reviewPage(env, c).files().find(g => g.kind === 'SIGNED');
        if (!grp || grp.versions.some(v => !HEX8.test(v.hash || ''))) return '체결본 판에 지문이 없음';
        const sc = screenOf(env, '2609CL003', 'u_sadmin');
        if (sc.why) return sc.why;
        if (sc.files.indexOf('체결본 판 2 확인한 체결본') < 0) return '결재 문서 첨부에 "체결본 판 2 확인한 체결본"이 보이지 않음';
        if (sc.files.indexOf('체결본 판 1 확인한 체결본') > -1) return '다시 등록 요청을 받은 판 1에도 확인한 체결본이 붙음';
        if (sc.history.indexOf('본 판: 체결본 판 2(지문 ' + grp.versions.find(v => v.no === 2).hash + ')') < 0) return '⑧ 확인 완료 기록에 본 판(체결본 판 2와 지문)이 보이지 않음';
        return true;
      },
    },
    {
      name: '조항 대비표도 보완 완료로 다시 올리면 새 판(판 2), 판 1과 지문은 그대로(2610CL003, 표준계약서를 바꾼 계약)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'LEGAL' });
        fixClock(env);
        const { C, U } = env;
        const c = env.contract('2610CL003');
        const diffOf = () => (reviewPage(env, c).files().find(g => g.kind === 'CLAUSE_DIFF') || { versions: [] }).versions.map(v => ({ no: v.no, at: v.at, hash: v.hash }));
        const before = diffOf();
        if (before.length !== 1 || before[0].no !== 1 || !HEX8.test(before[0].hash || '')) return '1차 기안의 조항 대비표가 판 1(지문 있음) 하나가 아님: ' + JSON.stringify(before);
        if (!C.recordAction(c, step(c, 'S04'), 'SUPPLEMENT', '보완할 항목: 첨부 파일. 조항 대비표 판이 다름', U('u_legal'), { supplementItems: ['ATTACH'] })) return '④ 보완 요청이 남지 않음';
        if (!C.recordAction(c, { step: 'S01', userId: C.repActorOf(c) }, 'RESUBMIT', '조항 대비표를 다시 올림', U('u_sales2'))) return '보완 완료가 남지 않음';
        const after = diffOf();
        if (after.length !== 2 || after.map(v => v.no).join(',') !== '1,2') return '보완 완료 뒤 조항 대비표 판이 1, 2가 아님: ' + after.map(v => v.no).join(',');
        if (JSON.stringify(after[0]) !== JSON.stringify(before[0])) return '조항 대비표 판 1의 일시나 지문이 바뀜';
        if (!HEX8.test(after[1].hash || '') || after[1].hash === after[0].hash) return '조항 대비표 판 2의 지문이 없거나 판 1과 같음';
        return true;
      },
    },
    {
      name: '체결본을 다시 올리면 같은 판 번호가 아니라 새 판 번호(2609CL003 다시 등록 요청 뒤)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        fixClock(env);
        const { C, U } = env;
        const c = env.contract('2609CL003');
        const before = C.signedVersions(c).map(v => ({ no: v.no, name: v.name, at: v.at }));
        if (!C.recordAction(c, step(c, 'S08'), 'RETURN', '스캔이 흐려 다시 올려 주세요', U('u_sadmin'))) return '다시 등록 요청이 남지 않음';
        if (!C.recordAction(c, step(c, 'S07'), 'REGISTER', '확인: ' + env.D.SIDE_DEAL_CHECK.S07, U('u_sales1'), { fileName: c.counterparty + '_체결본_3.pdf', signDate: '2026-10-07' })) return '체결본 다시 등록이 남지 않음';
        const sv = C.signedVersions(c);
        const nos = sv.map(v => v.no);
        if (sv.length !== 3 || nos.join(',') !== '1,2,3') return '판 번호가 1,2,3으로 늘지 않음: ' + nos.join(',');
        const changed = before.filter((b, i) => sv[i].no !== b.no || sv[i].name !== b.name || sv[i].at !== b.at);
        if (changed.length) return '앞 판의 번호, 이름, 올린 일시가 바뀜: ' + changed.map(b => b.no).join(',');
        if (!sv[2].current || sv[0].current || sv[1].current) return '지금 판 표시가 새 판 하나가 아님';
        return true;
      },
    },
    {
      name: '계약서 초안을 다시 올려도 앞 판이 지워지거나 바뀌지 않음(2610CL006 보완 두 번, 지문 그대로)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'HEAD' });
        fixClock(env);
        const { C, U } = env;
        const c = env.contract('2610CL006');
        const head = U('u_head'), rep = U('u_sales1');
        const snap = () => draftOf(reviewPage(env, c)).map(v => v.no + '|' + v.name + '|' + v.at + '|' + v.hash);
        const s1 = snap();
        for (let i = 0; i < 2; i++) {
          if (!C.recordAction(c, step(c, 'S03'), 'SUPPLEMENT', '보완할 항목: 첨부 파일. ' + (i + 1) + '번째', head, { supplementItems: ['ATTACH'] })) return '보완 요청이 남지 않음';
          if (!C.recordAction(c, { step: 'S01', userId: C.repActorOf(c) }, 'RESUBMIT', '첨부를 다시 올림', rep)) return '보완 완료가 남지 않음';
        }
        const s2 = snap();
        if (s2.length !== 3) return '보완 두 번 뒤 계약서 초안 판이 3개가 아님: ' + s2.length;
        if (s2[0] !== s1[0]) return '판 1의 이름, 일시, 지문이 바뀜: ' + s1[0] + ' → ' + s2[0];
        const nos = s2.map(x => x.split('|')[0]);
        if (nos.join(',') !== '1,2,3') return '판 번호가 겹치거나 건너뜀: ' + nos.join(',');
        return true;
      },
    },
    {
      name: '예시 계약의 ②~⑤ 승인 기록마다 결재자가 본 판이 비지 않음(결재 문서의 결재 기록 표)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SUPER' });
        const { D, C } = env;
        const miss = [];
        let n = 0; // 살펴본 승인 기록 수(2026-11-13 보강: 0이면 아무것도 보지 않고 통과하므로 실패로 봄)
        D.CONTRACTS.forEach(c => {
          if (!c.id || c.legacy || c.status === 'DRAFT' || C.isShort(c) || C.isChange(c)) return;
          const page = reviewPage(env, c);
          const kind = page.files().some(g => g.kind === 'DRAFT_DOC') ? 'DRAFT_DOC' : 'QUOTE';
          (c.history || []).forEach(x => {
            if (!C.isReviewStep(x.step) || x.action !== 'APPROVE') return;
            n++;
            if (!page.versionAt(kind, x.at)) miss.push(c.id + ' ' + x.step + ' ' + x.at);
          });
        });
        if (!n) return '살펴볼 ②~⑤ 승인 기록이 예시 데이터에 없음(아무것도 보지 않고 통과할 수 없음)';
        if (miss.length) return '본 판이 비는 승인 기록(' + n + '건 중): ' + miss.slice(0, 6).join('; ') + (miss.length > 6 ? ' 외 ' + (miss.length - 6) + '건' : '');
        return true;
      },
    },
  ],
  serverOnly: [
    '이미 올린 판을 같은 판 번호로 다시 올리는 요청: 서버 거절(시안은 올리는 판 번호를 받지 않고 결재 기록으로 차례로 셈)',
    '첨부 판을 지우거나 파일을 바꾸는 요청: 서버 거절(시안에는 지우거나 바꾸는 기능이 없음)',
    '저장된 파일의 지문을 다시 계산했을 때 기록과 다르면 예외로 남김: 서버 몫(시안 지문은 파일 이름과 올린 시각으로 만든 가짜 값)',
    '②~⑤ 승인 요청에 본 판 번호가 비어 있으면 거절: 서버 몫(시안은 결재 기록에 본 판을 저장하지 않고 결재 문서를 그릴 때 그 시각의 판을 셈)',
  ],
};
