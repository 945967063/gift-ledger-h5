<script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'vue';
  import { useRouter } from 'vue-router';
  import { statsApi } from '@/api/records';
  import AppSvgIcon from '@/components/AppSvgIcon.vue';

  const router = useRouter();

  const thisYear = new Date().getFullYear();
  const currentYear = ref(thisYear);
  const showYearPicker = ref(false);
  const statsLoading = ref(false);
  const statsLoadFailed = ref(false);
  const selectedMonthIndex = ref<number | null>(null);
  const availableYears = ref<number[]>([thisYear]);
  const yearlySummary = ref({ received: 0, given: 0, balance: 0 });
  const monthlyData = ref<{ month: number; monthLabel: string; received: number; given: number }[]>(
    []
  );
  const topExchangedPeople = ref<
    {
      name: string;
      relation: string;
      tag: string;
      received: number;
      given: number;
      total: number;
    }[]
  >([]);
  const categoryStats = ref<{ label: string; amount: number; percent: number }[]>([]);
  let statsRequestId = 0;

  const clearStatistics = () => {
    yearlySummary.value = { received: 0, given: 0, balance: 0 };
    monthlyData.value = [];
    topExchangedPeople.value = [];
    categoryStats.value = [];
    selectedMonthIndex.value = null;
  };

  const yearColumns = computed(() => {
    const years = new Set([
      ...Array.from({ length: 5 }, (_, index) => thisYear - index),
      ...availableYears.value,
    ]);
    return Array.from(years)
      .sort((a, b) => b - a)
      .map((year) => ({ text: `${year} 年`, value: year }));
  });

  const onConfirmYear = ({ selectedOptions }: any) => {
    currentYear.value = Number(selectedOptions[0].value);
    showYearPicker.value = false;
    selectedMonthIndex.value = null;
  };

  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/home');
    }
  };

  const chartMonths = computed(() => monthlyData.value);
  const hasMonthlyData = computed(() =>
    chartMonths.value.some((month) => month.received > 0 || month.given > 0)
  );

  const maxBarAmount = computed(() => {
    let max = 1000;
    chartMonths.value.forEach((m) => {
      if (m.received > max) max = m.received;
      if (m.given > max) max = m.given;
    });
    return max * 1.15;
  });

  const getBarHeightPercent = (amount: number) => {
    if (!amount || maxBarAmount.value <= 0) return 0;
    const pct = Math.round((amount / maxBarAmount.value) * 100);
    return Math.max(pct, 5);
  };

  const loadStatistics = async () => {
    const requestId = ++statsRequestId;
    const year = currentYear.value;
    statsLoading.value = true;
    statsLoadFailed.value = false;
    try {
      const [summaryResponse, monthlyResponse, topResponse, categoryResponse] = await Promise.all([
        statsApi.getSummary(year),
        statsApi.getMonthly(year),
        statsApi.getTopContacts(5, year),
        statsApi.getCategory(year),
      ]);
      if (requestId !== statsRequestId) return;
      const summary = summaryResponse.data.data;
      yearlySummary.value = {
        received: Number(summary.totalIncome || 0),
        given: Number(summary.totalExpense || 0),
        balance: Number(summary.netBalance || 0),
      };
      monthlyData.value = monthlyResponse.data.data.map((item) => ({
        ...item,
        received: Number(item.received || 0),
        given: Number(item.given || 0),
      }));
      topExchangedPeople.value = topResponse.data.data.map((item) => ({
        name: item.name,
        relation: item.relation || '朋友',
        tag: item.tag || item.relation || '朋友',
        received: Number(item.received || 0),
        given: Number(item.given || 0),
        total: Number(item.total || 0),
      }));
      categoryStats.value = categoryResponse.data.data.map((item) => ({
        ...item,
        amount: Number(item.amount || 0),
        percent: Number(item.percent || 0),
      }));
    } catch {
      if (requestId === statsRequestId) {
        clearStatistics();
        statsLoadFailed.value = true;
      }
    } finally {
      if (requestId === statsRequestId) statsLoading.value = false;
    }
  };

  const selectMonth = (idx: number) => {
    selectedMonthIndex.value = selectedMonthIndex.value === idx ? null : idx;
  };

  const goToContactDetail = (contactName: string) => {
    router.push({ path: '/contacts/detail', query: { name: contactName } });
  };

  watch(currentYear, () => void loadStatistics());
  onMounted(async () => {
    try {
      const yearsResponse = await statsApi.getYears();
      availableYears.value = yearsResponse.data.data;
    } catch {
      // 保留默认年份，统计主体仍可独立重试。
    }
    await loadStatistics();
  });
