// AC-13 표준계약서 판 관리 (CTL-26) 시험 (2026-11-13 주말 점검 W2)
//   표준계약서 화면(templates.js)의 새 판 올리기(openVersion, checkVersion, canEdit)와 common.js(adminSave, templateVersionAt, templateOf),
//   계약 등록의 지금 판(new-contract.js templatePick)을 봄
//   화면 코드는 함수를 내보내지 않으므로, 파일은 고치지 않고 함수 글만 읽어 이 시험 안에서 만듦(pageFn). 창(C.formModal)은 바로 확인을 누른 것처럼 돌림
'use strict';
const fs = require('fs');
const path = require('path');
const JS = path.join(__dirname, '..', '..', 'prototype', 'assets', 'js');

function fnText(file, marker) {
  const src = fs.readFileSync(path.join(JS, file), 'utf8');
  const at = src.indexOf(marker);
  if (at < 0) throw new Error(file + '에서 "' + marker.trim() + '"를 찾지 못함');
  const f = src.indexOf('function', at);
  let i = src.indexOf('{', f), depth = 0, q = '';
  for (; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === '\\') i++; else if (ch === q) q = ''; continue; }
    if (ch === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); continue; }
    if (ch === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 1; continue; }
    if (ch === '\'' || ch === '"' || ch === '`') { q = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return src.slice(f, i + 1);
  }
  throw new Error(file + ' ' + marker.trim() + '의 끝을 찾지 못함');
}
function pageFn(file, marker, scope) {
  return new Function('__s', 'with (__s) { return (' + fnText(file, marker) + '); }')(scope);
}

// 표준계약서 화면. 새 판 창(C.formModal)은 넣은 값(form)으로 바로 확인을 누름: 검사(check)에 걸리면 저장(done)하지 않음
function templatesPage(env, input) {
  const box = { errors: null, saved: false };
  const f = { elements: {} };
  Object.keys(input).forEach(function (k) { f.elements[k] = { value: input[k] }; });
  const C2 = Object.assign(Object.create(env.C), {
    formModal: function (o) {
      const e = o.check(f);
      box.errors = Object.keys(e).filter(function (k) { return e[k]; }).reduce(function (m, k) { m[k] = e[k]; return m; }, {});
      if (!Object.keys(box.errors).length) { o.done(f); box.saved = true; }
    },
    toast: function () {},
  });
  const scope = { D: env.D, C: C2, esc: env.C.esc, render: function () {} };
  ['val(f, n)', 'find(id)', 'bribeText(v)', 'planned(t)', 'versionFields()', 'checkVersion(f, t)', 'versionOf(f)', 'versionNote(v)', 'openVersion(id)'].forEach(function (sig) {
    scope[sig.slice(0, sig.indexOf('('))] = pageFn('templates.js', '  function ' + sig + ' {', scope);
  });
  box.scope = scope;
  return box;
}
function canEditOf(env, userId) {
  const src = fs.readFileSync(path.join(JS, 'templates.js'), 'utf8');
  const m = /const canEdit = ([^;]+);/.exec(src);
  if (!m) throw new Error('templates.js에서 canEdit를 찾지 못함');
  return new Function('__s', 'with (__s) { return (' + m[1] + '); }')({ me: env.U(userId), C: env.C });
}
function templatePick(env, id) {
  const scope = { D: env.D, C: env.C, val: function (n) { return n === 'template' ? id : ''; } };
  return pageFn('new-contract.js', '  function templatePick() {', scope)();
}
const GOOD = { from: '2026-11-01', summary: '제5조 서비스 중단 통지 기간을 30일로 분명히 함', bribe: 'Y', basis: '법무 검토 기록 2026-10-19' };

