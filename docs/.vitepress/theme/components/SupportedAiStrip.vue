<script setup lang="ts">
const providers = [
  {
    name: 'DeepSeek',
    href: 'https://chat.deepseek.com/',
    icon: 'https://registry.npmmirror.com/@lobehub/icons-static-svg/latest/files/icons/deepseek-color.svg',
  },
  {
    name: '豆包',
    href: 'https://www.doubao.com/chat/',
    icon: 'https://registry.npmmirror.com/@lobehub/icons-static-svg/latest/files/icons/doubao-color.svg',
  },
  {
    name: '通义千问',
    href: 'https://www.qianwen.com/',
    icon: 'https://registry.npmmirror.com/@lobehub/icons-static-svg/latest/files/icons/qwen-color.svg',
  },
  {
    name: '腾讯元宝',
    href: 'https://yuanbao.tencent.com/chat/',
    icon: 'https://registry.npmmirror.com/@lobehub/icons-static-svg/latest/files/icons/yuanbao-color.svg',
  },
  {
    name: '文心一言',
    href: 'https://yiyan.baidu.com/chat/',
    icon: 'https://registry.npmmirror.com/@lobehub/icons-static-svg/latest/files/icons/wenxin-color.svg',
  },
  {
    name: 'Xiaomi MIMO',
    href: 'https://aistudio.xiaomimimo.com/#/c',
    icon: 'https://registry.npmmirror.com/@lobehub/icons-static-svg/latest/files/icons/xiaomimimo.svg',
  },
]
</script>

<template>
  <div class="supported-ai-strip" aria-label="已支持的 AI">
    <a
      v-for="provider in providers"
      :key="provider.name"
      class="supported-ai-strip__item"
      :href="provider.href"
      target="_blank"
      rel="noreferrer"
      :title="provider.name"
    >
      <img :src="provider.icon" :alt="provider.name" width="30" height="30" loading="lazy">
    </a>
  </div>
</template>
