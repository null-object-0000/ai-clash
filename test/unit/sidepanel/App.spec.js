import { mount } from '@vue/test-utils'
import { expect, test } from 'vitest'
import App from '@/sidepanel/App.vue'

test('侧边栏App组件正常渲染不报错', () => {
  const wrapper = mount(App, {
    global: {
      stubs: {
        // 按需mock不需要测试的子组件
      }
    }
  })

  // 验证根容器存在
  expect(wrapper.find('#app').exists()).toBe(true)
  // 验证没有控制台错误（Vitest会自动捕获未处理错误）
})

test('深度思考开关初始状态正确', () => {
  const wrapper = mount(App)
  // 可以测试响应式状态、UI交互等
  const deepThinkingBtn = wrapper.find('[data-testid="deep-thinking-toggle"]')
  // 如果有这个元素的话可以验证状态
})
