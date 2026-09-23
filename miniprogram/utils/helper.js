/**
 * 工具函数集合
 * 从各页面提取的纯函数，不依赖小程序环境，方便测试
 */

/**
 * 格式化日期为 YYYY-MM-DD
 * @param {Date|string} date
 * @returns {string}
 */
function formatTime(date) {
  if (!date) return '';
  try {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (error) {
    return '';
  }
}

/**
 * 解析运动成绩原始值为可计算的数值
 * @param {*} value - 原始值（数字或字符串，如 "3分20秒"）
 * @param {string} sportKey - 运动项目标识
 * @returns {number|null}
 */
function parsePerformanceValue(value, sportKey) {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    if (sportKey === 'standingLongJump') {
      return value / 100;
    }
    return value;
  }

  if (typeof value === 'string') {
    // 800米： "3分20秒" → 3 + 20/60 = 3.33
    if (sportKey === 'eightHundredMeter' && value.includes('分')) {
      const parts = value.split('分');
      const minutes = parseFloat(parts[0]) || 0;
      let seconds = 0;
      if (parts[1]) {
        const secMatch = parts[1].match(/(\d+)/);
        seconds = secMatch ? parseFloat(secMatch[1]) : 0;
      }
      return minutes + seconds / 60;
    }

    // 1000米： "5分10秒" → 5*60 + 10 = 310
    if (sportKey === 'thousandMeter' && value.includes('分')) {
      const parts = value.split('分');
      const minutes = parseFloat(parts[0]) || 0;
      let seconds = 0;
      if (parts[1]) {
        const secMatch = parts[1].match(/(\d+)/);
        seconds = secMatch ? parseFloat(secMatch[1]) : 0;
      }
      return minutes * 60 + seconds;
    }

    // 通用：提取字符串中的数字
    const match = value.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const numValue = parseFloat(match[0]);
      if (sportKey === 'standingLongJump') {
        return numValue / 100;
      }
      return numValue;
    }
    return null;
  }

  return null;
}

/**
 * 格式化运动成绩为显示字符串
 * @param {number} value
 * @param {string} sportKey
 * @param {Array} sportItems - 运动项目配置列表
 * @returns {string}
 */
function formatPerformanceValue(value, sportKey, sportItems) {
  if (value === null || value === undefined) return '';

  if (sportKey === 'eightHundredMeter') {
    const minutes = Math.floor(value);
    const seconds = Math.round((value - minutes) * 60);
    return minutes + "'" + seconds + '"';
  }

  if (sportKey === 'thousandMeter') {
    const minutes = Math.floor(value / 60);
    const seconds = Math.round(value % 60);
    return minutes + "'" + seconds + '"';
  }

  const sport = (sportItems || []).find(function (item) { return item.key === sportKey; });
  // 整数不带小数位：计数类（仰卧起坐 45 个、跳绳 120 个）写「45.0个」既别扭，
  // 又和进步文案「多10个」的格式对不上。非整数才保留一位（50米 8.5 秒）。
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return text + (sport ? sport.unit : '');
}

/**
 * 获取运动项目的显示名称
 * @param {string} sportKey
 * @param {Array} sportItems
 * @returns {string}
 */
function getSportName(sportKey, sportItems) {
  const sport = (sportItems || []).find(function (item) { return item.key === sportKey; });
  return sport ? sport.name : '';
}

/**
 * 按状态分类预约列表
 * @param {Array} appointments
 * @returns {{ pending: Array, approved: Array, rejected: Array, completed: Array }}
 */
function classifyAppointments(appointments) {
  const result = {
    pending: [],
    approved: [],
    rejected: [],
    completed: []
  };

  (appointments || []).forEach(function (item) {
    switch (item.status) {
      case 'pending':
        result.pending.push(item);
        break;
      case 'approved':
        result.approved.push(item);
        break;
      case 'rejected':
        result.rejected.push(item);
        break;
      case 'completed':
        result.completed.push(item);
        break;
    }
  });

  return result;
}

// ==================== 本地日期工具 ====================

/**
 * 把各种输入统一成本地时区的 Date
 *
 * ⚠️ 不能直接 new Date('2026-01-01')：按 ECMAScript 规范，纯日期字符串被当作
 * **UTC 午夜**解析。东八区（UTC+8）刚好不会出事，但一旦时区为负，取 getFullYear()
 * 会退回上一年。所以这里手工拆解成「本地时间」再构造。
 *
 * @param {Date|string|number} input
 * @returns {Date|null} 无法解析时返回 null
 */
function toLocalDate(input) {
  if (input === null || input === undefined || input === '') return null;
  if (input instanceof Date) return new Date(input.getTime());
  if (typeof input === 'number') return new Date(input);

  if (typeof input === 'string') {
    const matched = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (matched) {
      return new Date(
        parseInt(matched[1], 10),
        parseInt(matched[2], 10) - 1,
        parseInt(matched[3], 10)
      );
    }
    const fallback = new Date(input);
    return isNaN(fallback.getTime()) ? null : fallback;
  }

  return null;
}

/**
 * 两个日期相差多少天（按自然日算，不受时分秒/夏令时影响）
 * @returns {number|null} 无法解析时返回 null；正数表示 to 在 from 之后
 */
function diffInDays(from, to) {
  const a = toLocalDate(from);
  const b = toLocalDate(to);
  if (!a || !b || isNaN(a.getTime()) || isNaN(b.getTime())) return null;

  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / 86400000);
}

/**
 * 今天的 'YYYY-MM-DD'
 * @param {Date|string} [input] 不传则取当前时间（便于测试注入）
 */
function getTodayString(input) {
  const date = toLocalDate(input === undefined || input === null ? new Date() : input);
  if (!date || isNaN(date.getTime())) return '';
  return formatTime(date);
}

/**
 * 取某一天所在自然周的周一 ~ 周日
 *
 * ⚠️ 跨年必须成立：2026-01-01（周四）所在的周一落在 2025-12-29。
 * 所以 start/end **各自**取自己的 getFullYear()，不能拿基准日的年份给两端都拼上
 * —— pages/users/children/index.js:224-231 的 getCurrentWeekRange() 就是这么写的，
 * 会把 2025-12-29 拼成 2026-12-29（一个未来日期），本周课程数静默算成 0。
 *
 * @param {Date|string} [input] 不传则取当前时间
 * @returns {{start:string,end:string,startDate:Date,endDate:Date}|null}
 */
function getWeekRange(input) {
  const base = toLocalDate(input === undefined || input === null ? new Date() : input);
  if (!base || isNaN(base.getTime())) return null;

  const monday = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const dayOfWeek = monday.getDay() || 7; // 周日 getDay() === 0，按 ISO 记作 7
  monday.setDate(monday.getDate() - dayOfWeek + 1);

  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);

  return {
    start: formatTime(monday),
    end: formatTime(sunday),
    startDate: monday,
    endDate: sunday
  };
}

/**
 * 周区间文案。同年省略后面的年份，跨年两端都带年份。
 *   '2026-09-14', '2026-09-20' → '2026年9月14日-9月20日'
 *   '2025-12-29', '2026-01-04' → '2025年12月29日-2026年1月4日'
 */
