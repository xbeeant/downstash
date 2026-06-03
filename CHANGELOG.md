# Changelog

## [0.1.3](https://github.com/xbeeant/downstash/compare/v0.1.2...v0.1.3) (2026-06-03)


### Features

* 实现令牌签名密钥管理与定时任务功能 ([78cc309](https://github.com/xbeeant/downstash/commit/78cc309c840efce490c3ece25eb8dacf17f65f5b))


### Documentation

* **readme:** 重写并本地化README文档为简体中文 ([3272bca](https://github.com/xbeeant/downstash/commit/3272bca0c104218b8dcc152ee1b81c7277f23060))


### Refactors

* **routes/worker:** 优化请求体处理并添加调试日志 ([f958b6e](https://github.com/xbeeant/downstash/commit/f958b6eff7301590253865ea31b2e39b7a74143a))
* 重构签名逻辑，支持密钥轮换功能 ([b8c510c](https://github.com/xbeeant/downstash/commit/b8c510cf1a4cf147747964d9d3561fb068d26e48))

## [0.1.2](https://github.com/xbeeant/downstash/compare/v0.1.1...v0.1.2) (2026-06-01)


### Features

* add config, signing, ids, duration, and logger primitives ([dd38355](https://github.com/xbeeant/downstash/commit/dd38355ac322c192afe62bd2a008bd2c50f96a1a))
* **cli:** add qstub command with serve, reset, keys, and help ([7cb250d](https://github.com/xbeeant/downstash/commit/7cb250d203f2bac89c12219cae9760524b918219))
* **db:** add bun:sqlite persistence layer for messages ([7499cfa](https://github.com/xbeeant/downstash/commit/7499cfa7f27066ac8eb204c51c63a2a96c3abb61))
* implement POST /v2/batch endpoint ([158465b](https://github.com/xbeeant/downstash/commit/158465b91db4500bcd7d983222a7230e94b1a222))
* **redis:** add in-memory Redis store with command dispatcher ([f951b51](https://github.com/xbeeant/downstash/commit/f951b519055a3ed4787b6f08d8552eecae7a5d58))
* **redis:** add Redis REST API routes and config ([a5382c1](https://github.com/xbeeant/downstash/commit/a5382c1969b964c5e3ecee2db1684681246fe305))
* **server:** add hono routes for publish, messages, and health ([8855889](https://github.com/xbeeant/downstash/commit/88558895d36c1c638349646902bfcb7cbef8ebe2))
* **worker:** add delivery loop with retries and callbacks ([04ae35d](https://github.com/xbeeant/downstash/commit/04ae35d358726f73023e911fae2f47d8988a11fd))
* 实现完整QStash消息队列功能，新增调度、队列、DLQ等模块 ([e7c0d55](https://github.com/xbeeant/downstash/commit/e7c0d55d0339fb19f8dadbd5450f0da7dc391983))
* 添加token认证与管理功能 ([9089348](https://github.com/xbeeant/downstash/commit/9089348325dca9a8018094aabf809b8ca84f4179))
* 迁移项目从SQLite到MySQL并添加Docker支持 ([0c42e3e](https://github.com/xbeeant/downstash/commit/0c42e3e03993b5f62fefbb327f6a923f4c961f04))


### Bug Fixes

* correct repository owner URL in README and package.json ([cef8b96](https://github.com/xbeeant/downstash/commit/cef8b96bb6ec15a952c9362eac2bc36e5d10800a))
* format package.json files array on single line ([b792564](https://github.com/xbeeant/downstash/commit/b792564e07b6d162f90dc8f65f75ee16c8c7a017))


### Documentation

* add GitHub Pages landing page ([98f07c7](https://github.com/xbeeant/downstash/commit/98f07c721a5509630b2c3b9bc23eaff38be1d78f))
* add mysql storage documentation and update dockerfile ([d35a07c](https://github.com/xbeeant/downstash/commit/d35a07c663de9ab8e19ff77599706e4f9cd15229))
* fix nav links and remove stale version/star badges ([84111c1](https://github.com/xbeeant/downstash/commit/84111c1a2bbe600dd4cda627b988750f93021c0c))
* update README for Redis support and downstash rename ([682b191](https://github.com/xbeeant/downstash/commit/682b191e3c6b6f7540b77d69179aa906b481eb27))
* write README with quick-start, env block, CLI reference ([869a655](https://github.com/xbeeant/downstash/commit/869a6559b180d9a23bb092bcfaec0b371ddb4acf))


### Refactors

* rename qstub to downstash ([eea653b](https://github.com/xbeeant/downstash/commit/eea653be44c01a6956b62e7baa719d342048e941))

## [0.1.1](https://github.com/sskcfC15Xfoxd7X1sVFgipdzMRAkP/downstash/compare/v0.1.0...v0.1.1) (2026-04-30)


### Features

* add config, signing, ids, duration, and logger primitives ([dd38355](https://github.com/sskcfC15Xfoxd7X1sVFgipdzMRAkP/downstash/commit/dd38355ac322c192afe62bd2a008bd2c50f96a1a))
* **cli:** add qstub command with serve, reset, keys, and help ([7cb250d](https://github.com/sskcfC15Xfoxd7X1sVFgipdzMRAkP/downstash/commit/7cb250d203f2bac89c12219cae9760524b918219))
* **db:** add bun:sqlite persistence layer for messages ([7499cfa](https://github.com/sskcfC15Xfoxd7X1sVFgipdzMRAkP/downstash/commit/7499cfa7f27066ac8eb204c51c63a2a96c3abb61))
* implement POST /v2/batch endpoint ([158465b](https://github.com/sskcfC15Xfoxd7X1sVFgipdzMRAkP/downstash/commit/158465b91db4500bcd7d983222a7230e94b1a222))
* **redis:** add in-memory Redis store with command dispatcher ([f951b51](https://github.com/sskcfC15Xfoxd7X1sVFgipdzMRAkP/downstash/commit/f951b519055a3ed4787b6f08d8552eecae7a5d58))
* **redis:** add Redis REST API routes and config ([a5382c1](https://github.com/sskcfC15Xfoxd7X1sVFgipdzMRAkP/downstash/commit/a5382c1969b964c5e3ecee2db1684681246fe305))
* **server:** add hono routes for publish, messages, and health ([8855889](https://github.com/sskcfC15Xfoxd7X1sVFgipdzMRAkP/downstash/commit/88558895d36c1c638349646902bfcb7cbef8ebe2))
* **worker:** add delivery loop with retries and callbacks ([04ae35d](https://github.com/sskcfC15Xfoxd7X1sVFgipdzMRAkP/downstash/commit/04ae35d358726f73023e911fae2f47d8988a11fd))


### Bug Fixes

* correct repository owner URL in README and package.json ([cef8b96](https://github.com/sskcfC15Xfoxd7X1sVFgipdzMRAkP/downstash/commit/cef8b96bb6ec15a952c9362eac2bc36e5d10800a))


### Documentation

* update README for Redis support and downstash rename ([682b191](https://github.com/sskcfC15Xfoxd7X1sVFgipdzMRAkP/downstash/commit/682b191e3c6b6f7540b77d69179aa906b481eb27))
* write README with quick-start, env block, CLI reference ([869a655](https://github.com/sskcfC15Xfoxd7X1sVFgipdzMRAkP/downstash/commit/869a6559b180d9a23bb092bcfaec0b371ddb4acf))


### Refactors

* rename qstub to downstash ([eea653b](https://github.com/sskcfC15Xfoxd7X1sVFgipdzMRAkP/downstash/commit/eea653be44c01a6956b62e7baa719d342048e941))
