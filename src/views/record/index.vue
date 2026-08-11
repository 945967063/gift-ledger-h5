<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { showToast } from 'vant';
  import useStore from '@/store';
  import {
    EVENT_TYPE_MAP,
    PAYMENT_METHOD_MAP,
    getPaymentMethodLabel,
  } from '@/store/modules/giftStore';
  import type { EventType, PaymentMethod, RelationType } from '@/types/gift';

  interface GuestDraft {
    name: string;
    amount: number;
    relation: RelationType;
    paymentMethod: PaymentMethod;
    customPaymentMethod?: string;
  }

  const route = useRoute();
  const router = useRouter();
  const { gift } = useStore();

  const padNumber = (value: number) => String(value).padStart(2, '0');
  const now = new Date();
  const today = `${now.getFullYear()}-${padNumber(now.getMonth() + 1)}-${padNumber(now.getDate())}`;
  const createDateArray = () => today.split('-');

  const currentTab = ref<'received' | 'given'>('received');
  const saving = ref(false);
  const quickAmounts = [200, 500, 600, 800, 1000, 2000];
  const relationOptions: RelationType[] = [
    '亲戚',
    '朋友',
    '同学',
    '同事',
    '合作伙伴',
    '长辈',
    '其他',
  ];
  const paymentMethods = (Object.keys(PAYMENT_METHOD_MAP) as PaymentMethod[]).map((value) => ({
    value,
    ...PAYMENT_METHOD_MAP[value],
  }));
  const typeColumns = Object.entries(EVENT_TYPE_MAP).map(([key, value]) => ({
    text: value.label,
    value: key,
  }));

  const receivedForm = ref<{
    title: string;
    date: string;
    type: EventType;
    guests: GuestDraft[];
  }>({
    title: '',
    date: today,
    type: 'wedding',
    guests: [],
  });
  const givenForm = ref({
    contactName: '',
    eventTitle: '',
    date: today,
    type: 'wedding' as EventType,
    amount: '' as number | string,
    paymentMethod: 'cash' as PaymentMethod,
    customPaymentMethod: '',
    remark: '',
  });
  const newGuest = ref<{
    name: string;
    amount: number | string;
    relation: RelationType;
    paymentMethod: PaymentMethod;
    customPaymentMethod: string;
  }>({
    name: '',
    amount: '',
    relation: '朋友',
    paymentMethod: 'cash',
    customPaymentMethod: '',
  });

  const showReceivedDatePicker = ref(false);
  const showGivenDatePicker = ref(false);
  const showReceivedTypePicker = ref(false);
  const showGivenTypePicker = ref(false);
  const showAddGuestPopup = ref(false);
  const receivedDateArray = ref(createDateArray());
  const givenDateArray = ref(createDateArray());

  const receivedTotalAmount = computed(() =>
    receivedForm.value.guests.reduce((sum, guest) => sum + Number(guest.amount || 0), 0)
  );
  const activePaymentLabel = computed(() =>
    getPaymentMethodLabel({
      paymentMethod: givenForm.value.paymentMethod,
      customPaymentMethod: givenForm.value.customPaymentMethod,
    })
  );

  onMounted(() => {
    currentTab.value = route.query.tab === 'given' ? 'given' : 'received';
    if (route.query.contact) {
      givenForm.value.contactName = String(route.query.contact);
    }
  });

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push('/home');
  };

  const onConfirmReceivedDate = ({ selectedValues }: { selectedValues: string[] }) => {
    receivedForm.value.date = selectedValues.join('-');
    showReceivedDatePicker.value = false;
  };
  const onConfirmGivenDate = ({ selectedValues }: { selectedValues: string[] }) => {
    givenForm.value.date = selectedValues.join('-');
    showGivenDatePicker.value = false;
  };
  const onConfirmReceivedType = ({ selectedOptions }: any) => {
    receivedForm.value.type = selectedOptions[0].value as EventType;
    showReceivedTypePicker.value = false;
  };
  const onConfirmGivenType = ({ selectedOptions }: any) => {
    givenForm.value.type = selectedOptions[0].value as EventType;
    showGivenTypePicker.value = false;
  };

  const openAddGuest = () => {
    newGuest.value = {
      name: '',
      amount: '',
      relation: '朋友',
      paymentMethod: 'cash',
      customPaymentMethod: '',
    };
    showAddGuestPopup.value = true;
  };
  const selectExistingContact = (contactName: string, relation: RelationType) => {
    newGuest.value.name = contactName;
    newGuest.value.relation = relation;
  };
  const selectGuestPaymentMethod = (value: PaymentMethod) => {
    newGuest.value.paymentMethod = value;
    if (value !== 'custom') newGuest.value.customPaymentMethod = '';
  };
  const selectGivenPaymentMethod = (value: PaymentMethod) => {
    givenForm.value.paymentMethod = value;
    if (value !== 'custom') givenForm.value.customPaymentMethod = '';
  };
  const validateCustomPaymentMethod = (method: PaymentMethod, customValue: string) => {
    if (method === 'custom' && !customValue.trim()) {
      showToast('请输入自定义支付方式');
      return false;
    }
    return true;
  };
  const confirmAddGuest = () => {
    if (!newGuest.value.name.trim()) {
      showToast('请输入宾客姓名');
      return;
    }
    if (!newGuest.value.amount || Number(newGuest.value.amount) <= 0) {
      showToast('请输入有效的礼金金额');
      return;
    }
    if (
      !validateCustomPaymentMethod(newGuest.value.paymentMethod, newGuest.value.customPaymentMethod)
    ) {
      return;
    }
    receivedForm.value.guests.push({
      name: newGuest.value.name.trim(),
      amount: Number(newGuest.value.amount),
      relation: newGuest.value.relation,
      paymentMethod: newGuest.value.paymentMethod,
      customPaymentMethod:
        newGuest.value.paymentMethod === 'custom'
          ? newGuest.value.customPaymentMethod.trim()
          : undefined,
    });
    showAddGuestPopup.value = false;
    showToast({ message: '已加入礼金名单', icon: 'passed' });
  };
  const removeGuest = (index: number) => receivedForm.value.guests.splice(index, 1);
  const setGivenAmount = (value: number) => {
    givenForm.value.amount = value;
  };

  const saveReceivedRecord = async () => {
    if (!receivedForm.value.title.trim()) {
      showToast('请输入事件名称');
      return;
    }
    if (!receivedForm.value.guests.length) {
      showToast('请至少添加一位宾客礼金');
      return;
    }
    if (saving.value) return;
    saving.value = true;
    try {
      await gift.addReceivedEventAndGifts({
        title: receivedForm.value.title.trim(),
        date: receivedForm.value.date,
        type: receivedForm.value.type,
        guests: receivedForm.value.guests,
      });
      showToast({ message: '收礼记录已保存', icon: 'success' });
      await router.push('/home');
    } catch {
      // 请求层已统一提示错误，保留当前表单方便用户重试。
    } finally {
      saving.value = false;
    }
  };

  const saveGivenRecord = async () => {
    if (!givenForm.value.contactName.trim()) {
      showToast('请输入对方姓名');
      return;
    }
    if (!givenForm.value.eventTitle.trim()) {
      showToast('请输入事件名称');
      return;
    }
    if (!givenForm.value.amount || Number(givenForm.value.amount) <= 0) {
      showToast('请输入有效的礼金金额');
      return;
    }
    if (
      !validateCustomPaymentMethod(
        givenForm.value.paymentMethod,
        givenForm.value.customPaymentMethod
      )
    ) {
      return;
    }
    if (saving.value) return;
    saving.value = true;
    try {
      await gift.addGivenRecord({
        contactName: givenForm.value.contactName.trim(),
        eventTitle: givenForm.value.eventTitle.trim(),
        date: givenForm.value.date,
        type: givenForm.value.type,
        amount: Number(givenForm.value.amount),
        paymentMethod: givenForm.value.paymentMethod,
        customPaymentMethod: givenForm.value.customPaymentMethod,
        remark: givenForm.value.remark.trim(),
      });
      showToast({ message: '送礼记录已保存', icon: 'success' });
      await router.push('/home');
    } catch {
      // 请求层已统一提示错误，保留当前表单方便用户重试。
    } finally {
      saving.value = false;
    }
  };
