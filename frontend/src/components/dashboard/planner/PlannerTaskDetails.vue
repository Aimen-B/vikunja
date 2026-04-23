<!-- eslint-disable vue/no-v-html -->
<template>
	<Card :title="$t('home.notes.title')">
		<div
			v-if="task"
			class="planner-task-details"
		>
			<div class="planner-task-details__header">
				<div>
					<p
						v-if="project"
						class="planner-task-details__project"
					>
						{{ project.title }}
					</p>
					<h3 class="planner-task-details__title">
						{{ task.title }}
					</h3>
				</div>
				<XButton
					variant="tertiary"
					@click="emit('openTask', task.id)"
				>
					{{ $t('home.planner.openTask') }}
				</XButton>
			</div>

			<Labels
				v-if="task.labels.length > 0"
				:labels="task.labels"
				class="planner-task-details__labels"
			/>

			<AssigneeList
				v-if="task.assignees.length > 0"
				:assignees="task.assignees"
				:inline="true"
				class="planner-task-details__assignees"
			/>

			<dl class="planner-task-details__meta">
				<div v-if="task.startDate">
					<dt>{{ $t('task.attributes.startDate') }}</dt>
					<dd>{{ formatDisplayDate(task.startDate) }}</dd>
				</div>
				<div v-if="task.endDate">
					<dt>{{ $t('task.attributes.endDate') }}</dt>
					<dd>{{ formatDisplayDate(task.endDate) }}</dd>
				</div>
				<div v-if="task.dueDate">
					<dt>{{ $t('task.attributes.dueDate') }}</dt>
					<dd>{{ formatDisplayDate(task.dueDate) }}</dd>
				</div>
			</dl>

			<div class="planner-task-details__notes">
				<h4>{{ $t('home.notes.subtitle') }}</h4>
				<div
					v-if="descriptionHtml"
					class="planner-task-details__content content"
					v-html="descriptionHtml"
				/>
				<p
					v-else
					class="planner-task-details__empty"
				>
					{{ $t('task.description.empty') }}
				</p>
			</div>
		</div>

		<div
			v-else
			class="planner-task-details__placeholder"
		>
			<h3>{{ $t('home.notes.emptyTitle') }}</h3>
			<p>{{ $t('home.notes.emptyText') }}</p>
		</div>
	</Card>
</template>

<script setup lang="ts">
import {computed} from 'vue'
import DOMPurify from 'dompurify'

import Card from '@/components/misc/Card.vue'
import Labels from '@/components/tasks/partials/Labels.vue'
import AssigneeList from '@/components/tasks/partials/AssigneeList.vue'

import {formatDisplayDate} from '@/helpers/time/formatDate'
import {isEditorContentEmpty} from '@/helpers/editorContentEmpty'
import {useProjectStore} from '@/stores/projects'
import type {ITask} from '@/modelTypes/ITask'

const props = defineProps<{
	task: ITask | null
}>()

const emit = defineEmits<{
	'openTask': [taskId: number]
}>()

const projectStore = useProjectStore()

const project = computed(() => props.task ? projectStore.projects[props.task.projectId] : null)

const descriptionHtml = computed(() => {
	if (!props.task || isEditorContentEmpty(props.task.description)) {
		return ''
	}

	return DOMPurify.sanitize(props.task.description, {ADD_ATTR: ['target']})
})
</script>

<style lang="scss" scoped>
.planner-task-details {
	display: flex;
	flex-direction: column;
	gap: 1rem;
}

.planner-task-details__header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 1rem;

	@media screen and (max-width: $tablet) {
		flex-direction: column;
	}
}

.planner-task-details__project {
	color: var(--grey-500);
	font-size: 0.85rem;
	margin: 0 0 0.3rem;
	text-transform: uppercase;
	letter-spacing: 0.04em;
}

.planner-task-details__title {
	font-size: 1.25rem;
	font-weight: 700;
	line-height: 1.25;
	margin: 0;
}

.planner-task-details__labels,
.planner-task-details__assignees {
	margin: 0;
}

.planner-task-details__meta {
	display: grid;
	gap: 0.75rem;
	grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
	margin: 0;
}

.planner-task-details__meta dt {
	color: var(--grey-500);
	font-size: 0.8rem;
	margin-block-end: 0.25rem;
	text-transform: uppercase;
}

.planner-task-details__meta dd {
	font-weight: 600;
	margin: 0;
}

.planner-task-details__notes h4 {
	font-size: 0.95rem;
	font-weight: 700;
	margin-block-end: 0.5rem;
}

.planner-task-details__content {
	color: var(--text);
}

.planner-task-details__empty,
.planner-task-details__placeholder {
	color: var(--grey-500);
}

.planner-task-details__placeholder h3 {
	font-size: 1rem;
	font-weight: 700;
	margin-block-end: 0.5rem;
}
</style>
