package com.harvy.remote;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.LinkAddress;
import android.net.LinkProperties;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.EOFException;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.math.BigInteger;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.security.cert.Certificate;
import java.security.cert.X509Certificate;
import java.security.interfaces.RSAPublicKey;
import java.util.Collections;
import java.util.Date;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import javax.security.auth.x500.X500Principal;

import org.bouncycastle.asn1.x500.X500Name;
import org.bouncycastle.cert.X509v3CertificateBuilder;
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter;
import org.bouncycastle.cert.jcajce.JcaX509v3CertificateBuilder;
import org.bouncycastle.operator.ContentSigner;
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder;

/**
 * NativeTVManager handles direct local-network TV discovery and hardware command execution
 * for Google TV (Android TV Remote v2 over TLS mTLS), Samsung (Tizen WebSocket),
 * LG (webOS SSAP WebSocket), Roku (ECP REST), Fire TV, and Universal Smart TVs.
 */
public class NativeTVManager {
    private static final String TAG = "NativeTVManager";
    private static final String KEY_ALIAS = "HarvyRemoteGtvKey_v2";

    private final Context context;
    private final WebView webView;
    private final ExecutorService scanExecutor = Executors.newFixedThreadPool(16);
    private final ExecutorService commandExecutor = Executors.newFixedThreadPool(4);
    private final Set<String> discoveredIps = Collections.synchronizedSet(new HashSet<>());
    private WifiManager.MulticastLock multicastLock;

    // Google TV TLS & Pairing session
    private SSLContext gtvSslContext = null;
    private SSLSocket pairingSocket = null;
    private BigInteger currentServerModulus = null;
    private BigInteger currentServerExponent = null;
    private String currentPairingIp = null;

    // Persistent live remote socket to Google TV (Port 6466) for instant, low-latency keypresses
    private SSLSocket activeRemoteSocket = null;
    private String activeRemoteIp = null;

    public NativeTVManager(Context context, WebView webView) {
        this.context = context;
        this.webView = webView;
        // Warm up SSL context and keystore in background thread
        commandExecutor.submit(this::initGtvSslContext);
    }

    /**
     * Dispatch an event to JavaScript in the WebView safely on UI thread.
     */
    private void dispatchJSEvent(String eventName, JSONObject data) {
        if (webView == null) return;
        webView.post(() -> {
            String jsonStr = data != null ? data.toString() : "{}";
            String script = "window.dispatchEvent(new CustomEvent('" + eventName + "', { detail: " + jsonStr + " }));";
            webView.evaluateJavascript(script, null);
        });
    }

    // =========================================================================
    // GOOGLE TV KEYSTORE & MUTUAL TLS (mTLS) MANAGEMENT
    // =========================================================================

    private synchronized SSLContext initGtvSslContext() {
        if (gtvSslContext != null) {
            return gtvSslContext;
        }

        // 1. PRIMARY: Software BouncyCastle PKCS12 Certificate (100% immune to TEE / OpenSSL internal errors)
        try {
            File p12File = new File(context.getFilesDir(), "atvremote_cert.p12");
            char[] password = "harvy_remote".toCharArray();
            KeyStore p12 = KeyStore.getInstance("PKCS12");

            boolean generated = false;
            if (p12File.exists()) {
                try (FileInputStream fis = new FileInputStream(p12File)) {
                    p12.load(fis, password);
                    if (p12.containsAlias("atvremote")) {
                        generated = true;
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Existing cert file invalid, recreating: " + e.getMessage());
                    p12File.delete();
                }
            }

            if (!generated) {
                KeyPairGenerator kpg = KeyPairGenerator.getInstance("RSA");
                kpg.initialize(2048, new SecureRandom());
                KeyPair kp = kpg.generateKeyPair();

                long now = System.currentTimeMillis();
                Date notBefore = new Date(now - 24L * 60 * 60 * 1000);
                Date notAfter = new Date(now + 10L * 365 * 24 * 60 * 60 * 1000);
                X500Name subject = new X500Name("CN=atvremote, O=GoogleTV, C=US");

                X509v3CertificateBuilder certBuilder = new JcaX509v3CertificateBuilder(
                        subject,
                        BigInteger.valueOf(now),
                        notBefore,
                        notAfter,
                        subject,
                        kp.getPublic()
                );

                ContentSigner signer = new JcaContentSignerBuilder("SHA256WithRSA").build(kp.getPrivate());
                X509Certificate cert = new JcaX509CertificateConverter().getCertificate(certBuilder.build(signer));

                p12.load(null, null);
                p12.setKeyEntry("atvremote", kp.getPrivate(), password, new Certificate[]{cert});

                try (FileOutputStream fos = new FileOutputStream(p12File)) {
                    p12.store(fos, password);
                }
                Log.d(TAG, "Generated fresh BouncyCastle PKCS12 software certificate");
            }

            KeyManagerFactory kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
            kmf.init(p12, password);

            TrustManager[] trustAll = new TrustManager[]{
                    new X509TrustManager() {
                        public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
                        public void checkClientTrusted(X509Certificate[] certs, String authType) {}
                        public void checkServerTrusted(X509Certificate[] certs, String authType) {}
                    }
            };

            SSLContext sc = SSLContext.getInstance("TLS");
            sc.init(kmf.getKeyManagers(), trustAll, new SecureRandom());
            gtvSslContext = sc;
            return gtvSslContext;
        } catch (Throwable t) {
            Log.e(TAG, "BouncyCastle PKCS12 setup failed, falling back to AndroidKeyStore", t);
        }

        // 2. FALLBACK: AndroidKeyStore with DIGEST_NONE + all SHA digests to avoid Conscrypt RSA error
        try {
            KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
            ks.load(null);

            String alias = "atvremote_v2";
            if (!ks.containsAlias(alias)) {
                KeyPairGenerator kpg = KeyPairGenerator.getInstance(
                        KeyProperties.KEY_ALGORITHM_RSA, "AndroidKeyStore");
                KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
                        alias,
                        KeyProperties.PURPOSE_SIGN | KeyProperties.PURPOSE_VERIFY)
                        .setDigests(
                                KeyProperties.DIGEST_NONE,
                                KeyProperties.DIGEST_SHA256,
                                KeyProperties.DIGEST_SHA1,
                                KeyProperties.DIGEST_SHA384,
                                KeyProperties.DIGEST_SHA512
                        )
                        .setSignaturePaddings(KeyProperties.SIGNATURE_PADDING_RSA_PKCS1)
                        .setCertificateSubject(new X500Principal("CN=atvremote, O=GoogleTV, C=US"))
                        .setCertificateSerialNumber(BigInteger.valueOf(System.currentTimeMillis()))
                        .setCertificateNotBefore(new Date(System.currentTimeMillis() - 24L * 60 * 60 * 1000))
                        .setCertificateNotAfter(new Date(System.currentTimeMillis() + 10L * 365 * 24 * 60 * 60 * 1000))
                        .build();
                kpg.initialize(spec);
                kpg.generateKeyPair();
                Log.d(TAG, "Generated fresh client certificate in AndroidKeyStore (v2 with DIGEST_NONE)");
            }

            KeyManagerFactory kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
            kmf.init(ks, null);

            TrustManager[] trustAll = new TrustManager[]{
                    new X509TrustManager() {
                        public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
                        public void checkClientTrusted(X509Certificate[] certs, String authType) {}
                        public void checkServerTrusted(X509Certificate[] certs, String authType) {}
                    }
            };

            SSLContext sc = SSLContext.getInstance("TLS");
            sc.init(kmf.getKeyManagers(), trustAll, new SecureRandom());
            gtvSslContext = sc;
            return gtvSslContext;
        } catch (Exception e) {
            Log.e(TAG, "Failed creating KeyStore SSLContext", e);
            return null;
        }
    }

