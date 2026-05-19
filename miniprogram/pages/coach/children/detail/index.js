// pages/coach/children/detail/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    childInfo: null,
    latestPerformance: null,
    performanceList: [],
    trainingList: [],
    feedbackList: [],
    loading: true,
    showHoursModal: false,
  },

  onLoad(options) {
    const { id } = options
    if (id) {
      this.loadChildDetail(id);
    }
  },

  loadChildDetail(childId) {
    this.setData({ loading: true });

    const db = wx.cloud.database();

    Promise.all([
      db.collection('children').doc(childId).get(),
      this.loadPerformanceHistory(childId),
      this.loadTrainingHistory(childId),
      this.loadFeedbackHistory(childId)
    ]).then(([childRes, performanceData, trainingData, feedbackData]) => {
      this.setData({
        childInfo: childRes,
        latestPerformance: performanceData.latest,
        performanceList: performanceData.list,
        trainingList: trainingData,
        feedbackList: feedbackData,
        loading: false
      })
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
      const list = res.data;
      const latest = list.length > 0 ? list[0] : null
      return { list, latest };
    })
  },

  loadTrainingHistory(childId) {
    const db = wx.cloud.database();
    return db.collection('trainings').where({
      childId: childId
    }).orderBy('date', 'desc').limit(5).get().then(res => {
      return res.data;
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

  viewPerformanceDetail(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/coach/performance/detail/index?id=${id}`
    });
  },

  onReady() {
  },

  onShow() {
  },

  onHide() {
  },

  onUnload() {
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

  onReachBottom() {
  },

  onShareAppMessage() {
  }
})
