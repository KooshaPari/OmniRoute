<script lang="ts">
  import { onMount } from 'svelte';

  let mounted = $state(false);

  onMount(() => {
    mounted = true;
  });
</script>

<svelte:head>
  <title>OmniRoute - Intelligent AI Routing</title>
  <meta name="description" content="Route, optimize, and manage your AI model traffic with intelligent routing and cost control." />
</svelte:head>

<div class="min-h-screen bg-gradient-to-b from-gray-50 to-white">
  <!-- Hero -->
  <section class="max-w-5xl mx-auto px-4 pt-20 pb-16 text-center">
    <h1 class="text-5xl font-extrabold tracking-tight text-gray-900 mb-6">
      Intelligent AI Routing
    </h1>
    <p class="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
      Route, optimize, and manage your AI model traffic.
      Reduce costs, improve latency, and maintain reliability across providers.
    </p>
    <div class="flex gap-4 justify-center">
      <a
        href="/login"
        class="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors"
      >
        Get Started
      </a>
      <a
        href="/docs"
        class="px-6 py-3 rounded-lg border border-gray-300 hover:border-gray-400 text-gray-700 font-semibold transition-colors"
      >
        Documentation
      </a>
    </div>
  </section>

  <!-- Features -->
  <section class="max-w-5xl mx-auto px-4 py-16">
    <h2 class="text-3xl font-bold text-center mb-12">Why OmniRoute?</h2>
    <div class="grid md:grid-cols-3 gap-8">
      <div class="p-6 rounded-xl border border-gray-200 bg-white">
        <h3 class="text-lg font-semibold mb-3">Smart Routing</h3>
        <p class="text-gray-600">
          Automatically route requests to the best provider based on cost, latency, and availability.
        </p>
      </div>
      <div class="p-6 rounded-xl border border-gray-200 bg-white">
        <h3 class="text-lg font-semibold mb-3">Cost Control</h3>
        <p class="text-gray-600">
          Set budgets, track usage, and get alerts before you overspend across all your AI providers.
        </p>
      </div>
      <div class="p-6 rounded-xl border border-gray-200 bg-white">
        <h3 class="text-lg font-semibold mb-3">Unified Analytics</h3>
        <p class="text-gray-600">
          Single dashboard for all providers. Compare performance, track tokens, and export reports.
        </p>
      </div>
    </div>
  </section>

  <!-- CTA -->
  <section class="max-w-5xl mx-auto px-4 py-16 text-center">
    <h2 class="text-3xl font-bold mb-4">Ready to optimize your AI traffic?</h2>
    <p class="text-gray-600 mb-8">Start free. No credit card required.</p>
    <a
      href="/login"
      class="inline-block px-8 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors"
    >
      Start Free Trial
    </a>
  </section>
</div>
