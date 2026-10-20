/* =====================================================================
 * SCR-13 해지 기안 화면 로직 (terminate.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-FLOW-29, REQ-ARC-06
 * 하는 일
 *   1. 주소의 원계약 번호로 묶음을 찾고 해지 기안을 할 수 있는지 확인
 *      (지금 유효한 계약이 계약 완료, 영업 대표 본인(시연용 슈퍼관리자 포함), 진행 중인 갱신이나 해지 없음)
 *   2. 해지일(오늘부터 계약 종료일 사이), 해지 사유(필수), 환불과 위약금, 해지 관련 서류(선택)
 *   3. 결재선 미리 보기: ③ 부서장 → ④ 법무 → ⑨ CEM 운영 종료 → ⑩ 재무 확인
 *   4. 기안하면 -T01 번호로 원계약에 묶어 저장(프로토타입은 이 브라우저에만)하고 결재 문서로 이동
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

  const origin = new URLSearchParams(location.search).get('origin');
  const found = D.CONTRACTS.find(function (c) { return c.id === origin; });
  const b = found ? C.bundleOf(C.rootOf(found)) : null;
  const back = b ? 'contract.html?id=' + encodeURIComponent(b.id) : 'contracts.html';
  if (!b || !C.canView(b.root, me)) {
    $('#notice').innerHTML = notice('해지할 계약을 찾을 수 없습니다', '계약 상세나 만료 예정 계약에서 "해지 기안"을 눌러 들어와 주세요.');
    return;
  }
  const root = b.root;
  const blocking = b.open.filter(function (o) { return o.kind === 'RENEW' || o.kind === 'TERMINATE'; });
  if (b.status !== 'ACTIVE') {
    $('#notice').innerHTML = notice('해지할 수 없는 계약입니다', '지금 유효한 계약이 계약 완료일 때만 해지를 기안합니다. 지금 상태: ' + esc(D.STATUS[b.status].label) + '. <a href="' + back + '">계약 상세로</a>');
    return;
  }
  if (root.requesterId !== me.id && me.role !== 'SUPER') {
    $('#notice').innerHTML = notice('영업 대표만 해지를 기안합니다', '이 계약의 영업 대표는 ' + esc(C.userName(root.requesterId)) + '님입니다. <a href="' + back + '">계약 상세로</a>');
    return;
  }
  if (blocking.length) {
    $('#notice').innerHTML = notice('진행 중인 갱신이나 해지가 있습니다', blocking.map(function (o) {
      return '<a href="review.html?id=' + encodeURIComponent(o.id) + '">' + esc(o.id) + '</a> ' + esc(C.kindLabel(o)) + ' ' + esc(D.STATUS[o.status].label);
    }).join('<br>'));
    return;
  }

  /* ---------- 해지할 계약 ---------- */
  const cur = b.current;
  const newId = C.nextChildId(b.id, 'TERMINATE');
  function info(label, value) { return '<div><dt>' + esc(label) + '</dt><dd>' + value + '</dd></div>'; }
  $('#origin').innerHTML = [
    info('고객사', esc(root.counterparty)),
    info('계약번호', '<a href="' + back + '">' + esc(b.id) + '</a>' + (cur !== root ? ' (지금 유효: ' + esc(cur.id) + ')' : '')),
    info('서비스', esc(C.serviceLabel(root.services))),
    info('계약 기간', C.fmtDate(b.start) + ' ~ ' + C.fmtDate(b.end)),
    info('계약 금액', cur.amount ? Number(cur.amount).toLocaleString('ko-KR') + '원' : '금액 없음'),
    info('영업 대표', esc(C.userName(root.requesterId)) + '님'),
  ].join('');
  $('#number-help').textContent = '기안하면 ' + newId + '(해지)로 원계약과 함께 묶입니다.';
  $('#date-help').textContent = '오늘(' + C.fmtDate(D.TODAY) + ')부터 계약 종료일(' + C.fmtDate(b.end) + ') 사이의 날짜';
  $('#f-date').min = D.TODAY;
  $('#f-date').max = b.end;
  $('#btn-cancel').href = back;

  /* ---------- 결재선 미리 보기 ---------- */
  const route = [
    { no: '③', name: '영업 검토', who: '팀 리더 ' + C.userName(C.stepUserNow('S03', root)), reason: '해지가 영업상 맞는지 승인' },
    { no: '④', name: '법무 검토', who: '법무 ' + C.userName(C.stepUserNow('S04', root)), reason: '해지 사유와 위약금 등 법적 위험 검토' },
    { no: '⑨', name: '운영 적용 (운영 종료)', who: 'CEM ' + C.userName(C.stepUserNow('S09', root)), reason: '해지일에 라이선스나 도메인을 닫음' },
    { no: '⑩', name: '재무 확인', who: '재무 ' + C.userName(C.stepUserNow('S10', root)), reason: '환불, 위약금, 매출 조정 확인' },
  ];
  $('#route').innerHTML = '<ol class="route-list">' + route.map(function (it) {
    return '<li class="is-go"><span class="route-no" aria-hidden="true">' + it.no + '</span>' +
      '<span><span class="route-name">' + esc(it.name) + '</span><span class="route-who">' + esc(it.who) + '</span>' +
      '<span class="route-reason">' + esc(it.reason) + '</span></span><span class="badge badge--progress">거침</span></li>';
  }).join('') + '</ol>';
  $('#form').hidden = false;

  /* ---------- 해지 관련 서류 (선택) ---------- */
  let fileName = '';
  function setFile(n) { fileName = n; $('#file-name').textContent = n ? '고른 파일: ' + n : ''; }
  $('#f-file').addEventListener('change', function (e) { const f = e.target.files[0]; setFile(f && f.size <= 50 * 1048576 ? f.name : ''); });
  $('#demo-file').addEventListener('click', function () { setFile(root.counterparty + '_해지합의서.pdf'); });

  /* ---------- 입력 검사 (KRDS 오류 패턴) ---------- */
  function setError(name, msg) {
    const field = document.querySelector('[data-field="' + name + '"]');
    const err = field.querySelector('.field-error');
    field.classList.toggle('is-invalid', !!msg);
    err.innerHTML = msg ? C.icon('alert', 'sm') + esc(msg) : '';
    err.hidden = !msg;
  }
  function validate() {
    const errors = [];
    const date = $('#f-date').value, reason = $('#f-reason').value.trim();
    const dateMsg = !date ? '해지일을 고르세요.' : date < D.TODAY || date > b.end ? '해지일은 오늘부터 계약 종료일 사이여야 합니다.' : '';
    setError('date', dateMsg);
    if (dateMsg) errors.push({ msg: dateMsg, el: $('#f-date') });
    setError('reason', reason ? '' : '해지 사유를 적으세요.');
    if (!reason) errors.push({ msg: '해지 사유를 적으세요.', el: $('#f-reason') });
    const box = $('#error-summary');
    box.hidden = !errors.length;
    if (errors.length) {
      box.innerHTML = '<p class="error-summary-title">' + C.icon('alert') + '입력하지 않았거나 고쳐야 할 항목이 ' + errors.length + '개 있습니다</p><ul>' +
        errors.map(function (e, i) { return '<li><a href="#" data-err="' + i + '">' + esc(e.msg) + '</a></li>'; }).join('') + '</ul>';
      box.onclick = function (ev) {
        const a = ev.target.closest('[data-err]');
        if (!a) return;
        ev.preventDefault();
        errors[Number(a.dataset.err)].el.focus();
      };
      box.focus();
    }
    return !errors.length;
  }

  /* ---------- 기안 확인 창 ---------- */
  const modal = $('#confirm-modal');
  $('#form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) return;
    $('#confirm-body').innerHTML = '<p>기안하면 ③ 영업 검토부터 시작되고, 결재가 끝날 때까지 고칠 수 없습니다. ⑩ 재무 확인까지 끝나면 원계약이 해지 상태가 됩니다.</p>' +
      '<dl class="confirm-list"><div><dt>계약</dt><dd>' + esc(root.counterparty + ' ' + b.id) + '</dd></div>' +
      '<div><dt>해지 번호</dt><dd>' + esc(newId) + '</dd></div>' +
      '<div><dt>해지일</dt><dd>' + C.fmtDate($('#f-date').value) + '</dd></div></dl>';
    modal.hidden = false;
    modal.querySelector('[data-act="confirm"]').focus();
  });
  modal.addEventListener('click', function (e) {
    if (e.target === modal || e.target.closest('[data-act="close"]')) modal.hidden = true;
    if (!e.target.closest('[data-act="confirm"]')) return;
    // 해지 기안 기록 (데이터 정의서 contract: kind TERMINATE, terminate_date, terminate_reason)
    const rec = {
      id: newId, parentId: b.id, counterparty: root.counterparty, services: root.services, type: root.type,
      kind: 'TERMINATE', amount: 0, requesterId: root.requesterId, requestedAt: C.nowStamp().slice(0, 16),
      restricted: root.restricted, personalData: false, status: 'IN_REVIEW', history: [],
      terminateDate: $('#f-date').value, reason: $('#f-reason').value.trim(), refundNote: $('#f-refund').value.trim(),
      files: fileName ? [{ kind: 'TERMINATE_DOC', name: fileName }] : [],
    };
    C.saveDemoContract(rec);
    C.flash(newId + ' 해지를 기안했습니다. 다음 차례: ③ 영업 검토 (' + C.userName(C.stepUserNow('S03', root)) + '님)');
    location.href = 'review.html?id=' + encodeURIComponent(newId);
  });
  document.addEventListener('keydown', function (e) { if (!modal.hidden && e.key === 'Escape') modal.hidden = true; });
})();
