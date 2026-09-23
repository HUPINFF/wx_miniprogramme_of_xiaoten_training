Page({
  data: {
    statusBarHeight: 0, // 状态栏高度(px)，自定义渐变头部用它让出位置
    childInfo: null,
    currentChildId: '',
    timelineData: [],
    timelineLoading: true
  },

  onLoad: function (options) {
    var windowInfo = wx.getWindowInfo();
    this.setData({ statusBarHeight: windowInfo.statusBarHeight || 0 });

    if (!this.checkLogin()) {
      // 去登录页前先停掉加载态：从登录页返回时别留在永久转圈上
      this.setData({ timelineLoading: false });
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
      // token 和 openid 是两条链路写入的缓存，可能一有一无；
      // 这里是提前退出，必须停掉加载态，否则转圈永远不停
      this.setData({ timelineLoading: false });
      return;
    }

    wx.cloud.database().collection('children').where({
      parentOpenId: openid
    }).get({
      success: function (res) {
        var children = res.data;
        if (children.length === 0) {
          wx.showToast({ title: '未找到孩子信息', icon: 'none' });
          that.setData({ timelineLoading: false });
          return;
        }

        var childInfo = children[0];
        that.setData({
          childInfo: childInfo,
          currentChildId: childInfo._id
        });

        that.loadTimelineData();
      },
      fail: function (err) {
        console.error('加载孩子数据失败', err);
        that.setData({ timelineLoading: false });
      }
    });
  },

  loadTimelineData: function () {
    var that = this;
    if (!this.data.currentChildId) {
      return;
    }

    this.setData({ timelineLoading: true });

    wx.cloud.database().collection('photosAvideos')
      .where({ childId: this.data.currentChildId })
      .orderBy('yearMonth', 'desc')
      .limit(12)
      .get({
        success: function (res) {
          var timelineData = res.data || [];

          timelineData.forEach(function (item) {
            if (item.yearMonth) {
              var yearMonth = item.yearMonth;
              if (yearMonth.includes('-')) {
                var parts = yearMonth.split('-');
                item.yearMonth = parts[0] + '年' + parts[1] + '月';
              }
            }
          });

          that.setData({
            timelineData: timelineData,
            timelineLoading: false
          });
        },
        fail: function (err) {
          console.error('加载时间轴数据失败', err);
          that.setData({
            timelineData: [],
            timelineLoading: false
          });
        }
      });
  },

  previewPhoto: function (e) {
    var photos = e.currentTarget.dataset.photos;
    var index = e.currentTarget.dataset.index;
    wx.previewImage({
      current: photos[index],
      urls: photos
    });
  },

  playVideo: function (e) {
    var url = e.currentTarget.dataset.url;
    wx.previewMedia({
      sources: [{ url: url, type: 'video' }],
      current: 0,
      showmenu: true
    });
  }
});
