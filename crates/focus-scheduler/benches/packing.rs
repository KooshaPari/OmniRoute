// SPDX-License-Identifier: MIT OR Apache-2.0
// Benchmark: Priority-weighted bin-packing scheduler performance
// Traces to: FR-PLAN-002
//
// Measures scheduling latency for realistic task volumes (100 tasks, 20 calendar windows).
// Target: <5ms per plan() call.

use chrono::{Duration, TimeZone, Utc};
use criterion::{black_box, criterion_group, criterion_main, Criterion};
use focus_calendar::CalendarEvent;
use focus_domain::Rigidity;
use focus_planning::{ChunkingPolicy, Deadline, DurationSpec, Priority, Task, TaskStatus};
use focus_scheduler::{Scheduler, WorkingHoursSpec};
use uuid::Uuid;

fn now() -> chrono::DateTime<Utc> {
    // Friday 2026-05-01 09:00 UTC
    Utc.with_ymd_and_hms(2026, 5, 1, 9, 0, 0).unwrap()
}

fn create_benchmark_tasks(count: usize) -> Vec<Task> {
    (0..count)
        .map(|i| {
            let duration_mins = (20 + (i % 60)) as i64;
            let priority = 0.2 + ((i as f32 % 10.0) / 10.0);
            let ts = now() - Duration::hours((count - i) as i64);
            Task {
                id: Uuid::new_v4(),
                title: format!("task_{}", i),
                priority: Priority::new(priority),
                duration: DurationSpec::fixed(Duration::minutes(duration_mins)),
                chunking: ChunkingPolicy::atomic(),
                constraints: vec![],
                deadline: if i % 5 == 0 {
                    Deadline::hard(now() + Duration::hours(12))
                } else {
                    Deadline::soft(now() + Duration::days(1))
                },
                created_at: ts,
                updated_at: ts,
                status: TaskStatus::Pending,
            }
        })
        .collect()
}

fn create_benchmark_calendar_events(count: usize) -> Vec<CalendarEvent> {
    (0..count)
        .map(|i| {
            let start_offset = Duration::hours((i as i64 * 2) % 16);
            CalendarEvent {
                id: format!("cal_event_{}", i),
                title: format!("Meeting {}", i),
                starts_at: now() + start_offset,
                ends_at: now() + start_offset + Duration::minutes(45),
                source: "calendar".into(),
                rigidity: if i % 3 == 0 { Rigidity::Hard } else { Rigidity::Soft },
            }
        })
        .collect()
}

fn benchmark_scheduling(c: &mut Criterion) {
    let rt = std::sync::Mutex::new(tokio::runtime::Runtime::new().unwrap());

    let mut group = c.benchmark_group("scheduler_bin_packing");
    group.sample_size(10); // Use fewer samples for long-running tests

    group.bench_function("50_tasks_10_events", |b| {
        b.iter(|| {
            let rt = rt.lock().unwrap();
            rt.block_on(async {
                let scheduler = Scheduler::new(WorkingHoursSpec::default());
                let tasks = black_box(create_benchmark_tasks(50));
                let events = black_box(create_benchmark_calendar_events(10));
                let _sched =
                    scheduler.plan(&tasks, &events, now(), Duration::hours(24)).await.unwrap();
            })
        });
    });

    group.bench_function("100_tasks_20_events", |b| {
        b.iter(|| {
            let rt = rt.lock().unwrap();
            rt.block_on(async {
                let scheduler = Scheduler::new(WorkingHoursSpec::default());
                let tasks = black_box(create_benchmark_tasks(100));
                let events = black_box(create_benchmark_calendar_events(20));
                let _sched =
                    scheduler.plan(&tasks, &events, now(), Duration::hours(24)).await.unwrap();
            })
        });
    });

    group.bench_function("200_tasks_40_events", |b| {
        b.iter(|| {
            let rt = rt.lock().unwrap();
            rt.block_on(async {
                let scheduler = Scheduler::new(WorkingHoursSpec::default());
                let tasks = black_box(create_benchmark_tasks(200));
                let events = black_box(create_benchmark_calendar_events(40));
                let _sched =
                    scheduler.plan(&tasks, &events, now(), Duration::hours(24)).await.unwrap();
            })
        });
    });

    group.finish();
}

criterion_group!(benches, benchmark_scheduling);
criterion_main!(benches);