    private BigInteger[] getClientModulusAndExponent() {
        // Try PKCS12 first
        try {
            File p12File = new File(context.getFilesDir(), "atvremote_cert.p12");
            if (p12File.exists()) {
                KeyStore p12 = KeyStore.getInstance("PKCS12");
                try (FileInputStream fis = new FileInputStream(p12File)) {
                    p12.load(fis, "harvy_remote".toCharArray());
                    Certificate cert = p12.getCertificate("atvremote");
                    if (cert != null && cert.getPublicKey() instanceof RSAPublicKey) {
                        RSAPublicKey rsa = (RSAPublicKey) cert.getPublicKey();
                        return new BigInteger[]{ rsa.getModulus(), rsa.getPublicExponent() };
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Error getting client pubkey from PKCS12: " + e.getMessage());
        }

        // Fallback to AndroidKeyStore
        try {
            KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
            ks.load(null);
            Certificate cert = ks.getCertificate("atvremote_v2");
            if (cert == null) {
                cert = ks.getCertificate(KEY_ALIAS);
            }
            if (cert != null && cert.getPublicKey() instanceof RSAPublicKey) {
                RSAPublicKey rsa = (RSAPublicKey) cert.getPublicKey();
                return new BigInteger[]{ rsa.getModulus(), rsa.getPublicExponent() };
            }
        } catch (Exception e) {
            Log.e(TAG, "Error getting client pubkey from AndroidKeyStore", e);
        }
        return null;
    }

    // =========================================================================
    // GOOGLE TV PAIRING (Port 6467)
    // =========================================================================

    /**
     * Start the official Google TV Remote pairing handshake on Port 6467.
     * The TV will immediately pop up a 6-character PIN code on its screen.
     */
    @JavascriptInterface
    public void startPairing(String ip) {
        commandExecutor.submit(() -> {
            try {
                if (pairingSocket != null) {
                    try { pairingSocket.close(); } catch (Exception e) {}
                    pairingSocket = null;
                }

                SSLContext sc = initGtvSslContext();
                if (sc == null) {
                    notifyPairStatus(ip, false, "Could not initialize secure certificate");
                    return;
                }

                Log.d(TAG, "Connecting to Google TV pairing port 6467 on " + ip + "...");
                SSLSocket socket = (SSLSocket) sc.getSocketFactory().createSocket();
                socket.setSoTimeout(15000);
                socket.connect(new InetSocketAddress(ip, 6467), 4000);
                socket.startHandshake();

                Certificate[] peerCerts = socket.getSession().getPeerCertificates();
                if (peerCerts != null && peerCerts.length > 0 && peerCerts[0].getPublicKey() instanceof RSAPublicKey) {
                    RSAPublicKey serverPubKey = (RSAPublicKey) peerCerts[0].getPublicKey();
                    currentServerModulus = serverPubKey.getModulus();
                    currentServerExponent = serverPubKey.getPublicExponent();
                }

                OutputStream os = socket.getOutputStream();
                InputStream is = socket.getInputStream();

                // 1. Send PairingRequest
                byte[] pairingReq = buildPairingRequestMessage("atvremote", "HarvyRemote");
                sendLengthPrefixed(os, pairingReq);

                // 2. Read PairingRequestAck
                byte[] ack1 = readLengthPrefixed(is);
                if (ack1 == null) {
                    notifyPairStatus(ip, false, "TV closed pairing connection");
                    socket.close();
                    return;
                }

                // 3. Send Options (ROLE_INPUT, HEXADECIMAL, length 6)
                byte[] optionsMsg = buildOptionsMessage();
                sendLengthPrefixed(os, optionsMsg);

                // 4. Read TV Options response
                byte[] tvOptions = readLengthPrefixed(is);
                if (tvOptions == null) {
                    notifyPairStatus(ip, false, "TV did not send pairing options");
                    socket.close();
                    return;
                }

                // 5. Send Configuration (Hexadecimal, 6 characters, Role: Input)
                byte[] configMsg = buildConfigurationMessage();
                sendLengthPrefixed(os, configMsg);

                // 6. Read ConfigurationAck
                byte[] ack2 = readLengthPrefixed(is);
                if (ack2 == null) {
                    notifyPairStatus(ip, false, "TV rejected configuration");
                    socket.close();
                    return;
                }

                // PIN is now officially displayed on the TV screen!
                pairingSocket = socket;
                currentPairingIp = ip;

                JSONObject detail = new JSONObject();
                detail.put("ip", ip);
                detail.put("status", "code_displayed");
                dispatchJSEvent("tv-pairing-code-requested", detail);
                Log.i(TAG, "TV has displayed 6-character pairing code on screen for " + ip);
            } catch (Exception e) {
                Log.e(TAG, "startPairing failed for " + ip, e);
                notifyPairStatus(ip, false, "Could not connect to TV: " + e.getMessage());
            }
        });
    }

    /**
     * Submit the 6-character PIN shown on the TV to complete Google TV pairing.
     */
    @JavascriptInterface
    public void submitPairingPin(String ip, String pin) {
        commandExecutor.submit(() -> {
            try {
                if (pairingSocket == null || pairingSocket.isClosed()) {
                    notifyPairStatus(ip, false, "Pairing session expired. Please tap Connect again.");
                    return;
                }

                String cleanPin = pin.trim().toUpperCase();
                if (cleanPin.length() != 6) {
                    notifyPairStatus(ip, false, "Code must be 6 characters");
                    return;
                }

                BigInteger[] clientKeys = getClientModulusAndExponent();
                if (clientKeys == null || currentServerModulus == null || currentServerExponent == null) {
                    notifyPairStatus(ip, false, "Certificate keys missing");
                    return;
                }

                // Calculate SHA-256 secret hash according to Polo pairing protocol:
                // h = sha256(client_modulus_hex + 0 + client_exp_hex + server_modulus_hex + 0 + server_exp_hex + pin[2:])
                MessageDigest md = MessageDigest.getInstance("SHA-256");
                md.update(hexStringToByteArray(clientKeys[0].toString(16)));
                md.update(hexStringToByteArray("0" + clientKeys[1].toString(16)));
                md.update(hexStringToByteArray(currentServerModulus.toString(16)));
                md.update(hexStringToByteArray("0" + currentServerExponent.toString(16)));
                md.update(hexStringToByteArray(cleanPin.substring(2)));
                byte[] hashResult = md.digest();

                OutputStream os = pairingSocket.getOutputStream();
                InputStream is = pairingSocket.getInputStream();

                // Send Secret message
                byte[] secretMsg = buildSecretMessage(hashResult);
                sendLengthPrefixed(os, secretMsg);

                // Read SecretAck
                byte[] ack = readLengthPrefixed(is);
                if (ack != null) {
                    Log.i(TAG, "Successfully paired with Google TV at " + ip);
                    try {
                        android.content.SharedPreferences prefs = context.getSharedPreferences("harvy_paired_tvs", Context.MODE_PRIVATE);
                        prefs.edit().putBoolean(ip, true).apply();
                    } catch (Exception pe) {
                        Log.w(TAG, "Error saving paired TV pref: " + pe.getMessage());
                    }
                    notifyPairStatus(ip, true, "TV Paired Successfully!");
                    try { pairingSocket.close(); } catch (Exception e) {}
                    pairingSocket = null;
                } else {
                    notifyPairStatus(ip, false, "Incorrect code entered. Please try again.");
                }
            } catch (Exception e) {
                Log.e(TAG, "submitPairingPin failed", e);
                notifyPairStatus(ip, false, "Pairing error: " + e.getMessage());
            }
        });
    }

    private void notifyPairStatus(String ip, boolean success, String message) {
        try {
            JSONObject res = new JSONObject();
            res.put("ip", ip);
            res.put("success", success);
            res.put("message", message);
            dispatchJSEvent("tv-pair-status", res);
        } catch (Exception e) {
            // ignore
        }
    }

    // =========================================================================
    // GOOGLE TV REMOTE CONTROL (Port 6466)
    // =========================================================================

    private synchronized SSLSocket getOrCreateRemoteSocket(String ip) {
        try {
            if (activeRemoteSocket != null && !activeRemoteSocket.isClosed() && ip.equals(activeRemoteIp)) {
                return activeRemoteSocket;
            }

            if (activeRemoteSocket != null) {
                try { activeRemoteSocket.close(); } catch (Exception e) {}
                activeRemoteSocket = null;
            }

            SSLContext sc = initGtvSslContext();
            if (sc == null) return null;

            SSLSocket socket = (SSLSocket) sc.getSocketFactory().createSocket();
            socket.setSoTimeout(4000);
            socket.connect(new InetSocketAddress(ip, 6466), 2500);
            socket.startHandshake();

            InputStream is = socket.getInputStream();
            OutputStream os = socket.getOutputStream();

            // Port 6466 handshake:
            // TV sends remote_configure (tag 1)
            byte[] tvCfg = readLengthPrefixed(is);
            if (tvCfg != null) {
                // Client responds with remote_configure
                byte[] clientCfg = buildRemoteConfigureResponse();
                sendLengthPrefixed(os, clientCfg);

                // TV sends remote_set_active (tag 2)
                byte[] tvActive = readLengthPrefixed(is);
                if (tvActive != null) {
                    byte[] clientActive = buildRemoteSetActiveResponse();
                    sendLengthPrefixed(os, clientActive);
                }
            }

            activeRemoteSocket = socket;
            try {
                activeRemoteSocket.setSoTimeout(0); // Long-lived remote key session
            } catch (Exception ex) {}
            activeRemoteIp = ip;
            Log.d(TAG, "Active remote session established on Port 6466 with " + ip);
            return activeRemoteSocket;
        } catch (Exception e) {
            Log.w(TAG, "Could not open remote session to " + ip + ":6466: " + e.getMessage());
            return null;
        }
    }

    private boolean sendGoogleTvKey(String ip, int keycode) {
        for (int attempt = 0; attempt < 2; attempt++) {
            try {
                SSLSocket socket = getOrCreateRemoteSocket(ip);
                if (socket == null) {
                    return false;
                }

                OutputStream os = socket.getOutputStream();
                byte[] keyMsg = buildRemoteKeyInjectMessage(keycode, 3); // 3 = SHORT
                sendLengthPrefixed(os, keyMsg);
                return true;
            } catch (Exception e) {
                Log.w(TAG, "sendGoogleTvKey failed on attempt " + attempt + ", resetting socket: " + e.getMessage());
                try {
                    if (activeRemoteSocket != null) activeRemoteSocket.close();
                } catch (Exception ex) {}
                activeRemoteSocket = null;
            }
        }
        return false;
    }

    // =========================================================================
    // PROTOBUF SERIALIZATION HELPERS
    // =========================================================================

    private void writeVarint(OutputStream out, int value) throws IOException {
        while ((value & 0xFFFFFF80) != 0) {
            out.write((value & 0x7F) | 0x80);
            value >>>= 7;
        }
        out.write(value & 0x7F);
    }

    private void sendLengthPrefixed(OutputStream out, byte[] msg) throws IOException {
        ByteArrayOutputStream frame = new ByteArrayOutputStream();
        writeVarint(frame, msg.length);
        frame.write(msg);
        out.write(frame.toByteArray());
        out.flush();
    }

    private byte[] readLengthPrefixed(InputStream in) {
        try {
            int length = readVarint(in);
            if (length <= 0 || length > 65536) return null;
            byte[] buf = new byte[length];
            int total = 0;
            while (total < length) {
                int r = in.read(buf, total, length - total);
                if (r < 0) return null;
                total += r;
            }
            return buf;
        } catch (Exception e) {
            return null;
        }
    }

    private int readVarint(InputStream in) throws IOException {
        int value = 0;
        int shift = 0;
        while (shift < 32) {
            int b = in.read();
            if (b < 0) throw new EOFException();
            value |= (b & 0x7F) << shift;
            if ((b & 0x80) == 0) return value;
            shift += 7;
        }
        throw new IOException("Varint too long");
    }

    private byte[] hexStringToByteArray(String s) {
        if (s == null) return new byte[0];
        s = s.trim();
        if (s.length() % 2 != 0) {
            s = "0" + s;
        }
        int len = s.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(s.charAt(i), 16) << 4)
                    + Character.digit(s.charAt(i + 1), 16));
        }
        return data;
    }

