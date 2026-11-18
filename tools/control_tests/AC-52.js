// AC-52 고객사 티어 단가 (CTL-140, 06 통제 목록 2장) 시험 (2026-11-13 주말 점검 W2)
//   기대 동작: 표준 단가는 기안한 날(견적은 오늘) 가격 줄에 그 거래처 고객사 티어의 단가가 있으면 그 값, 없으면 기본 단가다.
//     줄에 쓴 티어가 남고, 그 뒤 티어나 티어 단가가 바뀌어도 이미 기안한 계약과 저장한 견적은 그대로다.
//     티어와 티어 단가는 관리자만 사유(티어 단가는 품의 링크와 적용 시작일도)와 함께 바꾸고 이력에 전후 값이 남는다.
//     (v0.13) 티어 변경은 설정 변경 확인(SCR-65)에서 재무 리더가 확인(바꾼 사람은 못 함). (v0.14) 티어가 다른 거래처 합치기도 대상
//   시안 코드: common.js customerTier, stdLine, stdPriceText. control-checks.js tierInfo, mergeTierInfo, settingChanges, canConfirm, saveCheck.
//     (2026-11-14 주말 점검 W7) control-checks.js tierSince, tierSinceText: 티어를 바꾼 뒤 그 거래처로 기안한 계약과 출력한 견적(값 칸, "품의와 다름" 넘김 글)
//     (2026-11-14 주말 점검, 코드 다시 보기 common-01) tierSince(x, viewer): 볼 수 없는 열람 제한 계약은 번호 없이 건수만(화면 시험은 AC-40)
//     거래처 관리(admin-customers.js), 가격 기준 관리(admin-prices.js), 설정 변경 확인(config-review.js) 화면을 가짜 문서에 올려 창을 채워 봄
'use strict';
const lib = require('./lib');
const { fixClock, withModal, clickTarget, pageAs: page, strip } = lib;

const PLAG = 'CK_CAMPUS_PLAG';
const cust = (env, id) => env.D.CUSTOMERS.find(x => x.id === id);
function setup(h, role) { const env = h.fresh({ role: role || 'ADMIN' }); fixClock(env); return env; }
// 거래처 관리 화면(그 사람으로)
function custPage(env, userId, role) { return page(env, 'admin-customers.js', env.U(userId, role)); }
// 거래처 고치기 창: 티어만 바꾸고 사유를 적어 저장
function editTier(env, dom, id, tier, reason) {
  const cu = cust(env, id);
  const m = withModal(env, () => dom.fire('#content', 'click', { target: clickTarget({ 'data-edit': id }) }));
  if (!m.opened) return { opened: false, done: false };
  const r = m.submit({ cuName: cu.name, bizNo: cu.bizNo, use: String(cu.use), tier: tier, reason: reason });
  return { opened: true, done: r.done, errors: r.errors };
}
// 거래처 합치기: 목록에서 고르고 합치기 단추, 남길 거래처와 사유
function merge(env, dom, ids, keep, reason) {
  ids.forEach(id => dom.fire('#content', 'change', { target: clickTarget({ 'data-pick': id, checked: true }) }));
  const m = withModal(env, () => dom.fire('#content', 'click', { target: clickTarget({ id: 'btn-merge' }) }));
  if (!m.opened) return { opened: false, done: false };
  const r = m.submit({ reason: reason }, { keep: keep });
  return { opened: true, done: r.done, errors: r.errors };
}
// 맞는 검증 숫자의 사업자등록번호(아직 없는 번호)
function freeBizNo(env, head) {
  for (let d = 0; d < 10; d++) { const v = head + d; if (env.C.isBizNo(v) && !env.D.CUSTOMERS.some(x => x.bizNo === v)) return v; }
  return null;
}
const custRow = (env, pred) => env.X.settingChanges({ areas: ['CUSTOMER'] }).find(pred);

