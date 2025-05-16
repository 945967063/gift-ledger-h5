/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * 封装axios请求
 */
import axios, { AxiosRequestConfig, InternalAxiosRequestConfig, Method } from 'axios';
import useStore from '@/store';
import i18n from '@/locales/index';
const isRefreshing = false; // 标志是否正在刷新token
const requestQueue: { config: InternalAxiosRequestConfig; resolve: any }[] = []; // 存放token失效的请求配置的promise的resolve方法
export default class RequestHelper {
  static source = axios.CancelToken.source();

  // 控制同一错误，回车后反复弹窗
  static errorFlag = true;

  //初始化请求配置
  static async init(): Promise<any> {
    RequestHelper.setBaseUrl();

    RequestHelper.initInterceptors();
  }

  static setBaseUrl() {
    const remoteUrl = window.SlideBank.VUE_APP_BASE_API;
    axios.defaults.baseURL = remoteUrl;
    axios.defaults.timeout = 10000;
  }

  static initInterceptors(): void {
    console.log('initInterceptors');
    // 添加请求拦截器
    axios.interceptors.request.use(
      async function (config) {
        // const { login } = useStore();
        config.headers!['accept-language'] = i18n.global.locale.value;
        // if (login.token.accessToken) {
        //   config.headers!['Authorization'] = `Bearer ${login.token.accessToken}`;
        // }
        return config;
      },
      function (error: any) {
        // 对请求错误做些什么
        return Promise.reject(error);
      }
    );

    // 添加响应拦截器
    axios.interceptors.response.use(
      function (response: any) {
        // 对响应数据做点什么
        // console.log('response', response);
        if (response) {
          switch (response.data.code) {
            case 400:
              return response.data;
            case 200:
              return response.data;
            case 500:
              return response.data;
            default:
              return response;
          }
        }
      },

      function (error: any) {
        console.log('error', error);

        // 对响应错误做点什么
        const response = error && error.response ? error.response : null;
        if (response?.config?.headers?.refreshToken && response.status === 401) {
        }
        if (response && response.status && response.status === 401) {
          return new Promise(async (resolve) => {
            requestQueue.push({ config: error?.config, resolve });
            if (isRefreshing) return;
          });
        } else {
          if (response && response.data && [403].includes(response.status)) {
            return Promise.reject(error.response.data);
          }
          if (response && response.data && [500, 400].includes(response.status)) {
            if (response?.data?.message) {
              // return Message.error(response?.data?.message);
            }
          }
        }
        return Promise.reject(error.response);
      }
    );
  }

  //网络请求的处理
  static async request(
    api: {
      url: string;
      method: Method;
      params: { params?: any; bodyParams?: any };
    },
    axiosConfig: AxiosRequestConfig = {
      cancelToken: RequestHelper.source.token,
    }
  ): Promise<any> {
    // console.log("1111");
    const { params, bodyParams } = api.params;
    const config: AxiosRequestConfig = axiosConfig ? axiosConfig : {};

    config.url = api.url;
    config.method = api.method;
    if (params) {
      config.params = params;
    }
    if (bodyParams) {
      config.data = bodyParams;
    }
    try {
      const result = await axios.request(config);

      return result;
    } catch (error) {
      // 这里主要是判断这个错误是取消请求导致的还是其他原因导致的
      if (axios.isCancel(error)) {
      }
      return Promise.reject(error);
    }
  }

  //取消所有请求
  static async cancelAllRequest() {
    RequestHelper.source.cancel();
  }
}

/**
 * 解密 JWT token 的信息
 * @param token jwt token 字符串
 * @returns <any>object
 */
export function decryptJWT(token: string): any {
  token = token.replace(/_/g, '/').replace(/-/g, '+');
  const json = decodeURIComponent(escape(window.atob(token.split('.')[1])));
  return JSON.parse(json);
}

/**
 * 将 JWT 时间戳转换成 Date
 * @description 主要针对 `exp`，`iat`，`nbf`
 * @param timestamp 时间戳
 * @returns Date 对象
 */
export function getJWTDate(timestamp: number): Date {
  return new Date(timestamp * 1000);
}
