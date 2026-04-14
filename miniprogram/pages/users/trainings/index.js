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

  // 加载课程表(只显示未来的)
  loadSchedule() {
    this.setData({loading:true});

    const db = wx.cloud.database();
    const _ = db.command;
    const today = this.getTodayString();

    // // 查询未来的训练记录（date >= 今天）
    db.collection('trainings').where({
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
      
      trainings.forEach(item => {
        const date = item.date;
        if (!grouped[date]) {
          grouped[date] = [];
        }

        let displayTime = '';
        if(item.startTime) {
          displayTime = item.startTime;
          if(item.endTime) {
            displayTime = `${item.startTime} - ${item.endTime}`;
          }
        }else if(item.time) {
           // 兼容旧数据
           displayTime = item.time;
        }

        grouped[date].push({
          startTime: item.startTime,     // 【新增】开始时间
          endTime: item.endTime,         // 【新增】结束时间
          duration: item.duration,       // 【新增】时长
          time: item.time,
          name: item.name,
          coach: item.coachName,
          id:item._id 
        });
      });
      
      // 转换为数组格式
      const result = Object.keys(grouped).map(date => {
        const weekday = this.getWeekday(date);
        // 修改 ，按开始时间排序课程
        const courses = grouped[date].sort((a,b) => {
          return (a.startTime || '00:00').localeCompare(b.startTime || '00:00');
        })
        return {
          date: date,
          weekday: weekday,
          count: grouped[date].length,
          courses: courses
        };
      });
       // 按日期排序
      result.sort((a, b) => a.date.localeCompare(b.date));
      
      return result;
    },

     // 获取星期几
  getWeekday(dateStr) {
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const date = new Date(dateStr);
    return weekdays[date.getDay()];
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