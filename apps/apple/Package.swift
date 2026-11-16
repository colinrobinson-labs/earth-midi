// swift-tools-version:5.9
// Unit tests for the parts of the apps that have no screen: the note rules and the snapshot decoding.
// The apps themselves are built from project.yml (XcodeGen); this package exists only so `swift test` can run
// those two files on their own, in seconds, with no simulator.   cd apps/apple && swift test
import PackageDescription

let package = Package(
    name: "EarthMIDICore",
    platforms: [.macOS(.v14)],
    targets: [
        .target(name: "EarthMIDICore", path: "Shared/Core", sources: ["Music.swift", "EarthData.swift"]),
        .testTarget(name: "EarthMIDICoreTests", dependencies: ["EarthMIDICore"], path: "Tests/CoreTests"),
    ]
)
