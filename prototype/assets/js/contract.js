/* =====================================================================
 * SCR-42 계약 상세 화면 로직 (contract.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-FLOW-06, 16, 18, 19, 22, REQ-AUTH-09, REQ-SEC-08, 09, REQ-ARC-02, 03
 * 하는 일
 *   1. 주소의 번호로 계약 묶음을 찾고(common.js bundleOf), 볼 수 있는 사람인지 확인
 *   2. 지금 유효한 계약, 계약 이력(D-6, 예전 "차수별 이력"), 체결본, 사후관리 기록을 한 장으로
 *   3. 영업대표(시연용 최고관리자 포함)에게 변경 기안, 연장 기안(자동갱신이면 연장 검토), 해지 기안 버튼
 *      다른 영업(영업 담당자, 리더, 임원)에게는 그 자리에 회색 안내 한 줄(D-5)
 *   4. 사후관리 기록 남기기(영업대표, 법무, 관리자). 덧붙이기만 하고 고치거나 지울 수 없음
 *   5. 기획자 결정 2026-11-02 A-10, A-11: 만료 처리와 유예
 *      종료일이 지났는데 서비스를 닫기 전이면 머리의 상태를 "만료, 서비스 닫기 전"으로, 맨 위 안내 상자에 누구 차례인지와 단추
 *      단추: 고객지원은 만료 처리(해지의 ⑨와 같은 확인), 영업대표는 유예 요청, 영업 리더는 유예 확인과 반려
 *      처리 규칙과 창은 common.js "만료 처리와 유예". 처리하면 화면을 다시 불러옴. 기록은 결재 문서의 결재 기록에 남음
 *   6. 기획자 결정 2026-11-02 B-5, B-8: 체결본 목록에 견적서로 계약서를 대신한 계약의 최종 견적서, 서명본 체결일
 *      지금 유효한 계약에 서명본 체결일과 실제 개통일(B-8), 계약 이력에 재무 의견 건수와 결재 문서 링크(B-6)
 *      만료되었어도 서비스를 닫기 전이면 영업대표에게 늦은 연장 기안 단추(A-11)
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
  // 만료 처리와 유예(기획자 결정 2026-11-02 A-10, A-11): 종료일이 지났으면 상태 배지를 "만료, 서비스 닫기 전", "유예 중 (~기한)"처럼
  const ex = C.expiryOf(b);
  const exOn = !!ex && ex.ended && !!ex.label;
  $('#doc-title').textContent = root.counterparty;
  $('#doc-meta').innerHTML = C.meta([esc(b.id), esc(C.serviceLabel(root.services)), esc(D.METHODS[C.methodOf(root)]),
    (exOn ? C.badge(ex.tone, ex.label) : C.badge(st.tone, st.label)) + (root.restricted ? ' ' + C.icon('lock', 'sm') : '')]);
  // 계약 요약서(SCR-47, v0.53): 이 묶음을 A4 한 벌로. 볼 수 있는 사람은 이 화면과 같음
  $('#btn-summary').href = 'contract-print.html?id=' + encodeURIComponent(b.id);
  $('#doc-tools').hidden = false;

  // 진행 중인 변경, 연장, 해지 안내. 반려되어 다시 기안을 기다리는 기안도 함께(영업대표에게 보완 후 재기안 링크, v0.58)
  const pend = b.open.concat(b.rejected);
  const mine = root.requesterId === me.id || me.role === 'SUPER';
  /* 만료 처리와 유예 안내 (기획자 결정 2026-11-02 A-10, A-11): 지금 누구 차례인지와 그 사람의 단추(누를 수 있는 사람은 common.js가 정함)
   *   만료, 서비스 닫기 전: 고객지원의 만료 처리 차례(대기 일수), 요청 중인 유예가 있으면 영업 리더의 확인 차례도
   *   유예 중: 확인한 사람, 때, 사유 / 만료 처리 끝: 처리한 사람과 확인 항목 / 연장 진행 중: 그 기안 링크
   *   끝나기 전: 요청 중이거나 확인된 유예. 영업대표의 유예 요청 단추는 아래 기안 단추 줄에 */
  function exButtons() {
    return (C.canCloseExpiry(b, me) ? '<button type="button" class="btn btn--primary btn--md" data-ex="close">만료 처리</button>' : '') +
      (C.canDecideGrace(b, me) ? '<button type="button" class="btn btn--secondary btn--md" data-ex="ok">유예 확인</button>' +
        '<button type="button" class="btn btn--tertiary btn--md btn-reject" data-ex="no">유예 반려</button>' : '') +
      (C.canAskGrace(b, me) && (ex.ended || ex.note) ? '<button type="button" class="btn btn--tertiary btn--md" data-ex="ask">유예 요청</button>' : '');
  }
  function exNotice() {
    if (!ex || (!ex.ended && !ex.note)) return '';
    const h = ex.holder, acts = exButtons();
    const who = function (e) { return esc(C.josa(C.ownerLabel(e.actorId, e.actorDept), '이', '가')) + ' ' + C.fmtDateTime(e.at) + '에'; };
    const askLine = ex.askStep ? (ex.ended ? '<br>' : '') + '유예 요청: ' + esc(C.ownerLabel(ex.ask.entry.actorId, ex.ask.entry.actorDept)) + ', 기한 ' + C.fmtDate(ex.ask.until) + '. ' +
      esc(C.stepTag('SGR', h) + ' ' + C.ownerLabel(ex.askStep.userId)) + '의 확인 차례(' + C.waitDays(h, ex.askStep) + '일째). ' + esc(ex.ask.entry.comment || '') : '';
    if (ex.state === 'OPEN') {
      // A-11: 확인된 유예의 기한이 지나 다시 차례가 된 것이면 그 기한도 알림(차례는 기한 다음 날부터, 2509CL003 시연)
      return notice('', ex.label, '종료일(' + C.fmtDate(ex.end) + ')이 지났고 연장이나 새 계약 기안이 없습니다. ' +
        (ex.grace ? '확인된 유예의 기한(' + C.fmtDate(ex.grace.until) + ')도 지났습니다. ' : '') + esc(C.stepTag('SXP', h) + ' ' + C.ownerLabel(ex.step.userId)) +
        '의 만료 처리 차례입니다(' + C.waitDays(h, ex.step) + '일째). 해지할 때처럼 서비스를 닫고 계약 종료일을 설정합니다.' + askLine, acts);
    }
    if (ex.state === 'GRACE') {
      return notice('', ex.label, '연장 협상 중이라 ' + who(ex.grace.decision) + ' 유예를 확인했습니다. 사유: ' + esc(ex.grace.entry.comment || '') +
        '<br>기한이 지나면 다시 고객지원의 만료 처리 차례가 됩니다.', acts);
    }
    if (ex.state === 'DONE') return notice('success', '만료 처리 완료', who(ex.done) + ' 서비스를 닫았습니다. ' + esc(ex.done.comment || ''));
    if (ex.state === 'OFF') {
      return notice('', ex.label, '종료일(' + C.fmtDate(ex.end) + ')이 지났지만 <a class="doc-link" href="review.html?id=' + encodeURIComponent(ex.block.id) + '">' + esc(ex.block.id) + '</a> ' +
        esc(C.kindLabel(ex.block)) + ' 기안이 있어 만료 처리를 하지 않습니다.');
    }
    // 끝나기 전에 요청하거나 확인된 유예
    return notice('', ex.note, ex.askStep ? askLine : who(ex.grace.decision) + ' 유예를 확인했습니다. 사유: ' + esc(ex.grace.entry.comment || ''), acts);
  }
  let noticeHtml = exNotice();
  if (pend.length) {
    noticeHtml += notice('', '진행 중인 기안이 있습니다', pend.map(function (o) {
      return '<a class="doc-link" href="review.html?id=' + encodeURIComponent(o.id) + '">' + esc(o.id) + '</a> ' + esc(C.kindLabel(o)) + ': ' +
        (o.status === 'REJECTED' ? (o.round || 1) + '차 반려' + (mine ? ' <a class="doc-link" href="' + C.resubmitHref(o) + '">보완 후 재기안</a>' : '') : C.progressText(o));
    }).join('<br>'));
  } else if (b.status === 'TERMINATED') {
    noticeHtml += notice('', '해지된 계약입니다', '해지일 ' + C.fmtDate(root.terminateDate) + (root.terminatedAt ? ' (' + C.fmtDateTime(root.terminatedAt) + '에 해지 처리 완료)' : ''));
  }
  $('#notice').innerHTML = noticeHtml;
  // 만료 처리와 유예 단추: 처리한 뒤 화면을 다시 불러와 상태와 단추를 새로 그림(결재 문서처럼). 안내 글은 다음 화면에서 한 번
  function exAfter(msg) { C.flash(msg); location.reload(); }
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('#notice [data-ex], #bundle-actions [data-ex]');
    if (!btn) return;
    const act = btn.getAttribute('data-ex');
    if (act === 'close') C.openExpiryClose(b, me, exAfter);
    else if (act === 'ask') C.openGraceAsk(b, me, exAfter);
    else C.openGraceDecide(b, me, act === 'ok', exAfter);
  });

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
        (rejEnd ? '' : '<a class="btn btn--tertiary btn--md btn-reject" href="terminate.html?origin=' + q + '">해지 기안</a>')) +
      // 기획자 결정 2026-11-02 A-11: 끝나기 30일 전부터 연장 협상이 이어지면 유예 요청(요청 중이거나 확인된 유예가 있으면 위 안내 상자에)
      (C.canAskGrace(b, me) && !(ex && ex.note) ? '<button type="button" class="btn btn--tertiary btn--md" data-ex="ask">유예 요청</button>' : '');
    $('#bundle-actions').hidden = false;
  } else if (b.status === 'EXPIRED' && canDraft && ex && (ex.state === 'OPEN' || ex.state === 'GRACE') && !blocking && !rejRenew) {
    // 기획자 결정 2026-11-02 A-11: 만료되었어도 서비스를 닫기 전(만료 처리 차례, 유예 중)이면 늦은 연장 기안. 유예의 끝이 연장 기안이 되게
    //   계약 등록(new-contract.js)과 연장 검토(renewal.js)가 같은 규칙으로 받음. 기안하면 만료 처리 차례가 없어짐. 변경과 해지는 없음
    const q = encodeURIComponent(b.id);
    $('#bundle-actions').innerHTML = b.autoRenew === 'YES'
      ? '<a class="btn btn--secondary btn--md" href="renewal.html?origin=' + q + '">연장 검토</a>'
      : '<a class="btn btn--secondary btn--md" href="new-contract.html?kind=RENEW&origin=' + q + '">연장 기안</a>';
    $('#bundle-actions').hidden = false;
  } else if (b.status === 'ACTIVE' && C.hasRole(me, ['SALES', 'HEAD', 'EXEC'])) {
    // 기획자 결정 2026-11-02 D-5(C-40 ⑤): 다른 영업(영업 담당자, 리더, 임원)에게만 단추 자리에 회색 안내 한 줄
    //   법무, 재무 같은 다른 역할은 기안할 일이 없어 예전처럼 아무것도 보이지 않음(결정이 "다른 영업이 볼 때")
    //   문장은 운영 변경, 해지 화면의 안내와 같음. A-3(같은 날): 변경과 연장도 영업대표 본인만 기안(최고관리자는 시연용)
    //   종이에서는 단추 줄과 함께 감춤(review.css .bundle-actions)
    $('#bundle-actions').innerHTML = '<p class="section-desc bundle-note">영업대표만 기안합니다. 이 계약의 영업대표는 ' + esc(C.ownerLabel(root.requesterId)) + '입니다.</p>';
    $('#bundle-actions').hidden = false;
  }

  /* ---------- 1. 지금 유효한 계약 ---------- */
  const cur = b.current;
  const curSigns = !C.isShort(cur) && !C.isChange(cur); // ⑦ ⑨에서 날짜를 받는 계약(신규, 변경, 바꿔서 연장)
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
    // 기획자 결정 2026-11-02 B-8: 지금 유효한 계약의 서명본 체결일(⑦, 견적서로 대신했으면 고객 날인일)과 실제 개통일(⑨). 날인과 체결본을 거치는 계약만
    curSigns ? info(C.isQuoteInstead(cur) ? '고객 날인일' : '서명본 체결일', C.signedDate(cur) ? C.fmtDate(C.signedDate(cur)) + '<span class="cell-meta">올린 날 ' + C.fmtDate(cur.signedAt) + '</span>' : '-') : '',
    curSigns ? info('실제 개통일', C.openDate(cur) ? C.fmtDate(C.openDate(cur)) : '-') : '',
    info('계약 완료일', cur.completedAt ? C.fmtDateTime(cur.completedAt) : '-'),
    info('해지일', b.status === 'TERMINATED' ? C.fmtDate(root.terminateDate) : '-'),
    // 만료 처리(기획자 결정 2026-11-02 A-10): 종료일이 지난 계약만. 처리한 때와 사람, 아니면 지금 상태
    exOn ? info('만료 처리', ex.done ? C.fmtDateTime(ex.done.at) + '<span class="cell-meta">' + esc(C.ownerLabel(ex.done.actorId, ex.done.actorDept)) + ' 처리</span>'
      : esc(ex.label) + (ex.step && ex.step.state === 'PENDING' ? '<span class="cell-meta">' + esc(C.ownerLabel(ex.step.userId)) + ' 차례, ' + C.waitDays(ex.holder, ex.step) + '일째</span>' : '')) : '',
  ].join('');

  /* ---------- 2. 계약 이력 ----------
   * 기획자 결정 2026-11-02 D-6(C-40 ⑥): 이름을 "차수별 이력"에서 "계약 이력"으로. 반려 뒤 다시 올린 기안도 "2차 기안"처럼
   * 차수라고 불러 "차수"가 두 뜻이었음. 이 표는 원계약과 후속 기안(변경, 운영 변경, 연장, 해지)을 한 줄씩 보여 줌 */
  function termOf(c) {
    if (c.kind === 'TERMINATE') return '해지일 ' + C.fmtDate(c.terminateDate);
    const s = C.startOf(c), e = C.endOf(c);
    return s ? C.fmtPeriod(s, e) : '-';
  }
  $('#items').innerHTML = '<caption class="sr-only">계약 이력: 계약번호, 계약종류, 기안일, 상태, 계약 기간 또는 해지일</caption>' +
    '<thead><tr><th scope="col">계약번호</th><th scope="col">계약종류</th><th scope="col">기안일</th><th scope="col">상태</th><th scope="col">계약 기간 또는 해지일</th></tr></thead>' +
    '<tbody>' + b.items.map(function (c) {
      return '<tr' + (c === cur ? ' class="is-current"' : '') + '>' +
        '<td class="nowrap"><a class="cell-title" href="review.html?id=' + encodeURIComponent(c.id) + '">' + esc(c.id) + '</a>' + (c === cur ? '<span class="cell-meta">지금 유효</span>' : '') +
          // 기획자 결정 2026-11-02 B-6: 체결 전에 남긴 재무 의견이 있으면 결재 문서의 재무 의견 칸으로
          ((c.finOpinions || []).length ? '<span class="cell-meta"><a href="review.html?id=' + encodeURIComponent(c.id) + '#fin-opinion">재무 의견 ' + c.finOpinions.length + '건</a></span>' : '') + '</td>' +
        '<td class="nowrap">' + esc(C.kindLabel(c)) + '</td>' +
        '<td class="num-left">' + C.fmtDate(c.requestedAt) + '</td>' +
        // 종료일이 지난 지금 유효한 계약은 만료 처리 상태로(A-10, 머리의 배지와 같음)
        '<td class="nowrap">' + (exOn && c === ex.holder ? C.badge(ex.tone, ex.label) : C.statusBadge(c)) + '</td>' +
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
  //   기획자 결정 2026-11-02 B-5: 견적서로 계약서를 대신한 계약은 최종 견적서(고객 날인)로 보임. B-8: 서명본 체결일이 있으면 함께
  $('#signed').innerHTML = signed.length ? signed.map(function (x) {
    const fate = C.signedFateText(x.v), quote = x.v.doc === 'QUOTE';
    return '<li' + (x.v.current ? '' : ' class="is-old"') + '><span class="file-info">' + C.badge('line', D.FILE_KINDS[x.v.doc] || D.FILE_KINDS.SIGNED) +
      // REQ-SIGN-04: 배지는 결재 문서와 같게 "확인한 최종 견적서". B-5: 견적서로 대신한 계약은 서명본 체결일 대신 고객 날인일
      (quote ? ' ' + C.badge('line', '계약서 대신') : '') + (x.v.checked ? ' ' + C.badge('success', quote ? '확인한 최종 견적서' : '확인한 체결본') : '') + ' <span class="file-name">' + esc(x.v.name) + '</span>' +
      '<span class="file-size">' + esc(x.c.id) + ' ' + x.v.round + '차 기안, ' + C.fmtDateTime(x.v.at) + ' 등록' + (x.v.signDate ? ', ' + (quote ? '고객 날인일 ' : '서명본 체결일 ') + C.fmtDate(x.v.signDate) : '') + (fate ? ', ' + fate : '') + '</span></span>' +
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
