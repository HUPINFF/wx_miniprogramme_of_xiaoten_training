// pages/users/training-photos/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    trainingId: '',
    trainingInfo: null,
    photoList: [],
    loading: true
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const {trainingId} = options;
    if(trainingId) {
      this.setData({ trainingId });
      this.loadTrainingDetail(trainingId);
    }else {
      this.setData({ loading: false });
      wx.showToast({ title: '参数错误', icon: 'none' });  
    }
  },

  // 加载训练详情
  loadTrainingDetail(trainingId) {
    this.setData({ loading: true });

    const db = wx.cloud.database();
    db.collection('trainings').doc(trainingId).get().then(res => {
      const training = res.data;
      this.setData({
        trainingInfo: {
          name: training.name,
          date: training.date,
          day: training.day,
          coachName: training.coachName
        },
        photoList: training.photos || [],
        loading: false
      });
    }).catch(err => {
      console.error('加载训练详情失败', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

   // 预览照片
   previewPhoto(e) {
    const { url, urls } = e.currentTarget.dataset;
    wx.previewImage({
      current: url,
      urls: urls
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