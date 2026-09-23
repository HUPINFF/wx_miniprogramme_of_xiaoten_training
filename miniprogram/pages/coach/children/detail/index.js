// pages/coach/children/detail/index.js
const auth = require('../../../../utils/auth');
const { summarizeAbilityGroups } = require('../../../../utils/helper');

Page({

  /**
   * 页面的初始数据
   */
  data: {
    childInfo: null,
    performanceList: [],
    trainingList: [],
    feedbackList: [],
    upcomingTrainings: [],  // 未来要上的课（提醒卡，无课整卡隐藏）
    upcomingTotal: 0,
    recentReports: [],      // 成长报告版块：最近 3 份（草稿+已发布）
    perfMode: 'metrics',   // 近期表现展示层：metrics=体测成绩固定指标 / items=训练项目（教练自定义）
    customItems: [],       // 训练项目层：trainings.items 按项目名聚合
    showAllCustomItems: false, // 训练项目层默认只展示前 5 个，查看全部后展开
    // 学员档案卡（学员卡片下方，左右两栏）
    basicRows: [],      // 左侧：年龄/身高/体重
    goalText: '暂无',   // 左侧：训练目标（children.goal，教练点目标行可编辑）
    abilityRows: [],    // 右侧：基础能力（按能力域归组的概览）
    specialty: null,    // 右侧：专项成绩（最近一次体质测评的强/中/弱统计）
    loading: true,
    showHoursModal: false,
    showGoalModal: false,
  },

  onLoad(options) {
    const { id } = options
    // 存下来给下拉刷新用：刷新时 this.data.childInfo 可能还是 null
    this.childId = id;
    if (id) {
      this.loadChildDetail(id);
    }
  },

  /** 返回上一页；直接打开本页（无上一页）时回教练工作台（教练端 tab 页靠 reLaunch 清栈） */
  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({ url: '/pages/coach/workbench/index' });
    }
  },

  loadChildDetail(childId) {
    this.setData({ loading: true });

    const db = wx.cloud.database();

    // 先单独取学员记录做归属校验，通过了再去拉成绩/训练/反馈。
    // 不能把它塞回下面的 Promise.all —— 那样即使校验不过，另外三个集合也已经读出来了。
    //
    // 这里直接用 canViewChild + denyAndLeave，而不是 auth.guardChildAccess：
    // 本页本来就要留这条 children 记录当 childInfo，再让 guardChildAccess 查一遍是白跑一次请求。
    return db.collection('children').doc(childId).get().then(childRes => {
      if (!auth.canViewChild(childRes.data, auth.getCoachId())) {
        console.warn('越权访问学员详情，已拦截', childId);
        auth.denyAndLeave('无权查看该学员');
        return null;
      }

      return Promise.all([
        this.loadPerformanceHistory(childId),
        this.loadTrainingHistory(childId),
        this.loadFeedbackHistory(childId),
        this.loadLatestAssessment(childId),
        this.loadUpcomingTrainings(childId),
        this.loadReports(childId),
        this.loadCustomItems(childId)
      ]).then(([performanceList, trainingData, feedbackData, latestAssessment, upcomingData, recentReports, customItems]) => {
        this.composeInfoCard(childRes.data, performanceList, latestAssessment);
        this.setData({
          childInfo: childRes,
          performanceList: performanceList,
          trainingList: trainingData,
          feedbackList: feedbackData,
          upcomingTrainings: this.formatUpcomingList(upcomingData.list),
          upcomingTotal: upcomingData.total,
          recentReports: recentReports,
          customItems: customItems,
          loading: false
        })
      });
    }).catch(err => {
      console.error('加载孩子详情失败', err);
      wx.showToast({ title: '加载失败', icon: "none" })
      this.setData({ loading: false });
    });
  },

  editHours() {
    this.setData({ showHoursModal: true });
  },

  closeHoursModal() {
    this.setData({ showHoursModal: false });
  },

  onHoursInput(e) {
    this.setData({ tempHours: e.detail.value });
  },

  onConfirmHours(e) {
    const { childId, remainingHours } = e.detail;
    const oldHours = this.data.childInfo.data.remainingHours || 0;
    const changeAmount = remainingHours - oldHours;

    wx.showLoading({ title: '保存中...' });

    const db = wx.cloud.database();
    db.collection('children').doc(childId).update({
      data: {
        remainingHours: remainingHours,
        updatedAt: new Date()
      }
    }).then(() => {
      if (changeAmount !== 0) {
        const type = changeAmount > 0 ? 'income' : 'expense';
        const amount = Math.abs(changeAmount);
        const description = changeAmount > 0 ? `充值 ${amount} 课时` : `扣减 ${amount} 课时`;
        return this.addHoursRecord(childId, type, amount, description);
      }
      return Promise.resolve();
    }).then(() => {
      const updatedChildInfo = this.data.childInfo;
      updatedChildInfo.data.remainingHours = remainingHours;
      this.setData({
        childInfo: updatedChildInfo,
        showHoursModal: false
      });
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
    }).catch(err => {
      console.error('保存学时失败', err);
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    });
  },

  addHoursRecord(childId, type, amount, description) {
    const db = wx.cloud.database();
    return db.collection('hoursRecords').add({
      data: {
        childId: childId,
        type: type,
        amount: amount,
        description: description,
        createdAt: new Date()
      }
    }).then(res => {
      console.log('课时记录添加成功:', res);
      return res;
    }).catch(err => {
      console.error('课时记录添加失败', err);
      return err;
    });
  },

  loadPerformanceHistory(childId) {
    const db = wx.cloud.database()
    return db.collection('performance').where({
      childId: childId
    }).orderBy('weekDate', 'desc').get().then(res => {
      return res.data;
    })
  },

  loadTrainingHistory(childId) {
    const db = wx.cloud.database();
    return db.collection('trainings').where({
      childId: childId
    }).orderBy('date', 'desc').limit(2).get().then(res => {
      return res.data;
    });
  },

  /** 近期表现切换：体测成绩（performance 固定指标）⇄ 训练项目（trainings.items 聚合）。
      两层数据都随页面加载好了，切换只翻开关 */
  switchPerfMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode === this.data.perfMode) return;
    this.setData({ perfMode: mode });
  },

  /** 训练项目层：默认展示前 5 个，这里就地展开/收起全部 */
  toggleShowAllItems() {
    this.setData({ showAllCustomItems: !this.data.showAllCustomItems });
  },

  /**
   * 自定义训练项目聚合（近期表现第二个展示层的数据源）：
   * 教练排课时自己定义的项目存在 trainings.items（{name, done, sets, reps,
   * performance(上课填的本次表现)}），与固定指标的 performance 是两套数据
   * （家长端成长页同理）。
   * 按项目名聚合近12周 finished 课次：练了几次、最近一次的量与日期、上次是否完成、
   * 最近一条非空的表现文字，以及 AI 从表现里抽的成绩数值算出的两次对比（进步/退步）。
   * fail-soft：查询失败返回空数组，训练项目层显示空态，不阻塞整页。
   */
  loadCustomItems(childId) {
    const db = wx.cloud.database();
    return db.collection('trainings').where({
      childId: childId,
      status: 'finished',
      date: db.command.gte(this.getDateStringDaysAgo(83))
    }).orderBy('date', 'desc').limit(20).get().then(res => {
      const map = {};
      res.data.forEach(training => {
        (training.items || []).forEach(item => {
          if (!item || !item.name) return;
          if (!map[item.name]) {
            map[item.name] = { name: item.name, times: 0, lastDone: true, lastAmount: '', lastDate: '', lastPerf: '', points: [] };
          }
          const agg = map[item.name];
          agg.times += 1;
          // 列表按日期倒序，首个遇到的即最近一次
          if (!agg.lastDate) {
            agg.lastDone = item.done !== false;
            agg.lastAmount = this.formatItemAmount(item.sets, item.reps);
            agg.lastDate = this.formatItemDate(training.date);
          }
          // 表现取最近一条非空的（教练可能某几节课没填，不能被空值顶掉）
          if (!agg.lastPerf && item.performance) agg.lastPerf = item.performance;
          // AI 抽的成绩数值进点集（算两次对比；points 按 date 倒序，[0] 最新、[1] 上一次）
          if (item.metric && isFinite(item.metric.value)) {
            agg.points.push({
              value: Number(item.metric.value),
              display: item.metric.display || '',
              kind: item.metric.unitKind === 'time' ? 'time' : 'count'
            });
          }
        });
      });
      return Object.keys(map).map(name => {
        const agg = map[name];
        const amountText = agg.lastAmount ? ' · ' + agg.lastAmount : '';
        const aggOut = {
          name: agg.name,
          times: agg.times,
          timesText: '近12周 ' + agg.times + ' 次',
          lastSub: agg.lastDate ? '最近' + amountText + ' · ' + agg.lastDate : '',
          lastDone: agg.lastDone,
          lastPerf: agg.lastPerf
        };
        // 进步对比：同一项目至少两次成绩才可比。count 类越大越好，time 类（秒）越小越好
        const pts = agg.points || [];
        if (pts.length >= 2) {
          const last = pts[0];
          const prev = pts[1];
          const diff = last.value - prev.value;
          const better = diff === 0 ? null : (last.kind === 'time' ? diff < 0 : diff > 0);
          aggOut.lastDelta = {
            text: '上次 ' + (prev.display || prev.value) + ' → 本次 ' + (last.display || last.value) +
              (better === null ? ' 持平' : (better ? ' ↑' : ' ↓')),
            better: better
          };
        }
        return aggOut;
      }).sort((a, b) => b.times - a.times);
    }).catch(err => {
      console.error('加载自定义训练项目失败', err);
      return [];
    });
  },

  /** 组数/个数展示：都填「3组×12次」，只填一边取那边（与家长端成长页同一口径） */
  formatItemAmount(sets, reps) {
    const s = parseInt(sets, 10);
    const r = parseInt(reps, 10);
    if (s > 0 && r > 0) return s + '组×' + r + '次';
    if (s > 0) return s + '组';
    if (r > 0) return r + '次';
    return '';
  },

  /** 'YYYY-MM-DD' → 'M/D'（项目行的小日期标） */
  formatItemDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    return parseInt(parts[1], 10) + '/' + parseInt(parts[2], 10);
  },

  /** days 天前的本地日期 'YYYY-MM-DD'（trainings.date 字符串可直接比大小） */
  getDateStringDaysAgo(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    const pad = (n) => (n < 10 ? '0' + n : '' + n);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  },

  /** 今天 'YYYY-MM-DD'（trainings.date 就是 picker 写入的这个格式，字符串可直接比大小） */
  todayStr() {
    const d = new Date();
    const pad = (n) => (n < 10 ? '0' + n : '' + n);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  },

  /**
   * 未来要上的课：date >= 今天 且状态不是 finished（pending/in_class 都算），
   * 按日期+开始时间升序取最近 3 条，另带总数给「待上 N 节」角标。
   * fail-soft：查询失败返回空，卡片整体隐藏，不阻塞页面。
   */
  loadUpcomingTrainings(childId) {
    const db = wx.cloud.database();
    const _ = db.command;
    const cond = {
      childId: childId,
      date: _.gte(this.todayStr()),
      status: _.neq('finished')
    };
    return Promise.all([
      db.collection('trainings').where(cond)
        .orderBy('date', 'asc').orderBy('startTime', 'asc').limit(3).get(),
      db.collection('trainings').where(cond).count()
    ]).then(([res, cnt]) => {
      return { list: res.data || [], total: (cnt && cnt.total) || 0 };
    }).catch(err => {
      console.error('加载近期课程失败', err);
      return { list: [], total: 0 };
    });
  },

  /** 提醒卡行数据：日期转「今天/明天/M月D日」，只留展示要用的字段 */
  formatUpcomingList(list) {
    const today = this.todayStr();
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const pad = (n) => (n < 10 ? '0' + n : '' + n);
    const tomorrow = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

    return (list || []).map(t => {
      let dateLabel = t.date || '';
      if (t.date === today) {
        dateLabel = '今天';
      } else if (t.date === tomorrow) {
        dateLabel = '明天';
      } else {
        const parts = (t.date || '').split('-');
        if (parts.length === 3) {
          dateLabel = parseInt(parts[1], 10) + '月' + parseInt(parts[2], 10) + '日';
        }
      }
      return {
        _id: t._id,
        dateLabel: dateLabel,
        startTime: t.startTime || '',
        name: t.name || '',
        type: t.type || ''
      };
    });
  },

  /** 成长报告版块：最近 3 份（草稿+已发布），点行进报告详情，入口卡负责生成 */
  loadReports(childId) {
    const db = wx.cloud.database();
    return db.collection('reports').where({ childId: childId }).orderBy('updatedAt', 'desc').limit(3).get()
      .then(res => {
        return (res.data || []).map(r => {
          let updatedText = '';
          if (r.updatedAt) {
            const d = new Date(r.updatedAt);
            updatedText = (d.getMonth() + 1) + '月' + d.getDate() + '日更新';
          }
          return {
            _id: r._id,
            title: (r.periodLabel || '') + ' · ' + (r.type === 'quarterly' ? '季报' : '月报'),
            status: r.status || 'draft',
            updatedText: updatedText
          };
        });
      })
      .catch(err => {
        console.error('加载成长报告失败', err);
        return [];
      });
  },

  loadFeedbackHistory(childId) {
    const db = wx.cloud.database();
    return db.collection('feedbacks').where({
      childId: childId
    }).orderBy('date', 'desc').limit(5).get().then(res => {
      return res.data;
    })
  },

  /**
   * 最近一次体质测评：身高/体重与专项动作模式的来源。
   * 测评是按月 upsert 的（assessments，childId+year+month 唯一），
   * 取最新一条即可。fail-soft：查不到/查询失败都返回 null，档案卡显示「暂无」。
   */
  loadLatestAssessment(childId) {
    const db = wx.cloud.database();
    return db.collection('assessments').where({
      childId: childId
    }).orderBy('createdAt', 'desc').limit(1).get().then(res => {
      return (res.data && res.data.length) ? res.data[0] : null;
    }).catch(err => {
      console.error('加载体质测评失败', err);
      return null;
    });
  },

  /**
   * 学员档案卡（学员卡片下方左右两栏）的数据组合：
   * 左侧——年龄来自 children；身高/体重取最近一次体质测评的体测数据（这两个
   * 值记录在 assessments.basicInfo，不在 children 上）；目标是 children.goal
   * （教练点目标行就地编辑，没值时显示「暂无」）。
   * 右侧——基础能力把最近两次周测评按能力域归组（helper 里有单测的纯函数），
   * 只展示速度/耐力/力量三个域（柔韧、协调灵敏不放详情页概览），
   * 每组取第一个有数据的指标做代表；专项成绩取最近一次体质测评的
   * 专项动作模式强/中/弱统计 + 综合评定。
   * 全部 fail-soft：任何一块没数据就显示「暂无」，不阻塞页面。
   */
  composeInfoCard(child, performanceList, assessment) {
    // 左侧：基本信息
    const basicInfo = (assessment && assessment.basicInfo) ? assessment.basicInfo : null;
    const basicRows = [
      { label: '年龄', value: child.age ? child.age + '岁' : '暂无' },
      { label: '身高', value: (basicInfo && basicInfo.height) ? basicInfo.height + 'cm' : '暂无' },
      { label: '体重', value: (basicInfo && basicInfo.weight) ? basicInfo.weight + 'kg' : '暂无' }
    ];
    const goalText = (child.goal && String(child.goal).trim()) ? String(child.goal).trim() : '暂无';

    // 右侧：基础能力（最近两次周测评 → 能力域，每组取代表指标）
    // 详情页概览只留速度/耐力/力量三项：柔韧、协调灵敏在概览里信息密度低，
    // 还会把档案卡撑得很高（右栏比左栏长出一截）；单项细节去成长页和体质测评看。
    const overviewKeys = ['speed', 'endurance', 'strength'];
    const groups = summarizeAbilityGroups((performanceList || []).slice(0, 2))
      .filter(group => overviewKeys.indexOf(group.key) !== -1);
    const abilityRows = groups.map(group => {
      const primary = group.metrics.find(m => m.hasData);
      return {
        key: group.key,
        icon: group.icon,
        name: group.name,
        empty: !primary,
        metricName: primary ? primary.name : '',
        valueText: primary ? primary.valueText : '',
        deltaText: (primary && primary.deltaText) ? primary.deltaText : '',
        isImprovement: primary ? primary.isImprovement : null
      };
    });

    // 右侧：专项成绩（专项动作模式 强/中/弱 计数 + 综合评定）
    let specialty = null;
    if (assessment && assessment.actionPatterns) {
      const counts = { '强': 0, '中': 0, '弱': 0 };
      Object.keys(assessment.actionPatterns).forEach(k => {
        const v = assessment.actionPatterns[k];
        if (v === '强' || v === '中' || v === '弱') counts[v] += 1;
      });
      specialty = {
        month: assessment.assessmentMonth || '',
        rating: assessment.overallRating || '',
        strong: counts['强'],
        mid: counts['中'],
        weak: counts['弱']
      };
    }

    this.setData({
      basicRows: basicRows,
      goalText: goalText,
      abilityRows: abilityRows,
      specialty: specialty
    });
  },

  /** 点目标行 → 打开自建的目标编辑弹窗（多行输入/常用标签/字数统计） */
  editGoal() {
    const child = this.data.childInfo && this.data.childInfo.data;
    if (!child) return;
    this.setData({ showGoalModal: true });
  },

  closeGoalModal() {
    this.setData({ showGoalModal: false });
  },

  /** 弹窗确认 → 走保存；成功才关弹窗，失败留在弹窗里可改可重试 */
  onGoalConfirm(e) {
    this.saveGoal((e.detail && e.detail.value) || '');
  },

  /** 保存目标：截到 60 字，落库成功后只同步本地这一处，不整页重拉 */
  saveGoal(value) {
    const goal = String(value).trim().slice(0, 60);
    const childId = this.data.childInfo.data._id;
    const db = wx.cloud.database();

    wx.showLoading({ title: '保存中...' });
    db.collection('children').doc(childId).update({
      data: {
        goal: goal,
        updatedAt: new Date()
      }
    }).then(() => {
      const childInfo = this.data.childInfo;
      childInfo.data.goal = goal;
      this.setData({
        childInfo: childInfo,
        goalText: goal || '暂无',
        showGoalModal: false
      });
      wx.hideLoading();
      wx.showToast({ title: '已保存', icon: 'success' });
    }).catch(err => {
      console.error('保存目标失败', err);
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    });
  },

  addPerformance() {
    wx.navigateTo({
      url: `/pages/coach/performance/weekly/index?childId=${this.data.childInfo.data._id}`
    });
  },

  writeFeedback() {
    wx.navigateTo({
      url: `/pages/coach/feedback/write/index?childId=${this.data.childInfo.data._id}`
    })
  },

  addTraining() {
    wx.navigateTo({
      url: `/pages/coach/trainings/edit/index?childId=${this.data.childInfo.data._id}`
    })
  },

  goToAssessment() {
    wx.navigateTo({
      url: `/pages/coach/assessment/edit/index?childId=${this.data.childInfo.data._id}&childName=${this.data.childInfo.data.name}`
    });
  },

  viewAlbum() {
    console.log('viewAlbum called');
    wx.showToast({ title: '跳转到相册', icon: 'none' });
    wx.navigateTo({
      url: `/pages/coach/children/album/index?childId=${this.data.childInfo.data._id}&childName=${this.data.childInfo.data.name}`
    });
  },

  viewTrainingDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/coach/training-detail/index?id=${id}`
    });
  },

  editTraining(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/coach/trainings/edit/index?id=${id}`
    });
  },

  viewAllPerformance() {
    wx.navigateTo({
      url: `/pages/coach/performance/list/index?childId=${this.data.childInfo.data._id}&childName=${this.data.childInfo.data.name}`
    })
  },

  viewAllTrainings() {
    wx.navigateTo({
      url: `/pages/coach/trainings/list/index?childId=${this.data.childInfo.data._id}&childName=${this.data.childInfo.data.name}`
    });
  },

  viewAllFeedbacks() {
    wx.navigateTo({
      url: `/pages/coach/feedback/list/index?childId=${this.data.childInfo.data._id}&childName=${this.data.childInfo.data.name}`
    });
  },

  /** 生成成长报告：月报/季报进同一个编辑器，type 由入口决定 */
  goCreateReport(e) {
    const type = e.currentTarget.dataset.type === 'quarterly' ? 'quarterly' : 'monthly';
    wx.navigateTo({
      url: `/pages/coach/reports/edit/index?childId=${this.data.childInfo.data._id}&type=${type}`
    });
  },

  viewReport(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/coach/reports/detail/index?id=${id}`
    });
  },

  viewPerformanceDetail(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/coach/performance/detail/index?id=${id}&childName=${this.data.childInfo.data.name}`
    });
  },

  onReady() {
  },

  onShow() {
    // 从报告编辑器返回时刷新最近报告列表（只补这一块，不整页重拉）
    if (this.childId && this.data.childInfo) {
      this.loadReports(this.childId).then(list => {
        this.setData({ recentReports: list });
      });
    }
  },

  onHide() {
  },

  onUnload() {
  },

  onPullDownRefresh() {
    // 原来调的是 this.loadPerformanceData / this.loadChildData —— 这两个方法在本页
    // 根本不存在，下拉刷新必抛 TypeError，还得手动把下拉动画收回去。
    const childId = this.childId;

    if (!childId) {
      wx.stopPullDownRefresh();
      return;
    }

    // loadChildDetail 内部是「先校验归属再拉数据」，刷新走同一条路径即可
    this.loadChildDetail(childId).then(() => {
      wx.stopPullDownRefresh();
    }).catch(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
  },

  onShareAppMessage() {
  }
})
