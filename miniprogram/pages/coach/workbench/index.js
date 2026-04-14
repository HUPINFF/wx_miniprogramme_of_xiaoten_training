// pages/coach/workbench/index.js
Page({
  data: {
    coachInfo: {},
    todayDate: '',
    todayTrainings: [],
    todo: {
      weeklyPerformance: 0,
      feedback: 0,
      photos: 0
    },
    banners: [],
    newsList: [],
    moments: [],
    loading: true
  },

  onLoad() {
    this.setTodayDate();
    this.loadCoachInfo();
    this.loadTodayTrainings();
    this.loadTodoCount();
    this.loadHomeData();  // 新增：加载首页公共数据
  },

  setTodayDate() {
    const now = new Date();
    this.setData({
      todayDate: `${now.getMonth() + 1}月${now.getDate()}日`
    });
  },

  loadCoachInfo() {
    const openid = wx.getStorageSync('openid')
    const db = wx.cloud.database();
    db.collection('users').where({
      _openid:openid,
      role:'coach'
    }).get().then(res => {
      if(res.data.length > 0) {
        const coachInfo = res.data[0];
        console.log('从数据库获取的教练信息:', JSON.stringify(res.data[0]));
        console.log('------------',coachInfo);
        this.setData({coachInfo})
      }else {
        wx.showToast({ title: '未找到教练信息', icon: 'none' });
      }
    }).catch(err => {
      console.error('获取教练信息失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    })
    // const coachInfo = wx.getStorageSync('coachInfo') || {};
    // this.setData({ coachInfo });
  },

     // 组件更新时触发
  onCoachUpdate(e) {
    const { coachInfo } = e.detail;
    this.setData({ coachInfo });
  },

  loadTodayTrainings() {
    const db = wx.cloud.database();
    const today = this.getTodayDateString();
    
    db.collection('trainings').where({
      date: today,
      coachId: this.data.coachInfo._id
    }).get().then(res => {
      this.setData({ todayTrainings: res.data });
    });
  },

  loadTodoCount() {
    // 统计待办事项数量
    const db = wx.cloud.database();
    const _ = db.command;
    const coachId = this.data.coachInfo._ids;

    if(!coachId) return;

    // 获取当前周的起止日期
    const now = new Date();
    const weekRange = this.getCurrentWeekRange(now);

    // 1. 获取该教练负责的所有孩子
    db.collection('children').where({
      coachId:coachId
    }).get().then(res => {
      const children = res.data;
      const childIds = children.map(child => child._id);

      if(childIds.length === 0) {
        this.setData({
          'todo.weeklyPerformance': 0,
          'todo.feedback': 0
        });
        return;
      }

      //  // 2. 查询本周已录入表现的孩子

      return db.collection('performance').where({
        childId:_.in(childIds),
        weekRange:weekRange.start
      }).get().then(perfRes => {
        const hasPerformanceChildIds = perfRes.data.map(item => item.childId);

        // 3. 查询本周已写反馈的孩子
        return db.collection('feedbacks').where({
          childId: _.in(childIds),
          weekStart: weekRange.start
        }).get().then(feedbackRes => {
          const hasFeedbackChildIds = feedbackRes.data.map(item => item.childId);

            // 4. 计算未录入表现的孩子数
        const noPerformanceCount = childIds.filter(id => !hasPerformanceChildIds.includes(id)).length;

        // 5. 计算未写反馈的孩子数
        const noFeedbackCount = childIds.filter(id => !hasFeedbackChildIds.includes(id)).length;

        this.setData({
          'todo.weeklyPerformance': noPerformanceCount,
          'todo.feedback': noFeedbackCount
        });
        })
      })
    }).catch(err => {
      console.error('统计待办事项失败', err);
    });
    
    // 统计本周未录入表现的孩子数
    // 统计未写反馈
    // 统计未上传照片的训练记录
    // 这里简化处理，实际需要复杂查询
  },

  
// 获取当前周的起止日期
getCurrentWeekRange(date) {
  const monday = this.getMondayDate(date);
  const sunday = this.getSundayDate(date);
  
  const year = date.getFullYear();
  const weekStart = `${year}-${String(monday.month).padStart(2, '0')}-${String(monday.day).padStart(2, '0')}`;
  const weekEnd = `${year}-${String(sunday.month).padStart(2, '0')}-${String(sunday.day).padStart(2, '0')}`;
  
  return { start: weekStart, end: weekEnd };
},

// 获取周一日期
getMondayDate(date) {
  const monday = new Date(date);
  const day = monday.getDay() || 7;
  monday.setDate(monday.getDate() - day + 1);
  return {
    month: monday.getMonth() + 1,
    day: monday.getDate()
  };
},


// 获取周日日期
getSundayDate(date) {
  const sunday = new Date(date);
  const day = sunday.getDay() || 7;
  sunday.setDate(sunday.getDate() + (7 - day));
  return {
    month: sunday.getMonth() + 1,
    day: sunday.getDate()
  };
},

  getTodayDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  },


  // 新增：加载首页公共数据

  loadHomeData() {
    this.setData({loading:true});

    Promise.all([
      this.loadBanners(),
      this.loadNews(),
      this.loadMoments(),
    ]).then(() => {
      this.setData({loading:false});
    }).catch(err => {
      console.error("加载首页数据失败", err);
    })
  },

  // 新增：加载轮播图
  loadBanners() {
    const db = wx.cloud.database();
    return db.collection('banners').where({
      status: true
    }).orderBy('sort', 'asc').get().then(res => {
      this.setData({ banners: res.data });
    }).catch(err => {
      console.error("加载轮播图失败", err);
    });
  },

   // 新增：加载最新动态
   loadNews() {
    const db = wx.cloud.database();
    return db.collection('news').where({
      status: true
    }).orderBy('sort', 'asc').orderBy('time', 'desc').limit(5).get().then(res => {
      this.setData({ newsList: res.data });
    }).catch(err => {
      console.error("加载最新动态失败", err);
    });
  },

  // 新增：加载精彩瞬间
  loadMoments() {
    const db = wx.cloud.database();
    return db.collection("moments").where({
      status: true
    }).orderBy('sort', 'asc').limit(10).get().then(res => {
      this.setData({ moments: res.data });
    }).catch(err => {
      console.error("加载精彩瞬间失败", err);
    });
  },

  
  // ========== 下拉刷新 ==========
onPullDownRefresh() {
  console.log('下拉刷新');
  
  // 先刷新教练信息
  this.loadCoachInfo();
  
  // 延迟一下，等待 coachInfo 更新后再刷新其他数据
  setTimeout(() => {
    Promise.all([
      this.loadTodayTrainings(),
      this.loadHomeData()
    ]).then(() => {
      wx.stopPullDownRefresh();
      wx.showToast({ title: '刷新成功', icon: 'success', duration: 1000 });
    }).catch(err => {
      console.error('刷新失败', err);
      wx.stopPullDownRefresh();
      wx.showToast({ title: '刷新失败', icon: 'none' });
    });
  }, 500);
},

  // 新增：查看更多动态
  viewAllNews() {
    wx.navigateTo({ url: "/pages/users/news/index" });
  },

  // 新增：查看动态详情
  viewNews(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/users/news-detail/index?id=${id}` });
  },


  // 新增：查看更多精彩瞬间
  viewMoreMoments() {
    wx.navigateTo({ url: "/pages/users/moments/index" });
  },

  // 新增：查看精彩瞬间详情
  viewMoment(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/users/moment-detail/index?id=${id}` });
  },

  gotoChildrenList() {
    wx.navigateTo({ url: '/pages/coach/children/list/index' });
  },

  gotoWeeklyPerformance() {
    wx.navigateTo({ url: '/pages/coach/performance/weekly/index' });
  },

  gotoFeedback() {
    wx.navigateTo({ url: '/pages/coach/feedback/write/index' });
  },



  gotoAppointments() {
    wx.navigateTo({ url: '/pages/coach/appointments/index' });
  },

  // 跳转到内容管理页面
  gotoContentManage() {
    wx.navigateTo({
      url: '/pages/coach/content-manage/index'
    });
  },
});