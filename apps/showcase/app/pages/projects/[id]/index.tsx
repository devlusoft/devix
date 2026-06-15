import { A, createAsync, useParams } from '@solidjs/router'
import { For, Show, Suspense } from 'solid-js'
import { getProject, getTasks } from '../../../data/store'

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>()
  const project = createAsync(() => getProject(params.id), { deferStream: true })
  const tasks = createAsync(() => getTasks(params.id), { deferStream: true })

  return (
    <div>
      <Suspense fallback={<p class="text-gray-500">Loading project…</p>}>
        <Show
          when={project()}
          fallback={
            <p>
              Project not found. <A href="/projects" class="text-blue-600 hover:underline">← back</A>
            </p>
          }
        >
          {(p) => (
            <>
              <div class="flex justify-between items-start mb-4">
                <div>
                  <h1 class="text-2xl font-semibold">{p().name}</h1>
                  <p class="text-gray-500 mt-1">{p().description}</p>
                </div>
                <div class="flex gap-2">
                  <A href={`/projects/${p().id}/edit`} class="button secondary">Edit</A>
                  <A href={`/projects/${p().id}/tasks/new`} class="button">New task</A>
                </div>
              </div>

              <h2 class="text-lg font-medium mb-3">Tasks</h2>
              <Suspense fallback={<p class="text-gray-500">Loading tasks…</p>}>
                <Show when={(tasks() ?? []).length > 0} fallback={<p class="text-gray-500">No tasks yet. <A href={`/projects/${p().id}/tasks/new`} class="text-blue-600 hover:underline">Create one</A>.</p>}>
                  <ul class="flex flex-col gap-2">
                    <For each={tasks()}>
                      {(t) => (
                        <li class="bg-white rounded-lg shadow-sm p-3 flex justify-between items-center">
                          <A href={`/tasks/${t.id}`} class="text-blue-600 hover:underline">{t.title}</A>
                          <StatusBadge status={t.status} />
                        </li>
                      )}
                    </For>
                  </ul>
                </Show>
              </Suspense>
            </>
          )}
        </Show>
      </Suspense>
    </div>
  )
}

function StatusBadge(props: { status: 'todo' | 'in-progress' | 'done' }) {
  const styles = {
    todo: 'bg-gray-100 text-gray-700',
    'in-progress': 'bg-blue-100 text-blue-800',
    done: 'bg-green-100 text-green-800',
  }
  return (
    <span class={`text-xs font-semibold uppercase px-2 py-1 rounded-full ${styles[props.status]}`}>
      {props.status}
    </span>
  )
}
