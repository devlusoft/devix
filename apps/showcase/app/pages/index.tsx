import {
  useLoaderData,
  useRevalidate,
  Link,
  type LoaderFunction,
  type Metadata,
} from '@devlusoft/devix'
import {
  getTasks,
  createTask,
  deleteTask,
  type Task,
} from '../../lib/store.js'

export const metadata: Metadata = {
  title: 'Tasks - Devix Showcase',
  description: 'Task list exercising the new action() primitive',
}

export const loader: LoaderFunction = async () => {
  return { tasks: getTasks() }
}

export default function Home() {
  const { tasks } = useLoaderData<{ tasks: Task[] }>()
  const revalidate = useRevalidate()

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const title = String(fd.get('title') ?? '').trim()
    const description = String(fd.get('description') ?? '').trim()
    if (!title || !description) return
    await createTask({ title, description })
    form.reset()
    revalidate()
  }

  async function onDelete(id: string) {
    await deleteTask(id)
    revalidate()
  }

  return (
    <main className="container">
      <h1>Tasks</h1>

      <form onSubmit={onCreate}>
        <input name="title" placeholder="Title" required />
        <textarea name="description" placeholder="Description" required />
        <button type="submit">Create</button>
      </form>

      {tasks.length === 0 && <p>No tasks yet. Create one above.</p>}

      {tasks.map((task) => (
        <div key={task.id} className="card">
          <h3>{task.title}</h3>
          <p>{task.description}</p>
          <span className={`badge ${task.status}`}>{task.status}</span>
          <div className="actions">
            <Link href={`/tasks/${task.id}/edit`}>
              <button className="link" type="button">Edit</button>
            </Link>
            <button type="button" className="danger" onClick={() => onDelete(task.id)}>
              Delete
            </button>
          </div>
        </div>
      ))}
    </main>
  )
}
