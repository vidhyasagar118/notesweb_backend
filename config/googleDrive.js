const { google } = require("googleapis");
const path = require("path");

const KEYFILEPATH = path.join(__dirname, "../service-account.json");

const SCOPES = [
  "https://www.googleapis.com/auth/drive"
];

const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});

const driveService = google.drive({
  version: "v3",
  auth,
});

module.exports = driveService;