function formatWeekRangeText(start, end) {
  const s = toLocalDate(start);
  const e = toLocalDate(end);
  if (!s || !e || isNaN(s.getTime()) || isNaN(e.getTime())) return '';

  const sameYear = s.getFullYear() === e.getFullYear();
  const head = s.getFullYear() + '年' + (s.getMonth() + 1) + '月' + s.getDate() + '日';
  const tail = (sameYear ? '' : e.getFullYear() + '年') + (e.getMonth() + 1) + '月' + e.getDate() + '日';

  return head + '-' + tail;
}

/**
 * 'YYYY-MM' → '2026年9月'
 *
 * 与 pages/users/growth/index.js:451-459 的差别：那边直接拼 parts[1]，
 * 会把 '2026-09' 渲染成「2026年09月」。这里去掉前导零。
 * 入参不是 'YYYY-MM' 时原样返回，调用方不必再判断。
 */
function formatMonthLabel(yearMonth) {
  if (!yearMonth) return '';
  const matched = String(yearMonth).match(/^(\d{4})-(\d{1,2})$/);
  if (!matched) return String(yearMonth);
  return matched[1] + '年' + parseInt(matched[2], 10) + '月';
}

// ==================== 训练状态 ====================

/**
 * 训练记录状态 → 文案。
 *
 * ⚠️ 与 pages/coach/schedule/index.js:97-104 那套（上课/上课中/已下课）**故意不同**。
 * 那边面向教练，是排课视角；这边面向家长，用「待上课/已排课」更贴近家长的语言。
 * 差异是有意的，不要来「统一」它。
 *
 * 未知/空状态一律回落到「待上课」——对家长而言，没拿到状态就当作还没上，比显示空白安全。
 */
const TRAINING_STATUS_META = {
  pending: { text: '待上课', type: 'pending' },
  scheduled: { text: '已排课', type: 'scheduled' },
  in_class: { text: '上课中', type: 'in_class' },
  finished: { text: '已完成', type: 'finished' }
};
const DEFAULT_TRAINING_STATUS = 'pending';

function getTrainingStatusMeta(status) {
  const key = (status === null || status === undefined || status === '')
    ? DEFAULT_TRAINING_STATUS
    : String(status);
  const resolvedKey = TRAINING_STATUS_META[key] ? key : DEFAULT_TRAINING_STATUS;
  const meta = TRAINING_STATUS_META[resolvedKey];

  return { key: resolvedKey, text: meta.text, type: meta.type };
}

/**
 * 在一条训练的多个字段里挑出「当前情况」要展示的那一节
 *
 * 家长端首页的卡片要回答「孩子现在在干嘛」，判定规则：
 *   1. 有 status === 'in_class' 的 → 「正在上课」（教练在 in-class 页点了开始上课才会置位）
 *      多条时取开始得最晚的那节（理由见下面的 inClass 分支）
 *   2. 否则取最近一节还没上的 → 「下节课」
 *   3. 都没有 → 'none'，调用方整卡隐藏
 *
 * ⚠️ 两个分支都只按**日期**筛（见 isDatePast）：今天的留着，昨天的丢掉。
 *    不看时刻——教练拖堂、临时调课、早上那节拖到晚上才点下课，都还是「今天这节课」，
 *    按 endTime 推断结束没结束只会误杀还在上的课。
 *
 * ⚠️ 「正在上课」也不按 startTime/endTime 反推「此刻是否在上课」，只认 status。
 *    早到了、拖堂了、临时调课，以教练点的为准，不会算错。
 *
 * ⚠️ date('YYYY-MM-DD') 与 startTime('HH:mm') 都是定长字符串，字典序即时间序，
 *    所以排序直接比字符串，不需要解析成 Date（也就没有时区问题）。
 *    缺 startTime 的记录排在当天最前，属可接受误差。
 *
 * ⚠️ 日期一律过一遍 getTodayString 归一化再比，理由见 isDatePast。
 *
 * @param {Array} trainings - 某学员的 trainings 记录（顺序无所谓，本函数自己排）
 * @param {{today?: string|Date}} [options] - today 仅供测试注入，不传取当前时间
 * @returns {{mode: 'in_class'|'upcoming'|'none', training: Object|null}}
 */
function pickCurrentTraining(trainings, options) {
  const list = (trainings || []).filter(function (record) {
    return record && record.date;
  });
  if (!list.length) return { mode: 'none', training: null };

  // 复合排序键：先日期后时间。两段都是定长，拼起来比一次即可。
  function sortKey(record) {
    return getTodayString(record.date) + ' ' + String(record.startTime || '');
  }

  const today = getTodayString((options && options.today) || new Date());

  // 昨天及更早的 in_class 不再展示（教练点了开始上课就没再管的那种），今天的照常显示
  const inClass = list.filter(function (record) {
    return getTrainingStatusMeta(record.status).key === 'in_class'
      && !isDatePast(record, today);
  });
  if (inClass.length) {
    // 多条同时挂着 in_class 时取**最晚开始**的那节。
    //
    // ⚠️ 不能取最早。in_class 是教练点「开始上课」才置位的，忘了点「下课」就一直挂着，
    //    所以挂得越久越可能是没关掉的僵尸记录。同一个孩子今天 09:00 那节忘关、
    //    18:30 这节正在上，取最早会显示「已进行 9 小时」——正是这一节该显示的时候显示错。
    //    最新开始的那节，才最可能就是此刻真的在上课的那节。
    return {
      mode: 'in_class',
      training: inClass.reduce(function (latest, record) {
        return sortKey(record) > sortKey(latest) ? record : latest;
      })
    };
  }

  const upcoming = list.filter(function (record) {
    const key = getTrainingStatusMeta(record.status).key;
    if (key !== 'pending' && key !== 'scheduled') return false;
    // 今天或未来
    return !isDatePast(record, today);
  });
  if (upcoming.length) {
    return {
      mode: 'upcoming',
      training: upcoming.reduce(function (soonest, record) {
        return sortKey(record) < sortKey(soonest) ? record : soonest;
      })
    };
  }

  return { mode: 'none', training: null };
}

// ==================== 这节课的日期过去了没有 ====================

/**
 * 这一节的日期是不是已经过去了
 *
 * 家长端首页只展示「今天或将来」的课：**今天的一律留着，到了明天自动消失**。
 *
 * ⚠️ 刻意只看日期，不看时刻。
 *    一节课在当天该不该继续出现在首页，跟它几点开始、几点结束无关：
 *    教练拖堂、临时加练、早上的课拖到晚上才点下课，都还是「今天这节课」。
 *    真要按时刻推断结束没结束，就得引入「endTime + 宽限期」那套，
 *    而一旦教练没填 endTime（或填的时间比实际短），一节还在上的课就会被藏掉——
 *    家长漏看一节课的代价，远大于多看一张已经上完的卡片。所以不推断。
 *
 * ⚠️ 日期一律过 getTodayString 归一化再比，不要直接 String(record.date)：
 *    date 万一是 Date 类型的历史数据，String() 会得到 "Mon Sep 14 2026 ..."，
 *    字典序比任何 'YYYY-MM-DD' 都大 —— 昨天的课会被判成未来的，静默放行。
 *
 * @param {object} record - trainings 记录
 * @param {string} today - 'YYYY-MM-DD'
 * @returns {boolean}
 */
function isDatePast(record, today) {
  const date = getTodayString((record || {}).date);
  if (!date) return true;   // 连日期都读不出来的记录不该展示
  return date < today;
}

