/**
 * 成长报告构建器（纯函数，无 wx 依赖，可单测）
 *
 * 职责：把一个周期内的原始记录（trainings / performance / assessments /
 * hoursRecords）聚合成报告的「积木块」草稿。数据块系统算，观点块（点评/
 * 计划/家长行动/照片）只给教练留好空位——这是月报设计的核心分工：
 * 「数据系统算，评价教练写」，家长看到的数字可信、话是教练亲口说的。
 *
 * 报告骨架来自 2.0 蓝图的月报 6 段固定结构：
 *   本期完成 / 能力变化 / 精彩证据 / 教练点评 / 下阶段计划 / 家长行动
 * 月报季报共用这副骨架，只是周期长度不同；sections 是有序数组，
 * 块可以增删排序，以后加新块型（如季报的「续课建议」）不用改老数据。
 *
 * 约定：trainings / performances 由调用方按周期过滤好再传进来
 * （字符串日期 gte/lte 查询）；assessments / hoursRecords 的 createdAt
 * 是 Date 类型，由调用方按 startTs/endTs 过滤好。这里只做聚合和排版。
 */
const { buildPeriodAbilityRows } = require('./helper');

const QUARTER_CN = ['一', '二', '三', '四'];

/** 报告里的块类型（新增块型时在这里加注释即可，不用改结构） */
const SECTION_KINDS = {
  STATS: 'stats',       // 本期完成：节数/主题分布/消耗课时
  ABILITY: 'ability',   // 能力变化：期内期初期末对比 + 身高体重
  PHOTOS: 'photos',     // 精彩证据：教练挑的照片
  COMMENT: 'comment',   // 教练点评：文字 + 表现标签
  PLAN: 'plan',         // 下阶段计划：文字（可带入本阶段目标）
  ACTION: 'action'      // 家长行动：给家长的配合建议
};

/** 教练点评的表现标签（点选追加，不需要打字） */
const PRESET_TAGS = [
  '出勤稳定', '动作标准', '课堂专注', '力量提升明显', '速度进步快',
  '耐力变强', '态度积极', '团队协作好', '柔韧需加强', '体重需关注'
];

/** 家长行动的常用语：手机打字慢，点一条整段插入，可再改 */
const PRESET_PHRASES_ACTION = [
  '每周保证 2-3 次课后拉伸，每次 10 分钟',
  '保证充足睡眠，尽量晚上 21:30 前入睡',
  '饮食注意蛋白质摄入，控制零食和甜饮',
  '平时多鼓励，训练后让孩子讲讲今天学了什么',
  '在家可练习跳绳，每天 2 组，每组 1 分钟'
];

/** 下阶段计划的常用语 */
const PRESET_PHRASES_PLAN = [
  '继续保持出勤频率，巩固本期训练成果',
  '重点加强核心力量练习',
  '提高动作完成质量，减少代偿动作',
  '参加下一期体能测试，检验训练效果'
];

// ==================== 周期与范围 ====================

function pad(n) { return n < 10 ? '0' + n : '' + n; }

function dateStr(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }

/** 某月最后一天（new Date(y, m, 0) 的 day=0 会滚到上月末，闰年自动正确） */
function lastDayOfMonth(y, m) { return new Date(y, m, 0).getDate(); }

/**
 * 自然月范围。返回 start/end（'YYYY-MM-DD'，给字符串日期查询用）
 * 和 startTs/endTs（本地时区毫秒，给 Date 类型的 createdAt 过滤用）。
 */
function monthRange(year, month) {
  const lastDay = lastDayOfMonth(year, month);
  return {
    start: dateStr(year, month, 1),
    end: dateStr(year, month, lastDay),
    label: year + '年' + month + '月',
    startTs: new Date(year, month - 1, 1).getTime(),
    endTs: new Date(year, month - 1, lastDay, 23, 59, 59, 999).getTime()
  };
}

