// pages/users/class-records/index.js
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
    });
  },


  // 加载上课记录（只显示已完成的训练）
  loadRecords(isLoadMore = false) {
    if(!this.data.childInfo) return;

    if(isLoadMore){
      this.setData({loadingMore:true});
    }else {
      this.setData({loading:true, recordList:[],lastDoc:null,hasMore:true});
    }

    const db = wx.cloud.database();
    const _ = db.command;

    // 获取今天的日期
    const today = this.getTodayString();
    // 构建查询条件:只显示日期 <= 今天的记录
    let query = db.collection('trainings').where({
      childId:this.data.childInfo._id,
      date:_.lte(today)   //只显示今天及之前的训练记录
    });

    // 根据时间筛选 （在已完成的记录中再筛选本月/上月）
    if(this.data.filterType !== 'all') {
      const dateRange = this.getDateRange();
      if(dateRange) {
        query = query.where({
          date:_.gte(dateRange.start).and(_.lte(dateRange.end))
        });
      }
    }

    // 排序
    query = query.orderBy('date','desc');

    // 分页
    if(isLoadMore && this.data.lastDoc) {
      query = query.orderBy('date',desc).limit(this.data.pageSize).startAfter(this.data.lastDoc)
    }else {
      query = query.orderBy('date', 'desc').limit(this.data.pageSize);
    }

    query.get().then(res => {
      const newList = res.data;
      if(isLoadMore) {
        this.setData({
          recordList:[...this.data.recordList,...newList],
          loadingMore:false
        });
      }else {
        this.setData({
          recordList:newList,
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
      console.error('加载上课记录失败', err);
      this.setData({ loading: false, loadingMore: false });
    });
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
    if(!this.data.hasMore || this.data.loadingMore) return;
    this.loadRecords(true);
  },

  // 查看记录详情
  viewRecordDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/users/record-detail/index?id=${id}`
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