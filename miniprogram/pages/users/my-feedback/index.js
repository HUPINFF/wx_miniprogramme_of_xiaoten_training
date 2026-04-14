// pages/users/my-feedback/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    childInfo:null,
    feedbackList:[],
    totalCount : 0,
    avgRating:0,
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
    // this.loadFeedbackList();
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
    if(this.data.childInfo) {
      this.loadFeedbackList();
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
        this.loadFeedbackList();
      }else {
        this.setData({loading:false});
      }
    }).catch(err => {
      console.error('加载孩子信息失败',err);
    });
  },

  // 加载教练反馈列表（从 feedbacks 集合）
  loadFeedbackList(isLoadMore = false) {
    if(!this.data.childInfo) return; 

    if(isLoadMore) {
      this.setData({loadingMore:true}); 
    }else {
      this.setData({loading:true ,feedbackList:[],lastDoc:null,hasMore:true});
    }

    const db = wx.cloud.database();
    let query = db.collection('feedbacks').where({
      childId:this.data.childInfo._id
    });

    query = query.orderBy('date','desc');

    if(isLoadMore && this.data.lastDoc) {
      query = query.orderBy('date','desc').limit(this.data.pageSize).startAfter(this.data.lastDoc )
    }else {
      query = query.orderBy('date','desc').limit(this.data.pageSize);
    }

    query.get().then(res => {
      const newList = res.data;
      console.log('fafaffffafafaf',newList);

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
        this.calculateStats(newList);
        this.getTotalCount();
      }

      if(newList.length < this.data.pageSize) {
        this.setData({hasMore:false});
      }else if(newList.length > 0){
        this.setData({ lastDoc: newList[newList.length - 1] });
      }
    }).catch(err => {
      console.error('加载反馈列表失败', err);
      this.setData({ loading: false, loadingMore: false });
    });
  },

  // 获取总反馈数
  getTotalCount() {
    const db = wx.cloud.database();
    db.collection('feedbacks').where({
      childId:this.data.childInfo._id
    }).count().then(res => {
      this.setData({totalCount:res.total});
    }).catch(err => {
      console.error('获取总数失败', err);
    });
  },

    // 计算统计数据
    calculateStats(list) {
      if (list.length === 0) {
        this.setData({ avgRating: 0 });
        return;
      }
      
      let totalRating = 0;
      list.forEach(item => {
        totalRating += item.rating || 0;
      });
      const avgRating = (totalRating / list.length).toFixed(1);
      this.setData({ avgRating });
    },


    // 加载更多
    loadMore() {
      if(!this.data.hasMore || this.data.loadingMore) return;
      this.loadFeedbackList(true);
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