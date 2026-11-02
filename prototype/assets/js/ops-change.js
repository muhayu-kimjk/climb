/* =====================================================================
 * SCR-14 운영 변경 기안 화면 로직 (ops-change.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-CHG-06~11 (기획자 결정 v0.26: 재무 문서의 계약 체결 이후 수정 절차 반영)
 * 하는 일
 *   1. 주소의 원계약 번호로 묶음을 찾고 운영 변경을 기안할 수 있는지 확인
 *      (지금 유효한 계약이 계약 완료, 영업대표 본인(시연용 최고관리자 포함), 진행 중인 해지 없음)
 *   2. 변경 종류 하나: 계약 기간 변경(새 종료일), 추가 충전(수량, 유상이면 금액). 서비스에 있는 것만 고를 수 있음
 *   3. 변경 사유(필수), CRM 영업활동 링크(필수, https)
 *   4. 결재선 미리 보기: ③ 영업 검토(기간 2개월 넘게 바뀜, 무상 충전 계약 연도 누적 50건 초과일 때만) → ⑨ 운영 변경(고객지원, HR 충전은 재무)
 *      → ⑩ 재무 확인(기획자 결정 2026-11-02 B-3, 추천과 다름: 운영 변경 모두. HR 충전은 ⑨를 한 사람이 아닌 재무 리더)
 *      무상 충전은 이번 계약 연도에 이미 받은 수량과 이번까지의 누적을 보임(B-4, C.freeChargeUsed)
 *      유상 충전은 기능을 고르고 그날 가격 기준의 표준 단가 x 수량과 할인율을 보임(B-3 덧붙임, 막지 않음)
 *   5. 기안하면 -C01 번호로 원계약에 묶어 저장(프로토타입은 이 브라우저에만)하고 결재 문서로 이동
 *   6. 보완 후 재기안(v0.58 기획자 결정): ops-change.html?id=반려된 운영 변경 번호로 열면 앞 차수 값을 채우고 같은 번호의 다음 차수로 기안
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  const notice = function (title, body) { return C.noticeBox('', title, body); };

  // 보완 후 재기안: 반려된 운영 변경을 같은 번호의 다음 차수로 (ops-change.html?id=2601CL001-C01)
  const params = new URLSearchParams(location.search);
  const again = C.resubmitSource(params.get('id'), me, function (c) { return c.kind === 'CHANGE'; });
  const origin = again ? again.parentId : params.get('origin');
  const found = D.CONTRACTS.find(function (c) { return c.id === origin; });
  const b = found ? C.bundleOf(C.rootOf(found)) : null;
  const back = b ? 'contract.html?id=' + encodeURIComponent(b.id) : 'contracts.html';
  if (!b || !C.canView(b.root, me)) {
    $('#notice').innerHTML = notice('변경할 계약을 찾을 수 없습니다', '계약 상세에서 "운영 변경 기안"을 눌러 들어와 주세요.');
    return;
  }
  const root = b.root;
  if (b.status !== 'ACTIVE') {
    $('#notice').innerHTML = notice('운영 변경을 기안할 수 없는 계약입니다', '지금 유효한 계약이 계약 완료일 때만 기안합니다. 지금 상태: ' + esc(D.STATUS[b.status].label) + '. <a href="' + back + '">계약 상세로</a>');
    return;
  }
  if (root.requesterId !== me.id && me.role !== 'SUPER') {
    $('#notice').innerHTML = notice('영업대표만 운영 변경을 기안합니다', '이 계약의 영업대표는 ' + esc(C.ownerLabel(root.requesterId)) + '입니다. <a href="' + back + '">계약 상세로</a>');
    return;
  }
  const terminating = b.open.filter(function (o) { return o.kind === 'TERMINATE'; });
  if (terminating.length) {
    $('#notice').innerHTML = notice('진행 중인 해지가 있습니다', terminating.map(function (o) {
      return '<a href="review.html?id=' + encodeURIComponent(o.id) + '">' + esc(o.id) + '</a> ' + esc(D.STATUS[o.status].label);
    }).join('<br>'));
    return;
  }
  // 기간 변경은 진행 중인 연장이나 다른 기간 변경과 겹치면 막음 [가정]
  const periodBusy = b.open.some(function (o) { return o.kind === 'RENEW' || (o.kind === 'CHANGE' && o.changeType === 'PERIOD'); });

  // 반려된 운영 변경이 있으면 새 번호 대신 그 기안을 보완해 같은 번호로 다시 기안 (v0.58 기획자 결정)
  const waiting = again ? [] : b.rejected.filter(function (o) { return o.kind === 'CHANGE'; });
  if (waiting.length) {
    $('#notice').innerHTML = C.noticeBox('', '반려된 운영 변경이 있습니다', waiting.map(function (o) {
      return '<a href="review.html?id=' + encodeURIComponent(o.id) + '">' + esc(o.id) + '</a> ' + esc(C.kindLabel(o)) + ' ' + (o.round || 1) + '차 반려';
    }).join('<br>') + '<br>새로 기안하지 않고 반려된 기안을 보완해 같은 번호의 다음 차수로 다시 기안합니다.',
      '<a class="btn btn--primary btn--md" href="' + C.resubmitHref(waiting[0]) + '">보완 후 재기안</a><a class="btn btn--tertiary btn--md" href="' + back + '">계약 상세로</a>');
    return;
  }

  /* ---------- 1. 변경할 계약 ---------- */
  const newId = again ? again.id : C.nextChildId(b.id, 'CHANGE');
  if (again) {
    document.querySelector('.page-title').textContent = '운영 변경 보완 후 재기안';
    $('#notice').innerHTML = C.rejectionNotice(again);
  }
  function info(label, value) { return '<div><dt>' + esc(label) + '</dt><dd>' + value + '</dd></div>'; }
  $('#origin').innerHTML = [
    info('고객사', esc(root.counterparty)),
    info('계약번호', '<a href="' + back + '">' + esc(b.id) + '</a>' + (b.current !== root ? ' (지금 유효: ' + esc(b.current.id) + ')' : '')),
    info('서비스', esc(C.serviceLabel(root.services))),
    info('계약 기간', C.fmtPeriod(b.start, b.end)),
    info('영업대표', esc(C.ownerLabel(root.requesterId))),
    info('진행 중인 일', b.open.length ? b.open.map(function (o) { return esc(o.id + ' ' + C.kindLabel(o)); }).join('<br>') : '없음'),
  ].join('');
  $('#number-help').textContent = again ? '같은 번호 ' + newId + '의 ' + ((again.round || 1) + 1) + '차로 기안합니다.' : '기안하면 ' + newId + '(운영 변경)로 원계약과 함께 묶입니다.';
  $('#btn-cancel').href = back;

  /* ---------- 2. 변경 종류: 계약의 서비스에 있는 것만 ---------- */
  const R = D.CHANGE_RULES;
  const types = Object.keys(D.CHANGE_TYPES).filter(function (t) { return t === 'PERIOD' || (root.services || []).indexOf(t.split('_')[0]) > -1; });
  $('#type-choices').innerHTML = types.map(function (t) {
    const off = t === 'PERIOD' && periodBusy;
    return '<label class="choice"><input type="radio" name="type" value="' + t + '"' + (off ? ' disabled' : '') + '>' + esc(D.CHANGE_TYPES[t]) +
      (off ? ' (진행 중인 연장이나 기간 변경이 있어 지금은 고를 수 없음)' : '') + '</label>';
  }).join('');
  $('#f-end').min = D.TODAY;
  const typeOf = function () { const r = document.querySelector('[name="type"]:checked'); return r ? r.value : ''; };
  const num = function (v) { const n = String(v || '').replace(/[^0-9]/g, ''); return n ? parseInt(n, 10) : 0; };
  const won = C.fmtWon; // 1,600,000원
  const pct = function (r) { return Math.round(r * 1000) / 10 + '%'; };

  /* ---------- 유상 충전의 기능과 표준 금액 (기획자 결정 2026-11-02 B-3 덧붙임, G-10 ②) ----------
   * 기능: 계약의 서비스(CK_PAID는 CK, HR_PAID는 HR)에서 사용 중이고 오늘 가격 기준(D.PRICE_BOOK, 관리자 변경 반영)이 있는 것. 제품마다 묶어 보임
   * 표준 금액 = 그날 표준 단가 x 수량, 할인율 = (표준 금액 - 충전 금액) / 표준 금액. 보여 주기만 하고 기안을 막지 않음(③도 생기지 않음, REQ-CHG-07)
   *   표준 단가가 건 단위일 때만 견줌. 지금 CK 기능의 단가는 "기관, 1년" 단위의 시연 값이라 단가만 보이고 금액은 견주지 않음
   *   (결정 "CK는 C-33 뒤": 카피킬러 실제 가격이 건 단위로 들어오면 따로 고치지 않아도 견줌) [가정]
   * 기안할 때 그날의 표준 단가를 함께 남김: changeFeature, changeListPrice, changePriceUnit, changePriceFrom(가격 기준 적용 시작일) */
  const PRICE = {};
  D.PRICE_BOOK.forEach(function (p) { PRICE[p.feature] = p; });
  function featureOptions(svc) {
    return D.PRODUCTS.filter(function (p) { return p.use && p.service === svc; }).map(function (p) {
      const fs = D.FEATURES.filter(function (f) { return f.use && f.product === p.id && PRICE[f.id]; });
      return fs.length ? '<optgroup label="' + esc(p.name) + '">' + fs.map(function (f) {
        return '<option value="' + esc(f.id) + '">' + esc(C.featureText(f.id)) + '</option>';
      }).join('') + '</optgroup>' : '';
    }).join('');
  }
  let featSvc = '';
  // 유상 충전이면 기능 칸을 보이고, 서비스가 바뀔 때만 목록을 다시 채움(고른 기능은 남김)
  function syncFeature(t) {
    const svc = /_PAID$/.test(t) ? t.split('_')[0] : '';
    $('#feature-field').hidden = !svc;
    if (svc === featSvc) return;
    featSvc = svc;
    const sel = $('#f-feature'), keep = sel.value;
    sel.innerHTML = '<option value="">고르세요</option>' + (svc ? featureOptions(svc) : '');
    if (keep && Array.prototype.some.call(sel.options, function (o) { return o.value === keep; })) sel.value = keep;
  }
  // 표준 금액 비교 { p: 가격 줄, perCase: 건 단위인지, std: 표준 금액, disc: 할인율 }
  function priceCompare(rec) {
    const p = rec.changeFeature ? PRICE[rec.changeFeature] : null;
    const perCase = !!p && /^건/.test(p.unit);
    const std = perCase && rec.changeQty ? p.listPrice * rec.changeQty : null;
    const disc = std && rec.changeAmount ? (std - rec.changeAmount) / std : null;
    return { p: p, perCase: perCase, std: std, disc: disc };
  }
  function discText(d) {
    return d == null ? '-' : Math.abs(d) < 1e-9 ? '0%, 표준 단가 그대로' : d < 0 ? '표준 단가보다 ' + pct(-d) + ' 높음' : pct(d) + ' 할인';
  }
  function kv(rows) {
    return '<dl class="kv">' + rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>';
  }
  function priceBoxHtml(rec) {
    const x = priceCompare(rec), p = x.p;
    const note = !p ? '기능을 고르면 오늘 가격 기준의 표준 단가가 나옵니다.'
      : !x.perCase ? '이 기능의 표준 단가는 건 단위가 아니라(' + p.unit + ') 충전 금액과 견주지 않습니다. 건 단위 단가가 정해지면 보입니다.'
      : '가격 기준 ' + C.fmtDate(p.validFrom) + '부터 적용(' + p.docNo + '). 보여 주기만 하고 기안을 막지 않습니다.';
    return kv([
      ['표준 단가', p ? won(p.listPrice) + ' (' + p.unit + ')' : '-'],
      ['표준 금액 (표준 단가 x 수량)', x.std != null ? won(x.std) : '-'],
      ['충전 금액', rec.changeAmount ? won(rec.changeAmount) : '-'],
      ['할인율', discText(x.disc)],
    ]) + '<p class="change-note">' + esc(note) + '</p>';
  }

  /* ---------- 무상 충전의 계약 연도 누적 (기획자 결정 2026-11-02 B-4, G-10, REQ-CHG-07) ----------
   * 같은 묶음, 같은 계약 연도(오늘이 든 해), 같은 종류(CK, HR 따로)의 앞선 무상 충전(반려와 임시 저장은 빼고) + 이번 신청
   * 결재선(C.changeSales)과 같은 수. 누적이 기준(CHANGE_RULES.freeQty)을 넘으면 ③ 영업 검토를 거침 */
  function freeBoxHtml(rec, sales) {
    // 기획자 결정 2026-11-02 B-4: 계약 연도는 오늘이 든 계약 기간(원계약이나 연장)에서 셈. 일찍 승인된 연장의 시작일로 세지 않음(C.contractYearWindow)
    const w = C.contractYearWindow(b, D.TODAY);
    const n = w.n, from = w.from;
    let to = w.to ? C.addDays(w.to, -1) : '';
    // 그 계약 기간이 먼저 끝나면 종료일까지(지금 유효한 계약이면 기간 변경을 반영한 묶음 종료일)
    const term = b.items.find(function (x) { return x.id === w.term; }) || b.current;
    const termEnd = term === b.current ? b.end : C.endOf(term);
    if (termEnd && to > termEnd) to = termEnd;
    const used = C.freeChargeUsed(b.id, D.TODAY, rec.id, rec.changeType), qty = rec.changeQty || 0;
    const svc = rec.changeType.split('_')[0];
    const note = !qty ? '수량을 넣으면 ③ 영업 검토를 거치는지 나옵니다.'
      // 글에 수량을 넣지 않음(위 줄에 있음): 수량을 칠 때마다 글이 바뀌어 화면낭독기가 계속 읽지 않게, 거치는지가 바뀔 때만 읽음
      : sales && sales[0] ? '누적이 ' + R.freeQty + '건을 넘어 ③ 영업 검토를 거칩니다.'
      : '누적이 ' + R.freeQty + '건 이내라 ③ 영업 검토 없이 ⑨ 운영 변경으로 갑니다.';
    return kv([
      ['계약 연도', from ? n + '년 차, ' + C.fmtPeriod(from, to) : '-'],
      ['이번 계약 연도에 이미 받은 ' + svc + ' 무상 충전', used.toLocaleString('ko-KR') + '건'],
      ['이번 신청', qty ? qty.toLocaleString('ko-KR') + '건' : '-'],
      ['이번까지 누적 (기준 ' + R.freeQty + '건)', qty ? (used + qty).toLocaleString('ko-KR') + '건' : '-'],
    ]) + '<p class="change-note" aria-live="polite">' + esc(note) + '</p>';
  }

  // 지금 입력으로 만든 운영 변경 기록 (결재선 계산과 저장에 같이 씀)
  function record() {
    const t = typeOf();
    const fid = /_PAID$/.test(t) ? $('#f-feature').value : '', pr = fid ? PRICE[fid] : null;
    return {
      id: newId, parentId: b.id, counterparty: root.counterparty, services: root.services, type: root.type, kind: 'CHANGE',
      changeType: t, changeQty: t && t !== 'PERIOD' ? num($('#f-qty').value) : 0,
      changeAmount: /_PAID$/.test(t) ? num($('#f-amount').value) : 0,
      // B-3 덧붙임: 유상 충전의 기능과 그날 표준 단가(뒤에 가격 기준이 바뀌어도 기안 때 값으로 견줌). 무상, 기간 변경은 비움
      changeFeature: fid || undefined, changeListPrice: pr ? pr.listPrice : undefined,
      changePriceUnit: pr ? pr.unit : undefined, changePriceFrom: pr ? pr.validFrom : undefined,
      requesterId: root.requesterId, requestedAt: C.nowStamp().slice(0, 16), restricted: root.restricted, personalData: false,
      status: 'IN_REVIEW', history: [],
      startDate: t === 'PERIOD' ? b.start : undefined, oldEndDate: b.end, endDate: t === 'PERIOD' ? $('#f-end').value : undefined,
      reason: $('#f-reason').value.trim(), activityUrl: $('#f-activity').value.trim(),
    };
  }

  /* ---------- 4. 결재선 미리 보기 ---------- */
  function refresh() {
    const t = typeOf();
    syncFeature(t); // record()가 기능 칸 값을 읽으므로 먼저
    const rec = record();
    const free = /_FREE$/.test(t), paid = /_PAID$/.test(t);
    $('#period-box').hidden = t !== 'PERIOD';
    $('#qty-box').hidden = !t || t === 'PERIOD';
    $('#amount-field').hidden = !paid;
    $('#qty-help').textContent = free ? '같은 계약 연도의 무상 충전을 더해 ' + R.freeQty + '건을 넘으면 ③ 영업 검토를 거칩니다.' : '유상 충전은 영업 검토 없이 ⑨ 운영 변경, ⑩ 재무 확인을 거칩니다.';
    const end = $('#f-end').value;
    $('#period-help').textContent = '지금 종료일 ' + C.fmtDate(b.end) + (end ? ' → ' + C.fmtDate(end) + (end > b.end ? ' (연장)' : end < b.end ? ' (단축)' : ' (같음)') : '') +
      '. ' + R.periodMonths + '개월 넘게 바뀌면 ③ 영업 검토를 거칩니다.';
    const ready = t && (t === 'PERIOD' ? !!end : true);
    const sales = ready ? C.changeSales(rec) : null;
    // B-4: 무상 충전의 계약 연도 누적, B-3 덧붙임: 유상 충전의 표준 금액과 할인율 (회색 상자, 종류에 맞는 하나만)
    $('#free-used').hidden = !free;
    if (free) $('#free-used').innerHTML = freeBoxHtml(rec, rec.changeQty ? sales : null);
    $('#price-compare').hidden = !paid;
    if (paid) $('#price-compare').innerHTML = priceBoxHtml(rec);
    const hr = /^HR_/.test(t);
    // 맡는 사람 이름은 결재 문서와 같은 규칙(C.stepWho, 기획자 결정 2026-11-02 D-3): 리더 본인 계약의 ③은 "영업 임원", HR 충전의 ⑨는 "재무", ⑩은 "재무 리더"
    const who = function (code) { return C.stepWho(code, rec) + ' ' + C.ownerLabel(C.stepUserNow(code, rec)); };
    const items = [
      { no: '③', name: '영업 검토', who: who('S03'),
        state: !sales ? 'wait' : sales[0] ? 'go' : 'skip', reason: sales ? sales[1] : '변경 종류와 내용을 기다림' },
      { no: '⑨', name: '운영 변경', who: who('S09'),
        state: t ? 'go' : 'wait', reason: hr ? '수불부에 HR 추가 충전 반영' : t === 'PERIOD' ? '라이선스나 도메인 기간 변경' : t ? 'CK 추가 충전 반영' : '변경 종류를 기다림' },
      // 기획자 결정 2026-11-02 B-3(추천과 다름): 운영 변경도 ⑩ 재무 확인까지 끝나야 계약 완료(REQ-CHG-10). HR 충전은 ⑨를 한 재무 담당자가 아닌 사람
      { no: '⑩', name: '재무 확인', who: who('S10'), state: t ? 'go' : 'wait',
        reason: !t ? '변경 종류를 기다림' : (t === 'PERIOD' ? '바뀐 계약 기간의 매출 인식 확인' : paid ? '유상 충전 금액의 매출 확인' : '무상 제공 수량의 회계 영향 확인') +
          (hr ? ', ⑨를 한 사람이 아닌 재무 리더가 확인' : '') },
    ];
    const BADGE = { go: ['progress', '거침'], skip: ['neutral', '생략'], wait: ['line', '답 대기'] };
    $('#route').innerHTML = '<ol class="route-list">' + items.map(function (it) {
      return '<li class="is-' + it.state + '"><span class="route-no" aria-hidden="true">' + it.no + '</span>' +
        '<span><span class="route-name">' + esc(it.name) + '</span><span class="route-who">' + esc(it.who) + '</span>' +
        '<span class="route-reason">' + esc(it.reason) + '</span></span>' + C.badge(BADGE[it.state][0], BADGE[it.state][1]) + '</li>';
    }).join('') + '</ol>';
    // B-3: 예전 "재무 확인 없이"를 고침. 운영 변경도 ⑨ 다음 ⑩ 재무 확인까지 거쳐야 끝남
    $('#route-desc').textContent = '운영 변경은 체크리스트, 법무, 날인, 체결본 확인 없이 진행하고, ⑨ 운영 변경 다음 ⑩ 재무 확인까지 끝나면 계약 완료가 됩니다. 기간이 ' +
      R.periodMonths + '개월 넘게 바뀌거나 무상 충전이 계약 연도 누적 ' + R.freeQty + '건을 넘을 때만 ③ 영업 리더가 승인합니다.';
  }
  $('#form').addEventListener('input', refresh);
  $('#form').addEventListener('change', refresh);
  // 보완 후 재기안: 앞 차수 값을 채움
  if (again) {
    const tr = document.querySelector('[name="type"][value="' + again.changeType + '"]');
    if (tr && !tr.disabled) tr.checked = true;
    syncFeature(typeOf()); // B-3 덧붙임: 기능 목록을 먼저 채우고 앞 차수의 기능을 고름(지금 쓰지 않는 기능이면 다시 고름)
    if (again.changeFeature) $('#f-feature').value = again.changeFeature;
    $('#f-end').value = again.changeType === 'PERIOD' ? again.endDate || '' : '';
    $('#f-qty').value = again.changeQty ? again.changeQty.toLocaleString('ko-KR') : '';
    $('#f-amount').value = again.changeAmount ? again.changeAmount.toLocaleString('ko-KR') : '';
    $('#f-reason').value = again.reason || '';
    $('#f-activity').value = again.activityUrl || '';
  }
  refresh();
  $('#form').hidden = false;

  /* ---------- 입력 검사 (KRDS 오류 패턴) ---------- */
  // 오류 표시와 aria-invalid는 공통 함수로 (KRDS, v0.28)
  function setError(name, msg) { C.setFieldError(document.querySelector('[data-field="' + name + '"]'), msg); }
  function validate() {
    const t = typeOf(), end = $('#f-end').value;
    const msgs = [
      ['type', t ? '' : '변경 종류를 고르세요.', document.querySelector('[name="type"]')],
      ['end', t !== 'PERIOD' ? '' : !end ? '새 계약 종료일을 고르세요.' : end === b.end ? '지금 종료일과 같습니다.' : end < D.TODAY ? '새 종료일은 오늘 이후여야 합니다.' : '', $('#f-end')],
      // B-3 덧붙임: 유상 충전은 기능을 꼭 고름(표준 금액 비교는 막지 않음)
      ['feature', !/_PAID$/.test(t) || $('#f-feature').value ? '' : '충전할 기능을 고르세요.', $('#f-feature')],
      ['qty', !t || t === 'PERIOD' ? '' : num($('#f-qty').value) > 0 ? '' : '충전 수량을 1건 이상 넣으세요.', $('#f-qty')],
      ['amount', !/_PAID$/.test(t) ? '' : num($('#f-amount').value) > 0 ? '' : '유상 충전 금액을 넣으세요.', $('#f-amount')],
      ['reason', $('#f-reason').value.trim() ? '' : '변경 사유를 적으세요.', $('#f-reason')],
      ['activity', /^https:\/\/\S+$/.test($('#f-activity').value.trim()) ? '' : 'CRM 영업활동 링크를 https://로 시작하는 주소로 넣으세요.', $('#f-activity')],
    ];
    const errors = msgs.filter(function (m) { setError(m[0], m[1]); return !!m[1]; });
    const box = $('#error-summary');
    box.hidden = !errors.length;
    if (errors.length) {
      box.innerHTML = '<p class="error-summary-title">' + C.icon('alert') + '입력하지 않았거나 고쳐야 할 항목이 ' + errors.length + '개 있습니다</p><ul>' +
        errors.map(function (e, i) { return '<li><a href="#" data-err="' + i + '">' + esc(e[1]) + '</a></li>'; }).join('') + '</ul>';
      box.onclick = function (ev) {
        const a = ev.target.closest('[data-err]');
        if (!a) return;
        ev.preventDefault();
        errors[Number(a.dataset.err)][2].focus();
      };
      box.focus();
    }
    return !errors.length;
  }

  /* ---------- 기안 확인 창 ---------- */
  const modal = $('#confirm-modal');
  $('#form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) return;
    const rec = record(), sales = C.changeSales(rec);
    const what = rec.changeType === 'PERIOD' ? C.fmtDate(b.end) + ' 종료 → ' + C.fmtDate(rec.endDate) + ' 종료'
      : rec.changeQty.toLocaleString('ko-KR') + '건' + (rec.changeAmount ? ', ' + rec.changeAmount.toLocaleString('ko-KR') + '원 (부가세 별도)' : ' (무상)');
    const row = function (k, v) { return '<div><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>'; };
    // B-4: 무상 충전은 이번 계약 연도 누적, B-3 덧붙임: 유상 충전은 기능과 표준 금액 대비
    let extra = '';
    if (/_FREE$/.test(rec.changeType)) {
      const used = C.freeChargeUsed(b.id, D.TODAY, rec.id, rec.changeType);
      extra = row('이번 계약 연도 누적', (used + rec.changeQty).toLocaleString('ko-KR') + '건 (기준 ' + R.freeQty + '건' + (sales[0] ? ' 넘음, ③ 영업 검토)' : ' 이내)'));
    } else if (/_PAID$/.test(rec.changeType)) {
      const x = priceCompare(rec);
      extra = row('기능', C.featureLabel({ product: (D.FEATURES.filter(function (f) { return f.id === rec.changeFeature; })[0] || {}).product, feature: rec.changeFeature })) +
        row('표준 금액 대비', x.std != null ? won(x.std) + ' 기준 ' + discText(x.disc) : '견주지 않음 (건 단위 표준 단가 없음)');
    }
    $('#confirm-body').innerHTML = '<p>기안하면 ' + (sales[0] ? '③ 영업 검토부터' : '⑨ 운영 변경부터') + ' 시작되고, ⑩ 재무 확인까지 끝나면 계약 완료가 됩니다. 결재가 끝날 때까지 고칠 수 없습니다.</p>' +
      '<dl class="confirm-list">' + row('계약', root.counterparty + ' ' + b.id) + row('운영 변경 번호', newId) +
      row('변경 종류', D.CHANGE_TYPES[rec.changeType]) + row('변경 내용', what) + extra + '</dl>';
    modal.hidden = false;
    C.focusModal(modal); // 제목에 포커스 (KRDS 모달, v0.28)
  });
  modal.addEventListener('click', function (e) {
    if (e.target === modal || e.target.closest('[data-act="close"]')) modal.hidden = true;
    if (!e.target.closest('[data-act="confirm"]')) return;
    // 운영 변경 기록 (데이터 정의서 contract: kind CHANGE, change_type, change_qty, change_amount, activity_url)
    const rec = again ? C.resubmitRecord(again, record()) : Object.assign(record(), { round: 1 });
    C.saveDemoContract(rec);
    const next = C.pendingSteps(rec).map(function (x) { return C.stepLabel(x.step, rec) + ' (' + C.ownerLabel(x.userId) + ')'; }).join(', ');
    C.flash(newId + ' 운영 변경을 ' + (rec.round || 1) + '차로 기안했습니다. 다음 차례: ' + next);
    location.href = 'review.html?id=' + encodeURIComponent(newId);
  });
  document.addEventListener('keydown', function (e) { if (!modal.hidden && e.key === 'Escape') modal.hidden = true; });
})();
