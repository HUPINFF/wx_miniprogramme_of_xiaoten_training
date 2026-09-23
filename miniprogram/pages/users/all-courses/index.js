// pages/users/all-courses/index.js
Page({
  data: {
    courses: [],
    loading: true
  },

  onLoad() {
    this.loadCourses();
  },

  loadCourses() {
    this.setData({ loading: true });
    const db = wx.cloud.database();

    db.collection('course')
      .where({ status: true })
      .orderBy('sort', 'asc')
      .get()
      .then(res => {
        this.setData({
          courses: res.data,
          loading: false
        });
      })
      .catch(err => {
        console.error('加载课程列表失败', err);
        this.setData({ loading: false });
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },

  viewCourseDetail(e) {
    const { id } = e.currentTarget.dataset;
    if (id) {
      wx.navigateTo({
        url: `/pages/users/course-detail/index?id=${id}`
      });
    }
  },

  // 自定义头部的返回键：栈里有上一页就返回，否则回首页（分享/扫码直接进来的场景）
  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
    } else {
      wx.switchTab({ url: '/pages/users/home/index' });
    }
  }
});