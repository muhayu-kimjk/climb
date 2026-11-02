/* =====================================================================
 * 공지사항 글쓰기와 고치기 (notice-form.js, 공지사항 목록 SCR-91과 글 보기 SCR-92가 함께 씀)
 * ---------------------------------------------------------------------
 * 관련: 요구사항 정의서 REQ-UI-29(공지사항), v0.45 기획자 결정
 *   - 쓰기, 고치기, 내리기는 관리자와 최고관리자만. 모두 관리자 변경 이력(NOTICE)에 남음
 *     기획자 결정 2026-11-02 A-6: 공지는 사유 칸을 두지 않고 "공지 올림", "공지 고침", "공지 내림"을 사유로 남김(REQ-ADM-10의 예외).
 *       공지는 설정이 아니라 알리는 글이라 내용이 곧 사유. 내림은 notice.js, 예전 "-" 기록은 common.js applyAdmin이 같은 글로 맞춤
 *   - 구분: 공지(내용은 문단) / 릴리즈(버전 + 새 기능, 개선, 바뀐 규칙, 고친 문제. 한 줄에 하나). v0.47: "릴리즈 노트"를 "릴리즈"로 줄임
 *   - 제목(v0.47 기획자 요청): 휴대폰(아이폰 18 Pro) 목록 한 줄에 다 보이게 10자 안팎으로 짧게(릴리즈는 버전을 빼고).
 *     402px 폭에서 재 보니 "중요" 표시가 붙은 공지는 12자면 잘리고 10자는 들어감.
 *     막지는 않고 도움말에 지금 글자 수를 보여 줌. 아주 긴 제목만 20자에서 막음
 *   - 중요 공지: 제목 앞에 "중요"가 붙고 전체 사용자에게 이메일로 알림(REQ-ENV-10 ⑧). 개요의 최근 공지 한 줄은 v0.59에 없앰. 시안은 보낸 것으로만 표시
 *   - 맨 위 고정(기획자 결정 2026-11-02 D-20): 중요 공지만 공지사항 1쪽 맨 위에 고정. 글을 쓸 때 고정이 끝나는 날(pinUntil)을 정함.
 *     "중요 공지"를 체크해야 칸을 쓸 수 있고(체크하지 않으면 흐리게 잠금, 칸은 그 자리에 늘 있어 창이 흔들리지 않음),
 *     처음 값은 오늘부터 14일 뒤, 오늘이나 그 뒤만 고를 수 있음. 데이터 정의서 notice 표의 pin_until(제안)
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;

  function val(f, n) {
    const el = f.elements[n];
    if (!el) return '';
    return el.type === 'checkbox' ? el.checked : String(el.value || '').trim();
  }
  function lines(t) { return String(t || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }
  function canWrite(me) { return me.role === 'SUPER' || C.hasRole(me, ['ADMIN']); }
  const TITLE_HELP = { NOTICE: '휴대폰 한 줄에 다 보이게 10자 안팎으로 짧게 씁니다.', RELEASE: '휴대폰 한 줄에 다 보이게 버전을 빼고 10자 안팎으로 짧게 씁니다.' };
  function nextId() {
    const max = D.NOTICES.reduce(function (m, n) { return Math.max(m, Number(String(n.id).slice(2)) || 0); }, 0);
    return 'N-' + String(max + 1).padStart(4, '0');
  }
  // 맨 위 고정이 끝나는 날의 처음 값: 오늘부터 14일 뒤 (D-20)
  const PIN_DAYS = 14;

  // n: 고칠 글(없으면 새 글), done(id): 저장한 뒤 할 일
  function open(n, done) {
    const isEdit = !!n;
    n = n || { kind: 'NOTICE', important: false };
    const parts = D.RELEASE_PARTS.map(function (p) {
      return C.fieldHtml({ name: 'part_' + p[0], label: p[1], type: 'textarea', value: ((n.items || {})[p[0]] || []).join('\n'),
        help: p[0] === 'added' ? '한 줄에 하나씩 적습니다. 없는 묶음은 비워 둡니다(넷 중 하나는 적음).' : '' });
    }).join('');
    C.formModal({
      title: isEdit ? '이 글을 고칠까요?' : '공지사항에 글을 올릴까요?',
      desc: isEdit ? '고치면 글 아래에 고친 날짜가 함께 보입니다.' : '올리면 모든 사용자가 공지사항에서 볼 수 있습니다.',
      body: C.fieldHtml({ name: 'kind', label: '구분', type: 'select', required: true, value: n.kind, options: [['NOTICE', '공지'], ['RELEASE', '릴리즈']] }) +
        C.fieldHtml({ name: 'title', label: '제목', required: true, value: n.title || '', placeholder: '예: 계약번호 규칙 변경', help: TITLE_HELP.NOTICE, attrs: ' maxlength="20"' }) +
        '<div class="field"><label class="choice"><input type="checkbox" name="important"' + (n.important ? ' checked' : '') + '>중요 공지</label>' +
          '<p class="field-help">체크하면 "중요" 표시가 붙고, 전체 사용자에게 이메일로 알리며, 아래 날까지 공지사항 1쪽 맨 위에 둡니다.</p></div>' +
        // 맨 위 고정이 끝나는 날 (D-20): 중요 공지일 때만 씀. 고친 글은 정해 둔 날, 새 글과 처음 중요로 바꾸는 글은 14일 뒤
        //   필수 표시(*, "(필수)")는 칸이 잠긴 동안 숨김(board.css). 중요 공지일 때만 꼭 고르는 칸이라서
        C.fieldHtml({ name: 'pinUntil', label: '맨 위 고정이 끝나는 날', type: 'date', required: true, value: n.pinUntil || C.addDays(D.TODAY, PIN_DAYS),
          attrs: ' min="' + D.TODAY + '"' + (n.important ? '' : ' disabled'),
          help: '이날까지 공지사항 1쪽 맨 위에 둡니다. 오늘이나 그 뒤 날을 고릅니다. "중요 공지"를 체크해야 고를 수 있습니다.' }) +
        '<div data-kind="NOTICE">' + C.fieldHtml({ name: 'body', label: '내용', type: 'textarea', required: true, value: (n.body || []).join('\n\n'), help: '빈 줄로 문단을 나눕니다.' }) + '</div>' +
        '<div data-kind="RELEASE">' +
          C.fieldHtml({ name: 'version', label: '버전', required: true, value: n.version || '', placeholder: '예: v1.0.0', help: '바뀐 정도에 따라 v1.0.0의 숫자를 올립니다(큰 변경, 기능 추가, 작은 고침).' }) +
          parts + '</div>',
      btn: isEdit ? '저장' : '올리기',
      open: function (f) {
        // 제목 도움말: 구분에 맞는 권장 길이와 지금 글자 수 (v0.47)
        const title = f.elements.title, tHelp = title.closest('.field').querySelector('.field-help');
        function count() { tHelp.textContent = TITLE_HELP[val(f, 'kind')] + ' 지금 ' + title.value.trim().length + '자'; }
        function sync() {
          const k = val(f, 'kind');
          f.querySelectorAll('[data-kind]').forEach(function (b) { b.hidden = b.getAttribute('data-kind') !== k; });
          title.placeholder = k === 'RELEASE' ? '예: 제품과 기능 나누기' : '예: 계약번호 규칙 변경';
          count();
        }
        f.elements.kind.addEventListener('change', sync);
        title.addEventListener('input', count);
        sync();
        // 맨 위 고정이 끝나는 날은 "중요 공지"를 체크할 때만 씀(D-20). 체크를 풀면 잠그고 그 칸의 오류도 지움
        const pin = f.elements.pinUntil;
        f.elements.important.addEventListener('change', function () {
          pin.disabled = !this.checked;
          if (pin.disabled) C.setFieldError(pin.closest('.field'), '');
        });
      },
      check: function (f) {
        const k = val(f, 'kind');
        const err = { title: val(f, 'title') ? '' : '제목을 넣으세요.' };
        // 고정이 끝나는 날: 중요 공지면 꼭 고르고, 오늘이나 그 뒤(D-20).
        //   이미 끝난 날을 그대로 둔 채 고치는 글은 막지 않음(고정은 끝난 채로 남음)
        if (val(f, 'important')) {
          const pin = val(f, 'pinUntil');
          err.pinUntil = !pin ? '맨 위 고정이 끝나는 날을 고르세요.'
            : pin < D.TODAY && pin !== (n.pinUntil || '') ? '맨 위 고정이 끝나는 날은 오늘(' + C.fmtDate(D.TODAY) + ')이나 그 뒤여야 합니다.' : '';
        }
        if (k === 'NOTICE') err.body = val(f, 'body') ? '' : '내용을 넣으세요.';
        else {
          err.version = /^v\d+\.\d+\.\d+$/.test(val(f, 'version')) ? '' : '버전을 v1.0.0처럼 넣으세요.';
          const any = D.RELEASE_PARTS.some(function (p) { return lines(val(f, 'part_' + p[0])).length; });
          err.part_added = any ? '' : '새 기능, 개선, 바뀐 규칙, 고친 문제 중 하나는 적으세요.';
        }
        return err;
      },
      done: function (f) {
        const k = val(f, 'kind');
        const set = { kind: k, title: val(f, 'title'), important: val(f, 'important'), body: null, version: '', items: null };
        set.pinUntil = set.important ? val(f, 'pinUntil') : null; // 중요 공지가 아니면 고정하지 않음(D-20)
        const pinText = set.important ? ', ' + C.fmtDate(set.pinUntil) + '까지 맨 위 고정' : '';
        if (k === 'NOTICE') set.body = String(f.elements.body.value).split(/\n\s*\n/).map(function (x) { return x.trim(); }).filter(Boolean);
        else {
          set.version = val(f, 'version');
          set.items = {};
          D.RELEASE_PARTS.forEach(function (p) { const l = lines(val(f, 'part_' + p[0])); if (l.length) set.items[p[0]] = l; });
        }
        let id;
        if (isEdit) {
          id = n.id;
          // 고정이 바뀌면 바뀐 내용에 함께 적음(D-20)
          const pinNote = (n.pinUntil || null) === set.pinUntil ? '' : set.pinUntil ? ' (' + C.fmtDate(set.pinUntil) + '까지 맨 위 고정)' : ' (맨 위 고정 없앰)';
          C.adminSave('NOTICE', id + ' ' + set.title, '공지 고침' + pinNote, '공지 고침', { k: 'NOTICE_EDIT', id: id, set: set });
        } else {
          id = nextId();
          C.adminSave('NOTICE', id + ' ' + set.title, '공지 올림' + (set.important ? ' (중요, 전체 이메일' + pinText + ')' : ''), '공지 올림', { k: 'NOTICE_ADD', n: Object.assign({ id: id }, set) });
        }
        done(id, set);
      },
    });
  }

  window.NoticeForm = { open: open, canWrite: canWrite };
})();
