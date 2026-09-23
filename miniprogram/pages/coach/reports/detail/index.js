// pages/coach/reports/detail/index.js
// 成长报告详情（教练端）：成品海报式渲染（与编辑器预览同一套 report-blocks）。
// 草稿状态给「继续编辑 / 删除」入口；已发布只读。
// 家长端查看在 pages/users/reports/detail（只看 published，按 parentOpenId 复核归属）。
const auth = require('../../../../utils/auth');

Page({

  data: {
    loading: true,
    report: null,
    typeLabel: '月报'
  },

  onLoad(options) {
    if (!options.id) {
      wx.showToast({ title: '缺少报告参数', icon: 'none' });
      this.leaveLater(() => { wx.navigateBack(); }, 800);
      return;
    }
    this.reportId = options.id;
    this.loadReport();
  },

  /** 延迟离场统一入口：句柄记在实例上，教练在窗口内手动返回时由 onUnload 取消，
      否则定时器触发时 goBack 只看栈长，防不住本页已出栈后的二次 navigateBack */
  leaveLater(fn, delay) {
    if (this._leaveTimer) clearTimeout(this._leaveTimer);
    this._leaveTimer = setTimeout(fn, delay);
  },

  onUnload() {
    if (this._leaveTimer) {
      clearTimeout(this._leaveTimer);
      this._leaveTimer = null;
    }
  },

  loadReport() {
    const db = wx.cloud.database();
    db.collection('reports').doc(this.reportId).get().then(res => {
      const report = res.data;
      if (!report || report.coachId !== auth.getCoachId()) {
        auth.denyAndLeave('无权查看该报告');
        return;
      }
      this.setData({
        loading: false,
        report: report,
        typeLabel: report.type === 'quarterly' ? '季报' : '月报'
      });
    }).catch(err => {
      console.error('加载报告失败', err);
      wx.showToast({ title: '报告不存在或已删除', icon: 'none' });
      this.leaveLater(() => { wx.navigateBack(); }, 800);
    });
  },

  /** 草稿 → 回编辑器（redirectTo 替换本页，返回时直达学员详情） */
  goEdit() {
    const report = this.data.report;
    if (!report) return;
    wx.redirectTo({
      url: '/pages/coach/reports/edit/index?childId=' + report.childId +
           '&type=' + report.type + '&reportId=' + this.reportId
    });
  },

  onDelete() {
    wx.showModal({
      title: '删除报告',
      content: '删掉后不可恢复，确定删除？',
      confirmColor: '#ff3b30',
      success: (r) => {
        if (!r.confirm) return;
        const db = wx.cloud.database();
        db.collection('reports').doc(this.reportId).remove().then(() => {
          wx.showToast({ title: '已删除', icon: 'success' });
          this.leaveLater(() => { wx.navigateBack(); }, 650);
        }).catch(err => {
          console.error('删除报告失败', err);
          wx.showToast({ title: '删除失败', icon: 'none' });
        });
      }
    });
  }
});
