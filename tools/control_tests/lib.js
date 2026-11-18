// 시험 파일들이 함께 쓰는 도우미 (2026-11-13 주말 점검 W2)
//   여러 AC 시험이 함께 쓰던 도우미를 한곳에 모음. 전에는 AC-01.js(lib), AC-28.js(page, review, doStep), AC-38.js(kit),
//   AC-46.js(lib), AC-49.js(lib)에 있어서 시험 파일이 다른 시험 파일을 불러 썼음. 함수 몸은 옮기기 전과 같음
//   쓰는 법: const lib = require('./lib'); 또는 const { review, fixClock } = require('./lib');
//   이름을 나눈 것 두 가지(받는 값이나 결과가 달라서):
//     page(env, 파일, '?query', { user, preset })는 전의 AC-28 page이고, pageAs(env, 파일, 사람, 'query', preset)는 전의 AC-46 lib의 page
//     strip은 태그와 &nbsp;를 빼는 전의 AC-46 lib의 strip이고, stripTags는 태그만 빼는 전의 AC-38 kit의 strip
//   이 파일은 시험이 아니어서 run.js가 돌리지 않음(run.js는 AC-숫자.js만 돌림)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const JS = path.join(__dirname, '..', '..', 'prototype', 'assets', 'js');

/* ======================================================================
 * 1. 화면 파일에서 함수 글을 꺼내 돌리는 틀과 계약 등록 화면(nc) (전에 AC-01.js의 lib)
 *   계약 등록 화면은 화면(DOM)에 묶인 함수라 harness가 올리지 않음. 그래서 new-contract.js에서 함수 글을 그대로 꺼내
 *   가짜 입력 칸(줄, 연도별 금액, 고른 값)을 붙여 같은 vm에서 돌림. 함수 몸은 시안 그대로이고, 거래처 검색, 영업기회번호 중복,
 *   보류, 견적 잇기, 오류 표시처럼 통제와 상관없는 화면 일만 비워 둠
 * ====================================================================== */
/* ---------- 화면 파일에서 함수 글 꺼내기 ---------- */
const SRC = {};
function src(file) { return SRC[file] || (SRC[file] = fs.readFileSync(path.join(JS, file), 'utf8')); }
// "  function 이름(" (두 칸 들여쓴 함수)부터: 한 줄 함수는 그 줄, 아니면 두 칸 들여쓴 "}" 줄까지
function fnSrc(file, name) {
  const s = src(file);
  const m = new RegExp('^  function ' + name + '\\(', 'm').exec(s);
  if (!m) throw new Error(file + '에서 함수 ' + name + '을(를) 찾지 못함');
  const eol = s.indexOf('\n', m.index);
  const line = s.slice(m.index, eol < 0 ? s.length : eol);
  const o = (line.match(/\{/g) || []).length, c = (line.match(/\}/g) || []).length;
  if (o && o === c) return line;
  const re = /\n  \}[^\n]*/g;
  re.lastIndex = m.index;
  const e = re.exec(s);
  if (!e) throw new Error(file + '의 함수 ' + name + ' 끝을 찾지 못함');
  return s.slice(m.index, e.index + e[0].length);
}
// 함수가 아닌 문장: startText부터 endText까지(처음 만나는 것)
function stmtSrc(file, startText, endText) {
  const s = src(file);
  const a = s.indexOf(startText);
  if (a < 0) throw new Error(file + '에서 "' + startText.trim() + '"을(를) 찾지 못함');
  const b = s.indexOf(endText, a + startText.length);
  if (b < 0) throw new Error(file + '에서 "' + startText.trim() + '"의 끝을 찾지 못함');
  return s.slice(a, b + endText.length);
}
// 꺼낸 글을 env의 vm에서 함수로 만듦: params 이름으로 값을 받는 함수
function compile(env, params, body, filename) {
  return vm.runInContext('(function (' + params.join(', ') + ') {\n' + body + '\n})', env.ctx, { filename: filename || '꺼낸 글' });
}

/* ---------- 계약 등록 화면(new-contract.js) 함수 꺼내 쓰기 ---------- */
const NC_FNS = ['val', 'badNum', 'parseNum', 'fmtNum', 'pct', 'toDate', 'addMonths', 'iso', 'templatePick', 'livePrices', 'liveFeatureIds', 'featureOf',
  'productOf', 'priceCustomer', 'amendKind', 'reduceMode', 'termsMode', 'priceOff', 'signed', 'readProducts', 'priceKeep', 'contractYears', 'yearlyAmounts',
  'totalAmount', 'priceCheck', 'discountText', 'caseNo', 'buildRoute', 'originTerms', 'nowQty', 'drafterId', 'quoteInsteadOk', 'noteIf', 'orgOf',
  'oppDupOk', 'validate', 'formRecord'];