</script>

<template>
  <main class="record-page">
    <header class="record-header">
      <button type="button" class="icon-button" aria-label="返回" @click="goBack">
        <van-icon name="arrow-left" />
      </button>
      <div class="header-copy">
        <span class="eyebrow">记一笔</span>
        <h1>{{ currentTab === 'received' ? '新增收礼' : '新增送礼' }}</h1>
      </div>
      <div class="header-mark" aria-hidden="true">礼</div>
    </header>

    <div class="mode-segment" role="tablist" aria-label="收送礼类型">
      <button
        type="button"
        role="tab"
        :aria-selected="currentTab === 'received'"
        :class="['segment-item', { active: currentTab === 'received' }]"
        @click="currentTab = 'received'"
      >
        <span class="segment-symbol">收</span>
        <span>
          <strong>我收到的</strong>
          <small>登记宾客礼金</small>
        </span>
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="currentTab === 'given'"
        :class="['segment-item', { active: currentTab === 'given' }]"
        @click="currentTab = 'given'"
      >
        <span class="segment-symbol">送</span>
        <span>
          <strong>我送出的</strong>
          <small>记录人情支出</small>
        </span>
      </button>
    </div>

    <Transition name="form-switch" mode="out-in">
      <section v-if="currentTab === 'received'" key="received" class="record-form">
        <div class="section-heading">
          <div>
            <span class="section-index">01</span>
            <h2>事件信息</h2>
          </div>
          <p>填写本次宴席的基本信息</p>
        </div>

        <div class="field-stack">
          <label class="field-block">
            <span class="field-label">事件名称</span>
            <span class="field-control">
              <input
                v-model="receivedForm.title"
                type="text"
                maxlength="40"
                placeholder="例如：小明婚礼"
              />
            </span>
          </label>

          <div class="field-grid">
            <button
              type="button"
              class="field-block field-button"
              @click="showReceivedDatePicker = true"
            >
              <span class="field-label">事件日期</span>
              <span class="field-control">
                <span>{{ receivedForm.date }}</span>
                <van-icon name="arrow-down" />
              </span>
            </button>
            <button
              type="button"
              class="field-block field-button"
              @click="showReceivedTypePicker = true"
            >
              <span class="field-label">事件类型</span>
              <span class="field-control">
                <span>{{ EVENT_TYPE_MAP[receivedForm.type].label }}</span>
                <van-icon name="arrow-down" />
              </span>
            </button>
          </div>
        </div>

        <div class="guest-section">
          <div class="section-heading guest-heading">
            <div>
              <span class="section-index">02</span>
              <h2>礼金名单</h2>
            </div>
            <button type="button" class="text-action" @click="openAddGuest">
              <van-icon name="plus" />
              添加宾客
            </button>
          </div>

          <div v-if="receivedForm.guests.length" class="guest-list">
            <article v-for="(guest, index) in receivedForm.guests" :key="`${guest.name}-${index}`">
              <div class="guest-avatar">{{ guest.name.slice(0, 1) }}</div>
              <div class="guest-info">
                <strong>{{ guest.name }}</strong>
                <span>
                  {{ guest.relation }} ·
                  {{
                    getPaymentMethodLabel({
                      paymentMethod: guest.paymentMethod,
                      customPaymentMethod: guest.customPaymentMethod,
                    })
                  }}
                </span>
              </div>
              <div class="guest-amount">¥{{ guest.amount.toLocaleString() }}</div>
              <button
                type="button"
                class="remove-button"
                :aria-label="`移除${guest.name}`"
                @click="removeGuest(index)"
              >
                <van-icon name="cross" />
              </button>
            </article>
          </div>
          <button v-else type="button" class="empty-guest" @click="openAddGuest">
            <span class="empty-icon"><van-icon name="friends-o" /></span>
            <strong>还没有宾客记录</strong>
            <small>添加姓名、礼金金额和收款方式</small>
            <span class="empty-cta">
              <van-icon name="plus" />
              添加第一位宾客
            </span>
          </button>

          <div class="total-strip">
            <span>已登记 {{ receivedForm.guests.length }} 人</span>
            <div>
              <small>本次合计</small>
              <strong>¥{{ receivedTotalAmount.toLocaleString() }}</strong>
            </div>
          </div>
        </div>

        <div class="save-dock">
          <button
            type="button"
            class="primary-save-button"
            :disabled="saving"
            @click="saveReceivedRecord"
          >
            {{ saving ? '正在保存…' : '保存收礼记录' }}
            <van-icon name="arrow" />
          </button>
        </div>
      </section>

      <section v-else key="given" class="record-form">
        <div class="section-heading">
          <div>
            <span class="section-index">01</span>
            <h2>往来信息</h2>
          </div>
          <p>记录送礼对象与对应事件</p>
        </div>

        <div class="field-stack">
          <label class="field-block">
            <span class="field-label">对方姓名</span>
            <span class="field-control">
              <input
                v-model="givenForm.contactName"
                type="text"
                maxlength="20"
                placeholder="请输入对方姓名"
              />
            </span>
          </label>
          <div v-if="gift.contacts.length" class="quick-contacts">
            <span>最近联系人</span>
            <button
              v-for="contact in gift.contacts.slice(0, 5)"
              :key="contact.id"
              type="button"
              :class="{ selected: givenForm.contactName === contact.name }"
              @click="givenForm.contactName = contact.name"
            >
              {{ contact.name }}
            </button>
          </div>

          <label class="field-block">
            <span class="field-label">事件名称</span>
            <span class="field-control">
              <input
                v-model="givenForm.eventTitle"
                type="text"
                maxlength="40"
                placeholder="例如：王大力婚礼"
              />
            </span>
          </label>

          <div class="field-grid">
            <button
              type="button"
              class="field-block field-button"
              @click="showGivenDatePicker = true"
            >
              <span class="field-label">事件日期</span>
              <span class="field-control">
                <span>{{ givenForm.date }}</span>
                <van-icon name="arrow-down" />
              </span>
            </button>
            <button
              type="button"
              class="field-block field-button"
              @click="showGivenTypePicker = true"
            >
              <span class="field-label">事件类型</span>
              <span class="field-control">
                <span>{{ EVENT_TYPE_MAP[givenForm.type].label }}</span>
                <van-icon name="arrow-down" />
              </span>
            </button>
          </div>
        </div>

        <div class="section-heading money-heading">
          <div>
            <span class="section-index">02</span>
            <h2>礼金信息</h2>
          </div>
          <p>选择金额和支付方式</p>
        </div>

        <label class="amount-field">
          <span>礼金金额</span>
          <span class="amount-control">
            <b>¥</b>
            <input v-model="givenForm.amount" inputmode="decimal" type="number" placeholder="0" />
          </span>
        </label>
        <div class="quick-amounts">
          <button
            v-for="amount in quickAmounts"
            :key="amount"
            type="button"
            :class="{ selected: Number(givenForm.amount) === amount }"
            @click="setGivenAmount(amount)"
          >
            ¥{{ amount }}
          </button>
        </div>

        <div class="payment-field">
          <div class="payment-title">
            <div>
              <strong>支付方式</strong>
              <span>默认为现金</span>
            </div>
            <span class="selected-payment">{{ activePaymentLabel }}</span>
          </div>
          <div class="payment-options">
            <button
              v-for="method in paymentMethods"
              :key="method.value"
              type="button"
              :class="{ selected: givenForm.paymentMethod === method.value }"
              @click="selectGivenPaymentMethod(method.value)"
            >
              <span class="payment-icon"><van-icon :name="method.icon" /></span>
              <span>
                <strong>{{ method.label }}</strong>
                <small>{{ method.description }}</small>
              </span>
              <van-icon class="check-icon" name="success" />
            </button>
          </div>
          <Transition name="custom-field">
            <label v-if="givenForm.paymentMethod === 'custom'" class="custom-payment-input">
              <span>自定义名称</span>
              <input
                v-model="givenForm.customPaymentMethod"
                maxlength="12"
                type="text"
                placeholder="例如：银行卡、云闪付"
              />
            </label>
          </Transition>
        </div>

        <label class="field-block remark-field">
          <span class="field-label">
            备注
            <small>选填</small>
          </span>
          <span class="field-control">
            <textarea
              v-model="givenForm.remark"
              rows="3"
              maxlength="100"
              placeholder="补充祝福语或其他信息"
            />
          </span>
        </label>

        <div class="save-dock">
          <button
            type="button"
            class="primary-save-button"
            :disabled="saving"
            @click="saveGivenRecord"
          >
            {{ saving ? '正在保存…' : '保存送礼记录' }}
            <van-icon name="arrow" />
          </button>
        </div>
      </section>
    </Transition>

    <van-popup v-model:show="showReceivedDatePicker" position="bottom" round>
      <van-date-picker
        v-model="receivedDateArray"
        title="选择事件日期"
        @confirm="onConfirmReceivedDate"
        @cancel="showReceivedDatePicker = false"
      />
    </van-popup>
    <van-popup v-model:show="showGivenDatePicker" position="bottom" round>
      <van-date-picker
        v-model="givenDateArray"
        title="选择事件日期"
        @confirm="onConfirmGivenDate"
        @cancel="showGivenDatePicker = false"
      />
    </van-popup>
    <van-popup v-model:show="showReceivedTypePicker" position="bottom" round>
      <van-picker
        :columns="typeColumns"
        title="选择事件类型"
        @confirm="onConfirmReceivedType"
        @cancel="showReceivedTypePicker = false"
      />
    </van-popup>
    <van-popup v-model:show="showGivenTypePicker" position="bottom" round>
      <van-picker
        :columns="typeColumns"
        title="选择事件类型"
        @confirm="onConfirmGivenType"
        @cancel="showGivenTypePicker = false"
      />
    </van-popup>

    <van-popup v-model:show="showAddGuestPopup" position="bottom" round class="add-guest-popup">
      <div class="popup-content">
        <header class="popup-header">
          <div>
            <span>收礼明细</span>
            <h2>添加宾客</h2>
          </div>
          <button type="button" aria-label="关闭" @click="showAddGuestPopup = false">
            <van-icon name="cross" />
          </button>
        </header>

        <div class="popup-scroll">
          <label class="field-block">
            <span class="field-label">宾客姓名</span>
            <span class="field-control">
              <input
                v-model="newGuest.name"
                type="text"
                maxlength="20"
                placeholder="输入姓名或从下方选择"
              />
            </span>
          </label>
          <div class="quick-contacts popup-contact-list">
            <button
              v-for="contact in gift.contacts.slice(0, 6)"
              :key="contact.id"
              type="button"
              :class="{ selected: newGuest.name === contact.name }"
              @click="selectExistingContact(contact.name, contact.relation)"
            >
              {{ contact.name }}
            </button>
          </div>

          <div class="popup-field-group">
            <span class="field-label">关系分类</span>
            <div class="choice-chips">
              <button
                v-for="relation in relationOptions"
                :key="relation"
                type="button"
                :class="{ selected: newGuest.relation === relation }"
                @click="newGuest.relation = relation"
              >
                {{ relation }}
              </button>
            </div>
          </div>

          <label class="amount-field compact">
            <span>礼金金额</span>
            <span class="amount-control">
              <b>¥</b>
              <input v-model="newGuest.amount" inputmode="decimal" type="number" placeholder="0" />
            </span>
          </label>
          <div class="quick-amounts">
            <button
              v-for="amount in quickAmounts"
              :key="amount"
              type="button"
              :class="{ selected: Number(newGuest.amount) === amount }"
              @click="newGuest.amount = amount"
            >
              ¥{{ amount }}
            </button>
          </div>

          <div class="payment-field popup-payment-field">
            <div class="payment-title">
              <div>
                <strong>收款方式</strong>
                <span>默认为现金</span>
              </div>
            </div>
            <div class="payment-options">
              <button
                v-for="method in paymentMethods"
                :key="method.value"
                type="button"
                :class="{ selected: newGuest.paymentMethod === method.value }"
                @click="selectGuestPaymentMethod(method.value)"
              >
                <span class="payment-icon"><van-icon :name="method.icon" /></span>
                <span>
                  <strong>{{ method.label }}</strong>
                  <small>{{ method.description }}</small>
                </span>
                <van-icon class="check-icon" name="success" />
              </button>
            </div>
            <Transition name="custom-field">
              <label v-if="newGuest.paymentMethod === 'custom'" class="custom-payment-input">
                <span>自定义名称</span>
                <input
                  v-model="newGuest.customPaymentMethod"
                  maxlength="12"
                  type="text"
                  placeholder="例如：银行卡、云闪付"
                />
              </label>
            </Transition>
          </div>
        </div>

        <button type="button" class="primary-save-button popup-save" @click="confirmAddGuest">
          确认加入名单
          <van-icon name="success" />
        </button>
      </div>
    </van-popup>
  </main>
