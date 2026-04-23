<template>
	<Card
		:title="title"
		:loading="loading"
		:padding="false"
		:has-content="false"
	>
		<div
			v-if="groups.length === 0 && !loading"
			class="planner-agenda__empty"
		>
			{{ $t('task.show.noTasks') }}
		</div>

		<div
			v-for="group in groups"
			:key="group.key"
			class="planner-agenda__group"
		>
			<header class="planner-agenda__group-header">
				<h3>{{ group.label }}</h3>
				<span>{{ group.tasks.length }}</span>
			</header>

			<div class="planner-agenda__group-tasks">
				<div
					v-for="task in group.tasks"
					:key="task.id"
					class="planner-agenda__task"
					:class="{'is-selected': task.id === selectedTaskId}"
					@click.capture="emit('selectTask', task.id)"
				>
					<SingleTaskInProject
						:the-task="task"
						:show-project="true"
						:can-mark-as-done="(projectStore.projects[task.projectId]?.maxPermission ?? 0) > PERMISSIONS.READ"
						@taskUpdated="emit('taskUpdated', $event)"
					/>
				</div>
			</div>
		</div>
	</Card>
</template>

<script setup lang="ts">
import {useI18n} from 'vue-i18n'

import Card from '@/components/misc/Card.vue'
import SingleTaskInProject from '@/components/tasks/partials/SingleTaskInProject.vue'

import {PERMISSIONS} from '@/constants/permissions'
import {useProjectStore} from '@/stores/projects'
import type {ITask} from '@/modelTypes/ITask'

import type {PlannerTaskGroup} from './planner'

withDefaults(defineProps<{
	title?: string
	groups: PlannerTaskGroup[]
	selectedTaskId: number | null
	loading?: boolean
}>(), {
	title: '',
	loading: false,
})

const emit = defineEmits<{
	'selectTask': [taskId: number]
	'taskUpdated': [task: ITask]
}>()

useI18n({useScope: 'global'})

const projectStore = useProjectStore()
</script>

<style lang="scss" scoped>
.planner-agenda__empty {
	padding: 1.5rem;
	text-align: center;
	color: var(--grey-500);
}

.planner-agenda__group + .planner-agenda__group {
	border-block-start: 1px solid var(--grey-200);
}

.planner-agenda__group-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 1rem 1rem 0.5rem;
	color: var(--grey-700);
	font-size: 0.9rem;
}

.planner-agenda__group-header h3 {
	font-size: 1rem;
	font-weight: 700;
	margin: 0;
}

.planner-agenda__group-tasks {
	padding: 0 0.5rem 0.75rem;
}

.planner-agenda__task {
	border-radius: $radius;
	transition: box-shadow $transition-duration ease, background-color $transition-duration ease;
}

.planner-agenda__task.is-selected {
	background: hsla(var(--primary-hsl), 0.06);
	box-shadow: 0 0 0 1px hsla(var(--primary-hsl), 0.2);
}
</style>
