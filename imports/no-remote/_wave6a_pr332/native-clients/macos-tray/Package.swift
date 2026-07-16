// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "OmniRouteTray",
    platforms: [.macOS(.v13)],
    products: [
        .executable(name: "OmniRouteTray", targets: ["OmniRouteTray"])
    ],
    targets: [
        .executableTarget(name: "OmniRouteTray")
    ]
)
