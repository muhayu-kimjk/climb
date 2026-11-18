// AC-43 자기 권한 못 바꿈 (CTL-99, 06 통제 목록 2장) 시험 (2026-11-13 주말 점검 W2)
//   사용자 권한 관리(admin-users.js)의 수정 창(openEdit), 권한 체크 묶음(rolesHtml), 조직 옮기기(openMove)를 가짜 문서에 올려 봄
//   시안 관리자: 윤재민(u_admin, 관리자), 송민재(u_minjae_song, 법무 담당자와 관리자), 최고관리자 원지안(u_super)
//   화면 도우미는 lib.js의 openPage, fakeForm, submit
'use strict';
const { openPage, fakeForm, submit, stripTags: strip } = require('./lib');

const asMinjae = D => { D.DEMO_PERSONA.ADMIN = 'u_minjae_song'; }; // 관리자 역할을 송민재로 시연

module.exports = {
  ac: 'AC-43',
  title: '자기 권한 못 바꿈',
  tests: [
    {
      name: '관리자 A(윤재민)가 관리자 B(송민재)의 권한을 사유와 함께 바꾸면 저장됨',
      kind: 'ok',
      run(h) {
        const pg = openPage(h, 'admin-users.js', { role: 'ADMIN' });
        const D = pg.env.D;
        pg.clickData('#user-rows', { 'data-edit': 'minjae.song@muhayu.com' });
        if (!pg.modal) return '송민재의 수정 창이 열리지 않음: ' + pg.env.toasts.map(t => t.msg).join(' / ');
        const r = submit(pg.modal, fakeForm(pg.modal, { dept: '경영지원유닛', status: 'ACTIVE', reason: '관리자 겸임을 끝냄(경영지원유닛 요청)' }, { roles: ['LEGAL'] }));
        if (!r.saved) return '저장되지 않음: ' + r.bad.map(k => r.errs[k]).join(' / ');
        const a = D.ACCOUNTS.find(x => x.id === 'u_minjae_song');
        if (a.roles.join() !== 'LEGAL') return '권한이 바뀌지 않음: ' + a.roles.join();
        const e = D.ADMIN_LOG[D.ADMIN_LOG.length - 1];
        if (e.by !== 'u_admin' || e.target.indexOf('minjae.song') < 0) return '이력의 바꾼 사람이나 대상이 다름: ' + JSON.stringify(e);
        return true;
      },
    },
    {
      name: '관리자가 자기 줄의 수정을 누름(윤재민, 송민재, 최고관리자 원지안): 수정 창이 열리지 않고 다른 관리자에게 요청하라는 안내',
      kind: 'deny',
      run(h) {
        for (const [role, hook, email] of [['ADMIN', null, 'jaemin.yoon@muhayu.com'], ['ADMIN', asMinjae, 'minjae.song@muhayu.com'], ['SUPER', null, 'jian.won@muhayu.com']]) {
          const pg = openPage(h, 'admin-users.js', { role, hook: hook || undefined });
          const n = pg.env.D.ADMIN_LOG.length;
          pg.clickData('#user-rows', { 'data-edit': email });
          if (pg.modal) return email + ' 본인에게 자기 줄 수정 창이 열림';
          if (!pg.env.toasts.some(t => t.warn && t.msg.indexOf('자기 권한은 다른 관리자에게') > -1)) return email + ': 자기 권한 안내가 없음';
          if (pg.env.D.ADMIN_LOG.length !== n) return email + ': 이력이 늘어남';
        }
        return true;
      },
    },
    {
      name: '최고관리자가 아닌 관리자의 사용자 추가 창과 수정 창에 최고관리자 체크가 없음(최고관리자에게는 있음)',
      kind: 'deny',
      run(h) {
        const pg = openPage(h, 'admin-users.js', { role: 'ADMIN' });
        pg.fire('#btn-add', 'click');
        if (!pg.modal) return '추가 창이 열리지 않음';
        if (/value="SUPER"/.test(pg.modal.body)) return '관리자의 사용자 추가 창에 최고관리자 체크가 있음';
        pg.clickData('#user-rows', { 'data-edit': 'minjae.song@muhayu.com' });
        if (/value="SUPER"/.test(pg.modal.body)) return '관리자의 수정 창에 최고관리자 체크가 있음';
        const sp = openPage(h, 'admin-users.js', { role: 'SUPER' });
        sp.fire('#btn-add', 'click');
        if (!/value="SUPER"/.test(sp.modal.body)) return '최고관리자의 추가 창에도 최고관리자 체크가 없음(시험 대조 실패)';
        return true;
      },
    },
    {
      name: '최고관리자가 아닌 관리자가 최고관리자 계정(원지안)을 고치려 함: 수정 창이 열리지 않음',
      kind: 'deny',
      run(h) {
        const pg = openPage(h, 'admin-users.js', { role: 'ADMIN' });
        pg.clickData('#user-rows', { 'data-edit': 'jian.won@muhayu.com' });
        if (pg.modal) return '관리자에게 최고관리자 계정 수정 창이 열림';
        if (!pg.env.toasts.some(t => t.msg.indexOf('최고관리자 계정은 최고관리자만') > -1)) return '최고관리자 계정 안내가 없음';
        return true;
      },
    },
    {
      name: '관리자가 조직 옮기기로 자기 조직을 바꾸려 함: 옮길 사람 목록에 본인(과 최고관리자)이 없고 "본인은 다른 관리자가 옮깁니다"가 보임',
      kind: 'deny',
      run(h) {
        const pg = openPage(h, 'admin-users.js', { role: 'ADMIN' });
        const D = pg.env.D;
        pg.fire('#btn-move', 'click');
        if (!pg.modal) return '조직 옮기기 창이 열리지 않음';
        const vals = { from: '경영지원유닛', to: '경영지원실', reason: '조직 개편 시험' };
        const f = fakeForm(pg.modal, vals);
        f.fireField('from', 'change');
        const list = String(f.sub('#move-people').innerHTML);
        if (!list) return '옮길 사람 목록을 그리지 않음(시험 확인)';
        if (list.indexOf('value="jaemin.yoon@muhayu.com"') > -1) return '옮길 사람 목록에 본인(윤재민)이 있음';
        if (list.indexOf('value="jian.won@muhayu.com"') > -1) return '관리자의 옮길 사람 목록에 최고관리자(원지안)가 있음';
        if (strip(list).indexOf('본인은 다른 관리자가 옮깁니다') < 0) return '"본인은 다른 관리자가 옮깁니다"가 보이지 않음';
        if (list.indexOf('value="eunchae.noh@muhayu.com"') < 0) return '같은 조직의 다른 사람(노은채)도 목록에 없음(시험 대조 실패)';
        // 목록에 없는 본인 이메일을 넣어 보내면 시안은 막지 않음 → 서버 몫(serverOnly). 여기서는 화면 목록만 봄
        if (D.ACCOUNTS.find(a => a.id === 'u_admin').dept !== '경영지원유닛') return '시험 중 본인 조직이 바뀜';
        return true;
      },
    },
    {
      name: '관리자 두 명(윤재민, 송민재)이 서로 권한을 줌: 막지 않지만 두 변경이 분기 권한 검토의 "권한을 바꾼 기록"과 관리자 변경 이력에 보임',
      kind: 'deny',
      run(h) {
        const vals = { 'q-pick': '2026-Q3', 'cfg-month': '2026-09' };
        const count = pg => { const m = strip(pg.node('#q-lines').innerHTML).match(/권한을 바꾼 기록 (\d+)건/); return m ? Number(m[1]) : -1; };
        const base = count(openPage(h, 'admin-logs.js', { role: 'PRIVACY', values: vals }));
        if (base < 0) return '분기 권한 검토 자료에서 "권한을 바꾼 기록"을 찾지 못함(시험 확인)';
        const a = openPage(h, 'admin-users.js', { role: 'ADMIN' });
        a.clickData('#user-rows', { 'data-edit': 'minjae.song@muhayu.com' });
        let r = submit(a.modal, fakeForm(a.modal, { dept: '경영지원유닛', status: 'ACTIVE', reason: '총무 일 지원' }, { roles: ['LEGAL', 'ADMIN', 'GA'] }));
        if (!r.saved) return '윤재민이 송민재에게 준 권한이 저장되지 않음: ' + r.bad.map(k => r.errs[k]).join(' / ');
        const b = openPage(h, 'admin-users.js', { role: 'ADMIN', hook: asMinjae, store: a.env.store });
        if (b.env.C.currentUser().id !== 'u_minjae_song') return '송민재로 시연하지 못함(시험 확인)';
        b.clickData('#user-rows', { 'data-edit': 'jaemin.yoon@muhayu.com' });
        if (!b.modal) return '송민재에게 윤재민 수정 창이 열리지 않음';
        r = submit(b.modal, fakeForm(b.modal, { dept: '경영지원유닛', status: 'ACTIVE', reason: '총무 일 지원' }, { roles: ['ADMIN', 'GA'] }));
        if (!r.saved) return '송민재가 윤재민에게 준 권한이 저장되지 않음: ' + r.bad.map(k => r.errs[k]).join(' / ');
        const p = openPage(h, 'admin-logs.js', { role: 'PRIVACY', values: Object.assign({ 'adm-q': '총무 일 지원' }, vals), store: b.env.store });
        if (count(p) !== base + 2) return '분기 권한 검토의 "권한을 바꾼 기록"이 ' + base + '건에서 ' + count(p) + '건(2건 늘어야 함)';
        const adm = strip(p.node('#adm-rows').innerHTML);
        if (adm.indexOf('송민재 (minjae.song@muhayu.com)') < 0 || adm.indexOf('윤재민 (jaemin.yoon@muhayu.com)') < 0) return '관리자 변경 이력에 서로 준 두 변경이 함께 보이지 않음';
        return true;
      },
    },
  ],
  serverOnly: [
    '관리자가 자기 줄의 수정 요청을 직접 보냄: 서버가 바꾸는 사람과 대상 계정을 비교해 거부(시안 C.adminSave는 다시 보지 않음)',
    '최고관리자가 아닌 관리자가 사용자 추가 창에 최고관리자 체크를 넣어 보냄: 서버가 거부(시안은 추가 창의 저장에서 이것을 다시 확인하지 않음, 06 AC-43)',
    '조직 옮기기 요청에 본인 이메일을 넣어 보냄: 서버가 거부(시안은 목록에서 빼기만 하고 저장에서 다시 보지 않음)',
    '관리자 두 명이 서로 권한을 줌: 시스템이 막지 않음(06 AC-43). 둘을 짝으로 묶어 알리는 기능은 없고 분기 권한 검토에서 사람이 봄',
  ],
};
