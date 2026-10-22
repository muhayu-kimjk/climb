/* =====================================================================
 * SCR-48 의무 관리 화면 로직 (obligations.js, v0.53 기획자 결정, 요구사항 정의서 REQ-FLOW-33~36)
 * ---------------------------------------------------------------------
 * 하는 일
 *   1. 볼 수 있는 의무를 모음: 계약을 볼 수 있거나 맡은 분야(열람 제한 계약이면 고객사는 가림)
 *   2. 거르기: 검색, 종류, 맡은 분야(내 분야가 있으면 처음에 내 분야), 상태(처음에는 "챙길 것": 기한 지남과 14일 이내, 예정, 일이 생기면)
 *   3. 순서: 기한 지남 → 14일 이내 → 예정(다음 기한 순) → 일이 생기면 → 모두 함 → 끝냄
 *   4. 할 일: 이행 기록, 기록 보기, 끝내기(obligation-ui.js의 창)
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const OB = window.CLIMB_OB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const ORDER = { LATE: 0, SOON: 1, PLANNED: 2, EVENT: 3, DONE: 4, ENDED: 5 };
  // 챙길 것 = 모두 함과 끝냄을 뺀 것(처음 값), 급한 것 = 기한 지남과 14일 이내
  const STATES = [['OPEN', '챙길 것'], ['URGENT', '급한 것'], ['LATE', '기한 지남'], ['SOON', '14일 이내'],
    ['PLANNED', '예정'], ['EVENT', '일이 생기면'], ['DONE', '모두 함'], ['ENDED', '끝냄'], ['', '전체']];

  function options(sel, list) { sel.innerHTML = list.map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>'; }).join(''); }
  options($('#f-kind'), [['', '전체']].concat(Object.keys(D.OBLIGATION_KINDS).map(function (k) { return [k, D.OBLIGATION_KINDS[k].label]; })));
  const owners = Object.keys(D.OBLIGATION_KINDS).map(function (k) { return D.OBLIGATION_KINDS[k].owner; });
  options($('#f-owner'), [['', '전체']].concat(owners.map(function (r) { return [r, D.ROLE_AREA[r]]; })));
  options($('#f-state'), STATES);
  // 내 분야(정보보호, 고객지원, 재무)가 있으면 처음에는 내 분야만
  const myArea = owners.filter(function (r) { return C.hasRole(me, [r]); })[0] || '';
  function defaults() { $('#f-owner').value = myArea; $('#f-state').value = 'OPEN'; }
  defaults();

  function rootOf(o) { return D.CONTRACTS.find(function (c) { return c.id === o.bundle; }); }
  function contractCell(o) {
    const root = rootOf(o);
    if (!root) return '-';
    if (!C.canView(root, me)) return '<span class="cell-title is-masked">' + C.icon('lock', 'sm') + '열람 제한 계약</span><span class="cell-meta">' + esc(o.bundle) + '</span>';
    return '<a class="cell-title" href="contract.html?id=' + encodeURIComponent(o.bundle) + '">' + esc(root.counterparty) + '</a>' +
      '<span class="cell-meta">' + esc(o.bundle) + ', ' + esc(C.serviceLabel(root.services)) + '</span>';
  }

  function render() {
    const q = $('#f-q').value.trim().toLowerCase(), kind = $('#f-kind').value, owner = $('#f-owner').value, st = $('#f-state').value;
    const seen = D.OBLIGATIONS.filter(function (o) { return C.canSeeObligation(me, o); });
    const list = seen.filter(function (o) {
      const s = C.obligationState(o), root = rootOf(o);
      if (kind && o.kind !== kind) return false;
      if (owner && C.obligationOwner(o) !== owner) return false;
      if (st === 'OPEN' && ['DONE', 'ENDED'].indexOf(s.code) > -1) return false;
      if (st === 'URGENT' && ['LATE', 'SOON'].indexOf(s.code) < 0) return false;
      if (st && ['OPEN', 'URGENT'].indexOf(st) < 0 && s.code !== st) return false;
      if (q) {
        const hay = (o.title + ' ' + o.bundle + ' ' + (root && C.canView(root, me) ? root.counterparty : '')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    }).sort(function (a, b) {
      const sa = C.obligationState(a), sb = C.obligationState(b);
      return ORDER[sa.code] - ORDER[sb.code] || String(sa.next || '9').localeCompare(String(sb.next || '9')) || a.id.localeCompare(b.id);
    });
    const count = function (code) { return list.filter(function (o) { return C.obligationState(o).code === code; }).length; };
    $('#list-count').innerHTML = C.meta(['<strong>' + (list.length !== seen.length ? '거른 결과 ' : '전체 ') + list.length + '건</strong>',
      '기한 지남 ' + count('LATE') + '건', D.ALERT_RULES.obligationSoonDays + '일 이내 ' + count('SOON') + '건']);
    $('#rows').innerHTML = list.length ? list.map(function (o) {
      const s = C.obligationState(o);
      return '<tr' + (s.code === 'LATE' ? ' class="is-alert"' : s.code === 'ENDED' ? ' class="is-muted"' : '') + '>' +
        '<td class="center">' + OB.dueHtml(o) + '</td>' +
        '<td class="col-main">' + OB.titleHtml(o) + '</td>' +
        // 휴대폰에서는 맡은 분야 칸을 감추고 계약 아래 작은 줄로 (REQ-ENV-08과 같은 방식)
        '<td>' + contractCell(o) + '<span class="cell-sub">맡은 분야 ' + esc(C.obligationOwnerLabel(o)) + '</span></td>' +
        '<td class="center nowrap col-owner">' + esc(C.obligationOwnerLabel(o)) + '</td>' +
        '<td class="col-action">' + OB.actionsHtml(o, me, rootOf(o)) + '</td></tr>';
    }).join('') : '<tr><td class="empty-row" colspan="5">' + (seen.length ? '조건에 맞는 의무가 없습니다.' : '챙길 의무가 없습니다.') + '</td></tr>';
  }

  OB.wire($('#rows'), me, render);
  $('#filter').addEventListener('input', render);
  $('#filter').addEventListener('change', render);
  $('#filter').addEventListener('reset', function () { setTimeout(function () { defaults(); render(); }, 0); });
  $('#filter').addEventListener('submit', function (e) { e.preventDefault(); });
  render();
})();
