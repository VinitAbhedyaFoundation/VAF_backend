import * as nodemailer from "nodemailer";
import { Injectable, OnModuleInit } from "@nestjs/common";

@Injectable()
export class MailService implements OnModuleInit {
  private transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // 🔍 Verify connection on startup
  async onModuleInit() {
    try {
      await this.transporter.verify();
      console.log("✅ Mail server is ready");
    } catch (err) {
      console.error("❌ Mail server error:", err);
    }
  }

  // 📧 Send bulk email
  async sendBulkMail(to: string[], subject: string, content: string) {
    if (!to.length) return;

    try {
      await this.transporter.sendMail({
        from: `"VAF Portal" <${process.env.EMAIL_USER}>`,
        bcc: to,
        subject,
        html: `
          <div style="font-family: Arial, sans-serif;">
            <h2>${subject}</h2>
            <p>${content}</p>
            <hr />
            <small>Sent via VAF Portal</small>
          </div>
        `,
      });

      console.log(`📨 Email sent to ${to.length} users`);
    } catch (err) {
      console.error("❌ Mail send error:", err);
      throw err;
    }
  }
}