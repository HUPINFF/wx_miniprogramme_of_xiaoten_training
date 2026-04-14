// pages/users/moment-detail/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    momentDetail:null,
    loading:true
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const {id} = options;
    console.log('id值:', id);
    if(id) {
      this.loadMomentDetail(id);
    }else { 
      this.setData({loading: false});
      wx.showToast({ title: '参数错误', icon: 'none' });
    }
  },

  loadMomentDetail(id) {
    this.setData({loading:true});

    const db = wx.cloud.database();
    db.collection('moments').doc(id).get().then(res => {
      this.setData({
        momentDetail:res.data,
        loading:false
      });
    }).catch(err => {
      console.error('加载详情失败', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  // 预览图片
  previewImage() {
    if(this.data.momentDetail && this.data.momentDetail.image) {
      wx.previewImage({
        urls: [this.data.momentDetail.image],
      });
    }
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