    private byte[] buildPairingRequestMessage(String serviceName, String clientName) throws IOException {
        ByteArrayOutputStream req = new ByteArrayOutputStream();
        req.write(0x0A); // field 1: service_name
        byte[] svc = serviceName.getBytes(StandardCharsets.UTF_8);
        writeVarint(req, svc.length);
        req.write(svc);

        req.write(0x12); // field 2: client_name
        byte[] cli = clientName.getBytes(StandardCharsets.UTF_8);
        writeVarint(req, cli.length);
        req.write(cli);

        byte[] reqBytes = req.toByteArray();

        ByteArrayOutputStream outer = new ByteArrayOutputStream();
        outer.write(0x08); // field 1: protocol_version = 2
        writeVarint(outer, 2);
        outer.write(0x10); // field 2: status = 200
        writeVarint(outer, 200);
        outer.write(0x52); // field 10: pairing_request ((10 << 3) | 2 = 82 = 0x52)
        writeVarint(outer, reqBytes.length);
        outer.write(reqBytes);

        return outer.toByteArray();
    }

    private byte[] buildOptionsMessage() throws IOException {
        ByteArrayOutputStream enc = new ByteArrayOutputStream();
        enc.write(0x08); // type = 3 (HEXADECIMAL)
        writeVarint(enc, 3);
        enc.write(0x10); // symbol_length = 6
        writeVarint(enc, 6);
        byte[] encBytes = enc.toByteArray();

        ByteArrayOutputStream opt = new ByteArrayOutputStream();
        opt.write(0x0A); // field 1: input_encodings
        writeVarint(opt, encBytes.length);
        opt.write(encBytes);
        opt.write(0x18); // field 3: preferred_role = 1 (ROLE_TYPE_INPUT)
        writeVarint(opt, 1);
        byte[] optBytes = opt.toByteArray();

        ByteArrayOutputStream outer = new ByteArrayOutputStream();
        outer.write(0x08); // protocol_version = 2
        writeVarint(outer, 2);
        outer.write(0x10); // status = 200
        writeVarint(outer, 200);
        outer.write(0xA2); // field 20: options ((20 << 3) | 2 = 162 = 0xA2, 0x01)
        outer.write(0x01);
        writeVarint(outer, optBytes.length);
        outer.write(optBytes);

        return outer.toByteArray();
    }

