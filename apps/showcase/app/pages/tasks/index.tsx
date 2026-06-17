import { Link } from '@devlusoft/devix/router'
import { createAsync } from '@solidjs/router'
import { For, Show, Suspense } from 'solid-js'
import { deleteTask, getProjects, getTasks } from '../../data/store'

export default function TasksPage() {
  const tasks = createAsync(() => getTasks())
  const projects = createAsync(() => getProjects())

  function projectName(projectId: string) {
    return projects()?.find((p) => p.id === projectId)?.name ?? 'Unknown'
  }

  return (
    <div>
      <h1 class="text-2xl font-semibold mb-4">Tasks</h1>
      <Suspense fallback={<p class="text-gray-500">Loading tasks…</p>}>
        <Show
          when={(tasks() ?? []).length > 0}
          fallback={<p class="text-gray-500">No tasks yet.</p>}
        >
          <div class="bg-white rounded-lg shadow-sm overflow-hidden">
            <table class="w-full text-left text-sm">
              <thead class="bg-gray-50 border-b">
                <tr>
                  <th class="px-4 py-3 font-medium text-gray-700">Title</th>
                  <th class="px-4 py-3 font-medium text-gray-700">Project</th>
                  <th class="px-4 py-3 font-medium text-gray-700">Assignee</th>
                  <th class="px-4 py-3 font-medium text-gray-700">Status</th>
                  <th class="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                <For each={tasks()}>
                  {(t) => (
                    <tr class="border-b last:border-b-0">
                      <td class="px-4 py-3">
                        <Link href={`/tasks/${t.id}`} class="text-blue-600 hover:underline">
                          {t.title}
                        </Link>
                      </td>
                      <td class="px-4 py-3 text-gray-600">{projectName(t.projectId)}</td>
                      <td class="px-4 py-3 text-gray-600">{t.assignee}</td>
                      <td class="px-4 py-3">
                        <StatusBadge status={t.status} />
                      </td>
                      <td class="px-4 py-3">
                        <div class="flex gap-2">
                          <Link href={`/tasks/${t.id}/edit`} class="button secondary">
                            Edit
                          </Link>
                          <DeleteButton id={t.id} />
                        </div>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
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

function DeleteButton(props: { id: string }) {
  async function handleDelete() {
    if (!confirm('Delete this task?')) return
    await deleteTask(props.id)
    window.location.href = '/tasks'
  }

  return (
    <button type="button" class="danger" onClick={handleDelete}>
      Delete
    </button>
  )
}
