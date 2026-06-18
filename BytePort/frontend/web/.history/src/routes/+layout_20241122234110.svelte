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
	interface tempUser {
		Name: String;
		Email: String;
		Password: String;

	}
	interface User {
		Name: String;
		Email: String;
		Password: String;
		
	}
</script>

{@render children()}

<style>
	@import '../app.css';
</style>
