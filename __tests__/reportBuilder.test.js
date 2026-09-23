/**
 * 成长报告构建器的单测：周期范围 / 统计聚合 / 体态变化 / 草稿组装 /
 * 期内能力对比（helper.buildPeriodAbilityRows）。
 * 报告是家长直接看的东西，数字错一个都是事故，所以这里盯得比较细。
 */
const rb = require('../miniprogram/utils/reportBuilder');
const { buildPeriodAbilityRows } = require('../miniprogram/utils/helper');

describe('reportBuilder 周期范围', () => {
  test('monthRange：普通月', () => {
    const r = rb.monthRange(2026, 9);
    expect(r.start).toBe('2026-09-01');
    expect(r.end).toBe('2026-09-30');
    expect(r.label).toBe('2026年9月');
    expect(r.endTs).toBeGreaterThan(r.startTs);
  });

  test('monthRange：闰年二月 29 天，平年 28 天', () => {
    expect(rb.monthRange(2024, 2).end).toBe('2024-02-29');
    expect(rb.monthRange(2026, 2).end).toBe('2026-02-28');
    expect(rb.monthRange(2026, 12).end).toBe('2026-12-31');
  });

  test('quarterRange：Q1 和 Q4 的边界', () => {
    const q1 = rb.quarterRange(2026, 1);
    expect(q1.start).toBe('2026-01-01');
    expect(q1.end).toBe('2026-03-31');
    expect(q1.label).toContain('一季度');

    const q4 = rb.quarterRange(2026, 4);
    expect(q4.start).toBe('2026-10-01');
    expect(q4.end).toBe('2026-12-31');
    expect(q4.label).toContain('四季度');
  });

  test('buildMonthOptions：含当前月、往前回滚跨年', () => {
    const options = rb.buildMonthOptions(new Date(2026, 8, 20), 12);
    expect(options).toHaveLength(12);
    expect(options[0]).toMatchObject({ year: 2026, month: 9 });
    expect(options[11]).toMatchObject({ year: 2025, month: 10 });
  });

  test('buildQuarterOptions：9 月属于三季度，往前回滚', () => {
    const options = rb.buildQuarterOptions(new Date(2026, 8, 20), 6);
    expect(options).toHaveLength(6);
    expect(options[0]).toMatchObject({ year: 2026, quarter: 3 });
    expect(options[1]).toMatchObject({ year: 2026, quarter: 2 });
    expect(options[3]).toMatchObject({ year: 2025, quarter: 4 });
    expect(options[4]).toMatchObject({ year: 2025, quarter: 3 });
  });
});

describe('reportBuilder.buildStatsData 本期完成', () => {
  test('只数 finished，主题分布降序，课时只累计支出', () => {
    const trainings = [
      { status: 'finished', type: '速度' },
      { status: 'finished', type: '速度' },
      { status: 'finished', type: '耐力' },
      { status: 'pending', type: '速度' },   // 未上课不计
      { status: 'finished' }                  // 无类型归「常规训练」
    ];
    const hours = [
      { type: 'expense', amount: 2 },
      { type: 'expense', amount: 1 },
      { type: 'income', amount: 20 }          // 充值不算消耗
    ];
    const s = rb.buildStatsData(trainings, hours);
    expect(s.finishedCount).toBe(4);
    expect(s.plannedCount).toBe(5);
    expect(s.typeCounts[0]).toEqual({ type: '速度', count: 2 });
    expect(s.typeCounts[1]).toEqual({ type: '耐力', count: 1 });
    expect(s.typeCounts[2]).toEqual({ type: '常规训练', count: 1 });
    expect(s.hoursUsed).toBe(3);
  });

  test('空输入不炸，全 0', () => {
    const s = rb.buildStatsData([], []);
    expect(s).toEqual({ finishedCount: 0, plannedCount: 0, typeCounts: [], hoursUsed: 0 });
  });
});

