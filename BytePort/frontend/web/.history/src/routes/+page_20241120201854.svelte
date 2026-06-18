<script lang="ts">
    interface Type VMInstance {
        Name: String;
        Status: String;
        OS:
    }
	const menuItems: String[] = ['Projects', 'Instances', 'Monitor', 'Settings'];
	let instances: VMInstance[] = [];
</script>

<div class="flex p-5" id="mainDashPar">
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
			{#each instances as instance}{/each}
		</div>
		<div id="projectsSec" class="w-5/5 h-2/5 bg-green-200"></div>
	</div>
</div>

<style>
	#mainDashPar {
		background-color: #0e1514;
	}
</style>
