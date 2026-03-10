/**
 * ===================================================================
 * HTTP请求封装 (Request Utility)
 * ===================================================================
 *
 * v1.1 优化：
 * - [性能] 增加GET请求去重（同一URL同时只发一次请求，共享结果）
 * - [BUG FIX] 401跳转增加防重复跳转标志，避免多个并发请求同时触发跳转
 * - [BUG FIX] 增加请求超时配置（15秒）
 * - [安全] HTTP状态码非200时也检查并处理
 */

import Taro from '@tarojs/taro';

/**
 * API基础地址，从环境变量读取
 * - 生产环境：设置为空字符串，使用相对路径，避免跨域问题（前端和API同域）
 * - 开发环境：使用localhost:3000
 * - 如需指定完整URL：设置 TARO_APP_API_URL 环境变量
 */
const BASE_URL = process.env.TARO_APP_API_URL !== undefined && process.env.TARO_APP_API_URL !== ''
  ? process.env.TARO_APP_API_URL
  : (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000');

/** 请求超时时间（毫秒） */
const REQUEST_TIMEOUT = 15000;

/**
 * 请求配置选项
 */
interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  header?: Record<string, string>;
  needAuth?: boolean;
}

/**
 * 统一API响应格式
 */
interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

/**
 * GET请求去重缓存
 * 同一URL同时只发一次请求，后续相同请求共享同一个Promise
 * 请求完成后自动清除，不影响后续请求
 */
const pendingRequests = new Map<string, Promise<any>>();

/**
 * 401跳转防重复标志
 * 避免多个并发请求同时收到401时重复跳转登录页
 */
let isRedirectingToLogin = false;

/**
 * 统一请求函数
 */
export async function request<T = any>(options: RequestOptions): Promise<ApiResponse<T>> {
  const { url, method = 'GET', data, header = {}, needAuth = true } = options;

  // ===== GET请求去重 =====
  // 同一URL的GET请求如果正在进行中，直接返回同一个Promise
  const requestKey = method === 'GET' ? `${method}:${url}:${JSON.stringify(data || {})}` : '';
  if (method === 'GET' && pendingRequests.has(requestKey)) {
    return pendingRequests.get(requestKey)!;
  }

  // ===== 自动注入JWT认证头 =====
  if (needAuth) {
    const token = Taro.getStorageSync('token');
    if (token) {
      header['Authorization'] = `Bearer ${token}`;
    }
  }

  header['Content-Type'] = header['Content-Type'] || 'application/json';

  const requestPromise = (async () => {
    try {
      const response = await Taro.request({
        url: `${BASE_URL}${url}`,
        method,
        data,
        header,
        timeout: REQUEST_TIMEOUT,
      });

      const result = response.data as ApiResponse<T>;

      // ===== HTTP状态码检查 =====
      if (response.statusCode >= 500) {
        return {
          code: response.statusCode,
          message: '服务器错误，请稍后重试',
          data: null as any,
        };
      }

      // ===== 429 频率限制处理 =====
      if (response.statusCode === 429) {
        return {
          code: 429,
          message: result.message || '请求过于频繁，请稍后再试',
          data: null as any,
        };
      }

      // ===== 401 Token过期处理 =====
      if (result.code === 401 || response.statusCode === 401) {
        Taro.removeStorageSync('token');
        Taro.removeStorageSync('user');

        // 防止多个并发请求同时触发跳转
        if (!isRedirectingToLogin) {
          isRedirectingToLogin = true;
          setTimeout(() => {
            isRedirectingToLogin = false;
          }, 3000);
          Taro.redirectTo({ url: '/pages/login/index' });
        }
        throw new Error('登录已过期');
      }

      return result;
    } catch (err: any) {
      // 超时错误
      if (err?.errMsg?.includes('timeout') || err?.message?.includes('timeout')) {
        console.error('[Request Timeout]', url);
        throw new Error('请求超时，请检查网络');
      }
      console.error('[Request Error]', err);
      throw err;
    } finally {
      // 请求完成后清除去重缓存
      if (requestKey) {
        pendingRequests.delete(requestKey);
      }
    }
  })();

  // 将GET请求的Promise存入去重缓存
  if (requestKey) {
    pendingRequests.set(requestKey, requestPromise);
  }

  return requestPromise;
}

/**
 * RESTful便捷方法
 */
export const api = {
  get: <T = any>(url: string, data?: any) =>
    request<T>({ url, method: 'GET', data }),

  post: <T = any>(url: string, data?: any) =>
    request<T>({ url, method: 'POST', data }),

  put: <T = any>(url: string, data?: any) =>
    request<T>({ url, method: 'PUT', data }),

  del: <T = any>(url: string, data?: any) =>
    request<T>({ url, method: 'DELETE', data }),
};
