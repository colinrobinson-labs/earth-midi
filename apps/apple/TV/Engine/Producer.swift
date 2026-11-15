import Foundation

/// The producer settings the TV exposes (a subset of the site's CFG, same names and defaults as js/core.js DEF).
/// Saved on this Apple TV, carried into presets, and handed to earthmidi.com by the "Open on iPhone" QR code.
struct ProducerConfig: Codable, Equatable {
    var key = 2, oct = 0, scale = "auto", prog = "classic", chordEvery = 8.0
    var style = "ambient"
    var genre = "custom", pattern = "four", bpmMin = 112.0, bpmMax = 134.0, bpmLock = 0.0, swing = 0.0, hats = 1.0, duck = 0.45, tempoSrc = "sun"
    var instQ = "bell", instS = "saw", instI = "pluck", instU = "chime", bass = "sawtooth"
    var revType = "hall", rev = -1.0, len = 1.0, mmin = 0.0, region = "world"
    var drive = 0.2, mlp = 20000.0
    var vol: [String: Double] = ["q": 1, "s": 1, "o": 1, "x": 1, "w": 1, "t": 1, "c": 1, "r": 1, "i": 0.8, "e": 0.9, "g": 0.9, "a": 1, "u": 0.9]

    var root: Int { 48 + key + 12 * oct }
    func level(_ k: Character) -> Double { vol[String(k)] ?? 1 }

    /// Scale for a Kp (Auto follows the sky like the site)
    func steps(kp: Double) -> [Int] {
        if scale != "auto", let s = Tunings.scales[scale] { return s }
        return Music.scale(kp: kp)
    }
    func scaleLabel(kp: Double) -> String {
        scale == "auto" ? "\(Music.scaleName(kp: kp)) (Kp \(String(format: "%.1f", kp)))" : (Tunings.scaleNames[scale] ?? scale)
    }
    func progression(kp: Double) -> [[Int]] {
        if prog == "kp" { return kp >= 4 ? Tunings.progs["minor"]! : Tunings.progs["classic"]! }
        return Tunings.progs[prog] ?? Music.progClassic
    }

    /// Apply a factory preset over the defaults (js applyPreset: presets layer onto DEF)
    static func preset(_ p: FactoryPreset) -> ProducerConfig {
        var c = ProducerConfig()
        p.apply(&c)
        return c
    }

    /// earthmidi.com share link (js shareURL: #s= base64 of {cfg, style, mode}); the site merges it over its defaults
    func shareURL(live: Bool) -> URL {
        var cfg: [String: Any] = ["key": key, "oct": oct, "scale": scale, "prog": prog, "chordEvery": chordEvery,
                                  "genre": genre, "pattern": pattern, "bpmMin": bpmMin, "bpmMax": bpmMax, "bpmLock": bpmLock, "swing": swing, "hats": hats, "duck": duck, "tempoSrc": tempoSrc,
                                  "revType": revType, "rev": rev, "len": len, "mmin": mmin, "region": region, "drive": drive, "mlp": mlp, "vol": vol,
                                  "inst": ["q": instQ, "s": instS, "i": instI, "u": instU]]
        cfg["snd"] = ["rBass": bass]
        let body: [String: Any] = ["cfg": cfg, "style": style, "mode": live ? 0 : 180]
        let data = (try? JSONSerialization.data(withJSONObject: body, options: [.sortedKeys])) ?? Data()
        return URL(string: "https://earthmidi.com/#s=" + data.base64EncodedString())!
    }
}

struct FactoryPreset: Identifiable {
    let id: String
    let line: String
    let tint: Character
    let apply: (inout ProducerConfig) -> Void
    var tempo: String {
        var c = ProducerConfig(); apply(&c)
        if c.style != "pulse" { return "AMBIENT" }
        return c.bpmLock > 0 ? "\(Int(c.bpmLock)) BPM" : "\(Int(c.bpmMin))–\(Int(c.bpmMax)) BPM"
    }
}

