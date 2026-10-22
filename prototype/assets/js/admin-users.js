/* =====================================================================
 * SCR-51 사용자 권한 관리 화면 로직 (admin-users.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-AUTH-02(관리자가 역할 지정), REQ-AUTH-05(여러 역할), REQ-AUTH-13(접속 기록), REQ-ADM-01~09, REQ-SEC-05
 * 하는 일
 *   1. 관리자와 최고관리자만 볼 수 있게 막기
 *   2. 검색(이름, 이메일), 권한, 조직, 상태로 거르기 (v0.29: 부서 → 조직, 권한은 분야별 묶음)
 *   3. 쪽 나누기: 한 쪽에 PAGE_SIZE(20)명. 화면이 A4 2장(약 2,245px)을 넘지 않게 정한 값
 *   4. 사용자 추가: 이메일(@muhayu.com, 중복 불가), 이름, 조직(조직 목록), 권한(여러 개, 분야와 등급 2단계), 사유 → 첫 접속 전 상태
 *   5. 수정: 조직, 권한, 상태(사용 중지, 다시 사용), 사유 (기획자 결정 v0.25: 관리자가 바꾸고 사유를 남김)
 *      [가정] 자기 권한은 스스로 바꿀 수 없음(직무 분리). 최고관리자 권한은 최고관리자만 주거나 뺌
 *      결재 단계 담당자를 사용 중지하거나 그 역할을 빼려면 먼저 결재선 규칙(SCR-52)에서 담당자를 바꿔야 함
 *   6. 권한 변경 이력: 최근 5건, 모두 보기로 펼침
 *   7. 조직 옮기기: 조직 개편 때 한 조직의 여러 사람을 한 번에 다른 조직으로. 역할은 그대로 (v0.31)
 * 프로토타입: 계정 데이터는 mock-data.js의 ACCOUNTS(가상 인물). 실제 시스템은 서버에서 거르고 쪽을 나눠 받아옵니다.
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };

  /* 한 쪽에 보이는 사람 수 (REQ-ADM-04)
   * 화면의 A4 종이 틀(폭 210mm) 전체 높이가 A4 2장(297mm x 2, 약 2,245px)을 넘지 않는 수.
   * 표 한 줄은 약 49px이고, 헤더, 메뉴, 제목, 거르기, 표 머리, 쪽 번호, 푸터가 약 1,170px를 차지합니다.
   * 25명이면 약 2,400px로 2장을 넘고, 20명이면 약 2,150px로 2장 안에 들어갑니다. 인쇄하면 A4 한 장입니다. */
  const PAGE_SIZE = 20;

  /* ---------- 1. 관리자와 최고관리자만 (REQ-AUTH-02) ---------- */
  if (me.role !== 'ADMIN' && me.role !== 'SUPER') {
    $('#notice').innerHTML =
      '<div class="notice" role="status"><p class="notice-title">' + C.icon('alert') + '사용자 권한 관리는 관리자만 볼 수 있습니다</p>' +
      '<p>지금은 ' + esc(C.roleLabel(me.role)) + ' 역할로 보고 있습니다. 화면 맨 위 검은 띠에서 관리자나 최고관리자로 바꾸면 볼 수 있습니다.</p></div>';
    $('#users').hidden = true;
    return;
  }

  /* ---------- 거르기 선택지 ---------- */
  const all = D.ACCOUNTS;
  // 조직은 코드표 순서(실 아래 유닛)대로
  const deptOrder = C.codeList('DEPT', true).map(function (c) { return c.label; });
  const rank = function (d) { const i = deptOrder.indexOf(d); return i < 0 ? 999 : i; };
  const depts = all.map(function (a) { return a.dept; }).filter(function (d, i, arr) { return arr.indexOf(d) === i; })
    .sort(function (a, b) { return rank(a) - rank(b); });
  function options(first, pairs) {
    return '<option value="">' + esc(first) + '</option>' + pairs.map(function (p) {
      return '<option value="' + esc(p[0]) + '">' + esc(p[1]) + '</option>';
    }).join('');
  }
  // 권한: 분야마다 묶어 보여 줌 (역할 2단계, v0.29)
  $('#f-role').innerHTML = '<option value="">전체 권한</option>' + D.ROLE_AREAS.map(function (g) {
    return '<optgroup label="' + esc(g.name) + '">' + Object.keys(g.roles).map(function (r) {
      return '<option value="' + esc(r) + '">' + esc(D.ROLES[r]) + '</option>';
    }).join('') + '</optgroup>';
  }).join('');
  $('#f-dept').innerHTML = options('전체 조직', depts.map(function (d) { return [d, d]; }));
  $('#f-status').innerHTML = options('전체 상태', Object.keys(D.ACCOUNT_STATUS).map(function (s) { return [s, D.ACCOUNT_STATUS[s].label]; }));

  /* ---------- 표시 도우미 ---------- */
  // "2026-10-19 14:05" 그대로, 없으면 "-" (날짜 표기 v0.35)
  function dt(s) { return C.fmtDateTime(s); }
  function roleBadges(roles) {
    return '<span class="role-badges">' + roles.map(function (r) {
      // 최고관리자와 관리자는 진한 배지로 눈에 띄게 [가정]
      return C.badge(r === 'SUPER' || r === 'ADMIN' ? 'attention' : 'line', C.roleLabel(r));
    }).join('') + '</span>';
  }
  function statusBadge(s) {
    const st = D.ACCOUNT_STATUS[s];
    return C.badge(st.tone, st.label);
  }

  /* ---------- 2. 거르기 ---------- */
  let page = 1;
  function filtered() {
    const q = $('#f-q').value.trim().toLowerCase();
    const role = $('#f-role').value, dept = $('#f-dept').value, status = $('#f-status').value;
    return all.filter(function (a) {
      if (q && a.name.toLowerCase().indexOf(q) < 0 && a.email.toLowerCase().indexOf(q) < 0) return false;
      if (role && a.roles.indexOf(role) < 0) return false;
      if (dept && a.dept !== dept) return false;
      if (status && a.status !== status) return false;
      return true;
    });
  }

  /* ---------- 표와 쪽 번호 그리기 ---------- */
  function render() {
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (page > pages) page = pages;
    const from = (page - 1) * PAGE_SIZE;
    const rows = list.slice(from, from + PAGE_SIZE);

    // 건수 요약: 전체 n명 | 사용 중 n명 | 첫 접속 전 n명 | 사용 중지 n명 (거른 결과 기준)
    const counts = Object.keys(D.ACCOUNT_STATUS).map(function (s) {
      return esc(D.ACCOUNT_STATUS[s].label) + ' ' + list.filter(function (a) { return a.status === s; }).length + '명';
    });
    const isFiltered = list.length !== all.length;
    $('#list-count').innerHTML = C.meta(['<strong>' + (isFiltered ? '검색 결과 ' : '전체 ') + list.length + '명</strong>'].concat(counts));

    $('#user-rows').innerHTML = rows.length ? rows.map(function (a) {
      return '<tr' + (a.status === 'SUSPENDED' ? ' class="is-muted"' : '') + '>' +
        '<td class="col-email">' + esc(a.email) + '</td>' +
        '<td class="cell-name">' + esc(a.name) + '</td>' +
        '<td>' + esc(a.dept) + '</td>' +
        '<td>' + roleBadges(a.roles) + '</td>' +
        '<td>' + statusBadge(a.status) + '</td>' +
        '<td class="num-left">' + C.fmtDate(a.registeredAt) + '</td>' +
        '<td class="num-left">' + dt(a.firstLoginAt) + '</td>' +
        '<td class="num-left">' + dt(a.lastLoginAt) + '</td>' +
        '<td class="num-left">' + dt(a.lastLogoutAt) + '</td>' +
        '<td class="num-left">' + C.fmtDate(a.roleChangedAt) + '</td>' +
        '<td class="col-action"><button type="button" class="link-act" data-edit="' + esc(a.email) + '" aria-label="' + esc((a.dept ? a.dept + ' ' : '') + a.name) + ' 권한 수정">수정</button></td>' +
      '</tr>';
    }).join('') : '<tr><td class="empty-row" colspan="11">조건에 맞는 사용자가 없습니다.</td></tr>';

    renderPagination(pages, list.length, from, rows.length);
    renderHistory();
  }

  /* ---------- 6. 권한 변경 이력 ---------- */
  let showAll = false;
  function renderHistory() {
    const list = C.adminLog(['USER']);
    $('#history').innerHTML = C.adminHistoryHtml(showAll ? list : list.slice(0, 5), '권한 변경 이력');
    $('#btn-history').hidden = list.length <= 5;
    $('#btn-history').textContent = showAll ? '최근 5건만 보기' : '모두 보기 (' + list.length + '건)';
    $('#btn-history').setAttribute('aria-expanded', String(showAll));
  }
  $('#btn-history').addEventListener('click', function () { showAll = !showAll; renderHistory(); });

  /* ---------- 4, 5. 사용자 추가와 수정 ---------- */
  function val(f, n) { return (f.elements[n].value || '').trim(); }
  function rolesOf(f) { return Array.prototype.slice.call(f.querySelectorAll('[name="roles"]:checked')).map(function (x) { return x.value; }); }
  function roleNames(roles) { return roles.map(C.roleLabel).join(', '); }
  // 조직 목록: 실 아래 유닛은 들여 씀 (v0.29)
  const deptOptions = function () {
    return [['', '고르세요']].concat(C.codeList('DEPT').map(function (c) { return [c.label, (c.level > 1 ? '\u00a0\u00a0└ ' : '') + c.label]; }));
  };
  // 권한 체크 묶음: 분야(1단계)마다 한 줄에 등급(2단계)을 나란히 (v0.29). 최고관리자 권한은 최고관리자만 보임
  function rolesHtml(selected) {
    const rows = D.ROLE_AREAS.map(function (g) {
      const roles = Object.keys(g.roles).filter(function (r) { return r !== 'SUPER' || me.role === 'SUPER'; });
      if (!roles.length) return '';
      return '<fieldset class="role-row"><legend class="role-row-name">' + esc(g.name) + '</legend><div class="role-row-choices">' + roles.map(function (r) {
        return '<label class="choice"><input type="checkbox" name="roles" value="' + r + '"' + (selected.indexOf(r) > -1 ? ' checked' : '') + '>' + esc(g.roles[r]) + '</label>';
      }).join('') + '</div></fieldset>';
    }).join('');
    return '<fieldset class="field" data-field="roles"><legend class="field-label">권한<span class="req" aria-hidden="true">*</span><span class="sr-only">(필수)</span></legend>' +
      '<div class="role-pick">' + rows + '</div><p class="field-help">분야마다 등급(담당자, 리더, 임원)을 고릅니다. 한 사람이 여러 역할을 가질 수 있고, 하는 일에 필요한 역할만 줍니다.</p><p class="field-error" hidden></p></fieldset>';
  }
  function openAdd() {
    C.formModal({
      title: '사용자를 추가할까요?',
      desc: '추가하면 그 사람이 회사 Google 계정으로 처음 로그인할 때부터 쓸 수 있습니다. Google 2단계 인증을 켜야 들어올 수 있습니다.',
      body: C.fieldHtml({ name: 'email', label: '이메일(계정)', type: 'email', required: true, placeholder: '이름@muhayu.com', help: '회사 Google 계정(@muhayu.com)만 넣을 수 있습니다.' }) +
        '<div class="field-row">' +
          C.fieldHtml({ name: 'uname', label: '이름', required: true }) +
          C.fieldHtml({ name: 'dept', label: '조직', type: 'select', required: true, options: deptOptions() }) +
        '</div>' + rolesHtml([]) +
        C.fieldHtml({ name: 'reason', label: '추가하는 사유', type: 'textarea', required: true, placeholder: '예: 10월 20일 입사, 비즈니스1유닛 배치' }),
      btn: '사용자 추가',
      check: function (f) {
        const email = val(f, 'email').toLowerCase();
        return {
          email: !/^[a-z0-9._-]+@muhayu\.com$/.test(email) ? '@muhayu.com으로 끝나는 회사 이메일을 넣으세요.'
            : all.some(function (a) { return a.email === email; }) ? '이미 등록된 이메일입니다.' : '',
          uname: val(f, 'uname') ? '' : '이름을 넣으세요.',
          dept: val(f, 'dept') ? '' : '조직을 고르세요.',
          roles: rolesOf(f).length ? '' : '권한을 하나 이상 고르세요.',
          reason: val(f, 'reason') ? '' : '추가하는 사유를 적으세요.',
        };
      },
      done: function (f) {
        const a = { email: val(f, 'email').toLowerCase(), name: val(f, 'uname'), dept: val(f, 'dept'), roles: rolesOf(f) };
        C.adminSave('USER', a.name + ' (' + a.email + ')', '사용자 추가: ' + a.dept + ', ' + roleNames(a.roles), val(f, 'reason'), { k: 'ACCOUNT_ADD', a: a });
        page = Math.ceil(filtered().length / PAGE_SIZE);
        render();
        C.toast(C.josa((a.dept ? a.dept + ' ' : '') + a.name, '을', '를') + ' 첫 접속 전 상태로 추가했습니다.');
      },
    });
  }
  function openEdit(email) {
    const a = all.filter(function (x) { return x.email === email; })[0];
    // 직무 분리 [가정]: 자기 권한은 다른 관리자가 바꿈. 최고관리자 계정은 최고관리자만
    if (a.id === me.id) { C.toast('자기 권한은 다른 관리자에게 바꿔 달라고 요청하세요.', true); return; }
    if (a.roles.indexOf('SUPER') > -1 && me.role !== 'SUPER') { C.toast('최고관리자 계정은 최고관리자만 바꿀 수 있습니다.', true); return; }
    const states = a.status === 'SUSPENDED' ? [['SUSPENDED', '사용 중지'], ['ACTIVE', '다시 사용']]
      : [[a.status, D.ACCOUNT_STATUS[a.status].label], ['SUSPENDED', '사용 중지']];
    C.formModal({
      title: (a.dept ? a.dept + ' ' : '') + a.name + '의 권한을 바꿀까요?',
      desc: '저장하면 다음 화면부터 바뀐 권한이 적용됩니다. 사용 중지하면 바로 로그인할 수 없고, 계정과 기록은 지우지 않고 남깁니다.',
      body: '<p class="modal-info">' + esc(a.email) + ', 등록일 ' + C.fmtDate(a.registeredAt) + '</p>' +
        '<div class="field-row">' +
          C.fieldHtml({ name: 'dept', label: '조직', type: 'select', required: true, value: a.dept, options: deptOptions() }) +
          C.fieldHtml({ name: 'status', label: '상태', type: 'select', value: a.status, options: states }) +
        '</div>' + rolesHtml(a.roles) +
        C.fieldHtml({ name: 'reason', label: '바꾸는 사유', type: 'textarea', required: true, placeholder: '예: 10월 20일 경영지원유닛으로 인사 이동' }),
      btn: '저장',
      check: function (f) {
        const roles = rolesOf(f), status = val(f, 'status');
        const same = val(f, 'dept') === a.dept && status === a.status && roles.join() === a.roles.join();
        // 결재 단계 담당자는 결재선 규칙에서 먼저 담당자를 바꿔야 함
        const steps = C.duties(a.id).filter(function (x) { return status === 'SUSPENDED' || !C.canTake(roles, x.role); });
        // 지금 이 사람 차례인 결재가 남아 있으면 사용 중지 전에 대리 지정으로 넘겨야 함 (차례인 건은 원래 담당자에게 남으므로)
        const covered = D.DELEGATIONS.some(function (d) { return d.absentId === a.id && C.delegationState(d) === 'ACTIVE'; });
        const waiting = status === 'SUSPENDED' && !covered ? C.pendingQueue(me, true).filter(function (x) { return x.s.userId === a.id; }).length : 0;
        const stepMsg = steps.length ? '이 사람은 ' + steps.map(function (x) { return x.label; }).join(', ') +
          ' 담당자입니다. 먼저 결재선 규칙에서 담당자를 바꾸세요.'
          : waiting ? '지금 이 사람 차례인 결재가 ' + waiting + '건 있습니다. 먼저 결재선 규칙에서 대리 지정으로 다른 사람에게 넘기세요.' : '';
        return {
          dept: val(f, 'dept') ? '' : '조직을 고르세요.',
          status: status === 'SUSPENDED' && stepMsg ? stepMsg : '',
          roles: !roles.length ? '권한을 하나 이상 고르세요.' : same ? '바뀐 내용이 없습니다.' : status !== 'SUSPENDED' && stepMsg ? stepMsg : '',
          reason: val(f, 'reason') ? '' : '바꾸는 사유를 적으세요.',
        };
      },
      done: function (f) {
        const set = {}, parts = [];
        const roles = rolesOf(f), status = val(f, 'status');
        if (val(f, 'dept') !== a.dept) { set.dept = val(f, 'dept'); parts.push('조직: ' + a.dept + ' → ' + set.dept); }
        if (roles.join() !== a.roles.join()) { set.roles = roles; parts.push('권한: ' + roleNames(a.roles) + ' → ' + roleNames(roles)); }
        if (status !== a.status) { set.status = status; parts.push('상태: ' + D.ACCOUNT_STATUS[a.status].label + ' → ' + D.ACCOUNT_STATUS[status].label); }
        C.adminSave('USER', a.name + ' (' + a.email + ')', parts.join(', '), val(f, 'reason'), { k: 'ACCOUNT_EDIT', email: a.email, set: set });
        render();
        C.toast((a.dept ? a.dept + ' ' : '') + a.name + '의 권한을 바꿨습니다.');
      },
    });
  }
  /* ---------- 7. 조직 옮기기 (조직 개편, 기획자 결정 v0.31) ----------
   * 역할과 조직은 묶지 않으므로 옮겨도 역할은 그대로입니다. ③ 영업 검토는 기안자의 지금 조직으로 리더를 찾습니다. */
  function openMove() {
    const used = depts.filter(function (d) { return all.some(function (a) { return a.dept === d; }); });
    C.formModal({
      title: '여러 사람을 다른 조직으로 옮길까요?',
      desc: '조직 개편 때 한 조직의 사람들을 한 번에 옮깁니다. 역할(권한)은 바뀌지 않고, 옮긴 기록은 권한 변경 이력에 남습니다.',
      body: '<div class="field-row">' +
          C.fieldHtml({ name: 'from', label: '지금 조직', type: 'select', required: true, options: [['', '고르세요']].concat(used.map(function (d) { return [d, d]; })) }) +
          C.fieldHtml({ name: 'to', label: '옮길 조직', type: 'select', required: true, options: deptOptions() }) +
        '</div>' +
        '<fieldset class="field" data-field="people"><legend class="field-label">옮길 사람<span class="req" aria-hidden="true">*</span><span class="sr-only">(필수)</span></legend>' +
          '<div class="check-grid" id="move-people"><p class="field-help">지금 조직을 먼저 고르세요.</p></div><p class="field-error" hidden></p></fieldset>' +
        C.fieldHtml({ name: 'reason', label: '옮기는 사유', type: 'textarea', required: true, placeholder: '예: 2027년 1월 조직 개편으로 비즈니스3유닛을 비즈니스2유닛에 합침' }),
      btn: '조직 옮기기',
      open: function (f) {
        f.elements.from.addEventListener('change', function () {
          const list = all.filter(function (a) { return a.dept === val(f, 'from'); });
          f.querySelector('#move-people').innerHTML = list.length ? list.map(function (a) {
            return '<label class="choice"><input type="checkbox" name="people" value="' + esc(a.email) + '" checked>' + esc(a.name) +
              (a.status === 'SUSPENDED' ? ' (사용 중지)' : '') + '</label>';
          }).join('') : '<p class="field-help">지금 조직을 먼저 고르세요.</p>';
        });
      },
      check: function (f) {
        const n = f.querySelectorAll('[name="people"]:checked').length;
        return {
          from: val(f, 'from') ? '' : '지금 조직을 고르세요.',
          to: !val(f, 'to') ? '옮길 조직을 고르세요.' : val(f, 'to') === val(f, 'from') ? '지금 조직과 다른 조직을 고르세요.' : '',
          people: n ? '' : '옮길 사람을 한 명 이상 고르세요.',
          reason: val(f, 'reason') ? '' : '옮기는 사유를 적으세요.',
        };
      },
      done: function (f) {
        const emails = Array.prototype.map.call(f.querySelectorAll('[name="people"]:checked'), function (x) { return x.value; });
        const names = emails.map(function (e) { return all.filter(function (a) { return a.email === e; })[0].name; });
        C.adminSave('USER', val(f, 'from') + ' → ' + val(f, 'to'), '조직 옮기기: ' + names.join(', ') + ' (' + names.length + '명)', val(f, 'reason'),
          { k: 'ACCOUNTS_MOVE', emails: emails, to: val(f, 'to') });
        render();
        C.toast(names.length + '명을 ' + C.josa(val(f, 'to'), '으로', '로') + ' 옮겼습니다.');
      },
    });
  }
  $('#btn-move').addEventListener('click', openMove);
  $('#btn-add').addEventListener('click', openAdd);
  $('#user-rows').addEventListener('click', function (e) {
    const b = e.target.closest('[data-edit]');
    if (b) openEdit(b.getAttribute('data-edit'));
  });

  // KRDS 페이지네이션 (공통 C.pagerHtml)
  function renderPagination(pages, total, from, shown) {
    $('#pagination').innerHTML = C.pagerHtml(page, pages, total, from, shown, PAGE_SIZE, '명');
  }

  /* ---------- 이벤트 ---------- */
  $('#filter').addEventListener('input', function () { page = 1; render(); });
  $('#filter').addEventListener('change', function () { page = 1; render(); });
  $('#filter').addEventListener('reset', function () { setTimeout(function () { page = 1; render(); }, 0); });
  $('#filter').addEventListener('submit', function (e) { e.preventDefault(); });
  $('#pagination').addEventListener('click', function (e) {
    const b = e.target.closest('button[data-page]');
    if (!b || b.disabled) return;
    page = Number(b.getAttribute('data-page'));
    render();
    // 쪽을 바꾸면 목록 맨 위로
    $('#users').scrollIntoView({ block: 'start' });
  });

  render();
})();