// ==================== 同一学员不能同时上两节课 ====================

/**
 * 查这个学员名下是否还有别的课「真的在上课中」——开课前的守卫。
 *
 * 业务规则：一个学员同一时刻只能在一节课里，不能给正上课的学员再开一节课
 * （给不同学员开课不受影响）。判定口径与工作台「正在上课」卡一致：
 *   - status === 'in_class' 且没盖下课戳 classEndedAt 才算「真的在上课」。
 *     下课瞬间写 classEndedAt，status 要等课后记录「完成记录」才变 finished，
 *     中间的窗口期不算在上课（此时给该学员开下一节是允许的）。
 *   - 不限日期：昨天没完成记录挂着的 in_class 也算冲突，避免跨天开出第二节。
 *
 * 查询失败 fail-open（返回 null 放行）：把课开不起来比极小概率的双开更耽误事，
 * 与归一链路「AI 失败不拦保存」同一取舍。
 *
 * @param {object} db - wx.cloud.database()
 * @param {string} childId - 要开课的学员
 * @param {string} [excludeId] - 本次要开的那节课自身（按 _id 排除）
 * @returns {Promise<object|null>} 冲突的课次文档；无冲突/查询失败返回 null
 */
function findActiveClassForChild(db, childId, excludeId) {
  if (!db || !childId) return Promise.resolve(null);
  return db.collection('trainings').where({
    childId: childId,
    status: 'in_class'
  }).get().then(function (res) {
    const hit = ((res && res.data) || []).find(function (t) {
      return t && t._id !== excludeId && !t.classEndedAt;
    });
    return hit || null;
  }).catch(function (err) {
    console.error('查询学员上课状态失败', err);
    return null;
  });
}

// ==================== 训练时长 ====================

/**
 * 一条训练的「开场时刻」→ Date
 *
 * ⚠️ 不能 new Date('2026-09-15 14:30')：按规范会被当作 UTC 解析，东八区差 8 小时。
 *    所以手工拆字段再用本地构造器，与 toLocalDate 同一个理由。
 *
 * @param {object} training - 需要 date('YYYY-MM-DD')，startTime('HH:mm') 可选
 * @returns {Date|null} date 缺失或非法时返回 null
 */
function parseSessionStart(training) {
  const record = training || {};
  // date 缺失直接 null。getTodayString 对空入参会兜底成「今天」，
  // 不能拿它判缺失——否则缺 date 的记录会被当成今天零点开课，
  // elapsedMinutesOf 会编出一个假数字（测试钉的就是这个契约）。
  if (record.date === undefined || record.date === null || record.date === '') return null;
  // 用 getTodayString 归一化，不要直接 String(record.date)：
  // trainings.date 正常是 'YYYY-MM-DD' 字符串，但线上不排除有 Date 类型的历史数据，
  // String() 会得到 "Mon Sep 14 2026 ..."，字典序比任何 'YYYY-MM-DD' 都大，
  // 所有大小比较都会静默判错（昨天的课被当成未来的）。
  const dateMatched = getTodayString(record.date).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!dateMatched) return null;

  const timeMatched = String(record.startTime || '').match(/^(\d{1,2}):(\d{2})/);
  const date = new Date(
    parseInt(dateMatched[1], 10),
    parseInt(dateMatched[2], 10) - 1,
    parseInt(dateMatched[3], 10),
    timeMatched ? parseInt(timeMatched[1], 10) : 0,
    timeMatched ? parseInt(timeMatched[2], 10) : 0,
    0,
    0
  );

  return isNaN(date.getTime()) ? null : date;
}

/**
 * 时长文案：刚刚开始 / 32分钟 / 1小时12分
 *
 * 首页「正在上课」的正计时和详情页头图共用这一份。两处必须一致——
 * 家长在卡片上看到「32分钟」，点进去头图却写「31分钟」，会显得数据是假的。
 *
 * @param {number} minutes - 分钟数；<=0、NaN、缺失一律算「刚刚开始」
 */
function formatDurationText(minutes) {
  const total = Math.floor(Number(minutes));
  if (!(total > 0)) return '刚刚开始';
  if (total < 60) return total + '分钟';

  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest ? hours + '小时' + rest + '分' : hours + '小时';
}

/**
 * 一条训练「已经进行了多久」（分钟）
 *
 * 优先用实际开课时间（教练在 in-class 页点「开始上课」落库的 inClassTime），
 * 教练没记录时退回计划开始时间。两个都没有就返回 **null** —— 调用方不要拿这个
 * 编一个假数字出来，如实显示「上课中」即可。
 *
 * ⚠️ inClassTime 只认 Date 和数字：云数据库取回的是 Date，确定无歧义；
 *    字符串要区分 '2026-09-15'（会被当 UTC 午夜）和 '2026-09-15T14:32:00'，
 *    在这里猜容易错，不如退回计划开始时间——那条路径的解析是可靠的。
 *
 * @param {object} training
 * @param {Date} [now] 便于测试注入，不传取当前时间
 * @returns {number|null} 分钟数（负数已夹到 0）；开场时刻缺失/非法时 null
 */
function elapsedMinutesOf(training, now) {
  const record = training || {};
  const current = (now instanceof Date) ? now : new Date();
  if (isNaN(current.getTime())) return null;

  const raw = record.inClassTime;
  let beganAt = 0;
  if (raw instanceof Date) beganAt = raw.getTime();
  else if (typeof raw === 'number') beganAt = raw;
  if (isNaN(beganAt)) beganAt = 0;

  if (!beganAt) {
    const start = parseSessionStart(record);
    if (start) beganAt = start.getTime();
  }
  if (!beganAt) return null;

  // 夹到 0：in_class 但 recorded 的开课时刻还没到（时钟偏差/提前点开始），
  // 负数交给 formatDurationText 会渲染成「刚刚开始」，但别把负数本身漏出去
  return Math.max(0, Math.floor((current.getTime() - beganAt) / 60000));
}

// ==================== 表现指标元数据 ====================

/**
 * 表现指标元数据。字段含义：
 * - betterDirection：'lower' 越小越好（跑步用时）/'higher' 越大越好
 * - deltaScale：把 parsePerformanceValue 的返回值换算成**可比绝对单位**的系数
 * - deltaUnit：换算后的单位，用于「快0.3秒」这类文案
 *
 * ⚠️ deltaScale 为什么必须存在：parsePerformanceValue 的单位是不一致的——
 *    800 米返回**分钟**（"3分20秒" → 3.33），1000 米返回**秒**（"5分10秒" → 310）。
 *    直接相减，800 米的进步 0.3 分钟会被渲染成「进步 0.3」，跟另一侧的「进步 30」量纲对不上。
 *    乘上 deltaScale 统一到秒/米/个之后再比较，数字才有意义。
 *
 * ⚠️ 这里的 betterDirection 不能靠 parsePerformanceValue 的解析方向推断：
 *    立定跳远在 parse 里除了 100（厘米→米），但方向是「越大越好」。
 */
