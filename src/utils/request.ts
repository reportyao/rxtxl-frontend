import Taro from '@tarojs/taro';

const BASE_URL = process.env.TARO_APP_API_URL || 'http://localhost:3000';

interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  header?: Record<string, string>;
  needAuth?: boolean;
}

interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

/**
 * 统一请求封装
 */
export async function request<T = any>(options: RequestOptions): Promise<ApiResponse<T>> {
  const { url, method = 'GET', data, header = {}, needAuth = true } = options;

  // 添加认证头
  if (needAuth) {
    const token = Taro.getStorageSync('token');
    if (token) {
      header['Authorization'] = `Bearer ${token}`;
    }
  }

  header['Content-Type'] = header['Content-Type'] || 'application/json';

  try {
    const response = await Taro.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header,
    });

    const result = response.data as ApiResponse<T>;

    // Token过期处理
    if (result.code === 401) {
      Taro.removeStorageSync('token');
      Taro.removeStorageSync('user');
      Taro.redirectTo({ url: '/pages/login/index' });
      throw new Error('登录已过期');
    }

    return result;
  } catch (err: any) {
    console.error('[Request Error]', err);
    throw err;
  }
}

// 便捷方法
export const api = {
  get: <T = any>(url: string, data?: any) => request<T>({ url, method: 'GET', data }),
  post: <T = any>(url: string, data?: any) => request<T>({ url, method: 'POST', data }),
  put: <T = any>(url: string, data?: any) => request<T>({ url, method: 'PUT', data }),
  del: <T = any>(url: string, data?: any) => request<T>({ url, method: 'DELETE', data }),
};