enum Tunings {
    static let keys = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    static let scales: [String: [Int]] = ["majpent": [0,2,4,7,9], "minpent": [0,3,5,7,10], "dorian": [0,2,3,5,7,9,10], "lydian": [0,2,4,6,7,9,11], "mixo": [0,2,4,5,7,9,10], "phrygian": [0,1,3,5,7,8,10], "aeolian": [0,2,3,5,7,8,10], "ionian": [0,2,4,5,7,9,11], "harmmin": [0,2,3,5,7,8,11], "hirajoshi": [0,2,3,7,8], "insen": [0,1,5,7,10], "pelog": [0,1,3,7,8], "blues": [0,3,5,6,7,10], "wholetone": [0,2,4,6,8,10], "chromatic": [0,1,2,3,4,5,6,7,8,9,10,11]]
    static let scaleOrder = ["auto", "majpent", "minpent", "ionian", "aeolian", "dorian", "lydian", "mixo", "phrygian", "harmmin", "blues", "hirajoshi", "insen", "pelog", "wholetone", "chromatic"]
    static let scaleNames = ["auto": "Auto (Kp)", "majpent": "Major pent", "minpent": "Minor pent", "ionian": "Major", "aeolian": "Minor", "dorian": "Dorian", "lydian": "Lydian", "mixo": "Mixolydian", "phrygian": "Phrygian", "harmmin": "Harmonic minor", "blues": "Blues", "hirajoshi": "Hirajoshi", "insen": "In-sen", "pelog": "Pelog", "wholetone": "Whole tone", "chromatic": "Chromatic"]
    static let progs: [String: [[Int]]] = ["classic": [[0,2,4,7],[5,7,9,12],[3,5,7,10],[4,6,8,11]], "minor": [[0,2,4,7],[5,7,9,12],[2,4,6,9],[6,8,10,13]], "modal": [[0,2,4,7],[1,3,5,8],[0,2,4,7],[6,8,10,13]], "drone": [[0,4,7,11],[0,4,7,11],[0,4,7,11],[0,4,7,11]], "rising": [[0,2,4,7],[1,3,5,8],[2,4,6,9],[3,5,7,10]]]
    static let progOrder = ["classic", "minor", "modal", "rising", "drone", "kp"]
    static let progNames = ["classic": "Classic", "minor": "Minor", "modal": "Modal", "rising": "Rising", "drone": "Drone", "kp": "Follows Kp"]
    static let quakeInst = ["bell", "marimba", "glass", "gong", "pluck"]
    static let quakeInstNames = ["bell": "FM bell", "marimba": "Marimba", "glass": "Glass", "gong": "Gong", "pluck": "Pluck"]
    static let padTypes = ["saw", "hollow", "soft", "glass"]
    static let padNames = ["saw": "Analog saw", "hollow": "Hollow", "soft": "Soft", "glass": "Glass"]
    static let issInst = ["pluck", "glass", "square", "sine"]
    static let issNames = ["pluck": "Pluck", "glass": "Glass", "square": "Square", "sine": "Sine ping"]
    static let sunInst = ["chime", "warm", "soft"]
    static let sunNames = ["chime": "Chime", "warm": "Warm", "soft": "Soft"]
    static let rooms = ["hall", "plate", "room", "cathedral", "cave", "space"]
    static let roomNames = ["hall": "Hall", "plate": "Plate", "room": "Room", "cathedral": "Cathedral", "cave": "Cave", "space": "Deep space"]
    static let tempoSrc = ["sun", "quakes", "tides", "kp", "jet", "storms"]
    static let tempoNames = ["sun": "Solar wind", "quakes": "Quake rate", "tides": "Tide height", "kp": "Kp", "jet": "Jet stream", "storms": "Severe storms"]
    static let regions = ["world", "ring", "americas", "asia", "japan", "indo", "andes", "eurmed", "alaska", "california"]
    static let regionNames = ["world": "Whole planet", "ring": "Pacific Ring of Fire", "americas": "Americas", "asia": "Asia-Pacific", "japan": "Japan", "indo": "Indonesia", "andes": "Andes", "eurmed": "Europe, Med & Middle East", "alaska": "Alaska", "california": "California"]
    /// lat min, lat max, lon min, lon max (js REGIONS)
    static let regionBoxes: [String: [[Double]]] = ["ring": [[-60,90,100,180],[-60,90,-180,-60]], "americas": [[-60,75,-170,-30]], "asia": [[-50,60,60,180]], "eurmed": [[25,72,-25,60]], "alaska": [[50,72,-180,-130]], "california": [[32,42,-125,-114]], "japan": [[24,46,122,150]], "indo": [[-12,8,94,142]], "andes": [[-56,12,-82,-62]]]
    static func inRegion(_ r: String, lat: Double, lon: Double) -> Bool {
        guard let boxes = regionBoxes[r] else { return true }
        return boxes.contains { lat >= $0[0] && lat <= $0[1] && lon >= $0[2] && lon <= $0[3] }
    }

