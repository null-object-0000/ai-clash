import type { ComponentType, CSSProperties } from 'react'
import { ChromeFilled, DownloadOutlined } from '@ant-design/icons'
import { Button, Card, Tooltip } from 'antd'
import { DeepSeek, Doubao, Qwen, Yuanbao, XiaomiMiMo, Wenxin } from '@lobehub/icons'
import { homePages } from '../content'
import type { Locale } from '../content'
import { assetPath, withBasePath } from '../app/paths'

type AiIcon = ComponentType<{ size?: number | string; className?: string; style?: CSSProperties }>

const aiProviders = [
  { name: 'DeepSeek', href: 'https://chat.deepseek.com/', Icon: DeepSeek.Color as AiIcon },
  { name: '豆包', href: 'https://www.doubao.com/chat/', Icon: Doubao.Color as AiIcon },
  { name: '通义千问', href: 'https://www.qianwen.com/', Icon: Qwen.Color as AiIcon },
  { name: '腾讯元宝', href: 'https://yuanbao.tencent.com/chat/', Icon: Yuanbao.Color as AiIcon },
  { name: '文心一言', href: 'https://yiyan.baidu.com/chat/', Icon: Wenxin.Color as AiIcon },
  { name: 'Xiaomi MIMO', href: 'https://aistudio.xiaomimimo.com/#/c', Icon: XiaomiMiMo as AiIcon },
] satisfies Array<{ name: string; href: string; Icon: AiIcon }>

function EdgeIcon() {
  return <img className="browser-icon edge-browser-icon" src={assetPath('/edge.svg')} alt="" aria-hidden="true" />
}

function getActionIcon(kind: string) {
  if (kind.includes('chrome')) return <ChromeFilled className="browser-icon chrome-icon" />
  if (kind.includes('edge')) return <EdgeIcon />
  return <DownloadOutlined />
}

export function HomePage({ locale }: { locale: Locale }) {
  const content = homePages[locale]

  return (
    <main className="home">
      <section className="hero">
        <div className="hero-copy">
          <h1>{content.name}</h1>
          <p className="hero-text">{content.text}</p>
          <p className="tagline">{content.tagline}</p>
          <div className="actions">
            {content.actions.map((action) => (
              <Button
                key={action.href}
                className={`button ${action.kind}`}
                href={withBasePath(action.href)}
                icon={getActionIcon(action.kind)}
                size="large"
                type={action.kind.includes('brand') ? 'primary' : 'default'}
              >
                {action.label}
              </Button>
            ))}
          </div>

          <div className="supported-ai-strip" aria-label={locale === 'zh' ? '已支持的 AI' : 'Supported AI'}>
            {aiProviders.map(({ name, href, Icon }) => (
              <Tooltip key={name} title={name}>
                <a
                  className="supported-ai-strip__item"
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  title={name}
                  aria-label={name}
                >
                  <Icon size={30} />
                </a>
              </Tooltip>
            ))}
          </div>
        </div>
        <div className="hero-logo">
          <img src={assetPath('/logo.png')} alt={content.logoAlt} />
        </div>
      </section>

      <section className="features" aria-label={locale === 'zh' ? '功能亮点' : 'Features'}>
        {content.features.map((feature) => (
          <Card className="feature" key={feature.title} variant="borderless">
            <h2>{feature.title}</h2>
            <p>{feature.details}</p>
          </Card>
        ))}
      </section>

      <div className="demo">
        <img src={assetPath('/动画.gif')} alt={content.demoAlt} />
      </div>
    </main>
  )
}
