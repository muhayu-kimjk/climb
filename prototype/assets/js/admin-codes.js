/* =====================================================================
 * SCR-56 코드 관리 화면 로직 (admin-codes.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: 데이터 정의서 9장(관리자 관리 코드표, 코드값 원칙), REQ-ADM-09(조직 목록, 실과 유닛 2단계 v0.29), REQ-REG-17(서비스)
 * v0.47: 서비스는 한 단계로 둠. 예전 중분류, 소분류(카피킬러 캠퍼스, 프리즘 등)는 제품이 되어 제품과 기능 관리(SCR-58)에서 관리
 * 하는 일
 *   1. 코드표 고르기: 조직, 서비스, 계약 방식, 정산 방식, 사후관리 기록 종류 (계약 유형은 v0.34에서 없앰)
 *   2. 코드 표: 코드, 화면 이름, (조직은 단계와 상위), 쓰는 곳, 상태, 고치기
 *   3. 코드 추가: 코드(영문 대문자, 숫자, 밑줄. 그 코드표 안에서 중복 불가), 화면 이름, 조직은 단계와 상위 코드
 *   4. 고치기: 화면 이름, 사용 여부, (단계가 있는 코드표의 2단계 이하) 상위. 코드는 바꿀 수 없음. 사용 안 함은 새로 고르는 목록에서만 빠짐
 *      조직 개편(v0.31): 상위 조직을 바꿀 수 있고, 사람이나 사용 중인 하위가 남은 코드는 사용 안 함으로 돌릴 수 없음
 *   5. 변경 이력
 * 프로토타입: 바꾼 내용은 이 브라우저에만 저장(시연 기록)
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  if (!C.gate(me, ['ADMIN'], '코드 관리는 관리자만 씁니다')) return;

  // 단계가 있는 코드표의 단계 이름 (CODE_GROUPS.levels: 조직은 1, 2단계. 서비스는 v0.47부터 단계 없음)
  function levels() { return D.CODE_GROUPS[group].levels || null; }
  let group = 'DEPT';
  function val(f, n) { return (f.elements[n].value || '').trim(); }
  function find(code) { return D.CODES.filter(function (c) { return c.group === group && c.code === code; })[0]; }
  function codeLabel(code) { const c = D.CODES.filter(function (x) { return x.group === group && x.code === code; })[0]; return c ? c.label : code; }

  // 단계가 있는 코드표는 상위 아래에 하위가 오도록 줄 세움
  function ordered() {
    const list = C.codeList(group, true);
    if (!levels()) return list;
    const out = [];
    (function walk(parent) {
      list.filter(function (c) { return (c.parent || null) === parent; }).forEach(function (c) { out.push(c); walk(c.code); });
    })(null);
    return out;
  }
  // 쓰는 곳 수: 이 값을 쓰는 사용자, 계약, 제품, 기록
  function usage(c) {
    const ctr = function (fn) { return D.CONTRACTS.filter(function (x) { return x.id && fn(x); }).length; };
    if (group === 'DEPT') return '사용자 ' + D.ACCOUNTS.filter(function (a) { return a.dept === c.label; }).length + '명';
    // 서비스는 v0.47부터 한 단계. 그 아래 제품 수는 제품과 기능 관리(SCR-58)의 제품
    if (group === 'SERVICE') return '계약 ' + ctr(function (x) { return (x.services || []).indexOf(c.code) > -1; }) + '건, 제품 ' + D.PRODUCTS.filter(function (p) { return p.service === c.code; }).length + '개';
    // 계약 방식, 정산 방식: 계약서를 쓰는 기안만(해지, 운영 변경, 그대로 연장 빼고). 화면과 같은 규칙(C.methodOf, 정산 기본 일시) (v0.58 QA)
    const own = function (x) { return x.kind !== 'TERMINATE' && x.kind !== 'CHANGE' && x.renewMode !== 'AUTO'; };
    if (group === 'METHOD') return '계약 ' + ctr(function (x) { return own(x) && C.methodOf(x) === c.code; }) + '건';
    if (group === 'SETTLEMENT') return '계약 ' + ctr(function (x) { return own(x) && ((x.form || {}).settlement || 'LUMP') === c.code; }) + '건';
    if (group === 'AFTERCARE') return '기록 ' + D.CONTRACTS.reduce(function (n, x) { return n + (x.notes || []).filter(function (t) { return t.type === c.code; }).length; }, 0) + '건';
    return '-';
  }

  function render() {
    const g = D.CODE_GROUPS[group], leveled = !!levels(), LEVEL = levels() || {};
    // data-label: 굵은 글자 폭을 미리 잡아 눌러도 단추 폭이 그대로(admin.css, 가격 기준 관리 D-19와 같은 방식, 2026-11-02 화면이 흔들리지 않게)
    $('#groups').innerHTML = Object.keys(D.CODE_GROUPS).map(function (k) {
      return '<button type="button" data-group="' + k + '" data-label="' + esc(D.CODE_GROUPS[k].name) + '" aria-pressed="' + (k === group) + '">' + esc(D.CODE_GROUPS[k].name) + '</button>';
    }).join('');
    $('#group-name').textContent = g.name;
    $('#group-table').textContent = g.table;
    $('#group-note').textContent = g.note + '.';
    $('#caption').textContent = g.name + ' 코드: 코드, 화면 이름, ' + (leveled ? '단계, 상위, ' : '') + '쓰는 곳, 상태, 관리';
    $('#thead').innerHTML = '<tr><th scope="col">코드</th><th scope="col">화면 이름</th>' + (leveled ? '<th scope="col">단계</th><th scope="col" class="col-phone-mid">상위</th>' : '') +
      '<th scope="col">쓰는 곳</th><th scope="col">상태</th><th scope="col" class="col-action">관리</th></tr>';
    $('#rows').innerHTML = ordered().map(function (c) {
      return '<tr' + (c.use ? '' : ' class="is-muted"') + '><td class="nowrap"><code>' + esc(c.code) + '</code></td>' +
        '<td class="cell-strong' + (leveled ? ' nowrap' : '') + '">' + (leveled && c.level > 1 ? '<span aria-hidden="true">' + new Array(c.level).join('　') + '└ </span>' : '') + esc(c.label) + '</td>' +
        (leveled ? '<td class="nowrap">' + esc(LEVEL[c.level]) + '</td><td>' + (c.parent ? esc(codeLabel(c.parent)) : '-') + '</td>' : '') +
        '<td class="cell-phone-nowrap">' + esc(usage(c)) + '</td>' +
        '<td class="nowrap">' + (c.use ? C.badge('success', '사용 중') : C.badge('neutral', '사용 안 함')) + '</td>' +
        '<td class="col-action"><button type="button" class="link-act" data-edit="' + esc(c.code) + '" aria-label="' + esc(c.label) + ' 고치기">고치기</button></td></tr>';
    }).join('');
    $('#history').innerHTML = C.adminHistoryHtml(C.adminLog(['CODE']), '코드 변경 이력');
  }

  function openEdit(code) {
    const c = find(code), g = D.CODE_GROUPS[group];
    C.formModal({
      title: g.name + ' 코드를 고칠까요? (' + c.code + ')',
      desc: '화면 이름을 바꾸면 이 코드를 쓰는 모든 곳에 새 이름이 보입니다. 사용 안 함으로 돌리면 새로 고르는 목록에서만 빠지고, 이미 저장된 기록에는 그대로 보입니다.',
      body: '<p class="modal-info">코드 ' + esc(c.code) + ' (코드는 바꿀 수 없습니다), 쓰는 곳: ' + esc(usage(c)) + '</p>' +
        C.fieldHtml({ name: 'label', label: '화면 이름', required: true, value: c.label }) +
        // 상위 바꾸기: 단계가 있는 코드표의 2단계 이하 (조직 개편으로 유닛이 다른 실 아래로 갈 때, v0.31)
        (levels() && c.level > 1 ? C.fieldHtml({ name: 'parent', label: '상위', type: 'select', required: true, value: c.parent || '',
          options: C.codeList(group, true).filter(function (x) { return x.level === c.level - 1 && (x.use || x.code === c.parent); }).map(function (x) { return [x.code, x.label]; }) }) : '') +
        C.fieldHtml({ name: 'use', label: '상태', type: 'select', value: String(c.use), options: [['true', '사용 중'], ['false', '사용 안 함']] }) +
        C.fieldHtml({ name: 'reason', label: '고치는 사유', type: 'textarea', required: true, placeholder: '예: 조직 개편으로 조직 이름 변경' }),
      btn: '저장',
      check: function (f) {
        const label = val(f, 'label'), use = val(f, 'use') === 'true';
        const parent = f.elements.parent ? val(f, 'parent') : c.parent;
        const dup = D.CODES.some(function (x) { return x.group === group && x !== c && x.label === label; });
        // 사용 안 함으로 돌릴 때: 그 조직에 사람이 남았거나 사용 중인 하위가 있으면 먼저 옮겨야 함
        const off = c.use && !use;
        const people = off && group === 'DEPT' ? D.ACCOUNTS.filter(function (a) { return a.dept === c.label && a.status !== 'SUSPENDED'; }).length : 0;
        const kids = off ? D.CODES.filter(function (x) { return x.group === group && x.parent === c.code && x.use; }).length : 0;
        return {
          label: !label ? '화면 이름을 넣으세요.' : dup ? '같은 화면 이름이 이미 있습니다.' : label === c.label && use === c.use && parent === c.parent ? '바뀐 내용이 없습니다.' : '',
          use: people ? '이 조직에 사람이 ' + people + '명 있습니다. 먼저 사용자 권한 관리의 조직 옮기기로 다른 조직에 옮기세요.'
            : kids ? '아래에 사용 중인 코드가 ' + kids + '개 있습니다. 먼저 그 코드의 상위를 바꾸거나 사용 안 함으로 돌리세요.' : '',
          reason: val(f, 'reason') ? '' : '고치는 사유를 적으세요.',
        };
      },
      done: function (f) {
        const set = { label: val(f, 'label'), use: val(f, 'use') === 'true' };
        if (f.elements.parent && val(f, 'parent') !== c.parent) set.parent = val(f, 'parent');
        const parts = [];
        if (set.label !== c.label) parts.push('화면 이름: ' + c.label + ' → ' + set.label);
        if (set.parent) parts.push('상위: ' + codeLabel(c.parent) + ' → ' + codeLabel(set.parent));
        if (set.use !== c.use) parts.push('상태: ' + (c.use ? '사용 중 → 사용 안 함' : '사용 안 함 → 사용 중'));
        C.adminSave('CODE', g.name + ' ' + c.code, parts.join(', '), val(f, 'reason'), { k: 'CODE_EDIT', group: group, code: c.code, set: set });
        render();
        C.toast(g.name + ' 코드를 고쳤습니다: ' + c.code);
      },
    });
  }
  function openAdd() {
    const g = D.CODE_GROUPS[group], leveled = !!levels(), LEVEL = levels() || {};
    const lvOpts = Object.keys(LEVEL).map(function (k) { return [k, LEVEL[k]]; });
    function parents(level) {
      return C.codeList(group, true).filter(function (x) { return x.level === level - 1; }).map(function (x) { return [x.code, x.label + ' (' + x.code + ')']; });
    }
    C.formModal({
      title: g.name + ' 코드를 추가할까요?',
      desc: '추가하면 바로 화면에서 고르는 ' + g.name + ' 목록에 나옵니다. 코드는 한 번 정하면 바꿀 수 없습니다.',
      body: '<div class="field-row">' +
          C.fieldHtml({ name: 'code', label: '코드', required: true, placeholder: '예: SALES_4', help: '영문 대문자, 숫자, 밑줄(_)' }) +
          C.fieldHtml({ name: 'label', label: '화면 이름', required: true }) +
        '</div>' +
        (leveled ? '<div class="field-row">' +
          C.fieldHtml({ name: 'level', label: '단계', type: 'select', required: true, value: '2', options: lvOpts }) +
          C.fieldHtml({ name: 'parent', label: '상위', type: 'select', required: true, options: [['', '고르세요']].concat(parents(2)) }) +
        '</div>' : '') +
        C.fieldHtml({ name: 'reason', label: '추가하는 사유', type: 'textarea', required: true }),
      btn: '코드 추가',
      open: function (f) {
        if (!leveled) return;
        f.elements.level.addEventListener('change', function () {
          const lv = Number(f.elements.level.value);
          f.elements.parent.disabled = lv === 1;
          f.elements.parent.innerHTML = lv === 1 ? '<option value="">없음 (' + esc(LEVEL[1]) + ')</option>'
            : '<option value="">고르세요</option>' + parents(lv).map(function (p) { return '<option value="' + esc(p[0]) + '">' + esc(p[1]) + '</option>'; }).join('');
        });
      },
      check: function (f) {
        const code = val(f, 'code').toUpperCase(), label = val(f, 'label');
        const lv = leveled ? Number(val(f, 'level')) : null;
        return {
          code: !/^[A-Z][A-Z0-9_]*$/.test(code) ? '코드를 영문 대문자로 시작하는 영문 대문자, 숫자, 밑줄로 넣으세요.'
            : D.CODES.some(function (x) { return x.group === group && x.code === code; }) ? '이미 있는 코드입니다.' : '',
          label: !label ? '화면 이름을 넣으세요.' : D.CODES.some(function (x) { return x.group === group && x.label === label; }) ? '같은 화면 이름이 이미 있습니다.' : '',
          parent: leveled && lv > 1 && !val(f, 'parent') ? '상위 코드를 고르세요.' : '',
          reason: val(f, 'reason') ? '' : '추가하는 사유를 적으세요.',
        };
      },
      done: function (f) {
        const c = { group: group, code: val(f, 'code').toUpperCase(), label: val(f, 'label') };
        if (leveled) { c.level = Number(val(f, 'level')); c.parent = c.level > 1 ? val(f, 'parent') : null; }
        C.adminSave('CODE', g.name + ' ' + c.code, '코드 추가: ' + c.label + (leveled ? ' (' + LEVEL[c.level] + (c.parent ? ', 상위 ' + codeLabel(c.parent) : '') + ')' : ''),
          val(f, 'reason'), { k: 'CODE_ADD', c: c });
        render();
        C.toast(g.name + ' 코드를 추가했습니다: ' + c.code);
      },
    });
  }

  $('#content').addEventListener('click', function (e) {
    const b = e.target.closest('button');
    if (!b) return;
    // 다시 그려도 누른 코드표 단추에 초점이 남게 (2026-11-02)
    if (b.getAttribute('data-group')) { group = b.getAttribute('data-group'); render(); $('#groups [data-group="' + group + '"]').focus(); }
    else if (b.id === 'btn-add') openAdd();
    else if (b.getAttribute('data-edit')) openEdit(b.getAttribute('data-edit'));
  });
  render();
})();
