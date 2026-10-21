/* =====================================================================
 * SCR-52 결재선 규칙 화면 로직 (admin-rules.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-AUTH-06(단계별 담당자, 금액 기준 없음), REQ-CHK-05(거치는 조건), REQ-REV-08(대리 지정),
 *               REQ-ENV-10(독촉), REQ-SEC-05(바꾼 기록)
 * 하는 일
 *   1. 단계별 담당자: 단계, 거치는 조건(보여 주기만), 담당자, 지금 차례인 건 수, 바꾸기
 *      바꾸면 아직 차례가 오지 않은 단계부터 새 담당자에게 감. 지금 차례인 건은 원래 담당자가 처리 (기획자 결정 v0.25)
 *      ⑦ 체결본 등록은 기안한 영업이 하므로 바꿀 수 없음
 *      ③ 영업 검토는 유닛별 리더(구성원 계약)와 영업 임원(리더 본인 계약)으로 나눠 정함 (v0.26 재무 문서 반영)
 *   2. 대리 지정: 자리를 비우는 담당자, 대신할 사람(같은 역할. 영업 리더는 영업 임원도), 기간, 근거 (기획자 결정 v0.25)
 *      기간 안에는 대신할 사람이 처리하고 결재 기록에 "누구 대신"과 근거가 남음(common.js recordAction)
 *   3. 독촉 기준 일수: 결재 대기 강조, 체결 지연 독촉
 *   4. 변경 이력: 누가, 언제, 무엇을, 사유. 고치거나 지울 수 없음
 * 프로토타입: 바꾼 내용은 이 브라우저에만 저장(시연 기록). 실제 시스템은 서버에 저장하고 사내망에서만 씀(REQ-SEC-04)
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  if (!C.gate(me, ['ADMIN'], '결재선 규칙은 관리자만 씁니다')) return;

  // 입력 칸 값 (칸 이름이 form의 속성 이름과 겹치지 않게 elements로 읽음)
  function val(f, n) { return (f.elements[n].value || '').trim(); }

  /* ---------- 단계마다 거치는 조건 (REQ-CHK-05, REQ-SIGN-01, REQ-ARC-06, 07) ---------- */
  const ROWS = [
    ['S02', '모든 계약 (해지, 그대로 연장, 운영 변경은 없음). 기안자가 담당자면 재무 담당자가 대신 검토'],
    ['S03', '할인율 한도를 넘긴 계약, 해지, 그대로 연장, 운영 변경(기간 2개월 넘게 바뀜, 무상 충전 50건 초과). 구성원 계약은 유닛 리더(아래 표), 리더 본인 계약은 영업 임원'],
    ['S04', '표준계약서를 바꾼 계약, 해지, 그대로 연장'],
    ['S05', '개인정보를 처리하는 계약 (해지, 그대로 연장, 운영 변경은 없음)'],
    ['S06', '모든 계약 (해지, 그대로 연장, 운영 변경은 없음)'],
    ['S07', '모든 계약 (해지, 그대로 연장, 운영 변경은 없음)'],
    ['S08', '모든 계약 (해지, 그대로 연장, 운영 변경은 없음). 기안자가 담당자면 재무 담당자가 대신 확인'],
    ['S09', '모든 계약. 운영 변경의 HR 충전은 재무(⑩ 담당자)가 반영'],
    ['S10', '모든 계약 (운영 변경은 없음)'],
  ];

  function account(id) { return D.ACCOUNTS.filter(function (a) { return a.id === id; })[0] || null; }
  function person(id) {
    const a = account(id);
    return '<span class="cell-strong">' + esc(C.userName(id)) + '님</span>' + (a ? '<span class="cell-meta">' + esc(a.dept) + '</span>' : '');
  }
  // 그 역할(또는 그 분야 리더)이 있는, 사용 중지가 아닌 사람 (v0.29: 영업지원, 정보보호, 고객지원 리더도 고를 수 있음 [가정])
  function candidates(role, exceptId) {
    return D.ACCOUNTS.filter(function (a) { return C.canTake(a.roles, role) && a.status !== 'SUSPENDED' && a.id !== exceptId; });
  }
  function pendingCount(code) { return C.pendingQueue(me, true, [code]).length; }
  // 지금 차례인 건 중 원래 담당자가 처리하는 건 (담당자를 바꾼 뒤): "김지우님 4건"
  function holders(code, cur) {
    const by = {};
    C.pendingQueue(me, true, [code]).forEach(function (x) { if (x.s.userId !== cur) by[x.s.userId] = (by[x.s.userId] || 0) + 1; });
    return Object.keys(by).map(function (id) { return '<span class="cell-meta">' + esc(C.userName(id)) + '님 ' + by[id] + '건</span>'; }).join('');
  }
  function stepName(code) { return D.STEPS[code].no + ' ' + D.STEPS[code].name; }
  // 이 사람이 지금 맡은 결재 담당 (예: 배수아님은 ②와 ⑧, 최민준님은 ③ 비즈니스1유닛 리더)
  function dutyNames(id) { return C.duties(id).map(function (x) { return x.label; }).join(', '); }
  function dutyNos(id) { return C.duties(id).map(function (x) { return x.label.charAt(0) + (x.key.indexOf(':') > -1 ? '(' + x.key.split(':')[1] + ')' : ''); }).join(', '); }
  // 유닛별 리더 표의 유닛: 처음 설정(TEAM_LEADERS)과 관리자가 더한 유닛 (조직 개편 v0.31)
  function teams() {
    const out = Object.keys(D.TEAM_LEADERS);
    D.ASSIGNEE_CHANGES.forEach(function (x) {
      const t = x.step.indexOf('S03:') === 0 ? x.step.slice(4) : '';
      if (t && out.indexOf(t) < 0) out.push(t);
    });
    return out;
  }
  function period(d) { return C.fmtPeriod(d.from, d.to); }
  const DL_STATE = { PLANNED: ['line', '예정'], ACTIVE: ['progress', '대리 중'], ENDED: ['neutral', '끝남'] };

  /* ---------- 1. 단계별 담당자 ---------- */
  function delegNote(id) {
    return D.DELEGATIONS.filter(function (d) { return d.absentId === id && C.delegationState(d) !== 'ENDED'; }).map(function (d) {
      return '<span class="cell-meta">' + (C.delegationState(d) === 'ACTIVE' ? '대리 중: ' : '대리 예정: ') +
        esc(C.userName(d.delegateId)) + '님 (' + period(d) + ')</span>';
    }).join('');
  }
  function renderAssignees() {
    $('#assignee-rows').innerHTML = ROWS.map(function (r) {
      const code = r[0], st = D.STEPS[code], fixed = code === 'S07';
      const id = fixed ? null : C.assigneeOf(code);
      // ③은 리더 본인 계약의 영업 임원만 이 줄에서 바꾸고, 구성원 계약은 아래 유닛별 리더 표에서 바꿈
      const who = fixed ? '기안한 영업' : (code === 'S03' ? '<span class="cell-meta">리더 본인 계약</span>' : '') + person(id) + delegNote(id) +
        (code === 'S03' ? '<span class="cell-meta">구성원 계약은 아래 유닛별 리더</span>' : '');
      return '<tr><td class="nowrap"><span class="cell-strong">' + esc(stepName(code)) + '</span><span class="cell-meta">' + esc(C.roleLabel(st.role)) + '</span></td>' +
        '<td class="col-wide">' + esc(r[1]) + '</td>' +
        '<td>' + who + '</td>' +
        // ③ 줄은 리더 본인 계약(영업 임원 차례)만 셈. 구성원 계약은 아래 유닛별 리더 표에서
        '<td class="num">' + (code === 'S03'
          ? C.pendingQueue(me, true, ['S03']).filter(function (x) { return x.s.userId === id; }).length + '건'
          : pendingCount(code) + '건' + (fixed ? '' : holders(code, id))) + '</td>' +
        '<td class="col-action">' + (fixed ? '-' : '<button type="button" class="link-act" data-change="' + code + '" aria-label="' + esc(stepName(code)) + ' 담당자 바꾸기">바꾸기</button>') + '</td></tr>';
    }).join('');
    // ③ 영업 검토 유닛별 리더 (재무 문서: 소속 유닛원의 계약은 소속 리더가 승인)
    $('#leader-rows').innerHTML = teams().map(function (team) {
      const id = C.leaderAt(team, '9999');
      const list = C.pendingQueue(me, true, ['S03']).filter(function (x) { return C.teamOf(x.c.requesterId) === team; });
      const others = list.filter(function (x) { return x.s.userId !== id; }).length;
      return '<tr><td class="nowrap cell-strong">' + esc(team) + '</td><td>' + (id ? person(id) + delegNote(id) : '<span class="cell-meta">리더 없음: 영업 임원이 검토</span>') + '</td>' +
        '<td class="num">' + list.length + '건' + (others ? '<span class="cell-meta">원래 리더 ' + others + '건</span>' : '') + '</td>' +
        '<td class="col-action"><button type="button" class="link-act" data-team="' + esc(team) + '" aria-label="' + esc(team) + ' 리더 바꾸기">바꾸기</button></td></tr>';
    }).join('');
  }
  function openLeader(team) {
    const cur = C.leaderAt(team, '9999');
    const opts = candidates('HEAD', cur).map(function (a) { return [a.id, a.name + ' (' + a.dept + ')']; });
    const n = C.pendingQueue(me, true, ['S03']).filter(function (x) { return C.teamOf(x.c.requesterId) === team; }).length;
    C.formModal({
      title: team + ' 리더를 바꿀까요?',
      desc: '바꾸면 ' + team + ' 계약 중 아직 ③ 영업 검토 차례가 오지 않은 것부터 새 리더에게 갑니다.' + (n ? ' 지금 차례인 ' + n + '건은 ' + C.userName(cur) + '님이 그대로 처리합니다.' : ''),
      body: '<p class="modal-info">지금 리더: ' + (cur ? esc(C.userName(cur)) + '님' : '없음') + '</p>' +
        C.fieldHtml({ name: 'to', label: '새 리더', type: 'select', required: true, options: [['', '고르세요']].concat(opts), help: '영업 리더 역할이 있는 사람만 고를 수 있습니다.' }) +
        C.fieldHtml({ name: 'reason', label: '바꾸는 사유', type: 'textarea', required: true, placeholder: '예: 10월 20일 비즈니스2유닛 리더 발령' }),
      btn: '리더 바꾸기',
      check: function (f) { return { to: val(f, 'to') ? '' : '새 리더를 고르세요.', reason: val(f, 'reason') ? '' : '바꾸는 사유를 적으세요.' }; },
      done: function (f) {
        const to = val(f, 'to');
        C.adminSave('RULE', stepName('S03') + '(' + team + ' 리더)', '리더: ' + (cur ? C.userName(cur) : '없음') + ' → ' + C.userName(to), val(f, 'reason'),
          { k: 'ASSIGNEE', step: 'S03:' + team, to: to });
        render();
        C.toast(team + ' 리더를 ' + C.userName(to) + '님으로 바꿨습니다.');
      },
    });
  }
  // 유닛 추가: 조직 개편으로 새 유닛이 생기면 표에 더하고 리더를 정함 (v0.31)
  function openAddUnit() {
    const cur = teams();
    const units = C.codeList('DEPT').filter(function (x) { return cur.indexOf(x.label) < 0; });
    if (!units.length) { C.toast('더할 수 있는 유닛이 없습니다. 새 유닛은 코드 관리에서 먼저 추가하세요.', true); return; }
    const opts = candidates('HEAD').map(function (a) { return [a.id, a.name + ' (' + a.dept + ')']; });
    C.formModal({
      title: '유닛별 리더 표에 유닛을 더할까요?',
      desc: '더하면 그 유닛 사람이 기안하는 계약의 ③ 영업 검토가 정한 리더에게 갑니다. 표에 없는 유닛의 계약은 영업 임원이 검토합니다.',
      body: C.fieldHtml({ name: 'unit', label: '유닛', type: 'select', required: true, options: [['', '고르세요']].concat(units.map(function (x) { return [x.label, x.label]; })),
          help: '조직 목록(코드 관리)에 있는 조직 중 아직 표에 없는 것만 고를 수 있습니다.' }) +
        C.fieldHtml({ name: 'to', label: '리더', type: 'select', required: true, options: [['', '고르세요']].concat(opts), help: '영업 리더 역할이 있는 사람만 고를 수 있습니다.' }) +
        C.fieldHtml({ name: 'reason', label: '더하는 사유', type: 'textarea', required: true, placeholder: '예: 2027년 1월 조직 개편으로 비즈니스4유닛 신설' }),
      btn: '유닛 추가',
      check: function (f) {
        return { unit: val(f, 'unit') ? '' : '유닛을 고르세요.', to: val(f, 'to') ? '' : '리더를 고르세요.', reason: val(f, 'reason') ? '' : '더하는 사유를 적으세요.' };
      },
      done: function (f) {
        const unit = val(f, 'unit'), to = val(f, 'to');
        C.adminSave('RULE', stepName('S03') + '(' + unit + ' 리더)', '유닛 추가, 리더: ' + C.userName(to), val(f, 'reason'), { k: 'ASSIGNEE', step: 'S03:' + unit, to: to });
        render();
        C.toast(C.josa(unit, '을', '를') + ' 더하고 리더를 ' + C.userName(to) + '님으로 정했습니다.');
      },
    });
  }
  function openChange(code) {
    // ③ 줄은 리더 본인 계약의 담당(영업 임원)
    const st = D.STEPS[code], cur = C.assigneeOf(code), role = code === 'S03' ? 'EXEC' : st.role;
    const n = code === 'S03' ? C.pendingQueue(me, true, ['S03']).filter(function (x) { return x.s.userId === cur; }).length : pendingCount(code);
    const opts = candidates(role, cur).map(function (a) { return [a.id, a.name + ' (' + a.dept + ')']; });
    if (!opts.length) { C.toast('바꿀 수 있는 ' + C.roleLabel(role) + ' 역할의 사람이 없으니 사용자 권한 관리에서 먼저 역할을 주세요.', true); return; }
    C.formModal({
      title: stepName(code) + ' 담당자를 바꿀까요?',
      desc: '바꾸면 아직 차례가 오지 않은 계약부터 새 담당자에게 갑니다.' + (n ? ' 지금 차례인 ' + n + '건은 ' + C.userName(cur) + '님이 그대로 처리합니다.' : ''),
      body: '<p class="modal-info">지금 담당자: ' + esc(C.userName(cur)) + '님</p>' +
        C.fieldHtml({ name: 'to', label: '새 담당자', type: 'select', required: true, options: [['', '고르세요']].concat(opts),
          // 그 분야 리더도 고를 수 있음 (v0.29 가정, C.canTake)
          help: C.roleLabel(role) + ' 역할' + (D.STEP_LEADS.some(function (r) { return D.ROLE_BASE[r] === role; }) ? '이나 그 분야 리더 역할' : '') + '이 있는 사람만 고를 수 있습니다.' }) +
        C.fieldHtml({ name: 'reason', label: '바꾸는 사유', type: 'textarea', required: true, placeholder: '예: 인사 이동으로 담당 변경' }),
      btn: '담당자 바꾸기',
      check: function (f) {
        return { to: val(f, 'to') ? '' : '새 담당자를 고르세요.', reason: val(f, 'reason') ? '' : '바꾸는 사유를 적으세요.' };
      },
      done: function (f) {
        const to = val(f, 'to');
        C.adminSave('RULE', stepName(code) + ' 담당자', '담당자: ' + C.userName(cur) + ' → ' + C.userName(to), val(f, 'reason'), { k: 'ASSIGNEE', step: code, to: to });
        render();
        C.toast(D.STEPS[code].no + ' 담당자를 ' + C.userName(to) + '님으로 바꿨습니다.');
      },
    });
  }

  /* ---------- 2. 대리 지정 ---------- */
  function renderDelegations() {
    const order = { ACTIVE: 0, PLANNED: 1, ENDED: 2 };
    const list = D.DELEGATIONS.slice().sort(function (a, b) {
      return order[C.delegationState(a)] - order[C.delegationState(b)] || b.from.localeCompare(a.from);
    });
    $('#delegate-rows').innerHTML = list.length ? list.map(function (d) {
      const state = C.delegationState(d), tag = DL_STATE[state];
      const steps = dutyNos(d.absentId);
      return '<tr' + (state === 'ENDED' ? ' class="is-muted"' : '') + '>' +
        '<td>' + person(d.absentId) + (steps ? '<span class="cell-meta">맡은 단계 ' + esc(steps) + '</span>' : '') + '</td>' +
        '<td>' + person(d.delegateId) + '</td>' +
        '<td class="num-left">' + C.fmtDate(d.from) + '<br>~ ' + C.fmtDate(d.to) + (d.endedAt ? '<span class="cell-meta">' + C.fmtDate(d.endedAt) + ' 끝냄</span>' : '') + '</td>' +
        '<td class="col-wide">' + esc(d.reason) + '</td>' +
        '<td class="nowrap">' + C.badge(tag[0], tag[1]) + '</td>' +
        '<td class="col-action">' + (state === 'ENDED' ? '-' : '<button type="button" class="link-act link-act--danger" data-end="' + esc(d.id) + '">' + (state === 'ACTIVE' ? '끝내기' : '취소') + '</button>') + '</td></tr>';
    }).join('') : '<tr><td class="empty-row" colspan="6">대리 지정이 없습니다.</td></tr>';
  }
  // 대신할 수 있는 사람: 같은 역할. 영업 리더(③ 영업 검토)는 영업 임원도 (REQ-AUTH-12)
  function subCandidates(absentId) {
    const duties = C.duties(absentId);
    if (!duties.length) return [];
    const role = duties[0].role;
    let list = candidates(role, absentId);
    if (role === 'HEAD') list = list.concat(candidates('EXEC', absentId));
    return list;
  }
  function openDelegate() {
    // 지금 결재 담당이 있는 사람 (단계 담당자, 유닛 리더, 영업 임원)
    const ids = D.ACCOUNTS.filter(function (a) { return C.duties(a.id).length; }).map(function (a) { return a.id; });
    const absentOpts = ids.map(function (id) { return [id, C.userName(id) + ' (' + dutyNos(id) + ' ' + C.roleLabel(C.duties(id)[0].role) + ')']; });
    C.formModal({
      title: '대리 지정을 추가할까요?',
      desc: '기간 안에는 대신할 사람이 이 담당자의 차례를 처리하고, 결재 기록에 누구 대신인지와 근거가 남습니다.',
      body: C.fieldHtml({ name: 'absent', label: '자리를 비우는 담당자', type: 'select', required: true, options: [['', '고르세요']].concat(absentOpts) }) +
        C.fieldHtml({ name: 'sub', label: '대신할 사람', type: 'select', required: true, options: [['', '담당자를 먼저 고르세요']],
          help: '같은 역할(영업지원, 정보보호, 고객지원은 그 분야 리더도)이 있는 사람만 고를 수 있습니다. 영업 리더는 영업 임원도 고를 수 있습니다.' }) +
        '<div class="field-row">' +
          C.fieldHtml({ name: 'from', label: '시작일', type: 'date', required: true, value: D.TODAY, attrs: ' min="' + D.TODAY + '"' }) +
          C.fieldHtml({ name: 'to', label: '종료일', type: 'date', required: true, attrs: ' min="' + D.TODAY + '"' }) +
        '</div>' +
        C.fieldHtml({ name: 'reason', label: '근거', type: 'textarea', required: true,
          placeholder: '예: 고은성님 해외 출장(2026-10-19~2026-10-23). 위임전결규정에 따라 영업 임원이 대신 결재', help: '휴가, 출장 같은 사유와 대신 결재하는 근거를 적습니다. 결재 기록에 함께 남습니다.' }),
      btn: '대리 지정',
      open: function (f) {
        f.elements.absent.addEventListener('change', function () {
          const list = subCandidates(f.elements.absent.value);
          f.elements.sub.innerHTML = '<option value="">' + (f.elements.absent.value ? '고르세요' : '담당자를 먼저 고르세요') + '</option>' + list.map(function (a) {
            return '<option value="' + esc(a.id) + '">' + esc(a.name + ' (' + C.roleLabel(a.roles.indexOf('EXEC') > -1 ? 'EXEC' : a.roles[0]) + ', ' + a.dept + ')') + '</option>';
          }).join('');
        });
      },
      check: function (f) {
        const absent = val(f, 'absent'), from = val(f, 'from'), to = val(f, 'to');
        const overlap = absent && from && to && D.DELEGATIONS.some(function (d) {
          return d.absentId === absent && C.delegationState(d) !== 'ENDED' && !(to < d.from || from > d.to);
        });
        return {
          absent: absent ? '' : '자리를 비우는 담당자를 고르세요.',
          sub: val(f, 'sub') ? '' : '대신할 사람을 고르세요.',
          from: !from ? '시작일을 고르세요.' : from < D.TODAY ? '시작일은 오늘(' + C.fmtDate(D.TODAY) + ') 이후여야 합니다.' : '',
          to: !to ? '종료일을 고르세요.' : from && to < from ? '종료일은 시작일과 같거나 뒤여야 합니다.' : overlap ? '이 기간에 이미 이 담당자의 대리 지정이 있습니다.' : '',
          reason: val(f, 'reason') ? '' : '근거를 적으세요.',
        };
      },
      done: function (f) {
        const d = { id: 'DL-' + String(D.DELEGATIONS.length + 1).padStart(3, '0'), absentId: val(f, 'absent'), delegateId: val(f, 'sub'),
          from: val(f, 'from'), to: val(f, 'to'), reason: val(f, 'reason') };
        C.adminSave('RULE', dutyNames(d.absentId) + ' 대리 지정',
          '대리 지정: ' + C.userName(d.absentId) + ' → ' + C.userName(d.delegateId) + ' (' + period(d) + ')', d.reason, { k: 'DELEGATE', d: d });
        render();
        C.toast(C.userName(d.delegateId) + '님을 ' + C.userName(d.absentId) + '님의 대리로 지정했습니다.');
      },
    });
  }
  function openEnd(id) {
    const d = D.DELEGATIONS.filter(function (x) { return x.id === id; })[0];
    const active = C.delegationState(d) === 'ACTIVE';
    const a = C.userName(d.absentId), b = C.userName(d.delegateId);
    C.formModal({
      title: active ? '대리 지정을 끝낼까요?' : '대리 지정을 취소할까요?',
      desc: active ? '끝내면 지금부터 ' + b + '님은 ' + a + '님 대신 처리할 수 없습니다. 이미 대신 처리한 기록은 그대로 남습니다.'
        : '취소하면 이 기간에 ' + b + '님이 ' + a + '님 대신 처리하지 않습니다.',
      body: '<p class="modal-info">' + esc(a) + '님 → ' + esc(b) + '님 (' + period(d) + ')</p>' +
        C.fieldHtml({ name: 'reason', label: active ? '끝내는 사유' : '취소하는 사유', type: 'textarea', required: true, placeholder: '예: 출장 일정이 줄어 일찍 복귀' }),
      btn: active ? '끝내기' : '취소하기', tone: 'danger',
      check: function (f) { return { reason: val(f, 'reason') ? '' : '사유를 적으세요.' }; },
      done: function (f) {
        C.adminSave('RULE', dutyNames(d.absentId) + ' 대리 지정',
          '대리 지정 ' + (active ? '끝냄' : '취소') + ': ' + a + ' → ' + b + ' (' + period(d) + ')', val(f, 'reason'), { k: 'DELEGATE_END', id: d.id });
        render();
        C.toast('대리 지정을 ' + (active ? '끝냈습니다.' : '취소했습니다.'));
      },
    });
  }

  /* ---------- 3. 독촉 기준 일수 (REQ-ENV-10, REQ-DASH-05) ---------- */
  const RULES = [
    ['approvalDelayDays', '결재 대기 독촉', '한 단계에 이 일수 이상 머문 건을 개요, 검토 대기, 운영 검토 대기에서 강조하고 그 단계 담당자에게 독촉 이메일'],
    ['signDelayDays', '체결 지연 독촉', '계약 검토가 끝나고 이 일수가 지나도 체결이 끝나지 않은 건을 체결 대기에서 강조하고 기안자에게 독촉 이메일'],
  ];
  function renderRules() {
    $('#remind-rows').innerHTML = RULES.map(function (r) {
      return '<tr><td class="nowrap cell-strong">' + esc(r[1]) + '</td><td class="num">' + D.ALERT_RULES[r[0]] + '일</td><td>' + esc(r[2]) + '</td>' +
        '<td class="col-action"><button type="button" class="link-act" data-rule="' + r[0] + '" aria-label="' + esc(r[1]) + ' 바꾸기">바꾸기</button></td></tr>';
    }).join('');
  }
  function openRule(key) {
    const r = RULES.filter(function (x) { return x[0] === key; })[0];
    const cur = D.ALERT_RULES[key];
    C.formModal({
      title: r[1] + ' 일수를 바꿀까요?',
      desc: '바꾸면 바로 모든 목록의 강조와 독촉에 새 일수를 씁니다.',
      body: '<p class="modal-info">지금: ' + cur + '일</p>' +
        C.fieldHtml({ name: 'days', label: '새 일수', type: 'number', required: true, unit: '일', value: cur, attrs: ' min="1" max="60" inputmode="numeric"' }) +
        C.fieldHtml({ name: 'reason', label: '바꾸는 사유', type: 'textarea', required: true }),
      btn: '바꾸기',
      check: function (f) {
        const n = Number(val(f, 'days'));
        return {
          days: !/^\d+$/.test(val(f, 'days')) || n < 1 || n > 60 ? '1에서 60 사이의 일수를 넣으세요.' : n === cur ? '지금과 같은 일수입니다.' : '',
          reason: val(f, 'reason') ? '' : '바꾸는 사유를 적으세요.',
        };
      },
      done: function (f) {
        const n = Number(val(f, 'days'));
        C.adminSave('RULE', '독촉 기준', r[1] + ': ' + cur + '일 → ' + n + '일', val(f, 'reason'), { k: 'ALERT_RULE', key: key, to: n });
        render();
        C.toast(r[1] + ' 기준을 ' + n + '일로 바꿨습니다.');
      },
    });
  }

  /* ---------- 4. 변경 이력 ---------- */
  function render() {
    renderAssignees();
    renderDelegations();
    renderRules();
    $('#history').innerHTML = C.adminHistoryHtml(C.adminLog(['RULE']), '결재선 규칙 변경 이력');
  }

  $('#content').addEventListener('click', function (e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'btn-delegate') openDelegate();
    else if (b.id === 'btn-unit') openAddUnit();
    else if (b.getAttribute('data-change')) openChange(b.getAttribute('data-change'));
    else if (b.getAttribute('data-end')) openEnd(b.getAttribute('data-end'));
    else if (b.getAttribute('data-rule')) openRule(b.getAttribute('data-rule'));
    else if (b.getAttribute('data-team')) openLeader(b.getAttribute('data-team'));
  });
  render();
})();
