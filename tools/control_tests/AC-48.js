// AC-48 관리자 변경 이력 (CTL-117, 06 통제 목록 2장) 시험 (2026-11-13 주말 점검 W2)
//   기대 동작: 사유가 없으면 저장되지 않고, 바뀐 값과 이력 한 줄이 같은 저장 안에서 함께 성공하거나 함께 실패한다.
//   시안 코드: common.js adminSave(이력 한 줄을 남기고 그 줄로 값을 바꿈 applyAdmin), adminLog, adminHistoryHtml.
//   사유 검사는 화면 창이 함(06 "시안의 adminSave는 사유를 검사하지 않고 화면이 검사함"). 그래서 가격 기준 관리(admin-prices.js)와
//   결재선 규칙(admin-rules.js) 화면을 가짜 문서에 올려 창을 채우고 저장 단추를 눌러 봄
'use strict';
const { fixClock, withModal, clickTarget, pageAs: page } = require('./lib');

// 가격 기준 관리에서 추가 이용자(CK_CAMPUS_USER, 지금 1,500,000원)의 바꾸기 창을 열어 저장을 누름
function changePrice(env, reason) {
  const dom = page(env, 'admin-prices.js', env.U('u_admin'));
  if (dom.error) return { why: '가격 기준 관리 화면을 열지 못함: ' + dom.error.message };
  const m = withModal(env, () => dom.fire('#content', 'click', { target: clickTarget({ 'data-change': 'CK_CAMPUS_USER' }) }));
  if (!m.opened) return { why: '바꾸기 창이 열리지 않음' + (m.error ? ': ' + m.error.message : '') };
  const r = m.submit({ price: '1,600,000', cap: '15', tier_T1: '', tier_T2: '', tier_T3: '', validFrom: env.D.TODAY,
    docUrl: 'https://gw.muhayu.com/approval/2026-T48', docNo: '경영지원-2026-T48', reason: reason });
  return { r, why: '' };
}

