
"use strict";

/* ================================
   一、缓存版本
================================ */

const CACHE_NAME = "ledger-v1";

const PRECACHE_URLS = [
    "./",
    "./index.html",
    "./manifest.json"
];

/* ================================
   二、安装阶段
================================ */

self.addEventListener("install", event => {

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(PRECACHE_URLS);
            })
    );

});

/* ================================
   三、激活阶段
================================ */

self.addEventListener("activate", event => {

    event.waitUntil(
        caches.keys()
            .then(cacheNames => {

                return Promise.all(
                    cacheNames.map(cacheName => {

                        if (cacheName !== CACHE_NAME) {
                            return caches.delete(cacheName);
                        }

                    })
                );

            })
            .then(() => {
                return self.clients.claim();
            })
    );

});

/* ================================
   四、消息监听
   支持跳过等待并激活新版本
================================ */

self.addEventListener("message", event => {

    if (
        event.data &&
        event.data.type === "SKIP_WAITING"
    ) {
        self.skipWaiting();
    }

});

/* ================================
   五、Fetch 请求拦截
================================ */

self.addEventListener("fetch", event => {

    const request = event.request;

    // 只处理 GET 请求
    if (request.method !== "GET") {
        return;
    }

    const url = new URL(request.url);

    // 不缓存跨域资源
    if (url.origin !== self.location.origin) {
        return;
    }

    /* ----------------------------
       导航请求：
       网络优先，失败回退缓存
    ---------------------------- */

    if (request.mode === "navigate") {

        event.respondWith(

            fetch(request)
                .then(response => {

                    if (response && response.ok) {

                        const responseCopy = response.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(
                                    "./index.html",
                                    responseCopy
                                );
                            });

                    }

                    return response;

                })
                .catch(async () => {

                    const cache = await caches.open(CACHE_NAME);

                    return (
                        await cache.match(request) ||
                        await cache.match("./index.html") ||
                        Response.error()
                    );

                })

        );

        return;
    }

    /* ----------------------------
       静态资源：
       缓存优先，网络回填
    ---------------------------- */

    event.respondWith(

        caches.match(request)
            .then(cachedResponse => {

                if (cachedResponse) {

                    // 后台网络回填
                    const networkUpdate = fetch(request)
                        .then(response => {

                            if (response && response.ok) {

                                const responseCopy = response.clone();

                                caches.open(CACHE_NAME)
                                    .then(cache => {
                                        cache.put(
                                            request,
                                            responseCopy
                                        );
                                    });

                            }

                            return response;

                        })
                        .catch(() => null);

                    // 不阻塞当前缓存响应
                    event.waitUntil(networkUpdate);

                    return cachedResponse;
                }

                // 缓存没有时请求网络
                return fetch(request)
                    .then(response => {

                        if (response && response.ok) {

                            const responseCopy = response.clone();

                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(
                                        request,
                                        responseCopy
                                    );
                                });

                        }

                        return response;

                    });

            })

    );

});
