console.log("Hello from the frontend! 🚀");

document.addEventListener("DOMContentLoaded", (event) => {
  console.log("DOM fully loaded and parsed");

  // date HTML element
  const dataElement = document.getElementById("content-text");

  // Create a WebSocket connection
  const socket = new WebSocket("ws://127.0.0.1:9000/echo");

  // Connection opened
  socket.addEventListener("open", (event) => {
    console.log("WebSocket is open now.");
    socket.send("echooo 2 10 10 10");
  });

  // Listen for messages
  socket.addEventListener("message", (event) => {
    console.log(event.data);

    // Update the UI
    updateUI(event.data);
  });

  // Handle errors
  socket.addEventListener("error", (error) => {
    console.error("WebSocket error observed:", error);
  });

  // Connection closed
  socket.addEventListener("close", (event) => {
    console.log("WebSocket is closed now.");
  });

  // Update the UI function
  function updateUI(data) {
    dataElement.textContent += "\n" + data;
    console.log(data);
  }

  // Coordinates for Arad, Romania
  let aradCoords = getCartesian(46.1866, 21.3123);
  console.log(aradCoords);

});

function getCartesian(lat, lon) {
  // Convert degrees to radians
  let latRad = lat * Math.PI / 180;
  let lonRad = lon * Math.PI / 180;

  // Radius of the Earth in kilometers
  let R = 6371;

  // Cartesian coordinates
  let x = R * Math.cos(latRad) * Math.cos(lonRad);
  let y = R * Math.cos(latRad) * Math.sin(lonRad);
  let z = R * Math.sin(latRad);

  return { x: x, y: y, z: z };
}