// 화면 IIFE 맨 위의 값들과 가짜 입력 칸. ST: { me, vals: { 칸 이름: 값 }, lines: [{ service, product, feature, qty, amount, org, ... }],
//   years: ['12,000,000', ...](연도별 금액 칸에 넣은 글), origin(원계약 칸), quoteInstead, acctKinds, files, source(이어서 작성, 보완 후 재기안의 원래 기록) }
const NC_PRELUDE = [
  "const C = Object.assign(Object.create(C0), {",
  "  dateFieldError: function (input, msg) { return input && input.value ? '' : (msg || ''); },",
  "  setFieldError: function () {}, icon: function () { return ''; },",
  "});",
  "const me = ST.me;",
  "const esc = C.esc;",
  "const NEW_CUSTOMER = 'NEW';",
  "const QI_UNDER = D.QUOTE_INSTEAD.under;",
  "const PRICE = {};",
  "D.PRICE_BOOK.forEach(function (p) { PRICE[p.feature] = p; });",
  "const files = ST.files;",
  "const source = ST.source || null;",
  "let opp = { all: [], other: [], same: [] };",
  "let guard = { hold: null, check: '' };",
  "let current = { route: [], pc: {} };",
  "function el(v) {",
  "  return { value: v == null ? '' : String(v), hidden: false, checked: false, disabled: false, innerHTML: '', textContent: '', options: [],",
  "    classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },",
  "    setAttribute: function () {}, removeAttribute: function () {}, focus: function () {}, querySelector: function () { return el(''); } };",
  "}",
  "const qLinkSel = el(''), qInput = el('');",
  // 화면의 form: [name="칸"]:checked는 없음(라디오도 글 칸처럼 값만), [name="칸"]은 ST.vals에 있으면 그 값
  "const form = { querySelector: function (sel) {",
  "  const m = /^\\[name=\"([^\"]+)\"\\](:checked)?$/.exec(sel);",
  "  if (!m) return el('');",
  "  if (m[2]) return null;",
  "  return Object.prototype.hasOwnProperty.call(ST.vals, m[1]) ? { type: 'text', value: ST.vals[m[1]] == null ? '' : String(ST.vals[m[1]]) } : null;",
  "} };",
  "function makeLi(l) {",
  "  const k = { service: el(l.service), product: el(l.product), feature: el(l.feature), qty: el(l.qty == null ? 1 : l.qty), amount: el(l.amount),",
  "    org: el(l.org), orgPending: Object.assign(el(''), { checked: !!l.orgPending }), orgWhy: el(l.orgWhy), orgNote: el(l.orgNote) };",
  "  const err = Object.assign(el(''), { hidden: true });",
  "  return { _k: k, _err: err, classList: el('').classList, querySelector: function (sel) {",
  "    const m = /^\\[data-k=\"([^\"]+)\"\\]$/.exec(sel);",
  "    if (m) return k[m[1]] || null;",
  "    return sel === ':scope > .field-error' ? err : el('');",
  "  } };",
  "}",
  "const lis = (ST.lines || []).map(makeLi);",
  "const yearInputs = (ST.years || []).map(function (v) { return el(v); });",
  "const byId = { '#f-origin': el(ST.origin), '#yearly-field': Object.assign(el(''), { hidden: true }),",
  "  '#f-quote-instead': Object.assign(el(''), { checked: !!ST.quoteInstead }), '#f-start': el(ST.vals.startDate), '#f-end': el(ST.vals.endDate) };",
  "function $(s, root) { return root && root.querySelector ? root.querySelector(s) : byId[s] || el(''); }",
  "function $$(s, root) {",
  "  if (s === '#product-list > li') return lis.slice();",
  "  if (s === '.yearly-input') return yearInputs.slice();",
  "  if (root && root._k && s === '[data-k=\"qty\"], [data-k=\"amount\"]') return [root._k.qty, root._k.amount];",
  "  return [];",
  "}",
  // 이 통제와 상관없는 화면 일은 비워 둠(오류 표시, 원계약 막기, 연장 시작일, 영업기회번호 중복, 보류, 견적 잇기, 기관 칸)
  "function setError() { return null; }",
  "function clearAllErrors() {}",
  "function originBlock() { return null; }",
  "function renewStart() { return ''; }",
  "function syncOpp() {}",
  "function syncGuards() {}",
  "function linkedQuote() { return null; }",
  "function unitValue() { return ''; }",
  "function acctKinds() { return ST.acctKinds || []; }",
].join('\n');
const NC_TAIL = [
  // 화면 refresh()의 계산을 같은 차례로: 연도별 칸을 보일지(renderYearly), 2, 3번(priceCheck), 결재선 미리 보기(buildRoute)
  "function sync() {",
  "  const rows = readProducts();",
  "  byId['#yearly-field'].hidden = contractYears().length <= 1 || termsMode();",
  "  const pc = priceCheck(rows);",
  "  const qi = !!ST.quoteInstead && quoteInsteadOk(totalAmount());",
  "  current = { route: buildRoute(val('standard'), pc, rows, qi), pc: pc, q1: val('standard'), total: totalAmount(), qi: qi };",
  "  return current;",
  "}",
  // 기안 단추와 같은 차례(submit → refresh → validate → 확인 창 → done). 오류가 있으면 저장하지 않고 오류 글을 돌려줌
  "function submit(no) {",
  "  sync();",
  "  const errs = validate();",
  "  if (errs.length) return { errors: errs.map(function (e) { return e.msg; }), rec: null };",
  "  const rec = source && source.status === 'REJECTED' ? C.resubmitRecord(source, formRecord())",
  "    : Object.assign(formRecord(), { id: no, status: 'IN_REVIEW', requestedAt: C.nowStamp().slice(0, 16), round: 1, history: [] });",
  // 2026-11-16 W7-3(밤 코드 다시 보기 tests-01): 화면 done()과 같이 줄임 변경은 기안할 때 변경 뒤 할인율을 셈해 남김(reduceOver)
  "  if (rec.kind === 'AMEND' && C.amendKindOf(rec) === 'REDUCE') { const ra = C.reduceAfter(rec); rec.reduceOver = ra && ra.over ? ra : null; }",
  "  C.saveDemoContract(rec);",
  "  return { errors: [], rec: rec };",
  "}",
  "return { sync: sync, submit: submit, rows: function () { return readProducts(); }, total: function () { return totalAmount(); },",
  "  priceCheck: function () { return priceCheck(readProducts()); }, years: function () { return contractYears(); },",
  "  errors: function () { sync(); return validate().map(function (e) { return e.msg; }); },",
  "  record: function () { sync(); return formRecord(); }, route: function () { return sync().route; },",
  "  drafterId: function () { return drafterId(); }, live: function () { return liveFeatureIds(); } };",
].join('\n');
let NC_BODY = null;
// 계약 등록 화면 하나를 만듦. 화면 함수는 시안 그대로(new-contract.js에서 꺼냄)
function nc(env, st) {
  if (!NC_BODY) NC_BODY = NC_PRELUDE + '\n' + NC_FNS.map(function (n) { return fnSrc('new-contract.js', n); }).join('\n') + '\n' + NC_TAIL;
  st.me = st.me || env.C.currentUser();
  return compile(env, ['D', 'C0', 'ST'], NC_BODY, 'new-contract.js(꺼낸 함수)')(env.D, env.C, st);
}
// 기안이 되는 기본 값(신규, 우리 거래처 한빛대(티어 없음), 직접, 2026-11-01~2027-10-31 1년, 표준계약서 그대로, 종이 날인, 계약서 초안 첨부). over로 바꿈
function ncState(over) {
  over = over || {};
  const vals = Object.assign({
    kind: 'NEW', customer: 'C:C-0018', counterparty: '한빛대', bizNo: '134-82-00478', opportunity: '2610SU901', method: 'DIRECT',
    startDate: '2026-11-01', endDate: '2027-10-31', autoRenew: 'NO', personalData: 'NO', sla: 'NO', settlement: 'LUMP',
    standard: 'YES', template: 'TPL-CK', accounting: 'NO', signMethod: 'PAPER',
  }, over.vals || {});
  return Object.assign({ lines: [], years: [], origin: '', quoteInstead: false, acctKinds: [],
    files: { draft: [{ name: '계약서 초안.docx', size: 84000 }], diff: [], annex: [], quote: [] } }, over, { vals: vals });
}
function hasErr(errs, part) { return errs.some(function (m) { return String(m).indexOf(part) > -1; }); }

