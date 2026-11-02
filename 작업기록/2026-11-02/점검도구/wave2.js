export const meta = {
  name: 'climb-decisions-wave2',
  description: 'Apply approval-flow decisions (E-3, B-3, A-10, A-11, B-5) to the engine, then window/draft/stats/admin decisions in parallel, then docs, review and fix',
  phases: [
    { title: 'Engine', detail: 'one agent: approval flow in common.js and data' },
    { title: 'Screens', detail: '4 agents, disjoint screen files' },
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
You are working on the "climb" CPQ+CLM HTML prototype at ${ROOT} (plain HTML/CSS/JS, no build). Data is window.CLIMB_DATA (D, prototype/assets/js/mock-data.js); shared helpers are window.CLIMB (C, prototype/assets/js/common.js). Demo state lives in localStorage keys climb.* (C.loadDemo / C.pushDemo / C.recordAction / C.saveDemoContract); ?role=X switches the demo role (SUPER = 최고관리자 can act on any step for demo purposes).
The approval engine: C.reviewRoute(c) decides which of ②~⑤ are routed; C.buildReview(c) builds c.approvals from c.history (actions APPROVE, REGISTER, REJECT, CANCEL, RETURN, SUPPLEMENT, RESUBMIT), groups D.REVIEW_GROUPS then D.POST_GROUPS, and recomputes c.status. C.stepUser(code, c, at) picks the handler. Steps are D.STEPS S01..S11. Docs: docs/01_요구사항정의서.md (REQ ids), 02 화면목록 (SCR ids), 03 데이터정의서, 06 통제목록 (CTL ids).
The planner (a non-developer compliance officer) answered a decision sheet today (2026-11-02). Read the decision sheet ${SHEET} (each item: "지금", options, "추천", "고르면 바뀌는 곳") and the recorded answers ${DEC}. Implement exactly what was chosen. Some answers differ from the sheet's recommendation; the decisions file is authoritative.
Earlier today another wave already changed the prototype for D-1..D-24 (screen proposals): e.g. C.stepTag(code, c) / C.stepWho(code, c) give who-handles names like "③ 영업 리더"; use them for any new step label you show. Read the current code, not your memory of it.

House rules (must follow):
- All UI text and code comments in plain, short Korean, matching the surrounding style. Use "·" sparingly, prefer commas. Dates as 2027-01-01. Amounts always right-aligned.
- Record every decision in a code comment near the change, e.g. "// 기획자 결정 2026-11-02 E-3: ...". Match the comment density of the file.
- The screen must not wobble (reserve heights, no jumps); touch targets at least 44px on phone; print is grayscale; key-value: labels subtle, data dark; non-body info in the existing gray info box style. Phone CSS media query: "screen and (max-width:600px), screen and (hover:none) and (pointer:coarse) and (max-height:600px)". Reuse existing components (modals, check lists, badges, pagers) before inventing.
- Never weaken an existing control. New required confirmations must be enforced (button disabled or validation message) and recorded in the approval record (history comment or a dedicated field) so they show in the 결재 기록.
- Demo data: when you add a new state, add or adjust 1-2 fictional mock contracts so the state can be seen in the demo (names must be fictional; do not copy real people). Keep existing demo flows working (a contract that could be pushed through all steps by SUPER must still go through).
- Do NOT edit anything under docs/ and do NOT add release notes to mock-data NOTICES. Instead return doc change requests (precise: which doc, which REQ/SCR/CTL/table id or section, what text should change, new fields with suggested column names for docs/03).
- Only edit the files you own (listed below). Shared files mock-data.js and common.js: when you own them only partially, keep edits small and localized, re-read the region right before each edit, never reformat. If you need a change in a file you do not own, put it in cross_file_requests.
- After editing JS, syntax-check each edited JS file with the PowerShell tool (node is not on the Bash PATH): & "C:\\Program Files\\Adobe\\Adobe Creative Cloud Experience\\libs\\node.exe" --check <full path>. Only --check; never execute the prototype files with node (they need a browser DOM). Do not start browsers or headless checks. Do not commit. Never run "python -" in any form.
- Do not call the task-list or wrap-up tools (update_plan, wrap_up); only the main session uses them. When a search finds nothing, that is not an error; prefer the Grep tool over shell grep.
`

const SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    done: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, what: { type: 'string' }, files: { type: 'array', items: { type: 'string' } } }, required: ['id', 'what', 'files'] } },
    api: { type: 'array', items: { type: 'string' }, description: 'new or changed helpers, data fields, history actions other agents must use (name, signature, meaning)' },
    doc_requests: { type: 'array', items: { type: 'object', properties: { doc: { type: 'string' }, where: { type: 'string' }, change: { type: 'string' } }, required: ['doc', 'where', 'change'] } },
    cross_file_requests: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, change: { type: 'string' } }, required: ['file', 'change'] } },
    gaps_filled: { type: 'array', items: { type: 'string' } },
    not_done: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'done', 'api', 'doc_requests', 'cross_file_requests', 'gaps_filled', 'not_done'],
}

phase('Engine')
const engine = await agent(COMMON + `
Your job: the approval-flow engine changes. You own common.js (whole file), mock-data.js (whole file except NOTICES), ops-queue.js, expiring.js, contract.js and their html, plus list.css if needed. Implement:

1) E-3 (A안, differs from the sheet's recommendation): when any product line's discount exceeds its 할인율 한도 by more than a threshold in %p, ③ needs two approvals in order: the unit leader (as now), then the COO (영업 임원, STEP_ASSIGNEE.S03 / EXEC). Amount does not matter. When the drafter is the leader himself or herself, ③ is already the COO: then one approval only (do not ask COO twice). The threshold is not known yet (it waits for real limits, E-4): put it in data as D.CHANGE... no, as a new admin value, e.g. D.ALERT_RULES-like object D.PRICE_RULES = { cooOverPp: 10 } marked [가정] in a comment, read through a helper so the admin screen can change it later (another agent adds the 결재선 규칙 field; expose C.cooOverPp() or similar and an applyAdmin case like the existing ones for ALERT_RULES values, area 'RULE'). Design the step: either a new step code (e.g. S03 then 'S3C' shown as "③ COO" — name it via STEPS with no '③-2' style confusion) placed in the same review group sequence right after ③ and before ④⑤, routed only when over threshold, with reason text "할인율 한도를 n%p 넘게 넘김"; or an equivalent. Make sure every place that enumerates review steps (REVIEW_ORDER, REVIEW_GROUPS, stats STEP_NAMES, progress dots, review-queue/검토 대기 for EXEC, 결재 문서 결재란, autoHistory, canAct/canCancel, pendingQueue/myActions, delegation) handles it. Note C-14 (③ 승인 창 이해관계 확인) applies to both ③ approvals (another agent adds the checkbox in review.js; you only make sure the step exists). Add one demo contract that routes to the COO.

2) B-3 (differs from recommendation): every 운영 변경 (CHANGE) gets ⑩ 재무 확인 after ⑨; the change is complete (계약 완료) only after ⑩ (REQ-CHG-10). For HR 충전 the ⑨ is already 재무 (수불부 반영); still add ⑩ but the ⑩ handler must not be the same person who did ⑨ (if the same, record the gap: assign ⑩ to 재무 리더 (FIN_LEAD) for HR changes — choose the safest option and report it). Update the skip reasons, stepIng, ops-queue (운영 검토 대기 shows ⑩ for changes), and the completion logic. 유상 충전 still has no ③ (재무 문서 확정 규칙).

3) B-4: 무상 충전 50건 기준 counts cumulatively per 계약 연도 (contract year counted from the bundle's current contract start date; year n = [start + (n-1) years, start + n years)). C.changeSales must use (already-approved and in-progress free charges of the same bundle and same contract year, not rejected/cancelled) + this request; reason text shows the cumulative number, e.g. "이번 계약 연도 무상 충전 누적 62건(이번 15건)이 50건을 넘음". Expose a helper C.freeChargeUsed(bundleId, onDate, excludeId) for the 기안 screen (another agent shows it).

4) A-10 만료 처리 차례: when a contract bundle's latest effective contract has passed its end date (status EXPIRED) and there is no renewal or new contract draft for it in progress or completed, a "만료 처리" turn goes to 고객지원 (CEM; HR 서비스도 고객지원). It uses the same check items as termination ⑨ (D.OPS_CHECKS_END per service) and records who/when like an approval (no ⑩, no 재무). Until done the contract shows "만료, 서비스 닫기 전" on 만료 예정 (SCR-43) and 계약 상세 (SCR-42) and appears in 운영 검토 대기 (SCR-34) for CEM like ⑨ items, with wait days. Choose a data model that fits the engine (e.g. bundle-level expiry record stored in a demo key, or history actions on the EXPIRED contract with a new step code like 'SXP' "만료 처리"); keep it visible in the contract's 결재 기록. Add/adjust demo data: one expired contract waiting for 만료 처리, one already closed.

