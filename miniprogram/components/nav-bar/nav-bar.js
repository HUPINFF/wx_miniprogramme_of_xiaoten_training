Component({
  properties:{
    title:{
      type:String,
      value:'腾鑫体育'
    },
    subTitle:{
      type:String,
      value:''
    },

    showBack: {
      type: Boolean,
      value: true
    }
  },
  data: {
    statusBarHeight: 0,
    menuButtonInfo: {},
    navBarHeight: 0
  },

  lifetimes: {
    attached() {
      this.getNavBarInfo();
    }
  },

  methods:{
    getNavBarInfo() {
      const windowInfo = wx.getWindowInfo();
    const statusBarHeight = windowInfo.statusBarHeight;
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    console.log();
    // 计算导航栏总高度 = 状态栏高度 + 导航栏内容高度
    // 导航栏内容高度通常取胶囊按钮高度或自定义高度
    const navBarHeight = menuButtonInfo.bottom; 

    this.setData({
      statusBarHeight:statusBarHeight,
      navBarHeight:navBarHeight,
      menuButtonInfo:menuButtonInfo
    })
    },

    goBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack();
      } else {
        wx.switchTab({
          url: '/pages/users/workbench/index'
        });
      }
    }


  }
})