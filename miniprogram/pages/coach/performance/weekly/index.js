// pages/coach/performance/weekly/index.js
const auth = require('../../../../utils/auth');
const { PERFORMANCE_METRICS, readTouchedField } = require('../../../../utils/helper');

/**
 * 所有成绩字段。用来判断「这次是不是一项都没填」，不含 childId/周次等元数据。
 * 直接从 PERFORMANCE_METRICS 派生，以后加指标不用回来改这里。
 */
const METRIC_KEYS = PERFORMANCE_METRICS.map(function (meta) { return meta.key; });

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

    // 本次会话里教练真正输入/拖动过的字段。
    // 表单会被上一周的成绩预填（见 loadPreviousData），而表单本身就是提交的数据源，
    // 没有这个标记的话「打开页面直接保存」会把上周成绩原样存成本周的记录。
    touched: {},

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
    // 原来这里裸读 wx.getStorageSync('coachInfo')._id，缓存缺失会直接抛 TypeError。
    // 冷启动路径「登录 → 工作台 → 录入成绩」在没有缓存时必崩，所以走 auth 并加守卫。
    const coachId = auth.getCoachId();
    if (!coachId) {
      wx.showToast({ title: '登录已失效，请重新登录', icon: 'none' });
      return;
    }
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

        // touched 一并清空：这些值只是填进输入框供教练参照，
        // 教练不改动就不会被当成本周成绩存下去
        this.setData({ form, touched: {} });
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
      },
      touched: {}
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
  //
  // 每个 handler 都顺手把 touched.<字段> 置 true —— 只有这次真正动过的字段才会被保存，
  // 详见 helper.readTouchedField() 的注释。
  onFiftyInput(e) {
    this.setData({'form.fiftyMeter': e.detail.value, 'touched.fiftyMeter': true})
  },

  onThousandInput(e) {
    this.setData({'form.thousandMeter': e.detail.value, 'touched.thousandMeter': true})
  },

  onEightHundredInput(e) {
    this.setData({'form.eightHundredMeter': e.detail.value, 'touched.eightHundredMeter': true})
  },

  onSitUpInput(e) {
    this.setData({'form.sitUp': e.detail.value, 'touched.sitUp': true})
  },

  onRopeSkippingInput(e) {
    this.setData({'form.ropeSkipping': e.detail.value, 'touched.ropeSkipping': true})
  },

  onSitAndReachInput(e) {
    this.setData({'form.sitAndReach': e.detail.value, 'touched.sitAndReach': true})
  },

  onStandingLongJumpInput(e) {
    this.setData({'form.standingLongJump': e.detail.value, 'touched.standingLongJump': true})
  },

  onVitalCapacityInput(e) {
    this.setData({'form.vitalCapacity': e.detail.value, 'touched.vitalCapacity': true})
  },

  onPushUpInput(e) {
    this.setData({'form.pushUp': e.detail.value, 'touched.pushUp': true})
  },

  onPullUpInput(e) {
    this.setData({'form.pullUp': e.detail.value, 'touched.pullUp': true})
  },

  // 滑块只有 bindchange（松手才触发），没有 bindinput，所以拖过才会置 true。
  // 表单默认值是 70，不要求 touched 的话教练一个字没填也会存进 70/70，
  // 进步卡就会把「敏捷 提升5分」这种假进步报给家长。
  onAgilityChange(e) {
    this.setData({'form.agility': e.detail.value, 'touched.agility': true})
  },

  onCoordinationChange(e) {
    this.setData({'form.coordination': e.detail.value, 'touched.coordination': true})
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
      updatedAt: new Date()
    };

    const formData = this.data.form;
    const touched = this.data.touched;
    const stage = this.data.selectedStage;
    const gender = this.data.selectedChild.gender;

    // 统一走 readTouchedField()：只有教练这次动过的字段才写入。
    // 这里全部改成「取值 + 可选转换」的写法，避免 12 个字段各写一遍 if。
    const assign = (key, parse) => {
      const raw = readTouchedField(formData, touched, key);
      if (raw === null) return;
      data[key] = parse ? parse(raw) : raw;
    };

    // 50米跑（所有阶段都有）
    assign('fiftyMeter', parseFloat);

    // 小学项目
    if (stage === 'primary') {
      assign('vitalCapacity', parseInt);
      assign('ropeSkipping', parseInt);
      assign('sitAndReach', parseFloat);
      assign('sitUp', parseInt);
      assign('pushUp', parseInt);
    }

    // 初中项目
    if (stage === 'middle') {
      if (gender === 'male') {
        // 男生：1000米、引体向上、立定跳远
        assign('thousandMeter');
        assign('pullUp', parseInt);
        assign('standingLongJump', parseInt);
      } else if (gender === 'female') {
        // 女生：800米、仰卧起坐、立定跳远
        assign('eightHundredMeter');
        assign('sitUp', parseInt);
        assign('standingLongJump', parseInt);
      }
    }

    // 敏捷性和协调性也是选填，跟其他项目一视同仁（原来这里是无条件写入）
    assign('agility');
    assign('coordination');

    // 一项都没填就别建记录：否则库里会多出一条只有孩子/周次的空记录，
    // 把周次下拉框和图表撑出一堆空周
    if (!METRIC_KEYS.some(function (key) { return data[key] !== undefined; })) {
      wx.showToast({ title: '请至少填写一项成绩', icon: 'none' });
      return;
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
          const newSeconds = this.parseTime(data.thousandMeter);
          const oldSeconds = this.parseTime(existingRecord.thousandMeter);
          if (newSeconds < oldSeconds) {
            updateData.thousandMeter = data.thousandMeter;
          }
        } else if (data.thousandMeter && !existingRecord.thousandMeter) {
          updateData.thousandMeter = data.thousandMeter;
        }

        // 800米跑
        if (data.eightHundredMeter && existingRecord.eightHundredMeter) {
          const newSeconds = this.parseTime(data.eightHundredMeter);
          const oldSeconds = this.parseTime(existingRecord.eightHundredMeter);
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

        // 敏捷性（slider 0-100，越高越好）
        if (data.agility !== undefined && isBetterNumber(data.agility, existingRecord.agility)) {
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

      // 【新增】异步触发月度重算。刻意不 await、不挂进 Promise 链——
      // 云函数失败绝不能影响教练这条「保存成功」的提示与返回。
      wx.cloud.callFunction({
        name: 'generateMonthlyReport',
        data: { childId: data.childId, weekStart: data.weekStart }
      }).catch(err => {
        console.error('月度重算触发失败', err);
      });

      setTimeout(() => {
        wx.navigateBack();
      },1500)
    }).catch(err => {
      console.error('保存失败',err);
      wx.showToast({title: '保存失败',icon:'none'})
    })
  },

  // 解析时间字符串为秒。兼容 "3分20秒"（输入框提示的格式）与 "3:20"。
  // 无法解析时返回 Infinity，使该值不会在择优比较中胜出。
  parseTime(str) {
    if (typeof str === 'number') return str;
    if (!str || typeof str !== 'string') return Infinity;

    if (str.includes('分')) {
      const parts = str.replace('秒', '').split('分');
      return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
    }

    if (str.includes(':')) {
      const parts = str.split(':');
      return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
    }

    const value = parseFloat(str);
    return Number.isFinite(value) ? value : Infinity;
  }
})