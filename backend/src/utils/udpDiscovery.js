const os = require("os");
const dgram = require("dgram");

let udpSocket = null;
let beaconTimer = null;

/**
 * Resolves the optimal local LAN IPv4 address.
 * If clientAddress is provided, prioritizes the interface sharing the same subnet prefix.
 * Otherwise, prioritizes standard private network ranges (192.168.x.x, 10.x.x.x, 172.16-31.x.x).
 */
function getBestLanIp(clientAddress = null) {
  if (process.env.UDP_DISCOVERY_HOST) {
    return process.env.UDP_DISCOVERY_HOST;
  }

  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const [, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const net of addrs) {
      if ((net.family === "IPv4" || net.family === 4) && !net.internal) {
        if (!net.address.startsWith("169.254.")) {
          candidates.push(net.address);
        }
      }
    }
  }

  // 1. Direct /24 subnet match against client address
  if (clientAddress && typeof clientAddress === "string") {
    const clientPrefix = clientAddress.split(".").slice(0, 3).join(".");
    const matched = candidates.find((ip) => ip.split(".").slice(0, 3).join(".") === clientPrefix);
    if (matched) return matched;
  }

  // 2. Class C private network (192.168.x.x)
  const classC = candidates.find((ip) => ip.startsWith("192.168."));
  if (classC) return classC;

  // 3. Class A private network (10.x.x.x)
  const classA = candidates.find((ip) => ip.startsWith("10."));
  if (classA) return classA;

  // 4. Class B private network (172.16.0.0 - 172.31.255.255)
  const classB = candidates.find((ip) => {
    const parts = ip.split(".").map(Number);
    return parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
  });
  if (classB) return classB;

  // 5. Fallback candidate or loopback
  return candidates[0] || "127.0.0.1";
}

/**
 * Generates the JSON response payload for the ESP32.
 */
function buildDiscoveryPayload(clientAddress = null) {
  const serverIp = getBestLanIp(clientAddress);
  const httpPort = parseInt(process.env.PORT, 10) || 4000;
  return JSON.stringify({
    service: "machip-backend",
    ip: serverIp,
    port: httpPort,
    serverUrl: `http://${serverIp}:${httpPort}/api/rfid/scan`,
    fpUrl: `http://${serverIp}:${httpPort}/api/esp/fingerprint`
  });
}

/**
 * Initializes the UDP auto-discovery service on port 4001.
 */
function startUdpDiscovery(port = 4001) {
  if (udpSocket) {
    return;
  }

  try {
    udpSocket = dgram.createSocket({ type: "udp4", reuseAddr: true });

    udpSocket.on("error", (err) => {
      console.error("[UDP-DISCOVERY] Socket error:", err.message);
      if (err.code === "EADDRINUSE") {
        console.warn(`[UDP-DISCOVERY] Port ${port} is in use; auto-discovery listener will not conflict.`);
      }
    });

    udpSocket.on("message", (msg, rinfo) => {
      const text = msg.toString().trim();
      if (text.includes("MACHIP_DISCOVER")) {
        const payload = buildDiscoveryPayload(rinfo.address);
        const serverIp = getBestLanIp(rinfo.address);
        const httpPort = parseInt(process.env.PORT, 10) || 4000;

        udpSocket.send(payload, rinfo.port, rinfo.address, (err) => {
          if (err) {
            console.error(`[UDP-DISCOVERY] Failed to respond to ${rinfo.address}:${rinfo.port}:`, err.message);
          } else {
            console.log(
              `[UDP-DISCOVERY] Discovery request from ${rinfo.address}:${rinfo.port} -> Resolved to http://${serverIp}:${httpPort}`
            );
          }
        });
      }
    });

    udpSocket.bind(port, "0.0.0.0", () => {
      try {
        udpSocket.setBroadcast(true);
      } catch {
        // Socket may not support broadcast mode on some interfaces
      }
      const initialIp = getBestLanIp();
      const httpPort = parseInt(process.env.PORT, 10) || 4000;
      console.log(`[UDP-DISCOVERY] Service active on UDP port ${port} (LAN IP: ${initialIp}:${httpPort})`);
    });

    // Optional 60-second periodic beacon broadcast for live clients
    beaconTimer = setInterval(() => {
      if (!udpSocket) return;
      try {
        const payload = buildDiscoveryPayload();
        udpSocket.send(payload, port, "255.255.255.255", () => {});
      } catch {
        // Ignore broadcast drops
      }
    }, 60000);
  } catch (err) {
    console.error("[UDP-DISCOVERY] Failed to initialize socket:", err.message);
  }
}

/**
 * Shuts down the UDP auto-discovery socket cleanly.
 */
function stopUdpDiscovery() {
  if (beaconTimer) {
    clearInterval(beaconTimer);
    beaconTimer = null;
  }
  if (udpSocket) {
    try {
      udpSocket.close();
    } catch {
      // Ignore closing errors
    }
    udpSocket = null;
    console.log("[UDP-DISCOVERY] Service stopped.");
  }
}

module.exports = {
  startUdpDiscovery,
  stopUdpDiscovery,
  getBestLanIp,
  buildDiscoveryPayload
};
