// AC-25 대리 지정 규칙 (CTL-43) 시험 (2026-11-13 주말 점검 W2)
//   06 통제 목록 2장 AC-25의 기대 동작: 규칙에 맞지 않는 대리 지정은 저장되지 않고, 대리 처리 기록마다 대리 지정 번호와 근거가 있다.
//   CTL-43: 대신할 사람은 같은 역할(정해 둔 리더 포함)이고 자기 자신은 안 됨. 저장하는 관리자 본인도 고를 수 없음(2026-11-09 기획자 결정 5회차 1번).
//     시작일은 오늘 이후, 근거 필수, 기간이 겹치면 안 됨
//   시안의 지정 규칙은 결재선 규칙 화면(admin-rules.js)의 고르는 목록(candidates, subCandidates)과 입력 창 검사(openDelegate, openEnd의 check)에 있음.
//   그 화면은 그리며 시작해 이 틀에 통째로 올릴 수 없으므로, 그 함수와 검사만 글자 그대로 떼어 와 가짜 브라우저 안에서 다시 만들어 부름(시안 코드는 고치지 않음)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RULES_JS = path.join(__dirname, '..', '..', 'prototype', 'assets', 'js', 'admin-rules.js');

// admin-rules.js에서 떼어 온 것으로 결재선 규칙 화면의 대리 지정 부분을 다시 만듦. me: 저장하는 관리자
function rulesPage(env, me) {
  const L = fs.readFileSync(RULES_JS, 'utf8').split(/\r?\n/);
  const bal = s => (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length;
  const fn = name => {
    const i = L.findIndex(l => l.startsWith('  function ' + name + '('));
    if (i < 0) throw new Error('admin-rules.js에서 함수 ' + name + '을 찾지 못함');
    if (bal(L[i]) === 0) return L[i];
    return L.slice(i, L.findIndex((l, k) => k > i && l === '  }') + 1).join('\n');
  };
  // 그 화면 함수 안의 입력 창 검사(check: function (f) { ... },)
  const checkIn = owner => {
    const o = L.findIndex(l => l.startsWith('  function ' + owner + '('));
    const i = L.findIndex((l, k) => k > o && l.startsWith('      check: function (f) {'));
    if (o < 0 || i < 0) throw new Error('admin-rules.js ' + owner + '에서 입력 창 검사를 찾지 못함');
    const j = bal(L[i]) === 0 ? i : L.findIndex((l, k) => k > i && l === '      },');
    return L.slice(i, j + 1).join('\n').trim().replace(/^check:\s*/, '').replace(/,$/, '');
  };
  // 대리 지정 창의 역할 겹침 셈(openDelegate 안의 listFor. 다른 창에도 같은 이름이 있어 openDelegate 다음 것을 씀)
  const od = L.findIndex(l => l.startsWith('  function openDelegate('));
  const listFor = L.find((l, k) => k > od && l.startsWith('    const listFor = '));
  if (od < 0 || !listFor) throw new Error('admin-rules.js openDelegate에서 listFor를 찾지 못함');
  const src = '(function (me) {\nconst D = window.CLIMB_DATA, C = window.CLIMB;\n' +
    ['val', 'conflictError', 'candidates', 'subCandidates', 'myDuties'].map(fn).join('\n') + '\n' + listFor.trim() + '\n' +
    'const delegateCheck = ' + checkIn('openDelegate') + ';\nconst endCheck = ' + checkIn('openEnd') + ';\n' +
    'return { subCandidates: subCandidates, delegateCheck: delegateCheck, endCheck: endCheck };\n})';
  return vm.runInContext(src, env.ctx, { filename: 'admin-rules.js(떼어 옴)' })(me);
}
// 결재선 규칙 화면(admin-rules.js) 전체를 그 관리자(meId, 관리자 역할로)로 가짜 문서에 그리고, 내용의 단추(attrs: data-change, data-team 등)를 눌러
//   열린 입력 창(C.formModal)의 고르는 목록 값을 돌려줌(lib.js의 page, clickTarget). 창이 열리지 않으면 opened=false와 알림(toast) 글
//   돌려주는 값 { opened, opts: [고를 수 있는 계정 번호], help: 창 본문 글, toasts, why }
function rulesModal(h, meId, hook, attrs) {
  const { page, clickTarget, strip } = require('./lib');
  const env = h.fresh({ role: 'ADMIN', hook });
  if (!env.ctx.getComputedStyle) env.ctx.getComputedStyle = () => ({ fontSize: '10px', getPropertyValue: () => '' });
  let modal = null;
  env.C.formModal = o => { modal = o; };
  const dom = page(env, 'admin-rules.js', '?role=ADMIN', { user: env.U(meId, 'ADMIN') });
  if (dom.error) return { why: meId + '로 결재선 규칙 화면을 그리지 못함: ' + dom.error.message };
  const n0 = env.toasts.length;
  dom.fire('#content', 'click', { target: clickTarget(attrs) });
  const opts = [];
  String(modal && modal.body || '').replace(/<option value="([^"]*)"/g, (m, v) => { if (v) opts.push(v); return m; });
  return { opened: !!modal, opts, help: strip(modal && modal.body), toasts: env.toasts.slice(n0).map(t => t.msg) };
}
// 입력 창 모양(f.elements[이름].value)
const form = v => ({ elements: Object.keys(v).reduce((o, k) => { o[k] = { value: v[k] }; return o; }, {}) });
const errs = r => Object.keys(r).filter(k => r[k]).map(k => k + ': ' + r[k]);
function fixClock(env) {
  const Base = env.ctx.Date;
  let n = 0;
  env.ctx.Date = class extends Base { constructor(...a) { if (a.length) super(...a); else super(2026, 9, 19, 20, n++, 0); } };
}
const step = (c, code) => (c.approvals || []).find(a => a.step === code);
// 법무 김지우의 대리로 같은 법무 송민재(법무와 관리자)를 지정하는 바른 입력
const GOOD = { absent: 'u_legal', sub: 'u_minjae_song', from: '2026-10-19', to: '2026-10-21', reason: '김지우님 연차. 같은 법무 담당자 송민재님이 법무 검토를 대신함', conflictReason: '' };

