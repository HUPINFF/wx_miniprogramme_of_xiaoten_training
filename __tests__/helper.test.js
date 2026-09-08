const {
  formatTime,
  parsePerformanceValue,
  formatPerformanceValue,
  getSportName,
  classifyAppointments
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
