/* =====================================================================
 * SCR-13 해지 기안 화면 로직 (terminate.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-FLOW-29, REQ-ARC-06
 * 하는 일
 *   1. 주소의 원계약 번호로 묶음을 찾고 해지 기안을 할 수 있는지 확인
 *      (지금 유효한 계약이 계약 완료, 영업대표 본인(시연용 최고관리자 포함), 진행 중인 연장이나 해지 없음)
 *      기획자 결정 2026-11-03 C-44: 영업대표 본인은 지금 영업대표(C.isSalesRep: 바뀐 새 영업대표, 맡을 수 없으면 대신 맡는 영업 리더). 새 기록의 기안자도 그 사람
 *   2. 해지일(오늘부터 계약 종료일 사이), 해지 사유(필수), 환불과 위약금, 해지 관련 서류(선택)
 *   3. 결재선 미리 보기: ③ 영업 리더 → ④ 법무 → ⑨ 고객지원 운영 종료 → ⑩ 재무 확인
 *   4. 기안하면 -T01 번호로 원계약에 묶어 저장(프로토타입은 이 브라우저에만)하고 결재 문서로 이동
 *   5. 보완 후 재기안(v0.58 기획자 결정): terminate.html?id=반려된 해지 번호로 열면 앞 차수 값을 채우고 같은 번호의 다음 차수로 기안
 *   6. 기획자 결정 2026-11-02 C-16: 거래처나 묶음에 보류가 걸려 있으면(C.holdOf) "보류 중" 배지와 사유를 보이고 기안하지 않음(재기안 포함)
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const notice = function (title, body) { return C.noticeBox('', title, body); };

  // 보완 후 재기안: 반려된 해지를 같은 번호의 다음 차수로 (terminate.html?id=2601CL001-T01)
  const params = new URLSearchParams(location.search);
  const again = C.resubmitSource(params.get('id'), me, function (c) { return c.kind === 'TERMINATE'; });
  const origin = again ? again.parentId : params.get('origin');
  const found = D.CONTRACTS.find(function (c) { return c.id === origin; });
  const b = found ? C.bundleOf(C.rootOf(found)) : null;
  const back = b ? 'contract.html?id=' + encodeURIComponent(b.id) : 'contracts.html';
  // 2026-11-06 점검: ?id=의 기록이 있고 볼 수 있는데 지금 다시 기안할 수 없으면 "찾을 수 없습니다" 대신 그 까닭과 결재 문서로 가는 길을 알림
  //   "찾을 수 없습니다"는 없는 번호(또는 볼 수 없는 기록)일 때만. 연장 검토, 운영 변경과 같은 말
  const idRec = params.get('id') && !again ? D.CONTRACTS.find(function (c) { return c.id === params.get('id'); }) : null;
  if (idRec && C.canView(idRec, me)) {
    $('#notice').innerHTML = notice('보완 후 재기안할 수 없는 기안입니다', '이 기안은 지금 보완 후 재기안할 수 없습니다(이미 다시 기안했거나 지금 영업대표가 아님). ' +
      '<a class="doc-link" href="review.html?id=' + encodeURIComponent(idRec.id) + '">결재 문서 보기</a>');
    return;
  }
  if (!b || !C.canView(b.root, me)) {
    $('#notice').innerHTML = notice('해지할 계약을 찾을 수 없습니다', '계약 상세나 만료 예정 계약에서 "해지 기안"을 눌러 들어와 주세요.');
    return;
  }
  const root = b.root;
  // 설계 검토 2026-11-11 5번: 예전 계약 기록(LG-번호)도 원계약으로 받음. 다만 바로잡힌 기록은 쓰지 않고 바로잡은 새 기록에서 기안 [가정]
  if (C.legacyReplacedBy(root)) {
    $('#notice').innerHTML = notice('바로잡힌 예전 계약 기록입니다', '이 기록은 바로잡혀 새 기록(' + esc(C.legacyReplacedBy(root).id) + ')이 있습니다. <a href="contract.html?id=' +
      encodeURIComponent(C.legacyReplacedBy(root).id) + '">새 기록의 계약 상세로</a>');
    return;
  }
  const blocking = b.open.filter(function (o) { return o.kind === 'RENEW' || o.kind === 'TERMINATE'; });
  // 기획자 결정 2026-11-02 C-16: 거래처나 묶음에 보류가 걸려 있으면 해지를 기안하지 않음(보완 후 재기안 ?id도). 다른 까닭보다 먼저(연장 검토와 같게)
  //   "보류 중" 배지와 사유를 함께. 보류는 컴플라이언스 담당자가 풂(개선 과제와 보류 SCR-64)
  const hold = C.holdOf(b);
  if (hold) {
    $('#notice').innerHTML = notice('보류 중이라 해지를 기안할 수 없습니다', C.holdBadge(hold) + ' ' + esc(C.holdText(hold, me)) +
      '<br>보류가 풀릴 때까지 연장, 변경, 해지를 기안할 수 없습니다. <a href="' + back + '">계약 상세로</a>');
    return;
  }
  if (b.status !== 'ACTIVE') {
    $('#notice').innerHTML = notice('해지할 수 없는 계약입니다', '지금 유효한 계약이 계약 완료일 때만 해지를 기안합니다. 지금 상태: ' + esc(D.STATUS[b.status].label) + '. <a href="' + back + '">계약 상세로</a>');
    return;
  }
  // 기획자 결정 2026-11-03(C-44): 지금 영업대표(바뀐 새 영업대표, 맡을 수 없으면 대신 맡는 영업 리더, C.isSalesRep). 계약 상세의 단추와 같은 규칙
  //   처음 기안한 사람이라도 영업대표가 바뀌었으면 기안하지 않음
  if (!C.isSalesRep(b, me) && me.role !== 'SUPER') {
    $('#notice').innerHTML = notice('영업대표만 해지를 기안합니다', '이 계약의 영업대표는 ' + esc(C.ownerLabel(C.salesRepOf(b))) + '입니다.' +
      (C.repNeeded(b) ? ' ' + esc(C.repCoverText(b)) : '') + ' <a href="' + back + '">계약 상세로</a>');
    return;
  }
  if (blocking.length) {
    $('#notice').innerHTML = notice('진행 중인 연장이나 해지가 있습니다', blocking.map(function (o) {
      return '<a href="review.html?id=' + encodeURIComponent(o.id) + '">' + esc(o.id) + '</a> ' + esc(C.kindLabel(o)) + ' ' + esc(D.STATUS[o.status].label);
    }).join('<br>'));
    return;
  }

  // 반려된 해지가 있으면 새 번호 대신 그 기안을 보완해 같은 번호로 다시 기안 (v0.58 기획자 결정)
  const waiting = again ? [] : b.rejected.filter(function (o) { return o.kind === 'TERMINATE'; });
  if (waiting.length) {
    $('#notice').innerHTML = C.noticeBox('', '반려된 해지가 있습니다', waiting.map(function (o) {
      return '<a href="review.html?id=' + encodeURIComponent(o.id) + '">' + esc(o.id) + '</a> ' + esc(C.kindLabel(o)) + ' ' + (o.round || 1) + '차 반려';
    }).join('<br>') + '<br>새로 기안하지 않고 반려된 기안을 보완해 같은 번호의 다음 차수로 다시 기안합니다.',
      '<a class="btn btn--primary btn--md" href="' + C.resubmitHref(waiting[0]) + '">보완 후 재기안</a><a class="btn btn--tertiary btn--md" href="' + back + '">계약 상세로</a>');
    return;
  }

  /* ---------- 해지할 계약 ---------- */
  const cur = b.current;
  const newId = again ? again.id : C.nextChildId(b.id, 'TERMINATE');
  if (again) {
    document.querySelector('.page-title').textContent = '해지 보완 후 재기안';
    $('#notice').innerHTML = C.rejectionNotice(again);
  }
  function info(label, value, cls) { return '<div><dt>' + esc(label) + '</dt><dd' + (cls ? ' class="' + cls + '"' : '') + '>' + value + '</dd></div>'; } // cls amount: 금액은 오른쪽(REQ-UI-16)
  $('#origin').innerHTML = [
    info('고객사', esc(root.counterparty)),
    info('계약번호', '<a href="' + back + '">' + esc(b.id) + '</a>' + (cur !== root ? ' (지금 유효: ' + esc(cur.id) + ')' : '') +
      // 설계 검토 2026-11-11 5번: 원계약이 예전 계약 기록이면 그 표시와 예전 문서 번호
      (root.legacy ? '<span class="cell-meta">' + C.legacyBadges(root) + ' 예전 문서 ' + esc(root.legacy.docNo || '-') + '</span>' : '')),
    info('서비스', esc(C.serviceLabel(root.services))),
    info('계약 기간', C.fmtPeriod(b.start, b.end)),
    info('계약 금액', Number(cur.amount || 0).toLocaleString('ko-KR') + '원<span class="cell-meta">' + esc(C.fmtKRW(cur.amount)) + ', 부가세 별도</span>', 'amount'),
    // 기획자 결정 2026-11-03(C-44): 지금 영업대표. 바뀌었으면 처음 기안한 사람, 맡을 수 없으면 "담당 지정 필요"(계약 상세와 같음)
    // "담당 지정 필요"는 계약 상세, 결재 화면처럼 주의 배지로 보임(회색 글자였음) (2026-11-06 점검)
    info('영업대표', esc(C.ownerLabel(C.salesRepOf(b))) +
      (C.salesRepOf(b) !== root.requesterId ? '<span class="cell-meta">처음 기안 ' + esc(C.ownerLabel(root.requesterId)) + '</span>' : '') +
      (C.repNote(b) ? '<span class="cell-meta">' + C.badge('attention', C.repNote(b)) + '</span>' : '')),
  ].join('');
  $('#number-help').textContent = again ? '같은 번호 ' + newId + '의 ' + ((again.round || 1) + 1) + '차로 기안합니다.' : '기안하면 ' + newId + '(해지)로 원계약과 함께 묶입니다.';
  $('#date-help').textContent = '오늘(' + C.fmtDate(D.TODAY) + ')부터 계약 종료일(' + C.fmtDate(b.end) + ') 사이의 날짜';
  $('#f-date').min = D.TODAY;
  $('#f-date').max = b.end;
  $('#btn-cancel').href = back;

  /* ---------- 결재선 미리 보기 ---------- */
  // 기획자 결정 2026-11-03(C-44): 기안자는 지금 영업대표(repActorOf). ③은 그 사람 유닛의 리더, 리더가 대신 기안하면 영업 임원(C.stepWho)
  const drafter = { requesterId: C.repActorOf(b) };
  const route = [
    { no: '③', name: '영업 검토', who: C.stepWho('S03', drafter) + ' ' + C.ownerLabel(C.stepUserNow('S03', drafter)), reason: '해지가 영업상 맞는지 승인' },
    { no: '④', name: '법무 검토', who: '법무 ' + C.ownerLabel(C.stepUserNow('S04', root)), reason: '해지 사유와 위약금 등 법적 위험 검토' },
    { no: '⑨', name: '운영 적용 (운영 종료)', who: '고객지원 ' + C.ownerLabel(C.stepUserNow('S09', root)), reason: '해지일에 라이선스나 도메인을 닫음' },
    { no: '⑩', name: '재무 확인', who: '재무 ' + C.ownerLabel(C.stepUserNow('S10', root)), reason: '환불, 위약금, 매출 조정 확인' },
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
  // 해지 관련 서류: PDF, Word, 한글, JPG, PNG, 한 파일 50MB 이하 (03 CODE-FILE-KIND TERMINATE_DOC. v0.63 점검에서 고침: 형식을 보지 않고 큰 파일은 말없이 뺐음)
  $('#f-file').addEventListener('change', function (e) {
    const f = e.target.files[0];
    const box = e.target.closest('.field');
    if (f && (f.size > 50 * 1048576 || !/\.(pdf|doc|docx|hwp|hwpx|jpe?g|png)$/i.test(f.name))) {
      setFile(''); e.target.value = '';
      if (box) C.setFieldError(box, 'PDF, Word, 한글, JPG, PNG 파일만, 한 파일 50MB 이하로 올립니다.');
      return;
    }
    if (box) C.setFieldError(box, '');
    setFile(f ? f.name : '');
  });
  $('#demo-file').addEventListener('click', function () { C.setFieldError($('#f-file').closest('.field'), ''); setFile(root.counterparty + '_해지합의서.pdf'); }); // 예시 파일을 고르면 앞의 형식 경고도 지움
  // 보완 후 재기안: 앞 차수 값을 채움
  if (again) {
    $('#f-date').value = again.terminateDate || '';
    $('#f-reason').value = again.reason || '';
    $('#f-refund').value = again.refundNote || '';
    // 2026-11-16 결정 5: 나눠 받는 세 칸(예전 기록은 메모만 있어 금액 칸은 비워 둠)
    $('#f-refund-amount').value = again.refundAmount != null ? Number(again.refundAmount).toLocaleString('ko-KR') : '';
    $('#f-penalty').value = again.penaltyAmount != null ? Number(again.penaltyAmount).toLocaleString('ko-KR') : '';
    if (again.refundTo != null) $('#f-refund-to').value = again.refundTo;
    setFile(((again.files || [])[0] || {}).name || '');
  }

  /* ---------- 환불 금액, 위약금, 환불받는 곳 (기획자 결정 2026-11-16, 결정할것 결정 5) ----------
   *   금액 두 칸은 0 이상의 원 단위 숫자(쉼표를 붙여 보임). 환불받는 곳은 처음에 계약 고객 이름을 채워 둠
   *   환불 금액이 0보다 크면 환불받는 곳이 필수. 계약 고객 이름과 다르면(제3자 환불) 메모에 까닭이 필수(ISO 37001 8.3, ⑩ 재무가 확인) */
  $('#refund-to-help').textContent = '처음 값은 계약 고객(' + root.counterparty + ')입니다. 다른 곳으로 돌려주면 그 이름을 적고 메모에 까닭을 적습니다.';
  if (!again || again.refundTo == null || again.refundTo === '') $('#f-refund-to').value = root.counterparty;
  if (!again || again.refundAmount == null) { $('#f-refund-amount').value = '0'; $('#f-penalty').value = '0'; } // 처음 값 0(없으면 그대로 둠)
  ['#f-refund-amount', '#f-penalty'].forEach(function (s) {
    $(s).addEventListener('input', function (e) { const d = e.target.value.replace(/[^0-9]/g, ''); e.target.value = d ? Number(d).toLocaleString('ko-KR') : ''; });
  });
  function wonOf(s) { const v = $(s).value.replace(/,/g, '').trim(); return /^\d+$/.test(v) ? Number(v) : null; }

  /* ---------- 입력 검사 (KRDS 오류 패턴) ---------- */
  // 오류 표시와 aria-invalid는 공통 함수로 (KRDS, v0.28)
  function setError(name, msg) { C.setFieldError(document.querySelector('[data-field="' + name + '"]'), msg); }
  // 고치는 칸의 오류는 그 칸을 고치는 대로 지움. 다음 기안 때까지 남아 있던 것 (2026-11-06 점검 3회차, 계약 등록의 clearError, C.formModal과 같음)
  //   파일 칸은 change 처리기가 오류를 직접 정하므로 빼고, 요약 상자는 다음 기안 때 다시 셈
  function clearOne(e) {
    if (e.target.type === 'file') return;
    const box = e.target.closest('[data-field]');
    if (box && box.classList.contains('is-invalid')) C.setFieldError(box, '');
  }
  $('#form').addEventListener('input', clearOne);
  $('#form').addEventListener('change', clearOne);
  function validate() {
    const errors = [];
    const date = $('#f-date').value, reason = $('#f-reason').value.trim();
    // 없는 날짜(2월 30일 등)를 적었으면 "없는 날짜입니다"를 보임. "해지일을 고르세요"로 덮어 적던 것 (2026-11-06 점검 3회차, C.dateFieldError)
    const dateMsg = !date ? C.dateFieldError($('#f-date'), '해지일을 고르세요.') : date < D.TODAY || date > b.end ? '해지일은 오늘부터 계약 종료일 사이여야 합니다.' : '';
    setError('date', dateMsg);
    if (dateMsg) errors.push({ msg: dateMsg, el: $('#f-date') });
    setError('reason', reason ? '' : '해지 사유를 적으세요.');
    if (!reason) errors.push({ msg: '해지 사유를 적으세요.', el: $('#f-reason') });
    // 2026-11-16 결정 5: 환불 금액, 위약금(필수, 0 이상), 환불받는 곳(환불이 있으면 필수), 계약 고객이 아니면 메모 필수
    const ra = wonOf('#f-refund-amount'), pa = wonOf('#f-penalty'), to = $('#f-refund-to').value.trim(), memo = $('#f-refund').value.trim();
    const raMsg = ra == null ? '환불 금액을 숫자로 적으세요(없으면 0).' : '';
    setError('refundAmount', raMsg); if (raMsg) errors.push({ msg: raMsg, el: $('#f-refund-amount') });
    const paMsg = pa == null ? '위약금을 숫자로 적으세요(없으면 0).' : '';
    setError('penalty', paMsg); if (paMsg) errors.push({ msg: paMsg, el: $('#f-penalty') });
    const toMsg = ra && !to ? '환불 금액이 있어 환불받는 곳을 적으세요.' : '';
    setError('refundTo', toMsg); if (toMsg) errors.push({ msg: toMsg, el: $('#f-refund-to') });
    const memoMsg = ra && to && to !== root.counterparty && !memo ? '환불받는 곳이 계약 고객(' + root.counterparty + ')이 아니라 까닭을 메모에 적으세요.' : '';
    setError('refund', memoMsg); if (memoMsg) errors.push({ msg: memoMsg, el: $('#f-refund') });
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
  let lastFocus = null;
  $('#form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) return;
    // (2026-11-18 셋째 점검 screen-rules-02) 확인 창의 환불 줄: 금액은 따로 오른쪽 정렬(dd.amount), 받는 곳과 메모는 글 줄
    const refundRows = function (r) {
      const row = function (dt, v, cls) { return '<div><dt>' + esc(dt) + '</dt><dd' + (cls ? ' class="' + cls + '"' : '') + '>' + v + '</dd></div>'; };
      return row('환불 금액', esc(C.fmtWon(Number(r.refundAmount) || 0)), 'amount') + row('위약금', esc(C.fmtWon(Number(r.penaltyAmount) || 0)), 'amount') +
        (Number(r.refundAmount) ? row('환불받는 곳', esc(r.refundTo || '-') + (C.refundToOther(r) ? '<span class="cell-meta">계약 고객 아님</span>' : '')) : '') +
        row('환불과 위약금 메모', esc(r.refundNote || '-'));
    };
    $('#confirm-body').innerHTML = '<p>기안하면 ③ 영업 검토부터 시작되고, 결재가 끝날 때까지 고칠 수 없습니다. ⑩ 재무 확인까지 끝나면 원계약이 해지 상태가 됩니다.</p>' +
      '<dl class="confirm-list"><div><dt>계약</dt><dd>' + esc(root.counterparty + ' ' + b.id) + '</dd></div>' +
      '<div><dt>해지 번호</dt><dd>' + esc(newId) + '</dd></div>' +
      '<div><dt>해지일</dt><dd>' + C.fmtDate($('#f-date').value) + '</dd></div>' +
      refundRows(Object.assign({ counterparty: root.counterparty }, refundFields())) + '</dl>'; // 2026-11-16 결정 5, 2026-11-18 셋째 점검 screen-rules-02
    lastFocus = document.activeElement;
    modal.hidden = false;
    C.focusModal(modal); // 제목에 포커스 (KRDS 모달, v0.28)
  });
  // 닫기, 바깥 누름, Esc 모두 창을 닫고 열기 전 자리(기안 단추)로 포커스를 돌려줌. 계약 등록, 결재 화면과 같음 (2026-11-06 점검)
  function closeModal() { modal.hidden = true; if (lastFocus) lastFocus.focus(); }
  // 2026-11-16 결정 5: 저장하는 세 칸(환불이 0이면 받는 곳은 비움)
  function refundFields() {
    const ra = wonOf('#f-refund-amount') || 0;
    return { refundAmount: ra, penaltyAmount: wonOf('#f-penalty') || 0, refundTo: ra ? $('#f-refund-to').value.trim() : '', refundNote: $('#f-refund').value.trim() };
  }
  modal.addEventListener('click', function (e) {
    if (e.target === modal || e.target.closest('[data-act="close"]')) closeModal();
    if (!e.target.closest('[data-act="confirm"]')) return;
    // 해지 기안 기록 (데이터 정의서 contract: kind TERMINATE, terminate_date, terminate_reason)
    const fields = {
      terminateDate: $('#f-date').value, reason: $('#f-reason').value.trim(),
      refundAmount: refundFields().refundAmount, penaltyAmount: refundFields().penaltyAmount, refundTo: refundFields().refundTo, refundNote: refundFields().refundNote, // 2026-11-16 결정 5
      files: fileName ? [{ kind: 'TERMINATE_DOC', name: fileName }] : [],
    };
    const rec = again ? C.resubmitRecord(again, fields) : Object.assign({
      id: newId, parentId: b.id, counterparty: root.counterparty, services: root.services, type: root.type,
      kind: 'TERMINATE', amount: 0, requesterId: C.repActorOf(b), requestedAt: C.nowStamp().slice(0, 16), // 지금 영업대표(2026-11-03 C-44)
      restricted: root.restricted, personalData: false, status: 'IN_REVIEW', round: 1, history: [],
    }, fields);
    C.saveDemoContract(rec);
    C.flash(newId + ' 해지를 ' + (rec.round || 1) + '차로 기안했습니다. 다음 차례: ③ 영업 검토 (' + C.ownerLabel(C.stepUserNow('S03', rec)) + ')');
    location.href = 'review.html?id=' + encodeURIComponent(newId);
  });
  document.addEventListener('keydown', function (e) { if (!modal.hidden && e.key === 'Escape') closeModal(); });
})();