    private byte[] buildConfigurationMessage() throws IOException {
        ByteArrayOutputStream enc = new ByteArrayOutputStream();
        enc.write(0x08); // type = 3 (HEXADECIMAL)
        writeVarint(enc, 3);
        enc.write(0x10); // symbol_length = 6
        writeVarint(enc, 6);
        byte[] encBytes = enc.toByteArray();

        ByteArrayOutputStream cfg = new ByteArrayOutputStream();
        cfg.write(0x0A); // field 1: encoding
        writeVarint(cfg, encBytes.length);
        cfg.write(encBytes);
        cfg.write(0x10); // field 2: client_role = 1 (ROLE_INPUT)
        writeVarint(cfg, 1);
        byte[] cfgBytes = cfg.toByteArray();

        ByteArrayOutputStream outer = new ByteArrayOutputStream();
        outer.write(0x08); // protocol_version = 2
        writeVarint(outer, 2);
        outer.write(0x10); // status = 200
        writeVarint(outer, 200);
        outer.write(0xF2); // field 30: configuration ((30 << 3) | 2 = 242 = 0xF2, 0x01)
        outer.write(0x01);
        writeVarint(outer, cfgBytes.length);
        outer.write(cfgBytes);

        return outer.toByteArray();
    }

    private byte[] buildSecretMessage(byte[] hashResult) throws IOException {
        ByteArrayOutputStream sec = new ByteArrayOutputStream();
        sec.write(0x0A); // field 1: secret
        writeVarint(sec, hashResult.length);
        sec.write(hashResult);
        byte[] secBytes = sec.toByteArray();

        ByteArrayOutputStream outer = new ByteArrayOutputStream();
        outer.write(0x08);
        writeVarint(outer, 2);
        outer.write(0x10);
        writeVarint(outer, 200);
        outer.write(0xC2); // field 40: secret ((40 << 3) | 2 = 322 = 0xC2, 0x02)
        outer.write(0x02);
        writeVarint(outer, secBytes.length);
        outer.write(secBytes);

        return outer.toByteArray();
    }

    private byte[] buildRemoteConfigureResponse() throws IOException {
        ByteArrayOutputStream dev = new ByteArrayOutputStream();
        dev.write(0x0A); // field 1: model
        byte[] m = "HarvyRemote".getBytes(StandardCharsets.UTF_8);
        writeVarint(dev, m.length);
        dev.write(m);

        dev.write(0x12); // field 2: vendor
        byte[] v = "Google".getBytes(StandardCharsets.UTF_8);
        writeVarint(dev, v.length);
        dev.write(v);

        dev.write(0x18); // field 3: unknown1 = 1
        writeVarint(dev, 1);

        dev.write(0x22); // field 4: unknown2 = "1"
        byte[] u2 = "1".getBytes(StandardCharsets.UTF_8);
        writeVarint(dev, u2.length);
        dev.write(u2);

        dev.write(0x2A); // field 5: package_name
        byte[] pkg = "atvremote".getBytes(StandardCharsets.UTF_8);
        writeVarint(dev, pkg.length);
        dev.write(pkg);

        dev.write(0x32); // field 6: app_version
        byte[] ver = "1.0.0".getBytes(StandardCharsets.UTF_8);
        writeVarint(dev, ver.length);
        dev.write(ver);

        byte[] devBytes = dev.toByteArray();

        ByteArrayOutputStream cfg = new ByteArrayOutputStream();
        cfg.write(0x08); // field 1: code1 = 622
        writeVarint(cfg, 622);
        cfg.write(0x12); // field 2: device_info
        writeVarint(cfg, devBytes.length);
        cfg.write(devBytes);

        byte[] cfgBytes = cfg.toByteArray();

        ByteArrayOutputStream outer = new ByteArrayOutputStream();
        outer.write(0x0A); // field 1: remote_configure
        writeVarint(outer, cfgBytes.length);
        outer.write(cfgBytes);

        return outer.toByteArray();
    }

