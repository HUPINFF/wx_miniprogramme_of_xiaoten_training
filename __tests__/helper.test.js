const {
  formatTime,
  parsePerformanceValue,
  formatPerformanceValue,
  getSportName,
  classifyAppointments,
  toLocalDate,
  diffInDays,
  getTodayString,
  getWeekRange,
  formatWeekRangeText,
  formatMonthLabel,
  getTrainingStatusMeta,
  pickCurrentTraining,
  findActiveClassForChild,
  parseSessionStart,
  formatDurationText,
  elapsedMinutesOf,
  PERFORMANCE_METRICS,
  getMetricMeta,
  formatMetricValue,
  formatDeltaNumber,
  formatDeltaText,
  readTouchedField,
  pickProgressHighlight,
  pickItemProgress,
  summarizeAbilityGroups,
  ABILITY_GROUPS,
  canViewChild
} = require('../miniprogram/utils/helper');

// 模拟运动项目配置（与 growth/index.js 中的 sportsItems 一致）
const sportItems = [
  { key: 'fiftyMeter', name: '50米', unit: '秒', yMin: 5, yMax: 20 },
  { key: 'eightHundredMeter', name: '800米', unit: '分', yMin: 2.5, yMax: 3.5 },
  { key: 'thousandMeter', name: '1000米', unit: '秒', yMin: 120, yMax: 400 },
  { key: 'standingLongJump', name: '立定跳远', unit: '米', yMin: 1, yMax: 3 },
  { key: 'sitUp', name: '仰卧起坐', unit: '个', yMin: 0, yMax: 100 },
  { key: 'ropeSkipping', name: '跳绳', unit: '个', yMin: 50, yMax: 250 }
];

// ==================== formatTime ====================
describe('formatTime', () => {
  test('将 Date 对象格式化为 YYYY-MM-DD', () => {
    expect(formatTime(new Date('2024-03-15'))).toBe('2024-03-15');
  });

  test('将日期字符串格式化为 YYYY-MM-DD', () => {
    expect(formatTime('2024-03-15')).toBe('2024-03-15');
  });

  test('传入空值时返回空字符串', () => {
    expect(formatTime('')).toBe('');
    expect(formatTime(null)).toBe('');
    expect(formatTime(undefined)).toBe('');
  });
});

// ==================== parsePerformanceValue ====================
describe('parsePerformanceValue', () => {
  test('数字直接返回', () => {
    expect(parsePerformanceValue(8.5, 'fiftyMeter')).toBe(8.5);
  });

  test('立定跳远除以100（厘米转米）', () => {
    expect(parsePerformanceValue(207, 'standingLongJump')).toBe(2.07);
  });

  test('800米解析 "3分20秒" 为分钟数', () => {
    const result = parsePerformanceValue('3分20秒', 'eightHundredMeter');
    expect(result).toBeCloseTo(3.333, 2);
  });

  test('1000米解析 "5分10秒" 为秒数', () => {
    expect(parsePerformanceValue('5分10秒', 'thousandMeter')).toBe(310);
  });

  test('数字字符串提取数值', () => {
    expect(parsePerformanceValue('45', 'sitUp')).toBe(45);
  });

  test('null/undefined 返回 null', () => {
    expect(parsePerformanceValue(null, 'fiftyMeter')).toBeNull();
    expect(parsePerformanceValue(undefined, 'fiftyMeter')).toBeNull();
  });
});

// ==================== formatPerformanceValue ====================
describe('formatPerformanceValue', () => {
  test('800米显示为 分"秒 格式', () => {
    expect(formatPerformanceValue(3.33, 'eightHundredMeter', sportItems)).toBe("3'20\"");
  });

  test('1000米显示为 分"秒 格式', () => {
    expect(formatPerformanceValue(310, 'thousandMeter', sportItems)).toBe("5'10\"");
  });

  test('其他项目显示数值+单位', () => {
    expect(formatPerformanceValue(8.5, 'fiftyMeter', sportItems)).toBe('8.5秒');
  });

  test('null 返回空字符串', () => {
    expect(formatPerformanceValue(null, 'fiftyMeter', sportItems)).toBe('');
  });
});

// ==================== getSportName ====================
describe('getSportName', () => {
  test('通过 key 获取项目名称', () => {
    expect(getSportName('fiftyMeter', sportItems)).toBe('50米');
    expect(getSportName('ropeSkipping', sportItems)).toBe('跳绳');
  });

  test('不存在的 key 返回空字符串', () => {
    expect(getSportName('nonexistent', sportItems)).toBe('');
  });
});

// ==================== classifyAppointments ====================
describe('classifyAppointments', () => {
  test('按状态正确分类预约列表', () => {
    const appointments = [
      { id: 1, status: 'pending' },
      { id: 2, status: 'approved' },
      { id: 3, status: 'rejected' },
      { id: 4, status: 'completed' },
      { id: 5, status: 'pending' }
    ];

    const result = classifyAppointments(appointments);
    expect(result.pending).toHaveLength(2);
    expect(result.approved).toHaveLength(1);
    expect(result.rejected).toHaveLength(1);
    expect(result.completed).toHaveLength(1);
  });

  test('未知状态不纳入任何分类', () => {
    const appointments = [
      { id: 1, status: 'unknown' }
    ];

    const result = classifyAppointments(appointments);
    expect(result.pending).toHaveLength(0);
    expect(result.approved).toHaveLength(0);
    expect(result.rejected).toHaveLength(0);
    expect(result.completed).toHaveLength(0);
  });

  test('空数组返回空分类', () => {
    const result = classifyAppointments([]);
    expect(result.pending).toEqual([]);
    expect(result.approved).toEqual([]);
    expect(result.rejected).toEqual([]);
    expect(result.completed).toEqual([]);
  });
});

// ==================== toLocalDate / diffInDays ====================
describe('toLocalDate', () => {
  test('日期字符串按本地时间解析，不因时区回退一天', () => {
    const d = toLocalDate('2026-01-01');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(0);
  });

  test('Date 对象做拷贝，不共享引用', () => {
    const source = new Date(2026, 8, 15);
    const copy = toLocalDate(source);
    expect(copy.getTime()).toBe(source.getTime());
    expect(copy).not.toBe(source);
  });

  test('空值/非法值返回 null', () => {
    expect(toLocalDate(null)).toBeNull();
    expect(toLocalDate(undefined)).toBeNull();
    expect(toLocalDate('')).toBeNull();
    expect(toLocalDate({})).toBeNull();
  });
});

