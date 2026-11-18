// AC-45 분기 권한 검토 (CTL-102, 06 통제 목록 2장) 시험 (2026-11-13 주말 점검 W2)
//   접속 기록 점검(admin-logs.js)의 분기 권한 검토와 검토 자료, 유닛 계정 확인(unit-accounts.js)을 가짜 문서에 올려 봄
//   시안 오늘은 2026-10-19. 이 시스템을 쓰기 시작한 달 2026-09라 분기는 2026년 3분기(끝남, 기한 2026-10-31)와 4분기(진행 중)
//   유닛 리더에게 보낸 3분기 계정 목록(2026-10-16 정보보호 한서연), 대리 지정 DL-002(고은성 대신 문태호, 2026-10-19~10-23), DL-003(최민준 대신 문태호, 끝남)
//   화면 도우미는 lib.js의 openPage, fakeForm, submit
'use strict';
const { openPage, fakeForm, submit, stripTags: strip, env0 } = require('./lib');

const VALS = { 'q-pick': '2026-Q3', 'cfg-month': '2026-09' };
// 2026-11-16 W3-10 시연 기록(비즈니스2유닛 리더가 안채원을 휴직으로 표시, 처리 전)은 이 시험들의 전제("조치할 계정 없음")와 달라 접속 기록 점검을 열 때 뺌.
//   그 기록이 있는 모습(처리 전 1개라 "이상 없음"을 고르지 못함)은 아래 "(W3-10) 시연 표시" 시험이 봄. keepDemoAck: true면 빼지 않음
const DEMO_ACK = e => e.op && e.op.k === 'UNIT_LIST_ACK' && e.at === '2026-10-17 11:00' && e.by === 'u_eunseong_ko';
const noDemoAck = D => { const i = D.ADMIN_LOG.findIndex(DEMO_ACK); if (i > -1) D.ADMIN_LOG.splice(i, 1); };
const logs = (h, opt) => openPage(h, 'admin-logs.js', Object.assign({ role: 'PRIVACY' }, opt || {}, {
  hook: D => { if (!(opt && opt.keepDemoAck)) noDemoAck(D); if (opt && opt.hook) opt.hook(D); },
  values: Object.assign({}, VALS, (opt || {}).values || {}) }));
// 3분기 검토 창을 열어 결과를 넣고 저장해 봄 → { pg, r } (창이 안 열리면 r: null)
function review(pg, result, act) {
  pg.modal = null;
  pg.clickData('#content', { 'data-quarter': '2026-Q3' });
  if (!pg.modal) return { pg, r: null };
  const r = submit(pg.modal, fakeForm(pg.modal, { note: '모든 계정의 권한이 하는 일에 맞음', act: act || '' }, { result: [result || 'OK'] }));
  return { pg, r };
}
const q3Button = pg => /data-quarter="2026-Q3"/.test(pg.node('#quarter-rows').innerHTML);
const q3Row = pg => rowsOf(pg.node('#quarter-rows').innerHTML).find(r => r.indexOf('2026년 3분기') > -1) || '';
const rowsOf = html => String(html).split('<tr').slice(1);
// 유닛 리더 확인 기록(관리자 변경 이력의 점검 기록) 하나
const ack = (at, by, unit, marks, extra) => ({ at, by, area: 'AUDIT', target: '2026년 3분기 유닛 계정 확인(' + unit + ')', change: '확인함', reason: '시험',
  op: { k: 'UNIT_LIST_ACK', r: Object.assign({ quarter: '2026-Q3', unit, n: 7, sentAt: '2026-10-16 15:00', seen: '', note: '', onBehalfOf: null, delegationId: null, marks }, extra || {}) } });
const KIM = { id: 'u_taeyun_kim', name: '김태윤', email: 'taeyun.kim@muhayu.com', mark: 'RESIGN', note: '9월 말 퇴사' };
const PARK = { id: 'u_seohyun_park', name: '박서현', email: 'seohyun.park@muhayu.com', mark: 'MOVE', note: '' };

