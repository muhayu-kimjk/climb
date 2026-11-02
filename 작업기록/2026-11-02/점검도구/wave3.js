export const meta = {
  name: 'climb-decisions-wave3',
  description: 'Apply security and control decisions (new roles, audit view, checks, holds, company settings, quote seal) to the climb prototype, then docs, review and fix',
  phases: [
    { title: 'Foundation', detail: 'roles, permissions, menu and page skeletons' },
    { title: 'Screens', detail: '4 agents in parallel' },
    { title: 'Overview', detail: 'C-10 check box and E-15 change notes' },
    { title: 'Docs', detail: '01+02 and 03+04+05+06 in parallel' },
    { title: 'Review', detail: 'three lenses, adversarial verify' },
    { title: 'Fix', detail: 'apply confirmed fixes' },
  ],
}

const ROOT = 'C:\\Users\\kimjk\\Documents\\Claude\\Projects\\climb'
const S = 'C:\\Users\\kimjk\\AppData\\Local\\Temp\\claude\\C--Users-kimjk-Documents-Claude\\a0b99212-4c47-453d-90e5-91e3085fa12a\\scratchpad'
const SHEET = S + '\\climb_결정할것_한장.md'
const DEC = S + '\\decisions_2026-11-02.md'

const COMMON = `
You are working on the "climb" CPQ+CLM HTML prototype at ${ROOT} (plain HTML/CSS/JS, no build). Data is window.CLIMB_DATA (D, prototype/assets/js/mock-data.js); shared helpers are window.CLIMB (C, prototype/assets/js/common.js). Roles: D.ROLE_AREAS (2-level: 분야 + 등급), accounts D.ACCOUNTS (roles array), demo role switch ?role=X (SUPER = 최고관리자 sees every menu). Menu: MENU in common.js (roles per item; the top menu row must stay on ONE line on every screen size the project supports, including for SUPER who sees everything). Admin change log: C.adminSave(area, target, change, reason, op) / C.applyAdmin / D.ADMIN_LOG; demo state in localStorage via C.loadDemo / C.pushDemo (DEMO_KEYS in common.js). Docs: docs/01 (REQ ids), 02 (SCR ids), 03 데이터정의서, 06 통제목록 (CTL ids).
The planner (a non-developer compliance officer) answered a decision sheet today (2026-11-02). Read the decision sheet ${SHEET} (items C-1..C-16 and E-1..E-15: "지금", options, "추천", "고르면 바뀌는 곳") and the recorded answers ${DEC} (authoritative; includes the extra answer: a new 컴플라이언스 role). Earlier waves today already implemented D-1..D-24 and the approval-flow decisions (A-*, B-*, C-14, C-15, E-2, E-3, E-12): read the current code, not your memory.
What the previous wave already built that touches this wave (extend it, never duplicate or rebuild it; grep first): a "통제 지표" panel in stats (docs 01 REQ-DASH-23, written as G-26 / sheet C-1); "기간 마감 점검" in stats (B-9, REQ-DASH-22) whose confirmations 재무 records; the overview "점검할 일" box already lists the 정보보호 checks and 재무 기간 마감 (C-10 partly done); new step codes S03C (③ 영업 임원 승인, E-3, threshold D.PRICE_RULES.cooOverPp taken from the value in force at 기안 time), SXP (⑨ 만료 처리) and SGR (③ 만료 유예 확인) appended as phase-5 approvals; C.freeChargeUsed, C.isQuoteInstead, C.signedDate/C.openDate, D.QUOTE_INSTEAD, D.RECENT_SAME, D.ANTI_BRIBE, c.finOpinions (재무 의견), 위임전결 근거 field on 결재선 규칙. Approval-action helpers to make AUDIT fail include the new ones for 만료 처리 and 유예 (C.canCloseExpiry and the grace ask/decide checks) and 재무 의견 writing.
Sizes: all CSS sizes in rem (big monitors at 100% scaling scale rem by 17/15 through common.css; px sizes would not scale). Never write new font or box sizes in px.

House rules (must follow):
- All UI text and code comments in plain, short Korean, matching the surrounding style. "·" sparingly, prefer commas. Dates 2027-01-01. Amounts right-aligned. The product name is never written in body text (say "시스템").
- Record every decision in a code comment near the change, e.g. "// 기획자 결정 2026-11-02 C-2: ...". Match the comment density of the file.
- The screen must not wobble (reserve heights, no jumps); 44px touch targets on phone; print grayscale; labels subtle, data dark; non-body info in the existing gray info box. Phone CSS media query: "screen and (max-width:600px), screen and (hover:none) and (pointer:coarse) and (max-height:600px)". Reuse existing components (page skeleton of other admin pages, tables with C.pager if present, modals with required reason, badges) before inventing. New pages copy the head/skeleton of an existing admin page (e.g. admin-customers.html) and get a header comment like the others.
- Records of checks, confirmations, holds, exports are append-only (no edit/delete), with who/when, and show in a record list.
- Never weaken an existing control. Read-only roles must not get any action button anywhere (check every screen's action rendering, not just menus).
- Demo data: fictional names only (never copy real people). Add 1-3 demo rows so each new state can be seen.
- Do NOT edit anything under docs/ and do NOT add release notes to mock-data NOTICES. Return doc change requests (doc, id/section, change; new fields with suggested column names for docs/03; new screen ids for docs/02).
- Only edit files you own. Shared common.js / mock-data.js: small localized edits, re-read the region right before each edit, never reformat; if the Edit tool says the file changed, re-read and retry. Cross-file needs go to cross_file_requests.
- After editing JS, syntax-check each edited JS file with the PowerShell tool (node is not on the Bash PATH): & "C:\\Program Files\\Adobe\\Adobe Creative Cloud Experience\\libs\\node.exe" --check <full path>. Only --check; never execute the prototype files with node (they need a browser DOM). Do not start browsers or headless checks. Do not commit. Never run "python -" in any form.
- Do not call the task-list or wrap-up tools (update_plan, wrap_up); only the main session uses them. When a search finds nothing, that is not an error; prefer the Grep tool over shell grep.
`

const SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    done: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, what: { type: 'string' }, files: { type: 'array', items: { type: 'string' } } }, required: ['id', 'what', 'files'] } },
    api: { type: 'array', items: { type: 'string' } },
    doc_requests: { type: 'array', items: { type: 'object', properties: { doc: { type: 'string' }, where: { type: 'string' }, change: { type: 'string' } }, required: ['doc', 'where', 'change'] } },
    cross_file_requests: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, change: { type: 'string' } }, required: ['file', 'change'] } },
    gaps_filled: { type: 'array', items: { type: 'string' } },
    not_done: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'done', 'api', 'doc_requests', 'cross_file_requests', 'gaps_filled', 'not_done'],
}

phase('Foundation')
const found = await agent(COMMON + `
Your job: the foundation for this wave. You own mock-data.js (roles, accounts, demo users), common.js (roles, permission helpers, MENU, MENU_KEYWORDS, MENU_PARENT, canView), admin-users.js/html/css, admin-restrict.js. Implement:

1) 컴플라이언스 role (planner answer): new 분야 "컴플라이언스" with 담당자 role code COMPLIANCE in D.ROLE_AREAS (and ROLE_SHORT etc. follow automatically). It handles 거래처 확인 결과 (C-13), 보류 걸고 풀기 and 개선 과제 기록 (C-16). It does not handle any approval step. Add one fictional demo user/account with it (dept 경영지원유닛 is fine) and the ?role=COMPLIANCE demo persona if the project has a persona list (D.DEMO_PERSONA).

2) C-2 감사 열람 role (AUDIT, shown "감사 열람", solo area like 관찰자): sees every contract including restricted ones, full stats, the admin change log, and 접속 기록 점검 (SCR-57) read-only; it does nothing (no action anywhere). Only 최고관리자 (SUPER) can grant it, in 사용자 권한 관리, with a required reason and a required end date (at most e.g. 1 year [가정]); on the end date it is released automatically (a role whose end date has passed is ignored by C.hasRole and shown as "끝남" in history). Only 사내 사람; 외부감사인 get exported evidence (C-3) instead. The quarterly 권한 검토 must list AUDIT grants (who, why, until) and all 지정 열람자 (restricted-contract designated viewers) — expose helpers for the SCR-57 agent: C.auditGrants() and C.designatedViewersAll(). Fix C.canView (AUDIT sees all) and make sure every screen's action buttons are hidden for AUDIT (find the action helpers: canAct, canCancel, canResubmit, canAddObligation, canRecordObligation, canEditQuote, quote output, notice write, admin saves; AUDIT must fail all of them).

3) C-5 겹치면 안 되는 역할 조합: define D.ROLE_CONFLICTS (any two of ③ 영업 리더/임원 승인, ⑨ 고객지원, ⑩ 재무 for the same person; ③ together with ② or ⑧ 영업지원). The known substitute rules are NOT conflicts: 재무 doing ②⑧⑩ for 영업지원-drafted contracts, and 영업과 영업지원 겸임 (06 R-14). Expose C.roleConflicts(userId or roles[] + assignee/delegation context) returning the list of conflicts. On save in 사용자 권한 관리 (role change), warn with the conflict list and require a reason to proceed (allowed, logged). Another agent adds the same check on 결재선 규칙 assignee/delegation saves using your helper (put that in api). Also expose C.conflictAccounts() for the quarterly review list "역할 충돌 계정". REQ-AUTH-14 doc text "운영에서 최고관리자는 결재 단계를 처리하지 않음" is a doc request.

4) C-7: the role change dialog in 사용자 권한 관리 gets an optional "요청한 사람" field (pick a person) saved in the change history and shown in 권한 변경 이력.

5) Menu and skeleton pages for the new screens other agents fill in (create minimal pages with the standard skeleton, title, header comment, a gray info line saying what the screen is for, and a <section id="app"> or similar mount point; each loads its own JS file which you create with a minimal render that the screen agents will replace):
   - SCR-59 회사 설정 (company-settings.html, assets/js/company-settings.js): 최고관리자 edits company info; 총무 (GA) uploads the quote seal image. Visible to ADMIN? No: only SUPER and GA (and AUDIT read-only).
   - A new group 6 "점검" (screen ids SCR-61..SCR-65), one top menu item "점검" whose children are visible only to the people who own each check (plus SUPER for demo and AUDIT read-only):
     SCR-61 할인 예외 점검 (discount-review.html; 재무 임원 FIN_EXEC), SCR-62 영업기회 대사 (opp-recon.html; 영업지원 SALES_ADMIN/SA_LEAD), SCR-63 인장 기록 대사 (seal-recon.html; 총무 GA), SCR-64 개선 과제와 보류 (remediation.html; COMPLIANCE), SCR-65 설정 변경 확인 (config-review.html; 재무 리더 FIN_LEAD for 가격과 제품 rows, 법무 LEGAL for 표준계약서 rows).
   Check the top menu still fits on one line at 1000px and at the narrowest PC/tablet width the project supports (the menu row rule); if it does not fit, shorten labels or place 점검 differently and report. Add MENU_KEYWORDS for each new screen.
List every helper and page in "api".`,
  { label: 'foundation', phase: 'Foundation', schema: SCHEMA })

