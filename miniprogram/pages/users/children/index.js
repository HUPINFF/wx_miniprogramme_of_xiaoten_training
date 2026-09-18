// pages/users/home/index.js
Page({

  data: {
    parentInfo: {
      nickname: '',
      avatarUrl: ''
    },
    childInfo: null,
    currentWeek: "",
    performance: {},
    weekTrainings: [],
    weeklyFeedback: {
      weekRange: '',
      list: []
    },
    loading: true,
    openid: '',
    currentAssessment: null  // 【新增】当前月体质测评
  },

  onLoad(options) {
    const userInfo = wx.getStorageSync('userInfo') || {};
    const openid = wx.getStorageSync('openid');

    this.setData({
      parentInfo: userInfo,
      openid: openid
    });

    this.initData();
  },

  onReady() {},

  onShow() {
    console.log('页面显示，重新加载数据');
    if (this.data.openid) {
      if (this.data.childInfo) {
        this.loadPerformanceData(this.data.childInfo._id);
      } else {
        this.loadChildData();
      }
    }
  },

  initData() {
    this.setCurrentWeek();
    this.setWeeklyFeedbackRange();
    this.setMonthlySummaryMonth();
    this.loadChildData();
  },

  setCurrentWeek() {
    const now = new Date();
    const monday = this.getMondayDate(now);
    const sunday = this.getSundayDate(now);
    this.setData({
      currentWeek: `${monday.month}月${monday.day}日-${sunday.month}月${sunday.day}日`
    });
  },

  setWeeklyFeedbackRange() {
    this.setData({
      "weeklyFeedback.weekRange": this.data.currentWeek
    });
  },

  setMonthlySummaryMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    this.setData({
      'monthlySummary.month': `${year}年${month}月`
    });
  },

  getMondayDate(date) {
    const monday = new Date(date);
    const day = monday.getDay() || 7;
    monday.setDate(monday.getDate() - day + 1);
    return {
      month: monday.getMonth() + 1,
      day: monday.getDate()
    };
  },

  getSundayDate(date) {
    const sunday = new Date(date);
    const day = sunday.getDay() || 7;
    sunday.setDate(sunday.getDate() + (7 - day));
    return {
      month: sunday.getMonth() + 1,
      day: sunday.getDate()
    };
  },

  loadChildData() {
    this.setData({ loading: true });

    const db = wx.cloud.database();
    const openid = this.data.openid;

    return db.collection('children').where({
      parentOpenId: openid
    }).get().then(res => {
      const children = res.data;
      console.log(children);
      if (children.length === 0) {
        this.setData({ loading: false });
        return;
      }

      const childInfo = children[0];
      this.setData({
        childInfo: childInfo
      });

      this.loadPerformanceData(childInfo._id);
    }).catch(err => {
      console.error("加载孩子数据失败", err);
      this.setData({ loading: false });
    });
  },

  loadPerformanceData(childId) {
    const db = wx.cloud.database();

    return Promise.all([
      this.loadPerformanceStats(db, childId),
      this.loadWeekTraining(db, childId),
      this.loadWeeklyFeedback(db, childId),
      this.loadMonthlySummary(db, childId),
      this.loadCurrentAssessment(childId)  // 【新增】加载体质测评
    ]).then(() => {
      this.setData({ loading: false });
    }).catch(err => {
      console.error("加载运动数据失败", err);
      this.setData({ loading: false });
    });
  },

  loadPerformanceStats(db, childId) {
    return db.collection('performance').where({
      childId: childId,
      weekDate: this.getCurrentWeekDate()
    }).get().then(res => {
      if (res.data.length > 0) {
        console.log(res.data[0]);
        this.setData({ performance: res.data[0] });
      }
    }).catch(() => {});
  },

  loadWeekTraining(db, childId) {
    return db.collection('trainings').where({
      childId: childId
    }).orderBy('date', 'asc').get().then(res => {
      if (res.data.length > 0) {
        console.log(res.data);
        this.setData({ weekTrainings: res.data });
      }
    }).catch(() => {});
  },

  loadWeeklyFeedback(db, childId) {
    const weekRange = this.getCurrentWeekRange();
    return db.collection('feedbacks').where({
      childId: childId,
      date: db.command.gte(weekRange.start).and(db.command.lte(weekRange.end))
    }).orderBy('date', 'desc').get().then(res => {
      if (res.data.length > 0) {
        this.setData({
          weeklyFeedback: {
            weekRange: this.getCurrentWeekText(),
            list: res.data
          }
        });
      }
    }).catch(() => {});
  },

  // 【新增】加载当前月体质测评
loadCurrentAssessment(childId) {
  const db = wx.cloud.database();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  return db.collection('assessments').where({
    childId: childId,
    year: currentYear,
    month: currentMonth
  }).limit(1).get().then(res => {
    if (res.data.length > 0) {
      this.setData({ currentAssessment: res.data[0] });
    } else {
      this.setData({ currentAssessment: null });
    }
  }).catch(err => {
    console.error('加载体质测评失败', err);
    this.setData({ currentAssessment: null });
  });
},

  loadMonthlySummary(db, childId) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    return db.collection('monthly_summaries').where({
      childId: childId,
      year: currentYear,
      month: currentMonth
    }).get().then(res => {
      if (res.data.length > 0) {
        this.setData({
          monthlySummary: res.data[0]
        });
      }
    }).catch(() => {});
  },

  getCurrentWeekRange() {
    const now = new Date();
    const monday = this.getMondayDate(now);
    const sunday = this.getSundayDate(now);
    const start = `${now.getFullYear()}-${String(monday.month).padStart(2, '0')}-${String(monday.day).padStart(2, '0')}`;
    const end = `${now.getFullYear()}-${String(sunday.month).padStart(2, '0')}-${String(sunday.day).padStart(2, '0')}`;
    return { start, end };
  },

  getCurrentWeekText() {
    const now = new Date();
    const monday = this.getMondayDate(now);
    const sunday = this.getSundayDate(now);
    return `${monday.month}月${monday.day}日-${sunday.month}月${sunday.day}日`;
  },

  getCurrentWeekDate() {
    const now = new Date();
    const monday = this.getMondayDate(now);
    return `${now.getFullYear()}-${String(monday.month).padStart(2, '0')}-${String(monday.day).padStart(2, '0')}`;
  },

  viewHistoryStats() {
    wx.navigateTo({
      url: `/pages/users/history-stats/index?childId=${this.data.childInfo._id || ''}`
    });
  },

  viewAllTrainings() {
    wx.navigateTo({
      url: `/pages/users/trainings/index?childId=${this.data.childInfo?._id || ''}`
    });
  },

  viewTrainingDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/coach/training-detail/index?id=${id}`
    });
  },

  viewTrainingPhotos(e) {
    const { id } = e.currentTarget.dataset;
    console.log('=======================', id);
    wx.navigateTo({
      url: `/pages/users/training-photos/index?trainingId=${id}`
    });
  },

    // 【新增】跳转到测评历史
  viewAssessmentHistory() {
    wx.navigateTo({
      url: `/pages/coach/assessment/history/index?childId=${this.data.childInfo._id}&childName=${this.data.childInfo.name}`
    });
  },

  viewAllFeedbacks() {
    wx.navigateTo({
      url: `/pages/users/my-feedback/index`
    });
  },

  refreshData() {
    this.setData({ loading: true });
    setTimeout(() => {
      this.loadMockData();
      this.setData({ loading: false });
    }, 800);
  },

  loadMockData() {
    const childInfo = {
      _id: 'child001',
      name: '张小宝',
      age: 8,
      gender: 'male',
      joinMonths: 6
    };
  },

  onPullDownRefresh() {
    if (this.data.childInfo) {
      this.loadPerformanceData(this.data.childInfo._id).then(() => {
        wx.stopPullDownRefresh();
      });
    } else {
      this.loadChildData().then(() => {
        wx.stopPullDownRefresh();
      });
    }
  },

  onReachBottom() {},
  onShareAppMessage() {},
  onHide() {},
  onUnload() {}
});