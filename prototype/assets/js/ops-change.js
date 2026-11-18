/* =====================================================================
 * SCR-14 운영 변경 기안 화면 로직 (ops-change.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-CHG-06~11 (기획자 결정 v0.26: 재무 문서의 계약 체결 이후 수정 절차 반영)
 * 하는 일
 *   1. 주소의 원계약 번호로 묶음을 찾고 운영 변경을 기안할 수 있는지 확인
 *      (지금 유효한 계약이 계약 완료, 영업대표 본인(시연용 최고관리자 포함), 진행 중인 해지 없음)
 *   2. 변경 종류 하나: 계약 기간 변경(새 종료일), 추가 충전(수량, 유상이면 금액). 서비스에 있는 것만 고를 수 있음
 *      계약 기간 변경은 지금 종료일에서 앞뒤 2개월(CHANGE_RULES.periodMonths)까지만, 계약서의 종료일에서도 2개월까지만([가정] 앞선 운영 변경을 더해 셈) 받음.
 *      더 늘리면 연장, 더 줄이면 변경 계약으로 보냄 (설계 검토 2026-11-11 8번, 8-1. 변경 계약 링크는 변경 종류 "줄임"을 미리 고름, 같은 날 남은 것 ⑦)
 *      (2026-11-14 주말 점검, 코드 다시 보기 amend-02, amend-04) 기간을 줄이는 변경 계약이 진행 중이면 기간 변경을 고르지 못함(periodBusy).
 *      계약서의 종료일은 계약 완료된 변경 계약이 바꾼 종료일도 봄(PERIOD_BASE, common.js termsEnd와 같은 규칙)
 *   3. 변경 사유(필수), CRM 영업활동 링크(필수, https)
 *   4. 결재선 미리 보기: ③ 영업 검토(무상 충전 계약 연도 누적 50건 초과일 때만. 기간 변경은 ③ 없음, 설계 검토 2026-11-11 8번) → ⑨ 운영 변경(고객지원, HR 충전은 재무)
 *      → ⑩ 재무 확인(기획자 결정 2026-11-02 B-3, 추천과 다름: 운영 변경 모두)
 *      기획자 결정 2026-11-03 C-18 ⑤: HR 충전의 ⑩도 재무 담당자, ⑨를 한 사람이 아닌 다른 재무 담당자(예전에는 재무 리더)
 *      기획자 결정 2026-11-03 C-44: 영업대표 본인은 지금 영업대표(C.isSalesRep: 바뀐 새 영업대표, 맡을 수 없으면 대신 맡는 영업 리더). 새 기록의 기안자도 그 사람
 *      무상 충전은 이번 계약 연도에 이미 받은 수량과 이번까지의 누적을 보임(B-4, C.freeChargeUsed)
 *      유상 충전은 기능을 고르고 그날 가격 기준의 표준 단가 x 수량과 할인율을 보임(B-3 덧붙임, 막지 않음)
 *   5. 기안하면 -C01 번호로 원계약에 묶어 저장(프로토타입은 이 브라우저에만)하고 결재 문서로 이동
 *   6. 보완 후 재기안(v0.58 기획자 결정): ops-change.html?id=반려된 운영 변경 번호로 열면 앞 차수 값을 채우고 같은 번호의 다음 차수로 기안
 *   7. 기획자 결정 2026-11-02 C-16: 거래처나 묶음에 보류가 걸려 있으면(C.holdOf) "보류 중" 배지와 사유를 보이고 기안하지 않음(재기안 포함)
 *   8. (2026-11-14 주말 점검 W7, abc-07) 거래처 확인 경고(C.customerCheckNote, 계약 등록과 같은 문장, 막지 않음)를 1번 묶음에 보이고,
 *      유상 충전과 기간 늘림을 기안하면 그 기록의 customerCheckWarn으로 남김(결재 문서가 "기안 때 거래처 확인 경고"로 보임)
 *      [가정] 무상 충전과 기간 줄임은 새로 돈이 오가거나 거래를 더 잇는 일이 아니라 기록에 남기지 않음(경고는 화면을 열 때 보이므로 같이 보임)
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const notice = function (title, body) { return C.noticeBox('', title, body); };

  // 보완 후 재기안: 반려된 운영 변경을 같은 번호의 다음 차수로 (ops-change.html?id=2601CL001-C01)
  const params = new URLSearchParams(location.search);
  const again = C.resubmitSource(params.get('id'), me, function (c) { return c.kind === 'CHANGE'; });
  const origin = again ? again.parentId : params.get('origin');
  const found = D.CONTRACTS.find(function (c) { return c.id === origin; });
  const b = found ? C.bundleOf(C.rootOf(found)) : null;
  const back = b ? 'contract.html?id=' + encodeURIComponent(b.id) : 'contracts.html';
  // 2026-11-06 점검: ?id=의 기록이 있고 볼 수 있는데 지금 다시 기안할 수 없으면 "찾을 수 없습니다" 대신 그 까닭과 결재 문서로 가는 길을 알림
  //   "찾을 수 없습니다"는 없는 번호(또는 볼 수 없는 기록)일 때만. 해지, 연장 검토와 같은 말
  const idRec = params.get('id') && !again ? D.CONTRACTS.find(function (c) { return c.id === params.get('id'); }) : null;
  if (idRec && C.canView(idRec, me)) {
    $('#notice').innerHTML = notice('보완 후 재기안할 수 없는 기안입니다', '이 기안은 지금 보완 후 재기안할 수 없습니다(이미 다시 기안했거나 지금 영업대표가 아님). ' +
      '<a class="doc-link" href="review.html?id=' + encodeURIComponent(idRec.id) + '">결재 문서 보기</a>');
    return;
  }
  if (!b || !C.canView(b.root, me)) {
    $('#notice').innerHTML = notice('변경할 계약을 찾을 수 없습니다', '계약 상세에서 "운영 변경 기안"을 눌러 들어와 주세요.');
    return;
  }
  const root = b.root;
  // 설계 검토 2026-11-11 5번: 예전 계약 기록(LG-번호)도 원계약으로 받음. 다만 바로잡힌 기록은 쓰지 않고 바로잡은 새 기록에서 기안 [가정]
  if (C.legacyReplacedBy(root)) {
    $('#notice').innerHTML = notice('바로잡힌 예전 계약 기록입니다', '이 기록은 바로잡혀 새 기록(' + esc(C.legacyReplacedBy(root).id) + ')이 있습니다. <a href="contract.html?id=' +
      encodeURIComponent(C.legacyReplacedBy(root).id) + '">새 기록의 계약 상세로</a>');
    return;
  }
  // 기획자 결정 2026-11-02 C-16: 거래처나 묶음에 보류가 걸려 있으면 운영 변경을 기안하지 않음(보완 후 재기안 ?id도). 다른 까닭보다 먼저(연장 검토, 해지와 같게)
  const hold = C.holdOf(b);
  if (hold) {
    $('#notice').innerHTML = notice('보류 중이라 운영 변경을 기안할 수 없습니다', C.holdBadge(hold) + ' ' + esc(C.holdText(hold, me)) +
      '<br>보류가 풀릴 때까지 운영 변경을 기안할 수 없습니다. <a href="' + back + '">계약 상세로</a>');
    return;
  }
  if (b.status !== 'ACTIVE') {
    $('#notice').innerHTML = notice('운영 변경을 기안할 수 없는 계약입니다', '지금 유효한 계약이 계약 완료일 때만 기안합니다. 지금 상태: ' + esc(D.STATUS[b.status].label) + '. <a href="' + back + '">계약 상세로</a>');
    return;
  }
  // 기획자 결정 2026-11-03(C-44): 지금 영업대표(바뀐 새 영업대표, 맡을 수 없으면 대신 맡는 영업 리더, C.isSalesRep). 계약 상세의 단추와 같은 규칙
  //   처음 기안한 사람이라도 영업대표가 바뀌었으면 기안하지 않음
  if (!C.isSalesRep(b, me) && me.role !== 'SUPER') {
    $('#notice').innerHTML = notice('영업대표만 운영 변경을 기안합니다', '이 계약의 영업대표는 ' + esc(C.ownerLabel(C.salesRepOf(b))) + '입니다.' +
      (C.repNeeded(b) ? ' ' + esc(C.repCoverText(b)) : '') + ' <a href="' + back + '">계약 상세로</a>');
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
  //   (2026-11-14 주말 점검, 코드 다시 보기 amend-02) 기간을 줄이는 변경 계약(종료일이 기안 때 지금 종료일보다 앞, C.amendShortens)도 기간 변경으로 보고 막음(CTL-66):
  //     그 변경이 이 기간 변경보다 늦게 끝나면 늘린 기간을 잘라 버림. 기간을 바꾸지 않은 변경(추가, 줄임, 조항만)은 막지 않음(계약 완료되어도 종료일을 바꾸지 않음, common.js termsEnd)
  const periodBusy = b.open.some(function (o) { return o.kind === 'RENEW' || (o.kind === 'CHANGE' && o.changeType === 'PERIOD') || C.amendShortens(o, b.end); });

  // 반려된 운영 변경이 있으면 새 번호 대신 그 기안을 보완해 같은 번호로 다시 기안 (v0.58 기획자 결정)
  const waiting = again ? [] : b.rejected.filter(function (o) { return o.kind === 'CHANGE'; });
  if (waiting.length) {
    $('#notice').innerHTML = C.noticeBox('', '반려된 운영 변경이 있습니다', waiting.map(function (o) {
      return '<a href="review.html?id=' + encodeURIComponent(o.id) + '">' + esc(o.id) + '</a> ' + esc(C.kindLabel(o)) + ' ' + (o.round || 1) + '차 반려';
    }).join('<br>') + '<br>새로 기안하지 않고 반려된 기안을 보완해 같은 번호의 다음 차수로 다시 기안합니다.',
      '<a class="btn btn--primary btn--md" href="' + C.resubmitHref(waiting[0]) + '">보완 후 재기안</a><a class="btn btn--tertiary btn--md" href="' + back + '">계약 상세로</a>');
    return;
  }

  /* ---------- 1. 변경할 계약 ---------- */
  const newId = again ? again.id : C.nextChildId(b.id, 'CHANGE');
  if (again) {
    document.querySelector('.page-title').textContent = '운영 변경 보완 후 재기안';
    $('#notice').innerHTML = C.rejectionNotice(again);
  }
  function info(label, value) { return '<div><dt>' + esc(label) + '</dt><dd>' + value + '</dd></div>'; }
  $('#origin').innerHTML = [
    info('고객사', esc(root.counterparty)),
    info('계약번호', '<a href="' + back + '">' + esc(b.id) + '</a>' + (b.current !== root ? ' (지금 유효: ' + esc(b.current.id) + ')' : '')),
    info('서비스', esc(C.serviceLabel(root.services))),
    info('계약 기간', C.fmtPeriod(b.start, b.end)),
    // 기획자 결정 2026-11-03(C-44): 지금 영업대표. 바뀌었으면 처음 기안한 사람, 맡을 수 없으면 "담당 지정 필요"(계약 상세와 같음)
    // "담당 지정 필요"는 계약 상세, 결재 화면처럼 주의 배지로 보임(회색 글자였음) (2026-11-06 점검)
    info('영업대표', esc(C.ownerLabel(C.salesRepOf(b))) +
      (C.salesRepOf(b) !== root.requesterId ? '<span class="cell-meta">처음 기안 ' + esc(C.ownerLabel(root.requesterId)) + '</span>' : '') +
      (C.repNote(b) ? '<span class="cell-meta">' + C.badge('attention', C.repNote(b)) + '</span>' : '')),
    info('진행 중인 일', b.open.length ? b.open.map(function (o) { return esc(o.id + ' ' + C.kindLabel(o)); }).join('<br>') : '없음'),
  ].join('');
  /* (2026-11-14 주말 점검 W7, abc-07) 거래처 확인 경고: 계약 등록(C-13)과 같은 문장(C.customerCheckNote), 막지 않음
   *   국가와 지자체(가운데 83), 조달, 간접 거래처인데 확인 전이거나 다음 확인일이 지났거나 문제 있음이면. 예전 계약 기록의 거래처도 같음
   *   거래처는 원계약의 거래처, 계약 방식은 지금 유효한 조건의 바탕(원계약이나 조건을 바꾼 연장)의 방식
   *   화면을 열 때 정해지는 한 줄이라(변경 종류를 고른 뒤 생기는 줄이 아님) 고를 때 아래가 밀리지 않음 */
  const ckTerms = C.currentTerms(b.id);
  const ckCu = C.customerOfContract(root);
  const ckBiz = ckCu ? ckCu.bizNo : ((root.form || {}).bizNo || root.bizNo || '');
  const custCheck = ckBiz ? C.customerCheckNote(ckBiz, C.methodOf((ckTerms && ckTerms.lineBase) || root)) || '' : '';
  $('#customer-check').innerHTML = custCheck ? C.icon('alert', 'sm') + esc(custCheck) : '';
  $('#customer-check').hidden = !custCheck;
  // 기록에 남기는 운영 변경: 유상 충전과 기간 늘림(새 종료일이 지금 종료일보다 뒤) [가정, 위 머리 주석 8]
  function keepsCheck(t, end) { return /_PAID$/.test(t) || (t === 'PERIOD' && !!end && end > b.end); }
  $('#number-help').textContent = again ? '같은 번호 ' + newId + '의 ' + ((again.round || 1) + 1) + '차로 기안합니다.' : '기안하면 ' + newId + '(운영 변경)로 원계약과 함께 묶입니다.';
  $('#btn-cancel').href = back;

  /* ---------- 2. 변경 종류: 계약의 서비스에 있는 것만 ---------- */
  const R = D.CHANGE_RULES;
  /* 운영 변경으로 받는 계약 기간 변경의 한도 (설계 검토 2026-11-11 8번, 4-1 8-1)
   *   지금 종료일에서 앞뒤 R.periodMonths(2)개월까지만. 개월은 REQ-CHG-07의 세는 법 그대로(C.monthsLater: 말일로 끝나면 말일 기준, 6월 30일 + 2개월 = 8월 31일)
   *   더 늘리려면 연장(자동갱신이면 연장 검토, 아니면 계약 등록의 연장 기안), 더 줄이려면 변경 계약(변경 기안)으로. 계약 상세의 단추와 같은 주소
   *   예전 규칙 "기간이 2개월 넘게 바뀌면 ③ 영업 검토"는 없앰. 기간 변경은 ③ 없이 ⑨ 운영 변경, ⑩ 재무 확인
   *   [가정] 계약서의 종료일(이 계약 기간(원계약이나 마지막 연장)의 첫 기간 변경 전 종료일)에서도 앞뒤 2개월까지만. 곧 이 계약 기간에 운영 변경으로 바꾼 것을 모두 더해 2개월
   *     2개월씩 여러 번 나눠 늘려 연장을 피하지 못하게(무상 충전을 계약 연도 누적으로 세는 B-4와 같은 생각). 앞선 기간 변경이 없으면 두 기준이 같음
   *     한 번에 2개월도 함께 지키므로 새 기안이 common.js changeSales의 "2개월 넘게 바뀜"(예전 기록만)에 걸리지 않음
   *   [가정] 날짜 칸에 max를 두지 않음: 달력이 더 긴 날을 막아 버리면 까닭과 갈 길을 볼 수 없어서, 고른 뒤 아래 회색 상자와 오류로 알림 */
  // 이 계약 기간에 계약 완료된 기간 변경(C.bundleOf의 periodDone과 같은 고르기). 가장 앞의 것이 바꾸기 전 종료일이 계약서의 종료일
  /* (2026-11-14 주말 점검, 코드 다시 보기 amend-04) 계약 완료된 변경 계약(AMEND)도 차례대로 봄(bundleOf의 termsEnd와 같은 규칙 C.termsEnd):
   *   종료일을 바꾼(줄인) 변경 계약이 있으면 그 가운데 마지막 것도 "계약서"라, 그 뒤에 기안한 기간 변경만 세고, 계약서의 종료일은
   *   그 뒤 기간 변경이 있으면 첫 건의 바꾸기 전 종료일, 없으면 그 변경 계약의 종료일 [가정]. 기간 변경이 없을 때 예전에 쓰던 값(b.end)과 같음
   *   예전에는 첫 기간 변경 전 종료일만 봐서, 뒤에 변경 계약이 종료일을 앞당기면 옛 날짜가 남아 고를 수 있는 범위가 지금 종료일보다 뒤로 밀리고
   *   기간을 늘리는 것도 "줄입니다" 오류로 막혔음(2609CL007: 기간 변경 C09로 2027-11-30, 뒤 변경 A09로 2027-06-30) */
  const periodAll = b.items.filter(function (c) {
    return ((c.kind === 'CHANGE' && c.changeType === 'PERIOD') || c.kind === 'AMEND') && c.status === 'ACTIVE' &&
      (c.requestedAt || '') > (b.current === root ? '' : b.current.requestedAt || '');
  });
  let lastAmend = null;
  periodAll.reduce(function (e, c) { const n = C.termsEnd([c], e); if (c.kind === 'AMEND' && n !== e) lastAmend = c; return n; }, C.endOf(b.current));
  const periodDone = periodAll.filter(function (c) {
    return c.kind === 'CHANGE' && (!lastAmend || (c.requestedAt || '') > (lastAmend.requestedAt || ''));
  });
  const PERIOD_BASE = (periodDone[0] && periodDone[0].oldEndDate) || (lastAmend ? C.endOf(lastAmend) : '') || b.end;
  const later = function (d, n) { return d ? C.monthsLater(d, n) : ''; };
  const maxDate = function (x, y) { return !x ? y : !y ? x : x > y ? x : y; };
  const minDate = function (x, y) { return !x ? y : !y ? x : x < y ? x : y; };
  // 가장 늦은 새 종료일: 지금 종료일 + 2개월과 계약서의 종료일 + 2개월 중 이른 날 / 가장 이른 새 종료일: 둘의 - 2개월 중 늦은 날(화면에는 오늘과도 견줌)
  const PERIOD_MAX = minDate(later(b.end, R.periodMonths), later(PERIOD_BASE, R.periodMonths));
  const PERIOD_MIN = maxDate(later(b.end, -R.periodMonths), later(PERIOD_BASE, -R.periodMonths));
  const qOrigin = encodeURIComponent(b.id);
  const RENEW_LINK = b.autoRenew === 'YES'
    ? '<a href="renewal.html?origin=' + qOrigin + '">연장 검토로 가기</a>'
    : '<a href="new-contract.html?kind=RENEW&amp;origin=' + qOrigin + '">연장 기안으로 가기</a>';
  // (설계 검토 2026-11-11 남은 것 ⑦) 더 줄이려면 변경 계약: 변경 종류를 "줄임"으로 미리 고름(&amend=REDUCE, new-contract.js가 받음) [가정]
  //   기간을 2개월 넘게 늘리면 연장(위 RENEW_LINK), 줄이면 변경(줄임). 줄어드는 금액이 없으면(기간만 줄임) 계약 등록에서 "조항만"으로 바꿔 고름
  const AMEND_LINK = '<a href="new-contract.html?kind=AMEND&amp;origin=' + qOrigin + '&amp;amend=REDUCE">변경(줄임) 기안으로 가기</a>';
  // 새 종료일이 한도 안인지: '' 고르기 전, 'same' 지금과 같음, 'past' 오늘 전, 'over' 가장 늦은 새 종료일보다 늦음, 'under' 가장 이른 새 종료일보다 이름, 'ok' 받음 (입력 검사와 같은 순서)
  function periodState(end) {
    if (!end) return '';
    if (end === b.end) return 'same';
    if (end < D.TODAY) return 'past';
    if (PERIOD_MAX && end > PERIOD_MAX) return 'over';
    if (PERIOD_MIN && end < PERIOD_MIN) return 'under';
    return 'ok';
  }
  const types = Object.keys(D.CHANGE_TYPES).filter(function (t) { return t === 'PERIOD' || (root.services || []).indexOf(t.split('_')[0]) > -1; });
  $('#type-choices').innerHTML = types.map(function (t) {
    const off = t === 'PERIOD' && periodBusy;
    return '<label class="choice"><input type="radio" name="type" value="' + t + '"' + (off ? ' disabled' : '') + '>' + esc(D.CHANGE_TYPES[t]) +
      (off ? ' (진행 중인 연장, 기간 변경이나 기간을 줄이는 변경 계약이 있어 지금은 고를 수 없음)' : '') + '</label>'; // (amend-02) 기간을 줄이는 변경 계약도
  }).join('');
  $('#f-end').min = D.TODAY;
  const typeOf = function () { const r = document.querySelector('[name="type"]:checked'); return r ? r.value : ''; };
  // 수량과 금액 칸은 숫자, 쉼표, 띄어쓰기만 받음. 다른 글자가 섞이면 그 글자를 말없이 지우고 셈하던 것을 고쳐 0으로 보고(셈하지 않음) 칸에 오류를 보임 (2026-11-06 점검 3회차)
  const NUM_MSG = '수량과 금액은 숫자로만 넣습니다(쉼표는 괜찮음).';
  const numOk = function (v) { return /^[0-9,\s]*$/.test(String(v || '')); };
  const num = function (v) { if (!numOk(v)) return 0; const n = String(v || '').replace(/[^0-9]/g, ''); return n ? parseInt(n, 10) : 0; };
  const won = C.fmtWon; // 1,600,000원
  const pct = function (r) { return Math.round(r * 1000) / 10 + '%'; };

  /* ---------- 유상 충전의 기능과 표준 금액 (기획자 결정 2026-11-02 B-3 덧붙임, G-10 ②) ----------
   * 기능: 계약의 서비스(CK_PAID는 CK, HR_PAID는 HR)에서 사용 중이고 오늘 가격 기준(D.PRICE_BOOK, 관리자 변경 반영)이 있는 것. 제품마다 묶어 보임
   * 표준 금액 = 그날 표준 단가 x 수량, 할인율 = (표준 금액 - 충전 금액) / 표준 금액. 보여 주기만 하고 기안을 막지 않음(③도 생기지 않음, REQ-CHG-07)
   *   표준 단가가 건 단위일 때만 견줌. 지금 CK 기능의 단가는 "기관, 1년" 단위의 시연 값이라 단가만 보이고 금액은 견주지 않음
   *   (결정 "CK는 C-33 뒤": 카피킬러 실제 가격이 건 단위로 들어오면 따로 고치지 않아도 견줌) [가정]
   * 기안할 때 그날의 표준 단가를 함께 남김: changeFeature, changeListPrice, changePriceUnit, changePriceFrom(가격 기준 적용 시작일) */
  const PRICE = {};
  D.PRICE_BOOK.forEach(function (p) { PRICE[p.feature] = p; });
  function featureOptions(svc) {
    return D.PRODUCTS.filter(function (p) { return p.use && p.service === svc; }).map(function (p) {
      const fs = D.FEATURES.filter(function (f) { return f.use && f.product === p.id && PRICE[f.id]; });
      return fs.length ? '<optgroup label="' + esc(p.name) + '">' + fs.map(function (f) {
        return '<option value="' + esc(f.id) + '">' + esc(C.featureText(f.id)) + '</option>';
      }).join('') + '</optgroup>' : '';
    }).join('');
  }
  let featSvc = '';
  // 유상 충전이면 기능 칸을 보이고, 서비스가 바뀔 때만 목록을 다시 채움(고른 기능은 남김)
  function syncFeature(t) {
    const svc = /_PAID$/.test(t) ? t.split('_')[0] : '';
    $('#feature-field').hidden = !svc;
    if (svc === featSvc) return;
    featSvc = svc;
    const sel = $('#f-feature'), keep = sel.value;
    sel.innerHTML = '<option value="">고르세요</option>' + (svc ? featureOptions(svc) : '');
    if (keep && Array.prototype.some.call(sel.options, function (o) { return o.value === keep; })) sel.value = keep;
  }
  // 표준 금액 비교 { p: 가격 줄, perCase: 건 단위인지, std: 표준 금액, disc: 할인율, s: 공통 셈 결과 }
  //   (root: 원계약. record()보다 먼저 쓰여도 위에서 정해 둔 값)
  //   (설계 검토 2026-11-11 3번, 4-1 3-1) 건당(단위 종류 PER_UNIT)일 때만 견줌. 표준 단가는 원계약 거래처의 고객사 티어 단가가 있으면 그 값(C.stdLine)
  // W7-4(2026-11-16): 간접 계약의 유상 충전 표준 단가는 원계약 그 기능 줄의 사용 업체 티어(거래처 목록에 없으면 기본 단가). 리셀러의 티어는 쓰지 않음
  // (2026-11-16 밤 코드 다시 보기 w7-05) 원계약 줄만이 아니라 지금 조건(C.currentTerms)의 그 기능 줄 몫에서 사용 업체를 찾음(변경으로 더한 기능도).
  //   한 기능에 사용 업체가 여럿이면 수량이 남은 첫 몫의 업체 [가정: 운영 변경 화면에 사용 업체 칸이 없어 고를 수 없음]
  function tierCu(fid) {
    if (C.methodOf(root) !== 'INDIRECT') return C.customerOfContract(root);
    const t = C.currentTerms(root.id);
    const l = t && t.ready ? t.lines.filter(function (x) { return x.feature === fid; })[0] : null;
    const part = l ? l.parts.filter(function (x) { return x.qty > 0 && x.org; })[0] : null;
    if (part) return C.customerByName(part.org);
    const line = (root.products || (root.form && root.form.products) || []).filter(function (x) { return x.feature === fid; })[0] || null;
    return C.tierCustomerFor(root, line);
  }
  function priceCompare(rec) {
    const p = rec.changeFeature ? PRICE[rec.changeFeature] : null;
    const perCase = !!p && C.unitKindOf(p) === 'PER_UNIT';
    const s = p ? C.stdLine({ feature: rec.changeFeature, qty: rec.changeQty || 0 }, { row: p, customer: tierCu(rec.changeFeature), fresh: true }) : null;
    const std = perCase && rec.changeQty ? s.std : null;
    const disc = std && rec.changeAmount ? (std - rec.changeAmount) / std : null;
    return { p: p, perCase: perCase, std: std, disc: disc, s: s };
  }
  function discText(d) {
    return d == null ? '-' : d === 0 ? '0%, 표준 단가 그대로' : d < 0 ? '표준 단가보다 ' + pct(-d) + ' 높음' : pct(d) + ' 할인';
  }
  function kv(rows) {
    return '<dl class="kv">' + rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>';
  }
  function priceBoxHtml(rec) {
    const x = priceCompare(rec), p = x.p;
    const note = !p ? '기능을 고르면 오늘 가격 기준의 표준 단가가 나옵니다.'
      : !x.perCase ? '이 기능의 표준 단가는 건 단위가 아니라(' + p.unit + ') 충전 금액과 견주지 않습니다. 건 단위 단가가 정해지면 보입니다.'
      : '가격 기준 ' + C.fmtDate(p.validFrom) + '부터 적용(' + p.docNo + '). 보여 주기만 하고 기안을 막지 않습니다.';
    return kv([
      // (설계 검토 2026-11-11 4-1 3-1) 티어 단가면 "(건, 티어 1 단가. 기본 …원)"(C.stdPriceText)
      ['표준 단가', p ? C.stdPriceText(x.s, p.unit) : '-'],
      ['표준 금액 (표준 단가 x 수량)', x.std != null ? won(x.std) : '-'],
      ['충전 금액', rec.changeAmount ? won(rec.changeAmount) : '-'],
      ['할인율', discText(x.disc)],
    ]) + '<p class="change-note">' + esc(note) + '</p>';
  }

  /* ---------- 무상 충전의 계약 연도 누적 (기획자 결정 2026-11-02 B-4, G-10, REQ-CHG-07) ----------
   * 같은 묶음, 같은 계약 연도(오늘이 든 해), 같은 종류(CK, HR 따로)의 앞선 무상 충전(반려와 임시 저장은 빼고) + 이번 신청
   * 결재선(C.changeSales)과 같은 수. 누적이 기준(CHANGE_RULES.freeQty)을 넘으면 ③ 영업 검토를 거침 */
  function freeBoxHtml(rec, sales) {
    // 기획자 결정 2026-11-02 B-4: 계약 연도는 오늘이 든 계약 기간(원계약이나 연장)에서 셈. 일찍 승인된 연장의 시작일로 세지 않음(C.contractYearWindow)
    const w = C.contractYearWindow(b, D.TODAY);
    const n = w.n, from = w.from;
    let to = w.to ? C.addDays(w.to, -1) : '';
    // 그 계약 기간이 먼저 끝나면 종료일까지(지금 유효한 계약이면 기간 변경을 반영한 묶음 종료일)
    const term = b.items.find(function (x) { return x.id === w.term; }) || b.current;
    const termEnd = term === b.current ? b.end : C.endOf(term);
    if (termEnd && to > termEnd) to = termEnd;
    const used = C.freeChargeUsed(b.id, D.TODAY, rec.id, rec.changeType), qty = rec.changeQty || 0;
    const svc = rec.changeType.split('_')[0];
    const note = !qty ? '수량을 넣으면 ③ 영업 검토를 거치는지 나옵니다.'
      // 글에 수량을 넣지 않음(위 줄에 있음): 수량을 칠 때마다 글이 바뀌어 화면낭독기가 계속 읽지 않게, 거치는지가 바뀔 때만 읽음
      : sales && sales[0] ? '누적이 ' + R.freeQty + '건을 넘어 ③ 영업 검토를 거칩니다.'
      : '누적이 ' + R.freeQty + '건 이내라 ③ 영업 검토 없이 ⑨ 운영 변경으로 갑니다.';
    return kv([
      ['계약 연도', from ? n + '년 차, ' + C.fmtPeriod(from, to) : '-'],
      ['이번 계약 연도에 이미 받은 ' + svc + ' 무상 충전', used.toLocaleString('ko-KR') + '건'],
      ['이번 신청', qty ? qty.toLocaleString('ko-KR') + '건' : '-'],
      ['이번까지 누적 (기준 ' + R.freeQty + '건)', qty ? (used + qty).toLocaleString('ko-KR') + '건' : '-'],
    ]) + '<p class="change-note" aria-live="polite">' + esc(note) + '</p>';
  }

  /* ---------- 계약 기간 변경의 한도 (설계 검토 2026-11-11 8번, 4-1 8-1) ----------
   * 회색 상자(줄 수 고정): 계약서의 종료일, 지금 종료일, 운영 변경으로 고를 수 있는 가장 이른 새 종료일(2개월 앞, 오늘 이후)과 가장 늦은 새 종료일(2개월 뒤), 새 종료일과 늘림/줄임
   * 아래 안내 줄: 받는지, 넘으면 까닭과 연장이나 변경 계약으로 가는 링크. 자리는 늘 잡아 둠(.change-box .change-note 최소 높이, 휴대폰은 세 줄)
   * 안내 줄은 상태가 바뀔 때만 다시 써서 화면낭독기가 날짜를 고칠 때마다 읽지 않게 함(무상 충전 상자와 같은 생각) */
  let periodNoteKey = null;
  function syncPeriodBox(end) {
    const st = periodState(end);
    const lo = PERIOD_MIN && PERIOD_MIN > D.TODAY ? PERIOD_MIN : D.TODAY;
    // 값 칸을 짧게(날짜 하나씩) 두어 휴대폰에서 항목 이름이 여러 줄로 눌리지 않게 함. 범위를 한 칸("~")에 넣지 않고 가장 이른 날, 가장 늦은 날 두 줄
    $('#period-kv').innerHTML = kv([
      ['계약서의 종료일', PERIOD_BASE ? C.fmtDate(PERIOD_BASE) : '-'],
      ['지금 종료일', C.fmtDate(b.end)],
      ['가장 이른 새 종료일', PERIOD_MAX && lo <= PERIOD_MAX ? C.fmtDate(lo) : '-'],
      ['가장 늦은 새 종료일', PERIOD_MAX ? C.fmtDate(PERIOD_MAX) : '-'],
      ['새 종료일', end ? C.fmtDate(end) + (end > b.end ? ' (늘림)' : end < b.end ? ' (줄임)' : ' (같음)') : '-'],
    ]);
    if (st === periodNoteKey) return;
    periodNoteKey = st;
    const n = R.periodMonths;
    $('#period-note').innerHTML = !st ? '새 종료일을 고르면 운영 변경으로 받는지 나옵니다.'
      : st === 'same' ? '지금 종료일과 같습니다. 바꿀 종료일을 고르세요.'
      : st === 'past' ? '새 종료일은 오늘 이후여야 합니다.'
      // 넘으면 날짜로 알림(한 번에 2개월, 계약서의 종료일에서 2개월 중 어느 쪽에 걸렸든 맞는 말)
      : st === 'over' ? '운영 변경으로는 ' + C.fmtDate(PERIOD_MAX) + '까지만 늘립니다. 더 늘리려면 연장으로 기안합니다. ' + RENEW_LINK
      : st === 'under' ? '운영 변경으로는 ' + C.fmtDate(PERIOD_MIN) + '까지만 줄입니다. 더 줄이려면 변경 계약으로 기안합니다. ' + AMEND_LINK
      : n + '개월 안이라 운영 변경으로 받습니다. ③ 영업 검토 없이 ⑨ 운영 변경으로 갑니다.';
  }

  // 지금 입력으로 만든 운영 변경 기록 (결재선 계산과 저장에 같이 씀)
  function record() {
    const t = typeOf();
    const fid = /_PAID$/.test(t) ? $('#f-feature').value : '', pr = fid ? PRICE[fid] : null;
    // (설계 검토 2026-11-11 4-1 3-1) 남기는 그날 표준 단가는 원계약 거래처의 티어 단가가 있으면 그 값(티어를 썼으면 changePriceTier)
    const ps = pr ? C.stdLine({ feature: fid, qty: 0 }, { row: pr, customer: tierCu(fid), fresh: true }) : null; // W7-4
    return {
      id: newId, parentId: b.id, counterparty: root.counterparty, services: root.services, type: root.type, kind: 'CHANGE',
      changeType: t, changeQty: t && t !== 'PERIOD' ? num($('#f-qty').value) : 0,
      changeAmount: /_PAID$/.test(t) ? num($('#f-amount').value) : 0,
      // B-3 덧붙임: 유상 충전의 기능과 그날 표준 단가(뒤에 가격 기준이 바뀌어도 기안 때 값으로 견줌). 무상, 기간 변경은 비움
      changeFeature: fid || undefined, changeListPrice: ps ? ps.unitPrice : undefined,
      changePriceUnit: pr ? pr.unit : undefined, changePriceFrom: pr ? pr.validFrom : undefined,
      changePriceTier: ps && ps.tier ? ps.tier : undefined, // 설계 검토 2026-11-11 4-1 3-1: 티어 단가를 썼을 때만
      // 기안자는 지금 영업대표(2026-11-03 C-44, repActorOf). ③ 영업 검토도 그 사람 유닛의 리더(리더가 대신 기안하면 영업 임원)
      requesterId: C.repActorOf(b), requestedAt: C.nowStamp().slice(0, 16), restricted: root.restricted, personalData: false,
      status: 'IN_REVIEW', history: [],
      startDate: t === 'PERIOD' ? b.start : undefined, oldEndDate: b.end, endDate: t === 'PERIOD' ? $('#f-end').value : undefined,
      reason: $('#f-reason').value.trim(), activityUrl: $('#f-activity').value.trim(),
      // (2026-11-14 주말 점검 W7, abc-07) 유상 충전과 기간 늘림이면 기안할 때 보인 거래처 확인 경고 문장(없으면 ''). 보완 후 재기안은 그때 값으로 바꿔 씀
      customerCheckWarn: keepsCheck(t, t === 'PERIOD' ? $('#f-end').value : '') ? custCheck : '',
    };
  }

  /* ---------- 4. 결재선 미리 보기 ---------- */
  function refresh() {
    const t = typeOf();
    syncFeature(t); // record()가 기능 칸 값을 읽으므로 먼저
    const rec = record();
    const free = /_FREE$/.test(t), paid = /_PAID$/.test(t);
    $('#period-box').hidden = t !== 'PERIOD';
    $('#qty-box').hidden = !t || t === 'PERIOD';
    $('#amount-field').hidden = !paid;
    $('#qty-help').textContent = free ? '같은 계약 연도의 무상 충전을 더해 ' + R.freeQty + '건을 넘으면 ③ 영업 검토를 거칩니다.' : '유상 충전은 영업 검토 없이 ⑨ 운영 변경, ⑩ 재무 확인을 거칩니다.';
    const end = $('#f-end').value;
    // 설계 검토 2026-11-11 8번: 도움말은 한도만(고정 글), 지금 종료일과 새 종료일, 받는지는 아래 회색 상자(syncPeriodBox)
    //   예전 "n개월 넘게 바뀌면 ③ 영업 검토를 거칩니다"를 없앰
    $('#period-help').textContent = '운영 변경으로는 ' + R.periodMonths + '개월까지만 늘리거나 줄입니다. 앞서 운영 변경으로 바꾼 것도 더해 계약서의 종료일에서 ' +
      R.periodMonths + '개월을 넘지 않아야 합니다(말일로 끝나면 말일 기준).';
    if (t === 'PERIOD') syncPeriodBox(end);
    // 기간 변경의 ③은 날짜와 상관없이 없음(설계 검토 2026-11-11 8번). 그래서 종류만 고르면 결재선이 정해짐. 한도를 넘는 날짜는 위 상자와 입력 검사가 막음
    const sales = !t ? null : t === 'PERIOD' ? C.changeSales({ changeType: 'PERIOD' }) : C.changeSales(rec);
    // B-4: 무상 충전의 계약 연도 누적, B-3 덧붙임: 유상 충전의 표준 금액과 할인율 (회색 상자, 종류에 맞는 하나만)
    $('#free-used').hidden = !free;
    if (free) $('#free-used').innerHTML = freeBoxHtml(rec, rec.changeQty ? sales : null);
    $('#price-compare').hidden = !paid;
    if (paid) $('#price-compare').innerHTML = priceBoxHtml(rec);
    const hr = /^HR_/.test(t);
    // 맡는 사람 이름은 결재 문서와 같은 규칙(C.stepWho, 기획자 결정 2026-11-02 D-3): 리더 본인 계약의 ③은 "영업 임원", HR 충전의 ⑨는 "재무"
    //   기획자 결정 2026-11-03 C-18 ⑤: HR 충전의 ⑩도 재무 담당자, ⑨를 한 사람이 아닌 다른 재무 담당자("⑩ 재무")
    const who = function (code) { return C.stepWho(code, rec) + ' ' + C.ownerLabel(C.stepUserNow(code, rec)); };
    const items = [
      { no: '③', name: '영업 검토', who: who('S03'),
        state: !sales ? 'wait' : sales[0] ? 'go' : 'skip', reason: sales ? sales[1] : '변경 종류와 내용을 기다림' },
      { no: '⑨', name: '운영 변경', who: who('S09'),
        state: t ? 'go' : 'wait', reason: hr ? '수불부에 HR 추가 충전 반영' : t === 'PERIOD' ? '라이선스나 도메인 기간 변경' : t ? 'CK 추가 충전 반영' : '변경 종류를 기다림' },
      // 기획자 결정 2026-11-02 B-3(추천과 다름): 운영 변경도 ⑩ 재무 확인까지 끝나야 계약 완료(REQ-CHG-10)
      //   기획자 결정 2026-11-03 C-18 ⑤: HR 충전의 ⑩도 재무 담당자, ⑨를 한 사람이 아닌 다른 재무 담당자(예전 "재무 리더" 글을 고침)
      { no: '⑩', name: '재무 확인', who: who('S10'), state: t ? 'go' : 'wait',
        reason: !t ? '변경 종류를 기다림' : (t === 'PERIOD' ? '바뀐 계약 기간의 매출 인식 확인' : paid ? '유상 충전 금액의 매출 확인' : '무상 제공 수량의 회계 영향 확인') +
          (hr ? ', ⑨를 하지 않은 다른 재무 담당자가 확인' : '') },
    ];
    const BADGE = { go: ['progress', '거침'], skip: ['neutral', '생략'], wait: ['line', '답 대기'] };
    $('#route').innerHTML = '<ol class="route-list">' + items.map(function (it) {
      return '<li class="is-' + it.state + '"><span class="route-no" aria-hidden="true">' + it.no + '</span>' +
        '<span><span class="route-name">' + esc(it.name) + '</span><span class="route-who">' + esc(it.who) + '</span>' +
        '<span class="route-reason">' + esc(it.reason) + '</span></span>' + C.badge(BADGE[it.state][0], BADGE[it.state][1]) + '</li>';
    }).join('') + '</ol>';
    // B-3: 예전 "재무 확인 없이"를 고침. 운영 변경도 ⑨ 다음 ⑩ 재무 확인까지 거쳐야 끝남
    // 설계 검토 2026-11-11 8번: ③은 무상 충전 누적이 넘을 때만. 기간 변경은 2개월까지만 받고 ③ 없음(예전 "기간이 2개월 넘게 바뀌거나"를 없앰)
    $('#route-desc').textContent = '운영 변경은 체크리스트, 법무, 날인, 체결본 확인 없이 진행하고, ⑨ 운영 변경 다음 ⑩ 재무 확인까지 끝나면 계약 완료가 됩니다. ' +
      '무상 충전이 계약 연도 누적 ' + R.freeQty + '건을 넘을 때만 ③ 영업 리더가 승인합니다. 계약 기간은 ' + R.periodMonths + '개월까지만 바꾸고 ③ 영업 검토가 없습니다.';
  }
  // 고치는 칸의 오류는 그 칸을 고치는 대로 지움. 다음 기안 때까지 남아 있던 것 (2026-11-06 점검 3회차, 계약 등록의 clearError, C.formModal과 같음)
  //   수량, 금액 칸은 숫자가 아닌 글자가 섞이면 바로 그 칸에 오류를 보이고, 고치면 지움
  function onEdit(e) {
    const box = e.target.closest('[data-field]');
    if (e.target.id === 'f-qty' || e.target.id === 'f-amount') {
      if (!numOk(e.target.value)) { C.setFieldError(box, NUM_MSG); return; }
    }
    if (box && box.classList.contains('is-invalid')) C.setFieldError(box, '');
  }
  $('#form').addEventListener('input', onEdit);
  $('#form').addEventListener('change', onEdit);
  $('#form').addEventListener('input', refresh);
  $('#form').addEventListener('change', refresh);
  // 보완 후 재기안: 앞 차수 값을 채움
  if (again) {
    const tr = document.querySelector('[name="type"][value="' + again.changeType + '"]');
    if (tr && !tr.disabled) tr.checked = true;
    syncFeature(typeOf()); // B-3 덧붙임: 기능 목록을 먼저 채우고 앞 차수의 기능을 고름(지금 쓰지 않는 기능이면 다시 고름)
    if (again.changeFeature) $('#f-feature').value = again.changeFeature;
    $('#f-end').value = again.changeType === 'PERIOD' ? again.endDate || '' : '';
    $('#f-qty').value = again.changeQty ? again.changeQty.toLocaleString('ko-KR') : '';
    $('#f-amount').value = again.changeAmount ? again.changeAmount.toLocaleString('ko-KR') : '';
    $('#f-reason').value = again.reason || '';
    $('#f-activity').value = again.activityUrl || '';
  }
  refresh();
  $('#form').hidden = false;

  /* ---------- 입력 검사 (KRDS 오류 패턴) ---------- */
  // 오류 표시와 aria-invalid는 공통 함수로 (KRDS, v0.28)
  function setError(name, msg) { C.setFieldError(document.querySelector('[data-field="' + name + '"]'), msg); }
  function validate() {
    const t = typeOf(), end = $('#f-end').value;
    const msgs = [
      ['type', t ? '' : '변경 종류를 고르세요.', document.querySelector('[name="type"]')],
      // 없는 날짜(2월 30일 등)를 적었으면 "없는 날짜입니다"를 보임. "…을 고르세요"로 덮어 적던 것 (2026-11-06 점검 3회차, C.dateFieldError)
      // 설계 검토 2026-11-11 8번(8-1): 2개월 넘게 늘리거나 줄이면 막고 갈 길을 알림(링크는 위 회색 상자의 안내 줄)
      ['end', t !== 'PERIOD' ? '' : !end ? C.dateFieldError($('#f-end'), '새 계약 종료일을 고르세요.') : end === b.end ? '지금 종료일과 같습니다.' : end < D.TODAY ? '새 종료일은 오늘 이후여야 합니다.'
        : periodState(end) === 'over' ? '운영 변경으로는 ' + C.fmtDate(PERIOD_MAX) + '까지만 늘립니다. 더 늘리려면 연장으로 기안하세요.'
        : periodState(end) === 'under' ? '운영 변경으로는 ' + C.fmtDate(PERIOD_MIN) + '까지만 줄입니다. 더 줄이려면 변경 계약으로 기안하세요.' : '', $('#f-end')],
      // B-3 덧붙임: 유상 충전은 기능을 꼭 고름(표준 금액 비교는 막지 않음)
      ['feature', !/_PAID$/.test(t) || $('#f-feature').value ? '' : '충전할 기능을 고르세요.', $('#f-feature')],
      // 숫자가 아닌 글자가 섞이면 "숫자로만 넣습니다"를 먼저 보임 (2026-11-06 점검 3회차)
      ['qty', !t || t === 'PERIOD' ? '' : !numOk($('#f-qty').value) ? NUM_MSG : num($('#f-qty').value) > 0 ? '' : '충전 수량을 1건 이상 넣으세요.', $('#f-qty')],
      ['amount', !/_PAID$/.test(t) ? '' : !numOk($('#f-amount').value) ? NUM_MSG : num($('#f-amount').value) > 0 ? '' : '유상 충전 금액을 넣으세요.', $('#f-amount')],
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
  let lastFocus = null;
  $('#form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) return;
    const rec = record(), sales = C.changeSales(rec);
    const row = function (k, v, cls) { return '<div><dt>' + esc(k) + '</dt><dd' + (cls ? ' class="' + cls + '"' : '') + '>' + esc(v) + '</dd></div>'; };
    // 변경 내용: 수량과 금액을 한 줄에 섞지 않고 수량 줄과 금액 줄로 나눔. 금액은 표 밖에서도 오른쪽 정렬(dd.amount, new-contract.css) (2026-11-06 점검)
    const what = rec.changeType === 'PERIOD' ? row('변경 내용', C.fmtDate(b.end) + ' 종료 → ' + C.fmtDate(rec.endDate) + ' 종료')
      : row('변경 수량', rec.changeQty.toLocaleString('ko-KR') + '건') +
        row('변경 금액', rec.changeAmount ? rec.changeAmount.toLocaleString('ko-KR') + '원 (부가세 별도)' : '무상', 'amount');
    // B-4: 무상 충전은 이번 계약 연도 누적, B-3 덧붙임: 유상 충전은 기능과 표준 금액 대비
    let extra = '';
    if (/_FREE$/.test(rec.changeType)) {
      const used = C.freeChargeUsed(b.id, D.TODAY, rec.id, rec.changeType);
      extra = row('이번 계약 연도 누적', (used + rec.changeQty).toLocaleString('ko-KR') + '건 (기준 ' + R.freeQty + '건' + (sales[0] ? ' 넘음, ③ 영업 검토)' : ' 이내)'));
    } else if (/_PAID$/.test(rec.changeType)) {
      const x = priceCompare(rec);
      extra = row('기능', C.featureLabel({ product: (D.FEATURES.filter(function (f) { return f.id === rec.changeFeature; })[0] || {}).product, feature: rec.changeFeature })) +
        row('표준 금액 대비', x.std != null ? won(x.std) + ' 기준 ' + discText(x.disc) : '견주지 않음 (건 단위 표준 단가 없음)');
    }
    $('#confirm-body').innerHTML = '<p>기안하면 ' + (sales[0] ? '③ 영업 검토부터' : '⑨ 운영 변경부터') + ' 시작되고, ⑩ 재무 확인까지 끝나면 계약 완료가 됩니다. 결재가 끝날 때까지 고칠 수 없습니다.</p>' +
      '<dl class="confirm-list">' + row('계약', root.counterparty + ' ' + b.id) + row('운영 변경 번호', newId) +
      row('변경 종류', D.CHANGE_TYPES[rec.changeType]) + what + extra +
      // (2026-11-14 주말 점검 W7, abc-07) 기록에 남기는 거래처 확인 경고가 있으면 기안 전에 한 번 더 보임(계약 등록의 확인 창과 같음, 막지 않음)
      (rec.customerCheckWarn ? row('거래처 확인', rec.customerCheckWarn) : '') + '</dl>';
    lastFocus = document.activeElement;
    modal.hidden = false;
    C.focusModal(modal); // 제목에 포커스 (KRDS 모달, v0.28)
  });
  // 닫기, 바깥 누름, Esc 모두 창을 닫고 열기 전 자리(기안 단추)로 포커스를 돌려줌. 계약 등록, 결재 화면과 같음 (2026-11-06 점검)
  function closeModal() { modal.hidden = true; if (lastFocus) lastFocus.focus(); }
  modal.addEventListener('click', function (e) {
    if (e.target === modal || e.target.closest('[data-act="close"]')) closeModal();
    if (!e.target.closest('[data-act="confirm"]')) return;
    // 운영 변경 기록 (데이터 정의서 contract: kind CHANGE, change_type, change_qty, change_amount, activity_url)
    const rec = again ? C.resubmitRecord(again, record()) : Object.assign(record(), { round: 1 });
    C.saveDemoContract(rec);
    const next = C.pendingSteps(rec).map(function (x) { return C.stepLabel(x.step, rec) + ' (' + C.ownerLabel(x.userId) + ')'; }).join(', ');
    C.flash(newId + ' 운영 변경을 ' + (rec.round || 1) + '차로 기안했습니다. 다음 차례: ' + next);
    location.href = 'review.html?id=' + encodeURIComponent(newId);
  });
  document.addEventListener('keydown', function (e) { if (!modal.hidden && e.key === 'Escape') closeModal(); });
})();
