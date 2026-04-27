import nodemailer from "nodemailer";
import { env, getMissingEmailEnvKeys } from "../config/env.js";

let transporter;

const createEmailConfigError = (missing) => {
  const error = new Error("Email service is not configured.");
  error.statusCode = 500;
  error.details = { missing };
  return error;
};

const getTransporter = () => {
  const missing = getMissingEmailEnvKeys();

  if (missing.length) {
    throw createEmailConfigError(missing);
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      auth: {
        pass: env.EMAIL_PASS,
        user: env.EMAIL_USER,
      },
      host: env.EMAIL_HOST,
      port: Number(env.EMAIL_PORT),
      secure: Number(env.EMAIL_PORT) === 465,
    });
  }

  return transporter;
};

export const sendVerificationCodeEmail = async ({ email, code }) => {
  const missing = getMissingEmailEnvKeys();

  if (missing.length) {
    if (env.IS_PRODUCTION) {
      throw createEmailConfigError(missing);
    }

    console.warn(
      `Email service is not configured for local development. Verification code for ${email}: ${code}. Missing: ${missing.join(", ")}`,
    );

    return {
      deliveryMode: "preview",
      missing,
      previewCode: code,
    };
  }

  await getTransporter().sendMail({
    from: env.EMAIL_FROM,
    subject: "AgilaTrack Email Verification",
    text: `Your AgilaTrack verification code is: ${code}\nThis code will expire in 10 minutes.`,
    to: email,
  });

  return {
    deliveryMode: "email",
  };
};
