import jsPDF from 'jspdf';

export interface PDFLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface PDFDocumentData {
  docNumber: string;
  date: string;
  validUntil?: string; // For quotes
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  projectName?: string;
  items: PDFLineItem[];
  amountPaid?: number; // For invoices
  notes?: string;
  currencySymbol?: string; // Default 'KES' or '$'
  companyInfo?: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    tagline?: string;
  };
}

// Helper to load image as HTMLImageElement
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image: ' + src));
    img.src = src;
  });
}

// Helper to format currency numbers
export function formatMoney(val: number): string {
  return val.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export async function generateDocumentPDF(
  type: 'invoice' | 'quote',
  data: PDFDocumentData
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2; // 180mm

  // Brand Colors
  const charcoal = [38, 38, 38]; // #262626
  const goldOchre = [194, 139, 56]; // #C28B38
  const crimsonRed = [197, 48, 48]; // #C53030
  const lightGrayBg = [248, 247, 244]; // #F8F7F4
  const borderGray = [225, 222, 215]; // #E1DED7
  const mutedText = [120, 115, 110]; // #78736E

  // 1. Header: Logo (Top-Left)
  let yPos = margin;
  let logoLoaded = false;

  try {
    const logoImg = await loadImage('/pamnim-invoice-logo.jpg');
    // Maintain aspect ratio: max width 40mm, max height 22mm
    const maxW = 38;
    const maxH = 22;
    let w = logoImg.width;
    let h = logoImg.height;
    if (w > 0 && h > 0) {
      const ratio = Math.min(maxW / w, maxH / h);
      w = w * ratio;
      h = h * ratio;
      doc.addImage(logoImg, 'JPEG', margin, yPos, w, h);
      logoLoaded = true;
    }
  } catch (e) {
    console.warn('Could not load logo image for PDF, using stylized text logo fallback.', e);
  }

  if (!logoLoaded) {
    // Stylized Fallback Logo
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(goldOchre[0], goldOchre[1], goldOchre[2]);
    doc.text('PAMNIM', margin, yPos + 6);

    doc.setFontSize(9);
    doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
    doc.text('INTERIOR DESIGNERS', margin, yPos + 11);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
    doc.text('Shinning outside, beautiful inside', margin, yPos + 15);
  }

  // Company Details (Top-Right)
  const compName = data.companyInfo?.name || 'Pamnim Interior Designers';
  const compAddress = data.companyInfo?.address || 'Nairobi, Kenya';
  const compPhone = data.companyInfo?.phone || '0714 984 268';
  const compEmail = data.companyInfo?.email || 'hinteriors01@gmail.com';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
  doc.text(compName, pageWidth - margin, yPos + 4, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.text(compAddress, pageWidth - margin, yPos + 9, { align: 'right' });
  doc.text(`Phone: ${compPhone}`, pageWidth - margin, yPos + 13.5, { align: 'right' });
  doc.text(`Email: ${compEmail}`, pageWidth - margin, yPos + 18, { align: 'right' });

  yPos += 26;

  // Horizontal Divider
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.setLineWidth(0.4);
  doc.line(margin, yPos, pageWidth - margin, yPos);

  yPos += 8;

  // 2. Document Title & Metadata
  const isInvoice = type === 'invoice';
  const docTitle = isInvoice ? 'INVOICE' : 'QUOTATION';
  const titleColor = isInvoice ? crimsonRed : goldOchre;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(titleColor[0], titleColor[1], titleColor[2]);
  doc.text(docTitle, margin, yPos + 5);

  // Meta details (Right side of title)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
  doc.text(`${isInvoice ? 'Invoice No:' : 'Quote No:'} ${data.docNumber}`, pageWidth - margin, yPos + 1, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.text(`Date: ${data.date}`, pageWidth - margin, yPos + 5.5, { align: 'right' });

  if (!isInvoice && data.validUntil) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(goldOchre[0], goldOchre[1], goldOchre[2]);
    doc.text(`Valid Until: ${data.validUntil}`, pageWidth - margin, yPos + 10, { align: 'right' });
  }

  yPos += 14;

  // 3. "Bill To" / "Prepared For" Section
  const cardY = yPos;
  const cardHeight = data.projectName ? 26 : 22;

  // Card Background
  doc.setFillColor(lightGrayBg[0], lightGrayBg[1], lightGrayBg[2]);
  doc.roundedRect(margin, cardY, contentWidth, cardHeight, 2, 2, 'F');
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, cardY, contentWidth, cardHeight, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(goldOchre[0], goldOchre[1], goldOchre[2]);
  doc.text(isInvoice ? 'BILL TO:' : 'PREPARED FOR:', margin + 5, cardY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
  doc.text(data.clientName || 'Valued Client', margin + 5, cardY + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  const contactParts = [data.clientPhone, data.clientEmail].filter(Boolean);
  if (contactParts.length > 0) {
    doc.text(contactParts.join('  •  '), margin + 5, cardY + 16);
  }

  if (data.projectName) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
    doc.text(`Project: ${data.projectName}`, margin + 5, cardY + 21);
  }

  yPos = cardY + cardHeight + 8;

  // 4. Line Items Table
  const colDescX = margin;
  const colDescW = 95;
  const colQtyX = margin + colDescW;
  const colQtyW = 20;
  const colUnitPriceX = colQtyX + colQtyW;
  const colUnitPriceW = 32;
  const colTotalX = colUnitPriceX + colUnitPriceW;
  const colTotalW = 33;

  // Table Header
  doc.setFillColor(charcoal[0], charcoal[1], charcoal[2]);
  doc.rect(margin, yPos, contentWidth, 7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('DESCRIPTION', colDescX + 3, yPos + 4.8);
  doc.text('QTY', colQtyX + colQtyW / 2, yPos + 4.8, { align: 'center' });
  doc.text('UNIT PRICE', colUnitPriceX + colUnitPriceW - 3, yPos + 4.8, { align: 'right' });
  doc.text('TOTAL', colTotalX + colTotalW - 3, yPos + 4.8, { align: 'right' });

  yPos += 7;

  let subtotal = 0;

  // Table Rows
  data.items.forEach((item, index) => {
    const itemQty = Number(item.quantity) || 1;
    const itemUnitPrice = Number(item.unitPrice) || 0;
    const itemTotal = itemQty * itemUnitPrice;
    subtotal += itemTotal;

    // Check if new page is needed
    if (yPos > pageHeight - 65) {
      doc.addPage();
      yPos = margin;
    }

    const isEven = index % 2 === 0;
    if (isEven) {
      doc.setFillColor(lightGrayBg[0], lightGrayBg[1], lightGrayBg[2]);
      doc.rect(margin, yPos, contentWidth, 7.5, 'F');
    }

    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.setLineWidth(0.2);
    doc.line(margin, yPos + 7.5, pageWidth - margin, yPos + 7.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);

    // Truncate long descriptions if needed
    const descText = doc.splitTextToSize(item.description || 'Service/Item', colDescW - 6);
    doc.text(descText[0], colDescX + 3, yPos + 5);

    doc.text(itemQty.toString(), colQtyX + colQtyW / 2, yPos + 5, { align: 'center' });
    doc.text(formatMoney(itemUnitPrice), colUnitPriceX + colUnitPriceW - 3, yPos + 5, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.text(formatMoney(itemTotal), colTotalX + colTotalW - 3, yPos + 5, { align: 'right' });

    yPos += 7.5;
  });

  yPos += 4;

  // 5. Totals & Balance Summary
  const summaryBoxW = 75;
  const summaryBoxX = pageWidth - margin - summaryBoxW;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.text('Subtotal:', summaryBoxX, yPos + 4);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
  doc.text(formatMoney(subtotal), pageWidth - margin, yPos + 4, { align: 'right' });

  yPos += 7;

  if (isInvoice) {
    const amountPaid = Number(data.amountPaid) || 0;
    const balanceDue = subtotal - amountPaid;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
    doc.text('Amount Paid:', summaryBoxX, yPos + 4);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
    doc.text(formatMoney(amountPaid), pageWidth - margin, yPos + 4, { align: 'right' });

    yPos += 7;

    // Balance Due Banner Box
    doc.setFillColor(254, 242, 242); // Light red
    doc.roundedRect(summaryBoxX - 2, yPos, summaryBoxW + 2, 8.5, 1.5, 1.5, 'F');
    doc.setDrawColor(crimsonRed[0], crimsonRed[1], crimsonRed[2]);
    doc.setLineWidth(0.4);
    doc.roundedRect(summaryBoxX - 2, yPos, summaryBoxW + 2, 8.5, 1.5, 1.5, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(crimsonRed[0], crimsonRed[1], crimsonRed[2]);
    doc.text('Balance Due:', summaryBoxX + 2, yPos + 5.8);
    doc.text(formatMoney(balanceDue), pageWidth - margin - 2, yPos + 5.8, { align: 'right' });

    yPos += 14;
  } else {
    // Total for Quote (Gold)
    doc.setFillColor(254, 249, 239); // Light ochre
    doc.roundedRect(summaryBoxX - 2, yPos, summaryBoxW + 2, 8.5, 1.5, 1.5, 'F');
    doc.setDrawColor(goldOchre[0], goldOchre[1], goldOchre[2]);
    doc.setLineWidth(0.4);
    doc.roundedRect(summaryBoxX - 2, yPos, summaryBoxW + 2, 8.5, 1.5, 1.5, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(goldOchre[0], goldOchre[1], goldOchre[2]);
    doc.text('Total Estimate:', summaryBoxX + 2, yPos + 5.8);
    doc.text(formatMoney(subtotal), pageWidth - margin - 2, yPos + 5.8, { align: 'right' });

    yPos += 14;
  }

  // 6. Notes / Payment Terms Section
  if (data.notes && data.notes.trim()) {
    if (yPos > pageHeight - 45) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
    doc.text(isInvoice ? 'PAYMENT INSTRUCTIONS & NOTES:' : 'ESTIMATE NOTES & TERMS:', margin, yPos);

    yPos += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
    const splitNotes = doc.splitTextToSize(data.notes.trim(), contentWidth);
    doc.text(splitNotes, margin, yPos);

    yPos += splitNotes.length * 4 + 4;
  }

  // 7. Footer
  const footerY = pageHeight - margin - 8;
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 2, pageWidth - margin, footerY - 2);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(goldOchre[0], goldOchre[1], goldOchre[2]);
  doc.text('Pamnim Interior Designers — "Shinning outside, beautiful inside"', pageWidth / 2, footerY + 2, { align: 'center' });

  if (!isInvoice) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
    doc.text('This quotation is an estimate subject to site inspection, material pricing, and scope adjustments.', pageWidth / 2, footerY + 5.5, { align: 'center' });
  }

  // 8. Save & Trigger Download
  const sanitizedClient = (data.clientName || 'Client').replace(/[^a-zA-Z0-9_-]/g, '_');
  const sanitizedDoc = (data.docNumber || 'Doc').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = isInvoice
    ? `Invoice_${sanitizedDoc}_${sanitizedClient}.pdf`
    : `Quote_${sanitizedDoc}_${sanitizedClient}.pdf`;

  doc.save(filename);
}
