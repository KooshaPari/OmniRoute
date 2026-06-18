<script lang="ts">
	import Icon from '@iconify/svelte';
	import Project from '../+layout.svelte';
	import VMInstance from '../+layout.svelte';
	import { onMount, onDestroy } from 'svelte';
	import type { User } from '../../stores/user';
	import { setUser, user } from '../../stores/user';
	import { goto } from '$app/navigation';
	let client: User | null = null;

	onMount(() => {
		const unsubscribe = user.subscribe((value) => {
			client = value.data;
			//console.log('V: ', value);
			if (value.status != 'authenticated') {
				goto('/signup');
			}
		});
		onDestroy(() => {
			unsubscribe();
		});
	});
	const menuItems: String[] = ['Projects', 'Instances', 'Monitor', 'Settings'];
	let projects: Project[] = [
		{
			Name: 'Project 1',
			Description: 'Description 1',
			LastUpdated: '2023-02-15',
			Status: 'Active',
			Type: 'Type A',
			Instances: []
		},
		{
			Name: 'Project 2',
			Description: 'Description 2',
			LastUpdated: '2023-02-12',
			Status: 'Inactive',
			Type: 'Type B',
			Instances: []
		},
		{
			Name: 'Project 3',
			Description: 'Description 3',
			LastUpdated: '2023-02-18',
			Status: 'Active',
			Type: 'Type A',
			Instances: []
		},
		{
			Name: 'Project 4',
			Description: 'Description 4',
			LastUpdated: '2023-02-10',
			Status: 'Pending',
			Type: 'Type C',
			Instances: []
		},
		{
			Name: 'Project 5',
			Description: 'Description 5',
			LastUpdated: '2023-02-16',
			Status: 'Active',
			Type: 'Type B',
			Instances: []
		},
		{
			Name: 'Project 6',
			Description: 'Description 6',
			LastUpdated: '2023-02-14',
			Status: 'Inactive',
			Type: 'Type A',
			Instances: []
		},
		{
			Name: 'Project 7',
			Description: 'Description 7',
			LastUpdated: '2023-02-19',
			Status: 'Active',
			Type: 'Type C',
			Instances: []
		},
		{
			Name: 'Project 8',
			Description: 'Description 8',
			LastUpdated: '2023-02-11',
			Status: 'Pending',
			Type: 'Type B',
			Instances: []
		},
		{
			Name: 'Project 9',
			Description: 'Description 9',
			LastUpdated: '2023-02-17',
			Status: 'Active',
			Type: 'Type A',
			Instances: []
		},
		{
			Name: 'Project 10',
			Description: 'Description 10',
			LastUpdated: '2023-02-13',
			Status: 'Inactive',
			Type: 'Type C',
			Instances: []
		}
	];
	let instances: VMInstance[] = [
		{
			Name: 'Instance 1',
			Status: 'Running',
			OS: 'Ubuntu',
			Project: 'Project A',
			LastUpdated: '2023-02-15'
		},
		{
			Name: 'Instance 2',
			Status: 'Stopped',
			OS: 'Windows',
			Project: 'Project B',
			LastUpdated: '2023-02-12'
		},
		{
			Name: 'Instance 3',
			Status: 'Running',
			OS: 'CentOS',
			Project: 'Project A',
			LastUpdated: '2023-02-18'
		},
		{
			Name: 'Instance 4',
			Status: 'Pending',
			OS: 'Ubuntu',
			Project: 'Project C',
			LastUpdated: '2023-02-10'
		},
		{
			Name: 'Instance 5',
			Status: 'Running',
			OS: 'Red Hat',
			Project: 'Project B',
			LastUpdated: '2023-02-16'
		},
		{
			Name: 'Instance 6',
			Status: 'Stopped',
			OS: 'Windows',
			Project: 'Project A',
			LastUpdated: '2023-02-14'
		},
		{
			Name: 'Instance 7',
			Status: 'Running',
			OS: 'Debian',
			Project: 'Project C',
			LastUpdated: '2023-02-19'
		},
		{
			Name: 'Instance 8',
			Status: 'Pending',
			OS: 'Ubuntu',
			Project: 'Project B',
			LastUpdated: '2023-02-11'
		},
		{
			Name: 'Instance 9',
			Status: 'Running',
			OS: 'CentOS',
			Project: 'Project A',
			LastUpdated: '2023-02-17'
		},
		{
			Name: 'Instance 10',
			Status: 'Stopped',
			OS: 'Windows',
			Project: 'Project C',
			LastUpdated: '2023-02-13'
		},
		{
			Name: 'Instance 11',
			Status: 'Running',
			OS: 'Red Hat',
			Project: 'Project B',
			LastUpdated: '2023-02-15'
		},
		{
			Name: 'Instance 12',
			Status: 'Pending',
			OS: 'Ubuntu',
			Project: 'Project A',
			LastUpdated: '2023-02-09'
		},
		{
			Name: 'Instance 13',
			Status: 'Running',
			OS: 'Debian',
			Project: 'Project C',
			LastUpdated: '2023-02-20'
		},
		{
			Name: 'Instance 14',
			Status: 'Stopped',
			OS: 'Windows',
			Project: 'Project B',
			LastUpdated: '2023-02-12'
		},
		{
			Name: 'Instance 15',
			Status: 'Running',
			OS: 'CentOS',
			Project: 'Project A',
			LastUpdated: '2023-02-18'
		},
		{
			Name: 'Instance 16',
			Status: 'Pending',
			OS: 'Ubuntu',
			Project: 'Project C',
			LastUpdated: '2023-02-10'
		},
		{
			Name: 'Instance 17',
			Status: 'Running',
			OS: 'Red Hat',
			Project: 'Project B',
			LastUpdated: '2023-02-16'
		},
		{
			Name: 'Instance 18',
			Status: 'Stopped',
			OS: 'Windows',
			Project: 'Project A',
			LastUpdated: '2023-02-14'
		},
		{
			Name: 'Instance 19',
			Status: 'Running',
			OS: 'Debian',
			Project: 'Project C',
			LastUpdated: '2023-02-19'
		},
		{
			Name: 'Instance 20',
			Status: 'Pending',
			OS: 'Ubuntu',
			Project: 'Project B',
			LastUpdated: '2023-02-11'
		}
	];
