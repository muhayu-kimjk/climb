/* =====================================================================
 * SCR-14 운영 변경 기안 화면 로직 (ops-change.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-CHG-06~11 (기획자 결정 v0.26: 재무 문서의 계약 체결 이후 수정 절차 반영)
 * 하는 일
 *   1. 주소의 원계약 번호로 묶음을 찾고 운영 변경을 기안할 수 있는지 확인
 *      (지금 유효한 계약이 계약 완료, 영업대표 본인(시연용 최고관리자 포함), 진행 중인 해지 없음)
 *   2. 변경 종류 하나: 계약 기간 변경(새 종료일), 추가 충전(수량, 유상이면 금액). 서비스에 있는 것만 고를 수 있음
 *   3. 변경 사유(필수), CRM 영업활동 링크(필수, https)
 *   4. 결재선 미리 보기: ③ 영업 검토(기간 2개월 넘게 바뀜, 무상 충전 50건 초과일 때만) → ⑨ 운영 변경(고객지원, HR 충전은 재무)
 *   5. 기안하면 -C01 번호로 원계약에 묶어 저장(프로토타입은 이 브라우저에만)하고 결재 문서로 이동
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const notice = function (title, body) { return C.noticeBox('', title, body); };

  const origin = new URLSearchParams(location.search).get('origin');
  const found = D.CONTRACTS.find(function (c) { return c.id === origin; });
  const b = found ? C.bundleOf(C.rootOf(found)) : null;
  const back = b ? 'contract.html?id=' + encodeURIComponent(b.id) : 'contracts.html';
  if (!b || !C.canView(b.root, me)) {
    $('#notice').innerHTML = notice('변경할 계약을 찾을 수 없습니다', '계약 상세에서 "운영 변경 기안"을 눌러 들어와 주세요.');
    return;
  }
  const root = b.root;
  if (b.status !== 'ACTIVE') {
    $('#notice').innerHTML = notice('운영 변경을 기안할 수 없는 계약입니다', '지금 유효한 계약이 계약 완료일 때만 기안합니다. 지금 상태: ' + esc(D.STATUS[b.status].label) + '. <a href="' + back + '">계약 상세로</a>');
    return;
  }
  if (root.requesterId !== me.id && me.role !== 'SUPER') {
    $('#notice').innerHTML = notice('영업대표만 운영 변경을 기안합니다', '이 계약의 영업대표는 ' + esc(C.ownerLabel(root.requesterId)) + '입니다. <a href="' + back + '">계약 상세로</a>');
    return;
  }
  const terminating = b.open.filter(function (o) { return o.kind === 'TERMINATE'; });
  if (terminating.length) {
    $('#notice').innerHTML = notice('진행 중인 해지가 있습니다', terminating.map(function (o) {
      return '<a href="review.html?id=' + encodeURIComponent(o.id) + '">' + esc(o.id) + '</a> ' + esc(D.STATUS[o.status].label);
    }).join('<br>'));
    return;
  }
  // 기간 변경은 진행 중인 연장이나 다른 기간 변경과 겹치면 막음 [가정]
  const periodBusy = b.open.some(function (o) { return o.kind === 'RENEW' || (o.kind === 'CHANGE' && o.changeType === 'PERIOD'); });

  /* ---------- 1. 변경할 계약 ---------- */
  const newId = C.nextChildId(b.id, 'CHANGE');
  function info(label, value) { return '<div><dt>' + esc(label) + '</dt><dd>' + value + '</dd></div>'; }
  $('#origin').innerHTML = [
    info('고객사', esc(root.counterparty)),
    info('계약번호', '<a href="' + back + '">' + esc(b.id) + '</a>' + (b.current !== root ? ' (지금 유효: ' + esc(b.current.id) + ')' : '')),
    info('서비스', esc(C.serviceLabel(root.services))),
    info('계약 기간', C.fmtPeriod(b.start, b.end)),
    info('영업대표', esc(C.ownerLabel(root.requesterId))),
    info('진행 중인 일', b.open.length ? b.open.map(function (o) { return esc(o.id + ' ' + C.kindLabel(o)); }).join('<br>') : '없음'),
  ].join('');
  $('#number-help').textContent = '기안하면 ' + newId + '(운영 변경)로 원계약과 함께 묶입니다.';
  $('#btn-cancel').href = back;

  /* ---------- 2. 변경 종류: 계약의 서비스에 있는 것만 ---------- */
  const R = D.CHANGE_RULES;
  const types = Object.keys(D.CHANGE_TYPES).filter(function (t) { return t === 'PERIOD' || (root.services || []).indexOf(t.split('_')[0]) > -1; });
  $('#type-choices').innerHTML = types.map(function (t) {
    const off = t === 'PERIOD' && periodBusy;
    return '<label class="choice"><input type="radio" name="type" value="' + t + '"' + (off ? ' disabled' : '') + '>' + esc(D.CHANGE_TYPES[t]) +
      (off ? ' (진행 중인 연장이나 기간 변경이 있어 지금은 고를 수 없음)' : '') + '</label>';
  }).join('');
  $('#f-end').min = D.TODAY;
  const typeOf = function () { const r = document.querySelector('[name="type"]:checked'); return r ? r.value : ''; };
  const num = function (v) { const n = String(v || '').replace(/[^0-9]/g, ''); return n ? parseInt(n, 10) : 0; };
  // 지금 입력으로 만든 운영 변경 기록 (결재선 계산과 저장에 같이 씀)
  function record() {
    const t = typeOf();
    return {
      id: newId, parentId: b.id, counterparty: root.counterparty, services: root.services, type: root.type, kind: 'CHANGE',
      changeType: t, changeQty: t && t !== 'PERIOD' ? num($('#f-qty').value) : 0,
      changeAmount: /_PAID$/.test(t) ? num($('#f-amount').value) : 0,
      requesterId: root.requesterId, requestedAt: C.nowStamp().slice(0, 16), restricted: root.restricted, personalData: false,
      status: 'IN_REVIEW', history: [],
      startDate: t === 'PERIOD' ? b.start : undefined, oldEndDate: b.end, endDate: t === 'PERIOD' ? $('#f-end').value : undefined,
      reason: $('#f-reason').value.trim(), activityUrl: $('#f-activity').value.trim(),
    };
  }

  /* ---------- 4. 결재선 미리 보기 ---------- */
  function refresh() {
    const t = typeOf(), rec = record();
    $('#period-box').hidden = t !== 'PERIOD';
    $('#qty-box').hidden = !t || t === 'PERIOD';
    $('#amount-field').hidden = !/_PAID$/.test(t);
    $('#qty-help').textContent = /_FREE$/.test(t) ? '무상 충전이 ' + R.freeQty + '건을 넘으면 ③ 영업 검토를 거칩니다.' : '유상 충전은 영업 검토 없이 바로 반영합니다.';
    const end = $('#f-end').value;
    $('#period-help').textContent = '지금 종료일 ' + C.fmtDate(b.end) + (end ? ' → ' + C.fmtDate(end) + (end > b.end ? ' (연장)' : end < b.end ? ' (단축)' : ' (같음)') : '') +
      '. ' + R.periodMonths + '개월 넘게 바뀌면 ③ 영업 검토를 거칩니다.';
    const ready = t && (t === 'PERIOD' ? !!end : true);
    const sales = ready ? C.changeSales(rec) : null;
    const hr = /^HR_/.test(t);
    const items = [
      { no: '③', name: '영업 검토', who: '영업 리더 ' + C.ownerLabel(C.stepUserNow('S03', root)),
        state: !sales ? 'wait' : sales[0] ? 'go' : 'skip', reason: sales ? sales[1] : '변경 종류와 내용을 기다림' },
      { no: '⑨', name: '운영 변경', who: hr ? '재무 ' + C.ownerLabel(C.stepUserNow('S10', root)) : '고객지원 ' + C.ownerLabel(C.stepUserNow('S09', root)),
        state: t ? 'go' : 'wait', reason: hr ? '수불부에 HR 추가 충전 반영' : t === 'PERIOD' ? '라이선스나 도메인 기간 변경' : t ? 'CK 추가 충전 반영' : '변경 종류를 기다림' },
    ];
    const BADGE = { go: ['progress', '거침'], skip: ['neutral', '생략'], wait: ['line', '답 대기'] };
    $('#route').innerHTML = '<ol class="route-list">' + items.map(function (it) {
      return '<li class="is-' + it.state + '"><span class="route-no" aria-hidden="true">' + it.no + '</span>' +
        '<span><span class="route-name">' + esc(it.name) + '</span><span class="route-who">' + esc(it.who) + '</span>' +
        '<span class="route-reason">' + esc(it.reason) + '</span></span>' + C.badge(BADGE[it.state][0], BADGE[it.state][1]) + '</li>';
    }).join('') + '</ol>';
    $('#route-desc').textContent = '운영 변경은 체크리스트, 법무, 날인, 체결본, 재무 확인 없이 진행합니다. 기간이 ' + R.periodMonths +
      '개월 넘게 바뀌거나 무상 충전이 ' + R.freeQty + '건을 넘을 때만 ③ 영업 리더가 승인합니다.';
  }
  $('#form').addEventListener('input', refresh);
  $('#form').addEventListener('change', refresh);
  refresh();
  $('#form').hidden = false;

  /* ---------- 입력 검사 (KRDS 오류 패턴) ---------- */
  // 오류 표시와 aria-invalid는 공통 함수로 (KRDS, v0.28)
  function setError(name, msg) { C.setFieldError(document.querySelector('[data-field="' + name + '"]'), msg); }
  function validate() {
    const t = typeOf(), end = $('#f-end').value;
    const msgs = [
      ['type', t ? '' : '변경 종류를 고르세요.', document.querySelector('[name="type"]')],
      ['end', t !== 'PERIOD' ? '' : !end ? '새 계약 종료일을 고르세요.' : end === b.end ? '지금 종료일과 같습니다.' : end < D.TODAY ? '새 종료일은 오늘 이후여야 합니다.' : '', $('#f-end')],
      ['qty', !t || t === 'PERIOD' ? '' : num($('#f-qty').value) > 0 ? '' : '충전 수량을 1건 이상 넣으세요.', $('#f-qty')],
      ['amount', !/_PAID$/.test(t) ? '' : num($('#f-amount').value) > 0 ? '' : '유상 충전 금액을 넣으세요.', $('#f-amount')],
      ['reason', $('#f-reason').value.trim() ? '' : '변경 사유를 적으세요.', $('#f-reason')],
      ['activity', /^https:\/\/\S+$/.test($('#f-activity').value.trim()) ? '' : 'CRM 영업활동 링크를 https://로 시작하는 주소로 넣으세요.', $('#f-activity')],
    ];
    const errors = msgs.filter(function (m) { setError(m[0], m[1]); return !!m[1]; });
    const box = $('#error-summary');
    box.hidden = !errors.length;
    if (errors.length) {
      box.innerHTML = '<p class="error-summary-title">' + C.icon('alert') + '입력하지 않았거나 고쳐야 할 항목이 ' + errors.length + '개 있습니다</p><ul>' +
        errors.map(function (e, i) { return '<li><a href="#" data-err="' + i + '">' + esc(e[1]) + '</a></li>'; }).join('') + '</ul>';
      box.onclick = function (ev) {
        const a = ev.target.closest('[data-err]');
        if (!a) return;
        ev.preventDefault();
        errors[Number(a.dataset.err)][2].focus();
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
    const rec = record(), sales = C.changeSales(rec);
    const what = rec.changeType === 'PERIOD' ? C.fmtDate(b.end) + ' 종료 → ' + C.fmtDate(rec.endDate) + ' 종료'
      : rec.changeQty.toLocaleString('ko-KR') + '건' + (rec.changeAmount ? ', ' + rec.changeAmount.toLocaleString('ko-KR') + '원 (부가세 별도)' : ' (무상)');
    $('#confirm-body').innerHTML = '<p>기안하면 ' + (sales[0] ? '③ 영업 검토부터' : '⑨ 운영 변경부터') + ' 시작되고, 결재가 끝날 때까지 고칠 수 없습니다.</p>' +
      '<dl class="confirm-list"><div><dt>계약</dt><dd>' + esc(root.counterparty + ' ' + b.id) + '</dd></div>' +
      '<div><dt>운영 변경 번호</dt><dd>' + esc(newId) + '</dd></div>' +
      '<div><dt>변경 종류</dt><dd>' + esc(D.CHANGE_TYPES[rec.changeType]) + '</dd></div>' +
      '<div><dt>변경 내용</dt><dd>' + esc(what) + '</dd></div></dl>';
    modal.hidden = false;
    C.focusModal(modal); // 제목에 포커스 (KRDS 모달, v0.28)
  });
  modal.addEventListener('click', function (e) {
    if (e.target === modal || e.target.closest('[data-act="close"]')) modal.hidden = true;
    if (!e.target.closest('[data-act="confirm"]')) return;
    // 운영 변경 기록 (데이터 정의서 contract: kind CHANGE, change_type, change_qty, change_amount, activity_url)
    const rec = record();
    C.saveDemoContract(rec);
    const next = C.pendingSteps(rec).map(function (x) { return C.stepLabel(x.step, rec) + ' (' + C.ownerLabel(x.userId) + ')'; }).join(', ');
    C.flash(newId + ' 운영 변경을 기안했습니다. 다음 차례: ' + next);
    location.href = 'review.html?id=' + encodeURIComponent(newId);
  });
  document.addEventListener('keydown', function (e) { if (!modal.hidden && e.key === 'Escape') modal.hidden = true; });
})();
