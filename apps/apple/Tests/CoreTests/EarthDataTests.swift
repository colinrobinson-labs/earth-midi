import XCTest
@testable import EarthMIDICore

/// Decoding of earthmidi.com/data/live.json. The sample (tests/fixtures/live-sample.json) is written by the real
/// snapshot job from made-up source answers, and tests/snapshot.test.mjs fails if the job's output changes shape.
final class EarthDataTests: XCTestCase {
    private func sample() throws -> Data { try Fixtures.data("live-sample.json") }
    private func json(_ s: String) -> Any { try! JSONSerialization.jsonObject(with: Data(s.utf8)) }

    func testSnapshotDecodesEveryFeedTheAppsUse() throws {
        let data = try sample()
        let root = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        let r = try XCTUnwrap(EarthData.parseSnapshot(data))

        XCTAssertEqual(r.snapshotAt?.timeIntervalSince1970 ?? 0, try XCTUnwrap(root["at"] as? Double) / 1000, accuracy: 0.001)
        XCTAssertEqual(r.weatherSource, "open-meteo")
        XCTAssertFalse(r.isAppleWeather)
        XCTAssertFalse(r.isDemo)

        // quakes: oldest first, missing magnitude = 0, depth never negative
        XCTAssertEqual(r.quakes.map(\.id), ["ak0260000002", "us7000aaaa", "ci40000001"])
        XCTAssertEqual(r.quakes.map(\.mag), [0, 5.8, 1.2])
        XCTAssertEqual(r.quakes.map(\.depth), [612, 35.2, 0])
        XCTAssertEqual(r.quakes[1].lat, 39.8); XCTAssertEqual(r.quakes[1].lon, 142.6)
        XCTAssertEqual(r.quakes[1].place, "112 km SE of Hachinohe, Japan")
        XCTAssertNil(r.quakes[0].url); XCTAssertNotNil(r.quakes[1].url)
        XCTAssertEqual(r.latest?.id, "ci40000001")

        // solar wind: 14 minutes of readings, a gap in density stays a gap
        XCTAssertEqual(r.speed.v, (0..<14).map { 400 + Double($0) * 5 })
        XCTAssertEqual(r.speed.t, r.speed.t.sorted())
        XCTAssertEqual(r.speed.t[1] - r.speed.t[0], 60, accuracy: 0.001)
        XCTAssertEqual(r.density.v[0], 4); XCTAssertTrue(r.density.v[3].isNaN); XCTAssertEqual(r.density.v.count, 14)
        XCTAssertEqual(r.bz.v.first, -3); XCTAssertEqual(r.bz.v.last, 3.5); XCTAssertEqual(r.bt.v.first, 6)

        XCTAssertEqual(r.kp.v, [1.33, 2.67, 4.33, 5])
        XCTAssertEqual(r.kp(at: r.kp.t[1] + 1), 2.67)
        XCTAssertEqual(r.kp(at: r.kp.t[3] + 9e6), 5)
        XCTAssertEqual(r.xray.v.count, 12)
        XCTAssertEqual(r.xray.v[0], 1e-6, accuracy: 1e-12); XCTAssertEqual(r.xray.v[11], 1.2e-5, accuracy: 1e-12)
        XCTAssertEqual(r.dst.v, [-10, -14, -18])

        // Open-Meteo feeds keep the point order of js/feeds.js
        XCTAssertEqual(r.ocean.map(\.place.name), EarthData.oceanPts.map(\.name))
        XCTAssertEqual(r.ocean[2].period, 5.0, accuracy: 1e-9)
        XCTAssertEqual(r.ocean[3].series.v.count, 48)
        XCTAssertEqual(r.ocean[3].series.v[10], 4.234, accuracy: 1e-9)
        XCTAssertEqual(r.ocean[3].series.t[1] - r.ocean[3].series.t[0], 3600, accuracy: 0.001)
        XCTAssertEqual(r.jet.map(\.place.name), EarthData.jetPts.map(\.name))
        XCTAssertEqual(r.jet[5].series.v[0], 5)
        XCTAssertEqual(r.temps.map(\.place.name), EarthData.cities.map(\.name))
        XCTAssertEqual(r.temps[2].series.v[47], 7.7998, accuracy: 1e-9)

        XCTAssertEqual(r.tides.map(\.place.name), ["La Jolla", "The Battery, NY", "Honolulu"])
        for t in r.tides {
            XCTAssertEqual(t.series.v.count, 10)
            XCTAssertEqual(t.series.v[0], 0.5, accuracy: 1e-9); XCTAssertEqual(t.series.v[9], 1.4, accuracy: 1e-9)
            XCTAssertEqual(t.series.t[1] - t.series.t[0], 360, accuracy: 0.001)
        }
        XCTAssertEqual(r.tideNorm(at: r.tides[0].series.t[9]), 1, accuracy: 1e-9)
        XCTAssertEqual(r.tideNorm(at: r.tides[0].series.t[0]), -1, accuracy: 1e-9)
    }

