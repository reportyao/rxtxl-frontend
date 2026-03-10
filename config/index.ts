/**
 * ===================================================================
 * Taro项目构建配置 (Build Config)
 * ===================================================================
 *
 * 定义Taro项目的编译和构建行为。
 *
 * 关键配置说明：
 * - designWidth: 375 → 以iPhone 6/7/8的375px宽度为设计基准
 * - compiler: webpack5 → 使用Webpack 5作为打包工具
 * - framework: react → 使用React作为UI框架
 *
 * 跨平台构建：
 * - H5: npm run build:h5 → 输出到dist目录，部署到Nginx
 * - 微信小程序: npm run build:weapp → 输出到dist目录，导入微信开发者工具
 *
 * 环境变量：
 * - 通过 defineConstants 或 process.env 注入
 * - TARO_APP_API_URL: 后端API基础地址
 */

import { defineConfig } from '@tarojs/cli';

export default defineConfig({
  /** 项目名称（用于构建输出标识） */
  projectName: 'rxtxl-frontend',

  /** 项目创建日期 */
  date: '2026-3-10',

  /**
   * 设计稿宽度（px）
   * 设为375表示以iPhone 6/7/8的屏幕宽度为基准
   * Taro会自动将px单位转换为rem（H5）或rpx（小程序）
   *
   * 例如：CSS中写 width: 100px → 在375px屏幕上占26.67%宽度
   */
  designWidth: 375,

  /**
   * 设备像素比映射
   * 不同设计稿宽度对应的转换比率
   * 375: 2 表示375px设计稿中的1px = 实际2rpx
   */
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    375: 2,
    828: 1.81 / 2,
  },

  /** 源代码目录 */
  sourceRoot: 'src',

  /** 构建输出目录 */
  outputRoot: 'dist',

  /**
   * Taro插件列表
   * - plugin-framework-react: React框架支持
   * - plugin-platform-h5: H5平台编译支持
   * 如需支持微信小程序，添加: '@tarojs/plugin-platform-weapp'
   */
  plugins: ['@tarojs/plugin-framework-react', '@tarojs/plugin-platform-h5'],

  /** 编译时常量定义（可在代码中通过变量名直接使用） */
  defineConstants: {
    /**
     * API基础地址
     * - 生产环境不设置此变量（使用相对路径，避免跨域）
     * - 如需指定完整URL，设置环境变量 TARO_APP_API_URL
     */
    'process.env.TARO_APP_API_URL': JSON.stringify(process.env.TARO_APP_API_URL || ''),
  },

  /** 文件复制配置（将非编译文件复制到输出目录） */
  copy: {
    patterns: [
      { from: 'src/sw.js', to: 'dist/sw.js' },
      { from: 'src/favicon.ico', to: 'dist/favicon.ico' },
      { from: 'src/assets/manifest.json', to: 'dist/manifest.json' },
      { from: 'src/assets/icons/icon-192.png', to: 'dist/icon-192.png' },
      { from: 'src/assets/icons/icon-512.png', to: 'dist/icon-512.png' },
    ],
    options: {},
  },

  /** UI框架：react */
  framework: 'react',

  /** 打包工具：webpack5 */
  compiler: 'webpack5',

  /** 构建缓存（开发时可开启加速，CI/CD中建议关闭确保一致性） */
  cache: {
    enable: false,
  },

  /**
   * 小程序端配置
   * 当执行 npm run build:weapp 时生效
   */
  mini: {
    postcss: {
      /** px转rpx自动转换 */
      pxtransform: {
        enable: true,
        config: {},
      },
      /** CSS Modules（当前未启用，如需组件级样式隔离可开启） */
      cssModules: {
        enable: false,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]',
        },
      },
    },
  },

  /**
   * H5端配置
   * 当执行 npm run dev:h5 或 npm run build:h5 时生效
   */
  h5: {
    /** 静态资源公共路径（部署到子目录时需修改，如 '/app/'） */
    publicPath: '/',

    /** 静态资源目录名 */
    staticDirectory: 'static',

    /**
     * HTML模板配置
     * - viewport-fit=cover: 启用安全区域适配（iPhone X+刘海屏必须）
     * - maximum-scale=1.0, user-scalable=no: 禁止双指缩放
     */
    htmlPluginOption: {
      template: require('path').resolve(__dirname, '../src/index.html'),
      templateParameters: {
        viewport: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover',
        mobileWebAppCapable: 'yes',
      },
    },

    /** 需要经过Babel编译的node_modules包（解决ES6+兼容性问题） */
    esnextModules: ['taro-ui'],

    postcss: {
      /** 自动添加CSS浏览器前缀（-webkit-, -moz-等） */
      autoprefixer: {
        enable: true,
        config: {},
      },
      cssModules: {
        enable: false,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]',
        },
      },
    },

    /**
     * 开发服务器配置
     * - port: 10086 → 开发时访问 http://localhost:10086
     * - host: 0.0.0.0 → 允许局域网内其他设备访问（手机调试用）
     */
    devServer: {
      port: 10086,
      host: '0.0.0.0',
    },

    /**
     * 路由模式
     * - browser: 使用HTML5 History API（URL无#号，如 /articles/1）
     * - hash: 使用URL hash（如 /#/articles/1）
     *
     * browser模式需要Nginx配置 try_files $uri /index.html
     * 否则刷新页面会404
     */
    router: {
      mode: 'browser',
    },
  },
});
