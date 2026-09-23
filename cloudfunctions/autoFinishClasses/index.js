// cloudfunctions/autoFinishClasses/index.js
// 定时兜底：过了当天还挂在「上课中」的课，自动置为 finished 并扣 1 课时。
//
// 为什么放云端定时器：小程序端只有教练打开页面才有代码在跑，教练不开小程序
// 僵尸课就永远挂着；定时触发器（config.json triggers）不依赖任何人操作。
//
// 扫描口径：status === 'in_class' 且 date < 今天（北京时间）。不限是否盖过
// classEndedAt——「忘了点下课」和「点了下课没完成记录」挂过夜都算僵尸课，
// 课确实上过了，就该结课结算。
//
// 课时口径与 post-class 完成记录一致：每节扣 1（不看 trainingHours，remainingHours
// 允许扣成负数）；children.remainingHours 用 _.inc(-1) 原子自减（缺失按 0），
// 并写 hoursRecords(expense) 流水，description 带上「超时自动结算」标记区分手结。
//
// 顺序刻意是「先置 finished，再扣课时」：中途崩溃最多漏扣一节（doc 已 finished，
// 下一轮不会重扫），绝不会双扣——多扣家长的钱比漏扣一节严重得多。
//
// 扣完课时不发家长通知：订阅消息需要家长授权且有对应模板，自动结算的通知另立任务。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

// 今天的北京时间日期串（云函数跑在 UTC，+8h 归一到北京时区；trainings.date 就是这种格式）
function getBeijingDateString() {
  const d = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// 北京时间显示（日志用）
function formatBeijingNow() {
  const d = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

exports.main = async () => {
  const today = getBeijingDateString();
  console.log('[autoFinishClasses] 北京时间', formatBeijingNow(), '，扫描 date <', today, '的上课中僵尸课');

  try {
    // 服务端单次 get 上限 100 条；正常每天个位数。历史积压超 100 时本轮处理 100，
    // 处理完的下一轮被排除（已 finished），后续轮次逐小时收敛。
    const { data: zombies } = await db.collection('trainings').where({
      status: 'in_class',
      date: _.lt(today)
    }).get();

    if (!zombies.length) {
      return { success: true, found: 0, finished: 0, deducted: 0, beijingDate: today };
    }

    console.log('[autoFinishClasses] 待自动下课', zombies.length, '节：',
      zombies.map(t => `${t.date} ${t.startTime || ''} ${t.childName || t.childId || t._id}`).join('；'));

    let finishedCount = 0;
    let deductedCount = 0;
    let failedCount = 0;

    for (const training of zombies) {
      try {
        // 1) 先把这一节置 finished + autoFinishedAt 标记。updated !== 1 说明被教练
        //    并发处理过（正好在完成记录），让位，不扣课时。
        const upd = await db.collection('trainings').doc(training._id).update({
          data: {
            status: 'finished',
            autoFinishedAt: db.serverDate(),
            updatedAt: db.serverDate()
          }
        });
        if (!upd.stats || upd.stats.updated !== 1) {
          console.log('[autoFinishClasses] 跳过（已被并发处理）:', training._id);
          continue;
        }
        finishedCount++;

        // 2) 扣课时：inc(-1) 原子自减 + hoursRecords 流水（比客户端流水多带 trainingId 便于对账）
        await deductOne(training);
        deductedCount++;
        console.log('[autoFinishClasses] 已自动下课并扣课时:', training._id, training.childName || training.childId);
      } catch (err) {
        // 单节失败不拖垮整轮：课已 finished 时漏扣只影响这一节，日志留痕人工核对
        failedCount++;
        console.error('[autoFinishClasses] 处理失败:', training._id, err);
      }
    }

    console.log('[autoFinishClasses] 本轮结束 置finished', finishedCount, '扣课时', deductedCount, '失败', failedCount);
    return { success: true, found: zombies.length, finished: finishedCount, deducted: deductedCount, failed: failedCount, beijingDate: today };
  } catch (err) {
    console.error('[autoFinishClasses] 执行失败', err);
    return { success: false, error: err.message, beijingDate: today };
  }
};

// 扣 1 课时：children.remainingHours inc(-1) + hoursRecords expense 流水。
// 口径与 post-class.deductHours 一致：固定扣 1，不看 trainingHours；字段缺失按 0，允许负数。
async function deductOne(training) {
  const childId = training.childId;
  if (!childId) throw new Error('缺少 childId，无法扣课时');

  await db.collection('children').doc(childId).update({
    data: {
      remainingHours: _.inc(-1),
      updatedAt: db.serverDate()
    }
  });

  await db.collection('hoursRecords').add({
    data: {
      childId: childId,
      trainingId: training._id,
      type: 'expense',
      amount: 1,
      description: `训练课程: ${training.name || '训练'}扣减（超时自动结算）`,
      createdAt: db.serverDate()
    }
  });
}
