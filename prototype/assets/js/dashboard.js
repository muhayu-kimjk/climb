/* =====================================================================
 * SCR-01 개요(대시보드) 화면 로직 (dashboard.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-DASH-01~15, REQ-AUTH-04, REQ-AUTH-09
 * 상자는 한 줄에 하나씩, 계약이 먼저이고 시스템 이야기는 나중 (REQ-DASH-15, v0.55 순서). 쌓는 순서는 index.html이 정함
 *   1. 계약 진행 현황: KRDS 단계 표시기(계약 등록 → 계약 검토 → 계약 체결 → 운영 검토 → 계약 완료)
 *      + 그 아래 진행 상세 표(고객사, 서비스, 상태, 현재 진행, 대기). 현재 진행은 한 줄(C.progressCells, v0.55)
 *      표 위 회색 안내 한 줄로 단계 표시기와 ①~⑩ 번호의 관계(D-2), 영업이 처리할 줄에는 "내 차례" 배지(D-1) (기획자 결정 2026-11-02)
 *   2. 만료 임박: 만료일이 가까운 순서(A-1), 첫 칸 머리글 "만료까지"(D-14) (기획자 결정 2026-11-02)
 *   3. 내가 검토할 계약(결재 역할에게만), 챙길 의무(의무를 맡는 분야와 최고관리자에게만)
 *   4. 점검할 일: 정보보호 담당자, 리더와 최고관리자에게만. 이상 행위 알림, 매월 기록 점검, 분기 권한 검토 (v0.27)
 *      기획자 결정 2026-11-02 C-10: 점검을 맡은 모든 사람에게 넓히고 사람마다 자기 점검만(아래 CHECK_GROUPS)
 *        정보보호(위 셋과 최고관리자 작업 점검 C-6), 재무 임원(할인 예외 점검 C-9), 재무 리더와 법무(설정 변경 확인 C-8),
 *        재무(기간 마감 점검 B-9), 영업지원(영업기회 대사 E-1 ②), 총무(인장 기록 대사 E-7 ③), 컴플라이언스(거래처 확인 C-13, 개선 과제 C-16)
 *        매출 대사(B-7)는 재무와 상의 뒤 정하므로 아직 없음. 읽기만 하는 역할(감사 열람, 관찰자)은 점검할 일이 없음
 *   내가 검토할 계약의 줄은 C.turnHref로: 만료 처리와 유예 확인(A-10, A-11)은 계약 상세로
 *   기획자 결정 2026-11-03 C-44 영업대표 바꾸기
 *     영업의 범위(진행 현황, 계약 완료 건수, 만료 임박)는 내가 지금 영업대표인 계약도 넣음(C.salesRepOf, 나에게 넘어온 계약). 넘어간 계약의 만료 임박은 새 영업대표에게
 *     영업 리더(리더 본인 계약은 영업 임원)의 "내가 검토할 계약"에 영업대표 계정이 사용 중지되어 새 영업대표를 정할 계약(C.repTodo)을 함께. 누르면 계약 상세
 *     만료 임박의 담당자 칸은 지금 영업대표
 * 계약명은 따로 두지 않으므로 계약은 고객사와 서비스로 표시합니다. (v0.12)
 * "확인 필요" 상자는 뺐습니다. (REQ-DASH-09, v0.12)
 * 범위 [가정, REQ-DASH-14, C-44]: 영업은 내가 등록했거나 지금 영업대표인 계약, 그 외 역할은 전체 계약(작성 중 제외)
 * 프로토타입에서는 mock-data.js의 예시 데이터로 계산합니다.
 * 실제 시스템에서는 서버가 집계한 값을 받아 그리면 됩니다.
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const R = D.ALERT_RULES;

  const isApprover = C.hasRole(me, D.APPROVER_ROLES); // 리더는 그 분야 담당자처럼 (v0.29)
  // 단계를 처리하는 역할(결재 역할 + 총무, 고객지원, 재무). 결재 역할이 아니면 "검토" 대신 "처리"라고 씀 (v0.23)
  // 재무 리더와 재무 임원은 결재 단계를 맡지 않는 열람 역할(기획자 결정 v0.29)이라 "처리할 계약" 대신 전체 현황 인사말
  const viewOnly = me.role !== me.base && D.STEP_LEADS.indexOf(me.role) < 0;
  const isProcessor = C.hasRole(me, D.PROCESS_ROLES) && !viewOnly;
  const doWord = isApprover ? '검토할' : '처리할';
  const isSales = me.role === 'SALES';
  const mineQ = isSales ? '&owner=' + encodeURIComponent(me.id) : ''; // 영업이 누르는 목록 링크는 나로 거름

  /* ---------- 집계 ---------- */
  const all = D.CONTRACTS;
  const byStatus = function (list, s) { return list.filter(function (c) { return c.status === s; }); };
  const inReview = byStatus(all, 'IN_REVIEW');
  // 만료 임박: 계약 묶음의 지금 유효한 계약 기준 (조건 그대로 연장한 기록이 있으면 그 기간, common.js expiringBundles)
  //   해지 통지 기한이 90일 안에 오는 자동갱신 계약도 넣음 (v0.53, REQ-FLOW-32). bundle: 통지 기한 계산용
  //   영업은 내가 영업대표인 묶음만 (만료 예정 화면과 같은 범위, v0.58 QA: 건수와 링크한 목록이 달랐음)
  //   기획자 결정 2026-11-02 A-1(C-37 ①): 개요는 만료일이 가까운 순서. 표에는 만료까지 남은 D-n만 보여 그 순서여야 읽기 쉬움
  //     다음에 오는 날(통지 기한이나 만료일) 순서는 만료 예정 화면(SCR-43)에서만 씀(expiringBundles가 주는 순서)
  //   기획자 결정 2026-11-03(C-44): 영업대표는 지금 영업대표(나에게 넘어온 계약 포함, 넘어간 계약은 뺌)
  const expiring = C.expiringBundles(R.expiryWindowDays, true).filter(function (b) { return !isSales || C.isSalesRep(b, me); })
    .map(function (b) { return Object.assign({}, b.root, { endDate: b.end, bundle: b }); })
    .sort(function (a, b) { return a.endDate.localeCompare(b.endDate) || a.id.localeCompare(b.id); });
  const restricted = all.filter(function (c) { return c.restricted && c.status !== 'DRAFT'; });
  const myActions = C.myActions(me);
  // 기획자 결정 2026-11-03(C-44): 영업대표 계정이 사용 중지되어 내가(영업 리더, 리더 본인 계약은 영업 임원) 새 영업대표를 정할 계약 묶음
  const repTodo = C.repTodo(me);

  // 진행 현황의 범위: 영업은 내가 등록한 계약, 그 외는 전체(작성 중 제외: 작성자만 봄)
  //   기획자 결정 2026-11-03(C-44): 영업 리더가 나를 새 영업대표로 정한 계약도(내 등록 목록과 같은 범위)
  const scope = isSales
    ? all.filter(function (c) { return c.requesterId === me.id || C.salesRepOf(c) === me.id; })
    : all.filter(function (c) { return c.status !== 'DRAFT'; });
  const takenOver = isSales && scope.some(function (c) { return c.requesterId !== me.id; }); // 넘어온 계약이 있으면 진행 현황 머리 글을 맞춤

  /* ---------- 점검할 일 (REQ-DASH-16, REQ-SEC-05, 06, REQ-ADM-19~21) ----------
   * 접속 기록 점검(SCR-57)과 같은 기준: 이 시스템을 쓰기 시작한 달(D.SERVICE_START_MONTH, 2026-09)부터,
   * [가정] 매월 점검 기한은 다음 달 말일, 분기 권한 검토 기한은 분기가 끝난 다음 달 말일
   * 한 줄의 모양: { what 할 일, todo 할 일인지, state 상태 글, due 기한(없으면 null), noDue 기한을 정하지 않음, href 누르면 갈 곳 }
   * 기획자 결정 2026-11-02 C-2: 읽기만 하는 역할(감사 열람, 관찰자, 끝난 역할)은 점검을 보기만 하므로 할 일을 만들지 않음 */
  const readOnly = C.isReadOnly(me);
  // 정보보호 담당자와 리더(v0.29). 예전 이름 isAuditor는 감사 열람(C.isAuditor)과 헷갈려 바꿈(2026-11-02)
  const isPrivacy = !readOnly && (C.hasRole(me, ['PRIVACY']) || me.role === 'SUPER');
  const THIS_MONTH = D.TODAY.slice(0, 7);
  // 'YYYY-MM' → "2026년 9월", 기한(다음 달 말일), 이 시스템을 쓰기 시작한 달부터 끝난 달까지
  function ymLabel(ym) { return Number(ym.slice(0, 4)) + '년 ' + Number(ym.slice(5, 7)) + '월'; }
  function monthDue(ym) { return C.addDays(C.monthsLater(ym + '-01', 2), -1); }
  function endedMonths() {
    const out = [];
    for (let ym = D.SERVICE_START_MONTH; ym < THIS_MONTH; ym = C.monthsLater(ym + '-01', 1).slice(0, 7)) out.push(ym);
    return out;
  }
  function auditItems() {
    const START = D.SERVICE_START_MONTH, THIS = D.TODAY.slice(0, 7);
    const pad = function (n) { return String(n).padStart(2, '0'); };
    const lastDay = function (y, m) { return y + '-' + pad(m) + '-' + pad(new Date(y, m, 0).getDate()); };
    const next = function (y, m) { return m === 12 ? [y + 1, 1] : [y, m + 1]; };
    const items = [];
    const open = D.SEC_ALERTS.filter(function (a) { return a.status === 'OPEN'; });
    items.push({ what: '이상 행위 알림 확인', todo: open.length > 0, state: open.length ? '확인 전 ' + open.length + '건' : '모두 확인', due: null });
    // 매월 기록 점검: 끝난 달 중 점검하지 않은 달
    const monthTodo = endedMonths().filter(function (ym) { return !D.LOG_REVIEWS.some(function (r) { return r.month === ym; }); });
    if (monthTodo.length) monthTodo.forEach(function (ym) { items.push({ what: ymLabel(ym) + ' 기록 점검', todo: true, state: '점검 전', due: monthDue(ym) }); });
    else items.push({ what: Number(THIS_MONTH.slice(5, 7)) + '월 기록 점검', todo: false, state: '이달이 끝난 뒤', due: monthDue(THIS_MONTH) });
    superItems().forEach(function (x) { items.push(x); }); // 매월 기록 점검 바로 다음(C-6)
    // 분기 권한 검토: 끝난 분기 중 검토하지 않은 분기
    const qNow = Math.ceil(Number(THIS.slice(5, 7)) / 3), yNow = Number(THIS.slice(0, 4));
    const quarters = [];
    for (let qy = Number(START.slice(0, 4)), q = Math.ceil(Number(START.slice(5, 7)) / 3); qy < yNow || (qy === yNow && q < qNow); q === 4 ? (q = 1, qy++) : q++) quarters.push([qy, q]);
    const qTodo = quarters.filter(function (x) { return !D.ACCESS_REVIEWS.some(function (r) { return r.quarter === x[0] + '-Q' + x[1]; }); });
    qTodo.forEach(function (x) { const n = next(x[0], x[1] * 3); items.push({ what: x[0] + '년 ' + x[1] + '분기 권한 검토', todo: true, state: '검토 전', due: lastDay(n[0], n[1]) }); });
    if (!qTodo.length) { const n = next(yNow, qNow * 3); items.push({ what: yNow + '년 ' + qNow + '분기 권한 검토', todo: false, state: '분기가 끝난 뒤', due: lastDay(n[0], n[1]) }); }
    return items;
  }
  /* 기획자 결정 2026-11-02 C-6, C-10: 최고관리자 작업 점검(접속 기록 점검의 "최고관리자 작업" 묶음)
   *   매월 기록 점검과 따로 정보보호(담당자, 리더)만 결과를 남김. 기한은 매월 기록 점검과 같은 다음 달 말일
   *   끝난 달 중 남긴 결과(관리자 변경 이력의 점검 기록, op.k SUPER_REVIEW)가 없는 달마다 한 줄. 모두 남겼으면 이달 한 줄(이달이 끝난 뒤) */
  const SUPER_HREF = 'admin-logs.html#sec-super';
  function superItems() {
    const done = D.ADMIN_LOG.filter(function (e) { return e.op && e.op.k === 'SUPER_REVIEW' && e.op.r; }).map(function (e) { return e.op.r.month; });
    const todo = endedMonths().filter(function (ym) { return done.indexOf(ym) < 0; });
    return todo.length
      ? todo.map(function (ym) { return { what: ymLabel(ym) + ' 최고관리자 작업 점검', todo: true, state: '점검 전', due: monthDue(ym), href: SUPER_HREF }; })
      : [{ what: Number(THIS_MONTH.slice(5, 7)) + '월 최고관리자 작업 점검', todo: false, state: '이달이 끝난 뒤', due: monthDue(THIS_MONTH), href: SUPER_HREF }];
  }
  /* 기획자 결정 2026-11-02 C-10: 점검할 일 상자를 점검을 맡은 사람에게 넓히고, 사람마다 자기가 맡은 점검만 보임
   *   기간 마감: 지난달 말일의 확인(D.CLOSE_CHECKS + 시연 기록 closeChecks, 기록의 end가 기간 말)이 없으면 할 일
   *     기한은 아직 정하지 않아 비워 둠 [가정: 재무와 정함]. 최고관리자는 시연용으로 모두 봄 */
  const CLOSE_HREF = 'stats.html#close-panel';
  const isCloser = !readOnly && (C.hasRole(me, ['FINANCE']) || me.role === 'SUPER');
  function closeItems() {
    const prevEnd = C.addDays(D.TODAY.slice(0, 8) + '01', -1);
    const ym = function (s) { return Number(s.slice(0, 4)) + '년 ' + Number(s.slice(5, 7)) + '월'; };
    const done = (D.CLOSE_CHECKS || []).concat(C.loadDemo('closeChecks')).some(function (r) { return r.end === prevEnd; });
    return done ? [{ what: ym(D.TODAY) + ' 기간 마감 점검', todo: false, state: '이달이 끝난 뒤', due: null, href: CLOSE_HREF }]
      : [{ what: ym(prevEnd) + ' 기간 마감 점검', todo: true, state: '확인 전', due: null, noDue: true, href: CLOSE_HREF }];
  }
  /* 기획자 결정 2026-11-02 C-9, C-10: 할인 예외 점검(SCR-61, 재무 임원). 끝난 달 중 "점검 마침" 기록이 없는 달마다 한 줄, 기한은 다음 달 말일
   *   그달 기록(한계값, 줄 확인)이 있으면 "점검 중", 없으면 "점검 전". 모두 마쳤으면 이달 한 줄(이달이 끝난 뒤)
   *   기록은 D.DISCOUNT_REVIEWS(예시) + 시연 기록(discountReviews). 누르면 그달 점검으로 */
  function discountItems() {
    const recs = (D.DISCOUNT_REVIEWS || []).concat(C.loadDemo('discountReviews'));
    const done = recs.filter(function (r) { return r.type === 'DONE'; }).map(function (r) { return r.month; });
    const todo = endedMonths().filter(function (ym) { return done.indexOf(ym) < 0; });
    return todo.length
      ? todo.map(function (ym) {
        const started = recs.some(function (r) { return r.month === ym; });
        return { what: ymLabel(ym) + ' 할인 예외 점검', todo: true, state: started ? '점검 중' : '점검 전', due: monthDue(ym), href: 'discount-review.html?month=' + ym };
      })
      : [{ what: ymLabel(THIS_MONTH) + ' 할인 예외 점검', todo: false, state: '이달이 끝난 뒤', due: monthDue(THIS_MONTH), href: 'discount-review.html' }];
  }
  /* 기획자 결정 2026-11-02 C-8, C-10: 설정 변경 확인(SCR-65). 재무 리더는 가격 기준과 제품과 기능, 법무는 표준계약서(올린 사람이 아닌 법무)
   *   이 사람이 지금 확인할 수 있는 건수(control-checks.js canConfirm: 맡은 영역, 본인이 바꾼 줄이 아님, 아직 확인 없음)
   *   주기 없이 바뀔 때마다 확인하므로 기한은 비워 둠 [가정]. 결재선 규칙과 회사 설정은 정보보호의 매월 기록 점검에서 봄 */
  const X = window.CLIMB_CTL; // control-checks.js(index.html이 common.js 다음에 불러옴)
  function configItems() {
    const n = X.settingChanges({ areas: ['PRICE', 'PRODUCT', 'TEMPLATE'] }).filter(function (x) { return X.canConfirm(me, x).ok; }).length;
    return [{ what: '설정 변경 확인', todo: n > 0, state: n ? '확인 전 ' + n + '건' : '확인할 것 없음', due: null, noDue: true, href: 'config-review.html' }];
  }
  /* 기획자 결정 2026-11-02 C-13, C-16, C-10: 컴플라이언스의 일(C.complianceTodo: 거래처 확인, 개선 과제)
   *   거래처 확인은 거래처마다 다음 확인일이 달라 한 기한이 없음("-"). 개선 과제는 끝나지 않은 과제 가운데 가장 이른 기한 */
  function complianceItems() {
    return C.complianceTodo().map(function (x) { return Object.assign({ noDue: !x.due }, x); });
  }
  /* 점검을 맡는 묶음(맡는 역할은 common.js CHECK_OWNERS, 처리할 수 있는지는 C.canDoCheck: 읽기만 하는 역할은 false, 최고관리자는 시연용)
   *   on: 이 사람이 맡는지 / items: 할 일 줄 / who: 상자 설명 / more: 상자 머리 오른쪽 링크(맡은 묶음 가운데 첫째) / owner: 최고관리자에게 보일 맡은 사람
   *   차례: 정보보호(예전 그대로 맨 앞), 재무 임원, 재무 리더와 법무, 재무, 영업지원, 총무, 컴플라이언스 */
  const CHECK_GROUPS = [
    { on: isPrivacy, items: auditItems, who: '접속 기록 점검은 정보보호 담당자가', more: ['접속 기록 점검으로', 'admin-logs.html'], owner: '정보보호' },
    { on: C.canDoCheck(me, 'SCR-61'), items: discountItems, who: '할인 예외 점검은 재무 임원이', more: ['할인 예외 점검으로', 'discount-review.html'], owner: '재무 임원' },
    { on: C.canDoCheck(me, 'SCR-65'), items: configItems, who: '설정 변경 확인은 재무 리더와 법무가', more: ['설정 변경 확인으로', 'config-review.html'], owner: '재무 리더, 법무' },
    { on: isCloser, items: closeItems, who: '기간 마감 점검은 재무가', more: ['기간 마감 점검으로', CLOSE_HREF], owner: '재무' },
    { on: C.canDoCheck(me, 'SCR-62'), items: function () { return C.reconTodo('SCR-62'); }, who: '영업기회 대사는 영업지원이', more: ['영업기회 대사로', 'opp-recon.html'], owner: '영업지원' },
    { on: C.canDoCheck(me, 'SCR-63'), items: function () { return C.reconTodo('SCR-63'); }, who: '인장 기록 대사는 총무가', more: ['인장 기록 대사로', 'seal-recon.html'], owner: '총무' },
    { on: C.canDoCheck(me, 'SCR-64'), items: complianceItems, who: '거래처 확인과 개선 과제는 컴플라이언스 담당자가', more: ['개선 과제와 보류로', 'remediation.html'], owner: '컴플라이언스' },
  ].filter(function (g) { return g.on; });
  const audits = CHECK_GROUPS.reduce(function (out, g) {
    return out.concat(g.items().map(function (a) { return Object.assign({ owner: g.owner }, a); }));
  }, []);

  /* ---------- 공통 조각 ---------- */
  // 고객사 칸과 서비스 칸: 계약명 대신 고객사와 서비스로 계약을 구분 (v0.12)
  // 휴대폰에서는 서비스 칸을 감추고 고객사 아래 작은 글자로 보여줌 (칸이 넘치지 않게, REQ-ENV-08)
  // 열람 권한이 없으면 "열람 제한 계약"으로만 보여주고 서비스도 가림 (REQ-AUTH-09)
  //   sub: 휴대폰에서 고객사 아래에 더 보일 것(진행 상세는 상태 배지, v0.55)
  function customerCells(c, sub) {
    sub = sub || '';
    if (!C.canView(c, me)) {
      return '<td><span class="cell-title is-masked">' + C.icon('lock', 'sm') + '열람 제한 계약</span>' + sub + '</td><td class="col-service">-</td>';
    }
    // 작성 중인 계약은 계약 등록 화면(SCR-11)에서 이어서 작성, 그 밖에는 결재 문서 화면(검토 상세, SCR-23)
    // 계약 완료, 만료, 해지된 계약은 계약 상세(묶음, SCR-42)로 (v0.24)
    const href = c.status === 'DRAFT' ? 'new-contract.html?id=' + encodeURIComponent(c.draftKey)
      : ['ACTIVE', 'EXPIRED', 'TERMINATED'].indexOf(c.status) > -1 ? 'contract.html?id=' + encodeURIComponent(C.rootOf(c))
      : 'review.html?id=' + encodeURIComponent(c.id);
    const link = '<a class="cell-title" href="' + href + '">' + esc(c.counterparty) + '</a>';
    const service = esc(C.serviceLabel(c.services));
    return '<td>' + link + '<span class="cell-sub">' + service + '</span>' + sub + '</td><td class="col-service">' + service + '</td>';
  }

  // 결재 단계 점과 현재 진행 두 칸은 목록 화면들이 함께 쓰므로 common.js에 둠 (C.stepDots, C.progressCells)
  const stepDots = C.stepDots;

  // more: 오른쪽 '전체 보기' 링크(moreLabel, moreHref)
  function panelHead(id, title, sub, moreLabel, moreHref) {
    const attrs = 'href="' + moreHref + '"';
    return '<div class="panel-head">' +
      '<h2 class="panel-title" id="' + id + '">' + esc(title) + (sub ? ' <span class="panel-sub">' + sub + '</span>' : '') + '</h2>' +
      (moreLabel ? '<a class="link-more" ' + attrs + '>' + esc(moreLabel) + C.icon('chevronRight', 'sm') + '</a>' : '') +
    '</div>';
  }

  /* ---------- 1. 인사말과 기준일 ---------- */
  function renderGreeting() {
    // 이름 뒤 '님'은 붙여 씁니다. (REQ-UI-08 표기 규칙)
    const name = '<strong>' + esc(me.name) + '님</strong>, ';
    let msg;
    if (isProcessor) {
      // 영업 리더는 새 영업대표를 정할 계약도 셈(2026-11-03 C-44, 아래 내가 검토할 계약 표와 같은 수)
      const n = myActions.length + repTodo.length;
      msg = n
        ? name + '지금 ' + doWord + ' 계약이 <strong class="em">' + n + '건</strong> 있습니다.'
        : name + '지금 ' + doWord + ' 계약이 없습니다.';
    } else if (isSales) {
      msg = myActions.length
        ? name + '처리가 필요한 내 계약이 <strong class="em">' + myActions.length + '건</strong> 있습니다.'
        : name + '지금 처리할 계약이 없습니다.';
    } else {
      msg = name + '검토 중인 계약 <strong>' + inReview.length + '건</strong>, 열람 제한 계약 <strong>' + restricted.length + '건</strong>이 있습니다.';
    }
    // 정보보호: 점검할 일도 함께 (REQ-DASH-16)
    const auditCount = audits.filter(function (a) { return a.todo; }).length;
    //   기획자 결정 2026-11-02 C-10: 점검을 맡은 모든 사람(재무, 재무 임원, 재무 리더, 법무, 영업지원, 총무, 컴플라이언스)도 셈
    //   최고관리자는 시연으로 모든 점검을 보므로 인사말에는 넣지 않음(예전과 같음)
    if (me.role !== 'SUPER' && auditCount) msg += ' 점검할 일도 <strong class="em">' + auditCount + '건</strong> 있습니다.';
    document.getElementById('greeting').innerHTML = msg;
    document.getElementById('today').textContent = C.fmtToday() + ' 기준';
    // 최근 공지 한 줄은 없앰(v0.59 기획자 요청, REQ-UI-29). 공지와 릴리즈는 공지사항 게시판에서, 중요 공지는 이메일로(REQ-ENV-10).
    //   기능이 바뀐 것을 알리는 방법은 요구사항 정의서 C-35에서 정함. 팝업은 쓰지 않음(REQ-ENV-15)
  }

  /* ---------- 2. 계약 진행 현황 (REQ-DASH-04, 06, 08, 14) ----------
   * 업무 흐름 5단계(REQ-FLOW-13)를 KRDS 단계 표시기로 보여주고, 단계마다 건수를 붙입니다.
   * 단계는 메뉴 구성과 따로 갑니다: 계약 등록 → 계약 검토 → 계약 체결 → 운영 검토 → 계약 완료(보관함)
   * 진행 표시로 읽히지 않게 단계 번호를 담은 원으로 그리고, 건수가 있는 단계는 Dark Green 테두리입니다(has-items, KRDS v0.28).
   * 단계마다 단계 번호, 단계 이름, 건수만 보여 주고 아래 작은 설명 글은 두지 않습니다. (v0.14) */
  const STEPS = [
    // 영업은 내가 등록한 계약만 세므로 목록도 나로 거름(&owner=, v0.58 QA)
    // 누르면 건수와 같은 목록이 열리게 상태로 거름 (v0.63 점검에서 고침: 계약 등록과 계약 완료는 거르지 않은 목록이 열렸음).
    //   작성 중은 영업 본인만 셀 수 있어 영업이 아니면 링크 없음
    { label: '계약 등록', statuses: ['DRAFT'], href: isSales ? 'my-contracts.html?status=DRAFT' : '' },
    { label: '계약 검토', statuses: ['IN_REVIEW', 'SUPPLEMENT', 'REJECTED'], href: 'progress.html?status=REVIEW' + mineQ },
    // 계약 체결: 영업은 체결 대기 화면, 그 외는 전체 진행 현황(체결 대기로 거름)
    { label: '계약 체결', statuses: ['APPROVED'], href: isSales ? 'signing.html' : 'progress.html?status=APPROVED' },
    { label: '운영 검토', statuses: ['OPS_REVIEW'], href: 'progress.html?status=OPS_REVIEW' + mineQ },
    // 계약 완료는 묶음마다 셈(조건 그대로 연장한 기록을 따로 세지 않음)
    { label: '계약 완료', statuses: ['ACTIVE'], href: 'contracts.html?status=ACTIVE' + (isSales ? '&owner=' + encodeURIComponent(me.id) : ''), bundles: true },
  ];

  function renderProgress() {
    const stepsHtml = STEPS.map(function (s, i) {
      const list = s.bundles
        ? C.bundles().filter(function (b) { return b.status === 'ACTIVE' && (!isSales || C.salesRepOf(b) === me.id); }) // 지금 영업대표(2026-11-03 C-44)
        : scope.filter(function (c) { return s.statuses.indexOf(c.status) > -1; });
      const unknown = i === 0 && !isSales; // 작성 중 계약은 작성자 본인만 셀 수 있음
      const count = unknown ? '-' : list.length;
      const cls = !unknown && list.length ? ' class="has-items"' : ''; // 건수가 있는 단계 (v0.28: is-on 대신)
      return '<li' + cls + '>' +
        (s.href ? '<a class="step-body" href="' + s.href + '">' : '<span class="step-body">') +
          '<i class="step">' + (i + 1) + '단계</i>' +
          '<span class="step-tit">' + esc(s.label) + '</span>' +
          '<span class="step-count">' + count + (unknown ? '' : '<span class="unit">건</span>') + '</span>' +
        (s.href ? '</a>' : '</span>') +
      '</li>';
    }).join('');

    // 진행 상세: 아직 진행 중인 계약(작성 중, 검토 중, 반려, 체결 대기, 운영 검토). 계약 완료는 보관함에서 봄
    const order = { DRAFT: 0, IN_REVIEW: 1, SUPPLEMENT: 1, REJECTED: 1, APPROVED: 2, OPS_REVIEW: 3 };
    const dateOf = function (c) { return c.requestedAt || c.savedAt; };
    const rows = scope
      .filter(function (c) { return order[c.status] != null; })
      .sort(function (a, b) { return order[a.status] - order[b.status] || dateOf(a).localeCompare(dateOf(b)); });

    const sub = (isSales ? (takenOver ? '내가 등록하거나 이어 맡은 계약 ' : '내가 등록한 계약 ') : '전체 계약 ') + scope.length + '건';
    // 기획자 결정 2026-11-02 D-1(C-40 ①): 인사말의 "처리가 필요한 내 계약 n건"이 어느 줄인지 "내 차례" 배지로 알림
    //   영업만. n건과 같은 계약(C.myActions: 반려, 보완 요청, ⑦ 체결본 등록 차례)에만 붙임
    //   배지는 체결 대기 화면이 ⑦에 쓰는 것과 같은 모양(C.badge progress). 색이 아닌 글자라 분홍인 반려 줄, 흑백 인쇄에서도 보임
    const myTurn = isSales ? myActions : [];
    const turnBadge = C.badge('progress', '내 차례');
    const table = rows.length
      // 기획자 결정 2026-11-02 D-2(C-40 ②): 위 단계 표시기(1~5단계)와 현재 진행 칸의 번호(①~⑩)가 어떻게 이어지는지 표 위 회색 안내 한 줄
      //   전체 진행 현황(progress.html), 내 등록 목록(my-contracts.html)도 같은 문장. 영업 개요에는 "① 임시 저장" 줄도 있어 ①부터 적음
      ? '<p class="step-guide">현재 진행의 ①은 1단계 계약 등록, ②~⑤는 2단계 계약 검토, ⑥~⑧은 3단계 계약 체결, ⑨와 ⑩은 4단계 운영 검토입니다.</p>' +
        '<div class="tbl-wrap"><table class="tbl tbl--compact">' +
          '<caption class="sr-only">진행 상세: 고객사, 서비스, 상태, 현재 진행, 대기</caption>' +
          '<thead><tr><th scope="col" class="col-customer">고객사</th><th scope="col" class="col-service">서비스</th><th scope="col" class="col-status">상태</th><th scope="col">현재 진행</th><th scope="col" class="col-wait">대기</th></tr></thead>' +
          '<tbody>' + rows.map(function (c) {
            const turn = myTurn.indexOf(c) > -1;
            // 휴대폰은 칸이 좁아 상태 칸을 감추고 고객사 아래에 상태 배지를 둠(현재 진행이 한 줄에 들어가게, v0.55)
            //   "내 차례" 배지(D-1)도 휴대폰에서는 그 줄에 함께 두고, PC는 현재 진행 칸 단계 이름 뒤에 둠(체결 대기 화면과 같은 자리)
            return '<tr' + (c.status === 'REJECTED' ? ' class="is-alert"' : '') + '>' +
              customerCells(c, '<span class="cell-sub">' + C.statusBadge(c) + (turn ? ' ' + turnBadge : '') + '</span>') +
              '<td class="nowrap col-status">' + C.statusBadge(c) + '</td>' +
              C.progressCells(c, turn ? '<span class="turn-wide"> ' + turnBadge + '</span>' : '') + // 현재 진행(단계) + 대기(날수) 두 칸 (v0.55)
            '</tr>';
          }).join('') + '</tbody>' +
        '</table></div>'
      : '<p class="empty">진행 중인 계약이 없습니다.</p>';

    document.getElementById('progress').innerHTML =
      panelHead('progress-title', '계약 진행 현황', esc(sub)) +
      // 한눈에 보기용 표시기(진행 표시와 다른 모양, KRDS v0.28)
      '<ol class="step-wrap step-wrap--count step-wrap--flow" aria-label="계약 진행 단계별 건수">' + stepsHtml + '</ol>' +
      '<h3 class="block-subtitle">진행 상세</h3>' + table;
  }

  /* ---------- 3. 내가 검토할 계약 (결재 역할, REQ-DASH-03, 05) ---------- */
  function renderMyReviews() {
    const el = document.getElementById('my-reviews');
    if (!isProcessor) return;
    el.hidden = false;
    // 내 차례인 단계 (④⑤처럼 동시에 차례인 단계 중 내 것)
    const mine = function (c) { return C.pendingSteps(c).filter(function (s) { return C.isMyStep(s, me); })[0]; };
    const rows = myActions.slice().sort(function (a, b) { return C.waitDays(b, mine(b)) - C.waitDays(a, mine(a)); });
    // 고객지원과 재무는 운영 검토 대기로, 그 외는 검토 대기로
    const ops = C.hasRole(me, ['CEM', 'FINANCE']);
    // 영업은 검토 대기를 쓰지 않으므로 내 등록 목록으로 (v0.58 QA)
    const head = panelHead('my-reviews-title', '내가 ' + doWord + ' 계약', (rows.length + repTodo.length) + '건',
      isSales ? '내 등록 목록 전체 보기' : ops ? '운영 검토 대기 전체 보기' : '검토 대기 전체 보기',
      isSales ? 'my-contracts.html' : ops ? 'ops-queue.html' : 'review-queue.html');
    if (!rows.length && !repTodo.length) { el.innerHTML = head + '<p class="empty">지금 ' + doWord + ' 계약이 없습니다.</p>'; return; } // 상자 제목과 같은 말(총무, 고객지원, 재무는 "처리할", v0.63 점검)
    /* 기획자 결정 2026-11-03(C-44): 새 영업대표를 정할 계약(영업대표 계정이 사용 중지되었거나 영업 역할이 없어짐). 결재 줄 아래에 붙임
     *   요청자 칸은 맡을 수 없게 된 영업대표와 그 까닭, 대기는 그 계정의 권한 변경일(사용 중지나 역할 변경)부터, 내 단계는 "영업대표 지정". 누르면 계약 상세(영업대표 바꾸기 단추) */
    const repRows = repTodo.map(function (b) {
      const acc = C.accountOf(C.salesRepOf(b)), wait = acc && acc.roleChangedAt ? C.daysSince(acc.roleChangedAt) : 0;
      return '<tr>' +
        '<td><a class="cell-title" href="contract.html?id=' + encodeURIComponent(b.id) + '">' + esc(b.root.counterparty) + '</a>' +
          '<span class="cell-sub">' + esc(C.serviceLabel(b.root.services)) + '</span></td>' +
        '<td class="col-service">' + esc(C.serviceLabel(b.root.services)) + '</td>' +
        '<td class="center">' + esc(C.ownerLabel(C.salesRepOf(b))) + '<span class="cell-meta">' + esc(C.repGoneText(b)) + '</span></td>' + // 사용 중지나 영업 역할 없음(C-44)
        '<td class="num col-wait"><span' + (wait >= R.approvalDelayDays ? ' class="wait-long"' : '') + '>' + wait + '일</span></td>' +
        '<td class="nowrap col-steps">' + C.badge('attention', '영업대표 지정') + '</td>' +
      '</tr>';
    }).join('');
    el.innerHTML = head +
      '<div class="tbl-wrap"><table class="tbl tbl--compact">' +
        '<caption class="sr-only">내가 ' + doWord + ' 계약: 고객사, 서비스, 요청자, 대기 일수, 내 단계</caption>' +
        '<thead><tr><th scope="col" class="col-customer">고객사</th><th scope="col" class="col-service">서비스</th><th scope="col">요청자</th><th scope="col" class="col-wait">대기</th><th scope="col">내 단계</th></tr></thead>' +
        '<tbody>' + rows.map(function (c) {
          const s = mine(c);
          const wait = C.waitDays(c, s);
          // 내 차례인 결재 건은 열람 제한이어도 볼 수 있음 (REQ-AUTH-09)
          // 처리하는 화면으로(C.turnHref): 결재 단계는 결재 문서, ⑨ 만료 처리와 ③ 유예 확인은 그 단추가 있는 계약 상세(2026-11-02 A-10, A-11)
          //   보완 요청을 받은 기안자 줄처럼 내 차례인 단계가 없으면 결재 문서와 상태 배지
          return '<tr>' +
            '<td><a class="cell-title" href="' + C.turnHref(c, s) + '">' + esc(c.counterparty) + '</a>' +
              '<span class="cell-sub">' + esc(C.serviceLabel(c.services)) + '</span></td>' +
            '<td class="col-service">' + esc(C.serviceLabel(c.services)) + '</td>' +
            '<td class="center">' + esc(C.ownerLabel(c.requesterId)) + '</td>' +
            '<td class="num col-wait"><span' + (wait >= R.approvalDelayDays ? ' class="wait-long"' : '') + '>' + wait + '일</span></td>' +
            '<td class="nowrap col-steps">' + (s ? (C.isReviewStep(s.step) ? stepDots(c) : '') + esc(C.stepLabel(s.step, c)) : C.statusBadge(c)) + '</td>' +
          '</tr>';
        }).join('') + repRows + '</tbody>' +
      '</table></div>';
  }

  /* ---------- 3-1. 점검할 일 (정보보호, REQ-DASH-16. 2026-11-02 C-10: 점검을 맡은 모든 사람) ---------- */
  function renderAudit() {
    const el = document.getElementById('audit');
    if (!audits.length) return; // 점검을 맡은 사람에게만(C-10)
    el.hidden = false;
    const todo = audits.filter(function (a) { return a.todo; }).length;
    // 오른쪽 링크와 설명은 맡은 점검에 맞춰(C-10): 링크는 맡은 묶음 가운데 첫째 화면, 설명은 맡은 묶음마다 누가 하는지
    //   최고관리자는 모든 묶음이라 설명을 짧게 하고, 줄마다 맡은 사람을 작은 글자로 붙임
    const first = CHECK_GROUPS[0];
    const isSuper = me.role === 'SUPER';
    const who = isSuper ? '점검마다 맡은 사람이 합니다. 최고관리자는 시연으로 모든 점검을 봅니다.'
      : CHECK_GROUPS.map(function (g) { return g.who; }).join(', ') + ' 합니다.';
    el.innerHTML = panelHead('audit-title', '점검할 일', todo + '건', first.more[0], first.more[1]) +
      '<p class="panel-desc">' + who + ' 기한이 지나면 강조합니다.</p>' +
      '<div class="tbl-wrap"><table class="tbl tbl--compact">' +
        '<caption class="sr-only">점검할 일: 할 일, 상태, 기한</caption>' +
        '<thead><tr><th scope="col">할 일</th><th scope="col">상태</th><th scope="col">기한</th></tr></thead>' +
        '<tbody>' + audits.map(function (a) {
          const late = a.todo && a.due && C.daysUntil(a.due) < 0;
          // 기한을 정하지 않은 점검(noDue: 기간 마감, 설정 변경 확인, 거래처 확인)은 "-"
          const dueText = !a.due ? (a.todo && !a.noDue ? '바로' : '-') : C.fmtDate(a.due) + (a.todo ? ' (' + (late ? '기한 지남' : 'D-' + C.daysUntil(a.due)) + ')' : '');
          return '<tr' + (late ? ' class="is-alert"' : '') + '><td><a class="cell-title" href="' + (a.href || 'admin-logs.html') + '">' + esc(a.what) + '</a>' +
              (isSuper ? '<span class="cell-meta">' + esc(a.owner) + '</span>' : '') + '</td>' +
            '<td class="nowrap">' + C.badge(a.todo ? (a.what.indexOf('알림') > -1 ? 'danger' : 'attention') : 'line', a.state) + '</td>' +
            '<td class="num-left">' + dueText + '</td></tr>';
        }).join('') + '</tbody></table></div>';
  }

  /* ---------- 3-1. 챙길 의무 (v0.53 기획자 결정, REQ-FLOW-35) ----------
   * 체결 후 의무를 맡는 분야(정보보호, 고객지원, 재무의 담당자와 리더)와 최고관리자에게만
   * 내 분야의 의무 중 기한이 지났거나 14일 안인 것. 열람 제한 계약은 고객사를 가림 */
  function renderObligations() {
    const el = document.getElementById('obligations');
    const areas = Object.keys(D.OBLIGATION_KINDS).map(function (k) { return D.OBLIGATION_KINDS[k].owner; })
      .filter(function (r) { return me.role === 'SUPER' || C.hasRole(me, [r]); });
    if (!areas.length) return;
    el.hidden = false;
    const list = D.OBLIGATIONS.filter(function (o) {
      const s = C.obligationState(o);
      return areas.indexOf(C.obligationOwner(o)) > -1 && ['LATE', 'SOON'].indexOf(s.code) > -1 && C.canSeeObligation(me, o);
    }).sort(function (a, b) { return C.obligationState(a).next.localeCompare(C.obligationState(b).next); });
    const late = list.filter(function (o) { return C.obligationState(o).code === 'LATE'; }).length;
    el.innerHTML = panelHead('obligations-title', '챙길 의무', list.length + '건', '의무 관리로', 'obligations.html') +
      '<p class="panel-desc">' + (me.role === 'SUPER' ? '모든 분야' : areas.map(function (r) { return D.ROLE_AREA[r]; }).join(', ') + ' 분야') +
        '가 맡은 체결 후 의무 가운데 기한이 지났거나 ' + R.obligationSoonDays + '일 안인 것입니다.' + (late ? ' 기한이 지난 의무가 ' + late + '건 있습니다.' : '') + '</p>' +
      (list.length ? '<div class="tbl-wrap"><table class="tbl tbl--compact">' +
        '<caption class="sr-only">챙길 의무: 기한, 의무, 고객사, 맡은 분야</caption>' +
        '<thead><tr><th scope="col">기한</th><th scope="col">의무</th><th scope="col">고객사</th><th scope="col" class="col-owner">맡은 분야</th></tr></thead>' +
        '<tbody>' + list.map(function (o) {
          const s = C.obligationState(o);
          const root = D.CONTRACTS.find(function (c) { return c.id === o.bundle; });
          const cust = root && C.canView(root, me)
            ? '<a class="cell-title" href="contract.html?id=' + encodeURIComponent(o.bundle) + '">' + esc(root.counterparty) + '</a>'
            : '<span class="cell-title is-masked">' + C.icon('lock', 'sm') + '열람 제한 계약</span>';
          return '<tr' + (s.code === 'LATE' ? ' class="is-alert"' : '') + '>' +
            '<td class="center nowrap">' + C.fmtDate(s.next) + '<span class="cell-meta">' + C.badge(s.tone, s.label) + '</span></td>' +
            '<td><a href="obligations.html">' + esc(o.title) + '</a><span class="cell-meta">' + esc((D.OBLIGATION_KINDS[o.kind] || {}).label) + '</span></td>' +
            '<td>' + cust + '<span class="cell-sub">' + esc(C.obligationOwnerLabel(o)) + '</span></td>' +
            '<td class="center col-owner">' + esc(C.obligationOwnerLabel(o)) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
        : '<p class="empty">' + R.obligationSoonDays + '일 안에 챙길 의무가 없습니다.</p>');
  }

  /* ---------- 4. 만료 임박 (REQ-DASH-07) ----------
   * 표로 보여 줍니다: 만료까지, 고객사, 서비스, 만료일, 담당자 (v0.14)
   * 첫 칸 머리글은 "만료까지"(기획자 결정 2026-11-02 D-14, 예전 "남은 일자"). 배지는 그대로 만료일까지 남은 D-n
   * 만료일이 가까운 순서 (A-1, 위 expiring)
   * 고객사, 서비스 칸 너비는 진행 상세 표와 같게 맞춤 */
  function renderExpiring() {
    const soon = expiring.filter(function (c) {
      const n = C.noticeDate(c.bundle);
      return n && C.daysUntil(n) >= 0 && C.daysUntil(n) <= D.ALERT_RULES.noticeSoonDays && C.canView(c, me);
    }).length;
    const head = panelHead('expiring-title', '만료 임박', null, '전체 보기', 'expiring.html') +
      '<p class="panel-desc">' + R.expiryWindowDays + '일 이내에 만료되거나 해지 통지 기한이 오는 계약입니다. 만료일이 가까운 순서입니다.' + // 순서 A-1(2026-11-02)
      (soon ? ' 해지 통지 기한이 ' + D.ALERT_RULES.noticeSoonDays + '일 안에 오는 자동갱신 계약이 <a href="expiring.html?view=notice">' + soon + '건</a> 있습니다. 연장하지 않으려면 기한까지 상대방에게 알려야 합니다.' : '') + '</p>';
    if (!expiring.length) {
      document.getElementById('expiring').innerHTML = head + '<p class="empty">' + R.expiryWindowDays + '일 이내에 만료되는 계약이 없습니다.</p>';
      return;
    }
    const rows = expiring.map(function (c) {
      const d = C.daysUntil(c.endDate);
      const tone = C.ddayTone(d); // 30일 이내 Pink, 60일 이내 Purple, 그 외 Blue (REQ-DASH-07)
      const dday = '<span class="badge badge--' + tone + '" aria-label="만료까지 ' + d + '일">D-' + d + '</span>';
      // 열람 제한 계약은 고객사, 서비스, 담당자를 가림 (REQ-AUTH-09)
      const owner = C.canView(c, me) ? esc(C.ownerLabel(C.salesRepOf(c))) : '-'; // 지금 영업대표(2026-11-03 C-44)
      return '<tr>' +
        '<td class="center">' + dday + '</td>' + // 날짜에 딸린 값이라 가운데 (v0.55 기획자 요청, REQ-UI-16)
        customerCells(c) +
        // 휴대폰에서는 담당자 칸을 감추고 만료일 아래 작은 글자로 보여줌 (REQ-ENV-08)
        // 해지 통지 기한 줄은 두지 않음(v0.59 기획자 요청: 만료까지 남은 일자로 충분히 알아봄). 통지 기한은 만료 예정 화면(SCR-43)과 계약 상세에서 봄
        // 휴대폰은 이 칸이 줄을 바꿀 수 있게 해(col-expiry) 고객사 이름이 꺾이지 않게 함(v0.55)
        '<td class="nowrap col-expiry">' + C.fmtDate(c.endDate) +
          (C.canView(c, me) ? '<span class="cell-sub">담당 ' + owner + '</span>' : '') + '</td>' +
        '<td class="center col-owner">' + owner + '</td>' +
      '</tr>';
    }).join('');
    document.getElementById('expiring').innerHTML = head +
      '<div class="tbl-wrap"><table class="tbl tbl--compact">' +
        '<caption class="sr-only">만료 임박: 만료까지, 고객사, 서비스, 만료일, 담당자</caption>' +
        '<thead><tr><th scope="col">만료까지</th><th scope="col" class="col-customer">고객사</th><th scope="col" class="col-service">서비스</th>' +
          '<th scope="col">만료일</th><th scope="col" class="col-owner">담당자</th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table></div>';
  }

  renderGreeting();
  renderProgress();
  renderMyReviews();
  renderAudit();
  renderObligations();
  renderExpiring();
})();
