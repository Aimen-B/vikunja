<template>
	<div class="planner-calendar">
		<FullCalendar :options="calendarOptions" />
		<div
			v-if="loading"
			class="planner-calendar__loading"
		>
			<Loading />
		</div>
	</div>
</template>

<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import timeGridPlugin from '@fullcalendar/timegrid'
import allLocales from '@fullcalendar/core/locales-all'
import type {DatesSetArg, EventClickArg, EventInput} from '@fullcalendar/core'

import Loading from '@/components/misc/Loading.vue'

import type {PlannerRange, PlannerView} from './planner'

const props = withDefaults(defineProps<{
	events: EventInput[]
	selectedDate: Date | null
	viewMode?: PlannerView
	weekStart?: number
	loading?: boolean
}>(), {
	viewMode: 'dayGridMonth',
	weekStart: 1,
	loading: false,
})

const emit = defineEmits<{
	'rangeChange': [range: PlannerRange]
	'openTask': [taskId: number]
	'createAt': [date: Date]
	'updateTaskDates': [payload: {
		taskId: number
		start: Date | null
		end: Date | null
		allDay: boolean
		type: 'drop' | 'resize'
		revert: () => void
	}]
}>()

const {t, locale} = useI18n({useScope: 'global'})

function isSelectedDate(date: Date): boolean {
	if (!props.selectedDate) {
		return false
	}

	return date.toDateString() === props.selectedDate.toDateString()
}

function handleDatesSet(details: DatesSetArg) {
	emit('rangeChange', {
		start: new Date(details.start),
		end: new Date(details.end),
	})
}

function handleEventClick(details: EventClickArg) {
	emit('openTask', Number(details.event.extendedProps.taskId))
}

function emitTaskDateUpdate(details: {
	event: {
		extendedProps: {
			taskId: number
		}
		start: Date | null
		end: Date | null
		allDay: boolean
	}
	revert: () => void
}, type: 'drop' | 'resize') {
	emit('updateTaskDates', {
		taskId: Number(details.event.extendedProps.taskId),
		start: details.event.start ? new Date(details.event.start) : null,
		end: details.event.end ? new Date(details.event.end) : null,
		allDay: details.event.allDay,
		type,
		revert: details.revert,
	})
}

const calendarOptions = computed(() => ({
	plugins: [
		dayGridPlugin,
		timeGridPlugin,
		interactionPlugin,
		listPlugin,
	],
	initialView: props.viewMode,
	headerToolbar: {
		left: 'prev,next today',
		center: 'title',
		right: 'dayGridMonth,timeGridWeek,timeGridDay',
	},
	buttonText: {
		today: t('home.planner.today'),
		month: t('home.planner.month'),
		week: t('home.planner.week'),
		day: t('home.planner.day'),
	},
	firstDay: props.weekStart,
	locale: locale.value,
	locales: allLocales,
	events: props.events,
	height: 'auto',
	nowIndicator: true,
	editable: true,
	displayEventTime: true,
	dayMaxEvents: 3,
	eventTimeFormat: {
		hour: 'numeric' as const,
		minute: '2-digit' as const,
	},
	dayCellClassNames: (arg: {date: Date}) => isSelectedDate(arg.date) ? ['planner-day--selected'] : [],
	dayHeaderClassNames: (arg: {date: Date}) => isSelectedDate(arg.date) ? ['planner-day--selected'] : [],
	datesSet: handleDatesSet,
	dateClick: (arg: {date: Date}) => emit('createAt', new Date(arg.date)),
	eventClick: handleEventClick,
	eventDrop: (arg: {
		event: {
			extendedProps: {
				taskId: number
			}
			start: Date | null
			end: Date | null
			allDay: boolean
		}
		revert: () => void
	}) => emitTaskDateUpdate(arg, 'drop'),
	eventResize: (arg: {
		event: {
			extendedProps: {
				taskId: number
			}
			start: Date | null
			end: Date | null
			allDay: boolean
		}
		revert: () => void
	}) => emitTaskDateUpdate(arg, 'resize'),
}))
</script>

<style lang="scss" scoped>
.planner-calendar {
	position: relative;
}

.planner-calendar__loading {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(255, 255, 255, 0.72);
	backdrop-filter: blur(2px);
	z-index: 2;
}

:deep(.fc) {
	--fc-border-color: var(--grey-200);
	--fc-button-bg-color: hsl(var(--primary-hsl));
	--fc-button-border-color: hsl(var(--primary-hsl));
	--fc-button-hover-bg-color: hsl(var(--primary-hsl));
	--fc-button-hover-border-color: hsl(var(--primary-hsl));
	--fc-button-active-bg-color: hsl(var(--primary-hsl));
	--fc-button-active-border-color: hsl(var(--primary-hsl));
	--fc-event-border-color: transparent;
	--fc-page-bg-color: transparent;

	border-radius: $radius;
}

:deep(.fc .fc-toolbar.fc-header-toolbar) {
	margin-block-end: 1rem;
	gap: 0.75rem;

	@media screen and (max-width: $tablet) {
		align-items: stretch;
		flex-direction: column;
	}
}

:deep(.fc .fc-toolbar-title) {
	font-size: 1.15rem;
	font-weight: 700;
}

:deep(.fc .fc-button) {
	border-radius: $radius;
	box-shadow: none;
	font-size: 0.9rem;
}

:deep(.fc .planner-day--selected) {
	background: hsla(var(--primary-hsl), 0.08);
}

:deep(.fc .planner-task-event) {
	border-radius: $radius;
	cursor: pointer;
	padding-inline: 0.15rem;
}

:deep(.fc .planner-task-event--due) {
	background: hsla(var(--warning-hsl), 0.16);
	color: var(--warning);
}

:deep(.fc .fc-daygrid-event-dot) {
	border-color: currentColor;
}
</style>
