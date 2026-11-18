// AC-09 기안자는 로그인한 사람 (06 통제 목록 2장, CTL-19) (2026-11-13 주말 점검 W2)
//   기대 동작: 계약 등록은 영업만 쓰고, 기안자는 로그인한 사람으로 저절로 채워져 바꿀 수 없음. 이 값으로 ③ 담당(기안자 유닛의 영업 리더,
//     리더 본인 계약은 영업 임원)과 기안자가 맡지 못할 단계를 정함. 서버는 요청에 든 기안자 값을 쓰지 않고 세션의 사람으로 정함
//   시안 코드: new-contract.js의 formRecord, buildRoute, drafterId, 화면 맨 위 역할 막기(repOnly), 이어서 작성할 기록 찾기(source).
//     common.js의 stepUser(C.stepUserNow, C.stepUserAt)
//   계약 등록 화면은 lib.js의 꺼내 쓰기 틀(nc)로 돌리고, 역할 막기와 기록 찾기는 new-contract.js의 그 문장을 그대로 꺼내 돌림
'use strict';
const fs = require('fs');
const path = require('path');
const lib = require('./lib');
const nc = lib.nc, ncState = lib.ncState;

// 한도 0%인 표절검사(오늘 표준 단가 12,000,000원)를 10% 할인: 3번 아니요라 ③ 영업 검토를 거침
const NOTES = { priceNote: '다년 약정 할인', capNote: '경쟁사 가격 대응' };
const DISCOUNT = [{ feature: 'CK_CAMPUS_PLAG', qty: 1, amount: '10,800,000' }];
function s3Of(c) { return (c.approvals || []).filter(function (a) { return a.step === 'S03'; })[0] || null; }
function route3(route) {
  let out = null;
  route.forEach(function (g) { g.items.forEach(function (i) { if (i.no === '③' && i.name === '영업 검토') out = i; }); });
  return out;
}
// 기안해서 저장된 기록과 ③ 담당을 봄
function draft(h, meId, meRole, vals) {
  const env = h.fresh({ role: 'SALES' });
  const p = nc(env, ncState({ me: env.U(meId, meRole), vals: Object.assign({}, NOTES, vals || {}), lines: DISCOUNT }));
  const preview = route3(p.route());
  const r = p.submit('2610CL909');
  return { env: env, errors: r.errors, c: env.contract('2610CL909'), preview: preview };
}
// 화면 맨 위의 역할 막기(new-contract.js 그대로): 'blocked'(계약 등록을 막음), 'repOnly'(지금 영업대표인 계약의 후속 기안만), 'open'
let GATE_BODY = null;
function gateOf(env, user) {
  if (!GATE_BODY) GATE_BODY = lib.stmtSrc('new-contract.js', '  const repOnly = ', '&& !repOnly) {') + " return 'blocked'; }\nreturn repOnly ? 'repOnly' : 'open';";
  return lib.compile(env, ['D', 'C', 'me'], GATE_BODY, 'new-contract.js(역할 막기)')(env.D, env.C, user);
}
// 주소 ?id=로 이어서 작성하거나 다시 기안할 기록 찾기(new-contract.js 그대로). 못 찾으면 undefined(빈 새 계약 등록과 안내)
let SRC_BODY = null;
function sourceOf(env, user, srcId) {
  if (!SRC_BODY) SRC_BODY = lib.stmtSrc('new-contract.js', '  const source = srcId ?', '}) : null;') + '\nreturn source;';
  return lib.compile(env, ['D', 'C', 'me', 'srcId'], SRC_BODY, 'new-contract.js(기록 찾기)')(env.D, env.C, user, srcId);
}