</template>

<style lang="scss" scoped>
  .record-page {
    --record-ink: var(--app-text-primary);
    --record-red: var(--app-primary);
    min-height: calc(100svh - 58px);
    padding: 12px 18px calc(28px + env(safe-area-inset-bottom));
    background:
      radial-gradient(circle at 100% 0%, rgba(195, 66, 63, 0.065), transparent 210px),
      var(--color-background-2);
    color: var(--record-ink);
  }

  button,
  input,
  textarea {
    font: inherit;
  }

  button {
    -webkit-tap-highlight-color: transparent;
  }

  .record-header {
    display: grid;
    grid-template-columns: 42px 1fr 42px;
    align-items: center;
    min-height: 58px;
    margin-bottom: 14px;

    .icon-button,
    .header-mark {
      width: 38px;
      height: 38px;
      border-radius: 50%;
    }

    .icon-button {
      border: 1px solid var(--app-border);
      background: var(--app-card-bg);
      color: var(--record-ink);
      font-size: 18px;
      cursor: pointer;
    }

    .header-copy {
      text-align: center;

      .eyebrow {
        display: block;
        margin-bottom: 1px;
        color: var(--app-text-secondary);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.18em;
      }

      h1 {
        margin: 0;
        font-size: 19px;
        line-height: 1.25;
        letter-spacing: 0.02em;
      }
    }

    .header-mark {
      display: grid;
      place-items: center;
      justify-self: end;
      background: var(--app-primary-light);
      color: var(--record-red);
      font-family: 'Songti SC', 'STSong', serif;
      font-size: 17px;
      font-weight: 700;
      transform: rotate(4deg);
    }
  }

  .mode-segment {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5px;
    padding: 5px;
    margin-bottom: 28px;
    border: 1px solid var(--app-border);
    border-radius: 17px;
    background: color-mix(in srgb, var(--app-card-bg) 74%, transparent);

    .segment-item {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 9px;
      min-height: 58px;
      padding: 8px 10px;
      border: 0;
      border-radius: 13px;
      background: transparent;
      color: var(--app-text-secondary);
      text-align: left;
      cursor: pointer;
      transition:
        background-color 180ms ease,
        color 180ms ease,
        transform 180ms ease,
        box-shadow 180ms ease;

      .segment-symbol {
        display: grid;
        place-items: center;
        width: 28px;
        height: 28px;
        border: 1px solid currentColor;
        border-radius: 50%;
        font-family: 'Songti SC', 'STSong', serif;
        font-size: 13px;
        flex: 0 0 auto;
      }

      strong,
      small {
        display: block;
      }

      strong {
        font-size: 13px;
        line-height: 1.35;
      }

      small {
        margin-top: 2px;
        color: var(--app-text-muted);
        font-size: 10px;
      }

      &.active {
        background: var(--app-card-bg);
        color: var(--record-red);
        box-shadow: 0 5px 18px rgba(75, 48, 38, 0.08);
        transform: translateY(-1px);
      }
    }
  }

  .record-form {
    width: 100%;
  }

  .section-heading {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 13px;

    > div {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }

    .section-index {
      color: var(--record-red);
      font-family: Georgia, serif;
      font-size: 12px;
      font-weight: 700;
    }

    h2 {
      margin: 0;
      font-size: 16px;
      letter-spacing: 0.02em;
    }

    p {
      margin: 0;
      color: var(--app-text-muted);
      font-size: 10px;
    }
  }

  .field-stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 28px;
  }

  .field-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .field-block {
    display: block;
    width: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    text-align: left;

    .field-label {
      display: flex;
      justify-content: space-between;
      margin: 0 0 6px 2px;
      color: var(--app-text-secondary);
      font-size: 11px;
      font-weight: 650;

      small {
        color: var(--app-text-muted);
        font-size: 10px;
        font-weight: 400;
      }
    }

    .field-control {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 48px;
      padding: 0 14px;
      border: 1px solid var(--app-border);
      border-radius: 13px;
      background: var(--app-card-bg);
      color: var(--record-ink);
      font-size: 14px;
      transition:
        border-color 180ms ease,
        box-shadow 180ms ease;

      &:focus-within {
        border-color: color-mix(in srgb, var(--record-red) 55%, var(--app-border));
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--record-red) 9%, transparent);
      }
    }

    input,
    textarea {
      width: 100%;
      border: 0;
      outline: 0;
      background: transparent;
      color: var(--record-ink);
      font-size: 14px;

      &::placeholder {
        color: var(--app-text-muted);
      }
    }
  }

  .field-button {
    cursor: pointer;

    .field-control .van-icon {
      color: var(--app-text-muted);
      font-size: 11px;
    }
  }

  .quick-contacts {
    display: flex;
    align-items: center;
    gap: 7px;
    overflow-x: auto;
    margin-top: -4px;
    padding-bottom: 1px;

    > span {
      color: var(--app-text-muted);
      font-size: 10px;
      white-space: nowrap;
    }

    button {
      flex: 0 0 auto;
      padding: 5px 10px;
      border: 1px solid var(--app-border);
      border-radius: 999px;
      background: transparent;
      color: var(--app-text-secondary);
      font-size: 11px;
      cursor: pointer;

      &.selected {
        border-color: color-mix(in srgb, var(--record-red) 45%, var(--app-border));
        background: var(--app-primary-light);
        color: var(--record-red);
      }
    }
  }

  .guest-heading {
    align-items: center;
  }

  .text-action {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 7px 10px;
    border: 0;
    border-radius: 999px;
    background: var(--app-primary-light);
    color: var(--record-red);
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
  }

  .guest-list {
    border-top: 1px solid var(--app-border);

    article {
      display: grid;
      grid-template-columns: 38px minmax(0, 1fr) auto 24px;
      gap: 10px;
      align-items: center;
      padding: 13px 0;
      border-bottom: 1px solid var(--app-border);
      animation: list-in 220ms ease both;
    }

    .guest-avatar {
      display: grid;
      place-items: center;
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: var(--app-gold-bg);
      color: var(--app-gold-text);
      font-size: 14px;
      font-weight: 700;
    }

    .guest-info {
      min-width: 0;

      strong,
      span {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      strong {
        font-size: 14px;
      }

      span {
        margin-top: 3px;
        color: var(--app-text-secondary);
        font-size: 10px;
      }
    }

    .guest-amount {
      font-family:
        'SF Pro Display',
        -apple-system,
        sans-serif;
      font-size: 15px;
      font-weight: 750;
      font-variant-numeric: tabular-nums;
    }

    .remove-button {
      display: grid;
      place-items: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--app-text-muted);
      cursor: pointer;
    }
  }

  .empty-guest {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    padding: 24px 16px;
    border: 1px dashed color-mix(in srgb, var(--app-gold-text) 35%, var(--app-border));
    border-radius: 16px;
    background: color-mix(in srgb, var(--app-gold-bg) 36%, transparent);
    color: var(--record-ink);
    cursor: pointer;

    .empty-icon {
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      margin-bottom: 9px;
      border-radius: 50%;
      background: var(--app-card-bg);
      color: var(--app-gold-text);
      font-size: 21px;
    }

    strong {
      font-size: 13px;
    }

    small {
      margin-top: 4px;
      color: var(--app-text-secondary);
      font-size: 10px;
    }

    .empty-cta {
      margin-top: 12px;
      color: var(--record-red);
      font-size: 11px;
      font-weight: 700;
    }
  }

  .total-strip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 14px 0 24px;
    padding: 12px 14px;
    border-radius: 13px;
    background: var(--app-card-bg);

    > span {
      color: var(--app-text-secondary);
      font-size: 11px;
    }

    > div {
      display: flex;
      align-items: baseline;
      gap: 8px;

      small {
        color: var(--app-text-muted);
        font-size: 10px;
      }

      strong {
        color: var(--record-red);
        font-size: 20px;
        font-variant-numeric: tabular-nums;
      }
    }
  }

  .money-heading {
    margin-top: 2px;
  }

  .amount-field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border: 1px solid var(--app-border);
    border-radius: 16px;
    background: var(--app-card-bg);

    > span:first-child {
      color: var(--app-text-secondary);
      font-size: 12px;
      font-weight: 650;
    }

    .amount-control {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      width: 64%;

      b {
        margin-right: 5px;
        color: var(--record-red);
        font-size: 17px;
      }

      input {
        width: 100%;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--record-ink);
        font-family:
          'SF Pro Display',
          -apple-system,
          sans-serif;
        font-size: 28px;
        font-weight: 750;
        text-align: right;

        &::placeholder {
          color: var(--app-text-muted);
        }
      }
    }

    &.compact {
      padding: 12px 14px;

      .amount-control input {
        font-size: 24px;
      }
    }
  }

  .quick-amounts {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 6px;
    margin: 8px 0 24px;

    button {
      min-width: 0;
      padding: 7px 2px;
      border: 1px solid var(--app-border);
      border-radius: 9px;
      background: transparent;
      color: var(--app-text-secondary);
      font-size: 10px;
      cursor: pointer;
      transition: all 160ms ease;

      &.selected {
        border-color: var(--record-red);
        background: var(--app-primary-light);
        color: var(--record-red);
        font-weight: 700;
        transform: translateY(-1px);
      }
    }
  }

  .payment-field {
    margin-bottom: 22px;

    .payment-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;

      > div {
        display: flex;
        align-items: baseline;
        gap: 7px;
      }

      strong {
        font-size: 13px;
      }

      span {
        color: var(--app-text-muted);
        font-size: 10px;
      }

      .selected-payment {
        padding: 4px 9px;
        border-radius: 999px;
        background: var(--app-primary-light);
        color: var(--record-red);
        font-weight: 700;
      }
    }
  }

  .payment-options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;

    > button {
      position: relative;
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr) 15px;
      align-items: center;
      gap: 9px;
      min-height: 62px;
      padding: 9px 10px;
      overflow: hidden;
      border: 1px solid var(--app-border);
      border-radius: 13px;
      background: var(--app-card-bg);
      color: var(--record-ink);
      text-align: left;
      cursor: pointer;
      transition:
        border-color 180ms ease,
        background-color 180ms ease,
        transform 180ms ease;

      .payment-icon {
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        border-radius: 11px;
        background: var(--app-gold-bg);
        color: var(--app-gold-text);
        font-size: 18px;
      }

      strong,
      small {
        display: block;
      }

      strong {
        font-size: 12px;
      }

      small {
        margin-top: 2px;
        overflow: hidden;
        color: var(--app-text-muted);
        font-size: 9px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .check-icon {
        color: transparent;
        font-size: 14px;
      }

      &.selected {
        border-color: color-mix(in srgb, var(--record-red) 70%, var(--app-border));
        background: var(--app-primary-light);
        transform: translateY(-1px);

        .payment-icon {
          background: var(--app-card-bg);
          color: var(--record-red);
        }

        .check-icon {
          color: var(--record-red);
        }
      }
    }
  }

  .custom-payment-input {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 12px;
    margin-top: 9px;
    padding: 11px 13px;
    border: 1px solid var(--app-border);
    border-radius: 12px;
    background: var(--app-card-bg);

    span {
      color: var(--app-text-secondary);
      font-size: 11px;
    }

    input {
      min-width: 0;
      border: 0;
      outline: 0;
      background: transparent;
      color: var(--record-ink);
      font-size: 13px;
      text-align: right;

      &::placeholder {
        color: var(--app-text-muted);
      }
    }
  }

  .remark-field {
    margin-bottom: 22px;

    .field-control {
      min-height: 82px;
      padding-top: 12px;
      padding-bottom: 12px;
      align-items: flex-start;
    }

    textarea {
      resize: none;
      line-height: 1.55;
    }
  }

  .save-dock {
    position: sticky;
    bottom: 68px;
    z-index: 5;
    padding: 10px 0 4px;
    background: linear-gradient(to bottom, transparent, var(--color-background-2) 26%);
  }

  .primary-save-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: 50px;
    border: 0;
    border-radius: 14px;
    background: var(--record-red);
    color: #fff;
    font-size: 14px;
    font-weight: 750;
    letter-spacing: 0.06em;
    box-shadow: 0 10px 24px rgba(195, 66, 63, 0.22);
    cursor: pointer;
    transition:
      transform 160ms ease,
      box-shadow 160ms ease;

    &:active {
      transform: scale(0.985);
      box-shadow: 0 5px 14px rgba(195, 66, 63, 0.18);
    }

    &:disabled {
      cursor: wait;
      opacity: 0.68;
      box-shadow: none;
    }
  }

  :deep(.add-guest-popup) {
    max-height: min(90svh, 760px);
    background: var(--color-background-2);
  }

  .popup-content {
    display: flex;
    flex-direction: column;
    max-height: min(90svh, 760px);
    padding: 0 18px calc(14px + env(safe-area-inset-bottom));

    .popup-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex: 0 0 auto;
      padding: 18px 0 14px;

      span {
        color: var(--record-red);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.15em;
      }

      h2 {
        margin: 2px 0 0;
        font-size: 20px;
      }

      button {
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        border: 1px solid var(--app-border);
        border-radius: 50%;
        background: var(--app-card-bg);
        color: var(--record-ink);
        cursor: pointer;
      }
    }

    .popup-scroll {
      min-height: 0;
      overflow-y: auto;
      padding-bottom: 10px;
    }

    .popup-contact-list {
      margin: 8px 0 18px;
    }

    .popup-field-group {
      margin-bottom: 18px;

      > .field-label {
        display: block;
        margin: 0 0 7px 2px;
        color: var(--app-text-secondary);
        font-size: 11px;
        font-weight: 650;
      }
    }

    .popup-payment-field {
      margin-bottom: 8px;
    }

    .popup-save {
      flex: 0 0 auto;
      margin-top: 10px;
    }
  }

  .choice-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;

    button {
      padding: 6px 11px;
      border: 1px solid var(--app-border);
      border-radius: 999px;
      background: var(--app-card-bg);
      color: var(--app-text-secondary);
      font-size: 11px;
      cursor: pointer;

      &.selected {
        border-color: var(--record-red);
        background: var(--app-primary-light);
        color: var(--record-red);
        font-weight: 700;
      }
    }
  }

  .form-switch-enter-active,
  .form-switch-leave-active {
    transition:
      opacity 160ms ease,
      transform 160ms ease;
  }

  .form-switch-enter-from {
    opacity: 0;
    transform: translateX(10px);
  }

  .form-switch-leave-to {
    opacity: 0;
    transform: translateX(-10px);
  }

  .custom-field-enter-active,
  .custom-field-leave-active {
    transition:
      opacity 160ms ease,
      transform 160ms ease;
  }

  .custom-field-enter-from,
  .custom-field-leave-to {
    opacity: 0;
    transform: translateY(-5px);
  }

  @keyframes list-in {
    from {
      opacity: 0;
      transform: translateY(5px);
    }
  }

  @media (min-width: 600px) {
    .record-page {
      max-width: 560px;
      margin: 0 auto;
      padding-right: 28px;
      padding-left: 28px;
    }
  }

  @media (max-width: 359px) {
    .record-page {
      padding-right: 14px;
      padding-left: 14px;
    }

    .mode-segment .segment-item {
      gap: 6px;
      padding-right: 6px;
      padding-left: 6px;
    }

    .payment-options > button {
      grid-template-columns: 30px minmax(0, 1fr) 12px;
      gap: 6px;
      padding-right: 7px;
      padding-left: 7px;

      .payment-icon {
        width: 30px;
        height: 30px;
      }
    }
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      scroll-behavior: auto !important;
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
</style>
