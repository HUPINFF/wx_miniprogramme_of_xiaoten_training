// pages/coach/performance/weekly/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    children:[],
    selectedChild:{},
    weekDate:'',
    month:'',
    weekRange: '',        // 周范围显示（如"3月23日-3月29日"）
    weekStart: '',        // 周开始日期（用于查询）
    weekEnd: '',          // 周结束日期
    
    // 【修改】所有训练项目（全部可选）
    form: {
      fiftyMeter: '',           // 50米跑（数字）
      thousandMeter: '',        // 1000米跑（字符串）
      sitUp: '',                // 【新增】仰卧起坐（个/分钟）
      ropeSkipping: '',         // 【新增】跳绳（个/分钟）
      eightHundredMeter: '',    // 【新增】800米跑（字符串，与1000米跑一致）
      sitAndReach: '',          // 【新增】坐位体前屈（厘米）
      standingLongJump: '',     // 【新增】立定跳远（厘米）
      vitalCapacity: '',        // 【新增】肺活量测试（毫升）
      agility: 70,              // 【保留】敏捷性，默认70
      coordination: 70          // 【保留】协调性，默认70
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadChildren();
    this.loadDefaultWeekRange();
  },

  loadChildren() {
    const coachId = wx.getStorageSync('coachInfo')._id;
    const db = wx.cloud.database();
    db.collection('children').where({
      coachId:coachId
    }).get().then(res => {
      this.setData({ children:res.data});
    })
  },

  loadDefaultWeekRange() {
    const now = new Date();
    const weekRangeInfo = this.getWeekRange(now);
    this.setData({
      weekDate: weekRangeInfo.weekStart,
      weekRange: weekRangeInfo.weekRange,
      weekStart: weekRangeInfo.weekStart,
      weekEnd: weekRangeInfo.weekEnd
    });
  },

  // 获取周的日期范围
  getWeekRange(date) {
    const monday = this.getMondayDate(date);
    const sunday = this.getSundayDate(date);
    
    const year = date.getFullYear();
    const weekStart = `${year}-${String(monday.month).padStart(2, '0')}-${String(monday.day).padStart(2, '0')}`;
    const weekEnd = `${year}-${String(sunday.month).padStart(2, '0')}-${String(sunday.day).padStart(2, '0')}`;
    const weekRange = `${monday.month}月${monday.day}日-${sunday.month}月${sunday.day}日`;
    
    return { weekRange, weekStart, weekEnd };
  },

  getMondayDate(date) {
    const monday = new Date(date);
    const day = monday.getDay() || 7;
    monday.setDate(monday.getDate() - day + 1);
    return {
      month:monday.getMonth() + 1,
      day:monday.getDate()
    }
  },

  // 获取周日日期
  getSundayDate(date) {
    const sunday = new Date(date);
    const day = sunday.getDay() || 7;
    sunday.setDate(sunday.getDate() + (7 - day));
    return {
      month: sunday.getMonth() + 1,
      day: sunday.getDate()
    };
  },

  onChildChange(e) {
    const index = e.detail.value;
    const selectedChild = this.data.children[index];
    this.setData({
      selectedChild: selectedChild
    });
    // 加载该孩子上周的数据作为参考
    this.loadPreviousData(selectedChild._id);
  },

  // 【修改】loadPreviousData 方法：支持加载所有项目的历史数据
  loadPreviousData(childId) {
    const db = wx.cloud.database();
    db.collection('performance').where({
      childId: childId
    }).orderBy('weekStart','desc').limit(1).get().then(res => {
      if(res.data.length > 0) {
        const prev = res.data[0];
        
        // 【修改】加载所有项目的历史数据
        const form = {
          fiftyMeter: prev.fiftyMeter || '',
          thousandMeter: prev.thousandMeter || '',
          sitUp: prev.sitUp || '',                    // 【新增】
          ropeSkipping: prev.ropeSkipping || '',      // 【新增】
          eightHundredMeter: prev.eightHundredMeter || '', // 【新增】字符串类型
          sitAndReach: prev.sitAndReach || '',        // 【新增】
          standingLongJump: prev.standingLongJump || '', // 【新增】
          vitalCapacity: prev.vitalCapacity || '',     // 【新增】
          agility: prev.agility !== undefined ? prev.agility : 70,     // 【保留】
          coordination: prev.coordination !== undefined ? prev.coordination : 70  // 【保留】
        };
        
        this.setData({ form });
      } else {
        // 没有历史数据时，重置表单
        this.resetForm();
      }
    }).catch(err => {
      console.error('加载历史数据失败', err);
      this.resetForm();
    });
  },
  
  // 【新增】resetForm 方法：重置所有表单字段
  resetForm() {
    this.setData({
      form: {
        fiftyMeter: '',
        thousandMeter: '',
        sitUp: '',
        ropeSkipping: '',
        eightHundredMeter: '',
        sitAndReach: '',
        standingLongJump: '',
        vitalCapacity: '',
        agility: 70,
        coordination: 70
      }
    });
  },

  onDateChange(e) {
    const selectedDate = new Date(e.detail.value);
    const weekRangeInfo = this.getWeekRange(selectedDate);
    this.setData({
      weekDate: weekRangeInfo.weekStart,
      weekRange: weekRangeInfo.weekRange,
      weekStart: weekRangeInfo.weekStart,
      weekEnd: weekRangeInfo.weekEnd
    });
  },

  // 【原有】输入处理方法
  onFiftyInput(e) {
    this.setData({'form.fiftyMeter': e.detail.value})
  },

  onThousandInput(e) {
    this.setData({'form.thousandMeter': e.detail.value})
  },

  // 【新增】以下6个方法：新增项目的输入处理
  onSitUpInput(e) {
    this.setData({'form.sitUp': e.detail.value})
  },
  
  onRopeSkippingInput(e) {
    this.setData({'form.ropeSkipping': e.detail.value})
  },
  
  onEightHundredInput(e) {
    this.setData({'form.eightHundredMeter': e.detail.value})  // 【注意】字符串类型，直接保存
  },
  
  onSitAndReachInput(e) {
    this.setData({'form.sitAndReach': e.detail.value})
  },
  
  onStandingLongJumpInput(e) {
    this.setData({'form.standingLongJump': e.detail.value})
  },
  
  onVitalCapacityInput(e) {
    this.setData({'form.vitalCapacity': e.detail.value})
  },

  // 【保留】敏捷性和协调性滑块事件
  onAgilityChange(e) {
    this.setData({'form.agility': e.detail.value})
  },

  onCoordinationChange(e) {
    this.setData({'form.coordination': e.detail.value})
  },

  // 【修改】onSubmit 方法：移除必填校验，只保存有值的字段
  onSubmit() {
    if(!this.data.selectedChild._id) {
      wx.showToast({
        title: '请选择学员',
        icon:'none'
      })
      return;
    }

    if(!this.data.weekStart) {
      wx.showToast({
        title: '请选择周次',
        icon: 'none'
      });
      return;
    }

    const db = wx.cloud.database();
    
    // 构建数据对象，只包含有值的字段
    const data = {
      childId: this.data.selectedChild._id,
      childName: this.data.selectedChild.name, 
      weekDate: this.data.weekDate,
      weekRange: this.data.weekRange,
      weekStart: this.data.weekStart,
      weekEnd: this.data.weekEnd,
      month: '',
      updatedAt: new Date()
    };
    
    // 【修改】只添加有值的项目
    const formData = this.data.form;
    
    // 50米跑（数字）
    if (formData.fiftyMeter && formData.fiftyMeter.trim() !== '') {
      data.fiftyMeter = parseFloat(formData.fiftyMeter);
    }
    
    // 1000米跑（字符串）
    if (formData.thousandMeter && formData.thousandMeter.trim() !== '') {
      data.thousandMeter = formData.thousandMeter;
    }
    
    // 仰卧起坐（数字）
    if (formData.sitUp && formData.sitUp.trim() !== '') {
      data.sitUp = parseInt(formData.sitUp);
    }
    
    // 跳绳（数字）
    if (formData.ropeSkipping && formData.ropeSkipping.trim() !== '') {
      data.ropeSkipping = parseInt(formData.ropeSkipping);
    }
    
    // 【修改】800米跑（字符串，与1000米跑一致）
    if (formData.eightHundredMeter && formData.eightHundredMeter.trim() !== '') {
      data.eightHundredMeter = formData.eightHundredMeter;
    }
    
    // 坐位体前屈（数字）
    if (formData.sitAndReach && formData.sitAndReach.trim() !== '') {
      data.sitAndReach = parseFloat(formData.sitAndReach);
    }
    
    // 立定跳远（数字）
    if (formData.standingLongJump && formData.standingLongJump.trim() !== '') {
      data.standingLongJump = parseInt(formData.standingLongJump);
    }
    
    // 肺活量测试（数字）
    if (formData.vitalCapacity && formData.vitalCapacity.trim() !== '') {
      data.vitalCapacity = parseInt(formData.vitalCapacity);
    }
    
    // 【保留】敏捷性（数字，始终保存）
    if (formData.agility !== undefined && formData.agility !== null) {
      data.agility = formData.agility;
    }
    
    // 【保留】协调性（数字，始终保存）
    if (formData.coordination !== undefined && formData.coordination !== null) {
      data.coordination = formData.coordination;
    }

    // 检查是否已存在该周的数据
    db.collection('performance').where({
      childId: data.childId,
      weekStart: data.weekStart
    }).get().then(res => {
      if(res.data.length > 0) {
        // 更新操作：使用合并方式，不清除未提交的字段
        const existingRecord = res.data[0];
        const updateData = {};

        const isBetterTime = (newVal,oldVal) => {
          if (!newVal && newVal !== 0) return false; // 新值为空，不更新
          if (!oldVal && oldVal !== 0) return true;  // 旧值为空，更新
          return parseFloat(newVal) < parseFloat(oldVal);
        }

        const isBetterNumber = (newVal,oldVal) => {
          if(!newVal && newVal !== 0) return false;
          if(!oldVal && oldVal !== 0) return true;
          return parseFloat(newVal) > parseFloat(oldVal);
        }

         // 50米跑 - 时间越短越好
         if (data.fiftyMeter !== undefined && isBetterTime(data.fiftyMeter, existingRecord.fiftyMeter)) {
          updateData.fiftyMeter = data.fiftyMeter;
        }

        // 1000米跑 - 时间越短越好（字符串比较需要转换为秒数）
        if (data.thousandMeter && existingRecord.thousandMeter) {
          const newSeconds = this.timeToSeconds(data.thousandMeter);
          const oldSeconds = this.timeToSeconds(existingRecord.thousandMeter);
          if (newSeconds < oldSeconds) {
            updateData.thousandMeter = data.thousandMeter;
          }
        } else if (data.thousandMeter && !existingRecord.thousandMeter) {
          updateData.thousandMeter = data.thousandMeter;
        }

        // 仰卧起坐 - 次数越多越好
        if (data.sitUp !== undefined && isBetterNumber(data.sitUp, existingRecord.sitUp)) {
          updateData.sitUp = data.sitUp;
        }

         // 跳绳 - 次数越多越好
         if (data.ropeSkipping !== undefined && isBetterNumber(data.ropeSkipping, existingRecord.ropeSkipping)) {
          updateData.ropeSkipping = data.ropeSkipping;
        }

         // 800米跑 - 时间越短越好
         if (data.eightHundredMeter && existingRecord.eightHundredMeter) {
          const newSeconds = this.timeToSeconds(data.eightHundredMeter);
          const oldSeconds = this.timeToSeconds(existingRecord.eightHundredMeter);
          if (newSeconds < oldSeconds) {
            updateData.eightHundredMeter = data.eightHundredMeter;
          }
        } else if (data.eightHundredMeter && !existingRecord.eightHundredMeter) {
          updateData.eightHundredMeter = data.eightHundredMeter;
        }

        // 坐位体前屈 - 数值越大越好
        if (data.sitAndReach !== undefined && isBetterNumber(data.sitAndReach, existingRecord.sitAndReach)) {
          updateData.sitAndReach = data.sitAndReach;
        }
        
        // 立定跳远 - 距离越远越好
        if (data.standingLongJump !== undefined && isBetterNumber(data.standingLongJump, existingRecord.standingLongJump)) {
          updateData.standingLongJump = data.standingLongJump;
        }
        
        // 肺活量 - 数值越大越好
        if (data.vitalCapacity !== undefined && isBetterNumber(data.vitalCapacity, existingRecord.vitalCapacity)) {
          updateData.vitalCapacity = data.vitalCapacity;
        }

        // 敏捷性 - 通常数值越小越好（反应时间快）
        if (data.agility !== undefined && isBetterTime(data.agility, existingRecord.agility)) {
          updateData.agility = data.agility;
        }
        
        // 协调性 - 通常数值越大越好
        if (data.coordination !== undefined && isBetterNumber(data.coordination, existingRecord.coordination)) {
          updateData.coordination = data.coordination;
        }

        // 检查是否有任何更新
        if (Object.keys(updateData).length === 0) {
          wx.showToast({
            title: '所有成绩均未超过历史最佳，无需更新',
            icon: 'none',
            duration: 2000
          });
          return Promise.reject('no_better_performance');
        }

         // 添加更新时间
         updateData.updatedAt = new Date();

        return db.collection('performance').doc(res.data[0]._id).update({data:updateData});
      }else {
        // 新增
        data.createdAt = new Date();
        return db.collection('performance').add({data});
      }
    }).then(() => {
      wx.showToast({title:'保存成功',icon:'success'}),
      setTimeout(() => {
        wx.navigateBack();
      },1500)
    }).catch(err => {
      console.error('保存失败',err);
      wx.showToast({title: '保存失败',icon:'none'})
    })
  },

   // 【新增】辅助函数：将时间字符串（如"03:25"）转换为秒数，用于比较
   timeToSeconds(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return Infinity;
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    return Infinity;
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