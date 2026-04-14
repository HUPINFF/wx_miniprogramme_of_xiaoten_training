// pages/coach/children/detail/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    childInfo:null,
    latestPerformance:null,
    performanceList:[],
    trainingList:[],
    feedbackList:[],
    loading:true,
    showHoursModal: false,     // 【新增】学时编辑弹窗
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const { id } = options
    if(id) {
      this.loadChildDetail(id);
    }
  },

  // 加载孩子详情
  loadChildDetail(childId) {
    this.setData({loading:true});

    const db = wx.cloud.database();

    // 并行加载所有数据
    Promise.all([
      db.collection('children').doc(childId).get(),
      this.loadPerformanceHistory(childId),
      this.loadTrainingHistory(childId),
      this.loadFeedbackHistory(childId)
    ]).then(([childRes,performanceData,trainingData,feedbackData]) => {
      this.setData({
        childInfo:childRes,
        latestPerformance:performanceData.latest,
        performanceList:performanceData.list,
        trainingList:trainingData,
        feedbackList:feedbackData,
        loading:false
      })  
    }).catch(err => {
      console.error('加载孩子详情失败',err);
      wx.showToast({title:'加载失败',icon:"none"})
      this.setData({loading:false});
    });
  },

  // 【新增】编辑学时
  editHours() {
    this.setData({ showHoursModal: true });
  },

    // 【新增】关闭学时弹窗
  closeHoursModal() {
    this.setData({ showHoursModal: false });
  },

   // 【新增】学时输入变化
   onHoursInput(e) {
    this.setData({ tempHours: e.detail.value });
  },

  // 【新增】确认保存学时
  onConfirmHours(e) {
    const { childId, remainingHours } = e.detail;
    
    wx.showLoading({ title: '保存中...' });
    
    const db = wx.cloud.database();
    db.collection('children').doc(childId).update({
      data: {
        remainingHours: remainingHours,
        updatedAt: new Date()
      }
    }).then(() => {
      // 更新本地数据
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

  // 加载历史表现
  loadPerformanceHistory(childId) {
    const db = wx.cloud.database()
    return db.collection('performance').where({
      childId:childId
    }).orderBy('weekDate','desc').get().then(res => {
      const list = res.data;
      const latest = list.length > 0 ? list[0] : null
      return {list,latest};
    }) 
  },

  // 加载训练记录
  loadTrainingHistory(childId) {
    const db = wx.cloud.database();
    return db.collection('trainings').where({
      childId:childId
    }).orderBy('date','desc').limit(5).get().then(res => {
      return res.data;
    });
  },

   // 加载反馈记录
   loadFeedbackHistory(childId) {
    const db = wx.cloud.database();
    return db.collection('feedbacks').where({
      childId:childId
    }).orderBy('date','desc').limit(5).get().then(res => {
      return res.data;
    })
   },

   //录入成绩
   addPerformance() {
    wx.navigateTo({
      url:`/pages/coach/performance/weekly/index?childId=${this.data.childInfo.data._id}`
    });
   },

   //写反馈
   writeFeedback() {
    wx.navigateTo({
      url:`/pages/coach/feedback/write/index?childId=${this.data.childInfo.data._id}`
    })
   },


   //添加训练
   addTraining() {
    wx.navigateTo({
      url:`/pages/coach/trainings/edit/index?childId=${this.data.childInfo.data._id}`
    })
   },

   // 【新增】跳转到体质测评页面
  goToAssessment() {
    wx.navigateTo({
      url: `/pages/coach/assessment/edit/index?childId=${this.data.childInfo.data._id}&childName=${this.data.childInfo.data.name}`
    });
  },

  //  编辑训练
    editTraining(e) {
      const {id} = e.currentTarget.dataset;
      wx.navigateTo({
        url: `/pages/coach/trainings/edit/index?id=${id}`
      });
    },

    // 查看全部表现
    viewAllPerformance() {
      wx.navigateTo({
        url: `/pages/coach/performance/list/index?childId=${this.data.childInfo.data._id}&childName=${this.data.childInfo.data.name}`
      })
    },

    // 查看全部训练
  viewAllTrainings() {
    wx.navigateTo({
      url:`/pages/coach/trainings/list/index?childId=${this.data.childInfo.data._id}&childName=${this.data.childInfo.data.name}`
    });
  },

  // 查看全部反馈
  viewAllFeedbacks() {
    wx.navigateTo({
      url:`/pages/coach/feedback/list/index?childId=${this.data.childInfo.data._id}&childName=${this.data.childInfo.data.name}`
    });
  },

  // 查看表现详情
  viewPerformanceDetail(e) {
    const {id} = e.currentTarget.dataset 
    wx.navigateTo({
      url:`/pages/coach/performance/detail/index?id=${id}`
    });
  },
  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    if(this.data.childInfo) {
      this.loadPerformanceData(this.data.childInfo._id).then(() => {
        wx.stopPullDownRefresh();
      });
    }else{
      this.loadChildData().then(() => {
        wx.stopPullDownRefresh();
      });
    }
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})