describe('reportBuilder.buildBodyRows 体态变化', () => {
  const mk = (height, weight, month) => ({
    createdAt: new Date(2026, month - 1, 15),
    basicInfo: { height, weight }
  });

  test('期初 vs 期末，长个长重都是正向', () => {
    const rows = rb.buildBodyRows([mk(128, 25, 7), mk(131, 26.5, 9)]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ key: 'height', valueText: '131cm', deltaText: '+3cm', improved: true });
    expect(rows[1]).toMatchObject({ key: 'weight', deltaText: '+1.5kg' });
  });

  test('身高/体重为 0 视为没量（测评端空值存 0），不出荒谬数字', () => {
    const rows = rb.buildBodyRows([mk(0, 26, 7), mk(131, 26.5, 9)]);
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe('weight');
    expect(rb.buildBodyRows([mk(131, 0, 7), mk(133, 26, 9)])).toHaveLength(1);
  });

  test('只有一次测评 / 没变化 / 缺字段 → 不出行', () => {
    expect(rb.buildBodyRows([mk(128, 25, 7)])).toEqual([]);
    expect(rb.buildBodyRows([mk(128, 25, 7), mk(128, 25, 9)])).toEqual([]);
    expect(rb.buildBodyRows([{ basicInfo: {} }, { basicInfo: {} }])).toEqual([]);
    expect(rb.buildBodyRows([])).toEqual([]);
  });

  test('createdAt 缺失时保持原顺序兜底', () => {
    const rows = rb.buildBodyRows([
      { basicInfo: { height: 130, weight: 26 } },
      { createdAt: new Date(2026, 6, 1), basicInfo: { height: 128, weight: 25 } }
    ]);
    // 无 createdAt 的记录 toTs=0 排最前当期初，最后一行报期末值
    expect(rows[0]).toMatchObject({ key: 'height', valueText: '128cm', deltaText: '-2cm' });
  });
});

describe('helper.buildPeriodAbilityRows 期内能力对比', () => {
  test('50米从 9.0 到 8.5：更快 = 进步（lower better）', () => {
    const rows = buildPeriodAbilityRows([
      { weekDate: '2026-09-21', fiftyMeter: '8.5' },
      { weekDate: '2026-09-01', fiftyMeter: '9.0' }
    ]);
    const speed = rows.find(r => r.key === 'speed');
    expect(speed).toBeTruthy();
    expect(speed.valueText).toContain('8.5');
    expect(speed.firstText).toContain('9');
    expect(speed.isImprovement).toBe(true);
    expect(speed.deltaText).toContain('0.5');
  });

  test('不足展示精度的变化不出「快0秒」：8.52 → 8.49 显示都是 8.5秒', () => {
    const rows = buildPeriodAbilityRows([
      { weekDate: '2026-09-01', fiftyMeter: '8.52' },
      { weekDate: '2026-09-21', fiftyMeter: '8.49' }
    ]);
    const speed = rows.find(r => r.key === 'speed');
    expect(speed.hasData).toBe(true);
    expect(speed.deltaText).toBe('');
  });

  test('指标字段是数组时取第一个非空值（线上历史数据形态）', () => {
    const rows = buildPeriodAbilityRows([
      { weekDate: '2026-09-01', fiftyMeter: ['9.2', ''] },
      { weekDate: '2026-09-21', fiftyMeter: ['8.8', ''] }
    ]);
    const speed = rows.find(r => r.key === 'speed');
    expect(speed.isImprovement).toBe(true);
  });

  test('期内只测过一次：有当前值无 delta', () => {
    const rows = buildPeriodAbilityRows([{ weekDate: '2026-09-10', fiftyMeter: '8.6' }]);
    const speed = rows.find(r => r.key === 'speed');
    expect(speed.hasData).toBe(true);
    expect(speed.deltaText).toBe('');
    expect(speed.isImprovement).toBeNull();
  });

  test('没测过的能力域直接不出现，全空返回 []', () => {
    const rows = buildPeriodAbilityRows([{ weekDate: '2026-09-10', fiftyMeter: '8.6' }]);
    expect(rows.find(r => r.key === 'strength')).toBeUndefined();
    expect(buildPeriodAbilityRows([])).toEqual([]);
    expect(buildPeriodAbilityRows([{ weekDate: '' }])).toEqual([]);
  });
});

