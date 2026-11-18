/* =====================================================================
 * SCR-20 전체 진행 현황 화면 로직 (progress.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-FLOW-03~05, REQ-AUTH-09, REQ-REV-07
 * 하는 일
 *   1. 아직 끝나지 않은 계약(검토 중, 반려, 체결 대기, 운영 검토)을 모음. 오래된 기안부터
 *   2. 검색, 상태, 서비스, 영업대표로 거르기 (?status=REVIEW 또는 ?status=OPS_REVIEW로 미리 거름)
 *      유닛 거르기(설계 검토 2026-11-11 10번): 지금 영업대표의 유닛, 기본은 전체. ?unit=으로 미리 거름(개요 영업 리더의 내 유닛)
 *   3. 열람 제한 계약은 볼 수 없는 사람에게 가림. 한 쪽에 20건
 *   4. 보류가 걸린 계약은 상태 칸 아래에 "보류 중" 배지 (기획자 결정 2026-11-02 C-16)
 *   5. 진행 중단(설계 검토 2026-11-11 7번): 진행 중단(STOPPED)은 끝난 계약이라 이 목록에 없음(전체 계약에서 봄).
 *      진행 중단 요청 중인 계약은 그 상태 그대로 있고 상태 아래에 "중단 요청 중", 현재 진행은 "③ 진행 중단 확인"이나 "⑥ 날인본 회수 확인"(C.progressCells)
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const PAGE_SIZE = 20;
  // 안내 글의 독촉 기준 일수: 결재선 규칙(SCR-52)에서 바꾼 값을 씀 (첫 사용 점검: 대기 칸 강조의 뜻이 안내에 없었음)
  document.querySelectorAll('[data-rule]').forEach(function (el) { el.textContent = D.ALERT_RULES[el.getAttribute('data-rule')]; });
  const OPEN = ['IN_REVIEW', 'SUPPLEMENT', 'REJECTED', 'APPROVED', 'OPS_REVIEW']; // 보완 중(v0.26)도 진행 중

  const all = D.CONTRACTS.filter(function (c) { return OPEN.indexOf(c.status) > -1; })
    .sort(function (a, b) { return a.requestedAt.localeCompare(b.requestedAt); });

  function options(first, pairs) {
    return '<option value="">' + esc(first) + '</option>' + pairs.map(function (p) { return '<option value="' + p[0] + '">' + esc(p[1]) + '</option>'; }).join('');
  }
  // 상태: REVIEW는 검토 중과 반려를 함께 (개요의 '계약 검토' 단계와 같은 범위)
  $('#f-status').innerHTML = options('전체 상태', [['REVIEW', '검토 중, 보완 중, 반려']].concat(OPEN.map(function (k) { return [k, D.STATUS[k].label]; })));
  $('#f-service').innerHTML = options('전체 서비스', Object.keys(D.SERVICES).map(function (k) { return [k, D.SERVICES[k]]; }));
  // 기획자 결정 2026-11-03(C-44): 영업대표 거르기는 처음 기안한 사람과 지금 영업대표(C.salesRepOf, 넘겨받은 새 영업대표) 둘 다. 개요의 진행 현황 수(?owner=)와 같은 범위
  const owners = all.map(function (c) { return c.requesterId; }).concat(all.map(function (c) { return C.salesRepOf(c); })).filter(function (v, i, a) { return v && a.indexOf(v) === i; });
  $('#f-owner').innerHTML = options('전체', owners.map(function (u) { return [u, C.ownerLabel(u)]; }));
  const params = new URLSearchParams(location.search);
  const preset = params.get('status');
  // 2026-11-06 점검: 목록에 있는 값일 때만 미리 고름(전체 계약, 내 등록 목록과 같게). 없는 값이면 고른 칸이 비어 보이고 목록도 비었음
  if (Array.prototype.some.call($('#f-status').options, function (o) { return o.value && o.value === preset; })) $('#f-status').value = preset;
  // 개요에서 영업이 누르면 나로 거름 (v0.58 QA)
  //   진행 중인 계약이 없는 영업도 나로 거름(빈 목록). 예전에는 다른 사람 계약이 모두 보였음 (v0.63 점검에서 고침)
  if (params.get('owner') && params.get('owner') === me.id && owners.indexOf(me.id) < 0) {
    $('#f-owner').insertAdjacentHTML('beforeend', '<option value="' + esc(me.id) + '">' + esc(C.ownerLabel(me.id)) + '</option>');
    owners.push(me.id);
  }
  if (owners.indexOf(params.get('owner')) > -1) $('#f-owner').value = params.get('owner');
  // 설계 검토 2026-11-11 10번: 유닛 거르기. 거르는 유닛은 지금 영업대표의 조직(C.repUnitOf [가정], 데이터 정의서의 "계약의 유닛" sales_team과 다름). 기본은 전체 유닛
  //   모두가 모든 진행 중 계약을 보는 화면이라 모든 역할에 보임(영업 임원도 아무 유닛이나 고름). 개요의 영업 리더 "내 유닛"에서 오면 ?unit=으로 미리 거름
  //   값은 영업 유닛과 이 목록에만 있는 유닛(C.unitChoices). 목록에 있는 값일 때만 미리 고름(상태 거르기와 같게)
  const units = C.unitChoices(all);
  $('#f-unit').innerHTML = options('전체 유닛', units.map(function (u) { return [esc(u), u]; }));
  if (units.indexOf(params.get('unit')) > -1) $('#f-unit').value = params.get('unit');
  if (params.get('acc') === '1') $('#f-acc').checked = true; // W3-8(2026-11-16)

  let page = 1;
  function filtered() {
    const q = $('#f-q').value.trim().toLowerCase();
    const status = $('#f-status').value, service = $('#f-service').value, owner = $('#f-owner').value, unit = $('#f-unit').value;
    return all.filter(function (c) {
      // 유닛(설계 검토 2026-11-11 10번): 영업대표 칸처럼 열람 제한 계약에도 적용(영업대표 이름은 가리지 않으므로 유닛으로 드러나는 것이 없음)
      if (unit && C.repUnitOf(c) !== unit) return false;
      const visible = C.canView(c, me);
      // 볼 수 없는 계약은 고객사 이름으로 찾을 수 없게 함
      if (q && (!visible || (c.counterparty.toLowerCase().indexOf(q) < 0 && String(c.id).toLowerCase().indexOf(q) < 0))) return false;
      if (status === 'REVIEW' ? ['IN_REVIEW', 'SUPPLEMENT', 'REJECTED'].indexOf(c.status) < 0 : status && c.status !== status) return false;
      if (service && (!visible || (c.services || []).indexOf(service) < 0)) return false;
      if (owner && c.requesterId !== owner && C.salesRepOf(c) !== owner) return false; // 처음 기안한 사람이나 지금 영업대표(C-44)
      // W3-8(2026-11-16): 체크리스트 4번 회계 영향 조건이 예인 계약만. 볼 수 없는 계약은 빼서 거른 결과로 내용이 드러나지 않게
      if ($('#f-acc').checked && (!visible || (c.checklist || {}).accounting !== 'YES')) return false;
      return true;
    });
  }

  function render() {
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (page > pages) page = pages;
    const from = (page - 1) * PAGE_SIZE;
    const rows = list.slice(from, from + PAGE_SIZE);
    const count = function (s) { return list.filter(function (c) { return c.status === s; }).length; };
    $('#list-count').innerHTML = C.meta([[(list.length !== all.length ? '검색 결과' : '전체'), '<strong>' + list.length + '건</strong>']].concat(OPEN.map(function (s) {
      return [esc(D.STATUS[s].label), count(s) + '건'];
    })));
    $('#rows').innerHTML = rows.length ? rows.map(function (c) {
      const visible = C.canView(c, me);
      const service = esc(C.serviceLabel(c.services));
      const cust = visible
        ? '<a class="cell-title" href="review.html?id=' + encodeURIComponent(c.id) + '">' + esc(c.counterparty) + '</a>' +
          '<span class="cell-sub">' + service + '</span><span class="cell-meta">' + esc(c.id) + (c.restricted ? ' ' + C.icon('lock', 'sm') : '') + '</span>'
        : '<span class="cell-title is-masked">' + C.icon('lock', 'sm') + '열람 제한 계약</span>';
      return '<tr' + (c.status === 'REJECTED' ? ' class="is-alert"' : '') + '>' +
        '<td>' + cust + '</td>' +
        '<td class="col-service">' + (visible ? service : '-') + '</td>' +
        // 기획자 결정 2026-11-02 C-16: 보류가 걸린 계약은 상태 아래에 "보류 중" 배지(남은 결재의 승인이 막힘. 사유는 결재 문서에서)
        '<td class="nowrap">' + C.statusBadge(c) + (C.holdOf(c) ? '<span class="cell-meta">' + C.holdBadge(C.holdOf(c)) + '</span>' : '') +
          (C.stopPending(c) ? '<span class="cell-meta">' + C.stopBadge(c) + '</span>' : '') +
          (c.lateEntry ? '<span class="cell-meta">' + C.lateBadge(c) + '</span>' : '') + '</td>' + // W7-7(2026-11-16) 사후 등록 // (설계 검토 2026-11-11 7번) 진행 중단 요청 중이면 "중단 요청 중"(상태는 그대로)
        C.progressCells(c) + // 현재 진행(단계) + 대기(날수) 두 칸 (v0.55)
        // 영업대표는 지금 영업대표(C-44). 바뀌었으면 작은 줄에 처음 기안한 사람(계약 상세와 같음)
        '<td class="center">' + esc(C.ownerLabel(C.salesRepOf(c))) + (C.salesRepOf(c) !== c.requesterId ? '<span class="cell-meta">처음 기안 ' + esc(C.ownerLabel(c.requesterId)) + '</span>' : '') + '</td>' +
        '<td class="num-left nowrap">' + C.fmtDate(c.requestedAt) + '</td>' + // 날짜는 한 줄 (첫 사용 점검: 하이픈에서 끊겼음)
      '</tr>';
    }).join('') : '<tr><td class="empty-row" colspan="7">' + (all.length ? '조건에 맞는 계약이 없습니다.' : '진행 중인 계약이 없습니다.') + '</td></tr>'; // 아예 없을 때와 거르기로 빠졌을 때를 나눔(2026-11-06 점검, 내 등록 목록과 같게)
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