    // MARK: Pulse (js/groove.js)
    static let grooves: [String: (String, GrooveSteps)] = [
        "four": ("Four on the floor", GrooveSteps(k: "x...x...x...x...", s: "....x.......x...", h: ".-x-.-x-.-x-.-x-", b: "..x...x...x...x.", bl: 1.6)),
        "house": ("House", GrooveSteps(k: "x...x...x...x...", s: "....x.......x...", h: "x.o.x.o.x.o.x.o.", b: "..x...x...x..xx.", bl: 1.5, trim: 0.86)),
        "deep": ("Deep house", GrooveSteps(k: "x...x...x...x...", s: "....r.......x...", h: "..o...o...o...o.", b: "..x..x....x...x.", bl: 2)),
        "tech": ("Tech house", GrooveSteps(k: "x...x...x...x...", s: "....x.......x...", h: "xxoxxxoxxxoxxxox", b: ".xx..xx..xx..xx.", bl: 0.9, trim: 0.86)),
        "afro": ("Afro house", GrooveSteps(k: "x...x...x...x...", s: "...r..r....r..r.", h: "x.xo.x.xx.xo.x.x", b: "x..x...x..x.....", bl: 2)),
        "disco": ("Disco house", GrooveSteps(k: "x...x...x...x...", s: "....x.......x...", h: "..o...o...o...o.", b: "x.o.x.o.x.o.x.o.", bl: 1.4, trim: 0.86)),
        "amapiano": ("Amapiano", GrooveSteps(k: "x...x...x...x...", s: "....r.......r...", h: "x.xox.xox.xox.xo", b: "..x..x.x...x.x..", bl: 2.4)),
        "peak": ("Peak-time techno", GrooveSteps(k: "x...x...x...x...", s: "....x.......x...", h: "xxoxxxoxxxoxxxox", b: "..x...x...x...x.", bl: 1.4, trim: 0.86)),
        "hypno": ("Hypnotic techno", GrooveSteps(k: "x...x...x...x..g", s: "......r.......r.", h: "-.o--.o--.o--.o-", b: ".x.x.x.x.x.x.x.x", bl: 0.9)),
        "minimal": ("Minimal", GrooveSteps(k: "x...x...x...x...", s: "....r......r.r..", h: "..o...o.x.o...o.", b: "x..x..x..x......", bl: 1.4)),
        "trance": ("Trance", GrooveSteps(k: "x...x...x...x...", s: "....x.......x...", h: "..o...o...o...o.", b: ".xxx.xxx.xxx.xxx", bl: 0.8, trim: 0.86)),
        "break": ("Breakbeat", GrooveSteps(k: "x.........x.x...", s: "....x.......x..x", h: "x.x.x.x.x.x.x.xo", b: "x.........x.x...", bl: 2, trim: 0.86)),
        "ukg": ("UK garage 2-step", GrooveSteps(k: "x......x..x.....", s: "....x.......x...", h: "..x...x...x...x.", b: "x......x..x.....", bl: 2.4)),
        "dubstep": ("Dubstep half-time", GrooveSteps(k: "x.........x.....", s: "........x.......", h: "x.x.x.x.x.x.x.x.", b: "x.......x.x.....", bl: 3.5)),
        "trap": ("Trap", GrooveSteps(k: "x......x..x.....", s: "........x.......", h: "xxxxxxxxxxxxxxxx", b: "x......x..x.....", bl: 5)),
        "liquid": ("Liquid DnB", GrooveSteps(k: "x.........x.....", s: "....x.......x...", h: "x.x.x.x.x.x.x.x.", b: "x.........x.....", bl: 6)),
        "neuro": ("Neuro DnB", GrooveSteps(k: "x.........x..x..", s: "....x.......x...", h: "x.xxx.xxx.xxx.xx", b: "x..x......x..x..", bl: 2.6)),
        "jungle": ("Jungle", GrooveSteps(k: "x.........x.x...", s: "....x..r....x.r.", h: "x.xxx.x.x.xxx.x.", b: "x.........x.....", bl: 6, trim: 0.86)),
        "boombap": ("Boom bap", GrooveSteps(k: "x......x..x.....", s: "....x.......x...", h: "x.x.x.x.x.x.x.x.", b: "x......x..x.....", bl: 3)),
        "lofi": ("Lo-fi", GrooveSteps(k: "x.......x.x.....", s: "....x.......x...", h: "x.x.x.x.x.x.x.x.", b: "x.......x.......", bl: 5)),
        "triphop": ("Trip-hop", GrooveSteps(k: "x.....x...x.....", s: "....x.......x...", h: "x.x.x.x.x.x.x.x.", b: "x.........x.....", bl: 5)),
        "chill": ("Chill beat", GrooveSteps(k: "x.........x.....", s: "........x.......", h: "..x...x...x...x.", b: "x...............", bl: 8)),
        "dembow": ("Dembow", GrooveSteps(k: "x...x...x...x...", s: "...x..x....x..x.", h: "x.x.x.x.x.x.x.x.", b: "x..x..x.x..x..x.", bl: 1.8)),
        "half": ("Half-time", GrooveSteps(k: "x.......x.......", s: "........x.......", h: "x.x.x.x.x.x.x.x.", b: "x.......x.......", bl: 4)),
        "broken": ("Broken", GrooveSteps(k: "x..x......x..x..", s: "....x.......x...", h: "x.x.x.x.x.x.x.x.", b: "x..x......x..x..", bl: 2))]

