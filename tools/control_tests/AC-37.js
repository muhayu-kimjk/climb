// AC-37 회사 계정과 2단계 인증 (CTL-88, 06 통제 목록 2장)
//   시안에는 로그인이 없고 시연용 역할 전환만 있어(06 "시안 코드 위치: 없음") 로그인 거부는 모두 서버 몫(serverOnly)
//   시안에서 볼 수 있는 것: 계정이 모두 회사 도메인이고 사람마다 하나인지(CTL-88 "계정은 사람마다 하나"), 접속 기록에 로그인 줄이 보이는지
'use strict';

module.exports = {
  ac: 'AC-37',
  title: '회사 계정과 2단계 인증',
  tests: [
    {
      name: '모든 계정이 회사 도메인(@muhayu.com) 이메일이고 사람마다 하나(대소문자만 다른 중복도 없음)',
      kind: 'ok',
      run(h) {
        const env = h.fresh({ role: 'SUPER' });
        const acc = env.D.ACCOUNTS || [];
        if (!acc.length) return '계정 목록이 비어 있음';
        const bad = acc.filter(a => !/^[a-z0-9._-]+@muhayu\.com$/.test(String(a.email)));
        if (bad.length) return '회사 도메인이 아닌 계정: ' + bad.map(a => a.email).join(', ');
        const seen = {}, dup = [];
        acc.forEach(a => { const k = String(a.email).toLowerCase(); if (seen[k]) dup.push(a.email); seen[k] = true; });
        if (dup.length) return '같은 이메일 계정이 둘 이상: ' + dup.join(', ');
        const ids = {}, dupId = [];
        acc.forEach(a => { if (ids[a.id]) dupId.push(a.id); ids[a.id] = true; });
        if (dupId.length) return '같은 계정 번호가 둘 이상: ' + dupId.join(', ');
        return true;
      },
    },
    {
      // (2026-11-13 약한 시험 고침) 06의 되는 경우("2단계 인증을 켠 사람이 로그인하면 들어가고 LOGIN 한 줄")는 시안에 로그인이 없어 시험할 수 없음(서버 몫에 둠)
      //   이 시험은 시연용 접속 기록 조회가 계정의 접속 일시로 로그인 줄을 만드는지만 봄. 그래서 이름에 "시연 조회"를 밝히고, 되는 경우를 시험한 것으로 세지 않음
      //   예시 데이터로만 보면 늘 참이라, 시험 안에서 계정 둘(로그인한 계정, 첫 접속 전 계정)을 더해 줄 수가 정확히 맞는지도 봄
      name: '(시연 조회만, 06의 되는 경우는 서버 몫) 접속 기록 조회는 계정의 첫 접속과 마지막 로그인마다 로그인 줄을 하나씩 보이고, 첫 접속 전 계정에는 로그인 줄이 없음',
      kind: 'ok',
      run(h) {
        const T1 = { id: 'u_t37_in', email: 't37.in@muhayu.com', name: '시험접속', dept: '비즈니스1유닛', roles: ['SALES'], status: 'ACTIVE',
          registeredAt: '2026-10-01', firstLoginAt: '2026-10-01 09:01', lastLoginAt: '2026-10-18 09:12' };
        const T2 = { id: 'u_t37_new', email: 't37.new@muhayu.com', name: '시험초대', dept: '비즈니스1유닛', roles: ['SALES'], status: 'INVITED', registeredAt: '2026-10-17' };
        const env = h.fresh({ role: 'PRIVACY', hook: D => { D.ACCOUNTS.push(Object.assign({}, T1), Object.assign({}, T2)); } });
        const logs = env.X.accessLogs();
        const logged = env.D.ACCOUNTS.filter(a => a.lastLoginAt);
        if (!logged.length) return '로그인한 계정이 하나도 없음(시험 데이터 확인)';
        const miss = logged.filter(a => !logs.some(l => l.act === 'LOGIN' && l.userId === a.id && l.at === a.lastLoginAt));
        if (miss.length) return '로그인 줄이 없는 계정: ' + miss.map(a => a.id).join(', ');
        // 더한 계정: 첫 접속 한 줄과 마지막 로그인 한 줄, 모두 두 줄이어야 함(빠지거나 겹치면 실패)
        const t1 = logs.filter(l => l.act === 'LOGIN' && l.userId === T1.id);
        if (t1.length !== 2) return '더한 계정(첫 접속, 마지막 로그인)의 로그인 줄이 ' + t1.length + '개(2개여야 함)';
        if (!t1.some(l => l.at === T1.firstLoginAt && l.target === '첫 접속') || !t1.some(l => l.at === T1.lastLoginAt)) return '더한 계정의 로그인 줄 일시가 계정의 첫 접속, 마지막 로그인과 다름: ' + JSON.stringify(t1);
        // 첫 접속 전 계정에는 로그인 줄이 없어야 함(들어온 적 없음). 더한 초대 계정이 대조
        const invited = env.D.ACCOUNTS.filter(a => a.status === 'INVITED' && !a.firstLoginAt && !a.lastLoginAt);
        if (!invited.some(a => a.id === T2.id)) return '더한 초대 계정이 첫 접속 전으로 잡히지 않음(시험 확인)';
        const wrong = invited.filter(a => logs.some(l => l.act === 'LOGIN' && l.userId === a.id));
        if (wrong.length) return '첫 접속 전인데 로그인 줄이 있는 계정: ' + wrong.map(a => a.id).join(', ');
        return true;
      },
    },
  ],
  serverOnly: [
    '다른 도메인 Google 계정으로 로그인: 서버가 ID 토큰의 회사 도메인(hd) 값으로 거부(시안은 로그인 없이 시연용 역할 전환만 있음)',
    '화면의 도메인 검사를 지우고 보낸 로그인: 서버가 ID 토큰의 서명과 hd 값을 다시 검증해 거부',
    '2단계 인증을 끈 계정: 들어오지 못하고 켜는 방법을 안내(Google 계정 설정과 서버 판단, 시안에 로그인 없음)',
    '정해진 횟수 넘게 로그인 실패: 일정 시간 막힘(서버 기준, 시안에 없음)',
    '주소(?role=)나 브라우저 저장소로 역할 바꾸기: 시안 전용 시연 길이라 실제에는 없고, 역할은 서버의 계정 정보로만 정함',
    '(06의 되는 경우) 회사 계정에 2단계 인증을 켠 사람이 로그인하면 들어가고 접속 기록에 LOGIN 한 줄이 남음: 서버가 세션을 주고 기록을 남김(시안에는 로그인이 없고, 접속 기록 조회는 예시 계정의 로그인 일시로 만든 것이라 위 시연 조회 시험이 이것을 대신하지 않음)',
  ],
};
