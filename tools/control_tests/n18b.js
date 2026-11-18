// 2026-11-18 셋째 점검 고침 시험 (audit-trail-04, audit-trail-05, regress-01, regress-02). 그 통제의 AC 파일 끝에서 require('./n18b')('AC-xx')로 더함
//   n16.js와 같은 모양: AC 번호마다 시험 목록. 이번 고침은 AC-45.js 한 곳에서만 불러오므로(그 묶음의 맡은 파일) 네 가지를 모두 'AC-45' 아래에 둠.
//   시험 이름 앞 괄호에 그 시험이 원래 속한 통제와 AC 번호를 적어 둠(AC-45 분기 권한 검토, AC-39 예전 계약 기록, ②⑧ 직무 분리 REQ-AUTH-16).
//   나중에 문서를 고칠 때 그 AC 파일로 옮겨도 됨(이 파일의 키만 바꾸고 그 AC 파일 끝에 한 줄)
'use strict';
const lib = require('./lib');
const { page, review, openPage, fakeForm, submit, env0, stripTags: strip } = lib;

const step = (c, code) => (c.approvals || []).find(a => a.step === code);

// ---------- audit-trail-04 도우미: 시연 확인 기록(비즈니스2유닛 리더 고은성, 2026-10-17 11:00)의 안채원 표시를 "이동"으로 ----------
const DEMO_ACK = e => e.op && e.op.k === 'UNIT_LIST_ACK' && e.at === '2026-10-17 11:00' && e.by === 'u_eunseong_ko';
const toMove = D => { const e = D.ADMIN_LOG.find(DEMO_ACK); if (e) e.op.r.marks = [{ id: 'u_chaewon_ahn', name: '안채원', email: 'chaewon.ahn@muhayu.com', mark: 'MOVE', note: '비즈니스1유닛으로 옮김(시험)' }]; };
// 관리자가 코드 관리에서 조직 BIZ_2(비즈니스2유닛)의 이름만 바꿈 → 저장소(시연 기록)
function renameUnit(h, hook) {
  const adm = env0(h, { role: 'ADMIN', hook });
  const e = adm.C.adminSave('CODE', '조직 BIZ_2', '이름: 비즈니스2유닛 → HR영업유닛', '조직 이름 바꿈(시험)', { k: 'CODE_EDIT', group: 'DEPT', code: 'BIZ_2', set: { label: 'HR영업유닛' } });
  return { adm, refused: !!e.refused };
}
// 접속 기록 점검(정보보호)을 열고 3분기 검토 창에 "이상 없음"을 넣어 봄(AC-45.js의 logs, review와 같은 모양)
function logsReview(h, store, hook) {
  const pg = openPage(h, 'admin-logs.js', { role: 'PRIVACY', store, hook, values: { 'q-pick': '2026-Q3', 'cfg-month': '2026-09' } });
  pg.modal = null;
  pg.clickData('#content', { 'data-quarter': '2026-Q3' });
  const r = pg.modal ? submit(pg.modal, fakeForm(pg.modal, { note: '모든 계정의 권한이 하는 일에 맞음', act: '' }, { result: ['OK'] })) : null;
  return { pg, r, marks: strip(pg.node('#mark-rows').innerHTML) };
}

// ---------- regress-01 도우미: 관리자가 나중에 이도윤(u_sales1, 영업)에게 영업지원 역할을 더한 저장소 ----------
const ADD_SA = { at: '2026-10-19 09:00', by: 'u_admin', area: 'USER', target: '이도윤 (doyun.lee@muhayu.com)', change: '역할: 영업 → 영업, 영업지원', reason: '겸임(시험)',
  op: { k: 'ACCOUNT_EDIT', email: 'doyun.lee@muhayu.com', set: { roles: ['SALES', 'SALES_ADMIN'] } } };
