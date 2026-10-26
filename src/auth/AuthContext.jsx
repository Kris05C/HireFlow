import { useEffect, useState } from 'react'
import { apiRequest, clearCsrfToken } from '../api/client'
import { AuthContext } from './context'

const authRequired = import.meta.env.VITE_REQUIRE_AUTH === 'true'

export function AuthProvider({ children }) {
  const [status, setStatus] = useState(authRequired ? 'checking' : 'local')
  const [profile, setProfile] = useState(null)
  const [workspaceRole, setWorkspaceRole] = useState('')
  const [backendError, setBackendError] = useState('')

  const refreshSession = async () => {
    try {
      const result = await apiRequest('/auth/me')
      if (!result.user) {
        setProfile(null)
        setWorkspaceRole('')
        setStatus('anonymous')
        return
      }
      if (!result.user.emailVerified) {
        setProfile(result.user)
        setWorkspaceRole(result.workspace?.role || '')
        setStatus('unverified')
        return
      }
      setProfile({
        name: result.user.name,
        email: result.user.email,
        role: result.user.role || '',
        company: result.workspace?.name || '',
      })
      setWorkspaceRole(result.workspace?.role || '')
      setBackendError('')
      setStatus('authenticated')
    } catch {
      setProfile(null)
      setStatus('unavailable')
      setBackendError('The authentication server could not be reached.')
    }
  }

  useEffect(() => {
    if (!authRequired) return undefined
    let active = true
    apiRequest('/auth/me')
      .then((result) => {
        if (!active) return
        if (!result.user) {
          setProfile(null)
          setWorkspaceRole('')
          setStatus('anonymous')
          return
        }
        if (!result.user.emailVerified) {
          setProfile(result.user)
          setWorkspaceRole(result.workspace?.role || '')
          setStatus('unverified')
          return
        }
        setProfile({
          name: result.user.name,
          email: result.user.email,
          role: result.user.role || '',
          company: result.workspace?.name || '',
        })
        setWorkspaceRole(result.workspace?.role || '')
        setBackendError('')
        setStatus('authenticated')
      })
      .catch(() => {
        if (!active) return
        setProfile(null)
        setStatus('unavailable')
        setBackendError('The authentication server could not be reached.')
      })
    return () => { active = false }
  }, [])

  const signIn = async (credentials) => {
    const result = await apiRequest('/auth/login', { method: 'POST', body: credentials })
    if (!result.user?.emailVerified) {
      await refreshSession()
      return false
    }
    await refreshSession()
    return true
  }

  const register = async (details) => {
    const result = await apiRequest('/auth/register', { method: 'POST', body: details })
    await refreshSession()
    return result.notice
  }

  const signOut = async () => {
    await apiRequest('/auth/logout', { method: 'POST' })
    clearCsrfToken()
    setProfile(null)
    setWorkspaceRole('')
    setStatus('anonymous')
  }

  const verifyEmail = async (token) => apiRequest('/auth/verify-email', { method: 'POST', body: { token } })
  const resendVerification = async (email) => apiRequest('/auth/verification/resend', { method: 'POST', body: { email } })

  const saveProfile = async (nextProfile) => {
    const result = await apiRequest('/workspace/profile', {
      method: 'PATCH',
      body: { name: nextProfile.name, role: nextProfile.role, company: nextProfile.company },
    })
    setProfile(result.profile)
    return result.profile
  }

  return (
    <AuthContext.Provider value={{ authRequired, status, profile, workspaceRole, backendError, signIn, register, signOut, saveProfile, verifyEmail, resendVerification }}>
      {children}
    </AuthContext.Provider>
  )
}
