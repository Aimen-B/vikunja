<template>
	<div class="home-dashboard">
		<Message
			v-if="deletionScheduledAt !== null"
			variant="danger"
			class="mbe-4"
		>
			{{
				$t('user.deletion.scheduled', {
					date: formatDisplayDate(deletionScheduledAt),
					dateSince: formatDateSince(deletionScheduledAt),
				})
			}}
			<RouterLink :to="{name: 'user.settings.deletion'}">
				{{ $t('user.deletion.scheduledCancel') }}
			</RouterLink>
		</Message>

		<Message
			v-if="filteredLabels.length > 0"
			class="home-dashboard__filter-message mbe-4"
		>
			<i18n-t
				keypath="task.show.filterByLabel"
				tag="span"
				class="filter-label-text"
			>
				<template #label>
					<XLabel
						v-for="label in filteredLabels"
						:key="label.id"
						:label="label"
					/>
				</template>
			</i18n-t>
			<BaseButton
				v-tooltip="$t('task.show.clearLabelFilter')"
				class="clear-filter-button"
				@click="handleClearLabelFilter"
			>
				<Icon icon="times" />
			</BaseButton>
		</Message>

		<Message
			v-if="savedFilterIgnored"
			class="mbe-4"
		>
			{{ $t('task.show.savedFilterIgnored') }}
		</Message>

		<section class="home-dashboard__hero">
			<div>
				<p class="home-dashboard__eyebrow">
					{{ $t('navigation.dashboard') }}
				</p>
				<h1>
					{{ salutation }}
				</h1>
				<p class="home-dashboard__subtitle">
					{{ $t('home.dashboardSubtitle') }}
				</p>
			</div>

			<XButton
				variant="tertiary"
				:shadow="false"
				class="home-dashboard__notes-button"
				@click="toggleDetailsRail"
			>
				<Icon icon="align-left" />
				{{ $t('home.notes.toggle') }}
			</XButton>
		</section>

		<section class="home-dashboard__summary">
			<div class="home-dashboard__summary-card">
				<span>{{ $t('home.summary.inView') }}</span>
				<strong>{{ tasks.length }}</strong>
			</div>
			<div class="home-dashboard__summary-card">
				<span>{{ $t('home.summary.selectedDay', {date: selectedDateLabel}) }}</span>
				<strong>{{ selectedDateTasks.length }}</strong>
			</div>
			<div class="home-dashboard__summary-card">
				<span>{{ $t('home.summary.overdue') }}</span>
				<strong>{{ overdueTasks.length }}</strong>
			</div>
			<div class="home-dashboard__summary-card">
				<span>{{ $t('home.summary.notes') }}</span>
				<strong>{{ tasksWithNotes }}</strong>
			</div>
		</section>

		<AddTask
			class="home-dashboard__quick-add"
			:default-due-date="selectedDate"
			@taskAdded="handleTaskAdded"
		/>

		<div class="home-dashboard__layout">
			<section class="home-dashboard__main">
				<Card :title="$t('home.planner.title')">
					<PlannerCalendar
						:events="events"
						:selected-date="selectedDate"
						:week-start="authStore.settings.weekStart"
						:loading="isLoading"
						@rangeChange="handleRangeChange"
						@openTask="openTaskDetail"
						@createAt="openQuickCreate"
						@updateTaskDates="handleTaskDateUpdate"
					/>
				</Card>

				<PlannerAgenda
					:title="$t('home.planner.agendaFor', {date: selectedDateLabel})"
					:groups="agendaGroups"
					:selected-task-id="selectedTaskId"
					:loading="isLoading"
					@selectTask="selectTask"
					@taskUpdated="handleTaskUpdated"
				/>
			</section>

			<aside
				class="home-dashboard__details"
				:class="{'is-open': detailsRailOpen}"
			>
				<PlannerTaskDetails
					:task="selectedTask"
					@openTask="openTaskDetail"
				/>
			</aside>
		</div>

		<Modal
			:enabled="mobileDetailsOpen"
			variant="scrolling"
			@close="mobileDetailsOpen = false"
		>
			<PlannerTaskDetails
				:task="selectedTask"
				@openTask="openTaskDetail"
			/>
		</Modal>

		<PlannerQuickCreateModal
			:open="quickCreateOpen"
			:scheduled-at="quickCreateDate"
			@close="quickCreateOpen = false"
			@created="handleQuickCreated"
		/>
	</div>
</template>

<script lang="ts" setup>
import {computed, ref, watch, watchEffect} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import {useI18n} from 'vue-i18n'

