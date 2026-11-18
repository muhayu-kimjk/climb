// 2026-11-18 셋째 점검 반영 시험: 감사 증적(audit-trail-01~03). AC-41.js 끝에서 require('./n18a')('AC-41')로 더함
//   audit-trail-01: 고객사 티어 목록 변경(코드 관리 TIER)이 통제 증빙 내보내기의 "가격과 권한 변경"에 들어감(stats.js buildEvidence, 결정할것 결정 3)
//   audit-trail-02: 영업대표 바꾸기가 접속 기록의 "수정"(EDIT)과 통제 증빙의 "결재 기록"에 들어감(control-checks.js accessLogs, stats.js, CTL-137)
//   audit-trail-03: 사후 등록과 임시 결재 번호가 계약 상세(머리, 기본 정보, 결재 기록 묶음 목록)와 통제 증빙 "계약과 차수"에 보임(contract.js, stats.js, W7-7 (가))
//   통제 증빙은 통계 화면(stats.js)을 lib.page의 가짜 문서에 올려 기간을 넣고 "내려받기"를 누름. 지문(sha256Hex)과 내려받기(download)만 바꿔 끼워 파일 글을 받음
//   계약 상세는 obligation-ui.js를 먼저 올림(AC-39 openDoc과 같은 차례). 결재 기록 묶음은 lib.withModal로 창을 잡아 "목록 내려받기"를 누름
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const lib = require('./lib');
const { page, withModal, stripTags } = lib;
const JS = path.join(__dirname, '..', '..', 'prototype', 'assets', 'js');

const FROM = '2026-10-01'; // 통제 증빙 기간의 시작(끝은 시연 오늘 D.TODAY)
const PRE = [['#f-period', { value: 'last12' }], ['#f-service', { value: '' }], ['#f-unit', { value: '' }]]; // 통계 화면의 조건 칸(lib.stats와 같음)
// 곧바로 부르는 then(시험은 기다리지 않으므로 지문 계산의 Promise를 대신함)
const sync = v => ({ then(ok) { return sync(ok ? ok(v) : v); } });

// 통계 화면을 그 사람으로 열고 통제 증빙(from~to)을 내려받음. 돌려주는 값 { text: 파일 글 } 또는 { why }
function exportCsv(env, user, from, to) {
  const dom = page(env, 'stats.js', '?role=' + user.role, { user, preset: PRE });
  if (dom.error) return { why: '통계 화면을 열지 못함: ' + dom.error.message };
  const X = env.X, keep = { sha: X.sha256Hex, dl: X.download };
  let text = null;
  X.sha256Hex = () => sync('');
  X.download = (name, t) => { text = String(t); };
  dom.q('#ex-from').value = from;
  dom.q('#ex-to').value = to || env.D.TODAY;
  try { dom.fire('#btn-export', 'click'); } finally { X.sha256Hex = keep.sha; X.download = keep.dl; }
  return text == null ? { why: '통제 증빙 파일이 만들어지지 않음' } : { text };
}
// 파일 글에서 "[이름]" 묶음의 줄들(머리 줄 포함). 묶음은 빈 줄로 나뉨
function section(text, title) {
  const chunk = String(text).split('\r\n\r\n').filter(s => s.indexOf('[' + title + ']') === 0)[0];
  return chunk ? chunk.split('\r\n').slice(1) : null;
}
// 계약 상세를 그 사람으로 엶(obligation-ui.js를 먼저 올림)
function detail(env, id, user) {
  vm.runInContext(fs.readFileSync(path.join(JS, 'obligation-ui.js'), 'utf8'), env.ctx, { filename: 'obligation-ui.js' });
  return page(env, 'contract.js', '?id=' + id, { user });
}
// 계약 상세의 "결재 기록 묶음" 창에서 목록을 내려받음. 파일 글을 돌려줌(창이 열리지 않거나 글이 없으면 { why })
//   contract.js 안의 지문 셈은 Promise.resolve를 쓰므로 그동안만 곧바로 부르는 것으로 바꾸고, 파일(Blob)과 주소(URL)는 글만 받는 가짜로 둠
function bundleCsv(env, dom) {
  const ctx = env.ctx, P = ctx.Promise;
  let text = null;
  ctx.Blob = function (parts) { text = parts.join(''); };
  ctx.URL = { createObjectURL: () => 'blob:test', revokeObjectURL() {} };
  ctx.Promise = { resolve: v => sync(v) };
  try {
    const m = withModal(env, () => dom.fire('#btn-evidence', 'click'));
    if (!m.opened) return { why: '결재 기록 묶음 창이 열리지 않음' + (m.error ? ': ' + m.error.message : '') };
    const r = m.submit({});
    if (!r.done) return { why: '목록 내려받기가 끝나지 않음: ' + JSON.stringify(r.errors) };
  } finally { ctx.Promise = P; }
  return text == null ? { why: '결재 기록 묶음 목록 파일이 만들어지지 않음' } : { text };
}
// 코드 관리에서 코드 하나를 고친 것과 같은 기록(admin-codes.js openEdit의 done과 같은 C.adminSave)
function codeEdit(env, group, code, label, reason) {
  const c = env.D.CODES.find(x => x.group === group && x.code === code);
  if (!c) return null;
  const g = env.D.CODE_GROUPS[group];
  return env.C.adminSave('CODE', g.name + ' ' + c.code, '화면 이름: ' + c.label + ' → ' + label, reason, { k: 'CODE_EDIT', group: group, code: c.code, set: { label: label, use: c.use } });
}

