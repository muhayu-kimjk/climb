// AC-44 사용 중지 계정 막기 (CTL-101, 06 통제 목록 2장) 시험 (2026-11-13 주말 점검 W2)
//   사용자 권한 관리(admin-users.js)의 수정 창으로 사용 중지하고, 그 뒤의 결재 차례와 기록(common.js)을 봄
//   시안에는 로그인과 세션이 없어 "다음 요청부터 거부"는 서버 몫(serverOnly). 시안이 막는 것: 결재 단계 담당자를 먼저 바꾸게 함, 사용 중지 계정은 새로 맡기지 않음
//   화면 도우미는 lib.js의 openPage, fakeForm, submit
'use strict';
const { openPage, fakeForm, submit, stripTags: strip, env0 } = require('./lib');

// 관리자(윤재민)로 그 사람을 사용 중지해 봄 → { pg, r, f }
function suspend(h, email, opt) {
  const pg = openPage(h, 'admin-users.js', Object.assign({ role: 'ADMIN' }, opt || {}));
  pg.clickData('#user-rows', { 'data-edit': email });
  if (!pg.modal) return { pg, r: null };
  const a = pg.env.D.ACCOUNTS.find(x => x.email === email);
  const f = fakeForm(pg.modal, { dept: a.dept, status: 'SUSPENDED', reason: '퇴사(인사 담당 통보)' }, { roles: pg.env.C.activeRoles(a) });
  f.fireField('status', 'change');
  return { pg, f, r: submit(pg.modal, f), a };
}

