# AstralFox 支付商户接入指南

> 本文档指导运营和开发团队绑定真实的微信支付、支付宝、Stripe 商户号。

---

## 总览

AstralFox 支持三种支付渠道：

| 渠道 | 适用场景 | 费率 | 结算周期 |
|------|----------|------|----------|
| **微信支付** | 中国大陆用户 | 0.6% | T+1 |
| **支付宝** | 中国大陆用户 | 0.6% | T+1 |
| **Stripe** | 国际用户 + 聚合微信/支付宝 | 2.9%+$0.30 | T+7 |

推荐中国大陆业务使用**微信支付 + 支付宝**直连（费率低），海外业务使用 **Stripe**。

---

## 第一步：微信支付商户号申请

### 1.1 注册微信支付商户

1. 访问 [微信支付商户平台](https://pay.weixin.qq.com/)
2. 点击「接入微信支付」→ 注册账号
3. 提交企业资料：营业执照、法人身份证、对公账户
4. 审核通过后获取：**商户号 (MchID)**

### 1.2 获取 API 密钥

1. 登录商户平台 → 账户中心 → API 安全
2. 设置 **APIv3 密钥**（32位随机字符串，妥善保管）
3. 下载 **商户证书**（apiclient_cert.pem）

### 1.3 配置开发参数

```bash
# .env.local 添加
WECHAT_APP_ID=wx1234567890abcdef     # 微信公众号/小程序 AppID
WECHAT_MCH_ID=1234567890             # 商户号
WECHAT_API_V3_KEY=your_32_byte_key   # APIv3 密钥
WECHAT_PRIVATE_KEY=$(cat apiclient_key.pem)  # 商户私钥 (PEM)
WECHAT_CERT_SERIAL_NO=ABCD1234       # 证书序列号
WECHAT_NOTIFY_URL=https://your-domain.com/api/webhooks/payment
```

### 1.4 管理后台配置

1. 登录 AstralFox → 管理后台 → 支付管理
2. 选择「微信支付」标签
3. 点击「添加配置」
4. 填入上述参数，选择「沙箱测试」模式
5. 点击「测试」验证连通性
6. 测试通过后切换为「生产环境」

### 1.5 沙箱测试

微信提供沙箱环境用于测试：

```
沙箱 AppID: wx1234567890abcdef（同生产）
沙箱密钥: 在商户平台 → API 安全 → 申请沙箱API密钥
沙箱模式: mode=sandbox
```

测试步骤：
1. 创建 ￥0.01 订单
2. 用微信扫描生成的二维码
3. 确认支付
4. 检查 webhook 回调是否收到
5. 验证订单状态从 pending → paid

---

## 第二步：支付宝商户号申请

### 2.1 注册支付宝商户

1. 访问 [支付宝开放平台](https://open.alipay.com/)
2. 注册企业账号 → 提交企业资质
3. 创建应用 → 获取 **AppID**
4. 签约产品：**电脑网站支付**、**手机网站支付**

### 2.2 生成密钥

```bash
# 生成 RSA2 密钥对
openssl genrsa -out app_private_key.pem 2048
openssl rsa -in app_private_key.pem -pubout -out app_public_key.pem
```

### 2.3 配置密钥

1. 支付宝开放平台 → 我的应用 → 应用信息 → 开发设置
2. 上传 `app_public_key.pem` 内容到「应用公钥」
3. 支付宝生成 **支付宝公钥**，保存下来

### 2.4 配置开发参数

```bash
# .env.local 添加
ALIPAY_APP_ID=2021001234567890
ALIPAY_PRIVATE_KEY=$(cat app_private_key.pem)
ALIPAY_PUBLIC_KEY=$(cat alipay_public_key.pem)  # 支付宝返回的公钥
ALIPAY_NOTIFY_URL=https://your-domain.com/api/webhooks/payment
```

### 2.5 沙箱测试

支付宝提供独立沙箱环境：

1. 访问 https://openhome.alipay.com/develop/sandbox/app
2. 获取沙箱 AppID、沙箱网关地址
3. 下载沙箱版支付宝 App 扫码测试

---

## 第三步：Stripe 商户配置（国际 + 聚合）

### 3.1 注册 Stripe

1. 访问 [Stripe Dashboard](https://dashboard.stripe.com/register)
2. 注册企业账号（需海外主体或香港主体）
3. 获取 **Publishable Key** 和 **Secret Key**
4. 激活微信支付和支付宝（在 Stripe Dashboard → Settings → Payment Methods）

### 3.2 配置 Webhook

```bash
# Stripe Dashboard → Developers → Webhooks
# Endpoint: https://your-domain.com/api/webhooks/payment
# Events: payment_intent.succeeded, payment_intent.payment_failed
```

```bash
# .env.local
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx
PAYMENT_PROVIDER=stripe
```

---

## 第四步：切换生产环境

### 安全检查清单

| 检查项 | 微信支付 | 支付宝 | Stripe |
|--------|----------|--------|--------|
| 商户号已验证 | ✓ | ✓ | ✓ |
| 回调 URL 可公网访问 | ✓ | ✓ | ✓ |
| HTTPS 证书有效 | ✓ | ✓ | ✓ |
| Webhook 签名验证开启 | ✓ | ✓ | ✓ |
| 沙箱测试通过 | ✓ | ✓ | ✓ |
| 退款流程验证 | ✓ | ✓ | ✓ |
| 日志/监控就绪 | ✓ | ✓ | ✓ |

### 切换步骤

1. 管理后台 → 支付管理
2. 编辑配置 → 模式从「沙箱」切换为「生产」
3. 激活开关打开
4. 创建 ￥1.00 真实订单测试全流程
5. 确认资金到账

---

## 附录：常见问题

**Q: 微信支付 Native 和 JSAPI 有什么区别？**  
A: Native 用于 PC 端（展示二维码），JSAPI 用于微信内浏览器（直接调起支付）。

**Q: 支付宝如何测试退款？**  
A: 沙箱环境下创建订单 → 登录沙箱支付宝 App 支付 → 调用退款 API → 检查沙箱余额。

**Q: 多个商户主体如何管理？**  
A: 每个 provider+mode 组合创建一条 PaymentGatewayConfig 记录，通过 isActive 开关控制使用哪个。

**Q: 证书/密钥安全如何保障？**  
A: 生产环境使用环境变量注入（K8s Secret / Vault），不存储在代码仓库中。数据库存储需加密。
