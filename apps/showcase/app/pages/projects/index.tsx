import { Link } from '@devlusoft/devix/router'
import { createAsync } from '@solidjs/router'
import { For, Show, Suspense } from 'solid-js'
import { deleteProject, getProjects } from '../../data/store'

export default function ProjectsPage() {
  const projects = createAsync(() => getProjects())

  return (
    <div>
      <div class="flex justify-between items-center mb-4">
        <h1 class="text-2xl font-semibold">Projects</h1>
        <Link href="/projects/new" class="button">
          New project
        </Link>
      </div>
      <Suspense fallback={<p class="text-gray-500">Loading projects…</p>}>
        <Show
          when={(projects() ?? []).length > 0}
          fallback={<p class="text-gray-500">No projects yet.</p>}
        >
          <ul class="flex flex-col gap-3">
            <For each={projects()}>
              {(p) => (
                <li class="bg-white rounded-lg shadow-sm p-4">
                  <div class="flex justify-between items-start">
                    <div>
                      <Link
                        href={`/projects/${p.id}`}
                        class="text-lg font-semibold text-blue-600 hover:underline"
                      >
                        {p.name}
                      </Link>
                      <p class="text-gray-500 mt-1">{p.description}</p>
                    </div>
                    <div class="flex gap-2">
                      <Link href={`/projects/${p.id}/edit`} class="button secondary">
                        Edit
                      </Link>
                      <DeleteButton id={p.id} />
                    </div>
                  </div>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </Suspense>
    </div>
  )
}

function DeleteButton(props: { id: string }) {
  async function handleDelete() {
    if (!confirm('Delete this project and all its tasks?')) return
    await deleteProject(props.id)
    window.location.href = '/projects'
  }

  return (
    <button type="button" class="danger" onClick={handleDelete}>
      Delete
    </button>
  )
}