</script>

<template>
  <div class="statistics-page">
    <!-- Header -->
    <div class="stats-header">
      <button type="button" class="header-left" aria-label="返回" @click="goBack">
        <van-icon name="arrow-left" />
      </button>
      <div class="header-title">人情统计</div>
      <button
        type="button"
        class="header-right"
        aria-label="选择统计年份"
        :disabled="statsLoading"
        @click="showYearPicker = true"
      >
        <van-loading v-if="statsLoading" size="18" color="currentColor" />
        <AppSvgIcon v-else name="statistics" />
      </button>
    </div>

    <div v-if="statsLoadFailed" class="stats-load-error" role="status">
      <span>统计数据加载失败</span>
      <button type="button" :disabled="statsLoading" @click="loadStatistics">重试</button>
    </div>

    <div class="year-summary-card">
      <div>
        <span>年度收礼</span>
        <strong class="summary-green">¥{{ yearlySummary.received.toLocaleString() }}</strong>
      </div>
      <div>
        <span>年度送礼</span>
        <strong class="summary-red">¥{{ yearlySummary.given.toLocaleString() }}</strong>
      </div>
      <div>
        <span>往来结余</span>
        <strong :class="yearlySummary.balance >= 0 ? 'summary-green' : 'summary-red'">
          {{ yearlySummary.balance >= 0 ? '+' : '-' }}¥{{
            Math.abs(yearlySummary.balance).toLocaleString()
          }}
        </strong>
      </div>
    </div>

    <!-- Yearly Trend Section -->
    <div class="trend-section">
      <div class="trend-header">
        <div class="trend-title">{{ currentYear }}年 往来走势</div>
        <button
          type="button"
          class="year-select-btn"
          :disabled="statsLoading"
          @click="showYearPicker = true"
        >
          <span>{{ currentYear }}</span>
          <van-icon name="arrow-down" />
        </button>
      </div>

      <div class="trend-chart-card">
        <!-- Legend -->
        <div class="chart-legend">
          <div class="legend-item">
            <span class="legend-box green-box" />
            <span>收礼 (收入)</span>
          </div>
          <div class="legend-item">
            <span class="legend-box red-box" />
            <span>送礼 (支出)</span>
          </div>
        </div>

        <!-- Bar Chart Container -->
        <div v-if="hasMonthlyData" class="bars-chart-container">
          <div
            v-for="(item, idx) in chartMonths"
            :key="item.month"
            class="month-bar-group"
            :class="{ selected: selectedMonthIndex === idx }"
            @click="selectMonth(idx)"
          >
            <!-- Bars Area -->
            <div class="bars-col-wrapper">
              <!-- Green Bar (Received) -->
              <div
                class="bar green-bar"
                :style="{ height: `${getBarHeightPercent(item.received)}%` }"
              />
              <!-- Red Bar (Given) -->
              <div class="bar red-bar" :style="{ height: `${getBarHeightPercent(item.given)}%` }" />
            </div>

            <!-- Month Label -->
            <div class="month-label">{{ item.monthLabel }}</div>
          </div>
        </div>
        <div v-else class="stats-empty-state stats-empty-state--chart">
          <span class="stats-empty-state__icon">
            <van-icon name="chart-trending-o" />
          </span>
          <strong>暂无往来记录</strong>
          <span>{{ currentYear }} 年的收送礼走势会展示在这里</span>
        </div>

        <!-- Selected Month Detail Toast -->
        <div
          v-if="selectedMonthIndex !== null && chartMonths[selectedMonthIndex]"
          class="month-detail-strip"
        >
          <span class="m-name">{{ chartMonths[selectedMonthIndex].monthLabel }}：</span>
          <span class="m-rec">
            收 ¥{{ chartMonths[selectedMonthIndex].received.toLocaleString() }}
          </span>
          <span class="m-divider">/</span>
          <span class="m-giv">
            送 ¥{{ chartMonths[selectedMonthIndex].given.toLocaleString() }}
          </span>
        </div>
      </div>
    </div>

    <!-- Leaderboard: 往来最多的人 -->
    <div class="leaderboard-section">
      <div class="section-title">{{ currentYear }} 年往来最多的人</div>

      <div class="rank-list">
        <div
          v-for="(person, idx) in topExchangedPeople"
          :key="person.name"
          class="rank-item-card"
          @click="goToContactDetail(person.name)"
        >
          <div class="rank-left">
            <div
              class="rank-num-badge"
              :class="{
                'gold-rank': idx === 0,
                'silver-rank': idx === 1,
                'bronze-rank': idx === 2,
              }"
            >
              {{ idx + 1 }}
            </div>

            <div class="person-info">
              <div class="person-name">{{ person.name }}</div>
              <div class="person-tag">{{ person.tag || person.relation }}</div>
            </div>
          </div>

          <div class="rank-right">
            <div class="person-total">¥{{ person.total.toLocaleString() }}</div>
            <div class="person-breakdown">
              收 ¥{{ person.received.toLocaleString() }} / 送 ¥{{ person.given.toLocaleString() }}
            </div>
          </div>
        </div>

        <div v-if="topExchangedPeople.length === 0" class="stats-empty-state">
          <span class="stats-empty-state__icon stats-empty-state__icon--people">
            <van-icon name="friends-o" />
          </span>
          <strong>暂无往来人员</strong>
          <span>记录收礼或送礼后，这里会展示往来最多的人</span>
        </div>
      </div>
    </div>

    <!-- Category Breakdown Section -->
    <div class="category-breakdown-section">
      <div class="section-title">{{ currentYear }} 年人情类型分布</div>

      <div class="category-card">
        <div v-for="cat in categoryStats.slice(0, 4)" :key="cat.label" class="cat-row">
          <div class="cat-info">
            <span class="cat-label">{{ cat.label }}</span>
            <span class="cat-amount">¥{{ cat.amount.toLocaleString() }} ({{ cat.percent }}%)</span>
          </div>
          <div class="cat-progress-track">
            <div class="cat-progress-fill" :style="{ width: `${cat.percent}%` }" />
          </div>
        </div>
        <div v-if="categoryStats.length === 0" class="stats-empty-state">
          <span class="stats-empty-state__icon stats-empty-state__icon--category">
            <van-icon name="bar-chart-o" />
          </span>
          <strong>暂无类型统计</strong>
          <span>产生往来记录后，这里会按人情类型汇总</span>
        </div>
      </div>
    </div>

    <!-- Year Picker Popup -->
    <van-popup v-model:show="showYearPicker" position="bottom" round>
      <van-picker
        :columns="yearColumns"
        title="选择走势年份"
        @confirm="onConfirmYear"
        @cancel="showYearPicker = false"
      />
    </van-popup>
  </div>
