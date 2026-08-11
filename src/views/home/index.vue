<script setup lang="ts">
  import { computed, ref } from 'vue';
  import { useRouter } from 'vue-router';
  import useStore from '@/store';
  import { closeToast, showLoadingToast, showToast } from 'vant';
  import { getPaymentMethodLabel } from '@/store/modules/giftStore';
  import { authApi } from '@/api/auth';

  const router = useRouter();
  const { appearance, darkMode, gift } = useStore();
  const showAccountActions = ref(false);
  const showProfileEditor = ref(false);
  const profileName = ref('');
  const savingProfile = ref(false);
  const accountActions = computed(() => [
    { key: 'profile', name: '修改账户昵称', icon: 'contact-o' },
    {
      key: 'theme',
      name: darkMode.darkMode ? '切换为浅色模式' : '切换为深色模式',
      icon: 'bulb-o',
    },
    { key: 'refresh-background', name: '换一张随机背景', icon: 'replay' },
    {
      key: 'toggle-background',
      name: appearance.backgroundEnabled ? '关闭背景图片' : '开启背景图片',
      icon: appearance.backgroundEnabled ? 'closed-eye' : 'eye-o',
    },
    { key: 'logout', name: '退出登录', icon: 'sign', color: '#c3423f' },
  ]);

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
    const toLocalDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const today = toLocalDate(new Date());
    const yesterdayDate = toLocalDate(new Date(Date.now() - 86400000));
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

  const onAccountAction = async (action: { key: string }) => {
    showAccountActions.value = false;
    if (action.key === 'profile') {
      profileName.value = gift.userName;
      showProfileEditor.value = true;
      return;
    }
    if (action.key === 'theme') {
      darkMode.toggleDarkMode();
      return;
    }
    if (action.key === 'refresh-background') {
      showLoadingToast({ message: '正在更换背景…', forbidClick: true, duration: 0 });
      const loaded = appearance.backgroundEnabled
        ? await appearance.refreshBackground()
        : await appearance.setBackgroundEnabled(true);
      closeToast();
      showToast(loaded ? '背景已更换' : '背景加载失败，已保留当前界面');
      return;
    }
    if (action.key === 'toggle-background') {
      await appearance.setBackgroundEnabled(!appearance.backgroundEnabled);
      showToast(appearance.backgroundEnabled ? '背景图片已开启' : '背景图片已关闭');
      return;
    }
    if (action.key !== 'logout') return;
    localStorage.removeItem('gift_ledger_token');
    localStorage.removeItem('gift_ledger_user');
    gift.resetData();
    gift.setUserName('用户');
    await router.replace('/login');
    showToast({ message: '已安全退出', icon: 'passed' });
  };

  const saveProfile = async () => {
    const name = profileName.value.trim();
    if (!name) {
      showToast('请输入账户昵称');
      return;
    }
    if (name.length > 30) {
      showToast('账户昵称不能超过 30 个字符');
      return;
    }
    if (savingProfile.value) return;
    savingProfile.value = true;
    try {
      await authApi.updateProfile(name);
      let storedUser: Record<string, unknown> = {};
      try {
        storedUser = JSON.parse(localStorage.getItem('gift_ledger_user') || '{}') as Record<
          string,
          unknown
        >;
      } catch {
        storedUser = {};
      }
      localStorage.setItem('gift_ledger_user', JSON.stringify({ ...storedUser, name }));
      gift.setUserName(name);
      showProfileEditor.value = false;
      showToast({ message: '账户昵称已更新', icon: 'passed' });
    } catch {
      // 请求层统一提示错误，保留输入内容以便重试。
    } finally {
      savingProfile.value = false;
    }
  };
</script>

