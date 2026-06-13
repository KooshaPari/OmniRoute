```

BenchmarkDotNet v0.14.0, macOS 26.6 (25G5028f) [Darwin 25.6.0]
Apple M1 Pro, 1 CPU, 10 logical and 10 physical cores
.NET SDK 9.0.300
  [Host]     : .NET 9.0.5 (9.0.525.21509), Arm64 RyuJIT AdvSIMD
  Job-ZJIAJY : .NET 9.0.5 (9.0.525.21509), Arm64 RyuJIT AdvSIMD
  Dry        : .NET 9.0.5 (9.0.525.21509), Arm64 RyuJIT AdvSIMD

Runtime=.NET 9.0  LaunchCount=1  

```
| Method                               | Job        | IterationCount | RunStrategy | UnrollFactor | WarmupCount | Mean           | Error    | StdDev    | Gen0   | Allocated |
|------------------------------------- |----------- |--------------- |------------ |------------- |------------ |---------------:|---------:|----------:|-------:|----------:|
| &#39;Material creation + property setup&#39; | Job-ZJIAJY | 5              | Default     | 16           | 3           |       3.617 ns | 2.376 ns | 0.3677 ns | 0.0038 |      24 B |
| &#39;Material creation + property setup&#39; | Dry        | 1              | ColdStart   | 1            | 1           | 396,875.000 ns |       NA | 0.0000 ns |      - |     784 B |
