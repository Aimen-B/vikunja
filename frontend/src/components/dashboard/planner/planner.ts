import type {EventInput} from '@fullcalendar/core'

import {PERMISSIONS} from '@/constants/permissions'
import {formatDate} from '@/helpers/time/formatDate'
import type {ITask} from '@/modelTypes/ITask'
import type {TaskFilterParams} from '@/services/taskCollection'

export type PlannerView = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'

export interface PlannerRange {
	start: Date
	end: Date
}

export interface PlannerTaskGroup {
	key: string
	label: string
	tasks: ITask[]
}

export interface PlannerTaskMutation {
	start: Date | null
	end: Date | null
	allDay: boolean
	type: 'drop' | 'resize'
}

const DAY_IN_MS = 24 * 60 * 60 * 1000

function cloneDate(date: Date | null | undefined): Date | null {
	return date ? new Date(date) : null
}

function isMidnight(date: Date | null | undefined): boolean {
	if (!date) {
		return true
	}

	return date.getHours() === 0
		&& date.getMinutes() === 0
		&& date.getSeconds() === 0
		&& date.getMilliseconds() === 0
}

function startOfDay(date: Date): Date {
	const value = new Date(date)
	value.setHours(0, 0, 0, 0)
	return value
}

function endOfDay(date: Date): Date {
	const value = new Date(date)
	value.setHours(23, 59, 59, 999)
	return value
}

function getTaskRange(task: ITask): PlannerRange | null {
	const start = cloneDate(task.startDate ?? task.endDate ?? task.dueDate)
	const end = cloneDate(task.endDate ?? task.startDate ?? task.dueDate)

	if (!start || !end) {
		return null
	}

	return {start, end}
}

function normalizeCalendarEnd(end: Date | null, allDay: boolean): Date | null {
	if (!end) {
		return null
	}

	const normalized = new Date(end)
	if (allDay) {
		normalized.setTime(normalized.getTime() - DAY_IN_MS)
	}

	return normalized
}

function addPlannerEndOffset(end: Date, allDay: boolean): Date {
	if (!allDay) {
		return new Date(end)
	}

	return new Date(end.getTime() + DAY_IN_MS)
}

export function hasPlannerDate(task: ITask): boolean {
	return Boolean(task.startDate || task.endDate || task.dueDate)
}

export function isDueDateOnlyTask(task: ITask): boolean {
	return Boolean(task.dueDate && !task.startDate && !task.endDate)
}

export function getTaskAnchorDate(task: ITask): Date | null {
	return cloneDate(task.startDate ?? task.dueDate ?? task.endDate)
}

export function getInclusivePlannerRange(range: PlannerRange): PlannerRange {
	const start = new Date(range.start)
	const end = new Date(range.end)

	if (end.getTime() > start.getTime()) {
		end.setMilliseconds(end.getMilliseconds() - 1)
	}

	return {start, end}
}

export function taskIntersectsPlannerRange(task: ITask, range: PlannerRange): boolean {
	const taskRange = getTaskRange(task)
	if (!taskRange) {
		return false
	}

	const normalizedRange = getInclusivePlannerRange(range)

	return taskRange.start <= normalizedRange.end && taskRange.end >= normalizedRange.start
}

export function taskMatchesPlannerDate(task: ITask, date: Date): boolean {
	return taskIntersectsPlannerRange(task, {
		start: startOfDay(date),
		end: endOfDay(date),
	})
}

export function buildPlannerTaskFilter(range: PlannerRange, labelIds?: string[]): TaskFilterParams {
	const normalizedRange = getInclusivePlannerRange(range)
	const dateFrom = formatDate(normalizedRange.start, 'YYYY-MM-DD')
	const dateTo = formatDate(normalizedRange.end, 'YYYY-MM-DD')

	const filters = [
		'done = false',
		'(' +
			`(start_date >= "${dateFrom}" && start_date <= "${dateTo}") || ` +
			`(end_date >= "${dateFrom}" && end_date <= "${dateTo}") || ` +
			`(due_date >= "${dateFrom}" && due_date <= "${dateTo}") || ` +
			`(start_date <= "${dateFrom}" && end_date >= "${dateTo}")` +
		')',
	]

	if (labelIds && labelIds.length > 0) {
		filters.push(`labels in ${labelIds.join(', ')}`)
	}

	return {
		sort_by: ['start_date', 'due_date', 'end_date', 'id'],
		order_by: ['asc', 'asc', 'asc', 'desc'],
		filter: filters.join(' && '),
		filter_include_nulls: false,
		s: '',
	}
}

