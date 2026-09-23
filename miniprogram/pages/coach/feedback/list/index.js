// pages/coach/feedback/list/index.js
const auth = require('../../../../utils/auth');

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
    // 未带 childId 的入口（我的 → 训练反馈）按当前教练过滤，口径同训练记录页
    this.coachId = auth.getCoachId() || '';
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
    // 根据孩子ID筛选（学员详情进入）
    if(this.data.childId) {
      query = query.where({childId:this.data.childId});
    } else if(this.coachId) {
      // 未带 childId 的入口只看自己写的反馈，否则会把所有教练的反馈都拉出来
      query = query.where({coachId: this.coachId});
    } else {
      // 连教练身份都没有：宁可空列表也不能把全部反馈亮出来
      wx.showToast({ title: '未获取到教练身份', icon: 'none' });
      this.setData({ feedbackList: [], loading: false, hasMore: false });
      return;
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

    query.get().then(async res => {
      const newList = res.data;

      // 先核对课次是否还在：课次被删（如清理学员数据后遗留的反馈）时
      // 「编辑」进课后记录只会报「课次加载失败」，这里提前标记、拦在列表页
      await this.markMissingTrainings(newList);

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

  // 标记 trainingId 指向的课次已不存在的反馈（孤儿反馈）。
  // 一页最多 10 条反馈、去重后的 id 数不会超过单次 get 的 20 条上限；
  // 核对查询本身失败时不标记（fail-open，保持原跳转行为）。
  async markMissingTrainings(list) {
    const db = wx.cloud.database();
    const _ = db.command;
    const trainingIds = Array.from(new Set(list.map(f => f.trainingId).filter(Boolean)));
    if (!trainingIds.length) return;

    const alive = new Set();
    try {
      const res = await db.collection('trainings').where({ _id: _.in(trainingIds) }).get();
      res.data.forEach(t => alive.add(t._id));
    } catch (err) {
      console.error('核对课次存在性失败', err);
      return;
    }

    list.forEach(f => {
      if (f.trainingId && !alive.has(f.trainingId)) f.trainingMissing = true;
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

  // 编辑反馈：每课反馈（带 trainingId）进结构化编辑器，旧的周反馈留在原编辑器；
  // 课次已被删除的孤儿反馈不再跳转（跳过去只会「课次加载失败」），直接给提示
  editFeedback(e) {
    const {id} = e.currentTarget.dataset;
    // e.stopPropagation();// 阻止冒泡，避免触发卡片点击
    const item = (this.data.feedbackList || []).find(f => f._id === id);
    if (!item) return;

    if (item.trainingId) {
      if (item.trainingMissing) {
        wx.showToast({ title: '原课次已删除，无法编辑', icon: 'none' });
        return;
      }
      wx.navigateTo({
        url: `/pages/coach/post-class/index?id=${item.trainingId}&childId=${item.childId}&mode=edit`,
      });
      return;
    }

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