import Message from '@/components/misc/Message.vue'
import AddTask from '@/components/tasks/AddTask.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import XLabel from '@/components/tasks/partials/Label.vue'
import PlannerCalendar from '@/components/dashboard/planner/PlannerCalendar.vue'
import PlannerAgenda from '@/components/dashboard/planner/PlannerAgenda.vue'
import PlannerTaskDetails from '@/components/dashboard/planner/PlannerTaskDetails.vue'
import PlannerQuickCreateModal from '@/components/dashboard/planner/PlannerQuickCreateModal.vue'

import {useDaytimeSalutation} from '@/composables/useDaytimeSalutation'
import {usePlannerTasks} from '@/composables/usePlannerTasks'
import {parseDateOrNull} from '@/helpers/parseDateOrNull'
import {formatDate, formatDateSince, formatDisplayDate} from '@/helpers/time/formatDate'
import {setTitle} from '@/helpers/setTitle'
import {applyPlannerMutationToTask, getPlannerTaskGroups, getTaskAnchorDate, stripTaskDescription, taskMatchesPlannerDate, type PlannerRange} from '@/components/dashboard/planner/planner'

import {useAuthStore} from '@/stores/auth'
import {useLabelStore} from '@/stores/labels'
import {useTaskStore} from '@/stores/tasks'
import type {ITask} from '@/modelTypes/ITask'

const salutation = useDaytimeSalutation()

const authStore = useAuthStore()
const labelStore = useLabelStore()
const taskStore = useTaskStore()
const route = useRoute()
const router = useRouter()
const {t} = useI18n({useScope: 'global'})

const initialRangeStart = new Date()
initialRangeStart.setDate(1)
initialRangeStart.setHours(0, 0, 0, 0)

const initialRangeEnd = new Date(initialRangeStart)
initialRangeEnd.setMonth(initialRangeEnd.getMonth() + 1)

const visibleRange = ref<PlannerRange>({
	start: initialRangeStart,
	end: initialRangeEnd,
})
const selectedDate = ref<Date | null>(new Date())
const selectedTaskId = ref<ITask['id'] | null>(null)
const quickCreateOpen = ref(false)
const quickCreateDate = ref<Date | null>(new Date())
const detailsRailOpen = ref(true)
const mobileDetailsOpen = ref(false)

const deletionScheduledAt = computed(() => parseDateOrNull(authStore.info?.deletionScheduledAt))

const labelIds = computed(() => {
	const labelsParam = route.query.labels
	if (!labelsParam) {
		return undefined
	}

	return Array.isArray(labelsParam) ? labelsParam : [labelsParam]
})

const filteredLabels = computed(() => {
	if (!labelIds.value || labelIds.value.length === 0) {
		return []
	}

	return labelIds.value
		.map(id => labelStore.getLabelById(Number(id)))
		.filter(label => label !== null && label !== undefined)
})

const filterIdUsedOnOverview = computed(() => authStore.settings?.frontendSettings?.filterIdUsedOnOverview)
const savedFilterIgnored = computed(() => {
	return filteredLabels.value.length > 0
		&& filterIdUsedOnOverview.value
		&& Boolean(filterIdUsedOnOverview.value)
})

const {
	tasks,
	events,
	isLoading,
	upsertTask,
} = usePlannerTasks({
	visibleRange,
	labelIds,
	filterProjectId: filterIdUsedOnOverview,
})

const selectedTask = computed(() => {
	return tasks.value.find(task => task.id === selectedTaskId.value) ?? null
})

const selectedDateLabel = computed(() => {
	return selectedDate.value
		? formatDate(selectedDate.value, 'dddd, MMM D')
		: t('home.planner.visibleRange')
})

const selectedDateTasks = computed(() => {
	if (!selectedDate.value) {
		return []
	}

	return tasks.value.filter(task => taskMatchesPlannerDate(task, selectedDate.value as Date))
})

const agendaGroups = computed(() => getPlannerTaskGroups(tasks.value, selectedDate.value, visibleRange.value))
const overdueTasks = computed(() => {
	const now = new Date()
	return tasks.value.filter(task => !task.done && task.dueDate !== null && task.dueDate < now)
})
const tasksWithNotes = computed(() => {
	return tasks.value.filter(task => stripTaskDescription(task.description) !== '').length
})

watch(
	tasks,
	(currentTasks) => {
		if (currentTasks.length === 0) {
			selectedTaskId.value = null
			return
		}

		const taskStillSelected = selectedTaskId.value !== null && currentTasks.some(task => task.id === selectedTaskId.value)
		if (!taskStillSelected) {
			selectedTaskId.value = currentTasks[0].id
		}

		if (!selectedDate.value && currentTasks[0]) {
			selectedDate.value = getTaskAnchorDate(currentTasks[0]) ?? new Date()
		}
	},
	{immediate: true},
)

watchEffect(() => setTitle(t('navigation.dashboard')))

function handleClearLabelFilter() {
	const query = {...route.query}
	delete query.labels
	router.push({
		name: route.name as string,
		query,
	})
}

