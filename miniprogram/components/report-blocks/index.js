// components/report-blocks/index.js
// 成长报告的积木块渲染（只读）：报告详情页和编辑器的预览共用这一套，
// 保证「教练编辑时看到的预览 = 家长以后看到的成品」。
Component({
  properties: {
    sections: {
      type: Array,
      value: []
    },
    // 编辑器里外层卡片已有标题，传 false 关掉组件内的标题行，避免双标题
    showTitle: {
      type: Boolean,
      value: true
    }
  },

  methods: {
    /** 点照片全屏预览（urls 一起传，可左右滑动看整套证据） */
    previewImage(e) {
      const urls = e.currentTarget.dataset.urls || [];
      const current = e.currentTarget.dataset.url || '';
      if (!urls.length) return;
      wx.previewImage({
        current: current,
        urls: urls
      });
    }
  }
});
