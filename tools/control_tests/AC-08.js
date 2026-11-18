// AC-08 가격 기준 변경 (06 통제 목록 2장, CTL-15) (2026-11-13 주말 점검 W2)
//   기대 동작: 가격 기준은 관리자만 바꾸고, 품의 링크(https), 사유, 오늘 이후 적용 시작일이 있어야 저장됨. 같은 기능, 같은 적용 시작일은 한 줄.
//     기존 줄은 고치지 않고 새 줄을 더해 전후 값을 남김. 서버는 역할, 사내망, 링크 형식, 사유, 적용 시작일, 중복을 다시 확인
//   시안 코드: admin-prices.js의 checkPrice, rowFrom, saved, openChange, openAdd와 화면 맨 위 역할 막기(C.gate, canEdit).
//     common.js의 adminSave, applyAdmin, refreshPrices
//   가격 기준 관리 화면은 화면(DOM)에 묶여 harness가 올리지 않음. lib.js의 꺼내 쓰기 틀로 admin-prices.js의 함수 글을 그대로 꺼내 돌림.
//     입력 창(C.formModal)은 받은 check와 done을 잡아 두었다가, 확인 단추처럼 check에 오류가 없을 때만 done을 부름
'use strict';
const lib = require('./lib');
const nc = lib.nc, ncState = lib.ncState;

const AP_FNS = ['val', 'won', 'pct', 'priced', 'retired', 'current', 'planned', 'unitText', 'tierText', 'priceFields', 'tierFields', 'tierInput',
  'sameTiers', 'checkPrice', 'rowFrom', 'tierChange', 'saved', 'openChange', 'liveProducts', 'openFeatures', 'featureOptions', 'openAdd'];
let AP_BODY = null;
// 가격 기준 관리 화면 하나. 돌려줌: { change(기능, 칸 값) / add(칸 값) → { errors, saved }, planned, current }
function ap(env) {
  if (!AP_BODY) {
    AP_BODY = [
      'const MODAL = {};',
      'const C = Object.assign(Object.create(C0), { formModal: function (o) { MODAL.o = o; } });',
      'const me = C.currentUser();',
      'const esc = C.esc;',
      'let page = 1, svc = "ALL";',
      'function render() {}',
      'function setSvc() {}',
      'function matches() { return true; }',
      'const $ = function () { return { reset: function () {}, value: "" }; };',
      AP_FNS.map(function (n) { return lib.fnSrc('admin-prices.js', n); }).join('\n'),
      // 입력 창의 확인 단추: 오류(빈 글이 아닌 값)가 하나라도 있으면 저장하지 않음
      'function submit(f) {',
      '  const errs = MODAL.o.check(f);',
      '  const bad = Object.keys(errs).filter(function (k) { return errs[k]; }).map(function (k) { return errs[k]; });',
      '  if (bad.length) return { errors: bad, saved: false };',
      '  MODAL.o.done(f);',
      '  return { errors: [], saved: true };',
      '}',
      'return { change: function (fid, v) { openChange(fid); return submit(form(v)); }, add: function (v) { openAdd(); return submit(form(v)); },',
      '  planned: planned, current: current };',
    ].join('\n');
  }
  return lib.compile(env, ['D', 'C0', 'form'], AP_BODY, 'admin-prices.js(꺼낸 함수)')(env.D, env.C, form);
}
// 입력 창의 칸들(f.elements[이름].value)
function form(v) {
  const elements = {};
  Object.keys(v).forEach(function (k) { elements[k] = { value: v[k] == null ? '' : String(v[k]) }; });
  ['price', 'cap', 'validFrom', 'docUrl', 'docNo', 'reason'].forEach(function (k) { if (!elements[k]) elements[k] = { value: '' }; });
  return { elements: elements };
}
// 화면 맨 위의 역할 막기(admin-prices.js 그대로): 'blocked'(화면을 막음), 'view'(보기만, 바꾸기와 가격 추가 단추 없음), 'edit'
let GATE_BODY = null;
function gateOf(env, user) {
  if (!GATE_BODY) {
    const s = lib.stmtSrc('admin-prices.js', '  if (!C.gate(me,', "const canEdit = me.role === 'ADMIN' || me.role === 'SUPER';");
    GATE_BODY = 'const esc = C.esc;\n' + s.replace(')) return;', ")) return 'blocked';") + "\nreturn canEdit ? 'edit' : 'view';";
  }
  return lib.compile(env, ['C', 'me'], GATE_BODY, 'admin-prices.js(역할 막기)')(env.C, user);
}
// 바꾸기의 바른 값: CK Patent(오늘 3,000,000원, 한도 0%)를 2026-11-01부터 3,300,000원으로
const FID = 'CK_CAMPUS_PATENT';
function good(over) {
  return Object.assign({ price: '3,300,000', cap: '0', validFrom: '2026-11-01', docUrl: 'https://gw.muhayu.com/approval/2026-1101', docNo: '경영지원-2026-1101',
    reason: '서버 비용 반영으로 단가 인상' }, over || {});
}
// 잘못된 값으로 바꾸기: 저장되지 않고 그 칸의 오류가 나와야 함
function refused(h, over, part) {
  const env = h.fresh({ role: 'ADMIN' });
  const n = env.D.PRICE_ROWS.length, logs = env.D.ADMIN_LOG.length;
  const r = ap(env).change(FID, good(over));
  if (r.saved || env.D.PRICE_ROWS.length !== n || env.D.ADMIN_LOG.length !== logs) return '저장됨';
  return r.errors.some(function (m) { return m.indexOf(part) > -1; }) || '"' + part + '" 오류가 없음: ' + r.errors.join(' / ');
}

