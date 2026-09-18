// 云函数 generateMonthlyReport
// 职责：把「月度最好成绩」的派生计算从家长端页面搬到服务端。
// 触发：教练端保存周测评后调用（见 pages/coach/performance/weekly/index.js 的 onSubmit 成功回调）。
// 产物：monthly_performance 集合（字段与原先客户端写入的完全一致）。

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const PAGE_SIZE = 100;

/* ------------------------------------------------------------------ *
 * 时间 / 日期辅助函数
 * 与 miniprogram/pages/users/children/index.js 中的同名实现保持一致。
 * 云函数无法 import 小程序页面方法，故内联复制一份。
 * ------------------------------------------------------------------ */

// 解析时间字符串为秒。兼容 "3分20秒" 与 "3:20" 两种写法。
// 无法解析时返回 Infinity，使该值不会在 Math.min 中被误选为最优。
function parseTime(str) {
  if (typeof str === 'number') return str;
  if (!str || typeof str !== 'string') return Infinity;

  if (str.includes('分')) {
    const parts = str.replace('秒', '').split('分');
    return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
  }

  if (str.includes(':')) {
    const parts = str.split(':');
    return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
  }

  const value = parseFloat(str);
  return Number.isFinite(value) ? value : Infinity;
}

// 秒数 → "X分Y秒"
function formatSeconds(seconds) {
  if (!seconds && seconds !== 0) return '0分0秒';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}秒`;
  if (secs === 0) return `${mins}分`;
  return `${mins}分${secs}秒`;
}

// Date → "YYYY-MM-DD"
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

// 某月的第一个周一
function getFirstMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? 6 : day - 1);
  d.setDate(d.getDate() - diff);
  return d;
}

// 某月的最后一个周一
function getLastMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? 0 : 7 - day);
  d.setDate(d.getDate() + diff);
  if (d.getMonth() !== date.getMonth()) {
    d.setDate(d.getDate() - 7);
  }
  return d;
}

/* ------------------------------------------------------------------ *
 * 派生计算
 * ------------------------------------------------------------------ */

// 沿用原客户端的真值判断：值为 0 / '' / null / undefined 时视为「没有数据」。
// 即 0 分被排除在择优之外——这是原实现的行为，此处刻意保持不变。
function isPresent(value) {
  return value !== undefined && value !== null && value !== '' && value !== 0;
}

// 从一批周记录中挑出某项的最好成绩。
// mode = 'time'   时间类，越小越好（50米/1000米/800米）
// mode = 'number' 数量类，越大越好（跳绳/仰卧起坐/…）
function pickBest(performances, field, mode) {
  const values = performances
    .filter(p => isPresent(p[field]))
    .map(p => (mode === 'time' ? parseTime(p[field]) : parseFloat(p[field])))
    .filter(Number.isFinite);

  if (values.length === 0) return null;
  return mode === 'time' ? Math.min(...values) : Math.max(...values);
}

// 重算某个孩子某个月的最好成绩，并 upsert 进 monthly_performance
async function computeMonth(childId, year, month) {
  const firstDayOfMonth = new Date(year, month - 1, 1);
  const lastDayOfMonth = new Date(year, month - 1, getDaysInMonth(year, month));

  const monthStart = formatDate(getFirstMonday(firstDayOfMonth));
  const monthEnd = formatDate(getLastMonday(lastDayOfMonth));

  const res = await db.collection('performance').where({
    childId: childId,
    weekDate: _.gte(monthStart).and(_.lte(monthEnd))
  }).limit(PAGE_SIZE).get();

  const performances = res.data;

  if (performances.length === 0) {
    return { year, month, skipped: 'no_data' };
  }

  // 1000米 / 800米 必须存成 "X分Y秒" 字符串：
  // pages/users/growth/index.js 的 parseValue 靠 value.includes('分') 分支解析。
  const thousandSeconds = pickBest(performances, 'thousandMeter', 'time');
  const eightHundredSeconds = pickBest(performances, 'eightHundredMeter', 'time');

  const monthlyData = {
    childId: childId,
    year: year,
    month: month,
    fiftyMeter: pickBest(performances, 'fiftyMeter', 'time'),
    thousandMeter: thousandSeconds === null ? null : formatSeconds(thousandSeconds),
    eightHundredMeter: eightHundredSeconds === null ? null : formatSeconds(eightHundredSeconds),
    sitUp: pickBest(performances, 'sitUp', 'number'),
    ropeSkipping: pickBest(performances, 'ropeSkipping', 'number'),
    sitAndReach: pickBest(performances, 'sitAndReach', 'number'),
    standingLongJump: pickBest(performances, 'standingLongJump', 'number'),
    vitalCapacity: pickBest(performances, 'vitalCapacity', 'number'),
    coordination: pickBest(performances, 'coordination', 'number'),
    agility: pickBest(performances, 'agility', 'number'),
    weekCount: performances.length,
    updatedAt: new Date()
  };

  const existing = await db.collection('monthly_performance').where({
    childId: childId,
    year: year,
    month: month
  }).get();

  if (existing.data.length > 0) {
    await db.collection('monthly_performance').doc(existing.data[0]._id).update({
      data: monthlyData
    });
    return { year, month, action: 'updated', weekCount: performances.length };
  }

  monthlyData.createdAt = new Date();
  await db.collection('monthly_performance').add({ data: monthlyData });
  return { year, month, action: 'added', weekCount: performances.length };
}

// 由 weekStart（周一，YYYY-MM-DD）推出需要重算的月份。
// 若该周跨月（例如 9/29 - 10/5），两个月都要重算。
function monthsFromWeek(weekStart) {
  const parts = String(weekStart).split('-').map(Number);
  if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) {
    return [];
  }

  // 用本地时区逐段构造，避免 new Date('2026-09-14') 按 UTC 解析导致的跨时区日期偏移
  const monday = new Date(parts[0], parts[1] - 1, parts[2]);
  const sunday = new Date(parts[0], parts[1] - 1, parts[2] + 6);

  const targets = [{ year: monday.getFullYear(), month: monday.getMonth() + 1 }];
  if (sunday.getFullYear() !== monday.getFullYear() || sunday.getMonth() !== monday.getMonth()) {
    targets.push({ year: sunday.getFullYear(), month: sunday.getMonth() + 1 });
  }
  return targets;
}

// 全量回填：遍历所有孩子，重算最近 N 个月。
// children 集合必须分页——云函数单次 get 上限 100 条。
async function backfill(months) {
  const updated = [];
  const failed = [];
  const count = Math.max(1, Math.min(Number(months) || 3, 24));

  let offset = 0;
  while (true) {
    const batch = await db.collection('children').skip(offset).limit(PAGE_SIZE).get();
    if (batch.data.length === 0) break;

    for (const child of batch.data) {
      for (let i = 0; i < count; i++) {
        const d = new Date();
        d.setDate(1);                       // 先归到 1 号，避免 31 号回退月份时溢出到下个月
        d.setMonth(d.getMonth() - i);
        const year = d.getFullYear();
        const month = d.getMonth() + 1;

        try {
          const result = await computeMonth(child._id, year, month);
          updated.push(Object.assign({ childId: child._id }, result));
        } catch (err) {
          console.error('回填失败', child._id, year, month, err);
          failed.push({ childId: child._id, year, month, error: String(err) });
        }
      }
    }

    if (batch.data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return { success: true, updated, failed };
}

/* ------------------------------------------------------------------ *
 * 入口
 *
 * 模式 1 —— 教练保存后触发：{ childId, weekStart: '2026-09-14' }
 * 模式 2 —— 指定月重算：    { childId, year: 2026, month: 9 }
 * 模式 3 —— 全量回填：      { backfill: true, months: 3 }
 * ------------------------------------------------------------------ */
exports.main = async (event = {}) => {
  try {
    if (event.backfill) {
      return await backfill(event.months);
    }

    const childId = event.childId;
    if (!childId) {
      return { success: false, error: '缺少 childId' };
    }

    if (event.weekStart) {
      const targets = monthsFromWeek(event.weekStart);
      if (targets.length === 0) {
        return { success: false, error: `weekStart 格式无法解析: ${event.weekStart}` };
      }

      const updated = [];
      for (const t of targets) {
        updated.push(await computeMonth(childId, t.year, t.month));
      }
      return { success: true, updated };
    }

    if (event.year && event.month) {
      const result = await computeMonth(childId, Number(event.year), Number(event.month));
      return { success: true, updated: [result] };
    }

    return { success: false, error: '缺少参数：需要 weekStart，或 year + month' };
  } catch (err) {
    console.error('generateMonthlyReport 执行失败', err);
    return { success: false, error: String(err) };
  }
};
