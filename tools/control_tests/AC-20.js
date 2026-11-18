// AC-20 4번 회계 영향 조건 (CTL-36, CTL-52) 시험 (2026-11-13 주말 점검 W2)
//   06 통제 목록 2장 AC-20의 기대 동작: 4번 예와 비고가 있어야 기안되고, 기안 즉시 재무에 알림이 가며, 재무 역할은 그 열람 제한 계약을 본다.
//   (v0.5) 4번이 예면 종류를 하나 이상 골라야 기안되고, 재무는 ⑥ 날인 전까지 결재선 밖 재무 의견을 덧붙인다.
//   계약 등록 화면(new-contract.js)의 기안 검사는 이 틀로 부를 수 없어 서버 몫으로 적고, common.js의 열람(canView), 재무 의견(canWriteFinOpinion,
//   addFinOpinion), 받을 이메일 설정(mailPrefs)과 코드표를 봄
'use strict';

function fixClock(env) {
  const Base = env.ctx.Date;
  env.ctx.Date = class extends Base { constructor(...a) { if (a.length) super(...a); else super(2026, 9, 19, 23, 30, 0); } };
}
const step = (c, code) => (c.approvals || []).find(a => a.step === code);
const pend = c => (c.approvals || []).filter(a => a.state === 'PENDING').map(a => a.step + ':' + a.userId).join(',');
// 2610CL003(4번 예, 검토 중)을 열람 제한으로 두고 비고를 문서의 예 "3개월 무상 사용"으로
const restrict003 = D => {
  const c = D.CONTRACTS.find(x => x.id === '2610CL003');
  c.restricted = true;
  c.checklist.accounting = 'YES';
  c.checklist.accountingNote = '3개월 무상 사용';
  c.checklist.acctKinds = ['FREE_PERIOD'];
};
// 그 계약들을 4번 예(종류 무상 기간)로 바꾸는 hook(같은 계약으로 견줄 때)
const acctYes = ids => D => ids.forEach(id => {
  const c = D.CONTRACTS.find(x => x.id === id);
  c.checklist = Object.assign({}, c.checklist, { accounting: 'YES', accountingNote: '시험: 3개월 무상 사용', acctKinds: ['FREE_PERIOD'] });
});
// 계약 목록 화면(contracts.js)을 그 사람으로 그려 검색 칸(#f-q)에 q를 넣은 결과. f: { owner, status } 거르기
//   돌려주는 값 { rows: 표의 글, count: "검색 결과 n건"의 n(거르지 않으면 전체 수), why }
function listSearch(h, userId, q, hook, f) {
  f = f || {};
  const { pageAs, strip } = require('./lib');
  const env = h.fresh({ role: 'FIN_LEAD', hook });
  if (!env.ctx.getComputedStyle) env.ctx.getComputedStyle = () => ({ fontSize: '10px', getPropertyValue: () => '' });
  const dom = pageAs(env, 'contracts.js', env.U(userId), '', [['#f-q', { value: q }], ['#f-status', { value: f.status || '' }], ['#f-service', { value: '' }],
    ['#f-owner', { value: f.owner || '' }], ['#f-unit', { value: '' }], ['#f-legacy', { value: '' }], ['#f-ab', { checked: false }]]);
  if (dom.error) return { why: userId + '로 계약 목록 화면을 그리지 못함: ' + dom.error.message };
  const cnt = /(검색 결과|전체) (\d+)건/.exec(strip(dom.q('#list-count').innerHTML));
  if (!cnt) return { why: '계약 목록 화면에 건수가 보이지 않음' };
  return { rows: strip(dom.q('#rows').innerHTML), count: Number(cnt[2]) };
}
// 통계 화면(stats.js)을 그 사람으로 열어 "열람 제한 계약 중 볼 수 없는 n건"의 n(안내가 없으면 0). 오류면 문자열
function statsHidden(h, userId, hook) {
  const { stats } = require('./lib');
  const s = stats(h, userId, hook);
  if (s.dom.error) return userId + '로 통계 화면을 그리지 못함: ' + s.dom.error.message;
  const intro = s.text('#intro-sub');
  if (intro.indexOf('예전 계약 기록도 넣지 않습니다') < 0) return '통계 화면 안내 글(#intro-sub)이 그려지지 않음';
  const m = /볼 수 없는 (\d+)건/.exec(intro);
  return m ? Number(m[1]) : 0;
}
// 계약 등록 화면(new-contract.js)의 validate에서 이름(names)의 칸을 검사하는 줄만 글자 그대로 떼어 와, 넣은 값으로 돌려 오류 난 칸 이름을 돌려줌
//   acctKinds()는 화면에서 표시한 종류 상자의 값(kinds). 시안 코드는 고치지 않음
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const NEW_JS = path.join(__dirname, '..', '..', 'prototype', 'assets', 'js', 'new-contract.js');
function validateRun(env, names, vals, kinds) {
  const L = fs.readFileSync(NEW_JS, 'utf8').split(/\r?\n/);
  const i = L.findIndex(l => l.startsWith('  function validate() {'));
  if (i < 0) return null;
  const j = L.findIndex((l, k) => k > i && l === '  }');
  const lines = L.slice(i, j).filter(l => l.indexOf('need(') > -1 && names.some(n => l.indexOf("'" + n + "', '") > -1)).map(l => l.trim());
  if (lines.length < names.length) return null;
  const src = '(function (vals, kinds) {\nconst errors = [];\nfunction need(cond, name) { if (!cond) errors.push(name); }\n' +
    'function val(n) { return String(vals[n] == null ? \'\' : vals[n]).trim(); }\nfunction acctKinds() { return kinds || []; }\n' +
    lines.join('\n') + '\nreturn errors;\n})';
  return vm.runInContext(src, env.ctx, { filename: 'new-contract.js validate(떼어 옴)' })(vals, kinds);
}
// 계약 등록 화면이 그리는 4번 종류 상자의 값들(#acct-kind-choices를 채우는 줄을 떼어 와 돌림)
function kindChoices(env) {
  const L = fs.readFileSync(NEW_JS, 'utf8').split(/\r?\n/);
  const i = L.findIndex(l => l.indexOf("$('#acct-kind-choices').innerHTML = ") > -1);
  if (i < 0) return null;
  const j = L.findIndex((l, k) => k > i && /^\s*\}\)\.join\(''\);\s*$/.test(l));
  if (j < 0) return null;
  const box = { innerHTML: '' };
  const src = '(function (box) {\nconst D = window.CLIMB_DATA, esc = window.CLIMB.esc;\nconst $ = function () { return box; };\n' + L.slice(i, j + 1).join('\n') + '\n})';
  vm.runInContext(src, env.ctx, { filename: 'new-contract.js 4번 종류(떼어 옴)' })(box);
  const out = [];
  box.innerHTML.replace(/<input type="checkbox" name="acctKinds" value="([^"]*)"/g, (x, v) => { out.push(v); return x; });
  return out;
}