module.exports = {
  ac: 'AC-48',
  title: '관리자 변경 이력',
  tests: [
    {
      name: '가격 기준 관리에서 가격 1건을 바꾸면 이력 1줄(영역 PRICE, 전후 값, 사유)이 남고 가격 줄도 함께 바뀜',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'ADMIN' });
        fixClock(env);
        const { C, D } = env;
        const n0 = C.adminLog(['PRICE']).length, p0 = D.PRICE_ROWS.length;
        const x = changePrice(env, '서버 비용 반영으로 단가 인상(시험)');
        if (x.why) return x.why;
        if (!x.r.done) return '저장되지 않음: ' + JSON.stringify(x.r.errors);
        const log = C.adminLog(['PRICE']);
        if (log.length !== n0 + 1) return 'PRICE 이력이 ' + n0 + ' → ' + log.length + '줄(1줄 늘어야 함)';
        const e = log[0];
        if (e.area !== 'PRICE') return '영역이 PRICE가 아님: ' + e.area;
        if (e.change.indexOf('표준 단가 1,500,000원 → 1,600,000원') < 0) return '바뀐 내용에 전후 값이 없음: ' + e.change;
        if (e.reason !== '서버 비용 반영으로 단가 인상(시험)') return '사유가 그대로 남지 않음: ' + e.reason;
        if (e.by !== 'u_admin') return '바꾼 사람이 로그인한 관리자가 아님: ' + e.by;
        if (D.PRICE_ROWS.length !== p0 + 1 || D.PRICE_ROWS[D.PRICE_ROWS.length - 1].listPrice !== 1600000) return '가격 줄이 함께 바뀌지 않음';
        return true;
      },
    },
    {
      name: '결재선 규칙에서 대리 지정을 더하면 영역 RULE 한 줄이 남고 대리 지정도 함께 생김',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'ADMIN' });
        fixClock(env);
        const { C, D, U } = env;
        const dom = page(env, 'admin-rules.js', U('u_admin'));
        if (dom.error) return '결재선 규칙 화면을 열지 못함: ' + dom.error.message;
        const n0 = C.adminLog(['RULE']).length, d0 = D.DELEGATIONS.length;
        const m = withModal(env, () => dom.fire('#content', 'click', { target: clickTarget({ id: 'btn-delegate' }) }));
        if (!m.opened) return '대리 지정 창이 열리지 않음' + (m.error ? ': ' + m.error.message : '');
        const r = m.submit({ absent: 'u_cem', sub: 'u_harin_pyeon', from: D.TODAY, to: '2026-10-23', reason: '임하준 휴가(시험). 같은 고객지원 담당자가 대신함', conflictReason: '' });
        if (!r.done) return '저장되지 않음: ' + JSON.stringify(r.errors);
        const log = C.adminLog(['RULE']);
        if (log.length !== n0 + 1) return 'RULE 이력이 ' + n0 + ' → ' + log.length + '줄(1줄 늘어야 함)';
        if (!log[0].op || log[0].op.k !== 'DELEGATE' || !/대리 지정/.test(log[0].change)) return '이력 줄이 대리 지정이 아님: ' + log[0].change;
        if (D.DELEGATIONS.length !== d0 + 1) return '대리 지정이 함께 생기지 않음';
        return true;
      },
    },
    {
      name: '사유에 띄어쓰기만 넣으면 저장되지 않고 이력도 값도 그대로(가격 기준 관리 창)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'ADMIN' });
        fixClock(env);
        const { C, D } = env;
        const n0 = C.adminLog().length, p0 = D.PRICE_ROWS.length;
        const x = changePrice(env, '   ');
        if (x.why) return x.why;
        if (x.r.done) return '띄어쓰기만 넣은 사유로 저장됨';
        if (!x.r.errors.reason) return '사유 칸에 오류가 보이지 않음: ' + JSON.stringify(x.r.errors);
        if (C.adminLog().length !== n0 || D.PRICE_ROWS.length !== p0) return '저장하지 않았는데 이력이나 가격 줄이 바뀜';
        return true;
      },
    },
    {
      name: '관리자, 최고관리자 모두 관리자 변경 이력을 고치거나 지우는 기능이 없고, 새 변경은 앞 이력을 건드리지 않고 덧붙임',
      kind: 'deny',
      run(h) {
        for (const role of ['ADMIN', 'SUPER']) {
          const env = h.fresh({ role });
          fixClock(env);
          const { C, D } = env;
          const bad = Object.keys(C).concat(Object.keys(env.X)).filter(k => /^(edit|update|delete|remove|erase|undo|modify|purge|drop|clear)/i.test(k) && k !== 'deleteDraft');
          if (bad.length) return '이력을 고치거나 지울 수 있어 보이는 기능: ' + bad.join(', ');
          const snap = JSON.stringify(D.ADMIN_LOG);
          // 조회 목록을 지워도 이력은 그대로
          const view = C.adminLog();
          view.splice(0, view.length);
          if (JSON.stringify(D.ADMIN_LOG) !== snap) return role + ': 조회 목록을 지우자 이력이 바뀜';
          C.adminSave('NOTICE', '공지(시험)', '공지 올림', '공지 올림', { k: 'NOTICE_ADD', n: { id: 'N-T48', title: '시험', body: '시험' } });
          const now = JSON.stringify(D.ADMIN_LOG.slice(0, JSON.parse(snap).length));
          if (now !== snap) return role + ': 새 변경을 저장하자 앞 이력이 바뀜';
          if (D.ADMIN_LOG.length !== JSON.parse(snap).length + 1) return role + ': 새 변경이 한 줄로 덧붙지 않음';
        }
        return true;
      },
    },
    {
      name: '바뀐 값과 이력은 함께 남거나 함께 없음: 이력 저장이 실패하면 다시 열었을 때 값도 없고, 저장되면 둘 다 되살아남',
      kind: 'deny',
      run(h) {
        const row = { feature: 'CK_CAMPUS_USER', product: 'CK_CAMPUS', service: 'CK', unit: '100명, 1년', unitKind: 'PERIOD', listPrice: 1700000, discountCap: 0.15,
          validFrom: '2026-10-19', docUrl: 'https://gw.muhayu.com/approval/2026-T48B', docNo: '', reason: '시험' };
        const save = env => env.C.adminSave('PRICE', '카피킬러 캠퍼스 추가 이용자 (CK_CAMPUS_USER)', '표준 단가 1,500,000원 → 1,700,000원 (2026-10-19부터)', '시험', { k: 'PRICE', row: Object.assign({}, row) });
        const has = env => ({ log: env.D.ADMIN_LOG.some(e => e.area === 'PRICE' && /1,700,000원/.test(e.change)), val: env.D.PRICE_ROWS.some(r => r.listPrice === 1700000) });
        // 1) 저장소가 실패: 이 화면에서는 둘 다 보이고, 다시 열면 둘 다 없음
        const a = h.fresh({ role: 'ADMIN' });
        fixClock(a);
        a.ctx.localStorage.setItem = () => { throw new Error('저장 실패(시험)'); };
        save(a);
        const a1 = has(a);
        if (a1.log !== a1.val) return '저장이 실패한 화면에서 값과 이력이 따로 놂: ' + JSON.stringify(a1);
        const b = h.fresh({ role: 'ADMIN', store: a.store });
        const b1 = has(b);
        if (b1.val) return '이력 저장이 실패했는데 다시 열면 값만 바뀌어 있음';
        if (b1.log) return '이력 저장이 실패했는데 다시 열면 이력이 있음(시험 전제)';
        // 2) 저장소가 성공: 다시 열면 이력에서 값을 되살림(둘 다 있음)
        const c = h.fresh({ role: 'ADMIN' });
        fixClock(c);
        save(c);
        const d = h.fresh({ role: 'ADMIN', store: c.store });
        const d1 = has(d);
        if (!d1.log || !d1.val) return '저장된 변경을 다시 열면 값과 이력이 함께 되살아나지 않음: ' + JSON.stringify(d1);
        return true;
      },
    },
  ],
  serverOnly: [
    '사유 확인은 서버가 다시 함: 시안의 adminSave는 사유를 검사하지 않고 화면 창이 검사함(adminSave를 바로 부르면 빈 사유도 남음)',
    '이력 고치기나 지우기 요청을 서버에 보냄: 관리자, 최고관리자 모두 거부(서버 저장소는 덧붙이기만)',
    '변경은 됐는데 이력 저장이 실패: 서버가 값과 이력을 한 번에 저장하고 하나라도 실패하면 둘 다 되돌림(시안은 이력 한 줄만 브라우저에 저장하고 다시 열 때 그 줄로 값을 되살림)',
    '바꾼 사람을 요청 값으로 받음: 서버가 로그인한 사람으로 정함(시안 adminSave는 지금 시연 역할의 사람)',
    '이력 없이 값만 바뀌는 길(데이터 직접 고침, 첫 적재): 생기면 안 됨(CTL-124, CTL-87, 운영 절차와 서버)',
    '시안은 이력을 브라우저 저장소에 두고 시연 기록 지우기로 지움: 실제 시스템에서는 이 기능을 뺌',
  ],
};
