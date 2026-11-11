/* =====================================================================
 * SCR-64 개선 과제와 보류 화면 로직 (remediation.js)
 * ---------------------------------------------------------------------
 * 기획자 결정 2026-11-02 C-16(G-29)과 덧붙임: 개선 과제 기록(원인, 조치, 책임자, 기한, 효과 확인, 끝낸 증거)을 관리자 영역에 둠.
 *   거래처나 계약 묶음에 보류를 걸고 풂. 걸고 푸는 사람과 기록하는 사람은 컴플라이언스 담당자. 기록은 쌓기만 함
 * 볼 수 있는 사람: 컴플라이언스 담당자(C.checkOwners('SCR-64')), 최고관리자(시연용), 감사 열람(보기만). 문은 C.checkViewers('SCR-64')(기획자 결정 2026-11-10 16번)
 * 남길 수 있는지: C.canComplianceAct(me). 읽기만 하는 역할(감사 열람)은 false라 단추가 없음
 * 하는 일
 *   1. 보류: 지금 걸린 보류를 위에, 푼 보류는 흐리게 아래에. 대상, 사유, 건 사람과 때, 막고 있는 남은 결재 수, 상태(푼 사람과 때, 사유)
 *      보류 걸기: 대상(거래처 또는 계약 묶음), 관련 개선 과제(선택), 사유(필수). 이미 걸린 대상은 고를 수 없음
 *      풀기: 사유(필수). 건 줄에 푼 때와 사람, 사유를 남김(지우지 않음)
 *      막는 것(common.js C.holdOf, C.holdBlocksAction): 새 기안(신규, 변경, 연장, 해지, 운영 변경, 보완 후 재기안), 남은 결재의 승인,
 *        체결본 등록, 유예 요청과 확인. 반려, 보완 요청, 다시 등록 요청, 승인 취소, 보완 완료, 만료 처리는 됨
 *      기획자 결정 2026-11-03(06 CTL-79): 걸 때와 풀 때 막히는 사람 모두에게 이메일(HOLD_SET, HOLD_RELEASE). 받는 사람은 C.holdMailList:
 *        걸린 계약의 영업대표(사용 중지면 대신 맡는 영업 리더), 그 유닛의 영업 리더, 결재 차례인 사람. 창에 받는 사람을 알리고, 변경 이력에 몇 명인지 남김
 *   2. 개선 과제: 열림 → 조치 중 → 효과 확인 → 끝남. 효과가 없으면 효과 확인에서 조치 중으로 되돌림. 끝낼 때 효과 확인과 끝낸 증거가 꼭 있어야 함
 *      기한과 책임자는 까닭을 적고 바꿈. 모든 바꿈은 그 과제의 기록(history)과 변경 이력에 한 줄씩 쌓임
 *      거르기: 전체, 끝나지 않음, 기한 지남, 끝남. 한 쪽 20건
 *   3. 변경 이력: 관리자 변경 이력의 COMPLIANCE 영역(보류, 개선 과제, 거래처 확인)
 *   0. 점검에서 넘어온 일(기획자 결정 2026-11-09 5회차 13번): 매월 점검의 문제 결과가 저절로 넘어온 일(control-checks.js X.issuesAll)
 *      기록 전인 것을 위에(먼저 넘어온 것부터), 개선 과제로 기록한 것은 흐리게 아래에. 한 쪽 20건
 *      "개선 과제로 기록"을 누르면 기록 창에 무엇(점검의 제목), 찾은 곳, 찾은 날(넘어온 날)을 미리 채우고 점검 의견과 화면 링크를 보임
 *      기록하면 개선 과제에 issueId(넘어온 일 번호)와 link(점검 화면)가 남고 넘어온 일은 닫힘(개요 점검할 일에서도 빠짐)
 *      개요의 줄을 누르면 ?issue=번호#sec-issues로 와서 그 줄을 표시함
 *      기획자 결정 2026-11-10 16번: 컴플라이언스도 매월 점검 네 화면을 보기만 하므로 넘어온 일의 점검 화면 링크가 열림(C.canSeeCheck)
 *   4. 결재자 지정(기획자 결정 2026-11-10 18번): 임원이 맡은 ③에 이해관계가 있어 걸린 보류(C.interestHoldOf)에 "결재자 지정".
 *      이해관계 없는 다른 영업 임원을 고르고 사유(필수). 저장하면 그 계약의 ③ 결재자가 되고 보류가 풀림(C.assignApprover)
 * 기록은 관리자 설정처럼 C.adminSave로 남김(영역 COMPLIANCE, 읽기만 하는 역할이면 저장하지 않음). 반영은 common.js applyAdmin
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const X = window.CLIMB_CTL; // 점검에서 넘어온 일(remediation.html이 control-checks.js를 부름, 기획자 결정 2026-11-09 5회차 13번)
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const SCR = 'SCR-64';
  // 문: 맡은 사람과 보기만 하는 사람을 common.js 한 곳(checkViewers)에서 정함(기획자 결정 2026-11-10 16번. 이 화면은 예전과 같은 사람)
  if (!C.gate(me, C.checkViewers(SCR), '개선 과제와 보류는 컴플라이언스 담당자가 씁니다',
    '지금은 ' + esc(C.roleLabel(me.role)) + ' 역할로 보고 있습니다. 화면 맨 위 검은 띠에서 컴플라이언스 담당자, 감사 열람, 최고관리자 가운데 하나로 바꾸면 볼 수 있습니다.')) return;

  const canDo = C.canComplianceAct(me);
  const RM = D.REMEDIATION, ST = RM.STATE;
  // 상태 배지 색: 열림(보라), 조치 중(파랑), 효과 확인(선), 끝남(초록)
  const TONE = { OPEN: 'attention', DOING: 'progress', VERIFY: 'line', DONE: 'success' };
  const PAGE_SIZE = 20; // 한 쪽 20건 (REQ-ADM-04와 같은 기준)
  const WORKING = ['IN_REVIEW', 'APPROVED', 'OPS_REVIEW']; // 남은 결재가 있는 상태(common.js와 같음)
  let holdPage = 1, rmPage = 1, view = 'ALL', issuePage = 1;
  // 개요 점검할 일에서 누른 넘어온 일(?issue=IS-0001). 그 줄을 표시함(2026-11-09 5회차 13번)
  const TARGET_ISSUE = new URLSearchParams(location.search).get('issue') || '';
  let issueJumped = false;

  // 읽기만 하는 사람(감사 열람)에게는 단추를 두지 않고 안내 문장을 맞춤
  if (!canDo) {
    $('#btn-hold').hidden = true;
    $('#btn-rm').hidden = true;
    $('#holds-desc').textContent += ' 보기만 합니다. 보류를 걸고 푸는 일은 컴플라이언스 담당자가 합니다.';
    $('#rm-desc').textContent += ' 보기만 합니다. 기록은 컴플라이언스 담당자가 남깁니다.';
    $('#issues-desc').textContent += ' 보기만 합니다. 개선 과제로 기록하는 일은 컴플라이언스 담당자가 합니다.'; // 2026-11-09 5회차 13번
  }

  function val(f, n) { return (f.elements[n].value || '').trim(); }
  function nextId(list, prefix) {
    const n = list.reduce(function (m, x) { return Math.max(m, Number(String(x.id).replace(/\D/g, '')) || 0); }, 0) + 1;
    return prefix + '-' + String(n).padStart(4, '0');
  }
  function findHold(id) { return D.HOLDS.filter(function (h) { return h.id === id; })[0]; }
  // 보류 이메일 받을 사람 한 줄(기획자 결정 2026-11-03 CTL-79): "이도윤(영업대표), 최민준(영업 리더, 결재 차례)". 없으면 ''
  function mailText(list) {
    return list.map(function (x) { return C.ownerLabel(x.id) + '(' + x.why.join(', ') + ')'; }).join(', ');
  }
  // 변경 이력에 남길 대상 글: 보는 사람과 상관없이 같은 글(예시 기록 mock-data.js와 같은 꼴). 계약 묶음은 번호만 적어 열람 제한 계약의 고객사가 기록에 남지 않게
  //   화면의 글(C.holdTarget)은 보는 사람에 따라 고객사를 가리므로 기록에 쓰지 않음(최고관리자가 걸면 고객사가 기록에 남아 볼 수 없는 사람에게 보였음)
  function logTarget(h) { return h.kind === 'CUSTOMER' ? '거래처 ' + h.name + ' (' + h.bizNo + ')' : '계약 묶음 ' + h.bundleId; }
  function findRm(id) { return D.REMEDIATIONS.filter(function (r) { return r.id === id; })[0]; }
  function late(r) { return r.state !== 'DONE' && !!r.due && r.due < D.TODAY; }
  function req() { return '<span class="req" aria-hidden="true">*</span><span class="sr-only">(필수)</span>'; }
  // 책임자로 고를 사람: 사용 중인 계정(조직 이름 순)
  function ownerOptions() {
    return D.ACCOUNTS.filter(function (a) { return a.status === 'ACTIVE'; }).map(function (a) { return [a.id, C.ownerLabel(a.id)]; })
      .sort(function (a, b) { return a[1].localeCompare(b[1]); });
  }
  // 끝낸 증거, 파일 칸: 파일을 고르거나 시연용 예시 파일. 프로토타입은 파일 이름만 남김. 고른 파일 줄은 처음부터 두어 창이 흔들리지 않게
  function fileFieldHtml(label, help) {
    return '<div class="field" data-field="file"><label class="field-label" for="fm-file">' + esc(label) + req() + '</label>' +
      '<input class="input" id="fm-file" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx">' +
      '<p class="field-help">' + esc(help) + ' <button type="button" class="btn-text" data-demo-file>예시 파일 고르기 (시연)</button></p>' +
      '<p class="field-help" data-file-name aria-live="polite">고른 파일: 없음</p><p class="field-error" hidden></p></div>';
  }
  function fileNameOf(f) {
    const input = f.elements.file;
    return f.getAttribute('data-demo-name') || (input.files && input.files[0] ? input.files[0].name : '');
  }
  function wireFile(f, demoName) {
    const show = function () { f.querySelector('[data-file-name]').textContent = '고른 파일: ' + (fileNameOf(f) || '없음'); };
    f.elements.file.addEventListener('change', function () { f.removeAttribute('data-demo-name'); show(); });
    f.querySelector('[data-demo-file]').addEventListener('click', function () {
      f.setAttribute('data-demo-name', demoName);
      show();
      C.setFieldError(f.querySelector('[data-field="file"]'), '');
    });
  }

  /* ---------- 0. 점검에서 넘어온 일 (기획자 결정 2026-11-09 5회차 13번) ---------- */
  // 찾은 곳마다 점검 화면을 볼 수 있는 사람에게만 링크, 볼 수 없는 사람에게는 화면 이름만
  //   기획자 결정 2026-11-10 16번: 컴플라이언스도 매월 점검 네 화면을 보기만 하므로 링크로 원래 기록을 바로 봄.
  //   누가 볼 수 있는지는 화면의 문과 같은 C.canSeeCheck(common.js CHECK_VIEWERS)를 따라 저절로 맞춰짐. 매월 기록 점검(LOG, SCR-57)은 정보보호와 감사 열람만
  const ISSUE_SCR = { DISCOUNT: 'SCR-61', OPP: 'SCR-62', SEAL: 'SCR-63', CONFIG: 'SCR-65' };
  function canOpenCheck(src) {
    if (src === 'LOG') return me.role === 'SUPER' || C.isAuditor(me) || C.hasRole(me, ['PRIVACY']);
    return !!ISSUE_SCR[src] && C.canSeeCheck(me, ISSUE_SCR[src]);
  }
  function checkLinkHtml(href, src) {
    const name = RM.SOURCE[src] || src;
    // 링크가 없는 사람에게 누가 보는지(2026-11-10 16번 뒤에는 컴플라이언스에게는 매월 기록 점검만 이렇게 보임)
    return href && canOpenCheck(src) ? '<a href="' + esc(href) + '">' + esc(name) + ' 화면에서 보기</a>' : esc(name) + ' 화면(맡은 사람과 감사 열람이 봄)';
  }
  function findIssue(id) { return X.issuesAll().filter(function (i) { return i.id === id; })[0] || null; }
  function renderIssues() {
    const all = X.issuesAll(); // 최근 것부터
    const open = all.filter(function (i) { return !X.issueTask(i.id); }).reverse(); // 기록 전: 먼저 넘어온 것부터
    const list = open.concat(all.filter(function (i) { return X.issueTask(i.id); }));
    $('#issues-count').innerHTML = C.meta([['기록 전', '<strong>' + open.length + '건</strong>'], ['개선 과제로 기록함', (list.length - open.length) + '건']]);
    // 처음 그릴 때 개요에서 고른 줄이 있는 쪽을 엶
    if (TARGET_ISSUE && !issueJumped) {
      const k = list.map(function (i) { return i.id; }).indexOf(TARGET_ISSUE);
      if (k > -1) issuePage = Math.floor(k / PAGE_SIZE) + 1;
      issueJumped = true;
    }
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (issuePage > pages) issuePage = pages;
    const from = (issuePage - 1) * PAGE_SIZE, rows = list.slice(from, from + PAGE_SIZE);
    $('#issues').innerHTML = '<div class="tbl-scroll" tabindex="0" role="region" aria-label="넘어온 일 목록 표">' +
      '<table class="tbl tbl--compact"><caption class="sr-only">점검에서 넘어온 일: 넘어온 때, 내용, 넘긴 사람, 상태, 관리</caption>' +
      '<thead><tr><th scope="col">넘어온 때</th><th scope="col">내용</th><th scope="col">넘긴 사람</th><th scope="col">상태</th>' +
      '<th scope="col" class="col-action">관리</th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (i) {
        const task = X.issueTask(i.id), done = !!task;
        const row = '<span class="sr-only"> ' + esc(i.id) + '</span>'; // 줄마다 같은 단추 글이라 화면낭독기가 어느 줄인지 알게(다른 표와 같게)
        // 개요에서 누른 줄(?issue=)은 aria-current로 표시하고 "개요에서 고른 일" 작은 줄을 붙임
        const target = i.id === TARGET_ISSUE;
        return '<tr' + (done ? ' class="is-muted"' : '') + (target ? ' aria-current="true"' : '') + '>' +
          '<td class="num-left nowrap">' + C.fmtDateTime(i.at).split(' ').map(function (s) { return '<span class="keep">' + s + '</span>'; }).join(' ') + '</td>' +
          '<td class="col-wide"><span class="cell-strong">' + esc(i.id + ' ' + i.title) + '</span>' +
            (i.note ? '<span class="cell-meta">의견: ' + esc(i.note) + '</span>' : '') +
            '<span class="cell-meta">' + esc(RM.SOURCE[i.source] || i.source) + ', ' + checkLinkHtml(i.href, i.source) + '</span>' +
            (target ? '<span class="cell-meta">개요에서 고른 일</span>' : '') + '</td>' +
          '<td class="center nowrap">' + esc(C.ownerLabel(i.by)) + '</td>' +
          '<td class="nowrap">' + (done ? C.badge('success', '기록함') + '<span class="cell-meta">개선 과제 ' + esc(task.id) + '</span>' : C.badge('attention', '기록 전')) + '</td>' +
          '<td class="col-action">' + (canDo && !done ? '<button type="button" class="link-act" data-issue="' + esc(i.id) + '">개선 과제로 기록' + row + '</button>' : '-') + '</td></tr>';
      }).join('') : '<tr><td class="empty-row" colspan="5">점검에서 넘어온 일이 없습니다.</td></tr>') + '</tbody></table></div>';
    $('#issues-pages').innerHTML = C.pagerHtml(issuePage, pages, list.length, from, rows.length, PAGE_SIZE, '건');
  }

  /* ---------- 1. 보류 (기획자 결정 2026-11-02 C-16) ---------- */
  // 막고 있는 남은 결재: 결재가 남은 계약 중 이 보류에 걸린 것(볼 수 없는 열람 제한 계약도 건수로만 셈)
  function holdImpact(h) {
    if (h.releasedAt) return null;
    return D.CONTRACTS.filter(function (c) { return c.id && WORKING.indexOf(c.status) > -1 && C.pendingSteps(c).length && C.holdOf(c) === h; }).length;
  }
  function renderHolds() {
    const all = C.holdsAll(); // 최근 것부터
    const list = all.filter(function (h) { return !h.releasedAt; }).concat(all.filter(function (h) { return h.releasedAt; })); // 지금 걸린 것을 위에
    const on = list.filter(function (h) { return !h.releasedAt; }).length;
    $('#holds-count').innerHTML = C.meta([['보류 중', '<strong>' + on + '건</strong>'], ['푼 기록', (list.length - on) + '건']]);
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (holdPage > pages) holdPage = pages;
    const from = (holdPage - 1) * PAGE_SIZE, rows = list.slice(from, from + PAGE_SIZE);
    $('#holds').innerHTML = '<div class="tbl-scroll" tabindex="0" role="region" aria-label="보류 목록 표">' +
      '<table class="tbl tbl--compact"><caption class="sr-only">보류 목록: 대상, 사유, 건 사람, 막고 있는 남은 결재, 상태, 관리</caption>' +
      '<thead><tr><th scope="col">대상</th><th scope="col">사유</th><th scope="col">건 사람</th><th scope="col" class="num">남은 결재</th>' +
      '<th scope="col">상태</th><th scope="col" class="col-action">관리</th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (h) {
        const n = holdImpact(h), off = !!h.releasedAt;
        // 기획자 결정 2026-11-10 18번: 임원의 ③ 이해관계로 걸린 보류는 어느 계약의 어느 단계인지 한 줄 더, 관리 칸에 "결재자 지정"
        const ix = C.interestHoldOf(h), row = '<span class="sr-only"> ' + esc(C.holdTarget(h, me)) + ' 보류</span>';
        const acts = [];
        if (canDo && ix) acts.push('<button type="button" class="link-act" data-assign="' + esc(h.id) + '">결재자 지정' + row + '</button>');
        // 줄 이름은 aria-label 대신 보이는 글 뒤의 화면낭독기용 글로: 보이는 "풀기"가 읽는 이름의 앞에 오게(다른 표 안 단추와 같게, 2026-11-06 점검)
        if (canDo && !off) acts.push('<button type="button" class="link-act link-act--danger" data-release="' + esc(h.id) + '">풀기' + row + '</button>');
        return '<tr' + (off ? ' class="is-muted"' : '') + '>' +
          '<td class="col-wide"><span class="cell-strong">' + esc(C.holdTarget(h, me)) + '</span>' +
            '<span class="cell-meta">' + esc(h.id + (h.remediationId ? ', 개선 과제 ' + h.remediationId : '')) + '</span>' +
            (h.conflict ? '<span class="cell-meta">' + esc(h.conflict.contractId + ' ' + C.stepLabel(h.conflict.step) + ', 이해관계: ' + C.ownerLabel(h.conflict.userId)) + '</span>' : '') + '</td>' +
          '<td class="col-wide">' + esc(h.reason) + (off ? '<span class="cell-meta">푼 사유: ' + esc(h.releaseReason) + '</span>' : '') + '</td>' +
          '<td class="center nowrap">' + esc(C.ownerLabel(h.by)) + '<span class="cell-meta">' + C.fmtDateTime(h.at) + '</span></td>' +
          '<td class="num">' + (n == null ? '-' : n + '건') + '</td>' +
          '<td class="nowrap">' + (off ? C.badge('neutral', '풂') + '<span class="cell-meta">' + esc(C.ownerLabel(h.releasedBy)) + ', ' + C.fmtDateTime(h.releasedAt) + '</span>'
            : C.holdBadge(h)) + '</td>' +
          '<td class="col-action">' + (acts.length ? '<span class="ob-acts">' + acts.join('') + '</span>' : '-') + '</td></tr>';
      }).join('') : '<tr><td class="empty-row" colspan="6">걸린 보류가 없습니다.</td></tr>') + '</tbody></table></div>';
    $('#holds-pages').innerHTML = C.pagerHtml(holdPage, pages, list.length, from, rows.length, PAGE_SIZE, '건');
  }
  // 보류 걸기: 대상 하나(거래처 또는 계약 묶음)를 한 칸에서 고름. 이미 걸린 대상과 해지된 묶음은 목록에 없음
  function openHold() {
    const cus = D.CUSTOMERS.filter(function (cu) { return cu.use && !cu.mergedInto && !C.customerHold(cu.bizNo); });
    const bds = C.bundles().filter(function (b) { return b.status !== 'TERMINATED' && !C.bundleHold(b.id); });
    const open = D.REMEDIATIONS.filter(function (r) { return r.state !== 'DONE'; });
    C.formModal({
      title: '보류를 걸까요?',
      desc: '걸면 바로 그 거래처나 계약 묶음의 새 기안과 남은 결재의 승인이 막힙니다. 건 기록은 지우지 않고, 풀 때도 사유를 남깁니다.',
      body: '<p class="modal-info">막는 것: 새 기안(신규, 변경, 연장, 해지, 운영 변경), 남은 결재의 승인과 체결본 등록, 유예 요청과 확인<br>' +
          '할 수 있는 것: 반려, 보완 요청, 다시 등록 요청, 승인 취소, 만료 처리<br>' +
          // 기획자 결정 2026-11-03(CTL-79): 막히는 사람 모두에게 이메일. 사유는 이메일에 넣지 않음
          '이메일: 걸린 계약의 영업대표와 영업 리더, 결재 차례인 사람에게 보냅니다. 사유는 이메일에 넣지 않고 시스템에서 봅니다.</p>' +
        '<div class="field" data-field="target"><label class="field-label" for="fm-target">보류 대상' + req() + '</label>' +
          '<select class="select" id="fm-target" name="target"><option value="">고르세요</option>' +
          '<optgroup label="거래처">' + cus.map(function (cu) { return '<option value="CU:' + esc(cu.id) + '">' + esc(cu.name + ' (' + cu.bizNo + ')') + '</option>'; }).join('') + '</optgroup>' +
          '<optgroup label="계약 묶음">' + bds.map(function (b) {
            return '<option value="BD:' + esc(b.id) + '">' + esc(b.id + ' ' + (C.canView(b.root, me) ? b.root.counterparty : '열람 제한 계약')) + '</option>';
          }).join('') + '</optgroup></select>' +
          '<p class="field-help">거래처에 걸면 그 거래처의 모든 계약에, 계약 묶음에 걸면 원계약과 변경, 연장, 해지, 운영 변경에 걸립니다.</p><p class="field-error" hidden></p></div>' +
        // 넣지 않아도 되는 칸은 optional로 "(선택)"을 모든 창에서 같은 모양으로(2026-11-06 점검 3회차)
        C.fieldHtml({ name: 'rm', label: '관련 개선 과제', type: 'select', optional: true, options: [['', '없음']].concat(open.map(function (r) { return [r.id, r.id + ' ' + r.title]; })),
          help: '보류의 까닭이 된 개선 과제가 있으면 고릅니다.' }) +
        // 사유는 결재 문서, 계약 상세, 만료 예정 등 그 계약을 볼 수 있는 사람에게 모두 보임 [가정]. 그래서 조사 내용이나 신고한 사람은 적지 않게 안내
        C.fieldHtml({ name: 'reason', label: '거는 사유', type: 'textarea', required: true, placeholder: '예: 거래처 확인에서 부정적 보도가 나와 사실을 확인할 때까지 새 기안과 남은 결재를 멈춤',
          help: '사유는 이 계약을 볼 수 있는 사람 모두에게 보입니다. 조사 내용이나 신고한 사람은 적지 마세요.' }),
      btn: '보류 걸기',
      tone: 'danger',
      check: function (f) { return { target: val(f, 'target') ? '' : '보류 대상을 고르세요.', reason: val(f, 'reason') ? '' : '거는 사유를 적으세요.' }; },
      done: function (f) {
        const v = val(f, 'target'), key = v.slice(3), isCu = v.indexOf('CU:') === 0;
        const cu = isCu ? D.CUSTOMERS.filter(function (x) { return x.id === key; })[0] : null;
        const root = isCu ? null : D.CONTRACTS.filter(function (x) { return x.id === key; })[0];
        // 계약 묶음 보류의 name은 열람 제한이 아닐 때만 고객사(열람 제한 계약의 고객사를 보류 기록에 남기지 않음)
        const h = { id: nextId(D.HOLDS, 'HD'), kind: isCu ? 'CUSTOMER' : 'BUNDLE', customerId: cu ? cu.id : null, bizNo: cu ? cu.bizNo : '',
          name: cu ? cu.name : root && !root.restricted ? root.counterparty : '', bundleId: isCu ? null : key, remediationId: val(f, 'rm') || null };
        // 기획자 결정 2026-11-03(CTL-79): 걸기 전에 받는 사람을 셈(걸린 계약은 보류 기록이 생기기 전과 같음). 변경 이력에 몇 명인지 남김
        const mail = C.holdMailList(h);
        const e = C.adminSave('COMPLIANCE', logTarget(h), '보류 걸기(' + h.id + ')' + (h.remediationId ? ', 개선 과제 ' + h.remediationId : '') +
          ', 이메일 ' + mail.length + '명', val(f, 'reason'), { k: 'HOLD_SET', h: h });
        if (e.refused) return;
        render();
        C.toast(C.holdTarget(h, me) + '에 보류를 걸었습니다. 새 기안과 남은 결재의 승인이 막힙니다. ' +
          (mail.length ? '막히는 ' + mail.length + '명에게 이메일로 알렸습니다.' : '지금 막히는 사람이 없어 이메일은 보내지 않았습니다.'));
      },
    });
  }
  function openRelease(id) {
    const h = findHold(id);
    if (!h || h.releasedAt) return;
    // 기획자 결정 2026-11-03(CTL-79): 풀 때도 막혔던 사람 모두에게 이메일. 받는 사람을 창에 미리 보임
    const mail = C.holdMailList(h);
    C.formModal({
      title: '보류를 풀까요?',
      desc: '풀면 새 기안과 남은 결재의 승인을 다시 할 수 있습니다. 건 기록과 푼 기록은 모두 남습니다.',
      body: '<p class="modal-info">' + C.meta([['대상', esc(C.holdTarget(h, me))], ['건 때', C.fmtDateTime(h.at) + ', ' + esc(C.ownerLabel(h.by))]]) +
          '<br>' + esc(h.reason) +
          '<br>이메일 받을 사람: ' + (mail.length ? esc(mailText(mail)) : '없음(지금 막힌 사람이 없음)') +
          // 기획자 결정 2026-11-10 18번: 결재자 지정을 기다리는 보류를 그냥 풀면 ③이 이해관계 있는 임원에게 남아 처리되지 않음(반려되었을 때 등에만)
          (C.interestHoldOf(h) ? '<br>③ 결재자를 정하지 않고 풀면 이 계약의 ③은 이해관계 있는 사람에게 남아 처리되지 않습니다. 보통은 결재자 지정을 씁니다.' : '') + '</p>' +
        C.fieldHtml({ name: 'reason', label: '푸는 사유', type: 'textarea', required: true, placeholder: '예: 보도 내용을 확인한 결과 다른 회사의 일로 밝혀짐(확인 자료 첨부)' }),
      btn: '보류 풀기',
      tone: 'danger',
      check: function (f) { return { reason: val(f, 'reason') ? '' : '푸는 사유를 적으세요.' }; },
      done: function (f) {
        const e = C.adminSave('COMPLIANCE', logTarget(h), '보류 풀기(' + h.id + '), 이메일 ' + mail.length + '명', val(f, 'reason'), { k: 'HOLD_RELEASE', id: h.id });
        if (e.refused) return;
        render();
        C.toast(C.holdTarget(h, me) + '의 보류를 풀었습니다.' + (mail.length ? ' 막혔던 ' + mail.length + '명에게 이메일로 알렸습니다.' : ''));
      },
    });
  }
  /* 결재자 지정 (기획자 결정 2026-11-10 18번)
   *   임원이 맡은 ③에 이해관계가 있어 걸린 보류(C.interestHoldOf)에서 컴플라이언스 담당자가 이해관계 없는 다른 임원을 이 계약의 ③ 결재자로 정함
   *   고를 수 있는 사람은 C.assignCandidates(이해관계를 남긴 사람, 기안자 쪽 사람을 뺀 사용 중인 영업 임원). 사유 필수
   *   저장하면 C.assignApprover가 결재 기록(결재자 지정)을 남기고 보류를 풂(변경 이력에 한 줄). 정한 임원과 막혔던 사람에게 이메일 */
  function openAssign(id) {
    const h = findHold(id), ix = C.interestHoldOf(h);
    if (!ix) return;
    const seen = C.canView(ix.c, me); // 열람 제한 계약이면 고객사와 이해관계 내용을 보이지 않음
    const cf = seen ? C.interestOut(ix.c, ix.userId) : null;
    const who = C.assignCandidates(ix.c, ix.step);
    C.formModal({
      title: '이 계약의 ③ 결재자를 정할까요?',
      desc: '정하면 이 계약의 ' + C.josa(C.stepLabel(ix.step, ix.c), '을', '를') + ' 고른 임원이 맡고 보류가 풀립니다. 다른 계약은 그대로입니다. 결재 기록과 변경 이력에 남습니다.',
      body: '<p class="modal-info">' + C.meta([['계약', esc(ix.c.id + ' ' + (seen ? ix.c.counterparty : '열람 제한 계약'))], ['단계', esc(C.stepLabel(ix.step, ix.c))],
          ['이해관계를 남긴 사람', esc(C.ownerLabel(ix.userId))]]) +
          (cf && cf.comment ? '<br>이해관계 내용: ' + esc(cf.comment) : '') +
          '<br>이메일: 고른 임원(결재 차례)과 보류로 막혔던 사람에게 보냅니다.</p>' +
        C.fieldHtml({ name: 'who', label: '결재자', type: 'select', required: true,
          options: [['', who.length ? '고르세요' : '고를 수 있는 임원 없음']].concat(who.map(function (u) { return [u, C.ownerLabel(u)]; })),
          help: '사용 중인 영업 임원 가운데 이 계약에 이해관계 있음을 남긴 사람과 기안자 쪽 사람을 뺀 사람입니다.' }) +
        C.fieldHtml({ name: 'reason', label: '정하는 사유', type: 'textarea', required: true, placeholder: '예: 이해관계가 없음을 확인함. 같은 직급이라 할인 판단을 맡을 수 있음' }),
      btn: '결재자 지정',
      check: function (f) {
        return { who: !who.length ? '고를 수 있는 임원이 없습니다. 관리자에게 영업 임원 역할을 가진 다른 계정을 요청해 주세요.' : val(f, 'who') ? '' : '결재자를 고르세요.',
          reason: val(f, 'reason') ? '' : '정하는 사유를 적으세요.' };
      },
      done: function (f) {
        const pick = val(f, 'who');
        const r = C.assignApprover(h, pick, val(f, 'reason'), me);
        if (!r) { C.toast('결재자를 정하지 못했습니다. 화면을 새로 고친 뒤 다시 해 주세요.', true); render(); return; }
        render();
        C.toast(ix.c.id + '의 ③ 결재자를 ' + C.josa(C.ownerLabel(pick), '으로', '로') + ' 정하고 보류를 풀었습니다.' + (r.mail.length ? ' ' + r.mail.length + '명에게 이메일로 알렸습니다.' : ''));
      },
    });
  }

  /* ---------- 2. 개선 과제 (기획자 결정 2026-11-02 C-16) ---------- */
  // 상태마다 누를 수 있는 일: 열림 → 조치 시작 / 조치 중 → 효과 확인으로 / 효과 확인 → 끝내기, 다시 조치 / 끝나기 전에는 기한과 책임자 바꾸기
  const STEP = {
    START: { from: 'OPEN', to: 'DOING', label: '조치 시작' },
    VERIFY: { from: 'DOING', to: 'VERIFY', label: '효과 확인으로' },
    DONE: { from: 'VERIFY', to: 'DONE', label: '끝내기' },
    REDO: { from: 'VERIFY', to: 'DOING', label: '다시 조치' },
  };
  function fitsView(r) {
    if (view === 'OPEN') return r.state !== 'DONE';
    if (view === 'LATE') return late(r);
    if (view === 'DONE') return r.state === 'DONE';
    return true;
  }
  function renderRms() {
    const all = D.REMEDIATIONS.slice().sort(function (a, b) { return (a.state === 'DONE') - (b.state === 'DONE') || b.at.localeCompare(a.at); }); // 끝나지 않은 것을 위에
    const list = all.filter(fitsView);
    const count = function (s) { return all.filter(function (r) { return r.state === s; }).length + '건'; };
    $('#rm-count').innerHTML = C.meta([[(view === 'ALL' ? '전체' : '거른 결과'), '<strong>' + list.length + '건</strong>'],
      [ST.OPEN, count('OPEN')], [ST.DOING, count('DOING')], [ST.VERIFY, count('VERIFY')], [ST.DONE, count('DONE')],
      ['기한 지남', all.filter(late).length + '건']]);
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (rmPage > pages) rmPage = pages;
    const from = (rmPage - 1) * PAGE_SIZE, rows = list.slice(from, from + PAGE_SIZE);
    $('#rms').innerHTML = '<div class="tbl-scroll" tabindex="0" role="region" aria-label="개선 과제 목록 표">' +
      '<table class="tbl tbl--compact"><caption class="sr-only">개선 과제 목록: 과제, 원인과 조치, 책임자, 기한, 상태, 관리</caption>' +
      '<thead><tr><th scope="col">과제</th><th scope="col">원인과 조치</th><th scope="col">책임자</th><th scope="col">기한</th><th scope="col">상태</th>' +
      '<th scope="col" class="col-action">관리</th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (r) {
        const d = r.due ? C.daysUntil(r.due) : null, done = r.state === 'DONE';
        const last = r.history[r.history.length - 1];
        const acts = [];
        // 줄 이름(과제 번호)은 aria-label 대신 보이는 글 뒤의 화면낭독기용 글로: aria-label이 번호부터 읽고 "기한, 책임자 바꾸기"는 보이는 글과 달라
        //   음성으로 단추를 부르기 어려웠음. 보이는 글이 이름의 앞에 오게 바꿈(다른 표 안 단추와 같게, 2026-11-06 점검)
        const row = '<span class="sr-only"> ' + esc(r.id) + '</span>';
        if (canDo) {
          Object.keys(STEP).forEach(function (k) {
            if (STEP[k].from === r.state) acts.push('<button type="button" class="link-act" data-step="' + k + '" data-id="' + esc(r.id) + '">' + STEP[k].label + row + '</button>');
          });
          if (!done) acts.push('<button type="button" class="link-act" data-step="EDIT" data-id="' + esc(r.id) + '">기한, 책임자 바꾸기' + row + '</button>');
        }
        acts.push('<button type="button" class="link-act" data-view-rm="' + esc(r.id) + '">기록 보기' + row + '</button>');
        return '<tr' + (done ? ' class="is-muted"' : '') + '>' +
          '<td class="col-wide"><span class="cell-strong">' + esc(r.id + ' ' + r.title) + '</span>' +
            '<span class="cell-meta">' + esc(RM.SOURCE[r.source] || r.source) + ', 찾은 날 ' + C.fmtDate(r.found) + (r.holdId ? ', 보류 ' + esc(r.holdId) : '') +
              (r.issueId ? ', 넘어온 일 ' + esc(r.issueId) : '') + '</span></td>' + // 2026-11-09 5회차 13번
          '<td class="col-wide">' + esc(r.cause) + '<span class="cell-meta">조치: ' + esc(r.action) + '</span></td>' +
          '<td class="center nowrap">' + esc(C.ownerLabel(r.owner)) + '</td>' +
          '<td class="num-left nowrap">' + C.fmtDate(r.due) + (done ? '' : late(r) ? '<span class="cell-meta">' + C.badge('danger', '기한 지남') + '</span>'
            // 2026-11-09 5회차 점검: 기한이 오늘이면 "D-0" 대신 "오늘"(의무, 해지 통지 기한과 같은 말)
            : d != null ? '<span class="cell-meta">' + (d ? 'D-' + d : '오늘') + '</span>' : '') + '</td>' +
          '<td class="nowrap">' + C.badge(TONE[r.state], ST[r.state]) + '<span class="cell-meta">' + C.fmtDate(last.at) + '</span></td>' +
          '<td class="col-action"><span class="ob-acts">' + acts.join('') + '</span></td></tr>';
      }).join('') : '<tr><td class="empty-row" colspan="6">' + (all.length ? '조건에 맞는 개선 과제가 없습니다.' : '아직 기록한 개선 과제가 없습니다.') + '</td></tr>') +
      '</tbody></table></div>';
    $('#rm-pages').innerHTML = C.pagerHtml(rmPage, pages, list.length, from, rows.length, PAGE_SIZE, '건');
  }
  // 개선 과제 기록: 상태는 열림으로 시작
  //   iss(선택): 점검에서 넘어온 일(기획자 결정 2026-11-09 5회차 13번). 무엇, 찾은 곳, 찾은 날을 미리 채우고 점검 의견과 화면 링크를 위에 보임
  //     기록하면 issueId와 link를 함께 남겨 넘어온 일이 닫힘. 미리 채운 칸은 고칠 수 있음(제목을 다듬는 등)
  function openAdd(iss) {
    const holds = D.HOLDS.filter(function (h) { return !h.releasedAt; });
    if (iss && X.issueTask(iss.id)) return; // 이미 기록한 넘어온 일(다른 탭에서 기록함)
    const found = iss ? String(iss.at).slice(0, 10) : D.TODAY;
    C.formModal({
      title: '개선 과제를 기록할까요?',
      desc: '기록하면 열림 상태로 시작합니다. 기록한 내용은 지우지 않고, 바꿀 때마다 한 줄씩 남습니다.' + (iss ? ' 기록하면 넘어온 일(' + iss.id + ')이 닫힙니다.' : ''),
      body: (iss ? '<p class="modal-info">' + C.meta([['넘어온 일', esc(iss.id)], ['넘긴 사람', esc(C.ownerLabel(iss.by)) + ', ' + C.fmtDateTime(iss.at)]]) +
          '<br>' + esc(iss.title) + (iss.note ? '<br>의견: ' + esc(iss.note) : '') + '<br>' + checkLinkHtml(iss.href, iss.source) + '</p>' : '') +
        C.fieldHtml({ name: 'title', label: '무엇이 실패했나', required: true, value: iss ? iss.title : '', placeholder: '예: 간접 거래처를 기안 전에 확인하지 않음' }) +
        '<div class="field-row">' +
          C.fieldHtml({ name: 'source', label: '찾은 곳', type: 'select', required: true, value: iss ? iss.source : '', options: [['', '고르세요']].concat(Object.keys(RM.SOURCE).map(function (k) { return [k, RM.SOURCE[k]]; })) }) +
          C.fieldHtml({ name: 'found', label: '찾은 날', type: 'date', required: true, value: found, attrs: ' max="' + D.TODAY + '"' }) +
        '</div>' +
        C.fieldHtml({ name: 'cause', label: '원인', type: 'textarea', required: true, placeholder: '예: 거래처 확인이 없어도 경고만 해 영업이 확인을 요청하지 않음' }) +
        C.fieldHtml({ name: 'action', label: '조치', type: 'textarea', required: true, placeholder: '예: 간접 거래처는 첫 기안 전에 확인을 요청하도록 영업에 알림' }) +
        '<div class="field-row">' +
          C.fieldHtml({ name: 'owner', label: '책임자', type: 'select', required: true, options: [['', '고르세요']].concat(ownerOptions()) }) +
          C.fieldHtml({ name: 'due', label: '기한', type: 'date', required: true, attrs: ' data-after="fm-found" data-after-msg="기한은 찾은 날보다 앞설 수 없습니다."' }) +
        '</div>' +
        // 넣지 않아도 되는 칸은 optional로 "(선택)"을 모든 창에서 같은 모양으로(2026-11-06 점검 3회차)
        C.fieldHtml({ name: 'hold', label: '관련 보류', type: 'select', optional: true, options: [['', '없음']].concat(holds.map(function (h) { return [h.id, h.id + ' ' + C.holdTarget(h, me)]; })),
          help: '이 과제 때문에 건 보류가 있으면 고릅니다.' }),
      btn: '기록',
      check: function (f) {
        const found = val(f, 'found'), due = val(f, 'due');
        return {
          title: val(f, 'title') ? '' : '무엇이 실패했는지 적으세요.',
          source: val(f, 'source') ? '' : '찾은 곳을 고르세요.',
          found: !found ? '찾은 날을 적으세요.' : found > D.TODAY ? '오늘(' + C.fmtDate(D.TODAY) + ')보다 뒤 날짜는 적을 수 없습니다.' : '',
          cause: val(f, 'cause') ? '' : '원인을 적으세요.',
          action: val(f, 'action') ? '' : '조치를 적으세요.',
          owner: val(f, 'owner') ? '' : '책임자를 고르세요.',
          due: !due ? '기한을 적으세요.' : found && due < found ? '기한은 찾은 날보다 앞설 수 없습니다.' : '',
        };
      },
      done: function (f) {
        // 넘어온 일에서 기록하면 issueId(넘어온 일 번호)와 link(점검 화면)를 함께 남김(2026-11-09 5회차 13번)
        const r = { id: nextId(D.REMEDIATIONS, 'RM'), title: val(f, 'title'), source: val(f, 'source'), found: val(f, 'found'), cause: val(f, 'cause'),
          action: val(f, 'action'), owner: val(f, 'owner'), due: val(f, 'due'), holdId: val(f, 'hold') || null,
          issueId: iss ? iss.id : null, link: iss ? iss.href || '' : '' };
        const e = C.adminSave('COMPLIANCE', r.id + ' ' + r.title, '개선 과제 기록: 책임자 ' + C.ownerLabel(r.owner) + ', 기한 ' + r.due + (iss ? ', 넘어온 일 ' + iss.id : ''), r.cause, { k: 'REMEDIATION_ADD', r: r });
        if (e.refused) return;
        render();
        C.toast(r.id + ' 개선 과제를 기록했습니다. 열림 상태입니다.' + (iss ? ' 넘어온 일(' + iss.id + ')을 닫았습니다.' : ''));
      },
    });
  }
  // 상태 바꾸기(START, VERIFY, DONE, REDO)와 기한, 책임자 바꾸기(EDIT)
  function openStep(id, kind) {
    const r = findRm(id);
    if (!r || r.state === 'DONE' || (STEP[kind] && STEP[kind].from !== r.state)) return;
    const info = '<p class="modal-info">' + C.meta([['과제', esc(r.id + ' ' + r.title)], ['지금', esc(ST[r.state])], ['기한', C.fmtDate(r.due)]]) + '</p>';
    let o;
    if (kind === 'START') {
      o = { title: '조치를 시작할까요?', desc: '상태가 조치 중이 됩니다.', btn: '조치 시작',
        body: info + C.fieldHtml({ name: 'note', label: '시작하며 한 일', type: 'textarea', required: true, placeholder: '예: 책임자와 조치 일정을 정함' }),
        check: function (f) { return { note: val(f, 'note') ? '' : '시작하며 한 일을 적으세요.' }; },
        save: function (f) { return { reason: val(f, 'note'), set: null }; } };
    } else if (kind === 'VERIFY') {
      // 한 조치를 확인하고(처음 적은 조치에서 바뀌었으면 고침) 효과를 볼 차례로
      o = { title: '조치를 마치고 효과를 볼까요?', desc: '상태가 효과 확인이 됩니다. 효과가 있는지 본 뒤 끝내거나 다시 조치합니다.', btn: '효과 확인으로',
        body: info + C.fieldHtml({ name: 'action', label: '한 조치', type: 'textarea', required: true, value: r.action, help: '처음 적은 조치에서 바뀐 것이 있으면 고칩니다.' }) +
          C.fieldHtml({ name: 'note', label: '효과를 볼 방법', type: 'textarea', required: true, placeholder: '예: 다음 달 기록 점검에서 같은 일이 없는지 봄' }),
        check: function (f) { return { action: val(f, 'action') ? '' : '한 조치를 적으세요.', note: val(f, 'note') ? '' : '효과를 볼 방법을 적으세요.' }; },
        save: function (f) { return { reason: val(f, 'note'), set: val(f, 'action') !== r.action ? { action: val(f, 'action') } : null }; } };
    } else if (kind === 'DONE') {
      o = { title: '개선 과제를 끝낼까요?', desc: '효과 확인과 끝낸 증거를 남기고 끝남이 됩니다. 끝낸 뒤에는 바꿀 수 없습니다.', btn: '끝내기',
        body: info + C.fieldHtml({ name: 'effect', label: '효과 확인', type: 'textarea', required: true, placeholder: '예: 10월 인사 변경 4건이 알린 날 반영된 것을 변경 이력으로 확인함' }) +
          fileFieldHtml('끝낸 증거', '효과를 확인한 자료를 올립니다(시안에서는 파일 이름만 남김).'),
        open: function (f) { wireFile(f, r.id + '_끝낸증거_' + D.TODAY + '.pdf'); },
        check: function (f) { return { effect: val(f, 'effect') ? '' : '효과 확인을 적으세요.', file: fileNameOf(f) ? '' : '끝낸 증거 파일을 고르세요.' }; },
        save: function (f) { return { reason: '효과 확인: ' + val(f, 'effect'), set: { effect: val(f, 'effect'), evidence: fileNameOf(f) } }; } };
    } else if (kind === 'REDO') {
      o = { title: '다시 조치할까요?', desc: '효과가 없으면 조치 중으로 되돌립니다. 기록은 그대로 남습니다.', btn: '다시 조치',
        body: info + C.fieldHtml({ name: 'note', label: '효과가 없는 까닭', type: 'textarea', required: true, placeholder: '예: 다음 달에도 같은 일이 한 건 나옴' }),
        check: function (f) { return { note: val(f, 'note') ? '' : '효과가 없는 까닭을 적으세요.' }; },
        save: function (f) { return { reason: val(f, 'note'), set: null }; } };
    } else {
      // 지금 책임자가 사용 중이 아니어도(사용 중지 등) 목록에 두어, 책임자를 바꾸지 않을 때 다른 사람으로 바뀌지 않게
      const owners = ownerOptions();
      if (!owners.some(function (x) { return x[0] === r.owner; })) owners.unshift([r.owner, C.ownerLabel(r.owner)]);
      o = { title: '기한이나 책임자를 바꿀까요?', desc: '바꾸면 이 과제의 기록과 변경 이력에 한 줄씩 남습니다.', btn: '저장',
        body: info + '<div class="field-row">' +
            C.fieldHtml({ name: 'owner', label: '책임자', type: 'select', required: true, value: r.owner, options: owners }) +
            C.fieldHtml({ name: 'due', label: '기한', type: 'date', required: true, value: r.due }) +
          '</div>' + C.fieldHtml({ name: 'note', label: '바꾸는 까닭', type: 'textarea', required: true, placeholder: '예: 영업 안내 일정이 다음 달 영업 회의로 밀림' }),
        check: function (f) {
          const due = val(f, 'due'), same = val(f, 'owner') === r.owner && due === r.due;
          return { owner: same ? '바뀐 내용이 없습니다.' : '', due: !due ? '기한을 적으세요.' : due < r.found ? '기한은 찾은 날보다 앞설 수 없습니다.' : '',
            note: val(f, 'note') ? '' : '바꾸는 까닭을 적으세요.' };
        },
        save: function (f) {
          const set = {};
          if (val(f, 'owner') !== r.owner) set.owner = val(f, 'owner');
          if (val(f, 'due') !== r.due) set.due = val(f, 'due');
          return { reason: val(f, 'note'), set: set };
        } };
    }
    C.formModal({
      title: o.title, desc: o.desc, body: o.body, btn: o.btn, open: o.open, check: o.check,
      done: function (f) {
        const s = o.save(f), to = STEP[kind] ? STEP[kind].to : r.state;
        const parts = [];
        if (STEP[kind]) parts.push('상태: ' + ST[r.state] + ' → ' + ST[to]);
        if (s.set && s.set.action) parts.push('조치 고침');
        if (s.set && s.set.owner) parts.push('책임자: ' + C.ownerLabel(r.owner) + ' → ' + C.ownerLabel(s.set.owner));
        if (s.set && s.set.due) parts.push('기한: ' + r.due + ' → ' + s.set.due);
        if (s.set && s.set.evidence) parts.push('끝낸 증거 ' + s.set.evidence);
        const e = C.adminSave('COMPLIANCE', r.id + ' ' + r.title, parts.join(', '), s.reason, { k: 'REMEDIATION_STEP', id: r.id, to: to, set: s.set });
        if (e.refused) return;
        render();
        C.toast(r.id + ' ' + (STEP[kind] ? '상태를 ' + C.josa(ST[to], '으로', '로') + ' 바꿨습니다.' : '기한과 책임자를 저장했습니다.'));
      },
    });
  }
  // 기록 보기: 모든 칸과 상태를 바꾼 기록(보기만 하는 창, 모두 봄)
  function openView(id) {
    const r = findRm(id);
    if (!r) return;
    const dd = function (k, v) { return '<div><dt>' + esc(k) + '</dt><dd>' + v + '</dd></div>'; };
    C.formModal({
      title: r.id + ' 개선 과제 기록',
      desc: '남긴 기록은 고치거나 지울 수 없습니다.',
      body: '<dl class="ob-info">' +
          dd('과제', esc(r.title)) + dd('찾은 곳', esc((RM.SOURCE[r.source] || r.source) + ', ' + C.fmtDate(r.found))) +
          dd('원인', esc(r.cause)) + dd('조치', esc(r.action)) + dd('책임자', esc(C.ownerLabel(r.owner))) +
          dd('기한', C.fmtDate(r.due) + (late(r) ? ' ' + C.badge('danger', '기한 지남') : '')) + dd('상태', C.badge(TONE[r.state], ST[r.state])) +
          dd('효과 확인', esc(r.effect || '-')) + dd('끝낸 증거', esc(r.evidence || '-')) + dd('관련 보류', esc(r.holdId || '없음')) +
          // 점검에서 넘어온 일로 기록한 과제는 그 번호와 점검 화면(2026-11-09 5회차 13번)
          (r.issueId ? dd('넘어온 일', esc(r.issueId) + ', ' + checkLinkHtml(r.link, r.source)) : '') +
        '</dl>' +
        '<div class="tbl-scroll" tabindex="0" role="region" aria-label="' + esc(r.id) + ' 상태를 바꾼 기록">' +
          '<table class="tbl tbl--compact tbl--history"><caption class="sr-only">' + esc(r.id) + ' 상태를 바꾼 기록: 일시, 상태, 내용, 남긴 사람</caption>' +
          '<thead><tr><th scope="col">일시</th><th scope="col">상태</th><th scope="col">내용</th><th scope="col">남긴 사람</th></tr></thead><tbody>' +
          r.history.slice().reverse().map(function (x) {
            const set = x.set || {};
            const more = [set.action ? '조치: ' + set.action : '', set.owner ? '책임자: ' + C.ownerLabel(set.owner) : '', set.due ? '기한: ' + set.due : '',
              set.effect ? '효과 확인: ' + set.effect : '', set.evidence ? '끝낸 증거: ' + set.evidence : ''].filter(Boolean);
            return '<tr><td class="num-left">' + C.fmtDateTime(x.at).split(' ').map(function (s) { return '<span class="keep">' + s + '</span>'; }).join(' ') + '</td>' +
              '<td class="nowrap">' + C.badge(TONE[x.to], ST[x.to]) + '</td>' +
              '<td>' + esc(x.note) + more.map(function (m) { return '<span class="cell-meta">' + esc(m) + '</span>'; }).join('') + '</td>' +
              '<td class="center">' + esc(C.ownerLabel(x.by)) + '</td></tr>';
          }).join('') + '</tbody></table></div>',
      btn: false,
    });
  }

  /* ---------- 그리기와 이벤트 ---------- */
  function render() {
    renderIssues(); // 점검에서 넘어온 일(2026-11-09 5회차 13번)
    renderHolds();
    renderRms();
    $('#history').innerHTML = C.adminHistoryHtml(C.adminLog(['COMPLIANCE']), '컴플라이언스 변경 이력');
  }
  $('#rm-view').addEventListener('click', function (e) {
    const b = e.target.closest('[data-view]');
    if (!b) return;
    view = b.getAttribute('data-view');
    rmPage = 1;
    $('#rm-view').querySelectorAll('[data-view]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    renderRms();
  });
  $('#content').addEventListener('click', function (e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'btn-hold' && canDo) openHold();
    else if (b.id === 'btn-rm' && canDo) openAdd();
    else if (b.getAttribute('data-issue') && canDo) { const iss = findIssue(b.getAttribute('data-issue')); if (iss) openAdd(iss); } // 넘어온 일을 개선 과제로(2026-11-09 5회차 13번)
    else if (b.getAttribute('data-release') && canDo) openRelease(b.getAttribute('data-release'));
    else if (b.getAttribute('data-assign') && canDo) openAssign(b.getAttribute('data-assign')); // ③ 결재자 지정(기획자 결정 2026-11-10 18번)
    else if (b.getAttribute('data-step') && canDo) openStep(b.getAttribute('data-id'), b.getAttribute('data-step'));
    else if (b.getAttribute('data-view-rm')) openView(b.getAttribute('data-view-rm'));
    else if (b.getAttribute('data-page') && !b.disabled) {
      // 쪽 번호: 보류 목록과 개선 과제 목록이 따로 넘김. 누른 단추가 없어지므로 초점도 그 묶음 제목으로(2026-11-06 점검 3회차)
      const n = Number(b.getAttribute('data-page'));
      if (b.closest('#holds-pages')) { holdPage = n; renderHolds(); C.focusSection('#sec-holds'); }
      else if (b.closest('#issues-pages')) { issuePage = n; renderIssues(); C.focusSection('#sec-issues'); } // 넘어온 일 쪽 번호(2026-11-09 5회차 13번)
      else { rmPage = n; renderRms(); C.focusSection('#sec-rm'); }
    }
  });
  render();
})();
