import XCTest
@testable import EarthMIDICore

/// "Same reading, same note": Music.swift must give exactly what the site gives.
/// The table is tests/fixtures/note-table.json, the same file tests/notes.test.mjs checks against js/audio.js.
final class NoteTableTests: XCTestCase {
    struct Table: Decodable {
        struct Defaults: Decodable { let root: Int; let tune: Double; let chordEvery: Double; let progClassic: [[Int]] }
        struct Scale: Decodable { let kp: Double; let name: String; let steps: [Int] }
        struct Degree: Decodable { let scale: String; let i: Int; let note: Int }
        struct Mtof: Decodable { let m: Double; let hz: Double }
        struct Name: Decodable { let n: Int; let name: String }
        struct Quake: Decodable { let depth: Double; let kp: Double; let note: Int; let step: Int; let steps: Int }
        struct Velocity: Decodable { let mag: Double; let vel: Int }
        struct Pan: Decodable { let lon: Double; let pan: Double }
        struct Chord: Decodable { let tempC: Double; let kp: Double; let note: Int }
        struct Flare: Decodable { let flux: Double; let cls: String }
        struct Moon: Decodable { let iso: String; let ms: Double; let illum: Double }
        struct Interp: Decodable { struct Case: Decodable { let at: Double; let value: Double }; let t: [Double]; let v: [Double]; let cases: [Case] }
        struct KpAt: Decodable { struct Case: Decodable { let at: Double; let kp: Double }; let t: [Double]; let v: [Double]; let cases: [Case] }
        struct Tide: Decodable { struct Case: Decodable { let at: Double; let norm: Double }; let t: [Double]; let v: [Double]; let cases: [Case] }
        let defaults: Defaults
        let scale: [Scale]
        let degree: [Degree]
        let mtof: [Mtof]
        let noteName: [Name]
        let quake: [Quake]
        let velocity: [Velocity]
        let pan: [Pan]
        let chord: [Chord]
        let flare: [Flare]
        let moon: [Moon]
        let interp: Interp
        let kpAt: KpAt
        let tide: Tide
    }

    private var table: Table!

    override func setUpWithError() throws {
        table = try JSONDecoder().decode(Table.self, from: Fixtures.data("note-table.json"))
    }

    private func near(_ got: Double, _ want: Double, _ what: String, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertEqual(got, want, accuracy: 1e-9 * max(1, abs(want)), what, file: file, line: line)
    }

    func testDefaults() {
        XCTAssertEqual(Music.root, table.defaults.root)
        XCTAssertEqual(Music.tune, table.defaults.tune)
        XCTAssertEqual(Music.chordEvery, table.defaults.chordEvery)
        XCTAssertEqual(Music.progClassic, table.defaults.progClassic)
    }

    func testKpPicksTheScale() {
        XCTAssertFalse(table.scale.isEmpty)
        for c in table.scale {
            XCTAssertEqual(Music.scale(kp: c.kp), c.steps, "Kp \(c.kp)")
            XCTAssertEqual(Music.scaleName(kp: c.kp), c.name, "Kp \(c.kp)")
        }
    }

    func testScaleStepToNote() {
        let scales = ["majPent": Music.majPent, "minPent": Music.minPent, "dorian": Music.dorian]
        XCTAssertFalse(table.degree.isEmpty)
        for c in table.degree {
            guard let sc = scales[c.scale] else { XCTFail("unknown scale \(c.scale)"); continue }
            XCTAssertEqual(Music.degree(sc, c.i), c.note, "\(c.scale) step \(c.i)")
        }
    }

    func testFrequencyAndName() {
        for c in table.mtof { near(Music.mtof(c.m), c.hz, "note \(c.m)") }
        for c in table.noteName { XCTAssertEqual(Music.noteName(c.n), c.name) }
    }

    func testQuakeNote() {
        XCTAssertFalse(table.quake.isEmpty)
        for c in table.quake {
            let r = Music.quakeNote(depth: c.depth, kp: c.kp)
            XCTAssertEqual(r.note, c.note, "\(c.depth) km at Kp \(c.kp)")
            XCTAssertEqual(r.step, c.step, "\(c.depth) km at Kp \(c.kp)")
            XCTAssertEqual(r.steps, c.steps, "\(c.depth) km at Kp \(c.kp)")
        }
    }

    func testVelocityAndPan() {
        for c in table.velocity { XCTAssertEqual(Music.velocity(mag: c.mag), c.vel, "M\(c.mag)") }
        for c in table.pan { near(Music.quakePan(lon: c.lon), c.pan, "lon \(c.lon)") }
    }

    func testPlanetChord() {
        XCTAssertFalse(table.chord.isEmpty)
        for c in table.chord { XCTAssertEqual(Music.chordNote(tempC: c.tempC, kp: c.kp), c.note, "\(c.tempC) °C at Kp \(c.kp)") }
    }

    func testFlareClass() {
        for c in table.flare { XCTAssertEqual(Music.flareClass(c.flux), c.cls, "flux \(c.flux)") }
        XCTAssertEqual(Music.flareClass(.nan), "–")
    }

    func testMoon() {
        for c in table.moon { near(moonIllumination(Date(timeIntervalSince1970: c.ms / 1000)), c.illum, c.iso) }
    }

    func testReadingsBetweenSamples() {
        let s = Series(t: table.interp.t, v: table.interp.v)
        for c in table.interp.cases { near(s.at(c.at), c.value, "t=\(c.at)") }
        XCTAssertTrue(Series().at(5).isNaN, "no data is NaN, never a made-up number")
    }

    func testKpAtAMoment() {
        var r = EarthReadings()
        XCTAssertEqual(r.kp(at: 0), 2, "no Kp yet = quiet sky")
        r.kp = Series(t: table.kpAt.t, v: table.kpAt.v)
        for c in table.kpAt.cases { XCTAssertEqual(r.kp(at: c.at), c.kp, "t=\(c.at)") }
    }

    func testTideLevel() {
        var r = EarthReadings()
        XCTAssertEqual(r.tideNorm(at: 0), 0, "no station = flat")
        r.tides = [PlaceSeries(place: Place(name: "test", lat: 0, lon: 0), series: Series(t: table.tide.t, v: table.tide.v))]
        for c in table.tide.cases { near(r.tideNorm(at: c.at), c.norm, "t=\(c.at)") }
        XCTAssertEqual(r.tideNorm(at: 0, station: 3), 0)
    }
}
