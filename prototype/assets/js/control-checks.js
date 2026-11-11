/* =====================================================================
 * 점검 화면이 함께 쓰는 자료 (control-checks.js) → window.CLIMB_CTL (화면 코드에서는 X)
 * ---------------------------------------------------------------------
 * 접속 기록 점검(SCR-57), 설정 변경 확인(SCR-65), 통계와 보고서(SCR-46)의 통제 증빙 내보내기가 함께 씁니다.
 * mock-data.js, common.js 다음에 불러옵니다. 화면을 그리지 않고 자료만 만듭니다.
 * 하는 일
 *   1. 접속 기록 만들기(accessLogs): 예시 데이터로 만든 접속 기록. 접속 기록 점검(admin-logs.js)에 있던 것을 옮김
 *      기획자 결정 2026-11-02 C-3: 통제 증빙과 결재 기록 묶음을 꺼낸 일도 "내려받기"로 넣음
 *      점검 화면이 따로 쌓는 기록(할인 예외 점검, 기간 마감 확인, 영업기회 대사, 인장 기록 대조)도 "점검 기록"으로 넣음(2026-11-02)
 *   2. 최고관리자 계정(superIds, 기획자 결정 2026-11-02 C-6): 매월 점검의 "최고관리자 작업"을 따로 모을 때 씀
 *   3. 설정 변경 묶음(settingChanges, 기획자 결정 2026-11-02 C-8): 가격 기준, 제품과 기능, 표준계약서, 결재선 규칙, 회사 설정, 거래처를 바꾼 것 한 건씩
 *      거래처는 2026-11-09 5회차 점검에서 더함(B-11, 05 G-25 ②, CTL-83). 완료 계약이 있는 거래처의 번호 변경만 재무 리더가 확인
 *      완료 계약이 있는 거래처를 합친 것도 재무 리더가 확인(기획자 결정 2026-11-10 22번)
 *      전후 값, 사유, 품의 링크. 결재선 규칙은 근거(사유, 위임전결 근거)와 새로 맡는 사람이 기안자 유닛 밖인지
 *      가격 기준은 같은 때, 같은 사람, 같은 품의로 넣은 줄을 한 건으로 봄 [가정: 한 품의로 여러 기능을 함께 넣기 때문]
 *   4. 설정 변경 확인(checkOf, canConfirm, saveCheck, C-8): 가격과 제품은 재무 리더가 "품의와 맞음, 다름", 표준계약서는 올린 사람이 아닌 법무
 *      완료 계약이 있는 거래처의 번호 변경은 재무 리더가 "맞음, 다름"(2026-11-09 5회차 점검, G-25 ②). 완료 계약이 있는 거래처의 합치기도 같음(기획자 결정 2026-11-10 22번)
 *      최고관리자는 시연으로 확인하되 자기가 바꾼 줄은 못함(C-6). 읽기만 하는 역할(감사 열람)과 컴플라이언스(보기만, 기획자 결정 2026-11-10 16번)는 못함
 *      확인은 관리자 변경 이력의 점검 기록(영역 AUDIT, op.k CONFIG_CHECK)에 쌓기만 함. 한 건에 확인 하나
 *   5. 꺼낸 기록과 파일(C-3): exportsAll(꺼낸 기록), recordExport, sha256Hex(파일 지문), csvLine(CSV 한 줄), download(내려받기)
 *      CSV는 엑셀에서 열리게 맨 앞에 BOM을 붙여 UTF-8로. 실제 시스템은 서버가 파일을 만들고 지문과 꺼낸 기록을 남김
 *   6. 점검 문제를 컴플라이언스에 넘기기(raiseIssue, pendingIssues, issueTask): 매월 점검에서 문제 결과를 남기면 컴플라이언스 담당자의
 *      점검할 일에 올라가고 이메일이 감. 개선 과제로 기록하면 닫힘(기획자 결정 2026-11-09 5회차 13번)
 *      이 파일을 부르는 화면: 개요, 접속 기록 점검, 설정 변경 확인, 통계, 인장 기록 대조, 개선 과제와 보류(할인 예외 점검과 영업기회 대사는 HTML이 부르지 않으면 그 JS가 불러 씀)
 * ===================================================================== */
