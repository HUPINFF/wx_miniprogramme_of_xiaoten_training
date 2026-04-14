// pages/users/home/index.js
Page({

  data: {
    parentInfo: {
      nickname: '',
      avatarUrl: ''
    },
    childInfo: null,
    currentWeek: "",
    performance: {},
    weekTrainings: [],
    monthCompare: {
      title: '',
      childId: "",
      lastMonthName: '1月',
      currentMonthName: '2月',
      // 【修改】添加所有新增项目的对比数据
      fiftyMeter: {
        lastMonth: { value: '8.0', height: 80 },
        currentMonth: { value: '8.5', height: 85 },
        compareText: '↑0.5',
        trendClass: 'up'
      },
      thousandMeter: {
        lastMonth: { value: '5分30秒', height: 80 },
        currentMonth: { value: '5分20秒', height: 75 },
        compareText: '↑10秒',
        trendClass: "up"
      },
      // 【新增】800米跑
      eightHundredMeter: {
        lastMonth: { value: '3分30秒', height: 80 },
        currentMonth: { value: '3分20秒', height: 75 },
        compareText: '↑10秒',
        trendClass: "up"
      },
      // 【新增】仰卧起坐
      sitUp: {
        lastMonth: { value: '35', height: 35 },
        currentMonth: { value: '40', height: 40 },
        compareText: '↑5个',
        trendClass: "up"
      },
      // 【新增】跳绳
      ropeSkipping: {
        lastMonth: { value: '100', height: 100/5 },
        currentMonth: { value: '110', height: 110/5 },
        compareText: '↑10个',
        trendClass: "up"
      },
      // 【新增】坐位体前屈
      sitAndReach: {
        lastMonth: { value: '8.0', height: 80 },
        currentMonth: { value: '9.0', height: 90 },
        compareText: '↑1.0厘米',
        trendClass: "up"
      },
      // 【新增】立定跳远
      standingLongJump: {
        lastMonth: { value: '120', height: 120/5 },
        currentMonth: { value: '125', height: 125/5 },
        compareText: '↑5厘米',
        trendClass: "up"
      },
      // 【新增】肺活量
      vitalCapacity: {
        lastMonth: { value: '1800', height: 1800/60 },
        currentMonth: { value: '2000', height: 2000/60 },
        compareText: '↑200毫升',
        trendClass: "up"
      },
      coordination: {
        lastMonth: { value: '82', height: 82 },
        currentMonth: { value: '85', height: 85 },
        compareText: '↑3分',
        trendClass: "up"
      },
      agility: {
        lastMonth: { value: '73', height: 73 },
        currentMonth: { value: '78', height: 78 },
        compareText: '↑5分',
        trendClass: 'up'
      }
    },
    monthArray: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
    currentMonthIndex: new Date().getMonth(),
    lastMonthIndex: new Date().getMonth() === 0 ? 11 : new Date().getMonth() - 1,
    weeklyFeedback: {
      weekRange: '',
      list: []
    },
    loading: true,
    openid: '',
    currentAssessment: null  // 【新增】当前月体质测评
  },

  onLoad(options) {
    const userInfo = wx.getStorageSync('userInfo') || {};
    const openid = wx.getStorageSync('openid');

    this.setData({
      parentInfo: userInfo,
      openid: openid
    });

    this.initData();
  },

  onReady() {},

  onShow() {
    console.log('页面显示，重新加载数据');
    if (this.data.openid) {
      if (this.data.childInfo) {
        this.loadPerformanceData(this.data.childInfo._id);
      } else {
        this.loadChildData();
      }
    }
  },

  initData() {
    this.setCurrentWeek();
    this.setMonthCompareTitle();
    this.setWeeklyFeedbackRange();
    this.setMonthlySummaryMonth();
    this.loadChildData();
  },

  // 将"分秒"格式转换为秒数
  convertToSeconds(timeStr) {
    if (!timeStr) return 0;
    if (typeof timeStr === 'number') return timeStr;
    if (typeof timeStr !== 'string') return parseFloat(timeStr) || 0;
    
    if (timeStr.includes('分')) {
      const parts = timeStr.replace('秒', '').split('分');
      const mins = parseInt(parts[0]) || 0;
      const secs = parseInt(parts[1]) || 0;
      return mins * 60 + secs;
    }
    return parseFloat(timeStr) || 0;
  },

  // 将秒数转换为"分秒"格式
  formatSeconds(seconds) {
    if (!seconds && seconds !== 0) return '0分0秒';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}秒`;
    if (secs === 0) return `${mins}分`;
    return `${mins}分${secs}秒`;
  },

  // 格式化日期
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 获取某月的天数
  getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  },

  // 获取某个月份的第一个周一
  getFirstMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day === 0 ? 6 : day - 1);
    d.setDate(d.getDate() - diff);
    return d;
  },

  // 获取某个月份的最后一个周一
  getLastMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day === 0 ? 0 : 7 - day);
    d.setDate(d.getDate() + diff);
    if (d.getMonth() !== date.getMonth()) {
      d.setDate(d.getDate() - 7);
    }
    return d;
  },

  setCurrentWeek() {
    const now = new Date();
    const monday = this.getMondayDate(now);
    const sunday = this.getSundayDate(now);
    this.setData({
      currentWeek: `${monday.month}月${monday.day}日-${sunday.month}月${sunday.day}日`
    });
  },

  setMonthCompareTitle() {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    this.setData({
      'monthCompare.title': `${currentMonth}月 vs ${lastMonth}月`,
      'monthCompare.lastMonthName': `${lastMonth}月`,
      'monthCompare.currentMonthName': `${currentMonth}月`
    });
  },

  setWeeklyFeedbackRange() {
    this.setData({
      "weeklyFeedback.weekRange": this.data.currentWeek
    });
  },

  setMonthlySummaryMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    this.setData({
      'monthlySummary.month': `${year}年${month}月`
    });
  },

  getMondayDate(date) {
    const monday = new Date(date);
    const day = monday.getDay() || 7;
    monday.setDate(monday.getDate() - day + 1);
    return {
      month: monday.getMonth() + 1,
      day: monday.getDate()
    };
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

  loadChildData() {
    this.setData({ loading: true });

    const db = wx.cloud.database();
    const openid = this.data.openid;

    db.collection('children').where({
      parentOpenId: openid
    }).get().then(res => {
      const children = res.data;
      console.log(children);
      if (children.length === 0) {
        this.setData({ loading: false });
        return;
      }

      const childInfo = children[0];
      this.setData({
        childInfo: childInfo
      });

      this.loadPerformanceData(childInfo._id);
    }).catch(err => {
      console.error("加载孩子数据失败", err);
      this.setData({ loading: false });
    });
  },

  loadPerformanceData(childId) {
    const db = wx.cloud.database();

    this.generateMonthlyData(childId);

    Promise.all([
      this.loadPerformanceStats(db, childId),
      this.loadWeekTraining(db, childId),
      this.loadMonthCompare(db, childId),
      this.loadWeeklyFeedback(db, childId),
      this.loadMonthlySummary(db, childId),
      this.loadCurrentAssessment(childId)  // 【新增】加载体质测评
    ]).then(() => {
      this.setData({ loading: false });
    }).catch(err => {
      console.error("加载运动数据失败", err);
      this.setData({ loading: false });
    });
  },

  // 生成月度数据
  generateMonthlyData(childId) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    this.generateMonthlyDataForMonth(childId, year, month);
  },

  // 【修改】生成指定月份的月度数据（取当月最好成绩）- 添加所有新项目
  generateMonthlyDataForMonth(childId, year, month) {
    const db = wx.cloud.database();
    const _ = db.command;

    // 获取该月所有周一的日期范围
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month - 1, this.getDaysInMonth(year, month));
    
    const firstMonday = this.getFirstMonday(firstDayOfMonth);
    const lastMonday = this.getLastMonday(lastDayOfMonth);
    
    const monthStart = this.formatDate(firstMonday);
    const monthEnd = this.formatDate(lastMonday);

    console.log('查询日期范围:', monthStart, '至', monthEnd);

    db.collection('performance').where({
      childId: childId,
      weekDate: _.gte(monthStart).and(_.lte(monthEnd))
    }).get().then(res => {
      const performances = res.data;
      console.log('查询到的周数据数量:', performances.length);

      if (performances.length === 0) {
        console.log('该月无训练数据');
        return;
      }

      // 【修改】取当月最好成绩（添加所有新项目）
      // 50米跑（数值越小越好）
      const validFifty = performances.filter(p => p.fiftyMeter && p.fiftyMeter !== '').map(p => p.fiftyMeter);
      let bestFifty = validFifty.length > 0 ? Math.min(...validFifty) : null;
      
      // 1000米跑（数值越小越好）
      const validThousand = performances.filter(p => p.thousandMeter && p.thousandMeter !== '');
      let bestThousandSeconds = validThousand.length > 0 ? Math.min(...validThousand.map(p => this.convertToSeconds(p.thousandMeter))) : null;
      let bestThousand = bestThousandSeconds !== null ? this.formatSeconds(bestThousandSeconds) : null;
      
      // 【新增】800米跑（数值越小越好）
      const validEightHundred = performances.filter(p => p.eightHundredMeter && p.eightHundredMeter !== '');
      let bestEightHundredSeconds = validEightHundred.length > 0 ? Math.min(...validEightHundred.map(p => this.convertToSeconds(p.eightHundredMeter))) : null;
      let bestEightHundred = bestEightHundredSeconds !== null ? this.formatSeconds(bestEightHundredSeconds) : null;
      
      // 【新增】仰卧起坐（数值越大越好）
      const validSitUp = performances.filter(p => p.sitUp && p.sitUp !== '').map(p => p.sitUp);
      let bestSitUp = validSitUp.length > 0 ? Math.max(...validSitUp) : null;
      
      // 【新增】跳绳（数值越大越好）
      const validRopeSkipping = performances.filter(p => p.ropeSkipping && p.ropeSkipping !== '').map(p => p.ropeSkipping);
      let bestRopeSkipping = validRopeSkipping.length > 0 ? Math.max(...validRopeSkipping) : null;
      
      // 【新增】坐位体前屈（数值越大越好）
      const validSitAndReach = performances.filter(p => p.sitAndReach && p.sitAndReach !== '').map(p => p.sitAndReach);
      let bestSitAndReach = validSitAndReach.length > 0 ? Math.max(...validSitAndReach) : null;
      
      // 【新增】立定跳远（数值越大越好）
      const validStandingLongJump = performances.filter(p => p.standingLongJump && p.standingLongJump !== '').map(p => p.standingLongJump);
      let bestStandingLongJump = validStandingLongJump.length > 0 ? Math.max(...validStandingLongJump) : null;
      
      // 【新增】肺活量（数值越大越好）
      const validVitalCapacity = performances.filter(p => p.vitalCapacity && p.vitalCapacity !== '').map(p => p.vitalCapacity);
      let bestVitalCapacity = validVitalCapacity.length > 0 ? Math.max(...validVitalCapacity) : null;
      
      // 协调性（数值越大越好）
      const validCoordination = performances.filter(p => p.coordination !== undefined && p.coordination !== '').map(p => p.coordination);
      let bestCoordination = validCoordination.length > 0 ? Math.max(...validCoordination) : null;
      
      // 敏捷性（数值越大越好）
      const validAgility = performances.filter(p => p.agility !== undefined && p.agility !== '').map(p => p.agility);
      let bestAgility = validAgility.length > 0 ? Math.max(...validAgility) : null;

      const monthlyData = {
        childId: childId,
        year: year,
        month: month,
        fiftyMeter: bestFifty,
        thousandMeter: bestThousand,
        eightHundredMeter: bestEightHundred,      // 【新增】
        sitUp: bestSitUp,                          // 【新增】
        ropeSkipping: bestRopeSkipping,            // 【新增】
        sitAndReach: bestSitAndReach,              // 【新增】
        standingLongJump: bestStandingLongJump,    // 【新增】
        vitalCapacity: bestVitalCapacity,          // 【新增】
        coordination: bestCoordination,
        agility: bestAgility,
        weekCount: performances.length,
        updatedAt: new Date()
      };

      // 查询是否已存在
      db.collection('monthly_performance').where({
        childId: childId,
        year: year,
        month: month
      }).get().then(existingMonthly => {
        if (existingMonthly.data.length > 0) {
          db.collection('monthly_performance').doc(existingMonthly.data[0]._id).update({
            data: monthlyData
          }).then(() => {
            console.log('更新月度数据成功');
            this.generateMonthCompareData(childId, year, month);
          });
        } else {
          monthlyData.createdAt = new Date();
          db.collection('monthly_performance').add({
            data: monthlyData
          }).then(() => {
            console.log('添加月度数据成功');
            this.generateMonthCompareData(childId, year, month);
          });
        }
      });
    }).catch(err => {
      console.error('生成月度数据失败', err);
    });
  },

  // 【修改】生成月度对比数据 - 添加所有新项目
  generateMonthCompareData(childId, year, month) {
    const db = wx.cloud.database();

    let lastMonthYear = year;
    let lastMonth = month - 1;
    if (lastMonth === 0) {
      lastMonth = 12;
      lastMonthYear = year - 1;
    }

    Promise.all([
      db.collection('monthly_performance').where({
        childId: childId,
        year: year,
        month: month
      }).get(),
      db.collection('monthly_performance').where({
        childId: childId,
        year: lastMonthYear,
        month: lastMonth
      }).get()
    ]).then(([currentRes, lastRes]) => {
      const currentData = currentRes.data[0];
      const lastData = lastRes.data[0];

      if (!currentData) {
        console.log('当月数据不存在');
        return;
      }

      // 【修改】计算所有项目的对比数据
      let fiftyCompare = '', thousandCompare = '', eightHundredCompare = '';
      let sitUpCompare = '', ropeSkippingCompare = '', sitAndReachCompare = '';
      let standingLongJumpCompare = '', vitalCapacityCompare = '';
      let coordinationCompare = '', agilityCompare = '';

      if (lastData) {
        // 50米跑（数值越小越好）
        if (currentData.fiftyMeter && lastData.fiftyMeter) {
          const fiftyDiff = (lastData.fiftyMeter - currentData.fiftyMeter).toFixed(1);
          fiftyCompare = fiftyDiff > 0 ? `↑${fiftyDiff}秒` : (fiftyDiff < 0 ? `↓${Math.abs(fiftyDiff)}秒` : '持平');
        } else {
          fiftyCompare = currentData.fiftyMeter ? '新增数据' : '暂无数据';
        }

        // 1000米跑（数值越小越好）
        if (currentData.thousandMeter && lastData.thousandMeter) {
          const lastThousandSec = this.convertToSeconds(lastData.thousandMeter);
          const currentThousandSec = this.convertToSeconds(currentData.thousandMeter);
          const thousandDiff = lastThousandSec - currentThousandSec;
          if (thousandDiff > 0) {
            thousandCompare = `↑${thousandDiff}秒`;
          } else if (thousandDiff < 0) {
            thousandCompare = `↓${Math.abs(thousandDiff)}秒`;
          } else {
            thousandCompare = '持平';
          }
        } else {
          thousandCompare = currentData.thousandMeter ? '新增数据' : '暂无数据';
        }

        // 【新增】800米跑（数值越小越好）
        if (currentData.eightHundredMeter && lastData.eightHundredMeter) {
          const lastEightHundredSec = this.convertToSeconds(lastData.eightHundredMeter);
          const currentEightHundredSec = this.convertToSeconds(currentData.eightHundredMeter);
          const eightHundredDiff = lastEightHundredSec - currentEightHundredSec;
          if (eightHundredDiff > 0) {
            eightHundredCompare = `↑${eightHundredDiff}秒`;
          } else if (eightHundredDiff < 0) {
            eightHundredCompare = `↓${Math.abs(eightHundredDiff)}秒`;
          } else {
            eightHundredCompare = '持平';
          }
        } else {
          eightHundredCompare = currentData.eightHundredMeter ? '新增数据' : '暂无数据';
        }

        // 【新增】仰卧起坐（数值越大越好）
        if (currentData.sitUp && lastData.sitUp) {
          const sitUpDiff = currentData.sitUp - lastData.sitUp;
          sitUpCompare = sitUpDiff > 0 ? `↑${sitUpDiff}个` : (sitUpDiff < 0 ? `↓${Math.abs(sitUpDiff)}个` : '持平');
        } else {
          sitUpCompare = currentData.sitUp ? '新增数据' : '暂无数据';
        }

        // 【新增】跳绳（数值越大越好）
        if (currentData.ropeSkipping && lastData.ropeSkipping) {
          const ropeSkippingDiff = currentData.ropeSkipping - lastData.ropeSkipping;
          ropeSkippingCompare = ropeSkippingDiff > 0 ? `↑${ropeSkippingDiff}个` : (ropeSkippingDiff < 0 ? `↓${Math.abs(ropeSkippingDiff)}个` : '持平');
        } else {
          ropeSkippingCompare = currentData.ropeSkipping ? '新增数据' : '暂无数据';
        }

        // 【新增】坐位体前屈（数值越大越好）
        if (currentData.sitAndReach && lastData.sitAndReach) {
          const sitAndReachDiff = (currentData.sitAndReach - lastData.sitAndReach).toFixed(1);
          sitAndReachCompare = sitAndReachDiff > 0 ? `↑${sitAndReachDiff}厘米` : (sitAndReachDiff < 0 ? `↓${Math.abs(sitAndReachDiff)}厘米` : '持平');
        } else {
          sitAndReachCompare = currentData.sitAndReach ? '新增数据' : '暂无数据';
        }

        // 【新增】立定跳远（数值越大越好）
        if (currentData.standingLongJump && lastData.standingLongJump) {
          const standingLongJumpDiff = currentData.standingLongJump - lastData.standingLongJump;
          standingLongJumpCompare = standingLongJumpDiff > 0 ? `↑${standingLongJumpDiff}厘米` : (standingLongJumpDiff < 0 ? `↓${Math.abs(standingLongJumpDiff)}厘米` : '持平');
        } else {
          standingLongJumpCompare = currentData.standingLongJump ? '新增数据' : '暂无数据';
        }

        // 【新增】肺活量（数值越大越好）
        if (currentData.vitalCapacity && lastData.vitalCapacity) {
          const vitalCapacityDiff = currentData.vitalCapacity - lastData.vitalCapacity;
          vitalCapacityCompare = vitalCapacityDiff > 0 ? `↑${vitalCapacityDiff}毫升` : (vitalCapacityDiff < 0 ? `↓${Math.abs(vitalCapacityDiff)}毫升` : '持平');
        } else {
          vitalCapacityCompare = currentData.vitalCapacity ? '新增数据' : '暂无数据';
        }

        // 协调性（数值越大越好）
        if (currentData.coordination && lastData.coordination) {
          const coordinationDiff = currentData.coordination - lastData.coordination;
          coordinationCompare = coordinationDiff > 0 ? `↑${coordinationDiff}分` : (coordinationDiff < 0 ? `↓${Math.abs(coordinationDiff)}分` : '持平');
        } else {
          coordinationCompare = currentData.coordination ? '新增数据' : '暂无数据';
        }

        // 敏捷性（数值越大越好）
        if (currentData.agility && lastData.agility) {
          const agilityDiff = currentData.agility - lastData.agility;
          agilityCompare = agilityDiff > 0 ? `↑${agilityDiff}分` : (agilityDiff < 0 ? `↓${Math.abs(agilityDiff)}分` : '持平');
        } else {
          agilityCompare = currentData.agility ? '新增数据' : '暂无数据';
        }
      } else {
        fiftyCompare = '首月数据';
        thousandCompare = '首月数据';
        eightHundredCompare = '首月数据';
        sitUpCompare = '首月数据';
        ropeSkippingCompare = '首月数据';
        sitAndReachCompare = '首月数据';
        standingLongJumpCompare = '首月数据';
        vitalCapacityCompare = '首月数据';
        coordinationCompare = '首月数据';
        agilityCompare = '首月数据';
      }

      // 【修改】保存到 monthly_stats（添加所有新项目）
      const statsData = {
        childId: childId,
        year: String(year),
        currentMonth: month,
        lastMonth: lastMonth,
        fiftyMeter: {
          lastMonth: { value: lastData ? lastData.fiftyMeter : null },
          currentMonth: { value: currentData.fiftyMeter }
        },
        thousandMeter: {
          lastMonth: { value: lastData ? lastData.thousandMeter : null },
          currentMonth: { value: currentData.thousandMeter }
        },
        // 【新增】
        eightHundredMeter: {
          lastMonth: { value: lastData ? lastData.eightHundredMeter : null },
          currentMonth: { value: currentData.eightHundredMeter }
        },
        sitUp: {
          lastMonth: { value: lastData ? lastData.sitUp : null },
          currentMonth: { value: currentData.sitUp }
        },
        ropeSkipping: {
          lastMonth: { value: lastData ? lastData.ropeSkipping : null },
          currentMonth: { value: currentData.ropeSkipping }
        },
        sitAndReach: {
          lastMonth: { value: lastData ? lastData.sitAndReach : null },
          currentMonth: { value: currentData.sitAndReach }
        },
        standingLongJump: {
          lastMonth: { value: lastData ? lastData.standingLongJump : null },
          currentMonth: { value: currentData.standingLongJump }
        },
        vitalCapacity: {
          lastMonth: { value: lastData ? lastData.vitalCapacity : null },
          currentMonth: { value: currentData.vitalCapacity }
        },
        coordination: {
          lastMonth: { value: lastData ? lastData.coordination : null },
          currentMonth: { value: currentData.coordination }
        },
        agility: {
          lastMonth: { value: lastData ? lastData.agility : null },
          currentMonth: { value: currentData.agility }
        },
        compareText: {
          fiftyMeter: fiftyCompare,
          thousandMeter: thousandCompare,
          eightHundredMeter: eightHundredCompare,
          sitUp: sitUpCompare,
          ropeSkipping: ropeSkippingCompare,
          sitAndReach: sitAndReachCompare,
          standingLongJump: standingLongJumpCompare,
          vitalCapacity: vitalCapacityCompare,
          coordination: coordinationCompare,
          agility: agilityCompare
        },
        updatedAt: new Date()
      };

      db.collection('monthly_stats').where({
        childId: childId,
        year: String(year),
        currentMonth: month,
        lastMonth: lastMonth
      }).get().then(existingStats => {
        if (existingStats.data.length > 0) {
          db.collection('monthly_stats').doc(existingStats.data[0]._id).update({
            data: statsData
          });
        } else {
          statsData.createdAt = new Date();
          db.collection('monthly_stats').add({
            data: statsData
          });
        }
        console.log('月度对比数据生成成功');
      });
    }).catch(err => {
      console.error('生成月度对比数据失败', err);
    });
  },

  loadPerformanceStats(db, childId) {
    return db.collection('performance').where({
      childId: childId,
      weekDate: this.getCurrentWeekDate()
    }).get().then(res => {
      if (res.data.length > 0) {
        console.log(res.data[0]);
        this.setData({ performance: res.data[0] });
      }
    }).catch(() => {});
  },

  loadWeekTraining(db, childId) {
    return db.collection('trainings').where({
      childId: childId
    }).orderBy('date', 'asc').get().then(res => {
      if (res.data.length > 0) {
        console.log(res.data);
        this.setData({ weekTrainings: res.data });
      }
    }).catch(() => {});
  },

  loadMonthCompare(db, childId) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const currentYear = now.getFullYear();

    return db.collection('monthly_stats').where({
      childId: childId,
      year: String(currentYear),
      currentMonth: currentMonth,
      lastMonth: lastMonth
    }).get().then(res => {
      if (res.data.length >= 1) {
        console.log('查询成功：', res.data);
        this.processMonthCompare(res.data, lastMonth, currentMonth);
        return { success: true, data: res.data };
      } else {
        console.log('查询成功但没有数据');
        return { success: true, data: null };
      }
    }).catch((err) => {
      console.error('查询失败：', err);
      return { success: false, error: err };
    });
  },

  // 【修改】处理月度对比数据 - 添加所有新项目
 // 【修改】处理月度对比数据 - 添加所有新项目，并统一缩放比例
processMonthCompare(data, lastMonth, currentMonth) {
  console.log('=============');
  console.log(data[0]);

  const maxFifty = 12;
  const maxThousand = 360;
  const maxEightHundred = 300;      // 800米最大参考值5分钟=300秒
  
  // 【修改】调整最大参考值，使柱状图高度合理
  const maxSitUp = 80;              // 仰卧起坐最大参考值80个
  const maxRopeSkipping = 200;      // 跳绳最大参考值200个（用于计算比例，但显示高度会再除以5）
  const maxSitAndReach = 30;        // 坐位体前屈最大参考值30厘米
  const maxStandingLongJump = 250;  // 立定跳远最大参考值250厘米（用于计算比例，但显示高度会再除以5）
  const maxVitalCapacity = 5000;    // 肺活量最大参考值5000毫升（用于计算比例，但显示高度会再除以5）
  const maxCoordination = 100;
  const maxAgility = 100;

  const stats = data[0];

  // 50米跑
  const fiftyLastValue = stats.fiftyMeter?.lastMonth?.value;
  const fiftyCurrentValue = stats.fiftyMeter?.currentMonth?.value;
  let fiftyCompareText = stats.compareText?.fiftyMeter || '';
  let fiftyTrendClass = '';
  if (fiftyLastValue && fiftyCurrentValue) {
    const fiftyDiff = fiftyLastValue - fiftyCurrentValue;
    fiftyTrendClass = fiftyDiff > 0 ? 'up' : (fiftyDiff < 0 ? 'down' : '');
  }

  // 1000米跑
  const thousandLastValueStr = stats.thousandMeter?.lastMonth?.value;
  const thousandCurrentValueStr = stats.thousandMeter?.currentMonth?.value;
  let thousandCompareText = stats.compareText?.thousandMeter || '';
  let thousandTrendClass = '';
  if (thousandLastValueStr && thousandCurrentValueStr) {
    const thousandLastValueSec = this.convertToSeconds(thousandLastValueStr);
    const thousandCurrentValueSec = this.convertToSeconds(thousandCurrentValueStr);
    const thousandDiffSec = thousandLastValueSec - thousandCurrentValueSec;
    thousandTrendClass = thousandDiffSec > 0 ? 'up' : (thousandDiffSec < 0 ? 'down' : '');
  }

  // 【新增】800米跑
  const eightHundredLastValueStr = stats.eightHundredMeter?.lastMonth?.value;
  const eightHundredCurrentValueStr = stats.eightHundredMeter?.currentMonth?.value;
  let eightHundredCompareText = stats.compareText?.eightHundredMeter || '';
  let eightHundredTrendClass = '';
  let eightHundredLastValueSec = 0, eightHundredCurrentValueSec = 0;
  if (eightHundredLastValueStr && eightHundredCurrentValueStr) {
    eightHundredLastValueSec = this.convertToSeconds(eightHundredLastValueStr);
    eightHundredCurrentValueSec = this.convertToSeconds(eightHundredCurrentValueStr);
    const eightHundredDiffSec = eightHundredLastValueSec - eightHundredCurrentValueSec;
    eightHundredTrendClass = eightHundredDiffSec > 0 ? 'up' : (eightHundredDiffSec < 0 ? 'down' : '');
  }

  // 【新增】仰卧起坐
  const sitUpLastValue = stats.sitUp?.lastMonth?.value;
  const sitUpCurrentValue = stats.sitUp?.currentMonth?.value;
  let sitUpCompareText = stats.compareText?.sitUp || '';
  let sitUpTrendClass = '';
  if (sitUpLastValue && sitUpCurrentValue) {
    const sitUpDiff = sitUpCurrentValue - sitUpLastValue;
    sitUpTrendClass = sitUpDiff > 0 ? 'up' : (sitUpDiff < 0 ? 'down' : '');
  }

  // 【新增】跳绳 - 【修改】高度缩放为原来的1/5
  const ropeSkippingLastValue = stats.ropeSkipping?.lastMonth?.value;
  const ropeSkippingCurrentValue = stats.ropeSkipping?.currentMonth?.value;
  let ropeSkippingCompareText = stats.compareText?.ropeSkipping || '';
  let ropeSkippingTrendClass = '';
  let ropeSkippingLastScaled = 0, ropeSkippingCurrentScaled = 0;
  if (ropeSkippingLastValue && ropeSkippingCurrentValue) {
    const ropeSkippingDiff = ropeSkippingCurrentValue - ropeSkippingLastValue;
    ropeSkippingTrendClass = ropeSkippingDiff > 0 ? 'up' : (ropeSkippingDiff < 0 ? 'down' : '');
    // 缩放：除以5
    ropeSkippingLastScaled = ropeSkippingLastValue / 5;
    ropeSkippingCurrentScaled = ropeSkippingCurrentValue / 5;
  }

  // 【新增】坐位体前屈
  const sitAndReachLastValue = stats.sitAndReach?.lastMonth?.value;
  const sitAndReachCurrentValue = stats.sitAndReach?.currentMonth?.value;
  let sitAndReachCompareText = stats.compareText?.sitAndReach || '';
  let sitAndReachTrendClass = '';
  if (sitAndReachLastValue && sitAndReachCurrentValue) {
    const sitAndReachDiff = sitAndReachCurrentValue - sitAndReachLastValue;
    sitAndReachTrendClass = sitAndReachDiff > 0 ? 'up' : (sitAndReachDiff < 0 ? 'down' : '');
  }

  // 【新增】立定跳远 - 【修改】高度缩放为原来的1/5
  const standingLongJumpLastValue = stats.standingLongJump?.lastMonth?.value;
  const standingLongJumpCurrentValue = stats.standingLongJump?.currentMonth?.value;
  let standingLongJumpCompareText = stats.compareText?.standingLongJump || '';
  let standingLongJumpTrendClass = '';
  let standingLongJumpLastScaled = 0, standingLongJumpCurrentScaled = 0;
  if (standingLongJumpLastValue && standingLongJumpCurrentValue) {
    const standingLongJumpDiff = standingLongJumpCurrentValue - standingLongJumpLastValue;
    standingLongJumpTrendClass = standingLongJumpDiff > 0 ? 'up' : (standingLongJumpDiff < 0 ? 'down' : '');
    // 缩放：除以5
    standingLongJumpLastScaled = standingLongJumpLastValue / 5;
    standingLongJumpCurrentScaled = standingLongJumpCurrentValue / 5;
  }

  // 【新增】肺活量 - 【修改】高度缩放为原来的1/60
  const vitalCapacityLastValue = stats.vitalCapacity?.lastMonth?.value;
  const vitalCapacityCurrentValue = stats.vitalCapacity?.currentMonth?.value;
  let vitalCapacityCompareText = stats.compareText?.vitalCapacity || '';
  let vitalCapacityTrendClass = '';
  let vitalCapacityLastScaled = 0, vitalCapacityCurrentScaled = 0;
  if (vitalCapacityLastValue && vitalCapacityCurrentValue) {
    const vitalCapacityDiff = vitalCapacityCurrentValue - vitalCapacityLastValue;
    vitalCapacityTrendClass = vitalCapacityDiff > 0 ? 'up' : (vitalCapacityDiff < 0 ? 'down' : '');
    // 缩放：除以60
    vitalCapacityLastScaled = vitalCapacityLastValue / 60;
    vitalCapacityCurrentScaled = vitalCapacityCurrentValue / 60;
  }

  // 协调性
  const coordLastValue = stats.coordination?.lastMonth?.value;
  const coordCurrentValue = stats.coordination?.currentMonth?.value;
  let coordCompareText = stats.compareText?.coordination || '';
  let coordTrendClass = '';
  if (coordLastValue && coordCurrentValue) {
    const coordDiff = coordCurrentValue - coordLastValue;
    coordTrendClass = coordDiff > 0 ? 'up' : (coordDiff < 0 ? 'down' : '');
  }

  // 敏捷性
  const agilityLastValue = stats.agility?.lastMonth?.value;
  const agilityCurrentValue = stats.agility?.currentMonth?.value;
  let agilityCompareText = stats.compareText?.agility || '';
  let agilityTrendClass = '';
  if (agilityLastValue && agilityCurrentValue) {
    const agilityDiff = agilityCurrentValue - agilityLastValue;
    agilityTrendClass = agilityDiff > 0 ? 'up' : (agilityDiff < 0 ? 'down' : '');
  }

  this.setData({
    'monthCompare.fiftyMeter': {
      lastMonth: {
        value: fiftyLastValue ? fiftyLastValue.toFixed(1) : '暂无',
        height: fiftyLastValue ? (fiftyLastValue / maxFifty) * 100 : 0
      },
      currentMonth: {
        value: fiftyCurrentValue ? fiftyCurrentValue.toFixed(1) : '暂无',
        height: fiftyCurrentValue ? (fiftyCurrentValue / maxFifty) * 100 : 0
      },
      compareText: fiftyCompareText,
      trendClass: fiftyTrendClass,
    },
    'monthCompare.thousandMeter': {
      lastMonth: {
        value: thousandLastValueStr || '暂无',
        height: thousandLastValueStr ? (this.convertToSeconds(thousandLastValueStr) / maxThousand) * 100 : 0
      },
      currentMonth: {
        value: thousandCurrentValueStr || '暂无',
        height: thousandCurrentValueStr ? (this.convertToSeconds(thousandCurrentValueStr) / maxThousand) * 100 : 0
      },
      compareText: thousandCompareText,
      trendClass: thousandTrendClass
    },
    // 【新增】800米跑
    'monthCompare.eightHundredMeter': {
      lastMonth: {
        value: eightHundredLastValueStr || '暂无',
        height: eightHundredLastValueStr ? (eightHundredLastValueSec / maxEightHundred) * 100 : 0
      },
      currentMonth: {
        value: eightHundredCurrentValueStr || '暂无',
        height: eightHundredCurrentValueStr ? (eightHundredCurrentValueSec / maxEightHundred) * 100 : 0
      },
      compareText: eightHundredCompareText,
      trendClass: eightHundredTrendClass
    },
    // 【新增】仰卧起坐
    'monthCompare.sitUp': {
      lastMonth: {
        value: sitUpLastValue || '暂无',
        height: sitUpLastValue ? (sitUpLastValue / maxSitUp) * 100 : 0
      },
      currentMonth: {
        value: sitUpCurrentValue || '暂无',
        height: sitUpCurrentValue ? (sitUpCurrentValue / maxSitUp) * 100 : 0
      },
      compareText: sitUpCompareText,
      trendClass: sitUpTrendClass
    },
    // 【新增】跳绳 - 【修改】使用缩放后的高度
    'monthCompare.ropeSkipping': {
      lastMonth: {
        value: ropeSkippingLastValue || '暂无',
        height: ropeSkippingLastScaled ? (ropeSkippingLastScaled / (maxRopeSkipping / 5)) * 100 : 0
      },
      currentMonth: {
        value: ropeSkippingCurrentValue || '暂无',
        height: ropeSkippingCurrentScaled ? (ropeSkippingCurrentScaled / (maxRopeSkipping / 5)) * 100 : 0
      },
      compareText: ropeSkippingCompareText,
      trendClass: ropeSkippingTrendClass
    },
    // 【新增】坐位体前屈
    'monthCompare.sitAndReach': {
      lastMonth: {
        value: sitAndReachLastValue || '暂无',
        height: sitAndReachLastValue ? (sitAndReachLastValue / maxSitAndReach) * 100 : 0
      },
      currentMonth: {
        value: sitAndReachCurrentValue || '暂无',
        height: sitAndReachCurrentValue ? (sitAndReachCurrentValue / maxSitAndReach) * 100 : 0
      },
      compareText: sitAndReachCompareText,
      trendClass: sitAndReachTrendClass
    },
    // 【新增】立定跳远 - 【修改】使用缩放后的高度
    'monthCompare.standingLongJump': {
      lastMonth: {
        value: standingLongJumpLastValue || '暂无',
        height: standingLongJumpLastScaled ? (standingLongJumpLastScaled / (maxStandingLongJump / 5)) * 100 : 0
      },
      currentMonth: {
        value: standingLongJumpCurrentValue || '暂无',
        height: standingLongJumpCurrentScaled ? (standingLongJumpCurrentScaled / (maxStandingLongJump / 5)) * 100 : 0
      },
      compareText: standingLongJumpCompareText,
      trendClass: standingLongJumpTrendClass
    },
    // 【新增】肺活量 - 【修改】使用缩放后的高度
    'monthCompare.vitalCapacity': {
      lastMonth: {
        value: vitalCapacityLastValue || '暂无',
        height: vitalCapacityLastScaled ? (vitalCapacityLastScaled / (maxVitalCapacity / 60)) * 100 : 0
      },
      currentMonth: {
        value: vitalCapacityCurrentValue || '暂无',
        height: vitalCapacityCurrentScaled ? (vitalCapacityCurrentScaled / (maxVitalCapacity / 60)) * 100 : 0
      },
      compareText: vitalCapacityCompareText,
      trendClass: vitalCapacityTrendClass
    },
    'monthCompare.coordination': {
      lastMonth: {
        value: coordLastValue || '暂无',
        height: coordLastValue ? (coordLastValue / maxCoordination) * 100 : 0
      },
      currentMonth: {
        value: coordCurrentValue || '暂无',
        height: coordCurrentValue ? (coordCurrentValue / maxCoordination) * 100 : 0
      },
      compareText: coordCompareText,
      trendClass: coordTrendClass
    },
    'monthCompare.agility': {
      lastMonth: {
        value: agilityLastValue || '暂无',
        height: agilityLastValue ? (agilityLastValue / maxAgility) * 100 : 0
      },
      currentMonth: {
        value: agilityCurrentValue || '暂无',
        height: agilityCurrentValue ? (agilityCurrentValue / maxAgility) * 100 : 0
      },
      compareText: agilityCompareText,
      trendClass: agilityTrendClass
    }
  });
},
  onCurrentMonthChange(e) {
    const newIndex = e.detail.value;
    this.setData({ currentMonthIndex: newIndex }, () => {
      this.refreshMonthCompareData();
    });
  },

  onLastMonthChange(e) {
    const newIndex = e.detail.value;
    this.setData({ lastMonthIndex: newIndex }, () => {
      this.refreshMonthCompareData();
    });
  },

  refreshMonthCompareData() {
    const currentMonth = this.data.monthArray[this.data.currentMonthIndex];
    const lastMonth = this.data.monthArray[this.data.lastMonthIndex];
    this.setData({
      "monthCompare.title": `${currentMonth}月 vs ${lastMonth}月`
    });

    if (this.data.childInfo) {
      this.loadMonthCompareBasedOnSelection(this.data.childInfo._id, currentMonth, lastMonth);
    }
  },

  loadMonthCompareBasedOnSelection(childId, currentMonth, lastMonth) {
    console.log('----------------');
    const db = wx.cloud.database();
    return db.collection('monthly_stats').where({
      childId: childId,
      currentMonth: parseInt(currentMonth),
      lastMonth: parseInt(lastMonth)
    }).get().then((res) => {
      if (res.data.length >= 1) {
        console.log('载入成功');
        console.log(res.data);
        this.processMonthCompare(res.data, lastMonth, currentMonth);
      } else {
        wx.showToast({
          title: '没有此组合',
          icon: "none"
        });
      }
    }).catch((err) => {
      console.log(err);
    });
  },

  loadWeeklyFeedback(db, childId) {
    const weekRange = this.getCurrentWeekRange();
    return db.collection('feedbacks').where({
      childId: childId,
      date: db.command.gte(weekRange.start).and(db.command.lte(weekRange.end))
    }).orderBy('date', 'desc').get().then(res => {
      if (res.data.length > 0) {
        this.setData({
          weeklyFeedback: {
            weekRange: this.getCurrentWeekText(),
            list: res.data
          }
        });
      }
    }).catch(() => {});
  },

  // 【新增】加载当前月体质测评
loadCurrentAssessment(childId) {
  const db = wx.cloud.database();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  return db.collection('assessments').where({
    childId: childId,
    year: currentYear,
    month: currentMonth
  }).limit(1).get().then(res => {
    if (res.data.length > 0) {
      this.setData({ currentAssessment: res.data[0] });
    } else {
      this.setData({ currentAssessment: null });
    }
  }).catch(err => {
    console.error('加载体质测评失败', err);
    this.setData({ currentAssessment: null });
  });
},

  loadMonthlySummary(db, childId) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    return db.collection('monthly_summaries').where({
      childId: childId,
      year: currentYear,
      month: currentMonth
    }).get().then(res => {
      if (res.data.length > 0) {
        this.setData({
          monthlySummary: res.data[0]
        });
      }
    }).catch(() => {});
  },

  getCurrentWeekRange() {
    const now = new Date();
    const monday = this.getMondayDate(now);
    const sunday = this.getSundayDate(now);
    const start = `${now.getFullYear()}-${String(monday.month).padStart(2, '0')}-${String(monday.day).padStart(2, '0')}`;
    const end = `${now.getFullYear()}-${String(sunday.month).padStart(2, '0')}-${String(sunday.day).padStart(2, '0')}`;
    return { start, end };
  },

  getCurrentWeekText() {
    const now = new Date();
    const monday = this.getMondayDate(now);
    const sunday = this.getSundayDate(now);
    return `${monday.month}月${monday.day}日-${sunday.month}月${sunday.day}日`;
  },

  getCurrentWeekDate() {
    const now = new Date();
    const monday = this.getMondayDate(now);
    return `${now.getFullYear()}-${String(monday.month).padStart(2, '0')}-${String(monday.day).padStart(2, '0')}`;
  },

  viewHistoryStats() {
    wx.navigateTo({
      url: `/pages/users/history-stats/index?childId=${this.data.childInfo._id || ''}`
    });
  },

  viewAllTrainings() {
    wx.navigateTo({
      url: `/pages/users/trainings/index?childId=${this.data.childInfo?._id || ''}`
    });
  },

  viewTrainingDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/users/training-detail/index?trainingId=${id}`
    });
  },

  viewTrainingPhotos(e) {
    const { id } = e.currentTarget.dataset;
    console.log('=======================', id);
    wx.navigateTo({
      url: `/pages/users/training-photos/index?trainingId=${id}`
    });
  },

    // 【新增】跳转到测评历史
  viewAssessmentHistory() {
    wx.navigateTo({
      url: `/pages/coach/assessment/history/index?childId=${this.data.childInfo._id}&childName=${this.data.childInfo.name}`
    });
  },

  viewAllFeedbacks() {
    wx.navigateTo({
      url: `/pages/users/my-feedback/index`
    });
  },

  refreshData() {
    this.setData({ loading: true });
    setTimeout(() => {
      this.loadMockData();
      this.setData({ loading: false });
    }, 800);
  },

  loadMockData() {
    const childInfo = {
      _id: 'child001',
      name: '张小宝',
      age: 8,
      gender: 'male',
      joinMonths: 6
    };
  },

  onPullDownRefresh() {
    if (this.data.childInfo) {
      this.loadPerformanceData(this.data.childInfo._id).then(() => {
        wx.stopPullDownRefresh();
      });
    } else {
      this.loadChildData().then(() => {
        wx.stopPullDownRefresh();
      });
    }
  },

  onReachBottom() {},
  onShareAppMessage() {},
  onHide() {},
  onUnload() {}
});