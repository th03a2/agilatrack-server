import nodemailer from "nodemailer";
import { normalizeFlag, normalizeText } from "../utils/auth.js";

let cachedTransporter = null;
let cachedConfig = null;

const getSmtpConfig = () => ({
  from:
    normalizeText(process.env.SMTP_FROM) ||
    normalizeText(process.env.EMAIL_FROM) ||
    "AgilaTrack <no-reply@agilatrack.com>",
  host:
    normalizeText(process.env.SMTP_HOST) || 
    normalizeText(process.env.EMAIL_SMTP_HOST) ||
    "smtp.gmail.com",
  pass:
    normalizeText(process.env.SMTP_PASS) || 
    normalizeText(process.env.EMAIL_SMTP_PASS),
  port: Number(process.env.SMTP_PORT || process.env.EMAIL_SMTP_PORT || 587),
  secure: normalizeFlag(process.env.SMTP_SECURE || process.env.EMAIL_SMTP_SECURE) === "true",
  user:
    normalizeText(process.env.SMTP_USER) || 
    normalizeText(process.env.EMAIL_SMTP_USER),
});

const createTransporter = () => {
  const config = getSmtpConfig();
  
  // Check if all required fields are present
  if (!config.host || !config.user || !config.pass || !config.from) {
    console.warn("[email] SMTP configuration incomplete. Email sending disabled.");
    return null;
  }

  // Check if configuration has changed
  const configString = JSON.stringify(config);
  if (cachedTransporter && cachedConfig === configString) {
    return cachedTransporter;
  }

  try {
    // Create Gmail-specific transporter
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure, // true for 465, false for other ports
      auth: {
        user: config.user,
        pass: config.pass, // Use App Password for Gmail
      },
      tls: {
        rejectUnauthorized: false, // Allow self-signed certificates
      },
    });

    // Verify connection
    transporter.verify((error, success) => {
      if (error) {
        console.error("[email] SMTP connection verification failed:", error.message);
      } else {
        console.log("[email] SMTP connection verified successfully");
      }
    });

    cachedTransporter = transporter;
    cachedConfig = configString;
    
    console.log("[email] Email transporter created successfully");
    return transporter;
  } catch (error) {
    console.error("[email] Failed to create email transporter:", error.message);
    return null;
  }
};

const sendEmail = async ({ to, subject, html, text, from }) => {
  const transporter = createTransporter();
  
  if (!transporter) {
    const error = "Email transporter not available. Check SMTP configuration.";
    console.error("[email]", error);
    throw new Error(error);
  }

  const config = getSmtpConfig();
  const emailFrom = from || config.from;

  const mailOptions = {
    from: emailFrom,
    to: Array.isArray(to) ? to.join(", ") : to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, ""), // Strip HTML for plain text
  };

  try {
    console.log(`[email] Sending email to: ${mailOptions.to}`);
    console.log(`[email] Subject: ${subject}`);
    
    const result = await transporter.sendMail(mailOptions);
    
    console.log(`[email] Email sent successfully. Message ID: ${result.messageId}`);
    console.log(`[email] Response: ${result.response}`);
    
    return {
      success: true,
      messageId: result.messageId,
      response: result.response,
    };
  } catch (error) {
    console.error("[email] Failed to send email:", error.message);
    
    // Handle common Gmail errors
    if (error.code === 'EAUTH') {
      throw new Error("Authentication failed. Check your Gmail credentials and App Password.");
    } else if (error.code === 'ECONNECTION') {
      throw new Error("Connection failed. Check your network and SMTP settings.");
    } else if (error.code === 'EENVELOPE') {
      throw new Error("Invalid recipient address.");
    } else {
      throw new Error(`Email sending failed: ${error.message}`);
    }
  }
};

const sendTestEmail = async (recipientEmail) => {
  const subject = "AgilaTrack Email Test";
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">AgilaTrack PH</h1>
        <p style="color: rgba(255, 255, 255, 0.9); margin: 5px 0 0 0;">Email System Test</p>
      </div>
      <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
        <h2 style="color: #1e293b; margin-top: 0;">This is a real email test from AgilaTrack PH.</h2>
        <p style="color: #475569; font-size: 16px;">
          Congratulations! Your email system is working correctly. This email was sent using Gmail SMTP 
          with proper authentication and error handling.
        </p>
        <div style="background: #e0f2fe; border-left: 4px solid #0ea5e9; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #0c4a6e;">
            <strong>Test Details:</strong><br>
            • Sent at: ${new Date().toLocaleString()}<br>
            • SMTP Server: Gmail<br>
            • Authentication: App Password<br>
            • Status: ✅ Success
          </p>
        </div>
        <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
          If you received this email, your AgilaTrack email system is ready for production use.
        </p>
      </div>
    </div>
  `;
  
  const text = `
AgilaTrack Email Test

This is a real email test from AgilaTrack PH.

Congratulations! Your email system is working correctly. This email was sent using Gmail SMTP with proper authentication and error handling.

Test Details:
- Sent at: ${new Date().toLocaleString()}
- SMTP Server: Gmail
- Authentication: App Password
- Status: Success

If you received this email, your AgilaTrack email system is ready for production use.
  `;

  return await sendEmail({
    to: recipientEmail,
    subject,
    html,
    text,
  });
};

export {
  sendEmail,
  sendTestEmail,
  createTransporter,
  getSmtpConfig,
};
