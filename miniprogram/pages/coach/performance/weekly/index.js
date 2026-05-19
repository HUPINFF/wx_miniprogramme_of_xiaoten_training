// pages/coach/performance/weekly/index.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    children:[],
    selectedChild:{},
    selectedStage: 'primary',  // 默认小学阶段
    weekDate:'',
    month:'',
    weekRange: '',
    weekStart: '',
    weekEnd: '',

    form: {
      fiftyMeter: '',
      thousandMeter: '',
      eightHundredMeter: '',
      sitUp: '',
      ropeSkipping: '',
      sitAndReach: '',
      standingLongJump: '',
      vitalCapacity: '',
      pushUp: '',       // 俯卧撑
      pullUp: '',       // 引体向上
      agility: 70,
      coordination: 70
    },
    loading:true
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.setData({loading:true});
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

    this.setData({loading:false});
  },

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
      selectedChild: selectedChild,
      selectedStage: 'primary'  // 每次选择学员时重置为小学阶段
    });
    this.loadPreviousData(selectedChild._id);
  },

  // 阶段选择
  onStageSelect(e) {
    const stage = e.currentTarget.dataset.stage;
    this.setData({ selectedStage: stage });
  },

  loadPreviousData(childId) {
    const db = wx.cloud.database();
    db.collection('performance').where({
      childId: childId
    }).orderBy('weekStart','desc').limit(1).get().then(res => {
      if(res.data.length > 0) {
        const prev = res.data[0];

        const form = {
          fiftyMeter: prev.fiftyMeter || '',
          thousandMeter: prev.thousandMeter || '',
          eightHundredMeter: prev.eightHundredMeter || '',
          sitUp: prev.sitUp || '',
          ropeSkipping: prev.ropeSkipping || '',
          sitAndReach: prev.sitAndReach || '',
          standingLongJump: prev.standingLongJump || '',
          vitalCapacity: prev.vitalCapacity || '',
          pushUp: prev.pushUp || '',
          pullUp: prev.pullUp || '',
          agility: prev.agility !== undefined ? prev.agility : 70,
          coordination: prev.coordination !== undefined ? prev.coordination : 70
        };

        this.setData({ form });
      } else {
        this.resetForm();
      }
    }).catch(err => {
      console.error('加载历史数据失败', err);
      this.resetForm();
    });
  },

  resetForm() {
    this.setData({
      form: {
        fiftyMeter: '',
        thousandMeter: '',
        eightHundredMeter: '',
        sitUp: '',
        ropeSkipping: '',
        sitAndReach: '',
        standingLongJump: '',
        vitalCapacity: '',
        pushUp: '',
        pullUp: '',
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

  // 输入处理方法
  onFiftyInput(e) {
    this.setData({'form.fiftyMeter': e.detail.value})
  },

  onThousandInput(e) {
    this.setData({'form.thousandMeter': e.detail.value})
  },

  onEightHundredInput(e) {
    this.setData({'form.eightHundredMeter': e.detail.value})
  },

  onSitUpInput(e) {
    this.setData({'form.sitUp': e.detail.value})
  },

  onRopeSkippingInput(e) {
    this.setData({'form.ropeSkipping': e.detail.value})
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

  onPushUpInput(e) {
    this.setData({'form.pushUp': e.detail.value})
  },

  onPullUpInput(e) {
    this.setData({'form.pullUp': e.detail.value})
  },

  onAgilityChange(e) {
    this.setData({'form.agility': e.detail.value})
  },

  onCoordinationChange(e) {
    this.setData({'form.coordination': e.detail.value})
  },

  onSubmit() {
    if(!this.data.selectedChild._id) {
      wx.showToast({
        title: '请选择学员',
        icon:'none'
      })
      return;
    }

    if(!this.data.selectedStage) {
      wx.showToast({
        title: '请选择阶段',
        icon: 'none'
      });
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

    const data = {
      childId: this.data.selectedChild._id,
      childName: this.data.selectedChild.name,
      gender: this.data.selectedChild.gender,
      stage: this.data.selectedStage,
      weekDate: this.data.weekDate,
      weekRange: this.data.weekRange,
      weekStart: this.data.weekStart,
      weekEnd: this.data.weekEnd,
      month: '',
      updatedAt: new Date()
    };

    const formData = this.data.form;
    const stage = this.data.selectedStage;
    const gender = this.data.selectedChild.gender;

    // 50米跑（所有阶段都有）
    if (formData.fiftyMeter && formData.fiftyMeter.trim() !== '') {
      data.fiftyMeter = parseFloat(formData.fiftyMeter);
    }

    // 小学项目
    if (stage === 'primary') {
      if (formData.vitalCapacity && formData.vitalCapacity.trim() !== '') {
        data.vitalCapacity = parseInt(formData.vitalCapacity);
      }
      if (formData.ropeSkipping && formData.ropeSkipping.trim() !== '') {
        data.ropeSkipping = parseInt(formData.ropeSkipping);
      }
      if (formData.sitAndReach && formData.sitAndReach.trim() !== '') {
        data.sitAndReach = parseFloat(formData.sitAndReach);
      }
      if (formData.sitUp && formData.sitUp.trim() !== '') {
        data.sitUp = parseInt(formData.sitUp);
      }
      if (formData.pushUp && formData.pushUp.trim() !== '') {
        data.pushUp = parseInt(formData.pushUp);
      }
    }

    // 初中项目
    if (stage === 'middle') {
      if (gender === 'male') {
        // 男生：1000米、引体向上、立定跳远
        if (formData.thousandMeter && formData.thousandMeter.trim() !== '') {
          data.thousandMeter = formData.thousandMeter;
        }
        if (formData.pullUp && formData.pullUp.trim() !== '') {
          data.pullUp = parseInt(formData.pullUp);
        }
        if (formData.standingLongJump && formData.standingLongJump.trim() !== '') {
          data.standingLongJump = parseInt(formData.standingLongJump);
        }
      } else if (gender === 'female') {
        // 女生：800米、仰卧起坐、立定跳远
        if (formData.eightHundredMeter && formData.eightHundredMeter.trim() !== '') {
          data.eightHundredMeter = formData.eightHundredMeter;
        }
        if (formData.sitUp && formData.sitUp.trim() !== '') {
          data.sitUp = parseInt(formData.sitUp);
        }
        if (formData.standingLongJump && formData.standingLongJump.trim() !== '') {
          data.standingLongJump = parseInt(formData.standingLongJump);
        }
      }
    }

    // 敏捷性和协调性（始终保存）
    if (formData.agility !== undefined && formData.agility !== null) {
      data.agility = formData.agility;
    }
    if (formData.coordination !== undefined && formData.coordination !== null) {
      data.coordination = formData.coordination;
    }

    // 检查是否已存在该周的数据
    db.collection('performance').where({
      childId: data.childId,
      weekStart: data.weekStart
    }).get().then(res => {
      if(res.data.length > 0) {
        const existingRecord = res.data[0];
        const updateData = {};

        const isBetterTime = (newVal, oldVal) => {
          if (!newVal && newVal !== 0) return false;
          if (!oldVal && oldVal !== 0) return true;
          return parseFloat(newVal) < parseFloat(oldVal);
        }

        const isBetterNumber = (newVal, oldVal) => {
          if(!newVal && newVal !== 0) return false;
          if(!oldVal && oldVal !== 0) return true;
          return parseFloat(newVal) > parseFloat(oldVal);
        }

        // 50米跑 - 时间越短越好
        if (data.fiftyMeter !== undefined && isBetterTime(data.fiftyMeter, existingRecord.fiftyMeter)) {
          updateData.fiftyMeter = data.fiftyMeter;
        }

        // 1000米跑
        if (data.thousandMeter && existingRecord.thousandMeter) {
          const newSeconds = this.timeToSeconds(data.thousandMeter);
          const oldSeconds = this.timeToSeconds(existingRecord.thousandMeter);
          if (newSeconds < oldSeconds) {
            updateData.thousandMeter = data.thousandMeter;
          }
        } else if (data.thousandMeter && !existingRecord.thousandMeter) {
          updateData.thousandMeter = data.thousandMeter;
        }

        // 800米跑
        if (data.eightHundredMeter && existingRecord.eightHundredMeter) {
          const newSeconds = this.timeToSeconds(data.eightHundredMeter);
          const oldSeconds = this.timeToSeconds(existingRecord.eightHundredMeter);
          if (newSeconds < oldSeconds) {
            updateData.eightHundredMeter = data.eightHundredMeter;
          }
        } else if (data.eightHundredMeter && !existingRecord.eightHundredMeter) {
          updateData.eightHundredMeter = data.eightHundredMeter;
        }

        // 仰卧起坐
        if (data.sitUp !== undefined && isBetterNumber(data.sitUp, existingRecord.sitUp)) {
          updateData.sitUp = data.sitUp;
        }

        // 跳绳
        if (data.ropeSkipping !== undefined && isBetterNumber(data.ropeSkipping, existingRecord.ropeSkipping)) {
          updateData.ropeSkipping = data.ropeSkipping;
        }

        // 坐位体前屈
        if (data.sitAndReach !== undefined && isBetterNumber(data.sitAndReach, existingRecord.sitAndReach)) {
          updateData.sitAndReach = data.sitAndReach;
        }

        // 立定跳远
        if (data.standingLongJump !== undefined && isBetterNumber(data.standingLongJump, existingRecord.standingLongJump)) {
          updateData.standingLongJump = data.standingLongJump;
        }

        // 肺活量
        if (data.vitalCapacity !== undefined && isBetterNumber(data.vitalCapacity, existingRecord.vitalCapacity)) {
          updateData.vitalCapacity = data.vitalCapacity;
        }

        // 俯卧撑
        if (data.pushUp !== undefined && isBetterNumber(data.pushUp, existingRecord.pushUp)) {
          updateData.pushUp = data.pushUp;
        }

        // 引体向上
        if (data.pullUp !== undefined && isBetterNumber(data.pullUp, existingRecord.pullUp)) {
          updateData.pullUp = data.pullUp;
        }

        // 敏捷性
        if (data.agility !== undefined && isBetterTime(data.agility, existingRecord.agility)) {
          updateData.agility = data.agility;
        }

        // 协调性
        if (data.coordination !== undefined && isBetterNumber(data.coordination, existingRecord.coordination)) {
          updateData.coordination = data.coordination;
        }

        if (Object.keys(updateData).length === 0) {
          wx.showToast({
            title: '所有成绩均未超过历史最佳，无需更新',
            icon: 'none',
            duration: 2000
          });
          return Promise.reject('no_better_performance');
        }

        updateData.updatedAt = new Date();
        return db.collection('performance').doc(res.data[0]._id).update({data:updateData});
      } else {
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

  timeToSeconds(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return Infinity;
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    return Infinity;
  }
})