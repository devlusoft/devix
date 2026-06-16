import { Title } from '@devlusoft/devix/head'
import { A, createAsync } from '@solidjs/router'
import { For, Show, Suspense } from 'solid-js'
import { getProjects, getTasks } from '../data/store'

export default function DashboardPage() {
  const projects = createAsync(() => getProjects())
  const tasks = createAsync(() => getTasks())

  const pendingTasks = () => (tasks() ?? []).filter((t) => t.status !== 'done').length
  const doneTasks = () => (tasks() ?? []).filter((t) => t.status === 'done').length

  return (
    <div>
      <Title>Dashboard - Devix Showcase</Title>
      <h1 class="text-2xl font-semibold mb-4">Dashboard</h1>
      <Suspense fallback={<p class="text-gray-500">Loading…</p>}>
        <div class="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="Projects" value={(projects() ?? []).length} />
          <StatCard label="Pending tasks" value={pendingTasks()} />
          <StatCard label="Done tasks" value={doneTasks()} />
        </div>

        <h2 class="text-lg font-medium mb-3">Recent projects</h2>
        <Show
          when={(projects() ?? []).length > 0}
          fallback={
            <p>
              No projects yet.{' '}
              <A href="/projects/new" class="text-blue-600 hover:underline">
                Create one
              </A>
              .
            </p>
          }
        >
          <ul class="flex flex-col gap-2">
            <For each={projects()?.slice(0, 5)}>
              {(p) => (
                <li class="bg-white rounded-lg shadow-sm p-4">
                  <A href={`/projects/${p.id}`} class="font-medium text-blue-600 hover:underline">
                    {p.name}
                  </A>
                  <p class="text-sm text-gray-500 mt-1">{p.description}</p>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </Suspense>
    </div>
  )
}

function StatCard(props: { label: string; value: number }) {
  return (
    <div class="bg-white rounded-lg shadow-sm p-4">
      <div class="text-3xl font-bold text-gray-900">{props.value}</div>
      <div class="text-sm text-gray-500">{props.label}</div>
    </div>
  )
}
