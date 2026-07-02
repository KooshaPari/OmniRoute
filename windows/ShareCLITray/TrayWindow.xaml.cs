using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;

namespace ShareCLITray;

public sealed partial class TrayWindow : Window
{
    private List<ProcessInfo> m_processes = [];

    public TrayWindow()
    {
        InitializeComponent();

        // Set up event handlers and load initial data.
        _ = RefreshDataAsync();
    }

    private async Task RefreshDataAsync()
    {
        // Fetch health snapshot.
        var healthJson = ShareCLIInterop.GetHealthJson();
        if (healthJson != null)
        {
            try
            {
                var doc = JsonDocument.Parse(healthJson);
                var root = doc.RootElement;
                int managedCount = root.GetProperty("managed_processes").GetInt32();
                ulong usedMem = root.GetProperty("used_memory_mb").GetUInt64();
                bool healthy = root.GetProperty("healthy").GetBoolean();

                DispatcherQueue?.TryEnqueue(() =>
                {
                    HealthStatusText.Text =
                        $"Health: {(healthy ? "✓ OK" : "✗ Unhealthy")} | " +
                        $"Managed: {managedCount} | " +
                        $"Memory: {usedMem} MB";
                });
            }
            catch { }
        }

        // Fetch process list.
        var listJson = ShareCLIInterop.SendRequest("{\"id\": 1, \"method\": \"process.list\", \"params\": {}}");
        if (listJson != null)
        {
            try
            {
                var doc = JsonDocument.Parse(listJson);
                var root = doc.RootElement;
                if (root.TryGetProperty("result", out var result) && result.ValueKind == JsonValueKind.Array)
                {
                    m_processes.Clear();
                    foreach (var proc in result.EnumerateArray())
                    {
                        m_processes.Add(new ProcessInfo
                        {
                            pid = proc.GetProperty("pid").GetUInt32(),
                            name = proc.GetProperty("name").GetString() ?? "?",
                            memory_mb = proc.GetProperty("memory_mb").GetUInt64(),
                            project = proc.TryGetProperty("project", out var p) ? p.GetString() : null,
                        });
                    }

                    DispatcherQueue?.TryEnqueue(() =>
                    {
                        ProcessGrid.ItemsSource = m_processes;
                    });
                }
            }
            catch { }
        }
    }

    private async void OnRefreshClick(object sender, RoutedEventArgs e)
    {
        await RefreshDataAsync();
    }

    private void OnCloseClick(object sender, RoutedEventArgs e)
    {
        Close();
    }
}

public record ProcessInfo
{
    public uint pid { get; set; }
    public string name { get; set; } = "";
    public ulong memory_mb { get; set; }
    public string? project { get; set; }
}
