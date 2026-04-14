// pages/coach/trainings/list/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    childId:'', //孩子ID(从参数传入)
    childName:'',
    trainingList:[],
    filterType:'all', // 筛选类型: all, speed, endurance, coordination
    loading:true,
    loadingMore:false,
    hasMore:true,
    PageSize:10,
    lastDoc:null
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const {childId,childName} = options
    this.setData({
      childId:childId || '',
      childName:childName || '' 
    });

    if(childName) {
      wx.setNavigationBarTitle({
        title: `${childName}的训练记录`
      });
    }
    this.loadTrainingList();
  },

  // 加载训练列表
  loadTrainingList(isLoadMore = false) { 
    if(isLoadMore){
      this.setData({loadingMore:true});
    }else {
      this.setData({loading:true, trainingListL:[],lastDoc:null,hasMore:true})
    }

    const db = wx.cloud.database();
    const _ = db.command;
    
    // 构建查询条件
    let query = db.collection('trainings'); 
    // 根据孩子ID筛选
    if(this.data.childId) {
      query = query.where({childId:this.data.childId});
    }

    // 根据训练类型筛选
    if(this.data.filterType !== 'all') {
      let typeName = '';
      switch(this.data.filterType) {
        case 'speed':
          typeName = '速度训练';
          break;
        case 'endurance':
          typeName = '耐力训练';
          break;
        case 'coordination':
          typeName = '协调性训练';
          break;
      }

      if(typeName) {
        query = query.where({type:typeName});
      }
    }

    // 排序
    query = query.orderBy('date','desc');

    // 分页
    if(isLoadMore && this.data.lastDoc) {
      query = query.orderBy('date','desc').limit(this.data.PageSize).startAfter(this.data.lastDoc);
    }else {
      query = query.orderBy('date','desc').limit(this.data.PageSize);
    }

    query.get().then(res => {
      const newList = res.data;

      // 处理训练类型样式
      const processedList = newList.map(item => {
        let typeClass = '';
        if(item.type === '速度训练') typeClass = 'speed';
        else if(item.type === '耐力训练') typeClass= 'endurance';
        else if(item.type ==='协调性训练') typeClass = 'coordination';
        return {...item,typeClass}
      });

      if(isLoadMore) {
        this.setData({
          trainingList:[...this.data.trainingList,...processedList],
          loadingMore:false
        })
      }else {
        this.setData({
          trainingList:processedList,
          loading:false
        });
      }

      if(newList.length < this.data.PageSize) {
        this.setData({hasMore:false});
      }else if(newList.length > 0) {
        this.setData({lastDoc:newList[newList.length-1]});
      }
    }).catch(err => {
      console.error('加载训练列表失败',err);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false, loadingMore: false });
    })
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
    this.loadTrainingList();
  },

  // 加载更多
  loadingMore() {
    if(!this.data.hasMore || this.data.loadingMore) return;
    this.loadTrainingList();
  },

  // 查看训练详情
  viewTrainingDetail(e) {
    // console.log(e);
    const {id} = e.currentTarget.dataset;
    // console.log(id);
    wx.navigateTo({
      url:`/pages/coach/trainings/detail/index?id=${id}`
    })
  },

  // 下拉刷新
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
    this.setData({lastDoc:null ,hasMore:true});
    this.loadTrainingList().then(() => {
      wx.stopPullDownRefresh();
    })
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    this.loadingMore();
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})