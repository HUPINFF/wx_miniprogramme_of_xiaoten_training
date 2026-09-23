// cloudfunctions/cleanupChildTrainings/index.js
// 一次性清理工具（用完可从云端删掉）：删除指定学员的全部 trainings 记录。
//
// 两步保险，防手滑：
//   1) event 只传 childId                → 预览：返回总数 + 前 10 条样本，不动任何数据
//   2) event 传 childId + confirm: true  → 真删：循环批量删直到删干净
//
// 只删 trainings 文档本身：hoursRecords（课时流水，涉及钱）、performance（周表现）、
// feedbacks、云存储里的照片视频文件都不动——要连带清理另说。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const COLLECTION = 'trainings';

exports.main = async (event) => {
  const childId = event && event.childId;
  if (!childId) {
    return { success: false, error: '缺少 childId 参数' };
  }

  const where = { childId: childId };

  try {
    const { total } = await db.collection(COLLECTION).where(where).count();

    // 预览模式：只统计 + 抽 10 条样本给人眼确认
    if (!event.confirm) {
      const { data: sample } = await db.collection(COLLECTION)
        .where(where)
        .limit(10)
        .get();
      return {
        success: true,
        mode: 'preview',
        childId,
        total,
        sample: sample.map(t => ({
          _id: t._id, date: t.date, startTime: t.startTime,
          name: t.name, status: t.status
        })),
        hint: '确认无误后，带 confirm:true 再调一次执行删除'
      };
    }

    // 确认模式：循环批量删。单轮 where().remove() 若有上限，循环兜底直到删空
    let removedTotal = 0;
    for (let round = 0; round < 200; round++) {
      const res = await db.collection(COLLECTION).where(where).remove();
      const n = (res.stats && res.stats.deleted) || 0;
      removedTotal += n;
      if (n === 0) break;
    }

    // 复核：删完再数一遍，应为 0
    const { total: left } = await db.collection(COLLECTION).where(where).count();
    console.log('[cleanupChildTrainings] childId', childId, '删除', removedTotal, '条，剩余', left);

    return { success: true, mode: 'delete', childId, removedTotal, remaining: left };
  } catch (err) {
    console.error('[cleanupChildTrainings] 执行失败', err);
    return { success: false, error: err.message };
  }
};
