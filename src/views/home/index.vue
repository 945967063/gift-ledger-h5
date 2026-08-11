<script setup lang="ts">
  import { computed } from 'vue';
  import { useRouter } from 'vue-router';
  import useStore from '@/store';
  import { showToast } from 'vant';

  const router = useRouter();
  const { gift } = useStore();

  const formattedNetBalance = computed(() => {
    const net = gift.netBalance;
    const sign = net >= 0 ? '+' : '-';
    return `${sign}¥${Math.abs(net).toLocaleString()}`;
  });

  const recentList = computed(() => {
    return gift.recentRecords;
  });

  const formatRecordDate = (dateStr: string) => {
    if (!dateStr) return '';
    const today = new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (dateStr.startsWith(today)) return '今天';
    if (dateStr.startsWith(yesterdayDate)) return '昨天';
    return dateStr.split(' ')[0];
  };

  const goToRecord = (type: 'received' | 'given') => {
    router.push({ path: '/record', query: { tab: type } });
  };

  const goToEvents = () => {
    router.push('/events');
  };

  const goToContact = (contactName: string) => {
    router.push({ path: '/contacts/detail', query: { name: contactName } });
  };

  const showNotification = () => {
    showToast({
      message: '近期有 2 场亲友宴席待参加，请注意人情往来提醒！',
      icon: 'bell',
    });
  };
</script>

