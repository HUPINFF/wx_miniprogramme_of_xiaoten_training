// pages/users/class-comments/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    childInfo:null,
    classList:[],
    filterType:'all',
    loading:true,
    loadingMore:false,
    hasMore:true,
    pageSize:10,
    lastDoc:null,
    uncommentedCount: 0
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
      this.loadClassList();
    }
  },

  // 加载孩子信息
  loadChildInfo() {
    const openid = wx.getStorageSync('openid');
    const db = wx.cloud.database();

    db.collection('children').where({
      parentOpenId:openid
    }).get().then(res => {
      if(res.data.length > 0) {
        this.setData({childInfo:res.data[0]});
        this.loadClassList();
      }else {
        this.setData({loading:false});
      }
    }).catch(err => {
      console.error("加载孩子信息失败",err);
      this.setData({loading:false});
    })
  },

  // 加载课堂列表（只显示已完成的训练）
  loadClassList(isLoadMore = false) {
    if(!this.data.childInfo)return;

    if(isLoadMore) {
      this.setData({loadingMore:true});
    }else {
      this.setData({loading:true,classList:[],lastDoc:null,hasMore:true})
    }

    const db = wx.cloud.database();
    const _ = db.command;

    // // 获取今天的日期
    const today = this.getTodayString();

    // 构建查询条件:只显示日期 <= 今天的记录（已完成的训练）
    let query = db.collection('trainings').where({
      childId:this.data.childInfo._id,
      date:_.lte(today)
    });

    // 更具点评状态筛选
    if(this.data.filterType !== 'all') {
      const isCommented = this.data.filterType === 'commented';
      query = query.where({
        'comment.isCommented':isCommented
      });
    }

    // 排序
    query = query.orderBy('date','desc');

    // 分页
    if(isLoadMore && this.data.lastDoc) {
      query = query.orderBy('date', 'desc').limit(this.data.pageSize).startAfter(this.data.lastDoc);
    }else {
      query = query.orderBy('date', 'desc').limit(this.data.pageSize);
    }

    query.get().then(res => {
      const newList = res.data;

      // 计算待点评数量
      if(!isLoadMore) {
        this.countUncommented();
      }

      if(isLoadMore) {
        this.setData({
          classList:[...this.data.classList,...newList],
          loadingMore:false
        });
      }else {
        this.setData({
          classList:newList,
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
      console.error('加载课堂列表失败', err);
      this.setData({ loading: false, loadingMore: false });
    });
  },

  // 统计带点评数量
  countUncommented() {
    const db = wx.cloud.database();
    const _ = db.command;
    const today = this.getTodayString();

    db.collection('trainings').where({
      childId:this.data.childInfo._id,
      date: _.lte(today),
      'comment.isCommented': false
    }).count().then(res => {
      this.setData({ uncommentedCount: res.total });
    })
  },

  // 获取今天的日期字符串
  getTodayString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  
  // 筛选切换
  onFilterChange(e) {
    const type = e.currentTarget.dataset.type;
    if (type === this.data.filterType) return;
    
    this.setData({ 
      filterType: type,
      lastDoc: null,
      hasMore: true
    });
    this.loadClassList();
  },

  // 加载更多  id=f0df711e69c7bdb101f9cc0f68c24dd3&name=ggga&coach=李教练
  loadMore() {
    if (!this.data.hasMore || this.data.loadingMore) return;
    this.loadClassList(true);
  },

  // 跳转写点评页面
  goToComment(e) {
    const { id, name, coach } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/users/write-comment/index?id=${id}&name=${name}&coach=${coach}`
    });
  },

  // 预览照片
  previewPhoto(e) {

    // 获取当前点击的图片URL和所有图片URL数组
  const currentUrl = e.currentTarget.dataset.url;
  let urls = e.currentTarget.dataset.urls;
  
  // 如果 urls 是字符串，需要转换成数组
  if (typeof urls === 'string') {
    try {
      urls = JSON.parse(urls);
    } catch (err) {
      console.error('解析图片列表失败', err);
      urls = [currentUrl];
    }
  }
  
  // 如果 urls 不是数组，转为数组
  if (!Array.isArray(urls)) {
    urls = [currentUrl];
  }
    wx.previewImage({
      urls: urls,
      current:currentUrl
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
    this.loadClassList().then(() => {
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