/* ======================================================================
 * 2. 화면 스크립트를 가짜 문서에 올려 단추와 확인 창을 누르는 도우미 page, review, doStep (전에 AC-28.js)
 * ====================================================================== */
/* ---------- 화면 스크립트를 가짜 문서에 올리는 도우미 ----------
 * page(env, 'review.js', '?id=...', { user, preset })
 *   - harness의 fresh()가 만든 env.ctx에 가짜 document를 끼우고 화면 스크립트(review.js, renewal.js 등)를 그대로 돌림. 저장소 파일은 고치지 않음
 *   - '#아이디' 요소는 하나씩 만들어 값(value), 감춤(hidden), 글(innerHTML, textContent)을 남김. innerHTML에 들어간 입력 칸(input, textarea)은
 *     읽어서 '#act-checks input' 같은 찾기에 돌려줌(확인 창의 확인 항목, 반려 항목, 날짜 칸)
 *   - ':checked'로 찾는 것은 미리 정한 것(preset)이나 읽은 입력 칸 가운데 표시한 것만, 없으면 null
 *   - C.init()은 머리글을 그리지 않고 opt.user를 돌려줌(그 사람으로 화면을 엶)
 * 돌려주는 값: { error, q(선택자), set(선택자, 값), inputs({ group, name }), fire(요소, 'submit'|'click'|'change', 사건), submit(), confirmClick() } */
