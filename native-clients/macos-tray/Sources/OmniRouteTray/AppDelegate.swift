import AppKit
import SwiftUI

final class AppDelegate: NSObject, NSApplicationDelegate {
    private let server = ServerManager()
    private var statusItem: NSStatusItem?
    private var window: NSWindow?

    func applicationDidFinishLaunching(_ notification: Notification) {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        item.button?.title = "OR"
        item.button?.target = self
        item.button?.action = #selector(toggleWindow)
        statusItem = item
        rebuildMenu()
    }

    @objc private func toggleWindow() {
        if window == nil {
            let view = SettingsView(server: server)
            let hosting = NSHostingController(rootView: view)
            let created = NSWindow(contentViewController: hosting)
            created.title = "OmniRoute"
            created.setContentSize(NSSize(width: 460, height: 560))
            created.styleMask = [.titled, .closable, .miniaturizable]
            window = created
        }
        window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    private func rebuildMenu() {
        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "Open Management Console", action: #selector(openConsole), keyEquivalent: "o"))
        menu.addItem(NSMenuItem(title: "Start Proxy", action: #selector(startProxy), keyEquivalent: "s"))
        menu.addItem(NSMenuItem(title: "Stop Proxy", action: #selector(stopProxy), keyEquivalent: "x"))
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "Quit", action: #selector(quit), keyEquivalent: "q"))
        statusItem?.menu = menu
    }

    @objc private func openConsole() { server.openManagementConsole() }
    @objc private func startProxy() { server.startProxy() }
    @objc private func stopProxy() { server.stopProxy() }
    @objc private func quit() { NSApp.terminate(nil) }
}