describe('reportBuilder.buildDraftSections 草稿组装', () => {
  const period = rb.monthRange(2026, 9);

  test('六块按蓝图顺序，auto 块预填，观点块留空', () => {
    const sections = rb.buildDraftSections({
      period,
      trainings: [{ status: 'finished', type: '速度' }],
      performances: [{ weekDate: '2026-09-01', fiftyMeter: '9.0' }, { weekDate: '2026-09-21', fiftyMeter: '8.5' }],
      assessments: [],
      hoursRecords: [{ type: 'expense', amount: 4 }],
      goal: '备战体考'
    });

    expect(sections.map(s => s.kind)).toEqual(['stats', 'ability', 'photos', 'comment', 'plan', 'action']);
    expect(sections[0].data.finishedCount).toBe(1);
    expect(sections[0].empty).toBe(false);
    expect(sections[1].data.rows.find(r => r.key === 'speed').isImprovement).toBe(true);
    expect(sections[3].content).toBe('');
    expect(sections[4].goal).toBe('备战体考');
    // photos 带 videos、plan/action 带 tags：渲染端空态守卫按这些字段判断，缺了会判不出
    expect(sections[2].fileIDs).toEqual([]);
    expect(sections[2].videos).toEqual([]);
    expect(sections[4].tags).toEqual([]);
    expect(sections[5].tags).toEqual([]);
  });

  test('完全没数据：六块骨架还在，auto 块标记 empty', () => {
    const sections = rb.buildDraftSections({ period });
    expect(sections).toHaveLength(6);
    expect(sections[0].empty).toBe(true);
    expect(sections[1].empty).toBe(true);
    expect(sections[4].goal).toBe('');
  });

  test('goal 空白字符串按无目标处理', () => {
    const sections = rb.buildDraftSections({ period, goal: '   ' });
    expect(sections[4].goal).toBe('');
  });
});

describe('reportBuilder.mergeDraftSections 换周期保留教练内容', () => {
  const period = rb.monthRange(2026, 9);
  const fresh = () => rb.buildDraftSections({ period });

  test('auto 块换成新的，教练写过的块原样保留', () => {
    const old = fresh();
    old[0].data.finishedCount = 99;       // 旧周期的脏数据
    old[2].fileIDs = ['cloud://a.jpg'];   // 教练挑过照片
    old[3].content = '孩子本期非常努力';   // 教练写过点评

    const merged = rb.mergeDraftSections(fresh(), old);
    expect(merged[0].data.finishedCount).toBe(0);           // auto 被刷新
    expect(merged[2].fileIDs).toEqual(['cloud://a.jpg']);   // 照片保留
    expect(merged[3].content).toBe('孩子本期非常努力');       // 点评保留
    expect(merged).toHaveLength(6);
  });

  test('旧草稿为空 / 缺某块时也能安全合并', () => {
    expect(rb.mergeDraftSections(fresh(), [])).toHaveLength(6);
    expect(rb.mergeDraftSections(fresh(), null)).toHaveLength(6);
  });
});

describe('reportBuilder.buildVisibleSections 家长端成品视图', () => {
  // 「待补充 / 还没挑选照片或视频」是编辑器占位话术，家长海报上不该出现：
  // 空的教练块整段过滤，自动块和未知块保留
  const K = rb.SECTION_KINDS;

  test('空的教练块被过滤：没照片没视频、纯空点评、空计划空行动', () => {
    const sections = rb.buildDraftSections({ period: rb.monthRange(2026, 9) });
    const visible = rb.buildVisibleSections(sections);
    // 六块里只剩 stats/ability 两个自动块
    expect(visible.map(s => s.kind)).toEqual([K.STATS, K.ABILITY]);
  });

  test('写了一点内容的教练块整块保留', () => {
    const sections = rb.buildDraftSections({ period: rb.monthRange(2026, 9) });
    sections[2].videos = ['cloud://v.mp4'];                 // 只放了视频也算有精彩证据
    sections[3].content = '   ';                            // 编辑器口径：content 为真值即算写过
    sections[5].tags = ['拉伸打卡'];                         // 只打了标签没写正文
    const visible = rb.buildVisibleSections(sections);
    expect(visible.map(s => s.kind)).toEqual([K.STATS, K.ABILITY, K.PHOTOS, K.COMMENT, K.ACTION]);
  });

  test('自动块即使 empty 也保留（暂无记录是事实陈述，不是没写完）', () => {
    const sections = [
      { kind: K.STATS, title: '本期完成', source: 'auto', data: { finishedCount: 0, hoursUsed: 0, typeCounts: [] }, empty: true },
      { kind: K.PHOTOS, title: '精彩证据', source: 'coach', fileIDs: [], videos: [] }
    ];
    expect(rb.buildVisibleSections(sections).map(s => s.kind)).toEqual([K.STATS]);
  });

  test('入参为空 / 缺字段时安全：非教练块放行，教练块缺内容一律不放（fail-closed）', () => {
    expect(rb.buildVisibleSections(null)).toEqual([]);
    expect(rb.buildVisibleSections([])).toEqual([]);
    expect(rb.buildVisibleSections([{ kind: 'mystery' }])).toEqual([{ kind: 'mystery' }]);
    expect(rb.buildVisibleSections([{ kind: 'mystery', source: 'coach' }])).toEqual([]);
  });
});
