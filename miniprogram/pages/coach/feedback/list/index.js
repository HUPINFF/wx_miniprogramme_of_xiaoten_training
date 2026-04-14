// pages/coach/feedback/list/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    childId:'',
    childName:'',
    feedbackList:[],
    filterType:'all',  // 筛选类型: all, thisWeek, lastWeek, thisMonth
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
    const {childId ,childName} = options;
    this.setData({
      childId:childId || '',
      childName:childName ||''
    });

    // 设置导航栏标题
    if(childName) {
      wx.setNavigationBarTitle({title:`${childName}的反馈记录`})
    }
    this.loadFeedbackList();
  },

  // 加载反馈列表
  loadFeedbackList(isLoadMore = false) {
    if(isLoadMore) {
      this.setData({loadingMore:true});
    }else {
      this.setData({loading:true ,feedbackList:[],lastDoc:null,hasMore:true});
    }

    const db = wx.cloud.database();
    const _ =db.command;

    // 构建查询条件
    let query = db.collection('feedbacks');
    // 根据孩子ID筛选
    if(this.data.childId) {
      query = query.where({childId:this.data.childId});
    }

    // 根据时间筛选
    if(this.filterType !== 'all') {
      const dateRange = this.getDateRange();
      if(dateRange) {
        query = query.where({
          date:_.gte(dateRange.start).and(_.lte(dateRange.end))
        });
      }
    }

    // 排序
    query = query.orderBy('date','desc');

    //分页
    if(isLoadMore && this.data.lastDoc) {
      query = query.orderBy('date','desc').limit(this.data.pageSize).startAfter(this.data.lastDoc)
    }else {
      query = query.orderBy('date','desc').limit(this.data.pageSize)
    }

    query.get().then(res => {
      const newList = res.data;
      
      if(isLoadMore) {
        this.setData({
          feedbackList:[...this.data.feedbackList,...newList],
          loadingMore:false
        });
      }else {
        this.setData({
          feedbackList:newList,
          loading:false
        });
      }

      //判断是否还有更多
      if(newList.length < this.data.pageSize) {
        this.setData({hasMore:false});
      }else if(newList.length > 0) {
        this.setData({lastDoc:newList[newList.length-1]});
      }
    }).catch(err => {
      console.error('加载反馈列表失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false, loadingMore: false });
    });
  },

  // 获取日期范围
  getDateRange() {
    const now = new Date();
    const today = this.formatDate(now);

    switch(this.data.filterType) {
      case 'thisWeek':
        const weekStart = this.getWeekStart(now);
        const weekEnd = this.getWeekEnd(now);
        return {start:weekStart,end:weekEnd};

      case 'lastWeek':
        const lastWeekStart = this.getLastWeekStart(now);
        const lastWeekEnd = this.getLastWeekEnd(now);
        return {start:lastWeekEnd,end:lastWeekEnd};

      case 'thisMonth':
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;
        return { start: monthStart, end: monthEnd };

      default:
        return null;
    }
  },

  // 格式化日期
  formatDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  },

  // 获取本周开始日期（周一）
  getWeekStart(date) {
    const monday = new Date(date);
    const day = monday.getDay() || 7;
    monday.setDate(monday.getDate() - day + 1);
    return this.formatDate(monday);
  },

   // 获取本周结束日期（周日）
   getWeekEnd(date) {
    const sunday = new Date(date);
    const day = sunday.getDay() || 7;
    sunday.setDate(sunday.getDate() + (7 - day));
    return this.formatDate(sunday);
  },

   // 获取上周开始日期
   getLastWeekStart(date) {
    const lastWeek = new Date(date);
    lastWeek.setDate(lastWeek.getDate() - 7);
    return this.getWeekStart(lastWeek);
  },

  // 获取上周结束日期
  getLastWeekEnd(date) {
    const lastWeek = new Date(date);
    lastWeek.setDate(lastWeek.getDate() - 7);
    return this.getWeekEnd(lastWeek);
  },

  // 筛选切换
  onFilterChange(e){
    const type = e.currentTarget.dataset.type;
    if(type === this.data.filterType) return;
    this.setData({
      filterType:type,
      lastDoc:null,
      hasMore:true
    })
    this.loadFeedbackList();
  },

  // 加载更多
  loadMore() {
    if(!this.data.hasMore || this.data.loadingMore) return;
    this.loadFeedbackList();
  },

  //  查看反馈详情
  viewFeedbackDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/coach/feedback/detail/index?id=${id}`
    });
  },

  // 编辑反馈
  editFeedback(e) {
    const {id} = e.currentTarget.dataset;
    // e.stopPropagation();// 阻止冒泡，避免触发卡片点击

    wx.navigateTo({
      url: `/pages/coach/feedback/write/index?childId=${this.data.childId}&id=${id}`,
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
    this.setData({lastDoc:null,hasMore:true});
    this.loadFeedbackList().then(() => {
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