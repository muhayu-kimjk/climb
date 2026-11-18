// AC-42 사용자 권한 관리 (CTL-98, 06 통제 목록 2장) 시험 (2026-11-13 주말 점검 W2)
//   사용자 권한 관리(admin-users.js)의 사용자 추가, 수정, 조직 옮기기 창을 가짜 문서에 올려 입력 검사(check)와 저장(done)을 돌림
//   저장은 common.js adminSave(관리자 변경 이력 ADMIN_LOG에 한 줄) → applyAdmin(계정에 반영)
//   화면 도우미는 lib.js의 openPage, fakeForm, submit
'use strict';
const { openPage, fakeForm, submit, stripTags: strip } = require('./lib');

const ADD = { email: 'new.legal@muhayu.com', uname: '시험법무', dept: '경영지원유닛', reason: '11월 3일 입사, 경영지원유닛 법무 담당' };
// 관리자(윤재민)로 사용자 추가 창을 열어 값을 넣고 저장해 봄 → { pg, r, D }
function tryAdd(h, vals, roles) {
  const pg = openPage(h, 'admin-users.js', { role: 'ADMIN' });
  pg.fire('#btn-add', 'click');
  if (!pg.modal) return { pg, r: null, D: pg.env.D };
  const r = submit(pg.modal, fakeForm(pg.modal, vals, { roles: roles || ['LEGAL'] }));
  return { pg, r, D: pg.env.D };
}
const users = D => D.ADMIN_LOG.filter(e => e.area === 'USER');

