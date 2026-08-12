<script setup lang="ts">
  import { computed, reactive, ref } from 'vue';
  import { showConfirmDialog, showToast } from 'vant';
  import { useRouter } from 'vue-router';
  import { eventsApi } from '@/api/events';
  import { mapOperationLog } from '@/api/mappers';
  import useStore from '@/store';
  import {
    EVENT_TYPE_MAP,
    PAYMENT_METHOD_MAP,
    getPaymentMethodLabel,
  } from '@/store/modules/giftStore';
  import type {
    EventItem,
    EventType,
    GiftRecord,
    OperationAction,
    OperationLog,
    PaymentMethod,
    RelationType,
  } from '@/types/gift';

  interface RecordForm {
    contactName: string;
    contactRelation: RelationType;
    amount: string;
    paymentMethod: PaymentMethod;
    customPaymentMethod: string;
    remark: string;
  }

  interface EventForm {
    title: string;
    date: string;
    type: EventType;
    notes: string;
  }

  const router = useRouter();
  const { gift } = useStore();

  const activeTab = ref<'hosted' | 'attended'>('hosted');
  const searchKeyword = ref('');
  const showSearchBar = ref(false);
  const showEventDetailPopup = ref(false);
  const currentEventId = ref('');
  const detailTab = ref<'records' | 'logs'>('records');
  const eventLogs = ref<OperationLog[]>([]);
  const logsLoading = ref(false);
  const showGlobalLogs = ref(false);
  const globalLogs = ref<OperationLog[]>([]);
  const globalLogsLoading = ref(false);
  const showRecordEditor = ref(false);
  const editingRecord = ref<GiftRecord | null>(null);
  const savingRecord = ref(false);
  const showEventEditor = ref(false);
  const savingEvent = ref(false);

  // 滚动加载 - 宾客名单
  const PAGE_SIZE = 20;
  const recordsDisplayCount = ref(PAGE_SIZE);
  const recordsListLoading = ref(false);
  const recordsListFinished = ref(false);

  // 滚动加载 - 事件操作日志
  const eventLogsDisplayCount = ref(PAGE_SIZE);
  const eventLogsListLoading = ref(false);
  const eventLogsListFinished = ref(false);

  // 滚动加载 - 全部操作日志
  const globalLogsDisplayCount = ref(PAGE_SIZE);
  const globalLogsListLoading = ref(false);
  const globalLogsListFinished = ref(false);

  const relations: RelationType[] = ['亲戚', '朋友', '同学', '同事', '合作伙伴', '长辈', '其他'];
  const paymentMethods = Object.entries(PAYMENT_METHOD_MAP) as [
    PaymentMethod,
    (typeof PAYMENT_METHOD_MAP)[PaymentMethod],
  ][];
  const eventTypes = Object.entries(EVENT_TYPE_MAP) as [
    EventType,
    (typeof EVENT_TYPE_MAP)[EventType],
  ][];

  const recordForm = reactive<RecordForm>({
    contactName: '',
    contactRelation: '朋友',
    amount: '',
    paymentMethod: 'cash',
    customPaymentMethod: '',
    remark: '',
  });
  const eventForm = reactive<EventForm>({
    title: '',
    date: '',
    type: 'wedding',
    notes: '',
  });

  const currentEvent = computed(
    () => gift.events.find((event) => event.id === currentEventId.value) || null
  );

  const currentEventRecords = computed(() => {
    if (!currentEvent.value) return [];
    return gift.records
      .filter((record) => record.eventId === currentEvent.value?.id)
      .sort((a, b) => {
        const aTime = new Date((a.createdAt || a.eventDate).replace(' ', 'T')).getTime();
        const bTime = new Date((b.createdAt || b.eventDate).replace(' ', 'T')).getTime();
        return bTime - aTime;
      });
  });

  // 当前显示的宾客列表（前端虚拟分页）
  const displayedRecords = computed(() =>
    currentEventRecords.value.slice(0, recordsDisplayCount.value)
  );

  // 当前显示的事件日志（前端虚拟分页）
  const displayedEventLogs = computed(() => eventLogs.value.slice(0, eventLogsDisplayCount.value));

  // 当前显示的全部日志（前端虚拟分页）
  const displayedGlobalLogs = computed(() =>
    globalLogs.value.slice(0, globalLogsDisplayCount.value)
  );

  const filteredEvents = computed(() => {
    let list = activeTab.value === 'hosted' ? gift.myHostedEvents : gift.attendedEvents;
    const keyword = searchKeyword.value.trim().toLowerCase();
    if (!keyword) return list;
    return list.filter(
      (event) =>
        event.title.toLowerCase().includes(keyword) ||
        EVENT_TYPE_MAP[event.type]?.label.includes(keyword) ||
        event.targetContactName?.toLowerCase().includes(keyword)
    );
  });

  const totalTabAmount = computed(() =>
    filteredEvents.value.reduce((sum, event) => sum + Number(event.totalAmount || 0), 0)
  );

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push('/home');
  };

  const getEventIcon = (type: EventType) => EVENT_TYPE_MAP[type]?.icon || 'notes-o';

  const loadEventLogs = async () => {
    const eventId = currentEventId.value;
    if (!eventId) return;
    logsLoading.value = true;
    try {
      const response = await eventsApi.getLogs(eventId);
      if (currentEventId.value === eventId) {
        eventLogs.value = response.data.data.map(mapOperationLog);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : '操作日志加载失败');
    } finally {
      logsLoading.value = false;
    }
  };

  const openGlobalLogs = async () => {
    showGlobalLogs.value = true;
    globalLogsLoading.value = true;
    // 重置全部日志滚动状态
    globalLogsDisplayCount.value = PAGE_SIZE;
    globalLogsListLoading.value = false;
    globalLogsListFinished.value = false;
    try {
      const response = await eventsApi.getAllLogs();
      globalLogs.value = response.data.data.map(mapOperationLog);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '操作日志加载失败');
    } finally {
      globalLogsLoading.value = false;
    }
  };

  const openEventDetail = (event: EventItem) => {
    currentEventId.value = event.id;
    detailTab.value = 'records';
    eventLogs.value = [];
    // 重置宾客名单滚动状态
    recordsDisplayCount.value = PAGE_SIZE;
    recordsListLoading.value = false;
    recordsListFinished.value = false;
    // 重置事件日志滚动状态
    eventLogsDisplayCount.value = PAGE_SIZE;
    eventLogsListLoading.value = false;
    eventLogsListFinished.value = false;
    showEventDetailPopup.value = true;
    void loadEventLogs();
  };

  const onRecordsLoad = () => {
    recordsDisplayCount.value += PAGE_SIZE;
    recordsListLoading.value = false;
    if (recordsDisplayCount.value >= currentEventRecords.value.length) {
      recordsListFinished.value = true;
    }
  };

  const onEventLogsLoad = () => {
    eventLogsDisplayCount.value += PAGE_SIZE;
    eventLogsListLoading.value = false;
    if (eventLogsDisplayCount.value >= eventLogs.value.length) {
      eventLogsListFinished.value = true;
    }
  };

  const onGlobalLogsLoad = () => {
    globalLogsDisplayCount.value += PAGE_SIZE;
    globalLogsListLoading.value = false;
    if (globalLogsDisplayCount.value >= globalLogs.value.length) {
      globalLogsListFinished.value = true;
    }
  };

  const resetRecordForm = () => {
    Object.assign(recordForm, {
      contactName: '',
      contactRelation: '朋友',
      amount: '',
      paymentMethod: 'cash',
      customPaymentMethod: '',
      remark: '',
    } satisfies RecordForm);
  };

  const openAddRecord = () => {
    editingRecord.value = null;
    resetRecordForm();
    showRecordEditor.value = true;
  };

  const openEditRecord = (record: GiftRecord) => {
    editingRecord.value = record;
    Object.assign(recordForm, {
      contactName: record.contactName,
      contactRelation: (record.contactRelation || '朋友') as RelationType,
      amount: String(record.amount),
      paymentMethod: record.paymentMethod || 'cash',
      customPaymentMethod: record.customPaymentMethod || '',
      remark: record.remark || '',
    } satisfies RecordForm);
    showRecordEditor.value = true;
  };

  const saveRecord = async () => {
    const event = currentEvent.value;
    const contactName = recordForm.contactName.trim();
    const amount = Number(recordForm.amount);
    const customPaymentMethod = recordForm.customPaymentMethod.trim();
    if (!event || !contactName) {
      showToast('请填写宾客姓名');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('请输入有效的礼金金额');
      return;
    }
    if (recordForm.paymentMethod === 'custom' && !customPaymentMethod) {
      showToast('请填写自定义支付方式');
      return;
    }

    const payload = {
      contactName,
      contactRelation: recordForm.contactRelation,
      amount,
      paymentMethod: recordForm.paymentMethod,
      customPaymentMethod: recordForm.paymentMethod === 'custom' ? customPaymentMethod : undefined,
      remark: recordForm.remark.trim() || undefined,
    };

    savingRecord.value = true;
    try {
      if (editingRecord.value) {
        await gift.updateGiftRecord(editingRecord.value.id, payload);
        showToast({ type: 'success', message: '礼金记录已更新' });
      } else {
        await gift.addRecordToEvent(event, payload);
        showToast({
          type: 'success',
          message: event.isHostedByMe ? '宾客礼金已添加' : '送礼记录已补记',
        });
      }
      showRecordEditor.value = false;
      await loadEventLogs();
    } catch (error) {
      showToast(error instanceof Error ? error.message : '保存失败，请稍后重试');
    } finally {
      savingRecord.value = false;
    }
  };

  const deleteEditingRecord = async () => {
    const record = editingRecord.value;
    if (!record) return;
    try {
      await showConfirmDialog({
        title: '删除这笔礼金？',
        message: `将删除“${record.contactName}”的 ¥${Number(record.amount).toLocaleString()} 记录，操作会写入日志。`,
        confirmButtonText: '确认删除',
        confirmButtonColor: '#c3423f',
      });
      savingRecord.value = true;
      await gift.deleteRecord(record.id);
      showRecordEditor.value = false;
      showToast({ type: 'success', message: '记录已删除' });
      await loadEventLogs();
    } catch (error) {
      if (error !== 'cancel' && error !== 'close') {
        showToast(error instanceof Error ? error.message : '删除失败，请稍后重试');
      }
    } finally {
      savingRecord.value = false;
    }
  };

  const openEventEditor = () => {
    const event = currentEvent.value;
    if (!event) return;
    Object.assign(eventForm, {
      title: event.title,
      date: event.date,
      type: event.type,
      notes: event.notes || '',
    } satisfies EventForm);
    showEventEditor.value = true;
  };

  const saveEventInfo = async () => {
    const event = currentEvent.value;
    const title = eventForm.title.trim();
    if (!event || !title) {
      showToast('请填写事件名称');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventForm.date)) {
      showToast('请选择有效的事件日期');
      return;
    }
    savingEvent.value = true;
    try {
      await gift.updateEventInfo(event.id, {
        title,
        date: eventForm.date,
        type: eventForm.type,
        notes: eventForm.notes.trim() || undefined,
      });
      showEventEditor.value = false;
      showToast({ type: 'success', message: '事件资料已更新' });
      await loadEventLogs();
    } catch (error) {
      showToast(error instanceof Error ? error.message : '事件修改失败');
    } finally {
      savingEvent.value = false;
    }
  };

  const deleteCurrentEvent = async () => {
    const event = currentEvent.value;
    if (!event) return;
    try {
      await showConfirmDialog({
        title: '删除整个事件？',
        message: `“${event.title}”及其 ${currentEventRecords.value.length} 笔礼金明细将一并删除，此操作无法撤销。`,
        confirmButtonText: '确认删除事件',
        confirmButtonColor: '#c3423f',
      });
      savingEvent.value = true;
      await gift.deleteEvent(event.id);
      showEventEditor.value = false;
      showEventDetailPopup.value = false;
      currentEventId.value = '';
      eventLogs.value = [];
      showToast({ type: 'success', message: '事件已删除' });
    } catch (error) {
      if (error !== 'cancel' && error !== 'close') {
        showToast(error instanceof Error ? error.message : '事件删除失败');
      }
    } finally {
      savingEvent.value = false;
    }
  };

  const formatLogTime = (value: string) => {
    const date = new Date(value.replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  };

  const logMeta: Record<OperationAction, { icon: string; tone: string; label: string }> = {
    event_created: { icon: 'flag-o', tone: 'gold', label: '创建事件' },
    event_updated: { icon: 'edit', tone: 'blue', label: '修改事件' },
    event_deleted: { icon: 'delete-o', tone: 'red', label: '删除事件' },
    record_created: { icon: 'plus', tone: 'green', label: '新增礼金' },
    record_updated: { icon: 'edit', tone: 'blue', label: '修改礼金' },
    record_deleted: { icon: 'delete-o', tone: 'red', label: '删除礼金' },
    contact_created: { icon: 'contact-o', tone: 'green', label: '新增联系人' },
    contact_updated: { icon: 'edit', tone: 'blue', label: '修改联系人' },
    contact_deleted: { icon: 'delete-o', tone: 'red', label: '删除联系人' },
  };

  const goToCreateRecord = () => {
    router.push({
      path: '/record',
      query: { tab: activeTab.value === 'hosted' ? 'received' : 'given' },
    });
  };
</script>

<template>
  <main class="events-page">
    <header class="events-header">
      <button class="icon-button" type="button" aria-label="返回" @click="goBack">
        <van-icon name="arrow-left" />
      </button>
      <div class="header-copy">
        <span>人情台账</span>
        <h1>我的事件</h1>
      </div>
      <div class="header-actions">
        <button
          class="icon-button"
          type="button"
          aria-label="查看全部操作日志"
          @click="openGlobalLogs"
        >
          <van-icon name="clock-o" />
        </button>
        <button
          class="icon-button"
          type="button"
          :aria-label="showSearchBar ? '关闭搜索' : '搜索事件'"
          @click="showSearchBar = !showSearchBar"
        >
          <van-icon :name="showSearchBar ? 'cross' : 'search'" />
        </button>
      </div>
    </header>

    <div v-if="showSearchBar" class="search-panel">
      <van-search
        v-model="searchKeyword"
        placeholder="搜索事件、类型或联系人"
        shape="round"
        clearable
        autofocus
      />
    </div>

    <section class="ledger-overview">
      <div>
        <span class="overview-label">
          {{ activeTab === 'hosted' ? '累计收礼' : '累计送礼' }}
        </span>
        <strong>¥{{ totalTabAmount.toLocaleString() }}</strong>
      </div>
      <div class="overview-count">
        <strong>{{ filteredEvents.length }}</strong>
        <span>个事件</span>
      </div>
    </section>

    <div class="events-tabs" role="tablist" aria-label="事件类型">
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'hosted'"
        :class="{ active: activeTab === 'hosted' }"
        @click="activeTab = 'hosted'"
      >
        <van-icon name="wap-home-o" />
        我办的
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'attended'"
        :class="{ active: activeTab === 'attended' }"
        @click="activeTab = 'attended'"
      >
        <van-icon name="friends-o" />
        我参加的
      </button>
    </div>

    <section class="events-list" aria-live="polite">
      <button
        v-for="event in filteredEvents"
        :key="event.id"
        type="button"
        class="event-card"
        @click="openEventDetail(event)"
      >
        <span
          class="event-icon"
          :style="{
            color: EVENT_TYPE_MAP[event.type]?.color,
            background: EVENT_TYPE_MAP[event.type]?.bg,
          }"
        >
          <van-icon :name="getEventIcon(event.type)" />
        </span>
        <span class="event-content">
          <span class="event-title-row">
            <strong>{{ event.title }}</strong>
            <span class="event-arrow"><van-icon name="arrow" /></span>
          </span>
          <span class="event-meta">
            {{ event.date }}
            <i />
            {{ EVENT_TYPE_MAP[event.type]?.label || '其他' }}
            <template v-if="event.targetContactName">
              <i />
              {{ event.targetContactName }}
            </template>
          </span>
          <span class="event-footer">
            <span :class="event.isHostedByMe ? 'income' : 'expense'">
              {{ event.isHostedByMe ? '已收' : '已送' }}
              ¥{{ event.totalAmount.toLocaleString() }}
            </span>
            <span v-if="event.isHostedByMe">{{ event.guestCount || 0 }} 位宾客</span>
            <span v-else>查看详情</span>
          </span>
        </span>
      </button>

      <div v-if="filteredEvents.length === 0" class="empty-box">
        <div class="empty-illustration"><van-icon name="notes-o" /></div>
        <strong>{{ searchKeyword ? '没有找到相关事件' : '还没有事件记录' }}</strong>
        <p>{{ searchKeyword ? '换个关键词试试' : '每一笔人情，都值得被认真记下' }}</p>
        <button v-if="!searchKeyword" type="button" @click="goToCreateRecord">创建第一笔</button>
      </div>
    </section>

    <van-popup
      v-model:show="showGlobalLogs"
      position="bottom"
      round
      class="global-logs-popup"
      :style="{ height: '84%' }"
    >
      <section class="global-log-page">
        <header class="global-log-header">
          <button type="button" aria-label="关闭全部操作日志" @click="showGlobalLogs = false">
            <van-icon name="cross" />
          </button>
          <div>
            <span>数据变更可追溯</span>
            <strong>全部操作日志</strong>
          </div>
          <button type="button" aria-label="刷新操作日志" @click="openGlobalLogs">
            <van-icon name="replay" />
          </button>
        </header>

        <div class="global-log-scroll">
          <div class="global-log-intro">
            <van-icon name="shield-o" />
            <div>
              <strong>保留最近 100 条操作</strong>
              <span>事件删除后，其删除记录仍会保留在这里。</span>
            </div>
          </div>
          <div v-if="globalLogsLoading" class="logs-loading">
            <van-loading size="22" />
            正在加载日志…
          </div>
          <div v-else-if="globalLogs.length" class="timeline global-timeline">
            <van-list
              v-model:loading="globalLogsListLoading"
              :finished="globalLogsListFinished"
              finished-text="已显示全部日志"
              scroll-container=".global-log-scroll"
              @load="onGlobalLogsLoad"
            >
              <article v-for="log in displayedGlobalLogs" :key="log.id" class="timeline-item">
                <span class="timeline-line" />
                <span class="timeline-icon" :class="logMeta[log.action].tone">
                  <van-icon :name="logMeta[log.action].icon" />
                </span>
                <div class="timeline-content">
                  <div>
                    <strong>{{ logMeta[log.action].label }}</strong>
                    <time>{{ formatLogTime(log.createdAt) }}</time>
                  </div>
                  <p>{{ log.summary }}</p>
                  <span>由你操作</span>
                </div>
              </article>
            </van-list>
          </div>
          <div v-else class="panel-empty compact">
            <van-icon name="clock-o" />
            <strong>暂无操作日志</strong>
            <span>业务数据的新增、修改和删除会显示在这里。</span>
          </div>
        </div>
      </section>
    </van-popup>

    <van-popup
      v-model:show="showEventDetailPopup"
      position="bottom"
      round
      class="event-detail-popup"
      :style="{ height: '92%' }"
      @closed="showRecordEditor = false"
    >
      <div v-if="currentEvent" class="detail-page">
        <header class="detail-header">
          <button
            class="detail-close"
            type="button"
            aria-label="关闭"
            @click="showEventDetailPopup = false"
          >
            <van-icon name="cross" />
          </button>
          <div class="detail-heading">
            <span>事件礼金台账</span>
            <strong>{{ currentEvent.title }}</strong>
          </div>
          <div class="detail-header-actions">
            <button type="button" aria-label="编辑事件" @click="openEventEditor">
              <van-icon name="edit" />
            </button>
            <button class="header-add" type="button" @click="openAddRecord">
              <van-icon name="plus" />
              {{ currentEvent.isHostedByMe ? '加宾客' : '补一笔' }}
            </button>
          </div>
        </header>

        <div class="detail-scroll">
          <section class="event-hero" :class="currentEvent.isHostedByMe ? 'hosted' : 'attended'">
            <div class="hero-topline">
              <span>
                <van-icon :name="getEventIcon(currentEvent.type)" />
                {{ EVENT_TYPE_MAP[currentEvent.type]?.label }}
              </span>
              <span>{{ currentEvent.date }}</span>
            </div>
            <div class="hero-amount">
              <span>{{ currentEvent.isHostedByMe ? '礼金收入' : '礼金支出' }}</span>
              <strong>¥{{ currentEvent.totalAmount.toLocaleString() }}</strong>
            </div>
            <div class="hero-stats">
              <div>
                <strong>{{ currentEventRecords.length }}</strong>
                <span>{{ currentEvent.isHostedByMe ? '宾客人数' : '礼金笔数' }}</span>
              </div>
              <div>
                <strong>
                  ¥{{
                    currentEventRecords.length
                      ? Math.round(
                          currentEvent.totalAmount / currentEventRecords.length
                        ).toLocaleString()
                      : 0
                  }}
                </strong>
                <span>平均金额</span>
              </div>
              <div>
                <strong>{{ eventLogs.length }}</strong>
                <span>操作记录</span>
              </div>
            </div>
          </section>

          <p v-if="currentEvent.notes" class="event-note">
            <van-icon name="description-o" />
            {{ currentEvent.notes }}
          </p>

          <div class="detail-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              :aria-selected="detailTab === 'records'"
              :class="{ active: detailTab === 'records' }"
              @click="detailTab = 'records'"
            >
              礼金明细
              <span>{{ currentEventRecords.length }}</span>
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="detailTab === 'logs'"
              :class="{ active: detailTab === 'logs' }"
              @click="detailTab = 'logs'"
            >
              操作日志
              <span>{{ eventLogs.length }}</span>
            </button>
          </div>

          <section v-if="detailTab === 'records'" class="records-panel">
            <div class="section-heading">
              <div>
                <strong>{{ currentEvent.isHostedByMe ? '宾客名单' : '送礼明细' }}</strong>
                <span>点击记录可继续修改</span>
              </div>
              <button type="button" @click="openAddRecord">
                <van-icon name="plus" />
                {{ currentEvent.isHostedByMe ? '继续添加' : '补记' }}
              </button>
            </div>

            <van-list
              v-model:loading="recordsListLoading"
              :finished="recordsListFinished"
              finished-text="已显示全部宾客"
              scroll-container=".detail-scroll"
              @load="onRecordsLoad"
            >
              <button
                v-for="record in displayedRecords"
                :key="record.id"
                type="button"
                class="record-card"
                @click="openEditRecord(record)"
              >
                <span class="record-avatar">{{ record.contactName.slice(0, 1) }}</span>
                <span class="record-info">
                  <span class="record-name-line">
                    <strong>{{ record.contactName }}</strong>
                    <span>{{ record.contactRelation || '朋友' }}</span>
                  </span>
                  <span class="record-meta">
                    {{ getPaymentMethodLabel(record) }}
                    <template v-if="record.remark">· {{ record.remark }}</template>
                  </span>
                </span>
                <span class="record-amount" :class="record.type">
                  <strong>
                    {{ record.type === 'received' ? '+' : '-' }}¥{{
                      Number(record.amount).toLocaleString()
                    }}
                  </strong>
                  <span>
                    编辑
                    <van-icon name="arrow" />
                  </span>
                </span>
              </button>
            </van-list>

            <div v-if="currentEventRecords.length === 0" class="panel-empty">
              <van-icon name="friends-o" />
              <strong>名单还是空的</strong>
              <span>添加第一位宾客的礼金记录</span>
              <button type="button" @click="openAddRecord">立即添加</button>
            </div>
          </section>

          <section v-else class="logs-panel">
            <div class="section-heading">
              <div>
                <strong>操作时间线</strong>
                <span>新增、修改和删除都会留痕</span>
              </div>
            </div>

            <div v-if="logsLoading" class="logs-loading">
              <van-loading size="22" />
              正在加载日志…
            </div>
            <div v-else-if="eventLogs.length" class="timeline">
              <van-list
                v-model:loading="eventLogsListLoading"
                :finished="eventLogsListFinished"
                finished-text="已显示全部日志"
                scroll-container=".detail-scroll"
                @load="onEventLogsLoad"
              >
                <article v-for="log in displayedEventLogs" :key="log.id" class="timeline-item">
                  <span class="timeline-line" />
                  <span class="timeline-icon" :class="logMeta[log.action].tone">
                    <van-icon :name="logMeta[log.action].icon" />
                  </span>
                  <div class="timeline-content">
                    <div>
                      <strong>{{ logMeta[log.action].label }}</strong>
                      <time>{{ formatLogTime(log.createdAt) }}</time>
                    </div>
                    <p>{{ log.summary }}</p>
                    <span>由你操作</span>
                  </div>
                </article>
              </van-list>
            </div>
            <div v-else class="panel-empty compact">
              <van-icon name="clock-o" />
              <strong>暂无操作日志</strong>
              <span>下一次修改会从这里开始记录</span>
            </div>
          </section>
        </div>
      </div>
    </van-popup>

    <van-popup
      v-model:show="showRecordEditor"
      position="bottom"
      round
      class="record-editor-popup"
      :close-on-click-overlay="!savingRecord"
    >
      <section class="editor-sheet">
        <header>
          <button type="button" :disabled="savingRecord" @click="showRecordEditor = false">
            取消
          </button>
          <div>
            <span>{{ editingRecord ? '修改后会自动留下日志' : '保存后可继续添加' }}</span>
            <strong>{{ editingRecord ? '编辑礼金记录' : '添加礼金记录' }}</strong>
          </div>
          <button type="button" :disabled="savingRecord" class="save-link" @click="saveRecord">
            保存
          </button>
        </header>

        <div class="editor-body">
          <div class="form-card">
            <van-field
              v-model="recordForm.contactName"
              label="姓名"
              maxlength="30"
              placeholder="宾客或联系人姓名"
              clearable
            />
            <van-field
              v-model="recordForm.amount"
              label="礼金"
              type="number"
              inputmode="decimal"
              placeholder="0.00"
            >
              <template #left-icon>¥</template>
            </van-field>
            <van-field
              v-model="recordForm.remark"
              label="备注"
              maxlength="200"
              placeholder="席位、随礼说明等（选填）"
              clearable
            />
          </div>

          <div class="form-section">
            <div class="form-label">关系</div>
            <div class="choice-grid relation-grid">
              <button
                v-for="relation in relations"
                :key="relation"
                type="button"
                :class="{ active: recordForm.contactRelation === relation }"
                @click="recordForm.contactRelation = relation"
              >
                {{ relation }}
              </button>
            </div>
          </div>

          <div class="form-section">
            <div class="form-label">支付方式</div>
            <div class="choice-grid payment-grid">
              <button
                v-for="[value, option] in paymentMethods"
                :key="value"
                type="button"
                :class="{ active: recordForm.paymentMethod === value }"
                @click="recordForm.paymentMethod = value"
              >
                <van-icon :name="option.icon" />
                <span>{{ option.label }}</span>
              </button>
            </div>
            <van-field
              v-if="recordForm.paymentMethod === 'custom'"
              v-model="recordForm.customPaymentMethod"
              class="custom-payment-field"
              maxlength="20"
              placeholder="填写银行卡、云闪付等方式"
              clearable
            />
          </div>

          <div class="audit-tip">
            <van-icon name="shield-o" />
            <div>
              <strong>操作自动留痕</strong>
              <span>保存、修改或删除都会记录时间和变更内容。</span>
            </div>
          </div>

          <button class="primary-save" type="button" :disabled="savingRecord" @click="saveRecord">
            <van-loading v-if="savingRecord" size="18" color="#fff" />
            <template v-else>{{ editingRecord ? '保存修改' : '添加到当前事件' }}</template>
          </button>
          <button
            v-if="editingRecord"
            class="delete-record"
            type="button"
            :disabled="savingRecord"
            @click="deleteEditingRecord"
          >
            删除这笔记录
          </button>
        </div>
      </section>
    </van-popup>

    <van-popup
      v-model:show="showEventEditor"
      position="bottom"
      round
      class="event-editor-popup"
      :close-on-click-overlay="!savingEvent"
    >
      <section class="editor-sheet">
        <header>
          <button type="button" :disabled="savingEvent" @click="showEventEditor = false">
            取消
          </button>
          <div>
            <span>修改会同步全部礼金明细</span>
            <strong>编辑事件资料</strong>
          </div>
          <button type="button" :disabled="savingEvent" class="save-link" @click="saveEventInfo">
            保存
          </button>
        </header>

        <div class="editor-body">
          <div class="form-card event-form-card">
            <van-field
              v-model="eventForm.title"
              label="名称"
              maxlength="60"
              placeholder="请输入事件名称"
              clearable
            />
            <van-field
              v-model="eventForm.date"
              label="日期"
              type="date"
              placeholder="选择事件日期"
            />
            <van-field
              v-model="eventForm.notes"
              label="备注"
              type="textarea"
              rows="2"
              maxlength="500"
              autosize
              show-word-limit
              placeholder="地点、席位或其他说明（选填）"
            />
          </div>

          <div class="form-section">
            <div class="form-label">事件类型</div>
            <div class="choice-grid event-type-grid">
              <button
                v-for="[value, option] in eventTypes"
                :key="value"
                type="button"
                :class="{ active: eventForm.type === value }"
                @click="eventForm.type = value"
              >
                <van-icon :name="option.icon" />
                <span>{{ option.label }}</span>
              </button>
            </div>
          </div>

          <div class="audit-tip">
            <van-icon name="records-o" />
            <div>
              <strong>自动同步与留痕</strong>
              <span>名称、日期和类型会同步到所有关联明细，并写入操作日志。</span>
            </div>
          </div>

          <button class="primary-save" type="button" :disabled="savingEvent" @click="saveEventInfo">
            <van-loading v-if="savingEvent" size="18" color="#fff" />
            <template v-else>保存事件资料</template>
          </button>
          <button
            class="delete-record"
            type="button"
            :disabled="savingEvent"
            @click="deleteCurrentEvent"
          >
            删除整个事件
          </button>
        </div>
      </section>
    </van-popup>
  </main>
