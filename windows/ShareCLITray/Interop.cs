using System;
using System.Runtime.InteropServices;

namespace ShareCLITray;

/// P/Invoke FFI bindings to sharecli Rust library (C ABI).
public static class ShareCLIInterop
{
    private const string DllName = "sharecli_ffi";

    /// Start the IPC daemon in the background (idempotent).
    /// Returns 0 on success, non-zero on error.
    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl)]
    public static extern int sharecli_ipc_start();

    /// Returns the IPC socket/address path as a UTF-8 C string.
    /// Caller must free with sharecli_free_string.
    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl)]
    private static extern IntPtr sharecli_ipc_socket_path();

    /// Free a string allocated by the library.
    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl)]
    private static extern void sharecli_free_string(IntPtr ptr);

    /// Quick synchronous health snapshot over the IPC socket.
    /// Returns a JSON string (must free with sharecli_free_string) or IntPtr.Zero on error.
    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl)]
    private static extern IntPtr sharecli_health_json();

    /// Send an arbitrary JSON-RPC request string, return the response JSON string.
    /// Caller frees the returned string with sharecli_free_string.
    [DllImport(DllName, CallingConvention = CallingConvention.Cdecl)]
    private static extern IntPtr sharecli_request(string requestJson);

    /// Helper: marshal C string to C# string and free it.
    private static string? MarshalCString(IntPtr ptr)
    {
        if (ptr == IntPtr.Zero)
            return null;
        string? result = Marshal.PtrToStringUTF8(ptr);
        sharecli_free_string(ptr);
        return result;
    }

    /// Wrapper: get the IPC endpoint (socket path on Unix, TCP addr on Windows).
    public static string GetIPCEndpoint()
    {
        var ptr = sharecli_ipc_socket_path();
        return MarshalCString(ptr) ?? "unknown";
    }

    /// Wrapper: get health snapshot as JSON string, or null on error.
    public static string? GetHealthJson()
    {
        var ptr = sharecli_health_json();
        return MarshalCString(ptr);
    }

    /// Wrapper: send a JSON-RPC request, get response JSON string or null on error.
    public static string? SendRequest(string requestJson)
    {
        var ptr = sharecli_request(requestJson);
        return MarshalCString(ptr);
    }
}
