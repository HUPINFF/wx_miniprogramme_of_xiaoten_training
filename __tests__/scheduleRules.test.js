// utils/scheduleRules 纯函数测试：排课冲突检测 + 改课留痕
// 这两个函数直接决定「调度台红标」和「保存前弹窗」对不对，误报漏报都烦人，锁进 jest。
const sr = require('../miniprogram/utils/scheduleRules');

describe('scheduleRules 冲突检测', () => {
  // 10:00-11:00 的基准课
  const base = { _id: 'base', coachId: 'c1', childId: 's1', startTime: '10:00', endTime: '11:00' };

  test('minutesOf / durationMinutes：合法入参与畸形入参', () => {
    expect(sr.minutesOf('09:30')).toBe(570);
    expect(sr.minutesOf('9:05')).toBe(545);      // 非定长也认
    expect(sr.minutesOf('25:00')).toBeNull();     // 越界
    expect(sr.minutesOf('1000')).toBeNull();      // 缺冒号
    expect(sr.minutesOf(null)).toBeNull();
    expect(sr.durationMinutes('90分钟')).toBe(90);
    expect(sr.durationMinutes('abc')).toBeNull();
    expect(sr.durationMinutes('0分钟')).toBeNull();
  });

  test('overlap：相交算，首尾相接和包含边界各就各位', () => {
    expect(sr.overlap(600, 660, 630, 690)).toBe(true);   // 10:00-11:00 vs 10:30-11:30
    expect(sr.overlap(600, 660, 660, 720)).toBe(false);  // 11:00 结束 vs 11:00 开始 = 连排合法
    expect(sr.overlap(600, 660, 540, 700)).toBe(true);   // 完全包住
    expect(sr.overlap(600, 660, 660, 720) === sr.overlap(660, 720, 600, 660)).toBe(true); // 对称
  });

  test('同教练时间重叠 = 冲突；同教练首尾相接 = 不冲突', () => {
    expect(sr.isConflicting(
      { coachId: 'c1', childId: 's2', startTime: '10:30', endTime: '11:30' }, base
    )).toBe(true);
    expect(sr.isConflicting(
      { coachId: 'c1', childId: 's2', startTime: '11:00', endTime: '12:00' }, base
    )).toBe(false);
  });

  test('同学员跨教练重叠 = 冲突（孩子被排重了）；不同学员不同教练同时段 = 不冲突', () => {
    expect(sr.isConflicting(
      { coachId: 'c2', childId: 's1', startTime: '10:30', endTime: '11:30' }, base
    )).toBe(true);
    expect(sr.isConflicting(
      { coachId: 'c2', childId: 's2', startTime: '10:00', endTime: '11:00' }, base
    )).toBe(false);
  });

  test('endTime 缺失/空串：按 duration 兜底，再缺按 60 分钟', () => {
    // 旧数据只有 duration
    expect(sr.isConflicting(
      { coachId: 'c1', startTime: '11:30', endTime: '', duration: '45分钟' }, base
    )).toBe(false);  // 11:30-12:15 不碰 10:00-11:00
    expect(sr.isConflicting(
      { coachId: 'c1', startTime: '10:40', duration: '45分钟' }, base
    )).toBe(true);   // 10:40-11:25 撞上
    // endTime 和 duration 都没有 → 默认 60 分钟：10:30-11:30 撞上
    expect(sr.isConflicting({ coachId: 'c1', startTime: '10:30' }, base)).toBe(true);
  });

  test('startTime 认不出的课次绝不参与冲突（不误报）', () => {
    expect(sr.isConflicting({ coachId: 'c1', startTime: '晚上' }, base)).toBe(false);
    expect(sr.isConflicting(null, base)).toBe(false);
    expect(sr.isConflicting({ coachId: 'c1', startTime: '10:30' }, {})).toBe(false);
  });

  test('findConflicts：排除自己（编辑保存），返回冲突文档列表', () => {
    const list = [
      base,
      { _id: 'a', coachId: 'c1', childId: 's9', startTime: '10:30', endTime: '11:30' },
      { _id: 'b', coachId: 'c3', childId: 's3', startTime: '15:00', endTime: '16:00' }
    ];
    const slot = { coachId: 'c1', childId: 's1', startTime: '10:00', endTime: '11:00' };
    // base 和 a 都与 slot 同教练撞车，b 完全不沾
    expect(sr.findConflicts(slot, list).map(t => t._id)).toEqual(['base', 'a']);
    // 编辑保存时排除自己（base），剩下的冲突只有 a
    expect(sr.findConflicts(slot, list, 'base').map(t => t._id)).toEqual(['a']);
    expect(sr.findConflicts(slot, 'not-array')).toEqual([]);
  });

  test('detectConflicts：三方互撞全中标，和平课次返回空集合', () => {
    const busy = [
      { _id: 'x', coachId: 'c1', startTime: '09:00', endTime: '10:00' },
      { _id: 'y', coachId: 'c1', startTime: '09:30', endTime: '10:30' },
      { _id: 'z', coachId: 'c1', startTime: '09:45', endTime: '10:15' },
      { _id: 'ok', coachId: 'c2', startTime: '09:00', endTime: '10:00' }
    ];
    const ids = sr.detectConflicts(busy);
    expect(ids.has('x')).toBe(true);
    expect(ids.has('y')).toBe(true);
    expect(ids.has('z')).toBe(true);
    expect(ids.has('ok')).toBe(false);
    expect(sr.detectConflicts([{ _id: 'solo', coachId: 'c1', startTime: '09:00' }]).size).toBe(0);
  });
});

