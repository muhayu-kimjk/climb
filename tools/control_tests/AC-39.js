// AC-39 열람 제한 계약 상세 (CTL-91, 06 통제 목록 2장) 시험 (2026-11-13 주말 점검 W2)
//   볼 수 있는지의 판단(common.js canView)과 결재 문서, 계약 상세, 계약 요약서(review.js, contract.js, contract-print.js)의 "볼 수 없습니다" 안내를 봄
//   시안 열람 제한 계약: 2610CL007 가람전자(기안 이도윤, ⑤ 생략, 지정 열람자 재무기획유닛과 문태호), 2511CL002 푸른솔아카데미(기안 정하은, ③⑤ 생략,
//     지정 열람자 CEM유닛과 석다인(조직이 바뀌어 풀림)), 2609CL008 해솔테크(기안 정하은, ④⑤ 생략, 지정 열람자 없음). 모두 4번 아니요
//   화면 도우미(lib.js): 결재 문서는 page, 화면 없이 쓰는 것은 env0
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { page, openPage, env0, stripTags: strip } = require('./lib');

// 그 사람으로 화면을 열었을 때 고객사 이름이 화면 어디에든 나오는지(요소 글, 값)
function leakIds(dom, name) {
  const out = [];
  dom.ids.forEach((e, k) => { if ((String(e.innerHTML || '') + String(e.textContent || '') + String(e.value || '')).indexOf(name) > -1) out.push(k); });
  return out;
}
// 화면 하나를 그 사람으로 엶. 계약 상세(contract.html)는 obligation-ui.js를 먼저 부르므로 같은 차례로 먼저 올림
//   (2026-11-13 약한 시험 고침) 먼저 올리지 않으면 contract.js가 의무 칸(OB.wire)에서 멈춰, 볼 수 있는 사람의 화면을 끝까지 그리지 못했음
function openDoc(env, f, id, user) {
  if (f === 'contract.js') vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'prototype', 'assets', 'js', 'obligation-ui.js'), 'utf8'), env.ctx, { filename: 'obligation-ui.js' });
  return page(env, f, '?id=' + id, { user });
}
// 결재 문서, 계약 상세, 계약 요약서를 그 사람으로 열어 "볼 수 없습니다" 안내만 보이는지. 문제가 없으면 '' 아니면 까닭
function onlyNotice(h, id, who, hook) {
  for (const f of ['review.js', 'contract.js', 'contract-print.js']) {
    const env = env0(h, { role: 'SALES', hook });
    const c = env.contract(id);
    const dom = openDoc(env, f, id, typeof who === 'string' ? env.U(who) : who);
    if (dom.error) return f + ' 화면을 열지 못함: ' + dom.error.message;
    if (strip(dom.q('#notice').innerHTML).indexOf('이 계약은 볼 수 없습니다') < 0) return f + ': "이 계약은 볼 수 없습니다" 안내가 없음';
    const leak = leakIds(dom, c.counterparty);
    if (leak.length) return f + ': 고객사 이름(' + c.counterparty + ')이 화면에 보임 ' + leak.join(', ');
  }
  return '';
}
const can = (env, id, who, role) => env.C.canView(env.contract(id), env.U(who, role));

