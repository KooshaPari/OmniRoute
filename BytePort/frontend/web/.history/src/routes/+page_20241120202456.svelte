<script lang="ts">
	interface VMInstance {
		Name: String;
		Status: String;
		OS: String;
		Project: String;
		LastUpdated: String;
	}
	const menuItems: String[] = ['Projects', 'Instances', 'Monitor', 'Settings'];
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

<div class="flex h-screen w-screen p-5" id="mainDashPar">
	<div class="h-5/5 w-1/5 flex-row bg-red-400" id="sideBar">
		<div id="sideBarProfileCont"></div>
		<ul id="menuList">
			{#each menuItems as menuItem}
				<li class="text-white">
					<button>
						{menuItem}
					</button>
				</li>
			{/each}
		</ul>
	</div>

	<div id="body">
		<div id="header" class="w-5/5 h-1/5 flex-col bg-red-300">
			<img alt="BytePort" style="width:10%" src="/src/assets/img/byteport.png" />
			<h1 style="color:#FAFAFF">TEST</h1>
		</div>
		<div id="instanceSec" class="w-5/5 h-2/5 bg-blue-900">
			<h1>Instances</h1>
			<div id="instances" class="grid grid-flow-col grid-cols-4 grid-rows-4 over">
				{#each instances as instance}
					<div class="instanceCont border-vi] m-0.5 bg-cyan-800">
						<h1>{instance.Name}</h1>
						<h2>{instance.Status}</h2>
						<h3>{instance.OS}</h3>
						<h4>{instance.Project}</h4>
						<h5>{instance.LastUpdated}</h5>
					</div>
				{/each}
			</div>
		</div>
		<div id="projectsSec" class="w-5/5 h-2/5 bg-green-200"></div>
	</div>
</div>

<style>
	#mainDashPar {
		background-color: #0e1514;
	}
	#mainDashPar * {
		overflow: hidden;
	}
</style>
