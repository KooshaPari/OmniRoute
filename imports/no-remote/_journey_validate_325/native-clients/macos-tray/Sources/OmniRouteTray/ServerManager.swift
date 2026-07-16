import AppKit
import Foundation

final class ServerManager: ObservableObject {
    @Published var baseURL: String = ProcessInfo.processInfo.environment["OMNIROUTE_BASE_URL"] ?? "http://localhost:20128"
    @Published var status: String = "unknown"

    func refreshStatus() {
        guard let url = URL(string: baseURL + "/api/management/health") else {
            status = "invalid-url"
            return
        }
        URLSession.shared.dataTask(with: url) { _, response, error in
            DispatchQueue.main.async {
                if error != nil {
                    self.status = "offline"
                } else if let http = response as? HTTPURLResponse {
                    self.status = http.statusCode == 200 ? "online" : "http-\(http.statusCode)"
                } else {
                    self.status = "unknown"
                }
            }
        }.resume()
    }

    func startProxy() {
        status = "start requested"
        // Later: launch bundled omniroute daemon or call a local launchd helper.
    }

    func stopProxy() {
        status = "stop requested"
        // Later: stop the launchd helper or daemon process owned by this app.
    }

    func openManagementConsole() {
        let console = baseURL + "/management.html"
        if let url = URL(string: console) {
            NSWorkspace.shared.open(url)
        }
    }
}
