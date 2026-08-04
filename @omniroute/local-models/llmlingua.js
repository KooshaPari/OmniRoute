/**
 * Runtime boundary for the LLMLingua local compression stack.
 *
 * The companion owns this complete closure so the base OmniRoute install can
 * fail open when local models were not explicitly installed.
 */
export async function loadLlmlinguaRuntime() {
  const [transformers, llmlingua, tiktoken, ranks] = await Promise.all([
    import("@huggingface/transformers"),
    import("@atjsh/llmlingua-2"),
    import("js-tiktoken/lite"),
    import("js-tiktoken/ranks/o200k_base"),
  ]);

  return {
    env: transformers.env,
    LLMLingua2: llmlingua.LLMLingua2,
    Tiktoken: tiktoken.Tiktoken,
    o200k_base: ranks.default,
  };
}
