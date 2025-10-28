// script.js - verbeterde versie
(async () => {
  // check of tmImage geladen is
  if (typeof tmImage === "undefined") {
    console.error("tmImage is not loaded! Check your script tags.");
    return;
  }

  const URL = "my_model/"; // map met model.json + metadata.json + weights

  // Pas deze keys exact aan naar de class-namen van jouw Teachable Machine model!
  const sounds = {
    "Boek lezen": new Audio("my_sounds/Boek lezen.mp3"),
    "Hand omhoog": new Audio("my_sounds/Hand omhoog.mp3"),
    "Duim omhoog": new Audio("my_sounds/Duim omhoog.mp3"),
    "Neutraal": new Audio("my_sounds/Neutraal.mp3")
  };

  const images = {
    "Boek lezen": "my_images/Boek lezen.png",
    "Hand omhoog": "my_images/Hand omhoog.png",
    "Duim omhoog": "my_images/Duim omhoog.png",
    "Neutraal": "my_images/Neutraal.png"
  };

  // --- parameters
  let model = null, webcam = null;
  const confidenceThreshold = 0.9;
  const maxThreshold = 1.0;
  const holdTime = 2000;
  const cooldown = 4000;
  const bufferSize = 5;
  const displayHoldDuration = 5000;
  const neutralHoldDuration = 500;

  const holdStart = {};
  const lastPlayed = {};
  const predictionBuffer = {};
  let currentDetectedClass = null;
  let lastDetectionTime = 0;
  let lastNeutralTime = 0;

  const imageDiv = document.getElementById("image-display");
  const predictionP = document.getElementById("prediction");
  const webcamContainer = document.getElementById("webcam-container");

  // zet een neutrale afbeelding, als fallback
  if (images["Neutraal"]) {
    imageDiv.innerHTML = `<img src="${images["Neutraal"]}" alt="Neutraal" width="200">`;
  }

  // Webcam initialisatie (foutafhandeling)
  try {
    webcam = new tmImage.Webcam(400, 300, true);
    await webcam.setup(); // vraagt permissie
    await webcam.play();
    webcamContainer.appendChild(webcam.canvas);
    console.log("Webcam ready!");
  } catch (err) {
    console.error("Webcam initialization failed:", err);
    predictionP.innerText = "Webcam error: " + (err.message || err);
    return;
  }

  // Model laden
  try {
    model = await tmImage.load(URL + "model.json", URL + "metadata.json");
    console.log("Model loaded!");
  } catch (err) {
    console.error("Model loading failed:", err);
    predictionP.innerText = "Model load error: " + (err.message || err);
    model = null;
  }

  // hoofdloop
  async function loop() {
    webcam.update();
    if (model) await predict();
    requestAnimationFrame(loop);
  }

  async function predict() {
    try {
      const prediction = await model.predict(webcam.canvas);

      // zoek hoogste voorspelling
      let highest = prediction.reduce((a, b) => a.probability > b.probability ? a : b);
      const className = highest.className;
      const prob = highest.probability;

      // buffer per class (gladden van voorspellingen)
      if (!predictionBuffer[className]) predictionBuffer[className] = [];
      predictionBuffer[className].push(prob);
      if (predictionBuffer[className].length > bufferSize) predictionBuffer[className].shift();
      const avgProb = predictionBuffer[className].reduce((a, b) => a + b, 0) / predictionBuffer[className].length;

      const now = Date.now();

      // als we recent iets hebben gedetecteerd, houd dat zichtbaar
      if (currentDetectedClass && now - lastDetectionTime < displayHoldDuration) {
        predictionP.innerText = `Detected: ${currentDetectedClass}`;
        return;
      }

      // als gemiddelde probabiliteit te laag is, toon neutraal
      if (avgProb < confidenceThreshold) {
        if (!currentDetectedClass || now - lastNeutralTime > neutralHoldDuration) {
          predictionP.innerText = "No detection";
          if (images["Neutraal"]) imageDiv.innerHTML = `<img src="${images["Neutraal"]}" alt="Neutraal" width="200">`;
          currentDetectedClass = null;
          lastNeutralTime = now;
        }
        return;
      }

      // toon huidige voorspelling
      predictionP.innerText = `Detected: ${className} (${(avgProb * 100).toFixed(1)}%)`;

      // als er een geluid gekoppeld is en we voldoen aan thresholds
      if (sounds[className] && avgProb >= confidenceThreshold && avgProb <= maxThreshold) {
        if (!holdStart[className]) holdStart[className] = now;

        if (now - holdStart[className] >= holdTime) {
          if (!lastPlayed[className] || now - lastPlayed[className] > cooldown) {
            // speel geluid en zet afbeelding
            try {
              sounds[className].currentTime = 0;
              sounds[className].play();
            } catch (e) {
              console.warn("Audio play failed:", e);
            }
            lastPlayed[className] = now;

            if (images[className]) imageDiv.innerHTML = `<img src="${images[className]}" alt="${className}" width="200">`;
            currentDetectedClass = className;
            lastDetectionTime = now;
          }
          // reset holdStart zodat het event na cooldown opnieuw kan beginnen
          holdStart[className] = null;
        }
      } else {
        // geen stabiele herkenning, reset hold start
        holdStart[className] = null;
      }

    } catch (err) {
      console.error("Prediction failed:", err);
    }
  }

  loop();
})();
