<script lang="ts">
	const menuItems: String[] = ['Projects', 'Instances', 'Monitor', 'Settings'];
</script>

<div class="bg-red"id="mainDashPar">
	<div id="sideBar">
		<div id="sideBarProfileCont"></div>
		<ul id="menuList">
			{#each menuItems as menuItem}
				<li class="menuItem active">
					{menuItem}
				</li>
			{/each}
		</ul>
	</div>
	<div id="header">
		<img class="-alt="BytePort"  style="width:10%" src="/src/assets/img/byteport.png" />
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