const FOUND = found ? JSON.stringify({ done: found.done, api: found.api, gaps: found.gaps_filled, not_done: found.not_done }) : 'FOUNDATION AGENT FAILED: read the code yourself'

phase('Screens')
const SCREENS = [
  {
    key: 'logs-stats',
    files: 'admin-logs.js/html (SCR-57), stats.js/html/css (SCR-46), admin-rules.js (only the C-5 conflict check on assignee and delegation saves), config-review.html + assets/js/config-review.js (SCR-65), contract.js (only the C-3 "결재 기록 묶음" button and its dialog).',
    task: `
- C-6: in SCR-57 최고관리자 can view but cannot approve/save a monthly log review or a quarterly access review that contains his or her own work; the monthly review gets a separate "최고관리자 작업" list (all SUPER actions of that month) which only 정보보호 담당자 (PRIVACY/SEC_LEAD) can approve. AUDIT sees SCR-57 read-only.
- C-2/C-5/C-7 in the quarterly review: show the AUDIT grants and all 지정 열람자 (foundation helpers), the "역할 충돌 계정" list (C.conflictAccounts()), and a "유닛 리더에게 계정 목록 보내기" action that records that the per-unit account lists were sent (send only, no reply needed; record who/when/which units).
- C-5 on 결재선 규칙: when saving an assignee or a delegation creates a role conflict, warn and require a reason (use the foundation helper).
- C-8: SCR-57 monthly review gets a "설정 변경" bundle listing that month's setting changes (area, target, before/after, reason, 품의 링크). SCR-65 설정 변경 확인: 재무 리더 confirms each 가격 기준 and 제품과 기능 change as "품의와 맞음" or "품의와 다름 (의견)"; 법무 confirms each 표준계약서 new version uploaded by someone else ("올린 사람이 아닌 법무"; if the viewer uploaded it, the button is disabled with an explanation); the monthly review shows whether these confirmations exist; 결재선 규칙 changes show the stated basis and whether the new assignee is outside the drafter's unit.
- C-1: stats keeps everything as is for everyone. A "통제 지표" panel already exists from the previous wave (read it first): extend and correct it rather than adding a second one, so that it is visible only to leaders (HEAD, SA_LEAD, SEC_LEAD, CEM_LEAD, FIN_LEAD), executives (EXEC, FIN_EXEC), AUDIT and SUPER: 평균 할인 by 영업, 유닛, 기관 종류, 계약 방식; 대리 결재 건수; 위험 신호 (같은 거래처와 30일 안에 두 건 이상; 분기 말 5일 안의 가격 예외). Respect restricted-contract rules like the rest of stats (AUDIT sees all).
- C-3: stats gets "통제 증빙 내보내기" for AUDIT (and SUPER demo): pick a period; produce a CSV download (Excel opens it; name the file .csv and say "엑셀에서 열림") containing 계약과 차수 (checklist answers, each step's handler, time, result), ③ 가격 예외, 4번 예 계약, ⑧ 결과, 가격과 권한 변경, 접속 기록 rows (several sections in one file is fine), with a header block: 실행 시각, 실행한 사람, 조건, 건수, 금액 합계, 파일 지문 (SHA-256 of the body via crypto.subtle), and a watermark line; each export is recorded (who/when/conditions/fingerprint) and listed. 계약 상세 gets "결재 기록 묶음" for people who can view the contract: a dialog listing what the bundle contains (결재 문서 PDF, 결재 기록 전체, 첨부 판과 지문, 그때의 가격 기준) with a download of a text/CSV manifest and a record of the export; say in the dialog that the real system makes a zip.
Foundation report: \${FOUND}`,
  },
  {
    key: 'compliance',
    files: 'admin-customers.js/html (SCR-55), remediation.html + assets/js/remediation.js (SCR-64), review.js (only hold blocking of remaining approvals), expiring.js and renewal.js (only hold display and blocking). common.js: hold and customer-check helpers.',
    task: `
- C-13: SCR-55 거래처 관리 gets a "확인" group for customers that need it: 국가와 지자체 (사업자등록번호 가운데 두 자리 83), 조달 contracts' customers, and 간접 (총판, 리셀러) partners — figure out from the data where 간접 partners and 조달 appear (contract method codes). Fields: 확인 상태 (확인 안 함 / 문제 없음 / 문제 있음), 계산한 위험 등급, results for 제재 명단, 부정적 보도, 실제 소유자, 공직자 관련 (result only: never store names of owners or officials), 확인한 사람, 날짜, 다음 확인일 (default 1 year), 증빙 (file name). Only COMPLIANCE (and SUPER demo) records; others with SCR-55 access view. Expose C.customerCheck(bizNo) → {needed, state, due, ...} and C.customerCheckNote(bizNo) for the 계약 등록 screen (the misc agent shows a warning there; never blocks).
- C-16: SCR-64 개선 과제와 보류: 개선 과제 기록 (원인, 조치, 책임자, 기한, 효과 확인, 끝낸 증거; states 열림 → 조치 중 → 효과 확인 → 끝남; append-only history) and 보류 (on a 거래처 by 사업자등록번호 or on a 계약 묶음; 사유 required; 걸고 푸는 사람 COMPLIANCE; both recorded). Expose C.holdOf(c) → active hold or null (checks both the bundle and the customer). While a hold is active: 새 기안 for that customer or bundle is blocked (the misc agent wires 계약 등록 using C.holdOf / C.customerHold(bizNo)), remaining approvals on its contracts cannot be approved (show why on 결재 문서; reject and 보완 요청 stay possible — say so), 계약 상세, 만료 예정, 연장 검토 show a hold badge and block new drafts (연장, 변경, 해지 buttons disabled with the reason). Add demo: one held customer, one open remediation item.
Foundation report: \${FOUND}`,
  },
  {
    key: 'discount-review',
    files: 'discount-review.html + assets/js/discount-review.js (SCR-61), and a small CSS block in admin.css or list.css if needed.',
    task: `
- C-9: SCR-61 할인 예외 점검 for 재무 임원 (FIN_EXEC; SUPER demo; AUDIT read-only). Pick a month (default: last month). List every contract that went through ③ 가격 예외 that month (including the COO approval from E-3 where routed): 계약번호, 고객사, 영업, 유닛, 계약 방식, 할인율 (최대 줄과 계약 전체), ③ 승인자와 일시, 대리 결재 여부. The reviewer enters a 한계값 (e.g. "할인율 n% 이상은 의견 필수") for the month; rows over it need an opinion. Each row: 의견 and 확인. Also one line each for that month's checklist 4번 예 contracts and terminations whose ⑩ is not done or was late (more than the approval delay days). Due date: end of the next month (show it; overdue shown). Records are append-only (confirming a row or the month cannot be undone). Restricted contracts: 재무 임원 normally sees restricted contracts only when 4번 is 예; for this check, list restricted rows too but with the customer name hidden (show "열람 제한") and only the fields needed for the check — this is a gap you fill; report it. A monthly "점검 마침" record when all rows are confirmed.
Foundation report: \${FOUND}`,
  },
  {
    key: 'sales-quote',
    files: 'new-contract.js/html (SCR-11: E-1 uniqueness, C-13 warning, C-16 hold block), opp-recon.html + assets/js/opp-recon.js (SCR-62), quote.js/html + quote.css (E-7), seal-recon.html + assets/js/seal-recon.js (SCR-63), company-settings.html + assets/js/company-settings.js (SCR-59). mock-data.js: company settings, seal image, demo upload rows, E-4 caps.',
    task: `
- E-1 ①: 영업기회번호 is used by one contract only (rounds after a rejection count as the same contract; 변경 and 연장 each have their own number as now). In 계약 등록, if the same number is on another customer's contract → block 기안 with the reason; if on another contract of the same customer → warn and require a reason (stored on the contract, shown in 결재 문서 if possible — if review.js is not yours, put that in cross_file_requests).
- E-1 ②: SCR-62 영업기회 대사: 영업지원 uploads the monthly 판다 수주 목록 file (demo: pick a CSV; also a "예시 파일로 해 보기" button that loads demo rows); the screen lists 계약이 없는 수주 and 수주 목록에 없는 계약 (only 수주 after the system start month D.SERVICE_START_MONTH), takes a 의견 per row and a final 확인; strip customer contact names and phone/e-mail columns on load (never stored); records append-only.
- C-13 and C-16 on 계약 등록: show the customer check state warning (C.customerCheck from the compliance agent; guard if undefined) and block 기안 when C.holdOf / C.customerHold says the customer or bundle is held.
- E-7 (differs from recommendation): every customer quote printed via "견적서 출력" carries the company seal image (from 회사 설정; if none uploaded, print without and warn the person printing); the output record gets "인장 찍음". 견적서 외부 전자서명 is closed (not done). Browser print (사내 인쇄) does not show the seal.
- E-7 ③: SCR-63 인장 기록 대사: 총무 sees per month the quote outputs that carried the seal (no., 판, 출력한 사람, 일시, 합계) and records a monthly 대조 확인 with the 인장 대장 (메모 optional); append-only.
- E-9: SCR-59 회사 설정: 사업자등록번호, 대표자, 주소, 대표 연락처 (and the ethics/report links that 03 8-9 lists, if present in data) edited by 최고관리자 with a required reason, logged in the admin change log; the seal image uploaded/replaced by 총무 with a reason, logged; shown on the quote's 공급자 칸 (replace the placeholder).
- E-8 note: the customer quote stays without the internal watermark (decided exception) — keep it that way.
- E-4: set the remaining demo caps 20% (카피킬러 캠퍼스 표절검사) and 15% (GPT Killer) to 0% [가정] like all other features until real limits arrive; then check every demo contract and quote whose stored checklist/cap logic depended on those caps still renders consistently (stored answers stay as they were; only new drafts use the new cap). IMPORTANT: lowering a cap must not reroute existing demo contracts. Today's engine routes ③ 가격 예외 and the new S03C ③ 영업 임원 승인 (over the cap by more than D.PRICE_RULES.cooOverPp %p) from discount vs cap; find how the cap is read for a contract (current D.PRICES/feature caps vs a cap stored or dated at 기안) and make existing contracts keep the cap in force at their 기안 date (e.g. a dated cap change record like D.PRICE_RULE_CHANGES, or the cap stored on the contract line), so 2610CL009 stays the only S03C demo and no old contract suddenly needs ③ or S03C. Report before/after routes of every demo contract that has a line on those two features.
Foundation report: \${FOUND}`,
  },
]

