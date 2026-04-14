// pages/coach/performance/list/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    childId:'',
    childName:'',
    performanceList:[],
    filterType:'all',
    totalCount:0,
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
    const { childId,childName } = options;
    this.setData({
      childId:childId,
      childName:childName
    });

    // 设置导航栏标语
    if(childName) {
      wx.setNavigationBarTitle({
        title: `${childName}的表现历史`
      });
    }
    this.loadPerformanceList();
  },  

  // 加载表现列表
  loadPerformanceList(isLoadMore = false) {
    if(isLoadMore) {
      this.setData({loadingMore:true});
    }else {
      this.setData({loading:true,performanceList:[],lastDoc:null,hasMore:true})
    }

    const db = wx.cloud.database();
    const _ = db.command;

    // 构建查询条件
    let query = db.collection('performance');

    // 根据孩子ID筛选
    if(this.data.childId) {
      query = query.where({childId:this.data.childId});
    }
// childId=f0df711e69ba972900a9136114d13cb6&childName=张小宝
    // 根据时间筛选
    if(this.data.filterType !== 'all') {
      const dateRange = this.getDateRange();
      if(dateRange) {
        query = query.where({
          weekDate:_.gte(dateRange.start).and(_.lte(dateRange.end))
        });
      }
    }

    // 排序
    query = query.orderBy('weekDate','desc');

    // 分页
    if(isLoadMore && this.data.lastDoc) {
      query = query.orderBy('weekDate','desc').limit(this.data.pageSize).startAfter(this.data.lastDoc)
    }else {
      query = query.orderBy('weekDate','desc').limit(this.data.pageSize)
    }

    query.get().then((res) => {
      const newList = res.data;

      const processedList = newList.map((item,index) => {
        const trend = this.calculateTrend(item,newList[index + 1]);
        return {
          ...item,
          trend
        }
      });
      if(isLoadMore) {
        this.setData({
          performanceList:[...this.data.performanceList,...processedList],
          isLoadMore:false
        });
      }else {
        this.setData({
          performanceList:processedList,
          loading:false
        });
      }

      // 更新总数（首次加载时查询总数）
      if(!isLoadMore) {
        this.getTotalCount();
      }

      // 判断是否还有更多
      if(newList.length < this.data.pageSize ) {
        this.setData({hasMore:false});
      }else if (newList.length > 0) {
        this.setData({lastDoc:newList[newList.length - 1]});
      }
    }).catch(err => {
      console.error('加载表现列表失败',err);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false, loadingMore: false });
    });

  },

  getTotalCount() {
    const db = wx.cloud.database();
    let query = db.collection('performance')

    if(this.data.childId) {
      query = query.where({childId:this.data.childId})
    }

    if(this.data.filterType !== 'all') {
      const dateRange = this.getDateRange();
      if(dateRange) {
        query = query.where({
          weekDate:db.command.gte(dateRange.start).and(db.command.lte(dateRange.end))
        });
      }
    }

    query.count().then(res => {
      this.setData({totalCount:res.total})
    }).catch(err => {
      console.error('获取总数失败',err);
    })
  },


  // 计算与上周的对比趋势
  calculateTrend(current,previous) {
    if(!previous) return null;

    const trend = {}; 

    if(current.fiftyMeter && previous.fiftyMeter) {
      const diff = (previous.fiftyMeter - current.fiftyMeter).toFixed(1);
      if(diff > 0) {
        trend.fiftyMeter = {type:'up',value:diff};
      }else if(diff < 0) {
        trend.fiftyMeter ={type:'down',value:Math.abs(diff)};
      }
    }

    // 【新增】800米跑（数值越小越好，直接字符串比较）
    if (current.eightHundredMeter && previous.eightHundredMeter) {
      trend.eightHundredMeter = { type: 'up', value: '提升' };
    }

    // 【新增】仰卧起坐（数值越大越好）
    if (current.sitUp && previous.sitUp) {
      const diff = current.sitUp - previous.sitUp;
      if (diff > 0) {
        trend.sitUp = { type: 'up', value: diff };
      } else if (diff < 0) {
        trend.sitUp = { type: 'down', value: Math.abs(diff) };
      }
    }

    // 【新增】跳绳（数值越大越好）
    if (current.ropeSkipping && previous.ropeSkipping) {
      const diff = current.ropeSkipping - previous.ropeSkipping;
      if (diff > 0) {
        trend.ropeSkipping = { type: 'up', value: diff };
      } else if (diff < 0) {
        trend.ropeSkipping = { type: 'down', value: Math.abs(diff) };
      }
    }

    // 【新增】坐位体前屈（数值越大越好）
    if (current.sitAndReach && previous.sitAndReach) {
      const diff = (current.sitAndReach - previous.sitAndReach).toFixed(1);
      if (diff > 0) {
        trend.sitAndReach = { type: 'up', value: diff };
      } else if (diff < 0) {
        trend.sitAndReach = { type: 'down', value: Math.abs(diff) };
      }
    }

    // 【新增】立定跳远（数值越大越好）
    if (current.standingLongJump && previous.standingLongJump) {
      const diff = current.standingLongJump - previous.standingLongJump;
      if (diff > 0) {
        trend.standingLongJump = { type: 'up', value: diff };
      } else if (diff < 0) {
        trend.standingLongJump = { type: 'down', value: Math.abs(diff) };
      }
    }

    // 【新增】肺活量（数值越大越好）
    if (current.vitalCapacity && previous.vitalCapacity) {
      const diff = current.vitalCapacity - previous.vitalCapacity;
      if (diff > 0) {
        trend.vitalCapacity = { type: 'up', value: diff };
      } else if (diff < 0) {
        trend.vitalCapacity = { type: 'down', value: Math.abs(diff) };
      }
    }

    // 协调性对比（数值越大越好）
    if (current.coordination && previous.coordination) {
      const diff = current.coordination - previous.coordination;
      if (diff > 0) {
        trend.coordination = { type: 'up', value: diff };
      } else if (diff < 0) {
        trend.coordination = { type: 'down', value: Math.abs(diff) };
      }
    }

    // 敏捷性对比
    if (current.agility && previous.agility) {
      const diff = current.agility - previous.agility;
      if (diff > 0) {
        trend.agility = { type: 'up', value: diff };
      } else if (diff < 0) {
        trend.agility = { type: 'down', value: Math.abs(diff) };
      }
    }

    return Object.keys(trend).length > 0 ? trend : null;
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
    if (type === this.data.filterType) return;
    
    this.setData({ 
      filterType: type,
      lastDoc: null,
      hasMore: true
    });
    this.loadPerformanceList();
  },

  // 加载更多
  loadMore() {
    if (!this.data.hasMore || this.data.loadingMore) return;
    this.loadPerformanceList(true);
  },

  // 查看表现详情
  viewPerformanceDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/coach/performance/detail/index?id=${id}`
    });
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
    this.setData({ lastDoc: null, hasMore: true });
    this.loadPerformanceList().then(() => {
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