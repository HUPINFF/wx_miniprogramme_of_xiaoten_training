/**
 * 排课规则纯函数：冲突检测 + 改课留痕（零 wx 依赖，jest 直测）
 *
 * 服务于管理端「排课调度中心」（管理 tab 时间轴）与 trainings/edit 的保存前校验：
 * - findConflicts / detectConflicts：同教练或同学员的时间区间重叠判定
 * - buildChangeLog / appendChangeLog：编辑保存时 diff 出改了什么，写进 trainings.changeLogs
 *
 * 时间字段口径与 trainings 集合一致：startTime/endTime 是 'HH:mm' 定长字符串，
 * duration 是 'N分钟'。endTime 由 edit 页计算写入，历史数据可能缺失/空串——
 * 缺失时按 duration 兜底，再不行按 60 分钟：宁可粗一点，也不把冲突漏掉。
 */

/** changeLogs 数组上限：只留最近 20 条，防无限膨胀 */
const CHANGE_LOG_CAP = 20;

/** 默认课长（分钟）：endTime 和 duration 都缺失时的兜底 */
const DEFAULT_DURATION_MIN = 60;

/**
 * 'HH:mm' → 当天分钟数；畸形入参（非字符串/超界/缺冒号）返回 null
 */
function minutesOf(hhmm) {
  if (typeof hhmm !== 'string') return null;
  const matched = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!matched) return null;
  const h = parseInt(matched[1], 10);
  const m = parseInt(matched[2], 10);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** '60分钟' → 60；解析不了或非正数返回 null */
function durationMinutes(duration) {
  if (duration === null || duration === undefined) return null;
  const n = parseInt(duration, 10);
  return (isFinite(n) && n > 0) ? n : null;
}

/**
 * 一节课的 [start, end) 分钟区间。
 * endTime 缺失/非法（或早于 startTime 的脏数据）时按 duration 兜底，再缺按 60 分钟。
 */
function slotRange(t) {
  const start = minutesOf(t && t.startTime);
  if (start === null) return null;
  let end = minutesOf(t && t.endTime);
  if (end === null || end <= start) {
    end = start + (durationMinutes(t && t.duration) || DEFAULT_DURATION_MIN);
  }
  return { start: start, end: end };
}

/** 两个区间是否相交。首尾相接不算冲突：11:00 下课和 11:00 上课可以连排 */
function overlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * 新课次与一节已有课次是否冲突：时间相交，且（同教练 或 同学员）。
 * coachId/childId 任一侧缺失就跳过该维度——两个维度都缺失时绝不误报。
 */
function isConflicting(slot, existing) {
  const a = slotRange(slot);
  const b = slotRange(existing);
  if (!a || !b) return false;
  if (!overlap(a.start, a.end, b.start, b.end)) return false;

  const sameCoach = !!(slot.coachId && existing.coachId && slot.coachId === existing.coachId);
  const sameChild = !!(slot.childId && existing.childId && slot.childId === existing.childId);
  return sameCoach || sameChild;
}

/**
 * 新课次在一批已有课次中的冲突列表。
 * @param {object} slot - {coachId, childId, startTime, endTime?, duration?}
 * @param {Array} trainings - 当天已有课次（需带 _id 才能被 excludeId 排除）
 * @param {string} [excludeId] - 编辑保存时排除自己
 */
function findConflicts(slot, trainings, excludeId) {
  const list = Array.isArray(trainings) ? trainings : [];
  return list.filter(function (t) {
    if (excludeId && t && t._id === excludeId) return false;
    return isConflicting(slot, t);
  });
}

/**
 * 一批课次里所有卷入冲突的 _id 集合（调度台打「时间冲突」角标用）。
 * 返回 Set<string>；无冲突返回空集合。
 */
function detectConflicts(trainings) {
  const list = Array.isArray(trainings) ? trainings : [];
  const ids = new Set();
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (isConflicting(list[i], list[j])) {
        if (list[i] && list[i]._id) ids.add(list[i]._id);
        if (list[j] && list[j]._id) ids.add(list[j]._id);
      }
    }
  }
  return ids;
}

/** 值展示：空值统一显示「空」，避免出现「地点  → 体育馆」这种断头文案 */
function displayValue(v) {
  const s = (v === null || v === undefined) ? '' : String(v);
  return s || '空';
}

/**
 * 编辑保存时 diff 旧文档与新表单，产出一条改课记录；没有任何变化返回 null。
 * 一次保存的多处修改合成一条记录：action 是类别串联（如「改期/改时间」），
 * detail 是「字段 原值 → 新值」分号拼接。
 *
 * @param {object} oldDoc - trainings 原文档（编辑前）
 * @param {object} form   - 新表单 {date, startTime, endTime, location, childId, childName, coachId, coachName}
 * @param {string} by     - 操作人名（教练/管理员姓名）
 * @returns {{at: Date, by: string, action: string, detail: string}|null}
 */
function buildChangeLog(oldDoc, form, by) {
  const o = oldDoc || {};
  const n = form || {};
  const actions = [];
  const segs = [];

  if (n.date && o.date !== n.date) {
    actions.push('改期');
    segs.push('日期 ' + displayValue(o.date) + ' → ' + n.date);
  }
  if (n.startTime && (o.startTime || '') !== n.startTime) {
    actions.push('改时间');
    segs.push('时间 ' + displayValue(o.startTime) + ' → ' + n.startTime);
  }
  // 时长是独立可编辑字段（endTime 由它派生，还参与冲突检测的兜底区间），
  // 只改课时的保存也要留痕；与「改时间」同类别，改开始时间+改时长合一条
  if (n.duration && (o.duration || '') !== n.duration) {
    actions.push('改时间');
    segs.push('时长 ' + displayValue(o.duration) + ' → ' + n.duration);
  }
  // location 用 undefined 判断「调用方没提供」：空串是合法新值（清空地点），
  // 而 undefined 表示这次 diff 不看地点，不能误报成「改地点」
  if (n.location !== undefined && (n.location || '') !== (o.location || '')) {
    actions.push('改地点');
    segs.push('地点 ' + displayValue(o.location) + ' → ' + displayValue(n.location));
  }
  if (n.coachId && o.coachId !== n.coachId) {
    actions.push('换教练');
    segs.push('教练 ' + displayValue(o.coachName) + ' → ' + displayValue(n.coachName));
  }
  if (n.childId && o.childId !== n.childId) {
    actions.push('换学员');
    segs.push('学员 ' + displayValue(o.childName) + ' → ' + displayValue(n.childName));
  }

  if (!segs.length) return null;
  return { at: new Date(), by: by || '', action: actions.join('/'), detail: segs.join('；') };
}

/** changeLogs 追加一条并截尾（保留最近 CHANGE_LOG_CAP 条），返回新数组不动原数组 */
function appendChangeLog(existingLogs, entry) {
  const list = Array.isArray(existingLogs) ? existingLogs.slice() : [];
  list.push(entry);
  return list.slice(-CHANGE_LOG_CAP);
}

module.exports = {
  CHANGE_LOG_CAP: CHANGE_LOG_CAP,
  DEFAULT_DURATION_MIN: DEFAULT_DURATION_MIN,
  minutesOf: minutesOf,
  durationMinutes: durationMinutes,
  slotRange: slotRange,
  overlap: overlap,
  isConflicting: isConflicting,
  findConflicts: findConflicts,
  detectConflicts: detectConflicts,
  buildChangeLog: buildChangeLog,
  appendChangeLog: appendChangeLog
};
