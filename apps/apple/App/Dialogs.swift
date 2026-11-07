import SwiftUI
#if os(iOS)
import UIKit

@MainActor
enum Dialogs {
    static var top: UIViewController? {
        let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first { $0.activationState == .foregroundActive }
            ?? UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
        var vc = scene?.keyWindow?.rootViewController ?? scene?.windows.first?.rootViewController
        while let p = vc?.presentedViewController { vc = p }
        return vc
    }
    static func alert(_ msg: String) async {
        await withCheckedContinuation { (c: CheckedContinuation<Void, Never>) in
            let a = UIAlertController(title: nil, message: msg, preferredStyle: .alert)
            a.addAction(UIAlertAction(title: "OK", style: .default) { _ in c.resume() })
            guard let top else { return c.resume() }
            top.present(a, animated: true)
        }
    }
    static func confirm(_ msg: String) async -> Bool {
        await withCheckedContinuation { (c: CheckedContinuation<Bool, Never>) in
            let a = UIAlertController(title: nil, message: msg, preferredStyle: .alert)
            a.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in c.resume(returning: false) })
            a.addAction(UIAlertAction(title: "OK", style: .default) { _ in c.resume(returning: true) })
            guard let top else { return c.resume(returning: false) }
            top.present(a, animated: true)
        }
    }
    static func prompt(_ msg: String, _ def: String) async -> String? {
        await withCheckedContinuation { (c: CheckedContinuation<String?, Never>) in
            let a = UIAlertController(title: nil, message: msg, preferredStyle: .alert)
            a.addTextField { $0.text = def }
            a.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in c.resume(returning: nil) })
            a.addAction(UIAlertAction(title: "OK", style: .default) { _ in c.resume(returning: a.textFields?.first?.text ?? "") })
            guard let top else { return c.resume(returning: nil) }
            top.present(a, animated: true)
        }
    }
    /// Share a file the engine made (recording, MIDI, stems…): Save to Files, AirDrop, Messages, GarageBand…
    static func share(_ url: URL) {
        guard let top else { return }
        let vc = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        if let pop = vc.popoverPresentationController {
            pop.sourceView = top.view
            pop.sourceRect = CGRect(x: top.view.bounds.midX, y: top.view.bounds.maxY - 80, width: 1, height: 1)
            pop.permittedArrowDirections = []
        }
        top.present(vc, animated: true)
    }
}
#else
import AppKit

@MainActor
enum Dialogs {
    static func alert(_ msg: String) async {
        let a = NSAlert(); a.messageText = msg; a.runModal()
    }
    static func confirm(_ msg: String) async -> Bool {
        let a = NSAlert(); a.messageText = msg; a.addButton(withTitle: "OK"); a.addButton(withTitle: "Cancel")
        return a.runModal() == .alertFirstButtonReturn
    }
    static func prompt(_ msg: String, _ def: String) async -> String? {
        let a = NSAlert(); a.messageText = msg; a.addButton(withTitle: "OK"); a.addButton(withTitle: "Cancel")
        let f = NSTextField(frame: NSRect(x: 0, y: 0, width: 260, height: 24)); f.stringValue = def; a.accessoryView = f
        return a.runModal() == .alertFirstButtonReturn ? f.stringValue : nil
    }
    /// Save a file the engine made (recording, MIDI, stems…)
    static func share(_ url: URL) {
        let p = NSSavePanel()
        p.nameFieldStringValue = url.lastPathComponent
        p.canCreateDirectories = true
        if p.runModal() == .OK, let dest = p.url {
            try? FileManager.default.removeItem(at: dest)
            try? FileManager.default.copyItem(at: url, to: dest)
            NSWorkspace.shared.activateFileViewerSelecting([dest])
        }
    }
}
#endif
