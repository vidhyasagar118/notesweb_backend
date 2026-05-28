const newFile = await File.create({
    userId: req.user.id,
    subject: req.body.subject,
    semester: req.body.semester,
    filename: file.originalname,

    filepath: response.data.webViewLink,       // ✅ correct
    downloadUrl: response.data.webContentLink, // ✅ correct
    publicId: response.data.id                // ✅ correct
});