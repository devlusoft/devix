import { Meta, Title } from '@devlusoft/devix/head'
import { Link } from '@devlusoft/devix/router'

export default function AdminPage() {
  return (
    <div>
      <Title>Admin - Devix Showcase</Title>
      <Meta name="description" content="Admin page for Devix showcase" />
      <h1 class="text-2xl font-semibold mb-4">Admin</h1>
      <p class="text-gray-700 mb-4">This page is protected by route middleware.</p>
      <Link href="/" class="text-blue-600 hover:underline">
        Back to dashboard
      </Link>
    </div>
  )
}
