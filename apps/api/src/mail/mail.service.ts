import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(this.config.get('SMTP_PORT') || 587),
        secure: this.config.get('SMTP_SECURE') === 'true',
        auth: {
          user: this.config.get<string>('SMTP_USER') || '',
          pass: this.config.get<string>('SMTP_PASS') || '',
        },
      });
    }
  }

  async send(to: string, subject: string, text: string, html?: string) {
    const from = this.config.get<string>('SMTP_FROM') || 'AnchorProposal <noreply@anchorproposal.local>';

    if (!this.transporter) {
      this.logger.log(`[DEV MAIL] To: ${to} | Subject: ${subject}\n${text}`);
      return { queued: false, logged: true };
    }

    await this.transporter.sendMail({
      from,
      to,
      subject,
      text,
      html: html || text.replace(/\n/g, '<br/>'),
    });
    return { queued: true, logged: false };
  }

  async sendOtp(to: string, purpose: 'signup' | 'login', code: string) {
    const label = purpose === 'signup' ? 'Sign-up' : 'Sign-in';
    const subject = `AnchorProposal ${label} verification code`;
    const text = `Your AnchorProposal ${label.toLowerCase()} verification code is: ${code}\n\nThis code expires in 10 minutes.\nIf you did not request this, ignore this email.`;
    return this.send(to, subject, text);
  }

  async sendResetLink(to: string, token: string) {
    const base = this.config.get<string>('APP_WEB_URL') || 'http://localhost:3000';
    const link = `${base.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
    const subject = 'AnchorProposal password reset';
    const text = `Reset your AnchorProposal password using this link:\n\n${link}\n\nThis link expires in 1 hour and can be used once.\nIf you did not request a reset, ignore this email.`;
    return this.send(to, subject, text);
  }
}