const addSaStore = () => ({ 'climb.demoAdmin': JSON.stringify([ADD_SA]) });
// 결재란 휴대폰 목록(#approval-list)에서 그 단계 덩어리의 글(표와 같은 칸 자료)
function boxStep(rv, no) {
  const li = String(rv.dom.q('#approval-list').innerHTML).split('<li').slice(1).map(x => strip('<li' + x)).find(x => x.indexOf(no + ' ') === 0);
  return li || '';
}

// ---------- audit-trail-05, regress-02 도우미: 영업지원 리더(엄지훈)가 올린 예전 기록 LG-0009 ----------
function addLeadRecord(D, at, restricted) {
  const base = D.CONTRACTS.find(c => c.id === 'LG-0001');
  D.CONTRACTS.push(Object.assign(JSON.parse(JSON.stringify(base)), { id: 'LG-0009', restricted: !!restricted,
    legacy: Object.assign({}, base.legacy, { by: 'u_jihoon_eom', dept: '세일즈어드민유닛', at: at, byLead: true, docNo: '영업-2025-0901' }) }));
}
// 컴플라이언스(반서율)가 보기 화면에서 "확인 남기기"를 눌러 결과를 저장 → { env, modal, errs }
function ownCheck(h, result, memo) {
  const env = h.fresh({ role: 'COMPLIANCE', hook: D => addLeadRecord(D, '2026-10-15 10:00', true) });
  let modal = null;
  env.C.formModal = o => { modal = o; };
  const dom = page(env, 'legacy-contract.js', '?role=COMPLIANCE&id=LG-0009', { user: env.U('u_seoyul_ban') });
  if (dom.error) return { env, why: '보기 화면을 열지 못함: ' + dom.error.message };
  dom.fire('#btn-own-check', 'click');
  if (!modal) return { env, why: '확인 남기기 창이 열리지 않음' };
  // 확인 창은 input[name="result"]:checked와 elements.memo만 읽음
  const f = { querySelector: s => (/name="result"\]:checked/.test(s) ? { value: result } : null), elements: { memo: { value: memo || '' } } };
  const errs = modal.check(f) || {};
  if (Object.keys(errs).some(k => errs[k])) return { env, why: '확인 창이 저장을 막음: ' + JSON.stringify(errs) };
  modal.done(f);
  return { env, why: '' };
}

