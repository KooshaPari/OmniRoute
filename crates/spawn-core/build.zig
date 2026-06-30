const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    // --- Static library consumed by Rust via build.rs / extern "C" ---
    const lib_module = b.createModule(.{
        .root_source_file = b.path("src/spawn_core.zig"),
        .target = target,
        .optimize = optimize,
    });
    lib_module.link_libc = true;

    const lib = b.addLibrary(.{
        .name = "spawn_core",
        .root_module = lib_module,
        .linkage = .static,
    });
    b.installArtifact(lib);

    // --- Test step: `zig build test` ---
    const test_module = b.createModule(.{
        .root_source_file = b.path("src/spawn_core.zig"),
        .target = target,
        .optimize = optimize,
    });
    test_module.link_libc = true;

    const unit_tests = b.addTest(.{
        .root_module = test_module,
    });

    const run_tests = b.addRunArtifact(unit_tests);
    const test_step = b.step("test", "Run spawn-core unit tests");
    test_step.dependOn(&run_tests.step);
}
