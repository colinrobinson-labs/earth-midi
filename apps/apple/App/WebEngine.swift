import Foundation
import WebKit
import UniformTypeIdentifiers

/// Hosts the site's sound engine (bundled at build time from the repo's index.html + js/) in a WKWebView.
/// Pages load from earthmidi://app/…; /data/* is read from earthmidi.com's live snapshot.
@MainActor
final class WebEngine: NSObject {
    let webView: WKWebView
    var onMessage: (([String: Any]) -> Void)?
    private(set) var isReady = false
    private var queued: [String] = []
    private let schemeHandler = BundleSchemeHandler()

    override init() {
        let cfg = WKWebViewConfiguration()
        cfg.setURLSchemeHandler(schemeHandler, forURLScheme: BundleSchemeHandler.scheme)
        cfg.mediaTypesRequiringUserActionForPlayback = []
        #if os(iOS)
        cfg.allowsInlineMediaPlayback = true
        cfg.allowsAirPlayForMediaPlayback = true
        #endif
        cfg.websiteDataStore = .default()
        let ucc = WKUserContentController()
        if let url = Bundle.main.url(forResource: "Bridge", withExtension: "js"), let js = try? String(contentsOf: url, encoding: .utf8) {
            ucc.addUserScript(WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        cfg.userContentController = ucc
        webView = WKWebView(frame: .zero, configuration: cfg)
        super.init()
        ucc.add(WeakHandler(self), name: "em")
        webView.navigationDelegate = self
        webView.uiDelegate = self
        #if DEBUG
        if #available(iOS 16.4, macOS 13.3, *) { webView.isInspectable = true }
        #endif
        #if os(iOS)
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.027, green: 0.035, blue: 0.043, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        #else
        webView.setValue(false, forKey: "drawsBackground")
        #endif
        webView.customUserAgent = nil
        webView.load(URLRequest(url: URL(string: "\(BundleSchemeHandler.scheme)://app/index.html")!))
    }

    /// Run JS once the page is ready (queued until then)
    func call(_ js: String) {
        guard isReady else { queued.append(js); return }
        webView.evaluateJavaScript(js) { _, err in if let err { print("JS error: \(err)") } }
    }

    fileprivate func receive(_ body: Any) {
        guard let m = body as? [String: Any], let t = m["t"] as? String else { return }
        if t == "ready" {
            isReady = true
            let q = queued; queued.removeAll()
            q.forEach(call)
        }
        onMessage?(m)
    }
}

private final class WeakHandler: NSObject, WKScriptMessageHandler {
    weak var engine: WebEngine?
    init(_ e: WebEngine) { engine = e }
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        let body = message.body
        MainActor.assumeIsolated { engine?.receive(body) }
    }
}

extension WebEngine: WKNavigationDelegate, WKUIDelegate {
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
        guard let url = action.request.url else { return .cancel }
        if ["about", "blob", "data", BundleSchemeHandler.scheme].contains(url.scheme ?? "") { return .allow }
        if action.targetFrame?.isMainFrame == false { return .allow }
        // links out of the app (sources, credits, earthmidi.com) open in the browser
        openExternal(url)
        return .cancel
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { isReady = false; webView.reload() }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url { openExternal(url) }
        return nil
    }

    private func openExternal(_ url: URL) {
        #if os(iOS)
        UIApplication.shared.open(url)
        #else
        NSWorkspace.shared.open(url)
        #endif
    }

    // alert / confirm / prompt (preset names, "are you sure" questions)
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo) async {
        await Dialogs.alert(message)
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo) async -> Bool {
        await Dialogs.confirm(message)
    }
    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo) async -> String? {
        await Dialogs.prompt(prompt, defaultText ?? "")
    }
}

/// Serves the bundled site from the app (works offline) and the live data snapshot from earthmidi.com.
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "earthmidi"
    static let remote = URL(string: "https://earthmidi.com")!
    private let root = Bundle.main.resourceURL!.appendingPathComponent("Web", isDirectory: true)
    private var live = Set<ObjectIdentifier>()
    private let lock = NSLock()

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return }
        var path = url.path
        if path.isEmpty || path == "/" { path = "/index.html" }
        let id = ObjectIdentifier(task)
        lock.lock(); live.insert(id); lock.unlock()
        if path.hasPrefix("/data/") {
            var c = URLComponents(url: Self.remote.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
            c.query = url.query
            var req = URLRequest(url: c.url!, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
            req.setValue("application/json", forHTTPHeaderField: "Accept")
            URLSession.shared.dataTask(with: req) { [weak self] data, resp, _ in
                let code = (resp as? HTTPURLResponse)?.statusCode ?? 503
                DispatchQueue.main.async { self?.finish(task, id: id, url: url, status: data == nil ? 503 : code, mime: "application/json", data: data ?? Data()) }
            }.resume()
            return
        }
        let file = root.appendingPathComponent(String(path.dropFirst()))
        guard file.standardizedFileURL.path.hasPrefix(root.standardizedFileURL.path), let data = try? Data(contentsOf: file) else {
            finish(task, id: id, url: url, status: 404, mime: "text/plain", data: Data("not found".utf8)); return
        }
        finish(task, id: id, url: url, status: 200, mime: Self.mime(file.pathExtension), data: data)
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {
        lock.lock(); live.remove(ObjectIdentifier(task)); lock.unlock()
    }

    private func finish(_ task: WKURLSchemeTask, id: ObjectIdentifier, url: URL, status: Int, mime: String, data: Data) {
        lock.lock(); let ok = live.remove(id) != nil; lock.unlock()
        guard ok else { return }
        let headers = ["Content-Type": mime, "Content-Length": "\(data.count)", "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*"]
        let resp = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers)!
        task.didReceive(resp)
        task.didReceive(data)
        task.didFinish()
    }

    static func mime(_ ext: String) -> String {
        switch ext.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "js", "mjs": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json": return "application/json"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "woff2": return "font/woff2"
        case "wav": return "audio/wav"
        default: return UTType(filenameExtension: ext)?.preferredMIMEType ?? "application/octet-stream"
        }
    }
}
