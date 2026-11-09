/* =====================================================================
 * SCR-93 내 계정 화면 로직 (account.js)
 * ---------------------------------------------------------------------
 * 관련: 요구사항 정의서 REQ-UI-30, REQ-ENV-09, 10, v0.45 기획자 요청
 *   1. 계정 정보: 사용자 권한 관리(SCR-51)의 내 줄을 보기만 함. 감사 열람은 끝나는 날을 함께(기획자 결정 2026-11-02 C-2)
 *   2. 받을 이메일: EMAIL_TYPES(mock-data.js). 꼭 받는 알림은 켜진 채 잠금(기획자 확인 C-26), 선택 알림만 켜고 끔
 *      기획자 결정 2026-11-02 D-22: "내 역할에 오는 알림"과 "내 역할에는 오지 않는 알림" 두 묶음으로 나눔.
 *        아래 묶음은 접어 두고(펼침 단추), 펼치면 이름은 흐리게, 켜고 끄는 칸 없이 언제 오는지와 미리 보기만
 *      기획자 결정 2026-11-02 D-23: 켜고 끄면 바로 저장하고 짧은 알림(화면 밝기와 같은 방식). 저장 단추는 없앰.
 *        저장하는 값(user_mail_pref: 선택 알림마다 받기)은 그대로. 저장은 시연 기록(시연 기록 지우기로 처음 값)
 *      기획자 결정 2026-11-02 E-12: 해지 통지 기한 이메일을 영업 리더도 받음(기안자 유닛 리더, 두 번째 이메일만). 리더에게 "내 역할에 오는 알림"으로 보임
 *        보내는 날은 결재선 규칙에서 바꾼 값(ALERT_RULES.noticeMailDays, A-5)으로 쓰고, 미리 보기는 영업대표가 받는 메일과 리더가 받는 메일 두 통
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };

  /* ---------- 1. 계정 정보 ---------- */
  const acc = C.accountOf(me.id) || {};
  // 기획자 결정 2026-11-02 C-2: 끝나는 날이 있는 역할(감사 열람)은 끝나는 날을 함께("감사 열람(2027-01-11까지)"), 끝났으면 "(끝남)"
  const roles = (acc.roles && acc.roles.length ? acc.roles : [me.role]).map(function (r) {
    if (!D.ROLE_LIMITS || !D.ROLE_LIMITS[r]) return C.roleLabel(r);
    const until = C.roleUntil(me.id, r);
    return C.roleLabel(r) + (until ? '(' + C.fmtDate(until) + '까지)' : '(끝남)');
  });
  const info = function (k, v) { return '<dt>' + esc(k) + '</dt><dd>' + v + '</dd>'; };
  $('#account-info').innerHTML =
    info('이름', esc(me.name)) +
    info('이메일(계정)', esc(acc.email || '-')) +
    info('조직', esc(me.dept || acc.dept || '-')) +
    info('역할', esc(roles.join(', '))) +
    info('상태', acc.status && D.ACCOUNT_STATUS[acc.status] ? C.badge(D.ACCOUNT_STATUS[acc.status].tone, D.ACCOUNT_STATUS[acc.status].label) : '-') +
    info('최초 접속', acc.firstLoginAt ? C.fmtDateTime(acc.firstLoginAt) : '-') +
    info('최종 로그인', acc.lastLoginAt ? C.fmtDateTime(acc.lastLoginAt) : '-');

  /* ---------- 2. 화면: 밝게, 어둡게 (v0.53 기획자 요청, REQ-UI-31) ----------
   * 고르면 저장하고 바로 바꿈(theme.js). 시안은 시연 역할마다 이 브라우저에 저장, 실제 시스템은 계정마다 서버에 저장 */
  const THEME_LABEL = { auto: '기기 설정대로', light: '밝게', dark: '어둡게' };
  // 휴대폰 메뉴판의 밝기 단추로 바꾸면 여기 고른 값도 따라감(2026-11-06, theme.js의 climb-theme 알림)
  function syncThemeChoice() {
    const themeNow = window.CLIMB_THEME ? window.CLIMB_THEME.get() : 'auto';
    document.querySelectorAll('[name="theme"]').forEach(function (r) { r.checked = r.value === themeNow; });
  }
  syncThemeChoice();
  window.addEventListener('climb-theme', syncThemeChoice);
  $('#theme-choices').addEventListener('change', function (e) {
    if (!window.CLIMB_THEME || e.target.name !== 'theme') return;
    window.CLIMB_THEME.set(e.target.value);
    C.toast('화면을 ' + THEME_LABEL[e.target.value] + ' 보이게 바꿨습니다.');
  });

  /* ---------- 3. 받을 이메일 ---------- */
  $('#mail-desc').innerHTML = '받는 곳: <strong>' + esc(acc.email || '회사 이메일') + '</strong> (회사 Google 계정 이메일. 바꿀 수 없음)';
  // 이 알림이 내 역할에 오는지 (역할이 없으면 모두에게). 최고관리자는 모든 알림을 볼 수 있어 다 내 것으로 봄
  //   exceptRoles: 그 역할에는 오지 않음(관찰자에게는 열람자 지정 알림이 없음, 기획자 결정 2026-11-02 A-9)
  function mine(t) {
    if (me.role === 'SUPER') return true;
    if (t.exceptRoles && C.hasRole(me, t.exceptRoles)) return false;
    return !t.roles || C.hasRole(me, t.roles);
  }
  // 보내는 때: 독촉과 의무 알림의 날수는 결재선 규칙(SCR-52)에서 바꿀 수 있어 그 값으로 씀 (v0.58 QA)
  //   해지 통지 기한도 같음(A-5). 영업 리더는 내 유닛 영업의 계약을 가장 짧은 날에만 받음(E-12)
  function whenText(t) {
    const R = D.ALERT_RULES;
    if (t.code === 'REMIND') return '내 차례가 ' + R.approvalDelayDays + '일 넘게 머물거나, 승인 뒤 ' + R.signDelayDays + '일 동안 체결본이 없을 때';
    if (t.code === 'OBLIGATION') return '내 분야가 맡은 체결 후 의무의 기한 ' + R.obligationMailDays.join('일 전과 ') + '일 전, 기한이 지나면 다음 날';
    if (t.code === 'NOTICE_DEADLINE') {
      const all = R.noticeMailDays.join('일 전과 ') + '일 전', last = Math.min.apply(null, R.noticeMailDays) + '일 전';
      if (me.role !== 'SUPER' && C.hasRole(me, ['HEAD'])) return '내가 맡은 자동갱신 계약은 해지 통지 기한 ' + all + ', 내 유닛 영업이 맡은 계약은 ' + last;
      return '내가 맡은 자동갱신 계약의 해지 통지 기한 ' + all + ', 그 유닛 리더에게는 ' + last;
    }
    return t.when;
  }
  function previewBtn(t) {
    return t.sample ? '<button type="button" class="link-act mail-preview-btn" data-preview="' + t.code + '" aria-label="' + esc(t.name) + ' 이메일 미리 보기">미리 보기</button>' : '';
  }
  function render() {
    const prefs = C.mailPrefs(me.id);
    const own = D.EMAIL_TYPES.filter(mine), other = D.EMAIL_TYPES.filter(function (t) { return !mine(t); });
    // 내 역할에 오는 알림: 꼭 받는 알림은 켜진 채 잠금, 선택 알림만 켜고 끔
    $('#mail-list').innerHTML = own.map(function (t) {
      const state = t.must ? C.badge('neutral', '꼭 받음') : prefs[t.code] ? C.badge('success', '받음') : C.badge('line', '받지 않음');
      return '<li>' +
        '<label class="choice"><input type="checkbox" name="' + t.code + '"' + (prefs[t.code] ? ' checked' : '') +
          (t.must ? ' disabled' : '') + ' aria-describedby="mail-when-' + t.code + '"><span class="mail-name">' + esc(t.name) + '</span></label>' +
        '<span class="mail-state" id="mail-state-' + t.code + '">' + state + '</span>' +
        '<p class="mail-when" id="mail-when-' + t.code + '">' + esc(whenText(t)) + '</p>' + previewBtn(t) + '</li>';
    }).join('');
    // 내 역할에는 오지 않는 알림(D-22): 켜고 끄는 칸 없이 이름, 언제 오는지, 미리 보기만.
    //   예전의 "내 역할에는 오지 않음" 배지와 잠긴 빈 칸은 묶음 이름이 대신함(첫 사용 점검: 체크돼 있으면 받는 알림으로 읽혔음)
    $('#mail-list-other').innerHTML = other.map(function (t) {
      return '<li class="is-not-mine"><span class="mail-name">' + esc(t.name) + '</span>' +
        '<p class="mail-when">' + esc(whenText(t)) + '</p>' + previewBtn(t) + '</li>';
    }).join('');
    $('#mail-more-count').textContent = other.length + '개';
    $('#mail-more').hidden = !other.length; // 최고관리자는 모든 알림이 내 것이라 아래 묶음이 없음
  }
  // 펼침 단추의 화살표 (이용 안내의 자주 묻는 것과 같은 아이콘)
  document.querySelectorAll('.mail-more-icon').forEach(function (el) { el.outerHTML = C.icon('chevronDown', 'sm'); });

  /* ---------- 이메일 미리 보기 (v0.53 기획자 요청, REQ-ENV-14) ----------
   * 알림마다 예시 메일 한 통(mock-data.js MAIL_SAMPLES): 받는 사람, 보낸 때, 제목, 인사, 한두 문장, 사실 표, 버튼, 바닥글
   * 내 역할에 오지 않는 알림도 볼 수 있음(어떤 메일이 누구에게 가는지 알 수 있게) */
  function person(s) { return String(s).replace(/@(u_[a-z0-9_]+)/g, function (m, id) { return C.ownerLabel(id); }); }
  // s: 보일 예시 메일(없으면 그 알림의 기본 예시). 리더용 예시는 t.leadSample (E-12)
  function mailHtml(t, s) {
    s = s || t.sample;
    const isUser = /^u_/.test(s.to);
    const a = isUser ? C.accountOf(s.to) : null;
    const to = isUser ? C.ownerLabel(s.to) + (a && a.email ? ' <' + a.email + '>' : '') : s.to;
    const head = function (k, v) { return '<div><dt>' + esc(k) + '</dt><dd>' + v + '</dd></div>'; };
    // 글에는 이름(climb)을 쓰지 않고 "계약 관리 시스템"으로 (v0.53 기획자 요청). 메일 머리의 로고만 climb(SUITE 글꼴)
    return '<dl class="mail-head">' +
        head('보낸 사람', '계약 관리 시스템(보내기 전용)') + head('받는 사람', esc(to)) + head('보낸 때', esc(C.fmtDateTime(s.at))) +
        head('제목', '<strong>' + esc('[계약 관리 시스템] ' + s.subject) + '</strong>') +
      '</dl>' +
      '<div class="mail-body">' +
        '<p class="mail-brand"><span class="brand-name">' + esc(D.BRAND.name) + '</span> <span>' + esc(D.BRAND.ko) + '</span></p>' +
        '<p class="mail-hello">' + (isUser ? esc(C.ownerLabel(s.to)) + '님,' : '안녕하세요.') + '</p>' +
        '<p>' + esc(s.intro) + '</p>' +
        '<table class="mail-facts"><caption class="sr-only">메일에 적힌 내용</caption><tbody>' + s.facts.map(function (f) {
          return '<tr><th scope="row">' + esc(f[0]) + '</th><td>' + esc(person(f[1])) + '</td></tr>';
        }).join('') + '</tbody></table>' +
        '<p class="mail-cta"><a class="btn btn--primary btn--md" href="' + esc(s.button[1]) + '">' + esc(s.button[0]) + '</a></p>' +
        '<p class="mail-note">' + (t.must ? '업무 처리와 내부 통제에 필요한 알림이라 끌 수 없습니다.' : '이 알림은 시스템에 들어가 내 계정의 받을 이메일에서 끌 수 있습니다.') +
          ' 이 메일은 보내기 전용이라 답장을 받지 않습니다. 계약 금액과 첨부 파일은 메일에 넣지 않으니 시스템에서 확인해 주세요.</p>' +
      '</div>';
  }
  // 미리 보기: 두 묶음 모두(접힌 묶음도 펼치면 그대로 씀, D-22)
  $('#mail-form').addEventListener('click', function (e) {
    const b = e.target.closest('[data-preview]');
    if (!b) return;
    const t = D.EMAIL_TYPES.filter(function (x) { return x.code === b.getAttribute('data-preview'); })[0];
    // 리더용 예시가 있으면 두 통을 작은 제목과 함께(E-12). 영업 리더가 보면 리더가 받는 메일을 먼저
    let body = mailHtml(t);
    if (t.leadSample) {
      const parts = [['영업대표가 받는 메일', t.sample], ['유닛 리더가 받는 메일', t.leadSample]];
      if (me.role !== 'SUPER' && C.hasRole(me, ['HEAD'])) parts.reverse();
      body = parts.map(function (p) { return '<h3 class="mail-sample-title">' + esc(p[0]) + '</h3>' + mailHtml(t, p[1]); }).join('');
    }
    // 보내는 때는 결재선 규칙에서 바꾼 일수로(whenText, A-5)
    C.formModal({ title: t.name + ' 이메일 미리 보기', desc: whenText(t) + ' 보내는 메일의 예시입니다. 버튼을 누르면 그 화면으로 갑니다.', body: body, btn: false });
  });
  // 켜고 끄면 바로 저장 (D-23): 바꾼 알림만 새 값, 나머지 선택 알림은 지금 값 그대로 저장(user_mail_pref 모양은 그대로)
  $('#mail-form').addEventListener('change', function (e) {
    const t = D.EMAIL_TYPES.filter(function (x) { return x.code === e.target.name; })[0];
    if (!t || t.must) return;
    const on = e.target.checked;
    $('#mail-state-' + t.code).innerHTML = on ? C.badge('success', '받음') : C.badge('line', '받지 않음');
    const now = C.mailPrefs(me.id), prefs = {};
    D.EMAIL_TYPES.forEach(function (x) { if (!x.must) prefs[x.code] = x.code === t.code ? on : !!now[x.code]; });
    C.saveMailPrefs(me.id, prefs);
    C.toast(t.name + ' 이메일을 ' + (on ? '받도록' : '받지 않도록') + ' 저장했습니다.');
  });
  // 저장 단추는 없지만 Enter 등으로 폼이 보내져 화면이 다시 열리지 않게
  $('#mail-form').addEventListener('submit', function (e) { e.preventDefault(); });
  render();
})();
