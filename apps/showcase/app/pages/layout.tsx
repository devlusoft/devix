import { Title } from '@devlusoft/devix/head'
import type { RouteSectionProps } from '@solidjs/router'
import { A } from '@solidjs/router'

export default function AppLayout(props: RouteSectionProps) {
  return (
    <div class="flex min-h-screen">
      <Title>Devix Task Manager</Title>
      <aside class="w-56 bg-gray-900 text-white p-6">
        <h1 class="text-xl font-semibold mb-6">Devix Tasks</h1>
        <nav class="flex flex-col gap-3">
          <A
            href="/"
            class="text-gray-300 hover:text-white"
            activeClass="text-white font-medium"
            end
          >
            Dashboard
          </A>
          <A
            href="/projects"
            class="text-gray-300 hover:text-white"
            activeClass="text-white font-medium"
          >
            Projects
          </A>
          <A
            href="/tasks"
            class="text-gray-300 hover:text-white"
            activeClass="text-white font-medium"
          >
            Tasks
          </A>
          <A
            href="/admin"
            class="text-gray-300 hover:text-white"
            activeClass="text-white font-medium"
          >
            Admin
          </A>
        </nav>
      </aside>
      <main class="flex-1 p-6">{props.children}</main>
    </div>
  )
}