module.exports = {
  ac: 'AC-42',
  title: '사용자 권한 관리',
  tests: [
    {
      name: '관리자(윤재민)가 사유를 적고 법무 담당자를 추가하면 첫 접속 전 상태가 되고 권한 변경 이력에 한 줄(바꾼 사람, 사유)',
      kind: 'ok',
      run(h) {
        const { pg, r, D } = tryAdd(h, ADD);
        if (!r) return '관리자에게 사용자 추가 창이 열리지 않음';
        if (!r.saved) return '저장되지 않음: ' + r.bad.map(k => r.errs[k]).join(' / ');
        const a = D.ACCOUNTS.find(x => x.email === ADD.email);
        if (!a) return '계정이 생기지 않음';
        if (a.status !== 'INVITED') return '첫 접속 전 상태가 아님: ' + a.status;
        if (a.dept !== ADD.dept || a.roles.join() !== 'LEGAL') return '조직이나 권한이 넣은 값과 다름: ' + a.dept + ' ' + a.roles.join();
        const log = users(D).filter(e => e.target.indexOf(ADD.email) > -1);
        if (log.length !== 1) return '이 계정의 권한 변경 이력이 ' + log.length + '줄(1줄이어야 함)';
        if (log[0].by !== 'u_admin' || log[0].reason !== ADD.reason) return '이력의 바꾼 사람이나 사유가 다름: ' + JSON.stringify(log[0]);
        if (log[0].change.indexOf(ADD.dept) < 0 || log[0].change.indexOf('법무 담당자') < 0) return '이력의 바뀐 내용에 조직이나 권한이 없음: ' + log[0].change;
        if (strip(pg.node('#history').innerHTML).indexOf(ADD.reason) < 0) return '화면의 권한 변경 이력에 새 줄이 보이지 않음';
        return true;
      },
    },
    {
      name: '관리자, 최고관리자가 아닌 역할(영업, 법무, 정보보호, 관찰자, 감사 열람)은 사용자 권한 관리 화면에서 추가, 수정, 옮기기를 할 수 없음',
      kind: 'deny',
      run(h) {
        for (const role of ['SALES', 'LEGAL', 'PRIVACY', 'OBSERVER', 'AUDIT']) {
          const pg = openPage(h, 'admin-users.js', { role });
          if (!pg.node('#users').hidden) return role + ': 사용자 권한 관리 본문이 보임';
          if (pg.node('#user-rows').innerHTML) return role + ': 계정 표를 그림';
          for (const b of ['#btn-add', '#btn-move', '#user-rows']) if ((pg.node(b)._ls.click || []).length) return role + ': ' + b + ' 단추가 이어짐';
        }
        return true;
      },
    },
    {
      name: '다른 도메인 이메일, 대소문자만 다른 같은 이메일로 추가: 거부되고 계정이 생기지 않음',
      kind: 'deny',
      run(h) {
        for (const email of ['new.legal@gmail.com', 'new.legal@muhayu.co.kr', 'new.legal@muhayu.com.evil.com', 'new.legal@sub.muhayu.com', 'new.legal@muhayu', 'Jiho.Yoo@muhayu.com', 'JIHO.YOO@MUHAYU.COM', ' jiho.yoo@muhayu.com ']) {
          const { r, D } = tryAdd(h, Object.assign({}, ADD, { email }));
          if (!r) return '사용자 추가 창이 열리지 않음';
          if (r.saved || !r.errs.email) return '"' + email + '"을(를) 받음';
          const n = D.ACCOUNTS.filter(a => a.email.toLowerCase() === email.trim().toLowerCase()).length;
          if (n > 1) return '"' + email + '"로 같은 계정이 둘 생김';
        }
        return true;
      },
    },
    {
      name: '사유 빈칸(공백만 포함): 사용자 추가, 수정, 조직 옮기기 모두 거부되고 이력이 늘지 않음',
      kind: 'deny',
      run(h) {
        for (const reason of ['', '   ']) {
          const a = tryAdd(h, Object.assign({}, ADD, { reason }));
          if (!a.r || a.r.saved || !a.r.errs.reason) return '사유 "' + reason + '"로 사용자 추가를 받음';
          const pg = openPage(h, 'admin-users.js', { role: 'ADMIN' });
          const n = pg.env.D.ADMIN_LOG.length;
          pg.clickData('#user-rows', { 'data-edit': 'harin.pyeon@muhayu.com' });
          if (!pg.modal) return '수정 창이 열리지 않음';
          const e = submit(pg.modal, fakeForm(pg.modal, { dept: '경영지원유닛', status: 'ACTIVE', reason }, { roles: ['CEM'] }));
          if (e.saved || !e.errs.reason) return '사유 "' + reason + '"로 수정을 받음';
          pg.fire('#btn-move', 'click');
          const f = fakeForm(pg.modal, { from: 'CEM유닛', to: '경영지원유닛', reason });
          f.fireField('from', 'change');
          const m = submit(pg.modal, fakeForm(pg.modal, { from: 'CEM유닛', to: '경영지원유닛', reason }, { people: ['harin.pyeon@muhayu.com'] }));
          if (m.saved || !m.errs.reason) return '사유 "' + reason + '"로 조직 옮기기를 받음';
          if (pg.env.D.ADMIN_LOG.length !== n) return '거부했는데 이력이 늘어남';
        }
        return true;
      },
    },
    {
      name: '권한 변경 이력에 바꾸기 전과 뒤의 값이 모두 남음(조직, 권한, 상태, 조직 옮기기)',
      kind: 'deny',
      run(h) {
        const pg = openPage(h, 'admin-users.js', { role: 'ADMIN' });
        const D = pg.env.D;
        pg.clickData('#user-rows', { 'data-edit': 'harin.pyeon@muhayu.com' });
        let r = submit(pg.modal, fakeForm(pg.modal, { dept: '경영지원유닛', status: 'ACTIVE', reason: '법무 지원으로 이동' }, { roles: ['CEM', 'LEGAL'] }));
        if (!r.saved) return '조직과 권한 수정이 저장되지 않음: ' + r.bad.map(k => r.errs[k]).join(' / ');
        let e = D.ADMIN_LOG[D.ADMIN_LOG.length - 1];
        if (e.change.indexOf('조직: CEM유닛 → 경영지원유닛') < 0) return '조직의 전후 값이 빠짐: ' + e.change;
        if (e.change.indexOf('권한: 고객지원 담당자 → 고객지원 담당자, 법무 담당자') < 0) return '권한의 전후 값이 빠짐: ' + e.change;
        pg.clickData('#user-rows', { 'data-edit': 'harin.pyeon@muhayu.com' });
        r = submit(pg.modal, fakeForm(pg.modal, { dept: '경영지원유닛', status: 'SUSPENDED', reason: '퇴사' }, { roles: ['CEM', 'LEGAL'] }));
        if (!r.saved) return '사용 중지가 저장되지 않음: ' + r.bad.map(k => r.errs[k]).join(' / ');
        e = D.ADMIN_LOG[D.ADMIN_LOG.length - 1];
        if (e.change.indexOf('상태: 사용 중 → 사용 중지') < 0) return '상태의 전후 값이 빠짐: ' + e.change;
        pg.fire('#btn-move', 'click');
        const vals = { from: 'CEM유닛', to: '경영지원유닛', reason: '조직 개편' };
        fakeForm(pg.modal, vals).fireField('from', 'change');
        r = submit(pg.modal, fakeForm(pg.modal, vals, { people: ['sihwan.jin@muhayu.com'] }));
        if (!r.saved) return '조직 옮기기가 저장되지 않음: ' + r.bad.map(k => r.errs[k]).join(' / ');
        e = D.ADMIN_LOG[D.ADMIN_LOG.length - 1];
        if (e.target !== 'CEM유닛 → 경영지원유닛' || e.change.indexOf('진시환') < 0) return '조직 옮기기 이력에 전후 조직이나 사람이 빠짐: ' + e.target + ' / ' + e.change;
        return true;
      },
    },
    {
      name: '권한 변경 이력은 덧붙이기만: 저장해도 앞 기록이 바뀌지 않고, 화면의 이력 표에 고치기나 지우기 단추가 없음',
      kind: 'deny',
      run(h) {
        const pg = openPage(h, 'admin-users.js', { role: 'ADMIN' });
        const D = pg.env.D;
        const before = JSON.stringify(D.ADMIN_LOG);
        const n = D.ADMIN_LOG.length;
        pg.clickData('#user-rows', { 'data-edit': 'harin.pyeon@muhayu.com' });
        const r = submit(pg.modal, fakeForm(pg.modal, { dept: '경영지원유닛', status: 'ACTIVE', reason: '이동' }, { roles: ['CEM'] }));
        if (!r.saved) return '수정이 저장되지 않음(시험 확인)';
        if (D.ADMIN_LOG.length !== n + 1) return '이력이 한 줄 늘지 않음';
        if (JSON.stringify(D.ADMIN_LOG.slice(0, n)) !== before) return '저장하면서 앞 기록이 바뀜';
        pg.fire('#btn-history', 'click'); // 모두 보기
        const hist = pg.node('#history').innerHTML;
        if (!hist) return '이력 표를 그리지 않음(시험 확인)';
        if (/<button|<a |data-(edit|del|delete|remove)/.test(hist)) return '권한 변경 이력 표에 고치기나 지우기 단추가 있음';
        return true;
      },
    },
  ],
  serverOnly: [
    '영업이 권한 저장 요청을 직접 보냄: 서버가 관리자, 최고관리자인지 다시 확인해 거부(시안 C.adminSave는 읽기만 하는 역할만 막음)',
    '다른 도메인, 대소문자만 다른 중복 이메일, 사유 빈칸을 화면 검사를 지우고 보냄: 서버가 다시 확인해 거부(시안은 창의 check만 막음)',
    '이력 고치기나 지우기 요청: 서버가 받지 않음(시안에는 그 기능이 없음. 시안의 "시연 기록 지우기"는 이 브라우저의 시연 기록만 지우며 실제 시스템에서 뺌)',
  ],
};
