// AC-35 운영 변경 결재선과 기간 한도 (CTL-70, CTL-74, 06 통제 목록 2장) 시험 (2026-11-13 주말 점검 W2)
//   운영 변경 화면(ops-change.js)과 결재 문서(review.js)를 가짜 문서에 올려 고르고 기안하고 ⑨ ⑩을 눌러 봄(도우미는 lib.js)
'use strict';
const { page, review, doStep } = require('./lib');

const st = (c, step) => (c.approvals || []).find(a => a.step === step) || {};
const LINK = 'https://panda.muhayu.com/activity/A-TEST-0001';
const strip = s => String(s).replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

// 운영 변경 화면을 그 사람으로 열고 변경 종류와 칸 값을 넣음(종류를 고르면 화면이 미리 보기를 다시 그림)
//   v: { type, end, qty, amount, feature, reason, activity }. 돌려주는 값 { dom, radios, why }
function open(env, origin, who, v) {
  const dom = page(env, 'ops-change.js', '?origin=' + origin, { user: env.U(who) });
  if (dom.error) return { dom, why: '운영 변경 화면을 열지 못함: ' + dom.error.message };
  if (dom.q('#form').hidden) return { dom, closed: true, why: '' };
  const radios = dom.inputs({ name: 'type' });
  radios.forEach(r => { r.checked = !r.disabled && r.value === v.type; });
  const put = { '#f-end': v.end, '#f-qty': v.qty, '#f-amount': v.amount, '#f-feature': v.feature,
    '#f-reason': v.reason == null ? '시험 운영 변경' : v.reason, '#f-activity': v.activity == null ? LINK : v.activity };
  Object.keys(put).forEach(k => { dom.q(k).value = put[k] == null ? '' : String(put[k]); });
  dom.fire('#form', 'change', { target: radios[0] || dom.q('#f-reason') });
  return { dom, radios, why: '' };
}
// 기안 단추를 누름. 확인 창이 열리면 tweak(dom)을 한 뒤(요청 본문을 바꾼 것처럼) 확인 창의 기안을 누름. 돌려주는 값 { blocked, rec, body }
function submit(env, x, tweak) {
  const n = env.D.CONTRACTS.length;
  x.dom.submit();
  if (x.dom.q('#confirm-modal').hidden !== false) return { blocked: true, errors: strip(x.dom.errors()) };
  const body = strip(x.dom.q('#confirm-body').innerHTML);
  if (tweak) tweak(x.dom);
  x.dom.confirmClick();
  const rec = env.D.CONTRACTS.length > n ? env.D.CONTRACTS[env.D.CONTRACTS.length - 1] : null;
  return { blocked: false, rec, body };
}
function draft(env, origin, who, v, tweak) {
  const x = open(env, origin, who, v);
  if (x.why || x.closed) return { why: x.why || '운영 변경 화면이 막힘: ' + strip(x.dom.q('#notice').innerHTML).slice(0, 120) };
  const r = submit(env, x, tweak);
  if (r.blocked) return { why: '', blocked: true, errors: r.errors, dom: x.dom };
  return { why: r.rec ? '' : '확인 창의 기안을 눌러도 운영 변경이 남지 않음', rec: r.rec, body: r.body, dom: x.dom };
}
function run(env, id, steps, each) {
  for (const s of steps) {
    const r = doStep(env, id, s, st(env.contract(id), s).userId);
    if (!r.ok) return r.why;
    if (each) { const w = each(s); if (w) return w; }
  }
  return '';
}
// 2601CL001(지금 종료일 2026-12-31, 영업대표 정하은은 시연 역할에 없어 최고관리자로 엶)의 기간 변경
const period = (env, end) => draft(env, '2601CL001', 'u_super', { type: 'PERIOD', end: end });
const ckFeature = D => (D.PRICE_BOOK.find(p => p.service === 'CK') || {}).feature;
const hrFeature = D => (D.PRICE_BOOK.find(p => p.service === 'HR') || {}).feature;

