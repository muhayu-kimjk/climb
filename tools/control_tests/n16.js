// 2026-11-16 기획자 결정 반영 시험 (작업기록/2026-11-16/반영목록.md). 그 통제의 AC 파일 끝에서 require('./n16')('AC-xx')로 더함
//   AC 번호는 06 통제 목록 2장의 시험 번호. 이 파일 하나에 모아 두어 어느 결정을 시험하는지 한곳에서 봄
'use strict';
const lib = require('./lib');
const { page, review, fixClock } = lib;

const step = (c, code) => (c.approvals || []).find(a => a.step === code);
const pend = (c, code) => (c.approvals || []).find(a => a.step === code && a.state === 'PENDING');

const T = {
  // ---------- AC-32 ⑨ ⑩ (결정 4, 결정 5) ----------
  'AC-32': [
    {
      name: '(2026-11-16 결정 4) ⑨에서 "바로잡은 것 있음"을 고르면 메모가 없으면 저장되지 않고, 메모를 적으면 결재 기록에 바로잡음(corrected)과 의견이 남음(2602CL001-T01)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'CEM' });
        const t = env.contract('2602CL001-T01');
        const s9 = pend(t, 'S09');
        if (!s9) return '시험 전제: ⑨가 차례가 아님';
        const rv = review(env, t.id, s9.userId);
        if (!rv.hasButton('APPROVE', 'S09')) return '시험 전제: ⑨ 단추가 없음';
        rv.open('APPROVE', 'S09');
        if (rv.extra().indexOf('id="act-fix"') < 0) return '⑨ 창에 "바로잡은 것이 있습니다" 칸이 없음';
        rv.checkAll();
        if (rv.dom.ids.has('#act-date')) rv.date(env.D.TODAY);
        rv.dom.q('#act-fix').checked = true;
        const n = t.history.length;
        rv.comment('').confirm();
        if (t.history.length !== n) return '바로잡은 것 있음인데 메모 없이 저장됨';
        rv.comment('운영 종료일을 해지 합의서의 해지일로 바로잡음').confirm();
        const e = t.history[t.history.length - 1];
        if (t.history.length !== n + 1 || !e.corrected) return '메모를 적었는데 바로잡음 기록(corrected)이 남지 않음';
        if (String(e.comment).indexOf('바로잡은 것 있음') < 0) return '의견 문장에 "바로잡은 것 있음"이 없음: ' + e.comment;
        return true;
      },
    },
    {
      name: '(2026-11-16 결정 4, 밤 tests-02) ⑩ 재무 확인에도 "바로잡은 것 있음"이 있고, 고르면 메모 없이 저장되지 않으며 메모를 적으면 바로잡음이 남음(2602CL001-T01)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'FINANCE' });
        const t = env.contract('2602CL001-T01');
        const r9 = lib.doStep(env, t.id, 'S09', pend(t, 'S09').userId, { comment: '운영 종료' });
        if (!r9.ok) return '시험 전제: ' + r9.why;
        const s10 = pend(t, 'S10');
        if (!s10) return '시험 전제: ⑩이 차례가 아님';
        const rv = review(env, t.id, s10.userId).open('APPROVE', 'S10');
        if (rv.extra().indexOf('id="act-fix"') < 0) return '⑩ 창에 "바로잡은 것이 있습니다" 칸이 없음';
        rv.checkAll();
        rv.dom.q('#act-fix').checked = true;
        const n = t.history.length;
        rv.comment('').confirm();
        if (t.history.length !== n) return '바로잡은 것 있음인데 메모 없이 ⑩이 저장됨';
        rv.comment('환불 0원을 해지 합의서 3조대로 다시 확인해 바로잡음(시험)').confirm();
        const e = t.history[t.history.length - 1];
        if (t.history.length !== n + 1 || e.step !== 'S10' || !e.corrected) return '⑩ 바로잡음 기록(corrected)이 남지 않음';
        return true;
      },
    },
    {
      name: '(2026-11-16 결정 5, 밤 tests-02) 해지 ⑩의 확인 항목: 계약 고객에게 환불하면 "계약 고객임", 다른 곳이면 "계약 고객이 아닌 까닭을 확인함"(2602CL001-T01)',
      kind: 'deny',
      run(h) {
        const open = to => {
          const env = h.fresh({ role: 'FINANCE', hook: D => { const x = D.CONTRACTS.find(c => c.id === '2602CL001-T01'); x.refundAmount = 500000; x.refundTo = to || x.counterparty; } });
          const t = env.contract('2602CL001-T01');
          const r9 = lib.doStep(env, t.id, 'S09', pend(t, 'S09').userId, { comment: '운영 종료' });
          if (!r9.ok) throw new Error(r9.why);
          return review(env, t.id, pend(t, 'S10').userId).open('APPROVE', 'S10').extra();
        };
        const own = open('');
        if (own.indexOf('환불받는 곳이 계약 고객(가온테크)임') < 0) return '계약 고객에게 환불하는데 "계약 고객임" 확인 항목이 없음';
        const other = open('다른회사(시험)');
        if (other.indexOf('계약 고객(가온테크)이 아닌 까닭을 기안 메모와 서류로 확인함') < 0) return '다른 곳에 환불하는데 까닭 확인 항목이 없음';
        return true;
      },
    },
  ],

  // ---------- AC-33 해지 (결정 5) ----------
  'AC-33': [
    {
      name: '(2026-11-16 결정 5) 해지 기안: 환불이 있는데 받는 곳이 비면 막히고, 받는 곳이 계약 고객이 아니면 메모(까닭)가 있어야 기안됨(2511CL001). ⑩ 확인 항목은 AC-32',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const open = () => {
          const dom = page(env, 'terminate.js', '?origin=2511CL001', { user: env.U('u_sales1') });
          if (dom.error) throw new Error(dom.error.message);
          dom.q('#f-date').value = '2026-10-31';
          dom.q('#f-reason').value = '고객 예산 삭감으로 합의 해지(시험)';
          return dom;
        };
        let dom = open();
        if (dom.q('#f-refund-amount').value !== '0' || dom.q('#f-penalty').value !== '0') return '환불 금액과 위약금의 처음 값이 0이 아님';
        if (dom.q('#f-refund-to').value !== '한결대학교') return '환불받는 곳의 처음 값이 계약 고객이 아님: ' + dom.q('#f-refund-to').value;
        dom.q('#f-refund-amount').value = '1,200,000';
        dom.q('#f-refund-to').value = '';
        dom.submit();
        if (dom.q('#confirm-modal').hidden === false) return '환불이 있는데 받는 곳 없이 기안 확인 창이 열림';
        dom = open();
        dom.q('#f-refund-amount').value = '1,200,000';
        dom.q('#f-refund-to').value = '다른회사(시험)';
        dom.submit();
        if (dom.q('#confirm-modal').hidden === false) return '받는 곳이 계약 고객이 아닌데 메모 없이 기안 확인 창이 열림';
        dom = open();
        dom.q('#f-refund-amount').value = '1,200,000';
        dom.q('#f-penalty').value = '300,000';
        dom.q('#f-refund').value = '남은 기간 이용료를 해지 합의서 3조대로 일할 계산';
        const n = env.D.CONTRACTS.length;
        dom.submit();
        if (dom.q('#confirm-modal').hidden !== false) return '맞게 넣었는데 기안 확인 창이 열리지 않음';
        dom.confirmClick();
        const rec = env.D.CONTRACTS[env.D.CONTRACTS.length - 1];
        if (env.D.CONTRACTS.length !== n + 1 || rec.refundAmount !== 1200000 || rec.penaltyAmount !== 300000 || rec.refundTo !== '한결대학교') return '나눠 받은 세 칸이 남지 않음: ' + JSON.stringify([rec.refundAmount, rec.penaltyAmount, rec.refundTo]);
        if (env.C.refundToOther(rec)) return '계약 고객에게 환불하는데 계약 고객이 아니라고 셈함';
        if (env.C.refundText(rec).indexOf('환불 1,200,000원(받는 곳 한결대학교)') < 0) return '환불 글이 다름: ' + env.C.refundText(rec);
        return true;
      },
    },
  ],

  // ---------- AC-01 계약 등록 (W7-7 사후 등록, 밤 tests-03) ----------
  'AC-01': [
    {
      name: '(2026-11-16 W7-7) 사후 등록을 고르고 임시 결재 번호를 비우면 기안되지 않고, 번호를 적으면 계약에 사후 등록과 번호가 남음. 고르지 않으면 남지 않음',
      kind: 'deny',
      run(h) {
        const mk = vals => {
          const env = h.fresh({ role: 'SALES' });
          fixClock(env);
          return lib.nc(env, lib.ncState({ me: env.U('u_sales1'), lines: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '15,000,000' }], vals: Object.assign({ priceNote: '시험' }, vals) }));
        };
        const noNo = mk({ lateEntry: 'on', lateNo: '' }).errors();
        if (!noNo.some(m => m.indexOf('임시 결재 번호') > -1)) return '사후 등록인데 번호 없이 오류가 없음: ' + noNo.join(' / ');
        const withNo = mk({ lateEntry: 'on', lateNo: '임시-2027-0003' });
        if (withNo.errors().some(m => m.indexOf('임시 결재 번호') > -1)) return '번호를 적었는데 번호 오류가 남음';
        const rec = withNo.record();
        if (!rec.lateEntry || rec.lateEntry.tempNo !== '임시-2027-0003') return '계약 기록에 사후 등록과 번호가 남지 않음: ' + JSON.stringify(rec.lateEntry);
        if (mk({}).record().lateEntry) return '견줌: 사후 등록을 고르지 않았는데 표시가 남음';
        return true;
      },
    },
  ],

  // ---------- AC-52 고객사 티어 (결정 3, W7-4) ----------
  'AC-52': [
    {
      name: '(2026-11-16 결정 3) 관리자가 코드 관리에서 티어를 더하면 거래처에서 고를 수 있고, 재무 리더의 설정 변경 확인 대상(고객사 티어 목록 변경)이 됨. 바꾼 관리자는 확인하지 못함',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'ADMIN' });
        const { C, D, X } = env;
        fixClock(env);
        C.adminSave('CODE', '고객사 티어 T4', '코드 추가: 티어 4', '2027년 티어 품의(시험)', { k: 'CODE_ADD', c: { group: 'TIER', code: 'T4', label: '티어 4' } });
        if (!D.CUSTOMER_TIERS.some(t => t.code === 'T4' && t.label === '티어 4')) return '코드 관리에 더한 티어 T4가 고객사 티어 목록에 없음';
        const row = X.settingChanges({ areas: ['CUSTOMER'] }).find(x => x.tierCode && /T4/.test(x.target));
        if (!row) return '티어 목록 변경이 설정 변경 확인의 거래처 줄에 없음';
        if (!X.needsCheck(row)) return '티어 목록 변경이 재무 리더 확인 대상이 아님';
        if (X.resultKey(row) !== 'TIER') return '결과 이름이 "품의와 맞음, 다름"(TIER)이 아님';
        if (!X.canConfirm(env.U('u_seojin_ma'), row).ok) return '재무 리더가 티어 목록 변경을 확인하지 못함';
        if (X.canConfirm(env.U(row.by), row).ok) return '바꾼 사람이 자기 변경을 확인할 수 있음';
        return true;
      },
    },
    {
      name: '(2026-11-16 W7-4) 간접 계약의 표준 단가는 리셀러 티어가 아니라 그 줄 사용 업체(거래처 목록에 있을 때)의 티어, 없으면 기본 단가',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const { C, D } = env;
        const row = D.PRICE_BOOK.find(p => p.tierPrices && Object.keys(p.tierPrices).length);
        if (!row) return '시험 전제: 티어 단가가 있는 가격 줄이 없음';
        const tiers = Object.keys(row.tierPrices);
        const reseller = D.CUSTOMERS.find(cu => cu.id === 'C-0006'); // 가온테크(리셀러, 예시 티어 2)
        const endUser = D.CUSTOMERS.find(cu => !cu.mergedInto && cu.tier && cu.tier !== reseller.tier && tiers.indexOf(cu.tier) > -1);
        if (!endUser) return '시험 전제: 리셀러와 다른 티어 단가가 있는 거래처가 없음';
        const rec = { id: 'TEST-IND', kind: 'NEW', counterparty: reseller.name, requestedAt: D.TODAY + ' 09:00', startDate: '2026-11-01', endDate: '2027-10-31',
          form: { method: 'INDIRECT', bizNo: reseller.bizNo }, products: [{ feature: row.feature, qty: 1, amount: 1000000, org: endUser.name }] };
        const s1 = C.contractStd(rec)[0].s;
        if (!s1 || s1.tier !== endUser.tier) return '사용 업체(' + endUser.name + ')의 티어 ' + endUser.tier + '가 아니라 ' + (s1 && s1.tier) + '로 셈함';
        rec.products[0].org = '거래처 목록에 없는 기관(시험)';
        const s2 = C.contractStd(rec)[0].s;
        if (!s2 || s2.tier) return '사용 업체가 거래처 목록에 없는데 티어(' + (s2 && s2.tier) + ') 단가를 씀(리셀러 티어 ' + reseller.tier + ')';
        rec.form.method = 'DIRECT'; rec.counterparty = endUser.name; rec.form.bizNo = endUser.bizNo;
        const s3 = C.contractStd(rec)[0].s;
        if (!s3 || s3.tier !== endUser.tier) return '직접 계약은 계약 거래처의 티어로 셈해야 함';
        return true;
      },
    },
    {
      name: '(2026-11-16 W7-6, 밤 tests-04) 설정 변경 확인의 모집단 내려받기는 재무 리더(시연 최고관리자)에게만: 법무, 감사 열람, 컴플라이언스에게는 달 목록과 누름 처리가 없음',
      kind: 'deny',
      run(h) {
        for (const role of ['LEGAL', 'AUDIT', 'COMPLIANCE']) {
          const pg = lib.openPage(h, 'config-review.js', { role });
          if (String(pg.node('#pop-month').innerHTML) !== '') return role + '에게 모집단 내려받기 달 목록이 채워짐';
          if (((pg.node('#btn-pop')._ls || {}).click || []).length) return role + '에게 모집단 내려받기 누름 처리가 붙음';
        }
        for (const role of ['FIN_LEAD', 'SUPER']) {
          const pg = lib.openPage(h, 'config-review.js', { role });
          if (String(pg.node('#pop-month').innerHTML).indexOf('<option') < 0) return '견줌: ' + role + '에게 달 목록이 없음';
          if (!((pg.node('#btn-pop')._ls || {}).click || []).length) return '견줌: ' + role + '에게 누름 처리가 없음';
        }
        return true;
      },
    },
    {
      name: '(2026-11-17 다른 눈 sales-01) 거래처 이름을 바꾸거나 합쳐도 간접 계약 줄의 사용 업체를 계속 찾아 같은 티어로 셈',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'ADMIN', hook: D => {
          const c = D.CONTRACTS.find(x => x.id === '2602CL001');
          (c.products || (c.form && c.form.products) || [])[0].org = '별가람대학교';
        } });
        const { C, D } = env;
        fixClock(env);
        const c = env.contract('2602CL001');
        const line = () => (c.products || (c.form && c.form.products))[0];
        const before = C.tierCustomerFor(c, line());
        if (!before || before.id !== 'C-0025') return '시험 전제: 사용 업체 별가람대학교(C-0025)를 찾지 못함';
        C.adminSave('CUSTOMER', '별가람대학교(C-0025)', '상호: 별가람대학교 → 별가람대학교 산학협력단', '상호 변경(시험)',
          { k: 'CUSTOMER_EDIT', id: 'C-0025', set: { name: '별가람대학교 산학협력단', bizNo: '312-82-44080', use: true, tier: 'T1' }, tierFrom: 'T1' });
        const after = C.tierCustomerFor(c, line());
        if (!after || after.id !== 'C-0025') return '거래처 이름을 바꾼 뒤 사용 업체를 찾지 못함(줄 글: ' + line().org + ')';
        const merged = D.CUSTOMERS.find(x => x.id === 'C-0018');
        merged.mergedInto = 'C-0025';
        const m = C.customerByName(merged.name);
        if (!m || m.id !== 'C-0025') return '합쳐진 거래처 이름으로 남긴 거래처를 찾지 못함';
        return true;
      },
    },
  ],

  // ---------- AC-53 변경 종류 줄임 (W7-3) ----------
  'AC-53': [
    {
      name: '(2026-11-16 W7-3) 줄인 수량 몫보다 더 깎은 줄임은 변경 뒤 할인율을 다시 셈해 한도를 넘으면 ③ 영업 검토를 거침(기안 때 남긴 reduceOver)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const { C, D } = env;
        // 2609CL007(계약 완료, 제품 줄 있음)을 바탕으로 가장 큰 기능 줄의 1개를 줄이며 그 기능 금액의 대부분을 깎음
        const root = env.contract('2609CL007');
        const t = C.currentTerms('2609CL007');
        if (!t || !t.ready || !t.lines.length) return '시험 전제: 2609CL007의 지금 조건이 없음';
        const line = t.lines.filter(l => l.qty >= 2).sort((a, b) => b.amount - a.amount)[0];
        if (!line) return '시험 전제: 2개 이상인 기능 줄이 없음';
        const rec = { id: '2609CL007-A09', parentId: '2609CL007', kind: 'AMEND', amendKind: 'REDUCE', counterparty: root.counterparty, requesterId: root.requesterId,
          requestedAt: D.TODAY + ' 09:00', startDate: D.TODAY, endDate: t.end, form: root.form, checklist: { standard: 'YES', price: 'NA', cap: 'NA' },
          products: [{ feature: line.feature, qty: -1, amount: -Math.round(line.amount * 0.9) }], amount: -Math.round(line.amount * 0.9) };
        const ra = C.reduceAfter(rec);
        if (!ra) return '변경 뒤 할인율을 셈하지 못함';
        if (!ra.over) return '수량 1개를 줄이며 금액의 90%를 깎았는데 한도를 넘지 않는다고 셈함: ' + JSON.stringify(ra.feats);
        rec.reduceOver = ra;
        if (!C.reviewRoute(rec).S03[0]) return 'reduceOver가 있는데 ③을 거치지 않음';
        const ok = Object.assign({}, rec, { products: [{ feature: line.feature, qty: -1, amount: -Math.round(line.amount / line.qty / 2) }], amount: 0, reduceOver: null });
        const rb = C.reduceAfter(ok);
        if (rb && rb.over) return '수량 몫보다 적게 깎았는데 ③ 대상으로 셈함';
        if (C.reviewRoute(ok).S03[0]) return '보통 줄임인데 ③을 거침';
        return true;
      },
    },
    {
      name: '(2026-11-16 W7-3, 밤 tests-01) 계약 등록에서 수량 몫보다 크게 깎은 줄임을 기안하면 reduceOver가 남고 ③이 대기, 몫 안의 줄임은 남지 않고 ③ 생략(2609CL007)',
      kind: 'deny',
      run(h) {
        const mk = (amt, no) => {
          const env = h.fresh({ role: 'SALES' });
          fixClock(env);
          const st = lib.ncState({ me: env.U('u_taeyun_kim'), origin: '2609CL007', lines: [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: amt }],
            files: { draft: [{ name: '변경 계약서.docx', size: 1000 }], diff: [{ name: '조항 대비표.docx', size: 1000 }], annex: [], quote: [] },
            vals: { kind: 'AMEND', amendKind: 'REDUCE', customer: 'C:C-0029', counterparty: '한누리대학교', bizNo: '134-82-61500', opportunity: '2610CK901',
              startDate: '2026-11-01', endDate: '2027-09-30', standard: 'NO', standardNote: '변경 계약서(시험)', template: 'TPL-CK' } });
          const r = lib.nc(env, st).submit(no);
          return { env, r };
        };
        const big = mk('15,000,000', '2609CL007-A95');
        if (!big.r.rec) return '크게 깎은 줄임이 기안되지 않음: ' + big.r.errors.join(' / ');
        if (!big.r.rec.reduceOver || !big.r.rec.reduceOver.over) return '크게 깎은 줄임에 reduceOver가 남지 않음';
        const s3 = big.env.contract('2609CL007-A95').approvals.find(a => a.step === 'S03');
        if (!s3 || s3.state === 'SKIPPED') return '크게 깎은 줄임의 ③이 생략됨';
        const ok = mk('7,150,000', '2609CL007-A96');
        if (!ok.r.rec) return '견줌: 몫 안의 줄임이 막힘: ' + ok.r.errors.join(' / ');
        if (ok.r.rec.reduceOver) return '견줌: 몫 안의 줄임에 reduceOver가 남음';
        const s3b = ok.env.contract('2609CL007-A96').approvals.find(a => a.step === 'S03');
        if (s3b && s3b.state !== 'SKIPPED') return '견줌: 몫 안의 줄임이 ③을 거침';
        return true;
      },
    },
    {
      name: '(2026-11-16 W7-3, 밤 w7-01) 결재 중인 다른 줄임이 있으면 그 수량과 금액을 먼저 빼고 변경 뒤 할인율을 셈(나눠 기안해도 ③을 건너뛰지 못함)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES', hook: D => {
          const root = D.CONTRACTS.find(c => c.id === '2609CL007');
          D.CONTRACTS.push({ id: '2609CL007-A81', parentId: '2609CL007', kind: 'AMEND', amendKind: 'REDUCE', counterparty: root.counterparty, requesterId: root.requesterId,
            requestedAt: '2026-10-19 08:00', status: 'IN_REVIEW', round: 1, history: [], restricted: false, personalData: false, form: root.form,
            checklist: { standard: 'YES', price: 'NA', cap: 'NA' }, products: [{ feature: 'CK_CAMPUS_USER', qty: -3, amount: -3000000 }], amount: -3000000 });
        } });
        const { C } = env;
        const t = C.currentTerms('2609CL007');
        const base = t.lines.find(l => l.feature === 'CK_CAMPUS_USER');
        if (!base || base.qty < 7) return '시험 전제: 2609CL007의 추가 이용자가 7개 미만';
        const rec = { id: '2609CL007-A82', parentId: '2609CL007', kind: 'AMEND', amendKind: 'REDUCE', counterparty: env.contract('2609CL007').counterparty,
          requesterId: env.contract('2609CL007').requesterId, requestedAt: env.D.TODAY + ' 09:00', startDate: env.D.TODAY, endDate: t.end, form: env.contract('2609CL007').form,
          checklist: { standard: 'YES', price: 'NA', cap: 'NA' }, products: [{ feature: 'CK_CAMPUS_USER', qty: -3, amount: -Math.round(base.amount * 0.6) }], amount: -Math.round(base.amount * 0.6) };
        const ra = C.reduceAfter(rec);
        if (!ra || !ra.feats.length) return '시험 전제: 수량 몫보다 크게 깎았는데 셈 대상이 없음';
        const f = ra.feats[0];
        if (f.qtyAfter !== base.qty - 3 - 3) return '결재 중인 줄임 3개를 빼지 않음: 변경 뒤 ' + f.qtyAfter + '개(기대 ' + (base.qty - 6) + '개)';
        return true;
      },
    },
  ],

  // ---------- AC-34 그대로 연장 (W7-2) ----------
  'AC-34': [
    {
      name: '(2026-11-16 W7-2) 그대로 연장은 지금 계약 기간과 같은 달 수만: 종료일 칸이 시작일에서 정해지고, 다른 종료일을 넣으면 기안되지 않음(2511CL001)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const dom = page(env, 'renewal.js', '?origin=2511CL001', { user: env.U('u_sales1'), preset: [['input[name="choice"]:checked', { type: 'radio', name: 'choice', value: 'KEEP', checked: true }]] }); // AC-34의 KEEP과 같음
        if (dom.error) return '연장 검토 화면을 열지 못함: ' + dom.error.message;
        if (dom.q('#form').hidden) return '시험 전제: 연장 검토 양식이 닫힘';
        if (!dom.q('#f-end').readOnly) return '종료일 칸이 읽기만이 아님';
        const start = dom.q('#f-start').value, end = dom.q('#f-end').value;
        if (!start || !end) return '시작일이나 종료일이 채워지지 않음';
        const b = env.C.bundleOf('2511CL001'), cur = b.current;
        const months = env.C.periodMonths(cur.startDate || (cur.form || {}).startDate, cur.endDate || (cur.form || {}).endDate);
        if (end !== env.C.addDays(env.C.monthsLater(start, months), -1)) return '정해진 종료일이 지금 계약 기간(' + months + '개월)과 다름: ' + start + '~' + end;
        dom.q('#f-end').value = env.C.addDays(env.C.monthsLater(start, months + 24), -1);
        dom.q('#f-reason').value = '3년으로 연장(시험)';
        dom.submit();
        if (dom.q('#confirm-modal').hidden === false) return '다른 달 수의 종료일로 기안 확인 창이 열림';
        return true;
      },
    },
  ],

  // ---------- AC-45 분기 권한 검토의 조치할 계정 (W3-10) ----------
  'AC-45': [
    {
      name: '(2026-11-16 W3-10) 유닛 리더가 휴직으로 표시한 계정은 처리 전 표시로 남고(사용자 권한 관리 배지와 거르기), 사용 중지하면 사라짐(안채원)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'ADMIN' });
        const { C, D } = env;
        const m = C.pendingMarks()['u_chaewon_ahn'];
        if (!m || m.mark !== 'LEAVE' || m.unit !== '비즈니스2유닛') return '시험 전제: 안채원의 휴직 표시(처리 전)가 없음';
        const a = D.ACCOUNTS.find(x => x.id === 'u_chaewon_ahn');
        a.status = 'SUSPENDED';
        if (C.pendingMarks()['u_chaewon_ahn']) return '사용 중지했는데 처리 전 표시가 남음';
        return true;
      },
    },
    {
      name: '(2026-11-16 W3-10, 밤 tests-06, w3-01) 사용자 권한 관리의 "유닛 리더 표시(처리 전)" 거르기에 안채원 한 줄. 휴직으로 사용 중지한 뒤 다시 사용으로 바꿔도 처리 전으로 돌아오지 않고, 다음 확인에서 표시가 없으면 사라짐',
      kind: 'deny',
      run(h) {
        const pg = lib.openPage(h, 'admin-users.js', { role: 'ADMIN', values: { 'f-status': 'MARK' } });
        const html = String(pg.node('#user-rows').innerHTML);
        if ((html.match(/<tr/g) || []).length !== 1 || html.indexOf('안채원') < 0 || html.indexOf('유닛 리더 표시: 휴직(처리 전)') < 0) return '처리 전 거르기에 안채원 한 줄과 배지가 아님';
        const env = h.fresh({ role: 'ADMIN' });
        const { C, D } = env;
        fixClock(env);
        const a = D.ACCOUNTS.find(x => x.id === 'u_chaewon_ahn');
        C.adminSave('USER', '안채원 (' + a.email + ')', '상태: 사용 중 → 사용 중지', '육아휴직(시험)', { k: 'ACCOUNT_EDIT', email: a.email, set: { status: 'SUSPENDED' } });
        C.adminSave('USER', '안채원 (' + a.email + ')', '상태: 사용 중지 → 사용 중', '복직(시험)', { k: 'ACCOUNT_EDIT', email: a.email, set: { status: 'ACTIVE' } });
        if (a.status !== 'ACTIVE') return '시험 전제: 다시 사용으로 바뀌지 않음';
        if (C.pendingMarks()['u_chaewon_ahn']) return '휴직 처리(사용 중지) 뒤 복직했는데 다시 처리 전으로 보임';
        const env2 = h.fresh({ role: 'ADMIN', hook: D => D.ADMIN_LOG.push({ at: '2027-01-05 10:00', by: 'u_eunseong_ko', area: 'AUDIT', target: '2026년 4분기 유닛 계정 확인(비즈니스2유닛)', change: '확인함', reason: '시험',
          op: { k: 'UNIT_LIST_ACK', r: { quarter: '2026-Q4', unit: '비즈니스2유닛', n: 7, sentAt: '2027-01-04 10:00', seen: '', note: '', onBehalfOf: null, delegationId: null, marks: [] } } }) });
        if (env2.C.pendingMarks()['u_chaewon_ahn']) return '다음 분기 확인에 표시가 없는데 앞 표시가 남음';
        return true;
      },
    },
  ],

  // ---------- AC-39 열람 제한 계약 상세와 예전 계약 기록 (W3-1, 확인 2, W7-1) ----------
  'AC-39': [
    {
      name: '(2026-11-18 셋째 점검 mail-01) 사용 중인 정보보호 담당자가 없으면 이상 행위 메일은 정보보호 리더에게 감(받는 사람이 비지 않음)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SUPER' });
        const { C, D } = env;
        const before = C.secAlertMailTo({ userId: 'u_sales2' });
        if (before.indexOf('u_privacy') < 0) return '시험 전제: 담당자가 있을 때 담당자에게 가지 않음: ' + before.join(',');
        D.ACCOUNTS.filter(a => (a.roles || []).indexOf('PRIVACY') > -1).forEach(a => { a.status = 'INACTIVE'; });
        const after = C.secAlertMailTo({ userId: 'u_sales2' });
        if (!after.length) return '담당자가 없을 때 받는 사람이 비어 메일이 아무에게도 가지 않음';
        if (after.indexOf('u_seungho_yeo') < 0) return '담당자가 없을 때 정보보호 리더에게 가지 않음: ' + after.join(',');
        return true;
      },
    },
    {
      name: '(2026-11-18 기획자 결정 N-4) 리더 기록인지는 올린 때의 역할(legacy.byLead)로 정해, 올린 뒤 역할이 바뀌어도 리더 기록 여부와 매월 확인 범위가 그대로임',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'COMPLIANCE', hook: D => {
          const base = D.CONTRACTS.find(c => c.id === 'LG-0001');
          // 올릴 때 리더였던 사람의 기록(byLead true)과, 올릴 때 리더가 아니었던 기록(byLead false, 올린 사람은 지금 리더)
          D.CONTRACTS.push(Object.assign(JSON.parse(JSON.stringify(base)), { id: 'LG-0010',
            legacy: Object.assign({}, base.legacy, { by: 'u_jihoon_eom', dept: '세일즈어드민유닛', at: '2026-10-15 10:00', byLead: true }) }));
          D.CONTRACTS.push(Object.assign(JSON.parse(JSON.stringify(base)), { id: 'LG-0011',
            legacy: Object.assign({}, base.legacy, { by: 'u_jihoon_eom', dept: '세일즈어드민유닛', at: '2026-10-16 10:00', byLead: false }) }));
        } });
        const { C, D } = env;
        if (!C.legacyLeadAt('u_jihoon_eom')) return '시험 전제: u_jihoon_eom이 지금 영업지원 리더가 아님';
        const lg10 = env.contract('LG-0010'), lg11 = env.contract('LG-0011');
        if (!C.legacyLeadOwn(lg10)) return '올릴 때 리더였던 기록을 리더 기록으로 셈하지 않음';
        if (C.legacyLeadOwn(lg11)) return '올릴 때 리더가 아니었던 기록을 지금 역할(리더)로 셈함';
        // 올린 사람이 리더 역할을 잃음: 올린 때 값을 그대로 씀
        const acc = D.ACCOUNTS.find(u => u.id === 'u_jihoon_eom');
        acc.roles = (acc.roles || []).filter(r => r !== 'SA_LEAD').concat(['SALES_ADMIN']);
        if (C.legacyLeadAt('u_jihoon_eom')) return '시험 전제: 역할을 뺐는데도 리더로 봄';
        if (!C.legacyLeadOwn(lg10)) return '올린 사람이 리더 역할을 잃자 리더 기록이 아니게 됨(마친 확인이 흔들림)';
        const s = C.legacyCheckState('2026-10');
        if (s.recs.some(x => x.id === 'LG-0010')) return '리더 기록이 리더의 매월 확인 범위로 돌아감';
        if (!s.recs.some(x => x.id === 'LG-0011')) return '리더가 아니던 때 올린 기록이 매월 확인 범위에서 빠짐';
        // 칸이 없는 예전 시연 기록은 지금 역할로(견줌)
        const old = Object.assign({}, lg10, { legacy: Object.assign({}, lg10.legacy) });
        delete old.legacy.byLead;
        if (C.legacyLeadOwn(old)) return '칸이 없는 예전 기록이 지금 역할(리더 아님)과 다르게 셈해짐';
        // 올리는 화면은 올릴 때 값을 남김
        const src = require('fs').readFileSync(require('path').join(__dirname, '../../prototype/assets/js/legacy-contract.js'), 'utf8');
        if (src.indexOf('byLead: C.legacyLeadAt(me.id)') < 0) return '예전 기록을 올릴 때 byLead를 남기지 않음';
        return true;
      },
    },
    {
      name: '(2026-11-16 확인 2) 영업지원 리더가 직접 올린 예전 기록은 리더의 매월 확인 범위에서 빠지고 컴플라이언스의 확인할 일이 되며, 컴플라이언스는 열람 제한이어도 봄',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'COMPLIANCE', hook: D => {
          const base = D.CONTRACTS.find(c => c.id === 'LG-0001');
          D.CONTRACTS.push(Object.assign(JSON.parse(JSON.stringify(base)), { id: 'LG-0009', restricted: true,
            legacy: Object.assign({}, base.legacy, { by: 'u_jihoon_eom', dept: '세일즈어드민유닛', at: '2026-10-15 10:00' }) }));
        } });
        const { C } = env;
        const c = env.contract('LG-0009');
        if (!C.legacyLeadOwn(c)) return '리더가 올린 기록으로 셈하지 않음';
        const s = C.legacyCheckState('2026-10');
        if (s.recs.some(x => x.id === 'LG-0009')) return '리더가 올린 기록이 리더의 매월 확인 범위에 들어 있음';
        if (!s.leadOwn.some(x => x.id === 'LG-0009')) return '그달 리더 기록 목록에 없음';
        if (!C.legacyOwnTodo().some(x => x.id === 'LG-0009')) return '컴플라이언스의 확인할 일에 없음';
        if (!C.complianceTodo().some(x => /영업지원 리더가 올린 예전 계약 기록 확인/.test(x.what))) return '컴플라이언스 개요의 점검할 일에 줄이 없음';
        if (!C.canView(c, env.U('u_seoyul_ban'))) return '컴플라이언스가 열람 제한인 리더 기록을 보지 못함';
        // 견줌(밤 tests-05): 영업지원 담당자가 올린 LG-0001은 리더 기록이 아니고 리더의 매월 확인 범위에 그대로 있음
        const lg1 = env.contract('LG-0001');
        if (C.legacyLeadOwn(lg1)) return '담당자가 올린 LG-0001을 리더 기록으로 셈함';
        if (!C.legacyCheckState(String(lg1.legacy.at).slice(0, 7)).recs.some(x => x.id === 'LG-0001')) return 'LG-0001이 리더의 매월 확인 범위에서 빠짐';
        if (C.legacyOwnTodo().some(x => x.id === 'LG-0001')) return 'LG-0001이 컴플라이언스 확인할 일에 들어감';
        // 확인 남기기 단추는 컴플라이언스에게만(리더 본인에게는 없음)
        const btn = who => String(page(env, 'legacy-contract.js', '?id=LG-0009', { user: env.U(who) }).q('#v-actions').innerHTML).indexOf('btn-own-check') > -1;
        if (btn('u_jihoon_eom')) return '리더 본인에게 자기 기록의 확인 남기기 단추가 보임';
        if (!btn('u_seoyul_ban')) return '컴플라이언스에게 확인 남기기 단추가 없음';
        C.adminSave('AUDIT', '예전 계약 기록 확인(영업지원 리더가 올림): LG-0009', '맞음', '맞음', { k: 'LEGACY_OWN_CHECK', id: 'LG-0009', result: 'MATCH', memo: '' });
        if (C.legacyOwnTodo().some(x => x.id === 'LG-0009')) return '확인을 남겼는데 할 일에 남음';
        return true;
      },
    },
    {
      name: '(2026-11-16 W7-1) 예전 문서 결재일이 전환 날(시연 2026-09-01)과 같거나 뒤이면 예전 계약 기록을 올리지 못함(검사 문장)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES_ADMIN' });
        if (env.D.COMPANY.conversionDate !== '2026-09-01') return '시험 전제: 시연 전환 날이 2026-09-01이 아님';
        // (밤 tests-05) 화면으로: 결재일 2026-09-01이면 기안 오류에 전환 날이 있고 저장되지 않음, 2026-08-31이면 전환 날 오류가 없음
        const tryDate = d => {
          const dom = page(env, 'legacy-contract.js', '', { user: env.U('u_sadmin') });
          if (dom.error) throw new Error(dom.error.message);
          dom.q('#f-doc-date').value = d;
          const n = env.D.CONTRACTS.length;
          dom.submit();
          return { text: dom.errors().replace(/<[^>]+>/g, ' '), saved: env.D.CONTRACTS.length !== n };
        };
        const on = tryDate('2026-09-01');
        if (on.saved || on.text.indexOf('전환 날') < 0) return '전환 날과 같은 결재일인데 막는 오류가 없음: ' + on.text.slice(0, 120);
        const before = tryDate('2026-08-31');
        if (before.text.indexOf('전환 날(') > -1) return '견줌: 전환 날 전 결재일인데 전환 날 오류가 보임';
        return true;
      },
    },
    {
      name: '(2026-11-16 W3-1) 볼 수 없는 열람 제한 계약도 계약 유닛의 영업 리더는 계약 상세에서 내용 없이 영업대표 바꾸기 단추만 봄',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'HEAD', hook: D => { D.CONTRACTS.find(c => c.id === '2511CL001').restricted = true; } });
        const { C } = env;
        const head = env.U('u_head');
        const b = C.bundleOf('2511CL001');
        if (C.canView(b.root, head)) return '시험 전제: 리더가 이 열람 제한 계약을 볼 수 있음';
        if (!C.canChangeRep(b, head)) return '시험 전제: 리더가 영업대표를 바꿀 수 없음';
        const dom = page(env, 'contract.js', '?id=2511CL001', { user: head });
        if (dom.error) return '계약 상세를 열지 못함: ' + dom.error.message;
        const html = String(dom.q('#notice').innerHTML);
        if (html.indexOf('data-rep="change"') < 0) return '영업대표 바꾸기 단추가 없음';
        if (html.indexOf(b.root.counterparty) > -1) return '가린 계약 상세에 고객사 이름이 보임';
        return true;
      },
    },
    {
      name: '(2026-11-17 다른 눈 leak-records-02) 열람 제한인 리더 기록의 컴플라이언스 확인 메모는 그 기록을 볼 수 없는 사람(정보보호)에게 가려 보이고 찾아지지 않음',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'PRIVACY', hook: D => {
          const base = D.CONTRACTS.find(c => c.id === 'LG-0001');
          D.CONTRACTS.push(Object.assign(JSON.parse(JSON.stringify(base)), { id: 'LG-0009', restricted: true,
            legacy: Object.assign({}, base.legacy, { by: 'u_jihoon_eom', dept: '세일즈어드민유닛', at: '2026-10-15 10:00' }) }));
          D.ADMIN_LOG.push({ at: '2026-10-16 10:00', by: 'u_seoyul_ban', area: 'AUDIT', target: '예전 계약 기록 확인(영업지원 리더가 올림): LG-0009', change: '맞지 않는 것이 있음',
            reason: '계약 금액 10,800,000원이 체결본과 다름(시험)', op: { k: 'LEGACY_OWN_CHECK', id: 'LG-0009', result: 'DIFF', memo: '계약 금액 10,800,000원이 체결본과 다름(시험)' } });
        } });
        const { C, D } = env;
        const viewer = env.U('u_privacy');
        if (C.canView(env.contract('LG-0009'), viewer)) return '시험 전제: 정보보호가 열람 제한 리더 기록을 봄';
        const row = C.maskAdminRows(D.ADMIN_LOG, viewer).find(e => e.op && e.op.k === 'LEGACY_OWN_CHECK' && e.op.id === 'LG-0009');
        if (!row) return '시험 전제: 확인 줄이 없음';
        if (String(row.reason).indexOf('10,800,000') > -1) return '볼 수 없는 사람에게 확인 메모의 금액이 보임';
        const comp = C.maskAdminRows(D.ADMIN_LOG, env.U('u_seoyul_ban')).find(e => e.op && e.op.k === 'LEGACY_OWN_CHECK' && e.op.id === 'LG-0009');
        if (String(comp.reason).indexOf('10,800,000') < 0) return '견줌: 볼 수 있는 컴플라이언스에게도 메모가 가려짐';
        return true;
      },
    },
  ],

  // ---------- AC-18 ③ 결재자 지정 (묶음 확인 5, W3-7) ----------
  'AC-18': [
    {
      name: '(2026-11-16 묶음 확인 5) 영업 임원이 이해관계로 빠지면 컴플라이언스가 고를 수 있는 다른 임원(둘째 영업 임원)이 있음(2610CL009)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'EXEC' });
        const { C } = env;
        const c = env.contract('2610CL009');
        const s = pend(c, 'S03C');
        if (!s || s.userId !== 'u_exec') return '시험 전제: ③ 영업 임원 승인이 문태호 차례가 아님';
        const ix = C.declareInterest(c, s, '이해관계 있음(시험)', env.U('u_exec'));
        if (!ix) return '시험 전제: 이해관계 있음을 남기지 못함';
        const cands = C.assignCandidates(env.contract('2610CL009'), 'S03C');
        if (cands.indexOf('u_jinwoo_eo') < 0) return '둘째 영업 임원(어진우)이 결재자 후보에 없음: ' + cands.join(',');
        if (cands.indexOf('u_exec') > -1) return '이해관계 있음을 남긴 영업 임원이 후보에 있음';
        return true;
      },
    },
  ],
};

module.exports = function (ac) { return T[ac] || []; };
module.exports.ACS = Object.keys(T);