/** 季度范围：Q1=1-3月 / Q2=4-6 / Q3=7-9 / Q4=10-12 */
function quarterRange(year, quarter) {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const lastDay = lastDayOfMonth(year, endMonth);
  return {
    start: dateStr(year, startMonth, 1),
    end: dateStr(year, endMonth, lastDay),
    label: year + '年' + QUARTER_CN[quarter - 1] + '季度（' + startMonth + '-' + endMonth + '月）',
    startTs: new Date(year, startMonth - 1, 1).getTime(),
    endTs: new Date(year, endMonth - 1, lastDay, 23, 59, 59, 999).getTime()
  };
}

/** 月度选择项：从 now 所在月往前数 count 个（含当前月），新的在前 */
function buildMonthOptions(now, count) {
  const total = count || 12;
  const options = [];
  for (let i = 0; i < total; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({ label: d.getFullYear() + '年' + (d.getMonth() + 1) + '月', year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  return options;
}

/** 季度选择项：从 now 所在季往前数 count 个（含当前季），新的在前 */
function buildQuarterOptions(now, count) {
  const total = count || 6;
  const options = [];
  const base = new Date(now.getFullYear(), now.getMonth(), 1);
  for (let i = 0; i < total; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() - i * 3, 1);
    const quarter = Math.floor(d.getMonth() / 3) + 1;
    options.push({ label: d.getFullYear() + '年' + QUARTER_CN[quarter - 1] + '季度', year: d.getFullYear(), quarter: quarter });
  }
  return options;
}

function reportTypeLabel(type) { return type === 'quarterly' ? '季报' : '月报'; }

// ==================== 自动数据块 ====================

/**
 * 本期完成：节数 / 训练主题分布 / 消耗课时。
 * trainings 已按周期过滤；finished = 家长感知的「实际上过的课」，
 * 未结课的（pending/in_class）不计入节数，只在 plannedCount 里留个数。
 */
function buildStatsData(trainings, hoursRecords) {
  const list = trainings || [];
  const finished = list.filter(function (t) { return t && t.status === 'finished'; });

  const typeMap = {};
  finished.forEach(function (t) {
    const key = t.type || '常规训练';
    typeMap[key] = (typeMap[key] || 0) + 1;
  });
  const typeCounts = Object.keys(typeMap).map(function (key) {
    return { type: key, count: typeMap[key] };
  }).sort(function (a, b) { return b.count - a.count; });

  const hoursUsed = (hoursRecords || []).reduce(function (sum, r) {
    return (r && r.type === 'expense') ? sum + (Number(r.amount) || 0) : sum;
  }, 0);

  return {
    finishedCount: finished.length,
    plannedCount: list.length,
    typeCounts: typeCounts,
    hoursUsed: hoursUsed
  };
}

function toTs(record) {
  if (!record || !record.createdAt) return 0;
  const t = new Date(record.createdAt).getTime();
  return isNaN(t) ? 0 : t;
}

/**
 * 体态变化：期内第一次 vs 最近一次体质测评的身高/体重。
 * 只在两个值都读得到且确实变化时出一行——没变化/只有一次测评时不占版面。
 */
function buildBodyRows(assessments) {
  const list = (assessments || []).filter(function (a) {
    return a && a.basicInfo && (a.basicInfo.height || a.basicInfo.weight);
  });
  if (list.length < 2) return [];

  const sorted = list.slice().sort(function (a, b) { return toTs(a) - toTs(b); });
  const first = sorted[0].basicInfo;
  const last = sorted[sorted.length - 1].basicInfo;
  const rows = [];

  [{ key: 'height', label: '身高', unit: 'cm' }, { key: 'weight', label: '体重', unit: 'kg' }].forEach(function (item) {
    const firstVal = parseFloat(first[item.key]);
    const lastVal = parseFloat(last[item.key]);
    // 测评端存的是 parseFloat||0（身高体重可以不填），0 是「没量」不是「0cm」，
    // 不挡住会出版面「+131cm」这类荒谬数字
    if (!firstVal || !lastVal) return;
    const delta = Math.round((lastVal - firstVal) * 10) / 10;
    if (delta === 0) return;
    rows.push({
      key: item.key,
      label: item.label,
      valueText: lastVal + item.unit,
      deltaText: (delta > 0 ? '+' : '') + delta + item.unit,
      improved: delta > 0   // 孩子在生长期，长个长重都按正向呈现
    });
  });

  return rows;
}

// ==================== 草稿组装 ====================

/**
 * 组装报告草稿的 6 个积木块。数据块（stats/ability）预填好，
 * 观点块（photos/comment/plan/action）只留结构，等教练填。
 *
 * @param {Object} params { period, trainings, performances, assessments, hoursRecords, goal }
 *   period: monthRange/quarterRange 的返回值；goal: children.goal（注入下阶段计划块供一键带入）
 * @returns {Array} sections 有序数组
 */
function buildDraftSections(params) {
  params = params || {};
  const stats = buildStatsData(params.trainings, params.hoursRecords);
  const abilityRows = buildPeriodAbilityRows(params.performances);
  const bodyRows = buildBodyRows(params.assessments);
  const goal = (params.goal && String(params.goal).trim()) || '';

  return [
    {
      kind: SECTION_KINDS.STATS,
      title: '本期完成',
      source: 'auto',
      data: stats,
      empty: stats.finishedCount === 0 && stats.hoursUsed === 0
    },
    {
      kind: SECTION_KINDS.ABILITY,
      title: '能力变化',
      source: 'auto',
      data: { rows: abilityRows, bodyRows: bodyRows },
      empty: abilityRows.length === 0 && bodyRows.length === 0
    },
    { kind: SECTION_KINDS.PHOTOS, title: '精彩证据', source: 'coach', fileIDs: [], videos: [] },
    { kind: SECTION_KINDS.COMMENT, title: '教练点评', source: 'coach', content: '', tags: [] },
    // plan/action 的 tags 恒为空数组：渲染端的空态守卫按 tags 统一判断，缺了字段会判不出
    { kind: SECTION_KINDS.PLAN, title: '下阶段计划', source: 'coach', content: '', tags: [], goal: goal },
    { kind: SECTION_KINDS.ACTION, title: '家长行动', source: 'coach', content: '', tags: [] }
  ];
}

/**
 * 换周期重新生成时用：新草稿替换 auto 块，保留教练已写内容
 * （photos/comment/plan/action），不然改个月份点评就白写了。
 */
function mergeDraftSections(newSections, oldSections) {
  const COACH_KINDS = [SECTION_KINDS.PHOTOS, SECTION_KINDS.COMMENT, SECTION_KINDS.PLAN, SECTION_KINDS.ACTION];
  const oldByKind = {};
  (oldSections || []).forEach(function (s) { oldByKind[s.kind] = s; });
  return (newSections || []).map(function (s) {
    return (COACH_KINDS.indexOf(s.kind) !== -1 && oldByKind[s.kind]) ? oldByKind[s.kind] : s;
  });
}

/**
 * 家长端成品视图：空的教练块（photos/comment/plan/action）整段不渲染。
 * 「待补充 / 还没挑选照片或视频」是编辑器语境的占位话术，出现在家长海报上
 * 会被读成「教练没写完」。自动块（stats/ability）与未知块保留——
 * 「本周期暂无上课/测评记录」是数据系统的事实陈述，不是没写完。
 */
function buildVisibleSections(sections) {
  return (sections || []).filter(function (s) {
    if (!s || s.source !== 'coach') return true;
    if (s.kind === SECTION_KINDS.PHOTOS) {
      return !!(s.fileIDs && s.fileIDs.length) || !!(s.videos && s.videos.length);
    }
    return !!s.content || !!(s.tags && s.tags.length);
  });
}

module.exports = {
  SECTION_KINDS,
  PRESET_TAGS,
  PRESET_PHRASES_ACTION,
  PRESET_PHRASES_PLAN,
  monthRange,
  quarterRange,
  buildMonthOptions,
  buildQuarterOptions,
  buildStatsData,
  buildBodyRows,
  buildDraftSections,
  mergeDraftSections,
  buildVisibleSections,
  reportTypeLabel
};
