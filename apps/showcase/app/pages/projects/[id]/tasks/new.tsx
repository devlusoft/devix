import { useNavigate, useParams } from '@devlusoft/devix/router'
import { createAsync } from '@solidjs/router'
import { Show, Suspense } from 'solid-js'
import { createTask, getProject } from '../../../../data/store'

export default function NewTaskPage() {
  const params = useParams<{ id: string }>()
  const navigate = useNavigate()
  const project = createAsync(() => getProject(params.id), { deferStream: true })

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    const form = e.currentTarget as HTMLFormElement
    const formData = new FormData(form)
    await createTask({
      projectId: params.id,
      title: String(formData.get('title')),
      description: String(formData.get('description')),
      status: 'todo',
      assignee: String(formData.get('assignee')),
    })
    navigate(`/projects/${params.id}`)
  }

  return (
    <div>
      <h1 class="text-2xl font-semibold mb-4">New task</h1>
      <Suspense fallback={<p class="text-gray-500">Loading…</p>}>
        <Show when={project()} fallback={<p>Project not found.</p>}>
          {(p) => (
            <form onSubmit={handleSubmit} class="bg-white rounded-lg shadow-sm p-6 max-w-lg">
              <div class="form-group">
                <label for="title">Title</label>
                <input id="title" name="title" type="text" required />
              </div>
              <div class="form-group">
                <label for="description">Description</label>
                <textarea id="description" name="description" rows={3} />
              </div>
              <div class="form-group">
                <label for="assignee">Assignee</label>
                <input id="assignee" name="assignee" type="text" required />
              </div>
              <div class="flex gap-3">
                <button type="submit">Create task</button>
                <a href={`/projects/${p().id}`} class="button secondary">
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