<template>
  <div class="home-page">
    <!-- Top Header -->
    <div class="header-section">
      <button type="button" class="user-profile" @click="showAccountActions = true">
        <div class="avatar-circle">
          <span>{{ gift.userName.slice(-1) || '明' }}</span>
        </div>
        <div class="greeting-box">
          <div class="greeting-sub">您好，</div>
          <div class="greeting-name">{{ gift.userName }}</div>
        </div>
      </button>
      <button
        type="button"
        class="appearance-button"
        aria-label="外观设置"
        @click="showAccountActions = true"
      >
        <van-icon name="setting-o" />
      </button>
    </div>

    <van-action-sheet
      v-model:show="showAccountActions"
      :actions="accountActions"
      :description="`当前账号：${gift.userName}`"
      cancel-text="取消"
      close-on-click-action
      @select="onAccountAction"
    />

    <van-popup
      v-model:show="showProfileEditor"
      position="bottom"
      round
      class="profile-editor-popup"
      :close-on-click-overlay="!savingProfile"
    >
      <section class="profile-editor">
        <header>
          <div>
            <span>账户资料</span>
            <strong>修改昵称</strong>
          </div>
          <button
            type="button"
            aria-label="关闭账户资料编辑"
            :disabled="savingProfile"
            @click="showProfileEditor = false"
          >
            <van-icon name="cross" />
          </button>
        </header>
        <p>昵称会显示在首页问候和账户设置中。</p>
        <van-field
          v-model="profileName"
          label="昵称"
          maxlength="30"
          show-word-limit
          clearable
          placeholder="请输入账户昵称"
          @keyup.enter="saveProfile"
        />
        <button class="profile-save" type="button" :disabled="savingProfile" @click="saveProfile">
          <van-loading v-if="savingProfile" size="18" color="#fff" />
          <template v-else>保存账户资料</template>
        </button>
      </section>
    </van-popup>

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
              <div class="record-event">
                <span>{{ record.eventTitle }}</span>
                <span class="payment-label">· {{ getPaymentMethodLabel(record) }}</span>
              </div>
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
    background-color: transparent;
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

    .appearance-button {
      display: grid;
      place-items: center;
      width: 38px;
      height: 38px;
      padding: 0;
      border: 1px solid var(--app-border);
      border-radius: 13px;
      background: var(--app-card-bg);
      color: var(--app-text-primary);
      font-size: 18px;
      box-shadow: 0 5px 14px rgba(35, 31, 28, 0.08);
      backdrop-filter: blur(14px);
    }

    .user-profile {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0;
      border: 0;
      background: transparent;
      text-align: left;
      cursor: pointer;

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
            display: flex;
            align-items: center;
            gap: 3px;
            font-size: 12px;
            color: var(--app-text-secondary);
            margin-top: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;

            > span:first-child {
              overflow: hidden;
              text-overflow: ellipsis;
            }

            .payment-label {
              flex-shrink: 0;
              color: var(--app-gold-text);
              font-size: 10px;
            }
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

  :deep(.profile-editor-popup) {
    left: 50%;
    width: min(100%, 560px);
    transform: translateX(-50%);
    background: var(--color-background-2);
  }

  .profile-editor {
    padding: 18px 18px calc(24px + env(safe-area-inset-bottom));

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;

      span,
      strong {
        display: block;
      }

      span {
        color: var(--app-text-muted);
        font-size: 10px;
        letter-spacing: 0.12em;
      }

      strong {
        margin-top: 3px;
        color: var(--app-text-primary);
        font-size: 18px;
      }

      button {
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        padding: 0;
        border: 1px solid var(--app-border);
        border-radius: 12px;
        background: var(--app-card-bg);
        color: var(--app-text-secondary);
        font-size: 17px;
      }
    }

    > p {
      margin: 8px 0 16px;
      color: var(--app-text-secondary);
      font-size: 11px;
    }

    :deep(.van-field) {
      overflow: hidden;
      border: 1px solid var(--app-border);
      border-radius: 14px;
      background: var(--app-card-bg);
    }

    .profile-save {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 46px;
      margin-top: 16px;
      border: 0;
      border-radius: 15px;
      background: var(--app-primary);
      color: #fff;
      font-size: 14px;
      font-weight: 800;

      &:disabled {
        opacity: 0.66;
      }
    }
  }
</style>
