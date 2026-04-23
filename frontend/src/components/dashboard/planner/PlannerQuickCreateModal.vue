<template>
	<Modal
		:enabled="open"
		@close="close"
	>
		<Card
			:title="$t('home.planner.quickCreate.title')"
			:show-close="true"
			class="planner-quick-create"
			@close="close"
		>
			<form @submit.prevent="submit">
				<FormField
					v-model="title"
					:label="$t('task.attributes.title')"
					:error="fieldErrors.title"
					type="text"
				/>

				<FormField :label="$t('task.attributes.project')">
					<ProjectSearch v-model="projectModel" />
				</FormField>
				<p
					v-if="fieldErrors.project"
					class="help is-danger"
				>
					{{ fieldErrors.project }}
				</p>

				<FormField :label="$t('home.planner.quickCreate.when')">
					<Datepicker
						v-model="scheduledAt"
						:choose-date-label="$t('home.planner.quickCreate.chooseDate')"
					/>
				</FormField>

				<FormField :label="$t('home.planner.quickCreate.notes')">
					<template #default="{id}">
						<textarea
							:id="id"
							v-model="description"
							class="textarea planner-quick-create__textarea"
							:placeholder="$t('home.planner.quickCreate.notesPlaceholder')"
						/>
					</template>
				</FormField>

				<div class="planner-quick-create__actions">
					<XButton
						variant="tertiary"
						type="button"
						@click="close"
					>
						{{ $t('misc.cancel') }}
					</XButton>
					<XButton
						type="submit"
						:loading="loading"
					>
						{{ $t('misc.create') }}
					</XButton>
				</div>
			</form>
		</Card>
	</Modal>
</template>

<script setup lang="ts">
import {computed, ref, shallowReactive, watch} from 'vue'
import {useI18n} from 'vue-i18n'

import Card from '@/components/misc/Card.vue'
import Modal from '@/components/misc/Modal.vue'
import FormField from '@/components/input/FormField.vue'
import Datepicker from '@/components/input/Datepicker.vue'
import ProjectSearch from '@/components/tasks/partials/ProjectSearch.vue'

import TaskService from '@/services/task'
import ProjectModel from '@/models/project'
import TaskModel from '@/models/task'

import {success} from '@/message'
import {textToTaskDescription} from './planner'
import {useAuthStore} from '@/stores/auth'
import {useProjectStore} from '@/stores/projects'
import type {ITask} from '@/modelTypes/ITask'
import type {IProject} from '@/modelTypes/IProject'

const props = defineProps<{
	open: boolean
	scheduledAt: Date | null
}>()

const emit = defineEmits<{
	'close': []
	'created': [task: ITask]
}>()

const {t} = useI18n({useScope: 'global'})

const authStore = useAuthStore()
const projectStore = useProjectStore()
const taskService = shallowReactive(new TaskService())

const title = ref('')
const description = ref('')
const scheduledAt = ref<Date | null>(null)
const selectedProject = ref<IProject | undefined>(undefined)
const fieldErrors = ref({
	title: '',
	project: '',
})

const loading = computed(() => taskService.loading)
const projectModel = computed({
	get: () => selectedProject.value ?? new ProjectModel(),
	set: (project: IProject | null) => {
		selectedProject.value = project ? new ProjectModel(project) : undefined
	},
})

function resetForm() {
	title.value = ''
	description.value = ''
	scheduledAt.value = props.scheduledAt ? new Date(props.scheduledAt) : new Date()

	const defaultProjectId = authStore.settings.defaultProjectId
	selectedProject.value = defaultProjectId && projectStore.projects[defaultProjectId]
		? new ProjectModel(projectStore.projects[defaultProjectId])
		: undefined

	fieldErrors.value = {
		title: '',
		project: '',
	}
}

watch(
	() => [props.open, props.scheduledAt?.getTime() ?? 0],
	([isOpen]) => {
		if (isOpen) {
			resetForm()
		}
	},
	{immediate: true},
)

function close() {
	emit('close')
}

async function submit() {
	fieldErrors.value = {
		title: '',
		project: '',
	}

	if (title.value.trim() === '') {
		fieldErrors.value.title = t('project.create.addTitleRequired')
		return
	}

	if (!selectedProject.value || selectedProject.value.id === 0) {
		fieldErrors.value.project = t('project.create.addProjectRequired')
		return
	}

	const createdTask = await taskService.create(new TaskModel({
		title: title.value.trim(),
		description: textToTaskDescription(description.value),
		projectId: selectedProject.value.id,
		dueDate: scheduledAt.value ? scheduledAt.value.toISOString() : null,
	}))

	success({message: t('task.createSuccess')})
	emit('created', createdTask)
	emit('close')
}
</script>

<style lang="scss" scoped>
.planner-quick-create {
	inline-size: min(38rem, calc(100vw - 3rem));
	margin: 0 auto;
}

.planner-quick-create__textarea {
	min-block-size: 7rem;
	resize: vertical;
}

.planner-quick-create__actions {
	display: flex;
	justify-content: flex-end;
	gap: 0.75rem;
	margin-block-start: 1.5rem;
}
</style>
