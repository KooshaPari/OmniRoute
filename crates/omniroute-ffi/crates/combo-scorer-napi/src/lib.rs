use napi_derive::napi;
use napi::bindgen_prelude::Float32Array;

const SCORING_FACTOR_COUNT: usize = 12;

#[inline(always)]
fn score_candidate(factors: &[f32; 12], weights: &[f32; 14]) -> f32 {
    let mut sum = 0.0f32;
    for i in 0..12 {
        sum += factors[i] * weights[i];
    }
    sum += weights[12] * factors[0].min(factors[1]);
    sum += weights[13] * factors[10].max(factors[11]);
    sum
}

#[napi]
pub fn score_simd_batch(
    candidate_features: Float32Array,
    candidates: u32,
    _max_cost: f64,
    _max_latency: f64,
) -> Vec<f32> {
    let candidates = candidates as usize;
    let data = &candidate_features;
    if data.is_empty() || candidates == 0 {
        return vec![];
    }

    let weights_start = candidates * SCORING_FACTOR_COUNT;
    let weights_end = weights_start + 14;

    if data.len() < weights_end {
        return vec![];
    }

    let weights: [f32; 14] = [
        data[weights_start], data[weights_start + 1], data[weights_start + 2],
        data[weights_start + 3], data[weights_start + 4], data[weights_start + 5],
        data[weights_start + 6], data[weights_start + 7], data[weights_start + 8],
        data[weights_start + 9], data[weights_start + 10], data[weights_start + 11],
        data[weights_start + 12], data[weights_start + 13],
    ];

    let mut results = Vec::with_capacity(candidates);
    for i in 0..candidates {
        let offset = i * SCORING_FACTOR_COUNT;
        let factors: [f32; 12] = [
            data[offset], data[offset + 1], data[offset + 2],
            data[offset + 3], data[offset + 4], data[offset + 5],
            data[offset + 6], data[offset + 7], data[offset + 8],
            data[offset + 9], data[offset + 10], data[offset + 11],
        ];
        results.push(score_candidate(&factors, &weights));
    }
    results
}

#[napi]
pub fn health_check() -> bool {
    true
}
