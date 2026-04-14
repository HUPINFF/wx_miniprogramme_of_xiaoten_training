// pages/users/orders/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    currentType:'pending',
    pendingList:[],
    approvedList:[],
    rejectedList:[],
    completedList:[],
    pendingCount:0
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadAppointMents();
  },


  // 加载预约列表
  loadAppointMents() {
    const openid = wx.getStorageSync('openid');
    const db = wx.cloud.database();
    console.log(openid);
    db.collection('children').where({
      parentOpenId:openid
    }).get().then(res => {
      const children = res.data;
      console.log('adadaadadaddadd',children);
      const childIds = children.map(child => child._id);
      console.log('FFFFFFFFFFFFF',childIds);

      if(childIds.length === 0){
        this.setData({
          pendingList: [],
          approvedList: [],
          rejectedList: [],
          completedList: [],
          pendingCount: 0
        });
        return;
      }

      // 查询所有预约
      return db.collection('appointments').where({
        childId:db.command.in(childIds)
      }).orderBy('date','desc').orderBy('startTime','asc').get(); 
    }).then(res => {
      if(res && res.data) {
        this.processAppointments(res.data);
      }
    }).catch(err => {
      console.error('加载预约失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    })
  },

  processAppointments(appointments) {
    const pendingList = [];
    const approvedList =[];
    const rejectedList =[];
    const completedList = [];

    appointments.forEach(item => {
      switch(item.status) {
        case 'pending':
          pendingList.push(item);
          break;
        case 'approved':
          approvedList.push(item);
          break
        case 'rejected':
          rejectedList.push(item);
          break
        case 'completed':
          completedList.push(item);
          break;  
      }
    });
    this.setData({
      pendingList,
      approvedList,
      rejectedList,
      completedList,
      pendingCount: pendingList.length
    });
  },

  // 切换Tab
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({currentType:tab}) ;
  },

  // // 取消预约
  cancelAppointment(e) {
    const id = e.currentTarget.dataset.id;
    console.log(id);
    wx.showModal({
      title:'确认取消',
      content:'确定要取消这个预约吗？',
      success:(res) => {
        if(res.confirm) {
          const db = wx.cloud.database();
          db.collection('appointments').doc(id).get().then(res => {
            console.log('找到记录：',res.data);
          })
          db.collection('appointments').doc(id).update({
            data:{
              status:'rejected',
              remark:'用户取消预约',
              updatedAt:new Date()
            }
          }).then(() => {
            wx.showToast({ title: '已取消', icon: 'success' });
            this.loadAppointMents();
          }).catch(err => {
            console.error('取消失败',err);
            wx.showToast({ title: '取消失败', icon: 'none' });
          });
        }
      }
    }) 
  },

  // 跳转到预约上课页面
  goToBookClass() {
  wx.navigateTo({
    url: "/pages/users/book-class/index"
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
    this.loadAppointMents();
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