<template>
  <div class="home-page">
    <!-- Top Header -->
    <div class="header-section">
      <div class="user-profile">
        <div class="avatar-circle">
          <span>{{ gift.userName.slice(-1) || '明' }}</span>
        </div>
        <div class="greeting-box">
          <div class="greeting-sub">您好，</div>
          <div class="greeting-name">{{ gift.userName }}</div>
        </div>
      </div>

      <div class="header-action-btn" @click="showNotification">
        <van-icon name="bell" />
        <span class="notification-badge" />
      </div>
    </div>

    <!-- Red Hero Card -->
    <div class="hero-balance-card">
      <div class="card-title">净人情往来余额</div>
      <div class="balance-amount">{{ formattedNetBalance }}</div>

      <div class="card-footer-metrics">
        <div class="metric-col" @click="goToEvents">
          <div class="metric-label">
            <span class="dot orange-dot" />
            <span>总收入 (收)</span>
          </div>
          <div class="metric-value">¥{{ gift.totalIncome.toLocaleString() }}</div>
        </div>

        <div class="metric-divider" />

        <div class="metric-col" @click="goToEvents">
          <div class="metric-label">
            <span class="dot coral-dot" />
            <span>总支出 (送)</span>
          </div>
          <div class="metric-value">¥{{ gift.totalExpense.toLocaleString() }}</div>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="quick-action-bar">
      <div class="action-btn received-btn" @click="goToRecord('received')">
        <div class="action-icon-circle green-bg">
          <van-icon name="plus" />
        </div>
        <div class="action-text">
          <span class="main-title">记收礼</span>
          <span class="sub-desc">举办宴席收礼金</span>
        </div>
      </div>

      <div class="action-btn given-btn" @click="goToRecord('given')">
        <div class="action-icon-circle red-bg">
          <van-icon name="send-gift-o" />
        </div>
        <div class="action-text">
          <span class="main-title">记送礼</span>
          <span class="sub-desc">参加亲友喜宴份子</span>
        </div>
      </div>
    </div>

    <!-- Recent Records Section -->
    <div class="section-container">
      <div class="section-header">
        <div class="section-title">最近记录</div>
        <div class="section-more" @click="goToEvents">查看全部</div>
      </div>

      <div class="records-list">
        <div
          v-for="record in recentList"
          :key="record.id"
          class="record-card"
          @click="goToContact(record.contactName)"
        >
          <div class="record-left">
            <div
              class="type-tag-circle"
              :class="record.type === 'received' ? 'is-received' : 'is-given'"
            >
              {{ record.type === 'received' ? '收' : '送' }}
            </div>
            <div class="record-info">
              <div class="record-name">{{ record.contactName }}</div>
              <div class="record-event">{{ record.eventTitle }}</div>
            </div>
          </div>

          <div class="record-right">
            <div
              class="record-amount"
              :class="record.type === 'received' ? 'amount-green' : 'amount-red'"
            >
              {{ record.type === 'received' ? '+' : '-' }}¥{{
                Number(record.amount).toLocaleString()
              }}
            </div>
            <div class="record-date">
              {{ formatRecordDate(record.createdAt || record.eventDate) }}
            </div>
          </div>
        </div>

        <div v-if="recentList.length === 0" class="empty-state">
          <van-empty description="暂无往来记录，快去记一笔吧！" image="search" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  .home-page {
    padding: 10px 16px 20px 16px;
    background-color: var(--color-background-2);
    box-sizing: border-box;
    width: 100%;
    overflow-x: hidden;
  }

  .header-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 4px;
    margin-bottom: 16px;

    .user-profile {
      display: flex;
      align-items: center;
      gap: 10px;

      .avatar-circle {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        background-color: var(--app-gold-bg);
        border: 1.5px solid #d4a373;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        font-weight: 600;
        color: var(--app-gold-text);
        box-shadow: 0 2px 6px rgba(184, 134, 11, 0.12);
        flex-shrink: 0;
      }

      .greeting-box {
        display: flex;
        flex-direction: column;

        .greeting-sub {
          font-size: 12px;
          color: var(--app-text-secondary);
          line-height: 1.2;
        }

        .greeting-name {
          font-size: 17px;
          font-weight: 700;
          color: var(--app-text-primary);
          line-height: 1.3;
          margin-top: 2px;
        }
      }
    }

    .header-action-btn {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background-color: var(--app-card-bg);
      border: 1px solid var(--app-border);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 19px;
      color: var(--app-text-primary);
      position: relative;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
      flex-shrink: 0;

      .notification-badge {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background-color: #e53935;
      }
    }
  }

  /* Red Hero Card */
  .hero-balance-card {
    background: linear-gradient(135deg, #c5423f 0%, #b83633 100%);
    border-radius: 18px;
    padding: 20px 18px 16px 18px;
    color: #ffffff;
    box-shadow: 0 8px 20px rgba(195, 66, 63, 0.25);
    position: relative;
    overflow: hidden;
    margin-bottom: 16px;
    width: 100%;
    box-sizing: border-box;

    &::after {
      content: '';
      position: absolute;
      right: -20px;
      bottom: -30px;
      width: 130px;
      height: 130px;
      background: radial-gradient(circle, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0) 70%);
      border-radius: 50%;
      pointer-events: none;
    }

    .card-title {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.85);
      font-weight: 500;
      margin-bottom: 6px;
    }

    .balance-amount {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.5px;
      line-height: 1.1;
      margin-bottom: 18px;
    }

    .card-footer-metrics {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.15);

      .metric-col {
        flex: 1;
        cursor: pointer;

        .metric-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.82);
          margin-bottom: 4px;

          .dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            display: inline-block;

            &.orange-dot {
              background-color: #ffa940;
            }

            &.coral-dot {
              background-color: #ff7875;
            }
          }
        }

        .metric-value {
          font-size: 16px;
          font-weight: 700;
          color: #ffffff;
          padding-left: 13px;
        }
      }

      .metric-divider {
        width: 1px;
        height: 28px;
        background-color: rgba(255, 255, 255, 0.18);
        margin: 0 10px;
      }
    }
  }

  /* Quick Actions */
  .quick-action-bar {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 20px;
    width: 100%;

    .action-btn {
      background-color: var(--app-card-bg);
      border-radius: 14px;
      padding: 12px;
      display: flex;
      align-items: center;
      gap: 10px;
      border: 1px solid var(--app-border);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
      cursor: pointer;
      box-sizing: border-box;

      &:active {
        transform: scale(0.98);
      }

      .action-icon-circle {
        width: 34px;
        height: 34px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 17px;
        flex-shrink: 0;

        &.green-bg {
          background-color: var(--app-green-light);
          color: var(--app-green);
        }

        &.red-bg {
          background-color: var(--app-primary-light);
          color: var(--app-primary);
        }
      }

      .action-text {
        display: flex;
        flex-direction: column;
        min-width: 0;

        .main-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--app-text-primary);
        }

        .sub-desc {
          font-size: 11px;
          color: var(--app-text-secondary);
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }
    }
  }

  /* Section Header */
  .section-container {
    width: 100%;

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;

      .section-title {
        font-size: 16px;
        font-weight: 700;
        color: var(--app-text-primary);
      }

      .section-more {
        font-size: 13px;
        color: #c3423f;
        font-weight: 500;
        cursor: pointer;
      }
    }
  }

  /* Record Cards List */
  .records-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;

    .record-card {
      background-color: var(--app-card-bg);
      border-radius: 14px;
      padding: 13px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 1px solid var(--app-border);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
      cursor: pointer;
      box-sizing: border-box;

      &:active {
        background-color: rgba(0, 0, 0, 0.02);
      }

      .record-left {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
        min-width: 0;

        .type-tag-circle {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          flex-shrink: 0;

          &.is-received {
            background-color: #eaf7ee;
            color: #27ae60;
          }

          &.is-given {
            background-color: #fdf0ee;
            color: #c3423f;
          }
        }

        .record-info {
          display: flex;
          flex-direction: column;
          min-width: 0;

          .record-name {
            font-size: 15px;
            font-weight: 700;
            color: var(--app-text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .record-event {
            font-size: 12px;
            color: var(--app-text-secondary);
            margin-top: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }
      }

      .record-right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        flex-shrink: 0;
        margin-left: 8px;

        .record-amount {
          font-size: 16px;
          font-weight: 800;

          &.amount-green {
            color: #27ae60;
          }

          &.amount-red {
            color: #c3423f;
          }
        }

        .record-date {
          font-size: 11px;
          color: var(--app-text-muted);
          margin-top: 2px;
        }
      }
    }
  }
</style>
