import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, FormField } from '../components/UI'
import { useAuth } from '../auth/context'

export function AuthPage({ mode }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signIn, register, verifyEmail, resendVerification, requestPasswordReset, completePasswordReset, status, backendError } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '', workspaceName: '' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorCode, setErrorCode] = useState('')
  const [verified, setVerified] = useState(false)
  const isRegister = mode === 'register'
  const isVerify = mode === 'verify'
  const isForgot = mode === 'forgot'
  const isReset = mode === 'reset'
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setErrorCode('')
    setNotice('')
    setSubmitting(true)
    try {
      if (isVerify) {
        const token = searchParams.get('token') || ''
        if (!token) throw new Error('This verification link is missing its token.')
        await verifyEmail(token)
        setVerified(true)
      } else if (isForgot) {
        const result = await requestPasswordReset(form.email)
        setNotice(result.notice)
      } else if (isReset) {
        const token = searchParams.get('token') || ''
        if (!token) throw new Error('This password reset link is missing its token.')
        await completePasswordReset(token, form.password)
        setVerified(true)
      } else if (isRegister) {
        const message = await register(form)
        setNotice(message || 'Account created. Email verification is required before workspace access.')
      } else {
        const signedIn = await signIn({ email: form.email, password: form.password })
        if (!signedIn) {
          setNotice('Your email address is not verified. Email verification delivery is not configured yet; contact the workspace administrator.')
        } else {
          navigate('/', { replace: true })
        }
      }
    } catch (submitError) {
      setError(submitError.message || 'The request could not be completed.')
      setErrorCode(submitError.code || '')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link className="auth-brand" to="/">HireFlow</Link>
        <h1>{isVerify ? 'Verify your email' : isRegister ? 'Create your workspace' : isForgot ? 'Recover your password' : isReset ? 'Set a new password' : 'Sign in to HireFlow'}</h1>
        <p className="auth-subtitle">{isVerify ? 'Confirm your address to activate account access.' : isRegister ? 'Create an owner account for your recruitment workspace.' : isForgot ? 'We will send a secure reset link if the account exists.' : isReset ? 'Choose a new password for your HireFlow account.' : 'Use your verified account to continue.'}</p>
        {status === 'unavailable' && <p className="form-error" role="alert">{backendError} Start the API and configure PostgreSQL to enable account access.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="auth-notice" role="status">{notice}</p>}
        {verified ? <div className="auth-notice" role="status">{isReset ? 'Password updated. You can now ' : 'Email verified. You can now '}<Link to="/login">sign in</Link>.</div> : <form className="modal-form" onSubmit={submit}>
          {isRegister && <>
            <FormField label="Full name"><input autoComplete="name" value={form.name} onChange={(event) => update('name', event.target.value)} required /></FormField>
            <FormField label="Workspace name"><input autoComplete="organization" value={form.workspaceName} onChange={(event) => update('workspaceName', event.target.value)} required /></FormField>
          </>}
          {!isVerify && !isReset && <FormField label="Email"><input type="email" autoComplete="email" value={form.email} onChange={(event) => update('email', event.target.value)} required /></FormField>}
          {!isVerify && !isForgot && <FormField label="Password"><input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={form.password} onChange={(event) => update('password', event.target.value)} required /></FormField>}
          <Button type="submit" disabled={submitting || status === 'checking'}>{submitting ? 'Working…' : isVerify ? 'Verify email' : isRegister ? 'Create account' : isForgot ? 'Send reset link' : isReset ? 'Update password' : 'Sign in'}</Button>
        </form>}
        {errorCode === 'EMAIL_VERIFICATION_REQUIRED' && <Button variant="secondary" disabled={submitting} onClick={async () => { setSubmitting(true); setError(''); try { const result = await resendVerification(form.email); setNotice(result.notice) } catch (resendError) { setError(resendError.message || 'Could not resend verification email.') } finally { setSubmitting(false) } }}>Resend verification email</Button>}
        {!isVerify && !isReset && <p className="auth-switch">{isForgot ? 'Remembered your password?' : isRegister ? 'Already registered?' : 'New to HireFlow?'} <Link to={isForgot || isRegister ? '/login' : '/register'}>{isForgot || isRegister ? 'Sign in' : 'Create an account'}</Link>{!isRegister && !isForgot && <> · <Link to="/forgot-password">Forgot password?</Link></>}</p>}
      </section>
    </main>
  )
}