5) A-11 유예: while 연장 협상 continues, the 영업대표 can request a grace period on an expired (or expiring within the 만료 처리 window) contract: 사유 (required) and 기한 (a date at most 30 days after the end date). The 영업 리더 of the drafter's unit confirms (리더 본인 계약이면 COO). While an approved grace is running, 만료 처리 is not anyone's turn and the contract shows "유예 중 (~기한)"; when the grace date passes, 만료 처리 becomes CEM's turn again. If a renewal is drafted, 만료 처리 stays off as in 4). Put the request button on 계약 상세 and 만료 예정 for the 영업대표, and the confirm action where the leader works (계약 상세 + a line in the leader's queue: choose 검토 대기 if it fits; report what you chose). Record everything (request, confirm/reject with reason) in the 결재 기록.

6) B-5 engine part: a contract can be marked "견적서로 계약서를 대신함" (c.quoteInstead = true) only when the total (공급가액 합계, VAT 제외 — check how totals are stored) is under 5,000,000원. In that case ⑦ uploads the 최종 견적서 (signed or stamped by the customer) instead of a 체결본, and ⑧ checks it with check items fitting a quote (define D.QUOTE_INSTEAD_CHECKS, e.g. 고객 날인이나 서명, 견적번호와 판, 금액과 품목이 결재한 견적과 같음, 유효기간 안). ⑥ 인장 날인 stays as now [가정] (who seals is decided when the 재무 문서 rules 2) and 3) are corrected; say so in a comment). Another agent adds the checkbox on the 계약 등록 screen; you expose C.quoteInsteadAllowed(c) and the 5,000,000 limit as data.

