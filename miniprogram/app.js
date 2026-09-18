// app.js
App({
  onLaunch: function () {
    this.globalData = {
      
      // env 参数说明： 
      // env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会请求到哪个云环境的资源
      // 此处请填入环境 ID, 环境 ID 可在微信开发者工具右上顶部工具栏点击云开发按钮打开获取
      env: "hupin255-5gfbw856b1c861ef",
      userRole:null
    };
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      });
    }

    // 登录态与角色由 pages/common/login/index.js 写入缓存，各端首页自行校验。
    //
    // 教练端底部 tab 已改为页面内组件 components/coach-tab-bar：
    // 原生 tabBar 只有一份且已被家长端 4 个 tab 占满（上限 5 项）。
    // 旧的 this.setCoachTabBar() 用 wx.setTabBarItem 去改，而该 API 没有 pagePath 参数，
    // 结果只把「家长端」tab 1-3 的文案改成了 工作台/日程/我的（跳转目标从未改变），
    // 与教练端页面毫无关系，故删除。
  }
});
