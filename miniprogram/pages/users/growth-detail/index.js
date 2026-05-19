// pages/users/growth-detail/index.js
Page({
  data: {
    growthDetail: null,
    loading: true
  },

  onLoad(options) {
    const { id } = options;
    if (id) {
      this.loadGrowthDetail(id);
    } else {
      wx.showToast({ title: '参数错误', icon: 'none' });
      wx.navigateBack();
    }
  },

  loadGrowthDetail(id) {
    this.setData({ loading: true });
    const db = wx.cloud.database();

    db.collection('growth_exp').doc(id).get()
      .then(res => {
        console.log('成长案例详情:', res.data);
        const growthDetail = res.data;

        if (growthDetail.createdAt) {
          const date = new Date(growthDetail.createdAt);
          growthDetail.createdAt = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        }

        this.setData({
          growthDetail,
          loading: false
        });
      })
      .catch(err => {
        console.error('加载成长案例详情失败', err);
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
  }
});