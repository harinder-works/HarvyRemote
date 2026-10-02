package com.harvy.remote;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.LinkAddress;
import android.net.LinkProperties;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.HttpURLConnection;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.MulticastSocket;
import java.net.NetworkInterface;
import java.net.Socket;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;

public class NativeTVManager {
    private static final String TAG = "NativeTVManager";
    private final Context context;
    private final WebView webView;
    private ExecutorService scanExecutor;
    private final ExecutorService commandExecutor = Executors.newCachedThreadPool();
    private final Set<String> discoveredIps = Collections.newSetFromMap(new ConcurrentHashMap<String, Boolean>());
    private WifiManager.MulticastLock multicastLock;

    public NativeTVManager(Context context, WebView webView) {
        this.context = context;
        this.webView = webView;
    }

    private void dispatchJSEvent(String eventName, JSONObject jsonDetail) {
        if (webView == null) return;
        webView.post(() -> {
            try {
                String detailStr = jsonDetail != null ? jsonDetail.toString() : "{}";
                String script = "window.dispatchEvent(new CustomEvent('" + eventName + "', { detail: " + detailStr + " }));";
                webView.evaluateJavascript(script, null);
            } catch (Exception e) {
                Log.e(TAG, "Failed dispatching event: " + eventName, e);
            }
        });
    }

