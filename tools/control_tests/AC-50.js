// AC-50 기간 마감 점검 확인 (CTL-65, 06 통제 목록 2장) 시험 (2026-11-13 주말 점검 W2)
//   기대 동작: 기간 말과 앞뒤 날 수로 세 목록(기간 말 앞뒤 체결과 마감 뒤에 올림, 승인됐지만 체결 전, ⑨ ⑩ 대기)을 지금 차수로 만들고 금액과 합계를 보인다.
//     재무가 기간 말이 지난 뒤 확인을 남기면 그 순간의 숫자와 견줄 값을 함께 저장하고, 고치거나 지우지 않는다. 지금 목록이 그때와 다르면 "확인한 뒤 바뀜"이 보인다.
//   시안 코드: stats.js 기간 마감 점검 묶음(closeLists, renderClose, openConfirm). 통계 화면을 가짜 문서에 올려 기간 말 칸과 확인 단추를 눌러 봄
'use strict';
const { fixClock, withModal, stats } = require('./lib');

function closeChecks(env) { return JSON.parse(env.store['climb.demoCloseChecks'] || '[]'); }
// 기간 말 칸을 바꾸고 넣는 중(input)처럼 다시 그림
function setEnd(x, end, days) {
  x.dom.q('#close-end').value = end;
  if (days != null) x.dom.q('#close-days').value = String(days);
  x.dom.fire('#close-bar', 'input');
}
// 확인 남기기 단추를 눌러 창이 열리면 메모를 넣고 저장. { opened, done }
function confirm(x, memo) {
  const m = withModal(x.env, () => x.dom.fire('#btn-close-ok', 'click'));
  if (!m.opened) return { opened: false, done: false };
  const r = m.submit({ memo: memo || '' });
  return { opened: true, done: r.done, errors: r.errors };
}
const listText = x => ['#close-a-rows', '#close-b-rows', '#close-c-rows', '#close-sum'].map(x.text).join(' ');

