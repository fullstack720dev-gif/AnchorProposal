import { Injectable } from '@nestjs/common';
import {
  experienceBullets,
  experienceCompany,
  experienceDates,
  experienceTitle,
  formatCertificateLine,
  formatEducationLine,
  skillRows,
  type PromptResumeContent,
} from '@anchorproposal/shared';
import { TemplatesService } from '../templates/templates.service';
import { StorageService } from '../storage/storage.service';
import * as puppeteer from 'puppeteer';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

@Injectable()
export class DocumentRendererService {
  constructor(
    private templatesService: TemplatesService,
    private storage: StorageService,
  ) {}

  async renderPdf(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  async renderDocx(content: PromptResumeContent): Promise<Buffer> {
    const children: Paragraph[] = [];
    const contact = content.contact;

    children.push(
      new Paragraph({
        children: [new TextRun({ text: contact.name, bold: true, size: 32 })],
        alignment: AlignmentType.LEFT,
      }),
    );
    if (contact.title) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: contact.title, bold: true, size: 22 })],
        }),
      );
    }
    const contactLine = [contact.address, contact.email, contact.phone, contact.linkedin]
      .filter(Boolean)
      .join(' | ');
    if (contactLine) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: contactLine, size: 18, color: '64748B' })],
        }),
      );
    }

    if (content.summary) {
      children.push(new Paragraph({ text: 'Professional Summary', heading: HeadingLevel.HEADING_2 }));
      children.push(new Paragraph({ children: [new TextRun(content.summary)] }));
    }

    const skills = skillRows(content.skills || []);
    if (skills.length) {
      children.push(new Paragraph({ text: 'Technical Skills', heading: HeadingLevel.HEADING_2 }));
      for (const group of skills) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${group.category}: `, bold: true }),
              new TextRun(group.items),
            ],
          }),
        );
      }
    }

    if (content.experiences?.length) {
      children.push(
        new Paragraph({ text: 'Professional Experience', heading: HeadingLevel.HEADING_2 }),
      );
      for (const exp of content.experiences) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${experienceTitle(exp)} — ${experienceCompany(exp)}`,
                bold: true,
              }),
              new TextRun({ text: `  ${experienceDates(exp)}`, italics: true }),
            ],
          }),
        );
        for (const bullet of experienceBullets(exp)) {
          children.push(new Paragraph({ text: bullet, bullet: { level: 0 } }));
        }
      }
    }

    if (content.educations?.length) {
      children.push(new Paragraph({ text: 'Education', heading: HeadingLevel.HEADING_2 }));
      for (const edu of content.educations) {
        const line = formatEducationLine(edu);
        if (!line) continue;
        children.push(
          new Paragraph({
            children: [new TextRun({ text: line, bold: true })],
          }),
        );
      }
    }

    if (content.certificates?.length) {
      children.push(new Paragraph({ text: 'Certifications', heading: HeadingLevel.HEADING_2 }));
      for (const cert of content.certificates) {
        const line = formatCertificateLine(cert);
        if (!line) continue;
        children.push(
          new Paragraph({
            children: [new TextRun({ text: line })],
          }),
        );
      }
    }

    const doc = new Document({ sections: [{ children }] });
    return Packer.toBuffer(doc);
  }

  async renderAll(
    applicationId: string,
    generationId: string,
    content: PromptResumeContent,
    templateConfig: object,
    baseFilename: string,
  ) {
    const html = this.templatesService.renderPreviewHtml(content, templateConfig);
    const [pdfBuffer, docxBuffer] = await Promise.all([
      this.renderPdf(html),
      this.renderDocx(content),
    ]);

    const [pdfPath, docxPath] = await Promise.all([
      this.storage.saveFile(applicationId, generationId, `${baseFilename}.pdf`, pdfBuffer),
      this.storage.saveFile(applicationId, generationId, `${baseFilename}.docx`, docxBuffer),
    ]);

    return [
      { type: 'PDF' as const, kind: 'RESUME' as const, filename: `${baseFilename}.pdf`, storagePath: pdfPath },
      { type: 'DOCX' as const, kind: 'RESUME' as const, filename: `${baseFilename}.docx`, storagePath: docxPath },
    ];
  }

  async renderCoverLetter(
    applicationId: string,
    generationId: string,
    cover: {
      greeting: string;
      paragraphs: string[];
      closing: string;
      signatureName: string;
      company: string;
    },
    baseFilename: string,
    templateConfig: object = {},
  ) {
    const cfg = templateConfig as {
      colors?: { primary?: string; heading?: string; body?: string };
      typography?: { bodyFont?: string; baseFontSize?: number; lineHeight?: number };
      layout?: { marginTop?: number; marginBottom?: number; marginLeft?: number; marginRight?: number };
    };
    const font = cfg.typography?.bodyFont || 'Georgia, serif';
    const bodyColor = cfg.colors?.body || '#334155';
    const headingColor = cfg.colors?.heading || '#1e293b';
    const primary = cfg.colors?.primary || '#1e3a5f';
    const fontSize = cfg.typography?.baseFontSize || 11;
    const lineHeight = cfg.typography?.lineHeight || 1.6;
    const mt = cfg.layout?.marginTop ?? 48;
    const mb = cfg.layout?.marginBottom ?? 48;
    const ml = cfg.layout?.marginLeft ?? 56;
    const mr = cfg.layout?.marginRight ?? 56;

    const coverBase = `${baseFilename}_CoverLetter`;
    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const bodyHtml = cover.paragraphs.map((p) => `<p style="margin: 0 0 14px;">${p}</p>`).join('');

    const html = `
      <html><head><meta charset="utf-8" /></head>
      <body style="font-family: ${font}; font-size: ${fontSize}pt; line-height: ${lineHeight}; color: ${bodyColor};
        margin: ${mt}px ${mr}px ${mb}px ${ml}px;">
        <p style="margin: 0 0 20px; color: ${headingColor};">${dateStr}</p>
        <p style="margin: 0 0 20px; color: ${headingColor};">Hiring Manager<br/>${cover.company}</p>
        <p style="margin: 0 0 16px; color: ${headingColor};">${cover.greeting}</p>
        ${bodyHtml}
        <p style="margin: 20px 0 0; color: ${headingColor};">${cover.closing}</p>
        <p style="margin: 8px 0 0; color: ${primary}; font-weight: 600;">${cover.signatureName}</p>
      </body></html>`;

    const docxChildren: Paragraph[] = [
      new Paragraph({ children: [new TextRun({ text: dateStr, color: headingColor.replace('#', '') })] }),
      new Paragraph({ children: [] }),
      new Paragraph({ children: [new TextRun('Hiring Manager')] }),
      new Paragraph({ children: [new TextRun(cover.company)] }),
      new Paragraph({ children: [] }),
      new Paragraph({ children: [new TextRun(cover.greeting)] }),
      new Paragraph({ children: [] }),
      ...cover.paragraphs.flatMap((para) => [
        new Paragraph({ children: [new TextRun(para)] }),
        new Paragraph({ children: [] }),
      ]),
      new Paragraph({ children: [new TextRun(cover.closing)] }),
      new Paragraph({ children: [new TextRun({ text: cover.signatureName, bold: true })] }),
    ];

    const docx = await Packer.toBuffer(new Document({ sections: [{ children: docxChildren }] }));
    const pdfBuffer = await this.renderPdf(html);

    const [pdfPath, docxPath] = await Promise.all([
      this.storage.saveFile(applicationId, generationId, `${coverBase}.pdf`, pdfBuffer),
      this.storage.saveFile(applicationId, generationId, `${coverBase}.docx`, docx),
    ]);

    return [
      { type: 'PDF' as const, kind: 'COVER_LETTER' as const, filename: `${coverBase}.pdf`, storagePath: pdfPath },
      { type: 'DOCX' as const, kind: 'COVER_LETTER' as const, filename: `${coverBase}.docx`, storagePath: docxPath },
    ];
  }
}
