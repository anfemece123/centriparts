// Structural guarantee for spec requirement #36 ("no realices llamadas
// reales a OpenAI en pruebas"): global fetch is disabled for the whole
// test run. Every OpenAI-touching unit under test accepts an injected
// fetchImpl for exactly this reason — if a test forgets to inject one,
// it fails loudly here instead of silently hitting the network.
globalThis.fetch = (() => {
  throw new Error(
    'Real network calls are disabled in tests. Pass a mocked fetchImpl instead.',
  )
}) as typeof fetch