describe('diffInDays', () => {
  test('同周间隔 7 天', () => {
    expect(diffInDays('2026-09-07', '2026-09-14')).toBe(7);
  });

  test('跨年正常计算', () => {
    expect(diffInDays('2025-12-29', '2026-01-01')).toBe(3);
  });

  test('返回负数表示 to 在 from 之前', () => {
    expect(diffInDays('2026-09-14', '2026-09-07')).toBe(-7);
  });

  test('不受时分秒影响（按自然日）', () => {
    expect(diffInDays(new Date(2026, 8, 7, 23, 59), new Date(2026, 8, 8, 0, 1))).toBe(1);
  });

  test('非法输入返回 null', () => {
    expect(diffInDays('', '2026-09-07')).toBeNull();
  });
});

// ==================== getTodayString ====================
describe('getTodayString', () => {
  test('Date 对象格式化为 YYYY-MM-DD', () => {
    expect(getTodayString(new Date(2026, 8, 15))).toBe('2026-09-15');
  });

  test('日期字符串原样规范输出', () => {
    expect(getTodayString('2026-09-15')).toBe('2026-09-15');
    expect(getTodayString('2026-9-5')).toBe('2026-09-05');
  });

  test('非法输入返回空字符串', () => {
    expect(getTodayString('not-a-date')).toBe('');
  });
});

