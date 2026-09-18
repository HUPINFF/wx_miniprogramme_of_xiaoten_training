const {
  HOME,
  ENTRY,
  readIsAdmin,
  resolveLoginEntry,
  coachScopeOf,
  hasGlobalScope
} = require('../miniprogram/utils/helper');

describe('readIsAdmin', () => {
  test('正常布尔 true → true', () => {
    expect(readIsAdmin({ isAdmin: true })).toBe(true);
  });

  test('布尔 false → false', () => {
    expect(readIsAdmin({ isAdmin: false })).toBe(false);
  });

  test('字段缺失 → false', () => {
    expect(readIsAdmin({ role: 'coach' })).toBe(false);
    expect(readIsAdmin(null)).toBe(false);
    expect(readIsAdmin(undefined)).toBe(false);
  });

  // 云开发控制台「添加字段」手打时很容易带出尾随空格，存进去就是 "isAdmin "
  test('字段名带尾随空格 → 仍能识别', () => {
    expect(readIsAdmin({ 'isAdmin ': true })).toBe(true);
    expect(readIsAdmin({ ' isAdmin': true })).toBe(true);
  });

  // 类型填成字符串时绝不能放行：字符串 "false" 是真值，宽松判断会误授权
  test('值是字符串 "true" / "false" → 一律 false', () => {
    expect(readIsAdmin({ isAdmin: 'true' })).toBe(false);
    expect(readIsAdmin({ isAdmin: 'false' })).toBe(false);
    expect(readIsAdmin({ 'isAdmin ': 'true' })).toBe(false);
  });

  test('值是真值但不是 true（1 / 非空对象）→ false', () => {
    expect(readIsAdmin({ isAdmin: 1 })).toBe(false);
    expect(readIsAdmin({ isAdmin: {} })).toBe(false);
  });
});

describe('resolveLoginEntry', () => {
  describe('家长账号', () => {
    const parent = { role: 'user' };

    test('选用户端 → 放行进家长端', () => {
      const r = resolveLoginEntry(parent, ENTRY.USER);
      expect(r.ok).toBe(true);
      expect(r.home).toBe(HOME.USER);
    });

    test('选教练端 → 拒绝，提示是家长账号', () => {
      const r = resolveLoginEntry(parent, ENTRY.COACH);
      expect(r.ok).toBe(false);
      expect(r.message).toContain('家长账号');
    });

    test('选管理端 → 拒绝', () => {
      const r = resolveLoginEntry(parent, ENTRY.ADMIN);
      expect(r.ok).toBe(false);
    });

    test('即使被拒绝也要有地方去，home 不能是空串', () => {
      [ENTRY.COACH, ENTRY.ADMIN].forEach(entry => {
        expect(resolveLoginEntry(parent, entry).home).toBe(HOME.USER);
      });
    });
  });

  describe('普通教练', () => {
    const coach = { role: 'coach', isAdmin: false };

    test('选教练端 → 放行进工作台', () => {
      const r = resolveLoginEntry(coach, ENTRY.COACH);
      expect(r.ok).toBe(true);
      expect(r.home).toBe(HOME.COACH);
    });

    test('选管理端 → 拒绝，提示没有管理员权限', () => {
      const r = resolveLoginEntry(coach, ENTRY.ADMIN);
      expect(r.ok).toBe(false);
      expect(r.message).toContain('管理员权限');
    });

    test('被拒绝时 home 回落工作台，不是空串', () => {
      expect(resolveLoginEntry(coach, ENTRY.ADMIN).home).toBe(HOME.COACH);
    });
  });

  describe('管理员（role 仍是 coach）', () => {
    const admin = { role: 'coach', isAdmin: true };

    test('选管理端 → 放行进驾驶舱', () => {
      const r = resolveLoginEntry(admin, ENTRY.ADMIN);
      expect(r.ok).toBe(true);
      expect(r.home).toBe(HOME.ADMIN);
    });

    test('选教练端 → 也放行，老板不被自己的入口卡住', () => {
      const r = resolveLoginEntry(admin, ENTRY.COACH);
      expect(r.ok).toBe(true);
      expect(r.home).toBe(HOME.COACH);
    });
  });

  describe('异常输入', () => {
    test('user 为 null → 拒绝且 home 可用', () => {
      const r = resolveLoginEntry(null, ENTRY.USER);
      expect(r.ok).toBe(false);
      expect(r.home).toBe(HOME.USER);
    });

    test('未知 role → 拒绝', () => {
      expect(resolveLoginEntry({ role: 'admin' }, ENTRY.ADMIN).ok).toBe(false);
    });

    test('isAdmin 是非布尔真值不当作管理员', () => {
      // 云开发控制台里字段类型可能填错，只认严格 true
      expect(resolveLoginEntry({ role: 'coach', isAdmin: 'true' }, ENTRY.ADMIN).ok).toBe(false);
    });
  });
});

describe('coachScopeOf', () => {
  test('普通教练 → 始终带 coachId', () => {
    expect(coachScopeOf('c1', false)).toEqual({ coachId: 'c1' });
    expect(coachScopeOf('c1', false, { allForAdmin: true })).toEqual({ coachId: 'c1' });
  });

  test('管理员未开启全局 → 仍带 coachId', () => {
    expect(coachScopeOf('c1', true)).toEqual({ coachId: 'c1' });
  });

  test('管理员开启全局 → 返回空条件，去掉归属过滤', () => {
    expect(coachScopeOf('c1', true, { allForAdmin: true })).toEqual({});
  });

  test('展开进 where 后不会覆盖其它字段', () => {
    const where = { date: '2026-09-15', ...coachScopeOf('c1', true, { allForAdmin: true }) };
    expect(where).toEqual({ date: '2026-09-15' });
  });
});

describe('hasGlobalScope', () => {
  test('只有 admin + allForAdmin 才为 true', () => {
    expect(hasGlobalScope(true, { allForAdmin: true })).toBe(true);
    expect(hasGlobalScope(true, {})).toBe(false);
    expect(hasGlobalScope(false, { allForAdmin: true })).toBe(false);
    expect(hasGlobalScope(false)).toBe(false);
  });
});
