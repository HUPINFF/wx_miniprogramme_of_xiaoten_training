  // pages/users/profile/index.js
  Page({

    /**
     * 页面的初始数据
     */
    data: {
      statusBarHeight:0,    //状态栏高度
      navBarHeight:0,       //导航栏总高度
      menuButtonInfo:{},    //胶囊按钮信息

      // 家长信息
      parentInfo:{},
      // 孩子信息
      childInfo:null,



      // 轮播图数据
      banners:[],
      // 最新状态
      newList:[],
      // 精彩瞬间
      moments:[],
      // 加载状态
      loading:true

    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {
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

      // 获取家长信息
      const userInfo = wx.getStorageSync('userInfo') || {};
      this.setData({parentInfo:userInfo});

      // 获取孩子信息
      this.loadChildInfo();
  // loadChildInfo
      // 加载首页数据
      this.loadHomeData();
      this.loadChildInfo();  // ✅ 添加这行
    },

      


    // 加载孩子信息
    loadChildInfo() {
      const openid = wx.getStorageSync('openid');
      const db = wx.cloud.database();
      db.collection('children').where({
        parentOpenId:openid
      }).get().then(res => {
        if(res.data.length>0) {
          this.setData({childInfo:res.data[0]})
        }
      })
    },

    // 加载首页数据
    loadHomeData() {
      this.setData({loading:true});

      Promise.all([
        this.loadBanners(),
        this.loadNews(),
        this.loadMoments(),
      ]).then(() => {
        this.setData({loading : false});
      }).catch(err => {
        console.error("加载首页数据失败",err);
        // 加载失败时使用默认数据
        this.loadDefaultData();
      });
    },

    // 加载轮播图
    loadBanners() {
      const db = wx.cloud.database();
      return db.collection('banners').where({
        status:true
      }).orderBy('sort','asc').get().then(res => {
        this.setData({banners:res.data});
        console.log('这个是banners',this.data.banners[0].image);
      }).catch(err => {
        console.error("加载轮播图失败",err);
      });
    },
    // 加载最新状态
    loadNews() {
      const db = wx.cloud.database();
      return db.collection('news').where({
        status:true
      }).orderBy('sort','asc').orderBy('time','desc').limit(5).get().then(res => {
        this.setData({newList:res.data});
      }).catch(err => {
        console.error("加载最新动态失败",err);
      });
    },

    // 加载精彩瞬间
    loadMoments() {
      const db = wx.cloud.database();
      return db.collection("moments").where({
        status:true
      }).orderBy('sort','asc').limit(10).get().then(res => {
        this.setData({moments:res.data});
      }).catch(err => {
        console.error("加载精彩瞬间失败",err);
      })
    },

    // 默认数据（当数据库无数据时显示）
    loadDefaultData() {
      this.setData({
        banners: [
          { image: '/images_2/1.jpg', text: '暑期训练营火热招生中' },
          { image: '/images_2/2.jpg', text: '国家级教练团队' },
          { image: '/images_2/3.jpg', text: '科学训练体系' }
        ],
        newsList: [
          { id: 1, title: '暑期集训营开始报名啦！', time: '2024-03-28' },
          { id: 2, title: '3月优秀学员表彰名单', time: '2024-03-25' },
          { id: 3, title: '本周六举行亲子运动会', time: '2024-03-22' },
          { id: 4, title: '新开设体适能课程', time: '2024-03-20' }
        ],
        moments: [
          { id: 1, image: '/images_2/1.jpg', title: '速度训练' },
          { id: 2, image: '/images_2/2.jpg', title: '耐力训练' },
          { id: 3, image: '/images_2/3.jpg', title: '协调训练' },
          { id: 4, image: '/images_2/4.jpg', title: '团队协作' }
        ]
      });
    },

    // 快捷入口 - 训练数据
    goToTrainingData() {
      wx.navigateTo({url:"/pages/users/children/index"})
    },

    // 快捷入口 - 课程表
    goToSchedule() {
      wx.navigateTo({url:`/pages/users/trainings/index?childId=${this.data.childInfo._id}`})
    },

    // 快捷入口 - 预约上课（新增）
    goToBookClass() {
      wx.switchTab({url:"/pages/users/orders/index"})
    },

    // 快捷入口 - 上课记录
    goToClassRecords() {
      wx.navigateTo({url:'/pages/users/class-records/index'})
    },

    // 快捷入口 - 课堂点评
    goToClassComments() {
      wx.navigateTo({url:'/pages/users/class-comments/index'})
    },

    // // 快捷入口 - 成长档案
    goToChildProfile() {
      wx.navigateTo({url:"/pages/users/child-profile/index"})
    },

    // 快捷入口 - 联系教练
    contactCoach() {
      wx.navigateTo({url:"/pages/users/coach-list/index"})
    },
    
    // 快捷入口 - 我的反馈
    goToFeedback() {
      wx.navigateTo({url:`/pages/users/my-feedback/index?childId=${this.data.childInfo._id}`})
    },

    // 关于我们
    aboutUs() {
      wx.navigateTo({url:"/pages/users/coach-list/index"})
    },

    // 查看更多动态
    viewAllNews() {
      wx.navigateTo({url:"/pages/users/news/index"})
    },

    // 查看动态详情
    viewNews(e) {
      const {id} = e.currentTarget.dataset;
      wx.navigateTo({url:`/pages/users/news-detail/index?id=${id}`});
    },

    // 查看更多精彩瞬间
    viewMoreMoments() {
      wx.navigateTo({ url: "/pages/users/moments/index" });
    },


    // 查看更多精彩瞬间详情
    viewMoment(e) {
      const {id} = e.currentTarget.dataset;
      console.log('----------------',id);
      wx.navigateTo({url:`/pages/users/moment-detail/index?id=${id}`});
    },

    //拨打电话
    callPhone() {
      wx.makePhoneCall({
        phoneNumber:"4008886666"
      });
    },
    
    // 查看地址
    viewAddress() {
      wx.openLocation({
        latitude: 39.9042,
        longitude: 116.4074,
        name: '北京市朝阳区体育中心',
        address: '北京市朝阳区体育中心'
      })
    },

    viewWechat() {
      wx.showModal({
        title:'官方微信',
        content:'微信号:sports_training\n\n请添加微信了解更多详情 ',
        confirmText: '复制微信号',
        success(res) {
          if(res.confirm) {
            wx.setClipboardData({
              data: 'sports_training',
              success() {
                wx.showToast({
                  title: '已复制',
                  icon:'success'
                })
              }
            })
          }
        }
      })
    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady() {

    },

    /**
     * 生命周期函数--监听页面显示
     */
    onShow() {
      console.log('🏠 首页 onShow 触发 - 时间:', new Date().toLocaleTimeString());
      this.loadChildInfo();
    },

    /**
     * 生命周期函数--监听页面隐藏
     */
    onHide() {

    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload() {

    },

    /**
     * 页面相关事件处理函数--监听用户下拉动作
     */
    onPullDownRefresh() {
      this.loadChildInfo();
      setTimeout(() => {
        wx.stopPullDownRefresh();
      }, 1000);
    },

    /**
     * 页面上拉触底事件的处理函数
     */
    onReachBottom() {
    

    },

    /**
     * 用户点击右上角分享
     */
    onShareAppMessage() {

    }
  })