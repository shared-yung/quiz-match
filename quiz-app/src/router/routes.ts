import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('@/pages/IndexPage.vue') },
      // 暫定手段（SDP のコピー&ペースト）でのホスト星形接続の確認用。本来のルーム作成・参加 UI は #21
      { path: 'debug/net/host', component: () => import('@/pages/NetHostDebugPage.vue') },
      { path: 'debug/net/player', component: () => import('@/pages/NetPlayerDebugPage.vue') },
    ],
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('@/pages/ErrorNotFound.vue'),
  },
];

export default routes;