const screens = await parallel(SCREENS.map(k => () => agent(
  COMMON + `\nYour cluster: ${k.key}\nFiles you own: ${k.files}\n${k.task.replace('\${FOUND}', FOUND)}\n\nRead the relevant code first, implement, self-check your diff, run node --check. Report what you did, api, doc requests, cross-file requests, gaps filled, not done.`,
  { label: 'screen:' + k.key, phase: 'Screens', schema: SCHEMA })))

const all = [{ key: 'foundation', ...(found || {}) }].concat(screens.map((r, i) => ({ key: SCREENS[i].key, ...(r || { summary: 'AGENT FAILED' }) })))

phase('Overview')
const API = JSON.stringify(all.map(r => ({ key: r.key, api: r.api, done: r.done })))
const overview = await agent(COMMON + `
Your job runs after all other agents of this wave. You may edit dashboard.js/css/index.html, notice-form.js, notices.js, notice.js, common.js (a small helper for change notes), mock-data.js (NOTICES fields for the demo of E-15 only, not new release notes) and any page's gray info box insertion point via a shared helper. Also apply the cross-file requests listed at the end if consistent with the decisions.
- C-10 (the box already shows the 정보보호 checks and 재무 기간 마감 from the previous wave; add the rest, do not rebuild): the overview "점검할 일" box goes to everyone who owns a check and shows only that person's checks with due dates and links: existing 정보보호 checks (이상 행위 알림, 매월 기록 점검, 분기 권한 검토), 할인 예외 점검 (재무 임원, monthly, due end of next month), 영업기회 대사 (영업지원, monthly), 기간 마감 확인 (재무, per closing; it lives in 통계), 설정 변경 확인 (재무 리더, 법무), 인장 기록 대사 (총무, monthly). 매출 대사 is on hold (B-7): do not add it. 최고관리자 keeps seeing all for demo. Keep the box's fixed layout rules.
- E-15: release notes can name 바뀐 화면 (pick SCR ids) and 보일 기간 (default 14 days) in the notice write dialog; during that period each named screen shows one "바뀐 점" line (the release title + link to the notice) in its gray info box; screens without a gray info box (e.g. 내 계정) show it as a single subtle line right under the page title. No popups, no counts. Add the fields to one existing demo release note so it can be seen (e.g. on 결재선 규칙 or 내 계정).
APIs from this wave: ${API}
Cross-file requests: ${JSON.stringify(all.flatMap(r => (r.cross_file_requests || []).map(c => ({ from: r.key, ...c }))))}`,
  { label: 'overview', phase: 'Overview', schema: SCHEMA })

