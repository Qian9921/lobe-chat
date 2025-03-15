import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { UAParser } from 'ua-parser-js';
import urlJoin from 'url-join';

import { appEnv } from '@/config/app';
import { authEnv } from '@/config/auth';
import { LOBE_LOCALE_COOKIE } from '@/const/locale';
import { LOBE_THEME_APPEARANCE } from '@/const/theme';
import NextAuthEdge from '@/libs/next-auth/edge';
import { Locales } from '@/locales/resources';
import { parseBrowserLanguage } from '@/utils/locale';
import { parseDefaultThemeFromCountry } from '@/utils/server/geo';
import { RouteVariants } from '@/utils/server/routeVariants';

import { OAUTH_AUTHORIZED } from './const/auth';

export const config = {
  matcher: [
    // include any files in the api or trpc folders that might have an extension
    '/(api|trpc|webapi)(.*)',
    // include the /
    '/',
    '/discover',
    '/discover(.*)',
    '/chat',
    '/chat(.*)',
    '/changelog(.*)',
    '/settings(.*)',
    '/files',
    '/files(.*)',
    '/repos(.*)',
    '/profile(.*)',
    '/me',
    '/me(.*)',

    '/login(.*)',
    '/signup(.*)',
    '/next-auth/(.*)',
    // ↓ cloud ↓
  ],
};

const defaultMiddleware = (request: NextRequest) => {
  const url = new URL(request.url);

  // skip all api requests
  if (['/api', '/trpc', '/webapi'].some((path) => url.pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // 1. 从 cookie 中读取用户偏好
  const theme =
    request.cookies.get(LOBE_THEME_APPEARANCE)?.value || parseDefaultThemeFromCountry(request);

  // if it's a new user, there's no cookie
  // So we need to use the fallback language parsed by accept-language
  const browserLanguage = parseBrowserLanguage(request.headers);
  const locale = (request.cookies.get(LOBE_LOCALE_COOKIE)?.value || browserLanguage) as Locales;

  const ua = request.headers.get('user-agent');

  const device = new UAParser(ua || '').getDevice();

  // 2. 创建规范化的偏好值
  const route = RouteVariants.serializeVariants({
    isMobile: device.type === 'mobile',
    locale,
    theme,
  });

  // if app is in docker, rewrite to self container
  // https://github.com/lobehub/lobe-chat/issues/5876
  if (appEnv.MIDDLEWARE_REWRITE_THROUGH_LOCAL) {
    url.protocol = 'http';
    url.host = '127.0.0.1';
    url.port = process.env.PORT || '3210';
  }

  // refs: https://github.com/lobehub/lobe-chat/pull/5866
  // new handle segment rewrite: /${route}${originalPathname}
  // / -> /zh-CN__0__dark
  // /discover -> /zh-CN__0__dark/discover
  const nextPathname = `/${route}` + (url.pathname === '/' ? '' : url.pathname);
  const nextURL = appEnv.MIDDLEWARE_REWRITE_THROUGH_LOCAL
    ? urlJoin(url.origin, nextPathname)
    : nextPathname;

  console.log(`[rewrite] ${url.pathname} -> ${nextURL}`);

  url.pathname = nextPathname;

  return NextResponse.rewrite(url, { status: 200 });
};

// Initialize an Edge compatible NextAuth middleware
const nextAuthMiddleware = NextAuthEdge.auth((req) => {
  const response = defaultMiddleware(req);

  // Just check if session exists
  const session = req.auth;

  // Check if next-auth throws errors
  // refs: https://github.com/lobehub/lobe-chat/pull/1323
  const isLoggedIn = !!session?.expires;

  // Remove & amend OAuth authorized header
  response.headers.delete(OAUTH_AUTHORIZED);
  if (isLoggedIn) {
    response.headers.set(OAUTH_AUTHORIZED, 'true');
  }

  return response;
});

// Firebase 认证中间件
const firebaseAuthMiddleware = (req: NextRequest) => {
  // 获取请求的 URL
  const url = new URL(req.url);
  const pathname = url.pathname;
  
  // 获取响应
  const response = defaultMiddleware(req);
  
  // 检查请求头中是否有 Firebase 授权
  const isLoggedIn = req.headers.get(OAUTH_AUTHORIZED) === 'true';
  
  // 尝试从 cookie 中获取认证信息 (备用检测)
  const hasCookieAuth = req.cookies.has('firebase-auth-token') || 
                        req.cookies.has('next-auth.session-token');
  
  // 确定最终认证状态（头部或cookie有一个通过即认为已登录）
  const isAuthenticated = isLoggedIn || hasCookieAuth;
  
  // 移除并设置 OAuth 授权头
  response.headers.delete(OAUTH_AUTHORIZED);
  if (isAuthenticated) {
    response.headers.set(OAUTH_AUTHORIZED, 'true');
  }
  
  // 检查是否访问受保护路由但未登录
  if (!isAuthenticated && isProtectedRoute(req)) {
    // 重定向到登录页面
    return NextResponse.redirect(new URL('/login', req.url));
  }
  
  return response;
};

const isProtectedRoute = createRouteMatcher([
  '/settings(.*)',
  '/files(.*)',
  '/onboard(.*)',
  '/profile(.*)',
  // 临时放开聊天路径，使用客户端遮罩来保护
  // '/chat(.*)',
  '/discover(.*)',
  '/me(.*)',
  '/topics(.*)',
  '/repos(.*)',
  '/changelog(.*)',
  '/', // 主页也需要登录
]);

const clerkAuthMiddleware = clerkMiddleware(
  async (auth, req) => {
    if (isProtectedRoute(req)) await auth.protect();

    return defaultMiddleware(req);
  },
  {
    // https://github.com/lobehub/lobe-chat/pull/3084
    clockSkewInMs: 60 * 60 * 1000,
    signInUrl: '/login',
    signUpUrl: '/signup',
  },
);

// 检查是否启用了 Firebase 认证
const enableFirebaseAuth = process.env.NEXT_PUBLIC_ENABLE_FIREBASE_AUTH === 'true';

export default enableFirebaseAuth
  ? firebaseAuthMiddleware
  : authEnv.NEXT_PUBLIC_ENABLE_CLERK_AUTH
    ? clerkAuthMiddleware
    : authEnv.NEXT_PUBLIC_ENABLE_NEXT_AUTH
      ? nextAuthMiddleware
      : defaultMiddleware;