module.exports = {
  ac: 'AC-44',
  title: '사용 중지 계정 막기',
  tests: [
    {
      name: '퇴사자(김태윤)를 사용 중지하면 상태가 사용 중지가 되고, 지난 결재 기록과 접속 기록에는 그 사람 이름이 그대로 남음',
      kind: 'ok',
      run(h) {
        const { pg, r, a } = suspend(h, 'taeyun.kim@muhayu.com');
        if (!r) return '수정 창이 열리지 않음';
        if (!r.saved) return '사용 중지가 저장되지 않음: ' + r.bad.map(k => r.errs[k]).join(' / ');
        const D = pg.env.D, C = pg.env.C, X = pg.env.X;
        if (a.status !== 'SUSPENDED') return '상태가 사용 중지가 아님: ' + a.status;
        if (!D.ACCOUNTS.some(x => x.id === 'u_taeyun_kim')) return '사용 중지한 계정이 목록에서 사라짐(지우지 않고 남겨야 함)';
        const hist = [];
        D.CONTRACTS.forEach(c => (c.history || []).forEach(x => { if (x.actorId === 'u_taeyun_kim') hist.push(x); }));
        if (!hist.length) return '시험 전제: 김태윤의 지난 결재 기록이 없음';
        if (hist.some(x => C.ownerLabel(x.actorId, x.actorDept).indexOf('김태윤') < 0)) return '지난 결재 기록의 이름이 보이지 않음';
        if (!X.accessLogs().some(l => l.userId === 'u_taeyun_kim' && l.act === 'APPROVE')) return '접속 기록에서 김태윤의 결재 기록이 사라짐';
        const e = D.ADMIN_LOG[D.ADMIN_LOG.length - 1];
        if (e.change.indexOf('상태: 사용 중 → 사용 중지') < 0) return '권한 변경 이력에 사용 중지가 남지 않음: ' + e.change;
        if (strip(pg.node('#user-rows').innerHTML).indexOf('김태윤') < 0) return '사용자 표에서 사용 중지한 사람이 사라짐';
        return true;
      },
    },
    {
      name: '결재 단계 담당자(④ 법무 김지우, ⑨ 고객지원 임하준)를 결재선 규칙에서 바꾸지 않고 사용 중지: 거부(새 결재 차례가 사용 중지 계정으로 가지 않게)',
      kind: 'deny',
      run(h) {
        for (const email of ['jiwoo.kim@muhayu.com', 'hajun.lim@muhayu.com']) {
          const { pg, r, a } = suspend(h, email);
          if (!r) return email + ' 수정 창이 열리지 않음';
          if (r.saved) return email + '(결재 단계 담당자)를 사용 중지함';
          if (!r.errs.status || r.errs.status.indexOf('결재선 규칙') < 0) return email + ': 결재선 규칙에서 담당자를 바꾸라는 안내가 없음: ' + JSON.stringify(r.errs);
          if (a.status !== 'ACTIVE') return email + ' 상태가 바뀜';
          if (pg.env.D.ADMIN_LOG.some(e => e.target.indexOf(email) > -1 && /사용 중지/.test(e.change) && e.at.slice(0, 10) === pg.env.D.TODAY)) return email + ': 거부했는데 이력이 남음';
        }
        return true;
      },
    },
    {
      name: '사용 중지한 재무 담당자(표예준)는 HR 충전 ⑩의 다른 재무 담당자로 새로 맡지 않음. 지금 차례인 결재가 있으면 대리 지정 전에는 사용 중지를 막음',
      kind: 'deny',
      run(h) {
        const pre = env0(h, { role: 'ADMIN' });
        if (pre.C.otherFinance('u_finance') !== 'u_yejun_pyo') return '시험 전제: 오현우 대신 ⑩을 맡을 사람이 표예준이 아님(' + pre.C.otherFinance('u_finance') + ')';
        // 표예준은 2512CL001-C01의 ⑩ 차례가 있어 대리 지정 없이는 사용 중지를 막음(admin-users.js: 차례인 결재는 원래 담당자에게 남으므로)
        const blocked = suspend(h, 'yejun.pyo@muhayu.com');
        if (!blocked.r) return '표예준 수정 창이 열리지 않음';
        if (blocked.r.saved) return '지금 차례인 결재가 남은 표예준을 대리 지정 없이 사용 중지함';
        // 대리 지정(방시현)을 걸어 두고 사용 중지
        const cover = D => D.DELEGATIONS.push({ id: 'DL-T44', absentId: 'u_yejun_pyo', delegateId: 'u_sihyun_bang', from: '2026-10-19', to: '2026-10-31', reason: '퇴사 전 인계', by: 'u_admin', at: '2026-10-19 09:00', endedAt: null });
        const { pg, r } = suspend(h, 'yejun.pyo@muhayu.com', { hook: cover });
        if (!r || !r.saved) return '대리 지정을 건 뒤에도 표예준 사용 중지가 저장되지 않음' + (r ? ': ' + r.bad.map(k => r.errs[k]).join(' / ') : '');
        if (pg.env.C.otherFinance('u_finance') === 'u_yejun_pyo') return '사용 중지한 표예준이 여전히 ⑩을 새로 맡음';
        // 다시 연 화면(저장한 시연 기록을 이어 봄)에서도 같음
        const again = env0(h, { role: 'ADMIN', store: pg.env.store, hook: cover });
        if (again.C.otherFinance('u_finance') === 'u_yejun_pyo') return '다시 연 화면에서 사용 중지한 표예준이 ⑩을 새로 맡음';
        return true;
      },
    },
    {
      name: '진행 중인 대리 지정의 대신할 사람(편하린, 임하준 대신 ⑨)을 사용 중지: 사용 중지를 막거나, 막지 않으면 그 사람은 결재 차례를 받지 않음',
      kind: 'deny',
      run(h) {
        // 시험용 대리 지정: ⑨ 담당 임하준(차례 여러 건) 대신 편하린, 오늘(2026-10-19)부터 2026-10-25
        const dl = D => D.DELEGATIONS.push({ id: 'DL-T44B', absentId: 'u_cem', delegateId: 'u_harin_pyeon', from: '2026-10-19', to: '2026-10-25',
          reason: '임하준 연차', by: 'u_admin', at: '2026-10-18 10:00', endedAt: null });
        const pre = env0(h, { role: 'CEM', hook: dl });
        if (!pre.C.pendingQueue(pre.U('u_harin_pyeon')).length) return '시험 전제: 대리 지정으로 편하린에게 온 차례가 없음';
        const { pg, r } = suspend(h, 'harin.pyeon@muhayu.com', { hook: dl });
        if (!r) return '편하린 수정 창이 열리지 않음';
        if (!r.saved) return true; // 대리 지정을 먼저 끝내라고 막으면 통과
        const after = env0(h, { role: 'CEM', hook: dl, store: pg.env.store });
        const u = after.U('u_harin_pyeon');
        if (after.C.accountOf('u_harin_pyeon').status !== 'SUSPENDED') return '시험 확인: 사용 중지가 반영되지 않음';
        const q = after.C.pendingQueue(u);
        if (q.length) return '사용 중지했는데 대리 지정으로 결재 차례 ' + q.length + '건을 계속 받음(예: ' + q[0].c.id + ' ' + q[0].s.step + ', 처리 가능 ' + after.C.canAct(q[0].c, q[0].s, u) + ')';
        return true;
      },
    },
    {
      name: '사용 중지 계정을 지우려 함: 수정 창의 상태는 사용 중지와 다시 사용뿐이고, 표에 지우기 단추가 없음',
      kind: 'deny',
      run(h) {
        const pg = openPage(h, 'admin-users.js', { role: 'ADMIN' });
        const rows = pg.node('#user-rows').innerHTML;
        if (!rows) return '사용자 표를 그리지 않음(시험 확인)';
        if (/data-(del|delete|remove)/.test(rows) || />\s*(삭제|지우기)\s*</.test(rows)) return '사용자 표에 지우기 단추가 있음';
        pg.clickData('#user-rows', { 'data-edit': 'taemin.ki@muhayu.com' }); // 이미 사용 중지(2026-10-02)
        if (!pg.modal) return '사용 중지 계정의 수정 창이 열리지 않음';
        const sel = (pg.modal.body.match(/<select[^>]*name="status"[\s\S]*?<\/select>/) || [])[0] || '';
        const opts = (sel.match(/<option value="([^"]*)"/g) || []).map(s => s.replace(/<option value="|"/g, ''));
        if (!opts.length) return '상태 고르기 칸을 찾지 못함(시험 확인)';
        const bad = opts.filter(v => ['SUSPENDED', 'ACTIVE', 'INVITED'].indexOf(v) < 0);
        if (bad.length) return '상태에 지우기 같은 다른 선택지가 있음: ' + bad.join(', ');
        if (/삭제|지우기/.test(strip(pg.modal.body))) return '수정 창에 지우기가 있음';
        return true;
      },
    },
    {
      name: '(C-44) ⑦ 체결본 등록 차례가 남은 영업대표(정하은)를 사용 중지: 막지 않고, 창에 영업대표인 계약 수가 보이며, ⑦은 그 유닛 영업 리더(고은성) 차례가 되고 "담당 지정 필요"가 보임',
      kind: 'deny',
      run(h) {
        const pre = env0(h, { role: 'ADMIN' });
        const n = pre.C.repBundlesOf('u_sales2').length;
        const c0 = pre.contract('2609CL002');
        if (!(c0.approvals || []).some(a => a.step === 'S07' && a.state === 'PENDING' && a.userId === 'u_sales2')) return '시험 전제: 2609CL002의 ⑦이 정하은 차례가 아님';
        const { pg, r, f } = suspend(h, 'haeun.jung@muhayu.com');
        if (!r) return '정하은 수정 창이 열리지 않음';
        const box = strip(f.sub('[data-rep-box]').innerHTML);
        if (box.indexOf('영업대표인 계약이 ' + n + '건') < 0) return '창에 영업대표인 계약 수(' + n + '건)가 보이지 않음: ' + box.slice(0, 120);
        if (!r.saved) return '⑦ 차례가 남은 영업대표의 사용 중지를 막음: ' + r.bad.map(k => r.errs[k]).join(' / ');
        // 영업 리더가 다음에 여는 화면(저장한 시연 기록을 이어 봄): 시안은 화면을 열 때 결재 차례를 다시 셈
        const lead = env0(h, { role: 'HEAD', store: pg.env.store });
        const C = lead.C, c = lead.contract('2609CL002');
        const s7 = (c.approvals || []).find(a => a.step === 'S07' && a.state === 'PENDING');
        if (C.repActorOf(c) !== 'u_eunseong_ko') return '⑦을 맡는 사람이 비즈니스2유닛 영업 리더(고은성)가 아님: ' + C.repActorOf(c);
        if (!s7 || !C.canAct(c, s7, lead.U('u_eunseong_ko'))) return '영업 리더 고은성이 ⑦ 체결본 등록을 처리할 수 없음(차례가 넘어가지 않음)';
        if (C.canAct(c, s7, lead.U('u_sales2'))) return '사용 중지한 정하은이 여전히 ⑦을 처리할 수 있음';
        if (!C.myActions(lead.U('u_eunseong_ko')).some(x => x.id === '2609CL002')) return '영업 리더 고은성의 처리할 계약에 2609CL002가 없음';
        if (String(C.repNote(c)).indexOf('담당 지정 필요') < 0) return '계약에 "담당 지정 필요"가 보이지 않음: ' + C.repNote(c);
        if (!pg.env.toasts.some(t => t.msg.indexOf('영업대표인 계약 ' + n + '건') > -1)) return '저장한 뒤 알림에 영업대표인 계약 수가 없음';
        return true;
      },
    },
    {
      // (2026-11-14 주말 점검, 코드 다시 보기 admin-01 ①, 결정할것 admin-01 ① [가정]) 찾은 사람의 재현: ⑧ 담당자를 10-01~10-10 동안 엄지훈으로 두면 2610CL014의
      //   ⑥ 인증서 서명(10-07)이 엄지훈 몫이고 ⑥ 전자계약 취소 확인 차례가 엄지훈에게 있음. 예전에는 사용 중지 셈에서 SSE를 늘 빼서, 넘겨받을 사람이 없어도
      //   저장되고 차례가 사용 중지된 계정에 남아 진행 중단이 끝나지 않았음
      name: '(admin-01) ⑥ 전자계약 취소 확인 차례가 남은 영업지원 리더(엄지훈)를 사용 중지: 넘겨받을 영업지원(배수아)이 있으면 저장되고 차례가 넘어가며, 아무도 없으면 막음',
      kind: 'deny',
      run(h) {
        const S08 = D => { D.ASSIGNEE_CHANGES.push({ step: 'S08', to: 'u_jihoon_eom', at: '2026-10-01 00:00' }, { step: 'S08', to: 'u_sadmin', at: '2026-10-10 00:00' }); };
        const pre = env0(h, { role: 'ADMIN', hook: S08 });
        const c0 = pre.contract('2610CL014');
        if (!(c0.approvals || []).some(a => a.step === 'SSE' && a.state === 'PENDING' && a.userId === 'u_jihoon_eom')) return '시험 전제: 2610CL014의 ⑥ 전자계약 취소 확인이 엄지훈 차례가 아님';
        // 넘겨받을 사람이 없음: 배수아와 석다인이 이미 사용 중지
        const none = D => { S08(D); ['u_sadmin', 'u_dain_seok'].forEach(id => { D.ACCOUNTS.find(a => a.id === id).status = 'SUSPENDED'; }); };
        const blocked = suspend(h, 'jihoon.eom@muhayu.com', { hook: none });
        if (!blocked.r) return '엄지훈 수정 창이 열리지 않음';
        if (blocked.r.saved) return '넘겨받을 영업지원이 없는데 전자계약 취소 확인 차례가 남은 리더를 사용 중지함';
        if (String(blocked.r.errs.status || '').indexOf('전자계약 취소 확인') < 0) return '전자계약 취소 확인을 먼저 끝내라는 안내가 없음: ' + JSON.stringify(blocked.r.errs);
        if (String(blocked.r.errs.status).indexOf('대리 지정') > -1) return '대리 지정 후보가 아닌데 대리 지정으로 넘기라고 안내함';
        if (blocked.a.status !== 'ACTIVE') return '막았는데 상태가 바뀜';
        // 넘겨받을 사람이 있음: 저장되고 다시 연 화면에서 배수아 차례
        const { pg, r, a } = suspend(h, 'jihoon.eom@muhayu.com', { hook: S08 });
        if (!r || !r.saved) return '넘겨받을 영업지원이 있는데 사용 중지가 막힘' + (r ? ': ' + r.bad.map(k => r.errs[k]).join(' / ') : '');
        if (a.status !== 'SUSPENDED') return '사용 중지가 반영되지 않음';
        const after = env0(h, { role: 'ADMIN', hook: S08, store: pg.env.store });
        const s = (after.contract('2610CL014').approvals || []).find(x => x.step === 'SSE' && x.state === 'PENDING');
        if (!s || s.userId !== 'u_sadmin') return '사용 중지 뒤 전자계약 취소 확인이 배수아에게 넘어가지 않음: ' + (s && s.userId);
        return true;
      },
    },
  ],
  serverOnly: [
    '사용 중지 계정이 열어 둔 세션으로 승인 요청: 서버가 요청마다 계정 상태를 확인해 거부하고, 사용 중지 때 열린 세션을 끊음(시안에는 로그인과 세션이 없음)',
    'Google 계정이 아직 살아 있어도 사용 중지면 로그인: 서버가 거부(시안에는 로그인이 없음)',
    '퇴사일과 사용 중지일이 맞는지: 지금은 시스템이 알 수 없음(G-23, CTL-114). 분기 권한 검토의 유닛 리더 표시(AC-45)로 봄',
    '사용 중지된 영업대표의 기안자 쪽 일을 그 유닛의 영업 리더에게 넘기는 것: 실제 시스템은 서버가 함(시안은 common.js repActorOf로 계산)',
  ],
};
