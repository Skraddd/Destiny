using System;
using System.Diagnostics;
using System.Reflection;
using System.Security.Principal;
using System.Windows.Forms;

namespace Conduit
{
    public static class Administrator
    {
        public static bool IsAdmin()
        {
            using (WindowsIdentity identity = WindowsIdentity.GetCurrent())
            {
                WindowsPrincipal principal = new WindowsPrincipal(identity);
                return principal.IsInRole(WindowsBuiltInRole.Administrator);
            }
        }

        public static void Elevate()
        {
            MessageBox.Show(
                "Your League client is running as administrator, and Destiny cannot access it. Destiny will now attempt to restart as administrator. Press 'Yes' on the Windows prompt to allow this.",
                "Destiny",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error,
                MessageBoxDefaultButton.Button1
            );

            var currentProcessInfo = new ProcessStartInfo
            {
                UseShellExecute = true,
                WorkingDirectory = Environment.CurrentDirectory,
                FileName = Assembly.GetEntryAssembly().Location,
                Verb = "runas"
            };

            // Release the single-instance lock first, so the elevated copy
            // is not rejected as a duplicate instance.
            Program.ReleaseSingleInstanceMutex();

            Process.Start(currentProcessInfo);
            Environment.Exit(0);
        }
    }
}
