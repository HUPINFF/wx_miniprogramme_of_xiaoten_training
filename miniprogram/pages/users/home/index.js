// pages/users/profile/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    loading: true,  // 控制骨架屏显示
    statusBarHeight: 0,    //状态栏高度
    navBarHeight: 0,       //导航栏总高度
    menuButtonInfo: {},    //胶囊按钮信息

    // 家长信息
    parentInfo: {},
    // 孩子信息
    childInfo: null,

    // 轮播图数据
    banners: [],
    // 最新状态
    newList: [],
    // 精彩瞬间
    moments: [],
    // 家长点评
    comments: [],
    // 成长案例
    growthList: [],
    // 课程体系
    courseList: [],
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 初始化导航栏信息
    this.initNavBar();
    
    // 获取家长信息
    this.loadParentInfo();
    
    // 加载首页数据（包含孩子信息）
    this.loadHomeData();
  },

  /**
   * 初始化导航栏信息
   */
  initNavBar() {
    try {
      const windowInfo = wx.getWindowInfo();
      const statusBarHeight = windowInfo.statusBarHeight;
      const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
      const navBarHeight = menuButtonInfo.bottom;

      this.setData({
        statusBarHeight,
        navBarHeight,
        menuButtonInfo
      });
    } catch (error) {
      console.error('初始化导航栏失败:', error);
    }
  },

  /**
   * 加载家长信息
   */
  loadParentInfo() {
    try {
      const userInfo = wx.getStorageSync('userInfo') || {};
      this.setData({ parentInfo: userInfo });
    } catch (error) {
      console.error('加载家长信息失败:', error);
    }
  },

  /**
   * 加载孩子信息
   */
  loadChildInfo() {
    const openid = wx.getStorageSync('openid');
    
    if (!openid) {
      console.warn('未获取到 openid');
      return Promise.resolve();
    }
    
    const db = wx.cloud.database();
    return db.collection('children')
      .where({
        parentOpenId: openid
      })
      .get()
      .then(res => {
        if (res.data && res.data.length > 0) {
          this.setData({ 
            childInfo: res.data[0] 
          });
        } else {
          console.log('未找到孩子信息');
          this.setData({ childInfo: null });
        }
      })
      .catch(err => {
        console.error('加载孩子信息失败:', err);
        this.setData({ childInfo: null });
      });
  },

  /**
   * 加载首页数据
   */
  loadHomeData() {
    // 显示骨架屏
    this.setData({ loading: true });

    // 使用 Promise.allSettled 确保即使部分请求失败也能正常显示
    Promise.allSettled([
      this.loadBanners(),
      this.loadNews(),
      this.loadMoments(),
      this.loadComments(),
      this.loadGrowthList(),
      this.loadCourseList(),
      this.loadChildInfo()  // 包含孩子信息加载
    ]).then((results) => {
      // 检查是否所有请求都失败了
      const allFailed = results.every(result => result.status === 'rejected');
      
      if (allFailed) {
        console.warn('所有数据加载失败，使用默认数据');
        this.loadDefaultData();
      }
      
      // 无论成功失败，都隐藏骨架屏
      this.setData({ loading: false });
      
      // 打印加载结果统计
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      console.log(`首页数据加载完成: ${successCount}/${results.length} 成功`);
    });
  },

  /**
   * 加载轮播图
   */
  loadBanners() {
    const db = wx.cloud.database();
    return db.collection('banners')
      .where({
        status: true
      })
      .orderBy('sort', 'asc')
      .get()
      .then(res => {
        if (res.data && res.data.length > 0) {
          this.setData({ banners: res.data });
          console.log('轮播图加载成功:', res.data.length, '条');
        } else {
          console.log('暂无轮播图数据');
          this.setData({ banners: [] });
        }
      })
      .catch(err => {
        console.error('加载轮播图失败:', err);
        this.setData({ banners: [] });
        throw err;  // 抛出错误以便 Promise.allSettled 捕获
      });
  },

  /**
   * 加载最新动态
   */
  loadNews() {
    const db = wx.cloud.database();
    return db.collection('news')
      .where({
        status: true
      })
      .orderBy('sort', 'asc')
      .orderBy('time', 'desc')
      .limit(5)
      .get()
      .then(res => {
        if (res.data && res.data.length > 0) {
          this.setData({ newList: res.data });
          console.log('最新动态加载成功:', res.data.length, '条');
        } else {
          console.log('暂无最新动态');
          this.setData({ newList: [] });
        }
      })
      .catch(err => {
        console.error('加载最新动态失败:', err);
        this.setData({ newList: [] });
        throw err;
      });
  },

  /**
   * 加载精彩瞬间
   */
  loadMoments() {
    const db = wx.cloud.database();
    return db.collection("moments")
      .where({
        status: true
      })
      .orderBy('sort', 'asc')
      .limit(10)
      .get()
      .then(res => {
        if (res.data && res.data.length > 0) {
          this.setData({ moments: res.data });
          console.log('精彩瞬间加载成功:', res.data.length, '条');
        } else {
          console.log('暂无精彩瞬间');
          this.setData({ moments: [] });
        }
      })
      .catch(err => {
        console.error('加载精彩瞬间失败:', err);
        this.setData({ moments: [] });
        throw err;
      });
  },

  /**
   * 加载家长点评
   */
  loadComments() {
    const db = wx.cloud.database();
    return db.collection('comment')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get()
      .then(res => {
        if (res.data && res.data.length > 0) {
          // 格式化时间
          const comments = res.data.map(item => ({
            ...item,
            createTime: item.createdAt ? this.formatTime(item.createdAt) : ''
          }));
          this.setData({ comments });
          console.log('家长点评加载成功:', comments.length, '条');
        } else {
          console.log('暂无家长点评');
          this.setData({ comments: [] });
        }
      })
      .catch(err => {
        console.error('加载点评失败:', err);
        this.setData({ comments: [] });
        throw err;
      });
  },

  /**
   * 加载成长案例
   */
  loadGrowthList() {
    const db = wx.cloud.database();
    return db.collection('growth_exp')
      .where({ status: true })
      .orderBy('sort', 'asc')
      .limit(5)
      .get()
      .then(res => {
        if (res.data && res.data.length > 0) {
          const growthList = res.data.map(item => {
            // 计算案例数量
            let itemCount = 0;
            let coverImage = '';
            
            if (item.items && item.items.length > 0) {
              itemCount = item.items.length;
              coverImage = item.items[0].url || '';
            }
            
            // 格式化创建时间
            let createdAt = '';
            if (item.createdAt) {
              createdAt = this.formatTime(item.createdAt);
            }
            
            return {
              ...item,
              itemCount,
              coverImage,
              createdAt
            };
          });
          
          this.setData({ growthList });
          console.log('成长案例加载成功:', growthList.length, '条');
        } else {
          console.log('暂无成长案例');
          this.setData({ growthList: [] });
        }
      })
      .catch(err => {
        console.error('加载成长案例失败:', err);
        this.setData({ growthList: [] });
        throw err;
      });
  },

  /**
   * 加载课程列表
   */
  loadCourseList() {
    const db = wx.cloud.database();
    return db.collection('course')
      .where({ status: true })
      .orderBy('sort', 'asc')
      .limit(10)
      .get()
      .then(res => {
        if (res.data && res.data.length > 0) {
          this.setData({ courseList: res.data });
          console.log('课程列表加载成功:', res.data.length, '条');
        } else {
          console.log('暂无课程数据');
          this.setData({ courseList: [] });
        }
      })
      .catch(err => {
        console.error('加载课程列表失败:', err);
        this.setData({ courseList: [] });
        throw err;
      });
  },

  /**
   * 格式化时间
   */
  formatTime(date) {
    if (!date) return '';
    
    try {
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error('时间格式化失败:', error);
      return '';
    }
  },

  /**
   * 默认数据（当数据库无数据或加载失败时显示）
   */
  loadDefaultData() {
    this.setData({
      loading: false,
      banners: [
        { image: '/images_2/1.jpg', text: '暑期训练营火热招生中' },
        { image: '/images_2/2.jpg', text: '国家级教练团队' },
        { image: '/images_2/3.jpg', text: '科学训练体系' }
      ],
      newList: [
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

  // ==================== 快捷入口 ====================

  /**
   * 快捷入口 - 训练数据
   */
  goToTrainingData() {
    wx.navigateTo({ url: "/pages/users/children/index" });
  },

  /**
   * 快捷入口 - 课程表
   */
  goToSchedule() {
    const childId = this.data.childInfo?._id;
    if (!childId) {
      wx.showToast({ title: '请先添加孩子信息', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/users/trainings/index?childId=${childId}` });
  },

  /**
   * 快捷入口 - 预约上课
   */
  goToBookClass() {
    wx.switchTab({ url: "/pages/users/orders/index" });
  },

  /**
   * 快捷入口 - 上课记录
   */
  goToClassRecords() {
    wx.navigateTo({ url: '/pages/users/class-records/index' });
  },

  /**
   * 快捷入口 - 课堂点评
   */
  goToClassComments() {
    wx.navigateTo({ url: '/pages/users/class-comments/index' });
  },

  /**
   * 快捷入口 - 成长案例
   */
  goToChildProfile() {
    wx.navigateTo({ url: "/pages/users/all-growth/index" });
  },

  /**
   * 快捷入口 - 联系教练
   */
  contactCoach() {
    wx.navigateTo({ url: "/pages/users/coach-list/index" });
  },

  /**
   * 快捷入口 - 我的反馈
   */
  goToFeedback() {
    const childId = this.data.childInfo?._id;
    if (!childId) {
      wx.showToast({ title: '请先添加孩子信息', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/users/my-feedback/index?childId=${childId}` });
  },

  /**
   * 加入我们 - 预约教练
   */
  goToBookCoach() {
    wx.navigateTo({ url: '/pages/users/book-coach/index' });
  },

  // ==================== 查看详情 ====================

  /**
   * 查看全部动态
   */
  viewAllNews() {
    wx.navigateTo({ url: "/pages/users/news/index" });
  },

  /**
   * 查看动态详情
   */
  viewNews(e) {
    const { id } = e.currentTarget.dataset;
    if (id) {
      wx.navigateTo({ url: `/pages/users/news-detail/index?id=${id}` });
    }
  },

  /**
   * 查看全部点评
   */
  viewAllComments() {
    wx.navigateTo({ url: '/pages/coach/all-comments/index' });
  },

  /**
   * 查看点评详情
   */
  viewCommentDetail(e) {
    const { id } = e.currentTarget.dataset;
    if (id) {
      wx.navigateTo({ url: `/pages/coach/comment-detail/index?id=${id}` });
    }
  },

  /**
   * 查看全部成长案例
   */
  viewAllGrowth() {
    wx.navigateTo({ url: '/pages/users/all-growth/index' });
  },

  /**
   * 查看成长案例详情
   */
  viewGrowthDetail(e) {
    const { id } = e.currentTarget.dataset;
    if (id) {
      wx.navigateTo({ url: `/pages/users/growth-detail/index?id=${id}` });
    }
  },

  /**
   * 查看全部课程
   */
  viewAllCourses() {
    wx.navigateTo({ url: '/pages/users/all-courses/index' });
  },

  /**
   * 查看课程详情
   */
  viewCourseDetail(e) {
    const { id } = e.currentTarget.dataset;
    if (id) {
      wx.navigateTo({ url: `/pages/users/course-detail/index?id=${id}` });
    }
  },

  /**
   * 查看更多精彩瞬间
   */
  viewMoreMoments() {
    wx.navigateTo({ url: "/pages/users/moments/index" });
  },

  /**
   * 查看精彩瞬间详情
   */
  viewMoment(e) {
    const { id } = e.currentTarget.dataset;
    if (id) {
      wx.navigateTo({ url: `/pages/users/moment-detail/index?id=${id}` });
    } else {
      console.warn('精彩瞬间 ID 为空');
    }
  },

  /**
   * 关于我们
   */
  aboutUs() {
    wx.navigateTo({ url: "/pages/users/coach-list/index" });
  },

  // ==================== 联系功能 ====================

  /**
   * 拨打电话
   */
  callPhone() {
    wx.makePhoneCall({
      phoneNumber: "19212218300",
      fail(err) {
        console.error('拨打电话失败:', err);
        wx.showToast({ title: '拨号失败', icon: 'none' });
      }
    });
  },

  /**
   * 查看地址
   */
  viewAddress() {
    wx.openLocation({
      latitude: 39.1024,   // 天津师范大学纬度
      longitude: 117.1256, // 天津师范大学经度
      name: '天津师范大学',
      address: '天津市西青区宾水西道393号',
      scale: 15,
      fail(err) {
        console.error('打开地图失败:', err);
        wx.showToast({ title: '打开地图失败', icon: 'none' });
      }
    });
  },

  /**
   * 查看微信
   */
  viewWechat() {
    wx.showModal({
      title: '官方微信',
      content: '微信号：The120307\n\n请添加微信了解更多详情',
      confirmText: '复制微信号',
      cancelText: '取消',
      success(res) {
        if (res.confirm) {
          wx.setClipboardData({
            data: 'The120307',
            success() {
              wx.showToast({
                title: '已复制微信号',
                icon: 'success',
                duration: 2000
              });
            },
            fail() {
              wx.showToast({
                title: '复制失败',
                icon: 'none'
              });
            }
          });
        }
      }
    });
  },

  // ==================== 生命周期 ====================

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {
    console.log('首页渲染完成');
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    console.log('🏠 首页 onShow 触发 - 时间:', new Date().toLocaleTimeString());
    
    // 每次显示页面时刷新孩子信息和点评数据
    this.loadChildInfo();
    this.loadComments();
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {
    console.log('首页隐藏');
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    console.log('首页卸载');
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    console.log('下拉刷新');
    this.loadHomeData().then(() => {
      wx.stopPullDownRefresh();
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1500
      });
    }).catch(() => {
      wx.stopPullDownRefresh();
      wx.showToast({
        title: '刷新失败',
        icon: 'none',
        duration: 1500
      });
    });
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    // 可以在这里实现加载更多功能
    console.log('触底');
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    return {
      title: '腾讯体育 - 记录每一次进步',
      path: '/pages/users/profile/index',
      imageUrl: '/images_1/logo_20251126_34991.uugai.com-1764133166493.png'
    };
  }
});