import { useNavigate } from '@solidjs/router'
import { SESSION_COOKIE } from '../../lib/auth'

export default function LoginPage() {
  const navigate = useNavigate()

  const login = () => {
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString()
    // biome-ignore lint/suspicious/noDocumentCookie: showcase uses simple cookie auth
    document.cookie = `${SESSION_COOKIE}=1; path=/; expires=${expires}`
    navigate('/admin')
  }

  return (
    <div class="max-w-sm mx-auto mt-20">
      <h1 class="text-2xl font-semibold mb-4">Login</h1>
      <p class="text-gray-700 mb-6">Click the button below to simulate authentication.</p>
      <button
        type="button"
        onClick={login}
        class="w-full bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700"
      >
        Sign in
      </button>
    </div>
  )
}