    func testWeatherKitSnapshotIsRecognised() throws {
        var root = try XCTUnwrap(JSONSerialization.jsonObject(with: sample()) as? [String: Any])
        var feeds = try XCTUnwrap(root["feeds"] as? [String: Any])
        let key = try XCTUnwrap(feeds.keys.first { $0.contains("hourly=temperature_2m&past_days") })
        var entry = try XCTUnwrap(feeds[key] as? [String: Any])
        entry["src"] = "weatherkit"
        feeds[key] = entry
        root["feeds"] = feeds
        root["wk"] = ["name": "Apple Weather", "legal": "https://example.com/legal", "logo": ["dark": "apple-weather-dark.png"]] as [String: Any]
        let r = try XCTUnwrap(EarthData.parseSnapshot(JSONSerialization.data(withJSONObject: root)))
        XCTAssertEqual(r.weatherSource, "weatherkit")
        XCTAssertTrue(r.isAppleWeather)
        XCTAssertEqual(r.weatherLegal.absoluteString, "https://example.com/legal")
        XCTAssertEqual(r.weatherLogo?.absoluteString, "https://earthmidi.com/data/apple-weather-dark.png")
    }

    func testBrokenSnapshotsNeverCrash() {
        XCTAssertNil(EarthData.parseSnapshot(Data("<html>502 Bad Gateway</html>".utf8)))
        XCTAssertNil(EarthData.parseSnapshot(Data("[]".utf8)))
        XCTAssertNil(EarthData.parseSnapshot(Data(#"{"v":1,"at":1}"#.utf8)))
        let empty = EarthData.parseSnapshot(Data(#"{"v":1,"feeds":{}}"#.utf8))
        XCTAssertNotNil(empty)
        XCTAssertTrue(empty?.quakes.isEmpty ?? false)
        XCTAssertTrue(empty?.tides.isEmpty ?? false)
        // feeds present but holding the wrong kind of thing
        let odd = #"{"v":1,"feeds":{"https://x/all_day.geojson":{"at":1,"data":"nope"},"https://x/rtsw_wind_1m.json":{"at":1,"data":{"a":1}},"https://x/marine-api":{"at":1,"data":[1,2,3]},"https://x/noaa-planetary-k-index.json":{"at":1,"data":[]}}}"#
        let r = EarthData.parseSnapshot(Data(odd.utf8))
        XCTAssertNotNil(r)
        XCTAssertTrue(r?.quakes.isEmpty ?? false); XCTAssertTrue(r?.speed.isEmpty ?? false); XCTAssertTrue(r?.kp.isEmpty ?? false)
    }

    func testQuakesSkipWhatCannotBePlaced() {
        let q = EarthData.parseQuakes(json(#"""
        {"features":[
          {"id":"b","properties":{"mag":2.5,"place":"later","time":2000},"geometry":{"coordinates":[10,20,30]}},
          {"id":"a","properties":{"mag":"4.1","time":1000},"geometry":{"coordinates":[-10.5,-20.5]}},
          {"properties":{"mag":3,"time":1500},"geometry":{"coordinates":[1,2,3]}},
          {"id":"no-time","properties":{"mag":3},"geometry":{"coordinates":[1,2,3]}},
          {"id":"no-place","properties":{"mag":3,"time":1500},"geometry":{"coordinates":[1]}},
          {"id":"no-geometry","properties":{"mag":3,"time":1500}}
        ]}
        """#))
        XCTAssertEqual(q.map(\.id), ["a", "b"])
        XCTAssertEqual(q[0].mag, 4.1); XCTAssertEqual(q[0].depth, 0); XCTAssertEqual(q[0].place, "")
        XCTAssertEqual(q[0].time, Date(timeIntervalSince1970: 1))
        XCTAssertEqual(q[1].depth, 30)
        XCTAssertTrue(EarthData.parseQuakes(json("[]")).isEmpty)
    }

    func testSpaceWeatherTimeFormats() {
        let want = 1_794_064_320.0 // 2026-11-07 15:12:00 UTC
        for s in ["2026-11-07 15:12:00.000", "2026-11-07 15:12:00", "2026-11-07T15:12:00", "2026-11-07T15:12:00Z", "2026-11-07T16:12:00+01:00"] {
            XCTAssertEqual(EarthData.swpcTime(s), want, s)
        }
        XCTAssertNil(EarthData.swpcTime("yesterday"))
        XCTAssertNil(EarthData.swpcTime(nil))
        XCTAssertNil(EarthData.swpcTime(12345))
        XCTAssertEqual(EarthData.isoTime("2026-11-07T15:12:00.500Z") ?? 0, want + 0.5, accuracy: 0.001)
    }

    func testKpInBothShapesNOAAHasUsed() {
        let table = EarthData.parseKp(json(#"[["time_tag","Kp","a_running"],["2026-11-07 18:00:00.000","3.33","18"],["2026-11-07 15:00:00.000","2.00","7"],["2026-11-07 21:00:00.000","","0"],["bad"]]"#))
        XCTAssertEqual(table.v, [2, 3.33], "sorted by time, blank and short rows dropped")
        let objects = EarthData.parseKp(json(#"[{"time_tag":"2026-11-07T15:00:00","kp_index":2},{"time_tag":"2026-11-07T18:00:00","Kp":3.33},{"time_tag":"2026-11-07T21:00:00","estimated_kp":4}]"#))
        XCTAssertEqual(objects.v, [2, 3.33])
        XCTAssertEqual(objects.t, table.t)
        XCTAssertTrue(EarthData.parseKp(json(#"[["time_tag","something_else"],["2026-11-07 18:00:00","1"]]"#)).isEmpty)
        XCTAssertTrue(EarthData.parseKp(json(#"{"error":"down"}"#)).isEmpty)
    }

    func testNumbersArriveAsNumbersOrText() {
        XCTAssertEqual(EarthData.num(1.5), 1.5)
        XCTAssertEqual(EarthData.num(3), 3)
        XCTAssertEqual(EarthData.num("0.250"), 0.25)
        XCTAssertEqual(EarthData.num(NSNumber(value: 7)), 7)
        XCTAssertNil(EarthData.num(""))
        XCTAssertNil(EarthData.num("n/a"))
        XCTAssertNil(EarthData.num(nil))
        XCTAssertNil(EarthData.num(NSNull()))
    }

    func testHourlySeriesKeepsGapsAsGaps() {
        let h = json(#"{"time":["2026-11-07T00:00","2026-11-07T01:00","2026-11-07T02:00:00","2026-11-07T03:00"],"temperature_2m":[1.5,null,3.5]}"#) as? [String: Any]
        let s = EarthData.omSeries(h, "temperature_2m")
        XCTAssertEqual(s.t.count, 3, "no value for the fourth hour = no fourth point")
        XCTAssertEqual(s.v[0], 1.5); XCTAssertTrue(s.v[1].isNaN); XCTAssertEqual(s.v[2], 3.5)
        XCTAssertEqual(s.t[2] - s.t[0], 7200)
        XCTAssertEqual(s.last, 3.5)
        XCTAssertTrue(EarthData.omSeries(h, "wind").isEmpty)
        XCTAssertTrue(EarthData.omSeries(nil, "temperature_2m").isEmpty)
        // a gap next to a reading: use the reading, never a blend with nothing
        XCTAssertEqual(s.at(s.t[0] + 1800), 1.5)
        XCTAssertEqual(s.at(s.t[1] + 1800), 3.5)
    }

    func testAveragesIgnoreMissingPoints() {
        var r = EarthReadings()
        XCTAssertTrue(r.jet(at: 0).isNaN)
        XCTAssertEqual(r.ocean(at: 0).h, 0); XCTAssertEqual(r.ocean(at: 0).p, 8)
        let p = Place(name: "x", lat: 0, lon: 0)
        r.jet = [PlaceSeries(place: p, series: Series(t: [0, 10], v: [100, 200])), PlaceSeries(place: p, series: Series(t: [0, 10], v: [.nan, .nan])), PlaceSeries(place: p, series: Series())]
        XCTAssertEqual(r.jet(at: 5), 150)
        var a = PlaceSeries(place: p, series: Series(t: [0, 10], v: [1, 3])); a.period = 6
        var b = PlaceSeries(place: p, series: Series()); b.period = 10
        r.ocean = [a, b]
        XCTAssertEqual(r.ocean(at: 5).h, 2); XCTAssertEqual(r.ocean(at: 5).p, 8)
    }

    func testDemoDataIsLabelled() {
        let d = EarthData.demo()
        XCTAssertTrue(d.isDemo)
        XCTAssertEqual(d.quakes.count, 120)
        XCTAssertTrue(d.quakes.allSatisfy { $0.place == "demo data" && $0.mag >= 0.8 && $0.mag <= 5.3 && $0.depth >= 0 })
        XCTAssertEqual(d.kpNow, 2)
    }
}