</template>

<style lang="scss" scoped>
  .events-page {
    min-height: 100%;
    padding: 12px 16px 26px;
    background:
      radial-gradient(
        circle at 100% 0,
        color-mix(in srgb, var(--app-primary-light) 72%, transparent),
        transparent 32%
      ),
      var(--color-background-2);
    color: var(--app-text-primary);
  }

  button {
    font: inherit;
  }

  .events-header {
    display: grid;
    grid-template-columns: 42px 1fr 86px;
    align-items: center;
    margin-bottom: 14px;

    .header-copy {
      text-align: center;

      span {
        display: block;
        color: var(--app-text-muted);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.16em;
      }

      h1 {
        margin: 2px 0 0;
        font-size: 19px;
        line-height: 1.2;
      }
    }
  }

  .header-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
  }

  .icon-button {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    padding: 0;
    border: 1px solid var(--app-border);
    border-radius: 13px;
    background: color-mix(in srgb, var(--app-card-bg) 90%, transparent);
    color: var(--app-text-primary);
    font-size: 18px;

    &:last-child {
      justify-self: end;
    }
  }

  .search-panel {
    margin: -2px 0 12px;

    :deep(.van-search) {
      padding: 0;
      background: transparent;
    }

    :deep(.van-search__content) {
      border: 1px solid var(--app-border);
      background: var(--app-card-bg);
    }
  }

  .ledger-overview {
    position: relative;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    min-height: 108px;
    margin-bottom: 14px;
    padding: 20px;
    overflow: hidden;
    border-radius: 22px;
    background: linear-gradient(135deg, #8f2929, #c3423f 58%, #d86b55);
    color: #fff;
    box-shadow: 0 16px 30px rgba(139, 43, 40, 0.2);

    &::after {
      position: absolute;
      top: -52px;
      right: -32px;
      width: 150px;
      height: 150px;
      border: 24px solid rgba(255, 255, 255, 0.08);
      border-radius: 50%;
      content: '';
    }

    .overview-label {
      display: block;
      margin-bottom: 5px;
      color: rgba(255, 255, 255, 0.74);
      font-size: 12px;
    }

    strong {
      display: block;
      font-size: 27px;
      line-height: 1;
      letter-spacing: -0.03em;
    }

    .overview-count {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: baseline;
      gap: 5px;
      color: rgba(255, 255, 255, 0.78);

      strong {
        font-size: 20px;
        color: #fff;
      }

      span {
        font-size: 11px;
      }
    }
  }

  .events-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    margin-bottom: 14px;
    padding: 5px;
    border: 1px solid var(--app-border);
    border-radius: 16px;
    background: var(--app-card-bg);

    button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-height: 40px;
      border: 1px solid transparent;
      border-radius: 12px;
      background: transparent;
      color: var(--app-text-secondary);
      font-size: 13px;
      font-weight: 700;

      &.active {
        border-color: color-mix(in srgb, var(--app-primary) 26%, var(--app-border));
        background: var(--app-primary-light);
        color: var(--app-primary);
      }
    }
  }

  .events-list {
    display: grid;
    gap: 10px;
  }

  .event-card {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 14px;
    text-align: left;
    border: 1px solid var(--app-border);
    border-radius: 18px;
    background: color-mix(in srgb, var(--app-card-bg) 94%, transparent);
    box-shadow: 0 5px 16px rgba(70, 40, 30, 0.045);

    &:active {
      transform: scale(0.99);
    }
  }

  .event-icon {
    display: grid;
    flex: 0 0 46px;
    place-items: center;
    width: 46px;
    height: 46px;
    border-radius: 15px;
    font-size: 21px;
  }

  .event-content {
    display: block;
    flex: 1;
    min-width: 0;
  }

  .event-title-row,
  .event-meta,
  .event-footer {
    display: flex;
    align-items: center;
  }

  .event-title-row {
    gap: 8px;

    strong {
      flex: 1;
      overflow: hidden;
      color: var(--app-text-primary);
      font-size: 15px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .event-arrow {
      color: var(--app-text-muted);
      font-size: 13px;
    }
  }

  .event-meta {
    gap: 6px;
    margin-top: 4px;
    color: var(--app-text-muted);
    font-size: 11px;

    i {
      width: 3px;
      height: 3px;
      border-radius: 50%;
      background: var(--app-border-strong);
    }
  }

  .event-footer {
    justify-content: space-between;
    margin-top: 8px;
    color: var(--app-text-secondary);
    font-size: 11px;

    .income {
      color: var(--app-green);
      font-size: 13px;
      font-weight: 800;
    }

    .expense {
      color: var(--app-primary);
      font-size: 13px;
      font-weight: 800;
    }
  }

  .empty-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 50px 20px;
    color: var(--app-text-muted);

    .empty-illustration {
      display: grid;
      place-items: center;
      width: 72px;
      height: 72px;
      margin-bottom: 14px;
      border-radius: 24px;
      background: var(--app-card-bg);
      color: var(--app-primary);
      font-size: 32px;
      box-shadow: 0 10px 25px rgba(70, 40, 30, 0.06);
    }

    strong {
      color: var(--app-text-primary);
      font-size: 15px;
    }

    p {
      margin: 6px 0 16px;
      font-size: 12px;
    }

    button {
      padding: 9px 18px;
      border: 0;
      border-radius: 20px;
      background: var(--app-primary);
      color: #fff;
      font-weight: 700;
    }
  }

  :deep(.event-detail-popup),
  :deep(.record-editor-popup),
  :deep(.event-editor-popup),
  :deep(.global-logs-popup) {
    left: 50%;
    width: min(100%, 560px);
    overflow: hidden;
    transform: translateX(-50%);
    background: var(--app-popup-bg);
  }

  .global-log-page {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .global-log-header {
    display: grid;
    grid-template-columns: 42px 1fr 42px;
    align-items: center;
    min-height: 66px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--app-border);
    background: color-mix(in srgb, var(--app-card-bg) 94%, transparent);

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

      &:last-child {
        justify-self: end;
      }
    }

    div {
      min-width: 0;
      text-align: center;

      span,
      strong {
        display: block;
      }

      span {
        color: var(--app-text-muted);
        font-size: 9px;
        letter-spacing: 0.12em;
      }

      strong {
        margin-top: 2px;
        color: var(--app-text-primary);
        font-size: 16px;
      }
    }
  }

  .global-log-scroll {
    flex: 1;
    padding: 14px 18px calc(24px + env(safe-area-inset-bottom));
    overflow-y: auto;
  }

  .global-log-intro {
    display: flex;
    align-items: center;
    gap: 11px;
    margin-bottom: 18px;
    padding: 13px 14px;
    border: 1px solid var(--app-border);
    border-radius: 16px;
    background: var(--app-card-bg);

    > .van-icon {
      display: grid;
      flex: 0 0 36px;
      place-items: center;
      width: 36px;
      height: 36px;
      border-radius: 12px;
      background: var(--app-green-light);
      color: var(--app-green);
      font-size: 18px;
    }

    strong,
    span {
      display: block;
    }

    strong {
      color: var(--app-text-primary);
      font-size: 12px;
    }

    span {
      margin-top: 3px;
      color: var(--app-text-muted);
      font-size: 10px;
    }
  }

  .global-timeline {
    padding: 0 2px;
  }

  .detail-page {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .detail-header {
    display: grid;
    grid-template-columns: 48px 1fr 118px;
    align-items: center;
    min-height: 68px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--app-border);
    background: color-mix(in srgb, var(--app-card-bg) 94%, transparent);

    .detail-heading {
      min-width: 0;
      text-align: center;

      span,
      strong {
        display: block;
      }

      span {
        color: var(--app-text-muted);
        font-size: 9px;
        letter-spacing: 0.12em;
      }

      strong {
        margin-top: 2px;
        overflow: hidden;
        color: var(--app-text-primary);
        font-size: 15px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }

  .detail-close,
  .header-add,
  .detail-header-actions > button {
    border: 0;
    background: transparent;
  }

  .detail-header-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 5px;

    > button:first-child {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      padding: 0;
      border: 1px solid var(--app-border);
      border-radius: 11px;
      background: var(--app-card-bg);
      color: var(--app-text-secondary);
      font-size: 14px;
    }
  }

  .detail-close {
    justify-self: start;
    width: 34px;
    height: 34px;
    padding: 0;
    color: var(--app-text-secondary);
    font-size: 18px;
  }

  .header-add {
    display: flex;
    align-items: center;
    justify-content: center;
    justify-self: end;
    gap: 3px;
    min-height: 34px;
    padding: 0 10px;
    border-radius: 12px;
    background: var(--app-primary-light);
    color: var(--app-primary);
    font-size: 11px;
    font-weight: 800;
  }

  .detail-scroll {
    flex: 1;
    padding: 14px 16px calc(22px + env(safe-area-inset-bottom));
    overflow-y: auto;
  }

  .event-hero {
    position: relative;
    padding: 18px;
    overflow: hidden;
    border-radius: 22px;
    color: #fff;
    box-shadow: 0 16px 28px rgba(34, 91, 63, 0.16);

    &.hosted {
      background: linear-gradient(135deg, #19593d, #2e9362 64%, #53ad79);
    }

    &.attended {
      background: linear-gradient(135deg, #8f2929, #c3423f 64%, #db6a55);
    }

    &::after {
      position: absolute;
      right: -28px;
      bottom: -62px;
      width: 160px;
      height: 160px;
      border: 26px solid rgba(255, 255, 255, 0.07);
      border-radius: 50%;
      content: '';
    }
  }

  .hero-topline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: rgba(255, 255, 255, 0.78);
    font-size: 11px;

    span:first-child {
      display: flex;
      align-items: center;
      gap: 5px;
    }
  }

  .hero-amount {
    margin: 22px 0 18px;

    span,
    strong {
      display: block;
    }

    span {
      color: rgba(255, 255, 255, 0.72);
      font-size: 11px;
    }

    strong {
      margin-top: 3px;
      font-size: 31px;
      line-height: 1.1;
      letter-spacing: -0.04em;
    }
  }

  .hero-stats {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    padding-top: 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.18);

    div {
      padding-left: 12px;
      border-left: 1px solid rgba(255, 255, 255, 0.16);

      &:first-child {
        padding-left: 0;
        border-left: 0;
      }
    }

    strong,
    span {
      display: block;
    }

    strong {
      font-size: 15px;
    }

    span {
      margin-top: 2px;
      color: rgba(255, 255, 255, 0.68);
      font-size: 9px;
    }
  }

  .event-note {
    display: flex;
    gap: 8px;
    margin: 10px 0 0;
    padding: 11px 12px;
    border: 1px solid var(--app-border);
    border-radius: 13px;
    background: var(--app-card-bg);
    color: var(--app-text-secondary);
    font-size: 11px;
    line-height: 1.55;

    .van-icon {
      margin-top: 2px;
      color: var(--app-gold-text);
    }
  }

  .detail-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    margin: 18px 0 14px;
    border-bottom: 1px solid var(--app-border);

    button {
      position: relative;
      padding: 0 0 11px;
      border: 0;
      background: transparent;
      color: var(--app-text-muted);
      font-size: 13px;
      font-weight: 700;

      span {
        display: inline-grid;
        place-items: center;
        min-width: 19px;
        height: 19px;
        margin-left: 4px;
        padding: 0 5px;
        border-radius: 10px;
        background: var(--app-bg-soft);
        font-size: 9px;
      }

      &.active {
        color: var(--app-text-primary);

        &::after {
          position: absolute;
          bottom: -1px;
          left: 28%;
          width: 44%;
          height: 3px;
          border-radius: 3px 3px 0 0;
          background: var(--app-primary);
          content: '';
        }

        span {
          background: var(--app-primary-light);
          color: var(--app-primary);
        }
      }
    }
  }

  .records-panel,
  .logs-panel {
    padding-bottom: 12px;
  }

  .section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;

    strong,
    span {
      display: block;
    }

    strong {
      color: var(--app-text-primary);
      font-size: 14px;
    }

    span {
      margin-top: 2px;
      color: var(--app-text-muted);
      font-size: 10px;
    }

    > button {
      display: flex;
      align-items: center;
      gap: 3px;
      padding: 7px 11px;
      border: 1px solid color-mix(in srgb, var(--app-primary) 24%, var(--app-border));
      border-radius: 12px;
      background: var(--app-primary-light);
      color: var(--app-primary);
      font-size: 11px;
      font-weight: 800;
    }
  }

  .record-card {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    margin-bottom: 8px;
    padding: 12px;
    text-align: left;
    border: 1px solid var(--app-border);
    border-radius: 16px;
    background: var(--app-card-bg);

    &:active {
      background: var(--app-bg-soft);
    }
  }

  .record-avatar {
    display: grid;
    flex: 0 0 40px;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 14px;
    background: var(--app-primary-light);
    color: var(--app-primary);
    font-size: 15px;
    font-weight: 800;
  }

  .record-info {
    flex: 1;
    min-width: 0;
  }

  .record-name-line {
    display: flex;
    align-items: center;
    gap: 6px;

    strong {
      overflow: hidden;
      color: var(--app-text-primary);
      font-size: 14px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    span {
      flex-shrink: 0;
      padding: 2px 5px;
      border-radius: 6px;
      background: var(--app-bg-soft);
      color: var(--app-text-muted);
      font-size: 9px;
    }
  }

  .record-meta {
    display: block;
    margin-top: 4px;
    overflow: hidden;
    color: var(--app-text-muted);
    font-size: 10px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .record-amount {
    flex-shrink: 0;
    text-align: right;

    strong,
    span {
      display: block;
    }

    strong {
      color: var(--app-green);
      font-size: 13px;
    }

    &.given strong {
      color: var(--app-primary);
    }

    span {
      margin-top: 4px;
      color: var(--app-text-muted);
      font-size: 9px;
    }
  }

  .panel-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 38px 18px;
    border: 1px dashed var(--app-border-strong);
    border-radius: 18px;
    color: var(--app-text-muted);

    > .van-icon {
      margin-bottom: 10px;
      color: var(--app-primary);
      font-size: 30px;
    }

    strong {
      color: var(--app-text-primary);
      font-size: 13px;
    }

    span {
      margin-top: 4px;
      font-size: 10px;
    }

    button {
      margin-top: 14px;
      padding: 8px 16px;
      border: 0;
      border-radius: 16px;
      background: var(--app-primary);
      color: #fff;
      font-size: 11px;
      font-weight: 700;
    }

    &.compact {
      padding: 32px 18px;
    }
  }

  .logs-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    padding: 36px;
    color: var(--app-text-muted);
    font-size: 11px;
  }

  .timeline {
    padding: 2px 0;
  }

  .timeline-item {
    position: relative;
    display: grid;
    grid-template-columns: 34px 1fr;
    gap: 10px;
    min-height: 82px;

    &:last-child {
      min-height: 64px;

      .timeline-line {
        display: none;
      }
    }
  }

  .timeline-line {
    position: absolute;
    top: 32px;
    bottom: -2px;
    left: 16px;
    width: 1px;
    background: var(--app-border);
  }

  .timeline-icon {
    position: relative;
    z-index: 1;
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border: 4px solid var(--color-background-2);
    border-radius: 50%;
    font-size: 12px;

    &.green {
      background: var(--app-green-light);
      color: var(--app-green);
    }

    &.blue {
      background: var(--app-blue-light);
      color: var(--app-blue);
    }

    &.red {
      background: var(--app-primary-light);
      color: var(--app-primary);
    }

    &.gold {
      background: var(--app-gold-bg);
      color: var(--app-gold-text);
    }
  }

  .timeline-content {
    padding: 3px 0 16px;

    > div {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;

      strong {
        color: var(--app-text-primary);
        font-size: 12px;
      }

      time {
        color: var(--app-text-muted);
        font-size: 9px;
      }
    }

    p {
      margin: 5px 0 4px;
      color: var(--app-text-secondary);
      font-size: 11px;
      line-height: 1.45;
    }

    > span {
      color: var(--app-text-muted);
      font-size: 9px;
    }
  }

  .editor-sheet {
    max-height: 88vh;
    overflow-y: auto;
    background: var(--app-popup-bg);

    > header {
      position: sticky;
      top: 0;
      z-index: 3;
      display: grid;
      grid-template-columns: 64px 1fr 64px;
      align-items: center;
      min-height: 68px;
      padding: 8px 16px;
      border-bottom: 1px solid var(--app-border);
      background: color-mix(in srgb, var(--app-card-bg) 96%, transparent);

      button {
        padding: 8px 0;
        border: 0;
        background: transparent;
        color: var(--app-text-secondary);
        font-size: 12px;
      }

      .save-link {
        color: var(--app-primary);
        font-weight: 800;
      }

      div {
        text-align: center;

        span,
        strong {
          display: block;
        }

        span {
          color: var(--app-text-muted);
          font-size: 8px;
          letter-spacing: 0.05em;
        }

        strong {
          margin-top: 2px;
          font-size: 15px;
        }
      }
    }
  }

  .editor-body {
    padding: 14px 16px calc(18px + env(safe-area-inset-bottom));
  }

  .form-card {
    overflow: hidden;
    border: 1px solid var(--app-border);
    border-radius: 16px;
    background: var(--app-card-bg);

    :deep(.van-cell) {
      background: transparent;
    }

    :deep(.van-cell::after) {
      border-color: var(--app-border);
    }

    :deep(.van-field__label) {
      width: 54px;
      color: var(--app-text-secondary);
      font-size: 12px;
      font-weight: 700;
    }

    :deep(.van-field__control) {
      color: var(--app-text-primary);
      font-size: 13px;
      text-align: right;
    }

    :deep(.van-field__left-icon) {
      color: var(--app-text-primary);
      font-weight: 800;
    }
  }

  .form-section {
    margin-top: 18px;
  }

  .form-label {
    margin: 0 0 9px 2px;
    color: var(--app-text-secondary);
    font-size: 11px;
    font-weight: 800;
  }

  .choice-grid {
    display: grid;
    gap: 7px;

    button {
      min-height: 38px;
      padding: 0 7px;
      border: 1px solid var(--app-border);
      border-radius: 12px;
      background: var(--app-card-bg);
      color: var(--app-text-secondary);
      font-size: 11px;

      &.active {
        border-color: color-mix(in srgb, var(--app-primary) 42%, var(--app-border));
        background: var(--app-primary-light);
        color: var(--app-primary);
        font-weight: 800;
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--app-primary) 9%, transparent);
      }
    }
  }

  .relation-grid {
    grid-template-columns: repeat(4, 1fr);

    button:last-child {
      grid-column: span 2;
    }
  }

  .payment-grid {
    grid-template-columns: repeat(4, 1fr);

    button {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      min-height: 54px;

      .van-icon {
        font-size: 17px;
      }
    }
  }

  .event-type-grid {
    grid-template-columns: repeat(4, 1fr);

    button {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      min-height: 58px;

      .van-icon {
        font-size: 18px;
      }
    }
  }

  .event-form-card :deep(.van-field__control[type='date']) {
    min-height: 24px;
  }

  .custom-payment-field {
    margin-top: 8px;
    overflow: hidden;
    border: 1px solid var(--app-border);
    border-radius: 12px;
    background: var(--app-card-bg);
  }

  .audit-tip {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    margin-top: 18px;
    padding: 12px;
    border: 1px solid color-mix(in srgb, var(--app-blue) 18%, var(--app-border));
    border-radius: 14px;
    background: var(--app-blue-light);
    color: var(--app-blue);

    > .van-icon {
      margin-top: 1px;
      font-size: 17px;
    }

    strong,
    span {
      display: block;
    }

    strong {
      font-size: 11px;
    }

    span {
      margin-top: 2px;
      color: color-mix(in srgb, var(--app-blue) 64%, var(--app-text-secondary));
      font-size: 9px;
      line-height: 1.4;
    }
  }

  .primary-save,
  .delete-record {
    width: 100%;
    min-height: 46px;
    margin-top: 18px;
    border-radius: 15px;
    font-size: 13px;
    font-weight: 800;
  }

  .primary-save {
    display: grid;
    place-items: center;
    border: 0;
    background: linear-gradient(135deg, #a93533, var(--app-primary));
    color: #fff;
    box-shadow: 0 10px 20px rgba(195, 66, 63, 0.2);

    &:disabled {
      opacity: 0.62;
    }
  }

  .delete-record {
    margin-top: 9px;
    border: 1px solid color-mix(in srgb, var(--app-primary) 22%, var(--app-border));
    background: transparent;
    color: var(--app-primary);
  }

  @media (max-width: 360px) {
    .relation-grid {
      grid-template-columns: repeat(3, 1fr);

      button:last-child {
        grid-column: auto;
      }
    }

    .payment-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .event-type-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }
</style>