function page(env, file, query, opt) {
  opt = opt || {};
  const ctx = env.ctx, C = env.C;
  const any = ctx.__anyDoc || (ctx.__anyDoc = ctx.document);
  const ids = new Map(), presets = new Map(), docKids = new Map();
  let parsed = [];
  const unesc = s => String(s).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  function kid(map, key) { if (!map.has(key)) map.set(key, mk({})); return map.get(key); }
  function byPattern(s) {
    let m = s.match(/^#([\w-]+) input(:checked)?$/);
    if (m) return parsed.filter(p => p.group === m[1] && (!m[2] || p.el.checked)).map(p => p.el);
    m = s.match(/^(?:input)?\[name="([^"]+)"\](?:\[value="([^"]*)"\])?(:checked)?$/);
    if (m && parsed.some(p => p.name === m[1])) return parsed.filter(p => p.name === m[1] && (!m[2] || p.el.value === m[2]) && (!m[3] || p.el.checked)).map(p => p.el);
    return null;
  }
  function one(s, kids) {
    s = String(s).trim();
    if (/^#[\w-]+$/.test(s)) { if (!ids.has(s)) ids.set(s, mk({ id: s.slice(1) })); return ids.get(s); }
    if (presets.has(s)) return presets.get(s);
    const list = byPattern(s);
    if (list) return list[0] || null;
    if (s.indexOf(':checked') > -1) return null;
    return kid(kids, s);
  }
  function all(s) { s = String(s).trim(); return presets.has('ALL:' + s) ? presets.get('ALL:' + s) : byPattern(s) || []; }
  function parseInto(src, html) {
    parsed = parsed.filter(p => p.src !== src);
    if (html.indexOf('<input') < 0 && html.indexOf('<textarea') < 0 && html.indexOf('<select') < 0) return;
    const re = /<(\/?)(fieldset|input|textarea|select)\b([^>]*)>/g;
    let m, group = null;
    while ((m = re.exec(html))) {
      const a = {};
      m[3].replace(/([\w-]+)(?:="([^"]*)")?/g, (x, k, v) => { a[k] = v == null ? true : unesc(v); return x; });
      if (m[2] === 'fieldset') { group = m[1] ? null : (a.id || null); continue; }
      if (m[1]) continue;
      const e = mk({ tag: m[2], type: typeof a.type === 'string' ? a.type : m[2] === 'input' ? 'text' : m[2], name: a.name || '', id: a.id || '',
        value: typeof a.value === 'string' ? a.value : '', checked: !!a.checked, disabled: !!a.disabled, max: a.max || '', min: a.min || '' });
      if (a.id) ids.set('#' + a.id, e);
      parsed.push({ el: e, group: group, name: a.name || '', src: src });
    }
  }
  function mk(p) {
    const cls = new Set();
    const t = {
      tag: 'div', id: '', type: '', name: '', value: '', checked: false, disabled: false, hidden: true, textContent: '', className: '', min: '', max: '',
      style: {}, dataset: {}, options: [], files: [], _html: '', _attr: {}, _ls: {}, _kids: new Map(),
      classList: { add() { for (const x of arguments) cls.add(x); }, remove() { for (const x of arguments) cls.delete(x); },
        toggle(x, f) { const on = f === undefined ? !cls.has(x) : !!f; if (on) cls.add(x); else cls.delete(x); return on; }, contains(x) { return cls.has(x); } },
      setAttribute(k, v) { this._attr[k] = String(v); }, getAttribute(k) { return k in this._attr ? this._attr[k] : null; },
      removeAttribute(k) { delete this._attr[k]; }, hasAttribute(k) { return k in this._attr; },
      addEventListener(type, f) { (this._ls[type] = this._ls[type] || []).push(f); }, removeEventListener() {},
      querySelector(s) { return one(s, this._kids); }, querySelectorAll(s) { return all(s); },
      closest(s) { return kid(this._kids, 'closest:' + s); },
      focus() {}, blur() {}, click() {}, scrollIntoView() {}, appendChild(x) { return x; }, remove() {}, insertAdjacentHTML() {}, contains() { return false; },
      getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
    };
    Object.defineProperty(t, 'innerHTML', { get() { return this._html; }, set(v) { this._html = String(v); parseInto(this, this._html); }, enumerable: true });
    Object.assign(t, p);
    return new Proxy(t, {
      get(o, k) { if (k in o) return o[k]; if (typeof k === 'symbol') return undefined; return any[k]; },
      set(o, k, v) { o[k] = v; return true; },
    });
  }
  const doc = new Proxy({}, {
    get(o, k) {
      if (k === 'querySelector') return s => one(s, docKids);
      if (k === 'querySelectorAll') return s => all(s);
      if (k === 'getElementById') return x => one('#' + x, docKids);
      if (k === 'addEventListener' || k === 'removeEventListener') return () => {};
      if (k === 'activeElement' || k === 'fonts') return null;
      if (k === 'createElement') return () => mk({});
      return any[k];
    },
  });
  // 미리 정할 값: [선택자, 값]. '#아이디'는 그 요소(예: 고르기 칸의 처음 값), 'ALL:선택자'는 목록
  (opt.preset || []).forEach(x => {
    const v = x[1] == null ? null : Array.isArray(x[1]) ? x[1].map(mk) : mk(x[1]);
    if (/^#[\w-]+$/.test(x[0])) ids.set(x[0], v); else presets.set(x[0], v);
  });
  ctx.document = doc;
  ctx.location.search = query || '';
  ctx.location.reload = () => {};
  ctx.getComputedStyle = () => ({ fontSize: '10px', getPropertyValue: () => '' });
  const user = opt.user || C.currentUser();
  const origInit = C.init;
  C.init = () => user;
  let error = null;
  try { vm.runInContext(fs.readFileSync(path.join(JS, file), 'utf8'), ctx, { filename: file }); } catch (e) { error = e; } finally { C.init = origInit; }
  function fire(target, type, ev) {
    const t = typeof target === 'string' ? one(target, docKids) : target;
    (t._ls[type] || []).forEach(fn => fn(Object.assign({ type: type, target: t, preventDefault() {}, stopPropagation() {} }, ev || {})));
  }
  const fakeTarget = map => ({ closest: s => (map[s] !== undefined ? map[s] : null), getAttribute: () => null });
  return {
    error, user, ids, fire, fakeTarget,
    q: s => one(s, docKids),
    set: (s, props) => { presets.set(s, props == null ? null : mk(props)); return presets.get(s); },
    inputs: f => parsed.filter(p => !f || ((!f.group || p.group === f.group) && (!f.name || p.name === f.name))).map(p => p.el),
    submit: sel => fire(sel || '#form', 'submit'),
    confirmClick: sel => fire(sel || '#confirm-modal', 'click', { target: fakeTarget({ '[data-act="confirm"]': {} }) }),
    errors: () => String(one('#error-summary', docKids).innerHTML).replace(/<svg[\s\S]*?<\/svg>/g, ''),
  };
}

// 결재 문서(review.js)를 그 사람으로 열고 처리 막대의 단추와 확인 창을 누르는 도우미
function review(env, id, who) {
  const u = typeof who === 'string' ? env.U(who) : who;
  const dom = page(env, 'review.js', '?role=' + u.role + '&id=' + encodeURIComponent(id), { user: u });
  const rv = {
    dom, error: dom.error,
    bar: () => String(dom.q('#action-bar').innerHTML),
    hasButton: (action, step) => rv.bar().indexOf('data-open="' + action + '" data-step="' + step + '"') > -1,
    open(action, step) {
      dom.fire('#action-bar', 'click', { target: dom.fakeTarget({ '[data-open]': { getAttribute: k => (k === 'data-open' ? action : k === 'data-step' ? step : null) } }) });
      return rv;
    },
    modalOpen: () => dom.q('#act-modal').hidden === false,
    extra: () => String(dom.q('#act-extra').innerHTML),
    desc: () => String(dom.q('#act-desc').textContent),
    checks: () => dom.inputs({ group: 'act-checks' }),
    reasons: () => dom.inputs({ group: 'act-reasons' }),
    checkAll(except) { rv.checks().forEach((b, i) => { b.checked = i !== except; }); return rv; },
    pick(code) { rv.reasons().forEach(b => { if (b.value === code) b.checked = true; }); return rv; },
    comment(t) { dom.q('#act-comment').value = t; return rv; },
    date(v) { dom.q('#act-date').value = v; return rv; },
    time(v) { dom.q('#act-time').value = v; return rv; },
    restart(on) { dom.q('#act-restart').checked = !!on; return rv; },
    demoFile() { dom.fire('#act-modal', 'click', { target: dom.fakeTarget({ '#act-demo-file': {} }) }); return rv; },
    confirm() { dom.fire('#act-modal', 'click', { target: dom.fakeTarget({ '[data-act="confirm"]': {} }) }); return rv; },
  };
  return rv;
}

// 결재 문서에서 그 사람이 그 단계를 처리(확인 항목 모두 표시, 날짜는 오늘, 파일은 예시 파일). 돌려주는 값 { ok, entry, why }
function doStep(env, id, step, who, o) {
  o = o || {};
  const rv = review(env, id, who);
  if (rv.error) return { ok: false, why: id + ' 결재 문서를 열지 못함: ' + rv.error.message };
  const action = o.action || (step === 'S07' ? 'REGISTER' : 'APPROVE');
  if (!rv.hasButton(action, step)) return { ok: false, why: id + ' ' + step + ' ' + action + ' 단추가 ' + who + '에게 없음' };
  rv.open(action, step).checkAll();
  if (rv.dom.ids.has('#act-date')) rv.date(o.date || env.D.TODAY);
  if (rv.dom.ids.has('#act-time')) rv.time(o.time || '08:00');
  if (o.pick) rv.pick(o.pick);
  rv.comment(o.comment == null ? '시험 처리' : o.comment);
  if (action === 'REGISTER') rv.demoFile();
  const c = env.contract(id), n = (c.history || []).length;
  rv.confirm();
  const e = c.history.length > n ? c.history[c.history.length - 1] : null;
  return { ok: !!e, entry: e, why: e ? '' : id + ' ' + step + ' ' + action + ' 처리가 남지 않음' };
}

/* ======================================================================
 * 3. 가짜 화면 도우미 openPage, fakeForm, submit, stripTags, env0 (전에 AC-38.js의 kit)
 * ====================================================================== */
//   시험 틀(harness.js)의 fresh 위에 화면 스크립트(admin-users.js 등)를 올려, 화면이 막는 것(단추, 입력 창의 검사)까지 시험함
//   openPage(h, '화면.js', { role, hook, query: 'id=..', values: { 'f-q': '찾을 말' }, pre: ['먼저 올릴.js'], keepInit, store })
//     → { env, node('#id'), modal(마지막 입력 창), fire('#id', 'click'), clickData('#id', { 'data-edit': '값' }), run('다른 화면.js') }
//   fakeForm(입력 창, { 칸: 값 }, { 체크 칸: [값] }), submit(입력 창, 양식) → { saved, errs, bad }
//   env0(h, { role, hook, store }): 화면 없이 공통 기능만 쓸 때. 공통 기능 안의 알림(toast)이 멈추지 않게 getComputedStyle을 둠
//   시안 저장소(env.store)를 다음 openPage의 store로 넘기면 앞에서 남긴 시연 기록(관리자 변경 등)을 이어서 봄
function env0(h, opt) {
  const env = h.fresh(opt || {});
  env.ctx.getComputedStyle = () => ({ fontSize: '10px', getPropertyValue: () => '' });
  return env;
}
function openPage(h, file, opt) {
  opt = opt || {};
  const env = env0(h, { role: opt.role, hook: opt.hook, store: opt.store });
  const ctx = env.ctx;
  if (opt.query) ctx.location.search = '?role=' + (opt.role || 'SUPER') + '&' + opt.query;
  const els = {};
  function node(key) {
    if (els[key]) return els[key];
    const n = {
      _key: key, _ls: {}, _attrs: {}, value: '', innerHTML: '', textContent: '', hidden: false, disabled: false, checked: false,
      style: { setProperty() {}, removeProperty() {} }, dataset: {}, options: [], files: [], min: '', max: '', href: '', placeholder: '',
      scrollLeft: 0, scrollWidth: 0, clientWidth: 0, offsetWidth: 0, offsetHeight: 0,
      classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
      addEventListener(t, fn) { (n._ls[t] = n._ls[t] || []).push(fn); }, removeEventListener() {},
      setAttribute(k, v) { n._attrs[k] = String(v); }, getAttribute(k) { return k in n._attrs ? n._attrs[k] : null; },
      hasAttribute(k) { return k in n._attrs; }, removeAttribute(k) { delete n._attrs[k]; },
      closest(s) { return node(key + ' <' + s); }, remove() { n.removed = true; }, focus() {}, blur() {}, click() {}, scrollIntoView() {},
      insertAdjacentHTML(pos, html) { n.innerHTML += html; }, appendChild(x) { return x; }, append() {}, prepend() {}, matches() { return false; }, contains() { return false; },
      querySelector(s) { return node(key + ' ' + s); }, querySelectorAll() { return []; },
      getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 }; },
    };
    n.parentNode = n; n.parentElement = n;
    els[key] = n;
    return n;
  }
  ctx.document = new Proxy({}, {
    get(t, k) {
      if (k === 'querySelector') return s => node(s);
      if (k === 'getElementById') return id => node('#' + id);
      if (k === 'querySelectorAll' || k === 'getElementsByTagName' || k === 'getElementsByClassName') return () => [];
      if (k === 'createElement') return () => node('new:' + Math.random());
      if (k === 'addEventListener' || k === 'removeEventListener') return () => {};
      if (k === 'documentElement' || k === 'body' || k === 'head' || k === 'activeElement') return node(k);
      return undefined;
    },
    set() { return true; },
  });
  ctx.getComputedStyle = () => ({ fontSize: '10px' });
  Object.keys(opt.values || {}).forEach(k => { node('#' + k).value = opt.values[k]; });
  const pg = { env, node, els, modal: null };
  if (!opt.keepInit) env.C.init = function () { return env.C.currentUser(); };
  env.C.formModal = function (o) { pg.modal = o; };
  env.C.focusSection = function () {};
  env.C.focusModal = function () {};
  const runFile = f => vm.runInContext(fs.readFileSync(path.join(JS, f), 'utf8'), ctx, { filename: f });
  (opt.pre || []).forEach(runFile);
  runFile(file);
  pg.run = function (f, values) { Object.keys(els).forEach(k => delete els[k]); pg.modal = null; Object.keys(values || {}).forEach(k => { node('#' + k).value = values[k]; }); runFile(f); };
  pg.fire = function (key, type, ev) { (node(key)._ls[type] || []).forEach(fn => fn(Object.assign({ preventDefault() {}, stopPropagation() {}, target: node(key) }, ev || {}))); };
  pg.clickData = function (key, attrs) {
    const target = {
      id: attrs.id || '', disabled: false, getAttribute: k => (k in attrs ? attrs[k] : null), hasAttribute: k => k in attrs, matches() { return false; },
      closest(s) {
        const m = s.match(/^\[([\w-]+)\]$/) || s.match(/^button\[([\w-]+)\]$/);
        if (m) return m[1] in attrs ? target : null;
        return s === 'button' ? target : null;
      },
    };
    pg.fire(key, 'click', { target });
  };
  pg.text = function () { return Object.keys(els).map(k => els[k].innerHTML + ' ' + els[k].textContent + ' ' + els[k].value).join(' '); };
  return pg;
}
function fakeForm(modal, vals, checks) {
  vals = vals || {}; checks = checks || {};
  const body = String(modal.body || '');
  const subs = {}, fields = {};
  function sub(key) {
    if (subs[key]) return subs[key];
    const n = {
      _key: key, _attrs: {}, _ls: {}, hidden: false, innerHTML: '', textContent: '', value: '', placeholder: '',
      classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
      setAttribute(k, v) { n._attrs[k] = String(v); }, getAttribute(k) { return k in n._attrs ? n._attrs[k] : null; }, removeAttribute(k) { delete n._attrs[k]; },
      querySelector(s) { return sub(key + ' ' + s); }, querySelectorAll() { return []; },
      addEventListener(t, fn) { (n._ls[t] = n._ls[t] || []).push(fn); }, focus() {},
    };
    subs[key] = n;
    return n;
  }
  function field(name) {
    if (fields[name]) return fields[name];
    const n = sub('field:' + name);
    n.name = name;
    n.value = vals[name] != null ? String(vals[name]) : '';
    fields[name] = n;
    return n;
  }
  const f = {
    elements: new Proxy({}, { get: (t, k) => (typeof k === 'string' ? field(k) : undefined) }),
    _ls: {},
    addEventListener(t, fn) { (f._ls[t] = f._ls[t] || []).push(fn); },
    querySelector(sel) {
      let m = sel.match(/^\[name="([\w-]+)"\]:checked$/);
      if (m) { const v = (checks[m[1]] || [])[0]; return v == null ? null : { value: v }; }
      m = sel.match(/^\[(data-[\w-]+)(="[^"]*")?\]$/);
      if (m) return body.indexOf(m[1] + (m[2] || '')) > -1 ? sub(sel) : null;
      m = sel.match(/^#([\w-]+)$/);
      if (m) return body.indexOf('id="' + m[1] + '"') > -1 ? sub(sel) : null;
      return sub(sel);
    },
    querySelectorAll(sel) {
      const m = sel.match(/^\[name="([\w-]+)"\]:checked$/);
      return m ? (checks[m[1]] || []).map(v => ({ value: v })) : [];
    },
    fireField(name, type) { (field(name)._ls[type] || []).forEach(fn => fn({ target: field(name) })); },
    sub,
  };
  if (modal.open) modal.open(f);
  return f;
}
function submit(modal, f) {
  const errs = modal.check ? modal.check(f) || {} : {};
  const bad = Object.keys(errs).filter(k => errs[k]);
  if (bad.length) return { saved: false, errs, bad };
  modal.done(f);
  return { saved: true, errs, bad };
}
// AC-38~AC-45가 쓰던 글 다듬기: 태그만 빼고 빈칸을 줄임(&nbsp;는 그대로 둠. 아래 strip과 다른 점)
const stripTags = s => String(s == null ? '' : s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/* ======================================================================
 * 4. 시계 고정 fixClock, 글 다듬기 strip, 단계 찾기 step, 가짜 입력 창 withModal, 단추 누름 clickTarget, pageAs (전에 AC-46.js의 lib)
 * ====================================================================== */
// 결재 기록 일시를 시연 날짜(D.TODAY) 20:00부터 1분씩 늘려 정해 둠(시험을 돌리는 시각과 상관없이 같은 결과)
//   common.js 안의 알림(toast)이 getComputedStyle을 불러 시험 틀에서 멈추지 않게 빈 값도 둠
function fixClock(env, hour) {
  if (!env.ctx.getComputedStyle) env.ctx.getComputedStyle = () => ({ fontSize: '10px', getPropertyValue: () => '' });
  const Base = env.ctx.Date;
  let n = 0;
  const hh = hour == null ? 20 : hour;
  env.ctx.Date = class extends Base { constructor(...a) { if (a.length) super(...a); else super(2026, 9, 19, hh, n++, 0); } };
}
// AC-46~AC-55가 쓰던 글 다듬기: 태그와 &nbsp;를 빼고 빈칸을 줄임
const strip = s => String(s == null ? '' : s).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const step = (c, code) => (c.approvals || []).find(a => a.step === code);

/* 입력 창(common.js formModal) 시험 도우미
 *   formModal은 document.getElementById('form-modal') 안에 창을 그리고 #fm-form의 submit에서 check → done을 부름
 *   common.js 안에서 부르는 창(진행 중단 창 등)은 C.formModal을 바꿔 끼워도 잡히지 않아, 그동안만 가짜 문서를 끼워 창을 잡음
 *   withModal(env, () => 창을 여는 일) → { opened, html, fields: 칸 이름들, submit({ 칸: 값 }, { 고르는 칸: 값 }) → { done, errors: { 칸: 오류 글 } } }
 *   창 밖의 문서 일은 원래 문서(시험 틀의 가짜 문서나 화면 도우미의 문서)로 넘김 */
function stubEl(extra) {
  const o = {
    hidden: false, disabled: false, checked: false, value: '', textContent: '', className: '', id: '', style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() { return false; }, contains() { return false; } },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {}, hasAttribute() { return false; },
    addEventListener() {}, removeEventListener() {}, appendChild(x) { return x; }, append() {}, prepend() {}, remove() {},
    focus() {}, blur() {}, click() {}, scrollIntoView() {}, closest() { return null; }, matches() { return false; }, contains() { return false; },
    insertAdjacentHTML() {}, getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
    querySelector() { return stubEl(); }, querySelectorAll() { return []; },
  };
  let html = '';
  Object.defineProperty(o, 'innerHTML', { get() { return html; }, set(v) { html = String(v); }, enumerable: true, configurable: true });
  return Object.assign(o, extra || {});
}
function withModal(env, open) {
  const ctx = env.ctx, saved = ctx.document;
  const st = { html: '', submit: null, errors: {}, vals: {}, checked: {} };
  const fields = {};
  const field = n => fields[n] || (fields[n] = stubEl({ name: n, value: '', options: [] }));
  const names = () => { const out = []; String(st.html).replace(/data-field="([^"]+)"/g, (m, n) => { if (out.indexOf(n) < 0) out.push(n); return m; }); return out; };
  const box = n => {
    const err = stubEl();
    Object.defineProperty(err, 'innerHTML', { get() { return st.errors[n] || ''; }, set(v) { if (String(v)) st.errors[n] = strip(v); else delete st.errors[n]; }, configurable: true });
    return stubEl({ getAttribute: k => (k === 'data-field' ? n : null), querySelector: s => (/field-error/.test(s) ? err : stubEl()), querySelectorAll: () => [] });
  };
  const form = stubEl({
    elements: new Proxy({}, { get: (t, k) => (typeof k === 'string' ? field(k) : undefined) }),
    addEventListener(t, fn) { if (t === 'submit') st.submit = fn; },
    querySelector(sel) {
      const m = /^\[name="([\w-]+)"\]:checked$/.exec(sel);
      if (m) return st.checked[m[1]] != null ? stubEl({ value: st.checked[m[1]], checked: true }) : null;
      return stubEl();
    },
    querySelectorAll(sel) { return sel === '[data-field]' ? names().map(box) : []; },
  });
  const el = stubEl({ id: 'form-modal', hidden: true, querySelector: s => (s === '#fm-form' ? form : stubEl()) });
  Object.defineProperty(el, 'innerHTML', { get() { return st.html; }, set(v) { st.html = String(v); }, configurable: true });
  ctx.document = new Proxy({}, {
    get(t, k) {
      if (k === 'getElementById') return id => (id === 'form-modal' ? el : saved.getElementById(id));
      if (k === 'activeElement') return null;
      const v = saved[k];
      return typeof v === 'function' ? v.bind(saved) : v;
    },
  });
  let error = null;
  try { open(); } catch (e) { error = e; }
  const opened = !!st.submit;
  if (!opened) ctx.document = saved;
  return {
    opened, error, html: st.html, fields: names(),
    submit(vals, checked) {
      if (!opened) return { done: false, errors: { _: '창이 열리지 않음' } };
      Object.keys(vals || {}).forEach(k => { field(k).value = vals[k] == null ? '' : String(vals[k]); });
      st.checked = checked || {};
      st.errors = {};
      try { st.submit({ preventDefault() {}, target: form }); } finally { ctx.document = saved; }
      return { done: el.hidden === true, errors: Object.assign({}, st.errors) };
    },
    close() { ctx.document = saved; },
  };
}
// 화면 단추의 누름(목록의 data-* 단추): closest('button')이나 closest('[data-x]')에 그 단추를 돌려줌
function clickTarget(attrs) {
  const b = {
    id: attrs.id || '', disabled: false, checked: !!attrs.checked,
    getAttribute: k => (k in attrs ? attrs[k] : null), hasAttribute: k => k in attrs, matches() { return false; },
    closest(s) {
      if (s === 'button') return b;
      const m = /^(?:button)?\[([\w-]+)\]$/.exec(s);
      if (m) return m[1] in attrs ? b : null;
      return null;
    },
  };
  return b;
}
// 화면 스크립트를 그 사람으로 가짜 문서에 올림(위 page를 그대로 씀). 전에 AC-46 lib의 page였고, 위 page와 받는 값이 달라 이름을 pageAs로 나눔
//   pageAs(env, '화면.js', 사람, 'id=..', preset)
function pageAs(env, file, user, query, preset) {
  return page(env, file, '?role=' + user.role + (query ? '&' + query : ''), { user: user, preset: preset || [] });
}

/* ======================================================================
 * 5. 통계 화면을 그 사람으로 여는 stats (전에 AC-49.js의 lib. AC-49, AC-50이 씀)
 * ====================================================================== */
const PRE = [['#f-period', { value: 'last12' }], ['#f-service', { value: '' }], ['#f-unit', { value: '' }]];
// 통계 화면을 그 사람으로 엶. hook: 데이터 고치기(harness의 hook)
function stats(h, userId, hook, role) {
  const env = h.fresh({ role: role || 'SALES', hook });
  if (!env.ctx.getComputedStyle) env.ctx.getComputedStyle = () => ({ fontSize: '10px', getPropertyValue: () => '' });
  const u = env.U(userId, role); // role을 주면 그 역할로(겸직 계정의 다른 역할), 없으면 계정의 첫 역할
  const dom = pageAs(env, 'stats.js', u, '', PRE);
  return { env, dom, u, text: sel => strip(dom.q(sel).innerHTML) + ' ' + strip(dom.q(sel).textContent) };
}

module.exports = {
  // 1. 함수 글 꺼내기, 계약 등록 화면
  src, fnSrc, stmtSrc, compile, nc, ncState, hasErr,
  // 2. 가짜 문서에 화면 올리기, 결재 문서 누르기
  page, review, doStep,
  // 3. 가짜 화면 도우미
  openPage, fakeForm, submit, stripTags, env0,
  // 4. 시계, 글 다듬기, 입력 창, 단추
  fixClock, strip, step, stubEl, withModal, clickTarget, pageAs,
  // 5. 통계 화면
  stats,
};
