/* =====================================================================
 * 체결 후 의무 화면 조각 (obligation-ui.js, v0.53 기획자 결정, 요구사항 정의서 REQ-FLOW-33~36)
 * ---------------------------------------------------------------------
 * 의무 관리(SCR-48)와 계약 상세(SCR-42)가 함께 씀
 *   - 배지와 기한 칸: 종류(보안 의무, SLA, 청구 일정), 상태(기한 지남, D-n, 예정, 일이 생기면, 모두 함, 끝냄)
 *   - 창: 의무 더하기, 이행 기록 남기기, 끝내기, 이행 기록 보기
 * 더한 의무와 이행 기록은 고치거나 지우지 않음. 그만 챙길 때는 사유를 적어 끝냄
 * 프로토타입: 바꾼 내용은 이 브라우저에만 저장(시연 기록). 실제 시스템은 서버에 저장하고 기한 알림을 보냄
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const esc = C.esc;
  function val(f, n) { const el = f.elements[n]; return el ? String(el.value || '').trim() : ''; }
  function show(f, name, on) { const el = f.querySelector('[data-field="' + name + '"]'); if (el) el.hidden = !on; }
  function won(n) { return Number(n).toLocaleString('ko-KR') + '원'; }

  function kindBadge(o) { const k = D.OBLIGATION_KINDS[o.kind] || {}; return C.badge(k.tone || 'line', k.label || o.kind); }
  function stateBadge(o) { const s = C.obligationState(o); return C.badge(s.tone, s.label); }
  // 기한 칸: 다음 기한(아직 하지 않은 가장 이른 것)과 상태, 되풀이는 "4/5번 함"
  function dueHtml(o) {
    const s = C.obligationState(o);
    const top = s.next ? '<span class="keep">' + C.fmtDate(s.next) + '</span>' : s.code === 'EVENT' ? '상시' : '-';
    const sub = s.code === 'EVENT' ? '기록 ' + s.done + '건'
      : s.total > 1 ? s.done + '/' + s.total + '번 함' : '';
    return top + '<span class="cell-meta">' + C.badge(s.tone, s.label) + (sub ? ' ' + esc(sub) : '') + '</span>';
  }
  // 의무 칸: 이름, 종류, 근거 조항, 언제, 청구 금액
  function titleHtml(o) {
    return '<span class="cell-strong">' + esc(o.title) + '</span>' +
      '<span class="cell-meta">' + kindBadge(o) + ' ' + esc(C.obligationWhenText(o)) + (o.clause ? ', ' + esc(o.clause) : '') +
      (o.amount ? ', ' + won(o.amount) : '') + '</span>';
  }

  /* ---------- 의무 더하기 ---------- */
  const EVERY = [['1', '달마다'], ['3', '분기마다'], ['6', '6달마다'], ['12', '해마다']];
  function openAdd(root, me, onDone) {
    const b = C.bundleOf(root.id);
    const kinds = Object.keys(D.OBLIGATION_KINDS).filter(function (k) { return C.canAddObligation(me, root, k); });
    const presets = function (kind) {
      return [['', '직접 적기']].concat(D.OBLIGATION_PRESETS.map(function (p, i) { return [String(i), p.title]; })
        .filter(function (op) { return D.OBLIGATION_PRESETS[Number(op[0])].kind === kind; }));
    };
    C.formModal({
      title: '이 계약에 의무를 더할까요?',
      desc: '더하면 맡은 분야가 의무 관리에서 챙기고 기한 전에 이메일을 받습니다. 더한 의무는 지우지 않고 끝내기만 합니다.',
      body: '<div class="field-row">' +
          C.fieldHtml({ name: 'kind', label: '종류', type: 'select', required: true, options: kinds.map(function (k) { return [k, D.OBLIGATION_KINDS[k].label + '(' + D.ROLE_AREA[D.OBLIGATION_KINDS[k].owner] + ')']; }),
            help: '괄호 안은 맡는 분야입니다.' }) +
          C.fieldHtml({ name: 'preset', label: '자주 쓰는 의무', type: 'select', options: presets(kinds[0]), help: '고르면 아래 칸이 채워집니다. 계약서 조항에 맞게 고치세요.' }) +
        '</div>' +
        C.fieldHtml({ name: 'title', label: '의무', required: true, placeholder: '예: 달마다 SLA 보고서(가용률) 보내기' }) +
        C.fieldHtml({ name: 'clause', label: '근거 조항', placeholder: '예: SLA 제4조' }) +
        C.fieldHtml({ name: 'when', label: '언제', type: 'select', required: true, options: Object.keys(D.OBLIGATION_WHEN).map(function (k) { return [k, D.OBLIGATION_WHEN[k]]; }) }) +
        C.fieldHtml({ name: 'due', label: '기한', type: 'date', required: true, help: '이날까지 합니다. 14일 전과 3일 전에 맡은 분야에 이메일이 갑니다.' }) +
        '<div class="field-row">' +
          C.fieldHtml({ name: 'first', label: '첫 기한', type: 'date', required: true }) +
          C.fieldHtml({ name: 'every', label: '되풀이', type: 'select', required: true, options: EVERY, help: '계약이 끝나는 날(' + C.fmtDate(b && b.end) + ')까지 되풀이합니다.' }) +
        '</div>' +
        C.fieldHtml({ name: 'within', label: '얼마 안에', required: true, placeholder: '예: 알게 된 때부터 4시간 안', help: '일이 생기면 하는 의무는 기한이 없고, 생길 때마다 이행 기록을 남깁니다.' }) +
        C.fieldHtml({ name: 'amount', label: '청구 금액', unit: '원', placeholder: '예: 36000000', help: '부가세 별도. 이메일에는 금액을 넣지 않습니다.' }),
      btn: '의무 더하기',
      open: function (f) {
        function sync() {
          const w = val(f, 'when');
          show(f, 'due', w === 'ONCE'); show(f, 'first', w === 'REPEAT'); show(f, 'every', w === 'REPEAT'); show(f, 'within', w === 'EVENT');
          show(f, 'amount', val(f, 'kind') === 'BILLING');
        }
        f.addEventListener('change', function (e) {
          if (e.target.name === 'kind') {
            f.elements.preset.innerHTML = presets(val(f, 'kind')).map(function (op) { return '<option value="' + op[0] + '">' + esc(op[1]) + '</option>'; }).join('');
          }
          if (e.target.name === 'preset' && val(f, 'preset') !== '') {
            const p = D.OBLIGATION_PRESETS[Number(val(f, 'preset'))];
            f.elements.title.value = p.title;
            f.elements.when.value = p.when;
            if (p.everyMonths) f.elements.every.value = String(p.everyMonths);
            f.elements.within.value = p.within || '';
            if (p.afterEndDays && b && b.end) f.elements.due.value = C.addDays(b.end, p.afterEndDays); // 계약이 끝난 뒤 n일
          }
          sync();
        });
        sync();
      },
      check: function (f) {
        const w = val(f, 'when'), amt = val(f, 'amount').replace(/,/g, '');
        return {
          title: val(f, 'title') ? '' : '의무를 적으세요.',
          due: w === 'ONCE' && !val(f, 'due') ? '기한을 고르세요.' : '',
          first: w === 'REPEAT' && !val(f, 'first') ? '첫 기한을 고르세요.' : '',
          within: w === 'EVENT' && !val(f, 'within') ? '얼마 안에 하는지 적으세요.' : '',
          amount: val(f, 'kind') === 'BILLING' && amt && !/^\d+$/.test(amt) ? '금액은 숫자만 적으세요.' : '',
        };
      },
      done: function (f) {
        const w = val(f, 'when'), amt = val(f, 'amount').replace(/,/g, '');
        const o = C.addObligation({
          bundle: root.id, kind: val(f, 'kind'), title: val(f, 'title'), clause: val(f, 'clause'), when: w,
          due: w === 'ONCE' ? val(f, 'due') : undefined, first: w === 'REPEAT' ? val(f, 'first') : undefined,
          everyMonths: w === 'REPEAT' ? Number(val(f, 'every')) : undefined, within: w === 'EVENT' ? val(f, 'within') : undefined,
          amount: val(f, 'kind') === 'BILLING' && amt ? Number(amt) : undefined,
        }, me);
        C.toast('의무를 더했습니다. ' + C.obligationOwnerLabel(o) + ' 분야가 챙깁니다.');
        if (onDone) onDone(o);
      },
    });
  }

  /* ---------- 이행 기록 남기기 ---------- */
  const NOTE_EX = { SECURITY: '예: 파기 확인서를 받아 보관함(문서 번호 SEC-2026-031)', SLA: '예: 9월 가용률 99.9% 보고서를 고객 담당 메일로 보냄', BILLING: '예: 세금계산서 발행(2026-10-30)' };
  function openRecord(o, me, onDone) {
    const s = C.obligationState(o);
    const doneFor = (o.records || []).map(function (r) { return r.for; });
    const open = C.obligationDues(o).filter(function (d) { return doneFor.indexOf(d) < 0; }).slice(0, 6);
    C.formModal({
      title: '이행 기록을 남길까요?',
      desc: o.title + '. 남긴 기록은 고치거나 지울 수 없습니다.',
      body: (o.when === 'EVENT' ? '' : C.fieldHtml({ name: 'for', label: '어느 기한의 것', type: 'select', required: true, value: s.next,
          options: open.map(function (d) { return [d, C.fmtDate(d) + (C.daysUntil(d) < 0 ? ' (기한 지남)' : '')]; }) })) +
        C.fieldHtml({ name: 'note', label: o.when === 'EVENT' ? '무슨 일이 있었고 무엇을 했는지' : '한 일과 근거', type: 'textarea', required: true, placeholder: NOTE_EX[o.kind] || '' }),
      btn: '이행 기록 남기기',
      check: function (f) { return { note: val(f, 'note') ? '' : '한 일을 적으세요.' }; },
      done: function (f) {
        C.recordObligation(o, o.when === 'EVENT' ? null : val(f, 'for'), val(f, 'note'), me);
        C.toast('이행 기록을 남겼습니다(고칠 수 없음).');
        if (onDone) onDone(o);
      },
    });
  }

  /* ---------- 끝내기 ---------- */
  function openEnd(o, me, onDone) {
    C.formModal({
      title: '이 의무를 끝낼까요?',
      desc: '끝내면 더 이상 기한 이메일을 보내지 않습니다. 의무와 이행 기록은 지우지 않고 남습니다.',
      body: C.fieldHtml({ name: 'reason', label: '끝내는 사유', type: 'textarea', required: true, placeholder: '예: 계약 해지로 남은 SLA 보고서를 보내지 않기로 고객과 합의(2026-11-30)' }),
      btn: '끝내기', tone: 'danger',
      check: function (f) { return { reason: val(f, 'reason') ? '' : '사유를 적으세요.' }; },
      done: function (f) {
        C.endObligation(o, val(f, 'reason'), me);
        C.toast('의무를 끝냈습니다.');
        if (onDone) onDone(o);
      },
    });
  }

  /* ---------- 이행 기록 보기 ---------- */
  function openHistory(o) {
    const recs = (o.records || []).slice().sort(function (a, b) { return b.at.localeCompare(a.at); });
    const line = function (k, v) { return '<div><dt>' + esc(k) + '</dt><dd>' + v + '</dd></div>'; };
    C.formModal({
      title: o.title,
      desc: '맡은 분야와 이행 기록입니다. 기록은 고치거나 지울 수 없습니다.',
      body: '<dl class="ob-info">' + line('종류', kindBadge(o)) + line('언제', esc(C.obligationWhenText(o))) +
          (o.clause ? line('근거 조항', esc(o.clause)) : '') + (o.amount ? line('청구 금액', won(o.amount) + ' (부가세 별도)') : '') +
          line('맡은 분야', esc(C.obligationOwnerLabel(o)) + '(담당자와 리더)') + line('상태', stateBadge(o)) +
          line('더한 사람', esc(C.ownerLabel(o.by)) + ', ' + C.fmtDateTime(o.at)) +
          (o.endedAt ? line('끝냄', esc(C.ownerLabel(o.endedBy)) + ', ' + C.fmtDateTime(o.endedAt) + '<span class="cell-meta">' + esc(o.endReason) + '</span>') : '') +
        '</dl>' +
        '<div class="tbl-scroll"><table class="tbl tbl--compact"><caption class="sr-only">이행 기록: 기한, 남긴 때, 남긴 사람, 한 일</caption>' +
        '<thead><tr><th scope="col">기한</th><th scope="col">남긴 때</th><th scope="col">남긴 사람</th><th scope="col">한 일</th></tr></thead><tbody>' +
        (recs.length ? recs.map(function (r) {
          return '<tr><td class="center nowrap">' + (r.for ? C.fmtDate(r.for) : '-') + '</td><td class="center">' + C.fmtDateTime(r.at) + '</td>' +
            '<td class="center">' + esc(C.ownerLabel(r.by)) + '</td><td>' + esc(r.note) + '</td></tr>';
        }).join('') : '<tr><td class="empty-row" colspan="4">아직 이행 기록이 없습니다.</td></tr>') + '</tbody></table></div>',
      btn: false,
    });
  }

  // 할 일 버튼: 이행 기록(맡은 분야), 기록 보기(모두), 끝내기
  function actionsHtml(o, me, root) {
    const s = C.obligationState(o);
    const live = ['ENDED', 'DONE'].indexOf(s.code) < 0;
    // 좁은 칸에 들어가게 한 줄에 하나씩(ob-acts)
    return '<span class="ob-acts">' + (live && C.canRecordObligation(me, o) ? '<button type="button" class="link-act" data-ob-rec="' + o.id + '">이행 기록</button>' : '') +
      '<button type="button" class="link-act" data-ob-view="' + o.id + '">기록 보기</button>' +
      (live && C.canEndObligation(me, o, root) ? '<button type="button" class="link-act link-act--danger" data-ob-end="' + o.id + '">끝내기</button>' : '') + '</span>';
  }
  // 표 안의 버튼 연결: container 안의 data-ob-* 버튼을 누르면 창을 열고, 끝나면 rerender
  function wire(container, me, rerender) {
    container.addEventListener('click', function (e) {
      const b = e.target.closest('[data-ob-rec], [data-ob-view], [data-ob-end]');
      if (!b) return;
      const id = b.getAttribute('data-ob-rec') || b.getAttribute('data-ob-view') || b.getAttribute('data-ob-end');
      const o = D.OBLIGATIONS.find(function (x) { return x.id === id; });
      if (!o) return;
      if (b.hasAttribute('data-ob-rec')) openRecord(o, me, rerender);
      else if (b.hasAttribute('data-ob-end')) openEnd(o, me, rerender);
      else openHistory(o);
    });
  }

  window.CLIMB_OB = { kindBadge: kindBadge, stateBadge: stateBadge, dueHtml: dueHtml, titleHtml: titleHtml, won: won,
    openAdd: openAdd, openRecord: openRecord, openEnd: openEnd, openHistory: openHistory, actionsHtml: actionsHtml, wire: wire };
})();