describe('scheduleRules 改课留痕', () => {
  const oldDoc = {
    date: '2026-09-21', startTime: '10:00', endTime: '11:00',
    location: '河东体育场', childId: 's1', childName: '小明',
    coachId: 'c1', coachName: '小张教练'
  };

  test('没有任何变化 → null，不产生空记录', () => {
    expect(sr.buildChangeLog(oldDoc, {
      date: oldDoc.date, startTime: oldDoc.startTime, location: oldDoc.location,
      childId: oldDoc.childId, coachId: oldDoc.coachId
    }, '管理员')).toBeNull();
  });

  test('改期 + 改时间：一条记录，action 类别串联，detail 带原值新值', () => {
    const log = sr.buildChangeLog(oldDoc, {
      date: '2026-09-22', startTime: '14:00', location: oldDoc.location,
      childId: oldDoc.childId, coachId: oldDoc.coachId
    }, '王管理员');
    expect(log).not.toBeNull();
    expect(log.action).toBe('改期/改时间');
    expect(log.detail).toContain('2026-09-21 → 2026-09-22');
    expect(log.detail).toContain('10:00 → 14:00');
    expect(log.by).toBe('王管理员');
    expect(log.at instanceof Date).toBe(true);
  });

  test('改地点（含空值显示「空」）/ 换教练 / 换学员各出对应文案', () => {
    const loc = sr.buildChangeLog(oldDoc, { location: '总馆' }, '管理员');
    expect(loc.action).toBe('改地点');
    expect(loc.detail).toBe('地点 河东体育场 → 总馆');

    const coach = sr.buildChangeLog(oldDoc, { coachId: 'c2', coachName: '小李教练' }, '管理员');
    expect(coach.action).toBe('换教练');
    expect(coach.detail).toBe('教练 小张教练 → 小李教练');

    const child = sr.buildChangeLog(oldDoc, { childId: 's2', childName: '天天' }, '管理员');
    expect(child.action).toBe('换学员');
    expect(child.detail).toBe('学员 小明 → 天天');

    // 旧文档缺地点字段 → 显示「空」，不断头
    const filled = sr.buildChangeLog({ startTime: '10:00' }, { location: '总馆' }, '管理员');
    expect(filled.detail).toBe('地点 空 → 总馆');
  });

  test('只改时长也留痕：归入「改时间」，detail 带时长原值新值', () => {
    const withDur = Object.assign({}, oldDoc, { duration: '60分钟' });
    const d = sr.buildChangeLog(withDur, { duration: '90分钟' }, '管理员');
    expect(d.action).toBe('改时间');
    expect(d.detail).toBe('时长 60分钟 → 90分钟');

    // 旧文档缺 duration 字段 → 显示「空」，不断头
    const d2 = sr.buildChangeLog(oldDoc, { duration: '90分钟' }, '管理员');
    expect(d2.action).toBe('改时间');
    expect(d2.detail).toBe('时长 空 → 90分钟');
  });

  test('appendChangeLog：追加 + 截尾到 20 条，不改原数组', () => {
    const logs = Array.from({ length: 20 }, (_, i) => ({ seq: i }));
    const entry = { seq: 99 };
    const next = sr.appendChangeLog(logs, entry);
    expect(next.length).toBe(sr.CHANGE_LOG_CAP);
    expect(next[next.length - 1]).toBe(entry);
    expect(next[0].seq).toBe(1);          // 最老的被挤掉
    expect(logs.length).toBe(20);         // 原数组不动
    expect(sr.appendChangeLog(undefined, entry)).toEqual([entry]); // 无历史也能追加
  });
});
