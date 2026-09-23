/**
 * 训练项目 AI 两件套的客户端薄封装（generateFeedbackAI 云函数 task 分发）：
 * - matchItemNames   保存训练前把项目名和历史写法对一对（快走200 → 快步走200米）
 * - parsePerformance 上课表现文字抽成绩数值（画成绩曲线/进步对比用）
 *
 * 全部 fail-soft：任何失败 resolve null，调用方按「AI 没帮上忙」处理——
 * 保存不被卡、上课不被打断，错误细节只在云函数日志里看。
 */

function callItemAI(task, payload) {
  return new Promise(function (resolve) {
    wx.cloud.callFunction({
      name: 'generateFeedbackAI',
      data: { task: task, payload: payload }
    }).then(function (res) {
      const r = (res && res.result) || {};
      resolve(r.success ? r : null);
    }).catch(function () {
      resolve(null);
    });
  });
}

/**
 * 项目名归一。@returns Promise<Array<{from,to}> | null>
 * 只含需要改写的条目；调用方仍需校验 to 在自己给的清单里（双保险，服务端已校过一次）。
 */
function matchItemNames(historyNames, newNames) {
  return callItemAI('matchNames', { historyNames: historyNames, newNames: newNames }).then(function (r) {
    if (!r || !Array.isArray(r.mappings)) return null;
    return r.mappings.filter(function (m) { return m && m.from && m.to; });
  });
}

/**
 * 表现文字抽数值。@returns Promise<{value,unit,unitKind:'count'|'time',display} | null>
 * 「没抽出数值」和「调用失败」都返回 null——对展示端语义等价（只显文字、不画对比）。
 */
function parsePerformance(itemName, text) {
  return callItemAI('parsePerformance', { itemName: itemName, text: text }).then(function (r) {
    return (r && r.metric) || null;
  });
}

module.exports = {
  matchItemNames: matchItemNames,
  parsePerformance: parsePerformance
};