module.exports = {
  ac: 'AC-08',
  title: '가격 기준 변경',
  tests: [
    {
      name: '2026-11-01부터 단가를 올리는 새 행을 품의 링크와 사유와 함께 넣으면 예정으로 보이고, 그날부터 기안에 쓰인다',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'ADMIN' });
        const D = env.D, C = env.C, p = ap(env);
        const r = p.change(FID, good());
        if (!r.saved) return '저장되지 않음: ' + r.errors.join(' / ');
        const plan = p.planned(FID);
        if (plan.length !== 1 || plan[0].validFrom !== '2026-11-01' || plan[0].listPrice !== 3300000) return '예정 줄이 ' + JSON.stringify(plan);
        if (p.current(FID).listPrice !== 3000000) return '오늘 기준이 ' + p.current(FID).listPrice + '원으로 바로 바뀜(예정이 아님)';
        if (plan[0].docUrl !== 'https://gw.muhayu.com/approval/2026-1101' || plan[0].reason !== '서버 비용 반영으로 단가 인상' || plan[0].by !== 'u_admin') return '새 줄의 근거가 ' + JSON.stringify(plan[0]);
        const log = D.ADMIN_LOG[D.ADMIN_LOG.length - 1];
        if (log.area !== 'PRICE' || log.by !== 'u_admin' || log.change.indexOf('3,000,000원 → 3,300,000원') < 0) return '관리자 변경 이력이 ' + JSON.stringify({ area: log.area, by: log.by, change: log.change });
        if (C.pricesAt('2026-10-31')[FID].listPrice !== 3000000 || C.pricesAt('2026-11-01')[FID].listPrice !== 3300000) return '날짜별 가격 줄이 맞지 않음';
        // 그날(2026-11-01)이 된 뒤의 계약 등록: 저장해 둔 시연 기록을 다시 올리고 오늘을 11-01로 둠
        const env2 = h.fresh({ role: 'SALES', store: env.store, hook: function (D2) { D2.TODAY = '2026-11-01'; } });
        const now = env2.D.PRICE_BOOK.filter(function (x) { return x.feature === FID; })[0];
        if (!now || now.listPrice !== 3300000) return '11-01의 오늘 가격이 ' + (now && now.listPrice);
        const q = nc(env2, ncState({ lines: [{ feature: FID, qty: 1, amount: '3,300,000' }] }));
        const pc = q.priceCheck();
        if (pc.q2 !== 'YES') return '새 단가 그대로인데 2번이 ' + pc.q2;
        const s = q.submit('2611CL901');
        if (s.errors.length) return '기안이 막힘: ' + s.errors.join(' / ');
        return env2.contract('2611CL901').products[0].listPrice === 3300000 || '기안한 줄의 표준 단가가 ' + env2.contract('2611CL901').products[0].listPrice;
      },
    },
    {
      name: '영업은 가격 기준 관리 화면이 막히고, 영업지원은 보기만 하며 바꾸기와 가격 추가 단추가 없다',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'ADMIN' });
        const got = { SALES: gateOf(env, env.U('u_sales1')), SALES_ADMIN: gateOf(env, env.U('u_sadmin')), ADMIN: gateOf(env, env.U('u_admin')) };
        const want = { SALES: 'blocked', SALES_ADMIN: 'view', ADMIN: 'edit' };
        return JSON.stringify(got) === JSON.stringify(want) || '역할별 화면이 ' + JSON.stringify(got) + '(바라는 것 ' + JSON.stringify(want) + ')';
      },
    },
    { name: '적용 시작일이 어제(2026-10-18)면 저장되지 않는다', kind: 'deny', run(h) { return refused(h, { validFrom: '2026-10-18' }, '적용 시작일은 오늘'); } },
    { name: '품의 링크가 http면 저장되지 않는다', kind: 'deny', run(h) { return refused(h, { docUrl: 'http://gw.muhayu.com/approval/2026-1101' }, '품의 문서 링크'); } },
    { name: '품의 링크가 빈칸이면 저장되지 않는다', kind: 'deny', run(h) { return refused(h, { docUrl: '' }, '품의 문서 링크'); } },
    { name: '변경 사유가 공백만이면 저장되지 않는다', kind: 'deny', run(h) { return refused(h, { reason: '   ' }, '변경 사유'); } },
    {
      name: '같은 기능, 같은 적용 시작일의 두 번째 행은 저장되지 않는다',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'ADMIN' });
        const p = ap(env);
        const a = p.change(FID, good());
        if (!a.saved) return '첫 줄이 저장되지 않음: ' + a.errors.join(' / ');
        const n = env.D.PRICE_ROWS.length;
        const b = p.change(FID, good({ price: '3,600,000', reason: '두 번째 줄' }));
        if (b.saved || env.D.PRICE_ROWS.length !== n) return '같은 날 두 번째 줄이 저장됨';
        return b.errors.some(function (m) { return m.indexOf('이미 기준이 있습니다') > -1; }) || '중복 오류가 없음: ' + b.errors.join(' / ');
      },
    },
    {
      // 화면에는 줄을 고치거나 지우는 기능이 없고, 바꾸기는 새 줄을 더함. 앞 줄은 그대로 남아 전후 값을 볼 수 있음
      name: '바꾸기는 기존 가격 행을 고치거나 지우지 않고 새 행을 더한다',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'ADMIN' });
        const D = env.D;
        const before = JSON.stringify(D.PRICE_ROWS);
        const r = ap(env).change(FID, good({ cap: '10' }));
        if (!r.saved) return '저장되지 않음: ' + r.errors.join(' / ');
        if (D.PRICE_ROWS.length !== JSON.parse(before).length + 1) return '가격 행 수가 ' + D.PRICE_ROWS.length;
        if (JSON.stringify(D.PRICE_ROWS.slice(0, -1)) !== before) return '기존 가격 행이 바뀜';
        const last = D.PRICE_ROWS[D.PRICE_ROWS.length - 1];
        if (last.feature !== FID || last.discountCap !== 0.1 || last.validFrom !== '2026-11-01') return '새 행이 ' + JSON.stringify(last);
        const log = D.ADMIN_LOG[D.ADMIN_LOG.length - 1];
        return log.change.indexOf('할인율 한도 0% → 10%') > -1 || '이력에 전후 값이 없음: ' + log.change;
      },
    },
  ],
  serverOnly: [
    '영업지원이나 영업이 저장 요청을 직접 보냄(단추가 숨겨져 있어도): 시안 C.adminSave는 읽기만 하는 역할(관찰자, 감사 열람)만 거절하고 관리자인지는 보지 않음. 서버가 관리자(최고관리자)만 받음',
    '적용 시작일을 어제로 바꿔 보냄, 품의 링크가 http이거나 빈칸, 사유가 공백만인 요청을 화면을 거치지 않고 보냄: 서버가 같은 검사를 다시 해 거절',
    '같은 기능, 같은 적용 시작일의 두 번째 행을 직접 보냄: 서버가 중복을 다시 확인해 거절(저장소의 유일 조건)',
    '기존 행을 고치거나 지우는 요청: 시안에는 그런 기능이 없음. 서버는 그런 요청을 받지 않음(가격 행은 넣기만)',
    'VPN에서 관리자 기능 접근: 시안은 망을 가리지 않음. 서버가 사내망에서만 받음(REQ-SEC-04)',
    '품의 링크는 형식만 확인: 내용 대조는 사후 점검(CTL-16, G-12)',
  ],
};
