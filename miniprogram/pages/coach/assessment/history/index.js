// pages/coach/assessment/history/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    childId: '',
    childName: '',
    assessmentList: [],
    loading: true
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const {childId,childName} = options;
    this.setData({
      childId: childId || '',
      childName: childName || ''
    });
    this.loadAssessmentHistory();
  },

  // 加载历史测评记录
  loadAssessmentHistory() {
    if(!this.data.childId) {
      this.setData({loading:false});
      return;
    }
    this.setData({loading:true});

    const db = wx.cloud.database();
    db.collection('assessments').where({
      childId:this.data.childId
    }).orderBy('year','desc').orderBy('month','desc').get().then(res => {
      this.setData({
        assessmentList:res.data,
        loading:false
      });
    }).catch(err => {
      console.error('加载测评历史失败', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
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
    this.loadAssessmentHistory().then(() => {
      wx.stopPullDownRefresh();
    }); 
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