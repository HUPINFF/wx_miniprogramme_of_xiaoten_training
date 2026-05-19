// pages/coach/course-detail/index.js
Page({
  data: {
    courseDetail: null,
    loading: true
  },

  onLoad(options) {
    const { id } = options;
    if (id) {
      this.loadCourseDetail(id);
    } else {
      wx.showToast({ title: '参数错误', icon: 'none' });
      wx.navigateBack();
    }
  },

  loadCourseDetail(id) {
    this.setData({ loading: true });
    const db = wx.cloud.database();

    db.collection('course').doc(id).get()
      .then(res => {
        console.log('课程详情:', res.data);
        this.setData({
          courseDetail: res.data,
          loading: false
        });
      })
      .catch(err => {
        console.error('加载课程详情失败', err);
        this.setData({ loading: false });
        wx.showToast({ title: '加载失败', icon: 'none' });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      });
  },

  previewImage(e) {
    const { url } = e.currentTarget.dataset;
    if (url) {
      wx.previewImage({
        current: url,
        urls: [url]
      });
    }
  },

  playVideo(e) {
    const { url } = e.currentTarget.dataset;
    if (url) {
      wx.previewMedia({
        sources: [{
          url: url,
          type: 'video'
        }],
        current: 0
      });
    }
  },

  goToContactCoach() {
    wx.navigateTo({ url: '/pages/users/book-coach/index' });
  }
});