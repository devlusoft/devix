import { createAsync, useNavigate, useParams } from '@solidjs/router'
import { Show, Suspense } from 'solid-js'
import { getProject, updateProject } from '../../../data/store'

export default function EditProjectPage() {
  const params = useParams<{ id: string }>()
  const navigate = useNavigate()
  const project = createAsync(() => getProject(params.id), { deferStream: true })

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    const form = e.currentTarget as HTMLFormElement
    const formData = new FormData(form)
    await updateProject(params.id, {
      name: String(formData.get('name')),
      description: String(formData.get('description')),
    })
    navigate(`/projects/${params.id}`)
  }

  return (
    <div>
      <h1 class="text-2xl font-semibold mb-4">Edit project</h1>
      <Suspense fallback={<p class="text-gray-500">Loading…</p>}>
        <Show when={project()} fallback={<p>Project not found.</p>}>
          {(p) => (
            <form onSubmit={handleSubmit} class="bg-white rounded-lg shadow-sm p-6 max-w-lg">
              <div class="form-group">
                <label for="name">Name</label>
                <input id="name" name="name" type="text" required value={p().name} />
              </div>
              <div class="form-group">
                <label for="description">Description</label>
                <textarea id="description" name="description" rows={3}>
                  {p().description}
                </textarea>
              </div>
              <div class="flex gap-3">
                <button type="submit">Save changes</button>
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