7) B-8 data part (the window agent adds the inputs): define C.signedDate(c) = the 서명본 체결일 stored as signDate on the latest S07 REGISTER history entry of the current round, falling back to the upload date (c.signedAt) when absent; C.signedAt stays the upload time. Define C.openDate(c) = openDate on the S09 APPROVE entry (null when absent). Carry h.signDate / h.openDate into the approval objects in buildReview like fileName is carried. Give a few demo contracts a signDate/openDate in autoHistory so stats and 결재 문서 show them (e.g. signDate a day or two before the upload).

Also keep A-2 in mind but do not implement it (stats agent does). Expose clear helpers and list them in "api" so the next agents (결재 창, 기안 화면, 통계, 관리자) can use them.`,
  { label: 'engine', phase: 'Engine', schema: SCHEMA })

phase('Screens')
const ENG = engine ? JSON.stringify({ done: engine.done, api: engine.api, gaps: engine.gaps_filled, not_done: engine.not_done }) : 'ENGINE AGENT FAILED: check the code yourself'
const SCREENS = [
  {
    key: 'window',
    files: 'review.js, review.html, review.css, signing.js, signing.html (only where the ⑦ upload, ⑧, ⑨, ⑩ dialogs live; find them first). common.js and mock-data.js: small localized additions only (e.g. new check-item lists, history fields).',
    task: `결재 문서와 결재 창 (SCR-23 and the step dialogs):
