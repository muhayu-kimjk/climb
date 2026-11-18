// 통제 시험(06 통제 목록 2장 AC-01~AC-55)을 시안 코드로 돌려 보는 틀 (2026-11-13 주말 점검 W2)
//   시안의 mock-data.js, common.js, control-checks.js를 node의 가짜 브라우저에 올려 함수를 직접 부름
//   실제 시스템의 서버 시험을 대신하지 않음. 시안이 화면에서 막는 것과 셈이 문서대로인지 보는 정답지
// 쓰는 법: const h = require('./harness'); const env = h.fresh({ role: 'SALES', hook: D => { ... } });
//   env.D(시안 데이터), env.C(공통 기능), env.X(통제 점검 기능), env.U('u_sales1')(그 계정의 사람), env.store(저장소)
//   hook: 데이터를 불러온 직후, common.js 전에 고침(예시 계약을 바꿔 보는 시험)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const JS = path.join(__dirname, '..', '..', 'prototype', 'assets', 'js');

function anyFn() {
  const f = function () { return proxy; };
  const proxy = new Proxy(f, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => '';
      if (k === 'length') return 0;
      if (k === 'matches') return false;
      if (k === 'then') return undefined;
      return proxy;
    },
    apply() { return proxy; },
    construct() { return proxy; },
  });
  return proxy;
}

function fresh(opt) {
  opt = opt || {};
  const store = Object.assign({}, opt.store || {});
  const toasts = [];
  const ctx = {
    console,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    location: { search: '?role=' + (opt.role || 'SUPER'), href: '', pathname: '/index.html', replace() {} },
    document: anyFn(),
    navigator: { userAgent: 'node' },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    requestAnimationFrame: () => 0,
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    URLSearchParams, Date, Math, JSON, Promise, Proxy,
  };
  ['HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement', 'HTMLElement', 'Element', 'Node'].forEach(n => {
    ctx[n] = function () {};
    Object.defineProperty(ctx[n].prototype, 'value', { get() { return ''; }, set(v) {}, configurable: true });
  });
  ctx.MutationObserver = function () { return { observe() {}, disconnect() {} }; };
  ctx.window = ctx;
  ctx.addEventListener = function () {};
  ctx.removeEventListener = function () {};
  vm.createContext(ctx);
  const run = f => vm.runInContext(fs.readFileSync(path.join(JS, f), 'utf8'), ctx, { filename: f });
  run('mock-data.js');
  if (opt.hook) opt.hook(ctx.CLIMB_DATA);
  run('common.js');
  run('control-checks.js');
  const D = ctx.CLIMB_DATA, C = ctx.CLIMB, X = ctx.CLIMB_CTL;
  // 토스트(거절 안내 등)를 모아 시험에서 볼 수 있게 함
  if (C && typeof C.toast === 'function') {
    const orig = C.toast;
    C.toast = function (msg, warn) { toasts.push({ msg: String(msg), warn: !!warn }); try { return orig.apply(this, arguments); } catch (e) { return undefined; } };
  }
  // 계정 번호로 사람 만들기(역할은 그 계정의 첫 역할, 최고관리자는 SUPER)
  function U(id, role) {
    const a = (D.ACCOUNTS || []).find(x => x.id === id) || {};
    const r = role || (id === 'u_super' ? 'SUPER' : (a.roles || [])[0] || (D.USERS[id] || {}).role);
    return Object.assign({ id: id }, D.USERS[id] || {}, { role: r, base: D.ROLE_BASE[r] || r, dept: a.dept || (D.USERS[id] || {}).dept, roles: a.roles });
  }
  return { D, C, X, U, ctx, store, toasts, contract: id => D.CONTRACTS.find(c => c.id === id) };
}

module.exports = { fresh };
