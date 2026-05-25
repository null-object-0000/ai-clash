import {
  EditOutlined,
  LogoutOutlined,
  ShareAltOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Github, Google, Microsoft } from '@lobehub/icons'
import { App as AntApp, Avatar, Button, Input, Modal, Tag } from 'antd'
import type { Locale } from '../content'
import { logout, startGithubLogin, startGoogleLogin, startMicrosoftLogin, updateProfile, type SiteAuth } from '../app/auth'

const labels = {
  zh: {
    title: '账号管理',
    subtitle: '管理你的登录身份、公开分享和账号状态。',
    signedOutTitle: '登录后管理账号',
    signedOutDescription: '登录后可以管理公开分享链接，并在之后绑定更多三方登录方式。',
    loginGithub: '使用 GitHub 登录',
    loginGoogle: '使用 Google 登录',
    loginMicrosoft: '使用 Microsoft 登录',
    profile: '基本信息',
    editProfile: '编辑资料',
    displayName: '昵称',
    avatarUrl: '头像 URL',
    email: '邮箱',
    status: '账号状态',
    loginMethods: '登录方式',
    connected: '已绑定',
    comingSoon: '即将支持',
    signIn: '登录',
    shares: '公开分享',
    sharesEmpty: '分享列表接口尚未接入。生成公开分享后，这里将用于查看、复制和撤回你的分享链接。',
    logout: '退出登录',
    save: '保存',
    cancel: '取消',
    unknown: '未设置',
  },
  en: {
    title: 'Account',
    subtitle: 'Manage your login identities, public shares, and account status.',
    signedOutTitle: 'Sign in to manage your account',
    signedOutDescription: 'After signing in, you can manage public share links and connect more login providers later.',
    loginGithub: 'Sign in with GitHub',
    loginGoogle: 'Sign in with Google',
    loginMicrosoft: 'Sign in with Microsoft',
    profile: 'Profile',
    editProfile: 'Edit profile',
    displayName: 'Nickname',
    avatarUrl: 'Avatar URL',
    email: 'Email',
    status: 'Account status',
    loginMethods: 'Login methods',
    connected: 'Connected',
    comingSoon: 'Coming soon',
    signIn: 'Sign in',
    shares: 'Public shares',
    sharesEmpty: 'The share list API is not connected yet. This area will let you view, copy, and revoke your public share links.',
    logout: 'Log out',
    save: 'Save',
    cancel: 'Cancel',
    unknown: 'Not set',
  },
} satisfies Record<Locale, Record<string, string>>

