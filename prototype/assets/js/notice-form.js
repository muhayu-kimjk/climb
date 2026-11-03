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
 *   - 바뀐 화면과 보일 기간(기획자 결정 2026-11-02 E-15, C-35): 릴리즈만. 바뀐 화면(changeScreens, 화면 번호들)을 고르면
 *     올린 날부터 보일 기간(changeDays, 처음 값 14일) 동안 그 화면의 회색 안내 상자에 "바뀐 점" 한 줄(릴리즈 제목과 이 글로 가는 링크)이 보임
 *     그리는 곳은 common.js renderChangeNote. 화면 고르기는 접어 두고(창이 길어지지 않게) 고른 화면은 그 아래 한 줄로 보임
 *     화면을 하나라도 골라야 보일 기간을 씀(맨 위 고정처럼 잠긴 칸이 그 자리에 늘 있음). [가정] 보일 기간은 1~30일(잠깐 두는 안내라서)
 *     고르지 않으면 어느 화면에도 보이지 않음(지금처럼 게시판과 이용 안내의 새 소식만). 바뀐 내용 기록에 화면 이름과 날 수를 함께 적음
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
  // 바뀐 점 한 줄(E-15): 보일 기간의 처음 값(결정 "예: 2주")과 가장 긴 날 수 [가정]
  const CHANGE_DAYS = 14, CHANGE_MAX = 30;
  function pickedScreens(f) { return [].map.call(f.querySelectorAll('[name="changeScreens"]:checked'), function (el) { return el.value; }); }
  // 바뀐 내용 기록에 적을 글: "바뀐 점 14일: 결재선 규칙, 내 계정"(바뀐 화면이 없으면 '')
  function changeText(s) { return s && s.changeScreens && s.changeScreens.length ? '바뀐 점 ' + s.changeDays + '일: ' + s.changeScreens.map(C.changeScreenLabel).join(', ') : ''; }
  // 바뀐 화면 고르기: 접어 둔 목록(메뉴 묶음마다 한 줄, 사용자 권한 관리의 역할 고르기와 같은 모양) + 고른 화면 한 줄
  function screenPickHtml(picked) {
    const rows = C.changeScreens().map(function (g) {
      return '<fieldset class="screen-row"><legend class="screen-row-name">' + C.esc(g.name) + '</legend><div class="screen-row-choices">' + g.list.map(function (s) {
        return '<label class="choice"><input type="checkbox" name="changeScreens" value="' + s[0] + '"' + (picked.indexOf(s[0]) > -1 ? ' checked' : '') + '>' + C.esc(s[1]) + '</label>';
      }).join('') + '</div></fieldset>';
    }).join('');
    return '<fieldset class="field" data-field="changeScreens"><legend class="field-label">바뀐 화면</legend>' +
      '<details class="screen-pick"><summary>화면 고르기' + C.icon('chevronDown', 'sm') + '</summary><div class="screen-pick-body">' + rows + '</div></details>' +
      '<p class="screen-picked"></p>' +
      '<p class="field-help">고른 화면의 회색 안내 상자(상자가 없는 화면은 제목 아래)에 "바뀐 점" 한 줄로 이 릴리즈의 제목과 링크를 보입니다. 고르지 않으면 어느 화면에도 보이지 않습니다.</p>' +
      '<p class="field-error" hidden></p></fieldset>';
  }

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
          parts +
          // 바뀐 화면과 보일 기간 (E-15). 보일 기간은 화면을 하나라도 골라야 씀(잠긴 칸도 그 자리에 늘 있어 창이 흔들리지 않음)
          screenPickHtml(n.changeScreens || []) +
          C.fieldHtml({ name: 'changeDays', label: '보일 기간', type: 'number', required: true, unit: '일', value: n.changeDays || CHANGE_DAYS,
            attrs: ' min="1" max="' + CHANGE_MAX + '" inputmode="numeric"' + ((n.changeScreens || []).length ? '' : ' disabled'),
            help: '올린 날부터 이 날 수 동안 보이고, 지나면 저절로 사라집니다(1~' + CHANGE_MAX + '일, 처음 값 ' + CHANGE_DAYS + '일). 바뀐 화면을 골라야 정할 수 있습니다.' }) +
          '</div>',
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
        // 바뀐 화면과 보일 기간 (E-15): 화면을 고르면 보일 기간이 풀리고, 고른 화면 이름을 아래 한 줄에(넘치면 말줄임, 전체는 title)
        const days = f.elements.changeDays, picked = f.querySelector('.screen-picked');
        function syncPick() {
          const list = pickedScreens(f);
          days.disabled = !list.length;
          if (days.disabled) C.setFieldError(days.closest('.field'), '');
          const text = list.length ? '고른 화면: ' + list.map(C.changeScreenLabel).join(', ') : '고른 화면 없음';
          picked.textContent = text;
          picked.title = text;
        }
        f.addEventListener('change', function (e) { if (e.target.name === 'changeScreens') syncPick(); });
        syncPick();
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
          // 바뀐 점(E-15): 화면을 골랐으면 보일 기간은 1~30일의 정수
          if (pickedScreens(f).length) {
            const d = Number(val(f, 'changeDays'));
            err.changeDays = Number.isInteger(d) && d >= 1 && d <= CHANGE_MAX ? '' : '보일 기간을 1~' + CHANGE_MAX + '일 가운데 정수로 넣으세요.';
          }
        }
        return err;
      },
      done: function (f) {
        const k = val(f, 'kind');
        // changeScreens, changeDays: 바뀐 점(E-15). 공지이거나 화면을 고르지 않으면 null(고칠 때 예전 값을 지움)
        const set = { kind: k, title: val(f, 'title'), important: val(f, 'important'), body: null, version: '', items: null, changeScreens: null, changeDays: null };
        set.pinUntil = set.important ? val(f, 'pinUntil') : null; // 중요 공지가 아니면 고정하지 않음(D-20)
        const pinText = set.important ? ', ' + C.fmtDate(set.pinUntil) + '까지 맨 위 고정' : '';
        if (k === 'NOTICE') set.body = String(f.elements.body.value).split(/\n\s*\n/).map(function (x) { return x.trim(); }).filter(Boolean);
        else {
          set.version = val(f, 'version');
          set.items = {};
          D.RELEASE_PARTS.forEach(function (p) { const l = lines(val(f, 'part_' + p[0])); if (l.length) set.items[p[0]] = l; });
          const scr = pickedScreens(f);
          if (scr.length) { set.changeScreens = scr; set.changeDays = Number(val(f, 'changeDays')); }
        }
        let id;
        if (isEdit) {
          id = n.id;
          // 고정이 바뀌면 바뀐 내용에 함께 적음(D-20)
          const pinNote = (n.pinUntil || null) === set.pinUntil ? '' : set.pinUntil ? ' (' + C.fmtDate(set.pinUntil) + '까지 맨 위 고정)' : ' (맨 위 고정 없앰)';
          // 바뀐 점이 바뀌어도 함께 적음(E-15)
          const chBefore = changeText(n), chAfter = changeText(set);
          const chNote = chBefore === chAfter ? '' : chAfter ? ' (' + chAfter + ')' : ' (바뀐 점 없앰)';
          C.adminSave('NOTICE', id + ' ' + set.title, '공지 고침' + pinNote + chNote, '공지 고침', { k: 'NOTICE_EDIT', id: id, set: set });
        } else {
          id = nextId();
          const ch = changeText(set);
          C.adminSave('NOTICE', id + ' ' + set.title, '공지 올림' + (set.important ? ' (중요, 전체 이메일' + pinText + ')' : '') + (ch ? ' (' + ch + ')' : ''), '공지 올림', { k: 'NOTICE_ADD', n: Object.assign({ id: id }, set) });
        }
        done(id, set);
      },
    });
  }

  window.NoticeForm = { open: open, canWrite: canWrite };
})();
