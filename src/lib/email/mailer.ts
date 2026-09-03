import nodemailer from "nodemailer";

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const smtpHost = getRequiredEnv("SMTP_HOST");
const smtpPort = Number(getRequiredEnv("SMTP_PORT"));
const smtpUser = getRequiredEnv("SMTP_USER");
const smtpPassword = getRequiredEnv("SMTP_PASSWORD");
const smtpFromEmail = getRequiredEnv("SMTP_FROM_EMAIL");
const smtpFromName = getRequiredEnv("SMTP_FROM_NAME");

if (!Number.isFinite(smtpPort)) {
  throw new Error("SMTP_PORT must be a valid number.");
}

export const mailTransporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,

  auth: {
    user: smtpUser,
    pass: smtpPassword,
  },
});

export function getTradeLogicSender() {
  return {
    name: smtpFromName,
    address: smtpFromEmail,
  };
}

export function getSupportEmail() {
  return getRequiredEnv("SUPPORT_EMAIL");
}