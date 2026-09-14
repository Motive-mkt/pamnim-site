import jsPDF from 'jspdf';

export interface PDFLineItem {
  id: string;
  description: string;
  quantity?: number;
  unitPrice?: number;
  paymentType?: 'Partial' | 'Full' | string;
  amount?: number;
  refCode?: string;
  date?: string;
}

export interface PDFDocumentData {
  docNumber: string;
  date: string;
  dueDate?: string; // For invoices
  validUntil?: string; // For quotes
  invoiceMode?: 'walk_in' | 'pay_later';
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  projectName?: string;
  items: PDFLineItem[];
  subtotal?: number; // Base subtotal before discount/tax
  discount?: number; // Discount amount in KES
  taxRate?: number; // e.g. 16 for 16%
  taxAmount?: number; // Calculated tax in KES
  totalInvoiced?: number; // For invoices
  amountPaid?: number; // For invoices
  balanceDue?: number; // Calculated: totalInvoiced - amountPaid
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

export async function buildDocumentPDF(
  type: 'invoice' | 'quote',
  data: PDFDocumentData
): Promise<{ doc: jsPDF; filename: string }> {
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

  if (isInvoice && data.dueDate) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(crimsonRed[0], crimsonRed[1], crimsonRed[2]);
    doc.text(`Due Date: ${data.dueDate}`, pageWidth - margin, yPos + 10, { align: 'right' });
  } else if (!isInvoice && data.validUntil) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(goldOchre[0], goldOchre[1], goldOchre[2]);
    doc.text(`Valid Until: ${data.validUntil}`, pageWidth - margin, yPos + 10, { align: 'right' });
  }

  yPos += 15;

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
  let subtotal = 0;

  if (isInvoice && data.invoiceMode !== 'pay_later') {
    // Walk-in / Direct Payment Invoice Columns: Name / Item (70mm), Payment Type (25mm), Ref Code (35mm), Date (25mm), Amount (25mm)
    const colNameX = margin;
    const colNameW = 70;
    const colTypeX = colNameX + colNameW;
    const colTypeW = 25;
    const colRefX = colTypeX + colTypeW;
    const colRefW = 35;
    const colDateX = colRefX + colRefW;
    const colDateW = 25;
    const colAmountX = colDateX + colDateW;
    const colAmountW = 25;

    // Header
    doc.setFillColor(charcoal[0], charcoal[1], charcoal[2]);
    doc.rect(margin, yPos, contentWidth, 7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text('CLIENT / ITEM', colNameX + 3, yPos + 4.8);
    doc.text('PAYMENT TYPE', colTypeX + colTypeW / 2, yPos + 4.8, { align: 'center' });
    doc.text('REF CODE', colRefX + 3, yPos + 4.8);
    doc.text('DATE', colDateX + colDateW / 2, yPos + 4.8, { align: 'center' });
    doc.text('AMOUNT', colAmountX + colAmountW - 3, yPos + 4.8, { align: 'right' });

    yPos += 7;

    // Rows
    data.items.forEach((item, index) => {
      const itemAmount = typeof item.amount === 'number' ? item.amount : (Number(item.quantity || 1) * Number(item.unitPrice || 0));
      subtotal += itemAmount;

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
      doc.setFontSize(8);
      doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);

      const nameText = doc.splitTextToSize(item.description || 'Payment Item', colNameW - 6);
      doc.text(nameText[0], colNameX + 3, yPos + 5);

      doc.text(item.paymentType || 'Partial', colTypeX + colTypeW / 2, yPos + 5, { align: 'center' });
      doc.text(item.refCode || '—', colRefX + 3, yPos + 5);
      doc.text(item.date || '—', colDateX + colDateW / 2, yPos + 5, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.text(formatMoney(itemAmount), colAmountX + colAmountW - 3, yPos + 5, { align: 'right' });

      yPos += 7.5;
    });
  } else {
    // Quote Columns: Description (95mm), Qty (20mm), Unit Price (32mm), Total (33mm)
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
    doc.text('DESCRIPTION / SCOPE', colDescX + 3, yPos + 4.8);
    doc.text('QTY', colQtyX + colQtyW / 2, yPos + 4.8, { align: 'center' });
    doc.text('UNIT PRICE', colUnitPriceX + colUnitPriceW - 3, yPos + 4.8, { align: 'right' });
    doc.text('TOTAL', colTotalX + colTotalW - 3, yPos + 4.8, { align: 'right' });

    yPos += 7;

    // Table Rows
    data.items.forEach((item, index) => {
      const itemQty = Number(item.quantity) || 1;
      const itemUnitPrice = Number(item.unitPrice) || (typeof item.amount === 'number' ? item.amount / itemQty : 0);
      const itemTotal = typeof item.amount === 'number' && item.quantity === undefined ? item.amount : itemQty * itemUnitPrice;
      subtotal += itemTotal;

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

      const descText = doc.splitTextToSize(item.description || 'Service/Item', colDescW - 6);
      doc.text(descText[0], colDescX + 3, yPos + 5);

      doc.text(itemQty.toString(), colQtyX + colQtyW / 2, yPos + 5, { align: 'center' });
      doc.text(formatMoney(itemUnitPrice), colUnitPriceX + colUnitPriceW - 3, yPos + 5, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.text(formatMoney(itemTotal), colTotalX + colTotalW - 3, yPos + 5, { align: 'right' });

      yPos += 7.5;
    });
  }

  yPos += 4;

  // 5. Totals & Balance Summary
  const summaryBoxW = 75;
  const summaryBoxX = pageWidth - margin - summaryBoxW;

  if (isInvoice) {
    const rawSubtotal = typeof data.subtotal === 'number' && data.subtotal > 0
      ? data.subtotal
      : subtotal;

    const discountVal = Number(data.discount) || 0;
    const taxVal = Number(data.taxAmount) || 0;

    const totalInvoiced = typeof data.totalInvoiced === 'number' && data.totalInvoiced > 0 
      ? data.totalInvoiced 
      : Math.max(0, rawSubtotal - discountVal + taxVal);
    const totalPaid = typeof data.amountPaid === 'number' 
      ? data.amountPaid 
      : 0;
    const balanceDue = typeof data.balanceDue === 'number' 
      ? data.balanceDue 
      : Math.max(0, totalInvoiced - totalPaid);

    // If discount or tax is present, show breakdown: Subtotal -> Discount -> Tax/VAT -> Total Invoiced
    if (discountVal > 0 || taxVal > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
      doc.text('Subtotal:', summaryBoxX, yPos + 4);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
      doc.text(formatMoney(rawSubtotal), pageWidth - margin, yPos + 4, { align: 'right' });

      yPos += 6;

      if (discountVal > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
        doc.text('Discount:', summaryBoxX, yPos + 4);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(crimsonRed[0], crimsonRed[1], crimsonRed[2]);
        doc.text(`- ${formatMoney(discountVal)}`, pageWidth - margin, yPos + 4, { align: 'right' });

        yPos += 6;
      }

      if (taxVal > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
        const vatLabel = data.taxRate ? `Tax / VAT (${data.taxRate}%):` : 'Tax / VAT:';
        doc.text(vatLabel, summaryBoxX, yPos + 4);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
        doc.text(`+ ${formatMoney(taxVal)}`, pageWidth - margin, yPos + 4, { align: 'right' });

        yPos += 6;
      }
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
    doc.text('Total Invoiced:', summaryBoxX, yPos + 4);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
    doc.text(formatMoney(totalInvoiced), pageWidth - margin, yPos + 4, { align: 'right' });

    yPos += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
    doc.text('Payments Logged:', summaryBoxX, yPos + 4);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
    doc.text(formatMoney(totalPaid), pageWidth - margin, yPos + 4, { align: 'right' });

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
    doc.text('Outstanding Balance:', summaryBoxX + 2, yPos + 5.8);
    doc.text(formatMoney(Math.max(0, balanceDue)), pageWidth - margin - 2, yPos + 5.8, { align: 'right' });

    yPos += 14;
  } else {
    // Total for Quote (Gold)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
    doc.text('Subtotal:', summaryBoxX, yPos + 4);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
    doc.text(formatMoney(subtotal), pageWidth - margin, yPos + 4, { align: 'right' });

    yPos += 7;

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

  // 8. Return doc & filename
  const sanitizedClient = (data.clientName || 'Client').replace(/[^a-zA-Z0-9_-]/g, '_');
  const sanitizedDoc = (data.docNumber || 'Doc').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = isInvoice
    ? `Invoice_${sanitizedDoc}_${sanitizedClient}.pdf`
    : `Quote_${sanitizedDoc}_${sanitizedClient}.pdf`;

  return { doc, filename };
}

export async function generateDocumentPDF(
  type: 'invoice' | 'quote',
  data: PDFDocumentData
): Promise<void> {
  const { doc, filename } = await buildDocumentPDF(type, data);
  doc.save(filename);
}

export async function shareDocumentPDF(
  type: 'invoice' | 'quote',
  data: PDFDocumentData
): Promise<{ success: boolean; method: 'native_share' | 'whatsapp' }> {
  const { doc, filename } = await buildDocumentPDF(type, data);
  const blob = doc.output('blob');

  const isInvoice = type === 'invoice';
  const totalAmount = isInvoice
    ? (typeof data.totalInvoiced === 'number' && data.totalInvoiced > 0
        ? data.totalInvoiced
        : data.items.reduce((s, i) => s + (Number(i.amount) || Number(i.unitPrice) || 0), 0))
    : data.items.reduce((s, i) => s + (Number(i.amount) || (Number(i.quantity || 1) * Number(i.unitPrice || 0))), 0);

  const balance = typeof data.balanceDue === 'number'
    ? data.balanceDue
    : Math.max(0, totalAmount - (data.amountPaid || 0));

  let messageText = '';
  if (isInvoice) {
    messageText = `Hello ${data.clientName || 'Valued Client'}, here is your official Invoice (${data.docNumber}) from Pamnim Interior Designers for KES ${formatMoney(totalAmount)}. ${balance > 0 ? `Outstanding Balance: KES ${formatMoney(balance)}. ` : 'Status: Fully Paid. '}Please find the PDF attached.`;
  } else {
    messageText = `Hello ${data.clientName || 'Valued Client'}, here is your official Quotation (${data.docNumber}) from Pamnim Interior Designers for KES ${formatMoney(totalAmount)}. Please find the PDF estimate attached.`;
  }

  // Format phone number for WhatsApp
  let phone = (data.clientPhone || '').replace(/[^0-9+]/g, '');
  if (phone.startsWith('+')) {
    phone = phone.substring(1);
  } else if (phone.startsWith('07') || phone.startsWith('01')) {
    phone = '254' + phone.substring(1);
  }

  // 1. Try native Web Share API with PDF file
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
          text: messageText
        });
        return { success: true, method: 'native_share' };
      }
    } catch (shareErr: any) {
      if (shareErr?.name === 'AbortError') {
        return { success: false, method: 'native_share' };
      }
      console.warn('Native file share failed or canceled, falling back:', shareErr);
    }
  }

  // 2. Fallback for desktop or non-file-sharing browsers:
  // Trigger file download so user has the PDF to attach in WhatsApp
  doc.save(filename);

  // Open WhatsApp link with prefilled message
  const waMessage = `${messageText}\n\n(Official PDF has been downloaded to your device and is ready to attach).`;
  const encoded = encodeURIComponent(waMessage);
  const waUrl = phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
  window.open(waUrl, '_blank', 'noopener,noreferrer');

  return { success: true, method: 'whatsapp' };
}