phase('Docs')
const REPORTS = JSON.stringify(all.concat(overview ? [{ key: 'overview', ...overview }] : []).map(r => ({ key: r.key, done: r.done, api: r.api, doc_requests: r.doc_requests, gaps_filled: r.gaps_filled, not_done: r.not_done })), null, 1)
const DOCRULES = `
You update planning docs in ${ROOT}\\docs. Rules: plain short Korean, same style as surrounding text. Markdown tables keep the same number of | cells per row (never a raw | inside a cell). "·" sparingly. A planner decision makes the related text confirmed and says "기획자 결정 2026-11-02 (결정 번호)". E-7 differs from the sheet's recommendation: state it plainly. Gaps filled by agents become the chosen detail, marked [가정] when it is a value the planner has not given. Add one changelog row per doc for today: if today's rows already exist from earlier waves, add a new version row (bump the version again). Update the version line at the top. Keep 01 chapter 7 C-table and chapter 8 rows, and 05 chapter 4 / G-items in step: close fully decided items ("해결 (짧은 결정 요약)"), mark waiting parts (B-7 매출 대사 보류, E-5, E-6 보류).
After editing run python -I tools/doc_check.py (cwd ${ROOT}) and fix problems in lines you touched. Do not commit. Never run "python -" in any form. Do not edit prototype files.
Decisions in this wave: 컴플라이언스 역할 (planner answer), C-1, C-2, C-3, C-5, C-6, C-7, C-8, C-9, C-10, C-13, C-16, E-1, E-4, E-7, E-9, E-15. Read them in ${DEC} and ${SHEET} ("고르면 바뀌는 곳").
What the prototype now does (agent reports):\n${REPORTS}`

