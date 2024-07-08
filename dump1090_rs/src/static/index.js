console.log("Hello from the frontend! 🚀");

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

  // Extract ICAO Address (first 24 bits)
  let icaoAddress = parseInt(binaryMessage.slice(8, 32), 2)
    .toString(16)
    .toUpperCase()
    .padStart(6, "0");

  // log ICAO Address
  console.log(`[-] ICAO Address: ${icaoAddress}`);

  // Extract the type code (bits 33-37, 5 bits)
  let typeCode = parseInt(binaryMessage.slice(32, 37), 2) || 0;
  let pretty = "\n";

  switch (true) {
    case 1 <= typeCode && typeCode <= 4:
      pretty = `[-] Type Code: ${typeCode} (Identification)`;
      let category = parseInt(binaryMessage.slice(37, 40), 2) || 0;
      let identification = decodeIdentification(binaryMessage.slice(40, 88));
      pretty += `; Category: ${category}`;
      console.log(`[-] IDENT: ${identification}`);
      pretty += `; IDENT: ${identification}`;
      return `icao=${icaoAddress};tc=${typeCode};cat=${category};id=${identification};cute=${pretty}`;

    case 5 <= typeCode && typeCode <= 8:
      pretty = `[-] Type Code: ${typeCode} (Surface Position)`;
      let [lat, lon] = decodeSurfacePosition(binaryMessage);
      pretty += `; Latitude: ${lat}`;
      pretty += `; Longitude: ${lon}`;
      return `icao=${icaoAddress};tc=${typeCode};lat=${lat};lon=${lon};cute=${pretty}`;

    case 9 <= typeCode && typeCode <= 18:
      pretty = `[-] Type Code: ${typeCode} (Airborne Position w/ Altitude)`;
      let altitude = decodeAltitude(binaryMessage.slice(40, 52));
      pretty += `; Altitude: ${altitude} feet`;
      try {
        [lat, lon] = decodeAirbornePosition(binaryMessage);
        pretty += `; Latitude: ${lat}`;
        pretty += `; Longitude: ${lon}`;
        return `icao=${icaoAddress};tc=${typeCode};alt=${altitude};lat=${lat};lon=${lon};cute=${pretty}`;
      } catch (e) {
        // silence
      }

    case typeCode === 19:
      pretty = `[-] Type Code: ${typeCode} (Airborne Velocity)`;
      let velocity = decodeVelocity(binaryMessage.slice(40));
      pretty += `; Velocity: ${velocity} knots`;
      return `icao=${icaoAddress};tc=${typeCode};vel=${velocity};cute=${pretty}`;

    case 20 <= typeCode && typeCode <= 22:
      pretty = `[-] Type Code: ${typeCode} (Reserved for future use)`;
      return `icao=${icaoAddress};tc=${typeCode};cute=${pretty}`;

    case 23 <= typeCode && typeCode <= 27:
      pretty = `[-] Type Code: ${typeCode} (Test Message)`;
      return `icao=${icaoAddress};tc=${typeCode};cute=${pretty}`;

    case 28 <= typeCode && typeCode <= 31:
      pretty = `[-] Type Code: ${typeCode} (Extended Squitter)`;
      return `icao=${icaoAddress};tc=${typeCode};cute=${pretty}`;

    default:
      pretty = `[-] Type Code: ${typeCode} (Unknown or unsupported)`;
      return `icao=${icaoAddress};tc=${typeCode};cute=${pretty}`;
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
  dataElement.textContent += `\n[${updateTriggeredCount}] ${data.split("cute=")[1]}`; // Clear previous content
  // scroll down...
  dataElement.scrollTop = dataElement.scrollHeight;
  updateTriggeredCount++;
}

// Example usage
let binaryMessage =
  "0101110101000101110100000110010010110011101000001101010110010011011010100110011011010101101010010100110011110110";
let parsed = parse(binaryMessage);
console.log("[-] Test parse: ", parsed); // Expected output: tc=5;lat=37.0;lon=-122.0

// DOM load events
document.addEventListener("DOMContentLoaded", (event) => {
  console.log("DOM fully loaded and parsed");

  // Create a WebSocket connection
  const socket = new WebSocket("ws://127.0.0.1:9000/echo");
  // Connection opened
  socket.addEventListener("open", (event) => {
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
  socket.addEventListener("close", (event) => {
    console.log("WebSocket is closed now.");
  });

  // Coordinates for Arad, Romania (test case)
  let aradCoords = getCartesian(46.1866, 21.3123);
  console.log(aradCoords);
});
