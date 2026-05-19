// pages/coach/in-class/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    training: {},
    showConfirmModal: false,
    childInfo: {}
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const { trainingId, id } = options;
    const targetId = trainingId || id;
    console.log('in-class页面加载, trainingId:', targetId);
    if (targetId) {
      this.loadTrainingInfo(targetId);
    }
  },

  // 加载训练信息
  loadTrainingInfo(trainingId) {
    const db = wx.cloud.database();
    db.collection('trainings').doc(trainingId).get().then(res => {
      console.log('训练数据:', res.data);
      const training = res.data;
      this.setData({ training });

      // 如果状态是 pending，进入时更新为上课中
      if (training.status === 'pending') {
        this.updateTrainingStatus(trainingId, 'in_class', training);
      }

      // 加载学员信息
      if (training.childId) {
        this.loadChildInfo(training.childId);
      }
    }).catch(err => {
      console.error('加载训练信息失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  // 更新训练状态
  updateTrainingStatus(trainingId, status, training = null) {
    const db = wx.cloud.database();
    db.collection('trainings').doc(trainingId).update({
      data: {
        status: status,
        updatedAt: new Date()
      }
    }).then(() => {
      console.log('训练状态已更新为:', status);
      // 更新成功后同步更新页面显示
      if (training) {
        this.setData({
          training: {
            ...training,
            status: status
          }
        });
      }
    }).catch(err => {
      console.error('更新训练状态失败', err);
    });
  },

  // 加载学员信息
  loadChildInfo(childId) {
    const db = wx.cloud.database();
    db.collection('children').doc(childId).get().then(res => {
      this.setData({ childInfo: res.data });
    }).catch(err => {
      console.error('加载学员信息失败', err);
    });
  },

  // 点击下课按钮
  onFinishClass() {
    this.setData({ showConfirmModal: true });
  },

  // 关闭弹窗
  closeModal() {
    this.setData({ showConfirmModal: false });
  },

  // 确认下课
  confirmDeductHours() {
    const { training } = this.data;
    this.setData({ showConfirmModal: false });
    // 直接跳转至课后记录页面，课时在完成记录时扣除
    wx.navigateTo({
      url: `/pages/coach/post-class/index?id=${training._id}&childId=${training.childId}`
    });
  },

  // 扣减学员学时
  deductHours(childId, hours) {
    const db = wx.cloud.database();
    return db.collection('children').doc(childId).get().then(res => {
      const child = res.data;
      const currentHours = child.remainingHours || 0;
      const newHours = currentHours - hours;

      if (newHours < 0) {
        wx.showToast({ title: '学时不足，请及时充值', icon: 'none' });
      }

      return db.collection('children').doc(childId).update({
        data: {
          remainingHours: newHours,
          updatedAt: new Date()
        }
      });
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