module.exports = {
  ac: 'AC-50',
  title: '기간 마감 점검 확인',
  tests: [
    {
      name: '기간 말 2026-09-30, 앞뒤 5일로 열면 2609CL001이 "마감 뒤에 올림"으로 보이고 2026-10-02 확인 기록에 "확인한 뒤 바뀜"이 붙음',
      kind: 'ok',
      run(h) {
        const x = stats(h, 'u_finance', null, 'FINANCE');
        if (x.dom.error) return '통계 화면을 열지 못함: ' + x.dom.error.message;
        if (x.dom.q('#close-end').value !== '2026-09-30' || String(x.dom.q('#close-days').value) !== '5') return '기본 기간 말과 날 수가 2026-09-30, 5일이 아님';
        const a = x.dom.q('#close-a-rows').innerHTML;
        const row = String(a).split('</tr>').find(r => r.indexOf('2609CL001') > -1);
        if (!row) return '기간 말 앞뒤 체결 목록에 2609CL001이 없음';
        if (row.indexOf('마감 뒤에 올림') < 0) return '2609CL001에 "마감 뒤에 올림"이 붙지 않음';
        if (!/합계 \d+건/.test(x.text('#close-a-rows'))) return '목록에 합계 줄이 없음';
        const rec = x.text('#close-record');
        if (rec.indexOf('2026-10-02 09:10') < 0) return '2026-10-02 확인 기록이 보이지 않음';
        if (rec.indexOf('확인한 뒤 바뀜') < 0) return '2026-10-02 확인 기록에 "확인한 뒤 바뀜"이 붙지 않음';
        return true;
      },
    },
    {
      name: '재무 역할(오현우)로 확인을 남기면 확인 기록이 한 줄 더 쌓이고 그때 본 숫자와 견줄 값이 함께 남음',
      kind: 'ok',
      run(h) {
        const x = stats(h, 'u_finance', null, 'FINANCE');
        fixClock(x.env);
        if (x.dom.error) return '통계 화면을 열지 못함: ' + x.dom.error.message;
        const r = confirm(x, '시험 확인');
        if (!r.opened) return '확인 남기기 창이 열리지 않음';
        if (!r.done) return '확인이 저장되지 않음: ' + JSON.stringify(r.errors);
        const list = closeChecks(x.env);
        if (list.length !== 1) return '확인 기록이 ' + list.length + '줄 쌓임(1줄이어야 함)';
        const e = list[0];
        if (e.end !== '2026-09-30' || e.by !== 'u_finance' || e.memo !== '시험 확인') return '남은 확인의 기간 말, 사람, 메모가 다름: ' + JSON.stringify(e);
        if (!e.seen || !Array.isArray(e.seen.a) || !Array.isArray(e.seen.b) || !Array.isArray(e.seen.c) || !e.seen.sig) return '그때 본 숫자와 견줄 값(seen, sig)이 함께 남지 않음';
        const shown = (x.text('#close-record').match(/확인함/g) || []).length;
        if (shown !== 2) return '이 기간 말의 확인 기록이 ' + shown + '줄 보임(예시 1줄 + 새 1줄)';
        return true;
      },
    },
    {
      name: '재무가 아닌 사람(최고관리자, 관리자, 영업 리더, 감사 열람)에게는 확인 단추가 없고 눌러도 확인이 남지 않음',
      kind: 'deny',
      run(h) {
        const who = [['u_super', 'SUPER'], ['u_admin', 'ADMIN'], ['u_head', 'HEAD'], ['u_seoyul_ban', 'AUDIT']];
        for (const w of who) {
          const env0 = h.fresh({ role: w[1] });
          const x = stats(h, w[0], null, w[1]);
          if (x.dom.error) return w[0] + ' 통계 화면을 열지 못함: ' + x.dom.error.message;
          const r = confirm(x, '');
          if (r.opened || closeChecks(x.env).length) return env0.C.roleLabel(w[1]) + '(' + w[0] + ')가 기간 마감 점검 확인을 남길 수 있음';
          if (x.text('#close-record').indexOf('재무(담당자, 리더, 임원)가 남깁니다') < 0 && x.text('#close-record').indexOf('확인함') < 0) return w[0] + ': 확인은 재무가 남긴다는 안내가 없음';
        }
        return true;
      },
    },
    {
      name: '기간 말이 오늘(2026-10-19)이거나 뒤인 날이면 재무도 확인을 남기지 못함',
      kind: 'deny',
      run(h) {
        for (const end of ['2026-10-19', '2026-10-20', '2026-12-31']) {
          const x = stats(h, 'u_finance', null, 'FINANCE');
          if (x.dom.error) return '통계 화면을 열지 못함: ' + x.dom.error.message;
          setEnd(x, end);
          const r = confirm(x, '시험');
          if (r.opened || closeChecks(x.env).length) return '기간 말 ' + end + '에 확인이 남음';
          if (!x.env.toasts.some(t => t.warn)) return '기간 말 ' + end + ': 확인하지 못하는 까닭을 알리지 않음';
        }
        return true;
      },
    },
    {
      name: '같은 기간 말에 다시 확인해도 앞 확인을 고치거나 지우지 않고 한 줄 더 쌓음(예시 확인 기록도 그대로)',
      kind: 'deny',
      run(h) {
        const x = stats(h, 'u_finance', null, 'FINANCE');
        fixClock(x.env);
        const ex = JSON.stringify(x.env.D.CLOSE_CHECKS);
        const r1 = confirm(x, '첫 확인');
        const first = JSON.stringify(closeChecks(x.env)[0]);
        const r2 = confirm(x, '다시 확인');
        if (!r1.done || !r2.done) return '확인이 저장되지 않음(시험 전제)';
        const list = closeChecks(x.env);
        if (list.length !== 2) return '두 번 확인했는데 기록이 ' + list.length + '줄';
        if (JSON.stringify(list[0]) !== first) return '두 번째 확인이 첫 확인을 바꿈';
        if (JSON.stringify(x.env.D.CLOSE_CHECKS) !== ex) return '예시 확인 기록이 바뀜';
        const shown = (x.text('#close-record').match(/확인함/g) || []).length;
        if (shown !== 3) return '이 기간 말의 확인 기록이 ' + shown + '줄 보임(예시 1줄 + 새 2줄)';
        return true;
      },
    },
    {
      name: '볼 수 없는 열람 제한 계약은 세 목록과 합계에 고객사나 금액이 나오지 않고 건수만 알림(재무 표예준, 기간 말 2026-09-15)',
      kind: 'deny',
      run(h) {
        const x = stats(h, 'u_yejun_pyo', null, 'FINANCE');
        if (x.dom.error) return '통계 화면을 열지 못함: ' + x.dom.error.message;
        const c = x.env.contract('2609CL008');
        if (x.env.C.canView(c, x.u)) return '표예준이 2609CL008을 볼 수 있음(시험 전제)';
        setEnd(x, '2026-09-15', 5);
        const t = listText(x);
        if (t.indexOf(c.counterparty) > -1) return '볼 수 없는 계약의 고객사(' + c.counterparty + ')가 목록에 나옴';
        if (t.indexOf('2609CL008') > -1) return '볼 수 없는 계약번호가 목록에 나옴';
        if (t.indexOf(c.amount.toLocaleString('ko-KR')) > -1) return '볼 수 없는 계약의 금액이 목록이나 합계에 나옴';
        if (x.text('#close-sum').indexOf('볼 수 없는 1건') < 0) return '뺀 건수(1건) 안내가 없음: ' + x.text('#close-sum');
        // 견줌: 그 계약을 볼 수 있는 재무(오현우)에게는 같은 기간 말 목록에 나옴(헛돌지 않는지)
        const y = stats(h, 'u_finance', null, 'FINANCE');
        setEnd(y, '2026-09-15', 5);
        if (listText(y).indexOf('2609CL008') < 0) return '견줌: 오현우의 목록에도 2609CL008이 없음(시험 전제 확인 필요)';
        return true;
      },
    },
  ],
  serverOnly: [
    '확인 요청의 숫자(seen)를 바꿔 보냄: 서버가 세 목록과 그때 본 숫자, 견줄 값(열람 제한 포함)을 다시 계산해 period_close_check에 남김(시안은 화면이 계산한 값을 그대로 저장)',
    '남긴 확인을 고치거나 지우는 요청을 서버에 보냄: 거절(시안에는 그런 기능이 없고 쌓기만 함. 시연 기록 지우기는 시연 전용)',
    '재무가 아닌 사람이나 기간 말이 오늘이거나 뒤인 확인을 서버에 직접 보냄: 서버가 역할과 날짜를 다시 보고 거절(시안은 단추와 창에서만 막음)',
  ],
};
