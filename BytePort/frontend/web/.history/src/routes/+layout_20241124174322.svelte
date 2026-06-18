<script lang="ts">
	import '../app.css';
	import { user } from '../stores/user';
	let { children } = $props();
	interface VMInstance {
		Name: String;
		Status: String;
		OS: String;
		RootProject: Project;
		LastUpdated: String;
	}
	interface Project {
		UUID: String;
		Name: String;
		Description: String;
		LastUpdated: String;
		Status: String;
		Type: String;
		Instances: VMInstance[];
	}
	interface tempUser {
		Name: String;
		Email: String;
		Password: String;
	}
</script>

{@render children()}
