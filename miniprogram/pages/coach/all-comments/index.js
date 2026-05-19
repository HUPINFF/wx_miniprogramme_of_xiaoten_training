// pages/coach/all-comments/index.js
Page({
  data: {
    comments: [],
    loading: true
  },

  onLoad() {
    this.loadComments();
  },

  onShow() {
    this.loadComments();
  },

  loadComments() {
    this.setData({ loading: true });
    const db = wx.cloud.database();

    db.collection('comment')
      .orderBy('createdAt', 'desc')
      .get()
      .then(res => {
        this.setData({ 
          comments: res.data,
          loading: false
        });
      })
      .catch(err => {
        console.error('加载点评失败', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
        this.setData({ loading: false });
      });
  },

  viewCommentDetail(e) {
    const { id } = e.currentTarget.dataset;
    if (id) {
      wx.navigateTo({ url: `/pages/coach/comment-detail/index?id=${id}` });
    }
  }
});