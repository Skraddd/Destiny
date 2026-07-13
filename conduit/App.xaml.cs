using System.Windows.Forms;

namespace Conduit
{
    /// <summary>
    /// Interaction logic for App.xaml
    /// </summary>
    public partial class App : System.Windows.Application
    {
        private NotifyIcon icon;
        private MenuItem codeMenuItem;
        private ConnectionManager manager;

        public App()
        {
            codeMenuItem = new MenuItem
            {
                Enabled = false
            };

            // Start the embedded local Rift server (no external cmd window needed).
            RiftHost.Start();

            // Checkable toggle for automatically accepting ready checks.
            MenuItem autoAcceptMenuItem = null;
            autoAcceptMenuItem = new MenuItem("Auto-accept matches", (sender, ev) =>
            {
                var enabled = !Persistence.GetAutoAccept();
                Persistence.SetAutoAccept(enabled);
                autoAcceptMenuItem.Checked = enabled;
            })
            {
                Checked = Persistence.GetAutoAccept()
            };

            icon = new NotifyIcon
            {
                Text = "Destiny Conduit Local",
                Icon = Conduit.Properties.Resources.destiny,
                Visible = true,
                ContextMenu = new ContextMenu(new []
                {
                    new MenuItem(Program.APP_NAME + " " + Program.VERSION)
                    {
                        Enabled = false
                    },
                    codeMenuItem,
                    new MenuItem("Settings", (sender, ev) =>
                    {
                        new AboutWindow().Show();
                    }),
                    autoAcceptMenuItem,
                    new MenuItem("Quit", (a, b) => { RiftHost.Stop(); Shutdown(); })
                })
            };

            // Keep the tray checkbox in sync if the setting was changed from the
            // Settings window, and make sure the embedded server dies with us.
            icon.ContextMenu.Popup += (a, b) => autoAcceptMenuItem.Checked = Persistence.GetAutoAccept();
            Exit += (a, b) => RiftHost.Stop();

            icon.Click += (a, b) =>
            {
                // Only open about if left mouse is used (otherwise right clicking opens both context menu and about).
                if (b is MouseEventArgs args && args.Button == MouseButtons.Left)
                    new AboutWindow().Show();
            };

            icon.BalloonTipClicked += (a, b) =>
            {
                new AboutWindow().Show();
            };

            manager = new ConnectionManager(this);
            Persistence.OnHubCodeChanged += UpdateCodeMenuItemText;
            UpdateCodeMenuItemText();

            // Unless we automatically launched at startup, display a bubble with info.
            if (!Persistence.LaunchesAtStartup())
            {
                ShowNotification("Destiny will run in the background. Click this notification or the Destiny icon in the system tray for more information and how to connect from your phone.");
            }
        }

        /**
         * Updates the code menu item with the current code, if it has changed.
         */
        private void UpdateCodeMenuItemText()
        {
            var code = Persistence.GetHubCode();
            if (code == null)
            {
                codeMenuItem.Text = "Start League to generate an access code!";
            }
            else
            {
                codeMenuItem.Text = "Access Code: " + code;
            }
        }

        /**
         * Shows a simple notification with the specified text for 5 seconds.
         */
        public void ShowNotification(string text)
        {
            icon.BalloonTipTitle = "Destiny Conduit";
            icon.BalloonTipText = text;
            icon.ShowBalloonTip(5000);
        }
    }
}