function handleRangeChange(range: PlannerRange) {
	visibleRange.value = range

	if (!selectedDate.value) {
		selectedDate.value = new Date(range.start)
		return
	}

	if (selectedDate.value < range.start || selectedDate.value >= range.end) {
		selectedDate.value = new Date(range.start)
	}
}

function selectTask(taskId: ITask['id']) {
	selectedTaskId.value = taskId

	if (window.innerWidth <= 768) {
		mobileDetailsOpen.value = true
	} else {
		detailsRailOpen.value = true
	}
}

function openTaskDetail(taskId: ITask['id']) {
	const task = tasks.value.find(currentTask => currentTask.id === taskId)
	if (task) {
		selectedDate.value = getTaskAnchorDate(task) ?? selectedDate.value
	}

	selectTask(taskId)
	router.push({
		name: 'task.detail',
		params: {id: taskId},
		state: {backdropView: route.fullPath},
	})
}

function openQuickCreate(date: Date) {
	selectedDate.value = new Date(date)
	quickCreateDate.value = new Date(date)
	quickCreateOpen.value = true
}

async function handleTaskDateUpdate(payload: {
	taskId: number
	start: Date | null
	end: Date | null
	allDay: boolean
	type: 'drop' | 'resize'
	revert: () => void
}) {
	const task = tasks.value.find(currentTask => currentTask.id === payload.taskId)
	if (!task) {
		payload.revert()
		return
	}

	try {
		const updatedTask = await taskStore.update({
			...task,
			...applyPlannerMutationToTask(task, payload),
		})
		upsertTask(updatedTask)
		selectTask(updatedTask.id)
	} catch {
		payload.revert()
	}
}

function handleTaskUpdated(task: ITask) {
	upsertTask(task)
	selectTask(task.id)
}

function handleTaskAdded(task: ITask) {
	upsertTask(task)
	selectTask(task.id)
}

function handleQuickCreated(task: ITask) {
	upsertTask(task)
	selectTask(task.id)
}

function toggleDetailsRail() {
	if (window.innerWidth <= 768) {
		mobileDetailsOpen.value = true
		return
	}

	detailsRailOpen.value = !detailsRailOpen.value
}
</script>

<style scoped lang="scss">
.home-dashboard {
	display: flex;
	flex-direction: column;
	gap: 1.5rem;
}

.home-dashboard__filter-message {
	.clear-filter-button {
		margin-inline-start: auto;
		padding: 0.25rem 0.5rem;
	}

	:deep(.message.info) {
		inline-size: 100%;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
}

.home-dashboard__hero {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 1rem;

	@media screen and (max-width: $tablet) {
		flex-direction: column;
	}
}

.home-dashboard__eyebrow {
	color: var(--grey-500);
	font-size: 0.85rem;
	font-weight: 700;
	letter-spacing: 0.08em;
	margin-block-end: 0.5rem;
	text-transform: uppercase;
}

.home-dashboard__subtitle {
	color: var(--grey-600);
	font-size: 1rem;
	max-inline-size: 44rem;
}

.home-dashboard__notes-button {
	flex-shrink: 0;
}

.home-dashboard__summary {
	display: grid;
	gap: 0.75rem;
	grid-template-columns: repeat(4, minmax(0, 1fr));

	@media screen and (max-width: $desktop) {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	@media screen and (max-width: $tablet) {
		grid-template-columns: minmax(0, 1fr);
	}
}

.home-dashboard__summary-card {
	display: flex;
	flex-direction: column;
	gap: 0.35rem;
	padding: 1rem 1.1rem;
	border: 1px solid var(--card-border-color);
	border-radius: $radius;
	background: linear-gradient(180deg, var(--white) 0%, var(--grey-50) 100%);
	box-shadow: var(--shadow-xs);
}

.home-dashboard__summary-card span {
	color: var(--grey-500);
	font-size: 0.85rem;
}

.home-dashboard__summary-card strong {
	color: var(--text-strong);
	font-size: 1.6rem;
	line-height: 1;
}

.home-dashboard__quick-add {
	margin-block-end: 0;
}

.home-dashboard__layout {
	display: grid;
	gap: 1.5rem;
	grid-template-columns: minmax(0, 2fr) minmax(18rem, 24rem);
	align-items: start;

	@media screen and (max-width: $desktop) {
		grid-template-columns: minmax(0, 1fr);
	}
}

.home-dashboard__main {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	min-inline-size: 0;
}

.home-dashboard__details {
	display: block;
	position: sticky;
	inset-block-start: calc(#{$navbar-height} + 1rem);

	@media screen and (max-width: $desktop) {
		display: none;
	}

	&:not(.is-open) {
		display: none;
	}
}
</style>