    struct Genre: Identifiable { let id: String, name: String, fam: String, g: String, lo: Double, hi: Double, sw: Double, src: String, duck: Double, hats: Double, tip: String }
    /// Genres whose tempo source needs the weather grid (wind, rain, pressure, temperature) use the closest live feed the TV has.
    static let genres: [Genre] = [
        .init(id: "deep", name: "Deep house", fam: "House", g: "deep", lo: 118, hi: 124, sw: 0.1, src: "jet", duck: 0.5, hats: 1, tip: "Warm offbeat hats"),
        .init(id: "tech", name: "Tech house", fam: "House", g: "tech", lo: 124, hi: 128, sw: 0.06, src: "quakes", duck: 0.55, hats: 1, tip: "Rolling bass, quakes push it"),
        .init(id: "afro", name: "Afro house", fam: "House", g: "afro", lo: 118, hi: 124, sw: 0.12, src: "tides", duck: 0.45, hats: 1, tip: "Rim and shaker groove, follows the tide"),
        .init(id: "disco", name: "Disco house", fam: "House", g: "disco", lo: 120, hi: 126, sw: 0.04, src: "sun", duck: 0.45, hats: 1, tip: "Octave bass, solar wind tempo"),
        .init(id: "amapiano", name: "Amapiano", fam: "House", g: "amapiano", lo: 110, hi: 115, sw: 0.15, src: "storms", duck: 0.35, hats: 1, tip: "Log-drum bass, storms push it"),
        .init(id: "peak", name: "Peak-time techno", fam: "Techno", g: "peak", lo: 130, hi: 140, sw: 0.02, src: "sun", duck: 0.65, hats: 1, tip: "Straight and driving"),
        .init(id: "hypno", name: "Hypnotic techno", fam: "Techno", g: "hypno", lo: 120, hi: 130, sw: 0.04, src: "kp", duck: 0.5, hats: 1, tip: "Rim and rolling sub"),
        .init(id: "minimal", name: "Minimal", fam: "Techno", g: "minimal", lo: 122, hi: 128, sw: 0.1, src: "kp", duck: 0.45, hats: 1, tip: "Sparse clicks, follows Kp"),
        .init(id: "trance", name: "Trance", fam: "Techno", g: "trance", lo: 132, hi: 140, sw: 0, src: "jet", duck: 0.6, hats: 1, tip: "Rolling 16th bass, jet stream tempo"),
        .init(id: "break", name: "Breakbeat", fam: "Breaks + UK", g: "break", lo: 125, hi: 135, sw: 0.06, src: "jet", duck: 0.4, hats: 1, tip: "Broken kick"),
        .init(id: "ukg", name: "UK garage 2-step", fam: "Breaks + UK", g: "ukg", lo: 130, hi: 136, sw: 0.22, src: "storms", duck: 0.4, hats: 1, tip: "Heavy swing, skippy kick"),
        .init(id: "dubstep", name: "Dubstep", fam: "Breaks + UK", g: "dubstep", lo: 138, hi: 142, sw: 0.04, src: "storms", duck: 0.55, hats: 1, tip: "Half-time snare on 3"),
        .init(id: "liquid", name: "Liquid DnB", fam: "Drum & bass", g: "liquid", lo: 170, hi: 174, sw: 0.04, src: "tides", duck: 0.35, hats: 1, tip: "Two-step with long sub"),
        .init(id: "neuro", name: "Neurofunk", fam: "Drum & bass", g: "neuro", lo: 172, hi: 176, sw: 0, src: "sun", duck: 0.5, hats: 1, tip: "Tight and busy"),
        .init(id: "jungle", name: "Jungle", fam: "Drum & bass", g: "jungle", lo: 160, hi: 170, sw: 0.08, src: "quakes", duck: 0.35, hats: 1, tip: "Choppy snares, quake rate"),
        .init(id: "boombap", name: "Boom bap", fam: "Hip-hop", g: "boombap", lo: 84, hi: 96, sw: 0.18, src: "kp", duck: 0.3, hats: 1, tip: "Swung 8ths"),
        .init(id: "trap", name: "Trap", fam: "Hip-hop", g: "trap", lo: 136, hi: 150, sw: 0, src: "storms", duck: 0.3, hats: 1.6, tip: "16th hats, long 808"),
        .init(id: "lofi", name: "Lo-fi", fam: "Hip-hop", g: "lofi", lo: 70, hi: 88, sw: 0.22, src: "tides", duck: 0.25, hats: 1, tip: "Lazy swing"),
        .init(id: "triphop", name: "Trip-hop", fam: "Downtempo", g: "triphop", lo: 80, hi: 100, sw: 0.1, src: "tides", duck: 0.3, hats: 1, tip: "Heavy and slow"),
        .init(id: "chill", name: "Chill beat", fam: "Downtempo", g: "chill", lo: 62, hi: 88, sw: 0.08, src: "jet", duck: 0.2, hats: 1, tip: "Sparse half-time"),
        .init(id: "reggaeton", name: "Reggaeton", fam: "Latin + Caribbean", g: "dembow", lo: 88, hi: 100, sw: 0.04, src: "sun", duck: 0.35, hats: 1, tip: "Dembow snare")]
    static func applyGenre(_ id: String, to c: inout ProducerConfig) {
        guard let g = genres.first(where: { $0.id == id }) else { c.genre = "custom"; return }
        c.genre = id; c.style = "pulse"; c.pattern = g.g; c.bpmMin = g.lo; c.bpmMax = g.hi; c.bpmLock = 0; c.swing = g.sw; c.tempoSrc = g.src; c.duck = g.duck; c.hats = g.hats
    }

