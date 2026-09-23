const { summarizeAbilityGroups, getTodayString } = require('../../../utils/helper');

/**
 * 蜕变主页：只保留「XX的成长」头部 + 四个版块入口。
 * 能力分组卡 / 成长曲线 / 对比海报 → pages/users/growth-ability
 * 每次课的流水（新→旧） → pages/users/class-records
 * 照片视频时间轴 → pages/users/growth-records
 * 教练撰写的月报/季报 → pages/users/reports/list
 * 本页只做两件事：把头衔挂对孩子，把入口卡的摘要行算出来。
 */
Page({
  data: {
    childInfo: null,
    currentChildId: '',
    // 入口卡摘要行：空字符串 = 不显示该行
    abilitySummary: '',
    trainingSummary: '',
    recordsSummary: '',
    reportsSummary: ''
  },

  onLoad: function () {
    if (!this.checkLogin()) return;
    this.loadChildData();
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 1
      });
    }

    // 从子页面返回时刷新摘要（首次进入时 onLoad 链路还没跑完，跳过，交给 loadChildData）
    if (this._summariesLoaded && this.data.currentChildId) {
      this.loadAbilitySummary();
      this.loadTrainingRecordsSummary();
      this.loadRecordsSummary();
      this.loadReportsSummary();
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
      return;
    }

    wx.cloud.database().collection('children').where({
      parentOpenId: openid
    }).get({
      success: function (res) {
        var children = res.data;
        if (children.length === 0) {
          // 没有孩子档案：头部显示兜底标题，入口卡保留但摘要走空态文案
          that.setData({
            abilitySummary: '还没有训练与测评记录',
            trainingSummary: '还没有训练记录',
            recordsSummary: '还没有照片和视频',
            reportsSummary: '教练还没有发布过报告'
          });
          return;
        }

        var childInfo = children[0];
        that.setData({
          childInfo: childInfo,
          currentChildId: childInfo._id
        });

        that.loadAbilitySummary();
        that.loadTrainingRecordsSummary();
        that.loadRecordsSummary();
        that.loadReportsSummary();
      },
      fail: function (err) {
        console.error('加载孩子数据失败', err);
        that.setData({
          abilitySummary: '还没有训练与测评记录',
          // 网络失败时并不知道有没有训练记录，别断言「还没有」——与
          // loadTrainingRecordsSummary 的 catch 同一口径：置空隐藏该行
          trainingSummary: '',
          recordsSummary: '还没有照片和视频',
          reportsSummary: '教练还没有发布过报告'
        });
      }
    });
  },

  /**
   * 「基本能力成长」摘要行：本月训练次数 + 最近测评进步项数。
   * 口径与 growth-ability 页概览条一致（finished 课次 / 最近两条测评的进步项）。
   */
  loadAbilitySummary: function () {
    var that = this;
    var db = wx.cloud.database();
    var monthStart = getTodayString().slice(0, 7) + '-01';

    var countTrainings = db.collection('trainings')
      .where({
        childId: this.data.currentChildId,
        status: 'finished',
        date: db.command.gte(monthStart)
      })
      .count();

    var countImproved = db.collection('performance')
      .where({ childId: this.data.currentChildId })
      .orderBy('weekDate', 'desc')
      .limit(2)
      .get()
      .then(function (res) {
        var totalImproved = 0;
        summarizeAbilityGroups(res.data || []).forEach(function (group) {
          totalImproved += group.improvedCount || 0;
        });
        return totalImproved;
      });

    Promise.all([countTrainings, countImproved])
      .then(function (results) {
        var monthTrainings = (results[0] && results[0].total) || 0;
        var totalImproved = results[1] || 0;

        var parts = [];
        if (monthTrainings > 0) {
          parts.push('本月训练 ' + monthTrainings + ' 次');
        }
        if (totalImproved > 0) {
          parts.push('最近测评 ' + totalImproved + ' 项进步');
        }

        that.setData({
          abilitySummary: parts.length > 0 ? parts.join(' · ') : '还没有训练与测评记录'
        });
        that._summariesLoaded = true;
      })
      .catch(function (err) {
        console.error('加载能力摘要失败', err);
        that.setData({ abilitySummary: '还没有训练与测评记录' });
        that._summariesLoaded = true;
      });
  },

  /**
   * 「训练记录」摘要行：共上过 N 次课 + 最近一次日期。
   * 口径与列表页「全部」一致（今天及以前的课次，不分状态），
   * 点进去看到的条数和这里对得上。
   */
  loadTrainingRecordsSummary: function () {
    var that = this;
    var db = wx.cloud.database();
    var today = getTodayString();

    var whereRecords = {
      childId: this.data.currentChildId,
      date: db.command.lte(today)
    };

    Promise.all([
      db.collection('trainings').where(whereRecords).count(),
      db.collection('trainings').where(whereRecords)
        .orderBy('date', 'desc')
        .limit(1)
        .get()
        .then(function (res) { return (res.data || [])[0] || null; })
    ])
      .then(function (results) {
        var total = (results[0] && results[0].total) || 0;
        var last = results[1];

        if (!total) {
          that.setData({ trainingSummary: '还没有训练记录' });
        } else {
          var d = (last && last.date) || '';
          var md = d ? parseInt(d.slice(5, 7), 10) + '月' + parseInt(d.slice(8, 10), 10) + '日' : '';
          that.setData({ trainingSummary: '共 ' + total + ' 次训练' + (md ? ' · 最近 ' + md : '') });
        }
        that._summariesLoaded = true;
      })
      .catch(function (err) {
        console.error('加载训练记录摘要失败', err);
        that.setData({ trainingSummary: '' });
        that._summariesLoaded = true;
      });
  },

  /** 「训练照片与视频」摘要行：photosAvideos 一条 = 一个月的归档 */
  loadRecordsSummary: function () {
    var that = this;

    wx.cloud.database().collection('photosAvideos')
      .where({ childId: this.data.currentChildId })
      .count()
      .then(function (res) {
        var total = (res && res.total) || 0;
        that.setData({
          recordsSummary: total > 0 ? '已记录 ' + total + ' 个月的成长影像' : '还没有照片和视频'
        });
      })
      .catch(function (err) {
        console.error('加载记录摘要失败', err);
        that.setData({ recordsSummary: '还没有照片和视频' });
      });
  },

  /** 「成长报告」摘要行：最新一份已发布报告的周期（只看 published，草稿不外露） */
  loadReportsSummary: function () {
    var that = this;

    wx.cloud.database().collection('reports')
      .where({ childId: this.data.currentChildId, status: 'published' })
      .orderBy('updatedAt', 'desc')
      .limit(1)
      .get()
      .then(function (res) {
        var latest = (res.data || [])[0];
        that.setData({
          reportsSummary: latest
            ? '最新：' + latest.periodLabel + (latest.type === 'quarterly' ? ' · 季报' : ' · 月报')
            : '教练还没有发布过报告'
        });
      })
      .catch(function (err) {
        console.error('加载报告摘要失败', err);
        that.setData({ reportsSummary: '教练还没有发布过报告' });
      });
  },

  /** 入口① → 基本能力成长页 */
  goAbility: function () {
    wx.navigateTo({ url: '/pages/users/growth-ability/index' });
  },

  /** 入口② → 训练记录列表（每次课的流水，新的在上） */
  goTrainingRecords: function () {
    wx.navigateTo({ url: '/pages/users/class-records/index' });
  },

  /** 入口③ → 训练照片与视频页 */
  goRecords: function () {
    wx.navigateTo({ url: '/pages/users/growth-records/index' });
  },

  /** 入口④ → 成长报告列表 */
  goReports: function () {
    wx.navigateTo({ url: '/pages/users/reports/list/index' });
  }
});