const docs = await parallel([
  () => agent(DOCRULES + `\nYour docs: 01_요구사항정의서.md and 02_화면목록.md only (another agent does 03-06 now). 01: 4.1 역할 표 (컴플라이언스 담당자, 감사 열람), REQ-AUTH-14/18, REQ-ADM-*, REQ-DASH-16/17/21, new REQ rows, C-05/C-28/C-33 and chapter 8 rows. 02: new group 6 "점검" and SCR-59, SCR-61..65 rows (시안 완료 or 예정 as built), menu structure text, updated SCR descriptions. Return a summary.`, { label: 'docs:01-02', phase: 'Docs' }),
  () => agent(DOCRULES + `\nYour docs: 03_데이터정의서.md (re-read right before each edit; the planner edits it in Obsidian; touch only what is needed), 04_개발팀전달.md, 05_표준대응표.md, 06_통제목록.md only. 03: CODE-ROLE (COMPLIANCE, AUDIT with end date), new tables (거래처 확인, 보류, 개선 과제, 영업기회 대사 기록, 인장 기록 대사, 회사 설정 seal image, 내보내기 실행 기록, 설정 변경 확인, 할인 예외 점검 기록 if built), 8-4 notice change-note fields, 7장 권한. 06: CTLs listed in the sheet (CTL-16, 78, 79, 83, 84, 110, 111, 113, 114, 123, 127, 128, 130, 131, 132, R-03, R-11, R-12 ...) and new CTLs; 04: server tasks (export fingerprint, AUDIT auto-release, seal image handling). 05: G-item status. Return a summary.`, { label: 'docs:03-06', phase: 'Docs' }),
])