</template>

<style lang="scss" scoped>
  .statistics-page {
    padding: 10px 16px 20px 16px;
    background-color: var(--color-background-2);
    box-sizing: border-box;
    width: 100%;
    overflow-x: hidden;
  }

  .stats-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0 14px 0;

    .header-left,
    .header-right {
      width: 40px;
      height: 40px;
      padding: 0;
      border: 0;
      background: transparent;
      display: flex;
      align-items: center;
      font-size: 19px;
      color: var(--app-text-primary);
      cursor: pointer;

      &:disabled {
        cursor: wait;
        opacity: 0.72;
      }
    }

    .header-left {
      justify-content: flex-start;
    }

    .header-right {
      justify-content: flex-end;
    }

    .header-title {
      font-size: 17px;
      font-weight: 700;
      color: var(--app-text-primary);
    }
  }

  .stats-load-error {
    display: flex;
    min-height: 40px;
    padding: 8px 12px;
    margin-bottom: 12px;
    border: 1px solid color-mix(in srgb, var(--app-primary) 28%, var(--app-border));
    border-radius: 12px;
    background: var(--app-primary-light);
    color: var(--app-primary);
    font-size: 12px;
    align-items: center;
    justify-content: space-between;

    button {
      padding: 5px 10px;
      border: 0;
      border-radius: 8px;
      background: var(--app-primary);
      color: #fff;
      font: inherit;
      font-weight: 700;
    }
  }

  .year-summary-card {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1px;
    margin-bottom: 18px;
    overflow: hidden;
    border: 1px solid var(--app-border);
    border-radius: 16px;
    background: var(--app-border);
    box-shadow: 0 8px 20px rgba(35, 31, 28, 0.06);
    backdrop-filter: blur(16px);

    > div {
      min-width: 0;
      padding: 12px 8px;
      background: var(--app-card-bg);
      text-align: center;
    }

    span,
    strong {
      display: block;
    }

    span {
      color: var(--app-text-muted);
      font-size: 9px;
    }

    strong {
      margin-top: 5px;
      overflow: hidden;
      font-size: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .summary-green {
      color: var(--app-green);
    }

    .summary-red {
      color: var(--app-primary);
    }
  }

  /* Trend Section */
  .trend-section {
    margin-bottom: 20px;
    width: 100%;

    .trend-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;

      .trend-title {
        font-size: 16px;
        font-weight: 700;
        color: var(--app-text-primary);
      }

      .year-select-btn {
        display: flex;
        align-items: center;
        gap: 3px;
        background-color: var(--app-card-bg);
        border: 1px solid var(--app-border);
        border-radius: 10px;
        padding: 3px 8px;
        font-size: 11px;
        font-weight: 600;
        color: var(--app-text-primary);
        cursor: pointer;

        &:disabled {
          cursor: wait;
          opacity: 0.66;
        }
      }
    }

    .trend-chart-card {
      background-color: var(--app-card-bg);
      border-radius: 16px;
      padding: 14px 12px 10px 12px;
      border: 1px solid var(--app-border);
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.02);
      width: 100%;
      box-sizing: border-box;

      .chart-legend {
        display: flex;
        gap: 14px;
        margin-bottom: 14px;

        .legend-item {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          color: var(--app-text-secondary);

          .legend-box {
            width: 8px;
            height: 8px;
            border-radius: 2px;

            &.green-box {
              background-color: #2e9362;
            }

            &.red-box {
              background-color: #c3423f;
            }
          }
        }
      }

      .bars-chart-container {
        height: 130px;
        display: flex;
        justify-content: space-around;
        align-items: flex-end;
        padding-bottom: 4px;
        border-bottom: 1px solid var(--app-border);
        width: 100%;

        .month-bar-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
          cursor: pointer;
          flex: 1;
          max-width: 48px;

          &.selected {
            .month-label {
              font-weight: 700;
              color: var(--app-primary);
            }
          }

          .bars-col-wrapper {
            flex: 1;
            display: flex;
            align-items: flex-end;
            gap: 3px;
            width: 100%;
            justify-content: center;

            .bar {
              width: 7px;
              border-radius: 3px 3px 0 0;
              transition: height 0.3s ease;

              &.green-bar {
                background-color: #2e9362;
              }

              &.red-bar {
                background-color: #c3423f;
              }
            }
          }

          .month-label {
            font-size: 11px;
            color: var(--app-text-muted);
            margin-top: 6px;
          }
        }
      }

      .month-detail-strip {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        font-size: 11px;
        margin-top: 8px;
        background-color: var(--color-background-2);
        padding: 5px 10px;
        border-radius: 8px;

        .m-name {
          font-weight: 700;
          color: var(--app-text-primary);
        }

        .m-rec {
          color: #27ae60;
          font-weight: 600;
        }

        .m-divider {
          color: var(--app-text-muted);
        }

        .m-giv {
          color: #c3423f;
          font-weight: 600;
        }
      }
    }
  }

  /* Leaderboard */
  .leaderboard-section {
    margin-bottom: 20px;
    width: 100%;

    .section-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--app-text-primary);
      margin-bottom: 10px;
    }

    .rank-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;

      .rank-item-card {
        background-color: var(--app-card-bg);
        border-radius: 14px;
        padding: 12px 14px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border: 1px solid var(--app-border);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
        cursor: pointer;
        box-sizing: border-box;
        width: 100%;

        &:active {
          background-color: rgba(0, 0, 0, 0.02);
        }

        .rank-left {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          min-width: 0;

          .rank-num-badge {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 700;
            color: var(--app-text-secondary);
            background-color: var(--color-background-2);
            flex-shrink: 0;

            &.gold-rank {
              background-color: #faf4ee;
              color: #b08968;
              border: 1px solid #e8d8c8;
            }

            &.silver-rank {
              background-color: #f2f2f7;
              color: #636366;
            }

            &.bronze-rank {
              background-color: #fcf4ec;
              color: #c88344;
            }
          }

          .person-info {
            display: flex;
            flex-direction: column;
            min-width: 0;

            .person-name {
              font-size: 15px;
              font-weight: 700;
              color: var(--app-text-primary);
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }

            .person-tag {
              font-size: 11px;
              color: var(--app-text-secondary);
              margin-top: 2px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
          }
        }

        .rank-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          flex-shrink: 0;
          margin-left: 8px;

          .person-total {
            font-size: 15px;
            font-weight: 800;
            color: var(--app-text-primary);
          }

          .person-breakdown {
            font-size: 11px;
            color: var(--app-text-muted);
            margin-top: 2px;
            white-space: nowrap;
          }
        }
      }
    }
  }

  /* Category breakdown */
  .category-breakdown-section {
    width: 100%;

    .section-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--app-text-primary);
      margin-bottom: 10px;
    }

    .category-card {
      background-color: var(--app-card-bg);
      border-radius: 14px;
      padding: 14px 16px;
      border: 1px solid var(--app-border);
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-sizing: border-box;
      width: 100%;

      .cat-row {
        display: flex;
        flex-direction: column;
        gap: 5px;

        .cat-info {
          display: flex;
          justify-content: space-between;
          font-size: 12px;

          .cat-label {
            font-weight: 600;
            color: var(--app-text-primary);
          }

          .cat-amount {
            color: var(--app-text-secondary);
          }
        }

        .cat-progress-track {
          width: 100%;
          height: 5px;
          border-radius: 3px;
          background-color: var(--color-background-2);
          overflow: hidden;

          .cat-progress-fill {
            height: 100%;
            background-color: #c3423f;
            border-radius: 3px;
            transition: width 0.4s ease;
          }
        }
      }
    }
  }

  .stats-empty-state {
    display: flex;
    width: 100%;
    min-height: 116px;
    padding: 20px 16px;
    border: 1px dashed color-mix(in srgb, var(--app-border-strong) 72%, transparent);
    border-radius: 14px;
    background: color-mix(in srgb, var(--app-card-bg) 76%, transparent);
    color: var(--app-text-muted);
    text-align: center;
    align-items: center;
    flex-direction: column;
    justify-content: center;

    &--chart {
      min-height: 130px;
      border: 0;
      border-radius: 12px;
      background: color-mix(in srgb, var(--color-background-2) 66%, transparent);
    }

    &__icon {
      display: grid;
      width: 38px;
      height: 38px;
      margin-bottom: 10px;
      border-radius: 13px;
      background: var(--app-primary-light);
      color: var(--app-primary);
      font-size: 20px;
      place-items: center;

      &--people {
        background: var(--app-green-light);
        color: var(--app-green);
      }

      &--category {
        background: var(--app-gold-bg);
        color: var(--app-gold-text);
      }
    }

    strong,
    > span:last-child {
      display: block;
    }

    strong {
      color: var(--app-text-primary);
      font-size: 13px;
      font-weight: 700;
    }

    > span:last-child {
      margin-top: 5px;
      font-size: 11px;
      line-height: 1.5;
    }
  }
</style>
