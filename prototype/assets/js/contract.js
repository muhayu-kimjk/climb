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
  const notice = function (kind, title, body) {
    return '<div class="notice' + (kind ? ' notice--' + kind : '') + '" role="status"><p class="notice-title">' +
      C.icon(kind === 'success' ? 'check' : 'alert') + esc(title) + '</p>' + (body ? '<p>' + body + '</p>' : '') + '</div>';
  };

  const id = new URLSearchParams(location.search).get('id');
  C.breadcrumb([['보관함', 'contracts.html'], ['계약 상세' + (id ? ' ' + id : '')]]);
  const found = D.CONTRACTS.find(function (c) { return c.id === id; });
  const b = found ? C.bundleOf(C.rootOf(found)) : null;
  if (!b) {
    $('#notice').innerHTML = notice('', '계약을 찾을 수 없습니다', '주소의 계약번호를 확인해 주세요. 예: contract.html?id=2601CL001');
    return;
  }
  const root = b.root;
  if (!C.canView(root, me)) {
    $('#doc-title').innerHTML = C.icon('lock') + '열람 제한 계약';
    $('#notice').innerHTML = notice('', '이 계약은 볼 수 없습니다', '열람 제한 계약은 요청자, 그 계약의 결재선과 단계 담당자, 관리자만 볼 수 있습니다.');
    return;
  }

  /* ---------- 머리 ---------- */
  const st = D.STATUS[b.status];
  $('#doc-title').textContent = root.counterparty;
  $('#doc-meta').innerHTML = C.meta([esc(b.id), esc(C.serviceLabel(root.services)), esc(root.type), C.badge(st.tone, st.label) + (root.restricted ? ' ' + C.icon('lock', 'sm') : '')]);

  // 진행 중인 변경, 연장, 해지 안내
  if (b.open.length) {
    $('#notice').innerHTML = notice('', '진행 중인 기안이 있습니다', b.open.map(function (o) {
      return '<a href="review.html?id=' + encodeURIComponent(o.id) + '">' + esc(o.id) + '</a> ' + esc(C.kindLabel(o)) + ': ' + C.progressText(o);
    }).join('<br>'));
  } else if (b.status === 'TERMINATED') {
    $('#notice').innerHTML = notice('', '해지된 계약입니다', '해지일 ' + C.fmtDate(root.terminateDate) + (root.terminatedAt ? ' (' + C.fmtDateTime(root.terminatedAt) + '에 해지 처리 완료)' : ''));
  }

  /* ---------- 할 일 버튼 (REQ-ARC-02) ----------
   * 지금 유효한 계약이 계약 완료일 때, 영업대표 본인(시연용 최고관리자 포함)에게만.
   * 진행 중인 연장이나 해지가 있으면 연장, 해지 버튼은 감춤 */
  const canDraft = root.requesterId === me.id || me.role === 'SUPER';
  const blocking = b.open.some(function (o) { return o.kind === 'RENEW' || o.kind === 'TERMINATE'; });
  if (b.status === 'ACTIVE' && canDraft) {
    const q = encodeURIComponent(b.id);
    $('#bundle-actions').innerHTML =
      // 변경 기안: 계약서가 바뀌는 변경(전체 결재) / 운영 변경 기안: 기간 변경이나 추가 충전만 (v0.26 재무 문서 반영)
      '<a class="btn btn--tertiary btn--md" href="new-contract.html?kind=AMEND&origin=' + q + '">변경 기안</a>' +
      '<a class="btn btn--tertiary btn--md" href="ops-change.html?origin=' + q + '">운영 변경 기안</a>' +
      (blocking ? '' : (b.autoRenew === 'YES'
        ? '<a class="btn btn--secondary btn--md" href="renewal.html?origin=' + q + '">연장 검토</a>'
        : '<a class="btn btn--secondary btn--md" href="new-contract.html?kind=RENEW&origin=' + q + '">연장 기안</a>') +
        '<a class="btn btn--tertiary btn--md btn-reject" href="terminate.html?origin=' + q + '">해지 기안</a>');
    $('#bundle-actions').hidden = false;
  }

  /* ---------- 1. 지금 유효한 계약 ---------- */
  const cur = b.current;
  function info(label, value) { return '<div><dt>' + esc(label) + '</dt><dd>' + value + '</dd></div>'; }
  function notice60() {
    if (b.autoRenew !== 'YES' || !b.noticeDays || !b.end) return '';
    const d = new Date(b.end.replace(/-/g, '/'));
    d.setDate(d.getDate() - b.noticeDays);
    const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    return ' (해지 통지 기한: 만료 ' + b.noticeDays + '일 전, ' + C.fmtDate(iso) + ')';
  }
  $('#now').innerHTML = [
    info('계약번호', '<a href="review.html?id=' + encodeURIComponent(cur.id) + '">' + esc(cur.id) + '</a>'),
    info('계약종류', esc(C.kindLabel(cur))),
    info('계약 기간', b.start ? C.fmtPeriod(b.start, b.end) : '-'),
    info('계약 금액', cur.amount ? Number(cur.amount).toLocaleString('ko-KR') + '원 (' + esc(C.fmtKRW(cur.amount)) + ', 부가세 별도)' : '금액 없음'),
    info('자동갱신', b.autoRenew === 'YES' ? '있음' + notice60() : '없음'),
    root.unit ? info('기관(부서)', esc(root.unit)) : '', // 거래처 아래 기관 (C-24 v0.39)
    info('영업대표', esc(C.userName(root.requesterId)) + '님'),
    info('개인정보 처리위탁 계약', root.personalData ? '있음' : '없음'),
    info('서비스 수준 협약(SLA)', root.sla === 'YES' ? '있음' : '없음'), // v0.40
    info('열람 제한', root.restricted ? C.icon('lock', 'sm') + '있음' : '없음'),
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
  const signed = [];
  b.items.forEach(function (c) {
    (c.history || []).filter(function (h) { return h.action === 'REGISTER'; }).forEach(function (h) {
      signed.push({ c: c, name: h.fileName || c.counterparty + '_체결본.pdf', at: h.at });
    });
  });
  $('#signed').innerHTML = signed.length ? signed.map(function (x) {
    return '<li><span class="file-info">' + C.badge('line', D.FILE_KINDS.SIGNED) + ' <span class="file-name">' + esc(x.name) + '</span>' +
      '<span class="file-size">' + esc(x.c.id) + ', ' + C.fmtDateTime(x.at) + ' 등록</span></span>' +
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

  /* ---------- 4. 사후관리 기록 (REQ-FLOW-06, 19, REQ-SEC-09) ---------- */
  function renderNotes() {
    const list = (root.notes || []).slice().sort(function (x, y) { return y.at.localeCompare(x.at); });
    $('#notes').innerHTML = '<caption class="sr-only">사후관리 기록: 일시, 종류, 내용, 남긴 사람</caption>' +
      '<thead><tr><th scope="col">일시</th><th scope="col">종류</th><th scope="col">내용</th><th scope="col">남긴 사람</th></tr></thead>' +
      '<tbody>' + (list.length ? list.map(function (n) {
        return '<tr><td class="num-left">' + C.fmtDateTime(n.at) + '</td><td class="nowrap">' + esc(D.AFTERCARE_TYPES[n.type]) + '</td>' +
          '<td>' + esc(n.content) + '</td><td class="nowrap">' + esc(C.userName(n.by)) + '님</td></tr>';
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
