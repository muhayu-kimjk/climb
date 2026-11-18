// AC-41 후속 기안의 열람 제한 이어받기 (CTL-93, 06 통제 목록 2장) 시험 (2026-11-13 주말 점검 W2)
//   해지 기안(terminate.js), 연장 검토(renewal.js), 운영 변경(ops-change.js), 계약 등록의 변경과 연장(new-contract.js)을 가짜 문서에 올려 봄
//   관리자의 열람 제한 걸기와 풀기는 common.js applyAdmin(RESTRICT), 지정 열람자는 원계약(묶음)의 것(viewersOf)
//   시안 열람 제한 원계약: 2511CL002 푸른솔아카데미(영업대표 정하은, 계약 완료, 지정 열람자 CEM유닛과 석다인(풀림)), 2609CL008 해솔테크(정하은, 계약 완료)
//   화면 도우미(lib.js): page(입력 칸을 읽는 가짜 문서), env0
'use strict';
const { page, env0, stripTags: strip } = require('./lib');

// 화면 글 어디에든 그 말이 있는지(요소 글, 값)
function leakIds(dom, word) {
  const out = [];
  dom.ids.forEach((e, k) => { if ((String(e.innerHTML || '') + String(e.textContent || '') + String(e.value || '')).indexOf(word) > -1) out.push(k); });
  return out;
}
// 정하은이 2511CL002의 해지를 기안(해지 기안 화면에서 해지일과 사유를 넣고 확인 창의 기안). 돌려주는 값 { env, t: 새 해지 기안, why }
function terminate(h, id) {
  const env = env0(h, { role: 'SALES' });
  const dom = page(env, 'terminate.js', '?origin=' + id, { user: env.U('u_sales2') });
  if (dom.error) return { env, why: '해지 기안 화면을 열지 못함: ' + dom.error.message };
  if (dom.q('#form').hidden !== false) return { env, why: '해지 기안 양식이 열리지 않음: ' + strip(dom.q('#notice').innerHTML) };
  dom.q('#f-date').value = '2026-11-30';
  dom.q('#f-reason').value = '고객 요청으로 해지';
  dom.submit();
  if (dom.q('#confirm-modal').hidden !== false) return { env, why: '기안 확인 창이 열리지 않음: ' + strip(dom.errors()) };
  dom.confirmClick();
  const t = env.contract(id + '-T01');
  return t ? { env, t, why: '' } : { env, why: id + '-T01이 생기지 않음' };
}
const viewerKeys = (env, c) => env.C.viewersOf(c).map(v => env.C.viewerKey(v) + ':' + env.C.viewerState(v)).sort().join(', ');

