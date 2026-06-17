import { Link, useParams } from '@devlusoft/devix/router'
import { createAsync } from '@solidjs/router'
import { createResource, Show, Suspense } from 'solid-js'
import { getProject, getTask } from '../../../data/store'

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>()
  const task = createAsync(() => getTask(params.id), { deferStream: true })

  return (
    <div>
      <Suspense fallback={<p class="text-gray-500">Loading task…</p>}>
        <Show
          when={task()}
          fallback={
            <p>
              Task not found.{' '}
              <Link href="/tasks" class="text-blue-600 hover:underline">
                ← back
              </Link>
            </p>
          }
        >
          {(t) => <TaskCard task={t()} />}
        </Show>
      </Suspense>
    </div>
  )
}

function TaskCard(props: {
  task: NonNullable<ReturnType<typeof getTask> extends Promise<infer T> ? T : never>
}) {
  const [project] = createResource(() => getProject(props.task.projectId))

  return (
    <div class="bg-white rounded-lg shadow-sm p-6 max-w-2xl">
      <div class="flex justify-between items-start mb-4">
        <h1 class="text-2xl font-semibold">{props.task.title}</h1>
        <Link href={`/tasks/${props.task.id}/edit`} class="button secondary">
          Edit
        </Link>
      </div>
      <p class="text-gray-600 mb-4">{props.task.description}</p>
      <dl class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt class="text-gray-500">Project</dt>
          <dd class="font-medium">
            <Suspense fallback={<span>Loading…</span>}>
              <Link href={`/projects/${props.task.projectId}`} class="text-blue-600 hover:underline">
                {project()?.name ?? 'Unknown'}
              </Link>
            </Suspense>
          </dd>
        </div>
        <div>
          <dt class="text-gray-500">Assignee</dt>
          <dd class="font-medium">{props.task.assignee}</dd>
        </div>
        <div>
          <dt class="text-gray-500">Status</dt>
          <dd>
            <StatusBadge status={props.task.status} />
          </dd>
        </div>
      </dl>
      <div class="mt-6">
        <Link href="/tasks" class="text-blue-600 hover:underline">
          ← back to tasks
        </Link>
      </div>
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
