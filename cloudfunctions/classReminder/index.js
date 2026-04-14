// cloudfunctions/classReminder/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

// ==================== 时间工具函数（修复版）====================

// 获取当前时间（UTC 时间戳，云函数运行环境就是 UTC）
function getNow() {
  return new Date();
}

// 将数据库里的北京时间字符串，转换为 UTC Date 对象用于比较
// dateStr: "2026-04-07" (北京时间日期)
// timeStr: "17:00" (北京时间)
// 返回：对应的 UTC Date 对象
function parseBeijingTimeToUTC(dateStr, timeStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  // 北京时间 = UTC + 8
  // 所以北京时间 17:00 = UTC 09:00
  // Date.UTC 创建的是 UTC 时间，我们传入北京时间的小时数，需要减去 8 得到 UTC
  const utcHours = hours - 8;
  
  return new Date(Date.UTC(year, month - 1, day, utcHours, minutes, 0));
}

// 格式化日期时间（用于日志显示）
function formatDateTime(date) {
  const d = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// 获取今天的北京时间日期字符串（用于数据库查询）
function getBeijingDateString() {
  const now = new Date();
  const d = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ==================== 主函数 ====================

exports.main = async (event, context) => {
  const startTime = getNow();
  console.log('========== 定时任务开始 ==========');
  console.log('当前 UTC 时间:', startTime.toISOString());
  console.log('当前北京时间:', formatDateTime(startTime));
  
  const today = getBeijingDateString();
  console.log('今天的日期(北京):', today);
  
  try {
    // 查询今天未提醒的训练
    const { data: trainings } = await db.collection('trainings')
      .where({
        date: today,
        startTime: _.exists(true),
        startTime: _.neq(''),
        reminded: _.neq(true)
      })
      .get();
    
    console.log(`找到 ${trainings.length} 条今天的待提醒训练`);
    
    if (trainings.length === 0) {
      return { 
        success: true, 
        message: '没有需要提醒的训练', 
        beijingTime: formatDateTime(startTime),
        beijingDate: today
      };
    }
    
    // 筛选出 1 小时内即将开始的训练
    const toRemind = [];
    
    for (const training of trainings) {
      if (!training.startTime || training.reminded) continue;
      
      try {
        // 将训练时间（北京时间）转换为 UTC 时间
        const trainingUTC = parseBeijingTimeToUTC(training.date, training.startTime);
        const nowUTC = getNow();
        
        // 计算差值（毫秒）
        const diffMs = trainingUTC - nowUTC;
        const diffMinutes = Math.floor(diffMs / (60 * 1000));
        
        console.log(`训练: ${training.childName || '未知'}`);
        console.log(`  训练时间(北京): ${training.date} ${training.startTime}`);
        console.log(`  训练时间(UTC): ${trainingUTC.toISOString()}`);
        console.log(`  当前时间(UTC): ${nowUTC.toISOString()}`);
        console.log(`  距离开始还有: ${diffMinutes} 分钟`);
        
        // 0-60 分钟内开始的训练需要提醒
        if (diffMs > 0 && diffMs <= 60 * 60 * 1000) {
          toRemind.push({
            ...training,
            diffMinutes
          });
          console.log(`✅ 加入提醒列表: ${training.childName || '未知'}`);
        } else if (diffMs <= 0) {
          console.log(`⏰ 已过期，跳过: ${training.childName || '未知'}`);
        } else {
          console.log(`⏳ 时间还早，跳过: ${training.childName || '未知'}`);
        }
      } catch (err) {
        console.error(`解析训练时间失败: ${training._id}`, err);
      }
    }
    
    console.log(`需要提醒的训练: ${toRemind.length} 条`);
    
    // 发送提醒
    let successCount = 0;
    let failCount = 0;
    const results = [];
    
    for (const training of toRemind) {
      try {
        const result = await sendReminder(training);
        
        if (result.success) {
          successCount++;
          // 标记为已提醒
          await db.collection('trainings').doc(training._id).update({
            data: { 
              reminded: true, 
              remindedAt: db.serverDate()
            }
          });
          console.log(`✅ 提醒发送成功: ${training.childName || '未知'}`);
          results.push({ id: training._id, name: training.childName, status: 'success' });
        } else {
          failCount++;
          console.log(`❌ 提醒发送失败: ${training.childName || '未知'} - ${result.error}`);
          results.push({ id: training._id, name: training.childName, status: 'failed', error: result.error });
        }
      } catch (err) {
        failCount++;
        console.error(`发送提醒异常: ${training._id}`, err);
        results.push({ id: training._id, name: training.childName, status: 'error', error: err.message });
      }
    }
    
    const endTime = getNow();
    const duration = endTime - startTime;
    
    console.log('========== 定时任务结束 ==========');
    console.log(`总计: ${toRemind.length}, 成功: ${successCount}, 失败: ${failCount}, 耗时: ${duration}ms`);
    
    return { 
      success: true, 
      summary: {
        total: toRemind.length,
        sent: successCount,
        failed: failCount,
        duration: duration
      },
      details: results,
      beijingTime: formatDateTime(startTime),
      beijingDate: today
    };
    
  } catch (err) {
    console.error('定时任务失败:', err);
    return { 
      success: false, 
      error: err.message,
      stack: err.stack,
      beijingTime: formatDateTime(startTime)
    };
  }
};

// ==================== 发送提醒函数 ====================

async function sendReminder(training) {
  try {
    // 获取孩子信息
    const { data: child } = await db.collection('children').doc(training.childId).get();
    
    if (!child) {
      return { success: false, error: '未找到孩子信息' };
    }
    
    const parentOpenId = child.parentOpenId || child.parentOpenid || child.openid;
    
    if (!parentOpenId) {
      return { success: false, error: '没有家长openid' };
    }
    
    // 模板消息配置
    const templateId = 'QwUWqkFpZ6hYjH7tT52eTMs-koscqMvlgael3ZDIFBw';
    const startDateTime = `${training.date} ${training.startTime}`;
    
    // 构建模板数据
    const templateData = {
      time2: { value: startDateTime },
      thing3: { value: training.name || '体能训练' },
      name4: { value: training.coachName || '教练' }
    };
    
    console.log('发送模板消息:', JSON.stringify({
      touser: parentOpenId,
      templateId: templateId,
      page: `pages/users/training-detail/index?id=${training._id}`,
      data: templateData
    }));
    
    // 发送订阅消息
    const result = await cloud.openapi({
      env:cloud.DYNAMIC_CURRENT_ENV  // 显式指定环境
    }).subscribeMessage.send({
      touser: parentOpenId,
      templateId: templateId,
      page: `pages/users/training-detail/index?id=${training._id}`,
      data: templateData,
      miniprogramState: 'formal'
    });
    
    console.log('发送结果:', result);
    return { success: true, result };
    
  } catch (err) {
    console.error(`发送提醒失败: ${training._id}`, err);
    return { success: false, error: err.message || err.errMsg || '未知错误' };
  }
}