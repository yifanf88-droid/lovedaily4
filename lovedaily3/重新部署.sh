#!/bin/bash
# ============================================================================
# 念念日程 · Dark 完整版 — 一键重新部署到 Cloudflare Pages
# 用法: bash 重新部署.sh   (或在终端里直接执行本文件)
# ============================================================================
set -e
cd "$(dirname "$0")"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  念念日程 Dark 完整版 · Cloudflare Pages 重新部署"
echo "═══════════════════════════════════════════════════════"
echo ""

# 1. 登录
echo "▶ [1/3] 登录 Cloudflare（首次会弹出浏览器授权窗口）"
npx wrangler@latest login

# 2. 确认项目名
echo ""
echo "▶ [2/3] 你的 Cloudflare Pages 项目列表："
npx wrangler@latest pages project list
echo ""
echo "  注意: 你的地址是 894c16cd.lovedaliy.pages.dev"
echo "  项目名 = 地址第一段(通常是 894c16cd)，以列表显示为准"
read -rp "  输入要部署到的项目名: " PROJ
[ -n "$PROJ" ] || PROJ="894c16cd"

# 3. 部署
echo ""
echo "▶ [3/3] 部署 $PROJ ..."
npx wrangler@latest pages deploy . --project-name="$PROJ"
echo ""
echo "✅ 部署完成！"
echo ""
echo "───────────────────────────────────────────────────────"
echo "  ⚠ 手机端旧缓存清理（必须做，否则看到的还是旧页面）:"
echo "   1. 主屏幕长按「念念日程」图标 → 删除 App"
echo "   2. Safari 重新打开: https://894c16cd.lovedaliy.pages.dev/"
echo "   3. 分享 → 添加到主屏幕，重新安装"
echo "   4. 进「我的」页重新授权定位/通知"
echo "───────────────────────────────────────────────────────"
