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
		// Personal Details
		Name: String;
		Email: String;
		Token: String;
		// API
		aws: {
			accessKeyId: String;
			secretAccessKey: String;
		}
		openAI:{
			apiKey: String
		}
		portfolio: {
			rootEndpoint: String;
			apiKey: String
		}
		git: {
			repoUrl: String;
			authMethod: String;
			authKey: String
			targetDirectory: String
		}
		
	}
</script>

{@render children()}

<style>
	@import '../app.css';
</style>
