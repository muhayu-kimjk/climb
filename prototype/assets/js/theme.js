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
  // 시연 역할: 주소의 ?role=, 저장한 역할, 없으면 기본 역할인 최고관리자 (common.js getRole과 같은 순서, v0.58 QA: 예전에는 DEFAULT로 저장해 고른 밝기를 잃었음)
  //   이 파일은 mock-data.js보다 먼저 읽어 역할 이름이 맞는지는 보지 않음. 없는 역할을 주소에 넣으면 그 이름으로 밝기를 저장함(시안에서만, 2026-11-06 점검)
  function roleKey() {
    return (window.URLSearchParams && new URLSearchParams(location.search).get('role')) || localStorage.getItem('climb.demoRole') || 'SUPER';
  }
  // 이 화면에서 고른 값(2026-11-06 검토: 저장소를 못 쓰는 브라우저에서도 메뉴판 밝기 단추가 이 화면에서는 동작하게)
  var memo = null;
  function choice() {
    if (memo) return memo;
    try {
      var role = roleKey();
      var all = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
      return all[role] || 'auto';
    } catch (e) { return 'auto'; }
  }
  function apply() {
    var c = choice();
    var dark = c === 'dark' || (c === 'auto' && mq && mq.matches);
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    // 바뀐 것을 알림: 메뉴판의 밝기 단추와 내 계정의 화면 설정이 따라감(2026-11-06)
    try { window.dispatchEvent(new Event('climb-theme')); } catch (e) { /* 오래된 브라우저 */ }
  }
  apply();
  if (mq && mq.addEventListener) mq.addEventListener('change', apply);
  // 내 계정과 휴대폰 메뉴판의 밝기 단추(2026-11-06)에서 고를 때 씀: 저장하고 바로 바꿈
  window.CLIMB_THEME = {
    get: choice,
    set: function (value) {
      memo = value;
      try {
        var role = roleKey();
        var all = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
        all[role] = value;
        localStorage.setItem(KEY, JSON.stringify(all));
      } catch (e) { /* 저장소를 못 쓰면 이 화면에서만 */ }
      apply();
    },
  };
})();

/* ---------- 화면을 한 번에 보이기 (v0.55 기획자 요청: 화면을 옮길 때 렌더링하듯 조정되는 순간 없이, REQ-UI-33) ----------
 * 머리글, 메뉴, 푸터, 본문은 화면 스크립트가 그리고, 글꼴(Noto Sans KR, SUITE)은 조금 늦게 와서 글자 폭이 바뀜.
 * 그래서 다 그리고 글꼴이 올 때까지 새 화면을 감췄다가(html.is-loading, common.css) 한 번에 보임.
 * 그동안 Chrome은 앞 화면을 그대로 보여 주므로(paint holding) 화면이 바로 바뀐 것처럼 보임.
 *   - 화면 스크립트는 <body> 끝에서 바로 그리므로 DOMContentLoaded면 다 그린 것
 *   - 기다리는 시간은 길어도 0.8초. 스크립트가 멈춰도 CSS가 1.2초 뒤에 보이게 함(안전장치)
 * 실제 시스템에서도 같은 결과(반쯤 그려진 화면, 글꼴 바뀜이 보이지 않게)가 나오게 만들면 됨 */
(function () {
  var root = document.documentElement;
  root.classList.add('is-loading');
  function show() { root.classList.remove('is-loading'); }
  document.addEventListener('DOMContentLoaded', function () {
    void document.body.offsetHeight; // 배치를 먼저 계산해 이 화면에 쓰는 글꼴을 받기 시작하게 함
    var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([fonts, new Promise(function (r) { setTimeout(r, 800); })]).then(function () { requestAnimationFrame(show); });
  });
  // 뒤로 가기로 저장된 화면을 되살릴 때(bfcache)는 이미 다 그려져 있으므로 바로 보임
  window.addEventListener('pageshow', function (e) { if (e.persisted) show(); });
})();
