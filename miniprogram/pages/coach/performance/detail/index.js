// pages/coach/performance/detail/index.js 单周体测成绩详情（只读）。
// 修复原死路由：children/detail 近期表现行与 performance/list 卡片此前都指向这里但页面不存在。
const auth = require('../../../../utils/auth');

Page({
  data: {
    record: null,
    childName: '',
    loading: true
  },

  onLoad(options) {
    const { id, childName } = options;
    this.setData({ childName: childName || '' });
    if (!id) {
      this.setData({ loading: false });
      wx.showToast({ title: '缺少记录参数', icon: 'none' });
      return;
    }
    this.loadRecord(id);
  },

  loadRecord(id) {
    const db = wx.cloud.database();
    db.collection('performance').doc(id).get().then(res => {
      const record = res.data;
      if (!record || !record.childId) {
        this.setData({ loading: false });
        wx.showToast({ title: '记录不存在', icon: 'none' });
        return;
      }
      // childId 取自库里的文档而非 URL，先过归属校验再看
      auth.guardChildAccess(record.childId).then(ok => {
        if (!ok) return; // 校验不过由 guard 内部 denyAndLeave 处理
        // 调用方没带 childName 时兜底查一次，给头部副标题用
        if (!this.data.childName) {
          db.collection('children').doc(record.childId).get().then(childRes => {
            this.setData({ childName: (childRes.data && childRes.data.name) || '' });
          }).catch(() => {});
        }
        this.setData({ record: record, loading: false });
      });
    }).catch(err => {
      console.error('加载体测成绩失败', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  /** 返回上一页；直接打开本页（无上一页）时回教练工作台（教练端 tab 页靠 reLaunch 清栈） */
  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({ url: '/pages/coach/workbench/index' });
    }
  }
});
