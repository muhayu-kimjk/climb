/* =====================================================================
 * SCR-51 사용자 권한 관리 화면 로직 (admin-users.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-AUTH-02(관리자가 역할 지정), REQ-AUTH-05(여러 역할), REQ-AUTH-13(접속 기록), REQ-ADM-01~09, REQ-SEC-05
 * 하는 일
 *   1. 관리자와 최고관리자만 볼 수 있게 막기
 *   2. 검색(이름, 이메일), 권한, 조직, 상태로 거르기 (v0.29: 부서 → 조직, 권한은 분야별 묶음)
 *   3. 쪽 나누기: 한 쪽에 PAGE_SIZE(20)명. 화면이 A4 2장(약 2,245px)을 넘지 않게 정한 값
 *      표 칸 순서: 이메일, 이름, 조직, 권한, 상태, 관리(수정), 날짜 다섯 칸 (기획자 결정 2026-11-02 D-16: 관리 칸을 맨 끝에서 상태 뒤로)
 *      휴대폰도 이메일 전체 주소(기획자 결정 ⑯ 2026-11-09가 2026-11-02 D-17 "@ 앞만"을 바꿈. 2026-11-09 5회차 점검에서 감춤 규칙 지움)
 *   4. 사용자 추가: 이메일(@muhayu.com, 중복 불가), 이름, 조직(조직 목록), 권한(여러 개, 분야와 등급 2단계), 사유 → 첫 접속 전 상태
 *   5. 수정: 조직, 권한, 상태(사용 중지, 다시 사용), 사유 (기획자 결정 v0.25: 관리자가 바꾸고 사유를 남김)
 *      [가정] 자기 권한은 스스로 바꿀 수 없음(직무 분리). 최고관리자 권한은 최고관리자만 주거나 뺌
 *      결재 단계 담당자를 사용 중지하거나 그 역할을 빼려면 먼저 결재선 규칙(SCR-52)에서 담당자를 바꿔야 함
 *   6. 권한 변경 이력: 최근 5건, 모두 보기로 펼침
 *   7. 조직 옮기기: 조직 개편 때 한 조직의 여러 사람을 한 번에 다른 조직으로. 역할은 그대로 (v0.31)
 *      본인은 목록에서 빼고 "본인은 다른 관리자가 옮깁니다"를 보임(2026-11-09 5회차 점검, CTL-99, 06 AC-43. 수정 창의 자기 줄 막기와 같은 규칙)
 *   8. 기획자 결정 2026-11-02
 *      덧붙임: 새 역할 컴플라이언스 담당자(분야 "컴플라이언스")를 고를 수 있음. 결재 단계는 맡지 않음
 *      C-2 감사 열람: 최고관리자만 주고 뺌. 줄 때 사유(바꾸는 사유)와 끝나는 날(오늘부터 1년 안 [가정])이 필수, 사내 사람만
 *        끝나는 날이 지나면 저절로 풀림(common.js roleEnded). 표의 권한 칸에 "감사 열람 2027-01-11까지", 끝났으면 흐린 "감사 열람 끝남"
 *        권한 변경 이력에 "끝남" 한 줄(시스템(자동), common.js roleEndLog). 관리자에게는 지금 가진 사람만 고칠 수 없게 보임
 *      C-5 역할 겹침: 역할을 바꿀 때 겹치면 안 되는 일(③과 ⑨, ③과 ⑩, ⑨와 ⑩, ③과 ②나 ⑧)이 겹치면 목록을 보이고 까닭을 받아 저장(막지 않음)
 *        결재선 규칙의 담당과 대리 지정으로 맡은 일도 함께 봄(common.js roleConflicts). 표의 권한 칸에 "역할 겹침" 배지
 *      C-7 요청한 사람: 사용자 추가와 수정 창에 선택 칸. 권한 변경 이력의 사유 아래 작은 줄로 보임(common.js adminHistoryHtml)
 *   9. 기획자 결정 2026-11-03 C-44: 사용 중지하는 사람이 영업대표인 계약이 있으면 수정 창 맨 아래에 몇 건인지(진행 중 몇 건)와
 *      "그 유닛의 영업 리더가 계약마다 새 영업대표를 정하고, 정하기 전에는 영업 리더가 맡는다"를 알림(막지 않음). 저장한 뒤 알림에도 같은 수
 *      ⑦ 체결본 등록 차례는 사용 중지하면 영업 리더에게 넘어가므로 "차례인 결재" 확인에서 뺌(예전에는 대리 지정을 먼저 하라고 막았으나 영업은 대리 지정 대상이 아님)
 *      표의 상태 칸: 사용 중지된 영업대표의 계약이 남아 있으면 작은 줄 "영업대표인 계약 n건, 담당 지정 필요"
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
      C.noticeBox('', '사용자 권한 관리는 관리자만 볼 수 있습니다',
        '지금은 ' + esc(C.roleLabel(me.role)) + ' 역할로 보고 있습니다. 화면 맨 위 검은 띠에서 관리자나 최고관리자로 바꾸면 볼 수 있습니다.');
    $('#users').hidden = true;
    return;
  }

  /* ---------- 거르기 선택지 ---------- */
  const all = D.ACCOUNTS;
  // 조직은 코드표 순서(실 아래 유닛)대로
  const deptOrder = C.codeList('DEPT', true).map(function (c) { return c.label; });
  const rank = function (d) { const i = deptOrder.indexOf(d); return i < 0 ? 999 : i; };
  // 지금 사람이 있는 조직: 사람을 더하거나 옮긴 뒤에도 맞게 그때그때 셈 (v0.58 QA: 화면을 연 때의 목록에 머물렀음)
  function deptList() {
    return all.map(function (a) { return a.dept; }).filter(function (d, i, arr) { return d && arr.indexOf(d) === i; })
      .sort(function (a, b) { return rank(a) - rank(b); });
  }
  function fillDeptFilter() {
    const keep = $('#f-dept').value;
    $('#f-dept').innerHTML = options('전체 조직', deptList().map(function (d) { return [d, d]; }));
    $('#f-dept').value = deptList().indexOf(keep) > -1 ? keep : '';
  }
  // 권한 목록이 같은지: 고른 순서와 상관없이 (v0.58 QA: 순서만 달라도 바뀐 것으로 남았음)
  function sameRoles(x, y) { return x.slice().sort().join() === y.slice().sort().join(); }
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
  fillDeptFilter();
  $('#f-status').innerHTML = options('전체 상태', Object.keys(D.ACCOUNT_STATUS).map(function (s) { return [s, D.ACCOUNT_STATUS[s].label]; }));

  /* ---------- 표시 도우미 ---------- */
  // "2026-10-19 14:05" 그대로, 없으면 "-" (날짜 표기 v0.35)
  function dt(s) { return C.fmtDateTime(s); }
  function roleBadges(a) {
    return '<span class="role-badges">' + a.roles.map(function (r) {
      // 기획자 결정 2026-11-02 C-2: 끝나는 날이 있는 역할(감사 열람)은 지금이면 끝나는 날을 붙이고, 끝났으면 흐린 배지 "끝남"
      if (D.ROLE_LIMITS && D.ROLE_LIMITS[r]) {
        const until = C.roleUntil(a.id, r);
        return until ? C.badge('attention', C.roleLabel(r) + ' ' + until + '까지') : C.badge('neutral', C.roleLabel(r) + ' 끝남');
      }
      // 최고관리자와 관리자는 진한 배지로 눈에 띄게 [가정]
      return C.badge(r === 'SUPER' || r === 'ADMIN' ? 'attention' : 'line', C.roleLabel(r));
    }).join('') + conflictBadge(a) + '</span>';
  }
  // 기획자 결정 2026-11-02 C-5: 겹치면 안 되는 일을 함께 맡은 계정(사용 중지는 빼고). 마우스를 올리면 무엇이 겹치는지
  function conflictBadge(a) {
    if (a.status === 'SUSPENDED') return '';
    const list = C.roleConflicts(a.id);
    return list.length ? '<span title="' + esc(list.map(function (x) { return x.detail; }).join('\n')) + '">' + C.badge('danger', '역할 겹침') +
      '<span class="sr-only">: ' + esc(list.map(function (x) { return x.text; }).join(', ')) + '</span></span>' : '';
  }
  function statusBadge(s) {
    const st = D.ACCOUNT_STATUS[s];
    return C.badge(st.tone, st.label);
  }
  /* 영업대표인 계약 (기획자 결정 2026-11-03 C-44): 이 사람이 지금 영업대표인 계약 묶음(해지된 묶음은 뺌)과 그중 진행 중인 것
   *   진행 중: 원계약이 아직 검토, 체결, 운영 검토 중이거나, 진행 중이거나 반려된 변경, 연장, 해지, 운영 변경이 있는 묶음 */
  function repBundles(id) {
    const list = C.repBundlesOf(id);
    const open = list.filter(function (b) { return ['ACTIVE', 'EXPIRED'].indexOf(b.root.status) < 0 || b.open.length || b.rejected.length; });
    return { all: list, open: open };
  }
  /* 영업대표를 더는 맡을 수 없는 계정인지 (기획자 결정 2026-11-03 C-44 "바뀌거나(이동) 퇴사하면", common.js repGoneText와 같은 규칙)
   *   사용 중지이거나, 영업 담당자와 영업 리더 역할이 모두 없음(최고관리자 시연 계정은 뺌). roles, status를 주면 고른 값으로 봄(수정 창) */
  function repGone(a, roles, status) {
    const r = roles || C.activeRoles(a);
    return (status || a.status) === 'SUSPENDED' || (r.indexOf('SALES') < 0 && r.indexOf('HEAD') < 0 && r.indexOf('SUPER') < 0);
  }
  // 표의 상태 칸 작은 줄: 맡을 수 없는 사람이 아직 영업대표인 계약이 있으면(영업 리더가 새 영업대표를 정할 때까지)
  function repNeedMeta(a) {
    if (!repGone(a)) return '';
    const n = repBundles(a.id).all.length;
    return n ? '<span class="cell-meta">영업대표인 계약 ' + n + '건, 담당 지정 필요</span>' : '';
  }
  // 수정 창 맨 아래의 안내 자리(사용 중지, 영업 역할 빼기, 조직 옮기기를 고를 때만 보임). 맨 아래에 두어 위 칸은 움직이지 않음. 글은 syncExtras가 고른 값에 맞춰 채움
  //   기획자 결정 2026-11-03(C-44): 예전에는 사용 중지만 알렸음. 영업 역할을 빼거나 조직을 옮길 때도 알림
  function repBoxHtml(a) {
    if (!repBundles(a.id).all.length || repGone(a)) return '';
    return '<div data-rep-box hidden></div>';
  }
  // 안내 글: gone(사용 중지나 영업 역할 빼기)이면 영업 리더가 맡고 새로 정함, 아니면(조직만 옮김) 그대로 맡고 계약 유닛의 리더가 필요하면 바꿈 [가정]
  function repBoxBody(a, gone) {
    const r = repBundles(a.id);
    const leads = r.all.map(function (b) { return C.ownerLabel(C.repLeadOf(b)); }).filter(function (v, i, arr) { return arr.indexOf(v) === i; });
    return C.noticeBox('', '이 사람이 영업대표인 계약이 ' + r.all.length + '건 있습니다',
      (r.open.length ? '그중 ' + r.open.length + '건은 진행 중이거나 반려된 기안이 있습니다. ' : '') + (gone
        ? '저장해도 계약은 그대로이고, 그 계약 유닛의 영업 리더(' + esc(leads.join(', ')) + ')가 계약 상세에서 계약마다 새 영업대표를 정합니다. ' +
          '정하기 전에는 영업 리더가 체결본 등록, 보완 후 재기안, 변경, 연장, 해지 기안과 만료 알림을 맡고, 그 계약에 "담당 지정 필요"가 보입니다.'
        : '영업 역할이 남아 있어 조직을 옮겨도 이 사람이 계속 영업대표를 맡습니다. 계약 유닛의 영업 리더(' + esc(leads.join(', ')) + ')가 필요하면 계약 상세에서 새 영업대표를 정합니다.'));
  }
  // 이메일 칸: 왼쪽 고정은 그대로, 휴대폰도 전체 주소(기획자 결정 ⑯ 2026-11-09가 2026-11-02 D-17 "휴대폰은 @ 앞만"을 바꿈)
  //   2026-11-09 5회차 점검: admin-users.css에서 @ 뒤를 감추던 규칙을 지움. email-domain 묶음은 감추지 않고 남겨 둠(모양 차이 없음)
  //   칸에 마우스를 올리면 전체 주소(title)
  function emailCell(email) {
    const at = email.indexOf('@');
    return '<td class="col-email" title="' + esc(email) + '">' + (at < 0 ? esc(email)
      : esc(email.slice(0, at)) + '<span class="email-domain">' + esc(email.slice(at)) + '</span>') + '</td>';
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
      return [esc(D.ACCOUNT_STATUS[s].label), list.filter(function (a) { return a.status === s; }).length + '명'];
    });
    const isFiltered = list.length !== all.length;
    $('#list-count').innerHTML = C.meta([[(isFiltered ? '검색 결과' : '전체'), '<strong>' + list.length + '명</strong>']].concat(counts));

    $('#user-rows').innerHTML = rows.length ? rows.map(function (a) {
      return '<tr' + (a.status === 'SUSPENDED' ? ' class="is-muted"' : '') + '>' +
        emailCell(a.email) +
        '<td class="cell-name">' + esc(a.name) + '</td>' +
        '<td>' + esc(a.dept) + '</td>' +
        '<td>' + roleBadges(a) + '</td>' +
        '<td>' + statusBadge(a.status) + repNeedMeta(a) + '</td>' +
        // 기획자 결정 2026-11-02 D-16: 관리(수정) 칸은 상태 칸 바로 뒤. 날짜 다섯 칸은 참고용이라 뒤로
        '<td class="col-action"><button type="button" class="link-act" data-edit="' + esc(a.email) + '" aria-label="' + esc((a.dept ? a.dept + ' ' : '') + a.name) + ' 권한 수정">수정</button></td>' +
        '<td class="num-left">' + C.fmtDate(a.registeredAt) + '</td>' +
        '<td class="num-left">' + dt(a.firstLoginAt) + '</td>' +
        '<td class="num-left">' + dt(a.lastLoginAt) + '</td>' +
        '<td class="num-left">' + dt(a.lastLogoutAt) + '</td>' +
        '<td class="num-left">' + C.fmtDate(a.roleChangedAt) + '</td>' +
      '</tr>';
    }).join('') : '<tr><td class="empty-row" colspan="11">조건에 맞는 사용자가 없습니다.</td></tr>';

    renderPagination(pages, list.length, from, rows.length);
    renderHistory();
  }

  /* ---------- 6. 권한 변경 이력 ---------- */
  let showAll = false;
  function renderHistory() {
    // 기획자 결정 2026-11-02 C-2: 감사 열람의 끝나는 날이 지나 저절로 풀린 기록(시스템(자동))도 같은 표에 "끝남"으로
    const list = C.adminLog(['USER']).concat(C.roleEndLog()).sort(function (x, y) { return y.at.localeCompare(x.at); });
    $('#history').innerHTML = C.adminHistoryHtml(showAll ? list : list.slice(0, 5), '권한 변경 이력');
    $('#btn-history').hidden = list.length <= 5;
    $('#btn-history').textContent = showAll ? '최근 5건만 보기' : '모두 보기 (' + list.length + '건)';
    $('#btn-history').setAttribute('aria-expanded', String(showAll));
  }
  $('#btn-history').addEventListener('click', function () { showAll = !showAll; renderHistory(); });

  /* ---------- 4, 5. 사용자 추가와 수정 ---------- */
  function val(f, n) { return (f.elements[n].value || '').trim(); }
  // 이번 변경(그 시각)으로 풀린 사람 지정 열람자 수 (v0.52: 조직이 바뀌면 사람으로 지정된 열람자 지정이 저절로 풀림, 관리자에게 이메일)
  function releasedAt(at) {
    return D.CONTRACTS.reduce(function (n, c) {
      return n + (c.viewers || []).filter(function (v) { return v.releasedAt === at; }).length;
    }, 0);
  }
  // 고른 역할(관리자에게 고칠 수 없게 보이는 감사 열람도 체크되어 있으면 들어감: 저장해도 그대로 남게)
  function rolesOf(f) { return Array.prototype.slice.call(f.querySelectorAll('[name="roles"]:checked')).map(function (x) { return x.value; }); }
  // 역할 이름들. until을 주면 감사 열람 뒤에 끝나는 날 "(2027-01-11까지)" (기획자 결정 2026-11-02 C-2)
  function roleNames(roles, until) {
    return roles.map(function (r) { return C.roleLabel(r) + (r === 'AUDIT' && until ? '(' + until + '까지)' : ''); }).join(', ');
  }
  // 조직 목록: 실 아래 유닛은 들여 씀 (v0.29)
  const deptOptions = function () {
    return [['', '고르세요']].concat(C.codeList('DEPT').map(function (c) { return [c.label, (c.level > 1 ? '\u00a0\u00a0└ ' : '') + c.label]; }));
  };
  // 권한 체크 묶음: 분야(1단계)마다 한 줄에 등급(2단계)을 나란히 (v0.29). 최고관리자 권한은 최고관리자만 보임
  //   기획자 결정 2026-11-02 C-2: 감사 열람도 최고관리자만 주고 뺌. 관리자에게는 지금 가진 사람의 것만 고칠 수 없게(disabled) 보여 저장해도 남음
  //   a: 고치는 계정(추가할 때는 없음). selected는 지금 가진 역할(끝난 감사 열람은 빠짐, C.activeRoles)
  function rolesHtml(selected, a) {
    const auditOn = !!a && !!C.roleUntil(a.id, 'AUDIT');
    const rows = D.ROLE_AREAS.map(function (g) {
      const roles = Object.keys(g.roles).filter(function (r) {
        if (r === 'SUPER') return me.role === 'SUPER';
        if (r === 'AUDIT') return me.role === 'SUPER' || auditOn;
        return true;
      });
      if (!roles.length) return '';
      return '<fieldset class="role-row"><legend class="role-row-name">' + esc(g.name) + '</legend><div class="role-row-choices">' + roles.map(function (r) {
        const lock = r === 'AUDIT' && me.role !== 'SUPER';
        return '<label class="choice"><input type="checkbox" name="roles" value="' + r + '"' + (selected.indexOf(r) > -1 ? ' checked' : '') + (lock ? ' disabled' : '') + '>' + esc(g.roles[r]) +
          (lock ? '<span class="sr-only">(최고관리자만 바꿈)</span>' : '') + '</label>';
      }).join('') + '</div></fieldset>';
    }).join('');
    return '<fieldset class="field" data-field="roles"><legend class="field-label">권한<span class="req" aria-hidden="true">*</span><span class="sr-only">(필수)</span></legend>' +
      '<div class="role-pick">' + rows + '</div><p class="field-help">분야마다 등급(담당자, 리더, 임원)을 고릅니다. 한 사람이 여러 역할을 가질 수 있고, 하는 일에 필요한 역할만 줍니다. ' +
      '감사 열람은 최고관리자만 끝나는 날을 정해 줍니다. 함께 맡으면 안 되는 일이 겹치면 저장할 때 알립니다.</p><p class="field-error" hidden></p></fieldset>';
  }

  /* ---------- 감사 열람의 끝나는 날, 요청한 사람, 역할 겹침 (기획자 결정 2026-11-02 C-2, C-7, C-5) ---------- */
  const AUDIT_DAYS = ((D.ROLE_LIMITS || {}).AUDIT || { maxDays: 365 }).maxDays; // 줄 수 있는 가장 긴 기간 [가정 1년]
  const auditMax = C.addDays(D.TODAY, AUDIT_DAYS);
  // 감사 열람 끝나는 날: 최고관리자에게만. 감사 열람을 고를 때만 보임(고른 칸 아래에서만 늘어나 위 칸은 움직이지 않음)
  function auditFieldHtml(a) {
    if (me.role !== 'SUPER') return '';
    const until = a ? C.roleUntil(a.id, 'AUDIT') : '';
    return '<div data-audit-box' + (until ? '' : ' hidden') + '>' +
      C.fieldHtml({ name: 'auditUntil', label: '감사 열람 끝나는 날', type: 'date', required: true, value: until, attrs: ' min="' + D.TODAY + '" max="' + auditMax + '"',
        help: '오늘부터 ' + AUDIT_DAYS + '일 안(' + auditMax + '까지)에서 고릅니다. 이날이 지나면 저절로 풀립니다. 사내 사람에게만 주고, 외부감사인에게는 계정 대신 내보낸 증빙을 줍니다.' }) +
      '</div>';
  }
  // 요청한 사람(C-7, 선택): 사용 중지가 아닌 계정. "조직 이름"으로
  function requesterHtml() {
    const people = all.filter(function (x) { return x.status !== 'SUSPENDED'; })
      .map(function (x) { return [x.id, (x.dept ? x.dept + ' ' : '') + x.name]; })
      .sort(function (p, q) { return p[1].localeCompare(q[1], 'ko'); });
    // 넣지 않아도 되는 칸은 optional로 "(선택)"을 모든 창에서 같은 모양으로(2026-11-06 점검 3회차)
    return C.fieldHtml({ name: 'requestedBy', label: '요청한 사람', type: 'select', optional: true, options: [['', '고르지 않음']].concat(people),
      help: '권한을 바꿔 달라고 요청한 사람(예: 유닛 리더)이 있으면 고릅니다. 권한 변경 이력에 함께 남습니다.' });
  }
  // 역할 겹침 알림과 까닭 칸(C-5): 겹칠 때만 보임. 창 맨 아래에 두어 위 칸은 움직이지 않음
  function conflictHtml() {
    return '<div data-conflict hidden><div class="conflict-note"></div>' +
      C.fieldHtml({ name: 'conflictReason', label: '겹쳐도 저장하는 까닭', type: 'textarea', required: true,
        placeholder: '예: 결산 기간에만 재무 확인을 대신함. 같은 계약의 ⑨와 ⑩은 시스템이 한 사람에게 주지 않음' }) + '</div>';
  }
  // 저장하면 생기는 겹침: 역할을 바꿀 때만 물음(조직이나 상태만 바꾸면 묻지 않음). 사용 중지면 겹침이 없음
  //   결재선 규칙의 담당과 대리 지정으로 맡은 일도 함께 셈(C.roleConflicts의 userId)
  function conflictsFor(roles, a, status) {
    if (status === 'SUSPENDED') return [];
    if (a && sameRoles(roles, C.activeRoles(a))) return [];
    return C.roleConflicts(roles, { userId: a ? a.id : null });
  }
  // 창의 덧붙인 칸 맞추기: 감사 열람을 고르면 끝나는 날 칸, 겹치면 알림과 까닭 칸
  function syncExtras(f, a) {
    const roles = rolesOf(f), box = f.querySelector('[data-audit-box]');
    if (box) box.hidden = roles.indexOf('AUDIT') < 0;
    // 기획자 결정 2026-11-03(C-44): 사용 중지, 영업 역할 빼기, 조직 옮기기를 고르면 영업대표인 계약 안내(창 맨 아래)
    const repBox = f.querySelector('[data-rep-box]');
    if (repBox && a) {
      const gone = repGone(a, roles, f.elements.status ? val(f, 'status') : a.status);
      const show = gone || val(f, 'dept') !== a.dept;
      repBox.hidden = !show;
      if (show && repBox.getAttribute('data-gone') !== String(gone)) { repBox.innerHTML = repBoxBody(a, gone); repBox.setAttribute('data-gone', String(gone)); }
    }
    const list = conflictsFor(roles, a, f.elements.status ? val(f, 'status') : 'ACTIVE');
    const wrap = f.querySelector('[data-conflict]');
    wrap.hidden = !list.length;
    wrap.querySelector('.conflict-note').innerHTML = list.length ? C.noticeBox('', '함께 맡으면 안 되는 일이 겹칩니다',
      // 알림 상자 본문은 문단(p)이라 목록 대신 한 줄씩 span(admin-users.css .conflict-item)
      list.map(function (x) { return '<span class="conflict-item">' + esc(x.detail) + '</span>'; }).join('') +
      '<span class="conflict-item conflict-tail">저장할 수는 있지만 까닭을 꼭 적습니다. 분기 권한 검토에서 "역할 충돌 계정"으로 다시 봅니다.</span>') : '';
  }
  // 감사 열람 끝나는 날 검사(최고관리자가 감사 열람을 고른 때만)
  function auditError(f, roles) {
    if (me.role !== 'SUPER' || roles.indexOf('AUDIT') < 0) return '';
    const u = f.elements.auditUntil.value;
    return !u ? '감사 열람이 끝나는 날을 고르세요.' : u < D.TODAY || u > auditMax ? D.TODAY + '부터 ' + auditMax + ' 사이의 날을 고르세요.' : '';
  }
  // 저장할 때 덧붙일 것: 겹침(바뀐 내용, 기록의 op.conflict, 사유 뒤 까닭), 요청한 사람
  function extrasOf(f, roles, a, status, op) {
    const list = conflictsFor(roles, a, status);
    const req = val(f, 'requestedBy');
    if (req) op.requestedBy = req;
    if (!list.length) return { change: '', reason: val(f, 'reason') };
    op.conflict = { list: list.map(function (x) { return x.text; }), reason: val(f, 'conflictReason') };
    return { change: '역할 겹침을 알고 저장(' + op.conflict.list.join(', ') + ')', reason: val(f, 'reason') + ' / 역할 겹침 까닭: ' + val(f, 'conflictReason') };
  }
  function openAdd() {
    C.formModal({
      title: '사용자를 추가할까요?',
      desc: '추가하면 그 사람이 회사 Google 계정으로 처음 로그인할 때부터 쓸 수 있습니다. Google 2단계 인증을 켜야 들어올 수 있습니다.',
      body: C.fieldHtml({ name: 'email', label: '이메일(계정)', type: 'email', required: true, placeholder: '이름@muhayu.com', help: '회사 Google 계정(@muhayu.com)만 넣을 수 있습니다.' }) +
        '<div class="field-row">' +
          C.fieldHtml({ name: 'uname', label: '이름', required: true }) +
          C.fieldHtml({ name: 'dept', label: '조직', type: 'select', required: true, options: deptOptions() }) +
        '</div>' + rolesHtml([], null) + auditFieldHtml(null) + requesterHtml() +
        C.fieldHtml({ name: 'reason', label: '추가하는 사유', type: 'textarea', required: true, placeholder: '예: 10월 20일 입사, 비즈니스1유닛 배치' }) +
        conflictHtml(),
      btn: '사용자 추가',
      // 기획자 결정 2026-11-02: 감사 열람을 고르면 끝나는 날 칸(C-2), 겹치면 알림과 까닭 칸(C-5)
      open: function (f) { f.addEventListener('change', function () { syncExtras(f, null); }); syncExtras(f, null); },
      check: function (f) {
        const email = val(f, 'email').toLowerCase(), roles = rolesOf(f);
        return {
          email: !/^[a-z0-9._-]+@muhayu\.com$/.test(email) ? '@muhayu.com으로 끝나는 회사 이메일을 넣으세요.'
            : all.some(function (a) { return a.email === email; }) ? '이미 등록된 이메일입니다.' : '',
          uname: val(f, 'uname') ? '' : '이름을 넣으세요.',
          dept: val(f, 'dept') ? '' : '조직을 고르세요.',
          roles: roles.length ? '' : '권한을 하나 이상 고르세요.',
          auditUntil: auditError(f, roles),
          reason: val(f, 'reason') ? '' : '추가하는 사유를 적으세요.',
          conflictReason: conflictsFor(roles, null, 'INVITED').length && !val(f, 'conflictReason') ? '역할이 겹쳐도 저장하는 까닭을 적으세요.' : '',
        };
      },
      done: function (f) {
        const a = { email: val(f, 'email').toLowerCase(), name: val(f, 'uname'), dept: val(f, 'dept'), roles: rolesOf(f) };
        const op = { k: 'ACCOUNT_ADD', a: a };
        // 감사 열람을 함께 주면 준 기록(D.ROLE_GRANTS)에 끝나는 날과 사유를 남김 (C-2)
        const until = a.roles.indexOf('AUDIT') > -1 ? f.elements.auditUntil.value : '';
        if (until) op.grant = { role: 'AUDIT', until: until, reason: val(f, 'reason') };
        const x = extrasOf(f, a.roles, null, 'INVITED', op);
        C.adminSave('USER', a.name + ' (' + a.email + ')', '사용자 추가: ' + a.dept + ', ' + roleNames(a.roles, until) + (x.change ? ', ' + x.change : ''), x.reason, op);
        fillDeptFilter();
        page = Math.max(1, Math.ceil(filtered().length / PAGE_SIZE)); // 거른 목록이 비어도 1쪽 (v0.58 QA)
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
    // 지금 가진 역할: 끝나는 날이 지난 감사 열람은 빼고 견주고 보임(기획자 결정 2026-11-02 C-2). 저장하면 끝난 역할은 목록에서 빠짐
    const prevRoles = C.activeRoles(a);
    // 다시 사용: 한 번도 접속하지 않은 사람은 첫 접속 전으로 (REQ-ADM-06, v0.58 QA)
    const states = a.status === 'SUSPENDED' ? [['SUSPENDED', '사용 중지'], [a.firstLoginAt ? 'ACTIVE' : 'INVITED', '다시 사용']]
      : [[a.status, D.ACCOUNT_STATUS[a.status].label], ['SUSPENDED', '사용 중지']];
    C.formModal({
      title: (a.dept ? a.dept + ' ' : '') + a.name + '의 권한을 바꿀까요?',
      desc: '저장하면 다음 화면부터 바뀐 권한이 적용됩니다. 사용 중지하면 바로 로그인할 수 없고, 계정과 기록은 지우지 않고 남깁니다.',
      body: '<p class="modal-info">' + esc(a.email) + ', 등록일 ' + C.fmtDate(a.registeredAt) + '</p>' +
        '<div class="field-row">' +
          C.fieldHtml({ name: 'dept', label: '조직', type: 'select', required: true, value: a.dept, options: deptOptions() }) +
          C.fieldHtml({ name: 'status', label: '상태', type: 'select', value: a.status, options: states }) +
        '</div>' + rolesHtml(prevRoles, a) + auditFieldHtml(a) + requesterHtml() +
        C.fieldHtml({ name: 'reason', label: '바꾸는 사유', type: 'textarea', required: true, placeholder: '예: 10월 20일 경영지원유닛으로 인사 이동' }) +
        conflictHtml() + repBoxHtml(a), // 영업대표인 계약 안내(2026-11-03 C-44, 사용 중지, 영업 역할 빼기, 조직 옮기기를 고를 때만)
      btn: '저장',
      // 기획자 결정 2026-11-02: 감사 열람을 고르면 끝나는 날 칸(C-2), 역할을 바꿔 겹치면 알림과 까닭 칸(C-5)
      open: function (f) { f.addEventListener('change', function () { syncExtras(f, a); }); syncExtras(f, a); },
      check: function (f) {
        const roles = rolesOf(f), status = val(f, 'status');
        // 지금 가진 역할과 견줌(끝난 감사 열람은 빼고). 최고관리자가 감사 열람의 끝나는 날만 바꿔도 바뀐 것
        const untilNew = me.role === 'SUPER' && roles.indexOf('AUDIT') > -1 ? f.elements.auditUntil.value : C.roleUntil(a.id, 'AUDIT');
        const same = val(f, 'dept') === a.dept && status === a.status && sameRoles(roles, prevRoles) && untilNew === C.roleUntil(a.id, 'AUDIT');
        // 결재 단계 담당자는 결재선 규칙에서 먼저 담당자를 바꿔야 함
        const steps = C.duties(a.id).filter(function (x) { return status === 'SUSPENDED' || !C.canTake(roles, x.role); });
        // 지금 이 사람 차례인 결재가 남아 있으면 사용 중지 전에 대리 지정으로 넘겨야 함 (차례인 건은 원래 담당자에게 남으므로)
        const covered = D.DELEGATIONS.some(function (d) { return d.absentId === a.id && C.delegationState(d) === 'ACTIVE'; });
        //   기획자 결정 2026-11-03(C-44): ⑦ 체결본 등록은 사용 중지하면 영업 리더에게 넘어가므로(새 영업대표를 정할 때까지) 세지 않음
        const waiting = status === 'SUSPENDED' && !covered ? C.pendingQueue(me, true).filter(function (x) { return x.s.userId === a.id && x.s.step !== 'S07'; }).length : 0;
        const stepMsg = steps.length ? '이 사람은 ' + steps.map(function (x) { return x.label; }).join(', ') +
          ' 담당자입니다. 먼저 결재선 규칙에서 담당자를 바꾸세요.'
          : waiting ? '지금 이 사람 차례인 결재가 ' + waiting + '건 있습니다. 먼저 결재선 규칙에서 대리 지정으로 다른 사람에게 넘기세요.' : '';
        return {
          dept: val(f, 'dept') ? '' : '조직을 고르세요.',
          status: status === 'SUSPENDED' && stepMsg ? stepMsg : '',
          roles: !roles.length ? '권한을 하나 이상 고르세요.' : same ? '바뀐 내용이 없습니다.' : status !== 'SUSPENDED' && stepMsg ? stepMsg : '',
          auditUntil: auditError(f, roles),
          reason: val(f, 'reason') ? '' : '바꾸는 사유를 적으세요.',
          conflictReason: conflictsFor(roles, a, status).length && !val(f, 'conflictReason') ? '역할이 겹쳐도 저장하는 까닭을 적으세요.' : '',
        };
      },
      done: function (f) {
        const set = {}, parts = [];
        const roles = rolesOf(f), status = val(f, 'status');
        const op = { k: 'ACCOUNT_EDIT', email: a.email, set: set };
        // 감사 열람(C-2): 새로 주거나 끝나는 날을 바꾸면 새 기록(op.grant), 끝나기 전에 빼면 지금 기록에 뺀 때(op.endGrant)
        const oldUntil = C.roleUntil(a.id, 'AUDIT');
        const newUntil = roles.indexOf('AUDIT') < 0 ? '' : me.role === 'SUPER' ? f.elements.auditUntil.value : oldUntil;
        if (newUntil && newUntil !== oldUntil) op.grant = { role: 'AUDIT', until: newUntil, reason: val(f, 'reason') };
        if (oldUntil && !newUntil) op.endGrant = 'AUDIT';
        if (val(f, 'dept') !== a.dept) { set.dept = val(f, 'dept'); parts.push('조직: ' + a.dept + ' → ' + set.dept); }
        if (!sameRoles(roles, prevRoles)) { set.roles = roles; parts.push('권한: ' + roleNames(prevRoles, oldUntil) + ' → ' + roleNames(roles, newUntil)); }
        else if (oldUntil && newUntil !== oldUntil) parts.push('감사 열람 끝나는 날: ' + oldUntil + ' → ' + newUntil);
        if (status !== a.status) { set.status = status; parts.push('상태: ' + D.ACCOUNT_STATUS[a.status].label + ' → ' + D.ACCOUNT_STATUS[status].label); }
        const x = extrasOf(f, roles, a, status, op); // 역할 겹침(C-5)과 요청한 사람(C-7)
        if (x.change) parts.push(x.change);
        const label = (a.dept ? a.dept + ' ' : '') + a.name;
        // 기획자 결정 2026-11-03(C-44): 사용 중지, 영업 역할 빼기, 조직 옮기기 때 영업대표인 계약 수를 변경 이력의 바뀐 내용에도 남김(영업 리더가 새 영업대표를 정할 일)
        //   이미 맡을 수 없던 계정(예: 사용 중지 상태에서 조직만 고침)은 다시 남기지 않음
        const goneNow = repGone(a, roles, status), goneBefore = repGone(a);
        const reps = !goneBefore && (goneNow || set.dept) ? repBundles(a.id).all.length : 0;
        if (reps) parts.push('영업대표인 계약 ' + reps + '건은 ' + (goneNow ? '영업 리더가 새 영업대표를 정함' : '그대로 맡음(계약 유닛의 영업 리더가 필요하면 바꿈)'));
        const e = C.adminSave('USER', a.name + ' (' + a.email + ')', parts.join(', '), x.reason, op);
        fillDeptFilter();
        render();
        const n = releasedAt(e.at);
        C.toast((n ? label + '의 권한을 바꿨고, 사람으로 지정된 열람자 ' + n + '건이 풀려 관리자에게 이메일로 알렸습니다.' : label + '의 권한을 바꿨습니다.') +
          (reps ? ' 영업대표인 계약 ' + reps + '건은 영업 리더가 새 영업대표를 정할 때까지 맡습니다.' : ''));
      },
    });
  }
  /* ---------- 7. 조직 옮기기 (조직 개편, 기획자 결정 v0.31) ----------
   * 역할과 조직은 묶지 않으므로 옮겨도 역할은 그대로입니다. ③ 영업 검토는 기안자의 지금 조직으로 리더를 찾습니다. */
  function openMove() {
    const used = deptList();
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
          // 최고관리자 계정은 최고관리자만 옮김(수정 창과 같은 규칙, REQ-AUTH-14. v0.63 통제 목록 CTL-99 점검)
          // 본인도 뺌(2026-11-09 5회차 점검, CTL-99, 06 AC-43): 수정 창은 자기 줄을 막는데 조직 옮기기로는 자기 조직을 바꿀 수 있었음.
          //   조직이 바뀌면 ③ 영업 리더와 조직 단위 지정 열람자도 바뀜. 빠진 까닭은 목록 아래 한 줄로 보임
          const inDept = all.filter(function (a) { return a.dept === val(f, 'from') && (me.role === 'SUPER' || a.roles.indexOf('SUPER') < 0); });
          const list = inDept.filter(function (a) { return a.id !== me.id; });
          const selfNote = list.length < inDept.length ? '<p class="field-help move-self">본인은 다른 관리자가 옮깁니다.</p>' : '';
          f.querySelector('#move-people').innerHTML = list.length ? list.map(function (a) {
            return '<label class="choice"><input type="checkbox" name="people" value="' + esc(a.email) + '" checked>' + esc(a.name) +
              (a.status === 'SUSPENDED' ? ' (사용 중지)' : '') + '</label>';
          }).join('') + selfNote : '<p class="field-help">' + (val(f, 'from') ? '이 조직에는 옮길 수 있는 사람이 없습니다. 최고관리자 계정은 최고관리자만 옮기고, 본인은 다른 관리자가 옮깁니다.' : '지금 조직을 먼저 고르세요.') + '</p>';
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
        const e = C.adminSave('USER', val(f, 'from') + ' → ' + val(f, 'to'), '조직 옮기기: ' + names.join(', ') + ' (' + names.length + '명)', val(f, 'reason'),
          { k: 'ACCOUNTS_MOVE', emails: emails, to: val(f, 'to') });
        render();
        const n = releasedAt(e.at);
        C.toast(names.length + '명을 ' + C.josa(val(f, 'to'), '으로', '로') + ' 옮겼' + (n ? '고, 사람으로 지정된 열람자 ' + n + '건이 풀려 관리자에게 이메일로 알렸습니다.' : '습니다.'));
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
  // 검색 칸은 'input'이 이미 그렸으므로 'change'(칸을 떠날 때)에서 다시 그리지 않음. 다시 그리면 누르던 줄이나 쪽 번호가 바뀌어 클릭이 사라짐(2026-11-06 점검 4회차)
  $('#filter').addEventListener('change', function (e) { if (e.target.matches('input[type=search], input[type=text]')) return; page = 1; render(); });
  $('#filter').addEventListener('reset', function () { setTimeout(function () { page = 1; render(); }, 0); });
  $('#filter').addEventListener('submit', function (e) { e.preventDefault(); });
  $('#pagination').addEventListener('click', function (e) {
    const b = e.target.closest('button[data-page]');
    if (!b || b.disabled) return;
    page = Number(b.getAttribute('data-page'));
    render();
    // 쪽을 바꾸면 목록 맨 위로. 누른 단추가 없어지므로 초점도 목록 제목으로(2026-11-06 점검 3회차)
    C.focusSection('#users-title');
  });

  render();
})();
