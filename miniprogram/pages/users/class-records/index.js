// pages/users/class-records/index.js
const { getTrainingStatusMeta } = require('../../../utils/helper');

Page({

  /**
   * 页面的初始数据
   */
  data: { 
    childInfo:null,
    recordList:[],
    filterType:'all',
    loading:true,
    loadingMore:false,
    hasMore:true,
    pageSize:10,
    lastDoc:null
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadChildInfo();
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
    if (this.data.childInfo) {
      this.loadRecords();
    }
  },

  // 加载孩子信息
  loadChildInfo() {
    const openid = wx.getStorageSync('openid');
    const db = wx.cloud.database();
    
    db.collection('children').where({
      parentOpenId:openid
    }).get().then(res => {
      if(res.data.length > 0 ){
        this.setData({childInfo:res.data[0]});
        this.loadRecords();
      }else {
        this.setData({loading:false});
      }
    }).catch(err => {
      console.error('加载孩子信息失败',err);
      // 不置 false 的话 loading 永远为 true，页面无限转圈，连空态都不出现
      this.setData({ loading:false });
    });
  },


  // 加载训练记录（今天及以前的课次，新的在上、旧的在下）
  // 有返回值：onPullDownRefresh 靠它决定何时收起刷新动画
  loadRecords(isLoadMore = false) {
    if(!this.data.childInfo) return Promise.resolve();

    if(isLoadMore){
      this.setData({loadingMore:true});
    }else {
      this.setData({loading:true, recordList:[],lastDoc:null,hasMore:true});
    }

    // 请求代际号：刷新/切筛选会清空列表重查，此刻若还有一页 load-more 在途，
    // 它回来会把旧筛选的整页数据 append 进新列表、还用旧文档覆盖游标。
    // 给每次查询发号，回来时号对不上就整页丢弃。
    const seq = this._querySeq = (this._querySeq || 0) + 1;

    const db = wx.cloud.database();
    const _ = db.command;

    // 获取今天的日期
    const today = this.getTodayString();
    // 构建查询条件：只显示日期 <= 今天的记录。
    // ⚠️ 链式 where 对同一字段是「覆盖」不是「叠加」——月份筛选若另起一个
    //    where({date: 区间})，会把 date<=today 整个替换掉：本月的区间终点在
    //    未来，教练预建的未来课次就会漏进「训练记录」。所以时间条件必须
    //    合成一个指令放进同一次 where（单 where 双边界，同 admin/dashboard 写法）。
    let dateCond = _.lte(today);
    // 根据时间筛选 （全部里再筛本月/上月）
    if(this.data.filterType !== 'all') {
      const dateRange = this.getDateRange();
      if(dateRange) {
        dateCond = _.gte(dateRange.start).and(_.lte(dateRange.end)).and(_.lte(today));
      }
    }
    let query = db.collection('trainings').where({
      childId:this.data.childInfo._id,
      date:dateCond   //只显示今天及之前的训练记录（月份筛选在此之上收窄）
    });

    // 排序：新的在上；同一天多节课按开始时间排（旧文档可能没 startTime，按空值沉底）。
    // 末位追加 _id 兜底：同日同分钟（或缺 startTime）的文档排序键完全相同，
    // startAfter 游标分不清它们，页界恰好落在中间会静默漏记录——_id 让所有排序元组唯一。
    query = query.orderBy('date','desc').orderBy('startTime','desc').orderBy('_id','asc');

    // 分页（游标用上一页最后一条原文档，同 moments 页的写法）
    if(isLoadMore && this.data.lastDoc) {
      query = query.limit(this.data.pageSize).startAfter(this.data.lastDoc);
    }else {
      query = query.limit(this.data.pageSize);
    }

    return query.get().then(res => {
      if (seq !== this._querySeq) return;   // 已有更新的查询发出，这页过期数据丢弃
      const newList = res.data;
      // 列表只放展示字段；分页游标仍用原文档（lastDoc 从 newList 取）
      const displayList = newList.map(t => this.formatRecord(t));

      if(isLoadMore) {
        this.setData({
          recordList:[...this.data.recordList,...displayList],
          loadingMore:false
        });
      }else {
        this.setData({
          recordList:displayList,
          loading:false
        });
      }
       // 判断是否还有更多
       if (newList.length < this.data.pageSize) {
        this.setData({ hasMore: false });
      } else if (newList.length > 0) {
        this.setData({ lastDoc: newList[newList.length - 1] });
      }
    }).catch(err => {
      console.error('加载训练记录失败', err);
      if (seq !== this._querySeq) return;   // 过期请求的失败别去动新查询的状态
      this.setData({ loading: false, loadingMore: false });
    });
  },

  // 一条课次文档 → 列表行。旧文档缺字段一律兜空，wxml 按空值隐藏对应元素
  formatRecord(t) {
    const status = getTrainingStatusMeta(t.status);
    const items = Array.isArray(t.items) ? t.items : [];
    const photos = Array.isArray(t.classPhotos) ? t.classPhotos : [];
    const videos = Array.isArray(t.classVideos) ? t.classVideos : [];
    const date = t.date || '';

    let timeText = '';
    if (t.startTime) {
      timeText = t.endTime ? t.startTime + '-' + t.endTime : t.startTime;
    } else if (t.time) {
      timeText = t.time;   // 兼容旧数据
    }

    return {
      _id: t._id,
      day: date ? String(parseInt(date.slice(8, 10), 10)) : '',   // 去前导零，与旁边「M月D日」同一格式
      monthDay: date ? parseInt(date.slice(5, 7), 10) + '月' + parseInt(date.slice(8, 10), 10) + '日' : '',
      weekday: date ? '周' + this.getWeekday(date) : '',
      name: t.name || t.coachContent || '训练',
      // wxml 固定拼「教练」后缀，这里再兜「教练」会渲染出「教练教练」
      coachName: t.coachName || '',
      timeText: timeText,
      statusText: status.text,
      statusType: status.type,
      // 组数/个数的明细在训练详情里看，列表给个完成进度就够
      doneText: items.length ? '已完成 ' + items.filter(it => it && it.done).length + '/' + items.length + ' 项' : '',
      photoCount: photos.length,
      videoCount: videos.length
    };
  },

  // '2026-09-18' → '四'（UTC 午夜换算成东八区仍是当天上午，直接 getDay 不会差一天）
  getWeekday(dateStr) {
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '' : weekdays[d.getDay()];
  },


  // 获取今天的日期字符串
  getTodayString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

   // 获取日期范围
   getDateRange() {
    const now = new Date();
    
    switch (this.data.filterType) {
      case 'thisMonth':
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;
        return { start: monthStart, end: monthEnd };
        
      case 'lastMonth':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthStart = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-01`;
        const lastMonthEnd = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-${new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).getDate()}`;
        return { start: lastMonthStart, end: lastMonthEnd };
        
      default:
        return null;
    }
  },

  // 筛选切换
  onFilterChange(e) {
    const type = e.currentTarget.dataset.type;
    if(type === this.data.filterType) return;

    this.setData({
      filterType:type,
      lastDoc:null,
      hasMore:true
    });
    this.loadRecords();
  },

  //  加载更多
  loadMore() {
    // loading 也拦：全量刷新在途时列表刚被清空，触底会退化成重拉第一页，
    // 刷新先回来就把同一页 append 两遍
    if(!this.data.hasMore || this.data.loadingMore || this.data.loading) return;
    this.loadRecords(true);
  },

  // 查看记录详情（家长端详情页：完成情况/照片/视频都看得到）
  viewRecordDetail(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;
    wx.navigateTo({
      url: `/pages/users/training-detail/index?id=${id}`
    });
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
    this.setData({ lastDoc: null, hasMore: true });
    this.loadRecords().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    this.loadMore();
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})