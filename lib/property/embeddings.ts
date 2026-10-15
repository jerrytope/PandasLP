// Turns a client's question into the same kind of 384-number vector the law library's sections
// carry, so the library can be searched by meaning, not only by words. The seed's vectors were
// made with gte-small (identified 15 Oct 2026 by re-embedding seed sections: cosine 0.99 against
// the stored vectors; every other 384-dimension model scored 0.59 or less), with mean pooling
// and normalisation. The query side must use the same model.
//
// The model runs inside this server (@huggingface/transformers, ONNX): no API key, no per-search
// cost. It is downloaded once (tens of MB) to TRANSFORMERS_CACHE_DIR (default: the OS temp dir)
// and loaded on the first search; later searches reuse it.
//
// When adding laws to the library, embed each section's text as
//   "<title> (<citation>), section <N>: <heading>\n\n<content>"
// which is the format that best reproduces the seed's own vectors.

import os from 'node:os'
import path from 'node:path'

export type Embedder = (text: string) => Promise<number[]>

export const EMBEDDING_MODEL = 'Supabase/gte-small'
export const EMBEDDING_DIMENSIONS = 384

type Dtype = 'fp32' | 'q8'
type Extractor = (text: string, opts: { pooling: 'mean'; normalize: boolean }) => Promise<{ data: Float32Array }>

const loading = new Map<Dtype, Promise<Extractor>>()

function load(dtype: Dtype): Promise<Extractor> {
  let promise = loading.get(dtype)
  if (!promise) {
    promise = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers')
      env.cacheDir = process.env.TRANSFORMERS_CACHE_DIR || path.join(os.tmpdir(), 'pandaslp-models')
      return (await pipeline('feature-extraction', EMBEDDING_MODEL, { dtype })) as unknown as Extractor
    })()
    // A failed load (no network on first use) is retried on the next search, not cached.
    promise.catch(() => loading.delete(dtype))
    loading.set(dtype, promise)
  }
  return promise
}

/** gte-small, loaded on first use. `q8` is the smaller download; `fp32` the full model. */
export function gteSmallEmbedder(dtype: Dtype = 'q8'): Embedder {
  return async (text) => {
    const extractor = await load(dtype)
    const out = await extractor(text, { pooling: 'mean', normalize: true })
    return Array.from(out.data)
  }
}
