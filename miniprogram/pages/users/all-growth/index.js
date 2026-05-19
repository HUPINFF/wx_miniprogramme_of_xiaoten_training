// pages/users/all-growth/index.js
Page({
  data: {
    growthList: [],
    filteredList: [],
    filterCategory: 'all'
  },

  onLoad() {
    this.loadGrowthList();
  },

  onShow() {
    this.loadGrowthList();
  },

  loadGrowthList() {
    wx.showLoading({ title: '加载中...' });
    const db = wx.cloud.database();

    db.collection('growth_exp')
      .where({ status: true })
      .orderBy('sort', 'asc')
      .get()
      .then(res => {
        wx.hideLoading();
        const growthList = res.data.map(item => {
          let itemCount = 0;
          let coverImage = '';
          if (item.items && item.items.length > 0) {
            itemCount = item.items.length;
            coverImage = item.items[0].url;
          }
          let createdAt = '';
          if (item.createdAt) {
            const date = new Date(item.createdAt);
            createdAt = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          }
          return {
            ...item,
            itemCount,
            coverImage,
            createdAt
          };
        });
        this.setData({ growthList });
        this.applyFilter();
      })
      .catch(err => {
        wx.hideLoading();
        console.error('加载成长案例失败', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },

  setFilter(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({ filterCategory: category });
    this.applyFilter();
  },

  applyFilter() {
    const { growthList, filterCategory } = this.data;
    if (filterCategory === 'all') {
      this.setData({ filteredList: growthList });
    } else {
      const filteredList = growthList.filter(item => item.category === filterCategory);
      this.setData({ filteredList });
    }
  },

  viewGrowthDetail(e) {
    const { id } = e.currentTarget.dataset;
    if (id) {
      wx.navigateTo({ url: `/pages/users/growth-detail/index?id=${id}` });
    }
  }
});