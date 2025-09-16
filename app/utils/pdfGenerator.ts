import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface OrderData {
  _id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  currency: string;
  expectedDeliveryDate: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  client: {
    _id: string;
    name: string;
    contactPerson: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    country: string;
    type: string;
  };
  items: Array<{
    product: string;
    quantityKg: number;
    unitPrice: number;
    exclusiveValue?: number;
    gstRate?: number;
    gstAmount?: number;
    inclusiveTotal?: number;
    totalPrice?: number; // Legacy field
    notes?: string;
  }>;
  invoice?: {
    invoiceNumber: string; // This will be the same as orderNumber
    status: string;
    amount: number;
    totalPaid: number;
    outstandingBalance: number;
    dueDate: number;
  };
  delivery?: {
    carrier: string;
    trackingNumber?: string;
    status: string;
    destination: string;
    incoterms: string;
  };
}

export const generateOrderPDF = async (order: OrderData) => {
  try {
    const doc = new jsPDF();
  
  // Company Header Section
  let headerY = 20;
  
  // Try to load and add company logo
  try {
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    
    // Try multiple possible logo paths
    const logoPaths = [
      '/images/Logo-Final-Vector-22.png',
      '/Logo-Final-Vector-22.png',
      '/public/images/Logo-Final-Vector-22.png'
    ];
    
    let logoLoaded = false;
    for (const path of logoPaths) {
      try {
        logoImg.src = path;
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Logo loading timeout')), 2000);
          logoImg.onload = () => {
            clearTimeout(timeout);
            logoLoaded = true;
            resolve(logoImg);
          };
          logoImg.onerror = () => {
            clearTimeout(timeout);
            reject(new Error(`Logo failed to load from ${path}`));
          };
        });
        if (logoLoaded) break;
      } catch (pathError) {
        console.warn(`Failed to load logo from ${path}:`, pathError);
        continue;
      }
    }
    
    if (!logoLoaded) {
      throw new Error('All logo paths failed');
    }
    
    // Add logo to PDF
    const logoWidth = 30;
    const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
    doc.addImage(logoImg, 'PNG', 20, headerY, logoWidth, logoHeight);
    
    // Company Header (positioned next to logo)
    doc.setFontSize(16);
    doc.setTextColor(40, 40, 40);
    doc.text('Halal Gelatin Manufacturing', 60, headerY + 8);
    
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Premium Quality Halal Gelatin Products', 60, headerY + 15);
    
    // Add a line separator below header
    const separatorY = Math.max(headerY + logoHeight + 5, headerY + 20);
    doc.setDrawColor(200, 200, 200);
    doc.line(20, separatorY, 190, separatorY);
    
    // Update starting position for content
    headerY = separatorY + 10;
    
  } catch (error) {
    console.warn('Logo could not be loaded, using text-only header:', error);
    
    // Professional text-only header with styling
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text('Halal Gelatin Manufacturing', 20, headerY + 10);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Premium Quality Halal Gelatin Products', 20, headerY + 18);
    
    // Add a decorative line separator
    doc.setDrawColor(200, 200, 200);
    doc.line(20, headerY + 25, 190, headerY + 25);
    
    // Update starting position for content
    headerY = headerY + 30;
  }
  
  // Order Title
  doc.setFontSize(16);
  doc.setTextColor(40, 40, 40);
  doc.text(`Order Details - ${order.orderNumber}`, 20, headerY + 5);
  
  // Order Info Section
  let yPosition = headerY + 20;
  
  // Order Information
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  doc.text('Order Information', 20, yPosition);
  yPosition += 8;
  
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  
  const orderInfo = [
    ['Order Number:', order.orderNumber],
    ['Status:', order.status.toUpperCase().replace('_', ' ')],
    ['Order Date:', new Date(order.factoryDepartureDate || order.orderCreationDate || order.createdAt).toLocaleDateString()],
    ['Expected Delivery:', new Date(order.expectedDeliveryDate).toLocaleDateString()],
    ['Total Amount:', `${order.currency} ${order.totalAmount.toLocaleString()}`],
  ];
  
  orderInfo.forEach(([label, value]) => {
    doc.text(label, 25, yPosition);
    doc.text(value, 85, yPosition);
    yPosition += 7;
  });
  
  yPosition += 5;
  
  // Client Information
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  doc.text('Client Information', 20, yPosition);
  yPosition += 8;
  
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  
  const clientInfo = [
    ['Company:', order.client.name || 'N/A'],
    ['Contact Person:', order.client.contactPerson || 'N/A'],
    ['Email:', order.client.email || 'N/A'],
    ['Phone:', order.client.phone || 'N/A'],
    ['Address:', order.client.address || 'N/A'],
    ['City/Country:', `${order.client.city || 'N/A'}, ${order.client.country || 'N/A'}`],
    ['Type:', (order.client.type || 'N/A').toUpperCase()],
  ];
  
  clientInfo.forEach(([label, value]) => {
    doc.text(label, 25, yPosition);
    doc.text(value, 85, yPosition);
    yPosition += 7;
  });
  
  yPosition += 10;
  
  // Order Items Table
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  doc.text('Order Items', 20, yPosition);
  yPosition += 5;
  
  // Check if we have GST data to determine table structure
  const hasGSTData = order.items.some(item => item.inclusiveTotal !== undefined);
  
  let itemsTableData;
  let tableHeaders;
  
  if (hasGSTData) {
    // Enhanced table with GST breakdown
    tableHeaders = ['Product', 'Quantity', 'Rate', 'Ex. Value', 'GST (18%)', 'Inclusive Total', 'Notes'];
    itemsTableData = order.items.map(item => {
      const exclusiveValue = item.exclusiveValue || (item.quantityKg * item.unitPrice);
      const gstAmount = item.gstAmount || ((exclusiveValue * 18) / 100);
      const inclusiveTotal = item.inclusiveTotal || (exclusiveValue + gstAmount);
      
      return [
        item.product,
        `${item.quantityKg} kg`,
        `${order.currency} ${item.unitPrice.toFixed(2)}`,
        `${order.currency} ${exclusiveValue.toFixed(2)}`,
        `${order.currency} ${gstAmount.toFixed(2)}`,
        `${order.currency} ${inclusiveTotal.toFixed(2)}`,
        item.notes || '-'
      ];
    });
  } else {
    // Simple table without GST
    tableHeaders = ['Product', 'Quantity', 'Unit Price', 'Total Price', 'Notes'];
    itemsTableData = order.items.map(item => [
      item.product,
      `${item.quantityKg} kg`,
      `${order.currency} ${item.unitPrice.toFixed(2)}`,
      `${order.currency} ${(item.totalPrice || (item.quantityKg * item.unitPrice)).toFixed(2)}`,
      item.notes || '-'
    ]);
  }
  
  autoTable(doc, {
    startY: yPosition,
    head: [tableHeaders],
    body: itemsTableData,
    theme: 'grid',
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontSize: 9,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [60, 60, 60]
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245]
    },
    margin: { left: 20, right: 20, bottom: 40 },
    columnStyles: hasGSTData ? {
      0: { cellWidth: 35 },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 22, halign: 'right' },
      3: { cellWidth: 22, halign: 'right' },
      4: { cellWidth: 18, halign: 'right' },
      5: { cellWidth: 22, halign: 'right' },
      6: { cellWidth: 20 }
    } : {
      0: { cellWidth: 45 },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 25, halign: 'right' },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 30 }
    },
    pageBreak: 'auto',
    showHead: 'everyPage',
    tableLineColor: [200, 200, 200],
    tableLineWidth: 0.1,
    styles: {
      overflow: 'linebreak',
      cellPadding: 3
    }
  });
  
  yPosition = (doc as any).lastAutoTable.finalY + 15;
  
  // Add Order Summary
  if (hasGSTData) {
    const totalExclusiveValue = order.items.reduce((sum, item) => 
      sum + (item.exclusiveValue || (item.quantityKg * item.unitPrice)), 0
    );
    const totalGST = order.items.reduce((sum, item) => 
      sum + (item.gstAmount || ((item.exclusiveValue || (item.quantityKg * item.unitPrice)) * 18 / 100)), 0
    );
    const totalInclusive = order.items.reduce((sum, item) => 
      sum + (item.inclusiveTotal || (item.exclusiveValue || (item.quantityKg * item.unitPrice)) + (item.gstAmount || 0)), 0
    );
    
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    doc.text('Order Summary', 20, yPosition);
    yPosition += 8;
    
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    
    const summaryInfo = [
      ['Total Exclusive Value:', `${order.currency} ${totalExclusiveValue.toFixed(2)}`],
      ['Total GST (18%):', `${order.currency} ${totalGST.toFixed(2)}`],
      ['Total Inclusive Amount:', `${order.currency} ${totalInclusive.toFixed(2)}`],
    ];
    
    summaryInfo.forEach(([label, value]) => {
      doc.text(label, 25, yPosition);
      doc.text(value, 120, yPosition, { align: 'right' });
      yPosition += 6;
    });
    
    yPosition += 10;
  }
  
  // Check if we need a new page for subsequent sections
  const checkPageSpace = (requiredSpace: number) => {
    if (yPosition + requiredSpace > 270) { // Leave margin at bottom
      doc.addPage();
      yPosition = 30;
    }
  };
  
  // Invoice Information (if available)
  if (order.invoice) {
    checkPageSpace(40); // Check space for invoice section
    
    yPosition += 5;
    doc.setFontSize(12);
    doc.setTextColor(60, 60, 60);
    doc.text('Invoice Information', 20, yPosition);
    yPosition += 10;
    
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    
    const invoiceInfo = [
      ['Invoice Number:', order.orderNumber], // Same as order number
      ['Invoice Status:', order.invoice.status.toUpperCase().replace('_', ' ')],
      ['Total Paid:', `${order.currency} ${order.invoice.totalPaid.toLocaleString()}`],
      ['Outstanding:', `${order.currency} ${order.invoice.outstandingBalance.toLocaleString()}`],
      ['Due Date:', new Date(order.invoice.dueDate).toLocaleDateString()],
    ];
    
    invoiceInfo.forEach(([label, value]) => {
      doc.text(label, 25, yPosition);
      doc.text(value, 80, yPosition);
      yPosition += 6;
    });
    yPosition += 5;
  }
  
  // Delivery Information (if available)
  if (order.delivery) {
    checkPageSpace(40); // Check space for delivery section
    
    yPosition += 5;
    doc.setFontSize(12);
    doc.setTextColor(60, 60, 60);
    doc.text('Delivery Information', 20, yPosition);
    yPosition += 10;
    
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    
    const deliveryInfo = [
      ['Carrier:', order.delivery.carrier],
      ['Tracking Number:', order.delivery.trackingNumber || 'Not assigned'],
      ['Status:', order.delivery.status.toUpperCase().replace('_', ' ')],
      ['Destination:', order.delivery.destination],
      ['Incoterms:', order.delivery.incoterms],
    ];
    
    deliveryInfo.forEach(([label, value]) => {
      doc.text(label, 25, yPosition);
      doc.text(value, 80, yPosition);
      yPosition += 6;
    });
    yPosition += 5;
  }
  
  // Notes (if available)
  if (order.notes) {
    // Split long notes into multiple lines first to estimate space needed
    doc.setFontSize(10);
    const noteLines = doc.splitTextToSize(order.notes, 150);
    const notesSpaceNeeded = 20 + (noteLines.length * 5); // Header + line spacing
    
    checkPageSpace(notesSpaceNeeded);
    
    yPosition += 5;
    doc.setFontSize(12);
    doc.setTextColor(60, 60, 60);
    doc.text('Order Notes', 20, yPosition);
    yPosition += 10;
    
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    
    noteLines.forEach((line: string) => {
      // Check if we need a new page for each line
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 30;
      }
      doc.text(line, 25, yPosition);
      yPosition += 5;
    });
  }
  
  // Footer
  const pageHeight = doc.internal.pageSize.height;
  const pageCount = doc.getNumberOfPages();
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Footer content
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('Generated on: ' + new Date().toLocaleString(), 20, pageHeight - 20);
    doc.text('Halal Gelatin Manufacturing CRM System', 20, pageHeight - 15);
    doc.text(`Page ${i} of ${pageCount}`, 170, pageHeight - 15);
    
    // Add a subtle line above footer
    doc.setDrawColor(220, 220, 220);
    doc.line(20, pageHeight - 25, 190, pageHeight - 25);
  }
  
  // Save the PDF
  doc.save(`Order-${order.orderNumber}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF. Please try again.');
  }
};