module.exports = {
  ac: 'AC-39',
  title: '열람 제한 계약 상세',
  tests: [
    {
      // (2026-11-13 약한 시험 고침) 06 되는 경우는 "상세를 열면 보임"인데 전에는 결재 문서(review.js)만 열었음. 계약 상세와 계약 요약서도 열어
      //   안내 없이 고객사가 보이는지 보고, 지정되지 않은 2609CL008은 같은 사람에게 세 화면 모두 안내만 보이는지 짝으로 봄
      name: '지정 열람자 조직(재무기획유닛)의 사람(표예준)이 2610CL007의 결재 문서, 계약 상세, 계약 요약서를 열면 보임. 지정 안 된 같은 역할의 계약(2609CL008)은 세 화면 모두 못 봄',
      kind: 'ok',
      run(h) {
        const env = env0(h, { role: 'FINANCE' });
        const c = env.contract('2610CL007');
        if (!C_on(env, c, 'DEPT', '재무기획유닛')) return '시험 전제: 2610CL007에 재무기획유닛 지정이 없음';
        if ((c.approvals || []).some(a => a.userId === 'u_yejun_pyo')) return '시험 전제: 표예준이 결재선에 있음';
        if ((c.checklist || {}).accounting === 'YES') return '시험 전제: 2610CL007이 4번 예라 재무가 지정 없이도 봄';
        if (!can(env, '2610CL007', 'u_yejun_pyo')) return '지정 열람자 조직의 표예준이 2610CL007을 볼 수 없음';
        // 사람으로 지정된 열람자(문태호)도 봄
        if (!can(env, '2610CL007', 'u_exec')) return '사람으로 지정된 열람자 문태호가 2610CL007을 볼 수 없음';
        for (const f of ['review.js', 'contract.js', 'contract-print.js']) {
          const e = env0(h, { role: 'FINANCE' });
          const dom = openDoc(e, f, '2610CL007', e.U('u_yejun_pyo'));
          if (dom.error) return f + ': 지정 열람자의 화면을 열지 못함: ' + dom.error.message;
          if (strip(dom.q('#notice').innerHTML).indexOf('이 계약은 볼 수 없습니다') > -1) return f + ': 지정 열람자에게 "볼 수 없습니다"로 보임';
          if (!leakIds(dom, c.counterparty).length) return f + ': 지정 열람자의 화면에 고객사(' + c.counterparty + ')가 보이지 않음(내용을 그리지 않음)';
        }
        if (can(env, '2609CL008', 'u_yejun_pyo')) return '지정되지 않은 2609CL008도 볼 수 있음(시험 대조 실패)';
        return onlyNotice(h, '2609CL008', 'u_yejun_pyo') || true;
      },
    },
    {
      name: '다른 영업(정하은)이 2610CL007의 결재 문서, 계약 상세, 계약 요약서 주소를 직접 엶: 안내만 보이고 고객사가 없음',
      kind: 'deny',
      run(h) {
        const env = env0(h, { role: 'SALES' });
        if (can(env, '2610CL007', 'u_sales2')) return '정하은이 2610CL007을 볼 수 있음';
        return onlyNotice(h, '2610CL007', 'u_sales2') || true;
      },
    },
    {
      name: '생략된 단계의 담당자: ⑤가 생략된 2610CL007의 ⑤ 담당 정보보호(한서연), ④가 생략된 2609CL008의 법무(김지우)는 못 봄',
      kind: 'deny',
      run(h) {
        const env = env0(h, { role: 'PRIVACY' });
        const st = (id, step) => ((env.contract(id).approvals || []).find(a => a.step === step) || {});
        if (st('2610CL007', 'S05').state !== 'SKIPPED' || st('2610CL007', 'S05').userId !== 'u_privacy') return '시험 전제: 2610CL007의 ⑤가 한서연 담당 생략이 아님';
        if (st('2609CL008', 'S04').state !== 'SKIPPED' || st('2609CL008', 'S04').userId !== 'u_legal') return '시험 전제: 2609CL008의 ④가 김지우 담당 생략이 아님';
        if (can(env, '2610CL007', 'u_privacy')) return '⑤가 생략된 2610CL007을 한서연이 볼 수 있음';
        if (can(env, '2609CL008', 'u_legal')) return '④가 생략된 2609CL008을 김지우가 볼 수 있음';
        return onlyNotice(h, '2610CL007', 'u_privacy') || true;
      },
    },
    {
      name: '대리 지정 기간이 끝난 사람: 2610CL007 ② 담당(배수아) 대신으로 지정됐던 석다인은 기간이 끝나면 못 봄(기간 안이면 봄)',
      kind: 'deny',
      run(h) {
        const dl = (to, ended) => D => D.DELEGATIONS.push({ id: 'DL-T39', absentId: 'u_sadmin', delegateId: 'u_dain_seok', from: '2026-10-10', to: to,
          reason: '시험', by: 'u_admin', at: '2026-10-09 10:00', endedAt: ended || null });
        const on = env0(h, { role: 'SALES_ADMIN', hook: dl('2026-10-25') });
        if (!(on.contract('2610CL007').approvals || []).some(a => a.step === 'S02' && a.state === 'PENDING' && a.userId === 'u_sadmin')) return '시험 전제: 2610CL007의 ②가 배수아 차례가 아님';
        if (!can(on, '2610CL007', 'u_dain_seok')) return '대리 지정 기간 안인 석다인도 볼 수 없음(시험 대조 실패)';
        const past = env0(h, { role: 'SALES_ADMIN', hook: dl('2026-10-15') });
        if (can(past, '2610CL007', 'u_dain_seok')) return '대리 지정 기간(2026-10-10~2026-10-15)이 끝난 석다인이 2610CL007을 봄';
        const early = env0(h, { role: 'SALES_ADMIN', hook: dl('2026-10-25', '2026-10-18 09:00') });
        if (can(early, '2610CL007', 'u_dain_seok')) return '일찍 끝낸 대리 지정의 석다인이 2610CL007을 봄';
        return true;
      },
    },
    {
      name: '조직이 바뀌어 지정이 풀린 사람: 2511CL002의 석다인(풀림)은 못 봄. 관리자가 문태호의 조직을 옮기면 2610CL007을 못 봄',
      kind: 'deny',
      run(h) {
        const env = env0(h, { role: 'ADMIN' });
        const v = env.C.viewersOf(env.contract('2511CL002')).find(x => x.kind === 'USER' && x.userId === 'u_dain_seok');
        if (!v || env.C.viewerState(v) !== 'RELEASED') return '시험 전제: 2511CL002의 석다인 지정이 풀린 상태가 아님';
        if (can(env, '2511CL002', 'u_dain_seok')) return '조직이 바뀌어 지정이 풀린 석다인이 2511CL002를 봄';
        if (!can(env, '2610CL007', 'u_exec')) return '시험 전제: 문태호가 2610CL007을 보지 못함';
        const a = env.D.ACCOUNTS.find(x => x.id === 'u_exec');
        const e = env.C.adminSave('USER', '문태호 (' + a.email + ')', '조직: 비즈니스유닛 → 비즈니스1유닛', '조직 이동 시험', { k: 'ACCOUNT_EDIT', email: a.email, set: { dept: '비즈니스1유닛' } });
        if (e.refused) return '관리자 저장이 거부됨(시험 틀 확인)';
        if (can(env, '2610CL007', 'u_exec')) return '조직을 옮긴 문태호가 2610CL007을 여전히 봄(사람 지정이 풀리지 않음)';
        // 같은 조직으로 돌아와도 되살아나지 않음(01 v0.52)
        env.C.adminSave('USER', '문태호 (' + a.email + ')', '조직: 비즈니스1유닛 → 비즈니스유닛', '조직 복귀 시험', { k: 'ACCOUNT_EDIT', email: a.email, set: { dept: '비즈니스유닛' } });
        if (can(env, '2610CL007', 'u_exec')) return '같은 조직으로 돌아온 문태호의 풀린 지정이 되살아남';
        return true;
      },
    },
    {
      name: '4번이 아니요인 열람 제한 계약(2609CL008, 2511CL002)을 지정되지 않은 재무 리더와 재무 임원이 엶: 못 봄',
      kind: 'deny',
      run(h) {
        const env = env0(h, { role: 'FIN_LEAD' });
        for (const id of ['2609CL008', '2511CL002']) {
          const c = env.contract(id);
          if (!c.restricted || (c.checklist || {}).accounting === 'YES') return '시험 전제: ' + id + '가 4번 아니요인 열람 제한 계약이 아님';
          for (const p of ['u_seojin_ma', 'u_jaewon_kook']) if (can(env, id, p)) return p + '가 ' + id + '를 봄';
        }
        return onlyNotice(h, '2609CL008', 'u_seojin_ma') || true;
      },
    },
    {
      name: '관찰자(용다온)는 열람 제한 계약을 하나도 못 봄',
      kind: 'deny',
      run(h) {
        const env = env0(h, { role: 'OBSERVER' });
        const seen = env.D.CONTRACTS.filter(c => c.id && c.restricted && env.C.canView(c, env.U('u_daon_yong')));
        if (seen.length) return '관찰자가 보는 열람 제한 계약: ' + seen.map(c => c.id).join(', ');
        return onlyNotice(h, '2610CL007', 'u_daon_yong') || true;
      },
    },
    {
      name: '(A-9) 관찰자의 조직(경영지원유닛)이나 관찰자 본인을 지정 열람자로 지정해도 못 봄. 열람자 지정의 사람 목록에 관찰자가 없음',
      kind: 'deny',
      run(h) {
        const env = env0(h, { role: 'ADMIN', hook: D => {
          const c = D.CONTRACTS.find(x => x.id === '2609CL008');
          c.viewers = [{ kind: 'DEPT', dept: '경영지원유닛', by: 'u_admin', at: '2026-10-10 10:00', reason: '시험' },
            { kind: 'USER', userId: 'u_daon_yong', deptAtGrant: '경영지원유닛', by: 'u_admin', at: '2026-10-10 10:00', reason: '예전 지정 시험' }];
        } });
        if ((env.contract('2609CL008').approvals || []).some(a => a.userId === 'u_seoyun_tak')) return '시험 전제: 탁서윤이 2609CL008 결재선에 있음';
        if (!can(env, '2609CL008', 'u_seoyun_tak')) return '시험 전제: 경영지원유닛 지정이 같은 조직의 탁서윤에게도 효력이 없음';
        if (can(env, '2609CL008', 'u_daon_yong')) return '조직이나 사람으로 지정된 관찰자가 2609CL008을 봄';
        // 열람 제한 관리(admin-restrict.js)의 사람 목록: 관찰자는 고를 수 없음(지정 창의 사람 고르기 칸)
        //   (2026-11-13 약한 시험 고침) 전에는 화면 소스를 정규식으로 잘라 거르는 식만 돌려 봐서, 코드 모양이 바뀌면 깨지고 다른 길로 더해진 관찰자는 잡지 못했음.
        //   이제 관리자로 화면을 열어 "열람자 추가" 단추를 누르고, 열린 창의 사람 고르기 칸에 나온 사람을 봄. 관찰자를 하나 더 만들어 함께 봄
        const pg = openPage(h, 'admin-restrict.js', { role: 'ADMIN', hook: D => {
          D.ACCOUNTS.push({ id: 'u_t39_obs', email: 't39.obs@muhayu.com', name: '시험관찰', dept: '재무기획유닛', roles: ['OBSERVER'], status: 'ACTIVE', registeredAt: '2026-10-01' });
        } });
        pg.clickData('#content', { 'data-viewer': '2609CL008' });
        if (!pg.modal) return '관리자에게 열람자 추가 창이 열리지 않음';
        const body = String(pg.modal.body || '');
        const opt = id => new RegExp('<option value="' + id + '"').test(body);
        // 견줌: 관찰자와 같은 조직(경영지원유닛)의 관찰자가 아닌 사람(탁서윤)은 목록에 있음
        if (!opt('u_seoyun_tak')) return '열람자 추가 창의 사람 목록에 관찰자가 아닌 탁서윤도 없음(시험 대조 실패)';
        const obs = pg.env.D.ACCOUNTS.filter(a => a.roles.indexOf('OBSERVER') > -1);
        if (obs.length < 2) return '시험 전제: 관찰자 계정이 둘(용다온, 더한 시험관찰)이 아님';
        const shown = obs.filter(a => opt(a.id));
        if (shown.length) return '열람자 지정의 사람 목록에 관찰자가 나옴: ' + shown.map(a => a.name).join(', ');
        return true;
      },
    },
    {
      name: '(C-2) 감사 열람: 끝나는 날 전인 인채율은 지정 없이 모든 열람 제한 계약을 보고, 2026-10-15에 끝난 반서율은 못 봄',
      kind: 'deny',
      run(h) {
        const env = env0(h, { role: 'AUDIT' });
        const R = env.D.CONTRACTS.filter(c => c.id && c.restricted);
        const miss = R.filter(c => !env.C.canView(c, env.U('u_chaeyul_in', 'AUDIT')));
        if (miss.length) return '끝나는 날 전인 감사 열람(인채율)이 못 보는 열람 제한 계약: ' + miss.map(c => c.id).join(', ');
        if (!env.C.roleEnded('u_seoyul_ban', 'AUDIT')) return '시험 전제: 반서율의 감사 열람이 끝난 것으로 잡히지 않음';
        const seen = R.filter(c => env.C.canView(c, env.U('u_seoyul_ban', 'AUDIT')));
        if (seen.length) return '끝난 감사 열람(반서율)이 보는 열람 제한 계약: ' + seen.map(c => c.id).join(', ');
        return onlyNotice(h, '2609CL008', env.U('u_seoyul_ban', 'AUDIT')) || true;
      },
    },
    {
      name: '(C-13, C-16) 컴플라이언스 담당자(반서율)는 감사 열람 없이 열람 제한 계약을 못 보고, 보류 목록의 묶음 보류에서도 고객사가 가려짐',
      kind: 'deny',
      run(h) {
        const env = env0(h, { role: 'COMPLIANCE', hook: D => { D.CONTRACTS.find(x => x.id === '2604CL001').restricted = true; } });
        const me = env.U('u_seoyul_ban', 'COMPLIANCE');
        const R = env.D.CONTRACTS.filter(c => c.id && c.restricted && !c.legacy);
        const seen = R.filter(c => env.C.canView(c, me));
        if (seen.length) return '컴플라이언스 담당자가 보는 열람 제한 계약: ' + seen.map(c => c.id).join(', ');
        // 묶음 보류 HD-0002(2604CL001)를 열람 제한으로 바꿔 봄: 보류 대상 글에 고객사 대신 "열람 제한 계약"
        const hd = (env.D.HOLDS || []).find(x => x.id === 'HD-0002');
        if (!hd || hd.bundleId !== '2604CL001') return '시험 전제: 묶음 보류 HD-0002(2604CL001)가 없음';
        const name = env.contract('2604CL001').counterparty;
        const t = env.C.holdTarget(hd, me) + ' ' + env.C.holdText(hd, me);
        if (t.indexOf(name) > -1) return '보류 대상 글에 볼 수 없는 계약의 고객사가 보임: ' + t;
        if (t.indexOf('열람 제한 계약') < 0) return '보류 대상 글에 "열람 제한 계약"이 없음: ' + t;
        return onlyNotice(h, '2609CL008', me) || true;
      },
    },
  ],
  serverOnly: [
    '다른 영업이 결재 문서, 상세, 계약 요약서 주소를 직접 요청: 서버가 canView를 다시 만들어 내용을 보내지 않음(시안은 예시 데이터를 모두 불러 화면에서 안내만 보임, 04 2.4)',
    '첨부 파일 주소를 직접 엶: 서버가 같은 판단으로 거부(시안에는 첨부 파일 내려받기 주소가 없음)',
    '인쇄 요청: 서버가 같은 판단을 씀(시안의 인쇄는 브라우저 인쇄)',
    '지정 열람자가 상세를 열 때 접속 기록에 VIEW 한 줄: 서버가 남김(시안의 접속 기록 조회는 예시 데이터로 만들어 상세를 연 VIEW 줄이 생기지 않음, 06 AC-39)',
  ],
};

// 계약 묶음에 그 지정이 효력 있게 있는지
function C_on(env, c, kind, key) {
  return env.C.viewersOf(c).some(v => v.kind === kind && (v.dept === key || v.userId === key) && env.C.viewerState(v) === 'ON');
}
// 2026-11-16 기획자 결정 반영 시험(작업기록/2026-11-16/반영목록.md, tools/control_tests/n16.js)
module.exports.tests = module.exports.tests.concat(require('./n16')('AC-39'));