// ==================== getWeekRange（跨年是关键） ====================
describe('getWeekRange', () => {
  test('普通周：周一 ~ 周日', () => {
    // 2026-09-15 是周二
    const range = getWeekRange('2026-09-15');
    expect(range.start).toBe('2026-09-14');
    expect(range.end).toBe('2026-09-20');
  });

  test('跨年：2026-01-01（周四）所在周落在 2025 年', () => {
    // 这是 R5 那个 bug 的验收点：周一必须取自己的年份，不能被基准日的年份顶替
    const range = getWeekRange('2026-01-01');
    expect(range.start).toBe('2025-12-29');
    expect(range.end).toBe('2026-01-04');
  });

  test('跨年：2025-12-31（周三）属于同一周', () => {
    const range = getWeekRange('2025-12-31');
    expect(range.start).toBe('2025-12-29');
    expect(range.end).toBe('2026-01-04');
  });

  test('周日归入本周而非下周', () => {
    const range = getWeekRange('2026-01-04');
    expect(range.start).toBe('2025-12-29');
    expect(range.end).toBe('2026-01-04');
  });

  test('周一就是本周第一天', () => {
    const range = getWeekRange('2026-09-14');
    expect(range.start).toBe('2026-09-14');
    expect(range.end).toBe('2026-09-20');
  });

  test('startDate/endDate 是本地 Date，跨年也正确', () => {
    const range = getWeekRange('2026-01-01');
    expect(range.startDate.getFullYear()).toBe(2025);
    expect(range.endDate.getFullYear()).toBe(2026);
  });

  test('不传参时取当前时间，返回结构完整', () => {
    const range = getWeekRange();
    expect(range.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(range.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(diffInDays(range.start, range.end)).toBe(6);
  });

  test('非法输入返回 null', () => {
    expect(getWeekRange('nonsense')).toBeNull();
  });
});

// ==================== formatWeekRangeText ====================
describe('formatWeekRangeText', () => {
  test('同年省略后面的年份', () => {
    expect(formatWeekRangeText('2026-09-14', '2026-09-20')).toBe('2026年9月14日-9月20日');
  });

  test('跨年两端都带年份且不带前导零', () => {
    expect(formatWeekRangeText('2025-12-29', '2026-01-04')).toBe('2025年12月29日-2026年1月4日');
  });

  test('非法输入返回空字符串', () => {
    expect(formatWeekRangeText('', '2026-09-20')).toBe('');
  });
});

// ==================== formatMonthLabel ====================
describe('formatMonthLabel', () => {
  test('去掉月份前导零', () => {
    // growth/index.js 直接拼 parts[1]，会渲染成「2026年09月」
    expect(formatMonthLabel('2026-09')).toBe('2026年9月');
    expect(formatMonthLabel('2026-12')).toBe('2026年12月');
  });

  test('已经是中文格式时原样返回', () => {
    expect(formatMonthLabel('2026年9月')).toBe('2026年9月');
  });

  test('空值返回空字符串', () => {
    expect(formatMonthLabel('')).toBe('');
    expect(formatMonthLabel(null)).toBe('');
  });
});

// ==================== getTrainingStatusMeta ====================
describe('getTrainingStatusMeta', () => {
  test('已知状态映射到家长端文案', () => {
    expect(getTrainingStatusMeta('pending').text).toBe('待上课');
    expect(getTrainingStatusMeta('scheduled').text).toBe('已排课');
    expect(getTrainingStatusMeta('in_class').text).toBe('上课中');
    expect(getTrainingStatusMeta('finished').text).toBe('已完成');
  });

  test('undefined / null / 空串回落到「待上课」', () => {
    expect(getTrainingStatusMeta(undefined).text).toBe('待上课');
    expect(getTrainingStatusMeta(null).text).toBe('待上课');
    expect(getTrainingStatusMeta('').text).toBe('待上课');
  });

  test('未知状态回落，不返回 undefined', () => {
    const meta = getTrainingStatusMeta('some_new_status');
    expect(meta.text).toBe('待上课');
    expect(meta.key).toBe('pending');
    expect(meta.type).toBe('pending');
  });
});

// ==================== pickCurrentTraining ====================
describe('pickCurrentTraining', () => {
  const TODAY = '2026-09-15';

  test('有 in_class 的记录时优先返回「正在上课」', () => {
    const result = pickCurrentTraining([
      { date: '2026-09-16', startTime: '10:00', status: 'pending' },
      { date: '2026-09-15', startTime: '18:30', status: 'in_class' }
    ], { today: TODAY });

    expect(result.mode).toBe('in_class');
    expect(result.training.startTime).toBe('18:30');
  });

  test('in_class 优先于更早的 upcoming', () => {
    const result = pickCurrentTraining([
      { date: '2026-09-15', startTime: '09:00', status: 'pending' },
      { date: '2026-09-20', startTime: '18:30', status: 'in_class' }
    ], { today: TODAY });

    expect(result.mode).toBe('in_class');
    expect(result.training.date).toBe('2026-09-20');
  });

  test('多条 in_class 时取开始得最晚的那节', () => {
    // 09:00 那节教练忘点下课还挂着，18:30 这节才是真的在上。
    // 取最早会显示「已进行 9 小时」—— 开始得最晚的才最可能还在上
    const result = pickCurrentTraining([
      { date: '2026-09-15', startTime: '09:00', status: 'in_class' },
      { date: '2026-09-15', startTime: '18:30', status: 'in_class' }
    ], { today: TODAY });

    expect(result.training.startTime).toBe('18:30');
  });

  test('昨天和今天都挂着 in_class 时，取今天那节', () => {
    // 昨天那节教练忘点下课，今天这节才是真的在上
    const result = pickCurrentTraining([
      { date: '2026-09-14', startTime: '18:30', status: 'in_class' },
      { date: '2026-09-15', startTime: '10:00', status: 'in_class' }
    ], { today: TODAY });

    expect(result.mode).toBe('in_class');
    expect(result.training.date).toBe('2026-09-15');
  });

  test('昨天的 in_class 不再算「正在上课」（教练点了开始上课就没再管）', () => {
    const result = pickCurrentTraining([
      { date: '2026-09-14', startTime: '18:30', status: 'in_class' }
    ], { today: TODAY });

    expect(result.mode).toBe('none');
  });

  test('今天的 in_class 整天都算「正在上课」，几点开始都不受影响', () => {
    // 早上 8 点开始、教练一直没点下课，到了晚上也不该消失
    const result = pickCurrentTraining([
      { date: '2026-09-15', startTime: '08:00', endTime: '09:00', status: 'in_class' }
    ], { today: TODAY });

    expect(result.mode).toBe('in_class');
  });

  test('有昨天的 in_class 时，不影响选出正常的「下节课」', () => {
    const result = pickCurrentTraining([
      { date: '2026-09-14', startTime: '18:30', status: 'in_class' },
      { date: '2026-09-16', startTime: '10:00', status: 'pending' }
    ], { today: TODAY });

    expect(result.mode).toBe('upcoming');
    expect(result.training.date).toBe('2026-09-16');
  });

  test('没有 in_class 时取最近的待上课', () => {
    const result = pickCurrentTraining([
      { date: '2026-09-20', startTime: '10:00', status: 'pending' },
      { date: '2026-09-16', startTime: '18:30', status: 'scheduled' }
    ], { today: TODAY });

    expect(result.mode).toBe('upcoming');
    expect(result.training.date).toBe('2026-09-16');
  });

  test('同一天按 startTime 排序', () => {
    const result = pickCurrentTraining([
      { date: '2026-09-16', startTime: '18:30', status: 'pending' },
      { date: '2026-09-16', startTime: '09:00', status: 'pending' }
    ], { today: TODAY });

    expect(result.training.startTime).toBe('09:00');
  });

  test('今天已经上完的课仍算「下节课」——只看日期，不看时刻', () => {
    // 早上 8-9 点那节，哪怕现在是晚上，只要还是今天就还得显示
    const result = pickCurrentTraining([
      { date: '2026-09-15', startTime: '08:00', endTime: '09:00', status: 'pending' }
    ], { today: TODAY });

    expect(result.mode).toBe('upcoming');
  });

  test('今天的课缺 startTime / endTime 也照样算「下节课」', () => {
    const result = pickCurrentTraining([
      { date: '2026-09-15', status: 'pending' }
    ], { today: TODAY });

    expect(result.mode).toBe('upcoming');
  });

  test('今天和明天都有课时，取今天那节', () => {
    const result = pickCurrentTraining([
      { date: '2026-09-16', startTime: '10:00', status: 'pending' },
      { date: '2026-09-15', startTime: '08:00', status: 'pending' }
    ], { today: TODAY });

    expect(result.mode).toBe('upcoming');
    expect(result.training.date).toBe('2026-09-15');
  });

  test('date 是 Date 类型的历史数据也能正确判成「昨天」', () => {
    // String(new Date(...)) 得到 "Thu Sep 10 2026 ..."，字典序比 '2026-09-15' 大，
    // 不归一化的话会把这节课当成未来的
    const result = pickCurrentTraining([
      { date: new Date(2026, 8, 10), startTime: '18:30', status: 'pending' }
    ], { today: TODAY });

    expect(result.mode).toBe('none');
  });

  test('跳过已完成的课', () => {
    const result = pickCurrentTraining([
      { date: '2026-09-15', startTime: '08:00', status: 'finished' },
      { date: '2026-09-16', startTime: '18:30', status: 'pending' }
    ], { today: TODAY });

    expect(result.mode).toBe('upcoming');
    expect(result.training.date).toBe('2026-09-16');
  });

  test('全是已完成的课 → none', () => {
    const result = pickCurrentTraining([
      { date: '2026-09-14', startTime: '08:00', status: 'finished' }
    ], { today: TODAY });

    expect(result.mode).toBe('none');
    expect(result.training).toBeNull();
  });

  test('过去的待上课记录不算「下节课」', () => {
    const result = pickCurrentTraining([
      { date: '2026-09-10', startTime: '18:30', status: 'pending' }
    ], { today: TODAY });

    expect(result.mode).toBe('none');
  });

  test('空数组 / null / 无 date 的记录 → none', () => {
    expect(pickCurrentTraining([], { today: TODAY }).mode).toBe('none');
    expect(pickCurrentTraining(null, { today: TODAY }).mode).toBe('none');
    expect(pickCurrentTraining(undefined, { today: TODAY }).mode).toBe('none');
    expect(pickCurrentTraining([{ startTime: '08:00' }], { today: TODAY }).mode).toBe('none');
  });

  test('缺 status 的记录按「待上课」处理', () => {
    const result = pickCurrentTraining([
      { date: '2026-09-16', startTime: '18:30' }
    ], { today: TODAY });

    expect(result.mode).toBe('upcoming');
  });

  test('缺 startTime 不会崩，仍能选出记录', () => {
    const result = pickCurrentTraining([
      { date: '2026-09-16', status: 'pending' }
    ], { today: TODAY });

    expect(result.mode).toBe('upcoming');
    expect(result.training.date).toBe('2026-09-16');
  });
});

// ==================== parseSessionStart / formatDurationText / elapsedMinutesOf ====================
// 这三个是首页「正在上课」正计时和详情页头图共用的，两边显示必须一致
describe('parseSessionStart', () => {
  test('date + startTime 拼成本地时间，不是 UTC', () => {
    // 用本地构造器解析，所以 getHours() 就是 startTime 里的 14，
    // 写成 new Date('2026-09-15 14:30') 在东八区会得到 22:30
    const date = parseSessionStart({ date: '2026-09-15', startTime: '14:30' });
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(8);
    expect(date.getDate()).toBe(15);
    expect(date.getHours()).toBe(14);
    expect(date.getMinutes()).toBe(30);
  });

  test('缺 startTime 时退回当天零点，不返回 null', () => {
    const date = parseSessionStart({ date: '2026-09-15' });
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
  });

  test('缺 date 或入参为空返回 null', () => {
    expect(parseSessionStart({ startTime: '14:30' })).toBeNull();
    expect(parseSessionStart(null)).toBeNull();
    expect(parseSessionStart(undefined)).toBeNull();
  });
});

describe('formatDurationText', () => {
  test('不足一小时按分钟', () => {
    expect(formatDurationText(32)).toBe('32分钟');
    expect(formatDurationText(59)).toBe('59分钟');
  });

  test('整小时不带「0分」', () => {
    expect(formatDurationText(60)).toBe('1小时');
    expect(formatDurationText(120)).toBe('2小时');
  });

  test('超过一小时给时和分', () => {
    expect(formatDurationText(72)).toBe('1小时12分');
  });

  test('0、负数、NaN、空值一律「刚刚开始」', () => {
    expect(formatDurationText(0)).toBe('刚刚开始');
    expect(formatDurationText(-5)).toBe('刚刚开始');
    expect(formatDurationText(NaN)).toBe('刚刚开始');
    expect(formatDurationText(null)).toBe('刚刚开始');
    expect(formatDurationText(undefined)).toBe('刚刚开始');
  });
});

describe('elapsedMinutesOf', () => {
  const NOW = new Date(2026, 8, 15, 15, 2, 0);  // 2026-09-15 15:02

  test('优先用实际开课时间算，而不是计划开始时间', () => {
    // 计划 14:00 开课，教练 14:30 才点「开始上课」→ 应算 32 分钟，不是 62
    const minutes = elapsedMinutesOf({
      date: '2026-09-15',
      startTime: '14:00',
      inClassTime: new Date(2026, 8, 15, 14, 30, 0)
    }, NOW);

    expect(minutes).toBe(32);
  });

  test('教练没记录实际开课时间时退回计划开始时间', () => {
    const minutes = elapsedMinutesOf({ date: '2026-09-15', startTime: '14:30' }, NOW);
    expect(minutes).toBe(32);
  });

  test('两个开始时刻都没有返回 null —— 调用方不该编一个假数字', () => {
    expect(elapsedMinutesOf({ date: '', startTime: '' }, NOW)).toBeNull();
    expect(elapsedMinutesOf(null, NOW)).toBeNull();
  });

  test('开始时刻还没到不会返回负数', () => {
    // 提前点了「开始上课」，或机器时钟有偏差
    const minutes = elapsedMinutesOf({
      date: '2026-09-15',
      startTime: '16:00'
    }, NOW);

    expect(minutes).toBe(0);
    expect(formatDurationText(minutes)).toBe('刚刚开始');
  });

  test('上一节没点下课的课仍能算出正确的分钟数', () => {
    const minutes = elapsedMinutesOf({
      date: '2026-09-14',
      startTime: '14:00',
      inClassTime: new Date(2026, 8, 14, 14, 0, 0)
    }, NOW);

    expect(minutes).toBe(25 * 60 + 2);  // 跨天，约 25 小时
    expect(formatDurationText(minutes)).toBe('25小时2分');
  });
});

// ==================== PERFORMANCE_METRICS ====================
describe('PERFORMANCE_METRICS', () => {
  test('每个指标字段完整', () => {
    PERFORMANCE_METRICS.forEach((meta) => {
      expect(typeof meta.key).toBe('string');
      expect(meta.name).toBeTruthy();
      expect(['lower', 'higher']).toContain(meta.betterDirection);
      expect(meta.deltaScale).toBeGreaterThan(0);
      expect(meta.deltaUnit).toBeTruthy();
    });
  });

  test('800米 deltaScale 为 60：parse 返回分钟，delta 要换算成秒', () => {
    // 这是 R6：不换算的话，「3分20秒→3分10秒」的进步会被渲染成「进步 0.17」
    expect(getMetricMeta('eightHundredMeter').deltaScale).toBe(60);
    expect(getMetricMeta('eightHundredMeter').deltaUnit).toBe('秒');
  });

  test('跑步类越小越好，计数类越大越好', () => {
    expect(getMetricMeta('fiftyMeter').betterDirection).toBe('lower');
    expect(getMetricMeta('thousandMeter').betterDirection).toBe('lower');
    expect(getMetricMeta('standingLongJump').betterDirection).toBe('higher');
    expect(getMetricMeta('sitUp').betterDirection).toBe('higher');
  });

  test('未知指标返回 null', () => {
    expect(getMetricMeta('nonexistent')).toBeNull();
  });
});

describe('formatMetricValue', () => {
  test('跑步走 分\'秒" 格式', () => {
    expect(formatMetricValue(parsePerformanceValue('3分20秒', 'eightHundredMeter'), 'eightHundredMeter')).toBe('3\'20"');
  });

  test('计数类带单位，且整数不补小数位', () => {
    expect(formatMetricValue(8.2, 'fiftyMeter')).toBe('8.2秒');
    // 曾经断言的是 '45.0个'，但计数类补 .0 既别扭、又和「多10个」的文案格式对不上
    expect(formatMetricValue(45, 'sitUp')).toBe('45个');
    expect(formatMetricValue(1.8, 'standingLongJump')).toBe('1.8米');
    expect(formatMetricValue(70, 'agility')).toBe('70分');
  });
});

// ==================== formatDeltaNumber / formatDeltaText ====================
describe('formatDeltaNumber', () => {
  test('去掉浮点噪声', () => {
    expect(formatDeltaNumber(0.2999999999999998)).toBe('0.3');
  });

  test('整数不带小数点', () => {
    expect(formatDeltaNumber(3)).toBe('3');
    expect(formatDeltaNumber(10)).toBe('10');
  });

  test('非有限值返回空字符串', () => {
    expect(formatDeltaNumber(Infinity)).toBe('');
  });
});

describe('formatDeltaText', () => {
  test('用时变短说「快」', () => {
    expect(formatDeltaText(0.3, getMetricMeta('fiftyMeter'))).toBe('已经快了0.3秒');
  });

  test('用时变长说「慢」', () => {
    expect(formatDeltaText(-0.2, getMetricMeta('fiftyMeter'))).toBe('慢了0.2秒');
  });

  test('计数变多说「多」', () => {
    expect(formatDeltaText(5, getMetricMeta('sitUp'))).toBe('已经多了5个');
  });

  test('评分类也用「多/少」，进步带「已经」、退步坦白不加', () => {
    expect(formatDeltaText(3, getMetricMeta('agility'))).toBe('已经多了3分');
    expect(formatDeltaText(-3, getMetricMeta('coordination'))).toBe('少了3分');
  });

  test('不足展示精度的小数差返回空，不出「快了0秒」', () => {
    expect(formatDeltaText(0.03, getMetricMeta('fiftyMeter'))).toBe('');
    expect(formatDeltaText(-0.04, getMetricMeta('fiftyMeter'))).toBe('');
    expect(formatDeltaText(0.06, getMetricMeta('fiftyMeter'))).toBe('已经快了0.1秒');
  });
});

// ==================== canViewChild ====================
describe('canViewChild', () => {
  const child = { _id: 'c1', name: '张小宝', coachId: 'coachA' };

  test('自己名下的学员放行', () => {
    expect(canViewChild(child, 'coachA')).toBe(true);
  });

  test('别人名下的学员拦下', () => {
    expect(canViewChild(child, 'coachB')).toBe(false);
  });

  test('学员没有 coachId（脏数据）不放行', () => {
    expect(canViewChild({ _id: 'c2' }, 'coachA')).toBe(false);
  });

  test('coachId 缺失一律拦下，不会因为「两边都是 undefined」而误放行', () => {
    expect(canViewChild(child, null)).toBe(false);
    expect(canViewChild(child, '')).toBe(false);
    expect(canViewChild(child, undefined)).toBe(false);
  });

  test('学员记录不存在时不抛错，返回 false', () => {
    expect(canViewChild(null, 'coachA')).toBe(false);
    expect(canViewChild(undefined, 'coachA')).toBe(false);
  });
});

// ==================== readTouchedField ====================
describe('readTouchedField', () => {
  test('没动过的字段即使有值也不返回（预填值不能当成本次成绩）', () => {
    const form = { fiftyMeter: '8.5' };   // loadPreviousData 预填的
    expect(readTouchedField(form, {}, 'fiftyMeter')).toBeNull();
    expect(readTouchedField(form, { sitUp: true }, 'fiftyMeter')).toBeNull();
  });

  test('动过且填了值就返回原值', () => {
    const form = { fiftyMeter: '8.5' };
    expect(readTouchedField(form, { fiftyMeter: true }, 'fiftyMeter')).toBe('8.5');
  });

  test('动过又清空 → null（不能把空字符串存进库）', () => {
    const form = { fiftyMeter: '' };
    expect(readTouchedField(form, { fiftyMeter: true }, 'fiftyMeter')).toBeNull();

    const blank = { fiftyMeter: '   ' };
    expect(readTouchedField(blank, { fiftyMeter: true }, 'fiftyMeter')).toBeNull();
  });

  test('数字 0 是合法成绩，不能被当成空值', () => {
    // 滑块拖到 0 分、引体向上 0 个都是真实成绩，用 falsy 判断会误吞
    expect(readTouchedField({ agility: 0 }, { agility: true }, 'agility')).toBe(0);
    expect(readTouchedField({ pullUp: 0 }, { pullUp: true }, 'pullUp')).toBe(0);
  });

  test('undefined / null 值 → null', () => {
    expect(readTouchedField({ fiftyMeter: undefined }, { fiftyMeter: true }, 'fiftyMeter')).toBeNull();
    expect(readTouchedField({ fiftyMeter: null }, { fiftyMeter: true }, 'fiftyMeter')).toBeNull();
  });

  test('form 或 touched 缺失时不抛错，一律 null', () => {
    expect(readTouchedField(null, { fiftyMeter: true }, 'fiftyMeter')).toBeNull();
    expect(readTouchedField({ fiftyMeter: '8.5' }, null, 'fiftyMeter')).toBeNull();
    expect(readTouchedField(undefined, undefined, 'fiftyMeter')).toBeNull();
  });
});

// ==================== pickProgressHighlight ====================
describe('pickProgressHighlight', () => {
  // 用例里的日期是写死的，而卡片要求「最新那条必须够新」，
  // 所以必须把「今天」也钉死——否则今天跑得过、下周就全红。
  // 下面所有 weekDate 都是相对 TODAY 标注的。
  const TODAY = '2026-09-15';
  const pick = (records) => pickProgressHighlight(records, { today: TODAY });

  test('无记录返回 null（调用方整卡隐藏）', () => {
    expect(pick([])).toBeNull();
    expect(pick(null)).toBeNull();
  });

  test('只有一条记录 → first 模式', () => {
    const result = pick([{ weekDate: '2026-09-14', fiftyMeter: 8.2 }]);  // 1 天前
    expect(result.mode).toBe('first');
    expect(result.metricName).toBe('50米');
    expect(result.currentText).toBe('8.2秒');
    expect(result.deltaText).toBe('');
    expect(result.isImprovement).toBeNull();
  });

  test('本周比上周快 → improved，且识别为「自上周」', () => {
    const result = pick([
      { weekDate: '2026-09-07', fiftyMeter: 8.5 },   // 8 天前
      { weekDate: '2026-09-14', fiftyMeter: 8.2 }    // 1 天前
    ]);
    expect(result.mode).toBe('improved');
    expect(result.previousText).toBe('8.5秒');
    expect(result.currentText).toBe('8.2秒');
    expect(result.deltaText).toBe('已经快了0.3秒');
    expect(result.comparisonText).toBe('自上周');
    expect(result.isImprovement).toBe(true);
  });

  test('输入顺序颠倒也能算对（内部会重排）', () => {
    const result = pick([
      { weekDate: '2026-09-14', fiftyMeter: 8.2 },
      { weekDate: '2026-09-07', fiftyMeter: 8.5 }
    ]);
    expect(result.mode).toBe('improved');
    expect(result.currentText).toBe('8.2秒');
    expect(result.previousText).toBe('8.5秒');
  });

  test('本周比上周慢 → changed，红色文案', () => {
    const result = pick([
      { weekDate: '2026-09-07', fiftyMeter: 8.5 },
      { weekDate: '2026-09-14', fiftyMeter: 8.7 }
    ]);
    expect(result.mode).toBe('changed');
    expect(result.deltaText).toBe('慢了0.2秒');
    expect(result.isImprovement).toBe(false);
  });

  test('间隔不是 7 天 → 不谎称「自上周」', () => {
    // calculateTrend 会把这个说成「上周」。
    // 注意 latest 那条是新的（1 天前）就不会被下面的新鲜度守卫拦掉，
    // 拦的是 previous 太旧——这里要测的正是「对比基准很旧」这个文案分支。
    const result = pick([
      { weekDate: '2026-08-24', fiftyMeter: 8.5 },   // 22 天前
      { weekDate: '2026-09-14', fiftyMeter: 8.2 }    // 1 天前
    ]);
    expect(result.comparisonText).toBe('自上次记录（2026年8月24日-8月30日）');
  });

  test('800米按秒计算进步，不是按分钟（R6）', () => {
    const result = pick([
      { weekDate: '2026-09-07', eightHundredMeter: '3分20秒' },
      { weekDate: '2026-09-14', eightHundredMeter: '3分10秒' }
    ]);
    expect(result.mode).toBe('improved');
    // 不乘 deltaScale 的话这里会是「快0.2秒」
    expect(result.deltaText).toBe('已经快了10秒');
  });

  test('横跨多个指标时，取相对进步最大的那个', () => {
    const result = pick([
      { weekDate: '2026-09-07', fiftyMeter: 8.5, sitUp: 40 },
      // 50米进步 3.5%，仰卧起坐进步 25% → 应选仰卧起坐
      { weekDate: '2026-09-14', fiftyMeter: 8.2, sitUp: 50 }
    ]);
    expect(result.metricKey).toBe('sitUp');
    expect(result.deltaText).toBe('已经多了10个');
  });

  test('相邻两周持平、但和更早一周比有进步 → 报更早基线（并写明对比段）', () => {
    const result = pick([
      { weekDate: '2026-08-31', fiftyMeter: 8.8 },   // 基线：半个月前
      { weekDate: '2026-09-07', fiftyMeter: 8.2 },   // 上周（已进步到位）
      { weekDate: '2026-09-14', fiftyMeter: 8.2 }    // 本周：和上周持平
    ]);
    expect(result.mode).toBe('improved');
    expect(result.deltaText).toBe('已经快了0.6秒');
    // 基线不是上周 → 不许谎称「自上周」
    expect(result.comparisonText).toBe('自上次记录（2026年8月31日-9月6日）');
    expect(result.isImprovement).toBe(true);
  });

  test('多个基线都有进步时，取相对变化最大的一次', () => {
    const result = pick([
      { weekDate: '2026-08-31', sitUp: 40 },
      { weekDate: '2026-09-07', fiftyMeter: 8.3 },                    // vs 本周：快0.1秒 ≈ 1.2%
      { weekDate: '2026-09-14', fiftyMeter: 8.2, sitUp: 44 }          // vs 8-31：仰卧起坐 +10%
    ]);
    expect(result.metricKey).toBe('sitUp');
    expect(result.deltaText).toBe('已经多了4个');
  });

  test('完全没有变化 → 返回 null，而不是「慢0秒」', () => {
    const result = pick([
      { weekDate: '2026-09-07', fiftyMeter: 8.5 },
      { weekDate: '2026-09-14', fiftyMeter: 8.5 }
    ]);
    expect(result).toBeNull();
  });

  test('记录条数够但没有任何共同指标 → 返回 null', () => {
    const result = pick([
      { weekDate: '2026-09-07', sitUp: 40 },
      { weekDate: '2026-09-14', ropeSkipping: 100 }
    ]);
    expect(result).toBeNull();
  });

  test('缺少 weekDate 的记录不参与', () => {
    const result = pick([{ fiftyMeter: 8.5 }]);
    expect(result).toBeNull();
  });

  test('只有一条且指标值全空 → 返回 null', () => {
    const result = pick([{ weekDate: '2026-09-14' }]);
    expect(result).toBeNull();
  });

  // ---- 新鲜度守卫：最新那条必须真的是「最近」 ----
  describe('最新记录太旧 → 整卡隐藏', () => {
    // 学员停训后，库里最新那条还是老早以前的，
    // 不拦掉就会把旧成绩顶着「最新进步」四个字报给家长
    test('最新一条是三个月前 → null', () => {
      expect(pick([
        { weekDate: '2026-06-15', fiftyMeter: 8.5 },
        { weekDate: '2026-06-22', fiftyMeter: 8.2 }
      ])).toBeNull();
    });

    test('最新一条是上上周（14 天前）→ null，刚好卡在边界外', () => {
      expect(pick([
        { weekDate: '2026-08-25', fiftyMeter: 8.5 },
        { weekDate: '2026-09-01', fiftyMeter: 8.2 }   // 14 天前
      ])).toBeNull();
    });

    test('最新一条是上周（13 天前）→ 仍然显示', () => {
      const result = pick([
        { weekDate: '2026-08-24', fiftyMeter: 8.5 },
        { weekDate: '2026-09-02', fiftyMeter: 8.2 }   // 13 天前
      ]);
      expect(result).not.toBeNull();
      expect(result.mode).toBe('improved');
    });

    test('只有一条且很旧 → null（首次记录同样受守卫约束）', () => {
      expect(pick([{ weekDate: '2026-06-15', fiftyMeter: 8.2 }])).toBeNull();
    });

    test('weekDate 无法解析 → null，不当作「刚录的」放行', () => {
      expect(pick([{ weekDate: '不是日期', fiftyMeter: 8.2 }])).toBeNull();
    });
  });
});

// ==================== summarizeAbilityGroups（成长页能力分组） ====================
describe('summarizeAbilityGroups', () => {
  const groupOf = (groups, key) => groups.find(g => g.key === key);
  const metricOf = (groups, groupKey, metricKey) => {
    const group = groupOf(groups, groupKey);
    return group && group.metrics.find(m => m.key === metricKey);
  };

  test('没有任何记录 → 空数组，调用方整块隐藏', () => {
    expect(summarizeAbilityGroups([])).toEqual([]);
    expect(summarizeAbilityGroups(null)).toEqual([]);
  });

  test('只有一条记录 → 有值但无从比较（isImprovement 为 null）', () => {
    const groups = summarizeAbilityGroups([
      { weekDate: '2026-09-14', fiftyMeter: 9.2, sitUp: 35 }
    ]);
    expect(groups.length).toBe(ABILITY_GROUPS.length);

    const fifty = metricOf(groups, 'speed', 'fiftyMeter');
    expect(fifty.hasData).toBe(true);
    expect(fifty.valueText).toBe('9.2秒');
    expect(fifty.deltaText).toBe('');
    expect(fifty.isImprovement).toBeNull();

    // 没测的指标照样占位，页面渲染成「未测」
    const jump = metricOf(groups, 'strength', 'standingLongJump');
    expect(jump.hasData).toBe(false);
    expect(jump.valueText).toBe('');
  });

  test('两条记录 → 逐指标方向感知的环比（跑步快=进步，个数多=进步）', () => {
    const groups = summarizeAbilityGroups([
      { weekDate: '2026-09-07', fiftyMeter: 9.5, sitUp: 40, ropeSkipping: 150 },
      { weekDate: '2026-09-14', fiftyMeter: 9.2, sitUp: 35, ropeSkipping: 165 }
    ]);

    const fifty = metricOf(groups, 'speed', 'fiftyMeter');
    expect(fifty.isImprovement).toBe(true);
    expect(fifty.deltaText).toBe('已经快了0.3秒');
    expect(fifty.previousText).toBe('9.5秒');

    const sitUp = metricOf(groups, 'strength', 'sitUp');
    expect(sitUp.isImprovement).toBe(false);
    expect(sitUp.deltaText).toBe('少了5个');

    const rope = metricOf(groups, 'agility', 'ropeSkipping');
    expect(rope.isImprovement).toBe(true);
    expect(rope.deltaText).toBe('已经多了15个');

    const speed = groupOf(groups, 'speed');
    expect(speed.improvedCount).toBe(1);
    expect(speed.measuredCount).toBe(1);
  });

  test('800 米的进步按 deltaScale 换算成秒，不是小数分钟', () => {
    const groups = summarizeAbilityGroups([
      { weekDate: '2026-09-07', eightHundredMeter: '3分20秒' },
      { weekDate: '2026-09-14', eightHundredMeter: '3分10秒' }
    ]);

    const item = metricOf(groups, 'endurance', 'eightHundredMeter');
    expect(item.isImprovement).toBe(true);
    expect(item.deltaText).toBe('已经快了10秒');
  });

  test('评分类指标（协调）也用「多/少」，不再用书面腔「提升」', () => {
    const groups = summarizeAbilityGroups([
      { weekDate: '2026-09-07', coordination: 75 },
      { weekDate: '2026-09-14', coordination: 78 }
    ]);

    const item = metricOf(groups, 'agility', 'coordination');
    expect(item.isImprovement).toBe(true);
    expect(item.deltaText).toBe('已经多了3分');
  });

  test('入参倒序（最新在前）也重排正确，不会把退步算成进步', () => {
    const groups = summarizeAbilityGroups([
      { weekDate: '2026-09-14', fiftyMeter: 9.2 },
      { weekDate: '2026-09-07', fiftyMeter: 9.5 }
    ]);

    const fifty = metricOf(groups, 'speed', 'fiftyMeter');
    expect(fifty.isImprovement).toBe(true);
    expect(fifty.deltaText).toBe('已经快了0.3秒');
  });

  test('历史数据的指标字段是数组 → 取第一个非空元素解析', () => {
    const groups = summarizeAbilityGroups([
      { weekDate: '2026-09-14', fiftyMeter: ['9.2秒'] }
    ]);

    const fifty = metricOf(groups, 'speed', 'fiftyMeter');
    expect(fifty.hasData).toBe(true);
    expect(fifty.valueText).toBe('9.2秒');
  });

  test('两次成绩一模一样 → 不渲染「慢0秒」这种胡话', () => {
    const groups = summarizeAbilityGroups([
      { weekDate: '2026-09-07', fiftyMeter: 9.5 },
      { weekDate: '2026-09-14', fiftyMeter: 9.5 }
    ]);

    const fifty = metricOf(groups, 'speed', 'fiftyMeter');
    expect(fifty.isImprovement).toBeNull();
    expect(fifty.deltaText).toBe('');
  });

  test('上次没测的指标 → 有最新值但没有 delta，不算退步', () => {
    const groups = summarizeAbilityGroups([
      { weekDate: '2026-09-07', fiftyMeter: 9.5 },
      { weekDate: '2026-09-14', fiftyMeter: 9.2, sitUp: 35 }
    ]);

    const sitUp = metricOf(groups, 'strength', 'sitUp');
    expect(sitUp.hasData).toBe(true);
    expect(sitUp.isImprovement).toBeNull();
    expect(sitUp.deltaText).toBe('');
  });
});

// ==================== pickItemProgress（训练项目组数/个数进步） ====================
describe('pickItemProgress', () => {
  const TODAY = '2026-09-21';
  const pick = (trainings, options) => pickItemProgress(trainings, Object.assign({ today: TODAY }, options));
  const lesson = (date, items) => ({ date, items });

  test('同名项目一个月内做得更多 → 挑出来（组数个数都涨）', () => {
    const result = pick([
      lesson('2026-08-25', [{ name: '深蹲', done: true, sets: '3', reps: '12' }]),
      lesson('2026-09-18', [{ name: '深蹲', done: true, sets: '4', reps: '15' }])
    ]);
    expect(result).not.toBeNull();
    expect(result.mode).toBe('item');
    expect(result.metricName).toBe('深蹲');
    expect(result.deltaText).toBe('从3组×12次练到4组×15次');
    expect(result.comparisonText).toBe('自8月25日');
    expect(result.isImprovement).toBe(true);
  });

  test('多个项目都进步 → 取相对提升最大的', () => {
    const result = pick([
      // 深蹲 3组×12次=36 → 4组×12次=48（+33%）；折返跑 10次 → 11次（+10%）
      lesson('2026-09-01', [
        { name: '深蹲', done: true, sets: '3', reps: '12' },
        { name: '折返跑', done: true, reps: '10' }
      ]),
      lesson('2026-09-18', [
        { name: '深蹲', done: true, sets: '4', reps: '12' },
        { name: '折返跑', done: true, reps: '11' }
      ])
    ]);
    expect(result.metricName).toBe('深蹲');
    expect(result.deltaText).toBe('从3组×12次练到4组×12次');
  });

  test('没勾完成的项目不算（计划量不等于做到）', () => {
    const result = pick([
      lesson('2026-09-01', [{ name: '深蹲', done: true, sets: '3', reps: '12' }]),
      lesson('2026-09-18', [{ name: '深蹲', done: false, sets: '4', reps: '15' }])
    ]);
    expect(result).toBeNull();
  });

  test('只填组数/只填个数 → 「从X练到Y」，数字前后一摆', () => {
    const setsOnly = pick([
      lesson('2026-09-01', [{ name: '平板支撑', done: true, sets: '3' }]),
      lesson('2026-09-18', [{ name: '平板支撑', done: true, sets: '4' }])
    ]);
    expect(setsOnly.deltaText).toBe('从3组练到4组');

    const repsOnly = pick([
      lesson('2026-09-01', [{ name: '跳绳', done: true, reps: '120' }]),
      lesson('2026-09-18', [{ name: '跳绳', done: true, reps: '135' }])
    ]);
    expect(repsOnly.deltaText).toBe('从120次练到135次');
  });

  test('组数涨、每组个数跌但总量涨 → 如实报总量（加起来…），不掩盖退步的那截', () => {
    const result = pick([
      lesson('2026-09-01', [{ name: '深蹲', done: true, sets: '3', reps: '12' }]),   // 36
      lesson('2026-09-18', [{ name: '深蹲', done: true, sets: '4', reps: '10' }])    // 40
    ]);
    expect(result.deltaText).toBe('加起来从36次练到40次');
  });

  test('数据形态不同没法比：一次只填组数、一次组数个数都填 → 跳过这组', () => {
    const result = pick([
      lesson('2026-09-01', [{ name: '深蹲', done: true, sets: '3' }]),
      lesson('2026-09-18', [{ name: '深蹲', done: true, sets: '3', reps: '12' }])
    ]);
    expect(result).toBeNull();
  });

  test('窗口外（一个月前）的课次不参与', () => {
    const result = pick([
      lesson('2026-08-10', [{ name: '深蹲', done: true, sets: '2', reps: '10' }]),   // 42 天前
      lesson('2026-09-18', [{ name: '深蹲', done: true, sets: '4', reps: '15' }])
    ]);
    expect(result).toBeNull();
  });

  test('项目只出现一次 / 没有同名项目 / 空输入 → null（调用方回落体测成绩）', () => {
    expect(pick([lesson('2026-09-18', [{ name: '深蹲', done: true, sets: '4', reps: '15' }])])).toBeNull();
    expect(pick([
      lesson('2026-09-01', [{ name: '深蹲', done: true, sets: '3', reps: '12' }]),
      lesson('2026-09-18', [{ name: '仰卧起坐', done: true, reps: '40' }])
    ])).toBeNull();
    expect(pick([])).toBeNull();
    expect(pick(null)).toBeNull();
  });

  test('组数/个数都没填的项目没法比，跳过', () => {
    const result = pick([
      lesson('2026-09-01', [{ name: '深蹲', done: true }]),
      lesson('2026-09-18', [{ name: '深蹲', done: true }])
    ]);
    expect(result).toBeNull();
  });

  test('项目名带首尾空格也算同名', () => {
    const result = pick([
      lesson('2026-09-01', [{ name: '深蹲 ', done: true, sets: '3', reps: '12' }]),
      lesson('2026-09-18', [{ name: '深蹲', done: true, sets: '4', reps: '12' }])
    ]);
    expect(result.metricName).toBe('深蹲');
    expect(result.deltaText).toBe('从3组×12次练到4组×12次');
  });

  test('中间冲高、最新回落 → 以最新为 current 扫全部基线，报对最早基线的进步', () => {
    const result = pick([
      lesson('2026-09-01', [{ name: '深蹲', done: true, sets: '3', reps: '12' }]),   // 36
      lesson('2026-09-10', [{ name: '深蹲', done: true, sets: '5', reps: '12' }]),   // 60（冲高）
      lesson('2026-09-18', [{ name: '深蹲', done: true, sets: '4', reps: '12' }])    // 48 ← 最新
    ]);
    // current 永远是最新一次；基线扫到 36 → +33%（冲高那次的 60 不许拿来当 current 夸大）
    expect(result.currentText).toBe('4组×12次');
    expect(result.deltaText).toBe('从3组×12次练到4组×12次');
  });

  // ---- 同一天多节课：先后必须确定（按 startTime），不能看查询返回顺序 ----
  test('同一天两节课：按 startTime 定先后，晚一次做得更多 → 算进步', () => {
    const result = pick([
      { date: '2026-09-21', startTime: '18:09', items: [{ name: '跳绳', done: true, sets: '10', reps: '500' }] },
      { date: '2026-09-21', startTime: '14:00', items: [{ name: '跳绳', done: true, sets: '8', reps: '400' }] }
    ]);
    expect(result).not.toBeNull();
    expect(result.currentText).toBe('10组×500次');
    expect(result.deltaText).toBe('从8组×400次练到10组×500次');
    expect(result.comparisonText).toBe('自9月21日');
  });

  test('同一天两节课：晚一次反而做得少 → 不把退步反过来报成进步', () => {
    const result = pick([
      { date: '2026-09-21', startTime: '14:00', items: [{ name: '跳绳', done: true, sets: '10', reps: '500' }] },
      { date: '2026-09-21', startTime: '18:09', items: [{ name: '跳绳', done: true, sets: '8', reps: '400' }] }
    ]);
    expect(result).toBeNull();
  });

  test('同一天两节课、量一模一样 → 没有进步，返回 null', () => {
    const result = pick([
      { date: '2026-09-21', startTime: '14:00', items: [{ name: '跳绳', done: true, sets: '10', reps: '500' }] },
      { date: '2026-09-21', startTime: '18:09', items: [{ name: '跳绳', done: true, sets: '10', reps: '500' }] }
    ]);
    expect(result).toBeNull();
  });

  // ---- 形态守卫双向（工作流确认缺陷：原守卫只挡组数方向，漏了只填个数的镜像） ----
  test('只填个数 → 组×次：形态不同，反向也要挡住不比', () => {
    const result = pick([
      { date: '2026-09-01', _id: 'a', items: [{ name: '跳绳', done: true, reps: '12' }] },
      { date: '2026-09-20', _id: 'b', items: [{ name: '跳绳', done: true, sets: '3', reps: '12' }] }
    ]);
    expect(result).toBeNull();
  });

  // ---- 同课次同名去重（工作流确认缺陷：课内两行差异冒充跨课进步） ----
  test('同一节课两行同名（3×12、4×12）→ 只有本课自己，不成进步', () => {
    const result = pick([
      { date: '2026-09-21', _id: 'a', items: [
        { name: '深蹲', done: true, sets: '3', reps: '12' },
        { name: '深蹲', done: true, sets: '4', reps: '12' }
      ] }
    ]);
    expect(result).toBeNull();
  });

  test('新课次录了两行同名（5×12、3×12）→ 取量大的一行，真进步不被压成 null', () => {
    const result = pick([
      { date: '2026-08-25', _id: 'a', items: [{ name: '深蹲', done: true, sets: '3', reps: '12' }] },
      { date: '2026-09-20', _id: 'b', items: [
        { name: '深蹲', done: true, sets: '5', reps: '12' },
        { name: '深蹲', done: true, sets: '3', reps: '12' }
      ] }
    ]);
    expect(result).not.toBeNull();
    expect(result.currentText).toBe('5组×12次');
    expect(result.deltaText).toBe('从3组×12次练到5组×12次');
    expect(result.comparisonText).toBe('自8月25日');
  });
});

// ==================== findActiveClassForChild（开课守卫） ====================
describe('findActiveClassForChild', () => {
  // 最小 db 桩：collection().where().get() 按注入数据 resolve/reject
  function dbWith(data, fail) {
    return {
      collection: () => ({
        where: () => ({
          get: () => (fail ? Promise.reject(new Error('db down')) : Promise.resolve({ data }))
        })
      })
    };
  }

  test('同学员有真的在上课中的另一节 → 返回冲突课次', async () => {
    const conflict = { _id: 't2', childId: 'c1', status: 'in_class' };
    const res = await findActiveClassForChild(dbWith([conflict]), 'c1', 't1');
    expect(res).toBe(conflict);
  });

  test('冲突课已盖下课戳 classEndedAt → 不算冲突', async () => {
    const res = await findActiveClassForChild(
      dbWith([{ _id: 't2', status: 'in_class', classEndedAt: new Date() }]),
      'c1',
      't1'
    );
    expect(res).toBeNull();
  });

  test('排除本次要开的那节课自身', async () => {
    const res = await findActiveClassForChild(
      dbWith([{ _id: 't1', status: 'in_class' }]),
      'c1',
      't1'
    );
    expect(res).toBeNull();
  });

  test('查询失败 fail-open：返回 null 放行开课', async () => {
    const res = await findActiveClassForChild(dbWith([], true), 'c1', 't1');
    expect(res).toBeNull();
  });

  test('childId 缺失直接放行（不发查询）', async () => {
    const res = await findActiveClassForChild(dbWith([{ _id: 't2' }]), '', 't1');
    expect(res).toBeNull();
  });
});
