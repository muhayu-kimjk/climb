/* =====================================================================
 * SCR-53 열람 제한 관리 화면 로직 (admin-restrict.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-AUTH-07(영업이 등록할 때 체크), REQ-AUTH-08(관리자가 설정, 해제), REQ-AUTH-09(볼 수 있는 사람),
 *               REQ-AUTH-10(설정, 해제 이력: 누가, 언제, 사유), REQ-AUTH-20(지정 열람자, v0.52 기획자 결정)
 * 하는 일
 *   1. 열람 제한 계약 목록: 고객사(계약번호, 서비스), 지정 열람자(빼기, 맨 아래 열람자 더하기), 상태, 영업대표, 건 때, 관리(풀기)
 *   2. 열람 제한 걸기: 계약번호가 있는 원계약 중 제한이 없는 것을 골라 사유와 함께 검(그 뒤의 변경, 연장, 해지, 운영 변경까지 묶음 전체. 풀 때도 묶음 전체. v0.63 점검)
 *   3. 지정 열람자(v0.52): 기본으로 보는 사람(요청자, 결재선과 단계 담당자, 관리자) 밖에 더 볼 조직이나 사람
 *      - 조직이 기본(인사이동이 저절로 반영), 사람은 예외. 사람은 조직이 바뀌면 지정이 저절로 풀리고 관리자에게 이메일
 *      - 지정하고 빼는 것은 관리자만, 사유 필수. 지정되면 그 사람(조직이면 그 조직 사람 모두)에게 이메일
 *      - 계약 묶음 단위: 원계약에 두고 변경, 연장, 해지, 운영 변경 기안이 이어받음(후속 기안 줄에서 바꿔도 원계약에 반영)
 *   4. 변경 이력: 영업이 등록할 때 건 기록(RESTRICT_LOG), 관리자가 걸고 푼 기록과 열람자를 지정하고 뺀 기록(ADMIN_LOG의 RESTRICT),
 *      인사이동으로 사람 지정이 풀린 기록(계약의 viewers에서 만듦)
 * 열람 제한은 원계약의 변경, 연장, 해지, 운영 변경 기안이 이어받음(D-13 v0.39)
 * 프로토타입: 바꾼 내용은 이 브라우저에만 저장(시연 기록). 이메일은 보낸 것으로만 안내. 실제 시스템은 서버가 판단하고 저장(REQ-AUTH-09)
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  if (!C.gate(me, ['ADMIN'], '열람 제한 관리는 관리자만 씁니다')) return;

  function val(f, n) { return (f.elements[n].value || '').trim(); }
  function find(id) { return D.CONTRACTS.filter(function (c) { return c.id === id; })[0]; }
  function label(c) { return c.id + ' ' + c.counterparty; }
  const KIND = { DEPT: '조직', USER: '사람' };

  // 걸고 푼 기록 (건 때를 찾는 데 씀): 영업이 등록할 때 건 것 + 관리자가 걸고 푼 것. 열람자 지정 기록은 뺌
  function restrictEvents() {
    const reg = D.RESTRICT_LOG.map(function (x) {
      const c = find(x.id);
      return { at: x.at, by: x.by, target: c ? label(c) : x.id, change: '열람 제한 설정', reason: x.reason, id: x.id, on: x.on };
    });
    const adm = C.adminLog(['RESTRICT']).filter(function (e) { return (e.op && e.op.k === 'RESTRICT') || (!e.op && e.change.indexOf('열람 제한') === 0); })
      .map(function (e) { return Object.assign({}, e, e.op ? { id: e.op.id, on: e.op.on } : { id: e.target.split(' ')[0], on: e.change.indexOf('해제') < 0 }); });
    return reg.concat(adm);
  }
  // 변경 이력 전체: 걸고 푼 것 + 열람자 지정, 뺌 + 인사이동으로 풀린 사람 지정 (최근 것부터)
  function events() {
    const viewerLog = C.adminLog(['RESTRICT']).filter(function (e) { return (e.op && e.op.k !== 'RESTRICT') || (!e.op && e.change.indexOf('열람자') === 0); });
    const released = [];
    D.CONTRACTS.forEach(function (c) {
      (c.viewers || []).forEach(function (v) {
        if (!v.releasedAt || v.removedAt) return;
        released.push({ at: v.releasedAt, by: null, byLabel: '시스템(자동)', target: label(c),
          change: '열람자 지정 풀림: ' + C.viewerLabel(v) + '(사람)', reason: '인사이동으로 조직이 바뀜(' + v.deptAtGrant + ' → ' + v.releasedTo + '). 관리자에게 이메일로 알림' });
      });
    });
    return restrictEvents().concat(viewerLog, released).sort(function (a, b) { return b.at.localeCompare(a.at); });
  }
  // 지금 걸려 있는 제한을 건 때와 사람
  //   변경, 연장, 해지, 운영 변경은 원계약의 제한을 이어받음(D-13): 원계약에 건 때를 보여 줌 (v0.58 QA: "-"로 비어 보였음)
  function setInfo(id) {
    const c = D.CONTRACTS.filter(function (x) { return x.id === id; })[0];
    const rootId = c ? C.rootOf(c) : id;
    const e = restrictEvents().filter(function (x) { return (x.id === id || x.id === rootId) && x.on; }).sort(function (a, b) { return b.at.localeCompare(a.at); })[0];
    const inherited = rootId !== id ? '원계약에서 이어받음' : '';
    if (!e) return inherited ? '<span class="cell-meta">' + inherited + '</span>' : '-';
    return C.fmtDate(e.at) + '<span class="cell-meta">' + esc(C.ownerLabel(e.by)) + (inherited && e.id !== id ? ', ' + inherited : '') + '</span>';
  }
  // 지정 열람자 칸: 효력 있는 지정(빼기 링크)과 풀린 지정(흐리게). 뺀 지정은 이력에만
  function viewersCell(c) {
    const root = find(C.rootOf(c)) || c;
    const list = C.viewersOf(c).filter(function (v) { return C.viewerState(v) !== 'REMOVED'; });
    const rows = list.map(function (v) {
      const on = C.viewerState(v) === 'ON';
      return '<span class="viewer-line' + (on ? '' : ' is-off') + '">' + esc(C.viewerLabel(v)) + ' <span class="viewer-kind">' + KIND[v.kind] + '</span>' +
        (on ? ' <button type="button" class="link-act link-act--danger" data-remove="' + esc(root.id) + '|' + esc(C.viewerKey(v)) + '" aria-label="' + esc(C.viewerLabel(v)) + ' 열람자에서 빼기">빼기</button>'
          : ' ' + C.badge('line', '풀림') + '<span class="cell-meta">조직이 바뀜: ' + esc(v.deptAtGrant) + ' → ' + esc(v.releasedTo || (D.USERS[v.userId] || {}).dept || '-') + '</span>') +
        '</span>';
    }).join('');
    const inherited = c.id !== root.id ? '<span class="cell-meta">원계약 ' + esc(root.id) + '에서 이어받음</span>' : '';
    // 더하기는 이 칸 맨 아래 (표가 A4 폭 안에 들어가게 관리 칸에는 풀기만)
    return (rows || '<span class="cell-meta">없음</span>') + inherited +
      '<button type="button" class="link-act viewer-add" data-viewer="' + esc(root.id) + '" aria-label="' + esc(c.counterparty) + ' 열람자 더하기">열람자 더하기</button>';
  }

  function render() {
    const list = D.CONTRACTS.filter(function (c) { return c.id && c.restricted; })
      .sort(function (a, b) { return b.id.localeCompare(a.id); });
    $('#count').textContent = list.length + '건';
    $('#rows').innerHTML = list.length ? list.map(function (c) {
      return '<tr><td><a class="cell-title" href="review.html?id=' + encodeURIComponent(c.id) + '">' + esc(c.counterparty) + '</a>' +
          '<span class="cell-meta">' + esc(c.id) + ' ' + C.icon('lock', 'sm') + ' ' + esc(C.kindLabel(c)) + '</span>' +
          '<span class="cell-meta">' + esc(C.serviceLabel(c.services)) + '</span></td>' +
        '<td class="col-viewers">' + viewersCell(c) + '</td>' +
        '<td class="nowrap">' + C.statusBadge(c) + '</td>' +
        '<td class="center">' + esc(C.ownerLabel(c.requesterId)) + '</td>' +
        '<td class="num-left">' + setInfo(c.id) + '</td>' +
        '<td class="col-action"><button type="button" class="link-act link-act--danger" data-off="' + esc(c.id) + '" aria-label="' + esc(c.counterparty) + ' 열람 제한 풀기">풀기</button></td></tr>';
    }).join('') : '<tr><td class="empty-row" colspan="6">열람 제한 계약이 없습니다.</td></tr>';
    $('#history').innerHTML = C.adminHistoryHtml(events(), '열람 제한 변경 이력');
  }

  // 열람 제한은 묶음 전체에 걸고 풂(REQ-AUTH-09 v0.58): 걸 때는 원계약만 고르고, 풀 때는 원계약 번호로 보냄 (v0.63 점검에서 고침)
  function openAdd() {
    const opts = D.CONTRACTS.filter(function (c) { return c.id && !c.parentId && !c.restricted; })
      .sort(function (a, b) { return b.id.localeCompare(a.id); })
      .map(function (c) { return [c.id, label(c) + ' (' + C.kindLabel(c) + ', ' + D.STATUS[c.status].label + ')']; });
    C.formModal({
      title: '열람 제한을 걸까요?',
      desc: '원계약을 고르면 그 뒤의 변경, 연장, 해지, 운영 변경 기안까지 묶음 전체에 걸립니다. 걸면 영업대표(요청자), 결재선과 단계 담당자, 관리자, 지정한 열람자만 볼 수 있고, 다른 사람에게는 목록에 "열람 제한 계약"으로만 보입니다.',
      body: C.fieldHtml({ name: 'cid', label: '계약', type: 'select', required: true, options: [['', '고르세요']].concat(opts) }) +
        C.fieldHtml({ name: 'reason', label: '거는 사유', type: 'textarea', required: true, placeholder: '예: 고객사가 계약 사실을 비공개로 해 달라고 요청' }),
      btn: '열람 제한 걸기',
      check: function (f) {
        return { cid: val(f, 'cid') ? '' : '계약을 고르세요.', reason: val(f, 'reason') ? '' : '거는 사유를 적으세요.' };
      },
      done: function (f) {
        const c = find(val(f, 'cid'));
        C.adminSave('RESTRICT', label(c), '열람 제한 설정', val(f, 'reason'), { k: 'RESTRICT', id: c.id, on: true });
        render();
        C.toast(c.counterparty + ' 계약에 열람 제한을 걸었습니다.');
      },
    });
  }
  function openOff(id) {
    const c = find(C.rootOf(find(id))) || find(id); // 후속 기안 줄에서 눌러도 원계약(묶음)으로 풂
    C.formModal({
      title: '열람 제한을 풀까요?',
      desc: '풀면 원계약과 그 뒤의 기안까지 묶음 전체를 로그인한 모든 사용자가 볼 수 있습니다.',
      body: '<p class="modal-info">' + esc(label(c)) + '</p>' +
        C.fieldHtml({ name: 'reason', label: '푸는 사유', type: 'textarea', required: true, placeholder: '예: 보도자료로 계약 사실이 공개됨' }),
      btn: '열람 제한 풀기', tone: 'danger',
      check: function (f) { return { reason: val(f, 'reason') ? '' : '푸는 사유를 적으세요.' }; },
      done: function (f) {
        C.adminSave('RESTRICT', label(c), '열람 제한 해제', val(f, 'reason'), { k: 'RESTRICT', id: c.id, on: false });
        render();
        C.toast(c.counterparty + ' 계약의 열람 제한을 풀었습니다.');
      },
    });
  }

  /* ---------- 지정 열람자 (v0.52) ---------- */
  function openViewerAdd(rootId) {
    const root = find(rootId);
    const ons = C.viewersOf(root).filter(function (v) { return C.viewerState(v) === 'ON'; }).map(C.viewerKey);
    const depts = C.codeList('DEPT').map(function (d) { return [d.label, d.label]; });
    // 사람: 사용 중인 계정. "조직 이름"으로 (v0.51 표기)
    const people = (D.ACCOUNTS || []).filter(function (a) { return a.status !== 'SUSPENDED'; })
      .map(function (a) { return [a.id, (a.dept ? a.dept + ' ' : '') + a.name]; })
      .sort(function (a, b) { return a[1].localeCompare(b[1], 'ko'); });
    C.formModal({
      title: '열람자를 더할까요?',
      desc: '이 계약 묶음(원계약과 그 변경, 연장, 해지)을 볼 수 있게 됩니다. 지정하면 그 사람(조직이면 그 조직 사람 모두)에게 이메일로 알립니다.',
      body: '<p class="modal-info">' + esc(label(root)) + '</p>' +
        C.fieldHtml({ name: 'kind', label: '지정할 것', type: 'select', required: true, value: 'DEPT', options: [['DEPT', '조직 (기본: 인사이동이 저절로 반영)'], ['USER', '사람 (예외: 조직이 바뀌면 저절로 풀림)']] }) +
        '<div data-kind="DEPT">' + C.fieldHtml({ name: 'dept', label: '조직', type: 'select', required: true, options: [['', '고르세요']].concat(depts),
          help: '그 조직에 지금 있는 사람이 봅니다. 사람이 옮겨 오거나 떠나면 저절로 반영됩니다.' }) + '</div>' +
        '<div data-kind="USER">' + C.fieldHtml({ name: 'user', label: '사람', type: 'select', required: true, options: [['', '고르세요']].concat(people),
          help: '이 사람이 다른 조직으로 옮기면 지정이 저절로 풀리고 관리자에게 이메일로 알립니다. 꼭 필요할 때만 씁니다.' }) + '</div>' +
        C.fieldHtml({ name: 'reason', label: '지정하는 사유', type: 'textarea', required: true, placeholder: '예: 총판 계약이라 매출 인식 방법을 재무기획유닛이 미리 검토' }),
      btn: '열람자 더하기',
      open: function (f) {
        function sync() {
          const k = val(f, 'kind');
          f.querySelectorAll('[data-kind]').forEach(function (b) { b.hidden = b.getAttribute('data-kind') !== k; });
        }
        f.elements.kind.addEventListener('change', sync);
        sync();
      },
      check: function (f) {
        const k = val(f, 'kind'), key = k + ':' + (k === 'DEPT' ? val(f, 'dept') : val(f, 'user'));
        const err = { reason: val(f, 'reason') ? '' : '지정하는 사유를 적으세요.' };
        if (k === 'DEPT') err.dept = !val(f, 'dept') ? '조직을 고르세요.' : ons.indexOf(key) > -1 ? '이미 지정된 조직입니다.' : '';
        else err.user = !val(f, 'user') ? '사람을 고르세요.' : ons.indexOf(key) > -1 ? '이미 지정된 사람입니다.' : '';
        return err;
      },
      done: function (f) {
        const k = val(f, 'kind');
        const v = k === 'DEPT' ? { kind: 'DEPT', dept: val(f, 'dept') }
          : { kind: 'USER', userId: val(f, 'user'), deptAtGrant: (D.USERS[val(f, 'user')] || {}).dept || '' };
        const name = C.viewerLabel(v);
        C.adminSave('RESTRICT', label(root), '열람자 지정: ' + name + '(' + KIND[k] + ')', val(f, 'reason'), { k: 'VIEWER_ADD', id: root.id, v: v });
        render();
        C.toast(C.josa(name, '을', '를') + ' 열람자로 지정했습니다. ' + (k === 'DEPT' ? '그 조직 사람들에게' : '지정된 사람에게') + ' 이메일로 알렸습니다.');
      },
    });
  }
  function openViewerRemove(rootId, key) {
    const root = find(rootId);
    const v = C.viewersOf(root).filter(function (x) { return C.viewerKey(x) === key && C.viewerState(x) === 'ON'; })[0];
    if (!v) return;
    C.formModal({
      title: '열람자에서 뺄까요?',
      desc: '빼면 ' + (v.kind === 'DEPT' ? '그 조직 사람들은' : '그 사람은') + ' 기본으로 볼 수 있는 경우(영업대표, 결재선과 단계 담당자, 관리자)가 아니면 이 계약 묶음을 볼 수 없습니다.',
      body: '<p class="modal-info">' + esc(label(root)) + ': ' + esc(C.viewerLabel(v)) + '(' + KIND[v.kind] + ')</p>' +
        C.fieldHtml({ name: 'reason', label: '빼는 사유', type: 'textarea', required: true, placeholder: '예: 매출 인식 검토가 끝남' }),
      btn: '열람자에서 빼기', tone: 'danger',
      check: function (f) { return { reason: val(f, 'reason') ? '' : '빼는 사유를 적으세요.' }; },
      done: function (f) {
        C.adminSave('RESTRICT', label(root), '열람자 뺌: ' + C.viewerLabel(v) + '(' + KIND[v.kind] + ')', val(f, 'reason'), { k: 'VIEWER_REMOVE', id: root.id, key: key });
        render();
        C.toast(C.josa(C.viewerLabel(v), '을', '를') + ' 열람자에서 뺐습니다.');
      },
    });
  }

  $('#content').addEventListener('click', function (e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'btn-add') openAdd();
    else if (b.getAttribute('data-off')) openOff(b.getAttribute('data-off'));
    else if (b.getAttribute('data-viewer')) openViewerAdd(b.getAttribute('data-viewer'));
    else if (b.getAttribute('data-remove')) { const p = b.getAttribute('data-remove').split('|'); openViewerRemove(p[0], p[1]); }
  });
  render();
})();
