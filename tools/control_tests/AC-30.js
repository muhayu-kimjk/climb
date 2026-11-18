// AC-30 ⑧ 체결본 확인 (CTL-56, CTL-58, 06 통제 목록 2장) 시험 (2026-11-13 주말 점검 W2)
//   결재 문서(review.js)와 통계(stats.js)를 가짜 문서에 올려 ⑦ ⑧ ⑨ 확인 창을 눌러 봄(도우미는 lib.js)
'use strict';
const { page, review } = require('./lib');

// 06 AC-30 "여덟은 ...": 견적서로 대신하지 않은 종이 날인 계약의 ⑧ 확인 항목
const EIGHT = ['고객사와 사업자등록번호', '제품 줄의 수량과 금액과 합계', '계약 기간과 자동갱신과 해지 통지 일수', '정산 방식',
  '조항이 결재한 판과 같음', '양쪽 서명과 날인', '서명본 체결일이 체결본과 같음', '체결본 밖의 다른 약정(부속 합의 등)이 없음을 확인했습니다'];
const pend = c => (c.approvals || []).filter(a => a.state === 'PENDING').map(a => a.step);
const st = (c, step) => (c.approvals || []).find(a => a.step === step) || {};

module.exports = {
  ac: 'AC-30',
  title: '⑧ 체결본 확인',
  tests: [
    {
      name: '영업지원이 여덟 항목을 모두 표시해 확인 완료하면 "확인한 체결본", 운영 검토, ⑨ 차례(2609CL003)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES_ADMIN' });
        const c = env.contract('2609CL003');
        const rv = review(env, '2609CL003', 'u_sadmin');
        if (!rv.hasButton('APPROVE', 'S08')) return '⑧ 담당 영업지원에게 확인 완료 단추가 없음';
        rv.open('APPROVE', 'S08');
        const got = rv.checks().map(b => b.value);
        if (got.length !== 8) return '확인 항목이 여덟이 아님(' + got.length + '): ' + got.join(', ');
        const miss = EIGHT.filter(x => got.indexOf(x) < 0);
        if (miss.length) return '문서의 여덟 항목 중 빠진 것: ' + miss.join(', ');
        // 표준계약서를 바꾼 계약(체크리스트 1번 아니요)은 조항 대비표 안내와 결재한 판 번호
        if (rv.extra().indexOf('조항 대비표') < 0) return '표준계약서를 바꾼 계약인데 창에 조항 대비표와 견주라는 안내가 없음';
        if (!/결재한 판: <strong>계약서 초안 판 \d+/.test(rv.extra())) return '⑧ 창에 결재한 판 번호가 보이지 않음';
        rv.checkAll().confirm();
        if (c.status !== 'OPS_REVIEW') return '확인 완료 뒤 상태가 운영 검토가 아님: ' + c.status;
        if (pend(c).join(',') !== 'S09') return '⑨가 차례가 아님: ' + pend(c).join(',');
        const sv = env.C.signedVersions(c).filter(v => v.current);
        if (!sv.length || !sv[0].checked) return '지금 판에 "확인한 체결본" 표시가 없음';
        // 2026-11-13 보강(점검 지적): 기대 동작의 "결재 기록에 그때 본 체결본 판과 지문이 남는다"도 봄. 결재 문서를 다시 열어
        //   결재 기록 표(#history)의 ⑧ 확인 완료 줄에 "본 판: 체결본 판 (지금 판 번호)(지문 ...)"이 보이는지(앞서 다시 등록 요청을 받은 판 1이 아님)
        const e = c.history[c.history.length - 1];
        if (!e || e.step !== 'S08' || e.action !== 'APPROVE') return '⑧ 확인 완료가 결재 기록의 마지막 줄이 아님';
        const again = review(env, '2609CL003', 'u_sadmin');
        if (again.error) return '확인 완료 뒤 결재 문서를 다시 그리지 못함: ' + again.error.message;
        const row = String(again.dom.q('#history').innerHTML).split(/<tr\b/).map(r => r.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '))
          .find(r => r.indexOf(e.at.slice(0, 16)) > -1 && r.indexOf('⑧') > -1 && r.indexOf('확인 완료') > -1);
        if (!row) return '다시 연 결재 문서의 결재 기록 표에 ⑧ 확인 완료 줄이 없음';
        if (!new RegExp('본 판: 체결본 판 ' + sv[0].no + '\\(지문 [0-9A-F]{8}\\)').test(row)) return '⑧ 확인 완료 줄에 그때 본 체결본 판(판 ' + sv[0].no + ')과 지문이 보이지 않음: ' + row.slice(-120);
        return true;
      },
    },
    {
      name: '견적서로 대신한 계약은 여섯 항목이고 "견적번호와 판"에 연결한 견적 번호와 판(2609CL005)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES_ADMIN' });
        const c = env.contract('2609CL005');
        const rv = review(env, '2609CL005', 'u_sadmin');
        if (!rv.hasButton('APPROVE', 'S08')) return '⑧ 확인 완료 단추가 없음';
        rv.open('APPROVE', 'S08');
        const got = rv.checks().map(b => b.value);
        if (got.length !== 6) return '견적서로 대신한 계약의 확인 항목이 여섯이 아님(' + got.length + '): ' + got.join(', ');
        if (!got.some(x => x === '견적번호와 판(' + c.quoteNo + ' ' + c.quoteVer + '판)')) return '"견적번호와 판"에 연결한 견적(' + c.quoteNo + ' ' + c.quoteVer + '판)이 보이지 않음: ' + got.join(', ');
        rv.checkAll().confirm();
        if (c.status !== 'OPS_REVIEW') return '확인 완료 뒤 상태가 운영 검토가 아님: ' + c.status;
        return true;
      },
    },
    {
      name: '"조항"을 골라 반려하면 통계의 체결본 확인 반려 항목에 "조항"이 셈에 듦',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SUPER' });
        const c = env.contract('2609CL003');
        review(env, '2609CL003', 'u_sadmin').open('REJECT', 'S08').pick('CLAUSE').comment('고객이 서명하며 제7조를 고침').confirm();
        const e = c.history[c.history.length - 1];
        if (c.status !== 'REJECTED' || !e || (e.mismatch || []).indexOf('CLAUSE') < 0) return '"조항" 반려가 코드로 남지 않음';
        const d = page(env, 'stats.js', '?role=SUPER', { user: env.U('u_super'), preset: [['#f-period', { value: 'last12' }]] });
        if (d.error) return '통계 화면을 열지 못함: ' + d.error.message;
        const txt = String(d.q('#signed-meters').innerHTML).replace(/<[^>]+>/g, ' ');
        if (!/조항\s+반려 \d+건 중 [1-9]\d*건/.test(txt)) return '통계의 체결본 확인 반려 항목에 "조항"이 셈에 들지 않음: ' + txt.replace(/\s+/g, ' ').slice(0, 200);
        return true;
      },
    },
    {
      name: '확인 항목 하나를 빼면 확인 완료가 남지 않음',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES_ADMIN' });
        const c = env.contract('2609CL003'), n = c.history.length;
        const rv = review(env, '2609CL003', 'u_sadmin').open('APPROVE', 'S08');
        const k = rv.checks().length;
        for (let i = 0; i < k; i++) {
          rv.checkAll(i).confirm();
          if (c.history.length !== n || c.status !== 'APPROVED') return rv.checks()[i].value + '을 빼도 확인 완료가 남음';
        }
        rv.checkAll().confirm();
        if (c.status !== 'OPS_REVIEW') return '모두 표시해도 남지 않음(시험 전제가 맞지 않음)';
        return true;
      },
    },
    {
      name: '반려하면서 어긋난 항목을 하나도 고르지 않으면 남지 않음',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES_ADMIN' });
        const c = env.contract('2609CL003'), n = c.history.length;
        const rv = review(env, '2609CL003', 'u_sadmin').open('REJECT', 'S08').comment('금액이 다름');
        rv.confirm();
        if (c.history.length !== n || c.status !== 'APPROVED') return '어긋난 항목 없이 반려가 남음';
        if (!rv.reasons().some(b => b.value === 'CLAUSE')) return '반려 항목 코드표에 "조항"(CLAUSE)이 없음';
        rv.pick('AMOUNT').confirm();
        if (c.status !== 'REJECTED') return '항목을 골라도 반려되지 않음(시험 전제가 맞지 않음)';
        return true;
      },
    },
    {
      name: '다시 등록 요청을 사유 없이 할 수 없음',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES_ADMIN' });
        const c = env.contract('2609CL003'), n = c.history.length;
        const rv = review(env, '2609CL003', 'u_sadmin');
        if (!rv.hasButton('RETURN', 'S08')) return '다시 등록 요청 단추가 없음';
        rv.open('RETURN', 'S08').comment('').confirm();
        if (c.history.length !== n) return '사유 없이 다시 등록 요청이 남음';
        rv.comment('스캔이 흐림').confirm();
        if (pend(c).join(',') !== 'S07') return '사유를 적어도 ⑦로 돌아가지 않음(시험 전제가 맞지 않음): ' + pend(c).join(',');
        return true;
      },
    },
    {
      name: '⑦ 등록 전에는 ⑧을 처리할 수 없음(2609CL002, ⑦ 차례)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES_ADMIN' });
        const c = env.contract('2609CL002');
        if (st(c, 'S08').state !== 'WAITING') return '시험 전제: ⑧이 대기가 아님(' + st(c, 'S08').state + ')';
        if (['u_sadmin', 'u_super'].some(p => env.C.canAct(c, st(c, 'S08'), env.U(p)))) return '⑦ 등록 전인데 ⑧을 처리할 수 있음';
        if (review(env, '2609CL002', 'u_sadmin').hasButton('APPROVE', 'S08')) return '⑦ 등록 전인데 확인 완료 단추가 보임';
        return true;
      },
    },
    {
      name: '⑧ 담당 영업지원이 기안한 계약은 그 사람이 처리할 수 없고 ⑧은 재무 담당자 차례',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES_ADMIN', hook: D => { D.CONTRACTS.find(x => x.id === '2609CL003').requesterId = 'u_sadmin'; } });
        const c = env.contract('2609CL003'), s = st(c, 'S08');
        if (s.state !== 'PENDING') return '시험 전제: ⑧이 차례가 아님';
        if (env.C.canAct(c, s, env.U('u_sadmin'))) return '자기가 기안한 계약의 ⑧을 영업지원이 처리할 수 있음';
        if (s.userId !== 'u_finance') return '⑧이 재무 담당자 차례가 아님: ' + s.userId;
        if (!env.C.canAct(c, s, env.U('u_finance'))) return '재무 담당자도 처리할 수 없음';
        return true;
      },
    },
    {
      name: '⑧ 반려 뒤 다음 차수는 ②부터 다시 결재(⑥부터 시작하지 않음)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const { C } = env;
        const c = env.contract('2609CL003');
        review(env, '2609CL003', 'u_sadmin').open('REJECT', 'S08').pick('PERIOD').comment('기간이 다름').confirm();
        if (c.status !== 'REJECTED') return '반려가 되지 않아 시험할 수 없음';
        const rec = C.resubmitRecord(c, {});
        C.saveDemoContract(rec);
        const r = env.contract('2609CL003');
        if ((r.round || 1) !== 2) return '다음 차수가 2차가 아님: ' + r.round;
        if (pend(r).join(',') !== 'S02') return '다음 차수가 ②부터 시작하지 않음: ' + pend(r).join(',');
        if (['S06', 'S07', 'S08'].some(s => st(r, s).state !== 'WAITING')) return '⑥~⑧이 대기가 아님: ' + ['S06', 'S07', 'S08'].map(s => s + ' ' + st(r, s).state).join(', ');
        return true;
      },
    },
    {
      name: '⑦에서 서명본 체결일을 비우거나 오늘보다 뒤로 고르면 등록되지 않음(2609CL002)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const c = env.contract('2609CL002'), n = c.history.length;
        const rv = review(env, '2609CL002', 'u_sales2');
        if (!rv.hasButton('REGISTER', 'S07')) return '기안자에게 체결본 등록 단추가 없음';
        rv.open('REGISTER', 'S07').checkAll().demoFile().date('');
        rv.confirm();
        if (c.history.length !== n) return '서명본 체결일 없이 등록됨';
        rv.date(env.C.addDays(env.D.TODAY, 1)).confirm();
        if (c.history.length !== n) return '오늘보다 뒤인 서명본 체결일로 등록됨';
        rv.date(env.C.addDays(env.D.TODAY, -1)).confirm();
        const e = c.history[c.history.length - 1];
        if (!e || e.action !== 'REGISTER' || e.signDate !== env.C.addDays(env.D.TODAY, -1)) return '맞는 날짜로도 등록되지 않거나 체결일이 남지 않음(시험 전제가 맞지 않음)';
        return true;
      },
    },
    {
      name: '신규 계약의 ⑨는 실제 개통일 없이 끝나지 않음(2609CL004)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'CEM' });
        const c = env.contract('2609CL004'), n = c.history.length;
        const rv = review(env, '2609CL004', 'u_cem');
        if (!rv.hasButton('APPROVE', 'S09')) return '고객지원에게 ⑨ 단추가 없음';
        rv.open('APPROVE', 'S09').checkAll();
        if (!rv.dom.ids.has('#act-date')) return '⑨ 창에 실제 개통일 칸이 없음';
        rv.date('').confirm();
        if (c.history.length !== n) return '실제 개통일 없이 ⑨가 끝남';
        rv.date(env.D.TODAY).confirm();
        const e = c.history[c.history.length - 1];
        if (!e || e.step !== 'S09' || e.openDate !== env.D.TODAY) return '개통일을 넣어도 ⑨가 남지 않음(시험 전제가 맞지 않음)';
        return true;
      },
    },
    {
      name: '체결일이 승인일보다 앞서거나(2609CL001) 개통일이 체결일보다 앞서도(2609CL004) 막지 않고 결재 문서에 날짜 순서 안내가 보임',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'FINANCE' });
        const c = env.contract('2609CL001');
        const iss = env.C.dateOrderIssues(c);
        if (!iss.some(x => x.code === 'SIGN_BEFORE_APPROVAL')) return '체결일이 승인일보다 앞서는 것을 알아채지 못함';
        const rv = review(env, '2609CL001', 'u_finance');
        if (String(rv.dom.q('#basic-extra').innerHTML).indexOf('날짜 순서를 확인해 주세요') < 0) return '결재 문서에 날짜 순서 안내가 없음';
        if (!rv.hasButton('APPROVE', 'S10')) return '날짜 순서 때문에 다음 단계가 막힘(막지 않아야 함)';
        // 2026-11-13 보강(점검 지적): 06 문서 줄의 뒤쪽 경우 "개통일이 체결일보다 앞섬"도 봄. 2609CL004의 서명본 체결일은 2026-10-13이고,
        //   ⑨를 그보다 앞선 개통일 2026-10-10으로 처리해도 남고(막지 않음), OPEN_BEFORE_SIGN과 결재 문서의 안내가 보이며 ⑩으로 넘어감
        const env2 = h.fresh({ role: 'CEM' });
        const c4 = env2.contract('2609CL004');
        if (env2.C.dateOrderIssues(c4).length) return '시험 전제: ⑨ 전의 2609CL004에 이미 날짜 순서 문제가 있음: ' + env2.C.dateOrderIssues(c4).map(x => x.code).join(',');
        const r9 = review(env2, '2609CL004', 'u_cem');
        if (!r9.hasButton('APPROVE', 'S09')) return '시험 전제: 고객지원에게 2609CL004 ⑨ 단추가 없음';
        const n = c4.history.length;
        r9.open('APPROVE', 'S09').checkAll().date('2026-10-10').comment('개통일이 체결일보다 앞선 시험').confirm();
        const e9 = c4.history[c4.history.length - 1];
        if (c4.history.length !== n + 1 || !e9 || e9.step !== 'S09' || e9.openDate !== '2026-10-10') return '개통일이 체결일보다 앞선다고 ⑨가 막힘(막지 않아야 함)';
        const iss4 = env2.C.dateOrderIssues(c4);
        if (!iss4.some(x => x.code === 'OPEN_BEFORE_SIGN')) return '개통일이 체결일보다 앞서는 것을 알아채지 못함: ' + iss4.map(x => x.code).join(',');
        const r10 = review(env2, '2609CL004', 'u_finance');
        const ex = String(r10.dom.q('#basic-extra').innerHTML).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        if (ex.indexOf('날짜 순서를 확인해 주세요') < 0 || ex.indexOf('2026-10-10') < 0) return '개통일이 앞선 계약의 결재 문서에 날짜 순서 안내가 없음';
        if (!r10.hasButton('APPROVE', 'S10')) return '개통일 순서 때문에 ⑩이 막힘(막지 않아야 함)';
        return true;
      },
    },
  ],
  serverOnly: [
    '화면을 건너뛰고 확인 항목 하나를 뺀 요청이나 코드표에 없는 반려 코드를 직접 보냄: 시안 recordAction은 항목과 코드를 다시 검사하지 않아 서버가 확인해야 함',
    '결재 기록의 "본 판"이 지금 차수의 마지막 체결본과 다른 요청: 시안은 본 판과 지문을 화면에서 그때 셈하고 기록에 저장하지 않아 서버가 견주고 저장해야 함(시안 결재 기록 표에 보이는 본 판과 지문은 위 되는 경우 첫 시험이 봄)',
    '⑦ sign_date와 ⑨ open_date의 필수와 날짜 범위를 요청마다 서버가 다시 검사함(시안은 확인 창에서만 막음)',
    '차례, 담당자, 기안자 아님을 서버가 다시 확인하고, 견준 결재한 판 번호를 결재 기록에 따로 남김(v0.11)',
  ],
};
