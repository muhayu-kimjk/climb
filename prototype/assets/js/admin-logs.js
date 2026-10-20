/* =====================================================================
 * SCR-57 접속 기록 점검 화면 로직 (admin-logs.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-SEC-05(분기 권한 검토), REQ-SEC-06(기록 보관, 매월 점검, 이상 행위 즉시 알림), REQ-AUTH-13(접속 기록)
 * 쓰는 사람: 정보보호 담당자. 관리자가 자기 작업 기록을 스스로 점검하지 않도록 관리자는 볼 수 없음 (기획자 결정 v0.25)
 * 하는 일
 *   1. 이상 행위 알림: 확인 전인 알림에 확인 결과와 조치를 남김
 *   2. 매월 기록 점검: CLIMB을 쓰기 시작한 달부터 지난달까지. [가정] 기한은 다음 달 말일
 *   3. 분기 권한 검토: 계정 수, 관리자 권한을 가진 사람, 사용 중지 계정, 권한을 바꾼 기록과 사유를 모아 보여 주고 결과를 남김
 *      [가정] 기한은 분기가 끝난 다음 달 말일
 *   4. 접속 기록 조회: 사람, 한 일, 기간으로 거르기. 한 쪽 20건
 * 프로토타입: 접속 기록은 예시 데이터(계정의 로그인 일시, 결재 기록, 관리자 변경 이력, 이상 행위 알림)로 만든 일부입니다.
 *   실제 시스템은 서버가 모든 기록을 고치거나 지울 수 없게 영구 보관하고, 이 화면을 연 것도 기록합니다.
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  if (!C.gate(me, ['PRIVACY'], '접속 기록 점검은 정보보호 담당자가 합니다',
    '관리자가 자기 작업 기록을 스스로 점검하지 않도록 관리자도 이 화면을 볼 수 없습니다(지금은 ' + esc(C.roleLabel(me.role)) + ' 역할로 보고 있습니다). ' +
    '화면 맨 위 검은 띠에서 정보보호 담당자나 최고관리자로 바꾸면 볼 수 있습니다.')) return;

  const PAGE_SIZE = 20;
  const START_MONTH = '2026-09'; // CLIMB을 쓰기 시작한 달 (ACCOUNTS 등록일 기준)
  function val(f, n) { return (f.elements[n].value || '').trim(); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function lastDay(y, m) { return y + '-' + pad(m) + '-' + pad(new Date(y, m, 0).getDate()); } // m: 1~12
  function monthLabel(ym) { return ym.slice(0, 4) + '년 ' + Number(ym.slice(5, 7)) + '월'; }
  const THIS_MONTH = D.TODAY.slice(0, 7);

  // 이 화면을 연 것도 접속 기록에 남음 (REQ-ADM-18). 시연에서는 화면을 열 때마다 한 줄
  const OPENED = C.nowStamp();

  /* ---------- 접속 기록 만들기 (시연용) ---------- */
  const ACTS = { LOGIN: '로그인', LOGOUT: '로그아웃', VIEW: '열람', SUBMIT: '기안', APPROVE: '결재', DOWNLOAD: '내려받기', NOTE: '사후관리 기록', ADMIN: '설정 변경', AUDIT: '점검 기록' };
  const AREA = { USER: '사용자 권한', RULE: '결재선 규칙', RESTRICT: '열람 제한', PRICE: '가격 기준', CUSTOMER: '거래처', CODE: '코드' };
  function buildLogs() {
    const out = [];
    const push = function (at, userId, act, target, place) { if (at) out.push({ at: at, userId: userId, act: act, target: target || '-', place: place || '사내망' }); };
    D.ACCOUNTS.forEach(function (a) {
      push(a.firstLoginAt, a.id, 'LOGIN', '첫 접속');
      push(a.lastLoginAt, a.id, 'LOGIN', '');
      push(a.lastLogoutAt, a.id, 'LOGOUT', '');
    });
    D.CONTRACTS.forEach(function (c) {
      if (!c.id) return;
      push(c.requestedAt, c.requesterId, 'SUBMIT', c.id + ' ' + c.counterparty);
      (c.history || []).forEach(function (h) {
        const st = D.STEPS[h.step];
        push(h.at, h.actorId, 'APPROVE', c.id + ' ' + st.no + ' ' + C.actionLabel(h, c));
      });
      (c.notes || []).forEach(function (n) { push(n.at, n.by, 'NOTE', c.id + ' ' + (D.AFTERCARE_TYPES[n.type] || '')); });
    });
    D.ADMIN_LOG.forEach(function (e) {
      push(e.at, e.by, e.area === 'AUDIT' ? 'AUDIT' : 'ADMIN', (AREA[e.area] ? AREA[e.area] + ': ' : '') + e.target);
    });
    push(OPENED, me.id, 'VIEW', '접속 기록 점검 화면');
    D.PRICE_ROWS.forEach(function (r) { push(r.at, r.by, 'ADMIN', '가격 기준: ' + r.name + ' (' + C.fmtDate(r.validFrom) + '부터)'); });
    // 이상 행위 알림이 생긴 접속 (가상의 기록)
    D.SEC_ALERTS.forEach(function (al) {
      push(al.at, al.userId, al.kind === 'BULK' ? 'VIEW' : 'LOGIN', al.detail, al.kind === 'BULK' ? '사내망' : 'VPN');
      if (al.kind === 'BULK') push(al.at.slice(0, 14) + '27', al.userId, 'DOWNLOAD', '첨부 PDF 6건 (워터마크)', '사내망');
    });
    return out.sort(function (a, b) { return b.at.localeCompare(a.at); });
  }
  let logs = buildLogs();

  /* ---------- 1. 이상 행위 알림 ---------- */
  function renderAlerts() {
    const open = D.SEC_ALERTS.filter(function (a) { return a.status === 'OPEN'; }).length;
    $('#alert-count').innerHTML = open ? C.badge('danger', '확인 전 ' + open + '건') : C.badge('line', '모두 확인');
    const list = D.SEC_ALERTS.slice().sort(function (a, b) { return (a.status === 'OPEN' ? 0 : 1) - (b.status === 'OPEN' ? 0 : 1) || b.at.localeCompare(a.at); });
    $('#alert-rows').innerHTML = list.map(function (a) {
      const done = a.status === 'DONE';
      return '<tr' + (done ? '' : ' class="is-alert"') + '><td class="nowrap num-left">' + C.fmtDateTime(a.at) + '</td>' +
        '<td class="nowrap"><span class="cell-strong">' + esc(C.userName(a.userId)) + '님</span><span class="cell-meta">' + esc((D.USERS[a.userId] || {}).dept || '') + '</span></td>' +
        '<td><span class="cell-strong">' + esc(D.SEC_ALERT_KINDS[a.kind]) + '</span><span class="cell-meta">' + esc(a.detail) + '</span>' +
          (done ? '<span class="cell-meta">결과: ' + esc(a.action) + ' (' + esc(C.userName(a.doneBy)) + '님, ' + C.fmtDateTime(a.doneAt) + ')</span>' : '') + '</td>' +
        '<td class="nowrap">' + (done ? C.badge('success', '확인함') : C.badge('danger', '확인 전')) + '</td>' +
        '<td class="col-action">' + (done ? '-' : '<button type="button" class="link-act" data-alert="' + esc(a.id) + '">확인</button>') + '</td></tr>';
    }).join('');
  }
  function openAlert(id) {
    const a = D.SEC_ALERTS.filter(function (x) { return x.id === id; })[0];
    C.formModal({
      title: '이상 행위 알림을 확인했나요?',
      desc: '저장하면 확인한 사람, 일시, 결과가 남고 알림이 "확인함"으로 바뀝니다.',
      body: '<p class="modal-info">' + esc(C.userName(a.userId)) + '님, ' + C.fmtDateTime(a.at) + ', ' + esc(D.SEC_ALERT_KINDS[a.kind]) + ': ' + esc(a.detail) + '</p>' +
        C.fieldHtml({ name: 'act', label: '확인 결과와 조치', type: 'textarea', required: true,
          placeholder: '예: 본인에게 확인. 분기 결산 자료 준비로 열람, 업무 목적 맞음. 조치 없음', help: '본인 확인 결과, 업무 목적인지, 한 조치(권한 회수, 교육 등)를 적습니다.' }),
      btn: '확인 결과 저장',
      check: function (f) { return { act: val(f, 'act') ? '' : '확인 결과와 조치를 적으세요.' }; },
      done: function (f) {
        C.adminSave('AUDIT', '이상 행위 알림 ' + a.id + ' (' + C.userName(a.userId) + ')', '확인함: ' + D.SEC_ALERT_KINDS[a.kind], val(f, 'act'), { k: 'ALERT_DONE', id: a.id, action: val(f, 'act') });
        refresh();
        C.toast('알림 확인 결과를 남겼습니다.');
      },
    });
  }

  /* ---------- 2. 매월 기록 점검 ---------- */
  function months() {
    const out = [];
    let y = Number(START_MONTH.slice(0, 4)), m = Number(START_MONTH.slice(5, 7));
    for (;;) {
      const ym = y + '-' + pad(m);
      if (ym > THIS_MONTH) break;
      out.push({ ym: ym, due: lastDay(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1), ended: ym < THIS_MONTH });
      m++; if (m > 12) { m = 1; y++; }
    }
    return out.reverse();
  }
  function resultBadge(r) { return r.result === 'OK' ? C.badge('success', '이상 없음') : C.badge('attention', '조치함'); }
  //   word: 점검(매월) 또는 검토(분기)
  function reviewRow(label, due, rec, ended, btnAttr, notYet, word) {
    const late = !rec && ended && D.TODAY > due;
    return '<tr' + (late ? ' class="is-alert"' : '') + '><td class="nowrap cell-strong">' + esc(label) + '</td>' +
      '<td class="nowrap num-left">' + C.fmtDate(due) + (late ? '<span class="cell-meta">기한 지남</span>' : '') + '</td>' +
      '<td class="nowrap">' + (rec ? esc(C.userName(rec.by)) + '님<span class="cell-meta">' + C.fmtDateTime(rec.at) + '</span>' : ended ? word + ' 전' : '-') + '</td>' +
      '<td class="nowrap">' + (rec ? resultBadge(rec) : ended ? C.badge('line', word + ' 전') : C.badge('line', '예정')) + '</td>' +
      '<td>' + (rec ? esc(rec.note) + (rec.action ? '<span class="cell-meta">조치: ' + esc(rec.action) + '</span>' : '') : ended ? '-' : esc(notYet)) + '</td>' +
      '<td class="col-action">' + (!rec && ended ? '<button type="button" class="link-act" ' + btnAttr + '>결과 남기기</button>' : '-') + '</td></tr>';
  }
  function renderMonths() {
    $('#month-rows').innerHTML = months().map(function (x) {
      const rec = D.LOG_REVIEWS.filter(function (r) { return r.month === x.ym; })[0];
      return reviewRow(monthLabel(x.ym), x.due, rec, x.ended, 'data-month="' + x.ym + '"', '이달이 끝난 뒤 점검', '점검');
    }).join('');
  }
  // 그 달의 기록 수 (점검 창에 참고로 보여 줌)
  function monthStats(ym) {
    const inMonth = logs.filter(function (l) { return l.at.slice(0, 7) === ym; });
    const alerts = D.SEC_ALERTS.filter(function (a) { return a.at.slice(0, 7) === ym; });
    return '접속 기록 ' + inMonth.length + '건, 내려받기 ' + inMonth.filter(function (l) { return l.act === 'DOWNLOAD'; }).length + '건, ' +
      '업무 시간 밖 기록 ' + inMonth.filter(function (l) { const h = Number(l.at.slice(11, 13)); return h < 8 || h >= 20; }).length + '건, ' +
      '이상 행위 알림 ' + alerts.length + '건(확인 전 ' + alerts.filter(function (a) { return a.status === 'OPEN'; }).length + '건)';
  }
  function resultFields(okLabel) {
    return '<fieldset class="field" data-field="result"><legend class="field-label">결과<span class="req" aria-hidden="true">*</span><span class="sr-only">(필수)</span></legend>' +
        '<div class="choice-row"><label class="choice"><input type="radio" name="result" value="OK">' + esc(okLabel) + '</label>' +
        '<label class="choice"><input type="radio" name="result" value="ACTION">조치함</label></div><p class="field-error" hidden></p></fieldset>' +
      C.fieldHtml({ name: 'note', label: '확인한 내용', type: 'textarea', required: true }) +
      C.fieldHtml({ name: 'act', label: '조치', type: 'textarea', help: '조치함을 고르면 꼭 적습니다. 예: 퇴사자 계정 사용 중지 요청(관리자, 10.2 처리)' });
  }
  function checkResult(f) {
    const r = f.querySelector('[name="result"]:checked');
    return {
      result: r ? '' : '결과를 고르세요.',
      note: val(f, 'note') ? '' : '확인한 내용을 적으세요.',
      act: r && r.value === 'ACTION' && !val(f, 'act') ? '조치를 적으세요.' : '',
    };
  }
  function openMonth(ym) {
    C.formModal({
      title: monthLabel(ym) + ' 기록 점검 결과를 남길까요?',
      desc: '저장하면 점검한 사람과 일시, 결과가 남고 고칠 수 없습니다.',
      body: '<p class="modal-info">' + esc(monthStats(ym)) + '</p>' + resultFields('이상 없음'),
      btn: '점검 결과 저장',
      open: function (f) { f.elements.note.placeholder = '예: 접속 기록과 내려받기 기록 확인. 업무 시간 밖 접속은 모두 결재 처리로 확인함'; },
      check: checkResult,
      done: function (f) {
        const r = { month: ym, result: f.querySelector('[name="result"]:checked').value, note: val(f, 'note'), action: val(f, 'act') };
        C.adminSave('AUDIT', monthLabel(ym) + ' 기록 점검', '결과: ' + (r.result === 'OK' ? '이상 없음' : '조치함'), r.note + (r.action ? ' / 조치: ' + r.action : ''), { k: 'LOG_REVIEW', r: r });
        refresh();
        C.toast(monthLabel(ym) + ' 기록 점검 결과를 남겼습니다.');
      },
    });
  }

  /* ---------- 3. 분기 권한 검토 ---------- */
  function quarters() {
    const out = [];
    const y0 = Number(START_MONTH.slice(0, 4)), q0 = Math.ceil(Number(START_MONTH.slice(5, 7)) / 3);
    const yN = Number(THIS_MONTH.slice(0, 4)), qN = Math.ceil(Number(THIS_MONTH.slice(5, 7)) / 3);
    for (let y = y0, q = q0; y < yN || (y === yN && q <= qN); q === 4 ? (q = 1, y++) : q++) {
      const endM = q * 3, dueY = endM === 12 ? y + 1 : y, dueM = endM === 12 ? 1 : endM + 1;
      out.push({ key: y + '-Q' + q, label: y + '년 ' + q + '분기', start: y + '-' + pad(endM - 2) + '-01', end: lastDay(y, endM), due: lastDay(dueY, dueM), ended: !(y === yN && q === qN) });
    }
    return out.reverse();
  }
  function renderQuarters() {
    $('#quarter-rows').innerHTML = quarters().map(function (x) {
      const rec = D.ACCESS_REVIEWS.filter(function (r) { return r.quarter === x.key; })[0];
      return reviewRow(x.label, x.due, rec, x.ended, 'data-quarter="' + x.key + '"', '분기가 끝난 뒤 검토', '검토');
    }).join('');
  }
  // 권한 검토 자료: 계정 현황, 관리자 권한, 권한을 바꾼 기록과 사유 (REQ-SEC-05, 기획자 결정 v0.25: 분기 검토에서 사유 확인)
  function accessSummary(q) {
    const acc = D.ACCOUNTS;
    const count = function (s) { return acc.filter(function (a) { return a.status === s; }).length; };
    const admins = acc.filter(function (a) { return a.status !== 'SUSPENDED' && (a.roles.indexOf('ADMIN') > -1 || a.roles.indexOf('SUPER') > -1); });
    // 지난 권한 검토 뒤(처음이면 CLIMB을 쓰기 시작한 때부터) 오늘까지 권한을 바꾼 기록
    const last = D.ACCESS_REVIEWS.slice().sort(function (a, b) { return b.at.localeCompare(a.at); })[0];
    const since = last ? last.at : START_MONTH + '-01';
    const changes = C.adminLog(['USER']).filter(function (e) { return e.at > since; });
    const stopped = acc.filter(function (a) { return a.status === 'SUSPENDED'; });
    const noReason = changes.filter(function (e) { return !e.reason; }).length;
    const idle = acc.filter(function (a) { return a.status === 'ACTIVE' && a.lastLoginAt && C.daysBetween(new Date(a.lastLoginAt.slice(0, 10)), new Date(D.TODAY)) > 90; });
    return '<ul class="summary-list">' +
      '<li>계정 ' + acc.length + '개: 사용 중 ' + count('ACTIVE') + ', 첫 접속 전 ' + count('INVITED') + ', 사용 중지 ' + count('SUSPENDED') + '</li>' +
      '<li>관리자 권한(관리자, 최고관리자) ' + admins.length + '명: ' + esc(admins.map(function (a) { return a.name; }).join(', ')) + '</li>' +
      '<li>' + (last ? '지난 검토(' + C.fmtDate(last.at) + ') 뒤' : C.fmtDate(since) + '부터') + ' 권한을 바꾼 기록 ' + changes.length + '건: ' +
        (noReason ? '사유 없는 기록 ' + noReason + '건' : '모두 사유가 있음') + ' (사용자 권한 관리의 권한 변경 이력)</li>' +
      '<li>사용 중지 계정 ' + stopped.length + '개' + (stopped.length ? ': ' + esc(stopped.map(function (a) { return a.name; }).join(', ')) : '') + '</li>' +
      '<li>90일 넘게 로그인하지 않은 사용 중 계정 ' + idle.length + '개' + (idle.length ? ': ' + esc(idle.map(function (a) { return a.name; }).join(', ')) : '') + '</li>' +
      '</ul>';
  }
  function openQuarter(key) {
    const q = quarters().filter(function (x) { return x.key === key; })[0];
    C.formModal({
      title: q.label + ' 권한 검토 결과를 남길까요?',
      desc: '저장하면 검토한 사람과 일시, 결과가 남고 고칠 수 없습니다. 권한을 바꿔야 하면 관리자에게 요청하고 조치에 적습니다.',
      body: '<div class="modal-info">' + accessSummary(q) + '</div>' + resultFields('이상 없음'),
      btn: '검토 결과 저장',
      open: function (f) { f.elements.note.placeholder = '예: 모든 계정의 권한이 하는 일에 맞음. 권한을 바꾼 기록 모두 사유 있음'; },
      check: checkResult,
      done: function (f) {
        const r = { quarter: key, result: f.querySelector('[name="result"]:checked').value, note: val(f, 'note'), action: val(f, 'act') };
        C.adminSave('AUDIT', q.label + ' 권한 검토', '결과: ' + (r.result === 'OK' ? '이상 없음' : '조치함'), r.note + (r.action ? ' / 조치: ' + r.action : ''), { k: 'ACCESS_REVIEW', r: r });
        refresh();
        C.toast(q.label + ' 권한 검토 결과를 남겼습니다.');
      },
    });
  }

  /* ---------- 4. 접속 기록 조회 ---------- */
  $('#f-act').innerHTML = '<option value="">전체</option>' + Object.keys(ACTS).map(function (k) { return '<option value="' + k + '">' + esc(ACTS[k]) + '</option>'; }).join('');
  let page = 1;
  function filtered() {
    const q = $('#f-q').value.trim().toLowerCase(), act = $('#f-act').value, from = $('#f-from').value, to = $('#f-to').value;
    return logs.filter(function (l) {
      if (q && C.userName(l.userId).toLowerCase().indexOf(q) < 0 && l.target.toLowerCase().indexOf(q) < 0) return false;
      if (act && l.act !== act) return false;
      if (from && l.at.slice(0, 10) < from) return false;
      if (to && l.at.slice(0, 10) > to) return false;
      return true;
    });
  }
  function renderLogs() {
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (page > pages) page = pages;
    const from = (page - 1) * PAGE_SIZE, rows = list.slice(from, from + PAGE_SIZE);
    $('#list-count').innerHTML = C.meta(['<strong>' + (list.length !== logs.length ? '검색 결과 ' : '전체 ') + list.length + '건</strong>', '고치거나 지울 수 없음, 영구 보관']);
    $('#log-rows').innerHTML = rows.length ? rows.map(function (l) {
      return '<tr><td class="nowrap num-left">' + C.fmtDateTime(l.at) + '</td><td class="nowrap">' + esc(C.userName(l.userId)) + '</td>' +
        '<td class="nowrap">' + esc(ACTS[l.act]) + '</td><td>' + esc(l.target) + '</td><td class="nowrap">' + esc(l.place) + '</td></tr>';
    }).join('') : '<tr><td class="empty-row" colspan="5">조건에 맞는 기록이 없습니다.</td></tr>';
    $('#pagination').innerHTML = C.pagerHtml(page, pages, list.length, from, rows.length, PAGE_SIZE, '건');
  }

  function refresh() {
    logs = buildLogs();
    renderAlerts();
    renderMonths();
    renderQuarters();
    renderLogs();
  }
  $('#filter').addEventListener('input', function () { page = 1; renderLogs(); });
  $('#filter').addEventListener('change', function () { page = 1; renderLogs(); });
  $('#filter').addEventListener('reset', function () { setTimeout(function () { page = 1; renderLogs(); }, 0); });
  $('#filter').addEventListener('submit', function (e) { e.preventDefault(); });
  $('#content').addEventListener('click', function (e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.getAttribute('data-alert')) openAlert(b.getAttribute('data-alert'));
    else if (b.getAttribute('data-month')) openMonth(b.getAttribute('data-month'));
    else if (b.getAttribute('data-quarter')) openQuarter(b.getAttribute('data-quarter'));
    else if (b.getAttribute('data-page') && !b.disabled) { page = Number(b.getAttribute('data-page')); renderLogs(); $('#sec-log').scrollIntoView({ block: 'start' }); }
  });
  refresh();
})();