phase('Review')
const LENSES = [
  { key: 'fidelity', prompt: 'Lens: decision fidelity for this wave (컴플라이언스 역할, C-1, C-2, C-3, C-5, C-6, C-7, C-8, C-9, C-10, C-13, C-16, E-1, E-4, E-7, E-9, E-15): prototype does exactly what was chosen and docs 01/02/03/06 agree.' },
  { key: 'access', prompt: 'Lens: access control. For each role (SALES, HEAD, EXEC, SALES_ADMIN, SA_LEAD, LEGAL, PRIVACY, SEC_LEAD, GA, CEM, CEM_LEAD, FINANCE, FIN_LEAD, FIN_EXEC, OBSERVER, ADMIN, SUPER, COMPLIANCE, AUDIT) check menus, page guards (opening a page by URL), action buttons, and restricted-contract visibility. AUDIT must never have an action; expired AUDIT grants must stop working; SUPER cannot approve reviews containing own work; holds really block what they should.' },
  { key: 'ui', prompt: 'Lens: runtime errors and house rules on screens changed or created in this wave (git diff and new untracked files under prototype/). Undefined helpers, null elements, duplicate ids, pages missing a script/style, top menu row breaking into two lines (estimate from label lengths and CSS), screen wobble, 44px touch on phone, print, accessibility, Korean wording.' },
]
const FIND = { type: 'object', properties: { findings: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, file: { type: 'string' }, detail: { type: 'string' }, fix: { type: 'string' } }, required: ['title', 'file', 'detail', 'fix'] } } }, required: ['findings'] }
const VERDICT = { type: 'object', properties: { real: { type: 'boolean' }, reason: { type: 'string' } }, required: ['real', 'reason'] }
const reviewed = await pipeline(LENSES,
  l => agent(`Review the uncommitted changes in ${ROOT} (git status and git diff; last commit 89e5583; earlier waves today did D-* and A/B approval-flow items — focus on this wave). ${COMMON}\n${l.prompt}\nReport only concrete, verifiable problems with file, detail and a precise fix. Do not edit files.`, { label: 'review:' + l.key, phase: 'Review', schema: FIND }),
  r => parallel((r ? r.findings : []).map(f => () => agent(`Adversarially verify this review finding in ${ROOT}. Read the actual code/docs. Default to real=false if you cannot confirm it concretely.\nFinding: ${JSON.stringify(f)}`, { label: 'verify:' + f.file.split(/[\\/]/).pop(), phase: 'Review', schema: VERDICT }).then(v => ({ ...f, verdict: v })))))
