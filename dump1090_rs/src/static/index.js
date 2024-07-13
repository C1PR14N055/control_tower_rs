const DEBUG = true;
const RELOAD_INTERVAL = 10000;

if (DEBUG) {
  setTimeout(() => {}, RELOAD_INTERVAL);
}

// Test log
console.log("Hello from the frontend! 🚀");

// DOM load events
document.addEventListener("DOMContentLoaded", (_event) => {
  console.log("DOM fully loaded and parsed!");
  // Create a WebSocket connection
  const socket = new WebSocket("ws://127.0.0.1:9000/echo");
  // Connection opened
  socket.addEventListener("open", (_event) => {
    console.log("WebSocket is open now.");
    socket.send("echooo 2 10 10 10");
  });
  // Listen for messages
  socket.addEventListener("message", (event) => {
    console.log(`[-] Got data from server: ${event.data}`);
    // TODO: try catch this
    parsedData = parse(event.data);
    // Update the UI
    updateUI(parsedData);
  });
  // Handle errors
  socket.addEventListener("error", (error) => {
    console.error("WebSocket error observed:", error);
    alert("WebSocket error observed:", error);
  });
  // Connection closed
  socket.addEventListener("close", (_event) => {
    console.log("WebSocket is closed now.");
  });
  // Coordinates for Arad, Romania (test case)
  let aradCoords = getCartesian(46.1866, 21.3123);
  console.log(aradCoords);
});

// convert lat/lon to cartesian coordinates
function getCartesian(lat, lon) {
  // Convert degrees to radians
  let latRad = (lat * Math.PI) / 180;
  let lonRad = (lon * Math.PI) / 180;

  // Radius of the Earth in kilometers
  let R = 6371;

  // Cartesian coordinates
  let x = R * Math.cos(latRad) * Math.cos(lonRad);
  let y = R * Math.cos(latRad) * Math.sin(lonRad);
  let z = R * Math.sin(latRad);

  return { x: x, y: y, z: z };
}

// Helper function to convert hex to binary
function hexToBin(hexString) {
  console.log(`[-] Hex: ${hexString}`);
  let binaryString = Array.from(hexString)
    .map((char) => {
      // Convert each hex character to its binary representation
      let bin = parseInt(char, 16).toString(2).padStart(4, "0");
      return bin;
    })
    .join("");
  console.log(`[-] Bin: ${binaryString}`);
  return binaryString;
}