module.exports = {
  ac: 'AC-45',
  title: '분기 권한 검토',
  tests: [
    {
      name: '분기가 끝난 뒤 정보보호 담당자(한서연)가 3분기 결과를 남기면 검토한 사람, 일시, 결과가 남고 결과 남기기 단추가 사라짐',
      kind: 'ok',
      run(h) {
        const pg = logs(h);
        if (!q3Button(pg)) return '정보보호 담당자에게 3분기 결과 남기기 단추가 없음';
        if (/data-quarter="2026-Q4"/.test(pg.node('#quarter-rows').innerHTML)) return '아직 끝나지 않은 4분기에 결과 남기기 단추가 있음';
        const { r } = review(pg);
        if (!r) return '3분기 검토 창이 열리지 않음';
        if (!r.saved) return '저장되지 않음: ' + r.bad.map(k => r.errs[k]).join(' / ');
        const D = pg.env.D;
        const rec = D.ACCESS_REVIEWS.filter(x => x.quarter === '2026-Q3');
        if (rec.length !== 1) return '3분기 검토 기록이 ' + rec.length + '건';
        if (rec[0].by !== 'u_privacy' || !rec[0].at || rec[0].result !== 'OK') return '검토한 사람, 일시, 결과가 남지 않음: ' + JSON.stringify(rec[0]).slice(0, 200);
        const row = strip(q3Row(pg));
        if (row.indexOf('한서연') < 0 || row.indexOf('이상 없음') < 0) return '3분기 줄에 검토한 사람이나 결과가 보이지 않음: ' + row.slice(0, 120);
        if (q3Button(pg)) return '남긴 뒤에도 결과 남기기 단추가 보임';
        return true;
      },
    },
    {
      name: '기한(분기가 끝난 다음 달 말일)이 지나도록 남기지 않은 분기는 강조됨(오늘을 2026-11-05로 바꿔 봄)',
      kind: 'ok',
      run(h) {
        const late = logs(h, { hook: D => { D.TODAY = '2026-11-05'; } });
        const row = q3Row(late);
        if (row.indexOf('is-alert') < 0 || strip(row).indexOf('기한 지남') < 0) return '기한이 지난 3분기 줄이 강조되지 않음: ' + strip(row).slice(0, 120);
        const now = logs(h);
        if (q3Row(now).indexOf('is-alert') > -1) return '기한 전(2026-10-19)인데 3분기 줄이 강조됨';
        return true;
      },
    },
    {
      name: '관리자(와 영업, 법무)는 접속 기록 점검 화면을 열 수 없어 검토 결과를 남길 수 없음',
      kind: 'deny',
      run(h) {
        for (const role of ['ADMIN', 'SALES', 'LEGAL']) {
          const pg = logs(h, { role });
          if (!pg.node('#content').hidden) return role + ': 접속 기록 점검 본문이 보임';
          if (q3Button(pg)) return role + ': 3분기 결과 남기기 단추가 있음';
        }
        return true;
      },
    },
    {
      // (2026-11-13 약한 시험 고침) 두 번째 저장은 시도하지 않고 단추가 그려지는지만 봄. 그래서 이름에서 "기록은 하나"를 뺌(시도하지 않으면 늘 참)
      //   단추 없이 data-quarter를 직접 누르면 시안은 검토 창을 다시 엶(openQuarter는 단추를 감출 뿐). 그 거부는 서버 몫에 적음
      name: '같은 분기에 두 번 저장: 남긴 뒤에는 그 분기의 결과 남기기 단추가 없음(다시 연 화면, 다른 정보보호 담당자에게도)',
      kind: 'deny',
      run(h) {
        const pg = logs(h);
        const { r } = review(pg);
        if (!r || !r.saved) return '첫 검토를 남기지 못함(시험 확인)';
        const again = logs(h, { store: pg.env.store });
        if (q3Button(again)) return '다시 연 화면에 3분기 결과 남기기 단추가 다시 보임';
        // 다시 연 화면이 앞에서 남긴 기록을 읽었는지(읽지 못하면 단추가 없는 까닭이 다른 데 있음)
        if (again.env.D.ACCESS_REVIEWS.filter(x => x.quarter === '2026-Q3').length !== 1) return '다시 연 화면이 앞에서 남긴 3분기 검토 기록을 읽지 못함(시험 확인)';
        const other = logs(h, { role: 'SEC_LEAD', store: pg.env.store });
        if (q3Button(other)) return '다른 정보보호 담당자(여승호)에게 3분기 결과 남기기 단추가 다시 보임';
        return true;
      },
    },
    {
      name: '사유 없는 권한 변경이 1건 있으면 검토 창과 검토 때 본 자료에 "사유 없는 기록 1건"',
      kind: 'deny',
      run(h) {
        const pg = logs(h, { hook: D => D.ADMIN_LOG.push({ at: '2026-10-10 10:00', by: 'u_admin', area: 'USER', target: '시험 (test@muhayu.com)', change: '권한: 영업 담당자 → 영업 리더', reason: '' }) });
        if (strip(pg.node('#q-lines').innerHTML).indexOf('사유 없는 기록 1건') < 0) return '검토 자료에 "사유 없는 기록 1건"이 없음: ' + strip(pg.node('#q-lines').innerHTML).slice(0, 200);
        pg.clickData('#content', { 'data-quarter': '2026-Q3' });
        if (!pg.modal || strip(pg.modal.body).indexOf('사유 없는 기록 1건') < 0) return '검토 창에 "사유 없는 기록 1건"이 없음';
        const r = submit(pg.modal, fakeForm(pg.modal, { note: '사유 없는 기록 확인', act: '관리자에게 사유 보완 요청' }, { result: ['ACTION'] }));
        if (!r.saved) return '조치함으로 남기지 못함(시험 확인): ' + r.bad.map(k => r.errs[k]).join(' / ');
        if (pg.env.D.ACCESS_REVIEWS[0].seen.indexOf('사유 없는 기록 1건') < 0) return '검토 때 본 자료에 "사유 없는 기록 1건"이 없음';
        return true;
      },
    },
    {
      name: '정보보호와 관리자 역할을 함께 가진 사람(한서연)이 그 분기 첫날부터 자기가 권한을 바꾼 기록이 있으면 검토를 남기지 못함(다른 정보보호 담당자는 남김)',
      kind: 'deny',
      run(h) {
        const both = D => {
          D.ACCOUNTS.find(a => a.id === 'u_privacy').roles = ['PRIVACY', 'ADMIN'];
          D.ADMIN_LOG.push({ at: '2026-10-05 10:00', by: 'u_privacy', area: 'USER', target: '신가은 (gaeun.shin@muhayu.com)', change: '권한: 영업 담당자 → 영업 담당자, 영업지원 담당자', reason: '견적 지원' });
        };
        // 겹침 경고와 까닭은 받지 않음(정보보호와 관리자는 CTL-110의 짝이 아님)
        const pre = env0(h, { role: 'ADMIN' });
        if (pre.C.roleConflicts(['PRIVACY', 'ADMIN']).length) return '정보보호와 관리자를 함께 줄 때 역할 겹침으로 잡힘(짝이 아님)';
        const pg = logs(h, { hook: both });
        if (q3Button(pg)) return '본인 권한 변경이 있는 한서연에게 3분기 결과 남기기 단추가 눌리게 보임';
        if (strip(q3Row(pg)).indexOf('본인 권한 변경 1건') < 0) return '잠긴 단추의 까닭("본인 권한 변경 1건")이 없음: ' + strip(q3Row(pg)).slice(0, 160);
        const { r } = review(pg);
        if (r) return '한서연에게 3분기 검토 창이 열림';
        if (pg.env.D.ACCESS_REVIEWS.length) return '한서연의 검토 기록이 남음';
        const other = logs(h, { role: 'SEC_LEAD', hook: both });
        if (!q3Button(other)) return '다른 정보보호 담당자(여승호)도 3분기 결과를 남길 수 없음(시험 대조 실패)';
        return true;
      },
    },
    {
      // (2026-11-13 약한 시험 고침) 시안은 창의 줄과 저장되는 seen을 같은 accessLines로 만들고, 저장할 때 다시 셈(06 "시안은 저장할 때 accessLines로 남김").
      //   그래서 이 시험은 창을 연 뒤 자료가 바뀌지 않을 때만 봄. 창을 연 뒤 저장 전에 자료가 바뀌는 경우(06이 걱정하는 "보인 것과 남긴 것이 다름")는
      //   서버 몫에 적음(서버는 창에 보낸 자료를 그대로 저장하고 저장 때 다시 세지 않음. 시안 방식은 06에 적혀 있어 시안 결함으로 보지 않음)
      name: '저장한 결과의 "검토 때 본 자료"가 그때 창에 보인 자료와 같음(창을 연 뒤 자료가 바뀌지 않을 때)',
      kind: 'deny',
      run(h) {
        const pg = logs(h);
        pg.clickData('#content', { 'data-quarter': '2026-Q3' });
        if (!pg.modal) return '3분기 검토 창이 열리지 않음';
        const shown = (String(pg.modal.body).match(/<ul class="summary-list">([\s\S]*?)<\/ul>/) || [])[1] || '';
        const lines = shown.split('</li>').map(strip).filter(Boolean);
        if (lines.length < 8) return '검토 창의 자료 줄을 찾지 못함(시험 확인)';
        const r = submit(pg.modal, fakeForm(pg.modal, { note: '확인' }, { result: ['OK'] }));
        if (!r.saved) return '저장되지 않음(시험 확인): ' + r.bad.map(k => r.errs[k]).join(' / ');
        const seen = pg.env.D.ACCESS_REVIEWS[0].seen;
        if (seen !== lines.join(' / ')) return '검토 때 본 자료가 창에 보인 자료와 다름';
        return true;
      },
    },
    {
      name: '(C-6) 최고관리자는 분기 검토를 남기지 못함: 단추가 잠기고 "본인 계정이 듦"',
      kind: 'deny',
      run(h) {
        const pg = logs(h, { role: 'SUPER' });
        if (pg.node('#content').hidden) return '최고관리자가 접속 기록 점검을 보지도 못함(보기는 되어야 함)';
        if (q3Button(pg)) return '최고관리자에게 3분기 결과 남기기 단추가 눌리게 보임';
        if (strip(q3Row(pg)).indexOf('본인 계정이 듦') < 0) return '잠긴 단추의 까닭("본인 계정이 듦")이 없음';
        return true;
      },
    },
    {
      name: '(C-2, C-5, C-7) 감사 열람, 지정 열람자, 역할 충돌 계정, 저절로 빠진 역할, 계정 목록 보낸 기록이 검토 자료와 검토 때 본 자료에 들어감. 분기가 끝나기 전에는 계정 목록을 보내지 못함',
      kind: 'deny',
      run(h) {
        const pg = logs(h);
        const D = pg.env.D, C = pg.env.C;
        const { r } = review(pg);
        if (!r || !r.saved) return '검토를 남기지 못함(시험 확인)';
        const seen = D.ACCESS_REVIEWS[0].seen;
        const need = [['감사 열람(인채율)', '인채율'], ['끝난 감사 열람(반서율)', '반서율(2026-09-15~2026-10-15 끝남'], ['지정 열람자', '지정 열람자 ' + C.designatedViewersAll().length + '건'],
          ['역할 충돌 계정(방시현)', '방시현(⑨ 고객지원과 ⑩ 재무'], ['유닛 리더에게 보낸 계정 목록', '유닛 리더에게 보낸 계정 목록 확인 요청: 2026-10-16 15:00']];
        const miss = need.filter(x => seen.indexOf(x[1]) < 0).map(x => x[0]);
        if (miss.length) return '검토 때 본 자료에 빠진 것: ' + miss.join(', ');
        // "권한을 바꾼 기록 n건"이 빠짐없이 세어지는지: 시안과 같은 식으로 기대값을 다시 만들면 식이 틀려도 잡지 못하므로(2026-11-13 약한 시험 고침),
        //   개수를 아는 데이터 바꾸기로 차이만 봄. 기준 화면의 n0에서
        //   ① 이 시스템을 쓰기 시작한 뒤(2026-10-05) 권한 변경 한 줄을 더하면 n0+1, 시작 전(2026-08-20) 한 줄은 세지 않아 그대로
        //   ② 저절로 빠진 역할(반서율 감사 열람, 2026-10-15 끝남)을 아직 끝나지 않게 바꾸면 n0-1(저절로 빠진 역할도 센다는 뜻)
        const countIn = text => { const m = /권한을 바꾼 기록 (\d+)건/.exec(text); return m ? Number(m[1]) : null; };
        const n0 = countIn(seen);
        if (n0 == null) return '검토 때 본 자료에 "권한을 바꾼 기록 n건"이 없음';
        if (countIn(strip(logs(h).node('#q-lines').innerHTML)) !== n0) return '검토 자료와 검토 때 본 자료의 "권한을 바꾼 기록" 수가 다름(시험 확인)';
        const USER_LINE = at => ({ at, by: 'u_admin', area: 'USER', target: '시험 (t45@muhayu.com)', change: '권한: 영업 담당자 → 영업 리더', reason: '시험' });
        const plus = logs(h, { hook: D2 => { D2.ADMIN_LOG.push(USER_LINE('2026-10-05 10:00')); D2.ADMIN_LOG.push(USER_LINE('2026-08-20 10:00')); } });
        const n1 = countIn(strip(plus.node('#q-lines').innerHTML));
        if (n1 !== n0 + 1) return '권한 변경 한 줄(시작 뒤)과 한 줄(시작 전)을 더했는데 "권한을 바꾼 기록"이 ' + n0 + ' → ' + n1 + '(' + (n0 + 1) + '이어야 함)';
        const rp = review(plus);
        if (!rp.r || !rp.r.saved || countIn(plus.env.D.ACCESS_REVIEWS[0].seen) !== n0 + 1) return '한 줄 더한 뒤 남긴 검토 때 본 자료의 "권한을 바꾼 기록"이 ' + (n0 + 1) + '건이 아님';
        if (!C.roleEndLog().some(e => /반서율/.test(e.target))) return '시험 전제: 반서율의 저절로 빠진 역할 기록이 없음';
        const keep = logs(h, { hook: D2 => { D2.ROLE_GRANTS.filter(g => g.userId === 'u_seoyul_ban' && g.role === 'AUDIT').forEach(g => { g.until = '2026-12-31'; }); } });
        if (keep.env.C.roleEndLog().some(e => /반서율/.test(e.target))) return '시험 확인: 반서율의 감사 열람을 끝나지 않게 바꾸지 못함';
        const n2 = countIn(strip(keep.node('#q-lines').innerHTML));
        if (n2 !== n0 - 1) return '저절로 빠진 역할(반서율 감사 열람 끝남)을 없애자 "권한을 바꾼 기록"이 ' + n0 + ' → ' + n2 + '(' + (n0 - 1) + '이어야 함. 저절로 빠진 역할을 세지 않음)';
        // 4분기(진행 중)를 골라 유닛 리더에게 계정 목록 보내기
        const q4 = logs(h, { values: { 'q-pick': '2026-Q4' } });
        const n = q4.env.D.ADMIN_LOG.length;
        q4.clickData('#content', { id: 'btn-send' });
        if (q4.modal) return '끝나지 않은 4분기에 계정 목록 보내기 창이 열림';
        if (q4.env.D.ADMIN_LOG.length !== n) return '끝나지 않은 4분기에 보낸 기록이 남음';
        if (!q4.env.toasts.some(t => t.msg.indexOf('끝난 뒤에 보냅니다') > -1)) return '분기가 끝난 뒤에 보낸다는 안내가 없음';
        return true;
      },
    },
    {
      name: '(21번) 유닛 리더(최민준)가 퇴사로 표시한 김태윤이 처리 전이면 "이상 없음" 거부, 관리자가 사용 중지하면 "처리함"이 되어 "이상 없음"을 남김',
      kind: 'deny',
      run(h) {
        // 최민준이 유닛 계정 확인에서 김태윤을 퇴사로 표시
        const ua = openPage(h, 'unit-accounts.js', { role: 'HEAD' });
        ua.clickData('#content', { 'data-ack': '비즈니스1유닛' });
        if (!ua.modal) return '최민준에게 비즈니스1유닛 확인 창이 열리지 않음';
        const m = String(ua.modal.body).match(/name="mk-(\d+)" aria-label="김태윤 표시"/);
        if (!m) return '확인 창에서 김태윤 표시 칸을 찾지 못함';
        const vals = { note: '' };
        vals['mk-' + m[1]] = 'RESIGN';
        vals['mn-' + m[1]] = '9월 말 퇴사';
        const a = submit(ua.modal, fakeForm(ua.modal, vals));
        if (!a.saved) return '확인함을 남기지 못함(시험 확인)';
        const k = ua.env.D.ADMIN_LOG[ua.env.D.ADMIN_LOG.length - 1];
        if (!k.op || k.op.k !== 'UNIT_LIST_ACK' || !(k.op.r.marks || []).some(x => x.id === 'u_taeyun_kim' && x.mark === 'RESIGN')) return '확인 기록에 김태윤 퇴사 표시가 없음';
        // 정보보호: 처리 전이면 "이상 없음"을 고를 수 없음
        const p1 = logs(h, { store: ua.env.store });
        const x1 = review(p1, 'OK');
        if (!x1.r) return '검토 창이 열리지 않음';
        if (x1.r.saved || !x1.r.errs.result) return '처리 전인 조치할 계정이 있는데 "이상 없음"을 받음';
        // 관리자가 김태윤을 사용 중지
        const adm = env0(h, { role: 'ADMIN', store: ua.env.store });
        const e = adm.C.adminSave('USER', '김태윤 (taeyun.kim@muhayu.com)', '상태: 사용 중 → 사용 중지', '퇴사', { k: 'ACCOUNT_EDIT', email: 'taeyun.kim@muhayu.com', set: { status: 'SUSPENDED' } });
        if (e.refused) return '관리자 저장이 거부됨(시험 틀 확인)';
        const p2 = logs(h, { store: adm.store });
        if (strip(p2.node('#mark-rows').innerHTML).indexOf('처리함') < 0) return '사용 중지한 뒤에도 조치할 계정이 "처리함"이 아님';
        const x2 = review(p2, 'OK');
        if (!x2.r || !x2.r.saved) return '처리한 뒤에도 "이상 없음"을 남기지 못함: ' + (x2.r ? x2.r.bad.map(q => x2.r.errs[q]).join(' / ') : '창 없음');
        if (!p2.env.D.ACCESS_REVIEWS[0].marks || p2.env.D.ACCESS_REVIEWS[0].marks.total !== 1) return '검토 기록에 그때 본 조치할 계정 수가 남지 않음';
        return true;
      },
    },
    {
      name: '(21번) 이동으로 표시한 계정은 조직을 옮기면 "처리함". 같은 분기 같은 유닛에 확인이 여럿이면 마지막 확인의 표시만 셈',
      kind: 'deny',
      run(h) {
        // 이동 표시(박서현, 비즈니스1유닛 그대로) → 처리 전
        const move = D => D.ADMIN_LOG.push(ack('2026-10-17 10:00', 'u_head', '비즈니스1유닛', [PARK]));
        const p1 = logs(h, { hook: move });
        const x1 = review(p1, 'OK');
        if (!x1.r || x1.r.saved) return '이동 표시가 처리 전인데 "이상 없음"을 받음';
        const p2 = logs(h, { hook: D => { move(D); D.ACCOUNTS.find(a => a.id === 'u_seohyun_park').dept = '비즈니스2유닛'; } });
        const x2 = review(p2, 'OK');
        if (!x2.r || !x2.r.saved) return '조직을 옮긴 뒤에도 "이상 없음"을 남기지 못함';
        // 앞 확인에 퇴사 표시, 뒤 확인에 표시 없음 → 마지막(표시 없음)만 셈
        const p3 = logs(h, { hook: D => { D.ADMIN_LOG.push(ack('2026-10-17 10:00', 'u_head', '비즈니스1유닛', [KIM])); D.ADMIN_LOG.push(ack('2026-10-18 10:00', 'u_head', '비즈니스1유닛', [])); } });
        const x3 = review(p3, 'OK');
        if (!x3.r || !x3.r.saved) return '마지막 확인에 표시가 없는데 앞 확인의 표시로 "이상 없음"을 막음';
        // 거꾸로(마지막 확인에 퇴사 표시) → 막음
        const p4 = logs(h, { hook: D => { D.ADMIN_LOG.push(ack('2026-10-17 10:00', 'u_head', '비즈니스1유닛', [])); D.ADMIN_LOG.push(ack('2026-10-18 10:00', 'u_head', '비즈니스1유닛', [KIM])); } });
        const x4 = review(p4, 'OK');
        if (!x4.r || x4.r.saved) return '마지막 확인에 처리 전 표시가 있는데 "이상 없음"을 받음';
        return true;
      },
    },
    {
      name: '(19번) 대리 지정: 문태호는 진행 중인 DL-002로 비즈니스2유닛만 대신 보고(끝난 DL-003의 비즈니스1유닛은 못 봄), 남긴 확인에 "누구 대신"과 대리 지정 번호가 있음. 다른 유닛 리더(차유나)는 자기 유닛만',
      kind: 'deny',
      run(h) {
        const ex = openPage(h, 'unit-accounts.js', { role: 'EXEC' });
        const units = strip(ex.node('#ua-units').innerHTML);
        if (units.indexOf('비즈니스2유닛') < 0) return '대리 지정 기간의 문태호에게 비즈니스2유닛 목록이 없음';
        if (units.indexOf('비즈니스1유닛') > -1) return '대리 지정이 끝난(DL-003) 비즈니스1유닛 목록이 문태호에게 보임';
        if (units.indexOf('고은성 대신') < 0) return '대신 맡은 유닛에 "누구 대신"이 보이지 않음';
        ex.clickData('#content', { 'data-ack': '비즈니스2유닛' });
        if (!ex.modal) return '문태호에게 비즈니스2유닛 확인 창이 열리지 않음';
        const a = submit(ex.modal, fakeForm(ex.modal, { note: '' }));
        if (!a.saved) return '대신 확인을 남기지 못함(시험 확인)';
        const r = ex.env.D.ADMIN_LOG[ex.env.D.ADMIN_LOG.length - 1].op.r;
        if (r.onBehalfOf !== 'u_eunseong_ko' || r.delegationId !== 'DL-002') return '대신 남긴 확인에 누구 대신이나 대리 지정 번호가 없음: ' + JSON.stringify({ onBehalfOf: r.onBehalfOf, delegationId: r.delegationId });
        const yu = openPage(h, 'unit-accounts.js', { role: 'HEAD', hook: D => { D.DEMO_PERSONA.HEAD = 'u_yuna_cha'; } });
        const t = strip(yu.node('#ua-units').innerHTML);
        if (t.indexOf('비즈니스3유닛') < 0) return '차유나에게 비즈니스3유닛 목록이 없음(시험 대조 실패)';
        if (/비즈니스1유닛|비즈니스2유닛|doyun\.lee|haeun\.jung/.test(t)) return '차유나에게 다른 유닛의 목록이나 계정이 보임';
        return true;
      },
    },
    {
      name: '(19번) 화면을 연 뒤 대리 지정이 끝나면(DL-002를 일찍 끝냄) 확인함을 남길 수 없음',
      kind: 'deny',
      run(h) {
        const ex = openPage(h, 'unit-accounts.js', { role: 'EXEC' });
        const n = ex.env.D.ADMIN_LOG.length;
        ex.env.D.DELEGATIONS.find(d => d.id === 'DL-002').endedAt = '2026-10-19 09:00';
        ex.clickData('#content', { 'data-ack': '비즈니스2유닛' });
        if (ex.modal) return '대리 지정이 끝났는데 확인 창이 열림';
        if (ex.env.D.ADMIN_LOG.length !== n) return '대리 지정이 끝났는데 확인 기록이 남음';
        if (!ex.env.toasts.some(t => t.msg.indexOf('대리 지정 기간이 끝나') > -1)) return '대리 지정이 끝났다는 안내가 없음';
        return true;
      },
    },
    {
      // (2026-11-13 약한 시험 고침) 영업, 최고관리자, 법무는 화면 문(역할)에서 먼저 막혀서, 보낸 기록으로 판단하는지는 시험하지 못했음.
      //   그래서 리더 역할인 차유나로, 보낸 기록에서 비즈니스3유닛을 뺀 경우(요청을 받지 않음)를 더함. 견줌: 보낸 기록 그대로면 차유나는 자기 유닛 목록을 봄
      name: '(5회차 5번) 확인 요청을 받지 않은 사람(영업, 최고관리자, 보낸 기록에 없는 유닛의 리더 차유나)은 유닛 계정 확인에서 목록을 받지 못하고, 리더는 자기 유닛만 봄. 확인 요청 메일에 직원 이름, 이메일이 없음',
      kind: 'deny',
      run(h) {
        for (const role of ['SALES', 'SUPER', 'LEGAL']) {
          const pg = openPage(h, 'unit-accounts.js', { role });
          if (!pg.node('#content').hidden) return role + ': 유닛 계정 확인 본문이 보임';
          if (pg.node('#ua-units').innerHTML) return role + ': 유닛 계정 목록을 그림';
          if (/@muhayu\.com/.test(pg.text())) return role + ': 화면에 직원 이메일이 보임';
        }
        // 리더 역할이어도 보낸 기록이 판단함: 차유나(비즈니스3유닛 리더)
        const yuna = D => { D.DEMO_PERSONA.HEAD = 'u_yuna_cha'; };
        const unsent = D => { yuna(D); D.ADMIN_LOG.forEach(e => { if (e.op && e.op.k === 'UNIT_LIST_SENT') e.op.r.units = e.op.r.units.filter(u => u.unit !== '비즈니스3유닛'); }); };
        const sentPg = openPage(h, 'unit-accounts.js', { role: 'HEAD', hook: yuna });
        const b3 = sentPg.env.D.ACCOUNTS.filter(a => a.dept === '비즈니스3유닛');
        if (sentPg.env.C.currentUser().id !== 'u_yuna_cha') return '시험 사람이 차유나가 아님(시험 확인)';
        if (sentPg.node('#content').hidden || !b3.some(a => sentPg.text().indexOf(a.email) > -1)) return '견줌 실패: 보낸 기록 그대로인데 차유나에게 비즈니스3유닛 목록이 보이지 않음';
        const no = openPage(h, 'unit-accounts.js', { role: 'HEAD', hook: unsent });
        if (no.env.D.ADMIN_LOG.some(e => e.op && e.op.k === 'UNIT_LIST_SENT' && e.op.r.units.some(u => u.unit === '비즈니스3유닛'))) return '시험 확인: 보낸 기록에서 비즈니스3유닛을 빼지 못함';
        if (!no.node('#content').hidden) return '확인 요청을 받지 않은 차유나에게 유닛 계정 확인 본문이 보임';
        if (no.node('#ua-units').innerHTML) return '확인 요청을 받지 않은 차유나에게 유닛 계정 목록을 그림';
        const seen3 = b3.filter(a => no.text().indexOf(a.email) > -1).map(a => a.email);
        if (seen3.length) return '확인 요청을 받지 않은 차유나에게 비즈니스3유닛 직원 이메일이 보임: ' + seen3.slice(0, 3).join(', ');
        const hd = openPage(h, 'unit-accounts.js', { role: 'HEAD' });
        const D = hd.env.D;
        const other = D.ACCOUNTS.filter(a => a.dept !== '비즈니스1유닛');
        const leak = other.filter(a => hd.text().indexOf(a.email) > -1).map(a => a.email);
        if (leak.length) return '최민준에게 다른 유닛 계정이 보임: ' + leak.slice(0, 3).join(', ');
        // 확인 요청 메일(예시 메일 틀 UNIT_LIST)과 보낸 기록에 그 유닛 직원의 이름, 이메일이 없음
        const t = D.EMAIL_TYPES.find(x => x.code === 'UNIT_LIST');
        if (!t || !t.sample) return '시험 전제: 유닛 계정 목록 확인 예시 메일이 없음';
        const mail = JSON.stringify(t.sample);
        const unit = (t.sample.facts.find(f => f[0] === '유닛') || [])[1];
        const members = D.ACCOUNTS.filter(a => a.dept === unit);
        if (!members.length) return '시험 전제: 메일의 유닛(' + unit + ') 계정이 없음';
        const inMail = members.filter(a => mail.indexOf(a.email) > -1 || (a.id !== t.sample.to && mail.indexOf(a.name) > -1)).map(a => a.name);
        if (inMail.length) return '확인 요청 메일에 직원 이름이나 이메일이 들어감: ' + inMail.join(', ');
        const sent = D.ADMIN_LOG.filter(e => e.op && e.op.k === 'UNIT_LIST_SENT').map(e => JSON.stringify(e));
        if (sent.some(s => /@muhayu\.com/.test(s))) return '계정 목록 보낸 기록에 직원 이메일이 들어감';
        return true;
      },
    },
  ],
  serverOnly: [
    '관리자가 검토 저장 요청을 직접 보냄: 서버가 정보보호 담당자인지 확인해 거부(시안은 화면 문에서 막고 C.adminSave는 역할을 다시 보지 않음)',
    '같은 분기에 두 번 저장 요청을 직접 보냄: 서버가 그 분기 기록이 있으면 거부(시안 openQuarter는 단추를 감출 뿐 저장에서 다시 보지 않음. 단추 없이 data-quarter를 직접 누르면 검토 창이 다시 열림)',
    '검토 창을 연 뒤 저장 전에 다른 사람이 권한을 바꿈: 서버는 창에 보낸 자료를 그대로 "검토 때 본 자료"로 저장하고 저장 때 다시 세지 않음(시안 openQuarter의 done은 저장할 때 accessLines를 다시 셈. 시험 틀에서 창을 연 뒤 관리자 변경 이력에 한 줄을 더하고 저장하면 창에 보인 것과 다른 seen이 남음. 06 AC-45는 이 시안 방식을 적어 두었고 03 seen_snapshot은 서버 값)',
    '최고관리자, 본인 권한 변경이 있는 정보보호 담당자의 검토 저장 요청을 직접 보냄: 서버가 거부(시안은 단추를 잠그고 openQuarter에서 본인 권한 변경만 다시 봄)',
    '확인 창을 연 채로 대리 지정이 끝난 뒤 저장: 서버가 저장 때 대리 지정을 다시 확인해 거부(시안 unit-accounts.js openAck는 창을 열 때만 확인)',
    '다른 유닛의 계정 목록을 직접 요청: 서버가 보낸 기록과 대리 지정으로 판단해 돌려주지 않음(시안은 예시 데이터 전체를 브라우저에 불러 화면에서만 거름)',
    '검토 자료는 서버에서 계산하고 기록은 덧붙이기만 함. 점검 일정 계산은 서버 예약 작업 하나(04 2.5)',
  ],
};
// 2026-11-16 기획자 결정 반영 시험(작업기록/2026-11-16/반영목록.md, tools/control_tests/n16.js)
module.exports.tests = module.exports.tests.concat(require('./n16')('AC-45'));