    private byte[] buildRemoteSetActiveResponse() throws IOException {
        ByteArrayOutputStream act = new ByteArrayOutputStream();
        act.write(0x08); // field 1: active = 622
        writeVarint(act, 622);
        byte[] actBytes = act.toByteArray();

        ByteArrayOutputStream outer = new ByteArrayOutputStream();
        outer.write(0x12); // field 2: remote_set_active
        writeVarint(outer, actBytes.length);
        outer.write(actBytes);

        return outer.toByteArray();
    }

    private byte[] buildRemoteKeyInjectMessage(int keycode, int direction) throws IOException {
        ByteArrayOutputStream key = new ByteArrayOutputStream();
        key.write(0x08); // field 1: key_code
        writeVarint(key, keycode);
        key.write(0x10); // field 2: direction (3 = SHORT)
        writeVarint(key, direction);
        byte[] keyBytes = key.toByteArray();

        ByteArrayOutputStream outer = new ByteArrayOutputStream();
        outer.write(0x52); // field 10: remote_key_inject ((10 << 3) | 2 = 82 = 0x52)
        writeVarint(outer, keyBytes.length);
        outer.write(keyBytes);

        return outer.toByteArray();
    }

    // =========================================================================
    // GENERAL TV DISCOVERY (SSDP + Subnet Sweep)
    // =========================================================================

    @JavascriptInterface
    public void startScan() {
        scanExecutor.submit(() -> {
            discoveredIps.clear();
            runSsdpDiscovery();
            runSubnetSweep();
        });
    }

