import {describe, expect, it} from 'vitest'

import {PERMISSIONS} from '@/constants/permissions'
import type {ITask} from '@/modelTypes/ITask'
import {applyPlannerMutationToTask, buildPlannerTaskFilter, getPlannerTaskGroups, isDueDateOnlyTask, mapTaskToPlannerEvent, taskMatchesPlannerDate, textToTaskDescription} from './planner'

function buildTask(overrides: Partial<ITask> = {}): ITask {
	return {
		id: 1,
		title: 'Task',
		description: '',
		done: false,
		labels: [],
		assignees: [],
		dueDate: null,
		startDate: null,
		endDate: null,
		projectId: 1,
		hexColor: '',
		maxPermission: PERMISSIONS.ADMIN,
		...overrides,
	} as ITask
}

describe('planner helpers', () => {
	it('maps due-date-only tasks to planner events', () => {
		const task = buildTask({
			id: 1,
			title: 'Due task',
			dueDate: new Date(2026, 3, 23, 0, 0, 0),
		})

		const event = mapTaskToPlannerEvent(task)

		expect(isDueDateOnlyTask(task)).toBe(true)
		expect(event?.start).toEqual(task.dueDate)
		expect(event?.allDay).toBe(true)
		expect(event?.extendedProps).toMatchObject({taskId: 1})
	})

	it('builds a visible-range task filter', () => {
		const filter = buildPlannerTaskFilter({
			start: new Date(2026, 3, 1, 0, 0, 0),
			end: new Date(2026, 4, 1, 0, 0, 0),
		}, ['1', '4'])

		expect(filter.filter).toContain('done = false')
		expect(filter.filter).toContain('labels in 1, 4')
		expect(filter.filter).toContain('2026-04-30')
	})

	it('applies drag and resize mutations back onto task dates', () => {
		const task = buildTask({
			id: 1,
			title: 'Scheduled task',
			startDate: new Date(2026, 3, 10, 0, 0, 0),
		})

		const update = applyPlannerMutationToTask(task, {
			start: new Date(2026, 3, 12, 0, 0, 0),
			end: new Date(2026, 3, 15, 0, 0, 0),
			allDay: true,
			type: 'resize',
		})

		expect(update.startDate?.getTime()).toBe(new Date(2026, 3, 12, 0, 0, 0).getTime())
		expect(update.endDate?.getTime()).toBe(new Date(2026, 3, 14, 0, 0, 0).getTime())
	})

	it('groups selected-day tasks together', () => {
		const firstTask = buildTask({
			id: 1,
			title: 'Morning task',
			dueDate: new Date(2026, 3, 23, 8, 0, 0),
		})
		const secondTask = buildTask({
			id: 2,
			title: 'Afternoon task',
			startDate: new Date(2026, 3, 23, 14, 0, 0),
		})

		const groups = getPlannerTaskGroups([secondTask, firstTask], new Date(2026, 3, 23, 12, 0, 0), {
			start: new Date(2026, 3, 1, 0, 0, 0),
			end: new Date(2026, 4, 1, 0, 0, 0),
		})

		expect(groups).toHaveLength(1)
		expect(groups[0].tasks.map(task => task.id)).toEqual([1, 2])
		expect(taskMatchesPlannerDate(firstTask, new Date(2026, 3, 23, 9, 0, 0))).toBe(true)
	})

	it('converts plain text notes into task description html', () => {
		expect(textToTaskDescription('Line one\nLine two')).toBe('<p>Line one<br>Line two</p>')
		expect(textToTaskDescription('')).toBe('')
	})
})