const T = {
  'AC-45': [
    // ---------- audit-trail-04 (AC-45 분기 권한 검토, CTL-114) ----------
    {
      name: '(2026-11-18 셋째 점검 audit-trail-04, AC-45) "이동" 표시 뒤 코드 관리에서 그 유닛의 이름만 바꾸면 처리 전이 그대로(pendingMarks, 조치할 계정, "이상 없음" 막음). 실제로 다른 조직으로 옮기면 처리함',
      kind: 'deny',
      run(h) {
        const { adm, refused } = renameUnit(h, toMove);
        if (refused) return '시험 전제: 관리자 저장이 거부됨';
        const { C, D } = adm;
        const acc = D.ACCOUNTS.find(a => a.id === 'u_chaewon_ahn');
        if (acc.dept !== 'HR영업유닛') return '시험 전제: 조직 이름을 바꿨는데 안채원의 조직이 새 이름이 아님: ' + acc.dept;
        const ack = D.ADMIN_LOG.find(DEMO_ACK);
        if (!ack || ack.op.r.unit !== 'HR영업유닛') return '유닛 계정 확인 기록의 유닛 이름이 새 이름으로 바뀌지 않음: ' + (ack && ack.op.r.unit);
        const sent = D.ADMIN_LOG.filter(e => e.op && e.op.k === 'UNIT_LIST_SENT').map(e => (e.op.r.units || []).map(u => u.unit)).reduce((a, b) => a.concat(b), []);
        if (sent.indexOf('비즈니스2유닛') > -1 || sent.indexOf('HR영업유닛') < 0) return '확인 요청 보낸 기록의 유닛 이름이 새 이름으로 바뀌지 않음: ' + sent.join(',');
        const pm = C.pendingMarks().u_chaewon_ahn;
        if (!pm || pm.mark !== 'MOVE') return '조직 이름만 바꿨는데 이동 표시가 처리함이 되어 처리 전 목록에서 사라짐';
        if (C.markHandled(acc, { mark: 'MOVE' }, ack.op.r.unit, ack.at)) return 'markHandled가 이름만 바뀐 조직을 다른 조직으로 봄';
        // 접속 기록 점검(정보보호): 저장소의 이름 바꾸기 기록을 다시 불러와도 조치할 계정이 처리 전이고 "이상 없음"을 막음
        const x = logsReview(h, adm.store, toMove);
        if (x.marks.indexOf('처리 전') < 0 || x.marks.indexOf('처리함') > -1) return '접속 기록 점검의 조치할 계정이 처리 전이 아님: ' + x.marks.slice(0, 160);
        if (!x.r) return '시험 전제: 3분기 검토 창이 열리지 않음';
        if (x.r.saved) return '처리 전인 이동 표시가 있는데 "이상 없음"을 받음(CTL-114 막음이 풀림)';
        // 견줌: 관리자가 실제로 다른 조직(비즈니스1유닛)으로 옮기면 처리함
        const adm2 = env0(h, { role: 'ADMIN', hook: toMove, store: adm.store });
        adm2.C.adminSave('USER', '안채원 (chaewon.ahn@muhayu.com)', '조직: HR영업유닛 → 비즈니스1유닛', '인사이동(시험)', { k: 'ACCOUNT_EDIT', email: 'chaewon.ahn@muhayu.com', set: { dept: '비즈니스1유닛' } });
        if (adm2.C.pendingMarks().u_chaewon_ahn) return '견줌: 다른 조직으로 옮겼는데 처리 전으로 남음';
        const y = logsReview(h, adm2.store, toMove);
        if (y.marks.indexOf('처리함') < 0) return '견줌: 옮긴 뒤 조치할 계정이 처리함이 아님: ' + y.marks.slice(0, 160);
        return true;
      },
    },

    // ---------- audit-trail-05 (AC-39 예전 계약 기록, CTL-143과 CTL-78) ----------
    {
      name: '(2026-11-18 셋째 점검 audit-trail-05, AC-39) [가정] 컴플라이언스가 리더 기록에 "맞지 않는 것이 있음"을 남기면 넘어온 일(찾은 곳 LEGACY) 한 건이 생기고 넘김 글에 메모가 없으며, 확인 기록에 그 번호가 남음. "맞음"은 넘기지 않음',
      kind: 'deny',
      run(h) {
        const MEMO = '계약 금액 10,800,000원이 체결본(9,800,000원)과 다름(시험)';
        const d = ownCheck(h, 'DIFF', MEMO);
        if (d.why) return d.why;
        const { C, X } = d.env;
        const issues = X.pendingIssues().filter(i => i.source === 'LEGACY' && i.ref === 'LG-0009');
        if (issues.length !== 1) return '맞지 않음인데 넘어온 일(찾은 곳 LEGACY, LG-0009)이 ' + issues.length + '건';
        const raised = d.env.D.ADMIN_LOG.filter(e => e.op && e.op.k === 'ISSUE_RAISE' && e.op.i && e.op.i.id === issues[0].id);
        if (JSON.stringify(issues[0]).indexOf('10,800,000') > -1 || JSON.stringify(raised).indexOf('10,800,000') > -1) return '넘김 글에 확인 메모(금액)가 들어감(leak-records-02)';
        const e = C.legacyOwnCheckOf(d.env.contract('LG-0009'));
        if (!e || e.op.result !== 'DIFF' || e.op.issueId !== issues[0].id) return '확인 기록에 넘긴 번호(issueId)가 남지 않음: ' + JSON.stringify(e && e.op);
        // 보기 화면의 "컴플라이언스 확인" 칸에 넘긴 번호가 보임
        const dom = page(d.env, 'legacy-contract.js', '?role=COMPLIANCE&id=LG-0009', { user: d.env.U('u_seoyul_ban') });
        if (String(dom.q('#v-info').innerHTML).indexOf('컴플라이언스에 넘김(' + issues[0].id + ')') < 0) return '컴플라이언스 확인 칸에 넘긴 번호가 보이지 않음';
        // 견줌: 맞음은 넘기지 않고 issueId가 비어 있음
        const m = ownCheck(h, 'MATCH', '');
        if (m.why) return '견줌: ' + m.why;
        if (m.env.X.pendingIssues().some(i => i.ref === 'LG-0009')) return '견줌: 맞음인데 넘어온 일이 생김';
        const em = m.env.C.legacyOwnCheckOf(m.env.contract('LG-0009'));
        if (!em || em.op.result !== 'MATCH' || em.op.issueId) return '견줌: 맞음 확인 기록이 이상함: ' + JSON.stringify(em && em.op);
        return true;
      },
    },

    // ---------- regress-01 (②⑧ 직무 분리, REQ-AUTH-16 새 결정 N-2, REQ-AUTH-06 v0.25) ----------
    {
      name: '(2026-11-18 셋째 점검 regress-01, ②⑧ 직무 분리) [가정] 관리자가 나중에 이도윤에게 영업지원 역할을 더해도 이미 기안한 계약의 ②⑧은 영업지원 그대로(차례인 단계, 결재란, 열람)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SUPER', store: addSaStore() });
        const { C, D } = env;
        const acc = D.ACCOUNTS.find(a => a.id === 'u_sales1');
        if ((acc.roles || []).indexOf('SALES_ADMIN') < 0) return '시험 전제: 관리자 변경 이력을 되풀이했는데 이도윤에게 영업지원 역할이 없음';
        for (const [id, code] of [['2610CL007', 'S02'], ['2610CL010', 'S02'], ['2609CL003', 'S08'], ['2609CL005', 'S08']]) {
          const c = env.contract(id);
          const s = step(c, code);
          if (!s || s.state !== 'PENDING') return '시험 전제: ' + id + ' ' + code + '가 차례가 아님';
          if (s.userId !== 'u_sadmin') return id + ' ' + code + '의 차례가 역할을 더한 뒤 ' + s.userId + '에게 옮겨 감(기안한 때의 역할로 정하지 않음)';
          if (!c.drafterSa || c.drafterSa.v !== false || c.drafterSa.at !== c.requestedAt) return id + '에 기안한 때의 영업지원 역할(drafterSa)이 남지 않음: ' + JSON.stringify(c.drafterSa);
        }
        const c7 = env.contract('2610CL007');
        if (C.stepTag('S02', c7) !== '② 영업지원') return '2610CL007 ② 이름이 영업지원이 아님: ' + C.stepTag('S02', c7);
        if (c7.restricted && !C.canView(c7, env.U('u_sadmin'))) return '차례인 영업지원(배수아)이 열람 제한 2610CL007을 볼 수 없게 됨';
        // 끝난 ②(2610CL006, 배수아 승인)의 결재란에 배수아가 보임
        const rv = review(env, '2610CL006', 'u_super');
        if (rv.error) return '2610CL006 결재 문서를 열지 못함: ' + rv.error.message;
        const s2 = boxStep(rv, '②');
        if (s2.indexOf('배수아') < 0 || s2.indexOf('오현우') > -1) return '2610CL006 결재란 ②에 승인한 배수아가 아닌 사람이 보임: ' + s2.slice(0, 120);
        return true;
      },
    },
    {
      name: '(2026-11-18 셋째 점검 regress-01, ②⑧ 직무 분리) 견줌: 영업지원 역할을 지닌 때 기안하면 ②⑧은 재무(N-2 그대로), 역할을 뺀 뒤에도 그대로이고 다시 기안하면 그때 역할로 다시 정함',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SUPER', store: addSaStore() });
        const { C, D } = env;
        const fin = D.STEP_ASSIGNEE.S10;
        // 영업지원 역할만 있는 석다인: 미리 보기(번호 없음)는 지금 역할로 재무
        if (C.stepUserNow('S02', { requesterId: 'u_dain_seok' }) !== fin) return '영업지원(석다인)이 기안하는 미리 보기의 ②가 재무가 아님';
        // 역할을 더한 뒤 이도윤이 새로 기안(번호와 기안 일시가 있는 기록을 저장)
        const base = env.contract('2610CL010');
        const c = Object.assign(JSON.parse(JSON.stringify(base)), { id: '2610CL901', requestedAt: '2026-10-19 10:00', history: [], approvals: [], drafterSa: undefined });
        delete c.drafterSa;
        C.saveDemoContract(c);
        const n = env.contract('2610CL901');
        if (!n.drafterSa || n.drafterSa.v !== true || n.drafterSa.at !== '2026-10-19 10:00') return '새 기안에 기안한 때의 영업지원 역할(참)이 남지 않음: ' + JSON.stringify(n.drafterSa);
        if (step(n, 'S02').userId !== fin) return '영업지원 역할을 지닌 때 기안한 계약의 ②가 재무가 아님: ' + step(n, 'S02').userId;
        if (C.stepUserAt('S08', n, '9999') !== fin) return '영업지원 역할을 지닌 때 기안한 계약의 ⑧(종이)이 재무가 아님';
        if (C.stepTag('S02', n) !== '② 재무') return '② 이름이 재무가 아님: ' + C.stepTag('S02', n);
        // 역할을 뺀 뒤에도 그대로
        D.ACCOUNTS.find(a => a.id === 'u_sales1').roles = ['SALES'];
        if (C.stepUserAt('S02', n, '9999') !== fin) return '역할을 뺀 뒤 이미 기안한 계약의 ②가 바뀜';
        // 다시 기안(기안 일시가 바뀜)하면 그때 역할(영업만)로 다시 정함
        n.requestedAt = '2026-10-19 11:00';
        C.saveDemoContract(n);
        const r = env.contract('2610CL901');
        if (!r.drafterSa || r.drafterSa.v !== false || r.drafterSa.at !== '2026-10-19 11:00') return '다시 기안했는데 그때 역할로 다시 정하지 않음: ' + JSON.stringify(r.drafterSa);
        if (step(r, 'S02').userId !== D.STEP_ASSIGNEE.S02) return '다시 기안한 뒤 ②가 영업지원 담당이 아님: ' + step(r, 'S02').userId;
        return true;
      },
    },
    {
      name: '(2026-11-18 셋째 점검 regress-01 ③, 결재란) 끝난 단계의 결재란 담당 칸은 실제로 처리한 사람(대신 처리가 아니면). 담당 규칙이 바뀌어도 결재 기록과 어긋나지 않음(2610CL006 ②)',
      kind: 'deny',
      run(h) {
        // 기안한 때 값을 "영업지원 역할 있음"으로 바꿔 ② 담당 규칙이 재무가 되게 함(배수아가 이미 승인한 기록은 그대로)
        const env = h.fresh({ role: 'SUPER', hook: D => { const c = D.CONTRACTS.find(x => x.id === '2610CL006'); c.drafterSa = { v: true, at: c.requestedAt }; } });
        const c = env.contract('2610CL006');
        const s = step(c, 'S02');
        if (!s || s.state !== 'DONE' || s.decidedBy !== 'u_sadmin' || s.onBehalfOf) return '시험 전제: 2610CL006 ②가 배수아 승인으로 끝나 있지 않음';
        if (s.userId === 'u_sadmin') return '시험 전제: ② 담당 규칙이 재무로 바뀌지 않음(어긋난 모습을 만들지 못함)';
        const rv = review(env, '2610CL006', 'u_super');
        if (rv.error) return '결재 문서를 열지 못함: ' + rv.error.message;
        const s2 = boxStep(rv, '②');
        if (s2.indexOf('배수아') < 0) return '결재란 ②에 승인한 배수아가 보이지 않음: ' + s2.slice(0, 120);
        if (s2.indexOf(env.D.USERS[s.userId].name) > -1) return '결재란 ②에 승인하지 않은 ' + env.D.USERS[s.userId].name + '이 보임';
        return true;
      },
    },

    // ---------- regress-02 (AC-39 예전 계약 기록 매월 확인, CTL-143) ----------
    {
      name: '(2026-11-18 셋째 점검 regress-02, AC-39) [가정] 그달 기록이 모두 영업지원 리더가 올린 것이면 리더 화면이 "올린 기록이 없습니다"라 하지 않고 컴플라이언스 확인을 알리며, 확인 기록에 그 수(seen.lead)가 남음',
      kind: 'deny',
      run(h) {
        const pg = openPage(h, 'legacy-contract.js', { role: 'SA_LEAD', query: 'month=2026-09', hook: D => addLeadRecord(D, '2026-09-15 10:00', false) });
        const { C, D } = pg.env;
        const s = C.legacyCheckState('2026-09');
        if (s.recs.length !== 0 || s.leadOwn.length !== 1 || !s.canCheck) return '시험 전제: 2026-09가 리더 기록만 있는 끝난 달이 아님: ' + JSON.stringify({ recs: s.recs.length, lead: s.leadOwn.length, can: s.canCheck });
        const rows = strip(pg.node('#month-rows').innerHTML);
        if (rows.indexOf('리더가 올린 1건 따로') < 0) return '월별 표에 "리더가 올린 1건 따로"가 없음: ' + rows.slice(0, 160);
        const detail = strip(pg.node('#month-detail').innerHTML);
        if (/이 달에 올린 기록이 없습니다|이 달에 올린 예전 계약 기록이 없습니다/.test(detail)) return '리더 기록이 있는 달인데 "올린 기록이 없습니다"라고 함: ' + detail.slice(0, 200);
        if (detail.indexOf('컴플라이언스') < 0 || detail.indexOf('LG-0009') < 0) return '리더 기록은 컴플라이언스가 확인한다는 안내(번호)가 없음: ' + detail.slice(0, 200);
        pg.modal = null;
        pg.fire('#content', 'click', { target: { closest: sel => (sel === '#btn-legacy-check' ? {} : null), getAttribute: () => null } });
        if (!pg.modal) return '확인 남기기 창이 열리지 않음';
        if (strip(pg.modal.body).indexOf('영업지원 리더가 올린 1건') < 0) return '확인 창에 리더가 올린 기록 수가 없음';
        const n = D.ADMIN_LOG.length;
        const r = submit(pg.modal, fakeForm(pg.modal, { memo: '' }));
        if (!r.saved || D.ADMIN_LOG.length === n) return '확인이 남지 않음';
        const e = D.ADMIN_LOG.filter(x => x.op && x.op.k === 'LEGACY_CHECK' && x.op.month === '2026-09').pop();
        if (!e || e.op.result !== 'NONE' || !e.op.seen || e.op.seen.lead !== 1 || e.op.seen.n !== 0) return '확인 기록에 리더가 올린 수(seen.lead 1)가 남지 않음: ' + JSON.stringify(e && e.op);
        if (String(e.change).indexOf('영업지원 리더가 올린 기록 1건 따로') < 0) return '확인 기록의 바뀐 내용 글에 리더가 올린 기록 수가 없음: ' + e.change;
        // 견줌: 리더 기록이 없는 빈 달은 예전 글 그대로
        const empty = openPage(h, 'legacy-contract.js', { role: 'SA_LEAD', query: 'month=2026-09' });
        const t = strip(empty.node('#month-detail').innerHTML);
        if (t.indexOf('이 달에 올린 기록이 없습니다') < 0) return '견줌: 기록이 없는 달의 글이 바뀜: ' + t.slice(0, 160);
        if (strip(empty.node('#month-rows').innerHTML).indexOf('따로') > -1) return '견줌: 리더 기록이 없는데 "따로"가 보임';
        return true;
      },
    },
  ],
};

module.exports = function (ac) { return T[ac] || []; };
module.exports.ACS = Object.keys(T);
