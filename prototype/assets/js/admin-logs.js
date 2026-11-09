/* =====================================================================
 * SCR-57 접속 기록 점검 화면 로직 (admin-logs.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-SEC-05(분기 권한 검토), REQ-SEC-06(기록 보관, 매월 점검, 이상 행위 즉시 알림), REQ-AUTH-13(접속 기록)
 * 쓰는 사람: 정보보호 담당자. 관리자가 자기 작업 기록을 스스로 점검하지 않도록 관리자는 볼 수 없음 (기획자 결정 v0.25)
 *   기획자 결정 2026-11-02 C-2: 감사 열람은 이 화면을 보기만 함(단추를 하나도 그리지 않음)
 *   기획자 결정 2026-11-02 C-6: 최고관리자는 보지만 자기 작업이 든 점검과 검토는 남기지 못함. 최고관리자 작업은 따로 모아 정보보호 담당자만 점검
 * 하는 일
 *   1. 이상 행위 알림: 확인 전인 알림에 확인 결과와 조치를 남김. 본인에 대한 알림은 본인이 남기지 못함(C-6과 같은 원칙)
 *   2. 매월 기록 점검: 이 시스템을 쓰기 시작한 달(D.SERVICE_START_MONTH)부터 지난달까지. [가정] 기한은 다음 달 말일
 *      기획자 결정 2026-11-02 C-8: 줄마다 그달 설정 변경 건수와 확인 기다림, 점검 창과 남기는 자료에도 설정 변경과 최고관리자 작업 요약
 *   3. 최고관리자 작업 (C-6): 그달 최고관리자 계정이 한 일을 모아 정보보호 담당자(담당자, 리더)만 결과를 남김. 기한은 매월 점검과 같음
 *   4. 설정 변경 (C-8): 그달 가격 기준, 제품과 기능, 표준계약서, 결재선 규칙, 회사 설정을 바꾼 것(전후 값, 사유, 품의 링크)
 *      가격과 제품은 재무 리더, 표준계약서는 올린 사람이 아닌 법무가 설정 변경 확인(SCR-65)에서 남긴 확인이 있는지 봄
 *      결재선 규칙은 근거(사유, 위임전결 근거)와 새로 맡는 사람이 기안자 유닛 밖인지
 *   5. 분기 권한 검토: 계정 수, 관리자 권한을 가진 사람, 사용 중지 계정, 권한을 바꾼 기록과 사유,
 *      그 분기에 걸친 대리 지정(v0.63, 표준 대응표 G-23 ②)을 모아 보여 주고 결과를 남김
 *      [가정] 기한은 분기가 끝난 다음 달 말일
 *      점검과 검토 결과에는 그때 창에서 본 자료(seen)를 함께 남김(v0.63, G-23 ③. 계산값이라 나중에 다시 만들 수 없음)
 *      기획자 결정 2026-11-02 C-2: 끝나는 날이 지나 저절로 풀린 감사 열람도 권한을 바꾼 기록으로 셈
 *   6. 분기 권한 검토 자료 (기획자 결정 2026-11-02 C-2, C-5, C-7): 고른 분기의 감사 열람 계정, 모든 지정 열람자, 역할 충돌 계정,
 *      유닛 리더에게 계정 목록 보내기(보내기만 하고 답은 받지 않음. 보낸 사람, 일시, 유닛과 받은 리더를 남김)
 *      [가정, 기획자 확인 필요] 2026-11-03 C-44: 요약 줄에 "영업대표가 바뀐 열람 제한 계약의 앞 기안자(그 묶음 계약을 기안한 사람)"(묶음 번호만, 고객사 이름 없음)
 *   7. 접속 기록 조회: 사람, 한 일, 기간으로 거르기. 한 쪽 20건
 *   8. 관리자 변경 이력 (기획자 결정 2026-11-02 C-2): 모든 영역의 변경 기록과 점검 기록, 저절로 풀린 역할. 감사 열람이 보는 곳. 보기만, 한 쪽 20건
 * 접속 기록 만들기와 설정 변경 묶음은 control-checks.js(설정 변경 확인, 통계의 통제 증빙 내보내기와 함께 씀)
 * 프로토타입: 접속 기록은 예시 데이터(계정의 로그인 일시, 결재 기록, 관리자 변경 이력, 이상 행위 알림)로 만든 일부입니다.
 *   실제 시스템은 서버가 모든 기록을 고치거나 지울 수 없게 영구 보관하고, 이 화면을 연 것도 기록합니다.
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const X = window.CLIMB_CTL;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  // 기획자 결정 2026-11-02 C-2: 감사 열람도 들어와 보기만 함. 끝나는 날이 지난 감사 열람은 hasRole이 false라 들어오지 못함
  if (!C.gate(me, ['PRIVACY', 'AUDIT'], '접속 기록 점검은 정보보호 담당자가 합니다',
    '관리자가 자기 작업 기록을 스스로 점검하지 않도록 관리자도 이 화면을 볼 수 없습니다(지금은 ' + esc(C.roleLabel(me.role)) + ' 역할로 보고 있습니다). ' +
    '화면 맨 위 검은 띠에서 정보보호 담당자, 감사 열람, 최고관리자 가운데 하나로 바꾸면 볼 수 있습니다.')) return;

  /* 누가 무엇을 남기는지 (기획자 결정 2026-11-02 C-2, C-6)
   *   감사 열람(읽기만 하는 역할): 보기만. 어느 표에도 단추를 그리지 않음
   *   정보보호(담당자, 리더): 알림 확인, 매월 점검, 최고관리자 작업 점검, 분기 검토, 유닛 리더에게 계정 목록 보내기
   *   최고관리자: 시연으로 알림 확인과 매월 점검을 남기되 자기 작업이 든 달과 자기에 대한 알림은 못함.
   *     최고관리자 작업 점검과 분기 검토(자기 계정과 자기가 준 권한이 늘 듦)는 못함. 못 하는 곳에는 누를 수 없는 단추와 짧은 까닭 */
  const readOnly = C.isReadOnly(me);
  const isPrivacy = !readOnly && C.hasRole(me, ['PRIVACY']);
  const isSuper = !readOnly && me.role === 'SUPER';
  if (readOnly || isSuper) {
    $('#intro-role').textContent = readOnly ? '감사 열람 역할은 이 화면을 보기만 합니다. 확인과 결과는 정보보호 담당자가 남깁니다.'
      : '최고관리자는 모든 기록을 보지만, 자기 작업이 든 매월 점검과 분기 검토, 최고관리자 작업 점검은 남기지 못합니다. 정보보호 담당자가 남깁니다.';
    $('#intro-role').hidden = false;
  }
  if (!isPrivacy) $('#btn-send').remove(); // 유닛 리더에게 계정 목록 보내기(C-7)는 정보보호만. 역할은 화면을 여는 동안 바뀌지 않아 자리가 흔들리지 않음

  const PAGE_SIZE = 20;
  const START_MONTH = D.SERVICE_START_MONTH; // 이 시스템을 쓰기 시작한 달 (mock-data.js)
  function val(f, n) { return (f.elements[n].value || '').trim(); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function lastDay(y, m) { return y + '-' + pad(m) + '-' + pad(new Date(y, m, 0).getDate()); } // m: 1~12
  function monthLabel(ym) { return ym.slice(0, 4) + '년 ' + Number(ym.slice(5, 7)) + '월'; }
  // 표의 일시: 날짜와 시각을 각각 한 줄로("2026-" 뒤에서 끊기지 않게, 관리자 변경 이력과 같음)
  function dt(at) { return C.fmtDateTime(at).split(' ').map(function (s) { return '<span class="keep">' + s + '</span>'; }).join(' '); }
  const THIS_MONTH = D.TODAY.slice(0, 7);
  // 표 안 단추 뒤에 붙이는 줄 이름: 줄마다 같은 "결과 남기기"라 화면낭독기가 어느 줄인지 알게 함. 보이는 글이 이름의 앞에 오게 뒤에 붙임(2026-11-06 점검)
  function rowName(t) { return '<span class="sr-only"> ' + esc(t) + '</span>'; }
  // 누를 수 없는 단추와 짧은 까닭 (C-6). row: 줄 이름(화면낭독기용, 2026-11-06 점검)
  function offBtn(label, why, row) { return '<button type="button" class="link-act" disabled>' + esc(label) + (row ? rowName(row) : '') + '</button><span class="cell-meta">' + esc(why) + '</span>'; }

  // 이 화면을 연 것도 접속 기록에 남음 (REQ-ADM-18). 시연에서는 화면을 열 때마다 한 줄
  const OPENED = C.nowStamp();
  // 열람 제한 계약을 볼 수 없는 사람(C.canView)에게는 기록 대상의 고객사 이름을 빼고 계약번호만 보임(2026-11-06 점검, REQ-AUTH-09)
  //   예전에 "계약번호 고객사"로 남은 기록(이 브라우저의 시연 기록 포함)도 가림. 검색어로도 이름이 걸리지 않게 거르기 전에 바꿈
  const hidden = D.CONTRACTS.filter(function (c) { return c.id && c.restricted && !C.canView(c, me); });
  function hideName(t) {
    if (!t) return t;
    return hidden.reduce(function (s, c) { return s.split(c.id + ' ' + c.counterparty).join(c.id); }, t);
  }
  function buildLogs() {
    return X.accessLogs([{ at: OPENED, userId: me.id, act: 'VIEW', target: '접속 기록 점검 화면' }])
      .map(function (l) { return Object.assign({}, l, { target: hideName(l.target) }); });
  }
  let logs = buildLogs();

  /* ---------- 1. 이상 행위 알림 ---------- */
  function alertAction(a) {
    if (readOnly || (!isPrivacy && !isSuper)) return '-';
    const row = C.fmtDateTime(a.at) + ' ' + C.ownerLabel(a.userId); // 줄 이름: 일시와 사람(2026-11-06 점검)
    if (a.userId === me.id) return offBtn('결과 남기기', '본인 알림', row); // 자기에 대한 알림은 다른 사람이 확인(C-6과 같은 원칙)
    return '<button type="button" class="link-act" data-alert="' + esc(a.id) + '">결과 남기기' + rowName(row) + '</button>';
  }
  function renderAlerts() {
    const open = D.SEC_ALERTS.filter(function (a) { return a.status === 'OPEN'; }).length;
    $('#alert-count').innerHTML = open ? C.badge('danger', '확인 전 ' + open + '건') : C.badge('line', '모두 확인');
    const list = D.SEC_ALERTS.slice().sort(function (a, b) { return (a.status === 'OPEN' ? 0 : 1) - (b.status === 'OPEN' ? 0 : 1) || b.at.localeCompare(a.at); });
    $('#alert-rows').innerHTML = list.map(function (a) {
      const done = a.status === 'DONE';
      return '<tr' + (done ? '' : ' class="is-alert"') + '><td class="num-left">' + C.fmtDateTime(a.at) + '</td>' +
        '<td class="center cell-phone-nowrap"><span class="cell-strong">' + esc(C.ownerLabel(a.userId)) + '</span></td>' +
        '<td><span class="cell-strong">' + esc(D.SEC_ALERT_KINDS[a.kind]) + '</span><span class="cell-meta">' + esc(a.detail) + '</span>' +
          (done ? '<span class="cell-meta">결과: ' + esc(a.action) + ' (' + esc(C.ownerLabel(a.doneBy)) + ', ' + C.fmtDateTime(a.doneAt) + ')</span>' : '') + '</td>' +
        '<td class="nowrap">' + (done ? C.badge('success', '확인함') : C.badge('danger', '확인 전')) + '</td>' +
        '<td class="col-action">' + (done ? '-' : alertAction(a)) + '</td></tr>';
    }).join('');
  }
  function openAlert(id) {
    const a = D.SEC_ALERTS.filter(function (x) { return x.id === id; })[0];
    C.formModal({
      title: '이상 행위 알림을 확인했나요?',
      desc: '저장하면 확인한 사람, 일시, 결과가 남고 알림이 "확인함"으로 바뀝니다.',
      body: '<p class="modal-info">' + esc(C.ownerLabel(a.userId)) + ', ' + C.fmtDateTime(a.at) + ', ' + esc(D.SEC_ALERT_KINDS[a.kind]) + ': ' + esc(a.detail) + '</p>' +
        C.fieldHtml({ name: 'act', label: '확인 결과와 조치', type: 'textarea', required: true,
          placeholder: '예: 본인에게 확인. 분기 결산 자료 준비로 열람, 업무 목적 맞음. 조치 없음', help: '본인 확인 결과, 업무 목적인지, 한 조치(권한 회수, 교육 등)를 적습니다.' }),
      btn: '확인 결과 저장',
      check: function (f) { return { act: val(f, 'act') ? '' : '확인 결과와 조치를 적으세요.' }; },
      done: function (f) {
        C.adminSave('AUDIT', '이상 행위 알림 ' + a.id + ' (' + C.ownerLabel(a.userId) + ')', '확인함: ' + D.SEC_ALERT_KINDS[a.kind], val(f, 'act'), { k: 'ALERT_DONE', id: a.id, action: val(f, 'act') });
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
  //   word: 점검(매월) 또는 검토(분기) / action: 관리 칸(남기기 전이고 기간이 끝났을 때만 보임) / sub: 확인한 내용 칸 아래 작은 줄
  function reviewRow(label, due, rec, ended, action, notYet, word, sub) {
    const late = !rec && ended && D.TODAY > due;
    const body = rec ? esc(rec.note) + (rec.action ? '<span class="cell-meta">조치: ' + esc(rec.action) + '</span>' : '') +
        // 점검(검토) 때 창에서 본 자료를 함께 남김(v0.63, 표준 대응표 G-23 ③). 예시 기록처럼 없으면 보이지 않음
        (rec.seen ? '<details class="seen-data"><summary>' + word + ' 때 본 자료</summary><p class="cell-meta">' + esc(rec.seen) + '</p></details>' : '')
      : ended ? '' : esc(notYet);
    return '<tr' + (late ? ' class="is-alert"' : '') + '><td class="nowrap cell-strong">' + esc(label) + '</td>' +
      '<td class="num-left nowrap">' + C.fmtDate(due) + (late ? '<span class="cell-meta">기한 지남</span>' : '') + '</td>' +
      '<td class="center">' + (rec ? esc(C.ownerLabel(rec.by)) + '<span class="cell-meta">' + C.fmtDateTime(rec.at) + '</span>' : '-') + '</td>' +
      '<td class="nowrap">' + (rec ? resultBadge(rec) : ended ? C.badge('line', word + ' 전') : C.badge('line', '예정')) + '</td>' +
      '<td>' + (body || sub ? body + (sub || '') : '-') + '</td>' +
      '<td class="col-action">' + (!rec && ended ? action : '-') + '</td></tr>';
  }
  // 그달 이 사람이 한 일(최고관리자가 자기 작업이 든 달인지 볼 때, C-6)
  function selfCount(ym) { return logs.filter(function (l) { return l.userId === me.id && l.at.slice(0, 7) === ym; }).length; }
  function monthAction(x) {
    if (readOnly || (!isPrivacy && !isSuper)) return '-';
    if (isSuper) { const n = selfCount(x.ym); if (n) return offBtn('결과 남기기', '본인 작업 ' + n + '건', monthLabel(x.ym)); }
    return '<button type="button" class="link-act" data-month="' + x.ym + '">결과 남기기' + rowName(monthLabel(x.ym)) + '</button>'; // 줄 이름: 달(2026-11-06 점검)
  }
  function renderMonths() {
    $('#month-rows').innerHTML = months().map(function (x) {
      const rec = D.LOG_REVIEWS.filter(function (r) { return r.month === x.ym; })[0];
      return reviewRow(monthLabel(x.ym), x.due, rec, x.ended, monthAction(x), '이달이 끝난 뒤 점검', '점검',
        '<span class="cell-meta">' + esc(configSummary(x.ym)) + '</span>');
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
  // 그달 설정 변경 요약 (C-8): 영역마다 건수와 확인 기다림(가격과 제품은 재무 리더, 표준계약서는 법무)
  function configSummary(ym) {
    const list = X.settingChanges({ month: ym });
    if (!list.length) return '설정 변경 없음';
    const by = {};
    list.forEach(function (x) { by[x.area] = (by[x.area] || 0) + 1; });
    const wait = list.filter(function (x) { return X.needsCheck(x) && !X.checkOf(x.id); });
    const waitFin = wait.filter(function (x) { return x.area !== 'TEMPLATE'; }).length, waitLegal = wait.length - waitFin;
    return '설정 변경 ' + list.length + '건(' + Object.keys(X.AREA_SET).filter(function (k) { return by[k]; }).map(function (k) { return X.AREA_SET[k] + ' ' + by[k] + '건'; }).join(', ') + '), ' +
      (wait.length ? '확인 기다림 ' + wait.length + '건(' + [waitFin ? '재무 리더 ' + waitFin + '건' : '', waitLegal ? '법무 ' + waitLegal + '건' : ''].filter(Boolean).join(', ') + ')' : '확인할 것 모두 확인함');
  }
  function resultFields(okLabel) {
    return '<fieldset class="field" data-field="result"><legend class="field-label">결과<span class="req" aria-hidden="true">*</span><span class="sr-only">(필수)</span></legend>' +
        '<div class="choice-row"><label class="choice"><input type="radio" name="result" value="OK">' + esc(okLabel) + '</label>' +
        '<label class="choice"><input type="radio" name="result" value="ACTION">조치함</label></div><p class="field-error" hidden></p></fieldset>' +
      C.fieldHtml({ name: 'note', label: '확인한 내용', type: 'textarea', required: true }) +
      // 조치는 "조치함"을 고를 때만 필수. 처음엔 (선택)으로 보이고, 조치함을 고르면 필수 표시로 바꿈(wireAct, 2026-11-06 점검 3회차)
      C.fieldHtml({ name: 'act', label: '조치', type: 'textarea', optional: true, help: '조치함을 고르면 꼭 적습니다. 예: 퇴사자 계정 사용 중지 요청(관리자, 2026-10-02 처리)' })
        .replace(' <span class="opt">', '<span class="req" aria-hidden="true" hidden>*</span><span class="sr-only act-sr" hidden>(필수)</span> <span class="opt">');
  }
  // 결과를 고를 때마다 조치 칸 이름의 필수 표시를 바꿈. 계약 등록의 사용 업체 칸과 같은 방식(new-contract.js syncOrg, 2026-11-06 점검 3회차)
  function wireAct(f) {
    const box = f.querySelector('[data-field="act"]');
    const sync = function () {
      const r = f.querySelector('[name="result"]:checked');
      const need = !!(r && r.value === 'ACTION');
      box.querySelector('.req').hidden = !need;
      box.querySelector('.act-sr').hidden = !need;
      box.querySelector('.opt').hidden = need;
      if (!need) C.setFieldError(box, ''); // 이상 없음으로 바꾸면 앞의 "조치를 적으세요"는 맞지 않으므로 지움
    };
    f.querySelectorAll('[name="result"]').forEach(function (x) { x.addEventListener('change', sync); });
    sync();
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
    // 창과 남기는 자료: 기록 수, 설정 변경 요약(C-8), 최고관리자 작업 요약(C-6. 결과는 따로 남김)
    const lines = [monthStats(ym), configSummary(ym), superSummary(ym)];
    C.formModal({
      title: monthLabel(ym) + ' 기록 점검 결과를 남길까요?',
      desc: '저장하면 점검한 사람과 일시, 결과가 남고 고칠 수 없습니다.',
      body: '<div class="modal-info"><ul class="summary-list">' + lines.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') +
        '<li>설정 변경과 최고관리자 작업의 자세한 목록은 화면의 "설정 변경", "최고관리자 작업" 묶음에서 봅니다.</li></ul></div>' + resultFields('이상 없음'),
      btn: '점검 결과 저장',
      open: function (f) { wireAct(f); f.elements.note.placeholder = '예: 접속 기록과 내려받기 기록 확인. 업무 시간 밖 접속은 모두 결재 처리로 확인함'; },
      check: checkResult,
      done: function (f) {
        const r = { month: ym, result: f.querySelector('[name="result"]:checked').value, note: val(f, 'note'), action: val(f, 'act'), seen: lines.join(' / ') };
        C.adminSave('AUDIT', monthLabel(ym) + ' 기록 점검', '결과: ' + (r.result === 'OK' ? '이상 없음' : '조치함'), r.note + (r.action ? ' / 조치: ' + r.action : ''), { k: 'LOG_REVIEW', r: r });
        refresh();
        C.toast(monthLabel(ym) + ' 기록 점검 결과를 남겼습니다.');
      },
    });
  }

  /* ---------- 3. 최고관리자 작업 (기획자 결정 2026-11-02 C-6, G-24 ②) ----------
   * 그달 최고관리자 계정(X.superIds)이 한 모든 일. 매월 점검과 따로 정보보호 담당자(담당자, 리더)만 결과를 남김. 기한은 매월 점검과 같음
   * 결과는 관리자 변경 이력의 점검 기록(AUDIT, op.k SUPER_REVIEW)에 쌓기만 함. 그때 본 자료(seen)도 함께 */
  function superReviews() {
    return D.ADMIN_LOG.filter(function (e) { return e.op && e.op.k === 'SUPER_REVIEW'; })
      .map(function (e) { return Object.assign({ by: e.by, at: e.at }, e.op.r); });
  }
  function superLogs(ym) {
    const ids = X.superIds();
    return logs.filter(function (l) { return ids.indexOf(l.userId) > -1 && l.at.slice(0, 7) === ym; });
  }
  // 한 일마다 건수: "로그인 3건, 설정 변경 9건"
  function actCounts(list) {
    const by = {};
    list.forEach(function (l) { by[l.act] = (by[l.act] || 0) + 1; });
    return Object.keys(X.ACTS).filter(function (k) { return by[k]; }).map(function (k) { return X.ACTS[k] + ' ' + by[k] + '건'; }).join(', ');
  }
  function superSummary(ym) {
    const n = superLogs(ym).length, rec = superReviews().filter(function (r) { return r.month === ym; })[0];
    return '최고관리자 작업 ' + n + '건(' + (rec ? '정보보호 점검함: ' + C.ownerLabel(rec.by) + ', ' + C.fmtDate(rec.at) : '정보보호 점검 전') + ')';
  }
  function superAction(x) {
    if (readOnly) return '-';
    // 줄 이름: 달(2026-11-06 점검)
    if (isPrivacy) return '<button type="button" class="link-act" data-super="' + x.ym + '">결과 남기기' + rowName(monthLabel(x.ym)) + '</button>';
    return isSuper ? offBtn('결과 남기기', '정보보호만 남김', monthLabel(x.ym)) : '-';
  }
  function renderSuper() {
    const recs = superReviews();
    $('#super-rows').innerHTML = months().map(function (x) {
      const rec = recs.filter(function (r) { return r.month === x.ym; })[0], list = superLogs(x.ym);
      return reviewRow(monthLabel(x.ym), x.due, rec, x.ended, superAction(x), '이달이 끝난 뒤 점검', '점검',
        '<span class="cell-meta">최고관리자 작업 ' + list.length + '건' + (list.length ? ': ' + esc(actCounts(list)) : '') + '</span>');
    }).join('');
  }
  function openSuper(ym) {
    const list = superLogs(ym);
    const seen = monthLabel(ym) + ' 최고관리자 작업 ' + list.length + '건' + (list.length ? '(' + actCounts(list) + ')' : '');
    C.formModal({
      title: monthLabel(ym) + ' 최고관리자 작업 점검 결과를 남길까요?',
      desc: '저장하면 점검한 사람과 일시, 결과가 남고 고칠 수 없습니다.',
      body: '<div class="modal-info"><ul class="summary-list"><li>' + esc(seen) + '</li><li>최고관리자의 작업은 정보보호 담당자만 점검합니다. 업무 목적이 맞는지, 결재 단계를 처리하지 않았는지 봅니다.</li></ul></div>' +
        '<div class="tbl-scroll" tabindex="0" role="region" aria-label="최고관리자 작업 표"><table class="tbl tbl--compact">' +
          '<caption class="sr-only">최고관리자 작업: 일시, 사람, 한 일, 대상</caption>' +
          '<thead><tr><th scope="col">일시</th><th scope="col">사람</th><th scope="col">한 일</th><th scope="col">대상</th></tr></thead><tbody>' +
          (list.length ? list.map(function (l) {
            return '<tr><td class="num-left">' + dt(l.at) + '</td><td class="center">' + esc(C.ownerLabel(l.userId)) + '</td><td class="nowrap">' + esc(X.ACTS[l.act]) + '</td><td>' + esc(l.target) + '</td></tr>';
          }).join('') : '<tr><td class="empty-row" colspan="4">이달 최고관리자 작업이 없습니다.</td></tr>') + '</tbody></table></div>' +
        resultFields('이상 없음'),
      btn: '점검 결과 저장',
      open: function (f) { wireAct(f); f.elements.note.placeholder = '예: 9월 1일 시스템 도입 설정과 감사 열람 부여 1건 확인. 결재 단계 처리 없음'; },
      check: checkResult,
      done: function (f) {
        const r = { month: ym, result: f.querySelector('[name="result"]:checked').value, note: val(f, 'note'), action: val(f, 'act'), seen: seen };
        C.adminSave('AUDIT', monthLabel(ym) + ' 최고관리자 작업 점검', '결과: ' + (r.result === 'OK' ? '이상 없음' : '조치함'), r.note + (r.action ? ' / 조치: ' + r.action : ''), { k: 'SUPER_REVIEW', r: r });
        refresh();
        C.toast(monthLabel(ym) + ' 최고관리자 작업 점검 결과를 남겼습니다.');
      },
    });
  }

  /* ---------- 4. 설정 변경 (기획자 결정 2026-11-02 C-8, G-12) ----------
   * 대상 월(기본: 가장 최근에 끝난 달, 매월 점검 대상)과 영역으로 거름. 한 쪽 20건(C.pagerHtml)
   * 다시 본 것: 가격과 제품은 재무 리더, 표준계약서는 법무의 확인(설정 변경 확인 SCR-65), 결재선 규칙은 기안자 유닛과의 관계, 회사 설정은 이 점검에서 봄 */
  let cfgPage = 1;
  (function () {
    const ms = months();
    const first = ms.filter(function (x) { return x.ended; })[0] || ms[0];
    $('#cfg-month').innerHTML = ms.map(function (x) { return '<option value="' + x.ym + '"' + (x === first ? ' selected' : '') + '>' + monthLabel(x.ym) + '</option>'; }).join('');
    $('#cfg-area').innerHTML = '<option value="">전체</option>' + Object.keys(X.AREA_SET).map(function (k) { return '<option value="' + k + '">' + esc(X.AREA_SET[k]) + '</option>'; }).join('');
  })();
  // 가격 기준을 여러 기능에 함께 넣은 건은 기능마다 전후 값을 접어 둠
  function itemsHtml(x) {
    if (!x.items || x.items.length < 2) return '';
    return '<details class="seen-data"><summary>기능마다 보기</summary><ul class="summary-list cell-meta">' + x.items.map(function (it) {
      return '<li>' + esc(it.label) + ': ' + esc((it.before ? it.before + ' → ' : '처음 넣음: ') + it.after) + ' (' + C.fmtDate(it.from) + '부터)</li>';
    }).join('') + '</ul></details>';
  }
  function basisHtml(x) {
    if (x.area === 'PRICE') return '<span class="cell-meta">품의 ' + (X.docLink(x) || '링크 없음') + '</span>';
    if (x.area === 'PRODUCT') return '<span class="cell-meta">품의 링크 칸 없음(사유를 봄)</span>';
    if (x.area === 'RULE') return '<span class="cell-meta">위임전결 근거: ' + esc(x.basis) + '</span>';
    return '';
  }
  function reviewedHtml(x) {
    if (X.needsCheck(x)) {
      const k = X.checkOf(x.id), who = X.checkerLabel(x.area);
      return k ? C.badge(k.result === 'MATCH' ? 'success' : 'attention', k.label) + '<span class="cell-meta">' + esc(who + ' ' + C.ownerLabel(k.by) + ', ' + C.fmtDateTime(k.at)) + '</span>' +
          (k.note ? '<span class="cell-meta">' + esc(k.note) + '</span>' : '')
        : C.badge('line', '확인 전') + '<span class="cell-meta">' + esc(who) + '가 설정 변경 확인에서 봄</span>';
    }
    // 결재선 규칙: 담당자 바꾸기와 대리 지정은 새로 맡는 사람과 기안자 유닛과의 관계. 처음 설정, 기준, 근거 같은 그 밖의 변경은 사유와 근거만 봄
    if (x.area === 'RULE') return x.unit ? esc(x.unit) + '<span class="cell-meta">새로 맡는 사람 ' + esc(C.ownerLabel(x.person)) + '</span>' : '<span class="cell-meta">한 사람에게 맡기는 변경이 아님(사유와 근거를 봄)</span>';
    return '<span class="cell-meta">이 점검에서 봄</span>';
  }
  function renderConfig() {
    const ym = $('#cfg-month').value, area = $('#cfg-area').value;
    const list = X.settingChanges({ month: ym, areas: area ? [area] : null });
    const wait = list.filter(function (x) { return X.needsCheck(x) && !X.checkOf(x.id); }).length;
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (cfgPage > pages) cfgPage = pages;
    const from = (cfgPage - 1) * PAGE_SIZE, rows = list.slice(from, from + PAGE_SIZE);
    $('#cfg-count').innerHTML = C.meta([[esc(monthLabel(ym)), '<strong>' + list.length + '건</strong>'], ['확인 기다림', wait + '건']]);
    $('#cfg-rows').innerHTML = rows.length ? rows.map(function (x) {
      return '<tr><td class="num-left">' + dt(x.at) + '</td>' +
        '<td><span class="cell-strong">' + esc(x.target) + '</span><span class="cell-meta">' + esc(X.AREA_SET[x.area]) + '</span></td>' +
        '<td>' + esc(x.change) + itemsHtml(x) + '</td>' +
        '<td>' + esc(x.reason || '-') + basisHtml(x) + '</td>' +
        '<td class="center">' + esc(C.ownerLabel(x.by)) + '</td>' +
        '<td>' + reviewedHtml(x) + '</td></tr>';
    }).join('') : '<tr><td class="empty-row" colspan="6">이달 바꾼 설정이 없습니다.</td></tr>';
    $('#cfg-pagination').innerHTML = C.pagerHtml(cfgPage, pages, list.length, from, rows.length, PAGE_SIZE, '건');
  }

  /* ---------- 5. 분기 권한 검토 ---------- */
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
  // C-6: 분기 검토에는 최고관리자 자기 계정(관리자 권한 줄)과 자기가 준 권한(감사 열람 등)이 늘 들어 있어 최고관리자는 남기지 못함
  function quarterAction(x) {
    if (readOnly) return '-';
    // 줄 이름: 분기(2026-11-06 점검)
    if (isPrivacy) return '<button type="button" class="link-act" data-quarter="' + x.key + '">결과 남기기' + rowName(x.label) + '</button>';
    return isSuper ? offBtn('결과 남기기', '본인 계정이 듦', x.label) : '-';
  }
  function renderQuarters() {
    $('#quarter-rows').innerHTML = quarters().map(function (x) {
      const rec = D.ACCESS_REVIEWS.filter(function (r) { return r.quarter === x.key; })[0];
      return reviewRow(x.label, x.due, rec, x.ended, quarterAction(x), '분기가 끝난 뒤 검토', '검토');
    }).join('');
  }
  // 이 분기에 실제로 걸쳐 있던 대리 지정 (v0.63, 통제와 표준 대응표 G-23 ②): 누가 누구 대신 결재할 수 있었는지 분기마다 봄.
  //   일찍 끝낸 지정은 끝낸 날까지, 시작하기 전에 끝낸(취소한) 지정은 뺌
  function quarterDelegations(q) {
    return D.DELEGATIONS.filter(function (d) {
      const end = d.endedAt && d.endedAt.slice(0, 10) < d.to ? d.endedAt.slice(0, 10) : d.to;
      return end >= d.from && d.from <= q.end && end >= q.start;
    });
  }
  // 기획자 결정 2026-11-02 C-2: 감사 열람 계정은 그 분기 첫날부터 오늘까지 하루라도 걸친 것(검토하는 때의 것까지 봄)
  function grantsOf(q) { return C.auditGrants({ from: q.start, to: D.TODAY }); }
  // 기획자 결정 2026-11-02 C-7: 그 분기에 유닛 리더에게 계정 목록을 보낸 기록(최근 것부터)
  function sendsOf(q) {
    return D.ADMIN_LOG.filter(function (e) { return e.op && e.op.k === 'UNIT_LIST_SENT' && e.op.r && e.op.r.quarter === q.key; })
      .map(function (e) { return Object.assign({ by: e.by, at: e.at }, e.op.r); })
      .sort(function (a, b) { return b.at.localeCompare(a.at); });
  }
  const ZWSP = new RegExp(String.fromCharCode(0x200b), 'g'); // C.fmtPeriod가 물결표 뒤에 넣는 폭 없는 빈칸
  function plain(s) { return String(s).replace(ZWSP, ''); } // 기간 글의 폭 없는 빈칸을 뺀 글(남기는 자료용)
  // 권한 검토 자료: 계정 현황, 관리자 권한, 권한을 바꾼 기록과 사유 (REQ-SEC-05, 기획자 결정 v0.25: 분기 검토에서 사유 확인)
  //   줄마다 글자로 돌려줌: 창에 보이고, 저장할 때 "검토 때 본 자료"로 함께 남김 (v0.63, G-23 ③: 계산값이라 나중에 다시 만들 수 없으므로)
  //   기획자 결정 2026-11-02: 감사 열람 계정(C-2), 지정 열람자(C-2), 역할 충돌 계정(C-5), 유닛 리더에게 보낸 계정 목록(C-7)을 더함
  //   [가정, 기획자 확인 필요] 2026-11-03 C-44: 영업대표가 바뀐 열람 제한 계약의 앞 기안자(기안자로 남은 계약을 계속 보므로)를 더함
  function accessLines(q) {
    const acc = D.ACCOUNTS;
    const count = function (s) { return acc.filter(function (a) { return a.status === s; }).length; };
    const admins = acc.filter(function (a) { return a.status !== 'SUSPENDED' && (a.roles.indexOf('ADMIN') > -1 || a.roles.indexOf('SUPER') > -1); });
    // 지난 권한 검토 뒤(처음이면 이 시스템을 쓰기 시작한 때부터) 오늘까지 권한을 바꾼 기록. 끝나는 날이 지나 저절로 풀린 감사 열람도 셈(C-2)
    const last = D.ACCESS_REVIEWS.slice().sort(function (a, b) { return b.at.localeCompare(a.at); })[0];
    const since = last ? last.at : START_MONTH + '-01';
    const changes = C.adminLog(['USER']).concat(C.roleEndLog()).filter(function (e) { return e.at > since; });
    const stopped = acc.filter(function (a) { return a.status === 'SUSPENDED'; });
    const noReason = changes.filter(function (e) { return !e.reason; }).length;
    const idle = acc.filter(function (a) { return a.status === 'ACTIVE' && a.lastLoginAt && C.daysBetween(new Date(a.lastLoginAt.slice(0, 10)), new Date(D.TODAY)) > 90; });
    const dels = quarterDelegations(q);
    const who = function (a) { return (a.dept ? a.dept + ' ' : '') + a.name; };
    const grants = grantsOf(q), viewers = C.designatedViewersAll(), conflicts = C.conflictAccounts(), sends = sendsOf(q);
    const vState = function (s) { return viewers.filter(function (v) { return v.state === s; }).length; };
    const blocked = viewers.filter(function (v) { return v.blocked && v.state === 'ON'; }).length;
    const firstViews = C.firstDrafterViews(); // [가정] 2026-11-03 C-44 영업대표가 바뀐 열람 제한 계약의 앞 기안자
    return [
      '계정 ' + acc.length + '개: 사용 중 ' + count('ACTIVE') + '개, 첫 접속 전 ' + count('INVITED') + '개, 사용 중지 ' + count('SUSPENDED') + '개',
      '관리자 권한(관리자, 최고관리자) ' + admins.length + '명: ' + admins.map(who).join(', '),
      (last ? '지난 검토(' + C.fmtDate(last.at) + ') 뒤' : C.fmtDate(since) + '부터') + ' 권한을 바꾼 기록 ' + changes.length + '건: ' +
        (noReason ? '사유 없는 기록 ' + noReason + '건' : '모두 사유가 있음') + ' (사용자 권한 관리의 권한 변경 이력)',
      '사용 중지 계정 ' + stopped.length + '개' + (stopped.length ? ': ' + stopped.map(who).join(', ') : ''),
      '90일 넘게 로그인하지 않은 사용 중 계정 ' + idle.length + '개' + (idle.length ? ': ' + idle.map(who).join(', ') : ''),
      '이 분기에 걸친 대리 지정 ' + dels.length + '건' + (dels.length ? ': ' + dels.map(function (d) {
        // 사람 이름에는 "님"을 붙이지 않음(머리글 이름과 개요 인사말만, 01 2장 이름 표기 v0.51)
        //   "원래 담당자 대신 대신할 사람(기간)": 항목 안에 쉼표를 쓰지 않아 항목 경계가 보이게 (v0.63 검토)
        return C.ownerLabel(d.absentId) + ' 대신 ' + C.ownerLabel(d.delegateId) + '(' + plain(C.fmtPeriod(d.from, d.to)) + (d.endedAt ? ' 일찍 끝냄' : '') + ')';
      }).join(', ') : '') + ' (결재선 규칙의 대리 지정)',
      // C-2: 감사 열람은 최고관리자만 끝나는 날을 정해 줌. "누구(기간 상태 요청한 사람)"
      '감사 열람 ' + grants.length + '건' + (grants.length ? ': ' + grants.map(function (g) {
        return g.who + '(' + plain(C.fmtPeriod(g.from, g.end)) + ' ' + g.stateLabel + (g.requestedBy ? ' 요청 ' + C.ownerLabel(g.requestedBy) : '') + ')';
      }).join(', ') : '') + ' (사용자 권한 관리에서 최고관리자가 줌)',
      // C-2: 지정 열람자는 끝나는 날이 없어 분기마다 다시 봄
      '지정 열람자 ' + viewers.length + '건: 지정 중 ' + vState('ON') + '건, 풀림 ' + vState('RELEASED') + '건, 뺌 ' + vState('REMOVED') + '건' +
        (blocked ? ', 관찰자라 보지 못함 ' + blocked + '건' : '') + ' (열람 제한 관리)',
      // [가정, 기획자 확인 필요] 2026-11-03 C-44: 영업대표가 바뀐 뒤에도 그 묶음 계약을 기안한 사람은 기안자로 남은 계약을 계속 보므로 분기마다 봄(C.firstDrafterViews)
      //   원계약만 보던 것을 묶음의 모든 계약으로 고침(2026-11-03 검토). 묶음 번호만 쓰고 고객사 이름은 쓰지 않음. "묶음 번호 앞 기안자(사용 중지)"
      '영업대표가 바뀐 열람 제한 계약의 앞 기안자(그 묶음 계약을 기안한 사람) ' + firstViews.length + '건' + (firstViews.length ? ': ' + firstViews.map(function (x) {
        return x.bundleId + ' ' + C.ownerLabel(x.userId) + (x.suspended ? '(사용 중지)' : '');
      }).join(', ') : '') + ' (계약 상세의 영업대표 바뀐 기록)',
      // C-5: 역할 충돌 계정과 저장할 때 받은 까닭
      '역할 충돌 계정 ' + conflicts.length + '명' + (conflicts.length ? ': ' + conflicts.map(function (x) {
        return x.who + '(' + x.conflicts.map(function (y) { return y.text; }).join(', ') + ' ' + (x.accepted ? '까닭 있음' : '까닭 없음') + ')';
      }).join(', ') : ''),
      // C-7: 유닛 리더에게 계정 목록을 보냈는지(보내기만 함)
      '유닛 리더에게 보낸 계정 목록: ' + (sends.length ? C.fmtDateTime(sends[0].at) + ' ' + C.ownerLabel(sends[0].by) + ', 유닛 ' + sends[0].units.length + '곳' : '아직 보내지 않음'),
    ];
  }
  function accessSummary(q) {
    return '<ul class="summary-list">' + accessLines(q).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
  }
  function openQuarter(key) {
    const q = quarters().filter(function (x) { return x.key === key; })[0];
    C.formModal({
      title: q.label + ' 권한 검토 결과를 남길까요?',
      desc: '저장하면 검토한 사람과 일시, 결과가 남고 고칠 수 없습니다. 권한을 바꿔야 하면 관리자에게 요청하고 조치에 적습니다.',
      body: '<div class="modal-info">' + accessSummary(q) + '</div>' + resultFields('이상 없음'),
      btn: '검토 결과 저장',
      open: function (f) { wireAct(f); f.elements.note.placeholder = '예: 모든 계정의 권한이 하는 일에 맞음. 권한을 바꾼 기록 모두 사유 있음'; },
      check: checkResult,
      done: function (f) {
        const r = { quarter: key, result: f.querySelector('[name="result"]:checked').value, note: val(f, 'note'), action: val(f, 'act'), seen: accessLines(q).join(' / ') };
        C.adminSave('AUDIT', q.label + ' 권한 검토', '결과: ' + (r.result === 'OK' ? '이상 없음' : '조치함'), r.note + (r.action ? ' / 조치: ' + r.action : ''), { k: 'ACCESS_REVIEW', r: r });
        refresh();
        C.toast(q.label + ' 권한 검토 결과를 남겼습니다.');
      },
    });
  }

  /* ---------- 6. 분기 권한 검토 자료 (기획자 결정 2026-11-02 C-2, C-5, C-7) ----------
   * 고른 분기(기본: 가장 최근에 끝난 분기)의 검토 자료. 표마다 지금 상태를 보임(검토는 분기가 끝난 뒤 하므로 그때까지 바뀐 것을 함께 봄)
   * 지정 열람자의 열람 제한 계약은 이 사람이 볼 수 있을 때만 고객사 이름(C.canView), 아니면 "열람 제한 계약"과 번호만 */
  (function () {
    const qs = quarters(), first = qs.filter(function (x) { return x.ended; })[0] || qs[0];
    $('#q-pick').innerHTML = qs.map(function (x) { return '<option value="' + x.key + '"' + (x === first ? ' selected' : '') + '>' + esc(x.label) + '</option>'; }).join('');
  })();
  function pickedQuarter() { const k = $('#q-pick').value; return quarters().filter(function (x) { return x.key === k; })[0]; }
  const GRANT_TONE = { ON: 'progress', PLANNED: 'line', ENDED: 'neutral', WITHDRAWN: 'neutral', REPLACED: 'neutral' };
  const VIEWER_TONE = { ON: 'progress', RELEASED: 'neutral', REMOVED: 'neutral' };
  function empty(cols, text) { return '<tr><td class="empty-row" colspan="' + cols + '">' + esc(text) + '</td></tr>'; }
  function renderQData() {
    const q = pickedQuarter();
    $('#q-lines').innerHTML = accessLines(q).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
    // 감사 열람 계정 (C-2): 누가, 언제부터 언제까지, 왜, 누가 줬고 누가 요청했는지
    const grants = grantsOf(q);
    $('#grant-rows').innerHTML = grants.length ? grants.map(function (g) {
      return '<tr><td><span class="cell-strong">' + esc(g.who) + '</span><span class="cell-meta">' + esc(g.email) + '</span></td>' +
        '<td class="num-left">' + C.fmtPeriod(g.from, g.until) + (g.endedAt ? '<span class="cell-meta">' + C.fmtDate(g.endedAt) + ' 일찍 뺌</span>' : '') + '</td>' +
        '<td class="nowrap">' + C.badge(GRANT_TONE[g.state] || 'line', g.stateLabel) + '</td>' +
        '<td>' + esc(g.reason) + (g.endReason ? '<span class="cell-meta">뺀 사유: ' + esc(g.endReason) + '</span>' : '') + '</td>' +
        '<td class="center">' + esc(C.ownerLabel(g.by)) + '<span class="cell-meta">' + C.fmtDate(g.at) + '</span>' +
          (g.requestedBy ? '<span class="cell-meta">요청한 사람 ' + esc(C.ownerLabel(g.requestedBy)) + '</span>' : '') + '</td></tr>';
    }).join('') : empty(5, '이 분기부터 오늘까지 준 감사 열람이 없습니다.');
    // 지정 열람자 (C-2): 계약 묶음마다 지정한 조직과 사람, 지금 상태
    const viewers = C.designatedViewersAll();
    $('#viewer-rows').innerHTML = viewers.length ? viewers.map(function (v) {
      const c = D.CONTRACTS.filter(function (x) { return x.id === v.contractId; })[0];
      const see = c && C.canView(c, me);
      return '<tr><td>' + (see ? '<span class="cell-strong">' + esc(v.counterparty) + '</span>' : '<span class="cell-strong">' + C.icon('lock', 'sm') + '열람 제한 계약</span>') +
          '<span class="cell-meta">' + esc(v.contractId) + (see && v.restricted ? ' ' + C.icon('lock', 'sm') : '') + '</span></td>' +
        '<td>' + esc(v.label) + '<span class="cell-meta">' + (v.kind === 'DEPT' ? '조직' : '사람') + '</span>' +
          (v.blocked ? '<span class="cell-meta">관찰자라 보지 못함</span>' : '') + '</td>' +
        '<td class="nowrap">' + C.badge(VIEWER_TONE[v.state] || 'line', v.stateLabel) + '</td>' +
        '<td class="center">' + (v.by ? esc(C.ownerLabel(v.by)) : '-') + '<span class="cell-meta">' + C.fmtDate(v.at) + '</span></td>' +
        '<td>' + esc(v.reason || '-') + '</td></tr>';
    }).join('') : empty(5, '지정 열람자가 없습니다.');
    // 역할 충돌 계정 (C-5): 겹치는 일과 까닭(저장할 때 받은 마지막 까닭)
    const conflicts = C.conflictAccounts();
    $('#conflict-rows').innerHTML = conflicts.length ? conflicts.map(function (x) {
      return '<tr><td><span class="cell-strong">' + esc(x.who) + '</span><span class="cell-meta">' + esc(x.email) + '</span></td>' +
        '<td>' + esc(x.roles.map(C.roleLabel).join(', ')) + '</td>' +
        '<td>' + x.conflicts.map(function (y) { return esc(y.detail); }).join('<br>') + '</td>' +
        '<td>' + (x.accepted ? esc(x.accepted.reason || '-') + '<span class="cell-meta">' + esc(C.ownerLabel(x.accepted.by)) + ', ' + C.fmtDateTime(x.accepted.at) + '</span>'
          : C.badge('attention', '까닭 없음') + '<span class="cell-meta">저장할 때 까닭을 받지 않은 겹침</span>') + '</td></tr>';
    }).join('') : empty(4, '역할 충돌 계정이 없습니다.');
    // 유닛 리더에게 보낸 계정 목록 (C-7): 그 분기에 보낸 기록
    const sends = sendsOf(q);
    $('#send-rows').innerHTML = sends.length ? sends.map(function (s) {
      const leaders = s.units.map(function (u) { return u.to; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).length;
      const total = s.units.reduce(function (n, u) { return n + (u.n || 0); }, 0);
      return '<tr><td class="num-left">' + dt(s.at) + '</td><td class="center">' + esc(C.ownerLabel(s.by)) + '</td>' +
        '<td><details class="seen-data"><summary>유닛 ' + s.units.length + '곳, 리더 ' + leaders + '명</summary><ul class="summary-list cell-meta">' +
          s.units.map(function (u) { return '<li>' + esc(u.unit + ': ' + C.ownerLabel(u.to) + '(계정 ' + u.n + '개)') + '</li>'; }).join('') + '</ul></details></td>' +
        '<td class="num">' + total + '개</td></tr>';
    }).join('') : empty(4, '이 분기에는 아직 보내지 않았습니다.');
  }
  /* 유닛 리더에게 계정 목록 보내기 (C-7): 유닛마다 그 유닛 계정 목록(이름, 이메일, 역할, 상태, 마지막 로그인)을 리더에게 이메일로. 답은 받지 않음
   *   유닛: 사용 중지가 아닌 계정의 조직. 받는 리더 [가정]: 영업 유닛은 유닛별 리더 표, 그 밖은 그 조직의 리더나 임원 역할,
   *   없으면 상위 조직의 리더나 임원(예: 경영지원유닛 → 경영지원실의 재무 임원). 그래도 없으면 보내지 않고 "받을 리더 없음"
   *   분기가 끝난 뒤에만 보냄. 여러 번 보내면 한 줄씩 더 남음(쌓기만 함). 기록은 관리자 변경 이력의 점검 기록(AUDIT, op.k UNIT_LIST_SENT) */
  const LEAD_ROLES = ['HEAD', 'SA_LEAD', 'SEC_LEAD', 'CEM_LEAD', 'FIN_LEAD', 'EXEC', 'FIN_EXEC'];
  function leadIn(dept) {
    const a = D.ACCOUNTS.filter(function (x) { return x.status !== 'SUSPENDED' && x.dept === dept && C.activeRoles(x).some(function (r) { return LEAD_ROLES.indexOf(r) > -1; }); })[0];
    return a ? a.id : null;
  }
  function unitLeader(unit) {
    const lead = C.leaderAt(unit, '9999');
    if (lead) return lead;
    const own = leadIn(unit);
    if (own) return own;
    const code = D.CODES.filter(function (c) { return c.group === 'DEPT' && c.label === unit; })[0];
    const parent = code && code.parent ? D.CODES.filter(function (c) { return c.group === 'DEPT' && c.code === code.parent; })[0] : null;
    return parent ? leadIn(parent.label) : null;
  }
  function unitRows() {
    const live = D.ACCOUNTS.filter(function (a) { return a.status !== 'SUSPENDED' && a.dept; });
    const order = D.CODES.filter(function (c) { return c.group === 'DEPT'; }).map(function (c) { return c.label; });
    const units = live.map(function (a) { return a.dept; }).filter(function (u, i, arr) { return arr.indexOf(u) === i; })
      .sort(function (a, b) { return (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 99 : order.indexOf(b)); });
    return units.map(function (u) { return { unit: u, to: unitLeader(u), n: live.filter(function (a) { return a.dept === u; }).length }; });
  }
  function openSend() {
    const q = pickedQuarter();
    if (!q.ended) { C.toast(C.josa(q.label, '이', '가') + ' 끝난 뒤에 보냅니다.', true); return; }
    const rows = unitRows(), ok = rows.filter(function (r) { return r.to; }), none = rows.filter(function (r) { return !r.to; });
    const leaders = ok.map(function (r) { return r.to; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).length;
    const total = ok.reduce(function (n, r) { return n + r.n; }, 0);
    const prev = sendsOf(q).length;
    C.formModal({
      title: q.label + ' 계정 목록을 유닛 리더에게 보낼까요?',
      desc: '보내면 유닛마다 그 유닛 계정 목록을 리더에게 이메일로 보내고, 보낸 사람과 일시, 받은 리더가 남습니다. 답은 받지 않습니다.' + (prev ? ' 이 분기에 이미 ' + prev + '번 보냈고, 한 줄 더 남습니다.' : ''),
      body: '<div class="modal-info"><ul class="summary-list">' +
        ok.map(function (r) { return '<li>' + esc(r.unit + ': ' + C.ownerLabel(r.to) + '(계정 ' + r.n + '개)') + '</li>'; }).join('') +
        none.map(function (r) { return '<li>' + esc(r.unit + ': 받을 리더 없음(계정 ' + r.n + '개). 따로 전달합니다') + '</li>'; }).join('') +
        '<li>목록에 드는 것: 이름, 이메일, 지금 역할, 상태, 마지막 로그인. 리더가 보고 이상하면 관리자나 정보보호에 알립니다.</li></ul></div>',
      btn: '보내기',
      done: function () {
        C.adminSave('AUDIT', q.label + ' 유닛별 계정 목록', '유닛 리더 ' + leaders + '명에게 보냄(유닛 ' + ok.length + '곳, 계정 ' + total + '개)',
          '분기 권한 검토 때 유닛마다 계정 목록을 유닛 리더에게 보냄(답은 받지 않음)',
          { k: 'UNIT_LIST_SENT', r: { quarter: q.key, units: ok.map(function (r) { return { unit: r.unit, to: r.to, n: r.n }; }) } });
        refresh();
        C.toast('유닛 리더 ' + leaders + '명에게 계정 목록을 보냈습니다.');
      },
    });
  }

  /* ---------- 7. 접속 기록 조회 ---------- */
  $('#f-act').innerHTML = '<option value="">전체</option>' + Object.keys(X.ACTS).map(function (k) { return '<option value="' + k + '">' + esc(X.ACTS[k]) + '</option>'; }).join('');
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
    $('#list-count').innerHTML = C.meta([[(list.length !== logs.length ? '검색 결과' : '전체'), '<strong>' + list.length + '건</strong>'], '고치거나 지울 수 없음, 영구 보관']);
    $('#log-rows').innerHTML = rows.length ? rows.map(function (l) {
      return '<tr><td class="num-left">' + C.fmtDateTime(l.at) + '</td><td class="center cell-phone-nowrap">' + esc(C.ownerLabel(l.userId)) + '</td>' +
        '<td class="nowrap">' + esc(X.ACTS[l.act]) + '</td><td>' + esc(l.target) + '</td><td class="nowrap">' + esc(l.place) + '</td></tr>';
    }).join('') : '<tr><td class="empty-row" colspan="5">조건에 맞는 기록이 없습니다.</td></tr>';
    $('#pagination').innerHTML = C.pagerHtml(page, pages, list.length, from, rows.length, PAGE_SIZE, '건');
  }

  /* ---------- 8. 관리자 변경 이력 (기획자 결정 2026-11-02 C-2) ----------
   * 감사 열람은 관리자 화면(사용자 권한 관리 등)을 열지 않으므로 모든 관리자 변경 이력을 여기서 봄. 정보보호와 최고관리자도 봄. 보기만(단추 없음)
   * 모든 영역의 기록(C.adminLog) + 끝나는 날이 지나 저절로 풀린 역할(C.roleEndLog, 사용자 권한 관리의 권한 변경 이력과 같음). 최근 것부터
   * 대상 앞에 영역 이름(접속 기록 조회와 같은 이름, 점검 기록은 "점검 기록"). 영역과 글로 거름, 한 쪽 20건(REQ-ADM-04) */
  const ADM_AREA = Object.assign({}, X.AREA, { AUDIT: '점검 기록' });
  $('#adm-area').innerHTML = '<option value="">전체</option>' + Object.keys(ADM_AREA).map(function (k) { return '<option value="' + k + '">' + esc(ADM_AREA[k]) + '</option>'; }).join('');
  let admPage = 1;
  // 대상의 고객사 이름은 볼 수 있을 때만(hideName, 2026-11-06 점검)
  function admAll() {
    return C.adminLog().concat(C.roleEndLog()).map(function (e) { return Object.assign({}, e, { target: hideName(e.target) }); })
      .sort(function (a, b) { return b.at.localeCompare(a.at); });
  }
  function renderAdminLog() {
    const all = admAll(), area = $('#adm-area').value, q = $('#adm-q').value.trim().toLowerCase();
    const list = all.filter(function (e) {
      if (area && e.area !== area) return false;
      return !q || [e.target, e.change, e.reason, e.byLabel || C.ownerLabel(e.by)].join(' ').toLowerCase().indexOf(q) > -1;
    });
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (admPage > pages) admPage = pages;
    const from = (admPage - 1) * PAGE_SIZE;
    const rows = list.slice(from, from + PAGE_SIZE).map(function (e) { return Object.assign({}, e, { target: (ADM_AREA[e.area] ? ADM_AREA[e.area] + ': ' : '') + e.target }); });
    $('#adm-count').innerHTML = C.meta([[(list.length !== all.length ? '검색 결과' : '전체'), '<strong>' + list.length + '건</strong>'], '고치거나 지울 수 없음']);
    $('#adm-rows').innerHTML = C.adminHistoryHtml(rows, '관리자 변경 이력');
    $('#adm-pagination').innerHTML = C.pagerHtml(admPage, pages, list.length, from, rows.length, PAGE_SIZE, '건');
  }

  function refresh() {
    logs = buildLogs();
    renderAlerts();
    renderMonths();
    renderSuper();
    renderConfig();
    renderQuarters();
    renderQData();
    renderLogs();
    renderAdminLog(); // 이 화면에서 남긴 점검 기록도 바로 보이게(C-2)
  }
  $('#filter').addEventListener('input', function () { page = 1; renderLogs(); });
  // 검색 칸은 'input'이 이미 그렸으므로 'change'(칸을 떠날 때)에서 다시 그리지 않음. 다시 그리면 누르던 줄이나 쪽 번호가 바뀌어 클릭이 사라짐(2026-11-06 점검 4회차)
  $('#filter').addEventListener('change', function (e) { if (e.target.matches('input[type=search], input[type=text]')) return; page = 1; renderLogs(); });
  $('#filter').addEventListener('reset', function () { setTimeout(function () { page = 1; renderLogs(); }, 0); });
  $('#filter').addEventListener('submit', function (e) { e.preventDefault(); });
  $('#cfg-filter').addEventListener('change', function () { cfgPage = 1; renderConfig(); });
  $('#cfg-filter').addEventListener('submit', function (e) { e.preventDefault(); });
  $('#q-filter').addEventListener('change', renderQData);
  $('#q-filter').addEventListener('submit', function (e) { e.preventDefault(); });
  $('#adm-filter').addEventListener('input', function () { admPage = 1; renderAdminLog(); });
  $('#adm-filter').addEventListener('change', function (e) { if (e.target.matches('input[type=search], input[type=text]')) return; admPage = 1; renderAdminLog(); });
  $('#adm-filter').addEventListener('reset', function () { setTimeout(function () { admPage = 1; renderAdminLog(); }, 0); });
  $('#adm-filter').addEventListener('submit', function (e) { e.preventDefault(); });
  $('#content').addEventListener('click', function (e) {
    const doc = e.target.closest('[data-doc]');
    if (doc) { e.preventDefault(); C.toast('품의 문서(' + doc.getAttribute('data-doc') + ')는 사내 품의 시스템에서 열립니다(시안에서는 안내만).'); return; }
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.id === 'btn-send') openSend();
    else if (b.getAttribute('data-alert')) openAlert(b.getAttribute('data-alert'));
    else if (b.getAttribute('data-month')) openMonth(b.getAttribute('data-month'));
    else if (b.getAttribute('data-super')) openSuper(b.getAttribute('data-super'));
    else if (b.getAttribute('data-quarter')) openQuarter(b.getAttribute('data-quarter'));
    // 쪽 번호: 누른 단추가 다시 그려져 없어지므로 초점도 그 묶음 제목으로(2026-11-06 점검 3회차)
    else if (b.getAttribute('data-page') && b.closest('#cfg-pagination')) { cfgPage = Number(b.getAttribute('data-page')); renderConfig(); C.focusSection('#sec-config'); }
    else if (b.getAttribute('data-page') && b.closest('#adm-pagination')) { admPage = Number(b.getAttribute('data-page')); renderAdminLog(); C.focusSection('#sec-admin-log'); }
    else if (b.getAttribute('data-page')) { page = Number(b.getAttribute('data-page')); renderLogs(); C.focusSection('#sec-log'); }
  });
  refresh();
})();
