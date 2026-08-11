<script setup lang="ts">
  import { computed, ref } from 'vue';
  import { useRouter } from 'vue-router';
  import useStore from '@/store';
  import { EVENT_TYPE_MAP, getPaymentMethodLabel } from '@/store/modules/giftStore';
  import type { EventItem, EventType } from '@/types/gift';

  const router = useRouter();
  const { gift } = useStore();

  const activeTab = ref<'hosted' | 'attended'>('hosted');
  const searchKeyword = ref('');
  const showSearchBar = ref(false);

  const showEventDetailPopup = ref(false);
  const currentEvent = ref<EventItem | null>(null);

  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/home');
    }
  };

  const filteredEvents = computed(() => {
    let list = activeTab.value === 'hosted' ? gift.myHostedEvents : gift.attendedEvents;
    if (searchKeyword.value.trim()) {
      const kw = searchKeyword.value.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(kw) ||
          EVENT_TYPE_MAP[e.type]?.label.includes(kw) ||
          (e.targetContactName && e.targetContactName.toLowerCase().includes(kw))
      );
    }
    return list;
  });

  const getEventIcon = (type: EventType) => {
    switch (type) {
      case 'wedding':
        return 'like-o';
      case 'baby':
        return 'gift-o';
      case 'housewarming':
        return 'wap-home-o';
      case 'birthday':
        return 'smile-o';
      case 'longevity':
        return 'flower-o';
      default:
        return 'notes-o';
    }
  };

  const openEventDetail = (event: EventItem) => {
    currentEvent.value = event;
    showEventDetailPopup.value = true;
  };

  const currentEventRecords = computed(() => {
    if (!currentEvent.value) return [];
    return gift.records.filter(
      (r) => r.eventId === currentEvent.value?.id || r.eventTitle === currentEvent.value?.title
    );
  });

  const goToCreateRecord = () => {
    router.push({
      path: '/record',
      query: { tab: activeTab.value === 'hosted' ? 'received' : 'given' },
    });
  };
</script>

