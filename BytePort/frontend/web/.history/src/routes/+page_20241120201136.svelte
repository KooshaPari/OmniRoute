<script lang="ts">
	const menuItems: String[] = ['Projects', 'Instances', 'Monitor', 'Settings'];
</script>

<div class="flex-col p-5" id="mainDashPar">
	<div class="flex-row bg-red-400" style="width:15vw; height:90vh" id="sideBar">
		<div id="sideBarProfileCont"></div>
		<ul id="menuList">
			{#each menuItems as menuItem}
				<li class="text-white">
					{menuItem}
				</li>
			{/each}
		</ul>
	</div>
	
	<div id="body">
		<div id="instanceSec"></div>
		<div id="projectsSec"></div>
	</div>
</div>

<style>
	#mainDashPar {
		background-color: #0e1514;
	}
</style>