const T = {
  'AC-41': [
    // ---------- audit-trail-01 고객사 티어 목록 변경 ----------
    {
      name: '(2026-11-18 셋째 점검 audit-trail-01, 결정 3) 코드 관리에서 고객사 티어 T1의 이름을 "골드"로 바꾸면 통제 증빙 "가격과 권한 변경"에 영역 "거래처(고객사 티어 목록)" 줄이 바뀐 내용과 사유와 함께 생김',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SUPER' });
        const su = env.U('u_super');
        const before = exportCsv(env, su, FROM);
        if (before.why) return before.why;
        const n0 = (section(before.text, '가격과 권한 변경') || []).length;
        const e = codeEdit(env, 'TIER', 'T1', '골드', '시험 티어 이름 변경');
        if (!e || e.refused) return '시험 전제: 티어 이름 변경 기록을 남기지 못함';
        if (!env.X.settingChanges({ areas: ['CUSTOMER'] }).some(x => x.tierCode && x.at === e.at)) return '시험 전제: 설정 변경 확인에 티어 목록 변경 줄이 없음';
        const after = exportCsv(env, su, FROM);
        if (after.why) return after.why;
        const rows = section(after.text, '가격과 권한 변경');
        if (!rows) return '"가격과 권한 변경" 묶음이 없음';
        const row = rows.find(r => r.indexOf(',거래처(고객사 티어 목록),') > -1);
        if (!row) return '"가격과 권한 변경"에 고객사 티어 목록 변경 줄이 없음';
        if (row.indexOf('고객사 티어 T1') < 0 || row.indexOf('화면 이름: 티어 1 → 골드') < 0 || row.indexOf('시험 티어 이름 변경') < 0) return '티어 목록 변경 줄에 대상, 바뀐 내용, 사유가 다 있지 않음: ' + row;
        if (rows.length !== n0 + 1) return '줄 수가 한 줄 늘지 않음(' + n0 + ' → ' + rows.length + ')';
        if (after.text.indexOf('가격과 권한 변경 ' + (rows.length - 1) + '줄') < 0) return '파일 머리의 건수에 늘어난 줄이 셈에 들지 않음';
        return true;
      },
    },
    {
      name: '(2026-11-18 셋째 점검 audit-trail-01) 고객사 티어가 아닌 코드(사후관리 종류)의 이름 변경은 "거래처(고객사 티어 목록)" 줄이 되지 않고, 티어 목록 변경도 기간 밖이면 들지 않음',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SUPER' });
        const su = env.U('u_super');
        const other = env.D.CODES.find(x => x.group === 'AFTERCARE');
        if (!other) return '시험 전제: 사후관리 종류 코드가 없음';
        if (!codeEdit(env, 'AFTERCARE', other.code, other.label + '(시험)', '시험 다른 코드 변경')) return '시험 전제: 다른 코드 변경을 남기지 못함';
        let x = exportCsv(env, su, FROM);
        if (x.why) return x.why;
        if ((section(x.text, '가격과 권한 변경') || []).some(r => r.indexOf('거래처(고객사 티어 목록)') > -1)) return '티어가 아닌 코드 변경이 고객사 티어 목록 줄로 들어감';
        codeEdit(env, 'TIER', 'T2', '실버', '시험 기간 밖');
        // 기록 일시는 시연 오늘이므로, 오늘 전날까지의 기간에는 들지 않아야 함
        const D = env.D, prev = D.TODAY.slice(0, 8) + String(Number(D.TODAY.slice(8)) - 1).padStart(2, '0');
        x = exportCsv(env, su, FROM, prev);
        if (x.why) return x.why;
        if ((section(x.text, '가격과 권한 변경') || []).some(r => r.indexOf('거래처(고객사 티어 목록)') > -1)) return '기간 밖의 티어 목록 변경이 들어감';
        x = exportCsv(env, su, FROM);
        if (!(section(x.text, '가격과 권한 변경') || []).some(r => r.indexOf('티어 2 → 실버') > -1)) return '견줌: 기간 안이면 티어 목록 변경 줄이 있어야 함';
        return true;
      },
    },
    // ---------- audit-trail-02 영업대표 바꾸기 ----------
    {
      name: '(2026-11-18 셋째 점검 audit-trail-02, CTL-137) 예시 영업대표 바꾸기(OC-0001, 2609CL011)가 접속 기록에 "수정" 한 줄로 있고, 통제 증빙 "결재 기록"에 "영업대표 지정" 줄(앞뒤 영업대표, 정한 사람, 사유)로 있음',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SUPER' });
        const { C, X, D } = env;
        const oc = D.OWNER_CHANGES.find(r => r.id === 'OC-0001');
        if (!oc || oc.bundleId !== '2609CL011') return '시험 전제: 예시 OC-0001(2609CL011)이 없음';
        if (X.ACTS.EDIT !== '수정') return '접속 기록의 한 일에 "수정"(EDIT)이 없음';
        const root = env.contract('2609CL011');
        const log = X.accessLogs([]).find(l => l.act === 'EDIT' && l.at === oc.at && l.userId === oc.by);
        if (!log) return '접속 기록에 영업대표 바꾸기(수정) 줄이 없음';
        const want = '영업대표 바꾸기: 2609CL011 ' + root.counterparty + ' (' + C.ownerLabel(oc.from) + ' → ' + C.ownerLabel(oc.to) + ')';
        if (log.target !== want) return '수정 줄의 대상이 다름: ' + log.target + ' (기대: ' + want + ')';
        const x = exportCsv(env, env.U('u_super'), FROM);
        if (x.why) return x.why;
        const rows = section(x.text, '결재 기록') || [];
        const row = rows.find(r => r.indexOf('2609CL011,-,영업대표 지정,') === 0);
        if (!row) return '통제 증빙 "결재 기록"에 2609CL011의 영업대표 지정 줄이 없음';
        if (row.indexOf(C.ownerLabel(oc.from) + ' → ' + C.ownerLabel(oc.to)) < 0 || row.indexOf(C.ownerLabel(oc.by, oc.byDept)) < 0 || row.indexOf(oc.reason.slice(0, 10)) < 0) return '영업대표 지정 줄에 앞뒤 영업대표, 정한 사람, 사유가 다 있지 않음: ' + row;
        if ((section(x.text, '접속 기록') || []).every(r => r.indexOf(',수정,영업대표 바꾸기: 2609CL011') < 0)) return '통제 증빙 "접속 기록"에 수정 줄이 없음';
        return true;
      },
    },
    {
      name: '(2026-11-18 셋째 점검 audit-trail-02) 영업 리더가 볼 수 없는 열람 제한 2511CL001의 가린 창에서 영업대표를 바꾸면 접속 기록에 "수정" 한 줄(번호만, 고객사 이름 없음)이 생기고 통제 증빙 "결재 기록"에도 들어감',
      kind: 'deny',
      run(h) {
        const env = lib.env0(h, { role: 'HEAD', hook: D => { D.CONTRACTS.find(c => c.id === '2511CL001').restricted = true; } }); // env0: 저장 뒤 알림(toast)이 멈추지 않게
        const { C, X } = env;
        const head = env.U('u_head');
        const b = C.bundleOf('2511CL001');
        const name = b.root.counterparty;
        if (C.canView(b.root, head) || !C.canChangeRep(b, head)) return '시험 전제: 리더가 볼 수 없고 영업대표는 바꿀 수 있어야 함';
        const to = C.repCandidates(b, head).filter(a => a.id !== head.id)[0];
        if (!to) return '시험 전제: 고를 새 영업대표가 없음';
        const before = X.accessLogs([]).filter(l => l.act === 'EDIT').length;
        const m = withModal(env, () => C.openRepChange(b, head, null, { masked: true }));
        if (!m.opened) return '영업대표 바꾸기 창이 열리지 않음';
        const r = m.submit({ to: to.id, reason: '시험 영업대표 바꾸기' });
        if (!r.done) return '영업대표 바꾸기가 저장되지 않음: ' + JSON.stringify(r.errors);
        const logs = X.accessLogs([]).filter(l => l.act === 'EDIT');
        if (logs.length !== before + 1) return '접속 기록의 수정 줄이 한 줄 늘지 않음(' + before + ' → ' + logs.length + ')';
        const log = logs.find(l => l.userId === head.id && l.target.indexOf('영업대표 바꾸기: 2511CL001 (') === 0);
        if (!log) return '접속 기록에 2511CL001 영업대표 바꾸기(수정) 줄이 없음: ' + logs.map(l => l.target).join(' / ');
        if (log.target.indexOf(name) > -1) return '열람 제한 계약의 수정 줄에 고객사 이름이 보임: ' + log.target;
        if (log.target.indexOf(C.ownerLabel(to.id)) < 0) return '수정 줄에 새 영업대표가 없음: ' + log.target;
        const x = exportCsv(env, env.U('u_super'), FROM);
        if (x.why) return x.why;
        const row = (section(x.text, '결재 기록') || []).find(l => l.indexOf('2511CL001,-,영업대표 지정,') === 0);
        if (!row || row.indexOf('시험 영업대표 바꾸기') < 0) return '통제 증빙 "결재 기록"에 2511CL001의 영업대표 지정 줄(사유 포함)이 없음';
        return true;
      },
    },
    // ---------- audit-trail-03 사후 등록과 임시 결재 번호 ----------
    {
      name: '(2026-11-18 셋째 점검 audit-trail-03, W7-7 (가)) 사후 등록 계약(2610CL002, 임시-2027-0003)의 계약 상세 머리에 "사후 등록" 배지, 기본 정보에 임시 결재 번호, 결재 기록 묶음 목록 머리에 그 번호가 보임',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SUPER', hook: D => { D.CONTRACTS.find(c => c.id === '2610CL002').lateEntry = { tempNo: '임시-2027-0003' }; } });
        const dom = detail(env, '2610CL002', env.U('u_super'));
        if (dom.error) return '계약 상세를 열지 못함: ' + dom.error.message;
        if (stripTags(dom.q('#doc-meta').innerHTML).indexOf('사후 등록') < 0) return '계약 상세 머리에 "사후 등록" 배지가 없음';
        const now = stripTags(dom.q('#now').innerHTML);
        if (now.indexOf('사후 등록') < 0 || now.indexOf('임시 결재 번호 임시-2027-0003') < 0) return '계약 상세 기본 정보에 사후 등록과 임시 결재 번호가 없음';
        const x = bundleCsv(env, dom);
        if (x.why) return x.why;
        if (x.text.indexOf('사후 등록,2610CL002 임시 결재 번호 임시-2027-0003') < 0) return '결재 기록 묶음 목록 머리에 사후 등록 줄이 없음: ' + x.text.split('\r\n').slice(0, 6).join(' / ');
        return true;
      },
    },
    {
      name: '(2026-11-18 셋째 점검 audit-trail-03) 통제 증빙 "계약과 차수"에 "사후 등록(임시 결재 번호)" 칸이 있어 사후 등록 계약은 "예(임시 결재 번호 …)", 보통 계약은 "아니요". 사후 등록이 아닌 계약 상세에는 배지와 칸이 없음',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'SUPER', hook: D => { D.CONTRACTS.find(c => c.id === '2610CL002').lateEntry = { tempNo: '임시-2027-0003' }; } });
        const x = exportCsv(env, env.U('u_super'), FROM);
        if (x.why) return x.why;
        const rows = section(x.text, '계약과 차수');
        if (!rows) return '"계약과 차수" 묶음이 없음';
        if (!/,사후 등록\(임시 결재 번호\)$/.test(rows[0])) return '"계약과 차수" 머리 줄 끝에 "사후 등록(임시 결재 번호)" 칸이 없음: ' + rows[0];
        const late = rows.find(r => r.indexOf('2610CL002,') === 0);
        if (!late) return '시험 전제: 2610CL002가 기간 안 계약에 없음';
        if (!/,예\(임시 결재 번호 임시-2027-0003\)$/.test(late)) return '사후 등록 계약 줄 끝에 임시 결재 번호가 없음: ' + late;
        const plain = rows.slice(1).filter(r => r.indexOf('2610CL002,') !== 0);
        if (!plain.length) return '시험 전제: 견줄 보통 계약이 없음';
        if (plain.some(r => !/,아니요$/.test(r))) return '사후 등록이 아닌 계약 줄 끝이 "아니요"가 아님: ' + plain.find(r => !/,아니요$/.test(r));
        const other = plain[0].split(',')[0];
        const env2 = h.fresh({ role: 'SUPER' });
        const dom = detail(env2, other, env2.U('u_super'));
        if (dom.error) return '견줄 계약 상세를 열지 못함: ' + dom.error.message;
        if (stripTags(dom.q('#doc-meta').innerHTML + ' ' + dom.q('#now').innerHTML).indexOf('사후 등록') > -1) return '사후 등록이 아닌 계약(' + other + ') 상세에 사후 등록이 보임';
        return true;
      },
    },
  ],
};

module.exports = function (ac) { return T[ac] || []; };
module.exports.ACS = Object.keys(T);