module.exports = {
  ac: 'AC-09',
  title: '기안자는 로그인한 사람',
  tests: [
    {
      name: '비즈니스1유닛 영업(이도윤)이 기안하면 기안자는 그 사람이고 ③은 비즈니스1유닛 리더(최민준)다',
      kind: 'ok',
      run(h) {
        const a = draft(h, 'u_sales1', 'SALES');
        if (a.errors.length) return '기안이 막힘: ' + a.errors.join(' / ');
        if (a.c.requesterId !== 'u_sales1') return '기안자가 ' + a.c.requesterId;
        const s3 = s3Of(a.c);
        if (!s3 || s3.userId !== 'u_head' || a.env.D.USERS.u_head.name !== '최민준') return '결재란의 ③ 담당이 ' + (s3 && s3.userId);
        if (a.env.C.stepUserAt('S03', a.c, a.c.requestedAt) !== 'u_head') return '③ 담당 셈이 ' + a.env.C.stepUserAt('S03', a.c, a.c.requestedAt);
        return (!!a.preview && a.preview.state === 'go' && a.preview.who.indexOf('최민준') > -1) || '결재선 미리 보기의 ③이 ' + JSON.stringify(a.preview);
      },
    },
    {
      name: '비즈니스2유닛 영업(정하은)이 기안하면 ③은 비즈니스2유닛 리더(고은성)다',
      kind: 'ok',
      run(h) {
        const a = draft(h, 'u_sales2', 'SALES');
        if (a.errors.length) return '기안이 막힘: ' + a.errors.join(' / ');
        if (a.c.requesterId !== 'u_sales2') return '기안자가 ' + a.c.requesterId;
        const s3 = s3Of(a.c), lead = s3 && a.env.U(s3.userId);
        return (!!lead && lead.name === '고은성' && lead.role === 'HEAD') || '결재란의 ③ 담당이 ' + (lead && lead.name);
      },
    },
    {
      name: '법무와 관찰자는 계약 등록 화면이 막힌다',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const got = { LEGAL: gateOf(env, env.U('u_legal')), OBSERVER: gateOf(env, env.U('u_daon_yong')), SALES: gateOf(env, env.U('u_sales1')) };
        const want = { LEGAL: 'blocked', OBSERVER: 'blocked', SALES: 'open' };
        return JSON.stringify(got) === JSON.stringify(want) || '역할별 화면이 ' + JSON.stringify(got) + '(바라는 것 ' + JSON.stringify(want) + ')';
      },
    },
    {
      // 화면의 영업대표 칸은 읽기만(readonly)이고 양식 값(name)이 없음. 다른 유닛 사람 값을 칸에 넣어 보내도 기안자는 로그인한 사람
      name: '기안자 값을 다른 유닛 사람(정하은)으로 넣어 보내도 로그인한 사람(이도윤)으로 저장되고 ③도 그 사람 유닛 리더다',
      kind: 'deny',
      run(h) {
        const html = fs.readFileSync(path.join(__dirname, '..', '..', 'prototype', 'new-contract.html'), 'utf8');
        const m = /<input[^>]*id="f-owner"[^>]*>/.exec(html);
        if (!m) return '영업대표 칸(#f-owner)을 찾지 못함';
        if (!/\sreadonly(\s|>|=)/.test(m[0])) return '영업대표 칸이 읽기만이 아님: ' + m[0];
        if (/\sname=/.test(m[0])) return '영업대표 칸이 양식 값(name)으로 보내짐: ' + m[0];
        const a = draft(h, 'u_sales1', 'SALES', { requesterId: 'u_sales2', owner: '비즈니스2유닛 정하은', salesRep: 'u_sales2', drafter: 'u_sales2' });
        if (a.errors.length) return '기안이 막힘: ' + a.errors.join(' / ');
        if (a.c.requesterId !== 'u_sales1') return '기안자가 ' + a.c.requesterId + '(로그인한 사람이 아님)';
        const s3 = s3Of(a.c);
        return (!!s3 && s3.userId === 'u_head') || '결재란의 ③ 담당이 ' + (s3 && s3.userId);
      },
    },
    {
      // (2026-11-13 시험 다지기) 영업 리더(역할 HEAD만)는 화면에서 신규를 고를 수 없음(repOnly, 기획자 결정 2026-11-03 C-44). 예전 시험은
      //   신규를 nc 틀로 기안해 화면에서 일어날 수 없는 길을 돌렸음. 화면에서 실제로 되는 길로 바꿈: 최민준이 지금 영업대표 일을 맡는
      //   2609CL010(라온디자인. 영업대표 기태민이 퇴사해 담당 지정 전까지 리더가 맡음)의 추가 변경을 GPT Killer 10% 할인(한도 0%, 3번 아니요)으로 기안
      name: '영업 리더 본인(최민준)이 지금 영업대표 일을 맡는 2609CL010의 변경을 기안하면 ③은 영업 임원(문태호)이다',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const D = env.D, C = env.C, head = env.U('u_head');
        if (head.role !== 'HEAD' || gateOf(env, head) !== 'repOnly') return '시험 전제: 최민준이 계약 등록에서 변경과 연장만 하는 사람(repOnly)이 아님(' + gateOf(env, head) + ')';
        const o = env.contract('2609CL010');
        if (!o || o.status !== 'ACTIVE' || !C.isSalesRep(o, head)) return '시험 전제: 2609CL010이 최민준이 영업대표 일을 맡는 계약 완료 계약이 아님';
        const cu = D.CUSTOMERS.filter(function (x) { return x.name === o.counterparty; })[0];
        if (!cu) return '시험 전제: 2609CL010의 거래처(' + o.counterparty + ')가 거래처 목록에 없음';
        const p = nc(env, ncState({ me: head, origin: '2609CL010',
          vals: Object.assign({}, NOTES, { kind: 'AMEND', amendKind: 'ADD', customer: 'C:' + cu.id, counterparty: cu.name, bizNo: cu.bizNo, opportunity: '2610CK902',
            startDate: '2026-11-01', endDate: o.endDate }),
          lines: [{ feature: 'CK_CAMPUS_GPTK', qty: 1, amount: '1,980,000' }] }));
        if (p.drafterId() !== 'u_head') return '화면이 정한 기안자가 ' + p.drafterId() + '(최민준이 아님)';
        const pc = p.priceCheck();
        if (pc.q3 !== 'NO') return '시험 전제: 3번이 ' + pc.q3 + '(할인이 한도를 넘지 않아 ③을 거치지 않음)';
        const preview = route3(p.route());
        const r = p.submit('2609CL010-A01');
        if (r.errors.length) return '기안이 막힘: ' + r.errors.join(' / ');
        const c = env.contract('2609CL010-A01');
        if (!c || c.requesterId !== 'u_head' || c.kind !== 'AMEND' || c.parentId !== '2609CL010') return '저장된 기록이 ' + (c && (c.requesterId + ' ' + c.kind + ' ' + c.parentId));
        const s3 = s3Of(c);
        if (!s3 || s3.state === 'SKIPPED') return '③을 거치지 않음: ' + (s3 && s3.state);
        if (s3.userId === 'u_head') return '리더 본인이 ③을 맡음';
        if (s3.userId !== 'u_exec' || D.USERS.u_exec.role !== 'EXEC') return '결재란의 ③ 담당이 ' + s3.userId + '(영업 임원이 아님)';
        if (C.stepUserAt('S03', c, c.requestedAt) !== 'u_exec') return '③ 담당 셈이 ' + C.stepUserAt('S03', c, c.requestedAt);
        return (!!preview && preview.state === 'go' && preview.who.indexOf('영업 임원') === 0 && preview.who.indexOf('문태호') > -1) || '결재선 미리 보기의 ③이 ' + JSON.stringify(preview);
      },
    },
    {
      // D-0001은 이도윤의 임시 저장. 정하은이 주소(new-contract.html?id=D-0001)로 열면 찾지 못한 것으로 보고 빈 새 계약 등록이 열림
      name: '남의 임시 저장(D-0001)을 주소로 열어 이어서 작성할 수 없다',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SALES' });
        const d = env.D.CONTRACTS.filter(function (c) { return c.draftKey === 'D-0001'; })[0];
        if (!d || d.status !== 'DRAFT' || d.requesterId !== 'u_sales1') return '시험 전제: D-0001이 이도윤의 임시 저장이 아님';
        if (sourceOf(env, env.U('u_sales1'), 'D-0001') !== d) return '쓴 사람(이도윤)도 이어서 작성하지 못함';
        const other = sourceOf(env, env.U('u_sales2'), 'D-0001');
        return !other || '정하은이 남의 임시 저장을 열었음: ' + other.draftKey; // 못 찾으면 find의 undefined(화면은 "기록을 찾을 수 없습니다")
      },
    },
  ],
  serverOnly: [
    '법무나 관찰자가 기안 요청을 직접 보냄: 시안은 계약 등록 화면만 막음. 서버가 역할(영업, 지금 영업대표인 계약의 후속 기안)을 확인해 거절',
    '요청의 기안자 값을 다른 유닛 사람으로 바꿔 보냄: 시안 formRecord는 브라우저가 아는 시연 사용자(me.id)로 정함. 서버는 요청 값을 믿지 않고 세션의 사람으로 정하고 ③ 담당도 그 사람으로 셈',
    '남의 임시 저장을 주소로 열어 저장하거나 기안하는 요청을 직접 보냄: 서버가 임시 저장을 쓴 사람인지 확인해 거절',
    '기안자와 ③ 담당(기안자 유닛의 영업 리더, 리더 본인 계약은 영업 임원)을 서버가 정함',
  ],
};