const PERFORMANCE_METRICS = [
  { key: 'fiftyMeter',        name: '50米',      unit: '秒',   betterDirection: 'lower',  deltaScale: 1,  deltaUnit: '秒' },
  { key: 'eightHundredMeter', name: '800米',     unit: '分',   betterDirection: 'lower',  deltaScale: 60, deltaUnit: '秒' },
  { key: 'thousandMeter',     name: '1000米',    unit: '秒',   betterDirection: 'lower',  deltaScale: 1,  deltaUnit: '秒' },
  { key: 'standingLongJump',  name: '立定跳远',   unit: '米',   betterDirection: 'higher', deltaScale: 1,  deltaUnit: '米' },
  { key: 'sitUp',             name: '仰卧起坐',   unit: '个',   betterDirection: 'higher', deltaScale: 1,  deltaUnit: '个' },
  { key: 'sitAndReach',       name: '坐位体前屈', unit: '厘米', betterDirection: 'higher', deltaScale: 1,  deltaUnit: '厘米' },
  { key: 'ropeSkipping',      name: '跳绳',      unit: '个',   betterDirection: 'higher', deltaScale: 1,  deltaUnit: '个' },
  { key: 'vitalCapacity',     name: '肺活量',    unit: 'ml',   betterDirection: 'higher', deltaScale: 1,  deltaUnit: 'ml' },
  { key: 'pushUp',            name: '俯卧撑',    unit: '个',   betterDirection: 'higher', deltaScale: 1,  deltaUnit: '个' },
  { key: 'pullUp',            name: '引体向上',   unit: '个',   betterDirection: 'higher', deltaScale: 1,  deltaUnit: '个' },
  { key: 'agility',           name: '敏捷',      unit: '分',   betterDirection: 'higher', deltaScale: 1,  deltaUnit: '分' },
  { key: 'coordination',      name: '协调',      unit: '分',   betterDirection: 'higher', deltaScale: 1,  deltaUnit: '分' }
];

/**
 * 读取表单里「本次真正填过」的字段值
 *
 * 为什么不能只判断「值非空」：录入成绩页选中学员时会把上一周的成绩预填进表单
 * （loadPreviousData），而表单本身就是提交的数据源。教练不改动直接保存的话，
 * 上周的 50米 会被原样记成本周的成绩，图表和进步卡都会当真。
 * 所以必须靠 touched 区分「教练刚打的」和「上周沿用的」。
 *
 * @param {object} form - 表单当前值
 * @param {object} touched - 本次会话被输入/拖动过的字段集合
 * @param {string} key - 字段名
 * @returns {*} 原始值；null 表示没填过、或填了又清空，不该写入
 */
function readTouchedField(form, touched, key) {
  if (!form || !touched || !touched[key]) return null;
  const value = form[key];
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}

/**
 * 「最新进步」只认最近两周内录入的成绩
 *
 * weekDate 存的是那一周的周一，所以「本周」是 0-6 天前、「上周」是 7-13 天前，
 * 满 14 天（即上上周一）就算旧数据了。
 */
const HIGHLIGHT_MAX_AGE_DAYS = 14;

function getMetricMeta(sportKey) {
  for (let i = 0; i < PERFORMANCE_METRICS.length; i++) {
    if (PERFORMANCE_METRICS[i].key === sportKey) return PERFORMANCE_METRICS[i];
  }
  return null;
}

/**
 * 按指标元数据格式化成绩，省掉调用方自己维护一份 sportItems
 * （复用 formatPerformanceValue：800 米/1000 米走 分'秒" 分支，其余走 数值+单位）
 */
function formatMetricValue(value, sportKey) {
  const meta = getMetricMeta(sportKey);
  return formatPerformanceValue(value, sportKey, meta ? [meta] : []);
}

/** 去掉浮点噪声并最多保留一位小数：0.2999999999999998 → '0.3'、3 → '3' */
function formatDeltaNumber(value) {
  if (!isFinite(value)) return '';
  return String(Math.round(value * 10) / 10);
}

/**
 * 「已经快了0.3秒」/「已经多了10个」/「少了5个」这类进步/退步文案
 * @param {number} delta 带符号的进步量，>0 表示进步
 */
function formatDeltaText(delta, meta) {
  if (!meta || !isFinite(delta)) return '';

  const size = formatDeltaNumber(Math.abs(delta));
  // 不足展示精度的小数差（8.52 vs 8.49 → 实际 0.03，展示两位都是 8.5秒）
  // 不出文案，否则渲染出「快了0秒」这种胡话
  if (size === '0') return '';
  const isBetter = delta > 0;

  // 进步加「已经」是报喜的口气；退步不加——「少了5个」坦白就好，不阴阳怪气
  const prefix = isBetter ? '已经' : '';
  // 计时用「快/慢」；次数/距离/评分统一「多/少」（「提升了3分」这类书面腔一并磨掉）
  const verb = meta.betterDirection === 'lower' ? (isBetter ? '快' : '慢') : (isBetter ? '多' : '少');

  return prefix + verb + '了' + size + meta.deltaUnit;
}

/**
 * 从表现记录里挑出「最明显进步」
 *
 * 输入按 weekDate 倒序或正序都可以，内部会重排。至少两条才做环比；
 * 只有一条返回 mode:'first'；一条都没有返回 null（调用方应整卡隐藏，不要显示负面信号）。
 *
 * 与 pages/coach/performance/list/index.js:144-235 的 calculateTrend 相比，这里多做两件事：
 * 1. 校验前一条真的是「上周」（weekDate 相差正好 7 天）。calculateTrend 完全不校验，
 *    会把三个月前那条记录说成「上周」。不是 7 天就退化成「自上次记录（…）」。
 * 2. 用 parsePerformanceValue 归一化后再算 delta（见 PERFORMANCE_METRICS 的 deltaScale 说明）。
 *
 * **最新那条必须真的是最近**（HIGHLIGHT_MAX_AGE_DAYS 之内），否则返回 null。
 * 否则学员停训两个月后，库里最新那条还是两个月前的，这张卡会把旧成绩
 * 顶着「最新进步」四个字报给家长。
 *
 * 「最明显」的对比基线不止相邻一次：相邻两周没进步时会往外看更早的记录
 * （传入几条看几条），找相对进步最大的一次报。首页传 4 条 ≈ 一个月窗口；
 * 只传 2 条时和原先行为完全一致。
 *
 * @param {Array} records performance 集合的记录
 * @param {{today?: string|Date}} [options] - today 仅用于测试注入，不传取当前时间
 * @returns {Object|null}
 */