- C-14: ③ 승인 창 (both the unit leader and, if routed, the COO approval from E-3) gets a required checkbox "이 거래처와 개인적 이해관계가 없습니다" recorded in the approval record. Only ③ for now.
- C-15: ④ 법무 승인 창 for contracts whose checklist 1번 (표준계약서) is 아니요: choose "반부패 조항 있고 약해지지 않음" or "반부패 조항 없음" (+ 사유 required). Required when the contract method is 간접 or 조달 (check D.METHODS codes), optional for 직접. Recorded in the approval record and shown in 결재 문서. (Template flag "반부패 조항 있음" is added on 표준계약서 by another agent.)
- E-2: 결재 문서 gets a box "같은 거래처 최근 계약": other contracts with the same 사업자등록번호 whose 기안일 is within the last 90 days (excluding this contract and its own earlier rounds); restricted contracts the viewer cannot see show only as a count. When the box is not empty, the ② 승인 창 requires confirming "나눠 맺은 계약이 아님" (recorded). Add it as a new ② check item consistent with D.REVIEW_CHECKS handling.
- B-6: a "재무 의견" box outside the approval line: 재무 (FINANCE, FIN_LEAD, FIN_EXEC) can write an opinion on a contract in 2단계 계약 검토 or before ⑥ (checklist 4번 예 contracts especially; allow for any contract that 재무 can see); ②~④ see it in 결재 문서; ⑩ 창 shows it. Opinions are append-only with who/when. Show checklist 4번 type (5 kinds, added on the draft screen by another agent as c.checklist.acctTypes or similar — coordinate via the field name the 기안 agent reports; if unknown, read new-contract.js after the 기안 agent is done is NOT possible since you run in parallel: use field name c.checklist.acctKinds (array of codes) and D.ACCT_KINDS = [{code,label}] which the 기안 agent is told to use).
- B-8: ⑦ 체결본 등록 창 asks 서명본 체결일 (date on the signed copy, required, not in the future); ⑧ 창 adds a check item "서명본 체결일이 체결본과 같음"; ⑨ 창 asks 실제 개통일 (required for new/renewal/변경 contracts; for 해지 it is 실제 종료일 — or skip for 해지 if it does not fit; report). Store them on the history entries as h.signDate (S07 REGISTER) and h.openDate (S09 APPROVE) — the engine agent already defined C.signedDate(c) and C.openDate(c) reading exactly these fields; use them. 결재 문서 shows a gray warning when dates are out of order (서명본 체결일 < 승인일, 개통일 < 서명본 체결일, 서명본 체결일 > 올린 날).
- B-5 window part: when c.quoteInstead, ⑦ 창 label says 최종 견적서 and ⑧ uses the quote check items from the engine.
Engine agent report (use these helpers): ${'${ENG}'}`,
  },
  {
    key: 'draft',
    files: 'new-contract.js, new-contract.html, new-contract.css, ops-change.js, ops-change.html, form.css. mock-data.js: only D.ACCT_KINDS and anything the draft screens need.',
    task: `기안 화면 (SCR-11 계약 등록, SCR-14 운영 변경):
- A-3: in 계약 등록, when 변경 or 연장 is chosen, the 원계약 list shows only contracts whose 영업대표 is the current user (최고관리자 keeps all for demo). Update helper text.
- B-4: 운영 변경 기안 for 무상 충전 shows the cumulative free-charge count of the current contract year (use the engine helper) and whether this request will route ③.
- B-3 덧붙임: 유상 충전 기안: the user picks the 기능 and 수량; show the standard-price amount (표준 단가 × 수량, from the price book valid on that day) next to the entered amount and the discount rate; never block. CK has no real prices yet: show the comparison but mark "시연 가격" if the existing code marks demo prices; otherwise just show it.
- B-5: 계약 등록 gets a checkbox "견적서로 계약서를 대신함" that is enabled only when the 공급가액 합계 is under 5,000,000원 (use the engine helper/limit) and the 최종 견적서 is attached; explain the rule in a gray line; if the total rises above the limit afterwards, uncheck and explain. Saved as c.quoteInstead.
- B-6: checklist 4번 (회계 영향) when 예: pick one or more kinds from D.ACCT_KINDS = [{code:'FREE_PERIOD',label:'무상 기간'},{code:'FREE_EXTRA',label:'무상 추가 제공'},{code:'REFUND_RIGHT',label:'해지 환불권'},{code:'USAGE_FEE',label:'사용량이나 성과에 따른 대가'},{code:'RETURN',label:'반품이나 취소'}] (define it in mock-data.js) stored as c.checklist.acctKinds (array), plus the existing 비고 (still required). Show the chosen kinds wherever the 4번 비고 is shown on screens you own.
- E-1 is NOT in this wave.
Engine agent report (use these helpers): ${'${ENG}'}`,
  },
  {
    key: 'stats',
    files: 'stats.js, stats.html, stats.css. mock-data.js: only a demo store key for closing confirmations if needed (prefer C.loadDemo/pushDemo with a new DEMO_KEYS entry in common.js — small localized edit allowed).',
    task: `통계 (SCR-46):
