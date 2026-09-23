// pages/users/feedback-detail/index.js
// 反馈详情（家长端）：成长足迹「最新反馈」或「我的反馈」点进来，只看这一条反馈。
// 每课反馈与旧周反馈都在 feedbacks 集合里，字段按两种形态各自兜底渲染。
Page({
  data: {
    loading: true,
    loadFail: false,
    feedback: null,
    childName: ''
  },

  onLoad(options) {
    this.openid = wx.getStorageSync('openid') || '';
    this.pendingId = options.id || '';
    this.load();
  },

  load() {
    this.setData({ loading: true, loadFail: false });
    if (this.pendingId) {
      this.loadFeedback(this.pendingId);
    } else {
      // 没带 id 的入口 → 退化加载该孩子最新一条
      this.loadLatestForChild();
    }
  },

  retry() {
    this.load();
  },

  // 家长端安全兜底：这条反馈的孩子必须属于当前家长
  loadFeedback(id) {
    const db = wx.cloud.database();
    db.collection('feedbacks').doc(id).get().then(res => {
      const feedback = res.data;
      if (!feedback || !feedback.childId) {
        this.setData({ loading: false, loadFail: true });
        return;
      }
      return db.collection('children').doc(feedback.childId).get().then(cRes => {
        const child = cRes.data || {};
        if (child.parentOpenId !== this.openid) {
          this.setData({ loading: false, loadFail: true });
          return;
        }
        this.setData({
          loading: false,
          feedback: feedback,
          childName: child.name || feedback.childName || ''
        });
      });
    }).catch(err => {
      console.error('加载反馈详情失败', err);
      this.setData({ loading: false, loadFail: true });
    });
  },

  loadLatestForChild() {
    const db = wx.cloud.database();
    db.collection('children').where({
      parentOpenId: this.openid
    }).get().then(res => {
      if (!res.data.length) {
        this.setData({ loading: false, loadFail: true });
        return;
      }
      const child = res.data[0];
      this.setData({ childName: child.name || '' });
      return db.collection('feedbacks').where({
        childId: child._id
      }).orderBy('date', 'desc').limit(1).get().then(fbRes => {
        if (fbRes.data.length) {
          this.setData({ loading: false, feedback: fbRes.data[0] });
        } else {
          this.setData({ loading: false, loadFail: true });
        }
      });
    }).catch(err => {
      console.error('加载反馈详情失败', err);
      this.setData({ loading: false, loadFail: true });
    });
  },

  previewPhoto(e) {
    const { urls, url } = e.currentTarget.dataset;
    if (!urls || !urls.length) return;
    wx.previewImage({ urls: urls, current: url });
  },

  // 复制朋友圈文案（教练端自动生成的那版，家长直接拿去发）
  copyMoments() {
    const text = this.data.feedback && this.data.feedback.momentsVersion;
    if (!text) return;
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({ title: '已复制，去发朋友圈吧', icon: 'none' });
      }
    });
  }
})
