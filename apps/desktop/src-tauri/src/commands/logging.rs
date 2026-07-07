use std::sync::Arc;

use omniroute_gateway::log_stream::RingBuffer;
use tauri::State;

#[tauri::command]
pub fn tail_logs(buffer: State<'_, Arc<RingBuffer>>, n: usize) -> Vec<String> {
    buffer.tail(n.min(8192))
}
