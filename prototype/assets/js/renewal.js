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
 *   6. 설계 검토 2026-11-11 3장: "연장할 계약" 아래 회색 상자 한 줄에 지금 계약 금액, 오늘 표준 금액, 차이(C.renewStd). 기안하면 그날 표준 금액을 남김(stdAmount)
 *   7. 설계 검토 2026-11-11 남은 것 ②: 계약 금액과 그대로 연장 기록의 금액은 지금 유효한 조건(C.currentTerms)의 금액(변경 계약 반영, 유상 충전은 뺌 [가정]).
 *      오늘 표준 금액(C.renewStd)도 같은 제품 줄(currentTerms.lines)로 셈해 두 금액이 같은 바탕
 *   8. (2026-11-14 주말 점검 W7, icfr-05) 금액이 바뀌는 변경(추가, 줄임)이 진행 중이면 연장 검토를 막음(조항만은 기간을 줄이지 않으면 막지 않음).
 *      (2026-11-14 주말 점검, 코드 다시 보기 amend-01, amend-02) 기간을 줄이는 변경(조항만 포함, C.amendShortens)이 진행 중이어도 막음(CTL-66).
 *      계약 상세와 만료 예정의 연장 단추도 같은 규칙(contract.js, expiring.js periodBusy)
 *      그대로 연장 금액은 기안할 때의 지금 유효한 조건이라, 뒤에 끝난 변경이 새 기간 금액에서 빠지지 않게(계약 등록 originBlock과 같은 규칙)
 *   9. (2026-11-14 주말 점검 W7, icfr-03) 지금 유효한 조건의 금액(keepAmount)이 0원 이하이면 그대로 연장을 고를 수 없고 기안도 막음.
 *      "조건을 바꿔 연장"(계약 등록)으로 금액을 정해 기안(계약 등록의 0원 막음 REQ-SCOPE-05가 받음)
 *      (2026-11-14 주말 점검 W7) 보완 후 재기안에서는 그 갈래가 없어 "반려된 채로 두고 영업지원에 알림" 안내만(갈 길은 [남은 일])
 *  10. (2026-11-14 주말 점검 W7, abc-07) 거래처 확인 경고(C.customerCheckNote, 계약 등록과 같은 문장, 막지 않음)를 1번 묶음에 보이고
 *      기안하면 연장 기록의 customerCheckWarn으로 남김(결재 문서가 "기안 때 거래처 확인 경고"로 보임)
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
  // 설계 검토 2026-11-11 5번: 예전 계약 기록(LG-번호)도 원계약으로 받음. 다만 바로잡힌 기록은 쓰지 않고 바로잡은 새 기록에서 기안 [가정]
  if (C.legacyReplacedBy(root)) {
    $('#notice').innerHTML = notice('바로잡힌 예전 계약 기록입니다', '이 기록은 바로잡혀 새 기록(' + esc(C.legacyReplacedBy(root).id) + ')이 있습니다. <a href="contract.html?id=' +
      encodeURIComponent(C.legacyReplacedBy(root).id) + '">새 기록의 계약 상세로</a>');
    return;
  }
  // 진행 중인 연장, 해지, 기간을 바꾸는 운영 변경이 있으면 막음 (v0.58 QA: 기간 변경이 끝나기 전에 연장하면 바뀐 기간이 사라졌음)
  //   (2026-11-14 주말 점검 W7, icfr-05) 금액이 바뀌는 변경(추가, 줄임)이 진행 중이어도 막음: 그 변경이 연장보다 늦게 끝나면 새 기간 금액에서 빠짐.
  //     조항만 변경은 금액이 없어 막지 않음. 이 칸 전에 기안한 변경은 추가로 봄(C.amendKindOf)
  //   (2026-11-14 주말 점검, 코드 다시 보기 amend-01, amend-02) 다만 기간을 줄이는 변경(조항만 포함, C.amendShortens)은 기간 변경처럼 막음(CTL-66, 계약 등록 originBlock과 같음):
  //     그 변경이 연장보다 늦게 끝나면 원계약 기간이 줄어 연장 시작일과 사이가 빔
  const blocking = b.open.filter(function (o) {
    return o.kind === 'RENEW' || o.kind === 'TERMINATE' || (o.kind === 'CHANGE' && o.changeType === 'PERIOD') || (o.kind === 'AMEND' && C.amendKindOf(o) !== 'TERMS') ||
      C.amendShortens(o, b.end);
  });
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
  // (2026-11-14 주말 점검 W7, icfr-05) 안내 글에 금액이 바뀌는 변경(추가, 줄임)을 더하고 링크 옆에 종류를 붙임(어느 기안 때문인지 보이게)
  //   (2026-11-14 주말 점검, 코드 다시 보기 amend-01, amend-02) 글 머리에 "계약 기간을 줄이는 변경"도 더함: 기간을 줄이는 조항만 변경으로 막혀도
  //     예전 글은 "금액이 바뀌는 변경(추가, 줄임)"이라고만 해 "변경(조항만)" 링크와 앞뒤가 맞지 않았음
  else if (blocking.length) stop = '진행 중인 연장, 해지, 기간 변경, 금액이 바뀌는 변경(추가, 줄임)이나 계약 기간을 줄이는 변경이 있습니다: ' + blocking.map(function (o) { return '<a href="review.html?id=' + encodeURIComponent(o.id) + '">' + esc(o.id) + '</a> ' + esc(C.kindLabel(o)); }).join(', ') +
    '. 그 기안이 끝난 뒤에 연장을 검토합니다.';
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
  // (설계 검토 2026-11-11 남은 것 ②) 그대로 연장의 금액은 지금 유효한 조건(C.currentTerms)의 금액: 바탕(원계약이나 조건을 바꾼 연장) + 계약 완료된 변경 계약(늘거나 준 만큼)
  //   예전에는 지금 유효한 계약(cur)의 금액이라 변경 계약(추가, 줄임)이 빠졌음. 아래 오늘 표준 금액(C.renewStd)도 같은 제품 줄(currentTerms.lines)로 셈해 두 금액이 맞음
  //   [가정] 이 계약 기간의 유상 충전(운영 변경)은 넣지 않음(currentTerms의 core. 여러 해 계약도 계약 연도로 자르지 않음, 2026-11-14 주말 점검): 그 기간에만 쓰는 것이라 지금 유효한 조건도 그대로 연장 뒤로 넘기지 않음
  //   [가정] 원계약이 계약 완료 전이라 셀 수 없으면(이 화면에 오지 않지만) 예전처럼 지금 유효한 계약의 금액
  const terms = C.currentTerms(b.id);
  const keepAmount = terms && terms.ready ? terms.core : Number(cur.amount || 0);
  // 계약 금액 칸의 작은 줄: 반영한 변경과 넣지 않은 유상 충전(있을 때만)
  const keepNote = !terms || !terms.ready ? '' : [terms.amends.length ? '변경 ' + terms.amends.length + '건 반영' : '',
    terms.paid ? '이 계약 기간 유상 충전 ' + C.fmtWon(terms.paid) + '은 넣지 않음' : ''].filter(Boolean).join(', ');
  // (2026-11-14 주말 점검 W7, icfr-03) 그대로 연장의 금액이 0원 이하이면(예전 기록이나 모두 줄인 계약) 그대로 연장을 고를 수 없고 기안도 막음.
  //   음수나 0원 연장이 기안되어 통계 체결 금액(순합계)과 지금 유효한 조건이 틀리지 않게. 조건을 바꿔 연장(계약 등록)은 0원 막음(REQ-SCOPE-05)이 받음
  const keepOff = keepAmount <= 0;
  //   (2026-11-14 주말 점검 W7) 보완 후 재기안(again)에서는 "조건을 바꿔 연장" 갈래가 감춰지고 계약 등록의 연장도 반려된 이 기안 때문에 막혀,
  //     없는 갈래를 가리키지 않게 따로 안내함. 기획자 결정 2026-11-16(결정할것 5-3 작은 확인): 그 반려된 연장은 진행 중단으로 끝내고
  //     (진행 중단의 뜻을 "무산되거나 다시 기안할 수 없게 된 기안"으로 넓힘) 계약 등록에서 조건을 바꿔 연장함. 진행 중단되면 계약 등록의 연장 막음도 풀림
  const KEEP_OFF_MSG = again
    ? '지금 유효한 조건의 금액이 ' + C.fmtWon(keepAmount) + '이라 이 연장을 그대로 다시 기안할 수 없습니다. 결재 문서에서 이 기안의 진행 중단을 요청해 끝낸 뒤, 계약 등록에서 조건을 바꿔 연장합니다.'
    : '지금 유효한 조건의 금액이 ' + C.fmtWon(keepAmount) + '이라 그대로 연장할 수 없습니다. "조건을 바꿔 연장"을 골라 계약 등록에서 금액을 정해 기안합니다.';
  /* (2026-11-14 주말 점검 W7, abc-07) 거래처 확인 경고: 계약 등록(C-13)과 같은 문장(C.customerCheckNote), 막지 않음
   *   국가와 지자체(가운데 83), 조달, 간접 거래처인데 확인 전이거나 다음 확인일이 지났거나 문제 있음이면. 예전 계약 기록의 거래처도 같음
   *   거래처는 원계약의 거래처, 계약 방식은 지금 유효한 조건의 바탕(원계약이나 조건을 바꾼 연장)의 방식. 화면을 열 때 정해져 고른 뒤에 생기는 줄이 아님 */
  const ckCu = C.customerOfContract(root);
  const ckBiz = ckCu ? ckCu.bizNo : ((root.form || {}).bizNo || root.bizNo || '');
  const custCheck = ckBiz ? C.customerCheckNote(ckBiz, C.methodOf((terms && terms.lineBase) || root)) || '' : '';
  const newId = again ? again.id : C.nextChildId(b.id, 'RENEW');
  const newStart = addDays(b.end, 1); // 새 계약 시작일 기본값: 지금 종료일 다음 날
  /* 기획자 결정 2026-11-16(결정할것 새 결정 W7-2 (가)): 그대로 연장은 지금 계약 기간(지금 유효한 계약: 원계약이나 마지막 연장의 계약서 기간)과 같은 달 수만 받음.
   *   새 시작일을 고르면 종료일이 정해짐(시작일부터 그 달 수 뒤의 전날, 종료일 칸은 읽기만). 기간이 다르면 "조건을 바꿔 연장"(계약 등록)으로.
   *   금액은 지금 금액 그대로라 기간을 늘리거나 줄이면 큰 할인이나 기간 귀속 어긋남이 ③ 가격 판단 없이 생기기 때문(CTL-69, CTL-139, REQ-ARC-07 v0.25를 바꿈)
   *   운영 변경으로 늘린 기간은 계약서 기간이 아니라 넣지 않음 [가정]. 지금 계약 기간을 알 수 없으면(날짜가 없음) 예전처럼 종료일을 직접 넣음 */
  const curStart = cur.startDate || (cur.form || {}).startDate || '', curEnd = cur.endDate || (cur.form || {}).endDate || '';
  const keepMonths = C.periodMonths(curStart, curEnd);
  function keepEnd(start) { return start && keepMonths ? addDays(C.monthsLater(start, keepMonths), -1) : ''; }
  if (keepMonths) {
    $('#f-end').readOnly = true;
    $('#f-end').setAttribute('aria-describedby', 'keep-months-help');
    $('#f-end').closest('.field').insertAdjacentHTML('beforeend', '<p class="field-help" id="keep-months-help">지금 계약 기간과 같은 ' + keepMonths + '개월로 정해집니다. 기간을 바꾸려면 "조건을 바꿔 연장"을 고릅니다.</p>');
    $('#f-start').addEventListener('change', function () { $('#f-end').value = keepEnd($('#f-start').value); });
    $('#f-start').addEventListener('input', function () { $('#f-end').value = keepEnd($('#f-start').value); });
  }
  const noticeDay = C.noticeDate(b);
  function info(label, value, cls) { return '<div><dt>' + esc(label) + '</dt><dd' + (cls ? ' class="' + cls + '"' : '') + '>' + value + '</dd></div>'; } // cls amount: 금액은 오른쪽(REQ-UI-16)
  $('#origin').innerHTML = [
    info('고객사', esc(root.counterparty)),
    info('계약번호', '<a href="' + back + '">' + esc(b.id) + '</a>' + (cur !== root ? ' (지금 유효: ' + esc(cur.id) + ')' : '') +
      // 설계 검토 2026-11-11 5번: 원계약이 예전 계약 기록이면 그 표시와 예전 문서 번호
      (root.legacy ? '<span class="cell-meta">' + C.legacyBadges(root) + ' 예전 문서 ' + esc(root.legacy.docNo || '-') + '</span>' : '')),
    // 늦은 연장(A-11)은 만료 처리 상태를 함께("만료, 서비스 닫기 전", "유예 중 (~2026-11-06)")
    // 2026-11-09 5회차 점검: 종료일이 오늘이면 "만료까지 0일" 대신 "오늘 만료"(다른 화면의 "오늘"과 같은 말)
    info('계약 기간', C.fmtPeriod(b.start, b.end) + '<span class="cell-meta">' + (late ? esc(ex.label) : C.daysUntil(b.end) ? '만료까지 ' + C.daysUntil(b.end) + '일' : '오늘 만료') + '</span>'),
    // (설계 검토 2026-11-11 남은 것 ②) 지금 유효한 조건의 금액(위 keepAmount). 그대로 연장하면 이 금액으로 기안함
    info('계약 금액', keepAmount.toLocaleString('ko-KR') + '원<span class="cell-meta">' + esc(C.fmtKRW(keepAmount)) + ', 부가세 별도' + (keepNote ? ', ' + esc(keepNote) : '') + '</span>', 'amount'),
    info('해지 통지 기한', noticeDay ? '<span class="keep">' + C.fmtDate(noticeDay) + (C.daysUntil(noticeDay) < 0 ? ' <span class="wait-long">지남</span>' : '') + '</span><span class="cell-meta">만료 ' + b.noticeDays + '일 전까지 상대방에게 알려야 연장되지 않음</span>' : '-'),
    // 기획자 결정 2026-11-03(C-44): 지금 영업대표. 바뀌었으면 처음 기안한 사람, 맡을 수 없으면 "담당 지정 필요"(계약 상세와 같음)
    // "담당 지정 필요"는 계약 상세, 결재 화면처럼 주의 배지로 보임(회색 글자였음) (2026-11-06 점검)
    info('영업대표', esc(C.ownerLabel(C.salesRepOf(b))) +
      (C.salesRepOf(b) !== root.requesterId ? '<span class="cell-meta">처음 기안 ' + esc(C.ownerLabel(root.requesterId)) + '</span>' : '') +
      (C.repNote(b) ? '<span class="cell-meta">' + C.badge('attention', C.repNote(b)) + '</span>' : '')),
  ].join('');
  // 지금 계약 금액과 오늘 표준 금액 (설계 검토 2026-11-11 3장): 정보 칸 아래 회색 상자 한 줄. 막지 않고 보여 주기만 함
  //   오늘 가격 기준으로 지금 계약과 같은 기간(달 수)의 표준 금액을 셈(C.renewStd, 할인 예외 점검의 참고 줄과 같은 규칙)
  //   [가정] 견줄 수 없으면(제품 줄 없음, 가격 기준 없음, 단위 바뀜) 같은 자리에 까닭을 보여 상자의 자리와 높이가 계약마다 같게 함
  //   금액이 같으면 차이 칸에 "없음". 할인율처럼 (표준 금액 - 계약 금액) / 표준 금액을 괄호에 보임
  const curStd = C.renewStd(b.id, { day: D.TODAY, before: C.nowStamp(), start: C.startOf(cur), end: C.endOf(cur) });
  function stdDiffText(amount, std) {
    const gap = std - Number(amount || 0);
    if (!gap) return '없음';
    return '표준보다 ' + C.fmtWon(Math.abs(gap)) + ' ' + (gap > 0 ? '낮음' : '높음') + ' (' + Math.round(Math.abs(gap) / std * 1000) / 10 + '%)';
  }
  //   (설계 검토 2026-11-11 남은 것 ②) 지금 계약 금액은 위 keepAmount(변경 계약 반영). 표준 금액도 같은 제품 줄로 셈(C.renewStd)
  $('#std-line').innerHTML = curStd.std != null && curStd.std > 0
    ? C.meta([['지금 계약 금액', esc(C.fmtWon(keepAmount))], ['오늘 표준 금액' + (curStd.months ? '(' + curStd.months + '개월)' : ''), esc(C.fmtWon(curStd.std))],
      ['차이', esc(stdDiffText(keepAmount, curStd.std))]])
    : C.meta([['지금 계약 금액', esc(C.fmtWon(keepAmount))], ['오늘 표준 금액', esc((curStd.why || '표준 금액이 0원이라') + ' 견주지 않음')]]);
  // (2026-11-14 주말 점검 W7, abc-07) 거래처 확인 경고 한 줄(계약 등록의 #customer-check와 같은 모양). 없으면 감춤
  $('#customer-check').innerHTML = custCheck ? C.icon('alert', 'sm') + esc(custCheck) : '';
  $('#customer-check').hidden = !custCheck;
  $('#keep-help').textContent = (again ? '같은 번호 ' + newId + '의 ' + ((again.round || 1) + 1) + '차로 기안하고' : '기안하면 ' + newId + '(연장, 조건 그대로)로 묶이고') +
    ', 승인되면 아래에 입력한 기간이 새 계약 기간이 됩니다. 금액과 조건은 그대로입니다.';
  $('#f-start').value = newStart;
  if (keepMonths) $('#f-end').value = keepEnd(newStart); // W7-2(2026-11-16)
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
    $('#f-end').value = keepMonths ? keepEnd($('#f-start').value) : again.endDate || ''; // W7-2: 보완 후 재기안도 같은 달 수
    $('#f-reason').value = again.reason || '';
  }
  // (2026-11-14 주말 점검 W7, icfr-03) 금액이 0원 이하: 그대로 자동갱신을 끄고(까닭을 그 줄 끝에) 조건을 바꿔 연장을 미리 고름. 맨 위에 까닭 안내
  //   보완 후 재기안은 다른 갈래가 없어 안내만 하고, 기안 단추를 누르면 아래 입력 검사가 막음
  if (keepOff) {
    const kr = document.querySelector('input[name="choice"][value="KEEP"]');
    if (kr && !again) {
      kr.checked = false;
      kr.disabled = true;
      kr.closest('label').insertAdjacentHTML('beforeend', ' (지금 금액이 0원 이하라 고를 수 없음)');
      const cr = document.querySelector('input[name="choice"][value="CHANGE"]');
      if (cr) cr.checked = true;
    }
    $('#notice').innerHTML += C.noticeBox('', '그대로 연장할 수 없는 금액입니다', esc(KEEP_OFF_MSG));
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
      // (2026-11-14 주말 점검 W7, icfr-03) 금액이 0원 이하이면 그대로 연장을 기안하지 않음(위에서 고를 수 없게 했지만 보완 후 재기안과 서버 몫까지 두 겹)
      choice: keepOff ? KEEP_OFF_MSG : '',
      start: !start ? C.dateFieldError($('#f-start'), '새 계약 시작일을 고르세요.') : start < newStart ? '새 계약 시작일은 지금 종료일 다음 날(' + C.fmtDate(newStart) + ') 이후여야 합니다.' : '',
      end: !end ? C.dateFieldError($('#f-end'), '새 계약 종료일을 고르세요.') : start && end < start ? '새 계약 종료일은 새 계약 시작일보다 앞설 수 없습니다.' // 같은 날은 됨 (v0.38)
        // W7-2(2026-11-16): 지금 계약 기간과 같은 달 수만(화면은 종료일을 정해 주지만 두 겹으로 막음. 서버도 다시 셈)
        : keepMonths && start && end !== keepEnd(start) ? '그대로 연장은 지금 계약 기간과 같은 ' + keepMonths + '개월만 됩니다(종료일 ' + C.fmtDate(keepEnd(start)) + '). 기간을 바꾸려면 "조건을 바꿔 연장"을 고릅니다.' : '',
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
      '<div><dt>새 계약 기간</dt><dd>' + C.fmtPeriod(start, end) + '</dd></div>' +
      // (2026-11-14 주말 점검 W7, abc-07) 거래처 확인 경고가 있으면 기안 전에 한 번 더 보임(계약 등록의 확인 창과 같음, 막지 않음)
      (custCheck ? '<div><dt>거래처 확인</dt><dd>' + esc(custCheck) + '</dd></div>' : '') + '</dl>';
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
    // (설계 검토 2026-11-11 남은 것 ②) 금액은 지금 유효한 조건의 금액(keepAmount). 보완 후 재기안도 그때 다시 셈(앞 차수 뒤에 변경 계약이 끝났을 수 있어서)
    //   (2026-11-14 주말 점검 W7, abc-07) 기안할 때 보인 거래처 확인 경고 문장(없으면 ''). 보완 후 재기안은 그때 값으로 바꿔 씀(계약 등록과 같음)
    const fields = { startDate: $('#f-start').value, endDate: $('#f-end').value, reason: $('#f-reason').value.trim(), amount: keepAmount, customerCheckWarn: custCheck };
    // 설계 검토 2026-11-11 3장 [가정]: 기안한 날 가격 기준으로 새 계약 기간의 표준 금액을 남김(stdAmount, 견줄 수 없으면 null)
    //   뒤에 가격 기준이 바뀌어도 할인 예외 점검(SCR-61)의 참고 줄은 이 값으로 견줌(유상 충전의 changeListPrice와 같은 방식). 다시 기안하면 그때 다시 셈
    const sx = C.renewStd(b.id, { day: D.TODAY, before: C.nowStamp(), start: fields.startDate, end: fields.endDate, skip: newId });
    fields.stdAmount = sx.std != null ? sx.std : null;
    const rec = again ? C.resubmitRecord(again, fields) : Object.assign({
      id: newId, parentId: b.id, counterparty: root.counterparty, services: root.services, type: root.type,
      kind: 'RENEW', renewMode: 'AUTO', requesterId: C.repActorOf(b), requestedAt: C.nowStamp().slice(0, 16), // 지금 영업대표(2026-11-03 C-44). 금액은 아래 fields.amount
      restricted: root.restricted, personalData: root.personalData, status: 'IN_REVIEW', round: 1, history: [],
      autoRenew: 'YES', noticeDays: b.noticeDays,
    }, fields);
    C.saveDemoContract(rec);
    C.flash(newId + ' 연장 검토(조건 그대로)를 ' + (rec.round || 1) + '차로 기안했습니다. 다음 차례: ③ 영업 검토 (' + C.ownerLabel(C.stepUserNow('S03', rec)) + ')');
    location.href = 'review.html?id=' + encodeURIComponent(newId);
  });
  document.addEventListener('keydown', function (e) { if (!modal.hidden && e.key === 'Escape') closeModal(); });
})();