window.CLIMB_CTL = (function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;

  function uniq(list) { return list.filter(function (x, i, a) { return x && a.indexOf(x) === i; }); }

  /* ---------- 1. 접속 기록 (시연용) ----------
   * 인쇄(PRINT)도 한 일 (03 CODE-LOG-ACTION. v0.63 점검에서 고침: 빠져 있어 거를 수 없었음). 시연에서는 견적서 출력 기록으로 만듦
   * extra: 화면이 더할 줄 [{ at, userId, act, target, place }] (예: 이 화면을 연 것) */
  const ACTS = { LOGIN: '로그인', LOGOUT: '로그아웃', VIEW: '열람', SUBMIT: '기안', APPROVE: '결재', DOWNLOAD: '내려받기', PRINT: '인쇄', NOTE: '사후관리 기록', ADMIN: '설정 변경', AUDIT: '점검 기록' };
  // 기획자 결정 2026-11-02: 회사 설정(E-9), 컴플라이언스(C-13, C-16) 영역도 이름으로
  const AREA = { USER: '사용자 권한', RULE: '결재선 규칙', RESTRICT: '열람 제한', PRICE: '가격 기준', PRODUCT: '제품과 기능', TEMPLATE: '표준계약서', CUSTOMER: '거래처', CODE: '코드', NOTICE: '공지사항',
    COMPANY: '회사 설정', COMPLIANCE: '컴플라이언스' };
  function accessLogs(extra) {
    const out = [];
    const push = function (at, userId, act, target, place) { if (at) out.push({ at: at, userId: userId, act: act, target: target || '-', place: place || '사내망' }); };
    D.ACCOUNTS.forEach(function (a) {
      push(a.firstLoginAt, a.id, 'LOGIN', '첫 접속');
      push(a.lastLoginAt, a.id, 'LOGIN', '');
      push(a.lastLogoutAt, a.id, 'LOGOUT', '');
    });
    D.CONTRACTS.forEach(function (c) {
      if (!c.id) return;
      // 열람 제한 계약은 계약번호만 남김(2026-11-06 점검, REQ-AUTH-09): 고객사 이름이 접속 기록으로 새어 나가 볼 수 없는 사람에게 보였음
      const name = c.restricted ? c.id : c.id + ' ' + c.counterparty;
      push(c.requestedAt, c.requesterId, 'SUBMIT', name);
      (c.history || []).forEach(function (h) {
        // 앞 차수의 기안(다시 기안할 때 결재 기록에 남긴 줄)은 결재가 아니라 기안으로 (v0.61 검토)
        if (h.action === 'SUBMIT') { push(h.at, h.actorId || c.requesterId, 'SUBMIT', name + ' (' + (h.round || 1) + '차)'); return; }
        const st = D.STEPS[h.step];
        push(h.at, h.actorId, 'APPROVE', c.id + ' ' + (st ? st.no : '') + ' ' + C.actionLabel(h, c));
      });
      (c.notes || []).forEach(function (n) { push(n.at, n.by, 'NOTE', c.id + ' ' + (D.AFTERCARE_TYPES[n.type] || '')); });
    });
    D.ADMIN_LOG.forEach(function (e) {
      push(e.at, e.by, e.area === 'AUDIT' ? 'AUDIT' : 'ADMIN', (AREA[e.area] ? AREA[e.area] + ': ' : '') + e.target);
    });
    // 견적서 출력은 접속 기록의 인쇄에도 남음 (03 8-8 quote_issue)
    C.allQuotes().forEach(function (q) { (q.issues || []).forEach(function (i) { push(i.at, i.by, 'PRINT', '견적서 ' + q.no + ' ' + q.ver + '판'); }); });
    // 가격 기준: 변경 이력(가격 기준 관리에서 바꾼 것)에 이미 있는 줄은 빼고 예시 가격 줄만 (v0.58 QA: 두 번 남았음)
    const priceLogged = D.ADMIN_LOG.filter(function (e) { return e.area === 'PRICE'; }).map(function (e) { return e.at + '|' + e.by; });
    D.PRICE_ROWS.forEach(function (r) {
      if (priceLogged.indexOf(r.at + '|' + r.by) > -1) return;
      push(r.at, r.by, 'ADMIN', '가격 기준: ' + C.featureLabel(r) + ' (' + C.fmtDate(r.validFrom) + '부터)'); // 제품과 기능 이름 (v0.49: 가격은 기능마다)
    });
    // 이상 행위 알림이 생긴 접속 (가상의 기록)
    D.SEC_ALERTS.forEach(function (al) {
      push(al.at, al.userId, al.kind === 'BULK' ? 'VIEW' : 'LOGIN', al.detail, al.kind === 'BULK' ? '사내망' : 'VPN');
      if (al.kind === 'BULK') push(al.at.slice(0, 14) + '27', al.userId, 'DOWNLOAD', '첨부 PDF 6건 (워터마크)', '사내망');
    });
    // 기획자 결정 2026-11-02 C-3: 통제 증빙과 결재 기록 묶음을 꺼낸 일
    exportsAll().forEach(function (x) {
      push(x.at, x.by, 'DOWNLOAD', (x.kind === 'BUNDLE' ? '결재 기록 묶음: ' : '통제 증빙: ') + x.cond + ' (' + x.file + ')', '사내망');
    });
    // 기획자 결정 2026-11-02: 관리자 변경 이력 밖에 따로 쌓는 점검 기록도 "점검 기록"으로(접속 기록 조회와 통제 증빙에 함께 나옴)
    //   할인 예외 점검(C-9), 기간 마감 확인(B-9), 영업기회 대사(E-1 ②), 인장 기록 대조(E-7 ③). 계약은 번호만(고객사 이름은 넣지 않음)
    const ym = function (m) { return m ? m.slice(0, 4) + '년 ' + Number(m.slice(5, 7)) + '월' : ''; };
    const DR = { LIMIT: '한계값 정함', ROW: '줄 확인', DONE: '점검 마침' }, OR = { UPLOAD: '파일 올림', NOTE: '줄 의견', CONFIRM: '확인' };
    (D.DISCOUNT_REVIEWS || []).concat(C.loadDemo('discountReviews')).forEach(function (r) {
      push(r.at, r.by, 'AUDIT', '할인 예외 점검: ' + ym(r.month) + ' ' + (DR[r.type] || r.type) + (r.contractId ? ' ' + r.contractId : ''));
    });
    (D.CLOSE_CHECKS || []).concat(C.loadDemo('closeChecks')).forEach(function (r) { push(r.at, r.by, 'AUDIT', '기간 마감 점검: 기간 말 ' + C.fmtDate(r.end) + ' 확인'); });
    (D.OPP_RECON || []).concat(C.loadDemo('oppRecon')).forEach(function (r) { push(r.at, r.by, 'AUDIT', '영업기회 대사: ' + ym(r.month) + ' ' + (OR[r.type] || r.type)); });
    (D.SEAL_RECON || []).concat(C.loadDemo('sealRecon')).forEach(function (r) { push(r.at, r.by, 'AUDIT', '인장 기록 대조: ' + ym(r.month) + ' 대조'); });
    (extra || []).forEach(function (l) { push(l.at, l.userId, l.act, l.target, l.place); });
    return out.sort(function (a, b) { return b.at.localeCompare(a.at); });
  }

  /* ---------- 2. 최고관리자 계정 (기획자 결정 2026-11-02 C-6) ----------
   * 역할에 최고관리자가 있는 모든 계정(사용 중지 포함). 그 계정이 한 일은 매월 점검과 따로 "최고관리자 작업"으로 모아 정보보호 담당자만 점검 */
  function superIds() {
    return D.ACCOUNTS.filter(function (a) { return a.roles.indexOf('SUPER') > -1; }).map(function (a) { return a.id; });
  }

  /* ---------- 3. 설정 변경 묶음 (기획자 결정 2026-11-02 C-8, G-12) ----------
   * 한 건: { id, area, at, by, target, change(전후 값), reason, docUrl, docNo, items(가격 기준의 기능마다 전후), basis, unit, person }
   *   id: 확인을 남길 때 쓰는 번호. 가격 기준 'PRICE:일시|사람|품의 번호', 표준계약서 'TPL:표준계약서:판', 그 밖은 'LOG:일시|사람|대상'
   *   가격 기준은 가격 줄(D.PRICE_ROWS, 가격 기준 관리에서 바꾼 것도 들어 있음), 표준계약서는 판(D.TEMPLATES), 그 밖은 관리자 변경 이력 */
  // 거래처(CUSTOMER)도 넣음(2026-11-09 5회차 점검, 기획자 결정 2026-11-02 B-11, 05 G-25 ②, 06 CTL-83): 정해 두고 시안에 넣지 않아 거래처 추가, 고치기, 합치기를 매월 묶음에서 아무도 보지 않았음
  const AREA_SET = { PRICE: '가격 기준', PRODUCT: '제품과 기능', TEMPLATE: '표준계약서', RULE: '결재선 규칙', COMPANY: '회사 설정', CUSTOMER: '거래처' };
  function pct(n) { return (Math.round((n || 0) * 1000) / 10) + '%'; }
  function priceText(r) { return C.fmtWon(r.listPrice) + '(' + r.unit + '), 한도 ' + pct(r.discountCap); }
  // 같은 기능에서 이 줄보다 먼저 넣은 줄 가운데 적용 시작일이 가장 늦은 것(바꾸기 전 값)
  function prevPrice(r) {
    return D.PRICE_ROWS.filter(function (x) { return x !== r && x.feature === r.feature && x.at < r.at; })
      .sort(function (a, b) { return a.validFrom.localeCompare(b.validFrom) || a.at.localeCompare(b.at); }).pop() || null;
  }
  function make(id, area, at, by, target, change, reason, extra) {
    return Object.assign({ id: id, area: area, at: at, by: by, target: target, change: change || '', reason: reason || '', docUrl: '', docNo: '', items: null, basis: '', unit: '' }, extra || {});
  }
  function priceEvents() {
    const groups = {}, order = [];
    D.PRICE_ROWS.forEach(function (r) {
      const k = r.at + '|' + r.by + '|' + (r.docNo || r.docUrl || '');
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(r);
    });
    return order.map(function (k) {
      const rows = groups[k], r0 = rows[0];
      const items = rows.map(function (r) {
        const p = prevPrice(r);
        return { label: C.featureLabel(r), before: p ? priceText(p) : '', after: priceText(r), from: r.validFrom };
      });
      const fresh = items.filter(function (x) { return !x.before; }).length, one = items[0];
      const change = rows.length === 1
        ? (one.before ? one.before + ' → ' : '처음 넣음: ') + one.after + ' (' + C.fmtDate(one.from) + '부터)'
        : '기능 ' + rows.length + '개: ' + [fresh ? '처음 넣음 ' + fresh + '개' : '', rows.length - fresh ? '바꿈 ' + (rows.length - fresh) + '개' : ''].filter(Boolean).join(', ');
      return make('PRICE:' + k, 'PRICE', r0.at, r0.by, rows.length === 1 ? one.label : one.label + ' 외 기능 ' + (rows.length - 1) + '개', change,
        uniq(rows.map(function (r) { return r.reason; })).join(' / '), { docUrl: r0.docUrl || '', docNo: r0.docNo || '', items: items });
    });
  }
  function templateEvents() {
    const out = [];
    D.TEMPLATES.forEach(function (t) {
      (t.versions || []).forEach(function (v) {
        if (!v.at) return;
        // 반부패 조항 표시(기획자 결정 2026-11-02 C-15)가 있으면 함께
        const ab = v.antiBribery === true ? ', 반부패 조항 있음' : v.antiBribery === false ? ', 반부패 조항 없음' : '';
        out.push(make('TPL:' + t.id + ':' + v.no, 'TEMPLATE', v.at, v.by, t.name + ' 판 ' + v.no,
          (v.no === 1 ? '처음 올림' : '판 ' + (v.no - 1) + ' 다음 판') + ', ' + C.fmtDate(v.from) + '부터 적용' + ab + ': ' + (v.summary || ''), v.basis || ''));
      });
    });
    return out;
  }
  // 결재선 규칙의 유닛 이름(유닛별 리더 표와 결재선 규칙에서 더한 유닛)
  function salesUnits() {
    const out = Object.keys(D.TEAM_LEADERS);
    D.ASSIGNEE_CHANGES.forEach(function (x) { const t = x.step.indexOf('S03:') === 0 ? x.step.slice(4) : ''; if (t && out.indexOf(t) < 0) out.push(t); });
    return out;
  }
  function deptOf(id) { return (D.USERS[id] || {}).dept || ''; }
  /* 새로 맡는 사람이 기안자 유닛 밖인지 (C-8: 결재선 규칙은 "기안자 유닛과 떨어져 있는지"를 봄). 판단하지 않고 사실만 적음
   *   ③ 유닛 리더('S03:유닛'): 그 유닛의 영업이 기안 → 맡는 사람이 그 유닛 사람인지
   *   그 밖의 단계(③ 리더 본인 계약의 영업 임원, ②, ④~⑩): 영업 유닛 사람이 기안 → 맡는 사람이 영업 유닛 사람인지 */
  function relation(key, person) {
    const d = deptOf(person), k = String(key || '');
    if (k.indexOf('S03:') === 0) {
      const u = k.slice(4);
      return d === u ? '기안자 유닛 안(' + u + ')' : '기안자 유닛 밖(' + (d || '조직 없음') + ', 기안자 ' + u + ')';
    }
    return salesUnits().indexOf(d) > -1 ? '기안자 유닛 안(' + d + ')' : '기안자 유닛 밖(' + (d || '조직 없음') + ')';
  }
  // 결재선 규칙 한 건의 근거와 유닛 관계. 담당자 바꾸기(ASSIGNEE)와 대리 지정(DELEGATE, 예시 기록은 대리 지정 표에서 같은 일시로 찾음)만 사람이 있음
  //   대리 지정은 자리를 비우는 사람의 지금 담당으로 봄 [가정: 지난 대리 지정도 지금 담당으로 셈]
  function ruleInfo(e) {
    const op = e.op || null;
    let person = null, keys = [];
    if (op && op.k === 'ASSIGNEE') { person = op.to; keys = [op.step]; }
    else if (op && op.k === 'DELEGATE' && op.d) { person = op.d.delegateId; keys = C.duties(op.d.absentId).map(function (x) { return x.key; }); }
    else if (!op) {
      const d = D.DELEGATIONS.filter(function (x) { return x.at === e.at && x.by === e.by; })[0];
      if (d) { person = d.delegateId; keys = C.duties(d.absentId).map(function (x) { return x.key; }); }
    }
    const basis = D.RULE_BASIS ? D.RULE_BASIS.name + ' ' + D.RULE_BASIS.ver : '아직 적지 않음';
    if (!person) return { basis: basis, unit: '', person: null };
    const rel = uniq((keys.length ? keys : ['']).map(function (k) { return relation(k, person); }));
    return { basis: basis, unit: rel.join(', '), person: person };
  }
  /* 거래처 한 건이 재무 리더 확인 대상인지(2026-11-09 5회차 점검, 05 G-25 ②: "완료 계약이 있는 거래처의 번호 변경은 재무가 확인")
   *   대상 1: 고치기(op.k CUSTOMER_EDIT)에서 사업자등록번호를 바꾼 줄 가운데, 그 거래처에 완료 계약이 있는 것만
   *   대상 2: 합치기(op.k CUSTOMER_MERGE)에서 합치는 거래처 가운데 완료 계약이 있는 곳이 있는 것(기획자 결정 2026-11-10 22번)
   *     재무 리더가 "맞음", "다름"으로 확인(결과 이름은 아래 RESULT.CUSTOMER 그대로). 줄에 merge: true를 붙여 화면이 "거래처를 합침" 글을 씀
   *     합친 뒤에는 나머지 거래처의 계약이 남길 거래처 이름으로 옮겨지므로(common.js 합치기 되살리기) 남길 거래처의 지금 이름으로 셈.
   *     그래서 합친 모든 거래처의 완료 계약을 함께 셈(기획자 결정 2026-11-10 22번)
   *   완료 계약: 계약 완료, 만료, 해지 상태의 계약. 체결을 마쳐 재무 기록이 생긴 계약이고 지금 상태로 셈(기획자 확인 2026-11-10 23번)
   *   번호를 바꿨는지는 바뀐 내용 글(거래처 관리 openEdit가 만드는 "사업자등록번호: 앞 → 뒤")로 봄. 예시 기록(op 없음)은 대상 아님
   *   추가(기안할 때 저절로 등록된 줄 포함)는 묶음에 보이기만 함. 기안 때 생긴 거래처는 ②와 ⑩에서 이미 봄(CTL-81)
   *   완료 계약이 없는 거래처끼리의 합치기는 묶음(SCR-57 설정 변경)에만 보임(기획자 결정 2026-11-10 22번) */
  const DONE_STATUS = ['ACTIVE', 'EXPIRED', 'TERMINATED']; // 계약 완료, 만료, 해지(기획자 확인 2026-11-10 23번, [가정]을 뗌)
  // 그 이름의 거래처에 있는 완료 계약 수(고치기와 합치기가 함께 씀, 기획자 결정 2026-11-10 22번)
  function doneCountOf(name) {
    return name ? D.CONTRACTS.filter(function (c) { return c.id && c.counterparty === name && DONE_STATUS.indexOf(c.status) > -1; }).length : 0;
  }
  function customerCheckInfo(e) {
    const op = e.op || null;
    // 합치기도 재무 리더 확인 대상(기획자 결정 2026-11-10 22번): 남길 거래처(합친 계약이 모두 옮겨진 곳)의 완료 계약이 한 건이라도 있으면
    if (op && op.k === 'CUSTOMER_MERGE') {
      const keep = D.CUSTOMERS.filter(function (x) { return x.id === op.keep; })[0];
      const m = keep ? doneCountOf(keep.name) : 0;
      return { check: m > 0, doneCount: m, merge: true };
    }
    if (!op || op.k !== 'CUSTOMER_EDIT' || String(e.change || '').indexOf('사업자등록번호: ') < 0) return { check: false, doneCount: 0 };
    const cu = D.CUSTOMERS.filter(function (x) { return x.id === op.id; })[0];
    const n = cu ? doneCountOf(cu.name) : 0;
    return { check: n > 0, doneCount: n };
  }
  function logEvents(area) {
    return D.ADMIN_LOG.filter(function (e) { return e.area === area; }).map(function (e) {
      // 거래처 줄에는 check(재무 리더 확인 대상인지)와 doneCount(완료 계약 수)를 붙임(2026-11-09 5회차 점검)
      return make('LOG:' + e.at + '|' + e.by + '|' + e.target, area, e.at, e.by, e.target, e.change, e.reason,
        area === 'RULE' ? ruleInfo(e) : area === 'CUSTOMER' ? customerCheckInfo(e) : null);
    });
  }
  // opts: { month: 'YYYY-MM'(그달만), areas: ['PRICE', ...](그 영역만) }. 최근 것부터
  function settingChanges(opts) {
    opts = opts || {};
    // 거래처(CUSTOMER) 영역을 더함(2026-11-09 5회차 점검, CTL-83): 관리자 변경 이력의 거래처 추가, 고치기, 합치기 모두
    const list = priceEvents().concat(logEvents('PRODUCT'), templateEvents(), logEvents('RULE'), logEvents('COMPANY'), logEvents('CUSTOMER'));
    return list.filter(function (x) {
      return (!opts.month || String(x.at).slice(0, 7) === opts.month) && (!opts.areas || opts.areas.indexOf(x.area) > -1);
    }).sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
  }
  // 품의 문서 링크 (가격 기준 관리와 같은 모양: 누르면 사내 품의 시스템에서 열린다는 안내만)
  function docLink(x) {
    return x.docUrl ? '<a href="#" class="doc-link" data-doc="' + C.esc(x.docNo || x.docUrl) + '" title="' + C.esc(x.docUrl) + '">' + C.esc(x.docNo || '품의 문서') + '</a>' : '';
  }

  /* ---------- 4. 설정 변경 확인 (기획자 결정 2026-11-02 C-8, C-6) ---------- */
  // 거래처는 재무 리더(2026-11-09 5회차 점검, 05 G-25 ②). 다만 줄마다 check가 참인 것(완료 계약이 있는 거래처의 번호 변경과 합치기)만
  //   합치기는 기획자 결정 2026-11-10 22번으로 더함(customerCheckInfo)
  const CHECKER = { PRICE: 'FIN_LEAD', PRODUCT: 'FIN_LEAD', TEMPLATE: 'LEGAL', CUSTOMER: 'FIN_LEAD' };
  const RESULT = {
    PRICE: { MATCH: '품의와 맞음', DIFF: '품의와 다름' },
    PRODUCT: { MATCH: '품의와 맞음', DIFF: '품의와 다름' },
    TEMPLATE: { MATCH: '근거와 맞음', DIFF: '근거와 다름' },
    CUSTOMER: { MATCH: '맞음', DIFF: '다름' }, // 거래처 번호 변경: 결과는 맞음, 다름(다름이면 의견 필수). 품의가 없어 "품의와"를 붙이지 않음(2026-11-09 5회차 점검)
    //   거래처 합치기도 같은 "맞음", "다름"(기획자 결정 2026-11-10 22번)
  };
  // 거래처 줄은 check가 참일 때만 확인 대상(2026-11-09 5회차 점검, 합치기는 기획자 결정 2026-11-10 22번). 그 밖의 거래처 줄은 정보보호가 매월 묶음에서 봄
  function needsCheck(x) { return !!CHECKER[x.area] && (x.area !== 'CUSTOMER' || x.check === true); }
  function checkerLabel(area) { return area === 'TEMPLATE' ? '법무' : '재무 리더'; }
  function resultLabel(area, r) { return (RESULT[area] || RESULT.PRICE)[r] || r; }
  // 남긴 확인(최근 것부터). 예시 기록과 시연 기록 모두 관리자 변경 이력에 있음
  function checkEntries() {
    return D.ADMIN_LOG.filter(function (e) { return e.op && e.op.k === 'CONFIG_CHECK'; })
      .slice().sort(function (a, b) { return b.at.localeCompare(a.at); });
  }
  function checkOf(id) {
    const e = checkEntries().filter(function (x) { return x.op.id === id; })[0];
    return e ? { at: e.at, by: e.by, area: e.op.area, result: e.op.result, note: e.op.note || '', label: resultLabel(e.op.area, e.op.result) } : null;
  }
  // 이 사람이 이 줄을 확인할 수 있는지: { ok, why(못 하는 까닭, 화면에 보임), mine(이 사람이 맡은 영역인지) }
  function canConfirm(user, x) {
    if (!needsCheck(x) || C.isReadOnly(user) || checkOf(x.id)) return { ok: false, why: '', mine: false };
    // 컴플라이언스는 매월 점검 화면을 보기만 함(기획자 결정 2026-11-10 16번). 맡은 영역이 없어 아래에서도 막히지만 겹으로 막음
    if (user.role !== 'SUPER' && C.hasRole(user, ['COMPLIANCE'])) return { ok: false, why: '', mine: false };
    const mine = user.role === 'SUPER' || C.hasRole(user, [CHECKER[x.area]]);
    if (!mine) return { ok: false, why: '', mine: false };
    // C-8: 표준계약서는 올린 법무가 아닌 사람이 봄. C-6: 최고관리자도 자기가 바꾼 줄은 확인하지 못함
    if (x.by === user.id) return { ok: false, mine: true, why: x.area === 'TEMPLATE' ? '본인이 올린 판이라 올린 사람이 아닌 법무가 확인합니다' : '본인이 바꾼 것이라 다른 사람이 확인합니다' };
    return { ok: true, why: '', mine: true };
  }
  // 확인 남기기: 관리자 변경 이력의 점검 기록(AUDIT). 사유 칸에는 의견(없으면 결과)
  function saveCheck(x, result, note) {
    const label = resultLabel(x.area, result);
    return C.adminSave('AUDIT', '설정 변경 확인: ' + AREA_SET[x.area] + ' ' + x.target, label, note || label,
      { k: 'CONFIG_CHECK', id: x.id, area: x.area, result: result, note: note || '' });
  }

  /* ---------- 5. 꺼낸 기록과 파일 (기획자 결정 2026-11-02 C-3) ---------- */
  // 꺼낸 기록: 예시(D.EXPORT_LOG) + 이 브라우저의 시연 기록. 최근 것부터
  function exportsAll() {
    return (D.EXPORT_LOG || []).concat(C.loadDemo('exports')).slice()
      .sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
  }
  function recordExport(rec) {
    const n = exportsAll().reduce(function (m, x) { return Math.max(m, Number(String(x.id || '').replace(/\D/g, '')) || 0); }, 0) + 1;
    const r = Object.assign({ id: 'EX-' + String(n).padStart(4, '0') }, rec);
    C.pushDemo('exports', r);
    return r;
  }
  // 파일 지문: 글의 SHA-256(16진수 64자). 브라우저가 지원하지 않으면 빈 글
  function sha256Hex(text) {
    const s = window.crypto && window.crypto.subtle;
    if (!s || typeof TextEncoder === 'undefined') return Promise.resolve('');
    return s.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    }).catch(function () { return ''; });
  }
  // CSV 칸: 쉼표, 따옴표, 줄바꿈이 있으면 따옴표로 감쌈. =, +, @로 시작하면 엑셀이 식으로 읽지 않게 앞에 '를 붙임
  function csvCell(v) {
    let s = v == null ? '' : String(v);
    if (/^[=+@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function csvLine(cells) { return cells.map(csvCell).join(','); }
  const NL = '\r\n';
  // 내려받기: 엑셀이 한글을 바로 읽게 맨 앞에 BOM
  function download(name, text) {
    const blob = new Blob([String.fromCharCode(0xfeff) + text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.hidden = true;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }
  // "조직 이름 이메일" (워터마크와 실행한 사람 줄, REQ-SEC-07과 같은 모양)
  function whoText(user) {
    const a = C.accountOf(user.id);
    return (user.dept ? user.dept + ' ' : '') + user.name + (a ? ' ' + a.email : '');
  }
  function watermark(user, at) { return whoText(user) + ' ' + String(at).slice(0, 16) + ' 내려받음. 사내 감사 증빙 전용이며 다른 곳에 줄 때도 이 줄을 지우지 않음'; }

  /* ---------- 6. 점검에서 나온 문제를 컴플라이언스에 넘기기 (기획자 결정 2026-11-09 5회차 13번) ----------
   * 매월 점검에서 문제 결과를 남기면 저절로 컴플라이언스 담당자에게 넘어감(전에는 기록만 남고 개선 과제로 이어지지 않았음)
   *   문제 결과: 할인 예외 점검의 "문제 있음" 줄(SCR-61), 설정 변경 확인의 "다름"(SCR-65), 인장 기록 대조의 "맞지 않는 것이 있음"(SCR-63),
   *     영업기회 대사에서 예외 줄이 있는 대사 확인(SCR-62), 매월 기록 점검의 "조치함"(SCR-57),
   *     최고관리자 작업 점검의 "조치함"(SCR-57, 기획자 결정 2026-11-10 17번)
   *   넘어온 일은 개요 "점검할 일"(컴플라이언스)에 한 줄씩 올라가고, 컴플라이언스 담당자에게 이메일이 감(받는 사람은 complianceMailTo)
   *   컴플라이언스가 개선 과제와 보류 화면(SCR-64)에서 눌러 개선 과제로 기록하면(찾은 곳과 점검 화면 링크를 미리 채움) 그 일은 닫힘
   * 기록: 관리자 변경 이력의 점검 기록(영역 AUDIT, op.k ISSUE_RAISE, op.i 넘어온 일). 쌓기만 함
   *   넘어온 일 { id: 'IS-0001', source: 개선 과제의 찾은 곳 코드(D.REMEDIATION.SOURCE: DISCOUNT, CONFIG, SEAL, OPP, LOG), title: 무엇이 문제인지,
   *     note: 점검한 사람이 적은 의견이나 메모, href: 그 점검 화면(그달이나 그 줄), ref: 그달이나 줄 열쇠 }
   *   닫힘: 개선 과제 기록(D.REMEDIATIONS)의 issueId가 이 번호인 것이 있으면. 고객사 이름은 넣지 않고 계약번호만(열람 제한 계약 보호, REQ-AUTH-09) */
  function issuesAll() {
    return D.ADMIN_LOG.filter(function (e) { return e.op && e.op.k === 'ISSUE_RAISE' && e.op.i; })
      .map(function (e) { return Object.assign({ by: e.by, at: e.at }, e.op.i); })
      .sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
  }
  // 이 넘어온 일로 기록한 개선 과제(없으면 null)
  function issueTask(id) { return (D.REMEDIATIONS || []).filter(function (r) { return r.issueId === id; })[0] || null; }
  // 아직 개선 과제로 기록하지 않은 넘어온 일(오래된 것부터: 먼저 넘어온 일을 먼저 처리)
  function pendingIssues() { return issuesAll().filter(function (i) { return !issueTask(i.id); }).reverse(); }
  // 이메일 받을 컴플라이언스 담당자: 사용 중인 계정 가운데 컴플라이언스 역할이 있는 사람
  function complianceMailTo() {
    return D.ACCOUNTS.filter(function (a) { return a.status === 'ACTIVE' && (a.roles || []).indexOf('COMPLIANCE') > -1; }).map(function (a) { return a.id; });
  }
  // 넘기기: 점검 화면이 문제 결과를 저장한 바로 뒤에 부름. rec { source, title, note, href, ref }. 읽기만 하는 역할이면 남기지 않고 null
  function raiseIssue(rec) {
    const n = issuesAll().reduce(function (m, x) { return Math.max(m, Number(String(x.id || '').replace(/\D/g, '')) || 0); }, 0) + 1;
    const i = Object.assign({ id: 'IS-' + String(n).padStart(4, '0') }, rec);
    const to = complianceMailTo();
    const src = (D.REMEDIATION && D.REMEDIATION.SOURCE[i.source]) || i.source;
    const e = C.adminSave('AUDIT', '컴플라이언스에 넘김(' + i.id + '): ' + src + ' ' + i.title,
      '개선 과제로 옮길 일로 넘김, 컴플라이언스 담당자 이메일 ' + to.length + '명', i.note || i.title, { k: 'ISSUE_RAISE', i: i });
    return e.refused ? null : Object.assign({ by: e.by, at: e.at, mailTo: to }, i);
  }
  // 점검 화면의 안내와 알림 글(같은 말을 모든 점검 화면에서 씀)
  const ISSUE_HELP = '문제 결과를 남기면 컴플라이언스 담당자의 점검할 일에 저절로 올라가고 이메일로 알립니다.';
  function issueToast(i) { return i ? ' 컴플라이언스 담당자에게 넘기고 이메일로 알렸습니다(' + i.id + ').' : ''; }

  return {
    ACTS: ACTS, AREA: AREA, AREA_SET: AREA_SET, RESULT: RESULT, NL: NL,
    accessLogs: accessLogs, superIds: superIds,
    settingChanges: settingChanges, docLink: docLink, needsCheck: needsCheck, checkerLabel: checkerLabel, resultLabel: resultLabel,
    checkEntries: checkEntries, checkOf: checkOf, canConfirm: canConfirm, saveCheck: saveCheck,
    exportsAll: exportsAll, recordExport: recordExport, sha256Hex: sha256Hex, csvLine: csvLine, download: download, whoText: whoText, watermark: watermark,
    // 점검 문제를 컴플라이언스에 넘기기(기획자 결정 2026-11-09 5회차 13번)
    issuesAll: issuesAll, issueTask: issueTask, pendingIssues: pendingIssues, complianceMailTo: complianceMailTo, raiseIssue: raiseIssue,
    ISSUE_HELP: ISSUE_HELP, issueToast: issueToast,
  };
})();
