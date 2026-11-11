/* =====================================================================
 * SCR-22 검토 완료 화면 로직 (review-done.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-FLOW-12, REQ-DOC-06, REQ-REV-06
 * 하는 일
 *   1. 결재 기록(approval_history) 중 내가 한 일(승인, 반려, 승인 취소)을 모음
 *      (최고관리자, 관리자는 모든 사람의 기록을 처리한 사람 칸과 함께)
 *   2. 검색, 한 일, 단계, 지금 상태로 거르기. 최근 것부터
 *   3. 한 쪽에 20건씩 쪽 나누기
 *   4. 의견 칸의 확인 문장은 "확인 항목 n개 확인"으로 줄여 보임 (기획자 결정 2026-11-02 D-11, 결재 기록은 그대로)
 *   5. 휴대폰에서는 지금 상태 칸을 감추고 상태 배지를 고객사 아래 작은 줄에 둠 (기획자 결정 2026-11-02 D-9, PC는 그대로)
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const PAGE_SIZE = 20;

  // 관리자 보기는 뺌(기획자 결정 2026-11-09: 관리자는 처리하지 않고, 이 화면은 관리자 메뉴에도 없었음). 최고관리자는 시연용으로 모두 봄
  const seeAll = me.role === 'SUPER';
  if (!seeAll && !C.hasRole(me, D.PROCESS_ROLES)) {
    $('#notice').innerHTML = C.noticeBox('', '검토 완료는 단계를 처리하는 역할만 씁니다',
      '지금은 ' + esc(C.roleLabel(me.role)) + ' 역할로 보고 있습니다.');
    $('#list').hidden = true;
    return;
  }
  if (seeAll) $('#intro').textContent = '모든 사람이 처리한 결재 기록입니다(' + C.roleLabel(me.role) + ' 보기). 최근 것부터 보여 줍니다.';

  // 결재 기록 모으기 (열람 제한 계약은 볼 수 있는 것만)
  const all = [];
  D.CONTRACTS.forEach(function (c) {
    if (!C.canView(c, me)) return;
    (c.history || []).forEach(function (h) {
      if (h.action === 'SUBMIT') return; // 앞 차수의 기안 줄은 결재가 아님(v0.61 검토)
      if (seeAll || h.actorId === me.id) all.push({ c: c, h: h });
    });
  });
  all.sort(function (a, b) { return b.h.at.localeCompare(a.h.at); });

  function options(first, pairs) {
    return '<option value="">' + esc(first) + '</option>' + pairs.map(function (p) { return '<option value="' + p[0] + '">' + esc(p[1]) + '</option>'; }).join('');
  }
  // 한 일: ⑥⑧⑨⑩의 승인은 "완료"로 함께 셈. 체결본 등록(⑦, 영업)은 최고관리자, 관리자 보기에서만 나옴
  //   보완 요청(②~⑤)과 보완 완료(기안자, 최고관리자와 관리자 보기)도 목록에 나오므로 거르기에 둠 (v0.63 점검에서 고침)
  $('#f-action').innerHTML = options('전체', [['APPROVE', '승인, 완료'], ['REJECT', '반려'], ['SUPPLEMENT', '보완 요청'], ['CANCEL', '승인 취소'], ['RETURN', '다시 등록 요청'], ['CONFLICT', '이해관계 있음'], ['ASSIGN', '결재자 지정']] /* 결재자 지정은 기획자 결정 2026-11-10 18번,  기획자 결정 2026-11-09 5회차 14번 */
    .concat(seeAll ? [['REGISTER', '체결본 등록'], ['RESUBMIT', '보완 완료']] : [])); // 체결본 등록과 보완 완료는 영업의 일이라 모두 보는 보기에서만
  $('#f-step').innerHTML = options('전체 단계', D.REVIEW_GROUPS.concat(D.POST_GROUPS).reduce(function (a, g) { return a.concat(g); }, []).map(function (code) { return [code, C.stepLabel(code)]; }));
  $('#f-status').innerHTML = options('전체 상태', Object.keys(D.STATUS).filter(function (k) { return k !== 'DRAFT'; }).map(function (k) { return [k, D.STATUS[k].label]; }));

  // 기획자 결정 2026-11-02 D-9: 휴대폰에서는 지금 상태 칸을 감추고(col-status) 상태 배지를 고객사 아래 작은 줄에 둠. 개요 진행 상세(v0.55)와 같은 방식
  $('#thead').innerHTML = '<tr><th scope="col">처리일시</th><th scope="col" class="col-customer">고객사</th><th scope="col">단계</th><th scope="col">한 일</th>' +
    (seeAll ? '<th scope="col">처리한 사람</th>' : '') + '<th scope="col" class="col-phone-wide">의견, 사유</th><th scope="col" class="col-status">지금 상태</th></tr>';

  // 기획자 결정 2026-11-02 D-3: 단계 칸의 짧은 이름은 처리하는 사람 이름으로("② 영업지원", "③ 영업 리더"). 계약마다 바뀌는 이름은 common.js stepTag가 정함
  const stepTag = C.stepTag;

  // 기획자 결정 2026-11-02 D-11: 이 목록에서만 되풀이되는 확인 문장("확인: 고객사와 사업자등록번호, ...")을 "확인 항목 n개 확인"으로 줄임
  //   ②, ⑥, ⑦, ⑧, ⑨를 처리하면 확인한 항목이 결재 기록에 "확인: 항목, 항목"으로 남음. 항목 이름에는 쉼표를 쓰지 않으므로(mock-data.js) 쉼표로 나눠 셈
  //   확인 문장 뒤의 메모는 그대로 붙임. 반려, 승인 취소, 보완 요청, 다시 등록 요청의 사유는 줄이지 않음(승인과 체결본 등록만 줄임)
  //   결재 기록(approval_history)은 바뀌지 않음. 항목 이름은 결재 문서의 결재 기록에서 모두 봄
  function commentText(h) {
    const t = h.comment || '';
    if (['APPROVE', 'REGISTER'].indexOf(h.action) < 0 || t.indexOf('확인: ') !== 0) return t;
    const end = t.indexOf('. '); // 확인 문장과 메모 사이
    const n = (end < 0 ? t.slice(4) : t.slice(4, end)).split(', ').filter(Boolean).length;
    const rest = end < 0 ? '' : t.slice(end + 2);
    return '확인 항목 ' + n + '개 확인' + (rest ? '. ' + rest : '');
  }

  let page = 1;
  function filtered() {
    const q = $('#f-q').value.trim().toLowerCase();
    const action = $('#f-action').value, step = $('#f-step').value, status = $('#f-status').value;
    return all.filter(function (x) {
      if (q && x.c.counterparty.toLowerCase().indexOf(q) < 0 && String(x.c.id).toLowerCase().indexOf(q) < 0) return false;
      if (action && x.h.action !== action) return false;
      if (step && x.h.step !== step) return false;
      if (status && x.c.status !== status) return false;
      return true;
    });
  }

  function render() {
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (page > pages) page = pages;
    const from = (page - 1) * PAGE_SIZE;
    const rows = list.slice(from, from + PAGE_SIZE);
    const count = function (a) { return list.filter(function (x) { return x.h.action === a; }).length; };
    $('#list-count').innerHTML = C.meta([[(list.length !== all.length ? '검색 결과' : '전체'), '<strong>' + list.length + '건</strong>'],
      ['승인, 완료', count('APPROVE') + '건'], ['반려', count('REJECT') + '건'], ['보완 요청', count('SUPPLEMENT') + '건'], ['승인 취소', count('CANCEL') + '건'], ['다시 등록 요청', count('RETURN') + '건'], ['이해관계 있음', count('CONFLICT') + '건'], ['결재자 지정', count('ASSIGN') + '건']]); /* 기획자 결정 2026-11-10 18번 */ // 기획자 결정 2026-11-09 5회차 14번
    const cols = seeAll ? 7 : 6;
    $('#rows').innerHTML = rows.length ? rows.map(function (x) {
      const a = D.APPROVAL_ACTIONS[x.h.action];
      return '<tr>' +
        '<td class="num-left">' + C.fmtDateTime(x.h.at).split(' ').map(function (s) { return '<span class="keep">' + s + '</span>'; }).join(' ') + '</td>' + // 날짜와 시각을 각각 한 줄로("2026-10-" 뒤에서 끊기지 않게). 결재 문서의 결재 기록과 같은 방식 (첫 사용 점검)
        '<td><a class="cell-title" href="review.html?id=' + encodeURIComponent(x.c.id) + '">' + esc(x.c.counterparty) + '</a>' +
          '<span class="cell-sub">' + C.statusBadge(x.c) + (C.holdOf(x.c) ? ' ' + C.holdBadge(C.holdOf(x.c)) : '') + '</span>' + // 휴대폰에서만 보이는 상태 배지 줄 (D-9). 보류 배지도(기획자 결정 2026-11-09)
          // 계약번호는 날짜처럼 한 줄로 (마지막 하이픈에서 끊기지 않게). 서비스와 차수는 쉼표 뒤에서 줄이 바뀔 수 있음
          '<span class="cell-meta"><span class="nowrap">' + esc(x.c.id) + '</span>, ' + esc(C.serviceLabel(x.c.services)) + ', ' + (x.h.round || 1) + '차</span></td>' +
        '<td class="nowrap">' + esc(stepTag(x.h.step, x.c)) + '</td>' + // PC에서도 번호와 이름을 한 줄로("②"만 윗줄에 남지 않게). 짧은 칸이라 검토 대기의 단계 칸처럼 가운데 (첫 사용 점검)
        '<td class="nowrap">' + C.badge(a.tone, C.actionLabel(x.h, x.c)) + '</td>' +
        (seeAll ? '<td class="center cell-phone-nowrap">' + esc(C.ownerLabel(x.h.actorId, x.h.actorDept)) + (x.h.onBehalfOf ? '<span class="cell-meta">' + esc(C.ownerLabel(x.h.onBehalfOf)) + ' 대신</span>' : '') + '</td>' : '') +
        '<td>' + (x.h.comment ? esc(commentText(x.h)) : '-') + '</td>' + // 확인 문장은 개수만 (D-11)
        '<td class="nowrap col-status">' + C.statusBadge(x.c) + (C.holdOf(x.c) ? '<span class="cell-meta">' + C.holdBadge(C.holdOf(x.c)) + '</span>' : '') + '</td>' + // 휴대폰에서는 감춤 (D-9). 보류 중이면 배지(기획자 결정 2026-11-09)
      '</tr>';
    }).join('') : '<tr><td class="empty-row" colspan="' + cols + '">' + (all.length ? '조건에 맞는 기록이 없습니다.' : '아직 처리한 결재가 없습니다.') + '</td></tr>';
    $('#pagination').innerHTML = C.pagerHtml(page, pages, list.length, from, rows.length, PAGE_SIZE, '건');
  }

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
    // 쪽 번호를 다시 그려 누른 단추가 없어지므로 초점을 목록 제목으로 옮기고 화면도 거기로(2026-11-06 점검 3회차)
    C.focusSection('#list-title');
  });
  render();
})();
