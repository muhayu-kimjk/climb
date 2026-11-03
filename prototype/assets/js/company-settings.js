/* =====================================================================
 * SCR-59 회사 설정 화면 로직 (company-settings.js)
 * ---------------------------------------------------------------------
 * 기획자 결정 2026-11-02
 *   E-9: 견적서 공급자 칸의 회사 정보(상호, 사업자등록번호, 대표자, 주소, 대표 연락처)는 경영지원에서 받아 운영 시작 전에 최고관리자가 넣음.
 *        바꾸면 사유와 함께 관리자 변경 이력(영역 COMPANY)에 남음. 03 8-9의 윤리 규정과 신고 창구 링크(선택)도 여기서 넣음
 *   E-7 덧붙임 ②: "견적서 출력"에 늘 찍는 회사 인장 그림은 총무가 올리고 바꿈. 바꾸면 사유와 함께 관리자 변경 이력에 남음(앞 그림은 그 기록에)
 * 볼 수 있는 사람: 최고관리자, 총무, 감사 열람(보기만). C.canSeeCompany
 * 바꿀 수 있는지: 회사 정보 C.canEditCompany(최고관리자), 인장 그림 C.canEditSeal(총무). 읽기만 하는 역할(감사 열람)은 둘 다 false라 단추가 없음
 * 하는 일
 *   1. 회사 정보: 지금 값(D.COMPANY). 최고관리자는 "회사 정보 바꾸기"(바꾼 칸만 이력에 "이름: 앞 → 뒤")
 *   2. 회사 인장 그림: 지금 그림과 판, 올린 사람. 총무는 "인장 그림 바꾸기"(PNG, JPG)
 *   3. 바꾼 기록: 관리자 변경 이력의 회사 설정(C.adminLog(['COMPANY'])), 20줄씩 쪽 나눔
 * 프로토타입: 바꾼 값과 그림은 이 브라우저에만 저장(시연 기록, common.js applyAdmin COMPANY, SEAL). 그림은 저장소 크기 때문에 300KB 이하 [가정]
 *   실제 시스템은 서버에 저장하고 그림 파일은 파일 지문과 함께 보관
 * ===================================================================== */
