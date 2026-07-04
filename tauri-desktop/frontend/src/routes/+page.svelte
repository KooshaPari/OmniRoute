<script lang="ts">
	type HealthStatus = {
		status?: string;
		ok?: boolean;
		uptime?: number;
		version?: string;
		timestamp?: string;
		[key: string]: unknown;
	};

	let health = $state<HealthStatus | null>(null);
	let loading = $state(true);
	let error = $state('');
	let lastChecked = $state('');

	async function loadHealth() {
		loading = true;
		error = '';

		try {
			const response = await fetch('http://localhost:20128/api/monitoring/health');
			if (!response.ok) {
				throw new Error(`Health check failed with HTTP ${response.status}`);
			}

			health = (await response.json()) as HealthStatus;
			lastChecked = new Date().toLocaleTimeString();
		} catch (unknownError) {
			health = null;
			error = unknownError instanceof Error ? unknownError.message : 'Unable to reach OmniRoute';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		loadHealth();
		const interval = window.setInterval(loadHealth, 15000);

		return () => window.clearInterval(interval);
	});

	const statusText = $derived.by(() =>
		loading ? 'Checking' : error ? 'Offline' : health?.status ?? (health?.ok ? 'Healthy' : 'Online')
	);
</script>

<svelte:head>
	<title>OmniRoute Desktop</title>
</svelte:head>

<main class="shell">
	<section class="summary" aria-label="OmniRoute status">
		<div>
			<p class="eyebrow">OmniRoute Desktop</p>
			<h1>Status Dashboard</h1>
		</div>
		<div class:error class:loading class="status-pill">
			<span></span>
			{statusText}
		</div>
	</section>

	<section class="panel" aria-live="polite">
		<div class="panel-header">
			<div>
				<h2>Monitoring Health</h2>
				<p>GET http://localhost:20128/api/monitoring/health</p>
			</div>
			<button type="button" onclick={loadHealth} disabled={loading}>
				{loading ? 'Checking' : 'Refresh'}
			</button>
		</div>

		{#if error}
			<p class="message error-message">{error}</p>
		{:else if health}
			<dl class="metrics">
				<div>
					<dt>Status</dt>
					<dd>{statusText}</dd>
				</div>
				<div>
					<dt>Version</dt>
					<dd>{health.version ?? 'unknown'}</dd>
				</div>
				<div>
					<dt>Uptime</dt>
					<dd>{typeof health.uptime === 'number' ? `${Math.round(health.uptime)}s` : 'unknown'}</dd>
				</div>
				<div>
					<dt>Last Checked</dt>
					<dd>{lastChecked || 'pending'}</dd>
				</div>
			</dl>

			<pre>{JSON.stringify(health, null, 2)}</pre>
		{:else}
			<p class="message">Checking OmniRoute health...</p>
		{/if}
	</section>
</main>

<style>
	:global(body) {
		margin: 0;
		background: #0f172a;
		color: #e5e7eb;
		font-family:
			Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	}

	.shell {
		box-sizing: border-box;
		min-height: 100vh;
		padding: 40px;
		background:
			radial-gradient(circle at 18% 12%, rgba(20, 184, 166, 0.22), transparent 28%),
			linear-gradient(135deg, #111827 0%, #0f172a 48%, #111827 100%);
	}

	.summary,
	.panel {
		width: min(960px, 100%);
		margin: 0 auto;
	}

	.summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		margin-bottom: 24px;
	}

	.eyebrow {
		margin: 0 0 8px;
		color: #5eead4;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	h1,
	h2,
	p {
		margin: 0;
	}

	h1 {
		font-size: clamp(2rem, 5vw, 4rem);
		line-height: 1;
	}

	h2 {
		font-size: 1.1rem;
	}

	.status-pill {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		min-width: 120px;
		justify-content: center;
		border: 1px solid rgba(34, 197, 94, 0.5);
		border-radius: 999px;
		padding: 10px 14px;
		background: rgba(22, 163, 74, 0.16);
		color: #bbf7d0;
		font-weight: 700;
	}

	.status-pill span {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: #22c55e;
	}

	.status-pill.error {
		border-color: rgba(248, 113, 113, 0.5);
		background: rgba(220, 38, 38, 0.16);
		color: #fecaca;
	}

	.status-pill.error span {
		background: #ef4444;
	}

	.status-pill.loading span {
		background: #f59e0b;
	}

	.panel {
		box-sizing: border-box;
		border: 1px solid rgba(148, 163, 184, 0.24);
		border-radius: 8px;
		padding: 24px;
		background: rgba(15, 23, 42, 0.78);
		box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28);
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 20px;
	}

	.panel-header p {
		margin-top: 6px;
		color: #94a3b8;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.86rem;
		overflow-wrap: anywhere;
	}

	button {
		border: 0;
		border-radius: 6px;
		padding: 10px 14px;
		background: #14b8a6;
		color: #042f2e;
		cursor: pointer;
		font-weight: 800;
	}

	button:disabled {
		cursor: wait;
		opacity: 0.65;
	}

	.metrics {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 12px;
		margin: 0 0 20px;
	}

	.metrics div {
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 8px;
		padding: 14px;
		background: rgba(30, 41, 59, 0.72);
	}

	dt {
		color: #94a3b8;
		font-size: 0.74rem;
		font-weight: 700;
		text-transform: uppercase;
	}

	dd {
		margin: 8px 0 0;
		font-size: 1rem;
		font-weight: 700;
		overflow-wrap: anywhere;
	}

	.message {
		color: #cbd5e1;
	}

	.error-message {
		color: #fecaca;
	}

	pre {
		overflow: auto;
		max-height: 320px;
		margin: 0;
		border-radius: 8px;
		padding: 16px;
		background: #020617;
		color: #cbd5e1;
		font-size: 0.86rem;
	}

	@media (max-width: 720px) {
		.shell {
			padding: 24px 16px;
		}

		.summary,
		.panel-header {
			align-items: stretch;
			flex-direction: column;
		}

		.status-pill,
		button {
			width: 100%;
		}

		.metrics {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 460px) {
		.metrics {
			grid-template-columns: 1fr;
		}
	}
</style>
