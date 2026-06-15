import { createAsync, useNavigate, useParams } from '@solidjs/router'
import { For, Show, Suspense } from 'solid-js'
import { getProjects, getTask, updateTask } from '../../../data/store'

const statuses = ['todo', 'in-progress', 'done'] as const

export default function EditTaskPage() {
  const params = useParams<{ id: string }>()
  const navigate = useNavigate()
  const task = createAsync(() => getTask(params.id), { deferStream: true })
  const projects = createAsync(() => getProjects(), { deferStream: true })

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    const form = e.currentTarget as HTMLFormElement
    const formData = new FormData(form)
    await updateTask(params.id, {
      title: String(formData.get('title')),
      description: String(formData.get('description')),
      assignee: String(formData.get('assignee')),
      status: String(formData.get('status')) as 'todo' | 'in-progress' | 'done',
      projectId: String(formData.get('projectId')),
    })
    navigate(`/tasks/${params.id}`)
  }

  return (
    <div>
      <h1 class="text-2xl font-semibold mb-4">Edit task</h1>
      <Suspense fallback={<p class="text-gray-500">Loading…</p>}>
        <Show when={task()} fallback={<p>Task not found.</p>}>
          {(t) => (
            <form onSubmit={handleSubmit} class="bg-white rounded-lg shadow-sm p-6 max-w-lg">
              <div class="form-group">
                <label for="title">Title</label>
                <input id="title" name="title" type="text" required value={t().title} />
              </div>
              <div class="form-group">
                <label for="description">Description</label>
                <textarea id="description" name="description" rows={3}>
                  {t().description}
                </textarea>
              </div>
              <div class="form-group">
                <label for="assignee">Assignee</label>
                <input id="assignee" name="assignee" type="text" required value={t().assignee} />
              </div>
              <div class="form-group">
                <label for="projectId">Project</label>
                <select id="projectId" name="projectId" value={t().projectId}>
                  <Suspense fallback={<option>Loading…</option>}>
                    <For each={projects() ?? []}>
                      {(p) => <option value={p.id}>{p.name}</option>}
                    </For>
                  </Suspense>
                </select>
              </div>
              <div class="form-group">
                <label for="status">Status</label>
                <select id="status" name="status" value={t().status}>
                  <For each={statuses}>{(s) => <option value={s}>{s}</option>}</For>
                </select>
              </div>
              <div class="flex gap-3">
                <button type="submit">Save changes</button>
                <a href={`/tasks/${t().id}`} class="button secondary">
                  Cancel
                </a>
              </div>
            </form>
          )}
        </Show>
      </Suspense>
    </div>
  )
}
