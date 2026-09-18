const app = getApp();
const { pickProgressHighlight, summarizeAbilityGroups, getTodayString } = require('../../../utils/helper');

/**
 * 进步卡的一句话解读：数据说「快了0.3秒」，这句话回答「所以呢」。
 * 按 metricKey 映射；没有的指标退回通用句。
 */
const PROGRESS_STORIES = {
  fiftyMeter: '起跑反应更快，冲刺更有劲了',
  eightHundredMeter: '心肺更有底子，后半程不掉速',
  thousandMeter: '耐力变好，长跑更轻松了',
  standingLongJump: '腿部力量变强，爆发更足',
  sitUp: '核心更稳定，腰腹更有力量',
  sitAndReach: '柔韧性变好，动作更舒展',
  ropeSkipping: '手脚配合更协调，节奏更稳',
  vitalCapacity: '肺活量上来了，运动更有劲',
  pushUp: '上肢力量变强，支撑更稳',
  pullUp: '背部和手臂力量在增长',
  agility: '变向更灵活，反应更机敏',
  coordination: '身体控制更好，动作更连贯'
};

Page({
  data: {
    childInfo: null,
    currentChildId: '',
    currentTab: 'week',
    // pickProgressHighlight 的结果；null 表示整卡隐藏（无记录/首次/无变化都走这里）
    highlight: null,
    // 进步卡的一句话解读（「所以呢」）：按 highlight.metricKey 映射
    storyText: '',
    // 本月概览条
    monthTrainings: 0,     // 本月已完成课次
    totalImproved: 0,      // 最近一次测评里进步的指标数
    overviewVisible: false, // 一次都没测过 → 概览条隐藏
    // 能力分组卡（summarizeAbilityGroups 的结果；空数组 = 一条测评都没有，整块隐藏）
    abilityGroups: [],
    // 教练的观察：最新一条反馈
    coachNote: null,
    sportsItems: [
      { key: 'fiftyMeter', name: '50米', unit: '秒', yMin: 5, yMax: 20 },
      { key: 'eightHundredMeter', name: '800米', unit: '分', yMin: 2.5, yMax: 3.5 },
      { key: 'thousandMeter', name: '1000米', unit: '秒', yMin: 120, yMax: 400 },
      { key: 'standingLongJump', name: '立定跳远', unit: '米', yMin: 1, yMax: 3 },
      { key: 'sitUp', name: '仰卧起坐', unit: '个', yMin: 0, yMax: 100 },
      { key: 'pushUp', name: '俯卧撑', unit: '个', yMin: 0, yMax: 60 },
      { key: 'pullUp', name: '引体向上', unit: '个', yMin: 0, yMax: 30 },
      { key: 'sitAndReach', name: '坐位体前屈', unit: '厘米', yMin: 0, yMax: 50 },
      { key: 'ropeSkipping', name: '跳绳', unit: '个', yMin: 50, yMax: 250 },
      { key: 'agility', name: '敏捷', unit: '分', yMin: 0, yMax: 100 },
      { key: 'coordination', name: '协调', unit: '分', yMin: 0, yMax: 100 },
      { key: 'vitalCapacity', name: '肺活量', unit: 'ml', yMin: 1000, yMax: 6000 }
    ],
    selectedSport: 'fiftyMeter',
    chartData: [],
    hasData: false,
    chartWidth: 350,
    timelineData: [],
    timelineLoading: true,
    weekOptions: [],
    compareWeek1: null,
    compareWeek1Index: 0,
    canGenerateCompare: false,
    showCompareChart: false,
    compareWeeks: [],
    allPerformanceData: [],
    compareSport: null,
    compareSportIndex: 0
  },

  onLoad: function (options) {
    if (!this.checkLogin()) return;
    this.loadChildData();
  },

  checkLogin() {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.navigateTo({ url: '/pages/common/login/index' });
      return false;
    }
    return true;
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 1
      });
    }
  },

  loadChildData: function () {
    var that = this;
    var openid = wx.getStorageSync('openid');

    if (!openid) {
      console.error('用户未登录');
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    wx.cloud.database().collection('children').where({
      parentOpenId: openid
    }).get({
      success: function (res) {
        var children = res.data;
        if (children.length === 0) {
          wx.showToast({ title: '未找到孩子信息', icon: 'none' });
          return;
        }

        var childInfo = children[0];
        that.setData({
          childInfo: childInfo,
          currentChildId: childInfo._id
        });

        that.loadPerformanceData();
        that.loadTimelineData();
        that.loadHighlight();
        that.loadAbilityGroups();
        that.loadMonthOverview();
        that.loadCoachNote();
      },
      fail: function (err) {
        console.error('加载孩子数据失败', err);
      }
    });
  },

  loadPerformanceData: function () {
    var that = this;
    if (!this.data.currentChildId) {
      return;
    }

    wx.showLoading({ title: '加载中' });

    var collection, fieldName;
    if (this.data.currentTab === 'week') {
      collection = 'performance';
      fieldName = 'weekDate';
    } else {
      collection = 'monthly_performance';
      fieldName = 'month';
    }

    wx.cloud.database().collection(collection)
      .where({ childId: this.data.currentChildId })
      .orderBy(fieldName, 'asc')
      .limit(20)
      .get({
        success: function (res) {
          if (res.data && res.data.length > 0) {
            that.setData({ allPerformanceData: res.data });
            that.generateWeekOptions(res.data);
            that.processChartData(res.data);
          } else {
            that.setData({ hasData: false });
          }
          wx.hideLoading();
        },
        fail: function (err) {
          console.error('加载表现数据失败', err);
          that.setData({ hasData: false });
          wx.hideLoading();
        }
      });
  },

  /**
   * 「最新进步」卡片
   *
   * 单独查一次，不复用 allPerformanceData：后者是 orderBy('weekDate','asc').limit(20)，
   * 取到的是【最早】的 20 条，学员攒够 20 周后最新一周根本不在里面，
   * 用它算「最新进步」会把几个月前的旧成绩当成最新。这里 desc 取 5 条就够做环比了。
   *
   * 注意本页还有一个「每月」tab（monthly_performance），那个集合没有 weekDate 字段，
   * 所以这张卡始终是「按周」的口径——卡片上会明说「较上周」/「较上次记录（…）」避免歧义。
   */
  loadHighlight: function () {
    var that = this;
    if (!this.data.currentChildId) {
      return;
    }

    wx.cloud.database().collection('performance')
      .where({ childId: this.data.currentChildId })
      .orderBy('weekDate', 'desc')
      .limit(5)
      .get({
        success: function (res) {
          // 无记录 / 只有一条 / 最近两条没有任何共同指标 / 完全没有变化，
          // 这四种情况都会返回 null，是 pickProgressHighlight 设计好的：
          // 卡片整块隐藏，而不是硬渲染出「慢0秒」这种胡话
          var highlight = pickProgressHighlight(res.data);

          // 「所以呢」：把数字翻成家长听得懂的一句话。
          // 退步不粉饰也不打击，如实给一句站得住的鼓励。
          var storyText = '';
          if (highlight) {
            if (highlight.mode === 'first') {
              storyText = '第一份正式记录，成长从这里开始';
            } else if (highlight.isImprovement === false) {
              storyText = '这次没发挥好没关系，坚持练就会回来';
            } else {
              storyText = PROGRESS_STORIES[highlight.metricKey] || '每一次练习，身体都记得';
            }
          }

          that.setData({ highlight: highlight, storyText: storyText });
        },
        fail: function (err) {
          console.error('加载进步亮点失败', err);
          that.setData({ highlight: null, storyText: '' });
        }
      });
  },

  /**
   * 能力分组卡：最近两条测评按能力域归组（纯函数在 helper，有单测）。
   * 同时承担两件小事：
   * 1. 汇总进步项数给概览条；
   * 2. 默认选中的指标若从没测过，挪到第一个有数据的指标上，
   *    免得家长点进来先看到一张「暂无数据」的空曲线。
   */
  loadAbilityGroups: function () {
    var that = this;
    wx.cloud.database().collection('performance')
      .where({ childId: this.data.currentChildId })
      .orderBy('weekDate', 'desc')
      .limit(2)
      .get({
        success: function (res) {
          var groups = summarizeAbilityGroups(res.data);
          var totalImproved = 0;
          var measuredTotal = 0;
          groups.forEach(function (group) {
            totalImproved += group.improvedCount || 0;
            measuredTotal += group.measuredCount || 0;
          });

          that.setData({
            abilityGroups: groups,
            totalImproved: totalImproved,
            overviewVisible: measuredTotal > 0
          });

          // 当前选中项没有任何数据 → 挪到第一个有数据的指标
          var hasSelectedData = groups.some(function (group) {
            return group.metrics.some(function (metric) {
              return metric.key === that.data.selectedSport && metric.hasData;
            });
          });
          if (!hasSelectedData) {
            for (var i = 0; i < groups.length; i++) {
              var picked = null;
              for (var j = 0; j < groups[i].metrics.length; j++) {
                if (groups[i].metrics[j].hasData) { picked = groups[i].metrics[j].key; break; }
              }
              if (picked) {
                that.setData({ selectedSport: picked });
                that.loadPerformanceData();
                return;
              }
            }
          }
        },
        fail: function (err) {
          console.error('加载能力分组失败', err);
          that.setData({ abilityGroups: [], overviewVisible: false });
        }
      });
  },

  /** 本月已完成课次（finished），给概览条。count() 不受单次 get 20 条上限约束 */
  loadMonthOverview: function () {
    var that = this;
    var db = wx.cloud.database();
    var monthStart = getTodayString().slice(0, 7) + '-01';

    db.collection('trainings')
      .where({
        childId: this.data.currentChildId,
        status: 'finished',
        date: db.command.gte(monthStart)
      })
      .count()
      .then(function (res) {
        that.setData({ monthTrainings: (res && res.total) || 0 });
      })
      .catch(function (err) {
        console.error('加载本月课次失败', err);
        that.setData({ monthTrainings: 0 });
      });
  },

  /** 教练的观察：最新一条课后反馈，引用卡样式，点进去看全部 */
  loadCoachNote: function () {
    var that = this;
    wx.cloud.database().collection('feedbacks')
      .where({ childId: this.data.currentChildId })
      .orderBy('date', 'desc')
      .limit(1)
      .get({
        success: function (res) {
          that.setData({ coachNote: (res.data && res.data.length) ? res.data[0] : null });
        },
        fail: function (err) {
          console.error('加载教练观察失败', err);
          that.setData({ coachNote: null });
        }
      });
  },

  /** 能力分组卡里点某个指标 → 切换下方曲线 */
  selectMetric: function (e) {
    var key = e.currentTarget.dataset.key;
    if (!key || key === this.data.selectedSport) return;
    this.setData({ selectedSport: key });
    this.loadPerformanceData();
  },

  /** 教练的观察 → 我的反馈列表 */
  goFeedback: function () {
    wx.navigateTo({ url: '/pages/users/my-feedback/index' });
  },

  /** 空状态引导 → 预约 tab */
  goBooking: function () {
    wx.switchTab({ url: '/pages/users/orders/index' });
  },

  generateWeekOptions: function (data) {
    var that = this;
    var weekOptions = [];
    data.forEach(function (item, index) {
      var dateStr = '';
      if (item.weekDate) {
        var date = new Date(item.weekDate);
        dateStr = (date.getMonth() + 1) + '/' + date.getDate();
      } else if (item.month) {
        dateStr = item.month;
      }
      weekOptions.push({
        index: index,
        label: '第' + (index + 1) + '周 (' + dateStr + ')',
        dataIndex: index
      });
    });

    var compareWeek1 = weekOptions.length > 0 ? weekOptions[0] : null;
    var canGenerateCompare = weekOptions.length > 1;

    this.setData({
      weekOptions: weekOptions,
      compareWeek1: compareWeek1,
      compareWeek1Index: 0,
      canGenerateCompare: canGenerateCompare
    });
  },

  processChartData: function (data) {
    var that = this;
    var padding = { top: 30, right: 25, bottom: 40, left: 60 };
    var sport = this.data.sportsItems.find(function (item) {
      return item.key === that.data.selectedSport;
    });

    if (!sport) {
      return;
    }

    var currentYear = new Date().getFullYear();
    var chartData = [];
    data.forEach(function (item) {
      var value = item[sport.key];

      if (Array.isArray(value)) {
        value = value.find(function (v) {
          return v !== undefined && v !== null && v !== '';
        });
      }

      if (value === undefined || value === null || value === '') {
        return;
      }

      // 只保留当前年份的数据
      if (that.data.currentTab === 'week') {
        var weekDate = item.weekDate || item.updatedAt;
        if (weekDate) {
          var date = new Date(weekDate);
          var itemYear = date.getFullYear();
          if (itemYear !== currentYear) {
            return;
          }
        }
      } else {
        var itemYear = item.year || new Date().getFullYear();
        if (itemYear !== currentYear) {
          return;
        }
      }

      var parsedValue = that.parseValue(value, sport.key);
      if (parsedValue === null) {
        return;
      }

      var displayValue = that.formatValue(parsedValue, sport.key);
      var label = '';
      if (that.data.currentTab === 'week') {
        var weekDate = item.weekDate || item.updatedAt;
        if (weekDate) {
          var date = new Date(weekDate);
          label = (date.getMonth() + 1) + '/' + date.getDate();
        }
      } else {
        label = (item.year || new Date().getFullYear()) + '/' + item.month;
      }

      chartData.push({
        value: parsedValue,
        displayValue: displayValue,
        label: label
      });
    });

    if (chartData.length > 0) {
      chartData.reverse();
      var minWidth = 350;
      var perPointWidth = 60;
      var chartWidth = Math.max(minWidth, padding.left + chartData.length * perPointWidth + padding.right);
      this.setData({ chartData: chartData, hasData: true, chartWidth: chartWidth });
      this.drawChart(sport, chartData, chartWidth);
    } else {
      this.setData({ hasData: false });
    }
  },

  parseValue: function (value, sportKey) {
    if (typeof value === 'number') {
      if (sportKey === 'standingLongJump') {
        return value / 100;
      }
      return value;
    }

    if (typeof value === 'string') {
      if (sportKey === 'eightHundredMeter') {
        if (value.includes('分')) {
          var parts = value.split('分');
          var minutes = parseFloat(parts[0]) || 0;
          var seconds = 0;
          if (parts[1]) {
            var secMatch = parts[1].match(/(\d+)/);
            seconds = secMatch ? parseFloat(secMatch[1]) : 0;
          }
          return minutes + seconds / 60;
        }
      }

      if (sportKey === 'thousandMeter') {
        if (value.includes('分')) {
          var parts = value.split('分');
          var minutes = parseFloat(parts[0]) || 0;
          var seconds = 0;
          if (parts[1]) {
            var secMatch = parts[1].match(/(\d+)/);
            seconds = secMatch ? parseFloat(secMatch[1]) : 0;
          }
          return minutes * 60 + seconds;
        }
      }

      var match = value.match(/(\d+(?:\.\d+)?)/);
      if (match) {
        var numValue = parseFloat(match[0]);
        if (sportKey === 'standingLongJump') {
          return numValue / 100;
        }
        return numValue;
      }
      return null;
    }

    return null;
  },

  drawChart: function (sport, data, chartWidth) {
    var ctx = wx.createCanvasContext('lineChart');
    var width = chartWidth || 350;
    var height = 220;
    var padding = { top: 30, right: 25, bottom: 40, left: 60 };

    ctx.setFillStyle('#ffffff');
    ctx.fillRect(0, 0, width, height);

    ctx.setStrokeStyle('#eeeeee');
    ctx.setLineWidth(1);
    for (var i = 0; i <= 4; i++) {
      var y = padding.top + (i * (height - padding.top - padding.bottom)) / 4;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    var yMin = sport.yMin;
    var yMax = sport.yMax;
    var step = (yMax - yMin) / 4;
    var chartHeight = height - padding.top - padding.bottom;
    var isTimeBased = ['fiftyMeter', 'hundredMeter', 'eightHundredMeter', 'thousandMeter'].indexOf(sport.key) !== -1;

    ctx.setFillStyle('#999999');
    ctx.setFontSize(10);
    ctx.setTextAlign('right');
    for (var i = 0; i <= 4; i++) {
      var y = padding.top + (i * chartHeight) / 4;
      var value;
      if (isTimeBased) {
        value = yMin + i * step;
      } else {
        value = yMax - i * step;
      }
      var label = this.formatValue(value, sport.key);
      ctx.fillText(label, padding.left - 8, y + 4);
    }

    ctx.setTextAlign('center');
    var xStep = (width - padding.left - padding.right) / Math.max(data.length - 1, 1);
    for (var i = 0; i < data.length; i++) {
      var x = padding.left + i * xStep;
      ctx.fillText(data[i].label, x, height - 15);
    }

    ctx.setStrokeStyle('#07c160');
    ctx.setLineWidth(2);
    ctx.beginPath();
    var chartHeight = height - padding.top - padding.bottom;
    var isTimeBased = ['fiftyMeter', 'hundredMeter', 'eightHundredMeter', 'thousandMeter'].indexOf(sport.key) !== -1;

    for (var i = 0; i < data.length; i++) {
      var x = padding.left + i * xStep;
      var value = data[i].value;
      if (value < yMin) value = yMin;
      if (value > yMax) value = yMax;

      var y;
      if (isTimeBased) {
        y = padding.top + ((value - yMin) / (yMax - yMin)) * chartHeight;
      } else {
        y = padding.top + ((yMax - value) / (yMax - yMin)) * chartHeight;
      }

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    ctx.setFillStyle('#07c160');
    for (var i = 0; i < data.length; i++) {
      var x = padding.left + i * xStep;
      var value = data[i].value;
      if (value < yMin) value = yMin;
      if (value > yMax) value = yMax;

      var y;
      if (isTimeBased) {
        y = padding.top + ((value - yMin) / (yMax - yMin)) * chartHeight;
      } else {
        y = padding.top + ((yMax - value) / (yMax - yMin)) * chartHeight;
      }

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();

      ctx.setFillStyle('#ffffff');
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, 2 * Math.PI);
      ctx.fill();

      ctx.setFillStyle('#333333');
      ctx.setFontSize(10);
      ctx.setTextAlign('center');
      ctx.fillText(data[i].displayValue, x, y - 12);
    }

    ctx.draw();
  },

  formatValue: function (value, sportKey) {
    if (sportKey === 'eightHundredMeter') {
      var minutes = Math.floor(value);
      var seconds = Math.round((value - minutes) * 60);
      return minutes + '\'' + seconds + '"';
    }

    if (sportKey === 'thousandMeter') {
      var minutes = Math.floor(value / 60);
      var seconds = Math.round(value % 60);
      return minutes + '\'' + seconds + '"';
    }

    var sport = this.data.sportsItems.find(function (item) {
      return item.key === sportKey;
    });
    return value.toFixed(1) + (sport ? sport.unit : '');
  },

  getSportName: function (sportKey) {
    var sport = this.data.sportsItems.find(function (item) {
      return item.key === sportKey;
    });
    return sport ? sport.name : '';
  },

  switchTab: function (e) {
    var tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
    this.loadPerformanceData();
  },

  loadTimelineData: function () {
    var that = this;
    if (!this.data.currentChildId) {
      return;
    }

    this.setData({ timelineLoading: true });

    wx.cloud.database().collection('photosAvideos')
      .where({ childId: this.data.currentChildId })
      .orderBy('yearMonth', 'desc')
      .limit(12)
      .get({
        success: function (res) {
          var timelineData = res.data || [];

          timelineData.forEach(function (item) {
            if (item.yearMonth) {
              var yearMonth = item.yearMonth;
              if (yearMonth.includes('-')) {
                var parts = yearMonth.split('-');
                item.yearMonth = parts[0] + '年' + parts[1] + '月';
              }
            }
          });

          that.setData({
            timelineData: timelineData,
            timelineLoading: false
          });
        },
        fail: function (err) {
          console.error('加载时间轴数据失败', err);
          that.setData({
            timelineData: [],
            timelineLoading: false
          });
        }
      });
  },

  previewPhoto: function (e) {
    var photos = e.currentTarget.dataset.photos;
    var index = e.currentTarget.dataset.index;
    wx.previewImage({
      current: photos[index],
      urls: photos
    });
  },

  playVideo: function (e) {
    var url = e.currentTarget.dataset.url;
    wx.previewMedia({
      sources: [{ url: url, type: 'video' }],
      current: 0,
      showmenu: true
    });
  },

  selectCompareSport: function (e) {
    var index = e.detail.value;
    var sportsItems = this.data.sportsItems;
    if (sportsItems[index]) {
      this.setData({
        compareSport: sportsItems[index],
        compareSportIndex: index
      });
    }
  },

  selectCompareWeek1: function (e) {
    var index = e.detail.value;
    var weekOptions = this.data.weekOptions;
    if (weekOptions[index]) {
      this.setData({
        compareWeek1: weekOptions[index],
        compareWeek1Index: index
      });
    }
  },

  generateComparePoster: function () {
    var that = this;
    var compareSport = this.data.compareSport;
    var compareWeek1 = this.data.compareWeek1;

    if (!compareSport) {
      wx.showToast({ title: '请选择对比项目', icon: 'none' });
      return;
    }

    if (!compareWeek1) {
      wx.showToast({ title: '请选择要对比的周', icon: 'none' });
      return;
    }

    var allData = this.data.allPerformanceData;
    if (allData.length < 2) {
      wx.showToast({ title: '数据不足', icon: 'none' });
      return;
    }

    var week1Data = allData[compareWeek1.dataIndex];
    var week2Data = allData[allData.length - 1];

    if (!week1Data || !week2Data) {
      wx.showToast({ title: '数据不足', icon: 'none' });
      return;
    }

    var dataPoints = [week1Data, week2Data];
    var weekLabels = [compareWeek1.label, '最近1周'];

    this.setData({
      compareWeeks: weekLabels,
      showCompareChart: true
    });

    setTimeout(function () {
      that.drawCompareChart(dataPoints, compareSport);
    }, 100);
  },

  drawCompareChart: function (dataPoints, compareSport) {
    var that = this;
    var ctx = wx.createCanvasContext('compareChart');
    var width = 340;
    var height = 300;
    var padding = { top: 50, right: 40, bottom: 60, left: 50 };
    var chartWidth = width - padding.left - padding.right;
    var chartHeight = height - padding.top - padding.bottom;

    ctx.setFillStyle('#ffffff');
    ctx.fillRect(0, 0, width, height);

    var sport = compareSport || this.data.sportsItems.find(function (item) {
      return item.key === that.data.selectedSport;
    });

    if (!sport) return;

    var yMin = sport.yMin;
    var yMax = sport.yMax;
    var isTimeBased = ['fiftyMeter', 'hundredMeter', 'eightHundredMeter', 'thousandMeter'].indexOf(sport.key) !== -1;

    ctx.setStrokeStyle('#f0f0f0');
    ctx.setLineWidth(1);
    for (var i = 0; i <= 4; i++) {
      var y = padding.top + (i * chartHeight) / 4;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    ctx.setFillStyle('#666666');
    ctx.setFontSize(12);
    ctx.setTextAlign('right');
    for (var i = 0; i <= 4; i++) {
      var y = padding.top + (i * chartHeight) / 4;
      var value;
      if (isTimeBased) {
        value = yMin + (i * (yMax - yMin) / 4);
      } else {
        value = yMax - (i * (yMax - yMin) / 4);
      }
      var label = this.formatValue(value, sport.key);
      ctx.fillText(label, padding.left - 8, y + 4);
    }

    var colors = ['#ff6b6b', '#07c160'];
    var pointRadius = 8;
    var xStep = chartWidth / (dataPoints.length - 1 || 1);

    var points = [];
    dataPoints.forEach(function (data, index) {
      var value = data[sport.key];
      if (value === undefined || value === null) {
        return;
      }

      var parsedValue = that.parseValue(value, sport.key);
      if (parsedValue === null) {
        return;
      }

      var x = padding.left + index * xStep;
      var normalizedValue;

      if (isTimeBased) {
        normalizedValue = (parsedValue - yMin) / (yMax - yMin);
      } else {
        normalizedValue = (yMax - parsedValue) / (yMax - yMin);
      }

      normalizedValue = Math.max(0, Math.min(1, normalizedValue));
      var y = padding.top + normalizedValue * chartHeight;

      points.push({ x: x, y: y, value: parsedValue });
    });

    if (points.length >= 2) {
      ctx.setStrokeStyle('#07c160');
      ctx.setLineWidth(3);
      ctx.setLineCap('round');
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (var i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();

      points.forEach(function (point, index) {
        ctx.setFillStyle('#ffffff');
        ctx.beginPath();
        ctx.arc(point.x, point.y, pointRadius, 0, 2 * Math.PI);
        ctx.fill();

        ctx.setFillStyle(colors[index % colors.length]);
        ctx.beginPath();
        ctx.arc(point.x, point.y, pointRadius - 3, 0, 2 * Math.PI);
        ctx.fill();

        ctx.setFillStyle('#333333');
        ctx.setFontSize(13);
        ctx.setTextAlign('center');
        var label = that.formatValue(point.value, sport.key);
        ctx.fillText(label, point.x, point.y - 15);
      });
    }

    ctx.setFillStyle('#666666');
    ctx.setFontSize(12);
    ctx.setTextAlign('center');
    dataPoints.forEach(function (data, index) {
      var x = padding.left + index * xStep;
      ctx.fillText(that.data.compareWeeks[index] || '', x, height - 25);
    });

    ctx.setFillStyle('#07c160');
    ctx.setFontSize(16);
    ctx.setTextAlign('center');
    ctx.fillText(sport.name + ' 成长对比', width / 2, 25);

    ctx.draw();
  }
});