export function AccountPage({ auth, locale }: { auth: SiteAuth; locale: Locale }) {
  const copy = labels[locale]
  const { message } = AntApp.useApp()
  const user = auth.state.authenticated ? auth.state.user : null

  const handleLogout = async () => {
    await logout()
    await auth.refresh()
  }

  if (!user) {
    return (
      <main className="account-page">
        <section className="account-shell account-shell--center">
          <div className="account-signin">
            <Avatar size={56} icon={<UserOutlined />} />
            <div>
              <h1>{copy.signedOutTitle}</h1>
              <p>{copy.signedOutDescription}</p>
            </div>
            <Button
              size="large"
              icon={<Github size={16} />}
              loading={auth.status === 'loading'}
              onClick={startGithubLogin}
            >
              {copy.loginGithub}
            </Button>
            <Button
              size="large"
              icon={<Google.Color size={16} />}
              loading={auth.status === 'loading'}
              onClick={startGoogleLogin}
            >
              {copy.loginGoogle}
            </Button>
            <Button
              size="large"
              icon={<Microsoft.Color size={16} />}
              loading={auth.status === 'loading'}
              onClick={startMicrosoftLogin}
            >
              {copy.loginMicrosoft}
            </Button>
          </div>
        </section>
      </main>
    )
  }

  const accountEmail = user.email || copy.unknown
  const displayName = user.displayName || ''
  const profileTitle = displayName || user.email || copy.unknown
  const identities = user.identities || []
  const githubIdentity = identities.find((identity) => identity.provider === 'github')
  const googleIdentity = identities.find((identity) => identity.provider === 'google')
  const microsoftIdentity = identities.find((identity) => identity.provider === 'microsoft')

  const openProfileEditor = () => {
    let nextDisplayName = displayName || ''
    let nextAvatarUrl = user.avatarUrl || ''

    Modal.confirm({
      title: copy.editProfile,
      okText: copy.save,
      cancelText: copy.cancel,
      content: (
        <div className="account-edit-form">
          <label>
            <span>{copy.displayName}</span>
            <Input defaultValue={nextDisplayName} maxLength={100} onChange={(event) => { nextDisplayName = event.target.value }} />
          </label>
          <label>
            <span>{copy.avatarUrl}</span>
            <Input defaultValue={nextAvatarUrl} maxLength={500} onChange={(event) => { nextAvatarUrl = event.target.value }} />
          </label>
          <label>
            <span>{copy.email}</span>
            <Input value={accountEmail} disabled />
          </label>
        </div>
      ),
      onOk: async () => {
        await updateProfile({ displayName: nextDisplayName, avatarUrl: nextAvatarUrl })
        await auth.refresh()
        message.success(copy.save)
      },
    })
  }

  return (
    <main className="account-page">
      <section className="account-shell">
        <div className="account-heading">
          <div>
            <h1>{copy.title}</h1>
            <p>{copy.subtitle}</p>
          </div>
          <Button icon={<LogoutOutlined />} onClick={handleLogout}>
            {copy.logout}
          </Button>
        </div>

        <div className="account-profile">
          <Avatar size={72} src={user.avatarUrl} icon={<UserOutlined />} />
          <div>
            <strong>{profileTitle}</strong>
            <span>{accountEmail}</span>
          </div>
          <Button icon={<EditOutlined />} onClick={openProfileEditor}>
            {copy.editProfile}
          </Button>
        </div>

        <div className="account-grid">
          <section className="account-panel">
            <h2>{copy.profile}</h2>
            <dl className="account-fields">
              <div>
                <dt>{copy.displayName}</dt>
                <dd>{displayName || copy.unknown}</dd>
              </div>
              <div>
                <dt>{copy.email}</dt>
                <dd>{accountEmail}</dd>
              </div>
              <div>
                <dt>{copy.status}</dt>
                <dd><Tag color={user.status === 'active' ? 'green' : 'blue'}>{user.status || copy.unknown}</Tag></dd>
              </div>
            </dl>
          </section>

          <section className="account-panel">
            <h2>{copy.loginMethods}</h2>
            <div className="account-provider-list">
              <div className={githubIdentity ? 'account-provider' : 'account-provider is-disabled'}>
                <Github size={20} />
                <div>
                  <strong>GitHub</strong>
                  <span>{githubIdentity?.providerDisplayName || githubIdentity?.providerLogin || githubIdentity?.providerEmail || copy.comingSoon}</span>
                </div>
                <Tag color={githubIdentity ? 'green' : undefined}>
                  {githubIdentity ? copy.connected : copy.comingSoon}
                </Tag>
              </div>
              <button
                className="account-provider account-provider--button"
                type="button"
                onClick={startGoogleLogin}
              >
                <Google.Color size={20} />
                <div>
                  <strong>Google</strong>
                  <span>{googleIdentity?.providerDisplayName || googleIdentity?.providerLogin || googleIdentity?.providerEmail || copy.loginGoogle}</span>
                </div>
                <Tag color={googleIdentity ? 'green' : undefined}>
                  {googleIdentity ? copy.connected : copy.signIn}
                </Tag>
              </button>
              <button
                className="account-provider account-provider--button"
                type="button"
                onClick={startMicrosoftLogin}
              >
                <Microsoft.Color size={20} />
                <div>
                  <strong>Microsoft</strong>
                  <span>{microsoftIdentity?.providerDisplayName || microsoftIdentity?.providerLogin || microsoftIdentity?.providerEmail || copy.loginMicrosoft}</span>
                </div>
                <Tag color={microsoftIdentity ? 'green' : undefined}>
                  {microsoftIdentity ? copy.connected : copy.signIn}
                </Tag>
              </button>
            </div>
          </section>

          <section className="account-panel account-panel--wide">
            <h2>{copy.shares}</h2>
            <div className="account-empty">
              <ShareAltOutlined />
              <p>{copy.sharesEmpty}</p>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}
