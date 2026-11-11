/* =====================================================================
 * SCR-94 유닛 계정 확인 화면 로직 (unit-accounts.js)
 * ---------------------------------------------------------------------
 * 기획자 결정 2026-11-09 5회차 5번: 분기 권한 검토 때 유닛 리더에게 보내는 계정 목록
 *   이메일(UNIT_LIST)에는 "유닛 계정 목록을 확인해 주세요"와 계정 수만 담고, 버튼을 누르면 이 화면으로 옴.
 *   직원 정보(이름, 이메일, 역할)가 메일 서비스로 나가지 않게 하려는 것(메일 틀 원칙: 정보는 시스템 안에서 봄, REQ-ENV-14)
 * 관련: REQ-SEC-05(분기 권한 검토), 기획자 결정 2026-11-02 C-7(유닛 리더에게 계정 목록), 06 CTL-114, 접속 기록 점검 SCR-57(admin-logs.js)
 * 볼 수 있는 사람: 그 분기에 확인 요청을 받은 리더 본인(보낸 기록 op.k UNIT_LIST_SENT의 units[].to)
 *   기획자 결정 2026-11-10 19번(예전 [가정: 리더 본인만, 대리 지정은 따르지 않음]을 바꿈): 대리 지정 기간에는 그 리더의 대신할 사람도
 *     그 유닛 목록을 보고 "확인함"을 남김. 대리 지정은 결재선 규칙의 것(D.DELEGATIONS)을 그대로 쓰고, 지금 진행 중인 지정만(C.activeDelegation, 결재 문서와 같은 판단)
 *     기록에는 누구 대신인지(onBehalfOf)와 대리 지정 번호(delegationId)를 남기고, 화면에는 "누구 대신"이 보임. 리더 본인도 그 기간에 남길 수 있음
 *   자기에게 온(또는 대신 맡은) 유닛의 계정만 보임. 요청을 받지 않은 사람(최고관리자 포함)에게는 안내만 보이고 목록은 없음
 * 하는 일
 *   1. 분기 고르기: 나에게 확인 요청이 온 분기(최근 것부터). 주소 ?q=2026-Q3로 들어오면 그 분기
 *   2. 유닛마다: 요청 받은 때와 보낸 사람, 계정 표(이름, 이메일, 역할, 상태, 마지막 로그인)
 *      계정은 보낸 기록과 같이 사용 중지가 아닌 계정(사용 중, 첫 접속 전)이고 지금 상태로 보임
 *   3. 확인함: 계정마다 "퇴사", "휴직", "이동" 표시(선택, 짧은 메모)와 이상한 계정(선택)을 적고 남김.
 *      기록은 관리자 변경 이력의 점검 기록(AUDIT, op.k UNIT_LIST_ACK, 쌓기만 함)
 *      { quarter, unit, n: 그때 본 계정 수, sentAt: 받은 요청 일시, seen: 그때 본 계정 목록 글, note: 적은 이상한 계정,
 *        onBehalfOf: 대신 남겼으면 그 리더(아니면 null), delegationId: 그 대리 지정 번호, marks: [{ id, name, email, mark, note }] }
 *      그 분기 그 유닛에 확인이 있으면 단추 대신 "확인함" 배지와 확인한 사람, 일시. 읽기만 하는 역할은 단추가 없음
 *   기획자 결정 2026-11-10 21번(5회차 15번의 인사 명단 파일 올리기를 갈음): 표시한 계정은 정보보호 담당자의 분기 권한 검토(SCR-57)에
 *     "조치할 계정"으로 올라가고, 사용 중지나 조직 옮기기로 처리되기 전에는 그 분기 검토에 "이상 없음"을 남기지 못함
 *     표시 코드 mark: RESIGN 퇴사, LEAVE 휴직, MOVE 이동(admin-logs.js MARKS와 같음). 메모는 60자까지 [가정]
 * 프로토타입: 확인은 이 브라우저의 시연 기록(C.adminSave)에 남음. 실제 시스템은 서버에 남기고 로그인해야 들어옴
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  function val(f, n) { return (f.elements[n].value || '').trim(); }
  // '2026-Q3' → '2026년 3분기' (접속 기록 점검과 같은 이름)
  function quarterLabel(key) { return key.slice(0, 4) + '년 ' + key.slice(6) + '분기'; }
  // 계정 표시 이름(기획자 결정 2026-11-10 21번). admin-logs.js MARKS와 같은 코드
  const MARKS = { RESIGN: '퇴사', LEAVE: '휴직', MOVE: '이동' };
  const MARK_NOTE_MAX = 60; // 짧은 메모 [가정]

  // 나에게 온 확인 요청: 보낸 기록마다 내가 받은 유닛과, 지금 대리 지정으로 내가 대신 맡은 리더의 유닛만 남김. 최근 것부터
  //   [{ at, by, quarter, units: [{ unit, to, n, onBehalfOf, delegationId }] }] (기획자 결정 2026-11-10 19번)
  function sendsToMe() {
    return D.ADMIN_LOG.filter(function (e) { return e.op && e.op.k === 'UNIT_LIST_SENT' && e.op.r; }).map(function (e) {
      const units = [];
      (e.op.r.units || []).forEach(function (u) {
        if (u.to === me.id) { units.push(Object.assign({}, u, { onBehalfOf: null, delegationId: null })); return; }
        const dl = u.to ? C.activeDelegation(u.to, me.id) : null; // 결재 문서(isMyStep, recordAction)와 같은 판단
        if (dl) units.push(Object.assign({}, u, { onBehalfOf: u.to, delegationId: dl.id }));
      });
      return { at: e.at, by: e.by, quarter: e.op.r.quarter, units: units };
    }).filter(function (s) { return s.units.length; }).sort(function (a, b) { return b.at.localeCompare(a.at); });
  }
  // 그 분기 그 유닛의 확인(마지막 것) 또는 null
  function ackOf(quarter, unit) {
    return D.ADMIN_LOG.filter(function (e) { return e.op && e.op.k === 'UNIT_LIST_ACK' && e.op.r && e.op.r.quarter === quarter && e.op.r.unit === unit; })
      .sort(function (a, b) { return b.at.localeCompare(a.at); }).map(function (e) { return Object.assign({ by: e.by, at: e.at }, e.op.r); })[0] || null;
  }
  // 유닛 계정: 보낸 기록과 같은 기준(사용 중지가 아닌 계정), 이름 차례
  function unitAccounts(unit) {
    return D.ACCOUNTS.filter(function (a) { return a.dept === unit && a.status !== 'SUSPENDED'; })
      .sort(function (a, b) { return a.name.localeCompare(b.name, 'ko'); });
  }
  function rolesText(a) { return C.activeRoles(a).map(C.roleLabel).join(', ') || '역할 없음'; }
  function statusOf(a) { return D.ACCOUNT_STATUS[a.status] || { label: a.status, tone: 'line' }; }
  // 남기는 자료(그때 본 계정): "이도윤(영업 담당자, 사용 중, 마지막 로그인 2026-10-19)" 꼴
  function seenText(list) {
    return '계정 ' + list.length + '개: ' + list.map(function (a) {
      return a.name + '(' + rolesText(a) + ', ' + statusOf(a).label + ', 마지막 로그인 ' + (a.lastLoginAt ? C.fmtDate(a.lastLoginAt.slice(0, 10)) : '없음') + ')';
    }).join(', ');
  }
  // 확인한 사람: "비즈니스유닛 문태호(비즈니스2유닛 고은성 대신)" (기획자 결정 2026-11-10 19번)
  function ackWho(k) { return C.ownerLabel(k.by) + (k.onBehalfOf ? '(' + C.ownerLabel(k.onBehalfOf) + ' 대신)' : ''); }

  const all = sendsToMe();
  const quarters = all.map(function (s) { return s.quarter; }).filter(function (q, i, arr) { return arr.indexOf(q) === i; });
  if (!quarters.length) {
    // 요청을 받지 않은 사람: 목록 없이 안내만(다른 유닛의 계정을 보이지 않음)
    //   시연 안내에 대리 지정 예(DL-002 고은성 대신 문태호, 2026-10-19~2026-10-23)도 적음(기획자 결정 2026-11-10 19번)
    $('#notice').innerHTML = C.noticeBox('', '확인을 요청받은 유닛 계정 목록이 없습니다',
      '이 화면은 분기 권한 검토 때 정보보호 담당자가 확인을 요청한 유닛 리더(대리 지정 기간에는 대신할 사람)가 자기 유닛 계정만 봅니다. 지금은 ' + esc(C.roleLabel(me.role)) +
      ' 역할로 보고 있습니다. 시연에서는 화면 맨 위 검은 띠에서 영업 리더로 바꾸면 비즈니스1유닛의 예시를, 영업 임원으로 바꾸면 대리 지정으로 대신 맡은 비즈니스2유닛의 예시를 볼 수 있습니다.');
    $('#content').hidden = true;
    return;
  }
  const want = new URLSearchParams(location.search).get('q');
  let sel = quarters.indexOf(want) > -1 ? want : quarters[0];
  $('#ua-quarter').innerHTML = quarters.map(function (q) { return '<option value="' + esc(q) + '"' + (q === sel ? ' selected' : '') + '>' + esc(quarterLabel(q)) + '</option>'; }).join('');
  const canAck = !C.isReadOnly(me);

  // 그 분기에 나에게 온(또는 대신 맡은) 유닛: 유닛마다 가장 최근 요청 { unit, n, at, by, onBehalfOf, delegationId }
  function unitsOf(q) {
    const out = [];
    all.filter(function (s) { return s.quarter === q; }).forEach(function (s) {
      s.units.forEach(function (u) {
        if (!out.some(function (x) { return x.unit === u.unit; })) out.push({ unit: u.unit, n: u.n, at: s.at, by: s.by, onBehalfOf: u.onBehalfOf, delegationId: u.delegationId });
      });
    });
    return out;
  }
  // 대신 맡은 유닛의 "누구 대신" 글: "비즈니스2유닛 고은성 대신(대리 지정 2026-10-19~2026-10-23)" (2026-11-10 19번)
  function proxyText(u) {
    if (!u.onBehalfOf) return '';
    const d = D.DELEGATIONS.filter(function (x) { return x.id === u.delegationId; })[0];
    return C.ownerLabel(u.onBehalfOf) + ' 대신' + (d ? '(대리 지정 ' + C.fmtPeriod(d.from, d.to) + ')' : '');
  }
  // 계정 줄의 표시(확인 기록의 marks): 상태 칸 아래 작은 줄 "퇴사 표시: 메모" (2026-11-10 21번)
  function markOf(ack, a) { return ack && ack.marks ? ack.marks.filter(function (m) { return m.id === a.id; })[0] || null : null; }
  function unitHtml(u, i) {
    const list = unitAccounts(u.unit), ack = ackOf(sel, u.unit);
    const head = ack ? C.badge('success', '확인함')
      : canAck ? '<button type="button" class="btn btn--primary btn--md" data-ack="' + esc(u.unit) + '">확인함 남기기<span class="sr-only"> ' + esc(u.unit) + '</span></button>' : '';
    const marked = ack && ack.marks ? ack.marks.length : 0;
    return '<section class="panel" aria-labelledby="ua-sec-' + i + '">' +
      '<div class="panel-head panel-head--act"><h2 class="panel-title" id="ua-sec-' + i + '">' + esc(u.unit) + ' <span class="badge badge--line">계정 ' + list.length + '개</span></h2>' + head + '</div>' +
      '<p class="panel-desc">' + C.meta([['요청 받은 때', esc(C.fmtDateTime(u.at))], ['요청한 사람', esc(C.ownerLabel(u.by))], ['요청 때 계정', u.n + '개']]
        .concat(u.onBehalfOf ? [['누구 대신', esc(proxyText(u))]] : [])) + '</p>' + // 대신 맡은 유닛(2026-11-10 19번)
      (ack ? '<p class="panel-desc">' + C.meta([['확인한 사람', esc(ackWho(ack))], ['확인한 때', esc(C.fmtDateTime(ack.at))],
        ['퇴사, 휴직, 이동 표시', marked + '개'], ['이상한 계정', esc(ack.note || '없음')]]) + '</p>' : '') +
      '<div class="tbl-scroll" tabindex="0" role="region" aria-label="' + esc(u.unit) + ' 계정 표">' +
        '<table class="tbl tbl--compact"><caption class="sr-only">' + esc(u.unit) + ' 계정: 이름, 이메일, 역할, 상태와 표시, 마지막 로그인</caption>' +
        '<thead><tr><th scope="col" class="center">이름</th><th scope="col" class="col-phone-wide">이메일</th><th scope="col">역할</th><th scope="col" class="center">상태</th><th scope="col" class="center">마지막 로그인</th></tr></thead><tbody>' +
        (list.length ? list.map(function (a) {
          const st = statusOf(a), mk = markOf(ack, a);
          return '<tr><td class="center nowrap"><span class="cell-strong">' + esc(a.name) + '</span></td><td>' + esc(a.email) + '</td><td>' + esc(rolesText(a)) + '</td>' +
            '<td class="center nowrap">' + C.badge(st.tone, st.label) +
              (mk ? '<span class="cell-meta"><span class="ua-mark-tag">' + esc(MARKS[mk.mark] || mk.mark) + '</span> 표시' + (mk.note ? ': ' + esc(mk.note) : '') + '</span>' : '') + '</td>' +
            '<td class="center">' + (a.lastLoginAt ? C.fmtDateTime(a.lastLoginAt).split(' ').map(function (s) { return '<span class="keep">' + s + '</span>'; }).join(' ') : '-') + '</td></tr>';
        }).join('') : '<tr><td class="empty-row" colspan="5">이 유닛에 지금 사용 중인 계정이 없습니다.</td></tr>') +
        '</tbody></table></div></section>';
  }
  function render() {
    $('#ua-units').innerHTML = unitsOf(sel).map(unitHtml).join('');
  }
  // 계정마다 "퇴사, 휴직, 이동" 표시 줄(기획자 결정 2026-11-10 21번): 이름 | 표시 고르기 | 짧은 메모. 고르기와 메모에는 그 사람 이름을 붙임(화면낭독기)
  function marksHtml(list) {
    if (!list.length) return '';
    return '<fieldset class="field ua-marks"><legend class="field-label">퇴사, 휴직, 이동 표시 <span class="opt">(선택)</span></legend>' +
      '<p class="field-help">고른 계정은 정보보호 담당자의 분기 권한 검토에 "조치할 계정"으로 올라가고, 관리자가 사용 중지하거나 조직을 옮길 때까지 남습니다.</p>' +
      list.map(function (a, i) {
        return '<div class="ua-mark-row"><span class="ua-mark-name">' + esc(a.name) + '</span>' +
          '<select class="select" name="mk-' + i + '" aria-label="' + esc(a.name) + ' 표시"><option value="">표시 없음</option>' +
            Object.keys(MARKS).map(function (k) { return '<option value="' + k + '">' + MARKS[k] + '</option>'; }).join('') + '</select>' +
          '<input class="input" type="text" name="mn-' + i + '" maxlength="' + MARK_NOTE_MAX + '" placeholder="짧은 메모(선택)" aria-label="' + esc(a.name) + ' 메모" autocomplete="off"></div>';
      }).join('') + '</fieldset>';
  }
  function openAck(unit) {
    const u = unitsOf(sel).filter(function (x) { return x.unit === unit; })[0];
    // 대리 지정이 그사이 끝났으면 남기지 않음(2026-11-10 19번: 대리 지정 기간에만)
    if (u && u.onBehalfOf && !C.activeDelegation(u.onBehalfOf, me.id)) { C.toast('대리 지정 기간이 끝나 ' + C.ownerLabel(u.onBehalfOf) + ' 대신 확인할 수 없습니다.', true); return; }
    const list = unitAccounts(unit);
    const count = function (s) { return list.filter(function (a) { return a.status === s; }).length; };
    C.formModal({
      title: quarterLabel(sel) + ' ' + unit + ' 계정을 확인했나요?',
      desc: '저장하면 확인한 사람과 일시, 그때 본 계정 목록과 표시가 남고 고칠 수 없습니다. 표시한 계정과 적은 이상한 계정은 정보보호 담당자가 분기 권한 검토에서 봅니다.' +
        (u && u.onBehalfOf ? ' ' + proxyText(u) + ' 확인으로 남습니다.' : ''), // 대신 남기면 누구 대신인지 미리 알림(2026-11-10 19번)
      body: '<p class="modal-info">계정 ' + list.length + '개: 사용 중 ' + count('ACTIVE') + '개, 첫 접속 전 ' + count('INVITED') + '개' +
          (u && u.n !== list.length ? '. 요청 때는 ' + u.n + '개였습니다' : '') + '</p>' +
        marksHtml(list) +
        C.fieldHtml({ name: 'note', label: '이상한 계정', type: 'textarea', optional: true,
          placeholder: '예: 영업 담당자인데 관리자 역할도 가진 사람이 있음', help: '퇴사, 휴직, 이동 밖의 일(하는 일과 맞지 않는 역할 등)이 있으면 적습니다. 없으면 비워 둡니다.' }),
      btn: '확인함 남기기',
      done: function (f) {
        const note = val(f, 'note');
        // 고른 표시만 모음(메모만 적고 표시를 고르지 않은 줄은 남기지 않음)
        const marks = list.map(function (a, i) {
          const mk = f.elements['mk-' + i].value;
          return mk ? { id: a.id, name: a.name, email: a.email, mark: mk, note: val(f, 'mn-' + i).slice(0, MARK_NOTE_MAX) } : null;
        }).filter(Boolean);
        const r = { quarter: sel, unit: unit, n: list.length, sentAt: u ? u.at : '', seen: seenText(list), note: note,
          onBehalfOf: u && u.onBehalfOf ? u.onBehalfOf : null, delegationId: u && u.delegationId ? u.delegationId : null, marks: marks };
        const markText = marks.map(function (m) { return m.name + ' ' + MARKS[m.mark] + (m.note ? '(' + m.note + ')' : ''); }).join(', ');
        const e = C.adminSave('AUDIT', quarterLabel(sel) + ' 유닛 계정 확인(' + unit + ')',
          '확인함(계정 ' + list.length + '개)' + (r.onBehalfOf ? ', ' + C.ownerLabel(r.onBehalfOf) + ' 대신' : '') +
            (marks.length ? ', 퇴사 휴직 이동 표시 ' + marks.length + '개' : '') + (note ? ', 이상한 계정 적음' : ''),
          [markText ? '표시: ' + markText : '', note || (markText ? '' : '이상한 계정 없음')].filter(Boolean).join(' / '), { k: 'UNIT_LIST_ACK', r: r });
        if (e.refused) return; // 읽기만 하는 역할(C-2)
        render();
        C.toast(unit + ' 계정 확인을 남겼습니다.' + (marks.length ? ' 표시한 ' + marks.length + '개는 정보보호 담당자의 분기 권한 검토에 올라갑니다.' : ''));
      },
    });
  }

  $('#ua-quarter').addEventListener('change', function (e) { sel = e.target.value; render(); });
  $('#ua-filter').addEventListener('submit', function (e) { e.preventDefault(); });
  $('#content').addEventListener('click', function (e) {
    const b = e.target.closest('[data-ack]');
    if (b) openAck(b.getAttribute('data-ack'));
  });
  render();
})();