- A-2: a round rejected at ⑧ is not counted as 체결 (amount and count); when it is re-drafted and signed again it counts then. Contracts waiting at ⑧ still count as now.
- B-8: 체결일 in stats is the 서명본 체결일 (C.signedDate(c), defined by the engine agent; it already falls back to the upload time) and the upload time is kept (show both where 체결일 is listed, e.g. in the detail table "체결일 (올린 날)").
- B-9: add "기간 마감 점검" to 통계: pick a period end date (default: last day of the previous month); list (a) contracts whose 체결일 is within ±5 days of the period end [가정, editable number], (b) contracts approved but not yet signed at the period end, (c) contracts waiting at ⑨ or ⑩ at the period end — each with amounts and totals; 재무 (FINANCE, FIN_LEAD, FIN_EXEC) records "확인" with an optional memo per period, stored append-only with who/when, shown as a record line; A4 print fits. Others can view but not confirm. Respect restricted-contract visibility rules exactly as the rest of stats does (count hidden ones).
Engine agent report: ${'${ENG}'}`,
  },
  {
    key: 'admin',
    files: 'admin-rules.js, admin-rules.html, admin-restrict.js, admin-restrict.html, templates.js, templates.html, notice-form.js, account.js, admin.css. common.js: only canView (A-9) and applyAdmin cases you need, small localized edits. mock-data.js: EMAIL_TYPES/MAIL_SAMPLES (E-12), template versions flag (C-15), ADMIN log samples (A-6).',
    task: `관리자 화면과 알림:
