import {computed, ref, shallowReactive, watch, type Ref} from 'vue'

import type {ITask} from '@/modelTypes/ITask'

import TaskService from '@/services/task'
import TaskCollectionService, {type TaskFilterParams} from '@/services/taskCollection'
import {useAuthStore} from '@/stores/auth'
import {useTaskStore} from '@/stores/tasks'
import {buildPlannerTaskFilter, mapTasksToPlannerEvents, taskIntersectsPlannerRange, type PlannerRange} from '@/components/dashboard/planner/planner'

interface UsePlannerTasksOptions {
	visibleRange: Ref<PlannerRange>
	labelIds: Ref<string[] | undefined>
	filterProjectId: Ref<number | null | undefined>
}

async function loadAllPages(
	service: TaskService | TaskCollectionService,
	model: Record<string, unknown>,
	params: TaskFilterParams,
	page = 1,
): Promise<ITask[]> {
	const tasks = await service.getAll(model, params, page) as ITask[]
	if (page < service.totalPages) {
		const nextTasks = await loadAllPages(service, model, params, page + 1)
		return tasks.concat(nextTasks)
	}

	return tasks
}

export function usePlannerTasks(options: UsePlannerTasksOptions) {
	const taskService = shallowReactive(new TaskService())
	const taskCollectionService = shallowReactive(new TaskCollectionService())

	const authStore = useAuthStore()
	const taskStore = useTaskStore()

	const tasks = ref<ITask[]>([])

	const isLoading = computed(() => taskService.loading || taskCollectionService.loading)
	const events = computed(() => mapTasksToPlannerEvents(tasks.value))

	async function loadTasks() {
		const params = buildPlannerTaskFilter(options.visibleRange.value, options.labelIds.value)
		params.filter_timezone = authStore.settings.timezone

		const shouldUseSavedFilter = Boolean(options.filterProjectId.value) && !(options.labelIds.value?.length)
		const loadedTasks = shouldUseSavedFilter
			? await loadAllPages(taskCollectionService, {projectId: options.filterProjectId.value}, params)
			: await loadAllPages(taskService, {}, params)

		tasks.value = loadedTasks.filter(task => taskIntersectsPlannerRange(task, options.visibleRange.value))
	}

	function upsertTask(task: ITask) {
		const isVisible = taskIntersectsPlannerRange(task, options.visibleRange.value)
		const existingTaskIndex = tasks.value.findIndex(currentTask => currentTask.id === task.id)

		if (!isVisible) {
			if (existingTaskIndex >= 0) {
				tasks.value.splice(existingTaskIndex, 1)
			}
			return
		}

		if (existingTaskIndex >= 0) {
			tasks.value.splice(existingTaskIndex, 1, task)
			return
		}

		tasks.value = [...tasks.value, task]
	}

	watch(
		() => ({
			start: options.visibleRange.value.start.getTime(),
			end: options.visibleRange.value.end.getTime(),
			labels: options.labelIds.value?.join(',') ?? '',
			filterProjectId: options.filterProjectId.value ?? 0,
		}),
		() => loadTasks(),
		{immediate: true},
	)

	watch(
		() => taskStore.lastUpdatedTask,
		(updatedTask) => {
			if (!updatedTask) {
				return
			}

			upsertTask(updatedTask)
		},
	)

	return {
		tasks,
		events,
		isLoading,
		loadTasks,
		upsertTask,
	}
}
