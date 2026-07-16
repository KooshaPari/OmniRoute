import SwiftUI

struct SettingsView: View {
    @ObservedObject var server: ServerManager

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("OmniRoute")
                .font(.largeTitle.bold())
            Text("Native tray controller for local proxy management.")
                .foregroundStyle(.secondary)

            GroupBox("Daemon") {
                VStack(alignment: .leading, spacing: 12) {
                    TextField("Base URL", text: $server.baseURL)
                    HStack {
                        Button("Refresh") { server.refreshStatus() }
                        Button("Start") { server.startProxy() }
                        Button("Stop") { server.stopProxy() }
                    }
                    Text("Status: \(server.status)")
                        .font(.system(.body, design: .monospaced))
                }
                .padding(.vertical, 8)
            }

            GroupBox("Accounts") {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Auth/account detection will read OmniRoute credential state after the management facade lands.")
                    Text("Target: provider status, quota pressure, and reconnect actions.")
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 8)
            }

            Spacer()
            Button("Open Management Console") { server.openManagementConsole() }
                .keyboardShortcut("o")
        }
        .padding(24)
        .frame(minWidth: 420, minHeight: 520)
    }
}
