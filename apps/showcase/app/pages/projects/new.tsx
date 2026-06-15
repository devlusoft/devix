import { useNavigate } from '@solidjs/router'
import { createProject } from '../../data/store'

export default function NewProjectPage() {
  const navigate = useNavigate()

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    const form = e.currentTarget as HTMLFormElement
    const formData = new FormData(form)
    await createProject({
      name: String(formData.get('name')),
      description: String(formData.get('description')),
    })
    navigate('/projects')
  }

  return (
    <div>
      <h1 class="text-2xl font-semibold mb-4">New project</h1>
      <form onSubmit={handleSubmit} class="bg-white rounded-lg shadow-sm p-6 max-w-lg">
        <div class="form-group">
          <label for="name">Name</label>
          <input id="name" name="name" type="text" required />
        </div>
        <div class="form-group">
          <label for="description">Description</label>
          <textarea id="description" name="description" rows={3} />
        </div>
        <div class="flex gap-3">
          <button type="submit">Create project</button>
          <a href="/projects" class="button secondary">Cancel</a>
        </div>
      </form>
    </div>
  )
}