module.exports = {
  ac: 'AC-13',
  title: '표준계약서 판 관리',
  tests: [
    {
      name: '법무 담당자가 2026-11-01부터 쓰는 새 판을 올리면 예정, 그날부터 지금 판, 관리자 변경 이력(TEMPLATE) 한 줄',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'LEGAL' });
        const { D, C } = env;
        if (C.currentUser().id !== 'u_legal') return '시연 사용자가 법무 담당자가 아님';
        const logBefore = D.ADMIN_LOG.length;
        const p = templatesPage(env, GOOD);
        p.scope.openVersion('TPL-CK');
        if (!p.saved) return '새 판이 저장되지 않음: ' + JSON.stringify(p.errors);
        const t = D.TEMPLATES.find(x => x.id === 'TPL-CK');
        const v = t.versions[t.versions.length - 1];
        if (t.versions.length !== 3 || v.no !== 3 || v.from !== '2026-11-01') return '새 판이 판 3, 11-01부터가 아님: ' + JSON.stringify(v);
        if (v.by !== 'u_legal' || v.basis !== GOOD.basis) return '올린 사람이나 근거가 남지 않음: ' + v.by + ', ' + v.basis;
        if (!p.scope.planned(t).some(x => x.no === 3)) return '판 3이 예정으로 보이지 않음';
        if (C.templateVersionAt(t, D.TODAY).no !== 2) return '오늘(10-19)의 지금 판이 2가 아님';
        if (C.templateVersionAt(t, '2026-11-01').no !== 3) return '11-01의 지금 판이 3이 아님';
        D.TODAY = '2026-11-01';
        const tp = templatePick(env, 'TPL-CK');
        if (!tp || tp.no !== 3) return '11-01에 계약 등록이 고르는 판이 3이 아님: ' + JSON.stringify(tp);
        const logs = D.ADMIN_LOG.slice(logBefore);
        if (logs.length !== 1 || logs[0].area !== 'TEMPLATE' || logs[0].by !== 'u_legal') return '관리자 변경 이력(TEMPLATE) 한 줄이 아님: ' + JSON.stringify(logs.map(e => [e.area, e.by]));
        return true;
      },
    },
    {
      name: '영업에게는 새 판 올리기 단추가 없음(법무, 관리자, 최고관리자만)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        for (const id of ['u_sales1', 'u_head', 'u_exec', 'u_sadmin', 'u_finance', 'u_daon_yong']) {
          if (canEditOf(env, id)) return id + '에게 새 판 단추가 보임';
        }
        for (const id of ['u_legal', 'u_admin', 'u_super']) {
          if (!canEditOf(env, id)) return id + '에게 새 판 단추가 보이지 않음';
        }
        return true;
      },
    },
    {
      name: '적용 시작일이 어제: 저장 거절',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'LEGAL' });
        const p = templatesPage(env, Object.assign({}, GOOD, { from: '2026-10-18' }));
        p.scope.openVersion('TPL-CK');
        if (p.saved) return '어제부터인 판이 저장됨';
        if (!p.errors.from) return '적용 시작일 오류가 없음: ' + JSON.stringify(p.errors);
        return env.D.TEMPLATES.find(x => x.id === 'TPL-CK').versions.length === 2 ? true : '판이 늘어남';
      },
    },
    {
      name: '바뀐 조항이나 근거가 빈칸이거나 공백만: 저장 거절',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'LEGAL' });
        const cases = [{ summary: '' }, { summary: '   ' }, { basis: '' }, { basis: '  ' }];
        for (const x of cases) {
          const p = templatesPage(env, Object.assign({}, GOOD, x));
          p.scope.openVersion('TPL-CK');
          if (p.saved) return JSON.stringify(x) + '인데 저장됨';
          const key = Object.keys(x)[0];
          if (!p.errors[key]) return JSON.stringify(x) + '인데 그 칸 오류가 없음';
        }
        return true;
      },
    },
    {
      name: '같은 표준계약서에 같은 적용 시작일의 판을 또 올림: 저장 거절',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'LEGAL' });
        // 개인정보 처리위탁 계약서는 이미 2026-11-01에 시작하는 판 2가 있음
        const p = templatesPage(env, Object.assign({}, GOOD, { from: '2026-11-01' }));
        p.scope.openVersion('TPL-DPA');
        if (p.saved) return '같은 날 시작하는 판이 또 저장됨';
        return p.errors.from ? true : '적용 시작일 오류가 없음';
      },
    },
    {
      name: '앞 판은 고치거나 지우거나 덮어쓰지 않음: 새 판은 넣기만 하고 판 번호는 이어짐',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'LEGAL' });
        const t = env.D.TEMPLATES.find(x => x.id === 'TPL-CK');
        const before = JSON.stringify(t.versions);
        const p = templatesPage(env, GOOD);
        p.scope.openVersion('TPL-CK');
        if (!p.saved) return '새 판이 저장되지 않음';
        if (JSON.stringify(t.versions.slice(0, 2)) !== before) return '앞 판의 내용이 바뀜';
        const nos = t.versions.map(v => v.no);
        if (nos.join(',') !== '1,2,3') return '판 번호가 1,2,3이 아님: ' + nos.join(',');
        // 화면과 저장에 판을 고치거나 지우는 기능이 없음
        const pageOps = (fs.readFileSync(path.join(JS, 'templates.js'), 'utf8').match(/k: '([A-Z_]+)'/g) || []).map(s => s.slice(4, -1));
        if (pageOps.indexOf('TEMPLATE_VERSION') < 0) return '표준계약서 화면에서 새 판 저장(TEMPLATE_VERSION)을 찾지 못함(시험을 고칠 것)';
        const bad = pageOps.filter(k => ['TEMPLATE_ADD', 'TEMPLATE_VERSION'].indexOf(k) < 0);
        if (bad.length) return '표준계약서 화면에 넣기 말고 다른 기능이 있음: ' + bad.join(',');
        const storeOps = (fs.readFileSync(path.join(JS, 'common.js'), 'utf8').match(/op\.k === 'TEMPLATE[A-Z_]*'/g) || []).map(s => /'([A-Z_]+)'/.exec(s)[1]);
        if (storeOps.indexOf('TEMPLATE_VERSION') < 0) return 'common.js에서 새 판 저장(TEMPLATE_VERSION)을 찾지 못함(시험을 고칠 것)';
        const bad2 = storeOps.filter(k => ['TEMPLATE_ADD', 'TEMPLATE_VERSION'].indexOf(k) < 0);
        return bad2.length ? '저장(applyAdmin)에 판을 고치거나 지우는 일이 있음: ' + bad2.join(',') : true;
      },
    },
    {
      name: '기안한 뒤 새 판이 지금 판이 되어도 그 계약의 판 번호는 기안한 날의 판 그대로',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'LEGAL' });
        const { D, C } = env;
        const pick = templatePick(env, 'TPL-CK');
        C.saveDemoContract({ id: '2610CL015', counterparty: '시험대학교', services: ['CK'], kind: 'NEW', amount: 12000000, requesterId: 'u_sales1',
          requestedAt: D.TODAY + ' 00:00', status: 'IN_REVIEW', round: 1, history: [], personalData: false, template: pick,
          checklist: { standard: 'YES', price: 'YES', cap: 'YES', accounting: 'NO' } });
        const p = templatesPage(env, Object.assign({}, GOOD, { from: '2026-10-20' }));
        p.scope.openVersion('TPL-CK');
        if (!p.saved) return '새 판이 저장되지 않음';
        D.TODAY = '2026-10-25'; // 새 판(10-20부터)이 지금 판이 된 뒤
        const x = C.templateOf(env.contract('2610CL015'));
        if (!x || x.v.no !== 2) return '기안한 계약의 판이 바뀜: ' + (x && x.v.no);
        const x5 = C.templateOf(env.contract('2610CL005')); // 고른 기록이 없는 예시 계약(10-14 기안)
        if (!x5 || x5.v.no !== 2) return '예시 2610CL005의 판이 바뀜: ' + (x5 && x5.v.no);
        return true;
      },
    },
  ],
  serverOnly: [
    '영업이 새 판 저장 요청을 직접 보냄(단추가 숨겨져 있어도): 시안 C.adminSave는 읽기만 하는 역할만 막고 법무, 관리자, 최고관리자인지 보지 않음(06: "시안은 역할과 날짜 검사를 화면에서만"). 서버가 역할을 다시 확인',
    '적용 시작일을 어제로 바꾸거나, 바뀐 조항과 근거를 비우거나, 같은 날 시작하는 판을 요청에 직접 넣어 보냄: 시안은 화면(checkVersion)에서만 막음. 서버가 다시 확인',
    '앞 판을 고치거나 같은 판 번호로 덮어쓰는 요청: 서버가 거절하고 판 번호와 올린 사람을 스스로 정함. 시안 applyAdmin(TEMPLATE_VERSION)은 요청의 v에 no나 by가 들어 있으면 그 값으로 덮어씀(Object.assign 순서)',
  ],
};
