/* =====================================================================
 * SCR-23 검토 상세 화면 로직 (review.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-DOC-01, 02, 06, 07, REQ-STEP-04, REQ-FLOW-12, REQ-ENV-06, REQ-AUTH-09, 15, REQ-REV-02~05
 * 하는 일
 *   1. 주소의 계약번호로 계약을 찾고, 볼 수 있는 사람인지 확인
 *   2. 결재란, 기본 정보, 금액과 제품, 체크리스트, 첨부, 결재 기록을 결재 문서처럼 그리기
 *   3. 내 차례면 처리 막대에서 승인(의견 선택), 반려(사유 필수), 내가 승인한 단계는 승인 취소
 * 결재 상태 계산(누가 차례인지, 반려와 승인 완료)은 common.js(buildReview)가 결재 기록으로 합니다.
 * 프로토타입: 계약 상세 값 중 예시 데이터에 없는 것(사업자등록번호, 제품 줄 등)은 이 파일에서 만들어 보여 줍니다.
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };

  const id = new URLSearchParams(location.search).get('id');
  const c = D.CONTRACTS.find(function (x) { return x.id === id; });

  function notice(kind, title, body) {
    return '<div class="notice' + (kind ? ' notice--' + kind : '') + '" role="status"><p class="notice-title">' +
      C.icon(kind === 'success' ? 'check' : 'alert') + esc(title) + '</p>' + (body ? '<p>' + body + '</p>' : '') + '</div>';
  }

  /* ---------- 1. 계약 찾기와 열람 권한 ---------- */
  if (!c) {
    $('#notice').innerHTML = notice('', '계약을 찾을 수 없습니다', '주소의 계약번호를 확인해 주세요. 예: review.html?id=CT-2026-0412');
    return;
  }
  if (c.status === 'DRAFT') {
    $('#notice').innerHTML = notice('', '임시 저장한 계약은 결재 문서가 없습니다', '기안하면 결재 문서가 만들어집니다.');
    return;
  }
  if (!C.canView(c, me)) {
    $('#doc-title').innerHTML = C.icon('lock') + '열람 제한 계약';
    $('#notice').innerHTML = notice('', '이 계약은 볼 수 없습니다',
      '열람 제한 계약은 요청자, 그 계약의 결재선에 든 사람, 관리자만 볼 수 있습니다.');
    return;
  }

  /* ---------- 상세 값 (예시 데이터에 없으면 만들어 보여 줌, 프로토타입 전용) ---------- */
  const f = c.form || {};
  const PRICE = {};
  D.PRICE_BOOK.forEach(function (p) { PRICE[p.code] = p; });
  function num(n) { return Number(n || 0).toLocaleString('ko-KR'); }
  function pct(r) { return Math.round(r * 1000) / 10 + '%'; }
  function addDays(iso, days) {
    const p = iso.split('-').map(Number);
    const d = new Date(p[0], p[1] - 1, p[2] + days);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  const seq = Number(String(c.id).replace(/\D/g, '').slice(-4)) || 1;
  const reqDate = (c.requestedAt || '').slice(0, 10);
  const startDate = c.startDate || f.startDate || addDays(reqDate, 14);
  const endDate = c.endDate || f.endDate || addDays(addDays(startDate, 365), -1);
  const detail = {
    bizNo: f.bizNo || (100 + seq % 800) + '-' + (81 + seq % 9) + '-' + String(10000 + (seq * 37) % 89999).padStart(5, '0'),
    method: f.method || (c.type === '리셀러 계약' ? 'RESELLER' : 'DIRECT'),
    settlement: f.settlement || 'LUMP',
    contractDate: f.contractDate || reqDate,
    startDate: startDate, endDate: endDate,
    autoRenew: f.autoRenew || 'NO', noticeDays: f.noticeDays,
    memo: c.memo || f.memo || '',
  };
  // 제품 줄: 예시 데이터에 없으면 서비스별 기본 제품을 표준 단가 그대로 넣은 줄을 만듦
  function productRows() {
    let list = c.products || f.products;
    if (!list) {
      const base = { CK: 'CK-ORG', HR: 'HR-BASE' };
      const share = c.amount / (c.services || []).length;
      list = c.amount ? (c.services || []).map(function (s) {
        const p = PRICE[base[s]];
        return { code: p.code, qty: Math.max(1, Math.floor(share / p.listPrice)), amount: share };
      }) : [];
    }
    return list.map(function (r) {
      const p = PRICE[r.code];
      const std = p.listPrice * r.qty;
      return { product: p, qty: r.qty, amount: r.amount, std: std, discount: Math.max(0, (std - r.amount) / std) };
    });
  }
  // 첨부 파일 (데이터 정의서 attachment). 예시 이름은 고객사 이름으로 만듦
  function files() {
    const list = [{ kind: 'DRAFT_DOC', name: c.counterparty + '_계약서_초안_' + (c.round || 1) + '차.docx', size: 84000 + seq * 13 }];
    if (c.amount) list.push({ kind: 'QUOTE', name: c.counterparty + '_최종견적서.pdf', size: 212000 + seq * 7 });
    return list;
  }

  /* ---------- 2. 머리와 안내 ---------- */
  const round = c.round || 1;
  const kindText = D.KINDS[c.kind] + (c.parentId ? ' (원계약 ' + c.parentId + ')' : '');
  $('#doc-title').textContent = c.counterparty;
  $('#doc-meta').innerHTML = C.meta([esc(c.id), esc(C.serviceLabel(c.services)), esc(kindText), round + '차 기안', C.statusBadge(c)]);

  const actionable = (c.approvals || []).filter(function (s) { return C.canAct(c, s, me); });
  const cancelable = (c.approvals || []).filter(function (s) { return C.canCancel(c, s, me); });
  const isMine = function (s) { return s.userId === me.id; };

  function renderNotice() {
    let html = '';
    const mineNow = actionable.filter(isMine);
    if (mineNow.length) {
      const s = mineNow[0];
      html = notice('', C.stepLabel(s.step) + ' 차례입니다 (' + C.waitDays(c, s) + '일째)',
        '계약 내용과 체크리스트, 첨부 파일을 확인한 뒤 화면 아래에서 승인하거나 반려해 주세요. 승인 의견은 적지 않아도 되고, 반려할 때는 사유를 꼭 적습니다.');
    } else if (c.status === 'REJECTED') {
      html = notice('', C.stepLabel(c.rejection.step) + '에서 반려되었습니다',
        '<strong>' + esc(C.userName(c.rejection.by)) + '님 (' + C.fmtDateTime(c.rejection.at) + ')</strong><br>' + esc(c.rejection.reason) +
        '<br>기안자가 보완해 ' + (round + 1) + '차로 다시 기안합니다.');
    } else if (c.status === 'APPROVED') {
      html = notice('success', '계약 검토가 끝났습니다',
        C.fmtDateTime(c.approvedAt) + '에 마지막 검토가 승인되어 체결 대기 중입니다. 다음은 ⑥ 인장 날인 검토입니다.');
    } else if (c.status === 'IN_REVIEW' && actionable.length && me.role === 'SUPER') {
      html = notice('', '시연: 담당자 대신 처리해 볼 수 있습니다',
        '슈퍼관리자는 모든 결재 문서를 볼 수 있고, 프로토타입에서는 담당자 대신 승인이나 반려를 눌러 볼 수 있습니다. 실제 시스템에서는 담당자 본인만 처리합니다(대리 결재는 미정).');
    }
    $('#notice').innerHTML = html;
  }

  /* ---------- 3. 결재란 (REQ-DOC-02) ----------
   * 칸: ① 기안 + 계약 검토 단계 ②~⑤. 생략한 단계도 칸을 두어 왜 생략했는지 보이게 함 */
  function renderBox() {
    const steps = c.approvals || [];
    const head = '<th scope="col">' + esc(D.STEPS.S01.no + ' ' + D.STEPS.S01.short) + '</th>' +
      steps.map(function (s) { return '<th scope="col">' + esc(D.STEPS[s.step].no + ' ' + D.STEPS[s.step].short) + '</th>'; }).join('');
    const who = '<td>' + esc(C.roleLabel('SALES')) + '<br><strong>' + esc(C.userName(c.requesterId)) + '</strong></td>' +
      steps.map(function (s) {
        return '<td' + (s.state === 'SKIPPED' ? ' class="is-skipped"' : '') + '>' + esc(C.roleLabel(s.role)) + '<br><strong>' + esc(C.userName(s.userId)) + '</strong></td>';
      }).join('');
    const result = '<td>' + C.badge('line', '기안') + '</td>' +
      steps.map(function (s) {
        const st = D.APPROVAL_STATE[s.state];
        return '<td' + (s.state === 'SKIPPED' ? ' class="is-skipped"' : '') + '>' + C.badge(st.tone, st.label) + '</td>';
      }).join('');
    const when = '<td class="box-when">' + C.fmtDateTime(c.requestedAt) + '</td>' +
      steps.map(function (s) {
        let t;
        if (s.state === 'DONE' || s.state === 'REJECTED') t = C.fmtDateTime(s.decidedAt) + (s.onBehalfOf ? '<br>' + esc(C.userName(s.decidedBy)) + '님 대신' : '');
        else if (s.state === 'PENDING') t = C.waitDays(c, s) + '일째';
        else if (s.state === 'SKIPPED') t = esc(s.reason);
        else t = '-';
        return '<td class="box-when' + (s.state === 'SKIPPED' ? ' is-skipped' : '') + '">' + t + '</td>';
      }).join('');
    $('#approval-box').innerHTML =
      '<caption class="sr-only">결재란: 단계마다 담당자, 결과, 일시</caption>' +
      '<thead><tr><th scope="row" class="box-rowhead">단계</th>' + head + '</tr></thead>' +
      '<tbody>' +
        '<tr><th scope="row" class="box-rowhead">담당</th>' + who + '</tr>' +
        '<tr><th scope="row" class="box-rowhead">결과</th>' + result + '</tr>' +
        '<tr><th scope="row" class="box-rowhead">일시</th>' + when + '</tr>' +
      '</tbody>';
    const routed = C.routedSteps(c).map(function (s) { return D.STEPS[s.step].no; }).join(', ');
    $('#box-desc').textContent = '거치는 단계: ' + routed + '. ② 다음 ③과 ④는 동시에 검토하고, 둘 다 끝나면 ⑤를 검토합니다. 생략한 단계는 체크리스트 답에 따른 것입니다.';
  }

  /* ---------- 4. 기본 정보, 금액, 체크리스트, 첨부, 결재 기록 ---------- */
  function info(label, value) { return '<div><dt>' + esc(label) + '</dt><dd>' + value + '</dd></div>'; }
  function renderBasic() {
    $('#basic').innerHTML = [
      info('계약번호', esc(c.id)),
      info('계약 구분', esc(kindText)),
      info('고객사', esc(c.counterparty)),
      info('사업자등록번호', esc(detail.bizNo)),
      info('영업 대표', esc(C.userName(c.requesterId)) + '님'),
      info('계약 유형', esc(c.type)),
      info('계약 방식', esc(D.METHODS[detail.method])),
      info('정산 방식', esc(D.SETTLEMENTS[detail.settlement])),
      info('계약일', C.fmtDate(detail.contractDate)),
      info('계약 기간', C.fmtDate(detail.startDate) + ' ~ ' + C.fmtDate(detail.endDate)),
      info('자동갱신', detail.autoRenew === 'YES' ? '있음 (해지 통지: 만료 ' + (detail.noticeDays || '-') + '일 전)' : '없음'),
      info('개인정보 처리', c.personalData ? '있음' : '없음'),
      info('열람 제한', c.restricted ? C.icon('lock', 'sm') + '있음' : '없음'),
    ].join('');
  }

  function renderAmount() {
    const rows = productRows();
    if (!rows.length) { $('#amount').innerHTML = '<p class="empty">금액이 없는 계약입니다(비밀유지계약 등).</p>'; return; }
    const total = rows.reduce(function (a, r) { return a + r.amount; }, 0);
    $('#amount').innerHTML =
      '<div class="tbl-wrap"><table class="tbl tbl--compact">' +
        '<caption class="sr-only">제품별 금액: 제품, 수량, 표준 금액, 계약 금액, 할인율</caption>' +
        '<thead><tr><th scope="col">제품</th><th scope="col" class="num">수량</th><th scope="col" class="num">표준 금액</th><th scope="col" class="num">계약 금액</th><th scope="col">할인율</th></tr></thead>' +
        '<tbody>' + rows.map(function (r) {
          const over = r.discount > r.product.discountCap + 1e-9;
          const tag = r.discount === 0 ? C.badge('success', '표준 단가')
            : C.badge(over ? 'danger' : 'progress', pct(r.discount) + (over ? ', 캡 초과' : ', 캡 이내'));
          return '<tr><td>' + esc(r.product.name) + '</td><td class="num">' + num(r.qty) + '</td><td class="num">' + num(r.std) + '</td>' +
            '<td class="num">' + num(r.amount) + '</td><td class="nowrap">' + tag + ' <span class="cap-note">캡 ' + pct(r.product.discountCap) + '</span></td></tr>';
        }).join('') + '</tbody>' +
        '<tfoot><tr><th scope="row">계약 금액 총액 (부가세 별도)</th><td></td><td></td><td class="num total">' + num(total) + '</td><td>' + esc(C.fmtKRW(total)) + '</td></tr></tfoot>' +
      '</table></div>';
  }

  function answer(v) {
    if (v === 'YES') return C.badge('success', '예');
    if (v === 'NO') return C.badge('danger', '아니오');
    if (v === 'NA') return C.badge('neutral', '해당 없음');
    return C.badge('line', '-');
  }
  function renderChecklist() {
    const ck = c.checklist || {};
    const route = C.reviewRoute(c);
    const q = [
      ['1. 표준계약서를 사용했나요?', ck.standard, ck.standardNote || (f.checklist && f.checklist.standardNote), 'S03'],
      ['2. 표준단가표를 적용했나요? (자동 계산)', ck.price, ck.priceNote, 'S05'],
      ['3. 할인율 캡을 지켰나요? (자동 계산)', ck.cap, ck.capNote, 'S05'],
    ];
    $('#checklist').innerHTML = '<ul class="doc-checks">' + q.map(function (x, i) {
      const r = route[x[3]];
      const effect = i === 1 ? '' : '<span class="check-effect">' + esc(D.STEPS[x[3]].no + ' ' + D.STEPS[x[3]].name + (r[0] ? ' 거침' : ' 생략') + ': ' + r[1]) + '</span>';
      return '<li><p class="check-q-text">' + esc(x[0]) + ' ' + answer(x[1]) + '</p>' +
        '<p class="check-note">비고: ' + (x[2] ? esc(x[2]) : '없음') + '</p>' + effect + '</li>';
    }).join('') + '</ul>' +
    '<p class="check-effect">④ 개인정보 검토 ' + (route.S04[0] ? '거침' : '생략') + ': ' + esc(route.S04[1]) + '</p>';
  }

  function renderFiles() {
    const fmtSize = function (b) { return b >= 1048576 ? (b / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(b / 1024)) + 'KB'; };
    $('#files').innerHTML = files().map(function (x) {
      return '<li><span class="file-info">' + C.badge('line', D.FILE_KINDS[x.kind]) + ' <span class="file-name">' + esc(x.name) + '</span>' +
        '<span class="file-size">' + fmtSize(x.size) + ', ' + round + '차 기안</span></span>' +
        '<span class="file-acts"><button type="button" class="btn-text" data-file="preview">미리보기</button>' +
        '<button type="button" class="btn-text" data-file="download">내려받기</button></span></li>';
    }).join('');
    $('#memo').textContent = detail.memo || '없음';
  }

  function renderHistory() {
    const rows = [{ at: c.requestedAt, step: 'S01', action: 'SUBMIT', actorId: c.requesterId, comment: '', round: 1 }].concat(c.history || []);
    $('#history').innerHTML =
      '<caption class="sr-only">결재 기록: 일시, 차수, 단계, 한 일, 처리한 사람, 의견</caption>' +
      '<thead><tr><th scope="col">일시</th><th scope="col">차수</th><th scope="col">단계</th><th scope="col">한 일</th><th scope="col">처리한 사람</th><th scope="col">의견, 사유</th></tr></thead>' +
      '<tbody>' + rows.map(function (h) {
        const a = D.APPROVAL_ACTIONS[h.action];
        const who = esc(C.userName(h.actorId)) + '님' + (h.onBehalfOf ? ' <span class="behalf">(' + esc(C.userName(h.onBehalfOf)) + '님 대신, 시연)</span>' : '');
        return '<tr><td class="nowrap num-left">' + C.fmtDateTime(h.at) + '</td><td class="nowrap">' + (h.round || 1) + '차</td>' +
          '<td class="nowrap">' + esc(D.STEPS[h.step].no + ' ' + D.STEPS[h.step].short) + '</td>' +
          '<td class="nowrap">' + C.badge(a.tone, a.label) + '</td><td class="nowrap">' + who + '</td><td>' + (h.comment ? esc(h.comment) : '-') + '</td></tr>';
      }).join('') + '</tbody>';
  }

  /* ---------- 5. 처리 막대와 확인 창 ---------- */
  function renderActions() {
    const bar = $('#action-bar');
    if (!actionable.length && !cancelable.length) { bar.hidden = true; return; }
    let html = '';
    if (actionable.length) {
      // 슈퍼관리자는 ③④처럼 동시에 차례인 단계 중 하나를 골라 대신 처리 (프로토타입 전용)
      const pick = actionable.length > 1
        ? '<label class="act-pick">처리할 단계 <select class="select" id="act-step">' + actionable.map(function (s) {
            return '<option value="' + s.step + '">' + esc(C.stepLabel(s.step)) + ' (' + esc(C.userName(s.userId)) + '님)</option>';
          }).join('') + '</select></label>'
        : '<p class="act-target"><strong>' + esc(C.stepLabel(actionable[0].step)) + '</strong>' +
          (isMine(actionable[0]) ? '' : ' <span class="behalf">' + esc(C.userName(actionable[0].userId)) + '님 대신 (시연)</span>') + '</p>';
      html += '<div class="act-row">' + pick +
        '<div class="act-btns"><button type="button" class="btn btn--tertiary btn--md btn-reject" data-open="REJECT">반려</button>' +
        '<button type="button" class="btn btn--primary btn--md" data-open="APPROVE">승인</button></div></div>';
    }
    if (cancelable.length) {
      html += '<div class="act-row act-row--cancel">' + cancelable.map(function (s) {
        return '<p class="act-target">' + esc(C.stepLabel(s.step)) + ' 승인을 다음 단계가 처리하기 전까지 취소할 수 있습니다.</p>' +
          '<button type="button" class="btn btn--tertiary btn--md" data-open="CANCEL" data-step="' + s.step + '">승인 취소</button>';
      }).join('') + '</div>';
    }
    bar.innerHTML = html;
    bar.hidden = false;
  }

  const modal = $('#act-modal');
  let pending = null;
  let lastFocus = null;
  const TEXT = {
    APPROVE: { title: '승인할까요?', label: '의견 (선택)', btn: '승인', required: false },
    REJECT: { title: '반려할까요?', label: '반려 사유 (필수)', btn: '반려', required: true },
    CANCEL: { title: '승인을 취소할까요?', label: '취소 사유 (필수)', btn: '승인 취소', required: true },
  };
  function openModal(action, stepCode) {
    const s = c.approvals.find(function (x) { return x.step === stepCode; });
    const t = TEXT[action];
    pending = { action: action, step: s };
    $('#act-title').textContent = t.title;
    $('#act-desc').textContent = c.counterparty + ', ' + C.stepLabel(s.step) +
      (action === 'REJECT' ? '. 반려하면 기안자에게 돌아가고, 보완해 다음 차수로 다시 기안합니다.' :
       action === 'CANCEL' ? '. 취소하면 이 단계는 다시 차례가 되고, 승인과 취소 기록은 모두 남습니다.' :
       '. 승인하면 다음 단계로 넘어갑니다.');
    $('#act-label').textContent = t.label;
    $('#act-comment').value = '';
    $('#act-error').hidden = true;
    $('#act-field').classList.remove('is-invalid');
    $('#act-confirm').textContent = t.btn;
    lastFocus = document.activeElement;
    modal.hidden = false;
    $('#act-comment').focus();
  }
  function closeModal() { modal.hidden = true; pending = null; if (lastFocus) lastFocus.focus(); }
  function confirmAction() {
    const t = TEXT[pending.action];
    const comment = $('#act-comment').value.trim();
    if (t.required && !comment) {
      $('#act-error').innerHTML = C.icon('alert', 'sm') + t.label.replace(' (필수)', '') + '를 적어 주세요.';
      $('#act-error').hidden = false;
      $('#act-field').classList.add('is-invalid');
      $('#act-comment').focus();
      return;
    }
    const s = pending.step;
    C.recordAction(c, s, pending.action, comment, me);
    // 다음 차례 안내
    let next = '';
    if (pending.action === 'APPROVE') {
      const now = C.pendingSteps(c).map(function (x) { return C.stepLabel(x.step); }).join(', ');
      next = c.status === 'APPROVED' ? ' 계약 검토가 모두 끝나 체결 대기가 되었습니다.' : now ? ' 다음 차례: ' + now : '';
    }
    const done = { APPROVE: '승인했습니다.', REJECT: '반려했습니다. 기안자에게 돌아갑니다.', CANCEL: '승인을 취소했습니다.' }[pending.action];
    C.flash(C.stepLabel(s.step) + ' ' + done + next);
    location.reload();
  }
  $('#action-bar').addEventListener('click', function (e) {
    const b = e.target.closest('[data-open]');
    if (!b) return;
    const sel = $('#act-step');
    const stepCode = b.getAttribute('data-step') || (sel ? sel.value : actionable[0].step);
    openModal(b.getAttribute('data-open'), stepCode);
  });
  modal.addEventListener('click', function (e) {
    if (e.target === modal || e.target.closest('[data-act="close"]')) closeModal();
    if (e.target.closest('[data-act="confirm"]')) confirmAction();
  });
  document.addEventListener('keydown', function (e) {
    if (modal.hidden) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Tab') { // 확인 창 안에서만 이동
      const f = Array.prototype.slice.call(modal.querySelectorAll('textarea, button'));
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  // 첨부 미리보기, 내려받기 (프로토타입은 안내만)
  $('#files').addEventListener('click', function (e) {
    const b = e.target.closest('[data-file]');
    if (!b) return;
    C.toast(b.getAttribute('data-file') === 'download'
      ? '프로토타입: 실제 시스템에서는 파일을 내려받고, 누가 언제 받았는지 기록에 남깁니다.'
      : '프로토타입: 실제 시스템에서는 새 창에서 파일 미리보기가 열립니다.');
  });

  renderNotice();
  renderBox();
  renderBasic();
  renderAmount();
  renderChecklist();
  renderFiles();
  renderHistory();
  renderActions();
  $('#doc').hidden = false;
})();
