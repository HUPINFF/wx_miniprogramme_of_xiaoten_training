// pages/users/reports/detail/index.js
// 家长端成长报告详情：只读海报（渲染复用 report-blocks，教练预览 = 家长看到的成品）。
// 只放行 status=published 的报告；归属用 parentOpenId 现场复核，URL 里的 id 不被信任——
// 家长端其他页面靠前端 where 粗筛，本页比照教练端 detail 的做法多一道本地校验。
const rb = require('../../../../utils/reportBuilder');

Page({
  data: {
    statusBarHeight: 0,
    loading: true,
    loadFail: false,
    report: null,
    typeLabel: '月报'
  },

  onLoad(options) {
    var windowInfo = wx.getWindowInfo();
    this.setData({ statusBarHeight: windowInfo.statusBarHeight || 0 });

    if (!this.checkLogin()) {
      this.setData({ loading: false, loadFail: true });
      return;
    }
    if (!options.id) {
      this.deny('缺少报告参数');
      return;
    }
    this.reportId = options.id;
    this.loadReport();
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

  loadReport() {
    const db = wx.cloud.database();
    db.collection('reports').doc(this.reportId).get().then(res => {
      const report = res.data;
      if (!report) {
        this.deny('报告不存在或已删除');
        return;
      }
      // 归属复核：报告挂的孩子必须是当前家长的孩子；同时只放行已发布
      return db.collection('children').where({
        _id: report.childId,
        parentOpenId: wx.getStorageSync('openid')
      }).count().then(cRes => {
        if (!(cRes && cRes.total > 0) || report.status !== 'published') {
          this.deny('无权查看该报告');
          return;
        }
        // 家长端成品海报：空的教练块整段不渲染（教练预览保留「待补充」占位不受影响）
        report.sections = rb.buildVisibleSections(report.sections);
        this.setData({
          loading: false,
          report: report,
          typeLabel: rb.reportTypeLabel(report.type)
        });
      });
    }).catch(err => {
      console.error('加载报告失败', err);
      this.deny('报告加载失败');
    });
  },

  /** 校验不过：提示后退出（有栈回退，没栈回蜕变 tab） */
  deny(msg) {
    this.setData({ loading: false, loadFail: true });
    wx.showToast({ title: msg, icon: 'none' });
    // 800ms 自动返回的句柄记到实例上：家长在窗口内手动点返回时由 onUnload 取消，
    // 否则定时器会在列表页上再弹一层（goBack 触发时只看栈长，防不住本页已出栈）
    this._denyTimer = setTimeout(() => { this._denyTimer = null; this.goBack(); }, 800);
  },

  onUnload() {
    if (this._denyTimer) {
      clearTimeout(this._denyTimer);
      this._denyTimer = null;
    }
  }
});
