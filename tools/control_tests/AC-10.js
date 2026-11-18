// AC-10 기안 뒤 고칠 수 없음 (CTL-21) 시험 (2026-11-13 주말 점검 W2)
//   06 통제 목록 2장 AC-10의 되는 경우와 안 되는 경우를 시안 코드로 돌려 봄
//   화면 코드(new-contract.js, my-contracts.js)는 함수를 내보내지 않으므로, 파일은 고치지 않고 함수 글만 읽어 이 시험 안에서 만듦(pageFn)
'use strict';
const fs = require('fs');
const path = require('path');
const lib = require('./lib');
const JS = path.join(__dirname, '..', '..', 'prototype', 'assets', 'js');

// 화면 코드에서 marker 뒤 첫 function의 글을 { } 짝으로 잘라 냄(따옴표와 주석 안의 괄호는 셈하지 않음)
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
// 그 함수를 만들어 돌려줌. 화면 안의 변수(me, source, $ 등)는 scope에 넣어 줌
function pageFn(file, marker, scope) {
  return new Function('__s', 'with (__s) { return (' + fnText(file, marker) + '); }')(scope);
}
// (2026-11-13 시험 다지기) 계약 등록 화면이 주소 ?id=로 이어서 작성하거나 다시 기안할 기록을 찾는 문장(new-contract.js 그대로, AC-09와 같은 꺼내기)
//   못 찾으면 undefined: 화면은 "기록을 찾을 수 없습니다"를 알리고 빈 새 계약 등록을 엶(그 기록을 바탕으로 저장하거나 기안하지 않음)
let SRC_BODY = null;
function sourceOf(env, user, srcId) {
  if (!SRC_BODY) SRC_BODY = lib.stmtSrc('new-contract.js', '  const source = srcId ?', '}) : null;') + '\nreturn source;';
  return lib.compile(env, ['D', 'C', 'me', 'srcId'], SRC_BODY, 'new-contract.js(기록 찾기)')(env.D, env.C, user, srcId);
}

// 기안할 계약 기록(계약 등록 화면의 formRecord가 만드는 모양). over로 바꿔 씀
function draftRec(over) {
  return Object.assign({
    counterparty: '시험대학교', services: ['CK'], kind: 'NEW', parentId: null, amount: 12000000, requesterId: 'u_sales1',
    restricted: false, personalData: false,
    checklist: { standard: 'YES', price: 'YES', cap: 'YES', accounting: 'NO' },
    products: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: 12000000, listPrice: 12000000, cap: 0, unitKind: 'PERIOD', months: 12, stdAmount: 12000000 }],
    template: { id: 'TPL-CK', no: 2, label: '카피킬러 SaaS 이용계약서 판 2' }, files: [{ kind: 'DRAFT_DOC', name: '초안.docx', size: 1000 }],
  }, over || {});
}
// 계약 등록 화면의 기안(done)과 번호 매기기(newNumber)를 시험 안에서 만듦. 거래처 등록, 알림, 화면 이동은 하지 않음
function submitter(env, rec, source) {
  const scope = { D: env.D, C: env.C, source: source || null, bundleNumber: function () { return null; }, formRecord: function () { return rec; },
    registerCustomer: function () {}, round: source ? (source.round || 1) + 1 : 1, location: {} };
  scope.newNumber = pageFn('new-contract.js', '  function newNumber() {', scope);
  scope.done = pageFn('new-contract.js', '  function done() {', scope);
  return scope;
}