export interface PaymentReceiptData {
  receiptNumber: string;
  invoiceNumber: string;
  date: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  projectName?: string;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
  balanceRemaining?: number;
  totalInvoiceAmount?: number;
  notes?: string;
  recordedBy?: string;
  companyInfo?: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
}

export async function generatePaymentReceiptPDF(data: PaymentReceiptData): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  const charcoal = [28, 25, 23];
  const goldOchre = [197, 148, 59];
  const mutedText = [100, 95, 90];
  const borderGray = [220, 215, 210];
  const lightBg = [250, 248, 245];

  // Header band
  doc.setFillColor(28, 25, 23);
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Ochre accent strip
  doc.setFillColor(197, 148, 59);
  doc.rect(0, 28, pageWidth, 2.5, 'F');

  // Title in header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('OFFICIAL PAYMENT RECEIPT', margin, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(215, 175, 105);
  doc.text('PAMNIM INTERIOR DESIGNERS · NAIROBI, KENYA', margin, 21);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(`Receipt #: ${data.receiptNumber}`, pageWidth - margin, 15, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(200, 200, 200);
  doc.text(`Date: ${data.date}`, pageWidth - margin, 21, { align: 'right' });

  let yPos = 40;

  // Company and Client 2-column info
  const colWidth = (contentWidth - 10) / 2;

  // Received From (Client)
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(margin, yPos, colWidth, 34, 2, 2, 'F');
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, yPos, colWidth, 34, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(goldOchre[0], goldOchre[1], goldOchre[2]);
  doc.text('RECEIVED FROM:', margin + 4, yPos + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
  doc.text(data.clientName || 'Valued Client', margin + 4, yPos + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  if (data.clientPhone) doc.text(`Phone: ${data.clientPhone}`, margin + 4, yPos + 18);
  if (data.clientEmail) doc.text(`Email: ${data.clientEmail}`, margin + 4, yPos + 23);
  if (data.projectName) doc.text(`Project: ${data.projectName}`, margin + 4, yPos + 28);

  // Issued By (Company)
  const rightColX = margin + colWidth + 10;
  doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
  doc.roundedRect(rightColX, yPos, colWidth, 34, 2, 2, 'F');
  doc.roundedRect(rightColX, yPos, colWidth, 34, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(goldOchre[0], goldOchre[1], goldOchre[2]);
  doc.text('PAYMENT RECORDED BY:', rightColX + 4, yPos + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
  doc.text(data.companyInfo?.name || 'Pamnim Interior Designers', rightColX + 4, yPos + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.text(data.companyInfo?.address || 'Nairobi, Kenya', rightColX + 4, yPos + 18);
  doc.text(data.companyInfo?.phone || '+254 714 984 268', rightColX + 4, yPos + 23);
  doc.text(`Recorded By: ${data.recordedBy || 'Administration'}`, rightColX + 4, yPos + 28);

  yPos += 42;

  // Amount Paid Hero Card
  doc.setFillColor(254, 249, 239);
  doc.roundedRect(margin, yPos, contentWidth, 26, 3, 3, 'F');
  doc.setDrawColor(goldOchre[0], goldOchre[1], goldOchre[2]);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, yPos, contentWidth, 26, 3, 3, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
  doc.text('AMOUNT PAID THIS TRANSACTION:', margin + 6, yPos + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(goldOchre[0], goldOchre[1], goldOchre[2]);
  doc.text(`KES ${formatMoney(data.amount)}`, margin + 6, yPos + 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
  doc.text(`Against Invoice: ${data.invoiceNumber}`, pageWidth - margin - 6, yPos + 9, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  if (data.balanceRemaining !== undefined) {
    const balColor = data.balanceRemaining <= 0 ? [34, 197, 94] : [220, 38, 38];
    doc.setTextColor(balColor[0], balColor[1], balColor[2]);
    const balText = data.balanceRemaining <= 0 ? 'STATUS: FULLY PAID (NIL BALANCE)' : `REMAINING BALANCE: KES ${formatMoney(data.balanceRemaining)}`;
    doc.text(balText, pageWidth - margin - 6, yPos + 18, { align: 'right' });
  }

  yPos += 34;

  // Payment Breakdown Table
  doc.setFillColor(charcoal[0], charcoal[1], charcoal[2]);
  doc.rect(margin, yPos, contentWidth, 7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('PAYMENT DETAILS', margin + 4, yPos + 4.8);
  doc.text('REFERENCE / METHOD SPECIFICATION', margin + 70, yPos + 4.8);

  yPos += 7;

  const rows = [
    { label: 'Payment Method', val: (data.paymentMethod || 'Bank Transfer').toUpperCase() },
    { label: 'Reference / Trans ID', val: data.referenceNumber || 'N/A' },
    { label: 'Original Invoice Ref', val: data.invoiceNumber },
    { label: 'Total Invoice Amount', val: data.totalInvoiceAmount !== undefined ? `KES ${formatMoney(data.totalInvoiceAmount)}` : 'N/A' },
    { label: 'Amount Paid (This Slip)', val: `KES ${formatMoney(data.amount)}` },
    { label: 'Outstanding Balance', val: data.balanceRemaining !== undefined ? `KES ${formatMoney(data.balanceRemaining)}` : 'N/A' },
  ];

  rows.forEach((r, idx) => {
    const isAlt = idx % 2 === 1;
    if (isAlt) {
      doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
      doc.rect(margin, yPos, contentWidth, 7, 'F');
    }
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.setLineWidth(0.2);
    doc.line(margin, yPos + 7, pageWidth - margin, yPos + 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
    doc.text(r.label, margin + 4, yPos + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
    doc.text(r.val, margin + 70, yPos + 5);

    yPos += 7;
  });

  yPos += 10;

  if (data.notes && data.notes.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
    doc.text('TRANSACTION NOTES:', margin, yPos);
    yPos += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
    const splitNotes = doc.splitTextToSize(data.notes.trim(), contentWidth);
    doc.text(splitNotes, margin, yPos);
    yPos += splitNotes.length * 4 + 6;
  }

  // Verification watermark badge
  doc.setDrawColor(goldOchre[0], goldOchre[1], goldOchre[2]);
  doc.setLineWidth(0.8);
  doc.roundedRect(margin, yPos + 4, 65, 18, 2, 2, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(goldOchre[0], goldOchre[1], goldOchre[2]);
  doc.text('PAMNIM VERIFIED RECEIPT', margin + 32.5, yPos + 11, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.text('Electronic Document Record', margin + 32.5, yPos + 16, { align: 'center' });

  // Signature Block
  const sigX = pageWidth - margin - 60;
  doc.setDrawColor(charcoal[0], charcoal[1], charcoal[2]);
  doc.setLineWidth(0.4);
  doc.line(sigX, yPos + 18, pageWidth - margin, yPos + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
  doc.text('Authorized Signature & Stamp', sigX + 30, yPos + 22, { align: 'center' });

  // Footer
  const footerY = pageHeight - margin - 4;
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 2, pageWidth - margin, footerY - 2);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(goldOchre[0], goldOchre[1], goldOchre[2]);
  doc.text('Thank you for partnering with Pamnim Interior Designers', pageWidth / 2, footerY + 2, { align: 'center' });

  const sanitizedClient = (data.clientName || 'Client').replace(/[^a-zA-Z0-9_-]/g, '_');
  const sanitizedReceipt = (data.receiptNumber || 'Receipt').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Receipt_${sanitizedReceipt}_${sanitizedClient}.pdf`);
}