module.exports = {
  ac: 'AC-35',
  title: '운영 변경 결재선과 기간 한도',
  tests: [
    {
      name: '무상 충전 51건이면 ③ 영업 검토를 거침(2511CL001, 앞선 충전 없음)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        if (env.C.freeChargeUsed('2511CL001', env.D.TODAY, null, 'CK_FREE') !== 0) return '시험 전제: 2511CL001에 앞선 무상 충전이 있음';
        const d = draft(env, '2511CL001', 'u_sales1', { type: 'CK_FREE', qty: 51 });
        if (d.why || d.blocked) return d.why || '기안이 막힘: ' + d.errors;
        if (d.body.indexOf('③ 영업 검토부터') < 0) return '확인 창이 ③부터라고 하지 않음: ' + d.body.slice(0, 80);
        if (st(d.rec, 'S03').state !== 'PENDING') return '51건인데 ③이 차례가 아님: ' + st(d.rec, 'S03').state;
        return true;
      },
    },
    {
      name: '무상 충전 50건이면 ③ 없이 바로 ⑨(2511CL001)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const d = draft(env, '2511CL001', 'u_sales1', { type: 'CK_FREE', qty: 50 });
        if (d.why || d.blocked) return d.why || '기안이 막힘: ' + d.errors;
        if (st(d.rec, 'S03').state !== 'SKIPPED') return '50건인데 ③을 거침: ' + st(d.rec, 'S03').state;
        if (st(d.rec, 'S09').state !== 'PENDING') return '50건인데 ⑨가 바로 차례가 아님';
        return true;
      },
    },
    {
      name: '종료일 2026-12-31을 2027-02-28로 늘리면 받고 ③ 생략(2601CL001, 최고관리자)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SUPER' });
        if (env.C.bundleOf('2601CL001').end !== '2026-12-31') return '시험 전제: 2601CL001의 지금 종료일이 2026-12-31이 아님';
        const d = period(env, '2027-02-28');
        if (d.why || d.blocked) return d.why || '2027-02-28로 기안되지 않음: ' + d.errors;
        if (d.rec.endDate !== '2027-02-28' || d.rec.oldEndDate !== '2026-12-31') return '새 종료일이나 지금 종료일이 남지 않음';
        if (st(d.rec, 'S03').state !== 'SKIPPED' || st(d.rec, 'S09').state !== 'PENDING') return '기간 변경인데 ③을 거치거나 ⑨가 차례가 아님';
        return true;
      },
    },
    {
      name: '종료일을 2026-10-31로 줄여도 받음(2601CL001)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SUPER' });
        const d = period(env, '2026-10-31');
        if (d.why || d.blocked) return d.why || '2026-10-31로 기안되지 않음: ' + d.errors;
        if (st(d.rec, 'S03').state !== 'SKIPPED') return '기간을 줄였는데 ③을 거침';
        return true;
      },
    },
    {
      name: '2027-03-01을 고르면 기안을 막고 연장으로 가는 링크가 보임(2601CL001)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SUPER' });
        const x = open(env, '2601CL001', 'u_super', { type: 'PERIOD', end: '2027-03-01' });
        if (x.why || x.closed) return x.why || '운영 변경 화면이 막힘';
        const note = String(x.dom.q('#period-note').innerHTML);
        if (note.indexOf('href="renewal.html?origin=2601CL001"') < 0) return '안내 줄에 연장(연장 검토)으로 가는 링크가 없음: ' + strip(note);
        const r = submit(env, x);
        if (!r.blocked) return '2027-03-01로 기안됨(2개월 넘게 늘림)';
        if (r.errors.indexOf('2027-02-28까지만 늘립니다') < 0) return '오류 안내에 한도(2027-02-28)가 없음: ' + r.errors.slice(0, 120);
        return true;
      },
    },
    {
      name: '유상 충전은 ③ 없음(2511CL001)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const d = draft(env, '2511CL001', 'u_sales1', { type: 'CK_PAID', qty: 500, amount: 3000000, feature: ckFeature(env.D) });
        if (d.why || d.blocked) return d.why || '기안이 막힘: ' + d.errors;
        if (st(d.rec, 'S03').state !== 'SKIPPED' || st(d.rec, 'S09').state !== 'PENDING') return '유상 충전인데 ③을 거치거나 ⑨가 차례가 아님';
        return true;
      },
    },
    {
      name: '화면에서 50건으로 미리 보기를 띄운 뒤 수량을 60으로 바꿔 보내면 저장된 기안은 ③을 거침(2511CL001)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const d = draft(env, '2511CL001', 'u_sales1', { type: 'CK_FREE', qty: 50 }, dom => { dom.q('#f-qty').value = '60'; });
        if (d.why || d.blocked) return d.why || '기안이 막힘';
        if (d.body.indexOf('⑨ 운영 변경부터') < 0) return '시험 전제: 50건 미리 보기가 ⑨부터가 아님';
        if (d.rec.changeQty !== 60) return '시험 전제: 바꾼 수량 60이 저장되지 않음(' + d.rec.changeQty + ')';
        if (st(d.rec, 'S03').state !== 'PENDING') return '60건으로 저장됐는데 ③이 들어가지 않음(미리 보기 값을 씀): ' + st(d.rec, 'S03').state;
        return true;
      },
    },
    {
      name: '기간을 2개월 넘게 줄이는 변경은 기안되지 않음(2601CL001, 2026-10-30)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SUPER' });
        const n = env.D.CONTRACTS.length;
        const d = period(env, '2026-10-30');
        if (d.why) return d.why;
        if (!d.blocked || env.D.CONTRACTS.length !== n) return '2개월 넘게 줄였는데 기안됨';
        if (d.errors.indexOf('2026-10-31까지만 줄입니다') < 0) return '줄임 한도 오류 안내가 없음: ' + d.errors.slice(0, 120);
        if (String(d.dom.q('#period-note').innerHTML).indexOf('kind=AMEND') < 0) return '변경 계약으로 가는 링크가 없음';
        return true;
      },
    },
    {
      name: '2026-12-31을 2027-02-28로 늘린 운영 변경이 끝난 뒤 다시 늘리는 변경은 기안되지 않음(계약서의 종료일에서 이미 2개월)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SUPER' });
        const d = period(env, '2027-02-28');
        if (d.why || d.blocked) return d.why || '첫 기간 변경이 기안되지 않음';
        const w = run(env, d.rec.id, ['S09', 'S10']);
        if (w) return w;
        if (env.C.bundleOf('2601CL001').end !== '2027-02-28') return '시험 전제: 첫 기간 변경 뒤 지금 종료일이 2027-02-28이 아님';
        // 2026-11-13 보강(점검 지적): 막혔는지만 보면 진행 중인 기간 변경 때문에 기간 변경 단추가 꺼져 "변경 종류를 고르세요"로 막혀도 통과함.
        //   그래서 막힌 까닭이 계약서의 종료일(2026-12-31)에서 2개월인 2027-02-28 한도인지 오류 글로 봄. 2027-04-30은 지금 종료일(2027-02-28)
        //   기준으로는 2개월 안이므로, 이 글이 나와야 계약서의 종료일 한도를 시험한 것이 됨
        for (const end of ['2027-03-15', '2027-04-30']) {
          const n = env.D.CONTRACTS.length;
          const x = period(env, end);
          if (x.why) return x.why;
          if (!x.blocked || env.D.CONTRACTS.length !== n) return '이미 2개월 늘린 뒤 ' + end + '로 다시 늘리는 변경이 기안됨';
          if (x.errors.indexOf('변경 종류를 고르세요') > -1) return end + '가 한도가 아니라 기간 변경을 고를 수 없어 막힘(시험 전제가 맞지 않음): ' + x.errors.slice(0, 120);
          if (x.errors.indexOf('2027-02-28까지만 늘립니다') < 0) return end + '가 막힌 까닭이 계약서의 종료일 한도(2027-02-28까지)가 아님: ' + x.errors.slice(0, 120);
        }
        return true;
      },
    },
    {
      name: '카피킬러만 있는 계약(2511CL001)에는 HR 충전을 고를 수 없음',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        if ((env.contract('2511CL001').services || []).join() !== 'CK') return '시험 전제: 2511CL001이 카피킬러만 있는 계약이 아님';
        const x = open(env, '2511CL001', 'u_sales1', { type: 'HR_FREE', qty: 10 });
        if (x.why || x.closed) return x.why || '운영 변경 화면이 막힘';
        const hr = x.radios.filter(r => /^HR_/.test(r.value)).map(r => r.value);
        if (hr.length) return 'HR 충전을 고를 수 있음: ' + hr.join(', ');
        const n = env.D.CONTRACTS.length;
        const r = submit(env, x);
        if (!r.blocked || env.D.CONTRACTS.length !== n) return 'HR 충전을 고르지 못했는데 기안됨';
        return true;
      },
    },
    {
      name: '한 기안에는 변경 종류 하나만 고름(종류 칸이 하나만 고르는 단추)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const x = open(env, '2512CL001', 'u_sales1', { type: 'CK_FREE', qty: 10 });
        if (x.why || x.closed) return x.why || '운영 변경 화면이 막힘';
        if (x.radios.length < 2) return '시험 전제: 고를 종류가 둘 이상이 아님';
        const bad = x.radios.filter(r => r.type !== 'radio' || r.name !== 'type');
        if (bad.length) return '하나만 고르는 단추가 아닌 종류 칸이 있음: ' + bad.map(r => r.value + ' ' + r.type).join(', ');
        const r = submit(env, x);
        if (r.blocked || !r.rec) return '시험 전제: 기안되지 않음';
        if (typeof r.rec.changeType !== 'string' || r.rec.changeType !== 'CK_FREE') return '저장된 변경 종류가 하나가 아님: ' + JSON.stringify(r.rec.changeType);
        return true;
      },
    },
    {
      name: 'http 링크나 빈 사유는 기안되지 않음(2511CL001)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const cases = [
          [{ activity: 'http://panda.muhayu.com/activity/A-1' }, 'CRM 영업활동 링크를 https://로 시작하는 주소로 넣으세요'],
          [{ activity: '' }, 'CRM 영업활동 링크를 https://로 시작하는 주소로 넣으세요'],
          [{ reason: '  ' }, '변경 사유를 적으세요'],
        ];
        for (const [v, msg] of cases) {
          const n = env.D.CONTRACTS.length;
          const d = draft(env, '2511CL001', 'u_sales1', Object.assign({ type: 'CK_FREE', qty: 10 }, v));
          if (d.why) return d.why;
          if (!d.blocked || env.D.CONTRACTS.length !== n) return JSON.stringify(v) + '로 기안됨';
          if (d.errors.indexOf(msg) < 0) return JSON.stringify(v) + '에 "' + msg + '" 안내가 없음';
        }
        const ok = draft(env, '2511CL001', 'u_sales1', { type: 'CK_FREE', qty: 10 });
        if (ok.blocked || !ok.rec) return 'https 링크와 사유를 넣어도 기안되지 않음(시험 전제가 맞지 않음)';
        return true;
      },
    },
    {
      name: '새 종료일이 지금 종료일과 같거나 오늘보다 앞서면 기안되지 않음(2601CL001)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SUPER' });
        const cases = [['2026-12-31', '지금 종료일과 같습니다'], [env.C.addDays(env.D.TODAY, -1), '새 종료일은 오늘 이후여야 합니다']];
        for (const [end, msg] of cases) {
          const n = env.D.CONTRACTS.length;
          const d = period(env, end);
          if (d.why) return d.why;
          if (!d.blocked || env.D.CONTRACTS.length !== n) return '새 종료일 ' + end + '로 기안됨';
          if (d.errors.indexOf(msg) < 0) return '새 종료일 ' + end + '에 "' + msg + '" 안내가 없음';
        }
        return true;
      },
    },
    {
      name: 'HR 충전의 ⑨는 재무 담당이라 고객지원이 처리할 수 없음(2604CL001 HR 유상 충전)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const d = draft(env, '2604CL001', 'u_sales1', { type: 'HR_PAID', qty: 100, amount: 800000, feature: hrFeature(env.D) });
        if (d.why || d.blocked) return d.why || '기안이 막힘: ' + d.errors;
        const s9 = st(d.rec, 'S09');
        if (s9.state !== 'PENDING') return '시험 전제: ⑨가 차례가 아님';
        const fin = (env.D.ACCOUNTS.find(a => a.id === s9.userId) || {}).roles || [];
        if (fin.indexOf('FINANCE') < 0) return 'HR 충전의 ⑨ 담당이 재무 담당자가 아님: ' + s9.userId;
        if (env.C.canAct(d.rec, s9, env.U('u_cem'))) return '고객지원이 HR 충전의 ⑨를 처리할 수 있음';
        if (review(env, d.rec.id, 'u_cem').hasButton('APPROVE', 'S09')) return '고객지원 결재 문서에 ⑨ 단추가 보임';
        return true;
      },
    },
    {
      name: '무상 충전을 나눠 신청해도 같은 계약 연도 누적이 50건을 넘으면 ③(2606CL001-C02, 누적 55건)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const c = env.contract('2606CL001-C02');
        if (c.changeQty !== 25) return '시험 전제: 2606CL001-C02가 25건이 아님';
        const s3 = st(c, 'S03');
        if (s3.state === 'SKIPPED') return '이번 25건이지만 누적 55건인데 ③을 건너뜀';
        if (!/55건/.test(s3.reason || '')) return '③의 까닭에 누적 55건이 없음: ' + s3.reason;
        return true;
      },
    },
    {
      name: '반려된 충전과 임시 저장은 누적에 세지 않음(2606CL001-C01을 반려로, 임시 저장 40건을 더해도 C02는 ③ 없음)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES', hook: D => {
          const c1 = D.CONTRACTS.find(x => x.id === '2606CL001-C01');
          c1.history = [{ step: 'S09', action: 'REJECT', at: '2026-08-19 15:00', comment: '시험 반려', actorId: 'u_cem', round: 1 }];
          D.CONTRACTS.push({ draftKey: 'T35', parentId: '2606CL001', counterparty: '해랑출판', services: ['CK'], kind: 'CHANGE', changeType: 'CK_FREE',
            changeQty: 40, changeAmount: 0, amount: 0, requesterId: 'u_sales2', requestedAt: '2026-09-10 10:00', status: 'DRAFT', history: [] });
        } });
        if (env.contract('2606CL001-C01').status !== 'REJECTED') return '시험 전제: 2606CL001-C01이 반려가 아님';
        const s3 = st(env.contract('2606CL001-C02'), 'S03');
        if (s3.state !== 'SKIPPED') return '반려된 30건이나 임시 저장 40건을 누적에 셈: ' + s3.reason;
        return true;
      },
    },
    {
      name: '⑨가 끝난 운영 변경은 ⑩ 없이 계약 완료가 되지 않고, 기간 변경의 새 종료일은 ⑩ 뒤에 적용(2601CL001)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SUPER' });
        const { C } = env;
        const d = period(env, '2027-02-28');
        if (d.why || d.blocked) return d.why || '기간 변경이 기안되지 않음';
        const c = d.rec;
        let w = run(env, c.id, ['S09']);
        if (w) return w;
        if (c.status === 'ACTIVE' || c.completedAt) return '⑨만 끝났는데 계약 완료가 됨';
        if (st(c, 'S10').state !== 'PENDING') return '⑨ 뒤 ⑩이 차례가 아님';
        if (C.bundleOf('2601CL001').end !== '2026-12-31') return '⑩ 전에 새 종료일이 적용됨: ' + C.bundleOf('2601CL001').end;
        w = run(env, c.id, ['S10']);
        if (w) return w;
        if (c.status !== 'ACTIVE') return '⑩ 뒤에도 계약 완료가 아님: ' + c.status;
        if (C.bundleOf('2601CL001').end !== '2027-02-28') return '⑩ 뒤 새 종료일이 적용되지 않음';
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검 W7, abc-07) 계약 등록(C-13)과 같은 거래처 확인 경고를 운영 변경에도. 막지 않고, 유상 충전과 기간 늘림은 결재 문서가 보게 기록에 남김
      //   [가정] 무상 충전과 기간 줄임은 기록에 남기지 않음(ops-change.js 머리 주석 8)
      name: '거래처 확인 전인 조달 거래처의 유상 충전과 기간 늘림은 경고 없이, 기록 없이 기안되지 않음(막지는 않음. 2511CL001, 2601CL001을 조달로 바꿔 봄)',
      kind: 'deny',
      run(h) {
        const hook = D => ['2511CL001', '2601CL001'].forEach(id => { const c = D.CONTRACTS.find(x => x.id === id); c.form = Object.assign({}, c.form || {}, { method: 'PROCURE' }); });
        const MARK = '조달 거래처라';
        let env = h.fresh({ role: 'SALES', hook });
        const paid = draft(env, '2511CL001', 'u_sales1', { type: 'CK_PAID', qty: 500, amount: 3000000, feature: ckFeature(env.D) });
        if (paid.why || paid.blocked) return paid.why || '거래처 확인 경고 때문에 유상 충전이 막힘(경고만 해야 함): ' + paid.errors;
        const w = paid.dom.q('#customer-check');
        if (w.hidden !== false || String(w.innerHTML).indexOf(MARK) < 0) return '운영 변경 화면에 거래처 확인 경고가 없음';
        if (paid.body.indexOf('거래처 확인') < 0) return '기안 확인 창에 거래처 확인 경고가 없음';
        if (String(paid.rec.customerCheckWarn || '').indexOf(MARK) < 0) return '유상 충전 기록에 거래처 확인 경고가 남지 않음: ' + JSON.stringify(paid.rec.customerCheckWarn);
        env = h.fresh({ role: 'SUPER', hook });
        const longer = period(env, '2027-02-28');
        if (longer.why || longer.blocked) return longer.why || '기간 늘림이 막힘: ' + longer.errors;
        if (String(longer.rec.customerCheckWarn || '').indexOf(MARK) < 0) return '기간 늘림 기록에 거래처 확인 경고가 남지 않음';
        // [가정] 무상 충전과 기간 줄임은 남기지 않음
        env = h.fresh({ role: 'SALES', hook });
        const free = draft(env, '2511CL001', 'u_sales1', { type: 'CK_FREE', qty: 10 });
        if (free.why || free.blocked) return free.why || '무상 충전이 막힘';
        if (free.rec.customerCheckWarn) return '무상 충전 기록에 경고가 남음([가정]과 다름)';
        env = h.fresh({ role: 'SUPER', hook });
        const shorter = period(env, '2026-10-31');
        if (shorter.why || shorter.blocked) return shorter.why || '기간 줄임이 막힘';
        if (shorter.rec.customerCheckWarn) return '기간 줄임 기록에 경고가 남음([가정]과 다름)';
        // 견줌: 확인 대상이 아니면 유상 충전에도 경고가 없고 빈 값
        env = h.fresh({ role: 'SALES' });
        const plain = draft(env, '2511CL001', 'u_sales1', { type: 'CK_PAID', qty: 500, amount: 3000000, feature: ckFeature(env.D) });
        if (plain.why || plain.blocked) return '견줌: 기안되지 않음';
        if (plain.rec.customerCheckWarn !== '' || plain.dom.q('#customer-check').hidden !== true) return '견줌: 확인 대상이 아닌데 경고가 남음';
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검, 코드 다시 보기 amend-04) 찾은 사람의 재현: 예전에는 계약서의 종료일이 2027-09-30(첫 기간 변경 전)으로 남아 범위가 2027-07-31~2027-08-31,
      //   2027-07-15(늘림)와 2027-06-15(줄임)가 "운영 변경으로는 2027-07-31까지만 줄입니다"로 막혔음
      name: '(amend-04) 계약 완료된 기간 변경(C09, 2027-11-30) 뒤에 계약 완료된 변경 계약(A09)이 종료일을 2027-06-30으로 앞당겼으면 계약서의 종료일은 2027-06-30이고, 2027-07-15(늘림)와 2027-06-15(줄임)를 받음(2609CL007)',
      kind: 'ok',
      run(h) {
        const hook = D => {
          D.CONTRACTS.push({ id: '2609CL007-C09', parentId: '2609CL007', counterparty: '한누리대학교', services: ['CK'], type: 'SaaS 이용계약', kind: 'CHANGE',
            changeType: 'PERIOD', oldEndDate: '2027-09-30', endDate: '2027-11-30', amount: 0, requesterId: 'u_taeyun_kim', requestedAt: '2026-10-10 10:00',
            restricted: false, personalData: false, status: 'ACTIVE', completedAt: '2026-10-12 10:00', reason: '시험', activityUrl: LINK });
          D.CONTRACTS.push({ id: '2609CL007-A09', parentId: '2609CL007', counterparty: '한누리대학교', services: ['CK'], type: 'SaaS 이용계약', kind: 'AMEND', amendKind: 'TERMS',
            amount: 0, products: [], requesterId: 'u_taeyun_kim', requestedAt: '2026-10-13 10:00', restricted: false, personalData: false, status: 'ACTIVE',
            completedAt: '2026-10-15 10:00', startDate: '2026-11-01', endDate: '2027-06-30', oldEndDate: '2027-11-30', autoRenew: 'NO', checklist: { standard: 'NO', price: 'NA', cap: 'NA' } });
        };
        for (const end of ['2027-07-15', '2027-06-15']) {
          const env = h.fresh({ role: 'SALES', hook });
          ['2609CL007-C09', '2609CL007-A09'].forEach(id => { env.contract(id).status = 'ACTIVE'; }); // 결재 상태 계산 뒤 계약 완료로 둠
          if (env.C.bundleOf('2609CL007').end !== '2027-06-30') return '시험 전제: 묶음 종료일이 2027-06-30이 아님: ' + env.C.bundleOf('2609CL007').end;
          const d = draft(env, '2609CL007', 'u_taeyun_kim', { type: 'PERIOD', end: end });
          if (d.why) return d.why;
          if (d.blocked) return end + '가 막힘: ' + d.errors.slice(0, 160);
          const kv = strip(d.dom.q('#period-kv').innerHTML);
          if (kv.indexOf('계약서의 종료일 2027-06-30') < 0) return '계약서의 종료일이 변경 계약이 바꾼 2027-06-30이 아님: ' + kv.slice(0, 160);
          if (d.rec.endDate !== end || d.rec.oldEndDate !== '2027-06-30') return end + ' 기록의 새 종료일이나 바꾸기 전 종료일이 다름: ' + d.rec.oldEndDate + ' → ' + d.rec.endDate;
        }
        // 견줌: 변경 계약 뒤 2개월 넘게 늘리면 여전히 막음(2027-09-15 > 2027-08-31)
        const env = h.fresh({ role: 'SALES', hook });
        ['2609CL007-C09', '2609CL007-A09'].forEach(id => { env.contract(id).status = 'ACTIVE'; });
        const over = draft(env, '2609CL007', 'u_taeyun_kim', { type: 'PERIOD', end: '2027-09-15' });
        if (over.why) return over.why;
        if (!over.blocked || over.errors.indexOf('2027-08-31까지만 늘립니다') < 0) return '견줌: 변경 계약이 바꾼 종료일에서 2개월 넘게 늘리는 변경이 막히지 않음: ' + (over.errors || '').slice(0, 120);
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검, 코드 다시 보기 amend-02) 반대 차례: 기간을 줄이는 변경 계약이 진행 중일 때 기간 변경이 먼저 끝나면 그 변경이 늘린 기간을 자름
      name: '(amend-02) 기간을 줄이는 변경 계약(2609CL007-A09, 2027-09-30 → 2027-06-30)이 진행 중이면 기간 변경을 고를 수 없음. 기간을 바꾸지 않는 변경이 진행 중이면 고를 수 있음',
      kind: 'deny',
      run(h) {
        const mk = end => D => D.CONTRACTS.push({ id: '2609CL007-A09', parentId: '2609CL007', counterparty: '한누리대학교', services: ['CK'], type: 'SaaS 이용계약', kind: 'AMEND', amendKind: 'TERMS',
          amount: 0, products: [], requesterId: 'u_taeyun_kim', requestedAt: '2026-10-18 10:00', restricted: false, personalData: false, status: 'IN_REVIEW',
          startDate: '2026-11-01', endDate: end, oldEndDate: '2027-09-30', checklist: { standard: 'NO', price: 'NA', cap: 'NA' } });
        let env = h.fresh({ role: 'SALES', hook: mk('2027-06-30') });
        if (!env.C.bundleOf('2609CL007').open.some(o => o.id === '2609CL007-A09')) return '시험 전제: A09가 진행 중이 아님';
        const n = env.D.CONTRACTS.length;
        const d = draft(env, '2609CL007', 'u_taeyun_kim', { type: 'PERIOD', end: '2027-10-31' });
        if (d.why) return d.why;
        const x = open(env, '2609CL007', 'u_taeyun_kim', { type: 'PERIOD', end: '2027-10-31' });
        const pr = x.radios.find(r => r.value === 'PERIOD');
        if (!pr || !pr.disabled) return '기간을 줄이는 변경이 진행 중인데 기간 변경을 고를 수 있음';
        if (!d.blocked || env.D.CONTRACTS.length !== n) return '기간을 줄이는 변경이 진행 중인데 기간 변경이 기안됨';
        // 견줌: 종료일을 바꾸지 않는 변경(종료일 2027-09-30)이 진행 중이면 막지 않음
        env = h.fresh({ role: 'SALES', hook: mk('2027-09-30') });
        const y = open(env, '2609CL007', 'u_taeyun_kim', { type: 'PERIOD', end: '2027-10-31' });
        const py = y.radios.find(r => r.value === 'PERIOD');
        if (!py || py.disabled) return '견줌: 기간을 바꾸지 않는 변경이 진행 중인데 기간 변경을 고를 수 없음';
        return true;
      },
    },
  ],
  serverOnly: [
    '서버가 받은 값(원계약 종료일, 새 종료일, 충전 수량)으로 ③이 필요한지 다시 정하고, 화면 미리 보기와 다르면 기안을 받지 않고 예외로 남김: 시안은 저장한 값으로 결재선을 셈할 뿐 미리 보기와 견주거나 예외를 남기지 않음',
    '화면을 건너뛰고 2개월 넘게 늘리거나 줄인 새 종료일을 직접 보냄: 시안은 기안 단추에서만 막고 확인 창의 기안은 다시 검사하지 않음. 서버가 기간 한도(지금 종료일과 계약서의 종료일에서 각각 앞뒤 2개월, 말일 기준)로 거절해야 함',
    '카피킬러만 있는 계약의 HR 충전, 두 종류를 한 기안에, http 링크나 빈 사유, 같거나 지난 새 종료일을 요청으로 직접 보냄: 시안은 화면에서만 막아 서버가 다시 검사해야 함',
    'HR 충전의 ⑨를 고객지원이 처리하는 요청: 시안 recordAction은 담당을 다시 검사하지 않아 서버가 거절해야 함',
    '무상 충전 누적 수량(free_used_before)을 서버가 기안 때 다시 세어 저장함. 한도 전에 2개월 넘게 기안한 예전 기록은 결재선을 그대로 둠 [가정]',
    '(2026-11-14 주말 점검 W7) 거래처 확인 경고 문장(customerCheckWarn)은 서버가 기안 때 거래처 확인 상태로 다시 만들어 남김: 시안은 화면이 만든 문장을 그대로 저장',
  ],
};