module.exports = {
  ac: 'AC-10',
  title: '기안 뒤 고칠 수 없음',
  tests: [
    {
      name: '기안하면 상태가 검토 중, 차례가 ② 체크리스트 검토',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const s = submitter(env, draftRec());
        const no = s.newNumber();
        s.done();
        const c = env.contract(no);
        if (!c) return '기안한 계약(' + no + ')이 저장되지 않음';
        if (c.status !== 'IN_REVIEW') return '상태가 검토 중이 아님: ' + c.status;
        const ps = env.C.pendingSteps(c);
        if (ps.length !== 1 || ps[0].step !== 'S02') return '차례가 ②만이 아님: ' + ps.map(x => x.step).join(',');
        if (ps[0].userId !== 'u_sadmin') return '② 담당이 영업지원 담당자가 아님: ' + ps[0].userId;
        return true;
      },
    },
    {
      name: '기안 요청에 상태나 결재란을 넣어 ②를 건너뛰려 함: 늘 ②부터',
      kind: 'deny',
      run(h) {
        // (1) 계약 등록 화면의 기안: 화면이 보낸 기록에 "승인됨"과 ② 생략 결재란이 들어 있어도
        const env = h.fresh({ role: 'SALES' });
        const forged = draftRec({ status: 'APPROVED', approvedAt: '2026-10-19 09:00',
          approvals: [{ step: 'S02', state: 'SKIPPED', reason: '생략' }, { step: 'S06', state: 'PENDING', userId: 'u_ga' }] });
        const s = submitter(env, forged);
        const no = s.newNumber();
        s.done();
        const c = env.contract(no);
        if (!c || c.status !== 'IN_REVIEW') return '기안 화면: 보낸 상태를 그대로 씀(' + (c && c.status) + ')';
        const s02 = c.approvals.find(a => a.step === 'S02');
        if (!s02 || s02.state !== 'PENDING') return '기안 화면: ②가 차례가 아님(' + (s02 && s02.state) + ')';
        if (env.C.pendingSteps(c).some(a => a.step !== 'S02')) return '기안 화면: ② 말고 다른 단계도 차례';
        // (2) 저장 함수에 바로 "승인됨" 기록을 넣어도 결재 기록으로 상태를 다시 셈
        const env2 = h.fresh({ role: 'SALES' });
        env2.C.saveDemoContract(Object.assign(draftRec(), { id: '2610CL015', status: 'APPROVED', requestedAt: env2.D.TODAY + ' 00:00', round: 1, history: [],
          approvals: [{ step: 'S02', state: 'DONE' }] }));
        const c2 = env2.contract('2610CL015');
        if (c2.status !== 'IN_REVIEW') return '저장: 보낸 상태(승인됨)를 그대로 씀(' + c2.status + ')';
        if (env2.C.currentStep(c2).step !== 'S02') return '저장: 차례가 ②가 아님(' + env2.C.currentStep(c2).step + ')';
        return true;
      },
    },
    {
      name: '남의 임시 저장을 열거나 지움: 작성자 말고는 보지 못하고 목록에도 없음',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const { D, C } = env;
        const draft = D.CONTRACTS.find(c => c.status === 'DRAFT' && c.requesterId === 'u_sales1');
        if (!draft) return '예시 임시 저장(이도윤)이 없음';
        if (!C.canView(draft, env.U('u_sales1'))) return '작성자 본인도 볼 수 없음';
        for (const id of ['u_sales2', 'u_head', 'u_sadmin', 'u_admin', 'u_super']) {
          if (C.canView(draft, env.U(id))) return id + '가 남의 임시 저장을 볼 수 있음';
        }
        // (2026-11-13 시험 다지기) "여는" 길: 임시 저장을 이어서 쓰는 곳은 계약 등록 화면(new-contract.html?id=임시 키)
        //   작성자는 열고(견줌), 다른 사람은 주소를 알아도 열지 못함. 최고관리자는 시연 역할이라 이 길에서는 따로 둠(REQ-AUTH-14 시연용, new-contract.js 주석)
        const key = draft.draftKey;
        if (!key || sourceOf(env, env.U('u_sales1'), key) !== draft) return '견줌: 작성자(이도윤)도 자기 임시 저장(' + key + ')을 계약 등록 화면에서 열지 못함';
        for (const id of ['u_sales2', 'u_head', 'u_sadmin', 'u_admin']) {
          const got = sourceOf(env, env.U(id), key);
          if (got) return id + '가 계약 등록 화면 주소로 남의 임시 저장(' + key + ')을 열었음';
        }
        // 내 등록 목록(지우기 단추가 있는 곳)에 남의 임시 저장이 나오지 않음
        const scope = { D: D, C: C, me: env.U('u_sales2'), seeAll: false, all: [], dateOf: function (c) { return c.requestedAt || c.savedAt || ''; } };
        pageFn('my-contracts.js', '  function collect() {', scope)();
        if (scope.all.some(c => c.status === 'DRAFT' && c.requesterId !== 'u_sales2')) return '정하은의 내 등록 목록에 남의 임시 저장이 나옴';
        const sup = Object.assign({}, scope, { me: env.U('u_super'), seeAll: true, all: [] });
        pageFn('my-contracts.js', '  function collect() {', sup)();
        if (sup.all.some(c => c.status === 'DRAFT' && c.requesterId !== 'u_super')) return '최고관리자의 내 등록 목록에 남의 임시 저장이 나옴';
        return true;
      },
    },
    {
      // (2026-11-13 시험 다지기) 예전에는 serverOnly에만 있던 줄의 화면 쪽. 06 AC-10 "검토 중인 계약을 같은 번호로 다시 저장: 거절"
      //   계약 등록 화면은 임시 저장과 다시 기안할 수 있는 반려 계약만 엶(new-contract.js 주석: "검토 중인 계약을 열어 새 계약으로 또 기안하지 않게, v0.58 QA").
      //   기안자 쪽 일을 하는 지금 영업대표 본인(과 시연용 최고관리자)도 검토 중, 보완 중, 체결 대기, 운영 검토, 계약 완료 같은 기안한 계약을
      //   주소 ?id=로 열어 같은 번호로 다시 저장할 수 없어야 함. 저장 함수(saveDemoContract)가 같은 번호를 덮어쓰는 것은 서버 몫(serverOnly)
      name: '기안한 계약(검토 중, 보완 중, 체결 대기, 계약 완료 등)은 계약 등록 화면에서 열리지 않아 같은 번호로 다시 기안할 수 없음',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const { D, C } = env;
        // 견줌: 쓴 사람의 임시 저장과 지금 영업대표의 반려 계약(다시 기안)은 열림
        const d1 = D.CONTRACTS.find(c => c.draftKey === 'D-0001');
        if (!d1 || sourceOf(env, env.U(d1.requesterId), 'D-0001') !== d1) return '견줌: 쓴 사람이 자기 임시 저장 D-0001을 열지 못함';
        const rj = env.contract('2610CL001');
        if (!rj || rj.status !== 'REJECTED' || sourceOf(env, env.U(C.repActorOf(rj)), '2610CL001') !== rj) return '견줌: 지금 영업대표가 반려된 2610CL001을 다시 기안하려고 열지 못함';
        const seen = {}, opened = [];
        D.CONTRACTS.filter(c => c.id && ['DRAFT', 'REJECTED'].indexOf(c.status) < 0).forEach(c => {
          seen[c.status] = (seen[c.status] || 0) + 1;
          for (const u of [env.U(C.repActorOf(c)), env.U('u_super')]) {
            if (sourceOf(env, u, c.id)) opened.push(c.id + '(' + c.status + ', ' + u.id + ')');
          }
        });
        const need = ['IN_REVIEW', 'SUPPLEMENT', 'APPROVED', 'OPS_REVIEW', 'ACTIVE'].filter(s => !seen[s]);
        if (need.length) return '시험 전제: 예시에 이 상태의 계약이 없어 보지 못함: ' + need.join(',');
        if (opened.length) return '기안한 계약이 계약 등록 화면에서 열림: ' + opened.slice(0, 4).join(', ') + (opened.length > 4 ? ' 외 ' + (opened.length - 4) + '건' : '');
        return true;
      },
    },
    {
      name: '기안한 계약 삭제: 내 등록 목록의 지우기 단추는 작성자 본인의 임시 저장 줄에만 있음',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const { D, C } = env;
        // 내 등록 목록 줄의 할 일 칸(my-contracts.js todo). 지우기 단추는 data-del
        const todoFor = function (userId) {
          const scope = { C: C, esc: C.esc, me: env.U(userId), cpName: function (c) { return c.counterparty || '거래처 미입력'; } };
          return pageFn('my-contracts.js', '  function todo(c) {', scope);
        };
        const mine = todoFor('u_sales1');
        const drafts = D.CONTRACTS.filter(c => c.status === 'DRAFT' && c.requesterId === 'u_sales1');
        if (!drafts.length || drafts.some(c => mine(c).indexOf('data-del') < 0)) return '작성자 본인의 임시 저장 줄에 지우기 단추가 없음(시험을 고칠 것)';
        for (const id of ['u_sales1', 'u_sales2', 'u_super']) {
          const t = todoFor(id);
          const bad = D.CONTRACTS.filter(c => c.status !== 'DRAFT' && t(c).indexOf('data-del') > -1).map(c => c.id);
          if (bad.length) return id + '의 목록에서 기안한 계약에 지우기 단추가 있음: ' + bad.slice(0, 3).join(',');
        }
        const other = todoFor('u_sales2');
        if (drafts.some(c => other(c).indexOf('data-del') > -1)) return '정하은에게 남(이도윤)의 임시 저장 지우기 단추가 보임';
        return true;
      },
    },
  ],
  serverOnly: [
    '검토 중인 계약을 같은 번호로 다시 저장하는 요청을 화면을 거치지 않고 저장 함수에 바로 보냄: 거절해야 함. 시안의 saveDemoContract는 같은 번호면 바꿔 씀(06에 적힌 그대로, 서버가 막음). 화면 쪽(계약 등록 화면이 기안한 계약을 열지 않음)은 위 시험에서 봄',
    '기안 요청에 승인 기록(결재 기록 history)까지 꾸며 넣거나 상태를 만료, 해지처럼 다시 셈하지 않는 값으로 보냄: 시안은 받은 기록을 믿음. 서버는 03 10장 상태 전이표대로만 바꿈',
    '기안한 계약 삭제 요청: 거절해야 함. 시안은 화면에 단추가 없을 뿐 C.deleteDraft가 상태를 보지 않고 지움(서버가 상태와 작성자를 확인)',
    '남의 임시 저장을 지우는 요청을 직접 보냄: 시안 C.deleteDraft는 작성자를 확인하지 않음(서버가 확인)',
  ],
};