export function mapTaskToPlannerEvent(task: ITask): EventInput | null {
	if (!hasPlannerDate(task)) {
		return null
	}

	const start = cloneDate(task.startDate ?? task.endDate ?? task.dueDate)
	if (!start) {
		return null
	}

	const allDay = [task.startDate, task.endDate, task.dueDate]
		.filter(Boolean)
		.every(date => isMidnight(date))

	let end: Date | undefined
	if (task.startDate && task.endDate) {
		end = addPlannerEndOffset(task.endDate, allDay)
	}

	return {
		id: `task-${task.id}`,
		title: task.title,
		start,
		end,
		allDay,
		editable: (task.maxPermission ?? 0) > PERMISSIONS.READ,
		durationEditable: Boolean(task.startDate),
		backgroundColor: task.hexColor || undefined,
		borderColor: task.hexColor || undefined,
		classNames: [
			'planner-task-event',
			isDueDateOnlyTask(task) ? 'planner-task-event--due' : 'planner-task-event--scheduled',
		],
		extendedProps: {
			taskId: task.id,
			projectId: task.projectId,
		},
	}
}

export function mapTasksToPlannerEvents(tasks: ITask[]): EventInput[] {
	return tasks
		.map(mapTaskToPlannerEvent)
		.filter((event): event is EventInput => event !== null)
}

export function applyPlannerMutationToTask(task: ITask, mutation: PlannerTaskMutation): Partial<ITask> {
	const start = cloneDate(mutation.start)
	const end = normalizeCalendarEnd(mutation.end, mutation.allDay)

	if (task.startDate && task.endDate) {
		return {
			startDate: start,
			endDate: end ?? start,
		}
	}

	if (task.startDate) {
		return {
			startDate: start,
			endDate: mutation.type === 'resize' ? end ?? start : null,
		}
	}

	if (task.endDate) {
		return {
			endDate: start ?? end,
		}
	}

	if (task.dueDate) {
		return {
			dueDate: start,
		}
	}

	return {}
}

export function getPlannerTaskGroups(tasks: ITask[], selectedDate: Date | null, visibleRange: PlannerRange): PlannerTaskGroup[] {
	const sourceTasks = selectedDate
		? tasks.filter(task => taskMatchesPlannerDate(task, selectedDate))
		: tasks.filter(task => taskIntersectsPlannerRange(task, visibleRange))

	const sortedTasks = sourceTasks
		.slice()
		.sort((left, right) => {
			const leftDate = getTaskAnchorDate(left)?.getTime() ?? 0
			const rightDate = getTaskAnchorDate(right)?.getTime() ?? 0

			if (leftDate === rightDate) {
				return left.id - right.id
			}

			return leftDate - rightDate
		})

	const groupedTasks = new Map<string, PlannerTaskGroup>()

	for (const task of sortedTasks) {
		const anchor = selectedDate ?? getTaskAnchorDate(task) ?? visibleRange.start
		const key = formatDate(anchor, 'YYYY-MM-DD')

		if (!groupedTasks.has(key)) {
			groupedTasks.set(key, {
				key,
				label: formatDate(anchor, 'dddd, MMM D'),
				tasks: [],
			})
		}

		groupedTasks.get(key)?.tasks.push(task)
	}

	return Array.from(groupedTasks.values())
}

export function textToTaskDescription(text: string): string {
	const trimmed = text.trim()
	if (trimmed === '') {
		return ''
	}

	const escaped = trimmed
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll('\'', '&#39;')

	return escaped
		.split(/\n{2,}/)
		.map(paragraph => `<p>${paragraph.replaceAll('\n', '<br>')}</p>`)
		.join('')
}

export function stripTaskDescription(description: string): string {
	if (description === '') {
		return ''
	}

	const document = new DOMParser().parseFromString(description, 'text/html')
	return document.body.textContent?.trim() ?? ''
}
