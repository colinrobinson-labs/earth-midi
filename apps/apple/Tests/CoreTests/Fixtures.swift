import Foundation

/// The test tables live with the site's tests (repo/tests/fixtures) so the web engine and the apps check the same files.
enum Fixtures {
    static let dir: URL = {
        var u = URL(fileURLWithPath: #filePath) // …/apps/apple/Tests/CoreTests/Fixtures.swift
        for _ in 0..<5 { u.deleteLastPathComponent() }
        return u.appendingPathComponent("tests/fixtures")
    }()
    static func data(_ name: String) throws -> Data { try Data(contentsOf: dir.appendingPathComponent(name)) }
}