(function () {
  const D = window.CLIMB_DATA;
  const C = window.CLIMB;
  const me = C.init();
  const esc = C.esc;
  const $ = function (s) { return document.querySelector(s); };
  if (!C.gate(me, ['GA', 'AUDIT'], '회사 설정은 최고관리자와 총무가 씁니다',
    '지금은 ' + esc(C.roleLabel(me.role)) + ' 역할로 보고 있습니다. 화면 맨 위 검은 띠에서 최고관리자, 총무, 감사 열람 가운데 하나로 바꾸면 볼 수 있습니다.')) return;

  const canCompany = C.canEditCompany(me), canSeal = C.canEditSeal(me);
  const CO = D.COMPANY;
  const PAGE_SIZE = 20;
  const SEAL_MAX = 300 * 1024; // 시연: 이 브라우저에 그림을 저장하므로 300KB 이하 [가정]
  const SEAL_TYPES = /^image\/(png|jpeg)$/;
  // 회사 정보 칸(03 8-9 company_setting). url: 링크 칸(선택, https://로 시작)
  const FIELDS = [
    { key: 'name', label: '상호', help: '견적서 공급자 칸의 상호. 예: 주식회사 무하유' },
    { key: 'bizNo', label: '사업자등록번호', help: "'-' 없이 숫자 10자리만 넣어도 됩니다." },
    { key: 'ceo', label: '대표자' },
    { key: 'address', label: '주소' },
    { key: 'phone', label: '대표 연락처', help: '예: 02-0000-0000' },
    { key: 'ethicsUrl', label: '회사 윤리 규정 링크', url: true, help: '이용 안내 "거래 윤리와 신고"에서 엽니다. 선택' },
    { key: 'reportUrl', label: '신고 창구 링크', url: true, help: '이 시스템 밖의 회사 신고 창구. 선택' },
  ];
  function val(f, n) { return (f.elements[n].value || '').trim(); }

  /* ---------- 1. 회사 정보 ---------- */
  function valueHtml(f) {
    const v = CO[f.key];
    if (!v) return '<span class="empty-val">' + (f.url ? '아직 없음(선택)' : '비어 있음') + '</span>';
    return f.url ? '<a class="doc-link" href="' + esc(v) + '" target="_blank" rel="noopener noreferrer">' + esc(v) + '<span class="sr-only">(새 창)</span></a>' : esc(v);
  }
  function renderInfo() {
    $('#company-info').innerHTML = FIELDS.map(function (f) { return '<div><dt>' + esc(f.label) + '</dt><dd>' + valueHtml(f) + '</dd></div>'; }).join('');
    $('#company-act').innerHTML = canCompany ? '<button type="button" class="btn btn--secondary btn--md" id="btn-company">회사 정보 바꾸기</button>' : '';
  }
  function openCompany() {
    C.formModal({
      title: '회사 정보를 바꿀까요?',
      desc: '저장하면 다음 견적서부터 공급자 칸에 쓰이고, 바꾼 값과 사유가 관리자 변경 이력에 남습니다.',
      body: FIELDS.map(function (f) {
        return C.fieldHtml({ name: f.key, label: f.label, required: !f.url, value: CO[f.key] || '', type: f.url ? 'url' : 'text', help: f.help, placeholder: f.url ? 'https://' : '' });
      }).join('') +
        C.fieldHtml({ name: 'reason', label: '사유', type: 'textarea', required: true, placeholder: '예: 본사 주소 이전(경영지원유닛 알림 2026-11-20)' }),
      btn: '저장',
      check: function (f) {
        const e = {};
        FIELDS.forEach(function (x) {
          const v = val(f, x.key);
          if (!x.url && !v) e[x.key] = C.josa(x.label, '을', '를') + ' 넣으세요.';
          else if (x.url && v && !/^https:\/\/\S+$/.test(v)) e[x.key] = '링크는 https://로 시작하는 주소로 넣습니다.';
        });
        const biz = val(f, 'bizNo').replace(/\D/g, '');
        if (!e.bizNo && !C.isBizNo(biz)) e.bizNo = '사업자등록번호 10자리를 확인하세요(검증 숫자가 맞지 않음).';
        if (!e.phone && !/^[0-9][0-9-]{7,13}$/.test(val(f, 'phone'))) e.phone = '대표 연락처는 숫자와 "-"로 넣습니다. 예: 02-0000-0000';
        if (!val(f, 'reason')) e.reason = '사유를 적으세요.';
        else if (!Object.keys(e).length && !changes(f).length) e.reason = '바뀐 값이 없습니다. 바꿀 칸을 고친 뒤 저장하세요.';
        return e;
      },
      done: function (f) {
        const list = changes(f), set = {};
        list.forEach(function (x) { set[x.key] = x.to; });
        const saved = C.adminSave('COMPANY', '회사 정보', list.map(function (x) { return x.label + ': ' + (x.from || '없음') + ' → ' + (x.to || '없음'); }).join(', '),
          val(f, 'reason'), { k: 'COMPANY', set: set });
        if (saved.refused) return;
        render();
        C.toast('회사 정보를 바꿨습니다. 다음 견적서부터 공급자 칸에 쓰입니다.');
      },
    });
  }
  // 바뀐 칸: 사업자등록번호는 000-00-00000 꼴로 맞춰 봄
  function changes(f) {
    return FIELDS.map(function (x) {
      const raw = val(f, x.key), to = x.key === 'bizNo' ? C.fmtBizNo(raw) : raw;
      return { key: x.key, label: x.label, from: CO[x.key] || '', to: to };
    }).filter(function (x) { return x.from !== x.to; });
  }

  /* ---------- 2. 회사 인장 그림 ---------- */
  function renderSeal() {
    const s = CO.seal && CO.seal.src ? CO.seal : null;
    $('#seal-box').innerHTML = s
      ? '<div class="seal-preview"><img src="' + esc(s.src) + '" alt="지금 회사 인장 그림(' + s.ver + '판)"></div>' +
        '<dl class="company-info"><div><dt>파일</dt><dd>' + esc(s.name) + '</dd></div><div><dt>판</dt><dd>' + s.ver + '판</dd></div>' +
        '<div><dt>올린 사람</dt><dd>' + esc(C.ownerLabel(s.by)) + '</dd></div><div><dt>올린 일시</dt><dd>' + esc(C.fmtDateTime(s.at)) + '</dd></div></dl>'
      : '<div class="seal-preview is-empty"><span>그림 없음</span></div>' +
        '<dl class="company-info"><div><dt>지금</dt><dd>인장 그림이 없어 "견적서 출력"이 인장 없이 나갑니다(출력 기록에 "인장 없음").</dd></div></dl>';
    $('#seal-act').innerHTML = canSeal ? '<button type="button" class="btn btn--secondary btn--md" id="btn-seal">' + (s ? '인장 그림 바꾸기' : '인장 그림 올리기') + '</button>' : '';
  }
  function openSeal() {
    const old = CO.seal && CO.seal.src ? CO.seal : null;
    let picked = null; // 고른 그림 { name, type, size, src(데이터 주소) }
    C.formModal({
      title: old ? '회사 인장 그림을 바꿀까요?' : '회사 인장 그림을 올릴까요?',
      desc: '저장하면 다음 "견적서 출력"부터 이 그림이 찍히고, 그림의 판과 사유가 관리자 변경 이력에 남습니다.',
      body: '<div class="field" data-field="file"><p class="field-label" id="fm-file-label">인장 그림 파일<span class="req" aria-hidden="true">*</span><span class="sr-only">(필수)</span></p>' +
          '<div class="file-drop"><p>인장 대장에 등록한 회사 인장을 스캔한 그림을 고릅니다.<span class="file-limits">PNG 또는 JPG, 300KB 이하(배경이 투명한 PNG가 좋음)</span></p>' +
          '<label class="btn btn--tertiary" for="fm-file">파일 선택</label><input type="file" id="fm-file" name="file" accept="image/png,image/jpeg" aria-labelledby="fm-file-label"></div>' +
          '<div class="seal-preview seal-preview--sm is-empty" id="fm-seal-preview"><span>고른 그림</span></div>' +
          '<p class="field-error" hidden></p></div>' +
        C.fieldHtml({ name: 'reason', label: '사유', type: 'textarea', required: true, placeholder: '예: 인장을 새로 만들어 인장 대장에 등록함(2026-11-20)' }),
      btn: '저장',
      open: function (f) {
        f.elements.file.addEventListener('change', function (e) {
          const file = e.target.files[0], box = f.querySelector('[data-field="file"]'), pv = f.querySelector('#fm-seal-preview');
          picked = null;
          pv.className = 'seal-preview seal-preview--sm is-empty';
          pv.innerHTML = '<span>고른 그림</span>';
          if (!file) return;
          if (!SEAL_TYPES.test(file.type) || file.size > SEAL_MAX) {
            C.setFieldError(box, 'PNG나 JPG 그림, 300KB 이하만 올릴 수 있습니다(' + file.name + ').');
            e.target.value = '';
            return;
          }
          const r = new FileReader();
          r.onload = function () {
            picked = { name: file.name, type: file.type, size: file.size, src: r.result };
            pv.className = 'seal-preview seal-preview--sm';
            pv.innerHTML = '<img src="' + esc(r.result) + '" alt="고른 인장 그림 ' + esc(file.name) + '">';
            C.setFieldError(box, '');
          };
          r.readAsDataURL(file);
        });
      },
      check: function (f) { return { file: picked ? '' : '인장 그림 파일을 고르세요.', reason: val(f, 'reason') ? '' : '사유를 적으세요.' }; },
      done: function (f) {
        const ver = (old ? old.ver : 0) + 1;
        const saved = C.adminSave('COMPANY', '회사 인장 그림',
          (old ? '인장 그림 바꿈: ' + old.name + ' (' + old.ver + '판) → ' : '인장 그림 올림: ') + picked.name + ' (' + ver + '판)',
          val(f, 'reason'), { k: 'SEAL', seal: Object.assign({ ver: ver }, picked) });
        if (saved.refused) return;
        render();
        C.toast('인장 그림을 ' + ver + '판으로 바꿨습니다. 다음 "견적서 출력"부터 찍힙니다.');
      },
    });
  }

  /* ---------- 3. 바꾼 기록 (20줄씩) ---------- */
  let page = 1;
  function renderHistory() {
    const all = C.adminLog(['COMPANY']);
    const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    page = Math.min(page, pages);
    const from = (page - 1) * PAGE_SIZE, rows = all.slice(from, from + PAGE_SIZE);
    $('#company-history').innerHTML = C.adminHistoryHtml(rows, '회사 설정 바꾼 기록') +
      (all.length > PAGE_SIZE ? '<nav class="pagination" id="history-pages" aria-label="바꾼 기록 쪽 이동">' + C.pagerHtml(page, pages, all.length, from, rows.length, PAGE_SIZE, '건') + '</nav>' : '');
  }

  function render() { renderInfo(); renderSeal(); renderHistory(); }
  document.addEventListener('click', function (e) {
    if (e.target.closest('#btn-company') && canCompany) openCompany();
    if (e.target.closest('#btn-seal') && canSeal) openSeal();
    const pg = e.target.closest('#history-pages [data-page]');
    if (pg && !pg.disabled) { page = Number(pg.getAttribute('data-page')); renderHistory(); }
  });
  render();
})();
