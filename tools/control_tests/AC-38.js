// AC-38 역할별 화면과 기능 (CTL-90, 06 통제 목록 2장) 시험 (2026-11-13 주말 점검 W2)
//   시안이 막는 것(메뉴와 화면 문, 단추를 그리는 판단 canAct, 읽기만 하는 역할의 recordAction과 adminSave 거절)은 시험하고,
//   주소나 요청을 직접 보내는 것(시안 recordAction과 adminSave는 역할을 다시 보지 않음)은 서버 몫(serverOnly)
//   가짜 화면 도우미(openPage, fakeForm, submit, env0, 글 다듬기 stripTags)는 lib.js에 있음(전에 이 파일의 kit였고 AC-39~AC-45도 함께 씀)
'use strict';
const { openPage, fakeForm, submit, stripTags: strip, env0 } = require('./lib');

// 관리 화면마다 [화면, 그 화면을 쓰는 역할(견줌), 영업에게 보이는 안내의 앞부분]
//   (2026-11-13 약한 시험 고침) 전에는 주소로 직접 여는 것을 admin-users와 다섯 화면만 봤음. 가격 기준, 거래처, 회사 설정, 설정 변경 확인도 주소로 열어 봄
//   그 화면을 쓰는 역할로 열면 본문이 보이고 안내가 없어야 함(견줌: 늘 감춰지는 화면이면 영업 시험이 뜻이 없음)
const ADMIN_PAGES = [
  ['admin-rules.js', 'ADMIN', '결재선 규칙은 관리자만 씁니다'],
  ['admin-restrict.js', 'ADMIN', '열람 제한 관리는 관리자만 씁니다'],
  ['admin-codes.js', 'ADMIN', '코드 관리는 관리자만 씁니다'],
  ['admin-products.js', 'ADMIN', '제품과 기능 관리는 관리자와 최고관리자만 씁니다'],
  ['admin-logs.js', 'PRIVACY', '접속 기록 점검은 정보보호 담당자가 합니다'],
  ['admin-prices.js', 'ADMIN', '가격 기준 관리는 관리자와 영업지원이 봅니다'],
  ['admin-customers.js', 'ADMIN', '거래처 관리는 관리자와 컴플라이언스 담당자가 씁니다'],
  ['company-settings.js', 'SUPER', '회사 설정은 최고관리자와 총무가 씁니다'],
  ['config-review.js', 'FIN_LEAD', '설정 변경 확인은 재무 리더와 법무가 씁니다'],
];
// 화면 도우미가 만든 요소 가운데 표 줄을 그리는 칸(#rows, #user-rows, #log-rows 등)의 글을 모두 이어 붙임
const rowsText = pg => Object.keys(pg.els).filter(k => /^#[\w-]*rows$/.test(k)).map(k => pg.els[k].innerHTML).join('');

module.exports = {
  ac: 'AC-38',
  title: '역할별 화면과 기능',
  tests: [
    {
      name: '관리자(윤재민)가 사용자 권한을 사유와 함께 저장하면 저장되고 이력이 남음',
      kind: 'ok',
      run(h) {
        const pg = openPage(h, 'admin-users.js', { role: 'ADMIN' });
        const D = pg.env.D, n0 = D.ADMIN_LOG.length;
        pg.clickData('#user-rows', { 'data-edit': 'jiho.yoo@muhayu.com' });
        if (!pg.modal) return '관리자에게 수정 창이 열리지 않음';
        const f = fakeForm(pg.modal, { dept: '비즈니스3유닛', status: 'ACTIVE', reason: '조직 개편으로 비즈니스3유닛 배치' }, { roles: ['SALES'] });
        const r = submit(pg.modal, f);
        if (!r.saved) return '저장되지 않음: ' + r.bad.map(k => r.errs[k]).join(' / ');
        const a = D.ACCOUNTS.find(x => x.id === 'u_jiho_yoo');
        if (a.dept !== '비즈니스3유닛') return '조직이 바뀌지 않음: ' + a.dept;
        const e = D.ADMIN_LOG[D.ADMIN_LOG.length - 1];
        if (D.ADMIN_LOG.length !== n0 + 1 || e.area !== 'USER' || e.by !== 'u_admin' || e.reason !== '조직 개편으로 비즈니스3유닛 배치') return '이력 한 줄(관리자, 사유)이 남지 않음: ' + JSON.stringify(e);
        return true;
      },
    },
    {
      name: '영업이 관리자 화면 주소(사용자 권한, 결재선 규칙, 열람 제한, 코드, 제품, 접속 기록 점검, 가격 기준, 거래처, 회사 설정, 설정 변경 확인)로 들어옴: 안내만 보이고 표와 단추가 없으며, 메뉴에도 관리자 화면이 없음(그 화면을 쓰는 역할은 본문을 봄)',
      kind: 'deny',
      run(h) {
        const pg = openPage(h, 'admin-users.js', { role: 'SALES', keepInit: true });
        if (!pg.node('#users').hidden) return '사용자 권한 관리 본문이 감춰지지 않음';
        if (!/관리자만 볼 수 있습니다/.test(strip(pg.node('#notice').innerHTML))) return '안내가 보이지 않음';
        if (pg.node('#user-rows').innerHTML) return '영업에게 계정 표를 그림';
        if ((pg.node('#btn-add')._ls.click || []).length || (pg.node('#user-rows')._ls.click || []).length) return '영업에게 추가나 수정 단추가 이어짐';
        const menu = pg.node('#site-header').innerHTML;
        if (!menu) return '머리글 메뉴를 그리지 못함(시험 틀 확인)';
        const leak = (menu.match(/href="(admin-[\w-]+|company-settings|config-review)\.html"/g) || []);
        if (leak.length) return '영업 메뉴에 관리자 화면이 보임: ' + leak.join(', ');
        const vals = { 'q-pick': '2026-Q3', 'cfg-month': '2026-09' };
        for (const [f, owner, say] of ADMIN_PAGES) {
          // 견줌: 그 화면을 쓰는 역할로 열면 본문이 보이고 안내가 없음
          const o = openPage(h, f, { role: owner, keepInit: true, values: vals });
          if (o.node('#content').hidden) return f + ': 견줌 실패, 그 화면을 쓰는 ' + owner + '에게도 본문이 감춰짐(시험 확인)';
          if (strip(o.node('#notice').innerHTML)) return f + ': 견줌 실패, ' + owner + '에게도 안내가 보임: ' + strip(o.node('#notice').innerHTML).slice(0, 60);
          // 영업이 주소로 직접 엶: 본문이 감춰지고 그 화면의 안내가 보이며 표 줄을 그리지 않음
          const p = openPage(h, f, { role: 'SALES', keepInit: true, values: vals });
          if (!p.node('#content').hidden) return f + ': 영업에게 본문이 보임';
          if (strip(p.node('#notice').innerHTML).indexOf(say) < 0) return f + ': 영업에게 "' + say + '" 안내가 보이지 않음: ' + strip(p.node('#notice').innerHTML).slice(0, 60);
          if (rowsText(p)) return f + ': 영업에게 표 줄을 그림';
        }
        return true;
      },
    },
    {
      name: '영업지원(담당자, 리더)은 가격 기준을 보기만: 추가 단추와 바꾸기 단추가 없음',
      kind: 'deny',
      run(h) {
        for (const role of ['SALES_ADMIN', 'SA_LEAD']) {
          const pg = openPage(h, 'admin-prices.js', { role });
          if (pg.node('#content').hidden) return role + ': 가격 기준을 보지도 못함(보기는 되어야 함)';
          if (!pg.node('#btn-add').hidden) return role + ': 가격 기준 추가 단추가 보임';
          const rows = pg.node('#rows').innerHTML;
          if (!rows) return role + ': 가격 기준 표가 비어 있음';
          if (/data-change=/.test(rows)) return role + ': 줄마다 바꾸기 단추가 보임';
        }
        const adm = openPage(h, 'admin-prices.js', { role: 'ADMIN' });
        if (!/data-change=/.test(adm.node('#rows').innerHTML)) return '관리자에게도 바꾸기 단추가 없음(시험 대조 실패)';
        return true;
      },
    },
    {
      name: '관찰자와 재무 리더, 재무 임원은 결재 단계(⑩ 재무 확인)를 처리할 수 없음',
      kind: 'deny',
      run(h) {
        const env = env0(h, { role: 'SUPER' });
        const c = env.contract('2609CL001');
        const s = (c.approvals || []).find(a => a.step === 'S10' && a.state === 'PENDING');
        if (!s) return '2609CL001의 ⑩ 차례를 찾지 못함(시험 데이터 확인)';
        if (!env.C.canAct(c, s, env.U(s.userId))) return '담당자 본인도 처리할 수 없음(시험 대조 실패)';
        for (const id of ['u_daon_yong', 'u_seojin_ma', 'u_jaewon_kook']) {
          if (env.C.canAct(c, s, env.U(id))) return id + '(' + env.U(id).role + ')에게 처리 단추가 보임';
        }
        const n = c.history.length;
        if (env.C.recordAction(c, s, 'APPROVE', '관찰자 승인 시도', env.U('u_daon_yong')) !== null) return '관찰자의 승인 기록을 받음';
        if (c.history.length !== n) return '관찰자 시도로 결재 기록이 늘어남';
        return true;
      },
    },
    {
      name: '감사 열람(인채율, 끝나는 날 전)이 결재, 기안, 의견, 관리자 저장을 하려 함: 모두 거부',
      kind: 'deny',
      run(h) {
        const env = env0(h, { role: 'AUDIT' });
        const C = env.C, D = env.D, me = C.currentUser();
        if (me.id !== 'u_chaeyul_in') return '시연 감사 열람이 인채율이 아님: ' + me.id;
        if (!C.isReadOnly(me)) return '감사 열람이 읽기만 하는 역할로 잡히지 않음';
        const c = env.contract('2610CL007');
        const s = c.approvals.find(a => a.state === 'PENDING');
        if (C.canAct(c, s, me)) return '감사 열람에게 결재 처리 단추가 보임';
        const n = c.history.length;
        if (C.recordAction(c, s, 'APPROVE', '감사 열람 승인 시도', me) !== null || c.history.length !== n) return '감사 열람의 결재 기록을 받음';
        if (C.myActions(me).length) return '감사 열람에게 처리할 계약이 있음';
        const fc = env.contract('2609CL001');
        if (C.canWriteFinOpinion(fc, me) || C.addFinOpinion(fc, '의견 시도', me) !== null) return '감사 열람이 재무 의견을 남김';
        const m = D.ADMIN_LOG.length;
        const r = C.adminSave('USER', '시험', '시험', '감사 열람 저장 시도', null);
        if (!r.refused || D.ADMIN_LOG.length !== m) return '감사 열람의 관리자 저장을 받음';
        const pg = openPage(h, 'new-contract.js', { role: 'AUDIT' });
        if (!/계약 등록은 영업만/.test(strip(pg.node('#notice').innerHTML))) return '감사 열람에게 계약 등록(기안) 화면이 열림';
        return true;
      },
    },
    {
      name: '끝나는 날이 지난 감사 열람(반서율, 2026-10-15 끝남)이 결재와 관리자 저장을 하려 함: 거부, 점검 화면도 못 엶',
      kind: 'deny',
      run(h) {
        const env = env0(h, { role: 'AUDIT', hook: D => { D.DEMO_PERSONA.AUDIT = 'u_seoyul_ban'; } });
        const C = env.C, D = env.D, me = C.currentUser();
        if (me.id !== 'u_seoyul_ban' || me.role !== 'AUDIT') return '시험 사람을 만들지 못함: ' + me.id + ' ' + me.role;
        if (!C.roleEnded(me.id, 'AUDIT')) return '반서율의 감사 열람이 끝난 것으로 잡히지 않음';
        if (!C.isReadOnly(me)) return '끝난 역할이 읽기만 하는 것으로 잡히지 않음';
        const c = env.contract('2610CL007');
        const s = c.approvals.find(a => a.state === 'PENDING');
        if (C.recordAction(c, s, 'APPROVE', '끝난 역할 승인 시도', me) !== null) return '끝난 역할의 결재 기록을 받음';
        const m = D.ADMIN_LOG.length;
        const r = C.adminSave('USER', '시험', '시험', '끝난 역할 저장 시도', null);
        if (!r.refused || D.ADMIN_LOG.length !== m) return '끝난 역할의 관리자 저장을 받음';
        if (C.gate(me, ['AUDIT'], '시험')) return '끝난 감사 열람이 감사 열람 화면 문을 통과함';
        return true;
      },
    },
    {
      name: '관리자는 감사 열람을 주거나 뺄 수 없음(추가 창에 없고, 가진 사람의 체크는 잠김). 최고관리자는 고를 수 있음',
      kind: 'deny',
      run(h) {
        const pg = openPage(h, 'admin-users.js', { role: 'ADMIN' });
        pg.fire('#btn-add', 'click');
        if (!pg.modal) return '추가 창이 열리지 않음';
        if (/value="AUDIT"/.test(pg.modal.body)) return '관리자의 사용자 추가 창에 감사 열람이 있음';
        pg.clickData('#user-rows', { 'data-edit': 'chaeyul.in@muhayu.com' });
        const box = (pg.modal.body.match(/<input[^>]*value="AUDIT"[^>]*>/) || [])[0];
        if (!box) return '감사 열람을 가진 사람의 수정 창에 감사 열람 표시가 없음';
        if (!/disabled/.test(box)) return '관리자가 감사 열람 체크를 바꿀 수 있음: ' + box;
        const sp = openPage(h, 'admin-users.js', { role: 'SUPER' });
        sp.fire('#btn-add', 'click');
        const sbox = (sp.modal.body.match(/<input[^>]*value="AUDIT"[^>]*>/) || [])[0];
        if (!sbox || /disabled/.test(sbox)) return '최고관리자도 감사 열람을 고를 수 없음(시험 대조 실패)';
        return true;
      },
    },
    {
      name: '최고관리자가 감사 열람 끝나는 날을 1년(365일) 넘게 정함: 거부 [가정]',
      kind: 'deny',
      run(h) {
        const pg = openPage(h, 'admin-users.js', { role: 'SUPER' });
        const C = pg.env.C, D = pg.env.D;
        pg.fire('#btn-add', 'click');
        const base = { email: 'audit.test@muhayu.com', uname: '시험감사', dept: '경영지원실', reason: '내부감사 지원' };
        const over = submit(pg.modal, fakeForm(pg.modal, Object.assign({ auditUntil: C.addDays(D.TODAY, 366) }, base), { roles: ['AUDIT'] }));
        if (over.saved || !over.errs.auditUntil) return '366일 뒤 끝나는 날을 받음';
        if (D.ACCOUNTS.some(a => a.email === 'audit.test@muhayu.com')) return '거부했는데 계정이 생김';
        pg.clickData('#user-rows', { 'data-edit': 'chaeyul.in@muhayu.com' });
        const ed = submit(pg.modal, fakeForm(pg.modal, { dept: '경영지원실', status: 'ACTIVE', auditUntil: C.addDays(D.TODAY, 400), reason: '감사 연장' }, { roles: ['AUDIT'] }));
        if (ed.saved || !ed.errs.auditUntil) return '수정 창에서 400일 뒤 끝나는 날을 받음';
        pg.fire('#btn-add', 'click');
        const ok = submit(pg.modal, fakeForm(pg.modal, Object.assign({ auditUntil: C.addDays(D.TODAY, 365) }, base), { roles: ['AUDIT'] }));
        if (ok.errs.auditUntil) return '365일 뒤(1년 안)도 거부함: ' + ok.errs.auditUntil;
        return true;
      },
    },
  ],
  serverOnly: [
    '영업이 관리자 화면의 데이터를 직접 요청: 서버가 데이터를 보내지 않음(시안은 예시 데이터를 모두 불러 화면에서만 감춤)',
    '영업지원이 가격 기준 저장 요청을 직접 보냄: 서버가 거부(시안 C.adminSave는 읽기만 하는 역할만 막고 관리자인지는 다시 보지 않음)',
    '재무 리더가 승인 요청을 직접 보냄: 서버가 거부(시안 recordAction은 그 단계 담당자인지 다시 검사하지 않음)',
    '메뉴를 숨겨도 저장 요청을 직접 보냄: 서버가 모든 데이터와 저장 요청에서 역할을 다시 확인',
    '감사 열람이 기안 저장 요청을 직접 보냄: 서버가 거부(시안 saveDemoContract는 역할을 다시 보지 않고, 화면은 계약 등록 문에서 막음)',
    '관리자가 감사 열람을 주거나 빼는 저장 요청을 직접 보냄: 서버가 최고관리자인지 확인(시안 adminSave는 다시 보지 않음)',
    '주소(?role=)나 브라우저 저장소로 역할을 바꿈: 서버는 계정의 역할만 씀(시안 전용 시연 길)',
    '겸임: 서버는 가진 역할 전체로 판단(시안은 한 사람에게 역할 하나로 시연해 겸임을 시험할 수 없음)',
  ],
};
