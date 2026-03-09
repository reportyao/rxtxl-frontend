/**
 * ===================================================================
 * HTTP请求封装 (Request Utility)
 * ===================================================================
 *
 * 基于Taro.request封装的统一HTTP请求工具，提供：
 * 1. 自动添加JWT认证头（Bearer Token）
 * 2. 统一的请求/响应格式
 * 3. Token过期自动跳转登录页（401处理）
 * 4. 便捷的RESTful方法（api.get / api.post / api.put / api.del）
 *
 * 跨平台兼容：
 * - H5环境：Taro.request底层使用XMLHttpRequest
 * - 微信小程序环境：Taro.request底层使用wx.request
 * - 代码无需修改即可在两个平台运行
 *
 * API基础地址：
 * - 通过环境变量 TARO_APP_API_URL 配置
 * - 开发环境默认：http://localhost:3000
 * - 生产环境在config/index.ts中配置
 *
 * 使用示例：
 *   import { api } from '@/utils/request';
 *
 *   // GET请求
 *   const { data } = await api.get<Article[]>('/api/articles');
 *
 *   // POST请求
 *   const { data } = await api.post('/api/diaries', { content: '...' });
 */

import Taro from '@tarojs/taro';

/** API基础地址，从环境变量读取，开发环境默认localhost:3000 */
const BASE_URL = process.env.TARO_APP_API_URL || 'http://localhost:3000';

/**
 * 请求配置选项
 *
 * @property url - API路径（不含基础地址），如 '/api/articles'
 * @property method - HTTP方法，默认GET
 * @property data - 请求体数据（GET请求会转为query参数）
 * @property header - 自定义请求头（会与默认头合并）
 * @property needAuth - 是否需要携带JWT认证头，默认true
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
 * 所有后端接口都返回此格式，便于前端统一处理
 *
 * @property code - 业务状态码（200成功，401未认证，400参数错误，500服务器错误）
 * @property message - 提示信息（成功时为"success"，失败时为错误描述）
 * @property data - 业务数据（泛型T，失败时为null）
 */
interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

/**
 * 统一请求函数
 *
 * 所有API调用都通过此函数发出，确保：
 * 1. 认证头自动注入（从localStorage读取token）
 * 2. Content-Type默认设为application/json
 * 3. 401响应自动清除登录态并跳转登录页
 *
 * @param options - 请求配置
 * @returns 统一格式的API响应
 * @throws 网络错误或401认证失败
 */
export async function request<T = any>(options: RequestOptions): Promise<ApiResponse<T>> {
  const { url, method = 'GET', data, header = {}, needAuth = true } = options;

  // ===== 自动注入JWT认证头 =====
  // 从本地存储读取token（而非从Zustand store读取，避免循环依赖）
  if (needAuth) {
    const token = Taro.getStorageSync('token');
    if (token) {
      header['Authorization'] = `Bearer ${token}`;
    }
  }

  // 默认Content-Type为JSON（如果调用方未指定）
  header['Content-Type'] = header['Content-Type'] || 'application/json';

  try {
    const response = await Taro.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header,
    });

    const result = response.data as ApiResponse<T>;

    // ===== 401 Token过期处理 =====
    // 后端返回401表示token无效或已过期
    // 自动清除本地登录态，跳转登录页让用户重新登录
    if (result.code === 401) {
      Taro.removeStorageSync('token');
      Taro.removeStorageSync('user');
      Taro.redirectTo({ url: '/pages/login/index' });
      throw new Error('登录已过期');
    }

    return result;
  } catch (err: any) {
    // 网络错误、超时等异常
    console.error('[Request Error]', err);
    throw err;
  }
}

/**
 * RESTful便捷方法
 *
 * 封装常用的HTTP方法，简化调用代码：
 * - api.get('/api/articles')           → GET请求
 * - api.post('/api/diaries', data)     → POST请求
 * - api.put('/api/articles/1', data)   → PUT请求
 * - api.del('/api/diaries/1')          → DELETE请求
 *
 * 泛型T用于指定返回数据的类型，提供TypeScript类型推导：
 *   const { data } = await api.get<Article[]>('/api/articles');
 *   // data的类型自动推导为Article[]
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
