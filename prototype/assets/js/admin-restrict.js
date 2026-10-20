/* =====================================================================
 * SCR-53 열람 제한 관리 화면 로직 (admin-restrict.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-AUTH-07(영업이 등록할 때 체크), REQ-AUTH-08(관리자가 설정, 해제), REQ-AUTH-09(볼 수 있는 사람),
 *               REQ-AUTH-10(설정, 해제 이력: 누가, 언제, 사유)
 * 하는 일
 *   1. 열람 제한 계약 목록: 고객사(계약번호), 서비스, 상태, 영업 대표, 건 때, 풀기
 *   2. 열람 제한 걸기: 계약번호가 있는 계약 중 제한이 없는 것을 골라 사유와 함께 검
 *   3. 변경 이력: 영업이 등록할 때 건 기록(RESTRICT_LOG)과 관리자가 걸고 푼 기록(ADMIN_LOG의 RESTRICT)
 * [가정] 열람 제한은 계약 한 건마다 겁니다. 변경, 갱신 계약이 원계약의 제한을 이어받을지는 정하지 않았습니다.
 * 프로토타입: 바꾼 내용은 이 브라우저에만 저장(시연 기록). 실제 시스템은 서버가 판단하고 저장(REQ-AUTH-09)
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

  // 걸고 푼 기록 전체: 영업이 등록할 때 건 것 + 관리자가 바꾼 것 (최근 것부터)
  function events() {
    const reg = D.RESTRICT_LOG.map(function (x) {
      const c = find(x.id);
      return { at: x.at, by: x.by, target: c ? label(c) : x.id, change: '열람 제한 설정', reason: x.reason, id: x.id, on: x.on };
    });
    const adm = C.adminLog(['RESTRICT']).map(function (e) {
      return Object.assign({}, e, e.op ? { id: e.op.id, on: e.op.on } : { id: e.target.split(' ')[0], on: e.change.indexOf('해제') < 0 });
    });
    return reg.concat(adm).sort(function (a, b) { return b.at.localeCompare(a.at); });
  }
  // 지금 걸려 있는 제한을 건 때와 사람
  function setInfo(id) {
    const e = events().filter(function (x) { return x.id === id && x.on; })[0];
    return e ? C.fmtDate(e.at) + '<span class="cell-meta">' + esc(C.userName(e.by)) + '님</span>' : '-';
  }

  function render() {
    const list = D.CONTRACTS.filter(function (c) { return c.id && c.restricted; })
      .sort(function (a, b) { return b.id.localeCompare(a.id); });
    $('#count').textContent = list.length + '건';
    $('#rows').innerHTML = list.length ? list.map(function (c) {
      return '<tr><td><a class="cell-title" href="review.html?id=' + encodeURIComponent(c.id) + '">' + esc(c.counterparty) + '</a>' +
          '<span class="cell-meta">' + esc(c.id) + ' ' + C.icon('lock', 'sm') + ' ' + esc(C.kindLabel(c)) + '</span></td>' +
        '<td>' + esc(C.serviceLabel(c.services)) + '</td>' +
        '<td class="nowrap">' + C.statusBadge(c) + '</td>' +
        '<td class="nowrap">' + esc(C.userName(c.requesterId)) + '</td>' +
        '<td class="nowrap num-left">' + setInfo(c.id) + '</td>' +
        '<td class="col-action"><button type="button" class="link-act link-act--danger" data-off="' + esc(c.id) + '" aria-label="' + esc(c.counterparty) + ' 열람 제한 풀기">풀기</button></td></tr>';
    }).join('') : '<tr><td class="empty-row" colspan="6">열람 제한 계약이 없습니다.</td></tr>';
    $('#history').innerHTML = C.adminHistoryHtml(events(), '열람 제한 변경 이력');
  }

  function openAdd() {
    const opts = D.CONTRACTS.filter(function (c) { return c.id && !c.restricted; })
      .sort(function (a, b) { return b.id.localeCompare(a.id); })
      .map(function (c) { return [c.id, label(c) + ' (' + C.kindLabel(c) + ', ' + D.STATUS[c.status].label + ')']; });
    C.formModal({
      title: '열람 제한을 걸까요?',
      desc: '걸면 요청자, 그 계약의 담당자, 관리자만 볼 수 있고, 다른 사람에게는 목록에 "열람 제한 계약"으로만 보입니다.',
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
    const c = find(id);
    C.formModal({
      title: '열람 제한을 풀까요?',
      desc: '풀면 로그인한 모든 사용자가 이 계약을 볼 수 있습니다.',
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

  $('#content').addEventListener('click', function (e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'btn-add') openAdd();
    else if (b.getAttribute('data-off')) openOff(b.getAttribute('data-off'));
  });
  render();
})();
