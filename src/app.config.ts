/**
 * ===================================================================
 * Taro应用全局配置 (App Config)
 * ===================================================================
 *
 * 定义应用的页面路由、底部TabBar和全局窗口样式。
 *
 * 页面路由说明：
 * - pages数组中的第一个页面是应用启动时的首页
 * - index页面作为路由分发器，根据登录状态跳转到不同页面
 * - tabBar中的页面使用switchTab跳转，其他页面使用navigateTo跳转
 *
 * TabBar设计：
 * - 4个Tab：读（文章）、捞石头（日记）、河床（石头收藏馆）、我的（个人中心）
 * - 配色遵循水墨中国风设计规范
 *
 * 跨平台兼容：
 * - H5环境：Taro自动生成底部TabBar组件
 * - 微信小程序环境：使用原生TabBar
 * - 图标需要准备8个PNG文件（4个Tab × 2种状态）
 */
export default defineAppConfig({
  /**
   * 页面路由列表
   * 所有页面必须在此注册，否则无法通过Taro.navigateTo跳转
   * 顺序影响H5环境下的路由优先级
   */
  pages: [
    'pages/index/index',           // 首页（路由分发器，判断登录状态后跳转）
    'pages/onboarding/index',      // 新用户引导（3屏滑动引导）
    'pages/login/index',           // 登录/注册（手机号+验证码）
    'pages/pin-setup/index',       // PIN码设置（4位数字加密密码）
    'pages/articles/index',        // 文章列表（TabBar页面）
    'pages/article-detail/index',  // 文章详情（沉浸式阅读）
    'pages/diary/index',           // 道痕日记（TabBar页面，引导式写作）
    'pages/diary-history/index',   // 日记历史列表
    'pages/diary-detail/index',    // 日记详情（需PIN解密查看）
    'pages/riverbed/index',        // 石头收藏馆（TabBar页面，Canvas河床可视化）
    'pages/profile/index',         // 个人中心（TabBar页面）
    'pages/calendar/index',        // 河水日历（打卡统计）
    'pages/share/index',           // 分享卡片生成
  ],

  /**
   * 底部TabBar配置
   *
   * 设计理念：
   * - "读"：阅读文章，获取认知
   * - "捞石头"：写道痕日记，实践认知
   * - "河床"：查看石头收藏，回顾成长
   * - "我的"：个人设置和成就
   *
   * 配色：
   * - 未选中：#8A8A8A（淡墨灰）
   * - 选中：#3A4A5C（深墨蓝）
   * - 背景：#F7F4ED（宣纸底色）
   */
  tabBar: {
    color: '#8A8A8A',
    selectedColor: '#3A4A5C',
    backgroundColor: '#F7F4ED',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/articles/index',
        text: '读',
        iconPath: 'assets/icons/tab-read.png',
        selectedIconPath: 'assets/icons/tab-read-active.png',
      },
      {
        pagePath: 'pages/diary/index',
        text: '捞石头',
        iconPath: 'assets/icons/tab-diary.png',
        selectedIconPath: 'assets/icons/tab-diary-active.png',
      },
      {
        pagePath: 'pages/riverbed/index',
        text: '河床',
        iconPath: 'assets/icons/tab-riverbed.png',
        selectedIconPath: 'assets/icons/tab-riverbed-active.png',
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: 'assets/icons/tab-profile.png',
        selectedIconPath: 'assets/icons/tab-profile-active.png',
      },
    ],
  },

  /**
   * 全局窗口样式
   * 定义导航栏和页面背景的默认样式
   * 各页面可在自己的.config.ts中覆盖这些设置
   */
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#F7F4ED',  // 宣纸底色
    navigationBarTitleText: '人选天选论',
    navigationBarTextStyle: 'black',
    backgroundColor: '#F7F4ED',
  },
});
