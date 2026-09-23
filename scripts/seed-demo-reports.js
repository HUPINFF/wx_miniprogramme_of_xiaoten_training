(async function () {
  var db = wx.cloud.database();
  var openid = wx.getStorageSync('openid');
  if (!openid) { console.error('未登录：先在小程序里登录一次再跑'); return; }
  var kids = await db.collection('children').where({ parentOpenId: openid }).get();
  var child = kids.data[0];
  if (!child) { console.error('当前账号名下没有孩子档案：先在家长端建一个孩子，再重跑'); return; }
  var photos = [], videos = [];
  try {
    var pa = await db.collection('photosAvideos').where({ childId: child._id }).orderBy('yearMonth', 'desc').limit(1).get();
    if (pa.data.length) { photos = (pa.data[0].photos || []).slice(0, 6); videos = (pa.data[0].videos || []).slice(0, 1); }
  } catch (e) { console.warn('照片档案读取失败，精彩证据留空'); }
  var goal = child.goal || '备战体测';
  var now = Date.now();
  function abilityData() {
    return {
      rows: [
        { key: 'speed', name: '速度', icon: '🏃', hasData: true, metricName: '50米', valueText: '8.5秒', firstText: '9.2秒', deltaText: '快0.7秒', isImprovement: true },
        { key: 'endurance', name: '耐力', icon: '🫁', hasData: true, metricName: '肺活量', valueText: '2100ml', firstText: '1950ml', deltaText: '多150ml', isImprovement: true },
        { key: 'strength', name: '力量', icon: '💪', hasData: true, metricName: '仰卧起坐', valueText: '35个', firstText: '28个', deltaText: '多7个', isImprovement: true },
        { key: 'flexibility', name: '柔韧', icon: '🧘', hasData: true, metricName: '坐位体前屈', valueText: '12厘米', firstText: '', deltaText: '', isImprovement: null },
        { key: 'agility', name: '协调灵敏', icon: '⚡', hasData: true, metricName: '跳绳', valueText: '120个', firstText: '110个', deltaText: '多10个', isImprovement: true }
      ],
      bodyRows: [
        { key: 'height', label: '身高', valueText: '131cm', deltaText: '+3cm', improved: true },
        { key: 'weight', label: '体重', valueText: '26.5kg', deltaText: '+1.5kg', improved: true }
      ]
    };
  }
  function baseReport(type, label, ps, pe, sTs, eTs, y, m, q) {
    return {
      childId: child._id,
      childName: child.name || '测试孩子',
      parentOpenId: openid,
      coachId: 'demo-coach',
      type: type, year: y, month: m, quarter: q,
      periodStart: ps, periodEnd: pe, periodLabel: label,
      startTs: sTs, endTs: eTs,
      status: 'published',
      sections: [
        { kind: 'stats', title: '本期完成', source: 'auto', data: { finishedCount: 12, hoursUsed: 12, typeCounts: [{ type: '速度', count: 5 }, { type: '耐力', count: 4 }, { type: '常规训练', count: 3 }] }, empty: false },
        { kind: 'ability', title: '能力变化', source: 'auto', data: abilityData(), empty: false },
        { kind: 'photos', title: '精彩证据', source: 'coach', fileIDs: photos, videos: videos },
        { kind: 'comment', title: '教练点评', source: 'coach', content: '本期训练态度非常积极，50米从9秒2进步到8秒5，起跑反应明显变快；课堂指令执行力强，动作完成质量高。', tags: ['出勤稳定', '动作标准', '速度进步快'] },
        { kind: 'plan', title: '下阶段计划', source: 'coach', content: '围绕「' + goal + '」继续推进：速度课加入追逐游戏强化起跑爆发，力量课增加自重核心练习，每两周做一次小测。', tags: ['速度强化', '核心力量'], goal: goal },
        { kind: 'action', title: '家长行动', source: 'coach', content: '每周固定2次课后拉伸各10分钟；保证21:30前入睡；周末可安排一次30分钟慢跑 + 跳绳组合。', tags: ['拉伸打卡', '早睡'] }
      ],
      updatedAt: new Date(now)
    };
  }
  var monthly = baseReport('monthly', '2026年8月', '2026-08-01', '2026-08-31', new Date(2026, 7, 1).getTime(), new Date(2026, 7, 31, 23, 59, 59, 999).getTime(), 2026, 8, null);
  var quarterly = baseReport('quarterly', '2026年三季度（7-9月）', '2026-07-01', '2026-09-30', new Date(2026, 6, 1).getTime(), new Date(2026, 8, 30, 23, 59, 59, 999).getTime(), 2026, null, 3);
  quarterly.updatedAt = new Date(now - 60000);
  await db.collection('reports').add({ data: monthly });
  await db.collection('reports').add({ data: quarterly });
  console.log('OK 已创建 2 份测试报告，绑在「' + (child.name || '测试孩子') + '」名下');
  console.log('下一步：家长端 → 蜕变 → 成长报告');
})().catch(function (e) { console.error('创建失败：', e); });
