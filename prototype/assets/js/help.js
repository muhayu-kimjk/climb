/* =====================================================================
 * SCR-90 이용 안내 화면 로직 (help.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-FLOW-13(업무 흐름 5단계), REQ-UI-14(메뉴 줄 오른쪽 끝 이용 안내)
 * 하는 일
 *   1. 역할별 할 일 표에서 지금 내 역할의 줄을 강조 (슈퍼관리자는 강조 없음)
 *   2. 독촉 기준 일수를 결재선 규칙(SCR-52)의 지금 값으로 채움
 *   3. 자주 묻는 것: 펼침 화살표, 인쇄할 때는 모두 펼쳐 매뉴얼 한 부로
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();

  // 1. 내 역할 강조
  const row = document.querySelector('tr[data-role="' + me.role + '"]');
  if (row && me.role !== 'SUPER') {
    row.classList.add('is-me');
    row.querySelector('td').insertAdjacentHTML('beforeend', '<span class="cell-meta">내 역할</span>');
  }

  // 2. 독촉 기준 일수
  document.querySelectorAll('[data-rule]').forEach(function (el) { el.textContent = D.ALERT_RULES[el.getAttribute('data-rule')]; });

  // 3. 자주 묻는 것: 화살표 아이콘, 인쇄 때 모두 펼치고 끝나면 원래대로
  document.querySelectorAll('.faq-icon').forEach(function (el) { el.outerHTML = C.icon('chevronDown'); });
  let opened = [];
  window.addEventListener('beforeprint', function () {
    opened = Array.prototype.filter.call(document.querySelectorAll('.faq'), function (d) { return !d.open; });
    opened.forEach(function (d) { d.open = true; });
  });
  window.addEventListener('afterprint', function () { opened.forEach(function (d) { d.open = false; }); opened = []; });
})();
