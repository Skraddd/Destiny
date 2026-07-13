using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Sockets;
using System.Text;

namespace Conduit
{
    /**
     * Hosts the local Rift server (node.js) as an embedded child process, so no
     * separate command prompt window is needed. Output is captured and exposed
     * to the UI through the OnLog event.
     */
    public static class RiftHost
    {
        public static event Action<string> OnLog;
        public static event Action OnStatusChanged;

        public static string Status { get; private set; } = "Stopped";

        private static Process process;
        private static readonly List<string> logBuffer = new List<string>();
        private static readonly object logLock = new object();

        /**
         * Returns the buffered log lines so late-opened windows can show history.
         */
        public static string GetBufferedLog()
        {
            lock (logLock)
            {
                return string.Join(Environment.NewLine, logBuffer);
            }
        }

        /**
         * Starts the embedded Rift server, unless one is already running (either
         * embedded or externally on port 51001).
         */
        public static void Start()
        {
            if (process != null && !process.HasExited) return;

            // If something already listens on the Rift port (e.g. a manually
            // started instance), don't start a second one.
            if (IsPortInUse(51001))
            {
                SetStatus("Running (external)");
                Log("[Conduit] Rift is already running on port 51001, not starting an embedded copy.");
                return;
            }

            var riftDir = FindRiftDirectory();
            if (riftDir == null)
            {
                SetStatus("Not found");
                Log("[Conduit] Could not locate the 'rift' folder. Set the DESTINY_RIFT_DIR environment variable to its path.");
                return;
            }

            string fileName, arguments;
            if (File.Exists(Path.Combine(riftDir, "rift.exe")))
            {
                // Standalone build: self-contained executable, no Node.js needed.
                fileName = Path.Combine(riftDir, "rift.exe");
                arguments = "";
            }
            else if (File.Exists(Path.Combine(riftDir, "dist", "index.js")))
            {
                // Already compiled: run node directly (cleaner process tree).
                fileName = "node";
                arguments = "dist/index.js";
            }
            else
            {
                // Not compiled yet: let yarn compile and start it.
                fileName = "cmd.exe";
                arguments = "/c yarn start";
                Log("[Conduit] rift/dist not found, compiling with 'yarn start' (first run may take a while)...");
            }

            try
            {
                process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = fileName,
                        Arguments = arguments,
                        WorkingDirectory = riftDir,
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        StandardOutputEncoding = Encoding.UTF8,
                        StandardErrorEncoding = Encoding.UTF8
                    },
                    EnableRaisingEvents = true
                };

                process.OutputDataReceived += (s, e) => { if (e.Data != null) Log(e.Data); };
                process.ErrorDataReceived += (s, e) => { if (e.Data != null) Log(e.Data); };
                process.Exited += (s, e) =>
                {
                    SetStatus("Stopped");
                    Log("[Conduit] Rift server exited.");
                };

                process.Start();
                process.BeginOutputReadLine();
                process.BeginErrorReadLine();

                SetStatus("Running (embedded)");
                Log("[Conduit] Rift server started (" + fileName + " " + arguments + ") in " + riftDir);
            }
            catch (Exception e)
            {
                SetStatus("Error");
                Log("[Conduit] Could not start Rift: " + e.Message);
                DebugLogger.Global.WriteError("Could not start Rift: " + e);
            }
        }

        /**
         * Stops the embedded Rift server, killing the entire process tree
         * (needed because 'cmd /c yarn start' spawns nested processes).
         */
        public static void Stop()
        {
            if (process == null) return;

            try
            {
                if (!process.HasExited)
                {
                    // taskkill /T kills the whole tree (cmd -> yarn -> node).
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = "taskkill",
                        Arguments = "/PID " + process.Id + " /T /F",
                        UseShellExecute = false,
                        CreateNoWindow = true
                    })?.WaitForExit(3000);
                }
            }
            catch (Exception e)
            {
                DebugLogger.Global.WriteError("Could not stop Rift: " + e.Message);
            }
            finally
            {
                process = null;
                SetStatus("Stopped");
            }
        }

        /**
         * Restarts the embedded Rift server.
         */
        public static void Restart()
        {
            Log("[Conduit] Restarting Rift server...");
            Stop();
            System.Threading.Tasks.Task.Delay(1000).ContinueWith(t => Start());
        }

        /**
         * Locates the rift folder: DESTINY_RIFT_DIR env var, or walking up from
         * the executable location looking for rift/package.json.
         */
        private static string FindRiftDirectory()
        {
            var env = Environment.GetEnvironmentVariable("DESTINY_RIFT_DIR");
            if (!string.IsNullOrEmpty(env) && (File.Exists(Path.Combine(env, "rift.exe")) || File.Exists(Path.Combine(env, "package.json")))) return env;

            try
            {
                var dir = new DirectoryInfo(Path.GetDirectoryName(System.Reflection.Assembly.GetEntryAssembly().Location));
                for (var i = 0; i < 6 && dir != null; i++, dir = dir.Parent)
                {
                    var candidate = Path.Combine(dir.FullName, "rift");
                    if (File.Exists(Path.Combine(candidate, "rift.exe"))) return candidate;
                    if (File.Exists(Path.Combine(candidate, "package.json"))) return candidate;
                }
            }
            catch (Exception ignored) { }

            return null;
        }

        private static bool IsPortInUse(int port)
        {
            try
            {
                using (var client = new TcpClient())
                {
                    var result = client.BeginConnect("127.0.0.1", port, null, null);
                    var connected = result.AsyncWaitHandle.WaitOne(300) && client.Connected;
                    return connected;
                }
            }
            catch
            {
                return false;
            }
        }

        private static void SetStatus(string status)
        {
            Status = status;
            OnStatusChanged?.Invoke();
        }

        private static void Log(string line)
        {
            lock (logLock)
            {
                logBuffer.Add(line);
                if (logBuffer.Count > 400) logBuffer.RemoveRange(0, logBuffer.Count - 400);
            }

            OnLog?.Invoke(line);
        }
    }
}
