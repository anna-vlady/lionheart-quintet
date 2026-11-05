// The two settings you may want to change. See README.md.
window.LH_CONFIG = {
  // The Google Apps Script web app URL that saves sign-ups (see README.md).
  // Until this is filled in, the form cannot register anyone and says so
  // instead of pretending it worked.
  // Looks like: "https://script.google.com/macros/s/.../exec"
  formEndpoint: "https://script.google.com/macros/s/AKfycbzqgUrOj5unt2De1NPncrCWrwMUCPCutepgtKDvhkqkCU8Pj2BTRbIqOSfVAVgwpdZq/exec",

  // "neutral" is the current design. "orange" is the black-to-blue background
  // with the orange circle.
  theme: "neutral",
};

document.documentElement.dataset.theme = window.LH_CONFIG.theme;
