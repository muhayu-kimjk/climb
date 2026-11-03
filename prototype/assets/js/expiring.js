/* =====================================================================
 * SCR-43 만료 예정 계약 화면 로직 (expiring.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-FLOW-07, REQ-FLOW-20, REQ-FLOW-29, REQ-DASH-07, REQ-ENV-10, REQ-ARC-05~07
 * 하는 일
 *   1. 지금 유효한 계약이 90일 안에 끝나거나, 해지 통지 기한이 90일 안에 오는 묶음을 모음 (common.js expiringBundles)
 *      다음에 오는 날(지나지 않은 통지 기한, 아니면 만료일)이 가까운 순서. 영업은 내가 맡은 계약만, 그 외 역할은 모든 계약
 *   2. 자동갱신이면 해지 통지 기한(만료일 - 통지 일수)과 남은 날을 보여 주고, 30일 안이거나 지났으면 강조 (REQ-FLOW-32, v0.53)
 *      남은 기간 거르기는 만료일과 통지 기한 중 하나라도 그 안이면 보여 줌. "통지 기한 30일 이내"로 기한만 좁혀 봄(일수는 결재선 규칙 값, A-5)
 *      안내 문장의 해지 통지 기한 이메일 날도 결재선 규칙 값으로 채움(A-5). 그 유닛 리더는 가장 짧은 날에만(E-12)
 *      종료일이 지났어도 서비스를 닫기 전이면 영업대표에게 늦은 연장 단추(기획자 결정 2026-11-02 A-11)
 *   3. 할 일 버튼: 자동갱신이면 연장 검토, 아니면 연장 기안, 그리고 해지 기안
 *      진행 중인 연장, 해지가 있으면 버튼 대신 그 상태
 *      휴대폰은 고객사 아래에 같은 버튼을 두고 맨 끝 칸을 감춤(기획자 결정 2026-11-02 D-10). PC는 맨 끝 칸 그대로
 *   첫 칸 머리글은 "만료까지"(D-14, expiring.html). 순서는 다음에 오는 날 순서 그대로(A-1: 이 순서는 이 화면에서만)
 *   4. 기획자 결정 2026-11-02 A-10, A-11: 종료일이 지났는데 서비스를 닫기 전인 계약을 맨 위에 둠(종료일 순서)
 *      "만료, 서비스 닫기 전"(고객지원의 만료 처리 차례), "유예 중 (~기한)", "만료, 연장 진행 중". 첫 칸 배지는 지난 날수(D+n)
 *      할 일: 영업대표는 유예 요청(끝나기 30일 전부터, 만료 뒤에도), 영업 리더는 유예 확인과 반려, 고객지원은 만료 처리
 *      창과 처리 규칙은 common.js "만료 처리와 유예"(openGraceAsk, openGraceDecide, openExpiryClose). 처리하면 목록을 다시 그림
 *      서비스를 닫은 계약(만료 처리 끝)은 이 목록에서 빠짐. 계약 상세와 결재 문서의 결재 기록에 남음
 *   5. 기획자 결정 2026-11-02 C-16: 거래처나 묶음에 보류가 걸리면(C.holdOf) 진행 칸 맨 위에 "보류 중"과 사유.
 *      연장, 해지 기안 단추와 유예 확인 단추 대신 "보류 중이라 ... 할 수 없습니다" 한 줄. 유예 반려와 만료 처리는 그대로
 *      (흐린 단추 모양이 공통 스타일에 없어, 계약 상세의 "영업대표만 기안합니다"(D-5)처럼 단추 자리에 까닭을 씀)
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };

  const isSales = me.role === 'SALES';
  const WINDOW = D.ALERT_RULES.expiryWindowDays; // 만료 예정에 넣는 날수(90일)
  if (!isSales) $('#intro').textContent = WINDOW + '일 안에 끝나거나 해지 통지 기한이 오는 모든 계약과, 종료일이 지났는데 서비스를 닫기 전인 계약입니다(' + C.roleLabel(me.role) + ' 보기). 서비스를 닫기 전인 계약을 맨 위에, 그다음은 다음에 오는 날(통지 기한이나 만료일)이 가까운 순서로 보여 줍니다.';
  // 종료일이 지난 묶음 중 서비스를 닫기 전(만료 처리 차례, 유예 중)이거나 연장이 진행 중인 것 (기획자 결정 2026-11-02 A-10, A-11)
  //   처리하면 상태가 바뀌므로 그릴 때마다 다시 모음
  function collect() {
    const closing = C.bundles().filter(function (b) {
      const x = C.expiryOf(b);
      return !!x && x.ended && (x.state === 'OPEN' || x.state === 'GRACE' || (x.state === 'OFF' && x.block.status !== 'ACTIVE'));
    }).sort(function (a, b) { return a.end.localeCompare(b.end); });
    return closing.concat(C.expiringBundles(WINDOW, true)).filter(function (b) { return !isSales || C.isSalesRep(b, me); }); // 지금 영업대표(2026-11-03 C-44, 개요의 만료 임박과 같은 규칙)
  }
  const SOON = D.ALERT_RULES.noticeSoonDays;
  // 기획자 결정 2026-11-02 A-5, E-12: 해지 통지 기한의 강조 일수와 이메일 날은 결재선 규칙에서 바꾼 값(D.ALERT_RULES). 리더는 가장 짧은 날만
  const MAIL = D.ALERT_RULES.noticeMailDays || [];
  if (MAIL.length) {
    $('#notice-mail').textContent = MAIL.join('일 전과 ') + '일 전';
    $('#notice-last').textContent = Math.min.apply(null, MAIL) + '일 전';
  }
  $('#f-days').querySelector('option[value="notice"]').textContent = '통지 기한 ' + SOON + '일 이내';

  // 해지 통지 기한: 자동갱신 계약은 만료 며칠 전까지 상대방에게 알려야 연장을 막을 수 있음 (common.js noticeDate)
  const noticeDate = C.noticeDate;
  function noticeIn(b, days) { const n = noticeDate(b); return !!n && C.daysUntil(n) >= 0 && C.daysUntil(n) <= days; }
  function ended(b) { const x = C.expiryOf(b); return !!x && x.ended; }
  if (location.search.indexOf('view=notice') > -1) $('#f-days').value = 'notice'; // 개요의 "해지 통지 기한" 링크
  // 연장이나 해지 기안을 할 수 있는 사람: 영업대표 본인 (최고관리자는 시연용으로)
  //   기획자 결정 2026-11-03(C-44): 지금 영업대표(C.isSalesRep: 넘겨받은 새 영업대표, 맡을 수 없으면 대신 맡는 영업 리더). 처음 기안한 사람이 아님
  function canDraft(b) { return C.isSalesRep(b, me) || me.role === 'SUPER'; }

  // 만료 처리와 유예 단추 (A-10, A-11). 누가 무엇을 누를 수 있는지는 common.js가 정함
  //   기획자 결정 2026-11-02 C-16: 보류 중이면 유예 확인 단추를 빼고 유예 반려와 만료 처리만(유예 요청은 C.canAskGrace가 false)
  function expiryButtons(b) {
    const q = ' data-id="' + esc(b.id) + '"';
    return (C.canCloseExpiry(b, me) ? '<button type="button" class="btn btn--secondary" data-ex="close"' + q + '>만료 처리</button>' : '') +
      (C.canDecideGrace(b, me) ? (C.holdOf(b) ? '' : '<button type="button" class="btn btn--secondary" data-ex="ok"' + q + '>유예 확인</button>') +
        '<button type="button" class="btn btn--tertiary btn-reject" data-ex="no"' + q + '>유예 반려</button>' : '') +
      (C.canAskGrace(b, me) ? '<button type="button" class="btn btn--tertiary" data-ex="ask"' + q + '>유예 요청</button>' : '');
  }

  function render() {
    const all = collect();
    const q = $('#f-q').value.trim().toLowerCase();
    const view = $('#f-days').value, auto = $('#f-auto').value;
    const days = view === 'notice' || view === 'closing' ? 0 : Number(view);
    const list = all.filter(function (b) {
      const visible = C.canView(b.root, me);
      if (q && (!visible || (b.root.counterparty.toLowerCase().indexOf(q) < 0 && b.id.toLowerCase().indexOf(q) < 0))) return false;
      // 종료일이 지난 계약은 "서비스 닫기 전" 보기와 날수 보기에 늘 넣음(날짜가 지나 미룰 수 없는 일). 통지 기한 보기에는 넣지 않음
      if (view === 'closing') { if (!ended(b)) return false; }
      else if (view === 'notice') { if (ended(b) || !noticeIn(b, SOON)) return false; }
      else if (!ended(b) && C.daysUntil(b.end) > days && !noticeIn(b, days)) return false;
      if (auto && b.autoRenew !== auto) return false;
      return true;
    });
    const autoCount = list.filter(function (b) { return b.autoRenew === 'YES'; }).length;
    const soon = list.filter(function (b) { return !ended(b) && noticeIn(b, SOON); }).length;
    const late = list.filter(function (b) { const n = noticeDate(b); return !ended(b) && n && C.daysUntil(n) < 0; }).length;
    const closing = list.filter(function (b) { const x = C.expiryOf(b); return ended(b) && x.state !== 'OFF'; }).length;
    $('#list-count').innerHTML = C.meta([[(list.length !== all.length ? '검색 결과' : '전체'), '<strong>' + list.length + '건</strong>'],
      ['서비스 닫기 전', closing + '건'], ['자동갱신', autoCount + '건'], ['해지 통지 기한 ' + SOON + '일 이내', soon + '건'], ['통지 기한 지남', late + '건']]);
    $('#rows').innerHTML = list.length ? list.map(function (b) {
      const c = b.root;
      const visible = C.canView(c, me);
      const d = C.daysUntil(b.end);
      const x = C.expiryOf(b);
      const over = ended(b);
      const tone = over ? (x.tone || 'neutral') : C.ddayTone(d); // 30일 이내 Pink, 60일 이내 Purple, 그 외 Blue (REQ-DASH-07). 지난 계약은 만료 처리 상태의 색
      const autoCell = b.autoRenew === 'YES'
        ? '있음' + (noticeDate(b) && !over ? '<span class="cell-meta">' + C.noticeText(b, '통지 기한') + '</span>' : '')
        : '없음';
      // 진행 중인 연장, 해지 (변경은 만료와 상관없으므로 함께 보여 주기만 함)
      const open = b.open.map(function (o) { return C.kindLabel(o) + ' ' + D.STATUS[o.status].label; }).join(', ');
      // 만료 처리와 유예의 지금 상태(A-10, A-11): 지난 계약은 "만료, 서비스 닫기 전"처럼 글자로, 끝나기 전에도 요청 중이거나 확인된 유예는 한 줄
      const exText = (over ? C.badge(x.tone || 'neutral', x.label) : '') + (x && x.note ? '<span class="cell-meta">' + esc(x.note) + '</span>' : '');
      // 기획자 결정 2026-11-02 C-16: 거래처나 묶음에 걸린 보류는 진행 칸 맨 위에 "보류 중"과 사유(볼 수 있는 계약만)
      const hold = visible ? C.holdOf(b) : null;
      const holdHtml = hold ? C.holdBadge(hold) + '<span class="cell-meta">' + esc(hold.reason) + '</span>' : '';
      const doing = (holdHtml + exText + (open ? (exText || holdHtml ? '<span class="cell-meta">' + esc(open) + '</span>' : esc(open)) : '')) || '-';
      const blocking = b.open.some(function (o) { return o.kind === 'RENEW' || o.kind === 'TERMINATE'; });
      const periodBusy = b.open.some(function (o) { return o.kind === 'CHANGE' && o.changeType === 'PERIOD'; }); // 기간 변경 중에는 연장 버튼 없음 (v0.58)
      // 반려된 연장, 해지: 같은 종류의 새 기안 대신 그 기안을 보완 후 재기안 (v0.58)
      const rejRenew = b.rejected.filter(function (o) { return o.kind === 'RENEW'; })[0];
      const rejEnd = b.rejected.filter(function (o) { return o.kind === 'TERMINATE'; })[0];
      let draft = '';
      // 연장, 해지 기안은 지금 유효한 계약이 계약 완료일 때만(종료일이 지난 계약은 만료 처리나 유예로, 서비스를 닫기 전이면 늦은 연장도 아래)
      if (visible && canDraft(b) && !blocking && !over) {
        draft = (periodBusy ? '' : rejRenew ? '<a class="btn btn--secondary" href="' + C.resubmitHref(rejRenew) + '">연장 보완 후 재기안</a>' : b.autoRenew === 'YES'
            ? '<a class="btn btn--secondary" href="renewal.html?origin=' + encodeURIComponent(b.id) + '">연장 검토</a>'
            : '<a class="btn btn--secondary" href="new-contract.html?kind=RENEW&origin=' + encodeURIComponent(b.id) + '">연장 기안</a>') +
          (rejEnd ? '<a class="btn btn--tertiary" href="' + C.resubmitHref(rejEnd) + '">해지 보완 후 재기안</a>'
            : '<a class="btn btn--tertiary btn-reject" href="terminate.html?origin=' + encodeURIComponent(b.id) + '">해지 기안</a>');
      } else if (visible && canDraft(b) && !blocking && over && (x.state === 'OPEN' || x.state === 'GRACE')) {
        // 기획자 결정 2026-11-02 A-11: 서비스를 닫기 전(만료 처리 차례, 유예 중)이면 늦은 연장 기안. 계약 상세, 계약 등록, 연장 검토와 같은 규칙. 해지는 없음
        draft = rejRenew ? '<a class="btn btn--secondary" href="' + C.resubmitHref(rejRenew) + '">연장 보완 후 재기안</a>'
          : '<a class="btn btn--secondary" href="' + (b.autoRenew === 'YES' ? 'renewal.html?origin=' : 'new-contract.html?kind=RENEW&origin=') + encodeURIComponent(b.id) + '">' + (b.autoRenew === 'YES' ? '연장 검토' : '연장 기안') + '</a>';
      }
      // 보류 중(C-16)에는 연장, 해지 기안 단추 대신 까닭 한 줄. 유예 확인을 할 사람에게도 같은 줄(유예 반려와 만료 처리 단추는 그대로)
      const holdMsg = hold && (draft || C.canDecideGrace(b, me)) ? '<span class="cell-meta">보류 중이라 ' + (draft ? '기안할 수 없습니다.' : '유예를 확인할 수 없습니다.') + '</span>' : '';
      if (hold) draft = '';
      const acts = (visible ? expiryButtons(b) : '') + draft;
      const todo = acts || holdMsg ? (acts ? '<div class="row-actions">' + acts + '</div>' : '') + holdMsg : '-';
      // 기획자 결정 2026-11-02 D-10(C-41 ⑨): 휴대폰은 할 일 단추를 고객사 아래에 함께 둠(표를 끝까지 밀지 않아도 보이게)
      //   .cell-sub라 PC에서는 감춰지고, 휴대폰에서는 맨 끝 할 일 칸(col-todo)을 감춤(list.css 끝). 버튼이 없으면 줄도 두지 않음
      const cust = visible
        ? '<a class="cell-title" href="contract.html?id=' + encodeURIComponent(b.id) + '">' + esc(c.counterparty) + '</a>' +
          '<span class="cell-sub">' + esc(C.serviceLabel(c.services)) + '</span><span class="cell-meta">' + esc(b.current.id) + '</span>' +
          (todo !== '-' ? '<div class="cell-sub cell-acts">' + todo + '</div>' : '')
        : '<span class="cell-title is-masked">' + C.icon('lock', 'sm') + '열람 제한 계약</span>';
      return '<tr>' +
        // 만료까지 남은 일자(D-n)는 날짜에 딸린 값이라 가운데 (v0.55 기획자 요청, REQ-UI-16). 머리글 "만료까지"(D-14)
        //   종료일이 지난 계약은 지난 날수(D+n, A-10)
        '<td class="center">' + (over
          ? '<span class="badge badge--' + tone + '" aria-label="만료 ' + (-d) + '일 지남">D+' + (-d) + '</span>'
          : '<span class="badge badge--' + tone + '" aria-label="만료까지 ' + d + '일">D-' + d + '</span>') + '</td>' +
        '<td>' + cust + '</td>' +
        // 휴대폰은 담당자 칸을 감추고 만료일 아래에 담당을 보임(개요의 만료 임박과 같게, v0.63 점검에서 고침: 휴대폰에서 담당자가 사라졌음)
        //   담당 줄은 휴대폰에서 줄을 바꿀 수 있게(col-expiry), 날짜는 하이픈에서 끊기지 않게 (v0.63 검토)
        '<td class="num-left col-expiry"><span class="nowrap">' + C.fmtDate(b.end) + '</span>' + (visible ? '<span class="cell-sub">담당 ' + esc(C.ownerLabel(C.salesRepOf(b))) + '</span>' : '') + '</td>' +
        '<td>' + autoCell + '</td>' +
        '<td>' + (visible ? doing : '-') + '</td>' +
        // 담당은 지금 영업대표(2026-11-03 C-44). 맡을 수 없어 영업 리더가 맡는 중이면 작은 줄(볼 수 있는 계약만)
        '<td class="center col-owner">' + esc(C.ownerLabel(C.salesRepOf(b))) + (visible && C.repNote(b) ? '<span class="cell-meta">' + esc(C.repNote(b)) + '</span>' : '') + '</td>' +
        '<td class="nowrap col-todo">' + todo + '</td>' + // 휴대폰에서는 감춤(D-10, 위 고객사 아래 버튼)
      '</tr>';
    }).join('') : '<tr><td class="empty-row" colspan="7">' + (all.length ? '조건에 맞는 계약이 없습니다.' : WINDOW + '일 안에 끝나거나 해지 통지 기한이 오는 계약, 서비스를 닫기 전인 계약이 없습니다.') + '</td></tr>';
  }

  // 만료 처리와 유예 단추: 같은 단추가 PC 할 일 칸과 휴대폰 고객사 아래에 둘 다 있어 표 전체에서 받음
  $('#rows').addEventListener('click', function (e) {
    const btn = e.target.closest('[data-ex]');
    if (!btn) return;
    const b = C.bundleOf(btn.getAttribute('data-id'));
    if (!b) return;
    const act = btn.getAttribute('data-ex');
    if (act === 'close') C.openExpiryClose(b, me, render);
    else if (act === 'ask') C.openGraceAsk(b, me, render);
    else C.openGraceDecide(b, me, act === 'ok', render);
  });
  $('#filter').addEventListener('input', render);
  $('#filter').addEventListener('change', render);
  $('#filter').addEventListener('reset', function () { setTimeout(render, 0); });
  $('#filter').addEventListener('submit', function (e) { e.preventDefault(); });
  render();
})();