module.exports = {
  ac: 'AC-41',
  title: '후속 기안의 열람 제한 이어받기',
  tests: [
    {
      name: '열람 제한 원계약 2511CL002의 해지 기안 -T01도 열람 제한이고 지정 열람자(CEM유닛 지정 중, 석다인 풀림)가 그대로',
      kind: 'ok',
      run(h) {
        const r = terminate(h, '2511CL002');
        if (r.why) return r.why;
        const { env, t } = r;
        const root = env.contract('2511CL002');
        if (t.restricted !== true) return '해지 기안이 열람 제한이 아님';
        if (!viewerKeys(env, root)) return '시험 전제: 원계약에 지정 열람자가 없음';
        if (viewerKeys(env, t) !== viewerKeys(env, root)) return '해지 기안의 지정 열람자(' + viewerKeys(env, t) + ')가 원계약(' + viewerKeys(env, root) + ')과 다름';
        return true;
      },
    },
    {
      name: '해지 기안에서 지정 열람자가 빠지지 않음: CEM유닛의 결재선 밖 사람(편하린)은 -T01을 보고, 지정이 풀린 석다인과 지정 없는 영업(이도윤)은 못 봄',
      kind: 'deny',
      run(h) {
        const r = terminate(h, '2511CL002');
        if (r.why) return r.why;
        const { env, t } = r;
        if ((t.approvals || []).some(a => a.userId === 'u_harin_pyeon')) return '시험 전제: 편하린이 -T01 결재선에 있음';
        if (!env.C.canView(t, env.U('u_harin_pyeon'))) return '지정 열람자 조직(CEM유닛)의 편하린이 해지 기안 -T01을 못 봄(지정 열람자가 빠짐)';
        if (env.C.canView(t, env.U('u_dain_seok'))) return '지정이 풀린 석다인이 해지 기안 -T01을 봄';
        if (env.C.canView(t, env.U('u_sales1'))) return '지정되지 않은 이도윤이 해지 기안 -T01을 봄';
        return true;
      },
    },
    {
      // (2026-11-13 약한 시험 고침) 전에는 2609CL008이 자동갱신이 아니라서 연장 검토는 영업대표 정하은이 열어도 막혔고, 볼 수 없는 사람은 늘 영업대표가 아닌 사람이라
      //   "볼 수 없어서 막힘"과 "영업대표가 아니라서 막힘"을 가르지 못했음. 그래서 시험에서
      //   ① 2609CL008을 자동갱신으로 바꾸고 ② 영업대표 정하은으로 같은 주소를 열어 양식이 열리는지(견줌) ③ 볼 수 있지만 영업대표가 아닌 영업(유지호, 사람으로 지정)은
      //   "영업대표만" 안내로 막히는지 ④ 볼 수 없는 이도윤은 그 안내(영업대표 이름이 드러남)가 아니라 "찾을 수 없습니다"로 막히는지(계약 등록은 아무 안내 없이 비움) 봄
      //   ④의 말은 화면 코드 주석(terminate.js, renewal.js, ops-change.js 2026-11-06 점검: "찾을 수 없습니다"는 없는 번호나 볼 수 없는 기록일 때만,
      //   new-contract.js: 영업대표만 안내는 볼 수 있는 계약일 때만)의 정함
      name: '볼 수 없는 열람 제한 계약(2609CL008, 시험에서 자동갱신으로 바꿈) 번호를 주소에 넣고 해지, 연장 검토, 운영 변경, 변경과 연장 기안을 엶(이도윤): 원계약으로 잡히지 않고 고객사가 채워지지 않음. 영업대표(정하은)는 양식이 열리고, 볼 수 있는 다른 영업(유지호)은 "영업대표만"으로 막혀 두 판단이 나뉨',
      kind: 'deny',
      run(h) {
        const hook = D => {
          D.CONTRACTS.forEach(c => { if (c.id && (c.id === '2609CL008' || c.id.indexOf('2609CL008-') === 0)) c.autoRenew = 'YES'; });
          const c = D.CONTRACTS.find(x => x.id === '2609CL008');
          c.viewers = (c.viewers || []).concat([{ kind: 'USER', userId: 'u_jiho_yoo', deptAtGrant: '비즈니스2유닛', by: 'u_admin', at: '2026-10-10 10:00', reason: '시험' }]);
        };
        const KEEP = [['input[name="choice"]:checked', { type: 'radio', name: 'choice', value: 'KEEP', checked: true }]]; // 연장 검토의 "그대로 자동갱신"
        const pre = env0(h, { role: 'SALES', hook });
        const c0 = pre.contract('2609CL008');
        if (!c0.restricted) return '시험 전제: 2609CL008이 열람 제한이 아님';
        if (pre.C.bundleOf('2609CL008').autoRenew !== 'YES') return '시험 전제: 2609CL008을 자동갱신으로 바꾸지 못함';
        if (pre.C.canView(c0, pre.U('u_sales1'))) return '시험 전제: 이도윤이 2609CL008을 볼 수 있음';
        if (!pre.C.isSalesRep(c0, pre.U('u_sales2'))) return '시험 전제: 정하은이 2609CL008의 영업대표가 아님';
        if (!pre.C.canView(c0, pre.U('u_jiho_yoo')) || pre.C.isSalesRep(c0, pre.U('u_jiho_yoo'))) return '시험 전제: 유지호가 볼 수 있고 영업대표가 아닌 사람이 아님';
        const name = c0.counterparty;
        const open = (f, q, who) => { const env = env0(h, { role: 'SALES', hook }); return { env, dom: page(env, f, q, { user: env.U(who), preset: f === 'renewal.js' ? KEEP : [] }) }; };
        const opened = (f, dom) => (f === 'new-contract.js' ? dom.q('#f-origin').value === '2609CL008' : dom.q('#form').hidden === false);
        const notice = dom => strip(dom.q('#notice').innerHTML);
        for (const [f, q] of [['terminate.js', '?origin=2609CL008'], ['renewal.js', '?origin=2609CL008'], ['ops-change.js', '?origin=2609CL008'],
          ['new-contract.js', '?kind=AMEND&origin=2609CL008'], ['new-contract.js', '?kind=RENEW&origin=2609CL008']]) {
          // ② 견줌: 영업대표 정하은은 같은 주소로 양식이 열리고 고객사가 채워짐
          const rep = open(f, q, 'u_sales2');
          if (rep.dom.error) return f + q + ' 화면을 영업대표로 열지 못함: ' + rep.dom.error.message;
          if (!opened(f, rep.dom)) return f + q + ': 시험 대조 실패, 영업대표 정하은에게도 양식이 열리지 않음: ' + notice(rep.dom).slice(0, 60);
          if (!leakIds(rep.dom, name).length) return f + q + ': 시험 대조 실패, 영업대표의 양식에 고객사가 채워지지 않음';
          // ③ 볼 수 있지만 영업대표가 아닌 유지호: "영업대표만" 안내로 막힘
          const other = open(f, q, 'u_jiho_yoo');
          if (other.dom.error) return f + q + ' 화면을 유지호로 열지 못함: ' + other.dom.error.message;
          if (opened(f, other.dom)) return f + q + ': 영업대표가 아닌 유지호에게 양식이 열림';
          if (notice(other.dom).indexOf('영업대표') < 0) return f + q + ': 볼 수 있는 유지호가 "영업대표만" 안내로 막히지 않음: ' + notice(other.dom).slice(0, 60);
          // ④ 볼 수 없는 이도윤: 양식이 열리지 않고 고객사가 없으며, 영업대표 안내가 아니라 "찾을 수 없습니다"(계약 등록은 안내 없음)
          const { env, dom } = open(f, q, 'u_sales1');
          if (dom.error) return f + q + ' 화면을 열지 못함: ' + dom.error.message;
          const leak = leakIds(dom, name);
          if (leak.length) return f + q + ': 볼 수 없는 계약의 고객사(' + name + ')가 보임 ' + leak.join(', ');
          if (f === 'new-contract.js' && dom.q('#f-origin').value === '2609CL008') return f + q + ': 볼 수 없는 계약이 원계약으로 골라짐';
          if (f !== 'new-contract.js' && dom.q('#form').hidden === false) return f + q + ': 볼 수 없는 계약으로 기안 양식이 열림';
          if (notice(dom).indexOf('영업대표') > -1) return f + q + ': 볼 수 없는 이도윤이 "영업대표만" 안내까지 가서 그 계약의 영업대표가 드러남: ' + notice(dom).slice(0, 60);
          if (f !== 'new-contract.js' && notice(dom).indexOf('찾을 수 없습니다') < 0) return f + q + ': 볼 수 없는 이도윤에게 "찾을 수 없습니다" 안내가 없음: ' + notice(dom).slice(0, 60);
          if (f === 'new-contract.js' && notice(dom).indexOf('2609CL008') > -1) return f + q + ': 볼 수 없는 이도윤의 안내에 그 계약번호가 나옴: ' + notice(dom).slice(0, 60);
          if (env.D.CONTRACTS.some(c => c.parentId === '2609CL008' && c.requesterId === 'u_sales1')) return f + q + ': 볼 수 없는 계약에 후속 기안이 생김';
        }
        return true;
      },
    },
    {
      name: '열람 제한 원계약(2511CL002)의 변경과 연장 기안 화면: 열람 제한 체크가 켜진 채 잠겨 영업이 풀 수 없음(정하은)',
      kind: 'deny',
      run(h) {
        for (const kind of ['AMEND', 'RENEW']) {
          const env = env0(h, { role: 'SALES' });
          const dom = page(env, 'new-contract.js', '?kind=' + kind + '&origin=2511CL002', { user: env.U('u_sales2') });
          if (dom.error) return '계약 등록(' + kind + ')을 열지 못함: ' + dom.error.message;
          if (dom.q('#f-origin').value !== '2511CL002') return '계약 등록(' + kind + ')에서 영업대표의 원계약 2511CL002가 골라지지 않음(시험 대조 실패)';
          const rc = dom.q('#f-restricted');
          if (!rc.checked) return kind + ' 기안의 열람 제한 체크가 켜지지 않음(원계약을 이어받지 않음)';
          if (!rc.disabled) return kind + ' 기안의 열람 제한 체크가 잠기지 않아 영업이 풀 수 있음';
          // 원계약을 다시 골라도(change) 그대로
          dom.fire('#form', 'change', { target: dom.q('#f-origin') });
          if (!rc.checked || !rc.disabled) return kind + ' 기안에서 원계약을 다시 고르면 열람 제한 잠김이 풀림';
        }
        return true;
      },
    },
    {
      name: '원계약 후보 목록과 "붙을 번호" 안내에 볼 수 없는 계약의 고객사가 없음(이도윤의 변경, 연장 기안)',
      kind: 'deny',
      run(h) {
        const pre = env0(h, { role: 'SALES' });
        const me = pre.U('u_sales1');
        const seen = pre.D.CONTRACTS.filter(c => c.id && pre.C.canView(c, me)).map(c => c.counterparty);
        const names = pre.D.CONTRACTS.filter(c => c.id && c.restricted && !pre.C.canView(c, me)).map(c => c.counterparty).filter(n => seen.indexOf(n) < 0);
        if (!names.length) return '시험 전제: 이도윤이 볼 수 없는 열람 제한 계약이 없음';
        for (const kind of ['AMEND', 'RENEW']) {
          const env = env0(h, { role: 'SALES' });
          const dom = page(env, 'new-contract.js', '?kind=' + kind, { user: env.U('u_sales1') });
          if (dom.error) return '계약 등록(' + kind + ')을 열지 못함: ' + dom.error.message;
          const opts = String(dom.q('#f-origin').innerHTML);
          if (!/<option value="[^"]+"/.test(opts)) return '계약 등록(' + kind + ')의 원계약 후보가 비어 있음(시험 대조 실패)';
          const leak = names.filter(n => opts.indexOf(n) > -1 || String(dom.q('#origin-help').innerHTML).indexOf(n) > -1);
          if (leak.length) return '원계약 후보나 안내에 볼 수 없는 계약의 고객사가 보임(' + kind + '): ' + leak.join(', ');
        }
        return true;
      },
    },
    {
      name: '관리자가 원계약의 열람 제한을 풀면 진행 중인 후속 기안도 함께 풀리고, 걸면 함께 걸림(2511CL002-T01, 2606CL001 묶음)',
      kind: 'deny',
      run(h) {
        const r = terminate(h, '2511CL002');
        if (r.why) return r.why;
        const { env, t } = r;
        env.ctx.location.search = '?role=ADMIN';
        if (env.C.currentUser().role !== 'ADMIN') return '관리자로 바꾸지 못함(시험 틀 확인)';
        const off = env.C.adminSave('RESTRICT', '2511CL002', '열람 제한 해제', '시험: 공개된 계약', { k: 'RESTRICT', id: '2511CL002', on: false });
        if (off.refused) return '관리자 저장이 거부됨(시험 틀 확인)';
        if (env.contract('2511CL002').restricted) return '원계약의 열람 제한이 풀리지 않음';
        if (t.restricted) return '원계약을 풀었는데 진행 중인 해지 기안 -T01은 열람 제한 그대로';
        env.C.adminSave('RESTRICT', '2511CL002', '열람 제한 설정', '시험: 다시 가림', { k: 'RESTRICT', id: '2511CL002', on: true });
        if (!t.restricted) return '원계약에 다시 걸었는데 해지 기안 -T01은 풀린 그대로';
        // 후속 기안 번호로 걸어도 묶음 전체에(2606CL001: 변경 C01, C02, A01이 있음)
        const kids = env.D.CONTRACTS.filter(c => c.id && env.C.rootOf(c) === '2606CL001');
        if (kids.length < 3 || kids.some(c => c.restricted)) return '시험 전제: 2606CL001 묶음이 열람 제한이 아니거나 후속 기안이 없음';
        env.C.adminSave('RESTRICT', '2606CL001-C02', '열람 제한 설정', '시험: 후속 기안 번호로 걺', { k: 'RESTRICT', id: '2606CL001-C02', on: true });
        const left = kids.filter(c => !c.restricted).map(c => c.id);
        if (left.length) return '후속 기안 번호로 걸었는데 묶음에서 빠진 계약: ' + left.join(', ');
        return true;
      },
    },
  ],
  serverOnly: [
    '기안 화면의 잠긴 열람 제한 체크를 개발자 도구로 풀고 기안: 서버가 원계약(묶음)의 제한 값과 지정 열람자로 저장(시안의 계약 등록은 화면 값을 그대로 저장, 06 AC-41)',
    '후속 기안 저장 요청의 원계약 번호: 서버가 기안자가 볼 수 있고 영업대표인 원계약인지 다시 확인(시안은 화면이 막을 뿐 saveDemoContract는 다시 보지 않음)',
  ],
};
// 2026-11-18 셋째 점검 반영 시험(audit-trail-01~03, tools/control_tests/n18a.js): 고객사 티어 목록 변경과 영업대표 바꾸기의 감사 증적, 사후 등록 번호
module.exports.tests = module.exports.tests.concat(require('./n18a')('AC-41'));