function pickProgressHighlight(records, options) {
  const list = (records || []).filter(function (record) {
    return record && record.weekDate;
  });
  if (!list.length) return null;

  // 按 weekDate 【升序】：sorted[len-1] 是最新一周（current），sorted[len-2] 是上一周（previous）。
  // 注意 diffInDays(from, to) 返回的是 to - from，所以这里参数顺序要反过来才是升序；
  // 写成 diffInDays(a, b) 会得到降序，current/previous 会整体对调（进步被算成退步）。
  const sorted = list.slice().sort(function (a, b) {
    return (diffInDays(b.weekDate, a.weekDate) || 0);
  });
  const current = sorted[sorted.length - 1];

  // 「最新」名副其实的守卫。注意这里查的是「该学员最近 N 条」而不是「最近 N 周的记录」，
  // 所以必须另外校验这条到底有多旧。
  const today = getTodayString((options && options.today) || new Date());
  const age = diffInDays(current.weekDate, today);
  if (age === null || age >= HIGHLIGHT_MAX_AGE_DAYS) return null;

  if (sorted.length < 2) {
    const meta = firstAvailableMetric(current);
    if (!meta) return null;
    return {
      mode: 'first',
      metricKey: meta.key,
      metricName: meta.name,
      currentText: formatMetricValue(parsePerformanceValue(current[meta.key], meta.key), meta.key),
      deltaText: '',
      comparisonText: '',
      isImprovement: null
    };
  }

  const previous = sorted[sorted.length - 2];

  // 一个基线的候选集：current 相对 baseline 在每个指标上的变化。
  // 先乘 deltaScale 统一量纲再相减（800米存 '3分20秒'，不换算会算出「快0.2秒」这种胡话）；
  // 按相对变化 ratio 排序，跨指标才可比（0.3 秒和 5 个谁更"明显"没有绝对答案）
  const buildCandidates = function (baseline) {
    const candidates = [];

    PERFORMANCE_METRICS.forEach(function (meta) {
      const currentValue = parsePerformanceValue(current[meta.key], meta.key);
      const baselineValue = parsePerformanceValue(baseline[meta.key], meta.key);
      if (currentValue === null || baselineValue === null) return;
      if (!isFinite(currentValue) || !isFinite(baselineValue)) return;

      const currentAbs = currentValue * meta.deltaScale;
      const baselineAbs = baselineValue * meta.deltaScale;
      // 带符号的进步量：正数 = 变好
      const improvement = meta.betterDirection === 'lower'
        ? baselineAbs - currentAbs
        : currentAbs - baselineAbs;

      const base = Math.abs(baselineAbs);
      const ratio = base > 0 ? improvement / base : (improvement > 0 ? Infinity : 0);

      candidates.push({
        meta: meta,
        currentAbs: currentAbs,
        baselineAbs: baselineAbs,
        improvement: improvement,
        ratio: ratio,
        baseline: baseline
      });
    });

    return candidates;
  };

  // 「最明显」的基线不只看相邻一次：相邻两周没动静时往外多看几条
  // （调用方给几条看几条，首页取 4 条 ≈ 一个月），哪条基线的相对进步最大报哪条。
  // 对比段由 describeComparison 说明白（非上周会写「自上次记录（…）」，不谎称自上周）。
  let best = null;
  for (let i = sorted.length - 2; i >= 0; i--) {
    buildCandidates(sorted[i]).forEach(function (item) {
      if (item.ratio > 0 && (!best || item.ratio > best.ratio)) best = item;
    });
  }

  if (best) {
    return {
      mode: 'improved',
      metricKey: best.meta.key,
      metricName: best.meta.name,
      currentText: formatMetricValue(parsePerformanceValue(current[best.meta.key], best.meta.key), best.meta.key),
      previousText: formatMetricValue(parsePerformanceValue(best.baseline[best.meta.key], best.meta.key), best.meta.key),
      // improvement 已经乘过 deltaScale，是绝对单位（秒/米/个），直接配 meta.deltaUnit 出文案
      deltaText: formatDeltaText(best.improvement, best.meta),
      comparisonText: describeComparison(best.baseline, current),
      isImprovement: true
    };
  }

  // 一条进步都没有：如实报相邻两次里最明显的那次退步（对比基准用最近一次，别翻旧账）。
  // 零变化不算「变化」——否则会渲染出「慢0秒」这种胡话；一条都没动 → null 整卡隐藏。
  const candidates = buildCandidates(previous);
  if (!candidates.length) return null;

  const regressed = candidates.filter(function (item) { return item.improvement !== 0; });
  if (!regressed.length) return null;
  const picked = regressed.reduce(function (worst, item) {
    return item.ratio < worst.ratio ? item : worst;
  });

  return {
    mode: 'changed',
    metricKey: picked.meta.key,
    metricName: picked.meta.name,
    currentText: formatMetricValue(parsePerformanceValue(current[picked.meta.key], picked.meta.key), picked.meta.key),
    previousText: formatMetricValue(parsePerformanceValue(previous[picked.meta.key], picked.meta.key), picked.meta.key),
    deltaText: formatDeltaText(picked.improvement, picked.meta),
    comparisonText: describeComparison(previous, current),
    isImprovement: false
  };
}

/** 找一条记录里第一个有值的指标（按 PERFORMANCE_METRICS 的顺序） */
function firstAvailableMetric(record) {
  for (let i = 0; i < PERFORMANCE_METRICS.length; i++) {
    const meta = PERFORMANCE_METRICS[i];
    if (parsePerformanceValue(record[meta.key], meta.key) !== null) return meta;
  }
  return null;
}

/**
 * 前一条记录是不是「上周」
 *
 * weekDate 存的是那一周的周一日期字符串，所以连续两周的记录应当正好差 7 天。
 * 差 7 天 → 「自上周」；不是 → 把上一次是哪一段明说出来。
 * 宁可说得啰嗦，也不能把三个月前那条说成「上周」。
 * 用「自」不用「较」：和正文「从X练到Y」连读成一句话（自9月21日，从…练到…）。
 */
function describeComparison(previous, current) {
  const gap = diffInDays(previous.weekDate, current.weekDate);
  if (gap === 7) return '自上周';

  let range = previous.weekRange;
  if (!range) {
    const week = getWeekRange(previous.weekDate);
    if (week) range = formatWeekRangeText(week.start, week.end);
  }
  return range ? '自上次记录（' + range + '）' : '自上次记录';
}

// ==================== 训练项目进步（组数/个数比对） ====================

/**
 * 「训练项目进步」只看最近一个月的同名项目
 *
 * 教练每次添加训练会录入项目清单（items，含组数/个数，选填），同一项目
 * （按名字匹配）隔三差五会重复出现。最近一个月里「做得更多了」——能做
 * 更多组、或每组多做几次——就是这个项目上的进步。
 */
const ITEM_PROGRESS_WINDOW_DAYS = 30;

/**
 * '3' / '3组' / 3 → 3；空、0、非数字开头 → 0
 *
 * 组数/个数落库时多数是输入框带来的字符串，历史数据里也有数字；
 * parseInt 对两者都宽容（'3组' 也能取出 3），取不出来就当没填。
 */
function parseItemCount(value) {
  if (value === null || value === undefined || value === '') return 0;
  const n = parseInt(value, 10);
  return isFinite(n) && n > 0 ? n : 0;
}

/**
 * 一次完成的项目量：组数个数都填按总次数（组×个），只填一个就按那个量
 * （3组=3、12次=12）——跨课次比的就是这个数有没有变大
 */
function itemVolumeOf(sets, reps) {
  if (sets > 0 && reps > 0) return sets * reps;
  return sets > 0 ? sets : reps;
}

/** 一次的量 → '3组×12次' / '3组' / '12次' */
function formatItemAmount(sets, reps) {
  const parts = [];
  if (sets > 0) parts.push(sets + '组');
  if (reps > 0) parts.push(reps + '次');
  return parts.join('×');
}

/**
 * 两次完成量的差 → 进步文案
 *
 * 统一写成「从X练到Y」（「从3组×12次练到5组×17次」）——数字前后一摆，
 * 努力就落在两个真实数字之间，不用「多做N组」这种播报腔去复述算术；
 * 数字由 DIN 字体渲染，成绩单视觉本来就给数字留着主角位。
 *
 * 有一截在退就不这么写了——「从3组×15次练到5组×10次」看不出哪截退了，
 * 只报总量（「加起来从45次练到50次」）：如实，但不说教。
 */
