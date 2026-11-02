/* =====================================================================
 * SCR-52 결재선 규칙 화면 로직 (admin-rules.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-AUTH-06(단계별 담당자, 금액 기준 없음), REQ-CHK-05(거치는 조건), REQ-REV-08(대리 지정),
 *               REQ-ENV-10(독촉), REQ-SEC-05(바꾼 기록)
 * 하는 일
 *   1. 단계별 담당자: 단계, 담당자, 지금 차례인 건 수, 바꾸기, 거치는 조건(보여 주기만)
 *      (기획자 결정 2026-11-02 D-18: 담당자를 보고 바꾸는 칸을 앞으로, 참고 글인 거치는 조건은 맨 뒤로)
 *      바꾸면 아직 차례가 오지 않은 단계부터 새 담당자에게 감. 지금 차례인 건은 원래 담당자가 처리 (기획자 결정 v0.25)
 *      ⑦ 체결본 등록은 기안한 영업이 하므로 바꿀 수 없음
 *      ③ 영업 검토는 유닛별 리더(구성원 계약)와 영업 임원(리더 본인 계약)으로 나눠 정함 (v0.26 재무 문서 반영)
 *   2. 대리 지정: 자리를 비우는 담당자, 대신할 사람(같은 역할. 영업 리더는 영업 임원도), 기간, 근거 (기획자 결정 v0.25)
 *      기간 안에는 대신할 사람이 처리하고 결재 기록에 "누구 대신"과 근거가 남음(common.js recordAction)
 *      기획자 결정 2026-11-02 E-3(A안, 추천과 다름): ③ 영업 임원 승인(S03C) 줄. 담당은 ③ 줄의 영업 임원과 같은 사람이라 그 줄에서 바꿈
 *      기획자 결정 2026-11-02 B-3: 운영 변경도 ⑩을 거침. HR 충전의 ⑩ 담당(재무 리더, 'S10:HR')을 따로 한 줄로 두고 바꿈
 *   2-1. 승인 기준과 근거 (기획자 결정 2026-11-02 E-3)
 *      영업 임원(COO)도 승인하는 기준: 할인율 한도를 n%p 넘게 넘김(PRICE_RULES.cooOverPp, [가정] 10%p는 실제 한도가 온 뒤 정함)
 *      위임전결 근거: 결재선 규칙이 따르는 회사 규정의 이름과 판(D.RULE_BASIS). 처음에는 비어 있고 운영 시작 전에 넣음
 *   3. 독촉과 알림 일수: 결재 대기 강조, 체결 지연 독촉, 해지 통지 기한 강조와 이메일, 의무 기한 강조와 이메일
 *      기획자 결정 2026-11-02 A-5(추천과 다름): 고정값이던 알림 일수 네 칸을 지금 바로 둠. 바꾸는 방식(사유 필수, 변경 이력)은 앞의 둘과 같음
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
  //   'S10:HR'처럼 쌍점이 붙은 줄은 그 단계 안에서 따로 정한 담당자(B-3). ③ 영업 임원 승인의 기준 %p는 지금 값으로 보여 줌(E-3)
  function rows() {
    return [
      ['S02', '모든 계약 (해지, 그대로 연장, 운영 변경은 없음). 기안자가 담당자면 재무 담당자가 대신 검토'],
      ['S03', '할인율 한도를 넘긴 계약, 해지, 그대로 연장, 운영 변경(기간 2개월 넘게 바뀜, 무상 충전이 계약 연도 누적 50건 초과). 구성원 계약은 유닛 리더(아래 표), 리더 본인 계약은 영업 임원. 만료 유예 확인도 같은 사람'],
      // 기획자 결정 2026-11-02 E-3: 유닛 리더 다음에 영업 임원도 승인. 리더 본인 계약은 ③이 이미 영업 임원이라 거치지 않음(common.js reviewRoute)
      ['S03C', '③을 거치는 구성원 계약 중 한 줄이라도 할인율 한도를 ' + C.cooOverPp() + '%p 넘게 넘긴 계약(아래 승인 기준). 유닛 리더 다음에 승인. 리더 본인 계약, 해지, 그대로 연장, 운영 변경은 없음'],
      ['S04', '표준계약서를 바꾼 계약, 해지, 그대로 연장'],
      ['S05', '개인정보 처리위탁 계약이 있는 계약 (해지, 그대로 연장, 운영 변경은 없음)'], // v0.36 항목 이름에 맞춤(v0.63 이용 안내 점검)
      ['S06', '모든 계약 (해지, 그대로 연장, 운영 변경은 없음)'],
      ['S07', '모든 계약 (해지, 그대로 연장, 운영 변경은 없음)'],
      ['S08', '모든 계약 (해지, 그대로 연장, 운영 변경은 없음). 기안자가 담당자면 재무 담당자가 대신 확인'],
      ['S09', '모든 계약. 운영 변경의 HR 충전은 재무 담당자(⑩ 담당자)가 반영. 종료일이 지난 계약의 만료 처리도 이 담당자'],
      // 기획자 결정 2026-11-02 B-3(추천과 다름): 운영 변경도 ⑩ 재무 확인을 거침(예전에는 "운영 변경은 없음")
      ['S10', '모든 계약(운영 변경 포함). 운영 변경의 HR 충전은 다음 줄의 담당자'],
      ['S10:HR', '운영 변경의 HR 충전. ⑨를 재무 담당자가 하므로 다른 사람이 확인'],
    ];
  }
  function stepOf(code) { return code.split(':')[0]; }
  // HR 충전(운영 변경)인지: 그 ⑩은 'S10:HR' 줄에서 셈 (B-3)
  function isHrCharge(c) { return c.kind === 'CHANGE' && /^HR_/.test(c.changeType || ''); }

  function account(id) { return D.ACCOUNTS.filter(function (a) { return a.id === id; })[0] || null; }
  function person(id) {
    const a = account(id);
    return '<span class="cell-strong">' + esc(a ? (a.dept ? a.dept + ' ' : '') + a.name : C.ownerLabel(id)) + '</span>';
  }
  // 그 역할(또는 그 분야 리더)이 있는, 사용 중지가 아닌 사람 (v0.29: 영업지원, 정보보호, 고객지원 리더도 고를 수 있음 [가정])
  function candidates(role, exceptId) {
    return D.ACCOUNTS.filter(function (a) { return C.canTake(a.roles, role) && a.status !== 'SUSPENDED' && a.id !== exceptId; });
  }
  // 그 줄의 지금 차례: ⑩ 줄은 HR 충전을 빼고, 'S10:HR' 줄은 HR 충전의 ⑩만 (B-3)
  function rowQueue(code) {
    const list = C.pendingQueue(me, true, [stepOf(code)]);
    if (code === 'S10') return list.filter(function (x) { return !isHrCharge(x.c); });
    if (code === 'S10:HR') return list.filter(function (x) { return isHrCharge(x.c); });
    return list;
  }
  function pendingCount(code) { return rowQueue(code).length; }
  // 지금 차례인 건 중 원래 담당자가 처리하는 건 (담당자를 바꾼 뒤): "김지우님 4건"
  function holders(code, cur) {
    const by = {};
    rowQueue(code).forEach(function (x) { if (x.s.userId !== cur) by[x.s.userId] = (by[x.s.userId] || 0) + 1; });
    return Object.keys(by).map(function (id) { return '<span class="cell-meta">' + esc(C.ownerLabel(id)) + ' ' + by[id] + '건</span>'; }).join('');
  }
  function stepName(code) { const s = D.STEPS[stepOf(code)]; return s.no + ' ' + s.name + (code === 'S10:HR' ? '(HR 충전)' : ''); }
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
        esc(C.ownerLabel(d.delegateId)) + ' (<span class="keep">' + C.fmtDate(d.from) + '~</span><wbr><span class="keep">' + C.fmtDate(d.to) + '</span>)</span>';
    }).join('');
  }
  // 단계 줄 아래 흐린 역할 이름. HR 충전의 ⑩은 맡은 사람의 역할(재무 리더 등, B-3)
  function rowRole(code, id) {
    if (code !== 'S10:HR') return D.STEPS[stepOf(code)].role;
    const a = account(id);
    return a && a.roles.indexOf('FINANCE') < 0 && a.roles.indexOf('FIN_LEAD') > -1 ? 'FIN_LEAD' : 'FINANCE';
  }
  function renderAssignees() {
    $('#assignee-rows').innerHTML = rows().map(function (r) {
      // same: ③ 영업 임원 승인(E-3)은 ③ 줄의 영업 임원(STEP_ASSIGNEE.S03)이 맡아 이 줄에서는 바꾸지 않음
      const code = r[0], fixed = code === 'S07', same = code === 'S03C';
      const id = fixed ? null : C.assigneeOf(same ? 'S03' : code);
      // ③은 리더 본인 계약의 영업 임원만 이 줄에서 바꾸고, 구성원 계약은 아래 유닛별 리더 표에서 바꿈
      const who = fixed ? '기안한 영업' : (code === 'S03' ? '<span class="cell-meta">리더 본인 계약</span>' : '') + person(id) + delegNote(id) +
        (code === 'S03' ? '<span class="cell-meta">구성원 계약은 아래 유닛별 리더</span>' : '') +
        (same ? '<span class="cell-meta">③ 줄의 영업 임원과 같은 사람</span>' : '');
      // 기획자 결정 2026-11-02 D-18: 칸 순서는 단계, 담당자, 지금 차례, 관리, 거치는 조건 (참고 글인 거치는 조건은 맨 뒤)
      return '<tr><td class="nowrap cell-strong">' + esc(stepName(code)) + '<span class="cell-meta">' + esc(C.roleLabel(rowRole(code, id))) + '</span></td>' +
        '<td>' + who + '</td>' +
        // ③ 줄은 리더 본인 계약(영업 임원 차례)만 셈. 구성원 계약은 아래 유닛별 리더 표에서
        '<td class="num">' + (code === 'S03'
          ? C.pendingQueue(me, true, ['S03']).filter(function (x) { return x.s.userId === id; }).length + '건'
          : pendingCount(code) + '건' + (fixed ? '' : holders(code, id))) + '</td>' +
        '<td class="col-action">' + (fixed || same ? '-' : '<button type="button" class="link-act" data-change="' + code + '" aria-label="' + esc(stepName(code)) + ' 담당자 바꾸기">바꾸기</button>') + '</td>' +
        '<td class="col-wide">' + esc(r[1]) + '</td></tr>';
    }).join('');
    // ③ 영업 검토 유닛별 리더 (재무 문서: 소속 유닛원의 계약은 소속 리더가 승인)
    $('#leader-rows').innerHTML = teams().map(function (team) {
      const id = C.leaderAt(team, '9999');
      const list = C.pendingQueue(me, true, ['S03']).filter(function (x) { return C.teamOf(x.c.requesterId) === team; });
      // 리더 본인 계약은 영업 임원이 검토하므로 따로 셈 (v0.58 QA: "원래 리더"로 잘못 셌음)
      const own = list.filter(function (x) { return x.c.requesterId === id; }).length;
      const others = list.filter(function (x) { return x.s.userId !== id && x.c.requesterId !== id; }).length;
      return '<tr><td class="nowrap cell-strong">' + esc(team) + '</td><td>' + (id ? person(id) + delegNote(id) : '<span class="cell-meta">리더 없음: 영업 임원이 검토</span>') + '</td>' +
        '<td class="num">' + list.length + '건' + (others ? '<span class="cell-meta">원래 리더 ' + others + '건</span>' : '') + (own ? '<span class="cell-meta">리더 본인 계약 ' + own + '건(영업 임원)</span>' : '') + '</td>' +
        '<td class="col-action"><button type="button" class="link-act" data-team="' + esc(team) + '" aria-label="' + esc(team) + ' 리더 바꾸기">바꾸기</button></td></tr>';
    }).join('');
  }
  function openLeader(team) {
    const cur = C.leaderAt(team, '9999');
    const opts = candidates('HEAD', cur).map(function (a) { return [a.id, (a.dept ? a.dept + ' ' : '') + a.name]; });
    const n = C.pendingQueue(me, true, ['S03']).filter(function (x) { return C.teamOf(x.c.requesterId) === team; }).length;
    C.formModal({
      title: team + ' 리더를 바꿀까요?',
      desc: '바꾸면 ' + team + ' 계약 중 아직 ③ 영업 검토 차례가 오지 않은 것부터 새 리더에게 갑니다.' + (n ? ' 지금 차례인 ' + n + '건은 ' + C.josa(C.ownerLabel(cur), '이', '가') + ' 그대로 처리합니다.' : ''),
      body: '<p class="modal-info">지금 리더: ' + (cur ? esc(C.ownerLabel(cur)) : '없음') + '</p>' +
        C.fieldHtml({ name: 'to', label: '새 리더', type: 'select', required: true, options: [['', '고르세요']].concat(opts), help: '영업 리더 역할이 있는 사람만 고를 수 있습니다.' }) +
        C.fieldHtml({ name: 'reason', label: '바꾸는 사유', type: 'textarea', required: true, placeholder: '예: 10월 20일 비즈니스2유닛 리더 발령' }),
      btn: '리더 바꾸기',
      check: function (f) { return { to: val(f, 'to') ? '' : '새 리더를 고르세요.', reason: val(f, 'reason') ? '' : '바꾸는 사유를 적으세요.' }; },
      done: function (f) {
        const to = val(f, 'to');
        C.adminSave('RULE', stepName('S03') + '(' + team + ' 리더)', '리더: ' + (cur ? C.ownerLabel(cur) : '없음') + ' → ' + C.ownerLabel(to), val(f, 'reason'),
          { k: 'ASSIGNEE', step: 'S03:' + team, to: to });
        render();
        C.toast(team + ' 리더를 ' + C.josa(C.ownerLabel(to), '으로', '로') + ' 바꿨습니다.');
      },
    });
  }
  // 유닛 추가: 조직 개편으로 새 유닛이 생기면 표에 더하고 리더를 정함 (v0.31)
  //   기획자 결정 2026-11-02 A-7: 2단계 유닛 가운데 영업이 속한 유닛만 고름(영업 담당자나 영업 리더 역할이 있는 사용 중지가 아닌(사용 중, 첫 접속 전) 계정이 한 명 이상)
  //     첫 접속 전 계정도 셈: 새 유닛의 영업을 막 초대했을 때도 리더를 미리 정할 수 있게(REQ-AUTH-19, SCR-52 문구를 이에 맞춤)
  //   이 표는 ③ 가격 예외 승인자를 정하므로, 영업이 없는 조직이 들어가 쓰이지 않는 승인 권한이 남지 않게. 사용 중지 계정은 세지 않음 [가정]
  function hasSales(unit) {
    return D.ACCOUNTS.some(function (a) {
      return a.dept === unit && a.status !== 'SUSPENDED' && (a.roles.indexOf('SALES') > -1 || a.roles.indexOf('HEAD') > -1);
    });
  }
  function openAddUnit() {
    const cur = teams();
    const units = C.codeList('DEPT').filter(function (x) { return x.level === 2 && cur.indexOf(x.label) < 0 && hasSales(x.label); });
    if (!units.length) { C.toast('더할 수 있는 유닛이 없습니다. 새 유닛은 코드 관리에서 2단계로 만들고, 사용자 권한 관리에서 영업을 옮긴 뒤 더하세요.', true); return; }
    const opts = candidates('HEAD').map(function (a) { return [a.id, (a.dept ? a.dept + ' ' : '') + a.name]; });
    C.formModal({
      title: '유닛별 리더 표에 유닛을 더할까요?',
      desc: '더하면 그 유닛 사람이 기안하는 계약의 ③ 영업 검토가 정한 리더에게 갑니다. 표에 없는 유닛의 계약은 영업 임원이 검토합니다.',
      body: C.fieldHtml({ name: 'unit', label: '유닛', type: 'select', required: true, options: [['', '고르세요']].concat(units.map(function (x) { return [x.label, x.label]; })),
          help: '2단계 유닛 중 영업 담당자나 영업 리더가 있고 아직 표에 없는 유닛만 고를 수 있습니다.' }) +
        C.fieldHtml({ name: 'to', label: '리더', type: 'select', required: true, options: [['', '고르세요']].concat(opts), help: '영업 리더 역할이 있는 사람만 고를 수 있습니다.' }) +
        C.fieldHtml({ name: 'reason', label: '더하는 사유', type: 'textarea', required: true, placeholder: '예: 2027년 1월 조직 개편으로 비즈니스4유닛 신설' }),
      btn: '유닛 추가',
      check: function (f) {
        return { unit: val(f, 'unit') ? '' : '유닛을 고르세요.', to: val(f, 'to') ? '' : '리더를 고르세요.', reason: val(f, 'reason') ? '' : '더하는 사유를 적으세요.' };
      },
      done: function (f) {
        const unit = val(f, 'unit'), to = val(f, 'to');
        C.adminSave('RULE', stepName('S03') + '(' + unit + ' 리더)', '유닛 추가, 리더: ' + C.ownerLabel(to), val(f, 'reason'), { k: 'ASSIGNEE', step: 'S03:' + unit, to: to });
        render();
        C.toast(C.josa(unit, '을', '를') + ' 더하고 리더를 ' + C.josa(C.ownerLabel(to), '으로', '로') + ' 정했습니다.');
      },
    });
  }
  function openChange(code) {
    // ③ 줄은 리더 본인 계약의 담당(영업 임원). 같은 사람이 ③ 영업 임원 승인(S03C, E-3)도 맡음
    const st = D.STEPS[stepOf(code)], cur = C.assigneeOf(code), role = code === 'S03' ? 'EXEC' : st.role;
    const n = code === 'S03' ? C.pendingQueue(me, true, ['S03', 'S03C']).filter(function (x) { return x.s.userId === cur; }).length : pendingCount(code);
    // 기획자 결정 2026-11-02 B-3: HR 충전의 ⑩은 재무 담당자나 재무 리더. ⑨를 하는 ⑩ 줄의 담당자와 같은 사람이면 ⑨와 ⑩을 한 사람이 하게 되므로
    //   ⑩ 줄과 'S10:HR' 줄에는 서로의 담당자를 고를 수 없게 뺌
    const clash = code === 'S10:HR' ? C.assigneeOf('S10') : code === 'S10' ? C.assigneeOf('S10:HR') : null;
    const pool = code === 'S10:HR'
      ? D.ACCOUNTS.filter(function (a) { return (a.roles.indexOf('FINANCE') > -1 || a.roles.indexOf('FIN_LEAD') > -1) && a.status !== 'SUSPENDED' && a.id !== cur; })
      : candidates(role, cur);
    const opts = pool.filter(function (a) { return a.id !== clash; }).map(function (a) { return [a.id, (a.dept ? a.dept + ' ' : '') + a.name]; });
    if (!opts.length) { C.toast('바꿀 수 있는 ' + C.roleLabel(role) + ' 역할의 사람이 없으니 사용자 권한 관리에서 먼저 역할을 주세요.', true); return; }
    // 그 분야 리더도 고를 수 있음 (v0.29 가정, C.canTake). HR 충전의 ⑩은 재무 리더도 (B-3)
    const help = code === 'S10:HR' ? '재무 담당자나 재무 리더 역할이 있는 사람만 고를 수 있습니다.'
      : C.roleLabel(role) + ' 역할' + (D.STEP_LEADS.some(function (r) { return D.ROLE_BASE[r] === role; }) ? '이나 그 분야 리더 역할' : '') + '이 있는 사람만 고를 수 있습니다.';
    const clashNote = !clash ? '' : code === 'S10:HR' ? ' HR 충전의 ⑨를 하는 ⑩ 담당자(' + C.ownerLabel(clash) + ')는 고를 수 없습니다.'
      : ' HR 충전의 ⑩ 담당자(' + C.ownerLabel(clash) + ')는 고를 수 없습니다.';
    C.formModal({
      title: stepName(code) + ' 담당자를 바꿀까요?',
      desc: '바꾸면 아직 차례가 오지 않은 계약부터 새 담당자에게 갑니다.' + (n ? ' 지금 차례인 ' + n + '건은 ' + C.josa(C.ownerLabel(cur), '이', '가') + ' 그대로 처리합니다.' : '') +
        (code === 'S03' ? ' 할인 폭이 큰 계약의 ③ 영업 임원 승인도 새 담당자가 맡습니다.' : ''),
      body: '<p class="modal-info">지금 담당자: ' + esc(C.ownerLabel(cur)) + '</p>' +
        C.fieldHtml({ name: 'to', label: '새 담당자', type: 'select', required: true, options: [['', '고르세요']].concat(opts), help: help + clashNote }) +
        C.fieldHtml({ name: 'reason', label: '바꾸는 사유', type: 'textarea', required: true, placeholder: '예: 인사 이동으로 담당 변경' }),
      btn: '담당자 바꾸기',
      check: function (f) {
        return { to: val(f, 'to') ? '' : '새 담당자를 고르세요.', reason: val(f, 'reason') ? '' : '바꾸는 사유를 적으세요.' };
      },
      done: function (f) {
        const to = val(f, 'to');
        C.adminSave('RULE', stepName(code) + ' 담당자', '담당자: ' + C.ownerLabel(cur) + ' → ' + C.ownerLabel(to), val(f, 'reason'), { k: 'ASSIGNEE', step: code, to: to });
        render();
        C.toast(stepName(code) + ' 담당자를 ' + C.josa(C.ownerLabel(to), '으로', '로') + ' 바꿨습니다.');
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
        // 기간은 붙여 쓰고 좁으면 물결 뒤에서만 줄바꿈 (REQ-UI-25, v0.63 점검에서 고침). 날짜마다 keep으로 묶어 "2026-" 뒤에서 끊기지 않게 (첫 사용 점검)
        '<td class="num-left"><span class="keep">' + C.fmtDate(d.from) + '~</span><wbr><span class="keep">' + C.fmtDate(d.to) + '</span>' + (d.endedAt ? '<span class="cell-meta">' + C.fmtDate(d.endedAt) + ' 끝냄</span>' : '') + '</td>' +
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
    const absentOpts = ids.map(function (id) { return [id, C.ownerLabel(id) + ' (' + dutyNos(id) + ' ' + C.roleLabel(C.duties(id)[0].role) + ')']; });
    C.formModal({
      title: '대리 지정을 추가할까요?',
      desc: '기간 안에는 대신할 사람이 이 담당자의 차례를 처리하고, 결재 기록에 누구 대신인지와 근거가 남습니다.',
      body: C.fieldHtml({ name: 'absent', label: '자리를 비우는 담당자', type: 'select', required: true, options: [['', '고르세요']].concat(absentOpts) }) +
        C.fieldHtml({ name: 'sub', label: '대신할 사람', type: 'select', required: true, options: [['', '담당자를 먼저 고르세요']],
          help: '같은 역할(영업지원, 정보보호, 고객지원은 그 분야 리더도)이 있는 사람만 고를 수 있습니다. 영업 리더는 영업 임원도 고를 수 있습니다.' }) +
        '<div class="field-row">' +
          C.fieldHtml({ name: 'from', label: '시작일', type: 'date', required: true, value: D.TODAY, attrs: ' min="' + D.TODAY + '"' }) +
          C.fieldHtml({ name: 'to', label: '종료일', type: 'date', required: true, attrs: ' min="' + D.TODAY + '" data-after="fm-from" data-after-msg="종료일은 시작일보다 앞설 수 없습니다."' }) +
        '</div>' +
        C.fieldHtml({ name: 'reason', label: '근거', type: 'textarea', required: true,
          placeholder: '예: 비즈니스2유닛 고은성 해외 출장(2026-10-19~2026-10-23). 위임전결규정에 따라 영업 임원이 대신 결재', help: '휴가, 출장 같은 사유와 대신 결재하는 근거를 적습니다. 결재 기록에 함께 남습니다.' }),
      btn: '대리 지정',
      open: function (f) {
        f.elements.absent.addEventListener('change', function () {
          const list = subCandidates(f.elements.absent.value);
          f.elements.sub.innerHTML = '<option value="">' + (f.elements.absent.value ? '고르세요' : '담당자를 먼저 고르세요') + '</option>' + list.map(function (a) {
            return '<option value="' + esc(a.id) + '">' + esc((a.dept ? a.dept + ' ' : '') + a.name + ' (' + C.roleLabel(a.roles.indexOf('EXEC') > -1 ? 'EXEC' : a.roles[0]) + ')') + '</option>';
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
          to: !to ? '종료일을 고르세요.' : from && to < from ? '종료일은 시작일보다 앞설 수 없습니다.' : overlap ? '이 기간에 이미 이 담당자의 대리 지정이 있습니다.' : '',
          reason: val(f, 'reason') ? '' : '근거를 적으세요.',
        };
      },
      done: function (f) {
        const d = { id: 'DL-' + String(D.DELEGATIONS.length + 1).padStart(3, '0'), absentId: val(f, 'absent'), delegateId: val(f, 'sub'),
          from: val(f, 'from'), to: val(f, 'to'), reason: val(f, 'reason') };
        C.adminSave('RULE', dutyNames(d.absentId) + ' 대리 지정',
          '대리 지정: ' + C.ownerLabel(d.absentId) + ' → ' + C.ownerLabel(d.delegateId) + ' (' + period(d) + ')', d.reason, { k: 'DELEGATE', d: d });
        render();
        C.toast(C.josa(C.ownerLabel(d.delegateId), '을', '를') + ' ' + C.ownerLabel(d.absentId) + '의 대리로 지정했습니다.');
      },
    });
  }
  function openEnd(id) {
    const d = D.DELEGATIONS.filter(function (x) { return x.id === id; })[0];
    const active = C.delegationState(d) === 'ACTIVE';
    const a = C.ownerLabel(d.absentId), b = C.ownerLabel(d.delegateId);
    C.formModal({
      title: active ? '대리 지정을 끝낼까요?' : '대리 지정을 취소할까요?',
      desc: active ? '끝내면 지금부터 ' + C.josa(b, '은', '는') + ' ' + a + ' 대신 처리할 수 없습니다. 이미 대신 처리한 기록은 그대로 남습니다.'
        : '취소하면 이 기간에 ' + C.josa(b, '이', '가') + ' ' + a + ' 대신 처리하지 않습니다.',
      body: '<p class="modal-info">' + esc(a) + ' → ' + esc(b) + ' (' + period(d) + ')</p>' +
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

  /* ---------- 2-1. 승인 기준과 근거 (기획자 결정 2026-11-02 E-3 A안, 추천과 다름) ----------
   * 영업 임원(COO)도 승인하는 기준: 한 줄이라도 할인율이 할인율 한도를 이 %p보다 더 넘으면 ③에서 유닛 리더 다음에 영업 임원도 승인(금액은 보지 않음)
   *   값은 PRICE_RULES.cooOverPp(C.cooOverPp()). 바꾸면 applyAdmin PRICE_RULE이 바꾸기 전 값을 남겨, 이미 기안한 계약은 기안한 때의 값으로 결재
   *   [가정] 10%p는 자리 값. 기능마다 실제 할인율 한도(E-4)가 들어온 뒤 다시 정함
   * 위임전결 근거: 결재선 규칙이 따르는 회사 규정의 이름과 판(D.RULE_BASIS, applyAdmin RULE_BASIS). 결재선은 바뀌지 않고 근거만 남김
   *   실제 규정 이름과 판은 운영 시작 전에 넣음 [가정]. 그전에는 "아직 적지 않음" */
  function basisText(b) { return b.name + ' ' + b.ver; }
  function renderBasis() {
    const pp = C.cooOverPp(), b = D.RULE_BASIS || null;
    $('#basis-rows').innerHTML =
      '<tr><td class="nowrap cell-strong">영업 임원(COO)도 승인</td>' +
        '<td><span class="cell-strong">할인율 한도를 ' + pp + '%p 넘게 넘김</span><span class="cell-meta">실제 할인율 한도가 들어온 뒤 다시 정합니다</span></td>' +
        '<td class="col-wide">③을 거치는 구성원 계약 중 한 줄이라도 할인율이 한도를 이 값보다 더 넘으면, 유닛 리더 다음에 영업 임원도 승인합니다. 금액은 보지 않습니다. 바꿔도 이미 기안한 계약은 기안한 때의 기준을 씁니다.</td>' +
        '<td class="col-action"><button type="button" class="link-act" data-basis="coo" aria-label="영업 임원도 승인하는 기준 바꾸기">바꾸기</button></td></tr>' +
      '<tr><td class="nowrap cell-strong">위임전결 근거</td>' +
        '<td>' + (b ? '<span class="cell-strong">' + esc(basisText(b)) + '</span><span class="cell-meta">' + C.fmtDate(b.at) + ' 적음</span>'
          : '<span class="cell-meta">아직 적지 않음</span>') + '</td>' +
        '<td class="col-wide">단계별 담당자, 유닛별 리더, 위 승인 기준이 따르는 회사 규정의 이름과 판입니다. 권한 검토 때 이 판과 대조합니다.</td>' +
        '<td class="col-action"><button type="button" class="link-act" data-basis="rule" aria-label="위임전결 근거 ' + (b ? '바꾸기' : '적기') + '">' + (b ? '바꾸기' : '적기') + '</button></td></tr>';
  }
  function openCoo() {
    const cur = C.cooOverPp();
    C.formModal({
      title: '영업 임원도 승인하는 기준을 바꿀까요?',
      desc: '바꾸면 이제부터 기안하는 계약에 새 기준을 씁니다. 이미 기안한 계약은 기안한 때의 기준으로 결재합니다.',
      body: '<p class="modal-info">지금: 할인율 한도를 ' + cur + '%p 넘게 넘기면 영업 임원도 승인</p>' +
        C.fieldHtml({ name: 'pp', label: '새 기준', type: 'number', required: true, unit: '%p', value: cur, attrs: ' min="1" max="100" inputmode="numeric"',
          help: '한 줄이라도 할인율이 한도를 이 값보다 더 넘으면 영업 임원도 승인합니다. 1에서 100 사이로 넣습니다.' }) +
        C.fieldHtml({ name: 'reason', label: '바꾸는 사유', type: 'textarea', required: true, placeholder: '예: 2027년 할인율 한도 품의(2026-12-15)에 맞춤' }),
      btn: '바꾸기',
      check: function (f) {
        const n = Number(val(f, 'pp'));
        return {
          pp: !/^\d+$/.test(val(f, 'pp')) || n < 1 || n > 100 ? '1에서 100 사이의 숫자를 넣으세요.' : n === cur ? '지금과 같은 기준입니다.' : '',
          reason: val(f, 'reason') ? '' : '바꾸는 사유를 적으세요.',
        };
      },
      done: function (f) {
        const n = Number(val(f, 'pp'));
        C.adminSave('RULE', '③ 영업 임원 승인 기준', '할인율 한도를 넘은 폭: ' + cur + '%p → ' + n + '%p', val(f, 'reason'), { k: 'PRICE_RULE', key: 'cooOverPp', to: n });
        render();
        C.toast('영업 임원도 승인하는 기준을 ' + n + '%p로 바꿨습니다.');
      },
    });
  }
  function openRuleBasis() {
    const cur = D.RULE_BASIS || null;
    C.formModal({
      title: cur ? '위임전결 근거를 바꿀까요?' : '위임전결 근거를 적을까요?',
      desc: '결재선 규칙이 따르는 회사 규정의 이름과 판을 남깁니다. 결재선은 바뀌지 않습니다.',
      body: (cur ? '<p class="modal-info">지금: ' + esc(basisText(cur)) + '</p>' : '') +
        C.fieldHtml({ name: 'name', label: '규정 이름', required: true, value: cur ? cur.name : '', placeholder: '예: 위임전결규정' }) +
        C.fieldHtml({ name: 'ver', label: '판', required: true, value: cur ? cur.ver : '', placeholder: '예: 2026-07-01 개정', help: '개정일이나 판 번호를 적습니다.' }) +
        C.fieldHtml({ name: 'reason', label: cur ? '바꾸는 사유' : '적는 사유', type: 'textarea', required: true, placeholder: '예: 운영 시작 전 경영지원유닛에서 받은 지금 판' }),
      btn: cur ? '바꾸기' : '적기',
      check: function (f) {
        const same = cur && val(f, 'name') === cur.name && val(f, 'ver') === cur.ver;
        return {
          name: val(f, 'name') ? '' : '규정 이름을 적으세요.',
          ver: !val(f, 'ver') ? '판을 적으세요.' : same ? '지금과 같은 근거입니다.' : '',
          reason: val(f, 'reason') ? '' : (cur ? '바꾸는' : '적는') + ' 사유를 적으세요.',
        };
      },
      done: function (f) {
        const next = { name: val(f, 'name'), ver: val(f, 'ver') };
        C.adminSave('RULE', '위임전결 근거', '위임전결 근거: ' + (cur ? basisText(cur) : '없음') + ' → ' + basisText(next), val(f, 'reason'), { k: 'RULE_BASIS', name: next.name, ver: next.ver });
        render();
        C.toast('위임전결 근거를 ' + C.josa(basisText(next), '으로', '로') + ' 남겼습니다.');
      },
    });
  }

  /* ---------- 3. 독촉과 알림 일수 (REQ-ENV-10, REQ-DASH-05, REQ-FLOW-32, REQ-FLOW-36) ---------- */
  //   기획자 결정 2026-11-02 D-12: 체결 대기에서 ⑥, ⑦ 줄은 승인 후 일수(체결 지연), ⑧ 줄은 그 단계 대기(결재 대기)로 강조. 독촉 이메일 규칙은 그대로
  //   기획자 결정 2026-11-02 A-5(추천과 다름): 해지 통지 기한 강조와 이메일, 의무 기한 강조와 이메일 네 칸을 더함. 값은 D.ALERT_RULES
  //     이 값을 읽는 화면(개요, 만료 예정, 계약 상세, 의무 관리, 의무 더하기 창, 내 계정)은 모두 화면을 열 때 지금 값을 읽음
  //   기획자 결정 2026-11-02 E-12: 해지 통지 기한 이메일은 영업대표에게 모든 날, 그 유닛 리더에게는 가장 짧은 날(처음 7일 전)에만
  //   multi: 날이 둘인 이메일(첫 이메일, 두 번째 이메일). 첫 이메일이 기한에서 더 멂 / max: 넣을 수 있는 가장 큰 일수
  //     해지 통지 기한 강조는 만료 예정에 넣는 날수(expiryWindowDays, 90일)를 넘지 않게: 넘으면 강조할 계약이 목록에 없음
  const RULES = [
    { key: 'approvalDelayDays', name: '결재 대기 독촉', max: 60, use: '한 단계에 이 일수 이상 머문 건을 개요, 검토 대기, 운영 검토 대기, 체결 대기의 ⑧ 줄에서 강조하고 그 단계 담당자에게 독촉 이메일' },
    { key: 'signDelayDays', name: '체결 지연 독촉', max: 60, use: '계약 검토가 끝나고 이 일수가 지나도 체결이 끝나지 않은 건을 체결 대기의 ⑥, ⑦ 줄에서 강조하고 기안자에게 독촉 이메일' },
    { key: 'noticeSoonDays', name: '해지 통지 기한 강조', max: D.ALERT_RULES.expiryWindowDays, use: '자동갱신 계약의 해지 통지 기한이 이 일수 안이거나 지났으면 개요, 만료 예정, 계약 상세에서 강조' },
    { key: 'noticeMailDays', name: '해지 통지 기한 이메일', multi: true, max: 90, use: '자동갱신 계약의 해지 통지 기한 이 일수 전에 영업대표에게 이메일. 그 유닛 리더에게는 두 번째 이메일({last}일 전)만' },
    { key: 'obligationSoonDays', name: '의무 기한 강조', max: 60, use: '체결 후 의무의 기한이 이 일수 안이면 "D-n"으로 강조하고 개요 "챙길 의무"와 의무 관리의 급한 것에 넣음' },
    { key: 'obligationMailDays', name: '의무 기한 이메일', multi: true, max: 60, use: '체결 후 의무의 기한 이 일수 전에 맡은 분야에 이메일. 기한이 지나면 다음 날 그 분야 리더에게도' },
  ];
  // 값 글자: "5일", 이메일은 "30일, 7일 전"
  function daysText(v) { return Array.isArray(v) ? v.join('일, ') + '일 전' : v + '일'; }
  function useText(r) { const v = D.ALERT_RULES[r.key]; return r.use.replace('{last}', Array.isArray(v) ? Math.min.apply(null, v) : v); }
  function renderRules() {
    $('#remind-rows').innerHTML = RULES.map(function (r) {
      return '<tr><td class="nowrap cell-strong">' + esc(r.name) + '</td><td class="num nowrap">' + daysText(D.ALERT_RULES[r.key]) + '</td><td>' + esc(useText(r)) + '</td>' +
        '<td class="col-action"><button type="button" class="link-act" data-rule="' + r.key + '" aria-label="' + esc(r.name) + ' 바꾸기">바꾸기</button></td></tr>';
    }).join('');
  }
  // 일수 칸 하나 검사: 1에서 max 사이의 정수
  function dayErr(s, max) { const n = Number(s); return !/^\d+$/.test(s) || n < 1 || n > max ? '1에서 ' + max + ' 사이의 일수를 넣으세요.' : ''; }
  function openRule(key) {
    const r = RULES.filter(function (x) { return x.key === key; })[0];
    const cur = D.ALERT_RULES[key];
    const days = r.multi
      ? '<div class="field-row">' +
          C.fieldHtml({ name: 'd1', label: '첫 이메일', type: 'number', required: true, unit: '일 전', value: cur[0], attrs: ' min="1" max="' + r.max + '" inputmode="numeric"' }) +
          C.fieldHtml({ name: 'd2', label: '두 번째 이메일', type: 'number', required: true, unit: '일 전', value: cur[1], attrs: ' min="1" max="' + r.max + '" inputmode="numeric"',
            help: key === 'noticeMailDays' ? '첫 이메일보다 기한에 가까운 날입니다. 그 유닛 리더는 이 이메일만 받습니다.' : '첫 이메일보다 기한에 가까운 날입니다.' }) +
        '</div>'
      : C.fieldHtml({ name: 'days', label: '새 일수', type: 'number', required: true, unit: '일', value: cur, attrs: ' min="1" max="' + r.max + '" inputmode="numeric"' });
    C.formModal({
      title: r.name + ' 일수를 바꿀까요?',
      desc: r.multi ? '바꾸면 다음 이메일부터 새 일수로 보냅니다.' : '바꾸면 바로 모든 목록의 강조' + (key.indexOf('Delay') > -1 ? '와 독촉' : '') + '에 새 일수를 씁니다.',
      body: '<p class="modal-info">지금: ' + daysText(cur) + '</p>' + days +
        C.fieldHtml({ name: 'reason', label: '바꾸는 사유', type: 'textarea', required: true }),
      btn: '바꾸기',
      check: function (f) {
        const err = { reason: val(f, 'reason') ? '' : '바꾸는 사유를 적으세요.' };
        if (r.multi) {
          const a = Number(val(f, 'd1')), b = Number(val(f, 'd2'));
          err.d1 = dayErr(val(f, 'd1'), r.max);
          err.d2 = dayErr(val(f, 'd2'), r.max) || (!err.d1 && b >= a ? '두 번째 이메일은 첫 이메일보다 적은 일수여야 합니다.' : '') ||
            (!err.d1 && a === cur[0] && b === cur[1] ? '지금과 같은 일수입니다.' : '');
        } else {
          err.days = dayErr(val(f, 'days'), r.max) || (Number(val(f, 'days')) === cur ? '지금과 같은 일수입니다.' : '');
        }
        return err;
      },
      done: function (f) {
        const to = r.multi ? [Number(val(f, 'd1')), Number(val(f, 'd2'))] : Number(val(f, 'days'));
        // 앞의 두 독촉은 예전처럼 대상 "독촉 기준", 더한 네 칸은 "알림 기준"(A-5)
        C.adminSave('RULE', key.indexOf('Delay') > -1 ? '독촉 기준' : '알림 기준', r.name + ': ' + daysText(cur) + ' → ' + daysText(to), val(f, 'reason'), { k: 'ALERT_RULE', key: key, to: to });
        render();
        C.toast(r.name + ' 기준을 ' + C.josa(daysText(to), '으로', '로') + ' 바꿨습니다.');
      },
    });
  }

  /* ---------- 4. 변경 이력 ---------- */
  function render() {
    renderAssignees();
    renderBasis();
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
    else if (b.getAttribute('data-basis')) { if (b.getAttribute('data-basis') === 'coo') openCoo(); else openRuleBasis(); }
    else if (b.getAttribute('data-team')) openLeader(b.getAttribute('data-team'));
  });
  render();
})();
