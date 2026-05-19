// pages/users/coach-detail/index.js
Page({
  data: {
    coach: null,
    coachId: '',
    loading: true
  },

  onLoad(options) {
    const { id } = options;
    if (id) {
      this.setData({ coachId: id });
      this.loadCoachInfo(id);
    } else {
      wx.showToast({ title: '参数错误', icon: 'none' });
      wx.navigateBack();
    }
  },

  loadCoachInfo(coachId) {
    this.setData({ loading: true });
    const db = wx.cloud.database();

    db.collection('users')
      .doc(coachId)
      .get()
      .then(res => {
        this.setData({
          coach: res.data,
          loading: false
        });
      })
      .catch(err => {
        console.error('加载教练信息失败', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
        this.setData({ loading: false });
      });
  },

  callCoach() {
    const phone = this.data.coach.phone;
    if (phone) {
      wx.makePhoneCall({
        phoneNumber: phone,
        fail: () => {
          wx.showToast({ title: '拨打电话失败', icon: 'none' });
        }
      });
    }
  },

  copyWechat() {
    const wechat = this.data.coach.wechat;
    if (wechat) {
      wx.setClipboardData({
        data: wechat,
        success: () => {
          wx.showToast({ title: '微信号已复制', icon: 'success' });
        },
        fail: () => {
          wx.showToast({ title: '复制失败', icon: 'none' });
        }
      });
    }
  }
});