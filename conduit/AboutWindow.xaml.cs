using QRCoder;
using System;
using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media.Imaging;

namespace Conduit
{
    /// <summary>
    /// Interaction logic for AboutWindow.xaml
    /// </summary>
    public partial class AboutWindow : Window
    {
        public AboutWindow()
        {
            InitializeComponent();
            Logo.Source = Imaging.CreateBitmapSourceFromHIcon(Properties.Resources.destiny.Handle, Int32Rect.Empty, BitmapSizeOptions.FromEmptyOptions());
            StartOnStartupCheckbox.IsChecked = Persistence.LaunchesAtStartup();

            AboutTitle.Content = "Destiny Conduit Local v" + Program.VERSION;
            AutoAcceptCheckbox.IsChecked = Persistence.GetAutoAccept();

            HubUrl.Text = Program.GetDisplayHub();

            if (Persistence.GetHubCode() != null)
            {
                RenderCode();
            }
            Persistence.OnHubCodeChanged += RenderCode;

            // Embedded Rift server: show buffered history and live output.
            RiftLog.Text = RiftHost.GetBufferedLog();
            RiftLog.ScrollToEnd();
            RiftStatusLabel.Content = RiftHost.Status;
            RiftHost.OnLog += AppendRiftLog;
            RiftHost.OnStatusChanged += UpdateRiftStatus;
        }

        private void AppendRiftLog(string line)
        {
            Dispatcher.BeginInvoke((Action)(() =>
            {
                RiftLog.AppendText(line + Environment.NewLine);

                // Keep the textbox bounded and pinned to the bottom.
                if (RiftLog.Text.Length > 60000) RiftLog.Text = RiftLog.Text.Substring(RiftLog.Text.Length - 50000);
                RiftLog.ScrollToEnd();
            }));
        }

        private void UpdateRiftStatus()
        {
            Dispatcher.BeginInvoke((Action)(() => RiftStatusLabel.Content = RiftHost.Status));
        }

        private void RestartRift(object sender, EventArgs args)
        {
            RiftHost.Restart();
        }

        private void HandleAutoAcceptChange(object sender, EventArgs e)
        {
            Persistence.SetAutoAccept(AutoAcceptCheckbox.IsChecked == true);
        }

        /**
         * Renders the current hub code. This assumes that a hub token exists and doesn't check for null.
         */
        private void RenderCode()
        {
            Dispatcher.Invoke(() =>
            {
                QRCodeGenerator qrGenerator = new QRCodeGenerator();
                QRCodeData qrCodeData = qrGenerator.CreateQrCode(Program.GetDisplayHub(), QRCodeGenerator.ECCLevel.Q);
                XamlQRCode qrCode = new XamlQRCode(qrCodeData);

                ConnectionQR.Source = qrCode.GetGraphic(20);
                ConnectionQR.Visibility = Visibility.Visible;

                CodeLabel.Content = Persistence.GetHubCode();
                CodeLabel.Visibility = Visibility.Visible;

                ConnectionSteps.Visibility = Visibility.Visible;
                NoCodeText.Visibility = Visibility.Hidden;
            });
        }

        /**
         * (Attempts to) uninstall sentinel.
         */
        public void Uninstall(object sender, EventArgs args)
        {
            MessageBoxResult result = MessageBox.Show("Are you sure you want to uninstall Destiny Conduit? All files will be deleted.", "Destiny Conduit", MessageBoxButton.YesNo);
            if (result == MessageBoxResult.No) return;

            // Step 1: Delete AppData.
            try { Directory.Delete(Persistence.DATA_DIRECTORY, true); } catch { /* ignored */ }

            // Step 2: Unlink launch-on-start if enabled.
            if (Persistence.LaunchesAtStartup()) Persistence.ToggleLaunchAtStartup();

            // Step 3: Delete Executable.
            Process.Start(new ProcessStartInfo
            {
                Arguments = "/C choice /C Y /N /D Y /T 3 & Del " + System.Reflection.Assembly.GetExecutingAssembly().Location,
                WindowStyle = ProcessWindowStyle.Hidden,
                CreateNoWindow = true,
                FileName = "cmd.exe"
            });

            // Step 4: Stop Program.
            Application.Current.Shutdown();
        }

        /**
         * Invoked when window closes, unregisters from persistence listeners.
         */
        private void Window_Closing(object sender, System.ComponentModel.CancelEventArgs e)
        {
            Persistence.OnHubCodeChanged -= RenderCode;
            RiftHost.OnLog -= AppendRiftLog;
            RiftHost.OnStatusChanged -= UpdateRiftStatus;
        }

        private void HandleStartupChange(object sender, EventArgs e)
        {
            Persistence.ToggleLaunchAtStartup();
        }
    }
}
