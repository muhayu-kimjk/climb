/* =====================================================================
 * SCR-43 만료 예정 계약 화면 로직 (expiring.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-FLOW-07, REQ-FLOW-20, REQ-FLOW-29, REQ-DASH-07, REQ-ENV-10, REQ-ARC-05~07
 * 하는 일
 *   1. 지금 유효한 계약이 90일 안에 끝나는 묶음을 모음 (common.js expiringBundles). 만료일이 가까운 순서
 *      영업은 내가 맡은 계약만, 그 외 역할은 모든 계약
 *   2. 자동갱신이면 해지 통지 기한(만료일 - 통지 일수)을 보여 주고, 지났으면 강조
 *   3. 할 일 버튼: 자동갱신이면 연장 검토, 아니면 연장 기안, 그리고 해지 기안
 *      진행 중인 연장, 해지가 있으면 버튼 대신 그 상태
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };

  const isSales = me.role === 'SALES';
  if (!isSales) $('#intro').textContent = '90일 안에 끝나는 모든 계약입니다(' + C.roleLabel(me.role) + ' 보기). 만료일이 가까운 순서로 보여 줍니다.';
  const all = C.expiringBundles(90).filter(function (b) { return !isSales || b.root.requesterId === me.id; });

  // 해지 통지 기한: 자동갱신 계약은 만료 며칠 전까지 상대방에게 알려야 연장을 막을 수 있음
  function noticeDate(b) {
    if (b.autoRenew !== 'YES' || !b.noticeDays) return null;
    const d = new Date(b.end.replace(/-/g, '/'));
    d.setDate(d.getDate() - b.noticeDays);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  // 연장이나 해지 기안을 할 수 있는 사람: 영업대표 본인 (최고관리자는 시연용으로)
  function canDraft(b) { return b.root.requesterId === me.id || me.role === 'SUPER'; }

  function render() {
    const q = $('#f-q').value.trim().toLowerCase();
    const days = Number($('#f-days').value), auto = $('#f-auto').value;
    const list = all.filter(function (b) {
      const visible = C.canView(b.root, me);
      if (q && (!visible || (b.root.counterparty.toLowerCase().indexOf(q) < 0 && b.id.toLowerCase().indexOf(q) < 0))) return false;
      if (C.daysUntil(b.end) > days) return false;
      if (auto && b.autoRenew !== auto) return false;
      return true;
    });
    const autoCount = list.filter(function (b) { return b.autoRenew === 'YES'; }).length;
    const late = list.filter(function (b) { const n = noticeDate(b); return n && C.daysUntil(n) < 0; }).length;
    $('#list-count').innerHTML = C.meta(['<strong>' + (list.length !== all.length ? '검색 결과 ' : '전체 ') + list.length + '건</strong>',
      '자동갱신 ' + autoCount + '건', '해지 통지 기한 지남 ' + late + '건']);
    $('#rows').innerHTML = list.length ? list.map(function (b) {
      const c = b.root;
      const visible = C.canView(c, me);
      const d = C.daysUntil(b.end);
      // D-day 배지: 30일 이내 Pink, 60일 이내 Purple, 그 외 Blue (REQ-DASH-07)
      const tone = d <= 30 ? 'danger' : d <= 60 ? 'attention' : 'progress';
      const cust = visible
        ? '<a class="cell-title" href="contract.html?id=' + encodeURIComponent(b.id) + '">' + esc(c.counterparty) + '</a>' +
          '<span class="cell-sub">' + esc(C.serviceLabel(c.services)) + '</span><span class="cell-meta">' + esc(b.current.id) + '</span>'
        : '<span class="cell-title is-masked">' + C.icon('lock', 'sm') + '열람 제한 계약</span>';
      const n = noticeDate(b);
      const autoCell = b.autoRenew === 'YES'
        ? '있음' + (n ? '<span class="cell-meta">' + (C.daysUntil(n) < 0 ? '<span class="wait-long">통지 기한 지남</span> ' : '통지 기한 ') + C.fmtDate(n) + '</span>' : '')
        : '없음';
      // 진행 중인 연장, 해지 (변경은 만료와 상관없으므로 함께 보여 주기만 함)
      const open = b.open.map(function (o) { return C.kindLabel(o) + ' ' + D.STATUS[o.status].label; }).join(', ');
      const blocking = b.open.some(function (o) { return o.kind === 'RENEW' || o.kind === 'TERMINATE'; });
      let todo = '-';
      if (visible && canDraft(b) && !blocking) {
        todo = '<div class="row-actions">' +
          (b.autoRenew === 'YES'
            ? '<a class="btn btn--secondary" href="renewal.html?origin=' + encodeURIComponent(b.id) + '">연장 검토</a>'
            : '<a class="btn btn--secondary" href="new-contract.html?kind=RENEW&origin=' + encodeURIComponent(b.id) + '">연장 기안</a>') +
          '<a class="btn btn--tertiary" href="terminate.html?origin=' + encodeURIComponent(b.id) + '">해지 기안</a></div>';
      }
      return '<tr>' +
        '<td class="num"><span class="badge badge--' + tone + '" aria-label="만료까지 ' + d + '일">D-' + d + '</span></td>' +
        '<td>' + cust + '</td>' +
        '<td class="num-left">' + C.fmtDate(b.end) + '</td>' +
        '<td>' + autoCell + '</td>' +
        '<td>' + (visible && open ? esc(open) : '-') + '</td>' +
        '<td class="nowrap col-owner">' + esc(C.userName(c.requesterId)) + '</td>' +
        '<td class="nowrap">' + todo + '</td>' +
      '</tr>';
    }).join('') : '<tr><td class="empty-row" colspan="7">' + (all.length ? '조건에 맞는 계약이 없습니다.' : '90일 안에 끝나는 계약이 없습니다.') + '</td></tr>';
  }

  $('#filter').addEventListener('input', render);
  $('#filter').addEventListener('change', render);
  $('#filter').addEventListener('reset', function () { setTimeout(render, 0); });
  $('#filter').addEventListener('submit', function (e) { e.preventDefault(); });
  render();
})();
