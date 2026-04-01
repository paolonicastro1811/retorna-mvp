import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface AuthUser {
  id: string
  email: string
  name: string | null
  restaurantId: string
  restaurantName: string
}

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  loading: boolean
  login: (token: string, user: AuthUser) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 < Date.now()
  } catch {
    return true
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // On mount: restore session from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token')
    const savedUser = localStorage.getItem('auth_user')

    if (savedToken && savedUser) {
      if (!isTokenExpired(savedToken)) {
        setToken(savedToken)
        try {
          const parsed = JSON.parse(savedUser) as AuthUser
          setUser(parsed)
          // Keep restaurantId/name in sync for backward compatibility
          localStorage.setItem('restaurantId', parsed.restaurantId)
          localStorage.setItem('restaurantName', parsed.restaurantName)
        } catch {
          // Corrupted data — clear
          localStorage.removeItem('auth_token')
          localStorage.removeItem('auth_user')
        }
      } else {
        // Token expired — clear
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
      }
    }
    setLoading(false)
  }, [])

  const login = (newToken: string, newUser: AuthUser) => {
    setToken(newToken)
    setUser(newUser)
    localStorage.setItem('auth_token', newToken)
    localStorage.setItem('auth_user', JSON.stringify(newUser))
    // Backward compatibility
    localStorage.setItem('restaurantId', newUser.restaurantId)
    localStorage.setItem('restaurantName', newUser.restaurantName)
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    localStorage.removeItem('restaurantId')
    localStorage.removeItem('restaurantName')
    localStorage.removeItem('restaurantPlan')
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/** Returns the current restaurantId — reactive to AuthContext, falls back to localStorage */
export function useRestaurantId(): string {
  const { user } = useAuth()
  return user?.restaurantId || localStorage.getItem('restaurantId') || ''
}