function buildItemDeltaText(baseline, current, improvement) {
  const dSets = current.sets - baseline.sets;
  const dReps = current.reps - baseline.reps;

  if (dSets < 0 || dReps < 0) {
    // 走到这里两截量必然都在（不然 dX 不会是负数），总量按 组×个 算
    if (improvement > 0 && baseline.sets * baseline.reps > 0) {
      return '加起来从' + (baseline.sets * baseline.reps) + '次练到' + (current.sets * current.reps) + '次';
    }
    return '';
  }
  return '从' + formatItemAmount(baseline.sets, baseline.reps) + '练到' + formatItemAmount(current.sets, current.reps);
}

/**
 * 从课次的「训练项目」里挑出「最明显进步」（家长首页进步行的第一优先数据源）
 *
 * 数据源是 trainings.items（教练添加训练时逐项录入的 项目名+组数/个数+完成勾选）。
 * 规则：
 * 1. 只认**勾了完成**的项目——没勾的是计划量，不代表孩子真实做到了；
 * 2. 项目名 trim 后完全相同才算「同一个项目」；
 * 3. 只比最近 ITEM_PROGRESS_WINDOW_DAYS 天内的课次；
 * 4. 同名项目取最近一次做 current，窗口内更早的每一次都当基线试一遍
 *    （和 pickProgressHighlight 扫全部基线同一哲学），相对提升最大的一次报哪条；
 * 5. 多个项目同时进步时，取相对提升率（提升量 ÷ 基线量）最大的——
 *    「36次到40次」和「10组到12组」谁更明显，只有比例可比；
 * 6. 同一节课里同名项目录了两行（编辑页不拦重名，热身一组+正式组很常见），
 *    只取量最大的一行当本课成绩——课内差异不冒充跨课进步，也不把真进步压没。
 *
 * 只填组数、只填个数、组数个数都填，是三种数据形态；形态不同没法比（比出来的
 * 都是假进步），两个方向都跳过。
 *
 * 没有可比的同名项目 / 全都没进步 → 返回 null，调用方回落体测成绩那套
 * （pickProgressHighlight），两套都没有才整行隐藏。
 *
 * @param {Array} trainings trainings 集合的课次文档（须含 date / items）
 * @param {{today?: string|Date, windowDays?: number}} [options] today 仅测试注入
 * @returns {Object|null} 形状与 pickProgressHighlight 的进步分支一致：
 *   { mode:'item', isImprovement:true, metricName, deltaText, comparisonText, currentText, previousText }
 */
function pickItemProgress(trainings, options) {
  const today = getTodayString((options && options.today) || new Date());
  if (!today) return null;
  const windowDays = (options && options.windowDays) || ITEM_PROGRESS_WINDOW_DAYS;

  // ① 收集：先按「课次 + 项目名」去重，再归到 项目名 → [entries]。
  // 同一节课里同名项目录了两行（热身一组 + 正式组很常见），那是本节课内部差异：
  // 当跨课比会冒充进步（「跟本课自己比」），也会把 current 拖成课里较小的那行、
  // 把真进步压成 null。每课次每项目只留量最大的一行，代表这节课的最好成绩。
  const groups = {};
  const perLesson = {};   // 课次身份 + 项目名 → 最优一行
  (trainings || []).forEach(function (t) {
    if (!t || !Array.isArray(t.items)) return;
    const date = getTodayString(t.date);
    if (!date) return;
    const age = diffInDays(date, today);
    if (age === null || age < 0 || age >= windowDays) return;

    // 测试直接造的对象可能没有 _id，用日期+时间+课次名兜底当课次身份
    const lessonId = t._id || (date + ' ' + (t.startTime || '') + ' ' + (t.name || ''));

    t.items.forEach(function (item) {
      if (!item || item.name === undefined || item.name === null) return;
      if (!item.done) return;
      const name = String(item.name).trim();
      if (!name) return;
      const sets = parseItemCount(item.sets);
      const reps = parseItemCount(item.reps);
      if (!sets && !reps) return;
      const volume = itemVolumeOf(sets, reps);
      const key = lessonId + '\n' + name;
      const kept = perLesson[key];
      if (kept && kept.volume >= volume) return;
      perLesson[key] = {
        name: name, date: date, sets: sets, reps: reps, volume: volume,
        // startTime/_id 一起带上：同一天可能有多节课，「哪次是最新」必须定死，
        // 不能取决于查询返回顺序（云库同日排序本来就不保证稳定）
        startTime: t.startTime || '', _id: t._id || ''
      };
    });
  });
  Object.keys(perLesson).forEach(function (key) {
    const entry = perLesson[key];
    if (!groups[entry.name]) groups[entry.name] = [];
    groups[entry.name].push({
      date: entry.date, sets: entry.sets, reps: entry.reps,
      startTime: entry.startTime, _id: entry._id
    });
  });

  // ② 逐组比对，全项目里挑相对提升最大的一次
  let best = null;
  Object.keys(groups).forEach(function (name) {
    const entries = groups[name].slice().sort(function (a, b) {
      // diffInDays(from, to) = to - from，参数反着传才是升序（同 pickProgressHighlight）
      const byDate = diffInDays(b.date, a.date) || 0;
      if (byDate !== 0) return byDate;
      // 同一天：按实际上课时间排（'HH:mm' 字典序即可），没 startTime 的用 _id 兜底
      const byTime = (a.startTime || '').localeCompare(b.startTime || '');
      if (byTime !== 0) return byTime;
      return (a._id || '') < (b._id || '') ? -1 : ((a._id || '') > (b._id || '') ? 1 : 0);
    });
    if (entries.length < 2) return;

    const current = entries[entries.length - 1];
    for (let i = 0; i < entries.length - 1; i++) {
      const baseline = entries[i];
      // 数据形态不同的两次没法比（比出来的都是假进步），两个方向都挡：
      // 只填组数 vs 组×次（原守卫已挡）、只填个数 vs 组×次（镜像方向，只查 reps 挡不住）
      if ((baseline.sets > 0) !== (current.sets > 0)) continue;
      if ((baseline.reps > 0) !== (current.reps > 0)) continue;

      const currentVolume = itemVolumeOf(current.sets, current.reps);
      const baselineVolume = itemVolumeOf(baseline.sets, baseline.reps);
      const improvement = currentVolume - baselineVolume;
      if (improvement <= 0 || baselineVolume <= 0) continue;

      const deltaText = buildItemDeltaText(baseline, current, improvement);
      if (!deltaText) continue;

      const ratio = improvement / baselineVolume;
      if (!best || ratio > best.ratio) {
        best = { name: name, ratio: ratio, deltaText: deltaText, baseline: baseline, current: current };
      }
    }
  });

  if (!best) return null;

  const baselineDate = best.baseline.date;
  return {
    mode: 'item',
    isImprovement: true,
    metricName: best.name,
    currentText: formatItemAmount(best.current.sets, best.current.reps),
    previousText: formatItemAmount(best.baseline.sets, best.baseline.reps),
    deltaText: best.deltaText,
    comparisonText: '自' + parseInt(baselineDate.slice(5, 7), 10) + '月' + parseInt(baselineDate.slice(8, 10), 10) + '日'
  };
}

// ==================== 成长页能力分组 ====================

