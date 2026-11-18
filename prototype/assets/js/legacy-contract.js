/* =====================================================================
 * SCR-95 예전 계약 기록 화면 로직 (legacy-contract.js) (설계 검토 2026-11-11 5번, 4-1 5-3)
 * ---------------------------------------------------------------------
 * 관련: 설계 검토 2026-11-11 5번(REQ-FLOW-02 "기존 계약은 옮기지 않음"을 일부 바꿈), 4-1 5-3(체결본이 없으면 까닭), docs/06 R-08
 * 하는 일
 *   1. 올리기(주소에 id가 없을 때): 영업지원(담당자, 리더)과 시연용 최고관리자. 다른 역할은 C.gate가 안내만 보임
 *      생긴 일(연장, 변경, 운영 변경 충전, 해지 중 하나, 필수 [가정: 일이 생긴 계약만 올린다는 결정을 화면에서 지키려고])
 *      → 거래처(계약 등록과 같은 검색. 새 거래처는 올릴 때 거래처 목록에 함께 등록), 계약 방식 [가정: 후속 기안의 거래처 확인과 결재 문서가 씀]
 *      → 서비스와 제품 줄(기능, 수량, 금액. 사용 안 함 기능도 고름 [가정: 예전 계약서에 지금 팔지 않는 기능이 있을 수 있어]), 계약 금액은 줄의 합계, 정산 방식 [가정]
 *      → 계약 기간(종료일은 오늘 이후 [가정]), 자동갱신과 해지 통지 일수, 개인정보 처리위탁 계약과 SLA [가정: 계약 상세와 후속 기안이 씀]
 *      → 예전 문서 번호(예전 전자결재 번호, 필수, 같은 번호로 두 번 올리지 않음 [가정]), 예전 문서 주소(선택)
 *      → 체결본 파일(필수. 찾지 못하면 까닭을 적고 "체결본 없음" 표시, 4-1 5-3) → 영업대표(지금 맡는 영업 담당자나 영업 리더), 열람 제한(선택)
 *      올리면 번호 LG-0001(계약번호와 따로 매기는 번호, common.js nextLegacyId [가정]), 상태 계약 완료, 결재 없음
 *      올린 사람과 때는 관리자 변경 이력(영역 LEGACY, op.k LEGACY_ADD)에 남음. 계약 기록의 legacy에도 같은 값
 *   2. 보기(?id=LG-0001): 볼 수 있는 사람 모두(C.canView). 올린 내용, 제품 줄, 올린 기록, 계약 상세로 가는 단추
 *      결재 문서(review.html?id=LG-...)로 오면 common.js init이 이 화면으로 보냄(예전 기록에는 결재 문서가 없음)
 *   3. 바로잡기(?fix=LG-0001) [가정]: 올린 기록은 고치지 않음. 영업지원이 바로잡는 까닭을 적어 새 번호로 다시 올리고, 앞 기록은 "바로잡힘"
 *      (전체 계약, 만료 예정, 원계약 고르기에서 빠짐. common.js bundles, legacyReplacedBy). 후속 기안이 이어진 기록은 바로잡지 않음
 *   4. 지금까지 올린 기록 목록(올리기 화면 아래). "체결본" 거르기(전체, 있음, 없음. ?nofile=1이면 없음부터) (설계 검토 2026-11-11 답 ②)
 *   5. 매월 확인(설계 검토 2026-11-11 답 ②, CTL-143): 영업지원 리더(C.checkOwners('SCR-95'))가 매월 그달 올린 기록을 체결본과 맞춰 보고 확인을 남김
 *      월별 확인(운영을 시작한 달부터 이달까지 한 줄씩, 기한은 다음 달 말일 [가정]) → 고른 달의 올린 기록과 확인 남기기 → 확인 기록(20줄씩)
 *      결과: 맞음, 맞지 않는 것이 있음(메모 필수, 컴플라이언스에 넘김 X.raiseIssue 찾은 곳 LEGACY), 그달 올린 기록이 없으면 올린 기록 없음 [가정]
 *      이달도 올린 기록이 있으면 미리 확인함 [가정]. 확인 뒤 그달 기록이 늘면 "확인한 뒤 바뀜"(common.js legacyCheckState)
 *      직무 분리 [가정, 인장 기록 대조와 영업기회 대사의 규칙을 따름]: 리더가 직접 올린 기록이 든 달도 리더가 확인함(총무가 날인하고 대조하는 것과 같음).
 *        다만 그 수를 확인 창과 기록에 남겨(seen.own) 컴플라이언스와 감사 열람이 봄. 최고관리자는 자기가 올린 기록이 든 달을 확인하지 못함(C-6)
 *      기록은 관리자 변경 이력의 점검 기록(영역 AUDIT, op.k LEGACY_CHECK) [가정]. 개요 점검할 일은 common.js legacyCheckTodo
 *      보는 사람: 영업지원(담당자는 보기만), 컴플라이언스와 감사 열람(보기만, C.checkViewers('SCR-95')). 최고관리자는 시연용
 *      [가정] 영업지원 리더는 열람 제한으로 올린 예전 기록도 봄(common.js canView. 체결본과 맞춰 보려면 내용을 봐야 함)
 *   남은 것 ⑧ 뒤쪽(설계 검토 2026-11-11): 제품 줄 아래 참고 단가는 고른 거래처의 고객사 티어 단가가 있으면 그 값(C.stdLine, C.stdPriceText)
 *   (2026-11-14 주말 점검 W7, 점검 번호 abc-01, ai-ops-02, icfr-01) 예전 문서 결재일(legacy.docDate, 03 legacy_doc_date, 필수, 오늘 뒤는 안 됨 [가정])
 *      회사 설정의 전환 날(D.COMPANY.conversionDate, SCR-59)과 같거나 뒤이면 기록 보기, 올린 기록 목록, 매월 확인 표, 확인 창에 "전환 날 뒤" 표시(afterCutover)
 *      막지 않음 [가정: 결정할것 결정 13의 진행 중이던 건이 있고, 막을지는 결정할것 W7-1로 여쭘]. 전환 날이 비어 있으면(결정 12 답 전) 견주지 않음
 *      올린 기록(LEGACY_ADD)의 바뀐 내용에 결재일과 그때의 "전환 날 뒤"를 남김. 매월 확인에서 예전 문서 번호로 열어 결재가 끝났음을 봄(안내 글)
 *   (2026-11-14 주말 점검 W7, 점검 번호 isms-08) 개인정보 처리위탁 계약 "있음"인 예전 기록에 보안 의무(SECURITY)가 하나도 없으면
 *      기록 보기 맨 위에 안내와 "계약 상세에서 보안 의무 추가" 링크(C.legacySecurityGap, common.js). 막지 않고 새 메일도 없음 [가정]. 개요의 정보보호 "챙길 의무"에도 한 줄(dashboard.js)
 *   (2026-11-14 주말 점검 W7, 점검 번호 isms-10) 체결본 지문: 시안은 파일 이름만 남겨(지문 없음) 올린 기록 글에 지문을 넣지 않음. 문서(03, 04, 06)에만 적음
 * 실제 시스템에서는 서버가 같은 검사(필수 칸, 번호, 고칠 수 없음, 영업지원만)를 다시 합니다.
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const $$ = function (s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); };
  const params = new URLSearchParams(location.search);
  const notice = function (title, body, actions) { $('#notice').innerHTML = C.noticeBox('', title, body, actions); };
  // 생긴 일 [가정]: 올리는 까닭이 된 후속 일. 코드는 계약종류(KINDS)와 같은 값을 씀(운영 변경 충전은 CHANGE)
  const NEED = [['RENEW', '연장'], ['AMEND', '변경'], ['CHANGE', '운영 변경 충전'], ['TERMINATE', '해지']];
  function needLabel(k) { const x = NEED.filter(function (n) { return n[0] === k; })[0]; return x ? x[1] : '-'; }
  // 올릴 수 있는 사람: 영업지원(담당자, 리더)과 시연용 최고관리자. 읽기만 하는 역할은 없음
  const canWrite = !C.isReadOnly(me) && (me.role === 'SUPER' || C.hasRole(me, ['SALES_ADMIN']));
  // (설계 검토 2026-11-11 답 ②, CTL-143) 매월 확인: 남길 수 있는 사람은 영업지원 리더(C.canDoCheck)이고 컴플라이언스가 아님(다른 매월 점검과 같음)
  const SCR = 'SCR-95';
  const X = window.CLIMB_CTL; // 컴플라이언스에 넘기기(legacy-contract.html이 control-checks.js를 부름)
  const canCheck = C.canDoCheck(me, SCR) && !(me.role !== 'SUPER' && C.hasRole(me, ['COMPLIANCE']));
  const canSeeAll = canWrite || C.canSeeCheck(me, SCR); // 올린 기록 목록과 매월 확인을 보는 사람
  const RESULT = C.LEGACY_RESULT;
  let selMonth = '', checkPage = 1;
  function monthLabel(ym) { return ym.slice(0, 4) + '년 ' + Number(ym.slice(5, 7)) + '월'; }
  function legacyRecords() {
    return D.CONTRACTS.filter(function (c) { return c.id && c.legacy; })
      .sort(function (a, b) { return String(b.legacy.at || '').localeCompare(String(a.legacy.at || '')) || String(b.id).localeCompare(String(a.id)); });
  }
  function findLegacy(id) { return id ? D.CONTRACTS.filter(function (c) { return c.id === id && c.legacy; })[0] || null : null; }
  function info(label, value, cls) { return '<div><dt>' + esc(label) + '</dt><dd' + (cls ? ' class="' + cls + '"' : '') + '>' + value + '</dd></div>'; } // cls amount: 금액은 오른쪽(REQ-UI-16)
  function yesNo(v) { return v === 'YES' || v === true ? '있음' : v === 'NO' || v === false ? '없음' : '-'; }

  /* (2026-11-14 주말 점검 W7) 전환 날과 예전 문서 결재일
   *   cutover(): 회사 설정의 전환 날(없으면 ''). afterCutover(c): 결재일이 전환 날과 같거나 뒤인지(둘 중 하나라도 비면 false)
   *   cutoverBadge(c): "전환 날 뒤" 표시(같은 글, 주의 색). 막지 않음 [가정, 결정할것 W7-1]
   *   (2026-11-14 주말 점검 W7) 판단은 common.js C.legacyAfterCutover로 옮기고, C.legacyBadges에도 "전환 날 뒤"를 더함(계약 상세, 전체 계약, 만료 예정,
   *     연장 검토, 해지, 계약 요약서에도 보임). 그래서 이 화면 머리의 표시(C.legacyBadges)에는 따로 붙이지 않음 */
  function cutover() { return (D.COMPANY && D.COMPANY.conversionDate) || ''; }
  function afterCutover(c) { return C.legacyAfterCutover(c); }
  function cutoverBadge(c) { return afterCutover(c) ? C.badge('attention', '전환 날 뒤') : ''; }
  // (2026-11-14 주말 점검 W7, isms-08) 처리위탁 예전 기록인데 보안 의무가 없는 묶음 [가정]: common.js C.legacySecurityGap 하나로 옮김(개요 dashboard.js와 같은 함수)

  /* (설계 검토 2026-11-11 답 ②) 이 기록이 든 달의 매월 확인: 이 기록을 본 마지막 확인(그때 본 열쇠에 이 기록이 있음). 없으면 확인 전과 그달 기한 */
  function monthCheckInfo(c) {
    const ym = String(c.legacy.at || '').slice(0, 7), key = C.legacyKeys([c]);
    const seen = C.legacyChecks(ym).filter(function (e) { return ((e.op.seen || {}).keys || '').split(',').indexOf(key) > -1; }).pop();
    return info('매월 확인', seen ? esc(RESULT[seen.op.result] || seen.op.result) + '<span class="cell-meta">' + esc(monthLabel(ym)) + ' 확인, ' + esc(C.ownerLabel(seen.by, seen.op.dept)) + ' ' + C.fmtDateTime(seen.at) +
        (seen.op.issueId ? ', 컴플라이언스에 넘김(' + esc(seen.op.issueId) + ')' : '') + '</span>'
      : '확인 전<span class="cell-meta">' + esc(monthLabel(ym)) + ' 확인은 영업지원 리더가 ' + C.fmtDate(C.legacyCheckState(ym).due) + '까지 남김</span>');
  }

  /* 기획자 결정 2026-11-16(결정할것 확인 2): 영업지원 리더가 직접 올린 기록의 컴플라이언스 확인. 리더의 매월 확인에서는 빠짐(C.legacyCheckState)
   *   보기 화면에 "컴플라이언스 확인" 칸(결과, 누가 언제)을 두고, 컴플라이언스 담당자(읽기만 하는 역할 아님)에게 "확인 남기기" 단추
   *   결과: 맞음, 맞지 않는 것이 있음(메모 필수). 기록은 관리자 변경 이력의 점검 기록(AUDIT, op.k LEGACY_OWN_CHECK). 확인 뒤에도 다시 남길 수 있음(마지막 것이 보임) */
  const canOwnCheck = !C.isReadOnly(me) && C.hasRole(me, ['COMPLIANCE']);
  // (2026-11-17 다른 눈 leak-records-02) 매월 확인 기록이 본 기록 가운데 지금 사람이 볼 수 없는 열람 제한 기록이 있으면 메모를 가림
  function memoHidden(e) {
    const ids = String(((e.op || {}).seen || {}).keys || '').split(',').map(function (k) { return k.split('@')[0]; }).filter(Boolean);
    return ids.some(function (id) { const c = findLegacy(id); return !!c && !C.canView(c, me); });
  }
  function ownCheckInfo(c) {
    if (!C.legacyLeadOwn(c)) return '';
    const e = C.legacyOwnCheckOf(c);
    return info('컴플라이언스 확인', (e ? esc(RESULT[e.op.result] || e.op.result) + '<span class="cell-meta">' + esc(C.ownerLabel(e.by, e.op.dept)) + ' ' + C.fmtDateTime(e.at) + (e.op.memo ? ', ' + esc(e.op.memo) : '') + '</span>'
      : '확인 전') + '<span class="cell-meta">영업지원 리더가 직접 올린 기록이라 리더의 매월 확인 대신 컴플라이언스가 체결본과 맞춰 봅니다.</span>');
  }
  function openOwnCheck(c) {
    C.formModal({
      title: '영업지원 리더가 올린 기록을 확인할까요?',
      desc: '체결본과 예전 문서(번호, 결재일)를 열어 올린 내용과 맞는지 봅니다. 저장하면 확인한 사람과 일시, 결과가 남고 고칠 수 없습니다.',
      body: '<p class="modal-info">' + C.meta([['기록', esc(c.id + ' ' + c.counterparty)], ['올린 사람', esc(C.ownerLabel(c.legacy.by, c.legacy.dept))], ['예전 문서', esc((c.legacy.docNo || '-') + (c.legacy.docDate ? ', ' + C.fmtDate(c.legacy.docDate) + ' 결재' : ''))]]) + '</p>' +
        '<fieldset class="field" data-field="result"><legend class="field-label">결과<span class="req" aria-hidden="true">*</span><span class="sr-only">(필수)</span></legend>' +
          '<div class="choice-row"><label class="choice"><input type="radio" name="result" value="MATCH">' + RESULT.MATCH + '</label>' +
          '<label class="choice"><input type="radio" name="result" value="DIFF">' + RESULT.DIFF + '</label></div><p class="field-error" hidden></p></fieldset>' +
        C.fieldHtml({ name: 'memo', label: '메모 (맞지 않는 것이 있으면 필수)', type: 'textarea', optional: true, help: '맞지 않는 것이 있으면 꼭 적습니다. 바로잡는 기록은 영업지원이 올립니다.',
          placeholder: '예: 계약 기간 종료일이 체결본(2027-02-28)과 다름' }),
      btn: '확인 남기기',
      check: function (f) {
        const r = (f.querySelector('input[name="result"]:checked') || {}).value || '';
        return { result: r ? '' : '결과를 고르세요.', memo: r === 'DIFF' && !(f.elements.memo.value || '').trim() ? '맞지 않는 것을 메모에 적으세요.' : '' };
      },
      done: function (f) {
        const r = f.querySelector('input[name="result"]:checked').value, memo = (f.elements.memo.value || '').trim();
        C.adminSave('AUDIT', '예전 계약 기록 확인(영업지원 리더가 올림): ' + c.id, RESULT[r], memo || RESULT[r], { k: 'LEGACY_OWN_CHECK', id: c.id, result: r, memo: memo, dept: me.dept || '' });
        C.toast(c.id + ' 확인을 남겼습니다: ' + RESULT[r]);
        location.reload();
      },
    });
  }

  /* ---------- 2. 보기 (?id=) ---------- */
  const viewId = params.get('id');
  if (viewId) { renderView(viewId); return; }

  function renderView(id) {
    $('#intro-main').textContent = '시스템을 쓰기 전에 맺어 결재 없이 올린 계약입니다. 후속 일(연장, 변경, 운영 변경 충전, 해지)은 계약 상세에서 기안합니다.';
    $('#intro-sub').textContent = '올린 기록은 고칠 수 없습니다. 잘못 올렸으면 영업지원이 까닭을 적어 새 기록으로 바로잡습니다. 체결 금액과 건수 통계에는 넣지 않습니다.';
    const c = findLegacy(id);
    if (!c) { notice('예전 계약 기록을 찾을 수 없습니다', '주소의 번호를 확인해 주세요. 예: legacy-contract.html?id=LG-0001'); return; }
    if (!C.canView(c, me)) {
      $('#page-title').innerHTML = C.icon('lock') + '열람 제한 계약';
      notice('이 계약은 볼 수 없습니다', C.restrictedMsg);
      return;
    }
    const L = c.legacy, b = C.bundleOf(c.id), next = C.legacyReplacedBy(c);
    const prev = L.replaces ? findLegacy(L.replaces) : null;
    $('#doc-kind').hidden = false;
    $('#page-title').textContent = c.counterparty;
    // (2026-11-14 주말 점검 W7) 머리의 표시에 "전환 날 뒤"(결재일이 전환 날과 같거나 뒤일 때만). C.legacyBadges가 함께 붙임(두 번 붙지 않게 따로 더하지 않음)
    $('#doc-meta').innerHTML = C.meta([esc(c.id), esc(C.serviceLabel(c.services)), C.legacyBadges(c) + (c.restricted ? ' ' + C.icon('lock', 'sm') : '')]);
    $('#doc-meta').hidden = false;
    if (next) {
      notice('바로잡힌 기록입니다', esc(C.josa(C.ownerLabel(next.legacy.by, next.legacy.dept), '이', '가')) + ' ' + C.fmtDateTime(next.legacy.at) + '에 까닭을 적어 새 기록을 올렸습니다(' +
        '<a class="doc-link" href="legacy-contract.html?id=' + encodeURIComponent(next.id) + '">' + esc(next.id) + '</a>). 까닭: ' + esc(next.legacy.fixReason || '') +
        '<br>이 기록은 전체 계약, 만료 예정, 원계약 고르기에서 빠지고 기록으로만 남습니다.');
    } else if (C.legacySecurityGap(b)) {
      // (2026-11-14 주말 점검 W7, isms-08) 처리위탁 예전 기록인데 보안 의무가 없음 [가정]: 알리기만 하고 막지 않음, 새 메일 없음(분할 정산 알림과 같은 모양)
      //   단추는 보안 의무를 더할 수 있는 사람(C.canAddObligation: 정보보호, 지금 영업대표, 법무, 관리자, 시연용 최고관리자)에게만. 누르면 계약 상세의 체결 후 의무로 감
      //   [요청] contract.js가 주소에 보안 의무 추가 표시(예: &ob=security)를 받아 의무 추가 창을 보안 의무로 미리 골라 열면 한 번 덜 누름(분할 정산의 &bill=add와 같게).
      //     그 전까지는 계약 상세의 체결 후 의무 묶음(#ob-title)으로만 보냄
      const canAdd = C.canAddObligation(me, c, 'SECURITY');
      notice('개인정보 처리위탁 계약인데 보안 의무가 없음',
        '이 예전 계약은 결재 없이 올라와 정보보호 검토를 거치지 않았습니다. 계약이 끝난 뒤 개인정보를 파기하고 확인서 보내기 같은 보안 의무를 계약 상세의 체결 후 의무에 더하면 정보보호가 기한 전에 이메일을 받습니다. ' +
        '더하지 않아도 기록과 후속 기안은 그대로입니다.' + (canAdd ? '' : ' 정보보호, 영업대표, 법무가 더할 수 있습니다.'),
        canAdd ? '<a class="btn btn--primary btn--md" href="contract.html?id=' + encodeURIComponent(c.id) + '#ob-title">계약 상세에서 보안 의무 추가</a>' : '');
    }
    const st = b ? D.STATUS[b.status] : D.STATUS[c.status];
    const rep = C.salesRepOf(c);
    const docLink = L.docUrl ? ' <a class="ext-link" href="' + esc(L.docUrl) + '" target="_blank" rel="noopener noreferrer">예전 문서 열기' + C.icon('external', 'sm') + '<span class="sr-only">(새 창)</span></a>' : '';
    $('#v-info').innerHTML = [
      info('번호', esc(c.id) + '<span class="cell-meta">계약번호와 따로 매기는 예전 계약 기록 번호</span>'),
      info('지금 상태', C.badge(st.tone, st.label) + (b && !next ? '<span class="cell-meta"><a href="contract.html?id=' + encodeURIComponent(c.id) + '">계약 상세 보기</a></span>' : '')),
      info('생긴 일', esc(needLabel(L.need)) + (L.note ? '<span class="cell-meta">' + esc(L.note) + '</span>' : '')),
      info('거래처', esc(c.counterparty) + '<span class="cell-meta">' + esc(C.fmtBizNo((c.form || {}).bizNo || '')) + '</span>'),
      info('계약 방식', esc(D.METHODS[C.methodOf(c)] || '-')),
      info('계약 기간', C.fmtPeriod(c.startDate, c.endDate)),
      info('계약 금액', Number(c.amount || 0).toLocaleString('ko-KR') + '원<span class="cell-meta">' + esc(C.fmtKRW(c.amount)) + ', 부가세 별도</span>', 'amount'),
      info('자동갱신', c.autoRenew === 'YES' ? '있음<span class="cell-meta">만료 ' + esc(String(c.noticeDays || '-')) + '일 전까지 상대방에게 알려야 연장되지 않음</span>' : '없음'),
      info('정산 방식', esc(D.SETTLEMENTS[(c.form || {}).settlement] || '-')),
      info('개인정보 처리위탁 계약', yesNo(c.personalData)),
      info('서비스 수준 협약(SLA)', yesNo(c.sla)),
      info('예전 문서 번호', esc(L.docNo || '-') + docLink),
      // (2026-11-14 주말 점검 W7) 예전 문서 결재일과 "전환 날 뒤". 이 칸을 두기 전에 올린 시연 기록은 "-"
      info('예전 문서 결재일', L.docDate ? C.fmtDate(L.docDate) + (afterCutover(c) ? ' ' + cutoverBadge(c) + '<span class="cell-meta">전환 날(' + C.fmtDate(cutover()) +
          ')과 같거나 뒤에 결재한 문서입니다. 시스템 전에 맺은 계약인지 매월 확인에서 봅니다.</span>' : '') : '-'),
      // 4-1 5-3: 체결본을 찾지 못했으면 "체결본 없음"과 까닭
      info('체결본', L.file ? esc(L.file) : C.badge('attention', '체결본 없음') + '<span class="cell-meta">까닭: ' + esc(L.noFile || '-') + '</span>'),
      info('영업대표', esc(C.ownerLabel(rep)) + (rep !== c.requesterId ? '<span class="cell-meta">올릴 때 영업대표 ' + esc(C.ownerLabel(c.requesterId)) + '</span>' : '')),
      info('올린 사람', esc(C.ownerLabel(L.by, L.dept)) + '<span class="cell-meta">' + C.fmtDateTime(L.at) + ' 올림, 결재 없음</span>'),
      C.legacyLeadOwn(c) ? ownCheckInfo(c) : monthCheckInfo(c), // 확인 2(2026-11-16): 리더가 올린 기록은 컴플라이언스 확인
      prev ? info('바로잡은 앞 기록', '<a href="legacy-contract.html?id=' + encodeURIComponent(prev.id) + '">' + esc(prev.id) + '</a><span class="cell-meta">까닭: ' + esc(L.fixReason || '') + '</span>') : '',
      info('열람 제한', c.restricted ? C.icon('lock', 'sm') + '있음' : '없음'),
    ].join('');
    // 제품 줄: 기능, 수량, 금액(오른쪽). 마지막 줄에 합계
    const rows = (c.products || []).map(function (l) {
      const f = D.FEATURES.filter(function (x) { return x.id === l.feature; })[0];
      return '<tr><td>' + esc(C.featureLabel({ product: f ? f.product : '', feature: l.feature })) + '</td><td class="num">' + Number(l.qty || 0).toLocaleString('ko-KR') + '</td>' +
        '<td class="num">' + C.fmtWon(l.amount) + '</td></tr>';
    });
    $('#v-products').innerHTML = '<caption class="sr-only">서비스와 제품: 제품과 기능, 수량, 금액</caption>' +
      '<thead><tr><th scope="col">제품과 기능</th><th scope="col">수량</th><th scope="col">금액</th></tr></thead><tbody>' +
      (rows.length ? rows.join('') + '<tr><th scope="row">합계</th><td class="num"></td><td class="num">' + C.fmtWon(c.amount) + '</td></tr>'
        : '<tr><td class="empty-row" colspan="3">제품 줄이 없습니다.</td></tr>') + '</tbody>';
    // 올린 기록: 관리자 변경 이력의 이 번호 줄(누가, 언제, 무엇을, 까닭)
    const log = C.adminLog(['LEGACY']).filter(function (e) { return (e.op && e.op.id === c.id) || String(e.target || '').indexOf(c.id + ' ') === 0 || e.target === c.id; });
    $('#v-log').innerHTML = C.adminHistoryHtml(log, '올린 기록');
    // 단추: 계약 상세, 바로잡기(영업지원, 후속 기안이 없고 아직 바로잡지 않은 기록만 [가정]), 목록
    const lone = !!b && b.items.length === 1;
    // (설계 검토 2026-11-11 답 ②) 목록 단추는 목록을 보는 사람 모두(컴플라이언스와 감사 열람도, 보기만)
    $('#v-actions').innerHTML = (canSeeAll ? '<a class="btn btn--tertiary btn--md" href="legacy-contract.html">올린 기록 목록</a>' : '') +
      (canWrite && !next && lone ? '<a class="btn btn--secondary btn--md" href="legacy-contract.html?fix=' + encodeURIComponent(c.id) + '">바로잡는 기록 올리기</a>' : '') +
      (b && !next ? '<a class="btn btn--primary btn--md" href="contract.html?id=' + encodeURIComponent(c.id) + '">계약 상세 보기</a>' : '') +
      (canOwnCheck && C.legacyLeadOwn(c) && !next ? '<button type="button" class="btn btn--secondary btn--md" id="btn-own-check">' + (C.legacyOwnCheckOf(c) ? '다시 확인 남기기' : '확인 남기기') + '</button>' : ''); // 확인 2
    const oc = document.getElementById('btn-own-check');
    if (oc) oc.addEventListener('click', function () { openOwnCheck(c); });
    $('#view').hidden = false;
  }

  /* ---------- 1. 올리기 (영업지원) ----------
   * (설계 검토 2026-11-11 답 ②) 문을 넓힘: 영업지원(올리기)과 매월 확인을 보는 사람(영업지원 리더, 컴플라이언스, 감사 열람. C.checkViewers('SCR-95'))
   *   올리지 않는 사람(컴플라이언스, 감사 열람, 읽기만 하는 역할)은 양식을 감추고 목록과 매월 확인만 봄. 처음 그리기 전에 정해 흔들리지 않음 */
  if (!C.gate(me, ['SALES_ADMIN'].concat(C.checkViewers(SCR)), '예전 계약 기록은 영업지원이 올립니다',
    '지금은 ' + esc(C.roleLabel(me.role)) + ' 역할로 보고 있습니다. 올린 기록은 <a href="contracts.html?legacy=1">보관함 &gt; 전체 계약</a>에서 기록 종류를 "예전 계약 기록"으로 거르면 볼 수 있습니다. ' +
    '화면 맨 위 검은 띠에서 영업지원 담당자나 최고관리자로 바꾸면 올릴 수 있고, 컴플라이언스나 감사 열람으로 바꾸면 목록과 매월 확인을 보기만 합니다.')) return;
  if (!canWrite) {
    $('#form').hidden = true;
    $('#intro-sub').textContent = '보기만 합니다. 올리기와 바로잡기는 영업지원이, 매월 확인은 영업지원 리더가 남깁니다. 체결 금액과 건수 통계에는 넣지 않습니다.';
    if (params.get('fix')) notice('바로잡는 기록은 영업지원이 올립니다', '지금 역할로는 보기만 합니다. 아래 목록에서 기록을 볼 수 있습니다.');
    renderLists();
    $('#content').hidden = false;
    return;
  }

  // 바로잡기(?fix=) [가정]: 앞 기록이 있고, 볼 수 있고, 아직 바로잡지 않았고, 후속 기안이 없을 때만
  const fixId = params.get('fix');
  const fixSrc = fixId ? findLegacy(fixId) : null;
  if (fixId) {
    const fb = fixSrc ? C.bundleOf(fixSrc.id) : null;
    const why = !fixSrc || !C.canView(fixSrc, me) ? '바로잡을 기록을 찾을 수 없습니다.'
      : C.legacyReplacedBy(fixSrc) ? '이미 바로잡은 기록입니다(새 기록 ' + C.legacyReplacedBy(fixSrc).id + ').'
      : fb && fb.items.length > 1 ? '이 기록에 이어 기안한 후속 일(' + fb.items.filter(function (x) { return x !== fixSrc; }).map(function (x) { return x.id; }).join(', ') + ')이 있어 바로잡지 않습니다. 후속 기안이 이 기록의 값을 이어받았기 때문입니다.'
      : '';
    if (why) {
      notice('바로잡는 기록을 올릴 수 없습니다', esc(why) + ' <a href="legacy-contract.html' + (fixSrc ? '?id=' + encodeURIComponent(fixSrc.id) : '') + '">돌아가기</a>');
      $('#content').hidden = true;
      return;
    }
  }

  /* 거래처 검색: 계약 등록(new-contract.js)과 같은 방식(C.searchBusinesses). 값 'C:거래처 번호' 우리 거래처 / 'R:사업자등록번호' DB / 'NEW' 직접 입력
   *   새 거래처(DB, 직접 입력)는 올릴 때 거래처 목록에 함께 등록(아래 registerCustomer) */
  const NEW_CUSTOMER = 'NEW';
  const HELP_SEARCH = '상호나 사업자등록번호 일부를 넣어 찾습니다. 우리 거래처와 ' + D.BIZ_REGISTRY_INFO.source + '를 함께 찾고, 고르면 상호와 사업자등록번호가 채워집니다. 찾는 곳이 없으면 직접 입력합니다.';
  const qInput = $('#f-customer-q'), panel = $('#customer-panel'), list = $('#customer-list');
  $('#customer-icon').innerHTML = C.icon('search', 'sm');
  $('#customer-help').textContent = HELP_SEARCH;
  let results = [], active = -1;
  function setCustomer(key, name, bizNo) {
    $('#f-customer').value = key;
    const manual = key === NEW_CUSTOMER;
    $('#f-counterparty').readOnly = !manual;
    $('#f-bizno').readOnly = !manual;
    $('#f-counterparty').value = name || '';
    $('#f-bizno').value = C.fmtBizNo(bizNo);
    $('#customer-help').innerHTML = !key ? esc(HELP_SEARCH)
      : manual ? '검색되지 않는 거래처라 사업자등록증을 보고 직접 넣습니다. 올리면 거래처 목록에 함께 등록됩니다. <button type="button" class="btn-text" id="customer-research">다시 검색</button>'
      : key.indexOf('R:') === 0 ? '사업자 정보 DB에서 찾은 곳입니다. 아직 우리 거래처가 아니라서 올리면 거래처 목록에 함께 등록됩니다.'
      : '우리 거래처 목록에 있는 곳입니다. ' + (C.customerTier(tierCustomer()) ? '고객사 티어: ' + esc(C.tierLabel(C.customerTier(tierCustomer()))) + '. 제품 줄 아래 참고 단가는 그 티어 단가입니다(티어 단가가 있는 기능만).'
        : '고객사 티어가 없어 제품 줄 아래 참고 단가는 기본 표준 단가입니다.');
    syncAllLines(); // (설계 검토 2026-11-11 남은 것 ⑧ 뒤쪽) 참고 단가를 고른 거래처의 고객사 티어로 다시 씀
  }
  function closePanel() {
    panel.hidden = true;
    qInput.setAttribute('aria-expanded', 'false');
    qInput.removeAttribute('aria-activedescendant');
    active = -1;
  }
  function renderResults() {
    const q = qInput.value.trim();
    results = C.searchBusinesses(q, 8);
    active = -1;
    qInput.removeAttribute('aria-activedescendant');
    if (!q) { closePanel(); $('#customer-status').textContent = ''; return; }
    list.innerHTML = results.map(function (r, i) {
      return '<li role="option" id="cu-opt-' + i + '" class="combo-option" data-i="' + i + '" aria-selected="false">' +
        '<span class="combo-name">' + esc(r.name) + '</span><span class="combo-meta">' + esc(r.bizNo) + '</span>' +
        C.badge(r.kind === 'C' ? 'success' : 'line', r.kind === 'C' ? '거래처' : '사업자 DB') + '</li>';
    }).join('');
    list.hidden = !results.length;
    $('#customer-empty').hidden = !!results.length;
    $('#customer-empty-text').textContent = '"' + q + '" 검색 결과가 없습니다. 사업자등록증을 보고 직접 넣을 수 있습니다.';
    panel.hidden = false;
    qInput.setAttribute('aria-expanded', 'true');
    $('#customer-status').textContent = results.length ? '검색 결과 ' + results.length + '건. 위아래 화살표로 고릅니다.' : '검색 결과가 없습니다.';
  }
  function choose(i) {
    const r = results[i];
    if (!r) return;
    qInput.value = r.name;
    setCustomer(r.key, r.name, r.bizNo);
    closePanel();
    C.setFieldError(qInput.closest('[data-field]'), '');
  }
  function moveActive(step) {
    if (!results.length) return;
    active = (active + step + results.length) % results.length;
    Array.prototype.forEach.call(list.children, function (li, i) { li.setAttribute('aria-selected', String(i === active)); });
    qInput.setAttribute('aria-activedescendant', 'cu-opt-' + active);
    list.children[active].scrollIntoView({ block: 'nearest' });
  }
  qInput.addEventListener('input', function () { if ($('#f-customer').value) setCustomer('', '', ''); renderResults(); });
  qInput.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (panel.hidden) renderResults(); moveActive(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
    else if (e.key === 'Enter' && !panel.hidden) { e.preventDefault(); if (active > -1) choose(active); else if (results.length === 1) choose(0); }
    else if (e.key === 'Escape' && !panel.hidden) { e.stopPropagation(); closePanel(); }
  });
  list.addEventListener('mousedown', function (e) { e.preventDefault(); });
  list.addEventListener('click', function (e) { const li = e.target.closest('[data-i]'); if (li) choose(Number(li.getAttribute('data-i'))); });
  panel.addEventListener('mousedown', function (e) { e.preventDefault(); });
  $('#customer-manual').addEventListener('click', function () { qInput.value = ''; setCustomer(NEW_CUSTOMER, '', ''); closePanel(); $('#f-counterparty').focus(); });
  $('#customer-help').addEventListener('click', function (e) {
    if (e.target.id === 'customer-research') { setCustomer('', '', ''); qInput.value = ''; qInput.focus(); }
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('#customer-combo')) closePanel(); });
  $('#customer-combo').addEventListener('focusout', function (e) { if (!e.currentTarget.contains(e.relatedTarget)) closePanel(); });
  // 직접 입력한 사업자등록번호는 000-00-00000으로 보여 줌(v0.34와 같음)
  $('#f-bizno').addEventListener('input', function (e) { if (!e.target.readOnly) e.target.value = C.fmtBizNo(e.target.value); });
  // 상호로 거래처 고르기(바로잡기에서 앞 기록 채우기). 우리 거래처에 없으면 직접 입력으로
  function pickCustomerByName(name, bizNo) {
    if (!name) return;
    const r = C.searchBusinesses(name, 50).filter(function (x) { return x.name === name; })[0];
    qInput.value = r ? r.name : '';
    if (r) setCustomer(r.key, r.name, r.bizNo); else setCustomer(NEW_CUSTOMER, name, bizNo || '');
  }

  /* ---------- 고르는 칸: 생긴 일, 계약 방식, 정산 방식(코드 관리의 사용 중인 값), 영업대표 ---------- */
  function radios(name, pairs) {
    return pairs.map(function (p) { return '<label class="choice"><input type="radio" name="' + name + '" value="' + esc(p[0]) + '">' + esc(p[1]) + '</label>'; }).join('');
  }
  $('#need-choices').innerHTML = radios('need', NEED);
  $('#method-choices').innerHTML = radios('method', C.codeList('METHOD').map(function (x) { return [x.code, x.label]; }));
  $('#settlement-choices').innerHTML = radios('settlement', C.codeList('SETTLEMENT').map(function (x) { return [x.code, x.label]; }));
  // 영업대표: 지금 사용 중이고 영업 담당자나 영업 리더 역할이 있는 사람(영업대표 바꾸기 C.openRepChange와 같은 사람들). 조직, 이름 순
  const reps = (D.ACCOUNTS || []).filter(function (a) {
    const r = C.activeRoles(a);
    return a.status === 'ACTIVE' && (r.indexOf('SALES') > -1 || r.indexOf('HEAD') > -1);
  }).sort(function (a, b) { return String(a.dept).localeCompare(String(b.dept)) || String(a.name).localeCompare(String(b.name)); });
  $('#f-rep').innerHTML = '<option value="">고르세요</option>' + reps.map(function (a) {
    return '<option value="' + esc(a.id) + '">' + esc((a.dept ? a.dept + ' ' : '') + a.name) + '</option>';
  }).join('');
  function val(name) {
    const r = document.querySelector('input[name="' + name + '"]:checked');
    return r ? r.value : '';
  }

  /* ---------- 서비스와 제품 줄 ----------
   * 한 칸에서 기능을 고름(서비스와 제품마다 묶음). 사용 안 함인 제품과 기능도 넣고 "(사용 안 함)"을 붙임 [가정]
   * 줄 아래 회색 글은 오늘 가격 기준의 표준 단가(참고만, 할인율을 견주거나 막지 않음 [가정]: 예전 계약은 결재가 없고 가격 예외 점검 대상이 아님) */
  const PRICE_NOW = C.pricesAt(D.TODAY);
  function badNum(v) { return !/^[\d,\s]*$/.test(String(v == null ? '' : v)); }
  function parseNum(v) { if (badNum(v)) return null; const n = String(v == null ? '' : v).replace(/[^0-9]/g, ''); return n ? parseInt(n, 10) : null; }
  function fmtNum(n) { return n == null ? '' : Number(n).toLocaleString('ko-KR'); }
  function featureOptions(selected) {
    return '<option value="">고르세요</option>' + D.PRODUCTS.map(function (p) {
      const fs = D.FEATURES.filter(function (f) { return f.product === p.id; });
      if (!fs.length) return '';
      return '<optgroup label="' + esc(C.serviceLabel([p.service]) + ' ' + p.name) + '">' + fs.map(function (f) {
        return '<option value="' + esc(f.id) + '"' + (f.id === selected ? ' selected' : '') + '>' + esc(C.featureText(f.id) + (!p.use || !f.use ? ' (사용 안 함)' : '')) + '</option>';
      }).join('') + '</optgroup>';
    }).join('');
  }
  let seq = 0;
  /* (설계 검토 2026-11-11 남은 것 ⑧ 뒤쪽) 참고 단가에 고객사 티어: 고른 거래처(우리 거래처 'C:번호')의 티어 단가가 있으면 그 값, 없으면 기본 표준 단가
   *   셈과 글은 견적, 계약 등록과 같은 C.stdLine, C.stdPriceText("10,800,000원(기관, 1년, 티어 1 단가. 기본 12,000,000원)")
   *   사업자 정보 DB에서 고르거나 직접 넣은 새 거래처는 티어가 없어 기본 단가(가격 틀 [가정]과 같음). 거래처를 바꾸면 모든 줄을 다시 씀(syncAllLines) */
  function tierCustomer() {
    const key = $('#f-customer').value || '';
    return key.indexOf('C:') === 0 ? D.CUSTOMERS.filter(function (cu) { return cu.id === key.slice(2); })[0] || null : null;
  }
  function syncLine(li) {
    const fid = li.querySelector('[data-k="feature"]').value, p = PRICE_NOW[fid];
    const s = p ? C.stdLine({ feature: fid, qty: 1 }, { row: p, customer: tierCustomer(), fresh: true }) : null;
    li.querySelector('.qty-unit').textContent = p && C.unitKindOf(p) === 'PER_UNIT' ? '건' : '개';
    li.querySelector('.price-info').textContent = !fid ? '' : s ? '참고: 오늘 표준 단가 ' + C.stdPriceText(s, p.unit) : '참고: 오늘 가격 기준이 없는 기능';
  }
  function syncAllLines() { $$('#product-list > li').forEach(syncLine); }
  function addProduct(data) {
    data = data || {};
    seq += 1;
    const n = seq, err = ' aria-describedby="p-err-' + n + '"';
    const li = document.createElement('li');
    li.className = 'product-item';
    li.innerHTML =
      '<div class="product-pick"><div class="field"><label class="field-label field-label--sm" for="p-feat-' + n + '">제품과 기능</label>' +
        '<select class="select" id="p-feat-' + n + '" data-k="feature"' + err + '>' + featureOptions(data.feature || '') + '</select></div></div>' +
      '<div class="product-grid">' +
        '<div class="field"><label class="field-label field-label--sm" for="p-qty-' + n + '">수량</label>' +
          '<div class="input-unit"><input class="input" id="p-qty-' + n + '" data-k="qty" inputmode="numeric" maxlength="7"' + err + ' value="' + esc(fmtNum(data.qty != null ? data.qty : 1)) + '"><span class="unit qty-unit">개</span></div></div>' +
        '<div class="field"><label class="field-label field-label--sm" for="p-amt-' + n + '">금액</label>' +
          '<div class="input-unit"><input class="input" id="p-amt-' + n + '" data-k="amount" inputmode="numeric" maxlength="15"' + err + ' value="' + esc(fmtNum(data.amount != null ? data.amount : null)) + '"><span class="unit">원</span></div></div>' +
      '</div>' +
      '<div class="product-foot"><span class="price-info"></span><button type="button" class="btn-text" data-act="remove">이 제품 지우기</button></div>' +
      '<p class="field-error" id="p-err-' + n + '" hidden></p>';
    $('#product-list').appendChild(li);
    syncLine(li);
    total();
    return li;
  }
  function readProducts() {
    return $$('#product-list > li').map(function (li) {
      const q = li.querySelector('[data-k="qty"]').value, a = li.querySelector('[data-k="amount"]').value;
      return { li: li, feature: li.querySelector('[data-k="feature"]').value, qty: parseNum(q), amount: parseNum(a), bad: badNum(q) || badNum(a) };
    });
  }
  function total() {
    const sum = readProducts().reduce(function (s, r) { return s + (r.amount || 0); }, 0);
    $('#amount-total').textContent = C.fmtWon(sum);
    return sum;
  }
  $('#btn-add-product').insertAdjacentHTML('afterbegin', C.icon('plus'));
  $('#btn-add-product').addEventListener('click', function () { addProduct().querySelector('select').focus(); });
  $('#product-list').addEventListener('click', function (e) {
    if (!e.target.closest('[data-act="remove"]')) return;
    const li = e.target.closest('li.product-item'), next = li.nextElementSibling;
    li.remove();
    total();
    (next ? next.querySelector('select') : $('#btn-add-product')).focus();
  });
  $('#product-list').addEventListener('change', function (e) { if (e.target.matches('[data-k="feature"]')) syncLine(e.target.closest('li')); total(); });
  $('#product-list').addEventListener('input', total);
  $('#product-list').addEventListener('focusout', function (e) {
    if (e.target.matches('[data-k="amount"], [data-k="qty"]') && !badNum(e.target.value)) e.target.value = fmtNum(parseNum(e.target.value));
  });

  /* ---------- 자동갱신, 체결본 ---------- */
  function syncAuto() { $('#notice-days-field').hidden = val('autoRenew') !== 'YES'; }
  $$('input[name="autoRenew"]').forEach(function (r) { r.addEventListener('change', syncAuto); });
  let fileName = '';
  function setFile(n) { fileName = n; $('#file-name').textContent = n ? '고른 파일: ' + n : '고른 파일 없음'; } // 줄 자리를 늘 둠(고르면 글만 바뀜)
  setFile('');
  $('#f-file').addEventListener('change', function (e) {
    const f = e.target.files[0], box = e.target.closest('.field');
    if (f && (f.size > 50 * 1048576 || !/\.(pdf|jpe?g|png)$/i.test(f.name))) {
      setFile(''); e.target.value = '';
      C.setFieldError(box, 'PDF, JPG, PNG 파일만, 한 파일 50MB 이하로 올립니다.');
      return;
    }
    C.setFieldError(box, '');
    setFile(f ? f.name : '');
  });
  $('#demo-file').addEventListener('click', function () {
    C.setFieldError($('#f-file').closest('.field'), '');
    setFile(($('#f-counterparty').value || '거래처') + '_계약서_체결본.pdf');
  });
  // 체결본을 찾지 못함(4-1 5-3): 까닭 칸이 나타나고 꼭 적음. 파일 칸은 그대로 두되 고른 파일은 올리지 않음
  function syncNoFile() {
    const on = $('#f-no-file').checked;
    $('#no-file-field').hidden = !on;
    $('#f-file').disabled = on;
    $('#demo-file').disabled = on;
    if (on) setFile('');
  }
  $('#f-no-file').addEventListener('change', syncNoFile);
  /* (2026-11-14 주말 점검 W7) 예전 문서 결재일의 도움말: 처음 그릴 때 한 번 전환 날을 넣음(양식을 보이기 전이라 흔들리지 않고, 날짜를 골라도 줄이 늘지 않음)
   *   "전환 날 뒤"인지는 올리기 확인 창과 올린 기록에서 보임(막지 않음 [가정], 결정할것 W7-1) */
  $('#doc-date-help').textContent = '예전 전자결재에서 이 문서의 결재가 끝난 날입니다. ' + (cutover()
    ? '전환 날(' + C.fmtDate(cutover()) + ') 전이어야 합니다. 같거나 뒤이면 올리지 못하고 시스템에서 기안합니다.' // W7-1(2026-11-16)
    : '전환 날이 아직 정해지지 않아 견주지 않습니다.');

  /* ---------- 바로잡기: 앞 기록의 값을 채움 ---------- */
  if (fixSrc) {
    const L = fixSrc.legacy, f = fixSrc.form || {};
    $('#page-title').textContent = '예전 계약 기록 바로잡기';
    $('#fix-sec').hidden = false;
    $('#fix-desc').innerHTML = '<a href="legacy-contract.html?id=' + encodeURIComponent(fixSrc.id) + '">' + esc(fixSrc.id) + '</a>(' + esc(fixSrc.counterparty) + ')의 값을 채웠습니다. ' +
      '고친 뒤 올리면 새 번호로 남고, 앞 기록은 "바로잡힘"이 되어 목록과 원계약 고르기에서 빠집니다.';
    $('#btn-cancel').href = 'legacy-contract.html?id=' + encodeURIComponent(fixSrc.id);
    const check = function (name, v) { const r = document.querySelector('input[name="' + name + '"][value="' + v + '"]'); if (r) r.checked = true; };
    check('need', L.need);
    $('#f-need-note').value = L.note || '';
    pickCustomerByName(fixSrc.counterparty, f.bizNo);
    check('method', C.methodOf(fixSrc));
    (fixSrc.products || []).forEach(function (l) { addProduct(l); });
    check('settlement', f.settlement);
    $('#f-start').value = fixSrc.startDate || '';
    $('#f-end').value = fixSrc.endDate || '';
    check('autoRenew', fixSrc.autoRenew === 'YES' ? 'YES' : 'NO');
    $('#f-notice-days').value = fixSrc.noticeDays || '';
    check('personalData', fixSrc.personalData ? 'YES' : 'NO');
    check('sla', fixSrc.sla === 'YES' ? 'YES' : 'NO');
    $('#f-doc-no').value = L.docNo || '';
    $('#f-doc-date').value = L.docDate || ''; // (2026-11-14 주말 점검 W7) 앞 기록에 결재일이 없으면(칸을 두기 전 시연 기록) 비워 두고 새로 받음
    $('#f-doc-url').value = L.docUrl || '';
    if (L.file) setFile(L.file);
    else { $('#f-no-file').checked = true; syncNoFile(); $('#f-no-file-reason').value = L.noFile || ''; }
    $('#f-rep').value = C.salesRepOf(fixSrc) || fixSrc.requesterId || '';
    $('#f-restricted').checked = !!fixSrc.restricted;
    syncAuto();
  }
  if (!$$('#product-list > li').length) addProduct();

  /* ---------- 입력 검사 (KRDS 오류 패턴, 해지 기안과 같은 모양) ---------- */
  function setError(name, msg) { C.setFieldError(document.querySelector('[data-field="' + name + '"]'), msg); }
  // 고치는 칸의 오류는 고치는 대로 지움(계약 등록, 해지 기안과 같음). 파일 칸은 change 처리기가 정함
  function clearOne(e) {
    if (e.target.type === 'file') return;
    const box = e.target.closest('.product-item') || e.target.closest('[data-field]');
    if (box && box.classList.contains('is-invalid')) C.setFieldError(box, '');
  }
  $('#form').addEventListener('input', clearOne);
  $('#form').addEventListener('change', clearOne);
  const digits = function (x) { return String(x || '').replace(/[^0-9]/g, ''); };
  function validate() {
    const errors = [];
    function need(ok, name, msg, el) {
      if (ok) return;
      const box = document.querySelector('[data-field="' + name + '"]');
      if (box && !box.classList.contains('is-invalid')) C.setFieldError(box, msg);
      errors.push({ msg: msg, el: el || (box && box.querySelector('input:not([type="hidden"]):not([disabled]), select, textarea')) });
    }
    $$('[data-field].is-invalid, .product-item.is-invalid').forEach(function (b) { C.setFieldError(b, ''); });
    if (fixSrc) need(!!$('#f-fix-reason').value.trim(), 'fixReason', '바로잡는 까닭을 적으세요.');
    need(!!val('need'), 'need', '올리는 까닭이 된 일을 고르세요.');
    // 거래처: 고르거나 직접 입력. 직접 입력은 계약 등록과 같은 검사(상호, 번호 10자리, 검증 숫자, 거래처 목록과 DB 중복, 폐업)
    need(!!$('#f-customer').value, 'customer', '거래처를 검색해 고르세요. 검색 결과가 없으면 직접 입력합니다.', qInput);
    if ($('#f-customer').value === NEW_CUSTOMER) {
      const name = $('#f-counterparty').value.trim(), no = digits($('#f-bizno').value);
      need(!!name, 'counterparty', '거래처 상호를 넣으세요.');
      const sameName = name && D.CUSTOMERS.filter(function (cu) { return cu.name === name && !cu.mergedInto; })[0];
      if (sameName) need(false, 'counterparty', '같은 상호의 거래처가 이미 있습니다(' + sameName.id + '). 거래처 칸에서 검색해 고르세요.');
      const ten = /^\d{10}$/.test(no);
      need(ten, 'bizNo', '사업자등록번호 10자리를 넣으세요.');
      if (ten && !C.isUniqueNo(no)) need(C.isBizNo(no), 'bizNo', '사업자등록번호가 맞지 않습니다. 사업자등록증의 숫자를 다시 확인하세요.');
      const dupCu = D.CUSTOMERS.filter(function (cu) { return digits(cu.bizNo) === no; })[0];
      const inDb = D.BIZ_REGISTRY.filter(function (r) { return digits(r.bizNo) === no; })[0];
      if (ten && (dupCu || inDb)) need(false, 'bizNo', '이미 ' + (dupCu ? '거래처 목록' : '사업자 정보 DB') + '에 있는 번호입니다(' + (dupCu || inDb).name + '). 거래처 칸에서 검색해 고르세요.');
      if (ten) need(C.ntsStatus(no) !== 'CLOSED', 'bizNo', '국세청 조회 결과 폐업한 사업자입니다. 폐업한 곳의 계약은 올리지 않습니다.');
    }
    need(!!val('method'), 'method', '계약 방식을 고르세요.');
    // 제품 줄: 하나 이상, 줄마다 기능, 수량(1 이상), 금액(1원 이상). 금액이 없는 계약은 등록하지 않음(v0.41과 같음)
    const rows = readProducts();
    if (!rows.length) need(false, 'products', '제품을 1개 이상 넣으세요.', $('#btn-add-product'));
    rows.forEach(function (r) {
      const msg = !r.feature ? '제품과 기능을 고르세요.' : r.bad ? '수량과 금액은 숫자로만 넣습니다(쉼표는 괜찮음).' : !r.qty ? '수량을 1 이상으로 넣으세요.' : !r.amount ? '금액을 넣으세요.' : '';
      if (!msg) return;
      C.setFieldError(r.li, msg);
      errors.push({ msg: msg, el: !r.feature ? r.li.querySelector('select') : r.li.querySelector(!r.qty || r.bad ? '[data-k="qty"]' : '[data-k="amount"]') });
    });
    need(!!val('settlement'), 'settlement', '정산 방식을 고르세요.');
    // 계약 기간: 시작일, 종료일 필수. 종료일은 시작일 이후, 그리고 오늘 이후 [가정: 이미 끝난 예전 계약은 올리지 않고 새 계약으로 등록]
    const s = $('#f-start').value, e = $('#f-end').value;
    need(!!s, 'startDate', C.dateFieldError($('#f-start'), '계약 시작일을 고르세요.') || '계약 시작일을 고르세요.');
    need(!!e, 'endDate', C.dateFieldError($('#f-end'), '계약 종료일을 고르세요.') || '계약 종료일을 고르세요.');
    if (s && e) need(e >= s, 'endDate', '계약 종료일은 계약 시작일보다 앞설 수 없습니다.');
    if (e) need(e >= D.TODAY, 'endDate', '이미 끝난 계약(종료일 ' + C.fmtDate(e) + ')은 올리지 않습니다. 다시 맺으려면 새 계약으로 등록합니다.');
    need(!!val('autoRenew'), 'autoRenew', '자동갱신이 있는지 고르세요.');
    if (val('autoRenew') === 'YES') {
      const nd = parseNum($('#f-notice-days').value);
      need(!!nd && nd <= 365, 'noticeDays', '해지 통지 기한을 1~365일로 넣으세요.');
    }
    need(!!val('personalData'), 'personalData', '개인정보 처리위탁 계약이 있는지 고르세요.');
    need(!!val('sla'), 'sla', '서비스 수준 협약(SLA)이 있는지 고르세요.');
    // 예전 문서 번호: 필수, 바로잡히지 않은 다른 예전 기록과 같은 번호면 막음 [가정: 같은 계약을 두 번 올리지 않게]. 바로잡는 앞 기록의 번호는 됨
    const docNo = $('#f-doc-no').value.trim();
    need(!!docNo, 'docNo', '예전 문서 번호를 넣으세요.');
    const dupDoc = docNo && D.CONTRACTS.filter(function (c) {
      return c.legacy && c !== fixSrc && !C.legacyReplacedBy(c) && String(c.legacy.docNo || '').trim() === docNo;
    })[0];
    if (dupDoc) need(false, 'docNo', '이 예전 문서 번호로 올린 기록이 있습니다(' + dupDoc.id + '). 잘못 올렸으면 그 기록을 바로잡습니다.');
    // (2026-11-14 주말 점검 W7) 예전 문서 결재일: 필수, 오늘 뒤는 안 됨 [가정: 결재가 끝난 문서만 올림]. 전환 날 뒤여도 막지 않음 [가정, 결정할것 W7-1]
    const docDate = $('#f-doc-date').value;
    need(!!docDate, 'docDate', C.dateFieldError($('#f-doc-date'), '예전 문서 결재일을 고르세요.') || '예전 문서 결재일을 고르세요.');
    if (docDate) need(docDate <= D.TODAY, 'docDate', '예전 문서 결재일은 오늘(' + C.fmtDate(D.TODAY) + ')보다 뒤일 수 없습니다. 결재가 끝난 문서만 올립니다.');
    // 기획자 결정 2026-11-16(결정할것 새 결정 W7-1 (가)): 결재일이 전환 날과 같거나 뒤이면 올리지 못함(전환 날부터 맺는 계약은 시스템에서 기안).
    //   결정 13(전환 날 1주 전부터 예전 기안을 멈추고 모두 끝냄, 남은 건은 시스템에서 새로 기안)이라 전환 날 뒤에 끝난 예전 결재는 없음
    if (docDate && docDate <= D.TODAY && cutover()) need(docDate < cutover(), 'docDate', '예전 문서 결재일이 전환 날(' + C.fmtDate(cutover()) + ')과 같거나 뒤입니다. 전환 날부터 맺는 계약은 예전 계약 기록으로 올리지 못하고 시스템에서 기안합니다.');
    const url = $('#f-doc-url').value.trim();
    if (url) need(/^https:\/\/\S+$/.test(url), 'docUrl', '예전 문서 주소는 https://로 시작하는 주소로 넣으세요.');
    // 체결본(4-1 5-3): 파일이 있거나, 찾지 못함을 고르고 까닭을 적음
    if ($('#f-no-file').checked) need(!!$('#f-no-file-reason').value.trim(), 'noFile', '체결본을 찾지 못한 까닭을 적으세요.');
    else need(!!fileName, 'file', '체결본 파일을 고르세요. 찾지 못했으면 "체결본을 찾지 못함"을 고르고 까닭을 적습니다.', $('#f-file'));
    need(!!$('#f-rep').value, 'rep', '영업대표를 고르세요.');
    const box = $('#error-summary');
    box.hidden = !errors.length;
    if (errors.length) {
      box.innerHTML = '<p class="error-summary-title">' + C.icon('alert') + '입력하지 않았거나 고쳐야 할 항목이 ' + errors.length + '개 있습니다</p><ul>' +
        errors.map(function (x, i) { return '<li><a href="#" data-err="' + i + '">' + esc(x.msg) + '</a></li>'; }).join('') + '</ul>';
      box.onclick = function (ev) {
        const a = ev.target.closest('[data-err]');
        if (!a) return;
        ev.preventDefault();
        const el = errors[Number(a.dataset.err)].el;
        if (el) el.focus();
      };
      box.focus();
    }
    return !errors.length;
  }

  /* ---------- 올리기 확인 창과 저장 ---------- */
  const modal = $('#confirm-modal');
  let lastFocus = null;
  function closeModal() { modal.hidden = true; if (lastFocus) lastFocus.focus(); }
  $('#form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) return;
    const no = C.nextLegacyId();
    // (2026-11-14 주말 점검 W7) 예전 문서 결재일과 "전환 날 뒤"(막지 않음 [가정, 결정할것 W7-1]). 뒤이면 시스템 전에 맺은 계약만 올린다는 한 줄을 더함
    const dd = $('#f-doc-date').value, late = afterCutover({ legacy: { docDate: dd } });
    $('#confirm-body').innerHTML = '<p>올리면 결재 없이 계약 완료로 남고 고칠 수 없습니다. 올린 사람과 때는 관리자 변경 이력에 남습니다. ' +
      '체결 금액과 건수 통계에는 넣지 않고, 만료와 해지 통지 기한 알림은 다른 계약처럼 받습니다.</p>' +
      (late ? '<p>예전 문서 결재일이 전환 날(' + C.fmtDate(cutover()) + ')과 같거나 뒤라 이 기록에 "전환 날 뒤" 표시가 붙고 매월 확인에서 더 살핍니다. ' +
        '예전 계약 기록은 시스템 전에 맺은 계약만 올립니다.</p>' : '') +
      '<dl class="confirm-list"><div><dt>번호</dt><dd>' + esc(no) + '</dd></div>' +
      '<div><dt>거래처</dt><dd>' + esc($('#f-counterparty').value) + '</dd></div>' +
      '<div><dt>예전 문서</dt><dd>' + esc($('#f-doc-no').value.trim()) + ', 결재일 ' + C.fmtDate(dd) + (late ? ' ' + C.badge('attention', '전환 날 뒤') : '') + '</dd></div>' +
      '<div><dt>계약 기간</dt><dd>' + C.fmtPeriod($('#f-start').value, $('#f-end').value) + '</dd></div>' +
      '<div><dt>계약 금액</dt><dd class="amount">' + C.fmtWon(total()) + '</dd></div>' +
      '<div><dt>체결본</dt><dd>' + ($('#f-no-file').checked ? '없음(까닭을 적음)' : esc(fileName)) + '</dd></div>' +
      (fixSrc ? '<div><dt>바로잡는 기록</dt><dd>' + esc(fixSrc.id) + '</dd></div>' : '') + '</dl>';
    lastFocus = document.activeElement;
    modal.hidden = false;
    C.focusModal(modal);
  });
  modal.addEventListener('click', function (e) {
    if (e.target === modal || e.target.closest('[data-act="close"]')) closeModal();
    if (e.target.closest('[data-act="confirm"]')) save();
  });
  document.addEventListener('keydown', function (e) { if (!modal.hidden && e.key === 'Escape') closeModal(); });

  // 새 거래처를 거래처 목록에 등록: 계약 등록(new-contract.js registerCustomer)과 같은 길(C.adminSave의 CUSTOMER_ADD)
  function nextCustomerId() {
    const n = D.CUSTOMERS.reduce(function (m, cu) { return Math.max(m, Number(String(cu.id).replace(/\D/g, '')) || 0); }, 0) + 1;
    return 'C-' + String(n).padStart(4, '0');
  }
  function registerCustomer(no, at) {
    const key = $('#f-customer').value;
    const via = key === NEW_CUSTOMER ? 'MANUAL' : String(key).indexOf('R:') === 0 ? 'REGISTRY' : '';
    const bizNo = C.fmtBizNo($('#f-bizno').value), name = $('#f-counterparty').value.trim();
    if (!via || !name || !bizNo) return;
    if (D.CUSTOMERS.some(function (cu) { return digits(cu.bizNo) === digits(bizNo); })) return;
    const cu = { id: nextCustomerId(), name: name, bizNo: bizNo, use: true, registeredBy: me.id, registeredAt: at.slice(0, 10), registeredVia: via, registeredContractNo: no };
    C.adminSave('CUSTOMER', cu.name + '(' + cu.id + ')', '거래처 추가: ' + cu.bizNo + (via === 'MANUAL' ? ', 예전 계약 기록에서 직접 입력' : ', 예전 계약 기록에서 사업자 정보 DB로 고름'),
      // 열람 제한이면 사유에 기록 번호를 적지 않음(2026-11-14 주말 점검, 열람 제한 점검 leak-01, REQ-AUTH-09)
      ($('#f-restricted').checked ? '' : no + ' ') + '예전 계약 기록을 올리며 함께 등록', { k: 'CUSTOMER_ADD', cu: cu });
  }
  function save() {
    const no = C.nextLegacyId();
    const at = C.nowStamp().slice(0, 16);
    const rows = readProducts().filter(function (r) { return r.feature; });
    const services = [];
    rows.forEach(function (r) {
      const f = D.FEATURES.filter(function (x) { return x.id === r.feature; })[0];
      const p = f ? D.PRODUCTS.filter(function (x) { return x.id === f.product; })[0] : null;
      if (p && services.indexOf(p.service) < 0) services.push(p.service);
    });
    const noFile = $('#f-no-file').checked;
    const auto = val('autoRenew'), rep = $('#f-rep').value, pd = val('personalData');
    const needCode = val('need'), note = $('#f-need-note').value.trim(), fixReason = fixSrc ? $('#f-fix-reason').value.trim() : '';
    registerCustomer(no, at);
    // 예전 계약 기록 (03 데이터 정의서: contract의 legacy 칸들 제안). 기안일(requestedAt)과 결재 기록은 없음, 상태는 계약 완료
    const rec = {
      id: no, counterparty: $('#f-counterparty').value.trim(), services: services, kind: 'NEW',
      amount: rows.reduce(function (s, r) { return s + (r.amount || 0); }, 0), requesterId: rep,
      restricted: $('#f-restricted').checked, personalData: pd === 'YES', sla: val('sla'), status: 'ACTIVE',
      startDate: $('#f-start').value, endDate: $('#f-end').value, autoRenew: auto, noticeDays: auto === 'YES' ? parseNum($('#f-notice-days').value) : null,
      products: rows.map(function (r) { return { feature: r.feature, qty: r.qty, amount: r.amount }; }),
      form: { bizNo: C.fmtBizNo($('#f-bizno').value), method: val('method'), settlement: val('settlement'), personalData: pd, customerNew: $('#f-customer').value === NEW_CUSTOMER },
      // docDate: 예전 문서 결재일(2026-11-14 주말 점검 W7, 03 legacy_doc_date)
      legacy: { docNo: $('#f-doc-no').value.trim(), docDate: $('#f-doc-date').value, docUrl: $('#f-doc-url').value.trim(), file: noFile ? '' : fileName, noFile: noFile ? $('#f-no-file-reason').value.trim() : '',
        need: needCode, note: note, by: me.id, dept: me.dept || '', at: at, replaces: fixSrc ? fixSrc.id : null, fixReason: fixReason },
      history: [],
    };
    // 관리자 변경 이력(영역 LEGACY): 누가, 언제, 무엇을. 열람 제한이면 대상에 고객사 이름을 적지 않음(접속 기록과 같은 규칙)
    //   (2026-11-14 주말 점검 W7) 예전 문서 결재일과, 올릴 때 전환 날과 같거나 뒤였으면 "전환 날 뒤(전환 날 YYYY-MM-DD)"를 함께 남김(뒤에 전환 날을 바꿔도 그때 값이 남음)
    const change = '예전 계약 기록 올림: 예전 문서 ' + rec.legacy.docNo + ', 결재일 ' + C.fmtDate(rec.legacy.docDate) + (afterCutover(rec) ? ', 전환 날 뒤(전환 날 ' + C.fmtDate(cutover()) + ')' : '') +
      ', 계약 기간 ' + C.fmtDate(rec.startDate) + '~' + C.fmtDate(rec.endDate) + ', ' + C.fmtWon(rec.amount) +
      ', 체결본 ' + (noFile ? '없음' : '있음') + ', 영업대표 ' + C.ownerLabel(rep) + (fixSrc ? ', 앞 기록 ' + fixSrc.id + ' 바로잡음' : '');
    const reason = '생긴 일: ' + needLabel(needCode) + (note ? '. ' + note : '') + (noFile ? '. 체결본을 찾지 못한 까닭: ' + rec.legacy.noFile : '') + (fixSrc ? '. 바로잡는 까닭: ' + fixReason : '');
    const logged = C.adminSave('LEGACY', rec.restricted ? no : no + ' ' + rec.counterparty, change, reason, { k: 'LEGACY_ADD', id: no, replaces: rec.legacy.replaces });
    if (logged.refused) { closeModal(); return; } // 읽기만 하는 역할(화면이 이미 막지만 겹으로)
    C.saveDemoContract(rec);
    C.flash(no + ' 예전 계약 기록을 올렸습니다' + (fixSrc ? '(앞 기록 ' + fixSrc.id + ' 바로잡음)' : '') + '. 계약 상세에서 ' + needLabel(needCode) + ' 일을 기안할 수 있습니다.');
    location.href = 'legacy-contract.html?id=' + encodeURIComponent(no);
  }

  renderLists();
  $('#content').hidden = false;

  /* ---------- 4. 지금까지 올린 기록과 5. 매월 확인 ----------
   * 올리는 사람(위 양식 아래)과 보기만 하는 사람(양식 없이) 모두 이 함수로 그림. 함수 선언이라 위의 이른 return 앞에서도 부를 수 있음
   *   (위쪽 const만 씀. 아래 묶음의 상태는 위쪽 let selMonth, checkPage) */
  function renderLists() {
    // ?nofile=1이면 "체결본 없음"부터(개요의 컴플라이언스 줄에서 옴) (설계 검토 2026-11-11 답 ②)
    if (params.get('nofile') === '1') $('#f-nofile').value = 'NO';
    $('#f-nofile').addEventListener('change', renderList);
    renderList();
    // 매월 확인: ?month=가 있으면 그달, 없으면 확인을 기다리는 가장 오래된 달, 없으면 이달
    const q = params.get('month'), list = C.legacyMonths();
    const waiting = list.slice().reverse().filter(function (ym) { const s = C.legacyCheckState(ym); return !s.done && s.canCheck; })[0];
    selMonth = q && list.indexOf(q) > -1 ? q : waiting || list[0];
    // 보기만 하는 사람: 안내 끝에 한 줄(처음 그리기 전에 한 번이라 흔들리지 않음. 다른 매월 점검과 같은 모양)
    if (!canCheck) $('#months-desc').textContent += ' 보기만 합니다. 확인은 영업지원 리더가 남깁니다.';
    $('#f-month').addEventListener('change', function (e) { selMonth = e.target.value; refreshMonthly(); });
    $('#content').addEventListener('click', function (e) {
      const m = e.target.closest('[data-month]');
      // 보기: 달 표를 다시 그려 누른 단추가 없어지므로 초점과 화면을 아래 확인 제목으로(인장 기록 대조와 같음)
      if (m) { selMonth = m.getAttribute('data-month'); refreshMonthly(); C.focusSection('#sec-month-detail'); return; }
      if (e.target.closest('#btn-legacy-check')) { openCheck(); return; }
      const pg = e.target.closest('#check-pages [data-page]');
      if (pg && !pg.disabled) { checkPage = Number(pg.getAttribute('data-page')); renderCheckLog(); C.focusSection('#sec-check-log'); }
    });
    refreshMonthly();
  }
  function renderList() {
    const f = $('#f-nofile').value;
    const all = legacyRecords().filter(function (c) { return !f || (f === 'NO' ? !c.legacy.file : !!c.legacy.file); });
    $('#list').innerHTML = '<caption class="sr-only">지금까지 올린 예전 계약 기록: 번호, 고객사, 계약 기간, 체결본, 생긴 일, 올린 사람</caption>' +
      '<thead><tr><th scope="col">번호</th><th scope="col" class="col-phone-wide">고객사</th><th scope="col">계약 기간</th><th scope="col">체결본</th><th scope="col">생긴 일</th><th scope="col">올린 사람</th></tr></thead><tbody>' +
      (all.length ? all.map(function (c) {
        const visible = C.canView(c, me), gone = C.legacyReplacedBy(c);
        // (2026-11-14 주말 점검 W7) 번호 아래 작은 줄에 "전환 날 뒤"(바로잡힘과 같은 자리, 칸을 늘리지 않음. 열람 제한 기록도 표시는 보임, 날짜만이라 이름이 드러나지 않음)
        return '<tr><td class="nowrap"><a class="cell-title" href="legacy-contract.html?id=' + encodeURIComponent(c.id) + '">' + esc(c.id) + '</a>' +
            (gone ? '<span class="cell-meta">' + C.badge('neutral', '바로잡힘') + '</span>' : '') + (afterCutover(c) ? '<span class="cell-meta">' + cutoverBadge(c) + '</span>' : '') + '</td>' +
          '<td>' + (visible ? (gone ? esc(c.counterparty) : '<a href="contract.html?id=' + encodeURIComponent(c.id) + '">' + esc(c.counterparty) + '</a>') + '<span class="cell-sub">' + esc(C.serviceLabel(c.services)) + '</span>'
            : '<span class="cell-title is-masked">' + C.icon('lock', 'sm') + '열람 제한 계약</span>') + '</td>' +
          '<td class="num-left">' + (visible ? '<span class="nowrap">' + C.fmtDate(c.startDate) + '~</span><wbr><span class="nowrap">' + C.fmtDate(c.endDate) + '</span>' : '-') + '</td>' +
          // 체결본 없음은 찾지 못한 까닭을 작은 줄로(볼 수 있는 기록만) (설계 검토 2026-11-11 답 ②: 컴플라이언스가 함께 봄)
          '<td class="center">' + (c.legacy.file ? '있음' : C.badge('attention', '체결본 없음') + (visible && c.legacy.noFile ? '<span class="cell-meta">' + esc(c.legacy.noFile) + '</span>' : '')) + '</td>' +
          '<td class="center">' + esc(needLabel(c.legacy.need)) + '</td>' +
          '<td class="center">' + esc(C.ownerLabel(c.legacy.by, c.legacy.dept)) + '<span class="cell-meta">' + C.fmtDate(c.legacy.at) + '</span>' +
            // 확인 2(2026-11-16): 리더가 올린 기록은 컴플라이언스 확인 상태
            (C.legacyLeadOwn(c) ? '<span class="cell-meta">' + (C.legacyOwnCheckOf(c) ? '컴플라이언스 확인함' : C.badge('line', '컴플라이언스 확인 전')) + '</span>' : '') + '</td></tr>';
      }).join('') : '<tr><td class="empty-row" colspan="6">' + (f === 'NO' ? '체결본 없이 올린 기록이 없습니다.' : f ? '체결본을 붙여 올린 기록이 없습니다.' : '아직 올린 기록이 없습니다.') + '</td></tr>') + '</tbody>';
  }

  /* 5-1. 월별 확인: 대상 월, 기한(다음 달 말일), 올린 기록 수, 체결본 없음 수, 확인(결과, 누가 언제, 확인한 뒤 바뀜), 보기 */
  function resultBadge(e) { return C.badge(e.op.result === 'DIFF' ? 'attention' : 'success', RESULT[e.op.result] || e.op.result); } // 맞지 않음은 보라(주의), 다른 매월 점검과 같게
  function renderMonths() {
    $('#month-rows').innerHTML = C.legacyMonths().map(function (ym) {
      const s = C.legacyCheckState(ym), nf = s.recs.filter(function (c) { return !c.legacy.file; }).length;
      return '<tr' + (s.late ? ' class="is-alert"' : '') + '><td class="nowrap cell-strong">' + monthLabel(ym) + '</td>' +
        '<td class="num-left nowrap">' + C.fmtDate(s.due) + (s.late ? '<span class="cell-meta">기한 지남</span>' : '') + '</td>' +
        '<td class="num">' + s.recs.length + '건</td><td class="num">' + nf + '건</td>' +
        '<td>' + (s.last ? resultBadge(s.last) + '<span class="cell-meta">' + esc(C.ownerLabel(s.last.by, s.last.op.dept)) + ' ' + esc(C.fmtDateTime(s.last.at)) + '</span>' +
          (s.changed ? '<span class="cell-meta">' + C.badge('attention', '확인한 뒤 바뀜') + '</span>' : '') : C.badge('line', s.canCheck ? '확인 전' : '예정')) + '</td>' +
        '<td class="col-action"><button type="button" class="link-act" data-month="' + ym + '"' + (ym === selMonth ? ' aria-current="true"' : '') + '>보기<span class="sr-only"> ' + monthLabel(ym) + '</span></button></td></tr>';
    }).join('');
  }

  /* 5-2. 고른 달의 올린 기록과 확인 남기기 */
  // 최고관리자는 자기가 올린 기록이 든 달을 확인하지 못함(인장 기록 대조의 C-6과 같음). 그 달은 영업지원 리더가 남김
  function superOwn(recs) { return me.role === 'SUPER' && recs.some(function (c) { return c.legacy.by === me.id; }); }
  function renderDetail() {
    const s = C.legacyCheckState(selMonth);
    $('#sec-month-detail').textContent = monthLabel(selMonth) + ' 올린 기록 확인';
    const rows = s.recs.map(function (c) {
      const see = C.canView(c, me), gone = C.legacyReplacedBy(c), L = c.legacy;
      return '<tr><td class="nowrap"><a class="cell-title" href="legacy-contract.html?id=' + encodeURIComponent(c.id) + '">' + esc(c.id) + '</a>' +
          (gone ? '<span class="cell-meta">' + C.badge('neutral', '바로잡힘') + '</span>' : '') + (L.replaces ? '<span class="cell-meta">' + esc(L.replaces) + ' 바로잡음</span>' : '') + '</td>' +
        '<td>' + (see ? esc(c.counterparty) + '<span class="cell-meta">' + C.fmtPeriod(c.startDate, c.endDate) + '</span>'
          : '<span class="is-masked">' + C.icon('lock', 'sm') + '열람 제한 계약</span>') + '</td>' +
        '<td class="num">' + (see ? C.fmtWon(c.amount) : '-') + '</td>' + // 금액은 오른쪽(REQ-UI-16)
        // (2026-11-14 주말 점검 W7) 예전 문서 번호 아래 작은 줄에 결재일과 "전환 날 뒤"(칸을 늘리지 않음). 리더가 예전 문서를 열어 결재가 끝났음과 날을 맞춰 봄
        '<td class="center">' + esc(L.docNo || '-') + '<span class="cell-meta">결재일 ' + (L.docDate ? C.fmtDate(L.docDate) : '-') + '</span>' +
          (afterCutover(c) ? '<span class="cell-meta">' + cutoverBadge(c) + '</span>' : '') + '</td>' +
        '<td>' + (L.file ? (see ? esc(L.file) : '있음') : C.badge('attention', '체결본 없음') + (see && L.noFile ? '<span class="cell-meta">' + esc(L.noFile) + '</span>' : '')) + '</td>' +
        '<td class="center">' + esc(C.ownerLabel(L.by, L.dept)) + '<span class="cell-meta">' + esc(C.fmtDateTime(L.at)) + '</span></td></tr>';
    });
    const table = '<div class="tbl-scroll" tabindex="0" role="region" aria-label="그달 올린 기록 표"><table class="tbl tbl--compact">' +
      '<caption class="sr-only">' + monthLabel(selMonth) + ' 올린 기록: 번호, 고객사와 계약 기간, 계약 금액, 예전 문서 번호와 결재일, 체결본, 올린 사람</caption>' + // 결재일: 2026-11-14 주말 점검 W7
      '<thead><tr><th scope="col">번호</th><th scope="col" class="col-phone-wide">고객사</th><th scope="col" class="num">계약 금액</th><th scope="col">예전 문서 번호</th><th scope="col">체결본</th><th scope="col">올린 사람</th></tr></thead><tbody>' +
      (rows.length ? rows.join('') : '<tr><td class="empty-row" colspan="6">이 달에 올린 예전 계약 기록이 없습니다.</td></tr>') + '</tbody></table></div>';
    // 확인 줄: 마지막 확인, 또는 무엇을 언제까지 하는지. 남길 수 있으면 단추(줄 높이는 recon.css가 잡아 둠)
    let text;
    if (s.last) text = '마지막 확인: ' + (RESULT[s.last.op.result] || s.last.op.result) + ', ' + C.ownerLabel(s.last.by, s.last.op.dept) + ', ' + C.fmtDateTime(s.last.at) +
      (s.last.op.memo ? '. 메모: ' + (memoHidden(s.last) ? '그 기록을 볼 수 있는 사람만 봄(열람 제한)' : s.last.op.memo) : '') + (s.last.op.issueId ? '. 컴플라이언스에 넘김(' + s.last.op.issueId + ')' : '') +
      (s.changed ? '. 확인한 뒤 이 달에 올린 기록이 달라졌습니다. 다시 맞춰 보고 남겨 주세요.' : '');
    else if (!s.canCheck) text = '이달이 끝난 뒤 다음 달 말일(' + C.fmtDate(s.due) + ')까지 올린 기록이 없었음을 확인합니다. 그사이 기록을 올리면 바로 맞춰 볼 수 있습니다.';
    else if (!s.recs.length) text = '이 달에 올린 기록이 없습니다. "올린 기록 없음"으로 확인을 남깁니다. 기한 ' + C.fmtDate(s.due) + '.';
    // (2026-11-14 주말 점검 W7) 볼 것에 "예전 문서 번호로 열어 결재가 끝났음을 봄"을 더함
    else text = '올린 기록 ' + s.recs.length + '건을 체결본(없으면 예전 문서)과 맞춰 보고, 예전 문서 번호로 열어 결재가 끝났음을 본 뒤 확인을 남깁니다. 남기면 남긴 사람과 일시, 그때 본 기록이 함께 남고 고칠 수 없습니다. 기한 ' + C.fmtDate(s.due) + '.';
    const own = canCheck && s.canCheck && superOwn(s.recs);
    if (own) text += ' 최고관리자가 올린 기록이 든 달이라 확인은 영업지원 리더가 남깁니다.';
    const btn = canCheck && s.canCheck && !own ? '<button type="button" class="btn btn--primary btn--md" id="btn-legacy-check">' + (s.last ? '다시 확인 남기기' : '확인 남기기') + '</button>' : '';
    $('#month-detail').innerHTML = table + '<div class="recon-confirm"><p>' + esc(text) + '</p>' + btn + '</div>';
  }
  function openCheck() {
    const s = C.legacyCheckState(selMonth), ym = selMonth;
    if (!canCheck || !s.canCheck || superOwn(s.recs)) return;
    const none = !s.recs.length;
    const nofile = s.recs.filter(function (c) { return !c.legacy.file; }).length;
    const own = s.recs.filter(function (c) { return c.legacy.by === me.id; }).length; // 리더가 직접 올린 기록 수(직무 분리 [가정]: 막지 않고 남김)
    const keys = C.legacyKeys(s.recs);
    C.formModal({
      title: monthLabel(ym) + ' 예전 계약 기록 확인을 남길까요?',
      desc: '저장하면 남긴 사람과 일시, 그때 본 기록이 함께 남고 고칠 수 없습니다.',
      // 본 기록은 번호만(고객사는 넣지 않음, 열람 제한 계약 보호)
      // (2026-11-14 주말 점검 W7) 번호 뒤에 "(전환 날 뒤)"도 붙이고, 볼 것 한 줄(체결본과 맞음, 예전 문서 번호로 열어 결재가 끝났음)을 더함
      body: '<p class="modal-info">올린 기록 ' + s.recs.length + '건' + (s.recs.length ? ': ' + esc(s.recs.map(function (c) {
            return c.id + (c.legacy.file ? '' : '(체결본 없음)') + (afterCutover(c) ? '(전환 날 뒤)' : '');
          }).join(', ')) : '') +
          (own ? '<br>이 가운데 ' + own + '건은 본인이 올린 기록입니다. 확인 기록에 함께 남습니다.' : '') +
          // W7-1(2026-11-16): 결재일이 전환 날 전인지도 봄(전환 날을 바꿔 "전환 날 뒤"가 된 지난 기록은 번호 뒤에 표시)
          (none ? '' : '<br>볼 것: 체결본(없으면 예전 문서)과 기록이 맞음, 예전 문서 번호로 열어 결재가 끝났음을 봄(결재일도 맞음), 결재일이 전환 날' + (cutover() ? '(' + C.fmtDate(cutover()) + ')' : '') + ' 전임') + '</p>' +
        (none ? '<p class="modal-info">결과: ' + RESULT.NONE + '</p>'
          : '<fieldset class="field" data-field="result"><legend class="field-label">결과<span class="req" aria-hidden="true">*</span><span class="sr-only">(필수)</span></legend>' +
            '<div class="choice-row"><label class="choice"><input type="radio" name="result" value="MATCH">' + RESULT.MATCH + '</label>' +
            '<label class="choice"><input type="radio" name="result" value="DIFF">' + RESULT.DIFF + '</label></div><p class="field-error" hidden></p></fieldset>') +
        // 메모는 "맞지 않는 것이 있음"일 때만 필수. 처음엔 (선택), 고르면 필수 표시로(인장 기록 대조와 같음)
        C.fieldHtml({ name: 'memo', label: '메모', type: 'textarea', optional: true,
          // 컴플라이언스에 넘긴다는 안내(X.ISSUE_HELP)는 "맞지 않는 것이 있음"을 고를 수 있을 때만(올린 기록 없음은 넘길 것이 없음)
          help: none ? '예: 9월에 올린 예전 계약 기록이 없음을 목록으로 확인함.' : '맞지 않는 것이 있으면 꼭 적습니다. 예: LG-0002의 계약 종료일이 체결본과 다름, 올린 영업지원에게 바로잡는 기록을 요청함. ' + (X ? X.ISSUE_HELP : '') })
          .replace(' <span class="opt">', '<span class="req" aria-hidden="true" hidden>*</span><span class="sr-only req-sr" hidden>(필수)</span> <span class="opt">'),
      btn: '확인 저장',
      open: function (f) {
        const box = f.querySelector('[data-field="memo"]');
        const sync = function () {
          const r = f.querySelector('[name="result"]:checked'), need = !!(r && r.value === 'DIFF');
          box.querySelector('.req').hidden = !need;
          box.querySelector('.req-sr').hidden = !need;
          box.querySelector('.opt').hidden = need;
          if (!need) C.setFieldError(box, '');
        };
        f.querySelectorAll('[name="result"]').forEach(function (x) { x.addEventListener('change', sync); });
        sync();
      },
      check: function (f) {
        if (none) return {};
        const r = f.querySelector('[name="result"]:checked');
        return { result: r ? '' : '결과를 고르세요.', memo: r && r.value === 'DIFF' && !(f.elements.memo.value || '').trim() ? '맞지 않는 것과 한 일을 적으세요.' : '' };
      },
      done: function (f) {
        const result = none ? 'NONE' : f.querySelector('[name="result"]:checked').value, memo = (f.elements.memo.value || '').trim();
        // 맞지 않음이면 컴플라이언스에 넘김(다른 매월 점검과 같은 X.raiseIssue, 찾은 곳 LEGACY). 넘어온 일 번호를 확인 기록에도 남겨 둘을 이음
        const issue = result === 'DIFF' && X ? X.raiseIssue({ source: 'LEGACY', title: monthLabel(ym) + ' 예전 계약 기록 확인: 체결본과 맞지 않는 것이 있음',
          note: '리더의 확인 메모는 예전 계약 기록 화면의 확인 기록에서 봅니다(열람 권한대로)', href: 'legacy-contract.html?month=' + ym + '#sec-month-detail', ref: ym }) : null; // 2026-11-17 다른 눈 leak-records-02: 넘김 글에 메모(고객사 이름, 금액)를 넣지 않음
        const label = RESULT[result];
        const logged = C.adminSave('AUDIT', '예전 계약 기록 매월 확인: ' + monthLabel(ym),
          label + ': 올린 기록 ' + s.recs.length + '건' + (s.recs.length ? '(' + s.recs.map(function (c) { return c.id; }).join(', ') + ')' : '') + ', 체결본 없음 ' + nofile + '건' +
            (own ? ', 본인이 올린 기록 ' + own + '건' : '') + (issue ? ', 컴플라이언스에 넘김(' + issue.id + ')' : ''),
          memo || label, { k: 'LEGACY_CHECK', month: ym, result: result, memo: memo, dept: me.dept || '', seen: { n: s.recs.length, keys: keys, nofile: nofile, own: own }, issueId: issue ? issue.id : null });
        if (logged.refused) return;
        refreshMonthly();
        C.toast(monthLabel(ym) + ' 예전 계약 기록 확인을 남겼습니다.' + (X ? X.issueToast(issue) : ''));
      },
    });
  }

  /* 5-3. 확인 기록: 새것부터 20줄씩(일시, 대상 월, 결과, 본 건수, 메모, 남긴 사람) */
  function renderCheckLog() {
    const SIZE = 20, all = C.legacyChecks().slice().reverse();
    const pages = Math.max(1, Math.ceil(all.length / SIZE));
    checkPage = Math.min(checkPage, pages);
    const from = (checkPage - 1) * SIZE, rows = all.slice(from, from + SIZE);
    $('#check-rows').innerHTML = rows.length ? rows.map(function (e) {
      const seen = e.op.seen || {};
      return '<tr><td class="num-left">' + C.fmtDateTime(e.at).split(' ').map(function (x) { return '<span class="keep">' + x + '</span>'; }).join(' ') + '</td>' +
        '<td class="nowrap">' + monthLabel(e.op.month) + '</td><td class="nowrap">' + resultBadge(e) + '</td>' +
        '<td class="num">' + (seen.n || 0) + '건' + (seen.nofile ? '<span class="cell-meta">체결본 없음 ' + seen.nofile + '건</span>' : '') + (seen.own ? '<span class="cell-meta">본인이 올림 ' + seen.own + '건</span>' : '') + '</td>' +
        '<td class="col-text">' + (e.op.memo ? (memoHidden(e) ? '<span class="cell-meta">메모는 그 기록을 볼 수 있는 사람만 봄(열람 제한)</span>' : esc(e.op.memo)) : '<span class="recon-none">-</span>') + (e.op.issueId ? '<span class="cell-meta">컴플라이언스에 넘김(' + esc(e.op.issueId) + ')</span>' : '') + '</td>' +
        '<td class="center">' + esc(C.ownerLabel(e.by, e.op.dept)) + '</td></tr>';
    }).join('') : '<tr><td class="empty-row" colspan="6">아직 확인 기록이 없습니다.</td></tr>';
    $('#check-pages').innerHTML = C.pagerHtml(checkPage, pages, all.length, from, rows.length, SIZE, '건');
  }
  function refreshMonthly() {
    $('#f-month').innerHTML = C.legacyMonths().map(function (ym) { return '<option value="' + ym + '"' + (ym === selMonth ? ' selected' : '') + '>' + monthLabel(ym) + '</option>'; }).join('');
    renderMonths();
    renderDetail();
    renderCheckLog();
  }
})();
