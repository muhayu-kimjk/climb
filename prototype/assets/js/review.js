/* =====================================================================
 * SCR-23 검토 상세(계약 결재 문서) 화면 로직 (review.js)
 * ---------------------------------------------------------------------
 * 관련 요구사항: REQ-DOC-01, 02, 06, 07, REQ-STEP-04, REQ-FLOW-12, REQ-ENV-06, REQ-AUTH-09, 15, REQ-REV-02~05, REQ-SIGN-01~06
 * 하는 일
 *   1. 주소의 계약번호로 계약을 찾고, 볼 수 있는 사람인지 확인
 *   2. 결재란(②~⑤, ⑥~⑩), 기본 정보, 제품과 금액(v0.47 이름 바꿈. v0.49부터 제품과 기능), 체크리스트, 첨부(체결본 포함), 결재 기록을 결재 문서처럼 그리기
 *   3. 내 차례면 처리 막대에서 단계에 맞는 일: 승인, 보완 요청, 반려(②~⑤), 날인 완료(⑥), 체결본 등록(⑦),
 *      확인 완료와 다시 등록 요청과 반려(⑧), 운영 적용 완료(⑨), 재무 확인 완료(⑩). 내가 승인한 ②~⑤는 승인 취소
 *   4. 보완 요청을 받은 기안자는 처리 막대에서 보완 완료 (REQ-REV-11, v0.26)
 *   5. 운영 변경(-C)은 금액과 체크리스트 대신 변경 내용을 보여 줌 (REQ-CHG-06~11, v0.26)
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
    $('#notice').innerHTML = notice('', '계약을 찾을 수 없습니다', '주소의 계약번호를 확인해 주세요. 예: review.html?id=2610CL005');
    return;
  }
  if (c.status === 'DRAFT') {
    $('#notice').innerHTML = notice('', '임시 저장한 계약은 결재 문서가 없습니다', '기안하면 결재 문서가 만들어집니다.');
    return;
  }
  if (!C.canView(c, me)) {
    $('#doc-title').innerHTML = C.icon('lock') + '열람 제한 계약';
    $('#notice').innerHTML = notice('', '이 계약은 볼 수 없습니다', C.restrictedMsg);
    return;
  }

  /* ---------- 상세 값 (예시 데이터에 없으면 만들어 보여 줌, 프로토타입 전용) ---------- */
  const f = c.form || {};
  const PRICE = {};
  D.PRICE_BOOK.forEach(function (p) { PRICE[p.feature] = p; }); // 가격 기준: 기능마다 하나(v0.49)
  function num(n) { return Number(n || 0).toLocaleString('ko-KR'); }
  const won = C.fmtWon; // 돈은 반드시 원을 붙임 (REQ-UI-17)
  function pct(r) { return Math.round(r * 1000) / 10 + '%'; }
  const addDays = C.addDays;
  // 해지 기안과 연장 검토(짧은 결재)는 원계약을 기준으로 보여 줌 (REQ-ARC-06, 07)
  const short = C.isShort(c);
  const change = C.isChange(c); // 운영 변경(-C): 기간 변경이나 추가 충전 (v0.26)
  const hrChange = change && /^HR_/.test(c.changeType);
  // 표준계약서를 바꾼 계약: 조항 대비표 첨부, ④ 법무 승인 의견 필수 (기획자 결정 v0.27, C-20: flex 품의 대신 플랫폼 안에 남김)
  const legalNote = !short && !change && !!c.checklist && c.checklist.standard === 'NO';
  const isTerm = c.kind === 'TERMINATE';
  const rootId = C.rootOf(c);
  const parent = c.parentId ? D.CONTRACTS.find(function (x) { return x.id === c.parentId; }) : null;
  const seq = Number(String(rootId).replace(/\D/g, '').slice(-4)) || 1;
  const reqDate = (c.requestedAt || '').slice(0, 10);
  const startDate = c.startDate || f.startDate || (parent && C.startOf(parent)) || addDays(reqDate, 14);
  const endDate = c.endDate || f.endDate || (parent && C.endOf(parent)) || addDays(C.monthsLater(startDate, 12), -1); // 예시: 1년 계약(윤년도 맞게)
  const detail = {
    // 사업자등록번호: 거래처 목록(SCR-55)에 있으면 그 번호, 없으면 예시 번호
    bizNo: f.bizNo || (D.CUSTOMERS.filter(function (cu) { return cu.name === c.counterparty; })[0] || {}).bizNo || (100 + seq % 800) + '-' + (81 + seq % 9) + '-' + String(10000 + (seq * 37) % 89999).padStart(5, '0'),
    method: C.methodOf(c), // 리셀러 → 간접 (v0.34)
    // 계약일은 v0.34에서 뺌. 금액이 없는 계약은 v0.41부터 등록하지 않음
    settlement: f.settlement || 'LUMP',
    startDate: startDate, endDate: endDate,
    autoRenew: c.autoRenew || f.autoRenew || 'NO', noticeDays: c.noticeDays || f.noticeDays,
    memo: c.memo || f.memo || '',
    opportunity: c.opportunity || f.opportunity || '', // 판다(CRM) 영업기회번호 (v0.32)
  };
  // 제품 줄: 예시 데이터에 없으면 서비스별 기본 기능을 표준 단가 그대로 넣은 줄을 만듦 (줄의 feature가 기능 id, v0.49)
  function productRows() {
    let list = c.products || f.products;
    if (!list) {
      const base = { CK: 'CK_CAMPUS_PLAG', HR: 'HR_PRISM_DEFECT' };
      const share = c.amount / (c.services || []).length;
      list = c.amount ? (c.services || []).map(function (s) {
        const p = PRICE[base[s]];
        return { feature: p.feature, qty: Math.max(1, Math.floor(share / p.listPrice)), amount: share };
      }) : [];
    }
    return list.map(function (r) {
      const p = PRICE[r.feature];
      const std = p.listPrice * r.qty;
      return { product: p, qty: r.qty, amount: r.amount, std: std, discount: Math.max(0, (std - r.amount) / std) };
    });
  }
  /* 첨부 파일과 판(버전) 관리 (데이터 정의서 attachment, v0.53 기획자 요청 REQ-REV-13). 예시 이름은 고객사 이름으로 만듦
   *   - 계약서 초안과 조항 대비표: 차수마다 새 판(1차 기안 = 판 1, 반려 뒤 2차 기안 = 다음 판, 보완 완료로 다시 올려도 다음 판)
   *   - 체결본: ⑦에서 올릴 때마다 새 판. 다시 등록 요청으로 바뀐 앞 판도 지우지 않음(REQ-FLOW-22)
   *   - 판마다 올린 사람, 일시, 파일 지문(SHA-256 앞 8자리. 시안은 가짜 값)을 남기고 지우거나 덮어쓰지 않음
   *   - 계약 검토(②~⑤)가 끝난 판에 "결재한 판", ⑧에서 확인한 체결본에 "확인한 체결본"
   *   - 결재 기록에는 결재자가 그때 본 판을 함께 남김(감사 때 결재한 계약서와 체결한 계약서를 맞춰 볼 수 있게) */
  function fingerprint(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ('00000000' + (h >>> 0).toString(16).toUpperCase()).slice(-8);
  }
  const PASSED = ['APPROVED', 'OPS_REVIEW', 'ACTIVE', 'EXPIRED', 'TERMINATED'].indexOf(c.status) > -1; // 계약 검토를 마침
  // 계약서 초안의 판: 차수마다 기안한 때 + 보완 완료로 다시 올린 때
  function draftVersions() {
    const hist = c.history || [], last = c.round || 1, out = [];
    for (let k = 1; k <= last; k++) {
      const inRound = hist.filter(function (h) { return (h.round || 1) === k; });
      const sub = inRound.filter(function (h) { return h.action === 'SUBMIT'; })[0];
      out.push({ round: k, at: k === 1 ? c.requestedAt : (sub || inRound[0] || { at: c.requestedAt }).at, by: c.requesterId, why: k + '차 기안' });
      inRound.filter(function (h) { return h.action === 'RESUBMIT'; }).forEach(function (h) {
        out.push({ round: k, at: h.at, by: h.actorId || c.requesterId, why: k + '차 보완 완료' });
      });
    }
    out.sort(function (a, b) { return a.at.localeCompare(b.at); });
    out.forEach(function (v, i) { v.no = i + 1; });
    if (PASSED && out.length) out[out.length - 1].approved = true;
    return out;
  }
  // 체결본의 판: ⑦에서 올린 때마다. ⑧ 확인(승인)을 받은 마지막 판은 "확인한 체결본"
  function signedVersions() {
    const hist = (c.history || []).filter(function (h) { return (h.round || 1) === (c.round || 1); });
    const out = hist.filter(function (h) { return h.action === 'REGISTER'; }).map(function (h, i) {
      return { no: i + 1, at: h.at, by: h.actorId || c.requesterId, why: i ? '다시 등록' : '체결본 등록', name: h.fileName || c.counterparty + '_체결본.pdf' };
    });
    const lastReg = out.length ? out[out.length - 1].at : null;
    if (lastReg && hist.some(function (h) { return h.step === 'S08' && h.action === 'APPROVE' && h.at >= lastReg; })) out[out.length - 1].checked = true;
    return out;
  }
  function files() {
    // 해지 기안과 연장 검토는 계약서 초안 없이 기안할 때 올린 서류(해지 관련 서류)만
    if (change) return []; // 운영 변경은 첨부 없음(사유는 CRM 영업활동 링크)
    const one = function (kind, name, size, at) { return { kind: kind, versions: [{ no: 1, name: name, size: size, at: at || c.requestedAt, by: c.requesterId, why: '기안' }] }; };
    if (short) return (c.files || []).map(function (x, i) { return one(x.kind, x.name, 320000 + i * 1000); });
    const dv = draftVersions();
    const list = [{ kind: 'DRAFT_DOC', versions: dv.map(function (v) { return Object.assign({ name: c.counterparty + '_계약서_초안_판' + v.no + '.docx', size: 84000 + seq * 13 + v.no * 977 }, v); }) }];
    // 조항 대비표: 표준계약서를 바꾼 계약 (v0.27, C-20). 계약서 초안과 같이 판이 바뀜
    if (legalNote) list.push({ kind: 'CLAUSE_DIFF', versions: dv.map(function (v) { return Object.assign({ name: c.counterparty + '_조항대비표_판' + v.no + '.docx', size: 36000 + seq * 5 + v.no * 311 }, v, { approved: false }); }) });
    // 부속 서류: 비밀유지계약서처럼 계약에 딸린 서류 (v0.41)
    (c.annex || []).forEach(function (name, i) { list.push(one('ANNEX', name, 152000 + seq * 3 + i * 1000)); });
    if (c.amount) list.push(one('QUOTE', c.counterparty + '_최종견적서.pdf', 212000 + seq * 7));
    const sv = signedVersions();
    if (sv.length) list.push({ kind: 'SIGNED', versions: sv.map(function (v) { return Object.assign({ size: 1840000 + seq * 11 + v.no * 3000 }, v); }) });
    list.forEach(function (g) { g.versions.forEach(function (v) { v.hash = fingerprint(v.name + v.at); }); });
    return list;
  }
  // 그 시각에 결재자가 본 판 (결재 기록에 남김)
  function versionAt(kind, at) {
    const g = files().filter(function (x) { return x.kind === kind; })[0];
    const seen = g ? g.versions.filter(function (v) { return v.at <= at; }) : [];
    return seen.length ? seen[seen.length - 1] : null;
  }

  /* ---------- 2. 머리와 안내 ---------- */
  const round = c.round || 1;
  const kindText = C.kindLabel(c) + (c.parentId ? ' (원계약 ' + c.parentId + ')' : '');
  $('#doc-title').textContent = c.counterparty;
  // 계약 묶음 보기: 원계약과 변경, 연장, 해지를 한 장에서 (SCR-42, REQ-ARC-02)
  $('#doc-meta').innerHTML = C.meta([esc(c.id), esc(C.serviceLabel(c.services)), esc(kindText), round + '차 기안', C.statusBadge(c),
    '<a href="contract.html?id=' + encodeURIComponent(rootId) + '">계약 묶음 보기</a>']);

  const actionable = (c.approvals || []).filter(function (s) { return C.canAct(c, s, me); });
  const cancelable = (c.approvals || []).filter(function (s) { return C.canCancel(c, s, me); });
  // 내 차례: 담당자 본인이거나 대리 지정 기간 안의 대신할 사람 (REQ-REV-08)
  const isMine = function (s) { return C.isMyStep(s, me); };
  // 보완 요청을 받은 기안자가 보완 완료를 누를 수 있는지 (최고관리자는 시연용으로 대신)
  const canResubmit = c.status === 'SUPPLEMENT' && !!c.supplement && (me.id === c.requesterId || me.role === 'SUPER');
  // 대리 지정으로 대신 처리하는 단계면 "최민준님 대신 (대리 지정 10.19 ~ 10.23)" 안내
  function behalfText(s) {
    const dl = s.userId !== me.id ? C.activeDelegation(s.userId, me.id) : null;
    return dl ? esc(C.ownerLabel(s.userId)) + ' 대신 (대리 지정 ' + C.fmtPeriod(dl.from, dl.to) + ')' : '';
  }

  // 내 차례일 때 할 일 안내 (단계마다)
  const TODO = {
    review: change
      ? '변경 내용(종류, 기간이나 수량, 사유, CRM 영업활동)을 확인한 뒤 화면 아래에서 승인, 보완 요청, 반려 중에 골라 주세요. 승인 의견은 적지 않아도 되고, 보완 요청과 반려는 사유를 꼭 적습니다.'
      : '계약 내용과 체크리스트, 첨부 파일을 확인한 뒤 화면 아래에서 승인, 보완 요청, 반려 중에 골라 주세요. 승인 의견은 적지 않아도 되고, 보완 요청과 반려는 사유를 꼭 적습니다. 보완을 요청하면 기안자가 고친 뒤 이 단계부터 이어서 결재합니다.',
    S06: '계약서 실물의 고객사명, 체결 제품, 계약 금액, 계약 기간이 이 문서와 같은지 확인한 뒤 날인하고, 화면 아래에서 날인 완료로 처리해 주세요. 인장 사용 기록은 기존 구글 폼에 남깁니다.',
    S07: '상대방 서명을 받은 뒤 화면 아래에서 체결본(PDF나 스캔 이미지, 50MB 이하)을 올려 주세요. 올린 체결본은 고치거나 지울 수 없습니다.',
    S08: '첨부 파일의 체결본이 승인된 내용과 같은지 확인해 주세요. 같으면 확인 완료, 오탈자나 스캔 문제면 다시 등록 요청, 계약 내용이 다르면 반려합니다.',
    S09: change ? (hrChange ? '수불부에 HR 추가 충전 ' + c.changeQty + '건을 반영한 뒤 화면 아래에서 운영 변경 완료로 처리해 주세요.'
        : c.changeType === 'PERIOD' ? '라이선스나 도메인 기간을 새 종료일(' + C.fmtDate(c.endDate) + ')로 바꾼 뒤 화면 아래에서 운영 변경 완료로 처리해 주세요.'
        : 'CK 추가 충전 ' + c.changeQty + '건을 반영한 뒤 화면 아래에서 운영 변경 완료로 처리해 주세요.')
      : isTerm ? '해지일에 맞춰 라이선스나 도메인을 닫고 계약 종료일을 설정한 뒤 화면 아래에서 운영 종료 완료로 처리해 주세요.'
      : c.renewMode === 'AUTO' ? '라이선스나 도메인 기간을 새 계약 기간에 맞춰 연장한 뒤 화면 아래에서 기간 연장 완료로 처리해 주세요.'
      : '서비스에 계약을 적용한 뒤(라이선스나 도메인 열기, 계약 정보 설정) 화면 아래에서 운영 적용 완료로 처리해 주세요.',
    S10: isTerm ? '환불, 위약금, 매출 조정을 확인한 뒤 재무 확인 완료를 눌러 주세요. 필요하면 메모를 남깁니다.'
      : c.renewMode === 'AUTO' ? '연장된 기간의 매출 인식을 확인한 뒤 재무 확인 완료를 눌러 주세요. 필요하면 메모를 남깁니다.'
      : '계약 금액과 체크리스트 4번(회계에 영향을 주는 특수 조건)을 확인한 뒤 재무 확인 완료를 눌러 주세요. 필요하면 메모를 남깁니다.',
  };
  function renderNotice() {
    let html = '';
    const mineNow = actionable.filter(isMine);
    const cur = C.currentStep(c);
    // ⑧에서 다시 등록을 요청받아 ⑦이 다시 차례일 때 그 사유
    const ret = c.lastReturn && cur && cur.step === 'S07'
      ? '<br><strong>다시 등록 요청 (' + esc(C.ownerLabel(c.lastReturn.by)) + ', ' + C.fmtDateTime(c.lastReturn.at) + ')</strong>: ' + esc(c.lastReturn.reason) : '';
    if (mineNow.length) {
      const s = mineNow[0];
      const dl = s.userId !== me.id ? C.activeDelegation(s.userId, me.id) : null;
      const behalf = dl ? '<br><strong>' + behalfText(s) + '</strong>: 처리하면 결재 기록에 대리로 처리한 것과 근거가 남습니다. 근거: ' + esc(dl.reason) : '';
      // ④ 법무 + 표준계약서를 바꾼 계약: 승인 의견이 필수라 안내 문장을 따로 (v0.27, C-20)
      const todo = s.step === 'S04' && legalNote
        ? '<strong>표준계약서를 바꾼 계약입니다.</strong> 첨부의 조항 대비표와 계약 내용을 확인한 뒤 화면 아래에서 승인, 보완 요청, 반려 중에 골라 주세요. ' +
          '승인할 때도 바꾼 조항과 받아들인 판단을 의견으로 꼭 적습니다. 이 의견이 품의를 대신해 결재 기록에 남습니다.'
        : esc(TODO[C.isReviewStep(s.step) ? 'review' : s.step]);
      html = notice('', C.stepLabel(s.step, c) + ' 차례입니다 (' + C.waitDays(c, s) + '일째)', todo + behalf + ret);
    } else if (c.status === 'SUPPLEMENT' && c.supplement) {
      // 보완 요청 (REQ-REV-11): 기안자에게는 할 일, 그 밖에는 진행 안내
      const sp = c.supplement, no = D.STEPS[sp.step].no;
      const head = '<strong>' + esc(C.ownerLabel(sp.by)) + ' (' + C.fmtDateTime(sp.at) + ')</strong><br>' + esc(sp.reason) + '<br>';
      html = canResubmit
        ? notice('', C.stepLabel(sp.step, c) + '에서 보완을 요청했습니다', head +
          '고친 뒤 화면 아래에서 보완 완료를 누르면 ' + no + '부터 이어서 결재합니다. 금액이나 체크리스트 답을 바꾸면 계약 검토를 처음부터 다시 받습니다.' +
          (me.id === c.requesterId ? '' : ' (시연: 최고관리자가 기안자 대신 처리해 볼 수 있습니다)'))
        : notice('', C.stepLabel(sp.step, c) + '에서 보완을 요청해 기안자가 고치는 중입니다', head + '기안자가 고치면 ' + no + '부터 이어서 결재합니다.');
    } else if (c.status === 'REJECTED') {
      html = notice('', C.stepLabel(c.rejection.step, c) + '에서 반려되었습니다',
        '<strong>' + esc(C.ownerLabel(c.rejection.by)) + ' (' + C.fmtDateTime(c.rejection.at) + ')</strong><br>' + esc(c.rejection.reason) +
        '<br>기안자가 보완해 ' + (round + 1) + '차로 다시 기안합니다.');
    } else if (actionable.length && me.role === 'SUPER') {
      html = notice('', '시연: 담당자 대신 처리해 볼 수 있습니다',
        '최고관리자는 모든 결재 문서를 볼 수 있고, 프로토타입에서는 담당자 대신 각 단계를 처리해 볼 수 있습니다. 실제 시스템에서는 담당자 본인과 관리자가 대리로 지정한 사람만 처리합니다(결재선 규칙의 대리 지정).' + ret);
    } else if (c.status === 'APPROVED' || c.status === 'OPS_REVIEW') {
      html = notice('success', c.status === 'APPROVED' ? '계약 검토가 끝나 체결 중입니다' : '체결이 끝나 운영 검토 중입니다',
        (c.status === 'APPROVED' ? C.fmtDateTime(c.approvedAt) + '에 계약 검토가 끝났습니다. ' : C.fmtDateTime(c.signedAt) + '에 체결본을 등록했습니다. ') +
        (cur ? '지금 차례: ' + esc(C.stepLabel(cur.step, c)) + ' (' + esc(C.ownerLabel(cur.userId)) + ')' : '') + ret);
    } else if (c.status === 'TERMINATED') {
      // 해지 기안이 끝났거나(해지 기안 문서), 해지된 원계약
      html = isTerm
        ? notice('success', '해지 완료', (c.completedAt ? C.fmtDateTime(c.completedAt) + '에 재무 확인까지 끝나 ' : '') + '원계약(' + esc(c.parentId) + ')이 해지 상태가 되었습니다. 해지일: ' + C.fmtDate(c.terminateDate))
        : notice('', '해지된 계약입니다', '해지일 ' + C.fmtDate(c.terminateDate) + ' 해지 기안은 계약 묶음에서 볼 수 있습니다.');
    } else if (c.status === 'ACTIVE') {
      html = notice('success', '계약 완료',
        (c.completedAt ? C.fmtDateTime(c.completedAt) + '에 재무 확인까지 끝나 보관함에 들어갔습니다. ' : '') + '계약 기간: ' + C.fmtPeriod(detail.startDate, detail.endDate));
    }
    $('#notice').innerHTML = html;
  }

  /* ---------- 3. 결재란 (REQ-DOC-02, REQ-SIGN-02) ----------
   * 첫 표: ① 기안 + 계약 검토 단계 ②~⑤. 생략한 단계도 칸을 두어 왜 생략했는지 보이게 함
   * 둘째 표: 계약 체결(⑥ 인장, ⑦ 체결본, ⑧ 체결본 확인)과 운영 검토(⑨ 운영, ⑩ 재무). 생략 없음 */
  function boxHtml(steps, withDraft) {
    const skip = function (s) { return s.state === 'SKIPPED' ? ' class="is-skipped"' : ''; };
    const head = (withDraft ? '<th scope="col">' + esc(D.STEPS.S01.no + ' ' + D.STEPS.S01.short) + '</th>' : '') +
      steps.map(function (s) { return '<th scope="col">' + esc(D.STEPS[s.step].no + ' ' + D.STEPS[s.step].short) + '</th>'; }).join('');
    // 담당 칸: 역할 / 조직(작은 글자) / 이름(굵게). "조직 이름" 순서(v0.50 기획자 요청)는 지키되 칸이 좁아 조직과 이름을 줄로 나눔
    //   (한 줄에 두면 "세일즈어드민유닛"이 칸보다 길어 낱말 중간에서 끊김)
    const person = function (id) {
      const u = D.USERS[id] || {};
      return (u.dept ? '<span class="box-unit">' + esc(u.dept) + '</span>' : '') + '<strong class="box-name">' + esc(u.name || '-') + '</strong>';
    };
    const who = (withDraft ? '<td>' + esc(C.roleShort('SALES')) + person(c.requesterId) + '</td>' : '') +
      steps.map(function (s) {
        return '<td' + skip(s) + '>' + esc(C.roleShort(s.role)) + person(s.userId) + '</td>';
      }).join('');
    const result = (withDraft ? '<td>' + C.badge('line', '기안') + '</td>' : '') +
      steps.map(function (s) {
        const st = D.APPROVAL_STATE[s.state];
        // ⑥~⑩이 끝나면 "승인" 대신 날인, 등록, 확인, 적용으로 표시
        const label = s.state === 'DONE' && D.STEPS[s.step].done ? D.STEPS[s.step].done : st.label;
        return '<td' + skip(s) + '>' + C.badge(st.tone, label) + '</td>';
      }).join('');
    const when = (withDraft ? '<td class="box-when">' + C.fmtDateTime(c.requestedAt) + '</td>' : '') +
      steps.map(function (s) {
        let t;
        if (s.state === 'DONE' || s.state === 'REJECTED') t = C.fmtDateTime(s.decidedAt) + (s.onBehalfOf ? '<br>' + esc(C.josa(C.ownerLabel(s.decidedBy), '이', '가')) + ' 대신' : '');
        else if (s.state === 'PENDING') t = C.waitDays(c, s) + '일째';
        else if (s.state === 'SKIPPED') t = esc(s.reason);
        else t = '-';
        return '<td class="box-when' + (s.state === 'SKIPPED' ? ' is-skipped' : '') + '">' + t + '</td>';
      }).join('');
    return '<thead><tr><th scope="row" class="box-rowhead">단계</th>' + head + '</tr></thead>' +
      '<tbody>' +
        '<tr><th scope="row" class="box-rowhead">담당</th>' + who + '</tr>' +
        '<tr><th scope="row" class="box-rowhead">결과</th>' + result + '</tr>' +
        '<tr><th scope="row" class="box-rowhead">일시</th>' + when + '</tr>' +
      '</tbody>';
  }
  function renderBox() {
    const steps = c.approvals || [];
    $('#approval-box').innerHTML = '<caption class="sr-only">결재란 계약 검토: 단계마다 담당자, 결과, 일시</caption>' +
      boxHtml(steps.filter(function (s) { return s.phase === 2; }), true);
    $('#approval-box-post').innerHTML = '<caption class="sr-only">결재란 계약 체결과 운영 검토: 단계마다 담당자, 결과, 일시</caption>' +
      boxHtml(steps.filter(function (s) { return s.phase > 2; }), false);
    const routed = C.routedReview(c).map(function (s) { return D.STEPS[s.step].no; }).join(', ');
    $('#box-desc').textContent = change
      ? '운영 변경은 ' + (C.changeSales(c)[0] ? '③ 영업 리더가 승인한 뒤 ' : '') + '⑨ ' + C.josa(hrChange ? '재무' : '고객지원', '이', '가') +
        ' 반영하면 끝납니다. 체크리스트, 법무, 날인, 체결본, 재무 확인은 없습니다.'
      : short
      ? C.josa(isTerm ? '해지 기안' : '연장 검토', '은', '는') + ' ③ 영업 리더, ④ 법무가 승인한 뒤 ⑨ 고객지원 ' + (isTerm ? '운영 종료' : '기간 연장') + ', ⑩ 재무 확인을 거칩니다. 체크리스트, 날인, 체결본은 없습니다.'
      : '거치는 단계: ' + routed + '. ② 다음 ③을 검토하고, 그다음 ④와 ⑤를 동시에 검토합니다. 생략한 단계는 체크리스트 답에 따른 것입니다. ' +
        '승인 뒤에는 ⑥ 인장 날인부터 ⑩ 재무 확인까지 하나씩 차례로 거칩니다.';
  }

  /* ---------- 4. 기본 정보, 금액, 체크리스트, 첨부, 결재 기록 ---------- */
  function info(label, value) { return '<div><dt>' + esc(label) + '</dt><dd>' + value + '</dd></div>'; }
  function renderBasic() {
    $('#basic').innerHTML = [
      info('계약번호', esc(c.id)),
      info('계약종류', esc(kindText)),
      info('고객사', esc(c.counterparty)),
    ].concat((c.unit || f.unit) ? [info('기관 또는 부서명', esc(c.unit || f.unit))] : []).concat([ // 계약마다 직접 적은 기관 이름 (C-24 v0.39, 이름 v0.46)
      info('사업자등록번호', esc(C.fmtBizNo(detail.bizNo))), // 000-00-00000 (v0.34)
      info('영업대표', esc(C.ownerLabel(c.requesterId))), // 조직 이름 (v0.32)
      // 판다(CRM) 영업기회번호: 규칙에 맞으면 판다로 가는 링크 (v0.32)
      info('영업기회번호', detail.opportunity ? C.pandaLink(detail.opportunity) : '-'),
      info('계약 방식', esc(D.METHODS[detail.method])),
      info('정산 방식', esc(D.SETTLEMENTS[detail.settlement])),
      info('계약 기간', C.fmtPeriod(detail.startDate, detail.endDate)),
      info('자동갱신', detail.autoRenew === 'YES' ? '있음 (해지 통지: 만료 ' + (detail.noticeDays || '-') + '일 전)' : '없음'),
      info('개인정보 처리위탁 계약', c.personalData ? '있음' : '없음'),
      info('서비스 수준 협약(SLA)', (c.sla || f.sla) === 'YES' ? '있음' : '없음'), // v0.40
      info('열람 제한', c.restricted ? C.icon('lock', 'sm') + '있음' + (C.viewerText(c) ? '<span class="cell-meta">지정 열람자: ' + esc(C.viewerText(c)) + '</span>' : '') : '없음'), // 지정 열람자 (v0.52)
    ]).join('');
  }

  function renderAmount() {
    if (change) {
      // 변경 내용 (REQ-CHG-06~11): 종류, 기간이나 수량, 사유, CRM 영업활동 링크, 영업 검토를 거치는 까닭
      const dd = function (label, value) { return '<div><dt>' + esc(label) + '</dt><dd>' + value + '</dd></div>'; };
      const sales = C.changeSales(c);
      $('#amount-title').innerHTML = '<span class="num">2</span>변경 내용';
      $('#amount').innerHTML = '<dl class="info-grid">' + [
        dd('원계약', '<a href="contract.html?id=' + encodeURIComponent(rootId) + '">' + esc(c.parentId) + '</a>'),
        dd('변경 종류', esc(D.CHANGE_TYPES[c.changeType])),
        c.changeType === 'PERIOD'
          ? dd('계약 기간', C.fmtDate(c.oldEndDate) + ' 종료 → ' + C.fmtDate(c.endDate) + ' 종료')
          : dd('충전 수량', num(c.changeQty) + '건' + (c.changeAmount ? ', 금액 ' + won(c.changeAmount) + ' (부가세 별도)' : ' (무상)')),
        dd('변경 사유', esc(c.reason || '-')),
        dd('CRM 영업활동', c.activityUrl ? '<a href="#" class="doc-link" data-activity>' + esc(c.activityUrl) + '</a>' : '-'),
        dd('③ 영업 검토', (sales[0] ? '거침: ' : '생략: ') + esc(sales[1])),
        dd('⑨ 반영', hrChange ? '재무(수불부)' : '고객지원'),
      ].join('') + '</dl>';
      return;
    }
    if (short) {
      // 해지 내용, 연장 내용 (REQ-ARC-06, 07)
      const dd = function (label, value) { return '<div><dt>' + esc(label) + '</dt><dd>' + value + '</dd></div>'; };
      $('#amount-title').innerHTML = '<span class="num">2</span>' + (isTerm ? '해지 내용' : '연장 내용');
      $('#amount').innerHTML = '<dl class="info-grid">' + (isTerm ? [
        dd('원계약', '<a href="contract.html?id=' + encodeURIComponent(rootId) + '">' + esc(c.parentId) + '</a>'),
        dd('해지일', C.fmtDate(c.terminateDate)),
        dd('해지 사유', esc(c.reason || '-')),
        dd('환불과 위약금', esc(c.refundNote || '없음')),
      ] : [
        dd('원계약', '<a href="contract.html?id=' + encodeURIComponent(rootId) + '">' + esc(c.parentId) + '</a>'),
        dd('검토 결과', '그대로 자동갱신 (금액과 조건 그대로)'),
        dd('새 계약 기간', C.fmtPeriod(c.startDate, c.endDate)),
        dd('계약 금액', c.amount ? won(c.amount) + ' (부가세 별도)' : '금액 없음'),
        dd('그대로 연장하는 이유', esc(c.reason || '-')),
      ]).join('') + '</dl>';
      return;
    }
    const rows = productRows();
    if (!rows.length) { $('#amount').innerHTML = '<p class="empty">제품 정보가 없습니다.</p>'; return; }
    const total = rows.reduce(function (a, r) { return a + r.amount; }, 0);
    const stdTotal = rows.reduce(function (a, r) { return a + r.std; }, 0);
    // 할인율 칸은 "표준 단가" 또는 "N% 할인"만 보여 줌. 할인율 한도 값과 한도 초과 여부는 이 표에 두지 않음
    // (한도를 지켰는지는 체크리스트 3번에서 봄). 금액에는 원을 붙임 (REQ-UI-17)
    $('#amount').innerHTML =
      '<div class="tbl-wrap"><table class="tbl tbl--compact">' +
        '<caption class="sr-only">제품별 금액: 제품과 기능(단위), 수량, 표준 금액, 계약 금액, 할인율</caption>' +
        '<thead><tr><th scope="col">제품과 기능</th><th scope="col" class="num">수량</th><th scope="col" class="num">표준 금액</th><th scope="col" class="num">계약 금액</th><th scope="col" class="num">할인율</th></tr></thead>' +
        '<tbody>' + rows.map(function (r) {
          // "프리즘 결함검사" 아래에 단위(예: 기관, 1년). v0.49에 플랜을 없애 플랜 이름 대신 단위
          return '<tr><td>' + esc(C.featureLabel(r.product)) + '<span class="product-unit">' + esc(r.product.unit) + '</span></td><td class="num">' + num(r.qty) + '</td><td class="num">' + won(r.std) + '</td>' +
            '<td class="num">' + won(r.amount) + '</td><td class="num">' + (r.discount === 0 ? '표준 단가' : pct(r.discount) + ' 할인') + '</td></tr>';
        }).join('') + '</tbody>' +
        '<tfoot><tr><th scope="row">총액 (부가세 별도)</th><td></td><td class="num total">' + won(stdTotal) + '</td>' +
          '<td class="num total">' + won(total) + '<span class="total-read">' + esc(C.fmtKRW(total)) + '</span></td><td></td></tr></tfoot>' +
      '</table></div>';
  }

  function answer(v) {
    if (v === 'YES') return C.badge('success', '예');
    if (v === 'NO') return C.badge('danger', '아니요');
    if (v === 'NA') return C.badge('neutral', '해당 없음');
    return C.badge('line', '-');
  }
  function renderChecklist() {
    if (change) {
      $('#checklist').innerHTML = '<p class="empty">운영 변경은 체크리스트 대신 변경 종류와 기준(기간 ' + D.CHANGE_RULES.periodMonths +
        '개월, 무상 충전 ' + D.CHANGE_RULES.freeQty + '건)으로 영업 검토를 정합니다.</p>';
      return;
    }
    if (short) {
      $('#checklist').innerHTML = '<p class="empty">' + C.josa(isTerm ? '해지 기안' : '연장 검토', '은', '는') + ' 체크리스트 없이 ③ 영업 리더와 ④ 법무가 결재합니다.</p>';
      return;
    }
    const ck = c.checklist || {};
    const route = C.reviewRoute(c);
    const q = [
      ['1. 표준계약서를 사용했나요?', ck.standard, ck.standardNote || (f.checklist && f.checklist.standardNote), 'S04'],
      ['2. 표준단가표를 적용했나요? (자동 계산)', ck.price, ck.priceNote, 'S03'],
      ['3. 할인율 한도를 지켰나요? (자동 계산)', ck.cap, ck.capNote, 'S03'],
    ];
    $('#checklist').innerHTML = '<ul class="doc-checks">' + q.map(function (x, i) {
      const r = route[x[3]];
      const effect = i === 1 ? '' : '<span class="check-effect">' + esc(D.STEPS[x[3]].no + ' ' + D.STEPS[x[3]].name + (r[0] ? ' 거침' : ' 생략') + ': ' + r[1]) + '</span>';
      // 1번에는 기준 표준계약서와 그 판 (v0.53, REQ-CHK-09)
      const tpl = i === 0 ? '<p class="check-note">기준 표준계약서: ' + esc(C.templateLabel(c)) + '</p>' : '';
      return '<li><p class="check-q-text">' + esc(x[0]) + ' ' + answer(x[1]) + '</p>' + tpl +
        '<p class="check-note">비고: ' + (x[2] ? esc(x[2]) : '없음') + '</p>' + effect + '</li>';
    }).join('') + '</ul>' +
    '<p class="check-effect">' + esc(D.STEPS.S05.no + ' ' + D.STEPS.S05.name) + ' ' + (route.S05[0] ? '거침' : '생략') + ': ' + esc(route.S05[1]) + '</p>' +
    // 4번: 회계 영향 특수 조건. 결재선에는 영향 없고, 예면 기안할 때 재무에 이메일로 알림 (REQ-CHK-08)
    '<ul class="doc-checks doc-checks--extra"><li><p class="check-q-text">' + esc('4. 회계에 영향을 주는 특수 조건이 있나요?') + ' ' + answer(ck.accounting) + '</p>' +
      '<p class="check-note">비고: ' + (ck.accountingNote ? esc(ck.accountingNote) : '없음') + '</p>' +
      '<span class="check-effect">' + (ck.accounting === 'YES' ? '재무 알림: 기안할 때 재무 ' + esc(C.ownerLabel(C.stepUserNow('S10', c))) + '에게 이메일로 알렸습니다(결재선 아님)' : '재무 알림 없음') + '</span></li></ul>';
  }

  /* 첨부 파일 (REQ-SEC-08): 내려받으면 워터마크 PDF. 고칠 수 있는 원본은 기안자, 법무, 관리자만.
   * 휴대폰에서는 미리보기만 (내려받기 버튼은 review.css에서 감춤) */
  const canOriginal = me.id === c.requesterId || ['LEGAL', 'ADMIN', 'SUPER'].indexOf(me.role) > -1;
  function renderFiles() {
    const fmtSize = function (b) { return b >= 1048576 ? (b / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(b / 1024)) + 'KB'; };
    const acts = '<span class="file-acts"><button type="button" class="btn-text" data-file="preview">미리보기</button>' +
      '<button type="button" class="btn-text file-dl" data-file="pdf">PDF 내려받기</button>' +
      (canOriginal ? '<button type="button" class="btn-text file-dl" data-file="original">원본 내려받기</button>' : '') + '</span>';
    // 한 판: [종류] [판 N] [결재한 판] 파일 이름 / 크기, 올린 때와 사람(까닭), 지문
    function line(g, v, now) {
      const versioned = g.kind === 'DRAFT_DOC' || g.kind === 'CLAUSE_DIFF' || g.kind === 'SIGNED';
      return '<li' + (now ? '' : ' class="is-old"') + '><span class="file-info">' + C.badge('line', D.FILE_KINDS[g.kind]) +
        (versioned ? ' ' + C.badge(now ? 'progress' : 'neutral', '판 ' + v.no) : '') +
        (v.approved ? ' ' + C.badge('success', '결재한 판') : '') + (v.checked ? ' ' + C.badge('success', '확인한 체결본') : '') +
        ' <span class="file-name">' + esc(v.name) + '</span>' +
        '<span class="file-size">' + fmtSize(v.size) + ', ' + C.fmtDateTime(v.at) + ' ' + esc(C.ownerLabel(v.by)) + ' 올림(' + esc(v.why) + '), 지문 ' + v.hash + '</span></span>' +
        acts + '</li>';
    }
    $('#files').innerHTML = files().map(function (g) {
      const vs = g.versions, now = vs[vs.length - 1], old = vs.slice(0, -1).reverse();
      return line(g, now, true) + (old.length ? '<li class="file-older"><details><summary>' + esc(D.FILE_KINDS[g.kind]) + ' 이전 판 ' + old.length + '개</summary>' +
        '<ul class="doc-files">' + old.map(function (v) { return line(g, v, false); }).join('') + '</ul></details></li>' : '');
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
        // 대신 처리한 기록: 대리 지정이면 "대리 지정"과 근거, 최고관리자 시연이면 "시연"
        // 그때 조직: 기록에 남은 이름(actorDept). 예시 데이터처럼 없으면 지금 조직 (v0.31)
        const dept = h.actorDept || (D.USERS[h.actorId] || {}).dept || '';
        const who = esc(C.ownerLabel(h.actorId, dept)) + (h.onBehalfOf ? ' <span class="behalf">(' + esc(C.ownerLabel(h.onBehalfOf)) + ' 대신, ' + (h.delegationId ? '대리 지정' : '시연') + ')</span>' : '');
        // 체결본 등록은 올린 파일 이름도 함께
        // 결재자가 그때 본 판 (v0.53): 계약 검토(②~⑤)는 계약서 초안, ⑧ 체결본 확인은 체결본
        const seenKind = ['S02', 'S03', 'S04', 'S05'].indexOf(h.step) > -1 && h.action !== 'RESUBMIT' ? 'DRAFT_DOC' : h.step === 'S08' ? 'SIGNED' : '';
        const seen = seenKind ? versionAt(seenKind, h.at) : null;
        const extra = [seen ? '본 판: ' + D.FILE_KINDS[seenKind] + ' 판 ' + seen.no + '(지문 ' + seen.hash + ')' : '',
          h.fileName ? '파일: ' + esc(h.fileName) : '', h.basis ? '대리 근거: ' + esc(h.basis) : '',
          h.action === 'RESUBMIT' ? (h.restart ? '금액이나 체크리스트 답을 바꿔 계약 검토를 처음부터 다시' : '요청한 단계부터 이어서 결재') : ''].filter(Boolean);
        const note = (h.comment ? esc(h.comment) : '') + (extra.length ? (h.comment ? '<br>' : '') + '<span class="behalf">' + extra.join('<br>') + '</span>' : '');
        return '<tr><td class="num-left">' + C.fmtDateTime(h.at) + '</td><td class="num">' + (h.round || 1) + '차</td>' +
          '<td class="nowrap">' + esc(D.STEPS[h.step].no + ' ' + D.STEPS[h.step].short) + '</td>' +
          '<td class="nowrap">' + C.badge(a.tone, C.actionLabel(h, c)) + '</td><td class="center">' + who + '</td><td>' + (note || '-') + '</td></tr>';
      }).join('') + '</tbody>';
  }

  /* ---------- 5. 처리 막대와 확인 창 (REQ-REV-04, REQ-SIGN-03~06) ----------
   * 단계마다 누를 수 있는 일
   *   ②~⑤: 반려, 승인 / ⑥: 반려, 날인 완료 / ⑦: 체결본 등록 / ⑧: 반려, 다시 등록 요청, 확인 완료
   *   ⑨: 운영 적용 완료 / ⑩: 재무 확인 완료 (⑨⑩에는 반려가 없음 [가정]) */
  const STEP_ACTIONS = { S06: ['REJECT', 'APPROVE'], S07: ['REGISTER'], S08: ['REJECT', 'RETURN', 'APPROVE'], S09: ['APPROVE'], S10: ['APPROVE'] };
  //   ②~⑤는 보완 요청도 (REQ-REV-11, v0.26 재무 요청 반영: 영업이 잘못 적었을 때 그 단계부터 다시)
  function actionsOf(code) { return C.isReviewStep(code) ? ['REJECT', 'SUPPLEMENT', 'APPROVE'] : STEP_ACTIONS[code]; }
  // ⑨ 버튼 이름: 해지는 운영 종료, 그대로 연장은 기간 연장
  const S09_BTN = change ? '운영 변경 완료' : isTerm ? '운영 종료 완료' : c.renewMode === 'AUTO' ? '기간 연장 완료' : D.STEPS.S09.doneAction;
  function buttonLabel(action, code) {
    if (action === 'APPROVE' && code === 'S09') return S09_BTN;
    if (action === 'APPROVE') return C.isReviewStep(code) ? '승인' : D.STEPS[code].doneAction;
    return D.APPROVAL_ACTIONS[action].label;
  }
  const BTN_CLASS = { APPROVE: 'btn--primary', REGISTER: 'btn--primary', REJECT: 'btn--tertiary btn-reject', RETURN: 'btn--tertiary', SUPPLEMENT: 'btn--tertiary' };
  function buttonsHtml(code) {
    return actionsOf(code).map(function (a) {
      return '<button type="button" class="btn ' + BTN_CLASS[a] + ' btn--md" data-open="' + a + '" data-step="' + code + '">' + esc(buttonLabel(a, code)) + '</button>';
    }).join('');
  }
  function renderActions() {
    const bar = $('#action-bar');
    if (!actionable.length && !cancelable.length && !canResubmit) { bar.hidden = true; return; }
    let html = '';
    if (canResubmit) {
      // 보완 완료: 기안자(시연에서는 최고관리자도)
      html += '<div class="act-row"><p class="act-target"><strong>' + esc(C.stepLabel(c.supplement.step, c)) + ' 보완 요청</strong>' +
        (me.id === c.requesterId ? '' : ' <span class="behalf">' + esc(C.ownerLabel(c.requesterId)) + ' 대신 (시연)</span>') + '</p>' +
        '<div class="act-btns"><button type="button" class="btn btn--primary btn--md" data-open="RESUBMIT" data-step="S01">보완 완료</button></div></div>';
    }
    if (actionable.length) {
      // 최고관리자는 ④⑤처럼 동시에 차례인 단계 중 하나를 골라 대신 처리 (프로토타입 전용)
      const pick = actionable.length > 1
        ? '<label class="act-pick">처리할 단계 <select class="select" id="act-step">' + actionable.map(function (s) {
            return '<option value="' + s.step + '">' + esc(C.stepLabel(s.step, c)) + ' (' + esc(C.ownerLabel(s.userId)) + ')</option>';
          }).join('') + '</select></label>'
        : '<p class="act-target"><strong>' + esc(C.stepLabel(actionable[0].step, c)) + '</strong>' +
          (actionable[0].userId === me.id ? '' : ' <span class="behalf">' + (behalfText(actionable[0]) || esc(C.ownerLabel(actionable[0].userId)) + ' 대신 (시연)') + '</span>') + '</p>';
      html += '<div class="act-row">' + pick + '<div class="act-btns" id="act-btns">' + buttonsHtml(actionable[0].step) + '</div></div>';
    }
    if (cancelable.length) {
      html += '<div class="act-row act-row--cancel">' + cancelable.map(function (s) {
        return '<p class="act-target">' + esc(C.stepLabel(s.step, c)) + ' 승인을 다음 단계가 처리하기 전까지 취소할 수 있습니다.</p>' +
          '<button type="button" class="btn btn--tertiary btn--md" data-open="CANCEL" data-step="' + s.step + '">승인 취소</button>';
      }).join('') + '</div>';
    }
    bar.innerHTML = html;
    bar.hidden = false;
    const sel = $('#act-step');
    if (sel) sel.addEventListener('change', function () { $('#act-btns').innerHTML = buttonsHtml(sel.value); });
  }

  const modal = $('#act-modal');
  let pending = null;
  let lastFocus = null;
  let fileName = '';
  // 확인 창 문구: 누르면 어떻게 되는지만 안내. 반려와 승인 취소는 신중하라는 뜻으로 경고(핑크) 버튼
  //   checks: 모두 확인해야 처리되는 항목(결재 기록에 "확인: ..."으로 남음) / file: 체결본 파일을 받음
  function modalText(action, code) {
    if (action === 'CANCEL') return { title: '승인을 취소할까요?', label: '취소 사유 (필수)', btn: '승인 취소', required: true, tone: 'danger',
      desc: '취소하면 이 단계는 다시 내 차례가 되고, 승인과 취소 기록은 모두 남습니다.' };
    if (action === 'REJECT') return { title: '반려할까요?', label: '반려 사유 (필수)', btn: '반려', required: true, tone: 'danger',
      desc: code === 'S08' ? '계약 내용이 승인본과 다를 때 씁니다. 반려하면 기안자에게 돌아가고, 기안자가 보완해 다음 차수로 다시 기안해 결재를 처음부터 받습니다.'
        : code === 'S06' ? '계약서 실물이 이 문서와 다를 때 씁니다. 반려하면 기안자에게 돌아가고, 기안자가 보완해 다음 차수로 다시 기안합니다.'
        : '반려하면 기안자에게 돌아가고, 기안자가 보완해 다음 차수로 다시 기안합니다.' };
    if (action === 'SUPPLEMENT') return { title: '보완을 요청할까요?', label: '보완할 내용 (필수)', btn: '보완 요청', required: true, tone: 'secondary',
      desc: '요청하면 기안자에게 돌아갑니다. 기안자가 고치면 이 단계부터 이어서 결재하고, 금액이나 체크리스트 답이 바뀌면 계약 검토를 처음부터 다시 받습니다.' };
    if (action === 'RESUBMIT') return { title: '보완을 마쳤나요?', label: '고친 내용 (필수)', btn: '보완 완료', required: true, tone: 'primary', restart: true,
      desc: '보완 완료를 누르면 ' + D.STEPS[c.supplement.step].no + '부터 이어서 결재합니다. 실제 시스템에서는 계약 등록 화면에서 고친 뒤 누릅니다.' };
    if (action === 'RETURN') return { title: '체결본을 다시 올려 달라고 할까요?', label: '요청 사유 (필수)', btn: '다시 등록 요청', required: true, tone: 'secondary',
      desc: '오탈자나 스캔 문제처럼 계약 내용은 같을 때 씁니다. 영업이 체결본을 다시 올리면 다시 확인합니다.' };
    if (action === 'REGISTER') return { title: '체결본을 등록할까요?', label: '메모 (선택)', btn: '체결본 등록', required: false, tone: 'primary', file: true,
      desc: '등록하면 영업지원이 승인된 내용과 같은지 확인합니다. 등록한 체결본은 고치거나 지울 수 없습니다.' };
    if (code === 'S04' && legalNote) return { title: '승인할까요?', label: '바꾼 조항과 판단 (필수)', btn: '승인', required: true, tone: 'primary',
      desc: '승인하면 다음 단계로 넘어갑니다. 표준계약서를 바꾼 계약이라 바꾼 조항과 받아들인 판단을 꼭 적습니다(조항 대비표 참고).' };
    if (C.isReviewStep(code)) return { title: '승인할까요?', label: '의견 (선택)', btn: '승인', required: false, tone: 'primary',
      desc: '승인하면 다음 단계로 넘어갑니다.' };
    const acc = c.checklist && c.checklist.accounting === 'YES';
    // ⑨ 확인 항목: 계약, 해지, 그대로 연장마다 다름 (common.js opsChecksFor)
    const ops = C.opsChecksFor(c);
    return {
      S06: { title: '날인 완료로 처리할까요?', label: '메모 (선택)', btn: '날인 완료', required: false, tone: 'primary',
        desc: '처리하면 영업이 상대방 서명을 받아 체결본을 올릴 차례가 됩니다. 인장 사용 기록은 기존 구글 폼에 따로 남겨 주세요.',
        legend: '계약서 실물과 같은지 확인한 항목 (모두 확인)', checks: D.SEAL_CHECKS },
      S08: { title: '체결본 확인을 완료할까요?', label: '메모 (선택)', btn: '확인 완료', required: false, tone: 'primary',
        desc: '완료하면 운영 검토로 넘어가 고객지원이 운영에 적용할 차례가 됩니다.',
        legend: '확인한 내용 (모두 확인)', checks: ['체결본이 승인된 계약 내용과 같음', '양쪽 서명과 날인이 모두 있음'] },
      S09: { title: change ? '운영 변경을 완료할까요?' : isTerm ? '운영 종료를 완료할까요?' : c.renewMode === 'AUTO' ? '기간 연장을 완료할까요?' : '운영 적용을 완료할까요?',
        label: '메모 (선택)', btn: S09_BTN, required: false, tone: 'primary',
        desc: change ? '완료하면 운영 변경이 끝나고 ' + (c.changeType === 'PERIOD' ? '계약 묶음의 계약 기간이 새 종료일로 바뀝니다.' : '충전 내역이 계약 묶음에 남습니다.')
          : '완료하면 재무 확인 차례가 됩니다.', legend: '서비스에 한 일 (모두 확인)', checks: ops },
      S10: { title: '재무 확인을 완료할까요?', label: '메모 (선택)', btn: '재무 확인 완료', required: false, tone: 'primary',
        desc: isTerm ? '완료하면 해지가 끝나 원계약이 해지 상태가 됩니다. 환불과 위약금: ' + (c.refundNote || '없음')
          : c.renewMode === 'AUTO' ? '완료하면 연장이 끝나 새 계약 기간(' + C.fmtPeriod(c.startDate, c.endDate) + ')이 적용됩니다.'
          : '완료하면 계약 완료로 보관함에 들어갑니다. ' + (acc
            ? '체크리스트 4번 회계 영향 조건: ' + (c.checklist.accountingNote || '비고 없음')
            : '체크리스트 4번 회계 영향 조건은 없습니다.') },
    }[code];
  }
  function openModal(action, stepCode) {
    // 보완 완료는 결재 단계가 아닌 기안(①)에서 하는 일
    const s = stepCode === 'S01' ? { step: 'S01', userId: c.requesterId } : c.approvals.find(function (x) { return x.step === stepCode; });
    const t = modalText(action, stepCode);
    pending = { action: action, step: s, t: t };
    fileName = '';
    $('#act-title').textContent = t.title;
    $('#act-desc').textContent = t.desc;
    $('#act-label').textContent = t.label;
    $('#act-comment').value = '';
    $('#act-error').hidden = true;
    $('#act-field').classList.remove('is-invalid');
    $('#act-comment').removeAttribute('aria-invalid');
    $('#act-comment').setAttribute('aria-describedby', 'act-error'); // 오류 문장을 화면낭독기가 함께 읽음 (KRDS, v0.28)
    let extra = '';
    if (t.checks) {
      extra += '<fieldset class="field act-checks" id="act-checks"><legend class="field-label">' + esc(t.legend) + '</legend>' +
        t.checks.map(function (x) { return '<label class="choice"><input type="checkbox" value="' + esc(x) + '">' + esc(x) + '</label>'; }).join('') +
        '<p class="field-error" id="act-checks-error" hidden></p></fieldset>';
    }
    if (t.restart) {
      extra += '<div class="field"><label class="choice"><input type="checkbox" id="act-restart">금액이나 체크리스트 답을 바꿨습니다 (계약 검토를 ② 체크리스트 검토부터 다시 받습니다)</label></div>';
    }
    if (t.file) {
      extra += '<div class="field act-file" id="act-file"><label class="field-label" for="act-file-input">체결본 파일 (필수)</label>' +
        '<input type="file" id="act-file-input" accept=".pdf,.jpg,.jpeg,.png">' +
        '<p class="field-help">PDF, JPG, PNG, 50MB 이하. 프로토타입은 파일 이름만 남기고 실제로 올리지 않습니다. ' +
        '<button type="button" class="btn-text" id="act-demo-file">예시 파일 고르기 (시연)</button></p>' +
        '<p class="act-file-name" id="act-file-name" aria-live="polite"></p><p class="field-error" id="act-file-error" hidden></p></div>';
    }
    $('#act-extra').innerHTML = extra;
    $('#act-confirm').textContent = t.btn;
    $('#act-confirm').className = 'btn btn--' + t.tone + ' btn--md';
    lastFocus = document.activeElement;
    modal.hidden = false;
    C.focusModal(modal); // 제목에 포커스. Enter로 바로 처리되지 않게 (KRDS 모달, v0.28)
  }
  function setFile(name) {
    fileName = name;
    $('#act-file-name').textContent = name ? '고른 파일: ' + name : '';
    showError('#act-file-error', '#act-file', '');
  }
  function showError(errSel, fieldSel, msg) {
    const err = $(errSel);
    if (!err) return;
    err.innerHTML = msg ? C.icon('alert', 'sm') + esc(msg) : '';
    err.hidden = !msg;
    $(fieldSel).classList.toggle('is-invalid', !!msg);
    $(fieldSel).querySelectorAll('input').forEach(function (c) { if (msg) c.setAttribute('aria-invalid', 'true'); else c.removeAttribute('aria-invalid'); });
  }
  modal.addEventListener('change', function (e) {
    if (e.target.id !== 'act-file-input') return;
    const f = e.target.files[0];
    if (f && f.size > 50 * 1048576) { setFile(''); showError('#act-file-error', '#act-file', '50MB 이하 파일만 올릴 수 있습니다.'); return; }
    setFile(f ? f.name : '');
  });
  function closeModal() { modal.hidden = true; pending = null; if (lastFocus) lastFocus.focus(); }
  // 처리했을 때 안내 (다음 화면에 한 번)
  const DONE_MSG = {
    APPROVE: '승인했습니다.', REJECT: '반려했습니다. 기안자에게 돌아갑니다.', CANCEL: '승인을 취소했습니다.',
    REGISTER: '체결본을 등록했습니다.', RETURN: '체결본을 다시 올려 달라고 요청했습니다.',
    SUPPLEMENT: '보완을 요청했습니다. 기안자에게 돌아갑니다.', RESUBMIT: '보완을 마쳤습니다.',
    S06: '날인 완료로 처리했습니다.', S08: '완료했습니다.', S09: '완료했습니다.', S10: '완료했습니다.',
  };
  function confirmAction() {
    const t = pending.t;
    const memo = $('#act-comment').value.trim();
    let ok = true;
    if (t.checks) {
      const missing = Array.prototype.slice.call(modal.querySelectorAll('#act-checks input')).filter(function (b) { return !b.checked; }).length;
      showError('#act-checks-error', '#act-checks', missing ? '확인 항목을 모두 확인해 주세요.' : '');
      if (missing) ok = false;
    }
    if (t.file && !fileName) { showError('#act-file-error', '#act-file', '체결본 파일을 고르세요.'); ok = false; }
    if (t.required && !memo) {
      // 받침에 따라 "을"과 "를" (예: 반려 사유를, 보완할 내용을)
      const word = t.label.replace(' (필수)', '');
      const code = word.charCodeAt(word.length - 1) - 0xAC00;
      $('#act-error').innerHTML = C.icon('alert', 'sm') + esc(word) + (code >= 0 && code < 11172 && code % 28 ? '을' : '를') + ' 적어 주세요.';
      $('#act-error').hidden = false;
      $('#act-field').classList.add('is-invalid');
      $('#act-comment').setAttribute('aria-invalid', 'true');
      ok = false;
    }
    if (!ok) { const bad = modal.querySelector('.is-invalid input, .is-invalid textarea'); if (bad) bad.focus(); return; }
    const s = pending.step;
    const comment = [t.checks ? '확인: ' + t.checks.join(', ') : '', memo].filter(Boolean).join('. ');
    const restart = t.restart && $('#act-restart') && $('#act-restart').checked;
    C.recordAction(c, s, pending.action, comment, me, t.file ? { fileName: fileName } : restart ? { restart: true } : null);
    // 다음 차례 안내
    const now = C.pendingSteps(c).map(function (x) { return C.stepLabel(x.step, c) + ' (' + C.ownerLabel(x.userId) + ')'; }).join(', ');
    let next = '';
    if (pending.action !== 'REJECT' && pending.action !== 'CANCEL' && pending.action !== 'SUPPLEMENT') {
      next = c.status === 'ACTIVE' && change ? ' 운영 변경이 끝났습니다.'
        : c.status === 'TERMINATED' ? ' 해지가 끝나 원계약이 해지 상태가 되었습니다.'
        : c.status === 'ACTIVE' ? (c.renewMode === 'AUTO' ? ' 연장이 끝나 새 계약 기간이 적용되었습니다.' : ' 계약 완료로 보관함에 들어갔습니다.')
        : c.status === 'APPROVED' && C.isReviewStep(s.step) ? ' 계약 검토가 모두 끝나 체결 대기가 되었습니다. 다음 차례: ' + now
        : now ? ' 다음 차례: ' + now : '';
    }
    const done = pending.action === 'APPROVE' && !C.isReviewStep(s.step) ? DONE_MSG[s.step] : DONE_MSG[pending.action];
    C.flash(C.stepLabel(s.step, c) + ': ' + done + next);
    location.reload();
  }
  $('#action-bar').addEventListener('click', function (e) {
    const b = e.target.closest('[data-open]');
    if (!b) return;
    openModal(b.getAttribute('data-open'), b.getAttribute('data-step'));
  });
  modal.addEventListener('click', function (e) {
    if (e.target === modal || e.target.closest('[data-act="close"]')) closeModal();
    if (e.target.closest('[data-act="confirm"]')) confirmAction();
    if (e.target.closest('#act-demo-file')) {
      const n = (c.history || []).filter(function (h) { return h.action === 'REGISTER'; }).length;
      setFile(c.counterparty + '_체결본' + (n ? '_' + (n + 1) : '') + '.pdf');
    }
  });
  document.addEventListener('keydown', function (e) {
    if (modal.hidden) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Tab') { // 확인 창 안에서만 이동
      const f = Array.prototype.slice.call(modal.querySelectorAll('input, textarea, button'));
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  $('#amount').addEventListener('click', function (e) {
    if (!e.target.closest('[data-activity]')) return;
    e.preventDefault();
    C.toast('CRM 영업활동 기록은 기존 CRM에서 열립니다(시안에서는 안내만).');
  });
  // 첨부 미리보기, 내려받기 (프로토타입은 안내만)
  $('#files').addEventListener('click', function (e) {
    const b = e.target.closest('[data-file]');
    if (!b) return;
    const kind = b.getAttribute('data-file');
    // 한 문장으로 (KRDS 토스트, v0.28)
    C.toast(kind === 'pdf' ? '실제 시스템에서는 이름과 일시 워터마크를 찍은 PDF로 받고, 받은 기록이 남습니다(시안).'
      : kind === 'original' ? '원본은 기안자, 법무, 관리자만 받고, 받은 기록이 남습니다(시안).'
      : '실제 시스템에서는 새 창에서 미리보기가 열립니다(시안).');
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