/**
 * 能力域分组：把 10 项测评指标按「能力结构」归组。
 * 这是 2.0 成长页「把数据变成故事」的分层依据——家长先看能力域有没有变好，
 * 再点进去看单项曲线，而不是对着一排没有上下文的指标名。
 *
 * 归组跟着指标的身体素质属性走，和 PERFORMANCE_METRICS 的 key 一一对应；
 * 新增指标时在这里补一行即可出现在成长页分组里。
 */
const ABILITY_GROUPS = [
  { key: 'speed',       name: '速度',     icon: '🏃', metricKeys: ['fiftyMeter'] },
  { key: 'endurance',   name: '耐力',     icon: '🫁', metricKeys: ['eightHundredMeter', 'thousandMeter', 'vitalCapacity'] },
  { key: 'strength',    name: '力量',     icon: '💪', metricKeys: ['standingLongJump', 'sitUp', 'pushUp', 'pullUp'] },
  { key: 'flexibility', name: '柔韧',     icon: '🧘', metricKeys: ['sitAndReach'] },
  { key: 'agility',     name: '协调灵敏', icon: '⚡', metricKeys: ['ropeSkipping', 'agility', 'coordination'] }
];

/**
 * 取最近两条测评记录，按能力域归组并算出每个指标的环比变化
 *
 * 输入任意顺序（内部按 weekDate 升序重排，和 pickProgressHighlight 同一手法）。
 * 只有一条记录 → 指标有值但没有 delta（isImprovement 为 null，相当于「首次记录」）；
 * 一条都没有 → 返回空数组，调用方整块隐藏，不要渲染一排「未测」。
 *
 * 故意**不做** pickProgressHighlight 那样的时效守卫（HIGHLIGHT_MAX_AGE_DAYS）：
 * 分组卡回答的是「孩子当前的能力结构」，停训两个月后旧数据也比空白强；
 * 「最新进步」的时效口径由进步卡单独负责，两张卡的职责不同。
 *
 * @param {Array} records performance 集合的记录（>=0 条，顺序不限）
 * @returns {Array} ABILITY_GROUPS 的投影。每个指标 {key,name,hasData,valueText,
 *          previousText,deltaText,isImprovement}；isImprovement: true进步/false退步/null无从比较。
 *          组上另有 measuredCount（有值的指标数）和 improvedCount（进步的指标数）。
 */
function summarizeAbilityGroups(records) {
  const list = (records || []).filter(function (record) {
    return record && record.weekDate;
  });
  if (!list.length) return [];

  const sorted = list.slice().sort(function (a, b) {
    return (diffInDays(b.weekDate, a.weekDate) || 0);
  });
  const current = sorted[sorted.length - 1];
  const previous = sorted.length >= 2 ? sorted[sorted.length - 2] : null;

  // 线上历史数据里指标字段可能是数组（growth 页自己的 parseValue 就在处理这种），
  // 取第一个非空元素再交给 parsePerformanceValue——它自己不认数组
  const readMetric = function (record, key) {
    const raw = record ? record[key] : null;
    const value = Array.isArray(raw)
      ? raw.find(function (v) { return v !== undefined && v !== null && v !== ''; })
      : raw;
    return parsePerformanceValue(value, key);
  };

  return ABILITY_GROUPS.map(function (group) {
    let measuredCount = 0;
    let improvedCount = 0;

    const metrics = group.metricKeys.map(function (key) {
      const meta = getMetricMeta(key);
      const parsed = readMetric(current, key);
      const hasData = parsed !== null;

      const item = {
        key: key,
        name: meta ? meta.name : key,
        hasData: hasData,
        valueText: hasData ? formatMetricValue(parsed, key) : '',
        previousText: '',
        deltaText: '',
        isImprovement: null
      };

      if (!hasData) return item;
      measuredCount += 1;

      if (previous) {
        const prevParsed = readMetric(previous, key);
        if (prevParsed !== null && meta) {
          // 和 pickProgressHighlight 同一算法：先乘 deltaScale 统一量纲再相减（见其注释）
          const scale = meta.deltaScale;
          const improvement = meta.betterDirection === 'lower'
            ? prevParsed * scale - parsed * scale
            : parsed * scale - prevParsed * scale;

          item.previousText = formatMetricValue(prevParsed, key);
          // 零变化不算「变化」：formatDeltaText(0) 会吐出「慢0秒」这种胡话，
          // 和 pickProgressHighlight 的守卫同一理由（见其注释）
          item.isImprovement = improvement > 0 ? true : (improvement < 0 ? false : null);
          item.deltaText = improvement === 0 ? '' : formatDeltaText(improvement, meta);
        }
      }

      if (item.isImprovement === true) improvedCount += 1;
      return item;
    });

    return {
      key: group.key,
      name: group.name,
      icon: group.icon,
      metrics: metrics,
      measuredCount: measuredCount,
      improvedCount: improvedCount
    };
  });
}

/**
 * 阶段成长报告用：把一段时期内的周测评记录做「期初 vs 期末」对比。
 *
 * 和 summarizeAbilityGroups（最近两次环比）是两种口径——报告回答的是
 * 「这一个月/一个季度整体变化了多少」，比较对象是期内第一条和最后一条，
 * 中间测了几次不影响结论。
 *
 * 每个能力域只出一行，代表指标的挑选规则：
 *   1. 优先取「期初和期末都有值」的第一个指标（能算出变化）；
 *   2. 没有成对的，退而取期末第一个有值的（只报当前值，无 delta）；
 *   3. 整个域期末都没值 → 该域不出现（报告里没有「未测」占位，块空了由调用方兜底）。
 *
 * @param {Array} records 期内的 performance 记录（>=0 条，顺序不限）
 * @returns {Array} [{key,name,icon,hasData:true,metricName,valueText,firstText,deltaText,isImprovement}]
 */
function buildPeriodAbilityRows(records) {
  const list = (records || []).filter(function (record) {
    return record && record.weekDate;
  });
  if (!list.length) return [];

  // 和 summarizeAbilityGroups 同一排序手法（weekDate 升序，diffInDays 参数顺序别动）
  const sorted = list.slice().sort(function (a, b) {
    return (diffInDays(b.weekDate, a.weekDate) || 0);
  });
  const last = sorted[sorted.length - 1];
  const first = sorted.length >= 2 ? sorted[0] : null;

  // 线上历史数据指标字段可能是数组，取第一个非空元素再解析（同 summarizeAbilityGroups）
  const readMetric = function (record, key) {
    const raw = record ? record[key] : null;
    const value = Array.isArray(raw)
      ? raw.find(function (v) { return v !== undefined && v !== null && v !== ''; })
      : raw;
    return parsePerformanceValue(value, key);
  };

  const rows = ABILITY_GROUPS.map(function (group) {
    const row = {
      key: group.key,
      name: group.name,
      icon: group.icon,
      hasData: false,
      metricName: '',
      valueText: '',
      firstText: '',
      deltaText: '',
      isImprovement: null
    };

    // 1) 成对指标（期初+期末都有值）
    for (let i = 0; i < group.metricKeys.length; i++) {
      const key = group.metricKeys[i];
      const meta = getMetricMeta(key);
      const lastParsed = readMetric(last, key);
      if (lastParsed === null) continue;
      const firstParsed = first ? readMetric(first, key) : null;
      if (firstParsed === null || !meta) continue;

      const scale = meta.deltaScale;
      const improvement = meta.betterDirection === 'lower'
        ? firstParsed * scale - lastParsed * scale
        : lastParsed * scale - firstParsed * scale;

      row.hasData = true;
      row.metricName = meta.name;
      row.valueText = formatMetricValue(lastParsed, key);
      row.firstText = formatMetricValue(firstParsed, key);
      row.isImprovement = improvement > 0 ? true : (improvement < 0 ? false : null);
      row.deltaText = improvement === 0 ? '' : formatDeltaText(improvement, meta);
      return row;
    }

    // 2) 只有期末有值的指标：只报当前值
    for (let i = 0; i < group.metricKeys.length; i++) {
      const key = group.metricKeys[i];
      const meta = getMetricMeta(key);
      const lastParsed = readMetric(last, key);
      if (lastParsed === null) continue;

      row.hasData = true;
      row.metricName = meta ? meta.name : key;
      row.valueText = formatMetricValue(lastParsed, key);
      return row;
    }

    return row;
  });

  return rows.filter(function (row) { return row.hasData; });
}

