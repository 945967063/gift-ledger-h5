<script setup lang="ts">
  import { ref, reactive } from 'vue';
  import { useRouter } from 'vue-router';
  import { showToast, showLoadingToast, closeToast } from 'vant';
  import { authApi } from '@/api/auth';
  import useStore from '@/store';

  const router = useRouter();
  const { gift } = useStore();

  const mode = ref<'login' | 'register'>('login');
  const loading = ref(false);

  const loginForm = reactive({ phone: '', password: '' });
  const registerForm = reactive({ name: '', phone: '', password: '', confirm: '' });

  const handleLogin = async () => {
    if (!loginForm.phone || !loginForm.password) {
      showToast('请输入手机号和密码');
      return;
    }
    loading.value = true;
    showLoadingToast({ message: '登录中...', forbidClick: true });
    try {
      const res = await authApi.login({ phone: loginForm.phone, password: loginForm.password });
      const { token, user } = res.data.data;
      localStorage.setItem('gift_ledger_token', token);
      localStorage.setItem('gift_ledger_user', JSON.stringify(user));
      gift.setUserName(user.name);
      closeToast();
      showToast({ message: '登录成功', icon: 'passed' });
      setTimeout(() => router.replace('/home'), 800);
    } catch {
      closeToast();
    } finally {
      loading.value = false;
    }
  };

  const handleRegister = async () => {
    if (!registerForm.name || !registerForm.password) {
      showToast('请填写姓名和密码');
      return;
    }
    if (registerForm.password !== registerForm.confirm) {
      showToast('两次密码不一致');
      return;
    }
    loading.value = true;
    showLoadingToast({ message: '注册中...', forbidClick: true });
    try {
      const res = await authApi.register({
        name: registerForm.name,
        phone: registerForm.phone || undefined,
        password: registerForm.password,
      });
      const { token, user } = res.data.data;
      localStorage.setItem('gift_ledger_token', token);
      localStorage.setItem('gift_ledger_user', JSON.stringify(user));
      gift.setUserName(user.name);
      closeToast();
      showToast({ message: '注册成功，欢迎使用人情簿！', icon: 'passed' });
      setTimeout(() => router.replace('/home'), 800);
    } catch {
      closeToast();
    } finally {
      loading.value = false;
    }
  };
</script>

<template>
  <div class="login-page">
    <!-- Logo & Title -->
    <div class="login-hero">
      <div class="logo-icon">🎋</div>
      <div class="app-name">人情簿</div>
      <div class="app-tagline">Gift Ledger · 礼往情长</div>
    </div>

    <!-- Tab Switch -->
    <div class="tab-switch">
      <div :class="['tab-item', { active: mode === 'login' }]" @click="mode = 'login'">登录</div>
      <div :class="['tab-item', { active: mode === 'register' }]" @click="mode = 'register'">
        注册
      </div>
    </div>

    <!-- Login Form -->
    <div v-if="mode === 'login'" class="form-card">
      <div class="form-group">
        <label>手机号</label>
        <input v-model="loginForm.phone" type="tel" placeholder="请输入手机号" />
      </div>
      <div class="form-group">
        <label>密码</label>
        <input
          v-model="loginForm.password"
          type="password"
          placeholder="请输入密码"
          @keyup.enter="handleLogin"
        />
      </div>
      <button class="submit-btn" :disabled="loading" @click="handleLogin">登录</button>
    </div>

    <!-- Register Form -->
    <div v-else class="form-card">
      <div class="form-group">
        <label>您的姓名</label>
        <input v-model="registerForm.name" type="text" placeholder="如：小明" />
      </div>
      <div class="form-group">
        <label>手机号 (选填)</label>
        <input v-model="registerForm.phone" type="tel" placeholder="用于登录（可不填）" />
      </div>
      <div class="form-group">
        <label>密码</label>
        <input v-model="registerForm.password" type="password" placeholder="请设置密码" />
      </div>
      <div class="form-group">
        <label>确认密码</label>
        <input
          v-model="registerForm.confirm"
          type="password"
          placeholder="再次输入密码"
          @keyup.enter="handleRegister"
        />
      </div>
      <button class="submit-btn" :disabled="loading" @click="handleRegister">创建账号</button>
    </div>

    <div class="demo-hint">
      演示账号：手机号
      <strong>13800000001</strong>
      / 密码
      <strong>123456</strong>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  .login-page {
    min-height: 100vh;
    background: linear-gradient(160deg, #fff5f5 0%, #fef9f0 60%, #f5f0ff 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 48px 24px 40px;
    box-sizing: border-box;
  }

  .login-hero {
    text-align: center;
    margin-bottom: 36px;

    .logo-icon {
      font-size: 56px;
      margin-bottom: 10px;
    }

    .app-name {
      font-size: 28px;
      font-weight: 900;
      color: #c3423f;
      letter-spacing: 2px;
    }

    .app-tagline {
      font-size: 12px;
      color: #b08968;
      margin-top: 4px;
      letter-spacing: 1px;
    }
  }

  .tab-switch {
    display: flex;
    background: #f5f5f5;
    border-radius: 10px;
    padding: 3px;
    margin-bottom: 24px;
    width: 100%;
    max-width: 320px;

    .tab-item {
      flex: 1;
      text-align: center;
      padding: 8px 0;
      font-size: 14px;
      font-weight: 500;
      color: #8e8e93;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;

      &.active {
        background: #fff;
        color: #c3423f;
        font-weight: 700;
        box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08);
      }
    }
  }

  .form-card {
    width: 100%;
    max-width: 320px;
    background: #fff;
    border-radius: 20px;
    padding: 24px 20px;
    box-shadow: 0 6px 24px rgba(195, 66, 63, 0.08);
    display: flex;
    flex-direction: column;
    gap: 14px;

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 5px;

      label {
        font-size: 12px;
        font-weight: 600;
        color: #636366;
      }

      input {
        border: 1px solid #e5e5ea;
        border-radius: 10px;
        padding: 10px 12px;
        font-size: 15px;
        color: #1c1c1e;
        outline: none;
        background: #fafafa;
        transition: border-color 0.2s;

        &:focus {
          border-color: #c3423f;
          background: #fff;
        }

        &::placeholder {
          color: #aeaeb2;
        }
      }
    }

    .submit-btn {
      width: 100%;
      background: linear-gradient(135deg, #c3423f, #e05a57);
      color: #fff;
      font-size: 16px;
      font-weight: 700;
      padding: 13px 0;
      border-radius: 12px;
      border: none;
      cursor: pointer;
      margin-top: 6px;
      letter-spacing: 1px;
      box-shadow: 0 4px 14px rgba(195, 66, 63, 0.28);
      transition: opacity 0.2s;

      &:disabled {
        opacity: 0.6;
      }

      &:active {
        opacity: 0.85;
      }
    }
  }

  .demo-hint {
    margin-top: 24px;
    font-size: 12px;
    color: #aeaeb2;
    text-align: center;
    line-height: 1.8;

    strong {
      color: #b08968;
    }
  }
</style>