const confirmed = reviewed.flat().filter(Boolean).filter(f => f.verdict && f.verdict.real)
log(confirmed.length + ' confirmed findings')

phase('Fix')
// 앞 묶음(wave 2)이 남긴 작은 일: 확인된 문제와 함께 고침
const LEFTOVERS = [
  'B-5: on quote-instead contracts (C.isQuoteInstead) the 결재 문서 still lists a made-up "계약서 초안" file; show the 최종 견적서 file instead (or no draft file), matching what 계약 등록 stores when the box is ticked.',
  'B-5: on quote-instead contracts the ⑥ window text still says "계약서 실물"; say "견적서" there (⑥ itself is unchanged, [가정] already noted).',
  'A-3: in the 계약 등록 route preview, ⑦ reads "영업 (나)" when 최고관리자 drafts on behalf of another 영업대표; show that 영업대표 name instead of "(나)".',
]
const fix = await agent(COMMON + `\nYou may edit any prototype file and docs/*.md (docs rules: keep table cell counts, plain Korean, re-read docs/03 before editing it, run python -I tools/doc_check.py after doc edits). Fix these confirmed findings precisely, then the leftovers from the previous wave. Then run node --check on edited JS.\nConfirmed findings:\n${JSON.stringify(confirmed, null, 1)}\nLeftovers:\n${JSON.stringify(LEFTOVERS, null, 1)}`, { label: 'fix', phase: 'Fix', schema: SCHEMA })
return { all, overview, docs, confirmed: confirmed.map(f => ({ title: f.title, file: f.file })), fix }