module.exports = {
  ac: 'AC-20',
  title: '4번 회계 영향 조건',
  tests: [
    {
      name: '4번 예인 열람 제한 계약은 재무 담당자, 재무 리더, 재무 임원이 열 수 있고, 같은 계약을 4번 아니요로 바꾸면 결재선 밖 재무는 못 봄(2610CL003을 열람 제한으로)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'FIN_LEAD', hook: restrict003 });
        const { C, U } = env;
        const c = env.contract('2610CL003');
        if (!c.restricted || c.checklist.accounting !== 'YES') return '시험 계약 준비가 안 됨';
        // 2026-11-13 보강(점검 지적): 재무 담당자 오현우(u_finance)는 이 계약의 ⑩ 담당이라 4번 규칙이 없어도 결재선으로 봄.
        //   그래서 4번 규칙(REQ-CHK-08) 때문에 보는지는 결재선에 없는 재무 담당자 표예준(u_yejun_pyo), 재무 리더, 재무 임원으로 보고,
        //   같은 계약을 4번 아니요로만 바꾼 env와 견주어 볼 수 있던 것이 못 보게 바뀌는지 확인함
        const FIN = ['u_yejun_pyo', 'u_seojin_ma', 'u_jaewon_kook'];
        if (c.approvals.some(a => a.state !== 'SKIPPED' && FIN.indexOf(a.userId) > -1)) return '시험 전제: 결재선 밖이어야 할 재무가 2610CL003 결재선에 있음';
        for (const id of ['u_finance'].concat(FIN)) {
          if (!C.canView(c, U(id))) return id + '(' + U(id).role + ')가 4번 예인 열람 제한 계약을 볼 수 없음';
        }
        // 견줌: 재무가 아니고 결재선에도 없는 사람은 못 봄(열람 제한이 실제로 걸렸는지)
        if (C.canView(c, U('u_dain_seok'))) return '재무가 아닌 영업지원 석다인도 열람 제한 계약을 봄(열람 제한이 걸리지 않음)';
        // 같은 계약에서 4번만 아니요로 바꾸면 결재선 밖 재무는 못 봄(위에서 본 것이 4번 규칙 때문이었음). ⑩ 담당 오현우는 결재선으로 계속 봄
        const envNo = h.fresh({ role: 'FIN_LEAD', hook: D => {
          restrict003(D);
          const x = D.CONTRACTS.find(y => y.id === '2610CL003');
          x.checklist.accounting = 'NO'; x.checklist.accountingNote = ''; x.checklist.acctKinds = [];
        } });
        const cNo = envNo.contract('2610CL003');
        for (const id of FIN) {
          if (envNo.C.canView(cNo, envNo.U(id))) return '같은 계약을 4번 아니요로 바꿔도 ' + id + '(' + envNo.U(id).role + ')가 봄(4번 규칙이 아닌 다른 까닭으로 보고 있음)';
        }
        if (!envNo.C.canView(cNo, envNo.U('u_finance'))) return '견줌: ⑩ 담당 재무 담당자 오현우가 결재선으로도 보지 못함';
        // 재무 리더가 결재 문서를 열면 4번 비고와 재무 알림(⑩ 담당 재무 담당자에게 이메일)이 보임(lib.js의 review 도우미로 그림)
        let review = null;
        try { review = require('./lib').review; } catch (e) { return '결재 문서 도우미(lib.js review)를 불러오지 못함'; }
        const rv = review(env, '2610CL003', 'u_seojin_ma');
        if (rv.error) return '재무 리더로 결재 문서를 그리지 못함: ' + rv.error.message;
        const ck = String(rv.dom.q('#checklist').innerHTML).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        if (ck.indexOf('비고: 3개월 무상 사용') < 0) return '재무 리더가 연 결재 문서에 4번 비고가 보이지 않음(열람 제한 안내로 막혔을 수 있음)';
        if (C.stepUserAt('S10', c, c.requestedAt) !== 'u_finance') return '재무 알림을 받을 ⑩ 담당이 재무 담당자 오현우가 아님: ' + C.stepUserAt('S10', c, c.requestedAt);
        if (!/재무 알림: 기안할 때 재무 .*오현우에게 이메일/.test(ck)) return '결재 문서에 기안할 때 재무 담당자에게 이메일로 알렸다는 줄이 없음';
        return true;
      },
    },
    {
      name: '회계 영향 조건 이메일은 재무 담당자가 끌 수 없음',
      kind: 'ok',
      run(h) {
        // 재무 담당자가 받을 이메일 설정에서 회계 영향 조건을 끈 것처럼 저장해 둠
        const env = h.fresh({ role: 'FINANCE', store: { 'climb.demoMail': JSON.stringify({ u_finance: { ACCOUNTING: false } }) } });
        const { D, C } = env;
        const t = (D.EMAIL_TYPES || []).find(x => x.code === 'ACCOUNTING');
        if (!t) return '이메일 종류에 회계 영향 조건(ACCOUNTING)이 없음';
        if (!t.must) return '회계 영향 조건 이메일을 끌 수 있게 되어 있음(must 아님)';
        if (!(t.roles || []).includes('FINANCE')) return '회계 영향 조건 이메일을 재무가 받지 않음: ' + JSON.stringify(t.roles);
        if (C.mailPrefs('u_finance').ACCOUNTING !== true) return '끈 설정이 그대로 적용되어 재무 담당자가 이메일을 받지 않음';
        return true;
      },
    },
    {
      name: '4번 조건의 종류 코드표는 다섯 가지(무상 기간, 무상 추가 제공, 해지 환불권, 사용량이나 성과에 따른 대가, 반품이나 취소)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const got = (env.D.ACCT_KINDS || []).map(x => x.label);
        const want = ['무상 기간', '무상 추가 제공', '해지 환불권', '사용량이나 성과에 따른 대가', '반품이나 취소'];
        if (got.length !== 5 || want.some(w => got.indexOf(w) < 0)) return '종류가 문서와 다름: ' + got.join(', ');
        return true;
      },
    },
    {
      name: '재무는 ⑥ 날인 전(검토 중, 보완 중)에 결재선 밖 재무 의견을 덧붙이고, 결재 차례는 바뀌지 않음(2610CL003)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'FINANCE' });
        fixClock(env);
        const { C, U } = env;
        const c = env.contract('2610CL003');
        const fin = U('u_finance');
        if (c.status !== 'IN_REVIEW') return '시험 전제: 2610CL003이 검토 중이 아님: ' + c.status;
        if (!C.canWriteFinOpinion(c, fin)) return '재무 담당자가 검토 중인 4번 예 계약에 재무 의견을 쓸 수 없음';
        if (!C.canWriteFinOpinion(c, U('u_seojin_ma'))) return '재무 리더가 재무 의견을 쓸 수 없음';
        const before = pend(c), status = c.status, n0 = (c.finOpinions || []).length; // 예시 데이터에 앞서 남긴 의견이 있음
        const e = C.addFinOpinion(c, '무상 기간은 수익을 나눠 인식해야 합니다.', fin);
        if (!e) return '재무 의견이 남지 않음';
        if (e.by !== 'u_finance' || !e.at || e.round !== 1) return '남긴 사람, 일시, 차수가 빠짐: ' + JSON.stringify(e);
        if ((c.finOpinions || []).length !== n0 + 1) return '계약의 재무 의견이 한 건 늘지 않음: ' + n0 + ' → ' + (c.finOpinions || []).length;
        if (pend(c) !== before || c.status !== status) return '재무 의견으로 결재 차례나 상태가 바뀜: ' + before + ' → ' + pend(c);
        // 2026-11-13 보강(점검 지적): CTL-52가 정한 때의 하나인 "보완 중"도 봄. ④ 법무가 보완을 요청한 뒤에도 의견을 덧붙이고 상태는 그대로
        if (!C.recordAction(c, step(c, 'S04'), 'SUPPLEMENT', '보완할 항목: 첨부 파일. 시험', U('u_legal'), { supplementItems: ['ATTACH'] })) return '④ 보완 요청이 남지 않음';
        if (c.status !== 'SUPPLEMENT') return '시험 전제: ④ 보완 요청 뒤 상태가 보완 중이 아님: ' + c.status;
        if (!C.canWriteFinOpinion(c, fin)) return '보완 중인 4번 예 계약에 재무 담당자가 재무 의견을 쓸 수 없음';
        const before2 = pend(c), n1 = c.finOpinions.length;
        const e2 = C.addFinOpinion(c, '보완 중 의견: 무상 기간 3개월을 계약서에도 적어 주세요.', fin);
        if (!e2 || c.finOpinions.length !== n1 + 1) return '보완 중에 재무 의견이 남지 않음';
        if (pend(c) !== before2 || c.status !== 'SUPPLEMENT') return '보완 중 재무 의견으로 결재 차례나 상태가 바뀜: ' + c.status + ' ' + pend(c);
        return true;
      },
    },
    {
      name: '4번 아니요인 열람 제한 계약은 재무 리더와 재무 임원의 목록, 검색, 통계에 드러나지 않음(2511CL002, 2609CL008)',
      kind: 'deny',
      run(h) {
        const IDS = ['2511CL002', '2609CL008'], WHO = ['u_seojin_ma', 'u_jaewon_kook'];
        const env = h.fresh({ role: 'FIN_LEAD' });
        const { C, U } = env;
        const names = {};
        for (const id of IDS) {
          const c = env.contract(id);
          if (!c.restricted || (c.checklist || {}).accounting === 'YES') return id + '가 4번 아니요인 열람 제한 계약이 아님';
          names[id] = c.counterparty;
          for (const u of WHO) {
            if (C.canView(c, U(u))) return U(u).role + '(' + u + ')가 4번 아니요인 열람 제한 계약 ' + id + '를 봄';
          }
        }
        // 2026-11-13 보강(점검 지적): 06은 "목록, 검색, 통계에 드러남: 안 됨"이라 C.canView만 보지 않고 화면(contracts.js 계약 목록과 검색 칸,
        //   stats.js 통계)을 그 사람으로 그려 봄. 같은 계약을 4번 예로만 바꾼 env와 견주어, 화면이 4번 규칙으로 가리는지 확인함
        for (const u of WHO) {
          for (const id of IDS) {
            for (const q of [id, names[id]]) {
              const no = listSearch(h, u, q, null);
              if (no.why) return no.why;
              if (no.rows.indexOf(names[id]) > -1 || no.rows.indexOf(id) > -1 || no.count !== 0) return u + '의 계약 목록에서 "' + q + '"로 찾으면 4번 아니요인 열람 제한 계약 ' + id + '가 드러남: ' + no.rows.slice(0, 120);
              const yes = listSearch(h, u, q, acctYes([id]));
              if (yes.why) return yes.why;
              if (yes.rows.indexOf(names[id]) < 0 || yes.count !== 1) return '견줌: 같은 계약을 4번 예로 바꿨는데 ' + u + '의 계약 목록에서 "' + q + '"로 찾아도 ' + id + '가 보이지 않음(검색이 다른 까닭으로 막힘)';
            }
          }
          // 목록(거르지 않음): 영업대표 정하은의 계약 완료 묶음에 2511CL002가 있으나 이름 없이 "열람 제한 계약"으로만 보임
          const plain = listSearch(h, u, '', null, { owner: 'u_sales2', status: 'ACTIVE' });
          if (plain.why) return plain.why;
          if (plain.rows.indexOf('열람 제한 계약') < 0) return '견줌: ' + u + '의 계약 목록(정하은, 계약 완료)에 가린 줄이 없음(2511CL002가 목록에 없음)';
          if (plain.rows.indexOf(names['2511CL002']) > -1 || plain.rows.indexOf('2511CL002') > -1) return u + '의 계약 목록에 4번 아니요인 열람 제한 계약 2511CL002의 고객사나 번호가 보임';
          // 통계: 볼 수 없어 뺀 수에 두 계약이 듦. 같은 두 계약을 4번 예로 바꾸면 뺀 수가 꼭 2 줄어듦
          const hidNo = statsHidden(h, u, null), hidYes = statsHidden(h, u, acctYes(IDS));
          if (typeof hidNo !== 'number') return hidNo;
          if (typeof hidYes !== 'number') return hidYes;
          if (hidNo - hidYes !== 2) return u + '의 통계에서 4번 아니요인 열람 제한 계약 두 건이 셈에서 빠지지 않음(뺀 수 ' + hidNo + '건, 4번 예로 바꾸면 ' + hidYes + '건)';
        }
        return true;
      },
    },
    {
      name: '재무가 아닌 사람(최고관리자, 관리자, 영업지원, 법무 포함)은 재무 의견을 쓰지 못함',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SUPER' });
        const { C, U } = env;
        const c = env.contract('2610CL003');
        const n0 = (c.finOpinions || []).length; // 예시 데이터에 앞서 남긴 재무 의견이 있음
        for (const id of ['u_super', 'u_admin', 'u_sadmin', 'u_legal', 'u_sales2']) {
          const u = U(id);
          if (C.canWriteFinOpinion(c, u)) return u.role + '(' + id + ')에게 재무 의견 칸이 열림';
          if (C.addFinOpinion(c, '시험 의견', u)) return u.role + '(' + id + ')의 재무 의견이 남음';
        }
        if ((c.finOpinions || []).length !== n0) return '재무 의견 수가 바뀜: ' + n0 + ' → ' + (c.finOpinions || []).length;
        return true;
      },
    },
    {
      name: '⑥ 날인이 끝난 뒤에는 재무 의견을 쓰지 못함(2610CL004 날인 전후, 2609CL003, 2609CL001)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'FINANCE' });
        fixClock(env);
        const { C, U } = env;
        const fin = U('u_finance');
        const c4 = env.contract('2610CL004');
        if (step(c4, 'S06').state !== 'PENDING') return '2610CL004가 ⑥ 차례가 아님';
        if (!C.canWriteFinOpinion(c4, fin)) return '⑥ 날인 전(체결 대기)인데 재무 의견을 쓸 수 없음';
        if (!C.recordAction(c4, step(c4, 'S06'), 'APPROVE', '확인: ' + env.D.SEAL_CHECKS.join(', '), U('u_ga'))) return '⑥ 날인 기록이 남지 않음';
        if (C.canWriteFinOpinion(c4, fin)) return '⑥ 날인 뒤에도 재무 의견 칸이 열림';
        if (C.addFinOpinion(c4, '날인 뒤 의견', fin)) return '⑥ 날인 뒤 재무 의견이 남음';
        for (const id of ['2609CL003', '2609CL001']) {
          const c = env.contract(id);
          if (C.canWriteFinOpinion(c, fin) || C.addFinOpinion(c, '날인 뒤 의견', fin)) return id + '(⑥ 끝남)에 재무 의견이 남음';
        }
        return true;
      },
    },
    {
      name: '남긴 재무 의견은 덧붙이기만 하고 고치거나 지우는 기능이 없음',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'FINANCE' });
        fixClock(env);
        const { C, U } = env;
        const c = env.contract('2610CL003');
        const fin = U('u_finance');
        const old = JSON.stringify(c.finOpinions || []), n0 = (c.finOpinions || []).length; // 예시 데이터에 앞서 남긴 의견이 있음
        const a = C.addFinOpinion(c, '첫 의견', fin);
        const snap = JSON.stringify(a);
        const b = C.addFinOpinion(c, '둘째 의견', fin);
        if (!a || !b) return '재무 의견이 남지 않음';
        if (c.finOpinions.length !== n0 + 2) return '의견이 두 건 늘지 않음: ' + n0 + ' → ' + c.finOpinions.length;
        if (JSON.stringify(c.finOpinions.slice(0, n0)) !== old) return '새 의견이 앞서 남긴 의견을 바꾸거나 덮어씀';
        if (JSON.stringify(c.finOpinions[n0]) !== snap) return '둘째 의견이 첫 의견을 바꾸거나 덮어씀';
        const saved = JSON.parse(env.store['climb.demoFinOpinions'] || '[]');
        if (saved.length !== 2) return '저장된 재무 의견이 2건이 아님: ' + saved.length;
        const editors = Object.keys(C).filter(k => /fin.?opinion/i.test(k) && !/^(canWriteFinOpinion|addFinOpinion)$/.test(k));
        if (editors.length) return '재무 의견을 고치거나 지우는 기능이 있음: ' + editors.join(', ');
        // 2026-11-13 보강(점검 지적): 함수 이름만 보면 editOpinion, removeNote처럼 이름이 다른 기능이나 화면의 고치는 단추를 놓침. 그래서
        //   (1) 시안의 모든 화면 스크립트에서 계약의 finOpinions를 바꾸는 글(대입, splice 등)을 찾아, 앞 목록에 새 의견을 잇는(concat) 두 곳
        //       (common.js addFinOpinion과 저장소에서 다시 붙이기)뿐인지 봄
        //   (2) 재무 담당자가 결재 문서의 재무 의견 묶음(#fin-opinion)을 열면 단추는 "의견 남기기" 하나뿐이고, 남긴 의견 줄에는 단추나 입력 칸이 없음
        const JSDIR = path.join(__dirname, '..', '..', 'prototype', 'assets', 'js');
        const writes = [];
        fs.readdirSync(JSDIR).filter(f => /\.js$/.test(f) && f !== 'mock-data.js').forEach(f => {
          String(fs.readFileSync(path.join(JSDIR, f), 'utf8')).split(/\r?\n/).forEach((l, i) => {
            if (/DEMO_KEYS\.finOpinions = 'climb\.demoFinOpinions';/.test(l)) return; // 저장소 열쇠 이름을 정하는 줄(의견 목록이 아님)
            if (/finOpinions\s*(\[[^\]]*\]\s*)?=(?!=)|finOpinions\s*\.\s*(splice|pop|shift|unshift|push|sort|reverse|fill|copyWithin|length\s*=)|delete\s+[\w.]*finOpinions/.test(l)) writes.push({ f, i: i + 1, l: l.trim() });
          });
        });
        const bad = writes.filter(w => !(w.f === 'common.js' && /c\.finOpinions = \(c\.finOpinions \|\| \[\]\)\.concat\(\[(entry|n)\]\);/.test(w.l)));
        if (bad.length) return '재무 의견 목록을 이어 붙이기 밖의 방법으로 바꾸는 글이 있음: ' + bad.map(w => w.f + ' ' + w.i + '줄').join(', ');
        if (writes.length !== 2) return '재무 의견을 덧붙이는 곳이 addFinOpinion과 저장소 다시 붙이기 둘이 아님: ' + writes.map(w => w.f + ' ' + w.i + '줄').join(', ');
        let review = null;
        try { review = require('./lib').review; } catch (e) { return '결재 문서 도우미(lib.js review)를 불러오지 못함'; }
        const rv = review(env, '2610CL003', fin);
        if (rv.error) return '재무 담당자로 결재 문서를 그리지 못함: ' + rv.error.message;
        const fo = String(rv.dom.q('#fin-opinion').innerHTML);
        if (fo.indexOf('첫 의견') < 0 || fo.indexOf('둘째 의견') < 0) return '견줌: 결재 문서의 재무 의견 묶음에 남긴 의견이 보이지 않음';
        const buttons = fo.match(/<button\b[^>]*>/g) || [];
        if (buttons.length !== 1 || buttons[0].indexOf('id="fin-op-save"') < 0) return '재무 의견 묶음의 단추가 "의견 남기기" 하나가 아님: ' + buttons.join(' ');
        const list = (/<ul class="fin-ops">[\s\S]*?<\/ul>/.exec(fo) || [''])[0];
        if (!list) return '견줌: 재무 의견 목록(ul.fin-ops)을 찾지 못함';
        if (/<(button|input|textarea|select|a)\b|data-(edit|del|remove)/i.test(list)) return '남긴 재무 의견 줄에 고치거나 지우는 단추나 입력 칸이 있음';
        return true;
      },
    },
    {
      name: '(v0.5) 계약 등록 화면은 4번 예인데 종류를 하나도 고르지 않거나 비고가 비면 기안하지 않고, 종류는 코드표 값만 고를 수 있음(new-contract.js validate)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const names = ['acctKinds', 'accountingNote'];
        const run = (v, k) => validateRun(env, names, v, k);
        const none = run({ accounting: 'YES', accountingNote: '3개월 무상 사용' }, []);
        if (!none) return '계약 등록 화면 validate에서 4번 종류와 비고 검사 줄을 찾지 못함';
        if (none.indexOf('acctKinds') < 0) return '4번 예인데 종류를 고르지 않아도 기안 검사를 통과함';
        const blank = run({ accounting: 'YES', accountingNote: '  ' }, ['FREE_PERIOD']);
        if (blank.indexOf('accountingNote') < 0) return '4번 예인데 비고가 빈칸(공백만)이어도 기안 검사를 통과함';
        if (run({ accounting: 'YES', accountingNote: '3개월 무상 사용' }, ['FREE_PERIOD']).length) return '견줌: 종류와 비고를 모두 넣어도 오류가 남';
        if (run({ accounting: 'NO', accountingNote: '' }, []).length) return '견줌: 4번 아니요인데도 종류나 비고를 요구함';
        // 화면이 그리는 종류 상자는 코드표(ACCT_KINDS)의 코드 다섯 가지뿐(다른 값을 고를 길이 없음)
        const ch = kindChoices(env);
        if (!ch) return '계약 등록 화면에서 4번 종류 상자를 그리는 줄을 찾지 못함';
        const codes = (env.D.ACCT_KINDS || []).map(x => x.code);
        if (ch.length !== codes.length || ch.some(v => codes.indexOf(v) < 0)) return '4번 종류 상자의 값이 코드표와 다름: ' + ch.join(', ') + ' / ' + codes.join(', ');
        return true;
      },
    },
    {
      name: '조건이 있는데 4번에 아니요로 답한 것은 ② 확인 항목(4번 답과 계약서 조건)으로 봄',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES_ADMIN' });
        const items = env.D.REVIEW_CHECKS || [];
        if (!items.some(x => /4번 답/.test(x) && /(무상|환불)/.test(x))) return '② 확인 항목에 4번 답과 계약서의 무상 기간이나 환불 조건을 맞춰 보는 항목이 없음: ' + items.join(', ');
        return true;
      },
    },
  ],
  serverOnly: [
    '4번 예인데 비고 빈칸을 브라우저에서 우회해 보냄: 서버 거절(시안은 계약 등록 화면 validate에서만 막음. 화면 검사는 위 안 되는 경우 시험으로 봄)',
    '(v0.5) 4번 예인데 종류를 비우거나 코드표에 없는 값을 요청으로 직접 보냄: 서버 거절(시안은 계약 등록 화면에서 코드표 상자로만 고르게 함)',
    '기안 즉시 그 계약의 ⑩ 담당 재무에게 이메일 보내기: 서버 몫(시안은 이메일을 보내지 않고 예시 메일만 보임)',
    '재무의 열람 범위를 목록, 검색, 통계에서 서버가 판단: 서버 몫(시안은 화면에서 C.canView로 가림. 시안 화면의 가림은 위 안 되는 경우 시험이 계약 목록, 검색 칸, 통계를 그려 봄)',
    '(v0.5) 재무 의견을 고치거나 지우는 요청, 재무가 아닌 사람이나 ⑥ 날인 뒤의 의견 요청: 서버가 다시 확인하고 덧붙이기만 함',
  ],
};
