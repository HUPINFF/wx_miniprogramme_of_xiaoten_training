// pages/users/trainings/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    childId:null,
    schedule :[],
    loading:true,
    currentYearMonth:''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const { childId } = options;
    this.setData({ childId: childId })
    this.setCurrentYearMonth();
    this.loadSchedule();
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
    this.loadSchedule();
  },

  // 设置当前年月显示
  setCurrentYearMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() +1;
    this.setData({
      currentYearMonth: `${year}年${month}月`
    });
  },

  // 加载课程表(只显示未来的)。返回 promise：下拉刷新要等查询结束再 stopPullDownRefresh
  loadSchedule() {
    this.setData({loading:true});

    const db = wx.cloud.database();
    const _ = db.command;
    const today = this.getTodayString();

    // 查询未来的训练记录（date >= 今天）
    return db.collection('trainings').where({
      childId:this.data.childId,
      date:_.gte(today)
    }).orderBy('date','asc').get().then(res => {
      const trainings = res.data;
      const schedule = this.groupByDate(trainings);
      this.setData({
        schedule:schedule,
        loading:false
      })
    }).catch(err => {
      console.error('加载课程表失败', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    })
  },

    // 按日期分组
    groupByDate(trainings) {
      const grouped = {};
      const today = this.getTodayString();

      trainings.forEach(item => {
        const date = item.date;
        if (!grouped[date]) {
          grouped[date] = [];
        }

        // 主时间行：开始时间（旧数据只有 time 字段也兜住）
        const startTime = item.startTime || item.time || '';
        // 次行：结束时间 + 时长拼一句（「– 11:00 · 60分钟」），没有就空串隐藏
        const subParts = [];
        if (item.startTime && item.endTime) subParts.push('– ' + item.endTime);
        if (item.duration) subParts.push(item.duration);

        grouped[date].push({
          startTime: startTime,
          subTime: subParts.join(' · '),
          name: item.name,
          coach: item.coachName,
          id: item._id
        });
      });

      // 转换为数组格式
      const result = Object.keys(grouped).map(date => {
        const weekday = this.getWeekday(date);
        // 按开始时间排序课程
        const courses = grouped[date].sort((a,b) => {
          return (a.startTime || '00:00').localeCompare(b.startTime || '00:00');
        })
        return {
          date: date,
          weekday: weekday,
          dateText: this.formatDayLabel(date, today),  // 今天/明天/9月24日
          isToday: date === today,
          count: grouped[date].length,
          courses: courses
        };
      });
      // 按日期排序
      result.sort((a, b) => a.date.localeCompare(b.date));

      return result;
    },

    // 日期友好文案：今天/明天，其余「M月D日」——替代冷冰冰的 2026-09-24
    formatDayLabel(dateStr, todayStr) {
      const diffDays = Math.round(
        (new Date(dateStr).getTime() - new Date(todayStr).getTime()) / 86400000
      );
      if (diffDays === 0) return '今天';
      if (diffDays === 1) return '明天';
      const d = new Date(dateStr);
      return (d.getMonth() + 1) + '月' + d.getDate() + '日';
    },

     // 获取星期几
  getWeekday(dateStr) {
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const date = new Date(dateStr);
    return weekdays[date.getDay()];
  },

  // 自定义头部的返回键：栈里有上一页就返回，否则回首页（分享/扫码直接进来的场景）
  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
    } else {
      wx.switchTab({ url: '/pages/users/home/index' });
    }
  },

  /** 课程项 → 训练详情（与首页「当前情况」卡同一目的地） */
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: '/pages/users/training-detail/index?id=' + id });
  },

  // 获取今天的日期字符串
  getTodayString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
    this.loadSchedule().then(() => {
      wx.stopPullDownRefresh();
    });
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