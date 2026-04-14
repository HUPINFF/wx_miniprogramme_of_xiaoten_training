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

    // 检查登录状态
    const token = wx.getStorageSync('token');
    if(token){
      // 已登录,获取角色并跳转
      const role = wx.getStorageSync('userRole') || 'user';
    }

    const role = wx.getStorageSync('userRole');
    if(role === 'coach') {
      this.setCoachTabBar();
    }
  },
  setCoachTabBar() {
    wx.setTabBarItem({index:0 ,text:"工作台",pagePath:"pages/coach/workbench/index"})
    wx.setTabBarItem({index:1 ,text:"日程",pagePath:"pages/coach/schedule/index"})
    wx.setTabBarItem({index:2 ,text:"我的",pagePath:"pages/coach/profile/index"})
  }
});
