/* =====================================================================
 * SCR-44 연장 검토 화면 로직 (renewal.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-FLOW-20, REQ-ARC-07
 * 하는 일
 *   1. 주소의 원계약 번호로 묶음을 찾고 연장 검토를 할 수 있는지 확인
 *      (자동갱신이고 지금 유효한 계약이 계약 완료, 영업대표 본인(시연용 최고관리자 포함), 진행 중인 연장이나 해지 없음)
 *      기획자 결정 2026-11-03 C-44: 영업대표 본인은 지금 영업대표(C.isSalesRep: 바뀐 새 영업대표, 맡을 수 없으면 대신 맡는 영업 리더). 새 기록의 기안자도 그 사람
 *      기획자 결정 2026-11-02 A-11: 만료되었어도 서비스를 닫기 전(만료 처리 차례, 유예 중)이면 늦은 연장 검토를 받음(해지 갈래는 감춤)
 *   2. 세 갈래: 그대로 자동갱신(짧은 기안) / 조건을 바꿔 연장(계약 등록으로) / 해지(해지 기안으로)
 *   3. 그대로 자동갱신은 새 계약 기간(영업이 입력, 시작일은 지금 종료일 다음 날로 미리 채움)과 이유를 받아
 *      -R 번호로 저장하고 결재 문서로 이동 (v0.25 기획자 결정: 기간은 따로 입력)
 *   4. 보완 후 재기안(v0.58 기획자 결정): renewal.html?id=반려된 연장 번호로 열면 앞 차수 값을 채우고 같은 번호의 다음 차수로 기안
 *   5. 기획자 결정 2026-11-02 C-16: 거래처나 묶음에 보류가 걸려 있으면(C.holdOf) "보류 중" 배지와 사유를 보이고 기안하지 않음(재기안 포함)
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const notice = function (title, body) { return C.noticeBox('', title, body); };
  const addDays = C.addDays;

  // 보완 후 재기안: 반려된 조건 그대로 연장을 같은 번호의 다음 차수로 (renewal.html?id=2512CL001-R01)
  const params = new URLSearchParams(location.search);
  const again = C.resubmitSource(params.get('id'), me, function (c) { return c.kind === 'RENEW' && c.renewMode === 'AUTO'; });
  const origin = again ? again.parentId : params.get('origin');
  const found = D.CONTRACTS.find(function (c) { return c.id === origin; });
  const b = found ? C.bundleOf(C.rootOf(found)) : null;
  const back = b ? 'contract.html?id=' + encodeURIComponent(b.id) : 'expiring.html';
  // 2026-11-06 점검: ?id=의 기록이 있고 볼 수 있는데 지금 다시 기안할 수 없으면 "찾을 수 없습니다" 대신 그 까닭과 결재 문서로 가는 길을 알림
  //   "찾을 수 없습니다"는 없는 번호(또는 볼 수 없는 기록)일 때만. 해지, 운영 변경과 같은 말
  const idRec = params.get('id') && !again ? D.CONTRACTS.find(function (c) { return c.id === params.get('id'); }) : null;
  if (idRec && C.canView(idRec, me)) {
    $('#notice').innerHTML = notice('보완 후 재기안할 수 없는 기안입니다', '이 기안은 지금 보완 후 재기안할 수 없습니다(이미 다시 기안했거나 지금 영업대표가 아님). ' +
      '<a class="doc-link" href="review.html?id=' + encodeURIComponent(idRec.id) + '">결재 문서 보기</a>');
    return;
  }
  if (!b || !C.canView(b.root, me)) {
    $('#notice').innerHTML = notice('연장할 계약을 찾을 수 없습니다', '계약 상세나 만료 예정 계약에서 "연장 검토"를 눌러 들어와 주세요.');
    return;
  }
  const root = b.root;
  // 진행 중인 연장, 해지, 기간을 바꾸는 운영 변경이 있으면 막음 (v0.58 QA: 기간 변경이 끝나기 전에 연장하면 바뀐 기간이 사라졌음)
  const blocking = b.open.filter(function (o) { return o.kind === 'RENEW' || o.kind === 'TERMINATE' || (o.kind === 'CHANGE' && o.changeType === 'PERIOD'); });
  // 기획자 결정 2026-11-02 A-11: 만료되었어도 서비스를 닫기 전(만료 처리 차례, 유예 중)이면 늦은 연장 검토를 받음(계약 등록의 연장과 같은 규칙)
  //   유예는 연장 협상 중에 두는 것이라 그 끝이 연장 기안이어야 함. 서비스를 닫은 계약(만료 처리 완료)은 신규로. 늦은 연장에는 해지 갈래가 없음
  const ex = b.status === 'EXPIRED' ? C.expiryOf(b) : null;
  const late = !!ex && (ex.state === 'OPEN' || ex.state === 'GRACE');
  // 기획자 결정 2026-11-02 C-16: 거래처나 묶음에 보류가 걸려 있으면 연장 검토(보완 후 재기안 포함)와 다른 갈래(조건을 바꿔 연장, 해지)를 기안하지 않음
  //   다른 까닭보다 먼저 보이고, "보류 중" 배지와 사유를 함께. 보류는 컴플라이언스 담당자가 풂(개선 과제와 보류 SCR-64)
  const hold = C.holdOf(b);
  // 영업대표가 맡을 수 없어 영업 리더가 대신 맡는 중이면 그 한 줄(계약 상세의 안내와 같은 말, 2026-11-03 C-44)
  function repLine() { return C.repNeeded(b) ? ' ' + esc(C.repCoverText(b)) : ''; }
  let stop = '';
  if (hold) stop = C.holdBadge(hold) + ' ' + esc(C.holdText(hold, me)) + '<br>보류가 풀릴 때까지 연장, 변경, 해지를 기안할 수 없습니다.';
  else if (b.status !== 'ACTIVE' && !late) stop ='지금 유효한 계약이 계약 완료일 때, 또는 만료되었어도 서비스를 닫기 전(만료 처리 차례, 유예 중)일 때만 연장을 검토합니다.';
  else if (b.autoRenew !== 'YES') stop = '자동갱신 계약이 아닙니다. 연장하려면 계약 상세에서 "연장 기안"을 눌러 주세요.';
  // 기획자 결정 2026-11-03(C-44): 지금 영업대표(바뀐 새 영업대표, 맡을 수 없으면 대신 맡는 영업 리더, C.isSalesRep). 계약 상세의 단추와 같은 규칙
  //   처음 기안한 사람이라도 영업대표가 바뀌었으면 기안하지 않음
  else if (!C.isSalesRep(b, me) && me.role !== 'SUPER') stop = '영업대표(' + esc(C.ownerLabel(C.salesRepOf(b))) + ')만 연장 검토를 기안합니다.' + repLine();
  else if (blocking.length) stop = '진행 중인 연장, 해지나 기간 변경이 있습니다: ' + blocking.map(function (o) { return '<a href="review.html?id=' + encodeURIComponent(o.id) + '">' + esc(o.id) + '</a>'; }).join(', ');
  if (stop) {
    $('#notice').innerHTML = notice(hold ? '보류 중이라 연장 검토를 할 수 없습니다' : '연장 검토를 할 수 없습니다', stop + ' <a href="' + back + '">계약 상세로</a>');
    return;
  }

  // 반려된 연장이 있으면 새 번호 대신 그 기안을 보완해 같은 번호로 다시 기안 (v0.58 기획자 결정)
  const waiting = again ? [] : b.rejected.filter(function (o) { return o.kind === 'RENEW'; });
  if (waiting.length) {
    $('#notice').innerHTML = C.noticeBox('', '반려된 연장이 있습니다', waiting.map(function (o) {
      return '<a href="review.html?id=' + encodeURIComponent(o.id) + '">' + esc(o.id) + '</a> ' + esc(C.kindLabel(o)) + ' ' + (o.round || 1) + '차 반려';
    }).join('<br>') + '<br>새로 기안하지 않고 반려된 기안을 보완해 같은 번호의 다음 차수로 다시 기안합니다.',
      '<a class="btn btn--primary btn--md" href="' + C.resubmitHref(waiting[0]) + '">보완 후 재기안</a><a class="btn btn--tertiary btn--md" href="' + back + '">계약 상세로</a>');
    return;
  }

  /* ---------- 연장할 계약 ---------- */
  const cur = b.current;
  const newId = again ? again.id : C.nextChildId(b.id, 'RENEW');
  const newStart = addDays(b.end, 1); // 새 계약 시작일 기본값: 지금 종료일 다음 날
  const noticeDay = C.noticeDate(b);
  function info(label, value, cls) { return '<div><dt>' + esc(label) + '</dt><dd' + (cls ? ' class="' + cls + '"' : '') + '>' + value + '</dd></div>'; } // cls amount: 금액은 오른쪽(REQ-UI-16)
  $('#origin').innerHTML = [
    info('고객사', esc(root.counterparty)),
    info('계약번호', '<a href="' + back + '">' + esc(b.id) + '</a>' + (cur !== root ? ' (지금 유효: ' + esc(cur.id) + ')' : '')),
    // 늦은 연장(A-11)은 만료 처리 상태를 함께("만료, 서비스 닫기 전", "유예 중 (~2026-11-06)")
    // 2026-11-09 5회차 점검: 종료일이 오늘이면 "만료까지 0일" 대신 "오늘 만료"(다른 화면의 "오늘"과 같은 말)
    info('계약 기간', C.fmtPeriod(b.start, b.end) + '<span class="cell-meta">' + (late ? esc(ex.label) : C.daysUntil(b.end) ? '만료까지 ' + C.daysUntil(b.end) + '일' : '오늘 만료') + '</span>'),
    info('계약 금액', Number(cur.amount || 0).toLocaleString('ko-KR') + '원<span class="cell-meta">' + esc(C.fmtKRW(cur.amount)) + ', 부가세 별도</span>', 'amount'),
    info('해지 통지 기한', noticeDay ? '<span class="keep">' + C.fmtDate(noticeDay) + (C.daysUntil(noticeDay) < 0 ? ' <span class="wait-long">지남</span>' : '') + '</span><span class="cell-meta">만료 ' + b.noticeDays + '일 전까지 상대방에게 알려야 연장되지 않음</span>' : '-'),
    // 기획자 결정 2026-11-03(C-44): 지금 영업대표. 바뀌었으면 처음 기안한 사람, 맡을 수 없으면 "담당 지정 필요"(계약 상세와 같음)
    // "담당 지정 필요"는 계약 상세, 결재 화면처럼 주의 배지로 보임(회색 글자였음) (2026-11-06 점검)
    info('영업대표', esc(C.ownerLabel(C.salesRepOf(b))) +
      (C.salesRepOf(b) !== root.requesterId ? '<span class="cell-meta">처음 기안 ' + esc(C.ownerLabel(root.requesterId)) + '</span>' : '') +
      (C.repNote(b) ? '<span class="cell-meta">' + C.badge('attention', C.repNote(b)) + '</span>' : '')),
  ].join('');
  $('#keep-help').textContent = (again ? '같은 번호 ' + newId + '의 ' + ((again.round || 1) + 1) + '차로 기안하고' : '기안하면 ' + newId + '(연장, 조건 그대로)로 묶이고') +
    ', 승인되면 아래에 입력한 기간이 새 계약 기간이 됩니다. 금액과 조건은 그대로입니다.';
  $('#f-start').value = newStart;
  // 보완 후 재기안: 조건 그대로 연장만 다시 기안(다른 갈래는 감춤)하고 앞 차수 값을 채움
  // 늦은 연장(A-11): 이미 끝난 계약이라 해지 갈래를 감추고, 만료 처리를 기다린다는 것을 알림
  if (late && !again) {
    const r = document.querySelector('input[name="choice"][value="END"]');
    if (r) r.closest('label').hidden = true;
    $('#notice').innerHTML = C.noticeBox('', '만료된 계약의 늦은 연장입니다', '종료일(' + C.fmtDate(b.end) + ')이 지났지만 서비스를 닫기 전이라 연장을 기안할 수 있습니다. ' +
      '기안하면 만료 처리 차례가 없어지고, 반려되면 다시 만료 처리 차례가 됩니다. 지금: ' + esc(ex.label));
  }
  if (again) {
    document.querySelector('.page-title').textContent = '연장 검토 보완 후 재기안';
    $('#notice').innerHTML = C.rejectionNotice(again);
    ['CHANGE', 'END'].forEach(function (v) { const r = document.querySelector('input[name="choice"][value="' + v + '"]'); if (r) r.closest('label').hidden = true; });
    $('#f-start').value = again.startDate || newStart;
    $('#f-end').value = again.endDate || '';
    $('#f-reason').value = again.reason || '';
  }
  $('#f-start').min = newStart;
  $('#btn-cancel').href = back;

  // 기획자 결정 2026-11-03(C-44): 기안자는 지금 영업대표(repActorOf). ③은 그 사람 유닛의 리더, 리더가 대신 기안하면 영업 임원(C.stepWho)
  const drafter = { requesterId: C.repActorOf(b) };
  const route = [
    { no: '③', name: '영업 검토', who: C.stepWho('S03', drafter) + ' ' + C.ownerLabel(C.stepUserNow('S03', drafter)), reason: '그대로 연장이 영업상 맞는지 승인' },
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
    if (v !== 'KEEP') $('#error-summary').hidden = true; // 다른 갈래로 가면 그대로 연장의 오류 요약은 감춤 (2026-11-06 점검 3회차)
  }
  $('#form').addEventListener('change', onChoice);
  onChoice();
  // 고치는 칸의 오류는 그 칸을 고치는 대로 지움. 다음 기안 때까지 남아 있던 것 (2026-11-06 점검 3회차, 계약 등록의 clearError, C.formModal과 같음)
  function clearOne(e) {
    const box = e.target.closest('[data-field]');
    if (box && box.classList.contains('is-invalid')) C.setFieldError(box, '');
  }
  $('#form').addEventListener('input', clearOne);
  $('#form').addEventListener('change', clearOne);

  /* ---------- 기안 ---------- */
  const modal = $('#confirm-modal');
  let lastFocus = null;
  $('#form').addEventListener('submit', function (e) {
    e.preventDefault();
    const v = choice();
    if (GO[v]) { location.href = GO[v].href; return; }
    // 입력 검사: 시작일(지금 종료일 다음 날 이후), 종료일(시작일보다 앞설 수 없음, v0.38), 이유
    const start = $('#f-start').value, end = $('#f-end').value, reason = $('#f-reason').value.trim();
    // 없는 날짜(2월 30일 등)를 적었으면 "없는 날짜입니다"를 보임. "…을 고르세요"로 덮어 적던 것 (2026-11-06 점검 3회차, C.dateFieldError)
    const msgs = {
      start: !start ? C.dateFieldError($('#f-start'), '새 계약 시작일을 고르세요.') : start < newStart ? '새 계약 시작일은 지금 종료일 다음 날(' + C.fmtDate(newStart) + ') 이후여야 합니다.' : '',
      end: !end ? C.dateFieldError($('#f-end'), '새 계약 종료일을 고르세요.') : start && end < start ? '새 계약 종료일은 새 계약 시작일보다 앞설 수 없습니다.' : '', // 같은 날은 됨 (v0.38)
      reason: reason ? '' : '그대로 연장하는 이유를 적으세요.',
    };
    const errors = [];
    Object.keys(msgs).forEach(function (k) {
      const field = document.querySelector('[data-field="' + k + '"]');
      C.setFieldError(field, msgs[k]); // 오류 표시와 aria-invalid (KRDS, v0.28)
      if (msgs[k]) errors.push({ msg: msgs[k], el: field.querySelector('input, textarea') });
    });
    // 오류 요약: 해지, 운영 변경과 같은 상자(KRDS 오류 요약). 첫 칸으로 바로 가던 것을 요약 상자로 (2026-11-06 점검 3회차)
    const box = $('#error-summary');
    box.hidden = !errors.length;
    if (errors.length) {
      box.innerHTML = '<p class="error-summary-title">' + C.icon('alert') + '입력하지 않았거나 고쳐야 할 항목이 ' + errors.length + '개 있습니다</p><ul>' +
        errors.map(function (er, i) { return '<li><a href="#" data-err="' + i + '">' + esc(er.msg) + '</a></li>'; }).join('') + '</ul>';
      box.onclick = function (ev) {
        const a = ev.target.closest('[data-err]');
        if (!a) return;
        ev.preventDefault();
        errors[Number(a.dataset.err)].el.focus();
      };
      box.focus();
      return;
    }
    $('#confirm-body').innerHTML = '<p>기안하면 ③ 영업 검토부터 시작되고, 결재가 끝날 때까지 고칠 수 없습니다.</p>' +
      '<dl class="confirm-list"><div><dt>계약</dt><dd>' + esc(root.counterparty + ' ' + b.id) + '</dd></div>' +
      '<div><dt>연장 번호</dt><dd>' + esc(newId) + '</dd></div>' +
      '<div><dt>새 계약 기간</dt><dd>' + C.fmtPeriod(start, end) + '</dd></div></dl>';
    lastFocus = document.activeElement;
    modal.hidden = false;
    C.focusModal(modal); // 제목에 포커스 (KRDS 모달, v0.28)
  });
  // 닫기, 바깥 누름, Esc 모두 창을 닫고 열기 전 자리(기안 단추)로 포커스를 돌려줌. 계약 등록, 결재 화면과 같음 (2026-11-06 점검)
  function closeModal() { modal.hidden = true; if (lastFocus) lastFocus.focus(); }
  modal.addEventListener('click', function (e) {
    if (e.target === modal || e.target.closest('[data-act="close"]')) closeModal();
    if (!e.target.closest('[data-act="confirm"]')) return;
    // 연장 검토(그대로 자동갱신) 기록 (데이터 정의서 contract: kind RENEW, renew_mode AUTO)
    const fields = { startDate: $('#f-start').value, endDate: $('#f-end').value, reason: $('#f-reason').value.trim() };
    const rec = again ? C.resubmitRecord(again, fields) : Object.assign({
      id: newId, parentId: b.id, counterparty: root.counterparty, services: root.services, type: root.type,
      kind: 'RENEW', renewMode: 'AUTO', amount: cur.amount, requesterId: C.repActorOf(b), requestedAt: C.nowStamp().slice(0, 16), // 지금 영업대표(2026-11-03 C-44)
      restricted: root.restricted, personalData: root.personalData, status: 'IN_REVIEW', round: 1, history: [],
      autoRenew: 'YES', noticeDays: b.noticeDays,
    }, fields);
    C.saveDemoContract(rec);
    C.flash(newId + ' 연장 검토(조건 그대로)를 ' + (rec.round || 1) + '차로 기안했습니다. 다음 차례: ③ 영업 검토 (' + C.ownerLabel(C.stepUserNow('S03', rec)) + ')');
    location.href = 'review.html?id=' + encodeURIComponent(newId);
  });
  document.addEventListener('keydown', function (e) { if (!modal.hidden && e.key === 'Escape') closeModal(); });
})();
