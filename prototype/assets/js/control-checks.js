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
 *      고객사 티어를 바꾼 것은 완료 계약과 상관없이 모두 재무 리더가 확인(설계 검토 2026-11-11 답 ①, CTL-140). 값에 앞, 뒤 티어와 그날 표준 단가가 바뀌는 기능
 *      가격 기준의 값에 티어 단가도 넣음(설계 검토 2026-11-11 답 ①): 기본 단가, 한도, 티어 1, 2 단가
 *      전후 값, 사유, 품의 링크. 결재선 규칙은 근거(사유, 위임전결 근거)와 새로 맡는 사람이 기안자 유닛 밖인지
 *      가격 기준은 같은 때, 같은 사람, 같은 품의로 넣은 줄을 한 건으로 봄 [가정: 한 품의로 여러 기능을 함께 넣기 때문]
 *   4. 설정 변경 확인(checkOf, canConfirm, saveCheck, C-8): 가격과 제품은 재무 리더가 "품의와 맞음, 다름", 표준계약서는 올린 사람이 아닌 법무
 *      완료 계약이 있는 거래처의 번호 변경은 재무 리더가 "맞음, 다름"(2026-11-09 5회차 점검, G-25 ②). 완료 계약이 있는 거래처의 합치기도 같음(기획자 결정 2026-11-10 22번)
 *      고객사 티어 변경은 재무 리더가 "품의와 맞음, 다름"(설계 검토 2026-11-11 답 ①, resultKey TIER). "다름"이면 컴플라이언스로 넘김(지금 규칙 그대로)
 *      최고관리자는 시연으로 확인하되 자기가 바꾼 줄은 못함(C-6). 읽기만 하는 역할(감사 열람)과 컴플라이언스(보기만, 기획자 결정 2026-11-10 16번)는 못함
 *      확인은 관리자 변경 이력의 점검 기록(영역 AUDIT, op.k CONFIG_CHECK)에 쌓기만 함. 한 건에 확인 하나
 *   5. 꺼낸 기록과 파일(C-3): exportsAll(꺼낸 기록), recordExport, sha256Hex(파일 지문), csvLine(CSV 한 줄), download(내려받기)
 *      CSV는 엑셀에서 열리게 맨 앞에 BOM을 붙여 UTF-8로. 실제 시스템은 서버가 파일을 만들고 지문과 꺼낸 기록을 남김
 *   6. 점검 문제를 컴플라이언스에 넘기기(raiseIssue, pendingIssues, issueTask): 매월 점검에서 문제 결과를 남기면 컴플라이언스 담당자의
 *      점검할 일에 올라가고 이메일이 감. 개선 과제로 기록하면 닫힘(기획자 결정 2026-11-09 5회차 13번)
 *      이 파일을 부르는 화면: 개요, 접속 기록 점검, 설정 변경 확인, 통계, 인장 기록 대조, 개선 과제와 보류(할인 예외 점검과 영업기회 대사는 HTML이 부르지 않으면 그 JS가 불러 씀)
 *   7. 줄임 변경의 참고 금액(shrinkRef, 2026-11-14 주말 점검 W7): 할인 예외 점검의 참고 표 "참고 금액보다 많이 줄인 변경"이 씀
 *      기능마다 합친 값(feats)과 셈 글(shrinkCalc)을 결재 문서 "변경 전과 후"도 씀(2026-11-14 주말 점검, 코드 다시 보기 review-01)
 *   (2026-11-14 주말 점검, 코드 다시 보기 common-01) 티어 변경 뒤 계약 목록(tierSince)은 보는 사람이 볼 수 없는 열람 제한 계약의 번호를 빼고 건수만
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
  // (설계 검토 2026-11-11 남은 것 ⑤) 예전 계약 기록(LEGACY, SCR-95)도 이름으로: 관리자 변경 이력의 영역 거르기와 접속 기록의 대상 글("예전 계약 기록: LG-0001 …")에 보임
  const AREA = { USER: '사용자 권한', RULE: '결재선 규칙', RESTRICT: '열람 제한', PRICE: '가격 기준', PRODUCT: '제품과 기능', TEMPLATE: '표준계약서', CUSTOMER: '거래처', CODE: '코드', NOTICE: '공지사항',
    COMPANY: '회사 설정', COMPLIANCE: '컴플라이언스', LEGACY: '예전 계약 기록' };
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
      push(x.at, x.by, 'DOWNLOAD', (x.kind === 'BUNDLE' ? '결재 기록 묶음: ' : x.kind === 'POP_CONFIG' ? '모집단(가격과 거래처 변경): ' : '통제 증빙: ') + x.cond + ' (' + x.file + ')', '사내망'); // POP_CONFIG: 2026-11-16 W7-6
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
  // (설계 검토 2026-11-11 답 ①) 가격 줄의 티어 단가 한 구절 "티어 1 10,800,000원, 티어 2 11,400,000원"(없으면 ''). 설정 변경 확인, 매월 점검, 증빙 내보내기가 같이 씀
  function tierPriceText(r) {
    const tp = (r && r.tierPrices) || {};
    return (D.CUSTOMER_TIERS || []).filter(function (t) { return tp[t.code] != null; }).map(function (t) { return t.label + ' ' + C.fmtWon(tp[t.code]); }).join(', ');
  }
  // 값: 기본 표준 단가(단위), 한도, 티어 단가(있으면). 예: "12,000,000원(기관, 1년), 한도 0%, 티어 1 10,800,000원, 티어 2 11,400,000원" (설계 검토 2026-11-11 답 ①)
  function priceText(r) { const t = tierPriceText(r); return C.fmtWon(r.listPrice) + '(' + r.unit + '), 한도 ' + pct(r.discountCap) + (t ? ', ' + t : ''); }
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
      // (설계 검토 2026-11-11 답 ①) 여러 기능 묶음은 티어 단가가 있는 기능 수도 요약에 보임(기능마다 값은 접어 둔 목록에)
      const tiered = rows.filter(function (r) { return !!tierPriceText(r); }).length;
      const change = rows.length === 1
        ? (one.before ? one.before + ' → ' : '처음 넣음: ') + one.after + ' (' + C.fmtDate(one.from) + '부터)'
        : '기능 ' + rows.length + '개: ' + [fresh ? '처음 넣음 ' + fresh + '개' : '', rows.length - fresh ? '바꿈 ' + (rows.length - fresh) + '개' : '',
          tiered ? '티어 단가 있음 ' + tiered + '개' : ''].filter(Boolean).join(', ');
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
   *   대상 3: 고객사 티어를 바꾼 줄(완료 계약과 상관없이, 설계 검토 2026-11-11 답 ①). 아래 tierInfo
   *   완료 계약: 계약 완료, 만료, 해지 상태의 계약. 체결을 마쳐 재무 기록이 생긴 계약이고 지금 상태로 셈(기획자 확인 2026-11-10 23번)
   *   번호를 바꿨는지는 바뀐 내용 글(거래처 관리 openEdit가 만드는 "사업자등록번호: 앞 → 뒤")로 봄. 예시 기록(op 없음)은 대상 아님
   *   추가(기안할 때 저절로 등록된 줄 포함)는 묶음에 보이기만 함. 기안 때 생긴 거래처는 ②와 ⑩에서 이미 봄(CTL-81)
   *   완료 계약이 없는 거래처끼리의 합치기는 묶음(SCR-57 설정 변경)에만 보임(기획자 결정 2026-11-10 22번)
   *     다만 남길 거래처와 고객사 티어가 다른 곳이 있으면 완료 계약과 상관없이 대상(기획자 답 2026-11-12 [제안] ①, 아래 mergeTierInfo) */
  const DONE_STATUS = ['ACTIVE', 'EXPIRED', 'TERMINATED']; // 계약 완료, 만료, 해지(기획자 확인 2026-11-10 23번, [가정]을 뗌)
  // 그 이름의 거래처에 있는 완료 계약 수(고치기와 합치기가 함께 씀, 기획자 결정 2026-11-10 22번)
  function doneCountOf(name) {
    return name ? D.CONTRACTS.filter(function (c) { return c.id && c.counterparty === name && DONE_STATUS.indexOf(c.status) > -1; }).length : 0;
  }
  /* 고객사 티어 변경 (설계 검토 2026-11-11 답 ①, 06 CTL-140): 거래처 줄 가운데 바뀐 내용에 "고객사 티어"가 있는 것은 완료 계약과 상관없이 모두 재무 리더 확인 대상
   *   [가정: 앞으로 그 거래처의 견적과 계약의 표준 단가가 바뀌므로] 고치기("고객사 티어: 티어 2 → 티어 1", admin-customers.js openEdit),
   *   티어를 고른 추가("거래처 추가: …, 고객사 티어 티어 1"), 처음 넣은 예시 줄("고객사 티어 처음 넣음") 모두. 티어 없이 추가한 줄은 그대로 대상 아님
   *   결과는 가격과 같은 "품의와 맞음", "품의와 다름"(RESULT.TIER). 거래처 관리에는 품의 링크 칸이 없어 사유와 사내 품의를 견줌 [가정](제품과 기능과 같음)
   *   값 칸에 앞, 뒤 티어와 바꾼 날 적용되던 가격 기준으로 표준 단가가 어떻게 바뀌는지(items: 티어 단가가 있어 값이 달라지는 기능만) [가정: 예정 줄은 보지 않음]
   *   반환: null(티어 변경 아님) 또는 { tier: true, tierFrom, tierTo(코드, '' 없음, 처음 넣은 줄은 null), items, tierNote } */
  function tierCodeOf(label) {
    const t = (D.CUSTOMER_TIERS || []).filter(function (x) { return x.label === label || x.code === label; })[0];
    return t ? t.code : '';
  }
  // 티어 하나의 표준 단가(원)와 글 "10,800,000원(티어 1 단가)" / 티어 단가가 없으면 "12,000,000원(기본 단가)"
  function hasTierPrice(r, code) { return !!code && !!r.tierPrices && r.tierPrices[code] != null; }
  function tierAmount(r, code) { return hasTierPrice(r, code) ? Number(r.tierPrices[code]) : Number(r.listPrice); }
  function tierPriceOf(r, code) { return C.fmtWon(tierAmount(r, code)) + (hasTierPrice(r, code) ? '(' + C.tierLabel(code) + ' 단가)' : '(기본 단가)'); }
  // 그날 적용되던 가격 줄 가운데 티어 단가가 있는 것(tierInfo와 mergeTierInfo가 함께 씀) [가정: 예정 줄은 보지 않음]
  function pricedRowsAt(day) {
    const rows = C.pricesAt(day);
    return Object.keys(rows).map(function (k) { return rows[k]; }).filter(function (r) { return r.validFrom <= day && !!tierPriceText(r); });
  }
  /* (기획자 답 2026-11-12 [제안] ①, 06 CTL-140) 티어가 다른 거래처 합치기
   *   합친 뒤에는 옮겨진 계약도 남긴 거래처의 고객사 티어 단가로 다음 기안을 함(C.customerTier). 사실상 티어 변경이라
   *   남길 거래처와 티어가 다른 곳(한쪽이 티어 없음 포함)이 하나라도 있으면 완료 계약과 상관없이 재무 리더 확인 대상이고 결과는 "품의와 맞음, 다름"(resultKey TIER)
   *   티어는 합친 때의 값(op.tiers, admin-customers.js openMerge가 남김). op.tiers가 없는 기록은 지금 거래처의 티어로 셈 [가정]
   *   items: 다른 티어마다 그날 표준 단가가 바뀌는 기능(다른 티어가 둘 이상이면 이름 뒤에 "(티어 1에서)")
   *   반환: null(티어가 모두 같음) 또는 tierInfo와 같은 꼴 + tierMerge: [{ id, name, from }](남길 곳과 티어가 다른 거래처) */
  function mergeTierInfo(e) {
    const op = e.op || {}, tiers = op.tiers || {};
    const cuOf = function (id) { return D.CUSTOMERS.filter(function (x) { return x.id === id; })[0] || null; };
    const tierOf = function (id) { if (tiers[id] != null) return tiers[id]; const cu = cuOf(id); return cu ? cu.tier || '' : ''; };
    const to = tierOf(op.keep);
    const diff = (op.ids || []).filter(function (id) { return id !== op.keep && tierOf(id) !== to; })
      .map(function (id) { const cu = cuOf(id); return { id: id, name: cu ? cu.name : id, from: tierOf(id) }; });
    if (!diff.length) return null;
    // '' (티어 없음)도 남기는 중복 제거(이 파일의 uniq는 빈 값을 버려 티어 없는 거래처의 단가 변화가 빠졌음, 2026-11-12 검토)
    const froms = diff.map(function (d) { return d.from; }).filter(function (f, i, a) { return a.indexOf(f) === i; });
    const day = String(e.at).slice(0, 10), priced = pricedRowsAt(day);
    const items = [];
    froms.forEach(function (from) {
      priced.filter(function (r) { return tierAmount(r, from) !== tierAmount(r, to); }).forEach(function (r) {
        items.push({ label: C.featureLabel(r) + (froms.length > 1 ? '(' + (from ? C.tierLabel(from) : '티어 없음') + '에서)' : ''), before: tierPriceOf(r, from), after: tierPriceOf(r, to), from: day });
      });
    });
    return { tier: true, tierFrom: froms.length === 1 ? froms[0] : null, tierTo: to, items: items, tierMerge: diff,
      tierNote: items.length ? '' : '그날 가격 기준에 두 티어의 단가 차이가 없어 표준 단가는 같음' };
  }
  function tierInfo(e) {
    const ch = String(e.change || ''), op = e.op || {};
    if (op.k === 'CUSTOMER_MERGE') return mergeTierInfo(e); // 기획자 답 2026-11-12 [제안] ①
    if (ch.indexOf('고객사 티어') < 0) return null;
    const m = ch.match(/고객사 티어: ([^,]+?) → ([^,]+)/);
    // (2026-11-16 밤 코드 다시 보기 dec-01) 고치기 기록에 바꾸기 전 티어 코드(op.tierFrom)와 바꾼 뒤 코드(op.set.tier)가 있으면 그 코드를 먼저 씀.
    //   결정 3으로 코드 관리에서 티어 이름을 바꾸면 바뀐 내용 글의 이름으로는 지난 줄의 티어를 찾지 못했음(앞뒤 티어가 비고 "표준 단가는 같음"으로 보였음)
    const coded = op.k === 'CUSTOMER_EDIT' && op.tierFrom != null && op.set && typeof op.set.tier === 'string';
    const from = coded ? op.tierFrom : m ? tierCodeOf(m[1].trim()) : op.k === 'CUSTOMER_ADD' ? '' : null;
    const to = coded ? op.set.tier : m ? tierCodeOf(m[2].trim()) : op.k === 'CUSTOMER_ADD' && op.cu ? op.cu.tier || '' : null;
    const day = String(e.at).slice(0, 10);
    const priced = pricedRowsAt(day);
    let items;
    if (from === null || to === null) {
      // 여러 거래처에 처음 넣은 줄: 앞, 뒤 하나로 셀 수 없어 그날의 티어 단가표 그대로
      items = priced.map(function (r) { return { label: C.featureLabel(r), before: '', after: tierPriceText(r) + ', 그 밖 기본 ' + C.fmtWon(r.listPrice), from: day }; });
    } else {
      items = priced.filter(function (r) { return tierAmount(r, from) !== tierAmount(r, to); })
        .map(function (r) { return { label: C.featureLabel(r), before: tierPriceOf(r, from), after: tierPriceOf(r, to), from: day }; });
    }
    return { tier: true, tierFrom: from, tierTo: to, items: items,
      tierNote: items.length ? '' : '그날 가격 기준에 두 티어의 단가 차이가 없어 표준 단가는 같음' };
  }
  /* (2026-11-14 주말 점검 W7, CTL-140, CTL-78) 티어 변경의 거래처 번호들(tierIds)과 바꾼 뒤 기안한 계약, 출력한 견적(tierSince)
   *   티어는 바꾸는 즉시 적용되고 재무 리더 확인은 기한 없는 사후 확인이라, 확인 전에 기안한 계약과 출력한 견적에 바뀐 티어 단가가 그대로 남음(CTL-14)
   *   "품의와 다름"이 나오면 그 사이의 계약과 견적을 컴플라이언스가 손으로 찾아야 했음. 그래서 설정 변경 확인의 값 칸에 번호를 보이고 넘김 글에 함께 넣음
   *   tierIdsOf: 고치기는 op.id, 티어를 고른 추가는 op.cu.id, 합치기는 남긴 거래처와 합친 거래처 모두(합친 뒤 모두 남긴 거래처의 티어를 씀).
   *     op가 없는 예시 줄은 대상 글의 "(C-0000)"에서 읽음. 여러 거래처에 처음 넣은 줄("거래처 34곳")은 번호가 없어 빈 목록
   *   tierSince(x): [가정] 기간은 바꾼 일시부터 같은 거래처의 다음 티어 변경 전까지(없으면 지금까지)
   *     계약: 임시 저장과 예전 계약 기록을 뺀 기안(진행 중, 반려, 진행 중단, 계약 완료 모두. 기안 일시 requestedAt), 거래처는 C.customerOfContract
   *     견적: 그 거래처(q.customer)의 견적 판 가운데 그 기간에 출력(issues)한 판. 견적 번호와 판만 보임
   *   반환: null(티어 변경이 아니거나 거래처 번호를 모름) 또는 { contracts: [계약번호], quotes: ['QT2610-001 2판'], until: 다음 티어 변경 일시 또는 '' }
   *   (2026-11-14 주말 점검, 코드 다시 보기 common-01) 열람 제한 계약 가리기(REQ-AUTH-09, AC-40 leak-01과 같은 규칙): 이 목록은 거래처 이름 바로 옆에 보여
   *     번호가 그대로 나오면 볼 수 없는 열람 제한 계약이 어느 고객사 것인지 드러남. 그래서 tierSince(x, viewer)는
   *     viewer(사람, 없으면 지금 사람)가 볼 수 없는(C.canView 거짓) 열람 제한 계약을 contracts에서 빼고 hidden(건수)으로만 셈
   *     viewer가 'SHARED'이면(넘김 글처럼 컴플라이언스와 접속 기록 점검의 여러 사람이 읽는 글) 열람 제한 계약은 모두 번호 없이 건수만
   *     반환에 hidden: 번호를 뺀 열람 제한 계약 수를 더함. tierSinceText는 "바꾼 뒤 기안한 계약 2건(2610CL013, 열람 제한 계약 1건)"처럼 적음 */
  function tierIdsOf(e) {
    const op = e.op || {};
    if (op.k === 'CUSTOMER_MERGE') return uniq([op.keep].concat(op.ids || []));
    if (op.k === 'CUSTOMER_EDIT' && op.id) return [op.id];
    if (op.k === 'CUSTOMER_ADD' && op.cu && op.cu.id) return [op.cu.id];
    return uniq((String(e.target || '').match(/\(C-\d+\)/g) || []).map(function (s) { return s.slice(1, -1); }));
  }
  function tierSince(x, viewer) {
    if (!x || !x.tier || !x.tierIds || !x.tierIds.length) return null;
    const ids = x.tierIds;
    const until = settingChanges({ areas: ['CUSTOMER'] }).filter(function (y) {
      return y.tier && String(y.at) > String(x.at) && (y.tierIds || []).some(function (id) { return ids.indexOf(id) > -1; });
    }).map(function (y) { return String(y.at); }).sort()[0] || '';
    const inWin = function (at) { return !!at && String(at) >= String(x.at) && (!until || String(at) < until); };
    const all = D.CONTRACTS.filter(function (c) {
      if (!c.id || c.status === 'DRAFT' || c.legacy || !inWin(c.requestedAt)) return false;
      // (2026-11-16 밤 코드 다시 보기 w7-04) 간접 계약은 표준 단가를 줄의 사용 업체 티어로 정하므로(W7-4) 사용 업체가 그 거래처인 줄이 있으면 넣음.
      //   리셀러(계약의 거래처)의 티어 변경에는 넣지 않음. 직접과 조달은 예전처럼 계약의 거래처
      if (C.methodOf(c) === 'INDIRECT') {
        const own = c.products || (c.form && c.form.products) || [];
        if (own.length) return own.some(function (l) { const u = C.tierCustomerFor(c, l); return !!u && ids.indexOf(u.id) > -1; });
        // (2026-11-17 다른 눈 review-01) 제품 줄이 없는 운영 변경(유상 충전)과 그대로 연장은 기안 때 지금 조건의 줄 몫의 사용 업체로 봄(표준 단가를 셈한 출처와 같음, w7-05)
        const t = C.currentTerms(C.rootOf(c), { before: c.requestedAt, skip: c.id });
        if (!t || !t.ready) return false;
        const lines = c.kind === 'CHANGE' && c.changeFeature ? t.lines.filter(function (l) { return l.feature === c.changeFeature; }) : t.lines;
        const parts = [];
        lines.forEach(function (l) { l.parts.forEach(function (x) { if (x.qty > 0 && x.org) parts.push(x); }); });
        const pick = c.kind === 'CHANGE' && c.changeFeature ? parts.slice(0, 1) : parts; // 유상 충전은 첫 몫(ops-change.js tierCu와 같은 [가정])
        return pick.some(function (x) { const u = C.customerByName(x.org); return !!u && ids.indexOf(u.id) > -1; });
      }
      const cu = C.customerOfContract(c);
      return !!cu && ids.indexOf(cu.id) > -1;
    }).sort(function (a, b) { return String(a.requestedAt).localeCompare(String(b.requestedAt)); });
    // (2026-11-14 주말 점검, 코드 다시 보기 common-01) 볼 수 없는 열람 제한 계약은 번호를 빼고 건수만. 'SHARED'(여러 사람이 읽는 글)는 열람 제한 계약 모두
    const who = viewer === 'SHARED' ? null : viewer || C.currentUser();
    const hide = function (c) { return !!c.restricted && (!who || !C.canView(c, who)); };
    const contracts = all.filter(function (c) { return !hide(c); }).map(function (c) { return c.id; });
    const quotes = C.allQuotes().filter(function (q) { return ids.indexOf(q.customer) > -1 && (q.issues || []).some(function (i) { return inWin(i.at); }); })
      .map(function (q) { return q.no + ' ' + q.ver + '판'; });
    return { contracts: contracts, hidden: all.length - contracts.length, quotes: quotes, until: until };
  }
  // 한 줄 글: "바꾼 뒤 기안한 계약 2건(2610CL013, 2610CL014), 출력한 견적 1건(QT2610-001 2판)". max를 주면 그 수까지만 적고 "외 n건"
  //   (2026-11-14 주말 점검, 코드 다시 보기 common-01) 번호를 뺀 열람 제한 계약은 괄호 끝에 "열람 제한 계약 n건"으로만(건수에는 넣음)
  function tierSinceText(s, max) {
    if (!s) return '';
    const list = function (a) { return max && a.length > max ? a.slice(0, max).join(', ') + ' 외 ' + (a.length - max) + '건' : a.join(', '); };
    const tail = s.until ? '(다음 티어 변경 ' + C.fmtDateTime(s.until) + ' 전까지)' : '';
    const hidden = s.hidden || 0, n = s.contracts.length + hidden;
    if (!n && !s.quotes.length) return '바꾼 뒤 기안한 계약과 출력한 견적 없음' + tail;
    const inner = (s.contracts.length ? [list(s.contracts)] : []).concat(hidden ? ['열람 제한 계약 ' + hidden + '건'] : []).join(', ');
    return '바꾼 뒤 기안한 계약 ' + n + '건' + (n ? '(' + inner + ')' : '') +
      ', 출력한 견적 ' + s.quotes.length + '건' + (s.quotes.length ? '(' + list(s.quotes) + ')' : '') + tail;
  }
  function customerCheckInfo(e) {
    const op = e.op || null;
    // 합치기도 재무 리더 확인 대상(기획자 결정 2026-11-10 22번): 남길 거래처(합친 계약이 모두 옮겨진 곳)의 완료 계약이 한 건이라도 있으면
    if (op && op.k === 'CUSTOMER_MERGE') {
      const keep = D.CUSTOMERS.filter(function (x) { return x.id === op.keep; })[0];
      const m = keep ? doneCountOf(keep.name) : 0;
      // (기획자 답 2026-11-12 [제안] ①) 티어가 다른 거래처를 합쳤으면 완료 계약과 상관없이 대상. 결과 이름은 티어 변경과 같음(tier: true)
      const mt = mergeTierInfo(e);
      if (mt) return Object.assign({ check: true, doneCount: m, merge: true, tierIds: tierIdsOf(e) }, mt); // tierIds: 2026-11-14 주말 점검 W7
      return { check: m > 0, doneCount: m, merge: true };
    }
    // (설계 검토 2026-11-11 답 ①) 고객사 티어를 바꾼 줄은 완료 계약과 상관없이 대상. 같은 고치기에 번호 변경이 함께 있으면 완료 계약 수도 함께 보임
    const ti = tierInfo(e);
    const bizNo = !!op && op.k === 'CUSTOMER_EDIT' && String(e.change || '').indexOf('사업자등록번호: ') > -1;
    const cu = bizNo ? D.CUSTOMERS.filter(function (x) { return x.id === op.id; })[0] : null;
    const n = cu ? doneCountOf(cu.name) : 0;
    if (ti) return Object.assign({ check: true, doneCount: n, bizNo: bizNo, tierIds: tierIdsOf(e) }, ti); // tierIds: 2026-11-14 주말 점검 W7
    if (!bizNo) return { check: false, doneCount: 0 };
    return { check: n > 0, doneCount: n, bizNo: true };
  }
  function logEvents(area) {
    return D.ADMIN_LOG.filter(function (e) { return e.area === area; }).map(function (e) {
      // 거래처 줄에는 check(재무 리더 확인 대상인지)와 doneCount(완료 계약 수)를 붙임(2026-11-09 5회차 점검)
      return make('LOG:' + e.at + '|' + e.by + '|' + e.target, area, e.at, e.by, e.target, e.change, e.reason,
        area === 'RULE' ? ruleInfo(e) : area === 'CUSTOMER' ? customerCheckInfo(e) : null);
    });
  }
  // 기획자 결정 2026-11-16(결정할것 결정 3): 고객사 티어 목록(코드 관리의 코드표 CODE-CUSTOMER-TIER)을 바꾼 줄(추가, 이름 변경, 사용 안 함)도
  //   거래처의 티어 변경처럼 재무 리더의 설정 변경 확인 대상. 영역은 거래처, 결과 이름은 "품의와 맞음, 다름"(tier: true, resultKey TIER)
  //   티어 단가는 가격 기준 관리에서 따로 넣으므로 이 줄은 표준 단가를 바꾸지 않고(items 없음), 바꾼 뒤 계약과 견적 목록(tierSince)도 없음(tierIds 빈 목록)
  function tierCodeEvents() {
    return D.ADMIN_LOG.filter(function (e) { return e.area === 'CODE' && e.op && (e.op.group === 'TIER' || (e.op.c && e.op.c.group === 'TIER')); }).map(function (e) {
      return make('LOG:' + e.at + '|' + e.by + '|' + e.target, 'CUSTOMER', e.at, e.by, e.target, e.change, e.reason,
        { check: true, doneCount: 0, tier: true, tierCode: true, items: [], tierIds: [], tierNote: '티어 목록(코드 관리)을 바꿈. 거래처마다의 티어와 티어 단가는 그대로이고, 단가는 가격 기준 관리에서 넣음' });
    });
  }
  // opts: { month: 'YYYY-MM'(그달만), areas: ['PRICE', ...](그 영역만) }. 최근 것부터
  function settingChanges(opts) {
    opts = opts || {};
    // 거래처(CUSTOMER) 영역을 더함(2026-11-09 5회차 점검, CTL-83): 관리자 변경 이력의 거래처 추가, 고치기, 합치기 모두
    const list = priceEvents().concat(logEvents('PRODUCT'), templateEvents(), logEvents('RULE'), logEvents('COMPANY'), logEvents('CUSTOMER'), tierCodeEvents()); // tierCodeEvents: 2026-11-16 결정 3
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
    // (설계 검토 2026-11-11 답 ①) 고객사 티어 변경은 영역은 거래처 그대로이고 결과 이름만 가격과 같은 "품의와 맞음", "품의와 다름"(resultKey가 TIER)
    TIER: { MATCH: '품의와 맞음', DIFF: '품의와 다름' },
  };
  // 거래처 줄은 check가 참일 때만 확인 대상(2026-11-09 5회차 점검, 합치기는 기획자 결정 2026-11-10 22번, 고객사 티어 변경은 설계 검토 2026-11-11 답 ①).
  //   그 밖의 거래처 줄은 정보보호가 매월 묶음에서 봄
  function needsCheck(x) { return !!CHECKER[x.area] && (x.area !== 'CUSTOMER' || x.check === true); }
  function checkerLabel(area) { return area === 'TEMPLATE' ? '법무' : '재무 리더'; }
  // 결과 이름표의 열쇠: 고객사 티어를 바꾼 거래처 줄은 TIER, 그 밖은 영역 (설계 검토 2026-11-11 답 ①). 남긴 확인에는 op.rk로 함께 남김
  function resultKey(x) { return x && x.area === 'CUSTOMER' && x.tier ? 'TIER' : x ? x.area : ''; }
  function resultLabel(area, r) { return (RESULT[area] || RESULT.PRICE)[r] || r; }
  // 남긴 확인(최근 것부터). 예시 기록과 시연 기록 모두 관리자 변경 이력에 있음
  function checkEntries() {
    return D.ADMIN_LOG.filter(function (e) { return e.op && e.op.k === 'CONFIG_CHECK'; })
      .slice().sort(function (a, b) { return b.at.localeCompare(a.at); });
  }
  function checkOf(id) {
    const e = checkEntries().filter(function (x) { return x.op.id === id; })[0];
    return e ? { at: e.at, by: e.by, area: e.op.area, result: e.op.result, note: e.op.note || '', label: resultLabel(e.op.rk || e.op.area, e.op.result) } : null; // rk: 설계 검토 2026-11-11 답 ①
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
  //   (설계 검토 2026-11-11 답 ①) 고객사 티어 변경이면 대상 글에 "(고객사 티어)"를 붙이고 결과 이름표 열쇠(rk: TIER)를 함께 남김
  function saveCheck(x, result, note) {
    const rk = resultKey(x), label = resultLabel(rk, result);
    return C.adminSave('AUDIT', '설정 변경 확인: ' + AREA_SET[x.area] + (rk === 'TIER' ? '(고객사 티어)' : '') + ' ' + x.target, label, note || label,
      Object.assign({ k: 'CONFIG_CHECK', id: x.id, area: x.area, result: result, note: note || '' }, rk !== x.area ? { rk: rk } : {}));
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

  /* 모집단 내려받기 (기획자 결정 2026-11-16, 결정할것 새 결정 W7-6 (가)): 2차의 점검 화면과 증빙 내보내기(CTL-131) 전에도 스프레드시트 점검의 대상 목록을
   *   점검하는 사람이 시스템에서 직접 꺼냄(바꾼 사람이 목록을 건네지 않게. 금융감독원 평가 가이드라인의 시스템 정보 완전성, 내부회계 원칙 10)
   *   o: { kind: 꺼낸 기록 종류(POP_CONFIG 등), title: 파일 앞 이름, cond: 조건 글, head: [칸 이름], rows: [[값]], user }
   *   파일 맨 위에 조건, 건수, 내려받은 사람과 일시(워터마크), 지문(SHA-256, 본문)을 적고 꺼낸 기록(EXPORT_LOG, recordExport)에 남김. 돌려줌: Promise(꺼낸 기록) */
  function popDownload(o) {
    const at = C.nowStamp(), body = [csvLine(o.head)].concat(o.rows.map(csvLine)).join(NL);
    const file = o.title + '_' + String(at).slice(0, 10) + '.csv';
    return sha256Hex(body).then(function (hash) {
      const head = [csvLine(['모집단', o.title]), csvLine(['조건', o.cond]), csvLine(['건수', o.rows.length + '건']), csvLine(['지문(SHA-256, 본문)', hash || '없음']), csvLine(['', watermark(o.user, at)])].join(NL);
      download(file, head + NL + NL + body);
      return recordExport({ at: String(at).slice(0, 16), by: o.user.id, dept: o.user.dept || '', kind: o.kind, cond: o.cond, count: o.rows.length + '건', sum: null, hash: hash, file: file });
    });
  }

  /* ---------- 6. 점검에서 나온 문제를 컴플라이언스에 넘기기 (기획자 결정 2026-11-09 5회차 13번) ----------
   * 매월 점검에서 문제 결과를 남기면 저절로 컴플라이언스 담당자에게 넘어감(전에는 기록만 남고 개선 과제로 이어지지 않았음)
   *   문제 결과: 할인 예외 점검의 "문제 있음" 줄(SCR-61), 설정 변경 확인의 "다름"(SCR-65), 인장 기록 대조의 "맞지 않는 것이 있음"(SCR-63),
   *     영업기회 대사에서 예외 줄이 있는 대사 확인(SCR-62), 매월 기록 점검의 "조치함"(SCR-57),
   *     최고관리자 작업 점검의 "조치함"(SCR-57, 기획자 결정 2026-11-10 17번),
   *     예전 계약 기록 매월 확인의 "맞지 않는 것이 있음"(SCR-95, 찾은 곳 LEGACY, 설계 검토 2026-11-11 답 ②, CTL-143. legacy-contract.html이 이 파일을 부름)
   *   넘어온 일은 개요 "점검할 일"(컴플라이언스)에 한 줄씩 올라가고, 컴플라이언스 담당자에게 이메일이 감(받는 사람은 complianceMailTo)
   *   컴플라이언스가 개선 과제와 보류 화면(SCR-64)에서 눌러 개선 과제로 기록하면(찾은 곳과 점검 화면 링크를 미리 채움) 그 일은 닫힘
   * 기록: 관리자 변경 이력의 점검 기록(영역 AUDIT, op.k ISSUE_RAISE, op.i 넘어온 일). 쌓기만 함
   *   넘어온 일 { id: 'IS-0001', source: 개선 과제의 찾은 곳 코드(D.REMEDIATION.SOURCE: DISCOUNT, CONFIG, SEAL, OPP, LOG, LEGACY), title: 무엇이 문제인지,
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

  /* ---------- 7. 줄임 변경의 참고 금액 (2026-11-14 주말 점검 W7) ----------
   * 줄임 변경은 ③도 할인 계산도 거치지 않음(CTL-141, 묶음 확인 6 [가정]). 그래서 "얼마까지 줄이는 것이 맞는지" 볼 참고 값을 셈해,
   *   할인 예외 점검(SCR-61)의 참고 표 "참고 금액보다 많이 줄인 변경"이 씀. 막지 않고 보기만 함(③을 거칠지는 묶음 확인 6의 답을 따름)
   *   결재 문서의 "변경 전과 후"(review.js, 공통 담당)도 줄마다 같은 값을 보여야 해서 화면이 아닌 이곳에 둠
   *   (2026-11-14 주말 점검 W7, icfr-04) review.html이 이 파일을 불러 결재 문서의 "변경 전과 후"(review.js amendDiffHtml)가 줄마다 같은 값과 "참고보다 많이 줄임"을 보임
   * 참고 금액 = 그 기능의 계약 단가 x 줄이는 수량 x 남은 달 수 / 그 기간의 달 수 (예시 2609CL007-A01: 7,800,000원 x 1 x 11 / 12 = 7,150,000원)
   *   [가정] 변경 전 조건: 이 변경을 기안하기 전에 계약 완료된 것으로 셈한 지금 유효한 조건(C.currentTerms, 결재 문서의 "변경 전"과 같음)
   *   [가정] 계약 단가와 그 기간: 바탕 계약(원계약이나 조건을 바꾼 연장)에 그 기능 줄이 있으면 그 줄의 금액 / 수량과 바탕 계약의 기간,
   *     없으면(추가 변경으로 생긴 기능) 그 기능을 처음 더한 변경의 금액 / 수량과 그 변경의 기간. 기간을 모르면 12개월(CTL-139와 같음)
   *   [가정] 남은 달 수: 변경 시작일(없으면 기안한 날)부터 변경 전 조건의 종료일까지(C.periodMonths, 남는 날은 한 달)
   *     (2026-11-14 주말 점검, 코드 다시 보기 common-05) 예전에는 남은 달 수를 바탕 계약의 달 수로 잘라(Math.min) 03 문서의 셈과 달랐음.
   *       그대로 연장이 원계약 기간 안에 먼저 계약 완료되어 종료일이 늘어난 묶음에서 맞게 줄인 금액도 "참고보다 많이 줄임"으로 떴음. 이제 자르지 않음
   *   줄인 금액(변경 금액의 부호를 뺀 값)이 참고 금액보다 1원이라도 크면 over(참고보다 많이 줄임). 원 단위로 반올림
   *   (2026-11-14 주말 점검, 코드 다시 보기 review-01) 기능마다 합친 값 feats: 같은 기능 줄이 여럿이면(01 REQ-REG-30 "같은 기능 줄은 모두 더함") 수량, 참고 금액,
   *     줄인 금액을 더하고 over는 그 합으로 봄. 결재 문서 "변경 전과 후"(기능마다 한 줄)와 할인 예외 점검 셋째 참고 표가 이 값과 셈 글(shrinkCalc)을 함께 씀
   *     [가정, 기획자 확인 필요] 참고 표에 올리는 기준(flag): 계약 전체가 넘거나(over) 한 기능이라도 넘으면(feats의 over). 다른 기능을 덜 줄인 것으로
   *       한 기능을 더 깎은 몫이 가려지지 않게(검토자 추천안). overGap은 넘은 기능마다 더 줄인 몫의 합, overRef는 그 기능들의 참고 금액 합(차이와 그 비율에 씀)
   * 반환: null(줄임 변경이 아님) / { why: 셈하지 못한 까닭 } / { ref, reduced, over, gap(줄인 금액 - 참고 금액), lines: [{ feature, qty, unit, period, remaining, ref, reduced, over }],
   *   feats: [{ feature, qty, ref, reduced, over, lines }], flag, overGap, overRef } */
  // 2026-11-16 W7-3: 결재선(③, common.js reviewRoute)과 계약 등록도 같은 셈을 쓰므로 common.js C.shrinkRef로 옮김. 이 이름은 그대로 둠
  function shrinkRef(c) { return C.shrinkRef(c); }
  // (2026-11-14 주말 점검, 코드 다시 보기 review-01) 한 기능(feats의 하나)의 참고 금액 셈 글: "계약 단가 7,800,000원 x 2 x 남은 11/12개월"
  //   그 기능의 줄들이 계약 단가와 기간이 같으면 수량을 더해 한 줄로, 다르면 줄마다 셈 글을 " + "로 이음. 결재 문서와 할인 예외 점검이 같은 글을 씀
  function shrinkCalc(f) {
    const one = function (l, q) { return '계약 단가 ' + C.fmtWon(l.unit) + ' x ' + Number(q).toLocaleString('ko-KR') + ' x 남은 ' + l.remaining + '/' + l.period + '개월'; };
    const ls = (f && f.lines) || [];
    if (!ls.length) return '';
    const same = ls.every(function (l) { return l.unit === ls[0].unit && l.remaining === ls[0].remaining && l.period === ls[0].period; });
    return same ? one(ls[0], f.qty) : ls.map(function (l) { return one(l, l.qty); }).join(' + ');
  }

  return {
    ACTS: ACTS, AREA: AREA, AREA_SET: AREA_SET, RESULT: RESULT, NL: NL,
    accessLogs: accessLogs, superIds: superIds,
    settingChanges: settingChanges, docLink: docLink, needsCheck: needsCheck, checkerLabel: checkerLabel, resultLabel: resultLabel,
    // (설계 검토 2026-11-11 답 ①) 결과 이름표 열쇠, 가격 줄의 티어 단가 글, 관리자 변경 이력 한 줄의 고객사 티어 변경(아니면 null). 증빙 내보내기(stats.js)도 씀
    resultKey: resultKey, tierPriceText: tierPriceText, tierInfo: tierInfo,
    // (2026-11-14 주말 점검 W7) 티어 변경 뒤 기안한 계약과 출력한 견적, 그 한 줄 글. 설정 변경 확인의 값 칸과 "품의와 다름" 넘김 글이 씀
    //   (2026-11-14 주말 점검, 코드 다시 보기 common-01) tierSince(x, viewer): 값 칸과 창은 보는 사람(me), 넘김 글은 'SHARED'
    tierSince: tierSince, tierSinceText: tierSinceText,
    checkEntries: checkEntries, checkOf: checkOf, canConfirm: canConfirm, saveCheck: saveCheck,
    exportsAll: exportsAll, recordExport: recordExport, popDownload: popDownload /* W7-6, 2026-11-16 */, sha256Hex: sha256Hex, csvLine: csvLine, download: download, whoText: whoText, watermark: watermark,
    // 점검 문제를 컴플라이언스에 넘기기(기획자 결정 2026-11-09 5회차 13번)
    issuesAll: issuesAll, issueTask: issueTask, pendingIssues: pendingIssues, complianceMailTo: complianceMailTo, raiseIssue: raiseIssue,
    ISSUE_HELP: ISSUE_HELP, issueToast: issueToast,
    // 줄임 변경의 참고 금액(2026-11-14 주말 점검 W7): 할인 예외 점검의 참고 표가 씀. 결재 문서 "변경 전과 후"도 같은 값을 쓰게 둠
    shrinkRef: shrinkRef,
    // (2026-11-14 주말 점검, 코드 다시 보기 review-01) 한 기능의 참고 금액 셈 글. 결재 문서 "변경 전과 후"와 할인 예외 점검 셋째 참고 표가 같은 글을 씀
    shrinkCalc: shrinkCalc,
  };
})();
