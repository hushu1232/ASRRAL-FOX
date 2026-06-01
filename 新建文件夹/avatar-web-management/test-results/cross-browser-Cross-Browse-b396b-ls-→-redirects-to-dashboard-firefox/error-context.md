# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cross-browser.spec.ts >> Cross-Browser E2E >> 2. Login Flow >> Login with valid credentials → redirects to dashboard
- Location: e2e\cross-browser.spec.ts:84:9

# Error details

```
Test timeout of 60000ms exceeded.
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - img "星尘" [ref=e6]
        - heading "虚拟形象管理平台" [level=1] [ref=e7]
        - paragraph [ref=e8]: Avatar Management System
      - generic [ref=e9]:
        - heading "欢迎回来" [level=2] [ref=e10]
        - generic [ref=e11]:
          - generic [ref=e17]:
            - img "mail" [ref=e19]:
              - img [ref=e20]
            - textbox "邮箱地址" [ref=e22]
          - generic [ref=e28]:
            - img "lock" [ref=e30]:
              - img [ref=e31]
            - textbox "密码" [ref=e33]
            - button "Show" [ref=e35] [cursor=pointer]:
              - img "eye-invisible" [ref=e36]:
                - img [ref=e37]
          - button "登 录" [ref=e45] [cursor=pointer]:
            - generic [ref=e46]: 登 录
          - generic [ref=e47]:
            - link "还没有账号？立即注册" [ref=e48] [cursor=pointer]:
              - /url: /register
            - link "忘记密码？" [ref=e49] [cursor=pointer]:
              - /url: /forgot-password
        - separator [ref=e50]:
          - generic [ref=e52]: 或
        - button "bank 企业 SSO 登录" [ref=e54] [cursor=pointer]:
          - img "bank" [ref=e56]:
            - img [ref=e57]
          - generic [ref=e59]: 企业 SSO 登录
      - paragraph [ref=e60]: 仅支持邮箱/用户名+密码登录，以及企业SSO
    - generic [ref=e62]:
      - paragraph [ref=e63]:
        - text: We use essential cookies for authentication and language preferences. No tracking or advertising cookies.
        - link "Privacy Policy" [ref=e64] [cursor=pointer]:
          - /url: /privacy
      - generic [ref=e65]:
        - button "Reject Optional" [ref=e66] [cursor=pointer]:
          - generic [ref=e67]: Reject Optional
        - button "Accept" [ref=e68] [cursor=pointer]:
          - generic [ref=e69]: Accept
  - button "Open Next.js Dev Tools" [ref=e75] [cursor=pointer]:
    - img [ref=e76]
  - alert [ref=e80]
```