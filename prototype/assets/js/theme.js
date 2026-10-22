/* =====================================================================
 * 밝은 화면, 어두운 화면 고르기 (theme.js, v0.53 기획자 요청, 요구사항 정의서 REQ-UI-31)
 * ---------------------------------------------------------------------
 * 모든 화면의 <head>에서 CSS 다음에 바로 읽어, 화면을 그리기 전에 <html data-theme="light|dark">를 붙임(깜박임 방지)
 *   - 내 계정의 화면 설정: auto(기기 설정대로, 처음 값) / light(밝게) / dark(어둡게)
 *   - auto면 기기(PC, 휴대폰)의 다크모드 설정을 따르고, 기기 설정이 바뀌면 바로 따라감
 *   - 시안은 시연 역할마다 이 브라우저에 저장(climb.demoTheme = { 역할: 값 }). 실제 시스템은 계정마다 서버에 저장
 *   - 색 값은 tokens.css의 6장. 인쇄는 늘 밝은 화면
 * ===================================================================== */
(function () {
  var KEY = 'climb.demoTheme';
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function choice() {
    try {
      var role = localStorage.getItem('climb.demoRole') || 'DEFAULT';
      var all = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
      return all[role] || 'auto';
    } catch (e) { return 'auto'; }
  }
  function apply() {
    var c = choice();
    var dark = c === 'dark' || (c === 'auto' && mq && mq.matches);
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
  }
  apply();
  if (mq && mq.addEventListener) mq.addEventListener('change', apply);
  // 내 계정에서 고를 때 씀: 저장하고 바로 바꿈
  window.CLIMB_THEME = {
    get: choice,
    set: function (value) {
      try {
        var role = localStorage.getItem('climb.demoRole') || 'DEFAULT';
        var all = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
        all[role] = value;
        localStorage.setItem(KEY, JSON.stringify(all));
      } catch (e) { /* 저장소를 못 쓰면 이 화면에서만 */ }
      apply();
    },
    apply: apply,
  };
})();
