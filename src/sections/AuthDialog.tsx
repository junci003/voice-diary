import { useState } from 'react'
import { UserRound } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { login, register, validatePassword, validateUsername } from '@/lib/auth'

export default function AuthDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSuccess: (username: string) => void
}) {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setUsername('')
    setPassword('')
    setConfirm('')
    setError(null)
  }

  const submit = async () => {
    setError(null)
    const nameErr = validateUsername(username)
    if (nameErr) return setError(nameErr)
    const pwErr = validatePassword(password)
    if (pwErr) return setError(pwErr)
    if (tab === 'register' && password !== confirm) return setError('两次输入的密码不一致')

    setBusy(true)
    try {
      if (tab === 'register') await register(username, password)
      else await login(username, password)
      onSuccess(username)
      onOpenChange(false)
      reset()
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) reset()
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRound className="w-5 h-5 text-primary" />
            账号
          </DialogTitle>
          <DialogDescription>
            当前为本地账号，数据保存在本机；后续接入云端后可同步日记。
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => { setTab(v as 'login' | 'register'); setError(null) }}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="login">登录</TabsTrigger>
            <TabsTrigger value="register">注册</TabsTrigger>
          </TabsList>

          <div className="space-y-3 mt-4">
            <div className="space-y-1.5">
              <Label htmlFor="auth-username">用户名</Label>
              <Input
                id="auth-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="2-20 位中英文、数字或下划线"
                autoComplete="username"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auth-password">密码</Label>
              <Input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 6 位"
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                onKeyDown={(e) => e.key === 'Enter' && tab === 'login' && submit()}
              />
            </div>
            <TabsContent value="register" className="mt-0 space-y-1.5">
              <Label htmlFor="auth-confirm">确认密码</Label>
              <Input
                id="auth-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="再输入一次密码"
                autoComplete="new-password"
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
            </TabsContent>
          </div>

          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

          <Button className="w-full mt-4" disabled={busy} onClick={submit}>
            {busy ? '处理中…' : tab === 'login' ? '登录' : '注册并登录'}
          </Button>
        </Tabs>

        <p className="text-xs text-muted-foreground text-center mt-2">
          不登录也可以直接录音写日记，数据会保存在游客空间
        </p>
      </DialogContent>
    </Dialog>
  )
}
