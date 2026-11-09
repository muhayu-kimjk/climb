/* =====================================================================
 * SCR-45 표준계약서 화면 로직 (templates.js, v0.53 기획자 요청, 요구사항 정의서 REQ-CHK-09)
 * ---------------------------------------------------------------------
 * 하는 일
 *   1. 지금 쓰는 표준계약서: 이름과 지금 판의 바뀐 조항, 서비스, 지금 판(예정 판이 있으면 함께), 적용 시작일, 쓴 계약 수, 내려받기
 *   2. 새 판 올리기, 표준계약서 추가(법무, 관리자, 최고관리자): 적용 시작일(오늘 이후), 바뀐 조항(필수), 근거(필수)
 *      앞 판은 지우지 않음. 관리자 변경 이력(TEMPLATE)에 남음
 *   3. 판 이력: 모든 판(지난 판, 지금 판, 예정)
 *   기획자 결정 2026-11-02 C-15: 판마다 "반부패 조항 있음" 표시(versions[].antiBribery: true 있음, false 없음)
 *     판 이력의 "반부패 조항" 칸, 지금 판 칸 아래 줄, 새 판과 표준계약서 추가 창(있음, 없음 중 꼭 고름)에 보임. 관리자 변경 이력에도 함께 남음
 *     표준계약서를 바꾼 계약은 ④ 법무가 기준 판의 이 표시를 보고 "있고 약해지지 않음" 또는 "없음(사유)"을 고름(결재 문서 쪽)
 *     예전 시연 기록처럼 고르지 않은 판은 "-"
 * 볼 수 있는 사람: 모두(계약서를 쓰는 영업이 내려받음)
 * 프로토타입: 파일은 열리지 않고 안내만. 바꾼 내용은 이 브라우저에만 저장(시연 기록)
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const canEdit = me.role === 'SUPER' || C.hasRole(me, ['LEGAL', 'ADMIN']);
  $('#btn-add').hidden = !canEdit;
  if (!canEdit) $('#intro-sub').textContent = '판은 지우거나 덮어쓰지 않고 쌓여, 지난 계약이 어느 판을 썼는지 남습니다. 새 판은 법무와 관리자가 올립니다.';

  function val(f, n) { return (f.elements[n].value || '').trim(); }
  function find(id) { return D.TEMPLATES.filter(function (t) { return t.id === id; })[0]; }
  function serviceName(t) { return t.service ? (D.SERVICES[t.service] || t.service) : '모든 서비스'; }
  function planned(t) { return t.versions.filter(function (v) { return v.from > D.TODAY; }); }
  // 반부패 조항 표시 (C-15): 있음, 없음, 고르지 않은 예전 판은 "-"
  function bribeText(v) { return v.antiBribery === true ? '있음' : v.antiBribery === false ? '없음' : '-'; }
  // 이 표준계약서를 쓴 계약(작성 중 빼고). 판마다 셈
  function usage(t) {
    const by = {};
    D.CONTRACTS.forEach(function (c) {
      if (c.status === 'DRAFT') return;
      const x = C.templateOf(c);
      if (x && !x.own && x.t.id === t.id) by[x.v.no] = (by[x.v.no] || 0) + 1;
    });
    return by;
  }

  function render() {
    $('#count').textContent = D.TEMPLATES.length + '종';
    $('#rows').innerHTML = D.TEMPLATES.map(function (t) {
      const now = C.templateVersionAt(t, D.TODAY), next = planned(t), use = usage(t);
      const total = Object.keys(use).reduce(function (a, k) { return a + use[k]; }, 0);
      return '<tr><td class="col-main"><span class="cell-strong">' + esc(t.name) + '</span>' +
          '<span class="cell-meta">' + esc(now ? now.summary : '아직 적용 전') + '</span>' +
          next.map(function (v) { return '<span class="cell-meta">' + C.badge('line', '예정') + ' 판 ' + v.no + ', ' + C.fmtDate(v.from) + '부터: ' + esc(v.summary) + '</span>'; }).join('') + '</td>' +
        '<td class="nowrap">' + esc(serviceName(t)) + '</td>' +
        '<td class="nowrap">' + (now ? C.badge('success', '판 ' + now.no) + '<span class="cell-meta">반부패 조항 ' + bribeText(now) + '</span>' : '-') + '</td>' +
        '<td class="num-left nowrap">' + (now ? C.fmtDate(now.from) : '-') + '</td>' +
        '<td class="num">' + total + '건' + (Object.keys(use).length > 1 ? Object.keys(use).map(function (k) { return '<span class="cell-meta">판 ' + k + ': ' + use[k] + '건</span>'; }).join('') : '') + '</td>' +
        // 2026-11-06 점검: 첫 판이 앞으로 적용되는 표준계약서도 "지금 판 내려받기"가 보였음. 지금 판이 있을 때만 내려받기, 없으면 "적용 전"과 다음 판의 시작일
        '<td class="col-action">' + (now ? '<button type="button" class="link-act" data-dl="' + esc(t.id) + '" aria-label="' + esc(t.name) + ' 지금 판 내려받기">내려받기</button>'
          : '<span class="nowrap">적용 전</span>' + (next.length ? '<span class="cell-meta">' + C.fmtDate(next.map(function (v) { return v.from; }).sort()[0]) + '부터</span>' : '')) +
          (canEdit ? '<button type="button" class="link-act" data-ver="' + esc(t.id) + '" aria-label="' + esc(t.name) + ' 새 판 올리기">새 판</button>' : '') + '</td></tr>';
    }).join('');

    const rows = [];
    D.TEMPLATES.forEach(function (t) { t.versions.forEach(function (v) { rows.push({ t: t, v: v }); }); });
    rows.sort(function (a, b) { return b.v.from.localeCompare(a.v.from) || b.v.at.localeCompare(a.v.at); });
    $('#history').innerHTML = rows.map(function (r) {
      const now = C.templateVersionAt(r.t, D.TODAY);
      const state = r.v.from > D.TODAY ? C.badge('line', '예정') : now === r.v ? C.badge('success', '지금 판') : C.badge('neutral', '지난 판');
      return '<tr' + (r.v.from <= D.TODAY && now !== r.v ? ' class="is-muted"' : '') + '><td class="num-left nowrap">' + C.fmtDate(r.v.from) + '<span class="cell-meta">' + state + '</span></td>' +
        '<td><span class="cell-strong">' + esc(r.t.name) + '</span><span class="cell-meta">판 ' + r.v.no + '</span></td>' +
        '<td class="center nowrap">' + bribeText(r.v) + '</td>' + // C-15
        '<td>' + esc(r.v.summary) + '</td><td>' + esc(r.v.basis || '-') + '</td>' +
        '<td class="center">' + esc(C.ownerLabel(r.v.by)) + '<span class="cell-meta">' + C.fmtDateTime(r.v.at) + '</span></td></tr>';
    }).join('');
  }

  // 새 판과 첫 판에 함께 쓰는 칸
  function versionFields() {
    return C.fieldHtml({ name: 'from', label: '적용 시작일', type: 'date', required: true, attrs: ' min="' + D.TODAY + '"',
        help: '이날부터 계약서를 쓸 때 이 판을 씁니다. 오늘 이후 날짜만 고를 수 있습니다.' }) +
      C.fieldHtml({ name: 'summary', label: '바뀐 조항', type: 'textarea', required: true, placeholder: '예: 제12조 손해배상 한도를 연간 이용료 총액으로 분명히 함' }) +
      // C-15: 처음 값 없이 꼭 고름(올리는 사람이 이 판을 보고 정하게)
      C.fieldHtml({ name: 'bribe', label: '반부패 조항', type: 'select', required: true, options: [['', '고르세요'], ['Y', '있음'], ['N', '없음']],
        help: '이 판에 뇌물과 부정한 청탁을 막는 조항이 있는지 고릅니다. 표준계약서를 바꾼 계약을 법무가 검토할 때 기준이 됩니다.' }) +
      C.fieldHtml({ name: 'basis', label: '근거', required: true, placeholder: '예: 법무 검토 기록 2026-10-20', help: '새 판을 정한 법무 검토나 품의 기록을 적습니다.' }) +
      C.fieldHtml({ name: 'file', label: '표준계약서 파일', type: 'file', help: '워드나 한글 파일(시안에서는 올리지 않아도 됨)' });
  }
  function checkVersion(f, t) {
    const from = val(f, 'from');
    const dup = t && from && t.versions.some(function (v) { return v.from === from; });
    return {
      from: !from ? '적용 시작일을 고르세요.' : from < D.TODAY ? '적용 시작일은 오늘(' + C.fmtDate(D.TODAY) + ') 이후여야 합니다.' : dup ? '이 날짜에 시작하는 판이 이미 있습니다.' : '',
      summary: val(f, 'summary') ? '' : '바뀐 조항을 적으세요.',
      bribe: val(f, 'bribe') ? '' : '반부패 조항이 있는지 고르세요.',
      basis: val(f, 'basis') ? '' : '근거를 적으세요.',
    };
  }
  // 창에서 고른 판 내용 (C-15 반부패 조항 포함)과 변경 이력에 붙일 말
  function versionOf(f) { return { from: val(f, 'from'), summary: val(f, 'summary'), antiBribery: val(f, 'bribe') === 'Y' }; }
  function versionNote(v) { return C.fmtDate(v.from) + '부터, 반부패 조항 ' + bribeText(v); }
  function openVersion(id) {
    const t = find(id), now = C.templateVersionAt(t, D.TODAY);
    C.formModal({
      title: t.name + ' 새 판을 올릴까요?',
      desc: '적용 시작일부터 새 판을 씁니다. 지금 판은 지우지 않고 이력으로 남습니다.',
      body: '<p class="modal-info">지금: 판 ' + (now ? now.no + ' (' + versionNote(now) + ')' : '없음') + '</p>' + versionFields(),
      btn: '새 판 올리기',
      check: function (f) { return checkVersion(f, t); },
      done: function (f) {
        const no = t.versions.length + 1, v = versionOf(f);
        C.adminSave('TEMPLATE', t.name, '새 판: 판 ' + no + ' (' + versionNote(v) + ') ' + v.summary, val(f, 'basis'),
          { k: 'TEMPLATE_VERSION', id: t.id, v: v });
        render();
        // 숫자 뒤에 조사를 붙이지 않음("판 2이"가 되던 것, v0.63 점검에서 고침)
        C.toast(t.name + '의 새 판(판 ' + no + ')을 ' + C.fmtDate(val(f, 'from')) + '부터 적용합니다.');
      },
    });
  }
  function openAdd() {
    const services = [['', '모든 서비스']].concat(Object.keys(D.SERVICES).map(function (k) { return [k, D.SERVICES[k]]; }));
    C.formModal({
      title: '표준계약서를 추가할까요?',
      desc: '적용 시작일부터 계약 등록의 "기준 표준계약서"에 나옵니다.',
      body: '<div class="field-row">' +
          C.fieldHtml({ name: 'tname', label: '표준계약서 이름', required: true, placeholder: '예: 카피킬러 리셀러 계약서' }) +
          C.fieldHtml({ name: 'service', label: '서비스', type: 'select', options: services }) +
        '</div>' + versionFields(),
      btn: '표준계약서 추가',
      check: function (f) {
        const name = val(f, 'tname');
        return Object.assign(checkVersion(f, null), {
          tname: !name ? '이름을 넣으세요.' : D.TEMPLATES.some(function (t) { return t.name === name; }) ? '같은 이름의 표준계약서가 있습니다.' : '',
        });
      },
      done: function (f) {
        const id = 'TPL-' + String(D.TEMPLATES.length + 1).padStart(2, '0'), v = versionOf(f);
        C.adminSave('TEMPLATE', val(f, 'tname'), '표준계약서 추가: 판 1 (' + versionNote(v) + ') ' + v.summary, val(f, 'basis'),
          { k: 'TEMPLATE_ADD', t: { id: id, name: val(f, 'tname'), service: val(f, 'service') }, v: v });
        render();
        C.toast(val(f, 'tname') + ' 판 1을 올렸습니다.');
      },
    });
  }

  $('#content').addEventListener('click', function (e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'btn-add') openAdd();
    else if (b.getAttribute('data-ver')) openVersion(b.getAttribute('data-ver'));
    else if (b.getAttribute('data-dl')) C.toast('실제 시스템에서는 지금 판의 원본(워드)을 내려받고, 받은 기록이 남습니다(시안).');
  });
  render();
})();
