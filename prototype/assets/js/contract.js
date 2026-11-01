/* =====================================================================
 * SCR-42 계약 상세 화면 로직 (contract.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-FLOW-06, 16, 18, 19, 22, REQ-AUTH-09, REQ-SEC-08, 09, REQ-ARC-02, 03
 * 하는 일
 *   1. 주소의 번호로 계약 묶음을 찾고(common.js bundleOf), 볼 수 있는 사람인지 확인
 *   2. 지금 유효한 계약, 차수별 이력, 체결본, 사후관리 기록을 한 장으로
 *   3. 영업대표(시연용 최고관리자 포함)에게 변경 기안, 연장 기안(자동갱신이면 연장 검토), 해지 기안 버튼
 *   4. 사후관리 기록 남기기(영업대표, 법무, 관리자). 덧붙이기만 하고 고치거나 지울 수 없음
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const notice = C.noticeBox; // (kind, title, body)

  const id = new URLSearchParams(location.search).get('id');
  const found = D.CONTRACTS.find(function (c) { return c.id === id; });
  const b = found ? C.bundleOf(C.rootOf(found)) : null;
  if (!b) {
    $('#notice').innerHTML = notice('', '계약을 찾을 수 없습니다', '주소의 계약번호를 확인해 주세요. 예: contract.html?id=2601CL001');
    return;
  }
  const root = b.root;
  if (!C.canView(root, me)) {
    $('#doc-title').innerHTML = C.icon('lock') + '열람 제한 계약';
    $('#notice').innerHTML = notice('', '이 계약은 볼 수 없습니다', C.restrictedMsg);
    return;
  }

  /* ---------- 머리 ---------- */
  const st = D.STATUS[b.status];
  $('#doc-title').textContent = root.counterparty;
  $('#doc-meta').innerHTML = C.meta([esc(b.id), esc(C.serviceLabel(root.services)), esc(D.METHODS[C.methodOf(root)]), C.badge(st.tone, st.label) + (root.restricted ? ' ' + C.icon('lock', 'sm') : '')]);
  // 계약 요약서(SCR-47, v0.53): 이 묶음을 A4 한 벌로. 볼 수 있는 사람은 이 화면과 같음
  $('#btn-summary').href = 'contract-print.html?id=' + encodeURIComponent(b.id);
  $('#doc-tools').hidden = false;

  // 진행 중인 변경, 연장, 해지 안내. 반려되어 다시 기안을 기다리는 기안도 함께(영업대표에게 보완 후 재기안 링크, v0.58)
  const pend = b.open.concat(b.rejected);
  const mine = root.requesterId === me.id || me.role === 'SUPER';
  if (pend.length) {
    $('#notice').innerHTML = notice('', '진행 중인 기안이 있습니다', pend.map(function (o) {
      return '<a class="doc-link" href="review.html?id=' + encodeURIComponent(o.id) + '">' + esc(o.id) + '</a> ' + esc(C.kindLabel(o)) + ': ' +
        (o.status === 'REJECTED' ? (o.round || 1) + '차 반려' + (mine ? ' <a class="doc-link" href="' + C.resubmitHref(o) + '">보완 후 재기안</a>' : '') : C.progressText(o));
    }).join('<br>'));
  } else if (b.status === 'TERMINATED') {
    $('#notice').innerHTML = notice('', '해지된 계약입니다', '해지일 ' + C.fmtDate(root.terminateDate) + (root.terminatedAt ? ' (' + C.fmtDateTime(root.terminatedAt) + '에 해지 처리 완료)' : ''));
  }

  /* ---------- 할 일 버튼 (REQ-ARC-02) ----------
   * 지금 유효한 계약이 계약 완료일 때, 영업대표 본인(시연용 최고관리자 포함)에게만.
   * 진행 중인 연장이나 해지가 있으면 연장, 해지 버튼은 감춤 */
  const canDraft = root.requesterId === me.id || me.role === 'SUPER';
  // 반려된 연장, 해지가 있으면 같은 종류의 새 버튼 대신 위 안내의 보완 후 재기안 (v0.58)
  const blocking = b.open.some(function (o) { return o.kind === 'RENEW' || o.kind === 'TERMINATE'; });
  const rejRenew = b.rejected.some(function (o) { return o.kind === 'RENEW'; });
  const rejEnd = b.rejected.some(function (o) { return o.kind === 'TERMINATE'; });
  // 반려된 변경이 있으면 새 변경 기안(새 번호) 대신 그 변경을 보완해 다시 올림 (REQ-FLOW-17, v0.63 점검에서 고침: 변경만 빠져 있었음)
  const rejAmend = b.rejected.some(function (o) { return o.kind === 'AMEND'; });
  // 기간을 바꾸는 운영 변경이 진행 중이면 연장은 그 뒤에 (v0.58 QA)
  const periodBusy = b.open.some(function (o) { return o.kind === 'CHANGE' && o.changeType === 'PERIOD'; });
  if (b.status === 'ACTIVE' && canDraft) {
    const q = encodeURIComponent(b.id);
    $('#bundle-actions').innerHTML =
      // 변경 기안: 계약서가 바뀌는 변경(전체 결재) / 운영 변경 기안: 기간 변경이나 추가 충전만 (v0.26 재무 문서 반영)
      (rejAmend ? '' : '<a class="btn btn--tertiary btn--md" href="new-contract.html?kind=AMEND&origin=' + q + '">변경 기안</a>') +
      '<a class="btn btn--tertiary btn--md" href="ops-change.html?origin=' + q + '">운영 변경 기안</a>' +
      (blocking ? '' : (periodBusy || rejRenew ? '' : b.autoRenew === 'YES'
        ? '<a class="btn btn--secondary btn--md" href="renewal.html?origin=' + q + '">연장 검토</a>'
        : '<a class="btn btn--secondary btn--md" href="new-contract.html?kind=RENEW&origin=' + q + '">연장 기안</a>') +
        (rejEnd ? '' : '<a class="btn btn--tertiary btn--md btn-reject" href="terminate.html?origin=' + q + '">해지 기안</a>'));
    $('#bundle-actions').hidden = false;
  }

  /* ---------- 1. 지금 유효한 계약 ---------- */
  const cur = b.current;
  function info(label, value, cls) { return '<div><dt>' + esc(label) + '</dt><dd' + (cls ? ' class="' + cls + '"' : '') + '>' + value + '</dd></div>'; } // cls amount: 금액은 오른쪽(REQ-UI-16)
  // 해지 통지 기한: 만료 n일 전. 30일 안이거나 지났으면 강조 (v0.53, REQ-FLOW-32)
  function noticeDeadlineHtml() {
    if (!C.noticeDate(b)) return '';
    return '<span class="cell-meta">' + C.noticeText(b) + '<br>만료 ' + b.noticeDays + '일 전까지 상대방에게 알려야 연장되지 않음</span>';
  }
  $('#now').innerHTML = [
    info('계약번호', '<a href="review.html?id=' + encodeURIComponent(cur.id) + '">' + esc(cur.id) + '</a>'),
    info('계약종류', esc(C.kindLabel(cur))),
    info('계약 기간', b.start ? C.fmtPeriod(b.start, b.end) : '-'),
    // 정확한 금액 한 줄 + 아래 작은 줄(어림 금액, 부가세 별도). 계약 요약서와 같은 모양 (v0.59 QA: 오른쪽 정렬에서 두 줄로 어색하게 꺾였음)
    info('계약 금액', Number(cur.amount || 0).toLocaleString('ko-KR') + '원<span class="cell-meta">' + esc(C.fmtKRW(cur.amount)) + ', 부가세 별도</span>', 'amount'),
    info('자동갱신', b.autoRenew === 'YES' ? '있음' + noticeDeadlineHtml() : '없음'),
    root.unit ? info('기관 또는 부서명', esc(root.unit)) : '', // 계약마다 직접 적은 기관 이름 (C-24 v0.39, 이름 v0.46)
    info('영업대표', esc(C.ownerLabel(root.requesterId))),
    info('개인정보 처리위탁 계약', root.personalData ? '있음' : '없음'),
    info('서비스 수준 협약(SLA)', root.sla === 'YES' ? '있음' : '없음'), // v0.40
    // 지정 열람자(v0.52)도 함께: 이 묶음을 기본 밖에서 더 볼 수 있는 조직이나 사람
    info('열람 제한', root.restricted ? C.icon('lock', 'sm') + '있음' + (C.viewerText(root) ? '<span class="cell-meta">지정 열람자: ' + esc(C.viewerText(root)) + '</span>' : '') : '없음'),
    info('계약 완료일', cur.completedAt ? C.fmtDateTime(cur.completedAt) : '-'),
    info('해지일', b.status === 'TERMINATED' ? C.fmtDate(root.terminateDate) : '-'),
  ].join('');

  /* ---------- 2. 차수별 이력 ---------- */
  function termOf(c) {
    if (c.kind === 'TERMINATE') return '해지일 ' + C.fmtDate(c.terminateDate);
    const s = C.startOf(c), e = C.endOf(c);
    return s ? C.fmtPeriod(s, e) : '-';
  }
  $('#items').innerHTML = '<caption class="sr-only">차수별 이력: 계약번호, 계약종류, 기안일, 상태, 계약 기간</caption>' +
    '<thead><tr><th scope="col">계약번호</th><th scope="col">계약종류</th><th scope="col">기안일</th><th scope="col">상태</th><th scope="col">계약 기간 또는 해지일</th></tr></thead>' +
    '<tbody>' + b.items.map(function (c) {
      return '<tr' + (c === cur ? ' class="is-current"' : '') + '>' +
        '<td class="nowrap"><a class="cell-title" href="review.html?id=' + encodeURIComponent(c.id) + '">' + esc(c.id) + '</a>' + (c === cur ? '<span class="cell-meta">지금 유효</span>' : '') + '</td>' +
        '<td class="nowrap">' + esc(C.kindLabel(c)) + '</td>' +
        '<td class="num-left">' + C.fmtDate(c.requestedAt) + '</td>' +
        '<td class="nowrap">' + C.statusBadge(c) + '</td>' +
        '<td class="num-left">' + termOf(c) + '</td>' +
      '</tr>';
    }).join('') + '</tbody>';

  /* ---------- 3. 체결본 (REQ-FLOW-22, REQ-SEC-08) ---------- */
  const canOriginal = root.requesterId === me.id || ['LEGAL', 'ADMIN', 'SUPER'].indexOf(me.role) > -1;
  //   판 목록은 검토 상세와 같음(common.js signedVersions, v0.61 검토): 차수, "확인한 체결본", 바뀐 까닭(다시 등록 요청, ⑧ 반려)
  const signed = [];
  b.items.forEach(function (c) {
    C.signedVersions(c).forEach(function (v) { signed.push({ c: c, v: v }); });
  });
  $('#signed').innerHTML = signed.length ? signed.map(function (x) {
    const fate = C.signedFateText(x.v);
    return '<li' + (x.v.current ? '' : ' class="is-old"') + '><span class="file-info">' + C.badge('line', D.FILE_KINDS.SIGNED) +
      (x.v.checked ? ' ' + C.badge('success', '확인한 체결본') : '') + ' <span class="file-name">' + esc(x.v.name) + '</span>' +
      '<span class="file-size">' + esc(x.c.id) + ' ' + x.v.round + '차 기안, ' + C.fmtDateTime(x.v.at) + ' 등록' + (fate ? ', ' + fate : '') + '</span></span>' +
      '<span class="file-acts"><button type="button" class="btn-text" data-file="preview">미리보기</button>' +
      '<button type="button" class="btn-text file-dl" data-file="pdf">PDF 내려받기</button>' +
      (canOriginal ? '<button type="button" class="btn-text file-dl" data-file="original">원본 내려받기</button>' : '') + '</span></li>';
  }).join('') : '<li class="empty">아직 등록된 체결본이 없습니다.</li>';
  $('#signed').addEventListener('click', function (e) {
    const btn = e.target.closest('[data-file]');
    if (!btn) return;
    const kind = btn.getAttribute('data-file');
    C.toast(kind === 'pdf'
      ? '프로토타입: 실제 시스템에서는 이름과 일시 워터마크를 찍은 PDF로 내려받고, 누가 언제 받았는지 기록에 남깁니다.'
      : kind === 'original' ? '프로토타입: 실제 시스템에서는 원본을 내려받고 기록에 남깁니다. 원본은 기안자, 법무, 관리자만 받을 수 있습니다.'
        : '프로토타입: 실제 시스템에서는 새 창에서 파일 미리보기가 열립니다.');
  });

  /* ---------- 4. 체결 후 의무 (v0.53 기획자 결정, REQ-FLOW-33~36) ----------
   * 이 묶음의 의무: 다음 기한과 상태, 의무(종류, 언제, 근거 조항, 청구 금액), 맡은 분야, 할 일
   * 더하기는 체결본이 등록된 묶음부터, 영업대표(본인 계약), 법무, 관리자, 그 종류를 맡는 분야 [가정] */
  const OB = window.CLIMB_OB;
  function renderObligations() {
    const list = C.obligationsOf(root.id).slice().sort(function (a, b) {
      const sa = C.obligationState(a), sb = C.obligationState(b);
      return (sa.code === 'ENDED') - (sb.code === 'ENDED') || String(sa.next || '9').localeCompare(String(sb.next || '9'));
    });
    $('#obligations').innerHTML = '<caption class="sr-only">체결 후 의무: 다음 기한과 상태, 의무, 맡은 분야, 할 일</caption>' +
      '<thead><tr><th scope="col">다음 기한</th><th scope="col">의무</th><th scope="col" class="col-owner">맡은 분야</th><th scope="col" class="col-action">할 일</th></tr></thead>' +
      '<tbody>' + (list.length ? list.map(function (o) {
        const s = C.obligationState(o);
        return '<tr' + (s.code === 'LATE' ? ' class="is-alert"' : s.code === 'ENDED' ? ' class="is-muted"' : '') + '>' +
          '<td class="center">' + OB.dueHtml(o) + '</td><td>' + OB.titleHtml(o) + '<span class="cell-sub">맡은 분야 ' + esc(C.obligationOwnerLabel(o)) + '</span></td>' +
          '<td class="center nowrap col-owner">' + esc(C.obligationOwnerLabel(o)) + '</td><td class="col-action">' + OB.actionsHtml(o, me, root) + '</td></tr>';
      }).join('') : '<tr><td class="empty-row" colspan="4">' + (C.canHaveObligations(b) ? '아직 더한 의무가 없습니다.' : '체결본이 등록되면 의무를 더할 수 있습니다.') + '</td></tr>') + '</tbody>';
  }
  renderObligations();
  OB.wire($('#obligations'), me, renderObligations);
  if (C.canHaveObligations(b) && C.canAddObligation(me, root)) {
    $('#btn-ob-add').hidden = false;
    $('#btn-ob-add').addEventListener('click', function () { OB.openAdd(root, me, renderObligations); });
  }

  /* ---------- 5. 사후관리 기록 (REQ-FLOW-06, 19, REQ-SEC-09) ---------- */
  function renderNotes() {
    const list = (root.notes || []).slice().sort(function (x, y) { return y.at.localeCompare(x.at); });
    $('#notes').innerHTML = '<caption class="sr-only">사후관리 기록: 일시, 종류, 내용, 남긴 사람</caption>' +
      '<thead><tr><th scope="col">일시</th><th scope="col">종류</th><th scope="col">내용</th><th scope="col">남긴 사람</th></tr></thead>' +
      '<tbody>' + (list.length ? list.map(function (n) {
        return '<tr><td class="num-left">' + C.fmtDateTime(n.at) + '</td><td class="nowrap">' + esc(D.AFTERCARE_TYPES[n.type]) + '</td>' +
          '<td>' + esc(n.content) + '</td><td class="center">' + esc(C.ownerLabel(n.by)) + '</td></tr>';
      }).join('') : '<tr><td class="empty-row" colspan="4">남긴 기록이 없습니다.</td></tr>') + '</tbody>';
  }
  renderNotes();
  // 남길 수 있는 사람: 영업대표, 법무, 관리자(최고관리자 포함) [가정]. 계약 완료, 만료, 해지된 계약에만
  const canNote = (root.requesterId === me.id || ['LEGAL', 'ADMIN', 'SUPER'].indexOf(me.role) > -1) &&
    ['ACTIVE', 'EXPIRED', 'TERMINATED'].indexOf(root.status) > -1;
  if (canNote) {
    // 사후관리 기록 종류: 코드 관리(SCR-56)에서 사용 중인 것만
    $('#note-types').innerHTML = C.codeList('AFTERCARE').map(function (t, i) {
      return '<label class="choice"><input type="radio" name="note-type" value="' + t.code + '"' + (i === 0 ? ' checked' : '') + '>' + esc(t.label) + '</label>';
    }).join('');
    $('#note-form').hidden = false;
    $('#note-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const content = $('#note-content').value.trim();
      const type = (document.querySelector('input[name="note-type"]:checked') || {}).value;
      if (!content) {
        C.setFieldError($('#note-field'), '내용을 적어 주세요.'); // 오류 표시와 aria-invalid (KRDS, v0.28)
        $('#note-content').focus();
        return;
      }
      C.addNote(root, { type: type, by: me.id, content: content });
      $('#note-content').value = '';
      C.setFieldError($('#note-field'), '');
      renderNotes();
      C.toast('사후관리 기록을 남겼습니다(고칠 수 없음).');
    });
  }

  $('#doc').hidden = false;
})();
