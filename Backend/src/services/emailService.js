import sgMail from "@sendgrid/mail";
import ENV from "../config/env.js";
import logger from "../utils/logger.js";

if (ENV.SENDGRID_API_KEY) {
    sgMail.setApiKey(ENV.SENDGRID_API_KEY);
}

export const emailService = {
    /**
     * Send alert email via SendGrid
     * @param {Object} params
     * @param {string} params.to - Recipient email address
     * @param {string} params.subject - Email subject
     * @param {string} params.text - Plaintext body
     * @param {string} [params.html] - HTML body
     * @returns {Promise<{ messageId: string }>}
     */
    async sendAlertEmail({ to, subject, text, html }) {
        if (!ENV.SENDGRID_API_KEY) {
            throw new Error("SENDGRID_API_KEY is not configured in backend environment.");
        }

        if (!to) {
            throw new Error("Recipient email address is required.");
        }

        const msg = {
            to,
            from: {
                email: ENV.SENDGRID_FROM_EMAIL || "alerts@productpulse.com",
                name: "ProductPulse Alerts",
            },
            subject,
            text,
            html: html || text,
        };

        try {
            const [response] = await sgMail.send(msg);
            const messageId = response?.headers?.["x-message-id"] || `sg_${Date.now()}`;
            logger.info(`Alert email sent successfully to ${to} (Message ID: ${messageId})`);
            return { messageId };
        } catch (error) {
            let errorMessage = error?.response?.body?.errors?.[0]?.message || error.message;
            if (error?.code === 401 || errorMessage?.includes("not authorized to send mail")) {
                errorMessage = "SendGrid API key is not authorized to send mail. Please create an API key in SendGrid with 'Full Access' (or 'Mail Send' permission) and verify your sender email.";
            }
            logger.error(`Failed to send alert email to ${to}:`, errorMessage);
            throw new Error(errorMessage);
        }
    },
};

export default emailService;