module.exports = {
  ac: 'AC-25',
  title: '대리 지정 규칙',
  tests: [
    {
      name: '영업 임원이 대리 지정(DL-002, 고은성 → 문태호)으로 2601CL001-A01의 ③을 처리하면 누구 대신, 대리 지정 번호, 근거가 남음',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'EXEC' });
        fixClock(env);
        const { C, U } = env;
        const c = env.contract('2601CL001-A01');
        const s3 = step(c, 'S03');
        if (!s3 || s3.state !== 'PENDING' || s3.userId !== 'u_eunseong_ko') return '2601CL001-A01이 고은성의 ③ 차례가 아님';
        const ex = U('u_exec');
        if (!C.canAct(c, s3, ex)) return '대리 기간 안인데 영업 임원이 ③을 처리할 수 없음';
        const e = C.recordAction(c, s3, 'APPROVE', '확인: ' + env.D.INTEREST_CHECK, ex, { noInterest: true });
        if (!e) return '처리 기록이 남지 않음';
        if (e.onBehalfOf !== 'u_eunseong_ko' || e.delegationId !== 'DL-002') return '누구 대신과 대리 지정 번호가 남지 않음: ' + e.onBehalfOf + ' / ' + e.delegationId;
        const dl = env.D.DELEGATIONS.find(d => d.id === 'DL-002');
        if (!e.basis || e.basis !== dl.reason) return '대리 근거가 대리 지정의 근거와 같지 않음: ' + e.basis;
        return true;
      },
    },
    {
      name: '바른 대리 지정 입력은 오류가 없음(견줌: 아래 거부 시험의 전제)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'ADMIN' });
        const pg = rulesPage(env, env.U('u_admin'));
        const r = pg.delegateCheck(form(GOOD));
        if (errs(r).length) return '바른 입력에 오류가 남: ' + errs(r).join('; ');
        if (!pg.subCandidates('u_legal').some(a => a.id === 'u_minjae_song')) return '같은 법무 송민재가 대신할 사람 목록에 없음';
        return true;
      },
    },
    {
      name: '시작일을 어제로(소급) 지정하면 거부',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'ADMIN' });
        const pg = rulesPage(env, env.U('u_admin'));
        const r = pg.delegateCheck(form(Object.assign({}, GOOD, { from: '2026-10-18' })));
        if (!r.from) return '어제 시작하는 대리 지정에 오류가 없음';
        return true;
      },
    },
    {
      name: '같은 담당자의 기간이 겹치는 두 번째 지정은 거부(DL-002 고은성 2026-10-19~2026-10-23과 겹침)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'ADMIN' });
        const pg = rulesPage(env, env.U('u_admin'));
        const base = { absent: 'u_eunseong_ko', sub: 'u_exec', reason: '시험: 겹치는 지정', conflictReason: '시험: 역할 겹침을 알고 저장' };
        const r = pg.delegateCheck(form(Object.assign({}, base, { from: '2026-10-22', to: '2026-10-25' })));
        if (!r.to) return '기간이 겹치는 두 번째 지정에 오류가 없음';
        const ok = pg.delegateCheck(form(Object.assign({}, base, { from: '2026-10-24', to: '2026-10-25' })));
        if (ok.to) return '견줌: 겹치지 않는 기간에도 겹침 오류가 남: ' + ok.to;
        return true;
      },
    },
    {
      name: '역할이 다른 사람(예: 영업 담당자, 영업지원)은 법무의 대신할 사람 목록에 없음',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'ADMIN' });
        const { C } = env;
        const list = rulesPage(env, env.U('u_admin')).subCandidates('u_legal');
        const wrong = list.filter(a => !C.canTake(a.roles, 'LEGAL'));
        if (wrong.length) return '법무가 아닌 사람이 목록에 있음: ' + wrong.map(a => a.id).join(', ');
        for (const id of ['u_sales1', 'u_sadmin', 'u_privacy', 'u_exec']) {
          if (list.some(a => a.id === id)) return id + '가 법무의 대신할 사람 목록에 있음';
        }
        return true;
      },
    },
    {
      name: '자리를 비우는 사람 자신은 대신할 사람 목록에 없음(법무 김지우, 영업 리더 최민준)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'ADMIN' });
        const pg = rulesPage(env, env.U('u_admin'));
        if (pg.subCandidates('u_legal').some(a => a.id === 'u_legal')) return '김지우 자신이 대신할 사람 목록에 있음';
        const heads = pg.subCandidates('u_head');
        if (!heads.length) return '견줌: 영업 리더의 대신할 사람 목록이 비어 있음';
        if (heads.some(a => a.id === 'u_head')) return '최민준 자신이 대신할 사람 목록에 있음';
        return true;
      },
    },
    {
      name: '저장하는 관리자 본인은 대신할 사람, ④ 단계 담당자, 유닛 리더로 고를 수 없음(관리자이자 법무인 송민재, 관리자를 더 준 영업 리더 최민준)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'ADMIN' });
        const self = rulesPage(env, env.U('u_minjae_song', 'ADMIN')).subCandidates('u_legal');
        if (self.some(a => a.id === 'u_minjae_song')) return '저장하는 관리자 송민재 본인이 대신할 사람 목록에 있음';
        const other = rulesPage(env, env.U('u_admin')).subCandidates('u_legal');
        if (!other.some(a => a.id === 'u_minjae_song')) return '견줌: 다른 관리자가 저장할 때도 송민재가 목록에 없음';
        // 2026-11-13 보강(점검 지적): 06은 "대신할 사람(또는 단계 담당자, 유닛 리더)"이고, 결정의 계기는 ④ 담당자 고르기였음.
        //   결재선 규칙 화면(admin-rules.js)을 그 관리자로 그려 바꾸기 단추를 눌러, 열린 창의 고르는 목록을 봄(같은 화면을 다른 관리자로 열어 견줌)
        // ④ 법무 검토 담당자 바꾸기: 송민재가 열면 고를 사람이 없어 창 대신 "본인은 다른 관리자가 정합니다." 안내, 윤재민이 열면 송민재가 목록에 있음
        const s4self = rulesModal(h, 'u_minjae_song', null, { 'data-change': 'S04' });
        if (s4self.why) return s4self.why;
        if (s4self.opts.indexOf('u_minjae_song') > -1) return '④ 담당자 바꾸기 창에서 저장하는 관리자 송민재가 자기를 고를 수 있음';
        if (!s4self.opened && !s4self.toasts.some(t => t.indexOf('본인은 다른 관리자가 정합니다') > -1)) return '④ 담당자 바꾸기 창이 열리지 않았는데 본인을 뺀 까닭 안내가 없음: ' + s4self.toasts.join(' / ');
        const s4other = rulesModal(h, 'u_admin', null, { 'data-change': 'S04' });
        if (s4other.why) return s4other.why;
        if (!s4other.opened || s4other.opts.indexOf('u_minjae_song') < 0) return '견줌: 관리자 윤재민이 연 ④ 담당자 바꾸기 창에 송민재가 없음(목록이 다른 까닭으로 비어 있음)';
        // 유닛 리더 바꾸기: 영업 리더 최민준에게 관리자 역할을 더 준 env에서, 최민준이 연 비즈니스2유닛 리더 바꾸기 창에는 본인이 없고 윤재민이 열면 있음
        const headAdmin = D => { D.ACCOUNTS.find(a => a.id === 'u_head').roles = ['HEAD', 'ADMIN']; };
        const ldSelf = rulesModal(h, 'u_head', headAdmin, { 'data-team': '비즈니스2유닛' });
        if (ldSelf.why) return ldSelf.why;
        if (!ldSelf.opened) return '견줌: 관리자를 더 준 최민준이 연 비즈니스2유닛 리더 바꾸기 창이 열리지 않음';
        if (ldSelf.opts.indexOf('u_head') > -1) return '유닛 리더 바꾸기 창에서 저장하는 관리자 최민준이 자기를 리더로 고를 수 있음';
        if (ldSelf.help.indexOf('본인은 다른 관리자가 정합니다') < 0) return '유닛 리더 바꾸기 창의 도움말에 본인을 뺀 까닭이 없음';
        const ldOther = rulesModal(h, 'u_admin', headAdmin, { 'data-team': '비즈니스2유닛' });
        if (ldOther.why) return ldOther.why;
        if (!ldOther.opened || ldOther.opts.indexOf('u_head') < 0) return '견줌: 관리자 윤재민이 연 비즈니스2유닛 리더 바꾸기 창에 최민준이 없음';
        return true;
      },
    },
    {
      name: '근거가 빈칸이거나 공백만이면 거부',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'ADMIN' });
        const pg = rulesPage(env, env.U('u_admin'));
        for (const reason of ['', '   ']) {
          if (!pg.delegateCheck(form(Object.assign({}, GOOD, { reason }))).reason) return '근거 "' + reason + '"에 오류가 없음';
        }
        return true;
      },
    },
    {
      name: '대리 지정을 끝내거나 취소하는 사유가 빈칸이거나 공백만이면 거부',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'ADMIN' });
        const pg = rulesPage(env, env.U('u_admin'));
        for (const reason of ['', '  ']) {
          if (!pg.endCheck(form({ reason })).reason) return '끝내는 사유 "' + reason + '"에 오류가 없음';
        }
        if (pg.endCheck(form({ reason: '출장 일정이 줄어 일찍 복귀' })).reason) return '견줌: 사유를 적어도 오류가 남';
        return true;
      },
    },
    {
      name: '대리 지정을 끝낸 뒤에도 앞서 대신 처리한 기록의 번호와 근거는 그대로(DL-002)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'ADMIN' });
        fixClock(env);
        const { C, U } = env;
        const c = env.contract('2601CL001-A01');
        const ex = U('u_exec');
        const e = C.recordAction(c, step(c, 'S03'), 'APPROVE', '확인: ' + env.D.INTEREST_CHECK, ex, { noInterest: true });
        if (!e) return '대신 처리 기록이 남지 않음';
        const snap = JSON.stringify(e);
        const other = env.contract('2510CL001-R01'); // 고은성의 다른 ③ 차례
        if (!C.canAct(other, step(other, 'S03'), ex)) return '견줌: 끝내기 전에 다른 ③ 차례를 대신 처리할 수 없음';
        const end = C.adminSave('RULE', '③ 영업 검토(비즈니스2유닛 리더) 대리 지정', '대리 지정 끝냄: 고은성 → 문태호', '출장 일정이 줄어 일찍 복귀', { k: 'DELEGATE_END', id: 'DL-002' });
        if (!end || end.refused) return '관리자가 대리 지정을 끝내지 못함';
        // 화면을 다시 연 것처럼: 같은 저장소로 새로 올려 결재 기록과 관리자 변경을 다시 적용
        const env2 = h.fresh({ role: 'ADMIN', store: env.store });
        const C2 = env2.C, c2 = env2.contract('2601CL001-A01');
        if (env2.C.delegationState(env2.D.DELEGATIONS.find(d => d.id === 'DL-002')) !== 'ENDED') return '다시 연 뒤 DL-002가 끝남이 아님';
        const kept = c2.history.find(x => x.step === 'S03' && x.action === 'APPROVE' && x.actorId === 'u_exec' && x.at === e.at);
        if (!kept || JSON.stringify(kept) !== snap) return '끝낸 뒤 대신 처리 기록이 바뀌거나 사라짐';
        const s3 = step(c2, 'S03');
        if (s3.state !== 'DONE' || s3.onBehalfOf !== 'u_eunseong_ko' || s3.delegationId !== 'DL-002') return '끝낸 뒤 결재란 ③의 누구 대신, 대리 지정 번호가 사라짐';
        const other2 = env2.contract('2510CL001-R01');
        if (C2.canAct(other2, step(other2, 'S03'), env2.U('u_exec'))) return '끝낸 뒤에도 영업 임원이 고은성 대신 처리할 수 있음';
        return true;
      },
    },
    {
      name: '예시 결재 기록에서 대리 처리 줄마다 대리 지정 번호와 근거가 있음',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SUPER' });
        const { D } = env;
        const bad = [];
        let n = 0;
        D.CONTRACTS.forEach(c => (c.history || []).forEach(x => {
          if (!x.delegationId && !(x.onBehalfOf && x.actorId !== 'u_super')) return;
          n++;
          if (!x.delegationId || !String(x.basis || '').trim()) bad.push(c.id + ' ' + x.step + ' ' + x.actorId + ' 대신 ' + x.onBehalfOf);
        }));
        // 2026-11-13 보강(점검 지적): 살펴본 줄이 0이면 아무것도 보지 않고 통과하므로 실패로 봄(지금 예시에는 2609CL009 ③ 영업 임원 DL-003 한 줄)
        if (!n) return '살펴볼 대리 처리 기록이 예시 결재 기록에 없음';
        if (bad.length) return '번호나 근거가 빠진 대리 처리 기록(' + n + '건 중): ' + bad.slice(0, 5).join('; ');
        return true;
      },
    },
  ],
  serverOnly: [
    '소급, 겹침, 역할이 다른 사람, 자기 자신, 저장하는 관리자 본인, 근거 빈칸을 요청 값으로 고쳐 보냄: 서버가 다시 검사(시안은 결재선 규칙 화면 admin-rules.js에서만 검사하고, C.adminSave의 DELEGATE는 검사 없이 넣음)',
    '오늘 날짜를 서버 기준으로 봄: 서버 몫(시안은 시연 날짜 2026-10-19)',
    '대리로 한 사람이 같은 계약의 통제 단계 둘을 처리하게 됨: 막지 않음(G-11, CTL-110). 남는 위험이라 시험 없음',
  ],
};
