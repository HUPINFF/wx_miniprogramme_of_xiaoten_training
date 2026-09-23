// pages/users/growth-ability/index.js
//
// 基本能力成长（蜕变 tab 的「基本能力成长」入口页）。
// 承接成长页的能力叙事部分：概览条 + 最新进步故事卡 + 能力分组 + 成长曲线 + 教练的观察 + 成长对比。
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
    statusBarHeight: 0, // 状态栏高度(px)，自定义渐变头部用它让出位置
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
    // 曲线标题用。WXML 绑定不支持调用页面方法（旧页写的 {{getSportName(...)}} 渲染成空），
    // 所以把项目名落成 data 字段，随 selectedSport 一起更新
    selectedSportName: '50米',
    chartData: [],
    hasData: false,
    chartWidth: 350,
    weekOptions: [],
    compareWeek1: null,
    compareWeek1Index: 0,
    canGenerateCompare: false,
    showCompareChart: false,
    compareWeeks: [],
    allPerformanceData: [],
    compareSport: null,
    compareSportIndex: 0,
    // 能力成长区展示层：metrics=体测固定指标 | items=教练自定义训练项目（头部按钮切换）
    dataMode: 'metrics',
    // 近12周有没有教练自定义训练项目的课次（决定能力成长区是否显示）
    hasCustomItems: false,
    // 训练项目行式列表（一节课一行）：{_id, dateText, weekText, pills:[{name,amount}]}，与教练端近期表现同形态
    itemSessions: []
  },

  onLoad: function (options) {
    var windowInfo = wx.getWindowInfo();
    this.setData({ statusBarHeight: windowInfo.statusBarHeight || 0 });

    if (!this.checkLogin()) return;
    this.loadChildData();
  },

  /** 返回上一页；直接打开本页（无上一页）时退回蜕变 tab */
  goBack: function () {
    var pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.switchTab({ url: '/pages/users/growth/index' });
    }
  },

  checkLogin() {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.navigateTo({ url: '/pages/common/login/index' });
      return false;
    }
    return true;
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
        that.loadHighlight();
        that.loadAbilityGroups();
        that.loadMonthOverview();
        that.loadItemSessions();
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
        },
        fail: function (err) {
          console.error('加载表现数据失败', err);
          that.setData({ hasData: false });
        }
      });
  },

  /**
   * 「最新进步」故事卡
   *
   * desc 取 5 条做环比（不能复用 allPerformanceData：那是 asc 取最早的 20 条，
   * 学员攒够 20 周后最新一周根本不在里面，见成长页历史注释）。
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
   * 同时汇总进步项数给概览条，并把默认选中指标挪到第一个有数据的指标上，
   * 免得家长点进来先看到一张「暂无数据」的空曲线。
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
                that.setData({ selectedSport: picked, selectedSportName: that.getSportName(picked) });
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

  /** 能力分组卡里点某个指标 → 切换下方曲线 */
  selectMetric: function (e) {
    var key = e.currentTarget.dataset.key;
    if (!key || key === this.data.selectedSport) return;
    this.setData({ selectedSport: key, selectedSportName: this.getSportName(key) });
    this.loadPerformanceData();
  },

  /** 空状态引导 → 预约 tab */
  goBooking: function () {
    wx.switchTab({ url: '/pages/users/orders/index' });
  },

  /**
   * 快捷入口：固定指标成绩 → performance 历次记录页（history-stats）。
   * 装的是固定指标训练项目（50米/跳绳等统一测评项）的每周成绩，
   * 与教练自定义的训练项目区分。该页自己按 childId 查 performance 集合，
   * childId 是唯一入参；孩子还没加载出来（或没绑孩子）时进不去，
   * 给个提示而不是传空参看空页
   */
  goWeeklyStats: function () {
    if (!this.data.currentChildId) {
      wx.showToast({ title: '未找到孩子信息', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/pages/users/history-stats/index?childId=' + this.data.currentChildId
    });
  },

  /**
   * 快捷入口：体质测评 → 测评历史页（coach/assessment/history，即训练数据页
   * 「本月体质测评 → 历史记录」去的同一页面）。要 childId + childName 两个参数，
   * 孩子信息没加载出来时给提示而不是传空参看空页
   */
  goAssessmentHistory: function () {
    if (!this.data.currentChildId || !this.data.childInfo) {
      wx.showToast({ title: '未找到孩子信息', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: '/pages/coach/assessment/history/index?childId=' +
        this.data.currentChildId +
        '&childName=' + (this.data.childInfo.name || '')
    });
  },

  /** 能力成长区切换展示层：体测固定指标 ⇄ 教练自定义训练项目（纯展示切换，两层数据各自独立） */
  switchDataMode: function (e) {
    var mode = e.currentTarget.dataset.mode;
    if (!mode || mode === this.data.dataMode) return;
    this.setData({ dataMode: mode });
  },

  /** 训练项目行 → 该节课详情（家长端训练详情页，id 直达） */
  goTrainingDetail: function (e) {
    var id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: '/pages/users/training-detail/index?id=' + id });
  },

  /**
   * 训练项目层数据：近12周已完成课次，一节课一行（trainings.items 是教练排课时
   * 自己加的项目，与 performance 固定指标是两套数据）。
   * 每节课出项目药丸（名字 + 量）：AI 抽的 display 优先、组数/个数兜底，未完成标红；
   * 日期拆两行（9/22 + 周几），手动拼 Date 避免 UTC 解析把日子挪偏。
   * 单次 get 上限 20 条，取窗口内最近的 20 节课。
   */
  loadItemSessions: function () {
    var that = this;
    if (!this.data.currentChildId) {
      return;
    }

    var db = wx.cloud.database();
    var windowStart = this.getDateStringDaysAgo(83); // 近12周

    db.collection('trainings')
      .where({
        childId: this.data.currentChildId,
        status: 'finished',
        date: db.command.gte(windowStart)
      })
      .orderBy('date', 'desc')
      .limit(20)
      .get({
        success: function (res) {
          var itemSessions = (res.data || []).map(function (training) {
            var pills = [];
            (training.items || []).forEach(function (item) {
              if (!item || !item.name) return;
              var amount = (item.metric && item.metric.display) || that.formatItemAmount(item.sets, item.reps) || '';
              if (!amount && item.done === false) amount = '未完成';
              pills.push({ name: item.name, amount: amount });
            });
            if (!pills.length) pills.push({ name: training.name || '训练完成', amount: '' });

            // 日期两行排版：9/22 + 周几（手动拼 Date，避免 UTC 解析把日子挪偏）
            var dateText = training.date || '';
            var weekText = '';
            var parts = dateText.split('-');
            if (parts.length === 3) {
              dateText = parseInt(parts[1], 10) + '/' + parseInt(parts[2], 10);
              var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
              weekText = '周' + ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
            }

            return { _id: training._id, dateText: dateText, weekText: weekText, pills: pills };
          });

          that.setData({
            hasCustomItems: itemSessions.length > 0,
            itemSessions: itemSessions
          });
        },
        fail: function (err) {
          console.error('加载训练项目数据失败', err);
        }
      });
  },

  /** 组数/个数 → 「3组×12次」；只填了一边就只显示一边，都空返回空串 */
  formatItemAmount: function (sets, reps) {
    if (sets && reps) return sets + '组×' + reps + '次';
    if (sets) return sets + '组';
    if (reps) return reps + '次';
    return '';
  },

  /** 今天往前推 days 天的 YYYY-MM-DD（本地时区），给近12周窗口用 */
  getDateStringDaysAgo: function (days) {
    var d = new Date();
    d.setDate(d.getDate() - days);
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  },

  switchTab: function (e) {
    var tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
    this.loadPerformanceData();
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
