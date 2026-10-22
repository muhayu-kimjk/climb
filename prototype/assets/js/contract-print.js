/* =====================================================================
 * SCR-47 계약 요약서 화면 로직 (contract-print.js, v0.53 기획자 요청, 요구사항 정의서 REQ-ARC-09)
 * ---------------------------------------------------------------------
 * 하는 일
 *   1. 주소의 번호로 계약 묶음을 찾고(common.js bundleOf), 볼 수 있는 사람인지 확인(계약 상세와 같음)
 *   2. A4 문서 한 벌: 계약 개요, 차수와 금액(체크리스트 답 함께), 차수마다 결재 기록, 체결본 목록, 체결 후 의무(v0.53), 사후관리 기록
 *   3. "A4로 인쇄": 브라우저 인쇄. 워터마크(출력자, 일시)는 공통 인쇄 규칙이 찍음(REQ-SEC-07)
 * 제품 줄, 체크리스트 비고, 첨부 파일과 판은 차수별 결재 문서(SCR-23)에 있어 여기서는 적지 않음(문서가 길어지지 않게)
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };

  const id = new URLSearchParams(location.search).get('id');
  C.breadcrumb([['보관함', 'contracts.html'], ['계약 상세' + (id ? ' ' + id : ''), 'contract.html?id=' + encodeURIComponent(id || '')], ['계약 요약서']]);
  const found = D.CONTRACTS.find(function (c) { return c.id === id; });
  const b = found ? C.bundleOf(C.rootOf(found)) : null;
  const notice = function (title, body) {
    return '<div class="notice" role="status"><p class="notice-title">' + C.icon('alert') + esc(title) + '</p><p>' + body + '</p></div>';
  };
  if (!b) {
    $('#notice').innerHTML = notice('계약을 찾을 수 없습니다', '주소의 계약번호를 확인해 주세요. 예: contract-print.html?id=2601CL001');
    return;
  }
  const root = b.root, cur = b.current;
  if (!C.canView(root, me)) {
    $('#doc-title').innerHTML = C.icon('lock') + '열람 제한 계약';
    $('#notice').innerHTML = notice('이 계약은 볼 수 없습니다', '열람 제한 계약은 요청자, 그 계약의 결재선과 단계 담당자, 관리자, 지정 열람자만 볼 수 있습니다.');
    return;
  }

  /* ---------- 머리 ---------- */
  const st = D.STATUS[b.status];
  $('#doc-title').textContent = root.counterparty + ' 계약 요약서';
  $('#doc-meta').innerHTML = C.meta([esc(b.id), esc(C.serviceLabel(root.services)), C.badge(st.tone, st.label), '기준일 ' + C.fmtDate(D.TODAY)]);
  $('#doc-tools').hidden = false;
  $('#btn-print').addEventListener('click', function () { window.print(); });

  /* ---------- 1. 계약 개요 ---------- */
  function info(label, value) { return '<div><dt>' + esc(label) + '</dt><dd>' + value + '</dd></div>'; }
  const bizNo = (root.form && root.form.bizNo) || (D.CUSTOMERS.filter(function (cu) { return cu.name === root.counterparty; })[0] || {}).bizNo;
  const yes = function (v) { return v ? '있음' : '없음'; };
  $('#summary').innerHTML = [
    info('고객사', esc(root.counterparty) + (root.unit ? '<span class="cell-meta">기관 또는 부서명: ' + esc(root.unit) + '</span>' : '')),
    bizNo ? info('사업자등록번호', esc(C.fmtBizNo(bizNo))) : '',
    info('서비스', esc(C.serviceLabel(root.services))),
    info('계약 유형', esc(root.type || '-')),
    info('지금 유효한 계약', esc(cur.id) + '<span class="cell-meta">' + esc(C.kindLabel(cur)) + '</span>'),
    info('계약 기간', b.start ? C.fmtPeriod(b.start, b.end) : '-'),
    info('계약 금액', cur.amount ? Number(cur.amount).toLocaleString('ko-KR') + '원<span class="cell-meta">' + esc(C.fmtKRW(cur.amount)) + ', 부가세 별도</span>' : '금액 없음'),
    info('자동갱신', b.autoRenew === 'YES' ? '있음' + (C.noticeDate(b) ? '<span class="cell-meta">' + C.noticeText(b) + '</span>' : '') : '없음'),
    // 표준계약서 판 관리(v0.53) 전에 맺은 계약은 판 기록이 없음
    info('기준 표준계약서', C.templateLabel(root) === '-' ? '판 기록 없음<span class="cell-meta">표준계약서 판 관리를 시작하기 전에 맺은 계약</span>' : esc(C.templateLabel(root))),
    info('개인정보 처리위탁', yes(root.personalData)),
    info('서비스 수준 협약(SLA)', yes(root.sla === 'YES')),
    info('영업대표', esc(C.ownerLabel(root.requesterId))),
    info('열람 제한', root.restricted ? '있음' + (C.viewerText(root) ? '<span class="cell-meta">지정 열람자: ' + esc(C.viewerText(root)) + '</span>' : '') : '없음'),
    info(b.status === 'TERMINATED' ? '해지일' : '계약 완료일', b.status === 'TERMINATED' ? C.fmtDate(root.terminateDate) : cur.completedAt ? C.fmtDateTime(cur.completedAt) : '-'),
  ].join('');

  /* ---------- 2. 차수와 금액 ---------- */
  function termOf(c) {
    if (c.kind === 'TERMINATE') return '해지일 ' + C.fmtDate(c.terminateDate);
    const s = C.startOf(c), e = C.endOf(c);
    return s ? C.fmtPeriod(s, e) : '-';
  }
  function moneyOf(c) {
    if (C.isChange(c)) return c.changeAmount ? Number(c.changeAmount).toLocaleString('ko-KR') + '원' : '-';
    return c.amount ? Number(c.amount).toLocaleString('ko-KR') + '원' : '-';
  }
  // 체크리스트 답: "1번 아니요, 2번 예, 3번 예" (4번은 답이 있을 때만)
  function checkText(c) {
    const k = c.checklist;
    if (!k) return '';
    const a = function (v) { return v === 'YES' ? '예' : v === 'NO' ? '아니요' : '-'; };
    return '체크리스트 1번 ' + a(k.standard) + ', 2번 ' + a(k.price) + ', 3번 ' + a(k.cap) + (k.accounting ? ', 4번 ' + a(k.accounting) : '');
  }
  $('#rounds').innerHTML = '<caption class="sr-only">차수와 금액: 계약번호와 기안일, 계약종류와 체크리스트, 상태, 계약 기간 또는 해지일, 금액</caption>' +
    '<thead><tr><th scope="col">계약번호</th><th scope="col">계약종류</th><th scope="col">상태</th><th scope="col">계약 기간 또는 해지일</th><th scope="col" class="num">금액</th></tr></thead>' +
    '<tbody>' + b.items.map(function (c) {
      return '<tr' + (c === cur ? ' class="is-current"' : '') + '>' +
        '<td class="nowrap">' + esc(c.id) + '<span class="cell-meta">기안 ' + C.fmtDate(c.requestedAt) + (c === cur ? ', 지금 유효' : '') + '</span></td>' +
        '<td>' + esc(C.kindLabel(c)) + (checkText(c) ? '<span class="cell-meta">' + esc(checkText(c)) + '</span>' : '') + '</td>' +
        '<td class="center nowrap">' + C.statusBadge(c) + '</td>' +
        '<td class="num-left">' + termOf(c) + '</td>' +
        '<td class="num nowrap">' + moneyOf(c) + '</td></tr>';
    }).join('') + '</tbody>';

  /* ---------- 3. 결재 기록: 차수마다 ---------- */
  function doneLabel(s) {
    if (s.state === 'REJECTED') return '반려';
    if (s.state === 'PENDING') return '처리 전(차례)';
    return D.STEPS[s.step].doneAction || '승인';
  }
  $('#approvals').innerHTML = b.items.map(function (c) {
    const rows = [{ step: '① 기안', act: '기안', who: C.ownerLabel(c.requesterId), at: c.requestedAt, note: '' }].concat(
      (c.approvals || []).filter(function (s) { return ['DONE', 'REJECTED', 'PENDING'].indexOf(s.state) > -1; }).map(function (s) {
        const who = s.state === 'PENDING' ? s.userId : s.decidedBy;
        return { step: C.stepLabel(s.step, c), act: doneLabel(s), who: (who ? C.ownerLabel(who) : '-') + (s.onBehalfOf ? ' (대신 처리: ' + C.ownerLabel(s.onBehalfOf) + ')' : ''),
          at: s.state === 'PENDING' ? '' : s.decidedAt, note: s.comment || '' };
      }));
    return '<h3 class="round-title">' + esc(c.id) + ' ' + esc(C.kindLabel(c)) + ' <span class="round-sub">' + esc(D.STATUS[c.status].label) + '</span></h3>' +
      '<div class="tbl-wrap"><table class="tbl tbl--compact">' +
      '<caption class="sr-only">' + esc(c.id) + ' 결재 기록: 단계, 처리, 처리한 사람, 일시, 의견</caption>' +
      '<thead><tr><th scope="col">단계</th><th scope="col">처리</th><th scope="col">처리한 사람</th><th scope="col">일시</th><th scope="col">의견</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td class="nowrap">' + esc(r.step) + '</td><td class="center nowrap">' + esc(r.act) + '</td><td class="center">' + esc(r.who) + '</td>' +
          '<td class="center nowrap">' + (r.at ? C.fmtDateTime(r.at) : '-') + '</td><td>' + esc(r.note || '-') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }).join('');

  /* ---------- 4. 체결본 ---------- */
  const signed = [];
  b.items.forEach(function (c) {
    (c.history || []).filter(function (h) { return h.action === 'REGISTER'; }).forEach(function (h) {
      signed.push({ c: c, name: h.fileName || c.counterparty + '_체결본.pdf', at: h.at, by: h.actorId });
    });
  });
  $('#signed').innerHTML = '<caption class="sr-only">체결본: 파일, 차수, 올린 사람, 일시</caption>' +
    '<thead><tr><th scope="col">파일</th><th scope="col">차수</th><th scope="col">올린 사람</th><th scope="col">일시</th></tr></thead><tbody>' +
    (signed.length ? signed.map(function (x) {
      const last = signed.filter(function (y) { return y.c === x.c; }).pop() === x;
      return '<tr><td>' + esc(x.name) + (last ? '' : '<span class="cell-meta">다시 등록 요청으로 바뀐 앞 판(지우지 않음)</span>') + '</td><td class="nowrap">' + esc(x.c.id) + '</td>' +
        '<td class="center">' + esc(C.ownerLabel(x.by)) + '</td><td class="center">' + C.fmtDateTime(x.at) + '</td></tr>';
    }).join('') : '<tr><td class="empty-row" colspan="4">아직 등록된 체결본이 없습니다.</td></tr>') + '</tbody>';

  /* ---------- 5. 체결 후 의무 (v0.53 기획자 결정, REQ-FLOW-33~36) ---------- */
  const obs = C.obligationsOf(root.id);
  $('#obligations').innerHTML = '<caption class="sr-only">체결 후 의무: 의무, 종류, 언제, 맡은 분야, 상태와 이행</caption>' +
    '<thead><tr><th scope="col">의무</th><th scope="col">종류</th><th scope="col">언제</th><th scope="col">맡은 분야</th><th scope="col">상태와 이행</th></tr></thead><tbody>' +
    (obs.length ? obs.map(function (o) {
      const s = C.obligationState(o), recs = o.records || [];
      const last = recs.length ? recs.slice().sort(function (x, y) { return y.at.localeCompare(x.at); })[0] : null;
      return '<tr><td>' + esc(o.title) + (o.clause ? '<span class="cell-meta">' + esc(o.clause) + '</span>' : '') + '</td>' +
        '<td class="center nowrap">' + esc((D.OBLIGATION_KINDS[o.kind] || {}).label || o.kind) + '</td>' +
        '<td>' + esc(C.obligationWhenText(o)) + (o.amount ? '<span class="cell-meta">' + Number(o.amount).toLocaleString('ko-KR') + '원</span>' : '') + '</td>' +
        '<td class="center nowrap">' + esc(C.obligationOwnerLabel(o)) + '</td>' +
        '<td class="center">' + C.badge(s.tone, s.label) + (s.next ? '<span class="cell-meta">다음 ' + C.fmtDate(s.next) + '</span>' : '') +
          '<span class="cell-meta">이행 기록 ' + recs.length + '건' + (last ? ', 마지막 ' + C.fmtDate(last.at) : '') + '</span></td></tr>';
    }).join('') : '<tr><td class="empty-row" colspan="5">더한 의무가 없습니다.</td></tr>') + '</tbody>';

  /* ---------- 6. 사후관리 기록 ---------- */
  const notes = (root.notes || []).slice().sort(function (x, y) { return x.at.localeCompare(y.at); });
  $('#notes').innerHTML = '<caption class="sr-only">사후관리 기록: 일시, 종류, 내용, 남긴 사람</caption>' +
    '<thead><tr><th scope="col">일시</th><th scope="col">종류</th><th scope="col">내용</th><th scope="col">남긴 사람</th></tr></thead><tbody>' +
    (notes.length ? notes.map(function (n) {
      return '<tr><td class="center">' + C.fmtDateTime(n.at) + '</td><td class="center nowrap">' + esc(D.AFTERCARE_TYPES[n.type]) + '</td>' +
        '<td>' + esc(n.content) + '</td><td class="center">' + esc(C.ownerLabel(n.by)) + '</td></tr>';
    }).join('') : '<tr><td class="empty-row" colspan="4">남긴 기록이 없습니다.</td></tr>') + '</tbody>';

  $('#endnote').textContent = '이 요약서는 플랫폼에 남은 기록으로 만들었습니다(기준일 ' + C.fmtDate(D.TODAY) + '). 제품 줄, 체크리스트 비고, 첨부 파일과 판은 차수별 결재 문서에서, 체결본 파일은 계약 상세에서 확인합니다.';
  $('#doc').hidden = false;
})();
