using System;
using System.Diagnostics;
using System.Linq;
using System.Management;
using System.Text.RegularExpressions;

namespace Conduit
{
    /**
     * Some static utilities used to interact/query the state of the league client process.
     */
    static class LeagueUtils
    {
        // Quotes around arguments are optional: modern clients do not always include them.
        private static Regex AUTH_TOKEN_REGEX = new Regex("--remoting-auth-token=\"?([\\w-]+)\"?");
        private static Regex PORT_REGEX = new Regex("--app-port=\"?(\\d+)\"?");

        /**
         * Returns a tuple with the process, remoting auth token and port of the current league client.
         * Returns null if the current league client is not running.
         */
        // Whether we already attempted to elevate during this run. Prevents
        // repeatedly spawning elevated copies of Conduit.
        private static bool elevationAttempted = false;

        public static Tuple<Process, string, string> GetLeagueStatus()
        {
            var needsElevation = false;

            // Find the LeagueClientUx process.
            foreach (var p in Process.GetProcessesByName("LeagueClientUx"))
            {
                // Use WMI to figure out its command line.
                using (var mos = new ManagementObjectSearcher("SELECT CommandLine FROM Win32_Process WHERE ProcessId = " + p.Id.ToString()))
                using (var moc = mos.Get())
                {
                    var commandLine = (string)moc.OfType<ManagementObject>().First()["CommandLine"];
                    if (commandLine == null)
                    {
                        // We can't read the command line without admin access. Do NOT
                        // elevate here: first try the lockfile (usually readable), and
                        // only consider elevation as the very last resort below.
                        var viaLockfile = ReadLockfile(p) ?? ReadWellKnownLockfiles(p);
                        if (viaLockfile != null) return viaLockfile;

                        needsElevation = true;
                        continue;
                    }

                    try
                    {
                        var authToken = AUTH_TOKEN_REGEX.Match(commandLine).Groups[1].Value;
                        var port = PORT_REGEX.Match(commandLine).Groups[1].Value;

                        // If the command line did not contain the arguments, try the lockfile instead.
                        if (string.IsNullOrEmpty(authToken) || string.IsNullOrEmpty(port))
                        {
                            var fromLockfile = ReadLockfile(p) ?? ReadWellKnownLockfiles(p);
                            if (fromLockfile != null) return fromLockfile;
                            continue;
                        }

                        // Use regex to extract data, return it.
                        return new Tuple<Process, string, string>
                        (
                            p,
                            authToken,
                            port
                        );
                    }
                    catch (Exception e)
                    {
                        DebugLogger.Global.WriteError($"Error while trying to get the status for LeagueClientUx: {e.ToString()}\n\n(CommandLine = {commandLine})");
                    }
                }
            }

            // WMI failed or produced nothing useful: try the lockfile of any
            // running LeagueClientUx process, including well-known install paths.
            foreach (var p in Process.GetProcessesByName("LeagueClientUx"))
            {
                var fromLockfile = ReadLockfile(p) ?? ReadWellKnownLockfiles(p);
                if (fromLockfile != null) return fromLockfile;
            }

            // Absolute last resort: everything failed AND the failure was caused by
            // missing permissions. Ask once (and only once) to restart as admin.
            if (needsElevation && !elevationAttempted && !Administrator.IsAdmin())
            {
                elevationAttempted = true;
                Administrator.Elevate();
            }

            // LeagueClientUx process was not found. Return null.
            return null;
        }

        /**
         * Tries the lockfile in well-known League install locations. This works
         * even when we have no permission to inspect the League process at all.
         */
        private static Tuple<Process, string, string> ReadWellKnownLockfiles(Process p)
        {
            var candidates = new[]
            {
                @"C:\Riot Games\League of Legends\lockfile",
                @"D:\Riot Games\League of Legends\lockfile",
                Environment.ExpandEnvironmentVariables(@"%ProgramFiles%\Riot Games\League of Legends\lockfile"),
                Environment.ExpandEnvironmentVariables(@"%ProgramFiles(x86)%\Riot Games\League of Legends\lockfile")
            };

            foreach (var path in candidates)
            {
                try
                {
                    if (!System.IO.File.Exists(path)) continue;

                    string contents;
                    using (var stream = new System.IO.FileStream(path, System.IO.FileMode.Open, System.IO.FileAccess.Read, System.IO.FileShare.ReadWrite))
                    using (var reader = new System.IO.StreamReader(stream))
                    {
                        contents = reader.ReadToEnd();
                    }

                    var parts = contents.Split(':');
                    if (parts.Length < 5) continue;

                    DebugLogger.Global.WriteMessage("Found League via well-known lockfile: " + path);
                    return new Tuple<Process, string, string>(p, parts[3], parts[2]);
                }
                catch (Exception e)
                {
                    DebugLogger.Global.WriteError("Could not read " + path + ": " + e.Message);
                }
            }

            return null;
        }

        /**
         * Modern fallback: reads the "lockfile" in the League install directory,
         * which contains name:pid:port:password:protocol. This works regardless
         * of how the process arguments are formatted.
         */
        private static Tuple<Process, string, string> ReadLockfile(Process p)
        {
            try
            {
                var dir = System.IO.Path.GetDirectoryName(p.MainModule.FileName);
                var lockfilePath = System.IO.Path.Combine(dir, "lockfile");
                if (!System.IO.File.Exists(lockfilePath)) return null;

                // The file is kept open by the client, so read it with sharing enabled.
                string contents;
                using (var stream = new System.IO.FileStream(lockfilePath, System.IO.FileMode.Open, System.IO.FileAccess.Read, System.IO.FileShare.ReadWrite))
                using (var reader = new System.IO.StreamReader(stream))
                {
                    contents = reader.ReadToEnd();
                }

                var parts = contents.Split(':');
                if (parts.Length < 5) return null;

                var port = parts[2];
                var password = parts[3];

                DebugLogger.Global.WriteMessage("Found League via lockfile: port " + port);
                return new Tuple<Process, string, string>(p, password, port);
            }
            catch (Exception e)
            {
                DebugLogger.Global.WriteError("Could not read lockfile: " + e.Message);
                return null;
            }
        }
    }
}