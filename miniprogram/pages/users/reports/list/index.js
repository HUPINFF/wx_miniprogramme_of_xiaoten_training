// pages/users/reports/list/index.js
// 家长端成长报告列表：只看教练已发布的报告（草稿不外露）。
// childId 一律本地从 parentOpenId 推导（全站家长页同一口径），不信任 URL 传参。
Page({
  data: {
    statusBarHeight: 0, // 状态栏高度(px)，自定义渐变头部用它让出位置
    childName: '',
    reports: [],
    listLoading: true,
    loadFail: false // 失败态单列：别把「暂时拿不到」渲染成「确定没有」的空态
  },

  onLoad: function () {
    var windowInfo = wx.getWindowInfo();
    this.setData({ statusBarHeight: windowInfo.statusBarHeight || 0 });

    if (!this.checkLogin()) {
      // 去登录页前先停掉加载态：从登录页返回时别留在永久转圈上
      this.setData({ listLoading: false });
      return;
    }
    this.loadChildData();
  },

  /** 返回上一页；直接打开本页（无上一页）时退回蜕变 tab */
  goBack: function () {
    var pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.switchTab({ url: '/pages/users/growth/index' });
    }
  },

  checkLogin: function () {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.navigateTo({ url: '/pages/common/login/index' });
      return false;
    }
    return true;
  },

  loadChildData: function () {
    var that = this;
    var openid = wx.getStorageSync('openid');

    if (!openid) {
      console.error('用户未登录');
      wx.showToast({ title: '请先登录', icon: 'none' });
      this.setData({ listLoading: false });
      return;
    }

    wx.cloud.database().collection('children').where({
      parentOpenId: openid
    }).get({
      success: function (res) {
        var children = res.data;
        if (children.length === 0) {
          wx.showToast({ title: '未找到孩子信息', icon: 'none' });
          that.setData({ listLoading: false });
          return;
        }
        that.setData({ childName: children[0].name || '' });
        that.loadReports(children[0]._id);
      },
      fail: function (err) {
        console.error('加载孩子数据失败', err);
        that.setData({ listLoading: false, loadFail: true });
      }
    });
  },

  loadReports: function (childId) {
    var that = this;

    wx.cloud.database().collection('reports')
      .where({ childId: childId, status: 'published' })
      .orderBy('updatedAt', 'desc')
      .limit(100)
      .get()
      .then(function (res) {
        var reports = (res.data || []).map(function (r) {
          var updated = r.updatedAt ? new Date(r.updatedAt) : null;
          return {
            _id: r._id,
            title: r.periodLabel + (r.type === 'quarterly' ? ' · 季报' : ' · 月报'),
            dateText: updated && !isNaN(updated.getTime())
              ? (updated.getMonth() + 1) + '月' + updated.getDate() + '日发布'
              : ''
          };
        });
        that.setData({ reports: reports, listLoading: false, loadFail: false });
      })
      .catch(function (err) {
        console.error('加载报告列表失败', err);
        that.setData({ reports: [], listLoading: false, loadFail: true });
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },

  /** 失败态的重试入口：从孩子档案开始整条重拉 */
  retry: function () {
    this.setData({ listLoading: true, loadFail: false });
    this.loadChildData();
  },

  viewReport: function (e) {
    var id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/users/reports/detail/index?id=' + id });
  }
});