    // MARK: factory presets (js/ui.js PRESETS), each applied over the defaults
    static let presets: [FactoryPreset] = [
        .init(id: "Deep ambient", line: "Slow cathedral wash. Only quakes above M1.5 ring through.", tint: "o") { c in
            c.style = "ambient"; c.rev = 0.9; c.revType = "cathedral"; c.len = 1.6; c.mmin = 1.5
            c.vol.merge(["q": 0.9, "s": 1.2, "o": 1.1, "x": 0.8, "w": 0.7, "t": 1, "c": 1.2, "r": 0, "u": 1]) { $1 } },
        .init(id: "Seismic techno", line: "Four on the floor, marimba quakes locked to the grid.", tint: "q") { c in
            c.style = "pulse"; c.scale = "minpent"; c.pattern = "four"; c.bpmMin = 124; c.bpmMax = 136; c.swing = 0.08; c.duck = 0.6; c.len = 0.5; c.rev = 0.45; c.revType = "plate"; c.instQ = "marimba"
            c.vol.merge(["q": 1, "s": 0.6, "o": 0.4, "x": 0.5, "w": 0.5, "t": 0.7, "c": 0.4, "r": 1.2, "e": 0.5]) { $1 } },
        .init(id: "Broken planet", line: "Broken beat at 84–96 in Phrygian, swung and tape-driven.", tint: "x") { c in
            c.style = "pulse"; c.pattern = "broken"; c.scale = "phrygian"; c.bpmMin = 84; c.bpmMax = 96; c.swing = 0.16; c.drive = 0.5; c.instQ = "pluck"; c.instS = "hollow"; c.revType = "room" },
        .init(id: "Ring of Fire", line: "Pacific Rim quakes from M2.5, struck as gongs in Hirajoshi.", tint: "e") { c in
            c.region = "ring"; c.mmin = 2.5; c.scale = "hirajoshi"; c.len = 1.3; c.instQ = "gong"
            c.vol.merge(["q": 1.3, "s": 0.8, "o": 0.8, "x": 0.6, "w": 0.5, "t": 0.8, "c": 0.6, "r": 0.8]) { $1 } },
        .init(id: "Space weather", line: "Solar wind, X-rays, the magnetosphere and the ISS up front.", tint: "g") { c in
            c.scale = "lydian"; c.rev = 0.85; c.revType = "space"; c.instI = "glass"
            c.vol.merge(["q": 0.3, "s": 1.4, "o": 0.3, "x": 1.5, "w": 0.6, "t": 0.3, "c": 0.5, "r": 0.6, "g": 1.4, "i": 1.2]) { $1 } },
        .init(id: "Ocean & tides", line: "Swell and tide lead in Dorian, with a long tail.", tint: "t") { c in
            c.scale = "dorian"; c.rev = 0.8
            c.vol.merge(["q": 0.3, "s": 0.5, "o": 1.5, "x": 0.3, "w": 0.9, "t": 1.5, "c": 0.8, "r": 0]) { $1 } },
        .init(id: "Dawn chorus", line: "Sunrise and sunset over 42 cities, warm major pentatonic.", tint: "u") { c in
            c.scale = "majpent"; c.instU = "warm"; c.revType = "hall"; c.rev = 0.8
            c.vol.merge(["q": 0.4, "s": 0.8, "o": 0.6, "x": 0.4, "w": 0.4, "t": 0.6, "c": 0.8, "r": 0, "u": 1.5, "i": 0.6]) { $1 } },
        .init(id: "Burning world", line: "Fires, storms and air quality, harmonic minor, saturated.", tint: "e") { c in
            c.scale = "harmmin"; c.drive = 0.45
            c.vol.merge(["q": 0.6, "s": 0.6, "o": 0.4, "x": 0.4, "w": 0.8, "t": 0.5, "c": 1, "r": 0, "e": 1.5, "a": 1.4]) { $1 } },
        .init(id: "Orbit", line: "The space station's orbit in whole tone, extra wide.", tint: "i") { c in
            c.scale = "wholetone"; c.instI = "square"
            c.vol.merge(["q": 0.4, "s": 0.7, "o": 0.4, "x": 0.6, "w": 0.3, "t": 0.3, "c": 0.4, "r": 0, "i": 1.5, "g": 1]) { $1 } },
        .init(id: "California", line: "Every California quake, even the tiny ones, as glass.", tint: "w") { c in
            c.region = "california"; c.mmin = 0; c.scale = "majpent"; c.len = 0.8; c.instQ = "glass" },
        .init(id: "Japan", line: "Japan's quakes from M1 in In-sen, FM bells on a plate.", tint: "c") { c in
            c.region = "japan"; c.mmin = 1; c.scale = "insen"; c.instQ = "bell"; c.revType = "plate" },
        .init(id: "Lo-fi Earth", line: "Locked at 82 BPM, heavy swing, dusty top end.", tint: "s") { c in
            c.style = "pulse"; c.pattern = "half"; c.bpmLock = 82; c.swing = 0.22; c.drive = 0.6; c.mlp = 6500; c.instQ = "marimba"; c.instS = "soft"; c.revType = "room" }]
}

/// Saved settings and the user's own presets, kept on this Apple TV.
enum Store {
    private static let cfgKey = "tv.producer", userKey = "tv.presets", lastKey = "tv.lastPreset"
    static func loadConfig() -> ProducerConfig {
        guard let d = UserDefaults.standard.data(forKey: cfgKey), let c = try? JSONDecoder().decode(ProducerConfig.self, from: d) else { return ProducerConfig() }
        return c
    }
    static func save(_ c: ProducerConfig) { if let d = try? JSONEncoder().encode(c) { UserDefaults.standard.set(d, forKey: cfgKey) } }
    static func userPresets() -> [String: ProducerConfig] {
        guard let d = UserDefaults.standard.data(forKey: userKey), let p = try? JSONDecoder().decode([String: ProducerConfig].self, from: d) else { return [:] }
        return p
    }
    static func saveUserPresets(_ p: [String: ProducerConfig]) { if let d = try? JSONEncoder().encode(p) { UserDefaults.standard.set(d, forKey: userKey) } }
    static var lastPreset: String? {
        get { UserDefaults.standard.string(forKey: lastKey) }
        set { UserDefaults.standard.set(newValue, forKey: lastKey) }
    }
}
