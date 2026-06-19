const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async ({ name, email, phone, message }) => {
  return await resend.emails.send({
    from: "onboarding@resend.dev",
    to: process.env.EMAIL_USER, // tumhara gmail
    subject: "New Contact Message",
    html: `
      <h2>New Contact Form</h2>
      <p><b>Name:</b> ${name}</p>
      <p><b>Email:</b> ${email}</p>
      <p><b>Phone:</b> ${phone}</p>
      <p><b>Message:</b> ${message}</p>
    `,
  });
};

module.exports = sendEmail;