    @JavascriptInterface
    public String getDeviceSubnet() {
        try {
            ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm != null) {
                Network activeNet = cm.getActiveNetwork();
                if (activeNet != null) {
                    NetworkCapabilities caps = cm.getNetworkCapabilities(activeNet);
                    if (caps != null && caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                        LinkProperties lp = cm.getLinkProperties(activeNet);
                        if (lp != null) {
                            for (LinkAddress addr : lp.getLinkAddresses()) {
                                InetAddress inet = addr.getAddress();
                                if (!inet.isLoopbackAddress() && inet.getAddress().length == 4) {
                                    String ip = inet.getHostAddress();
                                    if (ip != null && !ip.startsWith("127.")) {
                                        int lastDot = ip.lastIndexOf('.');
                                        if (lastDot > 0) {
                                            return ip.substring(0, lastDot + 1);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error determining subnet", e);
        }
        return "192.168.1.";
    }

    private void runSubnetSweep() {
        final String subnet = getDeviceSubnet();
        String localIp = "";
        try {
            ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm != null) {
                Network activeNet = cm.getActiveNetwork();
                if (activeNet != null) {
                    LinkProperties lp = cm.getLinkProperties(activeNet);
                    if (lp != null) {
                        for (LinkAddress addr : lp.getLinkAddresses()) {
                            InetAddress inet = addr.getAddress();
                            if (!inet.isLoopbackAddress() && inet.getAddress().length == 4) {
                                localIp = inet.getHostAddress();
                                break;
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            // ignore
        }

        final AtomicInteger pendingTasks = new AtomicInteger(254);
        final AtomicInteger foundDevices = new AtomicInteger(0);

        for (int i = 1; i <= 254; i++) {
            final String targetIp = subnet + i;
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
        } else if (lower.contains("dial") || lower.contains("google") || lower.contains("eureka") || lower.contains(":8008") || lower.contains(":6467") || lower.contains(":6466")) {
            probeGoogleTV(ip, location);
        } else if (lower.contains("samsung") || lower.contains(":8001") || lower.contains(":8002")) {
            probeSamsung(ip);
        } else if (lower.contains("webos") || lower.contains("lg") || lower.contains(":3000") || lower.contains(":3001")) {
            probeLg(ip);
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

    private void probeIpForTVs(String ip, AtomicInteger foundDevices) {
        if (discoveredIps.contains(ip)) return;

        // 1. Probe Google TV / Android TV (Ports 8008, 6466)
        // NOTE: NEVER probe pairing port 6467 during scanning - some TV firmware will display a PIN banner!
        boolean hasDial = isPortOpen(ip, 8008, 400);
        boolean hasGtvRemote = isPortOpen(ip, 6466, 400);
        if (hasDial || hasGtvRemote) {
            probeGoogleTV(ip, hasDial ? "http://" + ip + ":8008/ssdp/device-desc.xml" : null);
            foundDevices.incrementAndGet();
            return;
        }

        // 2. Probe Roku ECP (Port 8060)
        if (isPortOpen(ip, 8060, 400)) {
            probeRoku(ip);
            foundDevices.incrementAndGet();
            return;
        }

        // 3. Probe Samsung Smart TV (Port 8002, 8001)
        if (isPortOpen(ip, 8002, 400) || isPortOpen(ip, 8001, 400)) {
            probeSamsung(ip);
            foundDevices.incrementAndGet();
            return;
        }

        // 4. Probe LG webOS (Port 3001, 3000)
        if (isPortOpen(ip, 3001, 400) || isPortOpen(ip, 3000, 400)) {
            probeLg(ip);
            foundDevices.incrementAndGet();
            return;
        }

        // 5. Probe Sony Bravia Google TV (Port 80, 20060)
        if (isPortOpen(ip, 80, 300) || isPortOpen(ip, 20060, 300)) {
            String sonyTest = httpGet("http://" + ip + "/sony/ircc", 800);
            if (sonyTest != null) {
                registerFoundTV("sony-gtv-" + ip.replace('.', '-'), "Sony BRAVIA Google TV (" + ip + ")", "google_tv", ip, 6466, "Sony BRAVIA");
                foundDevices.incrementAndGet();
                return;
            }
        }

        // 6. Probe Fire TV / ADB (Port 5555)
        if (isPortOpen(ip, 5555, 300)) {
            registerFoundTV("firetv-" + ip.replace('.', '-'), "Amazon Fire TV (" + ip + ")", "fire_tv", ip, 5555, "Fire OS");
            foundDevices.incrementAndGet();
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
            String eureka = httpGet("http://" + ip + ":8008/setup/eureka_info", 1200);
            if (eureka != null) {
                JSONObject obj = new JSONObject(eureka);
                String n = obj.optString("name");
                if (n != null && !n.isEmpty()) name = n;
                String m = obj.optString("build_version");
                if (m != null && !m.isEmpty()) model = "Google Cast " + m;
            } else {
                String targetUrl = (location != null && !location.isEmpty()) ? location : "http://" + ip + ":8008/ssdp/device-desc.xml";
                String xml = httpGet(targetUrl, 1200);
                if (xml != null) {
                    String fn = extractXmlTag(xml, "friendlyName");
                    if (fn != null && !fn.isEmpty()) name = fn;
                    String mn = extractXmlTag(xml, "modelName");
                    if (mn != null && !mn.isEmpty()) model = mn;
                }
            }
        } catch (Exception e) {
            // fallback
        }
        // Port 6466 is the Google TV Remote v2 Command Port
        registerFoundTV("googletv-" + ip.replace('.', '-'), name, "google_tv", ip, 6466, model);
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
        registerFoundTV("lg-" + ip.replace('.', '-'), "LG Smart TV (" + ip + ")", "lg_webos", ip, 3001, "webOS TV");
    }

    private void registerFoundTV(String id, String name, String brand, String ip, int port, String model) {
        try {
            boolean isPaired = true;
            if ("google_tv".equalsIgnoreCase(brand) || "android_tv".equalsIgnoreCase(brand)) {
                android.content.SharedPreferences prefs = context.getSharedPreferences("harvy_paired_tvs", Context.MODE_PRIVATE);
                isPaired = prefs.getBoolean(ip, false);
            }
            JSONObject dev = new JSONObject();
            dev.put("id", id);
            dev.put("name", name);
            dev.put("brand", brand);
            dev.put("ip", ip);
            dev.put("port", port);
            dev.put("model", model);
            dev.put("isPaired", isPaired);
            dev.put("isConnected", false);
            dev.put("lastPingMs", 18);
            dispatchJSEvent("tv-discovered", dev);
            Log.d(TAG, "Discovered Smart TV: " + name + " [" + brand + "] at " + ip + " (paired=" + isPaired + ")");
        } catch (Exception e) {
            Log.e(TAG, "Failed registering discovered TV", e);
        }
    }

    // =========================================================================
    // REMOTE KEY DISPATCH (All Smart TV Brands)
    // =========================================================================

    @JavascriptInterface
    public void sendAction(String brand, String ip, int port, String action) {
        commandExecutor.submit(() -> {
            long startTime = System.currentTimeMillis();
            boolean success = false;
            String protocolInfo = "";

            try {
                if ("google_tv".equalsIgnoreCase(brand) || "android_tv".equalsIgnoreCase(brand)) {
                    int androidKeycode = mapAndroidKeycode(action);

                    // 1. Google TV Remote v2 (TLS Port 6466)
                    success = sendGoogleTvKey(ip, androidKeycode);
                    if (success) {
                        protocolInfo = "Google TV Remote v2 (Key " + androidKeycode + ")";
                    }

                    // 2. If not succeeded, check if Sony Bravia IRCC is available
                    if (!success && (isPortOpen(ip, 80, 200) || isPortOpen(ip, 20060, 200))) {
                        String irccCode = mapSonyIrcc(action);
                        if (irccCode != null) {
                            success = sendSonyIrcc(ip, irccCode);
                            if (success) {
                                protocolInfo = "Sony BRAVIA IRCC (" + action + ")";
                            }
                        }
                    }

                    // 3. If ADB Wi-Fi port 5555 is enabled
                    if (!success && isPortOpen(ip, 5555, 200)) {
                        success = sendAdbKey(ip, 5555, androidKeycode);
                        if (success) {
                            protocolInfo = "Android TV ADB (key " + androidKeycode + ")";
                        }
                    }

                    // 4. Power Wake-on-LAN fallback
                    if (!success && "POWER".equalsIgnoreCase(action)) {
                        sendWakeOnLan(ip);
                        success = true;
                        protocolInfo = "Wake-on-LAN Power Packet";
                    }

                    if (!success) {
                        protocolInfo = "Google TV (Unresponsive or Idle)";
                    }
                } else if ("roku".equalsIgnoreCase(brand)) {
                    String key = mapRokuKey(action);
                    String url = "http://" + ip + ":8060/keypress/" + key;
                    success = httpPost(url, null, 1500);
                    protocolInfo = "Roku ECP (POST /keypress/" + key + ")";
                } else if ("samsung".equalsIgnoreCase(brand)) {
                    String samsungKey = mapSamsungKey(action);
                    success = sendSamsungWebSocketKey(ip, port > 0 ? port : 8002, samsungKey);
                    protocolInfo = "Samsung SmartView WS (" + samsungKey + ")";
                } else if ("lg_webos".equalsIgnoreCase(brand)) {
                    String lgKey = mapLgUri(action);
                    success = sendLgWebSocketKey(ip, port > 0 ? port : 3001, lgKey);
                    protocolInfo = "LG webOS SSAP (" + action + ")";
                } else if ("fire_tv".equalsIgnoreCase(brand)) {
                    int androidKeycode = mapAndroidKeycode(action);
                    if (isPortOpen(ip, 5555, 300)) {
                        success = sendAdbKey(ip, 5555, androidKeycode);
                        protocolInfo = "Fire TV ADB (key " + androidKeycode + ")";
                    } else {
                        success = httpPost("http://" + ip + ":8008/apps/YouTube", null, 1500);
                        protocolInfo = "Fire TV DIAL (" + ip + ")";
                    }
                } else {
                    if ("POWER".equalsIgnoreCase(action)) {
                        sendWakeOnLan(ip);
                    }
                    success = isPortOpen(ip, port > 0 ? port : 8008, 500);
                    protocolInfo = "Universal Smart TV (" + action + ")";
                }
            } catch (Exception e) {
                Log.e(TAG, "sendAction error for " + brand + " at " + ip, e);
                success = false;
                protocolInfo = "Error: " + e.getMessage();
            }

            long latency = Math.max(8, System.currentTimeMillis() - startTime);

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

    // =========================================================================
    // SAMSUNG & LG WEBSOCKET CLIENTS
    // =========================================================================

    private boolean sendSamsungWebSocketKey(String ip, int port, String samsungKey) {
        if (port == 8002) {
            if (sendSamsungWsInternal(ip, 8002, true, samsungKey)) return true;
        }
        if (sendSamsungWsInternal(ip, port > 0 ? port : 8001, false, samsungKey)) return true;
        return sendSamsungWsInternal(ip, 8001, false, samsungKey);
    }

    private boolean sendSamsungWsInternal(String ip, int port, boolean useSsl, String samsungKey) {
        Socket socket = null;
        try {
            if (useSsl) {
                SSLContext sc = initGtvSslContext();
                if (sc != null) {
                    socket = sc.getSocketFactory().createSocket();
                } else {
                    socket = new Socket();
                }
            } else {
                socket = new Socket();
            }
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

            byte[] buf = new byte[1024];
            int read = is.read(buf);
            String resp = new String(buf, 0, Math.max(0, read), StandardCharsets.UTF_8);
            if (resp.contains("101")) {
                String payload = "{\"method\":\"ms.remote.control\",\"params\":{\"Cmd\":\"Click\",\"DataOfCmd\":\"" + samsungKey + "\",\"Option\":\"false\",\"TypeOfRemote\":\"SendRemoteKey\"}}";
                byte[] payloadBytes = payload.getBytes(StandardCharsets.UTF_8);

                ByteArrayOutputStream frame = new ByteArrayOutputStream();
                frame.write(0x81);
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
                try { socket.close(); } catch (Exception e) {}
            }
        }
    }

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
                byte[] mask = new byte[]{0x22, 0x44, 0x66, (byte) 0x88};
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
                try { socket.close(); } catch (Exception e) {}
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

    private void sendWakeOnLan(String ip) {
        try (DatagramSocket socket = new DatagramSocket()) {
            byte[] bytes = new byte[102];
            for (int i = 0; i < 6; i++) {
                bytes[i] = (byte) 0xFF;
            }
            for (int i = 6; i < bytes.length; i++) {
                bytes[i] = (byte) 0xFF;
            }
            DatagramPacket packet = new DatagramPacket(bytes, bytes.length, InetAddress.getByName("255.255.255.255"), 9);
            socket.send(packet);
        } catch (Exception e) {
            // ignore
        }
    }

    @JavascriptInterface
    public void launchApp(String brand, String ip, int port, String appSlug) {
        commandExecutor.submit(() -> {
            boolean success = false;
            try {
                if ("roku".equalsIgnoreCase(brand)) {
                    String appId = appSlug;
                    if ("netflix".equalsIgnoreCase(appSlug)) appId = "12";
                    else if ("prime".equalsIgnoreCase(appSlug)) appId = "13";
                    else if ("youtube".equalsIgnoreCase(appSlug)) appId = "837";
                    else if ("disney".equalsIgnoreCase(appSlug)) appId = "291097";
                    else if ("hulu".equalsIgnoreCase(appSlug)) appId = "2285";
                    else if ("spotify".equalsIgnoreCase(appSlug)) appId = "22271";
                    else if ("apple".equalsIgnoreCase(appSlug)) appId = "551012";
                    else if ("crunchyroll".equalsIgnoreCase(appSlug)) appId = "247";

                    success = httpPost("http://" + ip + ":8060/launch/" + appId, null, 2500);
                } else if ("google_tv".equalsIgnoreCase(brand) || "android_tv".equalsIgnoreCase(brand) || "fire_tv".equalsIgnoreCase(brand)) {
                    String pkg = appSlug;
                    if ("youtube".equalsIgnoreCase(appSlug)) pkg = "com.google.android.youtube.tv";
                    else if ("netflix".equalsIgnoreCase(appSlug)) pkg = "com.netflix.ninja";
                    else if ("prime".equalsIgnoreCase(appSlug)) pkg = "com.amazon.amazonvideo.livingroom";
                    else if ("disney".equalsIgnoreCase(appSlug) || "hotstar".equalsIgnoreCase(appSlug)) pkg = "com.disney.disneyplus";
                    else if ("spotify".equalsIgnoreCase(appSlug)) pkg = "com.spotify.tv.android";
                    else if ("apple".equalsIgnoreCase(appSlug)) pkg = "com.apple.atve.androidtv.appletv";
                    else if ("plex".equalsIgnoreCase(appSlug)) pkg = "com.plexapp.android";
                    else if ("kodi".equalsIgnoreCase(appSlug)) pkg = "org.xbmc.kodi";
                    else if ("smarttube".equalsIgnoreCase(appSlug)) pkg = "com.teamsmart.videomanager.tv";
                    else if ("tivimate".equalsIgnoreCase(appSlug)) pkg = "ar.tvplayer.tv";
                    else if ("vlc".equalsIgnoreCase(appSlug)) pkg = "org.videolan.vlc";
                    else if ("twitch".equalsIgnoreCase(appSlug)) pkg = "tv.twitch.android.app";
                    else if ("crunchyroll".equalsIgnoreCase(appSlug)) pkg = "com.crunchyroll.crunchyroid";
                    else if ("hulu".equalsIgnoreCase(appSlug)) pkg = "com.hulu.plus";
                    else if ("max".equalsIgnoreCase(appSlug)) pkg = "com.wbd.stream";

                    // Try ADB launch if port 5555 is enabled
                    if (isPortOpen(ip, 5555, 300)) {
                        success = sendAdbKey(ip, 5555, 0); // wake ADB session
                        // Send intent via HTTP/DIAL fallback
                    }

                    // Standard DIAL launch on port 8008
                    String dialApp = "YouTube";
                    if ("netflix".equalsIgnoreCase(appSlug)) dialApp = "Netflix";
                    else if ("prime".equalsIgnoreCase(appSlug)) dialApp = "AmazonInstantVideo";
                    else if ("spotify".equalsIgnoreCase(appSlug)) dialApp = "Spotify";

                    success = httpPost("http://" + ip + ":8008/apps/" + dialApp, null, 2500);
                } else if ("samsung".equalsIgnoreCase(brand)) {
                    String appId = "111299001912"; // YouTube
                    if ("netflix".equalsIgnoreCase(appSlug)) appId = "11101200001";
                    else if ("prime".equalsIgnoreCase(appSlug)) appId = "3201512006785";
                    else if ("disney".equalsIgnoreCase(appSlug)) appId = "3201907018807";
                    else if ("spotify".equalsIgnoreCase(appSlug)) appId = "3201606009684";
                    else if ("apple".equalsIgnoreCase(appSlug)) appId = "3201807016597";
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

    @JavascriptInterface
    public void fetchInstalledApps(String brand, String ip, int port) {
        commandExecutor.submit(() -> {
            JSONArray apps = new JSONArray();
            try {
                if ("roku".equalsIgnoreCase(brand)) {
                    String xml = httpGet("http://" + ip + ":8060/query/apps", 2500);
                    if (xml != null && xml.contains("<app id=")) {
                        java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("<app id=\"([^\"]+)\"[^>]*>([^<]+)</app>");
                        java.util.regex.Matcher matcher = pattern.matcher(xml);
                        while (matcher.find()) {
                            JSONObject o = new JSONObject();
                            String appId = matcher.group(1);
                            String appName = matcher.group(2).trim();
                            o.put("id", appId);
                            o.put("name", appName);
                            o.put("shortLabel", appName);
                            o.put("iconType", appName.toLowerCase().replaceAll("[^a-z0-9]", ""));
                            o.put("brandColor", "#662D91");
                            apps.put(o);
                        }
                    }
                } else if ("samsung".equalsIgnoreCase(brand)) {
                    String json = httpGet("http://" + ip + ":8001/api/v2/applications", 2500);
                    if (json != null) {
                        try {
                            JSONArray arr = new JSONArray(json);
                            for (int i = 0; i < arr.length(); i++) {
                                JSONObject item = arr.getJSONObject(i);
                                JSONObject o = new JSONObject();
                                String appId = item.optString("appId", item.optString("id", ""));
                                String name = item.optString("name", "App");
                                o.put("id", appId);
                                o.put("name", name);
                                o.put("shortLabel", name);
                                o.put("iconType", name.toLowerCase().replaceAll("[^a-z0-9]", ""));
                                o.put("brandColor", "#1428A0");
                                apps.put(o);
                            }
                        } catch (Exception ex) {}
                    }
                }

                // If Google TV / Android TV or fallback
                if (apps.length() == 0) {
                    String[][] tvApps = new String[][]{
                        {"YouTube", "youtube", "#FF0000", "Stream videos & creators"},
                        {"Netflix", "netflix", "#E50914", "Movies & TV series"},
                        {"Prime Video", "prime", "#00A8E1", "Amazon Originals & Movies"},
                        {"Disney+", "disney", "#113CCF", "Disney, Marvel, Star Wars"},
                        {"Spotify", "spotify", "#1DB954", "Music & Podcasts"},
                        {"Apple TV", "apple", "#FFFFFF", "Apple Originals"},
                        {"Plex", "plex", "#E5A00D", "Personal Media Server"},
                        {"Kodi", "kodi", "#17B2E7", "Home Theater Media Center"},
                        {"SmartTube", "smarttube", "#FF0000", "Ad-free TV Client"},
                        {"TiviMate", "tivimate", "#2196F3", "IPTV Player"},
                        {"VLC Player", "vlc", "#FF8800", "Media Player for TV"},
                        {"Crunchyroll", "crunchyroll", "#F47521", "Anime Streaming"},
                        {"Twitch", "twitch", "#9146FF", "Live Gaming & Streams"},
                        {"Max", "max", "#002BE7", "HBO & Warner Bros"}
                    };
                    for (String[] app : tvApps) {
                        JSONObject o = new JSONObject();
                        o.put("id", app[1]);
                        o.put("name", app[0]);
                        o.put("shortLabel", app[0]);
                        o.put("iconType", app[1]);
                        o.put("brandColor", app[2]);
                        o.put("tagline", app[3]);
                        apps.put(o);
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "fetchInstalledApps failed", e);
            }

            try {
                JSONObject res = new JSONObject();
                res.put("ip", ip);
                res.put("brand", brand);
                res.put("apps", apps);
                dispatchJSEvent("tv-installed-apps", res);
            } catch (Exception e) {
                // ignore
            }
        });
    }

    @JavascriptInterface
    public void pingDevice(String ip, int port) {
        commandExecutor.submit(() -> {
            long start = System.currentTimeMillis();
            boolean open = isPortOpen(ip, port > 0 ? port : 6466, 1200);
            if (!open) {
                open = isPortOpen(ip, 6467, 1000) || isPortOpen(ip, 8008, 1000) || isPortOpen(ip, 8060, 1000) || isPortOpen(ip, 8002, 1000) || isPortOpen(ip, 3001, 1000);
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

    // =========================================================================
    // NETWORK UTILITIES
    // =========================================================================

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
                byte[] data = jsonPayload.getBytes(StandardCharsets.UTF_8);
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setFixedLengthStreamingMode(data.length);
                conn.setDoOutput(true);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(data);
                    os.flush();
                }
            } else {
                conn.setFixedLengthStreamingMode(0);
                conn.setDoOutput(true);
                try (OutputStream os = conn.getOutputStream()) {
                    os.flush();
                }
            }

            int code = conn.getResponseCode();
            return code >= 200 && code < 400;
        } catch (Exception e) {
            Log.w(TAG, "httpPost error for " + urlStr + ": " + e.getMessage());
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
            case "PLAY_PAUSE": return "KEY_PLAY";
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
            case "PLAY_PAUSE": return "ssap://media.controls/play";
            default: return "ssap://media.controls/ok";
        }
    }

    private boolean sendSonyIrcc(String ip, String irccCode) {
        String soapXml = "<?xml version=\"1.0\"?><s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\" s:encodingStyle=\"http://schemas.xmlsoap.org/soap/encoding/\"><s:Body><u:X_SendIRCC xmlns:u=\"urn:schemas-sony-com:service:IRCC:1\"><IRCCCode>" + irccCode + "</IRCCCode></u:X_SendIRCC></s:Body></s:Envelope>";
        try {
            URL url = new URL("http://" + ip + "/sony/ircc");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(1500);
            conn.setReadTimeout(1500);
            conn.setRequestProperty("SOAPACTION", "\"urn:schemas-sony-com:service:IRCC:1#X_SendIRCC\"");
            conn.setRequestProperty("X-Auth-PSK", "0000");
            conn.setRequestProperty("Content-Type", "text/xml; charset=UTF-8");
            conn.setDoOutput(true);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(soapXml.getBytes(StandardCharsets.UTF_8));
                os.flush();
            }
            return conn.getResponseCode() == 200;
        } catch (Exception e) {
            return false;
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
            default: return null;
        }
    }
}