// ==================== 角色与可见范围 ====================

/**
 * 各端着陆页
 * 集中在此，避免路径字面量散落各页
 */
const HOME = {
  USER: '/pages/users/home/index',
  COACH: '/pages/coach/workbench/index',
  ADMIN: '/pages/admin/dashboard/index'
};

/**
 * 登录页的入口标识
 * 注意：这是「登录入口」，不是 users.role 的取值。
 * 管理员的 role 仍是 'coach'，靠 isAdmin 字段区分。
 */
const ENTRY = { USER: 'user', COACH: 'coach', ADMIN: 'admin' };

/**
 * 读用户的 isAdmin 标志
 *
 * 值仍然严格要求布尔 true——云开发控制台里把类型选成字符串时，
 * "false" 是字符串而非布尔，如果宽松判断会误授权。
 *
 * 但**键名**做一次容错：在控制台「添加字段」手打时很容易带出首尾空格，
 * 存进去就是 "isAdmin " 而不是 "isAdmin"，代码读 user.isAdmin 只能拿到 undefined。
 * 这个坑排查起来很费劲（单看记录内容完全正常），所以在这里兜住。
 *
 * @param {object} user - 数据库里的 users 记录
 * @returns {boolean}
 */
function readIsAdmin(user) {
  if (!user) return false;
  if (user.isAdmin === true) return true;
  const key = Object.keys(user).find(k => k.trim() === 'isAdmin');
  return !!(key && user[key] === true);
}

/**
 * 登录页的角色闸门
 *
 * 用户的 role 只有 'user' | 'coach' 两个取值；管理员靠 isAdmin 区分。
 *
 * @param {{role:string, isAdmin?:boolean}} user - 数据库里的 users 记录
 * @param {'user'|'coach'|'admin'} entry - 登录页选中的入口
 * @returns {{ok:boolean, message:string, home:string}}
 *          ok=false 时 message 用于 showModal；
 *          home 恒为可用路径——即使 ok=false 也要有地方去，绝不返回空串
 */
function resolveLoginEntry(user, entry) {
  const role = (user && user.role) || '';
  const isAdmin = readIsAdmin(user);

  if (role === 'user') {
    if (entry === ENTRY.USER) return { ok: true, message: '', home: HOME.USER };
    return { ok: false, message: '您是家长账号，请切换到用户端登录', home: HOME.USER };
  }

  if (role === 'coach') {
    if (entry === ENTRY.ADMIN) {
      if (isAdmin) return { ok: true, message: '', home: HOME.ADMIN };
      return { ok: false, message: '您没有管理员权限，请切换到教练端登录', home: HOME.COACH };
    }
    // 管理员从教练端登录也放行，避免老板被自己的入口卡住
    return { ok: true, message: '', home: HOME.COACH };
  }

  return { ok: false, message: '账号角色异常，请联系管理员', home: HOME.USER };
}

/**
 * 构造「当前教练可见范围」的查询条件，直接展开进 where()
 *
 * 用法：
 *   db.collection('children').where(coachScopeOf(coachId, false))
 *   db.collection('trainings').where({ date: today, ...coachScopeOf(coachId, true, { allForAdmin: true }) })
 *
 * @param {string|null} coachId - 当前登录教练的 users._id
 * @param {boolean} admin - 当前用户是否 isAdmin
 * @param {{allForAdmin?:boolean}} [options] - admin 且 allForAdmin 时返回 {}（去掉归属条件）
 * @returns {{coachId?:string}}
 */
function coachScopeOf(coachId, admin, options) {
  if (options && options.allForAdmin && admin) return {};
  return { coachId: coachId };
}

/**
 * 某个教练有没有权限看这条学员记录
 *
 * 用于页面从 URL 参数拿到 childId 后、正式拉数据之前的归属校验。
 * children/detail 和 performance/list 都是「改一下 URL 里的 id 就能看别人家孩子」，
 * 这两页必须先过这里。
 *
 * ⚠️ 这里**刻意不给管理员开绿灯**。管理员的全局视野只在两处查询放宽
 *    （预约审批、换教练审批），学员相关数据一律保持教练视角 ——
 *    管理员同样只能看自己名下的孩子。放宽之前先看 admin-scope-only-two-queries 的约定。
 *
 * ⚠️ 这是**前端校验，只治标**。改 URL 能拦住，但直接用 openid 调数据库接口拦不住。
 *    真正的修复是收紧云开发安全规则，而家长端/教练端大量前端直查，
 *    贸然收紧会全线打挂，所以本轮不动。
 *
 * @param {object} child - children 集合的一条记录
 * @param {string|null} coachId - 当前登录教练的 users._id
 * @returns {boolean}
 */
function canViewChild(child, coachId) {
  if (!child || !coachId) return false;
  return child.coachId === coachId;
}

/**
 * 当前是否处于「全局视野」（供页面做 UI 分支，如是否显示"所属教练"列）
 * @param {boolean} admin
 * @param {{allForAdmin?:boolean}} [options]
 * @returns {boolean}
 */
function hasGlobalScope(admin, options) {
  return !!(options && options.allForAdmin && admin);
}

module.exports = {
  formatTime,
  parsePerformanceValue,
  formatPerformanceValue,
  getSportName,
  classifyAppointments,
  // 日期
  toLocalDate,
  diffInDays,
  getTodayString,
  getWeekRange,
  formatWeekRangeText,
  formatMonthLabel,
  // 训练状态
  getTrainingStatusMeta,
  TRAINING_STATUS_META,
  pickCurrentTraining,
  isDatePast,
  findActiveClassForChild,
  // 训练时长
  parseSessionStart,
  formatDurationText,
  elapsedMinutesOf,
  // 表现
  PERFORMANCE_METRICS,
  getMetricMeta,
  formatMetricValue,
  formatDeltaNumber,
  formatDeltaText,
  readTouchedField,
  HIGHLIGHT_MAX_AGE_DAYS,
  pickProgressHighlight,
  pickItemProgress,
  ITEM_PROGRESS_WINDOW_DAYS,
  // 成长页能力分组
  ABILITY_GROUPS,
  summarizeAbilityGroups,
  buildPeriodAbilityRows,
  // 角色与可见范围
  HOME,
  ENTRY,
  readIsAdmin,
  resolveLoginEntry,
  coachScopeOf,
  hasGlobalScope,
  canViewChild
};