<template>
  <div class="events-page">
    <!-- Top Header -->
    <div class="events-header">
      <div class="header-left" @click="goBack">
        <van-icon name="arrow-left" />
      </div>
      <div class="header-title">我的事件</div>
      <div class="header-right" @click="showSearchBar = !showSearchBar">
        <van-icon name="search" />
      </div>
    </div>

    <!-- Search Bar -->
    <div v-if="showSearchBar" class="search-bar-wrap">
      <van-search
        v-model="searchKeyword"
        placeholder="搜索事件名称、类型或联系人"
        shape="round"
        clearable
      />
    </div>

    <!-- Pill Tabs ("我办的" / "参加的") -->
    <div class="events-tabs">
      <div
        class="tab-btn"
        :class="{ active: activeTab === 'hosted' }"
        @click="activeTab = 'hosted'"
      >
        我办的
      </div>
      <div
        class="tab-btn"
        :class="{ active: activeTab === 'attended' }"
        @click="activeTab = 'attended'"
      >
        参加的
      </div>
    </div>

    <!-- Event Cards List -->
    <div class="events-list">
      <div
        v-for="event in filteredEvents"
        :key="event.id"
        class="event-card"
        @click="openEventDetail(event)"
      >
        <div class="event-icon-box">
          <van-icon :name="getEventIcon(event.type)" />
        </div>

        <div class="event-main-content">
          <div class="event-top-row">
            <div class="event-title">{{ event.title }}</div>
            <div class="event-type-tag">{{ EVENT_TYPE_MAP[event.type]?.label || '事件' }}</div>
          </div>

          <div class="event-date">{{ event.date }}</div>

          <div class="event-summary-row">
            <template v-if="event.isHostedByMe">
              <span class="summary-income">收到 ¥{{ event.totalAmount.toLocaleString() }}</span>
              <span class="summary-count">
                共{{ event.guestCount || currentEventRecords.length || 0 }}人
              </span>
            </template>
            <template v-else>
              <span class="summary-expense">送出 ¥{{ event.totalAmount.toLocaleString() }}</span>
              <span v-if="event.targetContactName" class="summary-contact">
                {{ event.targetContactName }}
              </span>
            </template>
          </div>
        </div>
      </div>

      <div v-if="filteredEvents.length === 0" class="empty-box">
        <van-empty description="暂无相关事件" image="search" />
        <button class="create-event-btn" @click="goToCreateRecord">+ 新增一笔人情事件</button>
      </div>
    </div>

    <!-- Event Detail Popup -->
    <van-popup
      v-model:show="showEventDetailPopup"
      position="bottom"
      round
      class="event-detail-popup"
      style="max-height: 80%"
    >
      <div v-if="currentEvent" class="detail-container">
        <div class="detail-header">
          <div class="detail-title-box">
            <div class="detail-title">{{ currentEvent.title }}</div>
            <div class="detail-meta">
              <span>{{ currentEvent.date }}</span>
              ·
              <span>{{ EVENT_TYPE_MAP[currentEvent.type]?.label }}</span>
            </div>
          </div>
          <van-icon name="cross" class="close-icon" @click="showEventDetailPopup = false" />
        </div>

        <div class="detail-summary-card">
          <div class="sum-col">
            <div class="sum-label">
              {{ currentEvent.isHostedByMe ? '礼金总计 (收)' : '礼金总计 (送)' }}
            </div>
            <div
              class="sum-amount"
              :class="currentEvent.isHostedByMe ? 'amount-green' : 'amount-red'"
            >
              {{ currentEvent.isHostedByMe ? '+' : '-' }}¥{{
                currentEvent.totalAmount.toLocaleString()
              }}
            </div>
          </div>
          <div v-if="currentEvent.isHostedByMe" class="sum-col right-col">
            <div class="sum-label">送礼宾客数</div>
            <div class="sum-val">
              {{ currentEvent.guestCount || currentEventRecords.length }} 人
            </div>
          </div>
        </div>

        <div class="records-subhead">
          <span>{{ currentEvent.isHostedByMe ? '宾客礼金明细' : '送礼记录' }}</span>
        </div>

        <div class="event-records-list">
          <div v-for="rec in currentEventRecords" :key="rec.id" class="event-rec-item">
            <div class="rec-user-info">
              <div>
                <span class="rec-name">{{ rec.contactName }}</span>
                <span v-if="rec.contactRelation" class="rec-relation">
                  ({{ rec.contactRelation }})
                </span>
              </div>
              <span class="rec-payment">{{ getPaymentMethodLabel(rec) }}</span>
            </div>
            <div class="rec-amt" :class="rec.type === 'received' ? 'amount-green' : 'amount-red'">
              {{ rec.type === 'received' ? '+' : '-' }}¥{{ Number(rec.amount).toLocaleString() }}
            </div>
          </div>

          <div v-if="currentEventRecords.length === 0" class="no-rec-hint">暂无单笔明细记录</div>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style lang="scss" scoped>
  .events-page {
    padding: 10px 16px 20px 16px;
    background-color: var(--color-background-2);
    box-sizing: border-box;
    width: 100%;
    overflow-x: hidden;
  }

  .events-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0 14px 0;

    .header-left {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      font-size: 19px;
      color: var(--app-text-primary);
      cursor: pointer;
    }

    .header-title {
      font-size: 17px;
      font-weight: 700;
      color: var(--app-text-primary);
    }

    .header-right {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      font-size: 19px;
      color: var(--app-text-primary);
      cursor: pointer;
    }
  }

  .search-bar-wrap {
    margin-bottom: 12px;

    :deep(.van-search) {
      padding: 0;
      background: transparent;

      .van-search__content {
        background-color: var(--app-card-bg);
        border: 1px solid var(--app-border);
        border-radius: 12px;
      }
    }
  }

  /* Pill Tabs */
  .events-tabs {
    display: flex;
    background-color: var(--app-card-bg);
    border-radius: 20px;
    padding: 3px;
    margin-bottom: 16px;
    border: 1px solid var(--app-border);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
    width: 100%;
    box-sizing: border-box;

    .tab-btn {
      flex: 1;
      text-align: center;
      padding: 8px 0;
      font-size: 13px;
      font-weight: 600;
      color: #666666;
      border-radius: 18px;
      transition: all 0.25s ease;
      cursor: pointer;

      &.active {
        background-color: #c3423f;
        color: #ffffff;
        box-shadow: 0 3px 10px rgba(195, 66, 63, 0.28);
      }
    }
  }

  .events-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;

    .event-card {
      background-color: var(--app-card-bg);
      border-radius: 14px;
      padding: 14px;
      display: flex;
      align-items: center;
      gap: 12px;
      border: 1px solid var(--app-border);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
      cursor: pointer;
      box-sizing: border-box;
      width: 100%;

      &:active {
        background-color: rgba(0, 0, 0, 0.02);
      }

      .event-icon-box {
        width: 42px;
        height: 42px;
        border-radius: 12px;
        background-color: #faf4ee;
        border: 1px solid #e8d8c8;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        color: #b08968;
        flex-shrink: 0;
      }

      .event-main-content {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;

        .event-top-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 6px;

          .event-title {
            font-size: 15px;
            font-weight: 700;
            color: var(--app-text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            flex: 1;
            min-width: 0;
          }

          .event-type-tag {
            font-size: 12px;
            color: var(--app-text-secondary);
            flex-shrink: 0;
          }
        }

        .event-date {
          font-size: 12px;
          color: var(--app-text-muted);
          margin-top: 2px;
          margin-bottom: 6px;
        }

        .event-summary-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          flex-wrap: wrap;

          .summary-income,
          .summary-expense {
            color: #c3423f;
            font-weight: 700;
          }

          .summary-count,
          .summary-contact {
            color: var(--app-text-secondary);
            font-weight: 500;
          }
        }
      }
    }

    .empty-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 30px 0;

      .create-event-btn {
        margin-top: 10px;
        background-color: #c3423f;
        color: #fff;
        border: none;
        padding: 9px 18px;
        border-radius: 18px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
      }
    }
  }

  /* Event Detail Popup */
  .event-detail-popup {
    .detail-container {
      padding: 18px;
      background-color: var(--color-background-2);

      .detail-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 14px;

        .detail-title {
          font-size: 17px;
          font-weight: 800;
          color: var(--app-text-primary);
        }

        .detail-meta {
          font-size: 12px;
          color: var(--app-text-secondary);
          margin-top: 3px;
        }

        .close-icon {
          font-size: 17px;
          color: var(--app-text-secondary);
          cursor: pointer;
        }
      }

      .detail-summary-card {
        background-color: var(--app-card-bg);
        border-radius: 12px;
        border: 1px solid var(--app-border);
        padding: 12px 16px;
        display: flex;
        justify-content: space-between;
        margin-bottom: 16px;

        .sum-col {
          .sum-label {
            font-size: 11px;
            color: var(--app-text-secondary);
            margin-bottom: 2px;
          }

          .sum-amount {
            font-size: 17px;
            font-weight: 800;

            &.amount-green {
              color: #27ae60;
            }

            &.amount-red {
              color: #c3423f;
            }
          }

          .sum-val {
            font-size: 15px;
            font-weight: 700;
            color: var(--app-text-primary);
          }
        }
      }

      .records-subhead {
        font-size: 13px;
        font-weight: 700;
        color: var(--app-text-primary);
        margin-bottom: 8px;
      }

      .event-records-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 240px;
        overflow-y: auto;

        .event-rec-item {
          background-color: var(--app-card-bg);
          border-radius: 10px;
          border: 1px solid var(--app-border);
          padding: 10px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;

          .rec-name {
            font-size: 14px;
            font-weight: 600;
            color: var(--app-text-primary);
          }

          .rec-user-info {
            min-width: 0;
          }

          .rec-payment {
            display: block;
            margin-top: 3px;
            color: var(--app-gold-text);
            font-size: 10px;
          }

          .rec-relation {
            font-size: 11px;
            color: var(--app-text-muted);
            margin-left: 4px;
          }

          .rec-amt {
            font-size: 14px;
            font-weight: 700;

            &.amount-green {
              color: #27ae60;
            }

            &.amount-red {
              color: #c3423f;
            }
          }
        }

        .no-rec-hint {
          text-align: center;
          padding: 14px;
          font-size: 12px;
          color: var(--app-text-muted);
        }
      }
    }
  }
</style>
