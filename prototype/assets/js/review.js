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
 *   6. 기획자 결정 2026-11-02
 *      C-14 ③ 승인 창(영업 리더, 영업 임원)에 "이 거래처와 개인적 이해관계가 없습니다" 확인(필수)
 *      C-15 표준계약서를 바꾼 계약의 ④ 법무 승인 창에서 반부패 조항 판단(간접, 조달은 필수, 직접은 선택, 없음이면 사유 필수)
 *      E-2 기본 정보 아래 "같은 거래처 최근 계약" 상자. 계약이 있으면 ② 승인 창에서 "나눠 맺은 계약이 아님"을 꼭 표시
 *      B-6 체크리스트 묶음 아래 결재선 밖 "재무 의견"(재무가 ⑥ 날인 전까지 덧붙임). ⑩ 창에서도 봄
 *      B-8 ⑦에서 서명본 체결일, ⑨에서 실제 개통일(필수). ⑧이 체결일을 확인. 날짜 순서가 이상하면 회색 안내
 *      B-5 견적서로 계약서를 대신한 계약은 ⑦ ⑧ 창의 문서 이름이 최종 견적서, ⑧ 확인 항목은 견적서 항목(C.signedChecks)
 *      B-3 운영 변경도 ⑨ 다음 ⑩ 재무 확인(결재란 설명, 변경 내용의 ⑩ 줄, ⑨ ⑩ 창). 유상 충전은 기능, 표준 단가, 표준 금액, 할인율(막지 않음)
 *      A-10, A-11 계약이 끝난 뒤의 차례(⑨ 만료 처리, ③ 만료 유예 확인)는 결재란 셋째 작은 표와 맨 위 안내. 처리는 계약 상세에서
 *      C-15 체크리스트 1번과 ④ 창에 기준 표준계약서 판의 반부패 조항 표시
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
  // 주소에 번호가 없으면 찾지 않음(번호가 없는 임시 저장과 맞물리지 않게, v0.58 QA)
  const c = id ? D.CONTRACTS.find(function (x) { return x.id === id; }) : null;

  const notice = C.noticeBox; // (kind, title, body)

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
  // 가격 기준: 기능마다 하나(v0.49). 이 계약을 기안한 날 적용되던 가격으로 봄(v0.56: 뒤에 가격이 바뀌어도 지난 계약의 할인율이 그대로)
  //   그날 가격이 없으면(가격 기준을 들이기 전 계약) 오늘 가격으로
  const PRICE = {};
  D.PRICE_BOOK.forEach(function (p) { PRICE[p.feature] = p; });
  D.currentPrices(D.PRICE_ROWS, (c.requestedAt || D.TODAY).slice(0, 10)).forEach(function (p) { PRICE[p.feature] = p; });
  function num(n) { return Number(n || 0).toLocaleString('ko-KR'); }
  const won = C.fmtWon; // 돈은 반드시 원을 붙임 (REQ-UI-17)
  function pct(r) { return Math.round(r * 1000) / 10 + '%'; }
  const addDays = C.addDays;
  // 해지 기안과 연장 검토(짧은 결재)는 원계약을 기준으로 보여 줌 (REQ-ARC-06, 07)
  const short = C.isShort(c);
  const change = C.isChange(c); // 운영 변경(-C): 기간 변경이나 추가 충전 (v0.26)
  const hrChange = change && /^HR_/.test(c.changeType);
  // 표준계약서를 바꾼 계약: 조항 대비표 첨부, ④ 법무 승인 의견 필수 (기획자 결정 v0.27, C-20: flex 품의 대신 시스템 안에 남김)
  const legalNote = !short && !change && !!c.checklist && c.checklist.standard === 'NO';
  const isTerm = c.kind === 'TERMINATE';
  // 기획자 결정 2026-11-02 B-5: 견적서로 계약서를 대신한 계약은 ⑦에 올리고 ⑧이 확인하는 문서가 "최종 견적서"(고객 날인)
  const quote = C.isQuoteInstead(c);
  const DOC = quote ? '최종 견적서' : '체결본';
  // 기획자 결정 2026-11-02 B-8: 날인과 체결본을 거치는 계약(신규, 변경, 바꿔서 연장)만 ⑦ 서명본 체결일과 ⑨ 실제 개통일을 받음
  //   해지의 ⑨는 개통이 아니라 운영 종료라 받지 않음(실제 종료일은 아직 정하지 않음). 그대로 연장과 운영 변경도 받지 않음
  const signs = !short && !change;
  const SIGN_DAY = quote ? '고객 날인일' : '서명본 체결일';
  // 기획자 결정 2026-11-02 C-15: 반부패 조항 판단을 꼭 골라야 하는 계약(간접, 조달). 직접은 골라도 되고 안 골라도 됨
  const abRequired = legalNote && D.ANTI_BRIBE.required.indexOf(C.methodOf(c)) > -1;
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
  /* 같은 거래처 최근 계약 (기획자 결정 2026-11-02 E-2, G-05, REQ-FLOW-21)
   *   사업자등록번호가 같고 기안일이 이 계약 기안일 앞뒤 D.RECENT_SAME.days(90일) 안인 다른 계약. 이 계약의 앞 차수는 같은 번호라 빠짐
   *   임시 저장(기안일 없음)과 해지 기안(금액 없음)은 넣지 않음. 볼 수 없는 열람 제한 계약은 건수만 보임
   *   사업자등록번호: 계약에 적은 번호(form.bizNo, 후속 기안은 원계약), 없으면 거래처 목록에서 상호가 같은 거래처의 번호. 둘 다 없으면 찾지 않음
   *   ②가 보는 계약(신규, 변경, 바꿔서 연장)에만 상자를 둠. 상자에 계약이 하나라도 있으면(볼 수 없는 것 포함)
   *   ② 승인 창에서 "나눠 맺은 계약이 아님"(D.SPLIT_CHECK)을 꼭 표시하고, 그때 상자의 건수(recentSame)를 결재 기록에 남김 */
  function bizDigits(x) {
    const root = x.parentId ? D.CONTRACTS.find(function (y) { return y.id === x.parentId; }) : null;
    const no = (x.form && x.form.bizNo) || (root && root.form && root.form.bizNo) ||
      (D.CUSTOMERS.filter(function (cu) { return cu.name === x.counterparty; })[0] || {}).bizNo || '';
    return String(no).replace(/\D/g, '');
  }
  const recent = (function () {
    const mine = bizDigits(c);
    if (short || change) return { on: false, list: [], hidden: 0 };
    if (!mine || !reqDate) return { on: true, list: [], hidden: 0, nobiz: true };
    const from = addDays(reqDate, -D.RECENT_SAME.days), to = addDays(reqDate, D.RECENT_SAME.days);
    const all = D.CONTRACTS.filter(function (x) {
      const d = String(x.requestedAt || '').slice(0, 10);
      return x.id && x.id !== c.id && x.status !== 'DRAFT' && x.kind !== 'TERMINATE' && d >= from && d <= to && bizDigits(x) === mine;
    }).sort(function (a, b) { return String(b.requestedAt).localeCompare(String(a.requestedAt)); });
    const list = all.filter(function (x) { return C.canView(x, me); });
    return { on: true, list: list, hidden: all.length - list.length };
  })();
  const recentCount = recent.list.length + recent.hidden;
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
      // 할인율은 부호 그대로: 표준보다 높게 받으면 음수 (v0.58 QA: 예전에는 "표준 단가"로 보였음)
      return { product: p, qty: r.qty, amount: r.amount, std: std, discount: (std - r.amount) / std, org: orgText(r) };
    });
  }
  // 줄의 사용 업체 (v0.62, 표준 대응표 G-19): 적은 기관, 또는 "정해지지 않음(까닭)". 간접인데 둘 다 없으면 그렇게 적음
  function orgText(r) {
    if (r.org) return '사용 업체: ' + r.org;
    if (r.orgPending) {
      const why = D.END_USER_PENDING.filter(function (x) { return x.code === r.orgPending; })[0];
      return '사용 업체 정해지지 않음(' + (r.orgPending === 'OTHER' && r.orgNote ? r.orgNote : why ? why.label : r.orgPending) + ')';
    }
    return detail.method === 'INDIRECT' ? '사용 업체 적지 않음' : '';
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
      // 앞 차수의 기안 일시는 다시 기안할 때 남긴 SUBMIT 기록, 지금 차수는 기안 일시 (v0.58)
      const sub = inRound.filter(function (h) { return h.action === 'SUBMIT'; })[0];
      out.push({ round: k, at: sub ? sub.at : k === last ? c.requestedAt : (inRound[0] || { at: c.requestedAt }).at, by: c.requesterId, why: k + '차 기안' });
      inRound.filter(function (h) { return h.action === 'RESUBMIT'; }).forEach(function (h) {
        out.push({ round: k, at: h.at, by: h.actorId || c.requesterId, why: k + '차 보완 완료' });
      });
    }
    out.sort(function (a, b) { return a.at.localeCompare(b.at); });
    out.forEach(function (v, i) { v.no = i + 1; });
    markApproved(out);
    // 결재 기록이 없는 예시 계약은 지금 상태로 (계약 검토를 마쳤으면 마지막 판)
    if (PASSED && out.length && !out.some(function (v) { return v.approved; })) out[out.length - 1].approved = true;
    return out;
  }
  // "결재한 판": 차수마다 거치는 ②~⑤가 모두 승인된 순간에 올라가 있던 판 (REQ-REV-13).
  //   지금 상태가 아니라 결재 기록으로 정함(v0.63 점검에서 고침: ⑥, ⑧ 반려 뒤나 앞 차수의 판에서 표시가 사라졌음).
  //   승인 취소는 그 단계를 되돌리고, 금액이나 답을 바꾼 보완 완료(restart)는 모든 단계를 처음부터
  //   차수의 기록을 끝까지 본 뒤에 정함: 다 승인된 뒤 승인 취소로 되돌아갔으면 표시하지 않음(v0.63 검토).
  //   결재선은 지금 차수는 지금 결재선, 앞 차수는 다시 기안할 때 남긴 결재선(route), 없으면(예시 데이터) 그 차수에 기록이 있는 ②~⑤
  function markApproved(out) {
    const hist = (c.history || []).slice().sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
    // 계약 검토 단계: ③ 영업 임원 승인(S03C, 기획자 결정 2026-11-02 E-3)도 함께
    const last = c.round || 1, REVIEW = ['S02', 'S03', 'S03C', 'S04', 'S05'], ACTS = ['APPROVE', 'REJECT', 'SUPPLEMENT', 'CANCEL'];
    for (let k = 1; k <= last; k++) {
      const inRound = hist.filter(function (h) { return (h.round || 1) === k; });
      const sub = inRound.filter(function (h) { return h.action === 'SUBMIT' && h.route; })[0];
      const route = k === last ? C.routedReview(c).map(function (s) { return s.step; })
        : sub ? sub.route
        : REVIEW.filter(function (code) { return inRound.some(function (h) { return h.step === code && ACTS.indexOf(h.action) > -1; }); });
      if (!route.length) continue;
      const st = {};
      let done = false, marked = null;
      inRound.forEach(function (h) {
        if (h.action === 'RESUBMIT' && h.restart) { route.forEach(function (s) { st[s] = false; }); done = false; marked = null; }
        if (route.indexOf(h.step) < 0) return;
        if (h.action === 'APPROVE') st[h.step] = true;
        if (h.action === 'CANCEL') { st[h.step] = false; done = false; marked = null; }
        if (!done && route.every(function (s) { return st[s]; })) {
          done = true;
          marked = out.filter(function (v) { return v.round === k && v.at <= h.at; }).pop() || null;
        }
      });
      if (done && marked) marked.approved = true;
    }
  }
  // 체결본의 판: common.js signedVersions(계약 상세, 계약 요약서와 같은 목록). 바뀐 판은 까닭에 "다시 등록 요청으로 바뀜", "⑧에서 반려"
  function signedVersions() {
    return C.signedVersions(c).map(function (v) {
      const fate = C.signedFateText(v);
      return Object.assign({}, v, { why: v.why + (fate ? ', ' + fate : '') });
    });
  }
  function files() {
    // 해지 기안과 연장 검토는 계약서 초안 없이 기안할 때 올린 서류(해지 관련 서류)만
    if (change) return []; // 운영 변경은 첨부 없음(사유는 CRM 영업활동 링크)
    const one = function (kind, name, size, at) { return { kind: kind, versions: [{ no: 1, name: name, size: size, at: at || c.requestedAt, by: c.requesterId, why: '기안' }] }; };
    if (short) return (c.files || []).map(function (x, i) { return one(x.kind, x.name, 320000 + i * 1000); });
    const dv = draftVersions();
    // 계약 등록에서 올린 파일(c.files)이 있으면 그 이름과 크기를 씀. 예시 계약처럼 없으면 만들어 보여 줌
    //   (v0.63 점검에서 고침: 올린 부속 서류와 견적서가 빠지고, 올리지 않은 견적서가 늘 보였음. 03 attachment.file_name "올린 이름 그대로")
    const up = c.files || null;
    const upOf = function (kind) { return (up || []).filter(function (x) { return x.kind === kind; }); };
    //   올린 이름은 지금 차수의 기안 판(첫 판)에 붙임. 보완 완료로 다시 올린 판은 시안에 파일이 없어 만든 이름 (v0.63 검토)
    const draftName = function (kind, v, fallback) { const f = upOf(kind)[0]; return up && f && v.round === (c.round || 1) && v === dv.filter(function (x) { return x.round === v.round; })[0] ? { name: f.name, size: f.size || fallback.size } : fallback; };
    const list = [{ kind: 'DRAFT_DOC', versions: dv.map(function (v) { return Object.assign(draftName('DRAFT_DOC', v, { name: c.counterparty + '_계약서_초안_판' + v.no + '.docx', size: 84000 + seq * 13 + v.no * 977 }), v); }) }];
    // 조항 대비표: 표준계약서를 바꾼 계약 (v0.27, C-20). 계약서 초안과 같이 판이 바뀜
    if (legalNote) list.push({ kind: 'CLAUSE_DIFF', versions: dv.map(function (v) { return Object.assign(draftName('CLAUSE_DIFF', v, { name: c.counterparty + '_조항대비표_판' + v.no + '.docx', size: 36000 + seq * 5 + v.no * 311 }), v, { approved: false }); }) });
    // 부속 서류: 비밀유지계약서처럼 계약에 딸린 서류 (v0.41)
    if (up) upOf('ANNEX').forEach(function (x) { list.push(one('ANNEX', x.name, x.size || 152000)); });
    else (c.annex || []).forEach(function (name, i) { list.push(one('ANNEX', name, 152000 + seq * 3 + i * 1000)); });
    // 최종 견적서는 선택: 올린 것만(예시 계약은 금액이 있으면 하나 있는 것으로 보여 줌)
    if (up) upOf('QUOTE').forEach(function (x) { list.push(one('QUOTE', x.name, x.size || 212000)); });
    else if (c.amount) list.push(one('QUOTE', c.counterparty + '_최종견적서.pdf', 212000 + seq * 7));
    const sv = signedVersions();
    // 견적서로 계약서를 대신한 계약은 ⑦에 올린 문서 이름이 "고객 날인 최종 견적서"(기획자 결정 2026-11-02 B-5, C.signDocLabel)
    if (sv.length) list.push({ kind: 'SIGNED', label: C.signDocLabel(c), versions: sv.map(function (v) { return Object.assign({ size: 1840000 + seq * 11 + v.no * 3000 }, v); }) });
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
    '<a class="doc-link" href="contract.html?id=' + encodeURIComponent(rootId) + '">계약 묶음 보기</a>']);

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
    // 기획자 결정 2026-11-02 B-8: ⑦에서 서명본 체결일을 함께 적고 ⑧이 확인. B-5: 견적서로 대신한 계약은 고객 날인 최종 견적서와 고객 날인일
    S07: quote ? '고객 날인 최종 견적서(고객이 날인하거나 서명한 것, PDF나 스캔 이미지, 50MB 이하)를 화면 아래에서 올려 주세요. 견적서에 고객이 날인한 날도 적습니다. 올린 견적서는 고치거나 지울 수 없습니다.'
      : '상대방 서명을 받은 뒤 화면 아래에서 체결본(PDF나 스캔 이미지, 50MB 이하)을 올려 주세요. 서명본에 적힌 체결일도 적습니다. 올린 체결본은 고치거나 지울 수 없습니다.',
    S08: quote ? '첨부 파일의 최종 견적서가 결재한 견적과 같은지, ⑦에서 적은 고객 날인일이 견적서와 같은지 확인해 주세요. 같으면 확인 완료, 스캔 문제나 날인 빠짐이면 다시 등록 요청, 내용이 다르면 반려합니다.'
      : '첨부 파일의 체결본이 승인된 내용과 같은지, ⑦에서 적은 서명본 체결일이 체결본과 같은지 확인해 주세요. 같으면 확인 완료, 오탈자나 스캔 문제, 서명이나 날인 빠짐이면 다시 등록 요청, 계약 내용이 다르면 반려합니다.',
    S09: change ? (hrChange ? '수불부에 HR 추가 충전 ' + c.changeQty + '건을 반영한 뒤 화면 아래에서 운영 변경 완료로 처리해 주세요.'
        : c.changeType === 'PERIOD' ? '라이선스나 도메인 기간을 새 종료일(' + C.fmtDate(c.endDate) + ')로 바꾼 뒤 화면 아래에서 운영 변경 완료로 처리해 주세요.'
        : 'CK 추가 충전 ' + c.changeQty + '건을 반영한 뒤 화면 아래에서 운영 변경 완료로 처리해 주세요.')
      : isTerm ? '해지일에 맞춰 라이선스나 도메인을 닫고 계약 종료일을 설정한 뒤 화면 아래에서 운영 종료 완료로 처리해 주세요.'
      : c.renewMode === 'AUTO' ? '라이선스나 도메인 기간을 새 계약 기간에 맞춰 연장한 뒤 화면 아래에서 기간 연장 완료로 처리해 주세요.'
      : '서비스에 계약을 적용한 뒤(라이선스나 도메인 열기, 계약 정보 설정) 화면 아래에서 운영 적용 완료로 처리해 주세요. 실제 개통일도 적습니다.', // B-8
    // 기획자 결정 2026-11-02 B-3(추천과 다름): 운영 변경도 ⑩ 재무 확인. 끝나면 운영 변경이 계약 완료가 됨(기간 변경은 그때 묶음의 계약 기간이 바뀜)
    S10: change ? '변경 내용(' + (c.changeType === 'PERIOD' ? '바뀐 계약 기간' : /_PAID$/.test(c.changeType) ? '유상 충전 수량과 금액' : '무상 충전 수량') +
        ')과 ⑨에서 반영한 것을 확인한 뒤 재무 확인 완료를 눌러 주세요. 완료하면 운영 변경이 끝나 계약 완료가 됩니다. 필요하면 메모를 남깁니다.'
      : isTerm ? '환불, 위약금, 매출 조정을 확인한 뒤 재무 확인 완료를 눌러 주세요. 필요하면 메모를 남깁니다.'
      : c.renewMode === 'AUTO' ? '연장된 기간의 매출 인식을 확인한 뒤 재무 확인 완료를 눌러 주세요. 필요하면 메모를 남깁니다.'
      : '계약 금액과 체크리스트 4번(회계에 영향을 주는 특수 조건), 체결 전에 남긴 재무 의견을 확인한 뒤 재무 확인 완료를 눌러 주세요. 필요하면 메모를 남깁니다.', // B-6
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
      // 기획자 결정 2026-11-02: 승인 창에서 새로 꼭 표시하는 것을 미리 알림. ② 같은 거래처 최근 계약(E-2), ③ 이해관계 없음(C-14), ④ 반부패 조항(C-15)
      const must = s.step === 'S02' && recentCount ? '<br><strong>같은 거래처 최근 계약 ' + recentCount + '건</strong>이 있어 승인할 때 나눠 맺은 계약이 아닌지 꼭 표시합니다(기본 정보 아래 상자).'
        : s.step === 'S03' || s.step === 'S03C' ? '<br>승인할 때 이 거래처와 개인적 이해관계가 없음을 꼭 표시합니다.'
        : s.step === 'S04' && abRequired ? '<br>간접, 조달 계약이라 승인할 때 반부패 조항 판단을 꼭 고릅니다.' : '';
      html = notice('', C.stepLabel(s.step, c) + ' 차례입니다 (' + C.waitDays(c, s) + '일째)', todo + must + behalf + ret);
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
      // 기안자가 보완해 같은 번호의 다음 차수로 다시 기안(버튼). 해지, 그대로 연장, 운영 변경도 같음 (v0.58 기획자 결정)
      const mineRej = me.id === c.requesterId || me.role === 'SUPER';
      html = notice('', C.stepLabel(c.rejection.step, c) + '에서 반려되었습니다',
        '<strong>' + esc(C.ownerLabel(c.rejection.by)) + ' (' + C.fmtDateTime(c.rejection.at) + ')</strong><br>' + esc(c.rejection.reason) +
        '<br>기안자가 보완해 같은 번호의 ' + (round + 1) + '차로 다시 기안합니다.',
        mineRej ? '<a class="btn btn--primary btn--md" href="' + C.resubmitHref(c) + '">보완 후 재기안</a>' : '');
    } else if (actionable.length && me.role === 'SUPER') {
      html = notice('', '시연: 담당자 대신 처리해 볼 수 있습니다',
        '최고관리자는 모든 결재 문서를 볼 수 있고, 프로토타입에서는 담당자 대신 각 단계를 처리해 볼 수 있습니다. 실제 시스템에서는 담당자 본인과 관리자가 대리로 지정한 사람만 처리합니다(결재선 규칙의 대리 지정).' + ret);
    } else if (c.status === 'APPROVED' || c.status === 'OPS_REVIEW') {
      // 해지, 그대로 연장, 운영 변경은 체결본 없이 운영 검토로 감 (v0.63 점검에서 고침: "체결본을 등록했습니다"가 나왔음)
      const noSign = short || change || !c.signedAt;
      //   ③을 거치지 않는 운영 변경(기준 이내의 기간 변경과 무상 충전, 유상 충전)은 계약 검토 없이 바로 ⑨로 감 (v0.63 검토)
      //   안내 문장은 유상 충전에도 맞게 "영업 검토를 거치지 않는 변경"으로 씀(한도 안이라는 까닭은 유상 충전에 맞지 않음, v0.63 화면 글 점검)
      const noReview = change && !C.routedReview(c).length;
      html = notice('success', c.status === 'APPROVED' ? '계약 검토가 끝나 체결 중입니다' : noReview ? '운영 변경 중입니다' : noSign ? '계약 검토가 끝나 운영 검토 중입니다' : '체결이 끝나 운영 검토 중입니다',
        (noReview ? C.fmtDateTime(c.requestedAt) + '에 기안했습니다. 영업 검토를 거치지 않는 변경이라 바로 운영 변경으로 갑니다. '
          : c.status === 'APPROVED' || noSign ? C.fmtDateTime(c.approvedAt) + '에 계약 검토가 끝났습니다. ' : C.fmtDateTime(c.signedAt) + '에 ' + C.josa(DOC, '을', '를') + ' 등록했습니다. ') + // B-5
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
    $('#notice').innerHTML = html + expiryNoticeHtml();
  }
  /* 계약이 끝난 뒤의 차례 안내 (기획자 결정 2026-11-02 A-10, A-11)
   *   ⑨ 만료 처리와 ③ 만료 유예 확인은 이 문서가 아니라 계약 상세에서 처리함(C.turnHref). 이 문서에는 지금 상태와 그 화면 링크만
   *   이 계약이 그 차례를 갖는 계약(묶음의 지금 유효한 계약)일 때만. 처리한 기록은 아래 결재 기록에 남음 */
  function expiryNoticeHtml() {
    const x = C.expiryOf(c);
    if (!x || x.holder !== c || (x.state === 'NONE' && !x.note)) return '';
    const b = C.bundleOf(rootId);
    const turn = [x.step && x.step.state === 'PENDING' ? x.step : null, x.askStep].filter(Boolean);
    const now = turn.map(function (s) { return esc(C.stepTag(s.step, c) + ' ' + C.ownerLabel(s.userId)) + '의 ' + esc(D.STEPS[s.step].name) + ' 차례(' + C.waitDays(c, s) + '일째)'; }).join(', ');
    // 연장이나 새 계약 기안이 있으면(OFF) 만료 처리 칸의 생략 까닭(예: "연장 기안이 있어 만료 처리 없음")
    const why = x.state === 'OFF' && x.step ? esc(x.step.reason) + '. ' : '';
    const doneText = x.done ? C.fmtDateTime(x.done.at) + '에 ' + esc(C.josa(C.ownerLabel(x.done.actorId, x.done.actorDept), '이', '가')) + ' 서비스를 닫았습니다. ' : '';
    const body = (x.ended ? '종료일(' + C.fmtDate(x.end) + ')이 지났습니다. ' : '') + (x.note ? esc(x.note) + '. ' : '') + why +
      (now ? '지금 ' + now + '입니다. ' : doneText) +
      '만료 처리와 유예는 계약 상세에서 처리하고, 처리한 기록은 이 문서의 결재 기록에 남습니다.';
    const can = b && (C.canCloseExpiry(b, me) || C.canDecideGrace(b, me) || C.canAskGrace(b, me));
    const link = '<a class="btn btn--' + (can ? 'primary' : 'tertiary') + ' btn--md" href="' + C.turnHref(c, turn[0] || { step: 'SXP' }) + '">' + (can ? '계약 상세에서 처리' : '계약 상세 보기') + '</a>';
    return notice(x.state === 'DONE' ? 'success' : '', x.label || x.note, body, link);
  }

  /* ---------- 3. 결재란 (REQ-DOC-02, REQ-SIGN-02) ----------
   * 첫 표: ① 기안 + 계약 검토 단계 ②~⑤. 생략한 단계도 칸을 두어 왜 생략했는지 보이게 함
   * 둘째 표: 계약 체결(⑥ 총무, ⑦ 기안자, ⑧ 영업지원)과 운영 검토(⑨ 고객지원, ⑩ 재무). 생략 없음
   * 기획자 결정 2026-11-02 D-3: 머리글은 현재 진행 칸과 같은 "맡는 사람" 이름(C.stepTag). 리더 본인 계약의 ③은 "③ 영업 임원" */
  function boxHtml(steps, withDraft) {
    const skip = function (s) { return s.state === 'SKIPPED' ? ' class="is-skipped"' : ''; };
    const head = (withDraft ? '<th scope="col">' + esc(C.stepTag('S01', c)) + '</th>' : '') +
      steps.map(function (s) { return '<th scope="col">' + esc(C.stepTag(s.step, c)) + '</th>'; }).join('');
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
      boxHtml(steps.filter(function (s) { return s.phase === 3 || s.phase === 4; }), false);
    // 기획자 결정 2026-11-02 A-10, A-11: 계약이 끝난 뒤의 차례(phase 5: ⑨ 만료 처리, ③ 만료 유예 확인)는 따로 작은 표로
    const after = steps.filter(function (s) { return s.phase === 5; });
    $('#box-after').hidden = !after.length;
    if (after.length) {
      $('#approval-box-after').innerHTML = '<caption class="sr-only">결재란 계약이 끝난 뒤: 만료 처리와 유예 확인의 담당자, 결과, 일시</caption>' + boxHtml(after, false);
    }
    // 거치는 단계는 맡는 사람 이름까지(기획자 결정 2026-11-02 D-3, E-3): ③ 영업 리더와 ③ 영업 임원 승인이 "③, ③"으로 겹쳐 보이지 않게
    const routedList = C.routedReview(c).map(function (s) { return s.step; });
    const routed = routedList.map(function (code) { return C.stepTag(code, c); }).join(', ');
    // ③은 결재란 머리글과 같은 이름(D-3, 2026-11-02): 리더 본인 계약이면 "③ 영업 임원"
    const s03 = C.stepTag('S03', c);
    //   E-3: ③ 영업 임원 승인을 거치면 순서 문장에 "③ 영업 리더 다음 ③ 영업 임원"
    const order = routedList.indexOf('S03C') > -1 ? '② 다음 ' + s03 + ', ' + C.stepTag('S03C', c) + ' 차례로, 그다음 ④와 ⑤ 동시' : '② 다음 ③, 그다음 ④와 ⑤ 동시';
    // 기획자 결정 2026-11-02 B-3(추천과 다름): 운영 변경도 ⑨ 반영 다음 ⑩ 재무 확인까지(HR 충전의 ⑩은 ⑨를 한 재무 담당자가 아닌 재무 리더)
    $('#box-desc').textContent = change
      ? '운영 변경은 ' + (C.changeSales(c)[0] ? C.josa(s03, '이', '가') + ' 승인한 뒤 ' : '') + C.josa(C.stepTag('S09', c), '이', '가') + ' 반영하고 ' +
        C.josa(C.stepTag('S10', c), '이', '가') + ' 확인하면 끝납니다' + (hrChange ? '(⑩은 ⑨를 한 재무 담당자가 아닌 사람)' : '') + '. 체크리스트, 법무, 날인, 체결본은 없습니다.'
      : short
      ? C.josa(isTerm ? '해지 기안' : '연장 검토', '은', '는') + ' ' + s03 + ', ④ 법무가 승인한 뒤 ⑨ 고객지원 ' + (isTerm ? '운영 종료' : '기간 연장') + ', ⑩ 재무 확인을 거칩니다. 체크리스트, 날인, 체결본은 없습니다.'
      : '거치는 단계: ' + routed + '. 순서는 ' + order + '이고, 생략한 단계는 건너뜁니다. 무엇을 생략할지는 체크리스트 답과 개인정보 처리위탁 계약 여부로 정해졌습니다. ' +
        '승인 뒤에는 ⑥ 인장 날인부터 ⑩ 재무 확인까지 하나씩 차례로 거칩니다.';
  }

  /* ---------- 4. 기본 정보, 금액, 체크리스트, 첨부, 결재 기록 ---------- */
  function info(label, value) { return '<div><dt>' + esc(label) + '</dt><dd>' + value + '</dd></div>'; }
  function renderBasic() {
    $('#basic').innerHTML = [
      info('계약번호', esc(c.id)),
      info('계약종류', esc(kindText)),
      // 기안하며 직접 입력한 새 거래처는 표시(v0.63, 표준 대응표 G-25 ①): 사업자 정보 DB에 없던 곳이라 번호를 한 번 더 봄
      //   눈에 띄게 배지로(v0.63 검토: 놓치지 않게 하려는 표시라 흐린 글자만으로는 약함)
      info('고객사', esc(c.counterparty) + (C.isNewCustomer(c) ? ' ' + C.badge('attention', '새 거래처') + '<span class="cell-meta">이 계약을 기안하며 직접 입력해 등록</span>' : '')),
    ].concat((c.unit || f.unit) ? [info('기관 또는 부서명', esc(c.unit || f.unit))] : []).concat([ // 계약마다 직접 적은 기관 이름 (C-24 v0.39, 이름 v0.46)
      info('사업자등록번호', esc(C.fmtBizNo(detail.bizNo))), // 000-00-00000 (v0.34)
      info('영업대표', esc(C.ownerLabel(c.requesterId))), // 조직 이름 (v0.32)
      // 판다(CRM) 영업기회번호: 규칙에 맞으면 판다로 가는 링크 (v0.32)
      info('영업기회번호', detail.opportunity ? C.pandaLink(detail.opportunity) : '-'),
      info('계약 방식', esc(D.METHODS[detail.method])),
      info('정산 방식', esc(D.SETTLEMENTS[detail.settlement])),
      info('계약 기간', C.fmtPeriod(detail.startDate, detail.endDate)),
    ]).concat(signs ? [
      // 기획자 결정 2026-11-02 B-5(REQ-REG-25): 체결 문서. 견적서로 계약서를 대신한 계약은 "계약서 대신" 배지로 ②~⑥ 결재자도 바로 알게
      info('체결 문서', quote ? C.badge('line', '계약서 대신') + ' 고객이 날인한 최종 견적서<span class="cell-meta">공급가액 ' + won(D.QUOTE_INSTEAD.under) + ' 미만이라 계약서를 쓰지 않음</span>' : '계약서'),
      // 기획자 결정 2026-11-02 B-8: ⑦에서 받은 서명본 체결일(견적서는 고객 날인일)과 올린 날, ⑨에서 받은 실제 개통일. 아직이면 어느 단계에서 받는지
      info(SIGN_DAY, C.signedDate(c) ? C.fmtDate(C.signedDate(c)) + '<span class="cell-meta">올린 날 ' + C.fmtDate(c.signedAt) + '</span>' : '<span class="cell-meta">⑦에서 받음</span>'),
      info('실제 개통일', C.openDate(c) ? C.fmtDate(C.openDate(c)) : '<span class="cell-meta">⑨에서 받음</span>'),
    ] : []).concat([
      info('자동갱신', detail.autoRenew === 'YES' ? '있음 (해지 통지: 만료 ' + (detail.noticeDays || '-') + '일 전)' : '없음'),
      info('개인정보 처리위탁 계약', c.personalData ? '있음' : '없음'),
      info('서비스 수준 협약(SLA)', (c.sla || f.sla) === 'YES' ? '있음' : '없음'), // v0.40
      info('열람 제한', c.restricted ? C.icon('lock', 'sm') + '있음' + (C.viewerText(c) ? '<span class="cell-meta">지정 열람자: ' + esc(C.viewerText(c)) + '</span>' : '') : '없음'), // 지정 열람자 (v0.52)
    ]).join('');
    $('#basic-extra').innerHTML = dateOrderHtml() + recentHtml();
  }
  // 날짜 순서 안내 (기획자 결정 2026-11-02 B-8): 서명본 체결일이 승인일보다 앞섬, 올린 날보다 뒤, 개통일이 체결일보다 앞섬(C.dateOrderIssues)
  //   막지 않고 회색 상자로 알림(REQ-UI-32). 문제가 없으면 상자를 두지 않음(날짜가 정해진 뒤 바뀌지 않아 화면이 흔들리지 않음)
  function dateOrderHtml() {
    const list = signs ? C.dateOrderIssues(c) : [];
    if (!list.length) return '';
    return '<div class="doc-aside" role="note"><p class="doc-aside-title">' + C.icon('alert', 'sm') + '날짜 순서를 확인해 주세요</p>' +
      '<ul class="doc-aside-list">' + list.map(function (x) { return '<li>' + esc(quote ? x.text.replace(/서명본 체결일/g, SIGN_DAY) : x.text) + '</li>'; }).join('') + '</ul>' +
      '<p class="doc-aside-note">막지는 않습니다. ' + DOC + '의 날짜와 실제 일정을 한 번 더 확인해 주세요.</p></div>';
  }
  // 같은 거래처 최근 계약 상자 (기획자 결정 2026-11-02 E-2): 계약번호, 계약종류, 기안일, 계약 금액(오른쪽), 상태. 볼 수 없는 열람 제한 계약은 건수만
  function recentHtml() {
    if (!recent.on) return '';
    const days = D.RECENT_SAME.days;
    const head = '<h3 class="box-subtitle" id="recent-title">같은 거래처 최근 계약</h3>' +
      '<p class="section-desc">사업자등록번호가 같고 기안일이 이 계약 앞뒤 ' + days + '일 안인 다른 계약입니다. 계약이 있으면 ② 체크리스트 검토가 나눠 맺은 계약이 아닌지 꼭 확인합니다.</p>';
    if (recent.nobiz) return head + '<p class="recent-empty">거래처 목록에서 사업자등록번호를 찾지 못해 같은 거래처 계약을 찾지 않았습니다.</p>';
    if (!recentCount) return head + '<p class="recent-empty">같은 거래처에 앞뒤 ' + days + '일 안에 기안한 다른 계약이 없습니다.</p>';
    const amount = function (x) { return x.kind === 'CHANGE' ? Number(x.changeAmount) || 0 : Number(x.amount) || 0; };
    const rows = recent.list.map(function (x) {
      return '<tr><td><a href="review.html?id=' + encodeURIComponent(x.id) + '">' + esc(x.id) + '</a>' + (x.restricted ? ' ' + C.icon('lock', 'sm') : '') +
        (C.isQuoteInstead(x) ? ' ' + C.badge('line', '계약서 대신 견적서') : '') +
        '<span class="cell-meta">' + esc(C.kindLabel(x)) + '</span></td>' +
        '<td class="num-left">' + C.fmtDate(x.requestedAt) + '</td><td class="num">' + C.fmtWon(amount(x)) + '</td><td class="center">' + C.statusBadge(x) + '</td></tr>';
    }).join('');
    return head + (recent.list.length ? '<div class="tbl-wrap"><table class="tbl tbl--compact recent-same" aria-labelledby="recent-title">' +
        '<thead><tr><th scope="col">계약번호</th><th scope="col">기안일</th><th scope="col" class="num">계약 금액</th><th scope="col">상태</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>' : '') +
      (recent.hidden ? '<p class="recent-empty">' + C.icon('lock', 'sm') + '볼 수 없는 열람 제한 계약 ' + recent.hidden + '건이 더 있습니다(건수만 보임).</p>' : '');
  }

  /* 유상 충전의 기능과 표준 금액 (기획자 결정 2026-11-02 B-3 덧붙임, G-10 ②): 기안할 때 남긴 그날 표준 단가로 견줌(막지 않음)
   *   changeFeature(기능), changeListPrice(그날 표준 단가), changePriceUnit(단위), changePriceFrom(가격 기준 적용 시작일)
   *   단위가 건일 때만 표준 금액(표준 단가 x 수량)과 할인율. 아니면 견주지 않음(카피킬러 건 단위 가격은 C-33 뒤)
   *   이 칸을 두기 전에 기안한 기록은 기능이 없어 "-". 금액은 오른쪽 */
  function paidRows(dd) {
    if (!c.changeFeature) return [dd('기능', '-'), dd('표준 금액 대비', '<span class="cell-meta">기능을 고르기 전에 기안한 기록이라 견주지 않음</span>')];
    const feat = D.FEATURES.filter(function (x) { return x.id === c.changeFeature; })[0] || {};
    const unit = c.changePriceUnit || '', perCase = /^건/.test(unit), qty = Number(c.changeQty) || 0;
    const std = perCase ? (Number(c.changeListPrice) || 0) * qty : 0;
    const disc = std ? (std - (Number(c.changeAmount) || 0)) / std : null;
    const rows = [dd('기능', esc(C.featureLabel({ product: feat.product, feature: c.changeFeature }))),
      dd('표준 단가', c.changeListPrice != null ? won(c.changeListPrice) + '<span class="cell-meta">' + esc(unit) + (c.changePriceFrom ? ', ' + C.fmtDate(c.changePriceFrom) + '부터 적용' : '') + '</span>' : '-', 'amount')];
    if (!perCase) {
      return rows.concat([dd('표준 금액 대비', '건 단위 표준 단가가 없어 견주지 않음' + (/^CK_/.test(c.changeType) ? '<span class="cell-meta">카피킬러 건 단위 가격이 정해지면 보임(C-33 뒤)</span>' : ''))]);
    }
    return rows.concat([dd('표준 금액 (표준 단가 x 수량)', won(std), 'amount'),
      dd('할인율', disc == null ? '-' : Math.abs(disc) < 1e-9 ? '0%, 표준 단가 그대로' : disc < 0 ? '표준보다 ' + pct(-disc) + ' 높음' : pct(disc) + ' 할인', 'amount')]);
  }
  function renderAmount() {
    if (change) {
      // 변경 내용 (REQ-CHG-06~11): 종류, 기간이나 수량, 사유, CRM 영업활동 링크, 영업 검토를 거치는 까닭
      const dd = function (label, value, cls) { return '<div><dt>' + esc(label) + '</dt><dd' + (cls ? ' class="' + cls + '"' : '') + '>' + value + '</dd></div>'; }; // cls amount: 금액은 오른쪽
      const sales = C.changeSales(c);
      $('#amount-title').innerHTML = '<span class="num">2</span>변경 내용';
      $('#amount').innerHTML = '<dl class="info-grid">' + [
        dd('원계약', '<a href="contract.html?id=' + encodeURIComponent(rootId) + '">' + esc(c.parentId) + '</a>'),
        dd('변경 종류', esc(D.CHANGE_TYPES[c.changeType])),
        c.changeType === 'PERIOD'
          ? dd('계약 기간', C.fmtDate(c.oldEndDate) + ' 종료 → ' + C.fmtDate(c.endDate) + ' 종료')
          : dd('충전 수량', num(c.changeQty) + '건' + (c.changeAmount ? ', 금액 ' + won(c.changeAmount) + ' (부가세 별도)' : ' (무상)')),
      ].concat(/_PAID$/.test(c.changeType) ? paidRows(dd) : []).concat([
        dd('변경 사유', esc(c.reason || '-')),
        dd('CRM 영업활동', c.activityUrl ? '<a href="#" class="doc-link" data-activity>' + esc(c.activityUrl) + '</a>' : '-'),
        dd('③ 영업 검토', (sales[0] ? '거침: ' : '생략: ') + esc(sales[1])),
        dd('⑨ 반영', hrChange ? '재무(수불부)' : '고객지원'),
        // 기획자 결정 2026-11-02 B-3(추천과 다름): 운영 변경도 ⑩ 재무 확인. HR 충전은 ⑨를 한 재무 담당자가 아닌 재무 리더
        dd('⑩ 재무 확인', hrChange ? '재무 리더(⑨를 한 재무 담당자가 아닌 사람)' : '재무'),
      ]).join('') + '</dl>';
      return;
    }
    if (short) {
      // 해지 내용, 연장 내용 (REQ-ARC-06, 07)
      const dd = function (label, value, cls) { return '<div><dt>' + esc(label) + '</dt><dd' + (cls ? ' class="' + cls + '"' : '') + '>' + value + '</dd></div>'; }; // cls amount: 금액은 오른쪽
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
        dd('계약 금액', won(c.amount) + ' (부가세 별도)', 'amount'),
        dd('그대로 연장하는 이유', esc(c.reason || '-')),
      ]).join('') + '</dl>';
      return;
    }
    const rows = productRows();
    if (!rows.length) { $('#amount').innerHTML = '<p class="empty">제품 정보가 없습니다.</p>'; return; }
    const total = rows.reduce(function (a, r) { return a + r.amount; }, 0);
    const stdTotal = rows.reduce(function (a, r) { return a + r.std; }, 0);
    // 할인율 칸은 "표준 단가", "N% 할인", "N% 높음"만 보여 줌. 할인율 한도 값과 한도 초과 여부는 이 표에 두지 않음
    // (한도를 지켰는지는 체크리스트 3번에서 봄). 금액에는 원을 붙임 (REQ-UI-17)
    const rateText = function (d) { return Math.abs(d) < 1e-9 ? '표준 단가' : d < 0 ? pct(-d) + ' 높음' : pct(d) + ' 할인'; };
    // 총액 줄에 계약 전체 할인율(표준 금액 합계 대비, v0.63 표준 대응표 G-16: 0원 줄과 할인이 섞여도 전체 폭이 보이게)
    const totalRate = stdTotal ? rateText((stdTotal - total) / stdTotal) : '';
    $('#amount').innerHTML =
      '<div class="tbl-wrap"><table class="tbl tbl--compact">' +
        '<caption class="sr-only">제품별 금액: 제품과 기능(단위, 사용 업체), 수량, 표준 금액, 계약 금액, 할인율. 총액 줄에 계약 전체 할인율</caption>' +
        '<thead><tr><th scope="col">제품과 기능</th><th scope="col" class="num">수량</th><th scope="col" class="num">표준 금액</th><th scope="col" class="num">계약 금액</th><th scope="col" class="num">할인율</th></tr></thead>' +
        '<tbody>' + rows.map(function (r) {
          // "프리즘 결함검사" 아래에 단위(예: 기관, 1년). v0.49에 플랜을 없애 플랜 이름 대신 단위
          return '<tr><td>' + esc(C.featureLabel(r.product)) + '<span class="product-unit">' + esc(r.product.unit) + '</span>' +
            (r.org ? '<span class="product-unit product-org">' + esc(r.org) + '</span>' : '') + '</td><td class="num">' + num(r.qty) + '</td><td class="num">' + won(r.std) + '</td>' +
            '<td class="num">' + won(r.amount) + '</td><td class="num">' + rateText(r.discount) + '</td></tr>';
        }).join('') + '</tbody>' +
        '<tfoot><tr><th scope="row">총액 (부가세 별도)</th><td></td><td class="num total">' + won(stdTotal) + '</td>' +
          '<td class="num total">' + won(total) + '<span class="total-read">' + esc(C.fmtKRW(total)) + '</span></td><td class="num total">' + totalRate + '</td></tr></tfoot>' +
      '</table></div>';
  }

  function answer(v) {
    if (v === 'YES') return C.badge('success', '예');
    if (v === 'NO') return C.badge('danger', '아니요');
    return C.badge('line', '-');
  }
  function renderChecklist() {
    // 체크리스트가 없는 결재(운영 변경, 해지, 연장 검토)는 체크리스트 설명 문장을 감춤 (v0.63 점검에서 고침)
    $('#checklist-desc').hidden = change || short;
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
      // 3번: ③ 영업 임원 승인(기획자 결정 2026-11-02 E-3)을 거치면 그 까닭도 한 줄 더 (이름은 맡는 사람으로, stepTag)
      const coo = i === 2 && route.S03C && route.S03C[0] ? '<span class="check-effect">' + esc(C.stepTag('S03C', c) + ' 승인 거침: ' + route.S03C[1]) + '</span>' : '';
      const effect = i === 1 ? '' : '<span class="check-effect">' + esc(D.STEPS[x[3]].no + ' ' + D.STEPS[x[3]].name + (r[0] ? ' 거침' : ' 생략') + ': ' + r[1]) + '</span>' + coo;
      // 1번에는 기준 표준계약서와 그 판 (v0.53, REQ-CHK-09). 아니요면 ④ 법무의 반부패 조항 판단(기획자 결정 2026-11-02 C-15)
      const tpl = i === 0 ? '<p class="check-note">기준 표준계약서: ' + esc(C.templateLabel(c) + templateMark()) + '</p>' + antiBribeHtml() : '';
      return '<li><p class="check-q-text">' + esc(x[0]) + ' ' + answer(x[1]) + '</p>' + tpl +
        '<p class="check-note">비고: ' + (x[2] ? esc(x[2]) : '없음') + '</p>' + effect + '</li>';
    }).join('') + '</ul>' +
    '<p class="check-effect">' + esc(D.STEPS.S05.no + ' ' + D.STEPS.S05.name) + ' ' + (route.S05[0] ? '거침' : '생략') + ': ' + esc(route.S05[1]) + '</p>' +
    // 4번: 회계 영향 특수 조건. 결재선에는 영향 없고, 예면 기안할 때 재무에 이메일로 알림 (REQ-CHK-08)
    '<ul class="doc-checks doc-checks--extra"><li><p class="check-q-text">' + esc('4. 회계에 영향을 주는 특수 조건이 있나요?') + ' ' + (ck.accounting === 'YES' ? C.badge('danger', '예') : ck.accounting === 'NO' ? C.badge('success', '아니요') : answer(ck.accounting)) + '</p>' /* 4번은 '예'가 예외(1~3번은 '아니요')라 색을 뒤집음 */ +
      // 4번 조건의 종류(기획자 결정 2026-11-02 B-6, checklist.acctKinds): 예일 때 고른 종류
      (ck.accounting === 'YES' ? '<p class="check-note">종류: ' + esc(acctKindsText(ck) || '고르지 않음') + '</p>' : '') +
      '<p class="check-note">비고: ' + (ck.accountingNote ? esc(ck.accountingNote) : '없음') + '</p>' +
      '<span class="check-effect">' + (ck.accounting === 'YES' ? '재무 알림: 기안할 때 재무 ' + esc(C.ownerLabel(C.stepUserAt('S10', c, c.requestedAt))) + '에게 이메일로 알렸습니다(결재선 아님). 재무 의견은 아래 칸에 남습니다' : '재무 알림 없음') + '</span></li></ul>';
  }
  // 4번 조건의 종류 이름 (D.ACCT_KINDS 코드 → 이름, 기획자 결정 2026-11-02 B-6)
  function acctKindsText(ck) {
    return (ck.acctKinds || []).map(function (k) { return ((D.ACCT_KINDS || []).filter(function (x) { return x.code === k; })[0] || { label: k }).label; }).join(', ');
  }
  /* ④ 법무의 반부패 조항 판단 (기획자 결정 2026-11-02 C-15, G-21): 1번이 아니요(표준계약서를 바꿈)인 계약만
   *   ④ 승인이 지금 유효하면(승인 취소 뒤 다시 승인했으면 마지막 승인) 그 기록의 antiBribe와 사유. 아직이면 어느 단계에서 고르는지
   *   간접과 조달은 꼭 고르고, 직접은 고르지 않아도 됨. 이 판단을 두기 전에 승인한 기록은 "기록 없음" */
  function legalApproval() {
    const s04 = (c.approvals || []).filter(function (a) { return a.step === 'S04'; })[0];
    if (!s04 || s04.state !== 'DONE') return null;
    return (c.history || []).filter(function (h) { return h.step === 'S04' && h.action === 'APPROVE' && (h.round || 1) === round; }).pop() || null;
  }
  function antiBribeText(h) {
    const opt = D.ANTI_BRIBE.options.filter(function (x) { return x.code === h.antiBribe; })[0];
    return opt ? opt.label + (h.antiBribe === 'NONE' && h.antiBribeNote ? ' (사유: ' + h.antiBribeNote + ')' : '') : '';
  }
  // 기준 표준계약서 판의 반부패 조항 표시(기획자 결정 2026-11-02 C-15, 판의 antiBribery: true 있음, false 없음). 상대방 양식과 판 기록이 없으면 붙이지 않음
  function templateMark() {
    const x = C.templateOf(c);
    if (!x || x.own || !x.v || typeof x.v.antiBribery !== 'boolean') return '';
    return x.v.antiBribery ? ', 반부패 조항 있음' : ', 반부패 조항 없음';
  }
  function antiBribeHtml() {
    if (!legalNote) return '';
    const h = legalApproval();
    const need = abRequired ? '간접, 조달 계약이라 꼭 고름' : '직접 계약이라 골라도 되고 안 골라도 됨';
    const v = h ? (antiBribeText(h) ? esc(antiBribeText(h)) : abRequired ? '기록 없음' : '고르지 않음 (' + need + ')')
      : '<span class="check-wait">④ 법무가 승인할 때 고릅니다 (' + need + ')</span>';
    return '<p class="check-note">반부패 조항 (④ 법무 판단): ' + v + '</p>';
  }

  /* 재무 의견 (기획자 결정 2026-11-02 B-6, G-07, REQ-CHK-08): 결재선 밖. 재무(담당자, 리더, 임원)가 2단계 계약 검토 중이나 ⑥ 인장 날인 전까지 덧붙임
   *   남긴 의견은 고치거나 지우지 않고 누가, 언제, 몇 차 기안에 남겼는지 함께 보임. ②~④는 여기서 보고, ⑩은 확인 창에서도 봄
   *   남길 수 있는지는 C.canWriteFinOpinion(재무가 볼 수 있는 계약, 그 때). 남겨도 결재 차례와 상태는 바뀌지 않음
   *   재무 이메일(4번 예)이 이 자리(review.html?id=번호#fin-opinion)로 이어짐 */
  function finOpsHtml(list) {
    return '<ul class="fin-ops">' + list.map(function (o) {
      return '<li><p class="fin-op-meta">' + C.fmtDateTime(o.at) + ', ' + esc(C.ownerLabel(o.by, o.dept)) + ', ' + (o.round || 1) + '차 기안</p>' +
        '<p class="fin-op-text">' + esc(o.text) + '</p></li>';
    }).join('') + '</ul>';
  }
  function renderFinOpinion() {
    const list = c.finOpinions || [];
    const can = C.canWriteFinOpinion(c, me);
    // 기획자 결정 2026-11-02 B-6: 재무 의견은 ⑥ 날인과 체결이 있는 계약(신규, 변경, 바꿔서 연장)에만. 해지, 그대로 연장, 운영 변경은 칸을 두지 않음
    //   앞서 남긴 의견이 있으면(이 규칙 전 시연 기록) 지우지 않고 목록만 보임. #doc을 보이기 전에 정해 화면이 흔들리지 않음
    const off = short || change;
    $('#fin-opinion').hidden = off && !list.length;
    if (off) {
      $('#fin-opinion').innerHTML = list.length ? '<h3 class="box-subtitle">재무 의견</h3>' + finOpsHtml(list) : '';
      return;
    }
    $('#fin-opinion').innerHTML = '<h3 class="box-subtitle">재무 의견</h3>' +
      '<p class="section-desc">결재선 밖에서 재무(담당자, 리더, 임원)가 체결 전에 남기는 의견입니다. 2단계 계약 검토 중이나 ⑥ 인장 날인 전까지 남기고, 남긴 의견은 고치거나 지우지 않습니다. 결재 차례와는 상관없습니다.</p>' +
      (list.length ? finOpsHtml(list) : '<p class="recent-empty">남긴 재무 의견이 없습니다.</p>') +
      (can ? '<div class="note-form fin-op-form"><div class="field" id="fin-op-field"><label class="field-label" for="fin-op-text">재무 의견 남기기</label>' +
          '<textarea class="textarea textarea--sm" id="fin-op-text" aria-describedby="fin-op-help fin-op-error"></textarea>' +
          '<p class="field-help" id="fin-op-help">남기면 고치거나 지울 수 없습니다. 이 계약의 결재자와 ⑩ 재무 확인 담당자가 봅니다.</p>' +
          '<p class="field-error" id="fin-op-error" hidden></p></div>' +
          '<div class="note-actions"><button type="button" class="btn btn--primary btn--md" id="fin-op-save">의견 남기기</button></div></div>'
        : me.base === 'FINANCE' ? '<p class="recent-empty">지금은 남길 수 없습니다. 2단계 계약 검토 중이나 ⑥ 인장 날인 전까지 남깁니다.</p>' : '');
  }
  $('#fin-opinion').addEventListener('click', function (e) {
    if (!e.target.closest('#fin-op-save')) return;
    const ta = $('#fin-op-text'), text = ta.value.trim();
    if (!text) { C.setFieldError($('#fin-op-field'), '의견을 적어 주세요.'); ta.focus(); return; }
    if (!C.canWriteFinOpinion(c, me)) return;
    C.addFinOpinion(c, text, me);
    renderFinOpinion();
    C.toast('재무 의견을 남겼습니다.');
    if ($('#fin-op-text')) $('#fin-op-text').focus();
  });

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
      return '<li' + (now ? '' : ' class="is-old"') + '><span class="file-info">' + C.badge('line', g.label || D.FILE_KINDS[g.kind]) +
        (g.kind === 'QUOTE' && quote ? ' ' + C.badge('line', '계약서 대신') : '') + // B-5(REQ-REG-25): 체결 문서가 될 최종 견적서
        (versioned ? ' ' + C.badge(now ? 'progress' : 'neutral', '판 ' + v.no) : '') +
        (v.approved ? ' ' + C.badge('success', '결재한 판') : '') + (v.checked ? ' ' + C.badge('success', '확인한 ' + DOC) : '') +
        ' <span class="file-name">' + esc(v.name) + '</span>' +
        '<span class="file-size">' + fmtSize(v.size) + ', ' + C.fmtDateTime(v.at) + ' ' + esc(C.ownerLabel(v.by)) + ' 올림(' + esc(v.why) + '), 지문 ' + v.hash + '</span></span>' +
        acts + '</li>';
    }
    $('#files').innerHTML = files().map(function (g) {
      // 체결본은 지금 차수에서 올린 판만 지금 판. 앞 차수의 판만 있으면(⑧ 반려 뒤 다시 기안, ⑦ 전) 모두 이전 판으로 접음 (v0.61 검토)
      const vs = g.versions, cur = g.kind !== 'SIGNED' || vs[vs.length - 1].current;
      const now = cur ? vs[vs.length - 1] : null, old = (cur ? vs.slice(0, -1) : vs.slice()).reverse();
      return (now ? line(g, now, true) : '') + (old.length ? '<li class="file-older"><details><summary>' + esc(g.label || D.FILE_KINDS[g.kind]) + ' 이전 판 ' + old.length + '개</summary>' +
        '<ul class="doc-files">' + old.map(function (v) { return line(g, v, false); }).join('') + '</ul></details></li>' : '');
    }).join('');
    $('#memo').textContent = detail.memo || '없음';
  }

  function renderHistory() {
    // 지금 차수의 기안 줄을 더해 일시 순서로. 앞 차수의 기안은 다시 기안할 때 결재 기록에 남김 (v0.58)
    const rows = [{ at: c.requestedAt, step: 'S01', action: 'SUBMIT', actorId: c.requesterId, comment: '', round: c.round || 1 }].concat(c.history || [])
      .sort(function (a, b) { return (a.at || '').slice(0, 16).localeCompare((b.at || '').slice(0, 16)) || (a.round || 1) - (b.round || 1); }); // 분 단위로, 같은 때면 앞 차수 먼저
    $('#history').innerHTML =
      '<caption class="sr-only">결재 기록: 일시, 차수, 단계, 한 일, 처리한 사람, 의견</caption>' +
      '<thead><tr><th scope="col">일시</th><th scope="col">차수</th><th scope="col">단계</th><th scope="col">한 일</th><th scope="col">처리한 사람</th><th scope="col" class="col-phone-wide">의견, 사유</th></tr></thead>' +
      '<tbody>' + rows.map(function (h) {
        const a = D.APPROVAL_ACTIONS[h.action];
        // 대신 처리한 기록: 대리 지정이면 "대리 지정"과 근거, 최고관리자 시연이면 "시연"
        // 그때 조직: 기록에 남은 이름(actorDept). 예시 데이터처럼 없으면 지금 조직 (v0.31)
        const dept = h.actorDept || (D.USERS[h.actorId] || {}).dept || '';
        const who = esc(C.ownerLabel(h.actorId, dept)) + (h.onBehalfOf ? ' <span class="behalf">(' + esc(C.ownerLabel(h.onBehalfOf)) + ' 대신, ' + (h.delegationId ? '대리 지정' : '시연') + ')</span>' : '');
        // 체결본 등록은 올린 파일 이름도 함께
        // 결재자가 그때 본 판 (v0.53): 계약 검토(②~⑤)는 계약서 초안, ⑧ 체결본 확인은 체결본
        //   계약 검토 단계는 ③ 영업 임원 승인(S03C, 2026-11-02 E-3)도 포함. 견적서로 대신한 계약의 ⑧은 최종 견적서(B-5)
        const seenKind = C.isReviewStep(h.step) && h.action !== 'RESUBMIT' ? 'DRAFT_DOC' : h.step === 'S08' ? 'SIGNED' : '';
        const seen = seenKind ? versionAt(seenKind, h.at) : null;
        // 기획자 결정 2026-11-02: 결재 창에서 받은 값도 기록 칸에 보임. ⑦ 서명본 체결일, ⑨ 실제 개통일(B-8), ② 그때 같은 거래처 최근 계약 건수(E-2)
        const extra = [seen ? '본 판: ' + (seenKind === 'SIGNED' ? DOC : D.FILE_KINDS[seenKind]) + ' 판 ' + seen.no + '(지문 ' + seen.hash + ')' : '',
          h.fileName ? '파일: ' + esc(h.fileName) : '', h.signDate ? SIGN_DAY + ': ' + C.fmtDate(h.signDate) : '', h.openDate ? '실제 개통일: ' + C.fmtDate(h.openDate) : '',
          h.recentSame != null ? '그때 같은 거래처 최근 계약: ' + h.recentSame + '건' : '', h.basis ? '대리 근거: ' + esc(h.basis) : '',
          h.action === 'RESUBMIT' ? (h.restart ? '금액이나 체크리스트 답을 바꿔 계약 검토를 처음부터 다시' : '요청한 단계부터 이어서 결재') : ''].filter(Boolean);
        const note = (h.comment ? esc(h.comment) : '') + (extra.length ? (h.comment ? '<br>' : '') + '<span class="behalf">' + extra.join('<br>') + '</span>' : '');
        return '<tr><td class="num-left">' + C.fmtDateTime(h.at).split(' ').map(function (x) { return '<span class="keep">' + x + '</span>'; }).join(' ') + '</td><td class="num">' + (h.round || 1) + '차</td>' +
          '<td class="nowrap">' + esc(C.stepTag(h.step, c)) + '</td>' + // 결재란 머리글과 같은 맡는 사람 이름 (D-3, 2026-11-02)
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
    if (action === 'REGISTER' && quote) return '견적서 등록'; // 기획자 결정 2026-11-02 B-5 (결재 기록의 이름 C.actionLabel과 같게)
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
      // ⑧ 반려는 어긋난 항목을 하나 이상 고름(코드로 남아 항목별로 셈, v0.61 표준 대응표 G-06)
      reasons: code === 'S08' ? D.SIGNED_MISMATCH : null, reasonsLegend: '어긋난 항목 (하나 이상)', reasonsPrefix: '어긋난 항목', reasonsKey: 'mismatch',
      desc: code === 'S08' ? '계약 내용이 승인본과 다를 때 씁니다. 서명이나 날인만 빠졌으면 반려하지 않고 다시 등록 요청을 씁니다. 반려하면 기안자에게 돌아가고, 기안자가 보완해 다음 차수로 다시 기안해 결재를 처음부터 받습니다.'
        : code === 'S06' ? '계약서 실물이 이 문서와 다를 때 씁니다. 반려하면 기안자에게 돌아가고, 기안자가 보완해 다음 차수로 다시 기안합니다.'
        : '반려하면 기안자에게 돌아가고, 기안자가 보완해 다음 차수로 다시 기안합니다.' };
    // 보완 요청은 보완할 항목을 하나 이상 고름(코드로 남아 통계에서 셈, v0.63 표준 대응표 G-05)
    if (action === 'SUPPLEMENT') return { title: '보완을 요청할까요?', label: '보완할 내용 (필수)', btn: '보완 요청', required: true, tone: 'secondary',
      reasons: D.SUPPLEMENT_ITEMS, reasonsLegend: '보완할 항목 (하나 이상)', reasonsPrefix: '보완할 항목', reasonsKey: 'supplementItems',
      desc: '요청하면 기안자에게 돌아갑니다. 기안자가 고치면 이 단계부터 이어서 결재하고, 금액이나 체크리스트 답이 바뀌면 계약 검토를 처음부터 다시 받습니다.' };
    if (action === 'RESUBMIT') return { title: '보완을 마쳤나요?', label: '고친 내용 (필수)', btn: '보완 완료', required: true, tone: 'primary', restart: true,
      desc: '보완 완료를 누르면 ' + D.STEPS[c.supplement.step].no + '부터 이어서 결재합니다. 실제 시스템에서는 계약 등록 화면에서 고친 뒤 누릅니다.' };
    // 견적서로 대신한 계약은 ⑦ ⑧ 창의 문서 이름이 최종 견적서(기획자 결정 2026-11-02 B-5)
    if (action === 'RETURN') return { title: C.josa(DOC, '을', '를') + ' 다시 올려 달라고 할까요?', label: '요청 사유 (필수)', btn: '다시 등록 요청', required: true, tone: 'secondary',
      desc: '오탈자나 스캔 문제, 서명이나 날인 빠짐처럼 계약 내용은 같을 때 씁니다. 영업이 ' + C.josa(DOC, '을', '를') + ' 다시 올리면 다시 확인합니다.' };
    // ⑦: 기획자 결정 2026-11-02 B-8 서명본 체결일(견적서는 고객 날인일)을 꼭 받음. 오늘보다 뒤 날짜는 받지 않음.
    //   ⑧에서 다시 등록 요청을 받아 다시 올릴 때는 앞서 적은 날을 미리 채움(다시 스캔해도 서명한 날은 같음)
    if (action === 'REGISTER') {
      const prev = (c.history || []).filter(function (h) { return h.step === 'S07' && h.action === 'REGISTER' && (h.round || 1) === round && h.signDate; }).pop();
      return { title: C.josa(DOC, '을', '를') + ' 등록할까요?', label: '메모 (선택)', btn: quote ? '견적서 등록' : '체결본 등록', required: false, tone: 'primary', file: true,
        fileLabel: C.signDocLabel(c) + ' 파일 (필수)', // B-5: "고객 날인 최종 견적서 파일 (필수)" 또는 "체결본 파일 (필수)"
        desc: quote ? '등록하면 영업지원이 결재한 견적과 같은지 확인합니다. 등록한 견적서는 고치거나 지울 수 없습니다.'
          : '등록하면 영업지원이 승인된 내용과 같은지 확인합니다. 등록한 체결본은 고치거나 지울 수 없습니다.',
        date: { key: 'signDate', label: SIGN_DAY + ' (필수)', max: D.TODAY, value: prev ? prev.signDate : '',
          help: (quote ? '견적서에 고객이 날인하거나 서명한 날' : '서명본에 적힌 계약 체결일(양쪽 서명이 끝난 날)') + '. 오늘(' + C.fmtDate(D.TODAY) + ')보다 뒤일 수 없습니다.' },
        // 계약서 밖 약속 없음 확인(v0.61, 표준 대응표 G-06). 결재 기록에 "확인: ..."으로 남음
        legend: '기안한 영업의 확인 (필수)', checks: [D.SIDE_DEAL_CHECK.S07] };
    }
    // ④ 표준계약서를 바꾼 계약: 기획자 결정 2026-11-02 C-15 반부패 조항 판단(간접, 조달은 필수, 직접은 선택). 없음이면 사유 필수
    if (code === 'S04' && legalNote) return { title: '승인할까요?', label: '바꾼 조항과 판단 (필수)', btn: '승인', required: true, tone: 'primary',
      desc: '승인하면 다음 단계로 넘어갑니다. 표준계약서를 바꾼 계약이라 바꾼 조항과 받아들인 판단을 꼭 적습니다(조항 대비표 참고).',
      // 기준 판의 반부패 조항 표시를 함께 보여 줌(C-15): 바꾼 조항이 그 조항을 빼거나 약하게 했는지 판단할 때 씀
      info: C.templateLabel(c) === '-' ? '' : (C.templateOf(c) || {}).own ? '상대방 양식이라 기준 표준계약서가 없습니다. 계약서에 반부패 조항이 있는지 직접 확인해 주세요.'
        : '기준 표준계약서: <strong>' + esc(C.templateLabel(c) + templateMark()) + '</strong>. 바꾼 조항이 이 조항을 빼거나 약하게 하지 않았는지 봐 주세요.',
      antiBribe: { required: abRequired } };
    // ② 체크리스트 검토는 확인한 항목을 모두 표시(⑥, ⑧처럼 결재 기록에 "확인: ...", v0.63 표준 대응표 G-05)
    //   기획자 결정 2026-11-02 E-2: 같은 거래처 최근 계약이 있으면(볼 수 없는 열람 제한 계약 포함) "나눠 맺은 계약이 아님"도 꼭 표시
    if (code === 'S02') return { title: '승인할까요?', label: '의견 (선택)', btn: '승인', required: false, tone: 'primary',
      desc: '승인하면 다음 단계로 넘어갑니다.', legend: '체크리스트 검토에서 확인한 항목 (모두 확인)',
      checks: D.REVIEW_CHECKS.concat(recentCount ? [D.SPLIT_CHECK] : []),
      info: recentCount ? '<strong>같은 거래처 최근 계약 ' + recentCount + '건</strong>' + (recent.hidden ? '(볼 수 없는 열람 제한 계약 ' + recent.hidden + '건 포함)' : '') +
        '이 있습니다. 기본 정보 아래 상자를 보고 금액을 나눠 맺은 계약이 아닌지 확인해 주세요.' : '',
      record: recent.on ? { recentSame: recentCount } : null };
    // ③ 영업 리더와 ③ 영업 임원 승인: 기획자 결정 2026-11-02 C-14 "이해관계 없음" 확인(필수). 결재 기록에 "확인: ..."과 noInterest
    //   이해관계가 있으면 알릴 곳은 관리자(이 창을 보는 사람이 리더나 임원이라 "리더에게"는 자기 자신. 대리 지정은 관리자가 함, REQ-REV-08)
    if (code === 'S03' || code === 'S03C') return { title: '승인할까요?', label: '의견 (선택)', btn: '승인', required: false, tone: 'primary',
      desc: '승인하면 다음 단계로 넘어갑니다. 이 거래처와 개인적 이해관계(가족, 친척, 지분, 따로 받는 이익 등)가 있으면 승인하지 말고 관리자에게 알려 주세요.',
      legend: '결재자 확인 (필수)', checks: [D.INTEREST_CHECK], record: { noInterest: true } };
    if (C.isReviewStep(code)) return { title: '승인할까요?', label: '의견 (선택)', btn: '승인', required: false, tone: 'primary',
      desc: '승인하면 다음 단계로 넘어갑니다.' };
    const acc = c.checklist && c.checklist.accounting === 'YES';
    // ⑨ 확인 항목: 계약, 해지, 그대로 연장마다 다름 (common.js opsChecksFor)
    const ops = C.opsChecksFor(c);
    return {
      S06: { title: '날인 완료로 처리할까요?', label: '메모 (선택)', btn: '날인 완료', required: false, tone: 'primary',
        desc: (quote ? '처리하면 영업이 고객 날인을 받아 최종 견적서를 올릴 차례가 됩니다. ' : '처리하면 영업이 상대방 서명을 받아 체결본을 올릴 차례가 됩니다. ') + // B-5
          '인장 사용 기록은 기존 구글 폼에 따로 남겨 주세요.',
        legend: '계약서 실물과 같은지 확인한 항목 (모두 확인)', checks: D.SEAL_CHECKS },
      S08: { title: (quote ? '견적서' : '체결본') + ' 확인을 완료할까요?', label: '메모 (선택)', btn: '확인 완료', required: false, tone: 'primary',
        desc: '완료하면 운영 검토로 넘어가 고객지원이 운영에 적용할 차례가 됩니다.',
        // 체결본을 승인된 내용과 항목별로 맞춰 봄(⑥처럼, v0.61 표준 대응표 G-06. 예전에는 일반 항목 두 줄)과 계약서 밖 약정 없음
        //   기획자 결정 2026-11-02: 견적서로 대신한 계약은 견적서 항목(B-5), ⑦에서 적은 서명본 체결일이 문서와 같은지(B-8)도. 모두 C.signedChecks
        legend: DOC + '에서 확인한 항목 (모두 확인)', checks: C.signedChecks(c),
        info: C.signedDate(c) ? '⑦에서 적은 ' + SIGN_DAY + ': <strong>' + C.fmtDate(C.signedDate(c)) + '</strong> (올린 날 ' + C.fmtDate(c.signedAt) + ')' : '' },
      // ⑨: 기획자 결정 2026-11-02 B-8 날인과 체결본을 거치는 계약은 실제 개통일을 꼭 받음. 계약 시작일에 맞춰 열도록 설정한 경우가 있어 뒤 날짜도 받음 [가정]
      S09: { title: change ? '운영 변경을 완료할까요?' : isTerm ? '운영 종료를 완료할까요?' : c.renewMode === 'AUTO' ? '기간 연장을 완료할까요?' : '운영 적용을 완료할까요?',
        label: '메모 (선택)', btn: S09_BTN, required: false, tone: 'primary',
        // 기획자 결정 2026-11-02 B-3(추천과 다름): 운영 변경도 ⑨ 다음 ⑩ 재무 확인. 묶음에 반영되는 것은 ⑩까지 끝난 뒤
        desc: change ? '완료하면 ' + C.stepTag('S10', c) + ' 확인 차례가 됩니다. 재무 확인까지 끝나면 ' +
            (c.changeType === 'PERIOD' ? '계약 묶음의 계약 기간이 새 종료일로 바뀝니다.' : '충전 내역이 계약 묶음에 남습니다.')
          : '완료하면 재무 확인 차례가 됩니다.', legend: '서비스에 한 일 (모두 확인)', checks: ops,
        date: signs ? { key: 'openDate', label: '실제 개통일 (필수)', value: '',
          help: '고객이 서비스를 쓸 수 있게 된 날(라이선스나 도메인을 연 날). 계약 시작일(' + C.fmtDate(detail.startDate) + ')에 맞춰 열도록 설정했으면 그날을 적습니다.' } : null },
      // ⑩: 기획자 결정 2026-11-02 B-6 체크리스트 4번 조건의 종류와 체결 전에 남긴 재무 의견도 창에서 봄
      S10: { title: '재무 확인을 완료할까요?', label: '메모 (선택)', btn: '재무 확인 완료', required: false, tone: 'primary',
        // B-3: 운영 변경은 완료하면 계약 완료. 기간 변경은 그때 묶음의 계약 기간이 바뀜
        desc: change ? '완료하면 운영 변경이 끝나 계약 완료가 됩니다. ' + (c.changeType === 'PERIOD' ? '계약 묶음의 계약 기간이 새 종료일(' + C.fmtDate(c.endDate) + ')로 바뀝니다.' : '충전 내역이 계약 묶음에 남습니다.')
          : isTerm ? '완료하면 해지가 끝나 원계약이 해지 상태가 됩니다. 환불과 위약금: ' + (c.refundNote || '없음')
          : c.renewMode === 'AUTO' ? '완료하면 연장이 끝나 새 계약 기간(' + C.fmtPeriod(c.startDate, c.endDate) + ')이 적용됩니다.'
          : '완료하면 계약 완료로 보관함에 들어갑니다. ' + (acc
            ? '체크리스트 4번 회계 영향 조건' + (acctKindsText(c.checklist) ? '(' + acctKindsText(c.checklist) + ')' : '') + ': ' + (c.checklist.accountingNote || '비고 없음')
            : '체크리스트 4번 회계 영향 조건은 없습니다.'),
        // 운영 변경(B-3)은 체결 전 재무 의견이 없는 결재라 변경 내용을 보임. 그 밖에는 체결 전에 남긴 재무 의견(B-6)
        //   기획자 결정 2026-11-02 B-6: 해지와 그대로 연장도 재무 의견을 받지 않아 "없습니다" 안내를 두지 않음(앞서 남긴 의견이 있으면 그 목록)
        info: change ? '<strong>' + esc(D.CHANGE_TYPES[c.changeType]) + '</strong>: ' + (c.changeType === 'PERIOD'
            ? C.fmtDate(c.oldEndDate) + ' 종료 → ' + C.fmtDate(c.endDate) + ' 종료'
            : num(c.changeQty) + '건' + (c.changeAmount ? ', ' + won(c.changeAmount) + ' (부가세 별도)' : ' (무상)')) +
            ((c.finOpinions || []).length ? '<br><strong>재무 의견 ' + c.finOpinions.length + '건</strong>' + finOpsHtml(c.finOpinions) : '')
          : short ? ((c.finOpinions || []).length ? '<strong>재무 의견 ' + c.finOpinions.length + '건</strong>' + finOpsHtml(c.finOpinions) : '')
          : '<strong>재무 의견 ' + (c.finOpinions || []).length + '건</strong>' +
          ((c.finOpinions || []).length ? finOpsHtml(c.finOpinions) : '<br>체결 전에 남긴 재무 의견이 없습니다.') },
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
    // 창 안의 회색 안내(기획자 결정 2026-11-02): ② 같은 거래처 최근 계약 건수(E-2), ⑧ ⑦에서 적은 서명본 체결일(B-8), ⑩ 재무 의견(B-6)
    if (t.info) extra += '<div class="act-info">' + t.info + '</div>';
    if (t.checks) {
      extra += '<fieldset class="field act-checks" id="act-checks"><legend class="field-label">' + esc(t.legend) + '</legend>' +
        t.checks.map(function (x) { return '<label class="choice"><input type="checkbox" value="' + esc(x) + '">' + esc(x) + '</label>'; }).join('') +
        '<p class="field-error" id="act-checks-error" hidden></p></fieldset>';
    }
    if (t.reasons) {
      extra += '<fieldset class="field act-checks" id="act-reasons"><legend class="field-label">' + esc(t.reasonsLegend) + '</legend>' +
        t.reasons.map(function (x) { return '<label class="choice"><input type="checkbox" value="' + esc(x.code) + '">' + esc(x.label) + '</label>'; }).join('') +
        '<p class="field-error" id="act-reasons-error" hidden></p></fieldset>';
    }
    if (t.restart) {
      extra += '<div class="field"><label class="choice"><input type="checkbox" id="act-restart">금액이나 체크리스트 답을 바꿨습니다 (계약 검토를 ② 체크리스트 검토부터 다시 받습니다)</label></div>';
    }
    if (t.file) {
      extra += '<div class="field act-file" id="act-file"><label class="field-label" for="act-file-input">' + esc(t.fileLabel || '체결본 파일 (필수)') + '</label>' +
        '<input type="file" id="act-file-input" accept=".pdf,.jpg,.jpeg,.png" aria-describedby="act-file-error">' +
        '<p class="field-help">PDF, JPG, PNG, 50MB 이하. 프로토타입은 파일 이름만 남기고 실제로 올리지 않습니다. ' +
        '<button type="button" class="btn-text" id="act-demo-file">예시 파일 고르기 (시연)</button></p>' +
        '<p class="act-file-name" id="act-file-name" aria-live="polite"></p><p class="field-error" id="act-file-error" hidden></p></div>';
    }
    // 날짜 칸(기획자 결정 2026-11-02 B-8): ⑦ 서명본 체결일, ⑨ 실제 개통일. 달력 단추는 common.js가 붙임(input type=date)
    if (t.date) {
      extra += '<div class="field act-date" id="act-date-field"><label class="field-label" for="act-date">' + esc(t.date.label) + '</label>' +
        '<input class="input" type="date" id="act-date" value="' + esc(t.date.value || '') + '"' + (t.date.max ? ' max="' + t.date.max + '"' : '') + ' aria-describedby="act-date-help act-date-error">' +
        '<p class="field-help" id="act-date-help">' + esc(t.date.help) + '</p><p class="field-error" id="act-date-error" hidden></p></div>';
    }
    // 반부패 조항 판단(기획자 결정 2026-11-02 C-15): 간접, 조달은 둘 중 하나를 꼭 고름. 직접은 "이번에는 고르지 않음"이 처음 값
    //   사유 칸은 늘 자리를 두고(창이 흔들리지 않게) "없음"을 고를 때만 쓸 수 있음
    if (t.antiBribe) {
      const opts = D.ANTI_BRIBE.options.concat(t.antiBribe.required ? [] : [{ code: '', label: '이번에는 고르지 않음' }]);
      extra += '<fieldset class="field act-checks" id="act-ab"><legend class="field-label">반부패 조항 (' + (t.antiBribe.required ? '필수, 간접과 조달 계약' : '선택, 직접 계약') + ')</legend>' +
        opts.map(function (o) {
          return '<label class="choice"><input type="radio" name="act-ab" value="' + o.code + '"' + (!o.code ? ' checked' : '') + '>' + esc(o.label) + '</label>';
        }).join('') +
        '<p class="field-error" id="act-ab-error" hidden></p></fieldset>' +
        '<div class="field act-ab-note" id="act-ab-note-field"><label class="field-label" for="act-ab-note">반부패 조항이 없는 사유 (없음을 고르면 필수)</label>' +
        '<textarea class="textarea textarea--sm" id="act-ab-note" disabled aria-describedby="act-ab-note-error"></textarea>' +
        '<p class="field-error" id="act-ab-note-error" hidden></p></div>';
    }
    $('#act-extra').innerHTML = extra;
    // 확인 묶음과 파일 칸의 오류 문장을 화면낭독기가 함께 읽게 이음(KRDS 오류 패턴, v0.61 검토)
    [['act-checks', 'act-checks-error'], ['act-reasons', 'act-reasons-error'], ['act-file', 'act-file-error'], ['act-ab', 'act-ab-error']].forEach(function (x) {
      const el = document.getElementById(x[0]);
      if (el) el.setAttribute('aria-describedby', x[1]);
    });
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
    // 반부패 조항 "없음"을 고를 때만 사유 칸을 씀(기획자 결정 2026-11-02 C-15). 다른 것을 고르면 적던 사유와 오류를 지움
    if (e.target.name === 'act-ab') {
      const note = $('#act-ab-note'), none = e.target.value === 'NONE';
      note.disabled = !none;
      if (!none) { note.value = ''; C.setFieldError($('#act-ab-note-field'), ''); }
      showError('#act-ab-error', '#act-ab', '');
      return;
    }
    if (e.target.id !== 'act-file-input') return;
    const f = e.target.files[0];
    if (f && f.size > 50 * 1048576) { setFile(''); showError('#act-file-error', '#act-file', '50MB 이하 파일만 올릴 수 있습니다.'); return; }
    // 체결본 형식도 안내대로 PDF, JPG, PNG만 (REQ-SIGN-04, v0.63 검토: 크기만 확인했음)
    if (f && !/\.(pdf|jpe?g|png)$/i.test(f.name)) { setFile(''); showError('#act-file-error', '#act-file', 'PDF, JPG, PNG 파일만 올릴 수 있습니다.'); return; }
    setFile(f ? f.name : '');
  });
  function closeModal() { modal.hidden = true; pending = null; if (lastFocus) lastFocus.focus(); }
  // 처리했을 때 안내 (다음 화면에 한 번)
  const DONE_MSG = {
    APPROVE: '승인했습니다.', REJECT: '반려했습니다. 기안자에게 돌아갑니다.', CANCEL: '승인을 취소했습니다.',
    REGISTER: C.josa(DOC, '을', '를') + ' 등록했습니다.', RETURN: C.josa(DOC, '을', '를') + ' 다시 올려 달라고 요청했습니다.', // B-5 견적서면 최종 견적서
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
    // 고른 코드: ⑧ 반려의 어긋난 항목(mismatch) 또는 보완 요청의 보완할 항목(supplementItems)
    let picked = null;
    if (t.reasons) {
      picked = Array.prototype.slice.call(modal.querySelectorAll('#act-reasons input:checked')).map(function (b) { return b.value; });
      showError('#act-reasons-error', '#act-reasons', picked.length ? '' : C.josa(t.reasonsLegend.replace(' (하나 이상)', ''), '을', '를') + ' 하나 이상 고르세요.');
      if (!picked.length) ok = false;
    }
    if (t.file && !fileName) { showError('#act-file-error', '#act-file', (quote ? '최종 견적서' : '체결본') + ' 파일을 고르세요.'); ok = false; }
    // 날짜(기획자 결정 2026-11-02 B-8): 꼭 적음. ⑦ 서명본 체결일은 오늘보다 뒤일 수 없음. 없는 날짜는 칸이 빈 값으로 돌려줌
    let dateVal = '';
    if (t.date) {
      const el = $('#act-date');
      dateVal = el.value;
      const raw = String(Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').get.call(el) || '').trim(); // 적은 글자 그대로
      const msg = !dateVal ? (raw ? '없는 날짜입니다. 월과 일을 다시 확인하세요.' : t.date.label.replace(' (필수)', '') + '을 적어 주세요. 예: ' + C.fmtDate(D.TODAY))
        : t.date.max && dateVal > t.date.max ? '오늘(' + C.fmtDate(t.date.max) + ')보다 뒤 날짜는 적을 수 없습니다.' : '';
      C.setFieldError($('#act-date-field'), msg);
      if (msg) ok = false;
    }
    // 반부패 조항(기획자 결정 2026-11-02 C-15): 간접, 조달은 꼭 고름. "없음"이면 사유를 꼭 적음
    let ab = '', abNote = '';
    if (t.antiBribe) {
      const r = modal.querySelector('input[name="act-ab"]:checked');
      ab = r ? r.value : '';
      showError('#act-ab-error', '#act-ab', t.antiBribe.required && !ab ? '간접, 조달 계약이라 반부패 조항 판단을 꼭 골라 주세요.' : '');
      if (t.antiBribe.required && !ab) ok = false;
      abNote = $('#act-ab-note').value.trim();
      const noteMsg = ab === 'NONE' && !abNote ? '반부패 조항이 없는 사유를 적어 주세요.' : '';
      C.setFieldError($('#act-ab-note-field'), noteMsg);
      if (noteMsg) ok = false;
    }
    if (t.required && !memo) {
      // 받침에 따라 "을"과 "를" (예: 반려 사유를, 보완할 내용을)
      const word = t.label.replace(' (필수)', '');
      const code = word.charCodeAt(word.length - 1) - 0xAC00;
      $('#act-error').innerHTML = C.icon('alert', 'sm') + esc(word) + (code >= 0 && code < 11172 && code % 28 ? '을' : '를') + ' 적어 주세요.';
      $('#act-error').hidden = false;
      $('#act-field').classList.add('is-invalid');
      $('#act-comment').setAttribute('aria-invalid', 'true');
      ok = false;
    } else {
      // 적은 뒤 다시 누르면 앞 오류를 지움(다른 칸 오류로 창이 닫히지 않을 때도 맞는 칸은 오류가 없어 보이게, v0.63 검토)
      $('#act-error').hidden = true;
      $('#act-field').classList.remove('is-invalid');
      $('#act-comment').removeAttribute('aria-invalid');
    }
    if (!ok) { const bad = modal.querySelector('.is-invalid input, .is-invalid textarea'); if (bad) bad.focus(); return; }
    const s = pending.step;
    const pickedText = picked ? t.reasonsPrefix + ': ' + picked.map(function (k) { return t.reasons.filter(function (x) { return x.code === k; })[0].label; }).join(', ') : '';
    // 반부패 조항 판단은 의견 문장에도 남김(계약 요약서 등 의견만 보이는 화면에서도 보이게, 기획자 결정 2026-11-02 C-15)
    const abOpt = ab ? D.ANTI_BRIBE.options.filter(function (x) { return x.code === ab; })[0] : null;
    const abText = abOpt ? '반부패 조항: ' + abOpt.label.replace('반부패 조항 ', '') + (ab === 'NONE' ? '(사유: ' + abNote + ')' : '') : '';
    const comment = [t.checks ? '확인: ' + t.checks.join(', ') : '', pickedText, abText, memo].filter(Boolean).join('. ');
    const restart = t.restart && $('#act-restart') && $('#act-restart').checked;
    // 결재 기록에 덧붙이는 칸: 체결본 파일 이름(fileName), 처음부터 다시(restart), ⑧ 반려의 mismatch 또는 보완 요청의 supplementItems 코드
    //   기획자 결정 2026-11-02: ⑦ signDate, ⑨ openDate(B-8), ④ antiBribe와 antiBribeNote(C-15), ③ noInterest(C-14), ② recentSame(E-2, 그때 상자의 건수)
    const extra = Object.assign({},
      t.file ? { fileName: fileName } : null, restart ? { restart: true } : null, picked ? { [t.reasonsKey]: picked } : null,
      t.date ? { [t.date.key]: dateVal } : null, ab ? { antiBribe: ab, antiBribeNote: ab === 'NONE' ? abNote : '' } : null,
      t.record || null);
    C.recordAction(c, s, pending.action, comment, me, extra);
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
      setFile(c.counterparty + (quote ? '_최종견적서_고객날인' : '_체결본') + (n ? '_' + (n + 1) : '') + '.pdf'); // B-5 견적서면 견적서 이름
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
  renderFinOpinion(); // 기획자 결정 2026-11-02 B-6
  renderFiles();
  renderHistory();
  renderActions();
  $('#doc').hidden = false;
})();