// Main function to parse hex message
function parse(hexMessage) {
  let binaryMessage = hexToBin(hexMessage);
  // Ensure the binary message is 112 bits long
  if (binaryMessage.length !== 112) {
    console.log("Invalid ADS-B message length.");
    return "Invalid ADS-B message length.";
  }

  // Extract the type code (bits 33-37, 5 bits)
  let typeCode = parseInt(binaryMessage.slice(32, 37), 2) || 0;
  let pretty = "\n";
  let message = {};

  switch (true) {
    // TCAS (Traffic Collision Avoidance System)
    // TODO: check this works?
    case 0: {
      let identification = decodeIdentification(binaryMessage.slice(40, 88));
      // Extract ICAO Address (first 24 bits)
      let icaoAddress = parseInt(binaryMessage.slice(8, 32), 2)
        .toString(16)
        .toUpperCase()
        .padStart(6, "0");
      message.typeCode = typeCode;
      message.typeDesc = "TCAS";
      message.icaoAddress = icaoAddress;
      message.ident = identification;

      return message;
    }

    case 1 <= typeCode && typeCode <= 4: {
      let category = parseInt(binaryMessage.slice(37, 40), 2) || 0;
      let identification = decodeIdentification(binaryMessage.slice(40, 88));
      // Extract ICAO Address (first 24 bits)
      let icaoAddress = parseInt(binaryMessage.slice(8, 32), 2)
        .toString(16)
        .toUpperCase()
        .padStart(6, "0");
      message.typeCode = typeCode;
      message.typeDesc = "IDENT";
      message.category = category;
      message.icaoAddress = icaoAddress;
      message.ident = identification;

      return message;
    }

    case 5 <= typeCode && typeCode <= 8: {
      let [lat, lon] = decodeSurfacePosition(binaryMessage);
      // Extract ICAO Address (first 24 bits)
      let icaoAddress = parseInt(binaryMessage.slice(8, 32), 2)
        .toString(16)
        .toUpperCase()
        .padStart(6, "0");
      let identification = decodeIdentification(binaryMessage.slice(40, 88));
      message.typeCode = typeCode;
      message.typeDesc = "Surface Position";
      message.icaoAddress = icaoAddress;
      message.ident = identification;
      message.latitude = lat;
      message.longitude = lon;

      return message;
    }

    case 9 <= typeCode && typeCode <= 18: {
      let altitude = decodeAltitude(binaryMessage.slice(40, 52));
      let [lat, lon] = decodeAirbornePosition(binaryMessage);
      // Extract ICAO Address (first 24 bits)
      let icaoAddress = parseInt(binaryMessage.slice(8, 32), 2)
        .toString(16)
        .toUpperCase()
        .padStart(6, "0");
      let identification = decodeIdentification(binaryMessage.slice(40, 88));

      message.typeCode = typeCode;
      message.typeDesc = "Airborne Position w/ Altitude";
      message.icaoAddress = icaoAddress;
      message.ident = identification;
      message.latitude = lat;
      message.longitude = lon;
      message.altitude = altitude;

      return message;
    }

    case typeCode === 19: {
      let velocity = decodeVelocity(binaryMessage.slice(40));
      let identification = decodeIdentification(binaryMessage.slice(40, 88));
      // Extract ICAO Address (first 24 bits)
      let icaoAddress = parseInt(binaryMessage.slice(8, 32), 2)
        .toString(16)
        .toUpperCase()
        .padStart(6, "0");
      message.typeCode = typeCode;
      message.typeDesc = "Airborne Velocity";
      message.icaoAddress = icaoAddress;
      message.ident = identification;
      message.velocity = velocity;

      return message;
    }

    case 20 <= typeCode && typeCode <= 22: {
      // Extract ICAO Address (first 24 bits)
      let icaoAddress = parseInt(binaryMessage.slice(8, 32), 2)
        .toString(16)
        .toUpperCase()
        .padStart(6, "0");
      let identification = decodeIdentification(binaryMessage.slice(40, 88));
      message.typeCode = typeCode;
      message.typeDesc = "Reserved for future use";
      message.icaoAddress = icaoAddress;
      message.ident = identification;

      return message;
    }

    case 23 <= typeCode && typeCode <= 27: {
      let identification = decodeIdentification(binaryMessage.slice(40, 88));
      // Extract ICAO Address (first 24 bits)
      let icaoAddress = parseInt(binaryMessage.slice(8, 32), 2)
        .toString(16)
        .toUpperCase()
        .padStart(6, "0");
      message.typeCode = typeCode;
      message.typeDesc = "Test Message";
      message.icaoAddress = icaoAddress;
      message.ident = identification;

      return message;
    }

    case 28 <= typeCode && typeCode <= 31: {
      let identification = decodeIdentification(binaryMessage.slice(40, 88));
      // Extract ICAO Address (first 24 bits)
      let icaoAddress = parseInt(binaryMessage.slice(8, 32), 2)
        .toString(16)
        .toUpperCase()
        .padStart(6, "0");
      message.typeCode = typeCode;
      message.typeDesc = "Extended Squitter";
      message.icaoAddress = icaoAddress;
      message.ident = identification;

      return message;
    }

    default: {
      let identification = decodeIdentification(binaryMessage.slice(40, 88));
      // Extract ICAO Address (first 24 bits)
      let icaoAddress = parseInt(binaryMessage.slice(8, 32), 2)
        .toString(16)
        .toUpperCase()
        .padStart(6, "0");
      message.typeCode = typeCode;
      message.typeDesc = "Unknown";
      message.icaoAddress = icaoAddress;
      message.ident = identification;

      return message;
    }
  }
}

// Helper function to decode identification
function decodeIdentification(bits) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ     ";
  let identification = "";
  for (let i = 0; i < 48; i += 6) {
    let index = parseInt(bits.slice(i, i + 6), 2) || 32;
    identification += chars[index] || "?";
  }
  return identification.trim();
}

// Helper function to decode surface position
function decodeSurfacePosition(binaryMessage) {
  let latBits = binaryMessage.slice(54, 71);
  let lonBits = binaryMessage.slice(71, 88);
  let lat = parseInt(latBits, 2) || 0;
  let lon = parseInt(lonBits, 2) || 0;
  lat = (lat * 180.0) / 131072.0 - 90.0;
  lon = (lon * 360.0) / 131072.0 - 180.0;
  return [lat, lon];
}

// Helper function to decode altitude
function decodeAltitude(bits) {
  let altitudeCode = parseInt(bits, 2) || 0;
  return Math.max(0, altitudeCode * 25 - 1000);
}

// Helper function to decode airborne position
function decodeAirbornePosition(binaryMessage) {
  let latBits = binaryMessage.slice(54, 71);
  let lonBits = binaryMessage.slice(71, 88);
  let lat = parseInt(latBits, 2) || 0;
  let lon = parseInt(lonBits, 2) || 0;
  lat = (lat * 180.0) / 131072.0 - 90.0;
  lon = (lon * 360.0) / 131072.0 - 180.0;
  return [lat, lon];
}

// Helper function to decode velocity
function decodeVelocity(bits) {
  let velocityBits = bits.slice(13, 23);
  return parseInt(velocityBits, 2) || 0;
}

// Data store to group entries by ICAO address
const icaoDataStore = {};

// Function to update the data store with parsed data
function updateDataStore(parsedData) {
  let { icao, data } = parsedData;

  if (!icaoDataStore[icao]) {
    icaoDataStore[icao] = [];
  }
  icaoDataStore[icao].push(data);
  console.log("[-] Updated data store: ", icaoDataStore);
}

// Update the UI function
let updateTriggeredCount = 0;
function updateUI(data) {
  // clear
  const dataElement = document.getElementById("content-text");
  // set data
  dataElement.textContent += JSON.stringify(data); // Clear previous content
  // scroll down...
  dataElement.scrollTop = dataElement.scrollHeight;
  updateTriggeredCount++;
}
