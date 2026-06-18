<script lang="ts">
	import '../app.css';

	let { children } = $props();
	interface VMInstance {
		Name: String;
		Status: String;
		OS: String;
		RootProject: Project;
		LastUpdated: String;
	}
	interface Project {
		Name: String;
		Description: String;
		LastUpdated: String;
		Status: String;
		Type: String;
		Instances: VMInstance[];
	}
	interface User {
		Name: String;
		Ema
	}
</script>

{@render children()}

<style>
	@import '../app.css';
</style>