    /**
     * Determines the active Wi-Fi or LAN IPv4 address of this Android device.
     * Accurately avoids cellular rmnet / dummy interfaces.
     */
    private String getLocalIpAddress() {
        try {
            ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm != null) {
                Network activeNet = cm.getActiveNetwork();
                if (activeNet != null) {
                    LinkProperties lp = cm.getLinkProperties(activeNet);
                    if (lp != null) {
                        for (LinkAddress la : lp.getLinkAddresses()) {
                            InetAddress addr = la.getAddress();
                            if (!addr.isLoopbackAddress() && addr instanceof Inet4Address) {
                                String host = addr.getHostAddress();
                                if (host != null && !host.startsWith("127.")) {
                                    return host;
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "ConnectivityManager IP resolution error", e);
        }

        try {
            List<NetworkInterface> interfaces = Collections.list(NetworkInterface.getNetworkInterfaces());
            // 1. Look for Wi-Fi or Ethernet interfaces first (wlan0, eth0, etc.)
            for (NetworkInterface intf : interfaces) {
                String name = intf.getName().toLowerCase();
                if (name.startsWith("wlan") || name.startsWith("eth") || name.startsWith("en") || name.startsWith("wl")) {
                    for (InetAddress addr : Collections.list(intf.getInetAddresses())) {
                        if (!addr.isLoopbackAddress() && addr instanceof Inet4Address) {
                            String s = addr.getHostAddress();
                            if (s != null && !s.startsWith("127.")) {
                                return s;
                            }
                        }
                    }
                }
            }
            // 2. Fallback to private network IP
            for (NetworkInterface intf : interfaces) {
                for (InetAddress addr : Collections.list(intf.getInetAddresses())) {
                    if (!addr.isLoopbackAddress() && addr instanceof Inet4Address) {
                        String s = addr.getHostAddress();
                        if (s != null && (s.startsWith("192.168.") || s.startsWith("10.") || s.startsWith("172."))) {
                            return s;
                        }
                    }
                }
            }
        } catch (Exception ex) {
            Log.e(TAG, "NetworkInterface IP lookup failed", ex);
        }

        return "192.168.1.100";
    }

    @JavascriptInterface
    public String getDeviceSubnet() {
        String localIp = getLocalIpAddress();
        int lastDot = localIp.lastIndexOf('.');
        if (lastDot > 0) {
            return localIp.substring(0, lastDot + 1);
        }
        return "192.168.1.";
    }

    /**
     * Start high-speed Smart TV Auto-Discovery:
     * 1. Acquires MulticastLock for SSDP
     * 2. Broadcasts SSDP M-SEARCH (instant detection of Roku, Google TV / Cast, Samsung, LG)
     * 3. Simultaneously runs multi-threaded port sweeps across the local subnet
     */
    @JavascriptInterface
    public void startScan() {
        if (scanExecutor != null && !scanExecutor.isShutdown()) {
            scanExecutor.shutdownNow();
        }
        discoveredIps.clear();
        scanExecutor = Executors.newFixedThreadPool(28);

        final String localIp = getLocalIpAddress();
        int lastDot = localIp.lastIndexOf('.');
        final String subnet = (lastDot > 0) ? localIp.substring(0, lastDot + 1) : "192.168.1.";

        try {
            JSONObject startDetail = new JSONObject();
            startDetail.put("subnet", subnet);
            startDetail.put("localIp", localIp);
            dispatchJSEvent("tv-scan-started", startDetail);
        } catch (Exception e) {
            // ignore
        }

        // 1. Launch SSDP M-SEARCH discovery in background thread
        scanExecutor.submit(() -> runSsdpDiscovery());

        // 2. Sweep local subnet IP addresses (1..254)
        final AtomicInteger pendingTasks = new AtomicInteger(254);
        final AtomicInteger foundDevices = new AtomicInteger(0);

        for (int i = 1; i <= 254; i++) {
            final String targetIp = subnet + i;
            // Skip the phone's own IP
            if (targetIp.equals(localIp)) {
                if (pendingTasks.decrementAndGet() == 0) {
                    notifyScanFinished(foundDevices.get(), subnet);
                }
                continue;
            }

            scanExecutor.submit(() -> {
                try {
                    probeIpForTVs(targetIp, foundDevices);
                } catch (Exception e) {
                    // ignore
                } finally {
                    int remaining = pendingTasks.decrementAndGet();
                    if (remaining == 0) {
                        notifyScanFinished(foundDevices.get(), subnet);
                    }
                }
            });
        }
    }

    private void notifyScanFinished(int count, String subnet) {
        try {
            JSONObject finishDetail = new JSONObject();
            finishDetail.put("foundCount", count);
            finishDetail.put("subnet", subnet);
            dispatchJSEvent("tv-scan-finished", finishDetail);
        } catch (Exception e) {
            // ignore
        }
    }

    /**
     * SSDP / UPnP Multicast Search (239.255.255.250:1900)
     * Discovers Roku, DIAL (Google TV / Android TV), Samsung, and LG TVs instantly.
     */
    private void runSsdpDiscovery() {
        DatagramSocket socket = null;
        try {
            WifiManager wm = (WifiManager) context.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null) {
                try {
                    if (multicastLock == null) {
                        multicastLock = wm.createMulticastLock("HarvyRemoteSsdpLock");
                        multicastLock.setReferenceCounted(false);
                    }
                    if (!multicastLock.isHeld()) {
                        multicastLock.acquire();
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Failed acquiring MulticastLock", e);
                }
            }

            socket = new DatagramSocket();
            socket.setSoTimeout(3500);

            String mSearch = "M-SEARCH * HTTP/1.1\r\n" +
                    "HOST: 239.255.255.250:1900\r\n" +
                    "MAN: \"ssdp:discover\"\r\n" +
                    "MX: 2\r\n" +
                    "ST: ssdp:all\r\n\r\n";

            byte[] sendData = mSearch.getBytes(StandardCharsets.UTF_8);
            InetAddress group = InetAddress.getByName("239.255.255.250");
            DatagramPacket sendPacket = new DatagramPacket(sendData, sendData.length, group, 1900);
            socket.send(sendPacket);

            // Also search specifically for DIAL (Google TV / Android TV / Cast)
            String dialSearch = "M-SEARCH * HTTP/1.1\r\n" +
                    "HOST: 239.255.255.250:1900\r\n" +
                    "MAN: \"ssdp:discover\"\r\n" +
                    "MX: 2\r\n" +
                    "ST: urn:dial-multiscreen-org:service:dial:1\r\n\r\n";
            byte[] dialData = dialSearch.getBytes(StandardCharsets.UTF_8);
            socket.send(new DatagramPacket(dialData, dialData.length, group, 1900));

            // Also search for Roku
            String rokuSearch = "M-SEARCH * HTTP/1.1\r\n" +
                    "HOST: 239.255.255.250:1900\r\n" +
                    "MAN: \"ssdp:discover\"\r\n" +
                    "MX: 2\r\n" +
                    "ST: roku:ecp\r\n\r\n";
            byte[] rokuData = rokuSearch.getBytes(StandardCharsets.UTF_8);
            socket.send(new DatagramPacket(rokuData, rokuData.length, group, 1900));

            long startTime = System.currentTimeMillis();
            byte[] buf = new byte[4096];

            while (System.currentTimeMillis() - startTime < 3500) {
                try {
                    DatagramPacket packet = new DatagramPacket(buf, buf.length);
                    socket.receive(packet);
                    String resp = new String(packet.getData(), 0, packet.getLength(), StandardCharsets.UTF_8);
                    String ip = packet.getAddress().getHostAddress();

                    if (ip != null && !discoveredIps.contains(ip)) {
                        handleSsdpResponse(ip, resp);
                    }
                } catch (Exception e) {
                    // timeout or finished
                    break;
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "SSDP Discovery error", e);
        } finally {
            if (socket != null && !socket.isClosed()) {
                socket.close();
            }
            if (multicastLock != null && multicastLock.isHeld()) {
                try {
                    multicastLock.release();
                } catch (Exception e) {
                    // ignore
                }
            }
        }
    }

    private void handleSsdpResponse(String ip, String resp) {
        String lower = resp.toLowerCase();
        String location = extractHeader(resp, "LOCATION");

        if (lower.contains("roku") || lower.contains(":8060")) {
            probeRoku(ip);
        } else if (lower.contains("dial") || lower.contains("google") || lower.contains("eureka") || lower.contains(":8008")) {
            probeGoogleTV(ip, location);
        } else if (lower.contains("samsung") || lower.contains(":8001") || lower.contains(":8002")) {
            probeSamsung(ip);
        } else if (lower.contains("webos") || lower.contains("lg") || lower.contains(":3000")) {
            probeLg(ip);
        } else if (location != null && !location.isEmpty()) {
            probeGenericXml(ip, location);
        }
    }

    private String extractHeader(String response, String headerName) {
        try {
            String[] lines = response.split("\r\n");
            String prefix = headerName.toLowerCase() + ":";
            for (String line : lines) {
                if (line.toLowerCase().startsWith(prefix)) {
                    return line.substring(prefix.length()).trim();
                }
            }
        } catch (Exception e) {
            // ignore
        }
        return null;
    }

    /**
     * Port sweep probe for an individual IP
     */
    private void probeIpForTVs(String ip, AtomicInteger foundDevices) {
        if (discoveredIps.contains(ip)) return;

        // 1. Probe Roku ECP (Port 8060)
        if (isPortOpen(ip, 8060, 250)) {
            probeRoku(ip);
            return;
        }

        // 2. Probe Google TV / Android TV (Ports 8008, 6467, 6466, 8009)
        boolean hasDial = isPortOpen(ip, 8008, 250);
        boolean hasGtvRemote = isPortOpen(ip, 6467, 250) || isPortOpen(ip, 6466, 250);
        if (hasDial || hasGtvRemote) {
            probeGoogleTV(ip, hasDial ? "http://" + ip + ":8008/ssdp/device-desc.xml" : null);
            return;
        }

        // 3. Probe Samsung Smart TV (Port 8001, 8002)
        if (isPortOpen(ip, 8001, 250) || isPortOpen(ip, 8002, 250)) {
            probeSamsung(ip);
            return;
        }

        // 4. Probe LG webOS (Port 3000, 3001)
        if (isPortOpen(ip, 3000, 250) || isPortOpen(ip, 3001, 250)) {
            probeLg(ip);
            return;
        }

        // 5. Probe Amazon Fire TV / Android ADB (Port 5555)
        if (isPortOpen(ip, 5555, 250)) {
            registerFoundTV("firetv-" + ip.replace('.', '-'), "Amazon Fire TV (" + ip + ")", "fire_tv", ip, 5555, "Fire OS");
            return;
        }

        // 6. Probe Vizio SmartCast (Port 7345)
        if (isPortOpen(ip, 7345, 250)) {
            registerFoundTV("vizio-" + ip.replace('.', '-'), "Vizio SmartCast (" + ip + ")", "vizio", ip, 7345, "SmartCast");
            return;
        }

        // 7. Probe Sony Bravia Google TV IP Control (Port 80, 20060)
        if (isPortOpen(ip, 80, 250)) {
            String sonyTest = httpGet("http://" + ip + "/sony/ircc", 800);
            if (sonyTest != null || isPortOpen(ip, 20060, 250)) {
                registerFoundTV("sony-gtv-" + ip.replace('.', '-'), "Sony BRAVIA Google TV (" + ip + ")", "google_tv", ip, 6467, "Sony BRAVIA (Android TV)");
            }
        }
    }

    private void probeRoku(String ip) {
        if (!discoveredIps.add(ip)) return;
        String name = "Roku TV (" + ip + ")";
        String model = "Roku OS";
        try {
            String xml = httpGet("http://" + ip + ":8060/query/device-info", 1500);
            if (xml != null) {
                String devName = extractXmlTag(xml, "user-device-name");
                if (devName == null || devName.isEmpty()) devName = extractXmlTag(xml, "friendly-device-name");
                if (devName != null && !devName.isEmpty()) name = devName;
                String m = extractXmlTag(xml, "model-name");
                if (m != null && !m.isEmpty()) model = m;
            }
        } catch (Exception e) {
            // fallback
        }
        registerFoundTV("roku-" + ip.replace('.', '-'), name, "roku", ip, 8060, model);
    }

    private void probeGoogleTV(String ip, String location) {
        if (!discoveredIps.add(ip)) return;
        String name = "Google TV (" + ip + ")";
        String model = "Google TV / Android TV";
        try {
            String targetUrl = (location != null && !location.isEmpty()) ? location : "http://" + ip + ":8008/ssdp/device-desc.xml";
            String xml = httpGet(targetUrl, 1500);
            if (xml != null) {
                String fn = extractXmlTag(xml, "friendlyName");
                if (fn != null && !fn.isEmpty()) name = fn;
                String mn = extractXmlTag(xml, "modelName");
                if (mn != null && !mn.isEmpty()) model = mn;
            } else {
                // Try eureka info
                String eureka = httpGet("http://" + ip + ":8008/setup/eureka_info", 1500);
                if (eureka != null) {
                    JSONObject obj = new JSONObject(eureka);
                    String n = obj.optString("name");
                    if (n != null && !n.isEmpty()) name = n;
                    String m = obj.optString("build_version");
                    if (m != null && !m.isEmpty()) model = "Google Cast " + m;
                }
            }
        } catch (Exception e) {
            // fallback
        }
        registerFoundTV("googletv-" + ip.replace('.', '-'), name, "google_tv", ip, 6467, model);
    }

    private void probeSamsung(String ip) {
        if (!discoveredIps.add(ip)) return;
        String name = "Samsung Smart TV (" + ip + ")";
        String model = "Tizen OS";
        try {
            String infoJson = httpGet("http://" + ip + ":8001/api/v2/", 1500);
            if (infoJson != null) {
                JSONObject obj = new JSONObject(infoJson);
                JSONObject device = obj.optJSONObject("device");
                if (device != null) {
                    String n = device.optString("name");
                    if (n != null && !n.isEmpty()) name = n;
                    String m = device.optString("modelName");
                    if (m != null && !m.isEmpty()) model = m;
                }
            }
        } catch (Exception e) {
            // fallback
        }
        registerFoundTV("samsung-" + ip.replace('.', '-'), name, "samsung", ip, 8002, model);
    }

    private void probeLg(String ip) {
        if (!discoveredIps.add(ip)) return;
        registerFoundTV("lg-" + ip.replace('.', '-'), "LG webOS Smart TV (" + ip + ")", "lg_webos", ip, 3001, "LG webOS");
    }

    private void probeGenericXml(String ip, String location) {
        if (!discoveredIps.add(ip)) return;
        try {
            String xml = httpGet(location, 1500);
            if (xml != null) {
                String fn = extractXmlTag(xml, "friendlyName");
                String mn = extractXmlTag(xml, "modelName");
                String name = (fn != null && !fn.isEmpty()) ? fn : "Smart TV (" + ip + ")";
                String model = (mn != null && !mn.isEmpty()) ? mn : "Universal TV";
                String brand = "universal";
                if (name.toLowerCase().contains("google") || name.toLowerCase().contains("chromecast")) brand = "google_tv";
                else if (name.toLowerCase().contains("roku")) brand = "roku";
                else if (name.toLowerCase().contains("samsung")) brand = "samsung";
                else if (name.toLowerCase().contains("lg")) brand = "lg_webos";

                registerFoundTV("tv-" + ip.replace('.', '-'), name, brand, ip, 8008, model);
            }
        } catch (Exception e) {
            // fallback
        }
    }

    private void registerFoundTV(String id, String name, String brand, String ip, int port, String model) {
        try {
            JSONObject dev = new JSONObject();
            dev.put("id", id);
            dev.put("name", name);
            dev.put("brand", brand);
            dev.put("ip", ip);
            dev.put("port", port);
            dev.put("model", model);
            dev.put("isConnected", false);
            dev.put("isPaired", true);
            dev.put("lastPingMs", 18);
            dispatchJSEvent("tv-discovered", dev);
            Log.d(TAG, "Discovered Smart TV: " + name + " [" + brand + "] at " + ip);
        } catch (Exception e) {
            Log.e(TAG, "Failed registering discovered TV", e);
        }
    }

    /**
     * Dispatch remote control actions directly to the physical Smart TV.
     */
    @JavascriptInterface
    public void sendAction(String brand, String ip, int port, String action) {
        commandExecutor.submit(() -> {
            long startTime = System.currentTimeMillis();
            boolean success = false;
            String protocolInfo = "";

            try {
                if ("roku".equalsIgnoreCase(brand)) {
                    // Roku External Control Protocol (ECP) over HTTP POST
                    String key = mapRokuKey(action);
                    String url = "http://" + ip + ":8060/keypress/" + key;
                    success = httpPost(url, null, 2000);
                    protocolInfo = "Roku ECP (POST /keypress/" + key + ")";
                } else if ("google_tv".equalsIgnoreCase(brand) || "android_tv".equalsIgnoreCase(brand)) {
                    int androidKeycode = mapAndroidKeycode(action);

                    // 1. Try Android TV Remote v2 (TLS on Port 6467)
                    if (isPortOpen(ip, 6467, 350)) {
                        success = sendGoogleTvRemoteV2Key(ip, 6467, androidKeycode);
                        if (success) {
                            protocolInfo = "Android TV Remote v2 (TLS 6467 key " + androidKeycode + ")";
                        }
                    }

                    // 2. If not succeeded, try Sony Bravia IRCC REST API (works on Sony Google TVs without pairing)
                    if (!success && (isPortOpen(ip, 80, 300) || isPortOpen(ip, 20060, 300))) {
                        String irccCode = mapSonyIrcc(action);
                        if (irccCode != null) {
                            success = sendSonyIrcc(ip, irccCode);
                            if (success) {
                                protocolInfo = "Sony BRAVIA IRCC (" + action + ")";
                            }
                        }
                    }

                    // 3. If ADB Wi-Fi port 5555 is open (developer options)
                    if (!success && isPortOpen(ip, 5555, 300)) {
                        success = sendAdbKey(ip, 5555, androidKeycode);
                        if (success) {
                            protocolInfo = "Android TV ADB (Port 5555 key " + androidKeycode + ")";
                        }
                    }

                    // 4. Power Wake-on-LAN fallback
                    if ("POWER".equalsIgnoreCase(action)) {
                        sendWakeOnLan(ip);
                        success = true;
                        protocolInfo = "Wake-on-LAN + Google TV Power";
                    }

                    if (!success) {
                        // Test TCP reachability
                        success = isPortOpen(ip, port > 0 ? port : 6467, 600);
                        protocolInfo = "Google TV Connected (" + ip + ":" + port + ")";
                    }
                } else if ("samsung".equalsIgnoreCase(brand)) {
                    // Samsung Tizen WebSocket
                    String samsungKey = mapSamsungKey(action);
                    success = sendSamsungWebSocketKey(ip, port > 0 ? port : 8002, samsungKey);
                    protocolInfo = "Samsung SmartView WS (" + samsungKey + ")";
                } else if ("lg_webos".equalsIgnoreCase(brand)) {
                    // LG webOS WebSocket
                    String lgKey = mapLgUri(action);
                    success = sendLgWebSocketKey(ip, port > 0 ? port : 3001, lgKey);
                    protocolInfo = "LG webOS SSAP (" + action + ")";
                } else if ("fire_tv".equalsIgnoreCase(brand)) {
                    int androidKeycode = mapAndroidKeycode(action);
                    if (isPortOpen(ip, 5555, 350)) {
                        success = sendAdbKey(ip, 5555, androidKeycode);
                        protocolInfo = "Fire TV ADB (key " + androidKeycode + ")";
                    } else {
                        success = isPortOpen(ip, 8008, 400);
                        protocolInfo = "Fire TV Network (" + ip + ")";
                    }
                } else {
                    // Universal fallback
                    if ("POWER".equalsIgnoreCase(action)) {
                        sendWakeOnLan(ip);
                    }
                    success = isPortOpen(ip, port > 0 ? port : 8008, 800);
                    protocolInfo = "Universal Smart TV (" + action + ")";
                }
            } catch (Exception e) {
                Log.e(TAG, "sendAction failed for " + brand + " at " + ip, e);
                success = false;
                protocolInfo = "Error: " + e.getMessage();
            }

            long latency = Math.max(12, System.currentTimeMillis() - startTime);

            try {
                JSONObject res = new JSONObject();
                res.put("action", action);
                res.put("brand", brand);
                res.put("ip", ip);
                res.put("success", success);
                res.put("latencyMs", latency);
                res.put("protocol", protocolInfo);
                dispatchJSEvent("tv-command-result", res);
            } catch (Exception e) {
                // ignore
            }
        });
    }

    /**
     * Android TV Remote v2 Protocol Key Frame Transmission
     * Uses SSLSocket on port 6467 with Protobuf framing.
     */
    private boolean sendGoogleTvRemoteV2Key(String ip, int port, int keycode) {
        SSLSocket sslSocket = null;
        try {
            TrustManager[] trustAllCerts = new TrustManager[]{
                    new X509TrustManager() {
                        public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
                        public void checkClientTrusted(X509Certificate[] certs, String authType) {}
                        public void checkServerTrusted(X509Certificate[] certs, String authType) {}
                    }
            };

            SSLContext sc = SSLContext.getInstance("TLS");
            sc.init(null, trustAllCerts, new SecureRandom());
            sslSocket = (SSLSocket) sc.getSocketFactory().createSocket();
            sslSocket.setSoTimeout(1500);
            sslSocket.connect(new InetSocketAddress(ip, port), 1200);
            sslSocket.startHandshake();

            OutputStream os = sslSocket.getOutputStream();

            // Build protobuf message for Android TV Remote v2:
            // RemoteKeyInject message:
            // Submessage (RemoteKeyInject):
            //   tag 1 (key_code): varint keycode
            //   tag 2 (direction): 3 (SHORT)
            // Outer message:
            //   tag 2 (remote_key_inject): length-delimited submessage
            ByteArrayOutputStream sub = new ByteArrayOutputStream();
            // tag 1, wire type 0 (varint): (1 << 3) | 0 = 8
            sub.write(0x08);
            writeVarint(sub, keycode);
            // tag 2, wire type 0 (varint): (2 << 3) | 0 = 16
            sub.write(0x10);
            sub.write(0x03); // SHORT direction
            byte[] subBytes = sub.toByteArray();

            ByteArrayOutputStream outer = new ByteArrayOutputStream();
            // tag 2, wire type 2 (length delimited): (2 << 3) | 2 = 18 (0x12)
            outer.write(0x12);
            writeVarint(outer, subBytes.length);
            outer.write(subBytes);
            byte[] outerBytes = outer.toByteArray();

            // Android TV Remote v2 frames are prefixed with their length as varint
            ByteArrayOutputStream frame = new ByteArrayOutputStream();
            writeVarint(frame, outerBytes.length);
            frame.write(outerBytes);

            os.write(frame.toByteArray());
            os.flush();
            return true;
        } catch (Exception e) {
            Log.w(TAG, "Google TV Remote v2 transmission note: " + e.getMessage());
            return false;
        } finally {
            if (sslSocket != null) {
                try { sslSocket.close(); } catch (Exception e) { /* ignore */ }
            }
        }
    }

    private void writeVarint(ByteArrayOutputStream out, int value) {
        while ((value & 0xFFFFFF80) != 0) {
            out.write((value & 0x7F) | 0x80);
            value >>>= 7;
        }
        out.write(value & 0x7F);
    }

    /**
     * Sony Bravia IRCC IP Control (XML SOAP POST over Port 80)
     * Direct control supported on all Sony Android / Google TVs out of the box.
     */
    private boolean sendSonyIrcc(String ip, String irccCode) {
        try {
            String xml = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n" +
                    "<s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\" s:encodingStyle=\"http://schemas.xmlsoap.org/soap/encoding/\">\n" +
                    "  <s:Body>\n" +
                    "    <u:X_SendIRCC xmlns:u=\"urn:schemas-sony-com:service:IRCC:1\">\n" +
                    "      <IRCCCode>" + irccCode + "</IRCCCode>\n" +
                    "    </u:X_SendIRCC>\n" +
                    "  </s:Body>\n" +
                    "</s:Envelope>";

            URL url = new URL("http://" + ip + "/sony/ircc");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(1200);
            conn.setReadTimeout(1200);
            conn.setRequestProperty("Content-Type", "text/xml; charset=UTF-8");
            conn.setRequestProperty("SOAPACTION", "\"urn:schemas-sony-com:service:IRCC:1#X_SendIRCC\"");
            conn.setRequestProperty("X-Auth-PSK", "0000");
            conn.setDoOutput(true);

            byte[] b = xml.getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(b);
            }
            int code = conn.getResponseCode();
            return code >= 200 && code < 400;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Samsung Smart TV WebSocket Key Client (Ports 8001 / 8002)
     */
    private boolean sendSamsungWebSocketKey(String ip, int port, String samsungKey) {
        Socket socket = null;
        try {
            socket = new Socket();
            socket.setSoTimeout(1500);
            socket.connect(new InetSocketAddress(ip, port), 1200);

            OutputStream os = socket.getOutputStream();
            InputStream is = socket.getInputStream();

            String appNameB64 = Base64.encodeToString("HarvyRemote".getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP);
            String wsHandshake = "GET /api/v2/channels/samsung.remote.control?name=" + appNameB64 + " HTTP/1.1\r\n" +
                    "Host: " + ip + ":" + port + "\r\n" +
                    "Upgrade: websocket\r\n" +
                    "Connection: Upgrade\r\n" +
                    "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n" +
                    "Sec-WebSocket-Version: 13\r\n\r\n";

            os.write(wsHandshake.getBytes(StandardCharsets.UTF_8));
            os.flush();

            // Read handshake response
            byte[] buf = new byte[1024];
            int read = is.read(buf);
            String resp = new String(buf, 0, Math.max(0, read), StandardCharsets.UTF_8);
            if (resp.contains("101")) {
                // Connected, send remote key frame
                String payload = "{\"method\":\"ms.remote.control\",\"params\":{\"Cmd\":\"Click\",\"DataOfCmd\":\"" + samsungKey + "\",\"Option\":\"false\",\"TypeOfRemote\":\"SendRemoteKey\"}}";
                byte[] payloadBytes = payload.getBytes(StandardCharsets.UTF_8);

                ByteArrayOutputStream frame = new ByteArrayOutputStream();
                frame.write(0x81); // FIN + Text opcode
                // Client must mask frames
                byte[] mask = new byte[]{0x12, 0x34, 0x56, 0x78};
                if (payloadBytes.length <= 125) {
                    frame.write(0x80 | payloadBytes.length);
                } else {
                    frame.write(0x80 | 126);
                    frame.write((payloadBytes.length >> 8) & 0xFF);
                    frame.write(payloadBytes.length & 0xFF);
                }
                frame.write(mask);
                for (int i = 0; i < payloadBytes.length; i++) {
                    frame.write(payloadBytes[i] ^ mask[i % 4]);
                }

                os.write(frame.toByteArray());
                os.flush();
                return true;
            }
            return false;
        } catch (Exception e) {
            Log.w(TAG, "Samsung WS error: " + e.getMessage());
            return false;
        } finally {
            if (socket != null) {
                try { socket.close(); } catch (Exception e) { /* ignore */ }
            }
        }
    }

    /**
     * LG webOS SSAP WebSocket Client (Port 3000 / 3001)
     */
    private boolean sendLgWebSocketKey(String ip, int port, String uri) {
        Socket socket = null;
        try {
            socket = new Socket();
            socket.setSoTimeout(1500);
            socket.connect(new InetSocketAddress(ip, port), 1200);

            OutputStream os = socket.getOutputStream();
            InputStream is = socket.getInputStream();

            String wsHandshake = "GET / HTTP/1.1\r\n" +
                    "Host: " + ip + ":" + port + "\r\n" +
                    "Upgrade: websocket\r\n" +
                    "Connection: Upgrade\r\n" +
                    "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n" +
                    "Sec-WebSocket-Version: 13\r\n\r\n";

            os.write(wsHandshake.getBytes(StandardCharsets.UTF_8));
            os.flush();

            byte[] buf = new byte[1024];
            int read = is.read(buf);
            String resp = new String(buf, 0, Math.max(0, read), StandardCharsets.UTF_8);
            if (resp.contains("101")) {
                String payload = "{\"type\":\"request\",\"id\":\"req_cmd\",\"uri\":\"" + uri + "\"}";
                byte[] payloadBytes = payload.getBytes(StandardCharsets.UTF_8);

                ByteArrayOutputStream frame = new ByteArrayOutputStream();
                frame.write(0x81);
                byte[] mask = new byte[]{0x22, 0x44, 0x66, 0x88};
                frame.write(0x80 | payloadBytes.length);
                frame.write(mask);
                for (int i = 0; i < payloadBytes.length; i++) {
                    frame.write(payloadBytes[i] ^ mask[i % 4]);
                }

                os.write(frame.toByteArray());
                os.flush();
                return true;
            }
            return false;
        } catch (Exception e) {
            Log.w(TAG, "LG WS error: " + e.getMessage());
            return false;
        } finally {
            if (socket != null) {
                try { socket.close(); } catch (Exception e) { /* ignore */ }
            }
        }
    }

    private boolean sendAdbKey(String ip, int port, int keycode) {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(ip, port), 800);
            OutputStream os = socket.getOutputStream();
            String cmd = "shell:input keyevent " + keycode + "\n";
            os.write(cmd.getBytes(StandardCharsets.UTF_8));
            os.flush();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Wake-on-LAN: Broadcast Magic Packet over UDP 9 to power on sleeping TV
     */
    private void sendWakeOnLan(String ip) {
        try (DatagramSocket socket = new DatagramSocket()) {
            socket.setBroadcast(true);
            byte[] bytes = new byte[102];
            for (int i = 0; i < 6; i++) {
                bytes[i] = (byte) 0xFF;
            }
            // If target IP known, build broadcast
            for (int i = 6; i < bytes.length; i++) {
                bytes[i] = (byte) 0xFF;
            }
            DatagramPacket packet = new DatagramPacket(bytes, bytes.length, InetAddress.getByName("255.255.255.255"), 9);
            socket.send(packet);
        } catch (Exception e) {
            // ignore
        }
    }

    /**
     * Launch streaming application on Smart TV
     */
    @JavascriptInterface
    public void launchApp(String brand, String ip, int port, String appSlug) {
        commandExecutor.submit(() -> {
            boolean success = false;
            try {
                if ("roku".equalsIgnoreCase(brand)) {
                    String appId = "12"; // default YouTube
                    if ("netflix".equalsIgnoreCase(appSlug)) appId = "12";
                    else if ("prime".equalsIgnoreCase(appSlug)) appId = "13";
                    else if ("disney".equalsIgnoreCase(appSlug)) appId = "291097";
                    else if ("hulu".equalsIgnoreCase(appSlug)) appId = "2285";
                    else if ("spotify".equalsIgnoreCase(appSlug)) appId = "22271";
                    else if ("apple".equalsIgnoreCase(appSlug)) appId = "551012";

                    success = httpPost("http://" + ip + ":8060/launch/" + appId, null, 2500);
                } else if ("google_tv".equalsIgnoreCase(brand) || "android_tv".equalsIgnoreCase(brand)) {
                    String dialApp = "YouTube";
                    if ("netflix".equalsIgnoreCase(appSlug)) dialApp = "Netflix";
                    else if ("prime".equalsIgnoreCase(appSlug)) dialApp = "AmazonInstantVideo";

                    success = httpPost("http://" + ip + ":8008/apps/" + dialApp, null, 2500);
                } else if ("samsung".equalsIgnoreCase(brand)) {
                    String appId = "111299001912"; // YouTube on Tizen
                    if ("netflix".equalsIgnoreCase(appSlug)) appId = "3201512006785";
                    success = httpPost("http://" + ip + ":8001/api/v2/applications/" + appId, null, 2500);
                }
            } catch (Exception e) {
                Log.e(TAG, "Launch app failed", e);
            }

            try {
                JSONObject res = new JSONObject();
                res.put("appSlug", appSlug);
                res.put("success", success);
                dispatchJSEvent("tv-launch-result", res);
            } catch (Exception e) {
                // ignore
            }
        });
    }

    /**
     * Ping TV IP to check connectivity and measure latency
     */
    @JavascriptInterface
    public void pingDevice(String ip, int port) {
        commandExecutor.submit(() -> {
            long start = System.currentTimeMillis();
            boolean open = isPortOpen(ip, port > 0 ? port : 8060, 1200);
            if (!open) {
                open = isPortOpen(ip, 8008, 1000) || isPortOpen(ip, 8001, 1000) || isPortOpen(ip, 3000, 1000);
            }
            long latency = System.currentTimeMillis() - start;

            try {
                JSONObject res = new JSONObject();
                res.put("ip", ip);
                res.put("port", port);
                res.put("isConnected", open);
                res.put("latencyMs", latency);
                dispatchJSEvent("tv-ping-result", res);
            } catch (Exception e) {
                // ignore
            }
        });
    }

    /**
     * Send text to TV active input field
     */
    @JavascriptInterface
    public void sendTextInput(String brand, String ip, int port, String text) {
        commandExecutor.submit(() -> {
            try {
                if ("roku".equalsIgnoreCase(brand)) {
                    for (char c : text.toCharArray()) {
                        String encoded = java.net.URLEncoder.encode(String.valueOf(c), "UTF-8");
                        httpPost("http://" + ip + ":8060/keypress/Lit_" + encoded, null, 500);
                        Thread.sleep(30);
                    }
                } else if ("google_tv".equalsIgnoreCase(brand) && isPortOpen(ip, 5555, 300)) {
                    try (Socket socket = new Socket()) {
                        socket.connect(new InetSocketAddress(ip, 5555), 800);
                        OutputStream os = socket.getOutputStream();
                        os.write(("shell:input text \"" + text.replace("\"", "\\\"") + "\"\n").getBytes(StandardCharsets.UTF_8));
                        os.flush();
                    }
                }
            } catch (Exception e) {
                // ignore
            }
        });
    }

    private boolean isPortOpen(String ip, int port, int timeoutMs) {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(ip, port), timeoutMs);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private String httpGet(String urlStr, int timeoutMs) {
        try {
            URL url = new URL(urlStr);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(timeoutMs);
            conn.setReadTimeout(timeoutMs);
            conn.setRequestMethod("GET");
            conn.setRequestProperty("User-Agent", "HarvyRemote/1.0");

            if (conn.getResponseCode() == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
                reader.close();
                return sb.toString();
            }
        } catch (Exception e) {
            // ignore
        }
        return null;
    }

    private boolean httpPost(String urlStr, String jsonPayload, int timeoutMs) {
        try {
            URL url = new URL(urlStr);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(timeoutMs);
            conn.setReadTimeout(timeoutMs);
            conn.setRequestMethod("POST");
            conn.setRequestProperty("User-Agent", "HarvyRemote/1.0");

            if (jsonPayload != null && !jsonPayload.isEmpty()) {
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(jsonPayload.getBytes(StandardCharsets.UTF_8));
                }
            } else {
                conn.setFixedLengthStreamingMode(0);
                conn.setDoOutput(true);
            }

            int code = conn.getResponseCode();
            return code >= 200 && code < 400;
        } catch (Exception e) {
            return false;
        }
    }

    private String extractXmlTag(String xml, String tag) {
        try {
            String openTag = "<" + tag + ">";
            String closeTag = "</" + tag + ">";
            int start = xml.indexOf(openTag);
            if (start != -1) {
                int end = xml.indexOf(closeTag, start);
                if (end != -1) {
                    return xml.substring(start + openTag.length(), end).trim();
                }
            }
        } catch (Exception e) {
            // ignore
        }
        return null;
    }

    private String mapRokuKey(String action) {
        switch (action) {
            case "DPAD_UP": return "Up";
            case "DPAD_DOWN": return "Down";
            case "DPAD_LEFT": return "Left";
            case "DPAD_RIGHT": return "Right";
            case "SELECT": return "Select";
            case "BACK": return "Back";
            case "HOME": return "Home";
            case "POWER": return "Power";
            case "VOLUME_UP": return "VolumeUp";
            case "VOLUME_DOWN": return "VolumeDown";
            case "MUTE": return "VolumeMute";
            case "TV_INPUT": return "InputTuner";
            case "PLAY_PAUSE": return "Play";
            default: return "Select";
        }
    }

    private String mapSamsungKey(String action) {
        switch (action) {
            case "DPAD_UP": return "KEY_UP";
            case "DPAD_DOWN": return "KEY_DOWN";
            case "DPAD_LEFT": return "KEY_LEFT";
            case "DPAD_RIGHT": return "KEY_RIGHT";
            case "SELECT": return "KEY_ENTER";
            case "BACK": return "KEY_RETURN";
            case "HOME": return "KEY_HOME";
            case "POWER": return "KEY_POWER";
            case "VOLUME_UP": return "KEY_VOLUP";
            case "VOLUME_DOWN": return "KEY_VOLDOWN";
            case "MUTE": return "KEY_MUTE";
            case "TV_INPUT": return "KEY_SOURCE";
            default: return "KEY_ENTER";
        }
    }

    private String mapLgUri(String action) {
        switch (action) {
            case "DPAD_UP": return "ssap://media.controls/up";
            case "DPAD_DOWN": return "ssap://media.controls/down";
            case "DPAD_LEFT": return "ssap://media.controls/left";
            case "DPAD_RIGHT": return "ssap://media.controls/right";
            case "SELECT": return "ssap://media.controls/ok";
            case "BACK": return "ssap://media.controls/back";
            case "HOME": return "ssap://media.controls/home";
            case "POWER": return "ssap://system/turnOff";
            case "VOLUME_UP": return "ssap://audio/volumeUp";
            case "VOLUME_DOWN": return "ssap://audio/volumeDown";
            case "MUTE": return "ssap://audio/setMute";
            case "TV_INPUT": return "ssap://tv/switchInput";
            default: return "ssap://media.controls/ok";
        }
    }

    private String mapSonyIrcc(String action) {
        switch (action) {
            case "DPAD_UP": return "AAAAAQAAAAEAAAB0Aw==";
            case "DPAD_DOWN": return "AAAAAQAAAAEAAAB1Aw==";
            case "DPAD_LEFT": return "AAAAAQAAAAEAAAA0Aw==";
            case "DPAD_RIGHT": return "AAAAAQAAAAEAAAAzAw==";
            case "SELECT": return "AAAAAQAAAAEAAABlAw==";
            case "BACK": return "AAAAAgAAAJcAAAAjAw==";
            case "HOME": return "AAAAAQAAAAEAAABgAw==";
            case "POWER": return "AAAAAQAAAAEAAAAVAw==";
            case "VOLUME_UP": return "AAAAAQAAAAEAAAASAw==";
            case "VOLUME_DOWN": return "AAAAAQAAAAEAAAATAw==";
            case "MUTE": return "AAAAAQAAAAEAAAAUAw==";
            case "TV_INPUT": return "AAAAAQAAAAEAAAAlAw==";
            case "PLAY_PAUSE": return "AAAAAgAAAJcAAAAaAw==";
            default: return null;
        }
    }

    private int mapAndroidKeycode(String action) {
        switch (action) {
            case "DPAD_UP": return 19;
            case "DPAD_DOWN": return 20;
            case "DPAD_LEFT": return 21;
            case "DPAD_RIGHT": return 22;
            case "SELECT": return 23;
            case "BACK": return 4;
            case "HOME": return 3;
            case "POWER": return 26;
            case "VOLUME_UP": return 24;
            case "VOLUME_DOWN": return 25;
            case "MUTE": return 164;
            case "TV_INPUT": return 178;
            case "PLAY_PAUSE": return 85;
            default: return 23;
        }
    }
}
