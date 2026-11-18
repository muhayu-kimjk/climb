// AC-47 접속과 작업 기록 (CTL-116, 06 통제 목록 2장) 시험 (2026-11-13 주말 점검 W2)
//   기대 동작: 정해진 일이 생길 때마다 한 줄이 빠짐없이 쌓이고, 고치기와 지우기는 어떤 계정으로도 되지 않는다.
//   시안 코드 위치: 없음. control-checks.js accessLogs와 admin-logs.js는 예시 데이터와 결재 기록으로 만든 시연용 조회 화면
//   그래서 시안에서 볼 수 있는 것은 "결재를 처리하면 그 줄이 조회에 보이는지"와 "조회에 고치거나 지우는 길이 없는지"뿐이고 나머지는 서버 몫
'use strict';
const { fixClock, step } = require('./lib');

module.exports = {
  ac: 'AC-47',
  title: '접속과 작업 기록',
  tests: [
    {
      name: '결재 하나를 처리하면 접속 기록에 APPROVE 한 줄(사람, 초 단위 일시, 계약번호, 사내망 또는 VPN)이 남음(2610CL010 ②)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SALES_ADMIN' });
        fixClock(env);
        const { C, X, U } = env;
        const c = env.contract('2610CL010');
        const before = X.accessLogs().filter(l => l.act === 'APPROVE').length;
        const e = C.recordAction(c, step(c, 'S02'), 'APPROVE', '확인: 시험', U('u_sadmin'));
        if (!e) return '② 승인이 남지 않음(시험 전제)';
        const logs = X.accessLogs();
        const all = logs.filter(l => l.act === 'APPROVE');
        if (all.length !== before + 1) return '결재 줄이 ' + before + ' → ' + all.length + '(한 줄 늘어야 함)';
        const rows = all.filter(l => l.userId === 'u_sadmin' && l.at === e.at);
        if (rows.length !== 1) return '처리한 결재의 접속 기록 줄이 ' + rows.length + '개';
        const r = rows[0];
        if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(r.at)) return '일시가 초 단위가 아님: ' + r.at;
        if (String(r.target).indexOf('2610CL010') < 0) return '대상에 계약번호가 없음: ' + r.target;
        if (['사내망', 'VPN'].indexOf(r.place) < 0) return '접속 위치가 사내망이나 VPN이 아님: ' + r.place;
        return true;
      },
    },
    {
      name: '견적서를 출력한 일마다 접속 기록에 인쇄(PRINT) 줄이 하나씩 보임',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'PRIVACY' });
        const issues = [];
        env.C.allQuotes().forEach(q => (q.issues || []).forEach(i => issues.push({ q, i })));
        if (!issues.length) return '출력한 견적이 없음(시험 전제)';
        const prints = env.X.accessLogs().filter(l => l.act === 'PRINT');
        const miss = issues.filter(x => !prints.some(p => p.at === x.i.at && p.userId === x.i.by && p.target.indexOf(x.q.no) > -1));
        if (miss.length) return '인쇄 줄이 없는 견적 출력: ' + miss.map(x => x.q.no + ' ' + x.i.at).join(', ');
        return true;
      },
    },
    {
      // (2026-11-13 약한 시험 고침, 검토자는 참고용으로 적음) 이름 규칙 훑기와 배열 splice만으로는 약해서 셋을 더함:
      //   ① 훑는 이름에 reset, wipe, truncate, rewrite, overwrite도 넣음 ② 받은 줄 하나의 일시와 대상을 바꿔도 다음 조회의 그 줄은 그대로(줄을 함께 쓰지 않음)
      //   ③ 화면이 더하는 줄(extra, 예: 이 화면을 연 VIEW 줄)은 그 조회에만 들고 다음 조회에 남지 않음(조회가 기록을 쓰는 길이 아님)
      //   시안 안에 있는 시연 띠의 "시연 기록 지우기"(common.js renderDemoBar)는 이름으로 내보내지 않아 훑기로 잡지 못함: 서버 몫에 따로 적음
      name: '시안의 접속 기록 조회(control-checks.js accessLogs)에는 고치거나 지우는 기능이 없고, 받은 목록이나 줄을 바꿔도 다음 조회는 그대로(조회할 때마다 기록에서 다시 만듦)',
      kind: 'deny',
      run(h) {
        const env = h.fresh({ role: 'ADMIN' });
        const { C, X } = env;
        const bad = Object.keys(X).concat(Object.keys(C))
          .filter(k => /^(edit|update|delete|remove|erase|undo|modify|purge|drop|clear|reset|wipe|truncate|rewrite|overwrite)/i.test(k) && k !== 'deleteDraft');
        if (bad.length) return '기록을 고치거나 지울 수 있어 보이는 기능: ' + bad.join(', ');
        // 받은 목록을 지워도 다음 조회는 그대로(화면 쪽에서 지운 것이 기록에 남지 않음)
        const a = X.accessLogs();
        const n = a.length;
        if (!n) return '접속 기록 조회가 비어 있음(시험 확인)';
        const first = JSON.stringify(a[0]);
        a[0].at = '2000-01-01 00:00:00'; a[0].target = '고친 줄(시험)'; a[0].userId = 'u_t47';
        a.splice(0, n);
        const b = X.accessLogs();
        if (b.length !== n) return '조회 목록을 지우자 다음 조회의 줄 수가 바뀜';
        if (JSON.stringify(b[0]) !== first) return '받은 줄을 고치자 다음 조회의 그 줄도 바뀜: ' + JSON.stringify(b[0]);
        if (b.some(l => l.userId === 'u_t47' || l.target === '고친 줄(시험)')) return '고친 줄이 다음 조회에 남음';
        // 화면이 더한 줄은 그 조회에만
        const extra = X.accessLogs([{ at: '2026-10-19 20:00:00', userId: 'u_privacy', act: 'VIEW', target: '시험 화면(시험)' }]);
        if (!extra.some(l => l.target === '시험 화면(시험)')) return '화면이 더한 줄이 그 조회에 없음(시험 확인)';
        if (X.accessLogs().some(l => l.target === '시험 화면(시험)') || X.accessLogs().length !== n) return '화면이 더한 줄이 다음 조회에 남음(조회가 기록을 씀)';
        return true;
      },
    },
  ],
  serverOnly: [
    '정해진 일마다 한 줄이 빠짐없이 쌓임(로그인, 열람, 내려받기 등): 시안의 접속 기록은 예시 계정의 접속 일시와 결재, 변경 기록으로 만든 시연용 조회(06 "시안 코드 위치: 없음"). 실제 기록은 서버가 남김',
    '인쇄나 PDF 저장: PRINT 줄이 남아야 함(03 CODE-LOG-ACTION). 시안 조회에는 견적서 출력만 인쇄 줄로 보이고 계약서 인쇄와 PDF 저장 줄은 없음(06 v0.3에 적힌 시안의 빈 곳)',
    '관리자 계정으로 기록 고치기나 지우기 요청을 서버에 보냄: 쓰기만 되는 저장소라 어떤 계정이든 거부',
    '시안의 시연 띠 "시연 기록 지우기"(common.js renderDemoBar)는 이 브라우저에 쌓인 시연 기록(결재, 관리자 변경 등)을 지워 그 기록으로 만든 접속 기록 줄도 사라짐: 시연 전용이고 실제 시스템에서는 뺌(06 AC-42, AC-48. 내보낸 기능 이름이 아니라 위 이름 훑기로 잡지 못함)',
    '데이터베이스 관리자가 접속 기록 한 줄을 직접 고치거나 지움: 다음 날 지문 확인에서 어긋남이 나와 정보보호 담당자에게 알림(LOG_CHAIN, CTL-122). 시안에는 장치가 없음',
    '기록 저장이 실패함: 그 처리를 함께 실패로 둘지 개발팀이 정함(04 4장)',
    '서버 시각이 표준시와 어긋남: 실패로 봄(시각 맞춤은 서버 몫)',
  ],
};