</script>

<div class="bg-dark-surface flex h-screen w-screen overflow-x-hidden" id="mainDashPar">
	<div
		class="h-5/5 flex-ro bg-dark-surfaceContainer w-1/5 items-center justify-center"
		id="sideBar"
	>
		<img class="py-10" alt="BytePort" src="/src/assets/img/byte.png" />
		<div id="sideBarProfileCont"></div>
		<ul class="" id="menuList">
			{#each menuItems as menuItem}
				<li class=" text-md w-5/5 py-2 text-center text-white">
					<button
						class="hover:bg-dark-surfaceContainerHigh active:bg-dark-surfaceContainer active:text-dark-surfaceBright w-4/5 py-2 text-center transition-all hover:-translate-y-1
						hover:rounded-full active:translate-y-0.5"
					>
						{menuItem}
					</button>
				</li>
			{/each}
		</ul>
	</div>

	<div id="body" class="w-4/5">
		<div
			id="header"
			class=" w-5/5 bg-dark-surfaceContainerLow h-1/5 flex-col justify-between ps-2.5"
		>
			<div id="headerNav" class="h-3/5 pt-2.5">
				<div class="flex justify-end pe-2.5" id="navRight">
					<Icon
						class="hover:text-dark-primary active:text-dark-surfaceBright mx-1 h-6 w-6 cursor-pointer text-white"
						icon="ic:baseline-notifications"
					/>
					<Icon
						class="hover:text-dark-primary active:text-dark-surfaceBright mx-1 h-6 w-6 cursor-pointer text-white"
						icon="ic:baseline-account-circle"
					/>
				</div>
			</div>
			<div id="headerContent" class="h-2/5 text-4xl text-white">Hello.</div>
		</div>
		<div id="mainBody">
			<div id="instanceSec" class="w-5/5 h-2/5 overflow-x-scroll">
				<h1 class="text-dark-secondary p-2">Instances</h1>
				<div id="instances" class="flex w-max overflow-y-visible p-2">
					{#each instances as instance}
						<div
							class="bg-dark-surfaceContainerHigh text-dark-onSurface m-0.5 mx-1.5 h-64 w-48 rounded-lg transition-all hover:-translate-y-2 hover:scale-105 active:translate-y-1 active:scale-100"
						>
							<img
								src="/src/assets/img/byteport copy.png"
								alt="BytePort"
								class="h-5/5 bg-dark-surfaceContainerHighest p-2"
							/>
							<div
								class=" bg-dark-surfaceContainerHigh grid-flow-col grid-cols-2 px-2 pb-3 pt-1 text-sm"
							>
								<p>{instance.Name}</p>
								<p>{instance.Status}</p>
								<p>{instance.OS}</p>
								<p>{instance.Project}</p>
								<p>{instance.LastUpdated}</p>
							</div>
						</div>
					{/each}
				</div>
			</div>
			<div id="projectsSec" class="w-5/5 h-2/5 overflow-x-scroll">
				<h1 class="text-dark-secondary p-2">Projects</h1>
				<div id="projects" class="flex w-max overflow-y-visible p-2">
					{#each projects as project}
						<div
							class="bg-dark-surfaceContainerHigh text-dark-onSurface m-0.5 mx-1.5 h-64 w-48 rounded-lg transition-all hover:-translate-y-2 hover:scale-105 active:translate-y-1 active:scale-100"
						>
							<img
								src="/src/assets/img/byteport copy.png"
								alt="BytePort"
								class="h-5/5 bg-dark-surfaceContainerHighest p-2"
							/>
							<div class="h-5/5 bg-dark-surfaceContainerHigh flex-col px-2 pb-3 pt-3 text-sm">
								<h1>{project.Name}</h1>
								<h2>{project.Status}</h2>
								<h5>{project.LastUpdated}</h5>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
		<div id="footer"></div>
	</div>
</div>

<style>
</style>
