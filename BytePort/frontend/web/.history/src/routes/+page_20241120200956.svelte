<script lang="ts">
	const menuItems: String[] = ['Projects', 'Instances', 'Monitor', 'Settings'];
</script>

<div class="flex-col" id="mainDashPar">
	<div class="bg-blue flex-row" style="width:15vw; height:50vh" id="sideBar">
		<div id="sideBarProfileCont"></div>
		<ul id="menuList">
			{#each menuItems as menuItem}
				<li class="text-white">
					{menuItem}
				</li>
			{/each}
		</ul>
	</div>
	<div id="header" class="flex-col" style="width:85vw; height: 10vh; background-color:red">
		<img alt="BytePort" style="width:10%" src="/src/assets/img/byteport.png" />
		<h1 style="color:#FAFAFF">TEST</h1>
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
