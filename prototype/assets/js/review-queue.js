/* =====================================================================
 * SCR-21 검토 대기 화면 로직 (review-queue.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-DASH-05, REQ-STEP-04, REQ-REV-01, REQ-SIGN-07
 * 하는 일
 *   1. 내 차례인 단계를 모음: ②~⑤ 계약 검토와 ⑥ 인장 날인(총무), ⑧ 체결본 확인(영업지원) (v0.23)
 *      전자계약은 ⑥ 인증서 서명(영업지원)과 ⑧ 출력본 확인(⑥을 하지 않은 다른 영업지원) (설계 검토 2026-11-11 9번, 남은 것 ④)
 *      진행 중단의 ③ 진행 중단 확인(영업 리더), ⑥ 날인본 회수 확인(총무), ⑥ 전자계약 취소 확인(⑥에 서명한 영업지원) (7번, 답 ④)
 *      ③ 영업 임원 승인(기획자 결정 2026-11-02 E-3)과 ③ 만료 유예 확인(A-11, 줄을 누르면 계약 상세)도
 *      (최고관리자, 관리자는 모든 담당자 것을, 영업지원 리더와 정보보호 리더는 그 분야 담당자 것을 담당자 칸과 함께. v0.29)
 *   2. 검색, 단계, 서비스, 대기 기간으로 거르기. 오래 기다린 순서로 정렬
 *   3. 한 쪽에 20건씩 쪽 나누기 (화면이 A4 2장을 넘지 않게)
 *   4. 휴대폰에서는 요청자 칸을 감추고 고객사 아래 작은 줄에 씀 (기획자 결정 2026-11-02 D-9, PC는 그대로)
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const PAGE_SIZE = 20;
  const LONG = D.ALERT_RULES.approvalDelayDays;
  // 관리자가 바꾼 독촉 기준 일수를 안내와 거르기에 씀 (결재선 규칙의 독촉 기준, v0.63 점검에서 고침: 일수가 글자로 고정되어 있었음)
  document.querySelectorAll('[data-rule]').forEach(function (el) { el.textContent = D.ALERT_RULES[el.getAttribute('data-rule')]; });
  $('#f-wait').querySelector('option[value="LONG"]').textContent = LONG + '일 이상';
  // ⑦은 체결 대기, ⑨⑩은 운영 검토 대기에서
  //   기획자 결정 2026-11-02: ③ 영업 임원 승인(S03C, E-3)과 ③ 만료 유예 확인(SGR, A-11)도 단계 거르기에 보이게 적어 둠
  //   (설계 검토 2026-11-11 남은 것 ④) 진행 중단의 ③ 진행 중단 확인(SST), ⑥ 날인본 회수 확인(SSB, 총무), ⑥ 전자계약 취소 확인(SSE, 영업지원, 답 ④)도 거르기에.
  //     세 줄은 전에도 목록에 들어왔지만(common.js pendingQueue가 ②③, ⑥, ⑥⑧을 찾는 목록에 저절로 더함) 단계로 골라 볼 수 없었음.
  //     SSB와 SSE는 단계 코드가 따로라 거르기도 따로 둠 [가정: 처음에는 한 이름 "⑥ 날인본 회수 또는 전자계약 취소 확인"으로 묶으려 했음]. 단계 순서대로 ③ 다음, ⑥ 다음에 둠
  const QUEUE_STEPS = ['S02', 'S03', 'S03C', 'SGR', 'SST', 'S04', 'S05', 'S06', 'SSB', 'SSE', 'S08'];

  // 관리자 보기는 뺌(기획자 결정 2026-11-09: 관리자는 처리하지 않고, 이 화면은 관리자 메뉴에도 없었음). 최고관리자는 시연용으로 모두 봄
  const seeAll = me.role === 'SUPER';
  const lead = !seeAll && C.isLead(me);
  const showWho = seeAll || lead; // 담당자 칸을 보이는지
  // 재무는 영업지원이 기안한 계약의 ②, ⑧을 대신 검토 (REQ-AUTH-16, v0.58 QA)
  if (!seeAll && !C.hasRole(me, D.APPROVER_ROLES.concat(['GA', 'FINANCE']))) {
    $('#notice').innerHTML = C.noticeBox('', '검토 대기는 결재 역할과 총무가 씁니다',
      '지금은 ' + esc(C.roleLabel(me.role)) + ' 역할로 보고 있습니다. 진행 상황은 계약 현황 > 전체 진행 현황에서 볼 수 있습니다.');
    $('#list').hidden = true;
    return;
  }
  if (seeAll) $('#intro').textContent = '모든 담당자의 차례인 결재입니다(' + C.roleLabel(me.role) + ' 보기). 오래 기다린 순서로 보여 줍니다.';
  if (lead) $('#intro').textContent = C.roleLabel(me.base) + '의 차례를 모두 봅니다(' + C.roleLabel(me.role) + ' 보기). 처리는 담당자나 대리로 지정된 사람이 합니다.';

  // 내 차례 목록. 같은 계약에서 동시에 차례인 다른 단계도 알려 줌(④와 ⑤)
  const all = (lead ? C.areaQueue(me, QUEUE_STEPS) : C.pendingQueue(me, seeAll, QUEUE_STEPS)).map(function (x) {
    return { c: x.c, s: x.s, wait: C.waitDays(x.c, x.s) };
  }).sort(function (a, b) { return b.wait - a.wait; });
  /* 기획자 결정 2026-11-16(결정할것 새 결정 W3-2 (가)): 영업 리더(리더 본인 계약은 영업 임원)의 "영업대표 지정" 할 일(C.repTodo)도 검토 대기에 한 줄씩 둠.
   *   개요의 "지금 검토할 계약 n건"(결재 차례와 영업대표 지정을 더한 수)과 건수가 같아짐. 결재가 아닌 줄(③ 만료 유예 확인처럼)이 이미 있어 같은 모양
   *   단계 칸 "영업대표 지정", 누르면 계약 상세(영업대표 바꾸기 단추). 대기 칸은 "-" [가정: 영업대표가 맡을 수 없게 된 날을 따로 남기지 않음]. 맨 위에 둠
   *   최고관리자 보기는 넣지 않음(시연용 전체 보기는 결재 차례만) */
  const REP = 'REP';
  if (!seeAll) C.repTodo(me).forEach(function (b) { all.unshift({ c: b.root, s: { step: REP, userId: me.id }, rep: b, wait: -1 }); });

  /* ---------- 거르기 선택지 ---------- */
  function options(first, pairs) {
    return '<option value="">' + esc(first) + '</option>' + pairs.map(function (p) { return '<option value="' + p[0] + '">' + esc(p[1]) + '</option>'; }).join('');
  }
  // (설계 검토 2026-11-11 남은 것 ④) 체결 방식마다 이름이 다른 단계는 두 이름을 함께(C.stepAnyLabel): "⑥ 날인 또는 인증서 서명" [가정].
  //   나머지는 C.stepLabel 그대로("⑥ 날인본 회수 확인", "⑥ 전자계약 취소 확인"). 줄의 단계 칸은 그 계약의 이름(C.stepLabel(code, c))
  $('#f-step').innerHTML = options('전체 단계', QUEUE_STEPS.map(function (code) { return [code, C.stepAnyLabel(code)]; }).concat([[REP, '영업대표 지정']])); // W3-2(2026-11-16)
  $('#f-service').innerHTML = options('전체 서비스', Object.keys(D.SERVICES).map(function (k) { return [k, D.SERVICES[k]]; }));

  // 기획자 결정 2026-11-02 D-9: 휴대폰에서는 요청자 칸을 감춰(col-owner) 대기 일수가 첫 화면에 들게 함. 요청자는 고객사 아래 작은 줄로
  $('#thead').innerHTML = '<tr><th scope="col" class="col-customer">고객사</th><th scope="col" class="col-service">서비스</th><th scope="col">단계</th>' +
    (showWho ? '<th scope="col">담당자</th>' : '') + '<th scope="col" class="col-owner">요청자</th><th scope="col">기안일</th><th scope="col" class="col-wait">대기</th></tr>';

  // 기획자 결정 2026-11-02 D-3: 짧은 단계 이름은 처리하는 사람 이름으로("⑤ 정보보호"처럼). 계약마다 바뀌는 이름은 common.js stepTag가 정함
  const stepTag = C.stepTag;

  let page = 1;
  function filtered() {
    const q = $('#f-q').value.trim().toLowerCase();
    const step = $('#f-step').value, service = $('#f-service').value, wait = $('#f-wait').value;
    return all.filter(function (x) {
      // 볼 수 없는 계약은 고객사 이름이나 계약번호로 찾을 수 없게 함
      if (q && (!C.canView(x.c, me) || (x.c.counterparty.toLowerCase().indexOf(q) < 0 && String(x.c.id).toLowerCase().indexOf(q) < 0))) return false;
      if (step && x.s.step !== step) return false;
      // 서비스로 거를 때도 볼 수 없는 계약은 빼서, 거른 결과로 서비스가 드러나지 않게 함 (v0.62, 통제 목록 06 확인에서 찾음)
      if (service && (!C.canView(x.c, me) || (x.c.services || []).indexOf(service) < 0)) return false;
      if (wait === 'LONG' && x.wait < LONG) return false; // 영업대표 지정 줄(wait -1)은 빠짐
      return true;
    });
  }

  function render() {
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (page > pages) page = pages;
    const from = (page - 1) * PAGE_SIZE;
    const rows = list.slice(from, from + PAGE_SIZE);
    const long = list.filter(function (x) { return x.wait >= LONG; }).length; // 영업대표 지정 줄(-1)은 세지 않음
    $('#list-count').innerHTML = C.meta([[(list.length !== all.length ? '검색 결과' : '전체'), '<strong>' + list.length + '건</strong>'], [LONG + '일 이상', long + '건']]);
    const cols = showWho ? 7 : 6;
    $('#rows').innerHTML = rows.length ? rows.map(function (x) {
      const service = esc(C.serviceLabel(x.c.services));
      // 같은 계약에서 동시에 차례인 다른 단계 (④와 ⑤)
      const isRep = !!x.rep; // W3-2(2026-11-16): 영업대표 지정 줄
      const href = isRep ? 'contract.html?id=' + encodeURIComponent(x.rep.id) : C.turnHref(x.c, x.s);
      const together = isRep ? '' : C.pendingSteps(x.c).filter(function (o) { return o.step !== x.s.step; })
        .map(function (o) { return stepTag(o.step, x.c); }).join(', '); // 번호만으로는 무슨 단계인지 몰라 짧은 이름을 붙임(첫 사용 점검). D-3부터 처리하는 사람 이름
      // 휴대폰에서만 보이는 요청자 줄 (D-9). PC 요청자 칸처럼 가린 줄에도 보임
      const requester = '<span class="cell-sub">요청자 ' + esc(C.ownerLabel(x.c.requesterId)) + '</span>';
      return '<tr>' +
        // 리더가 보는 분야 전체 목록에는 볼 수 없는 열람 제한 계약도 있음: 고객사를 가림 (v0.58 QA)
        (C.canView(x.c, me)
          // 처리하는 화면으로: 결재 단계는 결재 문서, ③ 만료 유예 확인은 확인과 반려 단추가 있는 계약 상세(C.turnHref, 2026-11-02 A-11)
          ? '<td><a class="cell-title" href="' + href + '">' + esc(x.c.counterparty) + '</a>' +
            '<span class="cell-sub">' + service + '</span>' + requester + '<span class="cell-meta">' + esc(x.c.id) + (x.c.restricted ? ' ' + C.icon('lock', 'sm') : '') + '</span></td>'
          : '<td><span class="cell-title is-masked">' + C.icon('lock', 'sm') + '열람 제한 계약</span>' + requester +
            (isRep ? '<span class="cell-meta"><a href="' + href + '">영업대표 바꾸기</a></span>' : '') + '</td>') + // W3-1, W3-2: 가린 줄에서도 계약 상세의 바꾸기 단추로
        '<td class="col-service">' + (C.canView(x.c, me) ? service : '-') + '</td>' + // 가린 줄은 서비스도 가림 (v0.62)
        // 보류 중이면 배지(기획자 결정 2026-11-09: 결재하는 사람이 목록에서 바로 알게. 전체 진행 현황 progress.js와 같은 모양, REQ-CMP-04 ③)
        '<td class="nowrap">' + esc(isRep ? '영업대표 지정' : C.stepLabel(x.s.step, x.c)) + (isRep ? '<span class="cell-meta">' + esc(C.repNote(x.rep)) + '</span>' : '') + (C.holdOf(x.c) ? '<span class="cell-meta">' + C.holdBadge(C.holdOf(x.c)) + '</span>' : '') + (together ? '<span class="cell-meta">동시: ' + esc(together) + '</span>' : '') +
          // 대리 지정으로 내 차례가 된 건 (REQ-REV-08)
          (!showWho && x.s.userId !== me.id ? '<span class="cell-meta">' + esc(C.ownerLabel(x.s.userId)) + ' 대신 (대리 지정)</span>' : '') + '</td>' +
        (showWho ? '<td class="center">' + esc(C.ownerLabel(x.s.userId)) + '</td>' : '') +
        '<td class="center col-owner">' + esc(C.ownerLabel(x.c.requesterId)) + '</td>' + // 휴대폰에서는 감춤 (D-9)
        '<td class="num-left">' + C.fmtDate(x.c.requestedAt) + '</td>' +
        '<td class="num col-wait">' + (isRep ? '-' : '<span' + (x.wait >= LONG ? ' class="wait-long"' : '') + '>' + x.wait + '일</span>') + '</td>' +
      '</tr>';
    }).join('') : '<tr><td class="empty-row" colspan="' + cols + '">' + (all.length ? '조건에 맞는 건이 없습니다.' : '지금 차례인 결재가 없습니다.') + '</td></tr>';
    $('#pagination').innerHTML = C.pagerHtml(page, pages, list.length, from, rows.length, PAGE_SIZE, '건');
  }

  $('#filter').addEventListener('input', function () { page = 1; render(); });
  // 검색 칸은 'input'이 이미 그렸으므로 'change'(칸을 떠날 때)에서 다시 그리지 않음. 다시 그리면 누르던 줄이나 쪽 번호가 바뀌어 클릭이 사라짐(2026-11-06 점검 4회차)
  $('#filter').addEventListener('change', function (e) { if (e.target.matches('input[type=search], input[type=text]')) return; page = 1; render(); });
  $('#filter').addEventListener('reset', function () { setTimeout(function () { page = 1; render(); }, 0); });
  $('#filter').addEventListener('submit', function (e) { e.preventDefault(); });
  $('#pagination').addEventListener('click', function (e) {
    const b = e.target.closest('button[data-page]');
    if (!b || b.disabled) return;
    page = Number(b.getAttribute('data-page'));
    render();
    // 쪽 번호를 다시 그려 누른 단추가 없어지므로 초점을 목록 제목으로 옮기고 화면도 거기로(2026-11-06 점검 3회차)
    C.focusSection('#list-title');
  });
  render();
})();
