import { Suspense } from 'react'
import {
  useQuery,
  useRevalidate,
  invalidateQueries,
  Link,
  type Metadata,
} from '@devlusoft/devix'
import { createTask, deleteTask, type Task } from '../../lib/store.js'
import { getTasksQuery } from '../../lib/queries.js'
import { TaskListSkeleton } from '../components/TaskListSkeleton.js'

export const metadata: Metadata = {
  title: 'Tasks - Devix Showcase',
  description: 'Task list exercising query() + useQuery()',
}

function TaskList() {
  const tasks = useQuery(() => getTasksQuery()) as Task[]
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
    invalidateQueries()
    revalidate()
  }

  async function onDelete(id: string) {
    await deleteTask(id)
    invalidateQueries()
    revalidate()
  }

  return (
    <>
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
    </>
  )
}

export default function Home() {
  return (
    <main className="container">
      <h1>Tasks</h1>
      <Suspense fallback={<TaskListSkeleton count={3} />}>
        <TaskList />
      </Suspense>
    </main>
  )
}