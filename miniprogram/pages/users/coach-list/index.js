// pages/users/coach-list/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    // 地图数据
    latitude:39.0846,  // 天津师范大学纬度
    longitude:117.1214, // 天津师范大学经度
    markers:[{
      id:1,
      latitude:39.0846,
      longitude:117.1214,
      title:'腾鑫体育',
      iconPath: '/images/location.png',
      width: 40,
      height: 40
    }]
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {

  },

  // 拨打电话
  makePhoneCall() {
    wx.makePhoneCall({
      phoneNumber:'400-888-6666',
      fail:() => {
        wx.showToast({
          title:'拨打失败',
          icon:"none"
        })
      }
    })
  },

  // 复制微信号
  copyWechat() {
    wx.setClipboardData({
      data: 'sports_training',
      success:() => {
        wx.showToast({
          title:'微信号已复制',
          icon:'success'
        })
      }
    })
  },

  // 打开地图导航
  openLocation() {
    wx.openLocation({
      latitude: this.data.latitude,
      longitude: this.data.longitude,
      name: '腾鑫体育（天津师范大学体育馆）',
      address: '天津市西青区宾水西道393号',
      scale: 18
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