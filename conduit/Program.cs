using System;

namespace Conduit
{
    class Program
    {
        public static string APP_NAME = "Destiny Conduit Local";
        public static string VERSION = "2.3.0";

        // Local-first: by default Conduit talks to a Rift instance running on this
        // same computer. Can still be overridden with the DESTINY_HUB environment
        // variable or the first command line argument.
        public static string HUB_WS = "ws://127.0.0.1:51001/conduit";
        public static string HUB = "http://127.0.0.1:51001";

        /**
         * Returns the address of the web interface as reachable from other devices
         * on the network (i.e. with the machine's LAN IP substituted for localhost).
         */
        public static string GetDisplayHub()
        {
            var hub = HUB;
            if (!hub.Contains("127.0.0.1") && !hub.Contains("localhost")) return hub;

            try
            {
                // Standard trick to find the outgoing LAN IP: "connect" a UDP socket
                // (no packets are actually sent) and read the local endpoint.
                using (var socket = new System.Net.Sockets.Socket(System.Net.Sockets.AddressFamily.InterNetwork, System.Net.Sockets.SocketType.Dgram, 0))
                {
                    socket.Connect("8.8.8.8", 65530);
                    var endPoint = (System.Net.IPEndPoint) socket.LocalEndPoint;
                    return hub.Replace("127.0.0.1", endPoint.Address.ToString()).Replace("localhost", endPoint.Address.ToString());
                }
            }
            catch
            {
                return hub;
            }
        }

        /**
         * Reads an alternative hub (Rift) location from the DESTINY_HUB environment
         * variable or the first command line argument. This allows running against
         * a local Rift instance, e.g.:
         *     Conduit.exe http://192.168.1.10:51001
         * or  set DESTINY_HUB=http://192.168.1.10:51001
         */
        private static void LoadHubOverride(string[] args)
        {
            var hub = Environment.GetEnvironmentVariable("DESTINY_HUB");
            if (args.Length > 0 && (args[0].StartsWith("http://") || args[0].StartsWith("https://"))) hub = args[0];
            if (string.IsNullOrEmpty(hub)) return;

            hub = hub.TrimEnd('/');
            HUB = hub;
            HUB_WS = (hub.StartsWith("https://") ? "wss://" + hub.Substring(8) : "ws://" + hub.Substring(7)) + "/conduit";
        }

        private static App _instance;

        private static System.Threading.Mutex _singleInstanceMutex;

        /**
         * Releases the single-instance mutex. Called right before intentionally
         * relaunching the process (e.g. when elevating to administrator), so the
         * new instance is not rejected by the single-instance check.
         */
        public static void ReleaseSingleInstanceMutex()
        {
            try
            {
                if (_singleInstanceMutex != null)
                {
                    _singleInstanceMutex.ReleaseMutex();
                    _singleInstanceMutex.Dispose();
                    _singleInstanceMutex = null;
                }
            }
            catch (Exception ignored) { }
        }

        [STAThread]
        public static void Main(string[] args)
        {
            // Prevent multiple instances: two Conduits with the same keys would
            // endlessly kick each other off Rift (only one connection per code).
            bool isFirstInstance;
            _singleInstanceMutex = new System.Threading.Mutex(true, "DestinyConduitLocalSingleInstance", out isFirstInstance);
            if (!isFirstInstance)
            {
                System.Windows.MessageBox.Show(
                    "Destiny Conduit Local è già in esecuzione. Controlla l'icona nella system tray (vicino all'orologio).",
                    APP_NAME, System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Warning);
                return;
            }

            LoadHubOverride(args);

            // Start the application.
            _instance = new App();
            _instance.InitializeComponent();
            _instance.Run();
        }
    }
}