module.exports = {
  ac: 'AC-52',
  title: '고객사 티어 단가',
  tests: [
    {
      name: '티어 1 거래처(누리교육재단 C-0004)로 표절검사를 고르면 표준 단가 10,800,000원과 "티어 1 단가. 기본 12,000,000원", 티어 3과 티어 없는 새 거래처는 12,000,000원',
      kind: 'ok',
      run(h) {
        const env = setup(h, 'SALES');
        const { C, D } = env;
        const t1 = C.stdLine({ feature: PLAG, qty: 1 }, { day: D.TODAY, customer: cust(env, 'C-0004'), fresh: true });
        if (t1.unitPrice !== 10800000 || t1.tier !== 'T1') return '티어 1 표준 단가가 ' + t1.unitPrice + '원, 티어 ' + t1.tier;
        const txt = C.stdPriceText(t1);
        if (txt.indexOf('티어 1 단가. 기본 12,000,000원') < 0) return '표준 단가 설명에 티어와 기본 단가가 없음: ' + txt;
        const t3 = C.stdLine({ feature: PLAG, qty: 1 }, { day: D.TODAY, customer: cust(env, 'C-0001'), fresh: true });
        if (t3.unitPrice !== 12000000 || t3.tier) return '티어 3 거래처의 표준 단가가 ' + t3.unitPrice + '원(티어 단가 ' + t3.tier + ')';
        const nw = C.stdLine({ feature: PLAG, qty: 1 }, { day: D.TODAY, customer: null, fresh: true });
        if (nw.unitPrice !== 12000000) return '티어 없는 새 거래처의 표준 단가가 ' + nw.unitPrice + '원';
        // 계약 등록에서 기안하면 줄에 쓴 티어와 표준 단가가 남음
        const p = lib.nc(env, lib.ncState({ me: env.U('u_sales2'), vals: { customer: 'C:C-0004', counterparty: '누리교육재단', bizNo: cust(env, 'C-0004').bizNo },
          lines: [{ feature: PLAG, qty: 1, amount: '10,800,000' }] }));
        const r = p.submit('2610CL961');
        if (r.errors.length) return '기안이 막힘: ' + r.errors.join(' / ');
        const l = r.rec.products[0];
        if (l.tier !== 'T1' || l.listPrice !== 10800000) return '줄에 쓴 티어나 표준 단가가 남지 않음: ' + l.tier + ', ' + l.listPrice;
        return true;
      },
    },
    {
      name: '관리자가 거래처 고치기에서 티어를 바꾸면 관리자 변경 이력에 "고객사 티어: 티어 2 → 티어 1"이 남고 설정 변경 확인에 확인 전으로 나옴(가온테크 C-0006)',
      kind: 'ok',
      run(h) {
        const env = setup(h, 'ADMIN');
        const { C, X } = env;
        const dom = custPage(env, 'u_admin');
        if (dom.error) return '거래처 관리 화면을 열지 못함: ' + dom.error.message;
        const r = editTier(env, dom, 'C-0006', 'T1', '재학생 수 기준 다시 분류(시험)');
        if (!r.opened) return '고치기 창이 열리지 않음';
        if (!r.done) return '저장되지 않음: ' + JSON.stringify(r.errors);
        const e = C.adminLog(['CUSTOMER'])[0];
        if (e.change.indexOf('고객사 티어: 티어 2 → 티어 1') < 0) return '이력에 전후 티어가 없음: ' + e.change;
        if (cust(env, 'C-0006').tier !== 'T1') return '거래처 티어가 바뀌지 않음';
        const x = custRow(env, y => y.at === e.at && y.target === e.target);
        if (!x || !X.needsCheck(x) || X.checkOf(x.id)) return '설정 변경 확인에 확인 전으로 나오지 않음';
        return true;
      },
    },
    {
      name: '예시 변경(2026-10-19 10:40 별가람대학교 C-0025)이 확인 전이고 값 칸에 "11,400,000원(티어 2 단가) → 10,800,000원(티어 1 단가)", 재무 리더가 "품의와 다름"을 남기면 컴플라이언스로 넘어감',
      kind: 'ok',
      run(h) {
        const env = setup(h, 'FIN_LEAD');
        const { X, U } = env;
        const x = custRow(env, y => y.at === '2026-10-19 10:40' && /C-0025/.test(y.target));
        if (!x) return '예시 변경이 설정 변경 묶음에 없음';
        if (!X.needsCheck(x) || X.checkOf(x.id)) return '예시 변경이 확인 전 대상이 아님';
        const it = (x.items || []).find(i => /표절검사/.test(i.label));
        if (!it || it.before !== '11,400,000원(티어 2 단가)' || it.after !== '10,800,000원(티어 1 단가)') return '값 칸의 표준 단가 변화가 다름: ' + JSON.stringify(it);
        const dom = page(env, 'config-review.js', U('u_seojin_ma'));
        if (dom.error) return '설정 변경 확인 화면을 열지 못함: ' + dom.error.message;
        const issues0 = X.issuesAll().length;
        const m = withModal(env, () => dom.fire('#content', 'click', { target: clickTarget({ 'data-check': x.id }) }));
        if (!m.opened) return '재무 리더에게 확인 창이 열리지 않음';
        if (strip(m.html).indexOf('품의와 다름') < 0) return '결과 이름이 "품의와 다름"이 아님';
        const r = m.submit({ note: '품의에는 티어 2 유지로 되어 있음(시험)' }, { result: 'DIFF' });
        if (!r.done) return '확인이 저장되지 않음: ' + JSON.stringify(r.errors);
        const ck = X.checkOf(x.id);
        if (!ck || ck.label !== '품의와 다름' || ck.by !== 'u_seojin_ma') return '남은 확인이 다름: ' + JSON.stringify(ck);
        const is = X.issuesAll();
        if (is.length !== issues0 + 1 || is[0].source !== 'CONFIG' || is[0].title.indexOf('(고객사 티어)') < 0) return '컴플라이언스로 넘어간 일이 없음';
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검 W7) 티어 변경 뒤 확인 전에 기안한 계약과 출력한 견적을 값 칸과 "품의와 다름" 넘김 글에 함께 보임(control-checks.js tierSince, CTL-78)
      name: '티어를 바꾼 뒤 그 거래처로 기안한 계약과 출력한 견적의 번호가 설정 변경 확인의 값 칸에 보이고, "품의와 다름"이면 컴플라이언스 넘김 글에 들어감(별가람대학교 C-0025)',
      kind: 'ok',
      run(h) {
        // 시험용 견적: 바꾼 뒤(10-19 11:00) 출력한 별가람대학교 견적 1판(예시 견적을 복사해 거래처만 바꿈)
        const env = h.fresh({ role: 'FIN_LEAD', hook: D => {
          const q = JSON.parse(JSON.stringify(D.QUOTES[0]));
          Object.assign(q, { no: 'QT2610-952', ver: 1, customer: 'C-0025', name: '별가람대학교', bizNo: '312-82-44080', opp: '', issues: [{ at: '2026-10-19 11:00', by: 'u_sales1', total: q.issues[0].total, sealed: false }] });
          D.QUOTES.push(q);
        } });
        fixClock(env);
        const { X, U, D } = env;
        const row = () => custRow(env, y => y.at === '2026-10-19 10:40' && /C-0025/.test(y.target));
        // 견줌: 바꾸기 전(10-18)에 기안한 2610CL009는 넣지 않음
        const s0 = X.tierSince(row());
        if (!s0) return '예시 티어 변경에 바꾼 뒤 목록이 없음(거래처 번호를 읽지 못함)';
        if (s0.contracts.indexOf('2610CL009') > -1) return '바꾸기 전에 기안한 2610CL009가 바꾼 뒤 계약에 들어감';
        if (s0.quotes.indexOf('QT2610-952 1판') < 0) return '바꾼 뒤 출력한 견적이 없음: ' + JSON.stringify(s0);
        // 바꾼 뒤(오늘 20시) 별가람대학교로 기안
        const p = lib.nc(env, lib.ncState({ me: U('u_sales1'), vals: { customer: 'C:C-0025', counterparty: '별가람대학교', bizNo: '312-82-44080', opportunity: '2610SU952' },
          lines: [{ feature: PLAG, qty: 1, amount: '10,800,000' }] }));
        const r = p.submit('2610CL952');
        if (r.errors.length) return '기안이 막힘: ' + r.errors.join(' / ');
        if (!D.CONTRACTS.some(c => c.id === '2610CL952')) return '기안한 계약이 목록에 없음(시험 전제)';
        const s = X.tierSince(row());
        if (s.contracts.indexOf('2610CL952') < 0) return '바꾼 뒤 기안한 계약이 목록에 없음: ' + JSON.stringify(s);
        const dom = page(env, 'config-review.js', U('u_seojin_ma'));
        if (dom.error) return '설정 변경 확인 화면을 열지 못함: ' + dom.error.message;
        const cell = strip(dom.q('#rows').innerHTML);
        if (!/바꾼 뒤 기안한 계약 1건\(2610CL952\), 출력한 견적 1건\(QT2610-952 1판\)/.test(cell)) return '값 칸에 바꾼 뒤 계약과 견적이 없음: ' + (cell.match(/.{0,60}바꾼 뒤.{0,80}/) || [cell.slice(0, 200)])[0];
        const issues0 = X.issuesAll().length;
        const m = withModal(env, () => dom.fire('#content', 'click', { target: clickTarget({ 'data-check': row().id }) }));
        if (!m.opened) return '확인 창이 열리지 않음';
        if (strip(m.html).indexOf('2610CL952') < 0) return '확인 창에 바꾼 뒤 계약이 없음';
        const sv = m.submit({ note: '품의에는 티어 2 유지(시험).' }, { result: 'DIFF' });
        if (!sv.done) return '확인이 저장되지 않음: ' + JSON.stringify(sv.errors);
        const is = X.issuesAll();
        if (is.length !== issues0 + 1) return '컴플라이언스로 넘어간 일이 없음';
        if (!/품의에는 티어 2 유지\(시험\)\. 바꾼 뒤 기안한 계약 1건\(2610CL952\), 출력한 견적 1건\(QT2610-952 1판\)/.test(is[0].note || '')) return '넘김 글에 바꾼 뒤 계약과 견적 번호가 없음: ' + is[0].note;
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검 W7) 바꾼 뒤 목록은 그 거래처의 것만, 같은 거래처의 다음 티어 변경 전까지만
      name: '바꾼 뒤 목록에는 다른 거래처의 계약과 같은 거래처의 다음 티어 변경 뒤에 기안한 계약이 들어가지 않음(가온테크 C-0006)',
      kind: 'deny',
      run(h) {
        const env = setup(h, 'ADMIN');
        const { C, X, U, D } = env;
        // 금액은 그때 티어의 표준 단가 그대로(2, 3번 예): 티어 1 10,800,000원, 티어 2 11,400,000원
        const draft = (no, cid, name, amount) => lib.nc(env, lib.ncState({ me: U('u_sales1'), vals: { customer: 'C:' + cid, counterparty: name, bizNo: cust(env, cid).bizNo, opportunity: '2610SU' + no.slice(-3) },
          lines: [{ feature: PLAG, qty: 1, amount: amount }] })).submit(no);
        C.adminSave('CUSTOMER', '가온테크(C-0006)', '고객사 티어: 티어 2 → 티어 1', '시험 1', { k: 'CUSTOMER_EDIT', id: 'C-0006', set: { tier: 'T1' } });
        const r1 = draft('2610CL953', 'C-0006', '가온테크', '10,800,000');
        const r2 = draft('2610CL954', 'C-0004', '누리교육재단', '10,800,000'); // 다른 거래처
        if (r1.errors.length || r2.errors.length) return '기안이 막힘: ' + r1.errors.concat(r2.errors).join(' / ');
        C.adminSave('CUSTOMER', '가온테크(C-0006)', '고객사 티어: 티어 1 → 티어 2', '시험 2', { k: 'CUSTOMER_EDIT', id: 'C-0006', set: { tier: 'T2' } });
        const r3 = draft('2610CL955', 'C-0006', '가온테크', '11,400,000'); // 다음 티어 변경 뒤
        if (r3.errors.length) return '기안이 막힘: ' + r3.errors.join(' / ');
        const rows = X.settingChanges({ areas: ['CUSTOMER'] }).filter(y => /C-0006/.test(y.target) && y.tier).sort((a, b) => a.at.localeCompare(b.at));
        if (rows.length !== 2) return '가온테크 티어 변경 줄이 ' + rows.length + '개(시험 전제)';
        const a = X.tierSince(rows[0]), b = X.tierSince(rows[1]);
        if (!a || a.contracts.join(',') !== '2610CL953') return '첫 변경 뒤 목록이 2610CL953만이 아님: ' + JSON.stringify(a);
        if (!a.until) return '첫 변경 뒤 목록에 다음 티어 변경 일시가 없음';
        if (!b || b.contracts.join(',') !== '2610CL955') return '둘째 변경 뒤 목록이 2610CL955만이 아님: ' + JSON.stringify(b);
        if (D.CONTRACTS.filter(c => c.id === '2610CL954').length !== 1) return '다른 거래처 계약이 기안되지 않음(시험 전제)';
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검, 코드 다시 보기 common-01) 바꾼 뒤 목록은 거래처 이름 옆에 보여, 보는 사람이 볼 수 없는 열람 제한 계약은 번호를 빼고 건수만(hidden).
      //   넘김 글처럼 여러 사람이 읽는 글('SHARED')은 열람 제한 계약 모두 건수만. 해솔테크(C-0030) 티어 변경(09-05) 뒤 기안한 열람 제한 계약 2609CL008과,
      //   오늘 기안한 열람 제한이 아닌 시험 계약 2610CL956을 함께 봄(화면 시험은 AC-40)
      name: '바꾼 뒤 목록: 재무 리더 마서진에게는 볼 수 없는 2609CL008이 번호 없이 "열람 제한 계약 1건"으로, 감사 열람에게는 번호로, 넘김 글(SHARED)은 누구든 건수만',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'FIN_LEAD', hook: D => {
          D.ADMIN_LOG.push({ at: '2026-09-05 10:00', by: 'u_admin', area: 'CUSTOMER', target: '해솔테크(C-0030)', change: '고객사 티어: 티어 2 → 티어 3',
            reason: '시험', op: { k: 'CUSTOMER_EDIT', id: 'C-0030', set: { name: '해솔테크', bizNo: '220-81-55239', use: true, tier: 'T3' } } });
        } });
        fixClock(env);
        const { C, X, U } = env;
        const cu = cust(env, 'C-0030');
        const p = lib.nc(env, lib.ncState({ me: U('u_sales1'), vals: { customer: 'C:C-0030', counterparty: cu.name, bizNo: cu.bizNo, opportunity: '2610SU956' },
          lines: [{ feature: PLAG, qty: 1, amount: '12,000,000' }] }));
        const r = p.submit('2610CL956');
        if (r.errors.length) return '시험 계약 기안이 막힘: ' + r.errors.join(' / ');
        const row = custRow(env, y => y.target === '해솔테크(C-0030)' && y.tier);
        if (!row) return '해솔테크 티어 변경 줄이 없음(시험 전제)';
        const fin = U('u_seojin_ma'), au = U('u_chaeyul_in');
        if (C.canView(env.contract('2609CL008'), fin) || !C.canView(env.contract('2609CL008'), au)) return '시험 전제: 마서진은 2609CL008을 못 보고 감사 열람은 봐야 함';
        const a = X.tierSince(row, fin);
        if (a.contracts.indexOf('2609CL008') > -1 || a.hidden !== 1 || a.contracts.indexOf('2610CL956') < 0) return '마서진의 목록이 다름: ' + JSON.stringify(a);
        const t = X.tierSinceText(a);
        if (t.indexOf('바꾼 뒤 기안한 계약 2건(2610CL956, 열람 제한 계약 1건)') !== 0) return '마서진의 한 줄 글이 다름: ' + t;
        if (X.tierSince(row).hidden !== 1) return '사람을 주지 않으면 지금 사람(마서진)으로 가리지 않음';
        const b = X.tierSince(row, au);
        if (b.contracts.indexOf('2609CL008') < 0 || b.hidden !== 0) return '견줌: 감사 열람의 목록에 2609CL008이 없음: ' + JSON.stringify(b);
        const s = X.tierSince(row, 'SHARED');
        if (s.contracts.indexOf('2609CL008') > -1 || s.hidden !== 1 || s.contracts.indexOf('2610CL956') < 0) return '넘김 글(SHARED) 목록이 다름: ' + JSON.stringify(s);
        if (/2609CL008/.test(X.tierSinceText(s))) return '넘김 글에 열람 제한 계약 번호가 남음: ' + X.tierSinceText(s);
        return true;
      },
    },
    {
      name: '티어 없이 한 거래처 추가는 설정 변경 확인 대상이 아님',
      kind: 'ok',
      run(h) {
        const env = setup(h, 'ADMIN');
        const { X } = env;
        const dom = custPage(env, 'u_admin');
        const no = freeBizNo(env, '214-86-1234');
        if (!no) return '시험용 사업자등록번호를 만들지 못함';
        const m = withModal(env, () => dom.fire('#content', 'click', { target: clickTarget({ id: 'btn-add' }) }));
        if (!m.opened) return '추가 창이 열리지 않음';
        const r = m.submit({ cuName: '시험거래처', bizNo: no, tier: '', reason: '조달 예정 기관 미리 등록(시험)' });
        if (!r.done) return '추가가 저장되지 않음: ' + JSON.stringify(r.errors);
        const x = custRow(env, y => /시험거래처/.test(y.target));
        if (!x) return '추가가 설정 변경 묶음에 없음';
        if (X.needsCheck(x)) return '티어 없이 한 추가가 재무 리더 확인 대상이 됨';
        return true;
      },
    },
    {
      name: '티어 1 거래처(완료 계약 없음, 한빛대학교 C-0017)를 티어 3 거래처(바름고등학교 C-0021)에 합치면 확인 전 대상이고 값 칸이 "10,800,000원(티어 1 단가) → 12,000,000원(기본 단가)", 결과는 "품의와 맞음, 다름"',
      kind: 'ok',
      run(h) {
        const env = setup(h, 'ADMIN');
        const { X } = env;
        const dom = custPage(env, 'u_admin');
        const r = merge(env, dom, ['C-0017', 'C-0021'], 'C-0021', '같은 곳을 다른 이름으로 등록(시험)');
        if (!r.opened) return '합치기 창이 열리지 않음';
        if (!r.done) return '합치기가 저장되지 않음: ' + JSON.stringify(r.errors);
        const x = custRow(env, y => /^합치기/.test(y.change) && /C-0017/.test(y.change));
        if (!x) return '합치기가 설정 변경 묶음에 없음';
        if (!X.needsCheck(x) || X.checkOf(x.id)) return '티어가 다른 합치기가 확인 전 대상이 아님';
        const it = (x.items || []).find(i => /표절검사/.test(i.label));
        if (!it || it.before !== '10,800,000원(티어 1 단가)' || it.after !== '12,000,000원(기본 단가)') return '값 칸의 표준 단가 변화가 다름: ' + JSON.stringify(it);
        const rk = X.resultKey(x);
        if (X.resultLabel(rk, 'MATCH') !== '품의와 맞음' || X.resultLabel(rk, 'DIFF') !== '품의와 다름') return '결과 이름이 "품의와 맞음, 다름"이 아님: ' + rk;
        return true;
      },
    },
    {
      name: '티어가 같고 완료 계약이 없는 합치기(소담에듀 C-0014 → 바름고등학교 C-0021, 둘 다 티어 3)는 대상이 아님',
      kind: 'ok',
      run(h) {
        const env = setup(h, 'ADMIN');
        const dom = custPage(env, 'u_admin');
        const r = merge(env, dom, ['C-0014', 'C-0021'], 'C-0021', '같은 곳(시험)');
        if (!r.done) return '합치기가 저장되지 않음: ' + JSON.stringify(r.errors);
        const x = custRow(env, y => /^합치기/.test(y.change) && /C-0014/.test(y.change));
        if (!x) return '합치기가 설정 변경 묶음에 없음';
        if (env.X.needsCheck(x)) return '티어가 같고 완료 계약이 없는 합치기가 대상이 됨';
        return true;
      },
    },
    {
      name: '관리자가 아닌 사람은 거래처의 티어나 가격 줄의 티어 단가를 바꾸지 못함(영업은 화면이 막히고, 컴플라이언스와 영업지원은 고치기 단추가 없고 눌러도 창이 열리지 않음)',
      kind: 'deny',
      // (2026-11-13 약한 시험 고침) 전에는 하위 확인 다섯 가운데 셋이 무엇을 하든 통과했음:
      //   가짜 요소는 처음부터 감춤(hidden: true)이라 관리자로 열어도 #content와 #btn-add가 감춰진 것으로 보였고, 고치기 단추는 실제 목록(#rows)이 아닌 곳에서 찾았음.
      //   이제 화면 HTML처럼 #content와 #btn-add를 보이는 채로 시작하고(preset), 같은 확인을 관리자로도 돌려 견줌
      //   ① 영업: #rows가 비고 #notice에 "거래처 관리는 관리자와 컴플라이언스 담당자가 씁니다" ② 컴플라이언스: #rows에 거래처는 있고 data-edit가 없음
      //   ③ 영업지원: #intro-sub에 "영업지원은 볼 수만 있습니다", #rows에 data-change가 없고 가격 추가 단추가 감춰짐. 관리자는 셋 모두 반대
      run(h) {
        const SHOWN = [['#content', { hidden: false }], ['#btn-add', { hidden: false }]]; // 화면 HTML의 처음 상태(감추지 않음)
        const open = (role, userId, file) => { const env = setup(h, role); return { env, dom: page(env, file, env.U(userId, role), '', SHOWN) }; };
        const html = (dom, sel) => String(dom.q(sel).innerHTML || '');
        const text = (dom, sel) => strip(html(dom, sel) + ' ' + String(dom.q(sel).textContent || ''));
        // 견줌: 관리자의 거래처 관리는 본문이 보이고 안내가 없으며 줄마다 고치기 단추(data-edit)가 있음
        let { env, dom } = open('ADMIN', 'u_admin', 'admin-customers.js');
        if (dom.error) return '관리자 거래처 관리 화면을 열지 못함: ' + dom.error.message;
        if (dom.q('#content').hidden !== false || text(dom, '#notice') || !/data-edit="C-0006"/.test(html(dom, '#rows'))) return '견줌 실패: 관리자에게 거래처 관리 본문이나 고치기 단추가 보이지 않음(시험 확인)';
        // ① 영업: 거래처 관리 화면이 막힘
        ({ env, dom } = open('SALES', 'u_sales1', 'admin-customers.js'));
        if (dom.q('#content').hidden !== true) return '영업에게 거래처 관리 본문이 보임';
        if (html(dom, '#rows')) return '영업에게 거래처 목록을 그림';
        if (text(dom, '#notice').indexOf('거래처 관리는 관리자와 컴플라이언스 담당자가 씁니다') < 0) return '영업에게 거래처 관리 안내가 보이지 않음: ' + text(dom, '#notice').slice(0, 60);
        // ② 컴플라이언스: 화면은 보이지만 고치기 단추가 없고, 눌러도 창이 열리지 않음
        ({ env, dom } = open('COMPLIANCE', 'u_seoyul_ban', 'admin-customers.js'));
        if (dom.error) return '컴플라이언스 거래처 관리 화면을 열지 못함: ' + dom.error.message;
        if (html(dom, '#rows').indexOf('C-0006') < 0) return '컴플라이언스에게 거래처 목록이 보이지 않음(보기는 되어야 함)';
        if (/data-edit=/.test(html(dom, '#rows'))) return '컴플라이언스에게 고치기 단추가 보임';
        if (dom.q('#btn-add').hidden !== true) return '컴플라이언스에게 거래처 추가 단추가 보임';
        const r = editTier(env, dom, 'C-0006', 'T1', '시험');
        if (r.opened || cust(env, 'C-0006').tier !== 'T2') return '컴플라이언스가 거래처 티어를 바꿈';
        // 견줌: 관리자의 가격 기준 관리는 줄마다 바꾸기 단추가 있고 가격 추가 단추가 보이며 "볼 수만" 안내가 없음
        ({ env, dom } = open('ADMIN', 'u_admin', 'admin-prices.js'));
        if (dom.error) return '관리자 가격 기준 관리 화면을 열지 못함: ' + dom.error.message;
        if (!/data-change=/.test(html(dom, '#rows')) || dom.q('#btn-add').hidden !== false || text(dom, '#intro-sub').indexOf('볼 수만') > -1) return '견줌 실패: 관리자에게 바꾸기, 가격 추가 단추가 없거나 "볼 수만" 안내가 보임(시험 확인)';
        // ③ 영업지원: 가격 기준 관리는 보기만(바꾸기 단추와 가격 추가 단추가 없음)
        ({ env, dom } = open('SALES_ADMIN', 'u_sadmin', 'admin-prices.js'));
        if (dom.error) return '영업지원 가격 기준 관리 화면을 열지 못함: ' + dom.error.message;
        if (!html(dom, '#rows')) return '영업지원에게 가격 기준 목록이 보이지 않음(보기는 되어야 함)';
        if (/data-change=/.test(html(dom, '#rows'))) return '영업지원에게 가격 줄 바꾸기 단추가 보임';
        if (dom.q('#btn-add').hidden !== true) return '영업지원에게 가격 추가 단추가 보임';
        if (text(dom, '#intro-sub').indexOf('영업지원은 볼 수만 있습니다') < 0) return '영업지원에게 "영업지원은 볼 수만 있습니다" 안내가 없음: ' + text(dom, '#intro-sub').slice(0, 60);
        return true;
      },
    },
    {
      name: '영업지원이 가격 기준 관리의 바꾸기나 가격 추가를 눌러도(감춘 단추를 눌러도) 창이 열리지 않음(거래처 관리처럼 누름 처리에서도 겹으로 막음)',
      kind: 'deny',
      run(h) {
        const env = setup(h, 'SALES_ADMIN');
        const dom = page(env, 'admin-prices.js', env.U('u_sadmin'));
        if (dom.error) return '영업지원 가격 기준 관리 화면을 열지 못함: ' + dom.error.message;
        const p0 = env.D.PRICE_ROWS.length;
        const a = withModal(env, () => dom.fire('#content', 'click', { target: clickTarget({ 'data-change': PLAG }) }));
        if (a.opened) {
          const r = a.submit({ price: '12,000,000', cap: '0', tier_T1: '9,000,000', tier_T2: '11,400,000', tier_T3: '', validFrom: '2026-10-20', docUrl: 'https://gw.muhayu.com/approval/T52B', docNo: '', reason: '시험' });
          return '영업지원이 바꾸기를 누르자 창이 열림' + (r.done && env.D.PRICE_ROWS.length > p0 ? '. 저장하자 티어 단가가 바뀌고 이력의 바꾼 사람이 ' + env.D.ADMIN_LOG[env.D.ADMIN_LOG.length - 1].by : '');
        }
        const b = withModal(env, () => dom.fire('#content', 'click', { target: clickTarget({ id: 'btn-add' }) }));
        if (b.opened) { b.close(); return '영업지원이 감춘 가격 추가 단추를 누르자 창이 열림'; }
        return true;
      },
    },
    {
      name: '사유 없이 티어를 바꾸거나 품의 링크 없이 티어 단가를 바꾸면 저장되지 않음',
      kind: 'deny',
      run(h) {
        const env = setup(h, 'ADMIN');
        const { C, D } = env;
        const n0 = D.ADMIN_LOG.length;
        const dom = custPage(env, 'u_admin');
        const r = editTier(env, dom, 'C-0006', 'T1', '  ');
        if (!r.opened) return '고치기 창이 열리지 않음';
        if (r.done || !r.errors.reason) return '사유 없이 티어 변경이 저장됨';
        if (cust(env, 'C-0006').tier !== 'T2' || D.ADMIN_LOG.length !== n0) return '저장하지 않았는데 티어나 이력이 바뀜';
        // 가격 기준 관리: 표절검사 티어 1 단가만 바꾸고 품의 링크를 비움
        const pd = page(env, 'admin-prices.js', env.U('u_admin'));
        const m = withModal(env, () => pd.fire('#content', 'click', { target: clickTarget({ 'data-change': PLAG }) }));
        if (!m.opened) return '가격 바꾸기 창이 열리지 않음';
        const p0 = D.PRICE_ROWS.length;
        const s = m.submit({ price: '12,000,000', cap: '0', tier_T1: '10,500,000', tier_T2: '11,400,000', tier_T3: '', validFrom: '2026-11-01', docUrl: '', docNo: '', reason: '티어 1 단가 인하(시험)' });
        if (s.done || !s.errors.docUrl) return '품의 링크 없이 티어 단가 변경이 저장됨';
        const s2 = withModal(env, () => pd.fire('#content', 'click', { target: clickTarget({ 'data-change': PLAG }) }))
          .submit({ price: '12,000,000', cap: '0', tier_T1: '10,500,000', tier_T2: '11,400,000', tier_T3: '', validFrom: '', docUrl: 'https://gw.muhayu.com/approval/T52', docNo: '', reason: '티어 1 단가 인하(시험)' });
        if (s2.done || !s2.errors.validFrom) return '적용 시작일 없이 티어 단가 변경이 저장됨';
        if (D.PRICE_ROWS.length !== p0 || C.adminLog().length !== n0) return '저장하지 않았는데 가격 줄이나 이력이 바뀜';
        return true;
      },
    },
    {
      name: '기안한 뒤 거래처의 티어를 바꿔도 이미 기안한 계약의 표준 단가, 할인율, 결재선과 저장한 견적이 바뀌지 않음(새로 기안한 계약, 모든 예시 계약과 견적)',
      kind: 'deny',
      run(h) {
        const env = setup(h, 'ADMIN');
        const { C, D } = env;
        // 가온테크(티어 2)로 오늘 기안: 표절검사 1개 11,400,000원(티어 2 단가)
        const p = lib.nc(env, lib.ncState({ me: env.U('u_sales1'), vals: { customer: 'C:C-0006', counterparty: '가온테크', bizNo: cust(env, 'C-0006').bizNo },
          lines: [{ feature: PLAG, qty: 1, amount: '11,400,000' }] }));
        const r = p.submit('2610CL962');
        if (r.errors.length) return '기안이 막힘: ' + r.errors.join(' / ');
        // 기안한 계약의 표준 단가와 결재선, 저장한 견적의 표준 단가와 금액, 한도 넘음
        const sig = () => JSON.stringify(D.CONTRACTS.filter(c => c.id && c.status !== 'DRAFT' && !c.legacy).map(c => [c.id,
          C.contractStd(c).map(x => x.s ? [x.s.unitPrice, x.s.tier, x.s.std] : null), C.capOver(c).map(x => x.overPp), C.reviewRoute(c).S03[0], C.reviewRoute(c).S03C[0]])
          .concat(C.allQuotes().map(q => [q.no, q.ver, (q.lines || []).map(l => [l.listPrice, l.tier || '', l.unitPrice]), C.quoteTotals(q).total, C.quoteOverCap(q)])));
        const before = sig();
        // 관리자가 모든 거래처의 티어를 바꿈(티어 1 ↔ 티어 2, 티어 3 → 티어 1)
        D.CUSTOMERS.slice().forEach(cu => {
          const to = cu.tier === 'T1' ? 'T2' : 'T1';
          C.adminSave('CUSTOMER', cu.name + '(' + cu.id + ')', '고객사 티어: ' + C.tierLabel(cu.tier || '') + ' → ' + C.tierLabel(to), '시험', { k: 'CUSTOMER_EDIT', id: cu.id, set: { tier: to } });
        });
        if (cust(env, 'C-0006').tier !== 'T1') return '티어 바꾸기가 반영되지 않음(시험 전제)';
        const after = sig();
        if (after === before) return true;
        const A = JSON.parse(before), B = JSON.parse(after);
        const changed = A.filter((x, i) => JSON.stringify(x) !== JSON.stringify(B[i])).map(x => x[0]);
        return '티어를 바꾸자 이미 기안한 계약의 표준 단가나 결재선이 바뀜: ' + changed.join(', ');
      },
    },
    {
      name: '합쳐진 거래처로 기안해도 합쳐진 쪽이 아니라 남긴 거래처의 티어를 씀',
      kind: 'deny',
      run(h) {
        const env = setup(h, 'ADMIN');
        const { C, X } = env;
        // 한빛대(티어 없음, C-0018)를 한빛대학교(티어 1, C-0017)에 합침
        C.adminSave('CUSTOMER', '한빛대학교, 한빛대', '합치기: 한빛대(C-0018) → 한빛대학교(C-0017), 고객사 티어: 없음 → 티어 1', '같은 곳(시험)',
          { k: 'CUSTOMER_MERGE', keep: 'C-0017', ids: ['C-0018'], tiers: { 'C-0017': 'T1', 'C-0018': '' } });
        const merged = cust(env, 'C-0018');
        if (merged.mergedInto !== 'C-0017') return '합치기가 반영되지 않음(시험 전제)';
        if (C.customerTier(merged) !== 'T1') return '합쳐진 거래처의 티어가 남긴 거래처의 티어(티어 1)가 아님: ' + C.customerTier(merged);
        const s = C.stdLine({ feature: PLAG, qty: 1 }, { day: env.D.TODAY, customer: merged, fresh: true });
        if (s.unitPrice !== 10800000) return '합쳐진 거래처로 셈한 표준 단가가 ' + s.unitPrice + '원(남긴 거래처의 티어 1 단가여야 함)';
        // 한쪽이 티어 없음인 합치기도 설정 변경 확인 대상
        const x = custRow(env, y => /^합치기/.test(y.change) && /C-0018/.test(y.change));
        if (!x || !X.needsCheck(x)) return '티어 없음과 티어 1 거래처 합치기가 설정 변경 확인 대상이 아님';
        return true;
      },
    },
    {
      name: '티어를 바꾼 사람(최고관리자 포함)은 자기 변경을 설정 변경 확인에서 확인하지 못함',
      kind: 'deny',
      run(h) {
        const env = setup(h, 'SUPER');
        const { C, X, U } = env;
        C.adminSave('CUSTOMER', '가온테크(C-0006)', '고객사 티어: 티어 2 → 티어 1', '시험', { k: 'CUSTOMER_EDIT', id: 'C-0006', set: { tier: 'T1' } });
        const x = custRow(env, y => y.by === 'u_super' && /C-0006/.test(y.target));
        if (!x || !X.needsCheck(x)) return '최고관리자의 티어 변경이 확인 대상이 아님(시험 전제)';
        const me = X.canConfirm(U('u_super'), x);
        if (me.ok) return '최고관리자가 자기 티어 변경을 확인할 수 있음';
        if (!X.canConfirm(U('u_seojin_ma'), x).ok) return '견줌: 재무 리더도 확인할 수 없음(시험 전제)';
        // 예시: 관리자 윤재민이 바꾼 별가람대학교 변경도 윤재민은 확인 못 함
        const y = custRow(env, z => z.at === '2026-10-19 10:40' && /C-0025/.test(z.target));
        if (X.canConfirm(U('u_admin'), y).ok) return '티어를 바꾼 관리자가 자기 변경을 확인할 수 있음';
        return true;
      },
    },
    {
      name: '재무 리더가 아닌 사람(관리자, 컴플라이언스, 감사 열람, 재무 담당자)은 티어 변경을 확인하지 못함',
      kind: 'deny',
      run(h) {
        const env = setup(h, 'FIN_LEAD');
        const { X, U } = env;
        const x = custRow(env, z => z.at === '2026-10-19 10:40' && /C-0025/.test(z.target));
        if (!x) return '예시 변경이 없음(시험 전제)';
        const who = [U('u_minjae_song', 'ADMIN'), U('u_seoyul_ban', 'COMPLIANCE'), U('u_seoyul_ban', 'AUDIT'), U('u_finance'), U('u_jaewon_kook')];
        const bad = who.filter(u => X.canConfirm(u, x).ok);
        if (bad.length) return '재무 리더가 아닌데 확인할 수 있음: ' + bad.map(u => u.id + '(' + u.role + ')').join(', ');
        if (!X.canConfirm(U('u_seojin_ma'), x).ok) return '견줌: 재무 리더도 확인할 수 없음(시험 전제)';
        return true;
      },
    },
    {
      name: '고객사 티어가 바뀐 거래처 줄은 하나도 설정 변경 확인 대상에서 빠지지 않음(고치기, 티어를 고른 추가, 처음 넣은 예시 줄)',
      kind: 'deny',
      run(h) {
        const env = setup(h, 'ADMIN');
        const { C, X } = env;
        const no = freeBizNo(env, '214-86-5678');
        C.adminSave('CUSTOMER', '시험티어거래처(C-0099)', '거래처 추가: ' + no + ', 고객사 티어 티어 1', '시험', { k: 'CUSTOMER_ADD', cu: { id: 'C-0099', name: '시험티어거래처', bizNo: no, registeredVia: 'ADMIN', registeredContractNo: null, tier: 'T1' } });
        C.adminSave('CUSTOMER', '가온테크(C-0006)', '고객사 티어: 티어 2 → 티어 1', '시험', { k: 'CUSTOMER_EDIT', id: 'C-0006', set: { tier: 'T1' } });
        const rows = X.settingChanges({ areas: ['CUSTOMER'] }).filter(y => /고객사 티어/.test(y.change));
        if (rows.length < 4) return '티어가 바뀐 줄이 ' + rows.length + '개뿐(시험 전제: 예시 2줄 + 시험 2줄)';
        const miss = rows.filter(y => !X.needsCheck(y));
        if (miss.length) return '확인 대상에서 빠진 티어 변경: ' + miss.map(y => y.target + ' ' + y.change).join(' / ');
        return true;
      },
    },
  ],
  serverOnly: [
    '화면이 보낸 티어나 표준 단가를 바꿔 기안: 서버가 거래처의 지금 티어로 표준 단가를 다시 정해 다르면 거절(시안은 화면이 셈한 값을 줄에 남김)',
    '관리자가 아닌 사람이 거래처 고치기나 가격 기준 저장을 서버에 직접 보냄: 서버가 역할을 보고 거절(시안 adminSave는 역할을 다시 보지 않고 화면이 단추와 창을 막음)',
    '설정 변경 확인 대상은 서버가 정함: 거래처 변경 가운데 tier 칸이 바뀐 것 모두(시안은 바뀐 내용 글의 "고객사 티어"로 알아봄). 합치기는 합칠 때 남긴 거래처마다의 티어로 다름을 봄',
    '바꾼 사람이 자기 변경의 확인을 서버에 직접 보냄: 서버가 바꾼 사람과 확인하는 사람을 견주어 거절',
  ],
};
// 2026-11-16 기획자 결정 반영 시험(작업기록/2026-11-16/반영목록.md, tools/control_tests/n16.js)
module.exports.tests = module.exports.tests.concat(require('./n16')('AC-52'));
// 2026-11-18 기획자 결정 N-3 반영 시험(작업기록/2026-11-13/결정할것.md 9장, tools/control_tests/n18.js): 간접 견적은 사용 업체의 티어
module.exports.tests = module.exports.tests.concat(require('./n18')('AC-52'));