- A-5 (differs from recommendation): 결재선 규칙 (SCR-52) 독촉 기준 gets four more admin fields next to the existing two: 해지 통지 기한 강조 (noticeSoonDays 30), 해지 통지 기한 이메일 (noticeMailDays 30, 7), 의무 기한 강조 (obligationSoonDays 14), 의무 기한 이메일 (obligationMailDays 14, 3). Changes need a reason and are logged like the existing two; screens that use these values must read the current value (find where D.ALERT_RULES is read).
- E-3 field: same 독촉 기준 / 결재선 규칙 area gets "COO도 승인하는 기준: 할인율 한도를 n%p 넘게 넘김" using the engine's value and applyAdmin case [가정 10%p until real limits].
- A-6: posting, editing and taking down a notice writes the admin change log reason automatically as "공지 올림", "공지 고침", "공지 내림" (not "-"); no reason field.
- A-7: 결재선 규칙 "유닛 추가" lists only 2단계 units that have at least one sales person (SALES/HEAD role account) — i.e. 영업이 속한 유닛.
- A-9: an observer (OBSERVER) never sees restricted contracts even if designated as a 지정 열람자 (person or dept); remove observers from the 열람자 지정 people list (admin-restrict). Fix C.canView accordingly.
- C-15: 표준계약서 판 (SCR-45) gets a "반부패 조항 있음" flag per version (shown in the version list and the add-version dialog; current standard versions: set true for the demo).
- E-12: the 해지 통지 기한 e-mail (NOTICE_DEADLINE) goes to the 영업대표 at 30 and 7 days before (as now) and also to the drafter's unit leader at 7 days only (use the admin-set noticeMailDays: the leader gets only the last/smallest day). Update EMAIL_TYPES recipients, the mail sample, and 내 계정 받을 이메일 so a leader sees it as "내 역할에 오는 알림".
Engine agent report: ${'${ENG}'}`,
  },
]

const screens = await parallel(SCREENS.map(k => () => agent(
  COMMON + `\nYour cluster: ${k.key}\nFiles you own: ${k.files}\n${k.task.replace('${ENG}', ENG)}\n\nRead the relevant code first, implement, self-check your diff (git diff -- <files>), run node --check. Report what you did, api, doc requests, cross-file requests, gaps filled, not done.`,
  { label: 'screen:' + k.key, phase: 'Screens', schema: SCHEMA })))

const all = [{ key: 'engine', ...(engine || {}) }].concat(screens.map((r, i) => ({ key: SCREENS[i].key, ...(r || { summary: 'AGENT FAILED' }) })))
const cross = all.flatMap(r => (r.cross_file_requests || []).map(c => ({ from: r.key, ...c })))
let crossResult = null
if (cross.length) {
  crossResult = await agent(COMMON + `\nOther agents could not edit these files and asked for these changes. Apply each one if it is consistent with the decisions; skip with a reason otherwise. You may edit any prototype file (not docs). Requests:\n${JSON.stringify(cross, null, 1)}`,
    { label: 'screens:cross-file', phase: 'Screens', schema: SCHEMA })
}

phase('Docs')
const REPORTS = JSON.stringify(all.map(r => ({ key: r.key, done: r.done, api: r.api, doc_requests: r.doc_requests, gaps_filled: r.gaps_filled, not_done: r.not_done })).concat(crossResult ? [{ key: 'cross', done: crossResult.done, doc_requests: crossResult.doc_requests }] : []), null, 1)
const DOCRULES = `
You update planning docs in ${ROOT}\\docs. Rules: plain short Korean, same style as surrounding text. Markdown tables keep the same number of | cells per row (never a raw | inside a cell). "·" sparingly. A planner decision makes the related text confirmed and says "기획자 결정 2026-11-02 (결정 번호)". Where a decision differed from the sheet's recommendation (A-5, B-3, E-3), state the decision plainly; do not argue. Where an agent filled a gap with its own judgement, write it as the chosen detail and mark it [가정] if it is a value the planner has not given (e.g. COO 기준 10%p, 기간 마감 ±5일). Add one changelog row per doc for today (2026-11-02) — if a row for today already exists from an earlier wave, add a new version row (bump the version again) rather than editing the old one. Update the version line at the top of each doc you change. Keep 01 chapter 7 C-table and 05 chapter 4 / G-items status in step: close items fully decided ("해결 (짧은 결정 요약)"), say which parts wait (B-1, B-7, B-10, B-11, E-5, E-6 are 보류).
After editing run python -I tools/doc_check.py (cwd ${ROOT}) and fix problems in lines you touched. Do not commit. Never run "python -" in any form. Do not edit prototype files.
Decisions in this wave: A-2, A-3, A-5, A-6, A-7, A-9, A-10, A-11, B-3 (+금액 표시), B-4, B-5, B-6, B-8, B-9, C-14, C-15, E-2, E-3, E-12. Read them in ${DEC} and the sheet ${SHEET} ("고르면 바뀌는 곳" lists every doc place to change).
What the prototype now does (agent reports):\n${REPORTS}`

const docs = await parallel([
  () => agent(DOCRULES + `\nYour docs: 01_요구사항정의서.md and 02_화면목록.md only (another agent does 03, 04, 05, 06 at the same time). Update every REQ and C-item, add new REQ rows where needed (new IDs continue the existing numbering of that REQ group), update SCR descriptions and add SCR rows if a new screen or section appeared. Return a summary.`, { label: 'docs:01-02', phase: 'Docs' }),
  () => agent(DOCRULES + `\nYour docs: 03_데이터정의서.md (the planner edits it in Obsidian: re-read it right before each edit, touch only what is needed), 04_개발팀전달.md, 05_표준대응표.md, 06_통제목록.md only (another agent does 01 and 02 at the same time). 03: new fields/tables/codes (e.g. 서명본 체결일, 개통일, 재무 의견, 4번 종류 코드표, 반부패 조항 표시, ③ 이해관계 확인, ② 나눠 맺기 확인, 만료 처리 기록, 유예, 기간 마감 확인 기록, COO 기준 값, 알림 일수 관리 값, NOTICE_DEADLINE 받는 사람). 06: update the CTLs the sheet lists, add new CTLs for new controls (만료 처리, 유예, COO 승인, 기간 마감 확인, 재무 의견, 나눠 맺기 확인, 이해관계 확인, 반부패 조항), update counts in the summary lines if the doc keeps counts. 04: server tasks and launch notes. 05: G-item status. Return a summary.`, { label: 'docs:03-06', phase: 'Docs' }),
])

phase('Review')
const LENSES = [
  { key: 'fidelity', prompt: 'Lens: decision fidelity. For each decision of this wave (A-2, A-3, A-5, A-6, A-7, A-9, A-10, A-11, B-3, B-4, B-5, B-6, B-8, B-9, C-14, C-15, E-2, E-3, E-12) check the prototype does exactly what the planner chose and that docs 01/02/03/06 say the same thing.' },
  { key: 'engine', prompt: 'Lens: approval engine correctness. Trace C.buildReview for: a normal new contract, one over the COO threshold, a leader-own contract over threshold, an ops change (CK free over cumulative 50, HR paid), a termination, an auto renewal, a quote-instead contract, an expired contract waiting for 만료 처리, one in grace, one whose grace ended, a ⑧-rejected round re-drafted. Look for wrong status, steps never becoming PENDING, wrong handler (self-approval, same person ⑨ and ⑩), SUPER demo unable to push through, stats counting wrongly.' },
  { key: 'ui', prompt: 'Lens: runtime errors and house rules on screens changed in this wave (git diff -- prototype). Undefined helpers, null elements, duplicate ids, required confirmations not enforced or not recorded, screen wobble, 44px touch targets on phone, print, accessibility (labels, aria), Korean wording consistent with the rest.' },
]
const FIND = { type: 'object', properties: { findings: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, file: { type: 'string' }, detail: { type: 'string' }, fix: { type: 'string' } }, required: ['title', 'file', 'detail', 'fix'] } } }, required: ['findings'] }
const VERDICT = { type: 'object', properties: { real: { type: 'boolean' }, reason: { type: 'string' } }, required: ['real', 'reason'] }

const reviewed = await pipeline(LENSES,
  l => agent(`Review the uncommitted changes in ${ROOT} (git diff; last commit 89e5583; an earlier wave today changed D-1..D-24 screens — focus on this wave's decisions). ${COMMON}\n${l.prompt}\nReport only concrete, verifiable problems with file, detail and a precise fix. Do not edit files.`, { label: 'review:' + l.key, phase: 'Review', schema: FIND }),
  r => parallel((r ? r.findings : []).map(f => () => agent(`Adversarially verify this review finding in ${ROOT}. Read the actual code/docs. Default to real=false if you cannot confirm it concretely.\nFinding: ${JSON.stringify(f)}`, { label: 'verify:' + f.file.split(/[\\/]/).pop(), phase: 'Review', schema: VERDICT }).then(v => ({ ...f, verdict: v })))))

const confirmed = reviewed.flat().filter(Boolean).filter(f => f.verdict && f.verdict.real)
log(confirmed.length + ' confirmed findings')

phase('Fix')
let fix = null
if (confirmed.length) {
  fix = await agent(COMMON + `\nYou may edit any prototype file and docs/*.md (docs rules: keep table cell counts, plain Korean, re-read docs/03 before editing it, run python -I tools/doc_check.py after doc edits). Fix these confirmed findings, each precisely. Then run node --check on edited JS.\n${JSON.stringify(confirmed, null, 1)}`,
    { label: 'fix', phase: 'Fix', schema: SCHEMA })
}

return { all, cross: crossResult, docs, confirmed: confirmed.map(f => ({ title: f.title, file: f.file })), fix }
