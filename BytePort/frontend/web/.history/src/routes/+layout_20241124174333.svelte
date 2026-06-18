<script lang="ts">
	import '../app.css';
	import { user } from '../stores/user';
	let { children } = $props();
	interface VMInstance {
		UUID: String;
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
	
</script>

{@render children()}
