/* =====================================================================
 * SCR-44 연장 검토 화면 로직 (renewal.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-FLOW-20, REQ-ARC-07
 * 하는 일
 *   1. 주소의 원계약 번호로 묶음을 찾고 연장 검토를 할 수 있는지 확인
 *      (자동갱신이고 지금 유효한 계약이 계약 완료, 영업대표 본인(시연용 최고관리자 포함), 진행 중인 연장이나 해지 없음)
 *   2. 세 갈래: 그대로 자동갱신(짧은 기안) / 조건을 바꿔 연장(계약 등록으로) / 해지(해지 기안으로)
 *   3. 그대로 자동갱신은 새 계약 기간(영업이 입력, 시작일은 지금 종료일 다음 날로 미리 채움)과 이유를 받아
 *      -R 번호로 저장하고 결재 문서로 이동 (v0.25 기획자 결정: 기간은 따로 입력)
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const notice = function (title, body) {
    return '<div class="notice" role="status"><p class="notice-title">' + C.icon('alert') + esc(title) + '</p><p>' + body + '</p></div>';
  };
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function addDays(s, n) { const d = new Date(s.replace(/-/g, '/')); d.setDate(d.getDate() + n); return iso(d); }

  const origin = new URLSearchParams(location.search).get('origin');
  const found = D.CONTRACTS.find(function (c) { return c.id === origin; });
  const b = found ? C.bundleOf(C.rootOf(found)) : null;
  const back = b ? 'contract.html?id=' + encodeURIComponent(b.id) : 'expiring.html';
  C.breadcrumb([['보관함', 'contracts.html'], ['만료 예정 계약', 'expiring.html'], ['연장 검토']]);
  if (!b || !C.canView(b.root, me)) {
    $('#notice').innerHTML = notice('연장할 계약을 찾을 수 없습니다', '계약 상세나 만료 예정 계약에서 "연장 검토"를 눌러 들어와 주세요.');
    return;
  }
  const root = b.root;
  const blocking = b.open.filter(function (o) { return o.kind === 'RENEW' || o.kind === 'TERMINATE'; });
  let stop = '';
  if (b.status !== 'ACTIVE') stop = '지금 유효한 계약이 계약 완료일 때만 연장을 검토합니다.';
  else if (b.autoRenew !== 'YES') stop = '자동갱신 계약이 아닙니다. 연장하려면 계약 상세에서 "연장 기안"을 눌러 주세요.';
  else if (root.requesterId !== me.id && me.role !== 'SUPER') stop = '영업대표(' + esc(C.ownerLabel(root.requesterId)) + ')만 연장 검토를 기안합니다.';
  else if (blocking.length) stop = '진행 중인 연장이나 해지가 있습니다: ' + blocking.map(function (o) { return '<a href="review.html?id=' + encodeURIComponent(o.id) + '">' + esc(o.id) + '</a>'; }).join(', ');
  if (stop) {
    $('#notice').innerHTML = notice('연장 검토를 할 수 없습니다', stop + ' <a href="' + back + '">계약 상세로</a>');
    return;
  }

  /* ---------- 연장할 계약 ---------- */
  const cur = b.current;
  const newId = C.nextChildId(b.id, 'RENEW');
  const newStart = addDays(b.end, 1); // 새 계약 시작일 기본값: 지금 종료일 다음 날
  const noticeDay = b.noticeDays ? addDays(b.end, -b.noticeDays) : null;
  function info(label, value) { return '<div><dt>' + esc(label) + '</dt><dd>' + value + '</dd></div>'; }
  $('#origin').innerHTML = [
    info('고객사', esc(root.counterparty)),
    info('계약번호', '<a href="' + back + '">' + esc(b.id) + '</a>' + (cur !== root ? ' (지금 유효: ' + esc(cur.id) + ')' : '')),
    info('계약 기간', C.fmtPeriod(b.start, b.end) + ' (만료까지 ' + C.daysUntil(b.end) + '일)'),
    info('계약 금액', cur.amount ? Number(cur.amount).toLocaleString('ko-KR') + '원' : '금액 없음'),
    info('해지 통지 기한', noticeDay ? C.fmtDate(noticeDay) + ' (만료 ' + b.noticeDays + '일 전)' + (C.daysUntil(noticeDay) < 0 ? ' <span class="wait-long">지남</span>' : '') : '-'),
    info('영업대표', esc(C.ownerLabel(root.requesterId))),
  ].join('');
  $('#keep-help').textContent = '기안하면 ' + newId + '(연장, 조건 그대로)로 묶이고, 승인되면 아래에 입력한 기간이 새 계약 기간이 됩니다. 금액과 조건은 그대로입니다.';
  $('#f-start').value = newStart;
  $('#f-start').min = newStart;
  $('#btn-cancel').href = back;

  const route = [
    { no: '③', name: '영업 검토', who: '영업 리더 ' + C.ownerLabel(C.stepUserNow('S03', root)), reason: '그대로 연장이 영업상 맞는지 승인' },
    { no: '④', name: '법무 검토', who: '법무 ' + C.ownerLabel(C.stepUserNow('S04', root)), reason: '연장 조건과 법적 위험 검토' },
    { no: '⑨', name: '운영 적용 (기간 연장)', who: '고객지원 ' + C.ownerLabel(C.stepUserNow('S09', root)), reason: '라이선스나 도메인 기간 연장' },
    { no: '⑩', name: '재무 확인', who: '재무 ' + C.ownerLabel(C.stepUserNow('S10', root)), reason: '연장된 기간의 매출 인식 확인' },
  ];
  $('#route').innerHTML = '<ol class="route-list">' + route.map(function (it) {
    return '<li class="is-go"><span class="route-no" aria-hidden="true">' + it.no + '</span>' +
      '<span><span class="route-name">' + esc(it.name) + '</span><span class="route-who">' + esc(it.who) + '</span>' +
      '<span class="route-reason">' + esc(it.reason) + '</span></span><span class="badge badge--progress">거침</span></li>';
  }).join('') + '</ol>';
  $('#form').hidden = false;

  /* ---------- 세 갈래 ---------- */
  const GO = {
    CHANGE: { text: '조건을 바꿔 연장하면 계약 등록 화면에서 연장 계약을 기안합니다. 원계약이 미리 골라져 있고, 바뀐 조건과 체크리스트 답에 따라 결재를 받습니다.',
      btn: '연장 계약 등록으로', href: 'new-contract.html?kind=RENEW&origin=' + encodeURIComponent(b.id) },
    END: { text: '해지하면 해지 기안 화면에서 해지일과 사유를 적어 기안합니다. 해지 통지 기한이 지났다면 상대방과 합의가 필요한지 법무와 먼저 확인해 주세요.',
      btn: '해지 기안으로', href: 'terminate.html?origin=' + encodeURIComponent(b.id) },
  };
  function choice() { return (document.querySelector('input[name="choice"]:checked') || {}).value; }
  function onChoice() {
    const v = choice();
    $('#keep-box').hidden = v !== 'KEEP';
    $('#route-panel').hidden = v !== 'KEEP';
    $('#go-box').hidden = v === 'KEEP';
    if (GO[v]) $('#go-text').textContent = GO[v].text;
    $('#btn-submit').textContent = v === 'KEEP' ? '연장 검토 기안' : GO[v].btn;
  }
  $('#form').addEventListener('change', onChoice);
  onChoice();

  /* ---------- 기안 ---------- */
  const modal = $('#confirm-modal');
  $('#form').addEventListener('submit', function (e) {
    e.preventDefault();
    const v = choice();
    if (GO[v]) { location.href = GO[v].href; return; }
    // 입력 검사: 시작일(지금 종료일 다음 날 이후), 종료일(시작일보다 앞설 수 없음, v0.38), 이유
    const start = $('#f-start').value, end = $('#f-end').value, reason = $('#f-reason').value.trim();
    const msgs = {
      start: !start ? '새 계약 시작일을 고르세요.' : start < newStart ? '새 계약 시작일은 지금 종료일 다음 날(' + C.fmtDate(newStart) + ') 이후여야 합니다.' : '',
      end: !end ? '새 계약 종료일을 고르세요.' : start && end < start ? '새 계약 종료일은 새 계약 시작일보다 앞설 수 없습니다.' : '', // 같은 날은 됨 (v0.38)
      reason: reason ? '' : '그대로 연장하는 이유를 적으세요.',
    };
    let first = null;
    Object.keys(msgs).forEach(function (k) {
      const field = document.querySelector('[data-field="' + k + '"]');
      C.setFieldError(field, msgs[k]); // 오류 표시와 aria-invalid (KRDS, v0.28)
      if (msgs[k] && !first) first = field.querySelector('input, textarea');
    });
    if (first) { first.focus(); return; }
    $('#confirm-body').innerHTML = '<p>기안하면 ③ 영업 검토부터 시작되고, 결재가 끝날 때까지 고칠 수 없습니다.</p>' +
      '<dl class="confirm-list"><div><dt>계약</dt><dd>' + esc(root.counterparty + ' ' + b.id) + '</dd></div>' +
      '<div><dt>연장 번호</dt><dd>' + esc(newId) + '</dd></div>' +
      '<div><dt>새 계약 기간</dt><dd>' + C.fmtPeriod(start, end) + '</dd></div></dl>';
    modal.hidden = false;
    C.focusModal(modal); // 제목에 포커스 (KRDS 모달, v0.28)
  });
  modal.addEventListener('click', function (e) {
    if (e.target === modal || e.target.closest('[data-act="close"]')) modal.hidden = true;
    if (!e.target.closest('[data-act="confirm"]')) return;
    // 연장 검토(그대로 자동갱신) 기록 (데이터 정의서 contract: kind RENEW, renew_mode AUTO)
    const rec = {
      id: newId, parentId: b.id, counterparty: root.counterparty, services: root.services, type: root.type,
      kind: 'RENEW', renewMode: 'AUTO', amount: cur.amount, requesterId: root.requesterId, requestedAt: C.nowStamp().slice(0, 16),
      restricted: root.restricted, personalData: root.personalData, status: 'IN_REVIEW', history: [],
      startDate: $('#f-start').value, endDate: $('#f-end').value, autoRenew: 'YES', noticeDays: b.noticeDays, reason: $('#f-reason').value.trim(),
    };
    C.saveDemoContract(rec);
    C.flash(newId + ' 연장 검토(조건 그대로)를 기안했습니다. 다음 차례: ③ 영업 검토 (' + C.ownerLabel(C.stepUserNow('S03', root)) + ')');
    location.href = 'review.html?id=' + encodeURIComponent(newId);
  });
  document.addEventListener('keydown', function (e) { if (!modal.hidden && e.key === 'Escape') modal.hidden = true; });
})();
