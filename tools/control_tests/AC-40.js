// AC-40 목록, 검색, 메일에서 가림 (CTL-92, 06 통제 목록 2장) 시험 (2026-11-13 주말 점검 W2)
//   목록 화면(contracts.js, review-queue.js, ops-queue.js, 그 밖의 목록)과 접속 기록 점검(admin-logs.js)을 가짜 문서에 올려 그린 글을 봄
//   시안 열람 제한 계약: 2610CL007 가람전자(기안 이도윤), 2511CL002 푸른솔아카데미, 2609CL008 해솔테크(둘 다 기안 정하은)
//   화면 도우미는 lib.js의 openPage
//   (2026-11-14 주말 점검, 코드 다시 보기 common-01, common-02) 설정 변경 확인(config-review.js)의 고객사 티어 줄과 넘김 글,
//     할인 예외 점검(discount-review.js)의 참고 표 넷의 가림도 봄
'use strict';
const { openPage, stripTags: strip, env0, fakeForm, submit } = require('./lib');

// 정하은(u_sales2)으로 시연하는 영업 화면
const asSales2 = D => { D.DEMO_PERSONA.SALES = 'u_sales2'; };
// 표의 줄들(<tr> 단위)
const rowsOf = html => String(html).split('<tr').slice(1);
const masked = html => rowsOf(html).filter(r => r.indexOf('is-masked') > -1);
// 그 사람이 볼 수 없는 열람 제한 계약의 고객사 가운데, 그 사람이 볼 수 있는 다른 계약에는 쓰이지 않는 이름(나오면 새어 나간 것)
function hiddenNames(env, user) {
  const D = env.D, C = env.C;
  const seenNames = D.CONTRACTS.filter(c => c.id && C.canView(c, user)).map(c => c.counterparty);
  return D.CONTRACTS.filter(c => c.id && c.restricted && !C.canView(c, user)).map(c => c.counterparty)
    .filter((n, i, a) => n && a.indexOf(n) === i && seenNames.indexOf(n) < 0);
}

