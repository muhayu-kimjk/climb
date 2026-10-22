/* =====================================================================
 * SCR-93 내 계정 화면 로직 (account.js)
 * ---------------------------------------------------------------------
 * 관련: 요구사항 정의서 REQ-UI-30, REQ-ENV-09, 10, v0.45 기획자 요청
 *   1. 계정 정보: 사용자 권한 관리(SCR-51)의 내 줄을 보기만 함
 *   2. 받을 이메일: EMAIL_TYPES(mock-data.js). 꼭 받는 알림은 켜진 채 잠금(기획자 확인 C-26), 선택 알림만 켜고 끔
 *      내 역할에 오지 않는 알림은 "내 역할에는 오지 않음"으로 흐리게. 저장은 시연 기록(시연 기록 지우기로 처음 값)
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  C.breadcrumb([['내 계정']]);

  /* ---------- 1. 계정 정보 ---------- */
  const acc = (D.ACCOUNTS || []).filter(function (a) { return a.name === me.name; })[0] || {};
  const roles = (acc.roles && acc.roles.length ? acc.roles : [me.role]).map(function (r) { return C.roleLabel(r); });
  const info = function (k, v) { return '<dt>' + esc(k) + '</dt><dd>' + v + '</dd>'; };
  $('#account-info').innerHTML =
    info('이름', esc(me.name)) +
    info('이메일(계정)', esc(acc.email || '-')) +
    info('조직', esc(me.dept || acc.dept || '-')) +
    info('역할', esc(roles.join(', '))) +
    info('상태', acc.status && D.ACCOUNT_STATUS[acc.status] ? C.badge(D.ACCOUNT_STATUS[acc.status].tone, D.ACCOUNT_STATUS[acc.status].label) : '-') +
    info('최초 접속', acc.firstLoginAt ? C.fmtDateTime(acc.firstLoginAt) : '-') +
    info('최종 로그인', acc.lastLoginAt ? C.fmtDateTime(acc.lastLoginAt) : '-');

  /* ---------- 2. 받을 이메일 ---------- */
  $('#mail-desc').innerHTML = '받는 곳: <strong>' + esc(acc.email || '회사 이메일') + '</strong> (회사 Google 계정 이메일. 바꿀 수 없음)';
  // 이 알림이 내 역할에 오는지 (역할이 없으면 모두에게). 최고관리자는 모든 알림을 볼 수 있어 다 내 것으로 봄
  function mine(t) { return !t.roles || me.role === 'SUPER' || C.hasRole(me, t.roles); }
  function render() {
    const prefs = C.mailPrefs(me.id);
    $('#mail-list').innerHTML = D.EMAIL_TYPES.map(function (t) {
      const own = mine(t);
      const state = !own ? C.badge('line', '내 역할에는 오지 않음') : t.must ? C.badge('neutral', '꼭 받음') : prefs[t.code] ? C.badge('success', '받음') : C.badge('line', '받지 않음');
      return '<li class="' + (own ? '' : 'is-not-mine') + '">' +
        '<label class="choice"><input type="checkbox" name="' + t.code + '"' + (prefs[t.code] ? ' checked' : '') +
          (t.must || !own ? ' disabled' : '') + ' aria-describedby="mail-when-' + t.code + '"><span class="mail-name">' + esc(t.name) + '</span></label>' +
        '<span class="mail-state" id="mail-state-' + t.code + '">' + state + '</span>' +
        '<p class="mail-when" id="mail-when-' + t.code + '">' + esc(t.when) + '</p></li>';
    }).join('');
  }
  $('#mail-form').addEventListener('change', function (e) {
    const t = D.EMAIL_TYPES.filter(function (x) { return x.code === e.target.name; })[0];
    if (t) $('#mail-state-' + t.code).innerHTML = e.target.checked ? C.badge('success', '받음') : C.badge('line', '받지 않음');
  });
  $('#mail-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const prefs = {};
    D.EMAIL_TYPES.forEach(function (t) { if (!t.must) prefs[t.code] = !!(e.target.elements[t.code] && e.target.elements[t.code].checked); });
    C.saveMailPrefs(me.id, prefs);
    C.toast('받을 이메일을 저장했습니다.');
  });
  render();
})();
