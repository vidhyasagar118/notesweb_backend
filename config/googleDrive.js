const { google } = require("googleapis");

const credentials = JSON.parse(
    process.env.GOOGLE_SERVICE_ACCOUNT
);

const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
        "https://www.googleapis.com/auth/drive"
    ]
});

const driveService = google.drive({
    version: "v3",
    auth
});

module.exports = driveService;