module.exports = {
  ac: 'AC-40',
  title: '목록, 검색, 메일에서 가림',
  tests: [
    {
      name: '다른 영업(정하은)의 전체 계약 목록에서 이도윤의 2610CL007은 "열람 제한 계약" 한 줄로만 보이고 고객사, 번호, 서비스가 없음',
      kind: 'ok',
      run(h) {
        const pg = openPage(h, 'contracts.js', { role: 'SALES', hook: asSales2, values: { 'f-owner': 'u_sales1' } });
        if (pg.env.C.currentUser().id !== 'u_sales2') return '시험 사람이 정하은이 아님';
        const html = pg.node('#rows').innerHTML;
        const m = masked(html);
        if (m.length !== 1) return '이도윤 계약 가운데 "열람 제한 계약" 줄이 ' + m.length + '개(1개여야 함)';
        if (strip(m[0]).indexOf('열람 제한 계약') < 0) return '가린 줄에 "열람 제한 계약"이 없음';
        if (/가람전자|2610CL007/.test(html)) return '목록에 2610CL007의 고객사나 번호가 보임';
        if (m[0].indexOf('<td class="col-service">-</td>') < 0) return '가린 줄의 서비스 칸이 "-"가 아님: ' + strip(m[0]);
        return true;
      },
    },
    {
      name: '고객사 이름, 계약번호로 검색하거나 서비스로 거르면 볼 수 없는 2610CL007은 결과에 없음(최고관리자는 찾음)',
      kind: 'deny',
      run(h) {
        for (const [what, values] of [['고객사 이름', { 'f-q': '가람' }], ['계약번호', { 'f-q': '2610CL007' }], ['서비스', { 'f-owner': 'u_sales1', 'f-service': 'CK' }]]) {
          const pg = openPage(h, 'contracts.js', { role: 'SALES', hook: asSales2, values });
          const html = pg.node('#rows').innerHTML;
          if (masked(html).length || /가람전자|2610CL007/.test(html)) return what + '(으)로 찾으면 볼 수 없는 2610CL007이 결과에 나옴';
        }
        const sp = openPage(h, 'contracts.js', { role: 'SUPER', values: { 'f-q': '가람' } });
        if (sp.node('#rows').innerHTML.indexOf('가람전자') < 0) return '최고관리자도 "가람"으로 찾지 못함(시험 대조 실패)';
        return true;
      },
    },
    {
      name: '검토 대기(영업지원 리더)와 운영 검토 대기(고객지원 리더): 볼 수 없는 계약은 가린 줄의 서비스 칸이 "-", 서비스나 고객사로 거르면 결과에 없음',
      kind: 'deny',
      run(h) {
        // 검토 대기: 2610CL007의 ② 배수아 차례가 영업지원 리더(엄지훈)의 분야 목록에 들어 있음
        const rq = openPage(h, 'review-queue.js', { role: 'SA_LEAD' });
        if (rq.env.C.canView(rq.env.contract('2610CL007'), rq.env.C.currentUser())) return '시험 전제: 엄지훈이 2610CL007을 볼 수 있음';
        const m1 = masked(rq.node('#rows').innerHTML);
        if (!m1.length) return '검토 대기에 가린 줄이 없음(2610CL007이 목록에 없음)';
        if (m1.some(r => r.indexOf('<td class="col-service">-</td>') < 0)) return '검토 대기 가린 줄의 서비스 칸이 "-"가 아님';
        if (/가람전자/.test(rq.node('#rows').innerHTML)) return '검토 대기에 가람전자가 보임';
        for (const values of [{ 'f-service': 'CK' }, { 'f-q': '가람' }, { 'f-q': '2610CL007' }]) {
          const p = openPage(h, 'review-queue.js', { role: 'SA_LEAD', values });
          if (masked(p.node('#rows').innerHTML).length) return '검토 대기를 ' + JSON.stringify(values) + '로 거르면 가린 줄이 결과에 나옴';
        }
        // 운영 검토 대기: ⑨ 차례인 2609CL004(마루중학교)를 열람 제한으로 바꿔 고객지원 리더(주연우)로 봄
        const restrict = D => { D.CONTRACTS.find(x => x.id === '2609CL004').restricted = true; };
        const oq = openPage(h, 'ops-queue.js', { role: 'CEM_LEAD', hook: restrict });
        if (oq.env.C.canView(oq.env.contract('2609CL004'), oq.env.C.currentUser())) return '시험 전제: 주연우가 2609CL004를 볼 수 있음';
        const m2 = masked(oq.node('#rows').innerHTML);
        if (m2.length !== 1) return '운영 검토 대기의 가린 줄이 ' + m2.length + '개(2609CL004 하나여야 함)';
        if (m2[0].indexOf('<td class="col-service">-</td>') < 0) return '운영 검토 대기 가린 줄의 서비스 칸이 "-"가 아님: ' + strip(m2[0]);
        if (/마루중학교/.test(oq.node('#rows').innerHTML)) return '운영 검토 대기에 마루중학교가 보임';
        for (const values of [{ 'f-service': 'CK' }, { 'f-q': '마루' }, { 'f-q': '2609CL004' }]) {
          const p = openPage(h, 'ops-queue.js', { role: 'CEM_LEAD', hook: restrict, values });
          if (masked(p.node('#rows').innerHTML).length || /마루중학교/.test(p.node('#rows').innerHTML)) return '운영 검토 대기를 ' + JSON.stringify(values) + '로 거르면 가린 계약이 나옴';
        }
        return true;
      },
    },
    {
      // 예시 열람 제한 계약(2610CL007, 2511CL002, 2609CL008)만 봄. 체결 대기, 만료 예정, 진행 현황에는 이 계약들이 나오지 않아 그 세 화면의 가림은 다음 시험이 봄
      name: '그 밖의 목록(체결 대기, 만료 예정, 의무 관리, 개요, 진행 현황, 내 계약)에 볼 수 없는 열람 제한 계약의 고객사가 나오지 않음(이도윤, 정하은)',
      kind: 'deny',
      run(h) {
        // 화면마다 먼저 올릴 스크립트(그 HTML이 부르는 차례대로)
        const pages = [['signing.js'], ['expiring.js'], ['obligations.js', ['obligation-ui.js']], ['dashboard.js'], ['progress.js'], ['my-contracts.js']];
        for (const [persona, who] of [[null, 'u_sales1'], [asSales2, 'u_sales2']]) {
          for (const [f, pre] of pages) {
            let pg;
            try { pg = openPage(h, f, { role: 'SALES', hook: persona || undefined, pre: pre || [] }); } catch (e) { return f + ' 화면을 열지 못함(' + who + '): ' + e.message; }
            const me = pg.env.C.currentUser();
            if (me.id !== who) return '시험 사람이 ' + who + '가 아님';
            const names = hiddenNames(pg.env, me);
            if (!names.length) return '시험 전제: ' + who + '가 볼 수 없는 열람 제한 계약이 없음';
            const text = pg.text();
            const leak = names.filter(n => text.indexOf(n) > -1);
            if (leak.length) return f + '(' + who + ')에 볼 수 없는 열람 제한 계약의 고객사가 보임: ' + leak.join(', ');
          }
        }
        return true;
      },
    },
    {
      // (2026-11-13 약한 시험 고침) 위 시험은 예시 열람 제한 계약만 봐서, 체결 대기, 만료 예정, 진행 현황에는 그 계약이 최고관리자로 열어도 한 건도 나오지 않아
      //   가림을 시험하지 못하고 늘 통과했음. 그래서 그 화면에 실제로 나오는 정하은의 계약을 열람 제한으로 바꿔 봄:
      //   체결 대기 2609CL002(바른출판), 만료 예정 2509CL002(모아물류)와 2510CL001(푸른숲중학교), 진행 현황과 개요 2610CL002(미래로병원), 의무 관리 2609CL001(청람컨설팅)
      //   화면마다 ① 최고관리자는 바꾼 뒤에도 그 고객사를 봄(화면이 그 계약을 그림) ② 같은 사람이 바꾸기 전에는 그 고객사를 봄(이 사람의 목록에 그 계약이 들어옴)
      //   ③ 바꾼 뒤 그 사람이 볼 수 없게 되면 고객사가 화면 어디에도 없음. ②가 없으면 ③은 뜻이 없어 시험 대조 실패로 봄
      //   체결 대기와 내 계약은 지금 영업대표(볼 수 있는 사람)와 최고관리자만 남의 계약을 보므로 ③을 시험할 사람이 없음: ①만 보고 아래 사람 짝에서 뺌
      name: '체결 대기, 만료 예정, 의무 관리, 개요, 진행 현황, 내 계약에 실제로 나오는 남의 계약을 열람 제한으로 바꾸면, 볼 수 없게 된 사람에게는 그 고객사가 사라짐(최고관리자는 그대로 봄)',
      kind: 'deny',
      run(h) {
        const R = ['2609CL002', '2509CL002', '2510CL001', '2610CL002', '2609CL001'];
        const restrict = D => { D.CONTRACTS.forEach(c => { if (c.id && R.some(i => c.id === i || c.id.indexOf(i + '-') === 0)) c.restricted = true; }); };
        const names = env => R.map(i => env.contract(i).counterparty);
        const pages = { 'signing.js': [], 'expiring.js': [], 'obligations.js': ['obligation-ui.js'], 'dashboard.js': [], 'progress.js': [], 'my-contracts.js': [] };
        // ① 최고관리자: 바꾼 뒤에도 화면마다 바꾼 계약의 고객사가 하나 이상 보임
        for (const f of Object.keys(pages)) {
          const sp = openPage(h, f, { role: 'SUPER', hook: restrict, pre: pages[f] });
          const t = sp.text();
          if (!names(sp.env).some(n => t.indexOf(n) > -1)) return f + ': 최고관리자에게도 열람 제한으로 바꾼 계약의 고객사가 하나도 보이지 않음(시험 대조 실패)';
        }
        // ②, ③ 사람 짝: [화면, 역할(시연 인물)]
        const pairs = [['expiring.js', 'HEAD'], ['obligations.js', 'SALES'], ['dashboard.js', 'SA_LEAD'], ['progress.js', 'SALES']];
        for (const [f, role] of pairs) {
          const after = openPage(h, f, { role, hook: restrict, pre: pages[f] });
          const me = after.env.C.currentUser();
          // 바꾼 뒤 이 사람이 볼 수 없게 된 고객사(볼 수 있는 다른 계약에 쓰인 이름은 뺌)
          const gone = hiddenNames(after.env, me).filter(n => names(after.env).indexOf(n) > -1);
          if (!gone.length) return f + '(' + me.id + '): 시험 전제: 바꾼 계약 가운데 이 사람이 볼 수 없게 된 것이 없음';
          const before = openPage(h, f, { role, pre: pages[f] });
          const shown = gone.filter(n => before.text().indexOf(n) > -1);
          if (!shown.length) return f + '(' + me.id + '): 시험 대조 실패, 바꾸기 전에도 ' + gone.join(', ') + '이(가) 이 사람의 화면에 없음';
          const t = after.text();
          const leak = shown.filter(n => t.indexOf(n) > -1);
          if (leak.length) return f + '(' + me.id + ')에 볼 수 없게 된 열람 제한 계약의 고객사가 보임: ' + leak.join(', ');
        }
        return true;
      },
    },
    {
      name: '열람 제한 계약을 다루는 메일(예시 메일 틀)의 제목과 사실 표에 고객사가 없고 계약번호만 있음',
      kind: 'deny',
      run(h) {
        const env = env0(h, { role: 'SUPER' });
        const R = env.D.CONTRACTS.filter(c => c.id && c.restricted);
        let n = 0;
        for (const t of env.D.EMAIL_TYPES) {
          for (const m of [t.sample, t.leadSample, t.altSample, t.thirdSample]) {
            if (!m) continue;
            const head = String(m.subject) + ' ' + JSON.stringify(m.facts || []) + ' ' + String(m.intro || '');
            R.filter(c => head.indexOf(c.id) > -1).forEach(c => {
              n += 1;
              if (head.indexOf(c.counterparty) > -1) throw new Error(t.code + ' 메일에 열람 제한 계약 ' + c.id + '의 고객사(' + c.counterparty + ')가 보임');
            });
          }
        }
        if (!n) return '시험 전제: 열람 제한 계약을 다루는 예시 메일이 없음';
        return true;
      },
    },
    {
      name: '접속 기록 점검(정보보호 한서연)의 접속 기록 조회와 관리자 변경 이력: 볼 수 없는 2511CL002의 고객사 이름으로 찾으면 결과 없음, 대상 칸은 계약번호만',
      kind: 'deny',
      run(h) {
        const vals = extra => Object.assign({ 'q-pick': '2026-Q3', 'cfg-month': '2026-09' }, extra);
        const base = openPage(h, 'admin-logs.js', { role: 'PRIVACY', values: vals({ 'f-q': '2511CL002', 'adm-q': '2511CL002' }) });
        const me = base.env.C.currentUser();
        if (base.env.C.canView(base.env.contract('2511CL002'), me)) return '시험 전제: 한서연이 2511CL002를 볼 수 있음';
        const logs = base.node('#log-rows').innerHTML, adm = base.node('#adm-rows').innerHTML;
        if (logs.indexOf('2511CL002') < 0) return '접속 기록 조회에서 2511CL002 기록을 찾지 못함(시험 대조 실패)';
        if (adm.indexOf('2511CL002') < 0) return '관리자 변경 이력에서 2511CL002 기록을 찾지 못함(시험 대조 실패)';
        if (/푸른솔/.test(logs) || /푸른솔/.test(adm)) return '대상 칸에 볼 수 없는 2511CL002의 고객사 이름이 보임';
        const byName = openPage(h, 'admin-logs.js', { role: 'PRIVACY', values: vals({ 'f-q': '푸른솔', 'adm-q': '푸른솔' }) });
        if (byName.node('#log-rows').innerHTML.indexOf('조건에 맞는 기록이 없습니다') < 0) return '접속 기록 조회를 고객사 이름으로 찾으면 결과가 나옴';
        if (/2511CL002/.test(byName.node('#adm-rows').innerHTML)) return '관리자 변경 이력을 고객사 이름으로 찾으면 2511CL002 기록이 나옴';
        return true;
      },
    },
    // (2026-11-14 주말 점검, 열람 제한 점검 leak-01, leak-02) 관리자 변경 이력의 거래처 줄 사유와 예전 계약 기록 올림 줄도 가림(C.maskAdminRows)
    //   볼 수 없는 열람 제한 계약 2511CL002를 대신 써서, 그 번호가 든 기록 두 줄을 예시 기록에 더함
    {
      name: '접속 기록 점검(정보보호 한서연): 거래처 추가 줄의 사유에 볼 수 없는 열람 제한 계약번호가 없고, 그 번호로 찾아도 그 줄이 나오지 않음(설정 변경 묶음도)',
      kind: 'deny',
      run(h) {
        const hook = D => {
          D.ADMIN_LOG.push({ at: '2026-09-20 10:00', by: 'u_sales2', area: 'CUSTOMER', target: '새별전자(C-0099)', change: '거래처 추가: 211-87-00009, 계약 기안에서 직접 입력',
            reason: '2511CL002 계약을 기안하며 함께 등록', op: { k: 'CUSTOMER_ADD' } });
        };
        const vals = extra => Object.assign({ 'q-pick': '2026-Q3', 'cfg-month': '2026-09' }, extra);
        // 관리자 변경 이력은 최근 것부터 쪽을 나누므로 더한 줄을 거래처 이름으로 찾아 봄
        const pg = openPage(h, 'admin-logs.js', { role: 'PRIVACY', hook: hook, values: vals({ 'adm-q': '새별전자' }) });
        const me = pg.env.C.currentUser();
        if (pg.env.C.canView(pg.env.contract('2511CL002'), me)) return '시험 전제: 한서연이 2511CL002를 볼 수 있음';
        const adm = pg.node('#adm-rows').innerHTML, cfg = pg.node('#cfg-rows').innerHTML;
        if (adm.indexOf('새별전자') < 0) return '관리자 변경 이력에 더한 거래처 줄이 없음(시험 대조 실패)';
        if (cfg.indexOf('새별전자') < 0) return '설정 변경 묶음에 더한 거래처 줄이 없음(시험 대조 실패)';
        if (/2511CL002 계약을/.test(adm) || /2511CL002/.test(cfg)) return '거래처 줄 사유에 볼 수 없는 계약번호가 보임';
        const byNo = openPage(h, 'admin-logs.js', { role: 'PRIVACY', hook: hook, values: vals({ 'adm-q': '2511CL002' }) });
        if (/새별전자/.test(byNo.node('#adm-rows').innerHTML)) return '계약번호로 찾으면 새별전자 거래처 줄이 나옴(번호와 거래처가 이어짐)';
        const au = openPage(h, 'admin-logs.js', { role: 'AUDIT', hook: hook, values: vals({ 'adm-q': '새별전자' }) });
        if (!au.env.C.canView(au.env.contract('2511CL002'), au.env.C.currentUser())) return '시험 전제: 감사 열람이 2511CL002를 볼 수 없음';
        if (au.node('#adm-rows').innerHTML.indexOf('2511CL002 계약을 기안하며') < 0) return '볼 수 있는 감사 열람에게도 사유의 계약번호가 가려짐';
        return true;
      },
    },
    {
      name: '접속 기록 점검(정보보호 한서연): 볼 수 없는 열람 제한 계약의 예전 계약 기록 올림 줄은 금액, 기간, 예전 문서, 메모 없이 "열람 제한이라"로만 보임. 감사 열람은 다 봄',
      kind: 'deny',
      run(h) {
        const hook = D => {
          D.ADMIN_LOG.push({ at: '2026-09-21 10:00', by: 'u_sadmin', area: 'LEGACY', target: '2511CL002',
            change: '예전 계약 기록 올림: 예전 문서 영업-2025-9999, 결재일 2025-12-20, 계약 기간 2026-01-01~2026-12-31, 27,000,000원, 체결본 있음, 영업대표 비즈니스1유닛 이도윤',
            reason: '생긴 일: 연장. 고객 연장 요청 메모', op: { k: 'LEGACY_ADD', id: '2511CL002' } });
        };
        const vals = extra => Object.assign({ 'q-pick': '2026-Q3', 'cfg-month': '2026-09' }, extra);
        const pg = openPage(h, 'admin-logs.js', { role: 'PRIVACY', hook: hook, values: vals({ 'adm-q': '열람 제한이라' }) });
        const adm = pg.node('#adm-rows').innerHTML;
        if (adm.indexOf('열람 제한이라 내용은 볼 수 있는 사람만 봄') < 0) return '가린 예전 계약 기록 줄이 없음(시험 대조 실패)';
        if (/27,000,000|영업-2025-9999|연장 요청 메모|2026-12-31/.test(adm)) return '볼 수 없는 사람에게 예전 계약 기록의 금액, 기간, 예전 문서, 메모가 보임';
        const byAmt = openPage(h, 'admin-logs.js', { role: 'PRIVACY', hook: hook, values: vals({ 'adm-q': '27,000,000' }) });
        if (/2511CL002/.test(byAmt.node('#adm-rows').innerHTML)) return '금액으로 찾으면 가린 줄이 나옴';
        const au = openPage(h, 'admin-logs.js', { role: 'AUDIT', hook: hook, values: vals({ 'adm-q': '영업-2025-9999' }) });
        if (au.node('#adm-rows').innerHTML.indexOf('27,000,000') < 0) return '볼 수 있는 감사 열람에게도 예전 계약 기록 내용이 가려짐';
        return true;
      },
    },
    // (2026-11-14 주말 점검, 코드 다시 보기 common-01) 설정 변경 확인의 고객사 티어 줄(바꾼 뒤 기안한 계약)은 거래처 이름 바로 옆에 보여,
    //   볼 수 없는 열람 제한 계약의 번호가 나오면 그 계약이 어느 고객사 것인지 드러남(leak-01과 같은 짝). 해솔테크(C-0030)의 티어 변경 줄을 더해
    //   그 뒤 기안한 열람 제한 계약 2609CL008(재무 리더 마서진은 볼 수 없음)이 값 칸, 확인 창, 넘김 글에 번호 없이 건수로만 나오는지 봄
    {
      name: '설정 변경 확인(재무 리더 마서진)의 고객사 티어 줄: 볼 수 없는 2609CL008은 값 칸과 확인 창에 "열람 제한 계약 1건"으로만, "품의와 다름" 넘김 글에도 번호가 없음(감사 열람은 번호를 봄)',
      kind: 'deny',
      run(h) {
        const hook = D => {
          D.ADMIN_LOG.push({ at: '2026-09-05 10:00', by: 'u_admin', area: 'CUSTOMER', target: '해솔테크(C-0030)', change: '고객사 티어: 티어 2 → 티어 3',
            reason: '시험', op: { k: 'CUSTOMER_EDIT', id: 'C-0030', set: { name: '해솔테크', bizNo: '220-81-55239', use: true, tier: 'T3' } } });
        };
        const rowOf = html => String(html).split('<tr').find(r => r.indexOf('해솔테크(C-0030)') > -1) || '';
        const pg = openPage(h, 'config-review.js', { role: 'FIN_LEAD', hook });
        const { C, X } = pg.env, me = C.currentUser();
        if (me.id !== 'u_seojin_ma') return '시험 사람이 마서진이 아님';
        if (C.canView(pg.env.contract('2609CL008'), me)) return '시험 전제: 마서진이 2609CL008을 볼 수 있음';
        const cell = strip(rowOf(pg.node('#rows').innerHTML));
        if (!cell) return '해솔테크 티어 변경 줄이 설정 변경 확인에 없음(시험 대조 실패)';
        if (cell.indexOf('2609CL008') > -1) return '값 칸에 볼 수 없는 2609CL008이 거래처 이름과 함께 보임: ' + cell.slice(0, 200);
        if (cell.indexOf('바꾼 뒤 기안한 계약 1건(열람 제한 계약 1건)') < 0) return '값 칸에 열람 제한 계약 건수가 없음: ' + (cell.match(/바꾼 뒤.{0,60}/) || [''])[0];
        // 확인 창과 "품의와 다름" 넘김 글
        const row = X.settingChanges({ areas: ['CUSTOMER'] }).find(x => x.target === '해솔테크(C-0030)');
        pg.clickData('#content', { 'data-check': row.id });
        if (!pg.modal) return '확인 창이 열리지 않음';
        if (/2609CL008/.test(strip(pg.modal.body))) return '확인 창에 볼 수 없는 2609CL008이 보임';
        if (strip(pg.modal.body).indexOf('열람 제한 계약 1건') < 0) return '확인 창에 열람 제한 계약 건수가 없음';
        const n0 = X.issuesAll().length;
        const sv = submit(pg.modal, fakeForm(pg.modal, { note: '품의에 없음(시험).' }, { result: ['DIFF'] }));
        if (!sv.saved) return '확인이 저장되지 않음: ' + JSON.stringify(sv.errs);
        const is = X.issuesAll();
        if (is.length !== n0 + 1) return '컴플라이언스로 넘어간 일이 없음(시험 대조 실패)';
        if (/2609CL008/.test(is[0].note || '') || /2609CL008/.test(is[0].title || '')) return '넘김 글에 볼 수 없는 2609CL008이 거래처 이름과 함께 남음: ' + is[0].note;
        if (String(is[0].note).indexOf('열람 제한 계약 1건') < 0) return '넘김 글에 열람 제한 계약 건수가 없음: ' + is[0].note;
        // 견줌: 볼 수 있는 감사 열람은 값 칸에서 번호를 봄
        const au = openPage(h, 'config-review.js', { role: 'AUDIT', hook });
        if (!au.env.C.canView(au.env.contract('2609CL008'), au.env.C.currentUser())) return '시험 전제: 감사 열람이 2609CL008을 볼 수 없음';
        if (strip(rowOf(au.node('#rows').innerHTML)).indexOf('바꾼 뒤 기안한 계약 1건(2609CL008)') < 0) return '견줌: 볼 수 있는 감사 열람에게도 2609CL008이 가려짐';
        return true;
      },
    },
    {
      // (같은 common-01) 넘김 글은 컴플라이언스와 접속 기록 점검의 여러 사람이 읽어, 남기는 사람이 볼 수 있어도 열람 제한 계약은 번호 없이 건수만('SHARED')
      name: '최고관리자가 남긴 "품의와 다름" 넘김 글에도 열람 제한 계약 2609CL008의 번호가 없음(값 칸에서는 최고관리자가 번호를 봄)',
      kind: 'deny',
      run(h) {
        const hook = D => {
          D.ADMIN_LOG.push({ at: '2026-09-05 10:00', by: 'u_admin', area: 'CUSTOMER', target: '해솔테크(C-0030)', change: '고객사 티어: 티어 2 → 티어 3',
            reason: '시험', op: { k: 'CUSTOMER_EDIT', id: 'C-0030', set: { name: '해솔테크', bizNo: '220-81-55239', use: true, tier: 'T3' } } });
        };
        const pg = openPage(h, 'config-review.js', { role: 'SUPER', hook });
        const { X } = pg.env;
        const cell = strip(String(pg.node('#rows').innerHTML).split('<tr').find(r => r.indexOf('해솔테크(C-0030)') > -1) || '');
        if (cell.indexOf('바꾼 뒤 기안한 계약 1건(2609CL008)') < 0) return '견줌: 최고관리자의 값 칸에 2609CL008이 없음';
        const row = X.settingChanges({ areas: ['CUSTOMER'] }).find(x => x.target === '해솔테크(C-0030)');
        pg.clickData('#content', { 'data-check': row.id });
        if (!pg.modal) return '최고관리자에게 확인 창이 열리지 않음(시험 전제)';
        const sv = submit(pg.modal, fakeForm(pg.modal, { note: '품의에 없음(시험).' }, { result: ['DIFF'] }));
        if (!sv.saved) return '확인이 저장되지 않음: ' + JSON.stringify(sv.errs);
        const is = X.issuesAll()[0];
        if (!is || /2609CL008/.test(is.note || '')) return '넘김 글에 열람 제한 계약 번호가 남음: ' + (is && is.note);
        if (String(is.note).indexOf('바꾼 뒤 기안한 계약 1건(열람 제한 계약 1건)') < 0) return '넘김 글에 열람 제한 계약 건수가 없음: ' + is.note;
        return true;
      },
    },
    // (2026-11-14 주말 점검, 코드 다시 보기 common-02) 할인 예외 점검의 참고 표 넷: 볼 수 없는 열람 제한 계약은 고객사만이 아니라 금액과 계약 기간도 가림
    //   (01 REQ-AUTH-09 "금액은 가려지며", SCR-61 "계약번호, 계약 방식, 영업(유닛), 할인율, ③ 승인과 대리 결재만"). 비율, 늘린 달 수, 상태는 남김
    //   네 표에 한 줄씩 나오게 예시 계약을 열람 제한으로 바꿈: 유상 충전 2512CL001-C01(오늘 기안, 건당 8,000원 x 200건을 1,000,000원), 그대로 연장 LG-0001-R01,
    //   줄임 2609CL007-A01(-8,000,000원), 기간 늘림 2606CL002-C01. 재무 임원 국재원은 넷 모두 볼 수 없음
    {
      name: '할인 예외 점검(재무 임원)의 참고 표 넷: 볼 수 없는 열람 제한 계약 줄에 금액, 셈 줄, 계약 기간이 없고 비율과 늘린 달 수만 보임(최고관리자는 금액을 봄)',
      kind: 'deny',
      run(h) {
        const G = ['2609CL007', 'LG-0001', '2512CL001', '2606CL002'];
        const hook = D => {
          D.CONTRACTS.forEach(c => { if (c.id && G.some(g => c.id === g || c.id.indexOf(g + '-') === 0)) c.restricted = true; });
          const a = D.CONTRACTS.find(c => c.id === '2609CL007-A01');
          a.amount = -8000000; a.products = [{ feature: 'CK_CAMPUS_PLAG', qty: -1, amount: -8000000 }];
          const p = D.CONTRACTS.find(c => c.id === '2512CL001-C01');
          delete p.changeListPrice; delete p.changePriceUnit; delete p.changePriceFrom;
          p.requestedAt = '2026-10-19 10:00'; p.changeAmount = 1000000;
        };
        // [표, 계약번호, 남아야 할 비율 글, 가려야 할 글(최고관리자에게는 보여야 함)]
        const T = [['#paid-rows', '2512CL001-C01', '37.5%', '1,600,000원'], ['#renew-rows', 'LG-0001-R01', '표준보다 낮음 (10%)', '10,800,000원'],
          ['#shrink-rows', '2609CL007-A01', '참고 금액의 11.9% 더', '계약 단가 7,800,000원'], ['#period-rows', '2606CL002-C01', '1개월', '2027-06-30 → 2027-07-31']];
        const rowOf = (pg, sel, id) => strip(String(pg.node(sel).innerHTML).split('<tr').find(r => r.indexOf(id) > -1) || '');
        const pg = openPage(h, 'discount-review.js', { role: 'FIN_EXEC', hook, query: 'month=2026-10' });
        const me = pg.env.C.currentUser();
        for (const [sel, id, keep, gone] of T) {
          if (pg.env.C.canView(pg.env.contract(id), me)) return '시험 전제: 재무 임원이 ' + id + '를 볼 수 있음';
          const r = rowOf(pg, sel, id);
          if (!r) return sel + '에 ' + id + ' 줄이 없음(시험 대조 실패)';
          if (r.indexOf('열람 제한 계약') < 0) return id + ' 줄의 고객사가 가려지지 않음';
          if (/\d{1,3}(,\d{3})+원/.test(r) || r.indexOf('계약 단가') > -1 || r.indexOf('건당') > -1) return id + ' 줄에 금액이나 셈 줄이 보임: ' + r;
          if (/\d{4}-\d{2}-\d{2} → /.test(r) || r.indexOf('새 계약 기간') > -1) return id + ' 줄에 계약 기간이 보임: ' + r;
          if (r.indexOf(keep) < 0) return id + ' 줄에 남아야 할 "' + keep + '"이 없음: ' + r;
        }
        if (String(pg.node('#paid-desc').textContent).indexOf('고객사와 금액을 가리고') < 0) return '유상 충전 표 설명에 금액을 가린다는 말이 없음';
        // 견줌: 최고관리자는 같은 줄의 금액과 기간을 봄
        const sp = openPage(h, 'discount-review.js', { role: 'SUPER', hook, query: 'month=2026-10' });
        for (const [sel, id, , gone] of T) if (rowOf(sp, sel, id).indexOf(gone) < 0) return '견줌: 최고관리자에게도 ' + id + ' 줄의 "' + gone + '"이 없음';
        return true;
      },
    },
  ],
  serverOnly: [
    '개발자 도구로 받은 데이터를 봄: 서버가 보내는 목록 데이터에 볼 수 없는 계약의 고객사, 서비스, 금액이 아예 없어야 함(시안은 예시 데이터 전체를 브라우저에 불러 화면에서만 가림, 04 2.5)',
    '결재 차례 메일, 만료 메일의 제목과 사실 표: 메일 틀은 서버가 만듦(01 REQ-ENV-14, 04 3장 "메일 틀"). 시안에는 열람 제한 계약의 결재 차례, 만료 예시 메일이 없어 예시 메일 틀(지정 열람자, 보류)만 시험함',
    '가린 줄의 요청자 이름을 보일지 화면마다 다름: 04 2.5 [확인 필요]라 정답이 없어 시험하지 않음(지금 시안은 검토 대기와 전체 계약에서 요청자, 영업대표 이름을 보임)',
    '가림은 서버의 규칙 하나로 함(04 2.5): 시안은 화면마다 canView로 가림',
  ],
};
